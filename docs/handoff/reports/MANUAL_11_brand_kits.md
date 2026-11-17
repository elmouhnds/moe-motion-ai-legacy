# Manual test — Group 11: Brand · Style Kits / recipes · Assistant

| | |
|---|---|
| Date | 2026-11-17 |
| After Effects | **26.5.3 (Build 9)** / Diagnostics `26.5.3x9` |
| MOE Motion AI | **0.99.5** |
| Project | `MOE Manual Test.aep`, comp `MOE Manual Test G6 1080x1920` (the 9:16 Adapt made in Group 10) — a MOE Background with a card over it |
| Code | `features/brand`, `app/ui/kits.js`, `features/workflow` |

**All three work. The one thing that was not true is a promise the Style Kits page makes about undo, and it is
corrected here.**

## 1. The tools

| # | Tool | Verdict | What I saw |
|---|---|---|---|
| 1 | **Brand — Client kits** | **WORKS** | Three seeded example clients (Nile Roast, Pulse Pay, Sahara…), each marked **Example**. The open client card shows its line (*"Slow mornings, roasted by the Nile"*), a **Latin and Arabic** type sample (`Aa أبجد`), its palette and its tags (warm · crafted · calm). Colours are listed **by role** with their hex — BACKGROUND Espresso `#281A12`, PRIMARY Caramel `#C8763A`, SECONDARY Clay `#8C4A2F`, ACCENT Honey `#E9B872`, TEXT Crema `#F7EFE6` — over *"Select layers or a colour property, then click a colour"* with Fill / Stroke / Both. |
| 2 | **Brand whole comp** | **WORKS** | Applied in one click: the plain solid took the brand's **background** role (Espresso) and the **`MOE Background` gradient was left alone**, which is what `BRAND_IN_ACTION.md` asks for (never change a shared solid, leave MOE gradients alone). **One Ctrl+Z** put the orange card back. |
| 3 | **Style Kits** | **WORKS** | *"Each look's tools in one place, in the order you build it. Everyday tools stay where they are."* Kits carry live readiness from the real selection — **SaaS Product Video** *12 ready now* (35 tools · 6 steps · 3 recipes), **Apple Glass** *5 ready now* (24 tools · 5 steps · 2 recipes), Kinetic Type, Social & Reels. |
| 4 | **A recipe (Apple Glass › Liquid Card)** | **WORKS** | With nothing selected the recipe refused up front — **"Needs: Select a layer"** with its three step icons dim. That is `kitRun.precheck` doing its job: it never starts a recipe whose first step needs something. With the card selected the icons went green, and one click ran all three steps in order; the kit's progress moved to **3 / 5 steps** and the last step left its Retune strip (*Blur In · Blur 60 px*). |
| 5 | **Assistant** | **WORKS** | See §3. |

## 2. "One click, one undo" was not true — fixed

The recipes heading reads **"RECIPES · ONE CLICK, ONE UNDO"**. I ran the 3-step *Liquid Card* recipe and pressed
Ctrl+Z, counting:

| Presses | What was left |
|---|---|
| 1 | all six layers still there |
| 2 | all six layers still there |
| 3 | back to `Glass Card` + `MOE Background` |

**A three-step recipe takes three Ctrl+Z.** The repo already knows this — `CLAUDE.md` (v0.94) corrected the earlier
v0.75 claim itself: *"A Mix is one undo step per tool it runs (After Effects closes a group when each call
returns)."* The Style Kits page was never updated with it, so the UI was promising something After Effects does not
allow.

Changed to **"Recipes · one click, one undo per step"**, in the kit page and in the Ctrl+K entry that repeated the
same words. This is a false claim removed, not a design change — if you want different wording it is one string in
`app/ui/views/kits.js` and one in `app/ui/palette.js`.

## 3. Assistant

The window's order is fixed exactly as `ASSISTANT.md` sets it out — **what it sees → Suggested now → Do it for me /
Ask a question → the text box** — and it had read the real context:

```
One layer   MOE Manual Test G6 1080x1920   9:16 HD   Nile Roast
```

**Suggested now** gave two suggestions, each with its reason and one action, each dismissible:

- *"Working for Nile Roast — use their colours and fonts"* → **Apply brand**
- *"9:16 Reels · TikTok · Shorts comp — keep text clear of the app's buttons"* → **Social safe area**

Both are right about this comp: it noticed the 9:16 format and the active client. Under them, **Do it for me /
Ask a question** (one list at a time), the offline prompts (*Pop this in, then float gently* · *Fade it out at the
end* · *Center the anchor point*) and the sentence **"I plan it with MOE tools. Nothing changes until you
approve."**

### The conversation
I typed one Arabic word — **زجاج** — and it answered **in Arabic**, about the actual selection: that `Glass Card`
is a solid, that the Glass tool turns shapes, text and footage into liquid or frosted glass, and that a plain solid
shows little refraction so a Shape Layer or Thick Glass on a logo or text would be better. Then a plan:

```
⚠ Glass works best on shapes, text or footage; a plain solid may show little refraction.
1 · Glass — Frosted glass suits a card on a background and keeps the text readable.
    look: "Frosted"   tint: ""   rim: true   tintLayer: true   shadow: true
    Frosted glass on 1 layer(s)
[ Approve & run 1 step ]   [ Cancel ]
```

The plan shows its **real tool arguments** and nothing ran until I pressed Approve — the hard rule in
`permissions.js`. After approving: **"All 1 step(s) done and verified."**

**The Claude / Offline pill behaved correctly.** Before I asked anything there was no pill at all; it appeared as
**Claude** only once there was a conversation. That is the v0.86 rule — the pill comes from the conversation, never
from a guess about whether a key exists.

### What I could not test
The brief asks for **the offline part only, no API key needed**. This machine **has a key configured**, so the
moment I asked a question the real Claude answered. Everything above that needs no key — the window, the context
line, the suggestions and their reasons, the offline prompt list, the approval gate — I did see working. What I did
**not** test is the keyword-only fallback path (`workflow.keywordsOf` → Ctrl+K results + Power cards) that runs when
there is no key, because I was not going to remove the owner's key to get at it.

## 4. Numbers

| | |
|---|---|
| `npm run check` | **646 pass · 0 fail · 1 skipped** |
| Changed | two strings (the recipe undo promise) |

Nothing else in this group needed a fix.
