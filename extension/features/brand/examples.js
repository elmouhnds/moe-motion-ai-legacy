'use strict';
/**
 * Three example clients (v0.73, owner: "make 3 default brand kits so this section can be previewed and judged").
 * They are ordinary clients (same shape as brands.js; a profile like an import makes) marked `profile.example`, so the
 * page shows an *Example* badge and Manage can add them back after you delete them. Fonts are Windows' own (Segoe UI,
 * Tahoma, Georgia, Sakkal Majalla, Palatino Linotype); Brand › Type says when one is not installed on this machine.
 * Colours carry roles, so Apply brand picks headline / body / shape / background colours exactly (applyAll.brandRoles).
 */
const SEED_KEY = 'brand-examples-seeded';

const EXAMPLES = [
  {
    id: 'example_nile_roast', name: 'Nile Roast',
    colors: [
      { name: 'Espresso', hex: '#2B1A12', role: 'background' },
      { name: 'Caramel', hex: '#C8763A', role: 'primary' },
      { name: 'Clay', hex: '#8C4A2F', role: 'secondary' },
      { name: 'Honey', hex: '#E9B872', role: 'accent' },
      { name: 'Crema', hex: '#F7EFE6', role: 'text' }
    ],
    fonts: { arabic: { ps: 'Tahoma-Bold', family: 'Tahoma', style: 'Bold' }, english: { ps: 'Georgia-Bold', family: 'Georgia', style: 'Bold' }, extra: [] },
    notes: 'Specialty coffee from Cairo. Warm, slow, crafted.',
    profile: {
      example: true, tagline: 'Slow mornings, roasted by the Nile',
      gradients: [{ name: 'Morning roast', stops: ['#2B1A12', '#8C4A2F', '#E9B872'] }],
      tone: { keywords: ['warm', 'crafted', 'calm'], description: 'Talks like a barista who knows you.' },
      motion: { feel: 'Soft, unhurried entrances; steam-like drifts', easing: 'smooth', pace: 'slow' },
      rules: ['Keep the logo on Espresso or Crema only', 'Honey is for highlights — never body text', 'Arabic first on local posts']
    }
  },
  {
    id: 'example_pulse_pay', name: 'Pulse Pay',
    colors: [
      { name: 'Night', hex: '#0B1020', role: 'background' },
      { name: 'Pulse Blue', hex: '#5B8CFF', role: 'primary' },
      { name: 'Mint', hex: '#22D3B6', role: 'secondary' },
      { name: 'Signal', hex: '#F5C542', role: 'accent' },
      { name: 'Ice', hex: '#F4F6FF', role: 'text' }
    ],
    fonts: { arabic: { ps: 'SegoeUI-Bold', family: 'Segoe UI', style: 'Bold' }, english: { ps: 'SegoeUI-Bold', family: 'Segoe UI', style: 'Bold' }, extra: [] },
    notes: 'A payments app. Fast, precise, friendly.',
    profile: {
      example: true, tagline: 'Money at the speed of a tap',
      gradients: [{ name: 'Pulse', stops: ['#0B1020', '#5B8CFF', '#22D3B6'] }, { name: 'Signal', stops: ['#5B8CFF', '#F5C542'] }],
      tone: { keywords: ['fast', 'clear', 'friendly'], description: 'Short sentences, numbers up front.' },
      motion: { feel: 'Snappy UI moves, clicks that press in place', easing: 'snappy', pace: 'fast' },
      rules: ['Numbers in Signal yellow only when they are the point', 'Never more than two accent colours in a frame', 'UI mockups on Night']
    }
  },
  {
    id: 'example_sahara_atelier', name: 'Sahara Atelier',
    colors: [
      { name: 'Sand', hex: '#F6EFE4', role: 'background' },
      { name: 'Oasis', hex: '#1E3A34', role: 'primary' },
      { name: 'Brass', hex: '#B08D57', role: 'secondary' },
      { name: 'Terracotta', hex: '#B5482A', role: 'accent' },
      { name: 'Ink', hex: '#1A1A1A', role: 'text' }
    ],
    fonts: { arabic: { ps: 'SakkalMajalla-Bold', family: 'Sakkal Majalla', style: 'Bold' }, english: { ps: 'PalatinoLinotype-Roman', family: 'Palatino Linotype', style: 'Roman' }, extra: [] },
    notes: 'A Gulf fashion house. Quiet luxury, Arabic-first.',
    profile: {
      example: true, tagline: 'صُنع بصبر — made with patience',
      gradients: [{ name: 'Dune', stops: ['#F6EFE4', '#B08D57'] }, { name: 'Oasis night', stops: ['#1E3A34', '#0F1E1B'] }],
      tone: { keywords: ['quiet', 'luxury', 'heritage'], description: 'Few words, generous space.' },
      motion: { feel: 'Gentle reveals by words, long holds', easing: 'gentle', pace: 'slow' },
      rules: ['Arabic headline first, English below it', 'Brass for lines and frames, not large fills', 'Leave a third of the frame empty']
    }
  }
];

/** Save the examples once, the first time Brand opens with no clients (never over your own). */
function seedOnce(store, brands) {
  if (store.get(SEED_KEY, false) || brands.list().length) return 0;
  store.set(SEED_KEY, true);
  return EXAMPLES.filter((b) => brands.save(JSON.parse(JSON.stringify(b))).ok).length;
}
/** Add the examples that are not in the list (Manage › Add the examples). */
function addMissing(brands) {
  const have = new Set(brands.list().map((b) => b.id));
  return EXAMPLES.filter((b) => !have.has(b.id)).filter((b) => brands.save(JSON.parse(JSON.stringify(b))).ok).length;
}
const isExample = (b) => !!(b && b.profile && b.profile.example);

module.exports = { EXAMPLES, SEED_KEY, seedOnce, addMissing, isExample };
