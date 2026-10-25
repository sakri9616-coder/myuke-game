#!/bin/bash
# game/index.html の最新版を dist へ再同期し、Linux/Windows 両方を再ビルドして
# 配布 zip (myuke-desktop-windows.zip) を作り直す。v2.3.5 からは Updater 用の
# 署名 (desktop/.keys/) を env 経由で渡し、GitHub Release 用の成果物一式も
# release-v<版数>/ へステージする (公開そのものは手作業)。
LOG=~/workspace/miyuke-game/desktop/resync-rebuild.log
exec > "$LOG" 2>&1
set -x
export PATH="$HOME/.cargo/bin:$PATH"
export XWIN_ACCEPT_LICENSE=1
cd ~/workspace/miyuke-game/desktop

VER=$(python3 -c "import json;print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
echo "BUILD_VERSION=$VER"

# Updater 署名鍵 (平文は .keys/ の外に出さない。鍵そのものは DESIGN.md 参照)
# ※ set +x で囲む: xtrace が鍵をこのログへ書き出すのを防ぐ
if [ -f .keys/updater.key ]; then
  set +x
  export TAURI_SIGNING_PRIVATE_KEY="$(cat .keys/updater.key)"
  export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(cat .keys/updater.key.password)"
  set -x
  echo "SIGNING_KEY_LOADED"
fi

cp ../game/index.html dist/index.html
cmp ../game/index.html dist/index.html && echo "FRONTEND_SYNCED"

npx tauri build -b deb
echo "LINUX_REBUILD_EXIT=$?"

npx tauri build --target x86_64-pc-windows-msvc --runner cargo-xwin -b nsis -- --xwin-arch x86_64
echo "WIN_REBUILD_EXIT=$?"

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
  UPD_SIG_CONTENT="$(cat "$UPD_SIG")" VER="$VER" python3 - <<'PYEOF'
import json, os, datetime
data = {
  "version": os.environ["VER"],
  "notes": "帯の表示サイズの基準を見直しました。今までの70%を新しい標準（100%）とし、設定の「帯の大きさ」はその基準で70〜130%に調整できます（今まで100%で使っていた方は同じ大きさのまま移行します）。あわせて、新しい標準サイズでも文字が読めるよう、リーダーボードや吹き出しなどの文字サイズを再設計しました。並べ替えボタンは帯の右上（グリップの脇）に戻し、クリックできる家具にマウスを乗せると黄色い枠が出るようになりました。出荷台とおやつ箱のグラフィックも描き直しています。",
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
  echo "UPDATER_ARTIFACT_MISSING: インストーラの .sig が見つからない（署名 env を確認）"
fi
ls -lh "$REL_DIR" 2>/dev/null

ls -lh src-tauri/target/release/bundle/deb/*.deb \
       "$NSIS_DIR"/*.exe \
       src-tauri/target/x86_64-pc-windows-msvc/release/miyuke.exe \
       ../myuke-desktop-windows.zip
echo "RESYNC_DONE"
