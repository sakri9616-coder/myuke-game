#!/bin/bash
# みゅけ本体ゾーン単独ヒットの実測2: 机(<=500)でもHUD(>=925)でもない場所 (760,900) に
# ポインタを停め、散歩中のみゅけがそこへ来るのを待つ。ignore=false へ倒れたら本体ゾーンの証拠。
export DISPLAY=:99
CFG=/tmp/miyuke-hit-config
LOG=$CFG/jp.muse.miyuke/miyuke-hit-debug.log

pkill -f "^\./miyuke" 2>/dev/null; pkill -f "[X]vfb :99" 2>/dev/null; sleep 1
rm -rf $CFG; mkdir -p $CFG
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb-hit3.log 2>&1 &
sleep 2

cd ~/workspace/miyuke-game/desktop/src-tauri/target/release
DISPLAY=:99 XDG_CONFIG_HOME=$CFG MIYUKE_DEBUG_HIT=1 \
  WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
  dbus-run-session -- ./miyuke > /tmp/miyuke-hit3-run.log 2>&1 &
sleep 12
pgrep -f "^\./miyuke" > /dev/null && echo "APP_ALIVE" || echo "APP_NOT_RUNNING"

xdotool mousemove 760 900
echo "parked at (760,900) local=(760,150); waiting for Miyuke (max 75s)..."
HIT=""
for i in $(seq 1 15); do
  sleep 5
  if grep -q "cursor=(760,150) zones=3 ignore=false" $LOG 2>/dev/null; then HIT=1; echo "HIT after ~$((i*5))s"; break; fi
  import -window root ~/workspace/miyuke-game/hit-shot-wait.png 2>/dev/null
done
[ -z "$HIT" ] && echo "NO_HIT_IN_WINDOW"
import -window root ~/workspace/miyuke-game/hit-shot-parked.png 2>/dev/null && echo parkedShot ok
echo "--- transitions at the parked point ---"
grep "cursor=(760,150)" $LOG | grep -v " hb " || echo "(none)"
echo "--- heartbeats at the parked point (sample) ---"
grep "cursor=(760,150)" $LOG | head -4
pgrep -f "^\./miyuke" > /dev/null && echo "APP_STILL_ALIVE" || echo "APP_DIED"
pkill -f "^\./miyuke" 2>/dev/null; sleep 1; pkill -f "[X]vfb :99" 2>/dev/null
echo "PARK_DONE"
