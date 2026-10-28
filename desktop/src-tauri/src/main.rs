// みゅけ、きょうも開発中 — Tauri v2 デスクトップ常駐シェル（画面下部ストリップ型ペット）
//
// 2ウィンドウ構成（設計: research/TWO_WINDOW_ARCHITECTURE.md）:
// - 帯ウィンドウ（ラベル "main", ロール owner）: 『デスクトップ小動物牧場』式に、
//   枠なし・透明・常に手前・タスクバーに出ない帯状の窓が画面下部（作業領域の底辺）
//   に張りつき、ペットたちは壁紙の上に直接住む。帯は起動時に作業領域から形状を
//   計算して固定し、二度と変形しない。シミュレーション・セーブ・ヒットゾーン・
//   入力集計・アップデータは全部このウィンドウのページが所有する。
// - 管理ウィンドウ（ラベル "menu", ロール viewer）: 同じ index.html を「フル形態」
//   で読む第2ウィンドウ。「ひらく」は帯を大きくするのではなく、このウィンドウを
//   出す操作（open_menu コマンド）。閉じても破棄せず hide して使い回すので、
//   メニューを開いても帯は消えないし、縮みもしない。
// 帯の形状は保存しない（起動ごとに再計算）。管理ウィンドウの形状だけ
// app_config_dir/miyuke-shell.json に保存する（キーは当面 "full" のまま。
// "menu" への改名は Phase 3 のスキーマ移行で行う）。
// ストリップでは、ページが送るヒットゾーン（見えているものの矩形）の外側で
// カーソルイベントを透過させ、帯の下のデスクトップアイコンを押せるようにする。
// 調査用に MIYUKE_DEBUG_HIT=1 で切替を miyuke-hit-debug.log に記録する。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Listener, LogicalSize, Manager, PhysicalPosition, PhysicalSize, Position,
    Size, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

/// ウィンドウラベル（帯は歴史的経緯で "main" のまま改名しない。設計 §2.4）
const WIN_STRIP: &str = "main";
const WIN_MENU: &str = "menu";
/// 帯ウィンドウの高さ (倍率 1.0 の論理px)。ゲーム側の STRIP_H (152) × 1.75。
/// v2.21.0 で 210 → 266: ボードの上に所持金・集中力の2行を載せる分だけ上に伸ばした
/// (描画の倍率は据え置き、何もない所はクリックを素通しする)
const STRIP_BASE_H: f64 = 266.0;

/// ウィンドウ形状スナップショット。pos は outer position、size は inner size（物理px）。
#[derive(Clone, Copy, Default, Debug)]
struct Geom {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
    set: bool,
}

struct ShellState {
    /// 管理ウィンドウの「常に手前に表示」の希望値（帯は常にON固定）
    aot_menu: Mutex<bool>,
    /// 管理ウィンドウの形状だけを保存する（帯は起動ごとに作業領域から再計算）
    menu_geom: Mutex<Geom>,
    /// 帯の保存位置 (◥ グリップのドラッグで移動)。未設定なら作業領域の下端
    strip_pos: Mutex<Geom>,
    /// 帯の大きさ (1.0 = STRIP_BASE_H 論理px)。ページ設定 S.settings.stripSize と同期
    strip_scale: Mutex<f64>,
    /// 帯から指定された「開くタブ」。menu の menu-ready を受けて open-tab で渡す
    pending_tab: Mutex<Option<String>>,
    path: PathBuf,
    last_save_ms: AtomicU64,
    /// ヒットゾーン（ウィンドウ内論理pxの [x,y,w,h] 群）。None = ページから未受信で、
    /// その間は絶対にカーソル透過を有効にしない（起動直後に操作不能にならないため）
    hit_zones: Mutex<Option<Vec<[f64; 4]>>>,
    /// 現在 set_ignore_cursor_events に渡している値（変化したときだけ呼ぶ）
    ignoring: Mutex<bool>,
    /// MIYUKE_DEBUG_HIT=1 のときだけ true: 透過の切替を hit_log_path に記録する
    hit_debug: bool,
    hit_log_path: PathBuf,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/* ---------------- 永続化（手書きJSON: 依存を増やさない） ----------------
   キー名は Phase 1 では従来のまま ("aot_full" / "full" = 管理ウィンドウの値)。
   "menu" への改名は Phase 3 のスキーマ移行で一度だけ読み替える（設計 §6）。 */

/* ---------------- シェル診断ログ ----------------
   Windows 実機で「ひらく等が無反応」になる件の切り分け用 (2026-10-25)。
   設定フォルダの miyuke-shell-debug.log に、起動・コマンド受信・窓生成の
   到達点を時刻つきで追記する。書き込み失敗は無視し、本処理に影響させない。
   「ログに在るのに画面に出ない」か「ログ自体が無い」かで、固まっている
   層 (ページ→invoke→コマンド→窓生成→表示) を特定するために置く。 */
static DLOG_PATH: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();
fn dlog(msg: &str) {
    let Some(p) = DLOG_PATH.get() else { return };
    // 常時書くログなので、1MB を超えたら1世代だけ残して作り直す (際限なく育たないように)
    if fs::metadata(p).map(|m| m.len() > 1_000_000).unwrap_or(false) {
        let _ = fs::rename(p, p.with_extension("log.1"));
    }
    let line = format!("{} {}\n", now_ms(), msg);
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(p) {
        let _ = f.write_all(line.as_bytes());
    }
}

/// ハンドラ境界での panic を dlog へ残して握りつぶす (v2.4.1)。
/// Windows 実機で「トレイの表示切替だけ効いて、開く・終了・帯のボタンが
/// 全部無反応」という報告への対策の一つ: どこかの処理が panic すると、
/// Mutex 汚染やハンドラ死を通じて無関係な機能まで道連れになる。
/// 全 Mutex のロックを汚染耐性 (into_inner で回復) に変えた上で、
/// 入口でも panic を捕まえて記録し、機能の連鎖死を断つ
fn guard(what: &str, f: impl FnOnce()) {
    if let Err(e) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)) {
        let msg = e
            .downcast_ref::<String>()
            .cloned()
            .or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string()))
            .unwrap_or_else(|| "unknown panic".to_string());
        dlog(&format!("guard[{}]: panic caught: {}", what, msg));
    }
}

fn persist(state: &ShellState) {
    let aot = *state.aot_menu.lock().unwrap_or_else(|e| e.into_inner());
    let mg = *state.menu_geom.lock().unwrap_or_else(|e| e.into_inner());
    let sp = *state.strip_pos.lock().unwrap_or_else(|e| e.into_inner());
    let spct = (*state.strip_scale.lock().unwrap_or_else(|e| e.into_inner()) * 100.0).round() as i64;
    let txt = format!(
        "{{\"mode\":\"strip\",\"aot_full\":{},\"full\":{{\"x\":{},\"y\":{},\"w\":{},\"h\":{},\"set\":{}}},\"strip\":{{\"x\":{},\"y\":{},\"w\":{},\"h\":{},\"set\":{}}},\"strip_scale_pct\":{}}}",
        aot, mg.x, mg.y, mg.w, mg.h, mg.set, sp.x, sp.y, sp.w, sp.h, sp.set, spct
    );
    if let Some(dir) = state.path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if fs::write(&state.path, txt).is_ok() {
        state.last_save_ms.store(now_ms(), Ordering::Relaxed);
    }
}

fn key_pos(s: &str, key: &str, from: usize) -> Option<usize> {
    let pat = format!("\"{}\":", key);
    s.get(from..)?.find(&pat).map(|i| from + i + pat.len())
}

fn json_num(s: &str, key: &str, from: usize) -> Option<i64> {
    let i = key_pos(s, key, from)?;
    let rest = s[i..].trim_start();
    let num: String = rest
        .chars()
        .take_while(|c| *c == '-' || c.is_ascii_digit())
        .collect();
    num.parse().ok()
}

fn json_bool(s: &str, key: &str, from: usize) -> Option<bool> {
    let i = key_pos(s, key, from)?;
    let rest = s[i..].trim_start();
    if rest.starts_with("true") {
        Some(true)
    } else if rest.starts_with("false") {
        Some(false)
    } else {
        None
    }
}

fn parse_geom(s: &str, section: &str) -> Geom {
    let Some(off) = s.find(&format!("\"{}\":", section)) else {
        return Geom::default();
    };
    let g = Geom {
        x: json_num(s, "x", off).unwrap_or(0) as i32,
        y: json_num(s, "y", off).unwrap_or(0) as i32,
        w: json_num(s, "w", off).unwrap_or(0).max(0) as u32,
        h: json_num(s, "h", off).unwrap_or(0).max(0) as u32,
        set: json_bool(s, "set", off).unwrap_or(false),
    };
    // 壊れた値（小さすぎる等）は未設定として扱う
    if g.set && (g.w < 100 || g.h < 100) {
        Geom::default()
    } else {
        g
    }
}

struct Loaded {
    aot_menu: bool,
    menu_geom: Geom,
    strip_pos: Geom,
    strip_scale: f64,
}

fn load_persisted(path: &PathBuf) -> Loaded {
    let Ok(txt) = fs::read_to_string(path) else {
        return Loaded {
            aot_menu: false,
            menu_geom: Geom::default(),
            strip_pos: Geom::default(),
            strip_scale: 0.7,
        };
    };
    Loaded {
        aot_menu: json_bool(&txt, "aot_full", 0).unwrap_or(false),
        menu_geom: parse_geom(&txt, "full"),
        strip_pos: parse_geom(&txt, "strip"),
        strip_scale: json_num(&txt, "strip_scale_pct", 0)
            .map(|p| (p as f64 / 100.0).clamp(0.15, 1.6))
            .unwrap_or(0.7),
    }
}

/* ---------------- 形状の取得・適用 ---------------- */

/// 管理ウィンドウの現在形状を保存対象として取り込む（帯は対象外）
fn capture_menu_geom(w: &WebviewWindow, state: &ShellState) {
    if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
        *state.menu_geom.lock().unwrap_or_else(|e| e.into_inner()) = Geom {
            x: pos.x,
            y: pos.y,
            w: size.width,
            h: size.height,
            set: true,
        };
    }
}

fn primary_monitor(w: &WebviewWindow) -> Option<tauri::Monitor> {
    w.primary_monitor()
        .ok()
        .flatten()
        .or_else(|| w.current_monitor().ok().flatten())
        .or_else(|| w.available_monitors().ok().and_then(|v| v.into_iter().next()))
}

/// 帯の窓の高さ (物理px)。ページは仮想の高さ STRIP_VH を整数倍で描く (ドットの太さを揃えるため、
/// 2026-10-28) ので、STRIP_BASE_H 論理px × scale × 拡大率 に一番近い STRIP_VH の倍数に丸める
const STRIP_VH: f64 = 152.0;
fn strip_px(scale: f64, sf: f64) -> u32 {
    let k = ((STRIP_BASE_H * scale * sf) / STRIP_VH).round().max(1.0);
    (k * STRIP_VH) as u32
}

/// ストリップ形状: プライマリモニタの作業領域いっぱいの幅 × STRIP_BASE_H 論理px × scale、
/// 作業領域の底辺（Windowsタスクバーの上）に吸着。保存はせず毎回再計算する。
fn strip_geom(w: &WebviewWindow, scale: f64) -> Geom {
    if let Some(m) = primary_monitor(w) {
        let wa = m.work_area();
        let sf = m.scale_factor();
        let h = strip_px(scale, sf).min(wa.size.height).max(1);
        return Geom {
            x: wa.position.x,
            y: wa.position.y + wa.size.height as i32 - h as i32,
            w: wa.size.width,
            h,
            set: true,
        };
    }
    Geom { x: 0, y: 600, w: 1280, h: STRIP_BASE_H as u32, set: true }
}

fn default_menu_geom(w: &WebviewWindow) -> Geom {
    if let Some(m) = primary_monitor(w) {
        let mp = m.position();
        let ms = m.size();
        let sf = m.scale_factor();
        let ww = (1180.0 * sf) as u32;
        let hh = (860.0 * sf) as u32;
        Geom {
            x: mp.x + ((ms.width as i32 - ww as i32) / 2).max(0),
            y: mp.y + ((ms.height as i32 - hh as i32) / 2).max(0),
            w: ww,
            h: hh,
            set: true,
        }
    } else {
        Geom { x: 60, y: 40, w: 1180, h: 860, set: true }
    }
}

/// 保存形状が「実際に使える窓」になるかを厳格に判定し、使える場合は
/// 作業領域内に丸めた形状を返す (2.3.10)。
/// 2.3.9 の緩い判定 (タイトルバーが 16px 見えれば採用) では、旧形態の残骸
/// (帯のような細長い形・画面下端に潜る位置) まで採用してしまい、帯 (常時
/// 最前面) やタスクバーの下に隠れて「開いても何も起きない」見え方になった。
/// ここでは次を全部満たす時だけ採用する:
///   - 幅 700 / 高さ 400 以上 (帯形の残骸を窓として扱わない)
///   - タイトルバー帯 (上端 48px) が、どれかのモニタの「作業領域
///     (タスクバーを除く)」の縦方向に収まり、横方向に 320px 以上入っている
fn geom_usable(w: &WebviewWindow, g: &Geom) -> Option<Geom> {
    if !g.set || g.w < 700 || g.h < 400 {
        return None;
    }
    let monitors = w.available_monitors().ok()?;
    for m in &monitors {
        let wa = m.work_area();
        let (wx, wy) = (wa.position.x, wa.position.y);
        let (ww, wh) = (wa.size.width as i32, wa.size.height as i32);
        let title_h = 48.min(g.h as i32);
        let overlap_w = (g.x + g.w as i32).min(wx + ww) - g.x.max(wx);
        if g.y >= wy && g.y + title_h <= wy + wh && overlap_w >= 320 {
            let x = g.x.clamp(wx - (g.w as i32) + 320, wx + ww - 320);
            let y = g.y.clamp(wy, (wy + wh - title_h).max(wy));
            return Some(Geom { x, y, ..*g });
        }
    }
    None
}

fn saved_or_default_menu(w: &WebviewWindow, state: &ShellState) -> Geom {
    let g = *state.menu_geom.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(u) = geom_usable(w, &g) {
        return u;
    }
    // 保存位置を無条件に復元すると、モニタ構成の変化や旧形態（単一ウィンドウ
    // 時代）の残骸で画面外や帯の下に開くことがある。その場合ユーザーには
    // 「ひらくを押しても何も起きない」ように見える (2.3.8/2.3.9 の実バグ)。
    default_menu_geom(w)
}

/// 帯ウィンドウの構成を固定する（起動時に1回だけ。以後の形状変更は一切しない）
/// 帯の配置: 保存位置 (◥ ドラッグ) があれば、その中心を含むモニタの作業領域に
/// スナップして使う (横幅はモニタ幅いっぱい、縦位置は保存値を領域内に丸める)。
/// 保存が無い / モニタが消えている場合は既定の下端配置
fn strip_placement(w: &WebviewWindow, saved: &Geom, scale: f64) -> Geom {
    if saved.set {
        if let Ok(monitors) = w.available_monitors() {
            let cx = saved.x + (saved.w as i32) / 2;
            let cy = saved.y + (saved.h as i32) / 2;
            for m in &monitors {
                let wa = m.work_area();
                if cx >= wa.position.x
                    && cx < wa.position.x + wa.size.width as i32
                    && cy >= wa.position.y
                    && cy < wa.position.y + wa.size.height as i32
                {
                    let h = strip_px(scale, m.scale_factor())
                        .min(wa.size.height)
                        .max(1);
                    let ymax = (wa.position.y + wa.size.height as i32 - h as i32).max(wa.position.y);
                    return Geom {
                        x: wa.position.x,
                        y: saved.y.clamp(wa.position.y, ymax),
                        w: wa.size.width,
                        h,
                        set: true,
                    };
                }
            }
        }
    }
    strip_geom(w, scale)
}

/// 帯ウィンドウの形状適用。
/// 【実機検証で確定した制約】GTK では resizable=false のウィンドウへの
/// set_size は WM に無視される (位置だけ動いて高さが変わらない)。
/// resizable へ一時的に戻す方法も、固定サイズヒントが残って効かなかった。
/// そのため帯ウィンドウは常時 resizable=true とし、サイズ変更はこちらで
/// 一元管理する (装飾なしのため、ユーザーが掴める枠は実質存在しない。
/// 万一リサイズされても描画はアスペクト追随で適応し、次回起動時の配置で
/// scale から高さが再導出される)
fn apply_geom(w: &WebviewWindow, g: Geom) {
    let _ = w.set_size(Size::Physical(PhysicalSize {
        width: g.w,
        height: g.h,
    }));
    let _ = w.set_position(Position::Physical(PhysicalPosition { x: g.x, y: g.y }));
}

fn apply_strip_to_window(w: &WebviewWindow, saved: &Geom, scale: f64) {
    let _ = w.set_decorations(false);
    let _ = w.set_shadow(false);
    let _ = w.set_always_on_top(true);
    let _ = w.set_skip_taskbar(true);
    /* 帯は常時 resizable=true (apply_geom のコメント参照: false だと
       GTK/WM がプログラムからのサイズ変更を無視してしまうため)。
       ただし Windows では事情が逆になる: set_size は resizable=false
       でも効く一方、resizable な窓は画面端へドラッグしたときに
       Aero Snap (分割ビュー) へ取り込まれて帯の形が崩れてしまう
       (sakuri 実機報告 2026-10-25: 隅を掴んで端に寄せると吸着する)。
       Windows でのみ resizable=false + maximizable=false に落とし、
       スナップ自体を無効化する。管理メニューは通常の窓なので対象外 */
    if cfg!(target_os = "windows") {
        let _ = w.set_resizable(false);
        let _ = w.set_maximizable(false);
    } else {
        let _ = w.set_resizable(true);
    }
    let _ = w.set_min_size(None::<Size>);
    let _ = w.set_max_size(None::<Size>);
    let g = strip_placement(w, saved, scale);
    apply_geom(w, g);
}

/// 管理ウィンドウの構成（装飾あり通常ウィンドウ＋保存済み形状）
fn apply_menu_to_window(w: &WebviewWindow, state: &ShellState) {
    let _ = w.set_decorations(true);
    let _ = w.set_shadow(true);
    let aot = *state.aot_menu.lock().unwrap_or_else(|e| e.into_inner());
    let _ = w.set_always_on_top(aot);
    let _ = w.set_skip_taskbar(false);
    let _ = w.set_resizable(true);
    let _ = w.set_min_size(Some(Size::Logical(LogicalSize {
        width: 760.0,
        height: 560.0,
    })));
    let g = saved_or_default_menu(w, state);
    let _ = w.set_size(Size::Physical(PhysicalSize {
        width: g.w,
        height: g.h,
    }));
    let _ = w.set_position(Position::Physical(PhysicalPosition { x: g.x, y: g.y }));
}

/* ---------------- 管理ウィンドウのライフサイクル ----------------
   遅延生成＋隠す方式（生成して使い回す）。破棄されるのは webview クラッシュ等で
   ウィンドウが消えた場合だけで、その場合は次回 open_menu で再生成される
   （get_webview_window が None を返すので自然にその経路へ落ちる。設計 §5.4）。 */

/// pending_tab を menu へ open-tab で渡してクリアする（二重に届いても冪等）
fn send_pending_tab(app: &AppHandle) {
    let state = app.state::<ShellState>();
    let tab = state.pending_tab.lock().unwrap_or_else(|e| e.into_inner()).take();
    if let Some(tab) = tab {
        let _ = app.emit_to(WIN_MENU, "open-tab", serde_json::json!({ "tab": tab }));
    }
}

fn open_menu_impl(app: &AppHandle, tab: Option<String>) {
    dlog("open_menu_impl: enter");
    let state = app.state::<ShellState>();
    if let Some(t) = tab {
        *state.pending_tab.lock().unwrap_or_else(|e| e.into_inner()) = Some(t);
    }
    if let Some(w) = app.get_webview_window(WIN_MENU) {
        // 既存ウィンドウは使い回す（形状・タブ位置・折りたたみ状態が残る）
        dlog("open_menu_impl: existing window -> show+focus");
        // 既存窓が使えない位置・形で残っていたら、出す前に救出する (2.3.10)
        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
            let cur = Geom {
                x: pos.x,
                y: pos.y,
                w: size.width,
                h: size.height,
                set: true,
            };
            if geom_usable(&w, &cur).is_none() {
                dlog("open_menu_impl: existing window at unusable geometry -> re-apply");
                apply_menu_to_window(&w, &state);
            }
        }
        let _ = w.show();
        let _ = w.set_focus();
        send_pending_tab(app);
        return;
    }
    dlog("open_menu_impl: building menu window");
    if let Some(w) = build_menu_window(app) {
        let _ = w.show();
        let _ = w.set_focus();
        dlog("open_menu_impl: show+focus done");
        // open-tab はまだ送らない: ページ読込完了後の menu-ready を受けて
        // setup のリスナが send_pending_tab する（取りこぼし防止。設計 §4.3）
    }
}

/// ローカル beacon (v2.4.1): ページ→Rust の invoke が届かない環境への
/// 迂回路。127.0.0.1 の使い捨てポートで極小 HTTP サーバを立て、起動毎の
/// トークンを init script 経由でページへ渡す。ページは invoke の応答が
/// 700ms 無い時だけ beacon へ GET する (通常環境では一切使われない)。
/// 受け付けるのは open-menu / hide-strip の2コマンドだけ
static BEACON: std::sync::OnceLock<(u16, String)> = std::sync::OnceLock::new();

fn beacon_init_script() -> String {
    match BEACON.get() {
        Some((port, token)) => format!(
            "window.__MIYUKE_BEACON__ = {{ port: {}, token: \"{}\" }};",
            port, token
        ),
        None => String::new(),
    }
}

fn start_beacon(app: &AppHandle) {
    use std::io::{Read, Write};
    let listener = match std::net::TcpListener::bind("127.0.0.1:0") {
        Ok(l) => l,
        Err(e) => {
            dlog(&format!("beacon: bind FAILED: {}", e));
            return;
        }
    };
    let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
    // 起動ごとの合言葉。時刻や PID から推測できないよう、OS の乱数で鍵を作る
    // std の RandomState (起動ごとに OS 乱数で初期化される SipHash 鍵) を2つ使って 128bit にする
    let token = {
        use std::hash::{BuildHasher, Hasher};
        let word = || {
            let mut h = std::collections::hash_map::RandomState::new().build_hasher();
            h.write_u128(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0),
            );
            h.finish()
        };
        format!("{:016x}{:016x}", word(), word())
    };
    let _ = BEACON.set((port, token));
    dlog(&format!("beacon: listening on 127.0.0.1:{}", port));
    let app = app.clone();
    std::thread::spawn(move || {
        for stream in listener.incoming() {
            let Ok(mut stream) = stream else { continue };
            let app = app.clone();
            std::thread::spawn(move || {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
                let mut buf = [0u8; 1024];
                let Ok(n) = stream.read(&mut buf) else { return };
                let req = String::from_utf8_lossy(&buf[..n]).into_owned();
                let first = req.lines().next().unwrap_or("").to_string();
                let mut cmd = String::new();
                let mut tab: Option<String> = None;
                let mut key = String::new();
                if let Some(q) = first
                    .split(' ')
                    .nth(1)
                    .and_then(|u| u.split('?').nth(1))
                {
                    for pair in q.split('&') {
                        let mut kv = pair.splitn(2, '=');
                        match (kv.next(), kv.next()) {
                            (Some("k"), Some(v)) => key = v.to_string(),
                            (Some("c"), Some(v)) => cmd = v.to_string(),
                            // タブ名は英数字の短い名前だけを通す (任意の文字列を窓へ渡さない)
                            (Some("t"), Some(v))
                                if !v.is_empty()
                                    && v.len() <= 16
                                    && v.chars().all(|c| c.is_ascii_alphanumeric()) =>
                            {
                                tab = Some(v.to_string())
                            }
                            _ => {}
                        }
                    }
                }
                let valid = BEACON
                    .get()
                    .map(|(_, t)| t == &key)
                    .unwrap_or(false);
                let body = if valid && (cmd == "open-menu" || cmd == "hide-strip") {
                    dlog(&format!("beacon: {} accepted", cmd));
                    let app2 = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        if cmd == "open-menu" {
                            open_menu_impl(&app2, tab);
                        } else {
                            hide_strip_impl(&app2);
                        }
                    });
                    "ok"
                } else {
                    // 拒否はログに残さない (外から叩かれ続けてもログが育たないように)
                    "ng"
                };
                // CORS 許可ヘッダは付けない: ページは応答を読まない (送るだけで実行される)。
                // 付けると任意の Web ページが応答から beacon の存在を確かめられる
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes());
            });
        }
    });
}

/// 管理ウィンドウを生成する（非表示・形状適用まで。表示はしない）。
/// v2.4.1: 起動時 (setup) に先行生成しておく。イベントハンドラの中で
/// 窓を生成する経路は Windows で固まる疑いが残るため、「開く」操作は
/// 原則として既存窓の show だけで済むようにした。生成が要るのは
/// 初回と、窓が破棄された場合の再生成だけ
fn build_menu_window(app: &AppHandle) -> Option<WebviewWindow> {
    let state = app.state::<ShellState>();
    let aot = *state.aot_menu.lock().unwrap_or_else(|e| e.into_inner());
    let init_script = format!(
        "window.__MIYUKE_MODE__ = 'full'; window.__MIYUKE_ROLE__ = 'viewer';{}",
        beacon_init_script()
    );
    let built = WebviewWindowBuilder::new(app, WIN_MENU, WebviewUrl::App("index.html".into()))
        .title("みゅけ、きょうも開発中 — 管理メニュー")
        .initialization_script(init_script)
        .transparent(false)
        .decorations(true)
        .shadow(true)
        .resizable(true)
        .skip_taskbar(false)
        .always_on_top(aot)
        .inner_size(1180.0, 860.0)
        .min_inner_size(760.0, 560.0)
        .visible(false)
        .build();
    match built {
        Ok(w) => {
            dlog("build_menu_window: build ok");
            apply_menu_to_window(&w, &state);
            Some(w)
        }
        Err(e) => {
            dlog(&format!("build_menu_window: build FAILED: {}", e));
            eprintln!("menu window create failed: {}", e);
            None
        }
    }
}

fn close_menu_impl(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WIN_MENU) {
        let state = app.state::<ShellState>();
        capture_menu_geom(&w, &state);
        persist(&state);
        let _ = w.hide();   // 破棄せず隠す（次回は即座に再表示できる）
    }
}

/// 帯 HUD「ひらく」用: 管理ウィンドウを開く（タブ指定は任意）
#[tauri::command]
fn open_menu(app: AppHandle, tab: Option<String>) {
    dlog("cmd open_menu received");
    guard("cmd open_menu", move || open_menu_impl(&app, tab));
}

/// 管理ウィンドウの「デスクトップに戻す」用: 管理ウィンドウを閉じる（帯は残る）
#[tauri::command]
fn close_menu(app: AppHandle) {
    guard("cmd close_menu", move || close_menu_impl(&app));
}

/// 旧モード切替コマンドの互換エイリアス（移行中のみ。撤去は Phase 3）
#[tauri::command]
fn set_mode_full(app: AppHandle) {
    guard("cmd set_mode_full", move || open_menu_impl(&app, None));
}

#[tauri::command]
fn set_mode_strip(app: AppHandle) {
    guard("cmd set_mode_strip", move || close_menu_impl(&app));
}

/// 帯の位置を既定 (プライマリ画面の下端) に戻す。設定画面のボタン用
#[tauri::command]
fn reset_strip_position(app: AppHandle) {
    guard("cmd reset_strip_position", move || reset_strip_position_inner(&app));
}

fn reset_strip_position_inner(app: &AppHandle) {
    let state = app.state::<ShellState>();
    *state.strip_pos.lock().unwrap_or_else(|e| e.into_inner()) = Geom::default();
    let scale = *state.strip_scale.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(w) = app.get_webview_window(WIN_STRIP) {
        apply_strip_to_window(&w, &Geom::default(), scale);
    }
    persist(&state);
}

/// 帯の大きさ変更 (v2.4.0)。帯ウィンドウの高さだけを変え、下端は
/// 今の位置に固定する (帯が浮いた/沈んだように見えないため)。
/// ページ側の描画はアスペクト追随なので、高さが変われば全体が拡縮する
#[tauri::command]
fn set_strip_scale(app: AppHandle, window: tauri::Window, scale: f64) {
    if window.label() != WIN_STRIP {
        return; // 帯の形を変えられるのは帯のページだけ
    }
    guard("cmd set_strip_scale", move || set_strip_scale_inner(&app, scale));
}

// ---- セーブデータのファイル保存 ----
// ゲームのセーブ (JSON) を app_data_dir/miyuke-save.json に置く。WebView の
// localStorage はプロファイル側の都合で消えることがあるため、正本はファイル。
// 読み込みは起動時に Rust が読んで帯ウィンドウの初期化スクリプトで渡し
// (ページの load() は同期のまま)、書き込みは save_game コマンドで行う。
// ページ側は localStorage にも同じものを書き、起動時は lastTick の新しい方を採る。
const SAVE_FILE: &str = "miyuke-save.json";

fn save_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(SAVE_FILE))
}

/// 起動時のセーブを JS の式として返す (無い・読めないときは null)
fn save_init_script(app: &AppHandle) -> String {
    let text = save_path(app).and_then(|p| fs::read_to_string(p).ok());
    let lit = match text {
        Some(t) if serde_json::from_str::<serde_json::Value>(&t).map(|v| v.is_object()).unwrap_or(false) => {
            serde_json::to_string(&t).unwrap_or_else(|_| "null".into())
        }
        _ => "null".into(),
    };
    format!("window.__MIYUKE_SAVE__ = {};", lit)
}

/// セーブの書き込み。単一書き手の原則で、帯ウィンドウ (owner) 以外からは受け付けない。
/// 一時ファイルに書いてから置き換えるので、途中で落ちても前のセーブが残る
/// ディスク書き込みはメインスレッドを止めないよう別スレッドで行う (async コマンド)。
/// 同時に2つ走ると一時ファイルを取り合うので、書き込み全体を Mutex で直列化する
static SAVE_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command(async)]
fn save_game(app: AppHandle, window: tauri::Window, data: String) -> Result<(), String> {
    if window.label() != WIN_STRIP {
        return Err("save_game: only the strip window may write the save".into());
    }
    match serde_json::from_str::<serde_json::Value>(&data) {
        Ok(v) if v.is_object() => {}
        _ => return Err("save_game: not a JSON object".into()),
    }
    let result = write_save_file(&app, &data);
    if let Err(e) = &result {
        dlog(&format!("save_game: write FAILED: {}", e));
    }
    result
}

fn write_save_file(app: &AppHandle, data: &str) -> Result<(), String> {
    let _lock = SAVE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let path = save_path(app).ok_or("save_game: no app data dir")?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("json.tmp");
    {
        // 置き換える前に中身をディスクまで書き切る (停電で空ファイルが残らないように)
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn set_strip_scale_inner(app: &AppHandle, scale: f64) {
    let state = app.state::<ShellState>();
    let s = if scale.is_finite() { scale.clamp(0.15, 1.6) } else { 0.7 };
    *state.strip_scale.lock().unwrap_or_else(|e| e.into_inner()) = s;
    if let Some(w) = app.get_webview_window(WIN_STRIP) {
        if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
            let sf = w.scale_factor().unwrap_or(1.0);
            let new_h = strip_px(s, sf);
            if new_h != size.height {
                let new_y = pos.y + size.height as i32 - new_h as i32;
                apply_geom(&w, Geom {
                    x: pos.x,
                    y: new_y,
                    w: size.width,
                    h: new_h,
                    set: true,
                });
            }
        }
    }
    persist(&state);
    dlog(&format!("set_strip_scale: {:.2}", s));
}

#[tauri::command]
fn set_mode_overlay(app: AppHandle) {
    guard("cmd set_mode_overlay", move || close_menu_impl(&app));
}

fn hide_strip_impl(app: &AppHandle) {
    dlog("hide_strip_impl: enter");
    if let Some(w) = app.get_webview_window(WIN_STRIP) {
        let _ = w.hide();
        dlog("hide_strip_impl: hide() called");
    } else {
        dlog("hide_strip_impl: strip window NOT FOUND");
    }
}

/// ストリップHUDの「かくす」用: 帯だけを隠す（管理ウィンドウは独立に残る）
#[tauri::command]
fn hide_main_window(app: AppHandle) {
    guard("cmd hide_main_window", move || hide_strip_impl(&app));
}

/// hide_main_window の新称（旧名は互換エイリアスとして残す）
#[tauri::command]
fn hide_strip_window(app: AppHandle) {
    guard("cmd hide_strip_window", move || hide_strip_impl(&app));
}

/* ---------------- ヒットゾーン式クリック透過 ----------------
   ストリップは画面下部210px × 全幅の窓なので、そのままでは帯の下にある
   デスクトップアイコンまでクリックを横取りしてしまう。そこで、ページ側が
   「見えているもの（みゅけ・スタッフ・アヒル・机・吹き出し・HUD）」の矩形を
   set_hit_zones で送り、Rust 側のループがグローバルなカーソル位置と突き合わせて
   ゾーン外では set_ignore_cursor_events(true) にし、クリックをデスクトップへ
   素通しする。ゾーン内に入れば即座に false に戻す。
   ゾーンを送るのは帯ウィンドウだけ（管理ウィンドウは素の装飾ウィンドウ）。 */

/// ページからのヒットゾーン受信（ウィンドウ内論理pxの [x,y,w,h] 群）
#[tauri::command]
fn set_hit_zones(window: tauri::Window, zones: Vec<[f64; 4]>, state: tauri::State<ShellState>) {
    if window.label() != WIN_STRIP {
        return; // クリック透過の範囲を決められるのは帯のページだけ
    }
    let mut slot = state.hit_zones.lock().unwrap_or_else(|e| e.into_inner());
    if slot.is_none() {
        dlog(&format!(
            "set_hit_zones: first receipt ({} zones) — page->invoke path alive",
            zones.len()
        ));
    }
    *slot = Some(zones);
}

fn hit_debug_log(state: &ShellState, lx: f64, ly: f64, nzones: usize, ignore: bool) {
    if !state.hit_debug {
        return;
    }
    let line = format!(
        "{} cursor=({:.0},{:.0}) zones={} ignore={}\n",
        now_ms(),
        lx,
        ly,
        nzones,
        ignore
    );
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&state.hit_log_path)
    {
        let _ = f.write_all(line.as_bytes());
    }
}

/// カーソルのウィンドウ内論理px座標（取れなければ None）
fn cursor_local(w: &WebviewWindow) -> Option<(f64, f64)> {
    let cur = w.cursor_position().ok()?;
    let pos = w.outer_position().ok()?;
    let sf = w.scale_factor().unwrap_or(1.0);
    Some((
        (cur.x - pos.x as f64) / sf,
        (cur.y - pos.y as f64) / sf,
    ))
}

/// 透過状態の切替（変化したときだけ setter を呼び、デバッグ記録を残す）
fn set_ignoring(w: &WebviewWindow, state: &ShellState, want: bool, lx: f64, ly: f64, nzones: usize) {
    let mut cur = state.ignoring.lock().unwrap_or_else(|e| e.into_inner());
    if *cur != want {
        let _ = w.set_ignore_cursor_events(want);
        *cur = want;
        drop(cur);
        hit_debug_log(state, lx, ly, nzones, want);
    }
}

/// デバッグ用ハートビート（MIYUKE_DEBUG_HIT=1 のとき約1秒に1行、状態スナップショット）
fn hit_hb_log(state: &ShellState, msg: String) {
    if !state.hit_debug {
        return;
    }
    let line = format!("{} hb {}\n", now_ms(), msg);
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&state.hit_log_path)
    {
        let _ = f.write_all(line.as_bytes());
    }
}

fn hit_loop_tick(app: &AppHandle, tick_no: u64) {
    let Some(w) = app.get_webview_window(WIN_STRIP) else {
        return;
    };
    let state = app.state::<ShellState>();
    let hb = state.hit_debug && tick_no.is_multiple_of(20);
    let visible = w.is_visible().unwrap_or(false);
    // 帯が非表示のときは透過させない（ループ側の実作業もしない）。
    // 帯は常時ストリップ形態なので、条件は「帯が見えているか」だけに単純化された
    if !visible {
        if *state.ignoring.lock().unwrap_or_else(|e| e.into_inner()) {
            let (lx, ly) = cursor_local(&w).unwrap_or((f64::NAN, f64::NAN));
            let nz = state
                .hit_zones
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_ref()
                .map_or(0, |z| z.len());
            set_ignoring(&w, &state, false, lx, ly, nz);
        }
        if hb {
            hit_hb_log(&state, format!("strip visible={} (skipped)", visible));
        }
        return;
    }
    let zones = state.hit_zones.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let Some(zones) = zones else {
        // ゾーン未受信の間は武装しない（起動直後に帯が死ぬのを防ぐ）
        if *state.ignoring.lock().unwrap_or_else(|e| e.into_inner()) {
            set_ignoring(&w, &state, false, f64::NAN, f64::NAN, 0);
        }
        if hb {
            hit_hb_log(&state, "armed=false (no zones yet)".to_string());
        }
        return;
    };
    let cur = cursor_local(&w);
    let Some((lx, ly)) = cur else {
        if hb {
            hit_hb_log(&state, format!("zones={} cursor=ERR", zones.len()));
        }
        return;
    };
    let inside = zones
        .iter()
        .any(|z| lx >= z[0] && lx < z[0] + z[2] && ly >= z[1] && ly < z[1] + z[3]);
    if hb {
        hit_hb_log(
            &state,
            format!(
                "zones={} cursor=({:.0},{:.0}) inside={} ignoring={}",
                zones.len(),
                lx,
                ly,
                inside,
                *state.ignoring.lock().unwrap_or_else(|e| e.into_inner())
            ),
        );
    }
    set_ignoring(&w, &state, !inside, lx, ly, zones.len());
}

/// 約50ms間隔でカーソルとヒットゾーンを突き合わせる常駐ループ
fn spawn_hit_loop(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut tick_no: u64 = 0;
        loop {
            std::thread::sleep(Duration::from_millis(50));
            tick_no += 1;
            // ここで panic するとクリック透過の切替が以後ずっと止まるので、1回分だけ捨てて続ける
            guard("hit_loop_tick", || hit_loop_tick(&app, tick_no));
        }
    });
}

/* ---------------- Phase 2: OS全体の入力集計（rdev） ----------------
   数えるのは「打鍵の回数」「マウスボタンの回数」「カーソルの移動距離」だけ。
   どのキーか・何を打ったかは一切見ない（EventType のバリアントだけを数え、
   ペイロードは捨てる）。集計はメモリ内のみで、約5秒ごとにページへ
   "input-activity" イベントで送ってリセットする。通信はしない。
   既定は OFF: リスナースレッド自体、ページが初回に有効化するまで起動しない。
   rdev::listen は一度起動すると外せないため、無効化はコールバック内の
   ゲートで行う。無効の間イベントは即座に捨て、座標も保持しない。
   注意: フラッシュは app.emit = 全 webview へのブロードキャストのまま。
   購読してよいのは帯 (owner) のページだけ（viewer は購読しない＝二重計数防止）。 */

#[derive(Clone, serde::Serialize)]
struct InputActivity {
    keys: u64,
    #[serde(rename = "distPx")]
    dist_px: f64,
    clicks: u64,
}

struct InputCore {
    enabled: AtomicBool,
    started: AtomicBool,
    keys: AtomicU64,
    clicks: AtomicU64,
    dist: Mutex<f64>,
    last_pos: Mutex<Option<(f64, f64)>>,
    debug: bool,
    log_path: PathBuf,
}

struct InputState {
    core: Arc<InputCore>,
}

fn input_debug_log(core: &InputCore, msg: &str) {
    if !core.debug {
        return;
    }
    let line = format!("{} {}\n", now_ms(), msg);
    if let Ok(mut f) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&core.log_path)
    {
        let _ = f.write_all(line.as_bytes());
    }
}

/// リスナー＋フラッシュ係の起動（初回の有効化時のみ。以後の呼び出しは無操作）
fn ensure_input_listener(app: &AppHandle) {
    let core = app.state::<InputState>().core.clone();
    if core.started.swap(true, Ordering::SeqCst) {
        return;
    }
    input_debug_log(&core, "listener=started");
    // フラッシュ係: 約5秒ごとに集計をページへ送り、カウンタをリセットする
    {
        let app2 = app.clone();
        let core2 = core.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(5));
            if !core2.enabled.load(Ordering::SeqCst) {
                continue;
            }
            let keys = core2.keys.swap(0, Ordering::SeqCst);
            let clicks = core2.clicks.swap(0, Ordering::SeqCst);
            let dist = {
                let mut d = core2.dist.lock().unwrap_or_else(|e| e.into_inner());
                let v = *d;
                *d = 0.0;
                v
            };
            if keys == 0 && clicks == 0 && dist <= 0.0 {
                continue;
            }
            input_debug_log(
                &core2,
                &format!("flush keys={} distPx={:.0} clicks={}", keys, dist, clicks),
            );
            let _ = app2.emit(
                "input-activity",
                InputActivity {
                    keys,
                    dist_px: dist,
                    clicks,
                },
            );
        });
    }
    // リスナー係: rdev のグローバル購読。キーの中身は見ず、回数だけを数える
    std::thread::spawn(move || {
        let core3 = core.clone();
        let _ = rdev::listen(move |event| {
            let on = core3.enabled.load(Ordering::SeqCst);
            match event.event_type {
                rdev::EventType::KeyPress(_) => {
                    if on {
                        core3.keys.fetch_add(1, Ordering::Relaxed);
                    }
                }
                rdev::EventType::ButtonPress(_) => {
                    if on {
                        core3.clicks.fetch_add(1, Ordering::Relaxed);
                    }
                }
                rdev::EventType::MouseMove { x, y } => {
                    let mut lp = core3.last_pos.lock().unwrap_or_else(|e| e.into_inner());
                    if on {
                        if let Some((lx, ly)) = *lp {
                            let d = ((x - lx) * (x - lx) + (y - ly) * (y - ly)).sqrt();
                            if d > 0.0 {
                                *core3.dist.lock().unwrap_or_else(|e| e.into_inner()) += d;
                            }
                        }
                        *lp = Some((x, y));
                    } else {
                        // 無効の間は座標を保持しない（再有効化時の距離の跳ね防止も兼ねる）
                        *lp = None;
                    }
                }
                _ => {}
            }
        });
    });
}

/// ページからの有効化／無効化。冪等（同じ値の再送・連打は無害）。
/// invoke 自体はどのウィンドウからでも届くが、呼ぶのは帯 (owner) のページだけ
/// というページ側ロールの規律で一元化する（設計 §5.2）
#[tauri::command]
fn set_input_counting(enabled: bool, app: AppHandle, window: tauri::Window, state: tauri::State<InputState>) {
    if window.label() != WIN_STRIP {
        return; // OS 全体の入力集計を切り替えられるのは帯のページだけ (設計 §5.2 を Rust 側でも担保)
    }
    guard("cmd set_input_counting", || set_input_counting_inner(enabled, &app, &state));
}

fn set_input_counting_inner(enabled: bool, app: &AppHandle, state: &tauri::State<InputState>) {
    state.core.enabled.store(enabled, Ordering::SeqCst);
    input_debug_log(&state.core, &format!("set enabled={}", enabled));
    if enabled {
        ensure_input_listener(app);
    }
}

fn toggle_window(app: &AppHandle) {
    dlog("toggle_window: enter (tray path)");
    if let Some(w) = app.get_webview_window(WIN_STRIP) {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            let _ = w.show();
            let _ = w.set_focus();
        }
    }
}

/// 管理ウィンドウのドラッグ・リサイズ中の形状を覚え、永続化はスロットルする
/// 形状ウォッチャ (2.3.10): 帯と管理ウィンドウの現在形状を state へ写し、
/// 変わった時だけ永続化する低頻度スレッド。
/// 窓イベントハンドラ (Moved/Resized/CloseRequested) の中で窓API
/// (outer_position / inner_size) を読むのは Windows で固まる疑いがあるため、
/// 形状の取り込みはこのスレッドに一本化した (ヒットループと同じ
/// 「専用スレッドから読む」作法)。帯の ◥ ドラッグも、止まって最大2秒で
/// ここが拾って保存する。
fn spawn_geom_watch(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_millis(2000));
        let state = app.state::<ShellState>();
        let mut changed = false;
        if let Some(w) = app.get_webview_window(WIN_STRIP) {
            if w.is_visible().unwrap_or(false) {
                if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
                    let g = Geom {
                        x: pos.x,
                        y: pos.y,
                        w: size.width,
                        h: size.height,
                        set: true,
                    };
                    let mut cur = state.strip_pos.lock().unwrap_or_else(|e| e.into_inner());
                    if (cur.x, cur.y, cur.w, cur.h) != (g.x, g.y, g.w, g.h) {
                        *cur = g;
                        changed = true;
                    }
                }
            }
        }
        if let Some(w) = app.get_webview_window(WIN_MENU) {
            if let (Ok(pos), Ok(size)) = (w.outer_position(), w.inner_size()) {
                let g = Geom {
                    x: pos.x,
                    y: pos.y,
                    w: size.width,
                    h: size.height,
                    set: true,
                };
                let mut cur = state.menu_geom.lock().unwrap_or_else(|e| e.into_inner());
                if (cur.x, cur.y, cur.w, cur.h) != (g.x, g.y, g.w, g.h) {
                    *cur = g;
                    changed = true;
                }
            }
        }
        if changed
            && now_ms().saturating_sub(state.last_save_ms.load(Ordering::Relaxed)) > 800
        {
            persist(&state);
        }
    });
}

fn main() {
    tauri::Builder::default()
        // 二重起動したら既存の帯を前面に出すだけ（管理ウィンドウは触らない）
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window(WIN_STRIP) {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        // v2.3.5: 自動アップデート。チェック先は tauri.conf.json の plugins.updater
        // （GitHub Releases の latest.json）。更新の署名検証は同梱の公開鍵で行う。
        .plugin(tauri_plugin_updater::Builder::new().build())
        // 更新後の再起動（ページ側の relaunch）用
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_menu,
            close_menu,
            set_mode_full,
            set_mode_strip,
            set_mode_overlay,
            hide_main_window,
            hide_strip_window,
            set_hit_zones,
            set_input_counting,
            reset_strip_position,
            set_strip_scale,
            save_game
        ])
        .setup(|app| {
            // ---- 状態の読み込み ----
            let cfg_dir = app
                .path()
                .app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let path = cfg_dir.join("miyuke-shell.json");
            let hit_log_path = cfg_dir.join("miyuke-hit-debug.log");
            /* v2.4.1: フォルダが無いと序盤の dlog が書けずに消える (実害: 新規
               プロファイルで setup 序盤の記録が欠落した)。先に作っておく */
            let _ = fs::create_dir_all(&cfg_dir);
            let _ = DLOG_PATH.set(cfg_dir.join("miyuke-shell-debug.log"));
            /* v2.4.1: どのスレッドで panic が起きても dlog へ残す (連鎖死の証跡) */
            std::panic::set_hook(Box::new(|info| {
                dlog(&format!("PANIC HOOK: {}", info));
            }));
            dlog("setup: start");
            start_beacon(app.handle());
            let hit_debug = std::env::var("MIYUKE_DEBUG_HIT").ok().as_deref() == Some("1");
            if hit_debug {
                // デバッグログの書き込み先を先に作っておく（persist 前でも書けるように）
                let _ = fs::create_dir_all(&cfg_dir);
            }
            // ---- Phase 2: 入力集計の状態（既定OFF。リスナーは初回有効化まで起動しない） ----
            let input_debug = std::env::var("MIYUKE_DEBUG_INPUT").ok().as_deref() == Some("1");
            let input_core = Arc::new(InputCore {
                enabled: AtomicBool::new(false),
                started: AtomicBool::new(false),
                keys: AtomicU64::new(0),
                clicks: AtomicU64::new(0),
                dist: Mutex::new(0.0),
                last_pos: Mutex::new(None),
                debug: input_debug,
                log_path: cfg_dir.join("miyuke-input-debug.log"),
            });
            if input_debug {
                let _ = fs::create_dir_all(&cfg_dir);
                input_debug_log(&input_core, "boot enabled=false listener=not_started");
            }
            app.manage(InputState { core: input_core });
            let loaded = load_persisted(&path);
            app.manage(ShellState {
                aot_menu: Mutex::new(loaded.aot_menu),
                menu_geom: Mutex::new(loaded.menu_geom),
                strip_pos: Mutex::new(loaded.strip_pos),
                strip_scale: Mutex::new(loaded.strip_scale),
                pending_tab: Mutex::new(None),
                path,
                last_save_ms: AtomicU64::new(0),
                hit_zones: Mutex::new(None),
                ignoring: Mutex::new(false),
                hit_debug,
                hit_log_path,
            });

            // ---- menu の menu-ready を Rust でも受け、保持中のタブ指定を再送する ----
            // （ページ読込前に open_menu された場合の取りこぼし防止。設計 §4.3）
            {
                let handle = app.handle().clone();
                app.listen("menu-ready", move |_event| {
                    send_pending_tab(&handle);
                });
            }

            // ---- トレイ ----
            let toggle_i = MenuItem::with_id(app, "toggle", "みゅけを表示／隠す", true, None::<&str>)?;
            let open_full_i = MenuItem::with_id(app, "open_full", "大きく開く（管理画面）", true, None::<&str>)?;
            let close_menu_i = MenuItem::with_id(app, "close_menu", "管理画面を閉じる", true, None::<&str>)?;
            let aot_checked = *app.state::<ShellState>().aot_menu.lock().unwrap_or_else(|e| e.into_inner());
            let aot_i = CheckMenuItem::with_id(
                app,
                "aot",
                "常に手前に表示",
                true,
                aot_checked,
                None::<&str>,
            )?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&toggle_i, &open_full_i, &close_menu_i, &aot_i, &sep, &quit_i],
            )?;

            let aot_item = aot_i.clone();
            TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("みゅけ、きょうも開発中")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    dlog(&format!("tray menu event: {}", event.id.as_ref()));
                    guard("tray menu", || match event.id.as_ref() {
                    "toggle" => toggle_window(app),
                    "open_full" => open_menu_impl(app, None),
                    "close_menu" => close_menu_impl(app),
                    "aot" => {
                        // 「常に手前に表示」は管理ウィンドウの希望（帯は常時ON固定）
                        let state = app.state::<ShellState>();
                        let new_val = {
                            let mut a = state.aot_menu.lock().unwrap_or_else(|e| e.into_inner());
                            *a = !*a;
                            *a
                        };
                        if let Some(w) = app.get_webview_window(WIN_MENU) {
                            let _ = w.set_always_on_top(new_val);
                        }
                        let _ = aot_item.set_checked(new_val);
                        persist(&state);
                    }
                    "quit" => {
                        dlog("tray quit: persisting, asking the page to save, then exit(0)");
                        let state = app.state::<ShellState>();
                        if let Some(w) = app.get_webview_window(WIN_MENU) {
                            capture_menu_geom(&w, &state);
                        }
                        persist(&state);
                        // 最後の進行 (最大10秒分) を失わないよう、帯のページに保存させてから終える
                        let _ = app.emit_to(WIN_STRIP, "save-now", ());
                        let app2 = app.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(Duration::from_millis(600));
                            app2.exit(0);
                        });
                    }
                    _ => {}
                    });
                })
                .on_tray_icon_event(|tray, event| {
                    // トレイの左クリックでも帯の表示／隠す
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                    // v2.4.1: ダブルクリックで管理メニューを開く (ページを
                    // 経由しない開き方。帯ボタンが効かない環境への迂回路)
                    if let TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle().clone();
                        guard("tray double-click", move || {
                            open_menu_impl(&app, None);
                        });
                    }
                })
                .build(app)?;

            // ---- 帯ウィンドウ（帯構成で生成し、非表示のまま形状を整えてから出す） ----
            // 生成直後のサイズが目標と大きく違うと、WM の無い環境では表示時の
            // サイズ交渉で初回サイズが残ることがあるため、最初から帯に近い形で作る。
            let init_script = format!(
                "window.__MIYUKE_MODE__ = 'strip'; window.__MIYUKE_ROLE__ = 'owner';{}{}",
                beacon_init_script(),
                save_init_script(app.handle())
            );
            let win = WebviewWindowBuilder::new(app, WIN_STRIP, WebviewUrl::App("index.html".into()))
                .title("みゅけ、きょうも開発中")
                .initialization_script(init_script)
                .transparent(true)
                .visible(false)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .shadow(false)
                .resizable(true)
                .inner_size(1280.0, STRIP_BASE_H)
                .build()?;
            let saved_strip = *app.state::<ShellState>().strip_pos.lock().unwrap_or_else(|e| e.into_inner());
            apply_strip_to_window(&win, &saved_strip, loaded.strip_scale);
            win.show()?;
            dlog(&format!(
                "setup: strip window shown; loaded menu_geom={:?} strip_pos={:?} strip_scale={:.2}",
                loaded.menu_geom, loaded.strip_pos, loaded.strip_scale
            ));
            // 表示直後にもう一度形状を適用する（未表示・リサイズ不可の状態で作った
            // ウィンドウは、GTK が初回のサイズ要求を取りこぼすことがあるため）
            apply_strip_to_window(&win, &saved_strip, loaded.strip_scale);
            // テスト用: MIYUKE_START_MODE=full で管理ウィンドウも開いて起動する
            // （旧「フルで起動」の読み替え。帯はいつも帯のまま）
            if std::env::var("MIYUKE_START_MODE").ok().as_deref() == Some("full") {
                open_menu_impl(app.handle(), None);
            }
            // ヒットゾーン式クリック透過の常駐ループを開始する
            spawn_hit_loop(app.handle());
            // 形状の取り込み (帯位置・メニュー形状の保存) はこのスレッドに一本化
            spawn_geom_watch(app.handle());
            /* v2.4.1: 管理ウィンドウは起動時に先行生成 (非表示のまま)。
               「開く」が既存窓の show だけで済むようにし、イベント
               ハンドラ内での窓生成 (Windows で固まる疑い) を避ける */
            guard("setup eager menu build", || {
                let _ = build_menu_window(app.handle());
            });
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Destroyed => {
                dlog(&format!("window destroyed: {}", window.label()));
            }
            // ×ボタンでは終了せず、トレイに隠れるだけ（本当の終了はトレイメニューから）
            // ※ 形状の取り込みはここでは行わない (2.3.10): 窓イベントハンドラの中で
            //   窓API (outer_position 等) を読むのは Windows で固まる疑いがあり、
            //   取り込みは spawn_geom_watch の低頻度スレッドに一本化した。
            WindowEvent::CloseRequested { api, .. } => {
                dlog(&format!("CloseRequested: {}", window.label()));
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
