# Clone Trails (v0.41.0)

**What:** select one animated layer, then **Echo Trail**, **Ghost Trail** or **Spin Trail** (Layout & Grid › Clone).
- MOE makes N copies below the layer.
- Each copy plays the layer's own motion **later**: copy k reads the source at time − k × Delay frames.
- Each copy is a little more transparent (Fade), smaller (Scale Step) and turned (Rotate Step).
- You get a motion trail without keyframes on the copies.

**Why:** a classic pro look: echo trails, ghosting, snakes. Doing it by hand means copying keyframes and offsetting them per copy, then redoing everything when the motion changes. Here the trail follows the layer live, so you animate the layer and the trail updates.

## How
- **`MOE Trail N`** (a null at the layer) holds **Delay** (frames), **Fade** (% per copy), **Scale Step** (% per copy) and **Rotate Step** (° per copy), all live in Effect Controls.
- **The copies** are plain duplicates (`MOE Clone n · <layer>`: same content, effects and style).
  - They sit below the source and are **unparented**.
  - Their Position, Scale, Rotation and Opacity carry expressions tagged `// MOE Trail`, so Trash finds them.
- **The expressions:**
  - position = the source's anchor in the comp at that time (`toComp(anchorPoint, t)`), so a parented or rigged source works;
  - scale = the source's × (1 − Scale Step)^k;
  - rotation = the source's + k × Rotate Step;
  - opacity = the source's × (1 − Fade)^k.
- **Reference:** `features/grid/trail.js` (`at`, `code`). Read-back compares every copy, one second in, with the source read at that copy's own time (position only when the source has no parent).
- **Restore** removes the copies and the null.
- **Refused before anything is made:** not exactly one layer selected; a null, camera or light; a MOE copy; a locked layer; two layers with the same name (the trail finds its source by name).

## Not covered (said honestly)
- The source's **anchor point animation** is not followed: the copies keep the anchor it had when the trail was made.
- **Rotation through a parent** is not added. Rotation is the source's own, and position is exact through any parent.
- Effects on the source with keyframes are copied **as they are**, not delayed.

## Tests
`tests/clone.trail.test.js` (4):
- **A trail of 5 on a keyframed Ball**, at 4 times: position, scale, rotation and opacity = `trail.js`. The 3rd copy at 1 s is the Ball 9 frames earlier at 51.2 % opacity. Delay is live on the null. Restore removes everything.
- **A parented source:** the copies follow its comp point.
- **Refusals.**
- **Tiles.**

The Self-Test gained a **trail** check (15 checks now): a keyframed solid, a trail of 4, every copy against `trail.js` at 2 times, and the undo.
