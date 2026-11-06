# Wipe Reveal + Carousel 3D (v0.63.0)

The last two pieces of wave 3 of the reference plan (docs/research/REFERENCE_PLUGINS.md), built on Engine 2: keys on frames, one Ctrl+Z, locked layers safe, few round trips.

## Wipe Reveal (Motion › In / Out › Wipe)

After Effects' own **Linear Wipe**, one effect per layer named `MOE Wipe`, reused and never doubled.

- **Wipe Angle and Feather** are set by their English names. **Transition Completion** is keyed:
  - **100 → 0** to reveal;
  - **0 → 100** to hide.
- **From:** left, right, top, bottom, or a diagonal.
  - The reference manual says the wipe travels from left to right at 90°.
  - A reveal runs the transition backwards, so the layer appears in that direction: from the left = 90°, from the right = 270°, from the top = 180°, from the bottom = 0°.
- **Soft edge** (Feather, px), **Duration**, **Ease** (Quick Animate's), and **Stagger** with the screen **Order** from UI Reveal.
- **Restore** removes the keys and the effect the run added.
- **Self-Test** *Wipe Reveal "from the left" reveals the left side first (pixels)*:
  - a white solid is revealed from the left;
  - half-way through, `sampleImage` reads the alpha of four columns;
  - the left must be more visible than the right.

  The direction is measured in After Effects, not assumed from the manual. The mock draws no pixels, so it reports "info" there.

Tiles: Wipe In → / ← / ↑ / ↘, Wipe Out → / ←. Each preview plays the tool's own keys along the same angle.

## Carousel 3D (Layout › Arrange › 3D)

The selected cards (3 to 24) go on a 3D ring around one 3D null `MOE Carousel N`, which turns one card at a time: hold, turn, hold.

| Part | How |
|---|---|
| **Radius** | The smallest ring where neighbours never overlap. After Effects measures the widest card; the chord between neighbours is set to *widest + gap*: **R = (widest + gap) / (2·sin(π/n))**. |
| **Placement** | Card *i* at θ = 360·i/n, at (R·sinθ, 0, −R·cosθ) in the null's space, with Y Rotation θ so it faces out. Card 1 is in front. The ring stands where the cards were (their measured centre). |
| **Motion** | **Y Rotation keys on the null**: hold, turn by −360/n (the next card comes to the front), hold, and so on. Turns = 0 means one full loop. Every key is on a frame, eased 75 %. No expressions. |
| **Depth fade** | Each card's **Opacity keys**, at the same times, from its angle at that moment: 100 at the front, 100 − Depth at the back. |
| **Tilt** | The null's X Rotation leans the ring toward the camera. |

- **Refused before anything changes:** fewer than 3 cards, more than 24, or a parented card (the ring becomes their parent).
- **Restore, in reverse order:**
  - the opacity keys come off;
  - each card's position and rotation go back, then it is unparented with a jump to its world place;
  - cards that were 2D become 2D again;
  - the null is removed.

Tiles: Carousel 3D, Carousel · Tilted, Carousel · Quick. The preview draws the same ring, steps and depth with a simple perspective.

## Checks

`tests/wipecarousel.test.js` (5):

- **Wipe:**
  - the effect, its angle per direction, and keys 100 → 0 on frames;
  - a second run reuses the effect;
  - Restore;
  - screen-order stagger with every start on a frame.
- **The carousel plan:** the chord equals widest + gap; cards face out; a full loop ends at −360° on the grid; depth 100 at the front and 40 at the back; card 2 is in front after one turn.
- **Carousel on the mock:**
  - the radius comes from the widest card (340 px);
  - every card is 3D, parented, and at its ring place and angle;
  - the null's keys and the depth fade are written;
  - Restore puts every card back to the 0.01 px, 2D, unparented, with no keys, and removes the null.
- **Refusal:** fewer than 3 cards.
