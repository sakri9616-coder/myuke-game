# desktop/ Xvfb 実機テスト一覧

事件ごとに生まれた一回物スクリプトを、次に同じ事故が起きたときに「再発見」から
始めずに済むよう束ねた入口が `xvfb-tests.sh`。元スクリプトは変更しない。

## 入口

```sh
bash desktop/xvfb-tests.sh list    # 一覧
bash desktop/xvfb-tests.sh check   # 実行せず存在・構文・前提を確認
bash desktop/xvfb-tests.sh run <name> [args...]
```

## 一覧（2026-10-26 時点・全 11 本）

| name | file | 対象・観点 |
|---|---|---|
| hit | hit-test.sh | ヒットゾーン式クリック透過。帯の空き領域は ignore=true |
| hit2 | hit-test2.sh | みゅけ本体ゾーン単独ヒット。帯スイープで机・HUD 外の inside を検出 |
| hit3 | hit-test3.sh | みゅけ本体ゾーン単独ヒット 2。定点 (760,900) で散歩中の到来を待つ |
| grip | grip-test.sh | ◥グリップのドラッグ移動＋ウォッチャ経由の位置保存＋再起動復元（WM 必須） |
| poison | poison-test.sh | 毒メニュー形状を seed し、ひらくで期待位置に開くか。引数: full JSON・期待位置・ラベル |
| layout | layout-test.sh | v2.4.0 実機検証。帯サイズ変更＋家具ドラッグ並べ替え＋永続化。引数: workdir |
| cli | cli-test.sh | 実バイナリ CLI テスト。既定 hiraku board。終了コード 0=全 assert 通過 |
| two-window | two-window-test.sh | 2ウィンドウ化の回帰。メニュー開閉でも帯が消えないこと（画素＋形状） |
| input | input-test.sh | Phase 2 OS入力集計。OFF は無出力、ON は合成入力と集計ログが一致 |
| measure | measure-run.sh | 起動計測のみ（apt 済み前提）。CPU・RSS を標準出力へ |
| phase-a | phase-a.sh | apt 再導入→起動計測のセットアップ手順。**sudo を含むためランナー経由の run は拒否**。直接実行のみ |

## 共通の前提と注意

- 全て Xvfb `:99` を使い、リリースバイナリ `src-tauri/target/release/miyuke` を起動する。
- 実行中の miyuke プロセスを pkill するため、作業中の実機テストとは併用しない。
- verify-all.sh には接続していない。Xvfb 実機テストは重く環境依存のため、
  任意実行の入口として残す（自動化への昇格は安定稼働を見て別途検討）。
- 生成物の置き場は各スクリプト従来どおり（/tmp 配下・プロジェクト直下の shot PNG 等）。
  証拠保全の集約（直下 PNG・desktop/ ログの整理）は HARNESS_AUDIT 1-6 の残課題として別途。
