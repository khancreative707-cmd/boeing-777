import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AircraftLab } from '../src/aircraft/lab.js';
import { AircraftMechanisms } from '../src/aircraft/simulation.js';
import { AIRCRAFT, AIRCRAFT_TOUR } from '../src/aircraft/spec.js';
import { fuselageProfile, doorOpeningAt } from '../src/aircraft/geometry.js';
import { applySpoolTransforms, applyVariableStators } from '../src/engine/mechanics.js';
const lab = new AircraftLab();
test('six flat windshield panes are mirrored, planar and mounted over real nose apertures', () => {
  lab.root.updateMatrixWorld(true);
  for (let i = 0; i < 3; i++)
    for (const suffix of ['', '.frame']) {
      const l = lab.registry.get(`aircraft.fuselage.windshield.1.${i}${suffix}`);
      const r = lab.registry.get(`aircraft.fuselage.windshield.-1.${i}${suffix}`);
      const g = l.visuals[0].mesh.geometry,
        a = g.attributes.position,
        b = r.visuals[0].mesh.geometry.attributes.position;
      assert.equal(a.count, b.count);
      for (let j = 0; j < a.count; j++) {
        assert.equal(a.getX(j), b.getX(j));
        assert.equal(a.getY(j), b.getY(j));
        assert.equal(a.getZ(j), -b.getZ(j));
        const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
        const origin = new THREE.Vector3().fromBufferAttribute(a, 0);
        if (!suffix && j < a.count / 2)
          assert.ok(
            Math.abs(new THREE.Vector3().fromBufferAttribute(a, j).sub(origin).dot(n)) < 0.00001,
          );
      }
      if (!suffix) {
        const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
        const skins = [0, 1].flatMap((q) =>
          lab.registry.get(`aircraft.fuselage.skin.0.${q}`).visuals.map((v) => v.mesh),
        );
        for (const [u, v] of [
          [14, 10],
          [5, 5],
          [23, 15],
        ]) {
          const point = new THREE.Vector3().fromBufferAttribute(a, u * 21 + v);
          const ray = new THREE.Raycaster(
            point.clone().addScaledVector(n, 0.04),
            n.clone().negate(),
            0,
            0.1,
          );
          const hits = ray.intersectObjects(skins, false);
          assert.equal(hits.length, 0, 'The skin aperture must clear each flat pane');
        }
      }
      assert.equal(l.parent, suffix ? `aircraft.fuselage.windshield.1.${i}` : 'aircraft.fuselage');
    }
});
test('passenger window glass and surrounds clear the curved shell on both sides', () => {
  lab.root.updateMatrixWorld(true);
  let count = 0;
  for (const p of lab.registry.entries.values()) {
    if (!/^aircraft\.fuselage\.window\./.test(p.id)) continue;
    const a = p.visuals[0].mesh.geometry.attributes.position;
    const world = (i) =>
      new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(p.object.matrixWorld);
    const clearance = (v) => {
      const f = fuselageProfile(v.x);
      return Math.hypot(v.y - f.y, v.z) - f.r;
    };
    for (let i = 0; i < a.count; i++) assert.ok(clearance(world(i)) > 0.001, p.id);
    const g = p.visuals[0].mesh.geometry,
      indices = g.index;
    for (let i = 0; i < (indices ? indices.count : a.count); i += 3) {
      const c = new THREE.Vector3();
      for (let j = 0; j < 3; j++) c.add(world(indices ? indices.getX(i + j) : i + j));
      assert.ok(clearance(c.divideScalar(3)) > 0.0001, p.id + ' triangle cuts the skin');
    }
    assert.ok(p.object.quaternion.equals(new THREE.Quaternion()), p.id);
    count++;
  }
  assert.ok(count > 200);
});
test('hidden instance batches stop drawing and become drawable again on reveal', () => {
  const batch = lab.registry.batches.find((b) => b.worldFrames);
  const visible = new Map(batch.ids.map((id) => [id, lab.registry.get(id).visible]));
  for (const id of batch.ids) lab.registry.setVisible(id, false);
  lab.registry.sync();
  assert.equal(batch.mesh.visible, false);
  for (const [id, on] of visible) lab.registry.setVisible(id, on);
  lab.registry.sync();
  assert.equal(
    batch.mesh.visible,
    batch.ids.some((id) => lab.registry.effectiveVisible(id)),
  );
});
test('demand-rendered reduced-motion gear sequence keeps requesting frames until complete', () => {
  const mechanism = new AircraftMechanisms();
  mechanism.requestGear(true);
  let moving = true,
    frames = 0;
  while (moving && frames++ < 20) moving = mechanism.step(1 / 60, true);
  assert.ok(frames < 20);
  assert.equal(mechanism.value('supports'), 1);
  assert.equal(mechanism.value('gear'), 1);
  assert.equal(mechanism.value('gearDoors'), 0);
});
function reset() {
  lab.state.reduced = true;
  lab.state.armed = null;
  lab.state.tourStep = null;
  lab.registry.isolation = null;
  lab.state.isolated = null;
  lab.state.engineFocus = null;
  lab.state.inspectionRoot = null;
  lab.mechanisms = new AircraftMechanisms();
  lab.assembly.reassemble();
  for (let i = 0; i < 16; i++) lab.step(1 / 60);
  for (const p of lab.registry.entries.values()) lab.registry.setVisible(p.id, true);
  lab.state.layers = { skin: true, structure: true, interior: true, systems: false };
  lab.state.cutaway = false;
  lab.simulation.setInterlock(true);
  lab.simulation.setInterlock(false);
  for (const e of Object.values(lab.simulation.engines)) {
    e.lpAngle = 0;
    e.hpAngle = 0;
    e.throttle = 0;
  }
  lab.registry.visibilityDirty = true;
  lab.registry.dirty = true;
  lab.refresh();
}
test('complete aircraft has unique identities, valid nested mounts, metadata and removal references', () => {
  assert.ok(lab.registry.entries.size > 11000);
  const ids = new Set();
  for (const p of lab.registry.entries.values()) {
    assert.ok(!ids.has(p.id));
    ids.add(p.id);
    assert.ok(p.name && p.material && p.purpose && p.relationship, p.id);
    assert.ok(
      [
        ...p.mount.position.toArray(),
        ...p.mount.quaternion.toArray(),
        ...p.mount.scale.toArray(),
      ].every(Number.isFinite),
      p.id,
    );
    if (p.parent) {
      assert.ok(lab.registry.get(p.parent), p.id);
      assert.ok(lab.registry.get(p.parent).children.includes(p.id), p.id);
    }
    for (const id of p.blockers) assert.ok(lab.registry.get(id), `${p.id}: ${id}`);
    for (const v of p.visuals)
      assert.equal(
        v.index === undefined ? v.mesh.userData.componentId : v.mesh.userData.componentIds[v.index],
        p.id,
      );
  }
  const visiting = new Set(),
    done = new Set();
  const visit = (id) => {
    if (done.has(id)) return;
    assert.ok(!visiting.has(id), id);
    visiting.add(id);
    for (const next of lab.registry.get(id).blockers) visit(next);
    visiting.delete(id);
    done.add(id);
  };
  for (const id of ids) visit(id);
});
test('public envelope, wheel and door counts and both GE90 stage architectures are represented', () => {
  assert.equal(AIRCRAFT.length, 73.86);
  assert.equal(AIRCRAFT.span, 64.8);
  assert.equal(AIRCRAFT.height, 18.5);
  const parts = [...lab.registry.entries.values()];
  assert.equal(parts.filter((p) => /^aircraft\.doors\.(left|right)\.\d+$/.test(p.id)).length, 10);
  assert.equal(
    parts.filter((p) => /^aircraft\.gear\.(left|right)\.leg\.truck\.wheel\.\d+$/.test(p.id)).length,
    12,
  );
  assert.equal(
    parts.filter((p) => /^aircraft\.gear\.nose\.leg\.truck\.wheel\.\d+$/.test(p.id)).length,
    2,
  );
  for (const side of ['left', 'right']) {
    assert.equal(
      parts.filter((p) =>
        new RegExp(`^aircraft\\.engines\\.${side}\\.fan\\.blade\\.\\d+$`).test(p.id),
      ).length,
      22,
    );
    for (const [module, count] of [
      ['booster', 4],
      ['hpc', 9],
      ['hpt', 2],
      ['lpt', 6],
    ])
      assert.equal(
        parts.filter((p) =>
          new RegExp(`^aircraft\\.engines\\.${side}\\.${module}\\.stage\\.\\d+$`).test(p.id),
        ).length,
        count,
      );
  }
  const hull = lab.registry.get('aircraft.fuselage.skin.0.0').visuals[0].mesh.geometry;
  hull.computeBoundingBox();
  assert.ok(Math.abs(hull.boundingBox.min.x + 36.93) < 1e-5);
  const tip = lab.registry.get('aircraft.wings.left.raked-tip').visuals[0].mesh.geometry;
  tip.computeBoundingBox();
  assert.ok(Math.abs(tip.boundingBox.max.z - 32.4) < 1e-5);
  const fin = lab.registry.get('aircraft.tail.fin').visuals[0].mesh.geometry;
  fin.computeBoundingBox();
  assert.ok(Math.abs(fin.boundingBox.max.y - 18.5) < 1e-5);
});
test('actual physical geometry is finite and every world-frame instance is individually addressable', () => {
  const seen = new Set();
  lab.root.updateMatrixWorld(true);
  lab.registry.sync();
  for (const p of lab.registry.entries.values())
    for (const v of p.visuals) {
      const g = v.mesh.geometry;
      if (!seen.has(g.uuid)) {
        seen.add(g.uuid);
        for (const value of g.attributes.position.array) assert.ok(Number.isFinite(value), p.id);
      }
      if (p.instance) assert.equal(v.mesh.userData.componentIds[v.index], p.id);
    }
  const p = lab.registry.get('aircraft.cabin.row.1.seat.1.cushion');
  lab.registry.isolate('aircraft.cabin.row.1.seat.1');
  lab.registry.visibilityDirty = true;
  lab.registry.sync();
  const m = new THREE.Matrix4();
  p.instance.mesh.getMatrixAt(p.instance.index, m);
  p.object.updateWorldMatrix(true, false);
  const expected = lab.root.matrixWorld.clone().invert().multiply(p.object.matrixWorld);
  for (let i = 0; i < 16; i++) assert.ok(Math.abs(expected.elements[i] - m.elements[i]) < 1e-5);
  reset();
});
test('gear retraction waits for supports and open doors, and closes only at an exact endpoint', () => {
  const model = new AircraftMechanisms();
  model.requestGear(true);
  let sawOpen = false,
    sawMoving = false;
  for (let i = 0; i < 1400; i++) {
    const before = model.value('gear');
    const supports = model.value('supports'),
      doors = model.value('gearDoors');
    model.step(1 / 60, false, true);
    if (model.value('gear') !== before) {
      assert.ok(supports > 0.999);
      assert.ok(doors > 0.999);
      sawMoving = true;
    }
    if (model.value('gearDoors') > 0.999) sawOpen = true;
    if (model.channels.gearDoors.target === 0 && model.value('gear') > 0)
      assert.equal(model.value('gear'), 1);
  }
  assert.ok(sawOpen && sawMoving);
  assert.equal(model.value('gear'), 1);
  assert.equal(model.value('gearDoors'), 0);
  model.requestGear(false);
  for (let i = 0; i < 1400; i++) model.step(1 / 60, false, true);
  assert.equal(model.value('gear'), 0);
  assert.equal(model.value('gearDoors'), 0);
  assert.equal(model.parked(), true);
});
test('gear does not move until an engine shutdown has completed', () => {
  const m = new AircraftMechanisms();
  m.requestGear(true);
  for (let i = 0; i < 500; i++) m.step(1 / 60, false, false);
  assert.equal(m.value('supports'), 1);
  assert.equal(m.value('gear'), 0);
  assert.equal(m.value('gearDoors'), 0);
});
test('left and right engines retain independent speeds and correct spool coupling', () => {
  reset();
  lab.toggleEngine('left');
  lab.setEngineThrottle('left', 0.8);
  lab.toggleEngine('right');
  lab.setEngineThrottle('right', 0.2);
  for (let i = 0; i < 1000; i++) lab.simulation.step(1 / 60);
  const left = lab.simulation.engines.left,
    right = lab.simulation.engines.right;
  assert.ok(left.n1 > 0.8 && right.n1 < 0.4);
  assert.ok(left.n2 > right.n2);
  applySpoolTransforms(lab.registry, lab.simulation);
  applyVariableStators(lab.registry, lab.simulation);
  for (const rotor of lab.registry.rotors) {
    const p = lab.registry.get(rotor.id),
      engine = lab.simulation.forComponent(p.id),
      angle = rotor.spool === 'LP' ? engine.lpAngle : engine.hpAngle;
    const expected = p.mount.quaternion
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle));
    assert.ok(p.object.quaternion.angleTo(expected) < 1e-7, p.id);
  }
  const before = [left.lpAngle, right.lpAngle, left.hpAngle, right.hpAngle];
  lab.inspectEngine('right');
  assert.equal(lab.state.engineFocus, 'right');
  lab.showAircraft();
  assert.deepEqual([left.lpAngle, right.lpAngle, left.hpAngle, right.hpAngle], before);
  lab.detach('aircraft.engines.left.fan.spinner');
  assert.equal(lab.simulation.interlocked, true);
  assert.equal(left.on, false);
  assert.equal(right.on, false);
  for (let i = 0; i < 20; i++) lab.step(1 / 60);
  assert.deepEqual([left.lpAngle, right.lpAngle, left.hpAngle, right.hpAngle], before);
  reset();
});
test('supports and parked controls protect load-bearing removal without blocking an ordinary cover', () => {
  reset();
  assert.equal(lab.detach('aircraft.gear.left'), false);
  assert.match(lab.state.message, /supports/);
  assert.equal(lab.detach('aircraft.fuselage.skin.2.0'), true);
  lab.reassemble();
  for (let i = 0; i < 16; i++) lab.step(1 / 60);
  lab.setMechanism('flaps', 1);
  for (let i = 0; i < 4; i++) lab.step(1 / 60);
  assert.equal(lab.detach('aircraft.gear.left'), false);
  assert.match(lab.state.message, /Park/);
  reset();
});
test('aircraft removal blockers remain physical when the corresponding cover is cut away', () => {
  reset();
  lab.toggleCutaway();
  const id = 'aircraft.cabin.row.1.seat.1';
  assert.equal(lab.detach(id), false);
  assert.match(lab.state.message, /Remove first/);
  const blocker = lab.registry.get(id).blockers[0];
  assert.equal(lab.detach(blocker), true);
  for (let i = 0; i < 4; i++) lab.step(1 / 60);
  assert.equal(lab.detach(id), true);
  for (let i = 0; i < 4; i++) lab.step(1 / 60);
  const p = lab.registry.get(id),
    mount = p.mount.position.clone();
  lab.select(id);
  assert.equal(lab.rotate('y', 0.5), true);
  lab.step(1 / 60);
  assert.ok(p.object.quaternion.angleTo(p.mount.quaternion) > 0.1);
  lab.reassemble();
  for (let i = 0; i < 16; i++) lab.step(1 / 60);
  assert.ok(p.object.position.equals(mount));
  assert.ok(p.object.quaternion.equals(p.mount.quaternion));
  reset();
});
test('gear and flight controls park back to exact local mounts before disassembly', () => {
  reset();
  lab.setMechanism('gear', 1);
  lab.setMechanism('flaps', 1);
  for (let i = 0; i < 8; i++) lab.step(1 / 60);
  assert.equal(lab.mechanisms.value('gear'), 1);
  lab.park();
  for (let i = 0; i < 12; i++) lab.step(1 / 60);
  assert.equal(lab.mechanisms.parked(), true);
  for (const p of lab.joints) {
    if (p.joint.channel === 'supports') continue;
    assert.ok(p.object.quaternion.equals(p.mount.quaternion), p.id);
    assert.ok(p.object.position.equals(p.mount.position), p.id);
  }
  reset();
});
test('sectional layers reveal interiors and detached parts remain visible with their identities', () => {
  reset();
  assert.equal(lab.registry.effectiveVisible('aircraft.cabin.row.1.seat.1.cushion'), false);
  lab.toggleCutaway();
  assert.equal(lab.registry.effectiveVisible('aircraft.cabin.row.1.seat.1.cushion'), true);
  assert.equal(lab.registry.effectiveVisible('aircraft.fuselage.skin.2.0'), false);
  assert.equal(lab.registry.effectiveVisible('aircraft.wings.left.skin.1.1'), false);
  lab.detach('aircraft.fuselage.skin.2.0');
  lab.step(1 / 60);
  assert.equal(lab.registry.effectiveVisible('aircraft.fuselage.skin.2.0'), true);
  reset();
});
test('fractional explosion arms supports, preserves mounts, interlocks engines and reverses exactly', () => {
  reset();
  lab.setExplosion(0.6);
  assert.ok(lab.state.armed);
  for (let i = 0; i < 8; i++) lab.step(1 / 60);
  assert.equal(lab.mechanisms.value('supports'), 1);
  assert.equal(lab.assembly.explodeAmount, 0.6);
  assert.equal(lab.toggleEngine('left'), false);
  lab.setExplosion(0.2);
  for (let i = 0; i < 3; i++) lab.step(1 / 60);
  assert.equal(lab.assembly.explodeAmount, 0.2);
  lab.reassemble();
  for (let i = 0; i < 20; i++) lab.step(1 / 60);
  for (const p of lab.registry.entries.values()) {
    if (p.id.startsWith('aircraft.supports')) continue;
    assert.ok(p.object.position.equals(p.mount.position), p.id);
    assert.ok(p.object.quaternion.equals(p.mount.quaternion), p.id);
  }
  assert.equal(lab.simulation.on, false);
  reset();
});
test('all tour chapters refer to real assemblies and return to normal aircraft navigation', () => {
  reset();
  for (let i = 0; i < AIRCRAFT_TOUR.length; i++) {
    assert.equal(lab.setTourStep(i), true);
    assert.equal(lab.state.selected, AIRCRAFT_TOUR[i].id);
    assert.ok(lab.registry.get(lab.state.selected));
  }
  lab.endTour();
  assert.equal(lab.state.tourStep, null);
  assert.equal(lab.registry.isolation, null);
  assert.equal(lab.state.engineFocus, null);
  reset();
});
test('passenger and cargo openings are real apertures and their curved leaves fit the fuselage', () => {
  assert.equal(doorOpeningAt(-15, 6.2, 3), true);
  assert.equal(doorOpeningAt(-17.2, 4.4, 2.5), true);
  assert.equal(doorOpeningAt(-10, 6.2, 3), false);
  const p = lab.registry.get('aircraft.doors.left.2.leaf');
  lab.root.updateMatrixWorld(true);
  const pos = p.visuals[0].mesh.geometry.attributes.position;
  let outer = 0;
  for (let i = 0; i < pos.count / 2; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(p.object.matrixWorld),
      f = fuselageProfile(v.x);
    const distance = Math.hypot(v.y - f.y, v.z);
    outer = Math.max(outer, Math.abs(distance - (f.r + 0.025)));
  }
  assert.ok(outer < 1e-5);
});

test('telescopic actuator endpoints stay on their fixed and moving mounts', () => {
  reset();
  lab.setMechanism('gear', 1);
  lab.setMechanism('flaps', 0.65);
  for (let i = 0; i < 10; i++) lab.step(1 / 60);
  lab.root.updateMatrixWorld(true);
  for (const link of lab.linkages) {
    const startPart = lab.registry.get(link.start.part),
      endPart = lab.registry.get(link.end.part);
    const start = new THREE.Vector3(...link.start.point).applyMatrix4(startPart.object.matrixWorld),
      end = new THREE.Vector3(...link.end.point).applyMatrix4(endPart.object.matrixWorld);
    const barrel = lab.registry.get(link.id + '.barrel'),
      piston = lab.registry.get(link.id + '.piston');
    const a = new THREE.Vector3(-0.5, 0, 0).applyMatrix4(barrel.object.matrixWorld),
      b = new THREE.Vector3(0.5, 0, 0).applyMatrix4(piston.object.matrixWorld);
    assert.ok(a.distanceTo(start) < 1e-6, link.id + ' fixed mount');
    assert.ok(b.distanceTo(end) < 1e-6, link.id + ' moving mount');
  }
  lab.park();
  for (let i = 0; i < 12; i++) lab.step(1 / 60);
  for (const link of lab.linkages)
    for (const suffix of ['barrel', 'piston', 'eye.start', 'eye.end']) {
      const p = lab.registry.get(link.id + '.' + suffix);
      assert.ok(p.object.position.equals(p.mount.position));
      assert.ok(p.object.quaternion.equals(p.mount.quaternion));
      assert.ok(p.object.scale.equals(p.mount.scale));
    }
  reset();
});

test('individual interior pieces inherit access covers and hold them open on return', () => {
  reset();
  const id = 'aircraft.cabin.row.1.seat.1.cushion',
    p = lab.registry.get(id),
    cover = p.blockers[0];
  assert.ok(cover);
  assert.equal(lab.detach(id), false);
  assert.equal(lab.detach(cover), true);
  for (let i = 0; i < 4; i++) lab.step(1 / 60);
  assert.equal(lab.detach(id), true);
  for (let i = 0; i < 4; i++) lab.step(1 / 60);
  assert.equal(lab.reattach(cover), false);
  lab.reassemble();
  for (let i = 0; i < 20; i++) lab.step(1 / 60);
  assert.equal(lab.assembly.hasMissing(), false);
  reset();
});

test('selecting cockpit assemblies supports unlit live-display materials without stopping rendering', () => {
  reset();
  const visual = lab.registry.get('aircraft.cockpit.display.2').visuals[0];
  const original = visual.baseMaterial;
  const screen = new THREE.MeshBasicMaterial({ color: '#203539' });
  visual.baseMaterial = screen;
  visual.highlight?.dispose();
  visual.highlight = null;
  try {
    lab.openInterior('Cockpit');
    assert.doesNotThrow(() => lab.registry.sync());
    assert.ok(visual.mesh.material.isMeshBasicMaterial);
    assert.notEqual(visual.mesh.material, screen);
    lab.select('aircraft.wings.left.flaperon');
    lab.registry.sync();
    assert.equal(visual.mesh.material, screen);
  } finally {
    visual.highlight?.dispose();
    visual.highlight = null;
    visual.baseMaterial = original;
    visual.mesh.material = original;
    screen.dispose();
    reset();
  }
});
