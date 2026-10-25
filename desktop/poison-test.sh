#!/bin/bash
# 保存済みメニュー形状に「毒」形状を seed して、ひらくでどう開くかを検証する
# 引数 $1 = full 形状 JSON / $2 = 期待する Position "x,y" / $3 = ラベル
set -u
BIN=~/workspace/miyuke-game/desktop/src-tauri/target/release/miyuke
export DISPLAY=:99
if ! xdpyinfo -display :99 >/dev/null 2>&1; then Xvfb :99 -screen 0 1600x900x24 >/tmp/xvfb.log 2>&1 & sleep 2; fi
pkill -x miyuke 2>/dev/null; sleep 1
HOME_TEST=/tmp/miyuke-poison-home
rm -rf "$HOME_TEST"; mkdir -p "$HOME_TEST/.config/jp.muse.miyuke"
cat > "$HOME_TEST/.config/jp.muse.miyuke/miyuke-shell.json" <<JSON
{"mode":"strip","aot_full":false,"full":$1,"strip":{"x":0,"y":0,"w":0,"h":0,"set":false}}
JSON
HOME=$HOME_TEST nohup "$BIN" > /tmp/miyuke-poison.log 2>&1 &
sleep 6
xdotool mousemove 1233 810; sleep 0.2; xdotool mousemove 1403 852; sleep 0.2; xdotool mousemove 1493 870; sleep 0.3
xdotool mousedown 1; sleep 0.35; xdotool mouseup 1
sleep 3
MENU=""
for w in $(xdotool search "" 2>/dev/null); do g=$(xdotool getwindowgeometry $w 2>/dev/null); echo "$g" | grep -q "1180x860" && MENU="$g"; done
POS=$(echo "$MENU" | grep -o "Position: [0-9-]*,[0-9-]*" | head -1 | sed 's/Position: //')
if [ "$POS" = "$2" ]; then echo "POISON[$3]: PASS (menu at $POS)"; else echo "POISON[$3]: FAIL (menu at '$POS', expected '$2')"; fi
pkill -x miyuke 2>/dev/null; sleep 1
