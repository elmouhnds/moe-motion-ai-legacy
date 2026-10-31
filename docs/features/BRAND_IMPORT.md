# Brand from website / PDF (v0.25)

Brand › **From website / PDF**: paste the client's website (or choose their brand book PDF) → **Analyse** → review →
**Save client** (or *Edit first*). Requested by the product owner: "give it the client's website or PDF and it
analyses it very well and fills everything brand-related automatically".

## What it fills
Name and tagline · colours **with roles** (primary, secondary, accent, background, surface, text, neutral) and where
the brand uses them · gradients · fonts (heading / body / Arabic / accent) **matched to the fonts installed on this
machine** (PostScript names, a heading gets Bold) — a missing Google font gets a *Get font* link, a custom face its
free fallback meanwhile · tone (keywords + sentence) · how it should move (feel, easing, pace) · usage rules · logo.
The saved client works with the existing tools at once: click a colour to apply it, *Auto fonts* for text layers.

## How (features/brand/scan.js, features/brand/fromSource.js)
1. **Website**: `platform.http.get` — HTTPS only (http upgraded, private addresses refused), every redirect HTTPS,
   max 5 redirects, 3 MB page / 900 KB per stylesheet / 1.5 MB logo, 20 s timeout. Nothing is executed: scripts are
   stripped, HTML and CSS are read with regular expressions. The digest: title, description, theme-color, headings,
   text sample, colours by use (hex / rgb / hsl / CSS variables, near-duplicates merged), font-family counts (icon and
   system fonts ignored), Google / Adobe font links, logo candidates (og:image, icons, `<img … logo>`, inline SVG).
2. **PDF**: read locally (≤ 25 MB, must start with `%PDF`) and sent as a `document` content block.
3. **Claude** (`claude-opus-5-5`, structured output `brand.fromSource` schema): digest + logo image (+ PDF). The site
   text is labelled as data, not instructions. The answer is re-validated (`cleanAI`): hex values, role / easing
   enums, lengths, counts; anything invalid is dropped. Monthly budget gate and cost log as for every AI call.
4. **Without AI** (no key, AI off, *Deep analysis* off, or Claude unavailable): a website still gets a **local scan**
   (theme colour + most used vivid colours as primary / secondary / accent, lightest as background, darkest as text;
   linked fonts first). A PDF needs Claude.
5. Fonts: `fonts.list` (host op) → `matchFonts`. Nothing is written to After Effects; nothing is saved until **Save**.

## Not verified
Mocked web, Claude and AE in tests; the preview uses a demo site and a canned answer. Real sites (Cloudflare-protected
sites answer 403 → the message suggests the PDF), real brand books and AE's font list are untested (TEST_REPORT 154–156).
