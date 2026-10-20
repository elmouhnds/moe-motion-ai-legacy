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
3. Response is constrained by a JSON schema whose steps are an `anyOf` of the AI-callable tools' arg schemas.
4. `validatePlan` re-validates every step locally (tool exists & callable, args schema, first step against current selection/permissions). Invalid plans cannot be approved.
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
