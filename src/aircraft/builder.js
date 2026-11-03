import * as THREE from 'three';
import { box, cylinder, between, torus } from '../scene/geometry.js';
const EYE_GEOMETRY = torus(0.095, 0.025)
  .clone()
  .rotateY(Math.PI / 2);
const MATERIAL_NAMES = {
  paint: 'Painted aluminium skin',
  skinInner: 'Structural aluminium',
  glazing: 'Aircraft glazing',
  windowRim: 'Window surround alloy',
  upholstery: 'Upholstery',
  cabinCream: 'Cabin interior panel',
  carpet: 'Cabin flooring',
  screen: 'Instrument display',
  aluminium: 'Aluminium alloy',
  steel: 'Steel',
  graphite: 'Graphite composite',
  rubber: 'Elastomer',
  copper: 'Copper alloy',
  stand: 'Display support steel',
  lamp: 'Lighting diffuser',
  insulation: 'Insulation / restraint fabric',
};

/** Shared world-frame instances retain separate registry frames and removal identities. */
export class AircraftBuilder {
  constructor(registry, materials) {
    this.r = registry;
    this.m = materials;
    this.instances = new Map();
    this.joints = [];
    this.linkages = [];
  }
  group(id, name, parent = 'aircraft', options = {}) {
    return this.r.add({
      id,
      name,
      parent,
      kind: 'assembly',
      material: 'Mixed aircraft assembly',
      purpose: `${name} in the Boeing 777–300ER educational assembly.`,
      relationship:
        'Mounted to its parent assembly; individual children retain their own identities.',
      ...options,
    });
  }
  part(id, name, parent, geometry, material = 'paint', options = {}) {
    const { scale, unique = false, ...rest } = options;
    const p = this.r.add({
      id,
      name,
      parent,
      material: MATERIAL_NAMES[material] || material,
      materialKey: material,
      purpose: `${name} in the Boeing 777–300ER educational assembly.`,
      relationship: 'Mounted to its parent assembly. Removal geometry is educational.',
      ...rest,
    });
    if (scale) {
      p.object.scale.fromArray(scale);
      p.mount.scale.copy(p.object.scale);
    }
    if (unique) {
      this.r.mesh(id, geometry, this.m[material]);
      return p;
    }
    const key = geometry.uuid + ':' + material;
    if (!this.instances.has(key)) this.instances.set(key, { geometry, material, parts: [] });
    this.instances.get(key).parts.push(p);
    return p;
  }
  beam(
    id,
    name,
    parent,
    start,
    end,
    width = 0.08,
    depth = width,
    material = 'aluminium',
    options = {},
  ) {
    const a = new THREE.Vector3(...start),
      b = new THREE.Vector3(...end),
      delta = b.clone().sub(a);
    return this.part(id, name, parent, box(width, delta.length(), depth, 0.015), material, {
      position: a.add(b).multiplyScalar(0.5).toArray(),
      quaternion: new THREE.Quaternion()
        .setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize())
        .toArray(),
      ...options,
    });
  }
  tube(id, name, parent, start, end, r = 0.05, material = 'steel', options = {}) {
    const b = between(start, end, r);
    return this.part(id, name, parent, b.geometry, material, {
      position: b.position,
      quaternion: b.quaternion,
      ...options,
    });
  }
  bolts(parent, prefix, points, size = 0.035) {
    points.forEach((position, i) =>
      this.part(
        `${prefix}.${i + 1}`,
        'Retaining fastener',
        parent,
        cylinder(size, 0.05, 6),
        'steel',
        { position, detail: 'fine', move: [-0.18, 0, 0.12], explode: [0, 0, 0.04] },
      ),
    );
  }
  joint(id, channel, axis, angle, slide = [0, 0, 0]) {
    const p = this.r.get(id);
    p.joint = {
      channel,
      axis: new THREE.Vector3(...axis).normalize(),
      angle,
      slide: new THREE.Vector3(...slide),
    };
    this.joints.push(p);
  }
  linkage(id, name, parent, start, end, options = {}) {
    this.group(id, name, parent, {
      move: [0, 0.6, 0.4],
      purpose:
        'A telescopic actuator joins a fixed mount to a moving attachment. Barrel and rod poses use the same mechanism state.',
      ...options,
    });
    this.part(`${id}.barrel`, 'Actuator barrel', id, cylinder(0.075, 1, 24), 'steel', {
      move: [0, 0.4, 0.2],
    });
    this.part(`${id}.piston`, 'Actuator piston rod', id, cylinder(0.044, 1, 24), 'aluminium', {
      move: [0.4, 0, 0.2],
    });
    for (const end of ['start', 'end'])
      this.part(`${id}.eye.${end}`, 'Actuator eye bearing', id, EYE_GEOMETRY, 'steel', {
        move: [0, 0.3, 0.2],
      });
    this.linkages.push({ id, parent: id, start, end });
  }
  flush(root) {
    for (const { geometry, material, parts } of this.instances.values()) {
      const mesh = new THREE.InstancedMesh(geometry, this.m[material], parts.length);
      mesh.name = 'aircraft instances';
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.componentIds = parts.map((p) => p.id);
      root.add(mesh);
      parts.forEach((p, index) => {
        p.instance = { mesh, index };
        p.visuals.push({ mesh, index, baseMaterial: this.m[material] });
        mesh.setColorAt(index, new THREE.Color('#ffffff'));
      });
      this.r.batches.push({
        mesh,
        ids: mesh.userData.componentIds,
        parent: 'aircraft',
        worldFrames: true,
      });
    }
  }
}
