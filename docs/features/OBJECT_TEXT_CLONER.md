# Object Cloner and Text Cloner (v0.37.0)

Two new layouts in the same Grid Builder engine (`grid.build`), so Morph, Build, Orient, Clone Colours and every Effector (Spring, Target, Audio…) work on them. Both are appended to the Layout / Morph To menus as items 7 and 8. Grids made before v0.37 keep their 6-item menus.

## Points: the Object Cloner
- Puts one item on each point (vertex) of a shape path or a mask. In the expression this uses `points()` on the Path property, from the AE expression reference.
- **Clone on Points** tile: select the layer to clone and one shape layer.
  - The shape is picked as the path automatically: in Path or Points mode with no path layer chosen, if exactly one of the selected layers is a shape, it is used.
  - You get one copy per point (`MOE Clone n · <layer>`).
  - With 2+ layers selected, they sit on the first points instead.
- **Point Offset** (on the grid null) moves every item on by that many points, live.
- **Orient › Face Center** turns each item along the path at its point (from the previous point to the next).
- Reference: `layouts.place` `mode: 'points'` with `vertices` (in the grid null's space) and `pointOffset`. The expression mirrors it (`lay(7)`). The grid null sits at the comp origin, like Path.
- Refused:
  - a path with fewer than 2 points;
  - no path layer at all ("Choose the shape or masked layer whose points the clones sit on").

## In Place + Split text: the Text Cloner
- **In Place** keeps every item where it is. The items become a live grid without moving, so Effectors, colours and Build act on them where they stand. Morph To any other layout flies them there.
- **Split text** (Words / Letters) turns one selected text layer into one text layer per word or letter, using the host op `text.split`:
  - each piece is a duplicate of the original: same font, style, effects and transform; text animators are dropped;
  - each piece is named `MOE Word n · <layer>` / `MOE Letter n · <layer>` and anchored on its own centre;
  - the original is hidden (`enabled = false`), and Restore removes the pieces and shows it again (`text.unsplit`).
- **How the pieces are placed:**
  - A temporary duplicate (removed in `finally`) measures, with `sourceRectAtTime`, the whole line, the piece alone, and the line up to the end of the piece. It is measured at the paragraph's start justification: left for left-to-right, right for right-to-left.
  - The result is then shifted to the original's own justification (left / centre / right).
  - Lines are split on returns; line n sits n × leading lower (auto leading = 120 % of the font size).
  - Scale and rotation of the original are applied to each piece's centre (2D maths).
- **Arabic:** splits by **words only**. Letters are refused because Arabic letters disconnect (CLAUDE.md). Right-to-left words are placed from the right edge.
- **The grid null for In Place:** its anchor equals its position, so its space is the comp's. `setParentWithJump` keeps values, so nothing moves, and the null still turns and scales around the text's centre.
- **Read-back:** every item's comp box is measured again after the grid is built and compared with its box before (±0.5 px).
- **Refused before anything is made:**
  - Source Text with keyframes or an expression;
  - keyframes or expressions on the Transform;
  - separated Position, a 3D layer, or paragraph (box) text;
  - fewer than 2 or more than 150 pieces.
- Tiles (Clone mode): **Clone on Points**, **Text Cloner** (words in place), **Letters Rise** (letters, Build: Rise, 70 % stagger).

## Tests
`tests/object.text.cloner.test.js` (6):
- **Points:** mock positions and facing = `layouts.place`; Point Offset shifts the items; restore; refusals.
- **Words**, centred, 2 lines: every piece's comp box = its word's box in the original.
- **Arabic**, right to left, right-justified, 50 % scale: the same check, and letters are refused.
- **Letters Rise** + a Linear Effector sweep: the letters are back in place at the end of the build, and the sweep reaches them one by one; keyed text is refused.
- **Tiles.**

The mock measures text with a simple metric (0.55 em per letter, 0.5 em Arabic, 0.3 em space), so these tests prove MOE's placement maths, **not real glyphs**.

**Unverified in After Effects:**
- kerning and tracking across word boundaries;
- mixed styles inside one text layer (each piece takes the style at the start of the text);
- rotation of the original (handled in the maths, not covered by a test);
- the exact ink bounds `sourceRectAtTime` gives for Arabic shaping at a cut.
