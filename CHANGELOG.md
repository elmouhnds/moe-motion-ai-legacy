# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

## [0.12.0] — 2026-10-28 — Delay matches Cinema 4D: Even · Blend · Spring + Field
Requested by the product owner after comparing with C4D's MoGraph Delay effector.
### Changed
- **Delay modes are now C4D's: Even · Blend · Spring** (was Spring · Blend · Offset).
  - **Even** (new): follows at an even speed — a moving average over a window, so a jump becomes a straight ramp. Strength sets the window (same average lag as Blend at the same Strength: 70 % ≈ 6 frames, 80 % = 9).
  - **Blend**: fast first, then settles slowly (unchanged maths).
  - **Spring**: overshoots and settles (unchanged).
  - **Offset is gone as a mode**: Even or Blend with Strength 0 plus *Delay* frames gives the same pure time offset. Options saved by 0.11 with "Offset" open as Even instead of failing (new enum `aliases` in the parameter schema).
### Added
- **Field (null)** — like a field on a C4D effector. Right-click Delay → *Field (null)*: creates (or reuses) a null **MOE Delay Field** at the comp centre with **MOE Delay Field Radius / Falloff / Invert**. Each layer's delay is blended with its undelayed motion by its weight: full inside the radius, smoothly none beyond radius + falloff (comp XY distance, every frame). Move the null to sweep the effect across the layers; scale the null to scale the field; keyframe the sliders. The **MOE Delay Field** Layer Control on the leader / each layer picks the field layer — any layer works, empty = no field.
- Undo / Restore removes a field null the run created; Trash removes the rig but never deletes a layer (delete the null yourself).
### Fixed
- The Delay frames unit no longer clips in the options sheet ("fr").
### Tests
- New: Even ramp (equal steps, arrives), Blend decelerates, "offset" alias; Field near / far / falloff weights, invert, null scale, moving the null swaps who is delayed, Layer Controls still point at the right layers after the null is added on top, the null is reused not duplicated, restore removes it. 258 tests pass. Preview: Delay with Field ran on the Title comp (6 properties, null created), no JS errors. **Not yet run inside After Effects.**

## [0.11.1] — 2026-10-27 — Free drag on the ease graph (Motion 4)
Requested by the product owner: "I don't want to control it from two sticks — I want to control it freely with the mouse in the middle of the graph, like Motion 4."
### Changed
- **Ease graph: press anywhere and drag** (Value and Speed mode), like Motion 4's Home graph. Where you press decides what moves: **left third = the start** (ease out), **right third = the end** (ease in), **middle = both together, mirrored** (a symmetric ease stays symmetric). Sideways = influence (how long it eases); up / down = the curve's shape at that side (Value: up at the end = overshoot; in the middle = steeper / snappier) or the speed at the key (Speed mode). The curve follows the mouse *relative to the press* — no jump on click. **Shift = fine** (¼ speed), **Ctrl = snap**. Hovering shows the zone and what it does; dragging the middle shows *Out % · In %* (with px/s in Speed mode). Commits on release as before (one undo step).
- Handles can still be grabbed directly (within ~14 px) for exact placement; double-click resets, arrows nudge, Enter applies.
- The Out / In sliders and the Keyframe Velocity fields now follow a drag live (they used to update on release).
### Tests
- `kit graph: free drag (Motion 4)` — zones, relative movement, mirrored middle, overshoot, legal range, speed-mode speeds never negative. 256 tests pass. Checked in the web preview with Playwright (hover, start / middle / end drags, Speed mode): no JS errors. **Not yet tried inside After Effects.**

## [0.11.0] — 2026-10-27 — Delay (C4D MoGraph) and a deeper speed graph
Requested by the product owner: improve the speed graph further, and a Delay like Cinema 4D's MoGraph.
### Added
- **Delay** (`kit.delay`, kit button + pinned on Home): the Cinema 4D MoGraph Delay effector for layers. **Spring** (overshoots and settles — Stiffness, Damping), **Blend** (smooth lag — Strength), **Offset** (pure time delay). One layer: its *own* keyframed Position / Rotation / Scale gets the delay (instant follow-through on any move). Several layers: the first selected leads and the others perform its motion on top of their own place and animation, each **Delay** frames × its order later — like clones under a Delay effector. Live, keyframeable `MOE Delay …` sliders in Effect Controls (on the leader, or on each layer); expressions tagged `// MOE Delay`; Trash removes the rig; Alt-click = Blend. The expression simulates frame by frame over a short window (≤ 300 frames) and is checked against a reference implementation in the tests.
- **Speed graph, real units**: the average line, the live label and new **velocity fields** show AE's Graph Editor units (px/s for Position, °/s for Rotation, %/s for Scale / Opacity) — type the outgoing / incoming speed and influence like AE's *Keyframe Velocity* dialog, Enter applies.
- **Whole-animation overview** (3+ keys): the speed of the entire selected animation over real time, with the new curve on every segment — see stops and jumps before applying.
- **Pass-through** (3+ keys): the speed flows through the middle keys (both sides get the speed of the line between the neighbours) instead of stopping at each key.
### Changed
- Kit segmented controls are 24 px tall (minimum target); clicking the source line with no keys selected explains what to select (found by the 0.10.0 click audit: 3,112 clicks, 0 JS errors).

## [0.10.0] — 2026-10-27 — Motion Kit (rebuilt after studying Motion 4 and Flow)
The product owner judged the v0.9 tools not useful, badly placed and badly designed, and asked us to study the real tools first. The study, the critique of v0.9 and the design are in `docs/features/MOTION_KIT.md`.
### Added
- **Home is the motion toolkit** (Motion 4 Home): the panel opens on the ease graph, the anchor grid, align and your **pinned tools**, every control acting on the selection in one click — no tiles, no Apply bar. Wide panels put Ease on the left and Anchor / Align / Pinned tools on the right, all above the fold; docked panels show Ease, Anchor and Align on the first screen. Recent, Favorites and the rest of Home follow below.
- **Toolbox** (sidebar, Ctrl 2): all 18 tools, **Pin to Home** (choose what Home shows) and the whole curve library.
  - **Ease graph** (rebuilt after the owner's "better interface and control" note): **Value / Speed** switch — Speed mode works like AE's speed graph (handle sideways = influence, up / down = speed at the key, 1× = average); a **spacing chart** with a moving ball under the graph; the keys' current curve stays as a dashed **ghost** while you edit; a live label next to the handle (*Out 32 % · speed 4.83×*); the graph **zooms out to show overshoot / anticipation**; **type or paste** the numbers (`0.16, 1, 0.3, 1` or `cubic-bezier(…)`); Ctrl = snap to the grid, Shift = flat handle, double-click = reset the handle, arrows nudge the last handle (Shift ×5), Enter applies; drag the strip under the graph to resize it. A full-width value graph It **reads the selected keys' curve by itself** when the key selection changes (like Motion 4's Live Poll / Flow's Read) and names the source; drag a handle and the curve **lands on the keys when you let go** (Auto; one undo step; Shift-drag = flat handle); Out / In influence sliders; mirror handles; In / Both / Out; **Easy Ease · Linear · Hold · Copy · Paste**; 15 preset chips that **apply on click** (Shift = ease in only, Ctrl = ease out only, the matching preset lights up); *All* opens the 32-curve library; *+* saves your own curve.
  - **Anchor**: 3 × 3 dots — click = anchor there, the layer does not move; **Alt-click = also place the layer at that point of the comp**; *Masks* uses the mask box.
  - **Align**: left · centre · right · top · middle · bottom · distribute ↔ ↕, to the selection or the comp; the whole animation moves.
  - **Tools** (Motion 4 Toolbox; 8 pinned on Home by default): Null · Parent chain (Alt: reverse) · Excite · Jump · Orbit · Spin · Swing · Wiggle · Stare · Clone keys (Alt: mirror) · Reverse · Stagger · Trim to keys · Separate · Trim path · Repeat (radial clone) · Vignette · Trash. Right-click = options; dimmed with the reason when the selection cannot run them; all pinnable to the Quick Bar (group *Kit*).
- **Dockable Motion Kit panel**: *Window › Extensions › MOE Motion Kit* — the kit on its own, slim (280 px), to dock next to the Timeline. Same tools, settings and history as the main panel.
- New tools: `kit.interp` (Linear / Hold / Bezier per side), `kit.trimToKeys`, `kit.parent` (chain in selection order), `kit.stare` (face a target layer via a Layer Control), `kit.vignette`, `kit.trash` (removes MOE-tagged expressions and MOE effects only). Ease Curve gains *ease in only / ease out only*.
### Changed
- **Anchor Point** no longer refuses common cases: keyframed anchors shift on every key; animated scale / rotation are compensated at the playhead (and the report says so); 3D-rotated and auto-oriented layers are measured with AE's own `toWorld` / `fromWorld` through a temporary probe (removed, selection kept); parented layers work.
- **Align & Distribute** now moves parented layers too (the comp-space move is turned into the parent's space).
- The v0.9 *Ease Curves* and *Anchor & Align* tile sections are gone — their tools live in the Motion Kit; pie slots point to the kit actions.
- The two panels can share one data folder safely: the store notices when the other panel rewrote a file, and settings re-read before saving (no more overwriting each other's changes).
### Fixed
- Quick Bar expression buttons used the form's generic numbers instead of the preset's own (e.g. *Inertia Bounce* got Amount 30 instead of 0.06 — a wild overshoot). They now carry the preset's numbers.

## [0.9.0] — 2026-10-27 — Ease Curves, Anchor & Align (Motion-4-style tools)
Requested by the product owner: anchor point by position, speed-graph curve control, and more Motion-4-like tools.
### Added
- **Ease Curve** (`motion.easeCurve`, new section *Animate › Ease Curves*): a value-graph editor with two draggable Bézier handles and a live speed graph underneath. The curve is turned into exact AE temporal ease on every segment between selected keyframes (out influence = x1·100 %, out speed = y1/x1 × average speed; in influence = (1−x2)·100 %, in speed = (1−y2)/(1−x2) × average speed), per dimension for Scale / Rotation / Opacity, along the path for Position. Hold sides are kept. **Read from keys** loads the curve already on two keyframes; the CSS `cubic-bezier()` can be copied. 32 preset curves: Basic, In / Out / In-Out (sine → expo, circ, back), and Motion (snap, glide, punch, swoosh, settle). Verified by reading every key's ease back; restore puts the previous eases back exactly.
- **Anchor Point** (`transform.anchor`): move the anchor to any of 9 points of the layer's content box (3 × 3 picker and 9 tiles) without a visual jump — position compensates for scale and rotation; keyed position (incl. separated X/Y) is shifted on every key. Skips locked layers, a keyframed anchor, animated scale / rotation and 3D-rotated layers, each with a reason.
- **Align & Distribute** (`transform.align`): left / centre / right / top / middle / bottom to the selection or the comp, distribute horizontally / vertically (3+ layers) by measured bounds; keyed positions shift on every key. Parented layers are skipped.
- **Clone** (`transform.clone`): duplicate one layer into a ring (facing out or not), a fan / arc, a row with rotation / scale / opacity steps, or a grid. Copies are named `MOE Clone n · <layer>`; restore deletes them and puts the source back.
- Section **Anchor & Align** in the Layout workspace (24 tiles), Quick Bar group **Align** (anchor TL / centre / bottom, align, distribute, centre in comp) and two curve buttons (Out Expo, Out Back).
- Pie: keyframes → Out Expo curve and Out Back (overshoot) curve; one shape → Clone ring; several shapes / layers → Distribute H, Centre V; one layer → Anchor bottom.
- `keyframes.read` now returns each key's value (needed to turn a curve into speeds).
### Changed
- "Select at most 1 layers" now reads "Select only one layer".
### Notes
- Position cannot store a negative speed in AE, so back / anticipation curves on a joined Position are limited to 0 speed (the report says so). Separate X/Y first for a full back curve.

## [0.8.0] — 2026-10-26 — Workspaces and Pie menu
Requested by the product owner: a smarter, simpler arrangement for fast access, and a pie menu.
### Added
- **Pie menu**: hold **Q** (or the right mouse button) over the panel, point toward an action, release. Tap Q (or the header button) to keep it open; 1–8 choose, arrows + Enter, Esc closes; the centre repeats the last change. Slices that cannot run on the selection are dimmed and explain why (the tool's own readiness check). Works while the panel has keyboard focus.
- **Smart slices**: the eight actions follow the selection — keyframes (eases, loops, reverse, mirror, stagger), text (typewriter, rise, slide, counter…), one shape (draw / travel / erase, pop, wiggle…), several shapes (draw on, grid, ring, cascade… — e.g. clone circles around a ring), several layers (cascade, grid, ring, parent to null, pre-compose…), one layer, or nothing selected (search, shapes, backgrounds, guides, Copilot…). Positions never move inside a set, so direction becomes muscle memory; opposites face each other (In ↔ Out, Draw ↔ Erase).
- **My pie** (Settings › Pie menu): eight slots of your choice from every tile, Quick Bar action, section and command; "Start from the smart set"; Q and right-hold can be turned off.
- **Five workspaces**: the sidebar is Home + Animate (Motion · Text · Expressions) · Design (Shapes & Icons · Backgrounds · Looks & Glass · Brand) · Layout (Layout & Grid · Zoom & Focus · Deliver) · Finish (Compositing) · Tools (Quick Bar · Select · My Tools) — 6 buttons instead of 15. Sections show as tabs at the top; each workspace reopens the section used last. Ctrl 1–6 = Home + workspaces.
- **Home › For this selection**: the same eight actions as the smart pie, as one-click buttons.
### Changed
- Section "Animate" is now **Motion** (inside the Animate workspace); "Tools" is **My Tools** (inside Tools).
- `npm run stress` scrolls a target into view before clicking it (Home is taller now).
### Fixed
- With the side Inspector (wide panel), its last buttons (Restore, Dismiss) could sit under the sticky Apply bar; the Inspector now stops above the bar (found by the click audit).

## [0.7.0] — 2026-10-23 — Faster workflow (UX audit recommendations)
All twelve recommendations of `docs/UX_AUDIT.md`, approved by the product owner.
### Added
- **Sticky action bar** in every library section and in Text: the selected preset, what it will do on the current selection, and Apply — one click from any scroll position (Apply was up to 2,900 px down in a docked panel).
- **▶ on every tile** (hover) — apply in one click; double-click still works.
- **Tile readiness**: tiles the selection cannot run are dimmed with the tool's own reason (same check as Run: requirements + prepare); ▶ explains instead of failing. "Setup" tiles (look description, reference layer, file) open their settings.
- **Repeat last (F4)** and a ↻ chip in the selection line: re-run the last successful change on the current selection.
- **Search applies presets**: Ctrl K finds library and text presets, ranked by name; Enter applies, Shift+Enter opens only.
- **Grouped sidebar**: Animate (Animate, Text, Expressions) · Design (Shapes & Icons, Backgrounds, Looks & Glass, Brand) · Layout (Layout & Grid, Zoom & Focus, Deliver) · Finish (Compositing) · Utilities (Quick Bar, Select, Tools). Settings › Sidebar hides sections; Ctrl 1–9 follows what is visible.
- **Compositing is a library** (one tile per tool, incl. green-screen prompt and import & key) with Inspector and action bar.
- **Banners once**: the full section intro shows on the first visit, then a one-line title (ⓘ brings it back; Settings › Show intros again).
- **Compact tiles** (Settings › Appearance › Tiles; Auto = compact under 520 px): 3–4 columns in a docked panel (8 → 15+ tiles on screen).
- **Home for returning users**: one-line greeting, then Recent and Favorites before "Start with".
- Quick section is now the **Quick Bar** editor; "Reset bar" is disabled (with a reason) when the bar is already the default, and confirms when it resets.
### Changed
- 24 px minimum targets: segmented controls 28 px, mini segments 24 px, switches 36 × 22, colour swatches 22 × 22.
### Fixed
- **Thumbnails went blank after the first re-render** (since v0.6.2): the in-place update removed a kept canvas's width/height, which clears it, and Calm tiles are not redrawn. Kept canvases now keep their size. Test added.
- A hovered thumbnail froze on its last moving frame when the mouse left; it now returns to the still frame.
### Dev
- `npm run preview:web` (`tools/build-web-preview.js`): one self-contained HTML file with the real panel code and real host scripts on the AE mock — runs without a server and without eval (host JSON reader swapped for `JSON.parse`; expressions are not evaluated where a page forbids eval, and the page says so). Published as the live preview for the product owner.
- `npm run audit`: the click-every-button audit and its summary.

## [0.6.5] — 2026-10-23 — Click-every-button audit
Requested by the product owner: test every button and suggest improvements. Report: `docs/UX_AUDIT.md`.
### Added
- `tools/audit-ui.js` + `tools/audit-summary.js`: clicks every button, tab, chip and tile in every view (and the controls that appear after a click), double-clicks every tile, checks layout at 340–900 px. 2,495 interactions in the preview: 0 JavaScript errors, 0 unreachable controls, 0 unnamed controls.
### Fixed
- Search (Ctrl K): mouse clicks on results were lost — hovering redrew the list and replaced the row under the pointer. Hover now only moves the highlight.
- Animated thumbnails: the first paint drew a random moment and overwrote the still frame, so in Calm motion Text "OUT" cards were blank and some tiles froze mid-move.
- Text previews ignored Settings › Motion and animated all 27 cards forever; they now follow Calm / Full / Off like every other preview.
- Quick Bar results are coloured by outcome (error / blocked / done) instead of all neutral.
- Search "Go to…" listed old section names and missed nine sections; it is now generated from the sidebar.
- The mouse wheel scrolls the Quick Bar sideways in narrow panels (11 of 26 buttons were off-screen).
- Tools banner text no longer promises a full tool list.
- Preview fixture layers have the Transform properties every AE layer has (dev only).

## [0.6.4] — 2026-10-21 — Fix: Copilot "compiled grammar is too large"
Reported by the product owner: every Copilot request (e.g. "radial clone of circle shapes") failed with *Claude API error 400: The compiled grammar is too large… Simplify your tool schemas*.
### Fixed
- **Cause**: the plan's structured-output schema had one strict variant per AI-callable tool (`anyOf` of 42 objects, each with its full parameter schema — 37.6 KB, 85 objects). The API compiles the schema into a grammar and refused it as too large. It grew with every tool added in v0.4–v0.6; the tests used a mocked API, so nothing caught it.
- **Fix**: the plan schema now pins only the tool id (`enum` of the 42 ids); each step's arguments travel as `args_json` (a JSON object string) described by the tool catalog in the system prompt — the pattern Tool Factory already used. 1.6 KB, 2 objects, no `anyOf`. Safety is unchanged: arguments are parsed and re-validated locally against the tool's own schema (unknown keys, types, ranges, options) before anything can be approved, and broken JSON is shown as a step error.
### Added
- Tests: the plan schema stays compact (< 4 KB, no `anyOf`/`oneOf`, every object closed) as the catalog grows; `args_json` parsing (truncated JSON, arrays, unknown keys refused; defaults filled).

## [0.6.3] — 2026-10-21 — Fix: "After Effects not connected"
Reported by the product owner: the panel always showed "After Effects not connected".
### Fixed
- **Likely root cause**: `host/ops/expressions.jsx` used `final` as an object key. `final` is an ES3 *future reserved word*; Node (which runs our host tests) accepts it, ExtendScript (an ES3 engine) can refuse the whole file — and one host file failing to load means the panel never connects. Renamed to `finalState` (JS readers updated). The ES3 linter ran with `allowReserved: true`, so it never checked this.
- All host `.jsx` files are now pure ASCII (non-ASCII only in comments and two strings, now `\u` escapes): ExtendScript may read source in the Windows code page.
### Added
- Linter: AST check for every ES3 keyword / future reserved word as identifier, object key or dot-property; non-ASCII check; more ES5+ API patterns (`Date.now`, `.bind`, `.includes`, `Math.hypot`, `Map`…). All 14 host files pass.
- The host loader names the file and line that failed (`host/ops/x.jsx line N: …`); test proves it.
- The context strip shows the reason next to "After Effects not connected", with **Details** (Diagnostics + Copy report) and Reconnect; Home shows a connection card; automatic retries at 2 s, 5 s, 10 s and 20 s after a failed start.

## [0.6.2] — 2026-10-20 — Fix: flicker, trembling icons and ignored clicks
Reported by the product owner inside After Effects: moving the mouse over icons made them blink and tremble, the pointer shook, and buttons did not respond.
### Fixed
- **Clicks ignored**: every state change rebuilt the whole panel, so a background refresh between mouse-down and mouse-up replaced the button and the click was lost. The panel now **updates the DOM in place** (`dom.morph`): elements on screen are kept, only what changed is touched; handlers are swapped onto the kept elements. Renders are coalesced per tick and **never run while a button is pressed** (they run right after the click).
- **Trembling icon under the mouse**: hover styles moved tiles up 1–2 px, so at an edge the tile left the pointer, lost hover, came back, and so on. No hover or press style moves or resizes anything any more (border / shadow / brightness only).
- **Blinking**: full rebuilds restarted every thumbnail and illustration. Kept elements keep animating; thumbnails are keyed by recipe.
- **Load on After Effects**: selection polling ran every 1.5 s on AE's main thread while the pointer was over the panel; now ≥ 2.5 s, adaptive to AE's answer time (×12, up to 10 s), paused during and right after clicks/typing and when the panel is hidden; focus refreshes throttled; unchanged state no longer renders; repeated host errors render once.
- **Motion "Calm" (new default)**: only the tile under the mouse and the Inspector preview animate, at most 30 fps; illustrations hold a finished frame. "Full" and "Off" remain in Settings › Appearance. Existing installs move from "Full" to "Calm" once.
- Removed `backdrop-filter` and the logo's `drop-shadow` filter (costly in CEP).
### Added
- `npm run stress` (`tools/stress-ui.js`): AE-like stress in Chromium (slow host 250 ms + a selection that changes on every read). Before the fix: the element under the mouse was replaced in all views, 12–14 of 20 slow clicks registered, 22–24 hover flips at a tile edge, 5–18 % idle load. After: 0 swaps, 20/20 clicks, 0 flips, 1–4 % idle.
- `tests/ui-stability.test.js` (jsdom): in-place updates keep the hovered element and run current handlers; keyed/form/canvas replacement rules; no-op state changes don't render; CSS guard against moving hover styles and `backdrop-filter`.
- Diagnostics › Panel performance: renders, deferred renders, selection reads and read time (included in Copy report).

## [0.6.1] — 2026-10-20 — Easy install & in-place updates
### Added
- **Windows installer** (`installer/moe-motion-ai.nsi`, NSIS 3, 64-bit, per-user, no admin): installs to one fixed folder named after the bundle id (`%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai`), wiped and rewritten on every install; removes older manual MOE copies (same bundle id only; developer junctions are unlinked, never followed); sets `PlayerDebugMode` for CSXS 12; one *Settings › Apps* entry with version, icon and uninstaller; asks to close After Effects; asks before a downgrade; English + Arabic; `/S` silent and `/WAITAE` (wait for AE to quit, then install silently). Uninstall keeps your data unless you say otherwise.
- **Settings › Updates**: installed version and install type (installer / developer link / manual copy), update feed URL, check on start (≤ twice a day), **Check now → Download & verify (size + SHA-256) → Install when I close After Effects / Install now**, **Install from file…**; header **Update** pill when a newer version exists. `core/updater.js` validates the feed (format, product id, semver, HTTPS-only, .exe, size cap, hash) and deletes any download that does not match.
- Platform: HTTPS-only downloader with redirect limit and size cap, streaming SHA-256, detached launch, install detection (`install.json` written by the installer).
- **`npm run release`** (`tools/build-release.js`): checks that all five version strings agree, runs `npm run check`, stages the extension without the `.debug` remote-debugging file, builds `Setup.exe`, a portable zip and the `latest.json` feed (notes from this CHANGELOG).
- Installer artwork (icon, welcome sidebar) built by `tools/build-panel-icons.js`; `INSTALL.md` (Arabic + English).
- Tests: `tests/updater.test.js` (feed validation, verified / rejected downloads, launch modes, install detection, real HTTPS download with redirect through a local self-signed server, release-script version check). The installer was run under Wine 9: install, legacy cleanup, in-place update, wait-for-AE, uninstall.

## [0.6.0] — 2026-10-20 — Premium: content libraries, artwork, appearance
Requested by the product owner: "saturate the plugin with icons, images and extras — premium, high value, professional".
### Added
- **Shapes & Icons** section: **1,899 vector icons** (Lucide 1.60, ISC licence — `extension/assets/icons/LICENSE-lucide.txt`) in 18 categories with search by name/tag, featured first, ★ starred icons, paging, copy SVG; **22 native shapes** (Rectangle / Ellipse / Polystar: square, rounded, card, pill, bar, circle, oval, ring, triangle, soft triangle, diamond, pentagon, hexagon, octagon, star, soft star, star 6, sparkle, burst, seal, flower, blob) that stay parametric in AE. Live Inspector preview of style, colour and animation.
- **`design.insertShape`**: icon → editable Bézier paths (`features/design/svgShape.js`: full SVG path parser — M L H V C S Q T A Z, relative/absolute, compact arc flags — plus circle, ellipse, rect incl. rounded, line, polyline, polygon; arcs split into ≤ 90° cubics). Styles Line / Solid / Both / Duotone, colour + fill colour, size, auto line width, round caps/joins, even-odd fill; **Draw** (MOE Trim end 0 → 100), **Pop** (overshoot) or **Fade** at the playhead. Layer `MOE Icon • …` / `MOE Shape • …`; read-back of paths, stroke, fill and keys; Restore removes the layer.
- **Backgrounds** section: **32 curated palettes** (`features/design/palettes.js`) as tiles with real gradient thumbnails. **`design.background`**: `MOE Background` at the bottom of the comp — linear / radial Gradient Ramp (angle, spread), **4-Colour mesh**, or flat — optional **film grain** (Noise) and **slow drift** (tagged `// MOE Background` expressions). Palette panel: copy hex, **Colorize selection**, **Save as client** (Brand Kit), **Use in Shapes**.
- **`design.colorize`**: colour the selection from a palette — cycle, shuffle (seeded) or blend in selection order; text / shapes / footage (`MOE Palette Fill`); verified per target; restorable.
- **Expressions: 33 presets** (16 new — Bounce Land, Squash & Stretch, Orbit, Swing, Heartbeat, Breathe, Wiggle Rotation, Wiggle Scale, Organic Wiggle, Loop Wiggle, Drift, Clock Ticks, Face Motion, Random Scatter, Auto Pop-In, Auto Slide-In), new **Auto** filter, a one-line explanation per preset, 16 new icons and preview curves.
- **Animate: 37 tiles** — 6 new animations (Rise In, Drop In, Cascade In, Cascade Fade, Soft Pop, Pop/Spin Out) and an **Ease** filter with 8 curve tiles (Gentle, Smooth, Snappy, Expo, Decelerate, Hard Stop, Accelerate, Launch). **NEW** badges on everything added in 0.6.
- **Home**: greeting, library stats, quick actions, the active comp card, 6 illustrated quick starts, Recent tools, Favorites, tip of the day.
- **My Presets**: ⧉ in any Inspector saves the current settings as your own tile (filter **Mine**, right-click to delete); **preset packs** export (data folder + clipboard) / import (validated against each tool's schema; unknown tools skipped) — `core/presetPacks.js`.
- **Artwork**: MOE logo mark; an animated, theme-aware illustration per section (`app/ui/art.js`) used in **section banners** (hideable), Home and empty states; splash screen; **What's New**, **About** and **Keyboard & mouse** sheets.
- **Appearance** (Settings): theme Auto (follows AE) / Dark / **Midnight** / Light, **8 accent colours**, Motion Full / Reduced, Headings **Sora** (OFL, bundled) / System, banners and splash toggles. All 93 theme × accent pairs pass WCAG (`tools/check-contrast.js`).
- **Colour fields** with picker, hex and quick swatches (active client first) — Shapes, Glass tint, Cursor colour.
- Status toasts (✓ / ✕ / !), header What's New dot and Shortcuts, Ctrl + 1…9 section jump, `?` shortcuts sheet, Esc closes sheets.
- **Panel icons** for *Window › Extensions* (`extension/icons/`, manifest `<Icons>`), built by `tools/build-panel-icons.js`.
- Host op `shapes.insert` (`host/ops/design.jsx`); `layers.createSolid` gains `bottom`.
- Mock: Rectangle / Polystar shapes, fill rule, line cap/join, `moveToEnd`, Gradient Ramp, 4-Color Gradient, Noise.
- Tests: `tests/design.test.js` (converter, every icon, every primitive, insert/draw/duotone/restore, backgrounds, colorize), `tests/premium-ui.test.js` (packs, appearance, artwork, banners, expressions); 190 tests; 49 preview scenarios.
### Changed
- Library tiles carry their preset's own numbers (Expressions used the form's generic defaults before).
- Changing a filter selects the first visible tile when the current one is hidden.
- Thumbnails off-screen are not redrawn; Reduced motion draws them once.
- Default section for new installs: Home.

## [0.5.0] — 2026-10-20 — Studio interface (concept B)
Chosen by the product owner from two UI concepts (canvas "MOE Motion AI — UI Concepts").
### Added
- **Studio layout**: labelled sidebar by creative purpose — Animate · Text · Layout & Grid · Looks & Glass · Zoom & Focus · Expressions · Compositing · Deliver, then Quick · Select · Brand · Tools, the active **client card** (Brand Kit colours) and Favorites / History / Settings.
- **Visual library + Inspector** for Animate (24 tiles), Layout & Grid (15), Looks & Glass (7), Zoom & Focus (8) and Expressions (17): animated canvas thumbnails, filter chips, search, click = inspect (the tool's own form, preview widget, Apply, verification report, Restore), double-click = apply now, ★ pin. "All tools" tab keeps every tool of the section; Expressions keeps its Editor tab.
- **Deliver board**: every format at once (9:16, 1:1, 4:5, 16:9, 4K, 2:3, 1.91:1, 21:9, 3:1, custom) — the comp is measured once, each format is planned locally and drawn before/after; per-format role/zone overrides; Refine with Claude per format; **Create N comps** runs Resize & Adapt per format (each verified, each restorable); "Single format" tab for the classic tool.
- Responsive: labelled sidebar from 600 px, Inspector beside the library from 760 px; narrower docks get the icon sidebar and the Inspector under the tiles.
- Theme-aware thumbnails (light AE brightness).
- Tests: `tests/studio-ui.test.js` (every tile → registered tool with valid preset args; every tool has a sidebar home; thumbnails draw). 163 tests; 30 preview scenarios (wide 900 px + narrow 380/280 px).
### Changed
- Old view ids still work (`motion` → Animate). Command search and "open tool" land on the tool's section (tile selected, or All tools).
- Compositing lists its tools without Glass (now in Looks & Glass).

## [0.4.0] — 2026-10-20 — Layout & Speed: Grid, Resize & Adapt, Zoom, Glass, Quick Bar
Design: `docs/features/STUDIO_v0.4.md`.
### Added
- **Layout** section. **Grid Builder** (Grid Builder-style, extended): one `MOE Grid N` null with Expression Controls and Dropdown menus; modes Grid, Radial, Spiral, Sunflower, Path, Sphere; order rows / columns / snake / seeded random; row offset (honeycomb); twist, scale step, random position/rotation/scale; **Build** animation (Pop, Fade, Rise, Pop + Fade, Drop, Spin In × Index, Reverse, Center Out, Edges In, Random; stagger) with optional keys; built-in **Effector**; auto spacing / columns / radius from measured layer sizes; live canvas preview using the same maths as the expressions; **Grid Controls** (live), **Release / Freeze**. **Layout Guides** (columns, rows, gutters, margins → composition guides) and **Place in Cells** (keeps keyframes).
- **Resize & Adapt** (CompResizer-style + responsive): Fit / Fill / Keep / **Smart** layout (background cover, pinned corners, bands, content re-stacked when the orientation flips, safe margins, nested layout pre-comps adapted inside a copy). Every keyframe kept (values, spatial tangents, ease speeds re-mapped) or `MOE Adapt` rig nulls. New comp by default; measured read-back; plan preview with per-layer role/zone overrides; **Ask Claude** layout suggestion (names, text and boxes only).
- **Zoom & Focus** (ClickZoom-style): **Focus Zoom** on a point (map picker) or the selected layer (auto level), zoom in / hold / out, 4 eases, chained zooms pan, end at playhead, motion blur, spotlight dim — all on one `MOE Zoom` rig; **Follow Zoom** (smoothed, edge-clamped expression); **Cursor Animator** (arrow / hand, travel + hold, click pulse, ripple ring, fade-out) from a keyed null.
- **Glass** (Glasser-style): liquid / frosted glass from native effects on shapes, text, footage or pre-comps; 7 looks; tint from the Brand Kit; rim light, tint and shadow layers linked to the source; every amount on `MOE Glass N`; **Glass Look**.
- **Quick Bar** (RKBar-style) in every section + **Quick** section (pin to bar, right-click for options): Reveal in Project / Folder / Open pre-comp, Purge cache, Duplicate comp (deep), Flip H/V, Parent to Null, Pre-compose, Center Anchor, Separate X/Y keeping easing, Select Same Property, Reverse keyframes, Mirror / Clone keys at the playhead, Smart Ease, Slide in/out (4 directions, off-screen or by distance, overshoot, stagger), Fade in/out, Scale up/down, Spin in, Trim Paths (draw / erase / travel / draw + erase), Typewriter (Arabic → words), Number Counter.
- **One-click expressions** with icons: Wiggle, Wiggle X, Wiggle Y, Step Wiggle, Blinker, Flicker, Auto Fade, Loop Cycle, Ping-Pong, Loop Offset, Loop In + Out, Time Rotation, Pendulum, Pulse, Float, Inertia Bounce, Stop Motion — natural target property per preset, optional live Slider controls.
- **Generate on Green**: Claude writes a production prompt for your image / video / 3D generator; the chroma-green (#00B140) rules and negative prompt are enforced locally whatever the AI writes; **Import & Key** imports the result at the playhead, fits it and runs the Screen Key chain.
- Host ops (`layout.jsx`, `fx.jsx`, `quick.jsx`): `layers.bounds`, `layers.describe`, `transform.remap/restore`, `layers.setParent`, `adapt.apply`, `adapt.restoreInPlace`, `comps.remove`, `guides.set`, `paths.find`, `props.values`, `props.bake/unbake`, `layers.createAdjustment`, `layers.createSolid`, `layers.duplicateLinked`, `layers.setAttrs`, `layers.setMatte`, `layers.move`, `masks.ellipse`, `keys.write/list/remove`, `shapes.cursor`, `effects.setMenu`, `footage.importToComp/remove`, `project.reveal`, `app.purge`, `comps.deepDuplicate`, `layers.flip`, `layers.parentToNull/unparentFromNull`, `layers.precompose`, `position.separate`, `props.select`, `keys.reverse/rebuild/mirror`, `shapes.trim/untrim`.
- UI: tool widgets (`app/ui/widgets.js`), `renderBody` hook, `hidden` / `showIf` params, 50 new icons.
- Mock: expression runtime (`tests/mock/ae-expr.js`) that evaluates MOE's generated expressions (toComp/fromComp, effects, paths, vector maths); masks, shapes, solids, parenting, track mattes, 3D toggle, comp duplicate, guides, import, pre-compose, separated dimensions; linear key interpolation.
- Tests: 156 (132 behaviour + 24 UI module loads); 41 preview scenarios.
### Changed
- `layers.createNull` accepts `anchor`, `threeD`, `undoLabel` (backward compatible).
- Tool search ranks word-start matches higher.
- Rail: Quick · Motion · Text · Brand · Layout · Select · Expressions · Comp · Tools.

## [0.3.0] — 2026-10-20 — Studio: Text, Brand, Proximity, Select
Design: `docs/features/STUDIO_v0.3.md`.
### Added
- **Left navigation rail**: Motion · Text · Brand · Select · Expressions · Comp · Tools, plus Favorites · History · Settings.
- **Text Animation Library**: 27 presets with live canvas previews (In/Out, groups, EN/Arabic sample), including the owner's 4 presets reproduced from their decoded `.ffx` values plus 23 new ones. Apply as an editable `MOE In` / `MOE Out` Text Animator (duration, distance, direction, based-on, timing; Out ends at the layer out point). Arabic text automatically switches character presets to Words.
- **`.ffx` import**: read-only RIFX parser (animator, range selector, properties, keyframes, time base) for previews; imported presets are applied through After Effects' own `applyPreset`, only on the intended text layers, and the selection is restored afterwards.
- **Brand Kit**: clients with palettes and Arabic/English fonts. Click a colour to apply it to selected colour properties, text fill/stroke, shape fill/stroke, or a `MOE Brand Fill` effect on footage and solids (shared solid sources are never changed). Auto fonts give Arabic text the Arabic font with RTL paragraphs. Includes palette extraction from a selected layer, JSON import/export and an installed-font picker (`app.fonts`).
- **Proximity** (ProximityPro-style): effector null with 13 Expression Controls; 15 reactions (scale up/down, push/pull, X/Y/Z, rotation X/Y/Z, look-at, fade/reveal, blur, colour shift) combined into one expression per property using `add/sub/mul`; user expressions protected; Remove (selected/all); Center Anchor.
- **Select** (port of Moe Selector v5): 18 layer types with counts, Shift/Alt modes, enabled/unlocked filters, search, select-same, labels, all/invert/clear, back/forward history, solo/visibility/lock/shy, and comp/selected-comps/project scope.
- Host ops: `fonts.list`, `text.setStyle`, `text.applyAnimator`, `text.removeAnimator`, `text.applyFfx`, `props.colorTargets`, `props.setValues`, `layers.createNull`, `layers.centerAnchor`, `layers.restoreTransform`, `layers.remove`, `layers.list`, `layers.setSelection`, `layers.setSwitch`, `labels.get`, `effects.find`, `expressions.peek`, `proximity.scan`.
- Copilot context now includes client brands, text preset ids and text-layer contents; the new tools are AI-callable.
- Tests: 116 (including module-load checks for every UI file).
### Changed
- Property addresses may omit indices and use `name:<display name>` entries.
- `context.get` returns text-layer contents (first 300 characters).
### Fixed (caught during development)
- FFX keyframe influence offsets and nested `Utf8` name chunk.
- Duplicate identifier in the shell that blanked the panel (now caught by UI module tests).

## [0.2.0] — 2026-10-19 — Compositing module
### Added
- **Comp** workspace (`features/compositing/`): Analyze Shot, Grade, Look from Words (Claude), Match Color, Screen Key. Design: `docs/features/COMPOSITING.md`.
- Host ops `pixels.sample` (expression `sampleImage` via a temporary probe, read with `valueAtTime`), `effects.ensure` (add/update named MOE effects, self-rollback on failure), `effects.restore`.
- `context.get` now also returns `compLayers` (name/index/type/in/out, capped 300), per-selected-layer `effects`, `width/height`, and `project.bitsPerChannel` (all additive).
- Permission scope `modify.effects` (default Allow; Copilot still always asks).
- Schema param type `layer` (layer picker in the UI, integer in AI schemas).
- Tool hook `ui.renderResult` (custom result views) and `app.prefillTool` (fill a tool's settings without running it).
- Host bridge: optional per-call timeout (`call(op, args, { timeoutMs })`).
- Mock host: effect stack, null layers, layer removal, expression evaluation with `sampleImage`, post-effect keying/colour simulation.
### Changed
- Host module 0.2.0. Diagnostics moved from the header into Settings (and the command palette) so the header fits four workspaces.
- Header switches to compact automatically when it overflows (fonts/locales differ).
- Sliders now shown for numeric ranges up to 400 units (was 100).
### Fixed (caught during development)
- Parameter fallback mapping could write to the wrong Channel Mixer parameter if the effect's layout differed; fallbacks now require the exact expected parameter count.
- Colour matching a keyed layer measured the green screen; keyed layers are now measured after the key with MOE Grade/Match bypassed, and unkeyed screens are refused.

## [0.1.0] — 2026-10-19 — Foundation milestone
### Added
- CEP 12 extension for After Effects 2025 (`AEFT [25.0,99.9]`), Node-enabled mixed context, dev installer (`tools/install-dev.ps1`).
- ExtendScript host module with named ops only (`host.ping`, `context.get`, `keyframes.read/applyEase/restoreEase`, `layers.setStartTimes`, `expressions.set/validate`), strict JSON, matchName-verified property addressing, comp-change guard, undo groups.
- Core: tool registry with contract validation, executor (validate → context → permission → prepare → execute → verify → checkpoint → history), permissions (user/agent/recipe origins), storage in `%APPDATA%\MOE Motion AI`, settings, logger with secret scrubbing.
- Tools: Smart Ease, Stagger Layers, Apply/Validate/Inspect/Remove Expression, Expression Assistant.
- Claude integration: structured outputs, prompt caching, server-side refusal fallback, retries, cost monitor with monthly budget, DPAPI key storage.
- Guided Copilot with typed plans, local validation, approval, verified execution, rollback, save-as-tool.
- Tool Factory foundation: data-only recipes with parameters, validation, dry run, offline reruns.
- Panel UI: Motion / Expressions / Tools workspaces, Favorites, History, Settings, Diagnostics, command palette, compact/wide layouts, AE theme sync (dark/light), WCAG-checked tokens.
- Tests: 56 automated tests (real host .jsx against an AE mock), ES3 lint, contrast check, browser preview harness + screenshots.

### Fixed (during development, caught by tests)
- Registry accepted a mutating tool with no recovery strategy when `recovery` was omitted.
- Logger secret scrubber replaced keys with the match offset instead of a redaction marker.
