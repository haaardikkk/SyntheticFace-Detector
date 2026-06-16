import base64
import io
import logging
import traceback

import numpy as np
import torch
from PIL import Image
from torchvision import transforms
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image

from model_loader import model, DEVICE

logger = logging.getLogger(__name__)

CLASS_NAMES = {0: "FAKE", 1: "REAL"}

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

# EfficientNet-B0 layer structure:
#   model.features is a Sequential of 9 blocks (indices 0-8).
#   features[-1] is itself a Sequential (the last MBConv group).
#   We need the actual Conv2dNormActivation inside it, not the outer Sequential,
#   because pytorch-grad-cam hooks a forward on a leaf module.
#   The correct target is the last real conv-norm-activation block: features[-1][-1].
target_layers = [model.features[-1][-1]]


def _encode_png(image_np: np.ndarray) -> str:
    img = Image.fromarray(image_np)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _generate_heatmap(pil_image: Image.Image, tensor: torch.Tensor) -> str | None:
    """
    Run Grad-CAM on the given tensor and overlay the result on pil_image.
    Returns a base64-encoded PNG string, or None if generation fails.

    IMPORTANT: tensor must NOT have been created under torch.no_grad() —
    Grad-CAM needs a live computation graph to back-propagate through.
    We receive a freshly constructed tensor here (see predict()).
    """
    try:
        logger.info("Grad-CAM: starting")

        with GradCAM(model=model, target_layers=target_layers) as cam:
            grayscale_cam = cam(input_tensor=tensor, targets=None)

        grayscale_cam = grayscale_cam[0]  # (224, 224)

        # Resize original face to 224×224 with high-quality resampling,
        # then normalise to [0, 1] float32 as required by show_cam_on_image.
        face_resized = np.array(
            pil_image.resize((224, 224), Image.LANCZOS)
        ).astype(np.float32) / 255.0

        overlay     = show_cam_on_image(face_resized, grayscale_cam, use_rgb=True)
        heatmap_b64 = _encode_png(overlay)

        logger.info("Grad-CAM: completed successfully")
        return heatmap_b64

    except Exception:
        logger.error("Grad-CAM: failed — prediction will still be returned\n%s",
                     traceback.format_exc())
        return None


def predict(image_np: np.ndarray) -> dict:
    logger.info("predict(): starting inference")

    pil_image = Image.fromarray(image_np)

    # Build the input tensor OUTSIDE torch.no_grad() so the computation
    # graph is preserved for Grad-CAM's backward pass.
    tensor = transform(pil_image).unsqueeze(0).to(DEVICE)

    # Forward pass: disable gradients only for the classification step.
    with torch.no_grad():
        outputs    = model(tensor)
        probs      = torch.softmax(outputs, dim=1)
        confidence, prediction = torch.max(probs, dim=1)

    label = CLASS_NAMES[prediction.item()]
    conf  = round(confidence.item() * 100, 2)
    logger.info("predict(): label=%s confidence=%.2f", label, conf)

    # Grad-CAM runs on a FRESH tensor (gradients enabled) so the backward
    # pass can actually propagate. Reusing the tensor from the no_grad block
    # above would give a RuntimeError because its grad_fn is None.
    cam_tensor = transform(pil_image).unsqueeze(0).to(DEVICE)
    heatmap    = _generate_heatmap(pil_image, cam_tensor)

    logger.info("predict(): returning response (heatmap=%s)", "present" if heatmap else "null")

    return {
        "prediction": label,
        "confidence": conf,
        "heatmap":    heatmap,   # None if Grad-CAM failed — frontend handles gracefully
    }