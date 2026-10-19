# Risk & Compatibility Report

| # | Risk | Impact | Likelihood | Mitigation | Status |
|---|---|---|---|---|---|
| 1 | Nothing has run inside a real After Effects yet | High | Certain (until host test) | Host checklist in TEST_REPORT.md; Diagnostics view; mock tests cover logic | **Open** |
| 2 | CEP manifest version / loading quirks on specific 25.x builds (community reports of "Unsupported Manifest version" on 25.6.x macOS) | High | Low–Med on Windows | Try manifest `Version="12.0"`; fallback `11.0`; set `LogLevel`=`6` under `HKCU\Software\Adobe\CSXS.12` and read the CEP log in `%TEMP%` | Open |
| 3 | `expressionError` not updated synchronously after setting an expression | Med (Validate/Apply verification) | Low | Verify in host; if async, read error on next call | Open |
| 4 | `selectedLayers` order ≠ click order | Low (Stagger "Selection" order) | Med | Default order is Top→Bottom (index); Selection order documented as host-dependent | Open |
| 5 | Temporal ease on LINEAR keys needs Bezier | Med | — | Tool sets Bezier on eased sides explicitly; HOLD preserved | Mitigated |
| 6 | Long ExtendScript calls block AE UI | Med | Low | One batched call per run, capped context reads, no idle polling | Mitigated |
| 7 | Keyboard shortcuts captured by AE instead of panel | Low | Med | Shortcuts work while panel is focused; header buttons always available; `registerKeyEventsInterest` if needed | Open |
| 8 | DPAPI via PowerShell blocked by policy (constrained language mode / AppLocker) | Med (AI key save) | Low | Clear error shown; fallback plan: Windows Credential Manager via `cmdkey` or a signed helper | Open |
| 9 | CEP retirement (end of 2029) / UXP arrival | Med long-term | Certain eventually | Host access isolated behind `host/bridge.js` + named ops; UXP adapter can replace the bridge without touching tools | Planned |
| 10 | Node 17 in CEP is old (no fetch, older TLS defaults) | Low | Low | Raw `https` module; TLS to api.anthropic.com is standard | Mitigated |
| 11 | AI plans proposing wrong values | Med | Med | Typed schema, local validation, preview, approval, verification, rollback | Mitigated |
| 12 | Prompt injection via layer/expression names sent as context | Low | Low | Context is data in the user message; AI can only choose registered tools; every change needs approval | Mitigated |
| 13 | Cost overrun | Low | Low | Monthly budget gate (default $20), compact context, prompt caching, cost shown in Diagnostics | Mitigated |
| 14 | Haiku 5.5 cache-read price not confirmed | Very low | — | Marked "estimated" in cost table; editable override | Open |
| 15 | Network POST retries could double-bill on ambiguous failures | Very low | Low | Max 3 attempts; only on network/408/429/5xx | Accepted |
| 16 | Checkpoints referencing moved keys | Low | Med | Restore checks key times and aborts with KEY_MOVED instead of writing the wrong key | Mitigated |
| 18 | Effect parameter names/indices differ from our map (locale, AE version) | Med (compositing writes) | Med | Name-first resolution; fallbacks only with exact parameter count; unresolved → host op removes what it added and lists the parameters; method shown in checks | Mitigated, **verify in host** |
| 19 | `sampleImage` via `valueAtTime` slow on heavy precomps | Med (blocking) | Med | Quality presets (9–36 cells), one probe expression, 180 s timeout for sampling calls | Open |
| 20 | Probe layer left behind if AE errors mid-call | Low | Low | `finally` removal + layer-count check reported in verification | Mitigated |
| 21 | Measuring keyed / graded layers | Med (wrong match) | — | Keyed layers sampled post-effect with MOE Grade/Match bypassed (re-enabled in `finally`); unkeyed screens refused for Match | Mitigated |
| 22 | Analysis leaves one no-op undo entry | Very low | Certain | Documented; real change is always a separate single undo step | Accepted |
| 23 | Channel Mixer is a single affine grade (no curves/split toning) | Low (creative range) | — | Look from Words reports limitations; Lumetri mapping planned after host verification | Accepted |
| 17 | Bundle ID `tv.madtomato.moe.motionai` | — | — | Change before signing/distribution if a different ID is preferred | Note |
