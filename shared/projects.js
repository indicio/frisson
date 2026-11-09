/** Local mapping projects. The server stores them under data/projects. */
import { saveJSON } from './saveQueue.js';

export function createProjectId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `project-${Date.now().toString(36)}`;
}

export function emptyProjectIndex() {
  return { version: 1, activeId: null, projects: [] };
}

export function normalizeProjectIndex(value) {
  const projects = Array.isArray(value?.projects)
    ? value.projects.filter((item) => item && typeof item.id === 'string' && item.id !== 'index')
    : [];
  return {
    version: 1,
    activeId: typeof value?.activeId === 'string' && value.activeId !== 'index' ? value.activeId : null,
    projects: projects.map((item) => ({
      id: item.id,
      name: String(item.name || 'Untitled').slice(0, 80),
      updatedAt: item.updatedAt || null,
    })),
  };
}

export async function loadProjectIndex() {
  try {
    const response = await fetch('/api/projects');
    if (!response.ok) return emptyProjectIndex();
    return normalizeProjectIndex(await response.json());
  } catch {
    return emptyProjectIndex();
  }
}

export function saveProjectIndex(index) {
  return saveJSON('/api/projects', normalizeProjectIndex(index));
}

export async function loadProject(id) {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    if (!response.ok) return null;
    const doc = await response.json();
    if (!doc || !Array.isArray(doc.scene?.surfaces) || !doc.scene?.output) return null;
    return doc;
  } catch {
    return null;
  }
}

export function saveProject(doc) {
  return saveJSON(`/api/projects/${encodeURIComponent(doc.id)}`, doc);
}

export async function deleteProject(id) {
  const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Project could not be deleted');
}
