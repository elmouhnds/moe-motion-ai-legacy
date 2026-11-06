# MOE against the AE Panel Study's 12 rules

**Source:** the owner's study *After Effects panels: AppleFX Lite and SaaS Kit* (6 November 2026; AE 25.6.6, Windows 11). Both panels were run inside real After Effects, and the project was read back after every click.

This page maps each of the study's 12 "smart and simple" rules to MOE as the code stands at v0.60. Each status is checked in the code, never assumed.

| # | Rule (study §12) | MOE today | Status |
|---|---|---|---|
| 1 | Always show the selection | The context bar shows *N lyr · N prop · N keys* live | ✅ |
| 2 | Disable the main button when it cannot run, with the reason next to it | Apply is disabled by tile readiness (`library.readiness`), and the bar shows the reason **as text** next to it (`st-act-hint warn`). v0.61: the same locked-layer rule as the executor (`core/lockpolicy.js`). | ✅ |
| 3 | Preview before committing, cheap and replayable | Every tile plays the tool's own keys (Real Previews, v0.47); the Inspector preview plays live | ✅ |
| 4 | One apply = one Undo step, with nothing left behind | **v0.61:** one undo group per run, named after the tool (`tx.begin` / `tx.end`), closed even on failure; Restore is one step; the Self-Test proves it with one Edit › Undo | ✅ |
| 5 | No native AE alerts; errors inside the panel | Host ops return errors with `U.fail`, and nothing calls `alert()` | ✅ |
| 6 | Say what was made, where, and how to remove it | Verify lists every check; Restore / Trash remove it; every name is `MOE …` | ✅ |
| 7 | Anything over ~2 s shows progress and can be stopped | Spinner on the button, **no cancel**, no step count | ⚠️ |
| 8 | Native keyframes / animators where the user edits by hand; a controller only when live values are the point | Real keys for Animate, Shakes, Click; expressions with slider controllers for Grid, Effectors, Backgrounds | ✅ |
| 9 | Respect locked layers and warn before touching them | **v0.61:** one rule in the executor (`core/lockpolicy.js`); `tests/lockedmatrix.test.js` runs 318 tiles and tools on locked layers. It had found 5 tool families changing them; now 0. | ✅ |
| 10 | No imported assets or downloaded models without saying so | Nothing is imported or downloaded | ✅ |
| 11 | Generated keys sit on the comp's frame grid | **v0.61:** `keys.write` snaps every key with a merge rule; `tests/fpsmatrix.test.js` runs 318 cases at 24/25/30/60 fps (it found and fixed Zoom and Shake verifies) | ✅ |
| 12 | Usable at the minimum size; no tabs cut off without a sign | `audit-cut`: 132 screens, 0 cut names | ✅ |

Two further problems from the study (§10) also apply to MOE:

- **Links by layer name (§10 #1, high).** The Grid, Glass, Trail and other expressions find their null with `thisComp.layer("<name>")`. Renaming that null breaks every expression, exactly like SaaS Kit. **Fix:** link by layer index plus a stable id kept in the layer comment, and add a "Relink" step that rewrites the name inside the expressions when a rename is detected.
- **Timing that collides (§10 #11).** In-point offsets and expression delays must not both drive the same stagger. MOE staggers with keys only, so this does not apply ✅.

## v0.61 — Engine 2 (done: 1, 2, 4, 6; next: 3 and 5)

See docs/features/ENGINE2.md for what shipped. Still to do:

1. **One Ctrl+Z per run.** The executor opens one AE undo group for the whole run and closes it in `finally`, whatever happens; the host ops nest inside it.
   - **Self-Test:** a new check runs a tool, sends one *Edit › Undo*, and confirms the comp is back exactly as it was.
2. **Keys on the frame grid.** `keys.write` rounds every time to the comp's frame. Two keys that land on the same frame merge, keeping the first and last of each list. A tool can opt out (`subframe: true`).
   - **Tests:** every generated key time satisfies `t / frameDuration` = an integer, at 24, 25, 30 and 60 fps.
3. **Rename-safe links.** Controllers carry an id in their comment. After a rename, the panel finds them again and offers *Relink* in one click.
4. **Reason next to the button.** When a tool cannot run, the bar says why in plain words, not only in a tooltip.
5. **Progress + Stop** for runs over ~2 s (Grid on 60+ layers, Bake, Click with 12 targets).
6. **Locked layers, tool by tool:** an audit over every registered tool with a locked layer in the selection.
