# Design — v0.4 "Layout & Speed": Grid, Resize & Adapt, Zoom, Glass, Quick Bar, Quick Expressions, Generate on Green

Owner requests: ClickZoom Pro (full feature set), Glasser, a CompResizer-style resizer **plus** full
adaptation of animated key visuals keeping keyframes, Grid Builder (studied, improved, easy UI, smart),
RKBar 2.9's most-used buttons, one-click expressions with icons, and generating green-screen elements
with AI and keying them.

## 0. Research (aescripts.com is blocked from this sandbox — sources are search results and vendor pages)

| Product | What it does (as published) | MOE approach |
|---|---|---|
| ClickZoom Pro (Edgard Store, CEP, AE 2022+) | Click-to-zoom 0–1000 %, zoom level / duration / 3 easing curves, Cursor Animator (arrow/hand, speed, fade, click), Match Cut, 3D camera depth, Smart Light spotlight, end at playhead, motion blur | **Zoom & Focus**: one `MOE Zoom` adjustment rig (Transform effect) — never touches footage; focus by point picker or selected layer (auto level); in/hold/out; 4 eases; chained zooms become pans; motion blur via the effect's own shutter; spotlight dim; **Follow Zoom** (expression, smoothed, edge-clamped); **Cursor Animator** with click pulse + ripple. Match Cut / 3D depth → roadmap. |
| Glasser (aescripts, Sep 2026, AE 2023–2026) | Editable liquid glass on shapes, text, footage, pre-comps; looks; Essential Properties; generated Control Null keeps glass aligned; precomps + native effects | **Glass**: adjustment layer track-matted to the source (AE 23 `setTrackMatte`) with Gaussian Blur (frost) → Optics Compensation (lens, centred by expression) → Brightness; linked Tint / Rim (Bevel Alpha, Overlay) / Shadow copies **parented to the source with an identity transform**, so no control null and no precomp are needed; 7 looks; every amount is a control on `MOE Glass N`; Brand Kit tints. |
| CompResizer (aescripts, v1.1.x, AE 2025–2026) | Reframe to any aspect in one click; temporary rig: parent → scale/position → release; effects/keys kept; one undo group; ratio lock | **Resize & Adapt**: Fit / Fill / Keep **and Smart** (see §2). Default output is a *new* comp. Applied as one uniform map per layer on values + every keyframe (+ tangents, ease speeds) — or as `MOE Adapt` rig nulls. Read-back by measurement. Nested full-frame layout pre-comps adapted inside a copy. |
| Grid Builder (aescripts, Jelic & Rambke, v2.x) | Arrange any layers from one Null with a Pseudo Effect; Rectangular, Radial, Path, Spherical; Twist & Stagger per asset; Proximity (v2) | **Grid Builder**: one `MOE Grid N` null, Expression Controls (+ Dropdown menus), 6 modes (Grid, Radial, Spiral, Sunflower, Path, Sphere), order (rows/columns/snake/seeded random), row offset (honeycomb), twist, scale step, random jitter, **Build** animation (6 styles × 5 orders, stagger), built-in **Effector**; live canvas preview in the panel that uses the *same maths* as the expressions; Grid Controls (live), Release / Freeze; plus **Layout Guides** (columns/rows/gutters/margins as AE guides) and **Place in Cells**. |
| RKBar 2.9 (owner's screenshot) | Icon bar: reveal, purge, flip, reverse keys, select matching property, trim paths, parent to null, pre-compose, separate X/Y (retain easing), clone & mirror keys, number counter, typewriter, duplicate comps, batch scale comps… | **Quick Bar** strip (every section) + **Quick** section + options popover; each button is a normal verified, restorable tool. Batch Scale Comps = Resize & Adapt; Split Text → roadmap. |

## 1. Navigation
Rail: **Quick** · Motion · Text · Brand · **Layout** · Select · Expressions · Comp · Tools. The Quick Bar strip sits
under the context line in every section (hide/show and pin from the Quick section). Still no Offline/Online split.

## 2. Smart adaptation (the hard part)
`features/adapt/planner.js` (pure, unit-tested):
1. **Measure** (`layers.describe` + `layers.bounds`): comp-space boxes of every layer at the reference frame (the
   playhead — park it on the hero frame) and the union over 5 samples. A parent carries its children: a group box is
   the union of its descendants.
2. **Classify** each top-level element: background (covers ≥ 80 %), band (full-width strip), pinned (≤ 3 % of the
   frame and hugging its zone's edges: logo, CTA, legal), content, point (nulls), nested (full-frame layout pre-comp),
   skip (camera / light / audio).
3. **Scale**: background = cover; band = fit width; pinned/content = UI scale `clamp(√(area ratio), fit, short-side)`,
   never larger than the safe area.
4. **Place**: zone anchoring (left/centre/right × top/middle/bottom) with edge distances scaled by the UI scale, then
   kept inside the safe margin. When the orientation flips (landscape ↔ portrait) content is **re-stacked** in reading
   order between the pinned elements.
5. **Apply**: one map `p' = s·p + d` per element → Position (value, all keys, spatial tangents ×s, ease speeds ×s) and
   Scale (×s) — timing, easing, expressions elsewhere, effects and masks untouched. Position expressions fall back to a
   `MOE Adapt` rig null automatically.
6. **Override / AI**: per-layer role and zone in the preview; **Ask Claude** sends names, text, types and normalised
   boxes (no pixels) and returns centres + widths, validated and clamped, shown in the preview before anything runs.
7. **Verify**: the new comp is measured again; each element must land on its planned box (±0.4 %).

## 3. Native APIs (all documented)
`Layer.setParentWithJump`, `Layer.parent`, `AVLayer.setTrackMatte / removeTrackMatte / trackMatteLayer` (AE 23),
`CompItem.duplicate / width / height / addGuide / removeGuide / guides / openInViewer`, `Project.itemByID / importFile`,
`ImportOptions`, `LayerCollection.addSolid / addShape / addNull / add / precompose`, `AVLayer.replaceSource`,
`Property.setValueAtKey / removeKey / keyInSpatialTangent / setSpatialTangentsAtKey / setTemporalEaseAtKey /
setPropertyParameters` (Dropdown, AE 17.0.1), `PropertyBase.selected`, `Shape`, Mask atoms (`maskMode`, `inverted`),
`app.purge(PurgeTarget.*)`, `app.findMenuCommandId / executeCommand` (Reveal Layer Source — English menu name, falls
back to selecting the item), `Folder.execute`, expressions `toComp / fromComp / sourceRectAtTime / pointOnPath /
tangentOnPath / wiggle / loopOut / loopIn / posterizeTime / seedRandom`. Effects by English parameter names first:
Transform (`ADBE Geometry2`), Optics Compensation, Gaussian Blur, Brightness & Contrast 2, Fill, Bevel Alpha, Expression
Controls (Slider, Angle, Checkbox, Color, Layer, Point, Dropdown).

## 4. Tools, permissions, recovery
| Tool | Permissions | Recovery |
|---|---|---|
| `grid.build` / `grid.update` / `grid.remove` / `grid.guides` / `grid.placeInCells` | layers, effects, expressions | undo + checkpoint (exact) |
| `adapt.resize` (copy or in place) · `adapt.suggestLayout` (Claude, read-only) | layers · network.ai | copy: remove created comps; in place: values, keys, eases, size, rigs restored |
| `zoom.focus` / `zoom.follow` / `zoom.cursor` | layers, effects, keyframes, expressions | rig/spotlight/cursor removed or only the written keys removed |
| `glass.apply` / `glass.look` | layers, effects, expressions | created layers removed, source re-enabled |
| `quick.*` (14 tools) | per tool | undo + checkpoint, except Pre-compose / Separate X/Y (Edit › Undo) |
| `expressions.quick` (17 presets) | expressions, effects | expressions + live controls restored |
| `generate.greenPrompt` (Claude) · `generate.importKey` | network.ai · layers, effects | — · imported layer + item removed |

## 5. Conflicts and decisions
| Conflict | Decision |
|---|---|
| Grid/Proximity/Quick expressions on the same property | refuse non-MOE expressions unless "Replace existing"; MOE tags (`// MOE Grid`, `// MOE Glass`, `// MOE Expr`, `// MOE Zoom Follow`) |
| Layer controls take indices (shift when MOE adds layers) | read indices after the null is created (`layers.describe`) |
| Glass needs the source's alpha but not its fill | source is hidden (`enabled = false`) and used as the matte; restore re-enables it |
| Adapt on parented layers | only top-level layers are mapped; children follow |
| Release from rig relies on AE compensation | not offered; rig stays (editable) or use Keyframes mode |
| Cameras / 3D | X/Y re-framed, Z and cameras kept, with a warning |
| Claude cannot generate images/video | Generate on Green = Claude prompt (green rules **enforced locally**) + your generator + Import & Key |
| "Purge All" clears Undo | default is image cache; All is marked destructive |

## 6. Acceptance tests (automated, mock)
Planner roles / fit-fill-keep / smart 16:9→9:16 (logo TL, CTA BR, headline above product, BG covers, all inside
safe area, no overlaps) / overrides + Claude clamp; Adapt copy keeps keys & timing, original untouched, measured
read-back, restore; in place rig + direct restore exact; nested pre-comp adapted in a copy; same-size refusal.
Grid layouts pure maths; build rect (expressions evaluated by the mock runtime equal the JS preview), live update,
restore exact; radial + random + build keys; sphere 3D + restore 2D; path on a shape path; conflict refusal; freeze /
remove; guides + place in cells keeping keys. Zoom maths, rig + keys + read-back, chained pan, follow, cursor. Glass
stack order, matte, hidden source, controls drive effects, look switch. Quick: reverse, mirror, flip, slide/fade,
trim travel, typewriter (Arabic → words), counter, parent to null, select same, separate, deep duplicate, pre-compose,
reveal, purge. Expressions quick presets. Green prompt enforcement; Import & Key chain + restore.
