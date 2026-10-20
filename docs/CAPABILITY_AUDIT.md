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
| `LayerCollection.addNull()`, `Layer.remove()` | Temporary probe layer (compositing analysis) |
| `PropertyGroup.addProperty()` / `canAddProperty()` on `ADBE Effect Parade` (indexed group is rebuilt on add — references re-fetched by `propertyIndex`) | Add effects |
| `PropertyBase.name` (settable on effects — children of an indexed group), `moveTo()`, `remove()`, `enabled` | Name, order, restore and bypass MOE effects |
| `Property.valueAtTime(t, false)` — waits for `sampleImage` (AE 13.6+) | Read probe colours |
| `Property.setValue()`, `Property.value` | Effect parameters |
| `Project.bitsPerChannel` | 8-bpc warnings |
| Expression `sampleImage(point, radius, postEffect, t)` (expression language, not scripting) | Pixel sampling |
| Effect match names (Scripting Guide › Match Names › Effects): `ADBE CHANNEL MIXER`, `Keylight 906`, `ADBE KeyCleaner`, `ADBE Spill2`, `ADBE Simple Choker`, `ADBE Color Control` (param `ADBE Color Control-0001` as in the guide's own example) | Compositing effects |

| `TextDocument.font / fillColor / applyFill / strokeColor / direction (24.0+) / composerEngine (24.0+)`, `app.fonts.allFonts`, `FontsObject.getFontsByPostScriptName`, `FontObject.writingScripts` (`CTScript.CT_ARABIC_SCRIPT`) | Brand fonts and colours |
| Text animator match names (Scripting Guide › Match Names › Text layer, and confirmed in the owner's `.ffx`): `ADBE Text Animators/Animator/Selectors/Selector/Percent Start/End/Offset/Range Advanced/Range Type2/Range Shape/Levels Max Ease/Levels Min Ease/Selector Smoothness/Randomize Order/Animator Properties/Position 3D/Scale 3D/Rotation/Opacity/Blur/Tracking Amount/Skew` | Text animation presets |
| `Layer.applyPreset(File)` — applies to the comp's *selected* layers | Imported `.ffx` |
| `ADBE Root Vectors Group`, `ADBE Vector Graphic - Fill/Stroke`, `ADBE Vector Fill/Stroke Color` | Shape colours |
| `Layer.label/solo/enabled/locked/shy/comment/guideLayer/motionBlur`, `app.project.selection`, `app.preferences.getPrefAsString` (label names, as in Moe Selector v5), `app.effects` | Select module |
| `AVLayer.sourceRectAtTime()` | Center Anchor |

Effect *parameter* match names are not documented per effect (except the Slider Control example). MOE resolves them at runtime and reports the method; see docs/features/COMPOSITING.md §3.

*Verify in host*: (1) `expressionError` is populated synchronously right after assigning `expression` (used by Validate/Apply). (2) `CompItem.selectedLayers` order reflects selection order (used by Stagger "Selection" order). (3) `propertyIndex` is valid on named groups (we fall back to matchName lookup either way). (4) Channel Mixer English parameter names are `Red-Red … Blue-Const` + `Monochrome` (13 params) and values are percent. (5) Keylight's first COLOR parameter is *Screen Colour*. (6) Simple Choker parameter 2 is *Choke Matte*. (7) Speed of `valueAtTime` + `sampleImage` on heavy layers. (8) Range Selector advanced popup values (Based On 1–4, Shape 1–6) set by number — confirmed by the owner's `.ffx`, not yet by a script run. (9) `applyPreset` with our temporary selection. (10) Label-name preference keys. (11) Tint/Gaussian Blur English parameter names used by Proximity.

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
