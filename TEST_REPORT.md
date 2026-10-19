# Test Report

Last run: 2026-10-19 (v0.2.0), Linux cloud sandbox (Node 22.22.0). **After Effects was not available in this environment.**

## Summary

| Layer | How it was tested | Result |
|---|---|---|
| ExtendScript host ops (`extension/host/*.jsx`) | Real .jsx files executed in a Node `vm` against `tests/mock/ae-mock.js` (AE object model mock written from the Scripting Guide) | 78/78 automated tests pass (all suites) |
| ES3 compatibility of host files | `npm run lint:jsx` — parses with acorn `ecmaVersion: 3`, rejects ES5+ runtime APIs | Pass (8 files) |
| Core (registry, schema, permissions, executor, storage, logger, bridge) | Unit + integration tests | Pass |
| Claude integration | Mocked HTTPS responder: request shape, retries, refusal, truncation, 401, offline, budget | Pass — **no real API call was made** |
| Panel UI | Browser preview (`dev/preview.html`) with the real UI code + real host .jsx on the mock; Playwright clicks through 19 scenarios; zero page/console errors | Pass — **not the CEP runtime** |
| Colour contrast | `tools/check-contrast.js`, WCAG, both themes | Pass |
| **Inside After Effects 2025** | — | **Not run yet** |

What the mock proves: our logic, argument handling, ES3 syntax, undo-group balance, verification and restore paths.
What it does not prove: real AE behaviour (timing of `expressionError`, selection order, CEP loading, Node in CEP, DPAPI, network from AE).

## Automated tests (npm test)

- ✅ Request shape: structured output, cached system prompt, fallback, key only in header
- ✅ System prompt is deterministic (prompt-cache friendly)
- ✅ Plan schema only allows AI-callable tools
- ✅ Copilot: plan validated → approved → executed → verified → rolled back
- ✅ Copilot: hallucinated tools and bad args are rejected before approval
- ✅ Copilot: agent-origin changes need approval
- ✅ API failures: no key, 401, refusal, truncation, retry on 429, offline
- ✅ Cost monitor: pricing math and monthly budget gate
- ✅ AI disabled in settings: AI blocked, local tools unaffected
- ✅ Expression Assistant returns code for diff without touching the host
- ✅ AT1 Analyze: known mean colour, probe removed, project unchanged
- ✅ AT2 Analyze: detects warm cast and black/white points on a gradient
- ✅ AT3/AT4 Grade neutral: identity Channel Mixer, re-run updates in place
- ✅ AT5 Grade auto balance: measured warm mean maps to neutral grey
- ✅ AT6 Restore: removes a created grade; restores previous values after an update
- ✅ AT7 Match Color: target stats transferred to reference; MOE Match placed before MOE Grade
- ✅ AT8 Match Color blocked: reference = target, missing, or not visible now
- ✅ AT9 Screen Key: samples green, builds Keylight → Cleaner → Spill → Choke, no duplicates on re-run
- ✅ AT9b Screen Key goes before an existing MOE Grade
- ✅ AT9c Screen Key: no screen visible → clear error, nothing added
- ✅ AT10 Screen Key blocked on layers with a user keyer, and on null/camera layers
- ✅ AT11 Unresolvable parameter: no effect left behind, error lists the parameters
- ✅ AT12 Non-English parameter names resolve by match-name convention and are flagged
- ✅ AT13 Permission: modify.effects Off blocks; Copilot origin needs approval
- ✅ AT14 Look from Words: sends measured stats, validates/clamps values, never writes; offline is clean
- ✅ AT15 Copilot plans with compositing.grade and the plan validates
- ✅ AT16 Backwards compatibility: old settings file gains the new scope; existing tools unchanged
- ✅ Adjustment layers: manual grade allowed, auto options blocked
- ✅ Colour math: transfer, saturation and contrast behave as documented
- ✅ effects.ensure rolls back its own changes when a later layer fails
- ✅ Conflict: keyed layers are measured after the key (subject only), with MOE Grade/Match bypassed
- ✅ Conflict: Match Color refuses an unkeyed green-screen layer, writes nothing
- ✅ all built-in tools pass registry validation
- ✅ registry rejects incomplete or unsafe definitions
- ✅ search ranks name matches first
- ✅ schema: defaults, coercion, bounds, unknown keys
- ✅ permissions: agent can never modify silently; deny wins
- ✅ context requirements produce human reasons
- ✅ logger scrubs API keys
- ✅ host literal is ASCII-only and ES3-safe
- ✅ Apply expression: applied + verified, checkpoint restores originals
- ✅ Apply expression: engine error → reverted and reported as failed
- ✅ Validate: reports syntax errors and leaves the property unchanged
- ✅ Inspect and Remove
- ✅ Expression Assistant works offline-safely: clear error, no host change
- ✅ host loads and answers ping
- ✅ context.get reads only the selection, with stable addresses
- ✅ context.get with no project / no comp returns empty context, not an error
- ✅ unknown host op is rejected
- ✅ arguments cannot inject ExtendScript
- ✅ stale address is detected by matchName verification
- ✅ comp switch between read and write is refused
- ✅ Smart Ease: correct dimension count per value type, verified by read-back
- ✅ Smart Ease: HOLD sides are preserved, not converted
- ✅ Smart Ease: checkpoint restores exact previous ease and interpolation
- ✅ Smart Ease: invalid params never reach the host
- ✅ Smart Ease: blocked when no keyframes selected
- ✅ Stagger: frame-exact at 23.976 fps
- ✅ Stagger: frame-exact at 24 fps
- ✅ Stagger: frame-exact at 25 fps
- ✅ Stagger: frame-exact at 29.97 fps
- ✅ Stagger: frame-exact at 30 fps
- ✅ Stagger: frame-exact at 50 fps
- ✅ Stagger: frame-exact at 59.94 fps
- ✅ Stagger: frame-exact at 60 fps
- ✅ Stagger: selection order and reverse order
- ✅ Stagger: random order is reproducible with a seed
- ✅ Stagger: locked layers are skipped and reported
- ✅ Stagger: keyframes move with the layer, and restore puts them back
- ✅ Stagger: large selection (300 layers) completes in one host call
- ✅ Context limit: selections beyond maxLayers are truncated and flagged
- ✅ History records verified runs
- ✅ store: atomic JSON docs, jsonl logs, corrupt file recovery
- ✅ secrets (non-Windows fallback): stored outside source, mode 0600, clearable
- ✅ recipe validation: binds params, rejects unknown tools/params/non-callable tools
- ✅ recipe save → preflight → run (no AI needed) → history
- ✅ Tool Factory draft conversion keeps Claude output untrusted
- ✅ Copilot plan → saved recipe

Coverage against the requested test areas:

| Area | Covered by |
|---|---|
| Keyframes | Smart Ease dims per type (OneD / ThreeD / ThreeD_SPATIAL), HOLD preservation, restore exactness |
| Expressions | apply / engine error revert / validate / inspect / remove / restore |
| Parenting | Context reports `parentIndex`; no tool changes parenting yet — **no dedicated test** |
| Different FPS | Stagger frame-exact at 23.976, 24, 25, 29.97, 30, 50, 59.94, 60 |
| Property types | OneD, ThreeD, ThreeD_SPATIAL; mock rejects wrong ease array sizes like AE does |
| Existing animations | Keys move with layer on stagger and return on restore; existing ease/interp restored exactly |
| Undo behaviour | Undo-group open/close balance and labels asserted; **real Edit › Undo not testable without AE** |
| API failures / offline | 401, 429 retry, refusal, max_tokens, network down, disabled, no key, budget |
| Large selections | 300-layer stagger in one host call / one undo group; 250-layer context truncation |

### Compositing module (v0.2.0) — acceptance tests from docs/features/COMPOSITING.md §7
| AT | Result (mock host) |
|---|---|
| 1 Analyze: known mean, probe removed, project unchanged | ✅ |
| 2 Cast + black/white detection | ✅ |
| 3–4 Neutral grade = identity mixer; re-run updates in place | ✅ |
| 5 Auto balance neutralises measured mean | ✅ |
| 6 Restore: created → removed, updated → previous values | ✅ |
| 7 Match: transferred mean = reference mean; Match before Grade | ✅ |
| 8 Match blocked (self, missing, not visible now) | ✅ |
| 9 Screen Key: sampled colour, chain order, no duplicates, placed before Grade, no-screen error | ✅ |
| 10 Blocked on user keyer / null / camera | ✅ |
| 11 Unresolvable parameter → nothing left behind, parameter dump | ✅ |
| 12 Non-English names → match-name fallback, flagged | ✅ |
| 13 Permission Off blocks; Copilot needs approval | ✅ |
| 14 Look from Words: stats sent, values clamped/validated, no writes, offline error | ✅ |
| 15 Copilot plan with compositing.grade validates | ✅ |
| 16 Old settings gain `modify.effects`; existing tools unchanged (all 56 earlier tests still pass) | ✅ |
| 17 UI preview Comp at 260/360/560 px, layer picker | ✅ (preview, not CEP) |
| Extra: host rollback on mid-call failure; keyed-layer measurement with bypass; unkeyed screen refused for Match | ✅ |

Mock limitations specific to this module: the mock's `sampleImage` averages a procedural image; its Keylight is a colour-distance threshold and its Channel Mixer applies the documented affine maths. Real Keylight quality, real Channel Mixer units, and real parameter names are **not** proven here.

## UI preview scenarios (node tools/screenshot.js)
motion, motion-compact (260 px), motion-wide (560 px), expressions, copilot plan, copilot executed, expression assistant diff, tool factory draft, history after a run, settings, diagnostics, command palette, light theme — screenshots in `dev/screens/` (git-ignored). The AI scenarios use canned responses (`dev/demo-ai.js`, preview only).

## Host checklist (run on Windows 11 + After Effects 2025)
Record results here with AE version/build from the Diagnostics view.

1. `powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1`, restart AE → *Window › Extensions › MOE Motion AI* appears and opens.
2. Diagnostics shows AE version, build, host module 0.1.0, runtime `cep-node`, Node v17.x.
3. Context strip updates when selecting layers / properties / keys (hover the panel).
4. Smart Ease on Position (spatial), Scale (3D), Opacity (1D), a Color property, a Shape path: graph editor shows the influence; one *Edit › Undo MOE: Smart Ease* reverts it; History › Restore reverts it exactly.
5. Smart Ease on a key with HOLD out-interpolation keeps HOLD.
6. Stagger at 23.976 and 29.97 fps: layers land exactly on frames; locked layer untouched; Undo reverts in one step.
7. Stagger order "Selection": does AE return `selectedLayers` in click order? (record)
8. Apply `thisComp.layer("Nope").position` → reported error and reverted (confirms `expressionError` is synchronous).
9. Validate a valid and an invalid expression → original expression unchanged.
10. Settings › Save key → `%APPDATA%\MOE Motion AI\secrets.dat` contains `"protection":"dpapi"`; Diagnostics shows no key in logs.
11. Copilot: "make the selected keys snappy" → plan → Approve → result verified → Roll back.
12. Disconnect network → local tools still work; AI shows "Cannot reach the Claude API".
13. 500+ selected layers: context read time acceptable; stagger completes.
14. Change AE brightness (Preferences › Appearance) → panel follows.

### Compositing checklist (v0.2.0)
15. Analyze Shot on a footage layer: swatches match the frame; no "MOE Probe (temporary)" layer remains; Edit › Undo history shows one "MOE: Analyze (temporary)" entry. Record time taken (Balanced, 1080p and 4K).
16. Grade Neutral: a "MOE Grade" Channel Mixer appears; check in Effect Controls that Red-Red/Green-Green/Blue-Blue = 100 and Const = 0. Verification checks should say "added, 12 param(s)" with **no** "mapping unverified" (confirms English names).
17. Grade Warm/Cool visibly shift the image the right way; re-run updates the same effect; History › Restore removes it.
18. Match Color: foreground over a plate, reference = plate, CTI on a plate frame → "MOE Match" above "MOE Grade"; result visually closer.
19. Screen Key on real green-screen footage: Keylight's Screen Colour equals the screen; Key Cleaner, Advanced Spill Suppressor, Simple Choker (if choke ≠ 0) follow in order; check Simple Choker param 2 really is "Choke Matte".
20. After keying, Analyze shows "keyed subject" and MOE Grade/Match are enabled again afterwards.
21. Look from Words with an API key: suggestion appears, "Use in Grade" fills the Grade form; nothing changes until Apply Grade.
22. Non-English AE UI (if available): Grade still works and checks show "mapping unverified" — record the parameter list from any error.
