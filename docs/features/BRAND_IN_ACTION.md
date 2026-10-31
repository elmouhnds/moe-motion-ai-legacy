# Brand in action (v0.26)

Next Roadmap step after Brand import (M1.30): use the client's brand in the comp, not just store it.

## The client you work for
Choosing a client on the Brand page (or saving one from a website / PDF) makes it the **active client**
(store `brand-active`; with a single client it is active automatically). Brand actions follow it everywhere.

## Apply Whole Brand (`brand.applyAll`) — one click, one Undo
On the **selection** or the **whole comp** (every unlocked layer, read with `layers.describe`):
| Layer | What it gets |
|---|---|
| Text | the client font for its script (Arabic → Arabic font + right-to-left; else the English font) and a colour by role: **headline** (≤ 4 words / ≤ 32 characters, or a name with title / headline / عنوان) or **body** |
| Shape | fill colours in turn: primary · secondary · accent; a shape named bg / background → background |
| Solid | only the background solid (named bg / background, or the bottom-most solid) → `MOE Brand Fill` in the background colour (the shared solid source is never changed); *MOE Background* gradients are left alone |
| Others / locked | skipped and listed |

Colours by role come from `brandRoles()`: the roles import found, otherwise the palette order; **contrast-checked
against the background** — body text needs 4.5 : 1 (else the most readable colour is used), headlines 3 : 1 (else
the text colour). Same host ops as Apply Brand Colour / Font: verified by read-back, History › Restore puts back
fonts, colours and effects. Missing fonts are reported and the layer keeps its font.

Where: Brand page (**Apply brand** · **Brand whole comp**), Design tab › Brand group (primary action), Bento NOW
and Glass Now (when layers are selected), search, the pie (My pie) — action refs `brand:apply`, `brand:applyComp`.

## Brand backgrounds
Saving a client from a website / PDF (or **Make backgrounds** on the Brand page) adds up to 4 presets to
**Backgrounds › Mine**: each brand gradient, a radial *Brand glow* (primary → background) and a drifting *Soft mesh*.
They use the Background tool's new **Custom / brand colours** palette (2–5 hex colours, padded to the 5 palette slots
by repeating them). Saving again replaces them (ids `brand_<client>_<n>`), never duplicates.

## Brand ease (`brand:ease`)
The brand's motion feel → the matching existing ease: smooth → Smooth Ease · snappy → Snappy Ease · gentle → Gentle
Ease · bouncy / elastic → Out Back · linear → Linear keys. On the Brand page and in the Design › Brand group.

## Also in v0.26
- MOE sidebar: drag a shortcut onto another to reorder the Quick Bar (saved; same order everywhere).
- Bento NOW: drag pinned tiles to reorder them.
- Fix: tool readiness (Inspector, tiles, one-click actions) now gives `prepare` the services like the executor
  does — brand tools no longer said "Choose a client" while one was chosen.
