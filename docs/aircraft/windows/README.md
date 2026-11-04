# Cabin-window correction

Passenger glazing previously used flat tilted panels intersecting the curved shell, an elliptical surround with a different outline, and reversed surround offsets on the opposite side. The new rounded rectangular glazing and matching surrounds follow the actual fuselage profile, including the aft taper, with outward-facing clearance on both sides. Geometry is still shared where the shell profile is identical, and each window retains its own selectable component and parent shell.

Smooth surface normals replace flat triangle normals to remove shard-like reflections. Glazing uses a less metallic, softer reflective material.

Validation: 19 aircraft model tests pass, including a new check of every window/surround vertex and triangle center against the actual shell. The production build passes. `node scripts/verify-aircraft-windows.mjs` captures the actual production WebGL scene and confirms window raycast selection on left, right and aft close-ups, with no application console errors. Browser plugin unavailable; Playwright and installed Chromium used. All three final screenshots were visually inspected for consistent silhouettes, surround fit and smooth shading. See [verification.json](verification.json).
