import { EngineSimulation } from './simulation.js';
import { AssemblyController } from './assembly-controller.js';
import { buildEngine } from '../scene/build-engine.js';
import { createMaterials } from '../scene/materials.js';

export class EngineLab {
  constructor() {
    this.materialSet = createMaterials();
    Object.assign(this, buildEngine(this.materialSet.materials));
    this.simulation = new EngineSimulation();
    this.assembly = new AssemblyController(this.registry, this.simulation);
    this.listeners = new Set();
    this.telemetryListeners = new Set();
    this.viewer = null;
    this.lastPhase = '';
    this.lastMoving = false;
    this.state = {
      selected: 'fan.blade.01',
      cutaway: true,
      airflow: false,
      isolated: null,
      exploded: false,
      phase: 'Engine stopped',
      throttle: 0,
      speed: 1,
      message: 'Select any part to explore its place in the engine.',
      version: 0,
      ready: false,
      reduced: false,
    };
    this.registry.setSelection(this.state.selected);
    this.parts = this.registry.snapshot();
  }
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.state;
  emit(patch = {}) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.listeners.forEach((f) => f());
    this.viewer?.wake();
  }
  refresh(patch = {}) {
    this.parts = this.registry.snapshot();
    this.emit(patch);
  }
  select(id) {
    if (!this.registry.get(id)) return;
    this.registry.setSelection(id);
    this.emit({ selected: id, message: '' });
  }
  toggleVisibility(id) {
    const p = this.registry.get(id);
    this.registry.setVisible(id, !p.visible);
    this.refresh();
  }
  isolate(id = this.state.selected) {
    this.registry.isolate(id);
    this.emit({
      isolated: this.registry.isolation,
      message: this.registry.isolation
        ? 'Isolated selection · press Escape to show the engine.'
        : '',
    });
    if (this.registry.isolation) this.viewer?.focus(id);
    else this.viewer?.setView('Orbit');
  }
  detach(id = this.state.selected) {
    if (this.state.exploded) {
      this.emit({ message: 'Reassemble the exploded view before removing an individual part.' });
      return false;
    }
    const result = this.assembly.detach(id);
    const names = (result.blockers || [])
      .slice(0, 3)
      .map((key) => this.registry.get(key)?.name || key)
      .join(', ');
    this.refresh({
      message: result.ok
        ? 'Operating motion is paused. The selected component is leaving its mount.'
        : `Remove first: ${names}.`,
      phase: this.simulation.phase,
    });
    return result.ok;
  }
  reattach(id = this.state.selected) {
    const result = this.assembly.reattach(id);
    this.refresh({
      message: result.ok
        ? 'Returning to the original mount.'
        : `Reattach first: ${(result.blockers || [])
            .slice(0, 3)
            .map((k) => this.registry.get(k)?.name || k)
            .join(', ')}.`,
    });
    return result.ok;
  }
  explode() {
    if (
      [...this.registry.entries.values()].some((p) => p.detached || p.target > 0 || p.amount > 1e-5)
    ) {
      this.emit({
        message: 'Reassemble detached components before exploding the complete engine.',
      });
      return false;
    }
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.assembly.explode(true);
    this.refresh({
      exploded: true,
      isolated: null,
      message: 'Exploded assembly · operation interlocked. Select a part to inspect it.',
      phase: this.simulation.phase,
    });
    this.viewer?.setView('Exploded');
  }
  reassemble() {
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.assembly.reassemble();
    this.refresh({
      exploded: false,
      isolated: null,
      message: this.assembly.hasMissing()
        ? 'Reassembling · inner components return before the casings close.'
        : 'Assembly restored · cold demonstration state.',
    });
    this.viewer?.setView('Orbit');
  }
  toggleRun() {
    if (this.simulation.interlocked) {
      this.emit({
        message: 'Engine start is interlocked. Reassemble all required components first.',
      });
      return false;
    }
    if (this.simulation.on) this.simulation.stop();
    else this.simulation.start();
    this.emit({ phase: this.simulation.phase, message: '' });
    return true;
  }
  setThrottle(value) {
    this.simulation.throttle = value;
    this.emit({ throttle: value });
  }
  setSpeed(value) {
    this.simulation.speed = value;
    this.emit({ speed: value });
  }
  toggleCutaway() {
    this.emit({ cutaway: !this.state.cutaway });
    this.registry.dirty = true;
    this.registry.visibilityDirty = true;
  }
  toggleAirflow() {
    this.emit({ airflow: !this.state.airflow });
  }
  step(dt) {
    const moving = this.assembly.step(dt, this.state.reduced);
    this.simulation.step(dt, this.state.reduced);
    if (this.lastMoving && !moving) {
      const selected = this.registry.get(this.state.selected);
      const message = this.state.exploded
        ? 'Exploded assembly · operation interlocked.'
        : selected?.detached
          ? 'Detached · rotate to inspect, or reattach to the original mount.'
          : this.assembly.hasMissing()
            ? 'Maintenance hold · required components remain detached.'
            : 'Assembly restored · cold demonstration state.';
      this.refresh({ message });
    }
    this.lastMoving = moving;
    if (this.simulation.phase !== this.lastPhase) {
      this.lastPhase = this.simulation.phase;
      this.emit({ phase: this.simulation.phase });
    }
    return moving;
  }
  rotate(axis, amount) {
    if (this.assembly.rotate(this.state.selected, axis, amount)) {
      if (this.viewer) this.viewer.renderer.shadowMap.needsUpdate = true;
      this.emit();
      return true;
    }
    return false;
  }
  exportHierarchy() {
    return this.registry.snapshot().map((p) => ({
      ...p,
      mount: {
        position: this.registry.get(p.id).mount.position.toArray(),
        quaternion: this.registry.get(p.id).mount.quaternion.toArray(),
      },
    }));
  }
  dispose() {
    this.registry.dispose();
    this.materialSet.dispose();
    this.listeners.clear();
    this.telemetryListeners.clear();
  }
}
