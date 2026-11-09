import { useEffect, useRef, useState } from 'react';
import { fromShell } from '../shellUrl.js';
import { bindControls } from './bindControls.js';
import { parseControlsHtml } from './parseControlsHtml.js';
import { usesReactControls } from './registry.js';
import './controlsHost.css';

function notifyIframe(iframe, moduleId) {
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.postMessage({ type: 'frisson-controls-ready', moduleId }, '*');
    } catch (error) {
      console.warn('notifyControlsIframeReady:', error);
    }
  }, 120);
}

function LegacyControls({ module }) {
  const iframeRef = useRef(null);
  const src = fromShell(module.controlsPath);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return undefined;
    const onLoad = () => notifyIframe(iframe, module.id);
    iframe.addEventListener('load', onLoad);
    if (iframe.src === src && iframe.contentWindow) requestAnimationFrame(() => notifyIframe(iframe, module.id));
    return () => iframe.removeEventListener('load', onLoad);
  }, [module.id, src]);

  return <iframe ref={iframeRef} title={`${module.name} controls`} src={src} />;
}

function ReactControls({ module }) {
  const rootRef = useRef(null);
  const [markup, setMarkup] = useState(null);
  const pageUrl = fromShell(module.controlsPath);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    fetch(pageUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Controls failed to load (${response.status})`);
        return response.text();
      })
      .then((html) => {
        if (!cancelled) setMarkup(parseControlsHtml(html, pageUrl));
      })
      .catch((error) => console.error(`Failed to load controls for ${module.id}`, error));
    return () => { cancelled = true; };
  }, [module.id, pageUrl]);

  useEffect(() => {
    if (!markup || !rootRef.current) return undefined;
    return bindControls(rootRef.current, module.id);
  }, [markup, module.id]);

  if (!markup) return null;
  return (
    <>
      {markup.sheets.map((href) => <link key={href} rel="stylesheet" href={href} />)}
      <div
        ref={rootRef}
        className="frisson-controls frisson-controls-host in-tray"
        dangerouslySetInnerHTML={{ __html: markup.html }}
      />
    </>
  );
}

export function ModuleControls({ module }) {
  if (!module?.controlsPath) return null;
  return usesReactControls(module.id)
    ? <ReactControls module={module} />
    : <LegacyControls module={module} />;
}
