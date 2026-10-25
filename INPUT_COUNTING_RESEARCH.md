# みゅけ Phase 2: OS全体の入力集計 — 実装調査メモ

作成: 2026-10-24（みゅー調査）／対象: Tauriデスクトップ版（Windows）

## これは何か

DESIGN.md の Phase 2（L112, L117）: 「OS全体の入力集計（Tauri本番フェーズ）」。
sakuriさんの発案（「その日のタイピングの量とか、カーソルの移動量に応じて、みゅけも仕事が進んだら面白そう」）で、
試作v0.1ではページ内の入力に限定していたものを、OS全体に広げる。

集計するのは **打鍵の回数** と **カーソルの移動距離** のみ（DESIGN.md L104）。
何を打ったか（キー内容）は取得せず、即座に捨てる。既存のブースト式はそのまま使える:

- タイピングブースト: 4打鍵ごとに +1DP
- カーソルブースト: 1,000px移動ごとに +1DP（入力ブースト合算で1分あたり上限 45DP）
- 日報・実績（「今日は12,400キー」「カーソル移動10km」）の材料にもなる
- おまけ: 打鍵速度が分かるので「sakuriさんが速く打つとみゅけのタイピングも速くなる」（L48）が本物になる

## 実装方針（推奨）: Tauri Rustバックエンド内で rdev を使う

別プロセス（sidecar）は不要。フックはメインのTauriプロセス内で動かせる。

### 候補ライブラリ

| 候補 | 方式 | 評価 |
|---|---|---|
| **rdev** 0.5.x | グローバルイベント駆動（Windowsでは低レベルフック） | ◎ 推奨。Windows/macOS/Linux(x11)対応の単一API。RustDeskが本番で採用している実績あり |
| windows-rs直書き | `SetWindowsHookEx(WH_KEYBOARD_LL / WH_MOUSE_LL)` | ○ 依存が減るが車輪の再発明。rdevで詰まった時の代替案 |
| device_query | ポーリング（`GetAsyncKeyState`系） | △ 高速な入力を取りこぼすのでカウント用途には不向き |

- rdev は `rdev::listen(callback)` でグローバルにキー・マウスイベントを受け取れる（docs.rs）。
- コールバック内では **キー種別を見ずにカウンタだけ+1** する。マウスは座標差分から移動距離を加算。
- `listen` はブロッキングするので、Tauri起動時に専用スレッドで回す。メインスレッドを塞がない。
- 集計は `AtomicU64` などで保持し、数秒ごとにフロントエンドへイベントemit（または `tauri::command` でポーリング取得）→ 既存のDP加算ロジックに流す。

### 権限まわり（Windows）

- **管理者権限・UACは不要**（通常セッションのフックはユーザー権限で動く。"Windows: No special permissions required" — input_query のドキュメントより）。
- 既知の制限: 管理者権限で動いているアプリ宛の入力はフックに見えない（UIPI）。ゲーム用途の概算カウントには実害なし。
- フック用スレッドはメッセージループを回す必要がある（rdevが内部で処理）。
- コールバックは極力速く（カウンタ加算のみ）。重い処理を入れると入力遅延の原因になる。

### プライバシー設計（DESIGN.md L104, L107 の実装形）

1. **数えるのは回数と距離だけ**。キーコード→文字の変換はしない。`event.name`（入力文字）は参照しない。
2. カウンタはメモリ集計のみ。キー内容のログは一切残さない。
3. 初回起動時に「打鍵数とカーソル移動距離だけを数えます。何を打ったかは記録しません」と明示して同意を取る。
4. 設定からいつでも一時停止可能（DESIGN.md L107）。停止中はフック自体を外す。
5. 集計値は統計パネルで全部見えるようにする（L107）。「今日何キー打ったか」は日報のネタになる。

### パフォーマンス

- イベントごとの処理は整数加算のみ。CPU・メモリ負荷は無視できるレベルで、軽量目標（2vCPU/8GB VM）と両立する。
- フロントエンドへの通知は数秒間隔のバッチで十分（毎イベントemitはしない）。

## 参考

- rdev 0.5.2 docs: https://docs.rs/crate/rdev/0.5.2 — "listen and send events globally to keyboard and mouse on MacOS, Windows and Linux"
- input_query docs: https://docs.rs/input_query/latest/input_query/ — Windows は "No special permissions required"
- RustDesk のキーボードキャプチャ（rdev採用）: https://deepwiki.com/nujabes226/rustdesk/6.1-keyboard-capture-and-translation
- Tauri sidecar パターン（今回は不要と判断。参考まで）: https://dev.to/chenxxpro/bundling-a-cli-binary-as-a-tauri-v2-sidecar-lessons-from-building-a-desktop-app-5po

## 次のステップ（Phase 2 実装時）

1. `src-tauri/Cargo.toml` に `rdev` を追加
2. バックエンド起動時に集計スレッドを spawn（`tauri::Builder::setup` 内）
3. 数秒ごとの集計イベント → フロントのDP加算・日報・実績に接続
4. 初回同意ダイアログ＋設定の一時停止トグル
5. Windows実機で「管理者アプリ操作中はカウントが止まる」ことを確認
