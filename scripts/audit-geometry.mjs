import * as THREE from 'three';
import { EngineLab } from '../src/engine/lab.js';
import { GE90 } from '../src/engine/constants.js';
import { writeFile } from 'node:fs/promises';
const lab = new EngineLab(),
  checks = [],
  problems = [];
function requireCheck(name, passed, measured) {
  checks.push({ name, passed, measured });
  if (!passed) problems.push(name);
}
function extent(id) {
  const p = lab.registry.get(id),
    g = p.visuals[0].mesh.geometry,
    positions = g.attributes.position;
  let minR = Infinity,
    maxR = 0,
    minX = Infinity,
    maxX = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const r = Math.hypot(positions.getY(i), positions.getZ(i));
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    minX = Math.min(minX, positions.getX(i));
    maxX = Math.max(maxX, positions.getX(i));
  }
  return { minR, maxR, minX, maxX };
}
const fan = extent('fan.blade.01');
requireCheck(
  'Composite fan and leading edge fit the 128-inch radial envelope',
  Math.abs(fan.maxR + 0.006 - GE90.fanRadius) < 1e-5,
  fan.maxR + 0.006,
);
requireCheck(
  'Fan tip clears the inner containment case',
  1.69 - 0.033 - GE90.fanRadius > 0.02,
  1.69 - 0.033 - GE90.fanRadius,
);
requireCheck(
  'Fan fits through the inlet during axial module extraction',
  1.72 - 0.075 - GE90.fanRadius > 0.015,
  1.72 - 0.075 - GE90.fanRadius,
);
for (const module of ['booster', 'hpc', 'hpt', 'lpt']) {
  const rows = lab.parts.filter((p) => p.parent === module && p.id.startsWith(`${module}.stage.`));
  for (const row of rows) {
    const disk = extent(`${row.id}.disk`),
      rotor = extent(`${row.id}.blade.1`),
      stator = extent(`${row.id}.vane.1`),
      shaft = module === 'hpc' || module === 'hpt' ? 0.19 : 0.115;
    requireCheck(
      `${row.id}: disk bore clears its shaft`,
      disk.minR - shaft > 0.01,
      disk.minR - shaft,
    );
    requireCheck(
      `${row.id}: stator inner span clears rotor hub`,
      stator.minR - disk.maxR > 0.01,
      stator.minR - disk.maxR,
    );
    requireCheck(
      `${row.id}: full rotor airfoil stays inside the intended annulus`,
      rotor.minR >= disk.maxR - 1e-6,
      rotor.minR - disk.maxR,
    );
  }
}
// Audit actual transforms and path envelopes, not substituted bounds.
const ids = [...lab.registry.entries.keys()],
  original = new Map(ids.map((id) => [id, lab.registry.get(id).mount.position.toArray()]));
lab.assembly.explode(true);
let maxStep = 0,
  prior = new Map();
for (let frame = 0; frame < 320; frame++) {
  if (frame === 37 || frame === 115) lab.assembly.explode(false);
  if (frame === 65 || frame === 143) lab.assembly.explode(true);
  lab.assembly.step(1 / 60);
  for (const p of lab.registry.entries.values()) {
    const before = prior.get(p.id);
    if (before) maxStep = Math.max(maxStep, before.distanceTo(p.object.position));
    if (!p.object.position.toArray().every(Number.isFinite))
      problems.push(`Nonfinite path ${p.id}`);
    prior.set(p.id, p.object.position.clone());
  }
}
requireCheck('Full explode and four mid-flight reversals stay continuous', maxStep < 0.75, maxStep);
lab.assembly.reassemble();
for (let i = 0; i < 800; i++) lab.assembly.step(1 / 60);
requireCheck(
  'Every component returns to its exact original local mount',
  ids.every((id) =>
    lab.registry.get(id).object.position.equals(new THREE.Vector3(...original.get(id))),
  ),
  ids.length,
);
requireCheck(
  'All component identities survive every transition',
  ids.length === lab.registry.entries.size,
  ids.length,
);
const report = {
  checks,
  problems,
  scope:
    'Actual rendered mesh radial envelopes, disk/shaft and rotor/stator mounting clearances, finite/continuous transform paths and exact restoration. This is not an exhaustive triangle-intersection proof of every arbitrary detached-part orientation. Hardware contacts and root attachments are illustrative.',
  result: problems.length ? 'failed' : 'passed',
};
await writeFile(
  new URL('../docs/geometry-audit.json', import.meta.url),
  JSON.stringify(report, null, 2) + '\n',
);
for (const c of checks)
  console.log(
    `${c.passed ? 'PASS' : 'FAIL'} ${c.name}: ${typeof c.measured === 'number' ? c.measured.toFixed(6) : c.measured}`,
  );
console.log(`${report.result}: ${checks.length} checks; ${problems.length} problems`);
process.exitCode = problems.length ? 1 : 0;
