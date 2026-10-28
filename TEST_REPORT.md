# Test Report

Last run: 2026-10-28 (v0.13.0), Linux cloud sandbox (Node 22.22.0). **After Effects was not available in this environment.**

## Summary

| Layer | How it was tested | Result |
|---|---|---|
| ExtendScript host ops (`extension/host/*.jsx`) | Real .jsx files executed in a Node `vm` against `tests/mock/ae-mock.js` (AE object model mock written from the Scripting Guide) | 261/261 automated tests pass (incl. `tests/kit.test.js` and the rewritten anchor / align tests in `tests/transform.test.js`) |
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
