# MOE Motion AI

Independent motion-design workbench panel for **Adobe After Effects 2025** (Windows 11).
Real tools that change real project data — easing, timing, expressions, reusable tool recipes —
with an optional, approval-based Claude Copilot.

> Status: **v0.3.0** — foundation, Compositing, and Studio (Text library, Brand Kit, Proximity, Select). All logic is tested against an AE mock; **in-host verification on AE 2025 is the next step** (see TEST_REPORT.md).

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
