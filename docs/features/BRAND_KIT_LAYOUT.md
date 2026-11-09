# Brand Kit, organised (v0.73)

Owner: *"the brand kit is full of information, not organised or easy — make 3 default brand kits so the section can be
previewed, and organise its interface."*

## Three example clients (`features/brand/examples.js`)
**Nile Roast** (coffee, warm, smooth / slow), **Pulse Pay** (fintech, neon, snappy / fast), **Sahara Atelier** (Arabic-first
luxury, gentle / slow). Ordinary clients: colours with roles (background · primary · secondary · accent · text — body
text ≥ 4.5:1, tested), Arabic + English fonts from Windows (Tahoma, Segoe UI, Georgia, Sakkal Majalla, Palatino Linotype),
gradients, tone, motion feel (→ Brand ease), rules. `profile.example` shows an *Example* badge.
- Saved once, the first time Brand opens with **no** clients (`brand-examples-seeded`) — never over your own.
- Manage › *Add the example clients* brings back the ones you deleted.

## The page (`app/ui/views/brand.js`)
1. **Clients** as cards (colour fan + name), *New client* → From website / PDF · By hand.
2. **The client card** in the brand's own background, name and tagline in its fonts, *Aa / أبجد* samples, palette dots, tone.
3. **Actions**: Apply brand · Brand whole comp · Brand ease · Make backgrounds.
4. **Tabs**: Colours (click to colour the selection, roles shown) · Type (fonts by script, Auto fonts, fonts to install) ·
   Guide (gradients, tone, motion, rules, notes, source) · Manage (edit, copy / import JSON, examples, delete).
Import and Edit are unchanged.
