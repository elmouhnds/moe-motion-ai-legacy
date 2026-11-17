# Manual test by hand, with the screen — side session brief (owner's request, 2026-11-17)

You are a Claude session on the owner's laptop with **computer use** (you see the screen, move the mouse, type).
Your job: use **MOE Motion AI** inside After Effects the way a motion designer does, **one group of tools at a time**,
find every tool that does not work correctly, **fix it in this repository**, and prove the fix by using it again on
screen. The owner speaks Egyptian Arabic — write your reports to them in Egyptian Arabic; code stays English.

Repository: `https://github.com/elmouhnds/moe-motion-ai-legacy` (MOE v1, version 0.99.5). Read `CLAUDE.md` first —
its rules apply to every fix (ES3 host code, one undo group per call, read-back, never invent APIs, honest reports).

## 0. Setup (once)
1. Clone the repo next to the earlier work (e.g. `D:\Personal\New Claude Code\moe-motion-ai-legacy`), `npm install`,
   `npm run check` — must pass before you change anything.
2. In After Effects: Help › About → write down the exact version. Window › Extensions › **MOE Motion AI** → Diagnostics
   → write down MOE's version. **It must say 0.99.5.** If not, stop and tell the owner to install 0.99.5 first.
3. **Never use the owner's projects.** File › New › New Project, save it as `MOE Manual Test.aep` in a new folder
   `MOE Manual Test` on the Desktop. Before you close After Effects or open another project, ask the owner — they may
   have unsaved work in another window.
4. Make a comp `MOE Manual Test 1920x1080 25fps 10s` and put subjects in it as each group needs: a text layer
   ("MOE Motion"), an Arabic text layer ("مو موشن"), a shape rectangle, a solid, a null, a shape with a path (pen tool),
   2–6 cards (shape rectangles) for grids, an image/footage if a tool needs one. Make a fresh comp per group.

## 1. The groups — test them in this order (most used first)
| # | Group | Where in the panel | Code |
|---|---|---|---|
| 1 | Motion Control: Ease curves, Anchor 3×3, Align & Distribute | Toolbox / Motion Kit panel | `features/curves`, `features/transform`, `features/kit` |
| 2 | Motion presets: Animate In / Out, Draw On, Loop, Shakes, Styles, Blur on move | Motion | `features/motion`, `features/quick` |
| 3 | Quick Bar actions + Expressions buttons | Quick Bar, Expressions | `features/quick`, `features/expressions` |
| 4 | Text: presets, split words/lines, Counter, Typewriter, Arabic | Text | `features/text` |
| 5 | Layer tools: Select, Parent & Link, markers, In/Out, Retime / Paste Motion | Select, Layer tab | `features/select`, `features/links`, `features/markers`, `features/retune` |
| 6 | Design: Templates (lower thirds, titles), Product UI, Shapes & Icons, Backgrounds | Templates, Product UI, Shapes & Icons, Backgrounds | `features/design` |
| 7 | Cloner / Grid + Effectors (Proximity, Spring, Audio, Field, Trail, Tracer) | Layout & Grid | `features/grid`, `features/proximity` |
| 8 | Reveal: Wipe, Matte Reveal, Matte FX, Reveal Composer | Looks / Reveal | `features/reveal` |
| 9 | Looks & Glass, Thick Glass, Zoom & Focus, Click VFX, Carousel | Looks & Glass, Zoom & Focus | `features/glass`, `features/zoom`, `features/interact`, `features/carousel` |
| 10 | Compositing, Adapt (formats), Bake, Scene Check, Deliver / previews | Compositing, Deliver, Scene Check | `features/compositing`, `features/adapt`, `features/bake`, `features/scene`, `features/previews` |
| 11 | Brand, Style Kits / recipes, Assistant (offline part only, no API key needed) | Brand, Style Kits | `features/brand`, `app/ui/kits.js` |

## 2. For every tool in a group
1. Select the right subject, click the tool in the panel as a user would (also its right-click options and one
   modifier variant if it has one).
2. **Look**: take a screenshot of the viewer, the timeline (twirl open what the tool made) and Effect Controls. Scrub or
   play the work area. Judge as a motion designer: does it do what its name says, does it look premium (not dated)?
3. **Ctrl+Z once**: everything the tool made must go away in ONE undo, and After Effects must not show
   "Undo group mismatch". Then Ctrl+Shift+Z or run again.
4. Note any dialog / error text **exactly** (copy it), and the panel's toast.
5. Verdict per tool: `WORKS` · `WRONG RESULT` (runs, but the result is wrong — say what you saw vs expected) ·
   `ERROR` (exact message) · `UGLY` (works, looks dated/cheap — say why) · `CAN'T TEST` (why).

## 3. Fixing
- Fix only what you saw fail. Find the cause in the code (`extension/features/...`, host `extension/host/ops/*.jsx`),
  never guess an After Effects API — check the Scripting Guide (docsforadobe.dev).
- Every After Effects behaviour you discover goes into `tests/mock/ae-mock.js` with the exact message, plus a test that
  fails on the old code (CLAUDE.md "Never trust a mock that is more lenient than After Effects").
- `npm run check` must pass. Deploy to the installed panel: `node tools/moe-mcp.js` is the MCP server (tool
  `moe_deploy`), or copy `extension\*` into `%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai\` and reload the
  panel (close + reopen it). Then **use the tool again on screen** — a fix counts only when you saw it work.
- Commit each fix on a branch `manual-test/<group-number>-<name>` with a clear message (what you saw, the cause, the
  fix, how you re-tested), and push it. Do not push to `main`. Do not edit `CHANGELOG.md` versions or release.
- If a fix needs a design decision (how something should look or behave), do not decide alone — ask the owner and show
  the screenshot.

## 4. Report after each group
Write `docs/handoff/reports/MANUAL_<NN>_<group>.md` on the branch (and tell the owner in Arabic):
- After Effects version, MOE version, date.
- A table: tool · subject · verdict · what you saw (exact error text) · fixed? (commit) · re-tested on screen?
- Screenshots that matter (save as PNG next to the report, small).
- What you could not test and why.
Then move to the next group. Stop and ask the owner if After Effects crashes twice in one group.

## 5. Never
- Never open, change or save the owner's own projects or comps.
- Never run generated ExtendScript through File › Scripts or the ExtendScript Toolkit to "test faster" — use the panel.
- Never say a tool works because a test passed in Node — only what you saw on screen counts.
- Never change After Effects preferences except what a tool needs, and say so.
