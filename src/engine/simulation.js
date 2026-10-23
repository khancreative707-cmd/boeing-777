import { GE90 } from './constants.js';
import { smooth, settle } from '../../.agents/skills/anatomy/kit/gl.mjs';

/** A normalized, educational two-spool model. No flight/maintenance predictions. */
export class EngineSimulation {
  constructor() {
    this.on = false;
    this.throttle = 0;
    this.speed = 1;
    this.elapsed = 0;
    this.n1 = 0;
    this.n2 = 0;
    this.lpAngle = 0;
    this.hpAngle = 0;
    this.heat = { x: 0, v: 0 };
    this.thrust = 0;
    this.temperature = 20;
    this.vsv = 0.34;
    this.interlocked = false;
    this.phase = 'Engine stopped';
    this.flow = 0;
  }
  start() {
    if (this.interlocked) return false;
    this.on = true;
    this.elapsed = 0;
    this.phase = 'Startup';
    return true;
  }
  stop() {
    this.on = false;
    this.phase = this.n1 > 0 || this.n2 > 0 ? 'Shutdown' : 'Engine stopped';
  }
  setInterlock(value) {
    if (value && !this.interlocked) {
      this.on = false;
      this.phase = 'Maintenance hold';
    }
    if (!value && this.interlocked) {
      this.n1 = 0;
      this.n2 = 0;
      this.heat = { x: 0, v: 0 };
      this.thrust = 0;
      this.temperature = 20;
      this.phase = 'Engine stopped';
    }
    this.interlocked = value;
  }
  step(dt, reduced = false) {
    if (this.interlocked) {
      this.flow = 0;
      this.thrust = 0;
      return;
    }
    dt = Math.min(Math.max(dt, 0), 0.05) * this.speed;
    this.elapsed += dt;
    const t = Math.min(1, Math.max(0, this.throttle));
    const n2Target = this.on ? 0.62 + 0.38 * t : 0;
    const lit = this.on && this.n2 > 0.18;
    const n1Target = lit ? 0.22 + 0.78 * t : 0;
    this.n2 += (n2Target - this.n2) * (1 - Math.exp(-dt / (this.on ? 1.5 : 2.2)));
    this.n1 += (n1Target - this.n1) * (1 - Math.exp(-dt / (this.on ? 2.1 : 3.0)));
    if (!this.on && this.n1 < 0.001 && this.n2 < 0.001) this.n1 = this.n2 = 0;
    this.vsv += (0.34 * (1 - this.n2) - this.vsv) * (1 - Math.exp(-dt / 0.5));
    // Demonstration angular rates preserve exact shaft coupling, not actual engine rpm.
    if (!reduced) {
      this.lpAngle = (this.lpAngle + this.n1 * 4.2 * dt) % (Math.PI * 2);
      this.hpAngle = (this.hpAngle + this.n2 * 7.1 * dt) % (Math.PI * 2);
    }
    settle(this.heat, lit ? smooth(0.16, 0.65, this.n2) * (0.5 + 0.5 * t) : 0, dt, 0.7, false);
    this.temperature = 20 + 760 * this.heat.x;
    this.thrust =
      GE90.referenceThrustKN * this.n1 ** 2 * (this.on ? smooth(0.18, 0.45, this.n2) : 0.12);
    this.flow = Math.max(this.n1, this.n2 * 0.22);
    this.phase = !this.on
      ? this.n1 > 0 || this.n2 > 0
        ? 'Shutdown'
        : 'Engine stopped'
      : this.elapsed < 7 && this.n2 < n2Target * 0.98
        ? 'Startup'
        : Math.abs(this.n1 - n1Target) > 0.025
          ? n1Target > this.n1
            ? 'Increasing power'
            : 'Reducing power'
          : t > 0.85
            ? 'High-power demonstration'
            : t < 0.025
              ? 'Idle'
              : 'Power demonstration';
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
      lpAngle: this.lpAngle,
      hpAngle: this.hpAngle,
      heat: this.heat.x,
      flow: this.flow,
    };
  }
}
