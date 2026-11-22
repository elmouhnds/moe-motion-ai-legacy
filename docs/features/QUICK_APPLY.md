# Quick Apply + MOE Quick (v1.0) — the owner's request

> "The Q pie should work inside the After Effects window, not only the panel. The middle should be a search — type the
> tools, effects, presets or anything in After Effects you want instead of looking for it, like FX Console. And a button
> that cancels, because when the menu opens you are forced to choose something."

## The pie's centre
- A search box (`app/ui/pie.js`, `app/ui/quickSearch.js`). One ranked list: MOE (everything Ctrl+K finds) and After
  Effects (`features/quickapply/catalog.js`): its effects (`app.effects`), its animation presets (`.ffx` under
  `Folder.appPackage/Presets` and `Documents/Adobe/After Effects */User Presets`, depth 5, 5000 files), and everyday
  menu commands that THIS After Effects answers by name (`app.findMenuCommandId`) — a name it does not know is not offered.
- Enter runs the highlighted result; **Ctrl+Enter** puts an effect on a new adjustment layer above the selection.
- After Effects items run through registered tools: `quick.applyEffect` (on the selected layers or a new adjustment
  layer — one undo group), `quick.applyPreset` (After Effects applies a preset to the comp's SELECTED layers, so the
  host checks the selection is the one the panel read; only an `.ffx` inside the two preset roots), `quick.runCommand`
  (the id is found again by NAME; Undo / Redo refused).
- **Never forced**: ✕ (top right), Esc, or a click outside cancels; releasing a held Q / right button on no slice keeps
  the pie open with the search box focused. The repeat of the last change is a chip under the box.

## Opening it from the After Effects window
A CEP panel hears keys only while it has the focus. Three ways:
1. **Global shortcut** (Windows, Settings › Pie menu, default **Ctrl+Shift+Space**; Off possible): the main panel starts
   `core/platform/hotkeyWin.js` — a fixed PowerShell script that asks Windows for one hot key (`RegisterHotKey`) and
   prints the process in front; the panel opens MOE Quick only when that is After Effects (or its panels).
2. **Window › Extensions › MOE Quick** — a Modeless CEP window (`quick.html`, mode `quick`) that is only the pie.
3. **`extension/scripts/MOE Quick.jsx`** — copy into After Effects' Scripts folder; it sends a CSXS event
   (`tv.madtomato.moe.quick.request`) the main panel answers by opening the window.
The window closes itself after what was picked has finished (closing it earlier would stop its run), at once on cancel.

## Nothing around the tools (v1.0.2, the owner)
Over After Effects the MOE Quick window is not a window any more. Three steps, in this order:
1. **The frame comes off** — `core/platform/hotkeyWin.js`, on each press: WS_CAPTION / WS_THICKFRAME / WS_BORDER /
   WS_DLGFRAME and the edge ex-styles go, the window is moved under the pointer (SetWindowPos, never activated or
   resized), and WS_EX_LAYERED + LWA_ALPHA (220 of 255) make the whole thing a little see-through.
2. **The disc goes** — `css/app.css`, `body.quick`: the pie draws no backdrop here, each slice is one of the panel's
   own chips and the search is the chip in the middle, on a wider ring (`pie.js R_BARE`) so the chips never touch.
   Inside the panel the pie is unchanged.
3. **The window takes their shape** — `core/platform/shapeWin.js`: the pie measures the boxes it really drew and a
   fixed PowerShell turns them into one region (SetWindowRgn). What the shape misses is not the window: After Effects
   shows through it and takes the clicks, so a click beside the chips lands in the timeline, and losing the window is
   what cancels the pie. The shape follows the drawing (the search state is a different one, and the results list
   grows as you type), it covers the toast a run leaves behind, and it is a single pixel the moment nothing is drawn
   — a shape that outlives its drawing is a row of empty black silhouettes sitting over After Effects. The measuring
   is in `app/main.js`, one place, because the window must follow the whole page and not only the pie.

Measured in After Effects 26.5.3x9, not assumed: **LWA_COLORKEY does nothing here.** The page paints exactly the key
colour (#010203, read back off the screen) and the COLORREF is right, but After Effects' CEP window draws through a
child surface a layered window's per-pixel key never reaches — with the alpha taken away the window came out
completely opaque. The region is what replaced it. Only numbers cross to either helper; both scripts are fixed text.

**Changing anything in the MOE Quick window needs After Effects restarted.** CEP hides that window instead of
unloading it, and the extension host keeps the page alive, so a new build of its CSS or JS does not reach it until
After Effects starts again (killing the host process leaves CEP unable to load the extension at all until then).

## Status — be honest
Tests: `tests/quickapply.test.js`, `tests/workflow.test.js`, `tests/quickhotkey.test.js`, `tests/quickbare.test.js`
(the chips never touch and fit the window), `tests/quickshape.test.js` (what may cross to the shape helper).

**Seen in After Effects 26.5.3x9 (2026-11-22, the owner's machine):** the global shortcut over the timeline, the
window under the pointer with no frame, the chips with no disc, the search state, the shape (the timeline is visible
between the chips and takes the clicks), the selection handed over (one layer → the layer's own slices), and the
window leaving nothing behind on cancel. **Still not verified in After Effects**: whether After Effects lets a
keyboard shortcut be set on Window › Extensions › MOE Quick, the real menu command names, and `applyPreset` on
multi-layer selections.
