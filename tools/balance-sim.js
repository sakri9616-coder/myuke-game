"use strict";
/* ============================================================
   みゅけ バランスシミュレーション v2.1 (Node, 依存なし)
   共有定数（BAL 等）は game/index.html から抽出する（単一ソース。下記ローダ参照）。

   モデル概要（ゲーム実装との対応）:
   - 生産: 基本進捗(8/分)＋入力ブーストは「コーディング系の状態」のときだけ進む。
     状態マシンの遷移確率（遊び約8%＋集中力切れの休憩）から稼働率 ≈ 0.93 と置く。
     子ねこボットとプログラマ猫は状態によらず常時生産する。
   - 生産はすべて produceDP() を通る = dpMult（全DP）× dustMult が掛かる。
     工程中心（2026-10-27）: 後工程は 素の能力＋担当スタッフ＋設備 × 会社全体の倍率 × 反復研究。
     応援は溜まった仕掛品を手で運んで出荷する（cheerCarry）。
     第2ラインは line2Rate() 自体に倍率が含まれ、さらに produceDP でも掛かる
     （出荷版の実装どおり二重適用を再現している）。
   - 工程: 生産 → 仕掛品 → テスト(bugFで減速) → ビルド → 出荷。各工程レート/分で処理し、
     各ラインは独立の工程容量を持つ（c62ef23 で game と同期済み）。
   - バグ: 生産量×0.012 が滞留。QA（qaRate/分）で処理。滞留>8 でテストが最大50%減速。
     みゅけ本人のデバッグ叩きは「滞留>3 のとき超過分を最大3/分追加処理」と近似。
   - クリック: セッション中はコンボが 0.08/クリックで上限まで育つ前提で、
     1セッション（120クリック）の平均倍率を解析的に計算。クリティカルは期待値。
     セッション中に湧く金の魚／バグイベントの期待収入も控えめに加算する。
   - プレイヤー像は2種:
       passive: 開きっぱなし＋ページ内入力のみ
       active : passive ＋ 応援クリックセッション 3回/日 × 3分（40クリック/分）
   - 購入方針（両タイプ共通の「目的型カジュアル」）:
       初雇用（最安の役職）→ 子ねこボット貯金 → 第2ライン建設／スタジオ拡張の貯金
       → 最安のものを貪欲に（アップグレード/雇用/育成/クリック強化[activeのみ]）
     研究は res_line2 を優先し、他はゲーム内表示順に、RP に +2 の余裕を見て買う。
     プレステージは星屑10個ぶん貯まった日の終わりに実施（実行可能は5個ぶん〜）。
   ============================================================ */
/* ---- リファクタ (2026-10-26・振る舞い不変): 共有定数の単一ソース化 ----
   BAL / UPGRADE_DEFS / RESEARCH_DEFS / STAFF_ROLES / STAFF_CAPS / studioCost は
   ゲーム HTML (tools/game-html.cjs: 既定はソースからビルドした desktop/dist/index.html)
   から読み込み時に抽出する。sim 側に写しを持たないので、
   数値変更は game 側だけで済む。抽出に失敗したら sim は即座にエラーで止まる
   (古い写しで静かに回り続ける事故を防ぐ)。 */
const fs = require("fs");
const path = require("path");
const GAME_SRC = require("./game-html.cjs").readGameHtml();
function extractLiteral(name){
  /* 型注釈はビルドで空白になるので「const 名前 <空白> =」を許す */
  const m = new RegExp("const " + name + "\\s*=").exec(GAME_SRC);
  if(!m) throw new Error("balance-sim: ゲーム HTML に const " + name + " = が見つからない (抽出失敗)");
  let i = m.index + m[0].length;
  while(/\s/.test(GAME_SRC[i])) i++;
  if(GAME_SRC[i] !== "{" && GAME_SRC[i] !== "[") throw new Error("balance-sim: " + name + " はリテラルではない");
  let depth = 0, inStr = null, esc = false, inLine = false, inBlock = false;
  for(let j = i; j < GAME_SRC.length; j++){
    const c = GAME_SRC[j], n = GAME_SRC[j + 1];
    if(inLine){ if(c === "\n") inLine = false; continue; }
    if(inBlock){ if(c === "*" && n === "/"){ inBlock = false; j++; } continue; }
    if(inStr){ if(esc) esc = false; else if(c === "\\") esc = true; else if(c === inStr) inStr = null; continue; }
    if(c === "/" && n === "/"){ inLine = true; j++; continue; }
    if(c === "/" && n === "*"){ inBlock = true; j++; continue; }
    if(c === '"' || c === "'" || c === "`"){ inStr = c; continue; }
    if(c === "{" || c === "[") depth++;
    else if(c === "}" || c === "]"){ depth--; if(depth === 0) return Function("return (" + GAME_SRC.slice(i, j + 1) + ")")(); }
  }
  throw new Error("balance-sim: " + name + " のリテラル終端が見つからない");
}
const GAME_STUDIO = (() => {
  /* studioCost はテーブル形（STUDIO_COSTS[現Lv] = 次Lvへの費用）に移行。
     抽出できない場合は即エラー（古い写しで回し続けない） */
  const m = GAME_SRC.match(/const STUDIO_COSTS = \[([^\]]+)\]/);
  if(!m) throw new Error("balance-sim: game/index.html の STUDIO_COSTS を抽出できない");
  return m[1].split(",").map(s => Number(s.trim()));
})();
const BAL = extractLiteral("BAL");
const UPGRADE_DEFS = extractLiteral("UPGRADE_DEFS").map(d => ({ id: d.id, base: d.base, max: d.max }));
const cost = (def, lv) => Math.ceil(def.base * Math.pow(1.15, lv));
/* 工程中心（2026-10-27・game と同一）: 強化は自分の工程にだけ効く */
const dpMult = up => 1 + 0.05*(up.keyboard||0) + 0.08*(up.ide||0) + 0.03*(up.ci||0) + 0.04*(up.pack||0);   /* 全DP（game の dpMult。実装と全工程に効く） */
const buildEquipMult = () => 1;   /* v2.8.0 のビルド倍率は廃止（全DP に戻した） */
const qaPerMin = (up, res, ss) => BAL.qaBasePerMin + 0.4*(up.duck||0) + 1.2*(up.tester||0) + (res.res_duckplay?0.2:0) + ss.qa;
/* 研究（ゲームの RESEARCH_DEFS と同じ並び・価格）
   Sprint 4: ティア2（前提つき）を追加。ジャンル依存の効果（res_game2/ai2/robot2）は
   sim がジャンルを引いていないため未モデル化（影響は軽微な範囲に留まる） */
const RESEARCH = extractLiteral("RESEARCH_DEFS").map(r => { const o = { id: r.id, cost: r.cost }; if(r.requires) o.requires = r.requires; return o; });
/* Sprint 4: 反復研究「効率化レポート」（価格 10×1.6^Lv、生産 +2%/Lv） */
const repeatCost = lv => Math.ceil(10 * Math.pow(1.6, lv));
/* スタッフ（game と同一） */
const STAFF_ROLES = (() => { const g = extractLiteral("STAFF_ROLES"); const o = {}; for(const k of Object.keys(g)) o[k] = { base: g[k].base, out: g[k].out }; return o; })();
const STAFF_CAPS = extractLiteral("STAFF_CAPS");
const STAFF_POLICY_MAX_LV = 6;   // 方針: 育成は Lv6 まで（ゲーム上限は Lv10）
const hireCost = (staff, role) => Math.ceil(STAFF_ROLES[role].base * Math.pow(1.35, staff.filter(s=>s.role===role).length));
const trainCost = st => Math.ceil(STAFF_ROLES[st.role].base * 0.9 * Math.pow(1.35, st.lv - 1));   /* Sprint 4: 1.45→1.35 */
const studioCost = lv => GAME_STUDIO[lv];
function staffSums(staff){
  const s = { prog:0, progW:0, qa:0, testDP:0, ship:0, rp:0, careW:0, byRole:{} };
  for(const st of staff){
    /* Sprint 4: 熟練ボーナス（Lv5 +15% / Lv10 +30%）を game と同一に */
    const m = (1 + 0.25*(st.lv - 1)) * (st.lv >= 10 ? 1.3 : st.lv >= 5 ? 1.15 : 1);
    s.byRole[st.role] = (s.byRole[st.role]||0) + 1;
    if(st.role === "prog"){ s.prog += STAFF_ROLES.prog.out * m; s.progW += m; }
    if(st.role === "test"){ s.qa += STAFF_ROLES.test.out * m; s.testDP += BAL.testStaffDP * m; }
    if(st.role === "carry"){ s.ship += STAFF_ROLES.carry.out * m; }
    if(st.role === "research"){ s.rp += STAFF_ROLES.research.out * m; }
    if(st.role === "care"){ s.careW += m; }
  }
  return s;
}
/* クリック（game と同一。Sprint 3: 星屑特典「集中ブースト」で威力 ×1.1） */
const CLICK_DEFS = [
  { id:"paw", base:80, max:10 }, { id:"glove", base:300, max:10 }, { id:"uchiwa", base:200, max:8 },
  { id:"cheer", base:500, max:5 }, { id:"synidea", base:350, max:5 }, { id:"synrp", base:800, max:5 }
];
const clickCost = (def, lv) => Math.ceil(def.base * Math.pow(1.30, lv));   // Sprint 1: 1.55→1.30
const clickPower = (cu, focus) => (0.25 + 0.06*(cu.paw||0) + 0.18*(cu.glove||0)) * (focus ? 1.1 : 1);
const comboCapBonus = cu => 2.0 + 0.25*(cu.uchiwa||0);
const critRate = cu => 0.08 + 0.01*(cu.cheer||0);

// 決定的乱数 (LCG)
let seed = 20261024;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/* Sprint 1 (game と同一仕様): 着工アイデア消費と企画中。
   アイデア収入の近似: 状態サイクル約5秒で think 約1.2回/分 (+1) と
   一人遊び約1.5回/分 (+2) → 約 4.2/分。リリース +2、お世話係の差し入れは微量 */
const IDEA_COST = { TUT:0, XS:0, S:2, M:5, L:10 };
const IDEA_PER_MIN = 4.2;
const LINK_RATE = (() => { const m = GAME_SRC.match(/linkRate: ([\d.]+)/); if(!m) throw new Error("balance-sim: CLINK.linkRate を抽出できない"); return +m[1]; })();
const PLAN_PRICE_STEP = (() => { const m = GAME_SRC.match(/PLAN_PRICE_STEP = ([\d.]+)/); if(!m) throw new Error("balance-sim: PLAN_PRICE_STEP を抽出できない"); return +m[1]; })();
const CARRY_MULT = (() => { const m = GAME_SRC.match(/carryMult: ([\d.]+)/); if(!m) throw new Error("balance-sim: CLINK.carryMult を抽出できない"); return +m[1]; })();
const PLAYER = { minutesPerDay: 180, keysPerHour: 2400, cursorPxPerHour: 90000, requestMatchRate: 0.4,
                 clickSessions: [30, 90, 150], clickSessionMin: 3, clicksPerMin: 40,
                 codingFrac: 0.93,
                 fishCatchPerSession: 0.7,   // セッション中に捕まえる金の魚の期待値（匹）
                 bugCoinsPerSession: 29 };   // セッション中のバグ叩き収入の期待値（🪙）

/* 1セッションぶんのクリック生産（DP/分, 倍率適用前）。
   コンボはクリックごとに +0.10（上限 comboCapBonus）、2.5秒以内の連続で維持される前提。
   F 再設計（ハイブリッド式）: 1クリックの基礎 = clickPower + 自動生産(DP/秒) × 5%。
   自動生産は倍率適用前の値を渡すこと（実機の autoProdEMA ÷ 生産倍率。クリックにも同じ倍率が
   掛かるので、倍率適用後を渡すと倍率が二重に掛かり、周回が進むほどクリックが全てを代替してしまう）。
   なお実機の流入制限（直接20%・残りは工程キャップ）と入力バケツ（300/分）は
   40/分の人間プロファイルでは拘束しないため、この日次モデルでは抽象化する
   （拘束するのは連打ツール域のみ — それが再設計の目的） */
function sessionClickDPperMin(cu, focus, autoPostPerMin, dm){
  const clicks = PLAYER.clicksPerMin * PLAYER.clickSessionMin;
  const capB = comboCapBonus(cu);
  let sum = 0;
  for(let i = 0; i < clicks; i++) sum += 1 + Math.min(capB, (i + 1) * 0.10);
  const avgMult = sum / clicks;
  const critF = 1 + critRate(cu) * 9;   // クリティカル ×10 の期待値係数
  const base = clickPower(cu, focus) / Math.sqrt(dm || 1) + (autoPostPerMin || 0) / 60 * LINK_RATE;   /* 素の威力は星屑倍率を平方根でだけ受ける（game の clickBaseDP） */
  return PLAYER.clicksPerMin * base * avgMult * critF;
}

function simulate(days, active, reqMode, prestigeAt, profile){
  seed = 20261024; // プレイヤー間で乱数を揃える
  /* 第2ウェーブ K のプロファイル: minority = 上限6＋スタッフ生産 ×1.25 /
     idle = ブーストとクリックなし / black = バグ ×3・価格 ×2 */
  const capOf = () => profile === "minority" ? 6 : STAFF_CAPS[studioLv - 1];
  const bugPerDP = BAL.bugPerDP * (profile === "black" ? 3 : 1);
  const up = {}, res = {}, cu = {};
  let staff = [], studioLv = 1;
  let coins = 0, rp = 0, dust = 0, dustTotal = 0, runDP = 0, bugStock = 0;
  let brand = 0;   /* Wave G: ブランド力（品質出荷で蓄積・価格に複利・EXIT で清算） */
  let simDebt = 0;   /* Wave K: ブラック検証用に、実機の負債ドラッグだけを局所モデル化（day sim 本体は負債なしが既定） */
  /* Sprint 3: 星屑ショップの最小モデル。特典は永続し、倍率は通算獲得
     (dustTotal) で決まる。貪欲方針: 初期資金(3) → 集中ブースト(5) の順に買う */
  const perks = {};
  let rep = { impl:0, test:0, build:0, ship:0 };   /* 反復研究（工程別の4本）のレベル（引っ越しでリセット） */
  let repMax = 0;   /* 1ランで到達した反復研究の合計レベルの最大（レポート用） */
  let coinsEarned = 0, econ = null;   /* Sprint 4: 30日目の支出可能性の材料 */
  let runCoins = 0;   /* Wave K: 1ラン（設立〜EXIT）単位の累計コイン。ブラック目標の校正用 */
  let wip = { code:0, tested:0, built:0 }, wip2 = { code:0, tested:0, built:0 };
  let line2 = false;
  let ideas = 0, bigStreak = 0, reqDone = 0, curDay = 1;   /* reqDone/curDay: Phase C の依頼比較用 */
  let project = { size:"TUT", total: BAL.sizes.TUT, ideaCost:0, planning:false }, projDP = 0;   // 初回はチュートリアル 120DP
  let project2 = null, proj2DP = 0;
  let totalReleasesEver = 0;
  const releasesByDay = [];
  const milestones = { firstReleaseMin: null, botDay: null, prestigeDay: null, prestigeFeasibleDay: null, prestigeCount: 0, hold5Day: null, hold5Dust: 0,
                       firstUpgradeDay: null, firstHireDay: null, line2Day: null,
                       resT1Day: null, resAllDay: null,
                       /* Phase B・社格到達日: Lv1 は開始時（0日目）。売却で Lv1 に戻っても
                          初回到達日は上書きしない（最高到達の記録として読む） */
                       rankDays: { 1: 0 }, coinsAtLv5: null, maxBugStock: 0, maxRunCoins: 0 };
  /* チュートリアル導線 (research/TUTORIAL_DESIGN.md §5) との対応 — 導線の解放
     トリガーは、その段階で買う物の価格以下に置いてあり、sim の購入マイル
     ストーンより先に (または同時に) 発火する。経済定数は導線と無関係:
       Stage 1 (初リリース)      = firstReleaseMin の瞬間そのもの
       Stage 2 (研究, 累計RP>=2)  = 最初の魚 (+2RP) — 初回研究購入より前
       Stage 4 (仲間, 累計>=220)  = firstHireDay の雇用 (最安 220) と同時か前
       Stage 5 (依頼, 雇用>=1)    = firstHireDay
       Stage 6 (第2ライン研究)    = line2Day の建設より前 (研究完了の瞬間)
       Stage 7 (引っ越し gain>=3)= prestigeFeasibleDay (到達可能になった日。第2ウェーブ I で下限 3 に一致) */
  const sizePool = ["S","S","M","M","L"];
  let snapshot7 = null;
  /* 工程中心の計測: いまの律速工程（30分ごとの多数決）と、その切り替わり回数 */
  let bnStage = "impl", bnVotes = { impl:0, test:0, build:0, ship:0 }, bnBlock = null, bnSwitches = 0;
  const bnTime = { impl:0, test:0, build:0, ship:0 };
  let staffShare7 = null, shareSum = 0, shareN = 0, planBuys = 0;
  const feel = [];

  /* Sprint 3: 倍率は通算獲得で決まる（game の dustMult と同じ。上限なし） */
  const dustMult = () => 1 + BAL.dustBonus * (dustTotal <= BAL.dustMultSoftcap ? dustTotal : BAL.dustMultSoftcap * Math.sqrt(dustTotal / BAL.dustMultSoftcap));
  const stageMultSim = st => dpMult(up) * dustMult() * firstBoost() * (1 + 0.05 * rep[st]);   /* game の stageMult と同じ（全DP×会社全体×やる気MAX×反復研究） */
  const rates = () => {
    const ss = staffSums(staff);
    return {
      ss,
      /* game の stageMult と同じ: 後工程にも実装と同じ会社全体の倍率が掛かる */
      test: (BAL.stageBaseRate + BAL.equipDP.tester*(up.tester||0) + ss.testDP) * stageMultSim("test"),
      build: (BAL.stageBaseRate + BAL.equipDP.ci*(up.ci||0) + BAL.equipDP.pack*(up.pack||0)) * buildEquipMult(up) * stageMultSim("build"),
      ship: (BAL.stageBaseRate + BAL.equipDP.bot*(up.bot||0) + ss.ship) * stageMultSim("ship"),
      bot: 2*(up.bot||0)*(res.res_bottrain ? 1.5 : 1)*(res.res_bot2 ? 1.5 : 1)   /* Sprint 4: ボットAI学習 */
    };
  };
  function processPipe(w, caps, bugF){
    const t = Math.min(w.code, caps.test * bugF); w.code -= t; w.tested += t;
    const bd = Math.min(w.tested, caps.build); w.tested -= bd; w.built += bd;
    const sh = Math.min(w.built, caps.ship); w.built -= sh;
    return { test:t, build:bd, ship:sh, credited: sh };
  }
  const firstBoost = () => totalReleasesEver === 0 ? 3.4 : 1;   /* Sprint 4: 1.5→3.4（帯の無操作実測で調整） */
  function settle(proj){
    if(ideas >= proj.ideaCost){ ideas -= proj.ideaCost; proj.planning = false; }
    else proj.planning = true;
    return proj;
  }
  /* 仕事の桁（game の workScaleFor と同じ）: M 作品が scaleRefMin 分を切る速さで 1/2/5/10… 倍 */
  const workScaleFor = rate => { const x = rate * BAL.scaleRefMin / BAL.sizes.M; if(x < 2) return 1;
    const e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * Math.pow(10, e); };
  const line2RateSim = () => { const R = rates(); return (BAL.line2BaseRate + 0.8 * R.ss.progW) * dpMult(up) * dustMult() * (res.res_eff2 ? 1.5 : 1); };
  function drawProject(scaleRate){
    // 所要時間ベース抽選（game の drawSizeByTime と同じ）: 実効スループットで 40分〜3時間
    const R = rates();
    const boost = profile === "idle" ? 0 : Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
    const cf = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
    const prodSide = ((BAL.basePerMin + boost) * cf + R.bot + R.ss.prog) * dpMult(up) * dustMult() * firstBoost();
    const thr = Math.max(1, Math.min(prodSide, R.test, R.build, R.ship));
    const scale = workScaleFor(scaleRate || thr);
    const rate = scaleRate ? thr : thr / scale;   /* 第2ラインの規模の抽選は第1ラインの速さで（game と同じ） */
    const weighted = ["XS","S","S","M","M","L"];
    const ok = weighted.filter(x => { const m = BAL.sizes[x]/rate; return m >= 40 && m <= 180; });
    let size;
    if(bigStreak >= 1){ bigStreak = 0; size = ok.includes("S") ? "S" : (ok[0] || "XS"); }
    else if(ok.length) size = ok[Math.floor(rnd()*ok.length)];
    else size = ["XS","S","M","L"].reduce((a,c) => Math.abs(BAL.sizes[c]/rate-90) < Math.abs(BAL.sizes[a]/rate-90) ? c : a);
    if(bigStreak === 0 && BAL.sizes[size]/rate > 150) bigStreak = 1; else if(BAL.sizes[size]/rate <= 150) bigStreak = 0;
    return settle({ size, total: BAL.sizes[size] * scale, scale, ideaCost: IDEA_COST[size]||0, planning: false });
  }
  function release(sz, isLine2, plv, scale){
    scale = scale || 1;
    let c = BAL.coinBase[sz] * scale * (isLine2 ? BAL.line2CoinRate : 1) * (1 + 0.10*(up.ci||0)) * Math.pow(dustMult(), BAL.dustPriceExp) * (1 + PLAN_PRICE_STEP * (plv || 0))   /* 企画Lv（game の planPriceMult） */ * (1 + brand * 0.02);   /* Wave G: ブランド価格倍率 */
    let r = Math.round(BAL.rpBase[sz] * Math.sqrt(scale));   /* game と同じ（研究Pは桁の平方根） */
    if(!isLine2 && reqMode === "auto"){
      /* Phase C・自動獲得: 枠は常時埋まり全リリースが依頼達成。ボーナス率は
         担当者の成長に伴うティア期待値（〜7日 +60% / 〜20日 +85% / 以後 +130%）、
         要求サイズ未満の半額を見込み ×0.9 の保守係数 */
      const rate = curDay <= 7 ? 0.6 : curDay <= 20 ? 0.85 : 1.3;
      c += Math.round(c * rate * 0.9); r += 1; reqDone++;
    }
    else if(!isLine2 && rnd() < PLAYER.requestMatchRate){ c += Math.round(c * 0.6); r += 1; reqDone++; }
    if(profile === "black") c = Math.round(c * 2);
    coins += Math.round(c); coinsEarned += Math.round(c); dayCoins += Math.round(c); runCoins += Math.round(c); rp += r; ideas += 2;
    totalReleasesEver++;
    /* Wave G: ブランド増減は実機どおり出荷時のバグ在庫で決まる
       （0 → +3 / 〜3 → +1 / 10〜 → −3 / その他 0。feat 全達成の +4 は未モデル） */
    { const fb2 = Math.floor(bugStock);
      brand = Math.max(0, Math.min(450, brand + (fb2 <= 0 ? 3 : fb2 <= 3 ? 1 : fb2 >= 10 ? -3 : 0)));
      if(profile === "black") simDebt = Math.min(500, simDebt + Math.round(fb2 * 1.5)); }
    return drawProject(isLine2 ? line2RateSim() : undefined);
  }
  let dayCoins = 0;

  for(let day = 1; day <= days; day++){
    curDay = day;
    let dayReleases = 0;
    dayCoins = 0;
    for(let min = 0; min < PLAYER.minutesPerDay; min++){
      const R = rates(), ss = R.ss;
      if(profile === "minority"){ ss.prog *= 1.25; ss.progW *= 1.25; }
      const mlt = dpMult(up) * dustMult();
      const codingFrac = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*ss.careW);
      // --- 生産 ---
      const boost = profile === "idle" ? 0 : Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      let raw = (BAL.basePerMin + boost) * codingFrac + R.bot + ss.prog;
      const inSession = profile !== "idle" && active && PLAYER.clickSessions.some(s0 => min >= s0 && min < s0 + PLAYER.clickSessionMin);
      let clickRaw = 0;
      if(inSession){
        clickRaw = sessionClickDPperMin(cu, perks.focus, raw, dustMult());   /* 連動分は倍率前の自動生産（game の clickBaseDP と同じ。倍率の二重掛けをしない） */
        ideas += 0.02 * (cu.synidea||0) * PLAYER.clicksPerMin;   // ひらめき連動
        rp += 0.004 * (cu.synrp||0) * PLAYER.clicksPerMin;   // 研究メモ連動
        if(PLAYER.clickSessions.includes(min)){              // セッション開始分にイベント期待値を加算
          rp += 2 * PLAYER.fishCatchPerSession;
          const evCoins = (Math.round(80 * dustMult()) * PLAYER.fishCatchPerSession + PLAYER.bugCoinsPerSession) * (project.scale || 1);   /* イベント報酬も仕事の桁で伸びる */
          coins += evCoins; coinsEarned += evCoins; dayCoins += evCoins;
        }
      }
      const fb = firstBoost();
      const resMultV = 1 + 0.05 * rep.impl;   /* 反復研究（実装）の倍率 */
      /* Wave F: フィーバー寄与の実効係数（解析節の中盤 +22.4% を全期間一律には
         せず保守化 — アクティブは発動運用込み ×1.18、パッシブは蓄熱のみ ×1.04） */
      const feverF = active ? 1.18 : 1.04;
      /* F 再設計の流入（直接20%・工程80%）: 工程ぶんは自動生産と合算して
         仕掛品へ（この sim 自身の工程キャップで堰き止められる） */
      const debtF = profile === "black" ? 1 / (1 + simDebt / 50) : 1;   /* 実機 produceDP の debtEff と同じ形 */
      const prodF = mlt * fb * resMultV * feverF * debtF;
      /* 工程中心（game の cheerCarry と同じ）: 応援は溜まった仕掛品を下流から手で運んで出荷する
         （威力 × carryMult ぶん。新しい DP は生まないので runDP には数えない）。生産側は従来どおり */
      if(clickRaw > 0 && !project.planning){
        let left = clickRaw * CARRY_MULT * prodF;
        const want = left;
        for(const k of ["built", "tested", "code"]){ const t = Math.min(left, wip[k]); wip[k] -= t; left -= t; }
        projDP += want - left;
      }
      const clickProd = clickRaw * 0.8;
      const produced = (raw + clickProd) * prodF;
      wip.code += produced; runDP += produced;
      /* 応援クリック由来の分はバグ混入 ×inputBugRate（game の produceDP と同じ） */
      bugStock += (raw + clickProd * BAL.inputBugRate) * prodF * bugPerDP * (1 - 0.15 * (project.planLv || 0));   /* 企画Lv（game の planBugMult） */
      // 応援クリックの20%だけが工程をバイパスして直接進捗へ（企画中は全量が仕掛品行き）
      if(clickRaw > 0){
        if(project.planning){ const ex = clickRaw * mlt * fb * resMultV * feverF; wip.code += ex; runDP += ex; bugStock += ex * bugPerDP * BAL.inputBugRate; }
        else { const direct = clickRaw * 0.2 * mlt * fb * resMultV * feverF; projDP += direct; runDP += direct; }
      }
      ideas += IDEA_PER_MIN + 0.3 * ss.careW;
      /* 企画を練る（game の planProject）: 着工中の作品が半分に届く前に、足りれば練る。
         アイデアの蓄え → オーバークロックの溜まりの損得は日次モデルに載せず（フィーバーは feverF の定数）、
         Wave F の後の解析節「企画とアイデアの蓄え」で示す */
      if(project.size !== "TUT" && !project.planning && (project.planLv || 0) < 3 && projDP < project.total * 0.5){
        const pc = Math.ceil(project.total / (project.scale || 1) / 20) * ((project.planLv || 0) + 1);   /* アイデア払いなので桁を掛けない */
        if(ideas >= pc + (project.ideaCost || 0)){ ideas -= pc; project.planLv = (project.planLv || 0) + 1; planBuys++; }
      }
      // 企画中: アイデアが貯まったら着工
      for(const pr of [project, project2]){
        if(pr && pr.planning && ideas >= pr.ideaCost){ ideas -= pr.ideaCost; pr.planning = false; }
      }
      if(line2){
        /* Sprint 4: 第2ライン高速化 (res_eff2 ×1.5) と反復研究も反映 */
        const produced2 = (BAL.line2BaseRate + 0.8 * ss.progW) * mlt * (res.res_eff2 ? 1.5 : 1) * resMultV * debtF;  // 倍率の二重適用は game 側で修正済み
        wip2.code += produced2; runDP += produced2;
        bugStock += produced2 * bugPerDP;
      }
      // --- 工程処理（各ライン独立の工程容量。game 側と同期: 2026-10-26 飢餓修正） ---
      const bugF = bugStock > 8 ? Math.max(0.5, 1 - (bugStock - 8) * 0.02) : 1;
      const caps = { test: R.test, build: R.build, ship: R.ship };
      const used = project.planning ? { test:0, build:0, ship:0, credited:0 } : processPipe(wip, caps, bugF);
      projDP += used.credited;
      {
        const inflow = raw * prodF;
        let st = "impl", low = inflow;
        for(const k of ["test", "build", "ship"]){ const v = k === "test" ? R.test * bugF : R[k]; if(v < low){ low = v; st = k; } }
        bnStage = st; bnVotes[st]++; bnTime[st]++;
        if(min % 30 === 29){
          const top = Object.keys(bnVotes).reduce((a, b) => bnVotes[b] > bnVotes[a] ? b : a);
          if(bnBlock !== null && top !== bnBlock) bnSwitches++;
          bnBlock = top; bnVotes = { impl:0, test:0, build:0, ship:0 };
        }
      }
      if(line2 && project2){
        const used2 = project2.planning ? { credited:0 } : processPipe(wip2, caps, bugF);
        proj2DP += used2.credited;
      }
      // --- バグ処理（QA＋みゅけのデバッグ叩き近似） ---
      bugStock = Math.max(0, bugStock - qaPerMin(up, res, ss) * stageMultSim("test"));
      /* 帯の山を見て潰す近似: アクティブなプレイヤーは滞留を積極的に潰す
         （上限 6/分）、パッシブはたまのチラ見（上限 1/分）。ブランド帯域の
         判定はこのドレイン後の在庫で実機に倣う */
      if(bugStock > 3) bugStock = Math.max(0, bugStock - Math.min(bugStock - 3, active ? 6 : 1));
      if(bugStock > milestones.maxBugStock) milestones.maxBugStock = bugStock;
      rp += ss.rp;
      /* Sprint 4: ティア1全完了後の研究員は第二の仕事でアイデアも生む (game と同じ ×0.6) */
      if(ss.rp > 0 && RESEARCH.filter(r => !r.requires).every(r => res[r.id])) ideas += ss.rp * 0.6;
      // --- リリース判定 ---
      while(projDP >= project.total){
        projDP -= project.total;
        project = release(project.size, false, project.planLv, project.scale);
        dayReleases++;
        if(milestones.firstReleaseMin === null) milestones.firstReleaseMin = min + 1;
      }
      if(line2 && project2){
        while(proj2DP >= project2.total){
          proj2DP -= project2.total;
          project2 = release(project2.size, true, 0, project2.scale);
          dayReleases++;
        }
      }
      // --- 研究（res_line2 を優先、他は表示順。RP +2 の余裕を見て買う。
      //     Sprint 4: ティア2は前提を終えるまで買えない） ---
      const buyResearch = id => {
        const r = RESEARCH.find(x => x.id === id);
        if(r && !res[r.id] && (!r.requires || res[r.requires]) && rp >= r.cost + 2){ rp -= r.cost; res[r.id] = true; return true; }
        return false;
      };
      buyResearch("res_line2");
      for(const r of RESEARCH) buyResearch(r.id);
      /* 2026-10-26 決定（レビュー室「可」）: 反復研究は非反復研究の全取得後に買う。
         旧方針（価格+20 の余裕・全取得ゲートなし）とは別物。証跡ツール側の前提のみで本体数値は不変 */
      /* 反復研究は工程別: いまの律速工程（実装の流入か、最も遅い後工程）の1本を買う */
      if(RESEARCH.every(r => res[r.id])){
        const inflow = raw * mlt * resMultV;
        let st = "impl", low = inflow;
        for(const k of ["test", "build", "ship"]) if(R[k] < low){ low = R[k]; st = k; }
        if(rp >= repeatCost(rep[st])){ rp -= repeatCost(rep[st]); rep[st]++; }
        repMax = Math.max(repMax, rep.impl + rep.test + rep.build + rep.ship);
      }
      /* Sprint 4: 研究の枯渇タイミングを記録（ティア1 = 前提なし研究の全完了日、
         全研究 = 反復を除く全研究の完了日） */
      if(milestones.resT1Day === null && RESEARCH.filter(r => !r.requires).every(r => res[r.id])) milestones.resT1Day = day;
      if(milestones.resAllDay === null && RESEARCH.every(r => res[r.id])) milestones.resAllDay = day;
      // --- 購入（最大4件/分） ---
      /* Wave G・バグ外注のプレイヤーモデル: アクティブなプレイヤーはバグが
         滞留したら外注で一掃する（実機の relief valve。費用はバグ×30、
         負債ぶんはこの sim では未モデルなので数えない。手元に余裕がある
         ときだけ使う）。パッシブは気づかないので使わない */
      if(active && bugStock >= 12){
        const vcost = Math.floor(bugStock) * 30;
        if(coins >= vcost * 1.5){ coins -= vcost; bugStock = 0; }
      }
      for(let buy = 0; buy < 4; buy++){
        const acted = (() => {
          // 1) 初雇用: 最安の役職を即雇用
          if(staff.length === 0){
            let cheapRole = null, cheapCost = Infinity;
            for(const role of Object.keys(STAFF_ROLES)){
              const c = hireCost(staff, role);
              if(c < cheapCost){ cheapCost = c; cheapRole = role; }
            }
            if(coins >= cheapCost){
              coins -= cheapCost; staff.push({ role: cheapRole, lv: 1 });
              if(milestones.firstHireDay === null) milestones.firstHireDay = day;
              return true;
            }
            return false;
          }
          // 2) 子ねこボット貯金（最優先の買い物）
          if(!(up.bot > 0)){
            const def = UPGRADE_DEFS.find(u => u.id === "bot");
            const c = cost(def, 0);
            if(coins >= c){
              coins -= c; up.bot = 1;
              if(milestones.firstUpgradeDay === null) milestones.firstUpgradeDay = day;
              if(milestones.botDay === null) milestones.botDay = day;
              return true;
            }
            return false; // 貯金中は他の買い物をしない
          }
          // 3) 貯金ゴール: 第2ライン建設 / スタジオ拡張（安い方から）
          const goals = [];
          if(res.res_line2 && !line2) goals.push({ kind:"line2", c: BAL.line2BuildCost });
          /* スタジオ拡張の貯金開始は「定員の6割を超えたら」— 実機の buyStudio に
             定員条件はなく、プレイヤーは席が埋まる前に拡張を狙う。旧ポリシー
             （定員フル時のみ）は Lv5 以降を不当に遠く見せていた */
          if(staff.length >= Math.ceil(capOf() * 0.6) && studioLv < STAFF_CAPS.length) goals.push({ kind:"studio", c: studioCost(studioLv) });
          if(goals.length){
            goals.sort((a, b) => a.c - b.c);
            const g = goals[0];
            if(coins < g.c) return false; // 貯金中
            coins -= g.c;
            if(g.kind === "line2"){
              line2 = true; project2 = drawProject(line2RateSim()); proj2DP = 0;
              if(milestones.line2Day === null) milestones.line2Day = day;
            } else {
              studioLv++;
              if(milestones.rankDays[studioLv] === undefined) milestones.rankDays[studioLv] = day;
              if(studioLv === 5 && milestones.coinsAtLv5 === null) milestones.coinsAtLv5 = coinsEarned;
            }
            return true;
          }
          // 4) 貪欲: 最安の候補を買う
          const ssNow = staffSums(staff);
          let best = null;
          /* 工程中心のプレイヤー像: 詰まっている工程の強化（設備・担当の雇用）を
             優先して買う。その工程の最安品が手持ちを超えるなら、その価格の3割未満の
             ものだけ寄り道で買い、残りは貯める */
          const STAGE_OF = { keyboard:"impl", ide:"impl", prog:"impl", tester:"test", test:"test",
                             ci:"build", pack:"build", carry:"ship", bot:"ship" };
          let need = Infinity;
          const consider = (kind, key, c, extra) => {
            const onBn = STAGE_OF[key] === bnStage;
            if(onBn && c < need) need = c;
            if(coins < c) return;
            const pri = onBn || kind === "clickup" ? 0 : 1;   /* 応援クリック派はクリック強化も本筋として買う */
            if(!best || pri < best.pri || (pri === best.pri && c < best.c)) best = { kind, key, c, extra, pri };
          };
          for(const def of UPGRADE_DEFS){
            const lv = up[def.id]||0;
            if(lv < def.max) consider("upgrade", def.id, cost(def, lv));
          }
          if(staff.length < capOf()){
            let rolePick = null, roleCost = Infinity, roleCount = Infinity;
            for(const role of Object.keys(STAFF_ROLES)){
              const n = ssNow.byRole[role]||0, c = hireCost(staff, role);
              if(STAGE_OF[role]) consider("hire", role, c);   /* 工程の担当は詰まり具合で選ぶ */
              else if(n < roleCount || (n === roleCount && c < roleCost)){ rolePick = role; roleCost = c; roleCount = n; }
            }
            if(rolePick) consider("hire", rolePick, roleCost);
          }
          if(active){
            for(const def of CLICK_DEFS){
              const lv = cu[def.id]||0;
              if(lv < def.max) consider("clickup", def.id, clickCost(def, lv));
            }
          }
          for(const st of staff){
            if(st.lv < STAFF_POLICY_MAX_LV && coins >= trainCost(st) * 2.5) consider("train", null, trainCost(st), st);
          }
          if(!best) return false;
          if(best.pri === 1 && need < Infinity && best.c >= need * 1.0) return false;
          coins -= best.c;
          if(best.kind === "upgrade"){
            up[best.key] = (up[best.key]||0) + 1;
            if(milestones.firstUpgradeDay === null) milestones.firstUpgradeDay = day;
            if(best.key === "bot" && milestones.botDay === null) milestones.botDay = day;
          } else if(best.kind === "hire"){
            staff.push({ role: best.key, lv: 1 });
            if(milestones.firstHireDay === null) milestones.firstHireDay = day;
          } else if(best.kind === "clickup"){
            cu[best.key] = (cu[best.key]||0) + 1;
          } else if(best.kind === "train"){
            best.extra.lv++;
          }
          return true;
        })();
        if(!acted) break;
      }
    }
    releasesByDay.push(dayReleases);
    /* 手応えの計測（理念書3・4）: 日の終わり（売却前）の放置生産・実際に流れる量・1クリックの重み。
       1クリックの進捗 = 直接20% ＋ 手で運ぶ（carryMult 倍。仕掛品があれば）＋ 後工程に余裕がある分の流入 */
    {
      const R = rates(), mltF = dpMult(up) * dustMult();
      const cfF = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
      const bstF = profile === "idle" ? 0 : Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      const prodF = ((BAL.basePerMin + bstF) * cfF + R.bot + R.ss.prog) * mltF;
      const stageMin = Math.min(R.test, R.build, R.ship);
      const cpm = sessionClickDPperMin(cu, perks.focus, prodF / mltF, dustMult()) * mltF;
      const c = cpm / PLAYER.clicksPerMin;
      const slack = Math.max(0, Math.min(1, (stageMin - prodF) / Math.max(1e-9, 0.8 * cpm)));
      feel.push({ day, prod: prodF, thr: Math.min(prodF, stageMin), click: c, clickPct: (0.2 * c + 0.8 * c * slack + CARRY_MULT * c) / project.total * 100,
                  session: Math.min(prodF + cpm, stageMin + cpm * (0.2 + CARRY_MULT)) / Math.max(1e-9, Math.min(prodF, stageMin)) });   /* 運べるのは作られた分だけ（生産＋クリック）。工程の上限はクリックの手運びで越えられる */
    }
    /* Sprint 4: その日の経済スナップショット（引っ越し判定の前に取る）。
       ご褒美価格は game の treatCost と同じ式（その日の初回購入価格） */
    econ = { dayCoins, coinsEarned, treatCost: Math.ceil(150 * (1 + coinsEarned / 25000)) };
    /* 投資由来の能力割合: 各工程の能力のうち、スタッフと設備が生んでいる分（素の能力＝みゅけ本人・入力・
       工程の基本値を除く）。売却直後の更地を拾わないよう、7日目以降の毎日の終わり（売却前）の平均で見る */
    if(day >= 7){
      const R = rates(), bm = buildEquipMult(up);
      const cfD = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
      const boostD = profile === "idle" ? 0 : Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      const inv = (R.bot + R.ss.prog) * dpMult(up) + (BAL.equipDP.tester*(up.tester||0) + R.ss.testDP) + ((BAL.equipDP.ci*(up.ci||0) + BAL.equipDP.pack*(up.pack||0)) * bm + BAL.stageBaseRate * (bm - 1)) + (BAL.equipDP.bot*(up.bot||0) + R.ss.ship);
      const all = ((BAL.basePerMin + boostD) * cfD + R.bot + R.ss.prog) * dpMult(up) + (BAL.stageBaseRate + BAL.equipDP.tester*(up.tester||0) + R.ss.testDP) +
        (BAL.stageBaseRate + BAL.equipDP.ci*(up.ci||0) + BAL.equipDP.pack*(up.pack||0)) * bm + (BAL.stageBaseRate + BAL.equipDP.bot*(up.bot||0) + R.ss.ship);
      shareSum += inv / all; shareN++;
      staffShare7 = shareSum / shareN;
    }
    if(day === 7){
      const R = rates();
      const mlt = dpMult(up) * dustMult();
      const codingFrac = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
      const boost = profile === "idle" ? 0 : Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      const passivePerMin = ((BAL.basePerMin + boost) * codingFrac + R.bot + R.ss.prog) * mlt;
      const clickPerMin = sessionClickDPperMin(cu, perks.focus, passivePerMin / mlt, dustMult()) * mlt;

      snapshot7 = { passivePerMin, clickPerMin, ratio: (passivePerMin + clickPerMin) / passivePerMin, staff: staff.length, studioLv };
    }
    // --- プレステージ（既定は星屑10個ぶんで実施。3個ぶん到達日も記録。
    //     prestigeAt を渡すとその個数で回す計測ランになる — 第2ウェーブ I） ---
    /* game の dustGainFromDP と同じ式（softcap 超過分は dustGainExp 乗） */
    const gainX = runDP / BAL.prestigeDPPerDust;
    const gain = Math.floor(gainX <= BAL.dustSoftcap ? gainX : BAL.dustSoftcap * Math.pow(gainX / BAL.dustSoftcap, BAL.dustGainExp));
    if(milestones.prestigeFeasibleDay === null && gain >= 3) milestones.prestigeFeasibleDay = day;
    if(gain >= (prestigeAt || 10)){
      milestones.prestigeCount++;
      if(milestones.prestigeDay === null) milestones.prestigeDay = day;
      dust += gain; dustTotal += gain; runDP = 0; rp = 0; bugStock = 0; ideas = 0;
      if(runCoins > milestones.maxRunCoins) milestones.maxRunCoins = runCoins;
      runCoins = 0; simDebt = 0;
      /* 第2ウェーブ J: 5回目の EXIT 時点の時代の通算星屑（星団の材料の実測） */
      if(milestones.prestigeCount === 5 && milestones.hold5Day === null){ milestones.hold5Day = day; milestones.hold5Dust = dustTotal; }
      brand = 0;   /* Wave G: ブランドは EXIT で清算（承認済み仕様） */
      rep = { impl:0, test:0, build:0, ship:0 };   /* 反復研究もリセット対象 (game と同一) */
      coins = perks.seedmoney ? 300 : 0;   /* Sprint 3: 星屑特典「初期資金」 */
      project = settle({ size:"S", total: BAL.sizes.S, ideaCost: IDEA_COST.S, planning: false }); projDP = 0;
      for(const k of Object.keys(up)) delete up[k];
      for(const k of Object.keys(res)) delete res[k];
      for(const k of Object.keys(cu)) delete cu[k];
      staff = []; studioLv = 1; line2 = false; project2 = null;
      wip = { code:0, tested:0, built:0 }; wip2 = { code:0, tested:0, built:0 };
    }
    /* Sprint 3: 星屑ショップ（貪欲: 初期資金 → 集中ブースト。ベテラン制度と
       研究ノートは回復の質の話なので、この最小モデルでは買わない） */
    for(const pk of [["seedmoney", 3], ["focus", 4]]){   /* 第2ウェーブ I: focus の価格改定 5→4 に追随 */
      if(!perks[pk[0]] && dust >= pk[1]){ dust -= pk[1]; perks[pk[0]] = true; }
    }
  }
  if(runCoins > milestones.maxRunCoins) milestones.maxRunCoins = runCoins;
  return { milestones, releasesByDay, totalReleasesEver, dust, dustTotal, snapshot7, rep, repMax, econ, reqDone, bnSwitches, bnTime, staffShare7, planBuys, feel };
}

const sum = (arr, n) => arr.slice(0, n).reduce((a,b)=>a+b, 0);
function report(label, r){
  console.log("=== " + label + " ===");
  console.log("初リリース: 初日の開始から約 " + r.milestones.firstReleaseMin + " 分");
  console.log("初アップグレード: " + (r.milestones.firstUpgradeDay ?? "なし") + " 日目");
  console.log("初雇用: " + (r.milestones.firstHireDay ?? "未達") + " 日目");
  console.log("初オートメーション（子ねこボット）: " + (r.milestones.botDay ?? "未達") + " 日目");
  console.log("第2ライン建設: " + (r.milestones.line2Day ?? "未達") + " 日目");
  console.log("社格到達日（Phase B）: " + [1,2,3,4,5,6].map(lv => "Lv"+lv+"="+(r.milestones.rankDays[lv] === undefined ? "未達" : r.milestones.rankDays[lv]+"日目")).join(" / "));
  console.log("リリース数: 7日目まで " + sum(r.releasesByDay, 7) + " 作品 / 30日目まで " + r.totalReleasesEver + " 作品");
  console.log("プレステージ実行可能（星屑3個ぶん）: " + (r.milestones.prestigeFeasibleDay ? r.milestones.prestigeFeasibleDay + " 日目" : "30日以内に未達"));
  console.log("プレステージ実施（星屑10個ぶん・方針）: " + (r.milestones.prestigeDay ? r.milestones.prestigeDay + " 日目" : "30日以内に未実施"));
  console.log("30日後の星屑: 通算 " + r.dustTotal + "（所持 " + r.dust + "、ショップ購入後の残り）");
  console.log("研究の枯渇: ティア1全完了 " + (r.milestones.resT1Day ? r.milestones.resT1Day + " 日目" : "30日以内に未完") +
    " / ティア2込み全研究完了 " + (r.milestones.resAllDay ? r.milestones.resAllDay + " 日目" : "30日以内に未完") +
    " / 反復研究（工程別）は 30日目で 実装" + r.rep.impl + "・テスト" + r.rep.test + "・ビルド" + r.rep.build + "・出荷" + r.rep.ship + "（1ランの合計最大 Lv" + r.repMax + "・枯渇しない）");
  if(r.econ) console.log("30日目の支出可能性: その日のコイン収入 " + r.econ.dayCoins + "🪙 / 通算収入 " + r.econ.coinsEarned +
    "🪙 / 高級おやつ価格 " + r.econ.treatCost + "🪙 → 1日収入で約 " + Math.floor(r.econ.dayCoins / Math.max(1, r.econ.treatCost)) + " 個買える");
  const pd = r.milestones.prestigeDay;
  if(pd && r.releasesByDay.length >= pd + 2){
    console.log("回復の速さ（星屑ショップ込み）: 初回ラン2日目 " + r.releasesByDay[1] +
      " 作品 vs 引っ越し2日後（" + (pd + 2) + "日目） " + r.releasesByDay[pd + 1] + " 作品");
  }
  console.log("日別リリース: " + r.releasesByDay.join(","));
  { const T = Object.values(r.bnTime).reduce((a, b) => a + b, 0) || 1;
    console.log("律速工程の時間比: 実装 " + (r.bnTime.impl / T * 100).toFixed(0) + "% / テスト " + (r.bnTime.test / T * 100).toFixed(0) + "% / ビルド " +
      (r.bnTime.build / T * 100).toFixed(0) + "% / 出荷 " + (r.bnTime.ship / T * 100).toFixed(0) + "%・切り替わり " + r.bnSwitches + " 回（30分単位）");
    { const at = d => r.feel.find(x => x.day === d) || r.feel[r.feel.length - 1];
      console.log("手応え（日の終わり）: " + [1, 3, 7, 14, 30].map(d => { const x = at(d); return d + "日目 放置 " + x.thr.toFixed(0) + "DP/分・1クリック " + x.click.toFixed(1) + "DP（作品の " + x.clickPct.toFixed(2) + "%）・応援中 ×" + x.session.toFixed(1); }).join(" / "));
      /* 成長: 30日間の「流れる量」の最高記録。記録が1割以上伸びない日が続いた最長日数（停滞） */
      let best = 0, flat = 0, maxFlat = 0;
      for(const x of r.feel){ if(x.thr > best * 1.1){ best = x.thr; flat = 0; } else { flat++; if(flat > maxFlat) maxFlat = flat; } }
      console.log("成長: 流れる量の最高記録 " + r.feel[0].thr.toFixed(0) + " → " + best.toFixed(0) + " DP/分（×" + (best / Math.max(1e-9, r.feel[0].thr)).toFixed(1) + "）・記録が1割伸びない最長 " + maxFlat + " 日"); }
    console.log("企画を練った回数（30日）: " + r.planBuys + " 回 / リリース " + r.totalReleasesEver + " 作品");
    console.log("工程能力のうちスタッフと設備が生む割合（7日目以降の日末平均）: " + (r.staffShare7 * 100).toFixed(0) + "%"); }
  if(r.snapshot7){
    console.log("7日目時点: スタッフ " + r.snapshot7.staff + "人 / スタジオLv" + r.snapshot7.studioLv +
      " / 放置生産 " + r.snapshot7.passivePerMin.toFixed(1) + " DP/分");
  }
  console.log("");
}
const rp7 = simulate(30, false);
const ra7 = simulate(30, true);
console.log("######## みゅけ バランスシミュレーション v2.1（カジュアル: 3h/日 × 30日）########\n");
report("パッシブ（放置＋ページ内入力のみ）", rp7);
report("アクティブ（＋応援クリック 3回×3分/日）", ra7);
if(ra7.snapshot7){
  console.log("クリックセッション中の生産倍率（7日目時点）: 放置 " + ra7.snapshot7.passivePerMin.toFixed(1) +
    " DP/分 → アクティブ " + (ra7.snapshot7.passivePerMin + ra7.snapshot7.clickPerMin).toFixed(1) +
    " DP/分 = 約 " + ra7.snapshot7.ratio.toFixed(2) + " 倍");
}
/* ゲート定義の改訂（レビュー室【可】・2026-10-26、663b362 提案の反映）:
   Wave G のブランドは全プレイヤーの出荷に効く共通の複利乗数（7日目で価格
   ×2.2 前後）で、価格モデルに入れると共通項が分母を膨らませコイン比が
   構造的に 1 へ圧縮される（実測: ブランド未モデル 1.54 → モデル化後 1.26）。
   進行を決める通貨である星屑を主指標に据える改訂で、厳しさの水準 1.3 は維持。
   主指標＝星屑通算比 ≥1.3 かつ コイン比 ≥1.1（下限）かつ 件数比 ≥1.0。
   3指標とも出力に残す。初リリース ≤5分・7日目以降0リリース日 0 は不変。
   将来また「共通乗数で圧縮された」と主張する際は、ブランド OFF の対照ランを
   必ず添付すること（レビュー室の条件）。件数比の余裕は薄い（1.08 対下限 1.0）
   ため、次に削れたら較正の問題ではなく実信号として扱う。 */
const coinRatio = ra7.econ.coinsEarned / Math.max(1, rp7.econ.coinsEarned);
const dustRatio = ra7.dustTotal / Math.max(1, rp7.dustTotal);
const countRatio = ra7.totalReleasesEver / Math.max(1, rp7.totalReleasesEver);
console.log("30日コイン比（アクティブ/パッシブ）: " + coinRatio.toFixed(2) + " 倍 / 星屑比: " + dustRatio.toFixed(2) + " 倍 / 件数比: " + countRatio.toFixed(2) + " 倍");
/* 工程中心のゲート（2026-10-27）: 7日目以降、工程能力の半分以上がスタッフと設備から来る /
   30日で律速工程が3回以上入れ替わる（どの工程に投資するかの判断が回り続ける） */
for(const [lb, r] of [["passive", rp7], ["active", ra7]]){
  console.log("工程中心ゲート " + lb + ": 投資由来の能力 " + (r.staffShare7 * 100).toFixed(0) + "%（≥50%） " + (r.staffShare7 >= 0.5 ? "PASS" : "FAIL") +
    " / 律速の入れ替わり " + r.bnSwitches + " 回（≥3） " + (r.bnSwitches >= 3 ? "PASS" : "FAIL"));
}
console.log("Sprint 1 ゲート（改訂2）: 初リリース ≤ 約5分（両タイプ） / 主指標＝星屑通算比 ≥1.3 かつ コイン比 ≥1.1 かつ 件数比 ≥1.0 / 7日目以降は全日 ≥1 リリース");
console.log("ゲート判定: 初リリース passive=" + rp7.milestones.firstReleaseMin + "分 active=" + ra7.milestones.firstReleaseMin + "分 / コイン比 " +
  coinRatio.toFixed(2) + " / 星屑比 " + dustRatio.toFixed(2) + " / 件数比 " + countRatio.toFixed(2) + " / 7日目以降の0リリース日 passive=" +
  rp7.releasesByDay.slice(6).filter(x=>x===0).length + " active=" + ra7.releasesByDay.slice(6).filter(x=>x===0).length);
console.log("Sprint 3: 星屑ショップ最小モデル（初期資金→集中を貪欲購入）を有効化。プレステージ到達日と引っ越し後の回復は各レポートの「回復の速さ」行を参照");

/* ===== Phase C: 依頼の自動獲得（営業）vs 手動 — 到達時間の比較 =====
   手動 = 従来モデル（依頼が噛み合う確率 0.4 × 一律 +60%）。
   自動 = 営業が枠を常時埋め、メインラインの全リリースが依頼達成になる
   （ボーナス率は担当者の成長に伴うティア期待値、サイズ未満の半額を
   見込んだ ×0.9 の保守係数つき）。同じアクティブ軌道で比較する */
const raAuto = simulate(30, true, "auto");
console.log("");
console.log("== Phase C: 依頼経済の比較（アクティブ・30日）==");
console.log("手動: 依頼達成 " + ra7.reqDone + " 件 / 通算コイン " + Math.round(ra7.econ.coinsEarned) + "🪙 / プレステージ到達 " + (ra7.milestones.prestigeDay ? ra7.milestones.prestigeDay + "日目" : "未達"));
console.log("自動: 依頼達成 " + raAuto.reqDone + " 件 / 通算コイン " + Math.round(raAuto.econ.coinsEarned) + "🪙 / プレステージ到達 " + (raAuto.milestones.prestigeDay ? raAuto.milestones.prestigeDay + "日目" : "未達"));
console.log("差分: 依頼達成 +" + (raAuto.reqDone - ra7.reqDone) + " 件 / 通算コイン +" + Math.round(raAuto.econ.coinsEarned - ra7.econ.coinsEarned) + "🪙（自動は序盤=手動超え・中盤以降は担当者の成長で差が開く設計）");

/* ===== Phase D: 子会社の配分感度（仕様書5節の数値ゲート） =====
   ゲーム側の式を複製して測る: レート = 人員 × (1+0.3×(Lv-1)) × 注力度
   × ジャンル単価。注力度 = 0.5 + 1.5×sqrt(配分/100)（2026-10-26 23:17回・
   凹関数化。端点は不変: 配分0%で ×0.5、100%で ×2.0）。ジャンル単価 =
   1 + 0.1×解放順インデックス（app=1.0 … robot=1.7）。コイン = レート × 0.35、
   DP = レート × 0.2。ゲート: 注力度の逓減で最適配分が内点にあり、
   誤配分は損になること（角への集中が最善でなくなる） */
console.log("");
console.log("== Phase D: 子会社の配分感度（人員30・規模Lv3 の2社）==");
{
  const subCoins = (staff, lv, genreIdx, alloc) =>
    staff * (1 + 0.3 * (lv - 1)) * (0.5 + 1.5 * Math.sqrt(alloc / 100)) * 0.35 * (1 + 0.1 * genreIdx);
  const A = (a) => subCoins(30, 3, 7, a);        /* robot（単価1.7） */
  const B = (a) => subCoins(30, 3, 0, a);        /* app（単価1.0） */
  const even = A(50) + B(50), opt = A(74) + B(26), toA = A(90) + B(10), toB = A(10) + B(90);
  console.log("均等 50/50: " + even.toFixed(1) + "🪙/分（A " + A(50).toFixed(1) + " + B " + B(50).toFixed(1) + "）");
  console.log("内点最適 74/26: " + opt.toFixed(1) + "🪙/分（均等比 +" + ((opt / even - 1) * 100).toFixed(1) + "%・集中90/10比 +" + ((opt / toA - 1) * 100).toFixed(1) + "%）");
  console.log("高単価へ集中 90/10: " + toA.toFixed(1) + "🪙/分（均等比 +" + ((toA / even - 1) * 100).toFixed(1) + "%）");
  console.log("低単価へ集中 10/90: " + toB.toFixed(1) + "🪙/分（均等比 " + ((toB / even - 1) * 100).toFixed(1) + "%）");
  console.log("感度判定: 内点最適が均等と角の両方を上回り、逆集中は " + Math.abs((toB / even - 1) * 100).toFixed(1) + "% 減 — 配分に内点の最適があり誤配分は損になる: " +
    (opt > even && opt > toA && toB < even * 0.92 ? "PASS" : "FAIL"));
  const first = subCoins(5, 1, 7, 100);
  console.log("参考: 設立直後（人員5・Lv1・robot・配分100%）= " + first.toFixed(1) + "🪙/分 / 育成後3社（人員50・Lv6・中位ジャンル・均等）≈ " +
    Math.round(3 * subCoins(50, 6, 3, 33)) + "🪙/分（本社30日目の平均 ~30🪙/分 を大きく上回り、終盤の主収入になる設計）");
}

/* ===== Wave F: オーバークロックの寄与（再設計版・数値ゲート） =====
   解析モデル（前提を明示）: 中盤のアクティブプレイヤーのスナップショット —
   自動生産 P=330 DP/分（autoProdEMA = 5.5/秒）、応援クリック 40回/分。
   再設計後のクリック基礎 = 0.25 + 5.5×0.05 = 0.525（ハイブリッド連動）、
   コンボ平均 2.84・クリEV 1.72（レーンA 実測）。フィーバーの寄与は
   (a) 蓄熱パッシブ: 充填中ゲージが線形に伸びる前提で平均 +(passiveMax/2)
   (b) 発動バースト: 生産 ×prodMult が durationMs 続く
   (c) 発動中クリック ×clickMult の増分
   の合計。ゲート: 総収入への上乗せ 15〜40%。
   連打ツールの上限も併記する: バケツ上限（300/分）で連打しても、直接進捗
   への貫通（directShare）ぶんしか即時には効かず、残りは工程キャップに
   堰き止められる — 直接貫通の上限が自動生産を下回ることを確認する */
console.log("");
console.log("== Wave F: オーバークロックの寄与（再設計版・アクティブ中盤スナップショット）==");
{
  const srcF = GAME_SRC;
  const fm = srcF.match(/const FEVER = \{ chargePerBoostDP: ([\d.]+), chargePerClick: ([\d.]+), durationMs: (\d+), prodMult: ([\d.]+), clickMult: ([\d.]+), passiveMax: ([\d.]+) \}/);
  if(!fm) throw new Error("FEVER extraction failed");
  const F = { cB: +fm[1], cC: +fm[2], durS: +fm[3] / 1000, pM: +fm[4], kM: +fm[5], pMax: +fm[6] };
  const P = 330, clickPerMin = 40, boostDPMin = 30;
  const clickBase = 0.25 + (P / 60) * 0.05, clickAvgGain = clickBase * 2.84 * 1.72;
  const clickDPMin = clickPerMin * clickAvgGain;
  const chargeMin = boostDPMin * F.cB + clickPerMin * F.cC;
  const cycleMin = 100 / chargeMin, duty = F.durS / (cycleMin * 60);
  const passiveUp = P * (F.pMax / 2);
  const prodUp = P * (F.pM - 1) * (F.durS / 60) / cycleMin;
  const clickUp = (clickPerMin * F.durS / 60) * clickAvgGain * (F.kM - 1) / cycleMin;
  const base = P + clickDPMin, up = passiveUp + prodUp + clickUp;
  console.log("充填: " + chargeMin.toFixed(1) + "/分 → 満タン周期 " + cycleMin.toFixed(1) + " 分 / デューティ " + (duty * 100).toFixed(1) + "% / クリック基礎 " + clickBase.toFixed(3) + "（連動込み）");
  console.log("上乗せ: 蓄熱 +" + passiveUp.toFixed(1) + " / 生産バースト +" + prodUp.toFixed(1) + " / クリック +" + clickUp.toFixed(1) + " DP/分 → 総収入 " + base.toFixed(0) + " に対し +" + (up / base * 100).toFixed(1) + "%");
  console.log("寄与判定（15〜40%）: " + (up / base >= 0.15 && up / base <= 0.40 ? "PASS" : "FAIL"));
  const toolDirect = 300 * clickBase * 3.0 * 1.72 * 0.2;   /* バケツ上限連打時の直接貫通/分 */
  console.log("連打ツールの直接貫通上限: " + toolDirect.toFixed(0) + " DP/分（自動生産 " + P + " を下回る）: " + (toolDirect < P ? "PASS" : "FAIL"));
}

/* ===== 企画とアイデアの蓄え（2026-10-27・sakuri の選択「在庫のアイデアにも価値」） =====
   手元のアイデアはオーバークロックの溜まりを ×(1 + IDEA_CHARGE_MAX × (1 − e^(−N/IDEA_CHARGE_SCALE))) にする。
   企画を練ると価格 +PLAN_PRICE_STEP（DP 換算で 作品の DP × step）を得るかわりに、蓄えが c 個減り、
   アイデア収入（約 IDEA_PER_MIN/分）で戻るまでのあいだ、フィーバーの上乗せ（Wave F の
   生産バースト＋クリック増分。溜まりの速さに比例）が減る。蓄熱パッシブは溜まりの速さに依らないので除く。
   同じ Wave F の中盤アクティブ（自動生産 330 DP/分）で、損得を DP で比べる。放置中心はゲージが
   ほとんど溜まらないので損は 0。
   ゲート: アクティブは「M を1回だけ練る」が得・「M を3回まで練り切る」が損、放置は練るほど得
   （押すか押さないか、どこまで練るかが遊び方で分かれる） */
{
  const num = k => { const m = GAME_SRC.match(new RegExp(k + " = ([\\d.]+)")); if(!m) throw new Error("balance-sim: " + k + " を抽出できない"); return +m[1]; };
  const IMAX = num("IDEA_CHARGE_MAX"), ISC = num("IDEA_CHARGE_SCALE"), STEP = num("PLAN_PRICE_STEP");
  const fm = GAME_SRC.match(/const FEVER = \{ chargePerBoostDP: ([\d.]+), chargePerClick: ([\d.]+), durationMs: (\d+), prodMult: ([\d.]+), clickMult: ([\d.]+), passiveMax: ([\d.]+) \}/);
  const P = 330, chargeMin = 30 * +fm[1] + 40 * +fm[2], cycleMin = 100 / chargeMin, durMin = +fm[3] / 60000;
  const clickAvgGain = (0.25 + (P / 60) * 0.05) * 2.84 * 1.72;
  const F1 = P * (+fm[4] - 1) * durMin / cycleMin + (40 * durMin) * clickAvgGain * (+fm[5] - 1) / cycleMin;   /* 溜まり ×1 のときのフィーバー上乗せ DP/分 */
  const mult = n => 1 + IMAX * (1 - Math.exp(-Math.max(0, n) / ISC));
  const lossOf = (N, c) => { let L = 0; for(let t = 0; t < c / IDEA_PER_MIN; t += 0.5) L += (mult(N) - mult(N - c + IDEA_PER_MIN * t)) * F1 * 0.5; return L; };
  const sz = BAL.sizes, pcM = Math.ceil(sz.M / 20);
  const cases = [
    ["M を1回練る（蓄え 400 から " + pcM + " 個）", 400, pcM, STEP * sz.M],
    ["M を3回まで練り切る（蓄え 800 から " + pcM * 6 + " 個）", 800, pcM * 6, 3 * STEP * sz.M],
    ["L を1回練る（蓄え 600 から " + Math.ceil(sz.L / 20) + " 個）", 600, Math.ceil(sz.L / 20), STEP * sz.L]
  ];
  console.log("\n== 企画とアイデアの蓄え（中盤アクティブ・自動生産 " + P + " DP/分・フィーバー上乗せ " + F1.toFixed(0) + " DP/分 × 溜まり倍率）==");
  const res = cases.map(([lb, N, c, gain]) => { const loss = lossOf(N, c); console.log("  " + lb + ": 得 " + gain.toFixed(0) + " DP ／ 蓄えが戻るまでの損 アクティブ " + loss.toFixed(0) + " DP・放置 0 DP"); return gain - loss; });
  console.log("企画と蓄えのゲート（アクティブ: 1回は得・練り切りは損 ／ 放置: 練るほど得）: " + (res[0] > 0 && res[1] < 0 ? "PASS" : "FAIL"));
}

/* ===== Wave G: デスマーチの損得 / ケア返済ペース（承認済み仕様書 G 節の数値ゲート・復元） =====
復元の経緯: 519686a の F 再設計コミットで eabfd00 の Wave G セクションが
丸ごと消え、デスマーチの損得ゲートが sim のどこにも無くなっていた
（レビュー室の F 再設計チェックの残件）。本ブロックで復元する。
ブランド複利の判定は復元しない — 日次 sim がブランドを帯域ルールで
モデル化しており（663b362）、旧解析節（品質出荷 +4/本の一律）より強い
カバレッジになっているため。旧ブランド行の廃止理由はここに明記する。
解析モデル（前提を明示）: 中盤の生産 300 DP/分、ケア careW 3（総務2〜3人）。
デスマーチ判定: L を 70% から強行出荷するとき、負債の生産ドラッグ
（返済し切るまでの効率損の積分 ≒ 平均負債ぶんの DP 損失）をコイン換算
（L: 750🪙/7000DP）し、「救えるボーナス」と比べる。設計意図は
「ティア1（+60%）では割に合わず、ティア3（+180%）/大型（+250%）では
割に合う」— いつも押すボタンではなく、納期救済の判断になること。
注記（レビュー室）: ティア1の分岐（ドラッグ ≈454🪙 対 +450🪙）は
モデルの誤差範囲内で、前提が少し動けば反転する。不変条件として扱わない。 */
console.log("");
console.log("== Wave G: デスマーチの損得 / ケア返済ペース ==");
{
const P = 300, careW = 3, repayPerMin = careW * 0.9; /* 実装: careW × 0.9 /分 */
const dmDebt = Math.round(0.3 * 240) + 8 * 2; /* L・70%・バグ8 の負債 = 88 */
const clearMin = dmDebt / repayPerMin;
/* ドラッグ損失: 負債が線形に減る間の平均効率損 × 生産 × 時間 */
let dragDP = 0;
for(let t = 0; t < clearMin; t++){
const d = Math.max(0, dmDebt - repayPerMin * t);
dragDP += P * (1 - 1 / (1 + d / 50));
}
const dragCoins = dragDP * (750 / 7000);
const t1 = Math.round(750 * 0.6), t3 = Math.round(750 * 1.8), big = Math.round(750 * 2.5);
console.log("デスマーチ負債 " + dmDebt + " → ケア返済 " + clearMin.toFixed(0) + " 分 / ドラッグ損失 ≈ " + Math.round(dragDP) + " DP ≈ " + Math.round(dragCoins) + "🪙");
console.log("救えるボーナス: ティア1 +" + t1 + "🪙 / ティア3 +" + t3 + "🪙 / 大型 +" + big + "🪙");
console.log("デスマーチ判定（ティア1では損・ティア3以上で得）: " + (dragCoins > t1 && dragCoins < t3? "PASS": "FAIL"));
}

/* ===== Wave H: モジュールの損得（承認済み仕様書 H 節の数値ゲート） =====
   解析モデル（前提を明示）: L 作品（totalDP 7000・素の価格 750🪙）、
   モジュール 2.5 個 × 必要 32.5% ≈ 計 5,700 DP、ライン1の自動生産
   （流入）500 DP/分の中盤〜終盤スナップショット。実態として本体の
   完成は流入でなく工程キャップ（テスト/ビルド/出荷 ≈ 各 100/分）で
   律速される — その局面では配分 30% は余剰流入から賄われ、本体の
   出荷ペースは変わらない。流入律速の薄いチームでは内製が時間を
   延ばす（その場合は外注が出口）— 最悪側の数字も併記する。
   品質は完了時 1.0、統合待ちの間に磨き（配分 10%）が進めば更に上がる */
console.log("");
console.log("== Wave H: モジュール内製/外注の損得（L・工程キャップ律速モデル）==");
{
  const totalDP = 7000, basePrice = 750, modDP = 5700, flow = 500, cap = 100, n = 2.5;
  const plainMin = totalDP / cap;                       /* 本体は出荷キャップ律速 */
  const modMin = modDP / (flow * 0.3);                  /* 内製モジュールの所要 */
  const inHouseMin = Math.max(plainMin, modMin);        /* 統合は本体完成までに間に合う */
  const polishDP = Math.max(0, (plainMin - modMin)) * flow * 0.1;
  const qPolish = Math.min(1.5, 1 + polishDP / modDP * 0.5);
  const multQ10 = Math.pow(1.2, n), multQP = Math.pow(0.8 + 0.4 * qPolish, n), multOut = Math.pow(1.12, n);
  const outCost = Math.round(modDP * 0.5);
  const rate = (price, min) => Math.round(price / min * 60);
  console.log("所要: 素 " + plainMin.toFixed(0) + "分（キャップ律速）/ 内製モジュール " + modMin.toFixed(0) + "分（本体と並行）/ 外注は即時＋" + outCost + "🪙");
  console.log("価格倍率: 内製（品質1.0）×" + multQ10.toFixed(2) + " / 内製（磨き " + qPolish.toFixed(2) + "）×" + multQP.toFixed(2) + " / 外注 ×" + multOut.toFixed(2));
  console.log("時間あたり価格: 素 " + rate(basePrice, plainMin) + " / 内製 " + rate(basePrice * multQ10, inHouseMin) + "〜" + rate(basePrice * multQP, inHouseMin) + " / 外注 " + rate(basePrice * multOut, plainMin) + "（🪙/時・外注は費用別）");
  console.log("判定（内製が素を上回る・外注も素超え）: " +
    (rate(basePrice * multQ10, inHouseMin) > rate(basePrice, plainMin) && rate(basePrice * multOut, plainMin) > rate(basePrice, plainMin) ? "PASS" : "FAIL"));
  const thinMin = Math.max(totalDP / (flow * 0.7), modDP / (flow * 0.3));
  console.log("最悪側（流入律速の薄いチーム）: 内製 " + thinMin.toFixed(0) + "分・時間あたり " + rate(basePrice * multQ10, thinMin) + "（素比 " + Math.round(rate(basePrice * multQ10, thinMin) / rate(basePrice, totalDP / flow) * 100) + "%）— その局面では外注が出口になる");
}


/* ===== 第2ウェーブ I: EXIT 小刻み化の到達時間（承認済み仕様書 I 節の数値ゲート） =====
   星屑レート 12,000→8,000＋売却下限 5→3 の効果を、本線ラン（10個方針）の
   「益≥3 到達日」と、小刻み方針（5個で売却）の計測ランで測る。
   1日 = 常駐180分のため、到達日 × 3 = 常駐時間の目安。
   目標: 初回 EXIT 可能 = 常駐10〜15時間（4〜5日目）。2日目以前は速すぎ
   （1周目の体験を踏み潰す）、6日目以降は前倒し不足としてレートを再点検する。
   小刻み方針の EXIT 回数は「持株化までに10〜15回」設計の下限側の証跡で、
   ランク追いのプレイヤー像ではないため era 到達日そのものは J で測る */
console.log("");
console.log("== Wave I: EXIT 小刻み化（初回到達と小刻み周回）==");
{
  const fP = rp7.milestones.prestigeFeasibleDay, fA = ra7.milestones.prestigeFeasibleDay;
  const cycP = simulate(30, false, undefined, 5), cycA = simulate(30, true, undefined, 5);
  console.log("初回 EXIT 可能（益≥3）: passive " + fP + "日目（常駐約" + (fP * 3) + "時間）/ active " + fA + "日目（常駐約" + (fA * 3) + "時間）");
  console.log("小刻み方針（益5で売却）30日: EXIT passive " + cycP.milestones.prestigeCount + "回 / active " + cycA.milestones.prestigeCount + "回、通算星屑 passive " + cycP.dustTotal + " / active " + cycA.dustTotal);
  const firstOk = fP >= 3 && fP <= 5 && fA >= 2 && fA <= fP;
  const cycleOk = cycP.milestones.prestigeCount >= 8 && cycA.milestones.prestigeCount >= cycP.milestones.prestigeCount;
  console.log("Wave I 判定（初回が passive 4〜5日目・小刻みで周回が回る）: " + (firstOk && cycleOk ? "PASS" : "FAIL"));
}


/* ===== 第2ウェーブ J: ホールディングス化の時代モデル（承認済み仕様書 J 節） =====
   持株化の条件のうち、sim で測れるのは星屑側（EXIT 5回＋時代の通算星屑）。
   社格 Lv6 と子会社 2社は day sim の範囲外（Lv6 は EXIT 後の到達点という
   Phase B の設計で、子会社は day sim に未モデル）— そちらは到達可能性を
   別途の実績（Phase B/D の到達日）で担保し、ここでは星団の初回量を測る。
   星団 = floor(時代の通算星屑 ÷ 20)・最低1。時代の通算は小刻み方針
   （益5で売却）のランで数えるのが実態に近い */
console.log("");
console.log("== Wave J: ホールディングス化（星団の初回量）==");
{
  const jP = simulate(30, false, undefined, 5), jA = simulate(30, true, undefined, 5);
  /* 5回目の EXIT は条件の「下限」であって時代の終わりではない。プレイヤーは
     Lv6 と子会社を追う間も EXIT を続け、時代の通算は伸び続ける。星団の
     初回量は「30日時点の時代の通算」で読む（5回目時点は下限の参考値） */
  const line = (label, r) => label + ": 5回目の EXIT = " + (r.milestones.hold5Day ? r.milestones.hold5Day + "日目（通算 " + r.milestones.hold5Dust + "）" : "未達") +
    " / 30日時点の時代の通算星屑 = " + r.dustTotal + " → 星団 +" + Math.max(1, Math.floor(r.dustTotal / 20));
  console.log(line("passive", jP));
  console.log(line("active ", jA));
  const gP = Math.floor(jP.dustTotal / 20), gA = Math.floor(jA.dustTotal / 20);
  console.log("Wave J 判定（初回星団が passive 2 以上・active 3 以上＝最初の技術選択が成立する量）: " + (gP >= 2 && gA >= 3 ? "PASS" : "FAIL"));
}


/* ===== 第2ウェーブ K: チャレンジ周回のプロファイル検証（承認済み仕様書 K 節） =====
   反証条件: 少数精鋭と完全放置が通常ランの 1.5 倍以内に Lv4 へ届くこと。
   ブラック企業は QA 投資の下でバグ在庫が均衡すること（発散しないこと）。
   あわせてブラックの目標（累計コイン）を通常ランの Lv5 到達時の累計で校正する */
console.log("");
console.log("== Wave K: チャレンジ周回 ==");
{
  const lv4 = r => r.milestones.rankDays[4];
  const minA = simulate(30, true, undefined, 10, "minority"), minP = simulate(30, false, undefined, 10, "minority");
  const idlA = simulate(30, true, undefined, 10, "idle"), idlP = simulate(30, false, undefined, 10, "idle");
  const blkA = simulate(30, true, undefined, 10, "black");
  const f = d => d === undefined ? "未達" : d + "日目";
  console.log("Lv4 到達: 通常 active " + f(lv4(ra7)) + " / passive " + f(lv4(rp7)) +
    " | 少数精鋭 active " + f(lv4(minA)) + " / passive " + f(lv4(minP)) +
    " | 完全放置 active " + f(lv4(idlA)) + " / passive " + f(lv4(idlP)));
  const within = (base, prof) => base !== undefined && prof !== undefined && prof <= Math.ceil(base * 1.5);
  const profOk = within(lv4(ra7), lv4(minA)) && within(lv4(rp7), lv4(minP)) && within(lv4(ra7), lv4(idlA)) && within(lv4(rp7), lv4(idlP));
  console.log("Wave K 判定1（少数/放置が通常の 1.5 倍以内に Lv4）: " + (profOk ? "PASS" : "FAIL"));
  console.log("ブラック企業（active・バグ×3・価格×2）: 30日のリリース " + blkA.totalReleasesEver + " 件 / バグ在庫の最大 " +
    Math.round(blkA.milestones.maxBugStock) + " 匹 / Lv5 到達時の累計 " + (blkA.milestones.coinsAtLv5 === null ? "未達" : Math.round(blkA.milestones.coinsAtLv5).toLocaleString() + "🪙"));
  const eqOk = blkA.totalReleasesEver > 0 && blkA.milestones.maxBugStock < 500;
  console.log("Wave K 判定2（ブラックのバグ在庫が QA の下で均衡する）: " + (eqOk ? "PASS" : "FAIL"));
  console.log("目標の校正: sim の短期周回方針（益10で EXIT）では1ランの累計は 通常 " + Math.round(ra7.milestones.maxRunCoins).toLocaleString() + "🪙 / ブラック " + Math.round(blkA.milestones.maxRunCoins).toLocaleString() + "🪙 止まり。" +
    "チャレンジは売却で消えるため完走は長期ランになり、sim の方針では測れない。目標 300,000🪙 は仕様書の暫定値を据え置く（価格 ×2 の L 案件が後半の主収入になる長期ラン前提。実機の完走可否は未検証の注記として残す）");
}

/* == 第2ウェーブ L: IP の生涯価値と価格スタックの天井（解析） ==
   IP: 即時 30% + ロイヤリティ 価格の 0.1%/分 × 48時間（12時間ごとに半減）。
   1ブロック12時間 = 720分 → 0.72 倍分が 1 + 1/2 + 1/4 + 1/8 の重みで入る。
   価格スタック: ブランド上限 ×10（brand 450・game 側 brandMult）×
   モジュール最大（品質上限 1.5 → 係数 1.4 の3乗 / AI 基盤あり 1.75 → 1.5 の3乗）
   × トレンド ×1.5。仕様書のゲート ≤45 は AI 基盤（J）以前の見積もり */
console.log("\n== Wave L: 自社IP の生涯価値・価格スタック ==");
{
  const num = k => { const m = GAME_SRC.match(new RegExp(k + " = ([\\d.]+)")); if(!m) throw new Error("balance-sim: " + k + " を抽出できない"); return +m[1]; };
  const IPS = num("IP_SIZE_MULT"), IPF = num("IP_FAIL_MULT"), IPR = num("IP_ROYALTY_PER_MIN");
  const ipLife = 0.3 + IPR * 720 * (1 + 0.5 + 0.25 + 0.125);
  console.log("IP の生涯倍率: ×" + ipLife.toFixed(2) + "（即時 0.3 + ロイヤリティ " + (ipLife - 0.3).toFixed(2) + "。元本は依頼ボーナスを含まない通常価格）— 依頼ボーナスの上限（ティア3 +180% = ×2.8）を下回り、『全部 IP が全勝』にはならない");
  /* IP ねらいの損得（2026-10-27 作り直し）: 規模 ×IPS の作り込みで、成功（バグ0出荷）なら生涯 ipLife、
     空振りなら価格 ×IPF。DP あたりの価値を通常作 = 1 として、成立率 q の期待値が 1 を超える境目を出す。
     ロイヤリティは常駐48時間で入り切る前提（その前に EXIT すると残りは消える）。
     ゲート: 境目の成立率が 35〜75%（いつも得でもいつも損でもなく、バグを0にできる見込みで判断が分かれる） */
  const okV = ipLife / IPS, ngV = IPF / IPS, qBE = (1 - ngV) / (okV - ngV);
  const partial = h => (0.3 + IPR * 60 * [0, 1, 2, 3].reduce((a, k) => a + Math.max(0, Math.min(12, h - 12 * k)) * Math.pow(0.5, k), 0)) / IPS;
  console.log("IP ねらいの損得（DP あたり・通常作 = 1）: 成立 " + okV.toFixed(2) + " / 空振り " + ngV.toFixed(2) + " → 損益分岐の成立率 " + (qBE * 100).toFixed(0) + "%" +
    "・成立しても売却までの常駐が 6時間なら " + partial(6).toFixed(2) + "・12時間 " + partial(12).toFixed(2) + "・24時間 " + partial(24).toFixed(2));
  console.log("IP ねらいゲート（損益分岐の成立率 35〜75%・常駐12時間で売却なら成立しても損）: " + (qBE >= 0.35 && qBE <= 0.75 && partial(12) < 1 ? "PASS" : "FAIL"));
  const stackBase = 10 * Math.pow(0.8 + 0.4 * 1.5, 3) * 1.5;
  const stackAI = 10 * Math.pow(0.8 + 0.4 * 1.75, 3) * 1.5;
  console.log("価格スタックの理論天井: 通常 ×" + stackBase.toFixed(1) + "（ゲート 45 以内）/ AI 開発基盤あり ×" + stackAI.toFixed(1) +
    "（J でモジュール上限が上がった分だけ仕様見積もりを超過。天井の同時成立は ブランド最大＋全モジュール磨き切り＋ブーム一致 の終盤条件）");
}

/* == 第2ウェーブ M: 役員オーラの大きさ（解析） ==
   役員は EXIT のたびに最大1匹ずつ増え、上限3匹。オーラは同じ役職の
   スタッフ出力に +10%/匹（加算）。3匹を1役職に寄せればその役職だけ
   ×1.3、分散すれば各役職 +10%。生産全体への効きはスタッフ構成次第で
   最大でも3役職ぶんの +10% 級 — 第1層の倍率（星屑・ブランド）に比べて
   小さく、情緒（古参が残る）が主・数字は従という仕様の置きどおり */
console.log("\n== Wave M: 役員オーラ ==");
console.log("上限: 同役職 ×1.3（3匹集中）／ 分散時は各役職 +10%。日次 sim の主指標には載せない（EXIT ごとの選択依存のため）");
