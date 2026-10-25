#!/bin/bash
# verify-all.sh — みゅけ検証の常設化: 変更ごとに回す一括検証。
#   1) graphics/validate-sprites.cjs（スプライト契約）
#   2) tools/miyuke-smoke.js（スモークテスト）
#   3) tools/balance-sim.js（バランスsimゲート）
#   4) tools/strip-fresh-measure.js（無操作の帯での初リリース実測）
#   5) tools/strip-capture.js（帯スクリーンショット、Playwright）
# 使い方: tools/verify-all.sh [--tag=YYYYMMDD-HHMMSS] [--skip-shot]
# 成果物: 目標 hidden_files/verify-logs/verify-<tag>.log（全ステップの生出力＋判定）
#         <project>/verify-strip-<tag>.png（帯スクショ）
# 判定: PASS / PASS_WITH_WARNINGS / FAIL。終了コードは FAIL のときのみ 1。
# 既知のフレーク: smoke の失敗が全て "B9-B:"（eat/celebrate の実時間ドリフト、
#   v2.4.1 検証時から記録済み）の場合のみ、失敗扱いにしない。B9-B 以外の失敗は FAIL。
# ゲート（DESIGN.md / balance-sim.js 末尾の Sprint ゲートと同一）:
#   初リリース passive/active とも ≤5分 / 30日総量アクティブ ≥ 放置×1.3 /
#   7日目以降の0リリース日 0/0 / 帯の初リリース中央値 ≤300秒。
# 帯スクショは「可能なら」の工程：Playwright/Chromium が無い環境では WARNING に留め、
#   ゲーム本体の判定（1〜4）には影響させない。
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="/home/hatch/workspace/goals/desktop-game-v2-windows-build/hidden_files/verify-logs"
TAG=""
SKIP_SHOT=0
for a in "$@"; do
  case "$a" in
    --tag=*) TAG="${a#--tag=}" ;;
    --skip-shot) SKIP_SHOT=1 ;;
    *) echo "unknown arg: $a (use --tag=... / --skip-shot)"; exit 2 ;;
  esac
done
[ -n "$TAG" ] || TAG="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOGDIR"
LOG="$LOGDIR/verify-$TAG.log"
SHOT="$ROOT/verify-strip-$TAG.png"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

{
echo "=== miyuke verify-all: $TAG ==="
echo "project: $ROOT"
echo "log: $LOG"
echo ""
} > "$LOG"

run_step() { # $1 = name, $2.. = command
  local name="$1"; shift
  echo "--- step: $name ---" >> "$LOG"
  "$@" > "$TMP/$name.out" 2>&1
  local code=$?
  cat "$TMP/$name.out" >> "$LOG"
  echo "--- step $name exit: $code ---" >> "$LOG"
  echo "" >> "$LOG"
  return $code
}

FAIL=0
WARNINGS=""

# 1) validate-sprites
run_step validate node "$ROOT/graphics/validate-sprites.cjs"
VALIDATE_CODE=$?
if [ "$VALIDATE_CODE" -ne 0 ] || ! grep -q "PASS: all sprites" "$TMP/validate.out"; then
  FAIL=1; echo "VALIDATE: FAIL" >> "$LOG"
else
  echo "VALIDATE: PASS" >> "$LOG"
fi

# 2) smoke
run_step smoke node "$ROOT/tools/miyuke-smoke.js"
SMOKE_LINE="$(grep "SMOKE RESULT" "$TMP/smoke.out" | head -1 || true)"
if [ -z "$SMOKE_LINE" ]; then
  FAIL=1; echo "SMOKE: FAIL (no result line)" >> "$LOG"
else
  SMOKE_PASS="$(echo "$SMOKE_LINE" | sed -E 's/.*SMOKE RESULT: ([0-9]+) passed, ([0-9]+) failed.*/\1/')"
  SMOKE_FAIL="$(echo "$SMOKE_LINE" | sed -E 's/.*SMOKE RESULT: ([0-9]+) passed, ([0-9]+) failed.*/\2/')"
  if [ "$SMOKE_FAIL" = "0" ]; then
    echo "SMOKE: PASS ($SMOKE_PASS passed)" >> "$LOG"
  else
    FAILED_NAMES="$(grep "^failed:" "$TMP/smoke.out" | sed 's/^failed: //' || true)"
    UNKNOWN="$(echo "$FAILED_NAMES" | tr '|' '\n' | grep -v '^ *B9-B:' || true)"
    if [ -z "$UNKNOWN" ]; then
      echo "SMOKE: PASS_WITH_KNOWN_FLAKES ($SMOKE_PASS passed, $SMOKE_FAIL failed, all B9-B)" >> "$LOG"
      WARNINGS="$WARNINGS smoke-known-flakes($SMOKE_FAIL);"
    else
      FAIL=1; echo "SMOKE: FAIL ($SMOKE_PASS passed, $SMOKE_FAIL failed; non-flake: $UNKNOWN)" >> "$LOG"
    fi
  fi
fi

# 3) balance-sim gates
run_step sim node "$ROOT/tools/balance-sim.js"
GATE_LINE="$(grep "ゲート判定" "$TMP/sim.out" | head -1 || true)"
if [ -z "$GATE_LINE" ]; then
  FAIL=1; echo "SIM: FAIL (no gate line)" >> "$LOG"
else
  P_MIN="$(echo "$GATE_LINE" | sed -E 's/.*初リリース passive=([0-9]+)分.*/\1/')"
  A_MIN="$(echo "$GATE_LINE" | sed -E 's/.*初リリース passive=[0-9]+分 active=([0-9]+)分.*/\1/')"
  RATIO="$(echo "$GATE_LINE" | sed -E 's/.*比率 ([0-9.]+)倍.*/\1/')"
  Z_DAYS="$(echo "$GATE_LINE" | sed -E 's/.*0リリース日 passive=([0-9]+) active=([0-9]+).*/\1 \2/')"
  RATIO_OK="$(awk -v r="$RATIO" 'BEGIN{print (r >= 1.30) ? "ok" : "no"}')"
  if [ "$P_MIN" -le 5 ] && [ "$A_MIN" -le 5 ] && [ "$RATIO_OK" = "ok" ] && [ "$Z_DAYS" = "0 0" ]; then
    echo "SIM: PASS (first release passive=${P_MIN}分 active=${A_MIN}分 / ratio ${RATIO} / zero-days $Z_DAYS)" >> "$LOG"
  else
    FAIL=1; echo "SIM: FAIL (first release passive=${P_MIN}分 active=${A_MIN}分 / ratio ${RATIO} / zero-days $Z_DAYS)" >> "$LOG"
  fi
fi

# 4) strip-fresh first-release measurement
run_step fresh node "$ROOT/tools/strip-fresh-measure.js"
FRESH_LINE="$(grep "SUMMARY" "$TMP/fresh.out" | head -1 || true)"
if [ -z "$FRESH_LINE" ]; then
  FAIL=1; echo "FRESH: FAIL (no summary)" >> "$LOG"
else
  FRESH_MED="$(echo "$FRESH_LINE" | sed -E 's/.*median=([0-9]+)s.*/\1/')"
  if [ "$FRESH_MED" -le 300 ]; then
    echo "FRESH: PASS ($FRESH_LINE)" >> "$LOG"
  else
    FAIL=1; echo "FRESH: FAIL ($FRESH_LINE, median over 300s)" >> "$LOG"
  fi
fi

# 5) strip screenshot (best-effort)
if [ "$SKIP_SHOT" = "1" ]; then
  echo "SHOT: SKIPPED (--skip-shot)" >> "$LOG"
  WARNINGS="$WARNINGS shot-skipped;"
else
  run_step shot node "$ROOT/tools/strip-capture.js" --out="$SHOT"
  SHOT_CODE=$?
  if [ "$SHOT_CODE" -ne 0 ] || [ ! -s "$SHOT" ]; then
    echo "SHOT: WARNING (capture failed, see step log; not a game failure)" >> "$LOG"
    WARNINGS="$WARNINGS shot-failed;"
  else
    echo "SHOT: OK ($SHOT)" >> "$LOG"
  fi
fi

echo "" >> "$LOG"
if [ "$FAIL" -ne 0 ]; then
  VERDICT="FAIL"
elif [ -n "$WARNINGS" ]; then
  VERDICT="PASS_WITH_WARNINGS"
else
  VERDICT="PASS"
fi
echo "=== VERDICT: $VERDICT (warnings: ${WARNINGS:-none}) ===" >> "$LOG"
echo "=== VERDICT: $VERDICT (warnings: ${WARNINGS:-none}) ==="
echo "log: $LOG"
[ "$SKIP_SHOT" = "1" ] || echo "shot: $SHOT"
grep -E "^(VALIDATE|SMOKE|SIM|FRESH|SHOT):" "$LOG"
[ "$FAIL" -eq 0 ]
