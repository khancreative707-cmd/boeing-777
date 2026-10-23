# Component hierarchy

The generated [component-hierarchy.json](component-hierarchy.json) is the complete inventory: 3,443 unique component IDs, original local positions/quaternions, parent relationships, child IDs, material, purpose, spool, required/optional status and removal blockers. Regenerate with `npm run docs:hierarchy` after assembly changes.

## Root and modules

```text
ge90                              Engine axis frame, 2.12 above the display floor
├── exterior                      Nacelle, containment case, inlet and mounts
│   ├── exterior.intake            Rounded annular lip
│   ├── exterior.acoustic          Inlet acoustic liner
│   ├── exterior.fan-case.q0…q3     Independently removable containment sectors
│   ├── exterior.nacelle.q0…q3      Bypass duct/cowl sectors, seams, latches, fasteners
│   └── exterior.bypass-nozzle      Separate bypass exhaust
├── fan
│   ├── fan.rotor                  LP rotating frame
│   │   ├── fan.spinner            Removable spinner and trim
│   │   └── fan.disk               Fan disk
│   │       └── fan.blade.01…22     Each blade owns its root and leading-edge part
│   └── fan.ogv                    Stationary outlet guide vane row
├── booster                        Four stages; LP rotors
│   ├── booster.case               Split case, four removable sectors
│   └── booster.stage.1…4
│       ├── ….rotor → ….disk       Rotating disk carrying individual blades
│       │               └── ….blade.N
│       ├── ….stator → ….vane.N    Fixed vane row, separate from the rotor frame
│       └── ….flange-bolt.N
├── hpc                            Nine stages with the same stage ownership
│   └── hpc.stage.1…9              HP rotors, stationary / variable-incidence stators
├── combustor                      Stationary annular combustion system
│   ├── combustor.case.q0…q3
│   ├── combustor.liner            Eight inner and eight outer liner sectors
│   ├── combustor.dome / manifold
│   └── combustor.nozzle.N / igniter.N / hole.row.N
├── hpt                            Two stages; HP rotors
├── lpt                            Six stages; LP rotors; exhaust cone/nozzle/struts
├── shafts
│   ├── shafts.lp                  Inner LP torque shaft
│   ├── shafts.hp                  Hollow HP torque shaft
│   └── shafts.bearing.0…2         Races, individual rollers, and a frame owning its ring/struts
├── aux                            Gearbox, starter, controls, oil/fuel hardware
│   └── aux.line.1…8               Each line owns connectors and supporting clamps
└── stand                          Optional, stationary display hardware
```

Coordinates use X along the engine, Y up, Z lateral. The engine axis is horizontal. Registry mounts are local to the parent frame; stage X positions are not applied twice. An instance is a rendering choice, not an ownership change: its component still has a real Group, ID, local mount and metadata.

## Mechanical state

`EngineSimulation` owns N1, N2, LP/HP angles, variable-stator incidence, heat, flow, thrust and operating phase. `applySpoolTransforms` assigns one shared angle to each spool's registered rotating frames. All fan/booster/LPT rotors and the LP shaft use the LP angle; all HPC/HPT rotors and the HP shaft use the HP angle. Stationary groups are not in that list. Variable stators pivot about their own radial axis rather than rotating with a spool.

`AssemblyController` owns removal shares and absolute-from-mount transforms. A detached parent carries its attached children. Already detached descendants stay anchored in world space while the parent moves or rotates, preserving their independent poses and original hierarchy IDs. Reattachment blends the stored world anchor into the parent’s current mounting frame before seating. The original mount is never overwritten by current animation or inspection rotations. Reversing a transition continues from the current share. Independent inspection multiplies a captured detachment quaternion. Returning removes the inspection rotation smoothly and restores the saved mounting relationship.

## Removal dependencies

- Fan blade/disk: spinner clear first. The blade extracts axially before moving radially outward.
- Booster module: fan module clear first. HPC module: booster and fan clear first.
- HPT module: LPT module clear first. Combustor module: HPT and LPT clear first.
- LP shaft: fan module clear first; extracts axially forward through the bore.
- HP shaft: HPT module clear first; extracts axially aft through the bore.
- Inner booster/HPC/combustor casings: nacelle sectors clear first.
- Complete inner stage or rotor/disk: surrounding casing and appropriate shaft clear first. Individual blades need the surrounding case clear.
- A split-case detach opens all four casing sectors radially while its grouping frame stays at home. A whole closed annulus is never translated through the core as a shortcut.
- Reassembly reverses the dependency graph. A cover cannot close over a part still detached, and a spinner waits for the fan blades.
- A visual cutaway or visibility toggle does not count as removal. All required missing components interlock operation, including small independently selected hardware. The stand is optional display furniture.

These are educational rules for this exhibit's geometry. They are not a GE-approved access or maintenance sequence.
