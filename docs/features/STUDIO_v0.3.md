# Design — v0.3 "Studio": navigation rail, Brand Kit, Text Animation Library, Proximity, Select

Inputs from the product owner: ProximityPro screenshots, CorridorKey references, their own
`Moe_Selector_v5.jsxbin` and four text-animation presets (`Animation_IN_Down/Up/Right`, `Animation_Out_Down`).

## 0. Research summary

### ProximityPro (from the owner's screenshots — no public docs found)
One **effector null** controls all selected layers. Each layer's influence = distance from its
anchor point to the effector, inside a radius. Features: Scale Up/Down, Push Away, Pull Toward,
Position X/Y/Z, Rotation X/Y/Z, Skew, Fade/Reveal Opacity, Glow, Drop Shadow, Color Shift,
Exposure, Look At 2D/3D, Time Remap Play Forward/Reverse. All amounts live in Effect Controls
of the effector (sliders "Proximity Radius", "Push Away Amount"…). Buttons: Apply, New Effector,
Remove Selected, Remove All, Center Anchor. → Pure expressions + Expression Controls: **fully
local**, reproducible with documented APIs.

### CorridorKey
Neural keyer (Corridor Digital, March 2026, CC BY-NC-SA); "CorridorKey by blace.ai" is a commercial
native C++ AE plugin. A neural keyer cannot run inside CEP/ExtendScript. MOE **integrates** with it
instead: Screen Key can discover an installed AI keyer through `app.effects` and use it as the
keyer in the MOE chain. No reverse engineering of third-party binaries.

### Moe_Selector_v5 (owner's own tool — strings decoded from the .jsxbin)
Scope (active comp / selected comps / project) · select by 18 layer types (Text, Shapes, Images,
Videos, Audio only, Solids, Nulls, Pre-comps, Cameras, Lights, Adjustment, 3D, Guide, Shy, With
Effects, Expressions, Motion Blur, Active Now) · replace/Shift-add/Alt-remove · filters enabled-only /
unlocked-only · search name/source/comment/extension · select same type/source/label/name/effects
as a reference · label colours (from AE prefs) · select/apply label · all/invert/clear · selection
history back/forward · solo/visibility/lock/shy toggles.

### The owner's text presets (decoded from the RIFX `.ffx`)
| Preset | Animator | Based on | Shape | Ease H/L | Offset keys | Props |
|---|---|---|---|---|---|---|
| IN Down | IN | Words | Ramp Up | 25 / 100 | −100 → 100 over 1.733 s (52 f @30) | Position 0,−100 · Opacity 0 · Blur 16 |
| IN Up | IN | Words | Ramp Up | 25 / 100 | same | Position 0,+88 · Opacity 0 · Blur 16 |
| IN Right | IN | Words | Ramp Up | 25 / 100 | −100 → 100 over 1.167 s | Position −100,0 · Opacity 0 · Blur 16 |
| Out Down | OUT | Words | Ramp Down | 25 / 100 | −100 → 100 over 1.167 s | Position 0,+100 · Opacity 0 · Blur 16 |
Keyframe ease: 33 % / 33 % on the first key, 33 % in / 16.7 % out on the last (bezier, speed 0).
Time base in the file: 30 720 ticks/s (1 024 ticks per frame at 30 fps).

## 1. Navigation (the panel becomes a studio)
A slim **left rail** (40 px, icons + tooltips) replaces header tabs, so sections scale:
Motion · Text · Brand · Select · Expressions · Comp · Tools, and at the bottom Favorites · History · Settings.
Header shows the section title + search. Copilot stays a single bottom bar. Still no Offline/Online split.

## 2. Modules, workflow and classification
| Module | Tools | Runs |
|---|---|---|
| **Brand Kit** | Clients (name, palette, Arabic + English fonts, notes), click swatch → colour selection, click font → apply to selected text layers; "Auto fonts" picks Arabic/English font per layer from its text; extract palette from selected footage (pixel analysis) | Local |
| **Text Animation Library** | Preset grid with live previews (In / Out), filters, duration & direction controls, Apply to selected text layers at CTI (Out = ends at layer out point), import `.ffx`, the owner's 4 presets + new premium presets, Arabic-safe badge | Local |
| **Proximity** | New Effector, Apply Proximity (features as checkboxes), Remove Selected / Remove All, Center Anchor | Local |
| **Select** | Moe Selector features | Local |
| **AI** | Copilot can call Brand Apply, Text Animate, Proximity Apply, Select; Look-from-Words exists; "Palette from description" via Claude | Claude (optional) |

## 3. Native APIs
Text: `ADBE Text Properties › ADBE Text Document` (TextDocument: `font`, `fillColor`, `applyFill`, `direction`,
`composerEngine`, `text`), `app.fonts.allFonts` / `FontObject.postScriptName/familyName/styleName/writingScripts`.
Animators: `ADBE Text Animators › addProperty("ADBE Text Animator")`, `ADBE Text Selectors › ADBE Text Selector`,
`ADBE Text Percent Start/End/Offset`, `ADBE Text Range Advanced › ADBE Text Range Units / Type2 / Shape /
Selector Mode / Max Amount / Smoothness / Levels Max Ease / Levels Min Ease / Randomize Order`,
`ADBE Text Animator Properties › addProperty(ADBE Text Position 3D | Scale 3D | Rotation | Opacity | Blur | Tracking Amount | Skew …)`.
Presets: `Layer.applyPreset(File)` (applies to the comp's *selected* layers). Colour: `Property.setValue/setValueAtTime`
on `ADBE Vector Fill Color` / `ADBE Vector Stroke Color`, effect COLOR params, `ADBE Fill` for solids/footage.
Proximity: `LayerCollection.addNull`, Expression Controls (`ADBE Slider Control-0001`, `ADBE Checkbox Control-0001`,
`ADBE Color Control-0001`), expressions on transform properties, `AVLayer.sourceRectAtTime` (Center Anchor).
Select: `CompItem.layers`, `Layer.selected/label/solo/enabled/locked/shy`, `AVLayer.source`, `FootageItem.mainSource`,
`app.preferences.getPrefAsString` (label names/colours, as Moe Selector does). AI keyers: `app.effects`.

## 4. Inputs / outputs / permissions
| Tool | Inputs | Output | Permissions | Recovery |
|---|---|---|---|---|
| `brand.applyColor` | brandId, colorIndex, target fill/stroke/both | colour set on selected COLOR properties, text, shapes; solids/footage get **MOE Brand Fill** | modify.layers, modify.effects | undo + checkpoint |
| `brand.applyFont` | brandId, role auto/arabic/english/extra | fonts on selected text layers (+ RTL + universal composer for Arabic) | modify.layers | undo + checkpoint |
| `brand.extractPalette` | count | colours from selected footage (local k-means on sampled cells) | modify.layers (temp probe) | none (no net change) |
| `text.animate` | presetId, duration, basedOn, direction | animator named **MOE In/Out …** on selected text layers | modify.layers | undo + checkpoint (animator removed) |
| `text.applyFfx` | imported preset id | `.ffx` applied via `applyPreset` | modify.layers | undo |
| `proximity.apply` | features[], radius, effector | effector null + controls; expressions tagged `// MOE Proximity` | modify.layers, modify.effects, modify.expressions | undo + checkpoint |
| `proximity.remove` | scope selected/all | tagged expressions removed | modify.expressions | undo + checkpoint |
| `proximity.centerAnchor` | — | anchor centred without visual jump | modify.layers | undo + checkpoint |
| `select.*` | type/label/search/same/filters/mode | layer selection changed (history kept) | read + selection | history back/forward |

## 5. UI
Same tokens and components. New: rail, swatch buttons, font rows, preset cards with `<canvas>` previews,
feature checkbox grid. Arabic UI strings stay English per project rules (technical UI); sample text in
previews can be Arabic or English.

## 6. Conflicts
| Conflict | Mitigation |
|---|---|
| Source text keyframed | set at current time (`setValueAtTime`) and report |
| Solid colour is shared by every layer using that solid | never change `SolidSource.color`; add MOE Brand Fill effect instead |
| Fonts missing on the machine | font chooser lists installed fonts; apply checks PostScript name exists (`getFontsByPostScriptName`) |
| Arabic per-character animation breaks letter joining | presets flagged *Arabic-safe* (words/lines); character presets on Arabic text warn and switch to Words |
| `applyPreset` affects selected layers, not one layer | apply only after confirming the selection = intended text layers |
| Re-applying a text animation | animators named `MOE In:` / `MOE Out:` are replaced, not stacked |
| Proximity expression references effector by name | effector names are unique (`MOE Effector N`); rename detection in Remove |
| Existing expressions on target properties | stored in checkpoint; Apply refuses properties that already have non-MOE expressions unless "replace" is on |
| Selection tools must not break the undo history | selection changes are not undoable in AE; MOE keeps its own back/forward history |

## 7. Acceptance tests
Brand: create/edit/delete client; colour → text fill, shape fill+stroke, selected COLOR property, solid via MOE Brand Fill (not SolidSource); font auto by script; missing font refused; keyframed source text handled; restore.
Text: owner presets reproduce decoded values; apply creates animator with correct selector/advanced/props/keys at CTI; Out ends at out point; re-apply replaces; restore removes; ffx parser reads all 4 files; Arabic-safe enforcement.
Proximity: effector + controls created; expressions valid JS referencing effector; features map to properties; existing user expression protected; remove selected/all; center anchor keeps visual position.
Select: each type filter, add/remove modes, search, same-as-reference, label select/apply, invert/clear, history back/forward, unlocked/enabled filters.
Shell: rail renders 260/360/560 px, every section reachable, no console errors; all previous tests pass.
