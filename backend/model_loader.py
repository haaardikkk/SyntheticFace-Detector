"""Loads the detector from model/ (synthface_v3.pth + model_meta.json, from the training notebook)."""
import json
from pathlib import Path

import torch

from model_def import SyntheticFaceNet

MODEL_DIR = Path(__file__).parent / "model"
WEIGHTS, META = MODEL_DIR / "synthface_v3.pth", MODEL_DIR / "model_meta.json"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def load_model():
    """Return (model, meta)."""
    if not WEIGHTS.exists():
        raise FileNotFoundError(f"Model file is missing: {WEIGHTS}")
    with open(WEIGHTS, "rb") as f:
        if f.read(40).startswith(b"version https://git-lfs"):
            raise RuntimeError(f"{WEIGHTS.name} is a Git LFS pointer, not the weights. Run: git lfs pull")
    meta = json.loads(META.read_text(encoding="utf-8"))
    net = SyntheticFaceNet(backbone=meta["backbone"], fpn_dim=meta["fpn_dim"])
    state = torch.load(WEIGHTS, map_location="cpu", weights_only=True)
    net.load_state_dict({k: v.float() for k, v in state.items()})
    return net.to(DEVICE).eval(), meta
