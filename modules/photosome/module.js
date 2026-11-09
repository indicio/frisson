/**
 * Photosome Module
 * Ink drop visualization with audio-reactive motion and bass-triggered drops
 */

import * as THREE from "../../shared/libs/three-r160/three.module.js";
import { generatePalette, generateRandomPalette } from '../../shared/colorPalette.js';

// ============================================================
// Renderer / scene setup
// ============================================================
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

function setBackgroundColor(hex) {
  const rgb = hexToRgb01(hex);
  renderer.setClearColor(new THREE.Color(rgb[0], rgb[1], rgb[2]), 1.0);
}
setBackgroundColor('#000000');
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial());
scene.add(quad);

// ============================================================
// Ping-pong render targets
// ============================================================
const makeRT = (w, h) => new THREE.WebGLRenderTarget(w, h, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType,
  depthBuffer: false,
  stencilBuffer: false
});

let rtA, rtB;

const state = { simScale: 1.0 };

function resizeRTs(w, h) {
  if (rtA) rtA.dispose();
  if (rtB) rtB.dispose();
  rtA = makeRT(w, h);
  rtB = makeRT(w, h);
}

// ============================================================
// Drop model
// ============================================================
const MAX_DROPS = 8;
const drops = [];
let nextAutoDropAt = 0;
const clock = new THREE.Clock();

function rand(min, max) { return min + Math.random() * (max - min); }

function hexToRgb01(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return [r, g, b];
}

// Color palette system
let currentPalette = null;
let paletteColorIndex = 0;

const colorThemes = {
  'Random': () => generateRandomPalette(),
  'Warm Sunset': () => generatePalette({ paletteMode: 'analogous', warmCoolLock: 'warm', minSaturation: 60, maxSaturation: 95, minLightness: 40, maxLightness: 65 }),
  'Cool Ocean': () => generatePalette({ paletteMode: 'triadic', warmCoolLock: 'cool', minSaturation: 50, maxSaturation: 90, minLightness: 35, maxLightness: 60 }),
  'Vibrant Rainbow': () => generatePalette({ paletteMode: 'triadic', warmCoolLock: 'any', minSaturation: 70, maxSaturation: 100, minLightness: 40, maxLightness: 70 }),
  'Earth Tones': () => generatePalette({ paletteMode: 'complementary', warmCoolLock: 'warm', minSaturation: 40, maxSaturation: 70, minLightness: 30, maxLightness: 55 }),
  'Neon Electric': () => generatePalette({ paletteMode: 'complementary', warmCoolLock: 'cool', minSaturation: 80, maxSaturation: 100, minLightness: 50, maxLightness: 75 }),
  'Pastel Dreams': () => generatePalette({ paletteMode: 'analogous', warmCoolLock: 'any', minSaturation: 30, maxSaturation: 60, minLightness: 60, maxLightness: 85 }),
  'Deep Forest': () => generatePalette({ paletteMode: 'analogous', warmCoolLock: 'cool', minSaturation: 50, maxSaturation: 80, minLightness: 20, maxLightness: 45 }),
  'Fire & Ice': () => generatePalette({ paletteMode: 'complementary', warmCoolLock: 'any', minSaturation: 60, maxSaturation: 95, minLightness: 35, maxLightness: 65 }),
  'Monochrome Blue': () => generatePalette({ paletteMode: 'analogous', baseHue: 210, warmCoolLock: 'cool', minSaturation: 40, maxSaturation: 80, minLightness: 30, maxLightness: 70 }),
  'Black White Red': () => ({ c1: '#000000', c2: '#FFFFFF', c3: '#FF0000' })
};

function pickHighContrastColor() {
  if (params.useCustomColors) {
    const customColors = [
      hexToRgb01(params.customColor1),
      hexToRgb01(params.customColor2),
      hexToRgb01(params.customColor3)
    ];
    const selectedColor = customColors[paletteColorIndex % customColors.length];
    paletteColorIndex++;
    return selectedColor;
  }

  if (!currentPalette || Math.random() < 0.15) {
    const themeGenerator = colorThemes[params.colorTheme] || colorThemes['Random'];
    currentPalette = themeGenerator();
    paletteColorIndex = 0;
  }

  const paletteColors = [
    hexToRgb01(currentPalette.c1),
    hexToRgb01(currentPalette.c2),
    hexToRgb01(currentPalette.c3)
  ];

  const selectedColor = paletteColors[paletteColorIndex % paletteColors.length];
  paletteColorIndex++;

  const variation = 0.05;
  return selectedColor.map(c => Math.max(0, Math.min(1, c + rand(-variation, variation))));
}

// ============================================================
// Parameters
// ============================================================
const params = {
  autoDrops: true,
  autoMin: 4.25,
  autoMax: 8.5,
  centerBias: 0.6,
  durMin: 10.2,
  durMax: 23.8,
  fadeMin: 5.1,
  fadeMax: 10.2,
  strengthMin: 0.65,
  strengthMax: 1.0,
  edgeRoughMin: 0.03,
  edgeRoughMax: 0.12,
  aspectMin: 0.75,
  aspectMax: 1.35,
  shapeAmpMin: 0.01,
  shapeAmpMax: 0.08,
  shapeFreqMin: 2.0,
  shapeFreqMax: 7.0,
  rotSpeedMin: -0.3,
  rotSpeedMax: 0.3,
  noRotation: false,
  expCurve: 'Power InOut',
  expK: 2.2,
  expMid: 0.5,
  expSharp: 10.0,
  expansionSpeed: 1.0,
  colorTheme: 'Random',
  blendMode: 'Normal',
  useCustomColors: false,
  customColor1: '#FF0000',
  customColor2: '#00FF00',
  customColor3: '#0000FF',
  backgroundColor: '#000000',
  warpBase: 0.012,
  warpAudio: 0.03,
  decay: 0.003,
  feather: 0.02,
  edgeFreq: 18.0,
  edgeAmp: 1.0,
  diffuse: 0.06,
  rimW: 0.015,
  rimI: 0.28,
  audioWarp: true,
  audioEdge: true,
  audioDiffuse: true,
  bassTriggersDrops: true,
  bassThresh: 0.18,
  bassCooldown: 1.0
};

function addDrop(nx, ny) {
  const now = clock.getElapsedTime();
  const dur = rand(params.durMin, params.durMax) / params.expansionSpeed;
  const fadeDur = rand(params.fadeMin, params.fadeMax) / params.expansionSpeed;
  const strength = rand(params.strengthMin, params.strengthMax);
  const edgeRough = rand(params.edgeRoughMin, params.edgeRoughMax);
  const timeScale = rand(0.85, 1.25);
  const color = pickHighContrastColor();
  const aspect = rand(params.aspectMin, params.aspectMax);
  const rotSpeed = params.noRotation ? 0 : rand(params.rotSpeedMin, params.rotSpeedMax);
  const shapeAmp = rand(params.shapeAmpMin, params.shapeAmpMax);
  const shapeFreq = rand(params.shapeFreqMin, params.shapeFreqMax);
  const seed = Math.random();

  drops.unshift({
    x: nx, y: ny, start: now, dur, fadeDur, color,
    strength, edgeRough, timeScale,
    aspect, rotSpeed, shapeAmp, shapeFreq, seed
  });
  while (drops.length > MAX_DROPS) drops.pop();
}

// ============================================================
// Shader
// ============================================================
const simMaterial = new THREE.ShaderMaterial({
  uniforms: {
    u_prev: { value: null },
    u_time: { value: 0 },
    u_res:  { value: new THREE.Vector2(1, 1) },
    u_dropCount: { value: 0 },
    u_dropPos:   { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector2(-10, -10)) },
    u_dropMeta:  { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    u_dropCol:   { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector3(0, 0, 0)) },
    u_dropBias:  { value: Array.from({ length: MAX_DROPS }, () => 1.0) },
    u_dropFade:  { value: Array.from({ length: MAX_DROPS }, () => 0.0) },
    u_dropShape: { value: Array.from({ length: MAX_DROPS }, () => new THREE.Vector4(1, 0, 0, 3)) },
    u_dropSeed:  { value: Array.from({ length: MAX_DROPS }, () => 0.0) },
    u_warp:      { value: params.warpBase },
    u_decay:     { value: params.decay },
    u_feather:   { value: params.feather },
    u_edgeFreq:  { value: params.edgeFreq },
    u_edgeAmp:   { value: params.edgeAmp },
    u_diffuse:   { value: params.diffuse },
    u_rimW:      { value: params.rimW },
    u_rimI:      { value: params.rimI },
    u_audio:     { value: new THREE.Vector3(0, 0, 0) },
    u_audio2:    { value: new THREE.Vector3(0, 0, 0) },
    u_blendMode: { value: 0 },
    u_expCurve:  { value: 3 },
    u_expParams: { value: new THREE.Vector3(params.expK, params.expMid, params.expSharp) },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;

    varying vec2 vUv;
    uniform sampler2D u_prev;
    uniform float u_time;
    uniform vec2 u_res;

    uniform int u_dropCount;
    uniform vec2  u_dropPos[8];
    uniform vec4  u_dropMeta[8];
    uniform vec3  u_dropCol[8];
    uniform float u_dropBias[8];
    uniform float u_dropFade[8];
    uniform vec4  u_dropShape[8];
    uniform float u_dropSeed[8];

    uniform float u_warp;
    uniform float u_decay;
    uniform float u_feather;

    uniform float u_edgeFreq;
    uniform float u_edgeAmp;
    uniform float u_diffuse;
    uniform float u_rimW;
    uniform float u_rimI;

    uniform vec3 u_audio;
    uniform vec3 u_audio2;

    uniform int u_blendMode;

    uniform int  u_expCurve;
    uniform vec3 u_expParams;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = m * p;
        a *= 0.5;
      }
      return v;
    }

    vec2 rot2(vec2 v, float a){
      float c = cos(a), s = sin(a);
      return vec2(c*v.x - s*v.y, s*v.x + c*v.y);
    }

    float curve(float t, int mode, vec3 p){
      t = clamp(t, 0.0, 1.0);

      float k = max(p.x, 0.001);
      float mid = clamp(p.y, 0.01, 0.99);
      float sharp = max(p.z, 0.1);

      if(mode == 0) return t;
      if(mode == 1) return pow(t, k);
      if(mode == 2) return 1.0 - pow(1.0 - t, k);

      if(mode == 3){
        return t < 0.5
          ? 0.5 * pow(2.0 * t, k)
          : 1.0 - 0.5 * pow(2.0 * (1.0 - t), k);
      }

      if(mode == 4){
        float x = (t - mid) * sharp;
        return 1.0 / (1.0 + exp(-x));
      }

      if(mode == 5){
        float a = pow(t, k);
        float b = pow(1.0 - t, k);
        return a / (a + b + 1e-6);
      }

      return t;
    }

    vec3 blendNormal(vec3 base, vec3 blend, float opacity) { return mix(base, blend, opacity); }
    vec3 blendAdd(vec3 base, vec3 blend, float opacity) { return mix(base, base + blend, opacity); }
    vec3 blendMultiply(vec3 base, vec3 blend, float opacity) { return mix(base, base * blend, opacity); }
    vec3 blendScreen(vec3 base, vec3 blend, float opacity) { return mix(base, 1.0 - (1.0 - base) * (1.0 - blend), opacity); }

    vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
      vec3 result = vec3(
        base.x < 0.5 ? 2.0 * base.x * blend.x : 1.0 - 2.0 * (1.0 - base.x) * (1.0 - blend.x),
        base.y < 0.5 ? 2.0 * base.y * blend.y : 1.0 - 2.0 * (1.0 - base.y) * (1.0 - blend.y),
        base.z < 0.5 ? 2.0 * base.z * blend.z : 1.0 - 2.0 * (1.0 - base.z) * (1.0 - blend.z)
      );
      return mix(base, result, opacity);
    }

    vec3 blendSoftLight(vec3 base, vec3 blend, float opacity) {
      vec3 result = vec3(
        base.x < 0.5 ? 2.0 * base.x * blend.x + base.x * base.x * (1.0 - 2.0 * blend.x) : sqrt(base.x) * (2.0 * blend.x - 1.0) + 2.0 * base.x * (1.0 - blend.x),
        base.y < 0.5 ? 2.0 * base.y * blend.y + base.y * base.y * (1.0 - 2.0 * blend.y) : sqrt(base.y) * (2.0 * blend.y - 1.0) + 2.0 * base.y * (1.0 - blend.y),
        base.z < 0.5 ? 2.0 * base.z * blend.z + base.z * base.z * (1.0 - 2.0 * blend.z) : sqrt(base.z) * (2.0 * blend.z - 1.0) + 2.0 * base.z * (1.0 - blend.z)
      );
      return mix(base, result, opacity);
    }

    vec3 blendHardLight(vec3 base, vec3 blend, float opacity) {
      vec3 result = vec3(
        blend.x < 0.5 ? 2.0 * base.x * blend.x : 1.0 - 2.0 * (1.0 - base.x) * (1.0 - blend.x),
        blend.y < 0.5 ? 2.0 * base.y * blend.y : 1.0 - 2.0 * (1.0 - base.y) * (1.0 - blend.y),
        blend.z < 0.5 ? 2.0 * base.z * blend.z : 1.0 - 2.0 * (1.0 - base.z) * (1.0 - blend.z)
      );
      return mix(base, result, opacity);
    }

    vec3 blendColorDodge(vec3 base, vec3 blend, float opacity) {
      vec3 result = base / (1.0 - blend + 0.0001);
      result = clamp(result, 0.0, 1.0);
      return mix(base, result, opacity);
    }

    vec3 blendColorBurn(vec3 base, vec3 blend, float opacity) {
      vec3 result = 1.0 - (1.0 - base) / (blend + 0.0001);
      result = clamp(result, 0.0, 1.0);
      return mix(base, result, opacity);
    }

    vec3 blendDarken(vec3 base, vec3 blend, float opacity) { return mix(base, min(base, blend), opacity); }
    vec3 blendLighten(vec3 base, vec3 blend, float opacity) { return mix(base, max(base, blend), opacity); }
    vec3 blendDifference(vec3 base, vec3 blend, float opacity) { return mix(base, abs(base - blend), opacity); }

    vec3 applyBlendMode(vec3 base, vec3 blend, float opacity, int mode) {
      if (mode == 0) return blendNormal(base, blend, opacity);
      else if (mode == 1) return blendAdd(base, blend, opacity);
      else if (mode == 2) return blendMultiply(base, blend, opacity);
      else if (mode == 3) return blendScreen(base, blend, opacity);
      else if (mode == 4) return blendOverlay(base, blend, opacity);
      else if (mode == 5) return blendSoftLight(base, blend, opacity);
      else if (mode == 6) return blendHardLight(base, blend, opacity);
      else if (mode == 7) return blendColorDodge(base, blend, opacity);
      else if (mode == 8) return blendColorBurn(base, blend, opacity);
      else if (mode == 9) return blendDarken(base, blend, opacity);
      else if (mode == 10) return blendLighten(base, blend, opacity);
      else if (mode == 11) return blendDifference(base, blend, opacity);
      else return blendNormal(base, blend, opacity);
    }

    void main() {
      float amp  = clamp(u_audio.x, 0.0, 1.0);
      float bass = clamp(u_audio.y, 0.0, 1.0);
      float high = clamp(u_audio.z, 0.0, 1.0);
      float mid  = clamp(u_audio2.x, 0.0, 1.0);

      vec2 asp = vec2(u_res.x / u_res.y, 1.0);

      vec2 p = vUv;
      float n1 = fbm(p * 3.0 + vec2(0.0, u_time * 0.15));
      float n2 = fbm(p * 3.0 + vec2(10.0, -u_time * 0.12));
      vec2 flow = vec2(n1 - 0.5, n2 - 0.5);

      float warp = u_warp * (0.7 + 1.2 * amp);
      vec2 warpedUv = p + warp * flow;

      vec4 prev = texture2D(u_prev, warpedUv);

      if (u_diffuse > 0.0001) {
        vec2 px = 1.0 / u_res;
        vec3 s = prev.rgb;
        s += texture2D(u_prev, warpedUv + vec2(px.x, 0.0)).rgb;
        s += texture2D(u_prev, warpedUv - vec2(px.x, 0.0)).rgb;
        s += texture2D(u_prev, warpedUv + vec2(0.0, px.y)).rgb;
        s += texture2D(u_prev, warpedUv - vec2(0.0, px.y)).rgb;
        s /= 5.0;
        float df = clamp(u_diffuse * (0.75 + 0.6 * mid), 0.0, 1.0);
        prev.rgb = mix(prev.rgb, s, df);
      }

      prev.rgb = max(prev.rgb - u_decay, 0.0);
      vec3 col = prev.rgb;

      float maxR = length(vec2(1.0, 1.0) * asp);

      for (int i = 0; i < 8; i++) {
        if (i >= u_dropCount) break;

        vec2 c = u_dropPos[i];
        float start = u_dropMeta[i].x;
        float dur   = max(u_dropMeta[i].y, 0.001);
        float strength = u_dropMeta[i].z;
        float edgeRough = u_dropMeta[i].w;
        float fadeDur = u_dropFade[i];

        float t = (u_time - start) / (dur * max(u_dropBias[i], 0.01));
        if (t <= 0.0) continue;

        float fadeAlpha = 1.0;
        if (t > 1.0 && fadeDur > 0.001) {
          float fadeT = (u_time - (start + dur * max(u_dropBias[i], 0.01))) / fadeDur;
          fadeAlpha = 1.0 - smoothstep(0.0, 1.0, clamp(fadeT, 0.0, 1.0));
        }

        float tb = clamp(t, 0.0, 1.0);
        float e  = curve(tb, u_expCurve, u_expParams);
        float R  = e * maxR;

        vec4 sh = u_dropShape[i];
        float aspect = max(sh.x, 0.2);
        float rotSpeed = sh.y;
        float wobAmp = sh.z;
        float wobFreq = max(sh.w, 0.001);
        float seed = u_dropSeed[i];

        vec2 d0 = (vUv - c) * asp;
        float rotA = (u_time - start) * rotSpeed + seed * 6.2831853;
        vec2 d = rot2(d0, rotA);

        d *= vec2(aspect, 1.0 / aspect);

        float angle = atan(d.y, d.x);

        float distBase = length(d);

        float wob = fbm(vec2(angle * wobFreq, (u_time - start) * 0.35 + seed * 10.0));
        wob = (wob - 0.5) * 2.0;
        float wobScale = wobAmp * (0.2 + 0.8 * e) * (0.85 + 0.4 * high);
        float distW = distBase + wob * wobScale;

        float freq = u_edgeFreq * (0.85 + 0.65 * high);

        float edgeNoise1 = fbm(d * freq + vec2(u_time * 0.55, -u_time * 0.48));
        float edgeNoise2 = fbm(d * (freq * 1.25) + vec2(-u_time * 0.42, u_time * 0.52));
        float edgeNoise3 = fbm(d * (freq * 0.85) + vec2(u_time * 0.35, u_time * 0.38));
        float edgeNoise = (edgeNoise1 + edgeNoise2 * 0.8 + edgeNoise3 * 0.6) / 2.4;

        float angularNoise = fbm(vec2(angle * (2.0 + 2.0 * high), distBase * 0.6 + u_time * 0.25));
        edgeNoise = (edgeNoise + angularNoise * 0.35) / 1.35;

        float bell = 4.0 * e * (1.0 - e);
        float turbScale = (0.35 + 0.65 * bell);

        float turb = (edgeNoise - 0.5) * (edgeRough * u_edgeAmp * turbScale * (0.85 + 0.6 * amp));

        float feather = u_feather * (0.55 + 1.15 * fbm(d * 6.0 + u_time * 0.15));

        float inside = 1.0 - smoothstep(R - feather, R + feather, distW + turb);

        float pigment = 0.85 + 0.25 * fbm(d * 2.0 + vec2(20.0, u_time * 0.08));
        vec3 ink = u_dropCol[i] * pigment;

        float a = clamp(inside * strength * fadeAlpha, 0.0, 1.0);

        float w = max(u_rimW, 0.001) * (0.85 + 0.8 * high);
        float dt = distW + turb;
        float rim = smoothstep(R - w, R, dt) - smoothstep(R, R + w, dt);
        rim = clamp(rim, 0.0, 1.0);

        col = applyBlendMode(col, ink, a, u_blendMode);

        if (u_blendMode == 0) {
          col = clamp(col + 0.15 * a * (ink - col) * (0.6 + 0.4 * pigment), 0.0, 1.0);
        }

        vec3 rimCol = clamp(ink * (0.95 + 0.25 * high) + 0.05 * ink * pigment, 0.0, 1.0);
        col = mix(col, rimCol, rim * u_rimI * fadeAlpha);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `
});

const viewMaterial = new THREE.ShaderMaterial({
  uniforms: { u_tex: { value: null } },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D u_tex;
    void main(){ gl_FragColor = texture2D(u_tex, vUv); }
  `
});

// ============================================================
// Resize + init buffer
// ============================================================
function onResize() {
  const pr = renderer.getPixelRatio();
  const w = Math.max(2, Math.floor(innerWidth * pr * state.simScale));
  const h = Math.max(2, Math.floor(innerHeight * pr * state.simScale));

  renderer.setSize(innerWidth, innerHeight, false);
  resizeRTs(w, h);

  simMaterial.uniforms.u_res.value.set(w, h);

  renderer.setRenderTarget(rtA); renderer.clear(true, true, true);
  renderer.setRenderTarget(rtB); renderer.clear(true, true, true);
  renderer.setRenderTarget(null);
}
window.addEventListener("resize", onResize);
onResize();

// Seed a drop
addDrop(0.5, 0.5);
nextAutoDropAt = 1.36;

// Click-to-drop
window.addEventListener("pointerdown", (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = 1.0 - (e.clientY - rect.top) / rect.height;
  addDrop(nx, ny);
});

// ============================================================
// Upload drop data to uniforms
// ============================================================
function updateUniformDrops() {
  simMaterial.uniforms.u_dropCount.value = drops.length;

  const reversedDrops = [...drops].reverse();

  for (let i = 0; i < MAX_DROPS; i++) {
    const d = reversedDrops[i];
    if (!d) {
      simMaterial.uniforms.u_dropPos.value[i].set(-10, -10);
      simMaterial.uniforms.u_dropMeta.value[i].set(0, 1, 0, 0);
      simMaterial.uniforms.u_dropCol.value[i].set(0, 0, 0);
      simMaterial.uniforms.u_dropBias.value[i] = 1.0;
      simMaterial.uniforms.u_dropFade.value[i] = 0.0;
      simMaterial.uniforms.u_dropShape.value[i].set(1, 0, 0, 3);
      simMaterial.uniforms.u_dropSeed.value[i] = 0.0;
      continue;
    }
    simMaterial.uniforms.u_dropPos.value[i].set(d.x, d.y);
    simMaterial.uniforms.u_dropMeta.value[i].set(d.start, d.dur, d.strength, d.edgeRough);
    simMaterial.uniforms.u_dropCol.value[i].set(d.color[0], d.color[1], d.color[2]);
    simMaterial.uniforms.u_dropBias.value[i] = d.timeScale;
    simMaterial.uniforms.u_dropFade.value[i] = d.fadeDur;
    simMaterial.uniforms.u_dropShape.value[i].set(d.aspect, d.rotSpeed, d.shapeAmp, d.shapeFreq);
    simMaterial.uniforms.u_dropSeed.value[i] = d.seed;
  }
}

// ============================================================
// Audio (mic analysis)
// ============================================================
let audioCtx, analyser, freqData, timeData;
let audioReady = false;
/** When running inside shell/viewer iframe, use shared mic/analyser from loader. */
let shellAudio = null;

function bandEnergy(freqData, sampleRate, fftSize, f0, f1) {
  const binHz = sampleRate / fftSize;
  const i0 = Math.max(0, Math.floor(f0 / binHz));
  const i1 = Math.min(freqData.length - 1, Math.ceil(f1 / binHz));
  let sum = 0;
  for (let i = i0; i <= i1; i++) sum += freqData[i];
  const n = (i1 - i0 + 1) || 1;
  return (sum / n) / 255;
}

let smAmp = 0, smBass = 0, smMid = 0, smHigh = 0;
let lastBassTriggerT = -999;

function updateAudio(t) {
  if (shellAudio && typeof shellAudio.getFFTData === 'function') {
    const fft = shellAudio.getFFTData();
    const wf = shellAudio.getWaveformData ? shellAudio.getWaveformData() : null;
    if (!fft || fft.length === 0) {
      simMaterial.uniforms.u_audio.value.set(0, 0, 0);
      simMaterial.uniforms.u_audio2.value.set(0, 0, 0);
      return;
    }
    const sr = shellAudio.getAudioContext?.()?.sampleRate ?? 44100;
    const fftSize = shellAudio.getAnalyser?.()?.fftSize ?? 2048;
    let rms = 0;
    if (wf && wf.length) {
      for (let i = 0; i < wf.length; i++) {
        const v = (wf[i] - 128) / 128;
        rms += v * v;
      }
      rms = Math.sqrt(rms / wf.length);
    } else if (typeof shellAudio.getAudioLevel === 'function') {
      rms = shellAudio.getAudioLevel();
    }
    const bass = bandEnergy(fft, sr, fftSize, 40, 140);
    const mid = bandEnergy(fft, sr, fftSize, 300, 2000);
    const high = bandEnergy(fft, sr, fftSize, 4000, 10000);
    const a = 0.15;
    smAmp += (rms - smAmp) * a;
    smBass += (bass - smBass) * a;
    smMid += (mid - smMid) * a;
    smHigh += (high - smHigh) * a;
    simMaterial.uniforms.u_audio.value.set(smAmp, smBass, smHigh);
    simMaterial.uniforms.u_audio2.value.set(smMid, Math.max(smBass, smAmp), 0);
    if (params.bassTriggersDrops) {
      if (smBass > params.bassThresh && (t - lastBassTriggerT) > params.bassCooldown) {
        addDrop(rand(0.25, 0.75), rand(0.25, 0.75));
        lastBassTriggerT = t;
      }
    }
    return;
  }

  if (!audioReady) {
    simMaterial.uniforms.u_audio.value.set(0, 0, 0);
    simMaterial.uniforms.u_audio2.value.set(0, 0, 0);
    return;
  }

  analyser.getByteFrequencyData(freqData);
  analyser.getByteTimeDomainData(timeData);

  let rms = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = (timeData[i] - 128) / 128;
    rms += v * v;
  }
  rms = Math.sqrt(rms / timeData.length);

  const sr = audioCtx.sampleRate;
  const fftSize = analyser.fftSize;

  const bass = bandEnergy(freqData, sr, fftSize, 40, 140);
  const mid  = bandEnergy(freqData, sr, fftSize, 300, 2000);
  const high = bandEnergy(freqData, sr, fftSize, 4000, 10000);

  const a = 0.15;
  smAmp  += (rms  - smAmp)  * a;
  smBass += (bass - smBass) * a;
  smMid  += (mid  - smMid)  * a;
  smHigh += (high - smHigh) * a;

  simMaterial.uniforms.u_audio.value.set(smAmp, smBass, smHigh);
  simMaterial.uniforms.u_audio2.value.set(smMid, Math.max(smBass, smAmp), 0);

  if (params.bassTriggersDrops) {
    if (smBass > params.bassThresh && (t - lastBassTriggerT) > params.bassCooldown) {
      addDrop(rand(0.25, 0.75), rand(0.25, 0.75));
      lastBassTriggerT = t;
    }
  }
}

// ============================================================
// BroadcastChannel for controls
// ============================================================
let controlsChannel = null;

function handleControlMessage(event) {
  if (event.data && event.data.type === 'PARAM_CHANGE') {
    handleParamChange(event.data.param, event.data.value);
  }
}

function handleParamChange(param, value) {
  // Command-style controls are not part of `params`.
  if (param === 'reset') {
    renderer.setRenderTarget(rtA); renderer.clear(true, true, true);
    renderer.setRenderTarget(rtB); renderer.clear(true, true, true);
    renderer.setRenderTarget(null);
    drops.length = 0;
    return;
  }

  if (param === 'clear') {
    renderer.setRenderTarget(rtA); renderer.clear(true, true, true);
    renderer.setRenderTarget(rtB); renderer.clear(true, true, true);
    renderer.setRenderTarget(null);
    return;
  }

  if (param === 'randomize') {
    params.autoDrops = Math.random() > 0.3;
    params.autoMin = rand(0.2, 10.0);
    params.autoMax = rand(params.autoMin, 12.0);
    params.centerBias = rand(0.0, 1.0);
    params.durMin = rand(0.2, 20.0);
    params.durMax = rand(params.durMin, 30.0);
    params.fadeMin = rand(0.0, 12.0);
    params.fadeMax = rand(params.fadeMin, 20.0);
    params.strengthMin = rand(0.0, 1.0);
    params.strengthMax = rand(params.strengthMin, 1.0);
    params.aspectMin = rand(0.3, 2.0);
    params.aspectMax = rand(params.aspectMin, 2.0);
    params.shapeAmpMin = rand(0.0, 0.25);
    params.shapeAmpMax = rand(params.shapeAmpMin, 0.35);
    params.shapeFreqMin = rand(0.5, 12.0);
    params.shapeFreqMax = rand(params.shapeFreqMin, 20.0);
    params.rotSpeedMin = rand(-1.5, 1.5);
    params.rotSpeedMax = rand(params.rotSpeedMin, 1.5);
    const curves = ['Linear', 'Power In', 'Power Out', 'Power InOut', 'Sigmoid', 'Generalized Smooth'];
    params.expCurve = curves[Math.floor(Math.random() * curves.length)];
    params.expK = rand(0.8, 5.0);
    params.expMid = rand(0.2, 0.8);
    params.expSharp = rand(3.0, 22.0);
    params.warpBase = rand(0.0, 0.08);
    params.decay = rand(0.0, 0.02);
    params.feather = rand(0.001, 0.10);
    params.edgeFreq = rand(1.0, 60.0);
    params.edgeAmp = rand(0.0, 3.0);
    params.diffuse = rand(0.0, 0.35);
    params.rimW = rand(0.0, 0.08);
    params.rimI = rand(0.0, 1.0);
    params.edgeRoughMin = rand(0.0, 0.30);
    params.edgeRoughMax = rand(params.edgeRoughMin, 0.45);
    params.audioWarp = Math.random() > 0.3;
    params.audioEdge = Math.random() > 0.3;
    params.audioDiffuse = Math.random() > 0.3;
    params.bassTriggersDrops = Math.random() > 0.5;
    params.bassThresh = rand(0.01, 0.6);
    params.bassCooldown = rand(0.2, 3.0);
    params.warpAudio = rand(0.0, 0.10);
    return;
  }

  if (param === 'enableAudio') {
    audioReady = !!shellAudio;
    return;
  }

  if (param === 'simScale') {
    state.simScale = value;
    onResize();
    return;
  }

  if (params.hasOwnProperty(param)) {
    params[param] = value;

    if (param === 'backgroundColor') {
      setBackgroundColor(value);
    } else if (param === 'colorTheme') {
      currentPalette = null;
    }
  }
}

// Set up BroadcastChannel
controlsChannel = new BroadcastChannel('visualizer-controls');
controlsChannel.onmessage = handleControlMessage;

// Also listen to window messages (for iframe communication)
window.addEventListener('message', handleControlMessage);

// Expose moduleAPI for loader.js (self-initializing module — already running)
window.moduleAPI = {
  async initModule({ audio }) {
    shellAudio = audio || null;
    if (shellAudio) {
      audioReady = true;
    }
  },
  start: async () => {},
  stop: async () => { /* render loop uses rAF, stops when page hidden */ },
  destroy: async () => {
    if (controlsChannel) { controlsChannel.close(); controlsChannel = null; }
    if (renderer) renderer.dispose();
  },
};

// ============================================================
// Render loop
// ============================================================
function tick() {
  const t = clock.getElapsedTime();

  updateAudio(t);

  if (params.autoDrops && t >= nextAutoDropAt) {
    const nx = Math.random() < params.centerBias ? rand(0.25, 0.75) : Math.random();
    const ny = Math.random() < params.centerBias ? rand(0.25, 0.75) : Math.random();
    addDrop(nx, ny);
    nextAutoDropAt = t + rand(params.autoMin, params.autoMax);
  }

  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    const endT = d.start + d.dur * d.timeScale + d.fadeDur;
    if (t >= endT) drops.splice(i, 1);
  }

  simMaterial.uniforms.u_time.value = t;

  const amp = simMaterial.uniforms.u_audio.value.x;
  const mid = simMaterial.uniforms.u_audio2.value.x;
  const high = simMaterial.uniforms.u_audio.value.z;

  simMaterial.uniforms.u_warp.value = params.warpBase + (params.audioWarp ? params.warpAudio * amp : 0.0);
  simMaterial.uniforms.u_decay.value = params.decay;
  simMaterial.uniforms.u_feather.value = params.feather;

  simMaterial.uniforms.u_edgeFreq.value = params.edgeFreq * (params.audioEdge ? (0.85 + 0.8 * high) : 1.0);
  simMaterial.uniforms.u_edgeAmp.value = params.edgeAmp;
  simMaterial.uniforms.u_diffuse.value = params.diffuse * (params.audioDiffuse ? (0.75 + 0.7 * mid) : 1.0);
  simMaterial.uniforms.u_rimW.value = params.rimW;
  simMaterial.uniforms.u_rimI.value = params.rimI;

  const blendModeMap = {
    'Normal': 0, 'Add': 1, 'Multiply': 2, 'Screen': 3, 'Overlay': 4,
    'Soft Light': 5, 'Hard Light': 6, 'Color Dodge': 7, 'Color Burn': 8,
    'Darken': 9, 'Lighten': 10, 'Difference': 11
  };
  simMaterial.uniforms.u_blendMode.value = blendModeMap[params.blendMode] || 0;

  const expCurveMap = {
    'Linear': 0,
    'Power In': 1,
    'Power Out': 2,
    'Power InOut': 3,
    'Sigmoid': 4,
    'Generalized Smooth': 5
  };
  simMaterial.uniforms.u_expCurve.value = expCurveMap[params.expCurve] ?? 3;
  simMaterial.uniforms.u_expParams.value.set(params.expK, params.expMid, params.expSharp);

  updateUniformDrops();

  simMaterial.uniforms.u_prev.value = rtA.texture;
  quad.material = simMaterial;
  renderer.setRenderTarget(rtB);
  renderer.render(scene, camera);

  viewMaterial.uniforms.u_tex.value = rtB.texture;
  quad.material = viewMaterial;
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  const tmp = rtA; rtA = rtB; rtB = tmp;

  requestAnimationFrame(tick);
}
tick();

