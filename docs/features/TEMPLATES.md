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

## v0.51: in your client's brand

With a client active in Brand Kit (or only one saved) and *Use the brand* on, which is the default:
- **Accent:** the brand's primary colour.
- **The word on a pill or button** (Tag, End Card, Social Handle): whichever reads best on that accent, out of the brand's text colour, its background, black and white. It is contrast-checked, at least 4.5:1 when one of them reaches it.
- **Font:** the brand's Arabic font for Arabic text, its English font otherwise.

What you set yourself wins (an accent you changed, a font you typed); *Use the brand* off ignores the brand.

The tiles and the big preview already show the client's colours (`templateTool.withBrand` is used by both the tool and the previews), and the result says *· <client> brand*. The preview cannot show the brand's font; After Effects uses it.

## v0.52: Auto-fit, the text always stays inside the frame

A long name or a long quote used to run off the edge. Now each line has a **safe width**: a share of the comp's width (Title Card 85 %, Quote 72 %, End Card 80 %, Lower Third 60 %, Chapter 55 %, Tag 50 %, Social Handle 45 %, Callout 32 %).

- After Effects creates the text and **measures it** (`sourceRectAtTime`).
- If it is wider than the safe width, the font gets smaller (`fontSize × safe / measured × 0.98`). It is measured again, up to 4 times, until it fits.
- It never goes under **40 %** of the design size, so a very long line gets small but stays readable.
- The shapes (bar, underline, pill, button) are then sized from the **fitted** text.
- The quote mark and the chapter number keep their size.
- Short text is not touched.
- The result lists each fitted line (*Fitted to the safe area · Title 120 → 74 px*), read back from the layer.
- The preview uses the same rule with the browser's measurement (`templates.fitSize`), so what you type shows its fitted size before you build.

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
- v0.52 Auto-fit (`tests/templates.test.js`, 12): a long Title Card title measures ≤ its safe width on the mock with a smaller font (never under 40 %), and the result lists it; the underline follows the fitted width; a short title keeps 120 px; a long Arabic quote fits and the quote mark keeps 220 px; `fitSize` cases; the preview uses the same formula.
- **AE Self-Test:** two new checks, *Template: Lower Third* and *Template: Arabic Lower Third*. Each builds a template in the test comp, reads After Effects' own measured text widths and positions, compares them with `templates.js`, then undoes. On the mock: 0 px.

## v0.94 — own comp, one Ctrl+Z
A template (and every product UI piece, which is one) is built in its own comp `MOE Template N` and placed in the active comp as ONE layer at the playhead; one Ctrl+Z removes it, and Restore removes the layer and the comp (only if nothing else uses it). The first apply measures the texts in a temporary comp (`text.measure`, one undo step that changes nothing). `container: Layers` keeps the old loose layers in the active comp. See docs/features/ONE_UNDO.md.
