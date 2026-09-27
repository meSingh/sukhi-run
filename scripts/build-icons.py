#!/usr/bin/env python3
"""
The app icons: Sukhi running towards you down a path at dusk, the T-Rex's
head coming up behind him.

    python3 scripts/build-icons.py

Writes public/icon-192.png, icon-512.png, the maskable pair (the same picture
kept inside the middle 80%, which is all a maskable icon promises to show),
apple-touch-icon.png and favicon-64.png. Drawn at 1024 and scaled down.
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, '..', 'public')
SPRITES = os.path.join(HERE, '..', 'src', 'assets', 'sprites')


def sprite(name, height):
    im = Image.open(os.path.join(SPRITES, name + '.webp')).convert('RGBA')
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def picture(size, inset=1.0, rounded=True):
    s = 1024
    sky = Image.new('RGBA', (s, s))
    d = ImageDraw.Draw(sky)
    top, low = (35, 32, 79), (242, 166, 90)
    for y in range(s):
        k = min(1, y / (s * 0.62))
        d.line((0, y, s, y), fill=tuple(round(a + (b - a) * k) for a, b in zip(top, low)) + (255,))
    d.rectangle((0, round(s * 0.62), s, s), fill='#5E9E40')
    d.polygon([(s * 0.44, s * 0.62), (s * 0.56, s * 0.62), (s * 0.95, s), (s * 0.05, s)], fill='#D8C49A')

    k = inset
    o = (1 - k) * s / 2
    art = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    rex = sprite('chaser-trex', round(820 * k))
    art.alpha_composite(rex, (round(o + 600 * k - rex.width / 2), round(o + 40 * k)))
    boy = sprite('sukhi-toward', round(700 * k))
    art.alpha_composite(boy, (round(o + 420 * k - boy.width / 2), round(o + 300 * k)))
    sky.alpha_composite(art)

    if rounded:
        mask = Image.new('L', (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s, s), radius=220, fill=255)
        sky.putalpha(mask)
    return sky.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(PUBLIC, exist_ok=True)
    picture(192).save(os.path.join(PUBLIC, 'icon-192.png'))
    picture(512).save(os.path.join(PUBLIC, 'icon-512.png'))
    picture(64).save(os.path.join(PUBLIC, 'favicon-64.png'))
    picture(180, rounded=False).convert('RGB').save(os.path.join(PUBLIC, 'apple-touch-icon.png'))
    picture(192, inset=0.8, rounded=False).save(os.path.join(PUBLIC, 'icon-maskable-192.png'))
    picture(512, inset=0.8, rounded=False).save(os.path.join(PUBLIC, 'icon-maskable-512.png'))
    print('icons written to public/')


if __name__ == '__main__':
    main()
