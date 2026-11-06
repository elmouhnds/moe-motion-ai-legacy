# MOE against the study's KPIs (v0.62)

**Sources:** the owner's study reports, from AE 25.6.6 on Windows 11:

- AE Panel Study (the main report);
- Strategic;
- Defects;
- Strengths;
- Technical.

**Targets:** each row's target is the strategic report's own (§6).

**How MOE is measured:**

- on the AE mock, by tests that run in every `npm run check`;
- or in After Effects by the Self-Test, where marked.

A real After Effects run by the owner is the final proof.

| KPI (strategic §6) | Target | AppleFX Lite | SaaS Kit | MOE v0.61 | How it is measured |
|---|---|---|---|---|---|
| Apply on 60 layers | ≤ 10 s, with progress + stop | 7–10 s | 23–25 s | **8 host round trips, the same as for 3 layers** (was 127). Seconds in AE: not measured here. | `engine2.test.js`; Self-Test *Speed* in AE |
| Residue after Undo | 0 | ✅ | 7 and ≈ 25 items | **0**: one undo group per run; Restore removes exactly what was made | `engine2.test.js`; Self-Test *One Ctrl+Z* in AE |
| Native AE alerts | 0 | 0 | 4 kinds | **0**: no `alert` / `confirm` anywhere in the host or the panel | `grep` |
| Disabled button with a written reason | 100 % | no reason | not disabled | **✅** The bar shows the reason as text; the button and the executor share one rule | `engine2.test.js` (locked case) |
| Keys on the frame grid | 100 % | off at 24/30/60 | ✅ | **✅ 318 cases at 24/25/30/60 fps** | `fpsmatrix.test.js` |
| Survives rename / move | 100 % | n/a (no links) | breaks | **✅ v0.62:** permanent ids in every link; automatic Relink (one undo step); items back within 0.01 px | `links.test.js`; Self-Test *Rename a Grid null* in AE |
| Clicks after selecting | ≤ 2 | ≈ 2 | 1–2 | **1** (▶ on a tile, or double-click; F4 repeats the last) | UI audit |

## The defects list, mapped to MOE

| Defect | In MOE |
|---|---|
| S1 links by name | **Fixed in v0.62** (LINKS.md) |
| S2 native alerts | None ✅ |
| S3 Undo leaves imported files | MOE imports nothing ✅ |
| S4 no progress for long runs | A spinner, no Stop. **Open.** |
| S5 replaces user data silently | Templates make new layers; tools key on top of the layer's own values (Shake, Click). Expressions replace an existing one only with Restore kept ✅ |
| S6 undeclared plugin dependency | Only After Effects' own effects, set by English name and read back ✅ |
| S7 two timing mechanisms fighting | Stagger is keys only ✅ |
| S8 nothing disabled with no selection | Tile readiness ✅ |
| S9 no visible confirmation | Verify checks + toast + history ✅ |
| S10 panel scroll | Wheel and keyboard work; `audit-cut`: 0 cut names ✅ |
| S11 cut variant names | 0 cut names in 132 screens ✅ |
| A1 locked layer changed silently | **Fixed in v0.61.** It was true for 5 MOE tool families too; now 0 of 318 cases. |
| A2 keys off the grid | **Fixed in v0.61** |
| A3 a stale toast after Undo | Results show the run; Restore updates history ✅ |
| A4 / A8 cut tabs, narrow window | Responsive layouts; audited at 340 / 420 / 600 / 900 px ✅ |
| A5 / A6 no reason / fails after clicking | Reason in the bar; `prepare` refuses before anything changes ✅ |
| A7 Auto-Fade writes over Position | Expression presets target the property they name ✅ |
| C1–C4 environment | Docked panel; no second script (one `evalScript` queue); progress open (S4) |

## What MOE keeps from each (strengths report §4)

1. **A live selection bar and a preview before applying** (from AppleFX): MOE has the context bar, and its tiles play the real keys.
2. **One undo step + Remove + idempotent** (AppleFX): now true for every MOE tool (Engine 2), plus Restore per run.
3. **Native keys first; a controller only for live values** (both): this is already MOE's split (Animate / Shake / Click = keys; Grid / Effectors / Backgrounds = sliders).
4. **Offsets in frames** (SaaS Kit): Engine 2 puts every key on the grid.
5. **One-layer effects that stand alone** (AppleFX Shake): Styles are single named effects; shakes are keys only.
6. **Errors inside the panel** (AppleFX): yes, and in plain words.
