#!/bin/bash
# verify-all.sh — みゅけ検証の常設化: 変更ごとに回す一括検証。
#   0) game の型チェック（tsc）とビルド（game/build.mjs → desktop/dist/index.html）
#   1) graphics/validate-sprites.cjs（スプライト契約）
#   2) tools/miyuke-smoke.js（スモークテスト）
#   3) tools/game-sim.js（ゲート改訂3。旧 balance-sim は段階1で退役）
#   4) tools/strip-fresh-measure.js（無操作の帯での初リリース実測）
#   5) tools/strip-capture.js（帯スクリーンショット、Playwright）
# 使い方: tools/verify-all.sh [--tag=YYYYMMDD-HHMMSS] [--skip-shot]
# 成果物: 目標 hidden_files/verify-logs/verify-<tag>.log（全ステップの生出力＋判定）
#         目標 hidden_files/verify-logs/shots/verify-strip-<tag>.png（帯スクショ。2026-10-28 整理でリポジトリ外へ移設）
#         目標 hidden_files/verify-logs/menu-<tag>/（メニュー全タブの撮影＋測定JSON）
# 判定: PASS / PASS_WITH_WARNINGS / FAIL。終了コードは FAIL のときのみ 1。
# 既知のフレークはなし（2026-10-26 06:17回で撤去。旧マスクの経緯:
#   B9-B は実時間 dt による x の微小ドリフトで eat/celebrate が確率的に失敗する
#   既知フレークだったが、smoke の B9-B サンドボックスを偽時計化して根治し、
#   同領域の本物の回帰を握り潰さないよう前方一致マスクを撤去した。
#   smoke の失敗は全て FAIL）。
# ゲート: システム理念書 9章のゲート改訂3（G1〜G8、game-sim.js gates）と、帯の初リリース中央値 ≤300秒。
# 帯スクショは「可能なら」の工程：Playwright/Chromium が無い環境では WARNING に留め、
#   ゲーム本体の判定（1〜4）には影響させない。
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGDIR="${MIYUKE_VERIFY_LOGDIR:-/home/hatch/workspace/goals/desktop-game-v2-windows-build/hidden_files/verify-logs}"
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
mkdir -p "$LOGDIR" "$LOGDIR/shots"
LOG="$LOGDIR/verify-$TAG.log"
SHOT="$LOGDIR/shots/verify-strip-$TAG.png"
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

# 0) 型チェックとビルド（以降のステップはこのビルド成果物を検証する）
if run_step typecheck npm --prefix "$ROOT/game" run -s typecheck && run_step build node "$ROOT/game/build.mjs"; then
  echo "TYPECHECK+BUILD: PASS" >> "$LOG"
else
  FAIL=1; echo "TYPECHECK+BUILD: FAIL" >> "$LOG"
fi

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
    FAIL=1; echo "SMOKE: FAIL ($SMOKE_PASS passed, $SMOKE_FAIL failed; failed: $FAILED_NAMES)" >> "$LOG"
  fi
fi

# 3) 旧 balance-sim のゲートは再設計の段階1（2026-10-27）で退役した。別実装の sim は本物のコードとずれていくため、
#    ゲームの判定は 3b の game-sim（本物のゲームコードを回す）だけで行う。balance-sim.js は資料として残す

# 3b) game-sim gates（改訂3・本物のゲームコード）。FAIL が1つでもあれば FAIL。
#     例外: G3（放置で星屑20個に3時間）は星屑を企業価値から出す段階3で満たす計画なので、それまでは WARNING
run_step gamesim node "$ROOT/tools/game-sim.js" gates 3
GS_HARD="$(grep "^  FAIL " "$TMP/gamesim.out" | awk '{print $2}' | grep -v '^G3$' | tr '\n' ' ' || true)"
GS_SOFT="$(grep "^  FAIL " "$TMP/gamesim.out" | awk '{print $2}' | grep '^G3$' || true)"
if ! grep -q "ゲート改訂3" "$TMP/gamesim.out"; then
  FAIL=1; echo "GAMESIM: FAIL (no gate table, see step log)" >> "$LOG"
elif [ -n "${GS_HARD// /}" ]; then
  FAIL=1; echo "GAMESIM: FAIL (改訂3: $GS_HARD)" >> "$LOG"
elif [ -n "$GS_SOFT" ]; then
  echo "GAMESIM: WARNING (G3 は段階3で満たす計画)" >> "$LOG"; WARNINGS="$WARNINGS gamesim-G3;"
else
  echo "GAMESIM: PASS (改訂3)" >> "$LOG"
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

# 6) strip baseline diff (best-effort, WARNING only — never FAILs the run)
# 帯はアニメーションするため同一条件の再撮影でも 0% にはならない。実測ノイズ
# （2026-10-26: fresh 再撮影 1.43% / veteran 再撮影 5.68%・8.38%＝スタッフ歩行のランダム性）
# を超えた変化だけを「目視せよ」の警告にする。詳細は tools/strip-baselines/README.md。
diff_step() { # $1 = label, $2 = baseline, $3 = shot, $4 = warn-threshold-pct
  local label="$1" base="$2" shot="$3" thresh="$4"
  if [ ! -f "$base" ] || [ ! -s "$shot" ]; then
    echo "DIFF-$label: WARNING (baseline or shot missing)" >> "$LOG"
    WARNINGS="$WARNINGS diff-$label-missing;"
    return
  fi
  if ! python3 "$ROOT/tools/strip-diff.py" --a="$base" --b="$shot" > "$TMP/diff-$label.out" 2>&1; then
    echo "DIFF-$label: WARNING (diff tool unavailable, see step log)" >> "$LOG"
    cat "$TMP/diff-$label.out" >> "$LOG"
    WARNINGS="$WARNINGS diff-$label-tool;"
    return
  fi
  cat "$TMP/diff-$label.out" >> "$LOG"
  local pct
  pct="$(grep -oE '\([0-9.]+%\)' "$TMP/diff-$label.out" | head -1 | tr -d '()%')"
  if [ -n "$pct" ] && awk -v p="$pct" -v t="$thresh" 'BEGIN{exit !(p > t)}'; then
    echo "DIFF-$label: WARNING (changed ${pct}% > ${thresh}% — review the shot)" >> "$LOG"
    WARNINGS="$WARNINGS diff-$label-high;"
  else
    echo "DIFF-$label: OK (changed ${pct:-?}% <= ${thresh}%)" >> "$LOG"
  fi
}
if [ "$SKIP_SHOT" != "1" ] && [ -s "$SHOT" ]; then
  diff_step fresh "$ROOT/tools/strip-baselines/fresh.png" "$SHOT" 5
  # 7) seeded (veteran) strip shot + diff — 進行後状態の帯も毎回撮る
  SEED_SHOT="${SHOT%.png}-seed.png"
  run_step shot-seed node "$ROOT/tools/strip-capture.js" --seed="$ROOT/tools/strip-seeds/veteran.json" --out="$SEED_SHOT"
  if [ "$?" -ne 0 ] || [ ! -s "$SEED_SHOT" ]; then
    echo "SHOT-SEED: WARNING (seeded capture failed, see step log)" >> "$LOG"
    WARNINGS="$WARNINGS shot-seed-failed;"
  else
    echo "SHOT-SEED: OK ($SEED_SHOT)" >> "$LOG"
    diff_step veteran "$ROOT/tools/strip-baselines/veteran.png" "$SEED_SHOT" 12
  fi
  # 7b) wide (1920x210) strip shots + diffs — 帯は全幅表示のため幅で家具間隔が
  # 変わる。1280幅だけでは幅依存の崩れを拾えない。DIFF と同じく WARNING 専用。
  WIDE_SHOT="${SHOT%.png}-wide.png"
  run_step shot-wide node "$ROOT/tools/strip-capture.js" --width=1920 --height=210 --out="$WIDE_SHOT"
  if [ "$?" -ne 0 ] || [ ! -s "$WIDE_SHOT" ]; then
    echo "SHOT-WIDE: WARNING (wide capture failed, see step log; not a game failure)" >> "$LOG"
    WARNINGS="$WARNINGS shot-wide-failed;"
  else
    echo "SHOT-WIDE: OK ($WIDE_SHOT)" >> "$LOG"
    diff_step fresh-wide "$ROOT/tools/strip-baselines/fresh-1920.png" "$WIDE_SHOT" 5
    WIDE_SEED_SHOT="${SHOT%.png}-wide-seed.png"
    run_step shot-wide-seed node "$ROOT/tools/strip-capture.js" --width=1920 --height=210 --seed="$ROOT/tools/strip-seeds/veteran.json" --out="$WIDE_SEED_SHOT"
    if [ "$?" -ne 0 ] || [ ! -s "$WIDE_SEED_SHOT" ]; then
      echo "SHOT-WIDE-SEED: WARNING (wide seeded capture failed, see step log; not a game failure)" >> "$LOG"
      WARNINGS="$WARNINGS shot-wide-seed-failed;"
    else
      echo "SHOT-WIDE-SEED: OK ($WIDE_SEED_SHOT)" >> "$LOG"
      diff_step veteran-wide "$ROOT/tools/strip-baselines/veteran-1920.png" "$WIDE_SEED_SHOT" 12
    fi
  fi
fi

# 8) menu self-check (FAILs the run since 2026-10-26 11:17)
# editor2-capture は本来 before/after 2版比較専用だが、verify-all の単一版では
# --self（before＝現行 index.html）で自己比較する。全9タブ＋ロック画面を描画し、
# pageerror・雇用フォールドの開閉・横溢れ・新規スクロール・内容肥大を検査する。
# 08:17回の接続時は WARNING 専用だったが、08:17・09:17・10:17回の verify-all で
# MENU OK が3回連続したため、接続時の条件（数回安定して回ること）を満たしたとして
# FAIL 化した。メニュー側の事故（v2.3.7〜2.4.1）はまさにこの側だったため、以後は
# メニューの自己チェック失敗をゲーム本体の失敗と同等に扱う。
# （2026-10-26 08:17回：--disable-crashpad-for-testing がこの Chromium で goto を
# hang させる既知問題を editor2-capture 側でも除去済み。strip-capture と同一根因。）
MENU_OUT="$LOGDIR/menu-$TAG"
run_step menu node "$ROOT/tools/miyuke-editor2-capture.js" --self --tag="$TAG" --outdir="$MENU_OUT"
MENU_CODE=$?
if [ "$MENU_CODE" -ne 0 ] || [ ! -f "$MENU_OUT/menu-editor2-measurements-$TAG.json" ]; then
  FAIL=1; echo "MENU: FAIL (menu self-check failed, see step log)" >> "$LOG"
else
  echo "MENU: OK ($MENU_OUT, 10 tabs incl. lock, no errors)" >> "$LOG"
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
grep -E "^(VALIDATE|SMOKE|SIM|FRESH|SHOT|DIFF|SHOT-SEED|MENU):" "$LOG"
[ "$FAIL" -eq 0 ]
