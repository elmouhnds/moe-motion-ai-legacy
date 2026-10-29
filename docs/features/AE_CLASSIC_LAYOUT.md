# Classic layout (v0.20) — organised the way After Effects is

Why: the owner felt the panel had become "not organised or familiar to a normal After Effects user"
and asked for a new distribution, sections, design, dividers, tabs and smart tools.

## What was wrong (seen in the v0.19 default panel at 420 px)
1. Navigation was an **icon-only sidebar** (7 icons + 4 more at the bottom) — nothing named.
2. Every section opened with a **marketing banner** (~130 px: kicker, title, pitch, stats).
3. **Five levels** before a control: sidebar → sub-tabs → Library / All tools → filter chips → tile → Inspector → action bar.
4. **Names an AE user does not use**: "Toolbox" (motion rigs), "Finish" (compositing), "Utilities" (Quick Bar settings + Select + My Tools).
5. Header icons without names (gift, keyboard, pie, search).

## The model: AE's own panels
| AE has | MOE Classic does |
|---|---|
| Menus *Animation · Layer · Effect · Composition* | Tabs **Keys · Animate · Layer · Design · Effect · Comp** |
| *Effect Controls*: twirl-down groups, thin dividers, indented content | Every tab is a list of **twirl-down groups** (▸ Keyframe Assistant, ▸ Animate In, ▸ Align …) |
| *Effects & Presets*: one search field ("Contains") | **Search** under the tabs (Ctrl K jumps to it): tools, presets, pages; Enter applies the first |
| *Animation Presets*: double-click applies | **Preset tiles apply in one click**; right-click opens their settings; **All 37 ›** opens the full library page |
| The **≡ panel menu** in every panel's corner | **≡** holds What's new, Keyboard shortcuts, Pie, Copilot, Favorites, History, Customize Quick Bar, Panel layout, Settings, Diagnostics, About |
| *Animation › Keyframe Assistant*, *Align* panel, *Layer › Pre-compose*… | Groups use AE's words: Keyframe Assistant, Align, Anchor Point, Transform, Parent & Link, Keying, Color Correction, Guides & Safe Areas, Project |

## Tabs and groups
- **Keys** — ▾ Ease (graphs) · ▸ Keyframe Assistant (Easy / Linear / Hold, Reverse, Mirror, Clone, Stagger, Trim, Select same) · ▸ Loops · ▸ Curve Library
- **Animate** — ▾ Animate In · ▸ Animate Out · ▸ Draw On (shapes) · ▸ Text Animators · ▸ Motion Rigs · ▸ Expressions
- **Layer** — ▾ Align · ▸ Anchor Point · ▸ Transform · ▸ Parent & Link · ▸ Arrange (Grid Builder, with *Your grid*) · ▸ Select & Clean up
- **Design** — ▾ Shapes & Icons · ▸ Backgrounds · ▸ Looks & Glass · ▸ Brand
- **Effect** — ▾ Keying · ▸ Color Correction · ▸ Camera & Zoom · ▸ Stylize
- **Comp** — ▾ Guides & Safe Areas · ▸ Deliver · ▸ Project · ▸ Quick Bar & My Tools

Every library and page is still there (one click from its group, with a crumb back); every button runs
the same tool, quick action or preset as before — the change is where things are and how they look.

## Smart, without moving things
- A **dot** marks the tabs that fit what is selected (keys → Keys; a layer → Animate + Layer; text →
  Animate + Layer; nothing → Design + Comp).
- On first open the panel starts on the first tab that fits; after you pick a tab it stays.
- Inside a tab, the groups that fit the selection **open by themselves** and say *for selection*;
  whatever you open or fold is remembered **per kind of selection**. Groups never move or reorder.

## Kept
Quick Bar (your row), Pie (Q), F4, Copilot, the context line (comp · layers · keys). The other layouts
stay in ≡ › Panel layout and Settings (Sidebar = the v0.15 panel, MOE ★, Hub, Command Bar, Workspace).

## Code
`app/ui/layoutAE.js` (TABS → groups as data; `build()`), wired through `layouts.build` and
`layouts.header` (≡ menu button). Tab ids are prefixed (`ae-animate`) — `animate` is also the
Motion presets page. Tests: `tests/layouts.test.js` (every page reachable, every ref / preset exists,
unique group ids, a tab fits every kind).
