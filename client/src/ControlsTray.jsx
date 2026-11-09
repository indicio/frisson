import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { applyControlColumns, startControlPreview } from '../../shared/controlPreview.js';
import { mountPreviewImage } from '../../shared/previewImageLayer.js';
import { fromShell } from './shellUrl.js';
import { ModuleControls } from './controls/ModuleControls.jsx';

const PREVIEW_KEY = 'frisson-control-preview';

export function ControlsTray({ module, modules = [], open, onToggle, onClose, onSelectModule, onOpenViewer }) {
  const [preview, setPreview] = useState(() => localStorage.getItem(PREVIEW_KEY) !== 'off');
  const [canRandomize, setCanRandomize] = useState(false);
  const frameRef = useRef(null);
  const stageRef = useRef(null);
  const contentRef = useRef(null);
  const favoritesRef = useRef(null);
  const showPreview = open && preview && Boolean(module?.path);
  const moduleOptions = useMemo(
    () => [...modules].sort((a, b) => a.name.localeCompare(b.name)),
    [modules],
  );

  useEffect(() => {
    localStorage.setItem(PREVIEW_KEY, preview ? 'on' : 'off');
  }, [preview]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const apply = () => applyControlColumns(content, true);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(content);
    const iframe = content.querySelector('iframe');
    iframe?.addEventListener('load', apply);
    return () => {
      observer.disconnect();
      iframe?.removeEventListener('load', apply);
    };
  }, [showPreview, module?.id]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return undefined;
    const detect = () => {
      const iframe = content.querySelector('iframe');
      const root = iframe?.contentDocument || content;
      setCanRandomize(Boolean(root.querySelector('[data-randomize-settings]')));
    };
    detect();
    const iframe = content.querySelector('iframe');
    iframe?.addEventListener('load', detect);
    const observer = new MutationObserver(detect);
    observer.observe(content, { childList: true, subtree: true });
    return () => {
      iframe?.removeEventListener('load', detect);
      observer.disconnect();
    };
  }, [module?.id]);

  useEffect(() => {
    const content = contentRef.current;
    const host = favoritesRef.current;
    if (!content || !host) return undefined;
    host.replaceChildren();
    const mount = () => {
      const iframe = content.querySelector('iframe');
      const doc = iframe?.contentDocument;
      doc?.documentElement?.classList.add('in-tray');
      doc?.body?.classList.add('in-tray');
      const panel = doc?.querySelector('.favorites-panel')
        || content.querySelector('.favorites-panel');
      if (panel && panel.parentElement !== host) host.replaceChildren(panel);
    };
    mount();
    const iframe = content.querySelector('iframe');
    iframe?.addEventListener('load', mount);
    const observer = new MutationObserver(mount);
    observer.observe(content, { childList: true, subtree: true });
    return () => {
      iframe?.removeEventListener('load', mount);
      observer.disconnect();
    };
  }, [module?.id]);

  function randomizeSettings() {
    const content = contentRef.current;
    const iframe = content?.querySelector('iframe');
    const root = iframe?.contentDocument || content;
    root?.querySelector('[data-randomize-settings]')?.click();
  }

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    return mountPreviewImage(frame);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!showPreview || !stage) return undefined;
    let handle = null;
    let cancel = false;
    startControlPreview(stage, fromShell(module.path)).then((next) => {
      if (cancel) next.stop();
      else handle = next;
    });
    return () => {
      cancel = true;
      handle?.stop();
    };
  }, [showPreview, module?.path, module?.id]);

  return (
    <div id="controls-tray" className={`controls-tray${open ? ' open' : ''}`}>
      <div className="controls-tray-nib-column">
        <button
          type="button"
          id="toggle-controls-btn"
          className="toggle-controls-btn"
          title={open ? 'Close Controls' : 'Open Controls'}
          onClick={onToggle}
        >
          {open
            ? <ChevronRight className="lucide-icon toggle-controls-icon" strokeWidth={1.75} aria-hidden />
            : <ChevronLeft className="lucide-icon toggle-controls-icon" strokeWidth={1.75} aria-hidden />}
        </button>
      </div>
      <div className="controls-tray-panel">
        <div className="controls-tray-header">
          <h3 id="controls-tray-title">{module ? `${module.name} Controls` : 'Module Controls'}</h3>
          <select
            className="controls-module-picker"
            aria-label="Choose module"
            value={module?.id || ''}
            onChange={(event) => {
              const next = moduleOptions.find((item) => item.id === event.target.value);
              if (next) onSelectModule?.(next);
            }}
          >
            <option value="" disabled>Choose a module</option>
            {moduleOptions.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary controls-open-viewer" onClick={onOpenViewer}>Open Viewer</button>
          <button id="close-controls-btn" className="btn-close" title="Close Controls" onClick={onClose}>×</button>
        </div>
        <div className="controls-stage">
          <aside className={`controls-preview${preview ? '' : ' is-off'}`}>
            <div className="controls-preview-frame" ref={frameRef}>
              <div className="controls-preview-stage" ref={stageRef} />
            </div>
            <div className="preview-bar">
              <label className="preview-toggle">
                <span className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Preview"
                    checked={preview}
                    onChange={(event) => setPreview(event.target.checked)}
                  />
                  <span className="switch-track" aria-hidden="true" />
                </span>
                Preview
              </label>
              <span className="preview-image-eye-slot" />
            </div>
            <button
              type="button"
              className="btn controls-randomize"
              hidden={!canRandomize}
              onClick={randomizeSettings}
            >
              Randomize Settings
            </button>
          </aside>
          <div className="controls-tray-content" ref={contentRef}>
            {module ? <ModuleControls key={module.id} module={module} /> : null}
          </div>
        </div>
        <div className="controls-favorites frisson-controls" ref={favoritesRef} />
      </div>
    </div>
  );
}
