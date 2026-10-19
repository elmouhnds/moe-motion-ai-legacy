/*
 * MOE Motion AI — host JSON helpers (ExtendScript / ES3).
 * ExtendScript has no native JSON object, so we ship a small, strict one.
 * parse() validates the text with the json2.js structural regex before eval,
 * so only data (never code) can pass through.
 */
(function (G) {
    var MOE = G.MOE = G.MOE || {};

    function quote(s) {
        var out = '"', i, c, code, hex;
        for (i = 0; i < s.length; i++) {
            c = s.charAt(i);
            code = s.charCodeAt(i);
            if (c === '"') { out += '\\"'; }
            else if (c === '\\') { out += '\\\\'; }
            else if (c === '\n') { out += '\\n'; }
            else if (c === '\r') { out += '\\r'; }
            else if (c === '\t') { out += '\\t'; }
            else if (code < 0x20 || code === 0x2028 || code === 0x2029 || code > 0x7e) {
                hex = code.toString(16);
                while (hex.length < 4) { hex = '0' + hex; }
                out += '\\u' + hex;
            } else { out += c; }
        }
        return out + '"';
    }

    function stringify(v) {
        var t = typeof v, parts, k, i;
        if (v === null || v === undefined) { return 'null'; }
        if (t === 'number') { return isFinite(v) ? String(v) : 'null'; }
        if (t === 'boolean') { return v ? 'true' : 'false'; }
        if (t === 'string') { return quote(v); }
        if (t === 'function') { return 'null'; }
        if (Object.prototype.toString.call(v) === '[object Array]') {
            parts = [];
            for (i = 0; i < v.length; i++) { parts.push(stringify(v[i])); }
            return '[' + parts.join(',') + ']';
        }
        parts = [];
        for (k in v) {
            if (v.hasOwnProperty(k) && typeof v[k] !== 'function' && v[k] !== undefined) {
                parts.push(quote(k) + ':' + stringify(v[k]));
            }
        }
        return '{' + parts.join(',') + '}';
    }

    function parse(text) {
        var s = String(text);
        var check = s
            .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
            .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']')
            .replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        if (!/^[\],:{}\s]*$/.test(check)) {
            throw new Error('MOE.json.parse: invalid JSON');
        }
        return eval('(' + s + ')');
    }

    MOE.json = { stringify: stringify, parse: parse };
}($.global));
