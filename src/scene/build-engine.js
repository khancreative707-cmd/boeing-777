import * as THREE from 'three';
import { ComponentRegistry } from '../engine/registry.js';
import { GE90, MODULES, TAU } from '../engine/constants.js';
import {
  airfoil,
  leadingEdge,
  lathe,
  shell,
  cylinder,
  torus,
  box,
  pipe,
  between,
} from './geometry.js';

export function buildEngine(materials) {
  const registry = new ComponentRegistry();
  const root = registry.add({
    id: 'ge90',
    name: 'GE90–115B',
    kind: 'root',
    position: [0, 2.12, 0],
    purpose: 'A high-bypass, two-spool turbofan developed for the Boeing 777–300ER.',
    relationship: '22 fan blades · 4 booster stages · 9 HPC stages · 2 HPT stages · 6 LPT stages.',
    material: 'Multi-material engine assembly',
  });
  const casingParts = [];
  for (const m of MODULES)
    registry.add({
      ...m,
      parent: 'ge90',
      kind: 'assembly',
      explode: m.move,
      move: m.id === 'fan' ? [-2.9, 0, 0] : m.move,
      material: m.material,
    });
  const part = (id, name, parent, geometry, material = 'titanium', options = {}) => {
    const entry = registry.add({ id, name, parent, material, ...options });
    registry.mesh(id, geometry, materials[material]);
    return entry;
  };
  const group = (id, name, parent, options = {}) =>
    registry.add({ id, name, parent, kind: 'assembly', ...options });
  const ring = (id, parent, x, r, tube = 0.016, material = 'steel', options = {}) =>
    part(id, options.name || 'Machined retaining ring', parent, torus(r, tube), material, {
      position: [x, 0, 0],
      ...options,
    });
  const radial = (angle, r, x = 0) => [x, r * Math.cos(angle), r * Math.sin(angle)];
  function bolts(parent, prefix, x, r, count = 32, size = 0.017, phase = 0) {
    registry.batch(
      parent,
      cylinder(size, 0.018, 6),
      materials.steel,
      Array.from({ length: count }, (_, i) => ({
        id: `${prefix}.${i + 1}`,
        name: `Flange fastener ${String(i + 1).padStart(2, '0')}`,
        material: 'steel',
        position: radial((i / count) * TAU + phase, r, x),
        move: [
          -0.25,
          Math.cos((i / count) * TAU + phase) * 0.15,
          Math.sin((i / count) * TAU + phase) * 0.15,
        ],
        explode: [-0.045, 0, 0],
        detail: 'fine',
        kind: 'fastener',
        purpose: 'A representative flange fastener secures the mating case joint.',
        relationship:
          'Sits on the machined flange face; fastener dimensions and counts are illustrative.',
      })),
    );
  }
  function casing(parent, id, x0, x1, r0, r1, mat = 'graphite', opts = {}) {
    const container = group(id, opts.name || 'Split casing', parent, {
      purpose:
        'A split stationary shell contains the flow path and provides access to the rotor and stator rows.',
      material: mat,
      move: [0, 0, 0],
      splitCasing: true,
      ...opts,
    });
    for (let q = 0; q < 4; q++) {
      const a = ((q + 0.5) / 4) * TAU,
        dir = [0, -Math.sin(a), Math.cos(a)];
      const e = part(
        `${id}.q${q}`,
        ['Lower near case', 'Lower far case', 'Upper far case', 'Upper near case'][q],
        id,
        shell(x0, x1, r0, r1, 0.033, (q * TAU) / 4 + 0.004, TAU / 4 - 0.008),
        mat,
        {
          move: dir.map((v) => v * 2.0),
          explode: dir.map((v) => v * 0.8),
          cutaway: q === 3 || (parent === 'exterior' && id !== 'exterior.fan-case' && q === 0),
          kind: 'casing',
          ...opts.partOptions,
        },
      );
      casingParts.push(e.id);
      for (const [k, x, r] of [
        ['front', x0, r0],
        ['aft', x1, r1],
      ]) {
        const g = shell(
          x - 0.025,
          x + 0.025,
          r + 0.027,
          r + 0.027,
          0.06,
          (q * TAU) / 4 + 0.008,
          TAU / 4 - 0.016,
        );
        part(
          `${id}.q${q}.flange.${k}`,
          `${k === 'front' ? 'Forward' : 'Aft'} split flange`,
          e.id,
          g,
          'titanium',
          { move: dir.map((v) => v * 0.6), kind: 'flange' },
        );
      }
    }
    container.explode.set(0, 0, 0);
    if (['booster', 'hpc', 'combustor'].includes(parent)) {
      container.blockers = ['exterior.nacelle'];
      for (const id of container.children) registry.get(id).blockers = ['exterior.nacelle'];
    }
    return container;
  }
  // Axial module extraction keeps annular hardware clear of the concentric shafts.
  const removals = {
    fan: { move: [-2.9, 0, 0], blockers: [] },
    booster: { move: [-3.8, 0, 0], blockers: ['fan'] },
    hpc: { move: [-4.8, 0, 0], blockers: ['booster', 'fan'] },
    combustor: { move: [3.7, 0, 0], blockers: ['hpt', 'lpt'] },
    hpt: { move: [3.8, 0, 0], blockers: ['lpt'] },
    lpt: { move: [3.5, 0, 0], blockers: [] },
  };
  for (const [id, spec] of Object.entries(removals)) {
    const entry = registry.get(id);
    entry.move.fromArray(spec.move);
    entry.blockers = spec.blockers;
  }
  // Exterior follows a real annular flow path: an outer duct around the core.
  const lipProfile = Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * TAU;
    return [-2.43 + 0.13 * Math.sin(a), 1.72 + 0.075 * Math.cos(a)];
  });
  part('exterior.intake', 'Rounded intake lip', 'exterior', lathe(lipProfile, 160), 'aluminium', {
    move: [-1.6, 0, 0],
    explode: [-0.6, 0, 0],
    purpose: 'A rounded inlet lip guides air smoothly toward the fan.',
    relationship:
      'Surrounds the 128-inch fan. Its profile is an educational nacelle approximation.',
  });
  part(
    'exterior.acoustic',
    'Inlet acoustic liner',
    'exterior',
    shell(-2.4, -2.1, 1.67, 1.65, 0.022),
    'graphite',
    { move: [-1.3, 0, 0], explode: [-0.3, 0, 0] },
  );
  casing('exterior', 'exterior.fan-case', -2.1, -1.48, 1.69, 1.66, 'graphite', {
    name: 'Fan containment casing',
  });
  ring('exterior.front-rim', 'exterior', -2.12, 1.695, 0.027, 'titanium');
  ring('exterior.rear-rim', 'exterior', -1.47, 1.66, 0.025, 'titanium');
  bolts('exterior', 'exterior.fan-case-bolts', -2.13, 1.7, 64, 0.015);
  casing('exterior', 'exterior.nacelle', -1.43, 1.68, 1.65, 1.19, 'aluminium', {
    name: 'Nacelle / bypass duct',
  });
  casing('exterior', 'exterior.bypass-nozzle', 1.72, 2.25, 1.18, 1.04, 'titanium', {
    name: 'Separate bypass exhaust nozzle',
  });
  // Panel seams, flush fastener rows and service latches belong to their cowl segment.
  for (let q = 0; q < 4; q++) {
    const parent = `exterior.nacelle.q${q}`;
    for (const [k, x] of [
      [0, -0.65],
      [1, 0.5],
      [2, 1.25],
    ]) {
      const r = 1.65 + ((x + 1.43) / (1.68 + 1.43)) * (1.19 - 1.65);
      part(
        `${parent}.seam.${k}`,
        'Nacelle panel seam',
        parent,
        shell(
          x - 0.004,
          x + 0.004,
          r + 0.004,
          r + 0.004,
          0.012,
          (q * TAU) / 4 + 0.01,
          TAU / 4 - 0.02,
        ),
        'steel',
        { detail: 'fine' },
      );
    }
    const specs = [];
    for (let side = 0; side < 2; side++)
      for (let j = 0; j < 13; j++) {
        const x = -1.34 + j * 0.241,
          a = (q * TAU) / 4 + (side ? 0.038 : TAU / 4 - 0.038),
          r = 1.65 + ((x + 1.43) / 3.11) * (1.19 - 1.65) + 0.007;
        specs.push({
          id: `${parent}.bolt.${side}.${j}`,
          name: 'Flush nacelle seam fastener',
          position: [x, -r * Math.sin(a), r * Math.cos(a)],
          quaternion: new THREE.Quaternion()
            .setFromUnitVectors(
              new THREE.Vector3(1, 0, 0),
              new THREE.Vector3(0, -Math.sin(a), Math.cos(a)),
            )
            .toArray(),
          material: 'Steel',
          kind: 'fastener',
          detail: 'fine',
          move: [0, -Math.sin(a) * 0.2, Math.cos(a) * 0.2],
        });
      }
    registry.batch(parent, cylinder(0.011, 0.009, 6), materials.steel, specs);
    for (let j = 0; j < 3; j++) {
      const a = (q * TAU) / 4 + 0.08,
        x = -1 + j * 0.9,
        r = 1.65 + ((x + 1.43) / 3.11) * (1.19 - 1.65);
      part(`${parent}.latch.${j}`, 'Cowl latch assembly', parent, box(0.1, 0.025, 0.06), 'steel', {
        position: [x, -r * Math.sin(a), r * Math.cos(a)],
        rotation: [a, 0, 0],
        move: [0, -Math.sin(a) * 0.5, Math.cos(a) * 0.5],
        detail: 'fine',
      });
    }
  }
  // Separate quarter access panels, hinges, latches and external mounts.
  for (let side = 0; side < 2; side++) {
    const z = side ? 1 : -1;
    const panel = part(
      `exterior.panel.${side}`,
      `${side ? 'Starboard' : 'Port'} inspection hatch`,
      'exterior',
      box(0.42, 0.3, 0.025),
      'graphite',
      {
        position: [-0.83, 0.25, z * 1.55],
        move: [0, 0.2, z * 1.4],
        explode: [0, 0.3, z * 0.5],
        cutaway: side === 1,
        kind: 'panel',
      },
    );
    for (let i = 0; i < 4; i++)
      part(
        `${panel.id}.latch.${i}`,
        `Quarter-turn hatch latch ${i + 1}`,
        panel.id,
        cylinder(0.024, 0.015, 8),
        'steel',
        {
          position: [i < 2 ? -0.15 : 0.15, i % 2 ? -0.1 : 0.1, 0.025 * z],
          rotation: [0, Math.PI / 2, 0],
          move: [0, 0, z * 0.3],
          detail: 'fine',
        },
      );
  }
  for (const [i, x] of [
    [0, -0.75],
    [1, 2.18],
  ]) {
    part(
      `exterior.mount.${i}`,
      `${i ? 'Aft' : 'Forward'} engine mount`,
      'exterior',
      box(0.28, 0.34, 0.4),
      'steel',
      {
        position: [x, 0.95, 0],
        move: [0, 1.5, 0],
        explode: [0, 0.6, 0],
        purpose: 'Represents the structural interface between the engine and aircraft pylon.',
        relationship: 'Mount shape and load path are schematic, not manufacturing geometry.',
      },
    );
    for (let s = 0; s < 2; s++)
      part(
        `exterior.mount.${i}.lug.${s}`,
        'Clevis mount lug',
        `exterior.mount.${i}`,
        box(0.15, 0.2, 0.08),
        'titanium',
        { position: [0, 0.2, s ? 0.14 : -0.14] },
      );
  }
  // Fan rotor: all 22 blades have real thickness, sweep, twist and a root.
  const fanRotor = group('fan.rotor', 'Fan rotor · 22 blades', 'fan', {
    spool: 'LP',
    material: 'Carbon composite / titanium',
    move: [-2.8, 0, 0],
    purpose: MODULES[1].purpose,
  });
  registry.rotors.push({ id: fanRotor.id, spool: 'LP' });
  part(
    'fan.disk',
    'Fan disk',
    'fan.rotor',
    lathe(
      [
        [-0.11, 0.14],
        [-0.11, 0.42],
        [0, 0.46],
        [0.11, 0.42],
        [0.11, 0.14],
        [-0.11, 0.14],
      ],
      96,
    ),
    'titanium',
    {
      position: [-1.99, 0, 0],
      move: [-2, 0, 0],
      explode: [-0.1, 0, 0],
      blockers: ['fan.spinner'],
      purpose: 'The rotating disk carries each composite fan blade at its root.',
    },
  );
  const spinnerProfile = Array.from({ length: 41 }, (_, i) => {
    const angle = ((i / 40) * Math.PI) / 2;
    return [-2.7 + 0.69 * (1 - Math.cos(angle)), 0.435 * Math.sin(angle)];
  });
  spinnerProfile.push([-2.01, 0]);
  part('fan.spinner', 'Spinner', 'fan.rotor', lathe(spinnerProfile, 128), 'graphite', {
    move: [-1.7, 0, 0],
    explode: [-0.65, 0, 0],
    purpose: 'The spinner smoothly divides incoming air around the fan hub.',
    relationship:
      'Rotates with the fan disk on the low-pressure spool. Remove it to expose the forward blade retainers.',
  });
  const spiralPoints = Array.from({ length: 54 }, (_, i) => {
    const t = i / 53,
      r = 0.018 + 0.29 * t,
      a = 1.3 * TAU * t;
    const x = -2.7 + 0.69 * (1 - Math.sqrt(1 - (r / 0.435) ** 2)) - 0.004;
    return [x, r * Math.cos(a), r * Math.sin(a)];
  });
  part(
    'fan.spinner.spiral',
    'Spinner rotation-visibility marking',
    'fan.spinner',
    pipe(spiralPoints, 0.01),
    'ceramic',
    {
      move: [-0.2, 0, 0],
      purpose: 'A contrasting spiral helps observers recognize fan rotation.',
      relationship:
        'A surface marking carried by the spinner; included as an educational coating representation.',
    },
  );
  ring('fan.spinner.band', 'fan.spinner', -2.1, 0.424, 0.007, 'steel');
  bolts('fan.rotor', 'fan.retainer', -2.115, 0.425, 22, 0.012);
  const bladeOpts = {
    root: 0.445,
    tip: GE90.fanRadius - 0.006,
    chord: 0.52,
    twist: 1.1,
    sweep: 0.12,
    lean: 0.32,
    flare: true,
    twistSlope: 0.5,
    sShape: true,
    spanSteps: 26,
    sectionSteps: 20,
    thickness: 0.13,
  };
  const fanGeometry = airfoil(bladeOpts);
  registry.batch(
    'fan.disk',
    fanGeometry,
    materials.composite,
    Array.from({ length: GE90.fanBlades }, (_, i) => {
      const a = (i / GE90.fanBlades) * TAU;
      return {
        id: `fan.blade.${String(i + 1).padStart(2, '0')}`,
        name: `Swept fan blade ${String(i + 1).padStart(2, '0')}`,
        kind: 'blade',
        position: [-0.02, 0, 0],
        rotation: [a, 0, 0],
        material: 'Carbon composite',
        spool: 'LP',
        move: [-1.8, Math.cos(a) * 0.4, Math.sin(a) * 0.4],
        explode: [-0.08, Math.cos(a) * 0.18, Math.sin(a) * 0.18],
        extraction: 'axial-first',
        blockers: ['fan.spinner'],
        purpose:
          'One of 22 swept composite blades. It accelerates air into the bypass duct and core inlet.',
        relationship:
          'A root attachment locates this blade in the fan disk. All fan blades turn with the LP shaft.',
        reference: '22 composite blades; 128-inch fan diameter.',
      };
    }),
  );
  const le = leadingEdge(0.445, GE90.fanRadius - 0.006, 0.52, 1.1, 0.12, 0.32, {
    flare: true,
    twistSlope: 0.5,
    sShape: true,
  });
  for (let i = 0; i < 22; i++) {
    const id = `fan.blade.${String(i + 1).padStart(2, '0')}`;
    part(`${id}.edge`, 'Titanium leading-edge representation', id, le, 'titanium', {
      move: [-0.15, 0, 0.15],
      purpose: 'A protective leading-edge representation follows the swept airfoil.',
      relationship:
        'Belongs to its composite blade; the thickness and bonding detail are illustrative.',
    });
    part(`${id}.root`, 'Blade root attachment', id, box(0.17, 0.1, 0.105), 'titanium', {
      position: [-0.005, 0.415, 0],
      move: [-0.3, 0, 0],
      purpose: 'An educational root attachment represents the blade-to-disk connection.',
    });
  }
  // Curved splitter and stationary outlet guide vanes.
  part(
    'booster.splitter',
    'Core / bypass splitter',
    'booster',
    lathe(
      [
        [-1.65, 0.47],
        [-1.5, 0.65],
        [-1.18, 0.75],
        [-1.04, 0.75],
        [-1.18, 0.71],
        [-1.5, 0.61],
        [-1.65, 0.47],
      ],
      96,
    ),
    'titanium',
    {
      move: [-1.4, 0, 0],
      explode: [-0.3, 0, 0],
      purpose:
        'Divides the fan discharge into the large bypass stream and the smaller core stream.',
    },
  );
  const ogv = group('fan.ogv', 'Outlet guide vanes', 'fan', {
    blockers: ['exterior.fan-case'],
    material: 'Titanium alloy',
    move: [-0.7, 0, 1.5],
    purpose: 'Stationary vanes recover swirl downstream of the fan.',
    relationship: 'Attached to the frame, not to either spool.',
  });
  registry.batch(
    ogv.id,
    airfoil({
      root: 0.73,
      tip: 1.62,
      chord: 0.23,
      twist: -0.4,
      sweep: 0.12,
      lean: 0,
      spanSteps: 8,
      sectionSteps: 10,
    }),
    materials.steel,
    Array.from({ length: 48 }, (_, i) => ({
      id: `fan.ogv.vane.${i + 1}`,
      name: `Outlet guide vane ${i + 1}`,
      position: [-1.48, 0, 0],
      rotation: [(i / 48) * TAU, 0, 0],
      material: 'Titanium alloy',
      move: [-0.5, Math.cos((i / 48) * TAU) * 0.55, Math.sin((i / 48) * TAU) * 0.55],
      kind: 'vane',
      blockers: ['exterior.fan-case'],
    })),
  );
  // Each stage has separate rotor disk, airfoils, stationary annulus and vanes.
  function stageRow(
    module,
    index,
    { x, r, hub, width, blades, stators, spool, turbine = false, variable = false },
  ) {
    const prefix = `${module}.stage.${index + 1}`;
    group(
      prefix,
      `${turbine ? 'Turbine' : 'Compressor'} stage ${String(index + 1).padStart(2, '0')}`,
      module,
      {
        position: [x, 0, 0],
        move: [0, 1.8, 1.9],
        explode: [(index - (module === 'hpc' ? 4 : module === 'lpt' ? 2.5 : 1.5)) * 0.12, 0, 0],
        blockers: [`${module}.case`, spool === 'LP' ? 'shafts.lp' : 'shafts.hp'],
        material: turbine ? 'Nickel superalloy' : 'Titanium alloy',
        purpose: `${turbine ? 'Energy extraction' : 'Compression'} stage ${index + 1} in the ${module === 'booster' ? 'four-stage booster' : module === 'hpc' ? 'nine-stage HP compressor' : module === 'hpt' ? 'two-stage HP turbine' : 'six-stage LP turbine'}.`,
        relationship: `Rotor blades turn with the ${spool} spool. The adjacent stator row stays fixed.`,
      },
    );
    const rotor = group(`${prefix}.rotor`, 'Rotor assembly', prefix, {
      spool,
      material: turbine ? 'Nickel superalloy' : 'Titanium alloy',
      move: [0, 1.8, 1.8],
      blockers: [`${module}.case`, spool === 'LP' ? 'shafts.lp' : 'shafts.hp'],
    });
    registry.rotors.push({ id: rotor.id, spool });
    part(
      `${prefix}.disk`,
      'Rotor disk',
      rotor.id,
      lathe(
        [
          [-width / 2, spool === 'HP' ? 0.205 : 0.14],
          [-width / 2, hub * 0.86],
          [-width * 0.2, hub],
          [width * 0.2, hub],
          [width / 2, hub * 0.86],
          [width / 2, spool === 'HP' ? 0.205 : 0.14],
          [-width / 2, spool === 'HP' ? 0.205 : 0.14],
        ],
        64,
      ),
      turbine ? 'nickel' : 'titanium',
      {
        move: [0, 1.9, 1.6],
        blockers: [`${module}.case`, spool === 'LP' ? 'shafts.lp' : 'shafts.hp'],
      },
    );
    ring(`${prefix}.disk-rim`, rotor.id, 0, hub, 0.009, turbine ? 'nickel' : 'steel');
    const g = airfoil({
      root: hub,
      tip: r,
      chord: width * 0.81,
      twist: turbine ? -0.8 : 0.75,
      sweep: turbine ? 0.02 : 0.015,
      lean: turbine ? 0.02 : 0.01,
      spanSteps: 7,
      sectionSteps: 9,
      thickness: turbine ? 0.17 : 0.12,
    });
    g.userData.lowGeometry = airfoil({
      root: hub,
      tip: r,
      chord: width * 0.81,
      twist: turbine ? -0.8 : 0.75,
      sweep: turbine ? 0.02 : 0.015,
      lean: turbine ? 0.02 : 0.01,
      spanSteps: 3,
      sectionSteps: 5,
      thickness: turbine ? 0.17 : 0.12,
    });
    registry.batch(
      `${prefix}.disk`,
      g,
      materials[turbine ? 'nickel' : 'titanium'],
      Array.from({ length: blades }, (_, i) => {
        const a = (i / blades) * TAU;
        return {
          id: `${prefix}.blade.${i + 1}`,
          name: `${turbine ? 'Turbine' : 'Compressor'} rotor blade ${i + 1}`,
          kind: 'blade',
          material: turbine ? 'Nickel superalloy' : 'Titanium alloy',
          spool,
          rotation: [a, 0, 0],
          move: [0, Math.cos(a) * 1.35, Math.sin(a) * 1.35],
          explode: [0, Math.cos(a) * 0.045, Math.sin(a) * 0.045],
          blockers: [`${module}.case`],
          purpose: turbine
            ? 'Extracts energy from the hot gas stream and transmits torque into its rotor disk.'
            : 'A rotating airfoil adds energy to the core airflow, raising total pressure.',
        };
      }),
    );
    const stator = group(
      `${prefix}.stator`,
      variable ? 'Variable stator row' : 'Stationary vane row',
      prefix,
      {
        position: [width * 0.64, 0, 0],
        material: turbine ? 'Nickel superalloy' : 'Titanium alloy',
        move: [0, 2, 0],
        blockers: [`${module}.case`, spool === 'LP' ? 'shafts.lp' : 'shafts.hp'],
      },
    );
    ring(`${prefix}.stator-ring`, stator.id, 0, r + 0.018, 0.018, turbine ? 'nickel' : 'steel');
    const vaneGeometry = airfoil({
      root: hub + 0.018,
      tip: r + 0.004,
      chord: width * 0.43,
      twist: turbine ? 0.7 : -0.62,
      sweep: 0,
      lean: 0,
      spanSteps: 6,
      sectionSteps: 8,
      thickness: 0.14,
    });
    vaneGeometry.userData.lowGeometry = airfoil({
      root: hub + 0.018,
      tip: r + 0.004,
      chord: width * 0.43,
      twist: turbine ? 0.7 : -0.62,
      sweep: 0,
      lean: 0,
      spanSteps: 3,
      sectionSteps: 4,
      thickness: 0.14,
    });
    registry.batch(
      stator.id,
      vaneGeometry,
      materials[turbine ? 'ceramic' : 'steel'],
      Array.from({ length: stators }, (_, i) => {
        const a = ((i + 0.45) / stators) * TAU;
        // Variable vane geometry is pivoted about its own radial axis at the outer trunnion.
        const e = {
          id: `${prefix}.vane.${i + 1}`,
          name: `${variable ? 'Variable stator' : 'Stationary vane'} ${i + 1}`,
          kind: 'vane',
          material: turbine ? 'Ceramic-coated nickel alloy' : 'Titanium alloy',
          rotation: [a, 0, 0],
          move: [0, Math.cos(a) * 1.2, Math.sin(a) * 1.2],
          explode: [0, Math.cos(a) * 0.06, Math.sin(a) * 0.06],
          blockers: [`${module}.case`],
        };
        return e;
      }),
    );
    if (variable)
      registry.variables.push({
        ids: Array.from({ length: stators }, (_, i) => `${prefix}.vane.${i + 1}`),
      });
    // A precisely seated hub shoulder and the case flange hold each stage row.
    bolts(prefix, `${prefix}.flange-bolt`, width * 0.8, r + 0.055, 24, 0.009);
  }
  const stageConfigs = {
    booster: {
      n: 4,
      start: -1.24,
      step: 0.17,
      r: (i) => 0.735 - 0.022 * i,
      hub: (i) => 0.38 + 0.015 * i,
      width: 0.105,
      blades: 30,
      stators: 36,
      spool: 'LP',
    },
    hpc: {
      n: 9,
      start: -0.48,
      step: 0.139,
      r: (i) => 0.68 - 0.019 * i,
      hub: (i) => 0.35 + 0.007 * i,
      width: 0.091,
      blades: 44,
      stators: 48,
      spool: 'HP',
    },
    hpt: {
      n: 2,
      start: 1.55,
      step: 0.19,
      r: (i) => 0.585 + 0.015 * i,
      hub: (i) => 0.34,
      width: 0.12,
      blades: 48,
      stators: 42,
      spool: 'HP',
      turbine: true,
    },
    lpt: {
      n: 6,
      start: 2.02,
      step: 0.175,
      r: (i) => 0.65 + 0.037 * i,
      hub: (i) => 0.32 - 0.005 * i,
      width: 0.108,
      blades: 54,
      stators: 58,
      spool: 'LP',
      turbine: true,
    },
  };
  for (const [module, c] of Object.entries(stageConfigs)) {
    casing(
      module,
      `${module}.case`,
      c.start - 0.07,
      c.start + (c.n - 1) * c.step + c.width * 0.91,
      c.r(0) + 0.07,
      c.r(c.n - 1) + 0.07,
      c.turbine ? 'nickel' : 'graphite',
      {
        name: `${MODULES.find((m) => m.id === module).short} casing`,
        move: [0, 2.7, 0],
        explode: [0, 1, 0],
      },
    );
    for (let i = 0; i < c.n; i++)
      stageRow(module, i, {
        ...c,
        x: c.start + i * c.step,
        r: c.r(i),
        hub: c.hub(i),
        variable: module === 'hpc' && i < 3,
      });
  }
  // Annular combustion system: segmented liners, perforations, nozzles and dome.
  casing('combustor', 'combustor.case', 0.78, 1.4, 0.59, 0.65, 'nickel', {
    name: 'Combustor pressure casing',
    move: [0, 2.8, 0],
    explode: [0, 1.1, 0],
  });
  group('combustor.liner', 'Annular combustion liner', 'combustor', {
    material: 'Nickel alloy',
    move: [0, 2.3, 0],
    explode: [0.15, 0, 0],
    blockers: ['combustor.case'],
    purpose:
      'A hollow annular flame tube between inner and outer liners. Dilution openings admit cooling air.',
  });
  for (let q = 0; q < 8; q++) {
    const start = (q * TAU) / 8,
      a = ((q + 0.5) * TAU) / 8;
    part(
      `combustor.liner.outer.${q}`,
      'Outer liner segment',
      'combustor.liner',
      shell(0.83, 1.38, 0.53, 0.6, 0.018, start + 0.008, TAU / 8 - 0.016),
      'ceramic',
      {
        move: [0, -Math.sin(a), Math.cos(a)],
        cutaway: q === 6 || q === 7,
        blockers: ['combustor.case'],
      },
    );
    part(
      `combustor.liner.inner.${q}`,
      'Inner liner segment',
      'combustor.liner',
      shell(0.83, 1.38, 0.27, 0.31, 0.018, start + 0.008, TAU / 8 - 0.016),
      'nickel',
      { move: [0, -Math.sin(a), Math.cos(a)], blockers: ['combustor.case'] },
    );
  }
  part(
    'combustor.dome',
    'Annular combustor dome',
    'combustor',
    shell(0.76, 0.81, 0.54, 0.54, 0.25),
    'nickel',
    { move: [0, 1.5, 0], blockers: ['combustor.case'] },
  );
  ring('combustor.manifold', 'combustor', 0.86, 0.64, 0.024, 'copper', {
    name: 'Fuel manifold',
    move: [0, 1.5, 0],
    explode: [0, 0.35, 0],
  });
  registry.batch(
    'combustor',
    cylinder(0.031, 0.095, 16),
    materials.steel,
    Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * TAU;
      return {
        id: `combustor.nozzle.${i + 1}`,
        name: `Fuel nozzle representation ${i + 1}`,
        position: radial(a, 0.405, 0.83),
        material: 'Steel',
        move: [-0.5, Math.cos(a) * 0.6, Math.sin(a) * 0.6],
        purpose:
          'Represents fuel atomization into the annular combustor. Nozzle count and placement are illustrative, not verified GE hardware specifications.',
      };
    }),
  );
  // Educational opening markers belong to their liner sector and follow its pose/visibility.
  const holeGeometry = cylinder(0.013, 0.004, 12);
  for (let row = 0; row < 3; row++) {
    for (let sector = 0; sector < 8; sector++) {
      registry.batch(
        `combustor.liner.outer.${sector}`,
        holeGeometry,
        materials.graphite,
        Array.from({ length: 6 }, (_, j) => {
          const i = sector * 6 + j,
            a = ((i + 0.5) / 48) * TAU + Math.PI / 2,
            x = 1 + row * 0.13,
            rad = 0.53 + (0.07 * (x - 0.83)) / 0.55 + 0.001;
          return {
            id: `combustor.hole.${row}.${i}`,
            name: 'Liner dilution aperture',
            material: 'Recess / opening',
            position: radial(a, rad, x),
            quaternion: new THREE.Quaternion()
              .setFromUnitVectors(
                new THREE.Vector3(1, 0, 0),
                new THREE.Vector3(0, Math.cos(a), Math.sin(a)),
              )
              .toArray(),
            move: radial(a, 0.5),
            kind: 'aperture',
            detail: 'fine',
            purpose:
              'Represents a dilution-air opening in the liner. The aperture pattern is an educational approximation.',
          };
        }),
      );
    }
  }
  for (let i = 0; i < 2; i++) {
    const a = (i ? 0.15 : 0.85) * Math.PI;
    part(
      `combustor.igniter.${i}`,
      'Igniter plug',
      'combustor',
      cylinder(0.035, 0.18, 16),
      'ceramic',
      {
        position: radial(a, 0.65, 1.03),
        rotation: [0, 0, a - Math.PI / 2],
        move: radial(a, 0.8),
        blockers: ['combustor.case'],
      },
    );
  }
  // Two concentric shaft systems, neither tied to the stationary vane rows.
  registry.get('shafts').explode.set(0, 0, 0);
  registry.get('shafts').blockers = ['fan', 'booster', 'hpc', 'combustor', 'hpt', 'lpt'];
  const lp = part(
    'shafts.lp',
    'Low-pressure shaft',
    'shafts',
    shell(-2.05, 3.04, 0.115, 0.115, 0.035),
    'steel',
    {
      spool: 'LP',
      move: [-5.9, 0, 0],
      explode: [-6.2, 0, 0],
      blockers: ['fan'],
      extraction: 'axial-first',
      purpose:
        'The inner shaft couples the six-stage LP turbine to the four-stage booster and fan.',
      relationship:
        'Runs concentrically through the hollow HP shaft. Turns independently of the HP spool.',
    },
  );
  registry.rotors.push({ id: lp.id, spool: 'LP' });
  const hp = part(
    'shafts.hp',
    'High-pressure shaft',
    'shafts',
    shell(-0.55, 1.85, 0.19, 0.19, 0.04),
    'titanium',
    {
      spool: 'HP',
      move: [3.4, 0, 0],
      explode: [5.0, 0, 0],
      blockers: ['hpt'],
      purpose:
        'The hollow outer shaft connects the two-stage HP turbine to the nine-stage HP compressor.',
    },
  );
  registry.rotors.push({ id: hp.id, spool: 'HP' });
  // Bearings occupy inter-module gaps, clear of rotating disk volumes.
  for (const [i, x, r, endR] of [
    [0, -1.38, 0.16, 0.67],
    [1, 0.716, 0.235, 0.62],
    [2, 3.025, 0.16, 0.88],
  ]) {
    const id = `shafts.bearing.${i}`,
      shaft = i === 1 ? 'shafts.hp' : 'shafts.lp';
    const blockers =
      i === 0 ? ['fan', 'booster', shaft] : i === 1 ? ['hpc', 'combustor', shaft] : ['lpt', shaft];
    group(id, ['Forward', 'Mid-frame', 'Aft'][i] + ' bearing support', 'shafts', {
      position: [x, 0, 0],
      material: 'Steel',
      move: [0, 0, 1.4],
      explode: [0, 0, 1.5],
      blockers,
      purpose:
        'Separate bearing races and rollers locate a shaft; a strut frame carries the load into the case.',
      relationship:
        'An illustrative bearing/support arrangement placed between the rotating stage rows.',
    });
    group(`${id}.frame`, 'Bearing support frame', id, {
      material: 'Steel',
      move: [-0.45, 0, 0],
      blockers,
    });
    part(
      `${id}.support-ring`,
      'Bearing frame outer ring',
      `${id}.frame`,
      shell(-0.026, 0.026, endR + 0.02, endR + 0.02, 0.045),
      'steel',
      { move: [-0.4, 0, 0], blockers },
    );
    part(
      `${id}.outer`,
      'Bearing outer race',
      id,
      shell(-0.03, 0.03, r + 0.06, r + 0.06, 0.04),
      'steel',
      { move: [-0.45, 0, 0], blockers: [...blockers, `${id}.frame`] },
    );
    part(
      `${id}.inner`,
      'Bearing inner race',
      id,
      shell(-0.03, 0.03, r - 0.02, r - 0.02, 0.025),
      'steel',
      { move: [-0.45, 0, 0], blockers },
    );
    registry.batch(
      id,
      cylinder(0.018, 0.04, 12),
      materials.aluminium,
      Array.from({ length: 18 }, (_, j) => ({
        id: `${id}.roller.${j}`,
        name: `Bearing roller ${j + 1}`,
        position: radial((j / 18) * TAU, r),
        material: 'Steel',
        move: radial((j / 18) * TAU, 0.6),
        detail: 'fine',
        blockers: [...blockers, `${id}.outer`, `${id}.frame`],
      })),
    );
    registry.batch(
      `${id}.frame`,
      airfoil({
        root: r + 0.06,
        tip: endR,
        chord: 0.04,
        twist: 0,
        sweep: 0,
        lean: 0,
        spanSteps: 4,
        sectionSteps: 7,
        thickness: 0.25,
      }),
      materials.steel,
      Array.from({ length: 8 }, (_, j) => ({
        id: `${id}.strut.${j}`,
        name: `Bearing frame strut ${j + 1}`,
        rotation: [(j / 8) * TAU, 0, 0],
        material: 'Steel',
        move: radial((j / 8) * TAU, 0.8),
        blockers,
      })),
    );
  }
  // Exhaust: individual annular nozzles, centerbody, stationary frame.
  part(
    'lpt.exhaust-cone',
    'Exhaust centerbody',
    'lpt',
    lathe(
      [
        [3.12, 0],
        [3.12, 0.29],
        [3.28, 0.26],
        [3.44, 0.22],
        [3.75, 0.11],
        [4.02, 0],
      ],
      96,
    ),
    'nickel',
    {
      move: [2, 0, 0],
      explode: [0.8, 0, 0],
      purpose: 'A tapered stationary centerbody shapes the core exhaust passage.',
    },
  );
  casing('lpt', 'lpt.exhaust', 3.0, 3.65, 0.91, 0.68, 'titanium', {
    name: 'Core exhaust nozzle',
    move: [1.5, 0, 0],
    explode: [0.6, 0, 0],
  });
  ring('lpt.exhaust-rim', 'lpt', 3.65, 0.68, 0.018, 'nickel', {
    move: [1.6, 0, 0],
    explode: [0.65, 0, 0],
  });
  registry.batch(
    'lpt',
    airfoil({
      root: 0.275,
      tip: 0.805,
      chord: 0.14,
      twist: 0,
      sweep: 0,
      lean: 0,
      spanSteps: 4,
      sectionSteps: 8,
    }),
    materials.nickel,
    Array.from({ length: 8 }, (_, i) => ({
      id: `lpt.exhaust-strut.${i}`,
      name: `Exhaust frame strut ${i + 1}`,
      position: [3.2, 0, 0],
      rotation: [(i / 8) * TAU, 0, 0],
      material: 'Nickel alloy',
      move: radial((i / 8) * TAU, 1),
      explode: [0.5, 0, 0],
    })),
  );
  // Auxiliary hardware. Every line has connectors at both ends and stands off the case.
  group('aux.gearbox', 'Accessory gearbox', 'aux', {
    position: [-0.47, -0.86, 0.13],
    material: 'Cast aluminium',
    move: [0, -0.25, 1.7],
    explode: [0, 0, 0.4],
    purpose:
      'A representative external gearbox drives engine accessories. Exact gears, ratios and mounting geometry are not reproduced.',
  });
  part(
    'aux.gearbox.body',
    'Accessory gearbox housing',
    'aux.gearbox',
    box(0.85, 0.3, 0.34),
    'graphite',
    { move: [0, -0.7, 0] },
  );
  part(
    'aux.gearbox.cover',
    'Gearbox inspection cover',
    'aux.gearbox',
    box(0.68, 0.2, 0.025),
    'aluminium',
    { position: [0, 0, 0.18], move: [0, 0, 0.7] },
  );
  for (let i = 0; i < 3; i++) {
    part(
      `aux.gearbox.drive.${i}`,
      'Accessory drive housing',
      'aux.gearbox',
      cylinder(0.085, 0.16, 32),
      'aluminium',
      {
        position: [-0.25 + i * 0.25, -0.07, 0.23],
        rotation: [0, Math.PI / 2, 0],
        move: [0, 0, 0.7],
      },
    );
  }
  for (const [id, name, pos, size, mat] of [
    ['aux.fadec', 'Electronic engine control', [0.03, 0.35, 0.77], [0.43, 0.25, 0.14], 'graphite'],
    ['aux.starter', 'Starter representation', [-0.8, -0.61, 0.6], [0.32, 0.24, 0.26], 'steel'],
    ['aux.oil', 'Oil system housing', [0.65, -0.57, 0.57], [0.28, 0.3, 0.25], 'aluminium'],
    ['aux.fuel', 'Fuel metering unit', [0.75, 0.25, 0.76], [0.28, 0.23, 0.18], 'steel'],
  ]) {
    part(id, name, 'aux', box(...size), mat, {
      position: pos,
      move: [0, 0.3, 1.2],
      explode: [0, 0, 0.35],
    });
    for (let k = 0; k < 4; k++)
      part(`${id}.screw.${k}`, 'Cover screw', id, cylinder(0.013, 0.015, 6), 'steel', {
        position: [
          (k < 2 ? -1 : 1) * size[0] * 0.38,
          (k % 2 ? -1 : 1) * size[1] * 0.35,
          size[2] / 2 + 0.01,
        ],
        rotation: [0, Math.PI / 2, 0],
        move: [0, 0, 0.3],
        detail: 'fine',
      });
  }
  const routes = [
    [
      [-0.25, -0.77, 0.38],
      [-0.25, -0.68, 0.72],
      [0.4, -0.68, 0.72],
      [0.65, -0.58, 0.71],
    ],
    [
      [0.74, 0.36, 0.83],
      [0.85, 0.51, 0.78],
      [1.1, 0.58, 0.72],
      [1.1, 0.65, 0.2],
    ],
    [
      [0.03, 0.36, 0.85],
      [-0.1, 0.5, 0.83],
      [-0.73, 0.56, 0.83],
      [-0.95, 0.42, 0.8],
    ],
    [
      [0.12, 0.27, 0.85],
      [0.18, 0.33, 0.91],
      [0.58, 0.33, 0.91],
      [0.73, 0.28, 0.86],
    ],
    [
      [0.73, -0.55, 0.67],
      [0.98, -0.56, 0.67],
      [1.72, -0.56, 0.67],
      [2.23, -0.5, 0.7],
    ],
    [
      [-0.78, -0.62, 0.72],
      [-0.9, -0.54, 0.76],
      [-1.2, -0.38, 0.8],
      [-1.25, -0.19, 0.8],
    ],
    [
      [0.03, 0.48, 0.85],
      [0.1, 0.78, 0.5],
      [0.7, 0.78, 0.5],
      [1.18, 0.73, 0.15],
    ],
    [
      [2.27, -0.5, 0.7],
      [2.42, -0.34, 0.8],
      [2.75, -0.34, 0.86],
      [2.9, -0.15, 0.91],
    ],
  ];
  routes.forEach((points, i) => {
    const id = `aux.line.${i + 1}`;
    part(
      id,
      i % 3 ? 'Control / sensor harness' : 'Fuel / oil line',
      'aux',
      pipe(points, i % 3 ? 0.012 : 0.022),
      i % 3 ? 'rubber' : 'steel',
      {
        move: [0, 0.2, 1.15],
        explode: [0, 0, 0.35],
        purpose:
          'An illustrative external line follows the casing structure and terminates at connectors.',
        relationship:
          'Routing is schematic. Disconnects and clamps are represented; no proprietary routing is implied.',
      },
    );
    for (const [j, p] of [
      [0, points[0]],
      [1, points.at(-1)],
    ]) {
      const adj = j ? points.at(-2) : points[1],
        dir = new THREE.Vector3(...p).sub(new THREE.Vector3(...adj)).normalize();
      part(
        `${id}.connector.${j}`,
        'Line terminal connector',
        id,
        cylinder(i % 3 ? 0.025 : 0.035, 0.065, 12),
        'titanium',
        {
          position: p,
          quaternion: new THREE.Quaternion()
            .setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir)
            .toArray(),
          move: dir.multiplyScalar(0.25).toArray(),
        },
      );
    }
    for (let j = 1; j < points.length - 1; j++) {
      const p = points[j];
      part(
        `${id}.clamp.${j}`,
        'Harness support clamp',
        id,
        torus(i % 3 ? 0.019 : 0.03, 0.006),
        'steel',
        { position: p, rotation: [0, Math.PI / 2, 0], move: [0, 0, 0.25], detail: 'fine' },
      );
    }
  });
  // Refined maintenance-display cradle. Stand coordinates are relative to engine axis.
  for (const z of [-0.96, 0.96]) {
    part(`stand.rail.${z}`, 'Longitudinal stand rail', 'stand', box(5.75, 0.12, 0.12), 'stand', {
      position: [0.35, -1.92, z],
      move: [0, 0, z],
      required: false,
    });
    for (const [i, x] of [
      [0, -1.24],
      [1, 2.73],
    ]) {
      const id = `stand.post.${i}.${z}`;
      const height = i ? 1.0 : 0.58;
      part(id, 'Adjustable cradle upright', 'stand', box(0.13, height, 0.13), 'stand', {
        position: [x, -1.86 + height / 2, z],
        move: [0, 0, z],
        required: false,
      });
      part(`${id}.foot`, 'Cradle base plate', id, box(0.38, 0.05, 0.34), 'steel', {
        position: [0, -height / 2 - 0.025, 0],
        move: [0, -0.1, 0],
        required: false,
      });
      part(`${id}.head`, 'Cradle contact pad', id, box(0.27, 0.08, 0.24), 'rubber', {
        position: [0, height / 2 + 0.03, 0],
        required: false,
      });
      part(
        `${id}.brace`,
        'Triangulated upright brace',
        'stand',
        between([x - 0.35, -1.85, z], [x, -1.15, z], 0.045).geometry,
        'stand',
        {
          ...between([x - 0.35, -1.85, z], [x, -1.15, z], 0.045),
          move: [0, 0, z],
          required: false,
        },
      );
    }
  }
  for (const [i, x] of [
    [0, -1.24],
    [1, 2.73],
  ]) {
    part(`stand.cross.${i}`, 'Cradle crossbeam', 'stand', box(0.14, 0.13, 2.3), 'stand', {
      position: [x, -1.85, 0],
      required: false,
    });
    for (const z of [-1.07, 1.07])
      part(
        `stand.foot.${i}.${z}`,
        'Vibration isolation foot',
        'stand',
        cylinder(0.1, 0.09, 24),
        'rubber',
        { position: [x, -2.02, z], rotation: [0, 0, Math.PI / 2], required: false },
      );
  }
  for (const z of [-0.96, 0.96]) {
    const end = [2.73, -0.57, Math.sign(z) * 0.58],
      start = [2.73, -0.86, z];
    const support = between(start, end, 0.048);
    part(`stand.saddle.${z}`, 'Rear case support saddle', 'stand', support.geometry, 'stand', {
      position: support.position,
      quaternion: support.quaternion,
      required: false,
    });
    part(
      `stand.saddle.${z}.pad`,
      'Contoured cradle saddle pad',
      `stand.saddle.${z}`,
      box(0.24, 0.07, 0.16),
      'rubber',
      { position: [0.2, 0, 0], required: false },
    );
  }
  registry.sync();
  return { registry, root: root.object, casingParts };
}
