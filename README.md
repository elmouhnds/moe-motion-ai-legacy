# MOE Motion AI

Independent motion-design workbench panel for **Adobe After Effects 2025** (Windows 11).
Real tools that change real project data — easing, timing, expressions, reusable tool recipes —
with an optional, approval-based Claude Copilot.

> Status: **v0.6.3** — fixes "After Effects not connected" (ES3 reserved word in a host file) and shows the reason when a connection fails; v0.6.2 fixed panel flicker / ignored clicks inside AE (in-place rendering). One-click Windows installer with in-place updates (Settings › Updates). Premium: Shapes & Icons (1,899 icons + 22 native shapes), Backgrounds (32 palettes), Colorize, 33 one-click expressions, ease library, Home, My Presets packs, artwork, Midnight theme + 8 accents — on the Studio interface (labelled sidebar, visual libraries with an Inspector, Deliver board) and foundation, Compositing, Studio (Text library, Brand Kit, Proximity, Select) and Layout & Speed (Grid Builder, Resize & Adapt, Zoom & Focus, Glass, Quick Bar, one-click expressions, Generate on Green). All logic is tested against an AE mock; **in-host verification on AE 2025 is the next step** (see TEST_REPORT.md).

## Install (users)
Run **`MOE-Motion-AI-Setup-x.y.z.exe`** (per-user, no admin) → open After Effects → *Window › Extensions › MOE Motion AI*.
Updates replace the installed copy in place — from **Settings › Updates** inside the panel, or by running a newer Setup. Full guide (Arabic + English): [INSTALL.md](INSTALL.md).

## Install (developer mode, Windows)
1. Install Node.js 18+ (only needed for tests).
2. From the repo root in PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1
   ```
   This sets `PlayerDebugMode=1` for CEP 12 (current user) and links `extension\` into `%APPDATA%\Adobe\CEP\extensions\moe-motion-ai`.
3. Restart After Effects → **Window › Extensions › MOE Motion AI**.
4. Optional: Settings → paste your Claude API key (stored with Windows DPAPI).

Uninstall: `tools\install-dev.ps1 -Uninstall`. Debug the panel at `http://localhost:8099`.

## Develop
```bash
npm install
npm run check      # ES3 lint of host files + contrast check + all tests
npm run preview    # browser preview with a mock AE host → http://localhost:5173/?view=motion
                   # add &demoAI=1 for canned Copilot/Assistant responses, &w=260 for compact, &theme=light
```

## Layout
- `extension/` — the installable CEP extension (manifest, UI, core, features, ExtendScript host)
- `tests/` — node:test suites, AE object-model mock, fixtures
- `dev/`, `tools/` — preview harness, installer, linters (not shipped)

Read **CLAUDE.md** (rules), **ARCHITECTURE.md** (design + how to add a tool), **FEATURES.md**, **ROADMAP.md**, **TEST_REPORT.md**, and `docs/`.
