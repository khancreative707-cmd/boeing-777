import * as THREE from 'three';
import { FlowEffects } from '../scene/effects.js';

export class AircraftEffects {
  constructor(scene, lab) {
    this.lab = lab;
    this.flows = {};
    this.displays = [];
    this.elapsed = 0;
    for (const side of ['left', 'right']) {
      const flow = new FlowEffects(scene);
      lab.registry.get(`aircraft.engines.${side}.powerplant`).object.add(flow.group);
      flow.group.position.set(0, 0, 0);
      this.flows[side] = flow;
    }
    for (const p of lab.registry.entries.values())
      if (p.displaySide) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 448;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const visual = p.visuals[0],
          material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const old = visual.baseMaterial;
        visual.baseMaterial = material;
        visual.mesh.material = material;
        const g = visual.mesh.geometry.clone(),
          pos = g.attributes.position,
          uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++)
          uv.setXY(i, (pos.getX(i) + 0.27) / 0.54, (pos.getY(i) + 0.24) / 0.48);
        visual.mesh.geometry = g;
        this.displays.push({
          canvas,
          texture,
          material,
          old,
          visual,
          side: p.displaySide,
          geometry: g,
        });
      }
  }
  update(dt, simulation, state) {
    for (const side of ['left', 'right'])
      this.flows[side].update(dt, simulation.engines[side], {
        ...state,
        airflow: state.airflow && (state.engineFocus === side || !!state.isolated),
      });
    this.elapsed += dt;
    if (this.elapsed < 0.12 && this.drawn) return;
    this.elapsed = 0;
    this.drawn = true;
    for (const d of this.displays) {
      const c = d.canvas.getContext('2d'),
        s = simulation.engines[d.side],
        gear = this.lab.mechanisms.gearPhase;
      c.fillStyle = '#172a2c';
      c.fillRect(0, 0, 512, 448);
      c.fillStyle = '#d8dfcf';
      c.font = '22px monospace';
      c.fillText(`ENGINE ${d.side === 'left' ? 'L' : 'R'}`, 26, 39);
      c.strokeStyle = '#52615c';
      c.beginPath();
      c.moveTo(24, 57);
      c.lineTo(488, 57);
      c.stroke();
      for (const [i, [label, value, unit]] of [
        ['N1', (s.n1 * 100).toFixed(1), '%'],
        ['N2', (s.n2 * 100).toFixed(1), '%'],
        ['EGT', Math.round(s.temperature), 'C'],
      ].entries()) {
        const y = 112 + i * 82;
        c.fillStyle = '#a9b8a9';
        c.font = '21px monospace';
        c.fillText(label, 26, y);
        c.fillStyle = '#dce5c6';
        c.font = '42px monospace';
        c.fillText(String(value), 190, y);
        c.font = '22px monospace';
        c.fillText(unit, 410, y);
      }
      c.font = '20px monospace';
      c.fillStyle = '#c9d8c1';
      c.fillText(gear.toUpperCase().slice(0, 28), 26, 365);
      c.fillStyle = '#81918a';
      c.font = '15px monospace';
      c.fillText('ILLUSTRATIVE / EXHIBIT MODEL', 26, 417);
      d.texture.needsUpdate = true;
    }
  }
  dispose() {
    for (const f of Object.values(this.flows)) f.dispose();
    for (const d of this.displays) {
      d.visual.baseMaterial = d.old;
      d.visual.mesh.material = d.old;
      d.texture.dispose();
      d.material.dispose();
      d.geometry.dispose();
    }
  }
}
