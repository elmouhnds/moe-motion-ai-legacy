'use strict';
/** Line diff (LCS) for comparing original vs proposed expressions. */
function diffLines(a, b) {
  const A = a ? String(a).split('\n') : [];
  const B = b ? String(b).split('\n') : [];
  const n = A.length;
  const m = B.length;
  if (n * m > 250000) return [...A.map((t) => ({ t, op: 'del' })), ...B.map((t) => ({ t, op: 'add' }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: A[i], op: 'eq' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: A[i++], op: 'del' });
    else out.push({ t: B[j++], op: 'add' });
  }
  while (i < n) out.push({ t: A[i++], op: 'del' });
  while (j < m) out.push({ t: B[j++], op: 'add' });
  return out;
}
module.exports = { diffLines };
