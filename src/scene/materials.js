import * as THREE from 'three';
export const COLORS = {
  paper: '#f5f4f0',
  titanium: '#b5b9b6',
  steel: '#8e9798',
  graphite: '#333d40',
  composite: '#272f32',
  nickel: '#9d9584',
  ceramic: '#c5bdab',
  accent: '#bf6538',
  blue: '#4c8ca0',
  hot: '#e89844',
};
export function createMaterials() {
  const m = (color, metalness = 0.75, roughness = 0.32) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
  const materials = {
    titanium: m(COLORS.titanium, 0.85, 0.28),
    steel: m(COLORS.steel, 0.8, 0.29),
    graphite: m(COLORS.graphite, 0.62, 0.38),
    composite: m(COLORS.composite, 0.36, 0.36),
    nickel: m(COLORS.nickel, 0.8, 0.32),
    ceramic: m(COLORS.ceramic, 0.28, 0.5),
    aluminium: m('#a6adaa', 0.92, 0.24),
    rubber: m('#272d2b', 0.04, 0.72),
    copper: m('#ac7856', 0.8, 0.36),
    stand: m('#737b75', 0.6, 0.4),
  };
  // Subtle anisotropic-like micrograin. UVs track the fan's span and shell meridians.
  const data = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4,
        v = 126 + Math.round(5 * Math.sin(x * 1.7 + y * 0.1) + 3 * Math.sin(x * 4.3));
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  const grain = new THREE.DataTexture(data, 64, 64, THREE.RGBAFormat);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(3, 12);
  grain.needsUpdate = true;
  for (const name of ['titanium', 'steel', 'aluminium', 'nickel']) {
    materials[name].bumpMap = grain;
    materials[name].bumpScale = 0.0015;
  }
  return {
    materials,
    dispose() {
      Object.values(materials).forEach((m) => m.dispose());
      grain.dispose();
    },
  };
}
