# Test Report

Last run: 2026-10-19, Linux cloud sandbox (Node 22.22.0). **After Effects was not available in this environment.**

## Summary

| Layer | How it was tested | Result |
|---|---|---|
| ExtendScript host ops (`extension/host/*.jsx`) | Real .jsx files executed in a Node `vm` against `tests/mock/ae-mock.js` (AE object model mock written from the Scripting Guide) | 56/56 automated tests pass (all suites) |
| ES3 compatibility of host files | `npm run lint:jsx` — parses with acorn `ecmaVersion: 3`, rejects ES5+ runtime APIs | Pass (7 files) |
| Core (registry, schema, permissions, executor, storage, logger, bridge) | Unit + integration tests | Pass |
| Claude integration | Mocked HTTPS responder: request shape, retries, refusal, truncation, 401, offline, budget | Pass — **no real API call was made** |
| Panel UI | Browser preview (`dev/preview.html`) with the real UI code + real host .jsx on the mock; Playwright clicks through 13 scenarios; zero page/console errors | Pass — **not the CEP runtime** |
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
