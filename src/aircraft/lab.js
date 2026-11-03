import * as THREE from 'three';
import { EngineLab } from '../engine/lab.js';
import { createAircraftMaterials } from './materials.js';
import { buildAircraft } from './build-aircraft.js';
import { AircraftSimulation, AircraftMechanisms } from './simulation.js';
import { AIRCRAFT_VIEWS, AIRCRAFT_TOUR } from './spec.js';
import { poseLinkages } from './linkages.js';

export class AircraftLab extends EngineLab {
  constructor() {
    super({
      build: buildAircraft,
      materialSet: createAircraftMaterials(),
      simulation: new AircraftSimulation(),
    });
    this.kind = 'aircraft';
    this.rootId = 'aircraft';
    this.views = AIRCRAFT_VIEWS;
    this.tour = AIRCRAFT_TOUR;
    this.mechanisms = new AircraftMechanisms();
    this.looseFamilies = new Set();
    this.lastUi = 0;
    this.state = {
      ...this.state,
      selected: 'aircraft.wings.left.flaperon',
      cutaway: false,
      cameraView: 'Exterior',
      tourStep: null,
      engineFocus: null,
      inspectionRoot: null,
      mechanisms: this.mechanisms.snapshot(),
      layers: { skin: true, structure: true, interior: true, systems: false },
      message: 'One aircraft. Every modeled part has a place.',
      armed: null,
    };
    this.registry.setSelection(this.state.selected);
    this.registry.visibilityFilter = (p, frames) => this.isVisible(p, frames);
    this.refresh();
  }
  refresh(patch = {}) {
    if (this.looseFamilies) {
      this.looseFamilies.clear();
      for (const p of this.registry.entries.values())
        if (p.detached) for (const a of p.ancestorRefs) this.looseFamilies.add(a.id);
    }
    super.refresh(patch);
  }
  isVisible(p, frames = false) {
    const path = [p, ...p.ancestorRefs];
    const focused = this.registry.isolation && this.registry.isolation !== 'aircraft';
    if (path.some((a) => a.detached)) return true;
    if (frames && this.looseFamilies?.has(p.id)) return true;
    if (path.some((a) => a.displaySupport) && this.mechanisms?.value('supports') < 0.001)
      return false;
    if (path.some((a) => a.layer && this.state.layers[a.layer] === false)) return false;
    if (
      path.some((a) => a.layer === 'structure') &&
      this.state.layers.skin &&
      !this.state.cutaway &&
      !focused &&
      !this.state.exploded &&
      !['Cabin', 'Cockpit', 'Cargo'].includes(this.state.cameraView) &&
      !p.blockers.some((id) => this.registry.get(id)?.detached)
    )
      return false;
    if (
      this.state.cutaway &&
      !this.state.exploded &&
      (!this.registry.isolation ||
        this.state.tourStep !== null ||
        this.registry.isolation === `aircraft.engines.${this.state.engineFocus}` ||
        this.registry.isolation === `aircraft.engines.${this.state.engineFocus}.powerplant`) &&
      (!p.engineSide || !!this.state.engineFocus) &&
      path.some((a) => a.cutaway)
    )
      return false;
    if (
      p.engineDetail &&
      this.state.engineFocus !== p.engineSide &&
      !focused &&
      !this.state.exploded &&
      this.state.layers.skin
    )
      return false;
    const interiorView =
      this.state.cutaway ||
      focused ||
      ['Cabin', 'Cockpit', 'Cargo'].includes(this.state.cameraView) ||
      this.mechanisms?.value('doors') > 0.01 ||
      this.mechanisms?.value('cargo') > 0.01;
    if (path.some((a) => a.layer === 'interior') && !interiorView) return false;
    if (p.detail === 'fine' && !interiorView && !this.state.engineFocus) return false;
    return true;
  }
  select(id) {
    const p = this.registry.get(id);
    if (!p) return;
    if (this.state.tourStep !== null) this.endTour();
    this.registry.setSelection(id === 'aircraft' ? null : id);
    if (
      this.state.engineFocus &&
      !id.startsWith(`aircraft.engines.${this.state.engineFocus}`) &&
      !p.engineSide
    )
      this.showAircraft();
    this.emit({ selected: id, message: '' });
    if (
      (p.engineDetail || (this.state.engineFocus && p.engineSide)) &&
      this.state.engineFocus !== p.engineSide
    )
      this.inspectEngine(p.engineSide, id);
  }
  setLayer(layer, on) {
    if (!(layer in this.state.layers)) return;
    this.registry.visibilityDirty = true;
    this.registry.dirty = true;
    this.emit({ layers: { ...this.state.layers, [layer]: on } });
  }
  toggleCutaway() {
    super.toggleCutaway();
    this.registry.visibilityDirty = true;
  }
  inspectEngine(side = 'left', selected = null) {
    const id = `aircraft.engines.${side}`;
    if (!this.registry.get(id)) return;
    if (this.state.tourStep !== null) this.endTour();
    this.registry.isolation = id;
    this.registry.visibilityDirty = true;
    this.registry.dirty = true;
    const center = this.registry.get(id).object.getWorldPosition(new THREE.Vector3());
    const at = (v) => v.map((n, i) => n + center.getComponent(i));
    this.views = {
      Orbit: { position: at([-6, 4, 8]), target: at([0.4, 0, 0]) },
      Front: { position: at([-11, 0, 0]), target: at([0, 0, 0]) },
      Side: { position: at([0.3, 1, 12]), target: at([0.3, 0, 0]) },
      Rear: { position: at([12, 3, 3.4]), target: at([0.4, 0, 0]) },
      Exploded: { position: at([-9, 7, 23]), target: at([0, 2, 0]) },
    };
    this.registry.setSelection(selected || id);
    this.refresh({
      engineFocus: side,
      inspectionRoot: id,
      isolated: id,
      selected: selected || id,
      message: 'Engine inspection · aircraft and engine state remain connected.',
    });
    this.viewer?.focus(selected || id);
  }
  showAircraft() {
    if (this.state.tourStep !== null) this.endTour();
    this.views = AIRCRAFT_VIEWS;
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.registry.dirty = true;
    const layers = this.isolationLayers || this.state.layers;
    this.isolationLayers = null;
    this.refresh({ engineFocus: null, inspectionRoot: null, isolated: null, layers, message: '' });
    this.viewer?.setView('Exterior');
  }
  openInterior(name) {
    if (this.state.tourStep !== null) this.endTour();
    this.views = AIRCRAFT_VIEWS;
    const id =
      name === 'Cockpit'
        ? 'aircraft.cockpit'
        : name === 'Cargo'
          ? 'aircraft.cargo'
          : 'aircraft.cabin';
    this.registry.isolation = name === 'Cockpit' ? id : null;
    this.registry.setSelection(id);
    this.registry.visibilityDirty = true;
    this.registry.dirty = true;
    this.refresh({
      engineFocus: null,
      inspectionRoot: name === 'Cockpit' ? id : null,
      isolated: this.registry.isolation,
      selected: id,
      cutaway: true,
      layers: { ...this.state.layers, interior: true, skin: true },
      message: 'Interior inspection · orbit, pan and zoom to explore.',
    });
    this.viewer?.setView(name);
  }
  isolate(id = this.state.selected) {
    if (this.state.tourStep !== null) {
      this.endTour();
      return;
    }
    if (this.state.isolated === id) {
      this.showAircraft();
      return;
    }
    const p = this.registry.get(id);
    if (p.engineSide && this.state.engineFocus !== p.engineSide)
      this.inspectEngine(p.engineSide, id);
    this.isolationLayers = this.isolationLayers || { ...this.state.layers };
    const layers = { ...this.state.layers };
    for (const part of [p, ...p.ancestorRefs]) if (part.layer) layers[part.layer] = true;
    this.registry.isolate(id);
    this.emit({
      isolated: this.registry.isolation,
      engineFocus: p.engineSide || this.state.engineFocus,
      layers,
      message: 'Isolated selection · Escape returns to the aircraft.',
    });
    this.viewer?.focus(id);
  }
  toggleEngine(side) {
    const engine = this.simulation.engines[side];
    if (!engine) return false;
    if (this.assembly.hasMissing() || this.state.armed) {
      this.emit({ message: 'Reassemble required components before starting an engine.' });
      return false;
    }
    if (
      !engine.on &&
      (this.mechanisms.value('doors') > 0.001 ||
        this.mechanisms.value('cargo') > 0.001 ||
        this.mechanisms.channels.gearDoors.target > 0 ||
        this.mechanisms.value('gearDoors') > 0.001)
    ) {
      this.emit({ message: 'Close the doors and finish the gear sequence before engine startup.' });
      return false;
    }
    engine.on ? engine.stop() : engine.start();
    this.simulation.sync();
    this.emit({ phase: this.simulation.phase, message: '' });
    return true;
  }
  toggleRun() {
    return this.toggleEngine(this.state.engineFocus || 'left');
  }
  setEngineThrottle(side, value) {
    const engine = this.simulation.engines[side];
    if (!engine || !Number.isFinite(value)) return;
    engine.throttle = THREE.MathUtils.clamp(value, 0, 1);
    this.emit();
  }
  setThrottle(value) {
    for (const s of ['left', 'right']) this.setEngineThrottle(s, value);
    this.emit({ throttle: value });
  }
  setMechanism(key, value) {
    if (key === 'lights') {
      this.mechanisms.set(key, value);
      this.emit();
      return true;
    }
    if (this.assembly.hasMissing() || this.state.armed) {
      this.emit({ message: 'Reassemble the aircraft before operating a mechanism.' });
      return false;
    }
    if (
      (key === 'doors' || key === 'cargo') &&
      value > 0 &&
      (this.simulation.on || this.simulation.n1 > 0.03 || this.simulation.n2 > 0.03)
    ) {
      this.emit({
        message: 'Stop both engines and allow the spools to settle before opening doors.',
      });
      return false;
    }
    if (key === 'supports' && value === 0 && this.mechanisms.value('gear') > 0.001) {
      this.emit({ message: 'Extend the landing gear before releasing the supports.' });
      return false;
    }
    if (key === 'gear') {
      this.simulation.stop();
      this.mechanisms.requestGear(value > 0);
      this.emit({ message: 'Maintenance supports engage before gear movement.' });
      return true;
    }
    const ok = this.mechanisms.set(key, value);
    this.emit({ message: '' });
    return ok;
  }
  park() {
    this.simulation.stop();
    if (this.assembly.hasMissing()) {
      this.emit({ message: 'Reassemble required parts before parking the mechanisms.' });
      return false;
    }
    this.mechanisms.park();
    this.emit({
      message: 'Parking mechanisms · doors and controls return to their neutral mounts.',
    });
    return true;
  }
  operatePart(id = this.state.selected) {
    const p = this.registry.get(id);
    const op = p?.operation;
    if (!op) return false;
    if (op.startsWith('engine:')) return this.toggleEngine(op.split(':')[1]);
    const key = op === 'flaperon' ? 'flaps' : op;
    return this.setMechanism(key, this.mechanisms.value(key) > 0.1 ? 0 : 1);
  }
  detach(id = this.state.selected) {
    const p = this.registry.get(id);
    if (!p) return false;
    if (!this.mechanisms.parked()) {
      this.emit({ message: 'Park mechanisms before detaching components. Use Park aircraft.' });
      return false;
    }
    if (p.supportRequired && this.mechanisms.value('supports') < 0.999) {
      this.emit({
        message: 'Engage maintenance supports before removing a load-bearing assembly.',
      });
      return false;
    }
    if (p.kind === 'assembly') {
      const external = new Set();
      for (const child of this.registry.descendants(id))
        for (const blocker of child.blockers) {
          const part = this.registry.get(blocker);
          if (
            !this.registry.isWithin(blocker, id) &&
            part &&
            !(part.detached && part.amount > 0.995)
          )
            external.add(blocker);
        }
      if (external.size) {
        this.emit({
          message: `Remove first: ${[...external]
            .slice(0, 3)
            .map((k) => this.registry.get(k).name)
            .join(', ')}.`,
        });
        return false;
      }
    }
    if (
      id.startsWith('aircraft.supports') &&
      (this.assembly.hasMissing() || this.mechanisms.value('supports') > 0.001)
    ) {
      this.emit({
        message: 'Release the unloaded maintenance supports before removing their components.',
      });
      return false;
    }
    return super.detach(id);
  }
  setExplosion(amount) {
    if (!Number.isFinite(amount)) return false;
    if (
      [...this.registry.entries.values()].some((p) => p.detached || p.target > 0 || p.amount > 1e-5)
    ) {
      this.emit({ message: 'Reassemble detached components before changing assembly spread.' });
      return false;
    }
    if (!this.mechanisms.parked()) {
      this.emit({ message: 'Park mechanisms before changing assembly spread.' });
      return false;
    }
    if (amount > 0 && this.mechanisms.value('supports') < 0.999) {
      this.mechanisms.set('supports', 1);
      this.simulation.stop();
      this.emit({
        armed: { amount },
        message: 'Engaging maintenance supports · preparing exploded inspection.',
      });
      return true;
    }
    if (this.state.tourStep !== null) this.endTour();
    const scope = this.state.isolated || null,
      entering = !this.state.exploded;
    this.assembly.explodeScope = scope;
    this.assembly.setExplosion(amount);
    this.registry.visibilityDirty = true;
    this.refresh({
      explosion: this.assembly.explodeTarget,
      exploded: this.assembly.explodeTarget > 0 || this.assembly.explodeAmount > 0,
      armed: null,
      message: 'Assembly spread · operating demonstrations interlocked.',
    });
    if (entering && !scope) this.viewer?.setView('Exploded');
    return true;
  }
  reassemble() {
    const engineFocus = this.state.engineFocus;
    this.emit({ armed: null });
    super.reassemble();
    this.assembly.explodeScope = null;
    if (engineFocus) {
      this.registry.isolation = `aircraft.engines.${engineFocus}`;
      this.registry.visibilityDirty = true;
      this.emit({ isolated: this.registry.isolation });
    }
  }
  setTourStep(index) {
    const chapter = this.tour[index];
    this.views = AIRCRAFT_VIEWS;
    if (!chapter) return false;
    if (this.assembly.hasMissing()) {
      this.emit({ message: 'Reassemble the aircraft before starting the tour.' });
      return false;
    }
    if (this.state.tourStep === null) {
      this.tourVisibility = new Map(
        [...this.registry.entries.values()].map((p) => [p.id, p.visible]),
      );
      this.tourCutaway = this.state.cutaway;
      this.tourLayers = { ...this.state.layers };
    }
    for (const p of [
      ...this.registry.ancestors(chapter.id),
      ...this.registry.descendants(chapter.id),
    ])
      this.registry.setVisible(p.id, true);
    this.registry.isolation = chapter.id;
    this.registry.visibilityDirty = true;
    this.registry.setSelection(chapter.id === 'aircraft' ? null : chapter.id);
    this.refresh({
      tourStep: index,
      inspectionRoot: null,
      selected: chapter.id,
      isolated: chapter.id,
      cutaway: index > 0,
      engineFocus: chapter.id.includes('.engines.') ? 'left' : null,
      layers: { skin: true, structure: true, interior: true, systems: index === 7 },
      autoOrbit: false,
      message: '',
    });
    if (chapter.id === 'aircraft') this.viewer?.setView('Exterior');
    else this.viewer?.focus(chapter.id);
    return true;
  }
  endTour() {
    if (this.state.tourStep === null) return;
    for (const [id, on] of this.tourVisibility || []) this.registry.setVisible(id, on);
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.refresh({
      tourStep: null,
      isolated: null,
      engineFocus: null,
      layers: this.tourLayers,
      cutaway: this.tourCutaway,
      message: 'Explore freely · every modeled part has a place.',
    });
    this.viewer?.setView('Exterior');
  }
  step(dt) {
    const blocked = this.assembly.hasMissing();
    let mechanismMoving = false;
    if (!blocked)
      mechanismMoving = this.mechanisms.step(
        dt * this.state.speed,
        this.state.reduced,
        !this.simulation.on && this.simulation.n1 < 0.03 && this.simulation.n2 < 0.03,
      );
    const values = this.mechanisms.snapshot();
    let jointChanged = false;
    for (const p of this.joints) {
      if (p.detached || this.assembly.hasDetachedAncestor(p.id)) continue;
      let value = this.mechanisms.value(p.joint.channel);
      if (p.joint.channel.endsWith('Throttle'))
        value =
          this.simulation.engines[p.joint.channel.startsWith('left') ? 'left' : 'right'].throttle;
      if (p.lastJointValue !== value) {
        p.lastJointValue = value;
        p.transformDirty = true;
        jointChanged = true;
        this.registry.dirty = true;
      }
      p.operatingQuaternion = p.operatingQuaternion || new THREE.Quaternion();
      const angleValue =
        p.joint.channel === 'doors'
          ? value < 0.25
            ? 0
            : ((value - 0.25) / 0.75) ** 2 * (3 - 2 * ((value - 0.25) / 0.75))
          : value;
      p.operatingQuaternion
        .copy(p.mount.quaternion)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(p.joint.axis, p.joint.angle * angleValue),
        );
      if (!blocked) {
        const raw = this.mechanisms.value(p.joint.channel),
          slide = p.joint.channel === 'doors' ? Math.min(1, raw / 0.25) : raw;
        p.object.position.copy(p.mount.position).addScaledVector(p.joint.slide, slide);
        p.object.quaternion.copy(p.operatingQuaternion);
      }
    }
    if (!blocked && (jointChanged || !this.linkagesPosed)) {
      this.root.updateMatrixWorld(true);
      poseLinkages(this.registry, this.linkages, { rest: this.mechanisms.parked() });
      this.linkagesPosed = true;
    }
    const moving = super.step(dt);
    for (const p of this.joints) {
      if (p.detached || this.assembly.hasDetachedAncestor(p.id)) continue;
      const raw = this.mechanisms.value(p.joint.channel);
      const v = p.joint.channel === 'doors' ? Math.min(1, raw / 0.25) : raw;
      p.object.position.addScaledVector(p.joint.slide, v);
      if (mechanismMoving) p.transformDirty = true;
    }
    if (mechanismMoving) this.registry.dirty = true;
    const visibleKey = [values.supports > 0.001, values.doors > 0.01, values.cargo > 0.01].join(
      ':',
    );
    if (visibleKey !== this.visibleMechanismKey) {
      this.visibleMechanismKey = visibleKey;
      this.registry.visibilityDirty = true;
      this.registry.dirty = true;
    }
    if (this.state.armed && values.supports > 0.999) {
      const amount = this.state.armed.amount;
      this.emit({ armed: null });
      this.setExplosion(amount);
    }
    this.lastUi += dt;
    if (this.lastUi > 0.12 || mechanismMoving !== this.wasMechanismMoving) {
      this.lastUi = 0;
      this.wasMechanismMoving = mechanismMoving;
      this.emit({ mechanisms: values, gearPhase: this.mechanisms.gearPhase });
    }
    this.materialSet.materials.lamp.emissive.set('#ffe6ae');
    this.materialSet.materials.lamp.emissiveIntensity = this.mechanisms.value('lights') * 0.65;
    return moving || mechanismMoving;
  }
}
