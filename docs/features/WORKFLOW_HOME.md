# Workflow Home (v0.28.0) — organised the way a motion designer works

## The brief
The owner: the tools were arranged "like a bot that memorised a menu, not one that understands". He wanted:
- important things that need explaining in a big card;
- things used all the time bigger and first;
- secondary things, rare things, and things that need the fastest access, each treated differently;
- an assistant inside After Effects (a floating helper you ask, which can also do the work);
- useful shortcuts;
- an organisation built on how a motion artist with years in AE actually works, across many projects of
  different shapes and sizes.

## The idea: distance = how often you use it
| Distance | What lives there | How you reach it |
|---|---|---|
| 0 clicks | the ten everyday tools, repeat, pie, search, assistant | **Alt+1…0**, F4, hold Q, Ctrl+K, **`** |
| always on screen | the **Everyday** Quick Bar (its first ten = Alt+1…0) and the **Assistant** button | top bar, bottom-right corner |
| top of Home | **NOW** — your selection → the big tool for it + its best actions; the comp's **format chip** | first thing you see |
| next | **Power tools** — deep features as big cards that explain themselves (what · when · needs · 3 steps · try · open) until you have used them three times or click ✓; then they shrink to a chip | sideways shelf |
| the page | **Stages** in the order a motion designer is in them: **Animate · Arrange · Design · Finish · Deliver** — everyday groups open, rare groups behind **More in <stage>** | index chips, **Ctrl+1…5** |
| search | everything else | Ctrl+K |

Nothing moves by itself: NOW follows the selection (that is its job), every other place is fixed so muscle
memory works. Cards only shrink (never reorder) as you learn them.

## Everyday (the first ten Quick Bar buttons)
Easy Ease · Out Expo · Center Anchor · Parent to Null · Pre-compose · Stagger · Loop Cycle · Wiggle · Reverse Keys ·
Duplicate Comp — the things a motion designer does dozens of times a day, in that order. The old default bar
started with Reveal in Project, Open Folder and Purge Cache (housekeeping) — that was the clearest sign of the
"menu memorised" problem. Purge / Open Folder now live in Deliver › Project and in search. A bar you customised is
kept as it is; Alt+1…0 runs whatever is in your first ten slots. Hold **Alt** to see the numbers.

## Stages (`app/ui/workflow.js` STAGES)
Each stage reuses the groups of the shared organisation (`layoutAE.TABS`) — same buttons, same importance tiers
(primary / standard / minor), same ▸ Recent memory. Every group has exactly one place (tested).

| Stage | Open (everyday) | More in … (rare) |
|---|---|---|
| Animate | Ease · Keyframe Assistant · Animate In · Animate Out · Draw On · Text Animators · Loops | Motion Rigs · Expressions · Curve Library |
| Arrange | Align · Anchor Point · Transform · Parent & Link · Grid Builder | Guides & Safe Areas · Select & Clean up |
| Design | Shapes & Icons · Backgrounds · Looks & Glass · Brand | — |
| Finish | Camera & Zoom · Color Correction · Keying | Stylize |
| Deliver | Every format · Project | Quick Bar & My Tools |

Bento (default) shows them as one page with sticky index chips; Glass uses them as its five spaces (Ctrl+1…5).
MOE keeps its After Effects menu tabs (Keys · Animate · Layer · Design · Effect · Comp) for people who think in AE
menus — the assistant, Everyday slots and project memory work there too.

## Power tools (`workflow.POWER`)
Ease & Speed Graph · Grid Builder · Thick Glass · Every format at once · Brand Kit · Zoom & Cursor · Animated
Backgrounds · Green screen & colour. Each card: what it does, when to use it, what it needs, three steps, a
one-click start on the current selection (readiness checked like every tile) and a link to its page. A card fits the
selection → accent rim + "for selection". Learned (3 uses, or ✓) → small chip. ≡ › *Explain the Power tools again*.

## Many projects, many shapes
- **Format chip** in NOW: 9:16 · HD · 30 · Reels / TikTok / Shorts — 4:5 Instagram feed — 1:1 feed — 16:9 YouTube /
  TV / web — wide banner / cinema; size HD / 2.5K / 4K / 720p; pixel aspect respected (HDV 1440×1080 reads 16:9).
- **Social safe area** suggestion on vertical / portrait / square comps: guides sized for the comp (≈ 6 % sides,
  ≈ 14 % top and bottom on 9:16, 8 % otherwise; video formats keep 5 % title-safe) — approximations, the apps move
  their buttons.
- **Each AE project remembers its client**: work on a project with a client active and the project learns it;
  open another project that has a client and MOE switches to it (toast). Untitled projects are never remembered;
  the last 60 projects are kept.
- **Panel sizes**: cards become one per row in a narrow docked panel (steps and details hidden below 330 px); wide
  panels show three cards side by side.

## Rules kept
- One place per tool; stages only arrange existing groups. A new tool goes into a `layoutAE` group as before, and
  that group's stage shows it.
- No hover style moves anything; the assistant button changes colour / shadow only.
- Suggestions are a number on the assistant button, never a pop-up; ✕ hides one for that comp.

## Honest limits
- Tested on the preview and the AE mock, not inside After Effects.
- Alt+digit inside AE: CEP panels receive key events only while the panel has focus; whether Windows / AE claims
  Alt combinations first is **unverified** (TEST_REPORT 167). The Quick Bar buttons work either way.
- The social safe-area margins are rules of thumb, not platform specs.
