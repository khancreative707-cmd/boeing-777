import * as THREE from 'three';
import { box, cylinder, torus } from '../scene/geometry.js';

const tire = torus(0.48, 0.16)
  .clone()
  .rotateY(Math.PI / 2);
const noseTire = torus(0.385, 0.135)
  .clone()
  .rotateY(Math.PI / 2);
const hub = cylinder(0.36, 0.28, 32)
  .clone()
  .rotateY(Math.PI / 2);
const noseHub = cylinder(0.29, 0.23, 28)
  .clone()
  .rotateY(Math.PI / 2);
export function buildLandingGear(b) {
  b.group('aircraft.gear', 'Landing gear', 'aircraft', {
    supportRequired: true,
    purpose:
      'Twin-wheel nose gear and two six-wheel main landing-gear trucks. Retraction uses a sequenced educational model.',
  });
  for (const [name, s] of [
    ['left', 1],
    ['right', -1],
    ['nose', 0],
  ]) {
    const nose = name === 'nose',
      id = `aircraft.gear.${name}`,
      position = nose ? [-24.6, 4.3, 0] : [3.8, 4.9, s * 4.1];
    b.group(
      id,
      `${nose ? 'Nose' : name === 'left' ? 'Left main' : 'Right main'} landing gear`,
      'aircraft.gear',
      {
        position,
        move: [nose ? -3 : 2, -1, nose ? 4 : s * 8],
        explode: [nose ? -3 : 2, -0.4, nose ? 3 : s * 7],
        supportRequired: true,
        operation: 'gear',
        purpose: nose
          ? 'A steerable twin-wheel nose assembly.'
          : 'A six-wheel main-gear truck with strut, braces and actuator representations.',
        relationship:
          'Mounted at the gear bay. Maintenance supports must engage before retraction or removal.',
      },
    );
    b.group(`${id}.leg`, 'Retracting leg assembly', id, {
      supportRequired: true,
      move: [0, -2, nose ? 3 : s * 3],
      explode: [0, -0.6, 0],
      operation: 'gear',
    });
    b.joint(`${id}.leg`, 'gear', nose ? [0, 0, 1] : [1, 0, 0], nose ? -1.43 : s * 1.43);
    const leg = `${id}.leg`,
      truckY = nose ? -3.78 : -3.7;
    b.tube(
      `${leg}.barrel`,
      'Shock strut barrel',
      leg,
      [0, 0, 0],
      [0, -2.05, 0],
      nose ? 0.14 : 0.22,
      'steel',
      { move: [0, -1, 1], explode: [0, -0.1, 0] },
    );
    b.tube(
      `${leg}.piston`,
      'Polished oleo piston',
      leg,
      [0, -1.7, 0],
      [0, truckY + 0.35, 0],
      nose ? 0.095 : 0.14,
      'aluminium',
      { move: [0, -1.8, 0], explode: [0, -0.35, 0] },
    );
    b.part(
      `${leg}.collar`,
      'Strut collar',
      leg,
      cylinder(nose ? 0.19 : 0.28, 0.18, 32)
        .clone()
        .rotateZ(Math.PI / 2),
      'steel',
      { position: [0, -1.95, 0], move: [0, -0.6, 0], explode: [0, -0.1, 0] },
    );
    for (const s2 of [-1, 1]) {
      b.tube(
        `${leg}.brace.${s2}`,
        'Folding side brace',
        leg,
        [0.5, -0.1, s2 * 0.35],
        [0.2, truckY * 0.7, s2 * 0.2],
        0.065,
        'steel',
        { move: [0.5, -0.5, s2 * 0.5], explode: [0, 0, s2 * 0.12] },
      );
      b.beam(
        `${leg}.torque-link.${s2}`,
        'Torque-link arm',
        leg,
        [0.12, -1.7, s2 * 0.14],
        [0.42, -2.25, s2 * 0.14],
        0.09,
        0.055,
        'steel',
        { move: [0.3, 0, s2 * 0.4], explode: [0.1, 0, s2 * 0.05] },
      );
    }
    b.linkage(
      `${id}.actuator`,
      'Retraction actuator',
      id,
      { part: id, point: [0.65, 0.15, 0.1] },
      { part: leg, point: [0.25, -1.35, 0.1] },
    );
    const truck = `${leg}.truck`;
    b.group(truck, nose ? 'Nose wheel fork' : 'Six-wheel bogie', leg, {
      supportRequired: true,
      position: [0, truckY, 0],
      move: [0, -1.2, 0],
      explode: [0, -0.4, 0],
    });
    if (!nose) b.joint(truck, 'truckTilt', [0, 0, 1], 0.28);
    b.part(
      `${truck}.beam`,
      nose ? 'Nose wheel axle' : 'Bogie beam',
      truck,
      box(nose ? 0.42 : 3.0, 0.23, nose ? 0.9 : 0.38),
      'steel',
      { move: [0, -0.5, 0], explode: [0, -0.1, 0] },
    );
    let wheel = 0;
    for (const x of nose ? [0] : [-1.15, 0, 1.15])
      for (const side of [-1, 1]) {
        wheel++;
        const wid = `${truck}.wheel.${wheel}`,
          z = side * (nose ? 0.35 : 0.65),
          y = nose ? 0 : -0.55;
        b.group(wid, `${nose ? 'Nose' : 'Main'} wheel ${wheel}`, truck, {
          position: [x, y, z],
          move: [0, 0, side * 1.5],
          explode: [0, 0, side * 0.35],
          purpose:
            'Tire, hub and brake representations are individually selectable. Exact brake internals are educational.',
        });
        b.part(`${wid}.tire`, 'Landing-gear tire', wid, nose ? noseTire : tire, 'rubber', {
          move: [0, 0, side * 0.8],
          explode: [0, 0, side * 0.1],
        });
        b.part(`${wid}.hub`, 'Wheel hub', wid, nose ? noseHub : hub, 'aluminium', {
          move: [0, 0, side * 0.7],
          explode: [0, 0, side * 0.06],
        });
        b.part(
          `${wid}.axle`,
          'Wheel axle end',
          wid,
          cylinder(nose ? 0.065 : 0.09, 0.35, 24)
            .clone()
            .rotateY(Math.PI / 2),
          'steel',
          { move: [0, 0, side * 0.7] },
        );
        if (!nose)
          b.part(
            `${wid}.brake`,
            'Brake-disc representation',
            wid,
            cylinder(0.3, 0.09, 28)
              .clone()
              .rotateY(Math.PI / 2),
            'graphite',
            {
              position: [0, 0, -side * 0.16],
              move: [0, 0, side * 0.5],
              explode: [0, 0, -side * 0.03],
            },
          );
        for (let bolt = 0; bolt < 8; bolt++) {
          const a = (bolt * Math.PI) / 4;
          b.part(
            `${wid}.bolt.${bolt}`,
            'Hub retaining bolt',
            wid,
            cylinder(0.026, 0.045, 6)
              .clone()
              .rotateY(Math.PI / 2),
            'steel',
            {
              position: [
                Math.cos(a) * (nose ? 0.18 : 0.24),
                Math.sin(a) * (nose ? 0.18 : 0.24),
                side * 0.17,
              ],
              move: [0, 0, side * 0.25],
              detail: 'fine',
            },
          );
        }
      }
    for (const side of [-1, 1]) {
      const door = `${id}.door.${side}`,
        p = [nose ? -0.65 : -0.25, -0.1, side * (nose ? 0.6 : 1.25)];
      b.part(door, 'Gear-bay door', id, box(nose ? 2.4 : 3.8, 0.06, nose ? 0.52 : 0.95), 'paint', {
        position: p,
        move: [0, -1, side * 2],
        explode: [0, 0, side * 1.1],
        operation: 'gear',
        purpose:
          'Gear doors open before the leg moves and close after it reaches the requested position.',
      });
      b.joint(door, 'gearDoors', [1, 0, 0], side * 1.42, [0, -0.05, 0]);
      b.part(
        `${id}.baywall.${side}`,
        'Gear-bay side wall',
        id,
        box(nose ? 2.4 : 3.8, 0.55, 0.04),
        'skinInner',
        {
          position: [nose ? -0.65 : -0.25, 0.22, side * (nose ? 0.85 : 1.75)],
          layer: 'structure',
          move: [0, 1, side],
          explode: [0, 0.25, side * 0.2],
        },
      );
    }
  }
  buildSupports(b);
}
function buildSupports(b) {
  b.group('aircraft.supports', 'Maintenance supports', 'aircraft', {
    required: false,
    displaySupport: true,
    purpose:
      'Display support jacks engage before operating or removing load-bearing gear. They are educational support hardware, not a maintenance specification.',
  });
  for (const [name, x, z, height] of [
    ['nose', -21.5, 0, 3.35],
    ['left', 2, 6.5, 4.5],
    ['right', 2, -6.5, 4.5],
  ]) {
    const id = `aircraft.supports.${name}`;
    b.group(id, `${name} maintenance jack`, 'aircraft.supports', {
      position: [x, 0, z],
      required: false,
      displaySupport: true,
      move: [0, 0, 3],
    });
    b.part(`${id}.base`, 'Jack base', id, box(1.3, 0.16, 1.1), 'stand', {
      position: [0, 0.1, 0],
      required: false,
      move: [0, 0, 1],
    });
    b.part(
      `${id}.barrel`,
      'Jack cylinder',
      id,
      cylinder(0.16, height * 0.55, 28)
        .clone()
        .rotateZ(Math.PI / 2),
      'stand',
      { position: [0, height * 0.275 + 0.17, 0], required: false, move: [0, 0.3, 0] },
    );
    b.part(
      `${id}.rod`,
      'Telescoping jack rod',
      id,
      cylinder(0.09, height * 0.55, 24)
        .clone()
        .rotateZ(Math.PI / 2),
      'aluminium',
      { position: [0, height * 0.6, 0], required: false, move: [0, 0.5, 0] },
    );
    b.joint(`${id}.rod`, 'supports', [0, 1, 0], 0, [0, height * 0.125, 0]);
    b.part(`${id}.pad`, 'Jack contact pad', id, box(0.55, 0.1, 0.5), 'rubber', {
      position: [0, height - 0.04, 0],
      required: false,
      move: [0, 0.5, 0],
    });
    for (const s of [-1, 1])
      b.tube(
        `${id}.brace.${s}`,
        'Jack base brace',
        id,
        [s * 0.55, 0.18, s * 0.35],
        [0, height * 0.4, 0],
        0.04,
        'stand',
        { required: false, move: [s * 0.5, 0, s * 0.5] },
      );
  }
}
