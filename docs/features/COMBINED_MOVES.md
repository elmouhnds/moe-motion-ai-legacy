# Combined Moves (v0.48.0)

**Premium library, step 1.** Every Animate preset used to move one property: a slide only slid, a pop only scaled. The entrances designers build by hand are combinations, keyed together: a rise that fades in, a zoom from 130 % that fades in, a small swing. Doing that meant two presets and lining up their keys.

## The engine (`quick.animate`)

Three new settings, the same keys and timing for every property:

| Setting | What it does | Default |
|---|---|---|
| **Also fade** | Opacity in / out on the same timing as the move. Never an overshoot on the opacity | off |
| **From / to** (scale) | For Scale: where it starts (In) or ends (Out), in % of the layer's own scale. 0 = from / to nothing, 130 = zoom from bigger. An overshoot from bigger dips 5 % under the rest; from smaller it passes 8 % over | 0 |
| **Angle** | For Spin: how far it turns. The overshoot is 8° per half turn, so a 25° swing overshoots 1.1° | 180° |

The defaults keep every v0.47 preset exactly as it was (tested).

## 12 new presets

| In | Out |
|---|---|
| **Rise + Fade**: up 60 px, smooth | **Sink + Fade**: down 60 px |
| **Slide + Fade In**: 140 px from the right, expo | **Slide + Fade Out**: 140 px to the left |
| **Drop + Fade**: 80 px from above, overshoot | |
| **Zoom Fade In**: from 130 %, expo | **Zoom Fade Out**: to 130 % |
| **Grow + Fade**: from 60 % | **Shrink + Fade**: to 60 % |
| **Pop + Fade**: from 0, overshoot | |
| **Swing In**: 25°, overshoot | **Swing Out**: 25° |

Each tile plays its real keys, as in v0.47: the move, the fade and the overshoot on their real timing. The settings preview follows Also fade, From / to and Angle live.

The Animate library goes from 33 to 45 presets.

## Checks

- `tests/combined.test.js` (3):
  - each of the 12 presets runs on the mock, and its Opacity and Scale / Rotation keys are exactly the plan's. Its Position keys share the fade's timing, move the stated distance and keep the rest pose. Restore removes the fade keys too;
  - From / to and Angle maths, and v0.47 Pop and Spin unchanged;
  - unique names, In / Out badges match, every one drawn from the plan.
