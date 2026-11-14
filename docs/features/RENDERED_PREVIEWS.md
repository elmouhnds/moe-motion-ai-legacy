# Rendered previews (v0.96)

The owner: every effect gets a real preview that After Effects rendered, small, the size of the panel, not a drawing.

## How
Diagnostics › **Rendered previews**: pick a library (or all), then *Render previews*.

For each tile, `features/previews/renderer.js`:
1. makes a fresh `MOE Self-Test Preview` comp (480 × 270, 15 fps);
2. adds a dark backdrop and the subject the tool needs (`SUBJECT`): an accent card, an outline, three cards, the words "MOE Motion", or nothing for backgrounds and templates;
3. selects it and runs the tool with the tile's **own args** through the executor, like a click;
4. renders the comp through After Effects' **Render Queue** to a JPEG sequence (`previews.render`) in `<data>/previews/<key>/`;
5. restores the tool (its pre-comps go) and removes the comp and its solids.

It works in short host calls, so Stop works between tiles. A tile that fails is listed with After Effects' own error.

`previews.render` renders only a `MOE Self-Test …` comp, only into `Folder.userData/MOE Motion AI/previews/<name>`, and only names of `a-z 0-9 -`. While it renders, the user's own queued Render Queue items are switched off, and they are switched back on in `finally`. MOE's item is removed.

## In the panel
`app/ui/studio/rendered.js`: a tile whose render matches its tool, version and args (`sigOf`) plays its frames. It loads them lazily, fills the tile, and holds briefly at the end. The still frame is the end of an In and a moment into an Out. The Inspector shows the render only while its settings equal the tile's; otherwise the drawn preview follows the settings. A tile never shows a stale render: a change of args or tool version renders it again.

## What is not rendered yet
Tools without a preview scene (grid, glass, zoom, compositing, expressions, …) are listed as "not rendered yet". Each needs its own scene (e.g. a grid of items, a background picture), added to `SUBJECT`, one family at a time.

## Tests
- `tests/matte.fx.test.js`:
  - one comp per tile, the tile's args, a JPEG sequence, nothing left in the project;
  - the user's queue kept;
  - cached until the args change;
  - unknown tools listed;
  - the host refuses other comps, other names and other folders.
- Self-Test `renderPreview`, in After Effects: the Render Queue really writes JPEG frames. **Rendering itself is unverified until that check passes**, because the mock does not render. Whether CEP shows `file:///` JPEGs in the tiles also needs a look in After Effects.

## v0.98: previews bundled with MOE (the owner: "render with any program you can")
Every motion / reveal / click tile now ships with a real render, so it plays before anything is applied, even with no After Effects render yet.
1. `tools/preview-frames.js` takes each frame's values from the SAME plans the tools write: mattePlan, fxPlan (completion, evolution, stepped time, the lagged edge), clickFxPlan, animatePlan and wipe.
2. `tools/render-previews.py` (numpy + PIL) turns them into pixels: an accent card on a dark stage, at 2× and scaled down. It draws:
   - matte cells;
   - the ramp + value-noise fBm map through the Gradient Wipe rule;
   - the Difference edge band + glow;
   - Turbulent wobble, Mosaic, ball scatter;
   - moves with blur, fade, scale and rotation, and the Linear Wipe.

   The output is one WebP sprite per tile (320 × 180, 15 fps) in `extension/assets/previews/` with `index.json`.

Run `npm run previews` after a tile changes. `tests/click.vfx.test.js` fails on any stale preview, because every sprite carries the tile's signature.

The panel (`studio/rendered.js best()`) plays, in order: **the user's After Effects render**, then **MOE's render**, then a quiet stage (`thumbs.render`). It never draws a look-alike. The still frame of a tile is a moment inside the effect (40 % into a reveal), so every tile shows its character at rest. The web preview embeds the sprites.

**Honest limits:** MOE's renderer approximates After Effects' Fractal Noise, Glow and CC Ball Action. The look is close, not identical. After Effects' own render (Diagnostics › Rendered previews) replaces it tile by tile. 110 tiles are covered so far: Motion moves and wipes, Matte Reveal, Matte FX and composed recipes, and Click VFX.
