# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

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
