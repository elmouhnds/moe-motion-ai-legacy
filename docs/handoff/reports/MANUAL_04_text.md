# Manual test — Group 4: Text (presets · split · Counter · Typewriter · Arabic)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** (with the Group 1–3 fixes deployed) |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G4` 1920×1080 · 25 fps · 10 s |
| Subjects | text `MOE Motion`, Arabic text `مو موشن` |
| Code | `features/text`, `features/quick` |

## Results

| # | Tool | Subject | Verdict | What I saw | Fixed | Re-tested on screen |
|---|---|---|---|---|---|---|
| 1 | **Typewriter — Arabic** | `مو موشن` | **WORKS** | Adds a `MOE Typewriter` animator with a Range Selector and Opacity 0 %. Its **Advanced › Based On is `Words`** — so Arabic letters never come apart. This is the rule in CLAUDE.md, and it really is applied. | — | yes |
| 2 | **Typewriter — English** | `MOE Motion` | **WORKS** | The same tool on a Latin layer sets **Based On `Characters`**. So the Arabic rule is applied *by context*, not as a blanket setting. | — | yes |
| 3 | Typewriter — undo | both | **WORKS** | One Ctrl+Z removed the animator completely. | — | yes |
| 4 | **Number Counter** | `MOE Motion` | **WRONG RESULT** | It counts correctly (text reads `100` at 2 s, `MOE Counter` slider keyed 0 → 100, Retune strip From 0 · To 100 · Duration 2 s) — but **one Ctrl+Z was not enough**. After one undo the text was back and a stray **`MOE Counter` slider was still on the layer**; Edit offered `Undo MOE: Counter` *and* `Redo MOE: Counter`. | **yes** | yes |
| 5 | Text presets list | — | **WORKS** | A deep, well-grouped set: IN/OUT Down·Up·Left·Right (Signature), Soft Rise · Line Reveal · Skew Slide (Slide), Blur Focus · Wide Focus (Blur), Char Fade · Random Fade (Fade), Type On · Tracking In (Type), Zoom In · Zoom Down (Scale), Spin In · Cascade (Rotate), Hero Reveal · Word Stagger · Word Burst · Iris In (Hero). | — | — |

## The defect, and why (#4)

`quick.counter.execute` made **three separate host calls** — `effects.ensure` (the slider), `keys.write` (its two
keys) and `expressions.set` (the Source Text expression). After Effects closes an undo group when the script that
opened it returns (`docs/features/ONE_UNDO.md`: *one host call = one undo group*), so the Counter cost **three**
Ctrl+Z, and stopping after one left the layer half-built: the text restored, the slider still there.

**Fix** — all three writes now go through one `core/host/plan.js` plan (`PLAN1(host, 'MOE: Counter')` →
`effects.ensure` → `keys.write` → `expressions.set` → `commit()`), exactly as `quick.trimPaths` and
`expressions.quick` already do. `restore()` is one plan too, so undoing a restore is also one step.

**Test** — `tests/oneundo.test.js` gains a Counter case that asserts `env.undo.entries` holds exactly
`['MOE: Counter']` and that the restore is `['MOE: Restore Counter']`. I checked it **fails on the old code**
(`one undo step for the whole counter`, 3 entries) and passes on the new.

**Proved in After Effects** after `moe_deploy`: applying the Counter and pressing Ctrl+Z once left Effect Controls
empty, and Edit then read `Undo Delete Effect` / `Redo MOE: Counter` — i.e. nothing of the Counter was left in the
undo stack.

## Why no test caught it — worth the owner's attention
`tools/audit-undo.js` is the guard for this rule, and it reports 0 violations — but it only measures tools that
have a **library tile** ("288 tiles ran"). `quick.counter` has no tile, so its three undo steps were never
measured by anything. Any other registered tool without a tile is in the same blind spot. Either give such tools a
tile, or let `audit-undo.js` walk the registry instead of the tile list.

## Not tested in this group
Split words / lines (the Text Cloner path, `grid.build splitText`) was not driven by hand here — it is the Cloner
engine and is covered in Group 7, where the whole Grid family is being looked at.
