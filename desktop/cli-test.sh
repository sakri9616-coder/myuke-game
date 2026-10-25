#!/bin/bash
# 実バイナリ CLI テストハーネス (sakuri の指示 2026-10-25: コードでなく実機で検証する)
# Xvfb 上で本物のバイナリを起動し、xdotool で実際にクリックして窓の出現を assert する。
# 使い方: bash desktop/cli-test.sh [check ...]   (既定: hiraku board)
#   hiraku : 帯の「ひらく」ボタンを押し、管理ウィンドウ (1180x860) が出ること
#   board  : プロジェクトボードを押し、管理ウィンドウが出ること
# 終了コード: 0 = 全 assert 通過 / 1 = 失敗あり
set -u
BIN=~/workspace/miyuke-game/desktop/src-tauri/target/release/miyuke
DISP=:99
export DISPLAY=$DISP
W=1600; H=900
HOME_TEST=/tmp/miyuke-clitest-home
LOG=/tmp/miyuke-clitest.log
FAIL=0

# Xvfb が無ければ起こす
if ! xdpyinfo -display $DISP >/dev/null 2>&1; then
  Xvfb $DISP -screen 0 ${W}x${H}x24 >/tmp/xvfb-clitest.log 2>&1 &
  sleep 2
fi
# 既存の実機テスト用プロセスを掃除 (pkill -x: 自分のコマンドラインに同名を含んでも自滅しない)
pkill -x miyuke 2>/dev/null; sleep 1

rm -rf "$HOME_TEST"; mkdir -p "$HOME_TEST"
HOME=$HOME_TEST nohup "$BIN" > "$LOG" 2>&1 &
APP_PID=$!

windows() { # 全ウィンドウのジオメトリを列挙
  for w in $(xdotool search "" 2>/dev/null); do xdotool getwindowgeometry $w 2>/dev/null; done
}
wait_geom() { # $1=geometry 文字列, $2=timeout秒
  local g=$1 t=${2:-10} i=0
  while [ $i -lt $((t*2)) ]; do
    windows | grep -q "$g" && return 0
    sleep 0.5; i=$((i+1))
  done
  return 1
}
# 人間らしいクリック: いきなりワープして押すと WebKitGTK が取りこぼす
# (実測: テレポート+即クリックは DOM click にならない。段階接近+ドウェルで通る)
click() {
  local tx=$1 ty=$2
  xdotool mousemove $((tx - 260)) $((ty - 60)); sleep 0.2
  xdotool mousemove $((tx - 90)) $((ty - 18)); sleep 0.2
  xdotool mousemove "$tx" "$ty"; sleep 0.3
  xdotool mousedown 1; sleep 0.35; xdotool mouseup 1
}

echo "[cli-test] strip を待つ..."
if wait_geom "${W}x210" 15; then echo "  OK strip ${W}x210"; else echo "  NG strip が出ない"; FAIL=1; fi
sleep 2

for check in "$@"; do :; done
[ $# -eq 0 ] && set -- hiraku board
for check in "$@"; do
  case "$check" in
    hiraku)
      # ひらくボタンの実測中心 (1600x900 時): (1374, 888) — 2026-10-25 v2.4.1 で再実測。
      # (1493,870) は旧レイアウトの値で、現行では缶バッジ行の右寄せでズレていた
      echo "[cli-test] ひらく をクリック ($(($W-226)), $(($H-12)))"
      click $(($W-226)) $(($H-12)); sleep 2
      if wait_geom "1180x860" 6; then echo "  OK 管理ウィンドウ出現"; else echo "  NG 管理ウィンドウが出ない"; FAIL=1; fi
      # 後片付け注意: xdotool windowclose は WM 無し環境で X ウィンドウを破壊し
      # アプリを BadDrawable で落とす。閉じずに次のチェックへ進む
      ;;
    board)
      echo "[cli-test] プロジェクトボードをクリック (480, $(($H-178)))"
      click 480 $(($H-178)); sleep 2
      if wait_geom "1180x860" 6; then echo "  OK 管理ウィンドウ出現 (board)"; else echo "  NG 管理ウィンドウが出ない (board)"; FAIL=1; fi
      ;;
  esac
done

echo "[cli-test] ログ末尾:"; tail -3 "$LOG"
kill $APP_PID 2>/dev/null
echo "[cli-test] RESULT: $([ $FAIL -eq 0 ] && echo ALL-PASS || echo FAILED)"
exit $FAIL
