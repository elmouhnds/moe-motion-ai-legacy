# Feature design — Compositing: Recolor, Match, Green-Screen Key

Status: design approved for v0.2.0 · Module: `extension/features/compositing/` · Workspace: **Comp**

## 1. User problem
A compositor/motion designer repeatedly does the same manual steps:
- **Recolor a shot**: eyeballing white balance, exposure and contrast, then stacking several effects to push a look.
- **Match a foreground to a plate or a reference frame**: toggling between layers, nudging levels per channel until they sit together.
- **Set up a green/blue-screen key**: add Keylight, pick the screen colour with the eyedropper, add Key Cleaner, Spill Suppressor and a choker — the same 5-minute ritual on every shot.

These steps are measurable (pixel statistics) and repeatable, so they should be one click, editable afterwards, restorable, and work offline. Creative intent ("moody, cooler, filmic") is where AI helps.

## 2. Workflow (classification: **hybrid**, local-first)

| Step | Runs | Why |
|---|---|---|
| Analyze shot (pixel stats, cast, clipping, screen colour) | **Local** | Exact numbers come from AE itself (`sampleImage`). No AI needed. |
| Grade (exposure, contrast, saturation, temperature, tint, auto-balance, auto-levels) | **Local** | Deterministic math → one native Channel Mixer effect. |
| Match Color to a reference layer (plate or reference frame) | **Local** | Per-channel mean/σ transfer from sampled stats. |
| Green-Screen Key setup (auto screen colour, cleanup, spill, choke) | **Local** | Sampling + native keying effects. |
| Look from words ("teal shadows, warm skin, moody") | **Claude** → fills Grade settings | AI turns language + measured stats into numbers; the user applies them locally. |
| Copilot ("match the actor to the plate and cool it down") | **Claude plan** → local tools | Grade / Match / Key are AI-callable registered tools. |

No Offline/Online split: everything lives in the **Comp** workspace grouped by purpose (Analyze · Color · Key). The AI tool sits next to Grade in "Color".

Efficiency: one sampling host call per layer (all cells × times evaluated by one probe expression), one write host call, one undo step for the change.

## 3. Native APIs (all documented — After Effects Scripting Guide)

| API | Use |
|---|---|
| `LayerCollection.addNull()`, `Layer.remove()` | Temporary probe layer for sampling (removed in the same call) |
| `PropertyGroup.addProperty("ADBE Color Control")`, param `"ADBE Color Control-0001"` (convention shown in the guide's addProperty example) | Probe colour property |
| `Property.expression` + **expression** `layer.sampleImage(point, radius, postEffect, t)` | Pixel sampling (only available to expressions) |
| `Property.valueAtTime(t, false)` — *"waits for time-intensive expressions, like sampleImage"* (AE 13.6+) | Read sampled colours |
| `layer.property("ADBE Effect Parade").addProperty(matchName)`, `canAddProperty` | Add effects. Stored by `propertyIndex` (indexed group is rebuilt on add — documented warning) |
| `PropertyBase.name` (writable for effects), `moveTo()`, `remove()` | Name MOE effects, order them, restore |
| `Property.setValue()`, `Property.value` | Set / read effect parameters |
| `Project.bitsPerChannel` | Warn about clipping in 8-bpc |
| First-party effect match names (Scripting Guide › Match Names › Effects): `ADBE CHANNEL MIXER`, `Keylight 906`, `ADBE KeyCleaner`, `ADBE Spill2`, `ADBE Simple Choker` | Effects used |

Effect **parameter** match names are not documented per effect. Parameters are resolved at runtime, in order: English display name → `<Effect>-NNNN` convention → structural fallback (nth parameter of a value type). The method used is reported in the verification checks, so the first host run tells us whether each mapping is certain.

## 4. Tools — inputs, outputs, permissions

New permission scope **`modify.effects`** (default Allow; Copilot still always asks).

| Tool id | Inputs | Output / effect on project | Permissions | Recovery | AI-callable |
|---|---|---|---|---|---|
| `compositing.analyze` | `quality` fast/balanced/thorough, `sampleAt` current/spread | Report: mean RGB, luminance, black/white points, cast, saturation, 8-bpc clipping risk, screen-colour guess, swatches. No net change (temp probe) | `modify.layers` (transient) | undo (net zero) | no |
| `compositing.grade` | `exposure` −3..3 stops, `contrast` −100..100, `saturation` 0..200, `temperature` −100..100, `tint` −100..100, `autoBalance` 0..100, `autoLevels` 0..100, `quality` | One Channel Mixer named **MOE Grade** per layer, created or updated in place | `modify.effects` (+ `modify.layers` when auto needs sampling) | undo + checkpoint (remove created / restore params) | yes |
| `compositing.matchColor` | `reference` (layer #), `strength` 0..100, `quality` | Channel Mixer **MOE Match** (placed before MOE Grade) | `modify.effects`, `modify.layers` | undo + checkpoint | yes |
| `compositing.keySetup` | `screen` auto/green/blue, `cleanup` bool, `spill` bool, `choke` −10..10 | Keylight (**MOE Key**, screen colour sampled), optional **MOE Key Cleaner**, **MOE Spill**, **MOE Choke** | `modify.effects`, `modify.layers` | undo + checkpoint | yes |
| `compositing.lookAssist` | `description` text | Suggested Grade settings + explanation (never writes) → "Use in Grade" | `network.ai` | none | no |

Targets: selected, unlocked AV layers (footage, precomp, solid, shape, text). Null, camera, light: blocked with a reason. Adjustment layers: Grade without auto options only.

## 5. UI (existing design system, no new visual language)
- New main tab **Comp** (icon `layers`) after Tools; groups **Analyze**, **Color**, **Key** using the standard tool rows, presets, fields, report.
- New param type `layer` → dropdown of the comp's layers (by index + name), used by Match Color's reference.
- Optional tool hook `ui.renderResult` → Analyze shows colour swatches + stats; Look from words shows suggested values with **Use in Grade**.
- Presets: Grade (Neutral, Warm, Cool, Punchy, Muted, Bleach), Key (Green, Blue).
- Panel stays usable at 260 px (tabs collapse to icons).

## 6. Conflicts & mitigations
| Conflict | Mitigation |
|---|---|
| Re-running would stack duplicate effects | Effects are found by MOE name and updated in place |
| User renamed a MOE effect | Treated as user-owned; a new MOE effect is added (documented) |
| Layer already has a non-MOE keyer (Keylight, Linear Color Key, Color Range…) | Key Setup is blocked with the keyer's name |
| Order Match vs Grade | MOE Match is moved before MOE Grade |
| Analysis must ignore our own grade | Sampling uses `postEffect = false` (source pixels, before effects/masks) |
| Probe changes layer indices while it exists | Target resolved by `Layer.id`; probe removed in a `finally` block; layer count verified |
| `addProperty` invalidates references | Effects re-fetched by stored `propertyIndex` after every add/move |
| Param mapping uncertain (locale / version) | Resolve all params before setting anything; if any is missing, remove the effect just added and fail with a parameter dump |
| Channel Mixer range | Values clamped to ±200 %; clamping reported |
| 8-bpc projects clip offsets | Warning in Analyze and Grade preview |
| Sampling cost on heavy layers | Quality presets (9–36 cells × 1–5 times), single probe expression, longer host timeout for these calls |
| Expression engine (JavaScript vs Legacy) | Probe expression uses ES3-safe syntax that runs in both |
| Locked layers | Skipped with a warning; all locked → blocked |
| Backwards compatibility | Additive: new category, scope, param type, context fields and host ops; existing tools and settings unchanged |

## 7. Acceptance tests
1. Analyze returns the fixture's known mean colour (±0.01), removes the probe, leaves layer count and effects unchanged, balances undo groups.
2. Analyze detects a colour cast and black/white points on a gradient fixture.
3. Grade with neutral settings creates **MOE Grade** with an identity matrix (100 % diagonal, 0 elsewhere), verified by read-back.
4. Grade re-run updates the same effect (no duplicates).
5. Auto-balance on a warm-cast fixture: the computed matrix maps the measured mean to neutral grey (channel spread < 0.01).
6. Restore after create removes MOE Grade; restore after update restores the previous values exactly.
7. Match Color: transferred mean/σ of the target equal the reference's (±0.01); MOE Match sits before MOE Grade.
8. Match Color blocked when the reference is the target, missing, or not visible at the current time.
9. Key Setup (green fixture): screen colour ≈ fixture green; effects Keylight → Key Cleaner → Spill → Choke in order; re-run adds no duplicates.
10. Key Setup blocked on a layer with a non-MOE keyer, and on null/camera layers.
11. Unresolvable parameter → no effect left behind, clear error listing the effect's parameters.
12. Non-English parameter names → resolved by match-name convention and flagged "mapping unverified" in checks.
13. `modify.effects` = Off blocks the tools; Copilot-origin runs need approval.
14. Look from words: request carries measured stats; returned values are validated against Grade's schema; offline → clear error, nothing changed.
15. Copilot plan using `compositing.grade` validates.
16. All pre-existing tests still pass; old settings files load with the new scope defaulted.
17. UI preview: Comp workspace renders at 260/360/560 px with no console errors; reference dropdown lists comp layers.
