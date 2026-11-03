# Field Effectors (v0.38.0)

Two new **Falloff** entries on every `MOE Effector N` null (menu items 5 and 6; items 1–4 unchanged). A falloff decides *who* an effector reaches and how much. These two draw that weight from a field instead of a shape around the null. Every Type (Plain, Random, Step, Noise, Delay, Target, Audio), Spring and Colour Mix work with them.

## Noise Field
- **What it does:** the items under the bright patches of a moving value noise are reached, and the rest are left alone.
- **Size** = the patch size (px). **Softness** = the edge around the middle value: 0 gives hard on/off patches, 100 a smooth fade.
- **Field Speed** = how fast the field drifts (per second). Moving, rotating or scaling the null slides, turns or zooms the field. **Seed** picks another field.
- **The maths:**
  - n = value noise at (lx / Size + Seed × 13.7, ly / Size + Field Speed / 100 × t), mapped to 0..1;
  - w = smoothstep across Softness around 0.5;
  - then Invert / Strength;
  - (lx, ly) is the item in the null's own space.
- Tiles: **Noise Grow** (scale +70, soft, drifting) and **Noise Flicker** (hard patches fade items out, fast).

## Image
- **What it does:** each item's weight is the **brightness of a layer** under it (Rec. 709 luma × alpha, 0..1), read with `sampleImage` (2 px radius, after effects, at the item's time). The layer can be a logo, a gradient or a video.
- **Field Layer** control:
  - select the grid together with the layer and it is picked, the same way Points picks its shape;
  - otherwise choose it in the Inspector;
  - if there is no layer to read, the effector is refused with what to do.
- Moving the null does nothing here; animate the Field layer (or play a video) instead.
- Tiles: **Image Grow** (scale +100 where bright) and **Image Reveal** (Invert + scale −100: the items appear where the image is bright).

## Reference and colour
- `effectors.weight(e, lx, ly, { t, luma })` is the reference, and `termsAt` passes the time and `src.lumaAt(cx, cy, t)`.
- `code()` mirrors it in `TQ`. The Field Layer and Field Speed are read once per effector.
- The colour tint (`colourCode` / `colourWithEffectors`) uses the same two falloffs, read at the current time.

## Tests
`tests/field.effector.test.js` (4):
- Noise Field: mock = reference at three times; items get different weights; the field drifts with the null still; Softness 0 gives only 0 or full.
- Image: a gradient layer picked from the selection; scale = reference; brighter → bigger; the Clone Colour tint follows the brightness; restore keeps the map layer.
- No layer → refused.
- Tiles.

The mock's `sampleImage` averages a procedural pixel function. **Unverified in After Effects:** the speed of `sampleImage` on big grids and video, and Spring + Image (it samples the layer up to 61 times per item per frame).
