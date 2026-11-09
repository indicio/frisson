import { Component, useEffect, useRef, useState } from 'react';
import { Circle, Hexagon, Pentagon, RectangleHorizontal, Spline, Triangle } from 'lucide-react';
import { postToViewer, subscribeViewer } from '../bridge/viewerBridge.js';
import { getModuleFavoriteNames } from '../../../shared/favorites.js';
import {
  createProjectId,
  deleteProject,
  loadProject,
  loadProjectIndex,
  saveProject,
  saveProjectIndex,
} from '../../../shared/projects.js';
import {
  addSurface,
  assignModule,
  boundsOf,
  centroid,
  clearModules,
  contentFrame,
  createScene,
  frameFromModuleRect,
  moduleOverlay,
  instanceModule,
  layerPercents,
  pictureFromPercents,
  pictureRect,
  tileMembers,
  tileSurfaces,
  writeFrame,
  writePicture,
  duplicateSurface,
  ellipseHandles,
  insertAnchor,
  insertPoint,
  moveSurface,
  nearestBezier,
  nearestEdge,
  removeAnchor,
  removePoint,
  reorderSurface,
  resizePicture,
  rotateSurface,
  scaleSurface,
  setAnchor,
  setCorner,
  setEllipseRadius,
  setHandle,
  snapValue,
  surfacePath,
  updateSurface,
} from '../../../shared/mapping/scene.js';
import './mapping.css';

const OUTPUT_DEFAULT = {
  grid: true,
  outlines: true,
  numbers: true,
  blackout: false,
  performance: false,
  snap: false,
  playing: true,
};

function SurfaceHandles({ surface, primary, viewScale, handleRadius, vertex }) {
  const radius = handleRadius * (primary ? 1 : 0.82);
  const box = boundsOf(surface);
  const activePoint = (part, index) => vertex?.id === surface.id && vertex.part === part && vertex.index === index;
  const pointFill = (active) => (active ? '#3d8bfd' : (primary ? '#fff' : '#9ec1ff'));
  return (
    <g data-selected={surface.id}>
      {surface.points?.map((point, index) => (
        <circle
          key={`p${index}`}
          data-id={surface.id}
          data-corner={index}
          cx={finite(point.x)}
          cy={finite(point.y)}
          r={radius * (activePoint('point', index) ? 1.35 : 1)}
          fill={pointFill(activePoint('point', index))}
          stroke="#111"
          strokeWidth={1 / viewScale}
        />
      ))}
      {surface.anchors?.map((anchor, index) => (
        <g key={`a${index}`}>
          {primary && anchor.in && anchor.out ? (
            <>
              <line x1={anchor.in.x} y1={anchor.in.y} x2={anchor.x} y2={anchor.y} stroke="#9ec1ff" strokeWidth={1.5 / viewScale} pointerEvents="none" />
              <line x1={anchor.out.x} y1={anchor.out.y} x2={anchor.x} y2={anchor.y} stroke="#9ec1ff" strokeWidth={1.5 / viewScale} pointerEvents="none" />
            </>
          ) : null}
          {['in', 'out'].filter((part) => anchor[part]).map((part) => (
            <circle
              key={part}
              data-id={surface.id}
              data-anchor={index}
              data-handle={part}
              cx={anchor[part].x}
              cy={anchor[part].y}
              r={radius * 0.75}
              fill={activePoint(part, index) ? '#3d8bfd' : (primary ? '#d7e6ff' : '#9ec1ff')}
              stroke="#111"
              strokeWidth={1 / viewScale}
            />
          ))}
          <circle
            data-id={surface.id}
            data-anchor={index}
            cx={anchor.x}
            cy={anchor.y}
            r={radius}
            fill={pointFill(activePoint('anchor', index))}
            stroke="#111"
            strokeWidth={1 / viewScale}
          />
        </g>
      ))}
      {surface.ellipse ? (() => {
        const handles = ellipseHandles(surface);
        return (
          <>
            <circle data-id={surface.id} data-axis="rx" cx={finite(handles.rx.x)} cy={finite(handles.rx.y)} r={radius} fill={primary ? '#fff' : '#9ec1ff'} stroke="#111" strokeWidth={1 / viewScale} />
            {surface.type === 'ellipse' ? (
              <circle data-id={surface.id} data-axis="ry" cx={finite(handles.ry.x)} cy={finite(handles.ry.y)} r={radius} fill={primary ? '#fff' : '#9ec1ff'} stroke="#111" strokeWidth={1 / viewScale} />
            ) : null}
          </>
        );
      })() : null}
      <circle
        data-id={surface.id}
        data-role="rotate"
        cx={box.cx}
        cy={finite(box.y) - (28 / viewScale)}
        r={radius}
        fill={primary ? '#e6b325' : '#f6c445'}
        stroke="#111"
        strokeWidth={1 / viewScale}
      />
    </g>
  );
}

function EllipseIcon({ className }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="5.5" />
    </svg>
  );
}

const SHAPES = [
  { kind: 'rectangle', label: 'Rectangle', Icon: RectangleHorizontal },
  { kind: 'triangle', label: 'Triangle', Icon: Triangle },
  { kind: 'circle', label: 'Circle', Icon: Circle },
  { kind: 'ellipse', label: 'Ellipse', Icon: EllipseIcon },
  { kind: 'pentagon', label: 'Pentagon', Icon: Pentagon },
  { kind: 'hexagon', label: 'Hexagon', Icon: Hexagon },
  { kind: 'bezier', label: 'Bézier', Icon: Spline },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clampScale(value) {
  if (!Number.isFinite(value) || value <= 0) return 0.08;
  return Math.min(8, Math.max(0.08, value));
}

function capturePointer(event) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch {
    // The pointer can already be gone. The drag still follows pointermove.
  }
}

class MappingErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, attempt: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('Map editor stopped', error);
  }

  componentDidUpdate(previous) {
    if (previous.active && !this.props.active && this.state.error) {
      this.setState({ error: null, attempt: this.state.attempt + 1 });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <section className={`mapping-workspace${this.props.active ? ' active' : ''}`}>
          <aside className="mapping-side">
            <h2>Map editor stopped</h2>
            <p className="mapping-empty">The editor hit an error and was stopped so the rest of Frisson could keep running.</p>
            <button
              type="button"
              className="btn"
              onClick={() => this.setState({ error: null, attempt: this.state.attempt + 1 })}
            >
              Try again
            </button>
          </aside>
        </section>
      );
    }
    return <MappingEditor key={this.state.attempt} {...this.props} />;
  }
}

function contentValue(surface) {
  const content = surface.content;
  if (!content || content.kind === 'color') return 'color';
  if (content.kind === 'pattern') return `pattern:${content.pattern || 'stripes'}`;
  if (content.kind === 'composition') return 'composition';
  if (content.kind === 'module' && content.moduleId) return `module:${content.moduleId}`;
  return 'color';
}

function resizeTo(surface, box) {
  const bounds = boundsOf(surface);
  if (bounds.width < 1 || bounds.height < 1) return surface;
  const scaled = scaleSurface(
    surface,
    box.width / bounds.width,
    box.height / bounds.height,
    { x: bounds.x, y: bounds.y },
  );
  return moveSurface(scaled, box.x - bounds.x, box.y - bounds.y);
}

function clientToOutput(svg, clientX, clientY) {
  try {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    if (!Number.isFinite(local.x) || !Number.isFinite(local.y)) return { x: 0, y: 0 };
    return { x: local.x, y: local.y };
  } catch {
    return { x: 0, y: 0 };
  }
}

function localRadius(ellipse, point, axis) {
  const dx = point.x - ellipse.cx;
  const dy = point.y - ellipse.cy;
  const rotation = -(ellipse.rotation || 0);
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const x = dx * c - dy * s;
  const y = dx * s + dy * c;
  return Math.abs(axis === 'rx' ? x : y);
}

function MappingEditor({ active, modules = [], compositionModule = null }) {
  const svgRef = useRef(null);
  const stageRef = useRef(null);
  const past = useRef([]);
  const future = useRef([]);
  const gesture = useRef(null);
  const [scene, setScene] = useState(() => ({
    version: 1,
    output: { width: 1920, height: 1080 },
    surfaces: [],
  }));
  const [primaryId, setPrimaryId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [vertex, setVertex] = useState(null);
  const [view, setView] = useState({ scale: 0.4, panX: 24, panY: 24 });
  const [output, setOutput] = useState(OUTPUT_DEFAULT);
  const [presetNames, setPresetNames] = useState([]);
  const [editLayer, setEditLayer] = useState('shape');
  const [projectId, setProjectId] = useState(null);
  const [projectName, setProjectName] = useState('Untitled');
  const [projectList, setProjectList] = useState([]);
  const [panel, setPanel] = useState('surface');
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const outputRef = useRef(output);
  outputRef.current = output;
  const projectIdRef = useRef(null);
  const projectNameRef = useRef('Untitled');
  const projectListRef = useRef([]);
  const skipProjectSave = useRef(true);
  projectIdRef.current = projectId;
  projectNameRef.current = projectName;
  projectListRef.current = projectList;

  function publish(next = sceneRef.current) {
    postToViewer('MAPPING_SCENE', { scene: next });
    postToViewer('MAPPING_OUTPUT', outputRef.current);
  }

  useEffect(() => {
    if (!active) return undefined;
    publish();
    return subscribeViewer((message) => {
      if (message?.type === 'VIEWER_READY') publish();
    });
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const frame = requestAnimationFrame(() => publish());
    return () => cancelAnimationFrame(frame);
  }, [active, scene, output]);

  function viewSettings(view = {}) {
    return {
      grid: view.grid !== false,
      outlines: view.outlines !== false,
      numbers: view.numbers !== false,
      blackout: Boolean(view.blackout),
      performance: Boolean(view.performance),
      snap: Boolean(view.snap),
      playing: view.playing !== false,
    };
  }

  function blankScene() {
    skipProjectSave.current = true;
    past.current = [];
    future.current = [];
    setProjectId(null);
    setProjectName('Untitled');
    setOutput({ ...OUTPUT_DEFAULT });
    replaceScene(createScene());
    setPrimaryId(null);
    setSelectedIds([]);
    setVertex(null);
    setEditLayer('shape');
  }

  function applyProject(doc) {
    skipProjectSave.current = true;
    past.current = [];
    future.current = [];
    setProjectId(doc.id);
    setProjectName(doc.name || 'Untitled');
    setOutput(viewSettings(doc.view));
    replaceScene(doc.scene);
    setPrimaryId(null);
    setSelectedIds([]);
    setVertex(null);
    setEditLayer('shape');
  }

  async function rememberActive(id, projects = projectListRef.current) {
    setProjectList(projects);
    await saveProjectIndex({ version: 1, activeId: id, projects });
  }

  async function writeOpenProject(id, name) {
    const doc = {
      version: 1,
      id,
      name: String(name || 'Untitled').trim().slice(0, 80) || 'Untitled',
      scene: sceneRef.current,
      view: outputRef.current,
    };
    await saveProject(doc);
    const projects = [
      { id, name: doc.name, updatedAt: new Date().toISOString() },
      ...projectListRef.current.filter((item) => item.id !== id),
    ];
    setProjectId(id);
    setProjectName(doc.name);
    await rememberActive(id, projects);
  }

  useEffect(() => {
    let cancel = false;
    loadProjectIndex().then(async (index) => {
      if (cancel) return;
      setProjectList(index.projects);
      if (index.activeId) {
        const doc = await loadProject(index.activeId);
        if (!cancel && doc) applyProject(doc);
      }
    }).catch((error) => console.error('Project load failed', error));
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (skipProjectSave.current) {
      skipProjectSave.current = false;
      return undefined;
    }
    if (!projectId) return undefined;
    const timer = setTimeout(() => {
      writeOpenProject(projectIdRef.current, projectNameRef.current).catch((error) => {
        console.error('Project save failed', error);
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [scene, output, projectId, projectName]);

  useEffect(() => {
    if (!active) return undefined;
    const stage = stageRef.current;
    if (!stage) return undefined;
    const apply = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width < 64 || rect.height < 64) return;
      const outputSize = sceneRef.current.output;
      const scale = clampScale(Math.min((rect.width - 48) / outputSize.width, (rect.height - 48) / outputSize.height));
      setView({
        scale,
        panX: (rect.width - outputSize.width * scale) / 2,
        panY: (rect.height - outputSize.height * scale) / 2,
      });
    };
    apply();
    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  function remember(current) {
    past.current.push(current);
    if (past.current.length > 50) past.current.shift();
    future.current = [];
  }

  function replaceScene(next) {
    sceneRef.current = next;
    setScene(next);
  }

  function commit(recipe) {
    const current = sceneRef.current;
    let next = current;
    try {
      next = recipe(current);
    } catch (error) {
      console.error('Map edit failed', error);
      return current;
    }
    remember(current);
    replaceScene(next);
    return next;
  }

  function preview(recipe) {
    const current = sceneRef.current;
    let next = current;
    try {
      next = recipe(current);
    } catch (error) {
      console.error('Map edit failed', error);
      return;
    }
    if (!gesture.current?.started) {
      remember(current);
      gesture.current = { ...gesture.current, started: true };
    }
    replaceScene(next);
  }

  function selectOnly(id) {
    setPrimaryId(id);
    setSelectedIds(id ? [id] : []);
    setVertex(null);
    setEditLayer('shape');
  }

  function add(kind) {
    const before = sceneRef.current.surfaces.length;
    const next = commit((current) => addSurface(current, kind));
    const created = next.surfaces.length > before ? next.surfaces.at(-1) : null;
    if (created) selectOnly(created.id);
  }

  function undo() {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(sceneRef.current);
    replaceScene(previous);
  }

  function redo() {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(sceneRef.current);
    if (past.current.length > 50) past.current.shift();
    replaceScene(next);
  }

  function fit() {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 64 || rect.height < 64) return;
    const scale = clampScale(Math.min((rect.width - 48) / scene.output.width, (rect.height - 48) / scene.output.height));
    setView({
      scale,
      panX: (rect.width - scene.output.width * scale) / 2,
      panY: (rect.height - scene.output.height * scale) / 2,
    });
  }

  function edit(id, recipe) {
    commit((current) => updateSurface(current, id, recipe));
  }

  useEffect(() => {
    if (!active) return undefined;
    function onKey(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return;
      const nudge = event.shiftKey ? 10 : 1;
      if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (selectedIds.length && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const dx = event.key === 'ArrowLeft' ? -nudge : event.key === 'ArrowRight' ? nudge : 0;
        const dy = event.key === 'ArrowUp' ? -nudge : event.key === 'ArrowDown' ? nudge : 0;
        if (editLayer === 'module' && primaryId) {
          const surface = sceneRef.current.surfaces.find((item) => item.id === primaryId);
          if (surface && !surface.locked) {
            const members = tileMembers(sceneRef.current, surface);
            if (members.length === 1) {
              const overlay = moduleOverlay(surface);
              const local = toModuleLocal({ x: dx, y: dy }, { ...overlay, cx: 0, cy: 0, centerX: 0, centerY: 0, moduleDegrees: 0 });
              const frame = contentFrame(surface);
              commit((current) => writeFrame(current, members, {
                ...frame,
                x: frame.x + (local.x / overlay.axesWidth) * 100,
                y: frame.y + (local.y / overlay.axesHeight) * 100,
              }));
            } else {
              const rect = pictureRect(surface);
              rect.x += dx;
              rect.y += dy;
              commit((current) => writePicture(current, members, rect));
            }
            return;
          }
        }
        commit((current) => ({
          ...current,
          surfaces: current.surfaces.map((surface) => (
            selectedIds.includes(surface.id) && !surface.locked ? moveSurface(surface, dx, dy) : surface
          )),
        }));
        return;
      }
      if ((event.key === 'Backspace' || event.key === 'Delete') && primaryId) {
        const surface = sceneRef.current.surfaces.find((item) => item.id === primaryId);
        if (vertex && vertex.id === primaryId && surface && !surface.locked) {
          const next = vertex.part === 'anchor' ? removeAnchor(surface, vertex.index) : removePoint(surface, vertex.index);
          if (next !== surface) {
            event.preventDefault();
            edit(primaryId, () => next);
            setVertex(null);
            return;
          }
        }
        event.preventDefault();
        commit((current) => ({
          ...current,
          surfaces: current.surfaces.filter((item) => !selectedIds.includes(item.id) || item.locked),
        }));
        selectOnly(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, editLayer, primaryId, selectedIds, vertex]);

  function onPointerDown(event) {
    const svg = svgRef.current;
    const data = event.target?.dataset || {};
    if (!svg) return;
    const surfaceBody = Boolean(
      data.id
      && data.corner == null
      && data.anchor == null
      && !data.axis
      && !data.handle
      && data.role !== 'rotate'
      && data.role !== 'module-move'
      && data.role !== 'module-size'
      && data.role !== 'module-rotate'
    );
    if (event.button === 1 || event.target === svg || data.role === 'board' || (event.altKey && !surfaceBody && !data.handle)) {
      gesture.current = { kind: 'pan', x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY };
      capturePointer(event);
      if (event.target === svg || data.role === 'board') selectOnly(null);
      return;
    }
    const id = data.id;
    const surface = scene.surfaces.find((item) => item.id === id);
    if (!surface) return;
    if ((event.shiftKey || event.metaKey) && data.corner == null && data.anchor == null && !data.axis && data.role !== 'rotate' && data.role !== 'module-move' && data.role !== 'module-size' && data.role !== 'module-rotate') {
      toggleSelected(id);
      return;
    }
    setPrimaryId(id);
    setSelectedIds((current) => (current.includes(id) ? current : [id]));
    if (surface.locked) return;
    const origin = clientToOutput(svg, event.clientX, event.clientY);
    if (data.role === 'module-move' || data.role === 'module-size' || data.role === 'module-rotate') {
      setEditLayer('module');
      const members = tileMembers(scene, surface);
      const overlay = members.length === 1 ? moduleOverlay(surface) : null;
      const localOrigin = overlay ? toModuleLocal(origin, overlay) : origin;
      const rect = overlay
        ? { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height }
        : pictureRect(surface);
      const rotation = overlay ? overlay.moduleDegrees : contentFrame(surface).rotation;
      const center = overlay
        ? { x: overlay.centerX, y: overlay.centerY }
        : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      gesture.current = {
        kind: data.role === 'module-size' ? 'module-size' : data.role === 'module-rotate' ? 'module-rotate' : 'module-move',
        id,
        origin: localOrigin,
        rect,
        rotation,
        center,
        startAngle: Math.atan2(localOrigin.y - center.y, localOrigin.x - center.x),
        members,
        overlay,
        started: false,
      };
      capturePointer(event);
      return;
    }
    if (data.role === 'rotate') {
      const center = centroid(surface);
      gesture.current = {
        kind: 'rotate',
        id,
        origin,
        center,
        startAngle: Math.atan2(origin.y - center.y, origin.x - center.x),
        surfaces: { [id]: clone(surface) },
        started: false,
      };
    } else if (data.axis) {
      gesture.current = { kind: 'radius', id, part: data.axis, surfaces: { [id]: clone(surface) }, started: false };
      setVertex({ id, index: 0, part: data.axis });
    } else if (data.handle) {
      const index = Number(data.anchor);
      const anchor = surface.anchors?.[index];
      if (!anchor?.[data.handle]) return;
      gesture.current = {
        kind: 'handle',
        id,
        index,
        part: data.handle,
        origin,
        handle: { ...surface.anchors[index][data.handle] },
        surfaces: { [id]: clone(surface) },
        started: false,
      };
      setVertex({ id, index, part: data.handle });
    } else if (data.anchor != null) {
      const index = Number(data.anchor);
      gesture.current = { kind: 'anchor', id, index, surfaces: { [id]: clone(surface) }, started: false };
      setVertex({ id, index, part: 'anchor' });
    } else if (data.corner != null) {
      const index = Number(data.corner);
      gesture.current = { kind: 'point', id, index, surfaces: { [id]: clone(surface) }, started: false };
      setVertex({ id, index, part: 'point' });
    } else {
      setEditLayer('shape');
      const ids = selectedIds.includes(id) ? selectedIds : [id];
      if (!selectedIds.includes(id)) setSelectedIds([id]);
      const surfaces = {};
      scene.surfaces.forEach((item) => {
        if (ids.includes(item.id) && !item.locked) surfaces[item.id] = clone(item);
      });
      gesture.current = { kind: 'move', id, origin, surfaces, started: false, duplicate: event.altKey };
      setVertex(null);
    }
    capturePointer(event);
  }

  function spawnDragCopies(drag) {
    const sourceIds = Object.keys(drag.surfaces);
    let next = sceneRef.current;
    const copies = {};
    const copyOf = {};
    sourceIds.forEach((id) => {
      const before = new Set(next.surfaces.map((item) => item.id));
      const duplicated = duplicateSurface(next, id, { x: 0, y: 0 });
      if (duplicated === next) return;
      next = duplicated;
      const copy = next.surfaces.find((item) => !before.has(item.id));
      if (!copy) return;
      copies[copy.id] = clone(copy);
      copyOf[id] = copy.id;
    });
    const created = Object.values(copyOf);
    if (!created.length) return null;
    remember(sceneRef.current);
    replaceScene(next);
    const primary = copyOf[drag.id] || created[0];
    setPrimaryId(primary);
    setSelectedIds(created);
    setEditLayer('shape');
    const updated = {
      ...drag,
      id: primary,
      surfaces: copies,
      copied: true,
      started: true,
    };
    gesture.current = updated;
    return updated;
  }

  function onPointerMove(event) {
    const drag = gesture.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    if (drag.kind === 'pan') {
      setView((current) => ({
        ...current,
        panX: drag.panX + (event.clientX - drag.x),
        panY: drag.panY + (event.clientY - drag.y),
      }));
      return;
    }
    const point = drag.overlay
      ? toModuleLocal(clientToOutput(svg, event.clientX, event.clientY), drag.overlay)
      : clientToOutput(svg, event.clientX, event.clientY);
    let active = drag;
    if (active.kind === 'move' && active.duplicate && !active.copied) {
      active = spawnDragCopies(active);
      if (!active) return;
    }
    const smooth = !event.altKey;
    preview((current) => applyDrag(current, active, point, smooth, outputRef.current.snap));
  }

  function onPointerUp() {
    gesture.current = null;
  }

  function onDoubleClick(event) {
    const svg = svgRef.current;
    const id = event.target.dataset?.id;
    const data = event.target.dataset || {};
    if (!svg || !id || data.corner != null || data.anchor != null || data.axis || data.role === 'rotate' || data.role === 'module-rotate' || data.role === 'module-size') return;
    const surface = sceneRef.current.surfaces.find((item) => item.id === id);
    if (!surface || surface.locked) return;
    const point = clientToOutput(svg, event.clientX, event.clientY);
    const limit = 28 / viewScale;
    if (surface.anchors) {
      const nearest = nearestBezier(surface.anchors, point);
      if (!nearest || nearest.distance > limit) return;
      edit(id, (item) => insertAnchor(item, nearest.index));
      return;
    }
    if (surface.points?.length >= 3) {
      const nearest = nearestEdge(surface.points, point);
      if (!nearest || nearest.distance > limit) return;
      edit(id, (item) => insertPoint(item, nearest.index, nearest.point));
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const nextScale = clampScale(view.scale * (event.deltaY < 0 ? 1.08 : 0.92));
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const outputX = (cx - view.panX) / viewScale;
    const outputY = (cy - view.panY) / viewScale;
    setView({
      scale: nextScale,
      panX: cx - outputX * nextScale,
      panY: cy - outputY * nextScale,
    });
  }

  const selected = scene.surfaces.find((surface) => surface.id === primaryId) || null;
  const handleSurfaces = scene.surfaces
    .filter((surface) => selectedIds.includes(surface.id) && surface.visible && !surface.locked)
    .sort((left, right) => Number(left.id === primaryId) - Number(right.id === primaryId));
  const placeableIds = scene.surfaces.filter((surface) => selectedIds.includes(surface.id) && surface.visible && !surface.locked).map((surface) => surface.id);
  const tileGroup = selected?.content?.span === 'tile' && selected.content?.tileId
    ? scene.surfaces.filter((surface) => surface.content?.tileId === selected.content.tileId && !surface.locked)
    : [];
  const selectionTiled = placeableIds.length > 1
    && placeableIds.every((id) => tileGroup.some((surface) => surface.id === id));
  const assignedModuleId = (selected?.content?.kind === 'module' || selected?.content?.kind === 'composition')
    ? (selected.content.moduleId || '')
    : '';
  const layer = selected ? layerPercents(scene, selected.id) : null;
  const canClearModule = scene.surfaces.some((surface) => {
    const chosen = placeableIds.includes(surface.id) || tileGroup.some((item) => item.id === surface.id);
    return chosen && (surface.content?.kind === 'module' || surface.content?.kind === 'composition') && surface.content.moduleId;
  });
  const viewScale = clampScale(view.scale);
  const handleRadius = 7 / viewScale;
  const bounds = selected ? boundsOf(selected) : null;
  const picture = (() => {
    const shared = tileGroup.length > 1;
    if ((!assignedModuleId && !shared) || !selected?.visible || selected.locked || !bounds || bounds.width < 1 || bounds.height < 1) return null;
    const overlay = shared ? null : moduleOverlay(selected);
    const rect = overlay
      ? { x: overlay.x, y: overlay.y, width: overlay.width, height: overlay.height }
      : pictureRect(selected);
    const box = {
      x: rect.x,
      y: rect.y,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
    };
    const grip = 18 / viewScale;
    const sizeR = Math.max(9 / viewScale, Math.min(14 / viewScale, 16 / viewScale));
    const outside = sizeR + (18 / viewScale);
    const rotation = overlay ? overlay.moduleDegrees : contentFrame(selected).rotation;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const surfaceTurn = overlay?.surfaceDegrees
      ? `rotate(${overlay.surfaceDegrees} ${overlay.cx} ${overlay.cy})`
      : '';
    const moduleTurn = rotation ? `rotate(${rotation} ${cx} ${cy})` : '';
    return {
      box,
      grip,
      sizeR,
      rotation,
      transform: [surfaceTurn, moduleTurn].filter(Boolean).join(' ') || undefined,
      handleX: box.x + box.width + outside,
      handleY: box.y + box.height + outside,
      rotateX: cx,
      rotateY: box.y - (28 / viewScale),
    };
  })();
  const listed = [...scene.surfaces].reverse();

  useEffect(() => {
    if (!assignedModuleId) {
      setPresetNames([]);
      return undefined;
    }
    let cancelled = false;
    getModuleFavoriteNames(assignedModuleId).then((names) => {
      if (!cancelled) setPresetNames(names);
    }).catch(() => {
      if (!cancelled) setPresetNames([]);
    });
    return () => { cancelled = true; };
  }, [assignedModuleId]);

  function toggleSelected(id) {
    const has = selectedIds.includes(id);
    const next = has ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    setSelectedIds(next);
    if (!has) setPrimaryId(id);
    else if (primaryId === id) setPrimaryId(next[0] || null);
    setVertex(null);
  }

  function assignContent(value) {
    const ids = selectedIds.length ? selectedIds : (selected ? [selected.id] : []);
    if (!ids.length) return;
    if (value === 'color') {
      commit((current) => clearModules(current, ids));
      return;
    }
    if (value === 'composition' && compositionModule) {
      commit((current) => assignModule(current, ids, {
        kind: 'composition',
        moduleId: compositionModule.id,
        moduleName: compositionModule.name || compositionModule.id,
      }));
      return;
    }
    if (value.startsWith('module:')) {
      const moduleId = value.slice(7);
      const module = modules.find((item) => item.id === moduleId);
      commit((current) => assignModule(current, ids, {
        kind: 'module',
        moduleId,
        moduleName: module?.name || moduleId,
      }));
      return;
    }
    commit((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => (
        ids.includes(surface.id) && !surface.locked ? contentAssignment(surface, value) : surface
      )),
    }));
  }

  function contentAssignment(surface, value) {
    const content = { kind: 'color', moduleId: null, moduleName: '', pattern: 'solid', ...(surface.content || {}) };
    if (value === 'color') return { ...surface, content: { ...content, kind: 'color', moduleId: null, moduleName: '', pattern: 'solid', span: 'instance', tileId: null } };
    if (value.startsWith('pattern:')) {
      return { ...surface, content: { ...content, kind: 'pattern', pattern: value.slice(8), moduleId: null, moduleName: '', span: 'instance', tileId: null } };
    }
    if (value === 'composition' && compositionModule) {
      const same = content.kind === 'composition' && content.moduleId === compositionModule.id;
      return {
        ...surface,
        content: {
          ...content,
          kind: 'composition',
          moduleId: compositionModule.id,
          moduleName: compositionModule.name || compositionModule.id,
          pattern: 'solid',
          preset: same ? (content.preset || '') : '',
          span: 'instance',
          tileId: null,
          frame: same ? contentFrame(surface) : { x: 0, y: 0, width: 100, height: 100 },
        },
      };
    }
    if (value.startsWith('module:')) {
      const moduleId = value.slice(7);
      const module = modules.find((item) => item.id === moduleId);
      const same = content.kind === 'module' && content.moduleId === moduleId;
      return {
        ...surface,
        content: {
          ...content,
          kind: 'module',
          moduleId,
          moduleName: module?.name || moduleId,
          pattern: 'solid',
          preset: same ? (content.preset || '') : '',
          span: 'instance',
          tileId: null,
          frame: same ? contentFrame(surface) : { x: 0, y: 0, width: 100, height: 100 },
        },
      };
    }
    return surface;
  }

  return (
    <section className={`mapping-workspace${active ? ' active' : ''}`} aria-hidden={!active}>
      <aside className="mapping-side">
        <h2>Surfaces</h2>
        <div className="mapping-shapes" role="list">
          {SHAPES.map(({ kind, label, Icon }) => (
            <button key={kind} type="button" className="mapping-shape" role="listitem" onClick={() => add(kind)}>
              <Icon className="mapping-shape-icon" strokeWidth={1.75} aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="mapping-toolbar">
          <button type="button" className="btn" onClick={undo}>Undo</button>
          <button type="button" className="btn" onClick={redo}>Redo</button>
        </div>
        <div className="mapping-list">
          {listed.length === 0 ? (
            <p className="mapping-empty">Add a shape, then drag it. Double-click an edge to add a point. The projector follows this canvas.</p>
          ) : (
            <p className="mapping-empty">Check surfaces, or Shift-click them, to select more than one.</p>
          )}
          {listed.map((surface) => (
            <div key={surface.id} className={`mapping-row${surface.id === primaryId ? ' selected' : ''}${selectedIds.includes(surface.id) ? ' marked' : ''}`}>
              <input
                type="checkbox"
                checked={selectedIds.includes(surface.id)}
                aria-label={`Select ${surface.name}`}
                onChange={() => toggleSelected(surface.id)}
              />
              <button
                type="button"
                className="name"
                onClick={(event) => (event.shiftKey || event.metaKey ? toggleSelected(surface.id) : selectOnly(surface.id))}
              >
                {surface.name}
                {surface.content?.span === 'tile' ? <span className="mapping-tile-mark">Tile</span> : null}
              </button>
              <button type="button" className="btn" onClick={() => edit(surface.id, (item) => ({ ...item, visible: !item.visible }))}>{surface.visible ? 'Hide' : 'Show'}</button>
            </div>
          ))}
        </div>
      </aside>
      <div className="mapping-stage-wrap">
        <div
          className="mapping-stage"
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          <svg
            ref={svgRef}
            width={scene.output.width}
            height={scene.output.height}
            viewBox={`0 0 ${scene.output.width} ${scene.output.height}`}
            style={{ transform: `translate(${finite(view.panX)}px, ${finite(view.panY)}px) scale(${viewScale})` }}
          >
            <rect data-role="board" x="0" y="0" width={scene.output.width} height={scene.output.height} fill="#050505" />
            {output.grid ? (
              <g stroke="rgba(255,255,255,0.12)" strokeWidth={1} pointerEvents="none">
                {Array.from({ length: Math.min(80, Math.max(0, Math.floor(scene.output.width / 96))) }, (_, index) => (
                  <line key={`v${index}`} x1={(index + 1) * 96} y1="0" x2={(index + 1) * 96} y2={scene.output.height} />
                ))}
                {Array.from({ length: Math.min(80, Math.max(0, Math.floor(scene.output.height / 96))) }, (_, index) => (
                  <line key={`h${index}`} x1="0" y1={(index + 1) * 96} x2={scene.output.width} y2={(index + 1) * 96} />
                ))}
              </g>
            ) : null}
            {scene.surfaces.filter((surface) => surface.visible).map((surface) => {
              const primary = surface.id === primaryId;
              const marked = selectedIds.includes(surface.id);
              return (
                <path
                  key={surface.id}
                  data-id={surface.id}
                  d={surfacePath(surface)}
                  fill={surface.color}
                  fillOpacity={surface.opacity}
                  stroke={primary ? '#fff' : marked ? '#9ec1ff' : 'rgba(255,255,255,0.7)'}
                  strokeWidth={(primary ? 3 : 1.5) / viewScale}
                />
              );
            })}
            {scene.surfaces.filter((surface) => surface.visible).map((surface) => {
              const center = centroid(surface);
              const label = surface.content?.moduleName || (surface.content?.kind === 'pattern' ? surface.content.pattern : '');
              if (!label) return null;
              return (
                <text
                  key={`${surface.id}-label`}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize={28 / viewScale}
                  pointerEvents="none"
                >
                  {label}
                </text>
              );
            })}
            {(selected && selected.visible && !selected.locked) || handleSurfaces.length ? (
              <g>
                {picture && selected && !selected.locked && editLayer !== 'module' ? (
                  <g transform={picture.transform}>
                    <rect
                      data-id={selected.id}
                      data-role="module-move"
                      x={picture.box.x}
                      y={picture.box.y}
                      width={picture.box.width}
                      height={picture.box.height}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={picture.grip}
                      pointerEvents="stroke"
                      cursor="move"
                    />
                  </g>
                ) : null}
                {picture && selected && !selected.locked && editLayer === 'module' ? (
                  <g transform={picture.transform}>
                    <rect
                      data-id={selected.id}
                      data-role="module-move"
                      x={picture.box.x}
                      y={picture.box.y}
                      width={picture.box.width}
                      height={picture.box.height}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={picture.grip}
                      pointerEvents="all"
                      cursor="move"
                    />
                  </g>
                ) : null}
                {handleSurfaces.map((surface) => (
                  <SurfaceHandles
                    key={surface.id}
                    surface={surface}
                    primary={surface.id === primaryId}
                    viewScale={viewScale}
                    handleRadius={handleRadius}
                    vertex={vertex}
                  />
                ))}
                {picture && selected && !selected.locked ? (
                  <g transform={picture.transform}>
                    <g pointerEvents="none">
                      <rect
                        x={picture.box.x}
                        y={picture.box.y}
                        width={picture.box.width}
                        height={picture.box.height}
                        fill={editLayer === 'module' ? 'rgba(230,179,37,0.28)' : 'rgba(230,179,37,0.1)'}
                        stroke="#1a1404"
                        strokeWidth={6 / viewScale}
                      />
                      <rect
                        x={picture.box.x}
                        y={picture.box.y}
                        width={picture.box.width}
                        height={picture.box.height}
                        fill="none"
                        stroke="#f6c445"
                        strokeDasharray={`${12 / viewScale} ${8 / viewScale}`}
                        strokeWidth={3.5 / viewScale}
                      />
                      <line
                        x1={picture.box.x + picture.box.width}
                        y1={picture.box.y + picture.box.height}
                        x2={picture.handleX}
                        y2={picture.handleY}
                        stroke="#f6c445"
                        strokeWidth={2 / viewScale}
                      />
                      <line
                        x1={picture.rotateX}
                        y1={picture.box.y}
                        x2={picture.rotateX}
                        y2={picture.rotateY}
                        stroke="#f6c445"
                        strokeWidth={2 / viewScale}
                      />
                    </g>
                    <circle
                      data-id={selected.id}
                      data-role="module-size"
                      cx={picture.handleX}
                      cy={picture.handleY}
                      r={picture.sizeR}
                      fill="#f6c445"
                      stroke="#111"
                      strokeWidth={1.5 / viewScale}
                      cursor="nwse-resize"
                    />
                    <circle
                      data-id={selected.id}
                      data-role="module-rotate"
                      aria-label="Rotate module"
                      cx={picture.rotateX}
                      cy={picture.rotateY}
                      r={picture.sizeR}
                      fill="#e6b325"
                      stroke="#111"
                      strokeWidth={1.5 / viewScale}
                      cursor="grab"
                    />
                  </g>
                ) : null}
              </g>
            ) : null}
          </svg>
        </div>
        <div className="mapping-transport" role="group" aria-label="Animation">
          <button type="button" className={`btn${output.playing !== false ? ' active' : ''}`} onClick={() => setOutput((current) => ({ ...current, playing: true }))}>Play</button>
          <button type="button" className={`btn${output.playing === false ? ' active' : ''}`} onClick={() => setOutput((current) => ({ ...current, playing: false }))}>Pause</button>
          <span className="status">{output.playing === false ? 'Paused' : 'Playing'}</span>
        </div>
      </div>
      <aside className="mapping-side mapping-inspector">
        <div className="mapping-tabs" role="tablist" aria-label="Map panel">
          <button type="button" role="tab" aria-selected={panel === 'surface'} className={panel === 'surface' ? 'active' : ''} onClick={() => setPanel('surface')}>Surface</button>
          <button type="button" role="tab" aria-selected={panel === 'project'} className={panel === 'project' ? 'active' : ''} onClick={() => setPanel('project')}>Project</button>
          <button type="button" role="tab" aria-selected={panel === 'output'} className={panel === 'output' ? 'active' : ''} onClick={() => setPanel('output')}>Output</button>
        </div>
        <div className="mapping-tab-body">
        {panel === 'project' ? (
          <>
        <h2>Project</h2>
        <label>
          Name
          <input type="text" value={projectName} onChange={(event) => setProjectName(event.target.value)} />
        </label>
        <label>
          Open
          <select
            aria-label="Open project"
            value={projectId || ''}
            onChange={(event) => {
              const id = event.target.value;
              if (!id || id === projectId) return;
              const open = async () => {
                if (projectIdRef.current) await writeOpenProject(projectIdRef.current, projectNameRef.current);
                const doc = await loadProject(id);
                if (!doc) return;
                applyProject(doc);
                await rememberActive(id);
              };
              open().catch((error) => console.error('Project open failed', error));
            }}
          >
            <option value="">Unsaved project</option>
            {projectList.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="mapping-toolbar">
          <button type="button" className="btn" onClick={() => { blankScene(); rememberActive(null).catch((error) => console.error('Project save failed', error)); }}>New</button>
          <button type="button" className="btn" onClick={() => writeOpenProject(projectId || createProjectId(), projectName).catch((error) => console.error('Project save failed', error))}>Save</button>
          <button type="button" className="btn" onClick={() => writeOpenProject(createProjectId(), projectName).catch((error) => console.error('Project save failed', error))}>Save as</button>
          <button type="button" className="btn" disabled={!projectId} onClick={() => writeOpenProject(createProjectId(), `${projectName} copy`).catch((error) => console.error('Project save failed', error))}>Duplicate</button>
          <button
            type="button"
            className="btn"
            disabled={!projectId}
            onClick={() => {
              if (!projectId || !window.confirm(`Delete project “${projectName}”?`)) return;
              const id = projectId;
              deleteProject(id).then(() => {
                const projects = projectListRef.current.filter((item) => item.id !== id);
                blankScene();
                return rememberActive(null, projects);
              }).catch((error) => console.error('Project delete failed', error));
            }}
          >
            Delete
          </button>
        </div>
        <p className="mapping-empty">{projectId ? 'Edits to this project save automatically on this computer.' : 'Save stores this map, its modules, and the output settings on this computer.'}</p>
          </>
        ) : null}
        {panel === 'output' ? (
          <>
        <h2>Output</h2>
        <div className="mapping-output-toggles">
          <button type="button" className="btn" onClick={fit}>Fit</button>
          {['grid', 'outlines', 'numbers', 'snap', 'blackout', 'performance'].map((key) => (
            <button
              key={key}
              type="button"
              className={`btn${output[key] ? ' active' : ''}`}
              onClick={() => setOutput((current) => ({ ...current, [key]: !current[key] }))}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="mapping-pair">
          <label>
            Width
            <input
              type="number"
              value={scene.output.width}
              onChange={(event) => {
                const width = Math.min(8192, Math.max(64, Math.round(Number(event.target.value) || 0)));
                commit((current) => ({ ...current, output: { ...current.output, width } }));
              }}
            />
          </label>
          <label>
            Height
            <input
              type="number"
              value={scene.output.height}
              onChange={(event) => {
                const height = Math.min(8192, Math.max(64, Math.round(Number(event.target.value) || 0)));
                commit((current) => ({ ...current, output: { ...current.output, height } }));
              }}
            />
          </label>
        </div>
        <p className="mapping-empty">These settings are the projector. Editor zoom does not change the projected size. Performance hides the calibration grid on the projector.</p>
          </>
        ) : null}
        {panel === 'surface' ? (
        selected ? (
          <>
            {picture ? (
              <div className="mapping-layers" role="group" aria-label="Edit layer">
                <button type="button" className={editLayer === 'shape' ? 'active' : ''} onClick={() => setEditLayer('shape')}>
                  <span>Shape</span>
                  <small>{selected.name}</small>
                </button>
                <button type="button" className={editLayer === 'module' ? 'active' : ''} onClick={() => setEditLayer('module')}>
                  <span>Module</span>
                  <small>{selected.content?.moduleName || 'Picture'}</small>
                </button>
              </div>
            ) : null}
            <label>
              Name
              <input
                type="text"
                value={selected.name}
                onChange={(event) => {
                  const name = event.target.value;
                  edit(selected.id, (surface) => ({ ...surface, name }));
                }}
              />
            </label>
            <label>
              Color
              <input
                className="swatch"
                type="color"
                value={selected.color}
                onChange={(event) => {
                  const color = event.target.value;
                  edit(selected.id, (surface) => ({ ...surface, color }));
                }}
              />
            </label>
            <label>
              Opacity {Math.round((selected.opacity ?? 1) * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selected.opacity ?? 1}
                onChange={(event) => {
                  const opacity = Number(event.target.value);
                  edit(selected.id, (surface) => ({ ...surface, opacity }));
                }}
              />
            </label>
            <div className="mapping-pair">
              <label>
                X
                <input type="number" value={Math.round(finite(bounds.x))} onChange={(event) => {
                  const x = Number(event.target.value);
                  if (!Number.isFinite(x)) return;
                  edit(selected.id, (surface) => resizeTo(surface, { ...boundsOf(surface), x }));
                }}
                />
              </label>
              <label>
                Y
                <input type="number" value={Math.round(finite(bounds.y))} onChange={(event) => {
                  const y = Number(event.target.value);
                  if (!Number.isFinite(y)) return;
                  edit(selected.id, (surface) => resizeTo(surface, { ...boundsOf(surface), y }));
                }}
                />
              </label>
              <label>
                W
                <input type="number" value={Math.round(finite(bounds.width))} onChange={(event) => {
                  const width = Number(event.target.value);
                  if (!Number.isFinite(width)) return;
                  edit(selected.id, (surface) => resizeTo(surface, { ...boundsOf(surface), width: Math.max(8, width) }));
                }}
                />
              </label>
              <label>
                H
                <input type="number" value={Math.round(finite(bounds.height))} onChange={(event) => {
                  const height = Number(event.target.value);
                  if (!Number.isFinite(height)) return;
                  edit(selected.id, (surface) => resizeTo(surface, { ...boundsOf(surface), height: Math.max(8, height) }));
                }}
                />
              </label>
            </div>
            {placeableIds.length > 1 ? <p className="mapping-empty">Applies to {placeableIds.length} selected surfaces.</p> : null}
            <label>
              Content
              <select value={contentValue(selected)} onChange={(event) => assignContent(event.target.value)}>
                <option value="color">Solid color</option>
                <option value="pattern:stripes">Stripes</option>
                <option value="pattern:checker">Checker</option>
                <option value="pattern:rings">Rings</option>
                <option value="composition" disabled={!compositionModule}>
                  {compositionModule ? `VJ composition (${compositionModule.name})` : 'VJ composition'}
                </option>
                <optgroup label="Modules">
                  {modules.map((module) => (
                    <option key={module.id} value={`module:${module.id}`}>{module.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
            {placeableIds.length > 1 || canClearModule ? (
              <>
                <div className="mapping-toolbar">
                  {placeableIds.length > 1 ? (
                    <button type="button" className={`btn${selectionTiled ? ' active' : ''}`} onClick={tileSelection}>Tile surfaces</button>
                  ) : null}
                  {tileGroup.length > 1 ? (
                    <button type="button" className="btn" onClick={separateSelection}>Separate</button>
                  ) : null}
                  {canClearModule ? (
                    <button type="button" className="btn" onClick={clearSelectionModules}>Clear module</button>
                  ) : null}
                </div>
                {placeableIds.length > 1 ? (
                  <p className="mapping-empty">Tile the selected shapes first. The next module is one picture across them. Each shape clips and warps that picture to its own corners. One gold frame scales and positions the picture.</p>
                ) : null}
              </>
            ) : null}
            {assignedModuleId ? (
              <>
                <label>
                  Preset
                  <select
                    value={selected.content?.preset || ''}
                    onChange={(event) => {
                      const preset = event.target.value;
                      const members = tileMembers(sceneRef.current, selected);
                      commit((current) => ({
                        ...current,
                        surfaces: current.surfaces.map((surface) => (
                          members.includes(surface.id)
                            ? { ...surface, content: { ...(surface.content || {}), preset } }
                            : surface
                        )),
                      }));
                    }}
                  >
                    <option value="">Module default</option>
                    {selected.content?.preset && !presetNames.includes(selected.content.preset) ? (
                      <option value={selected.content.preset}>{selected.content.preset}</option>
                    ) : null}
                    {presetNames.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                {presetNames.length === 0 ? <p className="mapping-empty">This module has no saved presets yet. Save one from its controls, then it will show up here.</p> : null}
              </>
            ) : null}
            {picture && layer ? (
              <>
                <div className="mapping-pair">
                  <label>
                    Picture X %
                    <input type="number" value={Math.round(layer.x)} onChange={(event) => {
                      const x = Number(event.target.value);
                      if (!Number.isFinite(x)) return;
                      setPicture({ x });
                    }}
                    />
                  </label>
                  <label>
                    Picture Y %
                    <input type="number" value={Math.round(layer.y)} onChange={(event) => {
                      const y = Number(event.target.value);
                      if (!Number.isFinite(y)) return;
                      setPicture({ y });
                    }}
                    />
                  </label>
                  <label>
                    Picture W %
                    <input type="number" value={Math.round(layer.width)} onChange={(event) => {
                      const width = Number(event.target.value);
                      if (!Number.isFinite(width)) return;
                      setPicture({ width });
                    }}
                    />
                  </label>
                  <label>
                    Picture H %
                    <input type="number" value={Math.round(layer.height)} onChange={(event) => {
                      const height = Number(event.target.value);
                      if (!Number.isFinite(height)) return;
                      setPicture({ height });
                    }}
                    />
                  </label>
                  <label>
                    Rotation °
                    <input type="number" value={Math.round(layer.rotation || 0)} onChange={(event) => {
                      const rotation = Number(event.target.value);
                      if (!Number.isFinite(rotation)) return;
                      setPicture({ rotation });
                    }}
                    />
                  </label>
                </div>
                <div className="mapping-toolbar">
                  <button type="button" className="btn" onClick={() => setPicture({ x: 0, y: 0, width: 100, height: 100, rotation: 0 })}>{tileGroup.length > 1 ? 'Fill tile' : 'Fill surface'}</button>
                </div>
                <p className="mapping-empty">{editLayer === 'module'
                  ? 'Module is selected, so drags move the picture. The frame turns with the shape. The handle above it rotates the picture only.'
                  : 'Shape is selected, so drags move the clip. The module frame turns with the shape, and its own handle does not turn the shape.'}</p>
              </>
            ) : null}
            <label>
              Audio
              <select
                value={selected.audio?.enabled ? (selected.audio.signal || 'level') : 'off'}
                onChange={(event) => {
                  const signal = event.target.value;
                  edit(selected.id, (surface) => ({
                    ...surface,
                    audio: { enabled: signal !== 'off', signal: signal === 'off' ? 'level' : signal, sensitivity: surface.audio?.sensitivity ?? 1, smoothing: surface.audio?.smoothing ?? 0.65 },
                  }));
                }}
              >
                <option value="off">Off</option>
                <option value="level">Level</option>
                <option value="bass">Bass</option>
                <option value="mid">Mid</option>
                <option value="high">High</option>
              </select>
            </label>
            {selected.audio?.enabled ? (
              <>
                <label>
                  Sensitivity {Number(selected.audio.sensitivity ?? 1).toFixed(2)}
                  <input type="range" min="0" max="3" step="0.05" value={selected.audio.sensitivity ?? 1} onChange={(event) => {
                    const sensitivity = Number(event.target.value);
                    edit(selected.id, (surface) => ({ ...surface, audio: { ...surface.audio, sensitivity } }));
                  }}
                  />
                </label>
                <label>
                  Smoothing {Number(selected.audio.smoothing ?? 0.65).toFixed(2)}
                  <input type="range" min="0" max="0.95" step="0.01" value={selected.audio.smoothing ?? 0.65} onChange={(event) => {
                    const smoothing = Number(event.target.value);
                    edit(selected.id, (surface) => ({ ...surface, audio: { ...surface.audio, smoothing } }));
                  }}
                  />
                </label>
              </>
            ) : null}
            <div className="mapping-toolbar">
              <button type="button" className="btn" onClick={() => {
                const known = new Set(sceneRef.current.surfaces.map((surface) => surface.id));
                const next = commit((current) => duplicateSurface(current, selected.id));
                const copy = next.surfaces.find((surface) => !known.has(surface.id));
                if (copy) selectOnly(copy.id);
              }}
              >Duplicate</button>
              <button type="button" className="btn" onClick={() => commit((current) => reorderSurface(current, selected.id, 'backward'))}>Back</button>
              <button type="button" className="btn" onClick={() => commit((current) => reorderSurface(current, selected.id, 'forward'))}>Forward</button>
              <button type="button" className="btn" onClick={() => edit(selected.id, (surface) => ({ ...surface, locked: !surface.locked }))}>{selected.locked ? 'Unlock' : 'Lock'}</button>
              <button type="button" className="btn" onClick={() => addPointTo(selected)} disabled={!selected.points?.length && !selected.anchors}>Add point</button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  commit((current) => ({ ...current, surfaces: current.surfaces.filter((surface) => surface.id !== selected.id) }));
                  selectOnly(null);
                }}
              >
                Delete
              </button>
            </div>
            <p className="mapping-empty">
              Drag inside a shape to move it. Option-drag a shape to duplicate it. Drag a corner, or a Bézier handle, to reshape it. Double-click an edge to insert a point. Alt-drag a handle to break the tangent. Shift-click, or the checkbox, selects more than one surface. Editor zoom does not change the projected size.
            </p>
          </>
        ) : <p className="mapping-empty">Select a surface to edit it. Scroll to zoom. Drag the background to pan.</p>
        ) : null}
        </div>
      </aside>
    </section>
  );

  function tileSelection() {
    if (placeableIds.length < 2) return;
    const ids = [primaryId, ...placeableIds.filter((id) => id !== primaryId)];
    commit((current) => tileSurfaces(current, ids));
  }

  function separateSelection() {
    if (tileGroup.length < 2) return;
    const ids = tileGroup.map((surface) => surface.id);
    if (selected?.content?.moduleId) {
      commit((current) => instanceModule(current, ids, {
        kind: selected.content.kind === 'composition' ? 'composition' : 'module',
        moduleId: selected.content.moduleId,
        moduleName: selected.content.moduleName || selected.content.moduleId,
        preset: selected.content.preset || '',
      }));
      return;
    }
    commit((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => (
        ids.includes(surface.id)
          ? { ...surface, content: { ...(surface.content || {}), span: 'instance', tileId: null, frame: { x: 0, y: 0, width: 100, height: 100 } } }
          : surface
      )),
    }));
  }

  function clearSelectionModules() {
    const ids = selectedIds.length ? selectedIds : (selected ? [selected.id] : []);
    if (!ids.length) return;
    commit((current) => clearModules(current, ids));
  }

  function setPicture(patch) {
    if (!selected) return;
    const current = layerPercents(sceneRef.current, selected.id);
    const next = {
      x: patch.x ?? current.x,
      y: patch.y ?? current.y,
      width: Math.max(5, patch.width ?? current.width),
      height: Math.max(5, patch.height ?? current.height),
      rotation: patch.rotation ?? current.rotation ?? 0,
    };
    if (current.members.length <= 1) {
      commit((scene) => writeFrame(scene, current.members, next));
      return;
    }
    const placed = pictureFromPercents(sceneRef.current, selected.id, next);
    placed.rect.rotation = next.rotation;
    commit((scene) => writePicture(scene, placed.members, placed.rect));
  }

  function addPointTo(surface) {
    edit(surface.id, (item) => {
      if (item.anchors) {
        const index = vertex?.id === item.id && vertex.part === 'anchor' ? vertex.index : 0;
        return insertAnchor(item, index);
      }
      if (item.points?.length >= 3) {
        const index = vertex?.id === item.id && vertex.part === 'point' ? vertex.index : 0;
        const start = item.points[index];
        const end = item.points[(index + 1) % item.points.length];
        return insertPoint(item, index, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 });
      }
      return item;
    });
  }
}

function spinAround(point, origin, radians) {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

function toModuleLocal(point, overlay) {
  const unspun = spinAround(point, { x: overlay.cx, y: overlay.cy }, -overlay.surfaceDegrees * Math.PI / 180);
  return spinAround(unspun, { x: overlay.centerX, y: overlay.centerY }, -overlay.moduleDegrees * Math.PI / 180);
}

function applyDrag(current, drag, point, smooth, snap) {
  if (drag.kind === 'module-move' || drag.kind === 'module-size' || drag.kind === 'module-rotate') {
    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;
    let rect = { ...drag.rect, rotation: drag.overlay ? 0 : (drag.rotation || 0) };
    if (drag.kind === 'module-move') {
      rect.x = drag.rect.x + dx;
      rect.y = drag.rect.y + dy;
    } else if (drag.kind === 'module-size') {
      rect = resizePicture(rect, dx, dy);
    } else {
      const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
      rect.rotation = (drag.rotation || 0) + (angle - drag.startAngle) * 180 / Math.PI;
    }
    if (drag.overlay && drag.kind !== 'module-rotate') rect.rotation = drag.rotation || 0;
    if (drag.overlay) return writeFrame(current, drag.members, frameFromModuleRect(drag.overlay, rect));
    return writePicture(current, drag.members, rect);
  }
  if (drag.kind === 'move') {
    let dx = point.x - drag.origin.x;
    let dy = point.y - drag.origin.y;
    if (snap) {
      dx = snapValue(dx, 16);
      dy = snapValue(dy, 16);
    }
    return {
      ...current,
      surfaces: current.surfaces.map((surface) => (
        drag.surfaces[surface.id] ? moveSurface(drag.surfaces[surface.id], dx, dy) : surface
      )),
    };
  }
  const target = drag.surfaces[drag.id];
  if (!target) return current;
  const snapped = snap ? { x: snapValue(point.x, 16), y: snapValue(point.y, 16) } : point;
  let next = target;
  if (drag.kind === 'point') next = setCorner(target, drag.index, snapped);
  else if (drag.kind === 'anchor') next = setAnchor(target, drag.index, snapped);
  else if (drag.kind === 'handle') {
    const dx = point.x - drag.origin.x;
    const dy = point.y - drag.origin.y;
    next = setHandle(target, drag.index, drag.part, { x: drag.handle.x + dx, y: drag.handle.y + dy }, smooth);
  } else if (drag.kind === 'radius') {
    next = setEllipseRadius(target, drag.part, localRadius(target.ellipse, point, drag.part));
  } else if (drag.kind === 'rotate') {
    const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x);
    next = rotateSurface(target, angle - drag.startAngle, drag.center);
  }
  return updateSurface(current, drag.id, () => next);
}

export function MappingWorkspace(props) {
  return <MappingErrorBoundary {...props} />;
}
