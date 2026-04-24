# Setup Guide

## Prerequisites

- Python 3.11 or newer
- A Roboflow API key with access to the pothole detection model

## First-Time Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Environment Configuration

Required:

```powershell
$env:DETECTION_API_KEY="your_roboflow_api_key"
```

Optional:

```powershell
$env:DETECTION_API_HOST="https://detect.roboflow.com"
```

You can also create a local `.env` file from `.env.example` if you prefer environment-file loading through your shell or process manager.

## Run in Development

```powershell
.\.venv\Scripts\python -m uvicorn app:app --reload
```

Visit:

```text
http://127.0.0.1:8000
```

## Common Problems

### `DETECTION_API_KEY is not configured`

Set the `DETECTION_API_KEY` environment variable before starting the app.

### `Could not reach the detection service`

- Check internet access
- Verify `DETECTION_API_HOST`
- Confirm Roboflow is reachable from your network

### Detection request rejected

- Verify the API key is valid
- Confirm the model ID is still accessible to that key
- Try a supported image type under 10 MB
