'use strict';
/**
 * Style Kits (v0.75, owner: "the tools for a SaaS-style video in one window, the tools for the Apple Glass style in one
 * window — any look or technique with its own style gets its tools gathered in one place; general tools stay where they
 * are"). A kit is a curated page of EXISTING one-click refs (tile: / quick: / nav:) in the order a designer builds that
 * look — never a copy of a tool or a second engine (FEWER_CLEARER). Pure data, resolved by actions.resolve (tested).
 */
const KITS = [
  {
    id: 'saas', kind: 'look', label: 'SaaS Product Video', icon: 'uiKit', accent: ['#2F6BFF', '#7AA2FF'],
    tagline: 'Product UI that clicks, reveals and zooms — the launch-video look',
    recipes: [
      { id: 'clickPunch', label: 'Click & Punch', hint: 'A cursor click on the layer, then the camera punches in', refs: ['tile:productui/ui-click', 'tile:zoom/punch'] },
      { id: 'riseSpot', label: 'Rise & Spotlight', hint: 'The layer rises in, then the spotlight finds it', refs: ['tile:animate/riseFade', 'tile:zoom/spot'] }
    ],
    steps: [
      { label: '1 · Backdrop', refs: ['tile:backgrounds/bg-productNight', 'tile:backgrounds/bg-studioLight', 'tile:backgrounds/bg-auroraProduct', 'tile:backgrounds/bg-graphite'] },
      { label: '2 · Build the UI', refs: ['tile:productui/ui-button', 'tile:productui/ui-search', 'tile:productui/ui-toggle', 'tile:productui/ui-task', 'tile:productui/ui-notify', 'tile:productui/ui-stat', 'tile:productui/ui-chat', 'tile:productui/ui-progress'] },
      { label: '3 · Bring it in', refs: ['tile:productui/ui-reveal', 'tile:productui/ui-revealCenter', 'tile:animate/riseFade', 'tile:animate/wipeInL', 'tile:animate/depthIn', 'tile:layout/carousel'] },
      { label: '4 · Interact', refs: ['tile:productui/ui-click', 'tile:productui/ui-tap', 'tile:zoom/cursorArrow', 'tile:zoom/cursorHand', 'tile:zoom/clickLayers'] },
      { label: '5 · Camera', refs: ['tile:zoom/punch', 'tile:zoom/smooth', 'tile:zoom/spot', 'tile:zoom/detail'] }
    ]
  },
  {
    id: 'glass', kind: 'look', label: 'Apple Glass', icon: 'glass', accent: ['#93C5FD', '#F0ABFC'],
    tagline: 'Liquid glass over soft colour, blur-in moves, quiet light',
    recipes: [
      { id: 'liquidCard', label: 'Liquid Card', hint: 'Liquid glass, a soft shadow under it, a blur-in entrance', refs: ['tile:looks/glass-liquid', 'tile:looks/style-softShadow', 'tile:animate/blurIn'] },
      { id: 'frostFocus', label: 'Frost & Focus', hint: 'Frosted glass that comes into focus', refs: ['tile:looks/glass-frosted', 'tile:animate/focusIn'] }
    ],
    steps: [
      { label: '1 · Soft colour behind', refs: ['tile:backgrounds/bg-holographic', 'tile:backgrounds/bg-oceanGlass', 'tile:backgrounds/bg-auroraProduct', 'tile:backgrounds/bg-studioLight', 'tile:backgrounds/bg-cosmicLatte'] },
      { label: '2 · Glass', refs: ['tile:looks/glass-liquid', 'tile:looks/glass-frosted', 'tile:looks/glass-clear', 'tile:looks/glass-crystal', 'tile:looks/thick-glaze', 'tile:looks/thick-prism', 'tile:looks/thick-bubble'] },
      { label: '3 · Light & depth', refs: ['tile:looks/style-softShadow', 'tile:looks/style-lightSweep', 'tile:looks/style-glow'] },
      { label: '4 · Apple moves', refs: ['tile:animate/blurIn', 'tile:animate/focusIn', 'tile:animate/riseBlur', 'tile:animate/whipIn', 'tile:animate/gentlePop', 'tile:animate/blurOut'] },
      { label: '5 · Ease', refs: ['tile:animate/easeExpo', 'tile:animate/easeDecel', 'tile:animate/easeSmooth'] }
    ]
  },
  {
    id: 'kinetic', kind: 'look', label: 'Kinetic Type', icon: 'type', accent: ['#FF7A59', '#FFC857'],
    tagline: 'Words that move with the voice — Arabic by words, Latin by letters',
    recipes: [
      { id: 'wordCascade', label: 'Word Cascade', hint: 'Split the text into words, then cascade them in', refs: ['tile:layout/textWords', 'tile:layout/efCascade'] }
    ],
    steps: [
      { label: '1 · Text animations', refs: ['nav:text', 'quick:typewriter', 'quick:counter'] },
      { label: '2 · Split & clone', refs: ['tile:layout/textWords', 'tile:layout/textLetters', 'tile:layout/efCascade', 'tile:layout/efWave'] },
      { label: '3 · Rhythm', refs: ['quick:k_beats', 'tile:expressions/x-markerPulse', 'tile:expressions/x-markerTrigger', 'tile:expressions/x-markerInOut'] },
      { label: '4 · Accent', refs: ['tile:animate/shake-bump', 'tile:animate/shake-zoomPunch', 'tile:zoom/punch'] }
    ]
  },
  {
    id: 'social', kind: 'look', label: 'Social & Reels', icon: 'gTiktok', accent: ['#F72585', '#3ABFF8'],
    tagline: 'Vertical, on the beat, inside the safe zone',
    recipes: [
      { id: 'reelPop', label: 'Reel Pop', hint: 'Reels safe zone on, then a pop-in with a slam', refs: ['tile:layout/gpReels', 'tile:animate/popIn', 'tile:animate/shake-slam'] }
    ],
    steps: [
      { label: '1 · Safe zones', refs: ['tile:layout/gpTiktok', 'tile:layout/gpReels', 'tile:layout/gpShorts', 'tile:layout/gpStories', 'tile:layout/gpClear'] },
      { label: '2 · On the beat', refs: ['quick:k_beats', 'tile:expressions/x-markerPulse', 'tile:layout/efBeat'] },
      { label: '3 · Energy', refs: ['tile:animate/popIn', 'tile:animate/whipIn', 'tile:animate/shake-slam', 'tile:animate/shake-whip', 'tile:zoom/punch'] },
      { label: '4 · Hooks', refs: ['tile:templates/tpl-handle', 'tile:templates/tpl-tag', 'tile:templates/tpl-callout', 'tile:templates/tpl-endCard'] }
    ]
  },
  {
    // v0.76 (owner: "a list for an advanced technique like the professional Effectors, with more ideas in it")
    id: 'effectors', kind: 'technique', label: 'Effectors Pro', icon: 'target', accent: ['#34D399', '#22D3EE'],
    tagline: 'Clones that react — shape, physics, fields, sound and colour, in build order',
    recipes: [
      { id: 'rippleWall', label: 'Ripple Wall', hint: 'A grid of clones, a wave through it, a gradient over it', refs: ['tile:layout/cloneGrid', 'tile:layout/efWave', 'tile:layout/colGradient'] },
      { id: 'springBloom', label: 'Spring Bloom', hint: 'A grid of clones that grows with a spring and lights up', refs: ['tile:layout/cloneGrid', 'tile:layout/efSpring', 'tile:layout/efTint'] },
      { id: 'jellyRing', label: 'Jelly Ring', hint: 'A ring of clones that wobbles like jelly, coloured at random', refs: ['tile:layout/cloneRing', 'tile:layout/efJelly', 'tile:layout/colRandom'] },
      { id: 'noiseField', label: 'Living Field', hint: 'A grid that breathes with a noise field and flickers', refs: ['tile:layout/cloneGrid', 'tile:layout/efField', 'tile:layout/efFlicker'] }
    ],
    steps: [
      { label: '1 · Clone', refs: ['tile:layout/cloneGrid', 'tile:layout/cloneRing', 'tile:layout/cloneSpiral', 'tile:layout/cloneGlobe', 'tile:layout/textWords'] },
      { label: '2 · Shape', refs: ['tile:layout/efPush', 'tile:layout/efShrink', 'tile:layout/efReveal', 'tile:layout/efStep', 'tile:layout/efScatter', 'tile:layout/efWave', 'tile:layout/efCascade'] },
      { label: '3 · Physics', refs: ['tile:layout/efSpring', 'tile:layout/efJelly', 'tile:layout/efInertia', 'tile:layout/efBounce'] },
      { label: '4 · Fields', refs: ['tile:layout/efField', 'tile:layout/efFlicker', 'tile:layout/efImage', 'tile:layout/efImageReveal'] },
      { label: '5 · Aim & sound', refs: ['tile:layout/efAim', 'tile:layout/efLook', 'tile:layout/efBeat', 'tile:layout/efBeatWave'] },
      { label: '6 · Colour & trails', refs: ['tile:layout/efTint', 'tile:layout/colGradient', 'tile:layout/colRandom', 'tile:layout/trailEcho', 'tile:layout/trailGhost'] }
    ]
  },
  {
    // v0.77: sound-driven motion as one technique (Beat Markers come from After Effects' own Convert Audio to Keyframes)
    id: 'beat', kind: 'technique', label: 'Beat Sync', icon: 'gTiktok', accent: ['#F59E0B', '#EF4444'],
    tagline: 'Find the beats, then make layers, clones and hits land on them',
    recipes: [
      { id: 'pulseOnBeat', label: 'Pulse on the Beat', hint: 'Beat markers on the layer, then it pulses on each one', refs: ['quick:k_beats', 'tile:expressions/x-markerPulse'] }
    ],
    steps: [
      { label: '1 · Find the beat', refs: ['quick:k_beats'] },
      { label: '2 · React to markers', refs: ['tile:expressions/x-markerPulse', 'tile:expressions/x-markerTrigger', 'tile:expressions/x-markerInOut'] },
      { label: '3 · Keep a pulse', refs: ['tile:expressions/x-heartbeat', 'tile:expressions/x-pulse', 'tile:expressions/x-blink'] },
      { label: '4 · Clones on sound', refs: ['tile:layout/efBeat', 'tile:layout/efBeatWave'] },
      { label: '5 · Hits', refs: ['tile:animate/shake-bump', 'tile:animate/shake-slam', 'tile:animate/shake-zoomPunch', 'tile:zoom/punch'] }
    ]
  },
  {
    // v0.77: motion that never stops — idle life for anything that would otherwise sit still
    id: 'loops', kind: 'technique', label: 'Living Loops', icon: 'xLoop', accent: ['#8B5CF6', '#EC4899'],
    tagline: 'Idle life: float, breathe, swing and loop — nothing sits dead on screen',
    recipes: [
      { id: 'floatBreathe', label: 'Float & Breathe', hint: 'A slow float on Position and a breath on Scale', refs: ['tile:expressions/x-float', 'tile:expressions/x-breathe'] },
      { id: 'popSettle', label: 'Pop & Settle', hint: 'A soft pop in, then it keeps drifting', refs: ['tile:animate/gentlePop', 'tile:expressions/x-drift'] }
    ],
    steps: [
      { label: '1 · Breathe', refs: ['tile:expressions/x-float', 'tile:expressions/x-breathe', 'tile:expressions/x-drift', 'tile:expressions/x-organic'] },
      { label: '2 · Loop your keys', refs: ['tile:expressions/x-loopCycle', 'tile:expressions/x-loopPingPong', 'tile:expressions/x-loopOffset', 'tile:expressions/x-loopInOut', 'tile:expressions/x-loopWiggle'] },
      { label: '3 · Swing & turn', refs: ['tile:expressions/x-pendulum', 'tile:expressions/x-swing', 'tile:expressions/x-orbit', 'tile:expressions/x-timeRotate'] },
      { label: '4 · Follow-through', refs: ['tile:animate/gentlePop', 'tile:expressions/x-inertia', 'tile:expressions/x-squash', 'tile:expressions/x-bounceBack', 'quick:k_delay'] }
    ]
  },
  {
    id: 'mograph', kind: 'technique', label: 'MoGraph Cloner', icon: 'grid', accent: ['#22D3EE', '#A78BFA'],
    tagline: 'Clones, effectors and trails — the procedural look',
    recipes: [
      { id: 'ringScatter', label: 'Ring Scatter', hint: 'A ring of clones, scattered, coloured at random', refs: ['tile:layout/cloneRing', 'tile:layout/efScatter', 'tile:layout/colRandom'] }
    ],
    steps: [
      { label: '1 · Clone', refs: ['tile:layout/cloneGrid', 'tile:layout/cloneRing', 'tile:layout/cloneSpiral', 'tile:layout/cloneGlobe', 'tile:layout/wall', 'tile:layout/galaxy'] },
      { label: '2 · Effectors', refs: ['tile:layout/efWave', 'tile:layout/efPush', 'tile:layout/efScatter', 'tile:layout/efSpring', 'tile:layout/efField', 'tile:layout/efTint'] },
      { label: '3 · Colour & trails', refs: ['tile:layout/colGradient', 'tile:layout/colRandom', 'tile:layout/trailEcho', 'tile:layout/trailGhost'] }
    ]
  }
];

const byId = (id) => KITS.find((k) => k.id === id) || null;
/** Every ref a kit uses (tests check each resolves to a real tool). */
const refsOf = (kit) => kit.steps.reduce((all, s) => all.concat(s.refs), []);
const KINDS = [['look', 'Looks', 'A finished style, start to end'], ['technique', 'Techniques', 'An advanced method, tool by tool']];
/**
 * v0.76 progress (pure): which steps have a tool that ran (`done` = { ref: true }), and the first that has none —
 * the step to do next. Session memory only: it describes what you did here, never what is in the comp.
 */
function progress(kit, done) {
  const d = done || {};
  const steps = kit.steps.map((s) => s.refs.some((r) => d[r]));
  const next = steps.indexOf(false);
  return { steps, next, count: steps.filter(Boolean).length, total: steps.length };
}


/**
 * v0.77 My Recipes (pure): a user's chain is 2–4 of the kit's OWN runnable refs, each once, with a name no other
 * recipe of that kit has. → { ok, recipe } or { ok: false, error }.
 */
const MINE_MAX = 12;
function makeRecipe(kit, label, refs, mine) {
  const own = refsOf(kit);
  const list = (refs || []).filter((r, i, a) => a.indexOf(r) === i);
  if (list.length < 2) return { ok: false, error: 'Pick at least two tools' };
  if (list.length > 4) return { ok: false, error: 'A recipe is at most four tools' };
  if (list.some((r) => own.indexOf(r) < 0 || /^nav:/.test(r))) return { ok: false, error: 'A recipe uses this kit\'s own tools only' };
  if ((mine || []).length >= MINE_MAX) return { ok: false, error: `At most ${MINE_MAX} recipes of your own per kit` };
  let name = String(label || '').replace(/\s+/g, ' ').trim().slice(0, 32) || 'My recipe';
  const taken = (kit.recipes || []).concat(mine || []).map((r) => r.label.toLowerCase());
  for (let n = 2, base = name; taken.indexOf(name.toLowerCase()) >= 0; n++) name = `${base} ${n}`;
  return { ok: true, recipe: { id: `my_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`, label: name, hint: 'Your recipe', refs: list, mine: true } };
}

module.exports = { KITS, KINDS, byId, refsOf, progress, makeRecipe, MINE_MAX };
