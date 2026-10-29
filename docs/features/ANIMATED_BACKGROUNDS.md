# Animated backgrounds (v0.18)

Requested by the product owner: backgrounds that move — the colour points' positions driven by
expressions, with different kinds of motion for the background and for its colours, as options.

## What you pick (Backgrounds › Inspector)
**Motion** — how the colour points move (the Gradient Ramp's start / end, or the 4-Colour
Gradient's four points):

| Motion | What it does |
|---|---|
| Still | nothing moves |
| Drift | each point floats on its own slow figure-eight |
| Orbit | each point circles around its place |
| Swirl | the whole gradient turns around the comp centre, one turn per loop |
| Wave | the points sway side to side, one after another |
| Breathe | the points spread out and gather in, together (a radial gradient pulses) |
| Wander | smooth random-looking paths that still loop |

**Colours** — how the colours change:

| Colours | What it does |
|---|---|
| Still | colours stay as picked |
| Cycle | each colour steps through the palette's five colours, blending smoothly |
| Swap | the colours trade places and come back |
| Hue | the hue swings around the palette colour (± 90° at 100 %) |
| Pulse | lighter / darker, one colour after another |

The Inspector shows a **live preview** drawn with the same maths and the same geometry as the
layer MOE will make. A flat colour has no points, so its pickers are disabled.

## In After Effects
- The background layer gets three **Slider Controls** — `MOE BG Loop` (seconds per loop),
  `MOE BG Amount` (% movement; 100 % = a quarter of the comp's short side), `MOE BG Colour`
  (% colour change). They are live and keyframeable.
- Each moving property carries a tagged expression (`// MOE Background: motion …` /
  `// MOE Background: colour …`). Every motion is built from sin / cos of 2π·time / Loop and its
  whole multiples, so **frame 0 and frame Loop are identical** — the background loops seamlessly
  at any length.
- Expressions use only documented API: `effect()("Slider")`, `time`, `value`, `add()`, `Math`,
  `rgbToHsl()` / `hslToRgb()`. Vector maths uses `add()` — the v0.6 drift used `value + [...]`,
  which AE's JavaScript expression engine reads as text; that is replaced.
- Old presets with "Slow drift" still work: they become Motion › Drift.

## Code
`features/design/bgMotion.js` — `pointAt` / `colorAt` (plain-JS reference), `pointExpression` /
`colorExpression` (generated from the same constants), `rgbToHsl` / `hslToRgb`.
`design.background` adds the sliders before the expressions (`expressions.set`, revert on error).
Preview: `app/ui/widgets.js` `bgMotion` / `bgFrame`. Tests: `tests/design.test.js` compare
mock-evaluated expressions with the reference for 3 styles × 6 motions × 4 colour moves and check
the loops are exact.
