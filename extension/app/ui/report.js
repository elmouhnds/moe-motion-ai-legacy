'use strict';
const { h, icon } = require('./dom');

const STATUS = {
  success: ['check', 'Done'], partial: ['pulse', 'Partly done'], failed: ['x', 'Failed'],
  blocked: ['x', 'Not run'], 'needs-approval': ['pulse', 'Needs approval']
};

/** Result report: status line + verification checks + optional restore. */
function renderReport(r, { onRestore, onDismiss } = {}) {
  if (!r) return null;
  const [ic] = STATUS[r.status] || ['pulse'];
  const msg = r.summary || (r.errors && r.errors.join(' · ')) || (r.reasons && r.reasons.join(' · ')) || r.status;
  const checks = (r.verification && r.verification.checks) || [];
  const showChecks = checks.length && (r.status !== 'success' || checks.length <= 12);
  return h('div', { class: `report ${r.status}`, role: 'status' },
    h('div', { class: 'report-h' },
      h('span', { class: 'st' }, icon(ic, 'sm')),
      h('span', { class: 'msg' }, msg),
      r.checkpointId && onRestore ? h('button', { class: 'btn ghost', title: 'Restore the exact previous state (independent of Edit › Undo)', onclick: onRestore }, icon('undo', 'sm'), 'Restore') : null,
      onDismiss ? h('button', { class: 'icon-btn', title: 'Dismiss', onclick: onDismiss }, icon('x', 'sm')) : null),
    showChecks ? h('div', { class: 'checks' }, checks.map((c) => h('div', { class: `check ${c.ok ? 'ok' : 'bad'}` },
      h('span', { class: 'ck' }, c.ok ? '✓' : '✕'), h('span', { class: 'lbl' }, c.label), h('span', { class: 'det' }, c.detail || '')))) : null);
}

module.exports = { renderReport };
