# Best-in-class panel design — research summary (2026-11-15)

> Gathered by a research agent from **web-search result summaries** (page fetching was blocked for most sites), so
> quotes are paraphrase-level — spot-check before relying on one. Lines marked [Inference] are judgement, not sourced.
> Not found: mCloner Pro, Sequence Layers, Boombox, AEUX, Bodymovin, TouchDesigner/Notch UI details.

## AE panels — what the good ones do
- **Motion 4 / Motion Studio** (mtmograph.com): "Pin Tools" edit mode to choose favourites, then back to normal use;
  UI-scaling setting for docking; Shift/Ctrl/Alt click = variants; Motion Mini companion panel.
- **Flow** (schoolofmotion.com/blog/flow-after-effects): graph editor + library of 25 curve presets; Shift/Alt/Ctrl on a
  preset = ease in / in-out / out — one thumbnail, three jobs; "auto apply" live.
- **KBar** (toolfarm.com/?p=83765): several toolbars at once; modifier-dependent buttons; 3.1 tooltips list each
  modifier's action; spacer buttons; 600+ icons.
- **FX Console** (videocopilot.net): one shortcut → search for every effect/preset; rename, prioritise, favourite,
  override defaults; snapshot gallery.
- **Animation Composer 4** (misterhorse.com): speed first ("no loading delay"); every item has a video preview;
  hover-scrub on your own footage; drag a motion onto a clip's start or end; packs install by dropping a file.
- **Explode Shape Layers 3**: resizable responsive toolbar, show/hide buttons, help text in options.
- **Motion Tools Pro 2025** (aescripts.com/motion-tools-pro): grid-based customisable panel; per-panel layout copies
  (v2.0.14); "Share Center" exports a whole setup as one file (v2.1.0).
- **Ray Dynamic Color 2**: links colour properties by native expressions — projects work without the script; users
  complain links break on comp import.
- **Ease and Wizz**: expressions, not baked keys — survives without the tool.
- **Duik**: Angela redesigned for clarity; Bassel had Rookie / Standard / Expert UI modes (labels → compact).
- **Newton 4**: auto load/save settings, randomizer, select bodies in its preview.
- **Rubberhose 3**: "System" section refreshes the expressions of existing rigs (selection or whole comp).

## Outside AE
- **Blender areas**: split/join by dragging; a dark overlay previews which area a join will close; task Workspaces.
  Quick Favorites (Q) — but favourites were lost without a manual preferences save (a lesson).
- **Figma UI3**: Minimize UI (Shift+\); properties regrouped by workflow; labels opt-in — an icon-only control
  "slowed down workflows" (tooltip wait); floating panels reverted to fixed after feedback.
- **Raycast**: fast · simple · delightful; the hidden action button was missed → a bottom action bar that shows actions
  WITH their shortcuts (teaches them); Enter = primary, Cmd+K = all actions.
- **Linear**: theme from 98 variables to 3 (base, accent, contrast) generated in LCH; 2026 "calmer" refresh.
- **Stream Deck**: profiles switch automatically by the app in front; multi-actions; folders with auto-exit.
- **Ableton racks**: 8 macro knobs each driving many parameters over a range; Map mode separated from play;
  variations = stored macro snapshots, randomisable.
- **DaVinci Resolve**: task pages over ONE project / timeline.
- **Apple HIG**: panels = supplementary controls for the current selection; inspectors dense with small controls.
- **Spectrum 2 / Adobe**: 1.5 px icon strokes on 20 px; accent kept for primary actions.

## Design-system numbers
- Spectrum desktop component height 32 px; WCAG 2.2 target ≥ 24×24 px (AA), 44×44 (AAA).
- Dark UI (Material): elevation by lighter surfaces, not shadows; desaturated accents; text ≥ 4.5:1.
- Response limits (NN/g): 0.1 s instant · 1 s flow · 10 s attention. [Inference] hover/press 50–100 ms, panel changes
  150–250 ms, progress for > 1 s.
- Toasts for brief confirmations (with Undo); errors inline where they happened (Carbon).

## AE panel pain points (forums)
Too many panels · workspace gets disarranged · slow search for scripts · panels that will not dock · slow CEP start /
polling · undo split into many steps or "Undo group mismatch" · hidden settings · results that break without the tool ·
customisation lost.

## Recommendations it ranked (abridged — full list was 25)
P0: one named undo step per action (inside one evalScript) · < 100 ms visual response, progress > 1 s · lazy load, no
heavy polling · no modal dialogs for routine settings · results as native expressions/keys that survive without MOE.
P1: explicit layout-edit mode with Done + preview of destructive edits · layout undo separate from AE's · export/import
the whole setup · optional context-switched layouts (by selection) · isolate/minimise · one search palette showing
shortcuts and modifier variants · one modifier grammar for every module · one click = default, settings in a
selection-bound inspector · macro sliders + randomize + stored variations on Cloner / Matte FX · hover-scrub previews,
drag onto layers, favourites.
P2: theme from base/accent/contrast in LCH/OKLCH, elevation not shadows · desaturated per-tool accents · ≥ 24 px targets,
1.5 px icons · icon-first with opt-in labels · motion tokens · errors inline, toasts only for confirmations ·
beginner/expert density · task pages/starters over one selection · "refresh rigs" maintenance action · right-click
"pin to favourites".
