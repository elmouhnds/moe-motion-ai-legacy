# Cloner + Effectors (v0.33.0) — MoGraph in After Effects, on the MOE Grid engine

## The brief
The owner pointed at aescripts **mCloner Pro** and asked for a change of direction: add **advanced tools that
help deliver professional results**, and think that way from now on.

## Sources (honest)
aescripts.com is blocked in this session's network, so the official mCloner Pro page could not be read. What
was found: a reseller description ("create, distribute and animate multiple-layer clones", v2.3, AE 2022–2026)
and the official pages of the same family — **Cloners + Effectors** (Linear, Radial, Grid cloners; seven
effectors) and **React 2** ("like Cinema 4D's cloner system … apply effectors to any property"). The common
model is Cinema 4D's MoGraph: a **Cloner** makes and places copies; **Effectors** are separate objects whose
*falloff* (where) and *type* (how much, per clone) change the clones' transforms — live.

## What MOE already had, and what was missing
MOE Grid (v0.4 → v0.19) was already the cloner's placing half: six live layouts on one controller null,
Morph, Orient, a Build-in, random jitter — and one simple effector (grid-level Scale / Push / Rotate / Fade
around a layer). Missing for pro results:
1. **Cloning** — the grid only arranged layers you already had.
2. **Real effectors** — each with its own controls, more than one per grid, falloff shapes, per-clone
   variation (random, step, noise) and **time** (delay).

## What v0.33 adds (no second tool: the grid engine grew)
### Cloner (`grid.build` → *Clones*)
Select one layer (or a few) and set *Clones*: MOE makes the copies (`MOE Clone n · <layer>` — they keep the
source's look, effects and keyframes), cycles through the sources (A, B, A′, B′…) and puts them all on a live
grid. Tiles: **Clone Grid 5×5** (with a build-in) · **Clone Row** · **Clone Ring** · **Clone Spiral** ·
**Clone Sunflower** (with a build-in) · **Clone Globe**. Restore removes the copies.

### Effectors (`grid.effector`)
An effector is its own null, **MOE Effector N**. Since v0.87 it arrives with only the controls it uses (docs/features/CONTROLS_ON_DEMAND.md); the full list, which *More Sliders* can add, is:

| Group | Controls |
|---|---|
| What | **Effector Type**: Plain · Random · Step · Noise · Delay |
| Where | **Falloff**: Sphere · Linear (a sweeping edge) · Box · Everywhere — **Size**, **Softness**, **Strength**, **Invert** |
| Moves | **Move X / Y** (px), **Scale** (%), **Rotate** (°), **Fade** (%) |
| Type settings | **Seed** (Random / Noise), **Delay** (frames per item), **Noise Scale**, **Noise Speed** |

- The item is read in the effector's own space: **move, rotate or scale the null and that is the
  animation** (a rotated Linear effector sweeps at an angle).
- Up to **three effectors per grid** (slots *Effector*, *Effector 2*, *Effector 3* on the grid null); they
  stack (three +10 px effectors = +30 px, tested). A fourth is refused before anything is made.
- **Delay**: the moves are keyframed to rest in 0.6 s from the playhead; every item plays them *Delay* frames
  later in the grid's order — a cascade from one set of keys (re-key them freely).
- **Sweep across** (Sphere / Box / Linear): the null travels across the grid in 2 s, so the effect shows at once.
- Tiles: **Grow** (sphere, sweeps) · **Reveal** (linear edge, inverted: items appear as it passes) ·
  **Scatter** (random) · **Step** (grows along the order) · **Wave** (noise over space and time) ·
  **Cascade** (delay: drop in and fade in, item by item).
- Grids built with v0.19–v0.32 are upgraded in place when you add an effector: each item's expression is
  rewritten from the facts baked into it (slot, home, grid, path) — same item, nothing moves. Grids from before
  v0.19 are refused with how to rebuild.

### Where it lives
- **Layer › Arrange · Clone · Effectors** — one block with a switch (space follows content): one layer
  selected → *Clone*; a grid (or effector) selected → *Effectors*; several layers → *Arrange*.
- **Layout & Grid** library: modes **Arrange · Clone · Effectors · Guides · Cells**.
- Power card **Cloner & Effectors**; *Next* after a grid: Reveal · Wave · Cascade · Pre-compose.
- The Assistant understands كلونر / موجراف / إيفكتور / مؤثر / موجة.

## How it is built
- `features/grid/effectors.js` — the reference: `weight` (falloff), `amounts` (type, per item and channel),
  `apply` (all effectors on one item), `localFn` (the effector's space), `code()` (the same maths as an
  expression: ES3-style, `sub()` for vectors, a sine hash for Random and Noise so JS and AE agree exactly).
- `features/grid/expressions.js` `buildAll` → tag `· v3`: the old grid Effector is skipped when its slot holds
  a MOE Effector; the effectors' `ex, ey, es, er, eop` add to position / scale / rotation / opacity.
  `factsOf(code)` reads i, n, home, grid name and path access back from an item expression (the upgrade).
- `features/grid/effectorTool.js` — `grid.effector`: create the null + controls, link the first free slot,
  upgrade items, sweep / delay keys, read back; checkpoint = expressions + slot value + the null.
- `host/ops/transform.jsx` `layers.clone` gains `plain: true` (exact copies, keyframes kept).

## Tests (`tests/cloner.effectors.test.js`, 6)
Mock-evaluated expressions equal the reference for every type and falloff: Plain · Sphere (position, scale,
rotation, opacity; soft edge); Linear sweep at five times and rotated; Random · Step · Noise · Box (inverted) at
two times; Delay (each item exactly *Delay* frames late); Cloner (sources cycle, restore removes copies);
upgrade facts; three slots + refusal of a fourth with nothing left behind.

## Honest limits
- Tested on the mock host and the preview, **not inside After Effects**. The mock is 2D: effectors on a
  **3D** (Globe) grid use the 2D comp position of each item.
- The clone count is fixed at build time (layers have to be made); change it by rebuilding.
- Effectors act on transforms (position, scale, rotation, opacity). Colour per clone is next.

## Next advanced tools (the same direction)
1. **Colour effector / per-clone colour** — palette or gradient across the clones (MOE Palette Fill per item).
2. **Spring / Inertia effector** — items follow the effector with physics (bounded simulation, like Delay rigs).
3. **Target effector** — clones look at / are pulled toward a layer.
4. **Audio effector** — drive Strength from a layer's audio amplitude (Convert Audio to Keyframes).
5. **Object / text cloner** — clone onto the points of a shape path or onto the letters of a text layer.
