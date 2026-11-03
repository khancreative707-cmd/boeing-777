import * as THREE from 'three';
import { box, cylinder, torus } from '../scene/geometry.js';
import { ovalPanel, polygonSolid, fuselageProfile } from './geometry.js';
import { skinFor } from './fuselage.js';

function seat(b, id, parent, position, business = false, options = {}) {
  b.group(id, business ? 'Business seat' : 'Economy seat', parent, {
    position,
    layer: 'interior',
    move: [0, 1.5, 3],
    explode: [0, 0.12, 0],
    purpose: 'A representative cabin seat, not an airline-specific certified seat model.',
    ...options,
  });
  const w = business ? 0.68 : 0.46,
    d = business ? 0.9 : 0.61;
  b.part(`${id}.frame`, 'Seat base frame', id, box(d, 0.14, w), 'aluminium', {
    position: [0, 0.21, 0],
    move: [0, 0.4, 0],
    explode: [0, 0.06, 0],
  });
  b.part(`${id}.cushion`, 'Seat cushion', id, box(d, 0.17, w, 0.06), 'upholstery', {
    position: [-0.05, 0.42, 0],
    move: [0, 0.7, 0],
    explode: [0, 0.12, 0],
  });
  b.part(`${id}.back`, 'Seat back', id, box(0.14, 0.85, w, 0.055), 'upholstery', {
    position: [d * 0.45, 0.86, 0],
    rotation: [0, 0, -0.1],
    move: [0.5, 0.3, 0],
    explode: [0.12, 0, 0],
  });
  b.part(`${id}.headrest`, 'Seat headrest', id, box(0.17, 0.25, w * 0.8, 0.055), 'cabinCream', {
    position: [d * 0.5, 1.26, 0],
    move: [0, 0.5, 0],
    explode: [0, 0.05, 0],
    detail: 'fine',
  });
  for (const s of [-1, 1]) {
    b.part(`${id}.arm.${s}`, 'Armrest', id, box(d * 0.8, 0.08, 0.055), 'graphite', {
      position: [0, 0.63, s * (w * 0.5 + 0.02)],
      move: [0, 0.2, s * 0.3],
      explode: [0, 0.03, s * 0.03],
      detail: 'fine',
    });
    b.part(`${id}.leg.${s}`, 'Seat attachment leg', id, box(0.1, 0.25, 0.06), 'aluminium', {
      position: [0, 0.075, s * w * 0.35],
      move: [0, 0.2, s * 0.2],
      detail: 'fine',
    });
  }
}
export function buildInterior(b) {
  b.group('aircraft.cabin', 'Passenger cabin', 'aircraft', {
    layer: 'interior',
    move: [0, 9, 0],
    explode: [0, 5, 0],
    purpose:
      'A representative two-class cabin with two aisles. Layout and seat count are illustrative, not a specific airline configuration.',
  });
  b.group('aircraft.cargo', 'Lower cargo compartments', 'aircraft', {
    layer: 'interior',
    move: [0, -1.5, 7],
    explode: [0, -0.6, 4],
    purpose:
      'Cargo compartments below the passenger floor, with shaped container representations and support rails.',
  });
  for (let i = 0; i < 12; i++) {
    const x = -26 + i * 4.1;
    const end = fuselageProfile(x + 4.085);
    const floorWidth = Math.min(5.65, 2 * Math.sqrt((end.r - 0.1) ** 2 - (6.04 - end.y) ** 2));
    b.part(
      `aircraft.cabin.floor.${i}`,
      'Passenger floor panel',
      'aircraft.cabin',
      box(4.07, 0.1, floorWidth),
      'carpet',
      {
        position: [x + 2.05, 6.04, 0],
        move: [0, 2, 0],
        explode: [0, 0.3, 0],
        blockers: [skinFor(x + 2.05)],
        purpose: 'The passenger floor separates the occupied cabin from the lower cargo volume.',
      },
    );
    b.beam(
      `aircraft.fuselage.floorbeam.${i}`,
      'Passenger floor crossbeam',
      'aircraft.fuselage.structure',
      [x + 2.05, 5.88, -2.78],
      [x + 2.05, 5.88, 2.78],
      0.14,
      0.16,
      'aluminium',
      {
        layer: 'structure',
        move: [0, 2, 0],
        explode: [0, 0.2, 0],
        blockers: [`aircraft.cabin.floor.${i}`],
      },
    );
    b.part(
      `aircraft.cargo.floor.${i}`,
      'Cargo floor panel',
      'aircraft.cargo',
      box(4.07, 0.1, Math.min(4.05, 2 * Math.sqrt((end.r - 0.11) ** 2 - (4.11 - end.y) ** 2))),
      'skinInner',
      {
        position: [x + 2.05, 4.16, 0],
        move: [0, 0.8, 2],
        explode: [0, 0, 0.15],
        blockers: [skinFor(x + 2.05, 3)],
      },
    );
  }
  for (const z of [-2.25, -1.7, -0.7, 0.7, 1.7, 2.25])
    b.part(
      `aircraft.cabin.rail.${z}`,
      'Seat attachment rail',
      'aircraft.cabin',
      box(48.5, 0.025, 0.035),
      'aluminium',
      { position: [-1.7, 6.11, z], move: [0, 0.5, 0], explode: [0, 0.05, 0], detail: 'fine' },
    );
  let rowNumber = 0,
    seatNumber = 0;
  const createRow = (x, business) => {
    rowNumber++;
    const row = `aircraft.cabin.row.${rowNumber}`;
    b.group(row, `${business ? 'Business' : 'Economy'} row ${rowNumber}`, 'aircraft.cabin', {
      layer: 'interior',
      blockers: [skinFor(x)],
      move: [0, 2, 3],
      explode: [0, 0.08, 0],
    });
    const positions = business
      ? [-2.08, -0.65, 0.65, 2.08]
      : [-2.5, -2, -1.5, -0.5, 0, 0.5, 1.5, 2, 2.5];
    positions.forEach((z, index) => {
      seatNumber++;
      seat(b, `${row}.seat.${index + 1}`, row, [x, 6.11, x > 18 ? z * 0.98 : z], business, {
        blockers: [skinFor(x)],
      });
    });
  };
  for (let i = 0; i < 6; i++) createRow(-24.8 + i * 1.43, true);
  for (let x = -13.4; x < 22; x += 0.91)
    if (![-2, 10.4].some((d) => Math.abs(x - d) < 0.85)) createRow(x, false);
  b.r.get('aircraft.cabin').seatCount = seatNumber;
  for (let i = 0; i < 16; i++)
    for (const s of [-1, 1]) {
      const x = -25 + i * 3.05,
        id = `aircraft.cabin.bin.${s}.${i}`;
      b.group(id, 'Overhead bin module', 'aircraft.cabin', {
        position: [x, 7.82, s * 1.83],
        layer: 'interior',
        move: [0, 2, s * 1],
        explode: [0, 0.6, s * 0.3],
        blockers: [skinFor(x, s === 1 ? 0 : 1)],
      });
      b.part(
        `${id}.housing`,
        'Overhead bin housing',
        id,
        box(2.9, 0.48, 0.79, 0.07),
        'cabinCream',
        { move: [0, 0.6, 0] },
      );
      b.part(`${id}.lid`, 'Overhead bin door', id, box(2.84, 0.3, 0.05, 0.035), 'paint', {
        position: [0, -0.04, -s * 0.42],
        move: [0, -0.2, -s * 0.5],
        operation: 'bins',
      });
      b.joint(`${id}.lid`, 'bins', [1, 0, 0], s * 0.95, [0, 0.15, 0]);
      b.part(`${id}.latch`, 'Bin latch', `${id}.lid`, box(0.13, 0.035, 0.025), 'steel', {
        position: [0, -0.085, -s * 0.035],
        move: [0, 0, -s * 0.15],
        detail: 'fine',
      });
      b.part(
        `aircraft.cabin.light.${s}.${i}`,
        'Cabin light strip',
        'aircraft.cabin',
        box(2.85, 0.035, 0.06),
        'lamp',
        { position: [x, 8.16, s * 1.46], layer: 'interior', move: [0, 0.5, 0], detail: 'fine' },
      );
    }
  for (let i = 0; i < 9; i++)
    b.part(
      `aircraft.cabin.ceiling.${i}`,
      'Ceiling panel',
      'aircraft.cabin',
      box(5.2, 0.045, 2.55),
      'cabinCream',
      {
        position: [-24 + i * 5.6, 8.5, 0],
        layer: 'interior',
        cutaway: true,
        move: [0, 4, 0],
        explode: [0, 1.2, 0],
        blockers: [skinFor(-24 + i * 5.6)],
      },
    );
  for (const [n, x] of [
    ['forward', -26.6],
    ['class-divider', -15.6],
    ['aft', 23.2],
  ]) {
    // Contoured upper corners fit the taper; two open aisles pass below a lintel.
    const f = fuselageProfile(x),
      topY = 1.07;
    const upperWidth = Math.min(2.4, Math.sqrt((f.r - 0.15) ** 2 - (7.18 + topY - f.y) ** 2));
    const partition = polygonSolid(
      [
        [-2.4, -1.07],
        [-1.56, -1.07],
        [-1.56, 0.82],
        [-0.84, 0.82],
        [-0.84, -1.07],
        [0.84, -1.07],
        [0.84, 0.82],
        [1.56, 0.82],
        [1.56, -1.07],
        [2.4, -1.07],
        [2.4, 0.2],
        [upperWidth, topY],
        [-upperWidth, topY],
        [-2.4, 0.2],
      ],
      0.09,
    ).rotateY(Math.PI / 2);
    b.part(
      `aircraft.cabin.partition.${n}`,
      'Cabin partition',
      'aircraft.cabin',
      partition,
      'cabinCream',
      {
        position: [x, 7.18, 0],
        layer: 'interior',
        move: [0, 3, 0],
        explode: [0, 0.5, 0],
        blockers: [skinFor(x)],
      },
    );
    for (const z of [-2, 2]) {
      const id = `aircraft.cabin.service.${n}.${z}`;
      b.group(id, n === 'class-divider' ? 'Lavatory module' : 'Galley module', 'aircraft.cabin', {
        position: [x + 0.65, 6.12, z * (n === 'aft' ? 0.65 : n === 'forward' ? 0.9 : 0.94)],
        layer: 'interior',
        move: [0, 2, z > 0 ? 3 : -3],
        explode: [0, 0.2, z > 0 ? 0.2 : -0.2],
        blockers: [skinFor(x)],
      });
      b.part(`${id}.case`, 'Service module housing', id, box(1.03, 1.95, 1.1, 0.06), 'cabinCream', {
        position: [0, 0.98, 0],
        move: [0, 2, 0],
      });
      for (let drawer = 0; drawer < 4; drawer++)
        b.part(
          `${id}.cover.${drawer}`,
          'Service compartment cover',
          id,
          box(0.025, 0.34, 0.96),
          'steel',
          { position: [-0.53, 0.3 + drawer * 0.44, 0], move: [-0.6, 0, 0], detail: 'fine' },
        );
    }
  }
  const containerGeometry = polygonSolid(
    [
      [-0.6, 0],
      [0.6, 0],
      [0.94, 0.46],
      [0.94, 1.48],
      [-0.94, 1.48],
      [-0.94, 0.46],
    ],
    2.45,
  ).rotateY(Math.PI / 2);
  for (let i = 0; i < 12; i++)
    for (const s of [-1, 1]) {
      const x = -22.8 + i * 3.45,
        id = `aircraft.cargo.container.${i}.${s}`;
      if (x > -6 && x < 9) continue;
      b.group(id, 'Cargo container', 'aircraft.cargo', {
        position: [x, 4.22, s * 1.01],
        layer: 'interior',
        move: [0, 0.2, s * 5],
        explode: [0, 0, s * 0.3],
        blockers: [skinFor(x, 3)],
        purpose:
          'A representative lower-deck unit-load container. Shape and loading arrangement are educational.',
      });
      b.part(`${id}.body`, 'Container shell', id, containerGeometry, 'aluminium', {
        move: [0, 0.5, s * 2],
      });
      b.part(`${id}.base`, 'Container base pallet', id, box(2.5, 0.09, 1.96), 'steel', {
        position: [0, 0.035, 0],
        move: [0, -0.3, s * 1],
      });
      b.part(`${id}.cover`, 'Cargo restraint face', id, box(0.035, 1.25, 1.65), 'insulation', {
        position: [-1.25, 0.82, 0],
        move: [-1, 0, 0],
        detail: 'fine',
      });
    }
  for (const z of [-1.8, -0.2, 0.2, 1.8])
    b.part(
      `aircraft.cargo.rail.${z}`,
      'Cargo roller rail',
      'aircraft.cargo',
      box(46, 0.055, 0.08),
      'steel',
      { position: [-2, 4.24, z], layer: 'interior', move: [0, 0.5, 0], detail: 'fine' },
    );
  buildCockpit(b);
}
function buildCockpit(b) {
  b.group('aircraft.cockpit', 'Flight deck', 'aircraft', {
    position: [-1.2, 0, 0],
    blockers: [
      'aircraft.fuselage.skin.0.0',
      'aircraft.fuselage.skin.0.1',
      'aircraft.fuselage.skin.1.0',
      'aircraft.fuselage.skin.1.1',
    ],
    layer: 'interior',
    move: [-13, 3, 0],
    explode: [-10, 2, 0],
    purpose:
      'A representative flight deck. Selected controls operate the same model as the exterior mechanisms; other instruments are passive educational geometry.',
  });
  b.part(
    'aircraft.cockpit.floor',
    'Flight-deck floor',
    'aircraft.cockpit',
    box(4.9, 0.12, 4.15),
    'graphite',
    { position: [-29.2, 6.08, 0], layer: 'interior', move: [0, 2, 0], explode: [0, 0.2, 0] },
  );
  for (const [name, z] of [
    ['captain', 1],
    ['first-officer', -1],
  ]) {
    seat(b, `aircraft.cockpit.seat.${name}`, 'aircraft.cockpit', [-29.5, 6.15, z], true);
    b.tube(
      `aircraft.cockpit.column.${name}`,
      'Control column',
      'aircraft.cockpit',
      [-30.3, 6.12, z],
      [-30.6, 6.87, z],
      0.055,
      'graphite',
      { move: [0, 0.7, 0], explode: [-0.3, 0.2, 0], operation: 'pitch' },
    );
    b.part(
      `aircraft.cockpit.yoke.${name}`,
      'Control yoke',
      'aircraft.cockpit',
      torus(0.19, 0.023, Math.PI * 1.6)
        .clone()
        .rotateY(Math.PI / 2),
      'graphite',
      { position: [-30.61, 6.91, z], move: [0, 0.5, 0], operation: 'roll', detail: 'fine' },
    );
    for (const s of [-1, 1])
      b.part(
        `aircraft.cockpit.pedal.${name}.${s}`,
        'Rudder pedal',
        'aircraft.cockpit',
        box(0.12, 0.1, 0.2),
        'steel',
        {
          position: [-30.7, 6.24, z + s * 0.2],
          operation: 'rudder',
          move: [-0.3, 0.2, 0],
          detail: 'fine',
        },
      );
  }
  const panelGeometry = box(0.35, 0.88, 3.86, 0.1);
  panelGeometry.computeBoundingBox();
  const displayX = -31.4 + panelGeometry.boundingBox.max.x + 0.035;
  b.part(
    'aircraft.cockpit.panel',
    'Instrument panel',
    'aircraft.cockpit',
    panelGeometry,
    'graphite',
    { position: [-31.4, 6.86, 0], move: [-1, 1, 0], explode: [-0.5, 0.2, 0] },
  );
  b.part(
    'aircraft.cockpit.glareshield',
    'Glareshield',
    'aircraft.cockpit',
    box(0.76, 0.12, 4.03, 0.08),
    'graphite',
    { position: [-31.42, 7.32, 0], move: [0, 0.7, 0], explode: [0, 0.15, 0] },
  );
  for (let i = 0; i < 6; i++) {
    const id = `aircraft.cockpit.display.${i}`,
      z = -1.57 + i * 0.625;
    b.part(
      id,
      `Flight-deck display ${i + 1}`,
      'aircraft.cockpit',
      ovalPanel(0.54, 0.48, 0.025, 0.025),
      'screen',
      {
        position: [displayX, 6.88, z],
        rotation: [0, Math.PI / 2, 0],
        unique: true,
        move: [0.4, 0, 0],
        explode: [0.06, 0, 0],
        purpose:
          i === 2 || i === 3
            ? 'Live educational engine and mechanism indication driven by the aircraft model.'
            : 'Passive display representation; navigation and flight instrumentation are not simulated.',
      },
    );
    if (i === 2 || i === 3) b.r.get(id).displaySide = i === 2 ? 'left' : 'right';
  }
  b.part(
    'aircraft.cockpit.pedestal',
    'Center pedestal',
    'aircraft.cockpit',
    box(1.6, 0.55, 0.69),
    'graphite',
    { position: [-29.9, 6.37, 0], move: [0, 1, 0], explode: [0, 0.5, 0] },
  );
  for (const [name, z] of [
    ['left', 0.17],
    ['right', -0.17],
  ]) {
    const id = `aircraft.cockpit.thrust.${name}`;
    b.group(id, `${name} thrust lever`, 'aircraft.cockpit', {
      position: [-30.2, 6.7, z],
      operation: `engine:${name}`,
      move: [0, 0.6, 0],
      purpose:
        'Select Operate to start/stop this engine. Lever motion follows its throttle setting.',
    });
    b.part(`${id}.stem`, 'Thrust lever stem', id, box(0.045, 0.28, 0.045), 'steel', {
      position: [0, 0.14, 0],
      move: [0, 0.3, 0],
    });
    b.part(`${id}.grip`, 'Thrust lever grip', id, box(0.14, 0.08, 0.14), 'graphite', {
      position: [0, 0.3, 0],
      move: [0, 0.3, 0],
    });
    b.joint(id, `${name}Throttle`, [0, 0, 1], -0.62);
  }
  for (const [name, x, z] of [
    ['gear', -31.15, 0.52],
    ['flaps', -29.5, -0.46],
  ]) {
    b.part(
      `aircraft.cockpit.lever.${name}`,
      `${name} control lever`,
      'aircraft.cockpit',
      box(0.045, 0.22, 0.08),
      'steel',
      { position: [x, 6.93, z], operation: name, move: [0, 0.4, 0] },
    );
    b.joint(`aircraft.cockpit.lever.${name}`, name === 'gear' ? 'gear' : 'flaps', [0, 0, 1], 0.6);
  }
  b.part(
    'aircraft.cockpit.overhead',
    'Overhead control panel',
    'aircraft.cockpit',
    box(1.6, 0.1, 1.25),
    'graphite',
    { position: [-29.9, 8.08, 0], move: [0, 1.5, 0], explode: [0, 0.6, 0] },
  );
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 8; col++) {
      const id = `aircraft.cockpit.switch.${row}.${col}`,
        operation =
          row === 0 && col < 2
            ? `engine:${col === 0 ? 'left' : 'right'}`
            : row === 1 && col === 0
              ? 'lights'
              : null;
      b.part(
        id,
        operation ? `${operation} exhibit switch` : 'Overhead switch representation',
        'aircraft.cockpit',
        box(0.05, 0.065, 0.045),
        'cabinCream',
        {
          position: [-30.55 + row * 0.23, 7.99, -0.5 + col * 0.14],
          operation,
          move: [0, -0.25, 0],
          detail: 'fine',
          purpose: operation
            ? 'An exhibit control linked to the corresponding aircraft state.'
            : 'A passive switch representation. The corresponding real aircraft function is not simulated.',
        },
      );
    }
}
