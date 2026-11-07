# Synthetic Face Detector

> Determines whether a face image is a **real photograph** or **AI-generated / AI-altered**, and shows where.

**Live demo:** https://synthetic-face-detector.vercel.app · **Backend:** [Hugging Face Space](https://huggingface.co/spaces/Haaardikkkk/syntheticFace-Detector)

[![Framework](https://img.shields.io/badge/framework-PyTorch-orange)](https://pytorch.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> ⚠️ An educational and research project, for single images only (not video). It is not suitable for forensic, legal or security decisions.

---

## Features

- **Real vs. AI classification** of the largest face in an image
- **Alteration map** of the regions that look generated or altered
- **Confidence score**, shown as an arc gauge
- **Automatic face detection and crop** (YuNet); if no face is found, the centre of the image is analysed and the API says so
- **Fast on CPU**, no GPU required

## Models

**Model v3:** ConvNeXt-Tiny at 256 px with an alteration-map decoder, trained on 179,426 face crops from 10+ generators
(Stable Diffusion, inpainting, InsightFace swaps, Flux, SDXL, DALL-E 3, StyleGAN, OpenFake frontier models) and real photos
from DeepFakeFace, FFHQ, CelebA-HQ and WildDeepfake.

| Test set | Balanced accuracy | AUC | Fakes caught | Real photos accepted |
|---|---|---|---|---|
| Held-out test (generators seen in training) | 94.2% | 0.981 | 94.9% | 93.6% |
| Unseen generators (OpenFake core/test) | 74.0% | 0.828 | 93.9% | 54.1% |
| Unseen videos (WildDeepfake test) | 71.3% | 0.789 | 61.9% | 80.7% |
| Social-media images (OpenFake Reddit) | 52.9% | 0.556 | 96.1% | 9.8% |

The last three sets contain images from sources never used in training. The model's main weakness is false alarms:
it flags most real social-media photos as AI-generated.

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

### `POST /predict`

`multipart/form-data` with an image in the field `file` (10 MB at most).

```json
{
  "prediction": "REAL",
  "confidence": 94.7,
  "heatmap": "<base64-encoded PNG, or null>",
  "model_version": "v3",
  "face_detected": true,
  "altered_area": 0.0
}
```

`altered_area` is the percentage of the face crop flagged as altered.

| Status | Meaning |
|---|---|
| `413` | Larger than 10 MB |
| `422` | Not an image, or it cannot be decoded |
| `500` | Prediction failed |
| `503` | The model did not load; `GET /health` says why |

`GET /health` and `GET /` report the status and the loaded model.

## Project structure

```
backend/
  app.py             FastAPI app and endpoints
  predictor.py       inference and heatmaps
  model_loader.py    loads the model from model/
  model/             trained weights and model_meta.json (scores, calibration)
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

- Single images only; the largest face in each image
- Detecting images from generators a model has never seen remains an open research problem: expect lower accuracy on new ones
- Heavy compression and very small faces reduce accuracy
- Alteration maps are approximate: their training masks are estimated, not hand-drawn
- Training datasets are mostly limited to research and non-commercial use

## License

Code: MIT, see [LICENSE](LICENSE). Trained models inherit the terms of their training data.

## Author

**Hardik** · [GitHub](https://github.com/haaardikkk) · [LinkedIn](https://linkedin.com/in/haaardikkk)
