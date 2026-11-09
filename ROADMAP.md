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
- [x] Shapes & Icons (1,899 icons + 22 native shapes), Backgrounds (36 palettes, gradient / mesh / grain / drift), Colorize, 33 expressions, ease library, Home, My Presets + packs, artwork & banners, appearance (Midnight, 8 accents, reduced motion, Sora), panel icons
- [ ] Host verification (TEST_REPORT.md → Premium checklist 45–54)
- Next: icon morphs (path-to-path), multi-colour icon packs with per-part groups, lower-thirds / callout templates built from shapes + text, Lottie / SVG file import into shapes, pattern backgrounds (grid, dots, stripes), Text section in the library + Inspector pattern, hover-to-preview on the comp

## M1.78 — Control pages ✅ (v0.72.0)
- Move · Text · Design · Look · Deliver, squares of real tiles, pick + one Apply.

## M1.77 — Control layout ✅ (v0.71.0)
- Head, hero, tune block, Move / Add, folded Motion Control, Libraries row, thin Mix, icon rail.

## M1.76 — Control style ✅ (v0.70.0)
- A Control Center for motion: squares that are the tools, the Mix, one Apply (docs/features/CONTROL_STYLE.md).

## M1.75 — Glass with the sidebar ✅ (v0.69.0)
- Glass takes MOE's sidebar; NOW and narrow Anchor spacing fixed.

## M1.74 — Look & Feel ✅ (v0.68.0)
- Background Composer, frosted Glass, no banners in MOE (docs/features/LOOK_AND_FEEL.md).

## M1.73 — Smart Layer ✅ (v0.67.0)
- Foresight in cards, Hover Cards, Layer Reader (Edit / Remove one), Marker Trigger, Marker In / Out, Beat Markers (docs/features/SMART_LAYER.md).

## M1.72 — Tool Cards ✅ (v0.66.0)
- Every tool explains itself before it runs (card contract); expressions as a grouped list that follows the selection; Live Stagger, Marker Pulse. Next ideas: docs/research/SMART_TOOLS_STUDY.md §4.

## M1.71 — Installer redesign ✅ (v0.65.1)
- Dark installer matching the panel; status + After Effects detection on the welcome page; read-back check after copying; Open After Effects on finish.

## M1.70 — Workspaces: tabs in the order of the work ✅ (v0.65.0)
- MOE tabs Animate · Timing · Layer · Design · Look · Deliver; the full graph only in Timing, the one-row Motion Bar elsewhere (docs/features/WORKSPACES.md).

## M1.69 — Wave 4: Decode, Exploder, Depth Reveal ✅ (v0.64.0)
- Every wave of the reference plan is built except Figma import (needs a Figma token + network: the owner's decision).

## M1.68 — Progress + Stop, Wipe Reveal, Carousel 3D ✅ (v0.63.0)
- Every study KPI met (on the mock); wave 3 of the reference plan complete. 

## M1.67 — Rename-safe links ✅ (v0.62.0)
- Permanent layer ids in every MOE expression link; automatic Relink after a rename. Next: Progress + Stop for long runs, Grid clones in one call, Carousel 3D.

## M1.66 — Engine 2 ✅ (v0.61.0)
- One Ctrl+Z per run, keys on the frame grid, constant host round trips, locked layers never changed (from the owner's AE study). Next: Progress + Stop, Carousel 3D.

## M1.65 — SaaS Interaction ✅ (v0.60.0)
- Click on Layer (measured centres, press in place), UI Reveal by screen order, product backdrops (wave 3 of the reference plan). Next: Carousel 3D, Wipe Reveal.

## M1.64 — Styles + Shakes ✅ (v0.59.0)
- Shakes as real keys (wave 2 of the reference plan) and Styles from native effects.

## M1.63 — Apple Motion ✅ (v0.58.0)
- Blur on entrances, Native curves, Hero text presets (wave 1 of the reference plan).

## Next (from docs/research/REFERENCE_PLUGINS.md — the owner's two references)
1. Apple Motion: Apple curves set, Blur on entrances, Hero Reveal / Word Stagger + blur / Burst / Iris / Elastic text, Blur In-Out and Whip Pan.
2. Styles + Shakes: Soft Shadow, Glow, Hairline, Inner Highlight, Light Sweep, Chrome, Liquid Color; Bump, Zoom Punch, Whip, Slam, Jitter as real keys.
3. SaaS Interaction: Click on Layer, UI Reveal by screen position, Carousel 3D, product backdrops, Wipe Reveal.
4. Later: Depth Reveal, Scramble / Exploder text, Figma import.

## M1.62 — Product UI ✅ (v0.57.0)
- Eight UI pieces on the Templates engine (`design/uiKit.js`); texts above shapes fixed for every template.
- Next ideas: soft shadows, a cursor that clicks the button, device frames, more pieces (pricing, tab bar, slider, toast).
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.61 — Smart controls ✅ (v0.56.0)
- Every number scrubs (shared `scrub.js`), sliders reset on double-click; the principle is a standing rule.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.60 — Hidden sliders ✅ (v0.55.0)
- Keyframe Velocity numbers scrub sideways (Shift ×10, Ctrl fine), the graph follows live, release applies.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.59 — No cut names ✅ (v0.54.0)
- Names wrap instead of "…" across the panel; the MOE sidebar is wide only with room; `tools/audit-cut.js` (126 screens, 0).
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.58 — Guides menu + anchor pad ✅ (v0.53.0)
- Guides sidebar menu with composition lines, TV safe and social safe zones; Parent icon fixed (+ icon test); anchor pad redesigned.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.57 — Auto-fit Templates ✅ (v0.52.0)
- Template text is measured in After Effects and shrunk to its safe width (≥ 40 % of the design size); shapes follow; previews too.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.56 — Branded Templates ✅ (v0.51.0)
- Templates use the active client's primary colour, best-reading text colour and fonts; previews too.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.55 — More Templates + Exit ✅ (v0.50.0)
- Quote, End Card, Social Handle, Chapter (+ Arabic); Hold → exit on every template.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.54 — Native Templates ✅ (v0.49.0)
- Lower Third / Title Card / Callout / Tag (+ Arabic): real layers sized to the measured text, one null, keyed entrance, live previews; Self-Test checks.
- Next: the owner's Self-Test report from AE 2025 (now with the template checks) → fixes first; more templates on the same plan (quote, end card, social frame).

## M1.53 — Combined Moves ✅ (v0.48.0)
- Also fade / From / to / Angle on Quick Animate; 12 combined presets with real previews (Animate 45).
- Next: native templates (v0.49).

## M1.52 — Real Previews ✅ (v0.47.0)
- Animate / Trim previews play the tool's real keys; live Inspector preview + key strip.
- Next (premium, owner): bigger libraries (v0.48), native templates (v0.49).

## M1.51 — Select Modifiers + Sidebar Menus ✅ (v0.46.0)
- Shift adds / Alt removes on every Select button (Home, MOE menu, sidebar, Quick Bar).
- MOE sidebar menus under Select: Parent & Link, In / Out, Loop (one job each, rule tested).
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.50 — No Repeats ✅ (v0.45.0)
- One button per job on a screen: MOE sidebar menus that were the tabs / Assistant / search again removed (Select stays); NOW without copies; audit + test.
- Next: the owner's Self-Test report from AE 2025 → fixes first.

## M1.49 — Find Fast ✅ (v0.44.0)
- Select out front, text animators on Home, buttons in Ctrl+K (Arabic too), no shared names (tested).
- Next: the owner's Self-Test report from AE 2025 → fixes first; Shift / Alt (add / remove) on the Select buttons.

## M1.48 — Smart Arrange ✅ (v0.43.0)
- Families of tools kept together everywhere (engine + data + on-screen audit at 4 widths).
- Next: the owner's Self-Test report from AE 2025 → fixes first; then more families as tools are added.

## M1.47 — Bake to Keyframes ✅ (v0.42.0)
- Grid / cloner / trail / any MOE rig → keyframes over the work area, smart keys, restorable; a Self-Test check with the bake time.
- Next: the owner's Self-Test report from AE 2025 (now 16 checks) → fixes first.

## M1.46 — Clone Trails ✅ (v0.41.0)
- Echo / Ghost / Spin Trail: copies replaying an animated layer's motion later, live on one null; a Self-Test check.
- Next: the owner's Self-Test report from AE 2025 → fixes; then Bake (grid / trail → keyframes for heavy scenes).

## M1.45 — Self-Test inside After Effects ✅ (v0.40.0)
- Diagnostics › Check in After Effects: 14 checks with real-host numbers, cleanup in finally, copyable report.
- Next: the owner runs it in AE 2025 and sends the report → fix whatever it shows; then Clone Trails / Bake.

## M1.44 — Live Preview ✅ (v0.39.0)
- Drag-the-null preview for every Effector (same maths as AE), Points / In Place in the Grid Builder preview.
- Next: the self-test inside After Effects (Diagnostics › Check in After Effects) — real-host numbers for v0.33–v0.39.

## M1.43 — Field Effectors ✅ (v0.38.0)
- Noise Field and Image falloffs on every effector; tiles Noise Grow, Noise Flicker, Image Grow, Image Reveal.
- Next (same direction): Clone Trails (each clone echoes the one before) · Bake a grid to keyframes for heavy scenes.

## M1.42 — Object & Text Cloner ✅ (v0.37.0)
- Points layout (clones on a shape's points, Point Offset) and In Place + Split text (one layer per word / letter where it was; Arabic by words). Tiles Clone on Points, Text Cloner, Letters Rise.
- Next (same direction): shader-like Field effectors (noise / image map) · Clone Trails (each clone echoes the one before) · Grid → keyframes bake for heavy scenes.

## M1.41 — Target & Audio Effectors ✅ (v0.36.0)
- Target (clones face the null) and Audio (moves follow a soundtrack, Convert Audio to Keyframes) as effector types; tiles Aim, Look Near, Beat Pulse, Beat Wave.
- Next (same direction): object cloner (clones on a shape's points) · text cloner (one clone per word / letter).

## M1.40 — Spring / Inertia Effector ✅ (v0.35.0)
- Spring %, Frequency, Decay on every MOE Effector (overshoot + settle, or a smooth lag at 0 Hz); tiles Spring Grow, Jelly, Inertia, Bounce Up.
- Next (same direction): target effector (clones look at a null) · audio effector · object / text cloner.

## M1.39 — Clone Colours ✅ (v0.34.0)
- Palette over clones (Cycle / Gradient / Random, live on the grid null) + effector Colour / Colour Mix (Tint).
- Next (same direction): spring / inertia effector · target effector · audio effector · object / text cloner.

## M1.38 — Cloner + Effectors ✅ (v0.33.0) — advanced tools for pro results
- Cloner on the MOE Grid engine; MOE Effector nulls (Plain / Random / Step / Noise / Delay × Sphere / Linear / Box / Everywhere), three per grid, live.
- Next (same direction): colour effector / per-clone colour · spring / inertia effector · target effector · audio effector · object / text cloner (onto path points or letters).

## M1.37 — Library pages ✅ (v0.32.0)
- Inspector beside the tiles from 600 px, under the clicked row when narrower (libraries + Shapes); Motion / Layout modes; icon tools as rows; one-line filters; columns that fit; compact Quick Bar customize.
- Next: remember the open settings per page; the same inline settings in Text.

## M1.36 — Space follows content, every tab ✅ (v0.31.0)
- 25 → 15 groups: Animate In / Out / Draw On one block, Keyframes & Loops, Key & Color, Deliver & Project; Motion Rigs merged (Sliders switch); no Motion Control repeats; Motion Control compact without keys; tile grids fit their count; empty Recent hidden.
- Next: the library pages (Motion, Expressions, Compositing…) with the same rule — filters as the In / Out switch, Inspector beside the tiles on a wide panel.

## M1.35 — Motion Control ✅ (v0.30.0)
- Graph + anchor + align in one block sized by content, on top of every style; Ease Copy (per segment, any property); Next steps after each run.
- Next: copy / paste spatial (Position path) handles; Next learned from your own sequences (local, opt-in).

## M1.34 — Fewer, clearer ✅ (v0.29.0)
- One place per tool: Quick Bar 80 → 41 own actions (presets are the tiles themselves), rigs without expression copies, 4 duplicate preset tiles out, retired styles and Smart Home removed (~1,360 lines), anchor half width in NOW.
- Next: measure real use (local, opt-in counts) to decide the next things to fold away.

## M1.33 — Organised the way you work + Assistant ✅ (v0.28.0)
- Home by distance = frequency: Everyday (Alt+1…0) → NOW + format chip → Power tools (explained until learned) → stages Animate · Arrange · Design · Finish · Deliver (rare groups behind *More*) → search.
- Floating Assistant: ask + do (Claude answers and plans with MOE tools, approval + verify), offline word → tool matching (Arabic / English), quiet suggestions.
- Many projects: comp format chip, comp-sized social safe area, each AE project remembers its client.
- Next: per-stage personal order (drag), voice-free "explain this panel" tour from the Assistant, Assistant answers grounded in the AE scripting / help docs when the network allows.

## M1.32 — Thick Glass (Glaze-class) ✅ (v0.27.0)
- [x] `glass.thick` / `glass.thickLook`: thick refractive glass from a live height map (pre-comp linked to the source by expressions), CC Glass refraction, frost, dispersion, reflection / chrome, studio highlights, shadow, caustics, 7 looks, one glass for several layers (docs/features/THICK_GLASS.md)
- [ ] Inside AE 2025: CC Glass parameter names and shading, precision on real logos / text, render time (TEST_REPORT 162–166)
- Next: bevel profiles (round / flat / sharp via a Map choke + blur chain), an environment-image reflection slot (any layer as the studio), animated light sweep preset, glass text animator (per-word glass), "Refresh map" for shapes that gained new groups

## M1.31 — Brand in action ✅ (v0.26.0)
- [x] Apply Whole Brand (selection / whole comp), active client, brand backgrounds, brand ease; drag to reorder sidebar shortcuts and NOW pins (docs/features/BRAND_IN_ACTION.md)
- [ ] Inside AE 2025 on real client comps (TEST_REPORT 159–161)
- Next: brand-aware presets (lower thirds / titles built from the brand fonts and colours), "rebrand" a finished comp to another client (map old colours → new by role), brand check (find off-brand colours / fonts in a comp), per-client motion defaults for Animate In / Out durations

## M1.30 — Three styles + Brand from website / PDF ✅ (v0.25.0)
- [x] Bento (default) · Glass · MOE; MOE sidebar with every shortcut; upgrades for each (docs/features/STYLES_V2.md)
- [x] Brand from website / PDF via the Claude API (docs/features/BRAND_IMPORT.md)
- [ ] Inside AE 2025 with real client sites and brand books (TEST_REPORT 154–158)
- Next: ~~apply a brand to a whole comp, brand backgrounds, brand ease, drag in NOW / sidebar~~ (v0.26)

## M1.29 — New style (proposals) ✅ (v0.24.0) — owner kept Bento, Glass, MOE in v0.25
- [x] Glass, Apple and Bento built live in the panel, timed on ten tasks (docs/features/STYLE_PROPOSALS.md)
- [ ] Owner picks one → it becomes final, the other two are retired; library pages, Settings and the Motion Kit panel get the same style
- [ ] Inside AE 2025: blur performance (Glass), scaling 100 / 150 % (TEST_REPORT items 151–153)

## M1.28 — Design system ✅ (v0.23.0)
- [x] Measured the six tabs; tokens for sizes / icons / radii / type / elevation; importance tiers; Lucide for generic icons; restyled actions, rigs, links, tiles, menus, tabs (docs/features/DESIGN_SYSTEM.md)
- [ ] Owner checks it inside AE 2025 at 100 % and 150 % Windows scaling (TEST_REPORT.md → items 148–150)
- Next: the same pass on the library pages (Inspector, action bar), Settings and the Motion Kit panel; per-tool importance learned from your own use (shown in Recent only, never moving buttons)

## M1.27 — Classic groups: your order, Recent, keyboard ✅ (v0.22.0)
- [x] Drag / Alt+↑↓ to reorder groups (saved per tab, Reset in ▾), ▸ Recent per tab (fixed-height row, last six), keyboard navigation of group headers
- [ ] Owner tries it inside AE 2025 (TEST_REPORT.md → items 145–147)
- Next: remove the retired layouts' code (Hub / Command Bar / Workspace), pin a Recent item to the Quick Bar (right-click), hide a group you never use (▾ › Show groups)

## M1.26 — Final layout ✅ (v0.21.0)
- [x] Six layouts measured, Classic and MOE ★ developed and timed on 12 tasks, Classic chosen (docs/features/FINAL_LAYOUT.md); tab ▾ quick menus, Ctrl 1…6; proposal layouts retired from the lists
- [ ] Owner tries it inside AE 2025 (TEST_REPORT.md → items 142–144)
- Next: ~~drag groups, Recent, keyboard~~ (v0.22); remove the retired layouts' code after one release

## M1.25 — Classic layout (organised like AE) ✅ (v0.20.0)
- [x] AE-named tabs, twirl-down groups, inline search, ≡ panel menu, one-click tiles, smart dots / auto-open (docs/features/AE_CLASSIC_LAYOUT.md)
- [ ] Owner tries it inside AE 2025 (TEST_REPORT.md → items 139–141)
- Next: drag groups to reorder within a tab (saved), a ▸ Recent group per tab, keyboard navigation of groups (↑/↓, ←/→ to twirl)

## M1.24 — Grid Builder 2 ✅ (v0.19.0)
- [x] Live Layout switch, Morph, Orient, Effector rotate / fade / attract, editable items, Grid Items, "Your grid" panel (docs/features/GRID_BUILDER_2.md)
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 135–138), both expression engines
- Next: add / remove items from an existing grid; a per-grid pseudo effect (one tidy effect instead of ~40 controls, via a bundled .ffx); Face Camera for 3D (auto-orient); morph between two settings of the same layout (e.g. 3 → 6 columns)

## M1.23 — Moving backgrounds ✅ (v0.18.0)
- [x] 6 point motions + 4 colour moves, seamless loops, 3 live sliders, live preview (`features/design/bgMotion.js`)
- [ ] Confirm inside AE 2025 (TEST_REPORT.md → items 132–134)
- Next: motion on the palette tiles themselves (hover = moving), a "Follow" motion where a null drags a colour point, noise-based grain flicker speed, save a moving background as My Preset with its motion

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
