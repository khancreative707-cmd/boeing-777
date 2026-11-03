# Interaction improvements

The initial exhibit supports deep inspection but offers little direction to a first-time visitor. Its all-or-nothing explosion also makes intermediate assembly relationships difficult to study. Camera moves used a straight line, which could carry the viewpoint through the engine when switching between opposite views.

## Implemented

- Seven chapter guided tour with actual assembly selection, framing, cutaway internals, direct chapter navigation and restoration of previous visibility. Selecting another part ends the tour so manual exploration takes priority.
- Continuous assembly-spread control using the same controller, removal paths and operating interlock as the complete exploded view. A critically damped spring retains velocity on reversal and restores exact original mounts.
- Slow automatic orbit with direct-input takeover and reduced-motion support. Presets move around their target using interpolated radius and orientation, with easing that starts and ends at zero speed and acceleration. Camera button state follows programmatic focus/reset as well as clicks.

## Next priorities

| Priority | Improvement | Why it matters |
| --- | --- | --- |
| High | Adjustable axial section plane | Inspect any stage without hiding an entire casing sector. Requires consistent clipping and capped cut surfaces across individually selectable meshes. |
| High | Guided removal exercises | A spinner/blade exercise and a compressor-stage exercise could highlight the next blocking part, track actual completion and explain the relationship without bypassing dependencies. |
| High | Hardware performance profiling and quality presets | Measure real frame time on desktop and phone GPUs, then tune shadows, tessellation and effects to the available budget. Cloud software rendering cannot establish a 60 FPS claim. |
| Medium | Live spool and temperature history | Small plots can make startup lag and shutdown clearer. Sample the existing simulation; keep values explicitly illustrative. |
| Medium | Save and restore inspection sessions | Preserve camera, selection, hidden components and detached poses in a versioned format, validating dependencies on restore. |
| Medium | More detailed accessory geometry | Replace the representative gearbox housing and fittings with more specific public-reference geometry; document unsupported internal details. |
| Later | Optional engine audio | Sound should follow spool state and interlocks, start only after a user gesture and remain independently muteable. |

The next improvements should deepen inspection and understanding rather than add labels over the object. Engineering geometry and simulated values remain educational approximations.
