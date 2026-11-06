# Reference study: SaaS Kit and AppleFX (2026-11-06)

**The owner:** *"Examine the two plugins from the sites and domains I sent, and see how we can make the tools in our plugin."*

## Sources

- **SaaS Kit** (solairmotion.gumroad.com): the product page, plus its public screenshots (public-files.gumroad.com).
- **AppleFX** (8bitbrain.store): the product page, plus the data of the demo panel it runs in the browser (`afx-panel-data.js`), which lists every tab, preset and control.

The owner allowed the three hosts. Only public marketing material was read: no product was downloaded, and no code is reused. Below, *have* means MOE already does it, with the tool named.

## AppleFX: 7 tabs, 73 presets

| Tab | Their presets | MOE today | How we build what's missing |
|---|---|---|---|
| **Easing** (9) | Apple Standard (0.4, 0, 0.2, 1) · Emphasized · Decelerated (entering) · Accelerated (exiting) · Spring Soft · Spring Bouncy · Snap (overshoot + settle) · Anticipate (wind-up) · Bouncy | Ease library: bezier curves per segment, Out Expo / Out Back…, Copy / Paste ease | **Apple curves set** in the Ease library: the bezier ones as named curves, and the springs / anticipate as 3-key plans (`bezier.js` + `animatePlan.keysFor` with a mid key, like the overshoot). Pure, and tested against the curve maths. |
| **Text** (24) | In / Out: Hero Reveal (scale + blur + opacity), Slide Up (per word), Slide (letter / word), Scale Bounce, Color Scale, Skew Color, Word Stagger (slide + blur), Letter Stagger, Word Bounce, Burst, Typewriter, Bounce Up, Bounce Rotate, Soft Bounce, Iris, Number Counter, Elastic In, Scramble. Ambient loops: Drift, Hover, Wiggle Letters, Breathe, Sway, Wave. Controls: Direction, Duration, **Blur**, Scale start | 27 Text presets (Soft Rise, Blur Focus, Char Fade, Random Fade, Type On, Tracking In…), Counter, Typewriter; Arabic-safe (words / lines) | **Blur** as a text animator property (blur in the same Range Selector); new presets: Hero Reveal, Word Stagger + blur, Burst, Iris, Elastic, Color Scale (animator Fill Color), Skew Color, Bounce / Rotate per letter. **Scramble** = a Source Text expression (tagged `// MOE Scramble`, bounded), Latin only (Arabic letters must not be split). Ambient loops: Wave / Sway / Breathe per character through expression selectors. |
| **Transitions** (12) | Pop In, Zoom, Whip Pan, Spin In, Blur (defocus), Iris (circular wipe), Stagger: Rise, Drop, Pop, Slide, Fade; **Carousel** (loop layers around a path) | Animate (45: Pop, Zoom Fade, Spin, Rise, Drop, Cascade…), Stagger | **Blur in / out** (Gaussian Blur keys, named `MOE Blur`), **Whip Pan** (position + directional blur), **Iris wipe** (an animated circular mask, `MOE Iris`); **Carousel** = the Grid Builder ring in 3D plus a stepping Y rotation on its null. |
| **Glass** (3) | Liquid Glass card, Colored Glass plate, Glass Object (any layer). Width, Height, Corner, Strength, Height, Frost Blur, Glow, Glow Color | **Thick Glass + 14 looks** (beyond theirs: real refraction map, prism, caustic) | **Glass card** (an insert with width / height / corner) as a Product UI piece; Glow on glass. |
| **Styles** (8) | Soft Shadow, Glow, Hairline, Inner Highlight, Light Sweep, Display (Apple title typography), Chrome, Liquid Color, Anamorphic Streak. Distance, Softness, Opacity | — (no Styles group) | **Styles** = native effects only, named `MOE Style • …`, updated in place, restorable: Drop Shadow (`ADBE Drop Shadow`), Glow (`ADBE Glo2`), Hairline (layer stroke via a shape / Stroke effect), Light Sweep (CC Light Sweep), Chrome (Gradient Ramp + CC Glass), Liquid Color (Fractal Noise + Colorama). Each parameter is resolved by name with the `expectParams` guard (project rule). |
| **Shakes** (5) | Bump, Zoom Punch, Whip, Slam, Jitter. Intensity, Rotation, Frequency, Settle | Wiggle family (expressions), Inertia | **Shakes** = keyframed impacts at the playhead from a pure plan: a damped oscillation (frequency, decay = Settle) sampled into keys, so they are real keys and editable (no expression). The preview plays the same keys (Real Previews rule). |
| **Expressions** (11) | Wiggle, Bounce, Bounce Out, Loop Out, Random Seed, Sine Wave, Hover Float, Throw, Breathe, Auto-Fade, Flicker | **33 expressions** (Wiggle ×6, Loops ×4, Inertia Bounce, Bounce Land, Float, Breathe, Flicker, Auto Fade, Pendulum…) | Have, except Sine Wave and Throw → add both. |

Also in AppleFX: **seven colorways and Light / Dark** (MOE has 8 accents × 3 themes), favourites (MOE has pins), and a code view for the expression. It is planning Backgrounds, Cursor animations and Shape Morphing (MOE has the first two).

## SaaS Kit: its panel sections

| Section | Their tools | MOE today | How we build what's missing |
|---|---|---|---|
| Text | Typing, Text Reveal (coloured), Exploder, Random letters | Type On, Typewriter, Random Fade | **Coloured reveal** (an animator with Fill Colour + offset), **Exploder** (Text Cloner splits words / letters → scatter keys; Latin only for letters). |
| Animate | **UI Stagger** (select layers → staggered reveal), Bounce | Stagger, Cascade In | **UI Reveal**: rise + fade + 96 % scale, ordered by **screen position** (top-left first, rows), in one click. |
| Transitions | Wipe Reveal, **Depth Reveal** | — | **Wipe Reveal** = a gradient-mask wipe (Linear Wipe + feather). **Depth Reveal** = a displacement on a depth map. Without a real depth map we use a luminance / radial one (a pre-comp map, like Thick Glass, read back). This is a later step. |
| Interaction | **3D Cursor** (lands on the selected layer, the button reacts with a scale), Proximity Hover | Cursor (on Position keys), Proximity rigs | **Click on Layer**: the cursor travels to each picked layer (comp-space centre measured by AE), clicks, and the target presses (scale 100 → 94 → 100 at the click). |
| Elements | Number Counter, **Carousel**, Glass | Counter, Thick Glass | **Carousel 3D** (above). |
| Rigging | Attach Layer | Parent & Link, Stare | — |
| Backgrounds | Gradients (30 SaaS backgrounds in the Studio tier) | 32 animated backgrounds | **Product backdrops**: the soft glow behind a UI card (purple / blue / teal) as a background set. |
| Bridge | **Figma → After Effects**, layer for layer | SVG → shapes | Large: a Figma import needs the Figma API (a token in the secret store) or exported SVGs / PNGs. This is its own milestone. |

**The look that sells both:** a clean UI card floating on a soft glowing gradient, Apple-like curves, blur in the entrances, and a cursor that clicks.

## The plan, in releases (each one a full MOE release: tests, previews, audits)

1. **Apple Motion** (next):
   - the Apple curves set in the Ease library (9);
   - a **Blur** control on entrances (Animate and Text: blur keys alongside the move);
   - text presets: Hero Reveal, Word Stagger + blur, Burst, Iris, Elastic, Color Scale;
   - transitions: Blur In / Out, Whip Pan.
2. **Styles + Shakes**:
   - a Styles group with Soft Shadow, Glow, Hairline, Inner Highlight, Light Sweep, Chrome and Liquid Color (native effects, named, restorable);
   - Shakes: Bump, Zoom Punch, Whip, Slam and Jitter, as real keys with Intensity / Rotation / Frequency / Settle.
3. **SaaS Interaction**: Click on Layer, UI Reveal (by screen position), Carousel 3D, product backdrops, Wipe Reveal. **Done:** Click on Layer, UI Reveal, product backdrops (v0.60), Wipe Reveal and Carousel 3D (v0.63).
4. **Later**: Depth Reveal, Scramble / Exploder text, Figma import. **Done in v0.64:** Depth Reveal (native, nothing downloaded), Decode / Scramble, Explode / Assemble (WAVE4.md). Figma import waits for the owner's decision on a Figma token and network access.

**What MOE keeps over both:**
- Arabic-safe text;
- the client's brand;
- read-back verification and exact Undo / Restore;
- Cloner / Effectors and Thick Glass;
- the AE Self-Test;
- previews that play the tool's real keys;
- no internet needed for any local tool.
