'use strict';
/**
 * Scene Check page (v0.80, docs/features/SCENE_CHECK.md; owner picked ideas 5 · 18 · 19 · 20, and 21 already lives in
 * Deliver). One click reads the comp (scene.read); everything on the page is drawn from that read by the pure
 * features/scene/plan.js. A second click measures (scene.measure) for what needs pixels: the safe-area and
 * brand-colour checks and the storyboard. Nothing is read in the background; a read of another comp is not shown.
 */
const { h, icon } = require('../dom');
const P = require('../../../features/scene/plan');
const K = require('../kits');
const R = require('../kitRun');

const KEY = 'scene', MKEY = 'scene:measure';
const okOf = (r) => !!r && (r.status === 'success' || r.status === 'partial') && r.result;
const dataOf = (s) => {
  const r = (s.results || {})[KEY];
  const scan = okOf(r) && r.result.scan;
  if (!scan || !s.ctx || !s.ctx.comp || scan.comp.id !== s.ctx.comp.id) return null; // another comp: read again
  const m = (s.results || {})[MKEY];
  return { scan, at: r.at || null, measured: okOf(m) && m.forComp === scan.comp.id ? m.result : null };
};

async function readNow(app) {
  const r = await app.runTool('scene.read', {}, { resultKey: KEY, label: 'Read This Comp' });
  if (r && r.status !== 'success') app.toast(`Read This Comp: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 5000, 'warn');
  app.clearResult(MKEY); // a new read: the old measurement belongs to the old state
  return r;
}
async function measureNow(app, scan) {
  const sc = P.scenes(scan);
  const r = await app.runTool('scene.measure', { times: JSON.stringify(sc.list.map((x) => x.t)) }, { resultKey: MKEY, label: 'Measure Scenes' });
  if (r && r.status === 'success') app.state.set((s) => ({ results: Object.assign({}, s.results, { [MKEY]: Object.assign({}, s.results[MKEY], { forComp: scan.comp.id, sceneTimes: sc.list.map((x) => x.t) }) }) }));
  else if (r) app.toast(`Measure Scenes: ${(r.errors || r.reasons || [r.status]).join(' · ')}`, 5000, 'warn');
  return r;
}

const card = (key, title, sub, ...body) => h('section', { class: 'scn-card', 'data-key': `scn-${key}`, 'aria-label': title }, h('div', { class: 'scn-h' }, h('b', {}, title), sub ? h('span', {}, sub) : null), ...body);

/* idea 5 — which kit fits */
function fits(app, s, scan) {
  const list = P.suggest(scan).map((x) => Object.assign(x, { def: K.byId(x.kit) })).filter((x) => x.def).slice(0, 2);
  if (!list.length) return card('fits', 'What fits this comp', 'Nothing in it points at one kit — open Style Kits and pick the look you are making', h('button', { class: 'btn sm', 'data-key': 'scn-kits', onclick: () => { app.state.set({ kitId: null }); app.go('kits'); } }, 'Style Kits'));
  return card('fits', 'What fits this comp', 'From what is in it — the reasons are listed',
    h('div', { class: 'scn-fits' }, list.map((x, i) => {
      const pg = K.progress(x.def, R.doneOf(s, x.def.id)); const step = x.def.steps[pg.next < 0 ? 0 : pg.next];
      const pinned = R.focusId(app) === x.def.id;
      return h('div', { class: `scn-fit ${i ? '' : 'first'}`, 'data-key': `scn-fit-${x.def.id}`, style: { '--k1': x.def.accent[0], '--k2': x.def.accent[1] } },
        h('span', { class: 'scn-fit-ic', 'aria-hidden': 'true' }, icon(x.def.icon, 'lg')),
        h('div', { class: 'scn-fit-t' }, h('b', {}, x.def.label), h('span', {}, `Because: ${x.why.join(' · ')}`), h('i', {}, `Start with ${step.label.replace(/^\d+ · /, '')}`)),
        h('div', { class: 'scn-fit-b' },
          h('button', { class: 'btn sm', 'data-key': `scn-open-${x.def.id}`, onclick: () => { app.state.set({ kitId: x.def.id }); app.go('kits'); } }, 'Open kit'),
          h('button', { class: `btn ghost sm ${pinned ? 'on' : ''}`, 'data-key': `scn-pin-${x.def.id}`, 'aria-pressed': String(pinned), title: 'Show this kit\'s next step on Home', onclick: () => R.setFocus(app, pinned ? null : x.def.id) }, pinned ? 'Working in it' : 'Work in it')));
    })));
}

/* idea 18 — the motion timeline */
const pct = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
function timelineCard(app, s, scan) {
  const T = P.timeline(scan);
  const open = !!(s.sceneUi || {}).allRows;
  const rows = open ? T.rows : T.rows.slice(0, 14);
  const moving = T.rows.filter((r) => r.spans.length || r.expr).length;
  return card('time', 'Motion timeline', `${moving} of ${T.rows.length} layers move · ${scan.comp.duration.toFixed(2)} s · bars = keyed spans, dots = markers`,
    h('div', { class: 'scn-tl', role: 'table', 'aria-label': 'Motion timeline' },
      h('div', { class: 'scn-tl-marks', 'aria-hidden': 'true' }, T.compMarks.map((m) => h('i', { style: { left: pct(m.at) }, title: m.comment || 'Comp marker' })), h('em', { style: { left: pct(T.now) }, title: 'Playhead when it was read' })),
      rows.map((r) => h('div', { class: `scn-row ${r.dim ? 'dim' : ''}`, role: 'row', 'data-key': `scn-r-${r.id}`,
        title: `${r.name} — ${r.spans.length ? r.spans.map((x) => `${x.name} (${x.n} keys)`).join(' · ') : 'no Transform keys'}${r.expr ? ` · ${r.expr} expression${r.expr === 1 ? '' : 's'}` : ''}` },
        h('span', { class: `scn-name ${r.moe ? 'moe' : ''}`, role: 'cell' }, r.name),
        h('span', { class: 'scn-track', role: 'cell' },
          h('i', { class: 'life', style: { left: pct(r.life[0]), width: pct(r.life[1] - r.life[0]) } }),
          r.spans.map((x, i) => h('i', { class: 'span', 'data-key': `sp${i}`, style: { left: pct(x.a), width: `max(3px, ${pct(x.b - x.a)})` } })),
          r.marks.map((m, i) => h('i', { class: 'mk', 'data-key': `mk${i}`, style: { left: pct(m) } })),
          r.expr ? h('i', { class: 'ex', title: 'Has an expression' }) : null)))),
    T.rows.length > 14 ? h('button', { class: 'btn ghost sm', 'data-key': 'scn-rows', onclick: () => app.state.set((x) => ({ sceneUi: Object.assign({}, x.sceneUi, { allRows: !open }) })) }, open ? 'Show fewer' : `Show all ${T.rows.length} layers`) : null);
}

/* idea 19 — the quality check */
const LEVEL = { fix: 'Fix', look: 'Look', hint: 'Hint', info: 'Info' };
function quality(app, s, scan, measured) {
  const brand = require('../../../features/brand/kit').activeBrand(app.services.store, app.services.brands);
  const list = P.check(scan, { boxes: measured ? measured.boxesAt[0] : null, colours: measured ? measured.colours : null, brand });
  const issues = list.filter((f) => f.level === 'fix' || f.level === 'look').length;
  return card('qc', 'Quality check', measured ? `${issues ? `${issues} to look at` : 'Nothing to fix'} · keys, text, title safe${brand ? `, ${brand.name}'s colours` : ''}` : `${issues ? `${issues} to look at` : 'Nothing to fix'} so far · Measure adds title safe${brand ? ` and ${brand.name}'s colours` : ''}`,
    list.length ? h('ul', { class: 'scn-find' }, list.slice(0, 40).map((f, i) => h('li', { class: `scn-f ${f.level}`, 'data-key': `scn-f-${i}` },
      h('span', { class: 'scn-lv' }, LEVEL[f.level]), h('span', { class: 'scn-ft' }, h('b', {}, f.layer ? `${f.layer} — ${f.title}` : f.title), h('span', {}, f.detail)))))
      : h('p', { class: 'scn-ok' }, icon('check', 'sm'), 'Keys are on frames, no move is too short, no empty text.'),
    measured ? null : h('button', { class: 'btn sm', 'data-key': 'scn-measure', disabled: s.running ? 'disabled' : undefined, title: 'Measures where the layers are with After Effects\' own measurement (a temporary null, removed) and reads the shape colours', onclick: () => measureNow(app, scan) }, icon('target', 'xs'), 'Measure for title safe, colours and the storyboard'));
}

/* idea 20 — the storyboard */
function storyboard(app, s, scan, measured) {
  const sc = P.scenes(scan);
  if (!measured) return card('board', 'Storyboard', `${sc.list.length} scene${sc.list.length === 1 ? '' : 's'} from ${sc.from}${sc.cut ? ` (the first ${P.LIMITS.scenes})` : ''} · needs Measure`, h('p', { class: 'scn-note' }, 'A page with one schematic frame per scene: where each layer is and what the texts say. It is drawn from measurements — not a render.'));
  // measured.boxesAt[0] is the playhead; the scenes follow in the order they were asked for
  const B = P.board(scan, sc, measured.boxesAt.slice(1));
  const html = P.boardHtml(B);
  const save = () => {
    const name = `MOE-Storyboard-${scan.comp.name.replace(/[^\w-]+/g, '_').slice(0, 40)}.html`; let where = '';
    try { const fsa = app.services.platform && app.services.platform.fs; if (fsa && fsa.join && fsa.writeText) { where = fsa.join(fsa.dataDir, name); fsa.writeText(where, html); } } catch (e) { where = ''; }
    app.copy(html);
    app.toast(where ? `Storyboard saved: ${where} (also copied)` : 'Storyboard page copied — paste it into a .html file', 6000, 'ok');
  };
  return card('board', 'Storyboard', `${B.scenes.length} scene${B.scenes.length === 1 ? '' : 's'} from ${sc.from} · schematic, not a render`,
    h('div', { class: 'scn-board' }, B.scenes.map((x) => h('figure', { class: 'scn-shot', 'data-key': `scn-s-${x.n}` },
      h('span', { class: 'scn-frame', style: { paddingBottom: `${Math.round(10000 * scan.comp.height / scan.comp.width) / 100}%` } }, x.layers.map((L, i) => h('i', { class: `t-${L.type}`, 'data-key': `b${i}`, title: `${L.name}${L.text ? ` — “${L.text}”` : ''}`,
        style: { left: pct(L.box[0] / scan.comp.width), top: pct(L.box[1] / scan.comp.height), width: pct((L.box[2] - L.box[0]) / scan.comp.width), height: pct((L.box[3] - L.box[1]) / scan.comp.height) } }))),
      h('figcaption', {}, h('b', {}, `${x.n} · ${x.label}`), h('span', {}, `${x.t.toFixed(2)} s · ${x.layers.length} layer${x.layers.length === 1 ? '' : 's'}`))))),
    h('button', { class: 'btn sm', 'data-key': 'scn-save', onclick: save }, 'Save the storyboard page'));
}

function render(app) {
  const s = app.state.get();
  const d = dataOf(s);
  const comp = s.ctx && s.ctx.comp;
  const head = h('div', { class: 'scn-head' },
    h('div', { class: 'scn-head-t' }, h('b', {}, 'Scene Check'), h('span', {}, d ? `${d.scan.comp.name} · ${d.scan.layers.length} layers · read once — press Read again after you change the comp` : comp ? 'One read of this comp — nothing is changed, nothing runs in the background' : 'Open a composition first')),
    h('button', { class: 'btn primary', 'data-key': 'scn-read', disabled: !comp || s.running ? 'disabled' : undefined, onclick: () => readNow(app) }, icon('eye', 'sm'), d ? 'Read again' : 'Read this comp'));
  if (!d) {
    return h('div', { class: 'view scn-page' }, head,
      h('div', { class: 'scn-empty' }, [['What fits', 'Which Style Kit suits what is in the comp, and why'], ['Motion timeline', 'Every layer\'s keyed moves and markers on one small timeline'], ['Quality check', 'Keys between frames, moves too short to read, empty text, text outside title safe, colours outside the client\'s palette'], ['Storyboard', 'One schematic frame per marker, saved as a page for the client']].map(([t, x]) => h('div', { class: 'scn-e' }, h('b', {}, t), h('span', {}, x)))),
      h('button', { class: 'ae-lead scn-link', 'data-key': 'scn-deliver', title: 'Deliver: every format at once, with a before / after picture before anything is written', onclick: () => app.go('deliver') }, icon('resize', 'sm'), h('span', {}, 'Other formats — Deliver')));
  }
  return h('div', { class: 'view scn-page', 'data-key': `scn-${d.scan.comp.id}` }, head,
    fits(app, s, d.scan), timelineCard(app, s, d.scan), quality(app, s, d.scan, d.measured), storyboard(app, s, d.scan, d.measured),
    h('button', { class: 'ae-lead scn-link', 'data-key': 'scn-deliver', title: 'Deliver: every format at once, with a before / after picture before anything is written', onclick: () => app.go('deliver') }, icon('resize', 'sm'), h('span', {}, 'Other formats — Deliver')));
}

module.exports = { render, dataOf, readNow, measureNow };
