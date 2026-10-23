import * as THREE from 'three';
const cache = new Map();
export function cached(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}
export function lathe(profile, segments = 128, start = 0, length = Math.PI * 2) {
  const key = `lathe:${JSON.stringify(profile)}:${segments}:${start}:${length}`;
  return cached(key, () => {
    const g = new THREE.LatheGeometry(
      profile.map(([x, r]) => new THREE.Vector2(r, x)),
      segments,
      start,
      length,
    );
    g.rotateZ(-Math.PI / 2); // lathe's +Y axis becomes engine +X
    g.computeVertexNormals();
    return g;
  });
}
export function shell(x0, x1, r0, r1, thickness = 0.035, start = 0, arc = Math.PI * 2) {
  return lathe(
    [
      [x0, r0],
      [x1, r1],
      [x1, r1 - thickness],
      [x0, r0 - thickness],
      [x0, r0],
    ],
    Math.max(24, Math.round((96 * arc) / (2 * Math.PI))),
    start,
    arc,
  );
}
export function cylinder(r, depth, segments = 64, rBack = r) {
  return cached(`cyl:${r}:${depth}:${segments}:${rBack}`, () =>
    new THREE.CylinderGeometry(rBack, r, depth, segments).rotateZ(-Math.PI / 2),
  );
}
export function torus(r, tube, arc = Math.PI * 2) {
  return cached(`tor:${r}:${tube}:${arc}`, () =>
    new THREE.TorusGeometry(
      r,
      tube,
      8,
      Math.max(32, Math.ceil((100 * arc) / (Math.PI * 2))),
      arc,
    ).rotateY(Math.PI / 2),
  );
}
export function box(x, y, z, bevel = 0.02) {
  // Real bevelled, extruded profile rather than a sharp-edged box.
  return cached(`box:${x}:${y}:${z}:${bevel}`, () => {
    const r = Math.min(bevel, x / 5, y / 5, z / 5),
      s = new THREE.Shape();
    s.moveTo(-x / 2 + r, -y / 2);
    s.lineTo(x / 2 - r, -y / 2);
    s.quadraticCurveTo(x / 2, -y / 2, x / 2, -y / 2 + r);
    s.lineTo(x / 2, y / 2 - r);
    s.quadraticCurveTo(x / 2, y / 2, x / 2 - r, y / 2);
    s.lineTo(-x / 2 + r, y / 2);
    s.quadraticCurveTo(-x / 2, y / 2, -x / 2, y / 2 - r);
    s.lineTo(-x / 2, -y / 2 + r);
    s.quadraticCurveTo(-x / 2, -y / 2, -x / 2 + r, -y / 2);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: z - 2 * r,
      bevelEnabled: true,
      bevelSize: r,
      bevelThickness: r,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 3,
    });
    g.translate(0, 0, -z / 2 + r);
    g.computeVertexNormals();
    return g;
  });
}
/** Thick swept/twisted airfoil: continuous span and closed NACA-like section. */
export function airfoil({
  root = 0.4,
  tip = 1.6256,
  chord = 0.42,
  twist = 0.7,
  sweep = 0.28,
  lean = 0.1,
  spanSteps = 22,
  sectionSteps = 16,
  thickness = 0.12,
  flare = false,
  twistSlope = 0.67,
  sShape = false,
}) {
  return cached(
    `blade:${[root, tip, chord, twist, sweep, lean, spanSteps, sectionSteps, thickness, flare, twistSlope, sShape].join(':')}`,
    () => {
      const positions = [],
        indices = [],
        uvs = [];
      const n = sectionSteps * 2;
      for (let j = 0; j <= spanSteps; j++) {
        const t = j / spanSteps,
          r = root + (tip - root) * t,
          c =
            chord *
            (flare
              ? 0.5 + 0.6 * Math.sin(t * Math.PI * 0.6)
              : 0.76 + 0.32 * Math.sin(t * Math.PI * 0.8));
        const pitch = twist * (1 - twistSlope * t),
          cx = sweep * t * t,
          cz = lean * (sShape ? t * t - 0.24 * Math.sin(t * Math.PI * 2) : t * t);
        for (let k = 0; k < n; k++) {
          const top = k < sectionSteps;
          const u = top ? k / (sectionSteps - 1) : 1 - (k - sectionSteps) / (sectionSteps - 1);
          const tt =
            5 *
            thickness *
            (0.2969 * Math.sqrt(u) -
              0.126 * u -
              0.3516 * u * u +
              0.2843 * u ** 3 -
              0.1036 * u ** 4);
          const a = (u - 0.48) * c,
            b = (top ? 1 : -1) * tt * c + 0.025 * c * Math.sin(Math.PI * u);
          const tangent = cz + a * Math.sin(pitch) + b * Math.cos(pitch);
          positions.push(
            cx + a * Math.cos(pitch) - b * Math.sin(pitch),
            Math.sqrt(Math.max(0, r * r - tangent * tangent)),
            tangent,
          );
          uvs.push(u, t);
        }
      }
      for (let j = 0; j < spanSteps; j++)
        for (let k = 0; k < n; k++) {
          const a = j * n + k,
            b = j * n + ((k + 1) % n),
            c = (j + 1) * n + k,
            d = (j + 1) * n + ((k + 1) % n);
          indices.push(a, c, b, b, c, d);
        }
      for (const j of [0, spanSteps])
        for (let k = 1; k < n - 1; k++)
          j === 0
            ? indices.push(j * n, j * n + k, j * n + k + 1)
            : indices.push(j * n, j * n + k + 1, j * n + k);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      g.setIndex(indices);
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return g;
    },
  );
}
export function pipe(points, r = 0.018) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  );
  return new THREE.TubeGeometry(curve, Math.max(16, Math.min(96, points.length * 5)), r, 8, false);
}
export function between(a, b, r = 0.025) {
  const av = new THREE.Vector3(...a),
    bv = new THREE.Vector3(...b),
    mid = av.clone().add(bv).multiplyScalar(0.5);
  const geometry = cylinder(r, av.distanceTo(bv), 16);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    bv.sub(av).normalize(),
  );
  return { geometry, position: mid.toArray(), quaternion: q.toArray() };
}
export function leadingEdge(
  root,
  tip,
  chord,
  twist,
  sweep,
  lean,
  { flare = false, twistSlope = 0.67, sShape = false } = {},
) {
  const pts = [];
  for (let j = 0; j <= 24; j++) {
    const t = j / 24,
      c =
        chord *
        (flare
          ? 0.5 + 0.6 * Math.sin(t * Math.PI * 0.6)
          : 0.76 + 0.32 * Math.sin(t * Math.PI * 0.8)),
      p = twist * (1 - twistSlope * t);
    const z =
        lean * (sShape ? t * t - 0.24 * Math.sin(t * Math.PI * 2) : t * t) - 0.48 * c * Math.sin(p),
      r = root + (tip - root) * t;
    pts.push([sweep * t * t - 0.48 * c * Math.cos(p), Math.sqrt(Math.max(0, r * r - z * z)), z]);
  }
  return pipe(pts, 0.006);
}
export function disposeGeometryCache() {
  for (const g of cache.values()) g.dispose();
  cache.clear();
}
