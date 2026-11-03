import * as THREE from 'three';
import { mkdir, writeFile } from 'node:fs/promises';
import { AircraftLab } from '../src/aircraft/lab.js';
import { fuselageProfile } from '../src/aircraft/geometry.js';
import { AIRCRAFT } from '../src/aircraft/spec.js';

const lab = new AircraftLab(),
  checks = [];
const parts = [...lab.registry.entries.values()];
function check(name, passed, measured) {
  checks.push({ name, passed: Boolean(passed), measured });
}
function vertices(part, fn) {
  for (const visual of part.visuals) {
    const a = visual.mesh.geometry.attributes.position;
    for (let i = 0; i < a.count; i++)
      fn(new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(part.object.matrixWorld));
  }
}
lab.root.updateMatrixWorld(true);
check(
  'All component IDs, parent edges and removal references resolve',
  parts.every(
    (p) =>
      (!p.parent || lab.registry.get(p.parent)?.children.includes(p.id)) &&
      p.blockers.every((id) => lab.registry.get(id)),
  ),
  parts.length,
);
let finite = true,
  minimumX = Infinity,
  maximumX = -Infinity,
  maximumSpan = 0,
  maximumY = 0;
for (const p of parts)
  vertices(p, (v) => {
    finite &&= v.toArray().every(Number.isFinite);
    if (p.id.startsWith('aircraft.fuselage.skin.')) {
      minimumX = Math.min(minimumX, v.x);
      maximumX = Math.max(maximumX, v.x);
    }
    if (p.id.startsWith('aircraft.wings.')) maximumSpan = Math.max(maximumSpan, Math.abs(v.z));
    if (p.id.startsWith('aircraft.tail.')) maximumY = Math.max(maximumY, v.y);
  });
check('Every drawn geometry vertex has a finite world transform', finite, parts.length);
check(
  'Actual pressure-shell mesh spans the 73.86 m reference envelope',
  Math.abs(maximumX - minimumX - AIRCRAFT.length) < 1e-4,
  { minimumX, maximumX },
);
check(
  'Actual wingtip geometry reaches the 64.8 m reference span',
  Math.abs(2 * maximumSpan - AIRCRAFT.span) < 0.05,
  2 * maximumSpan,
);
check(
  'Actual fin reaches the 18.5 m reference height',
  Math.abs(maximumY - AIRCRAFT.height) < 0.05,
  maximumY,
);

let clearance = Infinity;
for (const p of parts.filter((p) => /fuselage\.(frame\.\d+\.arc|stringer)/.test(p.id)))
  vertices(p, (v) => {
    const f = fuselageProfile(v.x);
    clearance = Math.min(clearance, f.r - Math.hypot(v.y - f.y, v.z) - 0.045);
  });
check(
  'Frame and stringer mesh vertices stay inside the pressure-shell inner surface',
  clearance > 0.001,
  { minimumClearanceMetres: clearance },
);
let interiorClearance = Infinity;
for (const p of parts.filter((p) => /^aircraft\.(cabin|cockpit|cargo)\./.test(p.id)))
  vertices(p, (v) => {
    const f = fuselageProfile(v.x);
    interiorClearance = Math.min(interiorClearance, f.r - Math.hypot(v.y - f.y, v.z) - 0.045);
  });
check(
  'Parked cabin, cockpit and cargo mesh vertices fit inside the pressure shell',
  interiorClearance > 0.001,
  { minimumClearanceMetres: interiorClearance },
);
let panelFaceX = -Infinity,
  screenClearance = Infinity;
vertices(lab.registry.get('aircraft.cockpit.panel'), (v) => {
  panelFaceX = Math.max(panelFaceX, v.x);
});
for (let i = 0; i < 6; i++)
  vertices(lab.registry.get(`aircraft.cockpit.display.${i}`), (v) => {
    screenClearance = Math.min(screenClearance, v.x - panelFaceX);
  });
check(
  'All cockpit display meshes sit ahead of the actual beveled panel face',
  screenClearance > 0.01,
  screenClearance,
);

// Raycast the actual hull triangles across both passenger sides and cargo doors.
const skin = parts
  .filter((p) => p.id.startsWith('aircraft.fuselage.skin.'))
  .flatMap((p) => p.visuals.map((v) => v.mesh));
const ray = new THREE.Raycaster();
let openings = 0;
for (const z of [-1, 1])
  for (const x of [-26.1, -15, -2, 10.4, 23.7]) {
    ray.set(new THREE.Vector3(x, 7, z * 4), new THREE.Vector3(0, 0, -z));
    ray.far = 2;
    if (!ray.intersectObjects(skin, false).length) openings++;
  }
for (const x of [-17.2, 17.7]) {
  ray.set(new THREE.Vector3(x, 5, 4), new THREE.Vector3(0, 0, -1));
  ray.far = 2;
  if (!ray.intersectObjects(skin, false).length) openings++;
}
check(
  'Ten passenger and two cargo apertures pass rays through actual shell geometry',
  openings === 12,
  openings,
);

const gear = parts.filter((p) =>
  /gear\.(nose|left|right)\.leg\.truck\.wheel\.\d+\.tire$/.test(p.id),
);
const contacts = gear.map((p) => {
  let min = Infinity;
  vertices(p, (v) => {
    min = Math.min(min, v.y);
  });
  return { id: p.id, lowestY: min };
});
check(
  'Fourteen tire meshes meet the display ground within 3 cm',
  contacts.length === 14 && contacts.every((p) => Math.abs(p.lowestY) < 0.03),
  contacts,
);

let maximumEndpointError = 0;
lab.setMechanism('gear', 1);
lab.setMechanism('flaps', 0.72);
for (let frame = 0; frame < 420; frame++) {
  lab.step(1 / 60);
  if (frame % 12) continue;
  lab.root.updateMatrixWorld(true);
  for (const link of lab.linkages)
    for (const [anchor, suffix, x] of [
      [link.start, 'barrel', -0.5],
      [link.end, 'piston', 0.5],
    ]) {
      const actual = new THREE.Vector3(x, 0, 0).applyMatrix4(
        lab.registry.get(link.id + '.' + suffix).object.matrixWorld,
      );
      const expected = new THREE.Vector3(...anchor.point).applyMatrix4(
        lab.registry.get(anchor.part).object.matrixWorld,
      );
      maximumEndpointError = Math.max(maximumEndpointError, actual.distanceTo(expected));
    }
}
check(
  'Sampled moving gear/flap actuators remain attached at both endpoints',
  maximumEndpointError < 1e-6,
  maximumEndpointError,
);
lab.state.reduced = true;
lab.park();
for (let frame = 0; frame < 12; frame++) lab.step(1 / 60);
lab.state.reduced = false;
lab.setExplosion(0.65);
let maximumStep = 0,
  finiteMotion = true;
const prior = new Map(parts.map((p) => [p.id, p.object.position.clone()]));
for (let frame = 0; frame < 600; frame++) {
  if (frame === 180) lab.setExplosion(0.25);
  if (frame === 300) lab.setExplosion(0.8);
  lab.step(1 / 60);
  for (const p of parts) {
    maximumStep = Math.max(maximumStep, prior.get(p.id).distanceTo(p.object.position));
    finiteMotion &&= p.object.position.toArray().every(Number.isFinite);
    prior.get(p.id).copy(p.object.position);
  }
}
check(
  'Nested exploded paths and reversals remain finite and continuous at 60 Hz',
  finiteMotion && maximumStep < 2,
  { maximumLocalStepMetres: maximumStep },
);
lab.reassemble();
for (let frame = 0; frame < 900; frame++) lab.step(1 / 60);
const restored = parts
  .filter((p) => !p.id.startsWith('aircraft.supports'))
  .every(
    (p) =>
      p.object.position.equals(p.mount.position) &&
      p.object.quaternion.equals(p.mount.quaternion) &&
      p.object.scale.equals(p.mount.scale),
  );
check('Every assembly and physical part returns to its exact local mount', restored, parts.length);

await mkdir(new URL('../docs/aircraft/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../docs/aircraft/geometry-audit.json', import.meta.url),
  JSON.stringify(
    {
      date: new Date().toISOString(),
      model: AIRCRAFT.model,
      componentCount: parts.length,
      checks,
      limitations:
        'Reference envelope and educational geometry. This sampled mesh/transform audit is not an exhaustive triangle-collision proof or a certified maintenance sequence.',
    },
    null,
    2,
  ) + '\n',
);
await writeFile(
  new URL('../docs/aircraft/component-hierarchy.ndjson', import.meta.url),
  parts
    .map((p) =>
      JSON.stringify({
        id: p.id,
        name: p.name,
        parent: p.parent,
        kind: p.kind,
        material: p.material,
        layer: p.planeLayer || null,
        purpose: p.purpose,
        relationship: p.relationship,
        spool: p.spool,
        blockers: p.blockers,
        mount: {
          position: p.mount.position.toArray(),
          quaternion: p.mount.quaternion.toArray(),
          scale: p.mount.scale.toArray(),
        },
        removal: p.move.toArray(),
        explode: p.explode.toArray(),
      }),
    )
    .join('\n') + '\n',
);
for (const c of checks) console.log(`${c.passed ? 'PASS' : 'FAIL'} ${c.name}`);
lab.dispose();
if (checks.some((c) => !c.passed)) process.exitCode = 1;
