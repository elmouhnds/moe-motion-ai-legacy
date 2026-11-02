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
- Text animators, layers and effects MOE creates are named (`MOE In`, `MOE Out`, `MOE Brand Fill`, `MOE Prox …`, `MOE Effector N`, `MOE Grid N`, `MOE Adapt • …`, `MOE Zoom`, `MOE Spotlight N`, `MOE Cursor N`, `MOE Glass N [Tint|Rim|Shadow]`, Thick Glass `MOE Glass N [Map|Prism R|Prism B|Reflect|Highlights|Shadow|Caustic]` + the pre-comp `MOE Glass N Map`, `MOE Trim`, `MOE Counter`, `MOE Typewriter`, `MOE Icon • …`, `MOE Shape • …`, `MOE Background` with `MOE Gradient` / `MOE Mesh` / `MOE Grain`, `MOE Palette Fill`, `MOE Clone n · <layer>`, `MOE Vignette`, `MOE Stare Target`, `MOE Delay …`, `MOE BG Loop` / `MOE BG Amount` / `MOE BG Colour`, `MOE Grid Twist` / `MOE Grid Delay`, `MOE Clone Colour`, `MOE Audio · <layer>`, `MOE Word n · <layer>` / `MOE Letter n · <layer>`) and expressions are tagged (`// MOE Proximity`, `// MOE Grid`, `// MOE Glass`, `// MOE Expr`, `// MOE Zoom Follow`, `// MOE Counter`, `// MOE Background`, `// MOE Stare`, `// MOE Delay`, `// MOE Clone Colour`) — Trash (`rigs.remove`) relies on these tags and names so they can be found, replaced and removed safely.
- Layout maths lives in pure modules (`features/grid/layouts.js`, `features/adapt/planner.js`); generated expressions must mirror it, and tests compare mock-evaluated expressions with the pure maths.
- Never claim AI generates images or video: Claude writes prompts; generation is a separate provider.
- Bundled third-party content keeps its licence next to it (`assets/icons/LICENSE-lucide.txt`, `assets/fonts/LICENSE-sora-OFL.txt`); regenerate icon data with `node tools/build-icons.js` from the pinned `lucide-static` dev dependency — never hand-edit `lucide.json`.
- Design system (v0.23, docs/features/DESIGN_SYSTEM.md): controls are 24 / 28 / 32 px (`--h-s/m/l`), icons 12 / 14 / 16 / 20 (`--ic-*`), corners `--r` 6 / `--r-lg` 8 / pill — never a new size. Generic icons come from Lucide via `tools/build-ui-icons.js` (add to its `MAP`, re-run; never hand-edit `icons-ui.js`); draw a MOE icon only for a motion idea Lucide has no word for (16 grid, 1.5 px, outline). In a Classic action group, mark at most two primary actions (`hero`) and rare ones as `minor`.
- Brand import (v0.25, docs/features/BRAND_IMPORT.md): web content is untrusted data — HTTPS only through `platform.http.get` (size-capped, no execution, parsed as text), sent to Claude labelled as data; every AI field is re-validated in `scan.cleanAI`; nothing is saved or written to AE until the user clicks Save. Keep the no-AI local scan working for websites. Brand application (v0.26, docs/features/BRAND_IN_ACTION.md) goes through `brand.applyAll` / `brandRoles` — colours by role are always contrast-checked against the background; never change a shared solid source (use *MOE Brand Fill*); brand actions resolve from the active client (`kit.activeBrand`).
- UI colours come from tokens; every theme × accent must pass `tools/check-contrast.js`. Artwork (`app/ui/art.js`) draws with token colours so it follows themes (fixed colours only for illustrative swatches).
- Imported preset packs are untrusted: re-validate every preset against its tool's schema (`core/presetPacks.js`).
- Ease maths lives in `features/curves/bezier.js` (pure, tested): a curve becomes AE temporal ease per segment (influence from the handle's time, speed from slope × average speed). Position takes one non-negative speed — never pretend an overshoot was applied there; report it.
- Transform changes that must not move pixels (anchor) compensate position with the layer's own scale and rotation (2D, maths) or measure it with AE's own `toWorld` / `fromWorld` through a temporary probe (3D-rotated / auto-oriented); every Position key shifts. When scale / rotation animate, the result is exact at the playhead and the report says so — never silently.
- Micro-tools (Motion Kit) act in one click on the selection — no tiles, no Apply step; options on right-click; modifier variants (Shift / Ctrl / Alt) instead of more buttons. Study the reference tools before designing a new one (docs/features/MOTION_KIT.md).
- Grid (v0.19): one expression holds all layouts (`grid/expressions.js buildAll`); `grid/layouts.js` (`place`, `placeMorph`, `modifiers`) is its reference — change both together; tests compare mock-evaluated values with it. Reordering rewrites only `var i = N`. Never build a grid from items already in one.
- Background motion (`features/design/bgMotion.js`) must loop exactly: build every term from sin / cos of 2π·time / Loop and whole multiples; vector maths with `add()`, never `array + array` (text in AE's JavaScript engine); tests compare mock-evaluated expressions with `pointAt` / `colorAt`.
- Simulation expressions (Delay) must stay bounded (≤ 300 frames per evaluation) and have a plain-JS reference that tests compare against.
- Two panels (main + Motion Kit) share one data folder: the store re-reads a document when the other panel rewrote it, and settings re-read before an update. Never cache a document forever.
- Thick Glass (v0.27, docs/features/THICK_GLASS.md): effects that read another layer (CC Glass Bump Map) get its source only — no effects, masks or transforms — so the height map is a pre-comp (`glass.map`) whose copy is linked to the source by expressions; keep `thick.mapTransform` and the precision test together. Only `glass.removeMap` deletes project items, and only `MOE Glass N Map` comps nothing else uses.
- Pixel measurement uses the documented probe pattern (temporary null + expression `sampleImage` + `valueAtTime`); the probe is removed in `finally` and the layer count is verified.

## AI / cost rules
- The API key lives only in the secret store (Windows DPAPI, `%APPDATA%\MOE Motion AI\secrets.dat`). Never in source, settings, logs, or history. The logger scrubs `sk-ant-…` patterns.
- Send compact context (`core/ai/contextPack.js`): active comp + selection, truncated expressions, no file paths.
- Keep system prompts deterministic (sorted tool catalog) so prompt caching works. Put volatile data in the user message.
- Default model `claude-opus-5-5`, effort `medium`, structured outputs (`output_config.format`). Forced `tool_choice` returns 400 on Opus 5.5 — do not use it.
- Respect the monthly budget gate in `core/ai/cost.js`.

## UI rules (v0.6.2 — learned from the flicker / dead-click report)
- Render through `app.scheduleRender()` / state changes; the shell **morphs** the DOM in place (`dom.morph`). Never clear and rebuild the root. Give list items and canvases a stable `data-key`.
- Event handlers go through `h(..., { onclick })` so morph can swap them; direct `addEventListener` only on inputs / textareas / selects (those are rebuilt) or elements marked `data-fresh` (morph replaces an element when the old OR the new one is `data-fresh` — never reuse one for a different element).
- No hover / active style may move or resize an element (no transform, margin, padding, size, flex changes) — it makes elements tremble under a resting pointer. Use colour, border, shadow, brightness.
- Anything that calls the host in the background must be throttled, adaptive to the host's answer time, and paused during pointer presses; AE runs ExtendScript on its main thread.
- `npm run stress` must pass before a release.
- Library sections end with the sticky action bar (`library.actionBar`); tiles show readiness from the tool's own `requires` + `prepare` — never a separate rule list.
- A run the user may want again passes `{ label }` to `app.runTool` so F4 / ↻ can name it.
- Run `node tools/audit-ui.js` (and `tools/audit-summary.js`) after UI changes: 0 JS errors, 0 unreachable or unnamed controls.
- One-click entry points (pie, Home suggestions, search) go through `app/ui/actions.js` and its `ready()` check; keep the smart pie sets at 8 fixed positions (direction is the memory).
- New sections belong to a workspace in `studio/sections.js` `WORKSPACES` and to a `workflow.STAGES` group.
- Classic's tabs and groups (docs/features/AE_CLASSIC_LAYOUT.md, `app/ui/layoutAE.js`) are the shared organisation of every style (Bento is the default style since v0.25): tabs and groups use After Effects' own words; a new tool goes into the group of the tab whose AE menu it belongs to (Animation → Animate, Layer → Layer, Effect → Effect, Composition → Comp). Tab ids are `ae-*` (never a page id). No banners or marketing copy in Classic. Every tab action must also appear in its ▾ quick menu (`tabItems`); do not add new styles unless the owner asks. The styles are **Bento (default) · Glass · MOE** — v0.29 removed the retired ones from the code (`layouts.RETIRED` → Bento at start-up). A change to the tools must work in all three (they share `layoutAE` data). A style proposal reuses `layoutAE` data and building blocks and keeps its CSS scoped in `css/styles.css`. Groups move only when the user moves them (`ae-order`); ▸ Recent stays one fixed-height row and never reorders from its own clicks — a new runnable button in a group must call `remember()` with a ref `recentItem` can resolve (tests check the ▾ menu refs).
- Workflow Home (v0.28, docs/features/WORKFLOW_HOME.md): distance = how often it is used. A new `layoutAE` group must also be placed in exactly one `workflow.STAGES` stage (`core` if a motion designer needs it daily, `more` if rare) — tests check it. Only deep features that need explaining get a `POWER` card (what · when · needs · 3 steps · real `open` / `try` refs). The first ten of `quick/bar.DEFAULT_BAR` are `workflow.EVERYDAY` (Alt+1…0) — never put housekeeping there. Nothing reorders by itself except NOW (selection); cards only shrink when learned.
- Assistant (v0.28, docs/features/ASSISTANT.md): one floating button in every style; plans go through `planner.validatePlan` and need approval like the Copilot; suggestions are a badge, never a pop-up; the offline path (`workflow.keywordsOf` → Ctrl+K results + Power cards) must keep working with no key. Arabic keyword patterns match whole words.
- One place per tool (v0.29, docs/features/FEWER_CLEARER.md): a Quick action may not copy a library tile or another action (same tool + args — `tests/fewer.test.js`); a preset goes on the Quick Bar as the tile itself (`tile:<section>/<id>`). Removing or renaming an id needs a `bar.MIGRATE` entry so saved bars, pins, pie and Recent keep working. A new section must be reachable from a stage and from MOE's tabs — `tests/layouts.test.js` checks it.
- Motion Control (v0.30, docs/features/MOTION_CONTROL.md): space follows content — the graph grows, small tools (anchor 3×3, align icons) sit in a rail inside the same block; ease / anchor / align live only in the Motion Control (`layoutAE.controlTop`), never again as separate groups. Ease Copy goes through `motion.pasteEase` (same engine as Ease Curve). Tools are ordered by function and the sequence of the work: a tool that commonly follows another goes into `workflow.NEXT` (≤ 4 refs, tested).
- Space follows content (v0.31, docs/features/SPACE_FOLLOWS_CONTENT.md): a group's size follows what it holds — opposite moves are one block with a switch (Animate In / Out / Draw On), opposite actions one pair control (Flip), related actions one labelled row (Loop), icon-only tool tiles are buttons, tile grids use `tileCols` (no orphan tile). A tool appears once across the tabs (tested in `tests/space.content.test.js`); never add a group that repeats the Motion Control (ease / anchor / align / curve library). Empty Recent is not rendered.
- Library pages (v0.32, docs/features/LIBRARY_PAGES.md): settings open where you click — beside the tiles from 600 px (`studioWide`), under the clicked row when narrower (`library.js` / `shapes.js` splice the Inspector after the row; columns are explicit so the row is known). A library whose tiles serve different jobs gets `modes` (one set at a time) instead of filter chips; icon-only tool tiles render as rows with their hint. Keep filters on one line.
- Cloner + Effectors (v0.33, docs/features/CLONER_EFFECTORS.md): the direction is advanced tools for pro results (owner, after mCloner Pro). Extend an existing engine before adding a tool (the Cloner is `grid.build clones`, not a new tool). Effector maths lives in `features/grid/effectors.js` (`apply` is the reference, `code()` the expression) — change both together; tests compare mock-evaluated expressions with it. Use a hash (`hs`), not a seeded LCG's first value, for per-item randomness. Grid item expressions are `· v3`; upgrade older ones with `factsOf` (never move an item). Grid effector nulls are `MOE Effector N` with an `Effector Type` control (Proximity's effector nulls share the name without it).
- Clone Colours (v0.34, docs/features/CLONE_COLOURS.md): colour per clone is one `MOE Clone Colour` Fill per item whose Color expression (`effectors.colourCode`) reads the grid null's Colour Mode / Colour 1–4 / Colour Seed and each effector's Colour × Colour Mix; `paletteColour` + `colourWithEffectors` are its reference — change them together. Effectors without colour controls (v0.33) must keep working (try / catch).
- Spring / Inertia Effector (v0.35, docs/features/SPRING_EFFECTOR.md): a spring is a step-response sum over the effector's own past (`effectors.springTerms`), bounded by `SPRING` (≤ 60 samples, ≤ 3 s, Decay ≥ 2) — never an unbounded frame loop. Each effector's result is one function of time (`termsAt` / `TQ`); add new effector behaviour there so the spring follows it. Spring 0 must stay the plain maths; effectors without Spring controls must keep working.
- Target & Audio Effectors (v0.36, docs/features/TARGET_AUDIO_EFFECTORS.md): new effector types are appended to `effectors.TYPES` (never reorder — the menu index is stored in AE) and handled in `termsAt` + `TQ` together. Audio comes only from After Effects' own Convert Audio to Keyframes (`audio.amplitude`, menu command found by name, never an invented id); the amplitude layer is `MOE Audio · <layer>`, reused, and removed on restore only by the run that made it.
- Object & Text Cloner (v0.37, docs/features/OBJECT_TEXT_CLONER.md): new layouts are appended to `layouts.MODES` (the menu index is stored in AE) with their maths in `rawPlace` and `lay()` together. Text is split only by `text.split` (measured with sourceRectAtTime on a temporary duplicate, never guessed); Arabic is split by words only; the source text layer is hidden, never deleted, and restore brings it back. In Place must not move anything — its read-back compares comp boxes, not values.
- Expression buttons on the Quick Bar carry their preset's own numbers (`quickbar.tileAction`, `bar.resolve` for Kit rigs) — never let a form default replace them.

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
