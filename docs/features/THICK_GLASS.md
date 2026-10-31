# Thick Glass (v0.27.0) — Glaze-class refractive glass from native effects

The owner asked for "something like aescripts Glaze, in a suitable place, implemented with high precision".

## What Glaze does (study)
aescripts.com is blocked from the build session's network, so the product page could not be read. From third-party
descriptions (download listings and a community post — not the official page):
- turns any layer into thick, refractive glass **from its alpha**, one click, real-time;
- refraction, **chromatic aberration**, matte **roughness** (frost), **caustics**, five distortion modes;
- low refraction + high reflection = **chrome** without HDRI; *Studio Light* shapes the highlights; *Reflection Blur*
  turns a mirror into a frosted metal;
- a *Glaze Adjustment* effect: one glass over a group of layers; newer versions no longer change layer opacity / order.

Glaze is a compiled effect plug-in (.aex). MOE cannot ship one (CEP panel + ExtendScript only), so the same result is
built from effects that ship with After Effects, wired so that it stays exact and editable.

## Where it lives
Design › **Looks & Glass** (same section as the flat UI glass — no new section, no duplicate tool), filter **Thick**,
seven looks first in the grid. Classic / Bento / Glass / MOE all show it through the shared `layoutAE` Design tab
(Looks & Glass group: Thick Clear, Prism, Chrome, Liquid Gold, Frosted, Liquid). Tools: `glass.thick`,
`glass.thickLook`. Flat glass (`glass.apply`, Glasser-style UI cards) stays as it was.

## The precision problem and the answer: one live height map
Effects that read another layer (CC Glass *Bump Map*, Displacement Map) read that layer's **source only** — no effects,
no masks, no transforms (confirmed on the Adobe community forum for CC Glass). A bump map taken from the original layer
would therefore slide away from the shape as soon as the layer moves, is parented, scaled or animated.

So Thick Glass builds **`MOE Glass N Map`**: a small comp (same size / rate / duration) holding a copy of the source
(`Layer.copyToComp`), painted white with Fill, and linked back to the original **by expressions**:
- transform through `toComp`: the copy's anchor sits where the source's anchor lands; rotation and scale from where two
  100 px steps land (a flip gives a negative Y scale with the rotation turned 180°) — parents, keyframes and expressions
  of the original are all included. Tested to 1e-6 px with a rotated, scaled parent, a flipped, rotated child and animated
  position (`tests/glass.thick.test.js`).
- every shape path / rectangle / ellipse / stroke width / trim, every mask, the Source Text and the text animators,
  time remapping: each value is linked **by property index** (`comp("Main").layer("Logo")("ADBE Root Vectors Group")(1)(1)…`),
  so editing the original shape or text updates the glass. Colours are not linked (the map is white). Capped at 400 links
  per layer (reported).

The map comp layer sits hidden above the source; its *source* is the comp render — in comp space, transforms and effects
included — exactly what CC Glass and the track mattes need.

## The setup (top → bottom)
| Layer | What it is | Reads |
|---|---|---|
| `MOE Glass N Highlights` | black solid, **Screen**, CC Glass light only (Ambient 0, Diffuse = edge light, Specular, Roughness = highlight size, Light Direction / Height / Colour) — *studio light* | matte = Map, Bump Map = Map |
| `MOE Glass N Reflect` | solid: Gradient Ramp along the light (light colour → near-black) → CC Glass **warp** → blur — *reflection / chrome* | matte = Map, Bump Map = Map |
| `MOE Glass N Prism B` / `Prism R` | adjustments, **Lighten**: Transform scales the refracted image ∓/± (Dispersion 100 = ±3 %) about the glass centre → Channel Mixer keeps one channel — *lateral chromatic dispersion* | matte = Map |
| `MOE Glass N` | adjustment: controls · Frost (Gaussian) → **CC Glass refraction** (Softness = bevel, Height = thickness, Displacement = refraction; Ambient 100, Diffuse 0, Specular 0) → Tint → Brightness | matte = Map, Bump Map = Map |
| `MOE Glass N Map` | hidden pre-comp layer (the live white copy) | — |
| *source* | hidden (restorable) | — |
| `MOE Glass N Caustic` | linked copy, **Add**: light colour → Simple Choker (core) → blur, offset toward the shadow — *light focused by the glass* | — |
| `MOE Glass N Shadow` | linked copy: black, blurred, offset away from the light | — |

With **One piece** (one glass for all), the map holds every selected layer and one stack refracts them as one piece (Glaze
Adjustment); shadows / caustics are per layer (`Shadow 1`, `Shadow 2` …). Parts can be switched off: Dispersion,
Reflection, Highlights, Shadow, Caustics.

## Controls (Effect Controls on `MOE Glass N`, all animatable)
Thickness · Bevel · Refraction · Frost · Dispersion · Tint · Tint Amount · Brightness · Highlights · Highlight Size ·
Edge Light · Light Angle · Light Height · Light Color · Reflection · Reflection Warp · Reflection Blur · Shadow ·
Shadow Softness · Shadow Distance · Caustics. Values that feed effect parameters are clamped in the expression.
**Thick Glass Look** writes a look's values into these controls (only them), so a glass can change look and keep its
animation.

## Looks
Thick Clear · Prism (strong dispersion) · Sugar Glass (frosted) · Bubble (round bevel, strong highlights) · Arctic Ice
(cool tint) · Chrome (refraction ≈ 0, reflection 100) · Liquid Gold (chrome + gold tint and light). Tint from the Brand
Kit like the flat glass.

## Safety
- One host op per step, each in an undo group; `glass.map` removes its comp if anything fails; the tool removes every
  layer and the map comp it made in this run if a later step fails (tested with CC Glass unavailable).
- Effect parameters are resolved by English name; CC Glass names that differ fail the run with the real parameter list.
- Verify reads back: map hidden + copies linked without engine errors, every matte = map, every CC Glass Bump Map set,
  every link without expression errors, sources hidden.
- History › Restore removes the layers and the map comp (only when nothing else uses it) and shows the sources again.
- Refused: 3D layers (the map is a 2D copy), duplicate layer names (links are by name), more than 8 layers.

## Honest limits (to check in After Effects)
- **Unverified in AE**: CC Glass parameter names (`Bump Map`, `Softness`, `Height`, `Displacement`, `Light Intensity`,
  `Light Color`, `Light Height`, `Light Direction`, `Ambient`, `Diffuse`, `Specular`, `Roughness`) and how its shading
  values look (Ambient 100 / Diffuse 0 / Specular 0 meant as "no shading" on the refraction pass). If a name differs the
  run stops cleanly and lists the real names.
- Dispersion uses Lighten: it adds colour fringes where a shifted channel is brighter — a close, not physical, model.
- Caustics are a focused glow under the glass, not traced light.
- A parent with non-uniform scale **and** rotation makes a skew the copy cannot reproduce exactly.
- Renaming the main comp or the source layer breaks the links (same as every name-based MOE rig).
- Adding new groups to the source shape later: run Thick Glass again (existing values stay linked).
