import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applySpoolTransforms, applyVariableStators } from '../engine/mechanics.js';
import { FlowEffects } from './effects.js';
import { smooth } from '../../.agents/skills/anatomy/kit/gl.mjs';

const VIEWS = {
  Orbit: { position: [-5.8, 4.1, 7.2], target: [0.35, 1.85, 0] },
  Front: { position: [-10.5, 2.12, 0], target: [-0.8, 2.12, 0] },
  Side: { position: [0.3, 2.8, 11.8], target: [0.3, 2, 0] },
  Rear: { position: [11, 3.1, 3.4], target: [0.4, 2.1, 0] },
  Exploded: { position: [-9, 7.3, 23], target: [0, 2.8, -0.3] },
};
export class EngineViewer {
  constructor(element, lab) {
    this.element = element;
    this.lab = lab;
    this.frame = 0;
    this.last = 0;
    this.visible = true;
    this.disposed = false;
    this.cameraTransition = null;
    this.renderCount = 0;
    this.lastTelemetry = 0;
    this.dirty = true;
    this.previousHover = null;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.softwareRenderer = debug
      ? /SwiftShader|llvmpipe|Software/i.test(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : false;
    this.renderer.setPixelRatio(
      this.softwareRenderer ? 0.85 : Math.min(window.devicePixelRatio, 1.5),
    );
    this.renderer.setClearColor('#f5f4f0');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.softwareRenderer
      ? THREE.PCFSoftShadowMap
      : THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive GE90-115B engine. Drag to orbit, scroll to zoom; click a part to select.',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    element.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f5f4f0');
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.85;
    room.dispose();
    pmrem.dispose();
    this.scene.add(lab.root);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#a9a99c', 1.25));
    const key = new THREE.DirectionalLight('#fff8ee', 3.1);
    key.position.set(-3, 8, 5);
    key.castShadow = true;
    const shadowSize = this.softwareRenderer ? 768 : 2048;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    Object.assign(key.shadow.camera, {
      left: -7,
      right: 8,
      top: 6,
      bottom: -6,
      near: 0.5,
      far: 25,
    });
    key.shadow.bias = -0.00045;
    key.shadow.normalBias = 0.025;
    key.shadow.radius = 5;
    key.shadow.blurSamples = 8;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#e3edff', 0.8);
    fill.position.set(4, 4, -5);
    this.scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ color: '#474b3e', opacity: 0.18 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.015;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.04, 150);
    this.camera.position.fromArray(VIEWS.Orbit.position);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.fromArray(VIEWS.Orbit.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 0.55;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.96;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener(
      'change',
      (this.onControlChange = () => {
        this.dirty = true;
        this.wake();
      }),
    );
    this.controls.addEventListener(
      'start',
      (this.onControlStart = () => {
        this.cameraTransition = null;
      }),
    );
    lab.registry.visibilityFilter = (p) => {
      const ancestors = lab.registry.ancestors(p.id);
      if (p.detached || ancestors.some((a) => a.detached)) return true;
      return !(
        lab.state.cutaway &&
        !lab.state.isolated &&
        !lab.state.exploded &&
        (p.cutaway || ancestors.some((a) => a.cutaway))
      );
    };
    lab.registry.visibilityDirty = true;
    lab.registry.dirty = true;
    this.effects = new FlowEffects(this.scene);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.down = null;
    this.hoverOutline = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(element);
    this.observer = new IntersectionObserver((entries) => {
      this.visible = entries.at(-1).isIntersecting;
      if (this.visible) this.wake();
    });
    this.observer.observe(element);
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.onMotion = () => {
      lab.emit({ reduced: this.motion.matches });
    };
    this.motion.addEventListener('change', this.onMotion);
    this.onMotion();
    this.onDown = (e) => {
      this.element.focus({ preventScroll: true });
      this.down = { x: e.clientX, y: e.clientY };
    };
    this.onMove = (e) => {
      if (e.buttons) return;
      this.pendingPointer = { clientX: e.clientX, clientY: e.clientY };
      this.wake();
    };
    this.onUp = (e) => {
      if (!this.down || Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return;
      const id = this.pick(e);
      if (id) lab.select(id);
      this.down = null;
    };
    this.onDouble = (e) => {
      const id = this.pick(e);
      if (id) {
        lab.select(id);
        lab.isolate(id);
      }
    };
    this.onLeave = () => {
      lab.registry.setHover(null);
      this.updateOutline(null);
      this.wake();
    };
    this.onKey = (e) => {
      if (e.target !== element) return;
      const key = e.key.toLowerCase();
      if (key === 'escape') {
        if (lab.state.isolated) lab.isolate(lab.state.isolated);
        else lab.registry.setHover(null);
      }
      if (key === 'f') {
        e.preventDefault();
        this.focus(lab.state.selected);
      }
      if (key === 'd') {
        e.preventDefault();
        lab.detach();
      }
      if (key === 'a') {
        e.preventDefault();
        lab.reattach();
      }
      if (key === ' ') {
        e.preventDefault();
        lab.toggleRun();
      }
      if (key === 'home') {
        e.preventDefault();
        this.setView('Orbit');
      }
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        e.preventDefault();
        if (lab.registry.get(lab.state.selected)?.detached)
          lab.rotate(
            key === 'arrowleft' || key === 'arrowright' ? 'y' : 'x',
            key === 'arrowleft' || key === 'arrowup' ? -0.15 : 0.15,
          );
        else {
          const offset = this.camera.position.clone().sub(this.controls.target);
          offset.applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            key === 'arrowleft' ? -0.08 : key === 'arrowright' ? 0.08 : 0,
          );
          if (key === 'arrowup') offset.multiplyScalar(0.92);
          if (key === 'arrowdown') offset.multiplyScalar(1.08);
          this.camera.position.copy(this.controls.target).add(offset);
          this.wake();
        }
      }
    };
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('dblclick', this.onDouble);
    c.addEventListener('pointerleave', this.onLeave);
    element.addEventListener('keydown', this.onKey);
    lab.viewer = this;
    lab.emit({ ready: true });
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;
    this.wake();
  }
  resize() {
    const { clientWidth: w, clientHeight: h } = this.element;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    const framingScale = Math.max(1, 1.45 / this.camera.aspect),
      previousScale = this.framingScale || 1;
    if (Math.abs(framingScale - previousScale) > 0.001) {
      const offset = this.camera.position
        .clone()
        .sub(this.controls.target)
        .multiplyScalar(framingScale / previousScale);
      this.camera.position.copy(this.controls.target).add(offset);
      this.cameraTransition = null;
    }
    this.framingScale = framingScale;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    this.wake();
  }
  pick(event) {
    const b = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - b.left) / b.width) * 2 - 1,
      (-(event.clientY - b.top) / b.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.lab.root, true);
    for (const hit of hits) {
      let obj = hit.object,
        visible = true;
      while (obj) {
        if (!obj.visible) {
          visible = false;
          break;
        }
        obj = obj.parent;
      }
      if (!visible) continue;
      const id =
        hit.instanceId === undefined
          ? hit.object.userData.componentId
          : hit.object.userData.componentIds?.[hit.instanceId];
      if (id && this.partVisible(id)) return id;
    }
    return null;
  }
  partVisible(id) {
    return this.lab.registry.effectiveVisible(id);
  }
  updateOutline(id) {
    if (id === this.previousHover) return;
    this.previousHover = id;
    if (this.hoverOutline) {
      this.hoverOutline.geometry.dispose();
      this.hoverOutline.material.dispose();
      this.hoverOutline.removeFromParent();
      this.hoverOutline = null;
    }
    const p = this.lab.registry.get(id),
      v = p?.visuals[0];
    if (!v) return;
    const edges = new THREE.EdgesGeometry(v.mesh.geometry, 30);
    this.hoverOutline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: '#bc6c42',
        transparent: true,
        opacity: 0.55,
        depthTest: true,
      }),
    );
    p.object.add(this.hoverOutline);
  }
  setView(name) {
    const v = VIEWS[name] || VIEWS.Orbit;
    const target = new THREE.Vector3(...v.target),
      position = new THREE.Vector3(...v.position);
    position
      .sub(target)
      .multiplyScalar(this.framingScale || 1)
      .add(target);
    this.transition(position.toArray(), v.target);
  }
  transition(position, target) {
    this.cameraTransition = {
      time: 0,
      from: this.camera.position.clone(),
      to: new THREE.Vector3(...position),
      startTarget: this.controls.target.clone(),
      endTarget: new THREE.Vector3(...target),
    };
    this.wake();
  }
  focus(id) {
    const p = this.lab.registry.get(id);
    if (!p) return;
    this.lab.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const entry of this.lab.registry.descendants(id))
      for (const v of entry.visuals) {
        v.mesh.geometry.computeBoundingBox();
        const box = v.mesh.geometry.boundingBox.clone().applyMatrix4(entry.object.matrixWorld);
        bounds.union(box);
      }
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.transition(
      center
        .clone()
        .addScaledVector(dir, Math.max(0.8, size * 1.5))
        .toArray(),
      center.toArray(),
    );
  }
  updateVariableVanes() {
    applyVariableStators(this.lab.registry, this.lab.simulation);
    for (const row of this.lab.registry.variables)
      for (const id of row.ids) {
        const p = this.lab.registry.get(id);
        if (!this.partVisible(id)) {
          const matrix = p.object.matrix.clone().scale(new THREE.Vector3(0, 0, 0));
          p.instance.mesh.setMatrixAt(p.instance.index, matrix);
        }
      }
  }

  wake = () => {
    this.dirty = true;
    if (this.inTick) return;
    if (!this.frame && !this.disposed && this.visible) {
      this.last = 0;
      this.frame = requestAnimationFrame(this.tick);
    }
  };
  gpuReady() {
    if (!this.gpuFence) return true;
    const gl = this.renderer.getContext();
    // Never queue another software-rendered frame while the GPU is still busy.
    // Poll without blocking the UI thread; simulation and input keep advancing.
    const status = gl.clientWaitSync(this.gpuFence, 0, 0);
    if (status === gl.TIMEOUT_EXPIRED) return false;
    gl.deleteSync(this.gpuFence);
    this.gpuFence = null;
    return true;
  }
  tick = (now) => {
    this.frame = 0;
    if (this.disposed || !this.visible) return;
    this.inTick = true;
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 30) : 1 / 60;
    this.last = now;
    const { lab } = this;
    const moving = lab.step(dt);
    let cameraMoving = false;
    if (this.pendingPointer) {
      const hit = this.pick(this.pendingPointer);
      this.pendingPointer = null;
      lab.registry.setHover(hit);
      this.element.style.cursor = hit ? 'pointer' : 'grab';
      this.updateOutline(hit);
      this.dirty = true;
    }
    if (this.cameraTransition) {
      const t = this.cameraTransition;
      t.time += dt;
      const u = lab.state.reduced ? 1 : smooth(0, 1, Math.min(1, t.time / 0.7));
      this.camera.position.lerpVectors(t.from, t.to, u);
      this.controls.target.lerpVectors(t.startTarget, t.endTarget, u);
      cameraMoving = true;
      if (u === 1) this.cameraTransition = null;
    }
    applySpoolTransforms(lab.registry, lab.simulation);
    if (lab.registry.dirty) {
      if (lab.registry.visibilityDirty) this.renderer.shadowMap.needsUpdate = true;
      lab.registry.sync();
      this.dirty = true;
    }
    const running =
      lab.simulation.n1 > 0 ||
      lab.simulation.n2 > 0 ||
      lab.simulation.on ||
      lab.simulation.heat.x > 0.001 ||
      Math.abs(lab.simulation.vsv - 0.34 * (1 - lab.simulation.n2)) > 0.0001;
    this.updateVariableVanes();
    const distance = this.camera.position.distanceTo(this.controls.target);
    for (const batch of lab.registry.batches) {
      if (!batch.lowGeometry) continue;
      const geometry = distance < 6 ? batch.highGeometry : batch.lowGeometry;
      if (batch.mesh.geometry !== geometry) {
        batch.mesh.geometry = geometry;
        batch.mesh.computeBoundingSphere();
        this.dirty = true;
        this.renderer.shadowMap.needsUpdate = true;
      }
    }
    this.effects.update(dt, lab.simulation, lab.state);
    const controlsMoving = this.controls.update();
    const wantsRender = this.dirty || moving || running || cameraMoving || controlsMoving;
    const renderDue =
      !this.softwareRenderer || !this.lastRenderTime || now - this.lastRenderTime >= 100;
    if (wantsRender && renderDue && this.gpuReady()) {
      if (
        (moving || (running && !lab.state.reduced)) &&
        (!this.softwareRenderer || !this.lastShadow || now - this.lastShadow > 180)
      ) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadow = now;
      }
      if (!moving && this.wasMoving) this.renderer.shadowMap.needsUpdate = true;
      this.wasMoving = moving;
      const renderStart = performance.now();
      this.renderer.render(this.scene, this.camera);
      if (this.softwareRenderer) {
        const gl = this.renderer.getContext();
        this.gpuFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
      }
      this.renderCpuMs = performance.now() - renderStart;
      this.lastRenderTime = now;
      this.renderCount++;
      this.dirty = false;
    }
    if (
      now - this.lastTelemetry > 140 ||
      this.telemetryPhase !== lab.simulation.phase ||
      !running
    ) {
      lab.telemetryListeners.forEach((f) => f(lab.simulation.snapshot()));
      this.lastTelemetry = now;
      this.telemetryPhase = lab.simulation.phase;
    }
    this.inTick = false;
    if (
      moving ||
      cameraMoving ||
      controlsMoving ||
      (running && !lab.simulation.interlocked) ||
      this.dirty
    )
      this.frame = requestAnimationFrame(this.tick);
  };
  diagnostics() {
    const gl = this.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      parts: this.lab.registry.entries.size,
      pixelRatio: this.renderer.getPixelRatio(),
      softwareRenderer: this.softwareRenderer,
      renderCpuMs: this.renderCpuMs,
      frameRateLimit: this.softwareRenderer ? 10 : null,
      gpuBackpressure: this.softwareRenderer,
      targetFps: 60,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      renderer: debug
        ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      frames: this.renderCount,
    };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.observer.disconnect();
    this.motion.removeEventListener('change', this.onMotion);
    this.controls.dispose();
    this.effects.dispose();
    this.environment.dispose();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    if (this.gpuFence) this.renderer.getContext().deleteSync(this.gpuFence);
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.element.removeEventListener('keydown', this.onKey);
    this.lab.viewer = null;
  }
}
