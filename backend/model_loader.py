"""Loads every model in models/<version>/ (model_meta.json + weights).

Two architectures are supported:
  synthface        ConvNeXt + alteration-map decoder, from notebooks/train_synthetic_face_colab.ipynb
  efficientnet_b0  the original v2 classifier (2 classes, heatmap via Grad-CAM)
"""
import json
import logging
import os
from pathlib import Path

import torch

MODELS_DIR = Path(__file__).parent / "models"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger = logging.getLogger(__name__)


def _check_weights(path):
    if not path.exists():
        raise FileNotFoundError(f"Model file is missing: {path}")
    with open(path, "rb") as f:
        if f.read(40).startswith(b"version https://git-lfs"):
            raise RuntimeError(f"{path.name} is a Git LFS pointer, not the weights. Run: git lfs pull")


def _build(meta):
    architecture = meta.get("architecture", "synthface")
    if architecture == "synthface":
        from model_def import SyntheticFaceNet
        return SyntheticFaceNet(backbone=meta["backbone"], fpn_dim=meta["fpn_dim"])
    if architecture == "efficientnet_b0":
        from torchvision import models
        net = models.efficientnet_b0(weights=None)
        net.classifier[1] = torch.nn.Linear(net.classifier[1].in_features, 2)
        return net
    raise ValueError(f"Unknown architecture: {architecture}")


def load_model(folder):
    meta = json.loads((folder / "model_meta.json").read_text(encoding="utf-8"))
    meta.setdefault("version", folder.name)
    meta.setdefault("architecture", "synthface")
    weights = folder / meta.get("weights", "model.pth")
    _check_weights(weights)
    net = _build(meta)
    state = torch.load(weights, map_location="cpu", weights_only=True)
    net.load_state_dict({k: v.float() if v.is_floating_point() else v for k, v in state.items()})
    return net.to(DEVICE).eval(), meta


def load_all():
    """Return {version: (model, meta)} for every folder in models/, and the default version."""
    loaded = {}
    for folder in sorted(p for p in MODELS_DIR.iterdir() if (p / "model_meta.json").exists()):
        try:
            model, meta = load_model(folder)
            loaded[meta["version"]] = (model, meta)
        except Exception:
            logger.exception("Could not load model %s", folder.name)
    if not loaded:
        raise RuntimeError(f"No model could be loaded from {MODELS_DIR}")
    # DEFAULT_MODEL picks one explicitly; otherwise the newest version marked default, otherwise the newest
    newest_first = sorted(loaded, key=_version_number, reverse=True)
    wanted = os.environ.get("DEFAULT_MODEL")
    if wanted in loaded:
        return loaded, wanted
    marked = [v for v in newest_first if loaded[v][1].get("default")]
    return loaded, (marked or newest_first)[0]


def _version_number(version):
    digits = "".join(ch for ch in version if ch.isdigit())
    return (int(digits) if digits else -1, version)
