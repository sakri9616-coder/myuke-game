/* ---------- 描画カウンタ ---------- */
/* Strip Canon (2026-10-24): 部屋シーンは廃止。ゲームの世界は帯だけになり、
   このファイルの描画は帯レンダラ（renderStrip）と DOM パネルだけになった。
   設計根拠は research/STRIP_CANON_RESEARCH.md (R1-R14 / 移行スペック §c)。 */
let frame = 0;
/* v2.3.6(予定) A: 描画 60fps 化に伴い、frame は「150ms 単位の見た目時計」
   として実時間から換算する (frameAcc が実数部を持つ)。frame 連動の見た目
   (点滅・ボブ・Z の漂い・紙吹雪・棚グロー frame+40≒6秒) の速度を不変に保つ */
let frameAcc = 0;

/* ---------- v2: スプライト層 ----------
   window.MIYUKE_SPRITES（palette + 文字列マップ）があればオフスクリーン
   キャンバス化して帯レンダラ（sDrawSprite）で使う。無ければ手続き描画にフォールバック。

   【描画契約（厳密サイズ仕様）】
   - みゅけ系は全て 48×40、スタッフ猫 32×24、アヒル 24×20、アイコン 16×16。
     小物: plant 16×20 / coffee 28×28 (sakuri作画・湯気2fアニメ) / server 24×32 / packmachine 48×24 / shelf 40×28。
   - アンカーは全スプライト共通で「下端中央」: sDrawSprite(name, gx, gy, scale) の
     (gx, gy) は地面ライン上の接地点。スプライトの下2行が地面に接する前提で描く。
   - 実際の描画寸法はキャンバスの実寸を優先する。仕様と違うサイズの絵が来ても
     下端中央アンカーで描くので配置は崩れない（buildSprites で警告だけ出す）。 */
const SPRITE_SPEC = {
  miyuke_idle:[48,40], miyuke_code_a:[48,40], miyuke_code_b:[48,40], miyuke_think:[48,40],
  miyuke_debug:[48,40], miyuke_sleep:[48,40], miyuke_yarn:[48,40],
  miyuke_snack:[48,40], miyuke_happy:[48,40],
  duck_idle:[24,20], duck_check:[24,20],
  icon_coin:[16,16], icon_idea:[16,16], icon_bug:[28,28], icon_box:[28,28], icon_star:[16,16],
  icon_fish:[16,16], icon_book:[16,16], icon_wrench:[28,28], icon_heart:[16,16],
  prop_plant:[16,20], prop_coffee:[28,28], prop_coffee_0:[28,28], prop_coffee_1:[28,28], prop_server:[24,32], prop_packmachine:[48,24], prop_shelf:[40,28], prop_ship:[48,48], prop_annex_sign:[48,48], prop_sign_gold:[48,48], prop_star_gold:[24,24], prop_trophy_gold:[24,24], prop_snackbox:[24,24], prop_snackbox_shut:[24,24],
  prop_pc:[40,32],
  /* 環境ドット絵 (Codex 一次作・research/ENV_ART_MANIFEST.md): 既存パレットのみ */
  prop_kanban:[132,30], prop_kanban_wide:[204,64], prop_phone:[24,24], prop_megaphone:[24,24], prop_toolbox:[24,24], desk_laminate_main:[116,3], desk_laminate_2:[80,16],
  desk_laminate_2_sprite:[40,24], prop_chair:[32,36], prop_server_rack:[48,64],
  shelf_steel:[40,28], prop_books:[24,7], prop_archive_boxes:[18,25], prop_mat:[150,4]
};
/* 帯レンダラのスケール比（仕様 48:32:24）。
   みゅけ ×2 / スタッフ ×4/3 / アヒル ×1 = 96:43:24。
   バッチ6: sakuri作画スタッフ (48×40 統一仕様) は staff48 = ×3/2 で 72×60 に
   描く (みゅけ 96×80 の 3/4 — 主人公より一回り小さい)。ANIMS の無い毛柄は
   従来の staff (32×24 ×4/3) のまま */
const SPRITE_SCALES = {
  strip: { miyuke: 2, staff: 4/3, staff48: 3/2, duck: 1 }
};
for(const coat of COATS){
  SPRITE_SPEC["staff_" + coat + "_sit"] = [32,24];
  SPRITE_SPEC["staff_" + coat + "_walk"] = [32,24];
}
/* バッチ9: syamu には旧 32×24 絵が無いため、基準絵は sakuri作画フレーム
   (48×40) そのもの。上の登録を実寸で上書きする */
SPRITE_SPEC["staff_syamu_sit"] = [48,40];
SPRITE_SPEC["staff_syamu_walk"] = [48,40];
/* バッチ13: hachiware_gray / chashiro も syamu と同様、旧絵が無いため
   基準絵は sakuri作画フレーム (48×40) そのもの */
SPRITE_SPEC["staff_hachiware_gray_sit"] = [48,40];
SPRITE_SPEC["staff_hachiware_gray_walk"] = [48,40];
SPRITE_SPEC["staff_chashiro_sit"] = [48,40];
SPRITE_SPEC["staff_chashiro_walk"] = [48,40];
/* B-P1-2: 子ねこボットのスプライト名前契約（契約のみ・絵は未着手）。
   寸法は小柄な同僚クラスとしてアヒルと同じ 24×20。絵が届くまでは
   描画コードはこの名前を参照せず、ボットの見た目・挙動は変わらない */
SPRITE_SPEC["bot_idle"] = [24,20];
SPRITE_SPEC["bot_carry"] = [24,20];
/* sakuri作画アニメーションのフレームは ANIMS 定義（生成物）から登録する。
   ANIMS の宣言後にまとめて SPRITE_SPEC へ入れる（この時点では未宣言） */
let spriteCache = {};
function buildSprites(){
  spriteCache = {};
  if(typeof window === "undefined" || !window.MIYUKE_SPRITES) return;
  const pal = window.MIYUKE_SPRITES.palette || {};
  const sprites = window.MIYUKE_SPRITES.sprites || {};
  for(const name of Object.keys(sprites)){
    const rows = sprites[name];
    if(!rows || !rows.length || !rows[0]) continue;
    const cv = document.createElement("canvas");
    cv.width = rows[0].length; cv.height = rows.length;
    const cx = cv.getContext("2d");
    for(let y = 0; y < rows.length; y++){
      const row = rows[y];
      for(let x = 0; x < row.length; x++){
        const col = pal[row[x]];
        if(!col) continue;
        cx.fillStyle = col; cx.fillRect(x, y, 1, 1);
      }
    }
    const spec = SPRITE_SPEC[name];
    if(spec && (cv.width !== spec[0] || cv.height !== spec[1])){
      console.warn("[miyuke] sprite size differs from spec: " + name +
        " got " + cv.width + "x" + cv.height + ", spec " + spec[0] + "x" + spec[1] +
        " (bottom-center anchor keeps placement intact)");
    }
    stripStaticImages.add(cv);
    spriteCache[name] = cv;
  }
}
function hasSprite(name){ return !!spriteCache[name]; }
/* 実寸（キャンバス優先）。無ければ仕様寸法、それも無ければ null */
function spriteSize(name){
  const cv = spriteCache[name];
  if(cv) return [cv.width, cv.height];
  return SPRITE_SPEC[name] || null;
}
/* ---------- sakuri作画アニメーション ----------
   定義は tools/import-sakuri-art.py が生成する window.MIYUKE_ANIMS が正本
   （フレーム別 durations 配列＋ループ区間）。ここに手写し定数は持たない。
   フレーム列を持つスプライトは、状態に入ってからの経過時間でフレームを選ぶ。
   loopFrom/loopTo はループ区間のフレーム番号（0始まり、両端含む）、
   loopCount はループ区間を何周するか（Infinity = ずっと繰り返し）。
   idle: 全6フレームをループ。snack: 冒頭2フレーム → 3〜14フレーム目を3周 → 最後3フレーム。 */
const ANIMS: Record<string, AnimDef> = window.MIYUKE_ANIMS || {
  miyuke_idle: {
    frames: [0,1,2,3,4,5].map(i => "miyuke_idle_" + i),
    durations: [100,100,100,100,100,100], loopFrom: 0, loopTo: 5, loopCount: Infinity
  },
  miyuke_snack: {
    frames: Array.from({length: 17}, (_, i) => "miyuke_snack_" + i),
    durations: Array(17).fill(100), loopFrom: 2, loopTo: 13, loopCount: 3
  },
  /* Sprint 4: 既存2フレームの機械的アニメ化（idle 長め + check 一瞬） */
  duck: { frames: ["duck_idle", "duck_check"], durations: [1400, 350], loopFrom: 0, loopTo: 1, loopCount: Infinity, direction: "forward" }
};
/* ANIMS の全フレームを SPRITE_SPEC に登録（48×40 統一） */
for(const bname of Object.keys(ANIMS))
  for(const fn of ANIMS[bname].frames)
    if(!SPRITE_SPEC[fn]) SPRITE_SPEC[fn] = [48,40];
/* 区間 [i0, i1] の duration 合計 */
function animSegMs(a, i0, i1){ let s = 0; for(let i = i0; i <= i1; i++) s += a.durations[i] || 0; return s; }
/* アニメの総再生時間 (ms)。snack = 300 + 1300×3 + 300 = 4500ms (ループ区間はファイルのタグ 3..13 が正本) */
function animDuration(base){
  const a = ANIMS[base];
  if(!a) return 0;
  if(a.loopCount === Infinity) return Infinity;
  return animSegMs(a, 0, a.loopFrom - 1)
    + animSegMs(a, a.loopFrom, a.loopTo) * a.loopCount
    + animSegMs(a, a.loopTo + 1, a.frames.length - 1);
}
/* 経過時間 (ms) から表示すべきフレーム名を返す。フレーム実物が無ければ基準名のまま */
function animFrameAt(base, elapsed){
  const a = ANIMS[base];
  if(!a) return base;
  const n = a.frames.length;
  const introMs = animSegMs(a, 0, a.loopFrom - 1);
  const loopMs = Math.max(1, animSegMs(a, a.loopFrom, a.loopTo));
  const outroMs = animSegMs(a, a.loopTo + 1, n - 1);
  const pick = (i0, i1, off) => {
    let acc = 0;
    for(let i = i0; i <= i1; i++){ acc += a.durations[i] || 0; if(off < acc) return i; }
    return i1;
  };
  let idx;
  if(elapsed < introMs) idx = pick(0, a.loopFrom - 1, elapsed);
  else if(a.loopCount !== Infinity && elapsed >= introMs + loopMs * a.loopCount){
    idx = outroMs > 0 ? pick(a.loopTo + 1, n - 1, Math.min(outroMs - 1, Math.max(0, elapsed - introMs - loopMs * a.loopCount))) : n - 1;
  } else {
    /* Sprint 4: Aseprite タグの direction をループ区間に適用する。
       forward=順再生 / reverse=逆再生 / pingpong=往復 / pingpong_reverse=逆から往復。
       導入部と締めは常に順方向（タグはループ区間への指定として扱う） */
    const t = elapsed - introMs;
    const pass = Math.floor(t / loopMs);
    const off = t % loopMs;
    const dir = a.direction || "forward";
    const reversed = dir === "reverse" ||
      (dir === "pingpong" && pass % 2 === 1) ||
      (dir === "pingpong_reverse" && pass % 2 === 0);
    if(reversed){
      let acc = 0; idx = a.loopFrom;
      for(let i = a.loopTo; i >= a.loopFrom; i--){
        acc += a.durations[i] || 0;
        idx = i;
        if(off < acc) break;
      }
    } else {
      idx = pick(a.loopFrom, a.loopTo, off);
    }
  }
  const name = a.frames[idx];
  return hasSprite(name) ? name : base;
}
/* みゅけスプライト選択フック（帯の描画系がここを通る）:
   アニメ対象の基準名なら、現在の状態に入ってからの経過時間でフレーム名に差し替える */
function catSprite(name){
  if(!ANIMS[name]) return name;
  /* Sprint 4: レートドライバ登録済みの基準名は、ドライバ時計で再生する
     （コーディング絵の速度＝集中力連動はここで効く） */
  if(ANIM_RATE_DRIVERS[name]) return animFrameAt(name, drivenElapsed(name));
  return animFrameAt(name, Date.now() - stateEnteredAt);
}
/* Sprint 4: アヒルは実在する2フレーム（duck_idle / duck_check）を ANIMS で
   再生する（新規アートは作らない・既存データの機械的な拡張のみ）。
   時計は絶対時刻でよい（全体ループのアニメなので） */
function duckSprite(){
  if(ANIMS.duck) return animFrameAt("duck", Date.now());
  return "duck_idle";
}

/* ---------- Sprint 3→Strip Canon: 棚コレクションの共通データ ----------
   帯の作品棚家具（ゾーン B）に並ぶミニボックスの色と、最新作の金枠グロー期限。
   スロット座標は帯レンダラ側の stripShelfSlots() が持つ（棚板の実測位置）。
   並ぶ数は min(総リリース数≒ S.shelf.length, 枠数)。最新作はリリース直後
   しばらく金枠で光る（shelfGlowFrame はリリース時にセットされる） */
let shelfGlowFrame = -1;
/* ---------- ストリップモード描画（デスクトップ下部の帯に直接住む） ----------
   仮想空間は高さ 120 単位・幅は画面アスペクト可変。地面は下端 -4。
   机まわり（30%付近）にワークステーション、みゅけは状態機械のまま
   机に座る／床を散歩する。スタッフは視覚専用ウォーカーとして帯を歩く。
   シミュレーションには一切触らない（ビュー専用）。 */
const stripCv = document.getElementById("strip") as HTMLCanvasElement | null;
const sctx: CanvasRenderingContext2D | null = stripCv ? makeStripFrameCtx(stripCv.getContext("2d")) : null;   /* 描画の軽量化: strip-frame.ts */
const STRIP_H = 120, STRIP_GROUND = STRIP_H - 4;
let stripVW = 640, stripScale = 2, stripNow = 0;
let miyukeStrip = { x: -1, targetX: 0, dir: 1, moving: false, nextPick: 0, walkClock: 0 };
const stripWalkers = {};
let stripFloaters = [], stripSparks = [];
let lastReleasesSeen = -1;
/* ヒットゾーン式クリック透過用: renderStrip が毎フレーム、見えているものの
   矩形を仮想座標で記録する。publishHitZones が CSS px に変換して Rust へ送り、
   ゾーン外のクリックはデスクトップへ素通しになる（帯の下のアイコンが押せる） */
let stripHitRects: StripHitRects = { desk: null, miyuke: null, staff: [], duck: null, bubble: null, fish: null, bugs: [], shelf: null, board: null, board2: null, piles: [] };
/* v2.4.6: ホバー中の論理座標 (なければ null) と、黄色枠を出す対象の解決。
   クリック判定と同じ優先順位で、最初に当たった操作可能オブジェクトを返す */
let stripHover = null;
function stripHoverTarget(){
  if(!stripHover) return null;
  const R = stripHitRects, p = stripHover;
  const inR = (r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
  for(const k of ["bubble", "fish", "snack", "memo", "board", "board2", "phone", "megaphone", "toolbox", "research", "rack", "trophy", "calendar", "shelf", "miyuke", "desk", "duck"])
    if(inR(R[k])) return { r: R[k], key: k, idx: -1 };
  for(const k of ["bugs", "stockBugs", "piles", "staff"]){
    const arr = R[k] || [];
    for(let i = 0; i < arr.length; i++) if(inR(arr[i])) return { r: arr[i], key: k, idx: i };
  }
  return null;
}
function stripHoverRect(){
  const t = stripHoverTarget();
  return t ? t.r : null;
}
/* 描画中の主要スプライトの配置レジストリ (ホバーの輪を「その絵の形」に合わせる
   ため、描画関数が自分のスプライト名と置き場所を記録する) */
let stripObjArt: Record<string, any> = {}, stripStaffArt = [];
/* 点滅を控える: OS の「視差効果を減らす」か、設定の「点滅を減らす」が ON のとき。
   状態を知らせる点滅 (企画中・雇える・ゲージ満タン等) は点けっぱなしにする
   (色で伝わるので情報は欠けない。WCAG 2.2.2: 5秒を超えて続く点滅を止められること) */
let reducedMotionMQ = null;
try{ reducedMotionMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null; }catch(e){}
function motionReduced(){
  return !!((S.settings && S.settings.reduceMotion) || (reducedMotionMQ && reducedMotionMQ.matches));
}
/* frame % period < on と同じ点滅。控える設定のときは常に点灯 */
function blinkOn(period, on){ return motionReduced() || frame % period < on; }
const spriteHaloCache = {};
function yellowSpriteOf(name){
  if(name in spriteHaloCache) return spriteHaloCache[name];
  const src = spriteCache[name];
  if(!src){ spriteHaloCache[name] = null; return null; }
  const cv = document.createElement("canvas");
  cv.width = src.width; cv.height = src.height;
  const c2 = cv.getContext("2d");
  c2.drawImage(src, 0, 0);
  c2.globalCompositeOperation = "source-in";
  c2.fillStyle = "#ffd94d"; c2.fillRect(0, 0, cv.width, cv.height);
  stripStaticImages.add(cv);
  spriteHaloCache[name] = cv;
  return cv;
}
/* スプライトそのものの輪郭に沿う縁取り。画面の切り抜きと違い、隣の家具の
   線を拾わない (sakuri: 電話の上下に黄色い線が見える、への対処) */
function drawHoverSpriteHalo(art){
  const yc = yellowSpriteOf(art.name);
  if(!yc) return false;
  const devW = yc.width * art.s * stripScale, devH = yc.height * art.s * stripScale;
  const dx = Math.round((art.gx - yc.width * art.s / 2) * stripScale);
  const dy = Math.round((art.gy - yc.height * art.s) * stripScale);
  const d = Math.max(1, Math.round(stripScale * 1.4));
  const w = Math.ceil(devW) + d * 2, h = Math.ceil(devH) + d * 2;
  if(!hoverHaloCv) hoverHaloCv = document.createElement("canvas");
  if(hoverHaloCv.width !== w) hoverHaloCv.width = w;
  if(hoverHaloCv.height !== h) hoverHaloCv.height = h;
  const hx = hoverHaloCv.getContext("2d");
  hx.clearRect(0, 0, w, h);
  hx.imageSmoothingEnabled = false;
  hx.save();
  if(art.flip){ hx.translate(w, 0); hx.scale(-1, 1); }
  for(const [ox, oy] of [[-d,0],[d,0],[0,-d],[0,d],[-d,-d],[d,-d],[-d,d],[d,d]])
    hx.drawImage(yc, ox + d, oy + d, devW, devH);
  hx.globalCompositeOperation = "destination-out";
  hx.drawImage(yc, d, d, devW, devH);
  hx.globalCompositeOperation = "source-over";
  hx.restore();
  sctx.save();
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.drawImage(hoverHaloCv, dx - d, dy - d);
  sctx.restore();
  return true;
}
function drawHoverTarget(t){
  const art = t.key === "staff" ? stripStaffArt[t.idx] : stripObjArt[t.key];
  if(art && drawHoverSpriteHalo(art)) return;
  drawHoverSilhouette(t.r);
}
/* ホバーの縁取り: 対象の当たり判定内の「実際に描かれたピクセル」をマスクに
   して黄色く膨らませ、元の形をくり抜いた輪だけを重ねる。四角い枠ではなく
   絵そのものの輪郭に沿う (sakuri: 「普通絵のシェイプに合わせるでしょうに」)。
   オフスクリーン2枚を使い回す。getImageData の無い環境 (smoke) では何もしない */
let hoverMaskCv = null, hoverHaloCv = null;
function drawHoverSilhouette(r){
  if(!stripCv || !sctx.getImageData) return;
  const pad = 1.2;
  const dx0 = Math.max(0, Math.floor((r.x - pad) * stripScale));
  const dy0 = Math.max(0, Math.floor((r.y - pad) * stripScale));
  const dx1 = Math.min(stripCv.width, Math.ceil((r.x + r.w + pad) * stripScale));
  const dy1 = Math.min(stripCv.height, Math.ceil((r.y + r.h + pad) * stripScale));
  const w = dx1 - dx0, h = dy1 - dy0;
  if(w < 2 || h < 2) return;
  let img;
  try { img = sctx.getImageData(dx0, dy0, w, h); } catch(e){ return; }
  if(!hoverMaskCv){ hoverMaskCv = document.createElement("canvas"); hoverHaloCv = document.createElement("canvas"); }
  for(const cv of [hoverMaskCv, hoverHaloCv]){
    if(cv.width !== w) cv.width = w;
    if(cv.height !== h) cv.height = h;
  }
  const mx = hoverMaskCv.getContext("2d");
  mx.clearRect(0, 0, w, h);
  mx.putImageData(img, 0, 0);
  mx.globalCompositeOperation = "source-in";
  mx.fillStyle = "#ffd94d"; mx.fillRect(0, 0, w, h);
  mx.globalCompositeOperation = "source-over";
  const hx = hoverHaloCv.getContext("2d");
  hx.clearRect(0, 0, w, h);
  const d = Math.max(1, Math.round(stripScale * 1.4));
  for(const [ox, oy] of [[-d,0],[d,0],[0,-d],[0,d],[-d,-d],[d,-d],[-d,d],[d,d]])
    hx.drawImage(hoverMaskCv, ox, oy);
  hx.globalCompositeOperation = "destination-out";
  hx.drawImage(hoverMaskCv, 0, 0);
  hx.globalCompositeOperation = "source-over";
  sctx.save();
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.drawImage(hoverHaloCv, dx0, dy0);
  sctx.restore();
}
