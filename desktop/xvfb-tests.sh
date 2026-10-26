#!/bin/bash
# desktop/ の Xvfb 実機テスト一回物を束ねる単一入口。
# 従来は事件ごとに生まれた 11 本のスクリプトを個別に探す必要があったため、
# list / check / run をここに集約する。元スクリプト自体は一切変更しない。
#
# 使い方:
#   bash desktop/xvfb-tests.sh list
#   bash desktop/xvfb-tests.sh check        # 実行せず、存在・構文・前提だけ確認
#   bash desktop/xvfb-tests.sh run <name> [args...]
#   bash desktop/xvfb-tests.sh run cli-test hiraku board
#
# 注意:
# - run は対象スクリプトをそのまま実行する。各スクリプトは Xvfb :99 を起こし、
#   実行中の miyuke プロセスを pkill するため、作業中の実機テストとは併用しないこと。
# - phase-a は apt 再導入（sudo）を含むセットアップ手順のため、run の対象外。
#   list / check には載るが run は拒否する。必要な場合は元スクリプトを直接実行すること。
# - verify-all.sh には接続しない。Xvfb 実機テストは重く環境依存のため、
#   任意実行の入口として残す（HARNESS_AUDIT 推奨#7 の「束ねる」まで。自動化は別途検討）。
set -u
cd "$(dirname "$0")" || exit 1

BIN="src-tauri/target/release/miyuke"

# name | file | args | purpose
TESTS=(
  "hit|hit-test.sh||ヒットゾーン式クリック透過の実測（帯の空き領域は ignore=true）"
  "hit2|hit-test2.sh||みゅけ本体ゾーン単独ヒットの実測（帯スイープ）"
  "hit3|hit-test3.sh||みゅけ本体ゾーン単独ヒットの実測2（定点待機）"
  "grip|grip-test.sh||◥グリップのドラッグ移動＋位置保存＋再起動復元（WM 必須）"
  "poison|poison-test.sh|<full-json> <期待位置x,y> <ラベル>|毒メニュー形状 seed 時のひらく開き位置"
  "layout|layout-test.sh|<workdir>|帯サイズ変更＋家具ドラッグ並べ替え＋永続化（v2.4.0 実機検証）"
  "cli|cli-test.sh|[check ...]|実バイナリ CLI テスト（既定: hiraku board）"
  "two-window|two-window-test.sh||2ウィンドウ化の回帰チェック（帯が消えないこと）"
  "input|input-test.sh||Phase 2 OS入力集計の実測（OFF 無出力／ON 集計一致）"
  "measure|measure-run.sh||起動計測のみ（apt 済み前提、CPU・RSS）"
  "phase-a|phase-a.sh|（run 対象外）|apt 再導入→起動計測のセットアップ手順（sudo を含むため直接実行のみ）"
)

field() { # $1=行 $2=番号
  echo "$1" | cut -d'|' -f"$2"
}

cmd_list() {
  printf '%-10s %-20s %-28s %s\n' "NAME" "FILE" "ARGS" "PURPOSE"
  for t in "${TESTS[@]}"; do
    printf '%-10s %-20s %-28s %s\n' "$(field "$t" 1)" "$(field "$t" 2)" "$(field "$t" 3)" "$(field "$t" 4)"
  done
}

cmd_check() {
  local fail=0
  echo "--- scripts ---"
  for t in "${TESTS[@]}"; do
    local f; f="$(field "$t" 2)"
    if [ -f "$f" ] && bash -n "$f" >/dev/null 2>&1; then
      echo "OK   $f"
    else
      echo "FAIL $f"; fail=1
    fi
  done
  echo "--- prerequisites ---"
  for c in Xvfb xdotool openbox xwininfo import pkill; do
    if command -v "$c" >/dev/null 2>&1; then echo "OK   $c"; else echo "MISS $c"; fi
  done
  if [ -x "$BIN" ]; then echo "OK   $BIN"; else echo "MISS $BIN (release build required for run)"; fi
  [ "$fail" -eq 0 ]
}

cmd_run() {
  local name="${1:-}"; shift || true
  [ -n "$name" ] || { echo "usage: $0 run <name> [args...]" >&2; exit 2; }
  if [ "$name" = "phase-a" ]; then
    echo "REFUSED: phase-a は sudo apt を含むセットアップ手順のため、このランナー経由では実行しない。直接 bash desktop/phase-a.sh を使うこと。" >&2
    exit 2
  fi
  for t in "${TESTS[@]}"; do
    if [ "$(field "$t" 1)" = "$name" ] || [ "$(field "$t" 2)" = "$name" ]; then
      local f; f="$(field "$t" 2)"
      echo "== xvfb-tests: run $name ($f) args: $* =="
      exec bash "$f" "$@"
    fi
  done
  echo "unknown test: $name (see: $0 list)" >&2
  exit 2
}

case "${1:-}" in
  list) cmd_list ;;
  check) cmd_check ;;
  run) shift; cmd_run "$@" ;;
  *) echo "usage: $0 {list|check|run <name> [args...]}" >&2; exit 2 ;;
esac
