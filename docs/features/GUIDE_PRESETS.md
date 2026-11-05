# Guide Presets, the Guides menu and the anchor pad (v0.53.0)

**The owner:** *"The Parent icon in MOE has no icon. Lists like Guides could join the others: the most famous guides, and the safe zones of social media, with fitting icons. And the anchor dots could look better than dots."*

## Guides: a fifth sidebar menu

Setting up a comp's guides is done at the start of every comp, from any tab. That is the kind of job a sidebar menu is for (docs/features/SIDEBAR_MENUS.md), and it is the fifth, which is the most the rule allows.

| Row | Buttons |
|---|---|
| **Lines** | Centre · Thirds · Golden · 12 Col |
| **Safe** | TV Safe (Title / Action) · Margins · Clear |
| **Social** | TikTok · Reels · Shorts · Stories |

- Each button also has its place in **Comp › Guides & Safe Areas** and on the Layout page (Guides mode).
- Each has its own icon (Lucide, no fake brand logos):

  | Button | Icon |
  |---|---|
  | Centre | crosshair |
  | Thirds | 3×3 grid |
  | Golden | ratio |
  | 12 Col | columns |
  | TV Safe | TV |
  | Margins | dashed square |
  | Clear | eraser |
  | TikTok | note |
  | Reels | clapperboard |
  | Shorts | play circle |
  | Stories | dashed ring |

## The presets (`features/grid/guidePresets.js`, pure)

| Preset | Guides |
|---|---|
| Centre | one vertical, one horizontal through the middle |
| Golden | 38.2 % and 61.8 % on both axes |
| TV Safe | action safe 93 % and title safe 90 % of the frame (SMPTE ST 2046-1) |
| TikTok | 1080 × 1920: top 220, bottom 480, left 60, right 140 px |
| Reels | top 270, bottom 670, left 65, right 120 px |
| Shorts | top 120, bottom 300, left 60, right 96 px |
| Stories | 14 % top and bottom (250 px), no side guides |
| Clear | removes every guide in the comp; Undo / Restore brings them back |

- **Social margins are approximate.** They are the figures most widely published for organic posts. TikTok and Reels come from the same comparison table; Shorts' top, bottom and right come from its own guide, and its left is set to 60 px like the others because that guide gives none. Stories use Meta's 14 %. The apps change their interface, so the result says *approximate*; check the final export on a phone.
- They scale with the comp: x by W / 1080, y by H / 1920. On a comp that is not 9:16, the result says *made for 9:16 — scaled to your W×H*.
- **Pressed twice adds nothing.** `guides.set` got `skipSame`: a guide already at that place is not added again, and the read-back counts it as *already there*.
- **The tile previews draw the preset's own lines** (`thumbs.gpreset` calls `guidePresets.lines`):
  - social zones show a phone with the covered areas shaded, the app's buttons down the right, the caption at the bottom, and the safe box dashed in the accent;
  - the other presets draw their lines in a 16:9 frame.

## Parent & Link icon

The menu named the icon `link`, which did not exist, so the button was empty. It now comes from Lucide (`tools/build-ui-icons.js`). A new test scans every `icon('…')` and `icon: '…'` in the panel and fails if any name is missing. It found only this one.

## Anchor pad

The 3×3 is now drawn as what it means: the layer's bounding box.
- a thin frame with a centre cross;
- square handles on the corners and edges, like After Effects' own transform handles;
- the anchor symbol (a ring with a crosshair) in the middle.

Hover fills the handle with the accent and adds a soft ring. Only colour and shadow change, never size (UI rule). The change is CSS only, so every style and the Motion Kit get it.

## Checks

- `tests/guides.test.js` (5), all read back from the mock comp:
  - Centre / Golden / TV Safe positions;
  - TikTok at 1080 × 1920, Reels' box, Shorts at half size, the not-9:16 note, Stories without side guides;
  - pressed twice adds 0 more; Clear leaves 0; Restore brings back 8;
  - the menu's rows, and every button in Comp › Guides;
  - every icon name exists.
- `node tools/audit-arrange.js`: 72 screens at 340 / 420 / 600 / 900 px, all 0, including the Guides menu (one family per row: Guide Lines, Safe Areas, Social Safe).
