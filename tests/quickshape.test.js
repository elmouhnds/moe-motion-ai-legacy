'use strict';
/**
 * v1.0.2 MOE Quick, the window's shape (core/platform/shapeWin.js).
 *
 * The owner: nothing around the tools. The frame comes off in hotkeyWin.js, but the window's own rectangle only
 * goes away if the window is given a SHAPE — the colour key does nothing in After Effects (measured, see that
 * file). The page sends the boxes it really drew; this is the guard on what crosses over, because a window clipped
 * to the wrong thing is a window nobody can find again.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const shape = require('../extension/core/platform/shapeWin');

const fakeSpawn = (seen, born = []) => () => {
  const child = {
    stdin: { write: (s) => seen.push(String(s).trim()), end: () => seen.push('<end>') },
    stdout: { on: () => {} },
    stderr: { on: () => {} },
    on: (ev, f) => { if (ev === 'exit') child.die = f; },
    kill: () => seen.push('<kill>')
  };
  born.push(child);
  return child;
};

test('the PowerShell is fixed text: it clips the one window by name, and nothing is built from data', () => {
  const s = shape.script();
  assert.match(s, /FindWindow\(null, "MOE Quick"\)/);
  assert.match(s, /SetWindowRgn/);
  assert.match(s, /CreateRoundRectRgn/);
  assert.match(s, /CombineRgn\(all, all, p, 2\)/);      // RGN_OR
  assert.match(s, /SetWindowRgn\(w, IntPtr\.Zero, true\)/); // "all" gives the rectangle back
  // the script never changes with the shape: only numbers travel, down the pipe
  assert.equal(shape.script(), s);
  assert.ok(!/\$\{/.test(s), 'nothing interpolated into the script');
});

test('only whole, sane pixels cross over', () => {
  assert.equal(shape.spec([{ x: 10.4, y: 20.6, w: 64, h: 52, r: 8 }]), '10,21,64,52,8');
  assert.equal(shape.spec([{ x: 0, y: 0, w: 0, h: 10, r: 0 }]), '', 'no width');
  assert.equal(shape.spec([{ x: 0, y: 0, w: 10, h: 10, r: -1 }]), '', 'no negative corner');
  assert.equal(shape.spec([{ x: NaN, y: 0, w: 10, h: 10, r: 0 }]), '', 'not a number');
  assert.equal(shape.spec([{ x: 0, y: 0, w: shape.MAX_PX + 1, h: 10, r: 0 }]), '', 'too big');
  assert.equal(shape.spec('10,10,10,10,0'), '', 'a string is not a shape');
  assert.equal(shape.spec(null), '');
  const many = Array.from({ length: shape.MAX_PARTS + 6 }, (_, i) => ({ x: i, y: i, w: 8, h: 8, r: 2 }));
  assert.equal(shape.spec(many).split(';').length, shape.MAX_PARTS);
});

test('the shape is sent once, the rectangle can be asked back, and nothing is sent off Windows', () => {
  const seen = [];
  const h = shape.start({ spawn: fakeSpawn(seen), platform: 'win32' });
  const parts = [{ x: 1, y: 2, w: 64, h: 52, r: 8 }, { x: 70, y: 2, w: 64, h: 52, r: 8 }];
  h.set(parts);
  h.set(parts);                                   // the same drawing: nothing to say again
  h.set([{ x: 0, y: 0, w: 0, h: 0, r: 0 }]);      // nothing to draw is never sent
  h.clear();
  h.stop();
  assert.deepEqual(seen, ['1,2,64,52,8;70,2,64,52,8', 'all', '<end>', '<kill>']);

  const none = [];
  const offWin = shape.start({ spawn: fakeSpawn(none), platform: 'darwin' });
  offWin.set(parts); offWin.clear(); offWin.stop();
  assert.deepEqual(none, []);
  assert.deepEqual(shape.start({ platform: 'win32' }).set([]), undefined, 'no spawn, no helper');
});

test('a helper that dies comes back and puts the last shape on again', () => {
  // the window wears the last shape it was given: if the helper went for good while the pie was hidden,
  // the window would stay clipped to one pixel with nobody left to undo it
  const seen = [];
  const born = [];
  const h = shape.start({ spawn: fakeSpawn(seen, born), platform: 'win32' });
  h.set([{ x: 1, y: 2, w: 64, h: 52, r: 8 }]);
  born[0].die();
  assert.equal(born.length, 2, 'it came back');
  assert.deepEqual(seen, ['1,2,64,52,8', '1,2,64,52,8'], 'and the shape went on again');
  born[1].die(); born[2].die();
  assert.equal(born.length, 3, 'it does not come back for ever');
  const after = seen.length;
  h.stop();
  born[0].die();                       // an exit after stop() starts nothing
  assert.equal(born.length, 3);
  assert.ok(seen.length >= after);
});
