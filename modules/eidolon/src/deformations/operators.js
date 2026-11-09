import { clamp, directionVector, hash01, lerp, noise3, normalize3 } from '../utils.js';

/**
 * @typedef {object} OperatorContext
 * @property {number} ox @property {number} oy @property {number} oz
 * @property {number} cx @property {number} cy @property {number} cz
 * @property {number} normRadius @property {number} seed
 * @property {number} time @property {object} params
 * @property {number} audioWeight
 */

/** @param {OperatorContext} ctx */
export function radialExplosion(ctx) {
  const { ox, oy, oz, cx, cy, cz, params, audioWeight } = ctx;
  const amt = params.explosionAmount * audioWeight;
  if (amt <= 0) return [0, 0, 0];

  let [dx, dy, dz] = normalize3(ox - cx, oy - cy, oz - cz);
  const rand = (hash01(ctx.seed + 17) - 0.5) * params.explosionRandomness;
  dx += rand * 0.3;
  dy += (hash01(ctx.seed + 31) - 0.5) * params.explosionRandomness * 0.3;
  dz += (hash01(ctx.seed + 47) - 0.5) * params.explosionRandomness * 0.3;
  [dx, dy, dz] = normalize3(dx, dy, dz);

  const dist = params.explosionDistance * params.explosionSpread * amt;
  let turb = 0;
  if (params.explosionTurbulence > 0) {
    turb = noise3(ox * 2, oy * 2, oz * 2 + ctx.time, ctx.seed) * params.explosionTurbulence * amt;
  }
  return [dx * dist + dx * turb, dy * dist + dy * turb, dz * dist + dz * turb];
}

/** @param {OperatorContext} ctx */
export function directionalExplosion(ctx) {
  const base = radialExplosion(ctx);
  const dir = directionVector(ctx.params.explosionDirection);
  if (!dir || ctx.params.explosionDirectionStrength <= 0) return base;

  const str = ctx.params.explosionDirectionStrength * ctx.params.explosionAmount * ctx.audioWeight;
  const dist = ctx.params.explosionDistance * str;
  return [
    base[0] + dir[0] * dist,
    base[1] + dir[1] * dist,
    base[2] + dir[2] * dist,
  ];
}

/** @param {OperatorContext} ctx */
export function orbitDeform(ctx) {
  const amt = ctx.params.orbitAmount * ctx.audioWeight;
  if (amt <= 0) return [0, 0, 0];

  const { ox, oy, oz, cx, cy, cz, time, seed, params } = ctx;
  const dx = ox - cx;
  const dy = oy - cy;
  const dz = oz - cz;
  const r = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
  const angle = time * params.orbitSpeedDeform + seed * params.orbitAngularSpread;
  const radius = params.orbitRadiusDeform * amt * params.orbitCohesion * (0.5 + ctx.normRadius * params.orbitRadialSpread);

  let ax = 0;
  let ay = 1;
  let az = 0;
  if (params.orbitAxisDeform === 'x') {
    ax = 1;
    ay = 0;
  } else if (params.orbitAxisDeform === 'z') {
    ay = 0;
    az = 1;
  }

  const px = dx / r;
  const py = dy / r;
  const pz = dz / r;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dot = px * ax + py * ay + pz * az;
  const cxp = ay * pz - az * py;
  const cyp = az * px - ax * pz;
  const czp = ax * py - ay * px;
  const rx = px * cosA + cxp * sinA + ax * dot * (1 - cosA);
  const ry = py * cosA + cyp * sinA + ay * dot * (1 - cosA);
  const rz = pz * cosA + czp * sinA + az * dot * (1 - cosA);

  return [(rx * r - dx) * radius, (ry * r - dy) * radius, (rz * r - dz) * radius];
}

/** @param {OperatorContext} ctx */
export function spiralDeform(ctx) {
  const amt = ctx.params.spiralAmount * ctx.audioWeight;
  if (amt <= 0) return [0, 0, 0];

  const { ox, oy, oz, time, normRadius, params } = ctx;
  const twist = params.spiralTwist * normRadius + time * params.spiralSpeed;
  const c = Math.cos(twist);
  const s = Math.sin(twist);
  const x = ox;
  const z = oz;
  const rx = x * c - z * s;
  const rz = x * s + z * c;
  const pull = params.spiralRadius * amt * normRadius;
  const yStretch = oy * params.spiralVerticalStretch * amt * 0.2;
  let turb = 0;
  if (params.spiralTurbulence > 0) {
    turb = noise3(ox, oy, oz + time, ctx.seed) * params.spiralTurbulence * amt * 0.2;
  }
  return [(rx - x) * pull + turb, yStretch, (rz - z) * pull + turb];
}

/** @param {OperatorContext} ctx */
export function floatDeform(ctx) {
  const amt = ctx.params.floatAmount * ctx.audioWeight * ctx.params.floatCohesion;
  if (amt <= 0) return [0, 0, 0];

  const { ox, oy, oz, time, seed, params } = ctx;
  const scale = params.noiseScale;
  const spd = params.noiseSpeed;
  const d = params.floatDistance;
  const nx = noise3(ox * scale, oy * scale, time * spd, seed);
  const ny = noise3(oy * scale, oz * scale, time * spd + 10, seed + 1);
  const nz = noise3(oz * scale, ox * scale, time * spd + 20, seed + 2);
  return [nx * d * amt, ny * d * amt, nz * d * amt];
}

/** @param {OperatorContext} ctx */
export function noiseDeform(ctx) {
  const amt = ctx.params.noiseAmount * ctx.audioWeight;
  if (amt <= 0) return [0, 0, 0];

  const { ox, oy, oz, time, seed, params } = ctx;
  const f = params.turbulenceFrequency;
  const s = params.noiseScale * params.turbulenceScale;
  const spd = params.noiseSpeed * params.turbulenceSpeed;
  const nx = noise3(ox * s * f, oy * s, time * spd, seed);
  const ny = noise3(oy * s, oz * s * f, time * spd, seed + 3);
  const nz = noise3(oz * s, ox * s, time * spd + 5, seed + 5);
  return [nx * amt * 0.15, ny * amt * 0.15, nz * amt * 0.15];
}

/** @param {OperatorContext} ctx */
export function turbulenceDeform(ctx) {
  const amt = ctx.params.turbulenceAmount * ctx.audioWeight;
  if (amt <= 0) return [0, 0, 0];
  return noiseDeform({ ...ctx, params: { ...ctx.params, noiseAmount: amt, noiseScale: ctx.params.turbulenceScale } });
}

/** @param {OperatorContext} ctx */
export function waveDeform(ctx) {
  const amt = ctx.params.waveAmount * ctx.audioWeight;
  if (amt <= 0) return [0, 0, 0];

  const { ox, oy, oz, time, params } = ctx;
  const phase = time * params.waveSpeed;
  const freq = params.waveFrequency;
  let w = 0;
  if (params.waveAxis === 'x') w = Math.sin(oy * freq + phase) * amt * 0.2;
  else if (params.waveAxis === 'z') w = Math.sin(ox * freq + phase) * amt * 0.2;
  else w = Math.sin((ox + oz) * freq + phase) * amt * 0.2;
  return [0, w, 0];
}

/** Stack all deformation offsets. */
export function stackDeformations(ctx) {
  const ops = [
    directionalExplosion,
    orbitDeform,
    spiralDeform,
    floatDeform,
    noiseDeform,
    turbulenceDeform,
    waveDeform,
  ];
  let x = 0;
  let y = 0;
  let z = 0;
  for (const op of ops) {
    const [dx, dy, dz] = op(ctx);
    x += dx;
    y += dy;
    z += dz;
  }
  return [x, y, z];
}

/**
 * Per-splat reconstruction factor for styled rebuilds.
 * @param {number} globalRecon 0=effect, 1=canonical
 */
export function splatReconstructionFactor(globalRecon, style, normRadius, seed, time) {
  let t = clamp(globalRecon);
  switch (style) {
    case 'outside-in':
      t = clamp((t - normRadius) / 0.35);
      break;
    case 'inside-out':
      t = clamp((t - (1 - normRadius)) / 0.35);
      break;
    case 'bottom-top':
      t = clamp(t - normRadius * 0.5);
      break;
    case 'top-bottom':
      t = clamp(t - (1 - normRadius) * 0.5);
      break;
    case 'random':
      t = clamp(t - hash01(seed) * 0.85);
      break;
    case 'wave':
      t = clamp(t - 0.5 + 0.5 * Math.sin(time * 2 + seed));
      break;
    case 'spiral':
      t = clamp(t - normRadius + 0.3 * Math.sin(time * 3 + seed * 0.1));
      break;
    default:
      break;
  }
  return t;
}

export function mixPosition(ox, oy, oz, ex, ey, ez, recon) {
  const t = recon;
  return [
    lerp(ex, ox, t),
    lerp(ey, oy, t),
    lerp(ez, oz, t),
  ];
}
