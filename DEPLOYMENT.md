# Synthetic Face Detector — Deployment Guide

This guide outlines the recommended deployment strategies for both the FastAPI backend and the React/Vite frontend.

---

## 1. System Requirements

For production, the ML model (EfficientNet-B0) requires adequate memory. 
* **Backend:** Minimum 2GB RAM (4GB+ recommended) for PyTorch inference. No GPU is strictly required for inference, but a small GPU (e.g., T4) drastically improves throughput.
* **Frontend:** Static file hosting (CDN).

---

## 2. Backend Deployment (FastAPI)

The backend must be hosted on a service that supports Python environments and has enough memory for PyTorch. Recommended platforms: **Render**, **Railway**, **Hugging Face Spaces**, or a raw **VPS (DigitalOcean / AWS EC2)**.

### Option A: Using Docker (Recommended for VPS)

1. **Create a `Dockerfile` in the `backend` directory:**
   ```dockerfile
   FROM python:3.10-slim

   WORKDIR /app

   # Install system dependencies required for OpenCV
   RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

   # Install Python dependencies
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   # Copy application code and model
   COPY . .

   # Expose port and run
   EXPOSE 8000
   CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
   ```

2. **Build and Run:**
   ```bash
   docker build -t synthetic-face-backend .
   docker run -d -p 8000:8000 synthetic-face-backend
   ```

### Option B: Render or Railway (PaaS)

1. Connect your GitHub repository to Render/Railway.
2. Set the Root Directory to `backend`.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. **Important:** Ensure your service instance has at least 2GB of RAM to prevent OOM (Out of Memory) crashes when PyTorch loads the `best_model_v2.pth` file.

### Option C: Hugging Face Spaces

1. Create a new Space on [huggingface.co/spaces](https://huggingface.co/spaces) with the **FastAPI** SDK.
2. Push the `backend/` directory contents to the Space repository.
3. Set `FRONTEND_URL` as a Space Secret pointing to your deployed frontend URL.

---

## 3. Frontend Deployment (React + Vite)

The frontend is a static SPA and is best deployed on **Vercel**, **Netlify**, or **Cloudflare Pages**.

### Deploying to Vercel (Recommended)

1. Install Vercel CLI or connect via the Vercel Dashboard.
2. In the `frontend` directory, ensure your `.env.production` is set up.
3. **Environment Variables:**
   You must point the frontend to your deployed backend URL.
   ```env
   VITE_API_URL=https://your-deployed-backend.com
   ```
4. **Build Settings:**
   * Framework Preset: `Vite`
   * Build Command: `npm run build`
   * Output Directory: `dist`
5. Click **Deploy**.

---

## 4. Production Optimizations

Before going live, ensure the following optimizations are in place:

### CORS Configuration
In `backend/app.py`, update your CORS origins to exclusively allow your production frontend URL:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)
```

### Model Warm-up (Cold Start Mitigation)
When the FastAPI server starts, the first prediction is significantly slower as PyTorch moves the model and tensors to memory. To fix this, add a warm-up routine to the startup event in `app.py`:
```python
@app.on_event("startup")
async def startup_event():
    logger.info("Warming up the synthetic face classification model...")
    # Create a dummy 224x224 RGB image tensor
    dummy_input = torch.randn(1, 3, 224, 224)
    # Run a dry prediction
    _ = model(dummy_input)
    logger.info("Model warm-up complete.")
```

### Nginx Reverse Proxy (If using a VPS)
If deploying on a bare-metal VPS, run Uvicorn behind Nginx to handle SSL termination and buffering:
```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.0:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 10M; # Crucial for image uploads
    }
}
```

---

## 5. Pre-Flight Checklist
- [ ] `best_model_v2.pth` is present in the `backend` directory.
- [ ] Frontend `VITE_API_URL` points to the correct production API.
- [ ] Backend CORS allows the frontend production domain.
- [ ] File upload limits (`client_max_body_size`) are set to at least 10MB to match the frontend validation.
