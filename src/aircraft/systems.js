import { box, cylinder, lathe } from '../scene/geometry.js';
import { skinFor } from './fuselage.js';
export function buildSystems(b) {
  b.group('aircraft.systems', 'Aircraft systems', 'aircraft', {
    layer: 'systems',
    move: [0, 4, -8],
    explode: [0, 1, -5],
    purpose:
      'Representative hydraulic, electrical, air and fuel-system connections. Routing and equipment placement are educational.',
  });
  for (const [name, material, y, z] of [
    ['hydraulic', 'steel', 5.4, 1.7],
    ['electrical', 'graphite', 5.65, -1.8],
    ['air', 'aluminium', 5.2, -1.4],
    ['fuel', 'copper', 5.35, 1.35],
  ]) {
    const id = `aircraft.systems.${name}`;
    b.group(id, `${name} distribution`, 'aircraft.systems', {
      layer: 'systems',
      move: [0, 3, z > 0 ? 4 : -4],
      explode: [0, 0.3, z > 0 ? 0.3 : -0.3],
    });
    for (let i = 0; i < 14; i++) {
      const x = -27 + i * 3.7,
        r = name === 'air' ? 0.12 : 0.032;
      b.tube(
        `${id}.route.${i}`,
        `${name} route segment`,
        id,
        [x, y, z],
        [x + 3.66, y, z],
        r,
        material,
        {
          layer: 'systems',
          move: [0, 0.8, z > 0 ? 1 : -1],
          blockers: [skinFor(x)],
          purpose:
            'Supported representative route segment. It terminates at a connector rather than in free space.',
        },
      );
      b.part(`${id}.connector.${i}`, 'Route coupling', id, cylinder(r * 1.5, 0.11, 16), 'steel', {
        position: [x + 3.7, y, z],
        move: [0, 0.3, 0.3],
        detail: 'fine',
      });
      b.part(`${id}.clamp.${i}`, 'Route support clamp', id, box(0.09, 0.09, r * 3.4), 'steel', {
        position: [x + 1.5, y - 0.05, z],
        move: [0, -0.3, 0.3],
        detail: 'fine',
      });
    }
  }
  for (let i = 0; i < 4; i++) {
    const id = `aircraft.systems.rack.${i}`;
    b.group(id, 'Equipment rack', 'aircraft.systems', {
      position: [-24 + i * 1.2, 4.35, -1.4],
      layer: 'systems',
      move: [0, 0, -4],
      explode: [0, 0, -0.3],
      blockers: [skinFor(-24 + i * 1.2, 2)],
    });
    b.part(`${id}.frame`, 'Equipment rack frame', id, box(0.96, 1.2, 0.8), 'steel', {
      position: [0, 0.6, 0],
      move: [0, 1, 0],
    });
    for (let j = 0; j < 4; j++)
      b.part(
        `${id}.unit.${j}`,
        'Avionics equipment representation',
        id,
        box(0.8, 0.21, 0.74),
        'graphite',
        {
          position: [0, 0.2 + j * 0.26, 0],
          move: [0, 0, -1],
          explode: [0, 0.05, 0],
          detail: 'fine',
        },
      );
  }
  b.group('aircraft.systems.apu', 'Auxiliary power unit representation', 'aircraft.systems', {
    position: [32.6, 7.4, 0],
    layer: 'systems',
    move: [8, 0, 0],
    explode: [4, 0, 0],
    blockers: [skinFor(33)],
    purpose:
      'A representative aft auxiliary power unit. Exact internal architecture is not reproduced.',
  });
  b.part(
    'aircraft.systems.apu.case',
    'APU housing',
    'aircraft.systems.apu',
    lathe(
      [
        [-1, 0.3],
        [0, 0.48],
        [1, 0.35],
        [1.3, 0.15],
      ],
      48,
    ),
    'steel',
    { move: [0, 1, 0] },
  );
  b.part(
    'aircraft.systems.apu.exhaust',
    'APU exhaust',
    'aircraft.systems.apu',
    lathe(
      [
        [0.9, 0.22],
        [2, 0.13],
        [2, 0.09],
        [0.9, 0.16],
      ],
      40,
    ),
    'graphite',
    { move: [1, 0, 0] },
  );
}
