# Rerunning this cell after a crash: free the GPU memory the failed run still holds
sys.last_traceback = sys.last_value = sys.last_exc = None
for _name in ("model", "optim", "sched", "scaler", "loader", "train_set", "x", "y", "mask", "valid", "logit", "mask_logit", "loss"):
    globals().pop(_name, None)
gc.collect()
if DEVICE == "cuda":
    torch.cuda.empty_cache()

CKPT = RUN_DIR / "checkpoints" / "last.pt"
BEST_PTH = RUN_DIR / "best_model.pth"
FINISHED = RUN_DIR / "training_finished.json"

train_rows = by_split["train"]
_pools = {0: defaultdict(list), 1: defaultdict(list)}
for i, r in enumerate(train_rows):
    _pools[r["label"]][r["source"]].append(i)
_probs = {}
for lab, pool in _pools.items():
    w = np.array([len(v) ** SOURCE_ALPHA for v in pool.values()], dtype=np.float64)
    _probs[lab] = (list(pool), w / w.sum())
    print("real" if lab == 0 else "fake", "source sampling:", {s: round(float(p), 3) for s, p in zip(*_probs[lab])})
TOTAL_STEPS = max(20, EPOCHS * len(train_rows) // BATCH_SIZE)
print("total steps:", TOTAL_STEPS)

if not _choice.exists():
    atomic_json(_choice, {"batch_size": BATCH_SIZE, "backbone": BACKBONE})


class StepSampler(Sampler):
    # each step's batch depends only on (SEED, step): half real, half fake, chosen by source first
    def __init__(self, start):
        self.start = start

    def __len__(self):
        return TOTAL_STEPS - self.start

    def __iter__(self):
        for step in range(self.start, TOTAL_STEPS):
            rng = np.random.default_rng([SEED, step])
            batch = []
            for lab in (0, 1):
                names, probs = _probs[lab]
                for s in rng.choice(names, size=BATCH_SIZE // 2, p=probs):
                    pool = _pools[lab][s]
                    batch.append(pool[int(rng.integers(len(pool)))])
            yield batch


def mask_loss(pred, target, valid):
    keep = valid.bool()
    if not keep.any():
        return pred.sum() * 0.0
    p, t = pred[keep, 0], target[keep]
    bce = F.binary_cross_entropy_with_logits(p, t)
    positive = t.flatten(1).sum(1) > 0     # a Dice score means nothing on an empty target
    if not positive.any():
        return bce
    prob, gold = torch.sigmoid(p[positive]).flatten(1), t[positive].flatten(1)
    dice = 1 - (2 * (prob * gold).sum(1) + 1) / (prob.sum(1) + gold.sum(1) + 1)
    return bce + dice.mean()


def validate(model):
    model.eval()
    fwd = lambda x: model(x)
    clean, iou = collect(fwd, VAL_SUB, "clean")
    degraded, _ = collect(fwd, VAL_SUB, "jpeg50+half")
    bad = int((~np.isfinite(clean)).sum() + (~np.isfinite(degraded)).sum())
    if bad:
        runlog(f"⚠ validation: {bad} scores were not finite, counted as 0")
        clean, degraded = np.nan_to_num(clean, nan=0.0, posinf=0.0, neginf=0.0), np.nan_to_num(degraded, nan=0.0, posinf=0.0, neginf=0.0)
    res_c, res_d = summarize(VAL_SUB, clean), summarize(VAL_SUB, degraded)
    model.train()
    return {"select": round((res_c["macro_auc"] + res_d["macro_auc"]) / 2, 4), "clean_macro_auc": res_c["macro_auc"],
            "degraded_macro_auc": res_d["macro_auc"], "balanced_acc": res_c["balanced_acc"], "mask_iou": round(iou, 4) if iou else None,
            "per_source_auc": res_c["per_source_auc"]}


if FORCE_FINISH and BEST_PTH.exists():
    print("FORCE_FINISH: using the best model so far")
elif FINISHED.exists():
    print("↺ training already finished in an earlier session:", FINISHED.read_text())
    print("  (delete training_finished.json in Drive to train again)")
else:
    _init = not CKPT.exists() and INIT_PTH is not None and INIT_PTH.exists()
    model = new_model(pretrained=not CKPT.exists() and not _init, train=True)
    if _init:
        model.load_state_dict(torch.load(INIT_PTH, map_location="cpu", weights_only=True))
        runlog(f"starting from {INIT_FROM}: {INIT_PTH}")
    head_params = [p for n, p in model.named_parameters() if not n.startswith("backbone.")]
    optim = torch.optim.AdamW([{"params": list(model.backbone.parameters()), "lr": LR_BACKBONE}, {"params": head_params, "lr": LR_HEADS}],
                              weight_decay=WEIGHT_DECAY)
    warmup = max(1, int(WARMUP_FRAC * TOTAL_STEPS))
    sched = torch.optim.lr_scheduler.LambdaLR(optim, lambda s: min(1.0, (s + 1) / warmup) * 0.5 * (1 + np.cos(np.pi * min(1.0, s / TOTAL_STEPS))))
    scaler = torch.amp.GradScaler(DEVICE, enabled=AMP_DTYPE == torch.float16)
    step, best, since_best, history = 0, -1.0, 0, []

    def params_finite():
        return all(bool(torch.isfinite(p).all()) for p in model.parameters())

    def roll_back(why):
        # broken weights: go back to the best model saved so far (else the starting model), with fresh optimizer moments
        drive_writer.wait()
        src = BEST_PTH if BEST_PTH.exists() else INIT_PTH
        if src is None or not src.exists():
            raise RuntimeError(f"{why}, and no saved model to go back to")
        model.load_state_dict(torch.load(src, map_location="cpu", weights_only=True))
        optim.state.clear()
        runlog(f"⚠ {why}: weights restored from {src}, optimizer reset")

    if CKPT.exists():
        st = torch.load(CKPT, map_location="cpu", weights_only=False)
        model.load_state_dict(st["model"]); optim.load_state_dict(st["optim"]); sched.load_state_dict(st["sched"]); scaler.load_state_dict(st["scaler"])
        step, best, since_best, history = st["step"], st["best"], st["since_best"], st["history"]
        runlog(f"resumed from checkpoint at step {step}/{TOTAL_STEPS} (best {best:.4f})")
        del st
        if not params_finite():
            roll_back("the checkpoint's weights are broken (NaN)")

    def save_checkpoint():
        if not params_finite():
            roll_back("weights became NaN, checkpoint not saved")
        snap = WORK / f"last_{step}.pt"
        torch.save({"model": model.state_dict(), "optim": optim.state_dict(), "sched": sched.state_dict(), "scaler": scaler.state_dict(),
                    "step": step, "best": best, "since_best": since_best, "history": history}, snap)

        def job(snap=snap, s=step):
            atomic_copy(snap, CKPT)
            for old in WORK.glob("last_*.pt"):
                if int(old.stem.split("_")[1]) <= s:
                    old.unlink(missing_ok=True)
            runlog(f"checkpoint step {s} stored in Drive")
        drive_writer.submit("checkpoint", job)

    def save_best(score):
        tmp = WORK / f"best_{step}.pth"
        torch.save(model.state_dict(), tmp)

        def job(tmp=tmp, s=step, sc=score):
            atomic_copy(tmp, BEST_PTH)
            tmp.unlink(missing_ok=True)
            runlog(f"new best model ({sc:.4f}, step {s}) saved to Drive")
        drive_writer.submit("best-model", job)

    model.train()
    train_set = FaceDataset(train_rows, train=True)
    loader = DataLoader(train_set, batch_sampler=StepSampler(step), num_workers=NUM_WORKERS, pin_memory=DEVICE == "cuda",
                        persistent_workers=NUM_WORKERS > 0, prefetch_factor=4 if NUM_WORKERS else None)
    t0, last_save, losses, reason, time_up = time.time(), time.time(), [], "all steps done", False
    n_steps, retried, skipped, bad_streak = 0, 0, 0, 0
    try:
        for x, y, mask, valid, _has_file in loader:
            x, y = x.to(DEVICE, non_blocking=True), y.to(DEVICE, non_blocking=True).float()
            mask, valid = mask.to(DEVICE, non_blocking=True), valid.to(DEVICE, non_blocking=True)
            target = y * (1 - LABEL_SMOOTHING) + 0.5 * LABEL_SMOOTHING
            with torch.autocast(DEVICE, dtype=AMP_DTYPE, enabled=AMP_DTYPE is not None):
                logit, mask_logit = model(x)
            loss = F.binary_cross_entropy_with_logits(logit.float(), target) + MASK_LOSS_WEIGHT * mask_loss(mask_logit.float(), mask, valid)
            if not torch.isfinite(loss) and AMP_DTYPE is not None:
                # float16 overflow (T4): redo this batch in full precision
                del logit, mask_logit, loss
                retried += 1
                try:
                    logit, mask_logit = model(x)
                    loss = F.binary_cross_entropy_with_logits(logit, target) + MASK_LOSS_WEIGHT * mask_loss(mask_logit, mask, valid)
                except torch.OutOfMemoryError:      # full precision needs more memory: skip this batch instead
                    logit = mask_logit = None
                    loss = torch.tensor(float("nan"), device=DEVICE)
                    torch.cuda.empty_cache()
            optim.zero_grad(set_to_none=True)
            if torch.isfinite(loss):
                bad_streak = 0
                scaler.scale(loss).backward()
                scaler.unscale_(optim)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optim); scaler.update()
                losses.append(loss.item())
            else:                                   # never learn from a NaN batch
                skipped += 1; bad_streak += 1
                if bad_streak >= 20:
                    roll_back("20 NaN batches in a row"); bad_streak = 0
            sched.step()
            step += 1; n_steps += 1
            if step % 100 == 0:
                if not params_finite():
                    roll_back(f"weights became NaN at step {step}")
                extra = f"  fp32 redo {retried}  skipped {skipped}" if retried or skipped else ""
                print(f"step {step}/{TOTAL_STEPS}  loss {np.mean(losses[-200:]) if losses else float('nan'):.4f}  lr {sched.get_last_lr()[0]:.2e}  "
                      f"{n_steps * BATCH_SIZE / (time.time() - t0):.0f} img/s  {session_hours():.2f} h{extra}", flush=True)
            time_up = (time.time() - t0) / 3600 >= MAX_TRAIN_HOURS or session_hours() >= MAX_SESSION_HOURS
            if step % EVAL_EVERY == 0 or step == TOTAL_STEPS or time_up:
                res = validate(model)
                history.append({"step": step, "loss": float(np.mean(losses[-500:])), **res})
                runlog(f"val @ {step}: select={res['select']} clean={res['clean_macro_auc']} degraded={res['degraded_macro_auc']} "
                       f"bal_acc={res['balanced_acc']} mask_iou={res['mask_iou']} | {res['per_source_auc']}")
                if res["select"] > best:
                    best, since_best = res["select"], 0
                    save_best(best)
                else:
                    since_best += 1
                    if since_best >= EARLY_STOP_EVALS:
                        reason = f"early stop: no improvement in {EARLY_STOP_EVALS} validations"
            if (time.time() - last_save) / 60 >= SAVE_MINUTES:
                save_checkpoint()
                last_save = time.time()
            if time_up:
                reason = f"time budget reached ({session_hours():.2f} h in this session)"
            if reason != "all steps done":
                break
    except KeyboardInterrupt:
        reason, time_up = "stopped by hand", True
    save_checkpoint()
    drive_writer.wait()
    if not BEST_PTH.exists():    # stopped before the first validation
        res = validate(model); best = res["select"]; history.append({"step": step, **res}); save_best(best); drive_writer.wait()
    del loader
    if not time_up:
        atomic_json(FINISHED, {"step": step, "reason": reason, "best": best})
    atomic_json(RUN_DIR / "history.json", history)
    runlog(f"training stopped at step {step}/{TOTAL_STEPS}: {reason}; best {best:.4f}")
    del model, optim
    gc.collect()
    if DEVICE == "cuda":
        torch.cuda.empty_cache()
    if time_up:
        raise StopHere(f"Training paused at step {step}/{TOTAL_STEPS} ({reason}). The checkpoint is in Drive: Run all again to continue.")