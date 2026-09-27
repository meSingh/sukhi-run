#!/usr/bin/env python3
"""
Cuts a sprite sheet drawn on flat green into one transparent sprite per pose.

    python3 scripts/cut-sheet.py art/sheets/sukhi-back.jpg sukhi-run-a sukhi-run-b sukhi-jump ...

The sheets are rendered on one flat green (#00FF00), a colour nothing in the
game is, so the background is a key rather than a guess: alpha comes from how
green a pixel is, the green light the render bounced onto edges is taken back
out, and every separate figure becomes its own file, left to right, in the
order the names are given. Each is trimmed, scaled so its longest side is at
most 640 px, and written as WebP to src/assets/sprites/.

Requires Pillow. Runs locally; nothing is sent anywhere.
"""
import os
import sys
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'src', 'assets', 'sprites')
MAX = 640


def key(im):
    """Alpha from how close a pixel is to the sheet's own green.

    Distance to the measured background, not "how green": a glowing green
    eye or a lime slime is green too, but far from #00FF00 in the other two
    channels, so it stays. Green light bounced onto a kept edge is taken out.
    """
    im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    # The background, sampled from the corners.
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    kr = sum(c[0] for c in corners) / 4
    kg = sum(c[1] for c in corners) / 4
    kb = sum(c[2] for c in corners) / 4
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = ((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) ** 0.5
            if d < 70:
                px[x, y] = (0, 0, 0, 0)
                continue
            a = 255 if d > 150 else int(255 * (d - 70) / 80)
            if a < 255 and g > max(r, b):
                g = max(r, b)
            px[x, y] = (r, g, b, a)
    alpha = im.getchannel('A').filter(ImageFilter.MinFilter(3))
    im.putalpha(alpha)
    return im


def figures(im, min_area):
    """Bounding boxes of the separate opaque shapes, left to right."""
    a = im.getchannel('A').point(lambda v: 255 if v > 40 else 0)
    small = a.resize((a.width // 4, a.height // 4))
    sw, sh = small.size
    seen = bytearray(sw * sh)
    data = small.load()
    boxes = []
    for y in range(sh):
        for x in range(sw):
            if seen[y * sw + x] or not data[x, y]:
                continue
            stack = [(x, y)]
            seen[y * sw + x] = 1
            x0 = x1 = x
            y0 = y1 = y
            n = 0
            while stack:
                cx, cy = stack.pop()
                n += 1
                x0, x1, y0, y1 = min(x0, cx), max(x1, cx), min(y0, cy), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < sw and 0 <= ny < sh and not seen[ny * sw + nx] and data[nx, ny]:
                        seen[ny * sw + nx] = 1
                        stack.append((nx, ny))
            if n * 16 >= min_area:
                boxes.append((x0 * 4, y0 * 4, (x1 + 1) * 4, (y1 + 1) * 4))
    # A figure can fall apart into pieces (a hand held clear of the body).
    # Pieces whose columns mostly overlap are one figure; neighbours that only
    # come close are not.
    merged = []
    for b in sorted(boxes, key=lambda b: b[0]):
        for i, m in enumerate(merged):
            across = min(m[2], b[2]) - max(m[0], b[0])
            down = min(m[3], b[3]) - max(m[1], b[1])
            # Columns mostly shared, and the two touching or overlapping in
            # height: pieces of one figure, not neighbours in another row.
            if across > 0.5 * min(m[2] - m[0], b[2] - b[0]) and down > -12:
                merged[i] = (min(m[0], b[0]), min(m[1], b[1]), max(m[2], b[2]), max(m[3], b[3]))
                break
        else:
            merged.append(b)
    # Reading order: rows top to bottom (figures whose middles share a band),
    # then left to right within a row.
    rows = []
    for b in sorted(merged, key=lambda b: (b[1] + b[3]) / 2):
        mid = (b[1] + b[3]) / 2
        if rows and abs(mid - rows[-1][0]) < 0.25 * im.height:
            rows[-1][1].append(b)
        else:
            rows.append([mid, [b]])
    return [b for _, row in rows for b in sorted(row, key=lambda b: b[0])]


def by_columns(im, n):
    """Splits a row of n figures at the n-1 emptiest columns between them."""
    a = im.getchannel('A').point(lambda v: 1 if v > 40 else 0)
    w, h = a.size
    data = a.load()
    counts = [sum(data[x, y] for y in range(0, h, 2)) for x in range(w)]
    # Smooth, then choose the lowest valleys at least a figure's width apart.
    k = 9
    smooth = [sum(counts[max(0, i - k):i + k + 1]) for i in range(w)]
    gap = w // (n * 2)
    cuts = []
    for i in sorted(range(gap, w - gap), key=lambda i: smooth[i]):
        if all(abs(i - c) >= gap for c in cuts):
            cuts.append(i)
        if len(cuts) == n - 1:
            break
    edges = [0] + sorted(cuts) + [w]
    boxes = []
    for x0, x1 in zip(edges, edges[1:]):
        region = im.getchannel('A').crop((x0, 0, x1, h))
        bb = region.getbbox()
        if bb:
            boxes.append((x0 + bb[0], bb[1], x0 + bb[2], bb[3]))
    return boxes


def only_largest(piece):
    """Keeps the figure and anything big attached to it; loose specks go."""
    a = piece.getchannel('A')
    solid = a.point(lambda v: 255 if v > 40 else 0)
    w, h = solid.size
    data = solid.load()
    seen = bytearray(w * h)
    parts = []
    for y in range(h):
        for x in range(w):
            if seen[y * w + x] or not data[x, y]:
                continue
            stack, pixels = [(x, y)], []
            seen[y * w + x] = 1
            while stack:
                cx, cy = stack.pop()
                pixels.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and data[nx, ny]:
                        seen[ny * w + nx] = 1
                        stack.append((nx, ny))
            parts.append(pixels)
    if not parts:
        return piece
    biggest = max(len(p) for p in parts)
    px = piece.load()
    for pixels in parts:
        if len(pixels) < biggest * 0.08:
            for x, y in pixels:
                r, g, b, _ = px[x, y]
                px[x, y] = (r, g, b, 0)
    return piece


def main():
    sheet, names = sys.argv[1], sys.argv[2:]
    im = key(Image.open(sheet))
    boxes = figures(im, min_area=(im.width * im.height) // 400)
    if len(boxes) < len(names):
        # Figures joined by a thin bridge (a trailing bandage, a reaching
        # hand): split the row at the emptiest columns instead.
        boxes = by_columns(im, len(names))
    if len(boxes) != len(names):
        sys.exit(f'{sheet}: found {len(boxes)} figures, but {len(names)} names were given')
    os.makedirs(OUT, exist_ok=True)
    for name, (x0, y0, x1, y1) in zip(names, boxes):
        pad = 4
        piece = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))
        piece = only_largest(piece)
        piece = piece.crop(piece.getchannel('A').getbbox())
        scale = min(1, MAX / max(piece.size))
        if scale < 1:
            piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.LANCZOS)
        path = os.path.join(OUT, f'{name}.webp')
        piece.save(path, 'WEBP', quality=86, method=6)
        print(f'{name}: {piece.width}x{piece.height}, {os.path.getsize(path) // 1024} kB')


if __name__ == '__main__':
    main()
