# Grid Builder 2 (v0.19) — study of aescripts Grid Builder and how MOE goes further

Requested by the product owner: add aescripts **Grid Builder** (https://aescripts.com/grid-builder/)
"professionally, without errors, smarter than the tool for the average user", without tools that
duplicate what MOE already has.

## Sources
aescripts.com itself is blocked in this session's network, so the study uses the vendor's version
history and descriptions quoted by search results and reseller listings (AAE Plugins, GFX Plugin):
- 1.0.7 (Apr 23 2026) initial release · 1.1.0 (May 15) Morph mode, per-asset Twist and Stagger,
  controls and keyframes carried across modes · 1.1.1 Legacy ExtendScript fix · 2.0.0 (Jun 22)
  Proximity (Position / Rotation / Scale / Opacity respond to effectors; Attract / Repel) · 2.0.1
  Morph in the create step · 2.0.2 (Aug 17) Twist fix when the orientation changes. AE 2022–2026.
- Modes: Rectangular, Radial, Path (template or drawn), Spherical. One Null per grid with a Pseudo
  Effect holding the controls. Orientation: Forward, Orient to Center, Face Screen, Orient to Path.
  Drag-and-drop reorder inside the extension without touching the layer stack. Layers stay
  editable after joining a grid.

## What MOE already had (v0.4 → v0.18)
`grid.build` was already "inspired by Grid Builder": one `MOE Grid N` null with live controls,
**six** layouts (Grid, Radial, Spiral, Sunflower, Path, Sphere — two more than Grid Builder),
automatic spacing / columns / radius from the layers' real sizes, a live preview before building,
presets (Wall, Honeycomb, Ring, Fan, Galaxy, Globe), a Build-in animation (6 styles × 5 orders,
stagger), random jitter, twist, scale step, an Effector (scale / push), Release / Freeze, and full
undo through MOE's checkpoints. So nothing new was added as a second tool — `grid.build` was upgraded.

## The gaps, closed in v0.19
| Grid Builder | MOE v0.19 | Smarter for the average user |
|---|---|---|
| Morph between layouts (one slider) | **Morph To** + **Morph** on the null; Morph can be keyframed at build time (*Animate morph*), after the build-in | Presets **Grid → Ring** and **Galaxy → Wall**; the preview plays the morph before you build; choosing as Layout the layout you morph to swaps them, so the slider never goes dead |
| Controls and keyframes carried across modes | One expression holds all six layouts; the **Layout** dropdown switches live **in AE's Effect Controls** (or in the panel) — every control and keyframe stays | Works without the panel open |
| Orientation: Forward / Orient to Center / Face Screen / Orient to Path | **Orient**: Forward · Face Center (centre, or the path direction on Path) · Face Screen (stays upright while the null spins) | — |
| Drag-and-drop reorder in the extension | **Your grid › Places**: drag, or ↑ / ↓, plus one-click **Layer order / Name A→Z / Reverse / Shuffle** — the layer stack never changes | Sorting in one click; undoable |
| Twist and Stagger per asset | Select items → **Twist** and **Delay** (optional `MOE Grid Twist` / `MOE Grid Delay` effects on just those items) | Only tweaked items get controls — no clutter on every layer |
| Proximity: Position / Rotation / Scale / Opacity, Attract / Repel | Grid **Effector** now does Scale, **Push (negative = attract)**, **Rotate** and **Fade** | MOE's separate *Proximity* tool stays for layers that are not in a grid (no duplicate: inside a grid the Effector is the only one that can drive the grid's own expressions) |
| Layers stay editable | Every item keeps a **home**: move it by hand (or keep its own Position keys) and that offset plays on top of the layout | — |
| — | **"Your grid" panel**: select a grid (or its items) in Layout & Grid → live Layout / Morph To chips, Morph slider, Orient, Places, item tweaks — no JSON | — |
| — | Building a grid from items already in a grid is refused with where to go instead (it would have pulled them out of their grid) | Prevents a silent mistake |

Grids built before v0.19 keep working (their expressions and controls are untouched); Places works
for them too; Layout / Morph / Orient / item tweaks ask for a rebuild.

## How it is built
- `features/grid/layouts.js`: `place` = `finishBuild(rawPlace())`; `placeMorph` mixes two layouts with
  smoothstep (positions, facing, distance scale) — the reference the tests compare AE values against.
  `modifiers` adds Orient and per-item twist / delay.
- `features/grid/expressions.js` `buildAll()`: `lay(m)` holds the six layout blocks; Layout / Morph To /
  Morph pick and blend; `ic()` reads optional per-item effects; position adds `(value − home)`.
  Path access tries the path found at build time, then any mask, then the first shape path.
- `features/grid/tools.js`: `grid.build` (orient, morphTo, animateMorph, homes, guard), `grid.update`
  (knows every control, old and new), `grid.items` (order: custom / layer / name / reverse / shuffle;
  tweak) — order changes rewrite only `var i = N` in each item's expressions.
- `app/ui/gridPanel.js` (Layout & Grid, when a grid is selected); preview in `widgets.gridPreview`.
