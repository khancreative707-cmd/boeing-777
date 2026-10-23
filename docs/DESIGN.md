# Exhibit design and construction plan

Epic scope: a real freely orbitable, two-spool turbofan whose object is the explanation. Rotors connect to the appropriate shaft; stationary vane rows support compression and expansion; two visible flow paths meet the same simulation state. Three.js uses a hardware depth buffer for the concave, independently detachable engine. Anatomy's SVG painter and convex turning-group engine are unsuitable for this scope. Its `smooth`/`settle` envelopes are reused directly, alongside its craft, material, group, motion and verification principles.

## Primary screen

Concept: `docs/design-concept.png`.
Light warm-neutral background #f5f4f0; panel #faf9f6; ink #303632; muted #777b76; fine border #dedfd8; copper #b85f35. Inter UI 12–14px, 26px heading; IBM Plex Mono data 10–24px. 56px header, 250px left assembly tree, flexible viewport, 280px right inspector, bottom controls and status. No image substitute for the engine. Restrained 16px outline icons. Below 1100px the inspector is a dismissible drawer; below 760px panels become drawers and instruments/controls reflow.

UI copy follows the concept and user requirements. Deliberate corrections: use an original turbine mark instead of the generated GE corporate logo; use educational removal notes instead of the concept's invented AMM procedure; count actual registry components instead of the generated '12 components'. Actual scene representation and numeric instrumentation take priority over invented concept internals.

## Parts inventory, before geometry

- Exterior: intake lip, inlet acoustic liner, segmented fan containment case, nacelle port/starboard upper/lower cowls, cowl hinges and latches, splitter ring, bypass duct quarters, core casing quarters, pylon forward/aft mounts, exhaust outer nozzle, core nozzle, centerbody, exhaust support struts, service access panels, case flanges and bolt circles.
- Fan: spinner, spinner tip/retaining screws, fan disk, all 22 swept and twisted thick composite airfoils with titanium leading edges and root attachments, rotor hub, outlet guide vane row and individual vanes.
- Booster: four rotor-stage assemblies, disks, individual airfoils, four stationary stator rows, rings, stator vanes, booster casing halves.
- HP compressor: nine rotor-stage assemblies, disks, individual airfoils, nine stator rows with individual vanes, variable front stator pivots and actuator ring, HPC casing halves.
- Combustor: annular casing sectors, inner/outer liner sectors, dilution holes, diffuser, dome, fuel manifold, individual fuel-nozzle representations, igniters and feed stubs.
- HP turbine: two rotor-stage assemblies, disks, individual nickel-alloy blades, two nozzle-guide-vane rows and individual vanes, turbine casing halves.
- LP turbine: six rotor-stage assemblies, disks, individual nickel-alloy blades, six stationary vane rows, exit guide vanes, turbine casing halves.
- Shafts: concentric hollow LP and HP shafts, couplings, forward/mid/aft bearing races, bearing rollers, bearing support frames and individual struts.
- Accessories: accessory gearbox housing, cover, drive, oil pump, FADEC representation, starter, sensor connectors, oil/fuel lines, cable harnesses, clamps, saddle brackets, fasteners, flanges, ports.
- Stand: two crossbeams, two rails, four uprights, saddles, braces, base plates, feet and fasteners. Stand is educational display hardware, not engine hardware.

Every actual rendered mechanical item has a registry ID, original parent/local mount, material metadata, purpose, relationship and removal vector. Repeated blades, vanes, rollers and bolts use instances with individual registry groups, and remain selectable and detachable. Assembly groups carry children. Operating interlock includes required descendants, not only top-level modules.

## Verification strategy

Pure model tests: stage counts, IDs/hierarchy, finite geometry, spool coupling, startup/shutdown, exact original transforms, dependency and operation interlock, reversal continuity. Browser tests: real canvas selection, orbit, search/tree, detach/inspect/reattach, exploded states/reversal, cutaway, airflow, throttle/readouts, reduced motion, mobile, keyboard, error handling and console health. Capture assembled, cutaway, exploded, operating and intermediate transitions, inspect screenshots and close-ups. Hardware FPS is a target, not a result inferred from software-rendered cloud Chromium.
