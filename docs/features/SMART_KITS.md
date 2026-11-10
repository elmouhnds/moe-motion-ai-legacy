# Smart Kits (v0.76)

Owner: *"the ideas should not only build on what exists — add ideas that are not there; a list for an advanced technique like the professional Effectors."*

## What is new
| Idea | What it does | Rule |
|---|---|---|
| **Recipes** | A named chain of 2–4 of the kit's own tools: one click, one Ctrl+Z | `kitRun.runRecipe` → `actions.resolve` per ref, readiness before each, inside `executor.batch`; stops at the first not-ready / failed step and says what ran |
| **Looks / Techniques** | Kits grouped by what they are | `kit.kind` |
| **Effectors Pro** | Clone · Shape · Physics · Fields · Aim & sound · Colour & trails | refs to existing `grid.*` tiles only |
| **Progress** | A step ticks when one of its tools ran here; the next step is marked | `kits.progress` (pure); session memory, not a read of the comp |
| **Work in this kit** | The pinned kit's next step as a strip on Home, every style | `kitRun.focusStrip`, store `kit-focus`; opt-in |

## Not verified
Mock + browser preview only. A recipe's later steps depend on the selection After Effects leaves after the earlier step.
