#!/bin/bash
# game/src からフロントエンドを型チェック＋ビルドして dist へ出し、Windows を再ビルドして
# 配布 zip (myuke-desktop-windows.zip) を作り直す。v2.3.5 からは Updater 用の
# 署名 (desktop/.keys/) を env 経由で渡し、GitHub Release 用の成果物一式も
# release-v<版数>/ へステージする (公開そのものは手作業)。
# 納品物は Windows のみのため、既定では Linux deb をビルドしない
# (HARNESS_AUDIT #4: 毎回両OSフルビルド約6分の無駄を削減)。
# Linux deb も要る場合のみ `BUILD_LINUX=1 bash resync-rebuild.sh`
# または `bash resync-rebuild.sh --with-linux` で両方ビルドする。
# 入口チェック (HARNESS_AUDIT #4: fail-late の是正):
# リリースノート・署名鍵・版数一致をビルド前に検証し、不備があれば
# ビルド開始前に止まる。RESYNC_DONE が出るのは全工程の成功時のみ。
LOG=~/workspace/miyuke-game/desktop/resync-rebuild.log
exec > "$LOG" 2>&1
set -x
export PATH="$HOME/.cargo/bin:$PATH"
export XWIN_ACCEPT_LICENSE=1
cd ~/workspace/miyuke-game/desktop

VER=$(python3 -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
echo "BUILD_VERSION=$VER"

# リリースノートは版ごとの外部ファイル (release-notes/v<版数>.md) から読む。
# latest.json へのハードコードは禁止。未用意ならビルド前に止める
# (間違ったノート付き latest.json が生成される事故を防ぐ)。
NOTES_FILE="../release-notes/v${VER}.md"
if [ ! -f "$NOTES_FILE" ]; then
  echo "RELEASE_NOTES_MISSING: $NOTES_FILE を用意してから再実行すること"
  exit 1
fi

# 入口チェック1: 署名鍵が無ければ、署名なし成果物を作って後段で気づく
# fail-late にならないよう、ビルド前に止める (鍵の中身は読まない・出さない)。
if [ ! -f .keys/updater.key ] || [ ! -f .keys/updater.key.password ]; then
  echo "SIGNING_KEY_MISSING: desktop/.keys/updater.key(＋.password) が無いため開始しない"
  exit 1
fi

# 入口チェック2: game/src/game/save.ts の GAME_VERSION と tauri.conf.json の
# version が一致しなければ、版違いの成果物を作る前に止める。
GAME_VER=$(python3 -c "import re;print(re.search(r'const GAME_VERSION = \"v?([^\"]+)\"', open('../game/src/game/save.ts', encoding='utf-8').read()).group(1))")
if [ "$GAME_VER" != "$VER" ]; then
  echo "VERSION_MISMATCH: game/src/game/save.ts の GAME_VERSION=v${GAME_VER} と tauri.conf.json の version=${VER} が不一致のため開始しない"
  exit 1
fi
echo "ENTRY_CHECKS_OK: notes＋signing key＋version(${VER}) 一致"

# Updater 署名鍵 (平文は .keys/ の外に出さない。鍵そのものは DESIGN.md 参照)
# ※ set +x で囲む: xtrace が鍵をこのログへ書き出すのを防ぐ
if [ -f .keys/updater.key ]; then
  set +x
  export TAURI_SIGNING_PRIVATE_KEY="$(cat .keys/updater.key)"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat .keys/updater.key.password)"
  set -x
  echo "SIGNING_KEY_LOADED"
fi

(cd ../game && npm ci && npm run typecheck && npm run build) || { echo "FRONTEND_BUILD_FAILED"; exit 1; }
echo "FRONTEND_SYNCED"

if [ "$BUILD_LINUX" = "1" ] || [ "$1" = "--with-linux" ]; then
  npx tauri build -b deb
  LINUX_REBUILD_EXIT=$?
  echo "LINUX_REBUILD_EXIT=$LINUX_REBUILD_EXIT"
  if [ "$LINUX_REBUILD_EXIT" != "0" ]; then
    echo "LINUX_BUILD_FAILED: Linux ビルド失敗のため中断 (Windows ビルドへ進まない)"
    exit 1
  fi
else
  echo "LINUX_BUILD_SKIPPED: 既定は Windows のみ (Linux deb が要る場合は BUILD_LINUX=1 または --with-linux)"
fi

npx tauri build --target x86_64-pc-windows-msvc --runner cargo-xwin -b nsis -- --xwin-arch x86_64
WIN_REBUILD_EXIT=$?
echo "WIN_REBUILD_EXIT=$WIN_REBUILD_EXIT"
if [ "$WIN_REBUILD_EXIT" != "0" ]; then
  echo "WIN_BUILD_FAILED: Windows ビルド失敗のため中断 (RESYNC_DONE は出さない)"
  exit 1
fi

NSIS_DIR="src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis"
SETUP_EXE="$NSIS_DIR/みゅけ、きょうも開発中_${VER}_x64-setup.exe"
# Tauri v2 の NSIS Updater 成果物はインストーラ exe 本体 + その .sig (v1 の .nsis.zip は作られない)
UPD_SIG="${SETUP_EXE}.sig"
ls -lh "$SETUP_EXE" "$UPD_SIG" 2>/dev/null

rm -rf /tmp/winpkg && mkdir -p /tmp/winpkg/portable
cp "$SETUP_EXE" "/tmp/winpkg/myuke-setup-${VER}-x64.exe"
cp src-tauri/target/x86_64-pc-windows-msvc/release/miyuke.exe /tmp/winpkg/portable/myuke.exe
cp README.md /tmp/winpkg/README.md
python3 - <<EOF
import zipfile, os
out = "/home/hatch/workspace/miyuke-game/myuke-desktop-windows.zip"
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    z.write("/tmp/winpkg/myuke-setup-${VER}-x64.exe", "myuke-setup-${VER}-x64.exe")
    z.write("/tmp/winpkg/portable/myuke.exe", "portable/myuke.exe")
    z.write("/tmp/winpkg/README.md", "README.md")
print("zip rewritten")
EOF

# ---- GitHub Release 用ステージ (release-v<版数>/): アップロードする2ファイル ----
# インストーラ exe は Updater 用成果物を兼ねる (latest.json の url が同じ exe を指す)
REL_DIR="../release-v${VER}"
mkdir -p "$REL_DIR"
cp "/tmp/winpkg/myuke-setup-${VER}-x64.exe" "$REL_DIR/myuke-setup-${VER}-x64.exe"
if [ -f "$UPD_SIG" ]; then
  UPD_URL="https://github.com/sakri9616-coder/myuke-game/releases/download/v${VER}/myuke-setup-${VER}-x64.exe" \
  UPD_SIG_CONTENT="$(cat "$UPD_SIG")" UPD_NOTES="$(cat "$NOTES_FILE")" VER="$VER" python3 - <<'PYEOF'
import json, os, datetime
data = {
  "version": os.environ["VER"],
  "notes": os.environ["UPD_NOTES"],
  "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "platforms": {
    "windows-x86_64": {
      "signature": os.environ["UPD_SIG_CONTENT"],
      "url": os.environ["UPD_URL"]
    }
  }
}
out = os.path.join("..", "release-v" + os.environ["VER"], "latest.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("latest.json written:", out)
PYEOF
else
  echo "UPDATER_ARTIFACT_MISSING: インストーラの .sig が見つからない（署名 env を確認）。latest.json 無しではステージが不完全なため中断する"
  exit 1
fi
ls -lh "$REL_DIR" 2>/dev/null

if [ "$BUILD_LINUX" = "1" ] || [ "$1" = "--with-linux" ]; then
  ls -lh src-tauri/target/release/bundle/deb/*.deb
fi
ls -lh "$NSIS_DIR"/*.exe \
       src-tauri/target/x86_64-pc-windows-msvc/release/miyuke.exe \
       ../myuke-desktop-windows.zip
echo "RESYNC_DONE"
