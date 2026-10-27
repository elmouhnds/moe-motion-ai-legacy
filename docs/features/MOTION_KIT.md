# Motion Kit (v0.10) — study and design

Why this exists: the product owner judged the v0.9 "Motion-4-style" tools not useful, not smart, badly placed and badly designed, and asked us to study the real tools first. This file is that study, the critique of v0.9, and the design that replaces it.

Sources were read through web search extracts (direct fetches of the vendors' sites were blocked in the build sandbox). Claims marked *(unverified)* could not be confirmed from a primary source.

## 1. What the reference tools actually do

### Motion 4 (Mt. Mograph, 2022–2024; successor: Motion Studio, 2025)
- **One panel, screens switched from a top bar**: Home · Easing · Toolbox · Color · Focus+ · Search · Settings. The panel **opens on Home**, which always shows *small versions* of the most-used tools — **Ease Graph, Anchor, Ease Sliders** — plus pinned favourite tools. (motion.mtmograph.com/m-screens/home)
- **Three depths**: mini-tools on Home (one click) → Toolbox tools (one click; an options overlay appears only if "Tool Preferences" is on, otherwise the saved defaults run) → "Workflows" (Timeline, Anchor+, Composition) that stay open.
- **Anchor**: select layers, **click a dot** — the anchor moves, the layer does not. No confirm step. **Opt/Alt-click the centre dot also centres the layer in the comp.** Anchor+ adds Include Masks, Rotation Lock, To First / To Last / Average / Center. Vendor says it is safe with keyframes, parenting and expressions.
- **Ease**: compact graph — drag left = ease in, right = ease out, centre zone = both; synced with **Ease Sliders** (in/out influence, centre slider mirrors) and buttons **Hold · Ease In · Ease Out · Auto-Bezier · Linear**. The sliders **show the selected keys' current values** (Live Poll). v4.3 Easing screen: Influence pills (click the middle pill = apply), Speed sliders, Speed / Value / Cubic graphs (commit on mouse release; Shift-drag = speed 0, Cmd-drag = mirror), **Library: clicking a preset applies it instantly**, "+" saves, JSON import/export; **Copy / Paste ease** (influence, speed, both, or cubic-normalised).
- **Toolbox** (32 tools in M⁴): Animo, Blend, Break, Burst, Clone, Cloth, Delay, Dynamics, Echo, **Excite**, Falloff, Flip, Grab, **Jump**, **Null**, **Orbit**, **Parent**, Pin+, Shapes, Rename, Reverse, Sort, **Spin**, **Stare**, Text-Break, Texture, Trace, **Trash**, Trim, Vector, **Vignette**, Warp; later Stagger, **Trim to Keys**, **Separate Position**.
  Most motion tools build an **expression + Effect Controls rig** per selected property (e.g. Excite: Enable, Overshoot, Bounce, Friction); **Trash** removes a tool's effects together with their expressions. Modifier variants: Clone Opt-click = reverse; Parent Opt-click = reverse order.
- **Align / Distribute** arrived only in Motion Studio: one click on a target, **moves the whole keyframed animation** (AE's Align panel writes a new key at the playhead), Selection or Composition, manual spacing.
- Praise: one-click centre anchor, one-click null, Excite / Orbit / Jump, ease sliders. Complaints are about licensing, not UX.

### Flow (Zack Lovatt & renderTom)
- Graph editor + library in one panel; either can be hidden. Normalised cubic-Bézier (CSS model); overshoot by dragging a handle outside 0–1 (graph grows to show it).
- **Apply button by default, but "auto-apply" (every edit goes straight to the selected keys) is what pros turn on.** Clicking a library preset applies it (with auto-apply); **Shift / Alt / Ctrl-click = Ease In / In-Out / Ease Out**; Shift+Ctrl = inverted.
- **Read** sets the graph from the selected keys and highlights the matching preset.
- Handle modifiers: Shift snap, Ctrl lock length, Alt lock angle, Ctrl+Shift symmetric.
- Presets → KBar buttons; libraries import / export; copy as `cubic-bezier()`.
- Limits: one curve per segment (no multi-bounce — that is why people also own Ease and Wizz).

### Others
- **Motion Tools Pro**: user-built panels of buttons; 9-dot anchor grid; distribute (grid / radial / spiral…); ease manager.
- **Move Anchor Point 4**, **Duik Move Anchor Points**: grid, per layer *or* selection bounds, comp coordinates, include masks, margin; works on animated layers.
- **AE native**: F9 Easy Ease (Shift+F9 in, Ctrl+Shift+F9 out); Pan Behind and *Center Anchor Point in Layer Content* compensate the current frame only (other position keys drift); AE 25.x "Quick Set Anchor" is a 2D 9-point picker. **A custom tool must beat these**: keyframe-safe, parent-safe, 3D, many layers, one click.

## 2. Principles we take from this
1. **Zero apply step.** A click on a dot, preset or tool acts on the selection. Dragging a curve commits on mouse release as one undo step.
2. **Always visible, tiny.** Ease + Anchor + Align live on one compact screen (and in a dockable slim panel). No banners, no thumbnails-as-buttons.
3. **Reads the selection.** The graph and sliders show the selected keys' real ease; the matching preset lights up.
4. **Modifiers instead of more buttons.** Shift / Ctrl on presets = In / Out only; Alt on an anchor dot = also place the layer there in the comp; Alt on Parent = reverse order; Alt on Clone keys = mirror. Right-click any tool = its options.
5. **Never break animation.** Anchor and Align shift every Position key; handle scale, rotation (2D and 3D), parenting, separated dimensions; masks optional.
6. **Handle, don't refuse.** If something can only be exact at the playhead (animated scale / rotation under an anchor move), do it there and say so — don't block.
7. **Rigs are removable.** Expression tools add named `MOE …` controls; *Trash* removes MOE rigs from the selection.

## 3. What was wrong with v0.9
| Problem | v0.9 | v0.10 |
|---|---|---|
| Placement | Anchor & Align was a tab inside Layout, under a banner | **Home** opens on Ease + Anchor + Align + pinned tools (Motion 4 Home); Toolbox (Ctrl 2) has every tool + pin list; a separately dockable panel |
| Look | 9 large tiles "Anchor Top left…", 9 align tiles, 32 curve tiles | one 3×3 dot grid, one icon row, a 120 px graph, preset chips |
| Steps | select tile → Apply | one click |
| Ease | editor hidden in the Inspector; presets did not apply on click; no in/out only; did not read the keys by itself | auto-read on selection, apply on release, click-to-apply presets with modifiers, Easy Ease / Linear / Hold, copy / paste |
| Function | anchor refused keyed scale / rotation and 3D-rotated layers; align skipped parented layers | handled (see §4) |

## 4. Design
Placement (owner's direction after the first build: "the anchor and the graph control belong on Home, at the start"): **Home** = blocks 1–3 + the pinned tools (wide: Ease left, Anchor / Align / Pinned right — all above the fold); **Toolbox** = every tool, *Pin to Home*, the curve library; **dockable panel** = blocks 1–4.

**Motion Kit blocks** (`app/ui/views/kit.js`), every block one click:
1. **Ease** — mini value graph (handles drag; commit on release when *Auto* is on, otherwise the ✓ button), Out / In influence sliders with a link toggle, readout `cubic-bezier(…)`; buttons Easy Ease · Linear · Hold · Copy · Paste; preset chips (click = apply; Shift = In only, Ctrl = Out only); "All" opens the full curve library, "+" saves the current curve.
2. **Anchor** — 3×3 dots. Click = anchor there on every selected layer, no visual jump, all keys kept. Alt-click = also move the layer so that point sits on the same point of the comp. Toggle: *Masks* (use mask bounds).
3. **Align** — left · centre · right · top · middle · bottom · distribute H · distribute V; target toggle *Selection / Comp*. Moves the whole animation.
4. **Tools** — Null · Parent · Excite · Jump · Orbit · Spin · Swing · Wiggle · Stare · Clone keys · Reverse keys · Stagger · Trim to keys · Separate · Trim paths · Vignette · Trash. Click = run with saved defaults; right-click = options; dimmed with the reason when the selection cannot run it.

**Dockable panel**: a second CEP extension in the same bundle (*Window › Extensions › MOE Motion Kit*) that shows only the kit. It keeps its own settings file (`kit-*` documents) so the two panels never overwrite each other; history is shared (append-only).
