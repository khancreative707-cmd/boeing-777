import { buildEngine } from '../scene/build-engine.js';
import { box } from '../scene/geometry.js';
import { polygonSolid } from './geometry.js';

export function buildMountedEngines(b) {
  const r = b.r;
  b.group('aircraft.engines', 'Engines and pylons', 'aircraft', {
    purpose: 'Two GE90–115B turbofans mounted below the wings.',
    explode: [-1, -0.3, 0],
  });
  for (const [side, s] of [
    ['left', 1],
    ['right', -1],
  ]) {
    const prefix = `aircraft.engines.${side}`;
    b.group(prefix, `${side === 'left' ? 'Left' : 'Right'} GE90–115B`, 'aircraft.engines', {
      position: [-10.1, 3.25, s * 9.35],
      move: [-8, 0, s * 6],
      explode: [-4, -0.6, s * 12],
      supportRequired: true,
      purpose:
        'A GE90–115B turbofan with independent LP and HP spools. Enter engine inspection for detailed geometry.',
      relationship: `Mounted to the ${side} wing through the pylon. All internal components keep their own IDs.`,
    });
    b.part(
      `${prefix}.pylon`,
      'Engine pylon',
      prefix,
      polygonSolid(
        [
          [-0.4, 1.2],
          [4.6, 1.2],
          [5.6, 2.6],
          [1.9, 2.2],
        ],
        0.68,
      ),
      'paint',
      {
        move: [0, 2, 0],
        explode: [0, 0.6, 0],
        purpose:
          'Structural pylon transfers engine loads into the wing. Exact mount geometry is illustrative.',
      },
    );
    for (let i = 0; i < 2; i++)
      b.part(
        `${prefix}.mount.${i}`,
        'Engine mount fitting',
        `${prefix}.pylon`,
        box(0.6, 0.3, 0.78),
        'steel',
        { position: [1 + i * 2.5, 1.2, 0], move: [0, 0.6, s * 0.3], explode: [0, 0.1, s * 0.05] },
      );
    const built = buildEngine(b.m),
      er = built.registry;
    const isStand = (id) => id === 'stand' || id.startsWith('stand.');
    const qualify = (id) => (id === 'ge90' ? `${prefix}.powerplant` : `${prefix}.${id}`);
    er.get('stand').object.removeFromParent();
    const root = er.get('ge90');
    root.object.position.set(0, 0, 0);
    root.mount.position.set(0, 0, 0);
    root.object.scale.set(1, 1, 1);
    root.mount.scale.set(1, 1, 1);
    root.move.set(-6, 0, s * 4);
    root.explode.set(0, 0, 0);
    root.kind = 'assembly';
    root.supportRequired = true;
    root.name = 'GE90–115B powerplant';
    const kept = [...er.entries.values()].filter((p) => !isStand(p.id));
    for (const p of kept) {
      const original = p.id;
      p.id = qualify(original);
      p.object.name = p.id;
      p.object.userData.componentId = p.id;
      p.parent = original === 'ge90' ? prefix : qualify(p.parent);
      p.children = p.children.filter((id) => !isStand(id)).map(qualify);
      p.blockers = p.blockers.filter((id) => !isStand(id)).map(qualify);
      p.engineSide = side;
      if (original === 'exterior' || p.kind === 'casing' || p.splitCasing) p.layer = 'skin';
      p.engineDetail = !(
        original === 'ge90' ||
        original === 'exterior' ||
        original.startsWith('exterior.') ||
        original === 'fan' ||
        original.startsWith('fan.')
      );
      for (const visual of p.visuals)
        if (visual.index === undefined) visual.mesh.userData.componentId = p.id;
      r.entries.set(p.id, p);
    }
    r.get(prefix).children.push(root.id);
    r.get(prefix).object.add(root.object);
    for (const p of kept)
      p.ancestorRefs = p.parent ? [r.get(p.parent), ...r.get(p.parent).ancestorRefs] : [];
    for (const batch of er.batches) {
      if (isStand(batch.parent)) continue;
      batch.parent = qualify(batch.parent);
      batch.ids = batch.ids.map(qualify);
      batch.mesh.userData.componentIds = batch.ids;
      r.batches.push(batch);
    }
    for (const rotor of er.rotors) r.rotors.push({ ...rotor, id: qualify(rotor.id) });
    for (const row of er.variables) r.variables.push({ ...row, ids: row.ids.map(qualify) });
  }
}
