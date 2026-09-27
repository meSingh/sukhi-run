#!/usr/bin/env python3
"""
A round face for each chaser, for the row a child picks from, and for the
chase meter. Cut from the chaser sprites, so they always match.

    python3 scripts/faces.py

Writes src/assets/sprites/face-<name>.webp. The numbers are where the head sits
in each sprite: its middle, as fractions of the width and height, and the side
of the square around it, as a fraction of the width.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITES = os.path.join(HERE, '..', 'src', 'assets', 'sprites')

HEADS = {
    'trex': (0.36, 0.12, 0.72),
    'raptor': (0.62, 0.13, 0.70),
    'croc': (0.45, 0.12, 0.62),
    'bear': (0.50, 0.14, 0.62),
    'gorilla': (0.47, 0.11, 0.56),
    'longlegs': (0.60, 0.15, 0.42),
    'mummy': (0.36, 0.12, 0.56),
    'bog': (0.47, 0.37, 0.74),
    'pumpkin': (0.60, 0.12, 0.50),
    'sukhi': (0.50, 0.21, 0.80),
}
SOURCE = {'sukhi': 'sukhi-toward'}
SIZE = 160


def main():
    for name, (cx, cy, s) in HEADS.items():
        im = Image.open(os.path.join(SPRITES, (SOURCE.get(name) or 'chaser-' + name) + '.webp')).convert('RGBA')
        w, h = im.size
        side = s * w
        box = (cx * w - side / 2, cy * h - side / 2, cx * w + side / 2, cy * h + side / 2)
        face = Image.new('RGBA', (int(side), int(side)), (0, 0, 0, 0))
        face.alpha_composite(im.crop(tuple(int(v) for v in box)))
        face = face.resize((SIZE, SIZE), Image.LANCZOS)
        face.save(os.path.join(SPRITES, 'face-' + name + '.webp'), 'WEBP', quality=86, method=6)
    print('faces written')


if __name__ == '__main__':
    main()
