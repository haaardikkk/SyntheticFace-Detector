import io
import logging
import os
from contextlib import asynccontextmanager
from typing import List, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError

import predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # same limit as the upload form
MAX_BATCH = 10
DEFAULT_ORIGINS = "https://synthetic-face-detector.vercel.app,http://localhost:3000,http://localhost:5173"
Image.MAX_IMAGE_PIXELS = 60_000_000  # refuse decompression bombs
load_error = None


@asynccontextmanager
async def lifespan(_app):
    # A bad model file must not crash the process: the Space would restart in a loop and only
    # show a generic error. Stay up, and let /health say what is wrong.
    global load_error
    try:
        predictor.load()
    except Exception as e:
        load_error = f"{type(e).__name__}: {e}"
        logger.exception("Models failed to load")
    yield


app = FastAPI(title="Synthetic Face Detector API", version="4.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[u.strip() for u in os.environ.get("FRONTEND_URL", DEFAULT_ORIGINS).split(",") if u.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "service": "synthetic-face-detector", "default_model": predictor.default_version(),
            "models": predictor.versions()}


@app.get("/health")
def health():
    if load_error:
        raise HTTPException(status_code=503, detail=load_error)
    return {"status": "healthy"}


@app.get("/models")
def models():
    _require_models()
    return {"default": predictor.default_version(), "models": predictor.model_list()}


def _require_models():
    if load_error:
        raise HTTPException(status_code=503, detail="The model is not available right now.")


def _check_version(model):
    if model and model not in predictor.versions():
        raise HTTPException(status_code=404, detail=f"Unknown model '{model}'. Available: {', '.join(predictor.versions())}")


async def _read(file):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail=f"{file.filename or 'File'} is not an image.")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"{file.filename or 'Image'} is larger than 10 MB.")
    return contents


def _decode(contents):
    # PIL, not OpenCV: phone photos store their rotation in EXIF, and a sideways face is both
    # harder to find and more likely to be misjudged
    try:
        with Image.open(io.BytesIO(contents)) as im:
            return np.asarray(ImageOps.exif_transpose(im).convert("RGB"))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=422, detail="Could not decode image.")


async def _run(fn, *args):
    try:
        return await run_in_threadpool(fn, *args)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")


@app.post("/predict")
async def predict(file: UploadFile = File(...), model: Optional[str] = Query(None)):
    """Score every face in one image. The top-level fields describe the most suspicious face."""
    contents = await _read(file)
    _require_models()
    _check_version(model)
    return await _run(lambda: predictor.analyse(_decode(contents), model))


@app.post("/predict/batch")
async def predict_batch(files: List[UploadFile] = File(...), model: Optional[str] = Query(None)):
    """Score up to 10 images. Heatmaps are left out to keep the response small."""
    if len(files) > MAX_BATCH:
        raise HTTPException(status_code=413, detail=f"At most {MAX_BATCH} images per batch.")
    _require_models()
    _check_version(model)
    results = []
    for f in files:
        try:
            contents = await _read(f)
            result = await _run(lambda: predictor.analyse(_decode(contents), model, heatmaps=False))
            results.append({"filename": f.filename, **result})
        except HTTPException as e:  # one bad file does not fail the whole batch
            results.append({"filename": f.filename, "error": e.detail})
    return {"model_version": model or predictor.default_version(), "results": results}


@app.post("/compare")
async def compare(file: UploadFile = File(...)):
    """Score one image with every model."""
    contents = await _read(file)
    _require_models()

    def run_all():
        image = _decode(contents)
        return {v: predictor.analyse(image, v) for v in predictor.versions()}

    return {"default": predictor.default_version(), "results": await _run(run_all)}
