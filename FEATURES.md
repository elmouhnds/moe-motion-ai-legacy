# Features (v0.2.0)

Legend: **Local** = no network. **AI** = uses Claude (optional). Host = verified in AE? (see TEST_REPORT.md)

| Workspace | Tool (id) | Type | What it does | Undo / recovery | Host verified |
|---|---|---|---|---|---|
| Motion | Smart Ease (`motion.smartEase`) | Local | Sets temporal ease influence (speed 0) on selected keys or all keys of selected properties. Presets Easy/Smooth/Strong/Snappy/Launch. Correct ease array size per value type; HOLD sides preserved; sides set to Bezier. | 1 undo step + checkpoint restore | ⏳ |
| Motion | Stagger Layers (`motion.stagger`) | Local | Offsets selected layers' start times by N frames (any fps), order Top→Bottom / Bottom→Top / Selection / Random(seed); mode add-to-current or align. Locked layers skipped. | 1 undo step + checkpoint restore | ⏳ |
| Comp | Analyze Shot (`compositing.analyze`) | Local | Measures mean colour, luminance, black/white points, cast, saturation, clipping, screen colour; swatch grid; one-click "Grade with auto balance" / "Key screen". Keyed layers are measured after the key. | Net no change (temporary probe layer, one undo entry) | ⏳ |
| Comp | Grade (`compositing.grade`) | Local | Exposure, contrast, saturation, temperature, tint, auto balance, auto levels → one Channel Mixer **MOE Grade** (created or updated in place). Presets Neutral/Warm/Cool/Punchy/Muted/Bleach. | 1 undo step + checkpoint | ⏳ |
| Comp | Look from Words (`compositing.lookAssist`) | AI + local analysis | Describe a look → Claude proposes Grade settings from measured stats → "Use in Grade" fills the form. Never writes. | — | n/a |
| Comp | Match Color (`compositing.matchColor`) | Local | Per-channel mean/σ transfer from a reference layer (plate or still) at the current frame → **MOE Match** (placed before MOE Grade). Refuses unkeyed screens. | 1 undo step + checkpoint | ⏳ |
| Comp | Screen Key (`compositing.keySetup`) | Local | Keylight with sampled screen colour (auto/green/blue), optional Key Cleaner, Advanced Spill Suppressor, Simple Choker, placed before colour effects. Blocks when a user keyer exists. | 1 undo step + checkpoint | ⏳ |
| Expressions | Apply Expression (`expressions.apply`) | Local | Sets the editor code on all selected expression-capable properties; reverts if AE reports an error. | 1 undo step + checkpoint | ⏳ |
| Expressions | Validate in AE (`expressions.validate`) | Local | Applies to the selected property, reads `expressionError`, restores original. | Net no change (leaves one undo entry) | ⏳ |
| Expressions | Inspect Expressions (`expressions.inspect`) | Local, read-only | Lists expressions + engine errors in the selection. | — | ⏳ |
| Expressions | Remove Expressions (`expressions.remove`) | Local | Clears expressions on selected properties. | 1 undo step + checkpoint | ⏳ |
| Expressions | Expression Assistant (`expressions.assist`) | AI | Generate / Fix / Explain / Optimize for the selected property; shows explanation, notes, required controls and a line diff. Never writes. | — | n/a |
| Expressions | Presets | Local | 6 built-in (Wiggle, Loop cycle, Ping-pong, Inertial bounce, Spin, Slider link) + user presets. | — | — |
| Tools | Tool Factory | AI → Local | Describe a utility → recipe from existing tools with parameters → review → save. | — | n/a |
| Tools | Saved tools (recipes) | Local | Run with parameters, Dry run against selection, delete. | Each step checkpointed | ⏳ |
| Everywhere | Copilot | AI → Local | Natural language → typed plan of registered tools → validation → approval → execution with verification → rollback / save as tool. | Per-step checkpoints | ⏳ |
| Everywhere | Command search | Local | Ctrl+K or `/`: tools, saved tools, commands, navigation. | — | — |
| Everywhere | Favorites, per-tool presets | Local | Pin tools; save/delete parameter presets (right-click to delete). | — | — |
| History | History | Local | Every run with status, origin (you / Copilot / recipe), restore button. | — | — |
| Settings | Settings | Local | API key (DPAPI), model, effort, monthly budget, per-scope permissions (incl. Change effects), read limits, layout density; link to Diagnostics. | — | — |
| Diagnostics | Diagnostics | Local | AE version/build, host module, runtime, data folder, AI usage/cost, log, copyable report. | — | ⏳ |
