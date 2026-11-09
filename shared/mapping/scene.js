/**
 * Projection-mapping scene model.
 * Coordinates are projector pixels, independent of editor zoom.
 * Content assignment is data on the surface. The viewer decides how to draw it.
 */

export const DEFAULT_OUTPUT = { width: 1920, height: 1080 };

const FILLS = ['#3d8bfd', '#e85d4c', '#3cba8b', '#e6b325', '#b06bdb', '#ef7d3c'];
const KAPPA = 0.5522847498;

let fallbackSerial = 0;

export function createScene() {
  return {
    version: 1,
    output: { ...DEFAULT_OUTPUT },
    surfaces: [],
  };
}

export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  fallbackSerial += 1;
  return `surface-${Date.now().toString(36)}-${fallbackSerial}`;
}

function placement(scene) {
  const { width, height } = scene.output;
  const size = Math.round(Math.min(width, height) * 0.28);
  const index = scene.surfaces.length;
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x = Math.round(width * 0.12 + column * size * 1.15);
  const y = Math.round(height * 0.16 + row * size * 1.15);
  return { x, y, size, index, cx: x + size / 2, cy: y + size / 2 };
}

function blank(scene, type, name) {
  const { index } = placement(scene);
  return {
    id: createId(),
    name: name || `Surface ${index + 1}`,
    type,
    visible: true,
    locked: false,
    opacity: 1,
    color: FILLS[index % FILLS.length],
    points: [],
    ellipse: null,
    anchors: null,
    content: {
      kind: 'color',
      moduleId: null,
      moduleName: '',
      pattern: 'solid',
      preset: '',
      frame: { x: 0, y: 0, width: 100, height: 100 },
    },
    audio: { enabled: false, signal: 'level', sensitivity: 1, smoothing: 0.65 },
  };
}

function regularPoints(cx, cy, radius, sides, rotation = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, index) => {
    const angle = rotation + (index * 2 * Math.PI) / sides;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });
}

export function createRectangle(scene) {
  const { x, y, size } = placement(scene);
  return {
    ...blank(scene, 'quad'),
    points: [
      { x, y },
      { x: x + size, y },
      { x: x + size, y: y + size },
      { x, y: y + size },
    ],
  };
}

export function createTriangle(scene) {
  const { cx, cy, size } = placement(scene);
  return { ...blank(scene, 'polygon'), points: regularPoints(cx, cy, size / 2, 3) };
}

export function createPolygon(scene, sides) {
  const { cx, cy, size } = placement(scene);
  return { ...blank(scene, 'polygon'), points: regularPoints(cx, cy, size / 2, sides) };
}

export function createCircle(scene) {
  const { cx, cy, size } = placement(scene);
  return { ...blank(scene, 'circle'), ellipse: { cx, cy, rx: size / 2, ry: size / 2, rotation: 0 } };
}

export function createEllipse(scene) {
  const { cx, cy, size } = placement(scene);
  return { ...blank(scene, 'ellipse'), ellipse: { cx, cy, rx: size / 2, ry: size / 3, rotation: 0 } };
}

export function createBezier(scene) {
  const { x, y, size } = placement(scene);
  const right = x + size;
  const bottom = y + size;
  const cx = x + size / 2;
  const cy = y + size / 2;
  const kx = size * KAPPA / 2;
  const ky = size * KAPPA / 2;
  return {
    ...blank(scene, 'bezier'),
    anchors: [
      { x: cx, y, in: { x: cx - kx, y }, out: { x: cx + kx, y } },
      { x: right, y: cy, in: { x: right, y: cy - ky }, out: { x: right, y: cy + ky } },
      { x: cx, y: bottom, in: { x: cx + kx, y: bottom }, out: { x: cx - kx, y: bottom } },
      { x, y: cy, in: { x, y: cy + ky }, out: { x, y: cy - ky } },
    ],
  };
}

const FACTORIES = {
  rectangle: createRectangle,
  triangle: createTriangle,
  circle: createCircle,
  ellipse: createEllipse,
  pentagon: (scene) => createPolygon(scene, 5),
  hexagon: (scene) => createPolygon(scene, 6),
  bezier: createBezier,
};

export function addSurface(scene, kind = 'rectangle') {
  const create = FACTORIES[kind] || createRectangle;
  return { ...scene, surfaces: [...scene.surfaces, create(scene)] };
}

export function addRectangle(scene) {
  return addSurface(scene, 'rectangle');
}

export function updateSurface(scene, id, recipe) {
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => (surface.id === id ? recipe(surface) : surface)),
  };
}

function shiftPoint(point, dx, dy) {
  return { x: point.x + dx, y: point.y + dy };
}

export function moveSurface(surface, dx, dy) {
  return {
    ...surface,
    points: (surface.points || []).map((point) => shiftPoint(point, dx, dy)),
    ellipse: surface.ellipse
      ? { ...surface.ellipse, cx: surface.ellipse.cx + dx, cy: surface.ellipse.cy + dy }
      : surface.ellipse,
    anchors: surface.anchors
      ? surface.anchors.map((anchor) => ({
        ...anchor,
        x: anchor.x + dx,
        y: anchor.y + dy,
        in: shiftPoint(anchor.in, dx, dy),
        out: shiftPoint(anchor.out, dx, dy),
      }))
      : surface.anchors,
  };
}

export function setCorner(surface, index, point) {
  return {
    ...surface,
    points: surface.points.map((current, currentIndex) => (
      currentIndex === index ? { x: point.x, y: point.y } : current
    )),
  };
}

export function insertPoint(surface, edgeIndex, point) {
  const points = surface.points.slice();
  points.splice(edgeIndex + 1, 0, { x: point.x, y: point.y });
  return { ...surface, type: 'polygon', points };
}

export function removePoint(surface, index) {
  if (!surface.points || surface.points.length <= 3) return surface;
  return {
    ...surface,
    type: 'polygon',
    points: surface.points.filter((_, current) => current !== index),
  };
}

export function setAnchor(surface, index, point) {
  const current = surface.anchors[index];
  const dx = point.x - current.x;
  const dy = point.y - current.y;
  return {
    ...surface,
    anchors: surface.anchors.map((anchor, current) => (current === index ? {
      x: point.x,
      y: point.y,
      in: shiftPoint(anchor.in, dx, dy),
      out: shiftPoint(anchor.out, dx, dy),
    } : anchor)),
  };
}

export function setHandle(surface, index, which, point, smooth = true) {
  return {
    ...surface,
    anchors: surface.anchors.map((anchor, current) => {
      if (current !== index) return anchor;
      const next = {
        ...anchor,
        [which]: { x: point.x, y: point.y },
      };
      if (smooth) {
        const other = which === 'in' ? 'out' : 'in';
        next[other] = { x: anchor.x * 2 - point.x, y: anchor.y * 2 - point.y };
      }
      return next;
    }),
  };
}

function splitCubic(p0, p1, p2, p3) {
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const a = mid(p0, p1);
  const b = mid(p1, p2);
  const c = mid(p2, p3);
  const d = mid(a, b);
  const e = mid(b, c);
  const point = mid(d, e);
  return { out: a, in: d, point, nextOut: e, nextIn: c };
}

export function insertAnchor(surface, segmentIndex) {
  const anchors = surface.anchors.slice();
  const current = anchors[segmentIndex];
  const nextIndex = (segmentIndex + 1) % anchors.length;
  const next = anchors[nextIndex];
  const split = splitCubic(current, current.out, next.in, next);
  const added = { x: split.point.x, y: split.point.y, in: split.in, out: split.nextOut };
  anchors[segmentIndex] = { ...current, out: split.out };
  anchors[nextIndex] = { ...next, in: split.nextIn };
  anchors.splice(segmentIndex + 1, 0, added);
  return { ...surface, anchors };
}

export function removeAnchor(surface, index) {
  if (!surface.anchors || surface.anchors.length <= 3) return surface;
  return { ...surface, anchors: surface.anchors.filter((_, current) => current !== index) };
}

export function setEllipseRadius(surface, axis, value) {
  const radius = Math.max(8, value);
  const ellipse = { ...surface.ellipse };
  if (surface.type === 'circle') {
    ellipse.rx = radius;
    ellipse.ry = radius;
  } else {
    ellipse[axis] = radius;
  }
  return { ...surface, ellipse };
}

function spinPoint(point, origin, radians) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

export function rotateSurface(surface, radians, origin) {
  if (!radians) return surface;
  if (surface.ellipse) {
    const center = spinPoint({ x: surface.ellipse.cx, y: surface.ellipse.cy }, origin, radians);
    return {
      ...surface,
      ellipse: {
        ...surface.ellipse,
        cx: center.x,
        cy: center.y,
        rotation: (surface.ellipse.rotation || 0) + radians,
      },
    };
  }
  const spin = (point) => spinPoint(point, origin, radians);
  return {
    ...surface,
    points: (surface.points || []).map(spin),
    anchors: surface.anchors ? surface.anchors.map((anchor) => ({
      ...anchor,
      ...spin(anchor),
      in: spin(anchor.in),
      out: spin(anchor.out),
    })) : surface.anchors,
  };
}

export function scaleSurface(surface, sx, sy, origin) {
  const scale = (point) => ({
    x: origin.x + (point.x - origin.x) * sx,
    y: origin.y + (point.y - origin.y) * sy,
  });
  if (surface.ellipse) {
    const center = scale({ x: surface.ellipse.cx, y: surface.ellipse.cy });
    const rx = Math.max(8, surface.ellipse.rx * Math.abs(sx));
    const ry = Math.max(8, surface.ellipse.ry * Math.abs(sy));
    const type = surface.type === 'circle' && Math.abs(rx - ry) > 0.5 ? 'ellipse' : surface.type;
    return { ...surface, type, ellipse: { ...surface.ellipse, cx: center.x, cy: center.y, rx, ry } };
  }
  return {
    ...surface,
    points: (surface.points || []).map(scale),
    anchors: surface.anchors ? surface.anchors.map((anchor) => ({
      ...anchor,
      ...scale(anchor),
      in: scale(anchor.in),
      out: scale(anchor.out),
    })) : surface.anchors,
  };
}

export function duplicateSurface(scene, id, offset = { x: 36, y: 36 }) {
  const index = scene.surfaces.findIndex((surface) => surface.id === id);
  if (index < 0) return scene;
  const copy = moveSurface(JSON.parse(JSON.stringify(scene.surfaces[index])), offset.x || 0, offset.y || 0);
  copy.id = createId();
  copy.name = `${scene.surfaces[index].name} copy`;
  copy.locked = false;
  const surfaces = scene.surfaces.slice();
  surfaces.splice(index + 1, 0, copy);
  return { ...scene, surfaces };
}

export function reorderSurface(scene, id, direction) {
  const index = scene.surfaces.findIndex((surface) => surface.id === id);
  if (index < 0) return scene;
  const surfaces = scene.surfaces.slice();
  const [item] = surfaces.splice(index, 1);
  const last = surfaces.length;
  const dest = {
    front: last,
    back: 0,
    forward: Math.min(last, index + 1),
    backward: Math.max(0, index - 1),
  }[direction];
  surfaces.splice(dest ?? index, 0, item);
  return { ...scene, surfaces };
}

export function pointInPolygon(point, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const current = points[i];
    const previous = points[j];
    const crosses = (current.y > point.y) !== (previous.y > point.y);
    const xAtY = ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 1e-9) + current.x;
    if (crosses && point.x < xAtY) inside = !inside;
  }
  return inside;
}

export function nearestCorner(surface, point, radius) {
  const corners = surface.points || [];
  const limit = radius * radius;
  let best = -1;
  let bestDistance = limit;
  corners.forEach((corner, index) => {
    const dx = corner.x - point.x;
    const dy = corner.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance <= bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

export function nearestEdge(points, point) {
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const abx = end.x - start.x;
    const aby = end.y - start.y;
    const length = abx * abx + aby * aby || 1e-9;
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * abx + (point.y - start.y) * aby) / length));
    const x = start.x + abx * t;
    const y = start.y + aby * t;
    const distance = Math.hypot(point.x - x, point.y - y);
    if (!best || distance < best.distance) best = { index, point: { x, y }, distance };
  }
  return best;
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export function nearestBezier(anchors, point) {
  let best = null;
  for (let index = 0; index < anchors.length; index += 1) {
    const current = anchors[index];
    const next = anchors[(index + 1) % anchors.length];
    for (let step = 0; step <= 24; step += 1) {
      const sample = cubicPoint(current, current.out, next.in, next, step / 24);
      const distance = Math.hypot(point.x - sample.x, point.y - sample.y);
      if (!best || distance < best.distance) best = { index, point: sample, distance };
    }
  }
  return best;
}

function finitePoint(point, fallback = { x: 0, y: 0 }) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return fallback;
  return point;
}

export function ellipseHandles(surface) {
  const ellipse = surface?.ellipse;
  if (!ellipse || !Number.isFinite(ellipse.cx) || !Number.isFinite(ellipse.cy)) {
    return { center: { x: 0, y: 0 }, rx: { x: 0, y: 0 }, ry: { x: 0, y: 0 } };
  }
  const { cx, cy, rotation = 0 } = ellipse;
  const rx = Number.isFinite(ellipse.rx) ? ellipse.rx : 0;
  const ry = Number.isFinite(ellipse.ry) ? ellipse.ry : 0;
  const c = Math.cos(rotation || 0);
  const s = Math.sin(rotation || 0);
  const at = (dx, dy) => ({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
  return { center: { x: cx, y: cy }, rx: at(rx, 0), ry: at(0, ry) };
}

export function boundsOf(surface) {
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
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0, cx: 0, cy: 0 };
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

export function outlinePoints(surface, steps = 32) {
  if (surface.ellipse) {
    const { cx, cy, rx, ry, rotation = 0 } = surface.ellipse;
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    return Array.from({ length: steps }, (_, index) => {
      const angle = (index / steps) * Math.PI * 2;
      const dx = Math.cos(angle) * rx;
      const dy = Math.sin(angle) * ry;
      return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    });
  }
  if (surface.anchors?.length) {
    const points = [];
    for (let index = 0; index < surface.anchors.length; index += 1) {
      const current = surface.anchors[index];
      const next = surface.anchors[(index + 1) % surface.anchors.length];
      if (!current?.out || !next?.in) continue;
      for (let step = 0; step < steps; step += 1) {
        points.push(cubicPoint(current, current.out, next.in, next, step / steps));
      }
    }
    return points;
  }
  return surface.points || [];
}

function formatPoint(point) {
  return `${point.x} ${point.y}`;
}

export function surfacePath(surface) {
  if (!surface) return '';
  if (surface.ellipse) {
    const { cx, cy, rotation = 0 } = surface.ellipse;
    const rx = surface.ellipse.rx;
    const ry = surface.ellipse.ry;
    if (![cx, cy, rx, ry, rotation].every(Number.isFinite) || rx <= 0 || ry <= 0) return '';
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    const at = (dx, dy) => formatPoint({ x: cx + dx * c - dy * s, y: cy + dx * s + dy * c });
    const degrees = (rotation * 180) / Math.PI;
    return `M ${at(rx, 0)} A ${rx} ${ry} ${degrees} 1 0 ${at(-rx, 0)} A ${rx} ${ry} ${degrees} 1 0 ${at(rx, 0)} Z`;
  }
  if (surface.anchors?.length) {
    const anchors = surface.anchors.filter((anchor) => finitePoint(anchor) === anchor && anchor.out && anchor.in);
    if (anchors.length < 2) return '';
    let path = `M ${formatPoint(anchors[0])}`;
    for (let index = 0; index < anchors.length; index += 1) {
      const current = anchors[index];
      const next = anchors[(index + 1) % anchors.length];
      path += ` C ${formatPoint(finitePoint(current.out))} ${formatPoint(finitePoint(next.in))} ${formatPoint(next)}`;
    }
    return `${path} Z`;
  }
  const points = (surface.points || []).filter((point) => finitePoint(point) === point);
  if (!points.length) return '';
  return `M ${points.map(formatPoint).join(' L ')} Z`;
}

export function tileModule(scene, ids, assignment) {
  const wanted = new Set(ids);
  const targets = scene.surfaces.filter((surface) => wanted.has(surface.id) && !surface.locked);
  const boxes = targets
    .map((surface) => ({ id: surface.id, bounds: boundsOf(surface) }))
    .filter((item) => item.bounds.width >= 1 && item.bounds.height >= 1);
  if (boxes.length < 2) return scene;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  boxes.forEach(({ bounds }) => {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });
  const unionWidth = maxX - minX;
  const unionHeight = maxY - minY;
  const included = new Set(boxes.map((item) => item.id));
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!included.has(surface.id)) return surface;
      const bounds = boundsOf(surface);
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          kind: assignment.kind || 'module',
          moduleId: assignment.moduleId,
          moduleName: assignment.moduleName || assignment.moduleId,
          pattern: 'solid',
          preset: assignment.preset || '',
          span: 'tile',
          frame: {
            x: ((minX - bounds.x) / bounds.width) * 100,
            y: ((minY - bounds.y) / bounds.height) * 100,
            width: (unionWidth / bounds.width) * 100,
            height: (unionHeight / bounds.height) * 100,
          },
        },
      };
    }),
  };
}

export function instanceModule(scene, ids, assignment) {
  const wanted = new Set(ids);
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!wanted.has(surface.id) || surface.locked) return surface;
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          kind: assignment.kind || 'module',
          moduleId: assignment.moduleId,
          moduleName: assignment.moduleName || assignment.moduleId,
          pattern: 'solid',
          preset: assignment.preset || '',
          span: 'instance',
          tileId: null,
          frame: { x: 0, y: 0, width: 100, height: 100 },
        },
      };
    }),
  };
}

function unionOf(surfaces) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  surfaces.forEach((surface) => {
    const bounds = boundsOf(surface);
    if (bounds.width < 1 || bounds.height < 1) return;
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  });
  if (!Number.isFinite(minX) || maxX - minX < 1 || maxY - minY < 1) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function pictureRect(surface) {
  const bounds = boundsOf(surface);
  const frame = contentFrame(surface);
  return {
    x: bounds.x + (bounds.width * frame.x) / 100,
    y: bounds.y + (bounds.height * frame.y) / 100,
    width: Math.max(1, (bounds.width * frame.width) / 100),
    height: Math.max(1, (bounds.height * frame.height) / 100),
  };
}

function averagePoint(points) {
  const count = points.length || 1;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / count,
    y: points.reduce((sum, point) => sum + point.y, 0) / count,
  };
}

export function surfaceAxes(surface) {
  const ellipse = surface?.ellipse;
  if (ellipse && Number.isFinite(ellipse.cx) && Number.isFinite(ellipse.cy)) {
    return {
      cx: ellipse.cx,
      cy: ellipse.cy,
      width: Math.max(1, (ellipse.rx || 0) * 2),
      height: Math.max(1, (ellipse.ry || 0) * 2),
      angle: ellipse.rotation || 0,
    };
  }
  const raw = surface?.anchors?.length ? surface.anchors : surface?.points;
  const points = (raw || []).filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (surface?.type === 'quad' && points.length === 4) {
    const [a, b, c, d] = points;
    return {
      cx: (a.x + c.x) / 2,
      cy: (a.y + c.y) / 2,
      width: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      height: Math.max(1, Math.hypot(d.x - a.x, d.y - a.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }
  if (points.length >= 2) {
    const center = averagePoint(points);
    const base = Math.atan2(points[0].y - center.y, points[0].x - center.x);
    const angle = base + Math.PI / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    points.forEach((point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      minX = Math.min(minX, lx);
      minY = Math.min(minY, ly);
      maxX = Math.max(maxX, lx);
      maxY = Math.max(maxY, ly);
    });
    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    return {
      cx: center.x + midX * c - midY * s,
      cy: center.y + midX * s + midY * c,
      width,
      height,
      angle,
    };
  }
  const bounds = boundsOf(surface);
  return {
    cx: bounds.cx,
    cy: bounds.cy,
    width: Math.max(1, bounds.width),
    height: Math.max(1, bounds.height),
    angle: 0,
  };
}

export function moduleOverlay(surface) {
  const axes = surfaceAxes(surface);
  const frame = contentFrame(surface);
  const width = Math.max(1, (axes.width * frame.width) / 100);
  const height = Math.max(1, (axes.height * frame.height) / 100);
  const x = axes.cx - axes.width / 2 + (axes.width * frame.x) / 100;
  const y = axes.cy - axes.height / 2 + (axes.height * frame.y) / 100;
  return {
    x,
    y,
    width,
    height,
    cx: axes.cx,
    cy: axes.cy,
    axesWidth: axes.width,
    axesHeight: axes.height,
    centerX: x + width / 2,
    centerY: y + height / 2,
    surfaceDegrees: (axes.angle * 180) / Math.PI,
    moduleDegrees: frame.rotation,
  };
}

export function frameFromModuleRect(overlay, rect) {
  const left = overlay.cx - overlay.axesWidth / 2;
  const top = overlay.cy - overlay.axesHeight / 2;
  return {
    x: ((rect.x - left) / overlay.axesWidth) * 100,
    y: ((rect.y - top) / overlay.axesHeight) * 100,
    width: (rect.width / overlay.axesWidth) * 100,
    height: (rect.height / overlay.axesHeight) * 100,
    rotation: wrapDegrees(rect.rotation || 0),
  };
}

export function tileMembers(scene, surface) {
  const tileId = surface?.content?.tileId;
  if (!surface || !tileId || surface.content?.span !== 'tile') return surface ? [surface.id] : [];
  const members = scene.surfaces
    .filter((item) => item.content?.tileId === tileId && !item.locked)
    .map((item) => item.id);
  return members.length ? members : [surface.id];
}

export function writePicture(scene, ids, rect) {
  const wanted = new Set(ids);
  const width = Math.max(8, rect.width);
  const height = Math.max(8, rect.height);
  const rotation = Number.isFinite(rect.rotation) ? wrapDegrees(rect.rotation) : null;
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!wanted.has(surface.id) || surface.locked) return surface;
      const bounds = boundsOf(surface);
      if (bounds.width < 1 || bounds.height < 1) return surface;
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          frame: {
            x: ((rect.x - bounds.x) / bounds.width) * 100,
            y: ((rect.y - bounds.y) / bounds.height) * 100,
            width: (width / bounds.width) * 100,
            height: (height / bounds.height) * 100,
            rotation: rotation ?? contentFrame(surface).rotation,
          },
        },
      };
    }),
  };
}

export function resizePicture(rect, dx, dy) {
  const rotation = wrapDegrees(rect.rotation || 0);
  const rad = rotation * Math.PI / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const width = Math.max(8, rect.width + dx * c + dy * s);
  const height = Math.max(8, rect.height - dx * s + dy * c);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const ax = cx - (rect.width / 2) * c + (rect.height / 2) * s;
  const ay = cy - (rect.width / 2) * s - (rect.height / 2) * c;
  const ncx = ax + (width / 2) * c - (height / 2) * s;
  const ncy = ay + (width / 2) * s + (height / 2) * c;
  return {
    x: ncx - width / 2,
    y: ncy - height / 2,
    width,
    height,
    rotation,
  };
}

export function tileSurfaces(scene, ids) {
  const targets = [];
  ids.forEach((id) => {
    const surface = scene.surfaces.find((item) => item.id === id);
    if (!surface || surface.locked || !surface.visible || targets.some((item) => item.id === surface.id)) return;
    targets.push(surface);
  });
  const union = unionOf(targets);
  if (!union || targets.length < 2) return scene;
  const tileId = createId();
  const lead = targets[0].content || {};
  const included = new Set(targets.map((surface) => surface.id));
  const grouped = {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!included.has(surface.id)) return surface;
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          kind: lead.kind || 'color',
          moduleId: lead.moduleId || null,
          moduleName: lead.moduleName || '',
          pattern: lead.pattern || 'solid',
          preset: lead.preset || '',
          span: 'tile',
          tileId,
        },
      };
    }),
  };
  return writePicture(grouped, [...included], union);
}

export function clearModules(scene, ids) {
  const expanded = new Set();
  ids.forEach((id) => {
    const surface = scene.surfaces.find((item) => item.id === id);
    if (!surface) return;
    tileMembers(scene, surface).forEach((member) => expanded.add(member));
  });
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!expanded.has(surface.id)) return surface;
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          kind: 'color',
          moduleId: null,
          moduleName: '',
          pattern: 'solid',
          preset: '',
        },
      };
    }),
  };
}

export function assignModule(scene, ids, assignment) {
  const expanded = new Set();
  ids.forEach((id) => {
    const surface = scene.surfaces.find((item) => item.id === id);
    if (!surface || surface.locked) return;
    tileMembers(scene, surface).forEach((member) => expanded.add(member));
  });
  const selected = scene.surfaces.filter((surface) => expanded.has(surface.id));
  const tileIds = [...new Set(selected.map((surface) => (
    surface.content?.span === 'tile' ? surface.content.tileId : null
  )).filter(Boolean))];
  const sameTile = tileIds.length === 1
    && selected.every((surface) => surface.content?.tileId === tileIds[0]);
  const targets = sameTile
    ? scene.surfaces.filter((surface) => surface.content?.tileId === tileIds[0] && !surface.locked)
    : selected;
  const tiled = sameTile && targets.length > 1;
  const targetIds = new Set(targets.map((surface) => surface.id));
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!targetIds.has(surface.id) || surface.locked) return surface;
      const same = surface.content?.moduleId === assignment.moduleId
        && surface.content?.kind === (assignment.kind || 'module');
      return {
        ...surface,
        content: {
          ...(surface.content || {}),
          kind: assignment.kind || 'module',
          moduleId: assignment.moduleId,
          moduleName: assignment.moduleName || assignment.moduleId || '',
          pattern: 'solid',
          preset: same ? (surface.content?.preset || '') : (assignment.preset || ''),
          span: tiled ? 'tile' : 'instance',
          tileId: tiled ? surface.content.tileId : null,
          frame: tiled || same ? contentFrame(surface) : { x: 0, y: 0, width: 100, height: 100 },
        },
      };
    }),
  };
}

export function layerPercents(scene, id) {
  const surface = scene.surfaces.find((item) => item.id === id);
  if (!surface) return { members: [], x: 0, y: 0, width: 100, height: 100, rotation: 0 };
  const members = tileMembers(scene, surface);
  const frame = contentFrame(surface);
  if (members.length <= 1) return { members, ...frame };
  const surfaces = members.map((member) => scene.surfaces.find((item) => item.id === member)).filter(Boolean);
  const union = unionOf(surfaces) || boundsOf(surface);
  const rect = pictureRect(surface);
  return {
    members,
    x: ((rect.x - union.x) / union.width) * 100,
    y: ((rect.y - union.y) / union.height) * 100,
    width: (rect.width / union.width) * 100,
    height: (rect.height / union.height) * 100,
    rotation: frame.rotation,
  };
}

export function writeFrame(scene, ids, frame) {
  const wanted = new Set(ids);
  const next = contentFrame({ content: { frame } });
  return {
    ...scene,
    surfaces: scene.surfaces.map((surface) => {
      if (!wanted.has(surface.id) || surface.locked) return surface;
      return {
        ...surface,
        content: { ...(surface.content || {}), frame: next },
      };
    }),
  };
}

export function pictureFromPercents(scene, id, percents) {
  const surface = scene.surfaces.find((item) => item.id === id);
  const members = surface ? tileMembers(scene, surface) : [];
  const surfaces = members.map((member) => scene.surfaces.find((item) => item.id === member)).filter(Boolean);
  const union = unionOf(surfaces) || (surface ? boundsOf(surface) : { x: 0, y: 0, width: 1, height: 1 });
  return {
    members,
    rect: {
      x: union.x + (union.width * percents.x) / 100,
      y: union.y + (union.height * percents.y) / 100,
      width: Math.max(8, (union.width * percents.width) / 100),
      height: Math.max(8, (union.height * percents.height) / 100),
    },
  };
}

export function wrapDegrees(value) {
  if (!Number.isFinite(value)) return 0;
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function contentFrame(surface) {
  const frame = surface?.content?.frame || {};
  const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);
  return {
    x: number(frame.x, 0),
    y: number(frame.y, 0),
    width: Math.max(5, number(frame.width, 100)),
    height: Math.max(5, number(frame.height, 100)),
    rotation: wrapDegrees(number(frame.rotation, 0)),
  };
}

export function snapValue(value, grid) {
  if (!grid) return value;
  return Math.round(value / grid) * grid;
}

export function centroid(surface) {
  const bounds = boundsOf(surface);
  return { x: bounds.cx, y: bounds.cy };
}
