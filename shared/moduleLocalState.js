/**
 * Generic localStorage helpers for module session state (Live Server / no backend).
 * For portable JSON files when using `node serve.js`, use loadModuleStatePortable /
 * saveModuleStatePortable from the same module (re-exported from portableStorage.js).
 */
export { loadModuleStatePortable, saveModuleStatePortable } from './portableStorage.js';

/**
 * @param {string} moduleId
 * @param {T} defaultValue
 * @returns {T}
 * @template T
 */
export function loadModuleState(moduleId, defaultValue) {
  const key = `${moduleId}-module-state`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

/**
 * @param {string} moduleId
 * @param {object} state
 */
export function saveModuleState(moduleId, state) {
  const key = `${moduleId}-module-state`;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) {
    console.warn(`[moduleLocalState] save failed for ${moduleId}:`, e);
  }
}
