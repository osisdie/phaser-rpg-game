#!/usr/bin/env python3
"""
Export the procedural Dragon Quest-style slime to PNG.
Replaces the SD-generated mon_slime.png with the correct water-drop teardrop shape.
"""
from pathlib import Path
import math
import sys

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("[error] PIL/Pillow required. Run: pip install Pillow")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
OUTPUT_PATH = PROJECT_DIR / "public" / "assets" / "ai" / "monsters" / "mon_slime.png"


def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = hex_str.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"


def blend(c1: str, c2: str, t: float) -> str:
    r1, g1, b1 = hex_to_rgb(c1)
    r2, g2, b2 = hex_to_rgb(c2)
    r = round(r1 + (r2 - r1) * t)
    g = round(g1 + (g2 - g1) * t)
    b = round(b1 + (b2 - b1) * t)
    return rgb_to_hex(max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)))


def darken(hex_str: str, factor: float) -> str:
    return blend(hex_str, "#000000", factor)


def lighten(hex_str: str, factor: float) -> str:
    return blend(hex_str, "#ffffff", factor)


def draw_slime(draw, ox: float, oy: float, w: float, h: float, base: str, accent: str) -> None:
    """Port of MonsterShapes.drawSlime — water-drop teardrop shape."""
    cx = ox + w / 2
    drop_top = oy + h * 0.08
    drop_bot = oy + h * 0.92
    drop_h = drop_bot - drop_top
    max_r = w * 0.4

    # Water-drop body (scanline teardrop)
    for py in range(int(drop_top), int(drop_bot) + 1):
        t = (py - drop_top) / drop_h if drop_h > 0 else 0
        t = max(0, min(1, t))
        if t < 0.7:
            r = max_r * (t / 0.7) ** 0.5
        else:
            bt = (t - 0.7) / 0.3
            r = max_r * math.cos(bt * math.pi / 2)
        if r < 0.5:
            continue

        shade = lighten(base, 0.1 * (1 - t * 2)) if t < 0.5 else darken(base, 0.05 * (t - 0.5) * 2)
        x1 = int(cx - r)
        x2 = int(cx + r)
        draw.rectangle([x1, py, x2 + 1, py + 1], fill=shade)

        if r > 2:
            edge = darken(base, 0.2)
            draw.point((x1, py), fill=edge)
            draw.point((x2, py), fill=edge)

    # Specular highlight
    hl_x = cx - max_r * 0.25
    hl_y = drop_top + drop_h * 0.22
    draw.ellipse(
        [hl_x - w * 0.07, hl_y - h * 0.05, hl_x + w * 0.07, hl_y + h * 0.05],
        fill=lighten(base, 0.45),
    )
    draw.rectangle(
        [int(hl_x - w * 0.02), int(hl_y - h * 0.02), int(hl_x + w * 0.03), int(hl_y + h * 0.02)],
        fill=lighten(base, 0.7),
    )

    # Eyes
    eye_y = drop_top + drop_h * 0.5
    draw.ellipse(
        [cx - w * 0.15, eye_y, cx - w * 0.04, eye_y + h * 0.09],
        fill="#ffffff",
    )
    draw.ellipse(
        [cx + w * 0.04, eye_y, cx + w * 0.15, eye_y + h * 0.09],
        fill="#ffffff",
    )
    draw.rectangle(
        [int(cx - w * 0.09), int(eye_y + h * 0.02), int(cx - w * 0.03), int(eye_y + h * 0.07)],
        fill="#000000",
    )
    draw.rectangle(
        [int(cx + w * 0.07), int(eye_y + h * 0.02), int(cx + w * 0.13), int(eye_y + h * 0.07)],
        fill="#000000",
    )
    draw.point((int(cx - w * 0.08), int(eye_y + h * 0.02)), fill="#ffffff")
    draw.point((int(cx + w * 0.08), int(eye_y + h * 0.02)), fill="#ffffff")

    # Mouth
    mouth_y = eye_y + h * 0.13
    draw.rectangle(
        [int(cx - w * 0.06), int(mouth_y), int(cx + w * 0.06), int(mouth_y) + 1],
        fill=darken(base, 0.3),
    )
    draw.point((int(cx - w * 0.08), int(mouth_y - 1)), fill=darken(base, 0.3))
    draw.point((int(cx + w * 0.06), int(mouth_y - 1)), fill=darken(base, 0.3))


def main():
    size = 96  # Draw at 2x for crispness
    target = 48

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dragon Quest classic blue
    base = "#4488cc"
    accent = "#ffff44"

    draw_slime(draw, 0, 0, size, size, base, accent)

    # Downscale to target with nearest-neighbor
    if size != target:
        img = img.resize((target, target), Image.Resampling.NEAREST)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUTPUT_PATH, "PNG")
    print(f"[ok] Exported procedural slime to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
