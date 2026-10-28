/* ---------- 2ウィンドウ化 (Phase 0/1): ロールと同期の共有状態 ----------
   owner (帯) がシミュレーションとセーブの唯一の所有者。viewer (管理ウィンドウ) は
   スナップショットで描画し、操作はコマンドで帯へ送る。ブラウザ版 (solo) は廃止。
   プロトコル本体はファイル末尾 (初期化の直前) の「同期プロトコル」節に置く。
   ここでは各所 (say / SoundKit / save / tick 等) が実行時に参照する状態だけを
   先に宣言しておく (let の TDZ を避けるため)。設計: research/TWO_WINDOW_ARCHITECTURE.md */
const ROLE = (function(){
  const r = (typeof window !== "undefined") ? window.__MIYUKE_ROLE__ : null;
  return r === "viewer" ? "viewer" : "owner";   /* 既定は帯 (Tauri の無い検証環境も owner) */
})();
const IS_VIEWER = ROLE === "viewer";
window.__MIYUKE_ROLE__ = ROLE;
let menuAwake = false;   /* owner の認識: menu が生きているか (heartbeat 5秒以内) */
let menuLastBeat = 0;    /* owner が最後に menu の heartbeat を受けた時刻 */
let snapSeq = 0;         /* スナップショットの単調増加カウンタ */
let snapRev = 0;         /* 状態リビジョン (tick / コマンド / セリフで進む) */
function bumpRev(){ snapRev++; }
/* 長押し連続購入 (buyMany) の最中は、1回ごとの保存・再描画・スナップショット・
   購入ログをまとめて最後に1回にする (連打のたびに全体を書き直すと重くなるため) */
let quietBuy: { log: { tm: string; text: string }[] } | null = null;

/* ---------- セーブデータ ---------- */
const GAME_VERSION = "v2.20.0";   /* 表示ラベルの単一の出所 (v2.20.0: 帯の残りの固定物も並べ替えで動かせるように。アプリ版数は tauri.conf.json の version と一致させる) */
const SAVE_KEY = "miyuke-save-v1";
function todayKey(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function freshState(): GameState {
  return {
    coins:0, ideas:0, packages:0, bugStock:0, rp:0, dust:0, prestiges:0,
    runDP:0, concentration:100,
    upgrades:{}, research:{}, stamps:{},
    project:null, projectDP:0, commitMark:0,
    activeRequest:null, requests:[], nextRequestGenre:null, bigDrawStreak:0,
    depts:{ prog:1, test:1, carry:1, research:1, care:1, sales:1, cheer:1 }, bigDeal:null, reqGenrePref:null, salesRot:0, reqHoldUntil:0,
    subs: [], subSeq: 0,
    fever: { gauge: 0 },
    debt: 0, brand: 0, vendorReadyAt: 0,
    shelf:[], recentNames:[],
    /* v2 追加分（v1セーブには無いので load() で補完される） */
    staff:[], staffSeq:0, studioLv:1, maxStudioLv:1, clickUp:{}, cheerP:0,
    wip:{ code:0, tested:0, built:0 },
    today:{ date:todayKey(), keys:0, cursorPx:0, lines:0, bugs:0, releases:0, commits:0, treats:0 },
    totals:{ keys:0, cursorPx:0, lines:0, bugsSquashed:0, releases:0, commits:0, coinsEarned:0, naps:0, playSec:0,
             clicks:0, crits:0, goldFish:0, eventBugs:0, hired:0 },
    flags:{}, log:[],
    /* Sprint 2 追加分（旧セーブには無いので load() の既定値マージで補完される）:
       sound は null = 未設定（フル=ON / 帯=OFF の自動）。lastSession は前回セッションの
       あらすじ（おかえりセレモニー用）。lastGiftAt は夢のお土産の最終付与時刻 */
    settings:{ pauseInput:false, sound:null, soundVol:0.5, inputCount:false, stripSize:1, stripSizeV:2, reduceMotion:false },
    lastSession:null, lastGiftAt:0,
    /* v2.4.0: 家具の並び（帯幅に対する比率 0..1）。空 = 既定配置。
       帯の「✥ 並べ替え」モードでドラッグして変更する */
    layout:{},
    layoutProps:{},
    /* Sprint 3 追加分: 星屑ショップの購入済み特典と、通算獲得星屑。
       生産倍率は dustTotal（通算）で決まるので、星屑を使っても倍率は下がらない */
    dustPerks:{}, dustTotal:0,
    /* 第2ウェーブ J 追加分: 第2層プレステージ（星団・レガシー技術・持株化回数・
       その時代の通算星屑）。持株化でのみ増減し、EXIT では消えない */
    legacy:0, legacyTech:{}, holdings:0, eraDust:0,
    /* 第2ウェーブ K 追加分: 挑戦中のチャレンジ { id, startLv }（段階6: 開始社格）と、
       獲得済みの永続報酬。報酬層は EXIT でも持株化でも消えない */
    challenge:null, challengeRewards:{},
    /* 第2ウェーブ L 追加分: 市場トレンド { boom, slump, nextBoom, nextSlump,
       cycleSec, announceAt }・開発ジャンルの方針・自社IP・常駐秒カウンタ */
    trend:null, devGenrePref:null, ips:[], residentSec:0,
    /* 再設計 段階1 追加分: 作品棚の毎秒売上 [{ n: 作品名, r: 🪙/秒 }]（新しい順・EXIT で消える） */
    catalog:[],
    /* 再設計 段階3 追加分: この会社が届いた企業価値の最高値（売却益と自動昇格の元・EXIT で 0）と、
       段階3より前の星屑の倍率（旧式で固めた値と、その時の通算星屑） */
    runPeakValue:0, dustLegacyMult:1, dustLegacyBase:0,
    /* 再設計 段階4 追加分: この会社の収入の内訳（収入源ごとの稼ぎ）と、応援クリックが作った DP */
    incomeBy:{}, runHandDP:0,
    /* 第2ウェーブ M 追加分: 役員猫（EXIT を生き残る常駐メンバー）と卒業記録 */
    executives:[], execAlumni:[],
    /* Sprint 4 追加分: 反復研究のレベルと、ご褒美の一時バフ { prodUntil, clickUntil } */
    genreKnow:{}, runGenre:{}, buffs:{},
    /* チュートリアル導線 (TUTORIAL_DESIGN.md): 進行ステージ・見たビート・
       スキップ有無だけを持つ。経済には一切干渉しない。引っ越しでも消えない */
    tut:{ stage:0, seen:{}, skipped:false },
    startedAt:Date.now(), lastTick:Date.now()
  };
}
let S: GameState = freshState();
/* 今セッションの開始時点の累計（save() が lastSession = 前回のあらすじ を作るための基準）。
   初期化時に load() 後の累計で差し替える */
let sessBase = { releases:0, coinsEarned:0, startedAt:Date.now() };
/* セーブの置き場所: 正本は Rust 側のファイル (app_data_dir/miyuke-save.json、
   save_game コマンドで書く)。WebView の localStorage にも同じものを書いておき、
   起動時は両方を見て lastTick の新しい方を採る (ファイルが無い旧セーブは
   localStorage から読み、次の save() でファイルへ移る) */
/* ファイルへの書き込みは SAVE_FILE_GAP_MS に1回までにまとめる (2026-10-27)。
   バグ潰し・魚などは1回ごとに save() するので、連打ツールで秒10回書き込み (毎回ディスク同期)
   になり、バグが出ると重くなる一因だった。localStorage は従来どおり毎回書くので、
   間引いた間に落ちても起動時は新しい方 (lastTick の大きい方) から読まれる */
const SAVE_FILE_GAP_MS = 2000;
let saveFileLastAt = 0, saveFilePending: string | null = null, saveFileTimer: any = 0;
function writeSaveFile(json: string, now?: boolean){
  const T = window.__TAURI__;
  if(!T || !T.core || !T.core.invoke) return;
  saveFilePending = json;
  const wait = SAVE_FILE_GAP_MS - (Date.now() - saveFileLastAt);
  if(!now && wait > 0){
    if(!saveFileTimer) saveFileTimer = setTimeout(() => { saveFileTimer = 0; if(saveFilePending) writeSaveFile(saveFilePending, true); }, wait);
    return;
  }
  if(saveFileTimer){ clearTimeout(saveFileTimer); saveFileTimer = 0; }
  saveFilePending = null;
  saveFileLastAt = Date.now();
  try{
    const p = T.core.invoke("save_game", { data: json });
    if(p && p.catch) p.catch(function(err){ console.error("[miyuke] セーブファイルの書き込みに失敗", err); });
  }catch(e){}
}
/* 終了直前など、間引かずにすぐ書く */
function flushSave(){
  save();
  if(saveFilePending) writeSaveFile(saveFilePending, true);
}
function saveLastTick(raw: string){
  try{ return Number(JSON.parse(raw).lastTick) || 0; }catch(e){ return -1; }
}
/* 起動時のセーブ文字列。ファイル側は1回だけ使う (以降の load() は localStorage を見る) */
function readStartupSave(): string | null {
  const fileRaw = typeof window.__MIYUKE_SAVE__ === "string" ? window.__MIYUKE_SAVE__ : null;
  window.__MIYUKE_SAVE__ = null;
  let lsRaw = null;
  try{ lsRaw = localStorage.getItem(SAVE_KEY); }catch(e){}
  if(!fileRaw) return lsRaw;
  if(!lsRaw) return fileRaw;
  return saveLastTick(lsRaw) > saveLastTick(fileRaw) ? lsRaw : fileRaw;
}
/* 起動時のセーブが読めなかったとき true。読めなかった元のセーブ (ファイルと
   localStorage) を新規状態で上書きしないよう、save() を止めておく。
   セーブの読み込み成功・初期化で解除される */
let saveBlocked = false;
/* セーブ由来の文字列はメニューの innerHTML に入るので、HTML として意味を持つ文字を
   全角に置き換えておく (ゲームが作る文字列にはこれらの半角文字は出てこない)。
   配布されたセーブに仕込まれたスクリプトが動かないようにする第1層 (第2層は表示時の esc) */
const SAVE_UNSAFE_CHARS: Record<string, string> = { "<": "＜", ">": "＞", "&": "＆", '"': "”", "'": "’", "`": "‘" };
function sanitizeSaveData(v: any, depth = 0): any {
  if(typeof v === "string") return v.replace(/[<>&"'`]/g, c => SAVE_UNSAFE_CHARS[c]);
  if(depth > 12 || v === null || typeof v !== "object") return v;
  if(Array.isArray(v)) return v.map(x => sanitizeSaveData(x, depth + 1));
  const out = {};
  for(const k of Object.keys(v)){
    if(k === "__proto__" || k === "constructor" || k === "prototype") continue;
    out[k] = sanitizeSaveData(v[k], depth + 1);
  }
  return out;
}
/* innerHTML に文字列を差し込むときの HTML エスケープ (表示側の第2層) */
const ESC_MAP: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(v: any): string {
  return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, c => ESC_MAP[c]);
}
/* 配列の中身が想定どおりのオブジェクトだけを残す (null や数値の混入で tick が毎秒落ちないように) */
function objectsOnly(arr: any): any[] {
  return Array.isArray(arr) ? arr.filter(x => x && typeof x === "object" && !Array.isArray(x)) : [];
}
/* onclick='trainStaff(id)' のように属性へ入る id は、必ず有限の整数にする */
function intOr(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function save(){
  if(IS_VIEWER) return;   /* 単一書き手: viewer はセーブに一切触らない (第2層ガード) */
  if(saveBlocked) return;
  if(quietBuy) return;   /* 連続購入の最後に buyMany が1回だけ保存する */
  try{
    S.lastTick = Date.now();
    if(sessBase){
      S.lastSession = {
        releases: Math.max(0, S.totals.releases - sessBase.releases),
        coinsEarned: Math.max(0, Math.round(S.totals.coinsEarned - sessBase.coinsEarned)),
        ms: Math.max(0, Date.now() - sessBase.startedAt),
        endedAt: Date.now()
      };
    }
    const json = JSON.stringify(S);
    try{ localStorage.setItem(SAVE_KEY, json); }catch(e){ console.error("[miyuke] localStorage への保存に失敗", e); }
    writeSaveFile(json);
  }catch(e){ console.error("[miyuke] save に失敗", e); }
}
/* rawText を渡せばそれを読む (セーブの読み込み機能)。省略時は起動時のセーブ */
function load(rawText?: string){
  if(IS_VIEWER) return false;   /* viewer は load もしない (レプリカはスナップショット由来) */
  /* 読み込みは「全部成功したときだけ反映」にする。途中の移行処理で例外が出たら
     元の状態に戻す (以前は S が半端に置き換わったまま false を返し、次の自動
     セーブで正常なセーブまで上書きしていた) */
  const prevS = S, prevTierSeen = officeTierSeen;
  const startup = rawText === undefined;
  let raw = null;
  try{
    raw = startup ? readStartupSave() : rawText;
    if(!raw) return false;
    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("save is not an object");
    const data = sanitizeSaveData(parsed);
    const f = freshState();
    /* 注意: Object.assign(f, data) で f.today 等は data 側に差し替わるため、
       既定値オブジェクトを先に退避してからマージする（新フィールドの補完用） */
    const defToday = f.today, defTotals = f.totals, defSettings = f.settings;
    S = Object.assign(f, data);
    /* v1 からある基本フィールドも型を確かめる (null の混入で起動不能にならないように) */
    for(const k of ["upgrades", "research", "stamps", "flags", "clickUp", "depts"])
      if(!S[k] || typeof S[k] !== "object" || Array.isArray(S[k])) S[k] = {};
    S.requests = objectsOnly(S.requests);
    S.shelf = objectsOnly(S.shelf);
    S.log = objectsOnly(S.log);
    S.ips = objectsOnly(S.ips);
    S.catalog = objectsOnly(S.catalog).filter(e => typeof e.r === "number" && isFinite(e.r) && e.r >= 0);
    S.subs = objectsOnly(S.subs);
    S.staff = objectsOnly(S.staff);
    S.executives = objectsOnly(S.executives);
    S.execAlumni = objectsOnly(S.execAlumni);
    if(!Array.isArray(S.recentNames)) S.recentNames = [];
    for(const st of S.staff){ st.id = intOr(st.id, 0); st.lv = Math.max(1, intOr(st.lv, 1)); }
    for(const sub of S.subs) sub.id = intOr(sub.id, 0);
    if(S.activeRequest !== null && (typeof S.activeRequest !== "object" || Array.isArray(S.activeRequest))) S.activeRequest = null;
    if(S.bigDeal !== null && S.bigDeal !== undefined && (typeof S.bigDeal !== "object" || Array.isArray(S.bigDeal))) S.bigDeal = null;
    for(const k of ["project"]) if(S[k] !== null && (typeof S[k] !== "object" || Array.isArray(S[k]) || !Array.isArray(S[k].feats))) S[k] = null;
    if(S.lastSession){
      const ls = S.lastSession;
      S.lastSession = (typeof ls === "object")
        ? { releases: intOr(ls.releases, 0), coinsEarned: intOr(ls.coinsEarned, 0), ms: intOr(ls.ms, 0), endedAt: intOr(ls.endedAt, 0) }
        : null;
    }
    S.today = Object.assign(defToday, data.today||{});
    S.totals = Object.assign(defTotals, data.totals||{});
    S.settings = Object.assign(defSettings, data.settings||{});
    /* v2.4.6: 帯サイズの基準変更 (sakuri 指示)。旧の意味 (210px 基準の絶対倍率) で
       保存された stripSize を、新基準 (旧70% = 新100%) の相対値へ移行する。
       新規セーブは defSettings 側に stripSizeV:2 が入っているため対象外 */
    if(S.settings.stripSizeV !== 2){
      const oldSize = Number(S.settings.stripSize);
      if(isFinite(oldSize) && oldSize > 0)
        S.settings.stripSize = migrateStripSize(oldSize);
      S.settings.stripSizeV = 2;
    }
    if(!S.layout || typeof S.layout !== "object" || Array.isArray(S.layout)) S.layout = {};
    /* Phase E: 小物・機能オブジェクトの配置（追加のみ・不在 = 従来の初期配置） */
    if(!S.layoutProps || typeof S.layoutProps !== "object" || Array.isArray(S.layoutProps)) S.layoutProps = {};
    if(typeof S.settings.snapLayout !== "boolean") S.settings.snapLayout = true;
    /* v1 → v2 マイグレーション: 新フィールドを既定値で補完する */
    if(!Array.isArray(S.staff)) S.staff = [];
    if(typeof S.staffSeq !== "number") S.staffSeq = S.staff.length;
    /* バッチ9: COATS 外の毛柄 (旧 mike2) の個体は失わず、決定的に着せ替える */
    for(const st of S.staff){ if(st && !COATS.includes(st.coat)) st.coat = recoatFor(st); }
    /* オフィスティアの祝いは「セッション中の上昇」だけに反応させる:
       読み込んだ時点のティアは既読として記録する (ベテランセーブで祝わない) */
    officeTierSeen = officeTier(S);
    if(typeof S.studioLv !== "number" || S.studioLv < 1) S.studioLv = 1;
    /* Phase B・最高到達社格: 旧セーブには無いので初期値は現在のスタジオLv。
       記録が現在を下回る不整合があれば現在に揃える（最高到達は現在以上のはず） */
    if(typeof data.maxStudioLv !== "number" || S.maxStudioLv < S.studioLv) S.maxStudioLv = S.studioLv;
    /* Phase C: 部署Lv・大型案件・希望ジャンル・営業ローテーション（旧セーブには無い） */
    if(!S.depts || typeof S.depts !== "object") S.depts = freshDepts();
    for(const r of Object.keys(DEPTS)) if(typeof S.depts[r] !== "number" || S.depts[r] < 1) S.depts[r] = 1;
    if(typeof S.bigDeal === "undefined") S.bigDeal = null;
    if(typeof S.reqGenrePref === "undefined") S.reqGenrePref = null;
    if(typeof S.salesRot !== "number") S.salesRot = 0;
    if(typeof S.reqHoldUntil !== "number") S.reqHoldUntil = 0;
    /* Phase D: 子会社（旧セーブには無い）。配分は読み込み時に合計100%へ正規化 */
    if(!Array.isArray(S.subs)) S.subs = [];
    if(typeof S.subSeq !== "number") S.subSeq = S.subs.length;
    for(const sub of S.subs){
      if(typeof sub.staff !== "number") sub.staff = 5;
      if(typeof sub.lv !== "number") sub.lv = 1;
      if(typeof sub.alloc !== "number") sub.alloc = 0;
    }
    normalizeAlloc();
    /* 拡張ウェーブ F: フィーバーゲージ（旧セーブには無い） */
    if(!S.fever || typeof S.fever !== "object") S.fever = { gauge: 0 };
    if(typeof S.fever.gauge !== "number") S.fever.gauge = 0;
    /* 拡張ウェーブ G: 負債・ブランド・外注クールダウン（旧セーブには無い） */
    if(typeof S.debt !== "number") S.debt = 0;
    if(typeof S.brand !== "number") S.brand = 0;
    if(typeof S.vendorReadyAt !== "number") S.vendorReadyAt = 0;
    for(const st of S.staff) if(st.role === "sales" && !st.genre){
      const pool = unlockedGenres();
      st.genre = pool.length ? pool[Math.floor(Math.random()*pool.length)].id : "app";
    }
    if(!S.clickUp || typeof S.clickUp !== "object") S.clickUp = {};
    if(typeof S.cheerP !== "number" || !isFinite(S.cheerP)) S.cheerP = 0;
    delete (S as any).policy;   /* 段階5: 経営方針の名残も消した（旧セーブの互換は持たない） */   /* v2.11: 応援P（旧セーブは 0 から） */
    /* Sprint 1 追加フィールド（旧セーブには無いので既定値で補完） */
    if(typeof S.nextRequestGenre === "undefined") S.nextRequestGenre = null;
    if(typeof S.bigDrawStreak !== "number") S.bigDrawStreak = 0;
    /* Sprint 4 追加フィールド（名前履歴・反復研究Lv・ご褒美バフ） */
    if(!Array.isArray(S.recentNames)) S.recentNames = [];
    if(!S.genreKnow || typeof S.genreKnow !== "object") S.genreKnow = {};
    if(!S.runGenre || typeof S.runGenre !== "object") S.runGenre = {};
    if(!S.buffs || typeof S.buffs !== "object") S.buffs = {};
    /* Sprint 3 追加フィールド（旧セーブには無いので既定値で補完。
       dustTotal が無い旧セーブでは、倍率が従来と一致するよう所持星屑と同値にする） */
    if(!S.dustPerks || typeof S.dustPerks !== "object") S.dustPerks = {};
    /* dustTotal は freshState の既定 0 と区別できないので、生セーブ側で判定する */
    if(typeof data.dustTotal !== "number") S.dustTotal = S.dust || 0;
    /* 第2ウェーブ J: 旧セーブの eraDust は現在の通算星屑で補完する（仕様書7節） */
    if(typeof data.eraDust !== "number") S.eraDust = S.dustTotal || 0;
    /* 再設計 段階3: 旧式の星屑の倍率をそのまま固める（倍率は下がらない）。以後の星屑は新しい +50% で掛かる */
    if(typeof data.dustLegacyMult !== "number"){ S.dustLegacyMult = dustMultOld(S.dustTotal || 0); S.dustLegacyBase = S.dustTotal || 0; }
    if(typeof S.runPeakValue !== "number" || !isFinite(S.runPeakValue)) S.runPeakValue = 0;
    if(!S.incomeBy || typeof S.incomeBy !== "object") S.incomeBy = {};
    if(typeof S.runHandDP !== "number" || !isFinite(S.runHandDP)) S.runHandDP = 0;
    if(typeof S.legacy !== "number") S.legacy = 0;
    if(!S.legacyTech || typeof S.legacyTech !== "object") S.legacyTech = {};
    if(typeof S.holdings !== "number") S.holdings = 0;
    /* 第2ウェーブ K: チャレンジ状態の補完（旧セーブは未挑戦・報酬なし） */
    if(S.challenge !== null && (typeof S.challenge !== "object" || !S.challenge.id)) S.challenge = null;
    if(!S.challengeRewards || typeof S.challengeRewards !== "object") S.challengeRewards = {};
    /* 第2ウェーブ L: トレンド・IP・常駐カウンタの補完 */
    if(S.trend !== null && (typeof S.trend !== "object" || !S.trend.boom)) S.trend = null;
    if(typeof S.devGenrePref !== "string") S.devGenrePref = null;
    if(!Array.isArray(S.ips)) S.ips = [];
    if(typeof S.residentSec !== "number") S.residentSec = 0;
    /* 第2ウェーブ M: 役員と卒業記録の補完 */
    if(!Array.isArray(S.executives)) S.executives = [];
    if(!Array.isArray(S.execAlumni)) S.execAlumni = [];
    for(const p of [S.project]){
      if(p && typeof p.planning !== "boolean"){ p.planning = false; if(typeof p.ideaCost !== "number") p.ideaCost = 0; }
    }
    S.wip = Object.assign({ code:0, tested:0, built:0 }, data.wip||{});
    delete (S as any).line2;   /* 段階5: 第2ラインは廃止（旧セーブの互換は持たない — sakuri 2026-10-27） */
    if(S.dustPerks && typeof S.dustPerks === "object") delete S.dustPerks.starcharm;   /* 段階6: 星のチャームは廃止（枝に置き換え） */
    if(S.today.date !== todayKey()){
      S.today = { date:todayKey(), keys:0, cursorPx:0, lines:0, bugs:0, releases:0, commits:0, treats:0 };
    }
    /* チュートリアル導線の移行: tut が無い旧セーブは、達成済みの事実から
       ステージを導出し (deriveStage)、seen を全部埋めて卒業扱いにする
       (既存プレイヤーには導線もロックも一切出ない)。tut がある場合は
       欠けた部分だけ既定値で補完する */
    if(!data.tut || typeof data.tut !== "object" || typeof data.tut.stage !== "number"){
      const seenAll = {};
      for(const k of TUT_SEEN_KEYS) seenAll[k] = true;
      S.tut = { stage: deriveStage(S), seen: seenAll, skipped: false };
    } else {
      S.tut = { stage: data.tut.stage,
                seen: (data.tut.seen && typeof data.tut.seen === "object") ? data.tut.seen : {},
                skipped: !!data.tut.skipped };
    }
    saveBlocked = false;
    return true;
  }catch(e){
    console.error("[miyuke] セーブの読み込みに失敗（元の状態に戻した）", e);
    S = prevS; officeTierSeen = prevTierSeen;
    if(startup && raw){
      /* 起動時のセーブが壊れていた: 元のセーブを退避し、新規状態で上書きしない */
      try{ localStorage.setItem(SAVE_KEY + "-bad", raw); }catch(err){}
      saveBlocked = true;
    }
    return false;
  }
}
function addLog(text){
  const d = new Date();
  const tm = ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);
  if(quietBuy){ quietBuy.log.push({ tm, text }); return; }
  S.log.unshift({ tm, text });
  if(S.log.length > 40) S.log.length = 40;
}
/* ストリップモードの吹き出し用に、最後のセリフと表示期限を覚えておく */
let stripSay = { text: "", until: 0 };
const SAY_SNAPSHOT_GAP_MS = 300;
let lastSaySnapshotAt = 0;
let lastSayText = "";   /* パネル再描画でもセリフが既定文に戻らないよう保持する */
function say(text){
  lastSayText = text;
  const bt = document.getElementById("bubble-text");
  if(bt) bt.textContent = text;   /* プロジェクトタブを開いている時だけ DOM 側にも出す */
  stripSay = { text: text, until: Date.now() + 4200 };
  if(quietBuy) return;   /* 連続購入中のセリフは最後のものだけを buyMany の後で届ける */
  /* 2ウィンドウ化: セリフは live の変化として即時スナップショットで menu に届ける。
     sendSnapshotNow は末尾のプロトコル節 (関数宣言なので巻き上げ済み)。
     viewer では内部ガードで無操作になる */
  /* 連打で台詞が続いても、メニューへの即時送信は SAY_SNAPSHOT_GAP_MS に1回まで (毎回 S を丸ごと
     複製して送っていた)。間引いた分は 2Hz の定期送信が運ぶ。台詞はパネルの作り直しを要しない
     (viewer は live.say から吹き出しだけ書き換える) ので rev は上げない */
  if(Date.now() - lastSaySnapshotAt >= SAY_SNAPSHOT_GAP_MS){ lastSaySnapshotAt = Date.now(); sendSnapshotNow(); }
}

