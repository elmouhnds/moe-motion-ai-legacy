'use strict';
/**
 * Workflow organisation (v0.28, docs/features/WORKFLOW_HOME.md).
 *
 * The owner's brief: tools were listed "like a bot that memorised a menu". This module arranges
 * the SAME tools the way a motion designer with years in After Effects reaches for them:
 *
 *   distance = how often you use it
 *     0 clicks   keyboard: Alt+1…0 (Everyday), F4 repeat, Q pie, Ctrl+K search, ` assistant
 *     always     Everyday bar (the Quick Bar's first ten) + the floating assistant
 *     top        NOW: what you selected → the big tool for it + its best actions
 *     next       Power tools: the deep features, as big cards that explain themselves until you
 *                have used them (then they shrink to a chip — you no longer need the lesson)
 *     page       Stages, ordered by how often a motion designer is in them:
 *                Animate · Arrange · Design · Finish · Deliver. In each stage the everyday groups
 *                are open; rare groups wait behind "More in <stage>".
 *     search     everything else (Ctrl+K)
 *
 *   the comp decides too: its shape and size (9:16 Reels, 1:1 feed, 16:9 YouTube, 4K…) and the
 *   project you are in (each AE project remembers its client) — designers juggle many jobs.
 *
 * Stages reuse the groups of layoutAE.TABS (one source of tools: same buttons, tiers, Recent memory).
 * Everything here is pure or store-only, so it is testable without a DOM.
 */

/* ---------- stages: [tab id, group id, 'core' | 'more'] ---------- */
const STAGES = [
  // v0.31: the groups were merged by job (Animate In / Out / Draw On is one block, Keyframes & Loops, Key & Color,
  // Deliver & Project); ease, anchor and align are in the Motion Control on top of every stage.
  { id: 'st-animate', label: 'Animate', icon: 'motion', fits: ['keys', 'layer', 'text', 'shapes'],
    title: 'Animate in / out, draw on, keyframes and loops, text — where most of the day goes',
    groups: [['ae-animate', 'in', 'core'], ['ae-keys', 'assist', 'core'], ['ae-animate', 'text', 'core'], ['ae-animate', 'expr', 'more']] },
  { id: 'st-arrange', label: 'Arrange', icon: 'alignCenter', fits: ['layers', 'shapesMany'],
    title: 'Transform, parent and link, grids — putting layers where they belong (anchor and align: Motion Control)',
    groups: [['ae-layer', 'transform', 'core'], ['ae-layer', 'parent', 'core'], ['ae-layer', 'arrange', 'core'], ['ae-comp', 'guides', 'more']] },
  { id: 'st-design', label: 'Design', icon: 'palette', fits: ['none'],
    title: 'Shapes and icons, backgrounds, looks and glass, the client brand',
    groups: [['ae-design', 'shapes', 'core'], ['ae-design', 'bg', 'core'], ['ae-design', 'looks', 'core'], ['ae-design', 'brand', 'core']] },
  { id: 'st-finish', label: 'Finish', icon: 'sparkles', fits: [],
    title: 'Key and colour, camera and zoom — the polish pass',
    groups: [['ae-effect', 'keycolor', 'core'], ['ae-effect', 'zoom', 'core']] },
  { id: 'st-deliver', label: 'Deliver', icon: 'download', fits: [],
    title: 'Every format at once, project housekeeping',
    groups: [['ae-comp', 'project', 'core']] }
];
const STAGE_IDS = STAGES.map((s) => s.id);

/** The stage's groups as { tab, group, tier } (unknown ids are skipped). */
function stageGroups(stage) {
  const AE = require('./layoutAE');
  return stage.groups.map(([tabId, gid, tier]) => {
    const tab = AE.TABS.find((t) => t.id === tabId);
    const group = tab && tab.groups.find((g) => g.id === gid);
    return group ? { tab, group, tier } : null;
  }).filter(Boolean);
}
/** The stage a page (library / view) belongs to — for the crumb. */
function stageOfView(view) {
  const AE = require('./layoutAE');
  const tab = AE.ownerOf(view);
  if (!tab) return null;
  // the stage holding the group that opens this page (its "All …" link, a link, or its library), else the tab's first stage
  const opens = (g) => !!g && (g.more === view || g.section === view || (g.links || []).concat(g.lead || []).some(([id]) => id === view));
  return STAGES.find((st) => st.groups.some(([t, gid]) => t === tab.id && opens(tab.groups.find((g) => g.id === gid))))
    || STAGES.find((st) => st.groups.some(([t, , tier]) => t === tab.id && tier === 'core'))
    || STAGES.find((st) => st.groups.some(([t]) => t === tab.id)) || null;
}

/* ---------- Everyday: the ten things a motion designer does all day (Quick Bar slots 1–10, Alt+1…0) ---------- */
// Ordered by how often, not by menu: ease, curve, anchor, parent, pre-compose, sequence, loop, wiggle, reverse, duplicate.
const EVERYDAY = ['k_easy', 'curveExpo', 'centerAnchor', 'parentNull', 'precompose', 'k_stagger', 'tile:expressions/x-loopCycle', 'tile:expressions/x-wiggle', 'reverse', 'dupComp'];
const SLOT_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/* ---------- Power tools: deep features that deserve a big card with an explanation ---------- */
// open = where it lives (nav:…), try = the one-click start (optional), fits = selections it suits.
const POWER = [
  { id: 'ease', title: 'Motion Control', icon: 'easeCurve', open: 'nav:kit', try: 'quick:curveExpo', fits: ['keys'],
    what: 'One block for how it moves and where it sits: the speed / value graph, Ease Copy (copy the ease of keys, paste it on others), the anchor point and align — right beside the graph.',
    when: 'Every animation: shape the ease, reuse it on other layers, then place and line them up.',
    needs: 'Select two or more keyframes (anchor / align: layers)',
    steps: ['Select keys — the graph reads their ease', 'Drag a handle, or Copy and Paste the ease onto other keys', 'Anchor and align from the rail beside the graph'] },
  { id: 'grid', title: 'Cloner & Effectors', icon: 'grid', open: 'nav:layout', try: 'tile:layout/cloneRing', fits: ['layer', 'layers', 'shapesMany'],
    what: 'Clone one layer into a live grid, ring, spiral, sunflower or globe — or arrange many — then add Effectors: nulls that grow, reveal, scatter, step, wave, cascade or tint the items near them, and give the clones a palette. MoGraph in After Effects, all live.',
    when: 'Logo walls, icon fields, particle-like patterns, data cards, kinetic backgrounds.',
    needs: 'One layer to clone (or several to arrange); for an Effector, the grid',
    steps: ['Select a layer → Clone (Ring, Grid, Sunflower…)', 'Select the grid → Effector (Reveal, Wave, Cascade…)', 'Move or keyframe the MOE Effector null'] },
  { id: 'thickGlass', title: 'Thick Glass', icon: 'glass', open: 'nav:looks', try: 'tile:looks/thick-glaze', fits: ['layer', 'text', 'shapes'],
    what: 'Turn a shape, text or logo into thick glass that bends the footage behind it — refraction, chrome, dispersion.',
    when: 'Hero titles, UI cards and logos over footage.',
    needs: 'Select one to eight 2D layers',
    steps: ['Select the layer', 'Pick a look (Clear, Prism, Chrome…)', 'Animate the Glass controls'] },
  { id: 'deliver', title: 'Every format at once', icon: 'download', open: 'nav:deliver', fits: ['none'],
    what: 'Make 16:9, 9:16, 1:1 and 4:5 versions of a comp with the layout adapted, in one go.',
    when: 'Social campaigns, ads, cut-downs.',
    needs: 'An open composition',
    steps: ['Open the master comp', 'Tick the formats', 'Check each version, then render'] },
  { id: 'brand', title: 'Brand Kit', icon: 'brand', open: 'nav:brand', try: 'brand:apply', fits: ['layers', 'text'],
    what: "Keep each client's colours, fonts and motion feel — read them from their website or PDF, apply in one click.",
    when: 'Every client job.',
    needs: 'A client (add one from a website or PDF)',
    steps: ['Add or pick the client', 'Select layers', 'Apply brand — colours checked for contrast'] },
  { id: 'zoom', title: 'Zoom & Cursor', icon: 'zoom', open: 'nav:zoom', try: 'tile:zoom/punch', fits: ['layer'],
    what: 'Punch-in zooms, follow-cam, spotlight and an animated cursor for screen recordings.',
    when: 'Product demos, app promos, tutorials.',
    needs: 'Select the footage layer',
    steps: ['Select the screen recording', 'Pick Punch, Follow or Spotlight', 'Move the focus point'] },
  { id: 'backgrounds', title: 'Animated Backgrounds', icon: 'background', open: 'nav:backgrounds', fits: ['none'],
    what: 'Gradients, mesh and grain that loop perfectly, with live sliders.',
    when: 'Title cards, social posts, lower thirds.',
    needs: 'An open composition',
    steps: ['Pick a background', 'Tune colours and motion', 'It loops by itself'] },
  { id: 'keying', title: 'Green screen & colour', icon: 'copyGreen', open: 'nav:compositing', fits: [],
    what: 'Key setup in one click, match colour between shots, grade with readable sliders.',
    when: 'Shot footage, composites, mixed sources.',
    needs: 'Select the footage layer',
    steps: ['Select the footage', 'Key Setup or Match Colour', 'Fine-tune in Effect Controls'] }
];
const LEARN_KEY = 'wf-learned';
const LEARNED_AT = 3; // after three uses the card no longer needs its lesson
function learnedMap(store) { return store.get(LEARN_KEY, {}) || {}; }
const isLearned = (store, id) => { const v = learnedMap(store)[id]; return v === 'got' || (typeof v === 'number' && v >= LEARNED_AT); };
function learn(store, id) {
  const all = Object.assign({}, learnedMap(store));
  if (all[id] !== 'got') all[id] = (typeof all[id] === 'number' ? all[id] : 0) + 1;
  store.set(LEARN_KEY, all);
}
const gotIt = (store, id) => store.set(LEARN_KEY, Object.assign({}, learnedMap(store), { [id]: 'got' }));
const explainAgain = (store) => store.set(LEARN_KEY, {});

/* ---------- the comp's shape and size (multi-format work) ---------- */
/** Classify a comp: shape (vertical / portrait / square / landscape / wide), size label, where it usually goes. Pure. */
function formatOf(comp) {
  if (!comp || !comp.width || !comp.height) return null;
  const w = comp.width * (comp.pixelAspect || 1), h = comp.height;
  const r = w / h;
  const long = Math.max(comp.width, comp.height);
  const shape = r < 0.7 ? 'vertical' : r < 0.9 ? 'portrait' : r <= 1.1 ? 'square' : r < 2 ? 'landscape' : 'wide';
  const ratio = { vertical: '9:16', portrait: '4:5', square: '1:1', landscape: '16:9', wide: `${(r).toFixed(2)}:1` }[shape];
  const exact = { vertical: 9 / 16, portrait: 4 / 5, square: 1, landscape: 16 / 9 }[shape];
  const size = long >= 3840 ? '4K' : long >= 2560 ? '2.5K' : long >= 1920 ? 'HD' : long >= 1280 ? '720p' : `${comp.width}×${comp.height}`;
  const use = { vertical: 'Reels · TikTok · Shorts', portrait: 'Instagram feed', square: 'Feed post', landscape: 'YouTube · TV · web', wide: 'Banner · cinema' }[shape];
  return {
    shape, ratio: exact && Math.abs(r - exact) > 0.02 ? `${r.toFixed(2)}:1` : ratio, size, use,
    fps: comp.frameRate ? Math.round(comp.frameRate * 100) / 100 : null,
    label: `${comp.width}×${comp.height}`
  };
}
/**
 * Safe-area guides sized for this comp. Social (vertical / portrait / square) keeps clear of the app's
 * buttons and captions: ~6 % of the width at the sides and ~14 % (vertical) / 8 % of the height top and
 * bottom — approximations, the platforms move their UI. Video formats use the classic title-safe 5 % / 5 %.
 */
function safeArgs(comp) {
  const f = formatOf(comp);
  if (!f) return null;
  const social = f.shape !== 'landscape' && f.shape !== 'wide';
  const mx = Math.round(comp.width * (social ? 0.06 : 0.05));
  const my = Math.round(comp.height * (f.shape === 'vertical' ? 0.14 : social ? 0.08 : 0.05));
  return { columns: 1, rows: 1, gutterX: 0, gutterY: 0, marginX: mx, marginY: my, center: true };
}

/* ---------- suggestions (the assistant's quiet badge; never a pop-up) ---------- */
/**
 * Up to three suggestions for what you have in front of you. Pure: ctx (context.get), plus
 * { brand: active client or null, dismissed: Set of `${compId}:${tipId}` }.
 * A tip runs a ref (tile: / quick: / brand:) or a tool with computed args.
 */
function tips(ctx, opts) {
  const o = opts || {};
  const out = [];
  if (!ctx || !ctx.comp) return out;
  const A = require('./actions');
  const kind = A.profile(ctx);
  const f = formatOf(ctx.comp);
  const n = (ctx.layers || []).length;
  const keys = (ctx.properties || []).reduce((s, p) => s + ((p.selectedKeys || []).length), 0);
  const add = (t) => { if (!(o.dismissed && o.dismissed.has(`${ctx.comp.id}:${t.id}`))) out.push(t); };
  if (kind === 'keys' && keys >= 2) add({ id: 'ease', icon: 'easeCurve', text: `${keys} keyframes selected — give them a curve`, label: 'Out Expo', ref: 'quick:curveExpo' });
  if ((kind === 'layers' || kind === 'shapesMany' || kind === 'text') && n >= 3) add({ id: 'stagger', icon: 'kDelay', text: `${n} layers — offset them one after another`, label: 'Stagger', ref: 'quick:k_stagger' });
  if (o.brand && kind !== 'none' && kind !== 'keys') add({ id: 'brand', icon: 'brand', text: `Working for ${o.brand.name} — use their colours and fonts`, label: 'Apply brand', ref: 'brand:apply' });
  if (f && f.shape !== 'landscape' && f.shape !== 'wide') add({ id: 'safe', icon: 'guides', text: `${f.ratio} ${f.use} comp — keep text clear of the app's buttons`, label: 'Social safe area', tool: 'grid.guides', args: safeArgs(ctx.comp) });
  if (kind === 'none' && n === 0 && ctx.comp.numLayers === 0) add({ id: 'empty', icon: 'background', text: 'Empty comp — start with a background', label: 'Backgrounds', ref: 'nav:backgrounds' });
  return out.slice(0, 3);
}
const TIP_KEY = 'wf-tips-off';
function dismissedTips(store) { return new Set((store.get(TIP_KEY, []) || []).slice(-200)); }
function dismissTip(store, compId, tipId) {
  const list = (store.get(TIP_KEY, []) || []).filter((x) => x !== `${compId}:${tipId}`);
  list.push(`${compId}:${tipId}`);
  store.set(TIP_KEY, list.slice(-200));
}

/* ---------- each AE project remembers its client ---------- */
const PROJ_KEY = 'wf-projects';
/**
 * Called whenever the context is read. Learns which client you use in which project, and when you
 * switch to another project that has a client, makes it the active one. Returns
 * { switched: brand | null }. Pure apart from the store; `brands` is the brand service.
 */
function syncProject(store, ctx, brands, last) {
  const name = ctx && ctx.project && ctx.project.name;
  if (!name || name === 'Untitled Project') return { switched: null, project: name || null };
  const K = require('../../features/brand/kit');
  const mem = Object.assign({}, store.get(PROJ_KEY, {}) || {});
  const active = K.activeBrand(store, brands);
  if (last && last !== name && mem[name] && mem[name].brandId && (!active || active.id !== mem[name].brandId)) {
    const b = (brands.list ? brands.list() : []).find((x) => x.id === mem[name].brandId);
    if (b) { K.setActive(store, b.id); return { switched: b, project: name }; }
  }
  if (active && (!mem[name] || mem[name].brandId !== active.id)) {
    mem[name] = { brandId: active.id, at: Date.now() };
    // keep the 60 most recent projects
    const keys = Object.keys(mem).sort((a, b) => (mem[b].at || 0) - (mem[a].at || 0));
    keys.slice(60).forEach((k) => delete mem[k]);
    store.set(PROJ_KEY, mem);
  }
  return { switched: null, project: name };
}

/* ---------- the assistant without AI: words → tools (works offline, Arabic or English) ---------- */
// Common Egyptian / Arabic ways motion designers say things → the English word the tools use.
// Short words are matched as whole words (optionally with ال / و / ب / ل in front), so "عايز" is not "ايز".
const word = (alts) => new RegExp(`(^|[\\s،,.؟?!])(ال|و|ب|ل|وال|بال)?(${alts})(?=$|[\\s،,.؟?!])`);
const AR_WORDS = [
  [word('ايز|إيز|ايزي|إيزي|ايزنج|ايزينج|سموث|ناعم|نعومة'), 'ease'], [word('سناب|سنابي|سريع|حاد'), 'snappy'], [/اوفر ?شوت|أوفر ?شوت|ارتداد|يرتد/, 'overshoot'], [word('نط|ينط|يتنطط'), 'overshoot'],
  [/لوب|تكرار|يكرر|يتكرر/, 'loop'], [/ويجل|ويجيل|اهتزاز|يهتز|رعشة/, 'wiggle'], [/انكر|أنكر|نقطة الارتكاز|نقطه الارتكاز/, 'anchor'],
  [word('بارنت|بيرنت|ربط|نل|نال'), 'parent'], [/بري ?كومب|بريكومبوز|تجميع/, 'precompose'], [/جريد|شبكة|شبكه/, 'grid'], [/كلونر|كلون|نسخ كتير|تكرار عناصر|موجراف|ماجراف/, 'clone'], [/ايفكتور|إيفكتور|افكتور|مؤثر|موجة|موجه/, 'effector'], [/دايرة|دائرة|دايره|حلقة/, 'ring'],
  [/زجاج|جلاس|قزاز/, 'glass'], [/خلفية|خلفيه|باك ?جراوند/, 'background'], [word('نص|نصوص|كتابة|كتابه|تايتل|عنوان|تكست'), 'text'],
  [/تايب ?رايتر|حرف حرف|كلمة كلمة|كلمه كلمه/, 'typewriter'], [/عداد|ارقام|أرقام/, 'counter'], [/براند|هوية|هويه|كلاينت/, 'brand'],
  [/زوم|تقريب/, 'zoom'], [/ماوس|كيرسر|كرسر|مؤشر/, 'cursor'], [/كروما|جرين ?سكرين|اخضر|أخضر|كيينج|كي ?اينج/, 'key'],
  [word('الوان|ألوان|لون|تلوين|جريدينج|جريد لون'), 'color'], [/مقاس|فورمات|ريلز|تيك ?توك|عمودي|ستوري|استوري/, 'deliver'], [/سيف|هوامش|منطقة آمنة|منطقه امنه/, 'safe'],
  [/دخول|ظهور|يدخل|يظهر/, 'in'], [/خروج|اختفاء|يخرج|يختفي/, 'out'], [word('فيد|فيد ان|فيد اوت|تلاشي'), 'fade'], [/يترسم|رسم|تريم|ستروك/, 'trim'],
  [/ستاجر|تتابع|ورا بعض|واحد ورا/, 'stagger'], [/محاذاة|محاذاه|يصطف|الاين/, 'align'], [word('توزيع|وزع|وزعهم'), 'distribute'], [/عكس|ريفيرس/, 'reverse'],
  [/ايكون|أيقون|ايقون|اشكال|أشكال/, 'icon'], [/وميض|يرمش|بلينك/, 'blink'], [/سكيل|يكبر|تكبير/, 'scale'], [word('لف|يلف|دوران|روتيشن'), 'rotation']
];
const STOP = new Set(['the', 'a', 'an', 'to', 'it', 'this', 'that', 'these', 'those', 'and', 'or', 'of', 'on', 'in', 'for', 'with', 'make', 'do', 'how', 'can', 'i', 'my', 'me', 'please', 'add', 'selected', 'layer', 'layers', 'want', 'from', 'then', 'is', 'be', 'some', 'more', 'all', 'them', 'they']);
/** Words of a request → up to six tool keywords (Arabic phrases translated). Pure. */
function keywordsOf(q) {
  const text = String(q || '').toLowerCase();
  const out = [];
  for (const [re, w] of AR_WORDS) if (re.test(text) && !out.includes(w)) out.push(w);
  for (const w of text.replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)) if (w.length > 2 && !STOP.has(w) && !out.includes(w)) out.push(w);
  return out.slice(0, 6);
}
/** Power cards whose words match the request — the offline assistant explains them. Pure. */
function powerFor(q) {
  const kw = keywordsOf(q);
  if (!kw.length) return [];
  return POWER.map((p) => ({ p, n: kw.filter((k) => `${p.id} ${p.title} ${p.what} ${p.when}`.toLowerCase().includes(k)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 2).map((x) => x.p);
}

/** Quick prompts for the assistant, by kind of selection (fixed lists). */
const PROMPTS = {
  keys: ['Make these keys snappy', 'Add a soft overshoot', 'Loop this animation'],
  text: ['Type this on word by word', 'Animate the title in from below', 'Count up the number'],
  layer: ['Pop this in, then float gently', 'Fade it out at the end', 'Center the anchor point'],
  layers: ['Animate them in one after another', 'Arrange them in a grid', 'Parent them to a null'],
  shapes: ['Draw this shape on', 'Wiggle it gently', 'Repeat it around a circle'],
  shapesMany: ['Draw them on one after another', 'Arrange them in a ring', 'Animate them in one after another'],
  none: ['How do I make a 9:16 version of this?', 'Add safe-area guides', 'What can MOE do with screen recordings?']
};

/* ---------- v0.30: what usually comes next (tools ordered by the job, not by name) ---------- */
/**
 * After a tool runs, NOW offers the steps that usually follow it in a motion designer's job — the
 * sequence of the work: animate in → shape the ease → offset the layers → animate out; draw on → ease →
 * stagger; anchor → scale / rotate moves; align → distribute → animate them in one after another.
 * Keyed by the tool id of the last run (state.last.toolId). Fixed lists (memory), at most four.
 */
const NEXT = {
  'quick.animate': ['quick:curveExpo', 'quick:k_stagger', 'tile:animate/fadeOut', 'quick:precompose'],
  'quick.trimPaths': ['quick:curveExpo', 'quick:k_stagger', 'tile:animate/trimErase', 'tile:expressions/x-wiggle'],
  'motion.smartEase': ['quick:k_stagger', 'tile:expressions/x-loopCycle', 'quick:mirror', 'quick:reverse'],
  'motion.easeCurve': ['quick:k_stagger', 'tile:expressions/x-loopCycle', 'quick:mirror', 'quick:reverse'],
  'motion.pasteEase': ['quick:k_stagger', 'tile:expressions/x-loopCycle', 'quick:mirror', 'quick:reverse'],
  'motion.stagger': ['tile:animate/fadeOut', 'quick:precompose', 'quick:parentNull', 'quick:k_delay'],
  'transform.anchor': ['tile:animate/popIn', 'tile:animate/spinIn', 'tile:expressions/x-pendulum', 'tile:expressions/x-pulse'],
  'proximity.centerAnchor': ['tile:animate/popIn', 'tile:animate/spinIn', 'tile:expressions/x-pendulum', 'tile:expressions/x-pulse'],
  'transform.align': ['quick:distH', 'quick:parentNull', 'tile:animate/cascadeIn', 'tile:layout/grid'],
  'grid.build': ['tile:layout/efReveal', 'tile:layout/efWave', 'tile:layout/efCascade', 'quick:precompose'],
  'grid.effector': ['tile:layout/efScatter', 'tile:layout/colGradient', 'quick:precompose', 'tile:zoom/punch'],
  'grid.colour': ['tile:layout/efTint', 'tile:layout/efWave', 'quick:precompose', 'tile:zoom/punch'],
  'quick.parentToNull': ['tile:expressions/x-float', 'quick:k_delay', 'tile:animate/popIn', 'quick:precompose'],
  'quick.precompose': ['tile:animate/fadeIn', 'tile:zoom/punch', 'quick:dupComp', 'quick:revealProject'],
  'quick.typewriter': ['tile:animate/fadeOut', 'brand:apply', 'quick:counter', 'quick:k_stagger'],
  'quick.reverseKeys': ['quick:curveExpo', 'quick:mirror', 'quick:k_stagger', 'tile:expressions/x-loopPingPong'],
  'transform.clone': ['tile:expressions/x-timeRotate', 'quick:k_stagger', 'quick:parentNull', 'tile:animate/popIn']
};
/** The next steps after the last run (refs that resolve), or [] (pure apart from actions.resolve). */
function nextAfter(last) {
  if (!last || !NEXT[last.toolId]) return [];
  const A = require('./actions');
  return NEXT[last.toolId].filter((r) => A.resolve(r)).slice(0, 4);
}

module.exports = { NEXT, nextAfter, AR_WORDS, keywordsOf, powerFor, PROMPTS, STAGES, STAGE_IDS, stageGroups, stageOfView, EVERYDAY, SLOT_KEYS, POWER, LEARN_KEY, LEARNED_AT, isLearned, learn, gotIt, explainAgain,
  formatOf, safeArgs, tips, dismissedTips, dismissTip, TIP_KEY, syncProject, PROJ_KEY };
