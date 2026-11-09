/** Resolve a path the legacy shell would load from /shell/index.html. */
export function fromShell(relativePath) {
  return new URL(relativePath, `${window.location.origin}/shell/index.html`).href;
}

export function placeholderPreview(name) {
  const label = String(name).replace(/[<>&"]/g, '');
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="%231a1a1a"/><rect x="50" y="50" width="200" height="100" fill="%232a2a2a" rx="8"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23888" font-family="Arial" font-size="18">${label}</text><text x="50%25" y="75%25" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="Arial" font-size="12">No Preview</text></svg>`;
}
