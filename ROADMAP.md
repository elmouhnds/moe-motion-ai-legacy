# Roadmap

## M1 — Foundation ✅ (this milestone, v0.1.0)
- [x] Capability audit, PRD, architecture, UI/UX spec, risk report
- [x] Independent CEP 12 extension skeleton (manifest, panel, installer)
- [x] Read-only host connection: ping, selection context (comp, layers, properties, keys, expressions)
- [x] Tool registry, executor, permissions, history, checkpoints, settings, storage, diagnostics
- [x] Local motion tools: Smart Ease, Stagger Layers (verified by read-back, restorable)
- [x] Expression tools: Apply, Validate (real engine), Inspect, Remove, presets
- [x] Claude client (structured outputs, caching, fallback, retries), cost monitor + budget
- [x] Guided Copilot: plan → validate → approve → run → verify → roll back → save as tool
- [x] Expression Assistant (generate / fix / explain / optimize + diff)
- [x] Tool Factory foundation: data-only recipes, parameters, dry run, offline reruns
- [ ] **Host verification on Windows 11 + AE 2025** ← next action (TEST_REPORT.md checklist)

## M2 — Motion Director depth
- Visual ease graph editor (bezier handles → speed/influence), read current ease from selection
- Keyframe timing tools: retime, scale around playhead, snap keys to whole frames, reverse
- Overshoot / bounce generator (baked keys and expression variants)
- Copy / paste motion (ease + relative timing) between properties and layers
- Choreography: stagger by position, distance from a layer, or a curve; stagger keyframes (not only layers)
- Save user presets per tool from the Copilot

## M3 — Expression Engineer + Tool Factory depth
- Expression controllers: add Slider/Point/Checkbox controls and wire expressions to them (new host op, permission `modify.effects`)
- Link properties (pick-whip style), repair broken layer/effect references after renames
- Multi-property expression systems (procedural rigs)
- Tool Factory: test recipes on a disposable scratch comp (new op, explicit permission), export/import recipes
- Recipe parameters for Copilot-saved plans

## M4 — Productization
- ZXP signing + installer, update channel, version compatibility checks at startup
- Keyboard shortcut registration (`registerKeyEventsInterest`), panel flyout menu
- Performance profiling on large comps (1000+ layers)
- UXP host adapter spike once AE UXP is public (CEP retirement end of 2029)
