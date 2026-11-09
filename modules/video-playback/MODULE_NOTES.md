# Video Playback module — developer notes

## Asset discovery

Browsers cannot read arbitrary folders on disk. This project uses **`/media/video/manifest.json`** (file: `media/video/manifest.json` at repo root) as a **registry** of clips. Add each `.mp4` / `.webm` (and optional poster) to the `videos` array. The dev server (`node serve.js`) serves `media/` as static files.

## Posters

Optional `poster` in the manifest; otherwise the UI tries **`basename.jpg`** next to the video (e.g. `clip.mp4` → `clip.jpg`). If the image 404s, the control card shows a neutral placeholder.

## Persistence

- **Session / last state:** `localStorage` key `video-playback-module-state` via `shared/moduleLocalState.js` (playlist order, modes, transitions, effects).
- **Named presets:** same **Favorites** pattern as other modules (`video-playback-favorites` in localStorage + optional `/api/favorites/video-playback` when using `serve.js`).

Master playlist in the shell stores **favorite names** per row; choosing a favorite replays stored params through `PARAM_CHANGE`, matching other modules.

## Playback tradeoffs

- **Crossfade** uses two `<video>` elements and alpha-blends frames on a canvas. Decoding two streams can be heavy at 4K; prefer 1080p or lower for smooth output.
- **Preload:** the inactive element loads the next manifest entry; browser caching helps repeat clips.
- **Autoplay:** videos are **muted** (`muted=true`) to satisfy typical autoplay policies; if play still fails, a tap overlay appears.
- **True gapless** video is not guaranteed across separate files; crossfade masks most gaps.

## Extending effects

Add modes in `effects.js` (`drawVideoEffect`) and wire selectors in `controls.html` / `controls.js`. Keep hot paths at reduced resolution if using `getImageData` (see RGB mode).
