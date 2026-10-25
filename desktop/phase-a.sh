#!/bin/bash
# Phase A: apt再導入 → アプリ起動計測（このVMは再起動で /usr が戻るため一括実行する）
LOG=~/workspace/miyuke-game/desktop/phase-a.log
exec > "$LOG" 2>&1
set -x

printf 'Acquire::Languages "none";\n' | sudo -n tee /etc/apt/apt.conf.d/99-no-languages >/dev/null
sudo -n mv /etc/apt/sources.list.d/nodesource.sources /etc/apt/sources.list.d/nodesource.sources.disabled 2>/dev/null
APTOPT="-o Acquire::http::Timeout=30 -o Acquire::https::Timeout=30 -o Acquire::Retries=2"
sudo -n apt-get update -qq $APTOPT
echo "UPDATE_EXIT=$?"
sudo -n apt-get install -y -qq $APTOPT libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev build-essential curl wget file libssl-dev libxdo-dev pkg-config xvfb nsis clang lld llvm libclang-dev zip
echo "INSTALL_EXIT=$?"
ls /usr/lib/x86_64-linux-gnu/libgtk-3.so /usr/lib/x86_64-linux-gnu/libwebkit2gtk-4.1.so && echo "DEVLIBS_OK"

# ---- 起動計測 ----
pkill -f "[X]vfb :99" 2>/dev/null; pkill -f "target/release/[m]iyuke" 2>/dev/null; sleep 1
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb.log 2>&1 &
sleep 2
cd ~/workspace/miyuke-game/desktop/src-tauri/target/release
DISPLAY=:99 WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 dbus-run-session -- ./miyuke > /tmp/miyuke-run.log 2>&1 &
sleep 15

MAINPID=$(pgrep -f "^\./miyuke" | head -1)
echo "MAINPID=$MAINPID"
ps -eo pid,ppid,rss,comm | grep -E "miyuke|WebKit" | grep -v grep

# CPU: プロセスツリー合計の utime+stime を10秒間隔で
tree_ticks() {
  local total=0 pid ticks
  for pid in $(pgrep -f "^\./miyuke|WebKitWebProcess|WebKitNetworkProcess"); do
    ticks=$(awk '{print $14+$15}' /proc/$pid/stat 2>/dev/null) && total=$((total + ticks))
  done
  echo $total
}
T1=$(tree_ticks); sleep 10; T2=$(tree_ticks)
echo "tree CPU ticks in 10s: $((T2-T1)) (100 ticks = 1 core-second => idle CPU % of one core = ticks/10)"
RSS_TOTAL=$(ps -eo rss,comm | grep -E "miyuke|WebKit" | awk '{s+=$1} END {print s}')
echo "tree RSS total KB: $RSS_TOTAL"
ls -la ~/.local/share/jp.muse.miyuke/localstorage/ 2>/dev/null
head -5 /tmp/miyuke-run.log

kill $MAINPID 2>/dev/null; sleep 1; pkill -f "[X]vfb :99" 2>/dev/null
echo "PHASE_A_DONE"
