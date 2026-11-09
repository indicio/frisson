/** Repeat and fade flags. Playback itself runs on the viewer window's playlist. */
export function createPlaybackFlags({ repeat = false, fade = true } = {}) {
  let repeatMode = Boolean(repeat);
  let fadeEnabled = fade !== false;
  let remote = null;
  return {
    attach(playlistApi) {
      remote = playlistApi;
      remote.setRepeatMode(repeatMode);
      remote.setFadeEnabled(fadeEnabled);
    },
    get remote() {
      return remote;
    },
    getRepeatMode() {
      return repeatMode;
    },
    setRepeatMode(value) {
      repeatMode = Boolean(value);
      remote?.setRepeatMode(repeatMode);
    },
    toggleRepeatMode() {
      this.setRepeatMode(!repeatMode);
    },
    getFadeEnabled() {
      return fadeEnabled;
    },
    setFadeEnabled(value) {
      fadeEnabled = Boolean(value);
      remote?.setFadeEnabled(fadeEnabled);
    },
    toggleFadeEnabled() {
      this.setFadeEnabled(!fadeEnabled);
    },
    isPlaying() {
      return Boolean(remote?.isPlayingPlaylist?.());
    },
    currentIndex() {
      return remote?.getCurrentIndex?.() ?? -1;
    },
    stop() {
      remote?.stop();
    },
    clear() {
      remote?.clearPlaylist?.();
    },
    setPlaylist(entries) {
      remote?.setPlaylist(entries);
    },
    play(container, onChange, getParams) {
      return remote?.play(container, onChange, getParams);
    },
    resume(container, getParams) {
      return remote?.resume(container, getParams);
    },
  };
}
