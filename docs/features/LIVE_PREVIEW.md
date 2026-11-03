# Live Preview (v0.39.0)

**What:** an interactive preview of an Effector in its Inspector (Layout & Grid › Effectors, any tile). It shows a sample grid of 7 × 4 items and the effector null. **Drag the null with the mouse** and every item answers at once: scale, move, rotation, fade and the colour tint. It runs the same maths After Effects will run (`features/grid/sim.js` → `effectors.applyAt` / `weight`).

**Why:**
- Effector expressions (Spring with 61 samples, Image with `sampleImage`) are heavy in After Effects, so trying settings there is slow.
- Here you see the falloff, the Spring overshoot, the Target aim, the noise field drift or the Delay cascade while you change the settings. Then you apply once.

## What it shows
- **The falloff:** Sphere circle, Box square, Linear edge, or the Noise Field / Image weight as a tint behind the items.
- **Spring / Inertia:**
  - every drag is recorded, and the spring reads that path, the same step-response sum as the expression;
  - a fast drag and a sudden stop overshoot and settle exactly as in AE;
  - the recorded path is trimmed to the spring window (≤ 3.5 s, ≤ 600 points).
- **Target:** the items are drawn as arrows that turn to the null.
- **Delay:** the moves replay from full to rest every 2.4 s, like the keys the tool writes.
- **Sweep** replays the tool's sweep (across in 2 s, hold, back). **Reset** puts the null where the tool puts it.
- **Use my grid** (with a MOE Grid selected) reads its items' positions **once** (the evaluated positions, through `props.values`), and the preview runs on your real layout. **Sample grid** goes back. There are no background host calls.
- **Stand-ins, said under the canvas:**
  - Audio uses a two-beat pulse instead of your soundtrack;
  - Image uses a dark → bright sample instead of your layer.

## Grid Builder preview
The existing Grid Builder preview now draws the two v0.37 layouts with the real layout maths (`layouts.place`):
- **Points:** on a sample 10-point star, with items sized from the gap between the points.
- **In Place:** on sample words or letters, with Text Cloner's Build-in.

## Tests
`tests/cloner.preview.test.js` (4):
- **A still null:** every item = `effectors.applyAt` (sphere, linear, noise field, target).
- **Driven like a mouse:** a jump onto an item overshoots past the direct 1.8 and settles; Inertia only trails.
- **History and controls:** the history stays bounded on a 20 000-point drag; sweep goes left → right → back, and a grab takes over; "Use my grid" sizes the falloff like the tool.
- **Wiring:** the Inspector widgets are registered.

**Found and fixed while testing:** a click used to *slide* the null from its last recorded point. It now holds the old place until the click, then jumps.
