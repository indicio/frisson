import { useEffect, useMemo, useRef, useState } from 'react';
import { AArrowDown, AArrowUp } from 'lucide-react';
import { getMostRecentFavoriteParams } from '../../shared/favorites.js';
import {
  isShellConfigFromProjectFile,
  loadShellConfig,
  updateShellConfig,
} from '../../shared/portableStorage.js';
import {
  isViewerConnected,
  openViewerWindow,
  postToViewer,
  startViewerBridge,
  subscribeViewer,
  viewerStatus,
} from './bridge/viewerBridge.js';
import { ControlsTray } from './ControlsTray.jsx';
import { MappingWorkspace } from './mapping/MappingWorkspace.jsx';
import { ImageLayerPanel } from './ImageLayerPanel.jsx';
import { PlaylistTray } from './PlaylistTray.jsx';
import { fromShell, placeholderPreview } from './shellUrl.js';
import {
  getInputState,
  restoreInputs,
  setAudioEnabled,
  setVideoEnabled,
  subscribeInputs,
} from '../../shell/audio.js';

const DISABLED_MODULE_IDS = ['shake', 'mosh', 'gradientmap', 'eidolon'];

function tagLabel(tag) {
  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
}

function statusLabel(status) {
  if (status === 'connected') return 'Viewer: Connected';
  if (status === 'opening') return 'Viewer: Opening...';
  return 'Viewer: Not Connected';
}

export function App() {
  const [modules, setModules] = useState([]);
  const [shellConfig, setShellConfig] = useState(null);
  const [sort, setSort] = useState('alpha-asc');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('grid');
  const [status, setStatus] = useState('disconnected');
  const [currentModule, setCurrentModule] = useState(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [mode, setMode] = useState('vj');
  const [ready, setReady] = useState(false);
  const [inputs, setInputs] = useState({ audio: false, video: false });
  const revision = useRef(0);
  const currentModuleRef = useRef(null);
  const modeRef = useRef('vj');
  modeRef.current = mode;

  useEffect(() => {
    startViewerBridge();
    let cancelled = false;
    Promise.all([
      fetch(fromShell('modules.json')).then((response) => {
        if (!response.ok) throw new Error(`Failed to load modules.json: ${response.status}`);
        return response.json();
      }),
      loadShellConfig(),
    ]).then(([allModules, config]) => {
      if (cancelled) return;
      setModules(allModules.filter((module) => !DISABLED_MODULE_IDS.includes(module.id)));
      setShellConfig(config);
      if (config.viewMode === 'list' || config.viewMode === 'grid') setView(config.viewMode);
      setReady(true);
    }).catch((error) => {
      console.error('Failed to initialize shell:', error);
      window.alert(`Failed to initialize application: ${error.message}. Please check console for details.`);
    });

    const unsubscribe = subscribeViewer((message) => {
      if (message?.type === 'VIEWER_READY' || message?.type === 'VIEWER_CLOSED') {
        setStatus(viewerStatus());
      }
      if (message?.type === 'VIEWER_READY') {
        postToViewer('MEDIA_INPUT', getInputState());
        postToViewer('MAPPING_MODE', { mode: modeRef.current });
        if (currentModuleRef.current) void publishModuleToViewer(currentModuleRef.current);
      }
      if (message?.type === 'MODULE_LOADED' && message.data?.module?.controlsPath) {
        const loaded = message.data.module;
        setCurrentModule((current) => current?.id === loaded.id ? current : { ...current, ...loaded });
        setControlsOpen(true);
        setPlaylistOpen(false);
      }
      if (message?.type === 'MODULE_LOAD_ERROR') {
        console.error('Failed to load module in viewer:', message.data?.error);
        window.alert(`Failed to load module: ${message.data?.module?.name || 'module'}`);
      }
      if (message?.type === 'IMAGE_LAYER_MODAL_TOGGLE') setImageOpen((open) => !open);
    });
    const statusTimer = setInterval(() => setStatus(viewerStatus()), 1000);
    restoreInputs().then((state) => { if (!cancelled) setInputs(state); }).catch(() => {});
    const unsubInputs = subscribeInputs((state) => setInputs(state));
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(statusTimer);
      unsubInputs();
    };
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') {
        setControlsOpen(false);
        setPlaylistOpen(false);
        setImageOpen(false);
      }
      if (event.key === 'I' && event.shiftKey && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
        setImageOpen((open) => !open);
        event.preventDefault();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const tags = useMemo(() => {
    const all = new Set();
    modules.forEach((module) => module.tags?.forEach((tag) => all.add(tag)));
    return [...all].sort();
  }, [modules]);

  const visible = useMemo(() => {
    const filtered = filter === 'all'
      ? [...modules]
      : modules.filter((module) => module.tags?.includes(filter));
    filtered.sort((a, b) => sort === 'alpha-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
    return filtered;
  }, [modules, filter, sort]);

  function changeView(next) {
    setView(next);
    if (!isShellConfigFromProjectFile()) {
      try { localStorage.setItem('shell-view-preference', next); } catch { /* ignore quota */ }
    }
    void updateShellConfig({ viewMode: next });
  }

  async function publishModuleToViewer(module, token) {
    if (!module || !isViewerConnected()) return;
    let initialParams = null;
    try {
      initialParams = await getMostRecentFavoriteParams(module.id);
    } catch (error) {
      console.warn('Could not pre-fetch favorite params:', error);
    }
    if (token !== undefined && token !== revision.current) return;
    if (currentModuleRef.current?.id !== module.id) return;
    postToViewer('LOAD_MODULE', { module, initialParams });
  }

  async function loadModule(module) {
    const token = ++revision.current;
    setCurrentModule(module);
    currentModuleRef.current = module;
    setPlaylistOpen(false);
    setControlsOpen(true);
    if (!isViewerConnected()) return;
    try {
      await publishModuleToViewer(module, token);
    } catch (error) {
      console.error('Failed to load module:', error);
      window.alert(`Failed to load module: ${module.name}`);
    }
  }

  function toggleControls() {
    if (controlsOpen) {
      setControlsOpen(false);
      return;
    }
    if (!currentModuleRef.current && !currentModule) {
      window.alert('No module is currently loaded. Load a module first to open controls.');
      return;
    }
    setPlaylistOpen(false);
    setControlsOpen(true);
  }

  function changeMode(next) {
    modeRef.current = next;
    setMode(next);
    if (next === 'map') {
      setPlaylistOpen(false);
      openViewerWindow();
    }
    postToViewer('MAPPING_MODE', { mode: next });
  }

  const overlay = controlsOpen || playlistOpen;
  const activeModule = currentModule;

  return (
    <div id="app" className={mode === 'map' ? 'map-mode' : undefined}>
      <header id="header">
        <div className="header-nav-row">
          <div className="header-brand"><h1>frisson</h1></div>
          <nav className="header-toolbar" aria-label="Module browser">
            <div className="sort-toggle" role="group" aria-label="Sort alphabetically">
              <button type="button" className={`sort-toggle-btn${sort === 'alpha-asc' ? ' active' : ''}`} title="Sort A–Z" aria-pressed={sort === 'alpha-asc'} onClick={() => setSort('alpha-asc')}>
                <AArrowUp className="lucide-icon" strokeWidth={1.75} aria-hidden />
              </button>
              <button type="button" className={`sort-toggle-btn${sort === 'alpha-desc' ? ' active' : ''}`} title="Sort Z–A" aria-pressed={sort === 'alpha-desc'} onClick={() => setSort('alpha-desc')}>
                <AArrowDown className="lucide-icon" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <select className="filter-select filter-select--type" aria-label="Filter by type" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All Types</option>
              {tags.map((tag) => <option key={tag} value={tag}>{tagLabel(tag)}</option>)}
            </select>
            <div className="view-toggle">
              <button id="view-grid-btn" className={`btn btn-icon${view === 'grid' ? ' active' : ''}`} title="Grid View" onClick={() => changeView('grid')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              </button>
              <button id="view-list-btn" className={`btn btn-icon${view === 'list' ? ' active' : ''}`} title="List View" onClick={() => changeView('list')}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
              </button>
            </div>
            <button type="button" className="btn btn-secondary" style={{ display: filter === 'all' ? 'none' : 'inline-block' }} onClick={() => { setSort('alpha-asc'); setFilter('all'); }}>Clear Filters</button>
            <div className="mode-toggle" role="group" aria-label="Application mode">
              <button type="button" className={`btn${mode === 'vj' ? ' btn-primary' : ''}`} title="VJ Mode" onClick={() => changeMode('vj')}>VJ</button>
              <button type="button" className={`btn${mode === 'map' ? ' btn-primary' : ''}`} title="Projection Mapping Mode" onClick={() => changeMode('map')}>Map</button>
            </div>
            <div className="input-toggles" role="group" aria-label="Media inputs">
              <label className="input-toggle">
                <span className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Audio input"
                    checked={inputs.audio}
                    onChange={async (event) => {
                      const on = event.target.checked;
                      setInputs((state) => ({ ...state, audio: on }));
                      await setAudioEnabled(on);
                      postToViewer('MEDIA_INPUT', getInputState());
                    }}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </span>
                Audio
              </label>
              <label className="input-toggle">
                <span className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Video input"
                    checked={inputs.video}
                    onChange={async (event) => {
                      const on = event.target.checked;
                      setInputs((state) => ({ ...state, video: on }));
                      await setVideoEnabled(on);
                      postToViewer('MEDIA_INPUT', getInputState());
                    }}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </span>
                Video
              </label>
            </div>
            <span id="viewer-status" className={`viewer-status${status === 'connected' ? ' connected' : ''}${status === 'disconnected' ? ' disconnected' : ''}`}>{statusLabel(status)}</span>
            <button id="image-layer-btn" className="btn btn-secondary" title="Image Layer (Shift+I)" onClick={() => setImageOpen(true)}>Image Layer</button>
            <button id="open-viewer-btn" className="btn btn-primary" title="Open Viewer Window" onClick={() => {
              if (!openViewerWindow()) window.alert('Failed to open viewer window. Please allow popups for this site.');
            }}>Open Viewer</button>
          </nav>
        </div>
      </header>

      <MappingWorkspace active={mode === 'map'} modules={modules} compositionModule={currentModule} />
      <div id="module-grid-container" hidden={mode === 'map'}>
        <div id="module-grid" className={view === 'list' ? 'list-view' : undefined}>
          {ready && visible.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888', padding: '2rem', gridColumn: '1 / -1' }}>No modules match the current filters.</p>
          ) : visible.map((module) => (
            <div key={module.id} className="module-card" data-module-id={module.id} onClick={() => loadModule(module)}>
              <div className="module-preview">
                <img
                  src={module.previewImage ? fromShell(module.previewImage) : placeholderPreview(module.name)}
                  alt={module.name}
                  onError={(event) => { event.currentTarget.src = placeholderPreview(module.name); }}
                />
              </div>
              <div className="module-info">
                <h3>{module.name}</h3>
                <p>{module.description || 'No description available'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="tray-overlay" className={`tray-overlay${overlay ? ' active' : ''}`} onClick={() => {
        setControlsOpen(false);
        setPlaylistOpen(false);
      }} />
      <ControlsTray
        module={activeModule}
        modules={modules}
        open={controlsOpen}
        onToggle={toggleControls}
        onClose={() => setControlsOpen(false)}
        onSelectModule={loadModule}
        onOpenViewer={() => {
          if (!openViewerWindow()) window.alert('Failed to open viewer window. Please allow popups for this site.');
        }}
      />
      {shellConfig ? (
        <PlaylistTray
          modules={modules}
          shellConfig={shellConfig}
          open={playlistOpen}
          onToggle={() => setPlaylistOpen((open) => !open)}
          onOpen={() => setControlsOpen(false)}
        />
      ) : null}
      <ImageLayerPanel open={imageOpen} onClose={() => setImageOpen(false)} />
    </div>
  );
}
