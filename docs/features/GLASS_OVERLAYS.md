# Glass overlays (v0.83)

Owner: *"In Glass, anything that pops up or any menu that appears over the plugin is transparent. It must be opaque, or the other menus get another style than the main interface, so their information is easy to read."*

## Measured before
| Surface | Opaque |
|---|---|
| Sidebar menus (Select, Parent & Link …) | 7 % |
| A tool's options | 7 % |
| Sheets (What's new, About, Shortcuts) | 7 % |
| Toast | 7 % |
| Assistant | 7 % |
| Panel menu (☰) | 78 % + blur |
| Search, dialog | 100 % |

## Now
One block in `css/styles.css` gives every floating surface in Glass solid tokens (dark `#221e2d` family, light `#ffffff` family), a 1 px firm edge and a deep shadow; children inherit the tokens. The scrim behind a dialog is 60 %. The page's cards are untouched.

## Guard
`node tools/audit-overlay.js` — 64 surfaces, 0 see-through.

## Not verified
Chromium preview only; not seen in After Effects' panel.
