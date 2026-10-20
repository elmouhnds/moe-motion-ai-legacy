# Test Report

Last run: 2026-10-20 (v0.6.0), Linux cloud sandbox (Node 22.22.0). **After Effects was not available in this environment.**

## Summary

| Layer | How it was tested | Result |
|---|---|---|
| ExtendScript host ops (`extension/host/*.jsx`) | Real .jsx files executed in a Node `vm` against `tests/mock/ae-mock.js` (AE object model mock written from the Scripting Guide) | 190/190 automated tests pass (156 behaviour + 34 UI module loads) |
| ES3 compatibility of host files | `npm run lint:jsx` — parses with acorn `ecmaVersion: 3`, rejects ES5+ runtime APIs | Pass (14 files) |
| Core (registry, schema, permissions, executor, storage, logger, bridge) | Unit + integration tests | Pass |
| Claude integration | Mocked HTTPS responder: request shape, retries, refusal, truncation, 401, offline, budget | Pass — **no real API call was made** |
| Panel UI | Browser preview (`dev/preview.html`) with the real UI code + real host .jsx on the mock; Playwright clicks through 49 scenarios (wide 900 px and narrow 380/280 px), incl. 19 v0.6 Premium screens; zero page/console errors | Pass — **not the CEP runtime** |
| Colour contrast | `tools/check-contrast.js`, WCAG — 3 themes (dark, midnight, light) × 8 accents, 93 pairs | Pass |
| **Inside After Effects 2025** | — | **Not run yet** |

What the mock proves: our logic, argument handling, ES3 syntax, undo-group balance, verification and restore paths.
What it does not prove: real AE behaviour (timing of `expressionError`, selection order, CEP loading, Node in CEP, DPAPI, network from AE).

## Automated tests (npm test)

- ✅ Request shape: structured output, cached system prompt, fallback, key only in header
- ✅ System prompt is deterministic (prompt-cache friendly)
- ✅ Plan schema only allows AI-callable tools
- ✅ Copilot: plan validated → approved → executed → verified → rolled back
- ✅ Copilot: hallucinated tools and bad args are rejected before approval
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

## UI preview scenarios (node tools/screenshot.js)
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
