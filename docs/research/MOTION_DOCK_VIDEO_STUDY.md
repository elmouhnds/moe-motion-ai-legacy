# Motion Dock (free After Effects panel): Deep Study, Tool-by-Tool Anatomy and Seed Grammar

> Provided by the owner on 2026-11-15 (a study of the SternFX review video). Saved verbatim as the second source next
> to `MOTION_DOCK_STUDY.md` (the site, docs and demo videos). Analysis of both: `MOE_V2_RESTRUCTURE.md`.

Source video: "One FREE Panel Replaced 4 After Effects Extensions" by SternFX (https://www.youtube.com/watch?v=YkbxkUnhk6I), 17:52, published Oct 26, 2026. The video is a review and tour of Motion Dock 1.0.3, a free panel (no registration, no subscription) from the Motion Fun team (https://motionfun.net/motion-dock per the video description).
Per the working preference for this project, the reference is treated as a SEED: this report documents what the panel does and how it is organised, extracts the reusable structure, and derives a grammar from which many original tools can be built. It is not a plan to clone Motion Dock.

## 0. Method, evidence tags and limits
- Transcript: all 154 auto-caption segments were read (some words are garbled; corrected where the screen made the meaning clear).
- Frames (full pass, version 2 of this report): the whole video was sampled every 2 seconds in the browser (537 samples), consecutive frames were compared to find every moment where the screen changes (50 change runs), and each of those moments plus the earlier chapter frames was inspected by eye, about 65 screenshots in total. Talking-head stretches (intro 0:08-0:50 with a kinetic title overlay, 1:28-1:50, 8:04, a Dr. Evil meme cut around 10:30-10:43, and the outro from about 16:45 to 17:52) were also checked. The first version of this report missed several things that the full pass found: the Quick Apply command palette, the Dispatch tile, the Project scan tools, the Variants icon row, the palette toolbar, the taper values with a Remove arrowheads button, the Cursor Bar/Off option, the counter live preview with easing tooltips, and the Sploosh presets page.
- Tags: [SEEN] visible on screen, [SAID] stated by the narrator, [INFER] my engineering inference (not tested), [IDEA] my own design.
- Verified numerically in Node: counter formatting, counter value mapping, typewriter character count, damped overshoot behaviour, 3x3 anchor positions, file-name tokens. Nothing was run in After Effects and no Motion Dock code was examined.
- Not covered: pages 2 and 3 of the demo layouts beyond a glimpse (page 2 shows only Sploosh), the Keymaster / Slingshot / BPM tools beyond their tile art, the "Every Motion Dock Essential, Explained" video, anything the narrator skipped (28 tools exist, about 14 appeared on screen).

## 1. What Motion Dock is
- A docked After Effects panel (named "Motion Dock", with extra slots "Motion Dock 2 ... 5" visible in Window > Extensions) that hosts many small tools ("tiles") arranged by the user. Version 1.0.3 [SEEN]. 28 tools to pick from [SAID], plus "elements" such as dividers and images/text labels [SAID].
- Positioning: "an absurd number of tools for almost everything: animation, colour control, shapes, layers, organisation, delivery, even simulation" [SAID]; the narrator says it replaced about four other extensions in his workflow [SAID].
- Extensible: new tools keep arriving from the developer "or potentially from you" [SAID]; the narrator says the developer's AI panel Atom may soon build Motion Dock tools on the fly [SAID, transcript garbled].
- UI traits praised: responsive interface and tool tips on every tool (hover and read; they list modifiers and right-click options) [SAID].

## 2. Chronological breakdown of the video (what is shown, when)
| Time | Content |
|---|---|
| 0:00-0:45 | Intro: free panel with tools for animation, colour, shapes, layers, organisation, delivery, simulation |
| 0:44-1:43 | "What is Motion Dock": same developer family as the Atom AI panel; Atom now also in Premiere and faster |
| 1:43-3:31 | Setup: demo comp "Next Big Draw" (a black scribble "N" with sparks and the title text). Window > Extensions > Motion Dock; 5 additional panel slots; first launch offers STARTERS (Animator, Organizer, Designer, Essentials, Blank, Copy layout N); pages 1, 2, 3; a tool picker with 28 tools and search; settings (some per panel, some per tool); Edit layout to move tiles |
| 3:31-5:28 | Taper Lines: shape-layer stroke with Trim Paths; Shapes section; right-click on the Taper tile opens a popover; Start 30 / End 30 / Ease 20 typed by double-click; the narrator contrasts this with the native properties buried under Stroke > Taper |
| 5:28-6:08 | Split Shapes: Explode ungroups the sparks paths into separate shape layers; new layer colour; taper applied to all (up to 100 for spiky) |
| 6:08-7:30 | Overshoot: scale keyframes set 5 frames apart; Motion section (Overshoot, Bounce, Loop, Wiggle, Squash and stretch); right-click for settings or apply to all four layers at once; Quick offset with Cmd+Option (Ctrl+Alt) while applying |
| 7:30-8:17 | Change Anchor Point: 3x3 grid tool to re-anchor each shape for scale |
| 8:17-9:19 | Animate Lines (text): Words / Lines / Letters split, Split button; a null controls everything; hover for a preview tooltip; Cmd-click applies; Clickety (typewriter) preset |
| 9:19-10:45 | Counter Animation: duplicate text as "Prize"; remove the typewriter animator and effect; counter tile with "$" format; keyframe to 2,000; Multiplier 1,000 gives 2,000,000, then settled on $1 million |
| 10:45-13:01 | Dots Repeater: ellipse with 20 px stroke, no fill; right-click shape tile > Dotted; repeater 10 copies, position 0, scale 85, end opacity 0, offset animated to -5, blend Overlay |
| 13:01-13:27 | Petals: palette tool, extract colours from the comp or add colours obeying colour rules, click a petal to apply; all tied to one centre colour |
| 13:27-15:28 | GIF export: Deliver section, one click "Yoink" makes a GIF without the render queue; banding fixed by adding Noise (15-20) and a glow adjustment layer (threshold 90, very large radius) |
| 13:55-14:40 | Quick Apply palette (command launcher) and the Noise/Glow fix for banding, shown with Finder previews of the GIF grabs |
| 15:28-16:44 | More modules: Organization tools; Sploosh = a full simulation splash system in its own window with real-time physics, then Bake into shape layers with passes |
| 16:44-17:52 | Conclusion: new tools keep appearing; hover tool tips |

## 3. Panel anatomy (UI map)

### 3.1 Container and navigation [SEEN]
- Title bar "Motion Dock" with a version chip "1.0.3" (monospace), then page switches "1 | 2 | 3" (current page highlighted), a layout-grid icon and a settings gear. A tooltip names the current layout ("Layout 1").
- Three layout pages per panel instance; each page is an independent arrangement of tiles.
- First-run screen "CHOOSE A STARTER": cards with miniature tile-layout thumbnails (Animator orange accent, Organizer teal, Designer pink, Essentials gold) and buttons "Blank" and "Copy layout 1/2". The thumbnails preview the layout shape, which makes the choice self-explaining.
- Tool picker: a search field ("Search tools"), a close button, sections (ANIMATE, TEXT, ...), and a grid of tool cards. Each card has a MICRO-ILLUSTRATION of the tool UI and a name. Seen: BPM (a "Tap" button with beat subdivisions), Keymaster (keyframe nudge tiles), Slingshot (particle sling), Sploosh (fluid presets), Springy (overshoot panel), Clickety clack (typewriter), a counter tile (1,000). An info icon appears on hover.
- Edit layout lets the user move tiles; settings exist at panel level and at tool level.

### 3.2 Sections and colour language [SEEN]
Sections are separated by a coloured rule with a centred label: Motion (orange), Text (pink), Shapes (blue), Layers (teal), Deliver (green). The same accent colours are reused for the active state of tiles inside each section, so the user always knows which domain a tile belongs to.

### 3.3 Tile types observed [SEEN]
| Tile type | Example | Behaviour |
|---|---|---|
| Action tile | Explode, Merge, Split, Create/Apply | one click performs an operation on the selection |
| Mode toggle group | Butt/Round/Square caps; Miter/Round/Bevel joins | segmented buttons with live state |
| Preset row with sliders | Springy: five icon buttons (Overshoot, Bounce, Loop, Wiggle, Squash) + Bounce 50% and Settle 50% sliders | choose a behaviour, tune two values, apply |
| Rich input tile | Counter: big value readout "1,000", From 0 -> To 1000, format toggles (comma, $, %, .0, clock, K), easing icons, "123 Create/Apply" | mini form |
| Text tile | Clickety clack (cps 18, cursor toggles), "Spell bound" with Words / Lines / Letters + Split | live preview of the text effect inside the tile |
| Tap tile | "Tap in time" with 1/1, 1/2, 1/4, 1/8, Bar | tap to set tempo/time marks |
| Grid control | 3x3 anchor grid (centre filled) | click a node to move the anchor to that bounding-box point |
| Palette area | "No palette loaded", "Add a palette", five-six circular petals, a swatch strip | colour system tool |
| Variants strip | thumbnails of the comp in several aspect ratios, "Make 1 variant", Settings tab | output variants |
| Deliver | GIF/PNG/MP4 "Grab", dispatch/ProRes master, project organisation shortcuts | export |
Common visual language: dark UI, rounded corners, monospace numerals, accent colours per section, state shown by outline colour, "disabled until selection" tiles dimmed.


### 3.4 Details found only in the full-frame pass [SEEN]
- The narrator's extension list (Window > Extensions at 1:55): Aeviewer, Atom, BadFX, Copy Pasta (checked), Curves, Flow, Layout, Magic Bullet Colorista V, MoBar, Motion Dock, Motion Dock 2, 3, 4, 5, Motion Tools Pro Panel 1-4, Overlord 2 (checked), Physim. So Motion Dock coexists with a normal power-user set and is positioned to replace several of them.
- Top of the Layers area: a tree-preview box with the text "Select layers, then Group" (it previews the layer structure before grouping), a Draft toggle, and two rows of small icon buttons (including a lock, a target/crosshair, a half-filled circle and a speaker), each with a tiny status dot underneath.
- Colour tile footer: a toolbar of "+" , "-" , a share/export icon and "More" (expands), plus a swatch strip of four extracted colours (muted blue, dark blue, near-black, dusty pink), and a colour-wheel graphic made of overlapping red, blue, green and teal circles.
- Variants: icon row of five buttons (fit/expand, shrink, grid, crop, fullscreen) beside "Make 1 variant", then thumbnails of the comp in different aspect ratios (a tall one is highlighted), a "+" tile, and a share/export icon at the right of the tab header.

## 4. Tool-by-tool deep dive
Each entry: what is shown, controls, UX interactions, probable mechanism, the seed behind it, and siblings that can be derived.

### 4.1 Taper Lines (Shapes)
- Shown: select the "N" stroke (shape layer with Trim Paths, stroke width 80, line cap Round [SEEN]); the Shapes section lists caps (Butt, Round, Square), joins (Miter, Round, Bevel) and Start, End, Taper, Dash tiles. Tooltip: "Round caps - right-click for more" [SEEN]. Right-click on Taper opens a popover [SEEN]:
  - ARROWHEADS: Start row and End row of six glyph choices each; Size "4.0x" with a unit toggle "xw" (times stroke width) or "px".
  - TAPER: Start 41%, End 0%, Tip 0%, Ease 0% (each a draggable numeric field; tooltip "Start taper length - drag, double-click to type, Option-click resets"). Later in the video the same popover shows Start 30%, End 30%, Tip 20%, Ease 20% and a "Remove arrowheads" button; hovering the first Start glyph shows the tooltip "No start arrowhead".
  - JOINS: Miter limit 4.0.
  - DASHES: solid, dots, dots (spaced), dashes and "March" (animated marching ants).
- Result: the stroke tapers to a point at the start, giving a calligraphic brush look; the same tapers are then applied to the exploded spark paths with values up to 100% for spiky shapes [SAID].
- Narrator's point: AE already has these properties under Stroke > Taper (and caps, joins, dashes) but they are buried; the panel surfaces them in one place [SAID].
- Caps/joins state: at 3:43 the Shapes block shows Butt / Round / Square caps and Miter / Round / Bevel joins as two columns; the active choices are highlighted in blue (Round cap, Miter or Round join as changed by the narrator).
- Mechanism [INFER]: reads/writes native stroke properties (Line Cap, Line Join, Miter Limit, Dashes, Taper) on the selected shape layers; arrowheads and "March" are probably built from extra shape operators or expressions (not confirmed).
- Seed: "surface hidden native properties with a friendly control". Siblings: wave stroke control, gap/offset dash designer, round/chamfer corners, stroke order, trim path presets, fill/stroke swap, gradient stroke helpers, per-vertex width profile.

### 4.2 Explode / Merge (Shapes)
- Explode ungroups all paths in a shape layer into separate layers ("will ungroup all the different paths"); the original sparks layer is turned off; new layers get a yellow label for visibility [SEEN/SAID]. Merge is the opposite (combine selected shapes into one layer).
- Seed: structural batch operation on selection. Siblings: split by colour, split by fill/stroke, group by proximity, convert text to shapes layers, extract path to mask, merge with Merge Paths operators.

### 4.3 Motion section: Overshoot, Bounce, Loop, Wiggle, Squash and stretch
- Shown: a row of five icon buttons (Overshoot is highlighted), sliders Bounce 50% and Settle 50%, small Keymaster-like tiles with keyframe icons, a Springy tile (Overshoot / Bounce / Loop / Wiggle / Squash with Bounce, Settle, Speed). Right-click opens settings; the narrator applies overshoot to all four selected layers at once [SAID].
- Result on the layer: an effect named "Springy - Overshoot" with Bounce 50%, Settle 50%, Speed 2.5 appears in Effect Controls [SEEN]. So the behaviour is encoded as an effect with controls, and the user can tweak it after the fact.
- Quick offset: holding Cmd+Option (Ctrl+Alt) while applying offsets the effect/keyframes across the selected layers to create a stagger [SAID].
- Mechanism [INFER]: a pseudo-effect (expression controls) driving an expression on the keyed property. A standard technique is a damped sine after the last key: `value + velocity * amp * sin(t*freq*2*PI) / exp(t*decay)`; in a numeric check the offset is zero at the key, bounded by amp, settles to zero, grows with Bounce and decays faster with Settle.
- Seed: "behaviour as effect-with-controls". Siblings: bounce-out, elastic-in, wiggle with seed/frequency, loop (cycle/pingpong), squash and stretch on velocity, inertia, follow-through delay, jelly, shake, magnet snap.

### 4.4 Change Anchor Point (3x3 grid)
- A grid of nine dots with the centre active; clicking a node moves the anchor to that point of the layer's bounding box without moving the visible layer (the narrator re-anchors each spark so it scales from its base) [SAID]. Numeric check: node (row, col) maps to x + w*col/2, y + h*row/2.
- Seed: "visual picker for a numeric choice". Siblings: pivot to selection centre, pivot to cursor, pivot to keyframe path point, align/distribute 3x3, scale-from-origin presets.

### 4.5 Text tools: Split and Clickety (typewriter)
- Spell bound tile: Words | Lines | Letters, a Split button, and a null object created to control everything; hover shows a live preview tooltip; Cmd-click applies the animation right away [SAID/SEEN].
- Clickety clack tile: a typewriter preview with a blinking cursor, "18 cps" and a row of small toggle icons (their meanings were not readable; the Clickety effect later shows Cursor, Blink, Jitter and Delay controls). On the layer the effect "Clickety" exposes Speed 18.0, Pace (Chars per second), Jitter 0%, Cursor (dropdown with Bar and Off), Blink 1.00, Delay 0.00 [SEEN]; at 9:09 the cursor is set to Bar (a visible text bar after the characters) and at 9:49 to Off. The narrator later removes "the clickety text animator as well as the effect" to restart from scratch, which shows it is made of a text animator plus an effect [SAID].
- Mechanism [INFER]: a text animator with a Range Selector whose start/end is driven by an expression; visible characters = clamp(floor((t - delay) * cps), 0, length); jitter randomises character timing; cursor blink uses a character and a blink rate (numeric check passes for the character count).
- Seed: "text behaviour = animator + expression + effect controls". Siblings: scramble/decode, word-by-word fade, karaoke highlight, count-up characters, type with errors and backspace, glitch letters, per-line stagger, random case flip.

### 4.6 Counter (Odo)
- Tile fields: From 0, To 1000, format toggles (comma grouping, $, %, decimals ".0", clock, K), five easing icons (linear and four curves; hovering one shows a tooltip such as "Expo - almost all of it at once, then a long slide"), a live preview of the number inside the tile (for example "$906" while hovering), and "Create" (when no counter exists on the layer) which becomes "Apply" once one exists [SEEN]. After applying to the text layer, an effect "Odo" shows Value 1000.00 (keyframed), Multiplier 1, Decimals 0, Grouping "1,000", Decimal Mark "Point .", Style "Number", Sign (checkbox), Leading Zeros 0 [SEEN]. The narrator drags the second keyframe to 2 seconds, sets the value to 2,000, and uses Multiplier 1,000 for 2,000,000 [SAID]; on screen the value runs 0.00 at the start with Multiplier 1000, the text reads "$863,..." mid-animation and "$1,000,000" at the end [SEEN].
- Mechanism [INFER]: Source Text expression reading the effect values: number = value * multiplier, formatted by decimals, grouping and mark, optional prefix/suffix by style. A Node test confirmed formatting for "1,000", "$1,000,000", "1 234,50", negatives, "45%" and "2.5K".
- Seed: "format number as text from controls". Siblings: timer/clock, countdown, currency, percentage ring text, scoreboard roll, slot-machine digits, odometer with per-digit roll, rating stars from a value.

### 4.7 Dotted lines and Repeater (done by the narrator in AE)
- Ellipse (shift double-click for a circle), no fill, 20 px stroke, scaled down; colour sampled from the background; named "dots". Tile Shapes > Dash > Dotted (right-click) converts the stroke to dots. Then Repeater: Copies 10, Offset animated from the start to -5, Composite Below, Transform: Position 0, Scale 85, Start Opacity 100, End Opacity 0; blend mode Overlay [SEEN/SAID]. Banding is later fixed with Noise (15-20) and a Glow adjustment layer (Threshold 90, very large radius) [SAID].
- Seed: "stroke dashes + Repeater = concentric animated texture". Siblings: radar rings, equalizer rings, dotted spirals, orbit paths, loading circles.

### 4.8 Petals (colour system)
- A circular palette widget with five-six round swatches ("petals") around a centre; options: "Add a palette", load a palette file, extract colours from the composition, add colours that obey colour rules; click a petal to apply it to the selection; "everything is tied to one centre point" (a base colour that drives the others) [SAID/SEEN].
- Seed: "colour harmony generator bound to a base colour". Siblings: harmony modes (complementary, triad, analogous), brand palette lock, apply by role (background/accent/text), dark/light variants, contrast checker.

### 4.9 Variants
- A strip of thumbnails of the current comp ("Next Draw") in several aspect ratios, a "+" tile, a "Make 1 variant" button and a Settings tab [SEEN]; the narrator mentions variations for tall and square comps [SAID].
- Seed: "automatic multi-format output". Siblings: safe-zone checks, per-platform presets, auto re-layout rules.

### 4.10 Deliver: Yoink (GIF/PNG/MP4 grab)
- Layout of the Deliver block [SEEN]: two big tiles side by side. Left tile "Dispatch" (paper-plane icon) with a dropdown "ProRes master" (a render preset, with a settings icon) and a path line "Work render..._Draw_v01.mov". Right tile "Yoink" (green fist/hand icon, clipboard icon in the corner) with format chips PNG | GIF | MP4 and a settings icon; under it a grid of thumbnail slots that fills with every grab (two GIF thumbnails after two grabs). Tooltip on Yoink: "Yoink - GIF of the work area - Alt crops to selected layers - right-click for options". Grabs are saved in `yoinks/` next to the project; Finder shows "Next Draw_2026-10-26_13-39.gif" (3.6 MB) and a second grab at 13-40.
- Popover: Grab [PNG | GIF | MP4]; GIF settings: Size 100% / 75% / 50% / 25% / Max; Frame rate 15; Loop forever (on); Dither (off); Palette Global / Per frame; OUTPUT: Region padding 10; Copy to clipboard (on); Folder `{project folder}/yoinks`; File `{comp}_{date}_{time}`; token chips {comp} {##} {date} {time} {project} {w}x{h} {fps} {project folder}; a live path preview "yoinks/Next Draw_2026-10-26_13-38.gif"; hint "Alt-click Yoink crops to the selected layers"; tooltip "Size, frame rate, dither, folder and clipboard" [SEEN]. Other items: a "Dispatch" tile, "ProRes master", Work render folder, and project organisation shortcuts (Unsorted, Empty folders, Unused) [SEEN].
- It processes a GIF directly from the panel without the render queue [SAID].
- Seed: "one-click export with a token-based naming template and clipboard handoff". Siblings: PNG sequence, WebP/APNG, social sizes, thumbnail grab, review links, watermark, loop-point finder.

### 4.11 Sploosh (simulation)
- Opens in its own window ("Fizz Reaction" in the title) from a tile with presets: New, Pour and Catch, Dam Break, Honey Drizzle, Paint Marble, Portal Loop, Zero-G Blobs, Fizz Reaction, Stone Stairs, Glass Cascade, Blood Vessels [SEEN]. Window layout: top bar (Select, World, Layers (count), New, Undo/Redo, Bake), left tool palette grouped as Sources, Gesture, Props, Forces, canvas with real-time fluid, right panel "YOUR COMP'S LAYERS" where every layer can be Ignore, Reference, Obstacle, Container, Fill or Drain (plus "Follows its animation"), timeline strip with playback, time (0:01.56) and particle count (938 of 4,500) [SEEN]. Playing runs the simulation live; moving comp elements makes the simulation react in real time [SAID]. "Bake" turns the result into shape layers with passes so the look stays editable [SAID].
- Seed: "simulate in a sandbox, bake to native layers". Siblings: crowd, flocking, cloth-like strips, smoke, particles from paths, rope/chain, magnet fields, gravity wells, collision with text.

### 4.12 Organisation, Layers and other tiles
- Layers section (teal) has icon rows for layer ordering/alignment style actions and a small "1 | Aa" count/option pair; Organization tools (project folders, unused items) appear on page 2 of the Essentials layout [SEEN/SAID]. Time tools include scissors (split), trim in/out, "0" counters, and a Tap tile with subdivisions [SEEN]. Individual functions were not demonstrated.


### 4.13 Quick Apply (command palette) - missed in the first pass
- A floating window "Quick Apply" with a search field and a list of results [SEEN, about 14:10-14:40]. Typing "n" lists: None (Edit > Label > None), Noise (Noise & Grain), Newton (Text > Curves and Spins), Normal (Layer > Blending Mode > Normal), Numbers (Text), New Mask (Layer > Mask > New Mask), Noise HLS (Noise & Grain), New Folder (File > New > New Folder). Typing "glow" lists: Glow (Stylize), Dimension - glow+shadow (Image - Creative), VR Glow (Immersive Video), High-Low Pass (Audio), MIR 3 Rolling Low Poly Landscape 1080p (Red Giant Mir 3), Wiggly Stroke Width By Line (Text > Fill and Stroke), White (View > Panel Background Color > White), F11 (Replace "Custom View 1") (View > Assign Shortcut to "Active Camera ...").
- Each result shows an icon (fx for effects, a menu icon for commands, a preset icon for animation presets), the name, and the category path in grey. The highlighted row has a "Run" button; the footer shows "Run Command" and "Keyboard Shortcut: Unassigned" (so a result can be given a shortcut). For effects the highlighted row also offers "Apply as new Adjustment Layer", and the footer lists the modifiers: "Apply to New Solid" and "Apply to New Adjustment Layer: Cmd + Opt + Return".
- The narrator uses it to add a Noise effect (Amount of Noise 15%, Use Color Noise off, Clip Result Values on) to the background to fix GIF banding, then to add a glow adjustment layer [SAID/SEEN].
- Seed: "search everything (effects, menu commands, presets, scripts) and apply it with a modifier-chosen target". Siblings: recent/favourite items, fuzzy search, apply with a preset of settings, apply to selected vs new layer vs comp, chained commands, per-user shortcut assignment, scripts runner.
- Why it matters: it replaces browsing the Effects & Presets panel and the menus; the same ranking and category display could power an in-panel launcher.

### 4.14 Deliver pipeline: Dispatch and Project scan
- Dispatch (left Deliver tile): sends the comp to render with a named preset ("ProRes master") and shows the output path line [SEEN]; its settings icon opens preset options [INFER].
- Project block: a large round "Scan" button that analyses the project, followed by rows Unsorted, Empty folders and Unused, each with a count and action icons (organise, clean, select) [SEEN]. Intended for project housekeeping (sorting items into folders, removing empty folders, finding unused footage) [INFER].
- Seed: "scan then act" housekeeping tools. Siblings: duplicate footage finder, missing fonts/footage report, naming-convention fixer, collect-for-review, relink assistant, version stamper.

### 4.15 Sploosh page 2 and presets (full pass)
- The panel can be switched to page 2 which holds a single big tile "Sploosh - Next Draw" with a preset grid: New (a "+" tile with a notification badge), Pour & Catch, Dam Break, Honey Drizzle, Paint Marble, Portal Loop, Zero-G Blobs, Fizz Reaction, Stone Stairs, Glass Cascade, Blood Vessels, each with a small preview drawing [SEEN]. Clicking a preset opens the simulation window named after it ("Pour & Catch", "Honey Drizzle", "Fizz Reaction").
- Window contents seen: "Pour & Catch" - orange ramps and a candy-striped U-shaped container, a blue emitter dot in the upper left; "Honey Drizzle" - honey pouring onto a stack of pancakes; "Fizz Reaction" - green/purple liquid streams filling a glass. Left palette groups: SOURCES (four tools), GESTURE (two), PROPS (a dozen shapes such as ramps, cups, funnels, dots, cylinders, plus a "Jelly" material swatch), FORCES (four). Right panel: "YOUR COMP'S LAYERS" with the text "Give a layer a role and it appears on the stage for the liquid to hit, fill or drain through. Reference layers show without touching the liquid. The rest are ignored."; each layer card has Ignore / Reference / Obstacle / Container / Fill / Drain, a "Follows its animation" checkbox and a thumbnail; layers shown: Glow Adjustment (Obstacle), Prize (Ignore), Next Big Draw (Ignore), several Path layers (Ignore).
- The window top bar has Select, World, Layers (count), New, Undo/Redo and a blue Bake button; the bottom strip has transport controls, elapsed time (0:01.56), a timeline ribbon and a particle counter (938 of 4,500) [SEEN].
- Seed: role-based layer assignment for a simulation ("what is each layer to the physics?"). Siblings: any physics or flow field with the same Ignore/Reference/Obstacle/Container/Fill/Drain roles (crowds, smoke, cloth, particles).

## 5. Cross-cutting UX patterns (catalogued, each with evidence)
1. Tooltips that teach: every tile has a one-line tooltip with the right-click option and modifier keys (examples: "Round caps - right-click for more"; "Start taper length - drag, double-click to type, Option-click resets"; "Alt-click Yoink crops to the selected layers") [SEEN].
2. Right-click = options popover; left-click = apply with defaults; Cmd-click = apply now / apply to all; Cmd+Option = quick offset (stagger) [SAID/SEEN].
3. Numeric field conventions: drag to scrub, double-click to type, modifier-click to reset [SEEN].
4. Tools leave behind native AE data (effects with controls, text animators, repeaters, layers, keyframes) so users can keep tuning in AE without the panel [SEEN].
5. Selection-driven: tiles act on the current selection and dim or say "Select layers, then Group" when nothing fits [SEEN].
6. User-composed dock: starters, search, 28 tools, three pages, edit layout, copy layout, per-tool settings, so each user builds their own tool belt [SEEN/SAID].
7. Visual identity per domain: section colours reused for active states [SEEN].
8. Micro-illustrations on tool cards and live previews inside tiles instead of long descriptions [SEEN].
9. Defaults that look good (Bounce 50% / Settle 50%, GIF 15 fps loop) with one or two main sliders exposed and the rest behind right-click [SEEN].
10. Output ergonomics: naming tokens, live path preview, clipboard copy, undoable [SEEN].
11. Extensibility story: new modules arrive over time; AI-generated tools mentioned [SAID].
11b. Global launcher: Quick Apply searches effects, menu commands and presets in one list with category paths and modifier-chosen targets [SEEN].
11c. History strip: Yoink keeps thumbnails of past grabs so output can be reopened or dragged [SEEN].
12. Free and frictionless: no sign-in, no dark patterns [SAID].

## 6. Architecture inferred
- Panel technology [INFER]: HTML-style UI with custom controls (rounded cards, popovers, window-in-window for Sploosh, monospace numerals) is consistent with a CEP or UXP panel; extra panel slots (Motion Dock 2-5) suggest several registered panel instances sharing one tool library. The first screenshot of the Window > Extensions menu lists "Motion Dock", "Motion Dock 2", "3", "4", "5" and "Motion Tools Pro Panel 1-4" [SEEN].
- Tool = micro-app [INFER]: each tool has its own UI tile, settings, optional popover and optional standalone window (Sploosh), and an apply routine that creates native AE structures.
- Persistence [INFER]: layouts (3 pages, starters), per-tool settings and palettes are stored per user.
- Behaviour layer [INFER]: pseudo-effects (Springy, Clickety, Odo) hold the tunable parameters; the panel creates them and writes expressions.
- Simulation [INFER]: a separate real-time engine in its own window; "Bake" converts frames to shape layers (with passes) inside the comp.

## 7. Seed grammar: how a few seeds become hundreds of tools

### 7.1 Tool tile grammar [IDEA]
A tool = { intent, target (selection type), operation (create / modify / split / merge), result (native AE data), inline controls (1-3), popover controls (the rest), live feedback (preview in tile or tooltip), modifiers (alt/cmd/shift variants), persistence (settings), reversibility (one undo group, Remove) }.

### 7.2 Eight root seeds
| Seed | Pattern | Evidence in Motion Dock |
|---|---|---|
| P1 Surface native | put buried native properties into a clear control | taper, caps, joins, dashes |
| P2 Behaviour effect | pseudo-effect + expression gives a tunable behaviour | Springy, Clickety, Odo |
| P3 Structural batch | split / merge / regroup / re-anchor selections | Explode, Merge, anchor grid |
| P4 Time tools | tap tempo, offsets, trims | Tap in time, quick offset |
| P5 Colour system | palette tied to a base | Petals |
| P6 Output pipeline | one-click grab + templated naming | Yoink |
| P7 Sandbox then bake | simulate in a side window, bake to layers | Sploosh |
| P8 Dock builder | user assembles tools into layouts; global search launcher | starters, pages, edit layout, Quick Apply |

### 7.3 Combinatorics
Targets (shape, text, image, solid, precomp, camera/null, keyframes, comp) x operations (create, modify, split, merge, distribute, randomise, link, bake) x result types (effect-with-controls, animator, expression, keyframes, layers, markers, project items) gives hundreds of distinct tool slots; each seed above yields 10-20 siblings.

### 7.4 About 60 derived tool ideas (all [IDEA], none built)
P1 Surface native: wave stroke designer; dash pattern designer with preview; corner style (round/chamfer) per vertex; stroke width profile along a path; fill/stroke swap and sync; gradient stroke helper; trim-path presets (draw on, draw off, loop); shape modifiers stack manager (Zig Zag, Wiggle, Offset); mask feather/expansion quick panel; layer-style presets with sliders.
P2 Behaviour effect: bounce-out; elastic; inertia/follow-through; squash and stretch from velocity; loop (cycle, pingpong); wiggle with seed and frequency; shake; magnet snap; sine drift; countdown timer; clock; currency/percentage counter; digit roll odometer; scramble/decode text; typewriter with typos; karaoke highlight; per-letter wave; text reveal with blur; auto-fade at layer edges; random opacity flicker; heartbeat scale.
P3 Structural batch: explode / merge shapes; scan-then-clean project housekeeping; split text by words/lines/letters; split layer at markers; anchor grid; distribute along a path; align to key object; group by colour; ungroup compound; layer renamer with patterns; sort by position; duplicate with offset; auto-null parenting; "unused footage" cleaner.
P4 Time tools: tap tempo to markers; snap keyframes to beats; offset by index; reverse/stretch keyframes; trim to markers; ripple edit; hold frames; time remap helpers.
P5 Colour system: base-colour harmony; extract from image; role-based swatches; brand lock; contrast checker; recolour by mapping; gradient builder bound to the base colour.
P6 Output: PNG/GIF/MP4/WebP grab; social sizes; thumbnail picker; naming tokens; copy-to-clipboard; send to render queue with a preset; auto-versioning; review packages.
P7 Sandbox then bake: fluid splash; particles along paths; crowd; cloth strips; rope; magnet fields; collision with text; falling letters.
P8 Dock builder: global command launcher (Quick Apply style) with modifier targets; starters per role; shareable layout files; tool search; keyboard-driven command palette; tool usage hints.

## 8. Build blueprint (our own design, not a clone)
- Dock engine: JSON layout { pages:[{sections:[{name, accent, tiles:[toolId...]}]}] }, a tool registry { id, section, tileType, selectionRequirement, controls, apply(), preview(), tooltip, modifiers }.
- Tile library (reusable UI components): Action, SegmentedToggle, PresetRowWithSliders, NumericField (drag, double-click type, modifier-click reset), FormTile (counter), GridPicker (3x3), PaletteWidget, VariantStrip, ExportPopover (tokens), SimulationWindow.
- Behaviour effects: create a pseudo-effect with named controls, one expression per property, idempotent re-apply, Remove button; no hidden state.
- Preflight and feedback: dim tiles when the selection does not fit and say why; one undo group per action; result toast with counts.
- Tooltip contract: every tile ships a tooltip with "click / right-click / modifier" lines.
- Export: token template engine ({comp} {date} {time} {project} {w}x{h} {fps} {##}) with a live preview string; copy-to-clipboard; folder creation.
- Quality: test with 1, many and zero selected layers, locked layers, 3D layers, nested precomps; persistence across restarts; layout import/export.
- Suggested first tools (high value, low risk): Stroke Surface (caps, joins, taper, dashes), Spring/Overshoot effect, Counter effect with formatting, Typewriter effect, 3x3 Anchor, Explode/Merge, Export Grab with tokens, Palette base-colour tool.

## 9. Verified snippets (numerically checked in Node, not yet in After Effects)
- Counter format: group digits with the chosen separator, decimals fixed, decimal mark, prefix "$", suffix "%", "K" for thousands, negative sign; tests: 1000 -> "1,000"; 1000000 with "$" -> "$1,000,000"; 1234.5 with decimals 2, space group, comma mark -> "1 234,50"; -9876543 -> "-9,876,543".
- Counter value = (from + (to-from)*progress) * multiplier, clamped (0 -> 0, 2 s -> 1,000,000 with multiplier 1000).
- Typewriter characters = clamp(floor((t - delay) * cps), 0, length) (t=0.5 s at 18 cps shows 9 characters).
- Overshoot offset after the last key = velocity-scaled `amp*sin(2*PI*freq*t)/exp(decay*t)` with amp = 0.05*bounce, freq = speed, decay = 4*settle: zero at the key, bounded, settles, grows with Bounce, decays faster with Settle.
- Anchor 3x3: node (r, c) -> (x + w*c/2, y + h*r/2).
- File tokens: `{comp}_{date}_{time}` -> "Next Draw_2026-10-26_13-38".

## 10. Gaps and uncertainties
- Which parts are native property surfacing versus custom effects is inferred from the effect names visible on layers (Springy, Clickety, Odo) and the narrator's remarks; the actual implementation was not inspected.
- Arrowheads, "March" dashes, Petals rules, Variants logic and Sploosh internals are known only from the UI.
- Pages 2 and 3, Keymaster, Slingshot, BPM and Organization tools were not demonstrated in depth.
- The transcript sometimes mis-hears product names (for example "Motion Dog", "Yonk" for Yoink, "Spllo"/"Sploosh"); names above follow the on-screen text.
- Nothing here was run in After Effects.

## 11. Sources
- Video: https://www.youtube.com/watch?v=YkbxkUnhk6I (transcript and frames)
- Panel page named in the description: https://motionfun.net/motion-dock (not opened)
- Related reports in this project: Reveal Seed System https://claude.ai/artifact/8mHHx41ULDvhixBRKrQPZk ; Alpha Matte Reveals https://claude.ai/artifact/EsckmAv6jb2bAfHkmWuyfo ; panel study https://claude.ai/artifact/8h47154FCSAATCQJrdxhac
