'use strict';
/** Built-in expression presets. Users can save their own from the editor. */
module.exports = [
  {
    id: 'wiggle', label: 'Wiggle',
    code: '// Wiggle: frequency (per second), amplitude (property units)\nwiggle(2, 20)'
  },
  {
    id: 'loop', label: 'Loop cycle',
    code: 'loopOut("cycle")'
  },
  {
    id: 'pingpong', label: 'Ping-pong',
    code: 'loopOut("pingpong")'
  },
  {
    id: 'inertia', label: 'Inertial bounce',
    code: [
      '// Overshoot after the last keyframe passed. Works on any numeric/array property.',
      'var amp = 0.06, freq = 2.5, decay = 6;',
      'var n = 0;',
      'if (numKeys > 0) { n = nearestKey(time).index; if (key(n).time > time) n--; }',
      'if (n > 0 && n <= numKeys) {',
      '  var t = time - key(n).time;',
      '  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);',
      '  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);',
      '} else {',
      '  value;',
      '}'
    ].join('\n')
  },
  {
    id: 'timeRot', label: 'Spin',
    code: '// Degrees per second\ntime * 90'
  },
  {
    id: 'linkSlider', label: 'Slider link',
    code: '// Requires a Slider Control named "Amount" on this layer\neffect("Amount")("Slider")'
  }
];
