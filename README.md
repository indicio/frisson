# Frisson

A local studio for live visuals. It runs in the browser on your own computer: audio-reactive modules, a separate projector window, surface mapping, controls, favorites, playlists, and a logo overlay. The manifest currently includes 25 visualizers.

## Start

Use Node.js 22 or newer. No package installation is required.

```sh
npm start
```

Open **http://localhost:3010/shell/**. You can also run `node serve.js --port 8080` to use a different port.

The included server is required for portable favorites, playlists, image presets, and module state. A generic static server cannot write the JSON files. The server binds to loopback only; use the same origin for the dashboard, controls, and viewer. Direct `file://` use is unsupported.

1. Open the viewer from the dashboard and allow its popup.
2. Allow microphone access if you want audio-reactive output. Camera modules also require camera access.
3. Choose a module and use its controls tray. Favorites save settings for reuse.
4. Add modules and durations to the playlist. Pause/resume retains the current module and remaining duration.
5. Use the viewer's fullscreen action or its keyboard shortcuts for projection.

## Controls

Every module uses the same responsive controls surface: one column in a narrow tray, two where supported at 720px and above. The settings scroll independently of the favorites area. Labels, focus indicators, sliders, form fields, and favorite actions share one style.

`shared/controls.css` owns the controls layout and appearance. `shared/controlsUI.js` associates labels with existing and dynamically generated fields. Preserve parameter IDs and module-specific value formatting when editing a module. Keep local CSS for specialized widgets such as palettes or video thumbnails.

## Saved data

- `data/favorites/<module>.json`: named favorites
- `data/shell/config.json`: playlists and dashboard preferences
- `data/image-layer/image-layer.json`: image presets
- `data/module-state/<module>.json`: remembered module state

Successful saves replace JSON files atomically. Failed saves display a retry notice and retain a recovery copy in the same browser when storage permits. Return to the same host and port to recover it. A quota failure is displayed explicitly; keep the window open in that case. Do not clear browser storage while changes are pending. Project files remain the normal source of truth; unsaved recovery copies take precedence until retried.

Back up the whole project folder, including `data/` and local media. `media/video/fire.mov` is kept on disk only, because it is larger than GitHub’s 100 MB file limit. The video manifest still lists it.

## Structure

- `shell/`: dashboard, output viewer, loader, playlist scheduler, image overlay
- `modules/`: visualizers and their controls
- `shared/`: UI, persistence, palettes, and bundled rendering libraries
- `media/video/manifest.json`: local video library
- `serve.js`: local server and JSON API
- `tests/`: regression checks

The viewer owns playback and audio. Manual selection and playlist transitions use its shared loader queue. Each module exposes `window.moduleAPI` with `initModule`, `start`, `stop`, and `destroy` methods. `destroy` must release rendering, camera, listener, and animation resources. Controls communicate using `BroadcastChannel` and iframe messages.

To add a module, create its output page and controls, expose the module API, use the shared controls styles, and add its paths and preview to `shell/modules.json`.

## Validation

```sh
npm test
```

Tests cover local-server boundaries and persistence, pause/resume, interruption during loading, rapid transitions, failed playlists, and save recovery. Microphone/camera access, fullscreen, GPU output, and long performance sessions also require browser checks on the target machine.

Rendering libraries are bundled locally. Dashboard icons currently load from a pinned Lucide CDN script; an internet connection is needed for those icons. Core visualizers do not rely on that icon script.
