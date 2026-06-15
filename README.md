# Synthetic Face Detector

> A binary image classifier that determines whether a facial image is a **real human photograph** or an **AI-generated synthetic face** — powered by EfficientNet-B0 with Grad-CAM attention maps.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/haaardikkk/deepfake-detector)
[![Model](https://img.shields.io/badge/model-EfficientNet--B0-blue)](https://arxiv.org/abs/1905.11946)
[![Framework](https://img.shields.io/badge/framework-PyTorch-orange)](https://pytorch.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE.txt)

---

## Overview

This project is a **synthetic face classification system**, not a video deepfake detector. It uses a fine-tuned EfficientNet-B0 model to analyse facial images and classify them as:

- **REAL** — a real human photograph
- **AI-GENERATED** — a synthetically produced face (GAN / diffusion model)

The application includes **Grad-CAM attention maps** that highlight which regions of the face influenced the classification decision, providing explainability for each prediction.

> ⚠️ This is an educational and research project. It is not suitable for forensic, legal, or production security applications.

---

## Features

- 🔍 **Binary classification** — Real vs. AI-Generated face detection
- 🗺️ **Grad-CAM visualisation** — Attention heatmap overlaid on the input image
- 📊 **Confidence score** — Arc gauge showing model certainty (0–100%)
- 🖼️ **Face preprocessing** — Automatic face detection and crop via OpenCV
- 🌐 **Web interface** — Premium dark glassmorphism UI with smooth animations
- ⚡ **Fast inference** — < 1 second on standard CPU (no GPU required)

---

## Tech Stack

### Frontend
| Technology | Role |
|---|---|
| React 18 | UI framework |
| Vite | Build tool |
| TailwindCSS 3 | Utility CSS |
| Framer Motion | Animations |
| Recharts | Confidence arc gauge |
| Lucide React | Icons |

### Backend
| Technology | Role |
|---|---|
| FastAPI | REST API |
| PyTorch 2.x | Model inference |
| EfficientNet-B0 | Classification model |
| pytorch-grad-cam | Attention map generation |
| OpenCV | Face detection and crop |
| Pillow | Image preprocessing |

---

## Model Details

| Parameter | Value |
|---|---|
| Architecture | EfficientNet-B0 (fine-tuned) |
| Training Dataset | CelebDF (real) + TPDNE-derived (synthetic) |
| Output Classes | Real / AI-Generated |
| Input Resolution | 224 × 224 px |
| Validation Accuracy | ~95%* |
| Inference Time | < 1 second |
| ML Framework | PyTorch 2.x |
| Explainability | Grad-CAM (`features[-1][-1]`) |
| Face Preprocessing | OpenCV crop → resize |

\* *Measured on held-out test split only. May not generalise to all real-world images.*

---

## Local Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Clone the repository

```bash
git clone https://github.com/haaardikkk/deepfake-detector.git
cd deepfake-detector
```

### 2. Backend setup

```bash
# Create and activate virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Start the backend server
python -m uvicorn app:app --reload --port 9000
```

The API will be available at `http://localhost:9000`  
Interactive docs: `http://localhost:9000/docs`

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 4. Quick start (Windows)

Double-click `START_BACKEND_WITH_VENV.bat` to start the backend, then `START_FRONTEND.bat` for the frontend.

---

## API Reference

### `POST /predict`

Classifies a facial image.

**Request:** `multipart/form-data` with field `file` (image file)

**Response:**
```json
{
  "prediction": "REAL",
  "confidence": 94.7,
  "heatmap": "<base64-encoded PNG>"
}
```

**Error responses:**
- `400` — No face detected in the image
- `422` — Invalid file type or unprocessable image
- `500` — Internal server error

---

## Project Structure

```
SyntheticFace Detector/
├── backend/
│   ├── app.py              # FastAPI application and /predict endpoint
│   ├── predictor.py        # Model inference + Grad-CAM logic
│   ├── face_crop.py        # OpenCV face detection and crop
│   ├── model_loader.py     # EfficientNet-B0 model loading
│   ├── best_model_v2.pth   # Trained model weights
│   └── requirements.txt    # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, Hero, UploadCard, PredictionCard, etc.
│   │   ├── pages/          # Home page layout
│   │   └── index.css       # Global design system (glass, animations)
│   ├── tailwind.config.js  # Custom design tokens
│   └── package.json
├── START_BACKEND_WITH_VENV.bat
├── START_FRONTEND.bat
└── docker-compose.yml
```

---

## Known Limitations

- **Not a video deepfake detector** — analyses single images only
- **Not evaluated on diffusion-model outputs** — may underperform on Stable Diffusion / FLUX generated faces
- **Performance degrades** on heavily compressed, low-resolution, or heavily cropped faces
- **Single face per image** — processes only the largest detected face
- **Not suitable** for legal, forensic, or production security applications

---

## Planned Improvements

- [ ] Multi-face detection within a single image
- [ ] Diffusion-model samples in training data (Stable Diffusion, FLUX)
- [ ] Batch image classification endpoint
- [ ] Model versioning and comparison interface
- [ ] Confidence calibration

---

## License

MIT License — see [LICENSE.txt](LICENSE.txt) for details.

---

## Author

**Hardik**  
[GitHub](https://github.com/haaardikkk) · [LinkedIn](https://linkedin.com/in/haaardikkk)

---

*Made with ❤️ as an ML portfolio and research project.*
