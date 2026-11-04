# Aircraft visual and bug-fix pass

Fixed the phone camera toolbar overlapping the aircraft title. Mobile camera controls now follow the heading in normal layout; the return-from-isolation button also clears the airflow legend.

Component focus now calculates distance from the bounding sphere, camera field of view and viewport aspect, reserving space for controls and readouts. This replaces the fixed distance multiplier that cropped tall seats and gear assemblies. The exploded camera is closer to the aircraft for more useful inspection.

Fully hidden instance batches are excluded from rendering and restored on reveal. Individual component identities, matrices and selection mappings remain intact. Partially visible batches still submit shared instances; this is not full instance compaction. In the recorded production run, the exterior submitted 374 draw calls / 622,794 triangles and the isolated seat 7 calls / 157,546 triangles. Software rendering does not establish hardware FPS.

Paint uses a slightly cooler, darker satin finish to separate curved surfaces from the warm studio background. Geometry and public architecture counts are unchanged.

Validation: 52 model tests passed; production build passed. `node scripts/verify-aircraft-polish.mjs` checks actual projected part bounds, hidden-batch visibility, mobile toolbar/title separation, overflow, sectional interaction and console health. Browser plugin unavailable: Playwright with installed Chromium was used. See [verification.json](verification.json) and the four actual browser screenshots in this directory. Screenshots were inspected for silhouette, object framing, controls, depth and mobile layout. The older complete aircraft browser report remains separate; this pass ran focused checks rather than repeating every operating/disassembly workflow.
