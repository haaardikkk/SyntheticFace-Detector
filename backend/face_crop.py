"""Face detection and cropping.

The training notebook embeds this file unchanged, so training and serving crop faces
identically. Edit it here, then rerun notebooks/build_colab_notebook.py.
"""
import os
import threading
from pathlib import Path

import cv2

YUNET_PATH = os.environ.get("YUNET_PATH") or str(
    Path(__file__).with_name("face_detection_yunet_2023mar.onnx")
)
CROP_SIZE = 256
FACE_MARGIN = 0.3  # share of the face size added on every side, so the crop includes hairline and jaw
MAX_DETECT_SIDE = 640
MIN_FACE_PX = 40

_local = threading.local()  # a YuNet detector is not thread-safe


def _detector():
    if not hasattr(_local, "yunet"):
        _local.yunet = cv2.FaceDetectorYN.create(YUNET_PATH, "", (320, 320), 0.7, 0.3, 50)
    return _local.yunet


def detect_largest_face(image):
    """Return (x, y, w, h) of the largest face in an RGB array, or None."""
    h, w = image.shape[:2]
    scale = min(1.0, MAX_DETECT_SIDE / max(h, w))
    small = image if scale == 1.0 else cv2.resize(
        image, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA
    )
    yunet = _detector()
    yunet.setInputSize((small.shape[1], small.shape[0]))
    _, faces = yunet.detect(cv2.cvtColor(small, cv2.COLOR_RGB2BGR))
    if faces is None:
        return None
    x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])[:4] / scale
    if min(fw, fh) < MIN_FACE_PX:
        return None
    return float(x), float(y), float(fw), float(fh)


def crop_square(image, box=None, size=CROP_SIZE):
    """Square crop around box (the centre of the image if None), resized to size x size."""
    h, w = image.shape[:2]
    if box is None:
        side, cx, cy = min(h, w), w / 2, h / 2
    else:
        x, y, fw, fh = box
        side, cx, cy = max(fw, fh) * (1 + 2 * FACE_MARGIN), x + fw / 2, y + fh / 2
    side = max(2, round(side))
    x1, y1 = round(cx - side / 2), round(cy - side / 2)
    x2, y2 = x1 + side, y1 + side
    pad = max(0, -x1, -y1, x2 - w, y2 - h)
    if pad:  # the face touches the border: mirror instead of shifting it off-centre
        image = cv2.copyMakeBorder(image, pad, pad, pad, pad, cv2.BORDER_REFLECT_101)
        x1, y1, x2, y2 = x1 + pad, y1 + pad, x2 + pad, y2 + pad
    crop = image[y1:y2, x1:x2]
    interpolation = cv2.INTER_AREA if side > size else cv2.INTER_CUBIC
    return cv2.resize(crop, (size, size), interpolation=interpolation)


def crop_largest_face(image, size=CROP_SIZE):
    """Return (square crop, whether a face was found). Without a face: the centre of the image."""
    box = detect_largest_face(image)
    return crop_square(image, box, size), box is not None
