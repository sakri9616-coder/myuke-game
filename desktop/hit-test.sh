#!/bin/bash
# ヒットゾーン式クリック透過の Xvfb 実測（MIYUKE_DEBUG_HIT=1 のログで切替を確認）
export DISPLAY=:99
CFG=/tmp/miyuke-hit-config
LOG=$CFG/jp.muse.miyuke/miyuke-hit-debug.log

pkill -f "^\./miyuke" 2>/dev/null; pkill -f "[X]vfb :99" 2>/dev/null; sleep 1
rm -rf $CFG; mkdir -p $CFG
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb-hit.log 2>&1 &
sleep 2

cd ~/workspace/miyuke-game/desktop/src-tauri/target/release
DISPLAY=:99 XDG_CONFIG_HOME=$CFG MIYUKE_DEBUG_HIT=1 \
  WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
  dbus-run-session -- ./miyuke > /tmp/miyuke-hit-run.log 2>&1 &
sleep 14

echo "--- process ---"
pgrep -f "^\./miyuke" > /dev/null && echo "APP_ALIVE" || echo "APP_NOT_RUNNING"
echo "--- window geometry ---"
xwininfo -root -tree 2>/dev/null | grep -i miyuke
echo "--- screenshot (initial) ---"
import -window root ~/workspace/miyuke-game/hit-shot-0.png 2>/dev/null && echo shot0 ok

dump_log(){ echo "--- debug log so far ---"; cat $LOG 2>/dev/null || echo "(no log yet)"; }

echo "== (a) park at far-left strip point (30,855) — expect ignore=true =="
xdotool mousemove 30 855
sleep 3
dump_log

echo "== (b) park on desk zone (384,935) — expect ignore=false =="
xdotool mousemove 384 935
sleep 2
import -window root ~/workspace/miyuke-game/hit-shot-b.png 2>/dev/null && echo shotB ok
dump_log

echo "== (b2) park on miyuke-at-desk spot (405,880) =="
xdotool mousemove 405 880
sleep 2
dump_log

echo "== (c) park mid-screen outside window (640,200) — no crash, sane state =="
xdotool mousemove 640 200
sleep 2
pgrep -f "^\./miyuke" > /dev/null && echo "APP_STILL_ALIVE" || echo "APP_DIED"
dump_log

echo "== (d) back into desk zone (384,935) — loop still toggling =="
xdotool mousemove 384 935
sleep 2
dump_log

echo "--- app run log (head) ---"
head -5 /tmp/miyuke-hit-run.log
pkill -f "^\./miyuke" 2>/dev/null; sleep 1; pkill -f "[X]vfb :99" 2>/dev/null
echo "HIT_TEST_DONE"
