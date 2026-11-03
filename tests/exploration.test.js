import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EngineLab } from '../src/engine/lab.js';
import { ENGINE_TOUR } from '../src/engine/tour.js';
import { cameraFlightPosition } from '../src/scene/camera-motion.js';

test('tour selects real assemblies and restores user visibility on manual takeover', () => {
  const lab = new EngineLab();
  lab.state.cutaway = false;
  lab.registry.setVisible('fan', false);
  for (let step = 0; step < ENGINE_TOUR.length; step++) {
    assert.equal(lab.setTourStep(step), true);
    assert.equal(lab.state.selected, ENGINE_TOUR[step].id);
    assert.equal(lab.state.cutaway, true);
    assert.equal(lab.registry.isolation, ENGINE_TOUR[step].id);
    assert.equal(lab.registry.effectiveVisible(ENGINE_TOUR[step].id), true);
  }
  lab.select('fan.blade.07');
  assert.equal(lab.state.tourStep, null);
  assert.equal(lab.registry.isolation, null);
  assert.equal(lab.registry.get('fan').visible, false);
  assert.equal(lab.state.selected, 'fan.blade.07');
  assert.equal(lab.state.cutaway, false);
  lab.setTourStep(0);
  lab.isolate('fan');
  assert.equal(lab.state.tourStep, null);
  assert.equal(lab.registry.isolation, null);
  lab.dispose();
});

test('fractional explosion interlocks operation, reverses continuously, and restores every mount', () => {
  const lab = new EngineLab();
  lab.toggleRun();
  assert.equal(lab.setExplosion(0.62), true);
  assert.equal(lab.simulation.interlocked, true);
  assert.equal(lab.toggleRun(), false);
  for (let i = 0; i < 35; i++) lab.step(1 / 60);
  const before = lab.assembly.explodeAmount;
  lab.setExplosion(0.24);
  assert.equal(lab.assembly.explodeAmount, before);
  lab.step(1 / 60);
  assert.ok(Math.abs(lab.assembly.explodeAmount - before) < 0.03);
  for (let i = 0; i < 200; i++) lab.step(1 / 60);
  assert.equal(lab.assembly.explodeAmount, 0.24);
  assert.equal(lab.setTourStep(0), false);
  lab.setExplosion(0);
  for (let i = 0; i < 200; i++) lab.step(1 / 60);
  assert.equal(lab.state.exploded, false);
  assert.equal(lab.simulation.interlocked, false);
  assert.equal(lab.simulation.on, false);
  for (const p of lab.registry.entries.values()) {
    assert.ok(p.object.position.equals(p.mount.position), p.id);
    assert.ok(p.object.quaternion.equals(p.mount.quaternion), p.id);
  }
  lab.dispose();
});

test('spread rejects invalid input and detached parts retain removal ownership', () => {
  const lab = new EngineLab();
  assert.equal(lab.setExplosion(NaN), false);
  assert.equal(lab.assembly.explodeTarget, 0);
  lab.detach('fan.spinner');
  assert.equal(lab.setExplosion(0.5), false);
  assert.equal(lab.setTourStep(0), false);
  assert.equal(lab.registry.get('fan.spinner').target, 1);
  lab.dispose();
});

test('opposite camera presets keep their distance instead of crossing through the target', () => {
  const flight = {
    from: new THREE.Vector3(-10, 2, 0),
    to: new THREE.Vector3(12, 2, 0),
    startTarget: new THREE.Vector3(0, 2, 0),
    endTarget: new THREE.Vector3(0, 2, 0),
  };
  for (let i = 0; i <= 100; i++) {
    const position = cameraFlightPosition(flight, i / 100);
    assert.ok(position.distanceTo(flight.startTarget) >= 9.999);
    assert.ok(position.toArray().every(Number.isFinite));
  }
  assert.ok(cameraFlightPosition(flight, 0).distanceTo(flight.from) < 1e-9);
  assert.ok(cameraFlightPosition(flight, 1).distanceTo(flight.to) < 1e-9);
});
