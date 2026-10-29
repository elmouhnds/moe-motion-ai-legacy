# Style proposals (v0.24): Glass · Apple · Bento

The product owner expected a different style altogether — glass, modern, Apple-like or my own idea — and a
**radical** new organisation of the tools, not the refinements of v0.23. Three complete proposals were built,
each a new look **and** a new organisation, live in the real panel (same tools, tiers, Recent memory, search,
≡ menu, Quick Bar). Choose in ≡ › Panel layout, Settings › New styles, or the preview toolbar.

| | Glass | Apple | Bento ★ (my proposal) |
|---|---|---|---|
| Look | frosted glass cards over a deep colour field (pastel in Light), glass capsule nav | macOS / iOS Settings: large titles, inset grouped lists, coloured squircle icons, tinted buttons | near-black canvas, bento tiles of different sizes, accent glow only on what matters |
| Organisation | 4 spaces by **stage of work**: Motion · Arrange · Look · Deliver (bottom capsule) + **Now** card (selection + its 8 best actions) | **navigation stack**: root (for your selection · 6 categories › · general) → category page with ‹ back | **one page, no tabs**: NOW (the big tool for the selection + 8 best actions), then every group as bento where **size = importance**; index chips jump down |
| Code | `app/ui/layoutGlass.js` | `app/ui/layoutApple.js` | `app/ui/layoutBento.js` |

All three reuse Classic's data (`layoutAE.TABS`: groups, tiers, refs) and building blocks (`groupBody`, `actButton`,
`tileStrip`, `searchBox`, `panelMenu` …); only arrangement and CSS differ. Styles live in `css/styles.css`, scoped to
`.app.layout-glass / -apple / -bento` (tokens redefined inside the scope, dark and light).

## Ten everyday tasks, clicked for real (preview, HERO_Title with keys selected, 420 px, Quick Bar left out)
Clicks / scroll in px (Classic · Glass · Apple · Bento with index chips): `22/678|21/1517|18/1049|18/543`.
Bento without its index: 10 clicks but up to ~4,300 px of scrolling for the Comp tools.

## Recommendation
**Bento ★** — the only one that does literally what was asked (button size and place by importance), puts the
main tool for the selection on top with no click, and ties Apple on clicks with the least scrolling. **Apple** is
the calmest and clearest; **Glass** the most striking but the slowest to use and the heaviest (backdrop blur,
used only on the capsule, the Now card and menus). The owner chooses; the chosen style becomes final and the
others are retired the same way Hub / Command Bar / Workspace were.

## Not verified
Preview + mock host only. Backdrop blur performance inside AE's CEP (Chromium 99) and Windows display scaling
are untested (TEST_REPORT items 151–153).
