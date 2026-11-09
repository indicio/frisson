import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { backgroundColor, buildStrokes, presetById, sanitizeState } from '../modules/procedural-geometry/engine.js';

const width = 960;
const height = 540;
const state = sanitizeState(presetById('vortex-tunnel').state);
const rgba = new Uint8Array(width * height * 4);
const bg = hex(backgroundColor(state));
for (let i = 0; i < rgba.length; i += 4) {
  rgba[i] = bg[0];
  rgba[i + 1] = bg[1];
  rgba[i + 2] = bg[2];
  rgba[i + 3] = 255;
}

const strokes = buildStrokes(state, 1.35);
const cx = width * 0.5;
const cy = height * 0.5;
const fit = Math.min(width, height) / 1400;
for (const stroke of strokes) {
  const color = hex(stroke.color);
  const radius = Math.max(0.6, stroke.width * fit * 0.5);
  for (let i = 1; i < stroke.points.length; i += 1) {
    stamp(stroke.points[i - 1], stroke.points[i], radius, color, stroke.alpha);
  }
}

const file = path.resolve('modules/procedural-geometry/preview.png');
fs.writeFileSync(file, png(width, height, rgba));
console.log(`Wrote ${file}`);

function stamp(a, b, radius, color, alpha) {
  const x0 = cx + a.x * fit;
  const y0 = cy + a.y * fit;
  const x1 = cx + b.x * fit;
  const y1 = cy + b.y * fit;
  const length = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(length / Math.max(1, radius * 0.7)));
  for (let step = 0; step <= steps; step += 1) {
    disk(x0 + (x1 - x0) * step / steps, y0 + (y1 - y0) * step / steps, radius, color, alpha);
  }
}

function disk(x, y, radius, color, alpha) {
  const r2 = radius * radius;
  const left = Math.max(0, Math.floor(x - radius));
  const right = Math.min(width - 1, Math.ceil(x + radius));
  const top = Math.max(0, Math.floor(y - radius));
  const bottom = Math.min(height - 1, Math.ceil(y + radius));
  for (let yy = top; yy <= bottom; yy += 1) {
    for (let xx = left; xx <= right; xx += 1) {
      if ((xx - x) ** 2 + (yy - y) ** 2 > r2) continue;
      const index = (yy * width + xx) * 4;
      rgba[index] = rgba[index] * (1 - alpha) + color[0] * alpha;
      rgba[index + 1] = rgba[index + 1] * (1 - alpha) + color[1] * alpha;
      rgba[index + 2] = rgba[index + 2] * (1 - alpha) + color[2] * alpha;
    }
  }
}

function hex(value) {
  const raw = String(value || '#000').replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16) || 0);
}

function png(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) {
    const start = y * (w * 4 + 1);
    raw[start] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, start + 1);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr(w, h)),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ihdr(w, h) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  return header;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}
