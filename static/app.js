const imageInput = document.querySelector("#imageInput");
const startCameraButton = document.querySelector("#startCamera");
const captureFrameButton = document.querySelector("#captureFrame");
const video = document.querySelector("#video");
const canvas = document.querySelector("#canvas");
const emptyState = document.querySelector("#emptyState");
const statusLabel = document.querySelector("#status");
const summary = document.querySelector("#summary");
const ctx = canvas.getContext("2d");

let currentImage = null;
let cameraStream = null;
let isScanning = false;

function setStatus(text) {
  statusLabel.textContent = text;
}

function setScanning(scanning) {
  isScanning = scanning;
  imageInput.disabled = scanning;
  startCameraButton.disabled = scanning;
  captureFrameButton.disabled = scanning || !cameraStream;
}

function fitCanvasToImage(width, height) {
  const maxWidth = Math.min(window.innerWidth - 40, 1120);
  const maxHeight = Math.floor(window.innerHeight * 0.7);
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  return scale;
}

function drawDetections(predictions, scale) {
  ctx.lineWidth = 3;
  ctx.font = "700 15px Arial";

  predictions.forEach((prediction) => {
    const x = (prediction.x - prediction.width / 2) * scale;
    const y = (prediction.y - prediction.height / 2) * scale;
    const width = prediction.width * scale;
    const height = prediction.height * scale;
    const label = `${prediction.class || "pothole"} ${Math.round((prediction.confidence || 0) * 100)}%`;

    ctx.strokeStyle = "#ffcf4a";
    ctx.fillStyle = "rgba(255, 207, 74, 0.16)";
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);

    const labelWidth = ctx.measureText(label).width + 12;
    ctx.fillStyle = "#ffcf4a";
    ctx.fillRect(x, Math.max(0, y - 26), labelWidth, 24);
    ctx.fillStyle = "#16140d";
    ctx.fillText(label, x + 6, Math.max(17, y - 8));
  });
}

async function detectBlob(blob, source) {
  if (isScanning) return;

  const formData = new FormData();
  formData.append("file", blob, "road-frame.jpg");

  try {
    setScanning(true);
    setStatus("Scanning...");
  summary.textContent = "Scanning the road image";

    const response = await fetch("/api/detect", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Detection failed." }));
      throw new Error(error.detail || "Detection failed");
    }

    const result = await response.json();
    const predictions = result.predictions || [];
    const scale = fitCanvasToImage(source.width, source.height);

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    drawDetections(predictions, scale);

    setStatus("Done");
    summary.textContent = predictions.length
      ? `${predictions.length} pothole candidate${predictions.length === 1 ? "" : "s"} found.`
      : "No potholes detected in this frame";
  } finally {
    setScanning(false);
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = URL.createObjectURL(file);
  });
}

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    emptyState.hidden = true;
    video.hidden = true;
    currentImage = await loadImage(file);
    fitCanvasToImage(currentImage.width, currentImage.height);
    ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    await detectBlob(file, currentImage);
  } catch (error) {
    setStatus("Error");
    summary.textContent = error.message;
  }
});

startCameraButton.addEventListener("click", async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });

    video.srcObject = cameraStream;
    video.hidden = false;
    emptyState.hidden = true;
    captureFrameButton.disabled = false;
    setStatus("Camera ready");
    summary.textContent = "Camera started Click detect to scan a frame";
  } catch (error) {
    setStatus("Camera error");
    summary.textContent = "Could not open webcam Check browser permissions";
  }
});

captureFrameButton.addEventListener("click", async () => {
  if (!cameraStream || !video.videoWidth) return;

  const frameCanvas = document.createElement("canvas");
  frameCanvas.width = video.videoWidth;
  frameCanvas.height = video.videoHeight;
  frameCanvas.getContext("2d").drawImage(video, 0, 0);

  frameCanvas.toBlob(async (blob) => {
    try {
      if (!blob) throw new Error("Could not capture webcam frame");
      const image = await loadImage(blob);
      await detectBlob(blob, image);
    } catch (error) {
      setStatus("Error");
      summary.textContent = error.message;
    }
  }, "image/jpeg", 0.92);
});
