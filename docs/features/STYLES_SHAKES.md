# Styles + Shakes (v0.59.0)

**Second release of the reference plan** (docs/research/REFERENCE_PLUGINS.md, wave 2): impacts that feel physical, and finished looks for cards and titles.

## Shakes (Motion › Shake)

Five impacts as **real keyframes, not an expression**. They can be edited, re-eased or baked like any animation:

| Shake | Moves | Default |
|---|---|---|
| **Bump** | a vertical hit that bounces out | 40 px, 7 Hz, settles in 0.6 s |
| **Zoom Punch** | the scale punches bigger and swings back, with a small twist | 12 %, 3°, 6 Hz |
| **Whip** | a sideways whip with a tilt | 70 px, 6°, 5 Hz, 0.5 s |
| **Slam** | a hard hit on every axis (x, y, scale, rotation), the heaviest | 55 px, 8°, 9 Hz |
| **Jitter** | a fast, tight rattle (glitch, buzz, error) | 10 px, 1.5°, 22 Hz |

Controls: **Intensity** (px, or % for Zoom Punch), **Rotation** (°), **Frequency** (Hz), **Settle** (s). The numbers are hidden sliders (v0.56).

- **A pure plan** (`quick/shakePlan.js`):
  - a damped oscillation with one key at each peak, half a period apart (1 / 2f);
  - the peaks fall to 5 % by Settle, then one last key returns to rest;
  - every key is eased with speed 0 at the peak, like a hand-keyed shake;
  - Jitter uses a hash, never `Math.random`, so the same settings always give the same keys.
- **On top of the animation:** each key is the layer's **own value at that moment** plus the offset. A shake adds to an existing move instead of freezing it.
- Separated X / Y position is keyed per dimension. A Position with an expression is skipped, and the result says so.
- **The preview plays the plan's keys** with the same eased motion (Real Previews rule). **Restore** removes exactly the keys it wrote.

## Styles (Looks › Styles)

A finished look from **After Effects' own effects**. Each one is a single effect named `MOE Style • <name>`, updated in place (never two), with every parameter resolved by its **English name** and read back:

| Style | Effect | What it sets (× Amount) |
|---|---|---|
| **Soft Shadow** | Drop Shadow | Distance 14, Softness 50, Direction 180° |
| **Deep Shadow** | Drop Shadow | Distance 40, Softness 120, Direction 180° |
| **Glow** | Glow | Glow Radius 60, Glow Intensity 1.2 |
| **Light Sweep** | CC Light Sweep | Width 60, Sweep Intensity 55, and the Centre moves |

- **Light Sweep's centre** is a tagged expression (`// MOE Style`). It reads the layer's own box (`sourceRectAtTime`), so it crosses any layer of any size: once every *Every* seconds (default 3) from the playhead, with a smooth start and stop.
- **Parameters left alone:** the shadow's Opacity and the glow's Threshold keep After Effects' defaults. Their stored scale is not something we guess (project rule: never invent).
- **Restore** removes the effect this run added, and puts back the values it changed on one that was already there. **Trash** removes them too: it already clears every `MOE …` effect and every `// MOE` expression.

## Checks

- `tests/stylesshakes.test.js` (5), read back from the mock comp:
  - **the plan:** starts and ends at rest, first peak at 1 / 2f, decays, Jitter deterministic, frequency clamped;
  - **Bump:** every Position key equals the layer's own value at that time plus the plan's offset (on top of its animation), and Restore puts it back;
  - **Zoom Punch** keys Scale + Rotation;
  - **Styles:** one `MOE Style • Soft Shadow` (Drop Shadow) with Distance 14 / Softness 50 by name; a second run updates in place (28 at Amount 2); Glow Radius 60, and Restore removes it; the Light Sweep Centre expression is tagged and reads `sourceRectAtTime`, with Every 4;
  - **the tiles:** 5 shakes in the Shake mode, 4 styles on Looks.
- The mock models Drop Shadow, Glow and CC Light Sweep with After Effects' parameter names.
- Playwright: the Shake mode and Looks › Styles with their previews. 0 JS errors.
