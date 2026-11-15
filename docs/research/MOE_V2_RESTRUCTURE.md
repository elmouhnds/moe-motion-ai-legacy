# MOE v2 — review of how we work, and a restructure that builds tools that really work (2026-11-15)

Inputs: `MOTION_DOCK_STUDY.md` (the site, the docs, five demo videos, 30 module images), `MOTION_DOCK_VIDEO_STUDY.md`
(the owner's tool-by-tool study of the SternFX review), the four reports from inside After Effects 26.5, and the code.
The owner asked: review the way we work, restart with a correct structure, and say how my thinking has changed.
**The rule from the owner still stands: tests first.** This plan is built around that rule.

## 1. Honest review — what we built and what is proven
| | Number |
|---|---|
| Versions released | 0.4 → 0.99.5 (≈ 90 releases) |
| Registered tools / library tiles / UI styles | 100 / 357 / 4 |
| Code | ≈ 32,000 lines panel JS + 5,100 lines ES3 host |
| Tests | 643 — all green, **all against a mock written by us** |
| Runs in real After Effects | 4, all on **0.99.0** |
| Tiles that ran without an error there | 222 / 353 |
| Tiles whose OUTPUT was checked as correct there | **0** |
| Ctrl+Z verified there / renders that succeeded there | **0 / 0** |
| After Effects bugs found by those 4 runs | 13 — every one a place where our mock believed something After Effects does not do |

### Why it went this way (root causes, not symptoms)
1. **Wide before deep.** 100 tools existed before one was proven in After Effects.
2. **The mock agreed with the code by construction.** The same mind wrote both, so the tests proved *consistency*, not
   *correctness*. After Effects 26 disagreed on dropdowns, ranges, hidden properties, parameter order, Render formats,
   undo nesting, null opacity, wipe direction.
3. **"Pass" meant "did not throw".** A grid in the wrong place, a wipe in the wrong direction, passed.
4. **The loop with After Effects took days** (installer → owner → side session → report → me), so it ran 4 times.
5. **Effort went to surfaces:** four styles and many redesigns; each style doubles what has to be tested.
6. **Big footprints:** many tools build rigs (several layers, nulls, expressions wired by layer names, effect
   parameters by index). Every moving part is one more place After Effects can disagree.
7. **The repository has no remote.** All of MOE lives in one cloud container and in release zips. One lost container
   = lost history. (Fix first, see §6.)

## 2. What the two Motion Dock studies teach together (beyond "it looks good")
The UI lessons are in `MOTION_DOCK_STUDY.md` §2–3. The engineering lessons — the reason its tools *work* — are these:

| Lesson | Evidence | What it means for MOE |
|---|---|---|
| **Small footprint, named** | Springy leaves ONE effect "Springy – Overshoot" (Bounce, Settle, Speed); Clickety = one text animator + one effect; Odo = one effect + Source Text expression; the narrator removes "the animator and the effect" by hand | One tool = one named, inspectable native artifact. Remove is trivial; After Effects has fewer chances to disagree |
| **Surface native first** | Taper, caps, joins, dashes, miter are After Effects' own stroke properties, just un-buried | The lowest-risk, highest-value tools set properties that already exist — no rigs at all |
| **Create → Apply (idempotent)** | Odo's button says Create when no counter exists, Apply once one does | Re-applying updates the same artifact; never a second copy |
| **The tool is its preview** | Odo shows "$906" while hovering an ease; Clickety types in the tile; easing tooltips describe the curve | The same maths runs in the panel (preview) and in the expression (result) → one function, testable in Node AND sampled in After Effects |
| **One interaction grammar** | click = defaults · right-click = popover · Cmd = all/now · Cmd+Opt = stagger · fields: drag / double-click type / Opt-click reset · every tooltip says all of it | One grammar for every MOE module, printed in every tooltip |
| **Use After Effects' own catalogue** | Quick Apply lists effects (with category), menu commands and presets; target chosen by modifier (layer / new solid / new adjustment) | Search `app.effects`, menu commands and preset files instead of recreating them (verify each in After Effects first) |
| **Heavy work outside, write once** | Sploosh simulates in its own window, then Bake writes shape layers; Yoink makes a GIF without the Render Queue (*inference: frames, then encoded outside*) | Compute in the panel's Node, give After Effects one simple write |
| **Scan, then act** | Tidy / Project: Scan → counts (Unsorted, Empty folders, Unused) → act | Read first, show what will change, then one undoable write — also the safest pattern |
| **Roles instead of settings** | Sploosh: each layer is Ignore / Reference / Obstacle / Container / Fill / Drain | MOE's Cloner, Matte FX, Glass can ask "what is each layer?" instead of 20 options |
| **28 tools, each finished** | 28 in the picker; ≈14 shown, every one complete with tooltip, defaults that look good, two main controls, the rest behind right-click | Fewer, finished tools beat many unfinished ones |

## 3. How my thinking has changed (the eight rules of v2)
1. **After Effects is the only truth.** A tool is done only when an automated test *inside After Effects* checks its
   output (values sampled at several times, and a rendered frame), its Ctrl+Z, and its Remove. Green in the mock = not done.
2. **The mock is recorded, not imagined.** Probes run through the Claude Test Bridge and record After Effects' real
   answers (property trees, match names, ranges, when a property is hidden, the exact error messages) into a contract
   file. The mock is generated from that file. If the mock and After Effects disagree, the mock is wrong.
3. **Small, named footprint.** One tool → one named effect with controls, or native properties, or one tagged layer.
   No rigs wired by layer names. Re-apply updates; Remove deletes exactly the footprint.
4. **One maths, two places.** The pure function that draws the panel preview is the same text emitted into the
   expression; tests compare Node's value with After Effects' sampled value at N times.
5. **Depth before breadth.** Twelve tools proven in After Effects are worth more than a hundred unproven. A tool enters
   the dock only when it is green in After Effects.
6. **A loop measured in minutes.** The test computer pulls new code, deploys it in debug mode, reloads the panel, runs
   the tests and pushes the report back — no installer, no copy-paste between chats.
7. **One UI, the dock.** One way of working instead of four styles; each module owns its layout for its slot size.
8. **Prefer After Effects' own machinery** (its effects, presets, menu commands, Render Queue templates), probed first,
   over re-implementing it.

## 4. The v2 structure
```
L0  Host contract   contract/ae-26.5.json   ← recorded by `probe` through the bridge, never hand-written
L1  Host ops (ES3)  small primitives: read/set a property by match-name path, add effect (from contract),
                    set expression, keys, create/remove a TAGGED layer, read-back. Each op has an AE test.
L2  Tools           tools/<id>/ manifest.json  intent · target · operation · footprint · controls · modifiers · tooltip
                                math.js        pure; used by the preview AND emitted into the expression
                                apply.js       ops only (one undo group)
                                verify.js      reads back the footprint and checks it
                                remove.js      deletes exactly the footprint
                                ae.test.js     scenario → apply → sample values → render 1 frame → Ctrl+Z → re-apply
                                               → Remove → census: nothing left behind
L3  Dock UI         one style · modules with sizes strip / card / full · layouts 1-2-3 · starters · picker ·
                    Use vs Edit · one interaction grammar
L4  AI (MOE's own)  plans only with L2 tools that are green in After Effects
```
**Kept from today (proven infrastructure):** Claude Test Bridge + MCP server, the executor / one-undo machinery
(`U.withUndo`, `tx`), logger + diagnostics, the tile runner (becomes the AE test runner), `previews.render`, the host
profile probe, frame grid, installer / updater / release pipeline.
**Frozen, not deleted:** the 100 current tools and four styles go behind a "Legacy" switch. Each one is either rebuilt
under the v2 rules (its proven maths carried over) or retired. Nothing disappears until its replacement is green.

## 5. Phases — each ends on a check, not on a date
| Phase | Work | Done when |
|---|---|---|
| **0 · Safety + loop** | Git remote (private GitHub); `npm run deploy:dev` (copy to the CEP folder, debug mode); `tools/ae-loop.js` on the test computer: pull → deploy → reload → run → push report to branch `ae-reports`; `probe` command → `contract/ae-26.5.json`; mock generated from it | A code change of mine reaches After Effects and its report comes back with **no human step** |
| **1 · Ops** | Rebuild L1 ops against the contract; AE tests for each | Every op green in After Effects |
| **2 · Wave 1 tools** | ≈12 tools under the full definition of done (below) | All 12 green in After Effects: output, frame, undo, re-apply, Remove |
| **3 · Dock** | The dock UI with wave 1 only; starters; grammar; tooltips | Owner approves from pictures, then from the panel |
| **4 · MOE's own** | Cloner / Grid, Reveal & Matte FX, Glass, Templates, Bake, AI — one by one, each simplified to a small footprint ("roles instead of settings") | Each green in After Effects before it is shown |

### Wave 1 (our own tools, chosen for risk ↓ value ↑)
| Seed | Tool | Footprint |
|---|---|---|
| Surface native | **Stroke** — caps, joins, miter, taper, dashes, trim presets | native shape properties only |
| Surface native | **Ease** — MOE's curve editor (already MOE's strongest) | keyframe ease only |
| Structural | **Anchor 3×3** (+ keyed / parented / masks) | anchor + position, compensated |
| Structural | **Align & Distribute** | position only |
| Structural | **Explode / Merge shapes** | new tagged layers / one layer |
| Behaviour | **Spring** — Overshoot · Bounce · Loop · Wiggle · Squash | one effect "MOE Spring" + one expression |
| Behaviour | **Counter** — format tokens, multiplier, eases | one effect "MOE Counter" + Source Text expression |
| Behaviour | **Type & Split** — typewriter, words / lines / letters | one animator + one effect |
| Time | **Stagger / Offset** by index, by position, by beat | keyframe times only |
| Colour | **Palette** — base colour + harmony, apply by role | colour properties only |
| Deliver | **Grab** — PNG / GIF / MP4 of the work area, tokens, clipboard | files only; nothing in the comp |
| Launcher | **Quick Apply** — effects, menu commands, presets; target by modifier | depends on the item; probed first |

*To verify before Spring / Counter / Type are designed:* whether one effect with several named controls can be made by
`applyPreset` of an `.ffx` that carries a pseudo-effect (no edit of After Effects' files), or must be built from
separate Expression Controls. The probe answers it in Phase 0; nothing is assumed.

### Definition of done (every tool, no exceptions)
1. Output sampled in After Effects at ≥ 3 times equals the Node maths (tolerance written in the test).
2. One frame rendered through `previews.render` and compared to the expected look (owner's eye for the first time).
3. One Ctrl+Z (a pressed one) returns the census to before.
4. Re-apply updates the footprint; it never makes a second copy.
5. Remove leaves nothing behind (census).
6. Zero / one / many / locked / 3D / parented / precomp selections handled or refused with a sentence.
7. Tooltip with click / right-click / modifier lines; defaults that look good.

## 6. What changes in how we work, starting now
- **Before any new code:** the repository gets a private remote, so the work is safe and the test computer can pull it.
- **I write tools in pairs with their After Effects test**, never a tool alone.
- **The test computer tests every push by itself**; I read its reports from the `ae-reports` branch.
- **The owner judges pictures and feel, not bugs**: rendered frames and the dock, not error lists.
- **No release zip until a wave is green**; development goes through the debug deploy.
- **0.99.5 is still worth one run:** its Tile Test tells which of today's tools already work — the input for what to
  port first in Phase 4.
