#!/bin/bash
# GitHub Release 公開手順のスクリプト化 (HARNESS_AUDIT #3)。
# 従来は RELEASE_UPLOAD.md を読んでブラウザで手作業していた公開
# （下書き作成→exe＋latest.json 添付→公開→latest.json 目視確認。
#  v2.3.7 ではサインイン壁で失敗し完了まで約79分）を、事前チェック＋
# gh コマンドに一本化する。
#
# 既定は dry-run: 公開は一切行わず、ステージの整合性だけを検証して
# 実行すべき gh コマンドを表示する。公開するには --publish --yes が
# 両方必要で、gh 認証が済んでいない場合はその場で止まる。
# 認証 (gh auth login) には sakuri の GitHub アカウントでの操作が要る
# ため、未認証の間は dry-run の事前チェックだけが使える。
#
# 使い方:
#   bash desktop/gh-release.sh [VERSION]            # dry-run（既定）
#   bash desktop/gh-release.sh [VERSION] --publish --yes
# VERSION 省略時は src-tauri/tauri.conf.json の version を使う。
# 公開するもの（従来の手作業と同一）:
#   タグ v<VER>・タイトル v<VER>・ノート release-notes/v<VER>.md の本文
#   資産 release-v<VER>/myuke-setup-<VER>-x64.exe と同 latest.json
#   （updater endpoint は releases/latest/download/latest.json を見るため、
#    latest.json の資産添付が必須。exe は updater の url と同一物）
# 署名鍵・シークレットは一切読まない・出さない（latest.json 内の署名
# 文字列の「有無」だけを確認する）。
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="sakri9616-coder/myuke-game"
PUBLISH=0
YES=0
VER=""

for a in "$@"; do
  case "$a" in
    --publish) PUBLISH=1 ;;
    --yes) YES=1 ;;
    --*) echo "unknown arg: $a (use [VERSION] / --publish --yes)" >&2; exit 2 ;;
    *) [ -z "$VER" ] && VER="$a" || { echo "too many versions: $a" >&2; exit 2; } ;;
  esac
done

[ -n "$VER" ] || VER="$(python3 -c "import json;print(json.load(open('$ROOT/desktop/src-tauri/tauri.conf.json'))['version'])")"
VER="${VER#v}"
NOTES_FILE="$ROOT/release-notes/v${VER}.md"
REL_DIR="$ROOT/release-v${VER}"
EXE="$REL_DIR/myuke-setup-${VER}-x64.exe"
LATEST="$REL_DIR/latest.json"
FAIL=0
fail() { echo "CHECK_FAIL: $1"; FAIL=1; }
ok() { echo "CHECK_OK: $1"; }

# 1) 版数一致: tauri.conf.json と game/index.html の GAME_VERSION
GAME_VER="$(python3 -c "import re;print(re.search(r'const GAME_VERSION = \"v?([^\"]+)\"', open('$ROOT/game/index.html', encoding='utf-8').read()).group(1))")"
if [ "$GAME_VER" = "$VER" ]; then ok "version 一致 (対象 v$VER / GAME_VERSION=$GAME_VER)";
else fail "version 不一致 (対象 v$VER / GAME_VERSION=$GAME_VER)"; fi

# 2) リリースノートの存在と非空
if [ -s "$NOTES_FILE" ]; then ok "release-notes/v${VER}.md あり ($(wc -c < "$NOTES_FILE" | tr -d ' ') bytes)";
else fail "release-notes/v${VER}.md が無いか空"; fi

# 3) ステージ成果物の存在
[ -f "$EXE" ] && ok "staged exe あり ($(stat -c%s "$EXE" 2>/dev/null || stat -f%z "$EXE") bytes)" || fail "staged exe が無い: $EXE"
[ -f "$LATEST" ] && ok "staged latest.json あり" || fail "staged latest.json が無い: $LATEST"

# 4) latest.json の中身: 版数・url・署名・ノート一致
if [ -f "$LATEST" ]; then
  python3 - "$LATEST" "$NOTES_FILE" "$VER" <<'PYEOF' || fail "latest.json の内容チェックで不一致（詳細は上記）"
import json, sys
latest, notes_file, ver = sys.argv[1], sys.argv[2], sys.argv[3]
d = json.load(open(latest, encoding="utf-8"))
notes = open(notes_file, encoding="utf-8").read().strip()
want_url = f"https://github.com/sakri9616-coder/myuke-game/releases/download/v{ver}/myuke-setup-{ver}-x64.exe"
plat = d.get("platforms", {}).get("windows-x86_64", {})
problems = []
if str(d.get("version")) != ver: problems.append(f"version={d.get('version')} (want {ver})")
if plat.get("url") != want_url: problems.append(f"url={plat.get('url')} (want {want_url})")
if not plat.get("signature"): problems.append("signature が空")
if d.get("notes", "").strip() != notes: problems.append("notes が release-notes と不一致")
if problems:
    print("LATEST_JSON_MISMATCH: " + "; ".join(problems)); sys.exit(1)
print("CHECK_OK: latest.json の version・url・signature・notes が一致")
PYEOF
fi

# 5) exe の SHA-256（従来の RELEASE_UPLOAD.md の記載項目）
[ -f "$EXE" ] && echo "SHA256: $(sha256sum "$EXE" 2>/dev/null | cut -d' ' -f1 || shasum -a 256 "$EXE" | cut -d' ' -f1)  $EXE"

# 6) gh 認証の状態（dry-run では情報表示のみ。publish では必須）
if gh auth status --hostname github.com >/dev/null 2>&1; then
  echo "GH_AUTH: OK (logged in)"; AUTH=1
else
  echo "GH_AUTH: MISSING (gh auth login が必要。sakuri の操作待ち)"; AUTH=0
fi

if [ "$FAIL" != "0" ]; then
  echo "RESULT: DRY-RUN FAIL — 上記の不備を直してから再実行すること（公開は行っていない）"
  exit 1
fi

echo ""
echo "--- 実行すべき gh コマンド（dry-run では実行しない）---"
echo "gh release create \"v${VER}\" --repo \"$REPO\" --title \"v${VER}\" --notes-file \"$NOTES_FILE\" \"$EXE\" \"$LATEST\""
echo "--- 公開後の確認 ---"
echo "gh release view \"v${VER}\" --repo \"$REPO\""
echo "curl -fsSL \"https://github.com/$REPO/releases/latest/download/latest.json\" | python3 -c \"import json,sys;print(json.load(sys.stdin)['version'])\"  # v${VER} であること"
echo ""
if [ "$PUBLISH" != "1" ]; then
  echo "RESULT: DRY-RUN PASS — 公開するには --publish --yes を付けて再実行すること"
  exit 0
fi
if [ "$YES" != "1" ]; then
  echo "RESULT: PUBLISH REFUSED — --publish には --yes の併記が必要（誤実行防止）"
  exit 2
fi
if [ "$AUTH" != "1" ]; then
  echo "RESULT: PUBLISH REFUSED — gh 未認証。sakuri の gh auth login が済んでから再実行すること"
  exit 2
fi
echo "PUBLISHING v${VER} ..."
gh release create "v${VER}" --repo "$REPO" --title "v${VER}" --notes-file "$NOTES_FILE" "$EXE" "$LATEST"
echo "--- 公開後の確認 ---"
gh release view "v${VER}" --repo "$REPO"
curl -fsSL "https://github.com/$REPO/releases/latest/download/latest.json" | python3 -c "import json,sys;print('updater endpoint version:', json.load(sys.stdin)['version'])"
echo "RESULT: PUBLISH DONE v${VER}"
