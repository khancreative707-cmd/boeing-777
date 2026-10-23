import { writeFile } from 'node:fs/promises';
import { EngineLab } from '../src/engine/lab.js';
const lab = new EngineLab();
await writeFile(
  new URL('../docs/component-hierarchy.json', import.meta.url),
  JSON.stringify(
    {
      model: 'GE90-115B',
      units: 'metres; only fan diameter is dimensionally referenced',
      componentCount: lab.parts.length,
      components: lab.exportHierarchy(),
    },
    null,
    2,
  ) + '\n',
);
console.log(`Exported ${lab.parts.length} components, metadata and original local mounts.`);
