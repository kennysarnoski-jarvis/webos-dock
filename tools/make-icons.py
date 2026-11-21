#!/usr/bin/env python3
"""Draws the app's icons (app/icon.png 80x80, app/largeIcon.png 130x130): a dark rounded square with a
glowing dock bar. Standard library only; rendered at 4x and box-filtered down."""
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def png(width, height, rows):
    def chunk(tag, body):
        return struct.pack('>I', len(body)) + tag + body + struct.pack('>I', zlib.crc32(tag + body) & 0xffffffff)
    raw = b''.join(b'\x00' + bytes(r) for r in rows)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def inside_round(x, y, x0, y0, x1, y1, r):
    if x < x0 or x >= x1 or y < y0 or y >= y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def render(size):
    ss = 4
    n = size * ss
    px = [[(0, 0, 0, 0)] * n for _ in range(n)]
    for y in range(n):
        t = y / n
        for x in range(n):
            if not inside_round(x + 0.5, y + 0.5, 0, 0, n, n, n * 0.22):
                continue
            # sky: navy to near-black
            r, g, b = int(28 + (10 - 28) * t), int(44 + (16 - 44) * t), int(84 + (34 - 84) * t)
            # a faint star field
            if (x * 7 + y * 13) % 97 == 0 and t < 0.6:
                r, g, b = 200, 210, 255
            # the dock: a translucent bar with three tiles
            if inside_round(x + 0.5, y + 0.5, n * 0.14, n * 0.60, n * 0.86, n * 0.84, n * 0.07):
                r, g, b = int(r * 0.55 + 255 * 0.45), int(g * 0.55 + 255 * 0.45), int(b * 0.55 + 255 * 0.45)
                for i, color in enumerate(((229, 9, 20), (255, 255, 255), (0, 168, 225))):
                    tx0 = n * (0.19 + i * 0.22)
                    if inside_round(x + 0.5, y + 0.5, tx0, n * 0.65, tx0 + n * 0.18, n * 0.79, n * 0.03):
                        r, g, b = color
            px[y][x] = (r, g, b, 255)
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            acc = [0, 0, 0, 0]
            for dy in range(ss):
                for dx in range(ss):
                    p = px[y * ss + dy][x * ss + dx]
                    for k in range(4):
                        acc[k] += p[k]
            a = acc[3] // (ss * ss)
            if acc[3]:
                row += [acc[0] // (ss * ss) * 255 // max(a, 1) if a < 255 else acc[0] // (ss * ss),
                        acc[1] // (ss * ss) * 255 // max(a, 1) if a < 255 else acc[1] // (ss * ss),
                        acc[2] // (ss * ss) * 255 // max(a, 1) if a < 255 else acc[2] // (ss * ss), a]
            else:
                row += [0, 0, 0, 0]
        rows.append(row)
    return png(size, size, rows)


for name, size in (('icon.png', 80), ('largeIcon.png', 130)):
    path = os.path.join(ROOT, 'app', name)
    with open(path, 'wb') as f:
        f.write(render(size))
    print(path, size)
