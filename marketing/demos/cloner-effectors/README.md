# Cloner + Effectors — product demo

An animated hero for the MOE Motion AI site and socials, built with the **Stageshow** skill
(benjitaylor/skills, MIT — `~/.claude/skills/stageshow`), from its `dark-hero` / `hero-demo` gold examples.

- `moe-cloner-effectors.mp4` — one seamless loop, 1520 × 920, 13.8 s (starts and ends on the payoff frame).
- `poster.jpg` — the payoff frame (thumbnail / reduced motion).
- `index.tsx`, `moe.css` — the scene (React + the Stageshow kit). Wide 760 × 460, compact 358 × 350 (phone column).
- `REHEARSAL.md` — what was filmed, the gate results, the fresh-eye review and what is not checked.

Story: the MOE panel docked in After Effects → Clone → Clone Ring (one star layer spirals out into 12, the timeline
gains MOE Grid 1) → Effectors → Grow (a MOE Effector glides over the ring and grows the stars it passes, the timeline
gains MOE Effector 1) → ⌘Z ⌘Z. The grow maths is the real one (`features/grid/effectors.js`, Sphere falloff).

Rebuild / edit: copy this folder to `~/.claude/skills/stageshow/examples/moe-cloner/`, run the skill's preview
(`npm install`, then Vite on `playground`), film with `scripts/film.mjs "<preview>/?capture=moe-cloner" --gate`.
It is an illustration, not the plugin's code: it does not run inside After Effects.
