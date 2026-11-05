# Smart Controls (v0.56.0)

**The owner** (after v0.55's hidden slider): *"You saw how smart the hidden slider was. Train yourself on smart tips like this: use every tool to give the best experience, in the smartest ways."*

## The principle

A smart control does more **without taking more space or adding a button**. The power sits inside the control, where the hand already is, and the plain way keeps working. Ask these five questions before adding any control:

1. **Can the existing control do it?** Prefer a gesture on the control you already have (drag, double-click, a modifier key, the wheel) over a new button.
2. **Does it follow After Effects' own habits?** A motion designer's hands already know them: scrubby numbers, Shift for big steps, Ctrl / Cmd for fine steps, Alt for the variant, double-click to reset, Esc to cancel. Use the same keys.
3. **Is the plain way still there?** Typing a number, a single click, a tooltip that says what the hidden power is. Hidden must never mean undiscoverable.
4. **Does the user see it while it happens?** Live feedback (the graph moves, the bar fills, the colour changes), then one commit when they let go. Never one write to After Effects per pixel or per key press.
5. **Can it go wrong silently?** Clamp to safe ranges, keep Esc as a way out, never steal the page's scroll.

## What v0.56 applies

| Where | Smart behaviour |
|---|---|
| **Every number in the panel** (every Inspector field, the Keyframe Velocity numbers, the Align gap) | Drag sideways on it, like After Effects' scrubby values: ± one step a pixel, Shift ×10, Ctrl fine. Live while dragging, one commit on release. A plain click types; Esc during a drag puts the first value back. |
| ↑ / ↓ on a number | Steps it (Shift ×10, Ctrl fine), live. It commits **once**, 400 ms after the last key, so a held key never floods After Effects. |
| Mouse wheel on a number | Steps it **only while the field has focus**, so scrolling the panel is never hijacked. |
| **Double-click a slider** | Puts the tool's default back (the tooltip names the value). |
| Cursor | A number shows ↔ until you click in to type. |

One helper does it all (`app/ui/scrub.js attach`), so every number behaves the same. Inspector fields get it from `form.control`. The Keyframe Velocity row (v0.55) now uses the same helper.

## Earlier smart controls (the catalogue)

These follow the same principle and are listed here so new work reuses them:
- **Shift / Alt on Select buttons** (v0.46): add to or remove from the selection, After Effects' own keys.
- **Right-click = options; Alt-click = the variant** on Quick Bar buttons.
- **Alt-click on an anchor point** (v0.10): also place the layer there.
- **Alt / Shift on Align**: to the comp, or to the key layer.
- **F4 / ↻** repeats the last change.
- **The MOE sidebar** shows names only with room and opens over the page on a narrow dock (v0.54.1).
- **A preset pressed twice adds nothing** (guides, v0.53).
- **Long text shrinks itself to fit the frame** (templates, v0.52).
- **Hidden sliders** on Keyframe Velocity (v0.55), now everywhere (v0.56).

## Checks

- `tests/smartcontrols.test.js` (4):
  - drag ±step, Shift ×10, Ctrl fine, clamped, one commit;
  - a click focuses, Esc restores and commits nothing;
  - ↑ ↓ step live with one commit after the burst; the wheel is ignored unless focused;
  - Inspector numbers are scrubbable, and a slider double-click restores the default.
- Playwright on the Templates Inspector: Duration 0.7 → dragged to 2.7 → double-click on its slider → 0.7. 0 JS errors.
- `npm run stress` stable, `audit-cut` 0, `audit-arrange` 0.
