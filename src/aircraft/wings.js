import * as THREE from 'three';
import { box, lathe } from '../scene/geometry.js';
import {
  wingVolume,
  wingStation,
  foilY,
  unitRib,
  verticalTail,
  horizontalTail,
} from './geometry.js';

export function buildWings(b) {
  b.group('aircraft.wings', 'Wings', 'aircraft', {
    supportRequired: true,
    purpose:
      'Swept airfoil wings with raked tips, structural wing boxes and individually modeled control surfaces.',
  });
  b.group('aircraft.wings.center', 'Center wing box', 'aircraft.wings', {
    layer: 'structure',
    supportRequired: true,
    move: [0, 3, 0],
    explode: [0, 1, 0],
    blockers: ['aircraft.wings.left', 'aircraft.wings.right'],
    purpose:
      'Representative center wing box joins the two wings through the fuselage. The cargo layout leaves this volume clear.',
  });
  b.part(
    'aircraft.wings.center.box',
    'Center wing box structure',
    'aircraft.wings.center',
    box(11.5, 1.1, 6.5),
    'skinInner',
    { position: [0, 4.9, 0], layer: 'structure', move: [0, 3, 0] },
  );
  b.part(
    'aircraft.wings.center.fairing',
    'Wing-body fairing',
    'aircraft.wings',
    lathe(
      [
        [-12, 0.03],
        [-9, 1.9],
        [-6, 3.4],
        [5, 3.4],
        [11, 1.8],
        [15, 0.03],
      ],
      72,
    ),
    'paint',
    {
      position: [0, 5.5, 0],
      scale: [1, 0.58, 1],
      layer: 'skin',
      cutaway: true,
      move: [0, -2.5, 0],
      explode: [0, -1, 0],
      purpose:
        'Streamlined wing-body fairing closes the root transition. Its profile is educational.',
    },
  );
  for (const [name, s] of [
    ['left', 1],
    ['right', -1],
  ]) {
    const id = `aircraft.wings.${name}`;
    b.group(id, `${name === 'left' ? 'Left' : 'Right'} wing`, 'aircraft.wings', {
      move: [0, 3, s * 20],
      explode: [0, 2, s * 11],
      supportRequired: true,
      blockers: [`aircraft.engines.${name}`],
      purpose:
        'A swept, tapered wing with a raked tip. Spars and ribs support the skin and moving lifting surfaces.',
      relationship: `Attached at the ${name} wing root. The corresponding engine must be clear before individual wing removal.`,
    });
    b.group(`${id}.structure`, 'Wing box structure', id, {
      layer: 'structure',
      move: [0, 3, s * 4],
    });
    const spans = [3, 10, 18, 25, 29.3, 32.4];
    for (let i = 0; i < spans.length - 2; i++)
      for (const face of [1, -1]) {
        b.part(
          `${id}.skin.${i}.${face}`,
          `${face === 1 ? 'Upper' : 'Lower'} wing skin ${i + 1}`,
          id,
          wingVolume(spans[i], spans[i + 1], 0.13, 0.72, s, face),
          'paint',
          {
            layer: 'skin',
            cutaway: s === 1 && face === 1,
            move: [0, face * 3, s * 0.6],
            explode: [0, face * 2.4, s * 0.35],
            purpose:
              'Contoured wing skin forms the lifting surface and closes the wing box. The upper near-side sections lift away in sectional mode.',
          },
        );
      }
    for (let i = 0; i < 30; i++) {
      const z = 3.4 + i * 0.86,
        st = wingStation(z),
        p = [st.x, st.y, s * z];
      b.part(`${id}.rib.${i + 1}`, `Wing rib ${i + 1}`, `${id}.structure`, unitRib(), 'aluminium', {
        position: p,
        scale: [st.chord, st.chord, 1],
        layer: 'structure',
        move: [0, 2, s * 1.1],
        explode: [0, 0.1, s * 0.12],
        blockers: [
          `${id}.skin.${Math.min(
            4,
            spans.findIndex((n, k) => z >= n && z <= spans[k + 1]),
          )}.1`,
        ],
        purpose:
          'Airfoil-shaped structural rib with lightening apertures. Cross-section and spacing are educational approximations.',
      });
    }
    for (const [label, u] of [
      ['front', 0.22],
      ['rear', 0.63],
    ])
      for (let i = 0; i < spans.length - 2; i++) {
        const a = wingStation(spans[i]),
          c = wingStation(spans[i + 1]);
        b.beam(
          `${id}.spar.${label}.${i}`,
          `${label} spar segment`,
          `${id}.structure`,
          [a.x + u * a.chord, a.y, s * spans[i]],
          [c.x + u * c.chord, c.y, s * spans[i + 1]],
          0.12,
          0.48,
          'aluminium',
          {
            layer: 'structure',
            move: [0, 2, s * 0.6],
            explode: [0, 0.15, 0],
            blockers: [`${id}.skin.${i}.1`],
          },
        );
      }
    // Slat segments have real airfoil volume and shift ahead of the leading edge.
    const slatSpans = [3, 7, 11, 15, 19, 23, 27, 29.3];
    for (let i = 0; i < slatSpans.length - 1; i++) {
      const za = slatSpans[i],
        zb = slatSpans[i + 1],
        st = wingStation((za + zb) / 2),
        pivot = [st.x + 0.13 * st.chord, st.y, (s * (za + zb)) / 2],
        pid = `${id}.slat.${i + 1}`;
      b.part(
        pid,
        `Leading-edge slat ${i + 1}`,
        id,
        wingVolume(za + 0.015, zb - 0.015, 0, 0.13, s, null, pivot),
        'paint',
        {
          position: pivot,
          move: [-2, 0.5, s * 0.4],
          explode: [-1, 0, 0],
          operation: 'flaps',
          purpose:
            'A leading-edge device moves forward and down when the flap setting increases. Segment geometry and schedule are illustrative.',
        },
      );
      b.joint(pid, 'slats', [0, 0, 1], 0.17, [-0.62, -0.18, 0]);
      b.tube(
        `${pid}.guide`,
        'Slat guide representation',
        pid,
        [-0.1, -0.08, -s * 0.3],
        [0.35, -0.08, s * 0.3],
        0.035,
        'steel',
        { move: [-0.5, 0, 0.2] },
      );
    }
    for (const c of [
      {
        name: 'inboard-flap',
        label: 'Inboard trailing-edge flap',
        a: 3.05,
        z: 10.6,
        channel: 'flaps',
        angle: -0.52,
      },
      { name: 'flaperon', label: 'Flaperon', a: 10.65, z: 13.3, channel: 'flaperon', angle: -0.35 },
      {
        name: 'outboard-flap',
        label: 'Outboard trailing-edge flap',
        a: 13.35,
        z: 24,
        channel: 'flaps',
        angle: -0.52,
      },
      {
        name: 'aileron',
        label: 'Outboard aileron',
        a: 24.05,
        z: 29.3,
        channel: 'roll',
        angle: s * 0.32,
      },
    ]) {
      const st = wingStation((c.a + c.z) / 2),
        pivot = [st.x + 0.72 * st.chord, st.y, (s * (c.a + c.z)) / 2],
        pid = `${id}.${c.name}`;
      b.part(pid, c.label, id, wingVolume(c.a, c.z, 0.72, 1, s, null, pivot), 'paint', {
        position: pivot,
        move: [3, -0.8, s * 0.8],
        explode: [1.5, -0.25, 0],
        operation: c.channel === 'roll' ? 'roll' : 'flaps',
        purpose: `${c.label} changes the wing's aerodynamic shape. Hinge, translation and actuator motion follow the shared exhibit model.`,
      });
      b.joint(
        pid,
        c.channel,
        [
          wingStation(c.z).x +
            0.72 * wingStation(c.z).chord -
            wingStation(c.a).x -
            0.72 * wingStation(c.a).chord,
          wingStation(c.z).y - wingStation(c.a).y,
          s * (c.z - c.a),
        ],
        c.angle * s,
        c.channel === 'flaps' ? [0.9, -0.22, 0] : [0, 0, 0],
      );
      for (const frac of [0.2, 0.8]) {
        const z = THREE.MathUtils.lerp(c.a, c.z, frac),
          ws = wingStation(z),
          local = [ws.x + 0.73 * ws.chord - pivot[0], ws.y - 0.1 - pivot[1], s * z - pivot[2]];
        b.part(
          `${pid}.hinge.${frac}`,
          'Control-surface hinge fitting',
          pid,
          box(0.24, 0.18, 0.14),
          'steel',
          { position: local, move: [0, -0.4, 0], explode: [0, -0.06, 0] },
        );
      }
    }
    for (let i = 0; i < 7; i++) {
      const za = 4 + i * 2.85,
        zb = za + 2.35,
        st = wingStation((za + zb) / 2),
        pivot = [st.x + 0.56 * st.chord, st.y + foilY(0.56, st.chord) + 0.024, (s * (za + zb)) / 2],
        pid = `${id}.spoiler.${i + 1}`;
      const g = wingVolume(za, zb, 0.56, 0.72, s, 1, pivot);
      b.part(pid, `Spoiler panel ${i + 1}`, id, g, 'paint', {
        position: pivot,
        move: [0, 1.2, 0],
        explode: [0, 0.6, 0],
        operation: 'spoilers',
        purpose:
          'An upper-wing panel raises into the airflow to reduce lift. Panel count and actuation detail are an educational representation.',
      });
      b.joint(pid, 'spoilers', [0, 0, 1], 0.94, [0, 0.03, 0]);
    }
    for (const z of [5.7, 9.2, 16.2, 21.4]) {
      const st = wingStation(z);
      b.part(
        `${id}.fairing.${z}`,
        'Flap-track fairing',
        id,
        lathe(
          [
            [-0.9, 0.015],
            [-0.5, 0.18],
            [0.8, 0.19],
            [2.15, 0.045],
            [2.5, 0.006],
          ],
          44,
        ),
        'paint',
        {
          position: [st.x + 0.78 * st.chord, st.y - 0.45, s * z],
          move: [0.6, -1, 0],
          explode: [0, -0.5, 0],
          purpose:
            'A streamlined fairing encloses the representative flap track and attachment mechanism.',
        },
      );
      const flapId = `${id}.${z < 10.6 ? 'inboard-flap' : 'outboard-flap'}`,
        flap = b.r.get(flapId);
      const end = new THREE.Vector3(st.x + 0.82 * st.chord, st.y - 0.18, s * z)
        .sub(flap.mount.position)
        .toArray();
      b.linkage(
        `${id}.actuator.${z}`,
        'Flap actuator',
        id,
        { part: id, point: [st.x + 0.58 * st.chord, st.y - 0.3, s * z] },
        { part: flapId, point: end },
        { blockers: [`${id}.fairing.${z}`] },
      );
    }
    b.part(`${id}.raked-tip`, 'Raked wingtip', id, wingVolume(29.3, 32.4, 0, 1, s), 'paint', {
      move: [2, 1, s * 5],
      explode: [1, 0, s * 1],
      purpose: 'The 777–300ER uses a swept, extended raked tip rather than an upright winglet.',
    });
    b.part(
      `${id}.nav-light`,
      'Wingtip navigation lamp',
      `${id}.raked-tip`,
      box(0.18, 0.08, 0.13),
      'lamp',
      { position: [15.05, 6.43, s * 32.35], move: [0, 0.2, s * 0.3], detail: 'fine' },
    );
  }
  buildTail(b);
}
function buildTail(b) {
  b.group('aircraft.tail', 'Empennage', 'aircraft', {
    move: [9, 5, 0],
    explode: [8, 2, 0],
    supportRequired: true,
    purpose: 'Vertical and horizontal tail surfaces provide directional and longitudinal control.',
  });
  b.part(
    'aircraft.tail.fin',
    'Vertical stabilizer',
    'aircraft.tail',
    verticalTail(0, 11.75, 0, 0.72),
    'paint',
    { move: [0, 9, 0], explode: [0, 3, 0] },
  );
  const pivot = [30.564, 6.75, 0];
  b.part(
    'aircraft.tail.rudder',
    'Rudder',
    'aircraft.tail',
    verticalTail(0, 11.75, 0.72, 1, pivot),
    'paint',
    {
      position: pivot,
      move: [5, 0, 0],
      explode: [2, 0, 0],
      operation: 'rudder',
      purpose: 'The rudder deflects about a vertical hinge to demonstrate yaw control.',
    },
  );
  b.joint('aircraft.tail.rudder', 'rudder', [5.388, 11.75, 0], 0.4);
  for (const [name, s] of [
    ['left', 1],
    ['right', -1],
  ]) {
    b.part(
      `aircraft.tail.${name}.stabilizer`,
      `${name} horizontal stabilizer`,
      'aircraft.tail',
      horizontalTail(s, 0, 0.67),
      'paint',
      { move: [2, 2, s * 8], explode: [1, 1, s * 5] },
    );
    const p = [29.195, 8.4, s * 1.3];
    b.part(
      `aircraft.tail.${name}.elevator`,
      `${name} elevator`,
      'aircraft.tail',
      horizontalTail(s, 0.67, 1, p),
      'paint',
      {
        position: p,
        move: [4, 0, s * 3],
        explode: [2, 0, s * 1],
        operation: 'pitch',
        purpose:
          'The elevator rotates about its trailing-edge hinge. Both sides use the same pitch command.',
      },
    );
    b.joint(`aircraft.tail.${name}.elevator`, 'pitch', [5.047, 0.6, s * 9.55], s * 0.35);
  }
}
