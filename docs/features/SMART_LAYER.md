# Smart Layer (v0.67)

The four ideas queued in `docs/research/SMART_TOOLS_STUDY.md` §4, built, plus three that came out of building them
(Marker Trigger, Marker In / Out, Beat Markers).

## 1. Foresight: surprises said before Apply
- `core/toolcard.js` adds `warnings[]`: the tool's own (`explain().warnings`) plus one generic rule — a keyframe tool
  on selected properties whose expression is on says *new keys stay hidden until it is off*.
- Expressions: a **selected** property that already holds your own expression now stops in `prepare()` (the context
  carries each property's expression) instead of halfway through the run; with *Replace existing* the card says
  *replaces your own expression on … — Restore brings it back*.

## 2. Hover Cards
`app/ui/hovercard.js`: rest the pointer 0.55 s on a one-click button (`data-key` `a-` / `qt-` / `rc-` / `gl-` / `nx-`
followed by a `quick:` / `tile:` ref) and its Tool Card appears — the same `toolcard.card()` as the Inspector
(tested equal). An overlay outside the morphed tree (never moves the layout), gone on press, wheel, scroll, key or blur.
`actions.resolve()` now returns `tool` + `args`. Setting `ui.hoverCards: false` turns it off.

## 3. Layer Reader — *On this layer* (Layer tab, after Select; stage Arrange)
- **Read this layer**: one `rigs.find` call on the click (never a background poll). Rows from `kit/reader.describe`:
  each MOE expression (preset, the property it is on, its numbers) and each MOE effect.
- Numbers are read back by `expressions/quick.parse`: the preset's own code is generated with placeholders and matched
  exactly — a hand-edited expression is not guessed (shown by its tag, no Edit); a live one says *numbers on live sliders*.
- **Edit** opens the preset in Expressions with those numbers; Apply replaces it in place.
- **Remove** removes that one item only (`kit.removeRig` → `rigs.remove` with `only`), one Ctrl+Z; your own
  expressions and effects are never listed or touched.

## 4. The marker family
- **Marker Trigger** (keyed): animate once; your keys replay from the start at every layer marker (first key before the
  first marker, last key when a run is over).
- **Marker In / Out** (Opacity): fades in after the first marker and out into the last; move the markers to retime it.
- **Marker Pulse** (v0.66) belongs to the same family.

## 5. Beat Markers (Timing tab, `markers.beats`)
The sound is read only through After Effects' own Convert Audio to Keyframes (`audio.amplitude` → the reused
`MOE Audio · <layer>`), its envelope with the read-only `audio.envelope`, and beats found by the pure
`markers/beats.find` (local peak, above a floor and the recent average, a minimum gap; deterministic). Markers
(`MOE Beat`) go on the selected layers — or on the sound layer when it is all you selected — through `markers.add`
(`MarkerValue`, the layer's Marker property). Restore removes exactly those markers (time + comment) and the amplitude
layer if this run made it.

## Tests
`tests/smartlayer.test.js` (6) + Self-Test check `markers` (After Effects counts the markers and Marker In / Out
reads 0 · 100 · 0 before / between / after). Mock: `MarkerValue`, a layer Marker property, `thisProperty.key()`.
