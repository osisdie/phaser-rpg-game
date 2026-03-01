#!/usr/bin/env python3
"""
Export procedural monster silhouettes to 512×512 PNGs for img2img init images.
These serve as composition guides for the All-In-One-Pixel-Model img2img pipeline.

Usage:
    python scripts/export_procedural_sprites.py
    python scripts/export_procedural_sprites.py --name mon_slime
    python scripts/export_procedural_sprites.py --size 256

Output: scripts/init_images/{monster_name}.png
"""
import argparse
import math
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("[error] Pillow required. Run: pip install Pillow")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
OUTPUT_DIR = SCRIPT_DIR / "init_images"

# ---------------------------------------------------------------------------
# Color utilities
# ---------------------------------------------------------------------------
def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def blend(c1: str, c2: str, t: float) -> str:
    r1, g1, b1 = hex_to_rgb(c1)
    r2, g2, b2 = hex_to_rgb(c2)
    r = max(0, min(255, round(r1 + (r2 - r1) * t)))
    g = max(0, min(255, round(g1 + (g2 - g1) * t)))
    b = max(0, min(255, round(b1 + (b2 - b1) * t)))
    return f"#{r:02x}{g:02x}{b:02x}"

def darken(c: str, f: float) -> str:
    return blend(c, "#000000", f)

def lighten(c: str, f: float) -> str:
    return blend(c, "#ffffff", f)


# ---------------------------------------------------------------------------
# Shape drawing functions — simplified silhouettes for init images
# These don't need to be pixel-perfect, just capture the overall form.
# ---------------------------------------------------------------------------

def draw_oval(draw: ImageDraw.Draw, cx: float, cy: float, rx: float, ry: float, fill: str):
    draw.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)

def draw_slime(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Water-drop teardrop shape."""
    cx = w / 2
    top = h * 0.08
    bot = h * 0.92
    dh = bot - top
    max_r = w * 0.4

    for py in range(int(top), int(bot) + 1):
        t = (py - top) / dh if dh > 0 else 0
        t = max(0.0, min(1.0, t))
        r = max_r * (t / 0.7) ** 0.5 if t < 0.7 else max_r * math.cos((t - 0.7) / 0.3 * math.pi / 2)
        if r < 0.5:
            continue
        shade = lighten(base, 0.15 * (1 - t)) if t < 0.5 else darken(base, 0.1 * (t - 0.5))
        draw.rectangle([cx - r, py, cx + r, py + 1], fill=shade)

    # Eyes
    ey = top + dh * 0.5
    draw.ellipse([cx - w * 0.15, ey, cx - w * 0.04, ey + h * 0.09], fill="#ffffff")
    draw.ellipse([cx + w * 0.04, ey, cx + w * 0.15, ey + h * 0.09], fill="#ffffff")
    draw.rectangle([int(cx - w * 0.1), int(ey + h * 0.02), int(cx - w * 0.04), int(ey + h * 0.07)], fill="#000000")
    draw.rectangle([int(cx + w * 0.07), int(ey + h * 0.02), int(cx + w * 0.13), int(ey + h * 0.07)], fill="#000000")

    # Mouth
    my = ey + h * 0.13
    draw.rectangle([int(cx - w * 0.06), int(my), int(cx + w * 0.06), int(my) + 2], fill=darken(base, 0.3))

def draw_bat(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Bat with spread wings."""
    cx, cy = w / 2, h * 0.45
    # Body
    draw_oval(draw, cx, cy, w * 0.1, h * 0.15, base)
    # Wings
    pts_l = [(cx - w * 0.08, cy), (cx - w * 0.45, cy - h * 0.2), (cx - w * 0.35, cy + h * 0.1)]
    pts_r = [(cx + w * 0.08, cy), (cx + w * 0.45, cy - h * 0.2), (cx + w * 0.35, cy + h * 0.1)]
    draw.polygon(pts_l, fill=darken(base, 0.1))
    draw.polygon(pts_r, fill=darken(base, 0.1))
    # Eyes
    draw.ellipse([cx - w * 0.06, cy - h * 0.04, cx - w * 0.02, cy + h * 0.02], fill=accent)
    draw.ellipse([cx + w * 0.02, cy - h * 0.04, cx + w * 0.06, cy + h * 0.02], fill=accent)

def draw_wolf(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Four-legged beast (wolf/dog)."""
    cx, cy = w / 2, h * 0.5
    # Body
    draw_oval(draw, cx, cy, w * 0.25, h * 0.15, base)
    # Head
    draw_oval(draw, cx + w * 0.2, cy - h * 0.1, w * 0.12, h * 0.1, lighten(base, 0.1))
    # Legs
    for lx in [cx - w * 0.15, cx - w * 0.05, cx + w * 0.05, cx + w * 0.15]:
        draw.rectangle([lx - w * 0.03, cy + h * 0.12, lx + w * 0.03, cy + h * 0.3], fill=darken(base, 0.1))
    # Tail
    draw.line([(cx - w * 0.25, cy - h * 0.05), (cx - w * 0.35, cy - h * 0.15)], fill=base, width=max(2, int(w * 0.03)))
    # Eyes
    draw.ellipse([cx + w * 0.17, cy - h * 0.14, cx + w * 0.21, cy - h * 0.1], fill=accent)

def draw_snake(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Coiled serpent."""
    cx, cy = w / 2, h * 0.55
    # Coiled body
    for i in range(3):
        y_off = i * h * 0.08
        draw_oval(draw, cx, cy + y_off, w * 0.25 - i * w * 0.03, h * 0.06, lighten(base, 0.05 * i))
    # Raised head
    draw_oval(draw, cx + w * 0.1, cy - h * 0.2, w * 0.08, h * 0.1, lighten(base, 0.1))
    # Hood
    pts = [(cx + w * 0.1, cy - h * 0.15), (cx - w * 0.05, cy - h * 0.25), (cx + w * 0.25, cy - h * 0.25)]
    draw.polygon(pts, fill=accent)
    # Eyes
    draw.ellipse([cx + w * 0.07, cy - h * 0.22, cx + w * 0.1, cy - h * 0.19], fill="#ff0000")

def draw_spider(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Eight-legged spider."""
    cx, cy = w / 2, h * 0.5
    # Body
    draw_oval(draw, cx, cy, w * 0.15, h * 0.12, base)
    draw_oval(draw, cx, cy - h * 0.12, w * 0.08, h * 0.07, lighten(base, 0.1))
    # Legs
    for side in [-1, 1]:
        for i, angle in enumerate([0.3, 0.6, 0.9, 1.2]):
            x1 = cx + side * w * 0.12
            y1 = cy - h * 0.02 + i * h * 0.04
            x2 = cx + side * w * (0.3 + i * 0.04)
            y2 = cy - h * 0.15 + i * h * 0.1
            draw.line([(x1, y1), (x2, y2)], fill=darken(base, 0.2), width=max(2, int(w * 0.015)))
    # Eyes
    for dx in [-0.04, -0.01, 0.01, 0.04]:
        draw.ellipse([cx + w * dx - 2, cy - h * 0.14, cx + w * dx + 2, cy - h * 0.11], fill=accent)

def draw_skeleton(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Humanoid skeleton warrior."""
    cx = w / 2
    # Skull
    draw_oval(draw, cx, h * 0.2, w * 0.1, h * 0.08, base)
    # Ribcage
    draw.rectangle([cx - w * 0.08, h * 0.3, cx + w * 0.08, h * 0.5], fill=darken(base, 0.05))
    # Spine
    draw.line([(cx, h * 0.28), (cx, h * 0.65)], fill=darken(base, 0.1), width=max(2, int(w * 0.02)))
    # Arms
    draw.line([(cx - w * 0.08, h * 0.32), (cx - w * 0.2, h * 0.5)], fill=base, width=max(2, int(w * 0.015)))
    draw.line([(cx + w * 0.08, h * 0.32), (cx + w * 0.25, h * 0.45)], fill=base, width=max(2, int(w * 0.015)))
    # Legs
    draw.line([(cx, h * 0.6), (cx - w * 0.1, h * 0.85)], fill=base, width=max(2, int(w * 0.02)))
    draw.line([(cx, h * 0.6), (cx + w * 0.1, h * 0.85)], fill=base, width=max(2, int(w * 0.02)))
    # Sword in right hand
    draw.line([(cx + w * 0.25, h * 0.45), (cx + w * 0.35, h * 0.2)], fill=accent, width=max(2, int(w * 0.02)))
    # Eye sockets
    draw.ellipse([cx - w * 0.06, h * 0.18, cx - w * 0.02, h * 0.22], fill=accent)
    draw.ellipse([cx + w * 0.02, h * 0.18, cx + w * 0.06, h * 0.22], fill=accent)

def draw_goblin(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Small humanoid goblin."""
    cx = w / 2
    # Body
    draw_oval(draw, cx, h * 0.55, w * 0.15, h * 0.18, base)
    # Head (big)
    draw_oval(draw, cx, h * 0.3, w * 0.12, h * 0.12, lighten(base, 0.1))
    # Ears
    pts_l = [(cx - w * 0.12, h * 0.28), (cx - w * 0.25, h * 0.2), (cx - w * 0.1, h * 0.35)]
    pts_r = [(cx + w * 0.12, h * 0.28), (cx + w * 0.25, h * 0.2), (cx + w * 0.1, h * 0.35)]
    draw.polygon(pts_l, fill=lighten(base, 0.15))
    draw.polygon(pts_r, fill=lighten(base, 0.15))
    # Arms
    draw.line([(cx - w * 0.12, h * 0.45), (cx - w * 0.2, h * 0.6)], fill=base, width=max(2, int(w * 0.02)))
    draw.line([(cx + w * 0.12, h * 0.45), (cx + w * 0.25, h * 0.55)], fill=base, width=max(2, int(w * 0.02)))
    # Club
    draw.line([(cx + w * 0.25, h * 0.55), (cx + w * 0.3, h * 0.35)], fill=accent, width=max(3, int(w * 0.025)))
    # Legs
    draw.line([(cx - w * 0.05, h * 0.7), (cx - w * 0.1, h * 0.85)], fill=darken(base, 0.1), width=max(2, int(w * 0.02)))
    draw.line([(cx + w * 0.05, h * 0.7), (cx + w * 0.1, h * 0.85)], fill=darken(base, 0.1), width=max(2, int(w * 0.02)))
    # Eyes
    draw.ellipse([cx - w * 0.07, h * 0.27, cx - w * 0.02, h * 0.32], fill=accent)
    draw.ellipse([cx + w * 0.02, h * 0.27, cx + w * 0.07, h * 0.32], fill=accent)

def draw_ghost(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Floating wispy ghost."""
    cx = w / 2
    # Body (tapers at bottom)
    draw_oval(draw, cx, h * 0.35, w * 0.2, h * 0.15, base)
    # Tapered lower body
    pts = [(cx - w * 0.2, h * 0.35), (cx + w * 0.2, h * 0.35),
           (cx + w * 0.15, h * 0.65), (cx + w * 0.1, h * 0.7),
           (cx + w * 0.05, h * 0.65), (cx, h * 0.75),
           (cx - w * 0.05, h * 0.65), (cx - w * 0.1, h * 0.7),
           (cx - w * 0.15, h * 0.65)]
    draw.polygon(pts, fill=base)
    # Dark eye holes
    draw.ellipse([cx - w * 0.1, h * 0.3, cx - w * 0.03, h * 0.38], fill="#000000")
    draw.ellipse([cx + w * 0.03, h * 0.3, cx + w * 0.1, h * 0.38], fill="#000000")
    # Mouth
    draw_oval(draw, cx, h * 0.42, w * 0.05, h * 0.04, "#000000")

def draw_elemental(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Elemental spirit — amorphous glowing form."""
    cx, cy = w / 2, h * 0.45
    # Main body
    draw_oval(draw, cx, cy, w * 0.2, h * 0.22, base)
    # Inner glow
    draw_oval(draw, cx, cy, w * 0.12, h * 0.14, lighten(base, 0.3))
    # Floating wisps
    for dx, dy in [(-0.15, -0.15), (0.18, -0.1), (-0.1, 0.2), (0.12, 0.18)]:
        draw_oval(draw, cx + w * dx, cy + h * dy, w * 0.05, h * 0.04, lighten(base, 0.15))
    # Eyes
    draw.ellipse([cx - w * 0.07, cy - h * 0.04, cx - w * 0.02, cy + h * 0.02], fill=accent)
    draw.ellipse([cx + w * 0.02, cy - h * 0.04, cx + w * 0.07, cy + h * 0.02], fill=accent)

def draw_gargoyle(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Stone golem / gargoyle."""
    cx = w / 2
    # Body (blocky)
    draw.rectangle([cx - w * 0.18, h * 0.3, cx + w * 0.18, h * 0.7], fill=base)
    # Head
    draw_oval(draw, cx, h * 0.22, w * 0.12, h * 0.1, lighten(base, 0.05))
    # Arms
    draw.rectangle([cx - w * 0.3, h * 0.35, cx - w * 0.18, h * 0.55], fill=darken(base, 0.1))
    draw.rectangle([cx + w * 0.18, h * 0.35, cx + w * 0.3, h * 0.55], fill=darken(base, 0.1))
    # Fists
    draw_oval(draw, cx - w * 0.24, h * 0.57, w * 0.07, h * 0.06, darken(base, 0.15))
    draw_oval(draw, cx + w * 0.24, h * 0.57, w * 0.07, h * 0.06, darken(base, 0.15))
    # Legs
    draw.rectangle([cx - w * 0.13, h * 0.7, cx - w * 0.05, h * 0.88], fill=darken(base, 0.1))
    draw.rectangle([cx + w * 0.05, h * 0.7, cx + w * 0.13, h * 0.88], fill=darken(base, 0.1))
    # Rune markings
    draw.ellipse([cx - w * 0.08, h * 0.42, cx + w * 0.08, h * 0.55], fill=accent)
    # Eyes
    draw.ellipse([cx - w * 0.07, h * 0.19, cx - w * 0.02, h * 0.24], fill=accent)
    draw.ellipse([cx + w * 0.02, h * 0.19, cx + w * 0.07, h * 0.24], fill=accent)

def draw_dragon(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Dragon with wings."""
    cx, cy = w / 2, h * 0.5
    # Body
    draw_oval(draw, cx, cy, w * 0.18, h * 0.2, base)
    # Head
    draw_oval(draw, cx + w * 0.15, cy - h * 0.18, w * 0.1, h * 0.08, lighten(base, 0.1))
    # Neck
    draw.line([(cx + w * 0.1, cy - h * 0.05), (cx + w * 0.15, cy - h * 0.12)], fill=base, width=max(3, int(w * 0.04)))
    # Wings
    pts_l = [(cx - w * 0.05, cy - h * 0.1), (cx - w * 0.35, cy - h * 0.3), (cx - w * 0.2, cy + h * 0.05)]
    pts_r = [(cx + w * 0.05, cy - h * 0.1), (cx + w * 0.3, cy - h * 0.35), (cx + w * 0.15, cy + h * 0.05)]
    draw.polygon(pts_l, fill=accent)
    draw.polygon(pts_r, fill=accent)
    # Tail
    pts_tail = [(cx - w * 0.18, cy), (cx - w * 0.35, cy + h * 0.15), (cx - w * 0.3, cy + h * 0.1)]
    draw.polygon(pts_tail, fill=darken(base, 0.1))
    # Legs
    for dx in [-0.1, 0.1]:
        draw.rectangle([cx + w * dx - w * 0.03, cy + h * 0.15, cx + w * dx + w * 0.03, cy + h * 0.3], fill=darken(base, 0.1))
    # Eye
    draw.ellipse([cx + w * 0.13, cy - h * 0.2, cx + w * 0.17, cy - h * 0.17], fill="#ff0000")

def draw_insect(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Scorpion/insect shape."""
    cx, cy = w / 2, h * 0.55
    # Body segments
    draw_oval(draw, cx, cy, w * 0.15, h * 0.1, base)
    draw_oval(draw, cx, cy - h * 0.1, w * 0.1, h * 0.07, lighten(base, 0.1))
    # Tail (curved upward)
    for i in range(4):
        tx = cx - w * 0.05 * i
        ty = cy + h * 0.08 - h * 0.05 * i
        draw_oval(draw, tx, ty, w * 0.04, h * 0.03, accent)
    # Stinger
    draw.polygon([(cx - w * 0.15, cy - h * 0.1), (cx - w * 0.18, cy - h * 0.15), (cx - w * 0.12, cy - h * 0.12)], fill="#ff0000")
    # Pincers
    draw.ellipse([cx + w * 0.1, cy - h * 0.18, cx + w * 0.2, cy - h * 0.1], fill=darken(base, 0.1))
    draw.ellipse([cx + w * 0.15, cy - h * 0.25, cx + w * 0.25, cy - h * 0.15], fill=darken(base, 0.1))
    # Legs
    for i in range(3):
        for side in [-1, 1]:
            x1 = cx + side * w * 0.12
            y1 = cy - h * 0.05 + i * h * 0.05
            x2 = cx + side * w * 0.28
            y2 = cy + h * 0.05 + i * h * 0.04
            draw.line([(x1, y1), (x2, y2)], fill=darken(base, 0.2), width=max(1, int(w * 0.01)))

def draw_fish(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Fish/jellyfish shape."""
    cx, cy = w / 2, h * 0.35
    # Dome bell
    draw_oval(draw, cx, cy, w * 0.2, h * 0.15, base)
    draw_oval(draw, cx, cy, w * 0.14, h * 0.1, lighten(base, 0.2))
    # Tentacles
    for dx in [-0.12, -0.06, 0, 0.06, 0.12]:
        x = cx + w * dx
        for ty in range(int(cy + h * 0.1), int(cy + h * 0.4), max(1, int(h * 0.03))):
            wave = math.sin(ty * 0.1 + dx * 10) * w * 0.02
            draw.ellipse([x + wave - 2, ty, x + wave + 2, ty + 3], fill=lighten(base, 0.1))

def draw_bird(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Bird with spread wings."""
    cx, cy = w / 2, h * 0.45
    # Body
    draw_oval(draw, cx, cy, w * 0.08, h * 0.12, base)
    # Head
    draw_oval(draw, cx, cy - h * 0.15, w * 0.06, h * 0.05, lighten(base, 0.1))
    # Wings
    pts_l = [(cx - w * 0.06, cy - h * 0.05), (cx - w * 0.4, cy - h * 0.15), (cx - w * 0.3, cy + h * 0.05)]
    pts_r = [(cx + w * 0.06, cy - h * 0.05), (cx + w * 0.4, cy - h * 0.15), (cx + w * 0.3, cy + h * 0.05)]
    draw.polygon(pts_l, fill=darken(base, 0.1))
    draw.polygon(pts_r, fill=darken(base, 0.1))
    # Beak
    draw.polygon([(cx, cy - h * 0.14), (cx + w * 0.08, cy - h * 0.12), (cx, cy - h * 0.1)], fill=accent)
    # Eye
    draw.ellipse([cx - w * 0.03, cy - h * 0.17, cx + w * 0.01, cy - h * 0.14], fill="#000000")

def draw_bear(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Large beast (lion/bear)."""
    cx, cy = w / 2, h * 0.5
    # Body
    draw_oval(draw, cx, cy, w * 0.25, h * 0.2, base)
    # Head
    draw_oval(draw, cx + w * 0.15, cy - h * 0.15, w * 0.14, h * 0.12, lighten(base, 0.05))
    # Mane (for lion)
    draw_oval(draw, cx + w * 0.15, cy - h * 0.15, w * 0.18, h * 0.16, darken(base, 0.15))
    draw_oval(draw, cx + w * 0.15, cy - h * 0.15, w * 0.13, h * 0.11, lighten(base, 0.05))
    # Legs
    for dx in [-0.15, -0.05, 0.05, 0.15]:
        draw.rectangle([cx + w * dx - w * 0.04, cy + h * 0.15, cx + w * dx + w * 0.04, cy + h * 0.32], fill=darken(base, 0.1))
    # Eye
    draw.ellipse([cx + w * 0.15, cy - h * 0.18, cx + w * 0.2, cy - h * 0.14], fill=accent)
    # Mouth
    draw.line([(cx + w * 0.22, cy - h * 0.12), (cx + w * 0.28, cy - h * 0.1)], fill="#880000", width=max(2, int(w * 0.015)))

def draw_turtle(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Armored turtle."""
    cx, cy = w / 2, h * 0.5
    # Shell
    draw_oval(draw, cx, cy, w * 0.25, h * 0.18, base)
    draw_oval(draw, cx, cy - h * 0.02, w * 0.22, h * 0.14, lighten(base, 0.1))
    # Shell pattern
    draw_oval(draw, cx, cy - h * 0.02, w * 0.12, h * 0.08, accent)
    # Head
    draw_oval(draw, cx + w * 0.22, cy - h * 0.05, w * 0.07, h * 0.06, darken(base, 0.2))
    # Legs
    for dx, dy in [(-0.2, 0.12), (0.2, 0.12), (-0.15, -0.1), (0.15, -0.1)]:
        draw_oval(draw, cx + w * dx, cy + h * dy, w * 0.05, h * 0.04, darken(base, 0.15))

def draw_crab(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Crab with pincers."""
    cx, cy = w / 2, h * 0.5
    # Body
    draw_oval(draw, cx, cy, w * 0.2, h * 0.12, base)
    # Pincers
    draw_oval(draw, cx - w * 0.3, cy - h * 0.1, w * 0.08, h * 0.06, accent)
    draw_oval(draw, cx + w * 0.3, cy - h * 0.1, w * 0.08, h * 0.06, accent)
    # Arms
    draw.line([(cx - w * 0.18, cy - h * 0.05), (cx - w * 0.3, cy - h * 0.1)], fill=base, width=max(2, int(w * 0.025)))
    draw.line([(cx + w * 0.18, cy - h * 0.05), (cx + w * 0.3, cy - h * 0.1)], fill=base, width=max(2, int(w * 0.025)))
    # Legs
    for i in range(3):
        for side in [-1, 1]:
            x1 = cx + side * w * 0.15
            y1 = cy + h * 0.05 + i * h * 0.04
            x2 = cx + side * w * 0.3
            y2 = cy + h * 0.15 + i * h * 0.03
            draw.line([(x1, y1), (x2, y2)], fill=darken(base, 0.1), width=max(1, int(w * 0.015)))
    # Eyes on stalks
    draw.line([(cx - w * 0.05, cy - h * 0.1), (cx - w * 0.07, cy - h * 0.18)], fill=base, width=max(1, int(w * 0.01)))
    draw.line([(cx + w * 0.05, cy - h * 0.1), (cx + w * 0.07, cy - h * 0.18)], fill=base, width=max(1, int(w * 0.01)))
    draw.ellipse([cx - w * 0.09, cy - h * 0.2, cx - w * 0.05, cy - h * 0.17], fill="#000000")
    draw.ellipse([cx + w * 0.05, cy - h * 0.2, cx + w * 0.09, cy - h * 0.17], fill="#000000")

def draw_plant(draw: ImageDraw.Draw, w: int, h: int, base: str, accent: str):
    """Carnivorous plant / flower monster."""
    cx = w / 2
    # Stem
    draw.line([(cx, h * 0.5), (cx, h * 0.85)], fill=darken(base, 0.2), width=max(3, int(w * 0.03)))
    # Leaves
    draw.polygon([(cx, h * 0.65), (cx - w * 0.15, h * 0.7), (cx - w * 0.05, h * 0.75)], fill=base)
    draw.polygon([(cx, h * 0.6), (cx + w * 0.15, h * 0.65), (cx + w * 0.05, h * 0.7)], fill=base)
    # Flower head (venus flytrap)
    draw_oval(draw, cx, h * 0.35, w * 0.18, h * 0.15, accent)
    # Teeth
    for i in range(5):
        tx = cx - w * 0.15 + i * w * 0.075
        draw.polygon([(tx, h * 0.36), (tx + w * 0.02, h * 0.3), (tx + w * 0.04, h * 0.36)], fill="#ffffff")
    # Eyes
    draw.ellipse([cx - w * 0.08, h * 0.3, cx - w * 0.03, h * 0.35], fill="#000000")
    draw.ellipse([cx + w * 0.03, h * 0.3, cx + w * 0.08, h * 0.35], fill="#000000")


# ---------------------------------------------------------------------------
# Monster definitions: name → (shape_func, base_color, accent_color)
# ---------------------------------------------------------------------------
SHAPE_FUNCS = {
    "slime": draw_slime,
    "bat": draw_bat,
    "wolf": draw_wolf,
    "snake": draw_snake,
    "spider": draw_spider,
    "skeleton": draw_skeleton,
    "goblin": draw_goblin,
    "ghost": draw_ghost,
    "elemental": draw_elemental,
    "gargoyle": draw_gargoyle,
    "dragon": draw_dragon,
    "insect": draw_insect,
    "fish": draw_fish,
    "bird": draw_bird,
    "bear": draw_bear,
    "turtle": draw_turtle,
    "crab": draw_crab,
    "plant": draw_plant,
}

# Maps each AI asset monster name → (shape, base_color, accent_color)
MONSTER_DEFS: dict[str, tuple[str, str, str]] = {
    # Regular monsters (48-64px targets)
    "mon_slime":          ("slime",    "#4488cc", "#ffff44"),
    "mon_bat":            ("bat",      "#553366", "#ff4444"),
    "mon_goblin":         ("goblin",   "#448833", "#ccaa22"),
    "mon_snake":          ("snake",    "#448844", "#cccc44"),
    "mon_wolf":           ("wolf",     "#888899", "#ffcc44"),
    "mon_skeleton":       ("skeleton", "#ddddcc", "#6644aa"),
    "mon_spider":         ("spider",   "#222233", "#cc2222"),
    "mon_ghost":          ("ghost",    "#ccccee", "#000000"),
    "mon_flower":         ("plant",    "#228833", "#cc2244"),
    "mon_treant":         ("plant",    "#665533", "#884422"),
    "mon_mushroom":       ("plant",    "#cc3322", "#ffffff"),
    "mon_lion":           ("bear",     "#cc9933", "#ffd700"),
    "mon_scorpion":       ("insect",   "#885533", "#cc4422"),
    "mon_jellyfish":      ("fish",     "#4466cc", "#88aaff"),
    "mon_shark":          ("fish",     "#556677", "#cc2222"),
    "mon_golem":          ("gargoyle", "#778888", "#ff8833"),
    "mon_dragon_young":   ("dragon",   "#338844", "#cc3322"),
    "mon_demon_soldier":  ("skeleton", "#333344", "#cc2222"),
    "mon_dark_knight":    ("skeleton", "#222233", "#8844cc"),
    # Boss monsters (96-128px targets)
    "mon_boss_guardian":      ("skeleton", "#aa8822", "#880000"),
    "mon_boss_elf_king":      ("elemental","#336633", "#224422"),
    "mon_boss_ancient_tree":  ("plant",    "#554422", "#882222"),
    "mon_boss_beast_general": ("bear",     "#884422", "#cc6633"),
    "mon_boss_sea_dragon":    ("dragon",   "#336688", "#44aacc"),
    "mon_boss_mountain_king": ("gargoyle", "#667788", "#4488cc"),
    "mon_boss_forge_master":  ("elemental","#cc5522", "#ff8833"),
    "mon_boss_death_lord":    ("skeleton", "#553366", "#8833cc"),
    "mon_boss_demon_lord":    ("dragon",   "#440022", "#cc2244"),
}


def export_monster(name: str, size: int = 512) -> Path:
    """Render a single monster to PNG and return the output path."""
    if name not in MONSTER_DEFS:
        print(f"  [skip] Unknown monster: {name}")
        return None

    shape_name, base_color, accent_color = MONSTER_DEFS[name]
    func = SHAPE_FUNCS[shape_name]

    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))  # Black background (not transparent — for img2img)
    draw_ctx = ImageDraw.Draw(img)
    func(draw_ctx, size, size, base_color, accent_color)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{name}.png"
    img.save(out_path, "PNG")
    return out_path


def main():
    parser = argparse.ArgumentParser(description="Export procedural monster silhouettes for img2img")
    parser.add_argument("--name", type=str, help="Export a single monster by name")
    parser.add_argument("--size", type=int, default=512, help="Image size (default: 512)")
    args = parser.parse_args()

    if args.name:
        path = export_monster(args.name, args.size)
        if path:
            print(f"[ok] Exported {args.name} → {path}")
    else:
        print(f"[export] Generating {len(MONSTER_DEFS)} procedural init images ({args.size}×{args.size})...")
        count = 0
        for name in MONSTER_DEFS:
            path = export_monster(name, args.size)
            if path:
                print(f"  [ok] {name} → {path}")
                count += 1
        print(f"\n[done] Exported {count} init images to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
