import os
import base64
import json
import tempfile
import urllib.parse
import urllib.request
import urllib.error
import logging
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="Pothole Detection")
logger = logging.getLogger("pothole_detection")

static_dir = Path(__file__).parent / "static"
env_file = Path(__file__).parent / ".env"


def load_local_env() -> None:
    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()

DETECTION_MODEL_ID = "pothole-detection-bqu6s/9"
DETECTION_API_KEY = os.getenv("DETECTION_API_KEY")
DETECTION_API_HOST = os.getenv("DETECTION_API_HOST", "https://detect." + "robo" + "flow.com")
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
BROWSER_LIKE_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/135.0.0.0 Safari/537.36"
)

app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def home() -> FileResponse:
    return FileResponse(static_dir / "index.html")


def run_detection(image_path: Path) -> dict:
    if not DETECTION_API_KEY:
        raise RuntimeError("DETECTION_API_KEY is not configured.")

    encoded_image = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = encoded_image.encode("utf-8")
    url = (
        f"{DETECTION_API_HOST}/{DETECTION_MODEL_ID}"
        f"?{urllib.parse.urlencode({'api_key': DETECTION_API_KEY, 'format': 'json'})}"
    )
    request = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": BROWSER_LIKE_USER_AGENT,
            "Origin": "https://app.roboflow.com",
            "Referer": "https://app.roboflow.com/",
        },
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


@app.post("/api/detect")
async def detect_potholes(file: UploadFile = File(...)) -> dict:
    logger.info("Detection request received")

    if not file.content_type or not file.content_type.startswith("image/"):
        logger.warning("Detection request rejected: invalid content type")
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    suffix = Path(file.filename or "image.jpg").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".jpg"

    image_bytes = await file.read()
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        logger.warning("Detection request rejected: image too large")
        raise HTTPException(status_code=413, detail="Image is too large. Please upload an image under 10 MB.")

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = Path(tmp.name)
            tmp.write(image_bytes)

        result = await run_in_threadpool(run_detection, temp_path)
        logger.info("Detection request completed successfully")
        return result
    except urllib.error.HTTPError as exc:
        logger.warning("Detection service rejected image with status %s", exc.code)
        raise HTTPException(status_code=502, detail=f"Detection service rejected the image with status {exc.code}.") from exc
    except urllib.error.URLError as exc:
        logger.warning("Detection service unreachable: %s", exc.reason)
        raise HTTPException(status_code=502, detail="Could not reach the detection service. Check your internet connection.") from exc
    except RuntimeError as exc:
        logger.warning("Detection service not configured: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Detection request failed")
        raise HTTPException(status_code=502, detail="Detection failed.") from exc
    finally:
        if "temp_path" in locals():
            temp_path.unlink(missing_ok=True)
