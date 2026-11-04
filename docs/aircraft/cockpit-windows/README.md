# Boeing 777 cockpit-window refinement

The aircraft now uses six flat angular panes: two broad front windshields, two corner panes and two rear side panes. A narrow center post, perimeter frames and parked wiper representations complete the visible cockpit glazing layout. This replaces the earlier rounded glazing treatment.

The existing nose has real mesh apertures cut by the pane footprints. Structural frame seats bridge the original curved pressure shell to the flat panes, avoiding both protruding body geometry and floating frames. Each pane, frame and wiper part retains an individual ID and removal mount. Wiper sweep is not simulated. The aircraft inventory contains 11,848 entries.

This follows the Boeing 777 six-pane appearance, fitted to the project's procedural nose; it is an educational reconstruction rather than copied proprietary Boeing CAD or verified manufacturing dimensions.

Validation: 20 aircraft tests pass. The windshield regression checks left/right symmetry, front-face planarity and actual ray clearance through the nose apertures. The production build and aircraft geometry audit pass. `node scripts/verify-aircraft-cockpit-windows.mjs` captures front and both quarter views with actual component raycast selection and no application console errors. Playwright/Chromium is used because the Browser plugin is unavailable. Final images were visually inspected for clean, straight pane boundaries, framing, nose integration and shading. See [verification.json](verification.json).
