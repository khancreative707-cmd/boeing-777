import * as THREE from 'three';
const scratch = new THREE.Object3D();
const copper = new THREE.Color('#c0784e'),
  white = new THREE.Color('#ffffff');
const hoverColor = new THREE.Color('#d4bea9');
const hiddenScale = new THREE.Vector3(0, 0, 0);

/** Every physical part has a frame, even when its visual is a GPU instance. */
export class ComponentRegistry {
  constructor() {
    this.entries = new Map();
    this.batches = [];
    this.rotors = [];
    this.variables = [];
    this.dirty = true;
    this.styleDirty = true;
    this.visibilityDirty = true;
    this.selection = null;
    this.hover = null;
    this.isolation = null;
  }
  add({
    id,
    name,
    parent = null,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    quaternion,
    material = 'Mixed assembly',
    purpose,
    relationship,
    spool = null,
    required = true,
    move = [0, 1.1, 1.4],
    explode = [0, 0, 0],
    blockers = [],
    kind = 'part',
    ...rest
  }) {
    if (this.entries.has(id)) throw new Error(`Duplicate component ID: ${id}`);
    const object = new THREE.Group();
    object.name = id;
    object.userData.componentId = id;
    object.position.fromArray(position);
    object.rotation.set(...rotation);
    if (quaternion) object.quaternion.fromArray(quaternion);
    const owner = parent ? this.get(parent) : null;
    if (parent && !owner) throw new Error(`Missing parent ${parent} for ${id}`);
    owner?.object.add(object);
    const entry = {
      id,
      name,
      parent,
      children: [],
      ancestorRefs: owner ? [owner, ...owner.ancestorRefs] : [],
      transformDirty: true,
      object,
      material,
      purpose: purpose || owner?.purpose || 'A precision component in the engine assembly.',
      relationship: relationship || owner?.relationship || 'Mounted to its parent assembly.',
      spool,
      required: owner?.required === false ? false : required,
      move: new THREE.Vector3(...move),
      explode: new THREE.Vector3(...explode),
      blockers,
      kind,
      visible: true,
      mount: {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
      },
      detached: false,
      amount: 0,
      target: 0,
      inspect: new THREE.Quaternion(),
      visuals: [],
      ...rest,
    };
    this.entries.set(id, entry);
    owner?.children.push(id);
    this.dirty = true;
    return entry;
  }
  get(id) {
    return this.entries.get(id);
  }
  descendants(id, include = true) {
    const result = [];
    const walk = (key) => {
      const p = this.get(key);
      if (!p) return;
      result.push(p);
      p.children.forEach(walk);
    };
    walk(id);
    return include ? result : result.slice(1);
  }
  ancestors(id) {
    return this.get(id)?.ancestorRefs || [];
  }
  isWithin(id, parent) {
    return id === parent || this.ancestors(id).some((p) => p.id === parent);
  }
  mesh(id, geometry, material) {
    const entry = this.get(id);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.componentId = id;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    entry.object.add(mesh);
    entry.visuals.push({ mesh, baseMaterial: material });
    return mesh;
  }
  batch(parent, geometry, material, parts) {
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    mesh.name = `instances:${parent}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const ids = [];
    parts.forEach((spec, i) => {
      const entry = this.add({ ...spec, parent });
      entry.instance = { mesh, index: i };
      entry.visuals.push({ mesh, index: i, baseMaterial: material });
      ids.push(entry.id);
      mesh.setColorAt(i, white);
    });
    mesh.userData.componentIds = ids;
    this.get(parent).object.add(mesh);
    this.batches.push({
      mesh,
      ids,
      parent,
      highGeometry: geometry,
      lowGeometry: geometry.userData.lowGeometry,
    });
    this.dirty = true;
    return mesh;
  }
  effectiveVisible(id, includeAncestorFrames = false) {
    const p = this.get(id);
    if (!p?.visible) return false;
    if (this.visibilityFilter && !this.visibilityFilter(p, includeAncestorFrames)) return false;
    if (this.ancestors(id).some((a) => !a.visible)) return false;
    return (
      !this.isolation ||
      this.isWithin(id, this.isolation) ||
      (includeAncestorFrames && this.isWithin(this.isolation, id))
    );
  }
  sync() {
    if (this.visibilityDirty)
      for (const p of this.entries.values()) {
        p.renderVisible = this.effectiveVisible(p.id);
        p.object.visible = this.effectiveVisible(p.id, true);
        for (const visual of p.visuals)
          if (visual.index === undefined) visual.mesh.visible = p.renderVisible;
      }
    for (const { mesh, ids, worldFrames } of this.batches) {
      let changed = false;
      let inverse;
      if (worldFrames) {
        mesh.parent.updateWorldMatrix(true, false);
        inverse = mesh.parent.matrixWorld.clone().invert();
      }
      for (let i = 0; i < ids.length; i++) {
        const p = this.get(ids[i]);
        if (
          this.visibilityDirty ||
          p.transformDirty ||
          (worldFrames && p.ancestorRefs.some((a) => a.transformDirty))
        ) {
          p.object.updateMatrix();
          if (worldFrames) {
            p.object.updateWorldMatrix(true, false);
            scratch.matrix.copy(inverse).multiply(p.object.matrixWorld);
          } else scratch.matrix.copy(p.object.matrix);
          if (!p.renderVisible) scratch.matrix.scale(hiddenScale);
          mesh.setMatrixAt(i, scratch.matrix);
          changed = true;
        }
        if (this.styleDirty) {
          const selected = this.selection && this.isWithin(p.id, this.selection),
            hover = this.hover && this.isWithin(p.id, this.hover);
          mesh.setColorAt(i, selected ? copper : hover ? hoverColor : white);
        }
      }
      if (changed) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      if (this.styleDirty) mesh.instanceColor.needsUpdate = true;
    }
    if (this.styleDirty)
      for (const p of this.entries.values())
        for (const v of p.visuals) {
          if (v.index !== undefined) continue;
          const selected = this.selection && this.isWithin(p.id, this.selection),
            hover = this.hover && this.isWithin(p.id, this.hover);
          if (selected || hover) {
            if (!v.highlight) v.highlight = v.baseMaterial.clone();
            if (v.highlight.color && v.baseMaterial.color)
              v.highlight.color.copy(v.baseMaterial.color).lerp(copper, selected ? 0.48 : 0.2);
            if (v.highlight.emissive) {
              v.highlight.emissive.set(selected ? '#422817' : '#17140f');
              v.highlight.emissiveIntensity = 0.16;
            }
            v.mesh.material = v.highlight;
          } else v.mesh.material = v.baseMaterial;
        }
    for (const p of this.entries.values()) p.transformDirty = false;
    this.dirty = false;
    this.styleDirty = false;
    this.visibilityDirty = false;
  }
  setSelection(id) {
    this.selection = id;
    this.styleDirty = true;
    this.dirty = true;
  }
  setHover(id) {
    if (this.hover === id) return;
    this.hover = id;
    this.styleDirty = true;
    this.dirty = true;
  }
  setVisible(id, on) {
    this.get(id).visible = on;
    this.visibilityDirty = true;
    this.dirty = true;
  }
  isolate(id) {
    this.isolation = this.isolation === id ? null : id;
    this.visibilityDirty = true;
    this.dirty = true;
  }
  inspectionPivot(id) {
    const selected = this.get(id);
    selected.object.updateWorldMatrix(true, true);
    const inverse = selected.object.matrixWorld.clone().invert(),
      bounds = new THREE.Box3();
    for (const p of this.descendants(id))
      for (const visual of p.visuals) {
        if (
          p.id !== id &&
          (p.detached ||
            p.ancestorRefs.some((a) => a.id !== id && a.detached && this.isWithin(a.id, id)))
        )
          continue;
        visual.mesh.geometry.computeBoundingBox();
        bounds.union(
          visual.mesh.geometry.boundingBox
            .clone()
            .applyMatrix4(inverse.clone().multiply(p.object.matrixWorld)),
        );
      }
    return bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
  }
  snapshot() {
    return [...this.entries.values()].map((p) => ({
      id: p.id,
      name: p.name,
      parent: p.parent,
      children: [...p.children],
      material: p.material,
      purpose: p.purpose,
      relationship: p.relationship,
      spool: p.spool,
      kind: p.kind,
      required: p.required,
      visible: p.visible,
      detached: p.detached,
      amount: p.amount,
      blockers: p.blockers,
    }));
  }
  dispose() {
    for (const p of this.entries.values()) for (const v of p.visuals) v.highlight?.dispose();
    for (const b of this.batches) b.mesh.dispose();
  }
}
