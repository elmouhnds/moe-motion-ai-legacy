# Drag engine (v0.79.1)

Owner: *"dragging the bars in Control with the mouse does not work well — review every drag so it answers the mouse the smartest way."*

## What was wrong (measured in the preview)
| Finding | Number |
|---|---|
| A Control bar is 160 × 173 px; only its number answered a drag | ≈ 40 × 30 px — 4 % of the bar |
| After the first change, a listener on the bar would use the number of an old render | the bar is morphed, the number rebuilt |
| Drags were tracked on the element with pointer capture only | a lost capture or a mouse-up outside the panel lost / stuck the drag |

## How a drag works now (`app/ui/scrub.js`)
- **Bar** (`surface`): drag anywhere — the range over the bar's own size; click sets the level there; double-click = `reset`; Shift bigger steps; Ctrl ¼ pace; buttons / switches inside and the number while typing keep their clicks.
- **Number**: drag sideways (±step a pixel, Shift ×10, Ctrl ×0.1) or, in a bar, on the bar's scale; click types; ↑ ↓; wheel only while focused.
- **Every drag** (`track`): window listeners, painted on a 16 ms clock, `buttons === 0` / blur commits, Esc cancels, modifier changes do not jump, no dead zone.
- **Canvases** (`guard`): graph handles, graph grip, curve editor, cloner stage.

## Not verified
Real mouse moves in the browser preview (Chromium) only — not in After Effects' CEP panel.
