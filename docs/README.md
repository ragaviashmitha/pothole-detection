# Pothole Detection | Standalone Console

A high-performance, single-file web application for detecting potholes from road surface images or live webcam feeds. This version is completely self-contained and communicates directly with the Roboflow API.

## Features

- **Single-File Architecture**: The entire app (HTML, CSS, and JS) is contained within `index.html`.
- **Direct API Integration**: No backend required. Calls the Roboflow API directly from the browser.
- **Premium Industrial UI**: Features a sleek dark theme with glassmorphism and real-time status tracking.
- **Flexible Hosting**: Can be hosted on any static platform like GitHub Pages, Vercel, or Netlify.
- **Camera Support**: Live webcam detection and "Snap Scan" one-shot frame analysis.

## Quick Start

1. Open `index.html` in any modern web browser.
2. Click the **Settings (gear icon)** in the top right.
3. Enter your **Roboflow API Key**.
4. Use **Upload Image** or **Start Webcam** to begin detecting.

## Project Structure

```text
pothole-detection/
|-- index.html     # The entire application
`-- README.md      # This file
```

## Security Note

This version stores your API Key in the browser's `localStorage`. This ensures that your key is never committed to Git while still being conveniently available across browser sessions.

## Technical Details

- **Frontend**: Vanilla JavaScript with ES6+ features.
- **Icons**: Lucide Icons (loaded via CDN).
- **Typography**: Inter and Outfit (loaded via Google Fonts).
- **Inference**: Roboflow Pothole Detection Model (`pothole-detection-bqu6s/9`).
