# Apple Motion (v0.58.0)

**First release of the reference plan** (docs/research/REFERENCE_PLUGINS.md, wave 1). The calm, expensive feel of Apple-style interface motion comes from three things:
- curves that start or stop softly;
- a layer that comes in **sharp out of a blur**;
- text that rises in by line or word with a soft blur.

All three are now in MOE, built on our own engines.

## Blur on entrances and exits

Quick Animate (every Motion tile) has a **Blur** setting, in px:
- **0 means none.** That is the default, so nothing changes for existing tiles or bars.
- **Above 0:** the layer gets a `MOE Blur` (Gaussian Blur, *Repeat Edge Pixels* on), and its **Blurriness** is keyed on the **same timing and ease** as the move: from the blur to 0 coming in, from 0 to the blur going out.
- **One effect per layer:** a second run reuses `MOE Blur`, never adds another. It is added through `effects.ensure`, which resolves the parameter by name and reads it back.
- **Restore** removes the keys, and removes the effect if this run added it. If the effect was already there, Restore puts its values back.
- **The plan is pure** (`animatePlan.blur`). The tile previews draw it as a real canvas blur on the moving shape, scaled from comp pixels to the tile (Real Previews rule).

**Seven new tiles** (Motion › In / Out, tag *Blur*):

| Tile | What it does |
|---|---|
| Blur In / Blur Out | fade + 40 px blur |
| Focus In | from 112 % + fade + 30 px blur, Expo |
| Focus Out | to 92 % + fade + 24 px blur |
| Whip In / Whip Out | a fast 420 px slide + fade + 60 px blur, Expo, 0.5 s |
| Rise + Blur | 60 px rise + fade + 24 px blur |

## Native curves (Ease library, tag *Native*)

Seven calm, OS-style interface curves, named by what they do:

| Curve | Bezier | Use |
|---|---|---|
| Native Standard | 0.4, 0, 0.2, 1 | default interface motion |
| Native Emphasized | 0.2, 0, 0, 1 | a pronounced, confident move |
| Native Enter | 0, 0, 0.2, 1 | things arriving (decelerate) |
| Native Exit | 0.4, 0, 1, 1 | things leaving (accelerate) |
| Spring Soft | 0.25, 1.18, 0.5, 1 | a gentle overshoot |
| Spring Bouncy | 0.3, 1.5, 0.45, 1 | a lively overshoot |
| Anticipate | 0.55, −0.35, 0.3, 1 | a small wind-up before the move |

They go through the same engine as every curve: `bezier.js`, then After Effects temporal ease per segment. A Position overshoot is reported, never faked (project rule).

## Apple-style text presets (Text, group *Hero*)

| Preset | By | What happens |
|---|---|---|
| Hero Reveal | line | from 118 % + 30 px blur + fade |
| Word Stagger | word | each word rises 40 px out of a 14 px blur |
| Word Burst | word | each word grows from 40 % out of a blur |
| Iris In | line | from 160 % + 50 px blur, settling into focus |
| Hero Out | line | to 92 % + blur + fade |
| Stagger Out | word | each word rises away into a blur |

All of them work by **line or word**, so they are **Arabic-safe** (letters never disconnect). The text animator's own Blur property is used, one animator per preset, as before.

## Checks

- `tests/applemotion.test.js` (4):
  - **Blur In on the mock:** a `MOE Blur` per layer; *Repeat Edge Pixels* 1; Blurriness keys at the plan's times (playhead + 0 / 0.7 s), values 40 → 0; a second run reuses the effect; Restore removes keys and effect.
  - **Blur 0** adds nothing; the out plan is 0 → 30; the previews call `PLAN.blur`.
  - **Native curves:** seven of them, the springs overshoot and Anticipate winds up, all storable, 0 → 1.
  - **Text and tiles:** six text presets, all Arabic-safe with blur; seven Blur tiles, each with a blur.
- Playwright: Blur In's preview mid-entrance shows the box blurred, with the Blur 40 px slider in the Inspector. 0 JS errors.
