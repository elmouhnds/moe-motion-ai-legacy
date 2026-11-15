# Motion Dock — how it divides its interface (study for MOE, 2026-11-15)

**Source:** motionfun.net/motion-dock rendered in Chromium (owner-approved), its documentation (v13, 9 pages read in
full), the page's five demo videos (tools 27.6 s, build 11 s, layouts 4.5 s, docks 5 s, AEbar 3.8 s — studied frame by
frame as contact sheets) and the 30 module preview images of its picker. The YouTube review was not watched. Their
media stays in the session scratchpad only — nothing of theirs is bundled in MOE. *(inference)* marks my reading.

## 1. The idea in one line
Motion Dock is not a panel of pages — it is a **canvas of tools the user arranges**. "The dock takes care of the
workspace. Each tool takes care of a particular task, with its own controls and documentation."

## 2. How the interface is divided
| Layer | What it is |
|---|---|
| **Top bar** (one row) | `1 2 3` (layouts) · `Edit layout` (grid button) · `Settings` (gear). In edit mode it shows the selected slot's actions instead. |
| **Grid canvas** | 16 columns that grow with the panel's width, rows 25 px high, scrolls down for more. Each tool is a **module in a slot** you place and size. |
| **Modules** | 30+ tools (Petals, AEbar, Picky, Anchored, Noted, … + 20 "Essentials": renaming, parenting, keyframes, text, counters, comp sizes, renders). **"Individual tools choose their own layout based on the space they receive"** — a wide short slot = a toolbar; a tall slot = the full tool. |
| **Elements** | Text labels, dividers (horizontal/vertical by slot shape), images/GIFs — to organise a layout visually. Slot colours. |
| **Layouts** | Three per panel (keys 1, 2, 3: e.g. animate / organise / finish). A saved project remembers which layout it last used. |
| **Panels** | Up to five dock panels, each with its own three layouts, docked anywhere in After Effects. |
| **Isolate** | A panel can drop its top bar and fill edge to edge — one tool can look like a standalone extension. Controls move to After Effects' own ≡ panel menu. |
| **Settings** | A separate window; dock preferences (Spacing 2–10 px — **one number that sets the gaps between tools AND inside them**; Keep modules fixed; offline warning) and each tool's settings in a sidebar. |

## 3. The UX ideas that make it feel "above great"
1. **Two modes, never mixed:** *use* mode (tools work) vs *Edit layout* (dotted grid; clicks select/move/resize). No accidental rearranging while working.
2. **Empty state that teaches:** an empty layout offers four **starters by role** — Animator, Organizer, Designer, Essentials — or Blank. One click and the dock is usable; "you do not need to enter layout mode to use its tools".
3. **Adding is spatial:** click empty grid → picker opens *there*; drag a rectangle → the tool arrives in *that shape*. Picker: search (names, descriptions, groups), About (description + preview + docs), Enter adds the best match, Esc backs out. "Already in this layout" prevents duplicates (except tools that make sense twice).
4. **Responsive per tool, not per page:** each module adapts to its own slot, so the same tool is a strip or a full panel depending on where the user put it. *(inference: this is why users call it "the most responsive AE plugin layout")*
5. **Layout undo separate from After Effects' undo:** Ctrl+Z in edit mode undoes layout edits only; every removal toast has Undo; each layout has its own history.
6. **Few global numbers:** one Spacing value keeps the whole dock even; it follows After Effects' light/dark automatically.
7. **Memory without effort:** saves as you go; a project brings back its layout; export / sync one `.motiondock` file across computers.
8. **Everything reachable when chrome is hidden:** isolated panels keep their controls in After Effects' own panel menu.
9. **Modifier keys belong to each tool** (documented per tool), not to the dock.

## 3b. What the videos and module images show (the design, not just the docs)
**Panel anatomy (layouts video, a tall panel docked right of the viewer):** header row = "Motion Dock 1.0.0" + version
chip · `1 2 3` · grid · gear. Below it, modules stacked as rounded dark cards (≈10 px radius, 1 px hairline border, the
same ≈5 px gap everywhere). Layout 1 (designer): an AEbar icon row → Anchored 3×3 dots + Picky icon grid side by side →
Fits ratio buttons (16:9 · 9:16 · 1:1 · 4:5 · 4K · …) + Switched toggles → Petals palette flower (large) → a row of
ease-curve icons at the bottom. Layout 2 (organiser): Renamer (token chips `{name} {#} {comp}`, preview line "Nothing
changes", Apply) → Lineup sort icons → Nanny (Adopt · Chain · Release) + Copycat → Tidy (Scan ring + checklist).
Layout 3 (animator): Springy (5 mode icons + Apply Overshoot) → Spellbound (W Words · L Lines · A Letters · Split) →
Odo ($1,250,000 big read-out, From → To, format toggles , $ % .0 K, 5 ease icons, `123 Create`) + Yoink (PNG/GIF/MP4)
→ Accordion (Group · Fold · Unfold + a ghost layer tree "Select layers, then Group").

**Design language:**
1. **Grey first, colour as meaning.** Surfaces are neutral; each module owns ONE accent used only for its selected
   state and its primary verb (Springy orange, Odo/Clickety pink, Spellbound purple, Yoink/Tidy green, AEbar icons tinted
   by kind). Selected = tinted fill + accent border; never a full coloured button.
2. **Icon-first, words only where a choice must be read** (Adopt/Chain/Release, Words/Lines/Letters, ratios). Big
   square hit targets (~40–56 px) in even rows.
3. **Every module shows its result or state as the hero:** Odo's number, Petals' flower, BPM's "Tap in time", Butthead's
   stroke preview, Tidy's health score 60. The tool is its own preview.
4. **Empty states teach:** ghost tree + "Select layers, then Group"; Renamer "Nothing changes" until a token changes it.
5. **Feedback where you look:** a green toast at the top ("Saved Yoink … copied"), a pressed ripple on click, the
   affected layers highlighted in the timeline.

**Responsiveness (docks + aebars videos):** the same module redraws for its slot — Snippy goes from a 3×3 grid to ONE
row in a floating "Motion Dock 2" strip under the timeline; AEbar is a single icon row at the bottom of a layout and a
full grid in the picker. Panels can be tiny floating toolbars or tall docks.

**Editing (build video):** Edit layout → a dotted grid appears under the modules → click empty space → the picker
slides over the panel: search field, sections ANIMATE · TEXT · LAYERS · DESIGN, each module as a **real miniature
screenshot card** (name under it, ⓘ About, ✓ when already in the layout) → click a card → it lands in the drawn slot
with a blue selection frame and corner handles. The click shows a ripple; the panel never leaves the comp's view.

## 4. MOE compared
| | Motion Dock | MOE now |
|---|---|---|
| Organisation | user-arranged canvas of modules | fixed tabs / stages chosen by us (Animate · Timing · Layer · Design · Look · Deliver), 4 styles |
| Responsiveness | each module adapts to its slot | whole page adapts to panel width |
| Personal space | the whole dock + 3 layouts + 5 panels | Quick Bar, pins, pie, Recent |
| First run | 4 role starters | Home + stages |
| Modes | use vs edit layout | none (layout fixed) |
| Settings | separate window, per tool | inline Inspector per tile (strong — Motion Dock has nothing like MOE's previews / tool cards) |
| Depth | many small tools | fewer, deeper tools (Cloner, Matte FX, templates) with libraries and previews |

**What MOE has that Motion Dock does not:** rendered previews, Tool Cards (what a tool will do before it runs), libraries
with presets, kits and recipes, the AI assistant, one Ctrl+Z per production. **What MOE lacks:** the user deciding
what is on screen and where; per-module responsiveness; a clean use/edit split; role starters; multiple layouts.

## 4b. Concrete lessons for MOE's design (independent of a Dock)
- One spacing token everywhere (MOE has several gaps) and one card radius; hairline borders instead of shadows.
- One accent per tool family, used only for selected / primary — the rest grey (MOE uses the accent for many states).
- Each MOE group gets a **hero read-out**: the Motion Control's curve, the Cloner's live grid, Matte FX's rendered tile,
  the template's preview — and loses its explanatory text.
- Words only on choices; everything else an icon with a tooltip (MOE already has the icon set).
- Empty states that show the result's shape (ghost layers) + the one sentence of what to select.
- A picker of real miniature screenshots of each MOE group (we have the renderer for this).

## 5. Recommendation (for the owner to decide)
Add a fifth way of working rather than another style: **MOE Dock** — the same registered tools and groups MOE already
has (Motion Control, Quick Bar, Animate library, Grid / Cloner, Matte FX, Templates, Kits…) as **modules on a 16-column
grid**, each module drawing itself compact or full by the size of its slot, with:
1. Edit layout / use mode, spatial picker (search + About = the existing Tool Card + preview), layout-only undo.
2. Starters by role: **Animator**, **Motion Designer (MoGraph)**, **SaaS / Product**, **Typography**, **Arabic**.
3. Layouts 1-2-3 per panel (keys), project memory, export/import with the existing preset packs.
4. Isolate: one module (e.g. the Cloner or the Motion Control) fills the panel; the second MOE panel (Motion Kit)
   becomes "another dock panel".
Everything inside a module stays MOE's own (Tool Cards, previews, one Ctrl+Z) — only the arrangement becomes the
user's. *Not copied:* names, artwork or text of Motion Fun.
