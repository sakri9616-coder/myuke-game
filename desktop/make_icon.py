#!/usr/bin/env python3
"""みゅけのアイコンをドット絵で描く（ゲームのパレット使用・外部素材なし）。
32x32 グリッドで描いて 1024x1024 にニアレストネイバー拡大する。"""
from PIL import Image, ImageDraw

S = 32
TRANSPARENT = (0, 0, 0, 0)
WHITE = (255, 250, 242, 255)   # 毛並み（--panel 系）
ORANGE = (232, 135, 58, 255)   # 右耳＆ブチ（--accent）
INK = (58, 48, 40, 255)        # 黒ブチ・目（--ink 近似）
PINK = (242, 167, 187, 255)    # 鼻・耳の内側
GREEN = (90, 164, 105, 255)    # 首輪（--accent2）

img = Image.new("RGBA", (S, S), TRANSPARENT)
d = ImageDraw.Draw(img)


def ellipse(cx, cy, rx, ry, fill):
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)


def in_head(x, y):
    return ((x - 16) / 12.0) ** 2 + ((y - 18) / 11.0) ** 2 <= 1.0


# 耳（左=白、右=オレンジ）
d.polygon([(5, 11), (6, 2), (12, 8)], fill=WHITE)
d.polygon([(26, 11), (25, 2), (19, 8)], fill=ORANGE)
d.polygon([(7, 9), (7.5, 4.5), (10.5, 7.5)], fill=PINK)
d.polygon([(24, 9), (23.5, 4.5), (20.5, 7.5)], fill=PINK)

# 頭
ellipse(16, 18, 12, 11, WHITE)

# オレンジのブチ（頭の右上）
for y in range(S):
    for x in range(S):
        if in_head(x, y) and ((x - 24) / 5.5) ** 2 + ((y - 10) / 4.5) ** 2 <= 1.0:
            d.point((x, y), fill=ORANGE)

# 黒ブチ（左頬）
for y in range(S):
    for x in range(S):
        if in_head(x, y) and ((x - 5) / 2.6) ** 2 + ((y - 22) / 3.6) ** 2 <= 1.0:
            d.point((x, y), fill=INK)

# 目（縦長ドット＋ハイライト）
for (ex) in (10, 21):
    d.rectangle([ex, 15, ex + 1, 18], fill=INK)
d.point((10, 15), fill=WHITE)
d.point((21, 15), fill=WHITE)

# 鼻と口
d.rectangle([15, 20, 16, 20], fill=PINK)
d.point((15, 21), fill=INK)
d.point((16, 21), fill=INK)
d.point((14, 22), fill=INK)
d.point((17, 22), fill=INK)

# 首輪（緑）＋鈴（オレンジ）
for y in (27, 28):
    for x in range(S):
        if in_head(x, y):
            d.point((x, y), fill=GREEN)
d.rectangle([15, 28, 16, 29], fill=ORANGE)

big = img.resize((1024, 1024), Image.NEAREST)
big.save("/home/hatch/workspace/miyuke-game/desktop/icon-source.png")
print("wrote icon-source.png 1024x1024")
