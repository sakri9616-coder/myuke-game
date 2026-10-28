# archive/ — 旧資産の置き場（現行の開発対象ではない）

2026-10-28 のリポジトリ整理で、ルート直下に散らかっていた過去資産をここへ寄せた。
現行の正本は `game/src/`（TypeScript）と `desktop/` で、このフォルダの中身は参照・証跡用。

- `screenshots/` — 旧デザイン時代の確認用スクリーンショットと作画ドラフト（旧ルート直下の PNG 160枚＋`myu-box-48.txt`）。ファイル名は当時のまま。
- `releases/` — v2.3.x〜v2.4.x のローカル公開ステージ記録（`RELEASE_UPLOAD.md` / `latest.json`）。実際の配布物は GitHub Releases 側にある。

検証スクショ（`verify-strip-*.png`）は今後リポジトリ内には置かない。
`tools/verify-all.sh` の出力先はリポジトリ外（目標の `hidden_files/verify-logs/shots/`）に変更済み。
