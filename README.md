# Frisson

A local studio for live visuals. It runs in the browser on your own computer: audio-reactive modules, a separate projector window, surface mapping, controls, favorites, playlists, and a logo overlay. The manifest currently includes 25 visualizers.

## VJ mode

VJ mode is the live deck. Pick a module from the grid and it plays full frame in a separate projector window. Controls, favorites, and a timed playlist sit with the module. Audio and video input switch once for the whole show, and a logo can sit over the picture.

## Projection mapping

Map mode places the same show onto shapes: rectangle, triangle, circle, ellipse, pentagon, hexagon, or Bézier. Give a shape a color, a pattern, or any module. The picture frame turns with the shape, and several shapes can share one tiled picture. The projector follows this canvas.

## Modules

Camera Shake, Datamosh Lab, Eidolon, and Gradient Map are in the project and currently kept off the dashboard.

- **Bauhaus.** Rhythmic Bauhaus grid with audio-reactive shapes, color sequences, and themes.
- **Beholder.** Floating eye swarm with depth of field, ambient drift, saccadic gaze, and an optional microphone pulse.
- **Big Deck.** 3D card deck with several layouts, audio reactivity, lighting, and texture-based card faces.
- **Big Solid.** Full-screen solid color with palette transitions and flashes.
- **Camera Shake.** Webcam picture shaken in position and rotation, with color refraction.
- **Datamosh Lab.** Webcam datamosh with glitch modes, temporal feedback, and a CRT finish.
- **Eidolon.** Gaussian-splat performer. Load a `.ply` scan, then explode and reconstruct it with deformations and audio.
- **Flow.** Particle fluid with swirling vortices and adjustable particle behavior.
- **Gradient Map.** Webcam shader that remaps luminance onto custom gradient palettes, with contrast, blend, and blur.
- **Inkdrop.** Ink in water. Particles follow a flow field and color themes.
- **Kaleidoscope.** Webcam kaleidoscope with fractal recursion, several centers of rotation, and temporal feedback.
- **Leaks and Lights.** Light leaks and particle bursts, with palettes, blend modes, and a camera overlay.
- **Liquid Marbling.** Fluid marbling shader. Drag to pull the paint. Motion can follow the audio.
- **Mandala.** Geometric wireframes that keep their steps, then respond to the live audio drivers.
- **Metaball2 Shader.** Shader metaballs with presets and finer controls.
- **Op Art.** Striped cubes and spheres with orbital motion.
- **Orbiter.** Particle emitters orbiting in 3D space.
- **Orbiting Wheels.** Wheels in an orbit or a tunnel, with color themes and a moving camera.
- **Orbs.** Emissive spheres in orbiting shell layers, with bloom, trails, palettes, and per-layer motion.
- **Photosome.** Ink drops with fluid expansion, shape variation, blend modes, and bass-triggered drops.
- **Pixelated.** Camera picture turned into particles, with audio-reactive distortion.
- **Procedural Geometry.** Concentric shapes, parallel lines, and waveforms, with width, spacing, turbulence, and layered distortion.
- **Video Playback.** Local clips in a playlist or a single loop, with cut, crossfade, and fade-to-black, plus optional RGB and glitch.
- **Webbing.** Two emitters joined by particle connections.
- **Wormhole.** 3D tunnel of stars, rings, or squares, with audio-reactive camera movement.

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
