import { EngineSimulation } from './simulation.js';
import { AssemblyController } from './assembly-controller.js';
import { buildEngine } from '../scene/build-engine.js';
import { createMaterials } from '../scene/materials.js';
import { ENGINE_TOUR } from './tour.js';

export class EngineLab {
  constructor(options = {}) {
    this.materialSet = options.materialSet || createMaterials();
    Object.assign(this, (options.build || buildEngine)(this.materialSet.materials));
    this.simulation = options.simulation || new EngineSimulation();
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
      explosion: 0,
      tourStep: null,
      autoOrbit: false,
      cameraView: 'Orbit',
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
    if (this.state.tourStep !== null) this.endTour();
    this.registry.setSelection(id);
    this.emit({ selected: id, message: '' });
  }
  toggleVisibility(id) {
    if (this.state.tourStep !== null) this.endTour();
    const p = this.registry.get(id);
    this.registry.setVisible(id, !p.visible);
    this.refresh();
  }
  isolate(id = this.state.selected) {
    if (this.state.tourStep !== null) {
      const showingTourSystem = this.registry.isolation === id;
      this.endTour();
      if (showingTourSystem) return;
    }
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
    if (this.state.tourStep !== null) this.endTour();
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
    return this.setExplosion(1);
  }
  setExplosion(amount) {
    if (!Number.isFinite(amount)) return false;
    if (
      [...this.registry.entries.values()].some((p) => p.detached || p.target > 0 || p.amount > 1e-5)
    ) {
      this.emit({
        message: 'Reassemble detached components before exploding the complete engine.',
      });
      return false;
    }
    if (this.state.tourStep !== null) this.endTour();
    const entering = !this.state.exploded;
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.assembly.setExplosion(amount);
    this.refresh({
      exploded: this.assembly.explodeTarget > 0 || this.assembly.explodeAmount > 0,
      explosion: this.assembly.explodeTarget,
      isolated: null,
      message: 'Exploded assembly · operation interlocked. Select a part to inspect it.',
      phase: this.simulation.phase,
    });
    if (this.assembly.explodeTarget === 0) this.viewer?.setView('Orbit');
    else if (entering) this.viewer?.setView('Exploded');
    return true;
  }
  reassemble() {
    if (this.state.tourStep !== null) this.endTour();
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.assembly.reassemble();
    this.refresh({
      exploded: false,
      explosion: 0,
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
  setAutoOrbit(on) {
    this.emit({ autoOrbit: !!on && !this.state.reduced });
  }
  setTourStep(index) {
    const chapter = ENGINE_TOUR[index];
    if (!chapter) return false;
    if (this.assembly.hasMissing()) {
      this.emit({ message: 'Reassemble the engine before starting the guided tour.' });
      return false;
    }
    if (this.state.tourStep === null) {
      this.tourCutaway = this.state.cutaway;
      this.tourVisibility = new Map(
        [...this.registry.entries.values()].map((p) => [p.id, p.visible]),
      );
    }
    for (const p of [
      ...this.registry.ancestors(chapter.id),
      ...this.registry.descendants(chapter.id),
    ])
      this.registry.setVisible(p.id, true);
    this.registry.isolation = chapter.id;
    this.registry.visibilityDirty = true;
    this.registry.setSelection(chapter.id);
    this.refresh({
      tourStep: index,
      cutaway: true,
      selected: chapter.id,
      isolated: chapter.id,
      autoOrbit: false,
      message: '',
    });
    this.viewer?.focus(chapter.id);
    return true;
  }
  endTour() {
    if (this.state.tourStep === null) return;
    for (const [id, visible] of this.tourVisibility || []) this.registry.setVisible(id, visible);
    this.tourVisibility = null;
    this.registry.isolation = null;
    this.registry.visibilityDirty = true;
    this.refresh({
      tourStep: null,
      cutaway: this.tourCutaway,
      isolated: null,
      message: 'Explore freely · select any component.',
    });
    this.viewer?.setView('Orbit');
  }
  step(dt) {
    const moving = this.assembly.step(dt, this.state.reduced);
    this.simulation.step(dt, this.state.reduced);
    if (this.lastMoving && !moving) {
      if (
        this.assembly.explodeAmount === 0 &&
        this.assembly.explodeTarget === 0 &&
        this.state.exploded
      )
        this.emit({ exploded: false });
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
