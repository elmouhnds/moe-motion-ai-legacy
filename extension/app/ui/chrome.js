'use strict';
/**
 * Studio "chrome": section hero banners, splash, and the About / What's New / Shortcuts sheets.
 * Content only — every action still goes through app.* (tools run via the executor).
 */
const { h, icon } = require('./dom');
const art = require('./art');
const theme = require('./theme');

/* ---------- section banners ---------- */
function counts(app) {
  const studio = require('./studio/sections');
  const by = (id) => (studio.byId(id) || { tiles: [] }).tiles.length;
  const lib = require('../../features/design/shapesLib');
  const { PRESETS } = require('../../features/text/presets');
  const anim = (studio.byId('animate') || { tiles: [] }).tiles;
  return {
    tools: app.services.registry.list().filter((t) => !(t.ui && t.ui.hidden)).length,
    animate: anim.filter((t) => !t.tags.includes('Ease')).length, ease: anim.filter((t) => t.tags.includes('Ease')).length,
    layout: by('layout'), looks: by('looks'), zoom: by('zoom'), expressions: by('expressions'),
    icons: lib.count(), shapes: lib.PRIMITIVES.length, palettes: by('backgrounds'), text: PRESETS.length
  };
}

const COPY = {
  animate: (n) => ({ kicker: 'ANIMATE', title: 'Motion in one click', pitch: 'Slides, pops, fades, blurs, draw-ons, eases and proximity — keyed from the playhead, always restorable.', stats: [[n.animate, 'animations'], [n.ease, 'ease curves']], tip: 'Press ▶ on a tile to apply it straight away.' }),
  text: (n) => ({ kicker: 'TEXT', title: 'Type that moves well', pitch: 'Signature text animators with Arabic-safe defaults (words / lines, RTL).', stats: [[n.text, 'text presets']] }),
  layout: (n) => ({ kicker: 'LAYOUT & GRID', title: 'Live grids & layouts', pitch: 'Grid, radial, spiral, path and 3D arrangements driven by one null — plus guides and cells.', stats: [[n.layout, 'layouts']] }),
  looks: (n) => ({ kicker: 'LOOKS & GLASS', title: 'Thick, liquid & frosted glass', pitch: 'Editable glass from native effects: thick refraction with bevel, dispersion, chrome and caustics — or flat UI glass with lens, frost, tint and rim. Plus Styles: soft shadows, glow and a light sweep.', stats: [[n.looks - 4, 'glass looks'], [4, 'styles']] }),
  zoom: (n) => ({ kicker: 'ZOOM & FOCUS', title: 'Screen-recording zooms', pitch: 'Punch-ins, follows, spotlights and animated cursors without touching your layers.', stats: [[n.zoom, 'zoom presets']] }),
  expressions: (n) => ({ kicker: 'EXPRESSIONS', title: 'Smart expressions, no typing', pitch: 'Wiggles, loops, bounces, orbits and auto-animations — with live slider controls.', stats: [[n.expressions, 'expressions']] }),
  shapes: (n) => ({ kicker: 'SHAPES & ICONS', title: 'Vector icons, ready to animate', pitch: 'Every icon lands as editable shape paths; native shapes stay parametric in AE.', stats: [[n.icons.toLocaleString('en-US'), 'icons'], [n.shapes, 'native shapes']] }),
  backgrounds: (n) => ({ kicker: 'BACKGROUNDS', title: 'Backgrounds & colour', pitch: 'Gradient, radial and mesh backgrounds from curated palettes — still or moving: the colour points travel and the colours change, in a seamless loop.', stats: [[n.palettes, 'palettes'], [6, 'motions'], [4, 'colour moves']] }),
  compositing: () => ({ kicker: 'COMPOSITING', title: 'Key, match & grade', pitch: 'Analyse a shot, pull a key, match colour and grade — measured, not guessed. Green-screen prompts and import & key live here too.' }),
  deliver: () => ({ kicker: 'DELIVER', title: 'Every format from one master', pitch: 'Plan all aspect ratios at once and adapt the animation — keyframes kept.' }),
  quick: () => ({ kicker: 'QUICK BAR', title: 'Edit your Quick Bar', pitch: 'Every everyday button in one place. Star a button to put it on the bar under the selection line; right-click any button for its options.' }),
  select: () => ({ kicker: 'SELECT', title: 'Find layers fast', pitch: 'Select by type, name, label, effect or property across the comp.' }),
  brand: () => ({ kicker: 'BRAND', title: 'Client kits', pitch: 'Colours and fonts per client, applied everywhere in one click.' }),
  tools: (n) => ({ kicker: 'TOOLS', title: 'Your toolbox', pitch: 'Your saved tools, and the Tool Factory to build new one-click tools from existing ones. Every tool is one search away (Ctrl K).', stats: [[n.tools, 'tools available']] })
};

/**
 * Section banner. The full banner shows on the first visit to a section; after that the section
 * opens with a one-line title (more room for tiles — the banner took ~17 % of a docked panel).
 * The ⓘ on the line brings the full banner back for this session.
 */
function banner(app, sectionId) {
  const ui = app.services.settings.get().ui;
  if (ui.banners === false || !COPY[sectionId]) return null;
  // v0.68: MOE is the Classic style — no banners or marketing copy there (CLAUDE.md), the tools start at the top
  if (ui.layout === 'moe' || ui.layout === 'control') return null; // v0.73: Control too — its pages start with the tools
  // a composer page explains itself with its live stage (Backgrounds)
  if ((require('./studio/sections').byId(sectionId) || {}).composer) return null;
  const hidden = app.services.store.get('banners-hidden', []);
  if (hidden.includes(sectionId)) return null;
  const c = COPY[sectionId](counts(app));
  // v0.81 (LAYOUT_PLAN.md): in Bento a library starts with its tiles — the one-line title; ⓘ still opens the banner
  const seen = ui.layout === 'bento' || !ui.layout || app.services.store.get('banners-seen', []).includes(sectionId);
  const open = (app.state.get().bannerOpen || {})[sectionId];
  const setOpen = (v) => app.state.set((st) => ({ bannerOpen: Object.assign({}, st.bannerOpen, { [sectionId]: v }) }));
  if (seen && !open) {
    return h('div', { class: 'hero-line', 'data-key': `hero-${sectionId}` },
      h('span', { class: 'hero-kicker' }, c.kicker), h('span', { class: 'hero-line-t' }, c.title),
      h('span', { class: 'spacer' }),
      h('button', { class: 'icon-btn', title: 'About this section', 'aria-label': 'Show section intro', onclick: () => setOpen(true) }, icon('info', 'sm')));
  }
  const el = h('section', { class: `hero hero-${sectionId}`, 'aria-label': c.title, 'data-key': `hero-${sectionId}` },
    h('div', { class: 'hero-text' },
      h('div', { class: 'hero-kicker' }, c.kicker),
      h('div', { class: 'hero-title' }, c.title),
      h('div', { class: 'hero-pitch' }, c.pitch),
      c.stats ? h('div', { class: 'hero-stats' }, c.stats.map(([v, l]) => h('span', { class: 'hero-stat' }, h('b', {}, v), ` ${l}`))) : null),
    h('div', { class: 'hero-art', html: art.art(sectionId) }),
    seen ? h('button', { class: 'icon-btn hero-x on', title: 'Back to the one-line title', 'aria-label': 'Collapse banner', onclick: () => setOpen(false) }, icon('chev', 'sm'))
      : h('button', { class: 'icon-btn hero-x', title: 'Hide this banner (Settings › Appearance brings it back)', 'aria-label': 'Hide banner', onclick: () => { app.services.store.set('banners-hidden', hidden.concat(sectionId)); app.render(); } }, icon('x', 'sm')));
  return el;
}

/** Called when the user leaves a section: from now on its banner is a one-line title. */
function markBannerSeen(app, sectionId) {
  if (!COPY[sectionId]) return;
  const seen = app.services.store.get('banners-seen', []);
  if (!seen.includes(sectionId)) app.services.store.set('banners-seen', seen.concat(sectionId));
}

/* ---------- sheets (modal) ---------- */
const WHATS_NEW = [
  ['undo', 'One Ctrl+Z per production', 'Titles, lower thirds and product UI now arrive in their own comp, as one layer at the playhead — and one Ctrl+Z takes back the whole thing. Backgrounds, animations, expressions, glass, zoom, carousel, click and proximity are one undo step each too (Grid Build: two). Restore is one step.'],
  ['sliders', 'A grid with 8 sliders, not 46', 'A new grid null shows only what it uses: its layout\'s own sliders, Layout, Order and Item Scale — and Build, Morph, Seed or Twist only when you use them. Grid Sliders (Layout › Clone) adds any group later, and the panel adds a slider when you change it. Proximity shows only the sliders of the reactions you chose.'],
  ['target', 'Effectors on any property', 'Select Trim Paths End, Stroke Width, Roundness or any slider on one item of a grid, then Effector on Property (Layout › Effectors): every item gets it, and each effector\'s new Custom slider says how much it adds — with its falloff, type, spring, Snap To and Clamp. Numbers only; one Custom amount per grid.'],
  ['guides', 'Tracer: lines that follow the clones', 'Select a grid and draw lines between its items — one line in order, rows, a full grid, a zig-zag or a hub. The lines are one shape layer and follow the items through effectors and springs. Layout › Clone › Tracer Line / Grid / Zig-zag / Hub.'],
  ['trash', 'Remove or freeze one effector', 'Remove Effector takes one effector off a grid without disturbing the others. Freeze Effector keeps what it does at this frame: its keyframes go, the values stay, and Restore brings them back. Both are in Layout › Effectors — select the effector null.'],
  ['target', 'Magnet, Repel, Gather — and a falloff curve', 'Move mode on an effector: Attract / Repel pulls the clones toward the effector null (never past it) or pushes them away; Absolute sends them to it. Falloff curve chooses how the soft edge fades — smooth, linear, ease in or ease out — for the moves and for Clone Colours.'],
  ['target', 'Wave, Snap To, Clamp', 'A Wave effector runs a sine, triangle, ramp or square wave through the clones in their order (Ripple, Square Pulse, Saw Fade in Layout › Effectors). Snap To rounds what an effector gives — Snap Turn keeps every item on a 45° step. Clamp sets a limit that holds even through a spring\'s overshoot.'],
  ['sliders', 'Only the sliders that matter', 'A new effector shows in Effect Controls only what it uses — a Scale effector has 7 controls instead of 24. More Sliders (Layout › Effectors) adds a group later: Moves, Random, Colour, Spring, Audio, Field — nothing moves when you add them. Quick expressions now arrive with their own sliders (Wiggle: Frequency and Amount).'],
  ['sparkles', 'The Assistant: AI on the button, an organised window', 'The button now says AI. Its window starts with what it sees (your selection, the comp, its format, the client), then the suggestion for it, then one list at a time — Do it for me (a plan you approve first) or Ask a question — with prompts written for what you selected. After an answer it says whether it came from Claude or from the offline tool search.'],
  ['sparkles', 'A new Assistant button', 'A dark tile with a lit rim and its own mark — a speech bubble holding a spark — in every style\'s own shape. The rim turns once when a suggestion arrives and keeps turning while it thinks. The last row of a page now scrolls clear of it.'],
  ['glass', 'Glass: a clean nav, controls you can hit', 'The five tabs at the bottom lost the small dark key-hint boxes (Ctrl+1…5 is still in each tab\'s tooltip); the tab you are in has a short accent line. Chips, switches, tags, segments and colour bars in Glass are 24 px to click, like the other styles.'],
  ['glass', 'Glass: menus you can read', 'Everything that opens over the page in Glass is solid now — the sidebar menus, a tool\'s options, What\'s new and the other sheets, the toast, the Assistant — with a firm edge and a deeper shadow, and the page steps back behind a dialog. The page itself keeps its glass.'],
  ['target', 'Easier to hit, same names everywhere', 'Every button, switch, chip and swatch in Bento, MOE and Control now answers a click at least 24 px wide and tall (some were 10–22 px) — checked by clicking, on 192 screens. Glass says Layer and Look like the other styles. The sidebar\'s shortcuts read as Everyday (Alt+1…0) and More, with a line between kinds.'],
  ['layers', 'A shorter Home, a fuller Control', 'Bento: Home is about one screen — each stage is one row that names its groups (open the ones you use, it is remembered) and a Power card shows its explanation when you press How. With keys selected, anchor and align wait behind one Anchor · Align button (Bento, Control). Control: six key jobs in one row (Stagger, Reverse, Mirror, Retime, Copy / Paste motion) and Libraries wrap instead of running off the edge. The stages are named like the tabs: Animate · Layer · Design · Look · Deliver. The Quick Bar takes whole Style Kits (Shift-click a kit) and its page lists kits and recipes.'],
  ['eye', 'Scene Check', 'Deliver › Scene Check: one click reads the comp (nothing is changed). It says which Style Kit fits and why, draws every layer\'s keyed moves and markers on one small timeline, and checks quality — keys between frames, moves too short to read, empty text. Measure adds text outside title safe, shape colours that are not the client\'s, and a storyboard: one schematic frame per marker, saved as a page.'],
  ['sliders', 'Dragging that follows your hand', 'Control\'s bars: the whole bar is the handle now (it was only the small number) — drag anywhere on it, the level travels as far as your hand; click sets the level, double-click resets, Shift takes bigger steps, Ctrl is fine. Every drag in the panel is tracked on the window, so leaving the control or releasing outside the panel never loses or sticks it; Esc cancels.'],
  ['sliders', 'Tune after you apply', 'What you just applied stays within reach: a strip under the header shows its numbers — drag one and the result is replaced (one Ctrl+Z), no Undo-and-Apply-again. Variations gives up to four takes with real previews (calmer, faster, overshoot, other side). Stagger shows its offsets while you drag. New in Timing › Keyframes & Loops: Copy Motion / Paste Motion (keys, ease, paths and expressions; Position keeps each layer in place) and Retime (faster or slower, ease kept).'],
  ['bolt', 'Recipes: checked first, on your Quick Bar, shareable', 'A recipe now says what it needs on its card and does not start unless every step it can judge is ready — nothing is half-done. Shift-click a recipe to put it on the Quick Bar (and the sidebar); every recipe is in Ctrl+K and can go on My pie. Style Kits › Export / Import moves your own recipes to another machine as a small checked file.'],
  ['plus', 'Your own recipes, Beat Sync, Living Loops', 'In any kit: New recipe — click up to four of its tools in the order they should run, name it, and it becomes a one-click, one-Ctrl+Z recipe of your own (right-click removes it). Two new technique kits: Beat Sync (find the beats, react to markers, clones on sound, hits) and Living Loops (float, breathe, swing, loop, follow-through). Each kit card says how many of its tools are ready for what is selected now.'],
  ['target', 'Smart Kits: recipes, progress, Effectors Pro', 'Style Kits are now Looks and Techniques. New technique kit Effectors Pro: clone, shape, physics, fields, aim & sound, colour — in build order. Every kit has Recipes: a chain of its own tools in one click and one Ctrl+Z (Ripple Wall, Spring Bloom, Liquid Card, Click & Punch…); it stops and says where if a step is not ready. Steps tick as you use them and the next one is marked. Work in this kit pins it: Home then shows its next step in every style.'],
  ['sparkles', 'Style Kits, Signature colours, a brand that moves', 'Design › Style Kits: SaaS Product Video, Apple Glass, Kinetic Type, Social & Reels, MoGraph — each look\'s tools in one place, in the order you build it. Backgrounds start with 16 Signature looks that move (rest the mouse on one). Brand › Motion: give a client its own Ease Out / Ease In — Brand ease applies it. Control: one Ctrl+Z undoes a whole Mix; the tall sliders pour like liquid.'],
  ['sparkles', 'Control comes alive', 'The big squares play all the time (Calm too); pages and squares glide in, the light on Apply breathes while something waits in the Mix. Wiggle moves Position, Rotation or Scale. Your numbers are kept for next time. Save a Mix you use often (☆ in the Mix bar) — it waits under My mixes. Enter applies the Mix, Esc empties it.'],
  ['brand', 'Brand, organised — with three example clients', 'Brand opens with Nile Roast, Pulse Pay and Sahara Atelier to try. Each client is a card in its own colours and fonts; Colours, Type, Guide and Manage are tabs. Backgrounds show every palette as the real background in your style, colours fanned on top — in every style. Control: its library pages have its look, no banners.'],
  ['layers', 'Control has pages', 'Five pages under the selection (Ctrl+1…5): Move, Text, Design, Look, Deliver. Each is squares of real tools with a live preview — your own text playing each text animation, palettes as colour strips, glass and styles, the social safe zones. Click picks (it plays big on top and the bar says what it will do), double-click applies, right-click opens its library.'],
  ['layout', 'Control, laid out better', 'The squares start higher: the comp and the selection share one line, search is the magnifier in the header (Ctrl+K). The Motion square is all preview with its name on it; Duration, Stagger and the switches sit together beside it; Move and Add are two groups; the Motion Control folds to one line for layers; Libraries is one row that scrolls; the Mix is a thin line until you switch something on.'],
  ['sliders', 'Control — a Control Center for motion', 'A fourth style (Settings › Style, or ≡ › Style): squares that ARE the tools. The Motion square plays the move it will write; Duration and Stagger are tall sliders you drag; Blur, Overshoot, Expo and Order are round switches; Wiggle, Typewriter, Loop and Beats follow what you select. Switch on what you want, read one line saying what will happen, press Apply once. Double-click a square to run it alone.'],
  ['layers', 'Glass has the sidebar', 'Every shortcut is on the left now, like MOE — the icon row on top is gone, so your tools start higher. Hover a shortcut for its card; ⇔ shows the names.'],
  ['background', 'Backgrounds you compose', 'Backgrounds is now one instrument: the real background plays on top, Style · Motion · Colours sit under it, and picking a palette keeps your style and motion.'],
  ['eye', 'See what MOE did — and what it will do', 'Rest the pointer on any button for its card: what it acts on, what it writes, what could surprise you. On this layer (Layer tab) reads what MOE already did to the selection — edit an expression with its own numbers or remove one item. Beat Markers put the music on your layers; Marker Trigger replays your animation at every marker.'],
  ['info', 'Every tile says what it will do', 'Click a tile: before Apply you see what it acts on, what it will write, how to undo it — or the one thing it needs first. Expressions show their code with your numbers lit, and the list is grouped by what each one moves, the group that fits your selection first. New: Live Stagger (each layer plays its own keys later, no key moves) and Marker Pulse (a pop on every marker).'],
  ['layers', 'Tabs in the order of your work', 'MOE\'s tabs now go Animate · Timing · Layer · Design · Look · Deliver. The big graph lives in Timing; the other tabs show a one-row Motion Bar (Easy, Linear, Hold, your curves, Graph) or nothing at all, so your tools start at the top. Wipe, Depth and Shake sit in Animate In / Out, Decode and Explode in Text, Carousel in Arrange, Styles at the top of Look.'],
  ['type', 'Decode, Explode, and Depth', 'Text has Decode and Scramble (the letters settle into the word) and Explode / Assemble (each letter flies its own way). Motion has Depth In / Out: your layers come forward from deep in the scene, sharpening as they land — no plugin, nothing to download.'],
  ['refresh', 'Carousel, Wipe, and a Stop button', 'Layout › Arrange has Carousel 3D: your cards on a ring that turns one at a time, the back ones fading. Motion has Wipe In / Out with a soft edge from any side. And any long run now shows what it is doing — with Stop, which leaves what was made as one Ctrl+Z.'],
  ['link', 'Rename anything — nothing breaks', 'Rename a Grid null, an Effector, a Glass or a layer you follow: MOE sees it and relinks its expressions to the new name at once (one Ctrl+Z if you want it back). It finds the layer by its permanent After Effects id, never by guessing.'],
  ['bolt', 'One Ctrl+Z, every time', 'Every MOE run is now ONE step in After Effects\' undo — however many layers, keys and effects it made. Keys always land on a frame, locked layers are never touched (the panel says which it skipped), and big selections are fast: 60 layers cost the same few calls as 3.'],
  ['cursor', 'A cursor that clicks your real layers', 'Product UI › Interact: select the layers in the order they are clicked and press Click — the cursor lands on each one\'s real centre (After Effects measures it at that moment) and the layer presses in place with it. UI Reveal builds a screen in reading order (or right to left for Arabic), and Backgrounds has four product backdrops.'],
  ['zoom', 'Shakes and Styles', 'Motion has a new Shake mode: Bump, Zoom Punch, Whip, Slam and Jitter — real keyframes that settle back and sit on top of your animation. Looks has Styles: Soft Shadow, Deep Shadow, Glow and a Light Sweep that crosses the layer every few seconds, all from After Effects\' own effects.'],
  ['fadeIn', 'Apple-style motion', 'Every move in Motion now has a Blur setting: the layer comes in sharp from a blur on the same timing (try Blur In, Focus In, Whip In). The Ease library has seven calm Native curves with springs and anticipation, and Text has Hero presets — Hero Reveal, Word Stagger, Word Burst, Iris In — that work with Arabic too.'],
  ['uiKit', 'Product UI for app and SaaS videos', 'Design › Product UI: a button that gets clicked, a toggle that switches, a search bar that types, a task that ticks itself off, a notification, a progress bar, a chat with typing dots and a stat card whose chart draws — real layers in your comp, light or dark, in your client\'s colours. Also fixed: a template\'s text could sit under its own pill in After Effects.'],
  ['wand', 'Every number is a hidden slider', 'Drag sideways on any number in the panel to change it, like After Effects — Shift for big steps, Ctrl for fine, Esc to cancel. ↑ ↓ step it, the wheel works while you are in the field, and a double-click on a slider puts its default back. Clicking still lets you type.'],
  ['easeCurve', 'Drag the velocity numbers', 'The Keyframe Velocity numbers (Out / In speed and influence) are now hidden sliders: drag sideways on a number and the curve follows live, like After Effects\' scrubby values — Shift for big steps, Ctrl for fine. Release applies it; a click still lets you type.'],
  ['type', 'Every name shows whole', 'No more “Duplicate Comp (d…”: long names now wrap to two lines everywhere — the sidebar, tiles, the Quick Bar, the action bar. On a narrow dock the MOE sidebar keeps its icons so your page is not squeezed, and shows names again when the panel is wider. Choices that do not fit take a second row instead of losing letters.'],
  ['guides', 'Guides in one click — and the social safe zones', 'A new Guides menu in the MOE sidebar (also Comp › Guides & Safe Areas): Centre, Thirds, Golden ratio, 12 columns, TV title / action safe, and the safe zones of TikTok, Reels, Shorts and Stories, so your text never hides under the app\'s buttons. Pressed twice adds nothing; Clear removes them all. The anchor pad now looks like the layer\'s box, and the Parent & Link icon is back.'],
  ['type', 'Long text fits by itself', 'A long name or a long quote no longer runs off the frame. Each template line has a safe width: After Effects measures your text and makes the font smaller until it fits (never under 40 %), and the bar, pill and underline follow it. Short text keeps its size. The preview shows it as you type.'],
  ['brand', 'Templates in your client\'s brand', 'With a client active in Brand Kit, every template comes out in its colours and fonts — the accent from the brand, the word on a pill or button in the brand colour that reads best on it, the Arabic or English font by the text. The tiles show it before you build. What you set yourself always wins.'],
  ['type', 'Four more templates — and they leave by themselves', 'Design › Templates now also has Quote, End Card, Social Handle and Chapter (and Arabic اقتباس / شكراً للمشاهدة). New on every template: Hold, then exit — after the time you choose it leaves the way it came in, so a lower third needs no extra keys.'],
  ['type', 'Templates, built in your comp', 'Design › Templates: Lower Third, Title Card, Callout and Tag (and Arabic شريط الاسم / عنوان كبير). Type your text and Build — real text and shape layers appear in your comp, sized to your words as After Effects measures them, all on one null you can move, with the entrance already animated. Arabic is laid out right to left. Everything stays editable.'],
  ['layers', '12 combined moves', 'Entrances and exits the way you build them by hand, in one click: Rise + Fade, Zoom Fade In / Out (from 130 %), Grow / Shrink + Fade, Pop + Fade, Swing In / Out, Slide + Fade, Drop + Fade, Sink + Fade. And on any Quick Animate: Also fade, From / to (scale) and Angle (spin). Each tile plays its real keys.'],
  ['play', 'Previews that are the real motion', 'Every Animate tile now plays the exact keyframes it will write — the real duration, the real ease (Snappy, Smooth, Gentle, Expo look different now), Pop\'s overshoot key, Cascade\'s stagger. Change Duration or Ease in the settings and the big preview follows at once, with a strip that shows where the keys sit.'],
  ['link', 'Menus under Select', 'The MOE sidebar has the jobs you do from any tab, under Select and in the order of the work: Parent & Link (to a null, as a chain, delay, stare), In / Out (Fade, Pop, Slide, Spin — In next to Out — and Draw On) and Loop (cycle, ping-pong, offset, wiggle, float, pendulum, pulse). Each is one click, like Select.'],
  ['cursor', 'Shift adds, Alt removes', 'Every Select button now works like After Effects: Shift-click a filter (Text, Shapes, Same Label …) to add those layers to your selection, Alt-click to take them away; a plain click replaces. On Home, in the MOE Select menu, the sidebar and the Quick Bar. Right-click still opens a button\'s options.'],
  ['check', 'One button per job', 'Less to look through: the MOE sidebar is Select + your Quick Bar — the AI menu was the Assistant button and the search box, the other menus were the tabs again (each tab has its ▾ quick menu). NOW no longer repeats the search box, the Assistant or the Motion Control above it (Out Expo, anchor, align). Nothing was taken away — every button is still one or two clicks.'],
  ['cursor', 'Select, out front', 'Select has its own group first in Layer (and its own menu in MOE): Text · Shapes · Solids · Nulls · Pre-Comps · Footage · Adjustment · Cameras, Same type / source / label / name as the selected layer, All · Invert · None · Back — one click. The text animators are on Home too, Ctrl+K finds every button (also in Arabic), and look-alike names were cleaned up (Center Anchor is now Anchor → Centre, Clone Keys is Copy Keys).'],
  ['layers', 'Tools that go together, together', 'Flip Horizontal sits right next to Flip Vertical (one tile in Bento), Reverse · Mirror · Clone are one row, Align and Distribute come in pairs — in every style and at every panel width, and no tile drifts into another group any more.'],
  ['bake', 'Bake to Keyframes', 'Motion Kit › Bake: select a grid, cloner or trail null (or rigged layers) and its live expressions become plain keyframes over the work area — only the keys the motion needs. The comp gets lighter and plays anywhere without MOE; Restore brings the expressions back. Alt-click for a key on every frame.'],
  ['copy', 'Clone Trails', 'Select one animated layer and pick Echo, Ghost or Spin Trail: copies replay its motion a little later, fading, shrinking or turning copy by copy — live, no keyframes on the copies. Delay, Fade, Scale Step and Rotate Step sit on one MOE Trail null.'],
  ['check', 'Check in After Effects', 'Diagnostics › Check in After Effects runs MOE’s advanced tools in a temporary comp, compares what After Effects computed with MOE’s own maths (px, %, °, colour, ms), undoes everything and removes the comp. Copy the report and send it — it shows exactly what works on your machine.'],
  ['target', 'Live Preview', 'Every Effector now has a live preview in its settings: drag the null with the mouse and the items answer at once — Spring overshoot, Target aim, noise field, colour — with the same maths After Effects runs. Try it on a sample grid or on your own (Use my grid), then apply once.'],
  ['xWiggle', 'Field Effectors', 'Two new falloffs. Noise Field: a drifting noise decides which clones an effector reaches (Noise Grow, Noise Flicker). Image: the brightness of a layer under each clone is its weight — a logo, a gradient or a video (Image Grow, Image Reveal; select the layer with the grid).'],
  ['type', 'Object & Text Cloner', 'Clone on Points puts one copy on every point of a shape (select the layer and the shape). Text Cloner splits a title into one layer per word (or letter) exactly where it was — Arabic by words — so Effectors, colours and Build animate the words. New layouts: Points and In Place.'],
  ['target', 'Target & Audio Effectors', 'Two new effector types. Target: the clones turn to face the effector null as you move it (Aim, Look Near). Audio: the moves follow your soundtrack — MOE runs After Effects’ Convert Audio to Keyframes for you and each clone plays the beat a little later (Beat Pulse, Beat Wave).'],
  ['xBounce', 'Spring Effectors', 'Effectors can now move the clones through a real spring: Spring %, Frequency and Decay on the effector null. The items overshoot and settle as it passes — or, at Frequency 0, trail behind it with a smooth Inertia lag. New tiles: Spring Grow, Jelly, Inertia and Bounce Up.'],
  ['palette', 'Clone Colours', 'Give every clone its own colour: Colour Cycle, Gradient or Random from a MOE palette — the four colours stay live on the grid null. Effectors now have Colour + Colour Mix: the new Tint effector sweeps across and colours the clones it reaches.'],
  ['grid', 'Cloner + Effectors', 'Layer › Arrange · Clone · Effectors: select one layer and Clone it into a live grid, ring, spiral, sunflower or globe. Then select the grid and add an Effector — Grow, Reveal, Scatter, Step, Wave or Cascade: a MOE Effector null whose falloff and type move, scale, turn or fade the items near it. Move the null to animate it; up to three per grid.'],
  ['sliders', 'Settings open where you click', 'In every library a tile’s settings open right under its row (beside the tiles on a wider panel) — no more scrolling past the whole library. Motion shows In · Out · Draw On · Proximity one at a time, Layout shows Arrange · Guides · Cells, tools like Compositing are one-line rows that say what they do, and filters fit on one line.'],
  ['layout', 'Every tab sized by what it holds', 'Same tools, 25 groups → 15: Animate In / Out / Draw On is one block with a switch; Keyframes & Loops; Key & Color in the order of the job; Deliver & Project; Expressions has a Sliders switch (what Excite / Jump did). Motion Control stays compact until you select keys, empty Recent takes no space, and tiles fill their rows.'],
  ['easeCurve', 'Motion Control + Ease Copy', 'The speed / value graph now holds the anchor point and align beside it (filling the space — under the graph in a narrow panel); Copy ease / Paste ease are named buttons under the graph — one block on top of every style, each part as big as it needs. Copy the ease of selected keys (every segment) and Paste it on other keys or properties. After each tool, Next shows the steps that usually follow it.'],
  ['check', 'Fewer, clearer', 'One place per tool: the Quick Bar has 41 own actions and holds any preset as the tile itself (☆ next to Apply in a library); the Motion Kit rigs keep only what only they do; the anchor point takes half the space in NOW; the old styles are gone — Bento, Glass and MOE stay. Your saved bar, pins and pie keep working.'],
  ['sparkles', 'Organised the way you work', 'Home is now arranged by how often a motion designer reaches for things: the ten everyday tools first (Quick Bar, Alt+1…0), NOW for your selection, Power tools as big cards that explain themselves until you know them, then the stages Animate · Arrange · Design · Finish · Deliver — rare groups wait behind "More in…". Ctrl+1…5 jumps to a stage.'],
  ['sparkles', 'The Assistant — bottom-right corner', 'Press ` (or click the round button): ask anything about After Effects in Arabic or English, or describe a change — Claude answers and plans it with MOE tools, you approve, each step is verified. No key or offline? It still finds the right MOE tool from your words. A small number on the button = suggestions for your selection.'],
  ['layout', 'Knows your comp and your project', 'NOW shows the comp\'s shape and size (9:16 Reels, 1:1 feed, 16:9 YouTube, 4K…) and suggests the matching safe area. Each AE project remembers its client: switch projects and the client follows.'],
  ['glass', 'Thick Glass — real refraction', 'Design › Looks & Glass › Thick: turn a shape, title, logo or footage into thick glass that bends what is behind it. Bevel, frost, colour dispersion, chrome reflection, studio highlights, shadow and caustics — native effects, every amount a control on MOE Glass N. Seven looks (Thick Clear, Prism, Sugar, Bubble, Arctic Ice, Chrome, Liquid Gold); "One piece" makes several layers one glass. Edit the original layer as usual — the glass follows.'],
  ['brand', 'Your client\'s brand, in one click', 'Brand › Apply brand: client fonts by script (Arabic / English) and colours by role — headlines, body text, shapes and the background — on the selection or the whole comp, contrast-checked, one Undo. Saving a client from a website / PDF also adds its gradients to Backgrounds › Mine, and Brand ease moves keys the way the brand moves.'],
  ['sparkles', 'Brand from a website or PDF', 'Brand › From website / PDF: paste the client\'s site (or choose their brand book) and Claude fills the palette with roles, fonts matched to the ones you have installed, gradients, tone, how it should move and the rules. Review, then Save. Without an API key a website still gets a quick local scan.'],
  ['grid', 'Three styles: Bento, Glass, MOE', 'Bento is the default — pin any tile to NOW (right-click), fold sections, the index follows your scroll. Glass: Ctrl+1…4 between spaces, fold the Now card, Settings › Glass blur. MOE: every shortcut in a sidebar (menus by object + your whole Quick Bar), names with ⇔. Settings › Panel style.'],
  ['spark', 'Three new styles to choose from', '≡ › Panel layout (or Settings › New styles): Glass — frosted cards, four spaces by stage of work and a Now card; Apple — Settings-style lists with coloured icons and pages you open; Bento — one page where a tool\'s size is its importance and the big tool for your selection sits on top. Same tools in each; pick the one you like.'],
  ['spark', 'A cleaner, clearer panel', 'One design system: three button sizes, one icon family, the same corners and spacing everywhere. The tools you use most are bigger and come first in each group (Easy Ease, Reverse, Loop Cycle, Pre-compose, Center Anchor, Parent Null, Dup Comp); rare ones are small chips at the end. Motion Rigs look like every other action, links are quiet, and Out presets show their motion.'],
  ['grid', 'Your groups, your order', 'Drag a group by its header (or Alt+↑/↓) to put it where you want — each tab keeps your order; ▾ › Reset group order brings the original back. ▸ Recent at the top of every tab holds the last six things you ran from it. Keyboard: ↑/↓ between groups, ←/→ fold and open.'],
  ['grid', 'Classic is the final layout', 'After comparing the layouts on the same 12 everyday tasks, Classic stays. New: ▾ next to each tab (or right-click the tab) lists every action and preset of that tab — two clicks from anywhere. Ctrl 1…6 switch tabs. MOE ★ is still in ≡ › Panel layout.'],
  ['grid', 'Classic layout — organised like After Effects', 'Tabs named after AE\'s menus (Keys · Animate · Layer · Design · Effect · Comp), twirl-down groups like Effect Controls, a search like Effects & Presets (Ctrl K) and the ≡ panel menu. A dot shows which tab fits your selection; its groups open by themselves. Preset tiles apply in one click. Other layouts: ≡ › Panel layout.'],
  ['grid', 'Grid Builder 2', 'Switch a grid\'s Layout live (Effect Controls or the panel — controls and keyframes stay), Morph into a second layout with one slider, Orient (Forward / Face Center / Face Screen), drag items to new places without touching the layer stack, Twist / Delay for single items, and an Effector that also rotates, fades and attracts. Select a grid: the "Your grid" panel shows it all.'],
  ['background', 'Moving backgrounds', 'Backgrounds › pick a Motion for the colour points (Drift, Orbit, Swirl, Wave, Breathe, Wander) and how the Colours change (Cycle, Swap, Hue, Pulse). The preview shows it live; in AE it loops seamlessly and stays editable on three sliders: MOE BG Loop, Amount and Colour.'],
  ['star', 'MOE ★ — the recommended layout', 'Settings › Panel layout › MOE ★: menus by object (the one for your selection lights up, nothing moves), your Quick Bar in one row, and four task tabs — Animate · Design · Layout · Finish. More room for the graphs in a docked panel.'],
  ['grid', 'Try three panel layouts', 'Settings › Panel layout: Hub (screens + a Home that never changes), Command Bar (menus by object — the one for your selection lights up — plus your own bars) or Workspace (a context bar for the selection + four task tabs). Every tool keeps one place in each; Current is the v0.15 panel.'],
  ['spark', 'Home follows your selection', 'The top card shows what you selected and only the tools that fit it: keys → the ease graphs, keys and loops; a layer → animate in / out, rigs, anchor and align; text → text in; shapes → draw-on and arrange; nothing → create. The rest waits under More, folded — and stays the way you leave it for each kind of selection. Home › Layout: fixed brings the old order back.'],
  ['easeCurve', 'A curve for each segment', 'Select 3+ keys: the strip under the overview shows every segment as its curve. Click one (or click it in the overview) and the graph edits only that segment — each segment keeps its own ease. All = one curve on every segment.'],
  ['grid', 'Tidier panel', 'Every Home block folds from its title (remembered). The Toolbox groups tools: Motion rigs · Keyframes · Layers · Clean up. The Quick Bar fits one row, with +N for the rest; “Tools” is now Utilities.'],
  ['easeCurve', 'Value + Speed graphs together', 'Both graphs at once, both draggable — drag one and the other follows; hover shows the same moment on both. Alt + wheel fine-tunes. Presets are now just pictures of their curves; + saves without a name; Flip plays an ease backwards.'],
  ['alignCenter', 'Align, better', 'Two rows (↔ and ↕): align edges / centres, distribute centres, or Space evenly (equal gaps — or a fixed gap in px). Align to the selection, the key layer (first selected stays) or the comp; Alt-click = comp, Shift-click = key layer.'],
  ['kDelay', 'Delay = C4D: Even · Blend · Spring + Field', 'The three modes of Cinema 4D\'s Delay effector. Turn on Field (right-click Delay): a null sets how much delay each layer gets by its distance — move the null to sweep the effect, scale it to grow the field.'],
  ['easeCurve', 'Shape the curve from anywhere', 'Like Motion 4: press anywhere on the graph and drag — no need to catch a handle. Left = the start (ease out), right = the end (ease in), middle = both together. Sideways = how long it eases, up / down = shape or speed. Shift = fine, Ctrl = snap.'],
  ['kDelay', 'Delay — like C4D MoGraph', 'Spring (overshoot and settle), Blend (smooth lag) or Offset (time delay). One layer: its own move gets follow-through. Several: the others trail the first selected, each later. Live sliders in Effect Controls.'],
  ['easeCurve', 'Speed graph in real units', 'px/s, °/s, %/s like the Graph Editor; type exact speed + influence (Keyframe Velocity); an overview of the whole selected animation; Pass-through keeps the speed flowing through middle keys.'],
  ['kExcite', 'Home = your motion tools', 'Rebuilt after studying Motion 4 and Flow: Home now opens on the ease graph, the anchor grid, align and your pinned tools — every control acts on the selection in one click. All 18 tools and the curve library are in the Toolbox (Ctrl 2).'],
  ['easeCurve', 'Ease graph that reads your keys', 'Select keys: the graph shows their curve. Drag a handle and the curve lands on the keys when you let go. Presets apply on click (Shift = ease in, Ctrl = ease out). Easy Ease · Linear · Hold · Copy · Paste.'],
  ['anchor', 'Anchor in one click', '3 × 3 dots: click = anchor there, nothing moves — keyframes, scale, rotation, parenting and 3D included. Alt-click also puts the layer at that point of the comp.'],
  ['layers', 'Dock it next to the Timeline', 'Window › Extensions › MOE Motion Kit opens the kit as its own slim panel. Both panels share settings and history.'],
  ['kStare', 'New tools', 'Parent chain, Excite, Jump, Stare, Trim to keys, Linear / Hold, Vignette and Trash (removes MOE rigs). Right-click any tool for its options.'],
  ['pie', 'Pie menu', 'Hold Q (or the right mouse button), point and release. Eight actions that follow your selection — keyframes, text, shapes, layers — and the centre repeats your last change.'],
  ['layers', 'Five workspaces', 'The sidebar is now Home + Animate · Design · Layout · Finish · Tools, each with its sections as tabs. Ctrl 1–6 jumps between them.'],
  ['wand', 'For this selection', 'Home shows the actions that fit what you selected, one click each.'],
  ['play', 'Apply bar & ▶ on every tile', 'The selected preset and Apply stay pinned at the bottom of every library. Hover a tile and press ▶ to apply it in one click.'],
  ['repeat', 'Repeat last (F4)', 'Applied something you like? Select the next layers and press F4 — or the ↻ chip in the selection line.'],
  ['search', 'Search applies presets', 'Ctrl K now finds presets too: type "pop", press Enter, done. Shift+Enter only opens it.'],
  ['eye', 'Tiles tell you first', 'Tiles the selection cannot run are dimmed with the reason; setup tiles open their settings instead of failing.'],
  ['grid', 'Tidier sidebar', 'Sections grouped as Animate · Design · Layout · Finish · Utilities. Hide the ones you never use in Settings › Sidebar.'],
  ['search', 'Search & previews fixed', 'Mouse clicks in search (Ctrl K) always register, text previews rest on a readable frame, and the Quick Bar scrolls with the mouse wheel.'],
  ['spark', 'Copilot works again', 'Fixed "Claude API error 400: compiled grammar is too large". Plans are still checked locally before you approve anything.'],
  ['shapes', 'Shapes & Icons', '1,899 vector icons and 22 native shapes. Insert as editable shape layers — line, solid, line + fill or duotone — with draw-on, pop or fade.'],
  ['background', 'Backgrounds', '32 curated palettes as linear, radial or mesh gradients, with film grain and a slow looping drift.'],
  ['palette', 'Colorize from palette', 'Recolour a whole selection in one click: cycle, shuffle or blend through a palette. Save any palette as a client.'],
  ['expr', '33 one-click expressions', '16 new: bounce landing, squash & stretch, orbit, swing, heartbeat, breathe, organic & loop wiggle, drift, clock ticks, face motion, scatter, auto pop-in / slide-in.'],
  ['easeCurve', 'Ease library', '8 visual ease curves (gentle → expo, decelerate, hard stop, launch) and 7 new animations (rise, drop, cascade, soft pop, pop / spin out).'],
  ['home', 'Home', 'Your comp at a glance, quick starts, recent tools, favourites and a tip of the day.'],
  ['presets', 'My Presets', 'Save any Inspector setting as your own tile, then export / import preset packs to share with the team.'],
  ['contrast', 'Appearance', 'Midnight theme, 8 accent colours, reduced motion and a new display typeface — all contrast-checked.']
];

const SHORTCUTS = [
  // v0.28: by distance — what you do all day first
  [['Alt', '1…0'], 'Everyday: run the first ten Quick Bar buttons (Easy Ease, Out Expo, Anchor → Centre, Parent Null, Pre-compose, Stagger, Loop, Wiggle, Reverse, Dup Comp) — hold Alt to see the numbers'],
  [['F4'], 'Repeat the last change on the current selection'],
  [['Q', 'hold'], 'Pie menu: point and release (tap Q to keep it open, 1–8 to choose)'],
  [['`'], 'Assistant: ask a question or describe a change (also Ctrl+Space; Esc closes)'],
  [['Ctrl', 'K'], 'Search every tool'],
  [['Ctrl', '1…5'], 'Bento and Glass: jump to a stage — Animate · Arrange · Design · Finish · Deliver (MOE style: 1…6 = its AE-menu tabs)'],
  [['↑', '↓'], 'On a group header: previous / next group (Home / End: first / last)'],
  [['←', '→'], 'On a group header: fold / open it'],
  [['Alt', '↑ ↓'], 'On a group header: move the group (or drag its header) — saved per tab'],
  [['Right button', 'hold'], 'Pie menu with the mouse'],
  [['?'], 'Show this sheet'],
  [['Esc'], 'Close sheets and dialogs'],
  [['Enter'], 'In search: apply a preset / open a tool'],
  [['Shift', 'Enter'], 'In search: open without applying'],
  [['▶', '/ Double-click'], 'Apply a tile now'],
  [['Right-click'], 'Quick Bar button options'],
  [['Enter'], 'Confirm a dialog']
];

function sheet(app, kind) {
  const close = () => app.state.set({ modal: null });
  const version = app.services.version;
  let title, body;
  if (kind === 'about') {
    const lib = require('../../features/design/shapesLib');
    title = 'About MOE Studio';
    body = h('div', { class: 'about' },
      h('div', { class: 'about-hero' }, h('span', { html: art.logo(56) }), h('div', {},
        h('div', { class: 'about-name' }, 'MOE Motion AI'),
        h('div', { class: 'why' }, `Studio ${version} · After Effects 2025 · CEP 12`),
        h('div', { class: 'why' }, 'A workbench of real tools. Works offline; Claude is optional.'))),
      h('dl', { class: 'kv' },
        h('dt', {}, 'Tools'), h('dd', {}, String(app.services.registry.list().length)),
        h('dt', {}, 'Icons'), h('dd', {}, `${lib.count().toLocaleString('en-US')} (Lucide, ISC licence)`),
        h('dt', {}, 'Typeface'), h('dd', {}, 'Sora (SIL Open Font License 1.1)'),
        h('dt', {}, 'Data folder'), h('dd', {}, app.services.store.dataDir || '—')),
      h('div', { class: 'why' }, 'Licences ship in extension/assets/icons/LICENSE-lucide.txt and extension/assets/fonts/LICENSE-sora-OFL.txt.'));
  } else if (kind === 'whatsnew') {
    title = `What's new in ${version}`;
    body = h('div', { class: 'wn-list' }, WHATS_NEW.map(([ic, t, d]) => h('div', { class: 'wn-item' }, h('span', { class: 'wn-ic' }, icon(ic)), h('div', {}, h('div', { class: 'wn-t' }, t), h('div', { class: 'why' }, d)))));
  } else {
    title = 'Keyboard & mouse';
    body = h('div', { class: 'kb-list' }, SHORTCUTS.map(([keys, d]) => h('div', { class: 'kb-row' }, h('span', { class: 'kb-keys' }, keys.map((k) => h('kbd', {}, k))), h('span', {}, d))));
  }
  const overlay = h('div', { class: 'overlay sheet-overlay', onmousedown: (e) => { if (e.target === overlay) close(); } },
    h('div', { class: `sheet sheet-${kind}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div', { class: 'sheet-h' }, h('span', { class: 'sheet-title' }, title), h('span', { class: 'spacer' }), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: close }, icon('x', 'sm'))),
      h('div', { class: 'sheet-b' }, body),
      kind === 'whatsnew' ? h('div', { class: 'sheet-f' }, h('button', { class: 'btn primary', onclick: () => { close(); app.go('home'); } }, icon('kExcite', 'sm'), 'Show me'), h('button', { class: 'btn ghost', onclick: close }, 'Later')) : null));
  return overlay;
}

/* ---------- splash ---------- */
function splash(onDone) {
  const el = h('div', { class: 'splash', role: 'presentation', onclick: () => finish() },
    h('div', { class: 'splash-mark', html: art.logo(64) }),
    h('div', { class: 'splash-name' }, 'MOE Studio'),
    h('div', { class: 'splash-bar' }, h('span', {})));
  let gone = false;
  function finish() { if (gone) return; gone = true; el.classList.add('out'); setTimeout(() => { el.remove(); if (onDone) onDone(); }, 260); }
  setTimeout(finish, theme.reducedMotion() ? 300 : 1100);
  return el;
}

module.exports = { banner, markBannerSeen, sheet, splash, counts, COPY, WHATS_NEW, SHORTCUTS };
