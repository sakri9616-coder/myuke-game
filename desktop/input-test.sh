#!/bin/bash
# Phase 2: OS全体の入力集計の Xvfb 実測。
#  Run A (既定OFF): 合成入力を飛ばしてもリスナーは起動せず、flush が1行も出ないこと。
#  Run B (設定ON): localStorage のセーブに inputCount=true を仕込んで起動し、
#    xdotool の合成入力（打鍵・移動・クリック）が集計ログにほぼ一致して出ること。
export DISPLAY=:99
CFG=/tmp/miyuke-input-config
DATA=/tmp/miyuke-input-data
ILOG=$CFG/jp.muse.miyuke/miyuke-input-debug.log
BIN=~/workspace/miyuke-game/desktop/src-tauri/target/release/miyuke

pkill -f "target/release/[m]iyuke" 2>/dev/null; pkill -f "[X]vfb :99" 2>/dev/null; sleep 1
rm -rf $CFG $DATA; mkdir -p $CFG $DATA
Xvfb :99 -screen 0 1280x960x24 > /tmp/xvfb-input.log 2>&1 &
sleep 2

start_app(){
  DISPLAY=:99 XDG_CONFIG_HOME=$CFG XDG_DATA_HOME=$DATA MIYUKE_DEBUG_INPUT=1 \
    WEBKIT_DISABLE_DMABUF_RENDERER=1 LIBGL_ALWAYS_SOFTWARE=1 \
    dbus-run-session -- "$BIN" > /tmp/miyuke-input-run.log 2>&1 &
}
stop_app(){ pkill -f "target/release/[m]iyuke" 2>/dev/null; sleep 1; }

drive_input(){
  # 打鍵40回（"a" 40字）、矩形パス移動（400+300+400+300 = 1400px）、クリック3回
  xdotool type --delay 30 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  sleep 1
  xdotool mousemove 100 100
  for x in 200 300 400 500; do xdotool mousemove $x 100; done
  for y in 200 300 400; do xdotool mousemove 500 $y; done
  for x in 400 300 200 100; do xdotool mousemove $x 400; done
  for y in 300 200 100; do xdotool mousemove 100 $y; done
  sleep 1
  xdotool mousemove 640 100 click 1; sleep 1
  xdotool mousemove 640 100 click 1; sleep 1
  xdotool mousemove 640 100 click 1
}

echo "===== Run A: default OFF ====="
start_app
sleep 14
pgrep -f "target/release/[m]iyuke" > /dev/null && echo "APP_ALIVE" || echo "APP_NOT_RUNNING"
drive_input
sleep 8   # flush 周期(5s)を跨ぐ
echo "--- input debug log (Run A) ---"
cat $ILOG 2>/dev/null || echo "(no log)"
grep -q "listener=started" $ILOG && echo "FAIL: listener started while OFF" || echo "OK: listener never started"
grep -q "flush" $ILOG && echo "FAIL: flush while OFF" || echo "OK: no flush while OFF"
stop_app

echo "===== seed save with inputCount=true ====="
python3 - <<'EOF'
import sqlite3, glob, json, sys
cands = glob.glob('/tmp/miyuke-input-data/**/localstorage/*.localstorage', recursive=True) \
      + glob.glob('/tmp/miyuke-input-data/**/localstorage.sqlite3', recursive=True) \
      + glob.glob('/tmp/miyuke-input-data/**/*.localstorage', recursive=True)
print("candidates:", cands)
done = False
for path in cands:
    try:
        con = sqlite3.connect(path)
        rows = con.execute("SELECT key, value FROM ItemTable").fetchall()
        for k, v in rows:
            if k == 'miyuke-save-v1':
                raw = v.decode('utf-16-le') if isinstance(v, bytes) else v
                data = json.loads(raw)
                data.setdefault('settings', {})['inputCount'] = True
                new = json.dumps(data, ensure_ascii=False).encode('utf-16-le')
                con.execute("UPDATE ItemTable SET value=? WHERE key=?", (new, k))
                con.commit()
                print("patched:", path)
                done = True
        con.close()
    except Exception as e:
        print("skip", path, e)
print("SEED_OK" if done else "SEED_FAILED")
sys.exit(0 if done else 1)
EOF

echo "===== Run B: setting ON ====="
: > $ILOG
start_app
sleep 14
pgrep -f "target/release/[m]iyuke" > /dev/null && echo "APP_ALIVE" || echo "APP_NOT_RUNNING"
drive_input
sleep 8
echo "--- input debug log (Run B) ---"
cat $ILOG 2>/dev/null || echo "(no log)"
stop_app
pkill -f "[X]vfb :99" 2>/dev/null
echo "INPUT_TEST_DONE"
