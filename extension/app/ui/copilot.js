'use strict';
/**
 * Plan step views (Copilot flow: plan → local validation → approve → run with per-step verification →
 * roll back or save as a tool). v0.29: the bottom Copilot bar is gone — the floating Assistant
 * (assistant.js) shows these steps.
 */
const { h, icon } = require('./dom');

function argChips(args) {
  return h('div', { class: 'args' }, Object.entries(args || {}).map(([k, v]) => h('span', { class: 'arg' }, `${k}: ${typeof v === 'string' && v.length > 24 ? JSON.stringify(v.slice(0, 24) + '…') : JSON.stringify(v)}`)));
}

function stepView(step, prog) {
  const state = prog && prog.state;
  const mark = state === 'running' ? h('span', { class: 'spin' }) : state === 'success' ? '✓' : state && state !== 'running' ? '✕' : String(step.index + 1);
  return h('div', { class: `step ${step.errors.length ? 'bad' : ''}` },
    h('div', { class: 'step-h' }, h('span', { class: 'n' }, mark), h('span', { class: 'tn' }, step.toolName)),
    step.reason ? h('div', { class: 'reason' }, step.reason) : null,
    argChips(step.args),
    step.preview ? h('ul', { class: 'preview-list' }, h('li', {}, step.preview.summary)) : null,
    step.errors.length ? h('div', { class: 'errs' }, step.errors.join(' · ')) : null,
    prog && prog.result && prog.result.summary ? h('div', { class: 'reason' }, prog.result.summary) : null,
    prog && prog.result && !prog.result.ok && prog.result.errors ? h('div', { class: 'errs' }, prog.result.errors.join(' · ')) : null);
}

module.exports = { stepView, argChips };
