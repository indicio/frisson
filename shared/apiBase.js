/**
 * Resolve API base path for static + subpath deployments.
 *
 * Priority:
 *  1) window.FRISSON_API_BASE
 *  2) <meta name="frisson-api-base" content="/frisson/api">
 *  3) auto-detect from URL pathname (supports /frisson/shell, /frisson/modules, etc.)
 *  4) '/api'
 */

function normalizeBase(base) {
  if (!base || typeof base !== 'string') return '/api';
  const trimmed = base.trim();
  if (!trimmed) return '/api';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

function detectPrefixFromPathname(pathname) {
  if (!pathname || typeof pathname !== 'string') return '';
  const markers = ['/shell/', '/modules/', '/media/', '/shared/'];
  for (const marker of markers) {
    const idx = pathname.indexOf(marker);
    if (idx >= 0) return pathname.slice(0, idx);
  }
  return '';
}

export function getApiBase() {
  try {
    if (typeof window !== 'undefined' && typeof window.FRISSON_API_BASE === 'string' && window.FRISSON_API_BASE.trim()) {
      return normalizeBase(window.FRISSON_API_BASE);
    }

    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="frisson-api-base"]');
      if (meta) {
        const content = meta.getAttribute('content');
        if (content && content.trim()) return normalizeBase(content);
      }
    }

    if (typeof window !== 'undefined' && window.location?.pathname) {
      const prefix = detectPrefixFromPathname(window.location.pathname);
      return normalizeBase(`${prefix}/api`);
    }
  } catch {}

  return '/api';
}

export function getFavoritesApiBase() {
  return `${getApiBase()}/favorites`;
}
