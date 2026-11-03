import * as THREE from 'three';
import { createMaterials } from '../scene/materials.js';
export function createAircraftMaterials() {
  const base = createMaterials();
  const make = (color, metalness, roughness) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
  Object.assign(base.materials, {
    paint: make('#d3d8d4', 0.12, 0.38),
    skinInner: make('#aeb6ae', 0.55, 0.42),
    glazing: make('#263a40', 0.65, 0.18),
    windowRim: make('#a8afaa', 0.6, 0.34),
    upholstery: make('#525b59', 0.05, 0.86),
    cabinCream: make('#c8c4b4', 0.05, 0.7),
    carpet: make('#77796c', 0.03, 0.95),
    screen: make('#1f3336', 0.35, 0.32),
    amber: make('#a77f49', 0.25, 0.54),
    insulation: make('#aaa58e', 0.05, 0.84),
    lamp: make('#f3e5be', 0.05, 0.5),
  });
  const disposeBase = base.dispose;
  return {
    materials: base.materials,
    dispose() {
      disposeBase();
    },
  };
}
