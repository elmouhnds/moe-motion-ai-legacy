# Roadmap

## M1 — Foundation ✅ (this milestone, v0.1.0)
- [x] Capability audit, PRD, architecture, UI/UX spec, risk report
- [x] Independent CEP 12 extension skeleton (manifest, panel, installer)
- [x] Read-only host connection: ping, selection context (comp, layers, properties, keys, expressions)
- [x] Tool registry, executor, permissions, history, checkpoints, settings, storage, diagnostics
- [x] Local motion tools: Smart Ease, Stagger Layers (verified by read-back, restorable)
- [x] Expression tools: Apply, Validate (real engine), Inspect, Remove, presets
- [x] Claude client (structured outputs, caching, fallback, retries), cost monitor + budget
- [x] Guided Copilot: plan → validate → approve → run → verify → roll back → save as tool
- [x] Expression Assistant (generate / fix / explain / optimize + diff)
- [x] Tool Factory foundation: data-only recipes, parameters, dry run, offline reruns
- [ ] **Host verification on Windows 11 + AE 2025** ← next action (TEST_REPORT.md checklist)

## M1.5 — Compositing ✅ (v0.2.0)
- [x] Analyze Shot, Grade, Look from Words, Match Color, Screen Key (docs/features/COMPOSITING.md)
- [ ] Host verification (TEST_REPORT.md → Compositing checklist), confirm parameter mappings on AE 2025
- Next in this module: reference **image file** analysis (vision), split-toning / curves via Lumetri once its parameter map is verified in host, light wrap, edge blur, grain match, despill colour from plate

## M1.6 — Studio ✅ (v0.3.0)
- [x] Navigation rail; Text Animation Library (+ `.ffx` import); Brand Kit; Proximity; Select (Moe Selector)
- [ ] Host verification (TEST_REPORT.md → Studio checklist)
- Next: Proximity time-remap (play forward/reverse), glow/drop-shadow/exposure reactions, Look At 3D; per-character 3D text presets; preset favourites and render-accurate previews (rendered thumbnails); brand colour sets for gradients; AI "palette from brief"; installed AI keyer (e.g. CorridorKey) as Screen Key engine via `effects.find`

## M1.7 — Layout & Speed ✅ (v0.4.0)
- [x] Grid Builder (+ guides, place in cells), Resize & Adapt (smart, keyframes kept, Claude layout), Zoom & Focus, Glass, Quick Bar (RKBar set), one-click expressions, Generate on Green (prompt + import & key)
- [ ] Host verification (TEST_REPORT.md → Layout & Speed checklist 29–40)
- Next: ClickZoom Match Cut + 3D camera depth; zoom from markers; click sounds; Glass dispersion (RGB split) and Essential Graphics controls; Grid: per-item time offset (stagger keyframes), hex packing, image-grid from a folder; Adapt: text box reflow (paragraph width / line breaks), batch export of several formats in one click, render-queue hand-off; Quick Bar: Split Text into layers, keyframe nudge/retime; generation provider connectors (Firefly Services, Runway, a local ComfyUI bridge) once you choose one and its API docs are verified; CorridorKey as the keyer when installed

## M1.8 — Studio interface ✅ (v0.5.0)
- [x] Labelled sidebar, visual libraries with Inspector, Deliver board, client card, responsive layout
- Next: Text section in the same library + Inspector pattern with previews on the selected text and client colours; hover-to-preview on the comp (temporary keys, auto-revert); "Apply In + matching Out"; context suggestions on the section home; drag-to-reorder Quick Bar

## M1.9 — Premium ✅ (v0.6.0)
- [x] Shapes & Icons (1,899 icons + 22 native shapes), Backgrounds (32 palettes, gradient / mesh / grain / drift), Colorize, 33 expressions, ease library, Home, My Presets + packs, artwork & banners, appearance (Midnight, 8 accents, reduced motion, Sora), panel icons
- [ ] Host verification (TEST_REPORT.md → Premium checklist 45–54)
- Next: icon morphs (path-to-path), multi-colour icon packs with per-part groups, lower-thirds / callout templates built from shapes + text, Lottie / SVG file import into shapes, pattern backgrounds (grid, dots, stripes), Text section in the library + Inspector pattern, hover-to-preview on the comp

## M1.22 — ★ MOE layout (recommended) ✅ (v0.17.0)
- [x] Menus by object + one Quick Bar + four task tabs (`layouts.moe`), Settings › Panel layout › MOE ★, preview `#moe`
- [ ] Owner approves → make MOE the default for new installs and retire the other layouts (keep Current one release as a fallback)
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → item 131)

## M1.21 — Three panel layouts ✅ (v0.16.0)
- [x] Hub · Command Bar · Workspace as real layouts of the same panel (`app/ui/layouts.js`), Settings › Panel layout, preview links #p1 #p2 #p3
- [ ] Owner picks one (or a mix) after trying them in AE 2025 (TEST_REPORT.md → items 128–130)
- Next: make the chosen layout the default and remove the others; Command Bar: edit bars in place (drag), menus at the mouse (MoBar-style hotkey); Workspace: remember the tab per selection kind

## M1.20 — Smart Home ✅ (v0.15.0)
- [x] Focus card per selection kind (`actions.FOCUS`, `FOCUS_BLOCKS`), stable zones, per-kind folds, Smart / Fixed
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 125–127): how fast the card follows a selection change (it reads on the light poll / panel focus — AE has no selection event)
- Next: learn from use — rows reorder by what you run most for each kind; a precomp / camera / null kind; the dock panel (MOE Motion Kit) follows the selection too

## M1.19 — Per-segment curves + tidier panel ✅ (v0.14.0)
- [x] Segment strip + overview click, `segment` param; foldable blocks; grouped Toolbox; Quick Bar Fit with +N; Utilities
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 122–124)
- Next: apply several segments' curves in one undo step (edit 1, 2, 3 then Apply all); copy a segment's curve to the next; separate X / Y curves; drag to reorder pinned tools and Quick Bar buttons

## M1.18 — Graphs together, icon presets, Align+ ✅ (v0.13.0)
- [x] Value + Speed graphs at once (synced drag + hover), Alt+wheel, Flip, icon-only presets with undo, grouped library; Align rows, Key layer, Space evenly + fixed gap; morph fix for old data-fresh elements
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 118–121)
- Next (suggested): per-segment curves on 3+ keys (click a segment in the overview to edit it alone); separate X / Y / Z curves for multi-dimension properties; drag a preset onto a key in the overview; align to a guide / to the playhead layer's path; distribute along a path or circle; match size (width / height) in Align; preset packs import / export as one file; Quick Bar buttons for saved curves

## M1.17 — Delay matches C4D ✅ (v0.12.0)
- [x] Even / Blend / Spring (C4D modes); Field null (radius, falloff, invert, scale) blending each layer's delay by distance; Offset folded into Strength 0 + frames; enum aliases for saved options
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 114–117) — scrub speed with a field and 20+ layers, both expression engines
- Next: box / linear field shapes (C4D field types), field on Delay *frames* (ripple: more time offset farther away), a field gizmo drawn in the comp (shape layer circle linked to the radius)

## M1.16b — Free drag on the ease graph ✅ (v0.11.1)
- [x] Motion 4-style zone drag (start / both / end) in Value and Speed mode, relative to the press, hover hints, live sliders + velocity fields
- [ ] Confirm feel inside AE 2025 (TEST_REPORT.md → item 113)
- Next: optional *Cmd/Ctrl-drag in the middle = asymmetric* (move the two sides apart), a per-user drag sensitivity setting

## M1.16 — Delay + speed graph ✅ (v0.11.0)
- [x] C4D MoGraph-style Delay (spring / blend / offset; own animation or followers); speed graph in real units, velocity fields, whole-animation overview, pass-through
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → v0.11.0 checklist 107–112) — Delay scrub speed with 20+ followers, units vs AE's Graph Editor
- Next: Delay with a falloff field (strength by distance from a null, like MoGraph fields), Delay on any keyed property (not only transform), per-dimension speed fields for separated / non-spatial multi-dimension properties, click a segment in the overview to select its keys in AE

## M1.15 — Motion Kit ✅ (v0.10.0)
- [x] Study of Motion 4 / Flow / Motion Tools / anchor tools (docs/features/MOTION_KIT.md); v0.9 tile sections replaced by one compact kit; auto-read ease graph with apply-on-release; anchor grid with Alt placement; align row; 18 one-click tools; dockable kit panel
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → v0.10.0 checklist 96–106) — especially the second panel, auto-read speed, 3D anchor probe
- Next (from the study): Motion 4 *Workflows* that stay open (Timeline scrub, Composition settings), Delay / Falloff rigs, Text Break (letters / words / lines to layers), Pin+ (puppet pins to nulls), per-modifier presets on any kit button (Motion Studio), KBar export of kit actions, curve libraries import / export (JSON)

## M1.14 — Ease Curves, Anchor & Align ✅ (v0.9.0) — superseded by M1.15
- [x] Bézier ease-curve editor with speed graph, 32 curves, read from keys; Anchor 9 points without a jump; Align & Distribute; Clone ring / fan / row / grid; section, Quick Bar group, pie slots
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → v0.9.0 checklist 87–95) — especially speeds on Position vs Scale and anchors on text layers
- Next: per-dimension curves for separated properties in one pass, a curve that follows several keys (multi-segment "flow" across a whole move), clone along a path, align to a key layer, anchor to a custom point (click on a preview)

## M1.13 — Workspaces & Pie menu ✅ (v0.8.0)
- [x] Home + five workspaces with section tabs; Pie menu (Q / right-hold / header), smart slices by selection, My pie; Home suggestions
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → v0.8.0 checklist 81–86) — especially Q and right-hold while the panel has focus
- Next: a global shortcut outside the panel needs a script or KBar-style launcher that sends a CEP event to the panel (PlugPlugExternalObject `CSXSEvent`) — to be verified in AE before promising it

## M1.12 — Faster workflow ✅ (v0.7.0)
- [x] All 12 UX audit recommendations (action bar, ▶, readiness, F4 repeat, preset search, grouped sidebar + hide, Compositing library, banners once, compact tiles, 24 px targets, Home for returning users, Quick Bar editor)
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → v0.7.0 checklist 74–80)
- Next: drag to reorder sidebar sections; per-tile keyboard numbers (1–9 apply favourites)

## M1.11 — UX audit ✅ (v0.6.5)
- [x] Click-every-button audit tool; 7 UI bugs fixed (docs/UX_AUDIT.md)
- [x] Owner approved all recommendations → shipped in v0.7.0

## M1.10c — Copilot fix ✅ (v0.6.4)
- [x] Compact plan schema (fixes API 400 "compiled grammar is too large"), local args validation unchanged, size guard test
- [ ] Confirm with a real API key inside AE (TEST_REPORT.md → Copilot checklist 69–70)
- Next: "Clone to count" in Grid Builder (duplicate one selected layer N times, then arrange) so "radial clone of a circle" works from a single layer

## M1.10b — Stability fix ✅ (v0.6.2)
- [x] In-place rendering, click guard, adaptive polling, no moving hover styles, Calm motion, stress test
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → UI stability checklist 63–66)

## M1.10 — Distribution ✅ (v0.6.1)
- [x] Windows installer with in-place updates, legacy cleanup and uninstall; Settings › Updates (verified download, install on AE close); `npm run release`
- [ ] Verify on Windows 11 + AE 2025 (TEST_REPORT.md → Install checklist 55–62)
- Next: code-signing certificate (removes the SmartScreen warning; then a signed ZXP for Adobe's installer too), Ed25519 signature on the feed in addition to SHA-256, macOS .pkg if AE on Mac is ever needed, a hosted feed (GitHub Releases) once the repo has a remote

## M2 — Motion Director depth
- ~~Visual ease graph editor (bezier handles → speed/influence), read current ease from selection~~ → v0.9.0
- Keyframe timing tools: retime, scale around playhead, snap keys to whole frames, reverse
- Overshoot / bounce generator (baked keys and expression variants)
- Copy / paste motion (ease + relative timing) between properties and layers
- Choreography: stagger by position, distance from a layer, or a curve; stagger keyframes (not only layers)
- Save user presets per tool from the Copilot

## M3 — Expression Engineer + Tool Factory depth
- Expression controllers: add Slider/Point/Checkbox controls and wire expressions to them (new host op, permission `modify.effects`)
- Link properties (pick-whip style), repair broken layer/effect references after renames
- Multi-property expression systems (procedural rigs)
- Tool Factory: test recipes on a disposable scratch comp (new op, explicit permission), export/import recipes
- Recipe parameters for Copilot-saved plans

## M4 — Productization
- ZXP signing + installer, update channel, version compatibility checks at startup
- Keyboard shortcut registration (`registerKeyEventsInterest`), panel flyout menu
- Performance profiling on large comps (1000+ layers)
- UXP host adapter spike once AE UXP is public (CEP retirement end of 2029)
