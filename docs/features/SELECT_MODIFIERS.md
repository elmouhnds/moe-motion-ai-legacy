# Select Modifiers (v0.46.0)

**What was missing (v0.44 note):** the Select buttons on Home (Type · Same) always replaced the selection. Adding to it or taking away worked only on the Select page.

**Now:** the same keys as the Select page and After Effects, on every Select button:

| Click | Does | Example (Logo selected) |
|---|---|---|
| click | replace | *Text* → only the texts |
| **Shift**-click | add to the selection | *Text* → Logo + the texts |
| **Alt**-click | take away from the selection | *Text* → the texts leave, the rest stays |

- **Which buttons:**
  - the 12 filters, Type (8) and Same (4);
  - not *All · Invert · None · Back*: they act on the whole comp or the history, and a modifier would mean nothing there.
- **Everywhere they appear:**
  - Home rows in Bento, Glass and MOE;
  - the MOE *Select* menu;
  - the sidebar, the Quick Bar strip and its *+N* pop-up.
- **On the Quick Bar and the sidebar:** Alt-click used to open a button's options. For these 12 buttons it now removes, as it does everywhere else. Right-click still opens the options, for every button.
- **Saying so:**
  - every Select button's tooltip ends with *Shift-click: add · Alt-click: remove*;
  - the group and the MOE menu show one quiet line, *Shift add · Alt remove*, under the Comp row (not in the header: at 340 px it squeezed the group name).
- ***Back*** steps back after an add or a remove like after any Select.
- **Repeat (F4) does not repeat selections:** it only repeats tools that change the comp. This is unchanged.

## How it is built

- `features/quick/bar.js`:
  - `SELECT_MODS` (`shift` → `mode: 'add'`, `alt` → `mode: 'remove'`) is attached as `mods` to the 12 actions;
  - `withMods(a, e)` is the only place that reads the keys, and returns `{ args, label, mod }`;
  - `modsHint(a)` gives the tooltip line.
- `quickbar.run(app, a, e)` and `actions.resolve(...).run(app, e)`:
  - every button passes its click on: `layoutAE` buttons and rows, Bento tiles, the MOE menu and sidebar, the Quick Bar;
  - the label says the variant ("Select Text Layers (add)"), so the toast and History say which one ran.
- The tool was already able to do this. `select.layers` has `mode: replace | add | remove` from the Select page, and `selector.plan` does the set maths. No host change.

## Checks

- `tests/selectmods.test.js` (4):
  - exactly the 12 filters carry the keys;
  - `withMods`: Shift / Alt / both / none, and an action without `mods` ignores the keys;
  - on the mock: Shift adds, Alt removes, a plain click replaces, Same Label with Shift, then Back. Each result is read back from the comp's own selection;
  - every button passes its click on, and the tooltip and hint are there.
- **Playwright on the preview, read back from the mock's selection:**
  - in Bento, Glass and MOE: Shift + Shapes, Shift + Text, Alt + Shapes, then a plain Text;
  - in the MOE menu: Shift;
  - on the sidebar: Alt removes, and no options opened.
  - All matched the expected selection, with 0 JS errors.
