#!/bin/bash
# みゅけ本体ゾーン単独ヒットの実測: 帯を横にスイープし、机・HUD の範囲外で
# inside=true になったら、それは歩き回るみゅけ自身のゾーンに当たった証拠になる
export DISPLAY=:99
CFG=/tmp/miyuke-hit-config
LOG=$CFG/jp.muse.miyuke/miyuke-hit-debug.log

pkill -f "^\./miyuke" 2>/dev/null; pkill -f "[X]vfb :99" 2>/dev/null; sleep 1
rm -rf $CFG; mkdir -p $CFG
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb-hit2.log 2>&1 &
sleep 2

cd ~/workspace/miyuke-game/desktop/src-tauri/target/release
DISPLAY=:99 XDG_CONFIG_HOME=$CFG MIYUKE_DEBUG_HIT=1 \
  WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
  dbus-run-session -- ./miyuke > /tmp/miyuke-hit2-run.log 2>&1 &
sleep 12
pgrep -f "^\./miyuke" > /dev/null && echo "APP_ALIVE" || echo "APP_NOT_RUNNING"

# 起動直後の挨拶バブルが消えるまで待ってからスイープ（ゾーンを みゅけ/机/HUD のみに）
sleep 6
import -window root ~/workspace/miyuke-game/hit-shot-sweep0.png 2>/dev/null && echo sweepShot0 ok

for pass in 1 2; do
  for x in 80 160 240 320 400 480 560 640 720 800 880 960 1040 1120 1200; do
    xdotool mousemove $x 900
    sleep 0.7
  done
done
import -window root ~/workspace/miyuke-game/hit-shot-sweep1.png 2>/dev/null && echo sweepShot1 ok
sleep 1

echo "--- transitions ---"
grep -v " hb " $LOG
echo "--- inside=true heartbeats OUTSIDE desk(x 270..500) and HUD(x>=925) x-ranges (=> Miyuke herself) ---"
grep " hb " $LOG | grep "inside=true" | awk '{
  for(i=1;i<=NF;i++){ if($i ~ /^cursor=/){ print; break } }
}' | grep -vE "cursor=\((2[7-9][0-9]|3[0-9]{2}|4[0-9]{2}|500|9[3-9][0-9]|1[0-2][0-9]{2})," | head -10
echo "--- all inside=true heartbeats (sample) ---"
grep "inside=true" $LOG | head -6
pgrep -f "^\./miyuke" > /dev/null && echo "APP_STILL_ALIVE" || echo "APP_DIED"
pkill -f "^\./miyuke" 2>/dev/null; sleep 1; pkill -f "[X]vfb :99" 2>/dev/null
echo "SWEEP_DONE"
