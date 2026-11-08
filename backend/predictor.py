import base64
import io
import logging
import threading

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from face_crop import crop_square, detect_faces
from model_loader import DEVICE, load_all

logger = logging.getLogger(__name__)

MASK_THRESHOLD = 0.5
MAX_FACES = 10
DEFAULT_BAND = (0.35, 0.75)   # P(fake) between these is reported as UNCERTAIN instead of a verdict

_models, _default, _locks = {}, None, {}


def load():
    global _models, _default, _locks
    _models, _default = load_all()
    _locks = {version: threading.Lock() for version in _models}
    for version, (model, meta) in _models.items():
        with torch.no_grad():  # warm-up: the first real request is not the slow one
            size = meta["input_size"]
            model(torch.zeros(1, 3, size, size, device=DEVICE))
        logger.info("Model loaded: %s (%s)%s", version, meta["architecture"], " [default]" if version == _default else "")


def default_version():
    return _default


def versions():
    return list(_models)


def model_list():
    keys = ("version", "name", "architecture", "description", "input_size", "heatmap", "metrics", "trained_at",
            "training_images", "uncertain_band")
    return [{**{k: meta.get(k) for k in keys}, "default": version == _default}
            for version, (_, meta) in sorted(_models.items(), reverse=True)]


def _batch(crops, meta):
    size = meta["input_size"]
    mean, std = torch.tensor(meta["mean"]).view(1, 3, 1, 1), torch.tensor(meta["std"]).view(1, 3, 1, 1)
    arr = np.stack([c if c.shape[0] == size else cv2.resize(c, (size, size), interpolation=cv2.INTER_AREA) for c in crops])
    x = torch.from_numpy(arr.astype(np.float32) / 255.0).permute(0, 3, 1, 2)
    return ((x - mean) / std).to(DEVICE)


def _grad_cam(model, x, target_classes):
    """Grad-CAM on EfficientNet-B0's last convolutional block, one map per image."""
    captured = {}
    layer = model.features[-1]
    hooks = [layer.register_forward_hook(lambda _m, _i, out: captured.update(activations=out)),
             layer.register_full_backward_hook(lambda _m, _i, out: captured.update(gradients=out[0]))]
    try:
        model.zero_grad()
        logits = model(x)
        logits.gather(1, torch.tensor(target_classes, device=DEVICE).view(-1, 1)).sum().backward()
    finally:
        for h in hooks:
            h.remove()
    weights = captured["gradients"].mean(dim=(2, 3), keepdim=True)
    cams = F.relu((weights * captured["activations"]).sum(dim=1)).detach().cpu().numpy()
    return [c / c.max() if c.max() > 0 else c for c in cams]


def _score(version, crops, want_heatmaps):
    """Return (P(fake) per crop, heat map per crop or None, alteration map or not)."""
    model, meta = _models[version]
    x = _batch(crops, meta)
    with _locks[version]:
        if meta["architecture"] == "efficientnet_b0":
            fake = meta.get("fake_class_index", 0)
            with torch.no_grad():
                p_fake = torch.softmax(model(x), dim=1)[:, fake].cpu().numpy()
            heats = _grad_cam(model, x, [fake if p >= 0.5 else 1 - fake for p in p_fake]) if want_heatmaps else None
            return p_fake, heats
        with torch.no_grad():
            logits, masks = model(x)
        calibration = meta.get("calibration", {"bias": 0.0, "temperature": 1.0})
        p_fake = torch.sigmoid((logits - calibration["bias"]) / calibration["temperature"]).cpu().numpy()
        return p_fake, list(torch.sigmoid(masks)[:, 0].cpu().numpy())


def _overlay_png(face, heat):
    """Colour the face by heat (0..1): a score of 0 leaves the pixel untouched. Returns a base64 PNG."""
    heat = cv2.resize(heat, (face.shape[1], face.shape[0]), interpolation=cv2.INTER_CUBIC).clip(0, 1)
    colour = cv2.cvtColor(cv2.applyColorMap((heat * 255).astype(np.uint8), cv2.COLORMAP_JET), cv2.COLOR_BGR2RGB)
    alpha = (0.6 * heat)[..., None]
    blended = (face * (1 - alpha) + colour * alpha).astype(np.uint8)
    buffer = io.BytesIO()
    Image.fromarray(blended).save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def _verdict(p_fake, band):
    if p_fake >= band[1]:
        return "FAKE", p_fake
    if p_fake < band[0]:
        return "REAL", 1 - p_fake
    return "UNCERTAIN", max(p_fake, 1 - p_fake)


_RANK = {"FAKE": 2, "UNCERTAIN": 1, "REAL": 0}


def analyse(image, version=None, heatmaps=True):
    """image: RGB uint8 array. Scores every face (up to MAX_FACES). The top-level verdict is the
    most suspicious face, so a single altered face in a group photo is not hidden by the others."""
    version = version or _default
    if version not in _models:
        raise KeyError(version)
    meta = _models[version][1]
    band = tuple(meta.get("uncertain_band") or DEFAULT_BAND)
    h, w = image.shape[:2]
    boxes = detect_faces(image)[:MAX_FACES]
    crops = [crop_square(image, b) for b in boxes] or [crop_square(image, None)]
    p_fake, heats = _score(version, crops, heatmaps)

    faces = []
    for i, crop in enumerate(crops):
        label, confidence = _verdict(float(p_fake[i]), band)
        face = {
            "box": [round(boxes[i][0] / w, 4), round(boxes[i][1] / h, 4), round(boxes[i][2] / w, 4), round(boxes[i][3] / h, 4)] if boxes else None,
            "prediction": label,
            "confidence": round(confidence * 100, 2),
            "fake_probability": round(float(p_fake[i]) * 100, 2),
        }
        if heats is not None and meta["heatmap"] == "alteration":
            face["altered_area"] = round(float((heats[i] >= MASK_THRESHOLD).mean()) * 100, 1)
        if heatmaps and heats is not None:
            try:
                face["heatmap"] = _overlay_png(crop, heats[i])
            except Exception:  # a result without a heatmap is still useful; the frontend shows a placeholder
                logger.exception("Heatmap generation failed")
                face["heatmap"] = None
        faces.append(face)

    top = max(range(len(faces)), key=lambda i: (_RANK[faces[i]["prediction"]], faces[i]["fake_probability"]))
    return {
        **{k: v for k, v in faces[top].items() if k != "box"},
        "model_version": version,
        "heatmap_kind": meta["heatmap"],
        "face_detected": bool(boxes),
        "face_count": len(boxes),
        "primary_face": top,
        "faces": faces,
    }
