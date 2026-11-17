# Manual test — Group 9: Looks & Glass · Thick Glass · Zoom & Focus · Click VFX · Carousel

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G6` — a **MOE Background** (Northern Lights) with a 1000 × 400 card over it, so the glass has something real behind it |
| Code | `features/glass`, `features/zoom`, `features/interact`, `features/carousel` |

**Thick Glass did not run at all on After Effects 26.5.3 — all seven looks died on the same line. It runs now.**

## 1. Thick Glass — every look failed, one number was the cause

Every `glass.thick` tile, all seven:

```
FAIL looks/thick-glaze (glass.thick) — After Effects error: Unable to call "setValue"
     because of parameter 1. Value 12 out of range 0 to 0.5.
     [compositing.jsx line 250] (step 9 of 12: effects.ensure)
```

### The cause
`CC Glass › Roughness` is **0.00099…0.5**. I did not assume that — I read it from After Effects' own effect
profile through the bridge:

```
EFFECT CC Glass
    18 "Ambient"         min 0    max 200
    19 "Diffuse"         min 0    max 100
    20 "Specular"        min 0    max 100
    21 "Roughness"       min 0.00099182128906  max 0.5
```

Every other number the tool writes is on the scale it looks like. Roughness is the one that is not, and
`thickTools.js` wrote the raw `12`, so the plan died at step 9 of 12 — before the reflection, highlights and
caustics were ever built.

**It was wrong twice.** The user-facing control is *Glass Highlight Size*, 0–100, and the expression that drives
Roughness afterwards was `clamp(c('Glass Highlight Size'), 0, 100)` — straight into a 0–0.5 property. Had the static
write not crashed first, every look would have been pinned to 0.5: the dullest, flattest highlight CC Glass can
make. The Sugar Glass / Chrome / Gold difference would have been invisible.

### The fix
A 0–100 control is a **percentage of that parameter's own range**. One conversion, used by both the static write and
the expression (`thick.js ROUGHNESS_MAX = 0.5`, `roughnessAE()`), so the looks keep their order and their meaning:
Chrome 7 → 0.035 (sharpest highlight), Gold 9 → 0.045, Glaze 12 → 0.06, Arctic 22 → 0.11, Sugar Glass 32 → 0.16
(the softest), exactly as the look names say.

### Proved in After Effects
```
MOE 0.99.5 · After Effects 26.5.3x9 · 18 pass · 0 fail · 0 skip      (looks, was 11 pass · 7 fail)
PASS looks/thick-glaze · thick-prism · thick-sugar · thick-bubble · thick-arctic · thick-chrome · thick-gold
```

And by hand, over a real background: the card became a **convincing frosted glass panel** — the purple→teal mesh
behind it reads through, softened and tinted, with a soft contact shadow grounding it. The whole documented stack was
built in the right order: `MOE Glass 1 Highlights · Reflect · Prism B · Prism R · MOE Glass 1 · MOE Glass 1 Map ·
[Glass Card] · MOE Glass 1 Caustic · MOE Glass 1 Shadow`. **One Ctrl+Z took all nine layers away.**

### The mock was more lenient than After Effects
`ADBE CC Glass`'s Roughness in `tests/mock/ae-mock.js` had no range at all, so 12 passed silently in every test. It
now carries After Effects' own range, and with the fix reverted **8 tests go red** with After Effects' exact words:
`Value 12 out of range 0.00099182128906 to 0.5`.

## 2. The tools

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | **Thick Glass** (7 looks) | **ERROR → fixed** | `Value 12 out of range 0 to 0.5` on every look. Fixed, re-tested in After Effects, and judged by eye over a real background (above). |
| 2 | **Looks & Glass** (the flat glass looks) | **WORKS** | 18 of 18 tiles run. The library page shows real rendered previews — spheres over colourful backgrounds — and they read as distinct materials, not one effect with different numbers. |
| 3 | **Backgrounds** (tested here, untested in Group 6) | **WORKS** | The `APPLY` chip in search built `MOE Background` in one click: a Northern Lights mesh gradient that looks genuinely premium. The composer page that opened has STYLE (Linear/Radial/Mesh/Flat) · MOTION (Still/Drift/Orbit/Swirl) · COLOURS, and Effect Controls carries exactly `MOE Mesh` (4 points + 4 colours), `MOE BG Loop`, `MOE BG Amount`, `MOE BG Colour`, `MOE Grain` — controls on demand, nothing else. |
| 4 | **Zoom & Focus › Punch In** | **WORKS** | Added **one** `MOE Zoom` adjustment layer carrying a Transform effect — the user's layers untouched, as `docs` promises. **One Ctrl+Z** removed it. All 9 zoom tiles run. |
| 5 | **Click VFX › Liquid Ripple** | **WORKS** | A glowing organic ring grows from the click point and fades, with a soft flash inside at the start. The edge wobbles — it is not a plain circle — and it reads as a real tap ripple. All 21 Product UI tiles run. |
| 6 | **Carousel 3D** | **WORKS** | `MOE Carousel 1: 3 cards, radius 173 px`. Real depth: the front card is bright, the two behind are darker, and the ring turns with one card going edge-on. On three identical cards at the default gap it reads as a tight stack before it turns; a wider gap opens it out. |

## 3. What the section numbers look like now

| Section | Before this session | Now |
|---|---|---|
| `looks` (18) | 10–11 pass · 7–8 fail | **18 pass · 0 fail** |
| `zoom` (9) | **0 pass · 9 fail** | **9 pass · 0 fail** |
| `productui` (21) | 3 pass · 18 fail | **21 pass · 0 fail** |
| `carousel` (3) | — | **3 pass · 0 fail** |

Two different causes are behind that: the Roughness fix above (the `looks` failures, which were real errors), and
Group 8's undo-check fix (the `zoom` and `productui` failures, which were the check blaming the tool — and which I
confirmed by hand here: one Ctrl+Z really does take Punch In and the nine-layer Thick Glass stack back).

**Read the "undo not measured" count honestly.** 14 of the 18 `looks` rows, all 9 `zoom` rows and 18 of the 21
`productui` rows could not have their undo measured in this run, because the Edit › Undo press changed nothing. That
is not a pass for the one-undo rule — it is "not measured". The hand tests above are what stands behind Thick Glass
and Punch In.

## 4. Open / not fixed

1. **The Prism look's dispersion is not visible.** `prism` and `bubble` carry dispersion 35 and build real
   `MOE Glass 1 Prism R` / `Prism B` layers, but on screen I could not see any colour fringing at the glass edge —
   prism and the plain clear look read almost the same. The parts are there; whether the spread is simply too small
   to see is the owner's call, so I have not touched `PRISM_SPREAD`.
2. **The click ripple escapes its layer.** The Liquid Ripple grows past the card's edges and keeps drawing on the
   background. For a tap on a button or card a ripple is normally clipped to the element. If "click anywhere on
   screen" is the intent it is right as it is — a design decision, not a bug I should make alone.
3. **The panel's search box loses characters while you type.** Typing `background` landed as `backgrod`, and
   `focus zoom` as `focusm`, each time showing *"Nothing matches…"*. It happens when typing starts before the panel
   has finished re-rendering. Not a defect I can call from the outside with certainty, but it happened four times in
   this group alone and it makes the search look broken.

## 5. Numbers

| | |
|---|---|
| `npm run check` | **646 pass · 0 fail · 1 skipped** |
| New test | `tests/glass.thick.test.js` — CC Glass Roughness is 0–0.5, and "Glass Highlight Size" is a percentage of it (8 tests go red on the old code) |
