#!/bin/bash
# 2ウィンドウ化の回帰チェック（設計 research/TWO_WINDOW_ARCHITECTURE.md §7）:
# 管理ウィンドウ（menu）を開いても帯（main）が「消えない」ことを実機バイナリで
# 画素レベル＋ウィンドウ形状で確かめる。手順:
#   1. 帯だけの状態: 帯ウィンドウ (画面幅x210, 底辺) があり、menu は未生成
#   2. 帯 HUD の「ひらく」をクリック → menu が生成され、帯はそのまま残る
#   3. 開いた状態でも帯のピクセルが残っている（menu に覆われない帯の両脇で比較）
#   4. メニューの「デスクトップに戻す」をクリック → menu は破棄されず hide される
#   5. 閉じた後も帯が生きている（時間を空けた2枚で差分が出る）
# 注意: この環境では X のロケール都合でウィンドウ名の検索 (xdotool search --name /
# xwininfo のタイトル grep) が UTF-8 変換に失敗して使えない。検出はすべて
# xwininfo の形状 (WxH+X+Y)・Map State・スクリーンショットの画素で行う。
# 前提: リリースビルド済み (src-tauri/target/release/miyuke)、Xvfb/xdotool/
# ImageMagick、xwininfo が使えること。hit-test.sh と同じ環境変数系。
set -u
cd "$(dirname "$0")/src-tauri" || exit 1

export CFG=$(mktemp -d /tmp/miyuke-twcfg.XXXXXX)
export XDG_CONFIG_HOME=$CFG XDG_DATA_HOME=$CFG-data
export DISPLAY=:99
export WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1
export MIYUKE_DEBUG_HIT=1
BIN=./target/release/miyuke
SHOTDIR=$(mktemp -d /tmp/miyuke-twshot.XXXXXX)
FAIL=0
SW=1600; SH=1200; BAND_Y=$((SH - 210))

cleanup() {
  pkill -x miyuke 2>/dev/null
  sleep 1
  pkill Xvfb 2>/dev/null
}
trap cleanup EXIT
pkill -x miyuke 2>/dev/null; pkill Xvfb 2>/dev/null; sleep 1

Xvfb :99 -screen 0 ${SW}x${SH}x24 >/dev/null 2>&1 &
sleep 2
dbus-run-session -- $BIN >/dev/null 2>&1 &
sleep 14   # 帯の描画とヒットゾーン送信が安定するまで

shot() { import -window root "$SHOTDIR/$1.png" 2>/dev/null; }
bright() { # $1=shot $2=crop → 明るいピクセル率%
  convert "$SHOTDIR/$1.png" -crop "$2" +repage -colorspace Gray \
    -threshold 12% -format "%[fx:mean*100]" info: 2>/dev/null
}
sidecols() { # $1=shot $2=out: 帯の両脇カラム (menu が覆わない領域) を横に並べた画像を作る
  convert "$SHOTDIR/$1.png" -crop 180x210+0+$BAND_Y +repage "$SHOTDIR/$2-l.png"
  convert "$SHOTDIR/$1.png" -crop 180x210+$((SW-180))+$BAND_Y +repage "$SHOTDIR/$2-r.png"
  convert "$SHOTDIR/$2-l.png" "$SHOTDIR/$2-r.png" +append "$SHOTDIR/$2.png"
}
winlist() { # 子ウィンドウを "id W H X Y" で列挙する
  xwininfo -root -tree 2>/dev/null | awk '
    match($0, /0x[0-9a-f]+/) {
      id = substr($0, RSTART, RLENGTH);
      if (match($0, /[0-9]+x[0-9]+\+[0-9]+\+[0-9]+/)) {
        g = substr($0, RSTART, RLENGTH);
        split(g, a, /[x+]/);
        print id, a[1], a[2], a[3], a[4];
      }
    }'
}
strip_geom() { winlist | awk -v w=$SW -v y=$BAND_Y '$2==w && $3==210 && $5==y {print; exit}'; }
menu_id()    { winlist | awk '$2>=700 && $3>=500 {print $1; exit}'; }
menu_geom()  { winlist | awk '$2>=700 && $3>=500 {print $2"x"$3"+"$4"+"$5; exit}'; }
mapstate()   { xwininfo -id "$1" 2>/dev/null | grep -oE "IsViewable|IsUnMapped" | head -1; }
center_px()  { convert "$SHOTDIR/$1.png" -format "%[pixel:p{800,300}]" info: 2>/dev/null; }

echo "== step1: strip only =="
shot s1
SG=$(strip_geom)
A=$(bright s1 "${SW}x210+0+$BAND_Y")
echo "strip window = [$SG] ; band bright% = $A ; menu id = [$(menu_id)]"
[ -n "$SG" ] && echo "OK: strip window is ${SW}x210 at bottom" || { echo "NG: strip window shape wrong"; FAIL=1; }
awk "BEGIN{exit !($A > 0.3)}" && echo "OK: strip pixels present before" || { echo "NG: strip missing before"; FAIL=1; }
[ -z "$(menu_id)" ] && echo "OK: menu not created yet (lazy creation)" || { echo "NG: menu exists before open"; FAIL=1; }

echo "== step2: click ひらく (HUD) =="
# HUD は帯の右下: [節目チップ][コイン][ひらく][かくす]。ひらくの中心あたり
xdotool mousemove 1488 $((SH - 21))
sleep 1.5   # ヒットゾーンで透過が解除されるのを待つ
xdotool click 1
sleep 5
MID=$(menu_id); MG=$(menu_geom)
echo "menu id = [$MID] geom = [$MG] mapstate = [$(mapstate "$MID")]"
[ -n "$MID" ] && echo "OK: menu window created" || { echo "NG: menu did not appear"; FAIL=1; }
[ "$(mapstate "$MID")" = "IsViewable" ] && echo "OK: menu is viewable" || { echo "NG: menu not viewable"; FAIL=1; }
[ -n "$(strip_geom)" ] && echo "OK: strip window still exists (never morphed)" || { echo "NG: strip window GONE"; FAIL=1; }

echo "== step3: strip persists while menu open =="
shot s2
B=$(bright s2 "${SW}x210+0+$BAND_Y")
sidecols s1 sc1; sidecols s2 sc2
D=$(compare -metric AE -fuzz 8% "$SHOTDIR/sc1.png" "$SHOTDIR/sc2.png" null: 2>&1)
SIDE_TOT=$((180 * 210 * 2))
CPX=$(center_px s2)
echo "band bright% during = $B ; side-columns changed = $D / $SIDE_TOT ; center px = $CPX"
awk "BEGIN{exit !($B > 0.3)}" && echo "OK: strip pixels present during" || { echo "NG: STRIP DISAPPEARED while menu open"; FAIL=1; }
awk "BEGIN{exit !($D < $SIDE_TOT * 0.05)}" && echo "OK: uncovered strip area unchanged" || { echo "NG: strip area changed too much"; FAIL=1; }
[ "$CPX" != "srgb(0,0,0)" ] && echo "OK: menu content visible at center" || { echo "NG: menu content not visible"; FAIL=1; }

echo "== step4: close menu via デスクトップに戻す =="
MW=$(echo "$MG" | awk -F'[x+]' '{print $1}'); MX=$(echo "$MG" | awk -F'[x+]' '{print $3}'); MY=$(echo "$MG" | awk -F'[x+]' '{print $4}')
BX=$((MX + MW - 135)); BY=$((MY + 27))   # ヘッダ右上の赤ボタン中心 (実測較正済み)
echo "click back at ($BX,$BY) from menu geom $MG"
xdotool mousemove "$BX" "$BY"
sleep 0.7
xdotool click 1
sleep 2.5
shot s2b
MS=$(mapstate "$MID"); CPX2=$(center_px s2b)
echo "menu mapstate after close = [$MS] ; center px = $CPX2"
[ "$MS" = "IsUnMapped" ] && echo "OK: menu hidden (not destroyed - reused lifecycle)" || { echo "NG: menu not hidden"; FAIL=1; }
[ "$CPX2" = "srgb(0,0,0)" ] && echo "OK: menu content gone from screen" || { echo "NG: menu still painted"; FAIL=1; }
[ -n "$(strip_geom)" ] && echo "OK: strip window still exists after close" || { echo "NG: strip window GONE after close"; FAIL=1; }

echo "== step5: strip alive after close =="
shot s3
sleep 3
shot s4
D2=$(compare -metric AE -fuzz 8% \
  <(convert "$SHOTDIR/s3.png" -crop ${SW}x210+0+$BAND_Y +repage png:-) \
  <(convert "$SHOTDIR/s4.png" -crop ${SW}x210+0+$BAND_Y +repage png:-) null: 2>&1)
C=$(bright s4 "${SW}x210+0+$BAND_Y")
echo "band bright% after = $C ; band changed pixels over 3s = $D2"
awk "BEGIN{exit !($C > 0.3)}" && echo "OK: strip pixels present after" || { echo "NG: strip missing after"; FAIL=1; }
awk "BEGIN{exit !($D2 > 20)}" && echo "OK: strip is alive (animation/movement)" || echo "WARN: band static over 3s (sleeping state?)"

echo "shots: $SHOTDIR (s1=before s2=menu-open s2b/s3/s4=after-close)"
echo "config kept at: $CFG"
if [ "$FAIL" -eq 0 ]; then echo "TWO-WINDOW TEST: ALL OK"; else echo "TWO-WINDOW TEST: FAILED"; fi
exit $FAIL
