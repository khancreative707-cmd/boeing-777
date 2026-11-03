import * as THREE from 'three';

/** A telescopic actuator spanning a fixed mount and a moving attachment. */
export function poseLinkages(registry, linkages, { captureMounts = false, rest = false } = {}) {
  const axis = new THREE.Vector3(1, 0, 0);
  for (const link of linkages) {
    const parent = registry.get(link.parent);
    parent.object.updateWorldMatrix(true, false);
    const inverse = parent.object.matrixWorld.clone().invert();
    const at = (anchor) => {
      const part = registry.get(anchor.part);
      part.object.updateWorldMatrix(true, false);
      return new THREE.Vector3(...anchor.point)
        .applyMatrix4(part.object.matrixWorld)
        .applyMatrix4(inverse);
    };
    const start = at(link.start),
      end = at(link.end),
      delta = end.clone().sub(start),
      length = delta.length(),
      direction = delta.clone().normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(axis, direction);
    for (const [id, share, size] of [
      [link.id + '.barrel', 0.31, 0.62],
      [link.id + '.piston', 0.735, 0.53],
      [link.id + '.eye.start', 0, 0],
      [link.id + '.eye.end', 1, 0],
    ]) {
      const p = registry.get(id);
      if (p.detached || p.ancestorRefs.some((a) => a.detached)) continue;
      p.operatingPosition = p.operatingPosition || new THREE.Vector3();
      p.operatingScale = p.operatingScale || new THREE.Vector3();
      p.operatingQuaternion = p.operatingQuaternion || new THREE.Quaternion();
      p.operatingPosition.copy(start).addScaledVector(direction, length * share);
      p.operatingQuaternion.copy(q);
      p.operatingScale.set(size ? length * size : 1, 1, 1);
      if (rest && !captureMounts) {
        p.operatingPosition.copy(p.mount.position);
        p.operatingQuaternion.copy(p.mount.quaternion);
        p.operatingScale.copy(p.mount.scale);
      }
      p.object.position.copy(p.operatingPosition);
      p.object.quaternion.copy(p.operatingQuaternion);
      p.object.scale.copy(p.operatingScale);
      p.transformDirty = true;
      if (captureMounts) {
        p.mount.position.copy(p.object.position);
        p.mount.quaternion.copy(p.object.quaternion);
        p.mount.scale.copy(p.object.scale);
      }
    }
  }
}
