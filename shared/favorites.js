/**
 * Shared Favorites Module
 * Centralised persistence for module favorites.
 *
 * Usage in a module controls.js:
 *
 *   import { Favorites } from '../../shared/favorites.js';
 *
 *   const favorites = new Favorites({
 *     moduleId: 'orbiter',
 *     getAllParams,   // () => Object   — read current UI state
 *     applyParams,   // (params) => void — apply params to UI + send via channel
 *     // optional overrides:
 *     saveButtonId:   'saveFavoriteBtn',
 *     nameInputId:    'favoriteName',
 *     listContainerId:'favoritesList',
 *   });
 *
 *   await favorites.init();    // load from data/favorites/<moduleId>.json when using node serve.js
 */

import { getFavoritesApiBase } from './apiBase.js';
import { pendingSave, saveJSON } from './saveQueue.js';

const API_BASE = getFavoritesApiBase();
const FAVORITES_OPEN_KEY = 'frisson-favorites-open';

function controlElement(id) {
  const local = document.getElementById(id);
  if (local) return local;
  try {
    if (window.parent && window.parent !== window) return window.parent.document.getElementById(id);
  } catch {
    /* The controls page can run on its own, outside the tray. */
  }
  return null;
}

export class Favorites {
  /**
   * @param {Object} opts
   * @param {string}   opts.moduleId          – unique module key (used as storage key)
   * @param {Function} opts.getAllParams       – returns current params object from the UI
   * @param {Function} opts.applyParams       – applies a params object to the UI
   * @param {string}  [opts.saveButtonId]      – id of the save button element
   * @param {string}  [opts.nameInputId]       – id of the name text input
   * @param {string}  [opts.listContainerId]   – id of the favorites list container div
   */
  constructor(opts) {
    this.moduleId = opts.moduleId;
    this.getAllParams = opts.getAllParams;
    this.applyParams = opts.applyParams;

    // Element IDs – support both naming conventions
    this.saveButtonId = opts.saveButtonId || 'saveFavoriteBtn';
    this.nameInputId = opts.nameInputId || 'favoriteName';
    this.listContainerId = opts.listContainerId || 'favoritesList';

    this.storageKey = `${this.moduleId}-favorites`;
    this._cache = null; // in-memory cache
    /** When true, GET /api/favorites/:id succeeded — persist only via PUT, not localStorage */
    this._fileBacked = false;
    /** Prevents double-applying default favorite (shell message + timer fallback). */
    this._defaultFavoriteApplied = false;
    /** @type {((ev: MessageEvent) => void) | null} */
    this._shellReadyListener = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */
  /* ------------------------------------------------------------------ */

  /** Wire up UI, render the list and load first favourite (loads project JSON first when using node serve.js). */
  async init() {
    // Register before any await so we do not miss shell → controls iframe postMessage.
    this._initShellReadyListener();
    await this.getAll();
    this._setupUI();
    this.render();
    this._loadDefault();
  }

  /** Return the full favorites map { name: { params, timestamp, updated } } */
  async getAll() {
    if (this._cache) return this._cache;
    const pending = pendingSave(`${API_BASE}/${encodeURIComponent(this.moduleId)}`);
    if (pending) {
      this._fileBacked = true;
      this._cache = this._normalise(pending);
      return this._cache;
    }
    // Try API up to 2 times (handles brief server unresponsiveness on startup).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${API_BASE}/${encodeURIComponent(this.moduleId)}`);
        if (res.ok) {
          this._fileBacked = true;
          const data = await res.json();
          this._cache = this._normalise(
            data && typeof data === 'object' ? data : {}
          );
          try {
            localStorage.removeItem(this.storageKey);
          } catch {}
          return this._cache;
        }
      } catch (e) {
        if (attempt === 0) {
          console.warn(`[favorites] ${this.moduleId}: API attempt 1 failed, retrying...`);
          await new Promise(r => setTimeout(r, 300));
        } else {
          console.warn(`[favorites] ${this.moduleId}: API unavailable`, e.message || e);
        }
      }
    }
    this._fileBacked = false;
    this._cache = this._readLocal();
    return this._cache;
  }

  /** Synchronous read from cache (call after await init() / getAll()). */
  getAllSync() {
    if (this._cache) return this._cache;
    this._cache = this._readLocal();
    return this._cache;
  }

  /** Save (or overwrite) a favourite by name. */
  async save(name) {
    const all = this.getAllSync();
    const existing = all[name];
    all[name] = {
      params: this.getAllParams(),
      timestamp: existing ? existing.timestamp : Date.now(),
      updated: Date.now(),
    };
    this._cache = all;
    if (this._fileBacked) {
      const ok = await this._pushToServer(all);
      if (!ok) {
        console.error(`[favorites] ${this.moduleId}: could not save to data/favorites/${this.moduleId}.json`);
      }
    } else {
      this._writeLocal(all);
      await this._pushToServer(all);
    }
    this.render();
  }

  /** Load a favourite by name. */
  load(name) {
    const all = this.getAllSync();
    const fav = all[name];
    if (!fav) return;
    // Support both nested (params key) and flat (legacy) structures
    const params = fav.params ?? this._extractParams(fav);
    this.applyParams(params);
  }

  /** Delete a favourite by name (with confirm dialog). */
  async remove(name) {
    if (!confirm(`Delete favorite "${name}"?`)) return;
    const all = this.getAllSync();
    delete all[name];
    this._cache = all;
    if (this._fileBacked) {
      const ok = await this._pushToServer(all);
      if (!ok) {
        console.error(`[favorites] ${this.moduleId}: could not save to data/favorites/${this.moduleId}.json`);
      }
    } else {
      this._writeLocal(all);
      await this._pushToServer(all);
    }
    this.render();
  }

  /** Populate the edit field and load the favourite for editing. */
  edit(name) {
    this.load(name);
    const input = controlElement(this.nameInputId);
    if (input) {
      input.value = name;
      input.focus();
      input.select();
    }
  }

  /** Get sorted list of favourite names (for external consumers like playlist). */
  getNames() {
    const all = this.getAllSync();
    return Object.keys(all).sort();
  }

  /** Get params for a favourite by name (for external consumers like playlist). */
  getParams(name) {
    const all = this.getAllSync();
    const fav = all[name];
    if (!fav) return null;
    return fav.params ?? this._extractParams(fav);
  }

  /* ------------------------------------------------------------------ */
  /*  UI wiring                                                         */
  /* ------------------------------------------------------------------ */

  /** Force re-fetch favorites from the server, clear cache, and re-render. */
  async reload() {
    if (pendingSave(`${API_BASE}/${encodeURIComponent(this.moduleId)}`) &&
        !confirm('There are unsaved changes in this browser. Reload the project file for viewing? The recovery copy will remain available through Retry saving.')) return;
    const container = controlElement(this.listContainerId);
    const url = `${API_BASE}/${encodeURIComponent(this.moduleId)}`;
    console.log(`[favorites] reload: fetching ${url}`);
    if (container) {
      container.innerHTML = '<div style="color:rgba(255,255,200,0.7);font-size:13px;text-align:center;padding:10px;">Loading...</div>';
    }
    this._cache = null;
    this._fileBacked = false;
    try {
      const res = await fetch(url);
      console.log(`[favorites] reload: status ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`[favorites] reload: got ${Object.keys(data).length} favorite(s)`, data);
        this._fileBacked = true;
        this._cache = this._normalise(data && typeof data === 'object' ? data : {});
      } else {
        console.error(`[favorites] reload: server returned ${res.status} for ${url}`);
        if (container) {
          container.innerHTML = `<div style="color:#f88;font-size:13px;text-align:center;padding:10px;">API returned ${res.status} for:<br><code style="font-size:11px;word-break:break-all;">${url}</code></div>`;
        }
        this._cache = {};
        return;
      }
    } catch (e) {
      console.error('[favorites] reload: fetch failed', e);
      if (container) {
        container.innerHTML = `<div style="color:#f88;font-size:13px;text-align:center;padding:10px;">Could not reach API at ${url}</div>`;
      }
      this._cache = {};
      return;
    }
    this.render();
    // Auto-apply the most recent favorite after reload
    const all = this.getAllSync();
    const names = Object.keys(all);
    if (names.length > 0) {
      const sorted = names.sort((a, b) => {
        const ta = all[a].updated || all[a].timestamp || 0;
        const tb = all[b].updated || all[b].timestamp || 0;
        return tb - ta;
      });
      this.load(sorted[0]);
    }
  }

  /** Render the favourites list into the DOM container. */
  render() {
    const container = controlElement(this.listContainerId);
    if (!container) return;

    // Use a unique window key so multiple modules in the same page don't clash.
    // Replace non-identifier chars (e.g. hyphens) so the key is valid in inline onclick JS.
    const all = this.getAllSync();
    const names = Object.keys(all).sort((a, b) =>
      (all[b].updated || all[b].timestamp) - (all[a].updated || all[a].timestamp)
    );
    this._ensureNameLabel();
    container.replaceChildren();
    if (!names.length) {
      const empty = document.createElement('p');
      empty.className = 'favorites-empty';
      empty.textContent = 'Save a favorite to reuse these settings.';
      container.appendChild(empty);
    }
    for (const name of names) {
      const row = document.createElement('div');
      row.className = 'favorite-item';
      const actions = [
        [name, 'secondary', () => this.load(name), `Load ${name}`],
        ['Edit', 'secondary edit', () => this.edit(name), `Edit ${name}`],
        ['Delete', 'secondary delete', () => this.remove(name), `Delete ${name}`],
      ];
      for (const [text, style, action, label] of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `btn ${style}`;
        button.textContent = text;
        button.title = label;
        button.setAttribute('aria-label', label);
        button.addEventListener('click', action);
        row.appendChild(button);
      }
      container.appendChild(row);
    }
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'btn secondary favorites-reload';
    reload.textContent = 'Reload from file';
    reload.addEventListener('click', () => this.reload());
    const group = controlElement(this.saveButtonId)?.closest('.favorites-input-group');
    group?.querySelectorAll('.favorites-reload').forEach((node) => node.remove());
    if (group) group.appendChild(reload);
    else container.appendChild(reload);
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                   */
  /* ------------------------------------------------------------------ */

  _ensureNameLabel() {
    const input = controlElement(this.nameInputId);
    if (!input) return;
    const group = input.closest('.favorites-input-group') || input.parentElement;
    if (!group) return;
    let field = group.querySelector('.favorites-field');
    if (!field) {
      field = input.ownerDocument.createElement('div');
      field.className = 'favorites-field';
      input.before(field);
      field.appendChild(input);
    }
    if (!field.querySelector('.favorites-name-label')) {
      const label = input.ownerDocument.createElement('label');
      label.className = 'favorites-name-label';
      label.htmlFor = input.id;
      label.textContent = 'Name';
      field.prepend(label);
    }
    input.placeholder = 'Name this favorite';
    input.setAttribute('aria-label', 'Favorite name');
  }

  _bindCollapse() {
    const input = controlElement(this.nameInputId);
    const panel = input?.closest('.favorites-panel');
    const heading = panel?.querySelector('h3');
    if (!panel || !heading || panel.dataset.collapseBound) return;
    panel.dataset.collapseBound = '1';
    const open = localStorage.getItem(FAVORITES_OPEN_KEY) !== 'off';
    panel.classList.toggle('is-collapsed', !open);
    heading.setAttribute('role', 'button');
    heading.tabIndex = 0;
    heading.setAttribute('aria-expanded', open ? 'true' : 'false');
    const toggle = () => {
      const collapsed = panel.classList.toggle('is-collapsed');
      heading.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      try { localStorage.setItem(FAVORITES_OPEN_KEY, collapsed ? 'off' : 'on'); } catch { /* private mode */ }
    };
    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggle();
    });
  }

  _setupUI() {
    this._ensureNameLabel();
    this._bindCollapse();
    const saveBtn = controlElement(this.saveButtonId);
    const nameInput = controlElement(this.nameInputId);

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const name = nameInput?.value.trim();
        if (name) {
          this.save(name);
          if (nameInput) nameInput.value = '';
        }
      });
    }

    if (nameInput) {
      nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveBtn?.click();
      });
    }
  }

  _initShellReadyListener() {
    if (this._shellReadyListener) return;
    this._shellReadyListener = (ev) => {
      const d = ev.data;
      if (!d || d.type !== 'frisson-controls-ready' || d.moduleId !== this.moduleId) return;
      this._applyDefaultFavoriteOnce();
    };
    window.addEventListener('message', this._shellReadyListener);
  }

  /**
   * Apply the most recently updated favorite once (shell notifies when viewer + controls iframe are in sync).
   */
  _applyDefaultFavoriteOnce() {
    if (this._defaultFavoriteApplied) return;
    // If cache hasn't loaded yet, defer until it has (retry every 100ms, up to 3s).
    if (!this._cache) {
      if (!this._applyRetryCount) this._applyRetryCount = 0;
      if (this._applyRetryCount < 30) {
        this._applyRetryCount++;
        setTimeout(() => this._applyDefaultFavoriteOnce(), 100);
      }
      return;
    }
    const all = this.getAllSync();
    const names = Object.keys(all);
    if (names.length === 0) {
      this._defaultFavoriteApplied = true;
      return;
    }
    this._defaultFavoriteApplied = true;

    const sorted = names.sort((a, b) => {
      const ta = all[a].updated || all[a].timestamp || 0;
      const tb = all[b].updated || all[b].timestamp || 0;
      return tb - ta;
    });
    const defaultName = sorted[0];
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.load(defaultName);
        setTimeout(() => this.load(defaultName), 220);
      }, 0);
    });
  }

  _loadDefault() {
    // Fallback when controls are opened outside the shell (no postMessage) or message was missed.
    setTimeout(() => this._applyDefaultFavoriteOnce(), 800);
  }

  /* -- localStorage -------------------------------------------------- */

  _readLocal() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const data = JSON.parse(raw);
      // Normalise legacy flat entries → nested params
      return this._normalise(data);
    } catch {
      return {};
    }
  }

  _writeLocal(all) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(all));
    } catch (e) {
      console.error(`[favorites] localStorage write error for ${this.moduleId}:`, e);
    }
  }

  /* -- server -------------------------------------------------------- */

  async _pushToServer(all) {
    return saveJSON(`${API_BASE}/${encodeURIComponent(this.moduleId)}`, all);
  }

  /* -- data helpers -------------------------------------------------- */

  /** Normalise a favourites map so every entry uses { params, timestamp, updated }. */
  _normalise(data) {
    const out = Object.create(null);
    for (const [name, entry] of Object.entries(data)) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.params) {
        // Already nested – keep as-is
        out[name] = entry;
      } else {
        // Flat legacy: everything except timestamp/updated is a param
        out[name] = {
          params: this._extractParams(entry),
          timestamp: entry.timestamp || Date.now(),
          updated: entry.updated || entry.timestamp || Date.now(),
        };
      }
    }
    return out;
  }

  /** Extract param keys from a flat favourite entry (strip meta keys). */
  _extractParams(entry) {
    const params = {};
    for (const [k, v] of Object.entries(entry)) {
      if (k === 'timestamp' || k === 'updated') continue;
      params[k] = v;
    }
    return params;
  }
}

/* -------------------------------------------------------------------- */
/*  Static helpers for external consumers (e.g. playlist-tray.js)       */
/* -------------------------------------------------------------------- */

/**
 * Get favourite names for a module (async, tries server first).
 * @param {string} moduleId
 * @returns {Promise<string[]>}
 */
export async function getModuleFavoriteNames(moduleId) {
  const data = await _fetchModuleFavorites(moduleId);
  return Object.keys(data).sort();
}

/**
 * Get params for a specific favourite (async, tries server first).
 * @param {string} moduleId
 * @param {string} favoriteName
 * @returns {Promise<Object|null>}
 */
export async function getModuleFavoriteParams(moduleId, favoriteName) {
  const data = await _fetchModuleFavorites(moduleId);
  const fav = data[favoriteName];
  if (!fav) return null;
  if (fav.params) return fav.params;
  // flat legacy
  const params = {};
  for (const [k, v] of Object.entries(fav)) {
    if (k === 'timestamp' || k === 'updated') continue;
    params[k] = v;
  }
  return params;
}

/**
 * Get params for the most recently updated favourite of a module.
 * @param {string} moduleId
 * @returns {Promise<Object|null>}
 */
export async function getMostRecentFavoriteParams(moduleId) {
  const data = await _fetchModuleFavorites(moduleId);
  const names = Object.keys(data);
  if (names.length === 0) return null;
  names.sort((a, b) => {
    const ta = data[a].updated || data[a].timestamp || 0;
    const tb = data[b].updated || data[b].timestamp || 0;
    return tb - ta;
  });
  const fav = data[names[0]];
  if (!fav) return null;
  if (fav.params) return fav.params;
  const params = {};
  for (const [k, v] of Object.entries(fav)) {
    if (k === 'timestamp' || k === 'updated') continue;
    params[k] = v;
  }
  return params;
}

async function _fetchModuleFavorites(moduleId) {
  const storageKey = `${moduleId}-favorites`;
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(moduleId)}`);
    if (res.ok) {
      const data = await res.json();
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      return data && typeof data === 'object' ? data : {};
    }
  } catch {}
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
