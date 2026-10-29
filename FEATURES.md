# Features (v0.18.0)

**Moving backgrounds** (v0.18.0): Backgrounds › Motion (Drift, Orbit, Swirl, Wave, Breathe, Wander) and Colours (Cycle, Swap, Hue, Pulse) — expressions on the gradient points and colours, seamless loops, live sliders MOE BG Loop / Amount / Colour, live preview in the Inspector.

**★ MOE layout** (v0.17.0, recommended): menus by object (lit for the selection) + your Quick Bar + four stable task tabs — Settings › Panel layout › MOE ★.

**Panel layouts** (v0.16.0): Settings › Panel layout — Current · **Hub** (screens + fixed Home + *For this* strip) · **Command Bar** (menus by object, highlighted for the selection + your bars) · **Workspace** (context bar + four stable task tabs + your bar). Every tool keeps one place; context areas only copy (docs/features/UI_LAYOUTS.md).

**Smart Home** (v0.15.0): the selection decides the focus card (keys → ease + keys + loops; layer → animate in/out + rigs + anchor/align; layers → cascade + arrange + link; text → text in; shapes → draw + arrange; nothing → create); stable zones Focus → Your tools → More → Recent; folds remembered per kind of selection; Layout: fixed for the old order.

**A curve for each segment** (v0.14.0): with 3+ keys, pick a segment in the strip or the overview and the graphs edit only it; All = one curve everywhere. **Tidier panel**: foldable kit blocks, grouped Toolbox, Quick Bar that fits one row with +N, *Utilities* instead of *Tools*.

**Ease graphs** (v0.13.0): Value + Speed together, both draggable and synced (hover shows the same moment on both); Alt + wheel fine-tune; Flip; presets are curve pictures only (+ saves without a name, removable with undo). **Align**: ↔ / ↕ rows, Space evenly with equal or fixed gaps, align to Selection · Key layer · Comp (Alt = comp, Shift = key).

**Delay = Cinema 4D** (v0.12.0): Even · Blend · Spring like C4D's MoGraph Delay effector, plus **Field (null)** — a null sets each layer's delay by distance (radius, falloff, invert; move it to sweep, scale it to grow).

**Free drag on the ease graph** (v0.11.1): press anywhere and drag, like Motion 4 — left = start (ease out), right = end (ease in), middle = both mirrored; sideways = influence, up / down = shape or speed; Shift fine, Ctrl snap; handles still grab directly.

**Delay** (v0.11.0): Cinema 4D MoGraph Delay for layers — Spring / Blend / Offset on a layer's own animation, or followers trailing the first selected layer, live sliders. **Speed graph**: real units (px/s, °/s, %/s), velocity fields (AE Keyframe Velocity), whole-animation overview, pass-through middle keys.

**Motion Kit** (v0.10.0 — on **Home** first: ease · anchor · align · pinned tools; all tools + curve library in the **Toolbox**, Ctrl 2; also *Window › Extensions › MOE Motion Kit*): ease graph that reads the selected keys and applies on release · preset chips (click; Shift in / Ctrl out) · Easy Ease / Linear / Hold / Copy / Paste · 3 × 3 anchor (Alt: place in comp) · align / distribute row · 18 one-click tools (Null, Parent, Excite, Jump, Orbit, Spin, Swing, Wiggle, Stare, Clone keys, Reverse, Stagger, Trim to keys, Separate, Trim path, Repeat, Vignette, Trash). Study and design: docs/features/MOTION_KIT.md.

Motion-4-style tools (v0.9.0): **Ease Curves** — drag a Bézier on the value graph (live speed graph), 32 curves, applied as exact speed + influence between selected keyframes, read from keys · **Anchor & Align** — anchor to 9 points without a jump, align / distribute to selection or comp, clone into ring / fan / row / grid · Quick Bar group *Align* · new pie slots.

Navigation (v0.8.0): Home + five workspaces (Animate · Design · Layout · Finish · Tools) with section tabs · Pie menu (hold Q or the right button; smart slices by selection or My pie; centre = repeat) · Home "For this selection".

Workflow (v0.7.0): sticky Apply bar in every library and Text · ▶ on every tile · tiles dimmed with the reason when the selection cannot run them · F4 / ↻ repeat last change · Ctrl K finds and applies presets (Enter) · grouped sidebar with hideable sections · Compositing as a tile library · banners shown in full once · compact tiles in narrow panels · Home puts Recent / Favorites first for returning users.

Install & updates: Windows Setup.exe (in place, no admin) + Settings › Updates — see INSTALL.md.

Interface: Studio (labelled sidebar, visual libraries + Inspector, Deliver board) — CHANGELOG 0.5.0. Premium content, Home, artwork and appearance — CHANGELOG 0.6.0.

Library content: 32 ease curves · 24 Anchor & Align tiles · 37 Animate tiles (incl. 8 ease presets) · 33 one-click expressions · 15 layouts · 7 glass looks · 8 zooms · 27 text presets · 1,899 icons · 22 native shapes · 32 palettes · your own presets ("Mine").

Legend: **Local** = no network. **AI** = uses Claude (optional). Host = verified in AE? (see TEST_REPORT.md)

| Workspace | Tool (id) | Type | What it does | Undo / recovery | Host verified |
|---|---|---|---|---|---|
| Motion Kit | Delay (`kit.delay`) | Local | C4D MoGraph Delay: Spring (overshoot + settle), Blend (smooth lag), Offset (time delay) on the layer's own Position / Rotation / Scale animation, or followers performing the first selected layer's motion, each later; `MOE Delay …` sliders (live). | undo + checkpoint (expressions + controls) | ⏳ |
| Motion Kit | Interpolation (`kit.interp`) | Local | Linear / Hold / Bezier on the selected keys, in, out or both sides. | undo + checkpoint (exact) | ⏳ |
| Motion Kit | Trim to Keys (`kit.trimToKeys`) | Local | Layer In / Out to its first / last keyframe. | undo + checkpoint | ⏳ |
| Motion Kit | Parent Chain (`kit.parent`) | Local | Parents the selection in a chain (selection order; reverse), no jump. | undo + checkpoint | ⏳ |
| Motion Kit | Stare (`kit.stare`) | Local | Rotation faces a target layer (`MOE Stare Target` Layer Control); last selected layer = target. | undo + checkpoint | ⏳ |
| Motion Kit | Vignette (`kit.vignette`) | Local | `MOE Vignette` black solid with a feathered subtract ellipse; amount / softness / size. | layer removed | ⏳ |
| Motion Kit | Trash Rigs (`kit.trash`) | Local | Removes MOE-tagged expressions and MOE effects from the selection; the user's own are kept. | Edit › Undo | ⏳ |
| Animate | Ease Curve (`motion.easeCurve`) | Local | Bézier value-graph editor with live speed graph; 32 curves (expo, back, circ, punch, glide…); exact temporal ease on every segment between selected keys (per dimension, or along the path for Position); hold sides kept; read from keys; copy as CSS. | undo + checkpoint (exact eases) | ⏳ |
| Motion Kit | Anchor Point (`transform.anchor`) | Local | 9 points of the content (or mask) box, no jump; every Position key and a keyed anchor shift; animated scale / rotation exact at the playhead; 3D-rotated / auto-oriented measured by a toWorld probe; Alt = place the layer at that point of the comp. | undo + checkpoint (exact) | ⏳ |
| Motion Kit | Align & Distribute (`transform.align`) | Local | Edges / centres to the selection or comp; distribute 3+ layers evenly by measured bounds; the whole animation moves; parented layers moved in the parent's space. | undo + checkpoint (exact) | ⏳ |
| Layout | Clone (`transform.clone`) | Local | Duplicate one layer into a ring (face out), fan / arc, row with rotation / scale / opacity steps, or grid (max 200). | copies deleted, source restored | ⏳ |
| Quick | Quick Bar (`quick.*`, 14 tools) | Local | Reveal (project / folder / pre-comp), Purge cache, Duplicate comp (deep), Flip H/V, Parent to Null, Pre-compose, Separate X/Y (keeps easing), Select Same Property, Reverse keys, Mirror/Clone keys, Quick Animate (slide 4 directions in/out, fade, scale, spin; overshoot; stagger), Trim Paths (draw/erase/travel/draw+erase), Typewriter, Number Counter. Bar in every section; right-click = options. | undo + checkpoint (Pre-compose, Separate: Edit › Undo) | ⏳ |
| Shapes & Icons | Insert Shape / Icon (`design.insertShape`) | Local | 1,899 Lucide icons as editable Bézier paths or 22 native parametric shapes; Line / Solid / Both / Duotone; Draw, Pop or Fade at the playhead; read-back of paths, stroke, fill, keys. | layer removed (undo + checkpoint) | ⏳ |
| Backgrounds | Background (`design.background`) | Local | Palette → linear / radial Gradient Ramp, 4-Colour mesh or flat `MOE Background` at the bottom; grain (Noise); slow drift expressions. | layer removed (undo + checkpoint) | ⏳ |
| Backgrounds | Colorize from Palette (`design.colorize`) | Local | Cycle / shuffle / blend palette colours over the selection (text, shapes, footage via MOE Palette Fill). | undo + checkpoint (exact) | ⏳ |
| Expressions | Quick Expression (`expressions.quick`) | Local | 33 one-click presets with icons, preview curves and explanations; natural target per preset; live Slider controls option; user expressions protected. | undo + checkpoint | ⏳ |
| Layout | Grid Builder (`grid.build`) | Local | 6 modes on one MOE Grid null with controls; order, honeycomb, twist, scale step, random, Build animation (styles × orders, stagger), Effector, auto spacing; live preview = same maths as the expressions. | undo + checkpoint (exact) | ⏳ |
| Layout | Grid Controls / Release Grid (`grid.update`, `grid.remove`) | Local | Live control changes; remove (layers return) or freeze (bake). | undo + checkpoint | ⏳ |
| Layout | Layout Guides / Place in Cells (`grid.guides`, `grid.placeInCells`) | Local | Columns/rows/gutters/margins as comp guides; tile layers into cells keeping keyframes. | undo + checkpoint | ⏳ |
| Layout | Resize & Adapt (`adapt.resize`) | Local (+ optional AI) | Fit/Fill/Keep/Smart re-frame to any size; keeps every keyframe; new comp by default; nested layout pre-comps; preview with overrides; measured read-back. | remove copy / exact in-place restore | ⏳ |
| Layout | Layout from Claude (`adapt.suggestLayout`, via Ask Claude) | AI | Claude places elements for the new format (no pixels sent); shown in the preview before Adapt. | no project change | ⏳ |
| Motion | Focus Zoom / Follow Zoom / Cursor Animator (`zoom.*`) | Local | ClickZoom-style zooms on a MOE Zoom rig (point or layer, in/hold/out, eases, pans, motion blur, spotlight); follow a layer; animated cursor with click pulse + ripple. | rig / keys / layers removed | ⏳ |
| Comp | Glass / Glass Look (`glass.*`) | Local | Liquid/frosted glass from native effects (matte, frost, lens, brightness, tint, rim, shadow), 7 looks, Brand tints. | created layers removed, source re-enabled | ⏳ |
| Comp | Green-Screen Prompt (`generate.greenPrompt`) | AI | Claude prompt for your generator; chroma-green rules enforced locally. Claude does not generate images. | no project change | ⏳ |
| Comp | Import & Key (`generate.importKey`) | Local | Import generated file at the playhead, fit, Screen Key chain. | imported layer + item removed | ⏳ |
| Motion | Smart Ease (`motion.smartEase`) | Local | Sets temporal ease influence (speed 0) on selected keys or all keys of selected properties. Presets Easy/Smooth/Strong/Snappy/Launch. Correct ease array size per value type; HOLD sides preserved; sides set to Bezier. | 1 undo step + checkpoint restore | ⏳ |
| Motion | Stagger Layers (`motion.stagger`) | Local | Offsets selected layers' start times by N frames (any fps), order Top→Bottom / Bottom→Top / Selection / Random(seed); mode add-to-current or align. Locked layers skipped. | 1 undo step + checkpoint restore | ⏳ |
| Text | Animate Text (`text.animate`) | Local | 27 presets (owner's 4 + 23 new), live previews, In/Out, duration/distance/direction/based-on/timing; `MOE In`/`MOE Out` animators; Arabic-safe auto switch. Imported `.ffx` applied via `applyPreset`. | 1 undo step + checkpoint (animator removed) | ⏳ |
| Text | Remove Text Animation (`text.removeAnimation`) | Local | Removes MOE In/Out animators. | Undo | ⏳ |
| Brand | Apply Brand Colour (`brand.applyColor`) | Local | Selected colour props → text fill/stroke → shape fill/stroke → MOE Brand Fill on footage/solids. | 1 undo step + checkpoint | ⏳ |
| Brand | Apply Brand Font (`brand.applyFont`) | Local | Arabic/English/auto by script; RTL + universal composer for Arabic; keyframed Source Text set at CTI. | 1 undo step + checkpoint | ⏳ |
| Brand | Extract Palette (`brand.extractPalette`) | Local | k-means palette from the selected layer's pixels. | No net change | ⏳ |
| Motion | Proximity (`proximity.apply`) | Local | Effector null + controls; 15 reactions; one combined expression per property. | Undo + checkpoint (effector/effects/expressions) | ⏳ |
| Motion | Remove Proximity / Center Anchor | Local | Tagged expressions + MOE Prox effects removed; anchor centred without visual jump. | Undo (+ checkpoint) | ⏳ |
| Select | Select view + `select.layers` | Local | Moe Selector v5 features in the panel; AI-callable selection. | Selection history (AE does not undo selections) | ⏳ |
| Comp | Analyze Shot (`compositing.analyze`) | Local | Measures mean colour, luminance, black/white points, cast, saturation, clipping, screen colour; swatch grid; one-click "Grade with auto balance" / "Key screen". Keyed layers are measured after the key. | Net no change (temporary probe layer, one undo entry) | ⏳ |
| Comp | Grade (`compositing.grade`) | Local | Exposure, contrast, saturation, temperature, tint, auto balance, auto levels → one Channel Mixer **MOE Grade** (created or updated in place). Presets Neutral/Warm/Cool/Punchy/Muted/Bleach. | 1 undo step + checkpoint | ⏳ |
| Comp | Look from Words (`compositing.lookAssist`) | AI + local analysis | Describe a look → Claude proposes Grade settings from measured stats → "Use in Grade" fills the form. Never writes. | — | n/a |
| Comp | Match Color (`compositing.matchColor`) | Local | Per-channel mean/σ transfer from a reference layer (plate or still) at the current frame → **MOE Match** (placed before MOE Grade). Refuses unkeyed screens. | 1 undo step + checkpoint | ⏳ |
| Comp | Screen Key (`compositing.keySetup`) | Local | Keylight with sampled screen colour (auto/green/blue), optional Key Cleaner, Advanced Spill Suppressor, Simple Choker, placed before colour effects. Blocks when a user keyer exists. | 1 undo step + checkpoint | ⏳ |
| Expressions | Apply Expression (`expressions.apply`) | Local | Sets the editor code on all selected expression-capable properties; reverts if AE reports an error. | 1 undo step + checkpoint | ⏳ |
| Expressions | Validate in AE (`expressions.validate`) | Local | Applies to the selected property, reads `expressionError`, restores original. | Net no change (leaves one undo entry) | ⏳ |
| Expressions | Inspect Expressions (`expressions.inspect`) | Local, read-only | Lists expressions + engine errors in the selection. | — | ⏳ |
| Expressions | Remove Expressions (`expressions.remove`) | Local | Clears expressions on selected properties. | 1 undo step + checkpoint | ⏳ |
| Expressions | Expression Assistant (`expressions.assist`) | AI | Generate / Fix / Explain / Optimize for the selected property; shows explanation, notes, required controls and a line diff. Never writes. | — | n/a |
| Expressions | Presets | Local | 6 built-in (Wiggle, Loop cycle, Ping-pong, Inertial bounce, Spin, Slider link) + user presets. | — | — |
| Tools | Tool Factory | AI → Local | Describe a utility → recipe from existing tools with parameters → review → save. | — | n/a |
| Tools | Saved tools (recipes) | Local | Run with parameters, Dry run against selection, delete. | Each step checkpointed | ⏳ |
| Everywhere | Copilot | AI → Local | Natural language → typed plan of registered tools → validation → approval → execution with verification → rollback / save as tool. | Per-step checkpoints | ⏳ |
| Everywhere | Command search | Local | Ctrl+K or `/`: tools, saved tools, commands, navigation. | — | — |
| Everywhere | Favorites, per-tool presets | Local | Pin tools; save/delete parameter presets (right-click to delete). | — | — |
| History | History | Local | Every run with status, origin (you / Copilot / recipe), restore button. | — | — |
| Settings | Settings | Local | API key (DPAPI), model, effort, monthly budget, per-scope permissions (incl. Change effects), read limits, layout density; link to Diagnostics. | — | — |
| Diagnostics | Diagnostics | Local | AE version/build, host module, runtime, data folder, AI usage/cost, log, copyable report. | — | ⏳ |
