# Click VFX (v0.98)

From the study of the owner's Click VFX project file (docs/research/CLICK_VFX_STUDY.md): a professional click is a STACK — a growing ring, a distortion, a glow and a colour pass — not one effect. Rebuilt with native effects only: the third-party Deep Glow becomes After Effects' Glow, and Tritone becomes a Fill, so one Colour control recolours the whole stack.

## Styles (`features/interact/clickFxPlan.js`, pure)
| Style | Layers | Effects (in order) |
|---|---|---|
| Liquid Ripple | Ring (stroke 10 → thin) + Flash (soft disc) | Fill, Turbulent Displace (Amount 40, Size 20, Complexity 2 — the study's values), Gaussian Blur, Glow |
| Neon Ring | Ring + Ring 2 (0.1 s later) | Fill, Glow (strong) |
| Particle Burst | Disc | Fill, CC Ball Action (Grid Spacing 8, Scatter keyed 0 → 160), Glow |
| Pixel Ring | Ring (stroke 18) | Fill, Mosaic (48 × 27 blocks = 1920 / 40, the study's tile), Glow |

Rings grow from 0 to 100 % with the Expo ease, hold, then fade. The stroke thins as the ring grows.

## The tool `interact.clickFx`
- Where: the visual centre of the selected layer, measured by After Effects at the playhead (`layers.bounds`, the SaaS Interaction rule), or the comp's centre with nothing selected.
- ONE host call (one Ctrl+Z after the measuring step that changes nothing): `MOE Click N <part>` shape layers placed above the layer, their effects and keys, and the controller.
- **The controller null `MOE Click N Controls`** (owner, v0.98): only the look-and-feel values — Size %, Colour, Glow, plus Wobble (Ripple) or Pixel Blocks (Pixel). They are linked by `// MOE Click` expressions written through `expressions.set`, so the host adds the link ids. Change the style later without the panel and without a crowd of sliders.
- Restore removes every layer it made, in one step.
- Tiles: Product UI › Click FX (next to Click on Layer and Tap).

## Tests
- `tests/click.vfx.test.js`: every style is one real undo step; the controller holds only its own controls (≤ 4) and the Scale is linked to Size %; Restore is clean; the plan grows, fades, uses 48 × 27 blocks and scatters 0 → 160.
- Self-Test `clickFx` runs the four styles in After Effects. **Mosaic and CC Ball Action parameter names are unverified until it passes.**
