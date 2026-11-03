import { EngineSimulation } from '../engine/simulation.js';
import { settle, smooth } from '../../.agents/skills/anatomy/kit/gl.mjs';

export class AircraftSimulation {
  constructor() {
    this.engines = { left: new EngineSimulation(), right: new EngineSimulation() };
    this.interlocked = false;
    this.speed = 1;
    this.throttle = 0;
    this.sync();
  }
  forComponent(id) {
    return id.includes('aircraft.engines.left')
      ? this.engines.left
      : id.includes('aircraft.engines.right')
        ? this.engines.right
        : this;
  }
  sync() {
    const a = this.engines.left,
      b = this.engines.right;
    this.on = a.on || b.on;
    this.n1 = (a.n1 + b.n1) / 2;
    this.n2 = (a.n2 + b.n2) / 2;
    this.lpAngle = a.lpAngle;
    this.hpAngle = a.hpAngle;
    this.vsv = a.vsv;
    this.heat = { x: Math.max(a.heat.x, b.heat.x) };
    this.flow = Math.max(a.flow, b.flow);
    this.thrust = a.thrust + b.thrust;
    this.temperature = Math.max(a.temperature, b.temperature);
    this.phase = this.interlocked
      ? 'Maintenance hold'
      : this.on
        ? 'Engine demonstration'
        : this.n1 > 0 || this.n2 > 0
          ? 'Engine shutdown'
          : 'Aircraft secured';
  }
  start() {
    if (this.interlocked) return false;
    Object.values(this.engines).forEach((s) => s.start());
    this.sync();
    return true;
  }
  stop() {
    Object.values(this.engines).forEach((s) => s.stop());
    this.sync();
  }
  setInterlock(on) {
    this.interlocked = on;
    Object.values(this.engines).forEach((s) => s.setInterlock(on));
    this.sync();
  }
  step(dt, reduced = false) {
    for (const e of Object.values(this.engines)) {
      e.speed = this.speed;
      e.step(dt, reduced);
    }
    this.sync();
  }
  snapshot() {
    return {
      on: this.on,
      n1: this.n1 * 100,
      n2: this.n2 * 100,
      thrust: this.thrust,
      temperature: this.temperature,
      phase: this.phase,
      interlocked: this.interlocked,
      engines: { left: this.engines.left.snapshot(), right: this.engines.right.snapshot() },
    };
  }
}

export class AircraftMechanisms {
  constructor() {
    this.channels = {};
    for (const key of [
      'supports',
      'gear',
      'gearDoors',
      'flaps',
      'doors',
      'cargo',
      'spoilers',
      'roll',
      'pitch',
      'rudder',
      'bins',
      'lights',
    ])
      this.channels[key] = {
        x: key === 'lights' ? 0.65 : 0,
        v: 0,
        target: key === 'lights' ? 0.65 : 0,
      };
    this.gearRequested = 0;
    this.gearPhase = 'Gear down';
  }
  set(key, target) {
    if (!this.channels[key] || !Number.isFinite(target)) return false;
    this.channels[key].target = Math.max(
      key === 'roll' || key === 'pitch' || key === 'rudder' ? -1 : 0,
      Math.min(1, target),
    );
    return true;
  }
  requestGear(up) {
    this.gearRequested = up ? 1 : 0;
    if (up) this.set('supports', 1);
    this.gearPhase = up ? 'Engaging supports' : 'Opening gear doors';
  }
  parked() {
    return [
      'gear',
      'gearDoors',
      'flaps',
      'doors',
      'cargo',
      'spoilers',
      'roll',
      'pitch',
      'rudder',
      'bins',
    ].every(
      (k) => this.channels[k].x === 0 && this.channels[k].target === 0 && this.channels[k].v === 0,
    );
  }
  park() {
    this.requestGear(false);
    for (const k of ['flaps', 'doors', 'cargo', 'spoilers', 'roll', 'pitch', 'rudder', 'bins'])
      this.set(k, 0);
  }
  value(key) {
    if (key === 'slats') return smooth(0, 0.17, this.channels.flaps.x);
    if (key === 'flaperon') return this.channels.flaps.x * 0.72 + this.channels.roll.x * 0.25;
    if (key === 'truckTilt') return this.channels.gear.x;
    return this.channels[key]?.x || 0;
  }
  step(dt, reduced = false, enginesClear = true) {
    const c = this.channels,
      ready = (k) => Math.abs(c[k].x - c[k].target) < 0.001;
    if (c.gear.x !== this.gearRequested || c.gear.target !== this.gearRequested) {
      if (this.gearRequested && c.supports.x < 0.999) {
        this.set('supports', 1);
        this.gearPhase = 'Engaging supports';
      } else if (!enginesClear) {
        this.gearPhase = 'Waiting for engine shutdown';
      } else {
        this.set('gearDoors', 1);
        if (c.gearDoors.x > 0.999) {
          this.set('gear', this.gearRequested);
          this.gearPhase = this.gearRequested ? 'Retracting gear' : 'Extending gear';
        } else this.gearPhase = 'Opening gear doors';
      }
    } else {
      this.set('gearDoors', 0);
      this.gearPhase = ready('gearDoors')
        ? this.gearRequested
          ? 'Gear up · supported'
          : 'Gear down'
        : 'Closing gear doors';
    }
    let moving = false;
    for (const [key, channel] of Object.entries(c)) {
      if (key === 'gear' && (!enginesClear || c.gearDoors.x < 0.999)) continue;
      const previous = channel.x;
      moving =
        settle(
          channel,
          channel.target,
          Math.min(dt, 0.05),
          key === 'supports' ? 0.38 : key === 'gear' ? 0.5 : 0.26,
          reduced,
        ) || moving;
      // A reduced-motion snap still changes geometry and must schedule the
      // next step of a multi-part sequence before the demand renderer sleeps.
      moving = channel.x !== previous || moving;
    }
    return moving || c.gear.x !== this.gearRequested || c.gearDoors.x !== c.gearDoors.target;
  }
  snapshot() {
    return Object.fromEntries(Object.entries(this.channels).map(([k, c]) => [k, c.x]));
  }
}
