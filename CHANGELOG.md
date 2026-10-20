# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

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
