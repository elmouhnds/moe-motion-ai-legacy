# Changelog

All notable changes. Versioning: semver, independent of other MOE products.

## [0.85.0] — 2026-11-12 — The Assistant button says what it is
- The floating Assistant button is no longer a flat accent circle with the Look stage's sparkle icon. It is a dark tile with a lit rim and its own mark: a speech bubble holding a spark (owner: "premium, and it must say AI assistant, in every style").
- One shape per style: a rounded tile in Bento, a round solid bead in Glass, a small-cornered tile in MOE, a hard square in Control. Dark and light themes, every accent (token colours only).
- States: the rim turns once when a suggestion arrives and keeps turning while the Assistant thinks (the spark beats); still otherwise. Reduced motion turns both off. Nothing moves on hover.
- The suggestion badge is the accent colour with its number (in Glass the number was invisible).
- The same mark is in the Assistant's header (with an "AI" chip) and beside its messages.
- The last row of a page can be scrolled clear of the button in every style (it used to stay under it, most visibly above Glass's nav).

## [0.84.0] — 2026-11-12 — Glass: a clean nav, controls you can hit
### Changed (owner: "review them and design the best; and the nav bar at the bottom — each of the five icons has a black box behind it, I do not know what it is for")
- **Nav bar**: the boxes were the `^1 … ^5` key hints (Ctrl+1…5), 9 px on a dark chip. Removed — the shortcut stays in each tab's tooltip. The selected tab has a thin rim and a short accent line; tabs have a focus ring.
- **Sizes**: Glass gets the same real 24 px controls as Bento, MOE and Control (chips, tags, switches, segments, colour bars, the Quick Bar's ★, anchor dots, format selects). `tools/audit-size.js` has no waiting list any more: 0 in all four styles.

## [0.83.0] — 2026-11-12 — Glass: menus you can read
### Fixed (owner: "in Glass any pop-up or menu over the plugin is transparent — make it opaque or another style so it reads")
- Measured in the preview: the sidebar menus, a tool's options, the sheets (What's new, About, Shortcuts), the toast and the Assistant were **7 % opaque** in Glass (the panel menu 78 %) — they used the page cards' see-through tokens, so the page showed through their text.
- Every surface that floats over the page in Glass now gets **solid tokens** (`css/styles.css`, dark and light): its rows, fields and chips inherit them; a firm edge, a deeper shadow, no backdrop blur; the page dims to 60 % behind a dialog. The page's own cards keep their glass.
- New `tools/audit-overlay.js`: four styles × two themes, opens 8 floating surfaces in each (64) and fails when the page shows through (background alpha × every parent's opacity, after the fade-in, under 0.97).

## [0.82.0] — 2026-11-12 — Easier to hit, the rest of the layout plan
### Changed (owner: "approved for Glass, finish the plan")
- **Glass** uses the stages' words — Layer, Look (the owner approved the before / after pictures of exactly that).
- **Size audit** (`tools/audit-size.js`, new): 192 screens — no text under 10 px, and every control must answer a click 12 px from its centre in each direction (probed with `document.elementFromPoint`, so a widened hit area counts only when it really works). It found 19 kinds of control under 24 px in every style (swatches 10 px tall, segment buttons 18 px, chips and switches 22 px, the Quick Bar's ★ 18 px …).
- **Fixed in Bento, MOE and Control**: an invisible `::before` widens what answers a click where nothing clips it; inside rows that scroll the control is really 24 px (chips, tags, switches, swatches, segments, ★). **Glass keeps its sizes** — 9 kinds are listed by the audit as waiting for the owner.
- **Sidebar shortcuts** (MOE, Control): *Everyday* (the ten Alt+1…0 slots) and *More*, a thin line where the kind of shortcut changes. Glass keeps the plain list.
- **Audits open Bento's stages**: `audit-arrange`, `audit-repeat` and `audit-cut` set every stage open (they are folded by default since v0.81, so the audits had been looking at one row per stage).
### Honest notes
- A first version of the size fix passed a computed-style check and failed a real click (the hit area was clipped by `overflow`); the audit was rewritten to click, and the fix redone.

## [0.81.0] — 2026-11-12 — A shorter Home, a fuller Control
### Changed (owner picked ideas 10 · 23)
- **Bento Home**: 5 070 px → 1 002 px at 740 px wide (5 391 → 1 078 at 420). A stage starts as one row naming its groups (`FOLDED_BY_DEFAULT`; your own folds and opens are kept and win); a Power card is its name, *When* and its buttons — *How* opens what / needs / steps.
- **Motion Control with keys** (Bento, Control): anchor + align wait behind **Anchor · Align** (`layoutAE.placeToggle`, remembered); `controlShows` follows it so the NOW actions still offer what is hidden. MOE (its Layer tab) and Glass are unchanged.
- **Control**: a **key jobs** row for selected keys (Stagger, Reverse, Mirror, Retime, Copy motion, Paste motion — the Quick actions of Timing › Keyframes & Loops, run now, not in the Mix); Libraries wrap into rows; the first page is **Animate** (was Move).
- **One set of names**: the stages are Animate · Layer · Design · Look · Deliver, like MOE's tabs (were Arrange / Finish).
- **Bento libraries** start with their tiles: the one-line title, the banner only from ⓘ.
- **Your own Home is the Quick Bar** (idea 23): it takes whole Style Kits (`kit:<id>`, Shift-click a kit card) besides tools, presets and recipes; Quick Bar's page lists Style Kits and Recipes with ★.
### Not changed, on purpose
- **Glass**: it keeps Arrange / Finish and its full Motion Control until the owner approves the before / after screenshots.
- The Quick Bar still shows icons in one run (group captions were not added); no new size audit tool.

## [0.80.0] — 2026-11-12 — Scene Check
### Added (owner picked ideas 5 · 18 · 19 · 20; 21 was already in Deliver)
- **Scene Check** page (Deliver › Scene Check, every style; `views/scene.js`, pure `features/scene/plan.js`).
  - `scene.read` (read-only, on a click): layers (`layers.describe`), Transform keys + expressions (`keys.snapshot`), markers (new host op `markers.list`).
  - **What fits** (5): Style Kits scored from what is in the comp, each point with its reason; Open kit / Work in it.
  - **Motion timeline** (18): one row per layer — its life, keyed spans, markers, expressions, the playhead.
  - **Quality check** (19): moves under 4 frames, keys between frames, empty text, "comes in, leaves with a cut" (a hint); after Measure: text outside title safe (10 %), shape colours outside the active client's palette.
  - **Storyboard** (20): scenes from comp markers, else layer markers, else four even moments (said); a schematic frame per scene from measured boxes; saved as a stand-alone page (escaped, no script).
  - `scene.measure`: After Effects' own measurement (`layers.bounds`, temporary null removed, layer count read back) + shape colours.
- Self-Test: a **Scene** check (layers, keys and markers read back).
### Honest notes
- Idea 21 (a preview before resizing) already exists: Deliver draws before / after diagrams; Scene Check links to it.
- The storyboard is a schematic of boxes and texts, not rendered frames. Colours are checked on shape fills and strokes only (not text or effects). Title safe is the classic 10 % area, checked at the playhead. Mock + browser preview only.

## [0.79.1] — 2026-11-12 — Dragging that follows your hand
### Fixed (owner: "dragging the bars in Control does not work well — review every drag")
- **Control's bars**: only the number (≈ 40 × 30 px of a 160 × 173 px bar) answered a drag. The whole bar is the handle now (`scrub.attach({ surface })`): the range over the bar's own size, click sets the level, double-click resets (Duration, Stagger), Shift bigger steps, Ctrl a quarter of the pace. Switches inside a bar and the number while typing keep their clicks; the number's width follows the value while dragging.
- **Stale number**: a bar is morphed in place while its number is rebuilt, so a listener on the bar would read and write the number of the first render. Bars get no listener of their own — one delegated listener resolves the bar and the number that are on screen now (`scrub.js`, tested).
- **Every drag** (`scrub.track`): tracked on the window (leaving the control or a refused pointer capture no longer loses it), painted on a 16 ms clock (not requestAnimationFrame), a mouse-up the panel never hears (released outside, window blur) still commits, Esc cancels, modifiers can change mid-drag without a jump, no dead zone after the 3 px threshold.
- **Canvases** (graph handles, graph grip, curve editor, cloner stage): `scrub.guard` — a lost mouse-up can no longer leave a handle stuck to the pointer.
- Tune strip: the number you set stays shown while the run is redone.

## [0.79.0] — 2026-11-12 — Tune after you apply
### Added (owner picked ideas 12 · 13 · 14 · 15 · 16)
- **Tune strip** (`app/ui/retune.js`): after a run, its numbers stay under the header — a change restores that run's checkpoint and runs the tool again inside ONE undo group (`executor.batch`; `restore` now joins an open batch). Only for the selection the run was made on; a later write that cannot be tuned forgets it.
- **Variations**: up to four takes from the tool's own parameters (`retune/plan.variations`: calmer, faster, overshoot, other side) with the tool's real preview.
- **Stagger by drag**: the strip draws the offsets live while the number is dragged; one commit on release.
- **Retime Keys** (`motion.retime`): the selected keyed properties stretched in time around the first key — frames kept, influence kept, speed ÷ factor; read back; Restore exact.
- **Copy Motion / Paste Motion** (`motion.copyMotion`, `motion.pasteMotion`): a layer's Transform keys with ease, paths and expressions; pasted at the playhead; Position is offset so each layer stays where it is; other dimensions are skipped and said.
- Host: `keys.snapshot` (read-only). Self-Test: a **Retime** check.
### Fixed
- Self-Test: a check that answered `{ ok }` (Markers, since v0.67) had no status and was missing from the totals — it now counts as pass / fail.
### Honest notes
- Mock + browser preview only. Run Diagnostics › Self-Test: the new Retime check asks After Effects itself.

## [0.78.0] — 2026-11-12 — Recipes: checked first, everywhere, shareable
### Added (owner picked ideas 8, 4, 7)
- **Precheck** (`kitRun.precheck`): every step is judged against the selection before the first one runs — `ready`, `needs` (the tool's own hint) or `after` (it acts on what an earlier step makes: `PRODUCERS`). A recipe with a `needs` step does not start (no undo group opened); its card shows the need.
- **Recipes as refs** (`recipe:<kit>/<id>` in `actions.resolve`): Ctrl+K, My pie's catalogue, and the Quick Bar / sidebar (Shift-click a recipe card). A removed recipe drops off the bar by itself.
- **Export / Import** your recipes (`kitRun.exportMine` / `importMine`): names + refs only; every imported recipe goes through `kits.makeRecipe`, duplicates and unknown kits are skipped, nothing runs.
### Honest notes
- Mock + browser preview only. `after` steps cannot be judged in advance, so a recipe can still stop there (and says what ran).

## [0.77.0] — 2026-11-10 — Your own recipes, Beat Sync, Living Loops
### Added (owner: "more ideas")
- **My Recipes** (`kitRun` build mode, `kits.makeRecipe` pure): *New recipe* in a kit → click 2–4 of its tools in order (a click picks instead of running), name it, Save. Kept per kit (store `kit-my-recipes`), run exactly like a built-in recipe (one undo group, stops honestly); right-click removes after a confirmation. A stored chain whose tool no longer exists is not offered.
- **Beat Sync** and **Living Loops** technique kits (existing tools only), with 3 more recipes (Pulse on the Beat, Float & Breathe, Pop & Settle).
- **Ready now**: each kit card counts its tools that can run on the current selection (the tools' own readiness).
- A recipe's chain lights up step by step under the mouse (colour only; off with Reduced motion).
### Honest notes
- Mock + browser preview only. Pulse on the Beat needs a soundtrack: on the mock (none) it stops before writing.

## [0.76.0] — 2026-11-10 — Smart Kits: recipes, progress, Effectors Pro
### Added (owner: "ideas that are not only what already exists")
- **Recipes** (`app/ui/kitRun.js`): a kit's named chain of its OWN tools — one click, one After Effects undo group (`executor.batch`); readiness before every step; stops at the first step that is not ready or fails and says what ran. 11 recipes (Click & Punch, Rise & Spotlight, Liquid Card, Frost & Focus, Word Cascade, Reel Pop, Ripple Wall, Spring Bloom, Jelly Ring, Living Field, Ring Scatter).
- **Effectors Pro** — a technique kit: Clone · Shape · Physics · Fields · Aim & sound · Colour & trails (29 existing tools in build order). Kits are now grouped as **Looks** and **Techniques**.
- **Progress**: a step ticks when one of its tools ran here (session memory), the next step is marked, the kit head shows n / total.
- **Work in this kit**: pin one kit; every style's Home shows a slim strip with its next step's tools (opt-in, removable).
### Changed
- Tile badges are never smaller than 10 px.
### Honest notes
- Verified on the mock and the browser preview only. Progress is what you did in this session — it does not read the comp. A recipe's later steps rely on what After Effects leaves selected after the earlier one (as on the mock); unverified in After Effects.

## [0.75.0] — 2026-11-10 — Style Kits, Signature colours, a brand that moves
### Added (owner)
- **One Ctrl+Z per Mix**: `executor.batch` opens ONE After Effects undo group around all the Mix's runs (tx.begin / tx.end once); each run still validates, verifies, checkpoints and has its own History entry; the group always closes, nested batches join it.
- **Style Kits** (Design › Style Kits, every style; `app/ui/kits.js`, `views/kits.js`): SaaS Product Video · Apple Glass · Kinetic Type · Social & Reels · MoGraph Cloner — each look's EXISTING tools gathered in build order (backdrop → build → bring in → interact → camera…). Click applies (readiness first), right-click opens the library. General tools stay where they are.
- **16 Signature looks** at the top of Backgrounds (Liquid Chrome, Peach Fuzz, Mocha Mousse, Electric Lime, Ultraviolet Dream, Northern Lights, Tokyo Night, Miami Sunset, Desert Rose, Matcha Latte, Ocean Glass, Holographic, Ember Glow, Cosmic Latte, Neo Mint, Midnight Gold) — each a complete look with its own motion; 52 palettes.
- **Brand › Motion**: a client's own Ease Out / Ease In (%), from a feel (Smooth, Snappy, Expo, Gentle, Soft land, Launch) or typed / dragged; a curve and a ball show the feel; saved on the client; **Brand ease** applies exactly these values with Smart Ease. The three examples have their own.
- **Liquid sliders** (Control): the fill has a moving liquid surface; while you drag it pours (faster waves, bubbles). Round switches answer with one soft ring; the small switch's knob lands with a little elastic.
### Changed (owner)
- **Text-animation previews always play "MOE Motion"** (Arabic text selected: "مو موشن") — two words, so moves by words, lines or letters read clearly (Text library and Control › Text).
- **Previews play when the mouse rests on them** (tiles, Control squares and heroes, palette cards, kit tiles, the brand curve); a palette card plays its real motion. The live preview page behaves like the panel (Calm).
### Tests
- tests/control.test.js +2 (one undo group per Mix; kits, Signature looks, text samples, brand ease). tests/space.content + premium-ui updated. 551 tests.

## [0.74.0] — 2026-11-09 — Control comes alive
### Added (owner: "finish the plan, make the preview moving and live, and a light premium animation touch")
- **Live previews**: Control's big squares (Move, and every page's hero) play in Calm too — they were still because Calm only played squares under the mouse; small page squares play under the mouse. The live preview page plays everything (Full).
- **Premium motion** (Control, CSS only): the head and page tabs fade in, groups and squares rise in with a short stagger, the hero caption fades up, the on-dot breathes, round switches and tabs ease their colours, a soft light crosses Apply while something waits in the Mix, Mix chips rise in. They play once when an element appears; hover still changes colour only; Settings › Motion › Reduced turns them off.
- **Wiggle Position · Rotation · Scale** (the library's Wiggle, Wiggle Rotation, Wiggle Scale presets; px / ° / %).
- **Your numbers stay** (duration, stagger, blur, wiggle… in `cc-tune`); switches start off.
- **My mixes**: ☆ in the Mix bar saves the Mix by name; it waits under My mixes (click loads it, double-click loads and applies, × forgets).
- **Enter** applies the Mix, **Esc** empties it (Control's home, when something is in it).
### Not done (said plainly)
- One Ctrl+Z for a whole Mix: each run is still its own History entry (joining runs needs an executor change — next).
- Beats square with the real waveform: reading the sound needs After Effects' Convert Audio to Keyframes (a write), so it stays a click.
### Tests
- tests/control.test.js +1. 547 tests.

## [0.73.0] — 2026-11-09 — Palettes as backgrounds, Brand organised, Control everywhere
### Changed (owner: "the background colours are shown badly", "the brand kit is full of information and not organised", "do the rest of the plan")
- **Palette cards** (`app/ui/paletteCard.js`), in every style: each palette is a still frame of the real background (`bgDraw.bgFrame`) in YOUR style — a complete look ✦ in its own — with its colours fanned on top and the name over a fade. Backgrounds (all four styles) and Control › Design; Design's big square shows the real background too. Only the composer's stage animates.
- **Brand Kit, organised** (docs/features/BRAND_KIT_LAYOUT.md): client cards, a client card in the brand's own colours and fonts, the four actions, then tabs Colours · Type · Guide · Manage.
- **Three example clients** — Nile Roast, Pulse Pay, Sahara Atelier — saved the first time Brand opens with no clients (never over yours); Manage adds them back.
- **Control's library pages** (plan 2): no banners; tiles as Control squares, pill tabs and chips, the Apply bar floats like the Mix; Brand in Control's look.
- **Polish** (plan 3): a press glows (never moves); canvases redraw when they grow taller (`widgets.prep`); light theme checked.
### Tests
- tests/control.test.js +1 (palette card args, the examples: valid, readable body text, an ease each, seeded once and never over your clients; no banners in Control); tests/lookfeel.test.js updated. 546 tests.

## [0.72.0] — 2026-11-09 — Control has pages
### Added (owner: "only this page? no other pages?")
- **Five pages** under the head, as a tab row (Ctrl+1…5; the page that fits the selection gets a dot, it never switches by itself): **Move** (the squares + the Mix), **Text**, **Design**, **Look**, **Deliver** (`app/ui/layoutControlPages.js`).
- **Text**: the text library's presets, In or Out, each square playing YOUR text (the first selected text layer); Arabic-safe presets are marked ع, letter-by-letter ones get a warning badge when your text is Arabic; Typewriter and Counter.
- **Design**: the background plays big, the palettes are colour strips, the templates with their previews; Shapes & Icons, Product UI and Brand one click away.
- **Look**: Styles, Glass (clear and thick), Zoom & Focus; Compositing and Expressions one click away.
- **Deliver**: the social safe zones and the composition guides; Deliver and Layout & Grid one click away.
- A square is a library tile (same tool + args): click picks it — it plays big on top and the bar under the page says what it will do (the tool's own card) with one Apply; double-click applies now; right-click opens its library; *All ›* opens the whole library. Tiles that need setup (a layer to pick) stay on their library page.
### Fixed
- Text previews redraw at their real height when their box grows.
### Tests
- tests/control.test.js +1 (every square on every page is a registered tool with valid args). 544 tests.

## [0.71.0] — 2026-11-09 — Control, laid out better
### Changed (owner: "start with all of it")
- **Head**: the comp (name · fps) and the selection share one block with Refresh and Repeat; the separate context strip and the search row are gone from Control's home — search is the magnifier in the header (Ctrl+K). The squares start ~90 px higher.
- **Motion**: the preview fills the square, its name and details sit on it over a fade; Fade · Pop · Rise · Slide · Spin and In / Out share one row (wrapping when narrow).
- **Tune block**: Duration and Stagger (taller, the unit right after the number) and the four switches are one block beside the move (2 × 2 switches beside the sliders at 400–560 px).
- **Move / Add**: two labelled groups (Keys / Add with keys selected).
- **Motion Control** folds to one line for layers (*Ease · Anchor · Align*, remembered); open for keys, where it is the tool.
- **Libraries**: one row that scrolls sideways instead of a 17-button wall behind the Mix.
- **Mix**: a thin line while empty; it grows (fades up) when you switch something on.
- **Sidebar**: icons only in Control (names in tooltips), so the squares keep the width.
### Tests
- tests/control.test.js +1. 542 tests.

## [0.70.0] — 2026-11-08 — Control: a Control Center for motion
### Added
- **Control**, a fourth style (owner picked it from the from-scratch concepts): squares that ARE the tools, following the selection. **Motion** plays the move it will write (Fade · Pop · Rise · Slide · Spin, In / Out); **Duration** and **Stagger** are tall sliders you drag; **Blur · Overshoot · Expo · Order** are round switches; **Wiggle** (amount + on / off), **Typewriter** for text, **Loop** for keys, **Beats** for the music. Switched-on squares gather in the **Mix**: one line says what will happen (the tools' own cards), **one Apply** runs them in order through the executor — each verified, each its own Undo in History; it stops and says so at the first that does not fit. Double-click a square to run it alone; right-click opens its page. The Motion Control stays the one place for ease, anchor and align; Libraries open every page (docs/features/CONTROL_STYLE.md).
- Sliders can be tall: `scrub.js attach` takes `axis: 'y'` + `span`.
### Tests
- tests/control.test.js (6); `audit-cut` covers four styles. 541 tests.

## [0.69.0] — 2026-11-07 — Glass with the sidebar
### Changed
- **Glass uses MOE's sidebar** (owner): every shortcut — Select, Parent & Link, In / Out, Loop, Guides and the whole Quick Bar — sits on the left (names on ⇔ from 600 px, over the page when narrower); the icon row on top is gone, so the page starts higher. Glass keeps its look, its NOW card and its bottom dock.
### Fixed
- NOW (Glass): Smooth / Snappy Ease no longer sit stuck to the Motion Control — 12 px of room between them (owner comment: "متاخدلين ف بعض").
- Glass NOW keeps pairs together (Loop Cycle / Ping-Pong) now that the sidebar takes width: 2 columns narrow, 4 from 560 px.
- Narrow panels: the Anchor header ("Anchor" + "Masks") wraps instead of running into the Align title beside it — checked at 340 / 380 / 440 / 520 / 760 px in Bento, Glass and MOE: no label overlaps another.
### Tests
- `tests/lookfeel.test.js` +1. 534 tests.

## [0.68.1] — 2026-11-07 — Glass restored
### Fixed
- **Glass looks as it did in v0.67 again**: the v0.68.0 frost (drifting light behind the panel, blur and grain on every surface, frosted tiles and Apply bar) looked wrong and is removed — `css/styles.css` is the v0.67 file. The Background Composer and the rest of v0.68 stay.

## [0.68.0] — 2026-11-07 — Look & Feel
### Changed
- **Backgrounds is one instrument** (Background Composer): a live stage of the real background at your comp's size; Style · Motion · Colours always visible under it; palettes as light colour strips — a plain palette swaps only the colours and keeps your style and motion, a designed look (✦) takes all of it; Colorize, Save as client and Fine-tune beside it; one Apply.
- **Faster Backgrounds**: only the stage animates (the 36 palettes are CSS strips, not canvases) — idle CPU in the stress test 5 % → 2 %.
- **Frosted Glass**: soft coloured light behind the panel, every surface blurs and lifts it with a bright rim and a faint frost grain; tiles, menus, hover cards and the Apply bar are glass too. Appearance › frost off removes it all; reduced motion stops the drifting light.
- MOE (Classic) shows no section banners; filter rows scroll and fade instead of cutting a chip.
### Fixed
- The background preview could keep drawing the previous look after a change (a reused canvas).
### Tests
- `tests/lookfeel.test.js` (3): composer rules, no banners in MOE, frost rules, nothing newer than Chromium 99. 533 tests. **Preview on the mock — not yet seen in After Effects.**

## [0.67.0] — 2026-11-07 — Smart Layer
### Added
- **Hover Cards**: rest the pointer on a one-click button (NOW, the Quick Bar, the tabs) and its Tool Card appears: what it acts on, what it writes, what could surprise you, how to undo it — or what it needs.
- **On this layer** (Layer tab): read what MOE did to the selected layers — every MOE expression with its property and its numbers, every MOE effect — then **Edit** an expression with its own numbers or **Remove** one item, nothing else.
- **Beat Markers** (Timing tab): the beats of the music as markers on the selected layers (After Effects' own Convert Audio to Keyframes, a deterministic beat finder); Restore removes exactly those markers.
- **Marker Trigger**: animate once, it replays at every marker. **Marker In / Out**: fades in after the first marker and out into the last.
- Self-Test check `markers`: After Effects counts the markers it was given and Marker In / Out reads 0 · 100 · 0.
### Changed
- **Foresight**: a selected property with your own expression stops the expression tool before anything is written (it used to fail halfway); with Replace on, the card warns first. Keyframe tools say when a property's expression would hide the new keys.
- `rigs.find` returns whole expressions (was cut at 200 characters) so numbers can be read back; `rigs.remove` can remove one item.
### Tests
- `tests/smartlayer.test.js` (6); mock: MarkerValue + layer markers, `thisProperty.key()`. 529 tests. **Mock / preview — the Self-Test in After Effects is the proof.**

## [0.66.0] — 2026-11-07 — Tool Cards
### Added
- **Tool Cards** (`core/toolcard.js`, docs/features/TOOL_CARDS.md): every library tile says what it will do before Apply: what it acts on, what it will write, how to undo it, or the one thing it needs first. Built from each tool's own plan, never a second rule list, never an After Effects call. Every registered tool gets a card.
- Expressions show their **exact code** before Apply, with the numbers the sliders set lit, a signature (`autoFade(secs 0.5)`) and Copy.
- **Live Stagger**: each layer plays its own keys later, by timeline order; a stagger that moves no key and stays editable.
- **Marker Pulse**: a pop after every layer marker; put markers on the beats.
### Changed
- **Expressions page** is a list grouped by what each one moves (Position · Rotation · Scale · Opacity · Your keyframes). The groups that fit the properties you selected come first, marked *fits your selection*; each row shows what it is for on up to two lines.
- **One Apply**: the Inspector no longer has its own Run button or preview list; the sticky bar is the one action.
- Settings the tile already chose (which expression, style, motion, look, mode, template) are no longer repeated as a picker in the Inspector (*All tools* still has them).
- Card lines read like sentences ("4 layers", "1 property").
### Tests
- `tests/toolcards.test.js` (6); mock expressions get After Effects' marker API. 522 tests. **Mock / preview — not yet seen in After Effects.**

## [0.65.2] — 2026-11-06 — After Effects 2026
### Changed
- The installer enables unsigned panels for CSXS 11, 12 and 13 (After Effects 2024, 2025, 2026 and newer builds), not only 12. The panel already accepts After Effects 25.0 and later (`Host AEFT [25.0,99.9]`, CSXS 12.0 minimum) and the installer finds After Effects 2026.
### Not done
- Signing the panel (one public report says After Effects 2026 26.3 refused an unsigned panel despite PlayerDebugMode): needs running Adobe's ZXPSignCmd at build time — waiting for the owner's decision.
### Tests
- Wine: the three registry keys are written; silent update keeps one folder. **Not run in After Effects 2026.**

## [0.65.1] — 2026-11-06 — A redesigned installer
### Changed
- **The installer looks like the panel**: one dark surface (welcome, headers, finish), new artwork in the panel's own font (`tools/build-installer-art.js`), a header image on the install pages.
- **It says what it will do before you click**: *New install*, *Update 0.65.0 → 0.65.1* or *Reinstall*; whether After Effects was found; the release headline; that your data stays. The main button reads **Install** or **Update**.
- **Faster to read**: one line per step (Removing old copies · Copying the panel · Checking the installed files · Registering with After Effects); the file list only on *Show details*.
- **Checked, not assumed**: after copying, the installer reads the installed manifest back and requires this version and the panel's page — otherwise it stops with a clear message.
- **Open After Effects now** on the last page (shown only when After Effects 2025 / 2026 was found — registry `InstallPath`, then the default folder).
- Uninstall pages have their own title and say your data is only removed if you choose.
### Tests
- Built and run under Wine (pages screenshotted, silent update kept); the version check caught a mismatched test build. **Not run on real Windows.**

## [0.65.0] — 2026-11-06 — Workspaces: tabs in the order of the work
### Changed
- **MOE tabs follow the work**: Animate · Timing · Layer · Design · Look · Deliver (were Keys · Animate · Layer · Design · Effect · Comp), each with an icon; ids unchanged, so saved order, Recent and pins keep working.
- **The full graph is no longer on top of every tab.** It lives in **Timing**; Animate shows the one-row **Motion Bar** (Easy · Linear · Hold · your curves + the most used · Graph), Layer shows **Place** (anchor · align · distribute), Design / Look / Deliver show nothing above their tools.
- Bento and Glass: the NOW card uses the Motion Bar too; *Graph* opens the full graph in place (remembered).
- New tools placed where the job is: **Wipe · Depth · Shake** are modes of Animate In / Out; **Decode · Assemble · Explode** are one-click text rows; **Carousel 3D** is in Arrange; **Styles** lead the Look tab with Glass; **Product UI** (Click on Layer) leads Design.
- Stages: Glass and Styles moved to Finish (with Key & Color, Camera & Zoom); Product UI leads Design.
### Fixed
- The folded Motion Control's *Graph* button opened the global graph instead of the one for that selection.
- NOW (Bento / Glass) no longer repeats Easy / Linear / Hold, Out Expo and Out Back when the Motion Bar already shows them.
### Tests
- Updated tab, stage and Motion Control tests; 516 tests. **Mock / preview — not yet seen in After Effects.**

## [0.64.0] — 2026-11-06 — Wave 4: Decode, Exploder, Depth Reveal
### Added
- **Decode / Scramble** text presets: Character Offset settles the letters into the word (left to right or random); not offered for Arabic.
- **Explode / Assemble** text presets: a frozen Wiggly Selector (Intersect) gives each letter its own direction; every setting found by its English name, verified; Self-Test proves the names in After Effects.
- **Depth Reveal** (Motion › Depth): layers come forward from Z + Depth (native 3D, nothing downloaded), with fade and MOE Blur, in screen order; Restore makes them 2D again.
### Fixed
- Text animator keys now land on the comp's frame grid (they were written outside `keys.write`).
### Tests
- `tests/wave4.test.js` (4). **Mock / preview — the Self-Test in After Effects is the proof.**

## [0.63.0] — 2026-11-06 — Progress + Stop, Wipe Reveal, Carousel 3D
### Added
- **Progress + Stop** for every tool (the study's defect S4): each After Effects call is a named step ("Measuring", "Writing keys"…); runs over half a second show a strip with the step, the time and **Stop** — honoured before the next step, what was made stays one Ctrl+Z and the panel says so.
- **Wipe Reveal** (Motion › Wipe): After Effects' Linear Wipe as one `MOE Wipe` per layer — any side or diagonal, soft edge, eased, staggered by screen order; Self-Test measures the direction from pixels.
- **Carousel 3D** (Layout › Arrange): cards on a 3D ring just wide enough that neighbours never overlap (measured), turning one card at a time with native keys, back cards fading, optional tilt; Restore puts every card back.
### Changed
- Grid Builder copies every source in one call (`layers.cloneMany`): 30 sources cost what 3 do.
### Tests
- `progress.test.js` (3), `wipecarousel.test.js` (5); the frame-grid, locked and links matrices now include Wipe and Carousel; 512 tests. **Mock / preview — the Self-Test in After Effects is the proof.**

## [0.62.0] — 2026-11-06 — Rename-safe links
### Added
- **Rename-safe links** (the study's defect S1, "high"): every MOE expression that names a layer carries that layer's permanent After Effects id (`/*MOE-LINK:<id>*/`); renaming a Grid null, Effector, Glass, Trail source or followed layer is seen by the panel and **relinked at once** — one undo step, a toast. A deleted layer is reported, never guessed; user expressions are untouched.
- Relink tool (Expressions) and host ops `links.scan` / `links.relink`.
- AE Self-Test: *Rename a Grid null: Relink keeps every item where it was*.
### Changed
- audit-ui retries a page's connection once before calling it broken.
### Tests
- `tests/links.test.js` (7), including all 318 tiles and tools; 504 tests. **Mock / preview — the Self-Test in After Effects is the proof.**

## [0.61.0] — 2026-11-06 — Engine 2
From the owner's After Effects study reports (AppleFX Lite, SaaS Kit): how every tool runs, not one tool.
### Changed
- **One Ctrl+Z per run**: every tool that writes runs inside ONE After Effects undo group named after it (`tx.begin` / `tx.end`, closed even on failure); Restore is one step; read-only tools add nothing to the undo history. Before, 51 of 80 tools could take several Ctrl+Z.
- **Keys on the frame grid**: `keys.write` puts every key on a frame of the comp, merging keys that meet on one frame (ends always kept). Shake and Click on Layer snap first, then read the layer's own value on that frame.
- **Few round trips**: `props.values` reads many values at their own times in one call — 60 layers: Quick Animate 127 → 8 host calls, Shake 65 → 6, the same as for 3 layers.
- **Locked layers**: one rule for the executor and the button (`core/lockpolicy.js`) — a tool that writes never receives a locked layer (or a property on one); they are named; all locked → refused with the reason.
### Fixed
- Trim Paths, the Expression presets, Parent to Null, Precompose and Separate X/Y changed locked layers.
- Zoom (Punch-in, Detail) read back between frames and could report "partial"; Shake's verify counted plan keys (a fast Jitter merges peaks inside one frame).
### Added
- AE Self-Test: *One Ctrl+Z undoes a whole run* (one Edit › Undo by its menu name, read back).
- Test matrix: every tile and tool at 24/25/30/60 fps (`fpsmatrix`) and on locked layers (`lockedmatrix`), 318 cases each; `tools/scan-roundtrips.js`.
- Docs: ENGINE2.md, research/STUDY_RESPONSE.md (MOE against the study's KPIs and defects).
### Tests
- 496 tests. **Mock / preview — the Self-Test in After Effects is the proof.**

## [0.60.0] — 2026-11-06 — SaaS Interaction
### Added
- **Click on Layer** (Product UI › Interact, Zoom & Focus › Cursor): a cursor clicks the selected layers in order — each click point is the layer's visual centre measured by After Effects at that moment; the layer presses with the cursor, keyed on top of its own Scale, **in place** (Position compensates the anchor offset); the cursor's arrival is read back. Restore removes the cursor and the keys.
- **UI Reveal**: Quick Animate's Stagger has an **Order** — selection, Screen ↘, Screen ↙ (RTL) or centre out — from the boxes After Effects measures. Tiles: UI Reveal, UI Reveal · RTL, UI Pop · Centre Out.
- **Product backdrops**: Product Night, Studio Light, Aurora Product, Graphite (radial / mesh with fine grain).
- AE Self-Test: *Click on Layer: cursor on the centre, press in place*.
### Tests
- `tests/saasinteraction.test.js` (5). **Mock / preview, not After Effects.**

## [0.59.0] — 2026-11-06 — Styles + Shakes
### Added
- **Shakes** (Motion › Shake): Bump, Zoom Punch, Whip, Slam, Jitter — real eased keyframes from a pure plan (`quick/shakePlan.js`), added on top of the layer's own animation, with Intensity / Rotation / Frequency / Settle; previews play the plan.
- **Styles** (Looks › Styles): Soft Shadow, Deep Shadow, Glow, Light Sweep — After Effects' own effects named `MOE Style • …`, parameters by name and read back, updated in place, restorable; Light Sweep's centre is a tagged expression reading the layer's box.
### Tests
- `tests/stylesshakes.test.js` (5); the mock models Drop Shadow, Glow and CC Light Sweep. **Mock / preview, not After Effects.**

## [0.58.0] — 2026-11-06 — Apple Motion
### Added
- **Blur** on every Quick Animate move (px): a `MOE Blur` (Gaussian Blur) keyed on the move's timing and ease, reused, exactly restorable; tile previews draw the blur. Seven tiles: Blur In / Out, Focus In / Out, Whip In / Out, Rise + Blur.
- **Native curves** in the Ease library: Native Standard / Emphasized / Enter / Exit, Spring Soft, Spring Bouncy, Anticipate.
- **Text presets** (Hero): Hero Reveal, Word Stagger, Word Burst, Iris In, Hero Out, Stagger Out — by line / word (Arabic-safe), with blur.
### Tests
- `tests/applemotion.test.js` (4). **Mock / preview, not After Effects.**

## [0.57.0] — 2026-11-06 — Product UI
### Added
- Design › Product UI: eight interface pieces built as real layers on the Templates engine, each animated the way it is used — Button Click (press + ripple), Toggle Switch, Search Bar (cursor blinks), Task Done (check + strike), Notification, Progress Bar (fills), Chat Message (typing dots), Stat Card (trend line draws). Light / Dark look, the brand's colour, Auto-fit, Hold → exit. 12 tiles; a Design tab group; the Design stage.
### Fixed
- Templates' text layers could sit under their own shapes in After Effects (new layers go on top; shapes were made after the texts) — the texts are now moved above the topmost shape (`layers.move`). Affects Tag, End Card, Social Handle.
### Tests
- `tests/productui.test.js` (5). **Mock / preview, not After Effects.**

## [0.56.0] — 2026-11-05 — Smart Controls
### Added
- Every number in the panel is a hidden slider (`app/ui/scrub.js`): drag sideways (Shift ×10, Ctrl fine), live while dragging, one commit on release; a click types; Esc cancels a drag; ↑ ↓ step with one commit after the burst; the wheel steps only while the field is focused.
- Double-click a slider to restore the tool's default.
- The Align gap is scrubbable; the Keyframe Velocity row uses the shared helper.
- A standing rule (CLAUDE.md, docs/features/SMART_CONTROLS.md): give the existing control the power before adding a button.
### Tests
- `tests/smartcontrols.test.js` (4). **Preview, not After Effects.**

## [0.55.0] — 2026-11-05 — Hidden sliders on Keyframe Velocity
### Added
- Owner's comment on the live preview: the Keyframe Velocity numbers (Out / In speed and influence) are now hidden sliders. Drag sideways on a number, like After Effects' scrubby values (Shift ×10, Ctrl fine); the graph follows live and release applies. A plain click still types. A thin accent bar shows where the value sits on hover and while dragging. Influence stays 1–99 %, speed never below 0.
### Tests
- `tests/nocut.test.js` (+1). **Preview, not After Effects.**

## [0.54.1] — 2026-11-05 — Sidebar toggle always opens
### Fixed
- Owner's comment on the live preview: on a narrow panel *Show names* did nothing visible. It now opens the names over the page (no squeeze, the page does not move, shaded behind), closed by a click outside or a shortcut. `pointerdown` so graphs that cancel mouse events still close it.

## [0.54.0] — 2026-11-05 — No Cut Names
### Changed
- The MOE sidebar shows names only when the panel is 600 px or wider (icons on a narrow dock; the choice is kept).
- Names wrap to two lines instead of "…" everywhere (sidebar, tiles, text presets, power cards, Quick Bar rows, action bar, field labels, preview lines); segmented controls and the action bar take a second row when narrow; shortened descriptions carry their full text in a tooltip.
### Added
- `tools/audit-cut.js`: 21 pages × 3 styles × 2 widths (126 screens) — 155 cut texts before, 0 cut names after.
### Tests
- `tests/nocut.test.js` (2). **Preview, not After Effects.**

## [0.53.0] — 2026-11-05 — Guides menu, social safe zones, anchor pad
### Added
- **Guides** sidebar menu (MOE style, the fifth): Lines (Centre · Thirds · Golden · 12 Col), Safe (TV Title / Action · Margins · Clear), Social (TikTok · Reels · Shorts · Stories safe zones), each with its own icon; also in Comp › Guides & Safe Areas and the Layout page.
- Tool `grid.guidePreset` (pure presets in `grid/guidePresets.js`); social margins are the widely published 1080 × 1920 figures, scaled to the comp and labelled approximate. `guides.set` `skipSame`: a preset pressed twice adds nothing.
### Fixed
- The Parent & Link menu had an empty icon (`link` did not exist). A test now checks every icon name the UI uses.
### Changed
- The anchor pad is drawn as the layer's box: square handles on corners and edges, the anchor crosshair in the centre.
### Tests
- `tests/guides.test.js` (5). **Mock / preview, not After Effects.**

## [0.52.0] — 2026-11-05 — Auto-fit Templates
### Added
- Template text always stays inside the frame: each line has a safe width (a share of the comp width per template). `text.create` measures the text in After Effects and shrinks the font until it fits (up to 4 measurements, never under 40 % of the design size); shapes are sized from the fitted text. The result lists each fitted line; the preview uses the same rule.
### Tests
- `tests/templates.test.js` (12): a long title / Arabic quote fits its safe width, smaller font, ≥ 40 %, underline follows it, short text unchanged, quote mark unchanged, `fitSize` cases. **Mock / preview, not After Effects.**

## [0.51.0] — 2026-11-05 — Branded Templates
### Added
- Templates in the active client's brand (*Use the brand*, on by default): the brand's primary as the accent, the best-reading brand colour (≥ 4.5:1 when possible) for the word on a pill / button, the brand's Arabic or English font by the text's script. Hand-set values win. Tiles and the big preview show the client's colours.
### Tests
- `tests/templates.test.js` (11): `brandOpts` (primary, best contrast, font by script, no colours → none); built with Nile & Co. active — pill = primary, word = best colour, font Montserrat; own accent wins; *Use the brand* off; previews use the same rule. **Mock / preview, not After Effects.**

## [0.50.0] — 2026-11-05 — More Templates + Exit
Details: `docs/features/TEMPLATES.md` (v0.50 section).
### Added
- **Quote**, **End Card**, **Social Handle**, **Chapter** (+ Arabic اقتباس / شكراً للمشاهدة): 8 templates, 12 tiles; the End Card's button and the handle's pill are sized to their measured words; Chapter has a *Number* setting.
- **Hold, then exit** on every template: after the entrance and the hold, each part leaves the way it came (Quick Animate's keys); Lower Third and Social Handle tiles hold 3 s.
### Tests
- `tests/templates.test.js` (9): all 8 templates placed by the plan; Hold writes entrance + exit keys = the plan, ending where it started; the new parts (Arabic quote mirrored, button fits its word, handle in the corner, chapter number). **Mock / preview, not After Effects.**

## [0.49.0] — 2026-11-04 — Native Templates
Details: `docs/features/TEMPLATES.md`.
### Added
- **Templates** (Design tab, first group; Design stage; Templates page): Lower Third, Title Card, Callout, Tag + Arabic شريط الاسم / عنوان كبير — built in the comp as real text and shape layers, sized to the text After Effects measures, parented to one null `MOE Template N`, the entrance keyed (Quick Animate's keys). Arabic: right to left + universal composer, layout mirrored. Previews draw the same plan and follow what you type.
- Host op `text.create` (one text layer, one Undo group, measured size back).
- AE Self-Test: *Template: Lower Third* and *Template: Arabic Lower Third* (positions vs `templates.js` with AE's own measurements).
### Fixed (found by this release's audit)
- On a short library page the sticky Apply / Build bar is not at the bottom, so the assistant button (lifted above where the bar usually is) covered the bar's button — 6 Build clicks hit it. The bar now keeps the button's corner free on its side (`fab-right` / `fab-left`), wherever it is. Every library page.
### Tests
- `tests/templates.test.js` (6); self-test checks pass on the mock (0 px). **Mock / preview, not After Effects.**

## [0.48.0] — 2026-11-04 — Combined Moves
Details: `docs/features/COMBINED_MOVES.md`.
### Added
- **Quick Animate**: *Also fade* (Opacity on the move's timing), *From / to* for Scale (zoom from 130 %, grow from 60 % …; the overshoot dips under the rest when coming from bigger), *Angle* for Spin (the overshoot scales with it).
- **12 combined presets** (Animate 33 → 45): Rise + Fade, Slide + Fade In, Drop + Fade, Zoom Fade In, Grow + Fade, Pop + Fade, Swing In · Sink + Fade, Slide + Fade Out, Zoom Fade Out, Shrink + Fade, Swing Out — each previewing its real keys (move + fade).
### Tests
- `tests/combined.test.js` (3): every preset's keys on the mock = the plan (move, fade, timing, distance, rest pose, restore); defaults keep v0.47 presets unchanged. **Mock / preview, not After Effects.**

## [0.47.0] — 2026-11-04 — Real Previews
Details: `docs/features/REAL_PREVIEWS.md`.
### Added
- Every Animate tile plays **the keys its tool writes** — real duration, AE ease (influence → bezier), the overshoot key at 72 %, Cascade's stagger, Trim Paths' lag and hold — instead of a generic look-alike.
- The Inspector preview **follows your settings** (Duration, Ease, Overshoot, Stagger, Lag, Hold) live, with a **key strip**: the keys in time, the playhead and *0.60 s · snappy · overshoot*.
### Changed
- `quick.animate` / `quick.trimPaths` build their keys from `features/quick/animatePlan.js` (the same plan the previews draw).
### Tests
- `tests/realpreview.test.js` (4): keys written on the mock = the plan (every ease, overshoot, all trim modes); `valueAt` behaviour. **Mock / preview, not After Effects.**

## [0.46.0] — 2026-11-04 — Select Modifiers + Sidebar Menus
Details: `docs/features/SELECT_MODIFIERS.md`, `docs/features/SIDEBAR_MENUS.md`.
### Added
- **MOE sidebar menus under Select**, one job each, used from any tab, in the order of the work: **Parent & Link** (To Null · Chain · Delay · Stare), **In / Out** (Fade · Pop · Slide · Spin with In and Out side by side, Draw On), **Loop** (Cycle · Ping-Pong · Offset · In + Out, Idle: Wiggle · Float · Pendulum · Pulse). Rule: one job, many times a day, labelled rows, at most five — never a whole tab (that is what v0.45 removed).
- **Shift-click adds, Alt-click removes** on the 12 Select filters (Type · Same) — on Home (Bento, Glass, MOE), the MOE Select menu, the sidebar and the Quick Bar, like the Select page and After Effects. One rule in `bar.withMods`; the label and toast say the variant ("Select Text Layers (add)").
- A quiet *Shift add · Alt remove* line under the Select rows and in the MOE menu; tooltips say it on each button.
### Changed
- Quick Bar / sidebar: Alt-click on these 12 buttons removes instead of opening options (right-click still opens them, for every button).
### Tests
- `tests/selectmods.test.js` (4), `tests/norepeat.test.js` sidebar-menu rule; audit-arrange 68 screens (new menus at 4 widths) all 0 + Playwright in all three styles, read back from the mock's selection. **Mock / preview, not After Effects.**

## [0.45.0] — 2026-11-04 — No Repeats
Details: `docs/features/NO_REPEATS.md`.
### Removed
- **MOE sidebar: 9 of 10 menus.** AI (= the floating Assistant button + the search box), and Keys, Layer, Text, Shape, Comp, Design, Layout, Finish — each was its tab again, which already has the tools, a ▾ quick menu and the selection dot. **Select stays** (its own place, v0.44). The sidebar is Select + your Quick Bar + Customize.
- **NOW copies** (Bento, Glass): the Search and Assistant tiles; tiles the Motion Control above already gives (Out Expo / Out Back = curve chips, Easy / Linear / Hold, Anchor Bottom = a dot, Align / Distribute = the align row). The ease ones come back when the control is folded. Glass NOW also skips what the open groups of its space show.
### Fixed
- Library tile keys cut the name (`t-${id.slice(3)}`: Fade In, Rise In, Cascade In were all `t-eIn`) → `t-<library>/<id>`.
### Tests
- `tests/norepeat.test.js` (5); `node tools/audit-repeat.js` (84 screens: v0.44 had 44 repeats, v0.45 has 0). **Mock / preview, not After Effects.**

## [0.44.0] — 2026-11-03 — Find Fast
Details: `docs/features/FIND_FAST.md`.
### Added
- **Select out front**: a *Select* group first in the Layer tab / Arrange stage — Type (Text, Shapes, Solids, Nulls, Pre-Comps, Footage, Adjustment, Cam & Light) · Same (Type, Source, Label, Name) · Comp (All, Invert, None, Back) — and its own first menu in MOE. `select.layers` gains same / all / invert / none, footage and cameras & lights; new `select.step` (Back / Forward).
- **Text animators one click**: In / Out rows of the everyday Arabic-safe presets + Remove.
- **Ctrl+K**: every one-click button is a result; Arabic queries use the assistant's words.
### Changed
- Look-alike names: Center Anchor merged into Anchor → Centre (migrates); Select Same → Same Property; Clone Keys → Copy Keys; Repeat → Ring Copies (tool: Static Copies); Look Near → Face Near; Look from Words → Grade from Words; Reveal → Reveal in Project; text preset Typewriter → Type On.
- Bento action groups read like Classic: tiles, labelled rows, chips, then the page link.
### Fixed (found by the audits of this release)
- `text.animate` refused its own default (Duration 0 = preset duration, but minimum 0.1) — every caller without a duration failed (new text buttons, Assistant / Copilot); minimum is now 0.
- A failed button said only "failed": it now gives the errors, else the checks that failed (e.g. "Cam — skipped: camera").
- After Build Grid, *Your grid* scrolled into view whenever the host answered — with a slow host seconds later, moving the page under a pointer aiming elsewhere (stress: Home 4–5/20 in some runs), and its smooth scroll was cut off by the next render. Now one instant scroll, only within 4 s of the build's start and only if nothing was pressed since.
### Tests
- `tests/findfast.test.js` (8); audit-arrange 84 screens, all 0. **Mock / preview, not After Effects.**

## [0.43.0] — 2026-11-03 — Smart Arrange
Details: `docs/features/SMART_ARRANGE.md`.
### Fixed
- Bento mixed groups and split pairs (`grid-auto-flow: dense` filled gaps with tiles from the next group — *Parent chain* landed in *Transform*, Flip H and Flip V on different rows). Tiles are now placed by `arrange.pack`: order kept, families on one row, every row full; no dense flow.
- Wrapping rows in Classic / Glass / MOE and the MOE menus could break a pair over two lines; Glass's NOW strip had Loop Cycle and Ping-Pong apart.
- The *Next* row (Bento / Glass NOW) came and went above the tiles and changed height, moving them while you aimed: it is now one fixed-height line **below** the tiles, shown once anything has run (*Last: … · Repeat F4* when nothing usually follows).
- `npm run stress` waits for a scroll to finish before aiming (Build Grid scrolls its panel into view once, by design).
### Changed
- `app/ui/arrange.js`: tool families (Flip, Align, Distribute, Anchor, Interpolation, Curves, Copy keys, Loop, Fade, Pop, Trim, Parent, Project, Text, Guides, Zoom, Clean up); `group` / `runs` / `pack`.
- Bento: a declared pair is one tile (*Flip — Horizontal · Vertical*); long names take two lines.
- Keys tab: Reverse / Mirror / Clone became a labelled **Keys** row; Parent Null + Parent chain both primary; a three-item row stays on one line.
- MOE *Layer* menu: + Flip V, + Distribute V. Default Quick Bar (new installs): + Flip V, the rest after Alt+1…0 ordered by family.
### Tests
- `tests/arrange.test.js` (5) and `tools/audit-arrange.js` (80 screens: 3 styles + menus + Kit × 4 widths) — 0 split families, 0 tiles outside their group, 0 holes, 0 cut labels. **Preview, not After Effects.**

## [0.42.0] — 2026-11-03 — Bake to Keyframes
Details: `docs/features/BAKE.md`.
### Added
- **Bake to Keyframes** (`rig.bake`): select a `MOE Grid` null (its items), a `MOE Trail` null (its copies) or rigged layers — every live MOE expression (optionally every expression) becomes keyframes over the work area or the whole comp. *Only what is needed* keeps a LINEAR key only where a straight line would miss the motion (0.005 px / % / °, colour 0.0005); values that never change become plain values; HOLD for checkboxes / menus. All values are read before anything changes; limits 120,000 reads / 40,000 keys with a clear hint above them. Restore puts back every expression and the keys that were under it.
- Host ops `bake.scan`, `bake.sample`, `bake.write`, `bake.restore` (`host/ops/bake.jsx`; `Property.setValuesAtTimes`).
- Motion Kit › Clean up › **Bake** (Alt = one key per sample) and Keys tab › **Bake keys**; a MOE *bake* icon; Arabic search words.
- Self-Test: a **bake** check (16 checks) with the bake time in ms.
### Tests
- `tests/bake.test.js` (7). Mock: `setValuesAtTimes`, `isInterpolationTypeValid`. **Mock / preview, not After Effects** — the Self-Test checks it in AE.

## [0.41.0] — 2026-11-03 — Clone Trails
Details: `docs/features/CLONE_TRAILS.md`.
### Added
- **Clone Trail** (`grid.trail`): N copies of the selected animated layer below it, each replaying its motion k × Delay frames later — Fade, Scale Step and Rotate Step per copy, live on a `MOE Trail N` null; copies are unparented and follow the source's comp point (`toComp`), expressions tagged `// MOE Trail`. Tiles **Echo Trail**, **Ghost Trail**, **Spin Trail** (Clone mode: 15).
- Self-Test: a **trail** check (15 checks).
- Search: Arabic words for trail / echo / ghost.
### Tests
- `tests/clone.trail.test.js` (4): a 5-copy trail = `trail.js` at 4 times, live Delay, restore; parented source; refusals; tiles. **Mock / preview, not After Effects** — the Self-Test checks it in AE.

## [0.40.0] — 2026-11-03 — Self-Test inside After Effects
Details: `docs/features/SELF_TEST.md`.
### Added
- **Diagnostics › Check in After Effects**: a confirm step, then 14 checks in a temporary `MOE Self-Test` comp — Grid, Cloner, Effector, Spring, Target, Noise Field, Image field (Gradient Ramp + sampleImage), Clone Colours, Points (elliptical mask), Text Cloner (Latin and Arabic), the Convert Audio to Keyframes command, the expression engine, and a speed read (48 clones, plain vs Spring). Each check compares what After Effects computed (`props.values`, `layers.bounds`) with the reference maths and undoes its tool (the undo is checked). The comp and its unused solids are removed and your comp reopened, in `finally`. *Copy report* gives the JSON to send.
- Host ops `selftest.begin` / `selftest.addText` / `selftest.commands` / `selftest.end`.
### Tests
- `tests/selftest.test.js` (4): all checks pass on the mock and the user's comp is untouched; an injected maths fault is reported as a failure; a failing tool fails only its check; the card. The whole self-test ran from Diagnostics in the panel preview (0 JS errors). **The run that matters is the owner's, in After Effects.**

## [0.39.0] — 2026-11-03 — Live Preview for Effectors
Chosen by the owner before the in-After-Effects self-test. Details: `docs/features/LIVE_PREVIEW.md`.
### Added
- **Live Preview** in every Effector's Inspector: a sample grid (or your own — *Use my grid* reads it once) and the null you drag with the mouse; items answer with the same maths as the expressions (`features/grid/sim.js` → `effectors.applyAt`): falloff overlay, Spring / Inertia from the recorded drag path, Target arrows, Delay replay, Noise / Image fields, colour tint. *Sweep* and *Reset*; Audio and Image use labelled stand-ins.
- Grid Builder preview draws **Points** (sample star) and **In Place** (sample words / letters) with the real layout maths.
### Fixed (found by the new tests and the button audit)
- A click in the preview slid the null from its last point instead of jumping there.
- *Use my grid* read the items' positions before their expressions — now the evaluated positions (`props.values`).
- Sweep and Reset gave no visible feedback (the audit's 2 dead clicks): the preview label says what the null does, Sweep is an on / off switch, Reset stops it and is disabled at rest.
### Tests
- `tests/cloner.preview.test.js` (4): still null = `applyAt` for four falloffs / types, a jump overshoots and settles (Inertia trails), bounded history, sweep / grab, own-grid sizing, wiring. Browser: the preview was dragged in the panel preview (0 JS errors).

## [0.38.0] — 2026-11-03 — Field Effectors
Next advanced tool after the Object & Text Cloner. Details: `docs/features/FIELD_EFFECTORS.md`.
### Added
- **Noise Field** falloff: a value noise drifting through the grid decides who an effector reaches (Size = patch size, Softness = edge, Field Speed = drift, Seed; moving / turning / scaling the null moves the field). Tiles **Noise Grow**, **Noise Flicker**.
- **Image** falloff: the brightness of a layer under each item (`sampleImage`, Rec. 709 luma × alpha) is its weight; the Field Layer is picked from the selection. Tiles **Image Grow**, **Image Reveal**.
- Both work with every effector Type, Spring and the Clone Colour tint.
### Changed
- Effectors mode: 20 tiles (five full rows). Effector nulls gain Field Layer / Field Speed (older effectors never reach these falloffs).
### Tests
- `tests/field.effector.test.js` (4): Noise Field mock = reference at three times, drift, hard edge; Image from a gradient layer = reference, brighter → bigger, colour tint follows; refusal; tiles. **Mock / preview, not After Effects.**

## [0.37.0] — 2026-11-02 — Object Cloner & Text Cloner
Next advanced tools after Target & Audio. Details: `docs/features/OBJECT_TEXT_CLONER.md`.
### Added
- **Points** layout (Object Cloner): one item on each point of a shape path / mask (`points()`), Point Offset live on the grid null, Face Center turns along the path; one selected layer + one shape → one copy per point (the shape is picked as the path). Tile **Clone on Points**.
- **In Place** layout + **Split text** (Text Cloner): host op `text.split` turns one text layer into `MOE Word n · <layer>` / `MOE Letter n · <layer>` layers placed exactly where the words were (measured with sourceRectAtTime, any justification, right-to-left, multi-line, scale and rotation); Arabic by words only; the original is hidden and comes back on Restore (`text.unsplit`). Tiles **Text Cloner**, **Letters Rise**.
### Changed
- Layout / Morph To menus: 8 layouts (new grids). `paths.find` returns the point count. In Place grid nulls are anchored on their position (no jump when parenting); In Place read-back measures every item's comp box before and after.
- Clone mode: 12 tiles.
### Tests
- `tests/object.text.cloner.test.js` (6): Points = `layouts.place`, Point Offset, refusals; words centred 2 lines and Arabic RTL 50 % — every piece's comp box = its word in the original; Letters Rise + a sweeping Effector; keyed text refused; tiles. The mock measures text with a simple metric. **Mock / preview, not After Effects.**

## [0.36.0] — 2026-11-02 — Target & Audio Effectors
Next advanced tools after Spring / Inertia. Details: `docs/features/TARGET_AUDIO_EFFECTORS.md`.
### Added
- **Target** effector type: the clones turn the short way to face the effector null (Rotate = aim offset), weighted by the falloff, with Spring if on. Tiles **Aim**, **Look Near**.
- **Audio** effector type: MOE runs After Effects' Convert Audio to Keyframes on the comp's sound layer (`audio.amplitude` host op → `MOE Audio · <layer>` at the bottom, reused), links it on the effector (Audio Layer, Audio Max) and every move follows the loudness, each clone Delay frames later. Tiles **Beat Pulse**, **Beat Wave**. No sound → refused with what to do.
- Search: Arabic words for music / sound and "face / look at" find these effectors.
### Changed
- Effectors mode: 16 tiles (four full rows). `layers.describe` reports `hasAudio`.
### Tests
- `tests/target.audio.test.js` (5): Target aims at every time (mock = reference, +X axis on the effector), Target + Spring, Audio follows the amplitude with per-item delay, reuse + restore, refusal. **Mock / preview, not After Effects** (Convert Audio to Keyframes is mocked).

## [0.35.0] — 2026-11-02 — Spring / Inertia Effector: clones with weight
Next advanced tool (after Cloner + Effectors and Clone Colours). Details: `docs/features/SPRING_EFFECTOR.md`.
### Added
- **Spring / Inertia** on every MOE Effector: Spring %, Frequency (Hz) and Decay live on the effector null. The items follow the effector through a damped spring — they overshoot and settle — or, at Frequency 0, trail behind it with a smooth Inertia lag. A real step-response sum over the effector's own past (≤ 3 s, ≤ 60 samples), the same maths in `effectors.js` (reference) and the item expressions.
- Tiles in Effectors: **Spring Grow**, **Jelly**, **Inertia**, **Bounce Up** (Effectors mode now 12 — three full rows).
### Changed
- Grid item expressions compute each effector through one function of time (`TQ`), so the spring can sample it; with Spring 0 the result is the v0.33 / v0.34 maths. Effectors made before v0.35 (no Spring control) are read with `try` and behave as before.
### Tests
- `tests/spring.effector.test.js` (5): step response, bounded window, mock-evaluated items = reference at 7 times on a sweep, overshoot past the direct result and swing past the rest, Inertia never overshoots, old effectors unchanged, tiles. **Mock / preview, not After Effects.**

## [0.34.0] — 2026-11-02 — Clone Colours: a colour for every clone, effectors that tint
Next advanced tool after Cloner + Effectors. Details: `docs/features/CLONE_COLOURS.md`. Also: an animated product demo of Cloner + Effectors (`marketing/demos/cloner-effectors/`, Stageshow).
### Added
- **Clone Colours** (`grid.colour`): Cycle · Gradient · Random over a grid's items from a MOE palette; Colour Mode, Colour 1–4 and Colour Seed live on the grid null (edit the palette in Effect Controls); one *MOE Clone Colour* Fill per item, updated in place; restore removes them. Tiles: Colour Cycle, Colour Gradient, Colour Random.
- **Effector Colour + Colour Mix**: the items an effector's falloff reaches blend toward its colour (same falloff maths as the moves). Tiles: **Tint** (white sphere sweeping across) and **Shrink**.
### Changed
- Layer › Arrange · Clone · Effectors: Clone mode 9 tiles (6 clones + 3 colour), Effectors 8 (Grow, Shrink, Reveal, Scatter, Step, Wave, Cascade, Tint) — full rows.
### Tests
- `tests/clone.colour.test.js` (4): mock-evaluated Fill colours = `effectors.js` for every mode, live palette change, soft sphere and linear tint at three times, update in place, restore, refusal. **Mock / preview, not After Effects.**

## [0.33.0] — 2026-11-01 — Cloner + Effectors (MoGraph in After Effects)
The owner pointed at aescripts mCloner Pro: add advanced tools for professional results. Details: `docs/features/CLONER_EFFECTORS.md`.
### Added
- **Cloner** (`grid.build` → *Clones*): one selected layer (or a few) → N copies (`MOE Clone n · <layer>`, keyframes and effects kept, sources cycle) on a live MOE Grid. Tiles: Clone Grid 5×5, Row, Ring, Spiral, Sunflower, Globe. Restore removes the copies.
- **Effectors** (`grid.effector`): a **MOE Effector N** null with 15 live controls — Type (Plain · Random · Step · Noise · Delay), Falloff (Sphere · Linear · Box · Everywhere), Size, Softness, Strength, Invert, Move X / Y, Scale, Rotate, Fade, Seed, Delay, Noise Scale / Speed. Move, rotate or scale the null to animate; up to three per grid (they stack); *Sweep across* keyframes it over the grid in 2 s; Delay keyframes the moves to rest and each item plays them later. Tiles: Grow, Reveal, Scatter, Step, Wave, Cascade.
- Grids from v0.19–v0.32 are upgraded in place when an effector is added (item expressions rewritten from their own facts — nothing moves).
### Changed
- Layer › **Arrange · Clone · Effectors** is one block with a switch (one layer → Clone, a grid → Effectors, several layers → Arrange); Layout & Grid modes add **Clone** and **Effectors**. The static *Repeat* chip left the tab (Clone is the live version; Repeat stays in the Quick Bar catalogue).
- Power card **Cloner & Effectors**; *Next* after a grid: Reveal · Wave · Cascade · Pre-compose; the Assistant understands كلونر / موجراف / إيفكتور / موجة.
### Tests
- `tests/cloner.effectors.test.js` (6): every type and falloff — mock-evaluated expressions equal `features/grid/effectors.js` (position, scale, rotation, opacity; sweep at five times; rotated effector; Delay frames; inverted Box), Cloner order + restore, upgrade facts, three slots and a refused fourth. **Mock / preview, not After Effects.**

## [0.32.0] — 2026-11-01 — Library pages: settings where you click, modes instead of a wall
The owner: continue the same approach on the library pages. Details: `docs/features/LIBRARY_PAGES.md`.
### Changed
- **Settings where you click**: the Inspector sits beside the tiles from 600 px (was 760); narrower it opens right under the clicked tile's row (click again or ✕ to close; the sticky bar's *Settings* toggles it). Same in Shapes & Icons. Before, it was under the whole library (~1,100 px down on Motion).
- **Modes instead of a wall**: Motion shows **In · Out · Draw On · Proximity** (12 / 8 / 4 / 2 instead of 33); the 7 ease tiles are one click away (*Ease ›* → Motion Control) and still found by search. Layout & Grid: **Arrange · Guides · Cells**. Search covers every mode.
- **Icon-only tools are rows** with what they do (Compositing); **filters on one line** with *Mine* first (Backgrounds 3 rows → 1); **columns fit the count** (no tile alone on a row; two columns docked); the how-to line goes after three applied presets.
- **Quick Bar · Customize**: one-line rows with ★ in two columns (was 60 px picture tiles).
### Tests
- `tests/library.pages.test.js` (5): modes and their tiles (every Layout tile in one mode, Motion's outside tiles are the ease presets), `stateOf` lands on a mode, columns divide the count, inline / beside Inspector and icon rows, the how-to line rule. `tests/studio-ui.test.js`: a tag is a chip or a mode. **Mock / preview, not After Effects.**

## [0.31.0] — 2026-11-01 — Space follows content, in every tab
The owner: continue the Motion Control approach and analyse every remaining tool — space by content, merged by job, ordered by the work. Details: `docs/features/SPACE_FOLLOWS_CONTENT.md`.
### Changed
- **25 groups → 15**, same tools: *Animate In* + *Animate Out* + *Draw On* = one **Animate In / Out** block with an *In · Out · Draw On* switch (shapes open on Draw On, your choice kept); *Keyframe Assistant* + *Loops* = **Keyframes & Loops** (a *Loop* line: Cycle · Ping-Pong · Offset · In + Out); *Keying* + *Color Correction* = **Key & Color** as buttons in the job's order (Screen Key, Analyze, Match, Grade, Look); *Deliver* + *Project* = **Deliver & Project**; Vignette joined Camera & Zoom; Trash MOE rigs joined the project chips.
- **Motion Rigs merged**: Excite / Jump are Inertia / Bounce Land with the new **Sliders** switch on Expressions (numbers on Slider Controls); Delay and Stare stay in Parent & Link; Repeat moved to Arrange.
- **No repeats of the Motion Control**: Easy / Linear / Hold, Center Anchor and the Curve Library group left the tabs (they are in the Motion Control row, the anchor grid and its ⊞ chip). Flip ↔ / ↕ is one control.
- **Motion Control follows the selection**: the full graph when keys are selected; with layers only, the compact strip (curve · Copy / Paste ease · anchor · align) — ~200 px instead of ~690 at 420 px; open / fold remembered per kind of selection.
- **Empty Recent takes no space**; **tile grids fit their count** (4 in a row, 6 in 3 × 2, 9 in 3 × 3; one row of 6 on a wide panel; 2 columns docked) — no tile alone on a row; the "for selection" badge hides on a docked panel.
- Stages follow the merged groups (Animate: Animate In / Out → Keyframes & Loops → Text → Expressions; Finish: Key & Color → Camera & Zoom; Deliver: Deliver & Project). Customize Quick Bar and My tools are in the ≡ menu.
### Tests
- `tests/space.content.test.js` (6): 15 groups by tab; no tool twice and every ref resolves; the tabs do not repeat Motion Control tools; tile columns divide the count; Animate modes (shapes → Draw On, saved choice, bad value); Motion Control focus rule, empty Recent, Deliver lead, Flip pair, ≡ menu. Updated: tiers on preset groups, Key & Color, stage order. **Mock / preview, not After Effects.**

## [0.30.1] — 2026-11-01 — Motion Control: no empty space, Ease Copy you can find
Owner's review of v0.30 (screenshot, Glass): empty space beside the anchor point, and the copy / paste ease buttons were not found.
### Changed
- **The rail fills its space**: it is as tall as the graph; the anchor grid takes what align leaves (dots spread over the rail's width), the align buttons fill their rows, Masks sits on the anchor's title line. Beside the graph only from 560 px; under it (anchor + align side by side) from 330 to 560 px; anchor above align under 330 px — never cut, never stretched. Same in Bento, Glass, MOE and the docked Motion Kit.
- **Ease Copy is named**: *Copy ease* / *Paste ease* buttons with Lucide clipboard icons (the old paste icon read as a bin) and what is copied beside them ("2 segments", the curve) — in the open block and in the folded strip.
- Curve presets fill their row (no half-empty last line of fixed-width chips).
### Tests
- `tests/motion.control.test.js` +1: named Ease Copy buttons (open + folded), clipboard icons, anchor grid fills the rail, rail under the graph below 560 px. **Preview, not After Effects.**

## [0.30.0] — 2026-11-01 — Motion Control: graph + anchor + align, Ease Copy, Next
The owner: the anchor (a tiny cube) and align (small buttons) belong inside the speed / value graph control, sized by their content and fitted to each style; that part should copy and paste the ease of keyframes like Ease Copy; and tools should follow their function and the sequence of the work. Details: `docs/features/MOTION_CONTROL.md`.
### Added
- **Motion Control**: one block — the speed / value graph with a rail beside it holding the anchor 3×3 and align (under the graph in a narrow panel); folded, it is a compact strip with Copy / Paste ease and anchor + align in one row. On top of every style: Bento NOW, Glass Now card, MOE above the tab's groups, the docked Motion Kit.
- **Ease Copy** (`motion.pasteEase`): Copy reads the ease of the selected keys segment by segment (normalised, so it fits any property and distance); Paste gives segment n curve n (a shorter copy repeats; hold segments kept); In / Both / Out; verified by read-back, History › Restore.
- **Next**: after a run, the steps that usually follow it (animate in → shape the ease → stagger → animate out …), one click each, in all three styles (`workflow.NEXT`).
### Changed
- The separate Ease, Align and Anchor Point groups left the tabs and the stages (they are the Motion Control). The Power card "Ease & Speed Graph" is now "Motion Control".
### Tests
- `tests/motion.control.test.js` (6): clip parsing; per-segment paste (10 / 90 / 60 / 30 % influences), one-segment clip everywhere, ease out only, restore; hold kept and speed recomputed for another distance (40 px/s); Paste Ease lives in the Kit and is not AI-callable; one control block at the top of every style; Next lists resolve. **Mock / preview, not After Effects.**

## [0.29.0] — 2026-11-01 — Fewer, clearer: one place per tool
The owner asked what could go in exchange for an easier organisation (the anchor point as an example). The answer: the copies, not the tools. Details: `docs/features/FEWER_CLEARER.md`.
### Removed
- **Copies**: 39 Quick Bar actions that were copies of library tiles or of each other (Slide In / Out, Fade, Pop, Scale, Spin, Draw On, 17 expressions, Smart Ease, the Kit's Wiggle / Orbit / Swing / Spin) → 80 → 41 Quick actions; 4 Motion-preset tiles that copied Kit actions (Reverse, Mirror, Stagger, Gentle Ease); the Expressions page's "One-click" grid (a copy of its Library tab).
- **Six retired styles** (Classic, Apple, Sidebar, Hub, Command Bar, Workspace), the Sidebar's Smart Home, Settings › Sidebar and the old Copilot bar — about 1,360 lines. A panel that had one opens in Bento (one notice).
### Changed
- The Quick Bar can hold any library preset **as the tile itself** (☆ next to Apply in the library); the default bar's presets are tiles. Old ids in saved bars, pins, My pie and Recent migrate automatically (`bar.MIGRATE`).
- Motion Kit › Motion rigs: Excite, Delay, Jump, Stare, Repeat (Orbit / Spin / Swing / Wiggle are the expression presets, with Live controls in their options).
- NOW: the Anchor Point is half width (2×2) for single layers; Finish › Keying shows Key Setup (Generate on Green stays in the Compositing library and search).
### Fixed (found by the v0.29 audit)
- On library pages the floating assistant button covered the sticky Apply button → it sits above the Apply bar. Ctrl+4 lit the stage above Finish after the jump → the stage you jump to stays lit while it is on screen.
### Tests
- `tests/fewer.test.js` (5): no Quick action copies a tile or another action; every old id migrates and resolves (bars dedupe old + new ids, pin / unpin from the library); tile buttons carry the tile's tool, numbers, label, icon; rigs and Keying; three styles, the removed code is gone. Updated layouts / kit / transform / brand tests. **Mock / preview, not After Effects.**

## [0.28.0] — 2026-10-31 — Organised the way you work + the Assistant
The owner: the tools were arranged "like a bot that memorised a menu"; he asked for an organisation built on how a motion artist with years in AE really works — big explained cards for important things, everyday tools bigger and first, secondary and rare ones treated as such, fast access, useful shortcuts, an AI agent inside AE as a floating assistant, and many projects of different shapes and sizes. Design: `docs/features/WORKFLOW_HOME.md`, `docs/features/ASSISTANT.md`.
### Added
- **Assistant** — a floating button in the corner of every style (` or Ctrl+Space; right-click: other corner). Ask about After Effects / motion / MOE in Arabic or English and/or describe a change: Claude answers and plans with MOE tools (`core/ai/assistant.js`, one structured reply: answer + steps); steps are re-validated, approved, verified, rollback / save as tool. Conversation follow-ups (last 6 turns). **Offline / no key**: words (Egyptian Arabic phrases included) → matching Power card + best tools and presets, one click away. **Suggestions** for the selection as a number on the button (stagger, curve, brand, social safe area, empty comp) — never a pop-up.
- **Stages** — Animate · Arrange · Design · Finish · Deliver, ordered by how often a motion designer is in them; everyday groups open, rare ones behind *More in <stage>*. Bento index chips and **Ctrl+1…5**; Glass's spaces are the stages.
- **Power tools** — eight deep features as big cards (what · when · needs · 3 steps · one-click try · open) that shrink to chips after 3 uses or ✓; ≡ › *Explain the Power tools again*.
- **Everyday** — the Quick Bar's first ten = Easy Ease, Out Expo, Center Anchor, Parent to Null, Pre-compose, Stagger, Loop Cycle, Wiggle, Reverse Keys, Duplicate Comp; **Alt+1…0** runs them (hold Alt to see the numbers).
- **Format chip** in NOW (9:16 · HD · 30 Reels / TikTok / Shorts, 4:5, 1:1, 16:9, wide; HD / 2.5K / 4K; pixel aspect respected) and a comp-sized **social safe area**.
- **Each AE project remembers its client** — switch projects and the client follows (toast).
### Changed
- Default Quick Bar: everyday tools first; Reveal / Open Folder / Purge left the default (Deliver › Project, search). Customised bars are kept.
- The bottom "Describe a change…" bar became the Assistant; *Copilot* is called *Assistant* in menus and the pie.
- Shortcuts sheet ordered by distance (Alt+1…0, F4, Q, `, Ctrl+K, Ctrl+1…5 …). Glass: Ctrl+1…5.
### Fixed (found by the v0.28 audit)
- The open Assistant covered controls → it opens as a drawer at the bottom (page shrinks above it). Ctrl+1…5 lit the wrong stage chip during the scroll. Empty *Send* gave no feedback.
### Tests
- `tests/workflow.home.test.js` (11): every group placed once, core before more, page → stage; Everyday = default bar, Alt slots run; Power cards resolve and learn; formats (vertical / portrait / square / 4K / wide / anamorphic); safe area accepted by the guides tool on a 9:16 mock comp; suggestions + per-comp dismiss; project → client memory (switch, untitled, deleted client, cap 60); Arabic whole-word keywords; assistant request shape (answer + plan schema, history cap, deterministic system prompt, format as data) and no-key error; shell wiring. **Mock / preview, not After Effects.**

## [0.27.0] — 2026-10-31 — Thick Glass (Glaze-class)
The owner asked for something like aescripts Glaze, in a suitable place, implemented with high precision. Study and design: `docs/features/THICK_GLASS.md`.
### Added
- **Thick Glass** (`glass.thick`) in Design › Looks & Glass (filter *Thick*): thick refractive glass from any shape, text, logo or footage alpha — CC Glass refraction of what is behind, bevel, frost, chromatic dispersion (Prism R / B), reflection / chrome, studio highlights (light angle, height, colour, highlight size, edge light), soft shadow and caustics. 21 animatable controls on *MOE Glass N*; seven looks: Thick Clear, Prism, Sugar Glass, Bubble, Arctic Ice, Chrome, Liquid Gold; tint from the Brand Kit; parts can be switched off.
- **Live height map** (`MOE Glass N Map` pre-comp, host op `glass.map`): a white copy of the source linked by expressions — transform through `toComp` (parents, keys and flips included), shape paths / masks / text / time remap by property index — so the glass stays exactly on the shape and follows edits of the original.
- **One piece** (one glass for all): several layers refract as one piece (one map, one stack; shadow / caustic per layer).
- **Thick Glass Look** (`glass.thickLook`): change look / tint of an existing thick glass, controls only.
### Changed
- Looks & Glass shows the thick looks first; the Design tab's Looks & Glass group shows Thick Clear, Prism, Chrome, Liquid Gold, Frosted, Liquid. Flat Glass Look refuses a thick glass (and says which tool to use).
- `effects.ensure` accepts layer parameters (`layerRef`); `layers.setAttrs` accepts Lighten.
### Tests
- `tests/glass.thick.test.js` (9): stack order, mattes, blend modes, every CC Glass reads the map; controls drive and clamp effect values; the map copy lands on the source to 1e-6 px with a rotated / scaled parent, a flipped and rotated child and animated position; a path edit reaches the map; one glass for two layers (bounds centre); dispersion scale vs the plain-JS reference and light direction; restore removes layers and the map comp; nothing left when CC Glass is missing; looks; 3D refused. **AE mock, not After Effects — CC Glass parameter names are unverified (TEST_REPORT 162).**

## [0.26.0] — 2026-10-31 — Brand in action
Next Roadmap step (M1.30): use the client's brand in the comp. Details: `docs/features/BRAND_IN_ACTION.md`.
### Added
- **Apply Whole Brand** (`brand.applyAll`): selection or whole comp — fonts by script (Arabic + RTL / English), text colour by role (headline / body), shapes primary · secondary · accent, the background solid via *MOE Brand Fill*; colours by role contrast-checked against the background (4.5 : 1 body, 3 : 1 headlines); verified, one Undo, History › Restore.
- **Active client** (the one shown on the Brand page or just imported) and brand actions everywhere: Brand page *Apply brand · Brand whole comp · Brand ease · Make backgrounds*, Design › Brand group (primary action), Bento NOW and Glass Now when layers are selected, search and My pie (`brand:apply`, `brand:applyComp`, `brand:ease`).
- **Brand backgrounds**: saving a client from a website / PDF adds its gradients, a *Brand glow* and a drifting *Soft mesh* to Backgrounds › Mine (saving again replaces them). The Background and Colorize tools gain a **Custom / brand colours** palette (2–5 hex).
- **Brand ease**: the brand's motion feel → the matching ease preset.
- MOE sidebar: drag shortcuts to reorder the Quick Bar. Bento: drag pinned NOW tiles to reorder.
### Fixed
- Tool readiness (Inspector, tiles, one-click actions) ran `prepare` without services — brand tools said "Choose a client" while one was chosen.
- "Mine" background tiles showed the original palette instead of the saved one.
### Tests
- `tests/brand.action.test.js` (6): roles and contrast (dark brands, hand-made clients), the plan (headline / body, Arabic, shapes in turn, background solid only, MOE gradients and locked layers left alone), Apply Whole Brand on the AE mock (fonts, RTL, colours, Brand Fill, shared solid untouched, full restore), whole comp with nothing selected and refusals, brand backgrounds accepted by the Background tool and never duplicated, brand ease and the active client. Playwright: import → backgrounds in Mine → Apply brand from the Brand page (verified) → brand tile in NOW; drag reorder in the MOE sidebar. **Mock / preview, not After Effects.**

## [0.25.0] — 2026-10-31 — Bento · Glass · MOE, and Brand from website / PDF
The owner kept three styles and asked to study them again with all their tools and upgrade each — MOE with every shortcut in a sidebar — and asked for Brand import from a client's website or PDF via the API. Studies: `docs/features/STYLES_V2.md`, `docs/features/BRAND_IMPORT.md`.
### Added
- **Brand from website / PDF** (`brand.fromSource`): website read safely (HTTPS only, size-capped, nothing executed: colours by use, CSS variables, fonts, font links, logo) or a PDF brand book (document block); Claude returns name, colours with roles, gradients, fonts, tone, motion feel, rules (structured output, re-validated); fonts matched to installed fonts (Bold for headings; *Get font* link or free fallback when missing); review card → Save client / Edit first. Local scan without AI for websites. Saved clients show their tone, motion, gradients and fonts to install.
- **MOE sidebar**: the 9 menus by object (lit for the selection) and the whole Quick Bar in a left sidebar instead of two rows on top; ⇔ shows names; right-click a shortcut for options.
- **Bento**: right-click a tile to pin it to NOW (up to 4); fold a section by its title; the index follows the scroll.
- **Glass**: Ctrl+1…4 between spaces; fold the Now card; Settings › Glass blur on / off.
- `platform.http.get` (HTTPS-only, redirects checked, streaming size cap, timeout, binary for images).
### Changed
- **Bento is the default.** Settings › Panel style: Bento · Glass · MOE. Classic, Apple and Sidebar are retired from the lists (still work for anyone who had picked one).
- Bento glows and the Glass colour field follow the accent colour (were fixed to orange).
### Tests
- `tests/brand.import.test.js` (9): addresses, script content ignored, colours / fonts / logo / font links, local proposal, Claude answer re-validation, font matching, website and PDF end to end with mocked web / Claude / AE, no-key fallback, site errors. `tests/layouts.test.js`: MOE sidebar holds every shortcut, Bento pins (max 4, stale pins ignored). Playwright: MOE sidebar narrow / wide and menus, Bento pin / fold, Glass fold / Ctrl+3 / accent, Brand import → review → save in the preview (demo site). **Mock / preview, not After Effects, not real websites.**

## [0.24.0] — 2026-10-29 — Three new styles (proposals): Glass, Apple, Bento
The product owner expected a different style altogether (glass, modern, Apple-like or my own idea) and a radical new organisation — not the small refinements of 0.23. Three complete proposals, each a new look **and** a new way to organise the tools, all live in the panel. Comparison and reasons: `docs/features/STYLE_PROPOSALS.md`.
### Added
- **Glass**: frosted glass cards over a deep colour field (light: pastel), floating capsule navigation at the bottom. Organised by **stage of work** — Motion · Arrange · Look · Deliver — instead of AE menus, with a **Now** card on top: what is selected and its eight best actions.
- **Apple**: macOS / iOS Settings look — large titles, inset grouped lists, coloured squircle icons, tinted primary buttons, preset shelves. Organised as a **navigation stack**: a root page (for your selection · six categories › · general) and a page per category with ‹ back.
- **Bento ★** (my proposal): near-black canvas, bento tiles. **One page, no tabs**: NOW holds the big tool for the selection (ease graph for keys, Align for several layers, Anchor for one) and the eight best actions; below, every group as bento where **size = importance** (primary 2×1 glowing tiles, standard 1×1, rare as chips, presets as a shelf); index chips jump down the page.
- Choose in ≡ › Panel layout, Settings › New styles, or the preview's toolbar. Classic stays the default until a style is chosen.
### Tests
- `tests/layouts.test.js`: Glass spaces cover the six tabs once, every page has an owning space, Apple has a category per tab, ids never collide with pages, Bento has a NOW block for every kind. Playwright: the three styles × keys / shapes selections × dark / light, 340 and 420 px — 0 JS errors. **Preview + mock host, not After Effects.**

## [0.23.0] — 2026-10-29 — Design system: icons, buttons, look, tools by importance
The product owner asked for a complete pass on icons, button style, screens, colours and placing tools by importance (size, position, consistent dimensions). Measured first, then one rulebook: `docs/features/DESIGN_SYSTEM.md`.
### Changed
- **One scale everywhere**: three control sizes (24 · 28 · 32 px), four icon sizes (12 · 14 · 16 · 20), corners 6 / 8 / pill, type 11 · 12 · 13 · 15. Measured on the six Classic tabs: button heights 10 → the scale (plus tiles and the inner segments of 24 px controls), radii 4 → 6 / 8 / pill, icon sizes 9 / 11 / 18 / 24 / 26 gone from controls.
- **Tools by importance**: each action group has primary actions first and larger (32 px, accent icon — Easy Ease, Reverse Keys, Loop Cycle, Pre-compose, Center Anchor, Parent Null, Dup Comp), standard actions (28 px), and rare ones last as small chips (Trim keys, Select Same, Open Folder, Purge Cache). A single primary action takes the whole row.
- **One icon family**: 55 generic interface icons (search, trash, settings, folder, history, refresh …) now come from Lucide (ISC, already bundled), generated by `tools/build-ui-icons.js`; MOE draws only motion-specific icons, at the same 1.5 px line. Redrawn: Fade In / Fade Out (were filled blocks), Separate XY (had tiny text).
- **Look**: Motion Rigs use the same row buttons as every action (were dark icon-over-text tiles); links are quiet text rows (were boxes that looked like inputs); menus float on a new elevated surface with a shadow; group titles 13 px; the ⠿ grip and the tab ▾ stay quiet until hovered; active tab is semi-bold; long group titles end with … instead of wrapping.
- **Tiles**: Out presets (Scale Out, Pop Out, Fade Out …) show the moment they start leaving instead of an empty frame; Scale shows its full size as a dashed ghost.
- Colours: new tokens `--bg-elev`, `--shadow-1`, `--shadow-2` for each theme; `--text-3` slightly brighter so hints stay readable on raised and elevated surfaces (contrast check now covers them: 108 / 108 pairs).
### Tests
- `tests/design.system.test.js`: the token scales, every theme defines its elevated surface, tiers are well-formed (≤ 2 primary, primary first, minor last, every ref resolves), `icons-ui.js` matches the Lucide map. 293 tests. Playwright measurement before / after on the six tabs; light 340 px and midnight 420 px: 0 JS errors, 0 overflow. **Preview + mock host, not After Effects.**

## [0.22.0] — 2026-10-29 — Classic: your group order, ▸ Recent, keyboard
Next Roadmap step after choosing Classic as the final layout (M1.26). Details: `docs/features/AE_CLASSIC_LAYOUT.md` › Your order.
### Added
- **Reorder groups**: drag a group by its header (⠿) or Alt+↑/↓ on it; saved per tab. Tab ▾ › **Reset group order**.
- **▸ Recent** in every tab: the last six things you ran from that tab (actions, Motion Kit tools, presets, ▾ menu items), newest first; one fixed-height row so nothing below moves; *Clear*.
- **Keyboard on group headers**: ↑/↓ previous / next group, Home / End, → open, ← fold.
### Fixed
- The shortcuts sheet still described the old Ctrl 1…7 (Sidebar); it now lists Ctrl 1…6 for the Classic tabs and the group keys.
### Tests
- `tests/layouts.test.js`: saved order per tab, stale / partial stored orders, default order stored as nothing, reset; Recent newest-first / no duplicates / max 6 / per tab; every ref the panel records resolves. Playwright (dev preview): Recent fills without changing height, ↓ / Alt+↑ / ← / → on headers, drag Arrange above Recent, order kept per tab, Reset from ▾ — 0 JS errors. **Preview + mock host, not After Effects.**

## [0.21.0] — 2026-10-29 — Final layout: Classic
The product owner asked to pick the two smartest layouts, develop both, compare them and choose the final style. All six were measured; Classic and MOE ★ were developed and timed on the same 12 everyday tasks (Classic 19 clicks, MOE ★ 20). **Classic is final**; MOE ★ stays optional. Details: `docs/features/FINAL_LAYOUT.md`.
### Added
- **Tab quick menu** (Classic): ▾ next to each tab, or right-click the tab — every action and preset of that tab in a two-column menu, two clicks from anywhere.
- **Ctrl 1…6** switch the Classic tabs (also in MOE ★).
### Changed
- **MOE ★** now uses Classic's tabs and twirl-down groups under its row of object menus (old cards and banners removed).
- Settings › Panel layout and ≡ › Panel layout list only **Classic · MOE ★ · Sidebar (old)**. Hub, Command Bar and Workspace are retired from the lists (still work for anyone who had picked one).
### Tests
- 286 tests pass. Button audit on the six Classic tabs incl. every ▾ menu: 768 interactions, 0 JS errors, only the expected refusals. 12-task click benchmark in the preview. Stress 20/20. **Preview + mock host, not After Effects.**

## [0.20.0] — 2026-10-29 — Classic layout: organised like After Effects
The owner felt the panel was no longer organised or familiar for a normal AE user. The new default layout borrows from AE's own panels. Design and reasons: `docs/features/AE_CLASSIC_LAYOUT.md`.
### Changed
- **New default layout, Classic**: tabs named after AE's menus — **Keys · Animate · Layer · Design · Effect · Comp** — instead of an icon-only sidebar.
- Each tab is a list of **twirl-down groups like Effect Controls** with thin dividers (▸ Keyframe Assistant, ▸ Animate In, ▸ Align, ▸ Keying, ▸ Guides & Safe Areas …), using AE's own words.
- **Search under the tabs**, like Effects & Presets (Ctrl K jumps there; Enter applies the first result).
- **≡ panel menu** in the corner (What's new, shortcuts, pie, Copilot, Favorites, History, Quick Bar, Panel layout, Settings, Diagnostics, About) instead of unnamed header icons.
- **Preset tiles apply in one click** inside the groups (right-click: settings); **All N ›** opens the full library with a crumb back. No marketing banners.
- **Smart**: a dot on the tabs that fit the selection; first open starts on the right tab; groups that fit open by themselves (*for selection*) and your open / fold choices are remembered per kind of selection. Nothing moves.
- The other layouts stay one click away (≡ › Panel layout, Settings): Sidebar (v0.15), MOE ★, Hub, Command Bar, Workspace.
### Fixed
- The tab "Animate" and the Motion presets page shared the id `animate` (All 37 › led back to the tab) — tab ids are now prefixed (found by `npm run stress`).
### Tests
- `tests/layouts.test.js`: six AE-named tabs; every page reachable; every quick action, link and preset id exists; tab ids never collide with page ids; unique group ids; a tab fits every kind of selection. 286 tests pass. Preview (Playwright): all six tabs, ≡ menu, search, text comp opens on Animate, 9-cards comp on Animate with Layer dotted, Arrange, library page + crumb back — 0 JS errors. Stress 20/20 stable. Button audit on all six tabs — see TEST_REPORT. **Preview + mock host, not After Effects.**

## [0.19.0] — 2026-10-29 — Grid Builder 2 (and moving palette tiles)
Requested by the product owner: study aescripts Grid Builder and add it professionally, smarter, without duplicate tools. MOE already had a Grid Builder (6 layouts vs their 4, auto spacing, preview, Build-in, Release / Freeze); v0.19 closes every gap found. Study and comparison: `docs/features/GRID_BUILDER_2.md`.
### Added
- **Layout switches live** — one expression holds all six layouts; the grid null's **Layout** dropdown (Effect Controls or the panel) changes it and keeps every control and keyframe.
- **Morph**: *Morph to* a second layout and blend with the **Morph** slider (0–100); *Animate morph* keyframes it at build time (after the build-in). Presets **Grid → Ring** and **Galaxy → Wall**; the preview plays the morph.
- **Orient**: Forward · Face Center (or the path direction) · Face Screen (upright while the grid spins). Old *Face center* presets map to Face Center.
- **Effector** also **rotates** and **fades** items, and a negative **Push** attracts them.
- **Items stay editable**: move a grid item by hand (or keep its Position keys) — the nudge plays on top of the layout.
- **Grid Items** (`grid.items`): reorder places — drag, ↑ / ↓, Layer order, Name A→Z, Reverse, Shuffle — without touching the layer stack; give selected items their own **Twist** and build **Delay**.
- **"Your grid" panel** in Layout & Grid when a MOE Grid (or its items) is selected: Layout / Morph To chips, Morph slider, Orient, Places, item tweaks — every change verified and undoable. Picking as Layout the layout you morph to swaps the two.
### Fixed
- Building a grid from layers that are already in a MOE Grid pulled them out of it; it is now refused with where to change that grid instead.
- Every slider's coloured fill ignored its value (CSS variables set through `h(…, { style })` were dropped); they now match (`dom.h` uses `setProperty` for `--` names).
- "Your grid" tip line overflowed narrow panels (found by the button audit).
### Tests
- New: Morph values in AE equal the pure `placeMorph` at 0 / 35 / 100 %; Layout switch keeps Spacing keyframes; Orient (Forward / Face Center / Face Screen with a rotated null); hand nudge; Effector rotate / fade / attract; Grid Items reverse / custom order / bad order refused / restore / tweak + restore; presets Grid → Ring and Galaxy → Wall verify against the pure layout; old Face center mapping; sort permutations; the rebuild guard. 284 tests pass. Panel (Playwright, dev preview): Layout chip → all items on the ring, Morph slider writes 50, Reverse / ↓ / drag reorder, Twist on selected items only, 0 JS errors. **Mock host, not After Effects.**

## [0.18.1] — 2026-10-29 — Palette tiles move on hover
Requested by the product owner: the tiles themselves move when the mouse is over them.
### Changed
- **Backgrounds tiles play the motion you picked** when you hover them (same drawing and maths as the Inspector preview and the expressions): Motion + Colours from the Inspector, your own presets (Mine) with theirs. With Motion and Colours both *Still*, a hovered tile shows a gentle Drift so it still comes alive. Tiles follow your style too (Mesh shows mesh).
- **Clicking a palette tile changes the palette only** — your style, Motion, Colours, Loop, Movement, Colour change and Grain stay (before, every click reset them to defaults). Your own presets still apply in full. (`tool.ui.keepOnTile`)
### Fixed
- Hovered tiles did not animate in the web preview: hover is now tracked from mouse events instead of CSS `:hover` (which the single-file preview page never updated). Affects every library's tiles.
- Background drawing called `require()` on every frame (2.5 ms per tile frame → 0.02 ms; mesh 0.6 ms); a still background preview is drawn once instead of 30 times a second. `npm run stress` busy on Backgrounds: 64 % → 5 %.

## [0.18.0] — 2026-10-29 — Moving backgrounds
Requested by the product owner: backgrounds whose colour points move through expressions, with different kinds of motion for the background and its colours. Design: `docs/features/ANIMATED_BACKGROUNDS.md`.
### Added
- **Backgrounds › Motion**: Still · Drift · Orbit · Swirl · Wave · Breathe · Wander — expressions on the gradient points (Ramp start / end, or the 4-Colour Gradient's four points).
- **Backgrounds › Colours**: Still · Cycle (through the palette) · Swap · Hue · Pulse — expressions on the gradient colours.
- **Seamless loops**: every motion repeats exactly every *Loop* seconds; three live sliders on the layer — `MOE BG Loop`, `MOE BG Amount`, `MOE BG Colour` (keyframeable).
- **Live preview** in the Backgrounds Inspector, drawn with the same maths and geometry as the layer; Motion and Colours as chips with a one-line description.
### Fixed
- The v0.6 "Slow drift" expression added arrays with `+`, which AE's JavaScript expression engine treats as text (MOE then rolled it back). Point motion now uses `add()`. Old presets with *Slow drift* become *Drift*.
### Tests
- The expressions evaluated in the mock equal the plain-JS reference for Linear / Radial / Mesh × 6 motions × 4 colour moves at several times; every motion and colour move loops exactly; Movement 0 % holds the points, Colour change 0 % keeps the palette colours; HSL conversion matches the standard; Flat gets no sliders; restore removes the layer. 273 tests pass. Preview: the canvas moves, the chips switch, running the tool on the mock comp passes all checks. **Preview + mock host, not After Effects** — the look of each motion in AE (and 4-Colour Gradient blending vs the preview's approximation) is still to confirm.

## [0.17.0] — 2026-10-29 — ★ MOE: the recommended layout
The product owner asked to see the recommendation. It is a fourth layout built from the best part of each proposal (reasons in `docs/features/UI_LAYOUTS.md`).
### Added
- **Settings › Panel layout › MOE ★**: three rows above the content — **menus by object** (the one for your selection lights up; nothing moves), **your Quick Bar** (one fitted row, +N), **four task tabs** (Animate · Design · Layout · Finish, cards that open in place with a crumb back). No second context strip, no bottom bar; **F4** appears next to the title after a run.
- Web preview opens on MOE (`#moe`) with its own guide; the three proposals and Current stay one click away.
### Tests
- `tests/layouts.test.js` covers the new layout id. Preview (Playwright): MOE × 3 demo comps × 340 / 420 / 640 px — no overflow, no button outside the panel; every menu, tab, card and crumb clicked (82 clicks), 0 JS errors. Button audit on Home in MOE — see TEST_REPORT. **Preview + mock host, not After Effects.**

## [0.16.0] — 2026-10-28 — Three panel layouts you can try
After the study of the big AE tools (Motion 4, MoBar, KBar, Motion Tools Pro, Duik, AE's Properties panel / Quick Apply) the product owner asked for a live preview of each of the three proposals. They are real layouts of the same panel, not mock-ups. Design and rules: `docs/features/UI_LAYOUTS.md`.
### Added
- **Settings › Appearance › Panel layout**: *Current* (v0.15, default) · **Hub** · **Command Bar** · **Workspace**.
  - **Hub** (Motion 4 style): screens in a top row (Home · Ease · Toolbox · Library · Design · Finish); a Home that never changes (Ease, Anchor + Align, your tools, Recent); a slim *For this* strip that copies six actions for the selection.
  - **Command Bar** (MoBar + KBar style): menus by object (Keys · Layer · Text · Shape · Comp · Design · Layout · Finish · AI) — the one that fits the selection is highlighted, nothing moves; three named bars you edit; Ease and Toolbox as panels below.
  - **Workspace** (AE Properties style, made stable): a context bar with the 8 actions for the selection; four task tabs with a fixed order (Animate · Design · Layout · Finish); sections open inside their tab with a crumb back; your pinned tools at the bottom.
- In all three, every tool keeps **one** place; context areas only copy. Every section is reachable in every layout.
- Web preview: a **Layout** switch and links `#p1` / `#p2` / `#p3` / `#current`, with a short guide for each.
### Fixed (found while checking the layouts)
- Command Bar menus on the right half opened past the panel edge — they now open towards the left. **Esc** closes an open menu.
- At docked widths (340–420 px) crowded tab rows, the menu row and the context bar overflowed or cut words; they now fit (icons only where needed, two-line labels, 4 small tiles per row below 400 px).
- The Command Bar had no way to the Motion presets library — added to the **Layer** menu (caught by the new reachability test).
### Tests
- New `tests/layouts.test.js`: every section reachable in each layout, each Workspace section owned by one tab, every menu action resolves (no duplicates), every bar button is a real quick action, a highlighted menu for each kind of selection. 270 tests pass.
- Preview (Playwright): 3 layouts × 3 demo comps × 340 / 420 / 640 px — no row overflow, no button outside the panel, no JS errors; every tab, sub-tab, card (and its crumb back) and menu clicked (122 clicks). Button audit on Home in each layout — see TEST_REPORT. **Preview + mock host, not After Effects.**

## [0.15.0] — 2026-10-28 — Smart Home: the selection decides what comes first
The product owner rejected the v0.14 arrangement as "not smart in distribution and organisation". Study and rules: `docs/features/SMART_HOME.md` (AE's own Properties panel follows the selection; contextual-toolbar guidance: only what is useful now, no duplicates, stable layout).
### Changed
- **Home is built around what you selected.** One **focus card** at the top names the selection (*Keyframes · 7 keys · Title, Subtitle +2*, *Text layers · Headline EN, Headline AR* …) and holds only the tools that fit it:
  - **Keyframes** → the Ease graphs (segments, presets) · **Keys** (reverse, mirror, clone, stagger, trim) · **Loop** (cycle, ping-pong, offset, in-out).
  - **One layer** → **Animate in** · **Animate out** · **Rig** (Excite, Wiggle, Swing, Spin, Orbit, Float) · Anchor + Align.
  - **Several layers** → **Animate in, one after another** · **Arrange** (grid, ring, honeycomb, spiral, fan) · **Link** (null, parent, delay, stare) · Anchor + Align.
  - **Text** → **Text in** (typewriter, rise, cascade, fade, counter) · **Text tools** (Text, Brand) · Anchor + Align.
  - **Shape / shapes** → **Draw** (on, erase, travel, both) · **Motion** or **Arrange** · Anchor + Align.
  - **Nothing selected** → **Create** (shapes & icons, backgrounds, text, guides, safe areas) · **Find** (search, Copilot, Toolbox), and the *Start with* cards for new users.
- **Stable zones**: Focus → **Your tools** (pinned) → **More** (the blocks that are not in focus, folded, with a one-line summary) → **Recent** (one row of icons). Only the inside of the focus card changes.
- **Each action appears once on Home** — the old "For this selection" list, the greeting card, the Start-with cards (except for new users with nothing selected) and the tip card are gone from Home (the tip is a button in the footer; the pie keeps its own 8 slices).
- **Folds are remembered per kind of selection**: open Anchor while on keyframes and it stays open for keyframes only.
- **Home › Layout: smart / fixed** (footer): *fixed* gives the v0.14 order back.
### Tests
- New: every focus row resolves with no duplicates and distribute only in Align; `profile` kinds; the fold rule (focus open, others folded, remembered per kind, the focus can be folded, Fixed keeps its own folds). 266 tests pass. Preview (Playwright): Title (keys), 9 cards (several shapes), Text (text) at 340 / 420 px; Smart ↔ Fixed; open a block under More — no JS errors. *(The web preview reloads when you switch its demo comp, so remembered folds reset there; in the panel they are saved.)* **Not yet run inside After Effects.**

## [0.14.1] — 2026-10-28 — Layout fixes from the button audit
### Fixed
- Home at ~340 px: the Ease header (now with the fold arrow) pushed the Auto button 6 px past the panel edge. The source name shrinks first and the In / Both / Out · mirror · Auto controls drop to a second line when there is no room.
- Quick Bar **+N** pop-up opened on top of its own button in the main panel (it was positioned for the web preview's frame). It now measures the box a fixed pop-up is placed against, so it opens under the button in After Effects and in the preview.
### Tests
- Button audit (Home 321 + Kit 127 interactions): 0 JS errors, 0 unnamed controls, **0 overflow at 340 / 420 / 600 / 900 px**. Flagged and expected: *Open Folder* (unsaved project), *Grid* / *Ring* (layers already carry your own expressions), *Refresh selection* (nothing changed). **Preview + mock host, not After Effects.**

## [0.14.0] — 2026-10-28 — A curve for each segment, tidier panel
Requested by the product owner: start with a different curve per segment, and reorganise tools and windows with a better layout.
### Added
- **A curve for each segment** (3+ selected keys on one property). A strip under the overview shows **All · 1 · 2 · …**, each segment as a picture of the curve that is on it now. Click a segment — in the strip or **in the overview** — and the graphs load *its* curve and edit **only that segment** (drag, presets, paste, typed numbers, velocity fields, Flip all act on it); the overview highlights it and shows the other segments with their own curves; the line above the graph names it (*segment 2 (keys 2–3)*). Click it again or *All* for one curve on every segment. The selection stays while you work on the same keys and goes back to *All* when other keys are selected. Pass-through hides while one segment is edited.
- `motion.easeCurve` `segment` (0 = all; n = only the n-th segment between the selected keys; a missing segment is refused with the reason).
- **Folding blocks**: every Motion Kit block (Ease · Anchor · Align · Pinned tools, and Tools in the dock panel) folds from its title; folded Ease keeps a one-line summary (curve picture + source). Remembered per panel.
- **Quick Bar "Fit"** (new default): one row with the buttons that fit and a **+N** button that opens the rest, with names, in a pop-up — no more buttons hidden off to the right. Thin lines separate the groups. *Utilities › Quick Bar › Bar:* fit · wrap (every button on more rows) · one row (old sideways scroll).
### Changed
- The **Toolbox** groups its tools by what they do: **Motion rigs** (Excite, Delay, Jump, Orbit, Spin, Swing, Wiggle, Stare, Repeat) · **Keyframes** (Clone keys, Reverse, Stagger, Trim keys, Trim path) · **Layers** (Null, Parent, Separate, Vignette) · **Clean up** (Trash). Pinned tools on Home keep your order.
- The sidebar workspace **"Tools" is now "Utilities"** (Quick Bar · Select · My Tools) — it was too close to *Toolbox*.
- A folded Anchor no longer stretches to Align's height.
### Tests
- New: per-segment apply through the executor (segment 2 changes only keys 2 out / 3 in, then segment 1 gets its own curve, a missing segment is refused); overview samples per segment and `segmentAt`; Quick Bar Fit / Wrap (jsdom) and the toolbox groups covering every tool. 264 tests pass. Preview (Playwright): choose segment 2, drag → only segment 2 changes, overview click selects segment 1, fold / unfold, Quick Bar at 294 / 374 / 478 px (one row, +N, pop-up inside the panel) — no JS errors. **Not yet run inside After Effects.**

## [0.13.0] — 2026-10-28 — Value + Speed graphs together, icon presets, better Align
Requested by the product owner: value and speed graphs shown together with better control; saved-curve presets as icons without names; develop the ease part further; better Align; suggest more.
### Changed
- **Value and Speed graphs together** (new default *Both*; *Value* / *Speed* still available). Both are editable with the same Motion 4 free drag; a drag on one moves the other live; **hovering one shows the same moment on both** (a time line + "50 % time · 66 % done" / "· 66.7 px/s"). Side by side when the ease block is wide enough (≥ ~570 px), stacked otherwise. Each graph is labelled VALUE / SPEED.
- **Presets are pictures only**: every preset chip (built-in and saved) is a small drawing of its curve that fits overshoot; the name and numbers are in the tooltip. Saved curves have a dashed border after a divider. The *All* library groups the pictures by family (Basic · In · Out · In-Out · Motion · Mine).
- **+ saves the curve with no name dialog**; the same curve is never saved twice (it says which preset already has it). Right-click a saved curve removes it and an **↶ chip brings it back for 8 s** (no silent delete).
- The ease tools (Easy · Linear · Hold | Copy · Paste · Flip) are one compact icon row.
- **Align** redesigned: a ↔ row and a ↕ row, each with *align* (edges / centre) and *spread* (distribute centres / **Space evenly**). Targets: **Sel · Key · Comp** — *Key* = the first selected layer stays and the others line up with it. **Alt-click = to the comp, Shift-click = to the key layer** (one-off). **Gap** field: empty = equal gaps across the span (first and last stay), a number = fixed gap in px (works with 2 layers). Anchor and Align wrap onto two lines in a narrow panel instead of clipping.
### Added
- **Flip** (ease tools): the same ease played backwards — an ease-out becomes an ease-in.
- **Alt + mouse wheel** on a graph: 1 % influence per notch in the zone under the mouse (start / both / end); **Alt + Shift + wheel**: shape (value) or speed (speed). Plain wheel still scrolls the panel. Applies 0.7 s after the last notch (one undo step).
- **Alt-click a preset**: load it into the graph without applying (to tweak first).
- While you free-drag past the edge the graph grows to keep the curve in view (drag sensitivity stays as it was at the press).
- `transform.align`: `to: 'key'`, modes `spaceH` / `spaceV`, `fixedGap` + `gap`.
### Fixed
- **`dom.morph` patched an old `data-fresh` element into a different element**, keeping its listeners: when the overview strip appeared above the graphs, the value graph's resize grip became the speed graph's wrapper and swallowed every press on the speed graph. An old `data-fresh` element is now always replaced (regression test in `tests/ui-stability.test.js`).
### Tests
- New: align to key / space evenly / fixed gap through the executor (+ restore) and the pure maths; flip and Alt+wheel maths; the morph regression. 261 tests pass. Preview (Playwright): value drag moves the speed graph live, speed drag changes the start speed, Alt+wheel, save / duplicate refused / remove / undo, grouped library, hover sync, layouts at 280 / 420 / 640 px — no JS errors. **Not yet run inside After Effects.**

## [0.12.0] — 2026-10-28 — Delay matches Cinema 4D: Even · Blend · Spring + Field
Requested by the product owner after comparing with C4D's MoGraph Delay effector.
### Changed
- **Delay modes are now C4D's: Even · Blend · Spring** (was Spring · Blend · Offset).
  - **Even** (new): follows at an even speed — a moving average over a window, so a jump becomes a straight ramp. Strength sets the window (same average lag as Blend at the same Strength: 70 % ≈ 6 frames, 80 % = 9).
  - **Blend**: fast first, then settles slowly (unchanged maths).
  - **Spring**: overshoots and settles (unchanged).
  - **Offset is gone as a mode**: Even or Blend with Strength 0 plus *Delay* frames gives the same pure time offset. Options saved by 0.11 with "Offset" open as Even instead of failing (new enum `aliases` in the parameter schema).
### Added
- **Field (null)** — like a field on a C4D effector. Right-click Delay → *Field (null)*: creates (or reuses) a null **MOE Delay Field** at the comp centre with **MOE Delay Field Radius / Falloff / Invert**. Each layer's delay is blended with its undelayed motion by its weight: full inside the radius, smoothly none beyond radius + falloff (comp XY distance, every frame). Move the null to sweep the effect across the layers; scale the null to scale the field; keyframe the sliders. The **MOE Delay Field** Layer Control on the leader / each layer picks the field layer — any layer works, empty = no field.
- Undo / Restore removes a field null the run created; Trash removes the rig but never deletes a layer (delete the null yourself).
### Fixed
- The Delay frames unit no longer clips in the options sheet ("fr").
### Tests
- New: Even ramp (equal steps, arrives), Blend decelerates, "offset" alias; Field near / far / falloff weights, invert, null scale, moving the null swaps who is delayed, Layer Controls still point at the right layers after the null is added on top, the null is reused not duplicated, restore removes it. 258 tests pass. Preview: Delay with Field ran on the Title comp (6 properties, null created), no JS errors. **Not yet run inside After Effects.**

## [0.11.1] — 2026-10-27 — Free drag on the ease graph (Motion 4)
Requested by the product owner: "I don't want to control it from two sticks — I want to control it freely with the mouse in the middle of the graph, like Motion 4."
### Changed
- **Ease graph: press anywhere and drag** (Value and Speed mode), like Motion 4's Home graph. Where you press decides what moves: **left third = the start** (ease out), **right third = the end** (ease in), **middle = both together, mirrored** (a symmetric ease stays symmetric). Sideways = influence (how long it eases); up / down = the curve's shape at that side (Value: up at the end = overshoot; in the middle = steeper / snappier) or the speed at the key (Speed mode). The curve follows the mouse *relative to the press* — no jump on click. **Shift = fine** (¼ speed), **Ctrl = snap**. Hovering shows the zone and what it does; dragging the middle shows *Out % · In %* (with px/s in Speed mode). Commits on release as before (one undo step).
- Handles can still be grabbed directly (within ~14 px) for exact placement; double-click resets, arrows nudge, Enter applies.
- The Out / In sliders and the Keyframe Velocity fields now follow a drag live (they used to update on release).
### Tests
- `kit graph: free drag (Motion 4)` — zones, relative movement, mirrored middle, overshoot, legal range, speed-mode speeds never negative. 256 tests pass. Checked in the web preview with Playwright (hover, start / middle / end drags, Speed mode): no JS errors. **Not yet tried inside After Effects.**

## [0.11.0] — 2026-10-27 — Delay (C4D MoGraph) and a deeper speed graph
Requested by the product owner: improve the speed graph further, and a Delay like Cinema 4D's MoGraph.
### Added
- **Delay** (`kit.delay`, kit button + pinned on Home): the Cinema 4D MoGraph Delay effector for layers. **Spring** (overshoots and settles — Stiffness, Damping), **Blend** (smooth lag — Strength), **Offset** (pure time delay). One layer: its *own* keyframed Position / Rotation / Scale gets the delay (instant follow-through on any move). Several layers: the first selected leads and the others perform its motion on top of their own place and animation, each **Delay** frames × its order later — like clones under a Delay effector. Live, keyframeable `MOE Delay …` sliders in Effect Controls (on the leader, or on each layer); expressions tagged `// MOE Delay`; Trash removes the rig; Alt-click = Blend. The expression simulates frame by frame over a short window (≤ 300 frames) and is checked against a reference implementation in the tests.
- **Speed graph, real units**: the average line, the live label and new **velocity fields** show AE's Graph Editor units (px/s for Position, °/s for Rotation, %/s for Scale / Opacity) — type the outgoing / incoming speed and influence like AE's *Keyframe Velocity* dialog, Enter applies.
- **Whole-animation overview** (3+ keys): the speed of the entire selected animation over real time, with the new curve on every segment — see stops and jumps before applying.
- **Pass-through** (3+ keys): the speed flows through the middle keys (both sides get the speed of the line between the neighbours) instead of stopping at each key.
### Changed
- Kit segmented controls are 24 px tall (minimum target); clicking the source line with no keys selected explains what to select (found by the 0.10.0 click audit: 3,112 clicks, 0 JS errors).

## [0.10.0] — 2026-10-27 — Motion Kit (rebuilt after studying Motion 4 and Flow)
The product owner judged the v0.9 tools not useful, badly placed and badly designed, and asked us to study the real tools first. The study, the critique of v0.9 and the design are in `docs/features/MOTION_KIT.md`.
### Added
- **Home is the motion toolkit** (Motion 4 Home): the panel opens on the ease graph, the anchor grid, align and your **pinned tools**, every control acting on the selection in one click — no tiles, no Apply bar. Wide panels put Ease on the left and Anchor / Align / Pinned tools on the right, all above the fold; docked panels show Ease, Anchor and Align on the first screen. Recent, Favorites and the rest of Home follow below.
- **Toolbox** (sidebar, Ctrl 2): all 18 tools, **Pin to Home** (choose what Home shows) and the whole curve library.
  - **Ease graph** (rebuilt after the owner's "better interface and control" note): **Value / Speed** switch — Speed mode works like AE's speed graph (handle sideways = influence, up / down = speed at the key, 1× = average); a **spacing chart** with a moving ball under the graph; the keys' current curve stays as a dashed **ghost** while you edit; a live label next to the handle (*Out 32 % · speed 4.83×*); the graph **zooms out to show overshoot / anticipation**; **type or paste** the numbers (`0.16, 1, 0.3, 1` or `cubic-bezier(…)`); Ctrl = snap to the grid, Shift = flat handle, double-click = reset the handle, arrows nudge the last handle (Shift ×5), Enter applies; drag the strip under the graph to resize it. A full-width value graph It **reads the selected keys' curve by itself** when the key selection changes (like Motion 4's Live Poll / Flow's Read) and names the source; drag a handle and the curve **lands on the keys when you let go** (Auto; one undo step; Shift-drag = flat handle); Out / In influence sliders; mirror handles; In / Both / Out; **Easy Ease · Linear · Hold · Copy · Paste**; 15 preset chips that **apply on click** (Shift = ease in only, Ctrl = ease out only, the matching preset lights up); *All* opens the 32-curve library; *+* saves your own curve.
  - **Anchor**: 3 × 3 dots — click = anchor there, the layer does not move; **Alt-click = also place the layer at that point of the comp**; *Masks* uses the mask box.
  - **Align**: left · centre · right · top · middle · bottom · distribute ↔ ↕, to the selection or the comp; the whole animation moves.
  - **Tools** (Motion 4 Toolbox; 8 pinned on Home by default): Null · Parent chain (Alt: reverse) · Excite · Jump · Orbit · Spin · Swing · Wiggle · Stare · Clone keys (Alt: mirror) · Reverse · Stagger · Trim to keys · Separate · Trim path · Repeat (radial clone) · Vignette · Trash. Right-click = options; dimmed with the reason when the selection cannot run them; all pinnable to the Quick Bar (group *Kit*).
- **Dockable Motion Kit panel**: *Window › Extensions › MOE Motion Kit* — the kit on its own, slim (280 px), to dock next to the Timeline. Same tools, settings and history as the main panel.
- New tools: `kit.interp` (Linear / Hold / Bezier per side), `kit.trimToKeys`, `kit.parent` (chain in selection order), `kit.stare` (face a target layer via a Layer Control), `kit.vignette`, `kit.trash` (removes MOE-tagged expressions and MOE effects only). Ease Curve gains *ease in only / ease out only*.
### Changed
- **Anchor Point** no longer refuses common cases: keyframed anchors shift on every key; animated scale / rotation are compensated at the playhead (and the report says so); 3D-rotated and auto-oriented layers are measured with AE's own `toWorld` / `fromWorld` through a temporary probe (removed, selection kept); parented layers work.
- **Align & Distribute** now moves parented layers too (the comp-space move is turned into the parent's space).
- The v0.9 *Ease Curves* and *Anchor & Align* tile sections are gone — their tools live in the Motion Kit; pie slots point to the kit actions.
- The two panels can share one data folder safely: the store notices when the other panel rewrote a file, and settings re-read before saving (no more overwriting each other's changes).
### Fixed
- Quick Bar expression buttons used the form's generic numbers instead of the preset's own (e.g. *Inertia Bounce* got Amount 30 instead of 0.06 — a wild overshoot). They now carry the preset's numbers.

## [0.9.0] — 2026-10-27 — Ease Curves, Anchor & Align (Motion-4-style tools)
Requested by the product owner: anchor point by position, speed-graph curve control, and more Motion-4-like tools.
### Added
- **Ease Curve** (`motion.easeCurve`, new section *Animate › Ease Curves*): a value-graph editor with two draggable Bézier handles and a live speed graph underneath. The curve is turned into exact AE temporal ease on every segment between selected keyframes (out influence = x1·100 %, out speed = y1/x1 × average speed; in influence = (1−x2)·100 %, in speed = (1−y2)/(1−x2) × average speed), per dimension for Scale / Rotation / Opacity, along the path for Position. Hold sides are kept. **Read from keys** loads the curve already on two keyframes; the CSS `cubic-bezier()` can be copied. 32 preset curves: Basic, In / Out / In-Out (sine → expo, circ, back), and Motion (snap, glide, punch, swoosh, settle). Verified by reading every key's ease back; restore puts the previous eases back exactly.
- **Anchor Point** (`transform.anchor`): move the anchor to any of 9 points of the layer's content box (3 × 3 picker and 9 tiles) without a visual jump — position compensates for scale and rotation; keyed position (incl. separated X/Y) is shifted on every key. Skips locked layers, a keyframed anchor, animated scale / rotation and 3D-rotated layers, each with a reason.
- **Align & Distribute** (`transform.align`): left / centre / right / top / middle / bottom to the selection or the comp, distribute horizontally / vertically (3+ layers) by measured bounds; keyed positions shift on every key. Parented layers are skipped.
- **Clone** (`transform.clone`): duplicate one layer into a ring (facing out or not), a fan / arc, a row with rotation / scale / opacity steps, or a grid. Copies are named `MOE Clone n · <layer>`; restore deletes them and puts the source back.
- Section **Anchor & Align** in the Layout workspace (24 tiles), Quick Bar group **Align** (anchor TL / centre / bottom, align, distribute, centre in comp) and two curve buttons (Out Expo, Out Back).
- Pie: keyframes → Out Expo curve and Out Back (overshoot) curve; one shape → Clone ring; several shapes / layers → Distribute H, Centre V; one layer → Anchor bottom.
- `keyframes.read` now returns each key's value (needed to turn a curve into speeds).
### Changed
- "Select at most 1 layers" now reads "Select only one layer".
### Notes
- Position cannot store a negative speed in AE, so back / anticipation curves on a joined Position are limited to 0 speed (the report says so). Separate X/Y first for a full back curve.

## [0.8.0] — 2026-10-26 — Workspaces and Pie menu
Requested by the product owner: a smarter, simpler arrangement for fast access, and a pie menu.
### Added
- **Pie menu**: hold **Q** (or the right mouse button) over the panel, point toward an action, release. Tap Q (or the header button) to keep it open; 1–8 choose, arrows + Enter, Esc closes; the centre repeats the last change. Slices that cannot run on the selection are dimmed and explain why (the tool's own readiness check). Works while the panel has keyboard focus.
- **Smart slices**: the eight actions follow the selection — keyframes (eases, loops, reverse, mirror, stagger), text (typewriter, rise, slide, counter…), one shape (draw / travel / erase, pop, wiggle…), several shapes (draw on, grid, ring, cascade… — e.g. clone circles around a ring), several layers (cascade, grid, ring, parent to null, pre-compose…), one layer, or nothing selected (search, shapes, backgrounds, guides, Copilot…). Positions never move inside a set, so direction becomes muscle memory; opposites face each other (In ↔ Out, Draw ↔ Erase).
- **My pie** (Settings › Pie menu): eight slots of your choice from every tile, Quick Bar action, section and command; "Start from the smart set"; Q and right-hold can be turned off.
- **Five workspaces**: the sidebar is Home + Animate (Motion · Text · Expressions) · Design (Shapes & Icons · Backgrounds · Looks & Glass · Brand) · Layout (Layout & Grid · Zoom & Focus · Deliver) · Finish (Compositing) · Tools (Quick Bar · Select · My Tools) — 6 buttons instead of 15. Sections show as tabs at the top; each workspace reopens the section used last. Ctrl 1–6 = Home + workspaces.
- **Home › For this selection**: the same eight actions as the smart pie, as one-click buttons.
### Changed
- Section "Animate" is now **Motion** (inside the Animate workspace); "Tools" is **My Tools** (inside Tools).
- `npm run stress` scrolls a target into view before clicking it (Home is taller now).
### Fixed
- With the side Inspector (wide panel), its last buttons (Restore, Dismiss) could sit under the sticky Apply bar; the Inspector now stops above the bar (found by the click audit).

## [0.7.0] — 2026-10-23 — Faster workflow (UX audit recommendations)
All twelve recommendations of `docs/UX_AUDIT.md`, approved by the product owner.
### Added
- **Sticky action bar** in every library section and in Text: the selected preset, what it will do on the current selection, and Apply — one click from any scroll position (Apply was up to 2,900 px down in a docked panel).
- **▶ on every tile** (hover) — apply in one click; double-click still works.
- **Tile readiness**: tiles the selection cannot run are dimmed with the tool's own reason (same check as Run: requirements + prepare); ▶ explains instead of failing. "Setup" tiles (look description, reference layer, file) open their settings.
- **Repeat last (F4)** and a ↻ chip in the selection line: re-run the last successful change on the current selection.
- **Search applies presets**: Ctrl K finds library and text presets, ranked by name; Enter applies, Shift+Enter opens only.
- **Grouped sidebar**: Animate (Animate, Text, Expressions) · Design (Shapes & Icons, Backgrounds, Looks & Glass, Brand) · Layout (Layout & Grid, Zoom & Focus, Deliver) · Finish (Compositing) · Utilities (Quick Bar, Select, Tools). Settings › Sidebar hides sections; Ctrl 1–9 follows what is visible.
- **Compositing is a library** (one tile per tool, incl. green-screen prompt and import & key) with Inspector and action bar.
- **Banners once**: the full section intro shows on the first visit, then a one-line title (ⓘ brings it back; Settings › Show intros again).
- **Compact tiles** (Settings › Appearance › Tiles; Auto = compact under 520 px): 3–4 columns in a docked panel (8 → 15+ tiles on screen).
- **Home for returning users**: one-line greeting, then Recent and Favorites before "Start with".
- Quick section is now the **Quick Bar** editor; "Reset bar" is disabled (with a reason) when the bar is already the default, and confirms when it resets.
### Changed
- 24 px minimum targets: segmented controls 28 px, mini segments 24 px, switches 36 × 22, colour swatches 22 × 22.
### Fixed
- **Thumbnails went blank after the first re-render** (since v0.6.2): the in-place update removed a kept canvas's width/height, which clears it, and Calm tiles are not redrawn. Kept canvases now keep their size. Test added.
- A hovered thumbnail froze on its last moving frame when the mouse left; it now returns to the still frame.
### Dev
- `npm run preview:web` (`tools/build-web-preview.js`): one self-contained HTML file with the real panel code and real host scripts on the AE mock — runs without a server and without eval (host JSON reader swapped for `JSON.parse`; expressions are not evaluated where a page forbids eval, and the page says so). Published as the live preview for the product owner.
- `npm run audit`: the click-every-button audit and its summary.

## [0.6.5] — 2026-10-23 — Click-every-button audit
Requested by the product owner: test every button and suggest improvements. Report: `docs/UX_AUDIT.md`.
### Added
- `tools/audit-ui.js` + `tools/audit-summary.js`: clicks every button, tab, chip and tile in every view (and the controls that appear after a click), double-clicks every tile, checks layout at 340–900 px. 2,495 interactions in the preview: 0 JavaScript errors, 0 unreachable controls, 0 unnamed controls.
### Fixed
- Search (Ctrl K): mouse clicks on results were lost — hovering redrew the list and replaced the row under the pointer. Hover now only moves the highlight.
- Animated thumbnails: the first paint drew a random moment and overwrote the still frame, so in Calm motion Text "OUT" cards were blank and some tiles froze mid-move.
- Text previews ignored Settings › Motion and animated all 27 cards forever; they now follow Calm / Full / Off like every other preview.
- Quick Bar results are coloured by outcome (error / blocked / done) instead of all neutral.
- Search "Go to…" listed old section names and missed nine sections; it is now generated from the sidebar.
- The mouse wheel scrolls the Quick Bar sideways in narrow panels (11 of 26 buttons were off-screen).
- Tools banner text no longer promises a full tool list.
- Preview fixture layers have the Transform properties every AE layer has (dev only).

## [0.6.4] — 2026-10-21 — Fix: Copilot "compiled grammar is too large"
Reported by the product owner: every Copilot request (e.g. "radial clone of circle shapes") failed with *Claude API error 400: The compiled grammar is too large… Simplify your tool schemas*.
### Fixed
- **Cause**: the plan's structured-output schema had one strict variant per AI-callable tool (`anyOf` of 42 objects, each with its full parameter schema — 37.6 KB, 85 objects). The API compiles the schema into a grammar and refused it as too large. It grew with every tool added in v0.4–v0.6; the tests used a mocked API, so nothing caught it.
- **Fix**: the plan schema now pins only the tool id (`enum` of the 42 ids); each step's arguments travel as `args_json` (a JSON object string) described by the tool catalog in the system prompt — the pattern Tool Factory already used. 1.6 KB, 2 objects, no `anyOf`. Safety is unchanged: arguments are parsed and re-validated locally against the tool's own schema (unknown keys, types, ranges, options) before anything can be approved, and broken JSON is shown as a step error.
### Added
- Tests: the plan schema stays compact (< 4 KB, no `anyOf`/`oneOf`, every object closed) as the catalog grows; `args_json` parsing (truncated JSON, arrays, unknown keys refused; defaults filled).

## [0.6.3] — 2026-10-21 — Fix: "After Effects not connected"
Reported by the product owner: the panel always showed "After Effects not connected".
### Fixed
- **Likely root cause**: `host/ops/expressions.jsx` used `final` as an object key. `final` is an ES3 *future reserved word*; Node (which runs our host tests) accepts it, ExtendScript (an ES3 engine) can refuse the whole file — and one host file failing to load means the panel never connects. Renamed to `finalState` (JS readers updated). The ES3 linter ran with `allowReserved: true`, so it never checked this.
- All host `.jsx` files are now pure ASCII (non-ASCII only in comments and two strings, now `\u` escapes): ExtendScript may read source in the Windows code page.
### Added
- Linter: AST check for every ES3 keyword / future reserved word as identifier, object key or dot-property; non-ASCII check; more ES5+ API patterns (`Date.now`, `.bind`, `.includes`, `Math.hypot`, `Map`…). All 14 host files pass.
- The host loader names the file and line that failed (`host/ops/x.jsx line N: …`); test proves it.
- The context strip shows the reason next to "After Effects not connected", with **Details** (Diagnostics + Copy report) and Reconnect; Home shows a connection card; automatic retries at 2 s, 5 s, 10 s and 20 s after a failed start.

## [0.6.2] — 2026-10-20 — Fix: flicker, trembling icons and ignored clicks
Reported by the product owner inside After Effects: moving the mouse over icons made them blink and tremble, the pointer shook, and buttons did not respond.
### Fixed
- **Clicks ignored**: every state change rebuilt the whole panel, so a background refresh between mouse-down and mouse-up replaced the button and the click was lost. The panel now **updates the DOM in place** (`dom.morph`): elements on screen are kept, only what changed is touched; handlers are swapped onto the kept elements. Renders are coalesced per tick and **never run while a button is pressed** (they run right after the click).
- **Trembling icon under the mouse**: hover styles moved tiles up 1–2 px, so at an edge the tile left the pointer, lost hover, came back, and so on. No hover or press style moves or resizes anything any more (border / shadow / brightness only).
- **Blinking**: full rebuilds restarted every thumbnail and illustration. Kept elements keep animating; thumbnails are keyed by recipe.
- **Load on After Effects**: selection polling ran every 1.5 s on AE's main thread while the pointer was over the panel; now ≥ 2.5 s, adaptive to AE's answer time (×12, up to 10 s), paused during and right after clicks/typing and when the panel is hidden; focus refreshes throttled; unchanged state no longer renders; repeated host errors render once.
- **Motion "Calm" (new default)**: only the tile under the mouse and the Inspector preview animate, at most 30 fps; illustrations hold a finished frame. "Full" and "Off" remain in Settings › Appearance. Existing installs move from "Full" to "Calm" once.
- Removed `backdrop-filter` and the logo's `drop-shadow` filter (costly in CEP).
### Added
- `npm run stress` (`tools/stress-ui.js`): AE-like stress in Chromium (slow host 250 ms + a selection that changes on every read). Before the fix: the element under the mouse was replaced in all views, 12–14 of 20 slow clicks registered, 22–24 hover flips at a tile edge, 5–18 % idle load. After: 0 swaps, 20/20 clicks, 0 flips, 1–4 % idle.
- `tests/ui-stability.test.js` (jsdom): in-place updates keep the hovered element and run current handlers; keyed/form/canvas replacement rules; no-op state changes don't render; CSS guard against moving hover styles and `backdrop-filter`.
- Diagnostics › Panel performance: renders, deferred renders, selection reads and read time (included in Copy report).

## [0.6.1] — 2026-10-20 — Easy install & in-place updates
### Added
- **Windows installer** (`installer/moe-motion-ai.nsi`, NSIS 3, 64-bit, per-user, no admin): installs to one fixed folder named after the bundle id (`%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai`), wiped and rewritten on every install; removes older manual MOE copies (same bundle id only; developer junctions are unlinked, never followed); sets `PlayerDebugMode` for CSXS 12; one *Settings › Apps* entry with version, icon and uninstaller; asks to close After Effects; asks before a downgrade; English + Arabic; `/S` silent and `/WAITAE` (wait for AE to quit, then install silently). Uninstall keeps your data unless you say otherwise.
- **Settings › Updates**: installed version and install type (installer / developer link / manual copy), update feed URL, check on start (≤ twice a day), **Check now → Download & verify (size + SHA-256) → Install when I close After Effects / Install now**, **Install from file…**; header **Update** pill when a newer version exists. `core/updater.js` validates the feed (format, product id, semver, HTTPS-only, .exe, size cap, hash) and deletes any download that does not match.
- Platform: HTTPS-only downloader with redirect limit and size cap, streaming SHA-256, detached launch, install detection (`install.json` written by the installer).
- **`npm run release`** (`tools/build-release.js`): checks that all five version strings agree, runs `npm run check`, stages the extension without the `.debug` remote-debugging file, builds `Setup.exe`, a portable zip and the `latest.json` feed (notes from this CHANGELOG).
- Installer artwork (icon, welcome sidebar) built by `tools/build-panel-icons.js`; `INSTALL.md` (Arabic + English).
- Tests: `tests/updater.test.js` (feed validation, verified / rejected downloads, launch modes, install detection, real HTTPS download with redirect through a local self-signed server, release-script version check). The installer was run under Wine 9: install, legacy cleanup, in-place update, wait-for-AE, uninstall.

## [0.6.0] — 2026-10-20 — Premium: content libraries, artwork, appearance
Requested by the product owner: "saturate the plugin with icons, images and extras — premium, high value, professional".
### Added
- **Shapes & Icons** section: **1,899 vector icons** (Lucide 1.60, ISC licence — `extension/assets/icons/LICENSE-lucide.txt`) in 18 categories with search by name/tag, featured first, ★ starred icons, paging, copy SVG; **22 native shapes** (Rectangle / Ellipse / Polystar: square, rounded, card, pill, bar, circle, oval, ring, triangle, soft triangle, diamond, pentagon, hexagon, octagon, star, soft star, star 6, sparkle, burst, seal, flower, blob) that stay parametric in AE. Live Inspector preview of style, colour and animation.
- **`design.insertShape`**: icon → editable Bézier paths (`features/design/svgShape.js`: full SVG path parser — M L H V C S Q T A Z, relative/absolute, compact arc flags — plus circle, ellipse, rect incl. rounded, line, polyline, polygon; arcs split into ≤ 90° cubics). Styles Line / Solid / Both / Duotone, colour + fill colour, size, auto line width, round caps/joins, even-odd fill; **Draw** (MOE Trim end 0 → 100), **Pop** (overshoot) or **Fade** at the playhead. Layer `MOE Icon • …` / `MOE Shape • …`; read-back of paths, stroke, fill and keys; Restore removes the layer.
- **Backgrounds** section: **32 curated palettes** (`features/design/palettes.js`) as tiles with real gradient thumbnails. **`design.background`**: `MOE Background` at the bottom of the comp — linear / radial Gradient Ramp (angle, spread), **4-Colour mesh**, or flat — optional **film grain** (Noise) and **slow drift** (tagged `// MOE Background` expressions). Palette panel: copy hex, **Colorize selection**, **Save as client** (Brand Kit), **Use in Shapes**.
- **`design.colorize`**: colour the selection from a palette — cycle, shuffle (seeded) or blend in selection order; text / shapes / footage (`MOE Palette Fill`); verified per target; restorable.
- **Expressions: 33 presets** (16 new — Bounce Land, Squash & Stretch, Orbit, Swing, Heartbeat, Breathe, Wiggle Rotation, Wiggle Scale, Organic Wiggle, Loop Wiggle, Drift, Clock Ticks, Face Motion, Random Scatter, Auto Pop-In, Auto Slide-In), new **Auto** filter, a one-line explanation per preset, 16 new icons and preview curves.
- **Animate: 37 tiles** — 6 new animations (Rise In, Drop In, Cascade In, Cascade Fade, Soft Pop, Pop/Spin Out) and an **Ease** filter with 8 curve tiles (Gentle, Smooth, Snappy, Expo, Decelerate, Hard Stop, Accelerate, Launch). **NEW** badges on everything added in 0.6.
- **Home**: greeting, library stats, quick actions, the active comp card, 6 illustrated quick starts, Recent tools, Favorites, tip of the day.
- **My Presets**: ⧉ in any Inspector saves the current settings as your own tile (filter **Mine**, right-click to delete); **preset packs** export (data folder + clipboard) / import (validated against each tool's schema; unknown tools skipped) — `core/presetPacks.js`.
- **Artwork**: MOE logo mark; an animated, theme-aware illustration per section (`app/ui/art.js`) used in **section banners** (hideable), Home and empty states; splash screen; **What's New**, **About** and **Keyboard & mouse** sheets.
- **Appearance** (Settings): theme Auto (follows AE) / Dark / **Midnight** / Light, **8 accent colours**, Motion Full / Reduced, Headings **Sora** (OFL, bundled) / System, banners and splash toggles. All 93 theme × accent pairs pass WCAG (`tools/check-contrast.js`).
- **Colour fields** with picker, hex and quick swatches (active client first) — Shapes, Glass tint, Cursor colour.
- Status toasts (✓ / ✕ / !), header What's New dot and Shortcuts, Ctrl + 1…9 section jump, `?` shortcuts sheet, Esc closes sheets.
- **Panel icons** for *Window › Extensions* (`extension/icons/`, manifest `<Icons>`), built by `tools/build-panel-icons.js`.
- Host op `shapes.insert` (`host/ops/design.jsx`); `layers.createSolid` gains `bottom`.
- Mock: Rectangle / Polystar shapes, fill rule, line cap/join, `moveToEnd`, Gradient Ramp, 4-Color Gradient, Noise.
- Tests: `tests/design.test.js` (converter, every icon, every primitive, insert/draw/duotone/restore, backgrounds, colorize), `tests/premium-ui.test.js` (packs, appearance, artwork, banners, expressions); 190 tests; 49 preview scenarios.
### Changed
- Library tiles carry their preset's own numbers (Expressions used the form's generic defaults before).
- Changing a filter selects the first visible tile when the current one is hidden.
- Thumbnails off-screen are not redrawn; Reduced motion draws them once.
- Default section for new installs: Home.

## [0.5.0] — 2026-10-20 — Studio interface (concept B)
Chosen by the product owner from two UI concepts (canvas "MOE Motion AI — UI Concepts").
### Added
- **Studio layout**: labelled sidebar by creative purpose — Animate · Text · Layout & Grid · Looks & Glass · Zoom & Focus · Expressions · Compositing · Deliver, then Quick · Select · Brand · Tools, the active **client card** (Brand Kit colours) and Favorites / History / Settings.
- **Visual library + Inspector** for Animate (24 tiles), Layout & Grid (15), Looks & Glass (7), Zoom & Focus (8) and Expressions (17): animated canvas thumbnails, filter chips, search, click = inspect (the tool's own form, preview widget, Apply, verification report, Restore), double-click = apply now, ★ pin. "All tools" tab keeps every tool of the section; Expressions keeps its Editor tab.
- **Deliver board**: every format at once (9:16, 1:1, 4:5, 16:9, 4K, 2:3, 1.91:1, 21:9, 3:1, custom) — the comp is measured once, each format is planned locally and drawn before/after; per-format role/zone overrides; Refine with Claude per format; **Create N comps** runs Resize & Adapt per format (each verified, each restorable); "Single format" tab for the classic tool.
- Responsive: labelled sidebar from 600 px, Inspector beside the library from 760 px; narrower docks get the icon sidebar and the Inspector under the tiles.
- Theme-aware thumbnails (light AE brightness).
- Tests: `tests/studio-ui.test.js` (every tile → registered tool with valid preset args; every tool has a sidebar home; thumbnails draw). 163 tests; 30 preview scenarios (wide 900 px + narrow 380/280 px).
### Changed
- Old view ids still work (`motion` → Animate). Command search and "open tool" land on the tool's section (tile selected, or All tools).
- Compositing lists its tools without Glass (now in Looks & Glass).

## [0.4.0] — 2026-10-20 — Layout & Speed: Grid, Resize & Adapt, Zoom, Glass, Quick Bar
Design: `docs/features/STUDIO_v0.4.md`.
### Added
- **Layout** section. **Grid Builder** (Grid Builder-style, extended): one `MOE Grid N` null with Expression Controls and Dropdown menus; modes Grid, Radial, Spiral, Sunflower, Path, Sphere; order rows / columns / snake / seeded random; row offset (honeycomb); twist, scale step, random position/rotation/scale; **Build** animation (Pop, Fade, Rise, Pop + Fade, Drop, Spin In × Index, Reverse, Center Out, Edges In, Random; stagger) with optional keys; built-in **Effector**; auto spacing / columns / radius from measured layer sizes; live canvas preview using the same maths as the expressions; **Grid Controls** (live), **Release / Freeze**. **Layout Guides** (columns, rows, gutters, margins → composition guides) and **Place in Cells** (keeps keyframes).
- **Resize & Adapt** (CompResizer-style + responsive): Fit / Fill / Keep / **Smart** layout (background cover, pinned corners, bands, content re-stacked when the orientation flips, safe margins, nested layout pre-comps adapted inside a copy). Every keyframe kept (values, spatial tangents, ease speeds re-mapped) or `MOE Adapt` rig nulls. New comp by default; measured read-back; plan preview with per-layer role/zone overrides; **Ask Claude** layout suggestion (names, text and boxes only).
- **Zoom & Focus** (ClickZoom-style): **Focus Zoom** on a point (map picker) or the selected layer (auto level), zoom in / hold / out, 4 eases, chained zooms pan, end at playhead, motion blur, spotlight dim — all on one `MOE Zoom` rig; **Follow Zoom** (smoothed, edge-clamped expression); **Cursor Animator** (arrow / hand, travel + hold, click pulse, ripple ring, fade-out) from a keyed null.
- **Glass** (Glasser-style): liquid / frosted glass from native effects on shapes, text, footage or pre-comps; 7 looks; tint from the Brand Kit; rim light, tint and shadow layers linked to the source; every amount on `MOE Glass N`; **Glass Look**.
- **Quick Bar** (RKBar-style) in every section + **Quick** section (pin to bar, right-click for options): Reveal in Project / Folder / Open pre-comp, Purge cache, Duplicate comp (deep), Flip H/V, Parent to Null, Pre-compose, Center Anchor, Separate X/Y keeping easing, Select Same Property, Reverse keyframes, Mirror / Clone keys at the playhead, Smart Ease, Slide in/out (4 directions, off-screen or by distance, overshoot, stagger), Fade in/out, Scale up/down, Spin in, Trim Paths (draw / erase / travel / draw + erase), Typewriter (Arabic → words), Number Counter.
- **One-click expressions** with icons: Wiggle, Wiggle X, Wiggle Y, Step Wiggle, Blinker, Flicker, Auto Fade, Loop Cycle, Ping-Pong, Loop Offset, Loop In + Out, Time Rotation, Pendulum, Pulse, Float, Inertia Bounce, Stop Motion — natural target property per preset, optional live Slider controls.
- **Generate on Green**: Claude writes a production prompt for your image / video / 3D generator; the chroma-green (#00B140) rules and negative prompt are enforced locally whatever the AI writes; **Import & Key** imports the result at the playhead, fits it and runs the Screen Key chain.
- Host ops (`layout.jsx`, `fx.jsx`, `quick.jsx`): `layers.bounds`, `layers.describe`, `transform.remap/restore`, `layers.setParent`, `adapt.apply`, `adapt.restoreInPlace`, `comps.remove`, `guides.set`, `paths.find`, `props.values`, `props.bake/unbake`, `layers.createAdjustment`, `layers.createSolid`, `layers.duplicateLinked`, `layers.setAttrs`, `layers.setMatte`, `layers.move`, `masks.ellipse`, `keys.write/list/remove`, `shapes.cursor`, `effects.setMenu`, `footage.importToComp/remove`, `project.reveal`, `app.purge`, `comps.deepDuplicate`, `layers.flip`, `layers.parentToNull/unparentFromNull`, `layers.precompose`, `position.separate`, `props.select`, `keys.reverse/rebuild/mirror`, `shapes.trim/untrim`.
- UI: tool widgets (`app/ui/widgets.js`), `renderBody` hook, `hidden` / `showIf` params, 50 new icons.
- Mock: expression runtime (`tests/mock/ae-expr.js`) that evaluates MOE's generated expressions (toComp/fromComp, effects, paths, vector maths); masks, shapes, solids, parenting, track mattes, 3D toggle, comp duplicate, guides, import, pre-compose, separated dimensions; linear key interpolation.
- Tests: 156 (132 behaviour + 24 UI module loads); 41 preview scenarios.
### Changed
- `layers.createNull` accepts `anchor`, `threeD`, `undoLabel` (backward compatible).
- Tool search ranks word-start matches higher.
- Rail: Quick · Motion · Text · Brand · Layout · Select · Expressions · Comp · Tools.

## [0.3.0] — 2026-10-20 — Studio: Text, Brand, Proximity, Select
Design: `docs/features/STUDIO_v0.3.md`.
### Added
- **Left navigation rail**: Motion · Text · Brand · Select · Expressions · Comp · Tools, plus Favorites · History · Settings.
- **Text Animation Library**: 27 presets with live canvas previews (In/Out, groups, EN/Arabic sample), including the owner's 4 presets reproduced from their decoded `.ffx` values plus 23 new ones. Apply as an editable `MOE In` / `MOE Out` Text Animator (duration, distance, direction, based-on, timing; Out ends at the layer out point). Arabic text automatically switches character presets to Words.
- **`.ffx` import**: read-only RIFX parser (animator, range selector, properties, keyframes, time base) for previews; imported presets are applied through After Effects' own `applyPreset`, only on the intended text layers, and the selection is restored afterwards.
- **Brand Kit**: clients with palettes and Arabic/English fonts. Click a colour to apply it to selected colour properties, text fill/stroke, shape fill/stroke, or a `MOE Brand Fill` effect on footage and solids (shared solid sources are never changed). Auto fonts give Arabic text the Arabic font with RTL paragraphs. Includes palette extraction from a selected layer, JSON import/export and an installed-font picker (`app.fonts`).
- **Proximity** (ProximityPro-style): effector null with 13 Expression Controls; 15 reactions (scale up/down, push/pull, X/Y/Z, rotation X/Y/Z, look-at, fade/reveal, blur, colour shift) combined into one expression per property using `add/sub/mul`; user expressions protected; Remove (selected/all); Center Anchor.
- **Select** (port of Moe Selector v5): 18 layer types with counts, Shift/Alt modes, enabled/unlocked filters, search, select-same, labels, all/invert/clear, back/forward history, solo/visibility/lock/shy, and comp/selected-comps/project scope.
- Host ops: `fonts.list`, `text.setStyle`, `text.applyAnimator`, `text.removeAnimator`, `text.applyFfx`, `props.colorTargets`, `props.setValues`, `layers.createNull`, `layers.centerAnchor`, `layers.restoreTransform`, `layers.remove`, `layers.list`, `layers.setSelection`, `layers.setSwitch`, `labels.get`, `effects.find`, `expressions.peek`, `proximity.scan`.
- Copilot context now includes client brands, text preset ids and text-layer contents; the new tools are AI-callable.
- Tests: 116 (including module-load checks for every UI file).
### Changed
- Property addresses may omit indices and use `name:<display name>` entries.
- `context.get` returns text-layer contents (first 300 characters).
### Fixed (caught during development)
- FFX keyframe influence offsets and nested `Utf8` name chunk.
- Duplicate identifier in the shell that blanked the panel (now caught by UI module tests).

## [0.2.0] — 2026-10-19 — Compositing module
### Added
- **Comp** workspace (`features/compositing/`): Analyze Shot, Grade, Look from Words (Claude), Match Color, Screen Key. Design: `docs/features/COMPOSITING.md`.
- Host ops `pixels.sample` (expression `sampleImage` via a temporary probe, read with `valueAtTime`), `effects.ensure` (add/update named MOE effects, self-rollback on failure), `effects.restore`.
- `context.get` now also returns `compLayers` (name/index/type/in/out, capped 300), per-selected-layer `effects`, `width/height`, and `project.bitsPerChannel` (all additive).
- Permission scope `modify.effects` (default Allow; Copilot still always asks).
- Schema param type `layer` (layer picker in the UI, integer in AI schemas).
- Tool hook `ui.renderResult` (custom result views) and `app.prefillTool` (fill a tool's settings without running it).
- Host bridge: optional per-call timeout (`call(op, args, { timeoutMs })`).
- Mock host: effect stack, null layers, layer removal, expression evaluation with `sampleImage`, post-effect keying/colour simulation.
### Changed
- Host module 0.2.0. Diagnostics moved from the header into Settings (and the command palette) so the header fits four workspaces.
- Header switches to compact automatically when it overflows (fonts/locales differ).
- Sliders now shown for numeric ranges up to 400 units (was 100).
### Fixed (caught during development)
- Parameter fallback mapping could write to the wrong Channel Mixer parameter if the effect's layout differed; fallbacks now require the exact expected parameter count.
- Colour matching a keyed layer measured the green screen; keyed layers are now measured after the key with MOE Grade/Match bypassed, and unkeyed screens are refused.

## [0.1.0] — 2026-10-19 — Foundation milestone
### Added
- CEP 12 extension for After Effects 2025 (`AEFT [25.0,99.9]`), Node-enabled mixed context, dev installer (`tools/install-dev.ps1`).
- ExtendScript host module with named ops only (`host.ping`, `context.get`, `keyframes.read/applyEase/restoreEase`, `layers.setStartTimes`, `expressions.set/validate`), strict JSON, matchName-verified property addressing, comp-change guard, undo groups.
- Core: tool registry with contract validation, executor (validate → context → permission → prepare → execute → verify → checkpoint → history), permissions (user/agent/recipe origins), storage in `%APPDATA%\MOE Motion AI`, settings, logger with secret scrubbing.
- Tools: Smart Ease, Stagger Layers, Apply/Validate/Inspect/Remove Expression, Expression Assistant.
- Claude integration: structured outputs, prompt caching, server-side refusal fallback, retries, cost monitor with monthly budget, DPAPI key storage.
- Guided Copilot with typed plans, local validation, approval, verified execution, rollback, save-as-tool.
- Tool Factory foundation: data-only recipes with parameters, validation, dry run, offline reruns.
- Panel UI: Motion / Expressions / Tools workspaces, Favorites, History, Settings, Diagnostics, command palette, compact/wide layouts, AE theme sync (dark/light), WCAG-checked tokens.
- Tests: 56 automated tests (real host .jsx against an AE mock), ES3 lint, contrast check, browser preview harness + screenshots.

### Fixed (during development, caught by tests)
- Registry accepted a mutating tool with no recovery strategy when `recovery` was omitted.
- Logger secret scrubber replaced keys with the match offset instead of a redaction marker.
