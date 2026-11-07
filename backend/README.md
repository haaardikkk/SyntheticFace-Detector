---
title: SyntheticFace Detector
emoji: 🏆
colorFrom: indigo
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: backend for syntheticFace Detector
---

FastAPI backend of the [Synthetic Face Detector](https://github.com/haaardikkk/SyntheticFace-Detector).

`POST /predict` with a multipart `file` field. `GET /health` reports whether the model loaded.
