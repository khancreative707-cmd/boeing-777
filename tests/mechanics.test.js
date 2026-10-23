import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EngineLab } from '../src/engine/lab.js';
import { EngineSimulation } from '../src/engine/simulation.js';
import { applySpoolTransforms, applyVariableStators } from '../src/engine/mechanics.js';
import { GE90 } from '../src/engine/constants.js';
const lab = new EngineLab();
const settle = (controller) => {
  for (let i = 0; i < 1200; i++) controller.step(1 / 60);
};
const simulationFor = (seconds, s) => {
  for (let i = 0; i < seconds * 60; i++) s.step(1 / 60);
};

test('all 22 individually identified fan blades have unique circular mount angles', () => {
  const blades = lab.parts.filter((p) => /^fan\.blade\.\d+$/.test(p.id));
  assert.equal(blades.length, 22);
  const angles = blades.map((p) => lab.registry.get(p.id).mount.quaternion.toArray().join(','));
  assert.equal(new Set(angles).size, 22);
});
test('the fan geometry, including the swept/twisted section, respects the 128-inch radial envelope', () => {
  const g = lab.registry.get('fan.blade.01').visuals[0].mesh.geometry,
    a = g.attributes.position;
  let max = 0,
    min = 100;
  for (let i = 0; i < a.count; i++) {
    const r = Math.hypot(a.getY(i), a.getZ(i));
    max = Math.max(max, r);
    min = Math.min(min, r);
  }
  assert.ok(Math.abs(max - (GE90.fanRadius - 0.006)) < 1e-6);
  assert.ok(min > 0.424);
  assert.ok(max < 1.626);
});
test('the actual assembly has 4 booster, 9 HPC, 2 HPT and 6 LPT stages', () => {
  for (const [module, count] of [
    ['booster', 4],
    ['hpc', 9],
    ['hpt', 2],
    ['lpt', 6],
  ]) {
    const rows = lab.parts.filter(
      (p) => p.parent === module && p.id.startsWith(`${module}.stage.`),
    );
    assert.equal(rows.length, count);
    for (const row of rows) {
      assert.ok(lab.registry.get(`${row.id}.disk`));
      assert.ok(lab.registry.get(`${row.id}.rotor`));
      assert.ok(lab.registry.get(`${row.id}.stator`));
    }
  }
});
test('all parts have IDs, valid parents, metadata, finite local mounts and usable geometry', () => {
  const ids = new Set(lab.parts.map((p) => p.id));
  assert.equal(ids.size, lab.parts.length);
  const geometries = new Set();
  for (const p of lab.registry.entries.values()) {
    if (p.parent) assert.ok(ids.has(p.parent), p.id);
    assert.ok(p.material && p.purpose && p.relationship, p.id);
    assert.ok(p.mount.position.toArray().every(Number.isFinite), p.id);
    for (const v of p.visuals) geometries.add(v.mesh.geometry);
    if (p.instance) assert.equal(p.instance.mesh.userData.componentIds[p.instance.index], p.id);
  }
  for (const g of geometries) {
    for (const attr of ['position', 'normal']) {
      assert.ok(g.attributes[attr]);
      assert.ok(g.attributes[attr].array.every(Number.isFinite), g.uuid);
    }
  }
});
test('every registered physical visual is individually ray-pickable by ID or instance index', () => {
  for (const p of lab.registry.entries.values())
    for (const v of p.visuals) {
      assert.equal(
        v.index === undefined ? v.mesh.userData.componentId : v.mesh.userData.componentIds[v.index],
        p.id,
      );
    }
});
test('startup spins the HP system before the LP system', () => {
  const s = new EngineSimulation();
  s.start();
  s.step(0.05);
  assert.ok(s.n2 > 0);
  assert.equal(s.n1, 0);
  simulationFor(12, s);
  assert.equal(s.phase, 'Idle');
  assert.ok(s.n2 > s.n1);
});
test('the two spools accelerate independently and reach high power with coherent readouts', () => {
  const s = new EngineSimulation();
  s.start();
  simulationFor(14, s);
  const idle = s.snapshot();
  s.throttle = 1;
  simulationFor(20, s);
  assert.equal(s.phase, 'High-power demonstration');
  assert.ok(s.n1 > 0.99 && s.n2 > 0.99);
  assert.ok(s.thrust > 500 && s.thrust <= 513.9);
  assert.ok(s.temperature > idle.temperature);
  assert.ok(s.flow > 0.99);
});
test('all fan/booster/LPT rotors and LP shaft share one angle; HPC/HPT and HP shaft share another', () => {
  const s = new EngineSimulation();
  s.lpAngle = 0.73;
  s.hpAngle = 1.2;
  applySpoolTransforms(lab.registry, s);
  for (const rotor of lab.registry.rotors) {
    const p = lab.registry.get(rotor.id),
      expected = p.mount.quaternion
        .clone()
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            rotor.spool === 'LP' ? 0.73 : 1.2,
          ),
        );
    assert.ok(p.object.quaternion.angleTo(expected) < 1e-7, p.id);
  }
  assert.equal(lab.registry.rotors.filter((r) => r.spool === 'LP').length, 12);
  assert.equal(lab.registry.rotors.filter((r) => r.spool === 'HP').length, 12);
});
test('stationary stator rows never receive spool rotation; variable vanes pivot about their radial axis', () => {
  lab.assembly.step(0, true);
  const s = new EngineSimulation();
  s.lpAngle = 0.8;
  s.hpAngle = 1.4;
  s.n2 = 0.8;
  applySpoolTransforms(lab.registry, s);
  applyVariableStators(lab.registry, s);
  const row = lab.registry.get('hpc.stage.1.stator');
  assert.ok(row.object.quaternion.angleTo(row.mount.quaternion) < 1e-7);
  const variable = lab.registry.get('hpc.stage.1.vane.1'),
    fixed = lab.registry.get('hpc.stage.6.vane.1');
  assert.ok(variable.object.quaternion.angleTo(variable.mount.quaternion) > 0.05);
  assert.ok(fixed.object.quaternion.angleTo(fixed.mount.quaternion) < 1e-7);
});
test('shutdown decelerates smoothly to exactly stopped', () => {
  const s = new EngineSimulation();
  s.start();
  simulationFor(12, s);
  s.stop();
  const before = s.n1;
  s.step(0.05);
  assert.ok(s.n1 > 0 && s.n1 < before);
  simulationFor(28, s);
  assert.equal(s.n1, 0);
  assert.equal(s.n2, 0);
  assert.equal(s.phase, 'Engine stopped');
});
test('a fan blade is blocked until the spinner has fully cleared its mount', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  assert.equal(a.detach('fan.blade.01').ok, false);
  assert.equal(a.detach('fan.spinner').ok, true);
  assert.equal(a.detach('fan.blade.01').ok, false);
  settle(a);
  assert.equal(a.detach('fan.blade.01').ok, true);
  settle(a);
});
test('detachment and inspection never mutate the saved original mounting transforms', () => {
  const p = lab.registry.get('fan.blade.01'),
    original = p.mount.position.clone(),
    q = p.mount.quaternion.clone();
  assert.equal(lab.assembly.rotate(p.id, 'y', 0.7), true);
  lab.assembly.step(1 / 60);
  assert.ok(p.object.quaternion.angleTo(q) > 0.6);
  assert.ok(p.mount.position.equals(original));
  assert.ok(p.mount.quaternion.equals(q));
  assert.equal(lab.assembly.reattach(p.id).ok, true);
  settle(lab.assembly);
  assert.ok(p.object.position.equals(original));
  assert.ok(p.object.quaternion.equals(q));
  assert.equal(p.detached, false);
});
test('reassembly dependencies keep the spinner away until the blade has returned', () => {
  const a = lab.assembly;
  a.detach('fan.blade.02');
  settle(a);
  a.reassemble();
  a.step(1 / 60);
  assert.equal(lab.registry.get('fan.spinner').target, 1);
  assert.equal(lab.registry.get('fan.blade.02').target, 0);
  settle(a);
  assert.equal(a.hasMissing(), false);
});
test('operating state, shaft angles and airflow freeze immediately on detachment; restart must be explicit', () => {
  const s = lab.simulation;
  s.start();
  simulationFor(12, s);
  const angles = [s.lpAngle, s.hpAngle];
  assert.equal(lab.assembly.detach('fan.spinner').ok, true);
  s.step(0.05);
  assert.equal(s.interlocked, true);
  assert.equal(s.on, false);
  assert.deepEqual([s.lpAngle, s.hpAngle], angles);
  assert.equal(s.flow, 0);
  assert.equal(s.thrust, 0);
  assert.equal(s.start(), false);
  lab.assembly.reassemble();
  settle(lab.assembly);
  assert.equal(s.interlocked, false);
  assert.equal(s.on, false);
  assert.equal(s.n1, 0);
  assert.equal(s.start(), true);
  s.stop();
});
test('splitting a casing opens four segments radially without moving the closed annulus through the core', () => {
  const a = lab.assembly;
  assert.equal(a.detach('exterior.nacelle').ok, true);
  settle(a);
  const c = lab.registry.get('exterior.nacelle');
  assert.ok(c.object.position.equals(c.mount.position));
  for (const id of c.children) {
    const p = lab.registry.get(id);
    assert.equal(p.detached, true);
    assert.ok(p.object.position.distanceTo(p.mount.position) > 1.9);
  }
});
test('stage extraction checks both the open casing and the removed concentric shaft', () => {
  const a = lab.assembly;
  assert.deepEqual(a.blockedBy('hpc.stage.1'), ['hpc.case', 'shafts.hp']);
  assert.equal(a.detach('hpc.case').ok, true);
  settle(a);
  assert.deepEqual(a.blockedBy('hpc.stage.1'), ['shafts.hp']);
});
test('failed cover reattachment does not start closing any casing segments', () => {
  const a = lab.assembly;
  a.detach('hpc.stage.1.blade.1');
  settle(a);
  const before = lab.registry.get('hpc.case.q0').target;
  assert.equal(a.reattach('hpc.case').ok, false);
  assert.equal(lab.registry.get('hpc.case.q0').target, before);
  a.reassemble();
  settle(a);
});
test('all blockers form an acyclic, valid removal dependency graph', () => {
  const visiting = new Set(),
    done = new Set();
  function walk(id) {
    assert.ok(!visiting.has(id), `Dependency cycle ${id}`);
    if (done.has(id)) return;
    visiting.add(id);
    for (const other of lab.registry.get(id).blockers) {
      assert.ok(lab.registry.get(other), other);
      walk(other);
    }
    visiting.delete(id);
    done.add(id);
  }
  for (const p of lab.parts) walk(p.id);
});
test('explode, mid-flight reversal and reassembly preserve identities and exact mount transforms', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  const before = lab.parts.map((p) => p.id);
  a.explode(true);
  for (let i = 0; i < 20; i++) a.step(1 / 60);
  const p = lab.registry.get('fan'),
    pos = p.object.position.clone();
  a.reassemble();
  a.step(1 / 60);
  assert.ok(pos.distanceTo(p.object.position) < 0.15);
  settle(a);
  assert.equal(a.hasMissing(), false);
  assert.deepEqual(
    lab.parts.map((p) => p.id),
    before,
  );
  for (const p of lab.registry.entries.values()) {
    assert.ok(p.object.position.equals(p.mount.position), p.id);
    assert.ok(p.object.quaternion.equals(p.mount.quaternion), p.id);
  }
});
test('reduced motion uses exact destinations, without continuous rotational motion', () => {
  const a = lab.assembly;
  a.explode(true);
  a.step(1 / 60, true);
  assert.equal(a.explodeAmount, 1);
  a.reassemble();
  a.step(1 / 60, true);
  assert.equal(a.explodeAmount, 0);
  const s = new EngineSimulation();
  s.start();
  simulationFor(1, s);
  const angle = s.lpAngle;
  s.step(0.05, true);
  assert.equal(s.lpAngle, angle);
});
test('instanced part visibility and isolation affect only the selected identities', () => {
  const r = lab.registry;
  r.isolate('fan.blade.01');
  assert.equal(r.effectiveVisible('fan.blade.01.edge'), true);
  assert.equal(r.effectiveVisible('fan.blade.02'), false);
  assert.equal(r.effectiveVisible('fan.disk'), false);
  r.sync();
  assert.equal(r.get('fan.disk').object.visible, true);
  assert.ok(r.get('fan.disk').visuals.every((v) => !v.mesh.visible));
  assert.ok(r.get('fan.blade.01').visuals.every((v) => v.mesh.visible));
  r.isolate('fan.blade.01');
  r.setVisible('fan.blade.01', false);
  assert.equal(r.effectiveVisible('fan.blade.01.edge'), false);
  assert.equal(r.effectiveVisible('fan.blade.02'), true);
  r.setVisible('fan.blade.01', true);
  r.sync();
  assert.ok(r.get('fan.disk').visuals.every((v) => v.mesh.visible));
});

test('dilution-opening markers follow their liner sector and fit its tapered surface', () => {
  const r = lab.registry;
  const holes = [...r.entries.values()].filter((p) => p.kind === 'aperture');
  assert.equal(holes.length, 144);
  for (const p of holes) {
    assert.match(p.parent, /^combustor\.liner\.outer\.\d$/);
    const { x, y, z } = p.mount.position;
    assert.ok(Math.abs(Math.hypot(y, z) - (0.53 + (0.07 * (x - 0.83)) / 0.55 + 0.001)) < 1e-8);
    const normal = new THREE.Vector3(1, 0, 0).applyQuaternion(p.mount.quaternion);
    assert.ok(normal.dot(new THREE.Vector3(0, y, z).normalize()) > 0.99999);
  }
  r.setVisible('combustor.liner.outer.6', false);
  for (const p of holes.filter((p) => p.parent === 'combustor.liner.outer.6'))
    assert.equal(r.effectiveVisible(p.id), false);
  r.setVisible('combustor.liner.outer.6', true);
});

test('detaching a rotating assembly preserves its instantaneous orientation without a one-frame jump', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  lab.simulation.lpAngle = 0.91;
  applySpoolTransforms(lab.registry, lab.simulation);
  const p = lab.registry.get('fan.rotor'),
    before = p.object.quaternion.clone();
  assert.equal(a.detach(p.id).ok, true);
  a.step(0);
  assert.ok(p.object.quaternion.angleTo(before) < 1e-7);
  a.reassemble();
  settle(a);
  applySpoolTransforms(lab.registry, lab.simulation);
  assert.ok(p.object.quaternion.angleTo(before) < 1e-7);
});
test('global reassembly keeps split cover sectors open until a loose internal blade has returned', () => {
  const a = lab.assembly;
  a.detach('exterior.nacelle');
  settle(a);
  a.detach('hpc.case');
  settle(a);
  a.detach('hpc.stage.1.blade.1');
  settle(a);
  a.reassemble();
  a.step(1 / 60);
  assert.equal(lab.registry.get('hpc.case.q0').target, 1);
  assert.equal(lab.registry.get('hpc.stage.1.blade.1').target, 0);
  settle(a);
  assert.equal(a.hasMissing(), false);
});

test('inspection rotates a detached blade about its own center rather than orbiting the engine axis', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  a.detach('fan.spinner');
  settle(a);
  a.detach('fan.blade.03');
  settle(a);
  const p = lab.registry.get('fan.blade.03');
  p.object.updateWorldMatrix(true, false);
  const before = p.inspectionPivot.clone().applyMatrix4(p.object.matrixWorld);
  a.rotate(p.id, 'z', Math.PI / 2);
  a.step(1 / 60);
  p.object.updateWorldMatrix(true, false);
  const after = p.inspectionPivot.clone().applyMatrix4(p.object.matrixWorld);
  assert.ok(before.distanceTo(after) < 1e-7);
  a.reassemble();
  settle(a);
  assert.ok(p.object.position.equals(p.mount.position));
});

test('bearing races lie between stage disks and all rollers require their retaining frame and outer race to be clear', () => {
  lab.root.updateMatrixWorld(true);
  const boxes = (id) => {
    const p = lab.registry.get(id),
      g = p.visuals[0].mesh.geometry;
    g.computeBoundingBox();
    return g.boundingBox.clone().applyMatrix4(p.object.matrixWorld);
  };
  for (const [bearing, previous, next] of [
    [0, null, 'booster.stage.1.disk'],
    [1, 'hpc.stage.9.disk', 'combustor.dome'],
    [2, 'lpt.stage.6.disk', 'lpt.exhaust-cone'],
  ]) {
    const race = boxes(`shafts.bearing.${bearing}.outer`);
    if (previous) assert.ok(race.min.x > boxes(previous).max.x);
    assert.ok(race.max.x < boxes(next).min.x);
    const roller = lab.registry.get(`shafts.bearing.${bearing}.roller.0`);
    assert.ok(roller.blockers.includes(`shafts.bearing.${bearing}.outer`));
    assert.ok(roller.blockers.includes(`shafts.bearing.${bearing}.frame`));
  }
});

test('aborting startup reports shutdown until the HP starter spool is actually stopped', () => {
  const s = new EngineSimulation();
  s.start();
  s.step(0.05);
  assert.equal(s.n1, 0);
  assert.ok(s.n2 > 0);
  s.stop();
  s.step(0.02);
  assert.equal(s.phase, 'Shutdown');
  simulationFor(20, s);
  assert.equal(s.phase, 'Engine stopped');
  assert.equal(s.n2, 0);
});

test('an already-detached child stays fixed in world space when its parent is removed or inspected', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  a.detach('fan.spinner');
  settle(a);
  a.detach('fan.blade.04');
  settle(a);
  const blade = lab.registry.get('fan.blade.04');
  blade.object.updateWorldMatrix(true, false);
  const before = blade.object.matrixWorld.clone();
  assert.equal(a.detach('fan').ok, true);
  settle(a);
  blade.object.updateWorldMatrix(true, false);
  assert.ok(
    blade.object.matrixWorld.elements.every((n, i) => Math.abs(n - before.elements[i]) < 1e-7),
  );
  a.rotate('fan', 'y', 0.5);
  a.step(1 / 60);
  blade.object.updateWorldMatrix(true, false);
  assert.ok(
    blade.object.matrixWorld.elements.every((n, i) => Math.abs(n - before.elements[i]) < 1e-7),
  );
  assert.equal(a.reattach(blade.id).ok, true);
  settle(a);
  assert.ok(blade.object.position.equals(blade.mount.position));
  assert.ok(blade.object.quaternion.equals(blade.mount.quaternion));
  a.reassemble();
  settle(a);
  assert.equal(a.hasMissing(), false);
});

test('world-anchored removal preserves the frozen spool pose on the first frame', () => {
  const a = lab.assembly;
  a.reassemble();
  settle(a);
  lab.simulation.lpAngle = 0.83;
  applySpoolTransforms(lab.registry, lab.simulation);
  const p = lab.registry.get('fan.spinner');
  p.object.updateWorldMatrix(true, false);
  const before = p.object.matrixWorld.clone();
  a.detach(p.id);
  a.step(0);
  applySpoolTransforms(lab.registry, lab.simulation);
  p.object.updateWorldMatrix(true, false);
  assert.ok(p.object.matrixWorld.elements.every((n, i) => Math.abs(n - before.elements[i]) < 1e-7));
  a.reassemble();
  settle(a);
});
