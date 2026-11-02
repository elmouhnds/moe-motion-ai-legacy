# Spring / Inertia Effector (v0.35.0)

**What:** an effector's result can reach the clones through a damped spring. As the effector passes, the items overshoot and settle (Spring), or trail behind it and ease in (Inertia, Frequency 0). Nothing is baked: it is three live controls on the `MOE Effector N` null.

**Why:** MoGraph users expect this (Cinema 4D's Delay effector in Spring mode, mCloner's spring / inertia). It is the difference between items that snap to a value and items that feel like they have weight, with no keyframes on the items.

## Controls (on the effector null)
| Control | Default | Meaning |
|---|---|---|
| Spring | 0 % | 0 = off (the items take the effector's result at once). 100 = full spring. Up to 200 % exaggerates. |
| Frequency | 2.5 Hz | Bounces per second. **0 = Inertia**: a smooth lag with no overshoot. |
| Decay | 5 | How fast it settles (higher = shorter). Minimum 2, so the bounded window can always settle. |

Tiles in Layer › Arrange › **Effectors** (Layout library, Effectors mode): **Spring Grow** (scale +80, 3 Hz), **Jelly** (scale + rotate, 4 Hz, decay 3), **Inertia** (move up, Frequency 0), **Bounce Up** (linear falloff, the items jump as the edge passes).

## How it works (the maths)
- One effector's result on one item is a signal over time: the falloff weight × the moves, as five terms [dx, dy, scale, rotate, fade] (`effectors.termsAt`).
- With Spring on, each change of that signal reaches the item through the spring's step response:
  - Spring: S(τ) = 1 − e^(−d·τ) · (cos ωτ + d/ω · sin ωτ), with ω = 2π·Frequency and d = Decay;
  - Inertia: S(τ) = 1 − e^(−d·τ) · (1 + d·τ).
- The expression samples the signal back in time (`springTerms`) and adds the changes × S:
  - the window is 9.2 / Decay seconds, at most 3 s;
  - at most 60 samples, about one per frame (CLAUDE.md: bounded simulations).
- Spring % blends between the direct result and the sprung one.
- Read at each sample: the effector's transform, its Size, Softness and Strength, its moves, and the grid null's transform. So moving, scaling or fading the effector all ring through the spring.
- Read once, at the current time: the menus, Invert, Seed, Delay and the noise settings.
- The item's own place on the grid is the current one.
- `effectors.js` is the reference (`stepResponse`, `springWindow`, `termsAt`, `springTerms`, `applyAt`). `code()` writes the same maths into every item's expression.

## Compatibility
- Effectors made by v0.33 and v0.34 have no Spring control. The expression reads it in a `try`, so they behave exactly as before (tested by removing the controls).
- With Spring 0 the result is the v0.33 / v0.34 maths, unchanged.
- The colour tint (Colour Mix) follows the falloff directly; it is not sprung.

## Cost
- With Spring on, each item property evaluates the effector up to 61 times per frame instead of once.
- On big grids (hundreds of clones) preview gets slower. Lower the item count or use Spring only on the effector that needs it.
- With Spring 0 the cost is the same as before.

## Tests
`tests/spring.effector.test.js` (5):
- The step response settles; Spring overshoots and Inertia never does; the window is bounded for all decays and frame rates.
- Spring Grow on a sweep: mock-evaluated scale and position equal the reference at 7 times. The items grow past the direct result at the same moment, swing below the rest when the effector moves on, then settle.
- Inertia: matches the reference, trails the direct result, and eases back without passing it.
- Old effectors and Spring 0 are unchanged.
- The library tiles are in the Effectors mode with in-range settings.

**These are mock / preview results, not After Effects.** Inside AE, still to check: the speed on a big grid, and `fromComp(point, t)` / `toComp(point, t)` with the time argument on both expression engines (documented in the AE expression reference: Layer Space Transforms take an optional t).
