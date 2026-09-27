#!/usr/bin/env python3
"""
The painted backdrops, from the design art in art/.

    python3 scripts/scenes.py

  sky-jungle, sky-swamp   the top of each world picture, down to where the
                          path meets the horizon; the game paints the path
                          itself below that line
  cover                   the picture behind the start screen
  scare-1, -2, -3         the three faces of Long-Legs, for the grown-up's
                          scare setting
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, '..', 'art')
OUT = os.path.join(HERE, '..', 'src', 'assets', 'scenes')

# Where the horizon is in each world picture, as a fraction of its height.
HORIZON = {'jungle': 0.47, 'swamp': 0.54}


def save(im, name, width, quality=80):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.convert('RGB').save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=quality, method=6)


def main():
    os.makedirs(OUT, exist_ok=True)
    for world, h in HORIZON.items():
        im = Image.open(os.path.join(ART, 'world-' + world + '.jpg'))
        save(im.crop((0, 0, im.width, round(im.height * h))), 'sky-' + world, 1376)
    save(Image.open(os.path.join(ART, 'cover.jpg')), 'cover', 1376, 78)
    dial = Image.open(os.path.join(ART, 'scare-dial.jpg'))
    w, h = dial.size
    third = w / 3
    for i in range(3):
        pad = 10
        panel = dial.crop((round(i * third + pad), pad, round((i + 1) * third - pad), h - pad))
        save(panel, 'scare-%d' % (i + 1), 300, 82)
    print('scenes written')


if __name__ == '__main__':
    main()
