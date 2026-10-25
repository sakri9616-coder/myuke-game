#!/bin/bash
# v2.4.0 実機検証: 帯サイズ変更 + 家具ドラッグ並べ替え + 永続化。
# 使い方: bash layout-test.sh <workdir>
# workdir 以下に HOME を隔離し、shot-*.png と result.txt を残す。
set -u
W="${1:?workdir required}"
BIN=~/workspace/miyuke-game/desktop/src-tauri/target/release/miyuke
export DISPLAY=:99
mkdir -p "$W/home"
export HOME="$W/home"
export XDG_CONFIG_HOME="$W/home/.config"
export XDG_DATA_HOME="$W/home/.local/share"

Xvfb :99 -screen 0 1600x900x24 >/dev/null 2>&1 &
XVFB_PID=$!
sleep 1
openbox >/dev/null 2>&1 &
sleep 1

windows(){ xdotool search --onlyvisible --name "" 2>/dev/null | while read -r id; do
  xdotool getwindowgeometry --shell "$id" 2>/dev/null | tr '\n' ' ' | sed "s/^/WIN $id /"; echo; done; }
strip_id(){
  xdotool search --onlyvisible --name "" 2>/dev/null | while read -r id; do
    g=$(xdotool getwindowgeometry --shell "$id" 2>/dev/null)
    w=$(echo "$g" | grep -oP 'WIDTH=\K[0-9]+'); h=$(echo "$g" | grep -oP 'HEIGHT=\K[0-9]+')
    if [ "${w:-0}" -ge 1000 ] && [ "${h:-0}" -ge 100 ] && [ "${h:-0}" -le 320 ]; then echo "$id"; return; fi
  done
}
shot(){ import -window root "$W/$1"; echo "SHOT $1"; }
click(){ # x y : ゆっくり近づいてクリック (DOM click を確実に発生させる)
  xdotool mousemove --sync $(($1 - 26)) $(($2 + 14)) sleep 0.15
  xdotool mousemove --sync $(($1 - 8)) $(($2 + 4)) sleep 0.15
  xdotool mousemove --sync $1 $2 sleep 0.25 click 1 sleep 0.3
}
drag(){ # x1 y1 x2 y2
  xdotool mousemove --sync $(($1 - 20)) $(($2 + 10)) sleep 0.15
  xdotool mousemove --sync $1 $2 sleep 0.3 mousedown 1 sleep 0.3
  for t in 1 2 3 4 5 6 7 8; do
    xdotool mousemove --sync $(( $1 + ($3 - $1) * t / 8 )) $(( $2 + ($4 - $2) * t / 8 )) sleep 0.12
  done
  xdotool mousemove --sync $3 $4 sleep 0.3 mouseup 1 sleep 0.4
}

"$BIN" > "$W/app.log" 2>&1 &
APP_PID=$!
sleep 6
SID=$(strip_id)
echo "STRIP_ID=$SID" | tee "$W/result.txt"
xdotool getwindowgeometry --shell "$SID" 2>/dev/null | tr '\n' ' ' >> "$W/result.txt"; echo >> "$W/result.txt"
shot shot-a-default.png

# 並べ替えモードへ (チップのおおよその位置: 右端から [かくす][ひらく][並べ替え])
click 1424 881
sleep 1
shot shot-b-editmode.png

# 棚 (中心 ≈ x=192, y=856) を x=700 へドラッグ
drag 192 856 700 856
sleep 1
shot shot-c-dragged.png

# 編集モードを抜ける (チップは同じ位置・ラベルは「✓ おわり」)
click 1424 881
sleep 0.6

# メニューを開いて設定タブで 85% を選ぶ
click 1497 881
sleep 2.5
shot shot-d-menu.png
echo "PHASE1_DONE" >> "$W/result.txt"
sleep 100000 &
wait
