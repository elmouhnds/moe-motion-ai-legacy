# Fewer, clearer (v0.29.0) — one place per tool

## The question
The owner asked whether some things could go in exchange for a better, easier organisation — "the anchor
point, for example: many plugins have it". The audit showed the problem was **copies, not tools**: the same
thing reached from many places under different names (Wiggle lived in the Quick Bar, the Motion Kit rigs, the
Expressions library, NOW and the pie), plus six retired panel styles still kept alive in the code.

## Decisions
| What | Before | After |
|---|---|---|
| Quick Bar actions | 80, of which ~30 were copies of library tiles (Slide In / Out ×8, Fade, Pop, Scale, Spin, Draw On ×4, 17 expressions) | **41** own actions; a bar button can be **the tile itself** (`tile:<section>/<id>`) — one source for its numbers, label and icon |
| Motion presets library | Reverse Keys, Mirror Keys, Stagger, Gentle Ease were copies of Kit actions | removed from the library (they are keyframe tools, not presets) — the Kit / Everyday ones stay |
| Motion Kit › Motion rigs | Excite, Delay, Jump, Orbit, Spin, Swing, Wiggle, Stare, Repeat | **Excite, Delay, Jump, Stare, Repeat** — Orbit / Spin / Swing / Wiggle are the expression presets (Expressions, with *Live controls* in their options) |
| Smart Ease vs Easy Ease | two actions, same tool | one: **Easy Ease (F9)** |
| Expressions page | a "One-click" grid repeating the Library tab's tiles | removed |
| Panel styles | Bento, Glass, MOE + 6 retired ones still in the code (Classic, Apple, Sidebar, Hub, Command Bar, Workspace) and the Sidebar's Smart Home | **Bento · Glass · MOE** only; a panel that had a retired style opens in Bento once, with a notice |
| Old Copilot bar | replaced by the Assistant in v0.28 but still in the code | removed (its step views stay for the Assistant) |
| Anchor Point | full-width card in NOW for every single layer | **kept** (daily, AE itself only centres) but **half width** (a 2×2 cell) — the actions fill the rest |
| Generate on Green | in Finish › Keying next to Key Setup | out of the group; still in the Compositing library and search |
| Settings › Sidebar | hide sections of the Sidebar style | removed with the style |

About 1,360 lines of panel code removed, 172 added.

## Why the Anchor Point stays
It is an everyday action (Everyday slot 3, Alt+3). After Effects has *Center Anchor Point in Layer Content*
only; MOE's nine points, mask boxes and position compensation over keyframes are not in AE. "Another plugin
has it" is not a reason to remove it: the point of MOE is not to need another plugin for a one-second job. What
was wrong was its **size** — now half.

## Old ids keep working
`features/quick/bar.js` `MIGRATE` maps every removed id to what replaced it — saved Quick Bars, Bento pins,
My pie, ▸ Recent, tests and brand ease refs (`quick:fadeIn` → `tile:animate/fadeIn`, `k_wiggle` →
`tile:expressions/x-wiggle`, `ease` → `k_easy`, `tile:animate/stagger` → `k_stagger` …). `quickbar.barIds`
migrates and removes duplicates; `actions.resolve` follows the map both ways.

## Any preset on the bar
Open a preset in its library and click **☆** next to Apply: the tile goes on the Quick Bar (Alt+1…0 for the first
ten). The Customize page lists the 41 Quick actions and the presets on your bar.

## Rules (CLAUDE.md)
- A Quick action may not copy a library tile or another action (same tool + args) — `tests/fewer.test.js`.
- New styles only if the owner asks; the three styles share `layoutAE` groups and `workflow.STAGES`.
