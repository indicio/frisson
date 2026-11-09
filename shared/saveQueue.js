/** Ordered saves with recoverable browser copies and an explicit retry notice. */
const prefix = 'frisson-pending-save:';
const queues = new Map();
const failed = new Map();

export function pendingSave(url) {
  try {
    const raw = localStorage.getItem(prefix + url);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function showNotice() {
  if (typeof document === 'undefined' || !document.body) return;
  let notice = document.getElementById('frisson-save-notice');
  if (!failed.size) { notice?.remove(); return; }
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'frisson-save-notice';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, { position: 'fixed', bottom: '12px', left: '12px', right: '12px', zIndex: '100000', padding: '14px', background: '#30251b', color: '#fff', border: '1px solid #c79860', font: '14px/1.5 sans-serif' });
    document.body.appendChild(notice);
  }
  notice.replaceChildren();
  const text = document.createElement('span');
  text.textContent = [...failed.values()].every(item => item.backedUp)
    ? 'Changes have not reached the project file. A recovery copy is saved in this browser. '
    : 'Changes could not be saved to the project or backed up in this browser. Keep this window open. ';
  const retry = document.createElement('button');
  retry.textContent = 'Retry saving';
  retry.onclick = () => { for (const [url, item] of failed) void saveJSON(url, item.data); };
  notice.append(text, retry);
}

export function saveJSON(url, data) {
  // Snapshot now: callers may mutate their cached objects before this request runs.
  const body = JSON.stringify(data);
  let backedUp = false;
  try { localStorage.setItem(prefix + url, body); backedUp = true; } catch {}
  const prior = queues.get(url) || Promise.resolve();
  const task = prior.catch(() => {}).then(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
      if (!response.ok) throw new Error(`Save returned ${response.status}`);
      // A newer save may already be queued. Keep its recovery copy.
      try { if (localStorage.getItem(prefix + url) === body) localStorage.removeItem(prefix + url); } catch {}
      failed.delete(url);
      showNotice();
      return true;
    } catch (error) {
      failed.set(url, { data: pendingSave(url) || JSON.parse(body), backedUp });
      console.warn('[save] Project file not updated:', url, error.message);
      showNotice();
      return false;
    } finally { clearTimeout(timeout); }
  });
  queues.set(url, task);
  void task.finally(() => { if (queues.get(url) === task) queues.delete(url); });
  return task;
}

function restoreNotices() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const url = key.slice(prefix.length);
      const data = pendingSave(url);
      if (data) failed.set(url, { data, backedUp: true });
    }
  } catch {}
  showNotice();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', restoreNotices, { once: true });
  else restoreNotices();
}
