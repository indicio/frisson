import * as GaussianSplats3D from '../../../shared/libs/gaussian-splats-3d/gaussian-splats-3d.module.js';

/**
 * Load Gaussian Splat PLY into SplatBuffer.
 * @param {ArrayBuffer} arrayBuffer
 * @param {(p: number) => void} [onProgress]
 */
export async function loadPlyBuffer(arrayBuffer, onProgress) {
  if (onProgress) onProgress(0.1);
  const splatBuffer = await GaussianSplats3D.PlyLoader.loadFromFileData(
    arrayBuffer,
    1,
    0,
    true,
    0
  );
  if (onProgress) onProgress(1);
  return splatBuffer;
}

/**
 * Extract center/color/scale data from a loaded splat mesh.
 * @param {import('../../../shared/libs/gaussian-splats-3d/gaussian-splats-3d.module.js').DropInViewer} dropIn
 */
export function extractMeshData(dropIn) {
  const mesh = dropIn.viewer?.splatMesh;
  if (!mesh) return null;
  const count = mesh.getSplatCount();
  if (count <= 0) return null;

  const centers = mesh.getFloatCenters(0, count - 1);
  const base = mesh.splatDataTextures?.baseData;
  return {
    count,
    centers,
    scales: base?.scales ? new Float32Array(base.scales) : null,
    rotations: base?.rotations ? new Float32Array(base.rotations) : null,
    colors: base?.colors ? new Uint8Array(base.colors) : null,
  };
}

export { GaussianSplats3D };
