import * as THREE from 'three';
import { smooth, settle } from '../../.agents/skills/anatomy/kit/gl.mjs';

/** Reversible, absolute-from-mount transforms; ancestors carry all descendants. */
export class AssemblyController {
  constructor(registry, simulation) {
    this.registry = registry;
    this.simulation = simulation;
    this.exploded = false;
    this.explodeAmount = 0;
    this.explodeTarget = 0;
    this.explodeMotion = { x: 0, v: 0 };
    this.clock = 0;
    this.returningAll = false;
    this.dependents = new Map();
    this.spoolById = new Map(registry.rotors.map((r) => [r.id, r.spool]));
    for (const p of registry.entries.values())
      for (const id of p.blockers) {
        if (!this.dependents.has(id)) this.dependents.set(id, []);
        this.dependents.get(id).push(p.id);
      }
  }
  blockedBy(id) {
    const p = this.registry.get(id);
    if (!p) return ['Unknown component'];
    if (p.kind === 'root') return ['Select an individual assembly or component'];
    const loose = this.registry.ancestors(id).filter((a) => a.detached && a.amount < 0.995);
    if (loose.length) return loose.map((a) => a.id);
    // A clear cutaway is a visual aid, not physical removal: blockers still apply.
    return p.blockers.filter((key) => {
      const b = this.registry.get(key);
      return b && !(b.detached && b.amount > 0.995);
    });
  }
  detach(id) {
    const p = this.registry.get(id),
      blockers = this.blockedBy(id);
    if (!p || blockers.length) return { ok: false, blockers };
    this.returningAll = false;
    this.registry.visibilityDirty = true;
    p.inspectionPivot = this.registry.inspectionPivot(id);
    p.object.parent.updateWorldMatrix(true, false);
    p.detachParentWorld = p.object.parent.matrixWorld.clone();
    p.detachedQuaternion = p.object.quaternion.clone();
    p.detached = true;
    p.target = 1;
    if (p.splitCasing)
      for (const id of p.children) {
        const child = this.registry.get(id);
        if (child.kind === 'casing') {
          child.inspectionPivot = this.registry.inspectionPivot(child.id);
          child.detachedQuaternion = child.object.quaternion.clone();
          child.object.parent.updateWorldMatrix(true, false);
          child.detachParentWorld = child.object.parent.matrixWorld.clone();
          child.detached = true;
          child.target = 1;
        }
      }
    this.simulation.setInterlock(this.hasMissing());
    this.registry.dirty = true;
    return { ok: true, blockers: [] };
  }
  reattach(id) {
    const p = this.registry.get(id);
    if (!p) return { ok: false };
    // An outer cover cannot close on a child which is still away from its mount.
    const loose = this.registry
      .descendants(id, false)
      .filter((q) => (q.target > 0 || q.amount > 1e-5) && !(p.splitCasing && q.kind === 'casing'));
    if (loose.length) return { ok: false, blockers: loose.map((q) => q.id) };
    const behind = [...this.registry.entries.values()].filter(
      (q) => q.id !== id && q.blockers.includes(id) && (q.target > 0 || q.amount > 1e-5),
    );
    if (behind.length) return { ok: false, blockers: behind.map((q) => q.id) };
    if (p.splitCasing)
      for (const id of p.children) {
        const child = this.registry.get(id);
        if (child.kind === 'casing') child.target = 0;
      }
    p.target = 0;
    this.registry.dirty = true;
    return { ok: true };
  }
  explode(on) {
    this.setExplosion(on ? 1 : 0);
  }
  setExplosion(amount) {
    if (!Number.isFinite(amount)) return false;
    this.explodeTarget = Math.max(0, Math.min(1, amount));
    this.exploded = this.explodeTarget > 0;
    this.returningAll = false;
    this.simulation.setInterlock(this.hasMissing());
    this.registry.dirty = true;
    return true;
  }
  reassemble() {
    this.exploded = false;
    this.explodeTarget = 0;
    this.returningAll = true;
    this.registry.dirty = true;
  }
  hasMissing() {
    return (
      this.explodeAmount > 1e-5 ||
      this.explodeTarget > 0 ||
      [...this.registry.entries.values()].some(
        (p) => p.required && (p.detached || p.target > 0 || p.amount > 1e-5),
      )
    );
  }
  hasDetachedAncestor(id) {
    return this.registry.ancestors(id).some((p) => p.detached);
  }
  rotate(id, axis, angle) {
    const p = this.registry.get(id);
    if (!p?.detached || p.amount < 0.995) return false;
    const v =
      axis === 'x'
        ? new THREE.Vector3(1, 0, 0)
        : axis === 'y'
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    p.inspect.premultiply(new THREE.Quaternion().setFromAxisAngle(v, angle));
    this.registry.dirty = true;
    return true;
  }
  step(dt, reduced = false) {
    this.clock += dt;
    let moving = false;
    if (this.returningAll) {
      for (const p of this.registry.entries.values()) {
        if (!p.detached && !p.amount && !p.target) continue;
        if (
          p.kind === 'casing' &&
          this.registry.get(p.parent)?.splitCasing &&
          this.registry.get(p.parent).target > 0
        )
          continue;
        const blockers = (this.dependents.get(p.id) || []).filter((id) => {
          const q = this.registry.get(id);
          return q.amount > 1e-5 || q.target > 0;
        });
        const looseChildren = p.children.some((id) => {
          const q = this.registry.get(id);
          return q.amount > 1e-5 || q.target > 0;
        });
        if (!blockers.length && (!looseChildren || p.splitCasing)) {
          p.target = 0;
          if (p.splitCasing)
            for (const id of p.children) {
              const q = this.registry.get(id);
              if (q.kind === 'casing') q.target = 0;
            }
        }
      }
    }
    const follow = (value, target, tau) =>
      reduced
        ? target
        : Math.abs(value - target) < 0.0002
          ? target
          : value + (target - value) * (1 - Math.exp(-dt / tau));
    const old = this.explodeAmount;
    if (this.explodeMotion.x !== old) this.explodeMotion = { x: old, v: 0 };
    settle(this.explodeMotion, this.explodeTarget, dt, 0.2, reduced);
    this.explodeAmount = this.explodeMotion.x;
    if (old !== this.explodeAmount) moving = true;
    for (const p of this.registry.entries.values()) {
      const before = p.amount;
      p.amount = follow(p.amount, p.target, 0.25);
      if (before !== p.amount) moving = true;
      if (before !== p.amount || old !== this.explodeAmount || p.detached) p.transformDirty = true;
      if (p.target === 0 && p.amount === 0) {
        if (p.detached) this.registry.visibilityDirty = true;
        p.detached = false;
        p.inspect.identity();
      }
      const share =
        this.explodeScope && !this.registry.isWithin(p.id, this.explodeScope)
          ? 0
          : this.explodeAmount;
      const localId = p.engineSide ? p.id.slice(`aircraft.engines.${p.engineSide}.`.length) : p.id;
      const e =
        localId === 'exterior'
          ? smooth(0.45, 1, share)
          : p.kind === 'casing'
            ? smooth(0, 0.3, share)
            : localId.startsWith('shafts.bearing')
              ? smooth(0.82, 1, share)
              : smooth(0.16, 1, share);
      const d = smooth(0, 1, p.amount);
      p.object.position
        .copy(p.detached ? p.mount.position : p.operatingPosition || p.mount.position)
        .addScaledVector(p.explode, e);
      // Start extraction along the axis before spreading radially out of the mounting row.
      if (p.extraction === 'axial-first') {
        p.object.position.x += p.move.x * smooth(0, 0.55, d);
        p.object.position.y += p.move.y * smooth(0.55, 1, d);
        p.object.position.z += p.move.z * smooth(0.55, 1, d);
      } else if (!p.splitCasing) p.object.position.addScaledVector(p.move, d);
      p.object.quaternion.copy(
        p.detached
          ? p.detachedQuaternion || p.mount.quaternion
          : p.operatingQuaternion || p.mount.quaternion,
      );
      if (p.detached && p.amount > 0.8) {
        const q = new THREE.Quaternion().slerp(p.inspect, smooth(0.8, 1, p.amount));
        const base = p.object.quaternion.clone();
        p.object.quaternion.multiply(q);
        if (p.inspectionPivot) {
          const before = p.inspectionPivot.clone().applyQuaternion(base);
          const after = p.inspectionPivot.clone().applyQuaternion(p.object.quaternion);
          p.object.position.add(before.sub(after));
        }
      }
      p.object.scale.copy(p.detached ? p.mount.scale : p.operatingScale || p.mount.scale);
      // A removed child is anchored in world space even if its original parent moves.
      // On return, blend that anchor back into the parent's current frame before seating.
      if (p.detached && p.detachParentWorld) {
        const parent = p.object.parent;
        // Counter-transform against the same frozen shaft pose the renderer uses.
        for (const ancestor of p.ancestorRefs) {
          const spool = this.spoolById.get(ancestor.id);
          const source = this.simulation.forComponent?.(ancestor.id) || this.simulation;
          if (spool && !ancestor.detached)
            ancestor.object.quaternion
              .copy(ancestor.mount.quaternion)
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(1, 0, 0),
                  spool === 'LP' ? source.lpAngle : source.hpAngle,
                ),
              );
        }
        parent.updateWorldMatrix(true, false);
        let anchor = p.detachParentWorld;
        if (p.target === 0) {
          const fromPosition = new THREE.Vector3(),
            fromRotation = new THREE.Quaternion(),
            fromScale = new THREE.Vector3();
          const toPosition = new THREE.Vector3(),
            toRotation = new THREE.Quaternion(),
            toScale = new THREE.Vector3();
          p.detachParentWorld.decompose(fromPosition, fromRotation, fromScale);
          parent.matrixWorld.decompose(toPosition, toRotation, toScale);
          const blend = 1 - d;
          anchor = new THREE.Matrix4().compose(
            fromPosition.lerp(toPosition, blend),
            fromRotation.slerp(toRotation, blend),
            fromScale.lerp(toScale, blend),
          );
        }
        p.object.updateMatrix();
        const local = parent.matrixWorld
          .clone()
          .invert()
          .multiply(anchor)
          .multiply(p.object.matrix);
        local.decompose(p.object.position, p.object.quaternion, p.object.scale);
      }
    }
    if (moving) this.registry.dirty = true;
    this.simulation.setInterlock(this.hasMissing());
    return moving;
  }
}
