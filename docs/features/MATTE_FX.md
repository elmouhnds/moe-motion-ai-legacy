# Matte FX (v0.96)

The owner asked for a library of many reveal effects, all built on alpha-matte footage made with Fractal Noise and other effects, and done professionally, not with dated, repetitive tricks. The reference tutorials could not be watched from here: YouTube answers this environment with its bot check, and that is never worked around. The owner can upload the videos into the chat, and their frames will be studied with ffmpeg.

## The technique (all native After Effects effects)
For each selected layer, ONE host call (one Ctrl+Z) makes three pre-comps, in the layer's own space and following it:

| Pre-comp | What it holds |
|---|---|
| `MOE FX N Map` | `MOE FX Ramp`: Gradient Ramp, linear along an angle or radial from the centre (or flat grey for a pure dissolve), with `MOE FX Noise` on top: Fractal Noise blended Overlay at *Noise* %, Evolution keyed so the edge boils as it moves |
| `MOE FX N Matte` | the Map (hidden) and `MOE FX Wipe`, a white solid with **Gradient Wipe** reading the Map: Transition Completion keyed 100 → 0 (In), Softness, and optionally Turbulent Displace (`MOE FX Liquid`). This is the layer's **Alpha Track Matte** |
| `MOE FX N Edge` | only with an edge: the Matte twice, the second one a moment later, blended **Difference**. The result is a thin band at the reveal front |

In the user's comp:
- `MOE FX N Matte` sits above the layer: anchor = (margin − left, margin − top), position (0, 0), parented to the layer.
- With an edge, `MOE FX N Glow` is a linked copy of the layer with Fill (the edge colour) and Glow, blended Add, and its **Luma** matte is `MOE FX N Edge Matte`.

Only parameters with known units are set (%, px, degrees, colours, a layer reference). The one exception is Gradient Ramp's *Ramp Shape* menu: 1 Linear, 2 Radial.

## The library (`features/reveal/fxPlan.js`, 16 effects + 3 Out tiles)
Organic Sweep, Ink Bleed, Smoke Rise, Burn In, Lava Edge, Electric Edge, Neon Wipe, Paper Tear, Frost Creep, Light Bloom, Cloud Iris, Liquid Rise, Ink Wash ↗, Grain Dissolve, Cloud Dissolve, Aurora Edge. Out tiles: Burn Away, Ink Recede, Grain Out.

Settings: Direction (In / Out), Duration, Ease, Direction angle, Edge softness, Noise %, Noise size, Glowing edge on / off, Edge colour, Glow radius, Seed, Stagger.

## Rules
- A layer that already has a track matte, or is 3D, is skipped and named; nothing usable means nothing written.
- Restore (one step): track mattes off, MOE FX layers removed, then the MOE FX pre-comps nothing else uses (`comps.removeMoe`). The few solid items the pre-comps used stay in the project; After Effects' own Undo removes them too. Said in the tool card.
- The tiles show an icon until the preview is rendered (docs/features/RENDERED_PREVIEWS.md). There is no look-alike drawing.

## Tests
- `tests/matte.fx.test.js`:
  - every effect starts hidden and ends shown (Gradient Wipe's rule), Out is the reverse, the matte sits on the layer;
  - the pre-comps and mattes are wired (alpha / luma, parents, hidden), Gradient Wipe reads the Map, Completion is keyed 100 → 0, the Edge is Difference;
  - one Ctrl+Z, and Restore removes everything;
  - refusals.
- Self-Test `fxMatte`, in After Effects: Burn In and Ink Bleed, every parameter found by its English name, the mattes wired, Restore. **The effect parameter names are unverified until this check passes in After Effects.**
