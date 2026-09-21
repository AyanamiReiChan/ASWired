"""Remove the GIF's black matte and tint its animated mark for the glass theme.

Use animated lossless WebP so antialiased edges retain partial transparency.
The original GIF, frame timing, canvas size and loop count remain unchanged.
"""
from pathlib import Path
from PIL import Image, ImageSequence

root = Path(__file__).resolve().parents[1]
source = Image.open(root / "static/aswired-logo.gif")
frames = [frame.convert("RGB") for frame in ImageSequence.Iterator(source)]
peak = max(high for frame in frames for _, high in frame.getextrema())
durations = []
for i in range(source.n_frames):
    source.seek(i)
    durations.append(source.info.get("duration", 40))

output = []
for frame in frames:
    width, height = frame.size
    rgba = Image.new("RGBA", frame.size)
    pixels = []
    for y in range(height):
        ratio = y / max(1, height - 1)
        tint = tuple(round(a + (b - a) * ratio) for a, b in zip((174, 224, 255), (199, 188, 255)))
        for x in range(width):
            alpha = round(max(frame.getpixel((x, y))) / peak * 255)
            pixels.append((*tint, alpha))
    rgba.putdata(pixels)
    output.append(rgba)

target = root / "static/aswired-logo-glass.webp"
output[0].save(target, save_all=True, append_images=output[1:], duration=durations,
               loop=source.info.get("loop", 0), lossless=True, method=6)
check = Image.open(target)
assert check.n_frames == len(frames)
for i in range(check.n_frames):
    check.seek(i)
    assert check.convert("RGBA").getpixel((0, 0))[3] == 0
print(f"{target.name}: {check.n_frames} frames, {sum(durations)} ms loop, {target.stat().st_size} bytes")
