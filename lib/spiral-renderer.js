/** Continuous horizontal curves, modulated into true elliptical coils by a mask. */
const TAU = Math.PI * 2;
const DESIGN_SIZE = 1000;
const MASK_SIZE = 512;
const CYCLE = 12;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const HAND = `M 434 850
 C 425 812 393 783 358 744
 L 243 597 C 219 565 211 535 227 516
 C 242 496 266 503 287 526 L 338 581
 L 315 264 C 314 235 325 212 349 211
 C 373 210 388 230 389 258 L 394 451
 L 414 191 C 414 160 429 143 453 143
 C 477 143 491 161 491 191 L 495 447
 L 515 218 C 516 190 531 174 553 176
 C 576 178 589 196 589 224 L 593 469
 L 611 322 C 613 296 627 280 648 281
 C 671 282 686 303 685 330 L 679 614
 C 677 700 627 741 622 786 L 621 850 Z`;
const LEAF = `M500 714 C422 694 290 606 211 513
 C173 467 161 423 182 383 C197 351 223 336 250 342
 C267 304 290 282 320 296 C338 261 360 247 390 261
 C424 229 459 233 483 267 L500 305 L517 267
 C541 233 576 229 610 261 C640 247 662 261 680 296
 C710 282 733 304 750 342 C777 336 803 351 818 383
 C839 423 827 467 789 513 C710 606 578 694 500 714 Z`;
const BUTTERFLY = `M485 505 C423 389 313 211 205 252
 C137 279 168 438 255 507 C320 552 424 568 485 505 Z
 M515 505 C577 389 687 211 795 252
 C863 279 832 438 745 507 C680 552 576 568 515 505 Z
 M480 530 C410 543 326 528 284 590
 C243 657 280 767 355 768 C411 770 463 664 490 567 Z
 M520 530 C590 543 674 528 716 590
 C757 657 720 767 645 768 C589 770 537 664 510 567 Z
 M492 409 C477 455 481 614 500 661 C519 614 523 455 508 409 Z`;
const PRESETS = ['hand', 'orb', 'type', 'leaf', 'butterfly'];

export class SpiralRenderer {
  constructor(canvas, { onFrame } = {}) {
    if (!canvas || !canvas.getContext) throw new TypeError('A canvas is required.');
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.onFrame = onFrame;
    this.settings = {
      rows: 32, amplitude: 1, frequency: 1, speed: 0.65,
      stroke: 1.1, color: '#e8ed94', background: '#0b0c0a',
      mask: 'hand', contrast: 1, invert: false, text: 'S', motion: true,
      style: 'spiral', interaction: 'repel', pointerStrength: 1,
    };
    this.playing = true;
    this.time = 0;
    this.fps = 60;
    this._frame = 0;
    this._last = 0;
    this._lastNotify = 0;
    this._source = null;
    this._sourceTime = -1;
    this._sourceDirty = false;
    this._sourceBounds = null;
    this._sourceUsesAlpha = false;
    this._dead = false;
    this._pointer = { x: 500, y: 500, targetX: 500, targetY: 500, strength: 0, target: 0, inside: false };
    this._mask = document.createElement('canvas');
    this._mask.width = this._mask.height = MASK_SIZE;
    this._maskCtx = this._mask.getContext('2d', { willReadFrequently: true });
    this._pixels = new Uint8ClampedArray(MASK_SIZE * MASK_SIZE * 4);
    this._tick = this._tick.bind(this);
    this._onSourceReady = () => {
      if (this._dead || !this._isVideo()) return;
      this._sourceDirty = true;
      this.time = (this._source.currentTime || 0) % CYCLE;
      if (!document.hidden) this.renderOnce();
    };
    this._onVisibility = () => {
      cancelAnimationFrame(this._frame);
      this._frame = 0;
      this._last = 0;
      this._syncSourcePlayback();
      if (!document.hidden) this._start();
    };
    document.addEventListener('visibilitychange', this._onVisibility);
    this._observer = new ResizeObserver(() => this._resize());
    this._observer.observe(canvas);
    this._buildPreset();
    this._resize();
    this._start();
  }

  update(patch = {}) {
    const previous = this.settings;
    const next = { ...previous, ...patch };
    for (const [key, lo, hi] of [
      ['rows', 12, 80], ['amplitude', 0, 2.5], ['frequency', 0.3, 2.5],
      ['speed', 0, 3], ['stroke', 0.3, 3], ['contrast', 0.2, 3],
      ['pointerStrength', 0, 2],
    ]) {
      next[key] = Number.isFinite(Number(next[key]))
        ? clamp(Number(next[key]), lo, hi) : previous[key];
    }
    next.rows = Math.round(next.rows);
    if (next.speed > 0) next.speed = Math.max(0.1, next.speed);
    for (const key of ['color', 'background']) {
      if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(next[key])) next[key] = previous[key];
    }
    if (![...PRESETS, 'custom'].includes(next.mask)) next.mask = previous.mask;
    if (!['spiral', 'wave', 'dots', 'dashes'].includes(next.style)) next.style = previous.style;
    if (!['repel', 'attract', 'off'].includes(next.interaction)) next.interaction = previous.interaction;
    this.settings = next;
    this._pointer.target = this._pointer.inside && next.interaction !== 'off' ? 1 : 0;
    if (next.mask !== previous.mask || next.text !== previous.text) {
      if (next.mask !== 'custom') {
        this._releaseSource();
        this._buildPreset();
      }
    }
    this._syncSourcePlayback();
    this.renderOnce();
    this._start();
    return this;
  }

  setPlaying(playing) {
    this.playing = Boolean(playing);
    this._last = 0;
    cancelAnimationFrame(this._frame);
    this._frame = 0;
    this._syncSourcePlayback();
    this._start();
    this._notify(true);
    return this;
  }

  setMask(name) {
    if (!PRESETS.includes(name)) return this;
    this._releaseSource();
    this.settings.mask = name;
    this._buildPreset();
    this.renderOnce();
    return this;
  }

  setImage(source) {
    if (!source) return this.clearImage();
    this._releaseSource();
    this._source = source;
    this._sourceDirty = true;
    this._sourceTime = -1;
    this.settings.mask = 'custom';
    if (this._isVideo()) {
      source.muted = true;
      source.loop = true;
      source.playsInline = true;
      for (const event of ['loadeddata', 'seeked', 'durationchange']) {
        source.addEventListener(event, this._onSourceReady);
      }
      this.time = (source.currentTime || 0) % CYCLE;
    }
    this._readSource();
    this._syncSourcePlayback();
    this.renderOnce();
    return this;
  }

  clearImage() { return this.setMask('hand'); }

  setPointer(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const side = Math.min(rect.width, rect.height);
    if (!side || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return this;
    const x = (clientX - rect.left - (rect.width - side) / 2) / side * DESIGN_SIZE;
    const y = (clientY - rect.top - (rect.height - side) / 2) / side * DESIGN_SIZE;
    if (x < 0 || x > DESIGN_SIZE || y < 0 || y > DESIGN_SIZE) return this.clearPointer();
    const p = this._pointer;
    if (!p.inside && p.strength < 0.002) { p.x = x; p.y = y; }
    p.targetX = x; p.targetY = y; p.inside = true;
    p.target = this.settings.interaction === 'off' ? 0 : 1;
    if (!this._frame && !this.playing) this._last = 0;
    this._start();
    return this;
  }

  clearPointer() {
    this._pointer.inside = false;
    this._pointer.target = 0;
    if (!this._frame && !this.playing) this._last = 0;
    this._start();
    return this;
  }

  resetTime() { return this.seek(0); }

  seek(seconds) {
    const requested = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
    this._last = 0;
    if (this._isVideo() && Number.isFinite(this._source.duration)
      && this._source.duration > 0) {
      const position = clamp(requested, 0, this._source.duration);
      this.time = position % CYCLE;
      this._source.currentTime = position;
      this._sourceDirty = true;
    } else {
      this.time = ((requested % CYCLE) + CYCLE) % CYCLE;
    }
    this.renderOnce();
    return this;
  }

  getTime() {
    return this._isVideo() && Number.isFinite(this._source.currentTime)
      ? this._source.currentTime : this.time;
  }

  getStats() {
    return {
      time: this.getTime(), duration: this._getDuration(), fps: Math.round(this.fps),
      rows: this.settings.rows, points: this._points || 0,
      playing: this.playing, mask: this.settings.mask,
      style: this.settings.style, pointerActive: this._pointer.strength > 0.002,
    };
  }

  renderOnce() {
    if (this._dead) return;
    this._readSource();
    this._draw(this.ctx, this.canvas.width, this.canvas.height);
    this._notify(true);
  }

  async exportPNG(size = 2400) {
    const edge = Math.round(clamp(Number(size) || 2400, 128, 8192));
    const output = document.createElement('canvas');
    output.width = output.height = edge;
    this._readSource();
    this._draw(output.getContext('2d', { alpha: false }), edge, edge, true);
    return new Promise((resolve, reject) => output.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png',
    ));
  }

  exportSVG(size = 1600) {
    const edge = Math.round(clamp(Number(size) || 1600, 128, 8192));
    const paths = [];
    this._readSource();
    this._eachPrimitive(true, primitive => {
      const { points, opacity = 1 } = primitive;
      if (primitive.type === 'circle') {
        paths.push(`<circle cx="${points[0].toFixed(2)}" cy="${points[1].toFixed(2)}" r="${primitive.radius.toFixed(2)}" fill="${this.settings.color}" stroke="none" opacity="${opacity.toFixed(3)}"/>`);
        return;
      }
      const commands = [];
      for (let i = 0; i < points.length; i += 2) {
        commands.push(`${i === 0 ? 'M' : 'L'}${points[i].toFixed(2)} ${points[i + 1].toFixed(2)}`);
      }
      paths.push(`<path d="${commands.join('')}" opacity="${opacity.toFixed(3)}"/>`);
    });
    const { color, background, stroke } = this.settings;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${edge}" height="${edge}" viewBox="0 0 1000 1000"><title>Procedural image</title><rect width="1000" height="1000" fill="${background}"/><g fill="none" stroke="${color}" stroke-width="${stroke}" fill-opacity=".88" stroke-opacity=".88" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g></svg>`;
  }

  destroy() {
    this._dead = true;
    cancelAnimationFrame(this._frame);
    this._observer.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._releaseSource();
  }

  _start() {
    if (!this._dead && !document.hidden && !this._frame && (this.playing || this._pointerNeedsFrame())) {
      this._frame = requestAnimationFrame(this._tick);
    }
  }

  _tick(now) {
    this._frame = 0;
    if (this._dead || document.hidden || (!this.playing && !this._pointerNeedsFrame())) return;
    const elapsed = this._last ? (now - this._last) / 1000 : 0;
    const delta = Math.min(elapsed, 0.08);
    if (elapsed > 0) this.fps += (1 / elapsed - this.fps) * 0.06;
    this._last = now;
    if (this.playing) {
      this.time = this._isVideo()
        ? this.getTime() % CYCLE
        : (this.time + delta * this.settings.speed) % CYCLE;
    }
    this._advancePointer(delta || 1 / 60);
    this._readSource();
    this._draw(this.ctx, this.canvas.width, this.canvas.height);
    this._notify();
    this._start();
  }

  _pointerNeedsFrame() {
    const p = this._pointer;
    return Math.abs(p.strength - p.target) > 0.001
      || ((p.strength > 0.001 || p.target > 0)
        && (Math.abs(p.x - p.targetX) > 0.2 || Math.abs(p.y - p.targetY) > 0.2));
  }

  _advancePointer(delta) {
    const p = this._pointer;
    const ease = 1 - Math.exp(-delta * 14);
    p.x += (p.targetX - p.x) * ease;
    p.y += (p.targetY - p.y) * ease;
    p.strength += (p.target - p.strength) * ease;
    if (Math.abs(p.strength - p.target) <= 0.001) p.strength = p.target;
    if (Math.abs(p.x - p.targetX) <= 0.2) p.x = p.targetX;
    if (Math.abs(p.y - p.targetY) <= 0.2) p.y = p.targetY;
  }

  _hasPointer() {
    return this._pointer.strength > 0 && this.settings.pointerStrength > 0
      && this.settings.interaction !== 'off';
  }

  _nearPointer(x, y) {
    return this._hasPointer()
      && (x - this._pointer.x) ** 2 + (y - this._pointer.y) ** 2 < 160 ** 2;
  }

  _warpPoint(points, offset = 0) {
    if (!this._hasPointer()) return;
    const dx = points[offset] - this._pointer.x;
    const dy = points[offset + 1] - this._pointer.y;
    const q = Math.sqrt(dx * dx + dy * dy) / 160;
    if (q >= 1) return;
    const influence = (1 - q) ** 2 * this._pointer.strength * this.settings.pointerStrength;
    const amount = this.settings.interaction === 'attract'
      ? -Math.min(0.92, influence * 0.95) : influence * 1.9;
    points[offset] += dx * amount;
    points[offset + 1] += dy * amount;
  }

  _notify(force = false) {
    const now = performance.now();
    if (this.onFrame && (force || now - this._lastNotify > 120)) {
      this._lastNotify = now;
      this.onFrame(this.getStats());
    }
  }

  _resize() {
    if (this._dead) return;
    const bounds = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.renderOnce();
  }

  _buildPreset() {
    const ctx = this._maskCtx;
    ctx.resetTransform();
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    ctx.save();
    ctx.scale(MASK_SIZE / DESIGN_SIZE, MASK_SIZE / DESIGN_SIZE);
    ctx.filter = 'blur(2.7px)';
    if (this.settings.mask === 'hand') {
      ctx.translate(-50, 0);
      ctx.scale(1.1, 1);
      ctx.fillStyle = '#fff';
      ctx.fill(new Path2D(HAND));
    } else if (this.settings.mask === 'orb') {
      const sphere = ctx.createRadialGradient(425, 385, 35, 500, 500, 312);
      sphere.addColorStop(0, '#fff');
      sphere.addColorStop(0.5, '#f2f2f2');
      sphere.addColorStop(0.85, '#aaa');
      sphere.addColorStop(0.97, '#777');
      sphere.addColorStop(1, '#000');
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(500, 500, 312, 0, TAU);
      ctx.fill();
    } else if (this.settings.mask === 'leaf' || this.settings.mask === 'butterfly') {
      const leaf = this.settings.mask === 'leaf';
      const fill = ctx.createLinearGradient(260, 220, 700, 800);
      fill.addColorStop(0, '#fff');
      fill.addColorStop(0.7, '#eee');
      fill.addColorStop(1, '#aaa');
      ctx.fillStyle = fill;
      ctx.fill(new Path2D(leaf ? LEAF : BUTTERFLY));
      ctx.strokeStyle = '#f7f7f7';
      ctx.lineWidth = leaf ? 19 : 10;
      ctx.lineCap = 'round';
      ctx.stroke(new Path2D(leaf
        ? 'M500 698 Q514 776 494 850'
        : 'M494 429 Q476 365 433 336 M506 429 Q524 365 567 336'));
    } else {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 780px Georgia, "Times New Roman", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(this.settings.text || 'S').slice(0, 3), 500, 520, 650);
    }
    ctx.restore();
    this._capturePixels();
  }

  _isVideo() { return this._source?.tagName === 'VIDEO'; }

  _getDuration() {
    return this._isVideo() && Number.isFinite(this._source.duration)
      && this._source.duration > 0 ? this._source.duration : CYCLE;
  }

  _syncSourcePlayback() {
    if (!this._isVideo()) return;
    const source = this._source;
    source.muted = true;
    const speed = this.settings.speed;
    if (speed > 0) source.playbackRate = clamp(speed, 0.1, 3);
    if (this.playing && !document.hidden && speed > 0) {
      if (source.paused) source.play().catch(() => {});
    } else {
      source.pause();
    }
  }

  _releaseSource() {
    if (this._isVideo()) {
      this._source.pause();
      for (const event of ['loadeddata', 'seeked', 'durationchange']) {
        this._source.removeEventListener(event, this._onSourceReady);
      }
    }
    this._source = null;
    this._sourceBounds = null;
    this._sourceUsesAlpha = false;
  }

  _readSource() {
    if (!this._source) return;
    const isVideo = this._isVideo();
    if (isVideo && this._source.readyState < 2) return;
    if (isVideo) this.time = this.getTime() % CYCLE;
    if (!this._sourceDirty && (!isVideo || this._source.currentTime === this._sourceTime)) return;
    const width = this._source.videoWidth || this._source.naturalWidth || this._source.width;
    const height = this._source.videoHeight || this._source.naturalHeight || this._source.height;
    if (!width || !height) return;
    const ctx = this._maskCtx;
    ctx.resetTransform();
    ctx.filter = 'none';
    // Keep a still image's original alpha until its mask channel is selected.
    ctx.clearRect(0, 0, MASK_SIZE, MASK_SIZE);
    if (isVideo) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
    }
    const scale = Math.min(MASK_SIZE * 0.8 / width, MASK_SIZE * 0.8 / height);
    const w = width * scale;
    const h = height * scale;
    const x = (MASK_SIZE - w) / 2;
    const y = (MASK_SIZE - h) / 2;
    const toDesign = DESIGN_SIZE / MASK_SIZE;
    this._sourceBounds = {
      left: x * toDesign, top: y * toDesign,
      right: (x + w) * toDesign, bottom: (y + h) * toDesign,
    };
    ctx.drawImage(this._source, x, y, w, h);
    this._capturePixels(isVideo ? null : { left: x, top: y, right: x + w, bottom: y + h });
    this._sourceDirty = false;
    this._sourceTime = isVideo ? this._source.currentTime : -1;
  }

  _capturePixels(alphaBounds = null) {
    this._pixels = this._maskCtx.getImageData(0, 0, MASK_SIZE, MASK_SIZE).data;
    let useAlpha = false;
    if (alphaBounds) {
      // Inspect only the source rectangle; letterbox transparency is not image data.
      const left = clamp(Math.ceil(alphaBounds.left), 0, MASK_SIZE);
      const right = clamp(Math.floor(alphaBounds.right), 0, MASK_SIZE);
      const top = clamp(Math.ceil(alphaBounds.top), 0, MASK_SIZE);
      const bottom = clamp(Math.floor(alphaBounds.bottom), 0, MASK_SIZE);
      let count = 0, translucent = 0, missingAlpha = 0;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const alpha = this._pixels[(y * MASK_SIZE + x) * 4 + 3];
          count++;
          if (alpha < 250) translucent++;
          missingAlpha += 255 - alpha;
        }
      }
      // Tiny antialias borders stay on luminance; transparent logos use coverage.
      useAlpha = count > 0 && translucent / count >= 0.02
        && missingAlpha / (255 * count) >= 0.01;
    }
    this._sourceUsesAlpha = useAlpha;
    for (let i = 0; i < this._pixels.length; i += 4) {
      const alpha = this._pixels[i + 3];
      this._pixels[i] = useAlpha ? alpha : Math.round((this._pixels[i] * 0.2126
        + this._pixels[i + 1] * 0.7152 + this._pixels[i + 2] * 0.0722) * alpha / 255);
    }
  }

  _sample(x, y) {
    const bounds = this._sourceBounds;
    if (this.settings.mask === 'custom' && bounds
      && (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom)) {
      return 0;
    }
    const px = x * (MASK_SIZE - 1) / DESIGN_SIZE;
    const py = y * (MASK_SIZE - 1) / DESIGN_SIZE;
    if (px < 0 || py < 0 || px >= MASK_SIZE - 1 || py >= MASK_SIZE - 1) return 0;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const fx = px - ix;
    const fy = py - iy;
    const idx = (iy * MASK_SIZE + ix) * 4;
    const p = this._pixels;
    const top = p[idx] * (1 - fx) + p[idx + 4] * fx;
    const bottom = p[idx + MASK_SIZE * 4] * (1 - fx) + p[idx + MASK_SIZE * 4 + 4] * fx;
    let intensity = (top * (1 - fy) + bottom * fy) / 255;
    if (this.settings.invert) intensity = 1 - intensity;
    return clamp((intensity - 0.5) * this.settings.contrast + 0.5, 0, 1);
  }

  _eachLine(highQuality, callback) {
    const { rows, amplitude, frequency, motion, mask, style } = this.settings;
    const wave = style === 'wave';
    const pitch = (wave ? 36 : 14) / frequency;
    const step = pitch / (highQuality ? 24 : 16);
    const spacing = 780 / Math.max(1, rows - 1);
    const radiusX = wave ? 0 : pitch * 0.49 * amplitude;
    const radiusY = Math.min(wave ? 22 : 12.5, spacing * (wave ? 0.65 : 0.4)) * amplitude;
    const cyclePhase = this.time / CYCLE * TAU;
    const animated = motion && mask !== 'custom';
    const angle = animated ? Math.sin(cyclePhase) * 0.022 : 0;
    const shiftX = animated ? Math.sin(cyclePhase) * 9 : 0;
    const shiftY = animated ? Math.cos(cyclePhase) * 3 : 0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const wavePhase = cyclePhase * 12;
    const samples = Math.ceil(820 / step);
    let table = this._lineTable;
    if (!table || table.samples !== samples || table.pitch !== pitch) {
      const x = new Float64Array(samples + 1);
      const edge = new Float64Array(samples + 1);
      const cos = new Float64Array(samples + 1);
      const sin = new Float64Array(samples + 1);
      for (let i = 0; i <= samples; i++) {
        x[i] = 90 + 820 * i / samples;
        edge[i] = clamp(Math.min(x[i] - 90, 910 - x[i]) / 20, 0, 1);
        const phase = (x[i] - 90) / pitch * TAU;
        cos[i] = Math.cos(phase);
        sin[i] = Math.sin(phase);
      }
      table = this._lineTable = { samples, pitch, x, edge, cos, sin };
    }
    const flatTolerance = highQuality ? 0 : 0.000001;
    const pointerActive = this._hasPointer();
    let count = 0;
    for (let row = 0; row < rows; row++) {
      const y = 110 + row * spacing;
      const points = [];
      if (amplitude === 0 && !pointerActive) {
        callback([90, y, 910, y], row);
        count += 2;
        continue;
      }
      const dy = y - 580 - shiftY;
      const offsetX = sinA * dy + 500 - cosA * (500 + shiftX);
      const offsetY = cosA * dy + 580 + sinA * (500 + shiftX);
      const cosRow = Math.cos(row * 0.21 - wavePhase);
      const sinRow = Math.sin(row * 0.21 - wavePhase);
      let flatFirst = null;
      let flatLast = null;
      for (let i = 0; i <= samples; i++) {
        const x = table.x[i];
        let value = amplitude === 0 ? 0 : this._sample(cosA * x + offsetX, -sinA * x + offsetY);
        // Ease the joins to a horizontal line at low mask values.
        value = value * value * (3 - 2 * value) * table.edge[i];
        if (value <= flatTolerance && (!pointerActive || !this._nearPointer(x, y))) {
          if (flatFirst === null) {
            points.push(x, y);
            flatFirst = x;
          }
          flatLast = x;
          continue;
        }
        // Retain both boundaries of a flat run, without its interior vertices.
        if (flatFirst !== null) {
          if (flatLast !== flatFirst) points.push(flatLast, y);
          flatFirst = flatLast = null;
        }
        const cosPhase = table.cos[i] * cosRow - table.sin[i] * sinRow;
        const sinPhase = table.sin[i] * cosRow + table.cos[i] * sinRow;
        points.push(x + cosPhase * radiusX * value, y + sinPhase * radiusY * value);
        if (pointerActive) this._warpPoint(points, points.length - 2);
      }
      if (flatFirst !== null && flatLast !== flatFirst) points.push(flatLast, y);
      count += points.length / 2;
      callback(points, row);
    }
    this._points = count;
  }

  _eachPrimitive(highQuality, callback) {
    if (this.settings.style === 'dots' || this.settings.style === 'dashes') {
      this._eachMark(callback);
    } else {
      this._eachLine(highQuality, points => callback({ type: 'path', points, opacity: 1 }));
    }
  }

  _eachMark(callback) {
    const { rows, frequency, amplitude, style, motion, mask, stroke } = this.settings;
    const columns = Math.max(5, Math.round(820 / (20 / frequency)));
    const spacingX = 820 / columns;
    const spacingY = 780 / (rows - 1);
    const phase = this.time / CYCLE * TAU;
    const animated = motion && mask !== 'custom';
    const angle = animated ? Math.sin(phase) * 0.022 : 0;
    const shiftX = animated ? Math.sin(phase) * 9 : 0;
    const shiftY = animated ? Math.cos(phase) * 3 : 0;
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const pointerActive = this._hasPointer();
    let count = 0;
    for (let row = 0; row < rows; row++) {
      const y = 110 + row * spacingY;
      for (let col = 0; col <= columns; col++) {
        const x = 90 + col * spacingX;
        const dx = x - 500 - shiftX, dy = y - 580 - shiftY;
        let value = this._sample(ca * dx + sa * dy + 500, -sa * dx + ca * dy + 580);
        value = value * value * (3 - 2 * value);
        const pulse = 0.82 + 0.18 * Math.sin(col * 0.35 + row * 0.28 - phase * 4);
        const opacity = 0.16 + 0.84 * value;
        if (style === 'dots') {
          const points = [x, y];
          if (pointerActive) this._warpPoint(points);
          const radius = Math.min(Math.min(spacingX, spacingY) * 0.45,
            (0.55 + Math.min(spacingX, spacingY) * 0.28 * value * amplitude * pulse)
            * Math.sqrt(stroke / 1.1));
          callback({ type: 'circle', points, radius, opacity });
          count++;
        } else {
          const direction = value * (0.8 * Math.sin(phase * 2 + x * 0.006)
            + 0.5 * Math.cos(y * 0.008 - phase));
          const length = 2 + Math.min(spacingX * 0.75, spacingY * 0.9) * value * amplitude * pulse;
          const ox = Math.cos(direction) * length / 2;
          const oy = Math.sin(direction) * length / 2;
          const points = [x - ox, y - oy, x + ox, y + oy];
          if (pointerActive) { this._warpPoint(points); this._warpPoint(points, 2); }
          callback({ type: 'path', points, opacity });
          count += 2;
        }
      }
    }
    this._points = count;
  }

  _draw(ctx, width, height, highQuality = false) {
    const side = Math.min(width, height);
    ctx.resetTransform();
    ctx.fillStyle = this.settings.background;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.translate((width - side) / 2, (height - side) / 2);
    ctx.scale(side / DESIGN_SIZE, side / DESIGN_SIZE);
    ctx.strokeStyle = this.settings.color;
    ctx.lineWidth = this.settings.stroke;
    ctx.globalAlpha = 0.88;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = this.settings.color;
    this._eachPrimitive(highQuality, primitive => {
      const { points } = primitive;
      ctx.globalAlpha = 0.88 * primitive.opacity;
      ctx.beginPath();
      if (primitive.type === 'circle') {
        ctx.arc(points[0], points[1], primitive.radius, 0, TAU);
        ctx.fill();
        return;
      }
      for (let i = 0; i < points.length; i += 2) {
        if (i === 0) ctx.moveTo(points[i], points[i + 1]);
        else ctx.lineTo(points[i], points[i + 1]);
      }
      ctx.stroke();
    });
    ctx.restore();
  }
}
