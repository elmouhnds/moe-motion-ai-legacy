# MOE Motion AI — Engineering Rules

Permanent rules for anyone (human or AI) working in this repository.

## Product
- MOE Motion AI is an **independent** After Effects 2025 panel. It has no runtime dependency on any other MOE product (Blender, Premiere) or any shared backend.
- It is a **workbench of real tools**, not a chatbot. AI is optional and contextual; every local tool must keep working with no internet and no API key.
- The UI is organized **by creative purpose** (Motion, Expressions, Tools). Never by technology: no "Offline" / "Online" / "AI" sections.

## Platform facts (verified, see docs/CAPABILITY_AUDIT.md)
- Target: After Effects 2025 (25.x) on Windows 11 → **CEP 12** (Chromium 99, Node.js 17.7.1) + **ExtendScript (ES3)**.
- UXP for After Effects is **not** available in AE 2025. Do not use UXP APIs. Re-evaluate when Adobe ships it (public beta announced for late 2026).
- Use only APIs documented in the After Effects Scripting Guide (docsforadobe.dev) and CEP 12 docs. **Never invent API methods.** When unsure, read the docs and cite them in code comments.

## Architecture rules
- `extension/host/` = ExtendScript only. ES3 syntax: no `let/const`, arrow functions, `JSON`, `Array.prototype.forEach/map/indexOf`, `Object.keys`, `String.trim`; **no ES3 reserved words as names or keys** (`final`, `default`, `class`, `int`, `short`, `char`, `native`…); **ASCII-only source** (use `\uXXXX` in strings). Run `npm run lint:jsx`. Host tests run in Node, which is more permissive than ExtendScript — the linter is the guard.
- The panel talks to ExtendScript **only** through `core/host/bridge.js` → `MOE_dispatch(op, argsJson)`. Only ops registered in `MOE.ops` can run. **No generic eval entry point, ever.**
- Host ops are small, explicit primitives. Business logic (targets, ordering, presets, verification) lives in JS tools so it is testable.
- Every capability is a **registered tool** (`core/registry.js` documents the contract). Add tools by adding a file in `extension/features/<module>/` and listing it in `features/index.js`. No giant files.
- Every tool runs through `core/executor.js`: validate → fresh context → requirements → permission → prepare → execute → **verify by read-back** → checkpoint → history.

## Safety rules
- Mutating tools must declare `recovery` and implement `verify()`. Recovery `undo+checkpoint` also needs `checkpoint()` + `restore()`.
- Wrap every mutating host op in one `app.beginUndoGroup / endUndoGroup` (try/finally).
- Address properties by `{ layerId, indices[], matchNames[] }` and verify matchNames on resolve. Refuse to write if the active comp changed (`compId` check).
- Never report success without reading the resulting host state. `status: success` only when `verify()` passes.
- AI output is untrusted input: plans/recipes may only reference registered `ai.callable` tools, and all args are re-validated locally. AI-originated changes always require user approval (hard rule in `permissions.js`).
- **No generated scripts are executed.** Tool Factory produces data-only recipes made of existing tools.
- Do not silently unlock layers, delete data, or scan the whole project. Read only the active comp + selection, with limits.
- Effects MOE adds are named `MOE …`, updated in place (never duplicated), and restorable. Never touch effects MOE did not create, except to *temporarily* bypass MOE's own colour effects during measurement (always re-enabled in `finally`).
- Effect parameters: resolve by English name first; match-name/order fallbacks only when the effect has the exact expected parameter count (`expectParams`). A host op that cannot resolve everything must remove what it added and fail with the parameter list.
- Arabic text: never animate per character by default (letters disconnect) — use Words/Lines; set RTL + universal composer when applying Arabic fonts.
- Never modify shared sources (e.g. `SolidSource.color`) as a side effect; use per-layer effects.
- Text animators, layers and effects MOE creates are named (`MOE In`, `MOE Out`, `MOE Brand Fill`, `MOE Prox …`, `MOE Effector N`, `MOE Grid N`, `MOE Adapt • …`, `MOE Zoom`, `MOE Spotlight N`, `MOE Cursor N`, `MOE Glass N [Tint|Rim|Shadow]`, `MOE Trim`, `MOE Counter`, `MOE Typewriter`, `MOE Icon • …`, `MOE Shape • …`, `MOE Background` with `MOE Gradient` / `MOE Mesh` / `MOE Grain`, `MOE Palette Fill`) and expressions are tagged (`// MOE Proximity`, `// MOE Grid`, `// MOE Glass`, `// MOE Expr`, `// MOE Zoom Follow`, `// MOE Counter`, `// MOE Background`) so they can be found, replaced and removed safely.
- Layout maths lives in pure modules (`features/grid/layouts.js`, `features/adapt/planner.js`); generated expressions must mirror it, and tests compare mock-evaluated expressions with the pure maths.
- Never claim AI generates images or video: Claude writes prompts; generation is a separate provider.
- Bundled third-party content keeps its licence next to it (`assets/icons/LICENSE-lucide.txt`, `assets/fonts/LICENSE-sora-OFL.txt`); regenerate icon data with `node tools/build-icons.js` from the pinned `lucide-static` dev dependency — never hand-edit `lucide.json`.
- UI colours come from tokens; every theme × accent must pass `tools/check-contrast.js`. Artwork (`app/ui/art.js`) draws with token colours so it follows themes (fixed colours only for illustrative swatches).
- Imported preset packs are untrusted: re-validate every preset against its tool's schema (`core/presetPacks.js`).
- Pixel measurement uses the documented probe pattern (temporary null + expression `sampleImage` + `valueAtTime`); the probe is removed in `finally` and the layer count is verified.

## AI / cost rules
- The API key lives only in the secret store (Windows DPAPI, `%APPDATA%\MOE Motion AI\secrets.dat`). Never in source, settings, logs, or history. The logger scrubs `sk-ant-…` patterns.
- Send compact context (`core/ai/contextPack.js`): active comp + selection, truncated expressions, no file paths.
- Keep system prompts deterministic (sorted tool catalog) so prompt caching works. Put volatile data in the user message.
- Default model `claude-opus-5-5`, effort `medium`, structured outputs (`output_config.format`). Forced `tool_choice` returns 400 on Opus 5.5 — do not use it.
- Respect the monthly budget gate in `core/ai/cost.js`.

## UI rules (v0.6.2 — learned from the flicker / dead-click report)
- Render through `app.scheduleRender()` / state changes; the shell **morphs** the DOM in place (`dom.morph`). Never clear and rebuild the root. Give list items and canvases a stable `data-key`.
- Event handlers go through `h(..., { onclick })` so morph can swap them; direct `addEventListener` only on inputs / textareas / selects (those are rebuilt) or elements marked `data-fresh`.
- No hover / active style may move or resize an element (no transform, margin, padding, size, flex changes) — it makes elements tremble under a resting pointer. Use colour, border, shadow, brightness.
- Anything that calls the host in the background must be throttled, adaptive to the host's answer time, and paused during pointer presses; AE runs ExtendScript on its main thread.
- `npm run stress` must pass before a release.

## Testing rules
- `npm run check` must pass before every commit (ES3 lint, contrast check, tests).
- Tests run the **real host .jsx** against `tests/mock/ae-mock.js`. That proves logic, not host behaviour. Never describe mock results as After Effects results.
- Host-verification status lives in `TEST_REPORT.md`. Update it honestly: what ran where, what is still unverified.
- Never fabricate test results.

## Release rules
- Ship only through `npm run release` (installer + feed). All five version strings must match; the staged build never contains `.debug` (it opens a remote-debugging port).
- The install folder is always the bundle id (`tv.madtomato.moe.motionai`); never install side-by-side copies. User data stays in `%APPDATA%\MOE Motion AI`, outside the extension folder.
- The update feed is untrusted: HTTPS only, product id + semver + size + SHA-256 checked, mismatching downloads deleted, and the installer only starts after the user clicks.

## Docs to keep current
`ROADMAP.md`, `FEATURES.md`, `CHANGELOG.md`, `TEST_REPORT.md`, `ARCHITECTURE.md` — update in the same commit as the change.

## Communication
- Talk to the product owner in Egyptian Arabic; keep technical names and code in English.
