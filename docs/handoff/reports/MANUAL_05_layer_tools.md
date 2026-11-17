# Manual test — Group 5: Layer tools (Select · Parent & Link · markers · In/Out · Retime / Paste Motion)

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** (with the Group 1–4 fixes deployed) |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G5` 1920×1080 · 25 fps · 10 s |
| Subjects | three 300×200 solids (`Card A` ×3) |
| Code | `features/select`, `features/links`, `features/markers`, `features/retune` |

**Nothing in this group had to be fixed.**

## Results

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | Select › Solids | **WORKS** | One click selected all three solids. History recorded `Solids: 3 matched · 3 selected`. |
| 2 | Parent & Link › Parent Null | **WORKS** | Made one null and parented all three cards to it (Parent & Link column `1. Control`). The layer is named **Control** — the "Null 172" the timeline showed is the *Source Name* column (After Effects' own solid for a null), not the layer name. One Ctrl+Z undid the lot. |
| 3 | Beat Markers | **WORKS (refusal)** | Refused honestly and wrote nothing: *"Beat Markers: No layer with sound in this comp — add a music layer first."* History logged it as a failure **with that reason**. |
| 4 | Motion › **Copy** | **WORKS** | With a layer selected, only `MOTION › Copy` is live; the rest of KEYS / MOTION / LOOP are greyed. After the copy, **Paste lit up** — the readiness state is honest. |
| 5 | Motion › **Paste** | **WORKS** | On a second, unanimated card it wrote the keys and the card **kept its own pose** (Position still 960,540 at t=0) while taking the same *move* — `docs/features/TUNE_AFTER.md`: "Position is pasted as a move (offset to the target), never as a place". |
| 6 | Library Inspector + Tool Card | **WORKS** | Clicking a Motion tile opens an Inspector **under its row**, with a `WILL DO` block — *"Right → Left in · 0.6 s · 1 layer / One Ctrl+Z, or Restore from History"* — then Duration / Ease / Distance / Overshoot, and one sticky **Animate** button. The tool says what it will do before it runs, as `docs/features/TOOL_CARDS.md` asks. |
| 7 | Acts on the real selection | **WORKS** | With exactly one layer selected (confirmed through the bridge: `selected: 1`), the preset animated **only that layer**; the other two were untouched. |
| 8 | History page | **WORKS** | A readable run log — what ran, on how much, how long ago, a Restore button per entry, and failures marked ✗ **with their reason**. It also shows what the Tile Test ran earlier, which is a useful audit trail. |

## Notes
- **A first click on After Effects after typing in the panel only gives the window focus.** That is Windows'
  normal click-to-focus and not a MOE problem, but it caught me out once: a preset ran on the three layers that
  were still selected rather than the one I thought I had just clicked. Worth knowing when reading any report
  that was made by driving the panel and After Effects alternately.
- Clicking the **row** of a one-click result in the search list takes you to that tool's page rather than running
  it; the `APPLY` chip on the right is what runs it. I could not get a clean test of the chip itself (my typing
  raced the panel's re-render twice), so this is **not** reported as a defect — only as untested.

## Not tested in this group
In / Out trimming, Retime, and the marker *writing* path (Beat Markers needs a layer with sound, and this test
project has no audio).
