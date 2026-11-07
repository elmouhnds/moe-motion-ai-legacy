# Smart tools study (v0.66)

Owner, after a screenshot of AppleFX Lite's Expressions page: *take inspiration from how it builds its interface
and uses its tools. Not to copy ideas, but to think: make the tools smarter, better organised and modern, never
crowded, repeated or weak, and change the plugin's roots if that is what it takes.*

## 1. What the reference does well, as principles

| What you see | The principle behind it |
|---|---|
| A list, and one expression shown at a time | **One thing in focus.** Choosing and inspecting are two places; nothing competes with the selected tool. |
| Every name has a short line under it ("Fade at layer edges") | **Purpose before name.** You can choose without opening anything. |
| `autoFade(fadeIn, fadeOut)` under the title | **A signature.** The tool and its inputs in one line, like a function. |
| The preview is labelled "Opacity" | **Say what it acts on.** You know where the result will land. |
| The code is visible and follows the sliders | **Transparency.** What will be written is not a secret; it can be read and copied. |
| Two sliders, with units | **Few numbers, with units.** Only what changes the result. |
| One Apply, with "Applies to the selected property" | **One action, and what it needs.** No second Run button, no guessing. |
| Auto-Fade reads inPoint / outPoint | **Smart by reading the layer.** It adapts to the layer instead of asking for setup. |

What it does badly, so we do not copy it: an Apply step for every expression (MOE applies with one click), 10 of
11 items locked (noise), code cut on the right.

## 2. Where MOE already stood

MOE had the hard part already: every tool computes its plan before running (`prepare()` is pure), the expression
library knows each expression's natural property (`target`), and its code is generated from numbers (`code()`).
But none of it reached the user: the plan was a tooltip, the target was invisible, and the code could not be seen
before Apply. The Inspector also had **two** run buttons (Run in the settings, Apply in the sticky bar).

## 3. The decision: a root change, the Tool Card contract

Instead of redesigning pages one by one, the change is in the contract every tool already follows:
`core/toolcard.js` builds a **card** from the tool itself — purpose, signature, what it acts on, what it will write,
how to undo it, what it needs, and its code. The card is pure (no After Effects call) and uses the executor's own
rules (locked layers, requirements, `prepare()`), so it never promises a run the executor would refuse. A tool can
say more with an optional `explain()`; without it, the card comes from `prepare()`'s preview — every tool (~90) gets
a card on day one (tested).

On top of the contract (v0.66):
- The **Inspector** of every library shows the card: purpose, *Will do* (with what it acts on), the undo line, the
  code with its numbers lit, then the settings. One Apply: the sticky bar.
- Settings the tile already chose (which expression, which style, which motion) are `tileFixed`: no second picker.
- **Expressions** became a list grouped by what each one moves (Position · Rotation · Scale · Opacity · Your
  keyframes). The groups that fit the properties selected in After Effects rise to the top, marked.
- Two smart expressions, built on "read the layer":
  - **Live Stagger**: each layer plays its own keys later, by timeline order (one number per layer, written
    at Apply). A stagger that moves no key and stays editable.
  - **Marker Pulse**: a pop after each layer marker. Put markers on the beats and the layer answers.

## 4. Next ideas, in order of value (not built yet)

1. **Card everywhere**: the same card on hover in NOW, the Quick Bar and Ctrl+K results (it is already one
   function call).
2. **Conflict foresight**: when the context already shows a property's own expression or locked keys, the card
   warns *before* Apply ("Position has your own expression: Apply will need Replace").
3. **Layer reader**: select a layer and MOE lists what it already did to it, from the names and tags it writes
   (`MOE …`, `// MOE …`): edit the numbers, or remove one rig.
4. **Fit to the layer**: durations that follow the layer (fade = 10 % of its length, pop = 8 frames at any fps)
   as a switch on the timing tools.
5. **Marker family**: In at the first marker, Out at the last; a beat grid from audio amplitude written as
   markers, so Marker Pulse and Live Stagger follow music.
6. **Smart defaults from what was used**: a tool opens with the numbers you used last on this kind of layer.

Each needs its own tests and, where it touches After Effects, a Self-Test check before it is called done.
