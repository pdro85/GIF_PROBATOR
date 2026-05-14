"use strict";

const state = {
  frames: [],
  current: 0,
  playIndex: 0,
  playing: false,
  lastTick: 0,
  timer: 0,
};

const els = {
  fileInput: document.getElementById("fileInput"),
  framesList: document.getElementById("framesList"),
  addBlankFrameBtn: document.getElementById("addBlankFrameBtn"),
  reverseBtn: document.getElementById("reverseBtn"),
  clearBtn: document.getElementById("clearBtn"),
  prevBtn: document.getElementById("prevBtn"),
  playBtn: document.getElementById("playBtn"),
  nextBtn: document.getElementById("nextBtn"),
  frameStatus: document.getElementById("frameStatus"),
  sizeStatus: document.getElementById("sizeStatus"),
  canvasWrap: document.getElementById("canvasWrap"),
  canvas: document.getElementById("previewCanvas"),
  fpsInput: document.getElementById("fpsInput"),
  loopSelect: document.getElementById("loopSelect"),
  pingpongInput: document.getElementById("pingpongInput"),
  widthInput: document.getElementById("widthInput"),
  heightInput: document.getElementById("heightInput"),
  fitSelect: document.getElementById("fitSelect"),
  pixelInput: document.getElementById("pixelInput"),
  bgSelect: document.getElementById("bgSelect"),
  gridInput: document.getElementById("gridInput"),
  ghostInput: document.getElementById("ghostInput"),
  drawModeInput: document.getElementById("drawModeInput"),
  brushColorInput: document.getElementById("brushColorInput"),
  brushSizeInput: document.getElementById("brushSizeInput"),
  eraserInput: document.getElementById("eraserInput"),
  exportBtn: document.getElementById("exportBtn"),
  downloadLink: document.getElementById("downloadLink"),
  exportStatus: document.getElementById("exportStatus"),
};

const ctx = els.canvas.getContext("2d", { willReadFrequently: true });
const drawState = {
  active: false,
  lastX: 0,
  lastY: 0,
};

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function getCanvasSize() {
  return {
    width: clampInt(els.widthInput.value, 1, 4096, 320),
    height: clampInt(els.heightInput.value, 1, 4096, 240),
  };
}

function getDefaultDelay() {
  const fps = clampInt(els.fpsInput.value, 1, 60, 12);
  return Math.round(1000 / fps);
}

function updateCanvasSize() {
  const { width, height } = getCanvasSize();
  els.canvas.width = width;
  els.canvas.height = height;
  els.canvas.style.imageRendering = els.pixelInput.checked ? "pixelated" : "auto";
}

function drawFrameImage(frame, alpha = 1) {
  if (!frame) return;
  const { width, height } = getCanvasSize();
  const img = frame.image;
  const fit = els.fitSelect.value;
  let dw = img.naturalWidth;
  let dh = img.naturalHeight;
  let dx = Math.round((width - dw) / 2);
  let dy = Math.round((height - dh) / 2);

  if (fit === "stretch") {
    dx = 0;
    dy = 0;
    dw = width;
    dh = height;
  } else if (fit === "contain" || fit === "cover") {
    const scale = fit === "cover"
      ? Math.max(width / img.naturalWidth, height / img.naturalHeight)
      : Math.min(width / img.naturalWidth, height / img.naturalHeight);
    dw = Math.round(img.naturalWidth * scale);
    dh = Math.round(img.naturalHeight * scale);
    dx = Math.round((width - dw) / 2);
    dy = Math.round((height - dh) / 2);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = !els.pixelInput.checked;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawGrid() {
  const { width, height } = getCanvasSize();
  const step = width <= 128 && height <= 128 ? 8 : 16;
  ctx.save();
  ctx.strokeStyle = "rgba(125, 211, 252, .22)";
  ctx.lineWidth = 1;
  for (let x = step; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + .5, 0);
    ctx.lineTo(x + .5, height);
    ctx.stroke();
  }
  for (let y = step; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + .5);
    ctx.lineTo(width, y + .5);
    ctx.stroke();
  }
  ctx.restore();
}

function renderPreview() {
  updateCanvasSize();
  const { width, height } = getCanvasSize();
  const bg = els.bgSelect.value;
  ctx.clearRect(0, 0, width, height);
  if (bg !== "transparent" && bg !== "checker") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  const currentFrame = state.frames[state.current];
  if (els.ghostInput.checked && state.frames.length > 1) {
    const prevIndex = (state.current - 1 + state.frames.length) % state.frames.length;
    drawFrameImage(state.frames[prevIndex], .28);
  }
  drawFrameImage(currentFrame, 1);
  if (els.gridInput.checked) drawGrid();
  updateUi();
}

function updateUi() {
  const hasFrames = state.frames.length > 0;
  const frame = state.frames[state.current];
  els.frameStatus.textContent = hasFrames
    ? `Frame ${state.current + 1} de ${state.frames.length}`
    : "Sin frames";
  els.sizeStatus.textContent = hasFrames
    ? `${frame.image.naturalWidth}x${frame.image.naturalHeight}px · ${frame.delay} ms`
    : "Carga varias imagenes para empezar";
  els.playBtn.textContent = state.playing ? "❚❚" : "▶";
  els.canvasWrap.classList.toggle("drawing", els.drawModeInput.checked && hasFrames);
  els.canvas.style.cursor = els.drawModeInput.checked && hasFrames ? "crosshair" : "default";
  els.prevBtn.disabled = !hasFrames;
  els.nextBtn.disabled = !hasFrames;
  els.playBtn.disabled = !hasFrames;
  els.exportBtn.disabled = !hasFrames;
  els.reverseBtn.disabled = state.frames.length < 2;
  els.clearBtn.disabled = !hasFrames;
  document.querySelectorAll(".frame-item").forEach((item, index) => {
    item.classList.toggle("active", index === state.current);
  });
}

function makeFrameElement(frame, index) {
  const item = document.createElement("div");
  item.className = "frame-item";
  item.draggable = true;
  item.dataset.index = index;

  const img = document.createElement("img");
  img.className = "frame-thumb";
  img.src = frame.url;
  img.alt = "";

  const meta = document.createElement("div");
  meta.className = "frame-meta";
  const name = document.createElement("div");
  name.className = "frame-name";
  name.textContent = frame.name;
  const delay = document.createElement("input");
  delay.type = "number";
  delay.min = "20";
  delay.max = "10000";
  delay.value = frame.delay;
  delay.title = "Duracion del frame en milisegundos";
  delay.addEventListener("input", () => {
    frame.delay = clampInt(delay.value, 20, 10000, getDefaultDelay());
    updateUi();
  });
  meta.append(name, delay);

  const actions = document.createElement("div");
  actions.className = "frame-actions";
  const up = document.createElement("button");
  up.type = "button";
  up.textContent = "↑";
  up.title = "Subir";
  up.addEventListener("click", () => moveFrame(index, index - 1));
  const down = document.createElement("button");
  down.type = "button";
  down.textContent = "↓";
  down.title = "Bajar";
  down.addEventListener("click", () => moveFrame(index, index + 1));
  const clone = document.createElement("button");
  clone.type = "button";
  clone.textContent = "+";
  clone.title = "Duplicar";
  clone.addEventListener("click", () => duplicateFrame(index));
  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "×";
  del.title = "Eliminar";
  del.addEventListener("click", () => removeFrame(index));
  actions.append(up, down, clone, del);

  item.addEventListener("click", event => {
    if (event.target.tagName !== "INPUT" && event.target.tagName !== "BUTTON") {
      state.current = index;
      renderPreview();
    }
  });
  item.addEventListener("dragstart", event => {
    event.dataTransfer.setData("text/plain", String(index));
  });
  item.addEventListener("dragover", event => event.preventDefault());
  item.addEventListener("drop", event => {
    event.preventDefault();
    moveFrame(Number(event.dataTransfer.getData("text/plain")), index);
  });

  item.append(img, meta, actions);
  return item;
}

function renderFramesList() {
  els.framesList.replaceChildren(...state.frames.map(makeFrameElement));
  updateUi();
}

function moveFrame(from, to) {
  if (to < 0 || to >= state.frames.length || from === to) return;
  const [frame] = state.frames.splice(from, 1);
  state.frames.splice(to, 0, frame);
  state.current = to;
  renderFramesList();
  renderPreview();
}

function duplicateFrame(index) {
  const frame = state.frames[index];
  cloneFrame(frame, `${frame.name} copia`).then(copy => {
    state.frames.splice(index + 1, 0, copy);
    state.current = index + 1;
    renderFramesList();
    renderPreview();
  });
}

function removeFrame(index) {
  const [frame] = state.frames.splice(index, 1);
  revokeFrameUrl(frame);
  state.current = Math.max(0, Math.min(state.current, state.frames.length - 1));
  renderFramesList();
  renderPreview();
}

function setCurrent(delta) {
  if (!state.frames.length) return;
  state.current = (state.current + delta + state.frames.length) % state.frames.length;
  renderPreview();
}

function getPlaybackFrames() {
  if (!els.pingpongInput.checked || state.frames.length < 3) return state.frames;
  return state.frames.concat(state.frames.slice(1, -1).reverse());
}

function tick(timestamp) {
  if (!state.playing || !state.frames.length) return;
  const frames = getPlaybackFrames();
  const frame = frames[state.playIndex % frames.length];
  const delay = frame?.delay ?? getDefaultDelay();
  if (!state.lastTick || timestamp - state.lastTick >= delay) {
    state.lastTick = timestamp;
    state.current = Math.max(0, state.frames.indexOf(frame));
    renderPreviewForFrame(frame);
    state.playIndex = (state.playIndex + 1) % frames.length;
  }
  state.timer = requestAnimationFrame(tick);
}

function renderPreviewForFrame(frame) {
  updateCanvasSize();
  const { width, height } = getCanvasSize();
  ctx.clearRect(0, 0, width, height);
  const bg = els.bgSelect.value;
  if (bg !== "transparent" && bg !== "checker") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }
  drawFrameImage(frame, 1);
  if (els.gridInput.checked) drawGrid();
  updateUi();
}

function togglePlayback() {
  if (!state.frames.length) return;
  state.playing = !state.playing;
  state.playIndex = state.current;
  state.lastTick = 0;
  updateUi();
  if (state.playing) state.timer = requestAnimationFrame(tick);
  else cancelAnimationFrame(state.timer);
}

async function loadFiles(files) {
  const imageFiles = [...files].filter(file => file.type.startsWith("image/"));
  const loaded = await Promise.all(imageFiles.map(file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({
      image,
      url,
      name: file.name,
      delay: getDefaultDelay(),
      objectUrl: true,
    });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`No se pudo cargar ${file.name}`));
    };
    image.src = url;
  })));

  if (!state.frames.length && loaded[0]) {
    els.widthInput.value = loaded[0].image.naturalWidth;
    els.heightInput.value = loaded[0].image.naturalHeight;
  }
  state.frames.push(...loaded);
  renderFramesList();
  renderPreview();
}

function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo crear el frame"));
    image.src = url;
  });
}

async function createFrameFromCanvas(canvas, name, delay = getDefaultDelay()) {
  const url = canvas.toDataURL("image/png");
  const image = await loadImageFromUrl(url);
  return {
    image,
    url,
    name,
    delay,
    objectUrl: false,
  };
}

async function cloneFrame(frame, name = frame.name) {
  const canvas = document.createElement("canvas");
  canvas.width = frame.image.naturalWidth;
  canvas.height = frame.image.naturalHeight;
  const cloneCtx = canvas.getContext("2d");
  cloneCtx.drawImage(frame.image, 0, 0);
  return createFrameFromCanvas(canvas, name, frame.delay);
}

async function addBlankFrame() {
  const { width, height } = getCanvasSize();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const frame = await createFrameFromCanvas(canvas, `Dibujo ${state.frames.length + 1}`);
  state.frames.push(frame);
  state.current = state.frames.length - 1;
  renderFramesList();
  renderPreview();
}

function syncAllDelays() {
  const delay = getDefaultDelay();
  state.frames.forEach(frame => {
    frame.delay = delay;
  });
  renderFramesList();
  renderPreview();
}

function clearFrames() {
  state.frames.forEach(revokeFrameUrl);
  state.frames = [];
  state.current = 0;
  state.playIndex = 0;
  state.playing = false;
  renderFramesList();
  renderPreview();
}

function revokeFrameUrl(frame) {
  const stillUsed = state.frames.some(item => item !== frame && item.url === frame.url);
  if (frame.objectUrl && !stillUsed) URL.revokeObjectURL(frame.url);
}

function getCanvasPoint(event) {
  const rect = els.canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * els.canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * els.canvas.height,
  };
}

function prepareFrameForDrawing() {
  updateCanvasSize();
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  drawFrameImage(state.frames[state.current], 1);
}

function strokeTo(x, y) {
  const size = clampInt(els.brushSizeInput.value, 1, 96, 8);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = size;
  ctx.globalCompositeOperation = els.eraserInput.checked ? "destination-out" : "source-over";
  ctx.strokeStyle = els.brushColorInput.value;
  ctx.beginPath();
  ctx.moveTo(drawState.lastX, drawState.lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.restore();
  drawState.lastX = x;
  drawState.lastY = y;
}

async function commitDrawingToFrame() {
  if (!state.frames.length) return;
  const index = state.current;
  const currentFrame = state.frames[index];
  const updated = await createFrameFromCanvas(els.canvas, currentFrame.name, currentFrame.delay);
  state.frames[index] = updated;
  state.current = index;
  revokeFrameUrl(currentFrame);
  renderFramesList();
  renderPreview();
}

function startDrawing(event) {
  if (!els.drawModeInput.checked || !state.frames.length || state.playing) return;
  event.preventDefault();
  els.canvas.setPointerCapture(event.pointerId);
  prepareFrameForDrawing();
  const point = getCanvasPoint(event);
  drawState.active = true;
  drawState.lastX = point.x;
  drawState.lastY = point.y;
  strokeTo(point.x, point.y);
}

function draw(event) {
  if (!drawState.active) return;
  event.preventDefault();
  const point = getCanvasPoint(event);
  strokeTo(point.x, point.y);
}

function stopDrawing(event) {
  if (!drawState.active) return;
  event.preventDefault();
  drawState.active = false;
  if (els.canvas.hasPointerCapture(event.pointerId)) {
    els.canvas.releasePointerCapture(event.pointerId);
  }
  commitDrawingToFrame();
}

function createExportFrames() {
  const frames = getPlaybackFrames();
  return frames.map(frame => {
    renderPreviewForFrame(frame);
    return {
      delay: frame.delay,
      imageData: ctx.getImageData(0, 0, els.canvas.width, els.canvas.height),
    };
  });
}

function paletteIndexForPixel(data, offset) {
  const alpha = data[offset + 3];
  if (alpha < 128) return 0;
  const r = data[offset] >> 5;
  const g = data[offset + 1] >> 5;
  const b = data[offset + 2] >> 6;
  return 1 + (r << 5) + (g << 2) + b;
}

function makeFixedPalette() {
  const palette = [[0, 0, 0]];
  for (let r = 0; r < 8; r += 1) {
    for (let g = 0; g < 8; g += 1) {
      for (let b = 0; b < 4; b += 1) {
        if (palette.length >= 256) break;
        palette.push([
          Math.round((r / 7) * 255),
          Math.round((g / 7) * 255),
          Math.round((b / 3) * 255),
        ]);
      }
    }
  }
  return palette.slice(0, 256);
}

function bytesFromString(text) {
  return [...text].map(char => char.charCodeAt(0));
}

function writeShort(bytes, value) {
  bytes.push(value & 255, (value >> 8) & 255);
}

class BitWriter {
  constructor() {
    this.bytes = [];
    this.current = 0;
    this.bits = 0;
  }

  write(value, size) {
    let remaining = size;
    let code = value;
    while (remaining > 0) {
      this.current |= (code & 1) << this.bits;
      code >>= 1;
      this.bits += 1;
      remaining -= 1;
      if (this.bits === 8) {
        this.bytes.push(this.current);
        this.current = 0;
        this.bits = 0;
      }
    }
  }

  finish() {
    if (this.bits > 0) this.bytes.push(this.current);
    return this.bytes;
  }
}

function lzwEncode(indices, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;
  let dictionary = new Map();
  const writer = new BitWriter();

  function resetDictionary() {
    dictionary = new Map();
    for (let i = 0; i < clearCode; i += 1) dictionary.set(String(i), i);
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  }

  resetDictionary();
  writer.write(clearCode, codeSize);
  let phrase = String(indices[0] ?? 0);

  for (let i = 1; i < indices.length; i += 1) {
    const value = indices[i];
    const combo = `${phrase},${value}`;
    if (dictionary.has(combo)) {
      phrase = combo;
      continue;
    }

    writer.write(dictionary.get(phrase), codeSize);
    if (nextCode < 4096) {
      dictionary.set(combo, nextCode);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    } else {
      writer.write(clearCode, codeSize);
      resetDictionary();
    }
    phrase = String(value);
  }

  writer.write(dictionary.get(phrase), codeSize);
  writer.write(endCode, codeSize);
  return writer.finish();
}

function writeSubBlocks(bytes, data) {
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255);
    bytes.push(chunk.length, ...chunk);
  }
  bytes.push(0);
}

function encodeGif(frames, width, height, loopCount) {
  const bytes = bytesFromString("GIF89a");
  writeShort(bytes, width);
  writeShort(bytes, height);
  bytes.push(0xf7, 0, 0);
  makeFixedPalette().forEach(color => bytes.push(...color));

  bytes.push(0x21, 0xff, 0x0b, ...bytesFromString("NETSCAPE2.0"), 0x03, 0x01);
  writeShort(bytes, loopCount);
  bytes.push(0);

  frames.forEach(frame => {
    const delayCs = Math.max(2, Math.round(frame.delay / 10));
    bytes.push(0x21, 0xf9, 0x04, 0x09);
    writeShort(bytes, delayCs);
    bytes.push(0, 0);

    bytes.push(0x2c);
    writeShort(bytes, 0);
    writeShort(bytes, 0);
    writeShort(bytes, width);
    writeShort(bytes, height);
    bytes.push(0);

    const data = frame.imageData.data;
    const indices = new Uint8Array(width * height);
    for (let i = 0, offset = 0; offset < data.length; i += 1, offset += 4) {
      indices[i] = paletteIndexForPixel(data, offset);
    }
    bytes.push(8);
    writeSubBlocks(bytes, lzwEncode(indices, 8));
  });

  bytes.push(0x3b);
  return new Blob([new Uint8Array(bytes)], { type: "image/gif" });
}

async function exportGif() {
  if (!state.frames.length) return;
  els.exportBtn.disabled = true;
  els.exportStatus.textContent = "Generando GIF...";
  els.downloadLink.classList.remove("ready");
  await new Promise(resolve => setTimeout(resolve, 20));

  try {
    const { width, height } = getCanvasSize();
    const frames = createExportFrames();
    const loopCount = clampInt(els.loopSelect.value, 0, 65535, 0);
    const blob = encodeGif(frames, width, height, loopCount);
    const oldUrl = els.downloadLink.href;
    if (oldUrl.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
    els.downloadLink.href = URL.createObjectURL(blob);
    els.downloadLink.classList.add("ready");
    els.exportStatus.textContent = `${frames.length} frames · ${(blob.size / 1024).toFixed(1)} KB`;
  } catch (error) {
    els.exportStatus.innerHTML = `<span class="danger">${error.message}</span>`;
  } finally {
    els.exportBtn.disabled = false;
    renderPreview();
  }
}

els.fileInput.addEventListener("change", event => loadFiles(event.target.files));
els.addBlankFrameBtn.addEventListener("click", addBlankFrame);
els.reverseBtn.addEventListener("click", () => {
  state.frames.reverse();
  state.current = 0;
  renderFramesList();
  renderPreview();
});
els.clearBtn.addEventListener("click", clearFrames);
els.prevBtn.addEventListener("click", () => setCurrent(-1));
els.nextBtn.addEventListener("click", () => setCurrent(1));
els.playBtn.addEventListener("click", togglePlayback);
els.fpsInput.addEventListener("change", syncAllDelays);
els.exportBtn.addEventListener("click", exportGif);
els.drawModeInput.addEventListener("input", updateUi);

els.canvas.addEventListener("pointerdown", startDrawing);
els.canvas.addEventListener("pointermove", draw);
els.canvas.addEventListener("pointerup", stopDrawing);
els.canvas.addEventListener("pointercancel", stopDrawing);

[els.widthInput, els.heightInput, els.fitSelect, els.pixelInput, els.bgSelect, els.gridInput, els.ghostInput]
  .forEach(input => input.addEventListener("input", renderPreview));

["dragenter", "dragover"].forEach(type => {
  els.canvasWrap.addEventListener(type, event => {
    event.preventDefault();
    els.canvasWrap.style.borderColor = "var(--focus)";
  });
});

["dragleave", "drop"].forEach(type => {
  els.canvasWrap.addEventListener(type, event => {
    event.preventDefault();
    els.canvasWrap.style.borderColor = "var(--line)";
  });
});

els.canvasWrap.addEventListener("drop", event => loadFiles(event.dataTransfer.files));

renderPreview();
