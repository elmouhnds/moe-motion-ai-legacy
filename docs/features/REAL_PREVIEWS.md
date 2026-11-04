# Real Previews (v0.47.0)

**The owner's direction:** premium, whatever it takes. The first step: a preview has to be **the real motion**.

## Before

The Animate tiles moved, but with a generic ease (`eOut`) and a made-up 1.1 s timing. Two problems:
- **Pop In's** overshoot was a generic "back" curve, not the 8 % key Quick Animate writes at 72 %.
- **Snappy / Smooth / Gentle / Expo** looked the same.

The tile was a sketch of the move, not the move.

## Now

- **One plan:** `features/quick/animatePlan.js` (pure) builds the keys:
  - `keysFor` is Quick Animate's own two keys, or three with the overshoot key at 72 %, with AE influence on each side;
  - `animate` covers move / fade / scale / spin from a rest pose;
  - `trim` covers draw / erase / travel with lag / draw + erase with hold.
  
  `quick.animate` and `quick.trimPaths` write exactly these keys. Only the playhead and the layer's own values are added.
- **The preview plays them the way After Effects does.**
  - `valueAt` turns each segment's out / in influence (speed 0) into AE's bezier through `curves/bezier.fromTemporal`, the same mapping the Ease tools use.
  - Every Animate tile plays its keys at their real duration: wait 0.35 s, play, hold the end, loop. This covers Slide, Fade, Pop, Spin, Rise, Cascade (each layer one *stagger* later), Draw On / Erase / Travel / Draw + Erase.
  - Only the box and the distance are illustrative. The timing, ease and overshoot are the real ones.
- **The Inspector preview follows your settings.** Change Duration, Ease, Overshoot, Stagger, Lag or Hold and the big preview plays the new keys at once.
- **Key strip:** under the big preview, a strip shows where the keys sit (an overshoot is the extra key), the playhead, and *0.60 s · snappy · overshoot*: what After Effects will get.
- A still frame (reduced motion, thumbnail capture) shows the rest pose of an In and the start of an Out.

## Checks

- `tests/realpreview.test.js` (4):
  - Quick Animate on the mock writes exactly the plan: times, values, out / in influence of every key. This covers fade, pop with overshoot and spin, with Snappy, Smooth, Gentle and Expo.
  - Trim Paths writes exactly the plan: draw, erase, travel with lag, draw + erase with hold.
  - `valueAt`:
    - holds the ends;
    - passes through the overshoot key;
    - linear stays linear;
    - is monotone between two eased keys;
    - starts slower than linear (speed 0).
  - The tools build their keys from the plan, and every Animate tile draws it.
- The mock interpolates linearly; it does not play AE's ease. So the tests compare the **keys**, and the ease playback is the tested `bezier.fromTemporal` mapping.
- Playwright: the big preview's data changes when Duration / Ease / Overshoot change, and frames show the motion and the key strip.
