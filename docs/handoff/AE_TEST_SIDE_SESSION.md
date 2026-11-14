# MOE Motion AI — test inside After Effects (side session prompt)

Paste everything below the line into a NEW Claude Code session that runs ON the laptop (Claude app › Code, the
"D:\Personal\New Claude Code" folder / Remote Control environment), model Opus.

---

You are a side session of the main MOE Motion AI development session (session_011EAeukTtt53TZJvoZ3gAng, which runs in the cloud and cannot reach this computer). You run on the owner's Windows laptop. Your job: test the MOE Motion AI After Effects panel INSIDE After Effects on this machine and come back with a complete, honest report. Talk to the owner in Egyptian Arabic (technical names in English). Do not edit or delete the owner's projects or files; do not touch any After Effects comp except the temporary "MOE Self-Test …" comps the panel makes itself.

## Background
MOE Motion AI is a CEP panel for After Effects (Windows). Installed at `%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai` (version = ExtensionBundleVersion in `CSXS\manifest.xml`). User data: `%APPDATA%\MOE Motion AI`. Version 0.99.0 adds the **Claude Test Bridge**: a local HTTP server inside the panel (127.0.0.1 only) that runs MOE's own tools on temporary test comps. When the owner clicks *Diagnostics › Claude Test Bridge › Allow Claude to test*, the panel writes `%APPDATA%\MOE Motion AI\testbridge.json` = `{ "port": N, "token": "…" }`.

## Steps
1. **Installed version**: read the manifest's ExtensionBundleVersion. If below 0.99.0, look for `MOE-Motion-AI-Setup-0.99.0.zip` / `.exe` in Downloads; ask the owner before running it (After Effects closed during install). If not found, ask the owner to download it from the main chat and wait.
2. **After Effects running?** `Get-Process AfterFX -ErrorAction SilentlyContinue`. If not, ask the owner to open After Effects with a new empty project and the MOE panel (Window › Extensions › MOE Motion AI).
3. **Ask the owner to click** MOE › Diagnostics › Claude Test Bridge › **Allow Claude to test**. Never work around this click. Confirm `testbridge.json` exists.
4. **Call the bridge** (PowerShell):
```powershell
$b = Get-Content "$env:APPDATA\MOE Motion AI\testbridge.json" | ConvertFrom-Json
function Moe($cmd, $body = @{}) { Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$($b.port)/v1/$cmd" -Headers @{ Authorization = "Bearer $($b.token)" } -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 10) -TimeoutSec 120 }
Moe status
```
   Commands: `status`, `tiles`, `test {section?, ids?, render?}` → `{job}`, `try {tool, args, subject?, render?:{duration}}` → `{job}`, `job {job}` (poll every 2 s until state ≠ running), `stop`, `logs`, `reload`. Subjects: card, text, outline, cards, grid, effector, keys, none. Re-read the token file if the panel reloads.
5. **Test plan** (one job at a time):
   a. `Moe tiles` → sections and counts.
   b. Cloner / Grid first (the owner's main complaint): `Moe test @{ section = 'layout' }`, poll `job` until done.
   c. Then every other section one by one (or `Moe test @{}` for all if it runs smoothly; all tiles take several minutes).
   d. Visual tools: `try` with render to SEE the result, e.g. `Moe try @{ tool='reveal.fx'; args=@{ preset='inkBleed' }; subject='card'; render=@{ duration=2.4 } }` — take real args from `tiles` (several `reveal.fx`, `reveal.matte`, `interact.clickFx`, `grid.build` sphere/ring, a `design.template`). The row has `frames.folder` + `frames.pattern` (JPEG sequence): open 3–4 frames with Read and judge them as a senior motion designer (premium and modern, or broken / dated / empty?). Say exactly what you see.
   e. Every few jobs: `Moe logs`.
   f. If After Effects stops answering (`status` times out), ask the owner what dialog is on screen ("Undo group mismatch", script error…), have them dismiss it, note it.
6. Do NOT change MOE's code. You are the tester; fixes happen in the main session.

## Report
Write `MOE-AE-Test-Report.md` (+ raw job reports as `moe-ae-test-raw.json`) in your working folder:
- After Effects version/build, MOE version, Windows, date.
- Totals per section (pass / fail / skip) and Undo findings (more than one Ctrl+Z, or Undo left something).
- EVERY failed tile: section/id, tool, args, exact error text, any After Effects dialog.
- Skipped tiles with the reason.
- Visual verdict on each rendered `try` (what you saw frame by frame + frame paths).
- The panel logs (warnings/errors).
- What you could NOT test and why.
Strictly factual: only what you ran and saw.

Finally: if you have a `send_message` tool, send the whole report to session `session_011EAeukTtt53TZJvoZ3gAng` (prefix "MOE AE TEST REPORT"). Otherwise tell the owner to paste `MOE-AE-Test-Report.md` into the main chat. Then tell the owner in Egyptian Arabic, in a few lines, what you found.
