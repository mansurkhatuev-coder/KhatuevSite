from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "images" / "icons"
SOURCE = OUTPUT / "book-towers-artwork.webp"
SIZES = (
    ("pwa-book-towers-192.png", 192, 0.88),
    ("pwa-book-towers-512.png", 512, 0.88),
    ("pwa-book-towers-maskable-512.png", 512, 0.72),
    ("apple-touch-book-towers-180.png", 180, 0.88),
)


def save_icon(artwork, filename, size, content_scale, background):
    canvas = Image.new("RGB", (size, size), background)
    artwork_size = round(size * content_scale)
    icon_artwork = artwork.resize(
        (artwork_size, artwork_size), Image.Resampling.LANCZOS
    )
    offset = (size - artwork_size) // 2
    canvas.paste(icon_artwork, (offset, offset))
    canvas.save(OUTPUT / filename, format="PNG", optimize=True)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE) as source_image:
        artwork = source_image.convert("RGB")
    background = artwork.getpixel((0, 0))

    for filename, size, content_scale in SIZES:
        save_icon(artwork, filename, size, content_scale, background)
        print(OUTPUT / filename)


if __name__ == "__main__":
    main()
