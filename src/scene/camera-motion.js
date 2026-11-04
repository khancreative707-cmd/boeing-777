import * as THREE from 'three';

export function inspectionDistance(size, fov, aspect) {
  const vertical = THREE.MathUtils.degToRad(fov / 2);
  const horizontal = Math.atan(Math.tan(vertical) * aspect);
  return Math.max(0.8, size / (2 * Math.sin(Math.min(vertical, horizontal))) / 0.72);
}

// Travel around the inspection target instead of cutting through the engine.
export function cameraFlightPosition(flight, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const u = t * t * t * (t * (t * 6 - 15) + 10);
  const start = flight.from.clone().sub(flight.startTarget);
  const end = flight.to.clone().sub(flight.endTarget);
  const radius = THREE.MathUtils.lerp(start.length(), end.length(), u);
  const turn = new THREE.Quaternion().setFromUnitVectors(start.normalize(), end.normalize());
  const rotation = new THREE.Quaternion().slerp(turn, u);
  return start
    .applyQuaternion(rotation)
    .multiplyScalar(radius)
    .add(flight.startTarget.clone().lerp(flight.endTarget, u));
}
