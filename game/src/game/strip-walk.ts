/* ---------- 可視生産フロー (research/VISIBLE_PRODUCTION_DESIGN.md) ----------
   帯の「物の流れ」は全部この節の演出専用状態で、ゲームロジックには触らない。
   流れる物の総量は processPipe / produceDP の実績値の積分と一致させる
   (アキュムレータの保存則: 供給 = 発火DP + 残量。スモーク B13 で assert)。
   山の高さは stageStatus() の frac そのもの (メニューの仕掛品バーと同一事実)。
   コインはリリース時だけ (日常の出荷では出さない — 正直さの規則) */
let stripFlow = [];        /* 移動中の物 {kind, age, dur, x0,y0,x1,y1, arc, bundle, tick, col, line} */
const flowAcc = { code: 0, test: 0, build: 0, ship: 0 };      /* 量子未満の端数 (DP) */
const flowFed = { code: 0, test: 0, build: 0, ship: 0 };      /* 供給した実フロー累計 (DP) */
const flowFiredDP = { code: 0, test: 0, build: 0, ship: 0 };  /* アニメに変換した累計 (DP) */
let flowStaggerN = 0;      /* 同一 tick 内の発火ずらしカウンタ */
const FLOW_Q_BY_TIER = [5, 5, 10, 20];   /* ティア別量子 (DP/枚)。設計 §3.1 */
let flowTierCur = 0, flowTierLowAt = 0;
let stripCoins = [];       /* リリース時のコイン噴水 (P3) */
let stripGitLog = [];   /* モニタの git ログ行 (直近3コミット) */
let stripBoardPulseAt = 0, stripBoardPulseAt2 = 0;   /* 付箋到着時のボード金パルス */
let stripPkgGlowUntil = 0; /* パッケージ節目の完成箱グロー */
let lastPackagesSeen = -1, lastRpIntSeen = -1, lastIdeasSeen = -1;
let lastShipDispatchAt = 0;
/* 工程置き場の地理: 発生 A 机 0.30W → B QAトレイ → C ビルド置き場 → D 出荷スタック */
/* 2026-10-27: 工程の持ち場のブース（テスト室・ビルド室）が机まわりの物（オーバークロックの筒・サーバーラック）に
   隠れないよう、空いていた帯の右側へ移した（旧 0.405 / 0.53、出荷 0.80、第2ライン机 0.63）。トロフィー台は出荷場の右へ */
function stripQAX(){ return Math.round(stripVW * 0.70); }
function stripBuildX(){ return Math.round(stripVW * 0.78); }
function stripShipX(){
  if(layoutEdit.dragId === "ship" && layoutEdit.dragCand) return layoutEdit.dragCand.cx;
  const e = propEntry("ship");
  if(e && e.on === "ground" && typeof e.x === "number") return Math.round(e.x * stripVW);
  return Math.round(stripVW * 0.87);
}
function flowTier(){ return flowTierCur; }
function flowQuantum(){ return FLOW_Q_BY_TIER[flowTierCur]; }
/* ティア判定: 総スループット T (DP/分)。昇格は即時、降格は30秒遅延 (ちらつき防止) */
function flowTierTick(){
  const T = productionRate();
  const raw = T < 15 ? 0 : T < 60 ? 1 : T < 150 ? 2 : 3;
  if(raw > flowTierCur){ flowTierCur = raw; flowTierLowAt = 0; }
  else if(raw < flowTierCur){
    if(!flowTierLowAt) flowTierLowAt = Date.now();
    else if(Date.now() - flowTierLowAt > 30000){ flowTierCur = raw; flowTierLowAt = 0; }
  } else flowTierLowAt = 0;
}
/* 全パーティクル合計の目安 (設計 §3.2: ≤140。装飾の発火ゲートに使う) */
function particleTotal(){
  return stripFlow.length + stripConfetti.length + stripFloaters.length +
    stripSparks.length + stripCoins.length;
}
/* ---------- v2.3.3: みゅけの歩行システム（アートゲート） ----------
   sakuri作画 miyuke_walk (48×40) が ANIMS に実フレーム付きで存在する
   時だけ有効になる。それまでは本節は完全に無力で、みゅけは従来どおり机に
   張り付く（スタッフだけが帯を歩く）。歩行は見た目専用の移動レイヤーで、
   論理状態マシン・生産・DP には一切触らない。
   旅程 (miyukeTrip): { kind:"deliver"|"stroll", phase:"go"|"beat"|"return",
   destZone, speed, beatMs, beatUntil }。位置の単一の出所は miyukeStrip.x、
   向きは miyukeStrip.dir（歩行フレーム原画は左向き — v2.3.4 で実測。dir>0 で反転する）。
   接地影・ヒットゾーンは描画側が実位置から付けるので自動で追随する (R2/R12) */
let miyukeTrip = null;
let shelfPending = 0;      /* 未配達の新作数 (セッション内のみ。過去分は配達済み扱い) */
let tripRestUntil = 0;     /* 次の旅程を開始してよい時刻 (stripNow 基準) */
function hasWalkArt(){
  const a = ANIMS.miyuke_walk;
  return !!(a && a.frames && a.frames.length && a.frames.some(f => hasSprite(f)));
}
/* ===== 歩行サイクルと接地速度の同期 (2026-10-25 実測較正) =====
   旧仕様は walkClock を「30単位/秒で実時間再生」という固定換算で進めたため、
   実際の移動速度と脚の周期がずれ、足が滑って見えた (sakuri 実機指摘)。
   歩行グラの脚ジオメトリ実測 (全4種とも同一テンプレート):
   - 接地した足の fore-aft 移動量 (stance travel) ≈ 6.2 スプライトpx
   - 歩幅の検算 (最広スタンスの足間隔 − パッシング時の足間隔) ≈ 7.7px
   → 1周 = 2歩 ≈ 13 スプライトpx。描画倍率を掛けて帯ユニット/周にすると
   みゅけ (×2) = 26、スタッフ (×1.5) = 19.5。
   walkClock は「移動距離 ÷ ユニット/周 × 周期ms」で進め、位相を純粋に
   距離の関数にする。フレーム内リズム (300ms のアクセント含む) は原画どおり。 */
const WALK_UNITS_PER_CYCLE = { miyuke_walk: 26, staff: 19.5 };   /* 1周の接地距離は脚ジオメトリ実測 (13px×倍率) 由来で不変。周期ms は ANIMS 側 (walk_loop 7f = 3900ms) が正 */
function walkAdvanceMs(animName, distUnits){
  const a = ANIMS[animName];
  const cyc = a ? animSegMs(a, a.loopFrom, a.loopTo) : 5100;   /* 周期ms (ANIMS 無し毛柄はスタッフ周期で代用) */
  const upc = WALK_UNITS_PER_CYCLE[animName] || WALK_UNITS_PER_CYCLE.staff;
  return distUnits / upc * cyc;
}
function tripDestX(tr){
  if(tr.phase === "return") return stripDeskCX();
  if(tr.destZone === "shelf") return stripShelfCX() + 46;   /* 棚の手前に立つ */
  if(tr.destZone === "research") return stripResearchCX();
  if(tr.destZone === "desk2") return stripDesk2CX();
  return stripDeskCX();
}
function startTrip(kind, destZone){
  miyukeTrip = { kind, phase: "go", destZone,
    speed: kind === "deliver" ? 34 : 26,
    beatMs: kind === "deliver" ? 1400 : 2600 + Math.random() * 2200,
    beatUntil: 0 };
  miyukeStrip.targetX = tripDestX(miyukeTrip);
}
/* 配達の到着: 最新作の箱がこの瞬間に棚へ現れ、金枠グローもここから点く */
function completeDelivery(){
  if(shelfPending > 0) shelfPending--;
  shelfGlowFrame = frame + 40;
  addStripFloater(miyukeStrip.x, STRIP_GROUND - 84, "📦 棚に置いたにゃ", "#d9a41a");
}
/* 散歩の中断条件: 仕事・反応系の状態へ移ったら切り上げる
   （一人遊び同士の遷移では続行。魚・バグの出現でも切り上げる） */
function strollPreempted(){
  return !PLAY_STATES.includes(catState) || !!fishEvent || !!bugEvent;
}
function walkTripUpdate(dt){
  const now = stripNow;
  if(shelfPending > S.shelf.length) shelfPending = S.shelf.length;   /* 引っ越し等での不整合ガード */
  /* ハード割り込み: 食事・昼寝・お祝い・おかえりセレモニーは旅程より優先。
     配達物は shelfPending に残り、後で再配達される */
  const hard = catState === "eat" || catState === "nap" || catState === "celebrate" || returnWakeAt > 0;
  if(miyukeTrip){
    const tr = miyukeTrip;
    if(hard || (tr.kind === "stroll" && strollPreempted())) tr.phase = "return";
    if(tr.phase === "go"){
      miyukeStrip.targetX = tripDestX(tr);
      if(Math.abs(miyukeStrip.x - miyukeStrip.targetX) <= 2){
        tr.phase = "beat";
        tr.beatUntil = now + tr.beatMs;
        if(tr.kind === "deliver") completeDelivery();
      }
    } else if(tr.phase === "beat"){
      miyukeStrip.targetX = miyukeStrip.x;   /* その場で一息（アイドルポーズ） */
      if(now >= tr.beatUntil) tr.phase = "return";
    } else {   /* return: 机へ戻る */
      miyukeStrip.targetX = stripDeskCX();
      if(Math.abs(miyukeStrip.x - stripDeskCX()) <= 2){
        miyukeTrip = null;
        tripRestUntil = now + 4000;
      }
    }
    return;
  }
  if(hard || now < tripRestUntil) return;
  /* 配達が最優先: celebrate が終わり、落ち着いたら棚へ作品を運ぶ */
  if(shelfPending > 0){ startTrip("deliver", "shelf"); return; }
  /* 散歩: 一人遊びのローテーション中だけ、たまに家具ゾーンへ出かける */
  if(PLAY_STATES.includes(catState) && !fishEvent && !bugEvent && Math.random() < dt * 0.35){
    const zones = ["shelf"];
    if(hasResearcher()) zones.push("research");
    const probe = { phase: "go", destZone: zones[Math.floor(Math.random() * zones.length)] };
    if(Math.abs(tripDestX(probe) - miyukeStrip.x) >= 40) startTrip("stroll", probe.destZone);
  }
}
/* Sprint 4: 帯の金の魚の泳ぎ位置（帯仮想座標）と、直近リリースの記録（帯チップ用） */
let stripFish = null;
let lastReleaseInfo = null;   /* { name, at } */
function stripBugXY(bg){ return { x: (bg.sf || 0.5) * stripVW, y: STRIP_GROUND - (bg.sy || 4) }; }
function stripIsDeskState(){ return ["code","code_slow","think","debug","nap"].includes(catState); }
/* v2.4.0: 家具配置はユーザーがドラッグで変更できる (帯の「✥ 並べ替え」)。
   位置は帯幅に対する比率で S.layout に保存し、未設定なら下の既定ゾーンを使う。
   Strip Canon ゾーン制 (R7) は「既定配置」として存続する */
const LAYOUT_DEFAULTS = { shelf: 0.12, easel: 0.20, desk: 0.30, research: 0.47, rack: 0.55, desk2: 0.615, trophy: 0.93 };
function layoutFrac(id){
  const v = (typeof S !== "undefined" && S.layout) ? S.layout[id] : undefined;
  return (typeof v === "number" && isFinite(v) && v >= 0.02 && v <= 0.98) ? v : LAYOUT_DEFAULTS[id];
}
function stripDeskCX(){ return Math.round(stripVW * layoutFrac("desk")); }
function stripShelfCX(){ return Math.round(stripVW * layoutFrac("shelf")); }     /* B: 作品棚 */
function stripResearchCX(){ return Math.round(stripVW * layoutFrac("research")); }  /* C: 研究机 */
function stripDesk2CX(){ return Math.round(stripVW * layoutFrac("desk2")); }     /* D: 第2ライン机 */
function stripEaselCX(){ return Math.round(stripVW * layoutFrac("easel")); }     /* E: イーゼル */
function stripTrophyCX(){ return Math.round(stripVW * layoutFrac("trophy")); }    /* E: トロフィー台 */
function stripRackCX(){ return Math.round(stripVW * layoutFrac("rack")); }       /* E': サーバーラック */
/* イーゼルの実描画位置: 卓上カレンダー (机の脇・固定オフセット) と重なる場合は
   カレンダーの左へ寄せる (drawStripEasel と並べ替えの当たり判定で共用) */
function stripEaselDrawX(){
  let ex = stripEaselCX();
  if(S.stamps.releases10) ex = Math.min(ex, stripDeskCX() - 96);
  return ex;
}
/* ---- 並べ替えモード (v2.4.0): 状態は UI ローカル (セーブしない) ---- */
const layoutEdit = { on: false, dragId: null, grabDX: 0, dragCand: null, shakeId: null, shakeUntil: 0 };
function layoutItems(): LayoutItem[] {
  const items: LayoutItem[] = [
    { id: "shelf",    label: "作品棚",       cx: stripShelfCX(),    w: 104, h: 42, top: STRIP_GROUND - 42 },
    { id: "easel",    label: "イーゼル",     cx: stripEaselDrawX(), w: 34,  h: 36, top: STRIP_GROUND - 36, on: !!S.stamps.first_release },
    { id: "desk",     label: "みゅけの机",   cx: stripDeskCX(),     w: 150, h: 80, top: STRIP_GROUND - 80 },
    { id: "research", label: "研究机",       cx: stripResearchCX(), w: 88,  h: 46, top: STRIP_GROUND - 46, on: hasResearcher() },
    { id: "rack",     label: "サーバーラック", cx: stripRackCX(),   w: 52,  h: 68, top: STRIP_GROUND - 68, on: officeTier(S) >= 2 && S.upgrades.ci > 0 },
    { id: "trophy",   label: "トロフィー台", cx: stripTrophyCX(),   w: 30,  h: 22, top: STRIP_GROUND - 22, on: !!S.stamps.prestige1 },
  ];
  return items.filter(it => it.on !== false).concat(layoutPropItems());
}
/* Phase E: 小物・機能オブジェクトの編集項目。矩形は propPlace の解決結果から作る
   ので、描画・当たり判定・ヒットゾーンは常に同じ場所を指す */
function layoutPropItems(){
  const items = [];
  const add = (id) => {
    const def = PROP_DEFS[id];
    const pl = propPlace(id);
    const top = id === "board" ? STRIP_BOARD.top : pl.baseY - def.h;
    items.push({ id, label: def.label, cx: pl.cx, w: def.w, h: def.h, top, prop: true });
  };
  add("board");
  if(stripMemoText()) add("memo");
  if(!tutTabLocked("staff")) add("phone");
  add("toolbox");
  if(!tutTabLocked("click")) add("megaphone");
  add("snack");
  add("coffee");
  if(hasResearcher()) add("plant");
  add("ship");
  return items;
}
function layoutHitTest(ux, uy){
  const items = layoutItems();
  for(let i = items.length - 1; i >= 0; i--){
    const it = items[i];
    if(ux >= it.cx - it.w / 2 && ux <= it.cx + it.w / 2 &&
       uy >= it.top && uy <= it.top + it.h + 2) return it;
  }
  return null;
}
function toggleLayoutEdit(){
  layoutEdit.on = !layoutEdit.on;
  layoutEdit.dragId = null;
  layoutEdit.dragCand = null;
  const btn = document.getElementById("strip-layout");
  if(btn) btn.textContent = layoutEdit.on ? "✓ おわり" : "✥ 並べ替え";
  if(stripCv) stripCv.style.cursor = layoutEdit.on ? "grab" : "";
  if(layoutEdit.on) say("ならべかえモードにゃ。家具も小物もドラッグで動かせるよ。机や棚の上に重ねてもいいよ");
  publishHitZones(true);
}
function resetLayout(){
  S.layout = {};
  S.layoutProps = {};   /* Phase E: 小物の配置も初期配置へ（メモはボードへ再付着） */
  save(); renderPanel();
  if(!IS_VIEWER) say("家具の並びをもとに戻したにゃ");
}
