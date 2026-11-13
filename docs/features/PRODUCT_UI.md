# Product UI (v0.57.0)

**The owner:** *"Can we add a page like a SaaS kit? The links are only a reference. I need your own creativity to develop more things for this section."*

The first version was built before the two reference pages could be read (their hosts were blocked by the build machine's network). It is built from what a product / SaaS motion kit is for: **interface pieces that move the way they are used** in a product video. The pages were read afterwards (the owner allowed the hosts); the comparison is below. Nothing here copies either product.

## What it is

**Design › Product UI**: eight pieces, each built **in your comp with real, editable layers** on the Templates engine (docs/features/TEMPLATES.md):
- text layers that After Effects measures;
- rounded shapes sized to that text;
- paths that draw on;
- one null `MOE Template N` to move or scale the whole piece.

Every piece has an animation that **uses** it, not just an entrance:

| Piece | What happens |
|---|---|
| **Button Click** | The button pops in, then is clicked: it presses to 94 % and springs back while a ripple spreads and fades. |
| **Toggle Switch** | A settings row; the knob slides across (squashing a little as it goes) and the track fills with the accent. |
| **Search Bar** | The field grows in, the magnifier draws itself, the query slides in, and the text cursor blinks. |
| **Task Done** | A to-do row: the box fills, the check mark draws, the task is crossed out and dims. |
| **Notification** | A phone-style card drops in from the top with its app icon, title and message. The tile leaves after 2 s. |
| **Progress Bar** | A labelled bar fills from left to right (Trim Paths on a round-capped line), then the percentage pops in. |
| **Chat Message** | Three typing dots bounce in a grey bubble, then the message bubble pops in, in the accent. |
| **Stat Card** | A dashboard card: the label, a big number, and a trend line that draws itself to a peak dot. |

- **Light / Dark** (*Look*): a white card with dark text, or graphite with white text. Four dark tiles are ready-made.
- **In your client's brand**:
  - With a client active in Brand Kit, the kit's blue becomes the brand's primary colour, and the button word uses the brand colour that reads best on it.
  - A colour you chose yourself is kept.
- **Auto-fit**: a long title shrinks until After Effects measures it inside its width (v0.52).
- **Hold, then exit**: every piece can leave by itself the way it came (v0.50).
- **The preview is the plan**: each tile plays the same keys the tool writes (`thumbs.js` draws `templates.layout`). Every property's keys are one list (entrance + click + blink), so the preview and After Effects play the same thing.

## Found and fixed: text under its own shape

While building this, I found a bug in the v0.49 engine. After Effects puts every new layer **on top**, and the tool creates the texts first (they must be measured) and the shapes after. So in After Effects:
- the Tag's pill would cover its word;
- the End Card's button would cover its label;
- the Social Handle's pill would cover the name.

The mock models this order, but no test read it.

Now the texts are moved back above the topmost shape (`layers.move`) right after the shapes are built. Tests check the timeline order for every UI piece and for Tag and End Card.

## Where

- **Design workspace › Product UI** (filters: Controls, Feedback, Data, Dark).
- **Design tab › Product UI** group (8 tiles).
- **Design stage**.
- **Ctrl+K**: "button", "toggle", "notification", "progress"…

## Checks

- `tests/productui.test.js` (5), read back from the mock comp:
  - all eight build with every planned part in one null, and the texts above the shapes;
  - the stacking fix on Tag and End Card;
  - the knob slides right and the track fills (0 → 100);
  - the button presses below 96 % and returns to 100, and the ripple is invisible until the click;
  - the progress fill is keyed, the task ends at 55 %, and the typing dots bounce;
  - Light / Dark card colours;
  - the brand replaces the kit blue, and a chosen colour stays;
  - 12 tiles on the Design tab and stage, and settings only where they apply.
- Playwright: the page, and the big previews mid-action (toggle on, message arrived, chart drawn, task ticked). 0 JS errors.
- `audit-cut` 132 screens 0, `audit-arrange` 0, `audit-repeat` 0, stress stable.

## Reference study (read 2026-11-06)

What the two reference products offer, compared with what MOE already has. Only the product pages were read, not the products themselves.

| Reference feature | MOE today | Gap → next step |
|---|---|---|
| SaaS Kit: **3D cursor that lands on the selected layer, and the button reacts with a scale** | Cursor tool (needs Position keys); Button Click piece (its own press) | **Click on layer**: pick the targets, the cursor travels to each, clicks, and the target presses |
| SaaS Kit: **UI Stagger** (select layers → smooth staggered reveal in one click) | Stagger + Animate presets (separate steps) | **UI Reveal**: rise + fade + slight scale, staggered by position (top-left first), in one click |
| SaaS Kit: **3D Carousel** | Grid Builder ring / 3D layouts | **Carousel** preset: cards on a 3D ring that turns step by step, the front card brightest |
| SaaS Kit: **Depth Reveal** transition | — | A depth-map based reveal (needs care: real effects, read back) |
| SaaS Kit: text — coloured reveal, staggered letters / words, random letters, exploder | Text Animators (words / lines; Arabic safe), Typewriter | Coloured reveal, random letters, exploder as text presets |
| SaaS Kit: backgrounds for product UI | Animated backgrounds (32 palettes) | Product-style gradient presets |
| SaaS Kit: proximity hover, glass panels, SVG import | Proximity rigs, Glass / Thick Glass, SVG → shapes | — (already there) |
| SaaS Kit: **Figma → After Effects** layer for layer | SVG → shapes | Large: a Figma import (export → MOE) is its own project |
| AppleFX: **Apple easing** (iOS / macOS curves) | Ease library (Bezier, per segment) | An **Apple curves** set in the Ease library (spring-like, calm) |
| AppleFX: 73 presets in 7 tabs (Easing, Text, Transitions, Glass, Styles, Shakes, Expressions), live preview, controls (duration, blur, scale, direction) | Animate / Text / Expressions / Looks libraries with real previews and controls | **Blur** as a control on entrances (Apple-style blur-in), Shakes presets, Side-to-Center style transitions |
| AppleFX: Liquid Glass, gradient glass text | Thick Glass | Glass on text |
| AppleFX: colorways, light / dark | 8 accents × 3 themes | — |
| AppleFX (coming): cursor animations, shape morphing, backgrounds tab | Cursor, Backgrounds | Shape morphing |

**From the SaaS Kit's own screenshots** (public product images, allowed by the owner):
- Its panel is grouped as **Text** (Typing, Text Reveal, Exploder), **Animate** (UI Stagger, Bounce), **Transitions** (Wipe Reveal, Depth Reveal), **Interaction** (Cursor, Proximity Hover), **Elements** (Number Counter, Carousel, Glass), **Rigging** (Attach Layer) and **Backgrounds** (Gradients).
- The look that sells it: **a clean UI card (white or dark) floating over a soft, glowing purple-blue gradient**, with a cursor clicking a button.
- For MOE, that means a **product backdrop** (the glow behind the card) belongs next to the pieces: our animated backgrounds can draw it, as a preset set made for product shots.

## Next ideas for this page

- **Soft shadows**: a drop shadow on the cards.
- **Cursor that clicks the button**: the Cursor tool (v0.4) aimed at the Button piece's centre at the click time.
- **Phone / browser frames**: a device frame the pieces sit in.
- **More pieces**: a pricing card, a tab bar, a slider control, a toast, an avatar stack.

## v0.94 — own comp, one Ctrl+Z
A template (and every product UI piece, which is one) is built in its own comp `MOE Template N` and placed in the active comp as ONE layer at the playhead; one Ctrl+Z removes it, and Restore removes the layer and the comp (only if nothing else uses it). The first apply measures the texts in a temporary comp (`text.measure`, one undo step that changes nothing). `container: Layers` keeps the old loose layers in the active comp. See docs/features/ONE_UNDO.md.
