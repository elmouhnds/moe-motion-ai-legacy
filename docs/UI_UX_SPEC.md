# UI / UX Specification

## Character
Premium, quiet, technical. Feels native next to AE's own panels: flat surfaces, hairline separators, one warm accent, no gradients, no glow, no heavy cards.

## Layout
```
┌ Header 36px ─ [M] Motion · Expressions · Tools ········ [⌕] [☆] [⏱] [⚙] [∿]
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
- **Main workspaces**: Motion, Expressions, Tools. **Secondary** (icons): Favorites, History, Settings, Diagnostics.
- **Context-aware**: each tool row's hint is computed from the live selection ("Ease 7 keyframes (in 33% / out 33%)" or "Select keyframes"). Unavailable tools stay visible but explain why.
- **Copilot** is collapsed into a single bar; expands to a sheet over the bottom of the panel only when used. Never occupies the timeline.
- **Command search**: Ctrl+K or `/` — tools, saved tools, commands, navigation.
- **Pinning**: ☆ on hover → Favorites.

## Responsive
- `compact` (< 320 px or forced): tab labels → icons, fields stack label over control.
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
