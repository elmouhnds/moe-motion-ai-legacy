# Native Templates (v0.49.0)

**Premium library, step 2.** These are not `.aep` files you import and then fight with. A template is built **in your comp, with real After Effects layers**:

- text layers you type into;
- shape layers sized to that text;
- one null that holds them all, so you move or scale the whole template from it;
- the entrance keyed with Quick Animate's own keys.

Everything is named `MOE Template N · …` and Undo removes it.

## The four templates

| Template | Parts | Entrance |
|---|---|---|
| **Lower Third** | Accent bar · Title · Subtitle, 7.5 % from the side (title safe), the block's bottom at 82 % | the bar grows, then each line rises in with a fade, one after the other |
| **Title Card** | big centred Title · Underline (35 % of the title's width) · Subtitle | the title settles from 112 % with a fade, the line grows, the subtitle rises |
| **Callout** | Dot on the point · Leader line (elbow) · Title · Subtitle | the dot pops, the line draws on (Trim Paths), the label fades in |
| **Tag** | rounded Pill · word | the pill pops (overshoot), the word follows |

Plus the Arabic ones: **شريط الاسم** and **عنوان كبير**.

- **Sized to the text, measured by After Effects.** The texts are created first and After Effects measures them (`sourceRectAtTime`). The bar, the pill and the underline are then built to that width. A longer name gets a longer pill; nothing is guessed.
- **Arabic:**
  - text right to left, with the universal composer (the project's Arabic rule);
  - the layout mirrored: in a Lower Third the bar is on the right and the lines are right-aligned.
  - *Auto* detects Arabic, and LTR / RTL can force a direction.
- **Settings:** Title, Second line, Accent (#RRGGBB), Text colour, Direction, Duration, and a Font in Advanced (After Effects' default if empty or not installed).
- **Preview:**
  - each tile draws the same layout and plays the same keys as the tool, with the template framed close in the tile;
  - the big Inspector preview shows it in the whole frame;
  - it follows what you type (title, colours, direction) live.
  - Only the text widths in the preview come from the browser. After Effects measures the real ones, and the bar fits them the same way.
- **Where:** the Design tab (first group), the Design stage (first), and the Templates page (Design workspace). Ctrl+K finds it ("lower third", "قالب").

## v0.50: four more, and the exit

| Template | Parts | Entrance |
|---|---|---|
| **Quote** | a big quote mark (accent) · the words · — author | the mark pops, the words rise in, the author fades in |
| **End Card** | logo circle · thank-you line · button pill with its word (sized to the word) | the circle pops, the line rises, the button pops |
| **Social Handle** | pill · dot · @name, in the bottom corner | the pill grows, the dot pops, the name rises |
| **Chapter** | big number (accent, *Number* setting) · divider · title · subtitle | the number rises, the line grows, the title slides in |

Plus Arabic اقتباس and شكراً للمشاهدة; 8 templates, 12 tiles.

**Hold, then exit.** After the entrance and *Hold* seconds, every animated property goes back the way it came, on Quick Animate's keys (the last part in leaves first). Hold 0 means the template stays.

The Lower Third and Social Handle tiles come with a 3 s hold. A small tile shows a 1 s hold so it is never empty for long; the big preview plays your real Hold.

## Safety

- One new host op, `text.create`: one text layer in one Undo group. It returns the measured size.
- If anything fails half way, everything made so far is removed before the error is reported. No half-built template is left behind.
- The number is the next free `MOE Template N`. Restore removes only that template's layers (`layers.remove` with the name guard).
- Your own layers are never touched (tested).

## Found by this release's audit (fixed)

- The click audit of the Templates page could not press **Build** six times: the floating Assistant button was on it. On a short page the sticky bar is not at the bottom of the panel, and the button, lifted above where the bar usually is, landed on it. The fix keeps the button's corner free inside the bar, on the button's side, wherever the bar is. It applies to every library page (tested).

## Checks

- `tests/templates.test.js` (6), all read back from the mock comp:
  - each template's layers are named and parented to one null, and each part sits where `templates.layout` puts it after the entrance, using the sizes measured in the comp;
  - the pill fits the text (a longer word, a longer pill), and the underline is 35 % of the title;
  - the entrance keys equal the plan (times at the playhead, values in the null's space, AE influence), and the callout leader's Trim End goes 0 → 100;
  - Arabic: right-to-left direction on both lines, the bar on the right in the title-safe area; English stays left to right on the left;
  - numbering (MOE Template 2), Restore removes only its own, your layer untouched; a bad colour is refused and nothing changes;
  - the previews use the same plan; the library is on the Design tab and stage.
- **AE Self-Test:** two new checks, *Template: Lower Third* and *Template: Arabic Lower Third*. Each builds a template in the test comp, reads After Effects' own measured text widths and positions, compares them with `templates.js`, then undoes. On the mock: 0 px.
