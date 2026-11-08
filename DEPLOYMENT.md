# Deployment

| Part | Where it runs | URL |
|---|---|---|
| Backend (FastAPI) | Hugging Face Space, Docker SDK | https://huggingface.co/spaces/Haaardikkkk/syntheticFace-Detector |
| Frontend (React + Vite) | Vercel | https://synthetic-face-detector.vercel.app |

## Backend on Hugging Face Spaces

The Space's repository holds the **contents of `backend/`** at its top level. `backend/README.md` is its configuration card.

Push from your own machine, after `hf auth login` with a token that has write access:

```bash
hf upload Haaardikkkk/syntheticFace-Detector backend . --repo-type=space --exclude "__pycache__/*"
```

Each push rebuilds the image, which takes a few minutes. Then check it:

```bash
curl https://haaardikkkk-syntheticface-detector.hf.space/health
```

`{"status":"healthy"}` means the model loaded. A `503` with a message says what is wrong with the model file.

**If the Space shows "Scheduling failure" or "Runtime error":** that is the platform failing to place the container, before any
of our code runs. Open the Space → **Settings → Factory rebuild**.

**Sleeping:** a free Space sleeps after 48 hours without visits and takes a minute or two to wake. The frontend retries for
about 2.5 minutes, so the first visitor simply waits.

**CORS:** the Vercel URL and localhost are allowed by default. To allow others, set a Space variable `FRONTEND_URL` to a
comma-separated list of origins. It **replaces** the defaults, so include the Vercel URL in it.

## Installing a newly trained model

1. Download the zip the notebook made: `MyDrive/SyntheticFace_v3/runs/<version>/synthface_<version>.zip`
   (the first run, v3, is at `MyDrive/SyntheticFace_v3/synthface_v3.zip`).
2. Extract it into `backend/models/<version>/`, so that `backend/models/<version>/model_meta.json` exists.
3. In the previous default model's `model_meta.json`, set `"default": false` (or leave it: the newest default wins).
4. Push the backend as above.

Older versions stay available in the model picker and in Compare. To remove one, delete its folder.
Each model adds about 60 MB of image size and 250 MB of memory: the free Space has 16 GB.

`*.pth` files are stored with Git LFS (see `.gitattributes`). A file of about 130 bytes is a pointer, not a model: run `git lfs pull`.

## Frontend on Vercel

Root directory `frontend`, framework preset Vite, build command `npm run build`, output directory `dist`.
`VITE_API_URL` selects the backend; without it the Space URL above is used.

## Running elsewhere

```bash
docker compose up --build
```

The backend is then at `http://localhost:9000`. It needs about 2 GB of RAM.
