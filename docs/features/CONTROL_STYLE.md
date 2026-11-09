# Control — a Control Center for motion (v0.70)

Owner, after two rounds of from-scratch concepts: *"Control Center for motion — that's the one. Make something like it,
very professionally."* Control is a fourth style next to Bento (default), Glass and MOE: Settings › Style, or ≡ › Style.
The other three are unchanged.

## The idea
Every square **is** the tool, not a button that opens one. The squares follow the selection, the ones you switch on
gather in the **Mix**, and **one Apply** runs them.

| Selection | Squares |
|---|---|
| Layers / shapes | **Motion** (hero) · **Duration** · **Stagger** · round **Blur / Overshoot / Expo / Order** · **Wiggle** · **Beats** |
| Text | the same + **Typewriter** |
| Keys | the **Motion Control** first (ease, curves, anchor, align — its one place), **Loop** (Cycle / Ping-Pong / Offset), **Wiggle** |
| Nothing | "Select a layer" + Libraries |

- **Motion** plays the move it will write: the library's own preview recipe (`studio/thumbs.js`) with the Mix's args,
  so Blur, Overshoot, Duration and Stagger show in the square (REAL_PREVIEWS rule). Fade · Pop · Rise · Slide · Spin, In / Out.
- **Sliders** are tall squares: drag up / down anywhere on them (Wiggle: sideways). They go through `scrub.js attach`
  (new `axis: 'y'` + `span`): live while dragging, one commit on release, Esc puts the first value back, click to type.
- **Round switches**: Blur (`MOE Blur`, 24 px), Overshoot (moves in only, not a fade), Expo ease (else Snappy),
  Order (stagger by screen — rows, left → right). Each says why when it does not apply (one layer, a fade, a move out).
- **Wiggle**: amount slider + an on / off switch inside the square.
- **Beats**: markers on the beats of the comp's sound layer (`markers.beats`, read with After Effects' Convert Audio to Keyframes).
- Click a square: in / out of the Mix. **Double-click**: run that square alone, now. **Right-click** (Motion, Loop,
  Typewriter): its full page.
- **Libraries**: every page (`studio.NAV`) one click away, so nothing is lost in this style. Shortcuts are in the
  sidebar, as in MOE and Glass.

## Layout (v0.71, owner: "start with all of it")
- One **head**: selection + comp (name · fps) + Refresh / Repeat; Control's home hides the shell's context strip (`hideCtx`, never over a host error) and the search row — search is the header magnifier (Ctrl+K).
- **Motion**: preview fills the square, caption over a fade; kinds and In / Out in one row.
- **Tune block** beside it: Duration + Stagger (unit right after the number) and the four switches (2 × 2 beside the sliders at 400–560 px).
- Groups **Move** and **Add** (**Keys** first with keys selected).
- **Motion Control** folds to one line for layers (`cc-control-open`, remembered); open for keys.
- **Libraries**: one row that scrolls sideways. **Mix**: a thin line while empty. **Sidebar**: icons only.

## Pages (v0.72, owner: "only this page?")
Tabs under the head (Ctrl+1…5): **Move** (above) · **Text** · **Design** · **Look** · **Deliver** (`layoutControlPages.js`).
- Text: text presets In / Out playing your own text (ع = Arabic-safe; a warning badge on letter-by-letter presets when your text is Arabic), Typewriter, Counter.
- Design: backgrounds (big preview + colour strips), templates; links to Shapes & Icons, Product UI, Brand.
- Look: Styles, Glass, Zoom & Focus; links to Compositing, Expressions. Deliver: social safe zones, composition guides; links to Deliver, Layout & Grid.
- Click picks (big on top, the bar says what it will do from the tool's card, one Apply); double-click applies; right-click / All › open the library. Tiles that need setup stay on their library page.

## The Mix
`layoutControl.plan(cc, kind, nLayers)` is pure (tested): the runs in order — the move first, then Typewriter, Wiggle,
Loop, Beats — each as `{ tool, args }` of a registered tool. Squares the selection does not show never run.
- The bar shows each run as a chip (× takes it out), then one line: the first run that is not ready and why, else the
  first **Tool Card warning** (`core/toolcard.card`, never a second rule list), else *N runs · each can be undone in History*.
- **Apply** runs them one after another through `app.runTool` → the executor (validate → prepare → execute → verify →
  checkpoint). It stops at the first run that is not ready or does not succeed and says what already ran. Each run is
  its own History entry and Restore. After a full run the squares switch off (the numbers stay), so a second click
  never repeats it.

## Rules
- A new square is a registered tool's own args; never a second engine. Ease / anchor / align stay in the Motion Control.
- Hover only changes colour; the CSS is scoped to `.app.layout-control` in `css/styles.css`, Chromium 99 only (tested).
- Under 560 px the grid has two columns (hero and wide squares full width).

## Tests
`tests/control.test.js` (6): the fourth style, squares per selection, the Mix's args (stagger / order only for 2+
layers, no overshoot on a fade or a move out, solo run), one Apply on the mock (Pop In keys on Scale + `wiggle(2, 12)` on
both layers, switched off after), a Mix that stops before a run that would replace your own expression and says what
ran, the CSS guard. `audit-cut` covers the fourth style.
