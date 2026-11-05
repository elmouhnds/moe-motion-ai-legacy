'use strict';
/**
 * Guide presets (v0.53, docs/features/GUIDE_PRESETS.md) — pure. The guides a motion designer adds every day, as data:
 * composition lines (Centre, Golden ratio), broadcast safe areas and the social-media safe zones of vertical video.
 *
 *   PRESETS            [{ id, label, group, hint, ... }]
 *   lines(id, W, H)    → { v: [x], h: [y], box?: { x, y, w, h }, ref?, note? }   (positions in comp pixels)
 *
 * Social zones: the apps' own buttons and captions cover the top, the bottom and the right edge. The margins are the
 * figures most widely published for a 1080 × 1920 frame (TikTok / Reels from the same comparison table, Shorts top /
 * bottom / right from its own guide, Stories = Meta's 14 % top and bottom). They are approximate — the apps change
 * their interface — so the result says so, and they scale with the comp (x by W / 1080, y by H / 1920).
 */
const SOCIAL = {
  tiktok: { label: 'TikTok', t: 220, b: 480, l: 60, r: 140 },
  reels: { label: 'Reels', t: 270, b: 670, l: 65, r: 120 },
  shorts: { label: 'Shorts', t: 120, b: 300, l: 60, r: 96 },
  stories: { label: 'Stories', t: 250, b: 250, l: 0, r: 0 }
};
const REF = [1080, 1920];

const PRESETS = [
  { id: 'center', label: 'Centre', group: 'Grid', hint: 'One vertical and one horizontal guide through the middle' },
  { id: 'golden', label: 'Golden', group: 'Grid', hint: 'Golden-ratio lines at 38.2 % and 61.8 % on both axes' },
  { id: 'tvSafe', label: 'Title / Action', group: 'Safe', hint: 'Broadcast safe areas: action 93 %, title 90 % of the frame (SMPTE ST 2046-1)' },
  { id: 'tiktok', label: 'TikTok', group: 'Social', social: true, hint: 'Keep text and faces inside: the app covers the top, the caption area and the right-side buttons' },
  { id: 'reels', label: 'Reels', group: 'Social', social: true, hint: 'Instagram Reels: the caption and buttons cover the bottom third and the right edge' },
  { id: 'shorts', label: 'Shorts', group: 'Social', social: true, hint: 'YouTube Shorts: channel name and subscribe at the bottom, buttons on the right' },
  { id: 'stories', label: 'Stories', group: 'Social', social: true, hint: 'Instagram / Facebook Stories: 14 % top and bottom for the profile bar and the reply field' },
  { id: 'clear', label: 'Clear', group: 'Clear', hint: 'Remove every guide in the comp (Undo brings them back)' }
];
const byId = (id) => PRESETS.find((p) => p.id === id);
const r2 = (v) => Math.round(v * 100) / 100;
const uniq = (a) => [...new Set(a.map(r2))].sort((x, y) => x - y);

/** The guides of one preset in a W × H comp. */
function lines(id, W, H) {
  if (id === 'center') return { v: [r2(W / 2)], h: [r2(H / 2)] };
  if (id === 'golden') { const g = 1 - 0.618; return { v: uniq([W * g, W * (1 - g)]), h: uniq([H * g, H * (1 - g)]) }; }
  if (id === 'tvSafe') {
    // action safe = 93 % (3.5 % each side), title safe = 90 % (5 % each side)
    return { v: uniq([W * 0.035, W * 0.05, W * 0.95, W * 0.965]), h: uniq([H * 0.035, H * 0.05, H * 0.95, H * 0.965]), box: { x: W * 0.05, y: H * 0.05, w: W * 0.9, h: H * 0.9 } };
  }
  const s = SOCIAL[id];
  if (s) {
    const kx = W / REF[0], ky = H / REF[1];
    const x0 = s.l * kx, x1 = W - s.r * kx, y0 = s.t * ky, y1 = H - s.b * ky;
    const v = [], h = [y0, y1];
    if (s.l) v.push(x0);
    if (s.r) v.push(x1);
    const ratio = W / H, tall = Math.abs(ratio - 9 / 16) < 0.02;
    return { v: uniq(v), h: uniq(h), box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, ref: REF, note: tall ? '' : `made for 9:16 — scaled to your ${W}×${H}` };
  }
  if (id === 'clear') return { v: [], h: [] };
  return { error: `Unknown guide preset ${id}` };
}

module.exports = { PRESETS, SOCIAL, REF, byId, lines };
