# Contributing

## Before You Change Code

- Read [README.md](README.md)
- Read [docs/setup.md](docs/setup.md)
- Read [docs/architecture.md](docs/architecture.md)
- Set `DETECTION_API_KEY` locally before testing detection

## Development Workflow

1. Create and activate a virtual environment
2. Install dependencies from `requirements.txt`
3. Run the app locally with `uvicorn`
4. Test the feature manually in the browser
5. Update docs if behavior, setup, or architecture changed

## Pull Request Expectations

- Explain what changed
- Explain why it changed
- Include any setup changes
- Mention manual test steps
- Never include secrets, `.env`, `.venv`, or log files
