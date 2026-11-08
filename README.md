# Synthetic Face Detector

> Determines whether a face image is a **real photograph** or **AI-generated / AI-altered**, and shows where.

**Live demo:** https://synthetic-face-detector.vercel.app · **Backend:** [Hugging Face Space](https://huggingface.co/spaces/Haaardikkkk/syntheticFace-Detector)

[![Framework](https://img.shields.io/badge/framework-PyTorch-orange)](https://pytorch.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> ⚠️ An educational and research project, for single images only (not video). It is not suitable for forensic, legal or security decisions.

---

## Features

- **Real vs. AI classification of every face** in an image (up to 10); click a face box to see its result
- **Uncertain verdict** for borderline scores, instead of a confident wrong answer
- **Alteration map** of the regions that look generated or altered
- **Batch mode:** up to 10 images at once
- **Model versions:** pick a model, or compare every version on the same image with their measured scores
- **Confidence score**, shown as an arc gauge
- **Automatic face detection** (YuNet), with phone-photo rotation (EXIF) handled
- **Fast on CPU**, no GPU required

## Models

**Model v4 (default):** ConvNeXt-Tiny at 256 px with an alteration-map decoder, fine-tuned from v3 on 182,167 face crops from
10+ generators (Stable Diffusion, inpainting, InsightFace swaps, Flux, SDXL, DALL-E 3, StyleGAN, OpenFake frontier models) and real
photos from DeepFakeFace, FFHQ, CelebA-HQ, WildDeepfake and Reddit. Training simulates social-media re-uploads (resizing and JPEG
compression), so compression alone no longer reads as a sign of AI.

All three models were scored on the same test images (balanced accuracy / AUC / real photos accepted):

| Test set | v4 | v3 | v2 |
|---|---|---|---|
| Held-out test (generators seen in training) | **92.4%** / 0.966 / 91.2% | 92.8% / **0.974** / 90.6% | 49.2% / 0.471 / 66.8% |
| Unseen generators (OpenFake core/test) | 73.9% / 0.803 / 62.4% | **74.0%** / **0.828** / 54.1% | 61.1% / 0.730 / 85.0% |
| Unseen videos (WildDeepfake test) | **73.5%** / **0.836** / 65.3% | 71.3% / 0.789 / 80.7% | 49.9% / 0.458 / 99.8% |
| Social-media images (OpenFake Reddit) | **63.9%** / **0.727** / **53.2%** | 52.9% / 0.555 / 9.8% | 32.8% / 0.286 / 46.1% |

The last three sets contain images from sources never used in training. v4's big gain is on real social-media photos: v3 flagged
90% of them as AI, v4 flags 47%. That is still the model's main weakness.

**Retrain:** see [docs/COLAB.md](docs/COLAB.md). The notebook needs no manual downloads, and every step survives a closed tab or an empty compute budget.

## Local setup

Requires Python 3.12+ and Node.js 18+.

```bash
git clone https://github.com/haaardikkk/SyntheticFace-Detector.git
cd SyntheticFace-Detector
git lfs pull
```

**Backend** (`http://localhost:9000`, docs at `/docs`):

```bash
python -m venv venv
venv\Scripts\activate
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 9000
```

On macOS / Linux, activate with `source venv/bin/activate`.

**Frontend** (`http://localhost:3000`):

```bash
cd frontend
npm install
npm run dev
```

On Windows you can double-click `START_BACKEND_WITH_VENV.bat` and `START_FRONTEND.bat` instead.

## API

### `POST /predict?model=v4`

`multipart/form-data` with an image in the field `file` (10 MB at most). `model` is optional; without it the default model is used.

```json
{
  "prediction": "FAKE",
  "confidence": 97.7,
  "fake_probability": 97.7,
  "altered_area": 31.4,
  "heatmap": "<base64-encoded PNG, or null>",
  "model_version": "v4",
  "heatmap_kind": "alteration",
  "face_detected": true,
  "face_count": 2,
  "primary_face": 0,
  "faces": [
    { "box": [0.43, 0.15, 0.11, 0.30], "prediction": "FAKE", "confidence": 97.7, "fake_probability": 97.7, "altered_area": 31.4, "heatmap": "..." },
    { "box": [0.14, 0.14, 0.05, 0.13], "prediction": "REAL", "confidence": 83.0, "fake_probability": 17.0, "altered_area": 2.7, "heatmap": "..." }
  ]
}
```

* `prediction` is `REAL`, `FAKE` or `UNCERTAIN` (the AI likelihood falls inside the model's `uncertain_band`, 35–75% by default).
* The top-level fields describe the **most suspicious face** (`primary_face`), so one altered face in a group photo is not hidden.
* `box` is `[x, y, width, height]` as fractions of the image size. It is `null` when no face was found and the image centre was analysed.
* `altered_area` (percentage of the face crop flagged as altered) is only given by models with an alteration map.

### `POST /predict/batch?model=v4`

Up to 10 images in the field `files`. Returns `{"model_version": ..., "results": [...]}`, one result per image as above but without
heatmaps. A file that fails gets `{"filename": ..., "error": ...}` without failing the rest.

### `POST /compare`

One image in `file`, scored by every model: `{"default": "v4", "results": {"v4": {...}, "v3": {...}, "v2": {...}}}`.

### `GET /models`

The available models with their measured scores, and which one is the default.

| Status | Meaning |
|---|---|
| `404` | Unknown `model` |
| `413` | Larger than 10 MB, or more than 10 images in a batch |
| `422` | Not an image, or it cannot be decoded |
| `500` | Prediction failed |
| `503` | The model did not load; `GET /health` says why |

`GET /health` and `GET /` report the status and the loaded models.

## Model versions

Each model is a folder in `backend/models/<version>/` with `model_meta.json` and its weights. The backend loads every folder.
The default is the newest version marked `"default": true` in its metadata; the environment variable `DEFAULT_MODEL` overrides it.

| Version | Model | Heatmap |
|---|---|---|
| v4 (default) | ConvNeXt-Tiny with an alteration-map decoder, fine-tuned from v3 | where the image was altered |
| v3 | ConvNeXt-Tiny with an alteration-map decoder | where the image was altered |
| v2 | the original EfficientNet-B0, kept for comparison | Grad-CAM: where the model looked |


## Project structure

```
backend/
  app.py             FastAPI app and endpoints
  predictor.py       inference and heatmaps
  model_loader.py    loads every model in models/
  models/<version>/  trained weights and model_meta.json (scores, calibration)
  model_def.py       model architecture (shared with the training notebook)
  face_crop.py       face detection and cropping (shared with the training notebook)
  Dockerfile         image for Hugging Face Spaces
frontend/            React + Vite website
notebooks/
  build_colab_notebook.py        generates the notebook
  train_synthetic_face_colab.ipynb
docs/COLAB.md        how to train
DEPLOYMENT.md        how to deploy
```

## Known limitations

- Single images only (up to 10 faces each), not video
- Detecting images from generators a model has never seen remains an open research problem: expect lower accuracy on new ones
- Heavy compression and very small faces reduce accuracy
- Alteration maps are approximate: their training masks are estimated, not hand-drawn
- Training datasets are mostly limited to research and non-commercial use

## License

Code: MIT, see [LICENSE](LICENSE). Trained models inherit the terms of their training data.

## Author

**Hardik** · [GitHub](https://github.com/haaardikkk) · [LinkedIn](https://linkedin.com/in/haaardikkk)
