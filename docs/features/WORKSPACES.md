# Workspaces (v0.65)

Owner, after v0.64: *every MOE tab had the same graph window on top; the tabs should be ordered better, hold what you
need to reach fast, and follow the work.*

## What changed

### MOE tabs follow the order of the work
| # | Tab (Ctrl+N) | Icon | What tops it | Groups |
|---|---|---|---|---|
| 1 | **Animate** | motion | Motion Bar (ease) | Animate In / Out / Draw / **Wipe / Depth / Shake** · Text Animators (+ **Decode · Assemble · Explode**) · Expressions |
| 2 | **Timing** (was Keys) | ease curve | the **full graph** (value + speed, handles, presets, anchor, align) | Keyframes & Loops |
| 3 | **Layer** | layers | **Place** (anchor · align · distribute) | Select · Transform · Parent & Link · Arrange (+ **Carousel 3D**) · Clone · Effectors |
| 4 | **Design** | palette | nothing (building, not moving) | **Product UI first** (Click on Layer) · Templates · Shapes & Icons · Backgrounds · Brand |
| 5 | **Look** (was Effect) | glass | nothing | **Styles** · Glass · Key & Color · Camera & Zoom |
| 6 | **Deliver** (was Comp) | resize | nothing | Guides & Safe Areas · Deliver & Project |

Tab ids stay `ae-*` (`ae-keys`, `ae-effect`, `ae-comp`…) so saved order, Recent, pins and shortcuts keep working.
With keys selected MOE opens on Timing (it is the tab that `fits` keys).

### The Motion Bar
The Motion Control (v0.30) is no longer a 700 px block on top of every page. By default it is one row:
**Easy · Linear · Hold** · up to two of your curves + the curves used most (Easy Ease, Out Expo, Out Cubic,
In-Out Cubic, Out Back, Settle) · **Graph**. One click applies to the selected keys.
- MOE: *Graph* goes to the Timing tab, where the full graph lives.
- Bento / Glass (NOW card): *Graph* opens the full graph in place, remembered per kind of selection.
- Under 400 px the bar stays one line: chips shrink, *Graph* becomes its icon.

Code: `layoutAE.tabControl` picks the part per tab (`tab.full`, `tab.bar` = `['bar']` / `['rail']` / `false`);
`kit.easeBlock` reads `K.scope.parts`; the Graph button carries the scope it was drawn with (`openEase(app, sc)`),
because `K.scope` is restored before a click arrives.

### Stages (Bento home, Glass spaces)
Design: Product UI, Templates, Shapes, Backgrounds, Brand. Finish: Styles, Glass, Key & Color, Camera & Zoom
(the MOE Look tab). Every group is still placed exactly once (`tests/workflow.home.test.js`).

## Rules
- A tab shows only the part of the Motion Control its work needs; never the full graph outside Timing.
- A new tool goes to the tab of the job (move → Animate, timing → Timing, place → Layer, build → Design,
  finish → Look, export → Deliver) and to its stage in `workflow.STAGES`.
