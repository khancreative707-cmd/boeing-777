# Verification record

The flow under test is: open the production exhibit → select geometry or a hierarchy item → detach after satisfying prerequisites → inspect and reattach → explode/reassemble → operate the two-spool simulation with airflow → use the same controls on a narrow screen.

## Interaction polish validation — 2026-11-02

33 model tests and 69 geometry checks passed. The production browser suite passed 18 workflows with zero application console errors, including new checks for chapter navigation, fractional assembly spread, exact closure, automatic orbit, direct-input takeover and reduced motion. The latest tour cutaway, aspect-aware component framing and Show complete engine refinements were subsequently checked with the four exploration model tests and a focused Chromium run at 1600×1000 and 390×844. That run confirmed visible internal rotors, hidden cutaway casing sectors, tour exit, mobile drawer operation and header bounds, and refreshed the tour/mobile captures. Results are recorded separately in `verification.json` under `polishVisualChecks`.

The Browser plugin was not available; Chromium/Playwright was used. Cloud SwiftShader rendering verifies behavior and layout, not hardware 60 FPS. Screenshots were visually inspected for layout, depth and unwanted clipping. New evidence: `screenshots/guided-tour.png`, `screenshots/assembly-spread.png` and `screenshots/mobile-tour.png`. The earlier concept layout is retained; new controls live in the existing hierarchy, inspector and camera toolbar.

## Evidence and commands

Reconnected validation on 2026-10-23: production build and formatting passed; 29 model tests passed; 69 geometry checks passed. The 15-flow Chromium suite passed with zero application console errors after the GPU queue correction. Subsequent visual review corrected isolation and liner-marker ownership; the final build was validated with the expanded model tests and supplementary browser captures of the main views, mobile framing, isolation and intermediate explosion poses. The full 15-flow suite was not repeated after those localized corrections. `verification.json` preserves the full-suite timestamp and the later supplementary completion timestamp separately.

- `npm test`: mechanical tests exercise the actual registry/assembly and shared simulation functions, including counts, mounts, interlocks, independent spools, stationary rows and transition reversal.
- `npm run audit`: 69 mesh-envelope, mount-clearance and transform-path checks, against actual drawn geometry; report in `geometry-audit.json`.
- `npm run test:e2e`: builds and serves the production app, launches Chromium with Playwright, exercises real controls and raycast selection, and captures screenshots. The Browser plugin is not installed, so Playwright is the supported fallback. Results, console output and GPU identity are in `verification.json` when the run completes.

## Fidelity review ledger

Concept: `docs/design-concept.png`, inspected with `view_image` alongside actual browser captures at 1600×1000. The concept's engine is visual direction; the shipped subject is interactive procedural 3D. It is not replaced with the concept image.

| Inspection point | Render evidence / correction |
| --- | --- |
| Layout | Persistent left hierarchy, central viewport, right inspector, bottom operating controls and status bar. Narrow view uses drawers. Increased sidebar widths and type sizes after first capture. |
| Typography | Locally bundled Inter and IBM Plex Mono. Distinct model heading, component heading, body copy, technical labels and numerical readouts. Corrected initially undersized hierarchy/body text. |
| Palette/materials | Warm neutral paper, graphite composite and satin PBR metals; one copper selection accent. Removed an overlit white floor and excessive material exposure. |
| Geometry/camera | Actual 22-blade swept/thick fan, separate stage rows and shafts. Enlarged default view and widened exploded camera to keep long extracted shafts in frame. |
| Inspector | Actual selected-part geometry edge projection, parent navigation, live removal state and working dependency controls. Replaced generic repeated blade artwork. |
| Controls | Real throttle, camera, disassembly, reassembly, visibility, isolate and airflow actions. Operation freezes when required components leave their mounts. |
| Motion | Corrected a duplicate-RAF scheduling bug found during browser testing. One loop now owns the viewport; reversals continue from current transforms. |

The visible copy follows the requested exhibit information architecture. Intentional corrections to the generated concept: original Anatomy turbine mark rather than a GE corporate logo; actual registry count rather than '12 components'; truthful educational removal notes instead of an invented AMM procedure; component-specific copy and IDs; added required Focus, rotation and responsive panel controls. There are no invented marketing claims or hero sections. The procedural rendering is an educational model and does not claim photorealistic CAD fidelity to the concept image.

## Audit scope

The supplied Anatomy SVG/turning-renderer audits use convex SVG painter order and their own recorder. This application uses Three.js and a hardware depth buffer, so reporting `turn audit passed` or SVG `line ends: 0` would be misleading. The relevant methods are retained: actual geometry, one source for motion, reversible path sampling, multiple orbit/transition states, close inspection and real browser interaction. The separate mesh audit states exactly what it checks and what it does not.

The automated audit is not an exhaustive collision solver for every user-chosen detached orientation. Root attachments and fitted contacts are educational representations. High-power instrumentation is illustrative and not a validated thermodynamic model. Cloud Chromium uses SwiftShader; hardware 60 FPS, other GPU drivers, and a broad cross-browser/device matrix remain unverified.

## Performance correction

The cloud's SwiftShader renderer exposed heavy shadow and instance work during removal. The registry now caches parent chains and updates only changed instance matrices/material states. Real GPU rendering keeps the 2048px VSM studio shadow; software rendering uses a smaller PCF shadow, capped pixel ratio, less frequent shadow refresh and a 10 FPS rendering ceiling. Reconnected verification exposed a timeout clicking Detach during powered operation: a frame-rate ceiling alone still allowed slow GPU work to accumulate. A nonblocking WebGL fence now prevents submitting another software frame until the previous GPU work finishes. Simulation and input continue between rendered frames. Inspection geometry and part identities are retained at either quality level. The browser report records the detected renderer, GPU backpressure, rendering submission time and active frame-rate limit rather than claiming hardware performance from software results.

## Refinements found in close inspection

- The fan airfoils use thick, twisted sections constrained to a circular 128-inch tip envelope, a swept planform, separate leading edges/root attachments and a rotation-visibility spiral on the rounded spinner.
- Bearing races were moved into gaps between the stage disks rather than sharing a rotating disk volume. Support frames are independently removable; rollers require the retaining frame and outer race to be clear. A model test measures their axial separation from neighboring parts.
- Independent inspection rotates about the selected object's actual geometry center. Its original mounting position/quaternion remain unchanged and exact after return.
- Cutaway-hidden sectors become visible when detached, including their children. Returning them reapplies the cutaway. Visibility changes and inspection rotations refresh their shadows.

- A detached descendant keeps its world position and orientation when its parent is later removed or inspected. The controller counter-transforms it against the parent’s current pose; return motion seats it in the current parent frame without overwriting its original mount. Both nested motion and the first frame under a frozen spool are regression-tested.
- Phone framing adapts to the viewport aspect instead of cropping an oversized canvas. The supplementary capture asserts that projected assembly bounds remain inside the mobile viewport.
- Final screenshot inspection caught parent disk geometry remaining visible during individual blade isolation. Parent transform groups now remain active while their own meshes are hidden. The regression checks distinguish transform-frame visibility from physical geometry visibility; isolated blade, liner and gearbox captures also reject unrelated visible geometry.
- Dilution-opening representations now belong to their corresponding outer liner sector, use the actual tapered liner radius and face radially outward. Hiding or removing a sector carries its markers with it; a regression test checks all 144 markers and hidden-sector visibility.
- Aborting startup stays in Shutdown while either spool is turning. The last telemetry frame is always published when the phase changes or the engine settles, avoiding stale nonzero readings beside Engine stopped.
