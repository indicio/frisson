# Video assets (Video Playback module)

## Discovery

The **Video Playback** module loads `manifest.json` from this folder (served as `/media/video/manifest.json`). There is no directory scan in the browser; each clip must be listed in the manifest.

## Adding videos

1. Copy `.mp4` and/or `.webm` files into this directory (or a subfolder; then set `file` to the relative path from `media/video/`).
2. Edit `manifest.json` and add an object to the `videos` array:

```json
{
  "id": "my-clip",
  "file": "my-clip.mp4",
  "poster": "my-clip.jpg"
}
```

- **id**: stable string used in saved playlists (required).
- **file**: path relative to `media/video/` (required).
- **poster**: optional. If omitted, the player tries `same-basename.jpg` then `.png`.

## Posters

Place `my-clip.jpg` or `my-clip.png` next to `my-clip.mp4` for thumbnails in the control panel.

## Persistence

Module settings and playlist order are stored in `localStorage` (and in **Favorites** when you save a named preset). No server write is required beyond serving static files.
