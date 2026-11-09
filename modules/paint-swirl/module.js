/**
 * Liquid Marbling Module
 * WebGL-based fluid marbling shader with interactive mouse drag and audio reactivity.
 */

const canvas = document.getElementById('c');
let gl = null;
let prog = null;
let container = null;
let audioData = null;
let controlsChannel = null;
let animationId = null;
let lastTime = 0;
let width = 0;
let height = 0;

const PALETTE_PRESETS = {
  marbling: ['#f04d4d', '#f4a040', '#3498db', '#2ecc71'],
  psychedelic: ['#ff2d6a', '#7b2dff', '#00e5c8', '#ffd23f'],
  sunset: ['#ff4e00', '#ff8a00', '#ff006e', '#8338ec'],
  ocean: ['#0077b6', '#00b4d8', '#90e0ef', '#023e8a'],
  neon: ['#39ff14', '#ff00ff', '#00ffff', '#ffea00'],
  candy: ['#ff6bcb', '#ffc75f', '#845ec2', '#00c9a7'],
  cosmic: ['#2d1b69', '#6930c3', '#5e60ce', '#48bfe3'],
  tropical: ['#06d6a0', '#ffd166', '#ef476f', '#118ab2'],
  aurora: ['#00f5d4', '#9b5de5', '#f15bb5', '#fee440'],
  monochrome: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'],
  custom: null,
};

const params = {
  palettePreset: 'marbling',
  color1: '#f04d4d',
  color2: '#f4a040',
  color3: '#3498db',
  color4: '#2ecc71',
  speed: 0.55,
  swirl: 1.35,
  stretch: 1.65,
  detail: 1.3,
  edges: 0.85,
  variety: 0.5,
  seed: Math.random() * 1000,
  audioReactivity: 0.5,
  mouseSim: 'none',
  autoRandAll: 0,
  autoRandColors: 0,
};

const AUDIO_SMOOTHING = 0.82;
const audioBands = { level: 0, bass: 0, mids: 0, treble: 0, peak: 0 };

let mouseX = 0.5;
let mouseY = 0.5;
let mouseDown = 0;

let tweenFrom = null;
let tweenTo = null;
let tweenProgress = 1;
const TWEEN_DURATION = 0.6;

let currentDisplayColors = PALETTE_PRESETS.marbling.map(hexToRGB);
let autoRandAllTimer = null;
let autoRandColorsTimer = null;

function clearAutoTimers() {
  if (autoRandAllTimer) { clearInterval(autoRandAllTimer); autoRandAllTimer = null; }
  if (autoRandColorsTimer) { clearInterval(autoRandColorsTimer); autoRandColorsTimer = null; }
}

const vertexSrc = `
  attribute vec2 p;
  varying vec2 vUv;
  void main(){ vUv=p*.5+.5; gl_Position=vec4(p,0.,1.); }
`;

const fragmentSrc = `
  precision highp float;
  varying vec2 vUv;
  uniform vec2 uRes;
  uniform float uTime,uSpeed,uSwirl,uStretch,uDetail,uEdges,uSeed,uVariety;
  uniform vec2 uMouse;
  uniform float uMouseDown;
  uniform vec3 uColor1,uColor2,uColor3,uColor4;

  mat2 rot(float a){float s=sin(a),c=cos(a);return mat2(c,-s,s,c);}
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453123);}
  float noise(vec2 p){
    vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
    return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
  }
  float fbm(vec2 p){
    float v=0.,a=.5;
    for(int i=0;i<6;i++){v+=a*noise(p);p*=2.03;p*=rot(.42);a*=.5;}
    return v;
  }
  vec2 curl(vec2 p){
    float e=.025;
    float n1=fbm(p+vec2(0,e)),n2=fbm(p-vec2(0,e));
    float n3=fbm(p+vec2(e,0)),n4=fbm(p-vec2(e,0));
    return vec2(n1-n2,n4-n3)/e;
  }
  vec3 pal(float t){
    vec3 col;
    float p=t*3.0;
    float i=floor(p);
    float f=fract(p);
    f=f*f*(3.-2.*f);
    if(i<1.0)col=mix(uColor1,uColor2,f);
    else if(i<2.0)col=mix(uColor2,uColor3,f);
    else col=mix(uColor3,uColor4,f);
    col=mix(col,vec3(.005,.004,.006),smoothstep(.76,.98,fbm(vec2(t*3.0,t*1.7)))*.55);
    return clamp(col,0.,1.);
  }
  void main(){
    vec2 uv=vUv;
    vec2 asp=vec2(uRes.x/uRes.y,1.);
    vec2 p=(uv-.5)*asp;
    float t=uTime*uSpeed*.12;

    float vFbm=fbm(p*.8+vec2(100.0,50.0));
    float vFbm2=fbm(p*.5+vec2(200.0,150.0));
    float vFactor=1.+uVariety*(vFbm-.5)*3.2;
    float vFactor2=1.+uVariety*(vFbm2-.5)*2.4;

    vec2 m=(uMouse-.5)*asp;
    float md=length(p-m);
    float pull=exp(-md*md*20.0)*uMouseDown;
    p+=normalize(p-m+0.0001)*pull*.18;
    p*=rot(pull*1.2*sin(uTime*2.0));

    vec2 q=p;
    q+=curl(q*1.35*vFactor2+t)*.020*uSwirl*vFactor;
    q+=curl(q*2.15*vFactor2-t*1.4)*.012*uSwirl*vFactor;

    float river=fbm(q*vec2(.58,2.2)*uDetail*vFactor2+vec2(t*.6,-t*.2));
    float angle=(river-.5)*6.28318*uStretch*vFactor2+sin(q.y*3.0+t)*.6;
    q=rot(angle*.22)*q;
    q.x+=sin(q.y*7.0+river*8.0+t*5.0)*.055*uStretch;
    q.y+=sin(q.x*5.0-river*6.0-t*3.0)*.035*uStretch;

    float n=fbm(q*2.4*uDetail*vFactor2+vec2(t*1.3,-t*.7));
    float n2=fbm(q*6.2*uDetail*vFactor2+vec2(-t*2.0,t*1.6));
    float bands=sin((q.x*.9+q.y*1.75+n*1.5)*18.0+n2*7.0);
    float marble=n*.55+n2*.22+bands*.09;

    vec3 col=pal(marble+.05*sin(uSeed));

    float blackVeins=smoothstep(.62,.88,fbm(q*3.2+vec2(2.0,-1.0)+t*.5));
    blackVeins*=smoothstep(.1,.9,sin((q.x-q.y+n)*14.0));
    col=mix(col,vec3(.002,.002,.004),blackVeins*.7);

    float e=0.003;
    float a=fbm((q+vec2(e,0.))*6.0);
    float b=fbm((q-vec2(e,0.))*6.0);
    float edge=abs(a-b)*12.0;
    col+=vec3(edge)*uEdges*.55;
    gl_FragColor=vec4(col,1.);
  }
`;

let uni = {};

function shader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s);
  return s;
}

function initGL() {
  gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) return false;

  const vs = shader(gl.VERTEX_SHADER, vertexSrc);
  const fs = shader(gl.FRAGMENT_SHADER, fragmentSrc);
  prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  uni = {
    res: U('uRes'),
    time: U('uTime'),
    speed: U('uSpeed'),
    swirl: U('uSwirl'),
    stretch: U('uStretch'),
    detail: U('uDetail'),
    edges: U('uEdges'),
    variety: U('uVariety'),
    seed: U('uSeed'),
    mouse: U('uMouse'),
    down: U('uMouseDown'),
    color1: U('uColor1'),
    color2: U('uColor2'),
    color3: U('uColor3'),
    color4: U('uColor4'),
  };

  return true;
}

function hexToRGB(hex) {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.slice(0, 2), 16) / 255,
    g: parseInt(cleaned.slice(2, 4), 16) / 255,
    b: parseInt(cleaned.slice(4, 6), 16) / 255,
  };
}

function getActivePalette() {
  if (params.palettePreset === 'custom') {
    return [params.color1, params.color2, params.color3, params.color4];
  }
  return PALETTE_PRESETS[params.palettePreset] || PALETTE_PRESETS.marbling;
}

function applyPalettePreset(presetName) {
  const colors = PALETTE_PRESETS[presetName];
  if (!colors) return;
  const updates = {
    palettePreset: presetName,
    color1: colors[0],
    color2: colors[1],
    color3: colors[2],
    color4: colors[3],
  };
  updateParams(updates);
  notifyControlUpdates(updates);
  startColorTween(colors);
}

function randomizeColors() {
  const keys = Object.keys(PALETTE_PRESETS).filter((k) => k !== 'custom');
  const preset = keys[Math.floor(Math.random() * keys.length)];
  applyPalettePreset(preset);
}

function startColorTween(hexColors) {
  tweenFrom = currentDisplayColors.map(c => ({ ...c }));
  tweenTo = hexColors.map(h => hexToRGB(h));
  tweenProgress = 0;
}

function randomizeSettings() {
  const keys = ['swirl', 'stretch', 'detail', 'edges', 'variety'];
  const ranges = [[0,3],[0,3],[0,3],[0,2],[0,1]];
  const updates = {};
  keys.forEach((k, i) => {
    updates[k] = +(ranges[i][0] + Math.random() * (ranges[i][1] - ranges[i][0])).toFixed(2);
  });
  updates.seed = Math.random() * 1000;

  const presets = Object.keys(PALETTE_PRESETS).filter(k => k !== 'custom');
  const p = presets[Math.floor(Math.random() * presets.length)];
  const colors = PALETTE_PRESETS[p];
  updates.palettePreset = p;
  updates.color1 = colors[0];
  updates.color2 = colors[1];
  updates.color3 = colors[2];
  updates.color4 = colors[3];

  updateParams(updates);
  notifyControlUpdates(updates);
  startColorTween(colors);
}

function resizeCanvas() {
  if (!gl || !container) return;
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  const dpr = Math.min(devicePixelRatio, 2);
  width = w;
  height = h;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function onPointerMove(e) {
  const r = canvas.getBoundingClientRect();
  mouseX = (e.clientX - r.left) / r.width;
  mouseY = 1 - (e.clientY - r.top) / r.height;
}

function onPointerDown(e) {
  mouseDown = 1;
  canvas.setPointerCapture(e.pointerId);
}

function onPointerUp() {
  mouseDown = 0;
}

function onResize() {
  resizeCanvas();
}

function updateAudio() {
  let rawLevel = 0;
  let rawBass = 0;
  let rawMids = 0;
  let rawTreble = 0;

  if (audioData?.getFFTData) {
    const fftData = audioData.getFFTData();
    if (fftData?.length) {
      const bandSize = Math.max(1, Math.floor(fftData.length / 3));
      let bassSum = 0;
      let midSum = 0;
      let trebleSum = 0;
      let total = 0;
      for (let i = 0; i < fftData.length; i++) {
        total += fftData[i];
        if (i < bandSize) bassSum += fftData[i];
        else if (i < bandSize * 2) midSum += fftData[i];
        else trebleSum += fftData[i];
      }
      rawLevel = total / fftData.length / 255;
      rawBass = bassSum / bandSize / 255;
      rawMids = midSum / bandSize / 255;
      rawTreble = trebleSum / bandSize / 255;
    }
  }

  const sens = params.audioReactivity || 0;
  audioBands.level = audioBands.level * AUDIO_SMOOTHING + rawLevel * sens * (1 - AUDIO_SMOOTHING);
  audioBands.bass = audioBands.bass * AUDIO_SMOOTHING + rawBass * sens * (1 - AUDIO_SMOOTHING);
  audioBands.mids = audioBands.mids * AUDIO_SMOOTHING + rawMids * sens * (1 - AUDIO_SMOOTHING);
  audioBands.treble = audioBands.treble * AUDIO_SMOOTHING + rawTreble * sens * (1 - AUDIO_SMOOTHING);
}

function animate(now) {
  animationId = requestAnimationFrame(animate);
  const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0.016;
  lastTime = now;

  updateAudio();

  const palette = getActivePalette();
  const targetColors = palette.map(hexToRGB);
  if (tweenProgress < 1) {
    tweenProgress = Math.min(1, tweenProgress + dt / TWEEN_DURATION);
    const t = 1 - Math.pow(1 - tweenProgress, 3);
    currentDisplayColors = tweenFrom.map((from, i) => ({
      r: from.r + (tweenTo[i].r - from.r) * t,
      g: from.g + (tweenTo[i].g - from.g) * t,
      b: from.b + (tweenTo[i].b - from.b) * t,
    }));
  } else {
    currentDisplayColors = targetColors;
  }

  const ms = params.mouseSim || 'none';
  if (ms !== 'none') {
    const t = now * 0.001;
    let sx, sy;
    switch (ms) {
      case 'circle':
        sx = 0.5 + 0.38 * Math.cos(t * 0.3);
        sy = 0.5 + 0.38 * Math.sin(t * 0.3);
        break;
      case 'figure8':
        sx = 0.5 + 0.38 * Math.sin(t * 0.25);
        sy = 0.5 + 0.28 * Math.sin(t * 0.5);
        break;
      case 'lissajous':
        sx = 0.5 + 0.38 * Math.sin(t * 0.9);
        sy = 0.5 + 0.38 * Math.sin(t * 0.6);
        break;
      case 'random':
        sx = 0.5 + 0.38 * (0.5 * Math.sin(t * 0.1) + 0.3 * Math.sin(t * 0.07) + 0.2 * Math.sin(t * 0.13));
        sy = 0.5 + 0.38 * (0.5 * Math.cos(t * 0.12) + 0.3 * Math.cos(t * 0.05) + 0.2 * Math.cos(t * 0.15));
        break;
    }
    mouseX = sx;
    mouseY = sy;
    mouseDown = 1;
  }

  const speedBoost = 1 + audioBands.level * 0.4;
  const swirlBoost = 1 + audioBands.bass * 0.5;
  const edgeBoost = 1 + audioBands.treble * 0.4;

  gl.uniform2f(uni.res, canvas.width, canvas.height);
  gl.uniform1f(uni.time, now * 0.001);
  gl.uniform1f(uni.speed, params.speed * speedBoost);
  gl.uniform1f(uni.swirl, params.swirl * swirlBoost);
  gl.uniform1f(uni.stretch, params.stretch);
  gl.uniform1f(uni.detail, params.detail);
  gl.uniform1f(uni.edges, params.edges * edgeBoost);
  gl.uniform1f(uni.variety, params.variety);
  gl.uniform1f(uni.seed, params.seed);
  gl.uniform2f(uni.mouse, mouseX, mouseY);
  gl.uniform1f(uni.down, mouseDown);
  gl.uniform3f(uni.color1, currentDisplayColors[0].r, currentDisplayColors[0].g, currentDisplayColors[0].b);
  gl.uniform3f(uni.color2, currentDisplayColors[1].r, currentDisplayColors[1].g, currentDisplayColors[1].b);
  gl.uniform3f(uni.color3, currentDisplayColors[2].r, currentDisplayColors[2].g, currentDisplayColors[2].b);
  gl.uniform3f(uni.color4, currentDisplayColors[3].r, currentDisplayColors[3].g, currentDisplayColors[3].b);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function handleControlMessage(event) {
  if (event.data?.type === 'PARAM_CHANGE') {
    const { param, value, data } = event.data;
    if (param === '_action' && value) {
      handleAction(value, data);
    } else {
      updateParams({ [param]: value });
    }
  }
}

function handleWindowMessage(event) {
  handleControlMessage(event);
}

function notifyControlUpdates(updates) {
  if (!controlsChannel) return;
  controlsChannel.postMessage({ type: 'PARAM_UPDATES', updates });
}

export function handleAction(action, data) {
  switch (action) {
    case 'randomizeSeed':
      params.seed = Math.random() * 1000;
      notifyControlUpdates({ seed: params.seed });
      break;
    case 'randomizeColors':
      randomizeColors();
      break;
    case 'randomizeSettings':
      randomizeSettings();
      break;
    case 'applyPreset':
      if (data?.preset) applyPalettePreset(data.preset);
      break;
    default:
      break;
  }
}

export async function initModule({ container: containerElement, audio, controlsChannel: channel }) {
  container = containerElement;
  audioData = audio;
  controlsChannel = channel;

  if (controlsChannel) {
    controlsChannel.onmessage = handleControlMessage;
  }
  window.addEventListener('message', handleWindowMessage);
  window.addEventListener('resize', onResize);

  if (!gl) {
    if (!initGL()) return;
  }

  if (container && !container.contains(canvas)) {
    container.appendChild(canvas);
  }

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  resizeCanvas();
  lastTime = 0;
}

export function start() {
  if (!animationId) {
    lastTime = 0;
    animationId = requestAnimationFrame(animate);
  }
}

export function stop() {
  clearAutoTimers();
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
}

export function destroy() {
  stop();
  window.removeEventListener('message', handleWindowMessage);
  window.removeEventListener('resize', onResize);
  canvas.removeEventListener('pointermove', onPointerMove);
  canvas.removeEventListener('pointerdown', onPointerDown);
  canvas.removeEventListener('pointerup', onPointerUp);
  canvas.removeEventListener('pointercancel', onPointerUp);
  if (controlsChannel) {
    controlsChannel.close();
    controlsChannel = null;
  }
  if (container?.contains(canvas)) {
    container.removeChild(canvas);
  }
  container = null;
  audioData = null;
}

export function updateParams(newParams) {
  Object.assign(params, newParams);
  if (newParams.palettePreset !== undefined && newParams.palettePreset !== 'custom') {
    const colors = PALETTE_PRESETS[newParams.palettePreset];
    if (colors) {
      params.color1 = colors[0];
      params.color2 = colors[1];
      params.color3 = colors[2];
      params.color4 = colors[3];
    }
  }
  if (newParams.autoRandAll !== undefined) {
    if (autoRandAllTimer) { clearInterval(autoRandAllTimer); autoRandAllTimer = null; }
    if (newParams.autoRandAll > 0) {
      autoRandAllTimer = setInterval(() => randomizeSettings(), newParams.autoRandAll * 1000);
    }
  }
  if (newParams.autoRandColors !== undefined) {
    if (autoRandColorsTimer) { clearInterval(autoRandColorsTimer); autoRandColorsTimer = null; }
    if (newParams.autoRandColors > 0) {
      autoRandColorsTimer = setInterval(() => randomizeColors(), newParams.autoRandColors * 1000);
    }
  }
}

if (typeof window !== 'undefined') {
  window.moduleAPI = {
    initModule,
    start,
    stop,
    destroy,
    updateParams,
    handleAction,
  };
}
