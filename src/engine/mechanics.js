import * as THREE from 'three';
const xAxis = new THREE.Vector3(1, 0, 0),
  yAxis = new THREE.Vector3(0, 1, 0),
  q = new THREE.Quaternion();
/** Shared by the viewer and tests; one angle per spool, never independent decorative spin. */
export function applySpoolTransforms(registry, simulation) {
  for (const rotor of registry.rotors) {
    const p = registry.get(rotor.id);
    const source = simulation.forComponent?.(p.id) || simulation;
    if (!p.detached)
      p.object.quaternion
        .copy(p.mount.quaternion)
        .multiply(
          q.setFromAxisAngle(xAxis, rotor.spool === 'LP' ? source.lpAngle : source.hpAngle),
        );
  }
}
export function applyVariableStators(registry, simulation) {
  for (const row of registry.variables)
    for (const id of row.ids) {
      const p = registry.get(id);
      const source = simulation.forComponent?.(id) || simulation;
      if (p.detached || registry.ancestors(id).some((a) => a.detached)) continue;
      p.object.quaternion.copy(p.mount.quaternion).multiply(q.setFromAxisAngle(yAxis, source.vsv));
      if (p.instance) {
        p.object.updateMatrix();
        const { mesh, index } = p.instance;
        mesh.setMatrixAt(index, p.object.matrix);
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
}
