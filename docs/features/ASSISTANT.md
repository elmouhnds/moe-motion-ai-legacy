# MOE Assistant (v0.28.0) — a helper that floats in the corner

## What it is
A round button in the bottom-right corner of the panel (right-click it: bottom-left). Press **`** or **Ctrl+Space**
anywhere in the panel, or click it.

The sheet has four parts:
1. **Suggestions** — up to three, for what is in front of you: *9 layers — offset them one after another*,
   *keyframes — give them a curve*, *9:16 comp — add the social safe area*, *working for Nile & Co. — apply their
   brand*, *empty comp — start with a background*. One click runs it; ✕ hides it for that comp. The count shows as a
   small number on the button. Never a pop-up.
2. **Conversation** — your messages and the assistant's replies. Earlier turns are sent back (last 6, each cut to
   600 characters) so "now slower" or "the other layer" work.
3. **Quick prompts** for the selection when the conversation is empty (keys: *Make these keys snappy* …).
4. **One text box** — Arabic (Egyptian included) or English. Enter sends, Shift+Enter new line, Esc closes.

## Ask and do
`core/ai/assistant.js` sends one structured request:
- **answer** — questions about After Effects, motion design or MOE are answered in the language you wrote in, with
  AE menu / effect names in English.
- **plan** — a change becomes steps made only of registered `ai.callable` tools (same schema and rules as the
  Copilot). Steps are re-validated locally (schema, selection, permissions) and shown with their arguments;
  **nothing runs until you click Approve**; each step is verified; *Roll back* / *Save as tool* afterwards.
- Both can come back together.

The system prompt is deterministic (sorted tool catalog — prompt caching works); the request, conversation, comp
format and compact AE context travel in the user message as data. Budget gate, key storage and model settings are
the existing ones (`core/ai/client.js`, `cost.js`).

## Without a key, or offline
The assistant still helps: your words are turned into tool keywords (`workflow.keywordsOf` — Egyptian / Arabic
phrases like *ورا بعض*, *دايرة*, *زجاج*, *كلمة كلمة* map to stagger, ring, glass, typewriter; short words are matched
as whole words so *عايز* is not *ايز*), then:
- the matching **Power tool** card is explained (what, steps, open);
- the best matching tools and presets (the Ctrl+K search, scored by how many of your words they match) are one
  click away — presets apply, tools open;
- a button to add a Claude key in Settings.

## Safety
- AI output is untrusted: only registered tools, re-validated arguments, approval required (permissions hard rule).
- No scripts are generated or executed. The key never leaves the secret store and is never in the request body.
- History is kept in memory for the session only; it is not written to disk.

## Honest limits
- Answers about After Effects come from Claude's knowledge; the prompt tells it to say when it is not sure, but it
  can still be wrong — the plan part is what MOE checks.
- Tested with a canned demo reply in the preview and fake HTTP in tests, not against the live API in AE.
