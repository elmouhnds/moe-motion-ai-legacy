# Wave, Snap To, Clamp (v0.88)

React 3 study, item 2 of 8 (docs/research/REACT3_STUDY.md). Three things an effector could not do.

## Wave — a new Effector Type (the eighth; appended, the menu index is stored in After Effects)
A wave runs through the items in their order. Every move of the effector (Move, Scale, Rotate, Fade) is multiplied by it.
- **Wave Shape**: Sine · Triangle · Ramp Up · Ramp Down · Square — all between −1 and 1 (`effectors.waveAt`).
- **Wave Length**: how many items one wave spans. **Wave Speed**: waves per second (0 = still, negative = the other way).
  **Wave Offset**: % of a wave — keyframe it to drive the wave by hand.
- phase = k / Length − Speed × time + Offset / 100, k = the item's place in the grid order.

## Snap To and Clamp — on every effector type
Applied to what the effector gives each item, **after the spring** (`effectors.modify`): first Snap, then Clamp.
- **Snap Move** (px), **Snap Rotate** (°), **Snap Scale** (%): round to the nearest step. Snap Rotate 45 → items only sit at 0°, 45°, 90°…
- **Max Move** (px — the distance; the direction is kept), **Max Rotate** (°), **Max Scale** (%): never more than this either way,
  spring overshoot included.
- 0 = off. Fade is never snapped or clamped.

## Controls on demand
The four Wave sliders are on the null only for a Wave effector; each Snap / Max slider only when it is not 0.
*More Sliders* has the groups **Wave**, **Snap To**, **Clamp**. The item expression is **v5**; a grid built earlier is
rewritten in place when an effector is added (docs/features/CONTROLS_ON_DEMAND.md).

## Tiles (Layout › Effectors)
Ripple (sine, Move Y) · Square Pulse (square, Scale) · Saw Fade (ramp down, Fade) · Snap Turn (Noise + Snap Rotate 45).

## Tests (`tests/wave.snap.clamp.test.js`, 5) — mock only
Shapes in range and periodic · Snap / Clamp maths and their order · every wave shape: mock-evaluated expressions = reference at
5 times, repeats after one wave, Restore exact · Snap on a Noise effector lands on the steps; Clamp holds through a spring that
otherwise overshoots · adding the groups later moves nothing, then switching the type in Effect Controls follows the sliders.
Self-Test has a *Wave + Clamp* check; it has **not** been run in After Effects.

## Honest limits
- Not verified in After Effects.
- One Snap / Max value per kind of move (not per axis); React 3 has them per property.
- The wave follows the grid ORDER (Rows / Columns / Snake / Random), not the distance on screen.
- React 3's Noise modifier per property and its Loop Length are not part of this (MOE's Noise is an effector type).
