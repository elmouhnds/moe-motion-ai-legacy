'use strict';
/** Summarise dev/audit/view-*.json (from tools/audit-ui.js) into dev/audit/audit.md. */
const fs = require('fs');
const path = require('path');
const DIR = path.resolve(__dirname, '../dev/audit');
const all = fs.readdirSync(DIR);
const files = all.filter((f) => /^view-.*\.json$/.test(f) && !(/\.partial\.json$/.test(f) && all.includes(f.replace('.partial', ''))));
const rows = [];
const layout = [];
for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); rows.push(...d.rows); layout.push(...d.layout); }
const tested = rows.filter((r) => !r.skipped && !r.fatal);
const isDead = (r) => !r.effect.length && !r.active && !r.clickErr && !r.errors.length;
const out = [];
const byView = {};
for (const r of rows) (byView[r.view] = byView[r.view] || []).push(r);
out.push('# Click-every-button audit (preview + mock AE host)', '');
out.push(`Interactions: **${tested.length}** · skipped ${rows.length - tested.length} · views ${Object.keys(byView).length}`, '');
out.push('| View | Tested | Dead | JS errors | Covered / off-screen | Tool runs failed | Error toasts |', '|---|---|---|---|---|---|---|');
for (const [v, rs] of Object.entries(byView)) {
  const t = rs.filter((r) => !r.skipped && !r.fatal);
  out.push(`| ${v} | ${t.length} | ${t.filter(isDead).length} | ${t.filter((r) => r.errors.length).length} | ${t.filter((r) => r.clickErr).length} | ${t.filter((r) => r.ranBad).length} | ${t.filter((r) => r.errToast).length} |`);
}
const list = (title, arr, fmt) => { out.push('', `## ${title} (${arr.length})`, ''); for (const r of arr) out.push(`- ${fmt(r)}`); };
const where = (r) => `**${r.view}**${r.via ? ` › ${r.via}` : ''} › \`${r.label}\` (${r.region}${r.tool ? `, ${r.tool}` : ''}${r.mode !== 'click' ? `, ${r.mode}` : ''})`;
list('JavaScript errors', tested.filter((r) => r.errors.length), (r) => `${where(r)} — ${r.errors.slice(0, 2).join(' / ')}`);
list('Could not be clicked (covered / off-screen)', tested.filter((r) => r.clickErr), (r) => `${where(r)} — ${r.clickErr}`);
list('Dead clicks (nothing happened)', tested.filter(isDead), (r) => where(r));
const fails = {};
for (const r of tested.filter((x) => x.ranBad || x.errToast)) { const k = (r.ranBad || r.errToast).replace(/\d+/g, 'N').slice(0, 120); (fails[k] = fails[k] || []).push(r); }
out.push('', `## Tool runs that failed or showed an error (${Object.values(fails).reduce((a, b) => a + b.length, 0)}, grouped)`, '');
for (const [k, rs] of Object.entries(fails).sort((a, b) => b[1].length - a[1].length)) out.push(`- ×${rs.length} ${k} — e.g. ${where(rs[0])}`);
out.push('', '## Layout', '', '| View | Width | Content overflow px | Unnamed controls | Small targets (<24×22) | Clipped text | Controls | In first screen |', '|---|---|---|---|---|---|---|---|');
for (const l of layout.filter((x) => !x.fatal)) out.push(`| ${l.view} | ${l.w} | ${l.hOverflow} | ${l.unnamedCount} | ${l.smallCount} | ${l.clippedCount} | ${l.controls} | ${l.aboveFold} |`);
const uniq = (key) => [...new Set(layout.filter((x) => !x.fatal).flatMap((x) => x[key]))];
out.push('', `Unnamed controls: ${uniq('unnamed').join(', ') || 'none'}`, '', `Small targets (sample): ${uniq('small').slice(0, 30).join(' · ')}`, '', `Clipped text without a tooltip (sample): ${uniq('clipped').slice(0, 30).join(' · ')}`);
fs.writeFileSync(path.join(DIR, 'audit.md'), out.join('\n'));
console.log(out.slice(0, 30).join('\n'));
