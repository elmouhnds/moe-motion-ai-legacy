# Sidebar Menus (v0.46.0)

**The owner:** *"Menus as important as Select deserve to sit under it. Think like a person: what is used the way Select is, by its job and its idea."*

## What makes a menu earn a place in the sidebar

v0.45 removed nine menus because each one was **a whole tab again**: the tab already had its tools, its ▾ quick menu and its selection dot. Select stayed because it is different. A menu belongs in the sidebar when it is:

1. **One job**, not a tab (Select = choose layers).
2. **Done many times a day, from whatever tab you are in**: you pick layers, link them, animate them in and out, and loop them, whatever you are working on.
3. **Variants that read as labelled rows**: each row is one family side by side (*Fade: In · Out*), so opposites never sit apart.
4. **Short**: at most five menus, otherwise it is the clutter v0.45 removed.

Every button in a menu also keeps its own place in a tab or library page. The menu is the fast way in from anywhere.

## The menus, in the order of the work (five since v0.53, the most allowed)

| Menu | Rows | Its place in the tabs |
|---|---|---|
| **Select** (v0.44) | Type · Same · Comp (+ Shift adds, Alt removes) | Layer › Select |
| **Parent & Link** | Parent: To Null · Chain — Follow: Delay · Stare | Layer › Parent & Link |
| **In / Out** | Fade: In · Out — Pop: In · Out — Slide: In ← · In ↑ · Out ← · Out ↓ — Spin: In · Out — Draw: On · Erase · Travel · Both | Animate › Animate In / Out (one mode at a time there) |
| **Loop** | Loop: Cycle · Ping-Pong · Offset · In + Out — Idle: Wiggle · Float · Pendulum · Pulse | Keys › Keyframes & Loops, Animate › Expressions |
| **Guides** (v0.53) | Lines: Centre · Thirds · Golden · 12 Col — Safe: TV Safe · Margins · Clear — Social: TikTok · Reels · Shorts · Stories | Comp › Guides & Safe Areas (docs/features/GUIDE_PRESETS.md) |

In the tab, Animate In / Out shows one mode at a time (In, Out or Draw On). The menu puts each move next to its opposite, so Fade In and Fade Out are one row.

Considered and left out:
- **Project** (Reveal, Open Pre-comp, Dup Comp, Purge): used, but not several times an hour. It stays in the Comp tab.
- **Text animators**: they need a text layer, and they already come first on the Animate tab when text is selected.
- **Ease, anchor and align**: they are in the Motion Control at the top of every tab.

## Checks

- `tests/norepeat.test.js`:
  - at most 5 menus, Select first;
  - no menu shares a tab's name;
  - each menu has 2–5 labelled rows, and every button resolves and also has its place in a tab;
  - families are side by side (`arrange.splits` is empty);
  - In / Out rows are *In, Out*;
  - none of the nine removed menus came back.
- `node tools/audit-arrange.js`: 68 screens, including the three new menus at 340 / 420 / 600 / 900 px, all 0.
- Playwright: each menu opened from the Design tab and one button run: Parent to Null, Fade In, Wiggle. 0 JS errors.
