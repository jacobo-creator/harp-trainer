"""Generate PWA / iOS app icons for the Harmonica app.

Draws a simple stylized harmonica on a dark rounded background.
Run: python scripts/generate_icons.py
"""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (15, 23, 42)          # slate-900
BG2 = (30, 41, 59)         # slate-800
BODY = (203, 213, 225)     # cover plate (steel)
BODY_DK = (148, 163, 184)
ACCENT = (251, 191, 36)    # amber-400
HOLE = (15, 23, 42)


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def render(size, maskable=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size

    # Background (full bleed for maskable, rounded otherwise)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BG)
    else:
        rounded(d, [0, 0, s, s], int(s * 0.22), BG)

    # subtle inner panel
    inset = s * (0.10 if maskable else 0.16)
    rounded(d, [inset, inset * 1.4, s - inset, s - inset * 1.4], int(s * 0.10), BG2)

    # Harmonica body
    hx0 = s * 0.16
    hx1 = s * 0.84
    hy0 = s * 0.38
    hy1 = s * 0.62
    rounded(d, [hx0, hy0, hx1, hy1], int(s * 0.05), BODY)

    # top cover plate accent
    rounded(d, [hx0, hy0, hx1, hy0 + (hy1 - hy0) * 0.34], int(s * 0.045), ACCENT)

    # holes
    n = 6
    pad = (hx1 - hx0) * 0.10
    avail = (hx1 - hx0) - pad * 2
    gap = avail / (n * 2 - 1)
    hole_y0 = hy0 + (hy1 - hy0) * 0.50
    hole_y1 = hy1 - (hy1 - hy0) * 0.16
    for i in range(n):
        x0 = hx0 + pad + i * gap * 2
        x1 = x0 + gap
        rounded(d, [x0, hole_y0, x1, hole_y1], int(gap * 0.25), HOLE)

    # sound waves to the right (hint of "listening / tuning")
    cx = s * 0.5
    cy = s * 0.5
    return img


for sz, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
    render(sz).save(os.path.join(OUT, name))
render(512, maskable=True).save(os.path.join(OUT, "icon-maskable-512.png"))

# favicon
render(64).save(os.path.join(OUT, "favicon.png"))
print("icons written to", os.path.abspath(OUT))
