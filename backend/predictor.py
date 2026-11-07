import base64
import io
import logging

import cv2
import numpy as np
import torch
from PIL import Image

from model_loader import DEVICE, load_model

logger = logging.getLogger(__name__)

MASK_THRESHOLD = 0.5
_model, _meta = None, None


def load():
    global _model, _meta
    _model, _meta = load_model()
    with torch.no_grad():  # warm-up: the first real request is not the slow one
        size = _meta["input_size"]
        _model(torch.zeros(1, 3, size, size, device=DEVICE))
    logger.info("Model loaded: %s (%s)", _meta["version"], _meta["backbone"])


def model_info():
    return None if _meta is None else {k: _meta.get(k) for k in ("version", "backbone", "input_size", "metrics", "trained_at")}


def _to_tensor(face):
    size = _meta["input_size"]
    if face.shape[0] != size:
        face = cv2.resize(face, (size, size), interpolation=cv2.INTER_AREA)
    x = torch.from_numpy(face.astype(np.float32) / 255.0).permute(2, 0, 1)
    mean, std = torch.tensor(_meta["mean"]).view(3, 1, 1), torch.tensor(_meta["std"]).view(3, 1, 1)
    return ((x - mean) / std).unsqueeze(0).to(DEVICE)


def _overlay_png(face, heat):
    """Colour the face by heat (0..1): a score of 0 leaves the pixel untouched. Returns a base64 PNG."""
    heat = cv2.resize(heat, (face.shape[1], face.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)
    colour = cv2.cvtColor(cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    alpha = (0.6 * heat)[..., None]
    blended = (face * (1 - alpha) + colour * alpha).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(blended).save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def predict(face):
    """face: RGB uint8 square crop. Returns the JSON body of /predict."""
    if _model is None:
        raise RuntimeError("Model is not loaded")
    with torch.no_grad():
        logit, mask = _model(_to_tensor(face))
    calibration = _meta["calibration"]
    p_fake = torch.sigmoid((logit - calibration["bias"]) / calibration["temperature"]).item()
    heat = torch.sigmoid(mask)[0, 0].cpu().numpy()
    is_fake = p_fake >= 0.5
    try:
        heatmap = _overlay_png(face, heat)
    except Exception:  # a prediction without a heatmap is still useful; the frontend shows a placeholder
        logger.exception("Heatmap generation failed")
        heatmap = None
    return {
        "prediction": "FAKE" if is_fake else "REAL",
        "confidence": round((p_fake if is_fake else 1 - p_fake) * 100, 2),
        "heatmap": heatmap,
        "model_version": _meta["version"],
        "altered_area": round(float((heat >= MASK_THRESHOLD).mean()) * 100, 1),
    }
