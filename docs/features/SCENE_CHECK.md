# Scene Check (v0.80)

Owner picked ideas 5 · 18 · 19 · 20 (and 21, which Deliver already does).

| Part | From | Notes |
|---|---|---|
| What fits | `plan.suggest(scan)` | points with reasons: vertical comp → Social, sound → Beat Sync, text layers → Kinetic Type, MOE Template / Cursor → SaaS, MOE Glass → Apple Glass, MOE Grid / Clone → Effectors Pro, mostly still layers → Living Loops |
| Motion timeline | `plan.timeline(scan)` | life, keyed spans (Transform), layer + comp markers, expressions, playhead |
| Quality check | `plan.check(scan, { boxes, colours, brand })` | `fix` / `look` / `hint` / `info`; title safe and colours only after Measure |
| Storyboard | `plan.scenes` → `plan.board` → `plan.boardHtml` | comp markers, else layer markers, else 4 even moments; at most 12 scenes |

Tools: `scene.read` (read-only: `layers.describe`, `keys.snapshot`, `markers.list`), `scene.measure` (`layers.bounds` probe, `props.colorTargets` + `props.values`). Limits: 80 layers, 12 scenes, 40 shape layers for colours.

## Limits said in the UI
Schematic storyboard (no rendered frames) · colours of shapes only · title safe = 10 % at the playhead · Transform properties only on the timeline.

## Not verified
Mock + browser preview only. The Self-Test's **Scene** check reads layers, keys and markers back from After Effects.
