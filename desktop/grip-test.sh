#!/bin/bash
# ◥ グリップのドラッグ移動 + ウォッチャ経由の位置保存 + 再起動復元を検証する (WM 必須)
set -u
BIN=~/workspace/miyuke-game/desktop/src-tauri/target/release/miyuke
export DISPLAY=:99
if ! xdpyinfo -display :99 >/dev/null 2>&1; then Xvfb :99 -screen 0 1600x900x24 >/tmp/xvfb.log 2>&1 & sleep 2; fi
pkill -x miyuke 2>/dev/null; pkill -x openbox 2>/dev/null; sleep 1
HOME_TEST=/tmp/miyuke-grip-home
rm -rf "$HOME_TEST"; mkdir -p "$HOME_TEST"
HOME=$HOME_TEST nohup openbox > /tmp/openbox.log 2>&1 &
sleep 2
stripwin() { for w in $(xdotool search "" 2>/dev/null); do g=$(xdotool getwindowgeometry $w 2>/dev/null); echo "$g" | grep -q "1600x266" && { echo "$w"; return; }; done; }
stripgeom() { local w=$(stripwin); [ -n "$w" ] && xdotool getwindowgeometry $w 2>/dev/null | tr '\n' ' '; echo; }
HOME=$HOME_TEST nohup "$BIN" > /tmp/miyuke-grip.log 2>&1 &
sleep 6
echo "boot: $(stripgeom)"
echo "--- grip drag up to y=470"
xdotool mousemove 1400 760; sleep 0.2; xdotool mousemove 1583 702; sleep 0.4
xdotool mousedown 1; sleep 0.4
for y in 665 625 585 545 505 470; do xdotool mousemove 1583 $y; sleep 0.2; done
sleep 0.3; xdotool mouseup 1; sleep 1
echo "after drag: $(stripgeom)"
echo "--- wait 4s for geom watcher to persist"
sleep 4
echo "settings: $(cat "$HOME_TEST/.config/jp.muse.miyuke/miyuke-shell.json" 2>/dev/null)"
pkill -x miyuke 2>/dev/null; sleep 2
echo "--- relaunch (expect strip restored at dragged y)"
HOME=$HOME_TEST nohup "$BIN" > /tmp/miyuke-grip2.log 2>&1 &
sleep 6
echo "relaunch: $(stripgeom)"
pkill -x miyuke 2>/dev/null; pkill -x openbox 2>/dev/null
