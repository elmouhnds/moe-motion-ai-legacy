# Manual test — Group 1: Motion Control (Ease curves · Anchor 3×3 · Align & Distribute)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** — Help › About; Diagnostics reports `26.5.3x9`, en_US, ExtendScript 4.5.6 |
| MOE Motion AI | **0.99.5** (Diagnostics › Host module) |
| Panel style | Glass (the owner's) |
| Project | `Desktop\MOE Manual Test\MOE Manual Test.aep`, comp `MOE Manual Test G1` 1920×1080 · 25 fps · 10 s |
| Subjects | text `MOE Motion`, 3 shape rectangles (one scaled 150 % + rotated 20°, one rotated 10°), a null, a 400×300 solid |
| Code | `features/curves`, `features/transform`, `features/kit` |

Before anything was changed: `npm run check` **failed on a fresh Windows clone** (5 tests). That is fixed first — see
`manual-test/0-setup`; nothing in `extension/` was touched for it.

## Results

| # | Tool | Subject | Verdict | What I saw | Fixed | Re-tested on screen |
|---|---|---|---|---|---|---|
| 1 | Anchor 3×3 — top-left | 400×300 solid | **WORKS** | Anchor 200,150 → 0,0 and Position 960,540 → 760,390; the pixels did not move. One Ctrl+Z put both back, no "Undo group mismatch". | — | yes |
| 2 | Anchor 3×3 — centre | shape, scale 150 %, rotation 20° | **WORKS** | Anchor → −677.9,320.7, Position → −160.0,644.3, nothing moved on screen. The shift equals R(20°)·S(1.5)·Δanchor exactly (−1120.05, +104.29). | — | yes |
| 3 | Anchor 3×3 — top-right | shape, rotation 10° | **WORKS** | Anchor → −65,149.6, Position → 927.6,686.2, nothing moved. Toast "Anchor moved on 1 layer". | — | yes |
| 4 | Anchor 3×3 — right-click | any layer | **UGLY** | Right-click opens the smart pie (by design). Its centre read **"Repeat / Anchor Top…"** — a cut name, and it hides *which* anchor would be repeated. `docs/features/NO_CUT_NAMES.md` forbids a cut name. | yes | yes |
| 5 | Align — left / top (Sel) | 3 shape layers, two of them rotated | **WORKS (maths)** | Left: 960→−616.2 / 927.6→−25.4, leftmost layer stayed. Top: tops line up within ~1 px on the rotated layers, so real comp-space bounds are used. One Ctrl+Z restored all three positions. | — | yes |
| 6 | Align / Distribute — selection | 3 shape layers | **WRONG RESULT** | After the run After Effects had **0 layers selected** (confirmed twice, and by `moe_status`). So the panel's own next step — the "Next after Align left edges → Distribute H" strip — was greyed out, and any After Effects follow-up needed re-selecting. | yes | yes |
| 7 | Ease curve library | 2 Position keys | **WORKS** | "Out Back" then "Settle" applied real temporal ease (keys became ease icons), the Retune strip showed the curve's own numbers (Out X 0.34 · Out Y 1.56 · In X 0.64), toast "Curve on 2 keyframes". Edit menu read **"Undo MOE: Ease Curve"** — one undo per run. | — | yes |
| 8 | Ease curve with no keys | a layer, no keys | **WORKS** | Honest refusal: "Curve set — select two or more keyframes to apply it". | — | yes |
| 9 | Copy ease | 2 eased keys | **WORKS** | "Paste ease" went from disabled ("nothing copied") to enabled. | — | n/a |
| 10 | NOW strip / which tools are shown | 3 shape layers | **WRONG RESULT** | With three shape layers selected in After Effects the panel still said **"Nothing selected · 0 layers"** and rendered the *nothing-selected* page — ANCHOR and ALIGN were **not on screen at all**, so Align was unreachable. Measured 24 s with the pointer resting on the panel. One click anywhere in the panel fixed it instantly. | yes | yes |

## The three defects, and why

### A. A measurement probe costs the user their selection (#6)
Read by hand in After Effects 26.5.3: with three layers selected, **Layer › New › Null Object left only the new
null selected** — adding a layer selects it and deselects everything else. `layers.bounds`
(`extension/host/ops/layout.jsx`) measures by adding a temporary null, reading `sourceRectAtTime` / `toComp`
through expressions, and removing it in `finally` — so every tool that measures first (Align & Distribute) ended
with nothing selected. `pixels.sample` (`compositing.jsx`) has the same probe. `transform.jsx probeDelta` already
put the selection back and even says so in its comment; the other two were missed.

**Fix** — `U.keepSelection(comp, fn)` in `extension/host/lib/util.jsx` remembers the selected layers and puts them
back in `finally` (`Layer.selected` is read/write, After Effects Scripting Guide). `layers.bounds` and
`pixels.sample` now run inside it.

**Mock** — `tests/mock/ae-mock.js` kept the selection when a layer was added, i.e. it was *more lenient than After
Effects* and hid this from 600+ tests. `addNull` / `addSolid` / `addText` / `addShape` now select the new layer and
deselect the rest, the way After Effects does. That alone turned 15 tests red; the host fix turned 13 of them green
again, and 5 test setups that add a helper layer now re-select what they are about.

### B. The panel's context goes stale while you work in After Effects (#10)
`extension/app/ui/shell.js` says "AE sends no selection-change events to panels: re-read on focus / hover", but the
hover path only sets `lastPointer` for a timer poll (2.5–10 s, gated on `!document.hidden`). Measured: with the
pointer resting on the panel and three layers selected, the strip still read "Nothing selected · 0 layers" after
**24 s**, and the page that was rendered had no ANCHOR / ALIGN on it.

**Fix** — the pointer arriving on the panel now re-reads the context on the event itself (throttled to one read per
1.2 s, never while a button is down or within 400 ms of an interaction), instead of waiting for the next tick.

### C. A cut name in the pie centre (#4)
`pie.js` wrote `Repeat <name>` into a 64 px, two-line box, so After Effects showed "Repeat / Anchor Top…". The
repeat arrow above it already says "repeat", so the centre now shows the name only — the same text a hovered slot
puts there — and the full sentence stays in the tooltip and `aria-label`.

## Still open — needs the owner
Making the mock honest also showed that **multi-step flows lean on a selection After Effects clears**: a Smart Kit
recipe (`kitRun.runRecipe`) and the Self-Test's `checkSpeed` run a second tool on what the first one made, but the
first one added layers, so After Effects had already moved the selection. Two tests still fail on that
(`tests/control.test.js` Smart Kits, `tests/selftest.test.js`). What a recipe should select between steps is a
design decision, so it is not changed here.

## Not tested in this group
- Paste ease onto a *different* layer's keys (only the copy side was exercised; the second layer had no keys yet).
- Align modes `Key` and `Comp`, and the Gap field — only `Sel` with left / top was driven by hand.
