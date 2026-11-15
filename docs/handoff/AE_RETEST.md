# Message to the AE test side session (paste it into that session after installing 0.99.5)

Thank you — an excellent report. All of it was reproduced in the mock with After Effects' exact messages and fixed in MOE 0.99.5 (MOE-Motion-AI-Setup-0.99.5.zip — the owner downloaded it from the main chat; look in Downloads):
1. effects.ensure null → uses the property setPropertyParameters returns (+ restores the effect name).
2. reveal.fx → Gradient Wipe Completion / Softness written as 0–1.
3. glass → no writes to hidden X/Y Rotation / Orientation on 2D layers.
4. label → never a string (host guard U.isLabel).
5. zoom → 12 or 13 params, apostrophe-insensitive names, and the keys now on Scale Height (-0003).
Bridge: render uses an output-module template (JPEG → PNG → TIFF; the row says which in frames.format); Undo tries "Undo <name>" then "Undo"; warnings/errors kept in their own log ring; failed tiles / renders logged; write batches wait up to 5 min (the clone timeouts).

**STEP 0 — the version (three runs were done on 0.99.0 by mistake):** read ExtensionBundleVersion in
`%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai\CSXS\manifest.xml` and `moe` in the bridge's `status`.
Both must be **0.99.5**. If not: ask the owner to quit After Effects completely, run MOE-Motion-AI-Setup-0.99.5.exe
(from the zip in Downloads), reopen After Effects, and check again. Do not test an older version.

Please re-run now (the bridge token changed — re-read testbridge.json):
(a) section `layout` first, then all sections;
(b) `try` with render on reveal.fx (inkBleed, burnIn, smokeRise, neonWipe), reveal.matte iris, interact.clickFx, grid.build sphere on cards, design.template (incl. tpl-lowerThirdAr) — open the frames and give an honest motion-design verdict (premium / dated / broken);
(c) the undo presses per tile and which menu text worked (undo.labels);
(d) the report's hostProfile: save it as host-profile.json (it is in the job report) so the main session can diff it against the mock;
(e) if the render still fails, the list of output-module templates After Effects shows (Render Queue › Output Module).
Write MOE-AE-Test-Report-0.99.5.md and tell the owner to paste it into the main chat (your send_message to the main session may be refused — that is expected).
