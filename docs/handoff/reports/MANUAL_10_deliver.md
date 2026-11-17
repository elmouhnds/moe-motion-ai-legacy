# Manual test — Group 10: Compositing · Adapt (formats) · Bake · Scene Check · Deliver

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G6` — a **MOE Background** with a card over it |
| Code | `features/compositing`, `features/adapt`, `features/bake`, `features/scene`, `features/previews` |

**Nothing in this group had to be rescued the way Thick Glass did. The one real defect is Bake's Restore, and this
report hands it over with the exact value that comes back wrong instead of the bare number the owner had.**

## 1. The tools

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | **Compositing** (analyze · grade · keySetup) | **WORKS** | 3 of 3 tiles pass, each verified by read-back: *"Graded 1 layer — MOE Grade verified"*, *"Keyed 1 layer(s) — screen colour sampled, chain verified"*. `compositing.analyze` answered *"No visible pixels at the sampled frames"* on the test subject — a refusal that says why, not a silent zero. |
| 2 | **Look Assist · Match Colour** | **CAN'T TEST (honest refusal)** | Both refuse without their input and name it: *"Look is required"*, *"Reference is required"*. They need a reference image, which the test subjects do not have. |
| 3 | **Adapt — "Every format from one master"** | **WORKS** | See §2. |
| 4 | **Suggest Layout** | **WORKS** | `Claude layout for 3 element(s) · changed no layer` — it plans without writing. |
| 5 | **Scene Check** | **WORKS** | See §3. |
| 6 | **Bake** | **WRONG RESULT (Restore)** | The bake itself is exact; the restore is not. See §4. |
| 7 | **Deliver page** | **WORKS**, with one layout defect | Every format at once · Scene Check · Dup Comp · Reveal in Project · Open Pre-comp · Open Folder · Purge Cache · Trash MOE rigs. The defect is in §5. |

## 2. Adapt — plans first, measures, and keeps the original

The page says what it is: *"Every format from one master — plan all aspect ratios at once and adapt the animation,
keyframes kept."* It shows a **board** of the real plan before anything runs: `Source · 16:9` beside `9:16`, `1:1`
and `4:5`, each drawing the card in the new frame with its safe area, over a legend that explains every role —
*background · cover · pinned · keeps its corner · content · re-stacked · band · full width* — and a per-layer row
where each layer's role can be changed (`Glass Card: auto · content`, `MOE Background: auto · background`).

Pressing Create built **three comps — 1080×1080, 1080×1350 and 1080×1920** — and left `MOE Manual Test G6`
untouched, as promised. Each format reported its own read-back, per layer:

```
9:16   MOE Manual Test G6 1080x1920: 2 layer(s) re-framed, keyframes kept      [Restore]
       ✓ 1080×1920 · new comp
       ✓ Glass Card (content) · placed as planned (measured)
       ✓ MOE Background (background) · placed as planned (measured)
1:1    MOE Manual Test G6 1080x1080: 2 layer(s) re-framed, keyframes kept      [Restore]
4:5    …
```

*"placed as planned (**measured**)"* is the executor's verify-by-read-back doing its job, and each format has its
own Restore. **Not checked:** I could not get the 9:16 comp to open in the viewer from the Project panel (my
double-clicks selected it without opening it), so I judged the result from the three comps' sizes and the tool's own
measurement, not with my eyes on the frame.

## 3. Scene Check — the best-behaved page in the panel

It does exactly what `SCENE_CHECK.md` asks, and says so on screen:

> *"One read of this comp — nothing is changed, nothing runs in the background."*

- **Read this comp** → *"MOE Manual Test G6 · 2 layers · read once — press Read again after you change the comp."*
  It admits when it is stale instead of pretending to be live.
- **What fits this comp** — *"Living Loops · Because: 2 of 2 visible layers do not move · Start with Breathe"*, with
  **Open kit** / **Work in it**. It gives its reason, as the doc requires of a suggestion.
- **Motion timeline** — *"0 of 2 layers move · 10.00 s · bars = keyed spans, dots = markers"*, one row per layer.
- **Quality check** — *"Nothing to fix so far · Measure adds title safe"*, then after measuring *"Nothing to fix ·
  keys, text, title safe"*. Measuring is a **second, separate click**, never automatic.
- **Storyboard** — after Measure it drew *"1 · Scene 1 — 1.00 s · 2 layers"*, *"2 · Scene 2 — 3.52 s · 2 layers"* as
  wireframe frames, under the sentence *"It is drawn from measurements — **not a render**."*

## 4. Bake — the bake is exact, the Restore is not

```
FAIL bake — 36 properties baked (138 keys, 18 plain values) · 135 values at 5 frames,
            worst 0 from the live rig · restore differs by 770 · undo ok
```

The bake is **perfect** — 135 values at 5 frames, worst difference **0** from the live rig. `BAKE.md` also requires
Restore to be exact, and it is not.

### What I added so the number can be acted on
The check reported a bare `770`, which names nothing. It now names the value:

```
restore differs by 770 (item 1 Position at 0.4s: [-920,-540,0] vs [-150,-120,0])
```

`[-150,-120]` is item 1's place in the 3 × 3 grid (150 × 120 spacing). `[-920,-540]` is what the item expression
gives when it is computing in comp space instead of the grid null's — the item collapses towards the frame's
corner. So **Restore brings the expressions back but they no longer resolve to their grid**.

### What I ruled out
- **It is not the Tile Test's undo problem from Group 8.** The Self-Test's `T.undo()` does not press Ctrl+Z at all —
  it calls MOE's own `executor.restore()`. This is the Restore path, measured directly.
- **It is not the saved text being wrong.** `bake.restore` already compares, per property, what came back with what
  was saved, and it reports every one as matching.

### What I fixed here
`rig.bake`'s `restore()` threw the host's answer away and always returned `{ ok: true }` — against CLAUDE.md's
*"never report success without reading the resulting host state"*. It now reads the per-property result and names
what did not come back. (On this run the host still reports every expression restored, which is what points the
finger away from the saved text and towards what the expression resolves to.)

### What I did not do
I did not guess a fix. The remaining question is what the restored expression resolves to in After Effects — one
look at `MOE Grid 1`'s item expression after a Restore will say — and that is reading, not patching by eye.

## 5. The Assistant button covers the Deliver page's own button

`CLAUDE.md` says pages keep 60 px of end room for the floating Assistant button. On the Deliver board they
collide: the green **Create 3 comps** button sits underneath it, its label is cut to **"Create 3 co…"**, and my
first click on the button went to the Assistant instead — the formats were not created and nothing said why. I had
to click the button's left edge to reach it.

That is two rules at once: the overlap, and `NO_CUT_NAMES` (*"a name never ends in '…' — it wraps"*). It needs a
layout decision rather than a number I pick, so I have not changed it.

## 6. Also seen

- **The panel reports "No active composition" honestly.** Clicking into the Project panel makes After Effects'
  active item a folder, and the Deliver page immediately said *"Open the composition you want to deliver in other
  formats."* rather than acting on a stale comp.

## 7. Numbers

| | |
|---|---|
| `compositing` tiles | **3 pass · 0 fail** |
| Adapt | 3 comps created, every layer measured, originals untouched |
| `npm run check` | **646 pass · 0 fail · 1 skipped** |

Still failing in the Self-Test, unchanged from Group 7 and not touched here: `text` / `textArabic` (the Cloner
places split words 340 px / 216 px from their words, 3 allowed) and `exploder`
(`ST Explode: animator read-back mismatch`).
