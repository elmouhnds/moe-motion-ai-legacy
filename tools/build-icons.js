'use strict';
/**
 * Builds extension/assets/icons/lucide.json from the pinned `lucide-static` dev dependency.
 * Lucide is ISC-licensed (some icons MIT, from Feather); the licence text ships next to the data.
 *
 *   node tools/build-icons.js
 *
 * Output: { version, count, categories: [{ id, label, count }], icons: { name: { n: nodes, t: tags, c: category } } }
 * nodes = Lucide's own element list ([tag, attrs]) on a 24×24 grid, stroke-based.
 */
const fs = require('fs');
const path = require('path');

const PKG = path.join(__dirname, '..', 'node_modules', 'lucide-static');
const OUT = path.join(__dirname, '..', 'extension', 'assets', 'icons');

/* Name-based categories, first match wins. Tags are searched too, so these only need to be sensible. */
const RULES = [
  ['arrows', 'Arrows', /^(arrow|arrows|chevron|chevrons|corner|move|undo|redo|repeat|refresh|rotate|iteration|redo|forward|reply|merge|split|git|route|signpost|navigation|send-to|shuffle|expand|shrink|fold|unfold|maximize|minimize|scaling|trending|step-|skip-|fast-forward|rewind)/],
  ['shapes', 'Shapes', /^(gem|dot|cross|asterisk|astroid|circle|square|triangle|hexagon|octagon|pentagon|diamond|star|heart|shapes|cone|cylinder|pyramid|torus|box|boxes|blend|spline|squircle|badge|shield|ribbon|cuboid|sphere|rectangle|egg|blob|ellipse)/],
  ['media', 'Media', /^(clef|eighth-note|half-note|quarter-note|whole-note|metronome|midi|captions|closed-caption|headset|headphone|boom-box|hd|eject|play|pause|stop|music|video|film|camera|mic|volume|speaker|headphones|radio|tv|clapperboard|image|images|disc|cassette|podcast|airplay|cast|aperture|projector|record|audio|audio-lines|audio-waveform|drum|guitar|piano|ear|monitor-play|youtube|instagram|twitch|vibrate|webcam|gallery|focus|scan|frame|crop|flip|picture|sliders|equal|repeat-1|square-play|circle-play|list-music|list-video)/],
  ['communication', 'Communication', /^(message|messages|mail|mails|phone|send|at-sign|bell|megaphone|inbox|contact|voicemail|rss|share|link|quote|speech|languages|reply|sticky|forum|letter|postcard|hand-helping)/],
  ['commerce', 'Commerce', /^(shopping|shop|cart|credit|wallet|dollar|euro|pound|yen|indian|bitcoin|tag|tags|gift|receipt|store|banknote|coins|piggy|percent|ticket|handshake|landmark|briefcase|badge-percent|badge-dollar|package|barcode|qr|scale|calculator|chart-candlestick)/],
  ['weather', 'Weather & Sky', /^(galaxy|bubbles|sun|moon|cloud|clouds|rain|snow|wind|umbrella|thermometer|zap|rainbow|tornado|snowflake|haze|sunrise|sunset|droplet|droplets|waves|flame|cloudy|eclipse|orbit|sparkle|sparkles|stars|telescope|satellite|rocket|planet|earth|globe)/],
  ['nature', 'Nature & Animals', /^(leaf|leafy|tree|trees|flower|sprout|mountain|shell|bird|fish|paw|bug|cat|dog|rabbit|squirrel|turtle|snail|rat|worm|feather|bone|clover|shrub|vegan|wheat|cherry|apple|grape|citrus|banana|carrot|bean|nut|egg-fried|palmtree|tent|trees|origami|panda|birdhouse|bee|butterfly|cow|horse|pig|cannabis|flower-2|fishing)/],
  ['people', 'People & Hands', /^(face|user|users|person|baby|hand|hands|smile|frown|meh|laugh|angry|annoyed|accessibility|contact-round|venus|mars|bot|ghost|skull|footprints|brain|heart-handshake|thumbs|pointer|grab|biceps|accessibility|eye|ear|glasses|shirt|crown|party|cake|drama|speech)/],
  ['devices', 'Devices & Tech', /^(cpu|monitor|laptop|smartphone|tablet|server|database|wifi|bluetooth|battery|code|terminal|keyboard|mouse|printer|hard-drive|usb|plug|cable|router|signal|network|binary|braces|brackets|bug|cog|settings|power|memory|microchip|gamepad|joystick|watch|tv-minimal|webhook|radar|qr-code|scan|nfc|antenna|satellite-dish|cctv|projector|computer|app-window|panel|layout|sidebar|square-terminal|file-code|regex|variable|function|sigma|pi|infinity|atom|dna|flask|test-tube|microscope|beaker|magnet|calculator|currency)/],
  ['files', 'Files & Office', /^(file|files|folder|folders|clipboard|book|books|notebook|notepad|sticky-note|paperclip|archive|library|newspaper|scroll|form|table|sheet|presentation|kanban|list|text|pen|pencil|eraser|highlighter|signature|stamp|printer|copy|save|download|upload|import|cloud-upload|cloud-download|inbox|trash|scissors|ruler|pin|bookmark|tag|calendar|clock|timer|hourglass|alarm|history|watch|square-pen)/],
  ['travel', 'Travel & Places', /^(plane|car|bus|train|tram|bike|ship|sailboat|map|compass|globe|navigation|anchor|caravan|fuel|parking|traffic|tractor|truck|ambulance|helicopter|rocket|luggage|hotel|building|buildings|church|castle|warehouse|factory|house|home|school|hospital|store|landmark|tent|mountain-snow|milestone|signpost|route|locate|map-pin|earth|briefcase|bed|bath|sofa|armchair|door|fence|lamp|lightbulb|construction|cable-car|ferris|drill|hammer|wrench|shovel|pickaxe|axe)/],
  ['charts', 'Charts & Data', /^(chart|trending|activity|gauge|kpi|bar-chart|line-chart|pie|area-chart|scatter|candlestick|presentation|target|crosshair|radar|sigma|percent|calculator|sheet|table|database|filter|funnel|sort|arrow-down-0|arrow-up-0|list-ordered|align|columns|rows|grid|layout|kanban|gantt|network|workflow|git)/],
  ['food', 'Food & Drink', /^(coffee|cup|pizza|apple|beer|wine|martini|glass-water|milk|cookie|croissant|sandwich|soup|salad|utensils|chef|cooking|popcorn|ice-cream|candy|lollipop|donut|cake|cherry|grape|citrus|banana|carrot|drumstick|ham|beef|egg|fish|hop|wheat|bottle|cup-soda|refrigerator|microwave)/],
  ['sports', 'Sports & Games', /^(trophy|medal|award|dumbbell|volleyball|dribbble|goal|flag|dices|dice|puzzle|gamepad|swords|sword|crown|chess|spade|club|joystick|bike|tent|ticket|party|target|timer|footprints|biceps|fish-symbol|ribbon)/],
  ['editing', 'Text & Design', /^(type|bold|italic|underline|strikethrough|align|text|heading|pilcrow|baseline|case|letter|spell|whole-word|subscript|superscript|indent|outdent|wrap|palette|paint|paintbrush|brush|pipette|swatch|pen-tool|vector|spline|bezier|lasso|crop|frame|grid|ruler|layers|layer|group|ungroup|component|blend|contrast|sun-medium|droplet|paint-bucket|eraser|wand|sparkles|stamp|figma|framer|scissors|scaling|move|rotate|flip|square-dashed|dashed|mouse-pointer|pointer|hand)/],
  ['security', 'Security', /^(lock|unlock|key|shield|eye|fingerprint|scan-face|siren|alarm-smoke|bomb|radiation|biohazard|skull|ban|octagon-alert|triangle-alert|circle-alert|badge-alert|vault|id-card|user-lock|file-lock)/],
  ['ui', 'Interface', /^(menu|settings|sliders|toggle|panel|grid|list|check|x|plus|minus|search|filter|home|house|log-in|log-out|more|ellipsis|grip|info|help|circle-help|badge-check|badge-info|loader|refresh|external-link|link|maximize|minimize|expand|shrink|zoom|bell|bookmark|star|heart|thumbs|share|copy|clipboard|trash|edit|square-pen|pencil|eye|toggle|power|app-window|layout|sidebar|panel|columns|rows|separator|square-menu|command|option|delete|keyboard|mouse-pointer|scan|qr|text-cursor|form-input|rectangle-ellipsis|cookie|sun-moon|bolt)/]
];

function categorize(name) {
  for (const [id, , re] of RULES) if (re.test(name)) return id;
  return 'other';
}

function compactNodes(nodes) {
  return nodes.map(([tag, attrs]) => {
    const a = {};
    for (const [k, v] of Object.entries(attrs)) if (k !== 'key') a[k] = v;
    return [tag, a];
  });
}

function build() {
  const nodes = JSON.parse(fs.readFileSync(path.join(PKG, 'icon-nodes.json'), 'utf8'));
  const tags = JSON.parse(fs.readFileSync(path.join(PKG, 'tags.json'), 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).version;
  const icons = {};
  const counts = {};
  for (const name of Object.keys(nodes).sort()) {
    const c = categorize(name);
    counts[c] = (counts[c] || 0) + 1;
    icons[name] = { n: compactNodes(nodes[name]), t: tags[name] || [], c };
  }
  const categories = [...RULES.map(([id, label]) => ({ id, label })), { id: 'other', label: 'More' }]
    .map((c) => Object.assign(c, { count: counts[c.id] || 0 })).filter((c) => c.count);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'lucide.json'), JSON.stringify({ source: 'lucide-static', version, license: 'ISC (see LICENSE-lucide.txt)', count: Object.keys(icons).length, categories, icons }));
  fs.copyFileSync(path.join(PKG, 'LICENSE'), path.join(OUT, 'LICENSE-lucide.txt'));
  return { count: Object.keys(icons).length, categories };
}

if (require.main === module) {
  const r = build();
  console.log(`lucide.json: ${r.count} icons`);
  for (const c of r.categories) console.log(`  ${c.label.padEnd(18)} ${c.count}`);
}

module.exports = { build, categorize, RULES };
