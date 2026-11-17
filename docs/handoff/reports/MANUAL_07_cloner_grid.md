# Manual test — Group 7: Cloner / Grid + Effectors

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Code | `features/grid`, `features/proximity` |

**This is the biggest thing found in the whole session: the entire Cloner / Grid / Effector family did not run at
all in After Effects 26.5. It runs now, and its output matches MOE's own maths exactly.**

## What was wrong

The Self-Test against real After Effects (not the mock) came back **14 pass · 17 fail**, and **sixteen of the
seventeen were one error**:

```
grid.build: failed — null is not an object (step 2 of 6: effects.ensure)
```

grid · cloner · effector · spring · wave · falloffCurve · target · noise · image · colours · points · text ·
textArabic · bake · speed · relink — all of Layout & Grid, every Effector, and the Text / Object Cloner with them.

### Finding it
`tx.run` reported only the message, so the failure could not be placed anywhere. It now adds the engine's own
line — `CLAUDE.md` is explicit that a failure must never hide the real error — and the next run said:

```
null is not an object [compositing.jsx line 255] (step 2 of 9: effects.ensure)
```

Line 255 is `entry.index = fx.propertyIndex`, immediately after the effect is looked up again **by its MOE name**.
So the effect could no longer be found by name.

### The cause
`Property.setPropertyParameters` — the call that gives a Dropdown Menu Control its list — invalidates the
references into that effect, **and on After Effects 26.5.3 the way back through `parentProperty` is gone as well**.
The v0.99.1 code reached the effect through `res.r.prop.parentProperty` to give it its MOE name back. That
returned nothing, so the effect kept After Effects' own name `Dropdown Menu Control`, and everything that looks a
control up by name — this line, `effects.setMenu`, and the item expressions that read controls by name — found
nothing.

### The fix
- `compositing.jsx effects.ensure` and `fx.jsx effects.setMenu` remember **where** the effect is before setting the
  list (a `propertyIndex` does not move when a menu list is set) and find it again by index when `parentProperty`
  gives nothing. A lookup that still fails now fails as `EFFECT_LOST` naming the effect, instead of throwing
  "null is not an object".
- `host/lib/util.jsx U.dropSource` returns the **name** it removed instead of `true` — reading `src.name` after
  `src.remove()` threw `Object is invalid` and killed every grid restore. That one was **my own regression** from
  the Group 2 commit, caught here.
- `tests/mock/ae-mock.js` now behaves like After Effects: `setPropertyParameters` invalidates every reference into
  the effect (a stale one throws `null is not an object` until it is fetched again through the effect) and drops
  `parentProperty`. With the host fix reverted and this mock in place, **six** grid / clone-colour / bake tests go
  red — so the mock really catches it now.

## Proved in After Effects

The Self-Test's checks compare what **After Effects itself computed** with MOE's pure maths:

```
PASS grid     — 9 positions, worst 0 px from layouts.js · undo ok
PASS effector — 36 values at 4 times, worst 0 % from effectors.js · 9 items read in 17 ms · undo ok
PASS spring   — 36 values at 4 times, worst 0 % from effectors.js · 9 items read in 61 ms · undo ok
PASS colours  — 9 Fill colours, worst 0 / 255 from the palette · undo ok
```

Exact agreement — not "close", zero difference — on positions, effector values, the spring response and the
per-clone palette colours.

The `layout/cloneGrid` tile also builds for real now: it made the grid null and 24 `MOE Clone n · ST Card` layers
where before it threw at step 2 of 9.

## The whole Self-Test, before and after

| | Before | After |
|---|---|---|
| Self-Test in After Effects 26.5.3 | **14 pass · 17 fail** (333 s) | **26 pass · 4 fail** (510 s) |

The four that still fail are now *reachable* for the first time — before the fix they never got past `grid.build`:

```
FAIL text       — 3 words; their outline vs the title: worst edge 340.01 px (3 allowed),
                  overlap 234.7 px · undo brought the title back
FAIL textArabic — 2 words; worst edge 216.41 px (3 allowed), overlap 262.46 px
FAIL bake       — 36 properties baked (138 keys, 18 plain values) · 135 values at 5 frames,
                  worst 0 from the live rig · restore differs by 770 · undo ok
FAIL exploder   — text.animate: failed — ST Explode: animator read-back mismatch
```

Read them as three fresh findings for the owner, not as leftovers of the old bug:

1. **Text / Object Cloner places split words far from where their words were.** `docs/features/OBJECT_TEXT_CLONER.md`
   says In Place "must not move anything — its read-back compares comp boxes, not values", and the check allows
   3 px. It is out by **340 px** in English and **216 px** in Arabic, with the words overlapping each other by
   230–260 px. The split itself runs and undo brings the title back; it is the *placement* that is wrong.
2. **Bake's restore is not exact.** The bake itself is perfect — "135 values at 5 frames, **worst 0** from the live
   rig" — but restoring afterwards leaves the rig differing by **770**. `docs/features/BAKE.md` requires Restore to
   be exact ("Save each property's expression **and its own keys** before clearing them, so Restore is exact").
3. **Exploder** — `ST Explode: animator read-back mismatch`. This one also failed before the fix, so it is the only
   survivor of the original seventeen.

None of the three is touched here: each needs its own measurement work, and two of them (the Cloner placement and
Bake restore) are the kind of maths the repo wants compared against a pure reference with a test, not patched by
eye.

## Still open in this group
`layout/cloneGrid` and `layout/efSpring` still fail the Tile Test's **undo** check
(`Ctrl+Z did not bring it back after 3 / 4`), the same check that Group 6's report questions — the Self-Test's own
`undo ok` for the very same tools says the restore is clean. Which of the two is measuring correctly is the
question raised in `MANUAL_06_design.md`, and it should be settled before either number is trusted.

`npm run check`: 643 pass, 0 fail, 1 skipped.
