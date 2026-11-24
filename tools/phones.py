"""Compose three phone screenshots into docs/screenshots/07-phones.png (run after tools/shots.mjs)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SHOTS = [
    ('docs/screenshots/m1-today-sw.png', 'Kiswahili · Today'),
    ('docs/screenshots/m2-bottles-hi.png', 'Hindi · My bottles'),
    ('docs/screenshots/m4-plan-fr.png', 'Français · Plan'),
]
W, H = 2400, 1500
PHONE_W, BEZEL, RADIUS = 580, 18, 70


def font(size):
    for path in ['/System/Library/Fonts/SFNSRounded.ttf', '/System/Library/Fonts/SFNS.ttf', '/System/Library/Fonts/Helvetica.ttc']:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


bg = Image.new('RGB', (W, H))
top, bottom = (253, 236, 196), (251, 246, 236)
d = ImageDraw.Draw(bg)
for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))

label_font = font(46)
gap = (W - 3 * PHONE_W) // 4
for i, (path, label) in enumerate(SHOTS):
    shot = Image.open(path).convert('RGB')
    inner_w = PHONE_W - 2 * BEZEL
    inner_h = round(shot.height * inner_w / shot.width)
    shot = shot.resize((inner_w, inner_h), Image.LANCZOS)
    x = gap + i * (PHONE_W + gap)
    y = 90
    ph = inner_h + 2 * BEZEL
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle([x + 10, y + 26, x + PHONE_W - 10, y + ph + 20], RADIUS, fill=90)
    bg.paste((120, 90, 40), (0, 0), shadow.filter(ImageFilter.GaussianBlur(28)))
    ImageDraw.Draw(bg).rounded_rectangle([x, y, x + PHONE_W, y + ph], RADIUS, fill=(23, 32, 46))
    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, inner_w - 1, inner_h - 1], RADIUS - BEZEL, fill=255)
    bg.paste(shot, (x + BEZEL, y + BEZEL), mask)
    d = ImageDraw.Draw(bg)
    tw = d.textlength(label, font=label_font)
    d.text((x + (PHONE_W - tw) / 2, y + ph + 40), label, font=label_font, fill=(23, 32, 46))

bg.save('docs/screenshots/07-phones.png', optimize=True)
print('wrote docs/screenshots/07-phones.png')
