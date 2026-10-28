# research/ 索引（2026-10-27・裏方ループ作成）

目的：HARNESS_AUDIT 3-3 への対応。research/ 直下に「どのメモが現行か」を示す索引が無く、
毎回の裏方ループが安全側に倒れて全部読んでいたため、現行／歴史的の別と1行要約だけをここに置く。
**正本は DESIGN.md・BACKLOG.md・game/index.html** であり、この索引は案内のみ。判断が要る点は
索引で決めず、BACKLOG の相談リストへ。

読み方：
- **現行**：いまの実装・設計の根拠として参照するもの。新規セッションはまずここだけ読む。
- **歴史的**：当時の記録。実装済み・廃止された前提・初稿パックの記録で、現行仕様の根拠にはしない。
- **作業中（未追跡）**：開発室の作業メモで git 管理外。読むだけで、編集・コミット・移動はしない。

## 現行（まずここだけ読む）

| ファイル | 1行要約 |
|---|---|
| STRIP_CANON_RESEARCH.md | 帯の設計文法 R1–R14 の正本。帯に関わる判断はまずここ（部屋シーン廃止・帯だけが世界）。 |
| OFFICE_ART_DIRECTION.md | 「プログラマのオフィス」へのテーマ転換の根拠。※開発室が編集中で未コミット差分あり。引用時は HEAD と差分に注意。 |
| VISIBLE_PRODUCTION_DESIGN.md | 帯に生産が見える演出の設計（物の流れモデル・数値の正直さ・プール上限様式）。 |
| MENU_REDESIGN_SPEC.md | メニュー刷新の仕様（構造・部品セットの参照用）。色・密度は 2026-10-26 の sakuri 指示（VS Code 準拠）が優先で、本書の旧スキン案はそのまま使わない。 |
| TUTORIAL_DESIGN.md | チュートリアル導線の設計（段階的開示・メニューを開かなくても体験できる・スキップ可）。 |
| PIXEL_ART_NOTES.md | ドット絵の作画原則（クラスタ・規則的な段落ち・ヒューシフト）の参照用。 |
| PALETTE_ENCODING_MIGRATION_PLAN.md | パレット符号化の移行計画（設計のみ・コード不変）。注意：計画時の数値（99色）は古く、現行は 137 色まで拡張済み（附属看板の統合で 122→137）。実施時は現行数を再確認すること。 |
| menu-vscode-reference.png | sakuri 提供の VS Code スクリーンショット。メニューの色・密度の正本参照。 |
| external/INDEX.md | 反スロップ corpus（stop-slop／Codex UI 前文／Ponytail 等）の索引。ここでは再掲しない。 |
| gemini-volume-critique-20261026.md（＋同 followup・同 brief） | Argon のボリューム／成長曲線批評。第2拡張ウェーブ（I〜M）の設計入力。※「連打で1時間」は旧版由来という sakuri 訂正つきで読む（BACKLOG の注記参照）。現行ツリーのペースは sim の数値を正とする。 |
| gemini-critique-20261026.md（＋同 brief） | Gemini 3.1 Pro による規模感批評（第1弾）。ウェーブ設計の背景資料。 |

## 歴史的（仕様の根拠にしない）

| ファイル | 1行要約・なぜ歴史的か |
|---|---|
| CRITIQUE_1.md | 2026-10-24 の第1ラウンド批評。棚卸し済みで、残件は C2 項目として BACKLOG へ吸収、部屋関連は Strip Canon の部屋廃止で消滅。 |
| CRITIQUE_2.md | 2026-10-24 の第2ラウンド批評。同上（Sprint 1〜3 適用後の監査）。 |
| POLISH_RESEARCH.md | ポリッシュ改善リスト。棚卸しで大半が解決済み確認。残件は BACKLOG の候補へ。 |
| TWO_WINDOW_ARCHITECTURE.md | 2ウィンドウ化の設計書（設計のみで書かれた当時の計画）。実装は Phase E で完了済みで、現行の挙動は game/index.html が正本。 |
| ART_BATCH3_ANALYSIS.md | 2026-10-24 の sakuri バッチ3照合記録（読取専用の分析）。 |
| ENV_ART_MANIFEST.md | 環境アート初稿パック（第1弾）の記録。統合済みのものは game 内スプライトが正本。 |
| ENV_ART_STAGE3_MANIFEST.md | 環境アート初稿パック（Stage 3）の記録。同上。 |
| codex-env-art-prompt.txt / codex-fix1-art-prompt.txt / codex-stage3-art-prompt.txt / codex-stage3b-art-prompt.txt / codex-menu-editor-prompt.txt | 過去の Codex 発注文の記録。発注の流儀は AGENTS.md の簡潔発注（要件＋スタイルのみ）が現行で、これらの旧文面をそのまま再利用しない。 |

## 作業中（未追跡・読むだけ）

| ファイル | 扱い |
|---|---|
| gemini-critique-brief-20261026.md / gemini-volume-brief-20261026.md | 上記 Gemini 批評への依頼ブリーフ。現行ウェーブの背景資料として読む。git 管理外のため、編集・コミットは開発室に任せる。 |
| incoming/（probe・ログ・プレビュー類） | 再現証拠・作業ログの置き場。line2-starve-probe.js／prestige-e2e.js／prestige-probe.js／sim-audit*.js は当時の再現・監査コピーで、現行仕様の根拠にはしない。 |

## その他

- icon-source/miyuke-face-144.png — みゅけ顔の素材（アプリ・アイコン用参照）。
- 新規メモを追加したら、この索引にも1行足すこと。足さないと次のセッションがまた全部読む。
