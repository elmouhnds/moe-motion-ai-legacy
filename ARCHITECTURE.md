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

`%APPDATA%\MOE Motion AI\` — `quick-bar.json`, `brands.json`, `text-presets.json` + `presets/*.ffx`, `settings.json`, `favorites.json`, `presets.json`, `snippets.json`, `recipes.json`, `checkpoints.json` (last 50), `usage.json`, `history.jsonl`, `diagnostics.jsonl`, `secrets.dat` (DPAPI). Override with env `MOE_DATA_DIR`.

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
