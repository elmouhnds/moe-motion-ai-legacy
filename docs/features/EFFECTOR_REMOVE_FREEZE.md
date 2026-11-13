# Remove Effector, Freeze Effector (v0.90)

React 3 study, item 5 of 8: its *Smart Delete* removes one effector "without disturbing the others" with three outcomes
— no baking, bake the current frame, bake the animation. In MOE these are three honest verbs:

| React 3 | MOE | What happens |
|---|---|---|
| Delete without Baking | **Remove Effector** | The null is unlinked from its grid slot and deleted. The grid, its items and the other effectors are not touched; the items go back to where the grid and the remaining effectors put them. |
| Bake At Current Frame | **Freeze Effector** | Every keyframe on the null (Position, Scale, Rotation) and on its controls is removed; the value at the playhead stays. The effector stays linked and editable. |
| Bake Animation | **Bake** (v0.42, already there) | The items' expressions become keyframes. Not repeated in a second tool. |

Both act on the selected **MOE Effector N** null(s) — never on the grid (a grid can have three).

## Recovery
- Remove: After Effects' own Undo (`recovery: 'undo'`). A deleted null with its keys is not rebuilt by a checkpoint — the
  card says so before you click.
- Freeze: checkpoint + Restore — every key comes back exactly (`keys.snapshot` → `keys.rebuild`).

## Tests (`tests/effector.remove.test.js`, 3) — mock only
Two effectors on one grid, remove the first: the items equal a grid that only ever had the second (every channel); the grid
selected instead of an effector is refused; removing the last one puts the items at rest. Freeze: a sweeping Delay effector
with 3 keyed properties → 0 keys, the values of that frame hold, still linked; Restore brings 2 + 2 + 2 keys back and the
motion is the same. Nothing keyed → success, nothing written.

## A mock fix this needed
After Effects' Layer Control follows its layer when layers are added, removed or reordered. The mock kept the raw index, so
adding a second effector (a new layer on top) silently re-pointed the first slot at it. `tests/mock/ae-mock.js` now keeps the
layer, like AE. All 594 tests pass with it; nothing in the product code changed for this.

## Honest limits
- Not run in After Effects.
- Freeze of a **Delay** effector: the items still read the effector's own past, so they settle Delay × items frames after the freeze.
- Freeze leaves expressions on the null alone (only keyframes are removed).
- Remove does not delete a `MOE Audio · …` layer the effector used (another effector may read it).
