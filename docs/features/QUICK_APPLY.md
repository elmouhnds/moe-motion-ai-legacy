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
1. **Global shortcut** (Windows, Settings › Pie menu, default **Ctrl+Alt+Space**; Off possible): the main panel starts
   `core/platform/hotkeyWin.js` — a fixed PowerShell script that asks Windows for one hot key (`RegisterHotKey`) and
   prints the process in front; the panel opens MOE Quick only when that is After Effects (or its panels).
2. **Window › Extensions › MOE Quick** — a Modeless CEP window (`quick.html`, mode `quick`) that is only the pie.
3. **`extension/scripts/MOE Quick.jsx`** — copy into After Effects' Scripts folder; it sends a CSXS event
   (`tv.madtomato.moe.quick.request`) the main panel answers by opening the window.
The window closes itself after what was picked has finished (closing it earlier would stop its run), at once on cancel.

## Status — be honest
Mock tests only (`tests/quickapply.test.js`, `tests/workflow.test.js`). **Not verified in After Effects**: the hot key,
the Modeless window's position and focus, `requestOpenExtension` while the window is already open, whether After Effects
lets a keyboard shortcut be set on Window › Extensions › MOE Quick, the real menu command names, and `applyPreset` on
multi-layer selections. The side session checks these by hand before anyone says it works.
