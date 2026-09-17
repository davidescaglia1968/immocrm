#!/usr/bin/env python3
"""Genera le icone PWA di ImmoCRM (nessuna dipendenza esterna).

Disegna un palazzo stilizzato dorato su fondo scuro e scrive PNG validi
usando solo zlib + struct della libreria standard.
Uso:  python3 tools/make_icons.py
"""
import math
import os
import struct
import zlib

QUI = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(QUI, '..', 'icons')

BG_TOP = (26, 29, 39)      # --bg3
BG_BOT = (10, 12, 20)
GOLD = (201, 169, 110)     # --gold
GOLD_HI = (232, 200, 122)  # --gold2
WIN = (15, 17, 23)         # --bg


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def rounded_rect_sdf(x, y, cx, cy, hw, hh, r):
    """Distanza (negativa = dentro) da un rettangolo arrotondato."""
    dx = abs(x - cx) - (hw - r)
    dy = abs(y - cy) - (hh - r)
    ax, ay = max(dx, 0.0), max(dy, 0.0)
    outside = math.hypot(ax, ay)
    inside = min(max(dx, dy), 0.0)
    return outside + inside - r


def point_in_triangle(px, py, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1 = sign((px, py), a, b)
    d2 = sign((px, py), b, c)
    d3 = sign((px, py), c, a)
    neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (neg and pos)


def render(size, supersample=2, maskable=False):
    S = size * supersample
    buf = bytearray()
    r_corner = S * 2.0 if maskable else S * 0.215
    pad = 0.78 if maskable else 1.0   # la maschera Android vuole il disegno al centro
    for y in range(S):
        py = y / S
        ny = 0.5 + (py - 0.5) / pad
        base = lerp(BG_TOP, BG_BOT, py)
        for x in range(S):
            px_ = x / S
            nx = 0.5 + (px_ - 0.5) / pad
            # maschera arrotondata; le icone "maskable" riempiono tutto il quadro
            d = -1.0 if maskable else rounded_rect_sdf(x + 0.5, y + 0.5, S / 2, S / 2, S / 2, S / 2, r_corner)
            if d > 0.5:
                buf += bytes((0, 0, 0, 0))
                continue
            alpha = 1.0 if d < -0.5 else (0.5 - d)
            col = base

            # alone caldo centrale
            glow = max(0.0, 1.0 - math.hypot(nx - 0.5, ny - 0.62) * 2.4)
            col = lerp(col, (48, 42, 32), glow * 0.55)

            # tetto
            roof = [(0.5, 0.215), (0.185, 0.475), (0.815, 0.475)]
            if point_in_triangle(nx, ny, *roof):
                t = (0.475 - ny) / 0.26
                col = lerp(GOLD, GOLD_HI, max(0.0, min(1.0, t)))
            # corpo del palazzo
            elif 0.265 <= nx <= 0.735 and 0.475 <= ny <= 0.80:
                bordo = (0.265 <= nx <= 0.295) or (0.705 <= nx <= 0.735) or (0.77 <= ny <= 0.80)
                if bordo:
                    col = lerp(GOLD, GOLD_HI, (nx - 0.265) / 0.47)
                else:
                    # finestre 3x3
                    fx = (nx - 0.315) % 0.135
                    fy = (ny - 0.52) % 0.105
                    in_win = (0.315 <= nx <= 0.685) and (0.52 <= ny <= 0.735) and fx < 0.085 and fy < 0.062
                    col = lerp(GOLD, (90, 76, 52), 0.35) if in_win else lerp((30, 34, 48), (20, 23, 33), ny)
            # base / gradino
            elif 0.20 <= nx <= 0.80 and 0.80 <= ny <= 0.845:
                col = lerp(GOLD, (140, 116, 74), (nx - 0.2) / 0.6)

            buf += bytes((col[0], col[1], col[2], int(alpha * 255)))

    # downsample box-filter
    out = bytearray()
    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for dy in range(supersample):
                row = ((y * supersample + dy) * S + x * supersample) * 4
                for dx in range(supersample):
                    i = row + dx * 4
                    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3]
            n = supersample * supersample
            out += bytes((r // n, g // n, b // n, a // n))
    return bytes(out), size


def write_png(path, rgba, size):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filtro "none"
        raw += rgba[y * stride:(y + 1) * stride]
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    return len(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
        ss = 2 if size >= 192 else 2
        rgba, sz = render(size, ss)
        n = write_png(os.path.join(OUT, name), rgba, sz)
        print('scritta icons/%s (%dx%d, %d byte)' % (name, sz, sz, n))
    # maschera per Android: grafica più piccola, fondo a pieno quadro
    rgba, sz = render(512, 2, maskable=True)
    write_png(os.path.join(OUT, 'maskable-512.png'), rgba, sz)
    print('scritta icons/maskable-512.png (512x512)')


if __name__ == '__main__':
    main()
