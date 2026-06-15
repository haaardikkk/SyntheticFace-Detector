# Synthetic Face Detector — Frontend

Modern React frontend for the Synthetic Face Detector application using EfficientNet-B0. Classifies whether a facial image is real or AI-generated.

## 🚀 Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Recharts** - Chart library for confidence gauge
- **Axios** - HTTP client
- **Lucide React** - Icon library

## 📦 Installation

```bash
# Install dependencies
npm install
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

The frontend will start at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## 🔧 Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:9000
```

## 🎨 Features

- **Dark Premium UI** — Glassmorphism design with neon accents
- **Drag & Drop Upload** — Easy image upload interface
- **Real-time Classification** — Instant synthetic face detection results
- **Animated Results** — Smooth animations with Framer Motion
- **Confidence Gauge** — Visual representation of prediction confidence
- **Grad-CAM Heatmap** — Attention map highlighting regions influencing the prediction
- **Responsive Design** — Works on desktop, tablet, and mobile
- **Model Information** — Detailed stats about the AI model

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx
│   │   ├── UploadCard.jsx
│   │   ├── PredictionCard.jsx
│   │   ├── ConfidenceGauge.jsx
│   │   ├── HeatmapCard.jsx
│   │   ├── ModelStats.jsx
│   │   └── Footer.jsx
│   ├── pages/
│   │   └── Home.jsx
│   ├── App.jsx
│   ├── main.jsx
│   ├── api.js
│   └── index.css
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🔌 API Integration

The frontend connects to the FastAPI backend at `http://localhost:9000` by default.

**Endpoint:** `POST /predict`

**Request:** FormData with image file (JPG / PNG, max 10 MB)

**Response:**
```json
{
  "prediction": "REAL" | "FAKE",
  "confidence": 95.67,
  "heatmap": "<base64-encoded-png-or-null>"
}
```

## 🎯 Future Enhancements

- Multi-face detection in a single image
- Batch image processing
- Result history (client-side)
- Export prediction reports as PDF
- Confidence threshold settings

## 📄 License

MIT License
