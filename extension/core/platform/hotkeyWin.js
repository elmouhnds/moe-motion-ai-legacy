'use strict';
/**
 * v1.0 MOE Quick from anywhere in After Effects (docs/features/QUICK_APPLY.md) — Windows only, opt-in in
 * Settings › Pie menu. A CEP panel hears keys only while it has the focus, so a key pressed over the timeline or the
 * viewer never reaches it. This helper asks Windows for ONE global hot key (user32 RegisterHotKey, documented Win32)
 * from a small PowerShell process the panel starts and stops; when the key is pressed it prints the name of the
 * process in front, and the panel opens MOE Quick only when that is After Effects. The script is fixed text in this
 * file — nothing generated, nothing from the network. Not verified in After Effects yet (written 2026-11-20).
 */
const COMBOS = {
  'ctrl+alt+space': { mods: 0x2 | 0x1, vk: 0x20, label: 'Ctrl+Alt+Space' },
  'ctrl+shift+space': { mods: 0x2 | 0x4, vk: 0x20, label: 'Ctrl+Shift+Space' },
  'ctrl+alt+q': { mods: 0x2 | 0x1, vk: 0x51, label: 'Ctrl+Alt+Q' }
};
const AE_PROCESS = /^(AfterFX|CEPHtmlEngine)$/i;

function script(mods, vk, bare) {
  return [
    'Add-Type -TypeDefinition @"',
    'using System; using System.Runtime.InteropServices; using System.Diagnostics;',
    'public static class MoeHotkey {',
    `  const bool BARE = ${bare ? 'true' : 'false'};`,
    '  [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }',
    '  [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);',
    '  [DllImport("user32.dll")] static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint min, uint max);',
    '  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);',
    /* v1.0.2: put the window where the hand already is. After Effects owns that window completely - the page
       inside it cannot move, resize or see through itself (all three measured in 26.5.3x9) - but the window is
       still a window, so the helper that heard the key moves it to the pointer with the documented SetWindowPos.
       It is found by its exact title and only while After Effects is in front, and it is never activated or
       resized: SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE. */
    '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }',
    '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
    '  [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string cls, string title);',
    '  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);',
    '  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);',
    '  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);',
    '  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr(IntPtr h, int n);',
    '  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")] static extern IntPtr SetWindowLongPtr(IntPtr h, int n, IntPtr v);',
    '  [DllImport("user32.dll")] static extern bool SetLayeredWindowAttributes(IntPtr h, uint key, byte alpha, uint flags);',
    /* Take the frame off and make the page's key colour see-through. GWL_STYLE -16 loses WS_CAPTION, WS_THICKFRAME,
       WS_BORDER and WS_DLGFRAME; GWL_EXSTYLE -20 gains WS_EX_LAYERED, and LWA_COLORKEY makes #010203 (COLORREF is
       0x00BBGGRR) vanish; LWA_ALPHA alongside it gives everything that IS drawn a little translucency (220 of 255)
       so the wheel sits over the interface instead of on top of it, which is the only way to be see-through here -
       alpha inside the page would just blend with the key colour and come out solid. The edge styles (DLGMODALFRAME, WINDOWEDGE, CLIENTEDGE, STATICEDGE) go with it or a
       hairline rectangle is left drawn around nothing. SWP_FRAMECHANGED makes the new style take. Only ever the
       window titled "MOE Quick". */
    '  static void Undress(IntPtr w) {',
    '    IntPtr st = GetWindowLongPtr(w, -16);',
    '    long want = st.ToInt64() & ~0x00C00000L & ~0x00040000L & ~0x00800000L & ~0x00400000L;',
    '    if (want != st.ToInt64()) { SetWindowLongPtr(w, -16, new IntPtr(want)); }',
    '    IntPtr ex = GetWindowLongPtr(w, -20);',
    '    long wantEx = ex.ToInt64() | 0x00080000L;',
    '    wantEx = wantEx & ~0x00000001L & ~0x00000100L & ~0x00000200L & ~0x00020000L;',
    '    SetWindowLongPtr(w, -20, new IntPtr(wantEx));',
    '    SetLayeredWindowAttributes(w, 0x00030201, 220, 0x1 | 0x2);',
    '  }',
    '  static void PlaceAtCursor(POINT p) {',
    '    for (int i = 0; i < 25; i++) {',
    '      IntPtr w = FindWindow(null, "MOE Quick");',
    '      if (w != IntPtr.Zero) {',
    '        RECT r; if (!GetWindowRect(w, out r)) { return; }',
    '        int cw = r.Right - r.Left, ch = r.Bottom - r.Top;',
    '        int vx = GetSystemMetrics(76), vy = GetSystemMetrics(77), vw = GetSystemMetrics(78), vh = GetSystemMetrics(79);',
    '        int x = p.X - cw / 2, y = p.Y - ch / 2;',
    '        if (x < vx) { x = vx; }',
    '        if (y < vy) { y = vy; }',
    '        if (x + cw > vx + vw) { x = vx + vw - cw; }',
    '        if (y + ch > vy + vh) { y = vy + vh - ch; }',
    '        if (BARE) { Undress(w); }',
    '        SetWindowPos(w, IntPtr.Zero, x, y, 0, 0, 0x0001 | 0x0004 | 0x0010 | (BARE ? 0x0020u : 0u));',
    '        return;',
    '      }',
    '      System.Threading.Thread.Sleep(60);',
    '    }',
    '  }',
    '  public static void Run(uint mods, uint vk) {',
    '    if (!RegisterHotKey(IntPtr.Zero, 1, mods | 0x4000, vk)) { Console.WriteLine("FAIL " + Marshal.GetLastWin32Error()); return; }',
    '    Console.WriteLine("READY");',
    '    MSG m;',
    '    while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0) {',
    '      if (m.message == 0x0312) { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); string n = ""; try { n = Process.GetProcessById((int)pid).ProcessName; } catch { } POINT cp; GetCursorPos(out cp); Console.WriteLine("HOTKEY " + n); if (n == "AfterFX" || n == "CEPHtmlEngine") { PlaceAtCursor(cp); } }',
    '    }',
    '  }',
    '}',
    '"@',
    `[MoeHotkey]::Run(${Number(mods) >>> 0}, ${Number(vk) >>> 0})`
  ].join('\r\n');
}

/** Start listening. spawn: child_process.spawn (injected for tests). onKey(): After Effects was in front. */
function start({ combo, spawn, onKey, onState, bare, platform = process.platform }) {
  const c = COMBOS[combo];
  if (!c || platform !== 'win32') { if (onState) onState({ on: false, reason: platform !== 'win32' ? 'Windows only' : 'off' }); return { stop() {} }; }
  const encoded = Buffer.from(script(c.mods, c.vk, bare !== false), 'utf16le').toString('base64');
  let child;
  try { child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { if (onState) onState({ on: false, reason: e.message }); return { stop() {} }; }
  let buf = '';
  // v1.0.2: RegisterHotKey fails -> the script prints FAIL and RETURNS, so PowerShell exits a moment later. The exit
  // handler used to replace that reason with the useless "stopped", which is exactly what the owner's machine showed
  // for the default Ctrl+Alt+Space (FAIL 1409 = the combo is already registered by another program). Once the helper
  // has said why it is not listening, nothing may overwrite it.
  let said = false;
  child.stdout.on('data', (d) => {
    buf += String(d);
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line === 'READY') { if (onState) onState({ on: true, label: c.label }); }
      else if (/^FAIL/.test(line)) { said = true; if (onState) onState({ on: false, reason: `${c.label} is taken by another program (${line})` }); }
      else if (/^HOTKEY/.test(line)) { const who = line.slice(7).trim(); if (AE_PROCESS.test(who)) onKey(); }
    }
  });
  child.on('exit', () => { if (said) return; if (onState) onState({ on: false, reason: 'stopped' }); });
  return { stop() { try { child.kill(); } catch (_) { /* gone */ } }, child };
}

module.exports = { start, script, COMBOS, AE_PROCESS };
