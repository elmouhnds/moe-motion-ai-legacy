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
- Not trimmed yet: the grid null (23 controls) and Proximity (13). Their expressions read every control unguarded.
- The Layer Reader can edit a quick expression's numbers only when they are in the code (*Live controls* off); with
  sliders you edit them in Effect Controls.
