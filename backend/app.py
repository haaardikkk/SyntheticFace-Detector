import logging
import os
from contextlib import asynccontextmanager

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

import predictor
from face_crop import crop_largest_face

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s", datefmt="%H:%M:%S")
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # same limit as the upload form
DEFAULT_ORIGINS = "https://synthetic-face-detector.vercel.app,http://localhost:3000,http://localhost:5173"
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
        logger.exception("Model failed to load")
    yield


app = FastAPI(title="Synthetic Face Detector API", version="3.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[u.strip() for u in os.environ.get("FRONTEND_URL", DEFAULT_ORIGINS).split(",") if u.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "service": "synthetic-face-detector", "model": predictor.model_info()}


@app.get("/health")
def health():
    if load_error:
        raise HTTPException(status_code=503, detail=load_error)
    return {"status": "healthy"}


def _analyse(contents):
    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="Could not decode image.")
    face, face_found = crop_largest_face(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    return {**predictor.predict(face), "face_detected": face_found}


@app.post("/predict")
async def detect(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="File must be an image.")
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is larger than 10 MB.")
    if load_error:
        raise HTTPException(status_code=503, detail="The model is not available right now.")
    try:
        return await run_in_threadpool(_analyse, contents)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Prediction failed")
        raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")
