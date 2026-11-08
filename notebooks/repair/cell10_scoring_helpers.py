from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve
from torch.utils.data import DataLoader, Dataset, Sampler


def jpeg(img, q):
    return cv2.imdecode(cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(q)])[1], cv2.IMREAD_COLOR)


def train_augment(img, mask, rng, label):
    s = IMAGE_SIZE
    # random crop on image and mask together
    side = int(s * np.sqrt(rng.uniform(0.7, 1.0)))
    x, y = rng.integers(0, s - side + 1), rng.integers(0, s - side + 1)
    img = cv2.resize(img[y:y + side, x:x + side], (s, s), interpolation=cv2.INTER_LINEAR)
    mx, my, ms = x * MASK_SIZE // s, y * MASK_SIZE // s, max(1, side * MASK_SIZE // s)
    mask = cv2.resize(mask[my:my + ms, mx:mx + ms], (MASK_SIZE, MASK_SIZE), interpolation=cv2.INTER_LINEAR)
    if rng.random() < 0.5:
        img, mask = img[:, ::-1].copy(), mask[:, ::-1].copy()
    if rng.random() < 0.3:
        img = np.clip(img.astype(np.float32) * rng.uniform(0.8, 1.2) + rng.uniform(-15, 15), 0, 255).astype(np.uint8)
    # social-media re-upload: resize + JPEG, once or twice. Applied more often to real photos: in the training
    # data the fakes tend to carry heavier compression, and v3 learned "compressed = fake" from that
    if rng.random() < (0.6 if label == 0 else 0.35):
        for _ in range(int(rng.integers(1, 3))):
            f = rng.uniform(0.5, 1.0)
            if f < 0.95:
                small = cv2.resize(img, (int(s * f), int(s * f)), interpolation=cv2.INTER_AREA)
                img = cv2.resize(small, (s, s), interpolation=cv2.INTER_LINEAR)
            img = jpeg(img, rng.uniform(50, 90))
    if rng.random() < 0.7:   # degrade
        if rng.random() < 0.2:
            img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.3, 1.5))
        if rng.random() < 0.35:
            f = rng.uniform(0.4, 0.9)
            small = cv2.resize(img, (int(s * f), int(s * f)), interpolation=cv2.INTER_AREA)
            img = cv2.resize(small, (s, s), interpolation=int(rng.choice([cv2.INTER_LINEAR, cv2.INTER_CUBIC])))
        if rng.random() < 0.2:
            img = np.clip(img + rng.normal(0, rng.uniform(1, 8), img.shape), 0, 255).astype(np.uint8)
        if rng.random() < 0.6:
            img = jpeg(img, rng.uniform(35, 95))
        elif rng.random() < 0.25:
            img = cv2.imdecode(cv2.imencode(".webp", img, [cv2.IMWRITE_WEBP_QUALITY, int(rng.uniform(40, 90))])[1], cv2.IMREAD_COLOR)
    return img, mask


def perturb(img, kind):
    if "half" in kind:
        img = cv2.resize(cv2.resize(img, (IMAGE_SIZE // 2, IMAGE_SIZE // 2), interpolation=cv2.INTER_AREA), (IMAGE_SIZE, IMAGE_SIZE),
                         interpolation=cv2.INTER_LINEAR)
    if "jpeg50" in kind:
        img = jpeg(img, 50)
    return img


class FaceDataset(Dataset):
    def __init__(self, rows, train=False, kind="clean"):
        self.rows, self.train, self.kind = rows, train, kind
        self.rng = None

    def __len__(self):
        return len(self.rows)

    def _read(self, r, field):
        with open(r["path"], "rb") as f:
            f.seek(r[field])
            return f.read(r[field + "_len"])

    def __getitem__(self, i):
        r = self.rows[i]
        if self.rng is None:
            info = torch.utils.data.get_worker_info()
            self.rng = np.random.default_rng([SEED, int(time.time()) % 100_000, info.id if info else 0])
        img = cv2.imdecode(np.frombuffer(self._read(r, "off"), np.uint8), cv2.IMREAD_COLOR)   # BGR for the JPEG/WebP steps
        kind = r["mask_kind"]
        if kind == "file":
            mask = cv2.imdecode(np.frombuffer(self._read(r, "moff"), np.uint8), cv2.IMREAD_GRAYSCALE).astype(np.float32) / 255.0
        else:
            mask = np.full((MASK_SIZE, MASK_SIZE), 1.0 if kind == "ones" else 0.0, np.float32)
        if self.train:
            img, mask = train_augment(img, mask, self.rng, r["label"])
        elif self.kind != "clean":
            img = perturb(img, self.kind)
        x = torch.from_numpy(cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0).permute(2, 0, 1)
        x = (x - MEAN3) / STD3
        return x, float(r["label"]), torch.from_numpy(mask.copy()), float(kind != "unknown"), float(kind == "file")


MEAN3, STD3 = torch.tensor(IMAGENET_MEAN).view(3, 1, 1), torch.tensor(IMAGENET_STD).view(3, 1, 1)


def eval_loader(rows, kind="clean"):
    return DataLoader(FaceDataset(rows, kind=kind), batch_size=BATCH_SIZE, num_workers=NUM_WORKERS, pin_memory=DEVICE == "cuda")


@torch.no_grad()
def collect(forward, rows, kind="clean"):
    # forward(x) -> (p-fake logits, mask logits or None). Also the pixel IoU on images that have a real mask.
    logits, inter, union = [], 0.0, 0.0
    for x, _y, mask, _valid, has_file in eval_loader(rows, kind):
        xd = x.to(DEVICE, non_blocking=True)
        with torch.autocast(DEVICE, dtype=AMP_DTYPE, enabled=AMP_DTYPE is not None):
            lg, mk = forward(xd)
        if not torch.isfinite(lg).all():     # float16 overflow (T4): redo this batch in full precision
            lg, mk = forward(xd)
        logits.append(lg.float().cpu())
        if mk is not None and has_file.sum() > 0:
            keep = has_file.bool()
            pred, gold = torch.sigmoid(mk.float().cpu()[keep, 0]) >= 0.5, mask[keep] >= 0.5
            inter += (pred & gold).sum().item(); union += (pred | gold).sum().item()
    return torch.cat(logits).numpy(), (inter / union if union else None)


def eer(labels, scores):
    fpr, tpr, _ = roc_curve(labels, scores)
    i = np.nanargmin(np.abs(fpr - (1 - tpr)))
    return float((fpr[i] + 1 - tpr[i]) / 2)


def summarize(rows, scores, threshold=0.0):
    # overall numbers + each fake source against all the real images of this set, + each source's error rate
    labels = np.array([r["label"] for r in rows])
    sources = np.array([r["source"] for r in rows])
    out = {"images": int(len(rows)), "real": int((labels == 0).sum()), "fake": int((labels == 1).sum())}
    if out["real"] == 0 or out["fake"] == 0:
        return out
    pred = scores >= threshold
    recall, specificity = float(pred[labels == 1].mean()), float((~pred[labels == 0]).mean())
    per_source_auc = {}
    for s in sorted(set(sources[labels == 1])):
        keep = (labels == 0) | (sources == s)
        per_source_auc[s] = round(float(roc_auc_score(labels[keep], scores[keep])), 4)
    out.update(auc=round(float(roc_auc_score(labels, scores)), 4), macro_auc=round(float(np.mean(list(per_source_auc.values()))), 4),
               balanced_acc=round((recall + specificity) / 2, 4), fake_recall=round(recall, 4), real_specificity=round(specificity, 4),
               ap=round(float(average_precision_score(labels, scores)), 4), eer=round(eer(labels, scores), 4),
               per_source_auc=per_source_auc,
               per_source_correct={s: round(float((pred[sources == s] == (labels[sources == s] == 1)).mean()), 4) for s in sorted(set(sources))})
    return out


def sample(rows, n, seed=SEED):
    rows = sorted(rows, key=lambda r: r["key"])
    return random.Random(seed).sample(rows, n) if len(rows) > n else rows


def new_model(pretrained, train=False):
    net = SyntheticFaceNet(BACKBONE, pretrained=pretrained, fpn_dim=FPN_DIM, drop_path_rate=DROP_PATH if train else 0.0)
    return net.to(DEVICE)


VAL_SUB = sample(by_split["val"], VAL_IMAGES)
print("validation images:", len(VAL_SUB))