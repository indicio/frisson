/**
 * Draws the mapping scene into the existing viewer window.
 * The loop runs only while Mapping Mode is active.
 * Module pixels are real module iframes placed by mappingModules.
 */

import * as audio from './audio.js';
import { ellipseHandles, outlinePoints } from '../shared/mapping/scene.js';
import * as modules from './mappingModules.js';

let canvas = null;
let overlay = null;
let context = null;
let overlayContext = null;
let scene = { version: 1, output: { width: 1920, height: 1080 }, surfaces: [] };
let active = false;
let frame = 0;
let options = {
  grid: true,
  outlines: true,
  numbers: true,
  blackout: false,
  performance: false,
};
const levels = new Map();

export function isActive() {
  return active;
}

export function attach() {
  modules.attach();
  canvas = document.getElementById('mapping-output');
  overlay = document.getElementById('mapping-overlay');
  if (!canvas) return;
  context = canvas.getContext('2d');
  overlayContext = overlay?.getContext('2d') || null;
  canvas.hidden = !active;
  if (overlay) overlay.hidden = !active;
}

export function setScene(next) {
  if (!next || !Array.isArray(next.surfaces) || !next.output) return;
  scene = next;
}

export function setOptions(next) {
  options = { ...options, ...next };
  if (next && Object.prototype.hasOwnProperty.call(next, 'playing')) modules.setPlaying(next.playing !== false);
}

export function setActive(on) {
  active = Boolean(on);
  document.body?.classList.toggle('mapping-active', active);
  modules.setActive(active);
  if (!canvas) return;
  canvas.hidden = !active;
  if (overlay) overlay.hidden = !active;
  cancelAnimationFrame(frame);
  if (active) frame = requestAnimationFrame(render);
}

function resize(element) {
  const width = Math.max(1, element.clientWidth);
  const height = Math.max(1, element.clientHeight);
  if (element.width !== width || element.height !== height) {
    element.width = width;
    element.height = height;
  }
}

function render() {
  if (!active || !context) return;
  try {
    resize(canvas);
    if (overlay) resize(overlay);
    const { width, height } = canvas;
    const scaleX = width / Math.max(1, scene.output.width);
    const scaleY = height / Math.max(1, scene.output.height);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);
    const showGrid = options.grid && !options.performance;
    const showOutlines = options.outlines && !options.performance;
    const showNumbers = options.numbers && !options.performance;
    if (!options.blackout) {
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0);
      if (showGrid) drawGrid(context);
      for (const surface of scene.surfaces) {
        if (surface.visible === false) continue;
        try {
          drawFill(context, surface, opacityFor(surface));
        } catch (error) {
          console.error('Mapping fill failed', surface?.id, error);
        }
      }
    }
    try {
      modules.sync(scene, { scaleX, scaleY, blackout: options.blackout, opacityFor });
    } catch (error) {
      console.error('Mapping modules failed', error);
    }
    if (overlayContext) {
      overlayContext.setTransform(1, 0, 0, 1, 0, 0);
      overlayContext.clearRect(0, 0, overlay.width, overlay.height);
      if (!options.blackout && (showOutlines || showNumbers)) {
        overlayContext.setTransform(scaleX, 0, 0, scaleY, 0, 0);
        for (const surface of scene.surfaces) {
          if (surface.visible === false) continue;
          try {
            drawChrome(overlayContext, surface, showOutlines, showNumbers);
          } catch (error) {
            console.error('Mapping outline failed', surface?.id, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Mapping render failed', error);
  }
  if (active) frame = requestAnimationFrame(render);
}

function opacityFor(surface) {
  const base = surface.opacity ?? 1;
  const map = surface.audio;
  if (!map?.enabled || typeof audio.getFFTData !== 'function') return base;
  const target = signalLevel(map.signal || 'level');
  const previous = levels.get(surface.id) ?? target;
  const smoothing = Math.min(0.95, Math.max(0, map.smoothing ?? 0.65));
  const next = previous * smoothing + target * (1 - smoothing);
  levels.set(surface.id, next);
  return Math.max(0, Math.min(1, base * (0.15 + (map.sensitivity ?? 1) * next)));
}

function signalLevel(signal) {
  if (signal === 'level') return typeof audio.getAudioLevel === 'function' ? audio.getAudioLevel() : 0;
  const fft = audio.getFFTData();
  if (!fft?.length) return 0;
  const span = signal === 'high' ? [0.4, 1] : signal === 'mid' ? [0.08, 0.4] : [0, 0.08];
  const from = Math.floor(fft.length * span[0]);
  const to = Math.max(from + 1, Math.floor(fft.length * span[1]));
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += fft[index];
  return sum / ((to - from) * 255);
}

function drawGrid(ctx) {
  const width = Math.min(8192, scene.output.width);
  const height = Math.min(8192, scene.output.height);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 96) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += 96) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.restore();
}

function trace(ctx, surface) {
  if (surface.ellipse) {
    const { cx, cy, rx, ry, rotation = 0 } = surface.ellipse;
    if (![cx, cy, rx, ry, rotation].every(Number.isFinite)) return;
    ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), rotation, 0, Math.PI * 2);
    return;
  }
  if (surface.anchors?.length) {
    const anchors = surface.anchors;
    const first = anchors.find((anchor) => anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
    if (!first) return;
    ctx.moveTo(first.x, first.y);
    for (let index = 0; index < anchors.length; index += 1) {
      const current = anchors[index];
      const next = anchors[(index + 1) % anchors.length];
      if (!current?.out || !next?.in || !next) continue;
      ctx.bezierCurveTo(current.out.x, current.out.y, next.in.x, next.in.y, next.x, next.y);
    }
    ctx.closePath();
    return;
  }
  const points = surface.points || [];
  if (!points.length) return;
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
}

function drawFill(ctx, surface, alpha) {
  ctx.save();
  ctx.beginPath();
  trace(ctx, surface);
  ctx.globalAlpha = alpha;
  const pattern = surface.content?.kind === 'pattern' ? surface.content.pattern : '';
  if (pattern && pattern !== 'solid') drawPattern(ctx, surface, pattern);
  else {
    ctx.fillStyle = surface.color || '#3d8bfd';
    ctx.fill();
  }
  ctx.restore();
}

function drawPattern(ctx, surface, pattern) {
  const points = outlinePoints(surface, 24);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });
  ctx.save();
  ctx.clip();
  ctx.fillStyle = surface.color || '#3d8bfd';
  ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
  ctx.globalAlpha = 1;
  if (pattern === 'checker') {
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const cell = 48;
    for (let y = minY; y < maxY; y += cell) {
      for (let x = minX; x < maxX; x += cell) {
        if ((Math.floor((x - minX) / cell) + Math.floor((y - minY) / cell)) % 2 === 0) {
          ctx.fillRect(x, y, cell, cell);
        }
      }
    }
  } else if (pattern === 'rings') {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 10;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const maxRadius = Math.hypot(maxX - minX, maxY - minY) / 2;
    for (let radius = 24; radius < maxRadius; radius += 36) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 16;
    for (let x = minX - (maxY - minY); x < maxX + (maxY - minY); x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, minY);
      ctx.lineTo(x + (maxY - minY), maxY);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawChrome(ctx, surface, outlines, numbers) {
  ctx.save();
  ctx.beginPath();
  trace(ctx, surface);
  if (outlines) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (numbers) {
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    markers(surface).forEach((point, index) => {
      ctx.fillText(String(index + 1), point.x + 10, point.y - 10);
    });
    const label = contentLabel(surface);
    if (label) {
      const points = outlinePoints(surface, 8);
      const x = points.reduce((sum, point) => sum + point.x, 0) / points.length;
      const y = points.reduce((sum, point) => sum + point.y, 0) / points.length;
      ctx.font = '32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y);
    }
  }
  ctx.restore();
}

function markers(surface) {
  if (surface.anchors?.length) return surface.anchors;
  if (surface.ellipse) {
    const handles = ellipseHandles(surface);
    return [handles.center, handles.rx, handles.ry];
  }
  return surface.points || [];
}

function contentLabel(surface) {
  const content = surface.content;
  if (!content || content.kind === 'color') return '';
  if (content.kind === 'pattern') return content.pattern;
  return content.moduleName || content.moduleId || '';
}
