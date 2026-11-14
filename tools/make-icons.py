#!/usr/bin/env python3
"""Render icons/icon-{16,32,48,128}.png.

Pure stdlib: shapes are signed-distance rounded rectangles, antialiased by 4x4
supersampling, then written out with a minimal PNG encoder. Keeping the icons
generated (rather than committing an opaque binary) means the geometry stays
reviewable and every size is guaranteed to come from the same source.
"""

import math
import os
import struct
import zlib

SIZES = (16, 32, 48, 128)
SS = 4  # supersampling factor per axis

BLUE = (0x25, 0x63, 0xEB)
WHITE = (0xFF, 0xFF, 0xFF)

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")


def rounded_rect_sd(px, py, cx, cy, hw, hh, r):
    """Signed distance to a rounded rectangle; negative inside."""
    r = min(r, hw, hh)
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    outside = math.hypot(max(qx, 0.0), max(qy, 0.0))
    inside = min(max(qx, qy), 0.0)
    return outside + inside - r


def blend(dst, idx, color, alpha):
    """Source-over composite of an opaque colour onto premultiplied-free RGBA."""
    if alpha <= 0:
        return
    dr, dg, db, da = dst[idx : idx + 4]
    out_a = alpha + da / 255.0 * (1 - alpha)
    if out_a <= 0:
        dst[idx : idx + 4] = (0, 0, 0, 0)
        return
    for k in range(3):
        src = color[k] / 255.0
        d = dst[idx + k] / 255.0
        val = (src * alpha + d * (da / 255.0) * (1 - alpha)) / out_a
        dst[idx + k] = max(0, min(255, round(val * 255)))
    dst[idx + 3] = max(0, min(255, round(out_a * 255)))


def draw(dst, size, color, sd_fn):
    """Rasterise `sd_fn` (unit coordinates -> signed distance) with supersampling."""
    step = 1.0 / (size * SS)
    half = step / 2.0
    samples = SS * SS
    for y in range(size):
        for x in range(size):
            hits = 0
            for sy in range(SS):
                py = (y * SS + sy) * step + half
                for sx in range(SS):
                    px = (x * SS + sx) * step + half
                    if sd_fn(px, py) < 0:
                        hits += 1
            if hits:
                blend(dst, (y * size + x) * 4, color, hits / samples)


def fill(cx, cy, hw, hh, r):
    return lambda px, py: rounded_rect_sd(px, py, cx, cy, hw, hh, r)


def stroke(cx, cy, hw, hh, r, width):
    half = width / 2.0
    return lambda px, py: abs(rounded_rect_sd(px, py, cx, cy, hw, hh, r)) - half


def render(size):
    dst = bytearray(size * size * 4)

    # Rounded-square plate.
    draw(dst, size, BLUE, fill(0.5, 0.5, 0.5 - 0.055, 0.5 - 0.055, 0.215))

    # Back sheet: outline only, peeking out to the upper right.
    draw(dst, size, WHITE, stroke(0.585, 0.405, 0.150, 0.190, 0.055, 0.050))

    # Knock a plate-coloured gap out from under the front sheet so the two sheets
    # stay visually separate even at 16px.
    draw(dst, size, BLUE, fill(0.430, 0.585, 0.205, 0.245, 0.075))

    # Front sheet.
    draw(dst, size, WHITE, fill(0.430, 0.585, 0.175, 0.215, 0.060))

    # Two text lines inside the front sheet.
    draw(dst, size, BLUE, fill(0.430, 0.530, 0.100, 0.0175, 0.0175))
    draw(dst, size, BLUE, fill(0.400, 0.635, 0.070, 0.0175, 0.0175))

    return bytes(dst)


def write_png(path, size, rgba):
    raw = b"".join(
        b"\x00" + rgba[row * size * 4 : (row + 1) * size * 4] for row in range(size)
    )

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as handle:
        handle.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        write_png(path, size, render(size))
        print(f"wrote {os.path.normpath(path)} ({size}x{size})")


if __name__ == "__main__":
    main()
