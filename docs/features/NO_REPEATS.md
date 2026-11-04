# No Repeats (v0.45.0)

**The owner's rule:** a button whose job is already on screen in a better place, or reachable in a more comfortable way, is clutter — remove it. *"The icon under Finish (AI): its content is the floating Assistant button and the search — delete it, and every button like it."*

**Ours, to keep it from coming back:** one button per job on a screen. Your own buttons are exempt (the Quick Bar, your pins), and so are things that come and go (*Next*). Nothing is taken away. A removed button's job stays one or two clicks away, and a test checks every one.

## What was removed

### MOE sidebar: 9 of its 10 menus

| Menu | Was | Is already |
|---|---|---|
| **AI** | Assistant · Search · → Expressions | the floating Assistant button (also <kbd>`</kbd> / Ctrl+Space), the search box (Ctrl+K), Animate tab › Expressions |
| Keys | Easy / Linear / Hold, curves, Reverse / Mirror / Copy, Stagger, Trim, Loop | the Motion Control on every tab + Keys tab (and its ▾ quick menu) |
| Layer | anchor, align, distribute, parent, flip, pre-compose … | Motion Control (anchor dots, align row) + Layer tab (▾) |
| Text | Typewriter, Counter, Rise / Cascade / Fade | Animate tab › Text Animators + Animate In / Out |
| Shape | Draw On ×4, Ring Copies, Wiggle, Pop / Spin In | Animate tab › Draw On, Toolbox, Motion presets page |
| Comp | Reveal, Open Pre-comp, Folder, Dup Comp, Purge, guides | Comp tab |
| Design | links to Shapes, Backgrounds, Looks, Brand | Design tab |
| Layout | Grid, Ring, Honeycomb, Spiral, Punch-in, Smooth Zoom | Layer tab › Arrange, Effect tab › Camera & Zoom |
| Finish | links to Compositing, Quick Bar, My Tools | Effect tab, *Customize* (sidebar), ≡ menu |

Each tab already had its tools, a **▾ quick menu** ("every action in two clicks, without leaving this tab") and a **dot** when it fits the selection. So every one of these menus was the third copy of its tab. **Select stays**: the owner asked for it to have its own place (v0.44), one click from any tab. The sidebar is now **Select + your Quick Bar + Customize**.

### NOW (Bento, Glass): tiles that were copies of what sits right above or below them

- **Search** and **Assistant** tiles (nothing selected): the search box is right above, and the Assistant button floats on every screen.
- **Motion Control copies**: the control leads NOW for every selection. Out Expo / Out Back were also curve chips, Easy / Linear / Hold were also its buttons, Anchor Bottom was also a dot, and Align / Distribute were also in its align row. The curve chips and Easy / Linear / Hold show only while the control is open; when you fold it, those tiles come back.
- **Glass**: NOW also leaves out what the open groups of the space below already show (one short screen). For example, with one layer in Animate it no longer repeats Fade In / Pop In / Slide In.

Bento keeps NOW tiles whose full group is further down the page: NOW is the short list at the top, the group is the full set in its place, two screens away. The audit reports these and does not fail them.

The **pie** keeps all eight (Search and Assistant included). It opens at the pointer, where none of the others are.

## Found by this release's audit (fixed)

- Library tiles were keyed `t-${id.slice(3)}`, so the start of the name was cut off: *Fade In*, *Rise In* and *Cascade In* were all `t-eIn`, and some tiles were just `t-`. The keys are now `t-<library>/<id>`. They are used to match buttons between renders and in the audits.

## Checks

- `tests/norepeat.test.js` (5):
  - the sidebar has only Select, and every button of the nine removed menus is still reachable: tab, Motion Control, Toolbox, a library page or the ≡ menu;
  - NOW never repeats Search, Assistant or the Motion Control, folded and open;
  - a Motion Control button counts as the same job only with the same tool and values (Out Expo chip = `curveExpo`'s bezier);
  - Glass NOW skips what the open groups show;
  - tile keys are whole.
- `node tools/audit-repeat.js`: Bento, every Glass space and every MOE tab, × 7 kinds of selection (84 screens). It lists the buttons on screen by the job they do, and fails on a job shown twice in one block, or anywhere in a Glass space or MOE tab.
  - **v0.44: 44 repeats.**
  - **v0.45: 0** (32 Bento NOW-vs-group, info).
