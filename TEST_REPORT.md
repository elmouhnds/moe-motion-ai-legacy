# Test Report

## 1.0.1 (2026-11-20)
- The one tile that failed in the full Tile Test, `layout/cloneSun`, is removed at the owner's request (saved refs
  migrate to `layout/cloneGrid`). Mock only.

## 1.0.0 (2026-11-20) — what changed since the full Tile Test below, and where it ran
- The fixes below are in 1.0.0, plus three from the review of those branches (undo counting, honest Restore,
  Self-Test cleanup) — **mock only** (`npm run check`: 677 / 677).
- **Quick Apply (the pie's search) and MOE Quick (the window over After Effects) are NOT verified in After Effects.**
  Mock tests only (`tests/quickapply.test.js`, the pie tests in `tests/workflow.test.js`) and the UI audits in the
  web preview. To verify by hand: `docs/handoff/AE_RETEST_1.0.md`.
- After the review fix, the Tile Test now counts every Undo press; the 352 below was counted with the old rule (a
  refused press retried for free), so its "one Ctrl+Z" numbers must be read again on 1.0.

## Full Tile Test in After Effects 26.5.3 after the manual-test session (v0.99.5 + the fixes on `manual-test/0…11`)

**352 pass · 1 fail · 0 skip · 220 undo not measured · 1765 s**, all 353 tiles, run through the Claude Test Bridge
on the owner's PC (After Effects 26.5.3x9, Windows 11). The previous full run was **222 pass · 126 fail · 5 skip**.

**Read the 352 for what it is: every tile RUNS without an error. It is not proof that the one-Ctrl+Z rule holds.**
220 of the 353 tiles could not have their undo measured at all, because After Effects intermittently ignores
Edit › Undo run from a script (measured: the command is found by its own menu text, executed, and nothing changes —
four times inside one host call and four times in four separate calls). Before that was understood, the runner
counted those as presses and reported the TOOL as leaving things behind; that is where most of the old 126 came
from. The one-undo rule was checked **by hand** instead, tile by tile, in the group reports —
`docs/handoff/reports/MANUAL_01…11`.

What really was broken, and is fixed with a test that fails on the old code:

| Found | Where |
|---|---|
| `setPropertyParameters` loses an effect's MOE name on 26.5.3 — the whole Cloner / Grid / Effector family could not run | `MANUAL_07` |
| CC Glass `Roughness` is 0–0.5, not 0–100 — every Thick Glass look died at step 9 of 12 | `MANUAL_09` |
| Align & Distribute cleared the selection, so its own next step was dead | `MANUAL_01` |
| Slide In / Out left a solid in the project on every run | `MANUAL_02` |
| The Tile Test's undo check blamed tools for an Undo After Effects never performed | `MANUAL_08` |
| The Retune strip offered numbers that do not apply to the run that was made | `MANUAL_08` |
| `rig.bake`'s Restore reported success without reading the host's answer | `MANUAL_10` |
| Style Kits promised "one click, one undo"; a 3-step recipe takes 3 | `MANUAL_11` |

### The one failure
```
FAIL layout/cloneSun (grid.build) — After Effects is still working on "tx.run" after 300 s
     (it may be busy or showing a dialog). It is not stopped — After Effects cannot interrupt a script.
```
`layout/cloneSun` is a phyllotaxis cloner: **60 clones with an animated build-in, sent as ONE `tx.run`**. That is
the one place `docs/features/PROGRESS.md` is not honoured — *"a long tool is many SHORT host calls (Stop works
between them), never one call that loops for minutes"* — and the error text says itself that it cannot be stopped.
Not fixed: splitting it is engine work on the plan builder, and it wants its own measurement.

### Still open, measured, not guessed at
- **Matte FX / Reveal Composer: Edge softness does nothing.** Rendered at softness 0, 50 and 100 the front is the
  same 4 partly-transparent pixels on a 358 px card. The number reaches the controller (Softness slider 16) but
  Gradient Wipe reads Transition Softness 0 %. The unit is NOT the cause — writing 16 throws `Value 16 out of range
  0 to 1`. (`MANUAL_08`)
- **Bake's Restore is not exact**, as `BAKE.md` requires: `item 1 Position at 0.4s: [-920,-540,0] vs
  [-150,-120,0]` — the restored expressions no longer resolve to their grid. The bake itself is exact (worst 0).
  (`MANUAL_10`)
- **Text / Object Cloner** places split words 340 px (EN) / 216 px (AR) from their words, 3 allowed; **Exploder**
  read-back mismatch. (`MANUAL_07`)
- **A measurement leaves its own undo step** (`MOE: Measure (temporary)`, in `main` since v0.4.0), so a tool that
  measures takes two Ctrl+Z. (`MANUAL_08`)

---

Last run: 2026-11-06 (v0.59.0), Linux cloud sandbox (Node 22.22.0). **After Effects was not available in this environment.**

## First Self-Test in After Effects (still on v0.99.0)
32 checks, 7 pass / 25 fail — the first OUTPUT check in After Effects. 15 failures are the grid bug (fixed in 0.99.1),
4 the stall behind a slow grid, 1 the render Format (0.99.1), 1 Matte FX (0.99.1). New and fixed in 0.99.5: Wipe Reveal
from the wrong side (the tile test had passed it), the Marker In / Out check on a null (nulls are at 0 % in 26.x — the
tool itself is right), Explode on a hidden selector setting. Undo was confirmed by three checks (trail, matte, wipe).

## Third run in After Effects (still on v0.99.0)
222 / 126 / 5 — identical to run 1 tile for tile: the five bugs are deterministic (fixed since 0.99.1, not yet installed
there). New: per-tile times — layout 83 % of the run; the clone grids took 49–121 s and blocked the next tiles. The
cascade of false timeouts is fixed in 0.99.5; whether the clone grids themselves are slow in After Effects is measured
on the next run with 0.99.5.

## Tile Test coverage (v0.99.4, mock)
353 / 353 tiles run on the mock with no skip (was 340 + 13 skipped / failed for want of a subject). The host profile is
read in every run. **Mock, not After Effects** — the next After Effects run on 0.99.4 gives the real numbers and the
first real host profile.

## Render previews in After Effects (still on v0.99.0)
The owner clicked Diagnostics › Render previews on 0.99.0: 0 rendered · 208 failed, every one "Invalid Value for key: <Format>. Property is read-only" — the shared render path, fixed in 0.99.1 (output-module template). Not yet re-run on 0.99.1+. The failures left no line in the logs; logged since 0.99.3.

## Second run in After Effects (still on v0.99.0)
The owner ran Diagnostics › Test every tile on 0.99.0 (before installing 0.99.1): 222 pass · 127 fail · 4 skip — the same five bugs, as expected; the layout timeouts grew from 6 to 11 as a cascade (After Effects busy after the failing grids). Its new finding — `logs` lost most errors in a long run while `diagnostics.jsonl` kept all 123 — is fixed in 0.99.2. The "unescaped quote in logs" claim was withdrawn by the side session itself for the logger; the bridge answer is `JSON.stringify` and parses strictly in `tests/testbridge.test.js`.

## First full run inside After Effects (v0.99.0 → v0.99.1)
The side session on the owner's laptop (After Effects 26.5.3x9, Windows 11, MOE 0.99.0) ran all 353 tiles through the Claude Test Bridge: **222 pass · 126 fail · 5 skip**. Healthy in After Effects: backgrounds 52/52, expressions 37/37, templates 12/12, quick.animate 42/42, reveal.matte 15/15, interact.clickFx 4/4 and more. The 126 failures were 5 bugs (grid/effectors 51, reveal.fx 43, glass 14, carousel/click label 6, zoom 5) + 6 timeouts on big clone grids; the bridge could not render (Format read-only) or press Undo by name, and its log lost the errors in a long run. All fixed in 0.99.1 and reproduced first in the mock (each old-code failure checked). **The visual quality and the Undo count are still unverified in After Effects** — they need the next bridge run on 0.99.1. Not reproduced here: "unescaped quotes in the logs JSON" (the bridge answer parses strictly in `tests/testbridge.test.js`).

## Claude Test Bridge (v0.99.0)
`tests/testbridge.test.js`: a real HTTP bridge on 127.0.0.1 and the real MCP server process over stdio, with the mock After Effects behind them — key required (401 without / wrong), unknown command 404, browser Origin 403, unknown tool 400; MCP initialize / tools/list / moe_status / moe_try_tool (Globe on cards: PASS) / moe_test_tiles (3 tiles: 3 pass) / a bad tool → isError; with the bridge off the MCP server says how to turn it on; reload sets a 2-minute resume ticket. **Mock, not After Effects; not yet run on the owner's PC.**

## Second real After Effects report (v0.98.1 → v0.98.2)

After Effects 26.5 (Windows): the Cloner still failed; "Undo group mismatch, will attempt to fix"; grid.build failed with PLAN_NOT_COMMITTED and left 20+ clones; context.get then timed out (After Effects blocked by the dialog). Causes found in code: nested undo groups (every op inside `tx.run` opened its own), and a plan that stayed "not committed" when the host call threw. The mock now counts undo-group mismatches (before: almost every tile; after: 0) and a test reproduces the throw + leftover clones. 635/635 pass. **Not yet confirmed in After Effects** — the new Tile Test (Diagnostics) is the way to confirm: it runs every tile in After Effects and presses Undo for real.

## First real After Effects report (v0.98.0 → v0.98.1)

The owner ran the Cloner in After Effects 2025: only a null appeared, then "Globe 3D: After Effects error: Unable to call "setValue" because of parameter 1. Value 6 out of range 1 to 3." The mock had accepted any Dropdown Menu Control value; After Effects gives a new one 3 items until `setPropertyParameters`. Fixed in `effects.ensure` (list first) and the grid cleanup (each step guarded). The mock now enforces the 3-item default (`_checkMenu`), which turned 20+ tests red before the fix; `tests/dropdown.menu.test.js` fails on v0.98.0 and passes on v0.98.1. 630/630 pass; undo audit 288 tiles, 0 writes outside an undo group. **Still to confirm in After Effects** (owner's retry + Self-Test).

## Summary

| Layer | How it was tested | Result |
|---|---|---|
| ExtendScript host ops (`extension/host/*.jsx`) | Real .jsx files executed in a Node `vm` against `tests/mock/ae-mock.js` (AE object model mock written from the Scripting Guide) | 266/266 automated tests pass (incl. `tests/kit.test.js` and the rewritten anchor / align tests in `tests/transform.test.js`) |
| ES3 compatibility of host files | `npm run lint:jsx` — parses with acorn `ecmaVersion: 3`, rejects ES5+ runtime APIs | Pass (16 files) — since v0.6.3 also: ES3 reserved words (AST), ASCII-only sources, ES5+ APIs. **Why it matters:** the host tests run the .jsx in Node (V8), which is more permissive than ExtendScript — v0.6.2 and earlier had `final:` as an object key, legal in V8, reserved in ES3 |
| Core (registry, schema, permissions, executor, storage, logger, bridge) | Unit + integration tests | Pass |
| Claude integration | Mocked HTTPS responder: request shape, retries, refusal, truncation, 401, offline, budget; plan-schema size guard | Pass — **no real API call was made** (a mocked API does not compile the schema; that is how the v0.6.3 "grammar too large" error got through — now guarded by a size test, but only a real call proves acceptance) |
| Panel UI | Browser preview (`dev/preview.html`) with the real UI code + real host .jsx on the mock; Playwright clicks through 49 scenarios (wide 900 px and narrow 380/280 px), incl. 19 v0.6 Premium screens; zero page/console errors | Pass — **not the CEP runtime** |
| Colour contrast | `tools/check-contrast.js`, WCAG — 3 themes (dark, midnight, light) × 8 accents, 93 pairs | Pass |
| Windows installer (`dist/MOE-Motion-AI-Setup-0.6.1.exe`) | Run under **Wine 9.0 (64-bit) on Linux**, not real Windows: silent install, legacy cleanup, in-place updates 0.6.0 → 0.6.1 → … → 0.6.4 (one folder, `install.json` version updated, no `.debug`), `/WAITAE` with a fake `AfterFX.exe`, silent uninstall; welcome page rendered under Xvfb | Pass — **real Windows 11 not run yet** |
| UI stability under AE-like load | `npm run stress`: Chromium, host answers in 250 ms, selection changes on every read, mouse resting on tiles, slow 120 ms clicks, pointer 1 px inside a tile edge — Animate, Shapes, Home, Backgrounds | Pass after v0.6.2 (before: swaps in every view, 12–14/20 clicks, 22–24 hover flips). **Not yet confirmed inside AE** — checklist 63–66 |
| Every button (v0.6.5) | `node tools/audit-ui.js`: every button / tab / chip / tile in 19 views + 3 data variants clicked from a known state with real mouse clicks, tiles double-clicked, controls revealed by a click clicked too; layout at 340–900 px — see `docs/UX_AUDIT.md` | 2,495 interactions: 0 JS errors, 0 unreachable or unnamed controls, 0 overflow; 7 bugs found and fixed. **Preview + mock host, not After Effects** |
| Every button (v0.7.0) | Same audit on v0.7.0 (19 views + 3 data variants; revealed controls sampled 3–4 per click) + `tests/workflow.test.js` + browser flow check of every new feature | 2,451 interactions: 0 JS errors, 0 unreachable; failed tool runs 99 → 12 (all host-time conditions with a clear message: no Position keys, no screen colour found, project not saved). Single-file web preview tested in Chromium with and without a no-eval CSP. **Preview + mock host, not After Effects** |
| Every button (v0.8.0) | Same audit incl. the Pie menu (header button → every slice) and workspace tabs + `tests/workflow.test.js` (profile, sets, geometry, keys 1–8, centre, Esc) + browser flow: hold Q / point / release, tap Q, right-hold, Ctrl 1–6 | 2,436 interactions: 0 JS errors; 1 real overlap found and fixed (Inspector under the Apply bar); remaining failures are host-time conditions with clear messages. Pie also checked in the single-file preview under a no-eval CSP. **Preview + mock host, not After Effects** — Q / right-hold inside AE still to confirm (checklist 82–84) |
| Styles + Shakes (v0.59.0) | `tests/stylesshakes.test.js` (5: shake plan — rest at both ends, first peak at 1/2f, decays, Jitter deterministic, frequency clamped; Bump on the mock — every Position key = the layer's own value at that time + the offset, Restore puts it back; Zoom Punch keys Scale + Rotation; styles — one `MOE Style • Soft Shadow` (Drop Shadow) with Distance / Softness by name, updated in place, Glow Radius 60, Restore removes, Light Sweep centre tagged expression reading sourceRectAtTime; 5 shake tiles + 4 style tiles) + mock models Drop Shadow / Glow / CC Light Sweep with AE's parameter names + Playwright (Shake mode, Looks › Styles) + `audit-ui animate looks` + `audit-cut` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass (476). Motion + Looks **498 interactions, 0 errors / dead / failures**. Cut 0, arrange 0, repeat 0, stress stable. **Mock / preview, not After Effects** — parameter names follow After Effects' English UI; Drop Shadow Opacity and Glow Threshold are deliberately not set (stored scale unverified) |
| Workspaces (v0.65.0) | Tab / stage / Motion Control tests updated (`layouts`, `space.content`, `workflow.home`, `motion.control`, `findfast`, `templates`); browser preview: every MOE tab, Bento and Glass at 500 and 360 px, Graph → Timing in MOE and in place in Glass, 0 page errors. The full `audit-ui` could not finish on this machine (one page > 9 min; container restarts), so a lighter click check ran instead: every visible button on the six MOE tabs and Bento / Glass home clicked once from a fresh state — 299 clicks, 0 JS errors, 0 unnamed (Bento home: 105 of 241 controls reached). `audit-repeat` 0 (it found the Motion Bar's Out Expo / Out Back repeated in NOW — fixed), `audit-cut` 0, `audit-arrange` 0 ("Assemble" was cut at 340 px — row label now "Gather"), `npm run stress` pass | 516/516 pass — **preview on the mock, not yet seen in After Effects** |
| Installer redesign (v0.65.1) | Wine 9.0 under Xvfb, pages screenshotted and driven by key presses: update 0.65.0 → 0.65.1 (welcome says *Update 0.65.0 → 0.65.1*, button *Update*), reinstall (*Reinstall*, button *Install*), Arabic locale (right-to-left, Arabic buttons), progress page (one line per step), finish page (*Open After Effects* hidden — no After Effects under Wine); the read-back check stopped a test build whose staged files were another version; silent `/S` update, silent uninstall (Apps entry removed) and fresh silent install all leave one folder with the right version | Pass under Wine — **not run on real Windows; After Effects detection (registry `InstallPath` / default folder) and Open After Effects are untested** |
| After Effects 2026 (v0.65.2) | Wine: `HKCU\Software\Adobe\CSXS.11 / .12 / .13` `PlayerDebugMode` = 1 after install; manifest host range `[25.0,99.9]`, CSXS 12.0 minimum | Pass under Wine — **never run in After Effects 2026**; the panel is still unsigned (a public 26.3 report says an unsigned panel was refused there) |
| Tool Cards (v0.66.0) | `tests/toolcards.test.js` (6): ready / not-ready cards, every registered tool gets a card with an undo line, the card makes no host call, code runs rebuild the code, Live Stagger = the layer's own keys delayed by rank × delay (3 layers × 4 times, keys unmoved), Marker Pulse peak after each marker, fitting groups first, plurals; browser preview of Expressions (list, card, code) and the Motion / Looks / Layout cards at 380 / 520 / 700 px, 0 page errors; `audit-repeat` 0, `audit-cut` 0, `audit-arrange` 0; click check on Expressions 25 controls (of 89 visible — the check stops when a click changes the page), 0 errors; `npm run stress` pass | Pass on the mock — **not run in After Effects**; markers in the mock are a stand-in for AE's marker property |
| Smart Layer (v0.67.0) | `tests/smartlayer.test.js` (6): foresight blocks before writing (your expression untouched) and warns with Replace; keyframe tools warn about a hiding expression; hover card = Inspector card; Layer Reader lists MOE items with read-back numbers, removes one, leaves the other MOE item and your own expression; all 37 presets parse back exactly, an edited one is not guessed; Marker Trigger / In-Out values at 4 / 3 times; beat finder on a 0.5 s pulse train; Beat Markers end to end (Convert Audio to Keyframes mock, markers on the pulses, Restore keeps your marker and removes the amplitude layer); Self-Test `markers` passes on the mock; browser preview: Layer Reader on 4 layers, Remove, hover card, 0 page errors; `audit-repeat` 0, `audit-cut` 0, `audit-arrange` 0, `npm run stress` pass | Pass on the mock — **not run in After Effects** (the Self-Test check `markers` is the proof there) |
| Look & Feel (v0.68.0) | `tests/lookfeel.test.js` (3); browser preview of the Background Composer in MOE / Glass / Bento at 360 and 500 px (pick Aurora → Mesh → Orbit: the stage follows, args keep the style), frosted Glass home, 0 page errors; `audit-repeat` 0, `audit-cut` 0, `audit-arrange` 0; `npm run stress` pass — Backgrounds 20/20 clicks, idle CPU 2 % (was 5 % with 36 animated tiles) | Pass on the mock / preview — **not seen in After Effects** (frost cost in CEP: Appearance › frost off is the switch) |
| Glass restored (v0.68.1) | `css/styles.css` byte-identical to v0.67 (`git diff` empty); `tests/lookfeel.test.js` checks no frost layer remains | Pass |
| Glass with the sidebar (v0.69.0) | `tests/lookfeel.test.js` +1; browser preview: Glass home at 380 / 520 px with the sidebar and its Select menu, NOW spacing; a label-overlap probe inside the Motion Control at 340 / 380 / 440 / 520 / 760 px in Bento, Glass and MOE: 0 overlaps, 0 page errors; `audit-repeat` 0, `audit-cut` 0, `audit-arrange` 0 (it caught Loop Cycle / Ping-Pong split across rows in Glass NOW at 600 px with the sidebar — fixed with an even column count), `npm run stress` pass | Pass on the preview — **not seen in After Effects** |
| Control style (v0.70.0) | `tests/control.test.js` (6): the fourth style, squares per selection, the Mix's args, one Apply on the mock (Pop In keys + wiggle on both layers, each verified), a Mix that stops before replacing your own expression; browser preview of Control with keys / text / 9 shapes at 420 and 640 px (Motion preview plays, sliders, switches, Mix chips + Apply): 0 page errors; `audit-cut` over four styles | Pass on the preview — **not seen in After Effects** |
| Control layout (v0.71.0) | `tests/control.test.js` +1; browser preview before / after at 420 and 640 px (9 shapes), 420 px keys and text, 520 px with the Motion Control open: 0 page errors; `audit-cut`, `audit-arrange`, `audit-repeat` over four styles; `npm run stress` | Pass on the preview — **not seen in After Effects** |
| Control pages (v0.72.0) | `tests/control.test.js` +1 (every square on every page is a registered tool with valid args, picked / default item, fits-page dot); browser preview of the five pages at 420 (text layers) and 640 px (9 shapes), picking a background, the Text page playing the selected text: 0 page errors; `audit-cut`, `audit-arrange`, `audit-repeat`; `npm run stress` | Pass on the preview — **not seen in After Effects** |
| Palettes, Brand, Control everywhere (v0.73.0) | `tests/control.test.js` +1; browser preview: Backgrounds in Bento / Glass / MOE / Control at 440 px, Brand (all three examples, every tab) in Control and Bento, Control library pages (Motion, Looks, Text), Control in the light theme: 0 page errors; contrast 108/108; `audit-cut`, `audit-arrange`, `audit-repeat`; `npm run stress` | Pass on the preview — **not seen in After Effects**; the example fonts are Windows' own — whether each is installed is checked only on the user's machine |
| Control comes alive (v0.74.0) | `tests/control.test.js` +1 (wiggle targets map to real presets, numbers kept without switches, My mixes save / load / forget); browser preview: the Move hero draws 5 distinct frames in 2.8 s in Calm, the Text hero changes between frames, Esc empties the Mix, ☆ saves a mix: 0 page errors; `audit-cut`, `audit-arrange`, `audit-repeat`; `npm run stress` | Pass on the preview — **not seen in After Effects** (CEP's frame rate for these animations is unmeasured) |
| Click VFX + controllers + bundled previews (v0.98.0) | `tests/click.vfx.test.js` (4): 4 Click VFX styles one real undo step each, controller with only its controls (≤ 4) linked, Restore clean, plan values (grow / fade / Mosaic 48 × 27 / scatter 0 → 160); Matte FX: one controller per run with only the style's controls, Softness linked into the Matte pre-comp; every bundled preview's signature matches its tile and its file exists (110). Full suite 627 / 627 on the mock. Self-Test `clickFx`. **Not run in After Effects**; the previews are MOE's renderer (an approximation), looked at in the web preview here. |
| Reveal Composer (v0.97.0) | `tests/matte.fx.test.js` (+1): every shape × material hidden → shown; point field from the chosen point clears the farthest corner; Intensity scales noise + warp; Shuffle keeps locks, deterministic; Pixel Rain on the mock sets Noise Type 1 / Fractal Type 11 / Brightness −35 / Uniform Scaling 0 + Scale Width / Height / Posterize Time 12, all by name. Self-Test `fxMatte` includes Pixel Rain. **Not run in After Effects: the menu values come from the studied project file, not from this After Effects.** |
| Matte FX + Rendered previews (v0.96.0) | `tests/matte.fx.test.js` (5): every effect hidden → shown (and Out reversed) by Gradient Wipe's rule; the three pre-comps, alpha + luma mattes, parents, hidden layers, Gradient Wipe reading the Map, Completion 100 → 0, Difference edge; one Ctrl+Z; Restore removes layers and pre-comps; refusals; the renderer: one comp per tile, JPEG sequence, nothing left, the user's queue kept, cached until args change; host refuses other comps / names. Self-Test `fxMatte`, `renderPreview` pass on the mock. **Not run in After Effects: effect parameter names, the Render Queue's JPEG output and file:// frames in CEP are unverified.** |
| Matte Reveal (v0.95.0) | `tests/matte.reveal.test.js` (5): every style × 3 option sets, In and Out, coverage 0 → 100 % (Card ≥ 97 %); directions and cascade; on the mock one undo step, alpha matte = the MOE matte, parented, hidden, right above, keys = plan, Restore one step; the user's own matte and 3D layers skipped, a MOE matte replaced, nothing usable = nothing written; `layers.rects` is no undo step. Self-Test `matte` passes on the mock. **Not run in After Effects; the mock does not render a matte** — whether the picture shows through is unverified. |
| One Ctrl+Z (v0.94.0) | `tests/oneundo.test.js` (4): a template is one layer in its own comp at the playhead, undo steps `MOE: Measure Text` + one; re-apply and Restore one step each; the own comp equals the layers build at settled times; `tx.run` safety (no other comp writable, unknown op refused first, failing step named, refs, PLAN_NOT_COMMITTED, MOE comps only). The harness closes every group after a call like AE; `tools/audit-undo.js`: 226 tiles, 210 one real step, 16 two (Grid Build), 0 writes without a group. Full suite 611 / 611 on the mock. **Not run in After Effects** — the undo behaviour itself is the Scripting Guide's documented one; it needs a Ctrl+Z check in AE. |
| Controls on demand, part 2 (v0.93.0) | `tests/grid.controls.demand.test.js` (4): a lean grid (8 controls) equals a full one (46) item by item for plain / animated / radial / random-order grids at 3 times; Grid Controls adds a missing control and restores exactly; Grid Sliders adds groups with the built values, nothing moves; Layout switched in Effect Controls on a lean grid equals a full grid; effectors / tracer work on it. Proximity: 8 of 13 for five reactions. **Mock only**; the longer expressions' cost in After Effects is not measured. |
| Effector on Property (v0.92.0) | `tests/effector.property.test.js` (5): the six-term maths; a slider on 9 items = 10 + the reference's custom term at 5 times; Step 0 … 80; refusals write nothing; upgrade keeps it current; Restore exact. **Mock only** — wiring a deep shape property (Trim Paths) on real shape layers is not exercised anywhere. |
| Tracer (v0.91.0) | `tests/tracer.test.js` (4): the plan; on a mock grid in 5 kinds every path point = its item's comp position at 3 times under a Wave effector; replace / closed / refusals; link ids. **Mock only** — `createPath` exists in the mock because After Effects documents it; its behaviour and speed in After Effects are not verified. |
| Remove / Freeze Effector (v0.90.0) | `tests/effector.remove.test.js` (3): removing one of two effectors leaves the items equal to a grid that only had the other; Freeze removes 6 keys, holds the frame, Restore is exact. The mock's Layer Control now follows its layer (as AE does) — 594 tests pass with it. **Mock only.** |
| Falloff curve, move modes (v0.89.0) | `tests/falloff.move.test.js` (5) + 2 cases in `clone.colour`: curves; attract / repel distances exact, stops at the null; absolute on the null + offset; Random + sweep = reference. **Mock only**; `G.fromComp` on a transformed grid null is not exercised by the mock tests and not run in After Effects. |
| Wave, Snap To, Clamp (v0.88.0) | `tests/wave.snap.clamp.test.js` (5): wave shapes; Snap / Clamp maths; every shape's expressions = reference at 5 times and periodic; Snap lands on steps; Clamp holds through a spring overshoot (1.6 limit vs > 1.8 free); groups added later move nothing. **Mock only.** A Self-Test check *Wave + Clamp* exists and has not been run in After Effects. |
| Controls on demand (v0.87.0) | `tests/controls.demand.test.js` (5): `needed()` per setting; a lean effector vs all 24 controls item by item; Effector Controls adds only what is missing and restores exactly; a v3 grid is rewritten as v4 and restored; quick expressions with and without sliders. All earlier effector suites (spring, target, audio, field, colour) pass against lean effectors. **Mock only — not run in After Effects**; the Self-Test's effector checks read missing controls as defaults but have not been re-run in AE. |
| Assistant window (v0.86.0) | Pictures in Bento / Glass (light) / Control at 420 and 340 px: empty state on both tabs and after an offline answer; 0 JS errors; `audit-size`, `audit-overlay`, `audit-cut`, stress. The Claude path (online answer, *Claude* pill) was not exercised — no key in the preview. The long click-every-button audit (`audit-ui`) was started for 0.85 and stopped unfinished after about 2 hours. **Chromium preview only.** |
| Assistant mark (v0.85.0) | Pictures of the button in 4 styles × dark / light; measured: the last row ends above the button after scrolling to the end in all 8; a click at the button's centre reaches it; `audit-overlay` includes the button's body. **Chromium preview only — not seen in After Effects.** |
| Glass nav and sizes (v0.84.0) | `tools/audit-size.js`: 192 screens, 0 texts under 10 px, 0 controls under 24 px in all four styles (no waiting list). `audit-cut`, `audit-overlay`, stress. Nav pictures in dark and light. **Chromium preview only.** |
| Glass menus (v0.83.0) | `tools/audit-overlay.js`: 64 floating surfaces (4 styles × 2 themes × search, sidebar menu, panel menu, tool options, more quick actions, sheet, dialog, toast, assistant) — 0 see-through (Glass was 7 % on five of them). Pictures before / after in dark, light checked after the fade-in. Not opened by the audit: the pie, the hover card (both live outside the Glass page and use the theme's solid tokens), Brand's New menu, the narrow floating sidebar (covered by the same rule, not probed). **Chromium preview only.** |
| Easier to hit (v0.82.0) | `tools/audit-size.js` on 192 screens: 0 texts under 10 px, 0 kinds of control under 24 px in Bento / MOE / Control (was 19), Glass: 9 kinds + 9 px key hints waiting for the owner. Real hit probes in the preview (1.5 px outside a segment, chip, switch, ★). `audit-cut`, `audit-arrange`, `audit-repeat` with every Bento stage open. **Chromium preview only.** |
| Layout plan (v0.81.0) | `tests/control.test.js` +2 (fold default + explicit choice wins, Place hidden for keys in Bento / Control only, Control's six key jobs are Keyframes & Loops refs, one set of names, kits on the Quick Bar and dropped when gone); 3 tests updated for the names (Glass's labels asserted unchanged). Browser preview: Bento Home 5 070 → 1 002 px, Anchor · Align toggles, Bento library opens on tiles, Control with keys shows six key jobs and uncut Libraries, Glass before / after pictures (proposal only). **Not run in After Effects.** |
| Scene Check (v0.80.0) | `tests/scene.test.js` (5: suggest with reasons, timeline fractions, every finding with what was read, scenes order + escaped page, on the mock: read opens no undo group and counts every layer, measure leaves no layer and measures per scene); Self-Test `scene` check on the mock. Browser preview in Bento 740 and Control 420: Read → 5 rows / 3 spans → Measure → 4 frames / 20 boxes, layer count unchanged → page saved. **Not run in After Effects.** |
| Drag engine (v0.79.1) | `tests/smartcontrols.test.js` +4 (bar: range over its own size, Ctrl / Shift, click sets, double-click resets, inner button and number keep their clicks, lost mouse-up and blur commit, Esc cancels, the number rebuilt by a render is the one dragged, guard). Browser preview with real mouse moves: the three Control bars (bar, number, click, full travel, Esc, release-with-no-button, Ctrl, double-click, typing, switch inside the bar), four drags in a row, the Inspector number, the Tune strip. **Not tried in After Effects' own panel.** |
| Tune after (v0.79.0) | `tests/tuneafter.test.js` (6: scale on the grid with speed ÷ factor, place + Position delta, tunables / variations valid for the tool, Retime on the mock read back + restore, Copy → Paste Motion with B moving 200 px from its own place + restore + junk clips refused, Tune = one tx for restore + run and only for its selection); `tests/selftest.test.js` (every check has a status; the Retime check passes on the mock). Browser preview: Pop In → strip → Faster → Duration 1.2. **Not run in After Effects.** |
| Recipes everywhere (v0.78.0) | `tests/control.test.js` +1 (Reel Pop with nothing selected writes nothing — no tx, no guides; `after` steps never block; the ref resolves, is ready by the precheck and runs; on the Quick Bar and dropped when removed; export → import on a second store, duplicates / junk / foreign tools refused). **Not run in After Effects.** |
| Your own recipes (v0.77.0) | `tests/control.test.js` +1 (makeRecipe limits and naming, the click flow picks instead of running, saved per kit, runs as one chain, a chain with a missing tool is hidden, remove, ready-now follows the selection); the 14 built-in recipes run on the mock (Word Cascade and Pulse on the Beat stop before writing when their need is missing). **Not run in After Effects.** |
| Smart Kits (v0.76.0) | `tests/control.test.js` +1 (recipes use only their kit's tools, all 11 run on the mock — Word Cascade stops before writing on a non-text layer, one tx.begin / tx.end per recipe, steps ticked, pure progress); browser preview: recipes clicked in SaaS / Glass / Social, the Home strip in Bento / Glass / MOE / Control. **Not run in After Effects.** |
| Style Kits & Signature (v0.75.0) | `tests/control.test.js` +2 (tx.begin / tx.end once for a two-run Mix on the mock, nested batch, kits refs, 16 Signature looks valid + moving, MOE Motion samples, brand ease → Smart Ease args); browser preview: liquid slider while dragging, Style Kits (all + SaaS + Glass), Brand › Motion curve on hover, Backgrounds with Signature: 0 page errors; `audit-cut` (now with Style Kits: 184 screens, 0 cut after shortening the kits link description), `audit-arrange`, `audit-repeat`; `npm run stress` | Pass on the preview and the mock — **not seen in After Effects**: one undo group across runs relies on `app.beginUndoGroup` staying open between `evalScript` calls, as Engine 2's runs already do |
| Apple Motion (v0.58.0) | `tests/applemotion.test.js` (4: Blur In on the mock — a MOE Blur per layer, Repeat Edge Pixels 1, Blurriness keys at the plan's times with values 40 → 0, a second run reuses the effect, Restore removes keys + effect; Blur 0 adds nothing; out plan 0 → 30; previews call PLAN.blur; seven Native curves storable 0 → 1, springs overshoot, Anticipate winds up; six Hero text presets Arabic-safe with blur; seven Blur tiles) + Playwright (Blur In preview blurred mid-entrance, Blur 40 px in the Inspector) + `audit-ui animate text` + `audit-cut` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass (471). Motion 295 + Text 152 = 447 interactions, 0 errors, 0 tool failures; 1 dead click = *Import .ffx presets* (opens a file picker the preview cannot show, as noted in UX_AUDIT). Cut 132 screens 0, arrange 0, repeat 0, stress stable. **Mock / preview, not After Effects** — Gaussian Blur's Blurriness name is After Effects' documented English name; the AE Self-Test does not cover blur yet |
| Product UI (v0.57.0) | `tests/productui.test.js` (5: all eight pieces build with every planned part in one null and every text above every shape (timeline order); the stacking fix on Tag + End Card; toggle knob slides right + track 0 → 100, button presses < 96 % and returns, ripple invisible until the click, progress fill keyed, task dims to 55 %, typing dots bounce; Light / Dark card colours; the brand replaces the kit blue, a chosen colour stays; 12 tiles on the Design tab + stage, settings only where they apply) + templates tests scoped to the eight originals + Playwright (the page; big previews mid-action) + `audit-ui productui` + `audit-cut` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass (467). Product UI 107 interactions, 0 errors / dead / failures. Cut 132 screens 0, arrange 0, repeat 0, stress stable. **Found while building:** template texts could sit under their own shapes in After Effects (new layers go on top) — the mock modelled it, no test read it; fixed + tested. **Mock / preview, not After Effects** |
| Smart controls (v0.56.0) | `tests/smartcontrols.test.js` (4, jsdom: drag ±step / Shift ×10 / Ctrl fine / clamp / one commit; a click focuses; Esc restores with no commit; ↑ ↓ live + one commit after the burst; wheel ignored unless focused; Inspector numbers scrubbable; slider double-click → default) + Playwright (Templates Inspector Duration 0.7 → drag 2.7 → double-click 0.7; 0 JS errors) + `audit-ui zoom` + `audit-cut` + `audit-arrange` + `npm run stress` | All pass (462). Zoom 109 interactions, 0 errors / dead; 8 expected refusals (*Cursor*: the test layer has no Position keys — it says so). Cut 0, arrange 0, stress stable. **Preview, not After Effects** — CEP's Chromium 99 supports pointer capture |
| Hidden sliders (v0.55.0) | `tests/nocut.test.js` (+1: scrub on pointerdown, Shift ×10 / Ctrl fine, a click focuses, influence 1–99 %, speed ≥ 0, ew-resize cursor) + Playwright (drag Out influence 33 → 53 % live, accent bar shown, release applied *Curve on 7 keyframes*; a click on In speed focuses it for typing; 0 JS errors) + `audit-ui kit` + `audit-cut` + `npm run stress` | All pass (457). Motion Kit 119 interactions, 0 errors / dead; 1 expected refusal (*Bake*: no MOE rig in the test comp, it says so). Cut names 0, stress stable. **Preview, not After Effects** |
| Sidebar toggle (v0.54.1) | `tests/nocut.test.js` (narrow dock + toggle → floats over the page; with room never floats) + Playwright at 420 px (toggle opens 172 px over the page, the page stays at x 61; a click on the speed graph closes it; a shortcut closes it; 0 JS errors) + `audit-cut` + `npm run stress` | All pass (456). Found while testing: the speed graph cancels mouse events, so the outside click now listens to `pointerdown`. Cut names 0. Stress stable. **Preview, not After Effects** |
| No cut names (v0.54.0) | `node tools/audit-cut.js` (new: 21 pages × Bento / Glass / MOE × 420 / 740 px = 126 screens, MOE sidebar wide with all 74 Quick Bar actions) + `tests/nocut.test.js` (2: sidebar wide only with ≥ 600 px, icons on a narrow dock, choice kept; every name rule is a two-line wrap; segmented / action bar wrap) + Playwright screenshots (MOE 420 / 740, Bento 420 Settings / Layout) + `audit-ui settings deliver` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass (456 tests). Cut texts **155 → 0 cut names** (22 shortened descriptions, all with their full text in a tooltip), 0 JS errors. Settings + Deliver 127 interactions, 0 errors / dead. Arrange 72 screens 0, repeat 0, stress stable. **Preview, not After Effects** — CEP's Chromium 99 supports the same line clamp |
| Guides menu + anchor pad (v0.53.0) | `tests/guides.test.js` (5: Centre / Golden / TV Safe positions read back from the mock comp; TikTok at 1080 × 1920, Reels box, Shorts scaled to 540 × 960, the not-9:16 note, Stories without side guides; pressed twice adds 0 (`skipSame`), Clear leaves 0, Restore brings back 8; the Guides menu rows and every button in Comp › Guides; every icon name the UI uses exists — it found only `link`, the empty Parent icon) + Playwright (MOE sidebar: Parent & Link icon shown, Guides menu open with 11 icons; anchor pad hover; Layout › Guides tiles; every guide tile built 3×, 0 errors) + `audit-ui layout` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass (454 tests). Layout page **335 interactions, 0 errors / dead / failures** (2 skipped: controls of another state, as before). Arrange 72 screens 0 (a cut *Title / Action* at 340 px → *TV Safe*; the Guides family split per row). Repeat 0. Stress stable. Social safe-zone margins are approximate published figures, not measured in the apps. Guides are not in the AE Self-Test (layer-based). **Mock / preview, not After Effects** |
| Auto-fit Templates (v0.52.0) | `tests/templates.test.js` (12: a long Title Card title measures ≤ its safe width on the mock with a smaller font, ≥ 40 % of the design size, listed as *Fitted to the safe area*; the underline follows the fitted width; a short title keeps 120 px; a long Arabic quote fits and the quote mark keeps 220 px; `fitSize` cases; `thumbs.js` uses the same formula) + Playwright (a 63-character title typed in the Inspector: the big preview shows it inside the frame, underline under it) + `audit-ui templates` + `npm run stress` | All pass (449 tests). Templates page **108 interactions, 0 errors / dead / failures**. Stress stable. Wine install 0.52.0. The mock's text width is an estimate (0.55 × size per Latin letter); After Effects' real measurement drives the fit in AE. **Mock / preview, not After Effects** |
| Branded Templates (v0.51.0) | `tests/templates.test.js` (11: `brandOpts` — primary as accent, the best-contrast word colour (≥ 4.5), font by script, no colours → none; built on the mock with Nile & Co. active — pill fill = primary, word fill = best colour, font Montserrat-Bold, summary names the brand; own accent wins; *Use the brand* off; previews use `withBrand`) + Playwright (Nile & Co. active: every tile in Nile Green, Build toast “· Nile & Co. brand”) + `audit-ui templates` + `npm run stress` | All pass. Templates page **108 interactions, 0 errors / dead / failures (55 builds)**. Stress 20/20. Wine install 0.51.0. The preview cannot show the brand's font (After Effects uses it). **Mock / preview, not After Effects** |
| More Templates + Exit (v0.50.0) | `tests/templates.test.js` (9: all 8 templates placed by the plan with sizes measured in the comp; Hold writes entrance + exit keys = the plan, the exit after the hold, ending where it started, Hold 0 = no exit; Arabic quote mirrored with its own mark, End Card button fits its word, handle pill holds the name in the bottom corner, chapter number) + Playwright (12 tiles sampled 6 s: 0 % empty frames after capping a tile's hold at 1 s) + `audit-ui templates` + `home@bento` + `npm run stress` | All pass. Templates page **107 interactions, 0 errors / dead / failures (55 templates built)**; Bento 531, 0 JS errors (16 builds). Stress 20/20. Wine install 0.50.0. **Mock / preview, not After Effects** |
| Native Templates (v0.49.0) | `tests/templates.test.js` (7: every template's layers named + parented to one null, each part where `templates.layout` puts it with the sizes measured in the comp; pill / underline sized to the measured text; entrance keys = the plan at the playhead in the null's space, leader Trim End 0 → 100; Arabic RTL on both lines + mirrored layout, English LTR; numbering, Restore only its own, user layer untouched, bad colour refused with nothing changed; previews and placement; the assistant-button overlap fix) + Self-Test `template` / `templateArabic` on the mock + Playwright (live preview follows typed title / accent; Build makes 4 layers) + `audit-ui templates animate` + `home@bento` + `audit-arrange` + `audit-repeat` + `npm run stress` | All pass; Self-Test 0 px from the plan, undo removes it. First Templates audit: **6 Build clicks covered by the assistant button** (short page: the sticky bar is not at the bottom, the lifted button landed on it) → the bar keeps the button's corner free → re-audit Templates 72 + Animate 262: **0 errors, 0 dead, 0 failures** (30 templates built). Bento 527 interactions, 0 JS errors (12 template builds). Arrange 68 screens 0, repeat 0. Stress 20/20. Wine install 0.49.0. Text widths in the preview are the browser's; in AE the template uses AE's own (`sourceRectAtTime`). **Mock / preview, not After Effects** |
| Combined Moves (v0.48.0) | `tests/combined.test.js` (3: each of the 12 presets on the mock — Opacity and Scale / Rotation keys = the plan, Position keys share the fade's timing, move the stated distance and keep the rest pose, Restore removes the fade keys too; From / to + Angle maths and v0.47 Pop / Spin unchanged; unique names, In / Out badges, previews from the plan) + Playwright (form shows Also fade / From / to; first label *Scale at the far end* was cut → renamed) + `node tools/audit-ui.js animate` + `npm run stress` | Keys = plan for all 12. Animate page **262 interactions, 0 JS errors** (the new tiles 78 times, no failures); the same *Pin to Favorites* re-render note as v0.47 (clicks land). Stress 20/20. Wine install 0.48.0. **Mock / preview, not After Effects** |
| Real Previews (v0.47.0) | `tests/realpreview.test.js` (4: Quick Animate on the mock writes exactly the plan — times, values, out / in influence of every key — for fade, pop + overshoot and spin with Snappy / Smooth / Gentle / Expo; Trim Paths writes the plan in all four modes; `valueAt` holds ends, passes the overshoot key, linear stays linear, monotone between eased keys; tools and tiles use the plan) + Playwright frames of the Animate page and the Inspector (data follows Duration / Ease / Overshoot, key strip drawn) + `node tools/audit-ui.js animate` + `npm run stress` | Keys = plan in every case. Animate page: **204 interactions, 0 JS errors**; one click (*Pin to Favorites*) reported “covered” by its own icon during a re-render — reproduced by hand: the click lands and pins. Stress 20/20 (animate, shapes, home, backgrounds, kit). Wine install 0.47.0. The mock interpolates linearly, so the ease *playback* is the tested `bezier.fromTemporal` mapping, not a mock read-back. **Mock / preview, not After Effects** |
| Select Modifiers + Sidebar Menus (v0.46.0) | `tests/selectmods.test.js` (4: exactly the 12 filters carry Shift / Alt; `withMods`; on the mock Shift adds, Alt removes, plain replaces, Same Label + Shift, Back; every renderer passes its click) + `tests/norepeat.test.js` sidebar-menu rule (≤ 5 menus, one job, 2–5 labelled rows, families side by side, every button also in a tab, no tab names) + Playwright in Bento / Glass / MOE, the MOE menu and the sidebar (selection read back from the mock) + each new menu opened from the Design tab and a button run + `node tools/audit-arrange.js` + `audit-repeat` + `audit-ui home@moe` / `home@bento` + `npm run stress` ×2 | Shift / Alt: every case matched the expected selection, 0 JS errors; first placement of the hint in the group header cut the name to “S..” at 340 px → moved under the rows. Arrange **68 screens** (the 3 new menus × 4 widths) all 0; repeat 0. Buttons: MOE **332** interactions (the new menus included), Bento **514** — **0 JS errors**; refusals with their reason only. Stress 20/20 ×2. Wine install 0.46.0. F4 does not repeat selections (by design since v0.7: it repeats changes). **Mock / preview, not After Effects** |
| No Repeats (v0.45.0) | `tests/norepeat.test.js` (5: the sidebar has only Select and every button of the 9 removed menus is still reachable; NOW never repeats Search / Assistant / the Motion Control, open and folded; same job = same tool and values; Glass NOW skips what the open groups show; whole tile keys) + `node tools/audit-repeat.js` at 340 / 420 / 900 (84 screens each: Bento, every Glass space, every MOE tab × 7 kinds of selection) + `node tools/audit-arrange.js` + `node tools/audit-ui.js home@moe` + `home@bento` + `home@glass` + `npm run stress` (×3) + `LAYOUT=glass` | Repeat audit on v0.44: **44** repeats on one screen → v0.45: **0** at all three widths (32 Bento NOW-vs-group, info). It found the library tile keys cut (`t-eIn` for Fade In / Rise In / Cascade In) → fixed. Arrange: 56 screens (28 fewer: the removed menus), **0 family · 0 group · 0 hole · 0 cut · 0 JS errors**. Buttons: MOE 298 interactions (v0.44: 390 — the removed menus), Bento 514, Glass 363 — **0 JS errors**; refusals with their reason only (fixture layers with own expressions, no source, locked BG, no pre-comp); Glass counted 1 click blocked by a toast on top. Stress 20/20 ×3, Glass 20/20; `LAYOUT=moe` still cannot run its Home check (known since v0.43). Wine install 0.45.0. **Mock / preview, not After Effects** |
| Find Fast (v0.44.0) | `tests/findfast.test.js` (8: Select buttons on the mock — type, footage, cameras & lights, same label, invert, all, none, Back, refusals; placement; Arabic-safe text rows; nothing important buried; no shared names; Ctrl+K in English and Arabic; failure messages; text buttons with the preset duration) + `node tools/audit-arrange.js` (84 screens incl. the MOE Select menu) + `node tools/audit-ui.js home@bento` + `home@moe` + a Playwright run of all 9 text buttons on English + Arabic text + `npm run stress` (×5 after the fix) | Arrange: first runs found 28 cut labels in the new MOE Select menu → it now shows the group's labelled rows → **0 family · 0 group · 0 hole · 0 cut · 0 JS errors**. Bento: 522 interactions, **0 JS errors** — it found the 8 text buttons refused (*Duration must be ≥ 0.1*: the tool's own default) and *Flip Horizontal: failed* with no reason → both fixed; text buttons then animated 2 layers (EN + AR) each, Remove removed 4 animators. MOE: 390 interactions, **0 JS errors** (the dev server stopped once at its 2-hour limit; the run was redone). Stress: Home failed 4/20 and 5/20 in two runs → cause: *Your grid*'s late smooth scroll after Build Grid → fixed → **20/20 in 5 runs**, Glass 20/20. `LAYOUT=moe npm run stress` cannot run its Home check (the MOE Home sometimes shows only 4 targets under selection churn — same on v0.43; a test limitation). Wine install 0.44.0. **Mock / preview, not After Effects** |
| Smart Arrange (v0.43.0) | `node tools/audit-arrange.js` (new: Bento, every Glass space, every MOE tab and menu, the Motion Kit × 340 / 420 / 600 / 900 px = 80 screens, every group opened; rules family / group / hole / cut) + `node tools/audit-ui.js home@bento` + `node tools/audit-ui.js home@moe` + `npm run stress` + `tests/arrange.test.js` (5: engine incl. `pack` on 400 random lists; every button list of the UI data keeps families together and in one tier; opposites whole; Bento without dense flow) | Arrange audit, first run: 26 split families (Loop in Glass's NOW strip and the labelled Loop row) + 34 cut labels (MOE menus at 340 / 420, "Look from Words") → fixed → **0 family · 0 group · 0 hole · 0 cut · 0 JS errors**. Bento: 477 interactions, **0 JS errors**, both Flip halves run ("Flipped 4 layer(s)"); no-effect clicks only on already-active buttons and *Refresh selection*. MOE: 372 interactions, **0 JS errors**; no-effect clicks = *Refresh selection* and the background of three menu panels (not controls); failures are host-time conditions with messages (a repeated *Bake keys* keeps the same toast on screen). Stress: Home first failed (5/20) — found two real movements: the *Next* row came and went above the NOW tiles (fixed: one fixed-height line below them) and Build Grid's one-time scroll to its panel happened mid-click (the stress test now waits for a scroll to finish, as a person does) → **20/20 on every view, Bento and Glass**. Wine install 0.43.0. **Preview (Chromium), not After Effects** — CEP 12 is Chromium 99 and every CSS rule used works there |
| Every button (v0.42.0) | `node tools/audit-ui.js kit` (Motion Kit with *Bake* in Clean up) + `node tools/audit-ui.js home@tkeys` (Keys tab with *Bake keys*) + the full `home` audit stopped at 300 clicks (it had already clicked *Bake keys*) + `npm run stress` + `tests/bake.test.js` (7: plan maths; a swept, coloured 6-item grid baked from its null = the live rig at every frame (≤ 0.005, colour ≤ 0.0005), smart keys < half the samples, restore = the same expressions; one key per sample every 2 frames; a trail baked from its null, keys under the copies restored, source untouched; MOE rigs vs every expression; refusals before any change; UI + Arabic words) + `tests/selftest.test.js` (the bake check passes on the mock, 16 checks) | Kit: 119 interactions, **0 JS errors**, 1 no-effect click (*All*, already active). Keys tab: 476 interactions, **0 JS errors**; 22 tool failures, all host-time conditions with a clear message (e.g. *Bake keys* with no MOE rig selected: "No MOE expressions on the selection"); no-effect clicks only on already-active buttons and *Refresh selection*. Home (partial): 300 interactions, 0 JS errors. Stress 20/20. A Spring grid in the mock: 434 keys for 1,440 samples, worst 0.0013 from the live rig. Wine install 0.42.0. **Mock / preview, not After Effects** — the Self-Test's bake check covers it in AE; the owner's AE report is still pending |
| Every button (v0.41.0) | `node tools/audit-ui.js layout` (Clone mode with Echo / Ghost / Spin Trail and their Inspectors) + `node tools/audit-ui.js diagnostics` (the self-test, now 15 checks, run from Start) + `npm run stress` + `tests/clone.trail.test.js` (4: a 5-copy trail on a keyframed layer = `trail.js` at 4 times for position / scale / rotation / opacity, live Delay, restore; parented source follows its comp point; refusals; tiles) + `tests/selftest.test.js` (the trail check passes on the mock) | Layout: 293 interactions, **0 JS errors**, 0 dead, 1 covered click (*Pin*, as before). Diagnostics: 6, 0 errors. Stress 20/20. Wine install 0.41.0. **Mock / preview, not After Effects** — the Self-Test's trail check covers it in AE; the owner's AE report is still pending |
| Every button + Self-Test (v0.40.0) | `node tools/audit-ui.js diagnostics` (Check in After Effects → Start ran the whole self-test in the preview) + `node tools/audit-ui.js layout` (re-run for v0.39's Sweep / Reset fix) + a Playwright run of the self-test from Diagnostics + `npm run stress` + `tests/selftest.test.js` (4: all 14 checks on the mock, user comp untouched, test comp + project items cleaned; an injected `applyAt` fault fails the effector check (~10 %); a failing tool fails only its check; the card) | Diagnostics: 6 interactions, **0 JS errors**, 0 dead (Start ran `selftest.begin` … `selftest.end`). Layout: 293 interactions, **0 JS errors**, **0 dead** (the v0.39 Sweep / Reset fix holds), 1 covered click (*Pin*, as before). Self-test in the preview: 13 pass, 1 info (speed), test comp removed, user comp active again. Fixed during testing: the status badges were hidden (class name shared with library tiles). Stress 20/20. Wine install 0.40.0. **Mock / preview only — the self-test exists to be run by the owner in After Effects 2025; no AE results yet** |
| Every button (v0.39.0) | `node tools/audit-ui.js layout` alone (every Effector Inspector with the Live Preview, its Sweep / Reset / Use my grid, the Grid Builder preview for Points / In Place) + a targeted Playwright run (drag the null, Sweep, Reset, Use my grid on a built radial grid) + `npm run stress` + `tests/cloner.preview.test.js` (4: still null = `effectors.applyAt` for 4 falloffs / types, a jump overshoots and settles, Inertia trails, bounded history, sweep / grab, own-grid sizing, wiring) | Audit: 274 interactions, **0 JS errors**, 0 error toasts, 1 covered click (*Pin*, as before); it found **2 dead clicks** (Sweep, Reset changed only the canvas) → fixed: the preview label and Sweep (on / off) now show the null's state, Reset is disabled at rest; the targeted run then saw every state change, 0 JS errors (full audit re-run with v0.40). Also fixed during testing: a click slid the null instead of jumping; *Use my grid* read positions before expressions (now `props.values`). Stress 20/20. Wine install 0.39.0. **Preview + mock host, not After Effects** |
| Every button (v0.38.0) | `node tools/audit-ui.js layout` alone (Effectors mode with Noise Grow / Noise Flicker / Image Grow / Image Reveal and their Inspectors with Field speed / Field layer) + screenshots at 420 px + `npm run stress` + `tests/field.effector.test.js` (4: Noise Field mock = `effectors.js` at three times, drift with a still null, hard edge at Softness 0; Image field from a gradient layer picked from the selection = reference, brighter → bigger, Clone Colour tint follows the brightness, restore keeps the map; no layer → refused; tiles) | 281 interactions: **0 JS errors**, 0 error toasts, 0 dead. 1 covered click: *Pin* (as in v0.32–0.37); 17 *Your grid* controls not found after an earlier click changed the selection. Stress 20/20. Wine install 0.38.0. **Preview + mock host, not After Effects** — the mock's sampleImage reads a procedural pixel function; sampleImage speed on big grids / video and Spring + Image are unverified |
| Every button (v0.37.0) | `node tools/audit-ui.js layout` alone (Clone mode with Clone on Points / Text Cloner / Letters Rise and their Inspectors, Split text field) + screenshots at 420 px + `npm run stress` + `tests/object.text.cloner.test.js` (6: Points = `layouts.place` incl. facing, Point Offset live, restore, refusals; Text Cloner words centred on 2 lines and Arabic RTL right-justified at 50 % — every piece's comp box = its word in the original, In Place read-back by comp boxes; Letters Rise + a sweeping effector; keyed text refused; tiles) | 275 interactions: **0 JS errors**, 0 error toasts, 0 dead. 1 covered click: *Pin* (as in v0.32–0.36); 15 *Your grid* controls not found after an earlier click changed the selection. Stress 20/20. Wine install 0.37.0. Found and fixed during testing: an In Place grid moved the whole text by the null's position (setParentWithJump keeps values) — the null is now anchored on its position and the read-back compares comp boxes. **Preview + mock host (simple text metric), not After Effects** — real glyph bounds, kerning across words, mixed styles and a rotated source are unverified |
| Every button (v0.36.0) | `node tools/audit-ui.js layout` alone (Effectors mode with Aim / Look Near / Beat Pulse / Beat Wave and their Inspectors) + screenshots at 420 px + `npm run stress` + `tests/target.audio.test.js` (5: Target aims mock = `effectors.js` at 4 times with the +X axis on the effector, Target + Spring swings and settles, Audio through a mocked Convert Audio to Keyframes — one `MOE Audio · <layer>` at the bottom, Audio Max = loudest frame, scale = reference with per-item delay, reuse, restore; no sound → refused) | 261 interactions: **0 JS errors**, 0 error toasts, 0 dead. 1 covered click: *Pin* (as in v0.32–0.35); 16 *Your grid* controls not found after an earlier click changed the selection. Stress 20/20. Wine install 0.36.0 (below). **Preview + mock host, not After Effects** — Convert Audio to Keyframes is mocked: its real menu name, where AE adds the layer and speed on long tracks are unverified |
| Every button (v0.35.0) | `node tools/audit-ui.js layout` alone (Effectors mode with Spring Grow / Jelly / Inertia / Bounce Up and their Inspectors with Spring, Frequency, Decay) + screenshots at 420 px + `npm run stress` + `tests/spring.effector.test.js` (5: step response, bounded window ≤ 60 samples / 3 s, mock-evaluated items = `effectors.js applyAt` at 7 times on a sweep, overshoot past the direct result and swing past the rest, Inertia never overshoots, effectors without Spring controls unchanged, tiles) | 258 interactions: **0 JS errors**, 0 error toasts, 0 dead. 1 covered click: *Pin* while the inline Inspector moved rows (as in v0.32–0.34). Stress 20/20. Wine install 0.35.0 OK. **Preview + mock host (2D), not After Effects** — the speed of the spring expression on big grids and `toComp` / `fromComp` with a time argument are unverified in AE |
| Every button (v0.34.0) | `node tools/audit-ui.js layout` alone (Clone mode with Colour Cycle / Gradient / Random, Effectors with Shrink and Tint, their Inspectors) + screenshots at 420 px + `npm run stress` + `tests/clone.colour.test.js` (4: Fill colours mock-evaluated = `effectors.js` for every mode, live palette change, soft sphere and linear tint at three times, update in place, restore) | 250 interactions: **0 JS errors**, 0 error toasts. 1 covered click: *Pin* while the inline Inspector moved rows (as in v0.32–0.33, not reproducible). **Preview + mock host (2D), not After Effects** |
| Every button (v0.33.0) | `node tools/audit-ui.js layout home@moe` alone (Layout & Grid with Clone / Effectors modes and their Inspectors, Layer › Arrange · Clone · Effectors switch) + screenshots at 420 px + `npm run stress` + `tests/cloner.effectors.test.js` (6: every effector type and falloff, mock-evaluated expressions = `features/grid/effectors.js`) | 450 interactions: **0 JS errors**. Error toasts are correct refusals on the sample comp (a layer with its own rotation expression is not overwritten without *Replace existing*; Open Folder / Open Pre-comp). 1 covered click: *Pin* while the inline Inspector moved rows (as in v0.32, not reproducible). The tests found Random giving near-equal values to neighbour items (seeded LCG) → fixed with a hash before release. **Preview + mock host (2D), not After Effects** |
| Every button (v0.32.0) | `node tools/audit-ui.js animate compositing shapes quick layout` alone (modes, inline Inspector under the clicked row, icon rows, one-line filters, Shapes inline settings, Quick Bar rows) + screenshots at 300 / 420 / 700 px of every library page, Shapes, Quick Bar + `npm run stress` + `tests/library.pages.test.js` (5) | 700 interactions: **0 JS errors**. 9 error toasts are the tools' own refusals on the sample selection (Screen Key: no screen colour; Open Folder: project not saved; Open Pre-comp; Delay: nothing animated) — correct. 2 covered clicks: *Pin* while the inline Inspector moved rows (not reproducible: the button is on top), *Screen Key* under the Assistant button on the All tools tab → fixed (64 px room at the end of pages without the sticky bar), checked. Stress 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.31.0) | `node tools/audit-ui.js home@moe home home@glass` alone (merged groups: Animate In / Out / Draw On switch, Keyframes & Loops, Flip pair, Sliders, Key & Color, Deliver & Project; compact Motion Control) + screenshots of all six MOE tabs and 15 pages at 420 px, Bento / Glass at 420, MOE at 300 / 700 + `npm run stress` + `tests/space.content.test.js` (6) | 250 interactions: **0 JS errors**, 0 click errors, 0 error toasts (partial per view: 100 / 50 / 100, audit time cap). No orphan tile, no empty Recent row. Stress 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.30.1) | `node tools/audit-ui.js home home@glass kit` alone (Motion Control with the filled rail and named Ease Copy) + screenshots at 300 / 420 / 600 / 700 px in Bento, Glass, MOE and the docked Motion Kit + `npm run stress` + `tests/motion.control.test.js` (7) | 300 interactions: **0 JS errors**, 0 covered (partial per view: 100 each, audit time cap). No empty space beside the anchor at any width; nothing cut at 300 px. Stress 20/20. Installer under Wine: in-place 0.30.0 → 0.30.1. **Preview + mock host, not After Effects** |
| Every button (v0.30.0) | `node tools/audit-ui.js home home@glass home@moe kit` (Motion Control on top of Bento NOW, the Glass Now card and MOE tabs, the Motion Kit) run alone + a Playwright run of Copy ease → Paste ease on the preview mock (2 segments copied, 7 keys pasted, verified) and the Next row + the shortcut script + `npm run stress` + `tests/motion.control.test.js` (6) | 500 interactions: **0 JS errors**, 0 covered. Runs cut by the audit time cap — partial per view (Bento 100, Glass 150, MOE 150, Motion Kit 100). Shortcuts 18/18. Stress 20/20. Installer under Wine: in-place 0.29.0 → 0.30.0, one folder, no `.debug`. **Preview + mock host, not After Effects** |
| Every button (v0.29.0) | `node tools/audit-ui.js` on Bento / Glass / MOE home, Quick Bar (Customize), Animate, Expressions, Settings — run alone after a first run was spoiled by running the stress test and the Wine install at the same time (page loads timed out) + a Playwright shortcut script (Ctrl+K, Ctrl+Space, `, Ctrl+1…5 incl. scroll position, Alt+1 / Alt+4 / Alt+9, ?, Esc) + `npm run stress` + `tests/fewer.test.js` (5) | 850 interactions: **0 JS errors**. Found and fixed: on library pages the assistant button covered the sticky **Apply** button (Expressions: Wiggle, Wiggle X) → it sits above the Apply bar now (checked in Bento, Glass, MOE); Ctrl+4 (Finish) lit Design after the jump because the page cannot scroll Finish to the top → the jumped-to stage stays lit while on screen. Runs were cut by the audit time cap — partial per view (Bento / Glass home 50, MOE home 100, Quick 150, Animate 150, Expressions 150, Settings 50). Shortcuts 18/18. Stress 20/20. Installer under Wine: in-place 0.28.0 → 0.29.0, removed files gone, no `.debug`. **Preview + mock host, not After Effects** |
| Every button (v0.28.0) | `node tools/audit-ui.js home home@assist home@learned home@glass home@glook home@moe` (Bento home with stages + Power cards, the Assistant open, cards learned, Glass with its five stage spaces, MOE) + re-run of `home@assist` after the fix + a Playwright shortcut script (Ctrl+K, Ctrl+Space, `, Ctrl+1…5 incl. scroll position, Alt+1 / Alt+4 / Alt+9, ?, Esc) + `npm run stress` + `tests/workflow.home.test.js` (11) | 782 interactions: **0 JS errors**, 0 covered after the fix. Found and fixed: the open Assistant sheet floated over the page and covered 17 controls → it is now a drawer at the bottom and the page shrinks above it (re-run: 150 clicks, 0 covered); Ctrl+1…5 lit the wrong stage chip while the page was still scrolling → the chosen chip holds during the jump; *Send* with an empty box did nothing → it focuses the box and says what to type. Every run was cut by the 28-min (and 16-min) audit time caps — partial per view (home 150, assist 150, glass 150, Glass › Design 132, learned 100); the MOE run produced no rows before the cap. Shortcuts 18/18. Stress 20/20. Installer under Wine: in-place upgrade 0.27.0 → 0.28.0, one folder, no `.debug`. **Preview + mock host, not After Effects** |
| Every button (v0.27.0) | `node tools/audit-ui.js looks home@bento home@moe glook` (Looks & Glass with the 7 Thick looks and their Inspector, Bento / MOE home, the Glass style's Look space) + `npm run stress` + Playwright: Prism tile → Inspector → *Make Thick Glass* on the preview mock → 9 layers + map, all checks ✓ + `tests/glass.thick.test.js` (9) | 681 interactions: **0 JS errors**, 0 dead, 0 covered. Expected refusals only (Open Folder, Open Pre-comp, Grid tiles on the fixture). Bento (150) and MOE (200) runs were cut by the 28-min audit time cap — partial. Found and fixed: the dev preview hard-coded *seen version* 0.26.0, so the What's new sheet covered every page in the audit (test setup, not the panel); the Inspector label *One glass for all* was cut at 420 px → *One piece*. Stress 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.26.0) | `node tools/audit-ui.js brand@seed home@bento home@moe backgrounds` (Brand page with a client: Apply brand / Brand whole comp / Brand ease / Make backgrounds; Bento NOW with the brand tile; MOE sidebar with drag reorder; Backgrounds with custom brand presets in Mine) + `npm run stress` + `LAYOUT=moe` + Playwright: import → 3 backgrounds in Mine (rendered in the client colours) → Apply brand verified on the selection → brand tile in NOW; drag reorder in the MOE sidebar saved to the Quick Bar + `tests/brand.action.test.js` (Apply Whole Brand on the AE mock incl. full restore) | 1,208 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow**. Expected refusals only (Open Folder, Open Pre-comp, Grid tiles on the fixture, Screen Key). Found and fixed: readiness ran `prepare` without services (brand tools said "Choose a client"); Mine background tiles showed the original palette; `bgDraw` could not draw a custom palette. Stress 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.25.0) | `node tools/audit-ui.js home@bento home@glass home@moe brand` (Bento with pins / folds / index, Glass with the Now fold and capsule, MOE with its sidebar — every menu by object and every shortcut — and the Brand page with *From website / PDF*) + `npm run stress` (Bento is now the default) + `LAYOUT=glass|moe node tools/stress-ui.js` + Playwright: MOE sidebar narrow / wide, Bento pin / fold, Glass fold / Ctrl+3 / Electric accent, Brand import → review → save (demo site and canned Claude answer) + `tests/brand.import.test.js` (mocked web / Claude / AE) | 1,108 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow**. Expected refusals only (Open Folder, Open Pre-comp, Grid tiles on the fixture, Screen Key); no effect: Refresh selection, empty Plan, a click on an open MOE menu's background. Stress 20/20 in all three styles. **Preview + mocks — no real website, PDF, Claude call or After Effects** |
| Every button (v0.24.0 styles) | `node tools/audit-ui.js home@glass home@glook home@apple home@aplayer home@bento` (Glass: Now card + Motion and Look spaces + capsule; Apple: root + Layer category; Bento: the whole page) + `LAYOUT=glass|apple|bento node tools/stress-ui.js` + Playwright 10-task click benchmark (Classic 22 clicks / 678 px scroll, Glass 21 / 1,517, Apple 18 / 1,049, Bento with its index 18 / 543) + screenshots dark / light, 340 / 420 px | 1,206 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow**. Expected refusals as in Classic (Open Folder, Open Pre-comp, Grid tiles on the fixture with the user's own Rotation expression — same message, checked by hand in Apple and Classic, Screen Key). Found and fixed: Bento index chips gave no visible feedback (now marked); kit block titles repeated inside Apple cards and Bento tiles; empty caption rows in Bento. Stress 20/20 in all three (Bento home 12 % busy — the whole page is drawn). **Preview + mock host, not After Effects; backdrop blur not measured inside AE** |
| Every button (v0.23.0) | `node tools/audit-ui.js home@tkeys home@tanimate home@tlayer home@tdesign home@teffect home@tcomp kit` after the design system (new sizes, Lucide icons, tiers, restyled rigs / links / menus) + Playwright measurement of every control in the six tabs before / after + light 340 px / midnight 420 px screenshots | 1,747 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow** at 340 / 420 / 600 / 900 px (fixed on the way: long group titles wrapped at 340 px, the Align ↔ ↕ glyph overflowed its 12 px box). Small targets (< 24 px) are the same kinds as before: the tab ▾ (right-click on the tab does the same) and the inner segments of the 24 px Ease / graph controls. Refusals are the expected ones (Open Folder, Open Pre-comp, Grid tiles on the fixture, Screen Key). Contrast 108 / 108 (new: text on raised and elevated surfaces). Stress 20/20. **Preview + mock host, not After Effects; Windows display scaling not tested** |
| Every button (v0.22.0) | `node tools/audit-ui.js home@tkeys home@tanimate home@tlayer home@tdesign home@teffect home@tcomp` with ▸ Recent filling as the audit runs (it clicks the new Recent items, *Clear* and every ▾ menu from every tab) + Playwright: Recent row height unchanged when it fills, ↓ / Alt+↑ / ← / → on group headers, drag *Arrange* above *Recent*, order kept per tab, *Reset group order* from ▾ | 1,612 interactions: **0 JS errors**, 0 unnamed controls, 0 overflow at 340 / 420 / 600 / 900 px. Refusals are the expected ones (Open Folder, Open Pre-comp, Grid tiles on the fixture, Screen Key) — more of them only because each ▾ menu is now reached from every tab; no effect: Refresh selection, empty Plan. Stress 20/20. The preview stores data in memory, so "kept after restart" is covered by the store tests, **not** by a real AE restart (checklist 145). **Preview + mock host, not After Effects** |
| Every button (v0.21.0) | `node tools/audit-ui.js home@tkeys home@tanimate home@tlayer home@tdesign home@teffect home@tcomp` after the tab ▾ quick menus + Playwright 12-task click benchmark Classic vs MOE ★ (420 px, comp HERO_Title, keys selected; shortest working route per task) + layout metrics of all six layouts | 768 interactions: **0 JS errors**, 0 unnamed controls, 0 overflow at 340 / 420 / 600 / 900 px. Expected refusals as in v0.20 (Open Folder, Open Pre-comp, Grid tiles on the fixture, Screen Key with no screen colour); no effect: Refresh selection, empty Plan. Benchmark: Classic 19 clicks, MOE ★ 20. Stress 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.20.0) | `node tools/audit-ui.js home@tkeys home@tanimate home@tlayer home@tdesign home@teffect home@tcomp` (all six tabs of the new default Classic layout: tabs, ≡ menu, search, every group twirl, action, tile, link) + `npm run stress` (Home now clicks Classic actions / tiles) | 768 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow at 340 / 420 / 600 / 900 px**. Refusals are the expected ones with clear messages: *Open Folder* (unsaved project), Grid tiles (fixture Title has the user's own Rotation expression → *Replace existing*), *Screen Key* (no screen colour in the fixture), *Open Pre-comp* (no pre-comp selected). Found and fixed: tab id `animate` collided with the Motion presets page (stress); *All N ›* links 17 px tall → 24 px. Stress 20/20 stable. **Preview + mock host, not After Effects** |
| Every button (v0.19.0) | `node tools/audit-ui.js layout layout@gridsel` (Layout & Grid library + a built grid with its null selected → the "Your grid" panel: Layout / Morph To / Orient chips, Morph slider, sort buttons, ↑ / ↓, tweak) + Playwright on the panel (Layout chip → ring, Morph 50, Reverse, ↓, drag 3 → 1, Twist on selected only) + `npm run stress` | 349 interactions: **0 JS errors, 0 dead clicks, 0 tool failures**; 96 panel controls clicked. Found and fixed: the panel's tip line overflowed narrow panels (342 px at 340); every slider's fill ignored its value (CSS variables dropped by `h()`). Stress 20/20, stable. **Mock host, not After Effects** |
| Every button (v0.18.1 tiles) | `node tools/audit-ui.js backgrounds` after hover-moving tiles + palette tiles keeping your motion + event-based hover; `npm run stress`; Playwright: hovered tile changes between frames, still when the mouse leaves, Mesh + Orbit + Cycle survive a palette click | 396 interactions: 0 JS errors, 0 dead clicks, 0 tool failures, 0 overflow at 340–900 px. Stress busy on Backgrounds 5 % (was 64 % before the per-frame `require()` fix). **Preview + mock host, not After Effects** |
| Every button (v0.18.0) | `node tools/audit-ui.js backgrounds` (every palette tile, filter, Motion / Colours chip, slider and Add Background) + Playwright: the preview canvas changes between frames, chips switch, Add Background with Mesh + Swirl + Pulse on the mock comp passes its 13 checks | 396 interactions: **0 JS errors, 0 dead clicks, 0 tool failures**, 0 overflow at 340 / 420 / 600 / 900 px; all 12 Motion / Colours chips clicked, each changes the choice. Small target: the existing *Advanced* toggle. **Preview + mock host, not After Effects** |
| Every button (v0.17.0) | `node tools/audit-ui.js home@moe` (Home in the MOE ★ layout, every menu and its items, Quick Bar, tabs) + Playwright: MOE × 3 demo comps × 340 / 420 / 640 px, every menu / tab / card / crumb (82 clicks) | 426 interactions: **0 JS errors**, 0 unnamed controls, **0 overflow and no small targets in the new rows at 340 / 420 / 600 / 900 px**. Expected refusals and no-effect clicks are the same as v0.16 (Open Folder, Open Pre-comp, Grid / Ring / Honeycomb / Spiral on the fixture, Refresh selection, empty Plan, a menu's background). **Preview + mock host, not After Effects** |
| Every button (v0.16.0) | `node tools/audit-ui.js home@hub home@bar home@workspace` (Home in each of the three new layouts, incl. every Command Bar menu and its items) + Playwright: 3 layouts × 3 demo comps × 340 / 420 / 640 px, every tab / sub-tab / card / crumb / menu clicked (122 clicks) | 950 interactions (Hub 297, Command Bar 335, Workspace 318): **0 JS errors**, 0 unnamed controls, **0 overflow at 340 / 420 / 600 / 900 px**. Found and fixed before the release: right-hand menus opened past the panel edge, Esc did not close a menu, tab rows / menu row / context bar overflowed at 340–420 px, empty tab buttons at 340 px, the "AI" menu 18 px wide, no route to Motion presets from the Command Bar. Expected refusals (same as v0.15): *Open Folder* (unsaved project), *Open Pre-comp* (no pre-comp selected), *Grid / Ring / Honeycomb / Spiral* (fixture Title has the user's own Rotation expression); no effect: *Refresh selection* (nothing changed), Copilot *Plan* with an empty request, a click on a menu's empty background. Remaining small targets (< 24 px) are the existing Ease / Align segmented controls, unchanged from v0.15. `npm run stress` (current layout): 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.15.0) | `node tools/audit-ui.js home kit` on the Smart Home | 449 interactions (Home 322, Kit 127): 0 JS errors, 0 unnamed controls, 0 overflow at 340 / 420 / 600 / 900 px. Expected refusals: *Open Folder* (unsaved project); *Grid / Ring / Honeycomb / Spiral / Fan* from the focus card refuse because the fixture's Title layer carries the user's own Rotation expression (the message offers *Replace existing*). `npm run stress` now clicks the focus-card buttons on Home: 20/20. **Preview + mock host, not After Effects** |
| Every button (v0.14.1) | `node tools/audit-ui.js home kit` after per-segment curves, folding blocks, grouped Toolbox and the Quick Bar Fit mode | 448 interactions (Home 321, Kit 127): 0 JS errors, 0 unnamed controls; found a 6 px overflow at 340 px (Ease header) and the +N pop-up covering its button — both fixed in 0.14.1, overflow re-measured 0 at 340 / 420 / 600 / 900 px. Expected refusals as in v0.13. **Preview + mock host, not After Effects** |
| Every button (v0.13.0) | `node tools/audit-ui.js home kit` after the graphs / presets / Align rework | 435 interactions (Home 308, Kit 127): 0 JS errors, 0 unreachable or unnamed controls, 0 overflow. 4 flagged, all expected: *Open Folder* refuses on an unsaved project, *Grid* / *Ring* refuse layers that already carry the user's own expressions, *Refresh selection* with nothing changed shows no visible effect. Small targets left: segmented buttons 20 px high (Both / Value / Speed, Sel / Key / Comp), as before. **Preview + mock host, not After Effects** |
| Every button (v0.10.0) | Same audit, 23 views incl. Home (kit blocks) and the Toolbox | 3,112 interactions: 0 JS errors, 0 unreachable, 0 overflow. Found: kit segmented controls under 24 px and a silent click on the source line with no keys — both fixed in 0.11.0. **Preview + mock host, not After Effects** |
| Every button (v0.9.0) | Same audit, now 22 views incl. the new *Ease Curves* and *Anchor & Align* sections + `tests/transform.test.js` (Bézier maths, anchor with scale + rotation, keyed position shift, align / distribute, ring / row clone, Ease Curve speeds + influences, restore of each; UI wiring and every new thumbnail) + browser flow: drag a curve handle, Apply Curve, Set Anchor, Clone tile | 2,831 interactions: 0 JS errors, 0 unreachable; 1 overflow found and fixed (curve row at 340 px). The one new "dead" click is the anchor picker's already-selected point (no change expected). Other failures are the known host-time conditions. **Preview + mock host, not After Effects** — checklist 87–95 |
| Updater over HTTPS | Real Node HTTPS download from a local self-signed server (redirect, progress, SHA-256, oversize cut-off) | Pass |
| **Inside After Effects 2025** | — | **Not run yet** |

What the mock proves: our logic, argument handling, ES3 syntax, undo-group balance, verification and restore paths.
What it does not prove: real AE behaviour (timing of `expressionError`, selection order, CEP loading, Node in CEP, DPAPI, network from AE).

## Automated tests (npm test)

- ✅ Request shape: structured output, cached system prompt, fallback, key only in header
- ✅ System prompt is deterministic (prompt-cache friendly)
- ✅ Plan schema only allows AI-callable tools
- ✅ Copilot: plan validated → approved → executed → verified → rolled back
- ✅ Copilot: hallucinated tools and bad args are rejected before approval
- ✅ Plan schema stays compact: no per-tool variants (API "compiled grammar is too large")
- ✅ Copilot: args_json is parsed and re-validated locally; broken JSON and unknown keys are refused
- ✅ Copilot: agent-origin changes need approval
- ✅ API failures: no key, 401, refusal, truncation, retry on 429, offline
- ✅ Cost monitor: pricing math and monthly budget gate
- ✅ AI disabled in settings: AI blocked, local tools unaffected
- ✅ Expression Assistant returns code for diff without touching the host
- ✅ AT1 Analyze: known mean colour, probe removed, project unchanged
- ✅ AT2 Analyze: detects warm cast and black/white points on a gradient
- ✅ AT3/AT4 Grade neutral: identity Channel Mixer, re-run updates in place
- ✅ AT5 Grade auto balance: measured warm mean maps to neutral grey
- ✅ AT6 Restore: removes a created grade; restores previous values after an update
- ✅ AT7 Match Color: target stats transferred to reference; MOE Match placed before MOE Grade
- ✅ AT8 Match Color blocked: reference = target, missing, or not visible now
- ✅ AT9 Screen Key: samples green, builds Keylight → Cleaner → Spill → Choke, no duplicates on re-run
- ✅ AT9b Screen Key goes before an existing MOE Grade
- ✅ AT9c Screen Key: no screen visible → clear error, nothing added
- ✅ AT10 Screen Key blocked on layers with a user keyer, and on null/camera layers
- ✅ AT11 Unresolvable parameter: no effect left behind, error lists the parameters
- ✅ AT12 Non-English parameter names resolve by match-name convention and are flagged
- ✅ AT13 Permission: modify.effects Off blocks; Copilot origin needs approval
- ✅ AT14 Look from Words: sends measured stats, validates/clamps values, never writes; offline is clean
- ✅ AT15 Copilot plans with compositing.grade and the plan validates
- ✅ AT16 Backwards compatibility: old settings file gains the new scope; existing tools unchanged
- ✅ Adjustment layers: manual grade allowed, auto options blocked
- ✅ Colour math: transfer, saturation and contrast behave as documented
- ✅ effects.ensure rolls back its own changes when a later layer fails
- ✅ Conflict: keyed layers are measured after the key (subject only), with MOE Grade/Match bypassed
- ✅ Conflict: Match Color refuses an unkeyed green-screen layer, writes nothing
- ✅ all built-in tools pass registry validation
- ✅ registry rejects incomplete or unsafe definitions
- ✅ search ranks name matches first
- ✅ schema: defaults, coercion, bounds, unknown keys
- ✅ permissions: agent can never modify silently; deny wins
- ✅ context requirements produce human reasons
- ✅ logger scrubs API keys
- ✅ host literal is ASCII-only and ES3-safe
- ✅ Apply expression: applied + verified, checkpoint restores originals
- ✅ Apply expression: engine error → reverted and reported as failed
- ✅ Validate: reports syntax errors and leaves the property unchanged
- ✅ Inspect and Remove
- ✅ Expression Assistant works offline-safely: clear error, no host change
- ✅ Green prompt rules are enforced even when the AI text forgets them or asks for another background
- ✅ Green prompt via Claude (mocked HTTP): enforced and returned with keying advice
- ✅ Import & Key: generated file imported at the playhead, fitted and keyed (Keylight chain); restore removes it
- ✅ Glass: adjustment matted to the source + linked tint/rim/shadow; controls drive the effects; restore
- ✅ Glass Look: switches controls on an existing glass
- ✅ Layouts: rectangular, snake, columns order, honeycomb offset (pure)
- ✅ Layouts: radial ring / sphere radius / phyllotaxis are geometric
- ✅ Layout guides: columns, gutters, margins and cells
- ✅ Grid build (rect): null + controls + live expressions; mock-evaluated positions equal the JS preview; restore is exact
- ✅ Grid build: radial with face-center, random order, animate-in keys on Build (Rise style)
- ✅ Grid build: sphere makes items 3D and restores them to 2D
- ✅ Grid build: path mode follows a shape path (points evaluated on the path)
- ✅ Grid build: refuses to overwrite your expressions unless "Replace existing", and leaves no null behind
- ✅ Grid remove + freeze
- ✅ Layout guides + Place in Cells (keyframes kept, measured centres)
- ✅ host loads and answers ping
- ✅ context.get reads only the selection, with stable addresses
- ✅ context.get with no project / no comp returns empty context, not an error
- ✅ unknown host op is rejected
- ✅ arguments cannot inject ExtendScript
- ✅ stale address is detected by matchName verification
- ✅ comp switch between read and write is refused
- ✅ Planner: roles — background, band, pinned, content, skip
- ✅ Planner: Fit / Fill / Keep are one uniform map for every layer
- ✅ Planner: smart 16:9 → 9:16 keeps the logo top-left, CTA bottom-right, stacks headline above product, BG covers
- ✅ Planner: overrides and Claude layout are applied and clamped
- ✅ Adapt: 16:9 → 9:16 as a new comp keeps every keyframe, original untouched, verified by measurement; restore removes the copy
- ✅ Adapt: in place with rig nulls — layers parented to MOE Adapt rigs, values untouched; restore is exact
- ✅ Adapt: in place direct — restore puts values, keys and eases back
- ✅ Adapt: a full-frame layout pre-comp is adapted inside a copy and swapped in
- ✅ Adapt: same size is refused; custom size validated
- ✅ Smart Ease: correct dimension count per value type, verified by read-back
- ✅ Smart Ease: HOLD sides are preserved, not converted
- ✅ Smart Ease: checkpoint restores exact previous ease and interpolation
- ✅ Smart Ease: invalid params never reach the host
- ✅ Smart Ease: blocked when no keyframes selected
- ✅ Stagger: frame-exact at 23.976 fps
- ✅ Stagger: frame-exact at 24 fps
- ✅ Stagger: frame-exact at 25 fps
- ✅ Stagger: frame-exact at 29.97 fps
- ✅ Stagger: frame-exact at 30 fps
- ✅ Stagger: frame-exact at 50 fps
- ✅ Stagger: frame-exact at 59.94 fps
- ✅ Stagger: frame-exact at 60 fps
- ✅ Stagger: selection order and reverse order
- ✅ Stagger: random order is reproducible with a seed
- ✅ Stagger: locked layers are skipped and reported
- ✅ Stagger: keyframes move with the layer, and restore puts them back
- ✅ Stagger: large selection (300 layers) completes in one host call
- ✅ Context limit: selections beyond maxLayers are truncated and flagged
- ✅ History records verified runs
- ✅ store: atomic JSON docs, jsonl logs, corrupt file recovery
- ✅ secrets (non-Windows fallback): stored outside source, mode 0600, clearable
- ✅ Reverse keyframes: times mirrored inside the span, values swapped; restore rebuilds
- ✅ Clone & Mirror keys at the playhead (out animation)
- ✅ Flip horizontal negates scale on value/keys; restore flips back
- ✅ Quick Animate: slide in right→left off-screen ends at the current pose; fade out; restore
- ✅ Trim Paths travel: MOE Trim added, End and Start keyed with lag; restore removes it
- ✅ Typewriter on Arabic text uses Words; Counter writes a live Source Text expression
- ✅ Parent to Null, Select Same Property, Pre-compose, Separate X/Y, Duplicate deep, Reveal, Purge
- ✅ Quick expressions: wiggle on natural target, wiggle X keeps Y, blink, loops need keys, live controls
- ✅ recipe validation: binds params, rejects unknown tools/params/non-callable tools
- ✅ recipe save → preflight → run (no AI needed) → history
- ✅ Tool Factory draft conversion keeps Claude output untrusted
- ✅ Copilot plan → saved recipe
- ✅ Brand store: create, validate, update, export/import, delete
- ✅ Brand colour → text fill, shape fill + stroke, solid via MOE Brand Fill (solid source untouched); restore
- ✅ Brand colour → selected COLOR property wins over layer targets
- ✅ Brand font auto: Arabic text → Arabic font + RTL; English → English font; keyframed Source Text at CTI; missing font refused
- ✅ Palette extraction (k-means) and fonts.list with Arabic detection
- ✅ FFX parser reads all four owner presets exactly
- ✅ Built-in Signature presets match the decoded owner files
- ✅ Animate Text builds the animator at CTI; Out ends at layer out point; re-apply replaces; restore removes
- ✅ Arabic text: character presets switch to Words; distance & direction controls
- ✅ Imported .ffx: stored in the library, previewable, applied via applyPreset to exactly the selected text layers
- ✅ Preview engine: hidden at start, revealed at end, words reveal in order
- ✅ Proximity: effector + controls created, combined expressions per property, engine-valid, restore removes everything
- ✅ Proximity: reuses a selected effector, protects user expressions, rejects contradictory features, 3D-only features skipped on 2D
- ✅ Proximity remove (selected / all) and Center Anchor keeps the layer in place
- ✅ Select: types, filters, modes, search, same-as, labels, invert, history
- ✅ Select tool (Copilot) and layer switches with restore
- ✅ Copilot catalog includes the new tools and context carries brands + preset ids
- ✅ Zoom maths: centre mode clamps so the frame stays covered; in-place keeps the point
- ✅ Focus Zoom on the selected layer: rig + Transform effect + keys; read-back at zoom-in; restore removes the rig
- ✅ Focus Zoom chains: a second zoom starts from the rig state (pan), restore removes only its keys
- ✅ Follow Zoom: anchor expression follows the target and is clamped
- ✅ Cursor Animator: cursor layer with travel/hold, pulse and ripple from a keyed null
- ✅ Studio: every tile is a registered tool with valid preset args
- ✅ Studio: every tool belongs to a section that exists in the sidebar
- ✅ Studio: thumbnail recipes draw without throwing (canvas stub)
- ✅ 34 × "UI module loads" (every panel UI file parses and loads)
- ✅ v0.6 SVG → AE Shape: absolute/relative lines, H/V, Z merge; cubic tangents relative to their vertex, S reflection, Q → cubic; arcs stay on the circle (< 0.01 px), compact arc flags; circle / rounded rect / line / polygon elements
- ✅ v0.6 every bundled Lucide icon (1,899) converts and stays inside its 24-grid box; search ranks the exact name first
- ✅ v0.6 Insert icon (line + pop): paths, round caps, stroke = size/12, scale keys, starts at the playhead; restore removes it
- ✅ v0.6 Insert native star: Polystar points / radii, fill colour; draw-on refused for fill-only shapes
- ✅ v0.6 Insert with draw-on (MOE Trim end 0 → 100) and duotone (35 % even-odd fill)
- ✅ v0.6 Unknown icon / bad colour refused before touching AE; every native primitive inserts and verifies
- ✅ v0.6 Background geometry; linear + grain + drift on a bottom `MOE Background` (Ramp colours read back, tagged drift expressions); mesh = 4-Colour Gradient; flat = no effect; restore removes the layer
- ✅ v0.6 Palette maths (cycle wraps, blend hits both ends, shuffle deterministic); 32 palettes valid; Colorize text + shape + footage, restore
- ✅ v0.6 Preset packs round-trip; unknown tools, bad args and junk skipped; appearance resolve; artwork for every section; banner copy; expressions (33, tagged, own numbers, no `undefined` in code); NEW badges; Home/Shapes sections

Expression maths: the mock now *evaluates* generated expressions (`tests/mock/ae-expr.js`) — Grid positions, Zoom follow, Glass links and Quick expressions are checked numerically, not only for syntax. This is still not the AE expression engine.

### Compositing module (v0.2.0) — acceptance tests from docs/features/COMPOSITING.md §7
| AT | Result (mock host) |
|---|---|
| 1 Analyze: known mean, probe removed, project unchanged | ✅ |
| 2 Cast + black/white detection | ✅ |
| 3–4 Neutral grade = identity mixer; re-run updates in place | ✅ |
| 5 Auto balance neutralises measured mean | ✅ |
| 6 Restore: created → removed, updated → previous values | ✅ |
| 7 Match: transferred mean = reference mean; Match before Grade | ✅ |
| 8 Match blocked (self, missing, not visible now) | ✅ |
| 9 Screen Key: sampled colour, chain order, no duplicates, placed before Grade, no-screen error | ✅ |
| 10 Blocked on user keyer / null / camera | ✅ |
| 11 Unresolvable parameter → nothing left behind, parameter dump | ✅ |
| 12 Non-English names → match-name fallback, flagged | ✅ |
| 13 Permission Off blocks; Copilot needs approval | ✅ |
| 14 Look from Words: stats sent, values clamped/validated, no writes, offline error | ✅ |
| 15 Copilot plan with compositing.grade validates | ✅ |
| 16 Old settings gain `modify.effects`; existing tools unchanged (all 56 earlier tests still pass) | ✅ |
| 17 UI preview Comp at 260/360/560 px, layer picker | ✅ (preview, not CEP) |
| Studio (v0.3.0): brand store/colour/font/palette, ffx parser vs owner files, built-in presets = decoded values, animator build/replace/restore, Arabic switch, ffx import + applyPreset selection, preview engine, proximity build/reuse/protect/remove/center-anchor, select types/modes/search/same/labels/history, Copilot context | ✅ (mock host) |
| Extra: host rollback on mid-call failure; keyed-layer measurement with bypass; unkeyed screen refused for Match | ✅ |

Mock limitations specific to this module: the mock's `sampleImage` averages a procedural image; its Keylight is a colour-distance threshold and its Channel Mixer applies the documented affine maths. Real Keylight quality, real Channel Mixer units, and real parameter names are **not** proven here.

## Installer runs (Wine 9.0, v0.6.1)
| Check | Result |
|---|---|
| `/S` install → files in `%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai`, `install.json`, no `.debug` | ✅ |
| `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode = 1`; one Apps entry (name, version, publisher, icon, uninstall + quiet uninstall, size) | ✅ |
| Old MOE copy `moe-motion-ai-v0.5.0` (same bundle id) removed; `moe-motion-ai-backup` (other bundle id) and another panel kept | ✅ |
| User data folder `%APPDATA%\MOE Motion AI` untouched by install / update / silent uninstall | ✅ |
| Update 0.6.0 → 0.6.1: same folder, Apps version 0.6.1, a file that no longer exists in 0.6.1 is gone, installed files == staged files | ✅ |
| `/WAITAE` while a process named `AfterFX.exe` runs: waits (14 s) until it exits, then installs | ✅ |
| Silent uninstall: extension folder, Apps entry and tool folder removed | ✅ |
| Developer junction unlinked without touching its target | ⏳ not testable under Wine — Windows checklist 57 |

## UI preview scenarios (node tools/screenshot.js)
v0.6.1 Updates: Settings › Updates with a demo feed — update available (notes, size), downloaded and verified, scheduled for After Effects close.
v0.6 Premium: Home, Shapes & Icons (grid, search + duotone preview, insert + report, native shapes), Backgrounds (palette panel, mesh applied), Expressions "Auto", Animate "Ease", What's New, Shortcuts, About, Settings (Appearance + My Presets), Midnight + Violet, Light + Mint, save to My Presets, splash, narrow Home and Shapes.
v0.5 Studio: Animate (library, pick, double-click apply, All tools), Text, Layout & Grid (Ring, Wall Build applied + report), Looks & Glass (applied), Zoom & Focus, Expressions (tile, Editor), Deliver (board, per-format override, Create 3 comps), Compositing, Quick, Quick options popover, Brand, Select, Copilot, Settings, History, light theme, command search; narrow: Animate, Layout, Deliver at 380 px, compact 280 px.

Earlier scenario list (v0.4 and before): motion, motion-compact (260 px), motion-wide (560 px), expressions, copilot plan, copilot executed, expression assistant diff, tool factory draft, history after a run, settings, diagnostics, command palette, light theme, Text/Brand/Select/Proximity (v0.3), and v0.4: Quick section, Quick options popover, Quick Bar run, Grid preview, Ring preset, Grid built + verification, Adapt plan preview, Adapt run, Layout Guides, Focus Zoom map picker, Glass applied, one-click expressions — screenshots in `dev/screens/` (git-ignored). The AI scenarios use canned responses (`dev/demo-ai.js`, preview only).

## Host checklist (run on Windows 11 + After Effects 2025)
Record results here with AE version/build from the Diagnostics view.

1. `powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1`, restart AE → *Window › Extensions › MOE Motion AI* appears and opens.
2. Diagnostics shows AE version, build, host module 0.1.0, runtime `cep-node`, Node v17.x.
3. Context strip updates when selecting layers / properties / keys (hover the panel).
4. Smart Ease on Position (spatial), Scale (3D), Opacity (1D), a Color property, a Shape path: graph editor shows the influence; one *Edit › Undo MOE: Smart Ease* reverts it; History › Restore reverts it exactly.
5. Smart Ease on a key with HOLD out-interpolation keeps HOLD.
6. Stagger at 23.976 and 29.97 fps: layers land exactly on frames; locked layer untouched; Undo reverts in one step.
7. Stagger order "Selection": does AE return `selectedLayers` in click order? (record)
8. Apply `thisComp.layer("Nope").position` → reported error and reverted (confirms `expressionError` is synchronous).
9. Validate a valid and an invalid expression → original expression unchanged.
10. Settings › Save key → `%APPDATA%\MOE Motion AI\secrets.dat` contains `"protection":"dpapi"`; Diagnostics shows no key in logs.
11. Copilot: "make the selected keys snappy" → plan → Approve → result verified → Roll back.
12. Disconnect network → local tools still work; AI shows "Cannot reach the Claude API".
13. 500+ selected layers: context read time acceptable; stagger completes.
14. Change AE brightness (Preferences › Appearance) → panel follows.

### Motion Control checklist (v0.30.0) — inside After Effects 2025
173. Select keys on a Title's Position (3 keys, different eases): Copy ease; select Scale keys on another layer; Paste ease — each segment gets its curve (Graph Editor), Edit › Undo and History › Restore bring the old ease back.
174. Copy one segment, paste on 5 segments of a long move: the same feel everywhere; Ease out only leaves the incoming handles alone.
175. Docked narrow (≈300 px): the anchor and align rail sits under the graph; folded strip shows Copy / Paste + anchor + align; anchor and align still run.

### Fewer, clearer checklist (v0.29.0) — inside After Effects 2025
171. A panel that used Classic / Apple / Sidebar before: after updating it opens in Bento with the notice; ≡ › Panel layout offers Bento · Glass · MOE.
172. A Quick Bar saved before v0.29 (with Slide In, Wiggle, Loop Cycle…) shows the same buttons once each and they run the same presets; ☆ next to Apply in the Animate library adds a preset to the bar.

### Workflow Home + Assistant checklist (v0.28.0) — inside After Effects 2025
167. With the panel focused, Alt+1 (Easy Ease on selected keys) and Alt+3 (Center Anchor) run; holding Alt shows the numbers on the Quick Bar. If Windows / AE takes Alt+digit first, note it — the buttons themselves still work.
168. ` (backquote) and Ctrl+Space open the Assistant; ask a question in Arabic → answer in Arabic; ask for a change → plan → Approve → steps verified → Roll back. Without a key: the offline answer lists matching tools.
169. Two projects with different clients: work in one with client A active, open the other with client B, switch back → toast "… → client A" and Brand actions use A.
170. A 1080×1920 comp: NOW shows "9:16 · HD"; the assistant suggests Social safe area → guides appear (≈ 65 px sides, ≈ 269 px top / bottom), Snap to Guides works.

### Thick Glass checklist (v0.27.0) — inside After Effects 2025
162. A shape logo over a photo: Thick Glass (Thick Clear) runs without "Cannot map parameter" — if it fails, copy the CC Glass parameter list from the message into the issue; the photo bends at the bevel and stays straight in the middle.
163. Move, scale, rotate and parent the original logo (and animate it): the glass, highlights, prism and reflection stay exactly on the shape at every frame; edit a path point and the text of a title — the glass follows.
164. Looks: Prism shows red / blue fringes, Chrome / Liquid Gold look metallic, Sugar Glass is frosted; Light Angle moves highlights, shadow and caustic together; Thick Glass Look changes look and keeps keyframes on the controls.
165. One glass for all on a title + a shape: one map comp with both, one refraction; History › Restore removes every layer and the map comp from the Project panel; Edit › Undo also works step by step.
166. Render a 1080p 5 s comp with one Thick Glass at Full quality: note the render time against the same comp without glass.

### Brand in action checklist (v0.26.0) — inside After Effects 2025
159. A real comp (headline, body, Arabic line, two shapes, a BG solid) with a client that has installed fonts: Apply brand → fonts by script, colours by role, BG solid gets MOE Brand Fill; one Edit › Undo removes everything; History › Restore too.
160. Brand whole comp with nothing selected; a locked layer and a MOE Background stay untouched; a keyframed Source Text is set at the current time and the report says so.
161. Backgrounds › Mine: the client's backgrounds render in its colours and Add Background works; Brand ease on selected keys; drag shortcuts in the MOE sidebar and pinned tiles in Bento NOW.

### Three styles + Brand import checklist (v0.25.0) — inside After Effects 2025
154. Brand › From website / PDF with 3 real client sites (one Arabic / RTL): colours and fonts are right; a font you have installed is matched (✓), a missing Google font opens its page; Save, then click a colour on a layer and *Auto fonts* on text.
155. The same with a real brand book PDF (10–40 pages); then with the API key removed: the website gives a local scan, the PDF explains it needs Claude.
156. A site behind Cloudflare / a login: a clear message (403 → try the PDF), AE stays responsive while it reads.
157. MOE: the sidebar at ~340 / ~600 px, ⇔ names, each menu opens beside it, a shortcut runs and right-click opens its options.
158. Bento: pin 4 tiles to NOW, fold Animate, scroll — the index follows; Glass: Ctrl+1…4, fold Now, Settings › Glass blur Off.

### New styles checklist (v0.24.0) — inside After Effects 2025
151. ≡ › Panel layout › Glass, docked ~420 px: scroll a space with the mouse resting on cards — smooth, no lag, AE stays responsive (backdrop blur on the capsule / Now card / menus); switch AE brightness to light: pastel glass, readable.
152. Apple: open each category and come back with ‹ MOE; run a big tinted button and a row (one Undo each); presets shelf scrolls sideways with the wheel.
153. Bento: select keys → the ease graph is on top; select several layers → Align; the index chips jump to each section; at 340 px tiles go to two columns.

### Design system checklist (v0.23.0) — inside After Effects 2025
148. Docked ~340 / ~420 px at Windows scaling 100 % and 150 %: every icon is sharp and the same weight (Quick Bar, header, group buttons, menus); primary buttons (Easy Ease, Reverse Keys …) are visibly larger than the rest; chips at the end of Keyframe Assistant / Project.
149. Edit › Preferences › Appearance: AE brightness dark / light — the panel follows; menus (≡, tab ▾) float above the panel with a shadow and stay readable.
150. Animate › Animate Out: every tile shows a shape (none empty); hover plays the motion.

### Classic groups checklist (v0.22.0) — inside After Effects 2025
145. Layer tab: drag *Arrange (Grid Builder)* by its header above *Align* — an accent line shows where it lands; close and reopen AE: the order is still there (and the Keys tab kept its own). Tab ▾ › Reset group order puts it back.
146. Run Flip Horizontal, a Slide In tile and a tool from the ▾ menu: they appear in ▸ Recent, newest first, and the groups below do not move; click one in Recent — Recent keeps its order. Clear empties it.
147. Click a group header and use ↑ / ↓ / ← / → / Alt+↑ while the panel has focus: focus moves, groups fold / open / move, and AE's own shortcuts (e.g. the Timeline's ↑ / ↓ layer selection) do not fire.

### Final layout checklist (v0.21.0) — inside After Effects 2025
142. Classic, docked ~420 px: click ▾ next to Layer, then right-click the Effect tab — each opens its quick menu next to the tab; run an item (one Undo); Esc and a click outside close it.
143. Ctrl 1…6 switch the tabs while the panel has focus (and do not reach AE's own shortcuts when it does not).
144. Settings › Panel layout lists Classic · MOE ★ · Sidebar (old); MOE ★ shows the object menus over the same tabs; switch back to Classic.

### Classic layout checklist (v0.20.0) — inside After Effects 2025
139. Fresh install: the panel opens on Classic. Select keys / a text layer / several layers / nothing: the dot moves between tabs, the matching group opens and says *for selection*; nothing else moves.
140. ≡ menu: every item works (What's new, shortcuts, pie, Copilot, Favorites, History, Quick Bar, Panel layout ✓, Settings, Diagnostics, About). Ctrl K jumps to the search; typing "wig" lists Wiggle presets; Enter applies.
141. Docked at ~340 and ~420 px: tabs fit, groups twirl, a tile applies in one click (Undo), right-click opens its settings, All 37 › opens the library and the crumb returns.

### Grid Builder 2 checklist (v0.19.0) — inside After Effects 2025
135. Select 9 layers › Layout & Grid › **Grid → Ring** › Build: the items build in, then morph into a ring (one Undo each). In Effect Controls switch **Layout** to Spiral / Sunflower / Sphere and back: no expression errors, Spacing keyframes still work. Repeat with Project Settings › Expressions **Legacy ExtendScript**.
136. Rotate the grid null 45°: **Orient** Forward turns the items, Face Screen keeps them upright, Face Center faces out. Drag one item by hand in the comp: it keeps the nudge.
137. Select the grid null: the **Your grid** panel shows Layout / Morph To / Morph / Orient / Places. Drag an item to another place, Reverse, Shuffle: places change, the Timeline order does not. Select 3 items › Twist 30 › Apply: only those turn; Undo removes it.
138. Effector: Effector = a null, Push −100 attracts, Rotate 90 and Fade 100 act near the null only. Path mode on a shape layer and on a masked solid; then switch the Path layer control to the other one.

### Moving backgrounds checklist (v0.18.0) — inside After Effects 2025
132. Backgrounds › a palette › Mesh, Motion Orbit, Colours Cycle › Add Background: RAM-preview 0 → 8 s; frame 0 and frame 8 s look identical (seamless loop); the four points circle; colours step through the palette. Effect Controls shows MOE BG Loop / Amount / Colour; change each while playing.
133. Repeat for Linear + Swirl, Radial + Breathe, Linear + Wander + Hue, Mesh + Wave + Pulse; Expression engine set to **JavaScript** and to **Legacy ExtendScript** (File › Project Settings › Expressions): no expression errors in either. Compare the preview's look with AE's 4-Colour Gradient (the preview approximates its blending).
134. Open a project saved with an old "Slow drift" background preset: Add Background still works and moves (Drift).

### MOE layout checklist (v0.17.0) — inside After Effects 2025
131. Settings › Panel layout › MOE ★, docked at ~340 and ~420 px: three rows (menus, Quick Bar, tabs) above the graphs; select keys / a shape / text — only the lit menu changes; run a quick action, F4 appears next to the title and repeats it.

### Panel layouts checklist (v0.16.0) — inside After Effects 2025
128. Settings › Panel layout › Hub, Command Bar, Workspace, Current: the panel rearranges at once, nothing is lost (Ease graphs, pins, Quick Bar edits), and the choice survives an AE restart. The dock panel (MOE Motion Kit) is not affected.
129. Command Bar docked at ~340 and ~420 px: every menu opens inside the panel (Design / Layout / Finish / AI open towards the left), Esc and a click outside close it, the menu for the selection is highlighted and follows a selection change within ~1 s.
130. Workspace: the context bar's 8 actions run on the selection (one Undo each); × hides it, *For this* in the header brings it back; a Design card opens Backgrounds inside the tab and the crumb returns.

### Smart Home checklist (v0.15.0) — inside After Effects 2025
125. Select in turn: two keyframes, one solid, three layers, a text layer, a shape layer, nothing. The focus card's title and rows change each time within ~1 s (note the delay — MOE reads on its light poll and when the panel gets focus). Nothing below the card jumps.
126. On keyframes open *More › Anchor*; select a layer, then keyframes again: Anchor is open only for keyframes. Restart AE: still so.
127. Home footer *Layout: fixed*: the v0.14 order (Ease, Anchor/Align, Your tools); back to *smart*.

### Per-segment + panel checklist (v0.14.0) — inside After Effects 2025
122. Select 4 Position keys: the strip shows All · 1 · 2 · 3 with the curve on each. Click 2, drag the graph: Graph Editor › Speed shows the change only between keys 2 and 3 (one Undo). Click segment 3 in the overview, apply Out Expo: segments 1 and 2 keep theirs. Select other keys: back to All.
123. Fold Ease / Anchor / Align / Pinned on Home, close and reopen AE: they stay folded; the dock panel (MOE Motion Kit) keeps its own folds.
124. Quick Bar at ~300 / 400 / 500 px: one row, +N opens the rest inside the panel; a button in the pop-up runs and closes it; Utilities › Quick Bar › Bar cycles fit / wrap / one row.

### Graphs + Align checklist (v0.13.0) — inside After Effects 2025
118. Home docked at ~400 px: Value and Speed graphs stacked; drag the speed graph's start up — the value graph follows live, the keys change once on release (one Undo); compare the speed with Graph Editor › Speed. Hover one graph: the other shows the same time line.
119. Alt + wheel over the end of the value graph: ease-in influence changes 1 % per notch and lands on the keys ~0.7 s after the last notch. Check AE does not also react to the wheel (Alt + wheel in CEP).
120. + saves the curve as a picture (no dialog); + again says it already exists; right-click it → ↶ brings it back. Restart AE: saved curves are still there.
121. Align with 3 layers of different widths: Space evenly ↔ (equal gaps, first and last stay), Gap 20 + Space evenly ↕, Key + Align right (the first selected does not move), Alt-click centre (comp), Shift-click top (key). Parented and keyframed layers keep their animation.

### Delay = C4D checklist (v0.12.0) — inside After Effects 2025
114. Even / Blend / Spring on one layer with a fast Position jump: Even = a straight ramp, Blend = fast then slow, Spring = overshoot and settle. Both expression engines (Project Settings › Expressions).
115. Leader + 10 followers, Field on: **MOE Delay Field** appears at the comp centre with Radius / Falloff / Invert; layers near it lag, far ones do not. Move the null over the layers (keyframe it): the delay sweeps with it. Scale the null: the field grows. Invert: swaps.
116. Check every follower's *MOE Delay Leader* still points at the leader and the leader's *MOE Delay Field* points at the null (the null went on top of the stack). Point *MOE Delay Field* at your own layer (no MOE sliders): it still works with default radius 200 / falloff 300.
117. Edit › Undo / History › Restore after a run that created the null: the null is gone. Trash: rig gone, null stays. Scrub / RAM preview speed with 20+ layers and Field on.

### Free drag checklist (v0.11.1) — inside After Effects 2025
113. Select two Position keys. On the kit graph press in the **middle** (not on a handle) and drag right: both influences grow together; drag up: the curve gets steeper. Press in the **right third** and drag up: the end overshoots (Value mode) — AE reports it is not possible on Position (one speed) and says so. Speed mode: start / end drags change only that key's speed; compare with Graph Editor › Speed. One *Edit › Undo* per drag. Note whether the drag feels too fast / slow at ~400 px panel width.

### Delay + speed graph checklist (v0.11.0) — inside After Effects 2025
107. Delay (Spring) on one layer with a Position move: it overshoots and settles; scrubbing stays smooth; AE accepts the expression on both the JavaScript and the Legacy ExtendScript engine (Project Settings › Expressions).
108. Delay with 1 leader + 10 followers (Offset 3 frames): each follower 3 frames later than the one before; render a RAM preview and note the time per frame (the expression simulates up to 300 frames per evaluation).
109. Change the MOE Delay sliders on the leader (Strength / Delay / Stiffness / Damping): every follower updates; keyframe a slider.
110. Trash on the leader and followers: expressions and MOE Delay effects gone; your own effects stay.
111. Speed mode on Position keys: the velocity fields (px/s and %) equal AE's *Keyframe Velocity* dialog for the same keys; on Rotation (°/s) and Opacity (%/s) too.
112. Select 3 keys, turn Pass-through on, apply Out Expo: the middle key has the same speed in and out (Graph Editor › Speed shows no drop to 0).

### Motion Kit checklist (v0.10.0) — inside After Effects 2025
96. The main panel opens on Home with the ease graph and the anchor grid on the first screen (docked ~400 px and wide). *Window › Extensions › MOE Motion Kit* opens the slim kit panel; dock it next to the Timeline at ~280 px. Change a setting in one panel (e.g. Auto off), then use the other: nothing is lost or reset.
97. Select two keys eased by hand in the graph editor: the kit graph shows the same curve within ~1 s and names the layer › property; selecting other keys updates it. Note any delay or flicker (it reads the host once per key-selection change).
98a. Speed mode: drag the out handle sideways and up — AE's own speed graph (Graph Editor › Speed) should show the same influence % and the same speed (× the average) as the live label; Value mode overshoot (Out Back) shows above 100 %; type `cubic-bezier(.16,1,.3,1)` + Enter.
98. Drag a handle and release: the keys change once (one *Edit › Undo*); Shift-drag keeps the handle flat; with Auto off nothing changes until Apply.
99. Preset chip click / Shift-click / Ctrl-click: both / in only / out only on every selected segment (graph editor).
100. Easy Ease, Linear, Hold on In / Both / Out; Copy on one pair of keys, Paste on another layer's keys.
101. Anchor dots on: a plain layer, a scaled + rotated layer, a parented layer, a layer with Position keys, a layer with a keyed anchor, a text layer, a shape layer, a 3D layer rotated in Y, an auto-oriented layer. Nothing should jump at the playhead; motion paths keep their shape. Record the 3D result (probe) and whether the selection stays.
102. Alt-click the bottom-right dot: the layer's bottom-right corner sits on the comp's bottom-right corner (unparented and parented).
103. Align / distribute on parented layers (parent scaled and rotated): edges line up in the viewer; the animation moves as a whole.
104. Tools: Null, Parent (Alt reverse), Excite / Jump / Orbit / Spin / Swing / Wiggle (Effect Controls show MOE sliders with the preset's numbers), Stare (2 layers: the first faces the second; 1 layer: pick in Effect Controls — check that AE accepts the expression, no circular-reference error), Clone keys (Alt mirror), Trim keys, Vignette, Trash (your own expressions stay).
105. Right-click a tool: its options open; changed options run once from there; Toolbox › Pin to Home changes the pinned row on Home; pin a kit tool to the Quick Bar.
106. Performance with 50 selected layers: the kit stays responsive; dimmed tools explain why.

### Ease Curves, Anchor & Align checklist (v0.9.0) — inside After Effects 2025 (items 91–92 superseded by 101)
87. Ease Curve *Out Expo* on two Opacity keys (0 → 100 over 1 s): the graph editor's speed graph shows a fast start and a long tail; out influence ≈ 16 %, in influence ≈ 70 %; one *Edit › Undo MOE: Ease Curve* reverts it; History › Restore reverts it exactly.
88. Same curve on Scale (3 dimensions) and on a joined Position (spatial, one ease): the value graph matches the curve in the panel. Record the speed units AE shows for Position (px/s) — the maths assumes speed along the path.
89. *Out Back* on Opacity overshoots (negative / > 100 % speeds accepted); on joined Position the report says anticipation is limited to 0; on separated X/Y the overshoot works.
90. *Read from keys* on keys eased by hand in the graph editor gives back a curve that, applied again, leaves the eases unchanged (within 0.1 %).
91. Anchor *Bottom* on a scaled (e.g. 50 %) and rotated (30°) solid, a text layer, a shape layer: nothing moves on screen; the anchor sits on the bottom edge. Text: the box comes from `sourceRectAtTime` at the current time — check with a text that changes length over time.
92. Anchor on a layer with Position keys (joined and separated): every key shifts by the same amount; the motion path keeps its shape. A keyframed anchor, a locked layer and a layer with keyed Scale are skipped with a reason.
93. Align left / centre / distribute on 3–5 layers of different sizes (incl. a scaled one): edges / centres line up in the comp viewer; parented layers are skipped; Undo in one step.
94. Clone *Ring × 8* on a shape layer: 7 copies named `MOE Clone n · …`, facing out; Restore deletes exactly those copies and puts the source back. Clone on a keyed layer is refused with a reason.
95. Quick Bar *Align* group and the new pie slots (keys → E Out Expo, W Out Back; one layer → SW Anchor bottom) run the same tools.

### Workspaces & Pie checklist (v0.8.0) — inside After Effects 2025
81. Sidebar: Home + Animate · Design · Layout · Finish · Tools; tabs at the top of each workspace; a workspace reopens its last section; Ctrl 1–6.
82. Click inside the panel, hold Q, point east, release: the eastern slice runs (with keyframes selected: Out Expo curve since v0.9). Note whether AE itself also reacted to Q (it should not while the panel has focus).
83. Tap Q: the pie stays open; 1–8 runs a slice; Esc closes; the centre repeats the last change.
84. Hold the right mouse button on an empty part of the panel, point, release. Right-click on a Quick Bar button still opens its options (not the pie).
85. Select text layers / shape layers / several layers / nothing: the pie slices change accordingly; dimmed slices explain why.
86. Settings › Pie menu › My pie: fill slots, "Start from the smart set", turn Q / right-hold off.

### Workflow checklist (v0.7.0) — inside After Effects 2025, panel docked ~400 px wide
74. Animate: the action bar (preset name + Apply) is visible at the bottom without scrolling; Apply works.
75. Hover a tile → ▶ appears without the tile moving; ▶ applies it. With no shape layer selected, Trim tiles are dimmed and ▶ shows "Select shape layers".
76. After applying, select other layers and press F4 (panel focused) — the same change is applied; the ↻ chip shows its name.
77. Ctrl K → type "pop" → Enter applies Pop In; Shift+Enter only opens it.
78. Sidebar shows the five groups; Settings › Sidebar hides a section; Ctrl 1–9 skips hidden ones.
79. Leave a section and come back: its banner is one line; tiles are compact (3+ columns); thumbnails stay visible after clicks.
80. Compositing: tiles for Analyze / Grade / Look / Match / Key / Green prompt / Import & Key; "setup" tiles open their settings.

### Audit fixes checklist (v0.6.5) — inside After Effects 2025
71. Ctrl K → move the mouse over results → click one: it opens (before: the click was often lost).
72. Text section: every card shows its text at rest, including OUT presets; only the card under the mouse animates.
73. Quick Bar in a narrow panel: the mouse wheel over the bar scrolls it sideways; a failing button shows a red message.

### Copilot checklist (v0.6.4) — inside After Effects 2025, with an API key
69. Select 2+ circle layers → Copilot: "radial clone of these circles" → a plan appears (no "API error 400"); it should propose Grid Builder in Radial mode. Approve → circles arranged on a ring with a MOE Grid null → Roll back.
70. With nothing selected, the same request returns a clarification (what to select), not an error.

### Connection checklist (v0.6.3) — inside After Effects 2025
67. Open the panel: the strip shows the comp name (green dot), not "not connected". If not: Details → Copy report → send (the message names the host file and line).
68. Diagnostics shows AE version, build, ExtendScript version and Host module 0.9.0.

### UI stability checklist (v0.6.2) — inside After Effects 2025
63. Rest the mouse on icons / tiles / sidebar buttons for 10 s: nothing blinks or shakes; the pointer is steady.
64. Click 20 different buttons and tiles at normal speed: every click responds the first time.
65. Diagnostics › Panel performance after 2 minutes of hovering: renders/min low (< 10 when nothing changes in AE), selection read time noted (ms).
66. Scrub the timeline / change selection in AE while the pointer is over the panel: the context strip updates, AE stays responsive.

### Install checklist (v0.6.1) — Windows 11 + AE 2025
55. Run Setup.exe as a normal user: no UAC prompt; SmartScreen "More info › Run anyway" appears (unsigned) — record the wording.
56. AE open during install → "close After Effects" retry message; after closing, install continues.
57. With `tools\install-dev.ps1` installed first: the installer unlinks the junction and the repo folder is intact.
58. AE → Window › Extensions › MOE Motion AI opens; Settings › Updates says "Installed with the MOE installer".
59. Host `dist/latest.json` + Setup.exe on HTTPS (e.g. GitHub Release): Check now → Download & verify → Install when I close AE → quit AE → reopen: new version, settings / presets / API key still there.
60. Install from file… with a downloaded Setup.exe (CEP file dialog opens).
61. Settings › Apps shows one MOE Motion AI entry with the new version; Uninstall asks about data; default keeps it.
62. Run an older Setup over a newer install → downgrade question.

### Premium checklist (v0.6.0)
45. *Window › Extensions*: the MOE panel icon shows (dark and light AE brightness; normal and roll-over).
46. Shapes & Icons: insert 10 icons of different categories (incl. ones with circles / rounded rects / arcs) → compare with the preview; Trim Paths draw-on runs on every path; Solid fills with even-odd holes look right; native shapes stay editable (Polystar Points / Roundness).
47. Shape property match names: confirm `ADBE Vector Stroke Line Cap/Join`, `ADBE Vector Fill Rule`, `ADBE Vector Star Inner/Outer Roundess` resolve in AE 2025 (otherwise the op fails cleanly and lists them).
48. Backgrounds: Gradient Ramp parameter names (Start of Ramp, Start Color, End of Ramp, End Color, Ramp Shape) and 4-Color Gradient points/colours resolve (record any fallback used); Noise "Amount of Noise" resolves; drift loops without jumps.
49. Colorize: cycle / shuffle / blend on 8 mixed layers; Restore returns every colour exactly.
50. Settings › Appearance: Midnight, Light, all 8 accents read well inside AE; Auto follows AE brightness changes live.
51. Sora headings render in CEP (bundled woff2); System falls back cleanly.
52. Splash + What's New appear once after an update, never again; Reduced motion stops thumbnails, banners and sheet animations.
53. My Presets: save, apply by double-click, delete (right-click); export pack file lands in the data folder; import the pack on a second machine.
54. Performance: Shapes grid with 300+ icons and the Backgrounds grid scroll smoothly; idle CPU stays low when tiles are off-screen.

### Studio checklist (v0.5.0)
41. Dock the panel narrow (≈ 320 px) and wide (≈ 900 px): sidebar labels / Inspector beside the library switch at the documented widths; nothing overlaps.
42. Thumbnails animate smoothly with 20+ tiles visible (CEP Chromium 99 canvas); CPU stays low when the panel is hidden.
43. Double-click a tile applies with its preset; the report and Restore appear in the Inspector.
44. Deliver: Create 3 comps from a real key visual; the active comp stays the original during the batch; each copy verified; Restore removes one copy.

### Layout & Speed checklist (v0.4.0)
29. Grid Builder: select 12 layers → Wall / Ring / Galaxy / Globe; preview in the panel matches the comp; change Spacing, Twist, Build in Effect Controls; scrub the Build keys; JavaScript and Legacy expression engines; time per frame with 100+ items.
30. Grid Path mode on a pen-drawn shape layer and on a masked solid; Path Offset animates items along it.
31. Grid Release (layers return exactly) and Freeze (static values, no expressions); History › Restore.
32. Layout Guides: guides appear at the right pixels; View › Snap to Guides; Restore removes exactly the added guides (records the `comp.guides` index base).
33. Resize & Adapt on a real 16:9 key visual with animation: 9:16, 1:1, 4:5 copies; compare motion timing and easing; check backgrounds cover, logo corner, CTA, re-stacked content; Ask Claude with an API key; in-place + Restore.
34. Adapt on a project whose layout lives in one full-frame pre-comp → nested copy is created and swapped in; original pre-comp untouched.
35. Focus Zoom on a screen recording: point and layer, chained zooms pan, end at playhead, motion blur on render; record the Transform effect parameter mapping in the report ("mapping unverified" or not).
36. Follow Zoom on a tracked null; Cursor Animator from a null keyed at click points (arrow and hand).
37. Glass on a rounded rectangle, a text layer and a PNG with alpha; all 7 looks over footage; animate the source (move/scale/rotate) → glass follows; Optics Compensation direction looks like a lens; Restore.
38. Quick Bar: each button once (Reveal folder opens Explorer; Purge; Flip; Parent to Null with keyframed children stays in place; Separate X/Y keeps the graph shape; Reverse / Mirror; Slide in/out; Trim Paths; Typewriter on Arabic; Counter).
39. One-click expressions on Position/Scale/Rotation/Opacity and on keyed properties (loops), with Live controls; JavaScript and Legacy engines.
40. Generate on Green: with an API key, write a prompt for image / video / 3D; generate in your tool; Import & Key a PNG and an MP4 → Keylight chain verified.

### Studio checklist (v0.3.0)
23. Text: apply IN Down to an English and an Arabic text layer at the CTI; compare with your own `Animation_IN_Down.ffx` applied manually (same timing, ease, look). Apply OUT Down → ends at the layer out point.
24. Text: import your 4 `.ffx` files with the upload button; previews appear; Apply → only the selected text layers receive them; selection restored.
25. Brand: create a client, set Arabic/English fonts from the picker (fonts list loads), click a colour with text / shape / solid / an effect colour property selected; Auto fonts on mixed Arabic/English layers → Arabic gets RTL.
26. Proximity: select 10 shape layers → Apply (Grow + Repel) → move `MOE Effector 1` → layers react; change Proximity Radius in Effect Controls; Remove (Whole comp); History › Restore.
27. Proximity on 3D layers with Position Z / Rotation X; check no expression errors with the JavaScript and the Legacy expression engines.
28. Select: counts match your comp; Shift-click adds, Alt-click removes; Back/Forward; scope Project on a large project (record time); label names come from your preferences.

### Compositing checklist (v0.2.0)
15. Analyze Shot on a footage layer: swatches match the frame; no "MOE Probe (temporary)" layer remains; Edit › Undo history shows one "MOE: Analyze (temporary)" entry. Record time taken (Balanced, 1080p and 4K).
16. Grade Neutral: a "MOE Grade" Channel Mixer appears; check in Effect Controls that Red-Red/Green-Green/Blue-Blue = 100 and Const = 0. Verification checks should say "added, 12 param(s)" with **no** "mapping unverified" (confirms English names).
17. Grade Warm/Cool visibly shift the image the right way; re-run updates the same effect; History › Restore removes it.
18. Match Color: foreground over a plate, reference = plate, CTI on a plate frame → "MOE Match" above "MOE Grade"; result visually closer.
19. Screen Key on real green-screen footage: Keylight's Screen Colour equals the screen; Key Cleaner, Advanced Spill Suppressor, Simple Choker (if choke ≠ 0) follow in order; check Simple Choker param 2 really is "Choke Matte".
20. After keying, Analyze shows "keyed subject" and MOE Grade/Match are enabled again afterwards.
21. Look from Words with an API key: suggestion appears, "Use in Grade" fills the Grade form; nothing changes until Apply Grade.
22. Non-English AE UI (if available): Grade still works and checks show "mapping unverified" — record the parameter list from any error.
