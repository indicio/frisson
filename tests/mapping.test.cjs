const { test } = require('node:test');
const assert = require('node:assert/strict');

test('a rectangle can be added, moved, and warped by one corner', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  const scene = mapping.addRectangle(mapping.createScene());
  const surface = scene.surfaces[0];
  assert.equal(surface.points.length, 4);
  assert.ok(surface.points.every((point) => point.x >= 0 && point.y >= 0));
  assert.ok(surface.points.every((point) => point.x <= 1920 && point.y <= 1080));

  const moved = mapping.moveSurface(surface, 12, -4);
  assert.equal(moved.points[0].x, surface.points[0].x + 12);
  assert.equal(moved.points[3].y, surface.points[3].y - 4);
  assert.equal(surface.points[0].x, scene.surfaces[0].points[0].x);

  const warped = mapping.setCorner(moved, 2, { x: 1400, y: 900 });
  assert.deepEqual(warped.points[2], { x: 1400, y: 900 });
  assert.deepEqual(warped.points[0], moved.points[0]);
  assert.equal(mapping.pointInPolygon(
    { x: (warped.points[0].x + warped.points[1].x) / 2, y: (warped.points[0].y + warped.points[3].y) / 2 },
    warped.points,
  ), true);
  assert.equal(mapping.nearestCorner(warped, warped.points[1], 8), 1);
  assert.equal(mapping.nearestCorner(warped, { x: -1000, y: -1000 }, 8), -1);
});

test('primitive shapes, point insertion, and closed bezier anchors', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  const scene = ['triangle', 'circle', 'ellipse', 'pentagon', 'hexagon', 'bezier']
    .reduce((current, kind) => mapping.addSurface(current, kind), mapping.createScene());
  const [triangle, circle, ellipse, pentagon, hexagon, bezier] = scene.surfaces;
  assert.equal(triangle.points.length, 3);
  assert.equal(circle.ellipse.rx, circle.ellipse.ry);
  assert.ok(ellipse.ellipse.rx > ellipse.ellipse.ry);
  assert.equal(pentagon.points.length, 5);
  assert.equal(hexagon.points.length, 6);
  assert.equal(bezier.anchors.length, 4);

  const edge = mapping.nearestEdge(triangle.points, {
    x: (triangle.points[0].x + triangle.points[1].x) / 2,
    y: (triangle.points[0].y + triangle.points[1].y) / 2,
  });
  const withPoint = mapping.insertPoint(triangle, edge.index, edge.point);
  assert.equal(withPoint.points.length, 4);
  assert.equal(mapping.removePoint(withPoint, 1).points.length, 3);
  assert.equal(mapping.removePoint(triangle, 0), triangle);

  const movedCircle = mapping.moveSurface(circle, 10, -5);
  assert.equal(movedCircle.ellipse.cx, circle.ellipse.cx + 10);
  assert.equal(movedCircle.ellipse.cy, circle.ellipse.cy - 5);
  const resized = mapping.setEllipseRadius(circle, 'rx', 80);
  assert.equal(resized.ellipse.rx, 80);
  assert.equal(resized.ellipse.ry, 80);

  const split = mapping.insertAnchor(bezier, 0);
  assert.equal(split.anchors.length, 5);
  const dragged = mapping.setHandle(split, 0, 'out', { x: split.anchors[0].x + 40, y: split.anchors[0].y }, true);
  assert.equal(dragged.anchors[0].in.x, split.anchors[0].x - 40);
  const shifted = mapping.setAnchor(dragged, 1, { x: dragged.anchors[1].x + 12, y: dragged.anchors[1].y });
  assert.equal(shifted.anchors[1].out.x, dragged.anchors[1].out.x + 12);
  assert.ok(mapping.surfacePath(bezier).includes('C'));
  assert.ok(mapping.surfacePath(ellipse).includes('A'));
});

test('duplicate keeps geometry and layer order moves the surface', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  const scene = mapping.addSurface(mapping.addRectangle(mapping.createScene()), 'circle');
  const duplicated = mapping.duplicateSurface(scene, scene.surfaces[0].id);
  assert.equal(duplicated.surfaces.length, 3);
  assert.equal(duplicated.surfaces[1].points[0].x, scene.surfaces[0].points[0].x + 36);
  assert.notEqual(duplicated.surfaces[1].id, scene.surfaces[0].id);
  const placed = mapping.duplicateSurface(scene, scene.surfaces[0].id, { x: 0, y: 0 });
  assert.equal(placed.surfaces[1].points[0].x, scene.surfaces[0].points[0].x);
  assert.equal(placed.surfaces[1].points[0].y, scene.surfaces[0].points[0].y);
  const front = mapping.reorderSurface(duplicated, duplicated.surfaces[0].id, 'front');
  assert.equal(front.surfaces.at(-1).id, duplicated.surfaces[0].id);
});

test('a quad homography maps the source rectangle onto the destination corners', async () => {
  const { quadHomography, projectPoint } = await import('../shared/mapping/homography.js');
  const destination = [
    { x: 10, y: 20 },
    { x: 210, y: 30 },
    { x: 200, y: 140 },
    { x: 20, y: 120 },
  ];
  const matrix = quadHomography(100, 50, destination);
  assert.ok(matrix);
  const corners = [[0, 0], [100, 0], [100, 50], [0, 50]];
  corners.forEach(([x, y], index) => {
    const projected = projectPoint(matrix, x, y);
    assert.ok(Math.abs(projected.x - destination[index].x) < 0.2);
    assert.ok(Math.abs(projected.y - destination[index].y) < 0.2);
  });
  assert.equal(quadHomography(0, 10, destination), null);
});

test('tiling spreads one module across the surfaces', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  let scene = mapping.addRectangle(mapping.createScene());
  scene = mapping.addRectangle(scene);
  const untouched = scene.surfaces[0].content.kind;
  scene = mapping.tileModule(scene, scene.surfaces.map((surface) => surface.id), {
    kind: 'module',
    moduleId: 'bigSolid',
    moduleName: 'Big Solid',
    preset: 'fruit-loops',
  });
  const [first, second] = scene.surfaces;
  assert.equal(first.content.moduleId, 'bigSolid');
  assert.equal(first.content.span, 'tile');
  assert.equal(second.content.preset, 'fruit-loops');
  assert.notEqual(untouched, 'module');
  const boxA = mapping.boundsOf(first);
  const boxB = mapping.boundsOf(second);
  const frameA = mapping.contentFrame(first);
  const frameB = mapping.contentFrame(second);
  const origin = (box, frame, axis) => box[axis] + box[axis === 'x' ? 'width' : 'height'] * frame[axis] / 100;
  const span = (box, frame, axis) => box[axis === 'x' ? 'width' : 'height'] * frame[axis === 'x' ? 'width' : 'height'] / 100;
  assert.ok(Math.abs(origin(boxA, frameA, 'x') - origin(boxB, frameB, 'x')) < 0.5);
  assert.ok(Math.abs(origin(boxA, frameA, 'y') - origin(boxB, frameB, 'y')) < 0.5);
  assert.ok(Math.abs(span(boxA, frameA, 'x') - span(boxB, frameB, 'x')) < 0.5);
  assert.ok(Math.abs(span(boxA, frameA, 'y') - span(boxB, frameB, 'y')) < 0.5);
  assert.equal(mapping.tileModule(scene, [first.id], { moduleId: 'bigSolid' }), scene);
});

test('separate instances give every selected surface its own full module', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  let scene = mapping.addRectangle(mapping.createScene());
  scene = mapping.addRectangle(scene);
  const ids = scene.surfaces.map((surface) => surface.id);
  scene = mapping.tileModule(scene, ids, { kind: 'module', moduleId: 'bigSolid', moduleName: 'Big Solid' });
  scene = mapping.instanceModule(scene, ids, { kind: 'module', moduleId: 'bigSolid', moduleName: 'Big Solid', preset: 'fruit-loops' });
  scene.surfaces.forEach((surface) => {
    assert.equal(surface.content.span, 'instance');
    assert.equal(surface.content.preset, 'fruit-loops');
    assert.deepEqual(mapping.contentFrame(surface), { x: 0, y: 0, width: 100, height: 100, rotation: 0 });
  });
  const locked = mapping.updateSurface(scene, ids[1], (surface) => ({ ...surface, locked: true }));
  const skipped = mapping.instanceModule(locked, ids, { moduleId: 'orbs', moduleName: 'Orbs' });
  assert.equal(skipped.surfaces[1].content.moduleId, 'bigSolid');
  assert.equal(skipped.surfaces[0].content.moduleId, 'orbs');
  assert.equal(skipped.surfaces[0].content.tileId, null);
});

test('tile surfaces first, then one module and one picture', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  let scene = mapping.addRectangle(mapping.createScene());
  scene = mapping.addRectangle(scene);
  const ids = scene.surfaces.map((surface) => surface.id);
  assert.equal(mapping.tileSurfaces(scene, [ids[0]]), scene);
  scene = mapping.tileSurfaces(scene, ids);
  const [first, second] = scene.surfaces;
  assert.equal(first.content.kind, 'color');
  assert.equal(first.content.span, 'tile');
  assert.equal(first.content.tileId, second.content.tileId);
  assert.ok(first.content.tileId);
  const pictureA = mapping.pictureRect(first);
  const pictureB = mapping.pictureRect(second);
  assert.ok(Math.abs(pictureA.x - pictureB.x) < 0.5);
  assert.ok(Math.abs(pictureA.y - pictureB.y) < 0.5);
  assert.ok(Math.abs(pictureA.width - pictureB.width) < 0.5);
  assert.ok(Math.abs(pictureA.height - pictureB.height) < 0.5);
  const percents = mapping.layerPercents(scene, first.id);
  assert.ok(Math.abs(percents.x) < 0.5);
  assert.ok(Math.abs(percents.y) < 0.5);
  assert.ok(Math.abs(percents.width - 100) < 0.5);
  assert.ok(Math.abs(percents.height - 100) < 0.5);

  const moved = mapping.writePicture(scene, percents.members, {
    x: pictureA.x + 40,
    y: pictureA.y - 12,
    width: pictureA.width + 80,
    height: pictureA.height,
  });
  const movedA = mapping.pictureRect(moved.surfaces[0]);
  const movedB = mapping.pictureRect(moved.surfaces[1]);
  assert.ok(Math.abs(movedA.x - movedB.x) < 0.5);
  assert.ok(Math.abs(movedA.x - (pictureA.x + 40)) < 0.5);
  assert.ok(Math.abs(movedA.width - movedB.width) < 0.5);

  const assigned = mapping.assignModule(moved, [ids[0]], { kind: 'module', moduleId: 'orbs', moduleName: 'Orbs' });
  assert.equal(assigned.surfaces[0].content.moduleId, 'orbs');
  assert.equal(assigned.surfaces[1].content.moduleId, 'orbs');
  assert.equal(assigned.surfaces[0].content.span, 'tile');
  assert.equal(assigned.surfaces[1].content.tileId, assigned.surfaces[0].content.tileId);
  const kept = mapping.pictureRect(assigned.surfaces[0]);
  assert.ok(Math.abs(kept.x - movedA.x) < 0.5);
  assert.ok(Math.abs(kept.width - movedA.width) < 0.5);

  const cleared = mapping.clearModules(assigned, [ids[1]]);
  assert.equal(cleared.surfaces[0].content.moduleId, null);
  assert.equal(cleared.surfaces[1].content.kind, 'color');
  assert.equal(cleared.surfaces[0].content.tileId, assigned.surfaces[0].content.tileId);
  assert.equal(cleared.surfaces[0].content.span, 'tile');
});

test('a module frame defaults to filling its surface', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  const scene = mapping.addRectangle(mapping.createScene());
  assert.deepEqual(mapping.contentFrame(scene.surfaces[0]), { x: 0, y: 0, width: 100, height: 100, rotation: 0 });
  const placed = {
    content: { frame: { x: -10, y: 20, width: 1, height: 40 } },
  };
  assert.deepEqual(mapping.contentFrame(placed), { x: -10, y: 20, width: 5, height: 40, rotation: 0 });
  assert.equal(mapping.contentFrame({ content: { frame: { rotation: 450 } } }).rotation, 90);
});

test('module picture rotation survives a move and turns with the handle', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  let scene = mapping.addRectangle(mapping.createScene());
  const id = scene.surfaces[0].id;
  scene = mapping.assignModule(scene, [id], { kind: 'module', moduleId: 'orbs', moduleName: 'Orbs' });
  const rect = mapping.pictureRect(scene.surfaces[0]);
  const turned = mapping.writePicture(scene, [id], { ...rect, rotation: 35 });
  assert.equal(mapping.contentFrame(turned.surfaces[0]).rotation, 35);
  assert.equal(mapping.layerPercents(turned, id).rotation, 35);
  const moved = mapping.writePicture(turned, [id], {
    x: rect.x + 12,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
  assert.equal(mapping.contentFrame(moved.surfaces[0]).rotation, 35);
  const grown = mapping.resizePicture({ ...rect, rotation: 0 }, 20, 0);
  assert.ok(Math.abs(grown.width - (rect.width + 20)) < 0.01);
  assert.ok(Math.abs(grown.x - rect.x) < 0.01);
  const sceneRect = mapping.addRectangle(mapping.createScene()).surfaces[0];
  const before = sceneRect.points.map((point) => ({ ...point }));
  const turnedSurface = mapping.rotateSurface(sceneRect, Math.PI / 6, mapping.centroid(sceneRect));
  const axes = mapping.surfaceAxes(turnedSurface);
  assert.ok(Math.abs(axes.angle - Math.PI / 6) < 0.001);
  assert.ok(Math.abs(axes.width - mapping.boundsOf(sceneRect).width) < 0.5);
  assert.equal(mapping.contentFrame(turnedSurface).rotation, 0);
  const overlay = mapping.moduleOverlay(turnedSurface);
  assert.ok(Math.abs(overlay.surfaceDegrees - 30) < 0.05);
  const framed = mapping.writeFrame({ ...mapping.createScene(), surfaces: [sceneRect] }, [sceneRect.id], { x: 0, y: 0, width: 100, height: 100, rotation: 25 });
  assert.equal(mapping.contentFrame(framed.surfaces[0]).rotation, 25);
  assert.deepEqual(framed.surfaces[0].points, before);

  const spun = mapping.resizePicture({ x: 0, y: 0, width: 100, height: 40, rotation: 90 }, 0, 10);
  assert.ok(Math.abs(spun.width - 110) < 0.01);
  assert.ok(Math.abs(spun.height - 40) < 0.01);
  assert.equal(spun.rotation, 90);
});

test('a broken surface does not throw while building its path', async () => {
  const mapping = await import('../shared/mapping/scene.js');
  const broken = {
    id: 'broken',
    type: 'bezier',
    ellipse: { cx: 10, cy: 10, rx: Number.NaN, ry: 4, rotation: 0 },
    anchors: [{ x: 0, y: 0 }, { x: 10, y: 10, in: { x: 8, y: 8 }, out: { x: 12, y: 12 } }],
    points: [{ x: 1, y: 2 }, null],
  };
  assert.equal(mapping.surfacePath(broken), '');
  assert.doesNotThrow(() => mapping.outlinePoints(broken));
  assert.doesNotThrow(() => mapping.ellipseHandles(broken));
  const missing = { type: 'bezier', anchors: [{ x: 0, y: 0 }, { x: 4, y: 4 }] };
  assert.equal(mapping.surfacePath(missing), '');
  assert.deepEqual(mapping.outlinePoints(missing), []);
});
