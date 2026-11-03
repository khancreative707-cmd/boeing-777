import * as THREE from 'three';
import { box, torus, cylinder } from '../scene/geometry.js';
import {
  hullPatch,
  fuselageProfile,
  ovalPanel,
  windowRing,
  polygonSolid,
  frameArc,
  curvedBodyPanel,
} from './geometry.js';

export const BODY_BAYS = [-36.93, -30, -23, -15, -7, 1, 9, 17, 25, 31, 36.93];
export function skinFor(x, quadrant = 0) {
  let bay = 0;
  while (bay < BODY_BAYS.length - 2 && x > BODY_BAYS[bay + 1]) bay++;
  return `aircraft.fuselage.skin.${bay}.${quadrant}`;
}
export function buildFuselage(b) {
  b.group('aircraft.fuselage', 'Fuselage', 'aircraft', {
    purpose:
      'A pressure-shell representation containing frames, floor beams and passenger and cargo compartments.',
    relationship: 'Wing, tail and cabin assemblies attach to the fuselage.',
    move: [0, 13, 0],
    explode: [0, 1, 0],
    supportRequired: true,
    blockers: ['aircraft.wings.left', 'aircraft.wings.right', 'aircraft.tail'],
  });
  b.group('aircraft.fuselage.structure', 'Frames and longitudinal structure', 'aircraft.fuselage', {
    layer: 'structure',
    move: [0, 8, 0],
    explode: [0, 1, 0],
  });
  for (let i = 0; i < BODY_BAYS.length - 1; i++)
    for (let q = 0; q < 4; q++) {
      const x0 = BODY_BAYS[i],
        x1 = BODY_BAYS[i + 1],
        a = (q * Math.PI) / 2,
        mid = a + Math.PI / 4;
      b.part(
        `aircraft.fuselage.skin.${i}.${q}`,
        `Fuselage skin · bay ${i + 1} ${['upper near', 'upper far', 'lower far', 'lower near'][q]}`,
        'aircraft.fuselage',
        hullPatch(x0, x1, a + 0.001, Math.PI / 2 - 0.002),
        'paint',
        {
          layer: 'skin',
          cutaway: q === 0 || q === 3,
          move: [0, Math.sin(mid) * 5, Math.cos(mid) * 6],
          explode: [0, Math.sin(mid) * 5.5, Math.cos(mid) * 6],
          purpose:
            'Removable educational shell section exposes the structure and interior. Seated panel joints preserve the continuous pressure-body profile.',
          relationship: 'Mounted to circumferential frames and longitudinal structure.',
        },
      );
    }
  for (let i = 0; i < 65; i++) {
    const x = -29 + i * 0.86,
      p = fuselageProfile(x),
      radius = p.r - 0.13;
    if (radius < 0.3) continue;
    const id = `aircraft.fuselage.frame.${i + 1}`;
    b.group(id, `Fuselage frame ${i + 1}`, 'aircraft.fuselage.structure', {
      position: [x, p.y, 0],
      layer: 'structure',
      blockers: [skinFor(x)],
      move: [0, 1.5, 4],
      explode: [0, 0, 0.18],
      purpose:
        'Circumferential frame represented as connected inspection segments. Section size and splice detail are educational.',
    });
    for (let q = 0; q < 4; q++)
      b.part(
        `${id}.arc.${q}`,
        `Frame inspection segment ${q + 1}`,
        id,
        frameArc(radius, 0.045),
        'aluminium',
        {
          rotation: [(q * Math.PI) / 2, 0, 0],
          layer: 'structure',
          cutaway: q === 1 || q === 2,
          move: [0, Math.sin(((q + 0.5) * Math.PI) / 2), -Math.cos(((q + 0.5) * Math.PI) / 2)],
          explode: [0, 0, 0.025],
          blockers: [skinFor(x, q === 1 || q === 2 ? 0 : 1)],
        },
      );
  }
  for (let j = 0; j < 14; j++) {
    const a = (j * Math.PI * 2) / 14;
    for (let bay = 1; bay < 8; bay++) {
      const x0 = BODY_BAYS[bay],
        x1 = BODY_BAYS[bay + 1],
        p0 = fuselageProfile(x0),
        p1 = fuselageProfile(x1);
      b.beam(
        `aircraft.fuselage.stringer.${j}.${bay}`,
        'Longitudinal stringer',
        'aircraft.fuselage.structure',
        [x0, p0.y + (p0.r - 0.1) * Math.sin(a), (p0.r - 0.1) * Math.cos(a)],
        [x1, p1.y + (p1.r - 0.1) * Math.sin(a), (p1.r - 0.1) * Math.cos(a)],
        0.045,
        0.065,
        'aluminium',
        {
          layer: 'structure',
          cutaway: Math.cos(a) > 0,
          blockers: [skinFor((x0 + x1) / 2)],
          move: [0, Math.sin(a), Math.cos(a) * 2],
        },
      );
    }
  }
  for (const [name, x, r, y] of [
    ['forward', -35, fuselageProfile(-35).r - 0.1, fuselageProfile(-35).y],
    ['aft', 27, 2.16, 6.65],
  ]) {
    b.part(
      `aircraft.fuselage.bulkhead.${name}`,
      `${name} pressure bulkhead`,
      'aircraft.fuselage.structure',
      cylinder(r, 0.12, 64),
      'skinInner',
      {
        position: [x, y, 0],
        layer: 'structure',
        blockers: [skinFor(x)],
        move: [name === 'forward' ? -5 : 5, 0, 0],
        explode: [name === 'forward' ? -0.5 : 0.5, 0, 0],
      },
    );
  }
  // Repeated glazing follows its actual shell sector, including removal and visibility.
  for (const s of [-1, 1])
    for (let i = 0; i < 83; i++) {
      const x = -26.9 + i * 0.64;
      if ([-26.1, -15.0, -2.0, 10.4, 23.7].some((v) => Math.abs(x - v) < 0.7)) continue;
      const p = fuselageProfile(x);
      if (p.r < 2.6) continue;
      const h = 1.0,
        z = s * Math.sqrt(p.r * p.r - h * h),
        parent = skinFor(x, s === 1 ? 0 : 1),
        y = p.y + h;
      const id = `aircraft.fuselage.window.${s === 1 ? 'left' : 'right'}.${i + 1}`;
      b.part(
        id,
        'Passenger window glazing',
        parent,
        ovalPanel(0.32, 0.47, 0.025, 0.12),
        'glazing',
        {
          position: [x, y, z],
          rotation: [s === 1 ? -0.23 : 0.23, s === 1 ? 0 : Math.PI, 0],
          move: [0, 0.1, s * 0.7],
          explode: [0, 0, s * 0.03],
          purpose:
            'Passenger glazing representation. It follows its shell segment when the fuselage opens.',
        },
      );
      b.part(`${id}.rim`, 'Window surround', id, windowRing(0.37, 0.54), 'windowRim', {
        position: [0, 0, s === 1 ? 0.012 : -0.012],
        move: [0, 0, 0.15],
        explode: [0, 0, 0.018],
      });
    }
  // Glazing follows the compound nose surface rather than sitting inside the hull.
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const x0 = -34.55 + i * 1.02,
        x1 = x0 + 0.9;
      b.part(
        `aircraft.fuselage.windshield.${side}.${i}`,
        `Cockpit windshield ${i + 1}`,
        'aircraft.fuselage',
        curvedBodyPanel(x0, x1, 7.2 + (i === 0 ? 0.12 : 0), 7.88, side),
        'glazing',
        {
          layer: 'skin',
          cutaway: side === 1,
          move: [-0.7, 0.4, side * 0.7],
          purpose:
            'Windshield glazing follows the compound nose profile. Panel shape and framing are educational.',
        },
      );
    }
  buildDoors(b);
}
function buildDoors(b) {
  b.group('aircraft.doors', 'Passenger and cargo doors', 'aircraft', {
    layer: 'skin',
    move: [0, 5, 6],
    explode: [0, 0, 2],
    purpose:
      'Ten passenger-door representations and two cargo doors, each with a plug-clearance and opening sequence.',
  });
  for (const s of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const x = [-26.1, -15, -2, 10.4, 23.7][i],
        p = fuselageProfile(x),
        z = s * Math.sqrt(p.r * p.r - 0.79 * 0.79),
        id = `aircraft.doors.${s === 1 ? 'left' : 'right'}.${i + 1}`;
      b.group(id, `${s === 1 ? 'Left' : 'Right'} passenger door ${i + 1}`, 'aircraft.doors', {
        position: [x + 0.52, 7.04, z],
        layer: 'skin',
        cutaway: s === 1,
        move: [0, 0.5, s * 4],
        explode: [0, 0, s * 0.5],
        operation: 'doors',
        blockers: [skinFor(x, s === 1 ? 0 : 1)],
        purpose:
          'Door representation with a plug-clearance translation before outward rotation. Removal path is not a certified maintenance procedure.',
      });
      b.part(
        `${id}.leaf`,
        'Passenger door leaf',
        id,
        curvedBodyPanel(x - 0.51, x + 0.51, 6.075, 8.005, s, [x + 0.52, 7.04, z], 0.06),
        'paint',
        {
          move: [0, 0, s * 0.5],
        },
      );
      b.part(`${id}.window`, 'Door window', id, ovalPanel(0.26, 0.36, 0.03, 0.1), 'glazing', {
        position: [-0.52, 0.43, s * Math.sqrt((p.r + 0.04) ** 2 - (7.47 - p.y) ** 2) - z],
        move: [0, 0, s * 0.4],
      });
      b.part(`${id}.handle`, 'Door operating handle', id, box(0.28, 0.045, 0.06, 0.015), 'steel', {
        position: [-0.8, -0.15, s * 0.07],
        move: [0, 0, s * 0.3],
      });
      b.part(`${id}.sill`, 'Door sill', 'aircraft.doors', box(1.12, 0.055, 0.2), 'aluminium', {
        position: [x, 6.05, z - s * 0.12],
        layer: 'skin',
        cutaway: s === 1,
        blockers: [skinFor(x, s === 1 ? 0 : 1)],
        move: [0, -0.3, s * 0.2],
      });
      b.joint(id, 'doors', [0, 1, 0], s * 1.48, [0.32, 0, s * 0.9]);
    }
  for (const [n, x] of [
    ['forward', -17.2],
    ['aft', 17.7],
  ]) {
    const id = `aircraft.doors.cargo.${n}`;
    b.group(id, `${n} cargo door`, 'aircraft.doors', {
      position: [x, 5.82, 3.09],
      cutaway: true,
      layer: 'skin',
      move: [0, 2, 4],
      explode: [0, 1, 2],
      operation: 'cargo',
      blockers: [skinFor(x, 3)],
      purpose: 'Cargo access-door representation. Its upward hinge reveals the lower cargo deck.',
    });
    b.part(
      `${id}.leaf`,
      'Cargo door panel',
      id,
      curvedBodyPanel(x - 1.4, x + 1.4, 4.2, 5.8, 1, [x, 5.82, 3.09], 0.065),
      'paint',
      {
        move: [0, 1, 1],
      },
    );
    b.joint(id, 'cargo', [1, 0, 0], -1.7, [0, 0.05, 0.18]);
  }
}
