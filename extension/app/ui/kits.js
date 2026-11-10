'use strict';
/**
 * Style Kits (v0.75, owner: "the tools for a SaaS-style video in one window, the tools for the Apple Glass style in one
 * window — any look or technique with its own style gets its tools gathered in one place; general tools stay where they
 * are"). A kit is a curated page of EXISTING one-click refs (tile: / quick: / nav:) in the order a designer builds that
 * look — never a copy of a tool or a second engine (FEWER_CLEARER). Pure data, resolved by actions.resolve (tested).
 */
const KITS = [
  {
    id: 'saas', label: 'SaaS Product Video', icon: 'uiKit', accent: ['#2F6BFF', '#7AA2FF'],
    tagline: 'Product UI that clicks, reveals and zooms — the launch-video look',
    steps: [
      { label: '1 · Backdrop', refs: ['tile:backgrounds/bg-productNight', 'tile:backgrounds/bg-studioLight', 'tile:backgrounds/bg-auroraProduct', 'tile:backgrounds/bg-graphite'] },
      { label: '2 · Build the UI', refs: ['tile:productui/ui-button', 'tile:productui/ui-search', 'tile:productui/ui-toggle', 'tile:productui/ui-task', 'tile:productui/ui-notify', 'tile:productui/ui-stat', 'tile:productui/ui-chat', 'tile:productui/ui-progress'] },
      { label: '3 · Bring it in', refs: ['tile:productui/ui-reveal', 'tile:productui/ui-revealCenter', 'tile:animate/riseFade', 'tile:animate/wipeInL', 'tile:animate/depthIn', 'tile:layout/carousel'] },
      { label: '4 · Interact', refs: ['tile:productui/ui-click', 'tile:productui/ui-tap', 'tile:zoom/cursorArrow', 'tile:zoom/cursorHand', 'tile:zoom/clickLayers'] },
      { label: '5 · Camera', refs: ['tile:zoom/punch', 'tile:zoom/smooth', 'tile:zoom/spot', 'tile:zoom/detail'] }
    ]
  },
  {
    id: 'glass', label: 'Apple Glass', icon: 'glass', accent: ['#93C5FD', '#F0ABFC'],
    tagline: 'Liquid glass over soft colour, blur-in moves, quiet light',
    steps: [
      { label: '1 · Soft colour behind', refs: ['tile:backgrounds/bg-holographic', 'tile:backgrounds/bg-oceanGlass', 'tile:backgrounds/bg-auroraProduct', 'tile:backgrounds/bg-studioLight', 'tile:backgrounds/bg-cosmicLatte'] },
      { label: '2 · Glass', refs: ['tile:looks/glass-liquid', 'tile:looks/glass-frosted', 'tile:looks/glass-clear', 'tile:looks/glass-crystal', 'tile:looks/thick-glaze', 'tile:looks/thick-prism', 'tile:looks/thick-bubble'] },
      { label: '3 · Light & depth', refs: ['tile:looks/style-softShadow', 'tile:looks/style-lightSweep', 'tile:looks/style-glow'] },
      { label: '4 · Apple moves', refs: ['tile:animate/blurIn', 'tile:animate/focusIn', 'tile:animate/riseBlur', 'tile:animate/whipIn', 'tile:animate/gentlePop', 'tile:animate/blurOut'] },
      { label: '5 · Ease', refs: ['tile:animate/easeExpo', 'tile:animate/easeDecel', 'tile:animate/easeSmooth'] }
    ]
  },
  {
    id: 'kinetic', label: 'Kinetic Type', icon: 'type', accent: ['#FF7A59', '#FFC857'],
    tagline: 'Words that move with the voice — Arabic by words, Latin by letters',
    steps: [
      { label: '1 · Text animations', refs: ['nav:text', 'quick:typewriter', 'quick:counter'] },
      { label: '2 · Split & clone', refs: ['tile:layout/textWords', 'tile:layout/textLetters', 'tile:layout/efCascade', 'tile:layout/efWave'] },
      { label: '3 · Rhythm', refs: ['quick:k_beats', 'tile:expressions/x-markerPulse', 'tile:expressions/x-markerTrigger', 'tile:expressions/x-markerInOut'] },
      { label: '4 · Accent', refs: ['tile:animate/shake-bump', 'tile:animate/shake-zoomPunch', 'tile:zoom/punch'] }
    ]
  },
  {
    id: 'social', label: 'Social & Reels', icon: 'gTiktok', accent: ['#F72585', '#3ABFF8'],
    tagline: 'Vertical, on the beat, inside the safe zone',
    steps: [
      { label: '1 · Safe zones', refs: ['tile:layout/gpTiktok', 'tile:layout/gpReels', 'tile:layout/gpShorts', 'tile:layout/gpStories', 'tile:layout/gpClear'] },
      { label: '2 · On the beat', refs: ['quick:k_beats', 'tile:expressions/x-markerPulse', 'tile:layout/efBeat'] },
      { label: '3 · Energy', refs: ['tile:animate/popIn', 'tile:animate/whipIn', 'tile:animate/shake-slam', 'tile:animate/shake-whip', 'tile:zoom/punch'] },
      { label: '4 · Hooks', refs: ['tile:templates/tpl-handle', 'tile:templates/tpl-tag', 'tile:templates/tpl-callout', 'tile:templates/tpl-endCard'] }
    ]
  },
  {
    id: 'mograph', label: 'MoGraph Cloner', icon: 'grid', accent: ['#22D3EE', '#A78BFA'],
    tagline: 'Clones, effectors and trails — the procedural look',
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

module.exports = { KITS, byId, refsOf };
