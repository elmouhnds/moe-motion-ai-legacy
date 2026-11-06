# Wave 4: Decode / Scramble, Exploder, Depth Reveal (v0.64.0)

The fourth wave of the reference plan (docs/research/REFERENCE_PLUGINS.md), built on Engine 2: keys on frames, one Ctrl+Z, locked layers safe, few round trips.

## Decode and Scramble (Text › Scramble)

One text animator with **Character Offset**. The letters show as other letters (each moved n places along its own alphabet, upper/lower case and digits kept), then settle into the real word.

| Preset | Order | Settings |
|---|---|---|
| **Decode** | left to right | square shape, by character, Character Offset 30 |
| **Scramble** | random order | Character Offset 22, at 35 % opacity while scrambled |

By character, so these are marked **not Arabic-safe**: Arabic letters would lose their joins. With Arabic text, the Text page switches to words automatically.

## Exploder (Text › Exploder)

A **Wiggly Selector** after the Range Selector gives every letter its own random amount between −100 % and 100 %. It is set to:

- **Intersect** mode;
- Min −100 / Max 100;
- **0 wiggles per second** (frozen, so the scatter does not shimmer);
- Correlation 0;
- dimensions unlocked;
- seed 7.

With those settings, one Position and Rotation sends each letter in its own direction. The Range Selector still does the timing.

| Preset | Kind | What it does |
|---|---|---|
| **Assemble** | in | the letters fly together from a scatter (700 × 480 px, 220°, blur) |
| **Explode** | out | the letters scatter away (900 × 640 px, 260°, blur) |

- **Settings by name:** each Wiggly setting is found by its **English display name**: Mode, Max Amount, Min Amount, Wiggles/Second, Correlation, Lock Dimensions, Random Seed. Verify names any setting that was not found; it never silently skips one.
- **Self-Test** *Explode: the Wiggly Selector and its 7 settings, found by name* proves the names in the owner's After Effects.

## Depth Reveal (Motion › In / Out › Depth)

SaaS Kit's Depth Reveal downloads a depth model; this one needs nothing.

- **3D:** each layer is made 3D. This is recorded, and Restore makes it 2D again.
- **The move:** its own Position, read **on the frame of its start**, is keyed from **Z + Depth** to where it is. Out goes the other way. In After Effects +Z is further from the default camera, so the layer grows into place.
- **Separated** X / Y / Z: the Z Position alone is keyed. A Position with an expression is skipped and named.
- **Same timing:** Quick Animate's fade and **MOE Blur** run with the move, staggered in **screen order** (from UI Reveal).
- **Few calls:** all own values are read in one call.

Tiles: Depth In, Depth In · Far (2400 px, Expo), Depth Out. The preview uses the tool's Z keys through a simple perspective, with the same fade and blur.

## Also fixed

**Text animator keys** were written by the text host op directly, not through `keys.write`, so they could fall between frames. For example, the owner's 1.733 s preset at 24 fps. They are now on the comp's frame grid too.

## Not in this version

**Figma import** needs a Figma account token and network access to Figma's API. That is a separate decision for the owner: where the token is kept, and which network access the panel gets. It is not built.

## Checks

`tests/wave4.test.js` (4):

- **Decode:** Character Offset 30, not Arabic-safe, keys on frames at 24 fps.
- **Explode and Assemble:** two selectors; the Wiggly Selector's Mode / Min / Max / Wiggles / Correlation read back as 3 / −100 / 100 / 0 / 0; all 7 settings found by name.
- **Depth Reveal:**
  - 3D, with Position [400, 540, 900] → [400, 540, 0] on frames at 30 fps;
  - Left before Right (screen order);
  - fade and MOE Blur;
  - Restore leaves 2D layers with no keys and no effect.
- **Placement:** the presets and tiles.
