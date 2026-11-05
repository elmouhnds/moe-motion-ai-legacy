# No Cut Names (v0.54.0)

**The owner** (v0.53 report): some Quick Bar names in the wide MOE sidebar were cut, like *Duplicate Comp (d…*.

A name that loses its end looks unfinished, and *Mirror Keys at Play…* could be anything. The project's own rule (Smart Arrange) already says words are never cut. v0.54 applies it to the whole panel, and adds an audit that keeps it that way.

## What changed

- **The MOE sidebar shows names only when the panel has room** (600 px or wider, the same point where the Inspector moves beside the tiles).
  - On a narrow dock it keeps icons, so the page is not squeezed into 250 px.
  - Your choice (names on / off) is remembered, and the toggle's tooltip says why names are hidden.
- **Names wrap to two lines instead of "…"**:
  - sidebar shortcuts;
  - library tiles and text presets;
  - Bento's power-card titles;
  - Quick Bar editor rows;
  - the action bar's name;
  - field labels;
  - the Inspector's preview lines.

  All 74 possible Quick Bar names now fit (17 take two lines).
- **Segmented controls take a second row** when the panel is narrow, instead of cutting an option (*Snake / Random / Forward*, the Settings choices).
- **The action bar keeps its name readable**: below about 120 px for the name, the buttons move to a second row.
- **Shortened descriptions keep the full text in their tooltip**:
  - tool descriptions and hints;
  - the comp name in the header;
  - Deliver's layer names;
  - the stage lines on Bento Home;
  - Copy ease's status.

## The audit: `node tools/audit-cut.js`

It covers every page (21) in the three styles at 420 and 740 px, with the MOE sidebar open and every Quick Bar action on it (the tightest case). That is 126 screens.

- A text cut with "…" or a line clamp, or a word clipped with no "…" at all, **fails**.
- The only exception is a description whose full text is in a tooltip on it or a parent.
- Before the fix: **155** cut texts. After: **0** cut names, 22 shortened descriptions that all carry their full text, 0 JS errors.

## Checks

- `tests/nocut.test.js` (2):
  - the sidebar is wide only with room, icons on a narrow dock, and the choice is kept;
  - every name rule wraps to two lines;
  - segmented controls and the action bar wrap.
- `node tools/audit-cut.js`: 126 screens, 0 cut names.
- `audit-arrange` 72 screens all 0, `audit-repeat` 0, stress stable.
