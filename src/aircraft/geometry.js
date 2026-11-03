import * as THREE from 'three';
import { cached } from '../scene/geometry.js';

const bodyStations = [
  [-36.93, 0.035, 5.9],
  [-36.72, 0.57, 5.96],
  [-36.05, 1.22, 6.08],
  [-34.7, 2.0, 6.2],
  [-33.3, 2.48, 6.25],
  [-31, 2.84, 6.25],
  [-27.4, 3.06, 6.25],
  [-24, 3.1, 6.25],
  [17, 3.1, 6.25],
  [22, 2.94, 6.3],
  [27, 2.32, 6.65],
  [31, 1.45, 7.04],
  [34, 0.65, 7.4],
  [36.93, 0.055, 7.65],
];
// Shape-preserving cubic interpolation avoids rings, kinks and cone-on-cylinder seams.
function profileValue(x, channel) {
  let i = 0;
  while (i < bodyStations.length - 2 && x > bodyStations[i + 1][0]) i++;
  const a = bodyStations[i],
    b = bodyStations[i + 1],
    h = b[0] - a[0],
    t = THREE.MathUtils.clamp((x - a[0]) / h, 0, 1);
  const slope = (j) => {
    if (j === 0)
      return (
        (bodyStations[1][channel] - bodyStations[0][channel]) /
        (bodyStations[1][0] - bodyStations[0][0])
      );
    if (j === bodyStations.length - 1)
      return (
        (bodyStations[j][channel] - bodyStations[j - 1][channel]) /
        (bodyStations[j][0] - bodyStations[j - 1][0])
      );
    const l =
        (bodyStations[j][channel] - bodyStations[j - 1][channel]) /
        (bodyStations[j][0] - bodyStations[j - 1][0]),
      r =
        (bodyStations[j + 1][channel] - bodyStations[j][channel]) /
        (bodyStations[j + 1][0] - bodyStations[j][0]);
    return l * r <= 0 ? 0 : (2 * l * r) / (l + r);
  };
  return (
    (2 * t ** 3 - 3 * t * t + 1) * a[channel] +
    (t ** 3 - 2 * t * t + t) * h * slope(i) +
    (-2 * t ** 3 + 3 * t * t) * b[channel] +
    (t ** 3 - t * t) * h * slope(i + 1)
  );
}
export const fuselageProfile = (x) => ({
  r: Math.max(0.02, profileValue(x, 1)),
  y: profileValue(x, 2),
});
export function frameArc(radius, tube = 0.045) {
  return cached(`777-framearc:${radius}:${tube}`, () => {
    const positions = [],
      indices = [],
      n = 32,
      m = 10;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= m; j++) {
        const a = (i * Math.PI) / 2 / n,
          b = (j * Math.PI * 2) / m,
          r = radius + tube * Math.cos(b);
        positions.push(tube * Math.sin(b), r * Math.sin(a), -r * Math.cos(a));
      }
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++) {
        const a = i * (m + 1) + j,
          b = a + m + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    for (const i of [0, n]) {
      const angle = (i * Math.PI) / 2 / n,
        index = positions.length / 3;
      positions.push(0, radius * Math.sin(angle), -radius * Math.cos(angle));
      for (let j = 0; j < m; j++) indices.push(index, i * (m + 1) + j, i * (m + 1) + j + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  });
}
export function curvedBodyPanel(x0, x1, y0, y1, side = 1, pivot = [0, 0, 0], thickness = 0.04) {
  const positions = [],
    indices = [],
    nx = 12,
    ny = 8;
  for (let face = 0; face < 2; face++)
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        const x = x0 + ((x1 - x0) * i) / nx,
          y = y0 + ((y1 - y0) * j) / ny,
          p = fuselageProfile(x);
        const z =
          side * Math.sqrt(Math.max(0.001, (p.r + 0.025 - face * thickness) ** 2 - (y - p.y) ** 2));
        positions.push(x - pivot[0], y - pivot[1], z - pivot[2]);
      }
  const row = ny + 1,
    n = (nx + 1) * row;
  for (let face = 0; face < 2; face++)
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const a = face * n + i * row + j,
          b = a + row;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  for (let i = 0; i < nx; i++)
    for (const j of [0, ny]) {
      const a = i * row + j,
        b = a + row;
      indices.push(a, b, a + n, b, b + n, a + n);
    }
  for (const i of [0, nx])
    for (let j = 0; j < ny; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function doorOpeningAt(x, y, z) {
  if (
    Math.abs(z) > 1.7 &&
    y > 6.075 &&
    y < 8.005 &&
    [-26.1, -15, -2, 10.4, 23.7].some((d) => Math.abs(x - d) < 0.525)
  )
    return true;
  return z > 1.5 && y > 4.2 && y < 5.8 && [-17.2, 17.7].some((d) => Math.abs(x - d) < 1.415);
}
export function hullPatch(x0, x1, a0, arc, thickness = 0.045) {
  return cached(`777hull-open:${x0}:${x1}:${a0}:${arc}:${thickness}`, () => {
    const xs = [x0, x1],
      angles = [a0, a0 + arc],
      mid = fuselageProfile((x0 + x1) / 2);
    const nx0 = Math.max(6, Math.ceil((x1 - x0) * 3)),
      na0 = Math.max(8, Math.ceil(arc * 20));
    for (let i = 1; i < nx0; i++) xs.push(x0 + ((x1 - x0) * i) / nx0);
    for (const [x, w] of [
      ...[-26.1, -15, -2, 10.4, 23.7].map((x) => [x, 0.525]),
      [-17.2, 1.415],
      [17.7, 1.415],
    ])
      for (const edge of [x - w, x + w]) if (edge > x0 && edge < x1) xs.push(edge);
    for (let j = 1; j < na0; j++) angles.push(a0 + (arc * j) / na0);
    for (const y of [6.075, 8.005, 4.2, 5.8]) {
      const t = Math.asin(THREE.MathUtils.clamp((y - mid.y) / mid.r, -1, 1));
      for (const q of [t, Math.PI - t, t + Math.PI * 2]) if (q > a0 && q < a0 + arc) angles.push(q);
    }
    xs.sort((a, b) => a - b);
    angles.sort((a, b) => a - b);
    const positions = [],
      indices = [],
      nx = xs.length - 1,
      na = angles.length - 1,
      row = na + 1,
      layer = (nx + 1) * row;
    for (let face = 0; face < 2; face++)
      for (const x of xs) {
        const p = fuselageProfile(x),
          r = Math.max(0.01, p.r - face * thickness);
        for (const angle of angles)
          positions.push(x, p.y + r * Math.sin(angle), r * Math.cos(angle));
      }
    const filled = (i, j) => {
      if (i < 0 || i >= nx || j < 0 || j >= na) return false;
      const x = (xs[i] + xs[i + 1]) / 2,
        a = (angles[j] + angles[j + 1]) / 2,
        p = fuselageProfile(x);
      return !doorOpeningAt(x, p.y + p.r * Math.sin(a), p.r * Math.cos(a));
    };
    const wall = (a, b) => indices.push(a, b, a + layer, b, b + layer, a + layer);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < na; j++)
        if (filled(i, j)) {
          const a = i * row + j,
            b = a + row;
          indices.push(
            a,
            b,
            a + 1,
            a + 1,
            b,
            b + 1,
            a + layer,
            a + layer + 1,
            b + layer,
            a + layer + 1,
            b + layer + 1,
            b + layer,
          );
          if (!filled(i - 1, j)) wall(a, a + 1);
          if (!filled(i + 1, j)) wall(b, b + 1);
          if (!filled(i, j - 1)) wall(a, b);
          if (!filled(i, j + 1)) wall(a + 1, b + 1);
        }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  });
}
export function ovalPanel(width, height, depth = 0.035, r = 0.12) {
  return cached(`777panel:${width}:${height}:${depth}:${r}`, () => {
    const w = width / 2,
      h = height / 2,
      s = new THREE.Shape();
    r = Math.min(r, w, h);
    s.moveTo(-w + r, -h);
    s.lineTo(w - r, -h);
    s.quadraticCurveTo(w, -h, w, -h + r);
    s.lineTo(w, h - r);
    s.quadraticCurveTo(w, h, w - r, h);
    s.lineTo(-w + r, h);
    s.quadraticCurveTo(-w, h, -w, h - r);
    s.lineTo(-w, -h + r);
    s.quadraticCurveTo(-w, -h, -w + r, -h);
    const g = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.007,
      bevelThickness: 0.007,
      steps: 1,
      curveSegments: 6,
    });
    g.translate(0, 0, -depth / 2);
    return g;
  });
}
export function windowRing(width = 0.4, height = 0.57) {
  return cached(`777rim:${width}:${height}`, () => {
    const outer = new THREE.Shape(),
      inner = new THREE.Path();
    outer.absellipse(0, 0, width / 2, height / 2, 0, Math.PI * 2, false, 0);
    inner.absellipse(0, 0, width / 2 - 0.028, height / 2 - 0.028, 0, Math.PI * 2, true, 0);
    outer.holes.push(inner);
    return new THREE.ExtrudeGeometry(outer, {
      depth: 0.025,
      bevelEnabled: false,
      curveSegments: 16,
      steps: 1,
    });
  });
}
export const WING_STATIONS = [
  [3, -10, 15.4, 4.72],
  [10, -6.5, 11.1, 5.02],
  [18, -0.7, 7.6, 5.46],
  [25, 5.5, 4.75, 5.85],
  [29.3, 9.9, 3.1, 6.1],
  [32.4, 14.6, 0.6, 6.4],
];
export function wingStation(z) {
  z = Math.abs(z);
  let i = 0;
  while (i < WING_STATIONS.length - 2 && z > WING_STATIONS[i + 1][0]) i++;
  const a = WING_STATIONS[i],
    b = WING_STATIONS[i + 1],
    t = THREE.MathUtils.clamp((z - a[0]) / (b[0] - a[0]), 0, 1);
  return {
    x: THREE.MathUtils.lerp(a[1], b[1], t),
    chord: THREE.MathUtils.lerp(a[2], b[2], t),
    y: THREE.MathUtils.lerp(a[3], b[3], t),
  };
}
export function foilY(u, chord, side = 1) {
  const yt =
    5 *
    0.105 *
    chord *
    (0.2969 * Math.sqrt(Math.max(0, u)) -
      0.126 * u -
      0.3516 * u * u +
      0.2843 * u ** 3 -
      0.1036 * u ** 4);
  return 0.012 * chord * Math.sin(Math.PI * u) + side * yt;
}
export function wingVolume(z0, z1, u0, u1, side = 1, skin = null, pivot = [0, 0, 0]) {
  const positions = [],
    indices = [],
    ns = Math.max(3, Math.ceil((z1 - z0) * 1.2)),
    nc = Math.max(5, Math.ceil((u1 - u0) * 42));
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i <= ns; i++) {
      const z = THREE.MathUtils.lerp(z0, z1, i / ns),
        s = wingStation(z);
      for (let j = 0; j <= nc; j++) {
        const u = THREE.MathUtils.lerp(u0, u1, j / nc);
        const y = skin
          ? foilY(u, s.chord, skin) - layer * 0.035 * skin
          : foilY(u, s.chord, layer === 0 ? 1 : -1);
        positions.push(s.x + u * s.chord - pivot[0], s.y + y - pivot[1], side * z - pivot[2]);
      }
    }
  const row = nc + 1,
    n = (ns + 1) * row;
  for (let l = 0; l < 2; l++)
    for (let i = 0; i < ns; i++)
      for (let j = 0; j < nc; j++) {
        const a = l * n + i * row + j,
          b = a + row;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  for (let i = 0; i < ns; i++)
    for (const j of [0, nc]) {
      const a = i * row + j,
        b = a + row;
      indices.push(a, a + n, b, b, a + n, b + n);
    }
  for (const i of [0, ns])
    for (let j = 0; j < nc; j++) {
      const a = i * row + j,
        b = a + 1;
      indices.push(a, b, a + n, b, b + n, a + n);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function unitRib() {
  return cached('777-rib', () => {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 32; i++) {
      const u = 0.15 + (0.55 * i) / 32,
        y = foilY(u, 1) * 0.78;
      if (i === 0) shape.moveTo(u, y);
      else shape.lineTo(u, y);
    }
    for (let i = 32; i >= 0; i--) {
      const u = 0.15 + (0.55 * i) / 32;
      shape.lineTo(u, foilY(u, 1, -1) * 0.78);
    }
    for (const u of [0.22, 0.36, 0.5, 0.64]) {
      const hole = new THREE.Path();
      hole.absellipse(u, 0.004, 0.035, 0.012, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.055,
      bevelEnabled: false,
      curveSegments: 12,
      steps: 1,
    });
  });
}
export function polygonSolid(points, depth = 0.1) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(0.025, depth / 4),
    bevelThickness: Math.min(0.025, depth / 4),
    bevelSegments: 2,
    steps: 1,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}
export function verticalTail(y0, y1, u0 = 0, u1 = 1, pivot = [0, 0, 0]) {
  const positions = [],
    indices = [],
    N = 18,
    M = 18;
  for (let face = 0; face < 2; face++)
    for (let i = 0; i <= N; i++) {
      const t = (y0 + ((y1 - y0) * i) / N) / 11.75,
        y = 6.75 + t * 11.75,
        leading = 22.5 + 10.5 * t,
        chord = 11.2 - 7.1 * t;
      for (let j = 0; j <= M; j++) {
        const u = u0 + ((u1 - u0) * j) / M;
        positions.push(
          leading + chord * u - pivot[0],
          y - pivot[1],
          (face ? 1 : -1) *
            Math.max(
              0.015,
              5 *
                0.1 *
                chord *
                (0.2969 * Math.sqrt(u) -
                  0.126 * u -
                  0.3516 * u * u +
                  0.2843 * u ** 3 -
                  0.1036 * u ** 4),
            ) -
            pivot[2],
        );
      }
    }
  const row = M + 1,
    layer = (N + 1) * row;
  for (let l = 0; l < 2; l++)
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M; j++) {
        const a = l * layer + i * row + j,
          b = a + row;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  for (let i = 0; i < N; i++)
    for (const j of [0, M]) {
      const a = i * row + j,
        b = a + row;
      indices.push(a, b, a + layer, b, b + layer, a + layer);
    }
  for (const i of [0, N])
    for (let j = 0; j < M; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + layer, a + 1, a + layer + 1, a + layer);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function horizontalTail(side = 1, u0 = 0, u1 = 1, pivot = [0, 0, 0]) {
  const positions = [],
    indices = [],
    N = 18,
    M = 18;
  for (let face = 0; face < 2; face++)
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        z = 1.3 + 9.55 * t,
        leading = 23.5 + 9 * t,
        chord = 8.5 - 5.9 * t,
        y = 8.4 + 0.6 * t;
      for (let j = 0; j <= M; j++) {
        const u = u0 + ((u1 - u0) * j) / M;
        positions.push(
          leading + chord * u - pivot[0],
          y + foilY(u, chord, face ? 1 : -1) * 0.7 - pivot[1],
          side * z - pivot[2],
        );
      }
    }
  const row = M + 1,
    L = (N + 1) * row;
  for (let l = 0; l < 2; l++)
    for (let i = 0; i < N; i++)
      for (let j = 0; j < M; j++) {
        const a = l * L + i * row + j,
          b = a + row;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
  for (let i = 0; i < N; i++)
    for (const j of [0, M]) {
      const a = i * row + j,
        b = a + row;
      indices.push(a, b, a + L, b, b + L, a + L);
    }
  for (const i of [0, N])
    for (let j = 0; j < M; j++) {
      const a = i * row + j;
      indices.push(a, a + 1, a + L, a + 1, a + L + 1, a + L);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
