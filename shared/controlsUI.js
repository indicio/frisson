/** Associate existing and dynamically added labels without changing parameter IDs. */
function labelControls(root = document) {
  for (const label of root.querySelectorAll('.control-item label, label.toggle-label')) {
    if (label.htmlFor || label.querySelector('input, select, textarea')) continue;
    const sibling = label.nextElementSibling;
    if (sibling?.matches('input, select, textarea') && sibling.id) {
      label.htmlFor = sibling.id;
      continue;
    }
    const item = label.closest('.control-item, .toggle-container');
    if (!item) continue;
    const fields = item.querySelectorAll('input, select, textarea');
    if (fields.length === 1 && fields[0].id) label.htmlFor = fields[0].id;
  }
}
function packControlColumns() {
  document.querySelectorAll('.control-panel').forEach((panel) => {
    if (panel.querySelector(':scope > .control-flow')) return;
    const flow = document.createElement('div');
    flow.className = 'control-flow';
    while (panel.firstChild) flow.appendChild(panel.firstChild);
    panel.appendChild(flow);
  });
}

labelControls();
packControlColumns();
let pending = false;
new MutationObserver(() => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; labelControls(); packControlColumns(); });
}).observe(document.body, { childList: true, subtree: true });
