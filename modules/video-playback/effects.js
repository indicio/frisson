/**
 * Optional post-process effects for video frames (canvas 2D).
 * RGB split uses a downsampled buffer for performance; full-res draw for 'none'.
 *
 * Tradeoff: true per-pixel RGB at 1080p every frame is too heavy without WebGL;
 * half-res or quarter-res keeps 60fps on typical hardware.
 */

/** @type {HTMLCanvasElement|null} */
let _work = null;
/** @type {CanvasRenderingContext2D|null} */
let _wctx = null;

function workCanvas(w, h) {
  if (!_work) {
    _work = document.createElement('canvas');
    _wctx = _work.getContext('2d', { willReadFrequently: true });
  }
  const sw = Math.max(64, Math.floor(w / 2));
  const sh = Math.max(64, Math.floor(h / 2));
  if (_work.width !== sw || _work.height !== sh) {
    _work.width = sw;
    _work.height = sh;
  }
  return { canvas: _work, ctx: _wctx, sw, sh };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLVideoElement} video
 * @param {number} w
 * @param {number} h
 * @param {number} level 0..1 smoothed amplitude
 * @param {{ mode: string, intensity: number, sensitivity: number, threshold: number }} p
 * @param {number} timeMs
 */
export function drawVideoEffect(ctx, video, w, h, level, p, timeMs) {
  const mode = p.mode || 'none';
  const inten = Math.max(0, Math.min(1, p.intensity ?? 0.5));
  const sens = Math.max(0.01, p.sensitivity ?? 1);
  const thr = p.threshold ?? 0.05;
  const amp = Math.max(0, level - thr) * sens;

  if (mode === 'none' || amp < 0.001) {
    ctx.drawImage(video, 0, 0, w, h);
    return;
  }

  if (mode === 'rgb') {
    drawRgbSplit(ctx, video, w, h, amp * inten * 24);
    return;
  }

  if (mode === 'glitch') {
    drawGlitch(ctx, video, w, h, amp * inten, timeMs);
    return;
  }

  ctx.drawImage(video, 0, 0, w, h);
}

function drawRgbSplit(ctx, video, w, h, maxPx) {
  const { canvas: off, ctx: octx, sw, sh } = workCanvas(w, h);
  octx.drawImage(video, 0, 0, sw, sh);
  const img = octx.getImageData(0, 0, sw, sh);
  const data = img.data;
  const d = Math.min(Math.floor(maxPx / 2), sw - 1);
  const orig = new Uint8ClampedArray(data);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const xr = Math.min(sw - 1, Math.max(0, x - d));
      const xb = Math.min(sw - 1, Math.max(0, x + d));
      const ir = (y * sw + xr) * 4;
      const ib = (y * sw + xb) * 4;
      data[i] = orig[ir];
      data[i + 1] = orig[i + 1];
      data[i + 2] = orig[ib + 2];
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
}

function drawGlitch(ctx, video, w, h, strength, timeMs) {
  const strips = Math.min(48, 12 + Math.floor(strength * 36));
  const sh = h / strips;
  const rng = (a, b, s) => {
    const t = Math.sin(s * 12.9898 + timeMs * 0.001) * 43758.5453;
    return a + (t - Math.floor(t)) * (b - a);
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  for (let i = 0; i < strips; i++) {
    const y = (h / strips) * i;
    const sliceH = sh + 0.5;
    const ox = rng(-1, 1, i + timeMs * 0.01) * strength * w * 0.08;
    const jy = rng(-0.5, 0.5, i * 7 + timeMs) * strength * 4;
    ctx.drawImage(video, 0, y, w, sliceH, ox, y + jy, w, sliceH);
  }
  ctx.restore();
}

export function resetEffectsWork() {
  _work = null;
  _wctx = null;
}
