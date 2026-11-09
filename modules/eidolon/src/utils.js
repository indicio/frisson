/** @param {number} t */
export function clamp(t, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, t));
}

/** @param {number} t */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** @param {number} t */
export function smoothstep(edge0, edge1, t) {
  const x = clamp((t - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

/** Deterministic hash → [0, 1) */
export function hash01(seed) {
  let x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 3D value noise (deterministic, cheap). */
export function noise3(x, y, z, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);

  const n000 = hash01(ix + iy * 57 + iz * 131 + seed);
  const n100 = hash01(ix + 1 + iy * 57 + iz * 131 + seed);
  const n010 = hash01(ix + (iy + 1) * 57 + iz * 131 + seed);
  const n110 = hash01(ix + 1 + (iy + 1) * 57 + iz * 131 + seed);
  const n001 = hash01(ix + iy * 57 + (iz + 1) * 131 + seed);
  const n101 = hash01(ix + 1 + iy * 57 + (iz + 1) * 131 + seed);
  const n011 = hash01(ix + (iy + 1) * 57 + (iz + 1) * 131 + seed);
  const n111 = hash01(ix + 1 + (iy + 1) * 57 + (iz + 1) * 131 + seed);

  const x00 = lerp(n000, n100, u);
  const x10 = lerp(n010, n110, u);
  const x01 = lerp(n001, n101, u);
  const x11 = lerp(n011, n111, u);
  const y0 = lerp(x00, x10, v);
  const y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w) * 2 - 1;
}

/** @param {string} easing @param {number} t */
export function applyEasing(easing, t) {
  t = clamp(t);
  switch (easing) {
    case 'easeIn': return t * t;
    case 'easeOut': return 1 - (1 - t) * (1 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case 'elastic': return t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    case 'overshoot': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    default: return t;
  }
}

/** Direction vector for directional explosion modes. */
export function directionVector(mode) {
  switch (mode) {
    case 'up': return [0, 1, 0];
    case 'down': return [0, -1, 0];
    case 'left': return [-1, 0, 0];
    case 'right': return [1, 0, 0];
    case 'forward': return [0, 0, -1];
    case 'back': return [0, 0, 1];
    default: return null;
  }
}

export function normalize3(x, y, z) {
  const len = Math.sqrt(x * x + y * y + z * z) || 1;
  return [x / len, y / len, z / len];
}
