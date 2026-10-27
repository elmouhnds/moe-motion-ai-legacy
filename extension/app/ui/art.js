'use strict';
/**
 * MOE artwork: the logo mark and one illustration per Studio section (banners, Home cards,
 * empty states). Pure SVG strings, drawn with theme tokens (var(--accent), var(--text-2)…)
 * so they follow dark / midnight / light and every accent colour. Gentle SMIL motion is
 * paused when Settings › Appearance › Motion is "Reduced".
 */

const A = 'var(--accent)';
const T2 = 'var(--text-2)';
const T3 = 'var(--text-3)';
const LN = 'var(--line-strong)';
const SOFT = 'var(--accent-soft)';

let uid = 0;
const id = (p) => `${p}${++uid}`;

/** Logo mark: rounded tile, accent gradient, motion "M" with a keyframe diamond. */
function logo(size = 28) {
  const g = id('moeLogo');
  return `<svg class="moe-logo" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent-2, #ff3d6e)"/></linearGradient></defs>
<rect x="1" y="1" width="30" height="30" rx="8.5" fill="url(#${g})"/>
<rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="none" stroke="rgba(255,255,255,.25)"/>
<path d="M8 22.5V11.5l8 7.2 8-7.2v11" fill="none" stroke="var(--accent-ink)" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M24.5 5.2l2.3 2.3-2.3 2.3-2.3-2.3z" fill="var(--accent-ink)"/>
</svg>`;
}

const wrap = (w, h, body, cls = '') => `<svg class="moe-art ${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${body}</svg>`;
const anim = (attr, values, dur, extra = '') => `<animate attributeName="${attr}" values="${values}" dur="${dur}s" repeatCount="indefinite" ${extra}/>`;
const spline = 'calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" keyTimes="0;0.5;1"';

/* ---------- section illustrations (220 × 96) ---------- */
const ART = {
  home() {
    const g = id('hg');
    return wrap(220, 96, `<defs><radialGradient id="${g}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.45"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient></defs>
<circle cx="110" cy="48" r="46" fill="url(#${g})">${anim('r', '40;48;40', 4, spline)}</circle>
${[0, 1, 2, 3, 4, 5].map((i) => { const a = i * 60, r = 34; const x = 110 + r * Math.cos(a * Math.PI / 180), y = 48 + r * Math.sin(a * Math.PI / 180); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${i % 2 ? T2 : A}" opacity=".85"><animateTransform attributeName="transform" type="rotate" from="0 110 48" to="360 110 48" dur="18s" repeatCount="indefinite"/></circle>`; }).join('')}
<g transform="translate(94 32)">${logo(32).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>`);
  },
  animate() {
    return wrap(220, 96, `<path d="M18 74 C 60 74, 70 22, 110 22 S 170 70, 204 30" fill="none" stroke="${LN}" stroke-width="2" stroke-dasharray="4 5"/>
${[[18, 74], [110, 22], [204, 30]].map(([x, y]) => `<path d="M${x} ${y - 6}l6 6-6 6-6-6z" fill="${T2}"/>`).join('')}
<rect x="-14" y="-10" width="28" height="20" rx="5" fill="${A}"><animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="spline" keySplines="0.6 0 0.2 1;0 0 1 1" path="M18 74 C 60 74, 70 22, 110 22 S 170 70, 204 30"/></rect>
<path d="M150 84h50" stroke="${A}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`);
  },
  curves() {
    // value graph with handles + a ball riding the curve (out-back)
    const path = 'M40 82 C 82 82, 92 6, 180 18';
    return wrap(220, 96, `<path d="M40 18h140M40 82h140" stroke="${LN}" stroke-dasharray="3 4"/>
<path d="M40 82L82 82M180 18L92 6" stroke="${T3}" stroke-width="1.4"/>
<path d="${path}" fill="none" stroke="${A}" stroke-width="3" stroke-linecap="round"/>
<circle cx="82" cy="82" r="5" fill="${T2}"/><circle cx="92" cy="6" r="5" fill="${T2}"/>
<circle r="5" fill="${A}"><animateMotion dur="2.6s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="linear" path="${path}"/></circle>`);
  },
  transform() {
    // a card rotating around its bottom anchor + the 3 × 3 picker
    let dots = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const on = r === 2 && c === 1; dots += `<circle cx="${150 + c * 18}" cy="${30 + r * 18}" r="${on ? 5 : 3.5}" fill="${on ? A : T3}"/>`; }
    return wrap(220, 96, `<g><rect x="46" y="20" width="56" height="56" rx="8" fill="${SOFT}" stroke="${A}" stroke-width="1.6"/><animateTransform attributeName="transform" type="rotate" values="-14 74 76;14 74 76;-14 74 76" dur="3.2s" repeatCount="indefinite" ${spline}/></g>
<circle cx="74" cy="76" r="5" fill="none" stroke="${A}" stroke-width="2"/><path d="M66 76h16M74 68v16" stroke="${A}" stroke-width="1.6"/>
<rect x="138" y="18" width="60" height="60" rx="8" fill="none" stroke="${LN}" stroke-dasharray="3 4"/>${dots}`);
  },
  text() {
    return wrap(220, 96, `<text x="40" y="70" font-family="var(--display)" font-weight="700" font-size="58" fill="${T2}">A</text>
<text x="86" y="70" font-family="var(--display)" font-weight="700" font-size="58" fill="${A}">a<animate attributeName="y" values="80;70;70" dur="2.6s" repeatCount="indefinite" keyTimes="0;0.35;1"/><animate attributeName="opacity" values="0;1;1" dur="2.6s" repeatCount="indefinite" keyTimes="0;0.35;1"/></text>
<path d="M30 74h160" stroke="${LN}" stroke-width="1.5"/>
<rect x="150" y="30" width="2.5" height="40" fill="${A}">${anim('opacity', '1;0;1', 1.1)}</rect>`);
  },
  layout() {
    let cells = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const on = (r * 6 + c) % 5 === 0;
      cells += `<rect x="${32 + c * 27}" y="${12 + r * 25}" width="21" height="19" rx="4" fill="${on ? A : 'none'}" stroke="${on ? A : LN}" stroke-width="1.5" opacity="${on ? 0.9 : 1}">${on ? anim('opacity', '0.35;0.95;0.35', 2.4 + c * 0.2) : ''}</rect>`;
    }
    return wrap(220, 96, cells);
  },
  looks() {
    const g = id('glass');
    return wrap(220, 96, `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient></defs>
<circle cx="80" cy="44" r="30" fill="${A}"/><circle cx="148" cy="58" r="24" fill="#38bdf8" opacity=".85"/>
<rect x="60" y="22" width="110" height="56" rx="14" fill="url(#${g})" stroke="rgba(255,255,255,.55)" stroke-width="1.2"><animate attributeName="x" values="56;70;56" dur="5s" repeatCount="indefinite" ${spline}/></rect>
<path d="M74 34l12-8M74 46l26-18" stroke="#fff" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>`);
  },
  zoom() {
    return wrap(220, 96, `<rect x="30" y="14" width="120" height="68" rx="6" fill="none" stroke="${LN}" stroke-width="1.5"/>
${[0, 1, 2].map((i) => `<rect x="40" y="${26 + i * 12}" width="${60 - i * 14}" height="5" rx="2.5" fill="${T3}"/>`).join('')}
<rect x="96" y="44" width="40" height="26" rx="4" fill="none" stroke="${A}" stroke-width="2.2"><animate attributeName="width" values="40;52;40" dur="3s" repeatCount="indefinite" ${spline}/><animate attributeName="height" values="26;32;26" dur="3s" repeatCount="indefinite" ${spline}/></rect>
<circle cx="176" cy="44" r="16" fill="none" stroke="${T2}" stroke-width="3"/><path d="M188 56l12 12" stroke="${T2}" stroke-width="4" stroke-linecap="round"/><path d="M170 44h12M176 38v12" stroke="${A}" stroke-width="2.5" stroke-linecap="round"/>`);
  },
  expressions() {
    let d = 'M48 48';
    for (let x = 0; x <= 124; x += 4) d += ` L${48 + x} ${(48 - 18 * Math.sin(x / 10) * Math.exp(-x / 160)).toFixed(1)}`;
    return wrap(220, 96, `<text x="18" y="64" font-family="var(--mono)" font-size="44" fill="${T3}">{</text><text x="182" y="64" font-family="var(--mono)" font-size="44" fill="${T3}">}</text>
<path d="${d}" fill="none" stroke="${A}" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="260" stroke-dashoffset="260">${anim('stroke-dashoffset', '260;0;0', 3, 'keyTimes="0;0.7;1"')}</path>
<path d="M48 48h124" stroke="${LN}" stroke-width="1" stroke-dasharray="2 3"/>`);
  },
  shapes() {
    return wrap(220, 96, `<circle cx="52" cy="50" r="22" fill="${A}"/>
<rect x="88" y="26" width="44" height="44" rx="10" fill="none" stroke="${T2}" stroke-width="3"><animateTransform attributeName="transform" type="rotate" values="0 110 48;90 110 48;90 110 48" keyTimes="0;0.4;1" dur="3.4s" repeatCount="indefinite"/></rect>
<path d="M170 22l7.6 15.4 17 2.5-12.3 12 2.9 16.9L170 60.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill="${SOFT}" stroke="${A}" stroke-width="2.4" stroke-linejoin="round"/>
<path d="M30 84h160" stroke="${LN}" stroke-width="1.5" stroke-dasharray="3 4"/>`);
  },
  backgrounds() {
    const g = id('bg');
    return wrap(220, 96, `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--accent)"><animate attributeName="offset" values="0;0.3;0" dur="6s" repeatCount="indefinite"/></stop><stop offset="1" stop-color="#6c5ce7"/></linearGradient></defs>
<rect x="24" y="10" width="120" height="76" rx="10" fill="url(#${g})"/>
${['#1C1C1E', '#2F3A56', '#FF7A59', '#FFB38A', '#F4EDE4'].map((c, i) => `<rect x="156" y="${12 + i * 15}" width="40" height="11" rx="3" fill="${c}" stroke="${LN}"/>`).join('')}`);
  },
  compositing() {
    return wrap(220, 96, `${[0, 1, 2].map((i) => `<rect x="${54 + i * 18}" y="${16 + i * 12}" width="92" height="52" rx="6" fill="${i === 2 ? A : 'none'}" fill-opacity="${i === 2 ? 0.25 : 0}" stroke="${i === 2 ? A : LN}" stroke-width="1.6"/>`).join('')}
<circle cx="132" cy="64" r="9" fill="#00B140" opacity=".85"/>`);
  },
  deliver() {
    return wrap(220, 96, `<rect x="22" y="22" width="80" height="45" rx="5" fill="none" stroke="${T2}" stroke-width="2"/>
<rect x="114" y="10" width="40" height="72" rx="5" fill="none" stroke="${A}" stroke-width="2.2"><animate attributeName="y" values="14;10;14" dur="3s" repeatCount="indefinite" ${spline}/></rect>
<rect x="166" y="28" width="38" height="38" rx="5" fill="none" stroke="${T2}" stroke-width="2"/>
<path d="M34 34h34M34 42h22" stroke="${T3}" stroke-width="3" stroke-linecap="round"/><path d="M122 24h18M122 31h12" stroke="${A}" stroke-width="3" stroke-linecap="round"/>`);
  },
  quick() {
    return wrap(220, 96, `<path d="M118 8L82 54h26l-8 34 40-50h-26z" fill="${A}"><animate attributeName="opacity" values="1;.55;1" dur="1.8s" repeatCount="indefinite"/></path>
${[0, 1, 2].map((i) => `<rect x="${24 + i * 16}" y="${36 + i * 8}" width="10" height="10" rx="2.5" fill="${T3}"/>`).join('')}`);
  },
  select() {
    return wrap(220, 96, `<rect x="40" y="18" width="120" height="58" rx="6" fill="${SOFT}" stroke="${A}" stroke-width="1.6" stroke-dasharray="5 4">${anim('stroke-dashoffset', '0;-18', 1.2)}</rect>
${[0, 1, 2].map((i) => `<rect x="${56 + i * 34}" y="34" width="24" height="24" rx="5" fill="${T2}" opacity="${0.5 + i * 0.2}"/>`).join('')}
<path d="M166 62l14 7-6 1.6-2 6.4z" fill="${T2}"/>`);
  },
  brand() {
    return wrap(220, 96, `${['var(--accent)', '#2F3A56', '#FFB38A', '#F4EDE4', '#1C1C1E'].map((c, i) => `<circle cx="${60 + i * 26}" cy="48" r="17" fill="${c}" stroke="${LN}"><animate attributeName="cy" values="48;${40 + (i % 2) * 16};48" dur="${2.6 + i * 0.3}s" repeatCount="indefinite" ${spline}/></circle>`).join('')}`);
  },
  tools() {
    return wrap(220, 96, `<circle cx="110" cy="48" r="22" fill="none" stroke="${T2}" stroke-width="7" stroke-dasharray="9 6"><animateTransform attributeName="transform" type="rotate" from="0 110 48" to="360 110 48" dur="12s" repeatCount="indefinite"/></circle><circle cx="110" cy="48" r="8" fill="${A}"/>`);
  }
};
ART.favorites = ART.brand; ART.history = ART.animate; ART.settings = ART.tools; ART.diagnostics = ART.tools;

/* ---------- empty states (120 × 72) ---------- */
const EMPTY = {
  box: () => wrap(120, 72, `<path d="M30 28l30-14 30 14-30 14z" fill="${SOFT}" stroke="${A}" stroke-width="1.6"/><path d="M30 28v24l30 14 30-14V28M60 42v24" fill="none" stroke="${T3}" stroke-width="1.6"/>`, 'empty-art'),
  star: () => wrap(120, 72, `<path d="M60 10l7.6 15.4 17 2.5-12.3 12 2.9 16.9L60 48.8l-15.2 8 2.9-16.9-12.3-12 17-2.5z" fill="${SOFT}" stroke="${A}" stroke-width="2" stroke-linejoin="round"/><path d="M28 64h64" stroke="${LN}" stroke-dasharray="3 4"/>`, 'empty-art'),
  clock: () => wrap(120, 72, `<circle cx="60" cy="36" r="24" fill="${SOFT}" stroke="${A}" stroke-width="2"/><path d="M60 22v14l9 6" stroke="${T2}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`, 'empty-art'),
  comp: () => wrap(120, 72, `<rect x="24" y="14" width="72" height="44" rx="6" fill="none" stroke="${T3}" stroke-width="1.6" stroke-dasharray="4 4"/><path d="M54 30l14 6-14 6z" fill="${A}"/>`, 'empty-art'),
  search: () => wrap(120, 72, `<circle cx="54" cy="32" r="16" fill="${SOFT}" stroke="${A}" stroke-width="2"/><path d="M66 44l14 14" stroke="${T2}" stroke-width="4" stroke-linecap="round"/>`, 'empty-art')
};

function art(sectionId) { return (ART[sectionId] || ART.tools)(); }
function empty(kind) { return (EMPTY[kind] || EMPTY.box)(); }

module.exports = { logo, art, empty, ART, EMPTY };
