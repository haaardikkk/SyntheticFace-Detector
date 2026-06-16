import logging
import traceback

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import cv2
import numpy as np

from face_crop import crop_largest_face
from predictor import predict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DeepFake Detector API", version="2.0.0")

import os

frontend_urls = os.environ.get("FRONTEND_URL", "http://localhost:3000,http://localhost:5173").split(",")
origins = [url.strip() for url in frontend_urls if url.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "running", "service": "deepfake-detector"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/predict")
async def detect(file: UploadFile = File(...)):
    logger.info("Request received: filename=%s content_type=%s", file.filename, file.content_type)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    contents = await file.read()
    logger.info("Image loaded: %d bytes", len(contents))

    image = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=422, detail="Could not decode image.")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    face = crop_largest_face(image)
    logger.info("Face crop: result shape=%s", face.shape)

    try:
        result = predict(face)
    except Exception:
        logger.error("predict() raised an unexpected exception:\n%s", traceback.format_exc())
        raise HTTPException(status_code=500, detail="Prediction failed. Please try again.")

    logger.info("Response returned: prediction=%s confidence=%s heatmap=%s",
                result.get("prediction"), result.get("confidence"),
                "present" if result.get("heatmap") else "null")

    return result