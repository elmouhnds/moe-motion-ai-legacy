# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

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
