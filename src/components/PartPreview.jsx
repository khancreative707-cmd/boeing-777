import { useMemo } from 'react';
import * as THREE from 'three';
const edgesCache = new Map();
/** A small CAD edge projection of the selected geometry, not a generic illustration. */
export function PartPreview({ lab, id }) {
  const paths = useMemo(() => {
    const selected = lab.registry.get(id);
    if (!selected) return '';
    lab.root.updateMatrixWorld(true);
    const inverse = selected.object.matrixWorld.clone().invert();
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(-5, 3, 7);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const segments = [];
    let candidates = lab.registry.descendants(id);
    if (id === 'aircraft')
      candidates = candidates.filter(
        (p) =>
          /^aircraft\.fuselage\.skin\./.test(p.id) ||
          /^aircraft\.wings\.(left|right)\.(skin|raked-tip)/.test(p.id) ||
          p.id.startsWith('aircraft.tail.') ||
          p.id.includes('.exterior.nacelle.q'),
      );
    for (const p of candidates.slice(0, 180))
      for (const visual of p.visuals) {
        const geometry = visual.mesh.geometry;
        let edges = edgesCache.get(geometry.uuid);
        if (!edges) {
          const e = new THREE.EdgesGeometry(geometry, 28);
          edges = e.attributes.position;
          edgesCache.set(geometry.uuid, edges);
          e.dispose();
        }
        const matrix = inverse.clone().multiply(p.object.matrixWorld);
        const orient = camera.matrixWorldInverse.clone().multiply(matrix);
        const stride = Math.max(1, Math.ceil(edges.count / 3000)) * 2;
        for (let i = 0; i + 1 < edges.count; i += stride) {
          const a = new THREE.Vector3().fromBufferAttribute(edges, i).applyMatrix4(orient),
            b = new THREE.Vector3().fromBufferAttribute(edges, i + 1).applyMatrix4(orient);
          segments.push([a.x, -a.y, b.x, -b.y]);
        }
      }
    if (!segments.length) return '';
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (const [x, y, u, v] of segments) {
      minX = Math.min(minX, x, u);
      maxX = Math.max(maxX, x, u);
      minY = Math.min(minY, y, v);
      maxY = Math.max(maxY, y, v);
    }
    const scale = Math.min(128 / Math.max(0.01, maxX - minX), 108 / Math.max(0.01, maxY - minY));
    const cx = (minX + maxX) / 2,
      cy = (minY + maxY) / 2;
    return segments
      .map(
        ([x, y, u, v]) =>
          `M${(90 + (x - cx) * scale).toFixed(1)},${(70 + (y - cy) * scale).toFixed(1)}L${(90 + (u - cx) * scale).toFixed(1)},${(70 + (v - cy) * scale).toFixed(1)}`,
      )
      .join('');
  }, [lab, id]);
  return (
    <svg
      className="blade-mark"
      viewBox="0 0 180 145"
      fill="none"
      aria-label={`Geometry outline of ${lab.registry.get(id)?.name}`}
    >
      <path d={paths} stroke="currentColor" strokeWidth=".65" opacity=".85" />
    </svg>
  );
}
