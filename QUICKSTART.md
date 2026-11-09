# Quick start

1. Install Node.js 22 or newer if needed.
2. Run `npm start` (or `node serve.js`) from this folder. No dependency installation is required.
3. Open **http://localhost:3010/shell/**.
4. Open the viewer, allow the popup, and choose a visualizer. Grant microphone/camera access only for the inputs you intend to use.
5. Adjust the controls and save favorites. Add modules to the playlist for timed playback.

The controls scroll above a separate favorites area, including in narrow trays. A failed save shows a recovery notice with **Retry saving**. Keep the same browser and host/port for recovery; do not clear its storage while saves are pending.

Use `node serve.js --port 8080` for a different port. The server is local to this computer. A plain static server does not support writing favorites or configuration files.

If a module cannot load, confirm its files exist and check browser errors. If audio is unavailable, check microphone permission and interact with the viewer to resume audio. Browser fullscreen may also require a click inside the viewer.

See [README.md](README.md) for project structure, controls conventions, persistence, and validation.
