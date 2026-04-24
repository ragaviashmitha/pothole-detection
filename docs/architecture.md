# Architecture

## Overview

This project is a small client-server application:

- The frontend is a static single-page app served by FastAPI
- The backend exposes one detection endpoint
- The backend forwards validated images to a hosted Roboflow model

## Components

### `app.py`

- Defines the FastAPI application
- Serves static assets from `static/`
- Exposes `GET /` for the UI
- Exposes `POST /api/detect` for pothole inference
- Validates upload type and size
- Writes the incoming upload to a temporary file
- Calls the external detection API and returns its JSON

### `static/index.html`

- Provides the basic UI shell
- Includes upload controls, webcam controls, canvas, and result summary

### `static/app.js`

- Handles browser interactions
- Loads uploaded images into a canvas
- Starts and captures the webcam stream
- Sends the selected image/frame to `/api/detect`
- Draws detection rectangles and labels

### `static/styles.css`

- Styles the application layout and controls
- Keeps the UI readable on desktop and mobile

## Request Flow

```text
Browser
  -> POST /api/detect
  -> FastAPI validates file
  -> FastAPI sends base64 image to Roboflow
  -> Roboflow returns JSON predictions
  -> FastAPI returns JSON to browser
  -> Frontend renders boxes on canvas
```

## Current Design Decisions

- Keep the frontend framework-free for low complexity
- Keep inference remote so there is no local ML runtime to manage
- Keep the backend thin so the detection path is easy to debug

## Known Limitations

- No test suite yet
- No authentication
- No persistence layer for uploads or results
- No retry logic for upstream detection failures
- The frontend assumes Roboflow returns prediction coordinates in the current schema
