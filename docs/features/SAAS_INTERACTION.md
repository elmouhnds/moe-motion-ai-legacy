# SaaS Interaction (v0.60.0)

**Third release of the reference plan** (docs/research/REFERENCE_PLUGINS.md, wave 3): a product video's interactions, built on the real layers.

## Click on Layer (Product UI › Interact, Zoom & Focus › Cursor)

Select the UI layers in the order they are clicked, then press **Click**. A cursor travels to each one, settles, presses with a ripple, and the layer presses with it.

How it stays precise in After Effects:

| Step | How |
|---|---|
| **Where to click** | Each target's **visual centre is measured by After Effects at that click's own time** (`layers.bounds`: `sourceRectAtTime` + `toComp`), so parents, scale, rotation and the layer's own animation all count. Nothing is guessed from the anchor. |
| **The cursor's path** | It comes from off frame (bottom-right, the right edge, or fades in at the centre). It arrives **0.14 s before** each click and settles (speed 0, 85 % influence), then presses. It dwells 0.22 s and leaves with a soft start (70 %). |
| **The press** | The layer goes down to **Press** (default 94 %) with the cursor, then springs a little past its rest and settles. These are keys on its own Scale, read at each key time, so an animation keeps playing under the press. |
| **Pressed in place** | Scale works around the anchor, and a text's anchor sits on a corner of its baseline. A plain scale would make the text jump toward that corner. So Position gets the matching offset, **P + (1 − f)(C − P)**, and the press happens around the centre the eye sees. Parented or 3D layers press around their anchor, and the result says so. |
| **Read back** | The cursor's position at each click is read from After Effects and compared with the measured centre (under 1 px). |
| **Restore** | Removes the `MOE Cursor N` layer and exactly the keys written on the targets. If writing fails, the cursor is removed straight away. |

- **Skipped targets:** a target with nothing visible at its click time is skipped, and the rest are re-timed and measured again.
- **Scale with an expression:** the layer is clicked but not pressed, and the result says so.
- **Controls:**
  - Cursor (Arrow / Hand);
  - Comes from;
  - Between clicks (s);
  - Travel (s);
  - Press (%);
  - Ripple;
  - Size and Colour (advanced).
- **Limit:** up to 12 clicks per run. This comes from the 12 sample times one `layers.bounds` measurement allows.
- **Click order:** the order of the selection as After Effects reports it.

## UI Reveal (Product UI › Interact)

Quick Animate has a new **Order** setting for its Stagger:

- **Selection order:** the order the layers were selected.
- **Screen ↘:** rows from top to bottom, left to right within a row.
- **Screen ↙:** rows from top to bottom, right to left (Arabic and Hebrew UI).
- **From the centre out.**

The screen orders read the boxes After Effects measures at the playhead (`animatePlan.screenOrder`). Two boxes share a row when their centres are closer in y than half the smaller height. So a button sitting a few pixels lower than the field beside it still moves with that field. The result lists the order it used.

Tiles:

| Tile | Settings |
|---|---|
| **UI Reveal** | Rise 40 px + fade + blur 12, 0.06 s apart, Screen ↘ |
| **UI Reveal · RTL** | The same, Screen ↙ |
| **UI Pop · Centre Out** | Scale in with overshoot + fade, from the middle out |

## Product backdrops (Backgrounds › Product)

Four palettes that open on their own look, all with fine grain:

| Backdrop | Look |
|---|---|
| **Product Night** | A blue glow on near-black (radial) |
| **Studio Light** | A soft white studio sweep (radial) |
| **Aurora Product** | A slow indigo / cyan / pink mesh that drifts |
| **Graphite** | A neutral dark glow |

They are the same Background tool, so they work with Motion, Colours and brand colours.

## Previews

- **Click on Layer** plays `interact/clickPlan.js` on a small app: travel, settle, press, ripple, and the pieces pressing around their centres.
- **UI Reveal** ranks a small page with `screenOrder` and plays Quick Animate's keys, fade and blur on each piece.

## Checks

- `tests/saasinteraction.test.js` (5), on the mock comp:
  - **the plan:** settles before each click, widens a gap that is too short, presses down to Depth and springs past rest;
  - **Click on Layer:** the cursor reads back on each measured centre. A Logo whose anchor is on its corner presses to 94 % with its centre fixed at [1780, 220]. The Title presses on top of its own Scale animation. Restore removes the cursor and the keys.
  - **screen order:** rows, left to right, right to left, centre out;
  - **UI Reveal:** the stagger follows the screen (Logo → Title → Subtitle), not the selection;
  - **the tiles** and backdrops.
- **AE Self-Test:** a new check, *Click on Layer: cursor on the centre, press in place*, on left- and right-justified texts:
  - the cursor is within 0.6 px of each measured centre;
  - the centre moves less than 0.6 px under the press;
  - the width is 90 % at the deepest key;
  - undo is clean.

  It passes on the mock. **The owner's run in After Effects is the real proof.**

## Next

Carousel 3D, a Grid ring in 3D with a stepping rotation, comes next, together with Wipe Reveal.
