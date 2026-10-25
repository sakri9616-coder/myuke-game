#!/bin/bash
# 起動計測のみ（apt済みの前提）。結果は標準出力へ。
pkill -f "[X]vfb :99" 2>/dev/null; pkill -f "target/release/[m]iyuke" 2>/dev/null; sleep 1
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb.log 2>&1 &
sleep 2
cd ~/workspace/miyuke-game/desktop/src-tauri/target/release
DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 dbus-run-session -- ./miyuke > /tmp/miyuke-run.log 2>&1 &
sleep 15
MAINPID=$(pgrep -f "^\./miyuke" | head -1)
echo "MAINPID=$MAINPID"
echo "--- ps (RSS KB) ---"
ps -eo pid,ppid,rss,comm | grep -E "miyuke|WebKit" | grep -v grep
tree_ticks() {
  local total=0 pid ticks
  for pid in $(pgrep -f "^\./miyuke|WebKitWebProcess|WebKitNetworkProcess"); do
    ticks=$(awk '{print $14+$15}' /proc/$pid/stat 2>/dev/null) && total=$((total + ticks))
  done
  echo $total
}
T1=$(tree_ticks); sleep 10; T2=$(tree_ticks)
echo "TREE_CPU_TICKS_10S=$((T2-T1))"
RSS_TOTAL=$(ps -eo rss,comm | grep -E "miyuke|WebKit" | awk '{s+=$1} END {print s}')
echo "TREE_RSS_TOTAL_KB=$RSS_TOTAL"
echo "--- localstorage ---"
ls -la ~/.local/share/jp.muse.miyuke/localstorage/ 2>/dev/null
echo "--- run log ---"
head -5 /tmp/miyuke-run.log
[ -n "$MAINPID" ] && kill $MAINPID 2>/dev/null
sleep 1; pkill -f "[X]vfb :99" 2>/dev/null
echo "MEASURE_DONE"
