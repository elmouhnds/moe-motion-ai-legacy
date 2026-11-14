#!/usr/bin/env python3
"""
v0.98 Bundled previews, step 2 of 2 (docs/features/RENDERED_PREVIEWS.md).

Reads the per-frame values tools/preview-frames.js took from MOE's own plans and renders every tile as pixels with numpy
+ PIL: the card a tool works on, over a dark stage, through the SAME numbers After Effects gets — mattes (cells, the
Gradient Wipe rule over a ramp + fractal-noise map, the Difference edge band + glow), click stacks (ring / flash /
disc, turbulent wobble, mosaic, ball scatter, glow), moves (position, scale, rotation, opacity, blur) and Linear Wipe.

It is MOE's renderer, not After Effects: Fractal Noise, Glow and CC Ball Action are approximated (value-noise fBm, a
Gaussian bloom, a dot grid). The panel always prefers the user's own After Effects render (Diagnostics › Rendered
previews) when one exists for the tile.

    python3 tools/render-previews.py frames.json extension/assets/previews
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H, SS = 320, 180, 2               # output size, supersampling
RW, RH = W * SS, H * SS
COLS = 8
ACC = np.array([1.0, 0.416, 0.239])  # MOE accent

def lin(c): return np.array(c[:3], dtype=np.float32)

# ---------- the stage and the card ----------
def stage():
    y = np.linspace(0, 1, RH, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, RW, dtype=np.float32)[None, :]
    top, bot = np.array([0.067, 0.075, 0.098]), np.array([0.035, 0.039, 0.051])
    img = top * (1 - y[..., None]) + bot * y[..., None] + 0 * x[..., None]
    glow = np.exp(-(((x - 0.5) / 0.45) ** 2 + ((y - 0.45) / 0.5) ** 2))[..., None] * np.array([0.06, 0.05, 0.08])
    return np.clip(img + glow, 0, 1).astype(np.float32)

def card_image(cw, ch):
    """The card a tool works on (RGBA float), drawn at render scale."""
    w, h = int(cw * SS), int(ch * SS)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    r = int(14 * SS)
    # vertical accent gradient body
    grad = Image.new('RGBA', (w, h))
    gp = np.zeros((h, w, 4), dtype=np.uint8)
    t = np.linspace(0, 1, h)[:, None]
    c0, c1 = np.array([255, 120, 74]), np.array([236, 76, 52])
    gp[..., :3] = (c0 * (1 - t[..., None]) + c1 * t[..., None]).astype(np.uint8)
    gp[..., 3] = 255
    grad = Image.fromarray(gp, 'RGBA')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    im.paste(grad, (0, 0), mask)
    # content on its own layer, composited (drawing straight onto the card would REPLACE its colour with the
    # half-transparent white and punch see-through holes)
    fg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(fg)
    d.ellipse([int(14 * SS), int(14 * SS), int(34 * SS), int(34 * SS)], fill=(255, 255, 255, 235))
    d.rounded_rectangle([int(42 * SS), int(16 * SS), int(118 * SS), int(25 * SS)], radius=int(4 * SS), fill=(255, 255, 255, 240))
    d.rounded_rectangle([int(42 * SS), int(28 * SS), int(92 * SS), int(33 * SS)], radius=int(3 * SS), fill=(255, 255, 255, 150))
    d.rounded_rectangle([int(14 * SS), int(50 * SS), int((cw - 14) * SS), int(58 * SS)], radius=int(4 * SS), fill=(255, 255, 255, 120))
    d.rounded_rectangle([int(14 * SS), int(64 * SS), int((cw - 46) * SS), int(72 * SS)], radius=int(4 * SS), fill=(255, 255, 255, 90))
    d.rounded_rectangle([int((cw - 50) * SS), int((ch - 22) * SS), int((cw - 12) * SS), int((ch - 10) * SS)], radius=int(6 * SS), fill=(20, 22, 30, 220))
    im = Image.alpha_composite(im, fg)
    # the card's own clean edge
    im.putalpha(Image.fromarray(np.minimum(np.asarray(im)[..., 3], np.asarray(mask)), 'L'))
    return np.asarray(im).astype(np.float32) / 255.0

def over(base, rgba, x0, y0):
    """Alpha-composite an RGBA float image onto the RGB stage at (x0, y0) (render pixels), clipped."""
    h, w = rgba.shape[:2]
    X0, Y0 = max(0, x0), max(0, y0)
    X1, Y1 = min(RW, x0 + w), min(RH, y0 + h)
    if X1 <= X0 or Y1 <= Y0: return base
    src = rgba[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    a = src[..., 3:4]
    base[Y0:Y1, X0:X1] = base[Y0:Y1, X0:X1] * (1 - a) + src[..., :3] * a
    return base

def shadow_under(base, x0, y0, w, h, alpha):
    m = Image.new('L', (RW, RH), 0)
    ImageDraw.Draw(m).rounded_rectangle([x0 + 6 * SS, y0 + 12 * SS, x0 + w - 6 * SS, y0 + h + 10 * SS], radius=int(16 * SS), fill=int(150 * alpha))
    m = np.asarray(m.filter(ImageFilter.GaussianBlur(14 * SS))).astype(np.float32)[..., None] / 255.0
    return base * (1 - m * 0.85)

def blur(arr, radius):
    """Gaussian blur of a float array (H, W) or (H, W, C) through PIL, per channel."""
    if radius <= 0.3: return arr
    if arr.ndim == 2:
        im = Image.fromarray(np.clip(arr * 255, 0, 255).astype(np.uint8), 'L')
        return np.asarray(im.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255.0
    return np.stack([blur(arr[..., k], radius) for k in range(arr.shape[2])], axis=-1)

# ---------- value-noise fBm (an approximation of Fractal Noise) ----------
def _hash(ix, iy, iz, seed):
    v = np.sin(ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 19.19) * 43758.5453
    return v - np.floor(v)

def vnoise(x, y, z, seed, block=False):
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    if block:
        a = _hash(ix, iy, iz, seed); b = _hash(ix, iy, iz + 1, seed)
        return a * (1 - fz) + b * fz
    sx, sy, sz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    def layer(zz):
        n00 = _hash(ix, iy, zz, seed); n10 = _hash(ix + 1, iy, zz, seed)
        n01 = _hash(ix, iy + 1, zz, seed); n11 = _hash(ix + 1, iy + 1, zz, seed)
        return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy
    return layer(iz) * (1 - sz) + layer(iz + 1) * sz

def fbm(X, Y, scale_x, scale_y, complexity, evo_deg, seed, block=False):
    """Fractal Noise's idea: octaves at Sub Scaling 56 % with Sub Influence 70 %; Evolution moves through the third axis."""
    z = evo_deg / 360.0 * 2.0
    total, amp, norm = 0.0, 1.0, 0.0
    fx, fy = 1.0 / max(1e-3, scale_x), 1.0 / max(1e-3, scale_y)
    for o in range(max(1, min(6, int(round(complexity))))):
        total = total + amp * vnoise(X * fx, Y * fy, z + o * 3.1, seed + o, block)
        norm += amp; amp *= 0.7; fx /= 0.56; fy /= 0.56
    return total / norm

# ---------- kinds ----------
def frame_matte(job, fr, base, card, cx0, cy0):
    cw, ch = job['card']
    h, w = card.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    X, Y = (xs + 0.5) / SS, (ys + 0.5) / SS
    m = np.zeros((h, w), dtype=bool)
    for c, v in zip(job['cells'], fr['v']):
        s = v['scale'] or [100, 100]
        sx, sy = s[0] / 100.0, s[1] / 100.0
        if abs(sx) < 1e-6 or abs(sy) < 1e-6: continue
        P = v['position'] or c['position']
        a = -math.radians(c.get('rotation') or 0)
        dx, dy = X - P[0], Y - P[1]
        lx = (dx * math.cos(a) - dy * math.sin(a)) / sx + c['anchor'][0]
        ly = (dx * math.sin(a) + dy * math.cos(a)) / sy + c['anchor'][1]
        hw, hh = c['size'][0] / 2, c['size'][1] / 2
        if c['kind'] == 'ellipse':
            m |= (lx * lx) / (hw * hw) + (ly * ly) / (hh * hh) <= 1
        else:
            r = min(max(0, v['roundness'] if v.get('roundness') is not None else c['roundness']), hw, hh)
            inside = (np.abs(lx) <= hw) & (np.abs(ly) <= hh)
            if r > 0:
                qx, qy = np.maximum(np.abs(lx) - (hw - r), 0), np.maximum(np.abs(ly) - (hh - r), 0)
                inside &= qx * qx + qy * qy <= r * r
            m |= inside
    out = card.copy(); out[..., 3] *= m.astype(np.float32)
    return over(base, out, cx0, cy0)

def fx_alpha(job, X, Y, comp, evo):
    p = job['spec']; m = p['margin']; k = job['card'][0] / 600.0
    px, py = X + m, Y + m  # layer → pre-comp pixels (the plan's box starts at 0, 0)
    d = p.get('displace')
    if d:
        sz = max(4.0, d['size'] * k)
        wx = (fbm(px, py, sz, sz, 2, evo, 11) - 0.5) * 2 * d['amount'] * k
        wy = (fbm(px, py, sz, sz, 2, evo, 23) - 0.5) * 2 * d['amount'] * k
        px, py = px + wx, py + wy
    r = p['ramp']
    sx, sy = np.array(r['start']), np.array(r['end'])
    if r['shape'] == 'radial':
        R = max(1e-3, np.hypot(*(sy - sx)))
        base = 1 - np.clip(np.hypot(px - sx[0], py - sx[1]) / R, 0, 1)
    else:
        v = sy - sx; L2 = max(1e-6, float(v @ v))
        t = np.clip(((px - sx[0]) * v[0] + (py - sx[1]) * v[1]) / L2, 0, 1)
        c0, c1 = r['startColor'][0], r['endColor'][0]
        base = c0 * (1 - t) + c1 * t
    n = p['noise']
    st = n.get('stretch')
    scx = (st[0] if st else n['scale']) * k; scy = (st[1] if st else n['scale']) * k
    nz = fbm(px, py, max(2.0, scx), max(2.0, scy), n['complexity'], evo, n.get('seed', 0) + 1, block=n.get('type') == 1)
    nz = np.clip((nz - 0.5) * n['contrast'] / 100.0 + 0.5 + (n.get('brightness') or 0) / 100.0, 0, 1)
    mix = n['mix'] / 100.0
    if n['blend'] == 'overlay':
        ov = np.where(base < 0.5, 2 * base * nz, 1 - 2 * (1 - base) * (1 - nz))
    else:
        ov = nz
    mp = base + (ov - base) * mix
    s = max(1e-3, p['soft'] / 100.0)
    c = comp / 100.0
    return np.clip((mp - c * (1 + s) + s) / s, 0, 1)

def frame_fx(job, fr, base, card, cx0, cy0):
    p = job['spec']
    h, w = card.shape[:2]
    pad = int(30 * SS)
    ys, xs = np.mgrid[-pad:h + pad, -pad:w + pad].astype(np.float32)
    X, Y = (xs + 0.5) / SS, (ys + 0.5) / SS
    A = fx_alpha(job, X, Y, fr['c'], fr['e'])
    ca = np.zeros_like(A); ca[pad:pad + h, pad:pad + w] = card[..., 3]
    out = card.copy(); out[..., 3] *= A[pad:pad + h, pad:pad + w]
    base = over(base, out, cx0, cy0)
    if p.get('edge') and fr.get('cl') is not None:
        band = np.abs(A - fx_alpha(job, X, Y, fr['cl'], fr['e'])) * ca
        col = lin(p['edge']['color'])
        k = job['card'][0] / 600.0
        g = blur(band, max(1.0, p['edge']['glow'] * k * SS * 0.6)) * p['edge']['intensity']
        light = (band[..., None] * 0.9 + g[..., None]) * col
        Y0, X0 = cy0 - pad, cx0 - pad
        y0, x0 = max(0, Y0), max(0, X0)
        y1, x1 = min(RH, Y0 + light.shape[0]), min(RW, X0 + light.shape[1])
        base[y0:y1, x0:x1] = np.clip(base[y0:y1, x0:x1] + light[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0], 0, 1)
    return base

def frame_click(job, fr, base, card, cx0, cy0):
    base = over(base, card, cx0, cy0)
    cxs, cys = RW / 2.0, RH / 2.0
    ys, xs = np.mgrid[0:RH, 0:RW].astype(np.float32)
    k = 1.0
    for L, v in zip(job['layers'], fr['L']):
        s = (v['s'] or [0, 0])[0] / 100.0
        if s <= 0.001 or v['o'] <= 0.5: continue
        fxs = {e['matchName']: e for e in L['effects']}
        col = lin(fxs['ADBE Fill']['params'][0]['value']) if 'ADBE Fill' in fxs else np.ones(3)
        X, Y = xs, ys
        if 'ADBE Turbulent Displace' in fxs:
            amt = 4 * SS
            X = xs + (fbm(xs, ys, 10 * SS, 10 * SS, 2, fr['t'] * 400, 3) - 0.5) * 2 * amt
            Y = ys + (fbm(xs, ys, 10 * SS, 10 * SS, 2, fr['t'] * 400, 7) - 0.5) * 2 * amt
        R = L['primitive']['size'][0] / 2 * s * SS
        d = np.hypot(X - cxs, Y - cys)
        if L['stroke']:
            wdt = max(0.6, (v['w'] or L['stroke']['width']) * s * SS * 0.6)
            m = np.clip(1 - np.abs(d - R) / (wdt / 2 + 0.6), 0, 1)
        else:
            m = np.clip(R - d + 0.8, 0, 1)
        if 'CC Ball Action' in fxs:
            g = 4 * SS
            gx, gy = np.floor(xs / g), np.floor(ys / g)
            ccx, ccy = (gx + 0.5) * g, (gy + 0.5) * g
            inside = np.clip(R - np.hypot(ccx - cxs, ccy - cys), 0, 1)
            sc = (v['sc'] or 0) / 160.0 * 60 * SS
            rnd = _hash(gx, gy, 0, 5)
            ang = np.arctan2(ccy - cys, ccx - cxs)
            ox, oy = ccx + np.cos(ang) * sc * (0.4 + rnd), ccy + np.sin(ang) * sc * (0.4 + rnd)
            # each dot is drawn where its cell scattered to: a gather by inverse lookup is too costly — draw the dots
            m = np.zeros_like(m)
            img = Image.new('L', (RW, RH), 0); dr = ImageDraw.Draw(img)
            sel = inside > 0.5
            rr = g * 0.42
            for a, b in zip(ox[sel][::1], oy[sel][::1]):
                dr.ellipse([a - rr, b - rr, a + rr, b + rr], fill=255)
            m = np.asarray(img).astype(np.float32) / 255.0
        if 'ADBE Mosaic' in fxs:
            bw = max(2, int(RW / fxs['ADBE Mosaic']['params'][0]['value']))
            small = Image.fromarray((m * 255).astype(np.uint8), 'L').resize((max(1, RW // bw), max(1, RH // bw)), Image.BILINEAR)
            m = np.asarray(small.resize((RW, RH), Image.NEAREST)).astype(np.float32) / 255.0
        if 'ADBE Gaussian Blur 2' in fxs:
            m = blur(m, fxs['ADBE Gaussian Blur 2']['params'][0]['value'] * 0.25 * SS)
        a = m * (v['o'] / 100.0)
        base = base * (1 - a[..., None]) + col * a[..., None]
        if 'ADBE Glo2' in fxs:
            gp = {q['id']: q['value'] for q in fxs['ADBE Glo2']['params']}
            g = blur(a, gp.get('Glow Radius', 20) * 0.5 * SS) * gp.get('Glow Intensity', 1) * 0.8
            base = np.clip(base + g[..., None] * col, 0, 1)
    return base

def frame_anim(job, fr, base, card_img, cw, ch):
    v, prop = fr['v'], job['prop']
    dx = dy = 0.0; sc = 1.0; rot = 0.0
    if prop == 'position':
        dx = v[0] * job['dir'][0] * W * 0.55 * SS if job['dir'][0] else v[0] * W * 0.55 * SS
        dy = v[1] * job['dir'][1] * H * 0.6 * SS if job['dir'][1] else v[1] * H * 0.6 * SS
        if not job['dir'][0]: dx = 0.0
        if not job['dir'][1]: dy = 0.0
    elif prop == 'scale': sc = max(0.0, v[0] / 100.0)
    elif prop == 'rotation': rot = v
    op = (fr['o'] if fr['o'] is not None else 100) / 100.0
    if sc <= 0.001 or op <= 0.001: return base
    im = Image.fromarray((card_img * 255).astype(np.uint8), 'RGBA')
    if sc != 1.0: im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    if rot: im = im.rotate(-rot, resample=Image.BICUBIC, expand=True)
    if fr.get('b'): im = im.filter(ImageFilter.GaussianBlur(fr['b'] * SS * W / 1920 * 2.2))
    arr = np.asarray(im).astype(np.float32) / 255.0
    arr[..., 3] *= op
    x0 = int(RW / 2 + dx - arr.shape[1] / 2); y0 = int(RH / 2 + dy - arr.shape[0] / 2)
    return over(base, arr, x0, y0)

def frame_wipe(job, fr, base, card, cx0, cy0):
    h, w = card.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    a = math.radians(job['angle'] - 90)
    d = np.array([math.cos(a), math.sin(a)])
    proj = (xs - w / 2) * d[0] + (ys - h / 2) * d[1]
    span = abs(d[0]) * w + abs(d[1]) * h
    f = max(1.0, job['feather'] * SS)
    edge = -span / 2 + (fr['c'] / 100.0) * (span + f)
    keep = np.clip((proj - edge) / f + 0.5, 0, 1)
    out = card.copy(); out[..., 3] *= keep
    return over(base, out, cx0, cy0)

def render(job):
    cw, ch = job['card']
    card = card_image(cw, ch)
    cx0, cy0 = int(RW / 2 - card.shape[1] / 2), int(RH / 2 - card.shape[0] / 2)
    st = stage()
    frames = []
    for fr in job['frames']:
        base = st.copy()
        kind = job['kind']
        # a shadow only under a card that is already there (a reveal's shadow would show before the card does)
        if kind == 'click': base = shadow_under(base, cx0, cy0, card.shape[1], card.shape[0], 0.5)
        if kind == 'matte': base = frame_matte(job, fr, base, card, cx0, cy0)
        elif kind == 'fx': base = frame_fx(job, fr, base, card, cx0, cy0)
        elif kind == 'click': base = frame_click(job, fr, base, card, cx0, cy0)
        elif kind == 'anim': base = frame_anim(job, fr, base, card, cw, ch)
        elif kind == 'wipe': base = frame_wipe(job, fr, base, card, cx0, cy0)
        img = Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8), 'RGB').resize((W, H), Image.LANCZOS)
        frames.append(img)
    return frames

def main():
    src, outdir = sys.argv[1], sys.argv[2]
    only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
    os.makedirs(outdir, exist_ok=True)
    jobs = json.load(open(src))
    idx_path = os.path.join(outdir, 'index.json')
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    for j in jobs:
        if only and j['key'] not in only: continue
        if not only and index.get(j['key'], {}).get('sig') == j['sig'] and os.path.exists(os.path.join(outdir, j['key'] + '.webp')): continue
        fr = render(j)
        n = len(fr); rows = math.ceil(n / COLS)
        sheet = Image.new('RGB', (W * COLS, H * rows))
        for i, im in enumerate(fr): sheet.paste(im, ((i % COLS) * W, (i // COLS) * H))
        sheet.save(os.path.join(outdir, j['key'] + '.webp'), 'WEBP', quality=70, method=6)
        index[j['key']] = {'sig': j['sig'], 'frames': n, 'cols': COLS, 'w': W, 'h': H, 'fps': j['fps'], 'dir': j['dir'], 'file': j['key'] + '.webp', 'by': 'MOE renderer'}
        print(j['key'], n, 'frames', flush=True)
    json.dump(index, open(idx_path, 'w'), indent=0, sort_keys=True)

if __name__ == '__main__':
    main()
