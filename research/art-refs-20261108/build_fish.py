#!/usr/bin/env python3
"""Design aid for the fish-shell homage icon_fish (32x32).

The pixel map below is the hand-authored design (same row-string form as
graphics/sprites.js), built from explicit per-row segments so every row is
exactly 32 wide. This script only renders it for visual QC at real sizes;
the deliverable art is drawn in Aseprite from the same rows
(see fish-shell-homage.lua) and pixel-verified against this map.
Palette chars come from sprites.js (no new colours):
  O #604B40 outline   R #E66B52 outer red    A #F49A45 medium orange
  Y #FFDA64 inner yellow   C #FFFFFF eye white   K #45414A pupil/mouth
"""
import json
from PIL import Image

PALETTE = {
    "O": (0x60, 0x4B, 0x40),
    "R": (0xE6, 0x6B, 0x52),
    "A": (0xF4, 0x9A, 0x45),
    "Y": (0xFF, 0xDA, 0x64),
    "C": (0xFF, 0xFF, 0xFF),
    "K": (0x45, 0x41, 0x4A),
}


def rows_from_segments(seg):
    """seg: {y: [(x0, x1_inclusive, char), ...]} -> 32 row strings."""
    rows = []
    for y in range(32):
        r = ["."] * 32
        for x0, x1, ch in seg.get(y, []):
            for x in range(x0, x1 + 1):
                assert 0 <= x < 32, f"y={y} x={x} out of range"
                assert r[x] == ".", f"y={y} x={x} overlap"
                r[x] = ch
        rows.append("".join(r))
    return rows


# Variant A: horizontal, left-facing. Head left, forked tail right.
# Bands (logo order): R top, A, Y core, A, R bottom. Eye ring x7-11/y11-15.
# Mouth: dark K patch x3-4/y15-16 framed by O lips at y14/y17 ("[" open mouth).
SEG_A = {
    8: [(15, 16, "R")],
    9: [(7, 7, "O"), (8, 17, "R"), (18, 18, "O")],
    10: [(5, 5, "O"), (6, 19, "R"), (20, 20, "O"), (22, 22, "O"), (23, 23, "R"), (24, 24, "O")],
    11: [(4, 4, "O"), (5, 7, "A"), (8, 10, "O"), (11, 20, "A"), (21, 21, "O"), (23, 23, "O"), (24, 25, "A"), (26, 26, "O")],
    12: [(4, 4, "O"), (5, 6, "A"), (7, 7, "O"), (8, 8, "K"), (9, 10, "C"), (11, 11, "O"), (12, 21, "A"), (22, 22, "O"), (24, 24, "O"), (25, 27, "A"), (28, 28, "O")],
    13: [(3, 3, "O"), (4, 6, "Y"), (7, 7, "O"), (8, 8, "K"), (9, 10, "C"), (11, 11, "O"), (12, 22, "Y"), (23, 24, "O"), (25, 28, "Y"), (29, 29, "O")],
    14: [(3, 4, "O"), (5, 6, "Y"), (7, 7, "O"), (8, 10, "C"), (11, 11, "O"), (12, 22, "Y"), (23, 24, "O"), (25, 27, "Y"), (28, 28, "O")],
    15: [(3, 4, "K"), (5, 5, "O"), (6, 7, "Y"), (8, 10, "O"), (11, 22, "Y"), (23, 23, "O")],
    16: [(3, 4, "K"), (5, 5, "O"), (6, 22, "A"), (23, 23, "O")],
    17: [(3, 4, "O"), (5, 22, "A"), (23, 24, "O"), (25, 27, "A"), (28, 28, "O")],
    18: [(3, 3, "O"), (4, 22, "A"), (23, 24, "O"), (25, 28, "A"), (29, 29, "O")],
    19: [(4, 4, "O"), (5, 21, "R"), (22, 22, "O"), (24, 24, "O"), (25, 27, "R"), (28, 28, "O")],
    20: [(4, 4, "O"), (5, 20, "R"), (21, 21, "O"), (23, 23, "O"), (24, 25, "R"), (26, 26, "O")],
    21: [(5, 5, "O"), (6, 19, "R"), (20, 20, "O"), (22, 22, "O"), (23, 23, "R"), (24, 24, "O")],
}

# Variant B: diagonal S, logo-faithful. Head top-left, tail fork bottom-right.
SEG_B = {
    6: [(5, 9, "O")],
    7: [(4, 4, "O"), (5, 9, "R"), (10, 10, "O")],
    8: [(4, 4, "O"), (5, 5, "R"), (6, 6, "C"), (7, 7, "K"), (8, 9, "R"), (10, 10, "O")],
    9: [(4, 4, "O"), (5, 5, "R"), (6, 6, "C"), (7, 7, "K"), (8, 9, "R"), (10, 11, "O")],
    10: [(3, 4, "K"), (5, 5, "O"), (6, 10, "R"), (11, 11, "O")],
    11: [(3, 4, "K"), (5, 5, "O"), (6, 11, "R"), (12, 12, "O")],
    12: [(5, 5, "O"), (6, 12, "A"), (13, 13, "O")],
    13: [(6, 6, "O"), (7, 13, "A"), (14, 14, "O")],
    14: [(7, 7, "O"), (8, 14, "Y"), (15, 15, "O")],
    15: [(8, 8, "O"), (9, 15, "Y"), (16, 16, "O")],
    16: [(9, 9, "O"), (10, 16, "Y"), (17, 17, "O")],
    17: [(10, 10, "O"), (11, 17, "A"), (18, 18, "O")],
    18: [(11, 11, "O"), (12, 18, "A"), (19, 19, "O")],
    19: [(12, 12, "O"), (13, 19, "R"), (20, 20, "O")],
    20: [(13, 13, "O"), (14, 20, "R"), (21, 22, "O"), (23, 27, "A"), (28, 28, "O")],
    21: [(15, 15, "O"), (16, 21, "R"), (22, 22, "O"), (23, 28, "A"), (29, 29, "O")],
    22: [(17, 17, "O"), (18, 22, "R"), (23, 23, "O")],
    23: [(19, 19, "O"), (20, 23, "R"), (24, 24, "O")],
    24: [(21, 21, "O"), (22, 23, "R"), (24, 24, "O"), (25, 28, "A"), (29, 29, "O")],
    25: [(23, 24, "O"), (25, 27, "A"), (28, 28, "O")],
}


def check(rows, name):
    assert len(rows) == 32, f"{name}: {len(rows)} rows"
    for i, r in enumerate(rows):
        assert len(r) == 32, f"{name} row {i}: len {len(r)}"
    # >=2px margin on all sides
    assert all(c == "." for r in rows[:2] + rows[30:] for c in r), f"{name}: top/bottom margin"
    assert all(r[0] == "." and r[1] == "." and r[30] == "." and r[31] == "." for r in rows), f"{name}: side margin"


def render(rows):
    im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                px[x, y] = PALETTE[ch] + (255,)
    return im


def main():
    import os
    outdir = os.path.dirname(os.path.abspath(__file__))
    result = {}
    for name, seg in (("A", SEG_A), ("B", SEG_B)):
        rows = rows_from_segments(seg)
        check(rows, name)
        result[name] = rows
        im = render(rows)
        im.save(f"{outdir}/fish-shell-homage-{name}-32.png")
        big = im.resize((256, 256), Image.NEAREST)
        s26 = im.resize((26, 26), Image.NEAREST)
        s16 = im.resize((16, 16), Image.NEAREST)
        comp = Image.new("RGBA", (256 + 26 + 16 + 20, 256), (30, 30, 40, 255))
        comp.paste(big, (0, 0))
        comp.paste(s26, (256 + 5, 0))
        comp.paste(s16, (256 + 5 + 26 + 5, 0))
        comp.save(f"{outdir}/fish-shell-homage-{name}-qc.png")
        colors = {}
        for r in rows:
            for ch in r:
                if ch != ".":
                    colors[ch] = colors.get(ch, 0) + 1
        print(name, "pixels:", sum(colors.values()), "by colour:", colors)
        print(f"--- {name} rows ---")
        for r in rows:
            print(r)
    with open(f"{outdir}/fish-shell-homage-rows.json", "w") as f:
        json.dump({"A": result["A"], "B": result["B"],
                   "palette": {k: "#%02X%02X%02X" % v for k, v in PALETTE.items()}}, f, indent=1)
    print("ok")


if __name__ == "__main__":
    main()
