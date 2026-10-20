/* Minimal synchronous CommonJS loader for the browser preview (dev only). */
(function () {
  var cache = {};
  function dirname(p) { return p.slice(0, p.lastIndexOf('/')); }
  function normalize(p) {
    var out = [];
    p.split('/').forEach(function (seg) { if (seg === '..') out.pop(); else if (seg !== '.' && seg !== '') out.push(seg); });
    return '/' + out.join('/');
  }
  function fetchText(url) {
    var x = new XMLHttpRequest();
    x.open('GET', url, false);
    x.send();
    if (x.status !== 200) throw new Error('Cannot load ' + url);
    return x.responseText;
  }
  function load(abs) {
    if (/\.json$/.test(abs)) {
      if (!cache[abs]) cache[abs] = { exports: JSON.parse(fetchText(abs)) };
      return cache[abs].exports;
    }
    var file = /\.js$/.test(abs) ? abs : abs + '.js';
    var src;
    try { src = fetchText(file); } catch (e) { file = abs + '/index.js'; src = fetchText(file); }
    if (cache[file]) return cache[file].exports;
    var module = { exports: {} };
    cache[file] = module;
    var fn = new Function('module', 'exports', 'require', src + '\n//# sourceURL=' + file);
    fn(module, module.exports, makeRequire(dirname(file)));
    return module.exports;
  }
  function makeRequire(base) {
    return function (id) {
      if (id.charAt(0) !== '.' && id.charAt(0) !== '/') throw new Error('Preview has no Node built-in "' + id + '"');
      return load(id.charAt(0) === '/' ? normalize(id) : normalize(base + '/' + id));
    };
  }
  window.require = makeRequire('/');
  window.__fetchText = fetchText;
}());
