# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

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
