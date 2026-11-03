import { ComponentRegistry } from '../engine/registry.js';
import { AircraftBuilder } from './builder.js';
import { buildFuselage } from './fuselage.js';
import { buildWings } from './wings.js';
import { buildLandingGear } from './landing-gear.js';
import { buildInterior } from './interior.js';
import { buildSystems } from './systems.js';
import { buildMountedEngines } from './engines.js';
import { poseLinkages } from './linkages.js';
export function buildAircraft(materials) {
  const registry = new ComponentRegistry();
  const root = registry.add({
    id: 'aircraft',
    name: 'Boeing 777–300ER',
    kind: 'root',
    material: 'Multi-material aircraft assembly',
    purpose:
      'A long-range twin-engine widebody aircraft, presented as an educational mechanical exhibit.',
    relationship:
      'Fuselage, wings, tail, landing gear, cabin, cockpit, systems and two GE90–115B engines.',
  });
  const b = new AircraftBuilder(registry, materials);
  buildFuselage(b);
  buildWings(b);
  buildLandingGear(b);
  buildInterior(b);
  buildSystems(b);
  buildMountedEngines(b);
  // Access dependencies apply to the individual interior pieces, not only their modules.
  for (const p of registry.entries.values()) {
    if (p.engineSide) continue;
    const covers = p.ancestorRefs.flatMap((a) => a.blockers).filter((id) => id.includes('.skin.'));
    p.blockers = [...new Set([...p.blockers, ...covers])];
  }
  root.object.updateMatrixWorld(true);
  poseLinkages(registry, b.linkages, { captureMounts: true });
  b.flush(root.object);
  registry.visibilityDirty = true;
  registry.dirty = true;
  registry.sync();
  return { registry, root: root.object, joints: b.joints, linkages: b.linkages, casingParts: [] };
}
