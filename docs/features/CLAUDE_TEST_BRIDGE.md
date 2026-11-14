# Claude Test Bridge — Opus tests MOE inside After Effects (v0.99)

**The owner:** "we want a solution that lets the Opus model review and test the tool in After Effects by itself, as a
plugin inside After Effects."

## How it works
```
Claude Code (Opus) on the owner's PC
   │  MCP over stdio — tools/moe-mcp.js (registered by the repo's .mcp.json)
   ▼
Claude Test Bridge — inside the MOE panel (extension/core/testbridge.js), 127.0.0.1 only, key in
%APPDATA%\MOE Motion AI\testbridge.json, OFF until the user clicks "Allow Claude to test" in Diagnostics
   │  only fixed commands → the executor → registered tools, on a fresh "MOE Self-Test Tiles" comp
   ▼
After Effects (ExtendScript host ops) — renders frames with its own Render Queue, Edit > Undo pressed for real
```

## The MCP tools Opus gets
| Tool | What it does |
|---|---|
| `moe_status` | MOE + After Effects versions, active comp, running job |
| `moe_list_tiles` | every library tile (section/id, tool, args) |
| `moe_test_tiles` | Tile Test of all / a section / ids → pass · fail · skip with the real error and the Undo count |
| `moe_try_tool` | ONE tool with any args on a chosen subject → After Effects renders it → **frames come back as images** Opus looks at → Undo → report |
| `moe_job` / `moe_stop` | follow / stop a long job |
| `moe_logs` | the panel's last warnings and errors |
| `moe_deploy` | copy the repo's `extension/` into the installed panel and reload it (the bridge comes back on by itself after this reload only) |

## The loop Opus follows (CLAUDE.md › Testing in After Effects)
1. `moe_status` → `moe_test_tiles` (a section) → read every FAIL.
2. Fix the code in the repo → `npm run check` → `moe_deploy`.
3. `moe_test_tiles` with the failed ids again; `moe_try_tool` to SEE a look (Matte FX, Click VFX…) and judge it.
4. Report to the owner what passed in After Effects (numbers), what still fails, what was judged by eye.

## Safety (CLAUDE.md rules kept)
- No generic eval: the bridge has 8 commands; a tool runs only through the executor with its schema-validated args.
- Never the user's comps: every run is on a fresh `MOE Self-Test Tiles` comp, removed in finally; renders go only to
  `<user data>/MOE Motion AI/previews/review-*` (`previews.render` refuses other comps).
- Local only: `127.0.0.1`, a random port, a 48-hex-digit key in a file only this Windows user can read; requests with
  a browser `Origin` are refused (a web page cannot drive it); body ≤ 64 KB.
- Off by default, off when the panel closes; after `moe_deploy`'s reload it comes back on once (2-minute ticket).
- `moe_deploy` copies only into `%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai` (an existing install), never
  `.debug`, never the installer's `install.json`.

## Setup on the owner's PC (once)
1. Install MOE Motion AI 0.99 (Setup.exe) — and Node.js LTS (nodejs.org) if `node -v` does not answer.
2. Unzip `MOE-Motion-AI-0.99.0-source.zip` to e.g. `D:\Projects\moe-motion-ai` (it has the full git history).
3. Open that folder in Claude Code (Claude desktop app › Code, or `claude` in a terminal there). Approve the
   `moe-after-effects` MCP server when asked (it comes from `.mcp.json`).
4. In After Effects: MOE Motion AI › Diagnostics › Claude Test Bridge › **Allow Claude to test**.
5. Tell Claude Code: "Test MOE in After Effects and fix what fails" — it follows CLAUDE.md.

Tested here: `tests/testbridge.test.js` (bridge guards, MCP ↔ bridge ↔ mock After Effects end to end). **Not yet run on
the owner's PC.**
