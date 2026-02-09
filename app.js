const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const COLORS = ["#ff4d4d", "#ff8a00", "#ffd400", "#36c84d", "#00b9ff", "#5067ff", "#a95dff", "#ff58c8"];
const SCORE_SIZE = 280;
const BRUSH_SIZE_RATIO = 0.14;
const MIN_BRUSH_SIZE = 25;
const COMPLETION_COVERAGE_THRESHOLD = 0.34;
const COMPLETION_ACCURACY_THRESHOLD = 0.18;

const boardWrap = document.getElementById("board-wrap");
const guideCanvas = document.getElementById("guide-canvas");
const drawCanvas = document.getElementById("draw-canvas");
const letterEl = document.getElementById("current-letter");
const statusText = document.getElementById("status-text");
const celebrateEl = document.getElementById("celebrate");
const colorPicker = document.getElementById("color-picker");
const clearBtn = document.getElementById("clear-btn");
const randomBtn = document.getElementById("random-btn");
const speakBtn = document.getElementById("speak-btn");
const letterSelect = document.getElementById("letter-select");

const guideCtx = guideCanvas.getContext("2d");
const drawCtx = drawCanvas.getContext("2d");

const targetMaskCanvas = document.createElement("canvas");
const targetMaskCtx = targetMaskCanvas.getContext("2d", { willReadFrequently: true });
const userMaskCanvas = document.createElement("canvas");
const userMaskCtx = userMaskCanvas.getContext("2d", { willReadFrequently: true });

targetMaskCanvas.width = SCORE_SIZE;
targetMaskCanvas.height = SCORE_SIZE;
userMaskCanvas.width = SCORE_SIZE;
userMaskCanvas.height = SCORE_SIZE;

let canvasSize = 0;
let selectedColor = COLORS[0];
let currentLetterIndex = 0;
let activePointerId = null;
let drawing = false;
let lastPoint = null;
let completed = false;
let lastProgressCheck = 0;
let targetPixelCount = 1;
let targetFlags = new Uint8Array(SCORE_SIZE * SCORE_SIZE);

function fontFamily() {
  return '"Marker Felt", "Chalkboard SE", "Comic Sans MS", sans-serif';
}

function fitLetter(ctx, letter, side, widthRatio = 0.74, heightRatio = 0.8) {
  let size = side * 0.88;
  let metrics = null;
  let width = 0;
  let height = 0;

  for (let i = 0; i < 12; i += 1) {
    ctx.font = `900 ${size}px ${fontFamily()}`;
    metrics = ctx.measureText(letter);
    width =
      (metrics.actualBoundingBoxLeft ?? metrics.width * 0.5) +
      (metrics.actualBoundingBoxRight ?? metrics.width * 0.5);
    height =
      (metrics.actualBoundingBoxAscent ?? size * 0.75) + (metrics.actualBoundingBoxDescent ?? size * 0.25);

    if (width <= side * widthRatio && height <= side * heightRatio) {
      break;
    }
    size *= 0.92;
  }

  return { size, metrics };
}

function drawCenteredLetter(ctx, letter, side, drawMode = "fill") {
  const { size, metrics } = fitLetter(ctx, letter, side);
  ctx.font = `900 ${size}px ${fontFamily()}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const ascent = metrics.actualBoundingBoxAscent ?? size * 0.75;
  const descent = metrics.actualBoundingBoxDescent ?? size * 0.25;
  const y = side / 2 + (ascent - descent) / 2;

  if (drawMode === "fill") {
    ctx.fillText(letter, side / 2, y);
  } else {
    ctx.strokeText(letter, side / 2, y);
  }
}

function drawDecorations(ctx, letter, side) {
  const dots = ["#ff7f50", "#ffd166", "#70dd6f", "#53c7f2", "#a470ff", "#ff77ba"];
  const seed = letter.charCodeAt(0);

  for (let i = 0; i < 18; i += 1) {
    const t = Math.sin((seed + i * 17) * 12.9898) * 43758.5453;
    const f = t - Math.floor(t);
    const t2 = Math.sin((seed + i * 31) * 7.1234) * 35333.131;
    const f2 = t2 - Math.floor(t2);

    const x = side * (0.08 + f * 0.84);
    const y = side * (0.06 + f2 * 0.88);
    const radius = side * (0.012 + ((f + f2) % 0.024));

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = dots[i % dots.length];
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

function getBrushSize(side = canvasSize) {
  return Math.max(MIN_BRUSH_SIZE, side * BRUSH_SIZE_RATIO);
}

function getCurrentLetter() {
  return LETTERS[currentLetterIndex];
}

function clearUserMask() {
  userMaskCtx.fillStyle = "black";
  userMaskCtx.fillRect(0, 0, SCORE_SIZE, SCORE_SIZE);
}

function resetDrawing(message = "Start tracing!") {
  drawCtx.clearRect(0, 0, canvasSize, canvasSize);
  clearUserMask();
  hideCelebrate();
  completed = false;
  statusText.textContent = message;
}

function hideCelebrate() {
  celebrateEl.classList.remove("show");
}

function celebrateWin() {
  completed = true;
  const letter = getCurrentLetter();
  statusText.textContent = `Great job! You traced ${letter}!`;
  celebrateEl.textContent = `Great job! ${letter}`;
  celebrateEl.classList.add("show");
  speak(letter);
}

function setSelectedColor(color) {
  selectedColor = color;
  document.querySelectorAll(".swatch").forEach((swatch) => {
    swatch.classList.toggle("active", swatch.dataset.color === color);
  });
}

function createPalette() {
  COLORS.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.className = "swatch";
    swatch.type = "button";
    swatch.style.background = color;
    swatch.dataset.color = color;
    swatch.ariaLabel = `Use ${color} color`;
    swatch.addEventListener("click", () => setSelectedColor(color));
    colorPicker.appendChild(swatch);
  });

  setSelectedColor(selectedColor);
}

function createLetterSelector() {
  LETTERS.forEach((letter) => {
    const option = document.createElement("option");
    option.value = letter;
    option.textContent = letter;
    letterSelect.appendChild(option);
  });
}

function drawGuide() {
  const letter = getCurrentLetter();
  guideCtx.clearRect(0, 0, canvasSize, canvasSize);

  drawDecorations(guideCtx, letter, canvasSize);

  guideCtx.fillStyle = "rgba(255,255,255,0.6)";
  drawCenteredLetter(guideCtx, letter, canvasSize, "fill");

  guideCtx.strokeStyle = "rgba(50, 71, 103, 0.65)";
  guideCtx.lineWidth = Math.max(6, canvasSize * 0.012);
  guideCtx.lineJoin = "round";
  guideCtx.lineCap = "round";
  guideCtx.setLineDash([12, 10]);
  drawCenteredLetter(guideCtx, letter, canvasSize, "stroke");
  guideCtx.setLineDash([]);
}

function buildTargetMask() {
  const letter = getCurrentLetter();

  targetMaskCtx.fillStyle = "black";
  targetMaskCtx.fillRect(0, 0, SCORE_SIZE, SCORE_SIZE);
  targetMaskCtx.fillStyle = "white";
  drawCenteredLetter(targetMaskCtx, letter, SCORE_SIZE, "fill");

  const data = targetMaskCtx.getImageData(0, 0, SCORE_SIZE, SCORE_SIZE).data;
  targetFlags = new Uint8Array(SCORE_SIZE * SCORE_SIZE);
  targetPixelCount = 0;

  for (let i = 0; i < SCORE_SIZE * SCORE_SIZE; i += 1) {
    if (data[i * 4] > 20) {
      targetFlags[i] = 1;
      targetPixelCount += 1;
    }
  }
  targetPixelCount = Math.max(1, targetPixelCount);
}

function setupCanvases() {
  const rect = boardWrap.getBoundingClientRect();
  const newSize = Math.floor(Math.min(rect.width, rect.height));
  const dpr = window.devicePixelRatio || 1;

  if (!newSize || newSize === canvasSize) {
    return;
  }

  canvasSize = newSize;

  [guideCanvas, drawCanvas].forEach((canvas) => {
    canvas.width = Math.floor(canvasSize * dpr);
    canvas.height = Math.floor(canvasSize * dpr);
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;
  });

  guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawCtx.lineJoin = "round";
  drawCtx.lineCap = "round";

  drawGuide();
  buildTargetMask();
  resetDrawing("Start tracing!");
}

function getPointFromEvent(event) {
  const rect = drawCanvas.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  return { x, y };
}

function paintSegment(from, to) {
  if (!from || !to) {
    return;
  }

  const brush = getBrushSize();
  drawCtx.strokeStyle = selectedColor;
  drawCtx.lineWidth = brush;
  drawCtx.beginPath();
  drawCtx.moveTo(from.x, from.y);
  drawCtx.lineTo(to.x, to.y);
  drawCtx.stroke();

  const scale = SCORE_SIZE / canvasSize;
  userMaskCtx.strokeStyle = "white";
  userMaskCtx.lineCap = "round";
  userMaskCtx.lineJoin = "round";
  userMaskCtx.lineWidth = brush * scale;
  userMaskCtx.beginPath();
  userMaskCtx.moveTo(from.x * scale, from.y * scale);
  userMaskCtx.lineTo(to.x * scale, to.y * scale);
  userMaskCtx.stroke();
}

function evaluateCompletion() {
  if (completed) {
    return;
  }

  const userData = userMaskCtx.getImageData(0, 0, SCORE_SIZE, SCORE_SIZE).data;
  let coveredTargetPixels = 0;
  let userPixelCount = 0;

  for (let i = 0; i < SCORE_SIZE * SCORE_SIZE; i += 1) {
    const hasUserInk = userData[i * 4] > 10;
    if (!hasUserInk) {
      continue;
    }

    userPixelCount += 1;
    if (targetFlags[i]) {
      coveredTargetPixels += 1;
    }
  }

  const coverage = coveredTargetPixels / targetPixelCount;
  const accuracy = userPixelCount > 0 ? coveredTargetPixels / userPixelCount : 0;
  const closeToDone = coverage >= COMPLETION_COVERAGE_THRESHOLD * 0.75;
  statusText.textContent = closeToDone ? "Almost there!" : "Keep tracing!";

  const isComplete =
    coverage >= COMPLETION_COVERAGE_THRESHOLD && accuracy >= COMPLETION_ACCURACY_THRESHOLD;
  if (isComplete) {
    celebrateWin();
  }
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  event.preventDefault();

  drawCanvas.setPointerCapture(event.pointerId);
  drawing = true;
  activePointerId = event.pointerId;
  lastPoint = getPointFromEvent(event);
  paintSegment(lastPoint, lastPoint);
  evaluateCompletion();
}

function onPointerMove(event) {
  if (!drawing || event.pointerId !== activePointerId) {
    return;
  }

  event.preventDefault();
  const point = getPointFromEvent(event);
  paintSegment(lastPoint, point);
  lastPoint = point;

  const now = performance.now();
  if (now - lastProgressCheck > 85) {
    lastProgressCheck = now;
    evaluateCompletion();
  }
}

function onPointerUp(event) {
  if (event.pointerId !== activePointerId) {
    return;
  }

  drawing = false;
  activePointerId = null;
  lastPoint = null;
  evaluateCompletion();
}

function loadLetter(index) {
  currentLetterIndex = (index + LETTERS.length) % LETTERS.length;
  letterEl.textContent = getCurrentLetter();
  letterSelect.value = getCurrentLetter();
  drawGuide();
  buildTargetMask();
  resetDrawing("Start tracing!");
}

function randomLetter() {
  if (LETTERS.length < 2) {
    return;
  }

  let nextIndex = currentLetterIndex;
  while (nextIndex === currentLetterIndex) {
    nextIndex = Math.floor(Math.random() * LETTERS.length);
  }

  loadLetter(nextIndex);
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.75;
  utterance.pitch = 1.2;
  window.speechSynthesis.speak(utterance);
}

function speakCurrentLetter() {
  speak(getCurrentLetter());
}

function installEventHandlers() {
  clearBtn.addEventListener("click", () => resetDrawing("Try again!"));
  randomBtn.addEventListener("click", randomLetter);
  speakBtn.addEventListener("click", speakCurrentLetter);
  letterSelect.addEventListener("change", () => {
    const index = LETTERS.indexOf(letterSelect.value);
    if (index >= 0) {
      loadLetter(index);
    }
  });

  drawCanvas.addEventListener("pointerdown", onPointerDown);
  drawCanvas.addEventListener("pointermove", onPointerMove);
  drawCanvas.addEventListener("pointerup", onPointerUp);
  drawCanvas.addEventListener("pointercancel", onPointerUp);
  drawCanvas.addEventListener("pointerleave", onPointerUp);

  window.addEventListener("resize", setupCanvases);
  new ResizeObserver(setupCanvases).observe(boardWrap);
}

createPalette();
createLetterSelector();
installEventHandlers();
setupCanvases();
loadLetter(0);
