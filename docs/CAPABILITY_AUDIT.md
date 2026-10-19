# Technical Capability Audit — After Effects 2025 (Windows 11)

Date: 2026-10-19. Environment of this audit: a Linux cloud sandbox **without After Effects**. Nothing below was observed in a running AE; it is based on official documentation and published Adobe sources. Items marked *verify in host* must be confirmed on the target machine (see TEST_REPORT.md → Host checklist).

## Extensibility options

| Option | Available in AE 2025? | Use in MOE | Source |
|---|---|---|---|
| **CEP 12** HTML panels | Yes. CEP 12 lists After Effects 25.0. Runtime: CEF 99 / Chromium 99, Node.js 17.7.1, NW 0.62.1 | **Primary UI runtime** | Adobe CEP-Resources, *CEP 12 HTML Extension Cookbook* |
| **ExtendScript** (AE Scripting DOM) | Yes (ES3 engine) | **Host access layer** | After Effects Scripting Guide (docsforadobe.dev) |
| UXP | No for AE 2025. Adobe's Sept 2026 developer-blog post announces a UXP public beta for After Effects "by November 2026" and CEP retirement at end of 2029 | Not used. Architecture keeps host access isolated so a UXP host adapter can be added later | Adobe Developer Blog, 2026-09 (fetched via search summary; full page not reachable from sandbox) |
| C++ AEGP / Effects SDK | Yes | Not needed for v1 (no custom effects/renderers) | AE SDK |

## CEP 12 facts used
- Manifest: `RequiredRuntime CSXS 12.0`, Host `AEFT` range `[25.0,99.9]`.
- Node enabled with `<CEFCommandLine>` `--enable-nodejs` + `--mixed-context` (Node globals available in the page).
- Unsigned dev loading: `HKEY_CURRENT_USER\Software\Adobe\CSXS.12` → `PlayerDebugMode` = `1` (string).
- Per-user install folder: `%APPDATA%\Adobe\CEP\extensions`.
- Remote debugging via `.debug` file (port 8099 chosen).
- Community reports (not official) mention "Unsupported Manifest version" issues on some 25.6.x macOS builds and the CEP log reporting PlugPlug 12.0.1.2. *Verify in host* on Windows: panel loads with `ExtensionManifest Version="12.0"`; fallback is manifest version `11.0`/`7.0` with the same contents.

## ExtendScript APIs used (all documented in the AE Scripting Guide)
| API | Used for |
|---|---|
| `app.version`, `app.buildNumber`, `app.buildName`, `app.isoLanguage`, `$.os`, `$.version` | Diagnostics |
| `app.project.activeItem instanceof CompItem`, `CompItem.selectedLayers`, `CompItem.selectedProperties`, `frameRate`, `frameDuration` | Selection context (no project scan) |
| `Project.expressionEngine` (AE 16.0+) | Tell Claude which expression engine |
| `Layer.id` (AE 22.0+), `Layer.index`, `startTime`, `locked`, `parent`, `threeDLayer` | Stable layer identity, timing |
| `PropertyBase.propertyIndex / propertyDepth / parentProperty / matchName / propertyGroup()` | Property addressing |
| `Property.selectedKeys`, `numKeys`, `keyTime()`, `propertyValueType`, `isSpatial` | Keyframe targeting |
| `Property.keyIn/OutTemporalEase()`, `setTemporalEaseAtKey(i, in[], out[])`, `new KeyframeEase(speed, influence)` | Smart Ease. Array length: 2 for `TwoD`, 3 for `ThreeD`, else 1 (spatial = 1). Influence range 0.1–100 |
| `keyIn/OutInterpolationType()`, `setInterpolationTypeAtKey()` | Ease needs Bezier sides; HOLD preserved |
| `Property.expression`, `expressionEnabled`, `expressionError`, `canSetExpression` | Expression apply / validate with the real engine |
| `app.beginUndoGroup / endUndoGroup` | One undo step per tool run |

*Verify in host*: (1) `expressionError` is populated synchronously right after assigning `expression` (used by Validate/Apply). (2) `CompItem.selectedLayers` order reflects selection order (used by Stagger "Selection" order). (3) `propertyIndex` is valid on named groups (we fall back to matchName lookup either way).

## Claude API facts used
- `POST https://api.anthropic.com/v1/messages`, headers `x-api-key`, `anthropic-version: 2023-06-01`.
- Default model `claude-opus-5-5` ($4 / $20 per MTok, cache read $0.20); alternatives `claude-sonnet-5-5`, `claude-haiku-5-5`.
- Opus 5.5: thinking is always adaptive (no `thinking` param), effort default `medium`, **forced `tool_choice` returns 400** → structured outputs (`output_config.format: {type: "json_schema"}`) used instead.
- Server-side refusal fallback: `fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01` (Opus 5.5 / Sonnet 5.5 on the Claude API).
- Prompt caching via `cache_control: {type: "ephemeral"}` on the stable system block; hits visible in `usage.cache_read_input_tokens`.
- Structured-output JSON Schema: no numeric/length constraints → limits are stated in descriptions and enforced locally.

## Environment inspection result
- After Effects: **not accessible** from this sandbox (Linux container). Installed version could not be inspected. The panel's Diagnostics view reports `app.version` / build once installed.
- Node 22 / npm 10 available here for tests; Chromium (Playwright) used for UI preview screenshots only.
