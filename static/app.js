const imageInput = document.querySelector("#imageInput");
const uploadButton = document.querySelector("#uploadButton");
const liveDetectButton = document.querySelector("#liveDetect");
const startCameraButton = document.querySelector("#startCamera");
const captureFrameButton = document.querySelector("#captureFrame");
const captureScreenshotButton = document.querySelector("#captureScreenshot");
const stopLiveDetectButton = document.querySelector("#stopLiveDetect");
const video = document.querySelector("#video");
const canvas = document.querySelector("#canvas");
const overlayCanvas = document.querySelector("#overlayCanvas");
const emptyState = document.querySelector("#emptyState");
const statusLabel = document.querySelector("#status");
const summary = document.querySelector("#summary");
const diagnosticMessage = document.querySelector("#diagnosticMessage");

const ctx = canvas?.getContext("2d");
const overlayCtx = overlayCanvas?.getContext("2d");

const LIVE_DETECTION_INTERVAL_MS = 400;
const LIVE_STARTUP_RETRY_MS = 150;
const LIVE_STARTUP_MAX_ATTEMPTS = 12;
const PROCESSING_IMAGE_QUALITY = 0.78;
const SCREENSHOT_IMAGE_QUALITY = 0.92;

const VIEW_STATE = {
  IDLE: "idle",
  STARTING_CAMERA: "starting_camera",
  CAMERA_READY: "camera_ready",
  LIVE_DETECTING: "live_detecting",
  CAMERA_ERROR: "camera_error",
  BACKEND_ERROR: "backend_error",
  PREVIEW: "preview",
};

const processingCanvas = document.createElement("canvas");
const processingCtx = processingCanvas.getContext("2d");

let currentImage = null;
let cameraStream = null;
let isScanning = false;
let liveLoopTimer = null;
let lastLiveDetections = [];
let lastVideoFrameRect = null;
let currentViewState = VIEW_STATE.IDLE;
let hasLoggedFirstDetectionRequest = false;
let hasLoggedFirstDetectionResponse = false;

function logLive(message, extra) {
  if (typeof extra === "undefined") {
    console.info(`[live-detect] ${message}`);
    return;
  }

  console.info(`[live-detect] ${message}`, extra);
}

function setViewState(nextState) {
  currentViewState = nextState;
  setControlsState();
}

function setStatus(text) {
  statusLabel.textContent = text;
}

function showDiagnostic(message) {
  if (diagnosticMessage) {
    diagnosticMessage.hidden = false;
    diagnosticMessage.textContent = message;
  }
}

function hideDiagnostic() {
  if (diagnosticMessage) {
    diagnosticMessage.hidden = true;
    diagnosticMessage.textContent = "";
  }
}

function isLiveActive() {
  return currentViewState === VIEW_STATE.STARTING_CAMERA
    || currentViewState === VIEW_STATE.CAMERA_READY
    || currentViewState === VIEW_STATE.LIVE_DETECTING;
}

function isPreviewMode() {
  return currentViewState === VIEW_STATE.PREVIEW;
}

function setControlsState() {
  const liveActive = isLiveActive();
  const previewMode = isPreviewMode();
  const busy = isScanning || currentViewState === VIEW_STATE.STARTING_CAMERA;

  if (imageInput) imageInput.disabled = busy;
  if (uploadButton) uploadButton.disabled = busy;
  if (liveDetectButton) liveDetectButton.disabled = busy || liveActive;
  if (startCameraButton) startCameraButton.disabled = busy || liveActive;
  if (captureFrameButton) captureFrameButton.disabled = busy || !cameraStream || liveActive;
  if (captureScreenshotButton) captureScreenshotButton.disabled = !liveActive || !cameraStream || !lastVideoFrameRect;
  if (stopLiveDetectButton) {
    stopLiveDetectButton.disabled = !liveActive && !previewMode && !cameraStream;
    stopLiveDetectButton.textContent = liveActive ? "Stop Live Detect" : "Stop Camera";
  }
}

function showEmptyState(message) {
  emptyState.hidden = false;
  emptyState.textContent = message;
}

function hideEmptyState() {
  emptyState.hidden = true;
}

function stopLiveLoop() {
  if (liveLoopTimer) {
    clearTimeout(liveLoopTimer);
    liveLoopTimer = null;
  }
}

function resetOverlay() {
  if (overlayCtx && overlayCanvas) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
}

function resetLiveRuntime() {
  stopLiveLoop();
  lastLiveDetections = [];
  lastVideoFrameRect = null;
  hasLoggedFirstDetectionRequest = false;
  hasLoggedFirstDetectionResponse = false;
  resetOverlay();
}

function fitCanvasToImage(width, height) {
  const maxWidth = Math.min(window.innerWidth - 40, 1120);
  const maxHeight = Math.floor(window.innerHeight * 0.7);
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  return scale;
}

function drawDetections(targetCtx, predictions, transform, options = {}) {
  const {
    lineWidth = 4,
    font = "700 15px Arial",
    strokeStyle = "#ffcf4a",
    fillStyle = "rgba(255, 207, 74, 0.18)",
    labelBackground = "#ffcf4a",
    labelColor = "#16140d",
  } = options;

  targetCtx.lineWidth = lineWidth;
  targetCtx.font = font;
  targetCtx.textBaseline = "middle";

  predictions.forEach((prediction) => {
    const x = transform.offsetX + (prediction.x - prediction.width / 2) * transform.scaleX;
    const y = transform.offsetY + (prediction.y - prediction.height / 2) * transform.scaleY;
    const width = prediction.width * transform.scaleX;
    const height = prediction.height * transform.scaleY;
    const label = `${prediction.class || "pothole"} ${Math.round((prediction.confidence || 0) * 100)}%`;
    const labelWidth = targetCtx.measureText(label).width + 14;
    const labelX = Math.max(transform.offsetX, Math.min(x, targetCtx.canvas.width - labelWidth));
    const labelY = Math.max(transform.offsetY + 12, y - 14);

    targetCtx.strokeStyle = strokeStyle;
    targetCtx.fillStyle = fillStyle;
    targetCtx.fillRect(x, y, width, height);
    targetCtx.strokeRect(x, y, width, height);

    targetCtx.fillStyle = labelBackground;
    targetCtx.fillRect(labelX, labelY - 12, labelWidth, 24);
    targetCtx.fillStyle = labelColor;
    targetCtx.fillText(label, labelX + 7, labelY);
  });
}

function renderStaticDetections(source, predictions) {
  const scale = fitCanvasToImage(source.width, source.height);

  if (video) video.hidden = true;
  if (overlayCanvas) overlayCanvas.hidden = true;
  if (canvas) canvas.hidden = false;
  resetOverlay();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  drawDetections(
    ctx,
    predictions,
    { scaleX: scale, scaleY: scale, offsetX: 0, offsetY: 0 },
    {
      lineWidth: 3,
      strokeStyle: "#ffcf4a",
      fillStyle: "rgba(255, 207, 74, 0.16)",
      labelBackground: "#ffcf4a",
      labelColor: "#16140d",
    },
  );
}

function updateSummaryForPredictions(predictions, activeModeLabel = "Frame") {
  summary.textContent = predictions.length
    ? `${activeModeLabel}: ${predictions.length} pothole candidate${predictions.length === 1 ? "" : "s"} highlighted.`
    : `${activeModeLabel}: no potholes detected.`;
}

async function detectBlob(blob) {
  if (isScanning) return [];

  const formData = new FormData();
  formData.append("file", blob, "road-frame.jpg");

  try {
    isScanning = true;
    setControlsState();

    if (!hasLoggedFirstDetectionRequest) {
      logLive("first detection request sent");
      hasLoggedFirstDetectionRequest = true;
    }

    const response = await fetch("/api/detect", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Detection failed." }));
      throw new Error(error.detail || "Detection failed");
    }

    const result = await response.json();

    if (!hasLoggedFirstDetectionResponse) {
      logLive("first detection response received", { predictions: result.predictions?.length || 0 });
      hasLoggedFirstDetectionResponse = true;
    }

    return result.predictions || [];
  } finally {
    isScanning = false;
    setControlsState();
  }
}

function loadImage(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve(image);
    };
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = URL.createObjectURL(fileOrBlob);
  });
}

function stopCameraStream() {
  if (!cameraStream) return;

  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  video.srcObject = null;
}

function getCameraErrorMessage(error) {
  const name = error?.name || "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      status: "Camera permission denied",
      summaryText: "Live detect needs camera permission before it can start.",
      diagnosticText: "Camera permission was denied. Allow camera access in the browser and try again.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      status: "Camera unavailable",
      summaryText: "No usable camera was found for live detection.",
      diagnosticText: "No camera device is available on this device or browser.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      status: "Camera unavailable",
      summaryText: "The camera is busy or could not be started.",
      diagnosticText: "The camera may be in use by another app, or the browser could not start the video stream.",
    };
  }

  if (name === "AbortError") {
    return {
      status: "Camera error",
      summaryText: "Camera startup was interrupted before live detection could begin.",
      diagnosticText: "The camera request was aborted before the live preview was ready.",
    };
  }

  return {
    status: "Camera error",
    summaryText: "Could not open the camera. Check browser permissions and device availability.",
    diagnosticText: error?.message || "The browser could not start the camera for live detection.",
  };
}

function stopLiveDetect(options = {}) {
  const {
    keepCamera = false,
    state = VIEW_STATE.IDLE,
    status = "Detection paused",
    summaryText = "Live detection stopped.",
    diagnosticText = "",
    emptyMessage = "Choose an image or start the webcam",
  } = options;

  resetLiveRuntime();
  if (video) video.hidden = true;
  if (overlayCanvas) overlayCanvas.hidden = true;

  if (!keepCamera) {
    stopCameraStream();
  }

  showEmptyState(emptyMessage);
  setStatus(status);
  summary.textContent = summaryText;

  if (diagnosticText) {
    showDiagnostic(diagnosticText);
  } else {
    hideDiagnostic();
  }

  setViewState(state);
}

async function startCameraPreview() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Browser camera unsupported");
  }

  stopCameraStream();
  logLive("camera request started");

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  cameraStream = stream;
  video.srcObject = stream;
  await video.play();
  logLive("camera stream started");
  return stream;
}

function waitForVideoMetadata() {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function finish() {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("error", onVideoError);
    }

    function onLoadedMetadata() {
      logLive("video metadata ready", { width: video.videoWidth, height: video.videoHeight });
      finish();
      resolve();
    }

    function onVideoError() {
      finish();
      reject(new Error("Video playback failed"));
    }

    function checkVideoReadiness() {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        onLoadedMetadata();
        return;
      }

      attempts += 1;
      if (attempts >= LIVE_STARTUP_MAX_ATTEMPTS) {
        finish();
        reject(new Error("Video playback failed"));
        return;
      }

      window.setTimeout(checkVideoReadiness, LIVE_STARTUP_RETRY_MS);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
    video.addEventListener("error", onVideoError, { once: true });
    checkVideoReadiness();
  });
}

function resizeLiveOverlay() {
  if (!cameraStream || !video.videoWidth || !video.clientWidth || !video.clientHeight) return;

  const videoAspect = video.videoWidth / video.videoHeight;
  const displayAspect = video.clientWidth / video.clientHeight;

  let drawnWidth = video.clientWidth;
  let drawnHeight = video.clientHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (displayAspect > videoAspect) {
    drawnWidth = video.clientHeight * videoAspect;
    offsetX = (video.clientWidth - drawnWidth) / 2;
  } else {
    drawnHeight = video.clientWidth / videoAspect;
    offsetY = (video.clientHeight - drawnHeight) / 2;
  }

  overlayCanvas.width = video.clientWidth;
  overlayCanvas.height = video.clientHeight;
  overlayCanvas.style.width = `${video.clientWidth}px`;
  overlayCanvas.style.height = `${video.clientHeight}px`;
  lastVideoFrameRect = {
    width: drawnWidth,
    height: drawnHeight,
    offsetX,
    offsetY,
    sourceWidth: video.videoWidth,
    sourceHeight: video.videoHeight,
  };
}

function renderLiveOverlay(predictions) {
  if (!lastVideoFrameRect) return;

  resetOverlay();

  drawDetections(
    overlayCtx,
    predictions,
    {
      scaleX: lastVideoFrameRect.width / lastVideoFrameRect.sourceWidth,
      scaleY: lastVideoFrameRect.height / lastVideoFrameRect.sourceHeight,
      offsetX: lastVideoFrameRect.offsetX,
      offsetY: lastVideoFrameRect.offsetY,
    },
    {
      lineWidth: 4,
      font: "700 15px Arial",
      strokeStyle: "#f9bf45",
      fillStyle: "rgba(168, 85, 247, 0.16)",
      labelBackground: "#a855f7",
      labelColor: "#ffffff",
    },
  );
}

function scheduleNextLiveLoop() {
  stopLiveLoop();

  if (currentViewState !== VIEW_STATE.LIVE_DETECTING) return;

  liveLoopTimer = window.setTimeout(() => {
    void runLiveDetectionPass();
  }, LIVE_DETECTION_INTERVAL_MS);
}

async function runLiveDetectionPass() {
  if (currentViewState !== VIEW_STATE.LIVE_DETECTING || !cameraStream || !video.videoWidth || isScanning) {
    scheduleNextLiveLoop();
    return;
  }

  try {
    processingCanvas.width = video.videoWidth;
    processingCanvas.height = video.videoHeight;
    processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

    const blob = await new Promise((resolve) => {
      processingCanvas.toBlob(resolve, "image/jpeg", PROCESSING_IMAGE_QUALITY);
    });

    if (!blob) {
      throw new Error("Could not read the live camera frame.");
    }

    const predictions = await detectBlob(blob);
    lastLiveDetections = predictions;
    resizeLiveOverlay();
    renderLiveOverlay(predictions);
    updateSummaryForPredictions(predictions, "Live view");
    hideDiagnostic();
    setStatus(predictions.length ? "Potholes detected" : "Live detecting");
  } catch (error) {
    logLive("live detection failed", error?.message || error);
    stopLiveDetect({
      keepCamera: false,
      state: VIEW_STATE.BACKEND_ERROR,
      status: "Detection service error",
      summaryText: "Live preview stopped because the detection service failed.",
      diagnosticText: error.message || "The backend could not process the live frame.",
      emptyMessage: "Live detect stopped after a backend error",
    });
    return;
  }

  scheduleNextLiveLoop();
}

function enterLiveDetectMode() {
  currentImage = null;
  if (canvas) canvas.hidden = true;
  if (video) video.hidden = false;
  if (overlayCanvas) overlayCanvas.hidden = false;
  hideEmptyState();
  hideDiagnostic();
  resizeLiveOverlay();
  setStatus("Camera ready");
  summary.textContent = "Live preview started. Starting pothole detection.";
  setViewState(VIEW_STATE.CAMERA_READY);
  setViewState(VIEW_STATE.LIVE_DETECTING);
  setStatus("Live detecting");
  void runLiveDetectionPass();
}

async function beginLiveDetect() {
  logLive("live detect button clicked");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    stopLiveDetect({
      keepCamera: false,
      state: VIEW_STATE.CAMERA_ERROR,
      status: "Browser camera unsupported",
      summaryText: "This browser does not support camera-based live detection.",
      diagnosticText: "The browser is missing the MediaDevices camera API required for live detection.",
      emptyMessage: "Live detect is unavailable in this browser",
    });
    return;
  }

  resetLiveRuntime();
  if (canvas) canvas.hidden = true;
  if (video) video.hidden = true;
  if (overlayCanvas) overlayCanvas.hidden = true;
  hideEmptyState();
  showDiagnostic("Requesting camera access for live detection...");
  summary.textContent = "Preparing live detection.";
  setStatus("Starting camera...");
  setViewState(VIEW_STATE.STARTING_CAMERA);

  try {
    await startWebcamSession({ liveDetection: true });
  } catch (error) {
    logLive("camera startup failed", error?.message || error);

    if (error.message === "Browser camera unsupported") {
      stopLiveDetect({
        keepCamera: false,
        state: VIEW_STATE.CAMERA_ERROR,
        status: "Browser camera unsupported",
        summaryText: "This browser does not support camera-based live detection.",
        diagnosticText: "The browser is missing the MediaDevices camera API required for live detection.",
        emptyMessage: "Live detect is unavailable in this browser",
      });
      return;
    }

    if (error.message === "Video playback failed") {
      stopLiveDetect({
        keepCamera: false,
        state: VIEW_STATE.CAMERA_ERROR,
        status: "Camera error",
        summaryText: "The camera stream started, but video playback did not become ready.",
        diagnosticText: "Video playback failed before the live preview became ready. Reload the page and try again.",
        emptyMessage: "Live detect could not start the video preview",
      });
      return;
    }

    const cameraError = getCameraErrorMessage(error);
    stopLiveDetect({
      keepCamera: false,
      state: VIEW_STATE.CAMERA_ERROR,
      status: cameraError.status,
      summaryText: cameraError.summaryText,
      diagnosticText: cameraError.diagnosticText,
      emptyMessage: "Live detect could not start the camera",
    });
  }
}

async function startWebcamSession(options = {}) {
  const { liveDetection = false } = options;

  await startCameraPreview();
  await waitForVideoMetadata();

  if (liveDetection) {
    enterLiveDetectMode();
    return;
  }

  if (canvas) canvas.hidden = true;
  if (video) video.hidden = false;
  if (overlayCanvas) overlayCanvas.hidden = true;
  hideEmptyState();
  hideDiagnostic();
  setStatus("Camera ready");
  summary.textContent = "Camera started. Click Detect Webcam Frame for a one-shot scan.";
  setViewState(VIEW_STATE.PREVIEW);
}

async function captureSingleFrameDetection() {
  if (!cameraStream || !video.videoWidth) return;

  try {
    hideEmptyState();
    hideDiagnostic();
    if (!video || !video.videoWidth) return;
    processingCanvas.width = video.videoWidth;
    processingCanvas.height = video.videoHeight;
    processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

    const blob = await new Promise((resolve) => {
      processingCanvas.toBlob(resolve, "image/jpeg", SCREENSHOT_IMAGE_QUALITY);
    });

    if (!blob) {
      throw new Error("Could not capture webcam frame");
    }

    const image = await loadImage(blob);
    setStatus("Scanning");
    summary.textContent = "Scanning the current webcam frame";
    const predictions = await detectBlob(blob);
    renderStaticDetections(image, predictions);
    updateSummaryForPredictions(predictions, "Captured frame");
    setStatus(predictions.length ? "Done" : "No potholes");
  } catch (error) {
    setStatus("Error");
    showDiagnostic(error.message);
    summary.textContent = "Webcam frame detection failed.";
  }
}

function captureScreenshot() {
  if (!isLiveActive() || !lastVideoFrameRect || !video.videoWidth) return;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = video.videoWidth;
  exportCanvas.height = video.videoHeight;
  const exportCtx = exportCanvas.getContext("2d");

  exportCtx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
  drawDetections(
    exportCtx,
    lastLiveDetections,
    {
      scaleX: exportCanvas.width / video.videoWidth,
      scaleY: exportCanvas.height / video.videoHeight,
      offsetX: 0,
      offsetY: 0,
    },
    {
      lineWidth: 6,
      font: "700 28px Arial",
      strokeStyle: "#f9bf45",
      fillStyle: "rgba(168, 85, 247, 0.18)",
      labelBackground: "#a855f7",
      labelColor: "#ffffff",
    },
  );

  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/jpeg", SCREENSHOT_IMAGE_QUALITY);
  link.download = `pothole-detect-${Date.now()}.jpg`;
  link.click();

  setStatus("Screenshot saved");
  summary.textContent = "Downloaded the current live detection frame.";
}

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  stopLiveDetect({
    keepCamera: false,
    state: VIEW_STATE.IDLE,
    status: "Ready",
    summaryText: "Loading uploaded image.",
  });

  try {
    hideEmptyState();
    hideDiagnostic();
    currentImage = await loadImage(file);
    setStatus("Scanning");
    summary.textContent = "Scanning the uploaded road image";
    const predictions = await detectBlob(file);
    renderStaticDetections(currentImage, predictions);
    updateSummaryForPredictions(predictions, "Uploaded image");
    setStatus(predictions.length ? "Done" : "No potholes");
  } catch (error) {
    setStatus("Error");
    showDiagnostic(error.message);
    if (summary) summary.textContent = "Uploaded image detection failed.";
  }
});

uploadButton?.addEventListener("click", () => {
  if (imageInput.disabled) return;
  imageInput.value = "";

  if (typeof imageInput.showPicker === "function") {
    imageInput.showPicker();
    return;
  }

  imageInput.click();
});

liveDetectButton?.addEventListener("click", async () => {
  await beginLiveDetect();
});

startCameraButton?.addEventListener("click", async () => {
  stopLiveDetect({
    keepCamera: false,
    state: VIEW_STATE.IDLE,
    status: "Ready",
    summaryText: "Starting webcam preview.",
  });

  try {
    await startWebcamSession({ liveDetection: false });
  } catch (error) {
    const cameraError = getCameraErrorMessage(error);
    setStatus(cameraError.status);
    showDiagnostic(cameraError.diagnosticText);
    if (summary) summary.textContent = cameraError.summaryText;
    setViewState(VIEW_STATE.CAMERA_ERROR);
  }
});

captureFrameButton?.addEventListener("click", async () => {
  await captureSingleFrameDetection();
});

captureScreenshotButton?.addEventListener("click", () => {
  captureScreenshot();
});

stopLiveDetectButton?.addEventListener("click", () => {
  if (isLiveActive()) {
    stopLiveDetect({
      keepCamera: false,
      state: VIEW_STATE.IDLE,
      status: "Detection paused",
      summaryText: "Live detection stopped.",
    });
    return;
  }

  stopLiveDetect({
    keepCamera: false,
    state: VIEW_STATE.IDLE,
    status: "Camera stopped",
    summaryText: "Camera preview stopped.",
  });
});

window.addEventListener("resize", () => {
  if (isLiveActive()) {
    resizeLiveOverlay();
    renderLiveOverlay(lastLiveDetections);
  }
});

setControlsState();
