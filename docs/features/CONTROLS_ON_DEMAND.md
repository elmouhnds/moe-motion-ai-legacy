# Controls on demand (v0.87)

**Owner's rule:** a tool puts in Effect Controls only the sliders that matter for the move it made — not every
variable of the technique. Learned from React 3 (docs/research/REACT3_STUDY.md): its controls arrive with what you add.

## What changed
| | before | v0.87 |
|---|---|---|
| A new **MOE Effector** | 24 controls, always | the 6 core ones + the moves it moves + a group only when its setting is on (a plain Scale effector: 7) |
| **Quick expressions** (37) | numbers in the code unless *Live controls* was ticked | their own Slider Controls by default (Wiggle: Frequency, Amount) |
| Adding the rest later | — | **Effector Controls** (Layout › Effectors › *More Sliders*): one group or all |

## Effector groups (`effectors.GROUPS`, `needed()`)
- **core** — always: Effector Type, Falloff, Size, Softness, Strength, Invert (Clone Colour expressions read them).
- **moves** — Move X, Move Y, Scale, Rotate, Fade: only the ones that are not 0 (Target always has Rotate).
- **random** — Seed (Random, Noise, Noise Field) · Noise Scale, Noise Speed (Noise) · Delay (Delay, Audio).
- **colour** — Colour, Colour Mix · **spring** — Spring, Frequency, Decay · **audio** — Audio Layer, Audio Max ·
  **field** — Field Layer (Image), Field Speed (Noise Field).

## How it stays exact
- The item expression is **v4**: `ev(name, time, default)` looks once per effector whether a control is on the null and
  otherwise uses the default — the same number `effectors.defaults()` gives the reference maths. So an effector with 7
  controls and one with all 24 give the same values (tested item by item).
- A grid built before v0.87 has v3 items, which read every control without a guard. Adding an effector through MOE
  rewrites them as v4 from the facts baked into each one (`factsOf`) — same item, home and path; Restore puts the old
  code back. v0.87 also fixed `factsOf` for stored expressions: the host's `/*MOE-LINK:id*/` made it fail, so that
  rewrite had not been working since v0.62.
- **Effector Controls** adds only controls that are not there, with those same defaults — nothing moves, an existing
  control keeps its value, there is never a second copy. Restore removes exactly what the run added.
- `controls: 'all'` on the Effector tool gives the old full list.

## Honest limits
- Not verified in After Effects: proven on the mock (`tests/controls.demand.test.js`, 5) and by the existing effector suites.
- Linking a lean effector **by hand** (the grid null's *Effector* layer control) to a grid whose items are still v3 gives an
  expression error on that grid — add the effector with MOE, or run *More Sliders › All* on it first.
- Changing *Effector Type* in Effect Controls to one whose sliders are not there works with the defaults; *More Sliders* adds them.
- The Layer Reader can edit a quick expression's numbers only when they are in the code (*Live controls* off); with
  sliders you edit them in Effect Controls.

## v0.93 — the grid null and Proximity too
| | before | v0.93 |
|---|---|---|
| A new **MOE Grid** null | 46 controls (every layout's sliders at once) | its own layout's controls + Layout, Order, Item Scale — **8** for a plain grid — and a group only when it is used (Build when *Animate in* is on, Morph + the other layout when it morphs, Seed with a random order…) |
| A new **Proximity** effector | 13 controls | the three core ones + the sliders the chosen reactions read (Scale Up alone: 4) |

**The grid remembers its own numbers.** Each item expression's head (v8) carries `DFT` — every control's value as the grid
was built (the auto sizes included) — and `c(name)` reads a control that is not on the null from it. So:
- 8 controls and 46 give the same result, tested item by item for plain, animated, radial and random-order grids.
- Switching *Layout* in Effect Controls to a layout whose sliders are not there uses the numbers the grid was built with for
  it, exactly as a full grid would.
- **Grid Controls** (the panel's tool) adds a control that is not there with its new value, and sets one that is.
- **Grid Sliders** (Layout › Clone) adds a group — other layouts, Morph, Reverse · Seed, Scale step · Twist · Orient,
  Random, Build, the simple effector — or all, with the built values; nothing moves; Restore removes what it added.
- An effector slot (*Effector*, *Effector 2*, *Effector 3*) is added to the null when an effector is linked.
- `controls: 'all'` on the Grid tool and on Proximity gives the old full lists.

Proximity needed no expression change: its expressions are generated from the chosen reactions, and `needed()` reads
the control names out of that generated code, so the two cannot drift apart. Applying another reaction later adds its slider.

Tests: `tests/grid.controls.demand.test.js` (4) and the Proximity case in `tests/studio.test.js`. Mock only.

### Honest limits (v0.93)
- Not run in After Effects.
- Each item expression is about 700 characters longer (the `DFT` table). Its cost in After Effects is not measured.
- `DFT` is the grid as BUILT: it is not updated when you later change a control and then delete that control by hand.
- A grid built before v0.93 keeps all its controls; nothing removes controls from an existing grid.
