/**
 * Maps a source rectangle onto a four-corner quad.
 * The 3x3 is row-major. matrix3d() is the CSS form of that transform.
 */

function adjugate(m) {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

function multiply(a, b) {
  const out = new Array(9);
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

function applyVector(m, v) {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
  const basis = [x1, x2, x3, y1, y2, y3, 1, 1, 1];
  const scale = applyVector(adjugate(basis), [x4, y4, 1]);
  return multiply(basis, [scale[0], 0, 0, 0, scale[1], 0, 0, 0, scale[2]]);
}

export function projectPoint(matrix, x, y) {
  const w = matrix[6] * x + matrix[7] * y + matrix[8];
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / w,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / w,
  };
}

export function quadHomography(width, height, destination) {
  if (!destination || destination.length !== 4 || width < 1 || height < 1) return null;
  const [p0, p1, p2, p3] = destination;
  const source = basisToPoints(0, 0, width, 0, width, height, 0, height);
  const dest = basisToPoints(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
  const matrix = multiply(dest, adjugate(source));
  if (!matrix[8]) return null;
  const normalized = matrix.map((value) => value / matrix[8]);
  if (normalized.some((value) => !Number.isFinite(value))) return null;
  const corners = [[0, 0, p0], [width, 0, p1], [width, height, p2], [0, height, p3]];
  const accurate = corners.every(([x, y, point]) => {
    const projected = projectPoint(normalized, x, y);
    return Math.abs(projected.x - point.x) < 0.5 && Math.abs(projected.y - point.y) < 0.5;
  });
  return accurate ? normalized : null;
}

export function matrix3d(matrix) {
  const [a, b, c, d, e, f, g, h, i] = matrix;
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,${i})`;
}
