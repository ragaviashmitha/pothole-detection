# Pothole Detection

FastAPI web app for detecting potholes from uploaded road images or webcam captures using a hosted Roboflow detection model.

## What This Project Does

- Upload a road image and run pothole detection
- Start the webcam and scan a captured frame
- Draw bounding boxes and confidence scores on the image
- Return raw detection results from the backend API

## Tech Stack

- Backend: FastAPI
- Frontend: Vanilla HTML, CSS, and JavaScript
- Inference provider: Roboflow hosted model API
- Runtime: Python 3.11+

## Project Structure

```text
pothole-detection/
|-- app.py                # FastAPI app and detection proxy
|-- requirements.txt      # Python dependencies
|-- static/
|   |-- index.html        # Single-page UI
|   |-- styles.css        # App styling
|   `-- app.js            # Browser logic for upload, webcam, and rendering
|-- docs/
|   |-- architecture.md   # Request flow and design notes
|   `-- setup.md          # Local setup and environment details
|-- .env.example          # Required environment variable template
|-- .gitignore
|-- AGENTS.md             # Agent-facing repo instructions
`-- CLAUDE.md             # Same guidance for Claude-style agents
```

## How It Works

1. The browser loads the single-page interface from `/`.
2. The user uploads an image or captures a webcam frame.
3. The frontend sends the image to `POST /api/detect`.
4. The FastAPI backend validates the file and forwards it to Roboflow.
5. The backend returns the detection JSON.
6. The frontend draws boxes and labels on the canvas.

## Local Setup

### 1. Create a virtual environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy `.env.example` to `.env` or set variables in your shell.

```powershell
$env:DETECTION_API_KEY="your_roboflow_api_key"
```

Optional:

```powershell
$env:DETECTION_API_HOST="https://detect.roboflow.com"
```

### 4. Run the app

```powershell
.\.venv\Scripts\python -m uvicorn app:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DETECTION_API_KEY` | Yes | Roboflow API key used by the backend |
| `DETECTION_API_HOST` | No | Detection host URL, defaults to Roboflow detect endpoint |

## API

### `GET /`

Returns the web interface.

### `POST /api/detect`

Accepts one multipart file field named `file`.

Supported file types:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Validation rules:

- File must be an image MIME type
- Max upload size is 10 MB

Example response shape:

```json
{
  "predictions": [
    {
      "x": 412.5,
      "y": 210.0,
      "width": 96.0,
      "height": 72.0,
      "confidence": 0.91,
      "class": "pothole"
    }
  ]
}
```

## Development Notes

- This repo does not store model weights locally
- The backend is a thin proxy around a hosted detection API
- The frontend is intentionally simple so the detection flow is easy to follow
- API keys must never be committed to Git

## Documentation

- See [docs/setup.md](docs/setup.md) for environment and startup details
- See [docs/architecture.md](docs/architecture.md) for system flow and design decisions
- See [AGENTS.md](AGENTS.md) for AI-agent workflow guidance

## Recommended Next Improvements

- Add a health endpoint
- Add automated tests for the API route
- Move configuration into a dedicated settings object
- Add confidence threshold controls in the UI
- Add deployment instructions if you plan to host the app
