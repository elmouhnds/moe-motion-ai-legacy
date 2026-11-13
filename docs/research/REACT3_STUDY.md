# React 3 (aescripts) — study, 2026-11-12

Source: a 60 s screen recording of https://aescripts.com/react/ sent by the owner (the site refuses automated
requests). Everything below was read from the page's own text and pictures in that recording; nothing was run.
React 3.0.3 (Nov 4, 2026), After Effects 2023–2026, a CEP panel.

## What it is
"The repeater + effector toolbar for After Effects." Four steps: select layers → pick a repeater → add an effector
(or more) → play with the modifiers. The UI is one small dockable toolbar — 9 buttons: count field (e.g. `5x5x5`),
Grid, Radial, Sphere, Path, Add effector, Tracer, Refresh, Delete — in 4 layouts that follow the panel's size.
Everything else is in Effect Controls.

## Features, as the page states them
- Repeaters: Grid (honeycomb offset, 3D), Radial (start, end, loop, 3D), Sphere (new), Path (existing path or it
  creates one). Works on AE's parametric 3D meshes and OBJ / glTF.
- Influence + Inheritance: mix between repeaters with inheritance chains; each repeater has an Influence slider;
  layer-index offsets and elastic on the transition.
- Effectors — one per property: Position (Relative / Absolute / Attract-Repel, XYZ), Rotation (Relative / Absolute /
  Look At, XYZ), Scale (Relative / Absolute, uniform or per axis), Color (Single, HSL, Multiple – Iterate / Blend /
  Random), and "everything else": Opacity, Trim Paths, Stroke Color, 3D Point Controls, Polystar Points, Roundness —
  "any keyframeable property".
- Falloff: all layers, or Circle / Box / Linear; 3D versions when the effector null is 3D. Effectors stack.
- Smart Modifiers, 5 on every effector (not Color): Noise (Amplitude X/Y/Z, Scale X/Y/Z, Random Seed, Speed, Loop
  Length in frames), Wave (Sine / Triangle / Ramp Up / Ramp Down / Square; Speed, Length, Offset), Elastic
  (Amplitude, Frequency, Decay), Snap To (round to the nearest N), Clamp (min / max).
- Custom Easing of the falloff: Animation Type (In / In & Out / Invert), Easing (Linear, Ease In + Out, Ease In,
  Ease Out, Custom) with Ease In X/Y, Ease Out X/Y.
- Tracer: lines that connect the repeated layers (Grid / Snake / Zig-Zag on a grid) and follow the effectors.
- Text: split into letters, letters without spaces, words, lines; a dynamic text guide updates the copies as you type.
- Sorting: Iterate / Cluster / Random, plus Rows / Columns for grids.
- Smart Delete: remove ONE effector from a property without disturbing the others — Delete without Baking /
  Bake At Current Frame / Bake Animation.

## Against MOE (read from our code, not from After Effects)
| | React 3 | MOE |
|---|---|---|
| Layouts | Grid, Radial, Sphere, Path | the same + Spiral, Sunflower, Points, In Place |
| Honeycomb, radial start / end | yes | yes — *Row Offset* (the Honeycomb tile = 50 %), *Start Angle* + *Arc* (the Fan tile). Corrected 2026-11-13: the first version of this table said no |
| Blend between layouts | chain + Influence per repeater | `placeMorph` between two layouts |
| What an effector drives | any keyframeable property, one per effector | fixed set in one effector: Move, Scale, Rotate, Fade, Colour |
| Position modes | Relative / Absolute / Attract-Repel | relative only |
| Rotation | Relative / Absolute / Look At | relative + Target (look at) |
| Falloff | Circle, Box, Linear, 3D | Sphere, Linear, Box, Everywhere, Noise field, Image |
| Falloff easing | In / Out / custom bezier | Softness only |
| Modifiers | Noise, Wave, Elastic, Snap, Clamp | Noise, Step, Random, Spring; no Wave / Snap / Clamp |
| Tracer lines | yes | no |
| Delete one effector, choose bake | yes | Trash + Bake, separately |
| Audio, Image field, Trails, Delay, live preview, build-on animation | not on the page | yes |

## Where it is smarter than MOE
1. Controls arrive with what you added. An effector is ONE property with a short list; a modifier's group exists
   in Effect Controls as its own twirl. MOE drops 24 + 6 controls per effector and 23 on the grid null at once.
2. Names say the axis and the unit ("Noise Loop Length (Frames)", "Ease In - X").
3. One toolbar, one verb per button, and a Refresh button for "I changed the layers".
4. Removal is a first-class action with three honest outcomes.

## What MOE should take (order)
1. Controls on demand: an effector starts with its 4–5 essentials; Noise / Spring / Colour / Audio / Field add their
   group only when switched on; the same rule for the 37 quick expressions (essentials live by default).
   Needs an upgrade path for rigs already built (`factsOf`) — nothing may move.
2. Wave, Snap To, Clamp as modifiers in `effectors.termsAt` + `TQ` (reference and expression together).
3. Falloff easing (In / Out / Invert).
4. Attract / Repel and Absolute position.
5. Remove one effector with the three bake choices (Bake and Trash exist).
6. ~~Honeycomb + radial start / end~~ — already in MOE (see the table).
7. Tracer.
8. An effector on any keyframeable property — the largest change; last.

Not verified: how React behaves in After Effects, its speed, and anything the page does not say.

## Status, 2026-11-13
| # | Item | Version | |
|---|---|---|---|
| 1 | Controls on demand | 0.87 + 0.93 | effectors and quick expressions (0.87); the grid null 46 → 8 and Proximity (0.93) |
| 2 | Wave, Snap To, Clamp | 0.88 | |
| 3 | Falloff easing | 0.89 | four fixed curves, no free bezier |
| 4 | Attract / Repel, Absolute | 0.89 | 2D |
| 5 | Remove one effector | 0.90 | Remove · Freeze · (Bake already existed) |
| 6 | Honeycomb, radial start / end | — | already in MOE; this study was wrong |
| 7 | Tracer | 0.91 | |
| 8 | An effector on any property | 0.92 | one Custom channel per grid, numbers only |
Everything is tested on the mock only. None of it has been run in After Effects.
