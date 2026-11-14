# Study: "Click VFX" project file (MahdiEdits) — 2026-11-14

Source: the project file the owner linked (Google Drive, "Click VFX [Project File].zip", 8.9 MB), from the description of "The Best Click Visual Effects Used in SaaS Videos". The file was read as DATA only: the .aep's RIFX chunks were parsed (comp / layer names, effect match names, `cdat` static values, expression text). After Effects was not run, nothing in it was executed, and none of its files or images are bundled with MOE (the backgrounds carry the author's watermark).

## What is in the zip
- `Untitled Project.aep` (+ 5 auto-saves), 4 backgrounds (1672 × 941: soft hills and clouds in blue / gold / pink / red, one with a SaaS dashboard on top), a hand cursor PNG, 3 line icons (attach, tools, mic).
- Comps: `Click 1`, `Click 2`, `Click 3` (18 layers each — the same UI scene, a different click effect), `ClickEffect` (the matte), `Pre-comp 2–4` (glass distortion), `Comp 1–2`.

## The three effects (as built)
| Comp | Effect stack on the click layer | Reading |
|---|---|---|
| Click 1 — liquid ripple | `Shape Layer 40`: **Turbulent Displace** (Size 20, Complexity 2, large Amount) + **Gaussian Blur** (~103) + **Deep Glow** (`PEDG2`, third-party). `Shape Layer 2 / 36`: **Box Blur** 15 + **Tint** (white) + **Displacement Map** (max displacement 5 / 5). A blurred layer with **CC Light Sweep**. The UI card: `TFM LiquidGlass` (third-party) + **Lumetri**. `CC RepeTile` on top. | A soft, wobbly glow ring at the click; the shapes around it refract the background (Displacement Map from a blurred, tinted copy); a light sweep crosses the glass |
| Click 2 — neon ring | **Tritone** (midtones magenta 255 / 78 / 193) + **Deep Glow** | The same ring coloured magenta and glowing |
| Click 3 — particle burst | `Shape Layer 40`: **Turbulent Displace** + **CC Ball Action** (ball size ~8) | The ring breaks into dots / particles |
| ClickEffect (matte) | A solid with **Fractal Noise**: Noise Type **Block** (1), Fractal Type 11, Brightness −35, **Evolution = `time*250`** (expression); plus a blurred shape | The pixelated / blocky reveal: block noise boiling fast, used as a matte |
| Pre-comp 2–4 | **Lumetri** + **Displacement Map** + **Gaussian Blur** on a shape | Glass refraction layers |

## Lessons for MOE
1. **Pro click = a stack, not one effect**: a glowing ring (blur + glow), a distortion of what is under it (Displacement / Turbulent Displace), a light sweep, then a colour pass. MOE's Click on Layer only presses and draws a ring — it needs these layers.
2. **Block Fractal Noise with a fast evolution expression** is the pixel-reveal matte. MOE's Matte FX uses Soft noise; a "Block" look needs Noise Type = Block — a native menu (index 1 in this project). Use it only after the Self-Test confirms the index in After Effects.
3. **Third-party plugins** in the original (Deep Glow, TFM LiquidGlass) must be replaced natively: Deep Glow ≈ stacked Glow passes / Gaussian Blur copies blended Add (MOE `Glow`); Liquid Glass ≈ MOE Thick Glass (CC Glass + Displacement).
4. **Expressions for motion that never stops** (`time*250` on Evolution) instead of keys — MOE's Matte FX keys Evolution over the reveal only; an option "keeps boiling" (expression `// MOE FX`) fits the click look.
5. Backgrounds: bright, soft, saturated landscapes under frosted UI — the "SaaS premium" look. MOE's Backgrounds are gradients; a photo slot is out of scope (licensing), but the colour palettes (sky blue, warm gold, pink, red) can become palettes.

## Not read
Keyframe values (they sit in `list` / `ldat` chunks, not decoded here), shape sizes, track-matte connections between layers. Watching the tutorial video itself would show the timing; YouTube is not reachable from this environment (its bot check), so the owner can upload the video.
