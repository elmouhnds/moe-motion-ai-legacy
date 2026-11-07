# Tool Cards (v0.66)

Every library tile says what it will do **before** Apply. Study: `docs/research/SMART_TOOLS_STUDY.md`.

## The card
`core/toolcard.js` → `card(tool, args, ctx, services)`:

| Field | From |
|---|---|
| `purpose` | the tile's hint, else the first sentence of the tool's description |
| `signature` | `explain()` (expressions: `autoFade(secs 0.4)`) |
| `target` | `explain()` — what it acts on, e.g. *Opacity · 3 layers* |
| `ready`, `needs` | the executor's own rules: locked layers (`lockpolicy`), `requires`, then `prepare()` |
| `writes[]` | `explain().writes`, else `prepare().preview` (summary + items), plurals tidied |
| `undo` | *One Ctrl+Z*, *… or Restore from History* (checkpoint tools), or *Changes nothing* |
| `code`, `numbers` | `explain()` — the exact expression and the numbers to light |

Pure: no After Effects call (tested). A tool adds `explain(args, ctx, prepared)` only when its preview is not
self-explanatory.

## The Inspector
Purpose · **Will do** (what it acts on, the list, the undo line) or **Needs** (one line) · the code with its numbers
lit and Copy · the settings (`renderTool(…, { bare: true, fixed })`: no header, no Run, no second preview list).
The library's sticky bar is the one Apply.

`tileFixed` params (which expression, style, motion, look, mode, template) are hidden in the Inspector **only when
the tile sets them**; *All tools* still shows every setting.

## Expressions list
`sections.js` `groupBy` / `groups`: Position · Rotation · Scale · Opacity · Your keyframes. `library.groupTiles`
sorts the groups that fit the selected properties first (name match; keyed properties also fit *Your keyframes*)
and marks them *fits your selection*. Rows: a small moving picture, the name, the purpose on up to two lines.

## New expressions
- **Live Stagger** (`cascade`): `thisProperty.valueAtTime(time - i * delay)` with `i` = the layer's rank in the
  timeline among the targets (`quick.ranks`), written per layer. No key moves.
- **Marker Pulse** (`markerPulse`): `1 + amp · sin(2π f t) / e^(decay t)` after the latest layer marker.

## Tests
`tests/toolcards.test.js`: ready / not-ready cards, every registered tool gets a card, no host call, code runs
rebuild the code, Live Stagger equals the delayed pre-expression value at four times on three layers, Marker Pulse
peak after each marker, grouping order, plurals. Mock: `ae-expr.markerOf` gives expressions AE's marker API.
