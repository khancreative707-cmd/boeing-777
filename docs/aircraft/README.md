# Boeing 777–300ER aircraft exhibit

See the latest [visual polish and bug-fix verification](polish/README.md) for improved inspection framing, phone layout, paint and hidden-batch rendering.

The [mobile interface](mobile/README.md) adds a compact touch dock, overlay controls, scrollable camera toolbar and accessible component drawers. Run `npm run test:mobile` to reproduce its viewport and interaction checks.

The aircraft extends the original Anatomy GE90 laboratory with a freely orbitable whole-aircraft assembly. React owns the interface; Three.js draws procedural geometry with depth testing, shared materials and separately addressable GPU instances. Anatomy supplies the craft approach and its `smooth` / `settle` motion functions. The original installed skill, examples and references remain in `.agents/skills/anatomy/`.

## Run and deploy

```sh
npm ci
npm run dev
# Production:
npm run build
npm run preview
```

Open the development server on port 5173. `/` opens the aircraft; `/?view=engine` opens the original standalone engine. No runtime API keys, external model downloads or network requests are required. On Vercel, use the **Vite** preset, build command `npm run build`, output directory `dist`, and Node 24. Deploying this repository produces both views at those URLs.

## Explore and operate

- Orbit with left drag, pan with right drag, zoom with wheel/pinch. Camera presets frame the exterior, front, side, top, underside and internal spaces. Auto orbit yields to manual camera input.
- Click a physical component to select it; double-click to isolate. The searchable hierarchy reaches all nested parts. Visibility switches and Skin / Structure / Interior / Systems layers preserve identities. Sectional view opens shell quadrants, near-side frame segments and upper wing skins.
- The inspector shows purpose, parent, material, relationship and attachment state. **Focus** frames actual geometry. **Operate component** links an appropriate physical control to its mechanism. **F**, **D**, **A**, **Home**, **Escape** focus, detach, reattach, reset camera and exit isolation. Arrows rotate a selected loose part; otherwise they operate the camera.
- Independent L/R engine start controls and throttles feed separate two-spool simulations. **Engine lab** opens the mounted left engine; its L/R buttons switch engines while preserving state. Fan/booster/LPT/LP shaft share LP state; HPC/HPT/HP shaft share HP state. Stationary rows remain still; the modeled variable stators follow an illustrative schedule.
- Flaps command the associated slats and flaperon schedule. The **Mechanisms** panel exposes spoilers, ailerons, elevators, rudder, overhead bins, cargo doors, supports, airflow, demonstration speed (¼–2×) and **Park aircraft**. Speed affects engine/mechanism time; camera and removal paths retain their own easing. Doors include a staged passenger plug-clearance/hinge motion and top-hinged cargo leaves; passenger sills stay on the fixed airframe. Gear doors open before gear motion and close at the endpoints. Main gear has two six-wheel trucks; nose gear has two wheels. Actuator barrels/pistons span fixed and moving mounts throughout the cycle.
- Gear retraction engages three maintenance supports and waits for engine shutdown. Supports cannot release while gear is retracted. Passenger/cargo doors cannot open while engines are operating; open doors block startup. Disassembly requires parked mechanisms and supports for designated load-bearing assemblies.
- Detach enclosing skins/covers before internal parts. A cutaway only changes visibility. A detached child keeps its cover from closing, and an assembly cannot bypass external dependencies belonging to its children. Detaching any required component freezes both operating models and airflow. Reassembly restores the cold demonstration; restart explicitly.
- Loose parts retain independent X/Y/Z inspection rotation and original local mounts. Assembly spread is reversible and nested, either across the aircraft or within an isolated assembly. Supports engage before whole-aircraft spread. **Reassemble** restores all removed/spread components in dependency order. Supports remain engaged until explicitly released.
- The eight-chapter aircraft tour selects real assemblies and restores prior visibility/layers on exit. Narrow screens use assembly/inspector drawers. Reduced-motion mode removes continuous rotor movement, camera travel and effect motion while retaining meaningful control states and maintenance sequencing.

## Assembly ownership

The current registry contains **11,848 entries**, including assembly frames and individually modeled physical parts. Every entry records a unique ID, parent, original position/quaternion/scale, material, purpose, mechanical relationship, removal vector, explode vector and blockers. The complete reproducible inventory is [component-hierarchy.ndjson](component-hierarchy.ndjson), one JSON object per line. Generate it with `npm run audit:aircraft`.

| Root | Contents |
| --- | --- |
| `aircraft.fuselage` | Thick curved shell sections with real door apertures, window/rim units, circumferential frame segments, stringers and pressure bulkheads |
| `aircraft.doors` | Ten passenger and two cargo door assemblies, leaves, frames and hardware |
| `aircraft.wings` | Center-box representation, wing-body fairing, two swept airfoil wings, separate raked tips, ribs, spars, control surfaces, tracks, fittings and telescopic flap actuators |
| `aircraft.tail` | Fin, rudder, two stabilizers and separate elevators |
| `aircraft.gear` | Three gear assemblies, fourteen tires, hubs/brakes, struts, braces, six-wheel trucks, gear doors and retraction actuators |
| `aircraft.supports` | Three maintenance jacks with feet, columns and saddles |
| `aircraft.engines.left/right` | Pylon and complete nested GE90 assemblies; 22 fan blades and 4/9/2/6 booster/HPC/HPT/LPT stages per engine |
| `aircraft.cabin` | Representative two-class seating with individual cushions/backs/frames/arms/legs, floor/rails, bins/lids/latches, lights, service modules and partitions |
| `aircraft.cargo` | Lower floors, rails and representative containers, leaving the center wing-box volume clear |
| `aircraft.cockpit` | Seats, yokes, pedals, panel, thrust levers, equipment and two live engine/gear displays |
| `aircraft.systems` | Supported representative hydraulic/electrical/air/fuel routes, terminals/clamps, equipment racks and an APU representation |

GPU batching crosses parent frames without merging component identities: each instance matrix is calculated from its own component world frame. Repeated geometry is cached. Hidden interior structures and detailed engine internals are culled in the opaque exterior view and enabled for relevant inspection. Existing engine blade/vane tessellation uses distance-dependent detail. The render loop sleeps when settled or offscreen; software WebGL uses GPU fences and a 10 FPS ceiling to keep interaction responsive. Desktop hardware 60 FPS is a target, not a measured result from cloud SwiftShader.

## Model and source boundary

The exterior uses a **73.86 m length, 64.8 m span, 18.5 m height and approximately 6.2 m fuselage diameter** as public 777–300ER envelope targets. The actual generated hull/wing/fin extents are checked by the mesh audit. Raked wingtips, twin GE90s, long fuselage, ten passenger doors and six-wheel main trucks distinguish the variant.

Public references: [Boeing airport-planning manuals](https://www.boeing.com/commercial/airports/plan-manuals), [GE Aerospace GE90](https://www.geaerospace.com/commercial/aircraft-engines/ge90) and GE's [public GE90–115B image](https://www.geaerospace.com/sites/default/files/2023-12/ge90-115b-engine.jpg). The configured cloud proxy blocked Boeing retrieval with HTTP 403 during this implementation; its manuals were **not successfully downloaded or independently checked here**. GE sources were retrieved during the engine work. The GE page confirms the engine stage architecture and application; the 22-blade/128-inch fan follows the project reference. Link availability is not evidence of source retrieval.

Profiles, structure spacing, airfoils, control-surface proportions and schedules, flap tracks, gear kinematics, door swing/plug paths, attachment rules, cockpit equipment, cabin configuration, systems, pylon/fairing geometry, internal engine dimensions and removal paths are **educational approximations**. The center wing box and APU are representative assemblies; fuel tanks, pressure seals, anti-ice plumbing, full aircraft wiring, real hydraulics, complete avionics, engine reverser kinematics and flight physics are not reproduced. Interior labels make no airline seating-capacity claim. Solid panels and seated mechanical contacts intentionally simplify construction.

Engine N1/N2, thrust and temperature are illustrative state values, with slowed visual rotation. Gear/flap readouts, thrust-lever poses, live cockpit screens, rotor motion and airflow use the same simulation/mechanism models. Other cockpit displays and switches are passive geometry unless an explicit **Operate component** action is provided. There is no first-person walking mode or flying simulation.

## Design and verification

The exterior and sectional concept images in this directory established the warm off-white studio, restrained copper selection, substantial geometry and three-panel workbench. The implementation retains the existing Inter / IBM Plex Mono typography and Anatomy interface tokens. Raked tips replace the image concepts' inaccurate curved tips. Camera composition leaves the whole aircraft visible and separate close-ups expose the cabin, cockpit, engines and individual assemblies. Real frames, ribs, seats and fasteners supply inspection detail; generated images are references only, never used as the aircraft.

```sh
npm test                 # Engine + aircraft model and disassembly tests
npm run audit            # Original GE90 mesh/transform audit
npm run audit:aircraft   # Aircraft mesh/paths and complete inventory
npm run test:engine      # Original exhibit production-browser regression
npm run test:aircraft    # Aircraft production-browser interactions/screenshots
npm run capture:aircraft-motion # Repeatable normal-motion gear/door WebGL frames
npm run format:check
```

The Browser plugin is unavailable in this environment, so browser verification uses Playwright and installed Chromium with real WebGL/SwiftShader. [Browser results](verification.json) and [geometry audit](geometry-audit.json) record actual checks. The mesh audit examines shell extents, frame/stringer radial clearance, all twelve actual shell apertures, fourteen tire ground contacts, actuator endpoint attachment through sampled motion, exploded reversals and exact mount restoration. Model tests cover identity, engine architecture/coupling, blockers, interlocks, layers and maintenance sequences. Browser checks exercise physical picking, sectional views, gear/flaps, individual removal/rotation/return, independent engines, cockpit, fractional explosion, keyboard/dialogs/tour and phone drawers.

Screenshots in [screenshots](screenshots/) show actual rendered assembled, sectional, exploded, operating, cockpit and individual inspection states. [Motion captures](motion-verification.json) use deterministic 60 Hz stepping of the normal model with the demand loop temporarily suspended to obtain repeatable intermediate gear/door frames; the actual production WebGL scene is rendered at each step. The separate browser suite exercises the demand loop and UI. Sampled path checks are not an exhaustive triangle-collision proof for arbitrary user rotations, and these dependency rules are not certified maintenance instructions. The exhibit should receive hardware-GPU/cross-browser performance testing before a production museum installation.
