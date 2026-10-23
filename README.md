# GE90–115B · Anatomy Engine Laboratory

A real-time, freely orbitable engineering exhibit for the GE90–115B turbofan used on the Boeing 777–300ER. Built with React, Three.js and the repository-local Anatomy skill. The engine is procedural 3D geometry, not a photograph or a pre-rendered animation.

## Run

Requires Node.js 24+ (pinned and validated with Node 24.19), npm, and a browser with WebGL 2.

```sh
npm ci
npm run dev
```

The development server listens on port 5173. No API keys, external services, CDN assets or model downloads are needed at runtime. Fonts and all application dependencies are bundled locally.

```sh
npm test                 # Mechanical and assembly invariants
npm run audit            # Drawn-mesh radial clearance / transform audit
npm run build            # Production assets in dist/
npm run preview          # Serve the production build
npm run test:e2e          # Build, serve, test real Chromium interactions and save screenshots
npm run docs:hierarchy   # Export every ID, parent, material, metadata and original local mount
```

`test:e2e` uses `/usr/bin/chromium` by default. Set `CHROME_PATH` to another Chromium executable; set `APP_URL` to test an already-running server instead of starting a production preview on port 4173. Local browser sockets require an execution environment that permits Chromium. npm's default cache can be overridden with `npm ci --cache /tmp/ge90-npm-cache` if the home directory is not writable.

## Explore the engine

- **Orbit:** left-drag or one-finger drag. **Pan:** right-drag or two-finger drag. **Zoom:** wheel or pinch.
- **Select:** click geometry or a hierarchy row. Every blade, vane, casing, shaft, bearing, fitting and fastener has an individual identity, including GPU instances.
- **Find:** search the hierarchy by name, ID or material. Expand a module to reach its individual stages and parts.
- **Inspect:** double-click a part, or select **Isolate**. **Focus** frames it closely. The inspector shows its actual geometry outline, material, parent, purpose and mechanical relationship.
- **Detach:** remove the required blocking component first. A fan blade needs its spinner removed; an individual compressor stage needs its casing and shaft clear. A cutaway changes visibility and does not satisfy physical removal dependencies.
- **Rotate a detached part:** use the inspector's X/Y/Z rotation controls or arrow keys while the viewport is focused. Camera orbit remains available independently.
- **Reattach:** returns the component to its exact saved local mount. Covers cannot close while the parts they block remain detached.
- **Explode / Reassemble:** separates nested modules, stages, blades and casing segments along organized paths. Reassemble any individually removed components before requesting a complete exploded view. Reassembly respects the dependency graph.
- **Cutaway:** removes the near portion of the bypass duct and upper-near core casing sectors; it preserves the underlying component identities and transforms.
- **Airflow:** blue bypass and warm core tracers show separate depth-tested flow paths. An internal annular combustion effect follows the heat model. The GE90 has no afterburner; there is no decorative rocket exhaust.
- **Start / Stop:** educational starter, light-off, idle, power-up, high power and shutdown states. The throttle sets normalized power; speed changes demonstration time. Any required detached component freezes operating motion and disables flow. Reassembly resets the demonstration to a cold, stopped state and requires an explicit restart.

Viewport shortcuts: **F** focus, **D** detach, **A** reattach, **Space** start/stop, **Home** reset camera, **Escape** clear isolation. Arrows orbit/zoom; with a detached part selected, arrows rotate that part. The tree supports arrow navigation and expand/collapse. Reduced-motion preferences suppress continuous rotor motion, camera transitions and animated effects while keeping controls and state readouts functional. On narrow screens the hierarchy and inspector become drawers.

## What is modeled

The scene contains **3,443 registered components** in a true nested hierarchy. [Component hierarchy](docs/COMPONENTS.md) describes the modules, ownership and removal rules. [The generated inventory](docs/component-hierarchy.json) includes every component and its original local mount.

| System | Architecture |
| --- | --- |
| Fan | One stage, 22 separately selectable swept composite blades; 128-inch blade-tip diameter |
| Booster | Four LP compressor stages |
| HP compressor | Nine stages; first three stator rows have an illustrative variable-incidence schedule |
| Combustor | Annular dome, inner and outer liner sectors, dilution-opening representations, nozzles and manifold |
| HP turbine | Two stages, coupled to the HP compressor |
| LP turbine | Six stages, coupled to the fan and booster |
| Shafts | Separate concentric LP and HP shaft systems, bearing races/rollers and support frames |
| Exterior | Inlet, acoustic liner, containment case, splitter, nacelle/bypass duct, case sectors, panels, flanges and separate exhaust structures |
| Accessories | Representative gearbox, starter, control unit, fuel/oil hardware, harnesses, connectors and clamps |
| Support | A maintenance-style display cradle with rails, crossbeams, uprights, saddles and isolation feet |

The GPU depth buffer handles arbitrary camera angles and concave engine geometry. Repeated parts share geometry and use individually addressable instances. Internal blade/vane rows switch to a lighter tessellation at exhibit distance and full inspection geometry on close approach. Nothing independently detachable is permanently merged. Rendering stops when the exhibit is settled or offscreen. A single animation loop owns mechanical state, assembly motion, camera interpolation and WebGL effects.

## Engineering sources and approximations

Consulted: [GE Aerospace's GE90 engine-family page](https://www.geaerospace.com/commercial/aircraft-engines/ge90) and its [public GE90–115B photograph](https://www.geaerospace.com/sites/default/files/2023-12/ge90-115b-engine.jpg).

The official page independently confirms the **1/4/9 fan/booster/HPC stages**, **6/2 LP/HP turbine stages**, composite fan construction and the Boeing 777–300ER application. It lists **135 inches as maximum engine diameter**; that is distinct from the project's **128-inch fan diameter**. The 22-blade fan and 128-inch fan specification follow the project reference. The photograph informed the swept blade shape, spinner, containment ring and inlet appearance. Source retrieval initially failed under the old network policy and succeeded after the environment update.

Only the fan diameter is dimensionally referenced in the generated model. Other lengths, diameters, blade chord/twist distributions, non-fan airfoil counts, stator schedules, fuel-nozzle counts, cooling apertures, bearing arrangements, accessory locations and removal vectors are **educational approximations**. The model does not reproduce unpublished GE drawings, cooling passages, certified maintenance access sequences, a complete aircraft nacelle/reverser system or a manufacturing bill of materials. Attachment representations include deliberate seated/root contacts.

N1 and N2 are normalized educational spool percentages, not certified RPM measurements. All rotors on one spool share exactly the same underlying angular state. Maximum visual rotation is deliberately slowed for inspection. Thrust uses a simple quadratic function of N1 with a roughly 513 kN reference scale; temperature follows an eased heat state. These values and transient timings are illustrative, not validated engine performance predictions. They appear as such in the UI. The physical model does not calculate thermodynamics, blade stresses, real fuel scheduling or flight performance.

## Source organization

```text
src/engine/       Public architecture, registry, dependency/disassembly controller,
                  two-spool state model and shared mechanical transforms
src/scene/        Procedural geometry, PBR materials, nested assembly generation,
                  camera/selection/render loop, world-space airflow and combustion
src/components/   Assembly tree, live instruments, actual-geometry inspector,
                  viewport, controls and reference notes
scripts/          Geometry/transform audit and hierarchy export
tests/            Mechanical tests and production-browser interaction suite
docs/             Architecture, design and verification evidence/screenshots
.agents/skills/anatomy/  Installed original Anatomy skill and its examples/references
```

Anatomy's `smooth` and `settle` functions are reused directly from the installed kit. Its Raptor and turning-dial examples informed assembly ownership, reversible paths, materials, interlocks and verification. Three.js replaces the skill's beta convex SVG turning renderer for this freely orbitable, multi-thousand-part scene; SVG painter-order/line-end audit claims do not apply to this renderer.

## Verification and limits

See [verification notes](docs/VERIFICATION.md), [mesh audit](docs/geometry-audit.json), and the generated browser result in `docs/verification.json`. Screenshots are actual browser captures in [docs/screenshots](docs/screenshots): assembled, cutaway, exploded and operating states, plus interaction and responsive evidence.

The geometry audit checks actual mesh radial envelopes, shaft/disk clearances, continuity and exact restoration. It is not an exhaustive triangle-intersection proof for every possible arbitrary detached-part rotation. Hardware 60 FPS remains a target; cloud Chromium uses SwiftShader and does not establish desktop GPU performance. Reduced-detail geometry retains component identity and selection. A production device/GPU and cross-browser performance review remains appropriate for a public exhibit deployment.
