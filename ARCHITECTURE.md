# Architecture

## 1. Decision summary

| Question | Decision | Why |
|---|---|---|
| Extension technology | **CEP 12 panel + ExtendScript** | The only documented, shipping extensibility path for dockable HTML panels in AE 2025. UXP is not available in AE 2025 (see docs/CAPABILITY_AUDIT.md). |
| Node usage | CEP built-in Node.js 17.7.1 (`--enable-nodejs --mixed-context`) | File storage, HTTPS to Claude, DPAPI via PowerShell — no extra process. |
| Helper process | **None** | Not justified yet. CEP Node covers storage, network and secrets. Revisit only for heavy local compute. |
| Claude access | Raw HTTPS from the panel's Node context | `@anthropic-ai/sdk` needs a newer Node than CEP 12 ships; no global `fetch` in Node 17. |
| Secret storage | Windows DPAPI (CurrentUser) via built-in PowerShell 5.1 | No native modules to compile; key never in frontend source or settings. |
| UI | Vanilla JS + small DOM helpers, CommonJS modules | Fast in CEP, no build step, every module testable in Node. |
| Pixel analysis | Expression `sampleImage` on a temporary probe, read via `Property.valueAtTime()` | Scripting has no pixel API; `valueAtTime` officially waits for `sampleImage` (AE 13.6+). Local, no AI. |

## 2. Layers

```
┌──────────────────────── CEP panel (Chromium 99 + Node 17, mixed context) ───────────────────────┐
│  app/ui/*            Workspaces, tool blocks, Copilot sheet, palette, settings, diagnostics      │
│        │ (only calls services)                                                                   │
│  core/services.js    Composition root                                                            │
│   ├─ registry.js     Tool definitions (validated at startup)                                     │
│   ├─ executor.js     validate → context → requirements → permission → prepare → execute → verify │
│   │                  → checkpoint → history                                                      │
│   ├─ permissions.js  scopes × origins (user | agent | recipe) → allow | confirm | deny           │
│   ├─ context.js      declarative requirements vs. selection snapshot                             │
│   ├─ storage.js      JSON docs + JSONL logs in %APPDATA%\MOE Motion AI                           │
│   ├─ settings.js, logger.js (secret scrubbing)                                                   │
│   ├─ ai/client.js    Claude Messages API (structured outputs, caching, fallback, retries)        │
│   ├─ ai/cost.js      price table, session/month totals, budget gate                              │
│   ├─ ai/contextPack.js  compact selection-only context                                           │
│   ├─ ai/planner.js   Copilot: plan → local validation → run → rollback                           │
│   └─ host/bridge.js  serialized evalScript, MOE_dispatch only, ASCII-escaped JSON args           │
│  features/           motion/*, expressions/*, compositing/*, toolfactory/recipes.js              │
│  core/platform/node.js  fs, https, DPAPI secrets                                                 │
└───────────────────────────────────────────┬──────────────────────────────────────────────────────┘
                                            │ CSInterface.evalScript("MOE_dispatch(op, json)")
┌───────────────────────────────────────────▼──────────────────────────────────────────────────────┐
│ ExtendScript (ES3) host/                                                                          │
│   index.jsx       loads modules, defines MOE_dispatch, wraps results in {ok,data|error,ms}       │
│   lib/json.jsx    strict JSON (regex-validated parse)                                             │
│   lib/util.jsx    addressing + matchName verification, undo helper, enums                         │
│   ops/context.jsx host.ping, context.get, keyframes.read          (read-only)                     │
│   ops/keyframes.jsx keyframes.applyEase, keyframes.restoreEase    (undo group, read-back)        │
│   ops/layers.jsx  layers.setStartTimes                            (undo group, read-back)        │
│   ops/expressions.jsx expressions.set, expressions.validate       (real engine errors)           │
│   ops/compositing.jsx pixels.sample, effects.ensure, effects.restore (probe, named MOE effects)  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3. Tool contract (feature module architecture)

Every capability is one object registered in `core/registry.js` (full contract in its header comment):

- **Identity**: `id` (`module.name`), `version` (semver), `category` (`motion|expressions|compositing|tools`), `group`, `name`, `description`, `keywords`, `icon`.
- **Inputs**: `params` (schema.js: number/integer/string/text/boolean/enum/layer, min/max, defaults, `advanced`).
- **Context**: `requires` (comp, minLayers, keyframedProperties, selectedKeys, expressionCapable…).
- **Permissions**: `permissions` (scopes) + `destructive`.
- **Recovery**: `recovery` (`undo+checkpoint` | `undo` | `none`), `checkpoint()`, `restore()`.
- **Execution**: `prepare()` (pure, builds preview + host args), `execute()` (async, host/AI), `verify()` (pure, read-back), `summarize()`.
- **AI**: `ai: { callable, hint }` — only callable tools appear in Copilot plans and recipes.
- **UI**: `ui.primaryLabel`, `ui.presets`, optional `ui.renderResult(result, { h, app })` for custom result views (e.g. swatches); `app.prefillTool(id, args)` fills another tool's form without running it.
- **Compatibility**: `compatibility.minAE`, `uses.hostOps`, `uses.network`.

The registry rejects definitions that mutate without verify/recovery, use unknown permissions, or duplicate ids.

### Adding a tool
1. If a new host primitive is needed, add it to `host/ops/*.jsx` (ES3, undo group, return before/after).
2. Create `extension/features/<module>/<tool>.js` implementing the contract.
3. List it in `extension/features/index.js`.
4. Add tests in `tests/` (fixture + mock host), run `npm run check`.
5. Update FEATURES.md / CHANGELOG.md / TEST_REPORT.md.

The UI, palette search, favorites, presets, history, Copilot catalog and recipes pick the tool up automatically.

## 4. Copilot flow (approval-based agent)

1. User describes a change (bottom bar, Ctrl+Space).
2. Panel reads fresh context; `planner.createPlan` sends: deterministic system prompt (rules + sorted tool catalog, cached) + user message (request + compact context).
3. Response is constrained by a small JSON schema: each step is `{ tool: enum of AI-callable ids, args_json: string, reason }`. (Until v0.6.3 every tool had its own strict variant in an `anyOf`; with 42 tools the API rejected it — "compiled grammar is too large". Keep structured-output schemas small and independent of the number of tools.)
4. `validatePlan` parses `args_json` and re-validates every step locally (tool exists & callable, args schema, first step against current selection/permissions). Invalid plans cannot be approved.
5. User approves → steps run through the executor with `origin: 'agent'`; each is verified; execution stops on first failure.
6. Roll back restores completed steps' checkpoints newest-first. A successful plan can be saved as a recipe (reusable without Claude).

## 5. Tool Factory (safe foundation)

- A recipe is **data**: `{ name, params, steps: [{ tool, args }] }` with `{"$param": "x"}` bindings.
- Claude drafts recipes using only listed tools; `draftToRecipe` + `validateRecipe` treat output as untrusted.
- User reviews and approves → saved to `recipes.json` → rerun offline through the executor.
- "Dry run" = validation + check of step 1 against the live selection (no changes).
- Testing on disposable project data (scratch comp) is planned (ROADMAP M3); it needs a new, explicitly permissioned host op.

## 5b. Compositing module (v0.2.0)
See `docs/features/COMPOSITING.md`. Key patterns reusable by future modules:
- **Probe sampling**: temporary null + Color Control expression that maps `time` → (cell, sample time), read with `valueAtTime`; removed in `finally`; layer count verified.
- **Named effects**: MOE effects are identified by name + matchName, updated in place, ordered with `before: [keys]`, and rolled back by the host op itself on failure.
- **Parameter resolution**: English name → `<effect>-NNNN` convention → order; fallbacks only when the parameter count matches `expectParams`; method reported in checks.
- **Effect checkpoints**: created → removed on restore; updated → previous values by parameter index.

## 5c. Studio modules (v0.3.0)
See `docs/features/STUDIO_v0.3.md`.
- **Navigation**: left rail with sections by purpose; each section is a view (`app/ui/views/*`) over registered tools.
- **Text**: presets are data (`features/text/presets.js`) → `buildSpec` → host `text.applyAnimator` builds a named animator; `preview.js` simulates the Range Selector for canvas previews; `.ffx` files are parsed read-only (`ffx.js`) and applied with `Layer.applyPreset`.
- **Brand**: `brands.json` store; colour application dispatches per target type; solids use an effect, never the shared `SolidSource`.
- **Proximity**: pure expression generator (`features/proximity/expressions.js`) + effector controls via `effects.ensure` + `expressions.set`; restore removes what was created.
- **Select**: pure matcher over `layers.list` snapshots; selection changes go through `layers.setSelection`; history lives in the panel because AE does not undo selections.

## 5d. Layout & Speed modules (v0.4.0)
See `docs/features/STUDIO_v0.4.md`.
- **Measurement**: `layers.bounds` extends the probe pattern (temporary null + Point Controls running `sourceRectAtTime` + `toComp`) to give comp-space boxes at any time; `layers.describe` gives structure (parents, expressions, pre-comps).
- **Adapt**: pure planner (`features/adapt/planner.js`) → per-layer affine `p' = s·p + d` → `adapt.apply` (duplicate / resize / remap keys or rig nulls / nested copies) in one undo group → measured again for verification.
- **Grid**: `features/grid/layouts.js` is the single source of layout maths; `expressions.js` emits the same maths as AE expressions; the panel preview and the read-back check use `layouts.js`, so preview = result.
- **Zoom / Glass / Quick**: small host primitives (`fx.jsx`, `quick.jsx`) composed by tools; every created layer carries a `MOE …` name so restore and removal are guarded by name.
- **UI**: `app/ui/widgets.js` holds tool-specific widgets (canvas previews, plan diagram, pickers) keyed by tool id; `quickbar.js` renders the strip, the Quick section and the options popover from `features/quick/bar.js` data.
- **Mock**: `tests/mock/ae-expr.js` evaluates MOE expressions so tests check expression maths, not only syntax.

## 5e. Studio UI (v0.5.0)
`app/ui/studio/sections.js` is data: sections, tiles (tool id + preset args + thumbnail recipe + tags), aliases and `sectionOf(tool)`. `studio/library.js` renders any library section (tiles + Inspector reusing `toolBlock.renderTool`, so validation, approval, verification and restore are unchanged). `studio/thumbs.js` draws tile thumbnails (grid tiles use the real `grid/layouts.js` maths). `views/deliver.js` measures once (`adapt/measure.js`), plans every format with the pure planner and runs `adapt.resize` per format. No new host code.

## 5f. Premium modules (v0.6.0)
- `features/design/`: `svgShape.js` (pure SVG → AE Shape converter, tested against all bundled icons), `shapesLib.js` (Lucide data loaded on first use from `assets/icons/lucide.json` + 22 parametric primitives), `palettes.js` (32 palettes), `tools.js` (`design.insertShape`, `design.background`, `design.colorize`).
- Host: `host/ops/design.jsx` → `shapes.insert` (one shape layer, one named group, paths or a Rect/Ellipse/Polystar primitive, stroke/fill; removes its layer on any failure; reads everything back).
- `core/presetPacks.js`: My Presets export/import; packs are validated per tool schema before anything is stored.
- UI: `app/ui/theme.js` (theme/accent/motion/headings → `<html data-*>`), `art.js` (logo + section illustrations as token-coloured SVG), `chrome.js` (section banners, splash, What's New / About / Shortcuts sheets), `views/home.js`, `views/shapes.js`; `studio/library.js` gains Mine tiles, Save as preset, palette panel, NEW badges; `form.js` colour field.
- Assets: `assets/icons/` (Lucide data + licence, built by `tools/build-icons.js`), `assets/fonts/` (Sora + OFL), `icons/` (panel icons for the manifest, built by `tools/build-panel-icons.js`).

## 5h. Rendering (v0.6.2)
- State → `scheduleRender()` (coalesced per microtask, deferred while a pointer is pressed) → views build a fresh tree with `h()` → `morph(live, fresh)` updates the live DOM in place. Handlers live on elements as `__on<type>` behind one dispatcher, so morph moves the newest closures onto kept elements. Inputs / textareas / selects and unkeyed canvases are replaced; `data-key` decides identity for tiles and thumbnails.
- Background work: selection polling ≥ 2.5 s, adaptive to host latency, paused during interaction / hidden panel; thumbnails animate per Motion mode (Calm = hovered tile + Inspector, ≤ 30 fps).

## 5i. Workflow layer (v0.7.0)
- `studio/sections.js` adds `GROUPS` / `NAV` (sidebar groups and Ctrl 1–9 order) and makes Compositing a library (one tile per tool; `needsInput` marks tiles that need a description / reference / file).
- `studio/library.js`: `readiness(app, tile)` = the Run button's own check (`toolBlock.availability`: requirements + `prepare`), used for dimmed tiles, ▶, double-click, search and the sticky `actionBar`. Nothing new reaches the host; every run still goes through `app.runTool` → executor.
- `shell.js`: `app.runTool(..., { label })` records `state.last` after a successful change by a non-read-only tool; `app.repeatLast()` (F4 / ↻ chip) re-runs it through the same pipeline on the current selection. Hidden sections (`ui.hiddenSections`), tile density (`ui.tiles` → `.tiles-compact`).
- `palette.js`: `presetItems()` turns library tiles and text presets into results; `run` applies (via `library.applyNow`, so readiness applies), `open` only navigates.
- `chrome.js`: banners full on the first visit (`banners-seen` in the store), one-line title after.
- `dom.morph` keeps a kept canvas's width/height (removing them clears the bitmap).

## 5j. Workspaces & Pie menu (v0.8.0)
- `studio/sections.js`: `WORKSPACES` (Home + 5) group the 15 sections; `workspaceOf(id)`; the shell renders workspace buttons, a tab row for the current workspace, remembers the last section per workspace (`ui.wsLast`), Ctrl 1–6.
- `app/ui/actions.js`: one action vocabulary (`tile:` / `quick:` / `nav:` / `cmd:`) → `{ label, icon, run(app), ready(app) }`; `profile(ctx)` names the selection (keys / text / shapes / layers / layer / none); `SETS` are the fixed 8-slot smart sets; `slotsFor()` returns the smart set or the user's `ui.pie.mine`; `catalog()` feeds Settings.
- `app/ui/pie.js`: the radial menu (marking-menu release, tap-to-stay, 1–8, arrows, centre = `app.repeatLast`). Pure helpers `sliceAt` / `sectorPath` are unit-tested. Readiness comes from `library.readiness`, so a slice never runs what the tool's own checks would refuse; every run still goes through `app.runTool` → executor.
- Triggers live in the shell: Q keydown (not typing, no modifiers), right-button pointerdown on anything without its own right-click menu, the header button.

## 5l. Motion Kit (v0.10.0)
- `app/ui/views/kit.js`: blocks reused in three places — `homeTop()` (Home starts with Ease + Anchor + Align + pinned tools, `ui.kit.pins`), `renderToolbox()` (section `kit`, label *Toolbox*: all tools with *Pin to Home*, curve library) and `render()` (the dockable panel). No library pattern. Transient state `K` (graph curve, last key-selection signature, source line). `autoRead()` runs `keyframes.read` once per change of the key selection (first property with 2+ numeric selected keys) and turns the eases back into a curve (`bezier.fromTemporal`). The graph canvas (`widgets.drawKitCurve` / `kitGeom`, full width) is `data-fresh`; drags draw directly and commit on pointer-up through `library.applyNow` (readiness + one executor run = one undo step). Sliders, chips, Easy / Linear / Hold / Copy / Paste and the anchor / align / tool buttons all go through the same path.
- `app/ui/views/kitGraph.js`: the ease graph widget — pure helpers (`keySpeeds`, `fromSpeed` for speed-graph handles, `valueRange` / `speedRange` that grow for overshoot, `parseCurve`, `geom`, `handles`, unit-tested) and the canvas widget (value / speed modes, ghost, spacing chart, live label, Ctrl snap / Shift flat / double-click reset, keyboard nudge + Enter, resize grip). The range is frozen while a handle is dragged so the scale never jumps under the mouse.
- Kit buttons are Quick Bar actions (`features/quick/bar.js` group *Kit*, `KIT_TOOLS`, `KIT_ALT`, `KIT_LABEL`), so right-click options, pinning and readiness come for free. `bar.resolve` now merges each expression preset's numbers into its action args.
- Host: `ops/kit.jsx` (`keyframes.setInterp`, `layers.trimToKeys` / `restoreTiming`, `rigs.find` / `rigs.remove`); `ops/transform.jsx` anchor rewritten (2D maths R·S·Δa; 3D / auto-orient through a toWorld / fromWorld probe with selection restore; keyed anchor; mask box; Alt placement via the parent chain), `layers.nudge` handles parented layers (comp → parent space, 2D parents).
- Second CEP extension `tv.madtomato.moe.motionai.kit` (`kit.html` → `main.start({ mode: 'kit' })` → `shell.renderKitPanel`). Both panels share `%APPDATA%\MOE Motion AI`: `core/storage.js` re-reads a document whose file changed (mtime, checked ≤ 2×/s per document; `version(name)`), `core/settings.js` re-reads before `get` / `update`.

## 6k. Clone Colours (v0.34.0)
- `features/grid/effectors.js`: `paletteColour`, `colourWithEffectors` (reference), `colourCode` (Fill colour expression, tag `// MOE Clone Colour`), `COLOUR_CONTROLS` / `COLOUR_MODES`; effector `CONTROLS` gain Colour / Colour Mix (`expressions.KIND.color`).
- `features/grid/colourTool.js` (`grid.colour`): grid-null controls + one `MOE Clone Colour` Fill per item (slot from the item's own grid expression), read-back; restore through `effects.restore`.

## 6l. Spring / Inertia Effector (v0.35.0)
- `features/grid/effectors.js`: `stepResponse`, `springWindow` (≤ 60 samples, ≤ 3 s), `termsAt` (one effector's [dx, dy, scale, rotate, fade] at a time), `springTerms`, `applyAt` — the reference; `code()` mirrors it with `TQ(tq)` + the spring sum. Effector `CONTROLS` gain Spring / Frequency / Decay.
- `grid.effector` params spring / frequency / decay; tiles efSpring, efJelly, efInertia, efBounce; thumbnails run `applyAt`.

## 6m. Target & Audio Effectors (v0.36.0)
- `effectors.js`: TYPES 6 Target / 7 Audio; `termsAt` uses `src.originAt`, `src.audioAt`, `item.baseRotAt`, `wrap180`; CONTROLS gain Audio Layer (layer) / Audio Max. `code()`: `TQ` aims with `EL.toComp(anchor, tq)` and reads `AU.effect("Both Channels")` at tq − k × Delay.
- Host op `audio.amplitude` (`host/ops/layout.jsx`): Convert Audio to Keyframes via `app.findMenuCommandId` / `executeCommand` on one layer (selection saved and restored), finds the one new layer, checks Both Channels, renames `MOE Audio · <layer>`, `moveToEnd()`, returns the loudest key; reuses an existing one.
- `grid.effector`: audio source = first layer with `hasAudio` outside the grid; checkpoint removes the amplitude layer only if this run made it.

## 6n. Object & Text Cloner (v0.37.0)
- `grid/layouts.js` MODES 7 `points` (vertices + pointOffset) / 8 `keep` (homes); `pathLike` (Path, Points, In Place) for build order. `grid/expressions.js` `lay(7)` reads `acc.points()` through `pathAccessCode`, `lay(8)` returns H.
- `grid.build`: `splitText` (none / words / letters) → host `text.split` before anything else (pieces become the items) and `text.unsplit` on restore / failure; Points auto-clones `paths.find().points − 1`; Path / Points auto-pick the one selected shape; In Place null anchor = position; In Place read-back = `layers.bounds` before vs after.
- Host `text.split` / `text.unsplit` (`host/ops/text.jsx`): temporary measuring duplicate (removed in finally), start-justified substring rects shifted to the source justification, pieces = duplicates without animators, named and centred; source `enabled = false`.

## 6o. Field Effectors (v0.38.0)
- `effectors.js`: FALLOFFS 5 Noise Field / 6 Image; `weight(e, lx, ly, { t, luma })`; `termsAt` passes time + `src.lumaAt`; CONTROLS gain Field Layer (layer) / Field Speed. `code()` hoists `fsp` / `FL` and samples `FL.sampleImage(FL.fromComp(IP, tq), [2, 2], true, tq)`; `colourCode` mirrors both at the current time.
- `grid.effector`: `fieldLayer` (picked from the selection: the one selected layer that is not the grid, its items or MOE's) / `fieldSpeed`; verify reads the Field Layer link back. Mock: a Layer Control's layer gets `sampleImage` too.

## 6p. Live Preview (v0.39.0)
- `features/grid/sim.js` (pure, no DOM): `createSim({ args, items })` — recorded null path (grab / drag / release, sweep, reset; ≤ 3.5 s, ≤ 600 points), `frame(t)` through `effectors.applyAt`, `weightAt` for the overlay; stand-ins `beat` (Audio) and a sample luma (Image).
- `app/ui/clonerPreview.js`: `effectorPreview` (canvas `data-fresh` with pointer events, shared sim across re-renders, *Use my grid* = one `layers.describe` + `props.values` (evaluated positions)), `demoInputs` (sample star / words for the Grid Builder preview). Registered in `widgets.body['grid.effector']`.

## 6q. Self-Test (v0.40.0)
- `features/selftest/runner.js`: `runSelfTest(services, { onProgress, only })` — `selftest.begin` → `CHECKS` (each runs real tools through `executor.run(..., { approved: true, batchId })`, reads `props.values` / `layers.bounds`, compares with `layouts.placeMorph` / `effectors.applyAt`, restores the tool's checkpoint and checks the layer count) → `selftest.end` in finally. Report = plain JSON.
- `host/ops/selftest.jsx` (begin / addText / commands / end, name + id guarded). `app/ui/views/diagnostics.js` `selfTestCard` (confirm step, progress, results, Copy report; last report in the store).

## 6zj. Styles + Shakes (v0.59.0)
- `quick/shakePlan.js` (pure: `TYPES`, `plan(type, o)` → offsets per property, `EASE`, `valueAt`); tool `quick.shake` reads each property at every key time (`props.values`) and writes value + offset (`keys.write`), restore = `keys.remove`. `design/styles.js` (`STYLES`, `sweepCode`) → `effects.ensure` (`MOE Style • …`) + `expressions.set` for the Light Sweep centre (`// MOE Style`). Tiles: Motion mode `Shake`, Looks filter `Styles`; `thumbs.shake` / `thumbs.style`.

## 6zi. Apple Motion (v0.58.0)
- `animatePlan.blur(args)` → Blurriness keys on the move's timing; `quick.animate` param `blur` → `effects.ensure` (`MOE Blur`, Gaussian Blur 2) + keys at `['ADBE Effect Parade', 'name:MOE Blur', 'name:Blurriness']`; checkpoint adds `S.effectsCheckpoint`. `thumbs.blurAt` draws it. `bezier.PRESETS` tag `Native`; text presets group `Hero`.

## 6zh. Product UI (v0.57.0)
- `design/uiKit.js` (pure): `COMPONENTS` registered into `templates.TEMPLATES` with `kit: 'ui'`; `templates.textSpecs` / `layout` delegate to it with shared helpers (`unit`, `hexRgb`, `enter`, `fadeIn`, `PLAN`). One key list per (part, property) (`dedupe`). Tool param `theme` (Light / Dark). `templateTool` moves the texts above the topmost shape (`layers.move`). Section `productui` (Design workspace), `ae-design` group `productui`, stage `st-design`.

## 6zg. Smart controls (v0.56.0)
- `app/ui/scrub.js attach(input, { step, min, max, round, live, commit, fill })`: pointer scrub with capture (Shift ×10 / Ctrl ×0.1, Esc restores), ↑ ↓ with a 400 ms debounced commit, wheel only while focused. Used by `form.control` (every Inspector number; ranged ones also move the range), `kit.velocity` and the Align gap. Range `dblclick` → `p.default`.

## 6zf. Hidden sliders (v0.55.0)
- `views/kit.js velocity()`: each field gets a scrub spec (`INFL` 1–99 % / 1 % per px, `SPEED` ≥ 0 / 1 % of the average speed per px); `pointerdown` on an unfocused field captures the pointer, moves update `K.curve` + `K.graph.set`, release commits through the same path as Enter (`applyCurve` when auto). `.kit-vfill` is the hidden bar.

## 6ze. No Cut Names (v0.54.0)
- CSS: names use a two-line clamp (`white-space: normal`), `.seg` and `.st-actbar` wrap; `layouts.moeRail` is wide only when the stored choice is on and `state.navWide` (≥ 600 px). `tools/audit-cut.js` measures every text with an ellipsis / clamp / hidden overflow across 126 screens; only tooltipped descriptions may be shortened.

## 6zd. Guide Presets (v0.53.0)
- `grid/guidePresets.js` (pure: `PRESETS`, `lines(id, W, H)` → `{ v, h, box?, note? }`); tool `grid.guidePreset` → `guides.set` (`clearAll` for Clear, `skipSame` otherwise; checkpoint = added + cleared). `layouts.MENUS` Guides (rows Lines / Safe / Social, refs `tile:layout/gp*`); `arrange.FAMILIES` Guide Lines / Safe Areas / Social Safe; `thumbs.gpreset`.

## 6zc. Auto-fit Templates (v0.52.0)
- `templates.textSpecs` gives each line a `maxWidth` (`FIT[id]` × comp width; 0 for the quote mark / number). `text.create` (host) shrinks `fontSize` while `sourceRectAtTime` width > `maxWidth` (≤ 4 passes, floor 40 %) and returns `{ fontSize, fitted }`; `layout` reads the fitted size from `measured[key][2]`. `templates.fitSize` is the pure rule; `thumbs.js` runs it with canvas measurement.

## 6zb. Branded Templates (v0.51.0)
- `templates.brandOpts(brand, opts)` (pure: `brandRoles` primary, best contrast among text / background / black / white, font by script); `templateTool.withBrand(args, services)` fills what was not set by hand (used in `execute` and by `library.tileThumb` / the big preview). Param `useBrand`.

## 6za. More Templates + Exit (v0.50.0)
- `templates.js`: `quote` / `endCard` / `handle` / `chapter` in `textSpecs` + `layout`; text parts carry their own `name` (`nameOf`); `finish(opts, plan)` appends the exit keys after `hold` (`exitAt`). `design.template` params `number`, `hold`. `thumbs.DRAW.template` caps a small tile's hold at 1 s.

## 6z. Native Templates (v0.49.0)
- `features/design/templates.js` (pure): `TEMPLATES`, `textSpecs(id, opts, comp)`, `layout(id, opts, comp, measured)` → elements (text / rect / ellipse / path, comp px) + entrance keys (`animatePlan.keysFor`), `isRtl`. `features/design/templateTool.js` (`design.template`): `text.create` (new host op, `host/ops/text.jsx`) → measured sizes → `layout` → `shapes.insert` / `shapes.trim` → `layers.createNull` + `layers.setParent` + `props.setValues` (local positions) → `keys.write`; read-back in execute, `layers.remove` on failure and restore. UI: section `templates` (Design workspace), `ae-design/templates` group, `st-design` stage; `thumbs.DRAW.template` draws the same plan. Self-Test `checkTemplate`.

## 6y. Combined Moves (v0.48.0)
- `animatePlan.animate` reads `away` (scale at the far end, %) and `angle` (spin); `animatePlan.fade(args, pose)` = Opacity on the same timing. `quick.animate` params `fade` / `away` / `angle`; Scale / Spin / fade keys come from the plan. `thumbs.fadeAt` adds the fade to move / scale / spin previews.

## 6x. Real Previews (v0.47.0)
- `features/quick/animatePlan.js` (pure): `easePair`, `keysFor`, `animate(args, pose)`, `trim(args)`, `valueAt(keys, t)` (AE temporal ease via `bezier.fromTemporal`), `endOf`. Used by `quick.animate` / `quick.trimPaths` (`tools.js`) and by `studio/thumbs.js` (move / fade / scale / spin / stagger / trim recipes when the thumb carries `args`; `keyStrip` under the big preview). `library.thumbEl(tile, cls, liveArgs)` passes the tile's args, or the Inspector's current ones.

## 6w. Select Modifiers + Sidebar Menus (v0.46.0)
- `app/ui/layouts.js` `MENUS`: Select (renders its group's rows) + menus with their own `rows` (`[label, refs, short]`) and the `tab` whose Recent remembers their buttons; `menuPopover` renders either through `layoutAE.subRow`. Rule in `tests/norepeat.test.js`.
- `features/quick/bar.js`: `SELECT_MODS` on the 12 Select filters (`mods`), `withMods(a, e)` (the one place reading Shift / Alt → args + label), `modsHint`. `quickbar.run(app, a, e)`; `actions.resolve(quick:…).run(app, e)` + `hint`; every renderer passes its click event. `layoutAE.keysHint()` (group `keys: true`, MOE Select menu).

## 6v. No Repeats (v0.45.0)
- `app/ui/actions.js`: `ON_SCREEN` (search, Assistant), `IN_CONTROL` (ref → [`rail` | `ease`, the Motion Control button's data-key]), `nowSet(kind, shown)`. `layoutAE.controlShows(app, kind)` → `{ rail, ease }` (ease = the control is open); `layoutAE.shownRefs(app, group, kind)` (an open group's one-click refs). Bento `now()` and Glass `nowCard()` use them; the pie keeps `SETS`.
- v0.65 (docs/features/WORKSPACES.md): `layoutAE.tabControl(app, tab, kind)` — `tab.full` → `controlFull` (scope `__timing-<kind>`, graph open), `tab.bar` (`['bar']` Motion Bar / `['rail']` Place / `false` none) → `controlTop(app, kind, parts)` (scope `__bar-<kind>`); `kit.easeBlock` reads `K.scope.parts`; `openEase(app, sc)` gets the scope captured at draw time (MOE → `ae-keys`).
- v0.75: `executor.batch(label, fn)` — one undo group across runs (Control's Mix); `app/ui/kits.js` (KITS of refs) + `views/kits.js`; `kit.brandEase / withEase / EASE_PRESETS` and `actions` Brand ease → `motion.smartEase`; `paletteCard.art`.
- Control v0.74: `widgets` Calm plays `.cc-hero` always and `.cc-item` under the mouse; `layoutControl` keeps numbers (`cc-tune`, `restoreTune`), My mixes (`cc-mixes`: `saveMix` / `loadMix` / `removeMix`), Wiggle targets (`WIGGLES`); the shell's Enter / Esc on Control's home.
- Palette cards (v0.73): `app/ui/paletteCard.js` (`card`, pure `cardArgs`) — a still `bgFrame`; Brand examples `features/brand/examples.js` (`seedOnce`, `addMissing`).
- Control pages (v0.72): `layoutControlPages.js` — `groupsFor(app, page, s)` lists library tiles / text presets / Quick tools as squares (only one-click ones), `pickBar` reads the tool's card, Apply = `library.applyNow`.
- Control layout (v0.71): a style may return `hideCtx` (shell skips its context strip) and `titleExtra`; `moeRail(app, s, { iconsOnly })`.
- Control style (v0.70): `layoutControl.js` — `modulesFor(kind)` picks the squares, `plan(cc, kind, n)` (pure) turns the switched-on ones into registered tools' args, `applyMix` runs them through `app.runTool` in order and stops at the first that is not ready or fails; Control gets `moeRail` like Glass.
- Glass sidebar (v0.69): `layouts.build` gives Glass `moeRail` + the menu popover and drops its Quick Bar strip from `top` (as MOE does).
- Look & Feel (v0.68): `studio/bgComposer.js` (`render`, `nextArgs`, `fullLook`) routed from `library.render` by `section.composer`; `renderTool` bare `hide` / `noBody`; frost in `css/styles.css` (`::before` light, `--g-frost`, `--g-blur`); `chrome.banner` returns null in MOE and on composer pages.
- Smart Layer (v0.67): `toolcard` `warnings`; `app/ui/hovercard.js` (`refOf`, `cardFor`, `install` on the shell root); `actions.resolve` → `tool` / `args`; `layoutAE` group kind `reader` (`readLayers`, `readerBody`) + `features/kit/reader.js` (`describe`, tool `kit.removeRig`); `expressions/quick.parse`; host `rigs.remove` `only`, `audio.envelope`, `markers.add` / `markers.remove` (layout.jsx); `features/markers/beats.js` (pure) + tool `markers.beats`; Self-Test `markers`.
- Tool Cards (v0.66): `core/toolcard.js` `card(tool, args, ctx, services)` (pure: `lockpolicy` → `context.evaluate` → `prepare()` → optional `explain()`), `codeRuns`, `tidy`; `library.cardBlock` (Will do / Needs / code), `renderTool(…, { bare, fixed })`, params `tileFixed`; `sections` `groupBy` / `groups` + `library.groupTiles` / `fittingGroups`. `expressions.quick.explain`, `ranks` (Live Stagger), per-target code.
- Installer (v0.65.1): `installer/moe-motion-ai.nsi` — dark MUI2 (`MUI_BGCOLOR` 111116 = `BG` in `tools/build-installer-art.js`, which renders `sidebar.bmp` / `header.bmp` in Sora), welcome text built in `.onInit` (`$Status`, `$AELine`), `FindAE` (HKLM `SOFTWARE\Adobe\After Effects\<26|25>.0` `InstallPath`, then the default folder), read-back of `CSXS/manifest.xml` (this version) + `index.html` after copying, `LaunchAE` on finish. The `WhatsNew` LangString is updated by hand each release.
- `app/ui/layouts.js`: `MENUS` = [Select]; `RETIRED_MENUS` (where each removed menu's buttons are). Motion Control's Easy / Linear / Hold have keys `ci-easy` / `ci-linear` / `ci-hold`; library tiles `t-<library>/<id>`.
- `tools/audit-repeat.js` (on screen, 84 screens) and `tests/norepeat.test.js` (nothing lost, same job = same tool and values).

## 6u. Find Fast (v0.44.0)
- `features/select/tools.js`: `select.layers` (by type / label / search / same / all / invert / none; `typesOf` footage, cameraLight) + `select.step` (selector back / forward). Quick actions `sel*` and `t_*` in `quick/bar.js`; group `ae-layer/select` (rows) first; MOE menu `Select` renders that group's rows (`menu.group`).
- `app/ui/palette.js`: `actionItems` (every Quick action, one click) and Arabic queries through `workflow.keywordsOf`.
- `tests/findfast.test.js`: buried-tool and shared-name rules.

## 6t. Smart Arrange (v0.43.0)
- `app/ui/arrange.js` (pure): `FAMILIES`, `group`, `runs`, `splits`, `pack(items, cols)`. Used by `layoutBento.js` (`placed()` sets `--s4` / `--s2` spans, `pairTile`), `layoutAE.js` (`runsOf` → `.fam` boxes in `.flow` rows), `layouts.js` (MOE menus), `layoutGlass.js` (NOW).
- `tools/audit-arrange.js`: on-screen rules (family / group / hole / cut) for Bento, Glass, MOE, menus, Kit × 340–900 px → `dev/audit/arrange.json`.

## 6s. Bake to Keyframes (v0.42.0)
- `features/bake/plan.js` (pure): `timesFor` (frame-aligned samples), `thin` (smart LINEAR keys within `TOL`, HOLD for checkboxes / menus, constant → plain value), `planError`, `everyFor`, `chunks`, `LIMITS` (120,000 reads · 40,000 keys).
- `features/bake/bake.js` (`rig.bake`): targets (grid null → its items; trail null → copies by tag `// MOE Trail · <null>`; other layers → their MOE / all expressions) → `bake.scan` → `bake.sample` all values first → plan → `bake.write` in pieces → read-back of ≤ 12 frames; checkpoint = each property's saved expression + keys → `bake.restore`.
- `host/ops/bake.jsx`: `bake.scan` / `bake.sample` (read-only), `bake.write` (save state, clear keys + expression, `setValuesAtTimes`, interpolation + straight tangents, per-property put-back on error), `bake.restore`.
- UI: quick action `k_bake` (Motion Kit › Clean up, Alt = one key per sample; Keys tab). Self-Test `checkBake`.

## 6r. Clone Trails (v0.41.0)
- `features/grid/trail.js`: `at(k, src, c, now, fd)` reference + `code(k, source, null)` (four expressions, tag `// MOE Trail`). `features/grid/trailTool.js` (`grid.trail`): null + controls, `layers.clone` plain copies, `layers.setParent(null)`, `expressions.set`, read-back of every copy vs the source read at its own time.
- Self-Test `checkTrail`.

## 6j. Cloner + Effectors (v0.33.0)
- `features/grid/effectors.js`: pure reference (`weight`, `amounts`, `apply`, `localFn`) + `code()` (the same maths as expression text). `grid/expressions.js buildAll` tags `· v3`, adds slots *Effector 2 / 3* to the grid controls, skips the legacy effector when slot 1 holds a MOE Effector; `factsOf(code)` reads an item's facts back for in-place upgrades.
- `features/grid/effectorTool.js` (`grid.effector`): null + 15 controls (`effects.ensure` / `effects.setMenu`), first free slot (`props.values` on the grid null's layer controls), upgrade v2 items, sweep / delay keys, read-back; restore unlinks the slot and removes only `MOE Effector …`.
- `grid.build` `clones`: `layers.clone` with `plain: true` per source, items = sources then copies cycling; checkpoint `clones` removed with `layers.remove onlyNamed 'MOE Clone '`.
- UI: `layoutAE` arrange group is `kind: 'animate'` with `modes` + `modeFor` (per-group store key `ae-mode-<id>`) and `panel: 'grid'`; `sections.js` Layout modes Clone / Effectors; `thumbs.eff` draws the real effector maths.

## 6i. Library pages (v0.32.0)
- `studio/library.js`: `stateOf` adds `open` (inline settings) and, for a section with `modes` (`[[tag, label, title]]`), always lands on a mode (or Mine); `filterRow` renders the mode switch (+ `elsewhere` links) or one-line chips; `fitCols(n, max)` → `--c` on `.st-grid.fit`; inline Inspector spliced after the clicked tile's row (`cols` from `s.kitBand`); `listLike` (all icon thumbs) → `.st-grid.list` rows with the tile `hint`; `HINT_KEY` counts applied presets (how-to line until 3). `shell.applyDensity`: `studioWide` from 600 px.
- `views/shapes.js`: `colsFor(band, prim)` and the same inline Inspector (`S.open`). `quickbar.view`: `.qt-grid.rows`.
- `sections.js`: Motion `modes` (In / Out / Trim / Proximity) + `elsewhere` (Ease → kit); Layout `modes` (Arrange / Guides / Cells; layout tiles tagged `Arrange`).

## 6h. Space follows content (v0.31.0)
- `layoutAE.TABS`: 15 groups. New group shapes rendered by `groupBody` (shared by MOE, Glass and Bento): `kind: 'animate'` (`modes: [[id, label, tileIds]]`, `animateBlock` + `animMode` — store `ae-anim-mode`, shapes default to Draw On); acts `rows` (`subRow`: a labelled line), `pairs` (`pairControl`: one control for two opposite actions), `lead` (a page link first); tiles `compact` (`compactTiles`: icon-only tool tiles as buttons, `hero` tile ids first) and `minor` (action chips after the tiles); tiles `live` (`groupExtra` Sliders switch, store `ae-x-live`, `withLive` adds `live: true`).
- `tileCols(n)` → `--c` / `--cw` on `.ae-tiles.fit` (columns divide the count; `kit-wide` uses `--cw`, slim / tiny 2 columns).
- `controlTop`: scope `__ctl-<kind>`, focus `ease` only for `keys` (compact strip otherwise; user open / fold kept per kind). Empty Recent is filtered out at render.
- `workflow.STAGES` follow the merged ids; `stageOfView` reads `lead` links and prefers a stage where the tab is `core`.

## 6g. Motion Control (v0.30.0)
- `views/kit.js`: `easeBlock(app, { rail })` — with `rail` the graph row holds `rail()` = `anchorBlock(app, true)` + `alignBlock(app, true)` (mini: no fold, caption); folded = compact strip + rail. `controlBlock` = the railed ease block; `copyEase` (from `K.segs`, or the graph curve) / `pasteEase` / `clipOf` (v0.29 single-curve clip still read). `layoutAE.controlTop(app, kind)` renders it (null with nothing selected) for Bento NOW, the Glass Now card and the top of MOE tabs; the TABS no longer have ease / align / anchor groups.
- `features/curves/tools.js`: `pasteEase` shares `easeCurve`'s execute / verify / checkpoint / restore; `prepared.curves` gives segment j curve `j % n` (null = keep); `parseClip` validates the copied JSON (≤ 24 segments).
- `workflow.NEXT` / `nextAfter(state.last)`: fixed follow-up refs per tool id, shown as *Next* (Bento `nextRow`, Glass Now card, MOE `nextStrip`).

## 6f. Fewer, clearer (v0.29.0)
- `features/quick/bar.js`: 41 `ACTIONS`; `MIGRATE` / `migrate()` map removed ids (and 4 removed tiles) to what replaced them. `app/ui/quickbar.js`: `byId` returns a Quick action or a **tile action** (`tileAction('tile:<sec>/<id>')` — tool / args / label / icon from the tile, expression numbers from its preset); `barIds` migrates + dedupes; `togglePin` is used by the library ☆ (`library.actionBar`). `actions.resolve` follows `migrate` for `quick:` and `tile:` refs.
- `app/ui/layouts.js`: `LAYOUTS` = bento · glass · moe, `RETIRED` (moved to Bento at start-up in `shell.createApp`), `build` dispatches to `layoutBento` / `layoutGlass` / MOE (`layoutAE.build` + rail). Removed: `layoutApple.js`, `views/home.js`, the Sidebar render in `shell.js`, `kit.smartHome` / `homeTop`, `actions.FOCUS*`, `copilot.render`.

## 6e. Workflow Home + Assistant (v0.28.0)
- `app/ui/workflow.js` (pure / store-only): `STAGES` (5 stages placing every `layoutAE.TABS` group once, `core` / `more`), `EVERYDAY` (= first ten of `quick/bar.DEFAULT_BAR`, Alt+1…0 via `quickbar.runSlot`), `POWER` cards + learn state (`wf-learned`), `formatOf` / `safeArgs`, `tips` (+ `wf-tips-off`), `syncProject` (`wf-projects`: AE project name → client), `keywordsOf` / `powerFor` (offline matching, Arabic whole words), `PROMPTS`.
- `layoutBento.js`: NOW (+ `formatChip`) → `power()` → stage index → `stageSection()`; `jumpTo` (chips, Ctrl+1…5). `layoutGlass.js`: spaces = stages.
- `core/ai/assistant.js`: `ask()` (answer + plan schema = planner schema + `answer`; deterministic system prompt; request / conversation / format / context as data), `compactHistory`. `services.assistant` = { ask, validate } (validate = planner).
- `app/ui/assistant.js`: floating button + sheet (suggestions, conversation, prompts, input); plans reuse the Copilot approve / run / rollback (`app.approvePlan`…); `localMatches` scores Ctrl+K results by keywords. Shell: `askAssistant`, `toggleAssistant`, `clearAssistant`, Backquote / Ctrl+Space / Esc / Alt+digit keys, `alt-held` class, `syncProject` on each context read.

## 6d. Thick Glass (v0.27.0)
- Host `ops/glass.jsx`: `glass.map` (ItemCollection.addComp → `Layer.copyToComp` per source → copy unparented, effects / matte removed, Position un-separated, transform expressions from `thick.mapTransform` (toComp frame), every non-colour leaf of Contents / Masks / Text / Time Remap linked by index to the source (`base("ADBE Root Vectors Group")(i)(j)…`, ≤ 400), other expressions cleared, Fill white; `comp.layers.add(map)` hidden above the sources; removes the comp on failure) and `glass.removeMap` (layer + comp when `usedIn` is empty, names `MOE Glass N Map` only).
- `effects.ensure` params take `layerRef: layerId` (layer parameters such as CC Glass *Bump Map* get the layer's current index); `layers.setAttrs` gains blending mode `lighten`.
- `features/glass/thick.js` (pure): `THICK_LOOKS`, `THICK_CONTROLS`, `thickValues`, `mapTransform`, `boundsCode`, `thickExpressions`, `prismScaleRef`. `features/glass/thickTools.js`: `glass.thick` (map → adjustment → prism R/B → reflect → highlights → linked shadow / caustic → `effects.ensure` → `expressions.set` → mattes → attrs; full rollback of the run on failure) and `glass.thickLook` (controls only; flat `glass.look` refuses a thick glass).
- UI: Looks & Glass tiles `thick-*` (filter *Thick*), thumbnail painter `thick`, Classic / Bento / Glass / MOE Design › Looks & Glass group shows four thick looks.
- Mock: `project.items.addComp`, `Layer.copyToComp`, `CompItem.usedIn`, `timeRemapEnabled`, CC Glass, `BlendingMode.LIGHTEN`; expressions: `comp("name")`, layers / groups callable by match name or index.

## 6c. Brand in action (v0.26.0)
- `features/brand/applyAll.js`: `brandRoles(brand)` (roles + contrast), `planApply(brand, layers, { fonts, colors })` (pure), tool `brand.applyAll` (`layers.describe` for the whole comp → `text.setStyle` font + fillColor → `props.colorTargets` + `props.setValues` for shapes → `S.writeEffects` *MOE Brand Fill* for the background solid; checkpoint / restore of all three).
- `features/brand/kit.js`: `activeBrand` / `setActive` (store `brand-active`), `brandBackgrounds` / `saveBrandBackgrounds` (presets of `design.background`, ids `brand_<client>_<n>`), `brandEaseRef`. `actions.setBrandSource(fn)` (set by the shell) feeds the `brand:` refs (`apply`, `applyComp`, `ease`).
- `design/palettes.resolve(id, colors, name)`: `custom` palette from 2–5 hex (padded to 5); used by the Background / Colorize tools, the Inspector palette panel, tile thumbnails and `bgDraw`.
- `toolBlock.availability(tool, ctx, args, services)` passes services to `prepare` like the executor.

## 6b. Three styles + Brand import (v0.25.0)
- `layouts.DEFAULT_LAYOUT = 'bento'`; `ae`, `studio`, `apple` gain `retired: true`. `moe()` drops the Quick Bar strip from `top` and returns `side: moeRail()`; the shell renders `p.side` before `.main` (row flex). Rail: `MENUS` (popover opens beside the rail via `layMenu.left`) + `quickbar.barIds()`; store `moe-rail-wide`.
- Bento: store `bento-pins` (refs, max 4, stale ignored) and `bento-fold` (tab id → bool); one capture `scroll` listener (rAF) sets `bIx`. Glass: store `glass-now-folded`; `settings.ui.glassBlur` → `document.documentElement.dataset.glassBlur`; shell Ctrl+1…4 when the layout is glass.
- Brand import: `features/brand/scan.js` (pure: `normalizeUrl`, `scanHtml`, `scanCss`, `digestSite`, `localBrand`, `SCHEMA` / `SYSTEM`, `cleanAI`, `matchFonts`, `toDraft`) and `features/brand/fromSource.js` (tool `brand.fromSource`: `platform.http.get` → digest + logo image, or PDF bytes → `ai.createJSON` with content blocks → `fonts.list` → draft). `brands.normalize` keeps colour `role` / `usage` and a size-capped `profile`. UI: `views/brand.js` `importPanel` / `review` / `profileBlock` (state `brandImport`).
- `core/platform/node.js` `http.get(url, { maxBytes, truncate, binary, timeoutMs, accept })`.

## 6a. Style proposals (v0.24.0)
- `layouts.LAYOUTS` gains `glass`, `apple`, `bento` (`proposal: true`); `layouts.build` dispatches to `layoutGlass` / `layoutApple` / `layoutBento` (each returns `{ top, title, content, bottom?, overlay, menuBtn }` like Classic).
- They reuse `layoutAE` exports (TABS data, `twirl`, `groupBody`, `actButton`, `tileStrip`, `moreLink`, `linkRow`, `searchBox`, `searchResults`, `panelMenu`, `menuButton`, `remember`, `recentRefs`, `recentItem`). View ids: Glass spaces `gl-*`, Apple categories `ap-<tab id>`; Bento has only `home`. State: `glSpace` (last Glass space).
- CSS: `css/styles.css` (loaded after app.css in index.html, preview.html and the web preview), scoped per layout; tokens redefined inside the scope for dark and light.

## 5z. Design system (v0.23.0)
- Tokens in `css/tokens.css` (`--h-s/m/l`, `--ic-*`, `--r`, `--r-lg`, `--r-pill`, `--fs-*`, `--bg-elev`, `--shadow-1/2`, per theme); component rules in the "v0.23 design system" block at the end of `css/app.css` (later rules win; nothing else re-declares sizes). `tools/check-contrast.js` also checks text on `--bg-raised` and `--bg-elev`.
- Icons: `dom.icon(name)` renders `app/ui/icons-ui.js` (generated from `assets/icons/lucide.json` by `tools/build-ui-icons.js`, `MAP` = MOE name → Lucide name) with `viewBox 0 0 24 24` and class `lu` (stroke 2.25 = 1.5 px at 16 px); any other name uses MOE's 16-grid `ICONS` (`dom.js`, `icons2.js`, `icons3.js`).
- Importance tiers: Classic `acts` groups may carry `hero` (≤ 2) and `minor`, both subsets of `refs` in reading order; `groupBody` renders `.ae-hero` (32 px `.ae-act.l`), `.ae-acts` (28 px), `.ae-minor` (24 px `.ae-chip`). `actButton(app, a, onRun, size)`.

## 5y. Classic groups (v0.22.0)
- `layoutAE.groupsOf(app, tab)` = `[RECENT].concat(tab.groups)` in the saved order (store `ae-order[tabId]`, ids; unknown ignored, missing inserted at their default index). `moveGroup` (drag drop / Alt+↑↓; the default order deletes the entry), `resetOrder` (tab ▾ menu).
- ▸ Recent: virtual group `RECENT` (kind `recent`); store `ae-recent[tabId]` = up to 6 refs, newest first — `'quick:…'` (actions.resolve), `'kit:<id>'` (Motion Kit tool), `'tile:<section>:<id>'`. Recorded by `remember()` from act buttons, tile strips, `kit.toolsBlock({ onRun })` and ▾ menu items (`tabItems` items carry `ref`); runs from Recent itself do not reorder. `recentItem(ref)` resolves a ref or returns null (stale refs are skipped).
- Group header: `.ae-gh` is `draggable` (module-level `drag = { tab, id }`, drop indicator classes `drop-before` / `drop-after` set directly, cleared on drop / dragend); `.ae-twirl` `onkeydown` → `groupKey` (focus restored after a move because morph replaces keyed nodes that change place).

## 5x. Final layout (v0.21.0)
- Classic is final (docs/features/FINAL_LAYOUT.md). `layoutAE.tabItems(app, tab)` collects every action / preset ref of a tab (deduplicated); `tabMenu` renders it (state `aeTabMenu`; ▾ button `.ae-tabmenu-btn` or the tab's context menu). `build()` overlay = ≡ menu, else the tab menu.
- `layouts.LAYOUTS`: `retired: true` hides `hub` / `bar` / `workspace` from every list (still rendered if selected). `moe` = Classic `build()` with `menusRow` prepended and its own menu popover as overlay.
- Shell: `Ctrl 1…6` select Classic tabs (ae / moe); Esc closes `aeMenu`, `aeTabMenu`, `layMenu`.

## 5w. Classic layout (v0.20.0)
- `app/ui/layoutAE.js`: `TABS` (id `ae-*`, label, `fits` kinds, `owns` pages, `groups`) — group kinds `kit` (Motion Kit block, rendered with a private open scope so the group twirl is the only fold), `kitTools`, `acts` (`actions.resolve` refs), `tiles` (library tiles, `library.applyNow` / `readiness` / `thumbEl`), `grid` (`gridPanel` + tiles), `curves`, `links`. Open state: store `ae-open[kind][groupId]`, default = fits the selection or `open`. `build()` returns `{ top: [Quick Bar, tabs, search], content, overlay: ≡ menu, menuBtn }`; `layouts.header(…, menuBtn)` draws the Classic header.
- `layouts.layoutOf` falls back to `ae`. Shell: Ctrl K focuses `.ae-search` when present; Esc closes the ≡ menu. CSS block "v0.20 Classic layout".

## 5v. Grid Builder 2 (v0.19.0)
- `grid/layouts.js`: `rawPlace` / `finishBuild` / `place` / `placeMorph` (smoothstep mix of two layouts), `ORIENTS`, `modeIndex` / `modeAt`; `modifiers` takes `orient`, `nullRotation`, `item.twist`, `item.delay`.
- `grid/expressions.js`: `HEAD_CONTROLS` (Layout, Morph To, Morph), `controlsFor(mode)` = head + this layout + common + every other layout's controls; `buildAll(i, n, { gridName, pathAccess, pathClosed, home })` — `lay(m)` with all six blocks, `ic()` for `MOE Grid Twist` / `MOE Grid Delay`, position `+ (value − home)`; tagged `// MOE Grid · <name> · v2`. `isV2`, `slotOf`, `withSlot`, `allControls` (old + new names, for `grid.update`).
- `grid/tools.js`: `grid.build` reads homes (`props.values`) after parenting, writes menus (Layout / Morph To / Orient …), optional Morph keys after Build; refuses items already in a grid. `grid.items`: order → `layers.describe` + `proximity.scan` + `expressions.peek`, rewrites `var i = N`; tweak → `S.writeEffects`. No new host ops.
- `app/ui/gridPanel.js`: rendered by `studio/library.js` in the Layout section when `gridFor(ctx)` finds a grid; reads its state once per grid per history entry (no polling); every action is `grid.update` / `grid.items`.

## 5u. Moving backgrounds (v0.18.0)
- `features/design/bgMotion.js`: `POINT_MOTIONS`, `COLOR_MOTIONS`, `FX` (slider names), `pointAt` / `colorAt` (reference), `pointExpression` / `colorExpression` (same constants baked in, tagged `// MOE Background: motion|colour …`), `rgbToHsl` / `hslToRgb`.
- `design.background`: params `motion`, `colorMotion` (hidden in the form — the widget's chips set them), `loop`, `amount`, `colourAmount`; `drift` kept (hidden) for old presets. `backgroundPlan` adds `bases`, `slots`, `motion`, `colorMotion`, `controls`. `execute` writes the sliders (`S.writeEffects`) then one `expressions.set` (revertOnError) for points + colours; `verify` checks sliders and every expression.
- Preview: `widgets.body['design.background']` = `bgMotion` (replaces the big thumb in the library Inspector); `bgFrame` draws Ramp with canvas gradients and the 4-Colour Gradient by inverse-distance blending on a 64-px grid.
- Mock: `tests/mock/ae-expr.js` gains `rgbToHsl` / `hslToRgb`.

## 5t. ★ MOE layout (v0.17.0)
- `layouts.moe(app, s, body)` = `workspace(app, s, body, { contextBar: false, foot: false })` with `top = [menusRow(app, s), quickbar.strip(app), …tabs]`, the Command Bar's `menuPopover` as overlay and an F4 button as `titleExtra`. `menusRow` was pulled out of `bar()` so both layouts share it.

## 5s. Panel layouts (v0.16.0)
- `app/ui/layouts.js`: `LAYOUTS`, `layoutOf(app)` (settings `ui.layout`, unknown → `studio`), `build(app, s, layout, body)` → `{ top[], title, titleExtra, content, bottom, overlay, header }`. `HUB` (screens + `items`), `MENUS` (refs resolved by `actions.resolve`, `open` = sections), `MENU_FOR` (kind → highlighted menu), `DEFAULT_BARS` (store `cmd-bars`, Quick Bar ids), `WS` (task tabs, `owns` sections). View ids `hub-*`, `bar-ease`, `wsp-*` are layout-only screens; `home` / `kit` map onto them; `state.layLast` remembers the last section per screen; `state.layMenu` is the open Command Bar menu (Esc closes, positioned with `quickbar.fixedBox`, left or right anchored).
- `shell.render`: `layoutOf(app) !== 'studio'` → `renderLayout(s, layout, kept)` builds `.app.layout-<id>` (header, context strip, Quick Bar for Hub, parts, content, copilot, overlays) and morphs like the studio render. Views and kit blocks are reused as they are (`kit` exports `easeBlock`, `anchorBlock`, `alignBlock`, `toolsBlock`, `pinnedBlock`, `curveLibrary`, `toolButton`; `quickbar` exports `button`, `byId`, `fixedBox`).
- CSS: "v0.16 layouts" block in `css/app.css` (`.lay-*`), narrow rules keyed on `kit-narrow` / `kit-tiny` / `kit-wide`.

## 5r. Smart Home (v0.15.0)
- `app/ui/actions.js`: `FOCUS[kind]` = curated rows of action references (same `tile:` / `quick:` / `nav:` / `cmd:` refs as the pie, resolved by `resolve()` with its `ready()`), `FOCUS_BLOCKS[kind]` = kit blocks in focus (`ease` / `anchorAlign`). `profile(ctx)` gives the kind.
- `views/home.js` `smartRender()` → `kit.smartHome(app, kind, rows, head)`; `kit.smartHome` sets `K.scope = { ctx, focus }` while it builds, so `folded()` → pure `isFolded(prefs, scope, id)` (focus open by default; `prefs.ctxOpen[kind][id]` remembers the user's choice per kind; Fixed layout keeps `prefs.fold`). Zones are always in the same order; only the focus card's inside changes. `prefs.homeLayout`: smart | fixed.

## 5q. Per-segment curves + tidier panel (v0.14.0)
- `views/kit.js`: `K.seg` (0 = all, n = segment n) kept while the same keys are selected (`K.keysSig`); `curSeg()` feeds units / velocity; `selectSeg()` loads that segment's curve and ghost; `segStrip()`; overview click → `KG.segmentAt(segs, ovGeom(W).T(x))`. `applyCurve` sends `segment`. `motion.easeCurve` `prepare` slices the selected keys to `[seg − 1, seg]`.
- `kitGraph.js`: `overviewSamples(segs, cv, sel)`, `drawOverview(…, sel)` (selected band, others dimmed with their own curves), `segmentAt`, `ovGeom`.
- Folding: `prefs.fold[id]` + `foldTitle()`; `toolsBlock` renders `BAR.KIT_GROUPS` when no explicit id list is given.
- Quick Bar: `shell.applyDensity` measures `.qbar` width (`state.qbarW`, independent of its buttons); `quickbar.strip` fits buttons (28 px, group line 7 px, room for +N and ⚡); `restPopover` positions itself against `.app` (works in CEP and in the preview's framed panel). Store key `quick-bar-rows`: fit | wrap | one.

## 5p. Graphs together + Align+ (v0.13.0)
- `views/kit.js` `graph()` builds one `KG.widget` per visible mode (`value` with the spacing track, `speed` without it when both show); `onLive` / `onCommit` set the other widget, `onHover` → `widget.hover(u)`; `K.graph.set()` sets all. `syncLive()` keeps sliders, velocity fields, numbers and the overview live. Presets: `chip()` renders only `curveSvg()` (fits overshoot); `saveCurve()` (dedupe via `matchPreset`), `removeCurve()` + `undoChip()` (8 s).
- `kitGraph.js`: `geom(W, H, range, track)`, `st.label`, `st.hoverT`, `flipCurve()`, `wheelStep()` (Alt + wheel through `freeDrag`), range grows during a free drag with the sensitivity frozen at the press.
- `features/transform/math.js` `align(boxes, mode, to, comp, { gap })`: `to: 'key'` (first box), `space()` for `spaceH` / `spaceV`; `tools.js` keeps the selection order for the key layer.
- `app/ui/dom.js` `morph`: replaces an element when the OLD one is `data-fresh` too (its addEventListener handlers must not survive into a different element).

## 5o. Delay = C4D (v0.12.0)
- `features/kit/delay.js` v2: `MODES = even | blend | spring`; `evenWindow(s)` (n − 1)/2 = s/(1 − s) frames; the expression computes `now = src(time)` and the delayed `y`, then `out = now + (y − now) · w` with the field weight `w` from the **MOE Delay Field** Layer Control on the control layer (`fieldWeight()` is the pure mirror: smoothstep from radius to radius + falloff, × null scale, invertible). Position measures its place with `thisProperty.valueAtTime(time)` and Rotation / Scale with `transform.position` — never `toComp` of the layer itself, so no self / circular reference. The field null is created first (`layers.createNull`, goes on top) and every Layer Control index below it is shifted by one; restore removes it with `layers.remove onlyNamed`. `core/schema.js` enum params accept `aliases` (old saved value → new value).

## 5n. Free drag on the ease graph (v0.11.1)
- `views/kitGraph.js`: pure `zoneAt(u)` (u < 0.35 = out, > 0.65 = in, else both) and `freeDrag(cv0, zone, dx, dy, mode)` (relative to the curve at the press; Value mode moves x/y of one handle or both mirrored; Speed mode goes through `keySpeeds` / `fromSpeed`; result normalized by `BZ.normalize`). The widget starts a free drag when the press is > 14 px from a handle (`S.free`), `S.drag = 3` marks *both* for the live label; `st.zone` draws the zone band and its hint. `kit.js` `onLive` also syncs the influence sliders and the velocity fields.

## 5m. Delay + speed graph (v0.11.0)
- `features/kit/delay.js`: `expression(mode, prop)` builds the `// MOE Delay` expression (source = own pre-expression value via `thisProperty.valueAtTime`, or own value + the leader's change since 0; time shift = order × Delay frames; Blend = exponential smoothing per frame, Spring = semi-implicit Euler with 4 sub-steps; window ≤ 300 frames); `simulate()` is the plain-JS reference the tests compare the mock-evaluated expression with. Controls via `effects.ensure` (sliders + `MOE Delay Leader` Layer Control + `MOE Delay Order`).
- `views/kit.js` `autoRead` now reads every selected key (≤ 12) into segments (`segmentsOf`: dt, dv, average speed, curve) with the property's unit (`unitOf`); `kitGraph.drawOverview` / `overviewSamples` draw the whole animation; `velocity()` = Keyframe Velocity fields (real units ↔ relative speed via `fromSpeed`). `motion.easeCurve` gains `through` (pass-through speed at middle keys).

## 5k. Ease Curves, Anchor & Align (v0.9.0)
- `features/curves/bezier.js` (pure, tested): presets, `point` / `valueAt` / `speedAt`, `toTemporal(curve, { dt, dv, spatial })` → AE `KeyframeEase` speed + influence per side, `fromTemporal` (read a curve back), `segments(keys)`. `features/curves/tools.js`: `keyframes.read` (values + eases) → `toTemporal` per segment → `keyframes.setEase`; verify compares what was sent with what AE reports; restore = `keyframes.restoreEase`.
- `features/transform/math.js` (pure): the 9 anchor points, `align()` deltas from bounds, `cloneLayout()` (radial / linear / grid). `features/transform/tools.js`: Anchor, Align, Clone.
- Host `ops/transform.jsx`: `keyframes.setEase`, `layers.moveAnchor` / `restoreAnchor` (Δposition = R(rot)·S(scale)·Δanchor, position keys shifted; keyframed anchors skipped), `layers.nudge` / `restorePosition`, `layers.clone` / `unclone` (copies named `MOE Clone n · …`). One undo group per op; every op returns before / after snapshots.
- UI: `widgets.body['motion.easeCurve']` (canvas editor — drags draw directly, `setArgs` on pointer-up because the shell defers renders during a press), `widgets.body['transform.anchor']` (3 × 3 picker), thumbnails `bezier` / `anchor` / `align` / `clone`, sections `curves` (Animate) and `transform` (Layout).

## 5g. Distribution (v0.6.1)
- `installer/moe-motion-ai.nsi` → per-user Setup.exe; install folder = bundle id, so every version lands in the same place. `install.json` in that folder records the installer and version.
- `core/updater.js` (pure, injected `http` / `system`) + `platform.system` (Node: HTTPS-only download, SHA-256, detached launch, `extensionInfo`). The panel never replaces its own files: it hands a verified installer to Windows, which runs after After Effects quits (`/WAITAE`).
- `tools/build-release.js` → `dist/` (Setup.exe, portable zip, `latest.json`). User data lives outside the extension folder (`%APPDATA%\MOE Motion AI`), so updates and uninstall never touch it.

## 6. Data locations

`%APPDATA%\MOE Motion AI` — `quick-bar.json`, `brands.json`, `text-presets.json` + `presets/*.ffx`, `settings.json`, `favorites.json`, `presets.json`, `snippets.json`, `recipes.json`, `checkpoints.json` (last 50), `usage.json`, `history.jsonl`, `diagnostics.jsonl`, `secrets.dat` (DPAPI). Override with env `MOE_DATA_DIR`.

## 7. Repository structure

```
moe-motion-ai/
├─ CLAUDE.md  README.md  ARCHITECTURE.md  ROADMAP.md  FEATURES.md  CHANGELOG.md  TEST_REPORT.md
├─ docs/      PRD.md  CAPABILITY_AUDIT.md  UI_UX_SPEC.md  RISKS.md
├─ extension/                 ← the CEP extension (this folder is what gets installed)
│  ├─ CSXS/manifest.xml  .debug  index.html
│  ├─ css/tokens.css  css/app.css
│  ├─ lib/CSInterface.js      (Adobe, CEP 12)
│  ├─ app/main.js  app/ui/…   (panel UI)
│  ├─ core/…                  (services, executor, registry, AI, platform)
│  ├─ features/…              (motion, text, brand, proximity, select, adapt, grid, zoom, glass, quick, generate, compositing, expressions, toolfactory)
│  └─ host/…                  (ExtendScript)
├─ tests/                     (node:test, AE mock, fixtures)
├─ dev/                       (browser preview harness — not shipped)
└─ tools/                     (install-dev.ps1, lint-jsx, contrast check, dev server, screenshots)
```

## 8. Performance notes
- Host calls are serialized and small; selection reads are capped (`limits.maxLayers/maxProps`, expression text truncated).
- No polling while the pointer is outside the panel; light 1.5 s refresh only while hovering (AE exposes no selection-change event to CEP).
- Mutations are batched: one host call + one undo group per tool run (300-layer stagger = 1 call in tests).
