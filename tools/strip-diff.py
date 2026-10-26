#!/usr/bin/env python3
"""strip-diff.py — 帯スクリーンショット2枚のピクセル差分を測る検証ツール（ゲーム本体には触れない）。

使い方:
    python3 tools/strip-diff.py --a=BASE.png --b=NEW.png [--out=DIFF.png] [--tolerance=8]

出力:
    STRIP_DIFF <a> vs <b>: changed=<px> (<pct>%) bbox=<x0,y0,x1,y1 or none>
    終了コード 0 = 比較できた（差分の大小は問わない。ゲート判定は呼び出し側が行う）

仕様ノート:
  - PIL のみ依存（import-sakuri-art.py と同じ系統）。pixelmatch 等の外部ツールは不要。
  - 差分ピクセル = いずれかのチャンネル差が tolerance を超えたもの。アンチエイリアスや
    圧縮ノイズではなく「絵・家具・文字の有無」レベルの変化を拾うための閾値。
  - --out を渡すと差分箇所を赤で塗った画像を出す（これは検証用の差分図であって
    ゲームアートではない。スクリプトによるゲームアート生成の禁止には当たらない）。
  - サイズが違う場合は比較できず終了コード 2（verify-all 側は WARNING 扱いにする）。
  - 帯はアニメーションする（コーディングの手・吹き出し等）ため、同一条件の再撮影でも
    0% にはならない。閾値の目安は tools/strip-baselines/README.md に実測を残すこと。
"""
import argparse
import sys

from PIL import Image


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--a", required=True, help="baseline PNG")
    ap.add_argument("--b", required=True, help="new PNG")
    ap.add_argument("--out", default=None, help="diff-highlight PNG (optional)")
    ap.add_argument("--tolerance", type=int, default=8)
    args = ap.parse_args()

    try:
        ia = Image.open(args.a).convert("RGB")
        ib = Image.open(args.b).convert("RGB")
    except Exception as e:  # noqa: BLE001 - tool output must stay one line
        print(f"STRIP_DIFF ERROR cannot open images: {e}")
        return 2
    if ia.size != ib.size:
        print(f"STRIP_DIFF ERROR size mismatch: {args.a}={ia.size} vs {args.b}={ib.size}")
        return 2

    pa = ia.load()
    pb = ib.load()
    w, h = ia.size
    tol = args.tolerance
    changed = 0
    min_x, min_y, max_x, max_y = w, h, -1, -1
    diff_img = None
    if args.out:
        diff_img = Image.new("RGB", (w, h), (0, 0, 0))
        pd = diff_img.load()
    for y in range(h):
        for x in range(w):
            ra, ga, ba = pa[x, y]
            rb, gb, bb = pb[x, y]
            if abs(ra - rb) > tol or abs(ga - gb) > tol or abs(ba - bb) > tol:
                changed += 1
                if x < min_x:
                    min_x = x
                if x > max_x:
                    max_x = x
                if y < min_y:
                    min_y = y
                if y > max_y:
                    max_y = y
                if diff_img is not None:
                    pd[x, y] = (255, 0, 0)
            elif diff_img is not None:
                # 差分なし箇所は新画像を暗くして残し、赤い差分が目立つようにする
                pd[x, y] = (rb // 4, gb // 4, bb // 4)
    total = w * h
    pct = 100.0 * changed / total if total else 0.0
    bbox = "none" if changed == 0 else f"{min_x},{min_y},{max_x},{max_y}"
    print(f"STRIP_DIFF {args.a} vs {args.b}: changed={changed} ({pct:.3f}%) bbox={bbox} size={w}x{h}")
    if diff_img is not None:
        diff_img.save(args.out)
        print(f"STRIP_DIFF out={args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
