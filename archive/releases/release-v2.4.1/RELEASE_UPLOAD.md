# GitHub Release アップロード手順 (v2.4.1)

リポジトリ: https://github.com/sakri9616-coder/myuke-game (public)

## 新規リリース作成
- Tag: `v2.4.1`
- Title: `v2.4.1: メニューを開く処理の堅牢化`
- Notes (そのまま貼る):

「メニューが開かない」問題への追加対策版です。管理ウィンドウを起動時にあらかじめ用意しておく作りに変え、「ひらく」の信号が万一届かない時でも別経路で開けるよう二重化しました。あわせて、トレイアイコンをダブルクリックしても管理メニューが開けるようになっています。前版の新機能 (帯の大きさ調整・家具の並べ替え) もそのまま入っています。

## アップロードする2ファイル (このフォルダから)
1. `myuke-setup-2.4.1-x64.exe` (3,166,582 bytes)
   SHA-256: 95f2671a8ecfbd5200cbb85948abc7d9cb05b976ea45c68cc9f25cb503ba95f0
2. `latest.json`

## 公開後の確認
- https://github.com/sakri9616-coder/myuke-game/releases/latest/download/latest.json の version が 2.4.1
- exe のダウンロードサイズが 3,166,582 と一致
