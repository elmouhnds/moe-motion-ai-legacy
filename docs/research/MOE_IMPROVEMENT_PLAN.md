# MOE — what to improve next (2026-11-15)

Inputs: the four reports from inside After Effects 26.5 (Tile Test via the Claude Test Bridge), the Motion Dock study
(`MOTION_DOCK_STUDY.md`), a measurement of MOE's own UI code (below), and the peer research
(`PANEL_DESIGN_RESEARCH.md`, when it lands). **The owner's order: the tests first — most tools did not work in After
Effects — the design after.**

## 0. Measured state of MOE (v0.99.3)
- 100 registered tools · 20 sections · 9 libraries · **357 tiles** · 4 styles (Bento, Glass, MOE, Control).
- CSS 2,808 lines: **12 different `gap` values** (1–14 px), **58 different padding values**, **12+ radii** (tokens
  plus raw 2/3/4/8/10/12/14 px), **132 `box-shadow`s**, the accent used **303 times**.
- In After Effects 26.5 (0.99.0): 222 / 353 tiles passed; 5 bugs explained 126 failures (fixed in 0.99.1, not yet
  confirmed there); no tile has a verified Ctrl+Z yet; no render has ever succeeded there.

## 1. Reliability — the priority (before any redesign)
1. **Close the loop on 0.99.3 in After Effects**: Tile Test all sections + Render previews + the 32-check Self-Test
   (never run by anyone yet — it is the only test that checks a grid builds the RIGHT positions, not just builds).
2. **Host profile at start-up** (new): read once, read-only, the parameter count / names / match names of every native
   effect MOE writes (Transform, Gradient Wipe, Fractal Noise, Glow, Dropdown…) and the menu commands it uses; compare
   with what the code expects; show drift in Diagnostics and in the Tile Test report. After Effects 26 changed four of
   them silently — the next version will change others; MOE should notice on day one, not after a user's failure.
3. **Mock = After Effects, by rule**: every error the bridge finds becomes a mock rule with the exact message (done for
   six). Next: generate a "host contract" table from the tests — every AE API MOE calls, and whether After Effects
   26.5 has confirmed it — so unverified calls are visible.
4. **Fill the Tile Test's blind spots** (13 tiles never truly ran): a bundled 2 s tone (Audio effectors), a green solid
   subject (Key setup), a mask/path subject (Path, Points), a property selection on a grid item (Effector on
   Property). Target: 353 / 353 run, none skipped for want of a subject.
5. **Undo proven, not assumed**: the Tile Test must report a pressed Ctrl+Z for every tile that makes something; if
   "Undo <name>" is not in After Effects' menu either, use the checkpoint restore AND say Undo is unverified.
6. **Failure UX**: when a tool fails, one sentence in plain words + "what MOE removed" + Copy report (the error code
   is already logged). Never leave half a result (the grid cleanup rule, applied to every tool that makes layers).

## 2. Design system — consolidate (low risk, high polish)
- **One spacing scale**: 4 / 8 / 12 (+2 for hairline gaps) — replace the 12 gap and 58 padding values (an audit tool
  like `audit-size` can fail the build on a raw px). Motion Dock's lesson: one number makes the whole panel even.
- **Two radii** (`--r` 6, `--r-lg` 10) + pill; no raw radii.
- **Hairline borders, not shadows** inside the panel; shadows only for things that float (menus, toasts) — today 132.
- **Accent = state, not decoration**: selected / primary only (303 uses today); each tool FAMILY gets its own hue for
  its selected state (Animate, Timing, Layer, Design, Look, Deliver) — colour then tells where you are.
- **Icon-first**: a word only where a choice must be read; everything else icon + tooltip (MOE has the icon set).

## 3. Structure — the Dock direction (after the tests)
MOE's content is deeper than Motion Dock's (previews, Tool Cards, libraries, one Ctrl+Z, AI); its arrangement is not
the user's. Proposal **MOE Dock**: the same groups as modules on a grid the user arranges.
- **Size contract per module**: `strip` (one row: the module's top 5–8 actions as icons), `card` (the usual group),
  `full` (library / editor). Every module must render all three — tested at each size like `audit-size`.
- **Use vs Edit layout**; picker = real miniature renders of each module (MOE's renderer can make them); ✓ when present.
- **Starters by role**: Animator · MoGraph (Cloner, Effectors) · SaaS / Product · Typography · Arabic · Finishing.
- **Layouts 1-2-3** + per-project memory (MOE already remembers a client per project) + Isolate (one module fills the
  panel — the Motion Kit panel becomes "another dock").
- **One way of working, not four styles**: a starter + a theme replaces Bento / Glass / MOE / Control over time
  (each style today doubles the UI to test and keep consistent). Only with the owner's approval of pictures.

## 4. Smart ideas beyond Motion Dock (MOE can do what a toolbox cannot)
1. **Hero read-outs**: the Motion Control's live curve of the selected keys, the Cloner's live grid, Matte FX's real
   render, Scene Check's health ring — the module shows the state before you read any label.
2. **Selection-aware glow**: modules that fit the current selection light their accent (MOE's NOW logic) — no
   reordering, just light. Text layer selected → Text and Templates glow; keys selected → Motion Control.
3. **Result highlight in the timeline**: after a run, select exactly what was made (and say "n layers in MOE FX 2"),
   like Motion Dock's highlighted layers in its demo.
4. **Teaching empty states**: a ghost of the result + "Select 2+ layers, then Grid" — instead of disabled buttons.
5. **Strip mode for the most-used module** docked under the timeline (Motion Control strip: 8 curves + anchor + align).
6. **Learnable shortcuts**: every tooltip shows the key; the picker search accepts Arabic words (already in Ctrl+K).
7. **Recipes as modules**: a recipe (2–4 tools) can sit in the dock as one button with its own render.

## 5. Order
1. Tests to green in After Effects (bridge + Tile Test + Self-Test + Render previews) — blocking.
2. Host profile + Tile Test blind spots + Undo proof.
3. Design tokens consolidation (spacing / radius / borders / accent) — invisible risk, visible polish.
4. MOE Dock preview (web) → owner's pictures approval → panel.
