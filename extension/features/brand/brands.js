'use strict';
/**
 * Brand Kit store: clients with palettes and fonts. Local only (brands.json).
 * { id, name, colors: [{ name, hex }], fonts: { arabic, english, extra: [] }, notes, updatedAt }
 * A font entry: { ps (PostScript name), family, style }.
 */

const HEX = /^#?([0-9a-f]{6})$/i;

function hexToRgb(hex) {
  const m = HEX.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(rgb) {
  return '#' + rgb.slice(0, 3).map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** WCAG relative luminance / contrast — used to show readable labels on swatches. */
function luminance(rgb) {
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function validateBrand(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['Brand must be an object'];
  if (!String(b.name || '').trim()) errors.push('Client name is required');
  if (String(b.name || '').length > 60) errors.push('Client name is too long');
  (b.colors || []).forEach((c, i) => { if (!hexToRgb(c.hex)) errors.push(`Colour ${i + 1}: invalid hex "${c.hex}"`); });
  if ((b.colors || []).length > 40) errors.push('At most 40 colours per client');
  for (const role of ['arabic', 'english']) {
    const f = b.fonts && b.fonts[role];
    if (f && !f.ps) errors.push(`${role} font needs a PostScript name`);
  }
  return errors;
}

function normalize(b) {
  return {
    id: b.id || `brand_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name: String(b.name).trim(),
    colors: (b.colors || []).map((c, i) => ({ name: String(c.name || `Colour ${i + 1}`).slice(0, 30), hex: rgbToHex(hexToRgb(c.hex)) })),
    fonts: {
      arabic: b.fonts && b.fonts.arabic ? Object.assign({}, b.fonts.arabic) : null,
      english: b.fonts && b.fonts.english ? Object.assign({}, b.fonts.english) : null,
      extra: ((b.fonts && b.fonts.extra) || []).filter((f) => f && f.ps).slice(0, 10)
    },
    notes: String(b.notes || '').slice(0, 1000),
    updatedAt: new Date().toISOString()
  };
}

function createBrandStore(store) {
  const list = () => store.get('brands', []);
  return {
    list,
    get: (id) => list().find((b) => b.id === id) || null,
    save(b) {
      const errors = validateBrand(b);
      if (errors.length) return { ok: false, errors };
      const n = normalize(b);
      store.update('brands', [], (all) => { const i = all.findIndex((x) => x.id === n.id); if (i >= 0) all[i] = n; else all.push(n); return all; });
      return { ok: true, brand: n };
    },
    remove: (id) => store.update('brands', [], (all) => all.filter((b) => b.id !== id)),
    exportJSON: () => JSON.stringify({ format: 'moe-brands', version: 1, brands: list() }, null, 2),
    importJSON(text) {
      let doc;
      try { doc = JSON.parse(text); } catch (e) { return { ok: false, errors: ['Not valid JSON'] }; }
      const incoming = Array.isArray(doc) ? doc : doc.brands;
      if (!Array.isArray(incoming)) return { ok: false, errors: ['No brands found'] };
      const results = incoming.map((b) => this.save(b));
      return { ok: results.every((r) => r.ok), imported: results.filter((r) => r.ok).length, errors: results.flatMap((r) => r.errors || []) };
    },
    /** Compact summary for the Copilot context. */
    summary: () => list().map((b) => ({ id: b.id, name: b.name, colors: b.colors.map((c) => `${c.name} ${c.hex}`), arabicFont: b.fonts.arabic && b.fonts.arabic.ps, englishFont: b.fonts.english && b.fonts.english.ps }))
  };
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const hasArabic = (s) => ARABIC.test(String(s || ''));

/** k-means palette from sampled cells (deterministic seeding by luminance spread). */
function paletteFromCells(cells, k = 5) {
  const px = cells.filter((c) => c[3] > 0.5).map((c) => c.slice(0, 3));
  if (!px.length) return [];
  const kk = Math.min(k, px.length);
  const sorted = px.slice().sort((a, b) => luminance(a) - luminance(b));
  let centers = Array.from({ length: kk }, (_, i) => sorted[Math.floor(((i + 0.5) / kk) * sorted.length)].slice());
  for (let it = 0; it < 12; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of px) {
      let best = 0;
      let bd = Infinity;
      centers.forEach((c, i) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } });
      sums[best][0] += p[0]; sums[best][1] += p[1]; sums[best][2] += p[2]; sums[best][3]++;
    }
    centers = centers.map((c, i) => (sums[i][3] ? [sums[i][0] / sums[i][3], sums[i][1] / sums[i][3], sums[i][2] / sums[i][3]] : c));
  }
  const unique = [];
  for (const c of centers) if (!unique.some((u) => Math.hypot(u[0] - c[0], u[1] - c[1], u[2] - c[2]) < 0.04)) unique.push(c);
  return unique.map(rgbToHex);
}

module.exports = { hexToRgb, rgbToHex, luminance, contrast, validateBrand, createBrandStore, hasArabic, paletteFromCells };
