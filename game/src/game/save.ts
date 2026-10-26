/* ---------- 2ウィンドウ化 (Phase 0/1): ロールと同期の共有状態 ----------
   owner (帯) がシミュレーションとセーブの唯一の所有者。viewer (管理ウィンドウ) は
   スナップショットで描画し、操作はコマンドで帯へ送る。solo (ブラウザ) は従来どおり。
   プロトコル本体はファイル末尾 (初期化の直前) の「同期プロトコル」節に置く。
   ここでは各所 (say / SoundKit / save / tick 等) が実行時に参照する状態だけを
   先に宣言しておく (let の TDZ を避けるため)。設計: research/TWO_WINDOW_ARCHITECTURE.md */
const ROLE = (function(){
  const r = (typeof window !== "undefined") ? window.__MIYUKE_ROLE__ : null;
  if(r === "owner" || r === "viewer" || r === "solo") return r;
  return (typeof window !== "undefined" && window.__TAURI__) ? "owner" : "solo";
})();
const IS_VIEWER = ROLE === "viewer";
const RUNS_SIM = !IS_VIEWER;   /* owner と solo だけが tick/save/load を持つ */
window.__MIYUKE_ROLE__ = ROLE;
let menuAwake = false;   /* owner の認識: menu が生きているか (heartbeat 5秒以内) */
let menuLastBeat = 0;    /* owner が最後に menu の heartbeat を受けた時刻 */
let snapSeq = 0;         /* スナップショットの単調増加カウンタ */
let snapRev = 0;         /* 状態リビジョン (tick / コマンド / セリフで進む) */
function bumpRev(){ snapRev++; }

/* ---------- セーブデータ ---------- */
const GAME_VERSION = "v2.6.0";   /* 表示ラベルの単一の出所 (v2.6.0: 第2拡張ウェーブ — ホールディングス化と星団・レガシー技術、チャレンジ周回、市場トレンドと自社IP、役員猫。アプリ版数は tauri.conf.json の version と一致させる) */
const SAVE_KEY = "miyuke-save-v1";
function todayKey(){ const d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function freshState(): GameState {
  return {
    coins:0, ideas:0, packages:0, bugStock:0, rp:0, dust:0, prestiges:0,
    runDP:0, concentration:100,
    upgrades:{}, research:{}, stamps:{},
    project:null, projectDP:0, commitMark:0,
    activeRequest:null, requests:[], nextRequestGenre:null, bigDrawStreak:0,
    depts:{ prog:1, test:1, carry:1, research:1, care:1, sales:1 }, bigDeal:null, reqGenrePref:null, salesRot:0, reqHoldUntil:0,
    subs: [], subSeq: 0,
    fever: { gauge: 0 },
    debt: 0, brand: 0, vendorReadyAt: 0,
    shelf:[], recentNames:[],
    /* v2 追加分（v1セーブには無いので load() で補完される） */
    staff:[], staffSeq:0, studioLv:1, maxStudioLv:1, clickUp:{},
    wip:{ code:0, tested:0, built:0 },
    line2:{ unlocked:false, genre:null, project:null, projectDP:0, commitMark:0, wip:{ code:0, tested:0, built:0 } },
    today:{ date:todayKey(), keys:0, cursorPx:0, lines:0, bugs:0, releases:0, commits:0, treats:0 },
    totals:{ keys:0, cursorPx:0, lines:0, bugsSquashed:0, releases:0, commits:0, coinsEarned:0, naps:0, playSec:0,
             clicks:0, crits:0, goldFish:0, eventBugs:0, hired:0 },
    flags:{}, log:[],
    /* Sprint 2 追加分（旧セーブには無いので load() の既定値マージで補完される）:
       sound は null = 未設定（フル=ON / 帯=OFF の自動）。lastSession は前回セッションの
       あらすじ（おかえりセレモニー用）。lastGiftAt は夢のお土産の最終付与時刻 */
    settings:{ pauseInput:false, sound:null, soundVol:0.5, inputCount:false, stripSize:1, stripSizeV:2 },
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
    /* 第2ウェーブ K 追加分: 挑戦中のチャレンジ { id, startCoins } と、
       獲得済みの永続報酬。報酬層は EXIT でも持株化でも消えない */
    challenge:null, challengeRewards:{},
    /* 第2ウェーブ L 追加分: 市場トレンド { boom, slump, nextBoom, nextSlump,
       cycleSec, announceAt }・開発ジャンルの方針・自社IP・常駐秒カウンタ */
    trend:null, devGenrePref:null, ips:[], residentSec:0,
    /* 第2ウェーブ M 追加分: 役員猫（EXIT を生き残る常駐メンバー）と卒業記録 */
    executives:[], execAlumni:[],
    /* Sprint 4 追加分: 反復研究のレベルと、ご褒美の一時バフ { prodUntil, clickUntil } */
    researchLv:{}, buffs:{},
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
function save(){
  if(IS_VIEWER) return;   /* 単一書き手: viewer はセーブに一切触らない (第2層ガード) */
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
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  }catch(e){}
}
function load(){
  if(IS_VIEWER) return false;   /* viewer は load もしない (レプリカはスナップショット由来) */
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const data = JSON.parse(raw);
    const f = freshState();
    /* 注意: Object.assign(f, data) で f.today 等は data 側に差し替わるため、
       既定値オブジェクトを先に退避してからマージする（新フィールドの補完用） */
    const defToday = f.today, defTotals = f.totals, defSettings = f.settings, defLine2 = f.line2;
    S = Object.assign(f, data);
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
    /* Sprint 1 追加フィールド（旧セーブには無いので既定値で補完） */
    if(typeof S.nextRequestGenre === "undefined") S.nextRequestGenre = null;
    if(typeof S.bigDrawStreak !== "number") S.bigDrawStreak = 0;
    /* Sprint 4 追加フィールド（名前履歴・反復研究Lv・ご褒美バフ） */
    if(!Array.isArray(S.recentNames)) S.recentNames = [];
    if(!S.researchLv || typeof S.researchLv !== "object") S.researchLv = {};
    if(!S.buffs || typeof S.buffs !== "object") S.buffs = {};
    /* Sprint 3 追加フィールド（旧セーブには無いので既定値で補完。
       dustTotal が無い旧セーブでは、倍率が従来と一致するよう所持星屑と同値にする） */
    if(!S.dustPerks || typeof S.dustPerks !== "object") S.dustPerks = {};
    /* dustTotal は freshState の既定 0 と区別できないので、生セーブ側で判定する */
    if(typeof data.dustTotal !== "number") S.dustTotal = S.dust || 0;
    /* 第2ウェーブ J: 旧セーブの eraDust は現在の通算星屑で補完する（仕様書7節） */
    if(typeof data.eraDust !== "number") S.eraDust = S.dustTotal || 0;
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
    for(const p of [S.project, S.line2 && S.line2.project]){
      if(p && typeof p.planning !== "boolean"){ p.planning = false; if(typeof p.ideaCost !== "number") p.ideaCost = 0; }
    }
    S.wip = Object.assign({ code:0, tested:0, built:0 }, data.wip||{});
    S.line2 = Object.assign(defLine2, data.line2||{});
    S.line2.wip = Object.assign({ code:0, tested:0, built:0 }, (data.line2||{}).wip||{});
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
    return true;
  }catch(e){ return false; }
}
function addLog(text){
  const d = new Date();
  const tm = ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2);
  S.log.unshift({ tm, text });
  if(S.log.length > 40) S.log.length = 40;
}
/* ストリップモードの吹き出し用に、最後のセリフと表示期限を覚えておく */
let stripSay = { text: "", until: 0 };
let lastSayText = "";   /* パネル再描画でもセリフが既定文に戻らないよう保持する */
function say(text){
  lastSayText = text;
  const bt = document.getElementById("bubble-text");
  if(bt) bt.textContent = text;   /* プロジェクトタブを開いている時だけ DOM 側にも出す */
  stripSay = { text: text, until: Date.now() + 4200 };
  /* 2ウィンドウ化: セリフは live の変化として即時スナップショットで menu に届ける。
     sendSnapshotNow は末尾のプロトコル節 (関数宣言なので巻き上げ済み)。
     solo/viewer では内部ガードで無操作になる */
  bumpRev();
  sendSnapshotNow();
}

