#!/bin/bash
# worktree-verify.sh — コミット済みスナップショットをライブツリーに触れず検証する。
#
# 背景（2026-10-26 19:17回の教訓）: tools/miyuke-smoke.js は game/index.html を
# 絶対パスで読んでいたため、git worktree に展開したスナップショットで smoke を
# 回しても実際はライブツリー（開発室の未コミット編集中のファイル）をテストして
# いた。MIYUKE_GAME_HTML / MIYUKE_DESK による読み先の差し替えでこの罠を塞ぐ。
#
# 使い方: tools/worktree-verify.sh [ref]   （既定 ref=HEAD）
#   ref の git archive を /tmp に展開し、そのスナップショットの game/src から
#   ゲーム HTML をビルドして、それと desktop/ を指して smoke＋sim を回す。
#   (ビルドの依存 node_modules はライブツリーの game/node_modules を借りる)ライブツリーの未コミット変更には汚染されない。
#   展開ディレクトリは終了時に削除される（sim の全文は表示しないため、
#   必要なら MIYUKE_GAME_HTML を直接指定して balance-sim.js を回すこと）。
#
# 制限: ゲームのソース (game/・graphics/sprites.js) と desktop/ だけがスナップショット由来になる。
#   tools/ 自体はライブ版で回るため、tools 側に未コミット変更がある回は
#   その変更込みの検証になる。tools を含む完全分離が要る場合は
#   git worktree に tools ごと展開してそちらで回すこと。
#   また MIYUKE_DESK は末尾 / 付きのディレクトリで渡すこと。
set -u
REF="${1:-HEAD}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d /tmp/miyuke-wt-verify.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
if ! git -C "$ROOT" archive "$REF" | tar -x -C "$TMP"; then
  echo "worktree-verify: git archive $REF に失敗しました" >&2
  exit 2
fi
ln -s "$ROOT/game/node_modules" "$TMP/game/node_modules"
if ! node "$TMP/game/build.mjs" --out="$TMP/index.html" > /dev/null; then
  echo "worktree-verify: スナップショットのビルドに失敗しました" >&2
  exit 2
fi
export MIYUKE_GAME_HTML="$TMP/index.html"
export MIYUKE_DESK="$TMP/desktop/"
echo "worktree-verify: ref=$REF snapshot=$TMP"
node "$ROOT/tools/miyuke-smoke.js"
SMOKE=$?
node "$ROOT/tools/balance-sim.js" > "$TMP/sim.out" 2>&1
SIM=$?
# sim.out は trap で消えるため、末尾だけ表示してから終了する。
tail -n 20 "$TMP/sim.out"
echo "worktree-verify: smoke=$SMOKE sim=$SIM"
if [ "$SMOKE" -ne 0 ] || [ "$SIM" -ne 0 ]; then exit 1; fi
exit 0
