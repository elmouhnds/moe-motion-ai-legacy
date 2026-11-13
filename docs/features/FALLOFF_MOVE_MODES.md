# Falloff Curve and Move Mode (v0.89)

React 3 study, items 3 and 4 of 8 (docs/research/REACT3_STUDY.md).

## Falloff Curve — how the soft edge runs
A menu on the effector (Sphere, Box and Linear falloffs): **Smooth** (what every effector had), **Linear**, **Ease In**
(the edge stays low and rises late — a thin edge), **Ease Out** (rises early — a wide, gentle edge). `effectors.edge`.
Full and zero weight are the same for every curve; only the edge between them changes. The Clone Colour expression
uses the same curve, so a tint has the same edge as the moves.

## Move Mode — what Move X / Y mean
- **Relative** (as before): Move X / Y px from where the item is.
- **Attract / Repel**: Move X px along the line to the effector null — never past it; negative pushes away. Move Y is not used.
- **Absolute**: the items go to the effector null (+ Move X / Y); weight 1 = exactly there, the soft edge blends.
Both follow the effector's type (Random, Step, Noise, Wave, Audio give each item its own share), the spring, Snap To and
Clamp. Target keeps its own meaning. The expression measures in the grid null's own space (`G.fromComp`), so a rotated or
scaled grid null is handled; the reference measures in comp space, which is the same for an untransformed null (what the
tests build).

## Controls on demand
*Falloff Curve* and *Move Mode* are on the null only when they are not Smooth / Relative. *More Sliders › Moves* adds
Move Mode; *More Sliders › Falloff curve* adds the curve. Item expressions are **v6**.

## Tiles (Layout › Effectors)
Magnet (attract 120 px) · Repel (−90 px) · Gather (absolute, ease-in edge).

## Tests — mock only
`tests/falloff.move.test.js` (5) and two more cases in `tests/clone.colour.test.js`: curve maths; every curve = reference on a
sweep; attract moves exactly Move X closer and stops at the null, repel moves away, refused without a pull; absolute lands on
the null + offset, half way at Strength 50, and equals the reference with Random on a sweep; controls added later move nothing.
A Self-Test check *Ease-in falloff* exists (scale against the reference); the move modes have no Self-Test check yet (it compares scale and rotation only). **Not run in After Effects.**

## Honest limits
- Not verified in After Effects — in particular `G.fromComp` on a rotated / scaled / 3D grid null is untested.
- Attract works in 2D (the grid's plane). React 3 has full XYZ.
- No free bezier for the falloff (React 3 has Ease In X / Y, Ease Out X / Y); four fixed curves.
- A Clone Colour made before v0.89 keeps the Smooth edge until Clone Colours is applied again.
