# Target and Audio Effectors (v0.36.0)

Two new **Effector Type** entries on every `MOE Effector N` null (menu items 6 and 7; items 1–5 are unchanged). Both run through the same engine as the other types. Falloff, Strength, Invert, Spring / Inertia and the colour tint all apply to them.

## Target: the clones face the effector
- Each item turns the short way toward the effector null. Its **+X axis** points at the null.
- **Rotate** becomes the aim offset. Use 90° for artwork that points up, 180° for artwork that points left.
- The falloff controls who turns, and how far:
  - Everywhere: every item turns all the way.
  - Sphere with a soft edge: only nearby items turn, partly at the edge.
- With Spring on, the items swing past the aim and settle.
- Move X / Y, Scale and Fade still apply, the same as Plain.
- The maths:
  - rotate = w × wrap₋₁₈₀..₁₈₀(atan2(effector − item) + Rotate − (the item's rotation before effectors + the grid null's rotation));
  - the item's point and the effector's point are read at the same time, so the spring follows a moving target.
- Tiles: **Aim** (Everywhere, sweeps across) and **Look Near** (sphere, scale +20, spring).

## Audio: the clones follow the soundtrack
- MOE runs After Effects' own *Animation › Keyframe Assistant › Convert Audio to Keyframes* on the first layer with sound in the comp that is not part of the grid. It goes through `app.findMenuCommandId` + `app.executeCommand` (Application object, AE Scripting Guide).
- AE adds an *Audio Amplitude* null with *Left Channel / Right Channel / Both Channels* sliders. MOE then:
  - renames it **`MOE Audio · <layer>`**;
  - moves it to the bottom of the layer stack;
  - reuses it for the next Audio effector on the same sound.
- The effector links it in its **Audio Layer** control and stores the loudest frame in **Audio Max**.
- Every move is scaled by Both Channels / Audio Max (0–1), read at time − k × **Delay** frames. Delay 0 makes the whole grid pulse together; Delay 3 makes the beat travel through it.
- Tiles: **Beat Pulse** (scale +60, all together) and **Beat Wave** (up 60 px + scale +20, 3 frames apart).
- No sound in the comp → refused before anything is made: "Add a layer with sound (music or a voice-over) to the comp…".
- If the menu command can't be found (for example, a different AE language), the error says to run Convert Audio to Keyframes by hand and try again. An existing `MOE Audio · <layer>` is then reused.
- Restore removes the effector, and the amplitude layer only when this run created it. The sound layer itself is never touched.

## Reference
`features/grid/effectors.js`:
- `termsAt` handles types 6 and 7: `src.originAt(t)` and `src.audioAt(t)`, `item.baseRotAt(t)`, and `wrap180`.
- `code()` mirrors them inside `TQ(tq)`.
- Effectors made before v0.36 have no Audio controls. Their menu has 5 items, so they never reach these branches.

## Tests
`tests/target.audio.test.js` (5):
- Target · Everywhere: mock rotation = reference at 4 times, and every item's +X axis points at the effector.
- Target · Sphere with Spring: equals the reference, out of reach = unchanged, swings after the stop, settles.
- Audio:
  - one `MOE Audio · Music` at the bottom, linked, Audio Max = the loudest frame;
  - scale = reference at 4 times; the first item is biggest on the beat while the last plays it later;
  - a second Audio effector reuses the layer; restore order is safe.
- No sound → refused, nothing left behind.
- Tiles.

The mock implements Convert Audio to Keyframes from a fixture amplitude. **In After Effects these are unverified:**
- the real command's name and behaviour;
- where AE puts the new layer (MOE finds it as the one new layer, whatever its index);
- the speed on long soundtracks.
