'use strict';
/** Delivery formats for Resize / Adapt. */
const FORMATS = [
  { id: 'v916', label: '9:16 Vertical', w: 1080, h: 1920, note: 'Reels · TikTok · Shorts · Stories' },
  { id: 'sq', label: '1:1 Square', w: 1080, h: 1080, note: 'Feed' },
  { id: 'p45', label: '4:5 Portrait', w: 1080, h: 1350, note: 'Instagram / Facebook feed' },
  { id: 'h169', label: '16:9 Landscape', w: 1920, h: 1080, note: 'YouTube · TV' },
  { id: 'uhd', label: '4K UHD', w: 3840, h: 2160, note: '16:9 at 2160p' },
  { id: 'p23', label: '2:3 Pin', w: 1000, h: 1500, note: 'Pinterest' },
  { id: 'link', label: '1.91:1 Link', w: 1200, h: 628, note: 'Link / ad card' },
  { id: 'cine', label: '21:9 Cinema', w: 2560, h: 1080, note: 'Ultra-wide' },
  { id: 'banner', label: '3:1 Banner', w: 1500, h: 500, note: 'Header / DOOH strip' }
];

const byId = (id) => FORMATS.find((f) => f.id === id) || null;
const ratioText = (w, h) => {
  const g = (a, b) => (b ? g(b, a % b) : a);
  const d = g(Math.round(w), Math.round(h));
  const a = Math.round(w) / d, b = Math.round(h) / d;
  return a <= 64 && b <= 64 ? `${a}:${b}` : (w / h).toFixed(2) + ':1';
};

module.exports = { FORMATS, byId, ratioText };
