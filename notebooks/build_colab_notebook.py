"""Generates train_synthetic_face_colab.ipynb. Run: python notebooks/build_colab_notebook.py

backend/face_crop.py and backend/model_def.py are embedded unchanged, so the model is
trained with exactly the preprocessing and architecture the backend serves.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).with_name("train_synthetic_face_colab.ipynb")
cells = []


def md(text):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(True)})


def code(text):
    cells.append({"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
                  "source": text.strip("\n").splitlines(True)})


def embed(filename):
    src = (ROOT / "backend" / filename).read_text(encoding="utf-8")
    if "'''" in src or src.endswith("\\"):
        raise ValueError(f"{filename} cannot be embedded in a raw triple-quoted string")
    return f"(WORK / {filename!r}).write_text(r'''{src}''', encoding=\"utf-8\")\n"


md("""
# Synthetic Face Detector: training notebook (v4)

Trains a detector that answers two questions about a face image:
1. **Is it real, or AI-generated / AI-altered?**
2. **Where was it altered?** A pixel-region map, trained on real alteration masks. It replaces Grad-CAM, which only
   shows what the classifier looked at.

**No downloads or uploads on your side.** Every dataset is read directly from the Hugging Face Hub.

**v4 targets v3's main weakness: false alarms on real photos from social media.** v3 learned that compression artifacts
mean "fake", because in its training data the fakes were saved with heavier compression than the real photos. v4:
* adds ~20k **real photos posted on Reddit** (OpenFake `supplement_reddit`, posted after the Reddit test set was collected);
* simulates social-media re-uploads (resizing + JPEG), **more often on real photos**, so compression stops predicting the label;
* starts from v3's best model and reuses the data already prepared in Drive, so it needs far fewer compute units.

## How to run
1. **Runtime → Change runtime type.** Pick **CPU** for the first run, because data preparation does not need a GPU and
   costs far fewer compute units. The notebook stops by itself and tells you when to switch to **GPU**.
2. **Runtime → Run all**, and allow Google Drive access.
3. After *any* interruption (tab closed, units ran out, runtime died): reconnect and **Run all** again.

Everything is saved in `MyDrive/SyntheticFace_v3/`. A run continues from the last saved point: at most ~10 minutes of
data preparation or ~30 minutes of training is ever repeated.

*Optional:* add a free `HF_TOKEN` under 🔑 **Secrets** for faster, less throttled downloads.

## Data
| Role | Dataset | What it adds |
|---|---|---|
| train | [OpenRL/DeepFakeFace](https://huggingface.co/datasets/OpenRL/DeepFakeFace) | IMDB-WIKI real photos, Stable Diffusion inpainting (gives alteration masks), InsightFace swaps, SD 1.5 |
| train | [bitmind/SyntheticFacesHighQuality-T2I](https://huggingface.co/datasets/bitmind/SyntheticFacesHighQuality-T2I) | Flux.1 pro/dev/schnell, SDXL, DALL-E 3 faces |
| train | [ComplexDataLab/OpenFake](https://huggingface.co/datasets/ComplexDataLab/OpenFake) `core/train` | Frontier generators; faces only are kept |
| train | [TheKernel01/140k-Real-and-Fake-Faces](https://huggingface.co/datasets/TheKernel01/140k-Real-and-Fake-Faces) | FFHQ real photos, StyleGAN (the kind of image the old model knew) |
| train | [bitmind/celeb-a-hq](https://huggingface.co/datasets/bitmind/celeb-a-hq) | High-quality real faces |
| train | [xingjunm/WildDeepfake](https://huggingface.co/datasets/xingjunm/WildDeepfake) `train` | Compressed real and swapped faces from internet video |
| train (v4) | OpenFake `supplement_reddit` | Real photos as posted on Reddit (Jul–Nov 2026); its fakes are not used, to keep the unseen-generator test clean |
| **gold test** | OpenFake `core/test` | **Generators never seen in training** |
| **gold test** | OpenFake `reddit` | **AI images and real photos as they circulate online** |
| **gold test** | WildDeepfake `test` | **Videos never seen in training** |

## Why this should beat the old model, and how we will know
The old model only saw CelebDF frames vs one StyleGAN source, and its "~95%" comes from that same mix.
Here: many generators, identical cropping and re-encoding for every source so the model cannot learn "which dataset is this",
heavy compression/blur augmentation, and **every earlier model (v2, v3) is scored on the same test images** at the end.
""")

code(r"""
# ======================= Configuration =======================
QUICK_RUN = False   # True = short end-to-end check on small slices (uses its own Drive folder)

BACKBONE, FPN_DIM = "convnext_tiny.fb_in22k_ft_in1k", 128

# images kept per source (DATA_SCALE scales them all; 1.0 needs about 7 GB of Drive)
DATA_SCALE = 1.0
CAPS = {
    "dff_ids": 28_000,          # DeepFakeFace identities: real + inpainted + swapped each (+ SD 1.5 for every third)
    "real_ffhq": 25_000, "fake_stylegan": 15_000,
    "real_celebahq": 15_000,
    "real_wild": 15_000, "fake_wild": 15_000,
    "real_openfake": 15_000, "fake_openfake": 30_000,
    "real_social": 20_000,      # v4: real photos from Reddit posts, the false-alarm fix
    "sfhq": {"FLUX1_SCHNELL": 9_000, "SDXL": 9_000, "FLUX1_DEV": 7_273, "FLUX1_PRO": 3_209, "DALLE3": 1_123},
    # gold tests (never trained on)
    "gold_ood_fake": 5_000, "gold_ood_real": 2_000,
    "gold_reddit_fake": 3_000, "gold_reddit_real": 3_000,
    "gold_wild_fake": 4_000, "gold_wild_real": 4_000,
}
OPENFAKE_TRAIN_SHARDS = 15      # about 5 GB each; more shards = more real faces, slower preparation
SOCIAL_SHARDS = 27              # supplement_reddit files to scan (all 27); images are downloaded only for real photos
WILD_TARS, WILD_FRAMES_PER_TAR = 80, 200
WAIT_FOR_ALL_DATA = True        # do not train on partial data
VAL_FRACTION, TEST_FRACTION = 0.05, 0.07

# training
BATCH_SIZE    = 64              # 128 on GPUs with >= 22 GB. Lower on CUDA out of memory
EPOCHS        = 10              # passes over the training images; early stopping may end sooner
LR_BACKBONE, LR_HEADS = 1e-4, 4e-4
WEIGHT_DECAY, WARMUP_FRAC, DROP_PATH = 0.05, 0.03, 0.1
LABEL_SMOOTHING  = 0.05
MASK_LOSS_WEIGHT = 0.5
SOURCE_ALPHA     = 0.5          # source sampling ∝ (images in source)^alpha: rare generators are not drowned out

# saving / time
SHARD_SIZE, FLUSH_MINUTES = 2_000, 10   # data savepoint every SHARD_SIZE images or FLUSH_MINUTES
EVAL_EVERY       = 1_500        # steps between validations (each may save a new best model)
SAVE_MINUTES     = 30           # minutes between full training checkpoints in Drive
EARLY_STOP_EVALS = 8            # stop after this many validations without improvement
MAX_TRAIN_HOURS  = 7.5          # training time per session, then test + export
MAX_SESSION_HOURS = 11.5        # whole-session cap: free Colab sessions end at about 12 h
VAL_IMAGES       = 5_000        # images per validation
DRIVE_FOLDER     = "SyntheticFace_v3"   # prepared data lives here, shared by every training run
RUN_NAME         = "v4"                 # this run's checkpoints and model go to DRIVE_FOLDER/runs/<RUN_NAME>/
INIT_FROM        = "v3"                 # start from that run's best model ("" = from ImageNet). "v3" = the first run, in DRIVE_FOLDER itself
FORCE_FINISH     = False        # True = stop training now: score and package the best model so far
DISCONNECT_WHEN_DONE = True     # release the GPU when finished (saves compute units)
SEED = 42

if INIT_FROM:   # fine-tuning a trained model: fewer passes, gentler steps
    EPOCHS, LR_BACKBONE, LR_HEADS = 4, 5e-5, 2e-4
if QUICK_RUN:
    DATA_SCALE, OPENFAKE_TRAIN_SHARDS, WILD_TARS, WILD_FRAMES_PER_TAR, SOCIAL_SHARDS = 0.03, 2, 8, 40, 1
    EPOCHS, EVAL_EVERY, SAVE_MINUTES, MAX_TRAIN_HOURS, VAL_IMAGES = 1, 200, 5, 0.3, 800
    DRIVE_FOLDER += "_quick"
import time as _t; SESSION_START = _t.time()
""")

code(r"""
import sys
IN_COLAB = "google.colab" in sys.modules
if IN_COLAB:
    from google.colab import drive
    drive.mount("/content/drive")
""")

code(r"""
# No -U: keep Colab's preinstalled packages where they already satisfy these (avoids a forced runtime restart)
!pip install -q "timm>=1.0" "huggingface_hub>=0.24" hf_xet pyarrow requests scikit-learn
""")

code(r"""
import concurrent.futures as cf
import copy, gc, hashlib, io, json, os, random, re, shutil, tarfile, threading, time, zipfile
from collections import Counter, defaultdict, deque
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

random.seed(SEED); np.random.seed(SEED); torch.manual_seed(SEED)
Image.MAX_IMAGE_PIXELS = None
cv2.setNumThreads(1)

if IN_COLAB:
    DRIVE_DIR, WORK = Path("/content/drive/MyDrive") / DRIVE_FOLDER, Path("/content/work")
else:   # Jupyter elsewhere: a local folder stands in for Drive
    DRIVE_DIR, WORK = Path(DRIVE_FOLDER).resolve(), Path("work").resolve()
RUN_DIR = DRIVE_DIR / "runs" / RUN_NAME
INIT_PTH = None
if INIT_FROM:
    INIT_PTH = (DRIVE_DIR if INIT_FROM == "v3" else DRIVE_DIR / "runs" / INIT_FROM) / "best_model.pth"
for d in (DRIVE_DIR / "data", RUN_DIR / "checkpoints", WORK / "dl", WORK / "shards"):
    d.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(WORK))

CPUS = os.cpu_count() or 2
THREADS = max(2, CPUS)
NUM_WORKERS = CPUS if IN_COLAB else 0

if torch.cuda.is_available():
    DEVICE = "cuda"
    gpu = torch.cuda.get_device_properties(0)
    AMP_DTYPE = torch.bfloat16 if torch.cuda.get_device_capability(0)[0] >= 8 else torch.float16
    if gpu.total_memory >= 22e9:
        BATCH_SIZE *= 2
    HW = f"{gpu.name} {gpu.total_memory / 1e9:.0f} GB"
else:
    DEVICE, AMP_DTYPE, HW = "cpu", None, "CPU"

# a run keeps the batch size it started with, even if a later session gets a different GPU
_choice = RUN_DIR / "model_choice.json"
if _choice.exists():
    BATCH_SIZE = json.loads(_choice.read_text())["batch_size"]


class StopHere(Exception):
    # stops "Run all" with a plain message instead of a stack trace
    def _render_traceback_(self):
        return ["", "=" * 70, str(self), "=" * 70]


def runlog(msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line, flush=True)
    with open(DRIVE_DIR / "run_log.txt", "a", encoding="utf-8") as f:
        f.write(line + "\n")


def atomic_copy(src, dest):
    dest = Path(dest)
    tmp = dest.with_name(dest.name + ".partial")
    shutil.copy2(src, tmp)
    os.replace(tmp, dest)


def atomic_json(path, obj):
    path = Path(path)
    tmp = path.with_name(path.name + ".partial")
    tmp.write_text(json.dumps(obj, indent=1), encoding="utf-8")
    os.replace(tmp, path)


def session_hours():
    return (time.time() - SESSION_START) / 3600


class DriveWriter:
    # copies to Drive in a background thread so training never waits; the newest job per key wins
    def __init__(self):
        self.jobs, self.lock, self.wake, self.busy = {}, threading.Lock(), threading.Event(), False
        threading.Thread(target=self._run, daemon=True).start()

    def submit(self, key, fn):
        with self.lock:
            self.jobs[key] = fn
        self.wake.set()

    def _run(self):
        while True:
            self.wake.wait(); self.wake.clear()
            while True:
                with self.lock:
                    if not self.jobs:
                        break
                    key = next(iter(self.jobs)); fn = self.jobs.pop(key); self.busy = True
                try:
                    fn()
                except Exception as e:
                    runlog(f"[drive copy FAILED] {key}: {type(e).__name__}: {e}")
                finally:
                    self.busy = False

    def wait(self, timeout=3600):
        t0 = time.time()
        while time.time() - t0 < timeout:
            with self.lock:
                if not self.jobs and not self.busy:
                    return True
            time.sleep(2)
        return False


drive_writer = DriveWriter()

_free = shutil.disk_usage(DRIVE_DIR).free / 1e9
runlog(f"session start | run {RUN_NAME} | {HW} | {CPUS} CPUs | quick run: {QUICK_RUN} | Drive: {DRIVE_DIR} ({_free:.1f} GB free)")
if INIT_PTH and not INIT_PTH.exists():
    print(f"⚠️ INIT_FROM={INIT_FROM!r}, but {INIT_PTH} does not exist: training starts from ImageNet with fine-tuning settings.")
if _free < 3:
    print("⚠️ Drive is nearly full. Old checkpoints go to Drive's Trash and still count: empty it if needed.")

_token = os.environ.get("HF_TOKEN")
if IN_COLAB and not _token:
    try:
        from google.colab import userSecrets
        _token = userSecrets.get("HF_TOKEN")
    except Exception:
        _token = None
if _token:
    os.environ["HF_TOKEN"] = _token
""")

md("""
## Shared code: face cropping and the model
These are `backend/face_crop.py` and `backend/model_def.py`, unchanged. To change them, edit the backend files and
rebuild this notebook with `notebooks/build_colab_notebook.py`.
""")

code("from huggingface_hub import HfApi, HfFileSystem, hf_hub_download, hf_hub_url\n\n"
     "YUNET_SHA256 = \"8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4\"\n"
     "_yunet = Path(hf_hub_download(\"opencv/face_detection_yunet\", \"face_detection_yunet_2023mar.onnx\", local_dir=WORK / \"dl\"))\n"
     "if hashlib.sha256(_yunet.read_bytes()).hexdigest() != YUNET_SHA256:\n"
     "    raise RuntimeError(\"Unexpected face detector file: its checksum does not match the one the backend uses.\")\n"
     "os.environ[\"YUNET_PATH\"] = str(_yunet)\n\n"
     + embed("face_crop.py") + embed("model_def.py") +
     "\nfrom face_crop import CROP_SIZE, crop_square, detect_largest_face\n"
     "from model_def import SyntheticFaceNet\n"
     "IMAGE_SIZE, MASK_SIZE = CROP_SIZE, CROP_SIZE // 4\n"
     "IMAGENET_MEAN, IMAGENET_STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]\n")

md("""
## Stage 1: prepare the data (savepoints in Drive)
Every source goes through the same steps, so the model cannot tell datasets apart by format:
find the largest face → square crop → 256×256 → JPEG quality 95. Crops are stored in `data/<source>/part-*.tar`; after
each shard, `progress.json` records exactly where to continue.

Two details matter a lot here:
* **DeepFakeFace fakes are all squashed to 512×512, its real photos are not.** A model could score well by spotting squashed
  faces, so the real photos are squashed the same way before cropping.
* **Each identity stays in one split** across real and fake versions, so test images were never seen in another form.

Alteration masks: inpainting = difference to its real original; swap = face ellipse; fully generated = the whole crop; real = nothing.
""")

code(r"""
def split_of(group):
    v = int(hashlib.md5(str(group).encode()).hexdigest(), 16) % 10_000 / 10_000
    return "val" if v < VAL_FRACTION else "test" if v < VAL_FRACTION + TEST_FRACTION else "train"


def scaled(n):
    return max(4, int(n * DATA_SCALE))


def decode_rgb(data):
    im = Image.open(io.BytesIO(data))
    im.draft("RGB", (1600, 1600))   # large JPEGs decode much faster at reduced size
    return np.asarray(im.convert("RGB"))


def encode_jpg(rgb):
    return cv2.imencode(".jpg", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 95])[1].tobytes()


def make_record(crop, key, label, source, generator, group, split, mask_kind, mask=None):
    # mask_kind: zeros (real) | ones (fully generated) | unknown (not used for the mask loss) | file (mask image stored)
    return {"key": key, "label": label, "source": source, "generator": generator, "group": str(group), "split": split,
            "mask_kind": mask_kind, "jpg": encode_jpg(crop),
            "png": None if mask is None else cv2.imencode(".png", mask)[1].tobytes()}


def face_record(data, key, label, source, generator, group, split, mask_kind, require_face=True):
    try:
        image = decode_rgb(data)
        box = detect_largest_face(image)
        if box is None and require_face:
            return []
        return [make_record(crop_square(image, box), key, label, source, generator, group, split, mask_kind)]
    except Exception:
        return []   # a corrupt image is skipped, it does not stop the run


class ShardWriter:
    def __init__(self, name):
        self.name, self.dir, self.buf = name, DRIVE_DIR / "data" / name, []
        self.dir.mkdir(exist_ok=True)
        self.progress_file = self.dir / "progress.json"
        self.state = (json.loads(self.progress_file.read_text()) if self.progress_file.exists()
                      else {"cursor": None, "counts": {}, "shards": 0, "images": 0, "done": False})
        self.last_flush = time.time()

    def flush(self, cursor, counts, done=False):
        # order matters: the shard reaches Drive before progress.json points past it
        if self.buf:
            number = self.state["shards"]
            tmp = WORK / f"{self.name}-{number:05d}.tar"
            rows = []
            with tarfile.open(tmp, "w") as tar:
                for r in self.buf:
                    for ext in ("jpg", "png"):
                        if r[ext] is not None:
                            info = tarfile.TarInfo(f"{r['key']}.{ext}")
                            info.size = len(r[ext])
                            tar.addfile(info, io.BytesIO(r[ext]))
            with tarfile.open(tmp, "r") as tar:   # byte positions, for fast random reads during training
                where = {m.name: (m.offset_data, m.size) for m in tar.getmembers()}
            for r in self.buf:
                row = {k: r[k] for k in ("key", "label", "source", "generator", "group", "split", "mask_kind")}
                row["off"], row["off_len"] = where[f"{r['key']}.jpg"]
                if r["png"] is not None:
                    row["moff"], row["moff_len"] = where[f"{r['key']}.png"]
                rows.append(row)
            atomic_copy(tmp, self.dir / f"part-{number:05d}.tar")
            atomic_json(self.dir / f"part-{number:05d}.idx.json", rows)
            tmp.unlink()
            self.state["shards"] += 1
            self.state["images"] += len(rows)
            self.buf = []
        self.state.update(cursor=cursor, counts=dict(counts), done=done)
        atomic_json(self.progress_file, self.state)
        self.last_flush = time.time()


def _run_once(name, tasks, process, caps):
    # tasks(cursor) yields (cursor after this item, bucket, payload). Results are taken in order, so a saved
    # cursor means: everything before it is safely in Drive. Returns True when the source is complete.
    writer = ShardWriter(name)
    if writer.state["done"]:
        return True
    counts, inflight, pending = Counter(writer.state["counts"]), Counter(), deque()
    cursor = writer.state["cursor"]

    def take_one():
        nonlocal cursor
        cur, bucket, future = pending.popleft()
        inflight[bucket] -= 1
        records = future.result()
        if records:
            counts[bucket] += 1
            writer.buf.extend(records)
        cursor = cur
        if len(writer.buf) >= SHARD_SIZE or (writer.buf and time.time() - writer.last_flush > FLUSH_MINUTES * 60):
            writer.flush(cursor, counts)
            print(f"  {name}: {writer.state['images']} images saved  {dict(counts)}", flush=True)

    with cf.ThreadPoolExecutor(THREADS) as pool:
        for cur, bucket, payload in tasks(cursor):
            if all(counts[b] >= c for b, c in caps.items()):
                break
            if counts[bucket] + inflight[bucket] >= caps.get(bucket, 0):
                continue
            pending.append((cur, bucket, pool.submit(process, payload)))
            inflight[bucket] += 1
            while len(pending) >= THREADS * 8:
                take_one()
            if session_hours() >= MAX_SESSION_HOURS:
                break
        while pending:
            take_one()
    complete = session_hours() < MAX_SESSION_HOURS
    writer.flush(cursor, counts, done=complete)
    runlog(f"source {name}: {'complete' if complete else 'paused'}, {writer.state['images']} images, {dict(counts)}")
    return complete


def run_source(name, tasks, process, caps, attempts=6):
    # network errors happen on long downloads: go back to the last savepoint and continue
    for attempt in range(attempts):
        try:
            return _run_once(name, tasks, process, caps)
        except Exception as e:
            runlog(f"source {name}: {type(e).__name__}: {e} (attempt {attempt + 1}/{attempts}, continuing from the last savepoint)")
            time.sleep(min(600, 30 * 2 ** attempt))
    raise StopHere(f"{name} keeps failing, see run_log.txt. Its progress is saved. Run all again later.")
""")

code(r"""
# ---- Hub readers ----
def repo_files(repo, prefix=""):
    return sorted(f for f in HfApi().list_repo_files(repo, repo_type="dataset") if f.startswith(prefix))


def iter_parquet(repo, files, columns, cursor, whole_files=False):
    # yields (cursor after this row, row), one row group at a time. Huge datasets are read over HTTP range requests,
    # taking only what is needed. whole_files=True downloads each file first: much faster when row groups are large.
    import pyarrow.parquet as pq
    fs = HfFileSystem()
    f0, g0, r0 = (cursor["f"], cursor["g"], cursor["r"]) if cursor else (0, 0, 0)
    for fi in range(f0, len(files)):
        local = download(repo, files[fi]) if whole_files else None
        with (open(local, "rb") if whole_files else fs.open(f"datasets/{repo}/{files[fi]}", "rb", block_size=8 << 20)) as fh:
            pf = pq.ParquetFile(fh)
            for gi in range(g0 if fi == f0 else 0, pf.metadata.num_row_groups):
                rows = pf.read_row_group(gi, columns=columns).to_pylist()
                start = r0 if fi == f0 and gi == g0 else 0
                for ri in range(start, len(rows)):
                    yield {"f": fi, "g": gi, "r": ri + 1}, rows[ri]
                del rows
        if whole_files:
            local.unlink(missing_ok=True)


def download(repo, filename):
    return Path(hf_hub_download(repo, filename, repo_type="dataset", local_dir=WORK / "dl"))


_zips = threading.local()


def zip_read(path, member):
    # a ZipFile cannot be read from several threads at once: one handle per thread
    cache = _zips.__dict__.setdefault("open", {})
    if path not in cache:
        cache[path] = zipfile.ZipFile(path)
    return cache[path].read(member)


# ---- DeepFakeFace ----
DFF_REPO = "OpenRL/DeepFakeFace"


def diff_mask(real_crop, fake_crop):
    # alteration region of an inpainted image: smoothed difference, closed into one solid region
    diff = cv2.GaussianBlur(cv2.absdiff(real_crop, fake_crop).max(axis=2), (0, 0), 3)
    if diff.max() < 25:
        return None
    _, m = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
    contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    keep = [c for c in contours if cv2.contourArea(c) > 0.02 * m.size]
    if not keep:
        return None
    filled = np.zeros_like(m)
    cv2.fillPoly(filled, [cv2.convexHull(np.vstack(keep))], 255)
    # most of the frame changed: the original and the fake are not really aligned, so the mask means nothing
    return None if not 0.02 <= (filled > 0).mean() <= 0.7 else cv2.resize(filled, (MASK_SIZE, MASK_SIZE), interpolation=cv2.INTER_AREA)


def ellipse_mask(box):
    # a face swap replaces the inner face: an ellipse inside the box, in crop coordinates
    _, _, w, h = box
    scale = MASK_SIZE / (max(w, h) * 1.6)
    m = np.zeros((MASK_SIZE, MASK_SIZE), np.uint8)
    cv2.ellipse(m, (MASK_SIZE // 2, MASK_SIZE // 2), (round(w * 0.5 * scale), round(h * 0.6 * scale)), 0, 0, 360, 255, -1)
    return m


def dff_process(payload):
    rel, zips, keep_sd15 = payload
    person = re.split(r"[_.]", rel.rsplit("/", 1)[-1])[0]
    split, out = split_of("dff" + person), []
    try:
        # the same 512x512 squash the fakes went through (see the note above)
        wiki = cv2.resize(decode_rgb(zip_read(zips["wiki"], f"wiki/{rel}")), (512, 512), interpolation=cv2.INTER_CUBIC)
        box = detect_largest_face(wiki)
        if box is not None:
            real_crop = crop_square(wiki, box)
            out.append(make_record(real_crop, f"wiki-{person}", 0, "real_wiki", "real", person, split, "zeros"))
            fake = decode_rgb(zip_read(zips["inpainting"], f"inpainting/{rel}"))
            if fake.shape == wiki.shape:
                fake_crop = crop_square(fake, box)
                mask = diff_mask(real_crop, fake_crop)
                out.append(make_record(fake_crop, f"inp-{person}", 1, "fake_inpaint", "sd_inpaint", person, split,
                                       "unknown" if mask is None else "file", mask))
        swap = decode_rgb(zip_read(zips["insight"], f"insight/{rel}"))
        box = detect_largest_face(swap)
        if box is not None:
            out.append(make_record(crop_square(swap, box), f"swap-{person}", 1, "fake_swap", "insightface", person, split,
                                   "file", ellipse_mask(box)))
        if keep_sd15:
            out += face_record(zip_read(zips["text2img"], f"text2img/{rel}"), f"sd15-{person}", 1, "fake_sd15", "sd1.5",
                               person, split, "ones")
    except Exception:
        pass
    return out


def dff_tasks(cursor):
    zips = {z: download(DFF_REPO, f"{z}.zip") for z in ("wiki", "inpainting", "insight", "text2img")}
    with zipfile.ZipFile(zips["wiki"]) as z:
        names = sorted(n.split("/", 1)[1] for n in z.namelist() if n.endswith(".jpg"))
    random.Random(SEED).shuffle(names)
    for i in range(cursor or 0, len(names)):
        yield i + 1, "dff", (names[i], zips, i % 3 == 0)


# ---- 140k (FFHQ + StyleGAN) and CelebA-HQ ----
def k140_tasks(cursor):
    repo = "TheKernel01/140k-Real-and-Fake-Faces"
    files = repo_files(repo, "data/")
    random.Random(SEED).shuffle(files)
    for cur, row in iter_parquet(repo, files, ["image", "label"], cursor, whole_files=True):
        bucket = "fake_stylegan" if row["label"] == 1 else "real_ffhq"
        yield cur, bucket, (row["image"]["bytes"], bucket, f"{cur['f']}-{cur['g']}-{cur['r']}")


def k140_process(payload):
    data, bucket, key = payload
    label = int(bucket.startswith("fake"))
    return face_record(data, f"{bucket}-{key}", label, bucket, "stylegan" if label else "real", key, split_of(bucket[5:] + key),
                       "ones" if label else "zeros", require_face=False)


def celeba_tasks(cursor):
    repo = "bitmind/celeb-a-hq"
    files = [f for f in repo_files(repo, "data/") if f.endswith(".parquet")]
    for cur, row in iter_parquet(repo, files, ["image"], cursor, whole_files=True):
        yield cur, "real_celebahq", (row["image"]["bytes"], f"{cur['f']}-{cur['g']}-{cur['r']}")


def celeba_process(payload):
    data, key = payload
    return face_record(data, f"celeba-{key}", 0, "real_celebahq", "real", key, split_of("celeba" + key), "zeros", require_face=False)


# ---- SFHQ text-to-image: Flux, SDXL, DALL-E 3 ----
SFHQ_REPO = "bitmind/SyntheticFacesHighQuality-T2I"
SFHQ_ZIP = "tiny-sample.zip" if QUICK_RUN else "SyntheticFacesHighQuality.zip"


def sfhq_generator(name):
    return re.match(r"(.+?)_image_", name.rsplit("/", 1)[-1]).group(1)


def sfhq_tasks(cursor):
    path = download(SFHQ_REPO, SFHQ_ZIP)
    with zipfile.ZipFile(path) as z:
        names = sorted(n for n in z.namelist() if n.lower().endswith((".jpg", ".jpeg", ".png")) and "_image_" in n)
    random.Random(SEED).shuffle(names)
    for i in range(cursor or 0, len(names)):
        yield i + 1, sfhq_generator(names[i]), (path, names[i])


def sfhq_process(payload):
    path, name = payload
    gen, stem = sfhq_generator(name), Path(name).stem
    return face_record(zip_read(path, name), f"sfhq-{stem}", 1, "fake_sfhq", gen, stem, split_of("sfhq" + stem), "ones")


# ---- WildDeepfake: one tar per video source ----
def wild_tasks(kind, split_name):
    def tasks(cursor):
        import requests
        repo, prefix = "xingjunm/WildDeepfake", f"deepfake_in_the_wild/{kind}_{split_name}/"
        tars = repo_files(repo, prefix)
        random.Random(SEED).shuffle(tars)
        t0, n0 = (cursor["t"], cursor["n"]) if cursor else (0, 0)
        headers = {"Authorization": f"Bearer {os.environ['HF_TOKEN']}"} if os.environ.get("HF_TOKEN") else {}
        for ti in range(t0, min(len(tars), WILD_TARS)):
            with requests.get(hf_hub_url(repo, tars[ti], repo_type="dataset"), stream=True, timeout=120, headers=headers) as resp:
                resp.raise_for_status()
                resp.raw.decode_content = True
                with tarfile.open(fileobj=resp.raw, mode="r|*") as tar:   # named .tar.gz, but most are plain .tar
                    seen = 0
                    for member in tar:
                        if not member.isfile() or not member.name.endswith(".png"):
                            continue
                        seen += 1
                        if seen > WILD_FRAMES_PER_TAR * 4:   # every 4th frame: neighbouring frames are near-duplicates
                            break
                        if seen % 4 == 0 and not (ti == t0 and seen <= n0):
                            data = tar.extractfile(member).read()
                            yield {"t": ti, "n": seen}, f"{kind}", (data, kind, split_name, Path(tars[ti]).name.split(".")[0], seen)
    return tasks


def wild_process(payload):
    data, kind, split_name, tar_id, seen = payload
    label, group = int(kind == "fake"), f"wild-{kind}-{tar_id}"
    source = f"{'gold_wild' if split_name == 'test' else 'wild'}_{kind}"
    return face_record(data, f"{source}-{tar_id}-{seen}", label, source, "wilddeepfake" if label else "real", group,
                       "gold" if split_name == "test" else split_of(group), "unknown" if label else "zeros", require_face=False)


# ---- OpenFake: faces only ----
OPENFAKE = "ComplexDataLab/OpenFake"


def openfake_tasks(prefix, max_files, real_bucket, fake_bucket):
    def tasks(cursor):
        files = [f for f in repo_files(OPENFAKE, prefix) if f.endswith(".parquet")]
        random.Random(SEED).shuffle(files)
        for cur, row in iter_parquet(OPENFAKE, files[:max_files], ["image", "label", "model", "row_id"], cursor):
            bucket = fake_bucket if row["label"] == "fake" else real_bucket
            yield cur, bucket, (row["image"]["bytes"], bucket, row["model"], row["row_id"])
    return tasks


def social_tasks(cursor):
    # supplement_reddit: only real photos are used (its fakes may come from generators held out in core/test).
    # The files are grouped by label and ~71% of rows are fake, so labels are read first and images are
    # downloaded only for row groups that contain wanted rows.
    import pyarrow.parquet as pq
    files = sorted(f for f in repo_files(OPENFAKE, "supplement/reddit/") if f.endswith(".parquet"))[:SOCIAL_SHARDS]
    fs = HfFileSystem()
    f0, g0, r0 = (cursor["f"], cursor["g"], cursor["r"]) if cursor else (0, 0, 0)
    for fi in range(f0, len(files)):
        with fs.open(f"datasets/{OPENFAKE}/{files[fi]}", "rb", block_size=4 << 20) as fh:
            pf = pq.ParquetFile(fh)
            for gi in range(g0 if fi == f0 else 0, pf.metadata.num_row_groups):
                rows = pf.read_row_group(gi, columns=["label", "row_id", "nsfw_score"]).to_pylist()
                start = r0 if fi == f0 and gi == g0 else 0
                wanted = {ri for ri in range(start, len(rows))
                          if rows[ri]["label"] == "real" and (rows[ri]["nsfw_score"] or 0.0) < 0.3}
                images = pf.read_row_group(gi, columns=["image"]).column(0) if wanted else None
                for ri in range(start, len(rows)):
                    cur = {"f": fi, "g": gi, "r": ri + 1}
                    if ri in wanted:
                        yield cur, "real_social", (images[ri].as_py()["bytes"], "real_social", "reddit", rows[ri]["row_id"])
                    else:
                        yield cur, "skip", None


def openfake_process(payload):
    data, bucket, model, row_id = payload
    gold = bucket.startswith("gold")
    label = int("fake" in bucket)
    source = bucket if gold or bucket == "real_social" else ("fake_openfake" if label else "real_openfake")
    return face_record(data, f"{source}-{row_id}", label, source, model if label else f"real_{model}", row_id,
                       "gold" if gold else split_of("of" + row_id), "ones" if label else "zeros")
""")

code(r"""
c = CAPS
SOURCES = [   # name, task reader, processor, caps per bucket
    ("dff", dff_tasks, dff_process, {"dff": scaled(c["dff_ids"])}),
    ("k140", k140_tasks, k140_process, {"real_ffhq": scaled(c["real_ffhq"]), "fake_stylegan": scaled(c["fake_stylegan"])}),
    ("celebahq", celeba_tasks, celeba_process, {"real_celebahq": scaled(c["real_celebahq"])}),
    ("sfhq", sfhq_tasks, sfhq_process, {g: scaled(n) for g, n in c["sfhq"].items()}),
    ("wild_train_real", wild_tasks("real", "train"), wild_process, {"real": scaled(c["real_wild"])}),
    ("wild_train_fake", wild_tasks("fake", "train"), wild_process, {"fake": scaled(c["fake_wild"])}),
    ("openfake_train", openfake_tasks("core/train-", OPENFAKE_TRAIN_SHARDS, "real_openfake", "fake_openfake"), openfake_process,
     {"real_openfake": scaled(c["real_openfake"]), "fake_openfake": scaled(c["fake_openfake"])}),
    ("social_real", social_tasks, openfake_process, {"real_social": scaled(c["real_social"])}),
    ("gold_wild_real", wild_tasks("real", "test"), wild_process, {"real": scaled(c["gold_wild_real"])}),
    ("gold_wild_fake", wild_tasks("fake", "test"), wild_process, {"fake": scaled(c["gold_wild_fake"])}),
    ("gold_ood", openfake_tasks("core/test-", 2 if QUICK_RUN else 13, "gold_ood_real", "gold_ood_fake"), openfake_process,
     {"gold_ood_real": scaled(c["gold_ood_real"]), "gold_ood_fake": scaled(c["gold_ood_fake"])}),
    ("gold_reddit", openfake_tasks("reddit/test-", 1 if QUICK_RUN else 5, "gold_reddit_real", "gold_reddit_fake"), openfake_process,
     {"gold_reddit_real": scaled(c["gold_reddit_real"]), "gold_reddit_fake": scaled(c["gold_reddit_fake"])}),
]

all_complete = True
for name, tasks, process, caps in SOURCES:
    if session_hours() >= MAX_SESSION_HOURS:
        all_complete = False
        break
    print(f"--- {name}", flush=True)
    all_complete = run_source(name, tasks, process, caps) and all_complete
    if name in ("dff", "sfhq"):   # the archives are large and no longer needed
        for f in (WORK / "dl").glob("*.zip"):
            f.unlink(missing_ok=True)
        _zips.__dict__.clear()

if not all_complete and WAIT_FOR_ALL_DATA:
    raise StopHere("Not all data is prepared yet. Everything so far is saved in Drive: Run all again to continue.")
if DEVICE == "cpu" and IN_COLAB and not FORCE_FINISH:
    raise StopHere("✅ Data is ready and saved in Drive.\n"
                   "Now: Runtime → Change runtime type → GPU (T4 is enough), then Runtime → Run all.")
print("✅ data ready")
""")

md("""
## Stage 2: load the prepared data
Shards are copied from Drive to the fast local disk once per session. The table shows what the model will train on.
""")

code(r"""
ROWS, _bad = [], 0
for src_dir in sorted(p for p in (DRIVE_DIR / "data").iterdir() if p.is_dir()):
    progress = src_dir / "progress.json"
    if not progress.exists():
        continue
    for number in range(json.loads(progress.read_text())["shards"]):
        tar, idx = src_dir / f"part-{number:05d}.tar", src_dir / f"part-{number:05d}.idx.json"
        local = WORK / "shards" / f"{src_dir.name}-{number:05d}.tar"
        if not local.exists() or local.stat().st_size != tar.stat().st_size:
            shutil.copy(tar, local)
        for row in json.loads(idx.read_text()):
            row["path"] = str(local)
            ROWS.append(row)

table = Counter((r["source"], r["split"]) for r in ROWS)
print(f"{'source':18s}{'train':>9s}{'val':>8s}{'test':>8s}{'gold':>8s}")
for s in sorted({r["source"] for r in ROWS}):
    print(f"{s:18s}" + "".join(f"{table[(s, sp)]:{w}d}" for sp, w in (("train", 9), ("val", 8), ("test", 8), ("gold", 8))))
print("total", len(ROWS), "| training masks:", dict(Counter(r["mask_kind"] for r in ROWS if r["split"] == "train")))

by_split = defaultdict(list)
for r in ROWS:
    by_split[r["split"]].append(r)
if not by_split["train"]:
    raise StopHere("No training images found. Run the data stage first.")
""")

md("""
## Stage 3: augmentation, model, evaluation
The same degradations are applied to real and fake images alike (blur, resizing, noise, JPEG and WebP compression), so
the model must rely on signs that survive being re-uploaded, not on pristine pixels.
""")

code(r"""
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
""")

md("""
## Stage 4: train
Continues automatically from `checkpoints/last.pt` (model, optimizer, schedule, step). The batch for each step is computed from
the step number, so a resumed run continues the same sequence. A checkpoint is written every `SAVE_MINUTES` in the background,
when you press Stop, and when the time budget ends. Each new best model goes straight to `runs/<RUN_NAME>/best_model.pth`.
With `INIT_FROM` set, a new run starts from that earlier model instead of from ImageNet.

Model selection uses clean and degraded validation images, averaged per generator, so a model that only works on
pristine images is not picked.
""")

code(r"""
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
""")

md("""
## Stage 5: final scores, for this model and every earlier one
Uses the best model chosen on validation. It is scored once on images it never trained on. **v2 (EfficientNet-B0) and the
model this run started from are scored on the same images**, so the comparison is fair. The gold sets are the numbers to quote.
""")

code(r"""
drive_writer.wait()
model = new_model(pretrained=False)
model.load_state_dict(torch.load(BEST_PTH, map_location="cpu", weights_only=True))
model.eval()
fwd_v3 = lambda x: model(x)

# calibration: makes "90% confident" mean what it says. Fitted on validation only, weighting real and fake equally.
_val = sample(by_split["val"], 20_000)
_cal = np.concatenate([collect(fwd_v3, _val, k)[0] for k in ("clean", "jpeg50")])
_lab = np.array([r["label"] for r in _val] * 2, dtype=np.float32)
_x, _y = torch.tensor(_cal), torch.tensor(_lab)
_w = torch.where(_y == 1, 0.5 / _y.mean(), 0.5 / (1 - _y.mean()))
_t, _b = torch.tensor(1.0, requires_grad=True), torch.tensor(0.0, requires_grad=True)
_opt = torch.optim.LBFGS([_t, _b], max_iter=100)


def _closure():
    _opt.zero_grad()
    loss = F.binary_cross_entropy_with_logits((_x - _b) / _t.clamp(min=0.05), _y, weight=_w)
    loss.backward()
    return loss


_opt.step(_closure)
TEMPERATURE, BIAS = max(0.05, _t.item()), _b.item()
print(f"calibration: temperature {TEMPERATURE:.3f}, bias {BIAS:.3f}")

# the old model, as deployed: EfficientNet-B0 at 224x224
from torchvision import models as _tvm
# pinned to the Space commit that still had the old model
_old_path = hf_hub_download("Haaardikkkk/syntheticFace-Detector", "best_model_v2.pth", repo_type="space",
                            revision="04b631910ce866497cf8e9a04802c2e950058a8a", local_dir=WORK / "dl")
old = _tvm.efficientnet_b0(weights=None)
old.classifier[1] = torch.nn.Linear(old.classifier[1].in_features, 2)
old.load_state_dict(torch.load(_old_path, map_location="cpu", weights_only=True))
old = old.to(DEVICE).eval()


def fwd_v2(x):
    out = old(F.interpolate(x, size=(224, 224), mode="bilinear", antialias=True, align_corners=False))
    return out[:, 0] - out[:, 1], None     # class 0 = FAKE: same "above 0 = fake" meaning


gold = by_split["gold"]
_real = lambda *srcs: [r for r in gold if r["source"] in srcs]
_pool_real = _real("gold_ood_real", "gold_reddit_real", "gold_wild_real")
TEST_SETS = {
    "held-out test (same generators as training)": by_split["test"],
    "GOLD unseen generators (OpenFake core/test)": _real("gold_ood_fake") + _pool_real,    # its own real photos are rarely faces
    "GOLD in the wild (OpenFake Reddit)": _real("gold_reddit_fake", "gold_reddit_real"),
    "GOLD unseen videos (WildDeepfake test)": _real("gold_wild_fake", "gold_wild_real"),
}
# every earlier model, each with the threshold it is served with
BASELINES = {"v2": (fwd_v2, 0.0)}
if INIT_PTH is not None and INIT_PTH.exists():
    prev = new_model(pretrained=False)
    prev.load_state_dict(torch.load(INIT_PTH, map_location="cpu", weights_only=True))
    prev.eval()
    _prev_zip = INIT_PTH.parent / f"synthface_{INIT_FROM}.zip"
    _prev_bias = json.loads(zipfile.ZipFile(_prev_zip).read("model_meta.json"))["calibration"]["bias"] if _prev_zip.exists() else 0.0
    BASELINES[INIT_FROM] = (lambda x: prev(x), _prev_bias)

results = {}
for name, rows in TEST_SETS.items():
    if not rows:
        continue
    rows = sample(rows, 40_000)
    new_scores, iou = collect(fwd_v3, rows)
    entry = {"new": summarize(rows, new_scores, BIAS)}
    for v, (fwd, threshold) in BASELINES.items():
        entry[v] = summarize(rows, collect(fwd, rows)[0], threshold)
    if iou is not None:
        entry["new"]["mask_iou"] = round(iou, 4)
    for kind in ("jpeg50", "half", "jpeg50+half"):
        entry["new"][f"auc_{kind}"] = summarize(rows, collect(fwd_v3, rows, kind)[0], BIAS).get("auc")
        for v, (fwd, threshold) in BASELINES.items():
            entry[v][f"auc_{kind}"] = summarize(rows, collect(fwd, rows, kind)[0], threshold).get("auc")
    results[name] = entry

_keys = ("auc", "balanced_acc", "fake_recall", "real_specificity", "eer", "auc_jpeg50", "auc_half", "auc_jpeg50+half")
_cols = list(BASELINES) + ["new"]
for name, e in results.items():
    print(f"\n=== {name}   ({e['new']['real']} real, {e['new']['fake']} fake)")
    print(f"{'':20s}" + "".join(f"{(RUN_NAME + ' (new)' if c == 'new' else c):>12s}" for c in _cols))
    for k in _keys:
        print(f"{k:20s}" + "".join(f"{e[c].get(k, float('nan')):12.3f}" for c in _cols))
    if "mask_iou" in e["new"]:
        print(f"{'mask_iou':20s}{'':>{12 * (len(_cols) - 1)}s}{e['new']['mask_iou']:12.3f}")
    for c in _cols:
        print(f"  {c} per source (AUC):", e[c].get("per_source_auc"))
atomic_json(RUN_DIR / "metrics.json", results)
""")

code(r"""
# Package for the backend: half-precision weights, about 60 MB
MODEL_DIR = WORK / "model"
shutil.rmtree(MODEL_DIR, ignore_errors=True); MODEL_DIR.mkdir()
WEIGHTS_NAME = f"synthface_{RUN_NAME}.pth"
torch.save({k: v.half().cpu() if v.is_floating_point() else v.cpu() for k, v in model.state_dict().items()}, MODEL_DIR / WEIGHTS_NAME)
_pick = lambda e: {m: e.get(m) for m in ("auc", "balanced_acc", "fake_recall", "real_specificity", "eer")}
_gold = {k: _pick(v["new"]) for k, v in results.items()}
meta = {"version": RUN_NAME, "name": f"ConvNeXt-Tiny {RUN_NAME}", "architecture": "synthface", "weights": WEIGHTS_NAME,
        "default": True, "heatmap": "alteration", "uncertain_band": [0.35, 0.75],
        "description": f"ConvNeXt-Tiny with an alteration-map decoder, {len(train_rows):,} face crops"
                       + (f", fine-tuned from {INIT_FROM}" if INIT_PTH is not None and INIT_PTH.exists() else "") + ".",
        "backbone": BACKBONE, "fpn_dim": FPN_DIM, "input_size": IMAGE_SIZE, "mean": IMAGENET_MEAN, "std": IMAGENET_STD,
        "calibration": {"temperature": TEMPERATURE, "bias": BIAS}, "metrics": _gold,
        # the earlier models on the same test images: the backend shows these in its comparison table
        "baseline_metrics": {v: {k: _pick(e[v]) for k, e in results.items()} for v in BASELINES},
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "training_images": len(train_rows)}
(MODEL_DIR / "model_meta.json").write_text(json.dumps(meta, indent=2))
ZIP = WORK / f"synthface_{RUN_NAME}.zip"
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_STORED) as z:
    for f in sorted(MODEL_DIR.iterdir()):
        z.write(f, arcname=f.name)
atomic_copy(ZIP, RUN_DIR / ZIP.name)
runlog("DONE. Model: " + str(RUN_DIR / ZIP.name) + " | " + json.dumps(_gold))
""")

md("""
## Look at it: predictions and alteration maps
Each row: the face, the model's map, and (where known) the true alteration region. Check that the maps sit on the
altered area, and that real faces stay clean.
""")

code(r"""
def _panel(row):
    with open(row["path"], "rb") as f:
        f.seek(row["off"]); data = f.read(row["off_len"])
    bgr = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    x = ((torch.from_numpy(rgb.astype(np.float32) / 255).permute(2, 0, 1) - MEAN3) / STD3)[None].to(DEVICE)
    with torch.no_grad():
        logit, mk = model(x)
    p = torch.sigmoid((logit.float().cpu() - BIAS) / TEMPERATURE).item()
    heat = cv2.resize(torch.sigmoid(mk.float())[0, 0].cpu().numpy(), (IMAGE_SIZE, IMAGE_SIZE))
    colour = cv2.cvtColor(cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    over = (rgb * (1 - 0.6 * heat[..., None]) + colour * 0.6 * heat[..., None]).astype(np.uint8)
    truth = np.zeros_like(rgb)
    if row["mask_kind"] == "file":
        with open(row["path"], "rb") as f:
            f.seek(row["moff"]); md_ = f.read(row["moff_len"])
        m = cv2.resize(cv2.imdecode(np.frombuffer(md_, np.uint8), cv2.IMREAD_GRAYSCALE), (IMAGE_SIZE, IMAGE_SIZE))
        truth = np.dstack([m] * 3)
    panel = np.hstack([rgb, over, truth])
    cv2.putText(panel, f"{row['source']} p(fake)={p:.2f}", (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1, cv2.LINE_AA)
    return panel


_rng = random.Random(SEED)
_sheet = []
for s in ("fake_inpaint", "fake_swap", "fake_sfhq", "fake_openfake", "real_wiki", "real_social", "real_ffhq"):
    pool = [r for r in by_split["test"] if r["source"] == s]
    _sheet += [_panel(r) for r in _rng.sample(pool, min(2, len(pool)))]
if _sheet:
    _png = RUN_DIR / "sample_maps.png"
    Image.fromarray(np.vstack(_sheet)).save(_png)
    try:
        from IPython.display import Image as _Show, display
        display(_Show(str(_png), width=700))
    except ImportError:
        pass
""")

code(r"""
# Make sure Drive has every byte, then release the GPU (saves compute units)
drive_writer.wait()
print("Model:", RUN_DIR / f"synthface_{RUN_NAME}.zip")
print(f"Install: extract into the project's backend/models/{RUN_NAME}/ folder, then restart or redeploy the backend.")
if IN_COLAB:
    drive.flush_and_unmount()
    if DISCONNECT_WHEN_DONE and not QUICK_RUN:
        from google.colab import runtime
        runtime.unassign()
""")

nb = {"cells": cells, "nbformat": 4, "nbformat_minor": 5,
      "metadata": {"accelerator": "GPU", "colab": {"provenance": [], "gpuType": "T4", "name": OUT.name},
                   "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                   "language_info": {"name": "python"}}}
OUT.write_text(json.dumps(nb, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {OUT} ({len(cells)} cells)")
