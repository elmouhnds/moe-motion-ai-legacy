'use strict';
/**
 * v1.0.2 MOE Quick: give the window the SHAPE of what the page draws (Windows only, docs/features/QUICK_APPLY.md).
 *
 * The owner wanted nothing around the tools. The frame and the title bar come off in hotkeyWin.js, but the window
 * itself stayed: a faint dark rectangle over After Effects. Colour-keying it away does not work here — measured in
 * After Effects 26.5.3x9 on 2026-11-22: the page paints exactly the key colour (#010203, read back off the screen)
 * and the COLORREF is right, but After Effects' CEP window draws through a child surface that a layered window's
 * per-pixel key never reaches; with the window's alpha taken away it came out completely opaque.
 *
 * What does work is a window region (SetWindowRgn, documented Win32): Windows clips the whole window, children and
 * all, to the shape we give it. So the page measures the boxes it really drew — the chips, the search, the cancel —
 * and this helper turns them into one region. Everything else is not the window any more: After Effects shows
 * through it and takes the clicks.
 *
 * Like the hot key, the PowerShell is FIXED TEXT in this file — nothing generated, nothing from the network. Only
 * NUMBERS cross over, one line per shape ("x,y,w,h,r;x,y,w,h,r;…" in the window's own pixels, or "all" to clear),
 * checked here before they are written and again in the script.
 */
const MAX_PARTS = 24;   // the pie draws 10; the rest is headroom, not an invitation
const MAX_PX = 4000;

function script() {
  return [
    'Add-Type -TypeDefinition @"',
    'using System; using System.Runtime.InteropServices;',
    'public static class MoeShape {',
    '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string title);',
    '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);',
    '  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);',
    '  [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr h, IntPtr rgn, bool redraw);',
    '  [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int l, int t, int r, int b);',
    '  [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int l, int t, int r, int b, int w, int h);',
    '  [DllImport("gdi32.dll")] static extern int CombineRgn(IntPtr d, IntPtr a, IntPtr b, int mode);',
    '  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr o);',
    /* The page measures in its own client box; the region is in window coordinates, so the client's offset inside
       the window is added here (zero once the frame is off, but never assumed). RGN_OR is 2. */
    '  public static string Apply(string spec) {',
    '    IntPtr w = FindWindow(null, "MOE Quick");',
    '    if (w == IntPtr.Zero) { return "no window"; }',
    '    if (spec == "all") { SetWindowRgn(w, IntPtr.Zero, true); return "all"; }',
    '    RECT wr; if (!GetWindowRect(w, out wr)) { return "no rect"; }',
    '    POINT o = new POINT(); ClientToScreen(w, ref o);',
    '    int ox = o.X - wr.Left; int oy = o.Y - wr.Top;',
    '    IntPtr all = CreateRectRgn(0, 0, 0, 0);',
    '    int n = 0;',
    '    foreach (string part in spec.Split(new char[] { \';\' })) {',
    '      string[] f = part.Split(new char[] { \',\' });',
    '      if (f.Length != 5) { continue; }',
    '      int x; int y; int cw; int ch; int rr;',
    '      if (!int.TryParse(f[0], out x)) { continue; }',
    '      if (!int.TryParse(f[1], out y)) { continue; }',
    '      if (!int.TryParse(f[2], out cw)) { continue; }',
    '      if (!int.TryParse(f[3], out ch)) { continue; }',
    '      if (!int.TryParse(f[4], out rr)) { continue; }',
    `    if (cw < 1 || ch < 1 || cw > ${MAX_PX} || ch > ${MAX_PX} || rr < 0 || rr > 400) { continue; }`,
    '      IntPtr p = CreateRoundRectRgn(ox + x, oy + y, ox + x + cw, oy + y + ch, rr * 2 + 1, rr * 2 + 1);',
    '      if (p == IntPtr.Zero) { continue; }',
    '      CombineRgn(all, all, p, 2); DeleteObject(p); n++;',
    '    }',
    '    if (n == 0) { DeleteObject(all); return "empty"; }',
    /* After SetWindowRgn the system owns the region: it must not be deleted here. */
    '    SetWindowRgn(w, all, true);',
    '    return "shaped " + n;',
    '  }',
    '}',
    '"@',
    '[Console]::Out.WriteLine("READY"); [Console]::Out.Flush()',
    'while (($line = [Console]::In.ReadLine()) -ne $null) { [Console]::Out.WriteLine([MoeShape]::Apply($line)); [Console]::Out.Flush() }'
  ].join('\r\n');
}

/** The numbers, checked: whole pixels, sane sizes, at most MAX_PARTS of them. Returns '' when there is nothing to say. */
function spec(parts) {
  if (!Array.isArray(parts)) return '';
  const out = [];
  for (const p of parts.slice(0, MAX_PARTS)) {
    if (!p) continue;
    const n = [p.x, p.y, p.w, p.h, p.r].map((v) => Math.round(Number(v)));
    if (!n.every((v) => Number.isFinite(v))) continue;
    const [x, y, w, h, r] = n;
    if (w < 1 || h < 1 || w > MAX_PX || h > MAX_PX) continue;
    if (x < -MAX_PX || y < -MAX_PX || x > MAX_PX || y > MAX_PX) continue;
    if (r < 0 || r > 400) continue;
    out.push([x, y, w, h, r].join(','));
  }
  return out.join(';');
}

/**
 * Start the helper. spawn: child_process.spawn (injected for tests).
 * set(parts) gives the window that shape; clear() gives it back its rectangle; stop() ends the helper.
 */
function start({ spawn, platform = process.platform, onState } = {}) {
  const off = { set() {}, clear() {}, stop() {} };
  if (platform !== 'win32' || typeof spawn !== 'function') { if (onState) onState({ on: false, reason: 'Windows only' }); return off; }
  let child = null;
  let last = null;
  let tries = 0;
  let ended = false;
  const send = (s) => { if (!child) return; try { child.stdin.write(`${s}\r\n`); } catch (_) { /* it is going */ } };
  /* The window wears the last shape it was given, so a helper that died while the pie was hidden would leave it
     clipped to a pixel with nobody left to undo that. It comes back (twice) and puts the last shape on again. */
  const launch = () => {
    try {
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(script(), 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) { child = null; if (onState) onState({ on: false, reason: e.message }); return; }
    if (child.stdout && child.stdout.on) {
      let buf = '';
      child.stdout.on('data', (d) => {
        buf += String(d);
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (line && onState) onState({ on: line === 'READY' || /^shaped/.test(line), line });
        }
      });
    }
    if (child.on) {
      child.on('exit', () => {
        child = null;
        if (ended) return;
        if (tries++ < 2) { launch(); if (last) send(last); return; }
        if (onState) onState({ on: false, reason: 'stopped' });
      });
    }
  };
  launch();
  return {
    // nothing to draw is never sent as a shape: a window clipped to nothing cannot be found again
    set(parts) { const s = spec(parts); if (!s || s === last) return; last = s; send(s); },
    clear() { if (last === 'all') return; last = 'all'; send('all'); },
    stop() { ended = true; try { child.stdin.end(); } catch (_) { /* gone */ } try { child.kill(); } catch (_) { /* gone */ } }
  };
}

module.exports = { start, script, spec, MAX_PARTS, MAX_PX };
