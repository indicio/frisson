import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Square,
  Trash2,
} from 'lucide-react';
import { getModuleFavoriteNames, getModuleFavoriteParams } from '../../shared/favorites.js';
import { updateShellConfig } from '../../shared/portableStorage.js';
import { ensureViewerOpen, getViewerWindow } from './bridge/viewerBridge.js';
import { createPlaybackFlags } from './playbackFlags.js';

function newItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function PlaylistTray({ modules, shellConfig, open, onToggle, onOpen }) {
  const flags = useRef(null);
  if (!flags.current) {
    flags.current = createPlaybackFlags({
      repeat: shellConfig?.repeat,
      fade: shellConfig?.fade,
    });
  }
  const [items, setItems] = useState(() => (Array.isArray(shellConfig?.playlist) ? shellConfig.playlist : []));
  const [saved, setSaved] = useState(() => (
    shellConfig?.savedPlaylists && typeof shellConfig.savedPlaylists === 'object' ? shellConfig.savedPlaylists : {}
  ));
  const [savedName, setSavedName] = useState('');
  const [selectedSaved, setSelectedSaved] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [favoriteNames, setFavoriteNames] = useState({});
  const [repeatOn, setRepeatOn] = useState(() => Boolean(shellConfig?.repeat));
  const [fadeOn, setFadeOn] = useState(() => shellConfig?.fade !== false);
  const dragId = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const ids = [...new Set(items.map((item) => item.moduleId))];
    let cancelled = false;
    Promise.all(ids.map(async (id) => [id, await getModuleFavoriteNames(id).catch(() => [])]))
      .then((pairs) => {
        if (cancelled) return;
        setFavoriteNames(Object.fromEntries(pairs));
      });
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    const timer = setInterval(() => {
      const engine = flags.current;
      const nowPlaying = engine.isPlaying();
      const index = engine.currentIndex();
      setPlaying((previous) => (previous === nowPlaying ? previous : nowPlaying));
      setCurrentIndex((previous) => (previous === index ? previous : index));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  async function persist(nextItems, extra = {}) {
    try {
      await updateShellConfig({
        playlist: nextItems,
        repeat: flags.current.getRepeatMode(),
        fade: flags.current.getFadeEnabled(),
        ...extra,
      });
    } catch (error) {
      console.error('Error saving playlist state:', error);
    }
  }

  function replaceItems(next) {
    const ordered = next.map((item, index) => ({ ...item, order: index }));
    setItems(ordered);
    void persist(ordered);
  }

  async function addModule(moduleId) {
    const module = modules.find((entry) => entry.id === moduleId);
    if (!module) return;
    const names = await getModuleFavoriteNames(moduleId).catch(() => []);
    const item = {
      id: newItemId(),
      moduleId: module.id,
      moduleName: module.name,
      path: module.path,
      favorite: names[0] || 'Default',
      duration: 30,
      order: itemsRef.current.length,
    };
    replaceItems([...itemsRef.current, item]);
    setModalOpen(false);
  }

  function reorder(draggedId, targetId, after) {
    const list = [...itemsRef.current];
    const draggedIndex = list.findIndex((item) => item.id === draggedId);
    const targetIndex = list.findIndex((item) => item.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;
    const [dragged] = list.splice(draggedIndex, 1);
    const newIndex = after ? targetIndex + 1 : targetIndex;
    list.splice(newIndex > draggedIndex ? newIndex - 1 : newIndex, 0, dragged);
    replaceItems(list);
  }

  function viewerContainer() {
    const viewer = getViewerWindow();
    if (!viewer) {
      window.alert('Viewer window is not open.');
      return null;
    }
    try {
      const container = viewer.document.getElementById('viewer-container');
      if (!container) {
        window.alert('The viewer is not ready. Reopen it from this dashboard and try again.');
        return null;
      }
      return container;
    } catch (error) {
      console.error('Cannot access viewer container (cross-origin):', error);
      window.alert('The viewer is not ready. Reopen it from this dashboard and try again.');
      return null;
    }
  }

  function entries() {
    return itemsRef.current.map((item) => ({
      moduleId: item.moduleId,
      moduleName: item.moduleName,
      modulePath: item.path || item.modulePath,
      durationMs: item.duration * 1000,
      favorite: item.favorite,
    }));
  }

  async function paramsFor(entry) {
    if (entry.favorite && entry.favorite !== 'Default') {
      return getModuleFavoriteParams(entry.moduleId, entry.favorite);
    }
    return null;
  }

  async function startPlayback() {
    if (itemsRef.current.length === 0) {
      window.alert('Playlist is empty. Add modules first.');
      return;
    }
    if (!(await ensureViewerOpen())) return;
    const remote = getViewerWindow()?.frissonPlaylist;
    if (!remote) {
      window.alert('The viewer is not ready. Reopen it from this dashboard and try again.');
      return;
    }
    flags.current.attach(remote);
    flags.current.setPlaylist(entries());
    const container = viewerContainer();
    if (!container) return;
    setPaused(false);
    setPlaying(true);
    setCurrentIndex(0);
    flags.current.play(container, () => {
      setCurrentIndex(flags.current.currentIndex());
    }, paramsFor);
  }

  function pausePlayback() {
    flags.current.stop();
    setPaused(true);
  }

  function resumePlayback() {
    if (itemsRef.current.length === 0) return;
    const container = viewerContainer();
    if (!container) return;
    setPaused(false);
    flags.current.resume(container, paramsFor);
  }

  function stopPlayback() {
    flags.current.stop();
    setPlaying(false);
    setPaused(false);
    setCurrentIndex(-1);
  }

  function clearPlaylist() {
    if (itemsRef.current.length === 0) return;
    if (!window.confirm(`Clear all ${itemsRef.current.length} module(s) from playlist?`)) return;
    stopPlayback();
    flags.current.clear();
    replaceItems([]);
  }

  function toggleRepeat() {
    flags.current.toggleRepeatMode();
    setRepeatOn(flags.current.getRepeatMode());
    void persist(itemsRef.current);
  }

  function toggleFade() {
    flags.current.toggleFadeEnabled();
    setFadeOn(flags.current.getFadeEnabled());
    void persist(itemsRef.current);
  }

  function saveNamed(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = { ...saved, [trimmed]: itemsRef.current.map((item) => ({ ...item })) };
    setSaved(next);
    setSelectedSaved(trimmed);
    setSavedName('');
    void updateShellConfig({ savedPlaylists: next }).catch((error) => {
      console.error('Error saving playlists:', error);
    });
  }

  function loadNamed(name) {
    if (!name || !saved[name]) return;
    if (playing || paused) stopPlayback();
    const next = saved[name].map((item) => ({ ...item }));
    setSelectedSaved(name);
    replaceItems(next);
  }

  function deleteNamed(name) {
    if (!name || !saved[name]) return;
    if (!window.confirm(`Delete saved playlist "${name}"?`)) return;
    const next = { ...saved };
    delete next[name];
    setSaved(next);
    setSelectedSaved('');
    void updateShellConfig({ savedPlaylists: next }).catch((error) => {
      console.error('Error saving playlists:', error);
    });
  }

  function toggleTray() {
    if (!open) onOpen();
    onToggle();
  }

  const playDisabled = playing && !paused;
  const pauseDisabled = !playing || paused;
  const stopDisabled = !playing && !paused;

  return (
    <>
      <div id="playlist-tray" className={`playlist-tray${open ? ' open' : ' closed'}`}>
        <div className="playlist-tray-header" id="playlist-tray-header">
          <h2 style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); toggleTray(); }}>Playlist</h2>
          <div className="saved-playlists-bar">
            <span className="saved-playlists-label">Saved:</span>
            <select
              id="saved-playlist-select"
              className="saved-playlist-select"
              value={selectedSaved}
              onChange={(event) => setSelectedSaved(event.target.value)}
            >
              <option value="">-- Saved Playlists --</option>
              {Object.keys(saved).sort().map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button type="button" id="load-saved-playlist-btn" className="saved-playlist-btn" title="Load selected playlist" onClick={() => loadNamed(selectedSaved)}>Load</button>
            <input
              type="text"
              id="saved-playlist-name"
              className="saved-playlist-name"
              placeholder="Name..."
              maxLength={64}
              value={savedName}
              onChange={(event) => setSavedName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveNamed(savedName || selectedSaved);
              }}
            />
            <button type="button" id="save-saved-playlist-btn" className="saved-playlist-btn primary" title="Save current playlist" onClick={() => saveNamed(savedName || selectedSaved)}>Save</button>
            <button type="button" id="delete-saved-playlist-btn" className="saved-playlist-btn danger" title="Delete selected playlist" onClick={() => deleteNamed(selectedSaved)}>Delete</button>
          </div>
          <div className="playback-controls">
            <button type="button" className="playback-btn primary" id="play-btn" title="Play" disabled={playDisabled} onClick={(event) => { event.stopPropagation(); paused ? resumePlayback() : startPlayback(); }}>
              <Play className="lucide-icon" strokeWidth={1.75} aria-hidden />
            </button>
            <button type="button" className="playback-btn" id="pause-btn" title="Pause" disabled={pauseDisabled} onClick={(event) => { event.stopPropagation(); pausePlayback(); }}>
              <Pause className="lucide-icon" strokeWidth={1.75} aria-hidden />
            </button>
            <button type="button" className="playback-btn" id="stop-btn" title="Stop" disabled={stopDisabled} onClick={(event) => { event.stopPropagation(); stopPlayback(); }}>
              <Square className="lucide-icon" strokeWidth={1.75} aria-hidden />
            </button>
            <span className="playback-controls-divider" aria-hidden="true" />
            <button type="button" className={`playback-btn${repeatOn ? ' active' : ''}`} id="repeat-btn" title={repeatOn ? 'Repeat: On (playlist loops)' : 'Repeat: Off'} onClick={(event) => { event.stopPropagation(); toggleRepeat(); }}>
              <Repeat className="lucide-icon" strokeWidth={1.75} aria-hidden />
            </button>
            <button type="button" className={`playback-btn${fadeOn ? ' active' : ''}`} id="fade-btn" title={fadeOn ? 'Fade: On (fade between modules)' : 'Fade: Off'} onClick={(event) => { event.stopPropagation(); toggleFade(); }}>
              <ArrowLeftRight className="lucide-icon" strokeWidth={1.75} aria-hidden />
            </button>
            <span className="playback-controls-divider" aria-hidden="true" />
            <button type="button" className="playback-btn playback-btn--clear" id="clear-btn" title="Clear playlist" onClick={(event) => { event.stopPropagation(); clearPlaylist(); }}>
              <Trash2 className="lucide-icon" strokeWidth={1.75} aria-hidden /><span>clear</span>
            </button>
          </div>
          <button type="button" className="playlist-tray-toggle" id="playlist-tray-toggle" aria-label="Toggle Playlist Tray" onClick={(event) => { event.stopPropagation(); toggleTray(); }}>
            <ChevronDown className="lucide-icon" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <div className="playlist-tray-content">
          <div className="playlist-items" id="playlist-items">
            {items.map((item, index) => {
              const names = favoriteNames[item.moduleId] || [];
              const options = ['Default', ...names.filter((name) => name !== 'Default')];
              const selected = options.includes(item.favorite) ? item.favorite : options[0];
              return (
                <div
                  key={item.id}
                  className={`playlist-item${currentIndex === index && playing ? ' playing' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    dragId.current = item.id;
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item.id);
                    event.currentTarget.classList.add('dragging');
                  }}
                  onDragEnd={(event) => {
                    dragId.current = null;
                    event.currentTarget.classList.remove('dragging');
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.currentTarget.classList.add('drag-over');
                  }}
                  onDragLeave={(event) => event.currentTarget.classList.remove('drag-over')}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.currentTarget.classList.remove('drag-over');
                    const rect = event.currentTarget.getBoundingClientRect();
                    reorder(dragId.current, item.id, event.clientX > rect.left + rect.width / 2);
                  }}
                >
                  <button type="button" className="playlist-item-remove" title="Remove" onClick={() => {
                    const list = itemsRef.current.filter((entry) => entry.id !== item.id);
                    if (index === currentIndex || currentIndex >= list.length) stopPlayback();
                    replaceItems(list);
                  }}>&times;</button>
                  <div className="playlist-item-drag-handle" title="Drag to reorder" />
                  <div className="playlist-item-name" title={item.moduleName}>{item.moduleName}</div>
                  <div className="playlist-item-controls">
                    <div className="playlist-item-control-group fav-group">
                      <label>Favorite</label>
                      <select value={selected} onChange={(event) => {
                        replaceItems(itemsRef.current.map((entry) => (
                          entry.id === item.id ? { ...entry, favorite: event.target.value } : entry
                        )));
                      }}>
                        {options.map((name) => <option key={name} value={name}>{name}</option>)}
                      </select>
                    </div>
                    <div className="playlist-item-control-group dur-group">
                      <label>Sec</label>
                      <input
                        type="number"
                        min={5}
                        max={300}
                        step={5}
                        value={item.duration}
                        onChange={(event) => {
                          const duration = parseInt(event.target.value, 10) || 30;
                          replaceItems(itemsRef.current.map((entry) => (
                            entry.id === item.id ? { ...entry, duration } : entry
                          )));
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="add-module-btn" onClick={() => setModalOpen(true)}><span>Add Module</span></div>
          </div>
        </div>
      </div>
      <div className={`add-module-modal${modalOpen ? ' open' : ''}`} id="add-module-modal" onClick={(event) => {
        if (event.target === event.currentTarget) setModalOpen(false);
      }}>
        <div className="add-module-modal-content">
          <div className="add-module-modal-header">
            <h3>Add Module to Playlist</h3>
            <button type="button" className="add-module-modal-close" id="modal-close" onClick={() => setModalOpen(false)}>×</button>
          </div>
          <div className="add-module-modal-body">
            <div className="available-modules-list" id="available-modules-list">
              {modules.map((module) => (
                <div key={module.id} className="available-module-card">
                  <h4>{module.name}</h4>
                  <p>{module.description || 'No description available'}</p>
                  <button type="button" onClick={() => addModule(module.id)}>Add to Playlist</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
