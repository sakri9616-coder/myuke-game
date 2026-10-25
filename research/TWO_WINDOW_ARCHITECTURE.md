# 2ウィンドウ化アーキテクチャ設計（帯の常駐化＋管理メニューの独立ウィンドウ化）

状態: 設計のみ（コード変更なし）。対象は次期マイルストーン（v2.3.7 の次の版）の実装計画。
前提: Tauri v2 / 単一フロントエンド `game/index.html`（dist へコピーされる1ファイル）/ 出荷対象は Windows（WebView2）。Linux 版は VM 検証用。

---

## 0. 結論サマリ

- **帯ウィンドウ（現ラベル `main` のまま）がシミュレーションの所有者（owner）**になる。tick・セーブ・帯描画・ヒットゾーン・入力集計・アップデータ・おかえりセレモニー、全部帯側に残す。
- **管理メニューは第2ウィンドウ（ラベル `menu`）**。同じ `index.html` を「フル形態・viewer ロール」で読み、帯から届く**状態スナップショット**で描画し、操作は**コマンドイベント**として帯へ送る。メニューはセーブに一切触らない。
- 同期は **Tauri イベント（`emitTo` / `listen`）** で行う。menu→帯: コマンド（既存の操作関数名をそのまま動詞にする）。帯→menu: フルスナップショット `{ rev, S, live }` を menu 表示中のみ 2Hz ＋コマンド直後に即時。
- 帯ウィンドウは**二度と変形しない**（モード切替の window morph を廃止）。「ひらく」は帯を大きくするのではなく、menu ウィンドウを出す操作になる。だからメニューを開いても帯は消えないし、縮みもしない。これが今回の不満（開くと帯が消える／HTML 的な完成度）への構造的な答え。
- **設計原則（sakuri 確定）: 「メニューは開かない状態がニュートラルなゲームプレイ状態」** — 重要な体験・通知・操作はすべてメニュー非表示でも成立すること。メニューは着脱式の管理コンソールであり、開いていないと欠ける状態を作らない（音もこの原則で決まる: §5.7）。

---

## 1. 現行実装の読み取り結果（根拠）

### 1.1 ウィンドウとモード切替（現行）
- Tauri ウィンドウは **1つだけ**（ラベル `main`、tauri.conf.json の `windows: []` = 空。`desktop/src-tauri/src/main.rs` の setup で `WebviewWindowBuilder` により生成）。
- Rust 側 `ShellState.mode: Strip|Full` が真実で、`apply_to_window()` が同一ウィンドウの decorations / always_on_top / skip_taskbar / resizable / 形状を書き換え（morph）、続いて `w.eval("__miyukeApplyMode('strip'|'full')")` でページ側が `body.strip` クラスを付け替える（`game/index.html` 冒頭 IIFE、`applyMode`）。
- ページ側の形態切替は CSS のみ: `body.strip` で header/main を `display:none` にし `#strip-wrap` を出す。シミュレーションも描画もセーブも全部同じページ・同じ JS コンテキストにある。
- 切替の入口: 帯 HUD「ひらく」→ invoke `set_mode_full`／「デスクトップに戻す」→ `set_mode_strip`／棚クリック `openShelfPanel()`・帯の更新チップ `updOpenSettings()` も同じ経路（switchTab してから set_mode_full）。トレイにも同等メニュー。フル形状だけ `app_config_dir/miyuke-shell.json` に保存（帯形状は起動ごとに作業領域から再計算）。
- **帰結**: フルを開く = 帯ウィンドウが変形するので、帯は物理的に消える。これが sakuri の不満の正体で、見た目の問題ではなく構造の問題。

### 1.2 シミュレーションとセーブ（現行）
- 状態は単一の可変オブジェクト `S`（`freshState()`、約50フィールド）。`tick()` が 1秒間隔で進行（生産・工程・状態遷移・イベント）。
- ループ: `setInterval(render, 16)`（帯描画＋フル時のヘッダ/パネルライブ表示）、`setInterval(tick, 1000)`、`setInterval(renderPanel, 5000)`、`setInterval(save, 10000)`。
- セーブは **localStorage のみ**: `SAVE_KEY = "miyuke-save-v1"` に `JSON.stringify(S)`。`beforeunload → save()` でも書き出す。`load()` は起動時に1回、欠けたフィールドを既定値で補完するマイグレーション込み。
- 設定画面の書き出し/読み込み/初期化（`exportSave` / `importSaveText` / `resetSave`）も localStorage を直接読み書きする（読み込みは `load()` し直し、初期化は `S = freshState()` して即 save）。

### 1.3 パネル描画（現行）
- `renderPanel()` が現在のタブ（9つ）の HTML 文字列を組み立てて `#panel` に流す。`S` と純粋な導出関数（`staffSums()`・`qaRate()`・`bottleneckLine()`・`clickPower()`・各種コスト計算など、ほぼ全て S の純関数）を直接読む。
- ボタンは inline `onclick='buyUpgrade("…")'` 等で**グローバル関数を直接呼ぶ**。動詞の実在庫: `buyUpgrade` / `buyResearch` / `buyClickUp` / `hireStaff` / `trainStaff` / `buyBulkTrain` / `buyTreat` / `buyStudio` / `buyLine2` / `setLine2Genre` / `acceptRequest` / `genRequests` / `buyDustPerk` / `doPrestige` / `giveSnack` / `callMiyuke` / `rerollProject` / `togglePause` / `toggleSound` / `setSoundVol` / `toggleInputCount` / `updCheckManual` / `updDownload` / `updRelaunch` / `updDismiss` / `exportSave` / `importSaveText` / `resetSave`。各動詞は S を変更して `save()` ＋ `renderPanel()` する自己完結型。
- `renderHeader()` は毎フレーム走り、ヘッダの資源チップとプロジェクトタブのライブ要素（`#proj-bar`・`#conc-bar`・`#proj-label`・`#bn-chip`・コンボ表示）を書き換える。帯側チップ `#strip-coins` も同じ関数が面倒を見る。
- `say()` は帯の吹き出し（`stripSay`）とパネルの `#bubble-text` の両方へ書く。おかえりカード `#return-card` はフル側 DOM にある（帯側は起床時に say で挨拶）。

### 1.4 帯とヒットゾーン（現行）
- 帯描画は canvas。`publishHitZones()` が 150ms 計算 / 200ms＋変化時のみ invoke `set_hit_zones`。Rust 側の常駐ループ（50ms）がカーソルと矩形を突き合わせ `set_ignore_cursor_events` を切り替える。
- フル形態への切替時、ページは防御策として全画面ゾーンを1回送る（帯用透過が管理画面に残らないように）。2ウィンドウ化すればこの hack は不要になる（menu は素の装飾ウィンドウで、ゾーンを送るのは帯だけ）。

### 1.5 Rust 側の状態を持つ機能（現行）
- 入力集計（Phase 2）: rdev リスナーは Rust 側。フラッシュ係が約5秒ごとに **`app.emit("input-activity", …)` で全 webview へブロードキャスト**する。ページは `listen` して `feedOsActivity()` でブースト材料＋ `S.totals/today` に流す。同
意は設定 `S.settings.inputCount` → invoke `set_input_counting`。**注意: 2ウィンドウ化すると、このブロードキャストは menu 側にも届く。menu 側で同じ listen を張ると二重計数になる**（→ §5.2）。
- アップデータ（v2.3.5〜）: ページ側 `window.__TAURI__.updater.check()` → `downloadAndInstall()` → `process.relaunch()`。状態機械 `upd` はページ内変数。表示面は3つ: 帯チップ `#strip-upd`、管理画面カード `#update-card`、設定タブ行。自動チェックは起動4秒後に無言で1回。
- 終了系: ×ボタンは CloseRequested で抑止して hide（トレイ常駐）。本当の終了はトレイ「終了」のみ（形状を保存して `app.exit(0)`）。`tauri_plugin_single_instance` が二重起動時に `main` を show+focus。
- capabilities は `default.json` 1枚（`windows: ["main"]`、権限は core:default ＋ updater:default ＋ process:default）。

### 1.6 調査メモ（Tauri v2 の複数ウィンドウ）
- ウィンドウはラベルで一意。生成は (a) tauri.conf.json 宣言（`create:false` ＋ `WebviewWindowBuilder::from_config`）、(b) Rust の `WebviewWindowBuilder`（setup / コマンド内）、(c) JS の `new WebviewWindow(label, opts)` — (c) は capability に `core:webview:allow-create-webview-window` 等の個別許可が要る。現行コードはウィンドウ操作を全部 Rust に集約しているので **(b) が整合的**。
- イベント: JS 側 `emit`（全員）/ `emitTo(label, …)`（宛先指定）/ `listen` / ウィンドウ単位の `WebviewWindow#listen`。Rust 側 `Emitter::emit`（全 webview へ）/ `emit_to` / `emit_filter`。ペイロードは JSON 化される。宛先ウィンドウが未生成・リスナ未登録だと**黙って捨てられる**（配送保証なし）→ ハンドシェイク設計が必須（§3.2）。
- 初期化スクリプト（`initialization_script`）はページのどのスクリプトより先に走る。現行も `__MIYUKE_MODE__` をこれで渡している。ロール判定にも同じ仕組みを使う。
- **localStorage の共有は webview 実装依存で当てにならない**: Windows/WebView2 では同一ユーザーデータフォルダを共有する webview 同士で localStorage が見える（＝二重書き込み事故の温床）。WKWebView は同一 `WKWebsiteDataStore` ＋同一プロセスプールのときだけ共有で、構成がずれると別ストアになる。**設計原則: 共有の有無に依存しない**（§2.3、§5.5）。
- 非表示 webview では `requestAnimationFrame` が止まり、`setInterval` も強くスロットルされる（WebView2 の intensive throttling）。現行が全部 setInterval 駆動なのは幸い。帯が隠れている間の進行が細るのは現行（全ウィンドウ hide）と同じ挙動（§5.6）。

---

## 2. トポロジ

### 2.1 役割分担

| | 帯ウィンドウ | 管理ウィンドウ |
|---|---|---|
| ラベル | `main`（**改名しない**。理由は §2.4） | `menu`（新規） |
| 形態（form） | 帯（透明・枠なし・常時手前・タスクバー非表示・210論理px帯） | 装飾あり通常ウィンドウ（1180×860 既定、最小 760×560） |
| ロール（role） | **owner**: シミュレーション・セーブ・全ての実状態 | **viewer**: 表示と意図（インテント）の送信だけ |
| 読むもの | 自分の `S` | スナップショットのレプリカ `S` |
| 書くもの | localStorage `SAVE_KEY`（唯一の書き手）、ヒットゾーン、Rust コマンド | 何も書かない（localStorage・セーブに触らない） |
| 常駐 | アプリ存続中ずっと（隠す操作はある） | 開いたときだけ存在感（生成→表示/隠す。破棄しない） |

「形態（form）」と「ロール（role）」を分けるのが要点。現行の `body.strip` は形態の切替だったが、2ウィンドウ化後は**形態はウィンドウごとに固定**され、ロールが「誰がシミュレーションするか」を決める。ブラウザプレビュー（Tauri でない環境）は従来どおり1ページで両形態を切り替える **solo ロール**として残す（スモークテストとブラウザ確認の互換のため）。

### 2.2 なぜ帯が owner か
- 帯は常に生きている唯一の画面（menu は閉じている時間の方が長い）。tick が menu の存否に依存すると、menu を閉じた瞬間ゲームが止まる。
- セーブの書き手が「常駐側」にいれば、menu のクラッシュ・ハング・未生成がセーブに影響しない（§5.4）。
- 入力集計・アップデータ・セレモニーは既に「帯がある前提」で組まれている。移す理由がない。

### 2.3 単一書き手（single writer）の原則
- `SAVE_KEY` への setItem/removeItem は owner ロールのコードだけが行う。viewer は `load()` も呼ばない（起動時は `freshState()` のまま「未同期」表示にし、初回スナップショットで上書きされる）。
- Windows では localStorage が両 webview から見えてしまう可能性があるため、「見えるから読んでいい」にはしない。viewer が書き込む事故（＝全体 JSON の last-writer-wins でセーブが巻き戻る）を防ぐのが最優先で、viewer 起動時の **書き込みトラップ**（開発時の検知用に `SAVE_KEY` への setItem を踏んだらコンソールエラー＋帯へ通知）を Phase 1 で入れる。

### 2.4 ラベル `main` を帯に残す理由
`main` という名前は帯には不似合いだが、capabilities・ヒットループ・single-instance・トレイ・テストスクリプトが全部このラベルに結びついている。改名は見た目の改善に対して差分が大きく事故面が広い。**Phase 1〜2 では改名しない**。コード内では定数 `WIN_STRIP = "main"` / `WIN_MENU = "menu"` を介して読み替える余地だけ作り、改名は Phase 3 で「やる/やらない」を改めて判断する（推奨は「やらない」）。

---

## 3. 同期プロトコル

### 3.1 輸送手段の選定
- 採用: **Tauri イベント（JS↔JS）**。menu→帯は `__TAURI__.event.emitTo("main", "menu-cmd", …)`、帯→menu は `emitTo("menu", "state-snapshot", …)`。どちらも既存の `window.__TAURI__.event` で足り、新規プラグインは不要。
- 却下案:
  - **BroadcastChannel**: 同一オリジン前提で WebView2 では動く見込みだが、Rust から見えず、配送保証も宛先管理もない。WKWebView 側の挙動差も抱える。Tauri イベントで全部賄えるので採らない。
  - **共有 localStorage ＋ storage イベント**: 10秒周期のセーブでは UI 同期に遅すぎるし、§1.6 の通り共有自体が不確実。二重書き手の温床。採らない。
  - **コマンド経由で Rust が中継**（invoke → Rust が emit_to）: 帯 JS が落ちた場合の保険にはなるが、全コマンドに Rust 側の型と転送コードが要り差分が大きい。イベントで不足が出たら Phase 2 以降に部分導入を検討する。

### 3.2 ハンドシェイク（配送保証のなさを埋める）
イベントは「相手が聞いていなければ捨てられる」ので、生存確認をプロトコルに組み込む:
1. menu ページは読み込み完了後、`emit("menu-ready")` を送る（ブロードキャストでよい。帯と Rust の両方が拾う）。
2. 帯は `menu-ready` を受けたら**即時にフルスナップショットを1回**送る。以後、menu が表示中である限り定期送信する（§3.4）。
3. menu は表示中、2秒ごとに `emit("menu-heartbeat")` を送る。帯は最終 heartbeat から5秒途絶えたら送信を止める（menu のハング/消滅を帯が自力で検出する仕組み。Rust の可視性でも代替できるが、JS 内で完結するこちらを正とする）。
4. 開くタブの指定は Rust が保持する（§4.3）。menu は `menu-ready` の後に Rust から `open-tab` イベントを受け取る（帯経由でなく Rust→menu の `emit_to`）。
5. menu 側は初回スナップショットを受けるまで、パネル上に「帯と同期中…」の軽い表示を出す（`S` は freshState のままだが、それを実データと誤認させない）。

### 3.3 コマンド（menu → 帯）
エンベロープ: `{ id: 連番, verb: "buyUpgrade", args: ["bot"] }`
- **動詞は既存のグローバル関数名をそのまま使う**（§1.3 の在庫）。帯側にディスパッチャを1つ置き、`VERBS[verb](...args)` を呼ぶ。帯側ではそれらの関数が今までどおり S を変更し、副作用（say・音・状態遷移）も帯で起きる。
- viewer 側では、boot 時に VERBS 一覧の同名スタブをグローバルへ差し替える（inline `onclick='buyUpgrade("…")'` の文字列は無変更でスタブに解決される）。スタブはコマンドを送り、**押されたボタンを結果が返るまで（上限 400ms）無効化**して二重送信を防ぐ。
- 結果: 帯は実行後に `emitTo("menu", "cmd-result", { id, ok, error? })` を返し、**続けて即時スナップショット**を送る。menu の体感は「押す→帯で猫が反応（say/アニメは帯で即見える）→数字がスナップショットで追いつく」。目標レイテンシは同一マシン内 IPC なので 100ms 以内。
- 失敗系: 帯が受け取れない（帯ページ再読み込み中など）場合、menu は 400ms でタイムアウトし、ボタンを戻して「帯と通信できませんでした」を小さく出す。コマンドは冪等でない（購入等）ので**自動リトライはしない**（二重購入防止）。
- 特殊コマンド:
  - `exportSave`: 帯が `serializeSave()` の文字列を `cmd-result` の payload で返す。menu 側が Blob ダウンロードを実行する（UI 操作は menu の領分）。
  - `importSaveText(text)`: menu がファイルを読んでテキストを送る。検証と `load()` は帯（現行の検証ロジックをそのまま帯で実行）。結果は ok/ng で返す。
  - `resetSave`: 二重 confirm は menu 側で済ませてから送る。帯が現行どおり初期化して save し、スナップショットで全画面が初期状態に戻る。
  - アップデータ系（`updCheckManual` / `updDownload` / `updRelaunch` / `updDismiss`）もコマンド化する（所有は §5.1）。
  - **menu 内で完結する操作はコマンドにしない**: タブ切替・折りたたみ開閉（`toggleFold`）・ボトルネックチップのジャンプ（`gotoBottleneckFix` の遷移部分）・スクロール。これらは viewer ローカル。

### 3.4 スナップショット（帯 → menu）
エンベロープ:
```jsonc
{
  "v": 1,
  "seq": 1234,          // 帯側の単調増加カウンタ（menu は古い seq を捨てる）
  "rev": 567,           // 状態リビジョン（帯が「変化あり」と判断した回数）
  "at": 1730000000000,
  "S": { /* S の完全なコピー（JSON 化可能な現行形のまま） */ },
  "live": {             // S に入っていない一過性の表示材料だけ
    "say": { "text": "…", "until": 1730000004200 },
    "catState": "code",
    "combo": { "n": 3, "mult": 1.2 },
    "snackReadyIn": 0,                    // おやつ再使用までの ms
    "upd": { "status": "available", "version": "2.3.8", "got": 0, "total": 0, "dismissed": false },
    "osInput": { "wanted": true, "last": { "keys": 12, "distPx": 340, "clicks": 2, "at": 1730000000000 } },
    "rates": { "coinsPerMin": 123.4, "rpPerMin": 5.6 },   // incomeSamples 由来（帯だけが持つ）
    "returnInfo": null,                   // おかえりセレモニーの表示材料（§5.3）
    "menuAwake": true                     // 帯側の認識（スナップショット送信の継続判定など）
  }
}
```
- **周期: menu 表示中は 2Hz（500ms）**。加えて「コマンド実行直後」「say が変わった直後」は即時送信。
- menu が隠れたら送らない（heartbeat 途絶で帯が止める）。帯の tick はスナップショット送信の有無と無関係に回り続ける。
- **サイズ見積もり**: S の JSON は初期約2KB、棚100作品規模で約25KB、300作品でも約80KB（棚アイテム約250B、log は40件固定、その他は有界）。2Hz でも最大 ~160KB/s 程度のローカル IPC で実用上問題ない。保険として、JSON が 150KB を超えたら周期を 1Hz に落とす適応ルールを入れる（棚は無制限に育つ唯一の要素）。
- **導出値は送らない**: `staffSums()`・`qaRate()`・コスト計算などの純関数は同じファイルに居るので、menu 側でレプリカ S に対してそのまま実行できる。送るのは「帯だけが知る一過性データ」（live 節）だけ。これにより renderPanel のコードはほぼ無変更で viewer でも動く（`S` というグローバル名をレプリカに差し替えるだけ）。
- menu 側の描画: 到着したスナップショットで `S` を丸ごと差し替え、`rev` が変わっていれば `renderPanel()`（現行の5秒タイマも安全網として残す）。ヘッダ数字は現行の `hudNum()` イージングを menu 側 rAF で回すので、2Hz の真実でも数字は滑らかに見える。`#proj-bar` 等のライブ要素は renderHeader が レプリカ S から書く（現行コードのまま）。

### 3.5 menu 側の入力（タイピング欄・カーソル）の扱い
現行は「ページ内の打鍵/カーソル移動」がブースト材料になるが、タイピング欄はプロジェクトタブ＝menu 側にある。分離後は:
- menu は自ウィンドウ内の keydown / pointermove を**回数と距離だけ**集計し、1秒ごとに `emitTo("main", "menu-input", { keys, distPx })` で帯へ送る（内容は読まない。OS 集計と同じプライバシー規約）。
- 帯は受け取った値を `feedOsActivity()` と同じ流路（`keysAcc` / `cursorAcc` / totals / today / noteInput）へ流す。ただし**ゲート判定は帯が行う**: `pauseInput` 中は捨てる、OS 集計 ON の間は二重計数しない（現行の `osCountingActive()` 判定を帯が一元管理）。
- 帯 canvas 上のクリック（応援クリック・魚・バグ捕獲）は owner ローカルで現行どおり無変更。

### 3.6 順序と整合性
- スナップショットは seq で単調。menu は `seq <= 最終受信seq` を破棄（再送・遅延対策）。
- コマンドは menu の連番 id で結果と対応づける。帯は受信順に直列実行する（JS 単一スレッドなので自然に直列）。
- 状態の真実は常に帯。menu のレプリカが古い間に購入ボタンを押しても、帯が実残高で判定するので「買えないのに買えた表示」にはならない（楽観表示はボタン無効化のみに留め、数字は楽観更新しない）。

---

## 4. ウィンドウ仕様

### 4.1 帯ウィンドウ（ラベル `main`、owner）
現行の帯構成をそのまま固定化する:
- transparent: true / decorations: false / shadow: false / always_on_top: true / skip_taskbar: true / resizable: false
- 形状: プライマリモニタ作業領域の全幅 × 210論理px、底辺吸着。**保存しない・毎回再計算**（現行 `strip_geom()` をそのまま使う）。
- 生成は setup で最初に行い、表示してから以降**形状変更は一切しない**（apply_to_window の Strip 側だけが残り、Full 側は menu 用に分離）。
- ヒットゾーン: `set_hit_zones` の送信元はこのウィンドウだけになる。Rust のヒットループの条件は「mode が Strip」から「**帯ウィンドウが表示中**」に単純化される。
- 初期化スクリプト: `window.__MIYUKE_MODE__ = 'strip'; window.__MIYUKE_ROLE__ = 'owner';`

### 4.2 管理ウィンドウ（ラベル `menu`、viewer）
- decorations: true / shadow: true / resizable: true / skip_taskbar: false（通常のアプリ窓としてタスクバーに出る）/ always_on_top: 既定 false（現行の aot_full 設定を引き継ぐ。対象が menu になる）
- 形状: 既定 1180×860、最小 760×560。**保存する**（現行 `miyuke-shell.json` の `full` 形状をそのまま menu の形状として読み替える。§6 の移行でキー名を `menu` に改める）
- URL: `index.html`（帯と同じファイル）。初期化スクリプトで `__MIYUKE_MODE__ = 'full'; __MIYUKE_ROLE__ = 'viewer';` を渡す。ページ側は form='full' で header/main を表示し、viewer ロールで sim 系を止める。
- **ライフサイクル: 遅延生成＋隠す方式（生成して使い回す）**。初回の「ひらく」で Rust が生成（visible:false で作って形状を整えてから show — 現行 main 生成時の作法を踏襲）。以降のクローズは **破棄せず hide**。理由: (1) 再表示が速い、(2) タブ位置・折りたたみ等の表示状態が残る、(3) 生成/破棄の繰り返しに伴うイベント配線事故を避けられる。破棄されるのは webview クラッシュ等で Rust が `Destroyed` を観測した場合のみで、その場合は次回 open で再生成する（§5.4）。
- 単一インスタンス: 「ひらく」系の入口は全部 Rust コマンド `open_menu` に集約し、既存なら show+focus、なければ生成。ページ側から `new WebviewWindow` はしない（§1.6 の (b) 方針）。
- capabilities: menu 用に別ファイルを作り `windows: ["menu"]`、権限は `core:default` ＋ イベント送受信に必要な分だけ。**updater / process 権限は menu に付けない**（更新の実行は帯の領分。§5.1）。帯側 default.json は `windows: ["main"]` のまま、現行権限を維持。

### 4.3 入口の読み替え（ひらく / かくす / デスクトップに戻す）

| 現在の操作 | 現在の実体 | 2ウィンドウ化後 |
|---|---|---|
| 帯 HUD「ひらく」 | `set_mode_full`（帯が変形） | invoke `open_menu`（引数なし=前回のタブ）。帯は無変化 |
| 帯の棚クリック | switchTab('shelf') ＋ set_mode_full | invoke `open_menu { tab: "shelf" }` |
| 帯の更新チップ | switchTab('settings') ＋ set_mode_full | invoke `open_menu { tab: "settings" }` |
| ヘッダ「デスクトップに戻す」 | `set_mode_strip`（ウィンドウが帯に戻る） | invoke `close_menu`（menu を hide）。**意味がそのまま成立する**: 帯は最初からデスクトップにいるので、閉じれば「戻った」ことになる |
| 帯 HUD「かくす」 | ウィンドウ全体を hide（ゲーム自体が消える） | 帯だけ hide。menu が開いていれば menu は残る（独立） |
| トレイ「大きく開く（管理画面）」 | apply_mode(Full) | `open_menu` |
| トレイ「デスクトップに戻す」 | apply_mode(Strip) | 「管理画面を閉じる」に改称し `close_menu` |
| トレイ「表示／隠す」 | ウィンドウ全体 toggle | 帯の toggle（表示名は現行維持で意味だけ帯に限定） |
| トレイ「常に手前に表示」 | フル時の AoT 希望 | menu の AoT 希望（保存キーも追随） |

`open_menu` のタブ受け渡し: Rust は `ShellState.pending_tab` に積み、menu 生成直後 or 既存表示時に `emit_to("menu", "open-tab", { tab })` する。menu がまだ読み込み中なら、menu 側の `menu-ready` を受けた Rust が pending を再送する（二重に届いても menu 側は switchTab するだけ＝冪等）。

### 4.4 Rust 側コマンドの増減
- 追加: `open_menu(tab?)` / `close_menu` / （帯の `hide_main_window` は `hide_strip_window` に改称し旧名を互換エイリアスとして1版残す）
- 廃止（Phase 3）: `set_mode_full` / `set_mode_strip` / `set_mode_overlay`（移行中は open/close へのエイリアスとして残す）
- 維持: `set_hit_zones`（帯専用に）/ `set_input_counting`（帯ページからのみ呼ばれる。invoke 自体はどのウィンドウからでも届くので、帯側の実行に一元化するのはページ側ロールの規律で担保する）

---

## 5. エッジケース

### 5.1 アップデータの所有と表示面
- **状態機械 `upd` とプラグイン呼び出し（check / downloadAndInstall / relaunch）は帯（owner）が所有する**。理由: 帯は常駐で、起動時自動チェックの置き場所として自然。menu は閉じていることが多く、ダウンロード進捗の保持先にできない。
- 表示面の分担: 帯チップは帯が現行どおり描く。管理画面カード `#update-card` と設定タブ行は menu が `live.upd` から描く（paintUpd の menu 版は DOM 書き換えだけを行う形に分離）。
- menu からの操作は全部コマンド: 「アップデートを確認」→ `updCheckManual`、「更新する」→ `updDownload`（進捗は live.upd.got/total がスナップショットで流れ続ける）、「再起動して更新」→ `updRelaunch`。
- relaunch はプロセス再起動なので両ウィンドウとも死ぬ。再起動後は帯だけが表示され、menu は隠れた状態で始まる（「更新のために menu が閉じた」のは現行の全画面再起動と体感的に同じ）。帯の `beforeunload → save()` が再起動前に走る現行経路は維持する。
- 帯が隠れている（かくす中）場合でも自動チェックは帯 webview 内で走る（JS タイマのスロットルで遅れる可能性はある。§5.6 と同じ論点）。

### 5.2 入力集計（Phase 2）の経路
- Rust のフラッシュは `app.emit` = **全 webview へのブロードキャスト**のままにする（Rust 変更を最小化）。ただし listen してよいのは **owner ロールだけ**。viewer は `input-activity` を購読しない（二重計数の防止はロール gate で担保し、スモークで検証する §6）。
- 設定表示（直近の集計 `osInputLast`）は `live.osInput` で menu に届く。同意トグルはコマンド `toggleInputCount` → 帯が `S.settings.inputCount` を反転・save・`set_input_counting` を invoke（現行の `toggleInputCount` の処理がそのまま帯で動く）。
- 同意の永続先は従来どおり S.settings（帯が保存）。Rust 側の enabled はセッション内状態で、起動時は帯が load 後に `applyInputCounting()` で再送する（現行どおり）。

### 5.3 初回起動・menu 未生成・セレモニー
- 初回（セーブなし）: 帯が freshState で開始（現行どおりチュートリアル案件等を生成）。menu は未生成のまま。「ひらく」初回で生成→ ready → スナップショット、の順で、menu が嘘の初期値を実データとして見せる時間は作らない（§3.2 の同期中表示）。
- おかえりセレモニー: 判定と `returnInfo` の生成は帯（起動直後）。帯の起床挨拶は現行どおり帯で say。カード `#return-card` は menu 側の DOM なので、`live.returnInfo` を受けた menu が描く（menu が開いていなければカードは出ない — 現行でもカードはフル画面でしか見えなかったので意味は不変）。カードを閉じる操作（`closeReturnCard`）は menu ローカルでよい（帯の状態に影響しない純表示）。

### 5.4 menu がクラッシュ/ハングしたら
- 帯は無傷: 別 webview・別 JS スレッドで、tick もセーブも帯だけで完結する。スナップショットの `emitTo("menu", …)` は相手が死んでいても帯側はエラーにならない（fire-and-forget）。
- ハング検出: heartbeat が5秒途絶えたら帯は送信停止（無駄な IPC を止めるだけ。帯の動作に影響なし）。
- 復旧: Rust が menu の `WindowEvent::Destroyed` を観測したらハンドルを捨てる。次回 `open_menu` で再生成→ ready → フルスナップショットで即復帰。手動の「作り直し」導線として、open_menu は「既存 windows があるのに show しても前面に来ない」ケースに備え、トレイの管理画面項目を長押し…ではなく、**Destroyed 経路＋アプリ再起動で足りる**と割り切る（ハング検出の自動化は Phase 2 の任意項目）。
- 逆に帯が死ぬ（アプリ全体のクラッシュ）は現行と同じで、セーブは最大10秒分（autosave 周期）＋ beforeunload の範囲。2ウィンドウ化で悪化はしない。

### 5.5 共有 localStorage の罠（重要）
Windows/WebView2 では両 webview から同じ localStorage が見える可能性がある。ここで menu 側ページが現行コードを素朴に実行すると、**menu 側にも tick と save が走って二重生産＋セーブ競合**になる。これが今回の移行で一番危険な事故で、対策は3層:
1. viewer ロールでは tick / save / load / beforeunload-save を**起動経路から外す**（フラグでなくコードパスの分離）。
2. viewer の `S` はレプリカ専用変数として扱い、実 `S` の初期化（load 含む）をしない。
3. §2.3 の書き込みトラップで、想定外の書き込みを開発中に即検出する。

### 5.6 帯を隠したときの進行
「かくす」で帯 webview が非表示になると、その JS タイマは webview にスロットルされ、tick が細る（進行がほぼ止まる）。これは現行（ウィンドウ全体 hide＝同じこと）と同等の挙動で、PC オフ時に進まないというプロダクト原則とも矛盾しない。恒常的に「隠しても進めたい」要望が出たら、帯ウィンドウの `background_throttling` を `Disabled` にする選択肢がある（WebviewWindowBuilder の設定。電池消費とのトレードオフなので、既定にはしない・Phase 2 で実測して判断）。

### 5.7 音（SoundKit）の既定 — 原則確定により反転（2026-10-25 sakuri 決定）
**設計原則: 「メニューは開かない状態がニュートラルなゲームプレイ状態」。** 帯だけの状態が完全な体験であり、メニューは着脱式の管理コンソール。したがって**重要な体験・通知・操作はすべてメニュー非表示でも成立しなければならず、開いていないと欠ける状態を作らない**（スナップショット周期が menu 表示中のみなのは表示のための同期なので矛盾しない）。この原則により、当初案（既定を menuAwake 連動にして「menu が開いている間だけ鳴る」）は**破棄**された。
音の既定: メニュー開閉に連動させず、帯（owner）で設定トグルに従って鳴らす。`settings.sound` 未設定（null）の間も owner では ON 側に倒す（リリース等の帯のセレモニーはニュートラル状態でこそ起きる）。明示設定は常に優先。実装は `SoundKit.enabled()` の形態判定をロール判定へ読み替え＋ゲート定数 `SOUND_GATE_MENU_ONLY = false`（旧案の名残として残すが原則違反なので通常触らない）。solo（ブラウザ）の形態既定は従来どおり。

### 5.8 終了経路
- トレイ「終了」: 現行どおり形状保存＋ `app.exit(0)`。追加で、終了直前に帯へ `eval("window.__miyukeSaveNow && window.__miyukeSaveNow()")` を送って即時 save を促す（現行は beforeunload 任せだが、2ウィンドウ化のついでに明示化する。150ms 程度の待ちを入れてから exit）。
- menu の ×ボタン: CloseRequested を抑止して hide（現行 main の作法を menu に適用）。帯の × は存在しない（枠なし）。
- single-instance（二重起動）: 帯を show+focus（現行どおり）。menu は触らない。

---

## 6. 移行計画

大原則: **リリースは移行完了（Phase 2 終了時点）まで切らない**。Phase 0/1 は同一ブランチ内の連続作業とし、各 Phase の検証を通してから次へ進む。

### Phase 0 — ロール分離の下ごしらえ（単一ウィンドウのまま、挙動不変）
- ページ冒頭 IIFE に `__MIYUKE_ROLE__`（'owner' | 'viewer' | 'solo'、Tauri では初期化スクリプト、ブラウザでは 'solo'）を導入。現行 Rust は 'owner' を渡すだけ。
- tick / save / load / 入力集計 init / アップデータ init / セレモニー setup を「owner か solo のときだけ」の gate で囲む（今は常に真 → 挙動不変）。
- VERBS レジストリ（§3.3 の動詞一覧）と、viewer 用スタブ差し替え関数を用意（owner/solo では未使用）。
- SoundKit の既定判定に menuAwake の差し込み口だけ作る（既定の挙動は現行維持）。
- 検証: 既存スモーク全 Phase（A/B 系/D）グリーン、Xvfb で帯・フル両形態の現行チェック（hit-test 系スクリプト）不変、バランス sim 不変。

### Phase 1 — 2ウィンドウ化＋プロトコル実装（機能完成）
- Rust: menu ウィンドウ生成（遅延・hide 運用）、`open_menu` / `close_menu`、pending_tab、menu-ready の Rust 側 listen（open-tab 再送）、ヒットループ条件の単純化、capabilities 分割（menu 用ファイル追加）、トレイ文言の読み替え。`apply_mode` の morph は帯固定化に置換（set_mode_* はエイリアスとして残置）。
- ページ: viewer boot（form='full' で開始、load/tick/save を走らせない、同期中表示）、ハンドシェイク（ready/heartbeat）、スナップショット適用（S 差し替え＋renderPanel/renderHeader）、コマンドスタブ有効化、menu-input 転送、update-card の live 駆動、おかえりカードの live 駆動、書き込みトラップ。
- 検証:
  - **二重コンテキスト・スモーク（新規 Phase E）**: Node の vm で同じスクリプトを2コンテキスト（owner/viewer）起動し、偽 Tauri イベントバスで emitTo を中継する。確認項目: (1) viewer 側 localStorage に SAVE_KEY が書かれない、tick が回らない。(2) viewer から buyUpgrade コマンド → owner の S が変わる → スナップショットで viewer のパネル HTML に新しい Lv/残高が出る。(3) input-activity の偽ブロードキャストで二重計数しない。(4) seq の古いスナップショットを viewer が捨てる。(5) giveSnack の say が live 経由で proj タブ吹き出しに出る。
  - **Xvfb 実機チェック（新規スクリプト）**: 実バイナリ起動 → ウィンドウが1つ（帯）だけであることを wmctrl/xdotool で確認 → 帯スクリーンショット A → 「ひらく」相当の操作（帯チップ座標クリック、既存 hit-test の手法）で第2ウィンドウ出現を確認 → **帯領域のスクリーンショット B が A と（猫の動きを除き）一致**すること＝帯が消えていないことの回帰確認 → menu を閉じる → 帯が残り、2秒間隔の2枚で猫が動いていること → トレイ終了。
  - 既存スモーク全緑（solo 経路の後方互換）、バランス sim 不変。

### Phase 2 — ライフサイクル硬化
- 終了時の save フラッシュ明示化（§5.8）。menu Destroyed → 再生成の実装と確認。heartbeat 途絶時の送信停止の確認。スナップショット適応周期（150KB 超で 1Hz）。帯の background_throttling 実測（隠したときの tick 進み具合）→ 既定据え置きか Disabled 化かを判断。書き込みトラップの常設/撤去判断。
- 検証: Xvfb で「menu を開いたままトレイ終了 → 再起動してセーブが直前まで残っている」「menu ウィンドウを kill してから ひらく で復帰する」を追加。Windows 実機チェックリスト（sakuri 側）: 帯が開閉で消えない／メニュー操作の反映遅延が気にならない／音の既定（§5.7 の採否含む）／入力集計の二重計数がない（設定画面の直近集計表示で確認）。

### Phase 3 — 撤去と整え
- morph 経路の撤去: Rust の `Mode` / `apply_mode` / `set_mode_*`（エイリアス含む）を削除し、`__miyukeApplyMode` は solo（ブラウザ）専用として残す。ページ側 applyMode の「フル時に全画面ゾーンを送る」防御策を削除。
- `miyuke-shell.json` のスキーマ移行: `full` → `menu`、`aot_full` → `aot_menu`（旧キーがあれば一度だけ読み替えて移行）。`mode` キーは廃止。
- DESIGN.md への反映、帯ラベル改名の再判断（推奨: 見送り）。
- 検証: スモーク全緑＋ Phase E、Xvfb 一式、リリース手順（resync-rebuild）で通常版として出荷。

### mode 切替コードの最終的な運命（まとめ）
- `body.strip` CSS と `#strip-wrap` / header / main の出し分けは**残る**。ただし「切替」ではなく「ウィンドウごとの固定形態」として使われ、Tauri 環境では boot 時に1回だけ決まる。ブラウザ（solo）では従来どおり切替わる。
- `__miyukeApplyMode` は Tauri の Rust からは呼ばれなくなり、solo 専用になる。
- `ShellState.mode` は消え、Rust の状態は「帯の可視性（暗黙）・menu の形状と AoT・pending_tab」だけになる。

---

## 7. リスク一覧

| # | リスク | 重さ | 対策 |
|---|---|---|---|
| R1 | viewer 側で tick/save が走り、セーブ競合・二重生産（特に Windows の共有 localStorage で現実化） | 高 | §5.5 の3層対策＋ Phase E スモークで恒常検証 |
| R2 | イベントの取りこぼし（menu 読込前の open-tab、帯再読込中のコマンド） | 中 | ハンドシェイク（ready/heartbeat/pending_tab）、コマンドのタイムアウト表示、自動リトライなし |
| R3 | スナップショットの肥大（棚の無制限成長） | 低〜中 | サイズ見積もり済み（§3.4）。適応周期を Phase 2 で実装 |
| R4 | 第2 webview の分だけ起動/メモリ増（10k 行の HTML を2回パース） | 低 | menu は遅延生成。帯の起動は現行と同等を維持 |
| R5 | relaunch（更新）で menu が閉じる体感 | 低 | 現行の全画面再起動と同等。更新カードの文案で予告する |
| R6 | 音の既定が変わる（§5.7） | 中（プロダクト判断） | **解決済み（sakuri 決定）**: ニュートラル状態原則により menuAwake 連動案は破棄。帯で設定トグルに従い、未設定でも ON 側 |
| R7 | capabilities の付け忘れで menu 側 API が黙って死ぬ | 中 | menu 用 capability を分離し、Phase 1 の Xvfb チェックで「開く・操作する・閉じる」を通す |
| R8 | Windows 実機でしか出ない第2ウィンドウの挙動差（フォーカス・タスクバー・IME 等） | 中 | Phase 2 の実機チェックリストに明記。VM 検証で済んだことにしない |

## 8. 未決事項（実装前に sakuri へ確認）
1. ~~音の既定~~ → **決定済み**: 「メニューは開かない状態がニュートラル」の原則により、音はメニュー開閉に連動させず帯で設定トグルに従う（§5.7）。
2. 帯 HUD「かくす」の意味変更: ゲーム全体ではなく帯だけが隠れ、menu は残る（§4.3）。トレイ文言もそれに合わせる。
3. 移行中の版の扱い: Phase 1〜2 の間はリリースを止める前提でよいか（自動更新で中途半端な版を配らないため）。

## 9. 非ゴール
- シミュレーションの Rust 移植（tick は JS のまま帯に置く）。
- menu 用の別ファイル（menu.html）分割やバンドラ導入。単一ファイル2役を維持する。
- セーブ形式（localStorage / SAVE_KEY / JSON 形）の変更。
- マルチモニタ対応の変更、帯の配置ルールの変更。
- 新機能の追加（本設計は構造変更のみ。メニューの中身の完成度向上は、この土台の上で別途行う）。
