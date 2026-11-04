import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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

// Six educational windshield panes wrap from a narrow center post onto the sides.
export const WINDSHIELD_PANES = [
  [
    [-34.9, 0.055],
    [-33.85, 0.9],
    [-33.3, 0.68],
    [-33.75, 0.045],
  ],
  [
    [-33.7, 0.94],
    [-32.65, 1.15],
    [-32.5, 0.88],
    [-33.15, 0.72],
  ],
  [
    [-32.5, 1.16],
    [-31.35, 1.19],
    [-31.35, 0.92],
    [-32.35, 0.9],
  ],
];
const windshieldPlanes = new Map();
function windshieldPlane(index, side) {
  const key = index + ':' + side;
  if (windshieldPlanes.has(key)) return windshieldPlanes.get(key);
  const corners = WINDSHIELD_PANES[index].map(([x, a]) => {
    const p = fuselageProfile(x);
    return new THREE.Vector3(x, p.y + p.r * Math.cos(a), side * p.r * Math.sin(a));
  });
  const center = corners.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(0.25);
  const normal = corners[2]
    .clone()
    .sub(corners[0])
    .cross(corners[3].clone().sub(corners[1]))
    .normalize();
  if (normal.z * side < 0) normal.negate();
  for (const p of corners) p.addScaledVector(normal, -p.clone().sub(center).dot(normal));
  const at = (u, v) =>
    corners[0]
      .clone()
      .multiplyScalar((1 - u) * (1 - v))
      .addScaledVector(corners[1], u * (1 - v))
      .addScaledVector(corners[2], u * v)
      .addScaledVector(corners[3], (1 - u) * v);
  const result = { corners, center, normal, at };
  windshieldPlanes.set(key, result);
  return result;
}
/** The pressure body stays smooth; real apertures admit the flat glazing. */
export function noseSurfacePoint(x, angle, side, inset = 0) {
  const p = fuselageProfile(x),
    r = p.r - inset;
  return new THREE.Vector3(x, p.y + r * Math.cos(angle), side * r * Math.sin(angle));
}
function cutWindshieldHoles(geometry) {
  const a = geometry.attributes.position,
    idx = geometry.index,
    output = [];
  const cutters = [1, -1].flatMap((side) =>
    [0, 1, 2].map((i) => {
      const p = windshieldPlane(i, side),
        corners = [
          p.at(-0.035, -0.035),
          p.at(1.035, -0.035),
          p.at(1.035, 1.035),
          p.at(-0.035, 1.035),
        ];
      const edges = corners.map((v, j) => {
        const n = corners[(j + 1) % 4].clone().sub(v).cross(p.normal).normalize();
        if (p.center.clone().sub(v).dot(n) < 0) n.negate();
        return { origin: v, normal: n };
      });
      return { side, edges };
    }),
  );
  const clip = (poly, edge, inside) => {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i],
        q = poly[(i + 1) % poly.length],
        dp = p.clone().sub(edge.origin).dot(edge.normal),
        dq = q.clone().sub(edge.origin).dot(edge.normal);
      const pin = inside ? dp >= -1e-9 : dp <= 1e-9,
        qin = inside ? dq >= -1e-9 : dq <= 1e-9;
      if (pin) result.push(p);
      if (pin !== qin) result.push(p.clone().lerp(q, dp / (dp - dq)));
    }
    return result;
  };
  for (let i = 0; i < idx.count; i += 3) {
    const tri = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(a, idx.getX(i + k)));
    let pieces = [tri];
    if (tri.some((v) => v.x > -35.5 && v.x < -31 && v.y > 6.9))
      for (const cutter of cutters) {
        if (tri.every((v) => v.z * cutter.side < 0)) continue;
        const next = [];
        for (const poly of pieces) {
          if (
            cutter.edges.some((e) =>
              poly.every((v) => v.clone().sub(e.origin).dot(e.normal) < -1e-9),
            )
          ) {
            next.push(poly);
            continue;
          }
          let remaining = poly;
          for (const edge of cutter.edges) {
            const outside = clip(remaining, edge, false);
            if (outside.length >= 3) next.push(outside);
            remaining = clip(remaining, edge, true);
            if (remaining.length < 3) break;
          }
        }
        pieces = next;
      }
    for (const poly of pieces)
      for (let j = 1; j < poly.length - 1; j++)
        output.push(...poly[0].toArray(), ...poly[j].toArray(), ...poly[j + 1].toArray());
  }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.Float32BufferAttribute(output, 3));
  const result = mergeVertices(raw, 1e-6);
  raw.dispose();
  geometry.dispose();
  result.computeVertexNormals();
  return result;
}
function windshieldSeat(point, normal) {
  // Intersect a frame edge with the original pressure shell along the pane normal.
  const signed = (t) => {
    const p = point.clone().addScaledVector(normal, t),
      f = fuselageProfile(p.x);
    return Math.hypot(p.y - f.y, p.z) - f.r;
  };
  let lo = -1,
    hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (signed(mid) > 0) hi = mid;
    else lo = mid;
  }
  return point.clone().addScaledVector(normal, (lo + hi) / 2 + 0.008);
}
export function windshieldPane(index, side, frame = false) {
  return cached(`777-flat-windshield:${index}:${side}:${frame}`, () => {
    const plane = windshieldPlane(index, side),
      nx = 28,
      ny = 20,
      row = ny + 1,
      n = (nx + 1) * row;
    const positions = [],
      normals = [],
      indices = [];
    for (let face = 0; face < 2; face++)
      for (let i = 0; i <= nx; i++)
        for (let j = 0; j <= ny; j++) {
          const p = plane
            .at(i / nx, j / ny)
            .addScaledVector(plane.normal, (frame ? 0.04 : 0.019) - face * (frame ? 0.014 : 0.01));
          positions.push(...p.toArray());
          normals.push(
            ...plane.normal
              .clone()
              .multiplyScalar(face ? -1 : 1)
              .toArray(),
          );
        }
    const tri = (a, b, c) => (side === 1 ? indices.push(a, b, c) : indices.push(c, b, a));
    const occupied = (i, j) =>
      i >= 0 &&
      i < nx &&
      j >= 0 &&
      j < ny &&
      (!frame || i === 0 || j === 0 || i === nx - 1 || j === ny - 1);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        if (!occupied(i, j)) continue;
        const a = i * row + j,
          b = a + row;
        tri(a, b, a + 1);
        tri(a + 1, b, b + 1);
        tri(a + n, a + 1 + n, b + n);
        tri(a + 1 + n, b + 1 + n, b + n);
        for (const [di, dj, c, d] of [
          [-1, 0, a, a + 1],
          [1, 0, b + 1, b],
          [0, -1, b, a],
          [0, 1, a + 1, b + 1],
        ])
          if (!occupied(i + di, j + dj)) {
            tri(c, d, c + n);
            tri(d, d + n, c + n);
          }
      }
    if (frame) {
      const edges = [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [1, 0],
          [1, 1],
        ],
        [
          [1, 1],
          [0, 1],
        ],
        [
          [0, 1],
          [0, 0],
        ],
      ];
      for (const [start, end] of edges)
        for (let i = 0; i < 28; i++) {
          const points = [];
          for (const t of [i / 28, (i + 1) / 28]) {
            const u = THREE.MathUtils.lerp(start[0], end[0], t),
              v = THREE.MathUtils.lerp(start[1], end[1], t);
            const outer = plane.at((u - 0.5) * 1.1 + 0.5, (v - 0.5) * 1.1 + 0.5);
            points.push(
              windshieldSeat(outer, plane.normal),
              plane.at(u, v).addScaledVector(plane.normal, 0.04),
            );
          }
          const base = positions.length / 3;
          for (const p of points) {
            positions.push(...p.toArray());
            normals.push(...plane.normal.toArray());
          }
          tri(base, base + 2, base + 1);
          tri(base + 1, base + 2, base + 3);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    g.setIndex(indices);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  });
}
export function windshieldSurfacePoint(index, side, u, v, offset = 0.06) {
  const plane = windshieldPlane(index, side);
  return plane.at(u, v).addScaledVector(plane.normal, offset).toArray();
}
export function hullPatch(x0, x1, a0, arc, thickness = 0.045) {
  return cached(`777hull-open:${x0}:${x1}:${a0}:${arc}:${thickness}`, () => {
    const xs = [x0, x1],
      angles = [a0, a0 + arc],
      mid = fuselageProfile((x0 + x1) / 2);
    const nx0 = Math.max(6, Math.ceil((x1 - x0) * (x0 < -30 ? 12 : 3))),
      na0 = Math.max(8, Math.ceil(arc * (x0 < -30 ? 50 : 20)));
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
        for (const angle of angles) {
          if (x < -31 && Math.sin(angle) > 0) {
            const point = noseSurfacePoint(
              x,
              Math.acos(THREE.MathUtils.clamp(Math.sin(angle), -1, 1)),
              Math.cos(angle) >= 0 ? 1 : -1,
              face * thickness,
            );
            positions.push(...point.toArray());
          } else positions.push(x, p.y + r * Math.sin(angle), r * Math.cos(angle));
        }
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
    return x0 < -30 ? cutWindshieldHoles(g) : g;
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
    const rounded = (path, w, h, r) => {
      const x = w / 2,
        y = h / 2;
      path.moveTo(-x + r, -y);
      path.lineTo(x - r, -y);
      path.quadraticCurveTo(x, -y, x, -y + r);
      path.lineTo(x, y - r);
      path.quadraticCurveTo(x, y, x - r, y);
      path.lineTo(-x + r, y);
      path.quadraticCurveTo(-x, y, -x, y - r);
      path.lineTo(-x, -y + r);
      path.quadraticCurveTo(-x, -y, -x + r, -y);
    };
    rounded(outer, width, height, 0.12);
    rounded(inner, width - 0.048, height - 0.048, 0.096);
    outer.holes.push(inner);
    return new THREE.ExtrudeGeometry(outer, {
      depth: 0.025,
      bevelEnabled: false,
      curveSegments: 16,
      steps: 1,
    });
  });
}

/** Glazing and its surround conform to the actual shell, including the aft taper. */
export function passengerWindow(x, y, side, surround = false) {
  const profileKey = [-0.2, 0, 0.2]
    .map((dx) => {
      const p = fuselageProfile(x + dx);
      return [p.r, p.y].map((n) => n.toFixed(8)).join(',');
    })
    .join(':');
  return cached(`777-conformal-window:${profileKey}:${y}:${side}:${surround}`, () => {
    const g = surround
      ? windowRing(0.37, 0.52).clone()
      : ovalPanel(0.32, 0.47, 0.012, 0.096).clone();
    const a = g.attributes.position,
      normals = g.attributes.normal,
      p = fuselageProfile(x);
    const z0 = side * Math.sqrt(p.r * p.r - (y - p.y) ** 2);
    for (let i = 0; i < a.count; i++) {
      const dx = a.getX(i),
        dy = a.getY(i),
        depth = a.getZ(i);
      const f = fuselageProfile(x + dx),
        radius = f.r + (surround ? 0.009 : 0.024) + depth;
      const z = side * Math.sqrt(radius * radius - (y + dy - f.y) ** 2);
      a.setXYZ(i, dx, dy, z - z0);
      const before = fuselageProfile(x + dx - 0.001),
        after = fuselageProfile(x + dx + 0.001);
      const dr = (after.r - before.r) / 0.002,
        dc = (after.y - before.y) / 0.002;
      const radial = new THREE.Vector3(
        -(y + dy - f.y) * dc - radius * dr,
        y + dy - f.y,
        z,
      ).normalize();
      const tx = new THREE.Vector3(1, 0, ((y + dy - f.y) * dc + radius * dr) / z).normalize();
      const ty = new THREE.Vector3(0, 1, -(y + dy - f.y) / z).normalize();
      const n = tx
        .multiplyScalar(normals.getX(i))
        .add(ty.multiplyScalar(normals.getY(i)))
        .add(radial.multiplyScalar(normals.getZ(i)))
        .normalize();
      normals.setXYZ(i, n.x, n.y, n.z);
    }
    a.needsUpdate = true;
    normals.needsUpdate = true;
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
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
