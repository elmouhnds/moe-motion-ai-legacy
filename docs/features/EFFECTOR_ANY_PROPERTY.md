# Effector on Property (v0.92)

React 3 study, item 8 of 8: "if it can be keyframed, React can control it" — Opacity, Trim Paths, Stroke Colour, point
controls, Polystar Points, Roundness.

## What MOE does
An effector has a sixth channel, **Custom** (beside Move X, Move Y, Scale, Rotate, Fade). **Effector on Property** wires
any NUMBER property of a grid's items to it:

1. Select the property on ONE item (Trim Paths End, Stroke Width, Roundness, a blur amount, any slider — click its name
   in the timeline).
2. *Effector on Property* writes, on that property of EVERY item of the grid:  `value + ecu`  — the property's own
   value plus what the grid's effectors give on Custom, in the property's own units (2 and 3 value properties get the same
   amount on each value).
3. Each effector's **Custom** slider is the amount. *Amount* in the tool puts that value on every linked effector that has
   no Custom slider yet; an effector that has one is left as set. The Effector tool has the same setting (*Any property*),
   and *More Sliders › Any property* adds the slider later.

Falloff, type (Random gives each item its own share, Step, Noise, Wave, Audio…), the spring, Snap To and Clamp apply,
because the property's expression has the same head as the item's Position / Scale / Rotation / Opacity
(`expressions.buildCustom`). Item expressions are **v7**; a wired property is rewritten with the items when an effector is
added to an older grid (its number of values is marked in its code).

## Refused, before anything is written
Position / Scale / Rotation / Opacity (they have their own channels) · colours, paths, text (not numbers) · a property
whose layer is not an item of a MOE Grid · a property with your own expression · properties of two grids at once.

## Tests (`tests/effector.property.test.js`, 5) — mock only
Six-term maths · a slider on 9 items wired from one selection equals 10 + the reference's custom term at 5 times of a sweep,
follows a change of Custom, Restore exact (expressions and the added slider) · Step gives 0 … 80 across the items; an
existing Custom slider is left as set · the refusals write nothing · a later effector rewrite keeps the wired property on the
current version. The test mock now also reports selected effect parameters (as After Effects does).

## Honest limits
- **Not run in After Effects.** In particular: selecting a deep shape property (Trim Paths End) and addressing "the same
  property" on every other item relies on the items having the same structure — true for clones, checked per item (items
  without it are counted and left alone), but not exercised on real shape layers.
- **One Custom channel per grid**: every wired property of a grid gets the same amount. React 3 has an effector per
  property with its own value. Two properties that need different amounts need two grids, or a scale of your own.
- **No colours** (Stroke Colour is on React's list): colour stays with Clone Colours and its own Colour / Colour Mix.
- The amount is added (relative). There is no Absolute mode for a custom property.
- No Self-Test check for it yet.
