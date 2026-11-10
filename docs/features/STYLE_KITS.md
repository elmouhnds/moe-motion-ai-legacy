# Style Kits, Signature colours, brand motion (v0.75)

Owner: *"put the tools for a SaaS-style video in one window, the Apple Glass tools in one window — any look or technique
with its own style gathered in one place; general tools stay where they are."*

## Style Kits (`app/ui/kits.js`, `app/ui/views/kits.js`, Design › Style Kits in every style)
| Kit | Steps |
|---|---|
| SaaS Product Video | Backdrop · Build the UI · Bring it in · Interact · Camera |
| Apple Glass | Soft colour behind · Glass · Light & depth · Apple moves · Ease |
| Kinetic Type | Text animations · Split & clone · Rhythm · Accent |
| Social & Reels | Safe zones · On the beat · Energy · Hooks |
| MoGraph Cloner | Clone · Effectors · Colour & trails |

Each step is a row of existing one-click refs with their live previews (hover). Click applies through `actions.resolve`
(readiness first); right-click opens the tool's library. Tests: every ref resolves, each tool once per kit.

## Signature looks
16 complete looks with motion at the top of Backgrounds (tag *Signature*, ✦). Hover a card: it plays the real motion.

## Brand › Motion
Ease Out / Ease In (%) per client (`profile.motion.ease`), from Smooth · Snappy · Expo · Gentle · Soft land · Launch or
typed / dragged; the curve and a ball show the feel. Brand ease = Smart Ease with those values.

## One Ctrl+Z per Mix
`executor.batch(label, fn)`: one After Effects undo group around several runs; each run keeps its validate → verify →
checkpoint → History; always closed; nested batches join.

## Rules
Text previews say "MOE Motion" (Arabic "مو موشن"). Previews play on hover. Liquid sliders and the round-switch ring
are CSS that Reduced motion turns off.
