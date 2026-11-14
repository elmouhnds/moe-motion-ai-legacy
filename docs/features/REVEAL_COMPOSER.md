# Reveal Composer (v0.97): the grammar from the owner's "Reveal Seed System" report

The owner's report: a reference is a SEED, not a target. Every matte reveal is `visible = Threshold(Field warped, Progress(t), Softness)`, decorated at the threshold band. Users choose **Shape × Material × Motion × Palette** (+ Intensity); under the hood each choice fills slots. This version builds the report's §10 "first build" on MOE's existing engines. There is no second engine.

## The report mapped onto MOE
| Report | In MOE |
|---|---|
| §1 Field engine (Gradient Wipe of a grayscale field, softness, band) | Matte FX (v0.96): `MOE FX N Map` → Gradient Wipe in `MOE FX N Matte`; Softness = Transition Softness |
| §1 Geometry engine (shapes growing as the matte) | Matte Reveal (v0.95): `MOE Matte · <layer>` (Wipe, Iris, Card, Blinds, Stripes, Shutter, Pixels…) |
| §2 Slot 1 Field | `grammar.SHAPES`: Wipe, Angled wipe, Rise, Iris, **From a point** (the cursor / click-distance field, Point X / Y), Corner bloom, Dissolve, **Rain / Curtain** (stretched noise) |
| §2 Slots 2–3 Warp + Texture | `grammar.MATERIALS`: Turbulent Displace (warp), Fractal Noise (texture: scale, complexity, contrast, brightness, mix; Block / Max for Pixel) |
| §2 Slot 4 Driver | `grammar.MOTIONS`: Impact (expo), Smooth, Snap, Gentle, Linear, **Stepped** (Posterize Time, 12 fps) |
| §2 Slot 5 Edge (E3 double threshold) | the Edge band: the matte against itself a moment later, Difference (v0.96) |
| §2 Slot 6 Colour | `grammar.PALETTES` (the band's colour) + Fill + Glow, Add |
| §6 Grammar | `grammar.compose()` → the same spec fxPlan builds: 9 × 9 × 6 × 8 = **3,888** combinations |
| §6 Curated recipes | 24 tiles (Scene Iris, Card Wipe, Ink Page, Smoke Fade, Cursor Spotlight, Cursor Ink, Pixel Click, Pixel Rain, Neon Scan, Glass Sweep, Glass Lens, Water Drop, Spark Ring, Chroma Slide, Smoke Wipe, Torn Edge, Glitch Curtain, Glass Curtain, Gold Bloom, Ink Rise, Ember Rise, Aurora Dissolve, Burn Dissolve, Pixel Fade Out) |
| §7 Intensity (one master that keeps every combination safe) | `intensity` 0–100 (60 = as designed) scales noise mix, warp and glow together |
| §8 Shuffle / Lock / Remix | Inspector (Compose mode): **Shuffle** (seeded, locked axes kept), click an axis chip to **Lock** it, **Alt-click** it to remix only that axis |
| §8 Plain After Effects data | everything is named MOE effects / pre-comps the user can keep editing |

## Where the Pixel material's menu values come from
Fractal Noise's Noise Type and Fractal Type are native menus. MOE never guesses a menu. The values Block = 1 and Max = 11 come from the Click VFX project file the owner shared (docs/research/CLICK_VFX_STUDY.md): they sit on the very layer the report saw as "Max / Block, Brightness −35". They are unverified in the owner's After Effects until the Self-Test `fxMatte` (Pixel Rain run) passes.

## Not built yet (from the report)
- Shapes: Ring (edge-only), Clock, Blinds / Grid cascade as fields, Cells (Cell Pattern), Text / Logo field, Depth, Spiral, Halftone, Frame-in.
- Materials: Terminal / ASCII (third-party in the reference), Film halation, Hologram (Shift Channels), Water ripple, Crystal.
- Motions: Overshoot, Bounce, Pulse, stagger by distance / luma across many layers (the formula is in the report §3).
- A live controller with Expression Controls (report §7: Progress slider, groups). Today the keys are written once and Tune After re-runs.
- An Explore grid (12 rendered variations) — needs rendered previews of variations, not only of tiles.

## Tests
- `tests/matte.fx.test.js`:
  - all 9 × 9 shapes × materials go hidden → shown;
  - the point field grows from the chosen point and clears the farthest corner;
  - Intensity scales noise and warp together;
  - Shuffle keeps locks and is deterministic per seed;
  - Pixel Rain on the mock sets Block / Max / Brightness −35 / stretched scale / Posterize Time 12, every parameter by name.
- Self-Test `fxMatte` runs Pixel Rain in After Effects.
