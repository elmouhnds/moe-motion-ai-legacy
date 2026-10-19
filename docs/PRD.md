# Product Requirements — MOE Motion AI

## Vision
A personal, professional motion-design workbench inside After Effects 2025: real tools that change real project data, with optional Claude intelligence where it adds value. Used daily on commercial work.

## User
One senior motion graphics / CGI / VFX artist. Works fast, knows AE deeply, hates clutter and anything that hides what changed.

## Principles
1. **Tools, not chat.** AI is contextual (Copilot bar, Expression Assistant, Tool Factory), never the main surface.
2. **Organized by purpose** — Motion, Expressions, Tools (+ Favorites, History, Settings, Diagnostics). Never by technology.
3. **Works offline.** All deterministic tools run locally; AI failures never block them.
4. **Nothing silent.** Preview → approval (for AI) → execution → verification by read-back → history with restore.
5. **Expandable.** New tools are new files in a feature module; registry, UI, search, Copilot and recipes pick them up.
6. **Independent.** Own repo, install, settings, storage, keys, versioning.

## Scope by module

### A. Motion Director
| Capability | Status |
|---|---|
| Smart Ease (influence presets, in/out/both, selected/all keys, correct dims per value type, HOLD-safe) | **Built (M1)** |
| Stagger Layers (frames, order: index/reverse/selection/random-seeded, offset/align, locked-safe) | **Built (M1)** |
| Graph-style ease editor (visual bezier), speed control | Planned M2 |
| Keyframe timing: retime / scale / snap to frames | Planned M2 |
| Overshoot / bounce (keyframe-based and expression-based) | Planned M2 |
| Motion copy/paste (ease + timing between props) | Planned M2 |
| Layer choreography (stagger by position/distance/curve) | Planned M2 |
| Motion controller generation (null + sliders + expressions) | Planned M3 |
| Natural-language motion commands | **Built (M1)** via Copilot using registered tools |

### B. Expression Engineer
| Capability | Status |
|---|---|
| Editor, apply to selection, revert on engine error | **Built** |
| Validate with real AE engine (apply-read-restore) | **Built** (host verification pending) |
| Inspect expressions/errors in selection | **Built** |
| Remove (restorable) | **Built** |
| Generate / Fix / Explain / Optimize with Claude + diff | **Built** |
| Expression presets (built-in + user) | **Built** |
| Repair broken references (rename-aware) | Planned M3 |
| Expression controllers (add Slider/Point controls) | Planned M3 |
| Link properties (pick-whip style) | Planned M3 |

### C. Tool Factory
| Capability | Status |
|---|---|
| Describe → Claude drafts recipe from existing tools | **Built** |
| Parameters with bindings, local validation, approval, save | **Built** |
| Reuse without Claude, dry run against live selection | **Built** |
| Save approved Copilot plan as tool | **Built** |
| Test on disposable project data (scratch comp) | Planned M3 |
| Export/import recipes | Planned M3 |

### D. Compositing (v0.2.0)
| Capability | Status |
|---|---|
| Analyze shot (colour stats, cast, clipping, screen colour) | **Built** |
| Recolor / grade (manual + auto balance / levels) as one editable effect | **Built** |
| Look from words (Claude → Grade settings) | **Built** |
| Match colour to plate / reference layer | **Built** |
| Green/blue screen key setup with auto screen colour + cleanup chain | **Built** |
| Reference image file (vision), curves/split toning, light wrap, grain match | Planned |

### Platform
Context inspection, registry, executor, permissions, presets, history, checkpoints, AI client, cost monitor, diagnostics, command search, favorites, compact/expanded layouts — **built (M1)**.

## Non-goals (v1)
Custom effects/plugins (C++), rendering pipelines, full-project scans, cloud sync, multi-user.

## Success criteria
- Local tools: ≤1 host call per run, verified result, one undo step, restorable.
- AI: never changes the project without approval; clear errors when offline; monthly budget enforced.
- Panel usable at 260–600 px width.
