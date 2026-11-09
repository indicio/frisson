/**
 * Controls that build or show and hide UI in JavaScript stay in the legacy iframe,
 * inside the React tray. Every other module is hosted by the shared control kit.
 */
export const IFRAME_CONTROL_MODULES = new Set([
  'bauhaus',
  'bigdeck',
  'bigSolid',
  'flow',
  'gradientmap',
  'inkdrop',
  'leaks-and-lights',
  'mandala',
  'metaball2',
  'op-art',
  'orbiter',
  'orbs',
  'paint-swirl',
  'photosome',
  'pixelated',
  'procedural-geometry',
  'supercam',
  'video-playback',
  'webbing',
  'wheels',
  'wormhole',
]);

export function usesReactControls(moduleId) {
  return !IFRAME_CONTROL_MODULES.has(moduleId);
}
