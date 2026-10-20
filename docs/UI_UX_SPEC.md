# UI / UX Specification

## Character
Premium, quiet, technical. Feels native next to AE's own panels: flat surfaces, hairline separators, one warm accent, no gradients, no glow, no heavy cards.

## Layout
```
┌ Rail 40px │ Header: section title ····························· [⌕]
│ M · Motion · Text · Brand · Select · Expr · Comp · Tools … ☆ ⏱ ⚙
├ Context 26px ─ ● HERO_Title_v03  25 fps · 4 lyr  3 prop  7 keys        [↻]
├ Content (scroll)
│   SECTION LABEL (purpose group, e.g. EASING / TIMING)
│   ▸ Tool row  — icon · name · live hint (what it will do, or why not) · ☆ · ›
│     ├ preset chips
│     ├ fields (slider + number, segmented enums, toggles)
│     ├ › Advanced (collapsed)
│     ├ [Primary action] [save preset]          reason if unavailable
│     └ preview list → result report (status, verification checks, Restore)
└ Copilot bar 38px ─ ✦ Describe a change…                         Ctrl+Space
```
- **Rail sections** (v0.3): Motion, Text, Brand, Select, Expressions, Comp, Tools; bottom Favorites, History, Settings. Text = preset grid with live canvas previews and an apply panel; Brand = client switcher, swatches (click = apply), typography rows, Auto fonts; Select = type grid with counts, search, match reference, labels, selection history and switches.
- **Main workspaces (v0.2)**: Motion, Expressions, Comp, Tools. **Secondary** (icons): Favorites, History, Settings. Diagnostics opens from Settings and the command palette.
- **Comp** groups: Analyze (Analyze Shot) · Color (Grade, Look from Words, Match Color) · Key (Screen Key). Analysis results show a swatch grid and one-click follow-ups that *prefill* other tools; AI suggestions also prefill — nothing runs without the user's click.
- **Context-aware**: each tool row's hint is computed from the live selection ("Ease 7 keyframes (in 33% / out 33%)" or "Select keyframes"). Unavailable tools stay visible but explain why.
- **Copilot** is collapsed into a single bar; expands to a sheet over the bottom of the panel only when used. Never occupies the timeline.
- **Command search**: Ctrl+K or `/` — tools, saved tools, commands, navigation.
- **Pinning**: ☆ on hover → Favorites.

## Responsive
- `compact` (< 340 px, or whenever the header overflows, or forced): tab labels → icons, fields stack label over control.
- default (320–499 px): labels on tabs, icon-only search.
- `wide` (≥ 500 px or "Expanded"): full search field with shortcut hint.

## Tokens (css/tokens.css)
| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | #232323 (synced to AE panel colour) | #e8e8e8 | panel |
| `--text / -2 / -3` | #e6e6e6 / #b0b0b0 / #8f8f8f | #1d1d1d / #444 / #5e5e5e | primary / secondary / meta |
| `--accent` | #ff7a59 | #c2410c | primary action, active preset, slider fill |
| `--ok / --warn / --err` | #4fc58f / #e8bd55 / #ff6b6b | #157f4f / #8a6100 / #c42b2b | status only |
Contrast verified by `tools/check-contrast.js` (all text ≥ 4.5:1, accents/status ≥ 3:1, both themes).

Typography: Segoe UI Variable (Windows), 12 px base, 11 px labels, 10.5 px section labels (uppercase, tracked); code in Cascadia Code. Spacing on a 4 px grid; rows 28 px; controls 24 px; radius 4 px.

## Micro-interactions
120 ms ease transitions on hover/active; 140 ms reveal for tool bodies and sheets; slider thumb scales on hover; spinner inside the action button while running; toast only after a change that touched the project.

## Theme sync
On start and on `ThemeColorChanged`, the panel reads `appSkinInfo.panelBackgroundColor`; luminance > 0.5 → light tokens, else dark tokens with `--bg` set to AE's exact colour.

## States every view handles
Not connected (host error + Reconnect) · no project · no comp · empty selection · truncated large selection · running · success/partial/failed with checks · AI offline / no key / budget reached / refused.

## v0.4 additions
- **Quick Bar**: 26 px icon buttons under the context line, horizontally scrollable, ⚡ opens the Quick section. Click = run with the action preset; right-click / Alt-click = options popover (the tool's own form). Pins persist (`quick-bar`).
- **Quick section**: tiles grouped Project · Layer · Keys · Animate · Text · Expressions, ★ pin toggle.
- **Layout section**: Grid Builder (live canvas preview; animated when "Animate in" is on), Grid Controls, Release, Layout Guides (guide preview), Place in Cells, Resize & Adapt (Preview layout: before/after frames, colour = role, per-layer role/zone overrides, Ask Claude).
- **Zoom**: focus map picker shows the visible window for the chosen zoom.
- **Glass**: Brand Kit tint swatches.
- **Expressions**: one-click tiles above the editor.

## v0.5 — Studio (concept B, chosen by the owner)
- **Sidebar** (148 px labelled ≥ 600 px wide, 44 px icons below): creative sections → helpers → client card → utilities.
- **Library section** = tabs (Library · All tools [· Editor]) + filter chips + search + tile grid (116 px min, animated canvas thumbnails) + **Inspector** (300 px, sticky, beside the grid ≥ 760 px, under it below). Inspector = big preview (or the tool's own preview widget) · title · description · the tool's form without header/presets · Apply · report · Restore.
- Interaction: click tile = select + fill settings once; double-click = apply with the tile preset; ★ pins the tool to Favorites; Quick Bar stays under the context line.
- **Deliver**: format chips → board (source + one diagram per format, colour = role) → Inspector (per-layer role/zone, method, safe margin, re-stack, nested) → sticky footer "Create N comps".

## v0.6 — Premium
- **Home** is the first section: greeting + library stats + quick actions, the active comp, six illustrated quick starts, Recent, Favorites, tip of the day.
- **Section banners**: kicker, title, one-line pitch, stats chips and a theme-coloured illustration; hideable per section (Settings › Appearance brings them back); hidden in compact docks, illustration hidden below 600 px.
- **Shapes & Icons**: Icons / Shapes / All tools tabs; category chips with counts, Starred, search by name or tag (featured icons first when browsing All); paged grid (96 + 192 per "Show more"); Inspector with a live preview of style, colours and animation, tags (click = search), copy SVG, star.
- **Backgrounds**: palette tiles render the real gradient; Inspector palette strip (hover = hex, click = copy) with Colorize selection / Save as client / Use in Shapes.
- **Mine** filter in every library: the user's presets as dashed tiles; ⧉ in the Inspector saves; right-click deletes (confirm).
- **NEW** corner badge on 0.6 tiles; tiles lift with a soft shadow on hover.
- **Sheets** (What's New after an update, About from the logo, Shortcuts from the header or `?`): centred, blurred backdrop, Esc / click outside to close.
- **Splash** (≈ 1 s, click to skip, off in Settings); **toasts** carry a status icon.
- **Appearance**: Auto / Dark / Midnight / Light; 8 accents; Motion Full / Reduced (thumbnails, banners and sheets hold still); Headings Sora / System.
- **Colour fields**: swatch picker + hex + up to 12 quick swatches (active client first).

