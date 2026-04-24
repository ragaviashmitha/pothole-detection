# Agent Instructions

## Stack
- Backend: FastAPI in [app.py](E:\projects company\normal projects\pothole-detection\app.py)
- Frontend: static files in [static](E:\projects company\normal projects\pothole-detection\static)
- External dependency: Roboflow detection API via `DETECTION_API_KEY`

## Setup
- Create venv: `python -m venv .venv`
- Install deps: `.\.venv\Scripts\python -m pip install -r requirements.txt`
- Run dev server: `.\.venv\Scripts\python -m uvicorn app:app --reload`

## File-Scoped Checks
- Run app import check: `.\.venv\Scripts\python -c "import app; print(app.app.title)"`
- Smoke test server: `Invoke-WebRequest -Uri 'http://127.0.0.1:8000' -UseBasicParsing`

## Conventions
- Keep the backend minimal and framework-light
- Preserve the current pattern: frontend draws detections, backend proxies inference
- Do not commit `.env`, `.venv`, logs, or secrets
- If changing API behavior, update `README.md` and `docs/architecture.md`
- If changing setup or environment requirements, update `.env.example` and `docs/setup.md`

## Key Files
- Product overview: [README.md](E:\projects company\normal projects\pothole-detection\README.md)
- Setup details: [docs/setup.md](E:\projects company\normal projects\pothole-detection\docs\setup.md)
- System flow: [docs/architecture.md](E:\projects company\normal projects\pothole-detection\docs\architecture.md)

## Commit Attribution
- AI commits should include a `Co-Authored-By` trailer when the user asks for commits
