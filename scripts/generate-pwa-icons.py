from math import cos, pi, sin
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "images" / "icons"
CANVAS = 1024
BACKGROUND = (17, 17, 22)
BRONZE = (121, 83, 66)
GOLD = (209, 177, 127)
CREAM = (240, 230, 213)


def radial_point(cx, cy, radius, angle):
    return (round(cx + cos(angle) * radius), round(cy + sin(angle) * radius))


def create_master(content_scale):
    image = Image.new("RGB", (CANVAS, CANVAS), BACKGROUND)
    draw = ImageDraw.Draw(image)
    center = CANVAS // 2

    for radius, color, width in (
        (430 * content_scale, BRONZE, 8),
        (397 * content_scale, GOLD, 4),
        (350 * content_scale, BRONZE, 4),
    ):
        bounds = (
            center - radius,
            center - radius,
            center + radius,
            center + radius,
        )
        draw.ellipse(bounds, outline=color, width=width)

    for index in range(8):
        angle = index * (2 * pi / 8)
        shoulder = radial_point(center, center, 224 * content_scale, angle)
        wing = 58 * content_scale
        perpendicular_x = -sin(angle) * wing
        perpendicular_y = cos(angle) * wing
        points = [
            radial_point(center, center, 88 * content_scale, angle),
            (
                round(shoulder[0] + perpendicular_x),
                round(shoulder[1] + perpendicular_y),
            ),
            radial_point(center, center, 342 * content_scale, angle),
            (
                round(shoulder[0] - perpendicular_x),
                round(shoulder[1] - perpendicular_y),
            ),
        ]
        draw.polygon(points, fill=BRONZE)
        draw.line(points + [points[0]], fill=GOLD, width=8, joint="curve")
        dot = 9 * content_scale
        draw.ellipse(
            (
                shoulder[0] - dot,
                shoulder[1] - dot,
                shoulder[0] + dot,
                shoulder[1] + dot,
            ),
            fill=CREAM,
        )

    center_radius = 67 * content_scale
    draw.ellipse(
        (
            center - center_radius,
            center - center_radius,
            center + center_radius,
            center + center_radius,
        ),
        fill=BACKGROUND,
        outline=GOLD,
        width=9,
    )
    diamond = 44 * content_scale
    draw.polygon(
        [
            (center, round(center - diamond)),
            (round(center + diamond), center),
            (center, round(center + diamond)),
            (round(center - diamond), center),
        ],
        fill=GOLD,
    )
    dot = 10 * content_scale
    draw.ellipse(
        (center - dot, center - dot, center + dot, center + dot),
        fill=CREAM,
    )
    return image


def save_icon(filename, size, content_scale):
    icon = create_master(content_scale).resize(
        (size, size), Image.Resampling.LANCZOS
    )
    icon.save(OUTPUT / filename, format="PNG", optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    save_icon("pwa-192.png", 192, 0.90)
    save_icon("pwa-512.png", 512, 0.90)
    save_icon("pwa-512-maskable.png", 512, 0.74)
    save_icon("apple-touch-icon.png", 180, 0.90)
    for filename in (
        "pwa-192.png",
        "pwa-512.png",
        "pwa-512-maskable.png",
        "apple-touch-icon.png",
    ):
        print(OUTPUT / filename)


if __name__ == "__main__":
    main()
