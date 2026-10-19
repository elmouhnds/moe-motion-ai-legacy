'use strict';
/**
 * Look from words (Claude). Turns a look description + measured shot stats
 * into Grade settings. Never writes to the project: the user reviews the
 * values and applies them with the local Grade tool.
 */
const cm = require('./colorMath');
const S = require('./shared');
const { PARAMS: GRADE } = require('./grade');
const { validateArgs } = require('../../core/schema');

const SYSTEM = [
  'You are the colourist inside MOE Motion AI for After Effects 2025.',
  'Translate the requested look into settings for a single affine grade (one Channel Mixer). It can do: exposure (stops), contrast around mid-grey, luminance-preserving saturation, temperature (orange/blue), tint (magenta/green), auto white balance, auto levels.',
  'It CANNOT do split-toning, curves, secondary/hue-specific changes, vignettes, or grain. If the look needs those, approximate with what is available and say what is missing in "limitations".',
  'Use the measured statistics: e.g. if the shot already has a warm cast, a "neutral" request needs autoBalance; if it is dark, exposure up.',
  'Ranges: exposure -3..3, contrast -100..100, saturation 0..200 (100 = unchanged), temperature -100..100, tint -100..100, autoBalance 0..100, autoLevels 0..100. Prefer subtle values a senior colourist would choose.'
].join('\n');

const NUM = { type: 'number' };
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['settings', 'explanation', 'limitations'],
  properties: {
    settings: {
      type: 'object', additionalProperties: false,
      required: ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'autoBalance', 'autoLevels'],
      properties: { exposure: NUM, contrast: NUM, saturation: NUM, temperature: NUM, tint: NUM, autoBalance: NUM, autoLevels: NUM }
    },
    explanation: { type: 'string', description: 'One or two sentences: what the settings do to this shot.' },
    limitations: { type: 'string', description: 'Empty, or what part of the look the grade cannot reproduce.' }
  }
};

/** Clamp AI numbers to Grade's ranges, then validate with Grade's own schema. */
function toGradeArgs(settings) {
  const out = {};
  const clamped = [];
  for (const [k, v] of Object.entries(settings)) {
    const p = GRADE[k];
    if (!p) continue;
    const n = Number(v);
    const c = Math.min(p.max, Math.max(p.min, Number.isFinite(n) ? n : p.default));
    if (c !== n) clamped.push(k);
    out[k] = Math.round(c * 100) / 100;
  }
  const { quality, ...rest } = GRADE; // eslint-disable-line no-unused-vars
  const v = validateArgs(rest, out);
  return { args: v.value, ok: v.ok, errors: v.errors, clamped };
}

module.exports = {
  id: 'compositing.lookAssist',
  version: '1.0.0',
  category: 'compositing',
  group: 'Color',
  name: 'Look from Words',
  description: 'Describe a look; Claude proposes Grade settings using the measured shot. Nothing changes until you apply.',
  keywords: ['ai', 'look', 'describe', 'claude', 'mood', 'cinematic', 'style', 'grade'],
  icon: 'spark',
  params: {
    description: { type: 'text', label: 'Look', description: 'e.g. “cold, desaturated thriller, slightly crushed” or “warm golden hour”', required: true, maxLength: 1000 }
  },
  requires: { comp: true, minLayers: 1 },
  permissions: ['network.ai', 'modify.layers'],
  recovery: 'undo',
  ai: null,
  uses: { hostOps: ['pixels.sample'], network: true },
  compatibility: { minAE: '25.0' },
  ui: {
    primaryLabel: 'Suggest',
    renderResult(r, { h, app }) {
      if (!r || !r.result || !r.result.suggestion) return null;
      const s = r.result.suggestion;
      return h('div', { class: 'analysis' },
        h('div', { class: 'explain' }, r.result.explanation),
        r.result.limitations ? h('div', { class: 'why', style: { marginTop: '4px' } }, r.result.limitations) : null,
        h('div', { class: 'args' }, Object.entries(s.args).map(([k, v]) => h('span', { class: 'arg' }, `${k}: ${v}`))),
        s.clamped.length ? h('div', { class: 'why' }, `Adjusted to range: ${s.clamped.join(', ')}`) : null,
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', disabled: !s.ok, onclick: () => app.prefillTool('compositing.grade', s.args) }, 'Use in Grade')));
    }
  },

  prepare(args, ctx) {
    if (!(args.description || '').trim()) return { ok: false, error: 'Describe the look' };
    const t = S.targets(ctx, { needPixels: true });
    return { ok: true, layer: t.usable[0] || null, preview: { summary: t.usable[0] ? `Suggest a look for ${t.usable[0].name}` : 'Suggest a look (no measurable layer selected)', items: [] } };
  },

  async execute({ args, ctx, prepared, host, services }) {
    let st = null;
    let probeOk = true;
    if (prepared.layer) {
      const s = await S.sample(host, ctx, prepared.layer, { quality: 'fast' });
      st = s.stats;
      probeOk = s.probeOk;
    }
    const measured = st ? {
      meanRGB: st.mean.map((v) => +v.toFixed(3)), luminance: +st.luminance.toFixed(3), black: +st.black.toFixed(3), white: +st.white.toFixed(3),
      saturation: +st.saturation.toFixed(3), cast: cm.describeCast(st)
    } : null;
    const res = await services.ai.createJSON({
      purpose: 'compositing.look', system: SYSTEM, schema: SCHEMA,
      user: JSON.stringify({ look: args.description, layer: prepared.layer ? prepared.layer.name : null, measured })
    });
    return { suggestion: toGradeArgs(res.data.settings), explanation: res.data.explanation, limitations: res.data.limitations, measured, probeOk };
  },

  verify({ result }) {
    return {
      ok: result.probeOk && result.suggestion.ok,
      checks: [
        { ok: result.probeOk, label: 'Analysis', detail: result.measured ? `measured cast: ${result.measured.cast}` : 'no layer measured' },
        { ok: result.suggestion.ok, label: 'Settings', detail: result.suggestion.ok ? 'valid Grade settings — not applied yet' : result.suggestion.errors.join(' · ') }
      ]
    };
  },
  summarize(result) { return result.explanation ? result.explanation.slice(0, 140) : 'Suggestion ready'; },
  _toGradeArgs: toGradeArgs
};
