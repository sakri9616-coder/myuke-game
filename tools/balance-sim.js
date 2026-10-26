"use strict";
/* ============================================================
   みゅけ バランスシミュレーション v2.1 (Node, 依存なし)
   game/index.html の定数・仕様をそのまま写したもの。数値を変えたら両方直すこと。

   モデル概要（ゲーム実装との対応）:
   - 生産: 基本進捗(8/分)＋入力ブーストは「コーディング系の状態」のときだけ進む。
     状態マシンの遷移確率（遊び約8%＋集中力切れの休憩）から稼働率 ≈ 0.93 と置く。
     子ねこボットとプログラマ猫は状態によらず常時生産する。
   - 生産はすべて produceDP() を通る = dpMult × dustMult が掛かる。
     第2ラインは line2Rate() 自体に倍率が含まれ、さらに produceDP でも掛かる
     （出荷版の実装どおり二重適用を再現している）。
   - 工程: 生産 → 仕掛品 → テスト(bugFで減速) → ビルド → 出荷。各工程レート/分で処理し、
     第2ラインは第1ラインの残り容量を使う（テスト容量は bugF で割って消費計算）。
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
const BAL = {
  basePerMin: 8,
  keysPerDP: 3,
  cursorPxPerDP: 400,
  clicksPerDP: 2,
  boostCapPerMin: 120,
  sizes:     { TUT:120, XS:400, S:900, M:2600, L:7000 },
  coinBase:  { TUT:60,  XS:90,  S:150, M:340,  L:750 },
  rpBase:    { TUT:1,   XS:1,   S:1,   M:2,    L:4 },
  bugPerDP: 0.012,
  qaBasePerMin: 0.6,
  prestigeDPPerDust: 12000,
  dustBonus: 0.04,
  stageBaseRate: 30,
  line2BaseRate: 4,
  line2BuildCost: 1500,
  line2CoinRate: 0.7
};
const UPGRADE_DEFS = [
  { id:"keyboard", base:40, max:10 }, { id:"ide", base:120, max:10 }, { id:"monitor", base:260, max:5 },
  { id:"chair", base:180, max:5 }, { id:"duck", base:60, max:10 }, { id:"tester", base:240, max:8 },
  { id:"ci", base:200, max:10 }, { id:"pack", base:160, max:10 }, { id:"bot", base:500, max:3 }
];
const cost = (def, lv) => Math.ceil(def.base * Math.pow(1.15, lv));
const dpMult = up => 1 + 0.05*(up.keyboard||0) + 0.08*(up.ide||0) + 0.03*(up.ci||0) + 0.04*(up.pack||0);
const qaPerMin = (up, res, ss) => BAL.qaBasePerMin + 0.4*(up.duck||0) + 1.2*(up.tester||0) + (res.res_duckplay?0.2:0) + ss.qa;
/* 研究（ゲームの RESEARCH_DEFS と同じ並び・価格）
   Sprint 4: ティア2（前提つき）を追加。ジャンル依存の効果（res_game2/ai2/robot2）は
   sim がジャンルを引いていないため未モデル化（影響は軽微な範囲に留まる） */
const RESEARCH = [
  { id:"res_game", cost:2 }, { id:"res_ai", cost:4 }, { id:"res_robot", cost:6 },
  { id:"res_duckplay", cost:3 }, { id:"res_plant", cost:2 },
  { id:"res_bottrain", cost:5 }, { id:"res_line2", cost:5 },
  { id:"res_game2", cost:8, requires:"res_game" }, { id:"res_ai2", cost:8, requires:"res_ai" },
  { id:"res_robot2", cost:8, requires:"res_robot" }, { id:"res_eff2", cost:10, requires:"res_line2" },
  { id:"res_zen", cost:6, requires:"res_plant" }, { id:"res_play2", cost:6 },
  { id:"res_bot2", cost:8, requires:"res_bottrain" }
];
/* Sprint 4: 反復研究「効率化レポート」（価格 10×1.6^Lv、生産 +2%/Lv） */
const repeatCost = lv => Math.ceil(10 * Math.pow(1.6, lv));
/* スタッフ（game と同一） */
const STAFF_ROLES = {
  prog:    { base:300, out:2.2 }, test: { base:260, out:0.5 }, carry: { base:220, out:5 },
  research:{ base:350, out:0.25 }, care: { base:240, out:1 }
};
const STAFF_CAPS = [3, 5, 7, 9, 12];
const STAFF_POLICY_MAX_LV = 6;   // 方針: 育成は Lv6 まで（ゲーム上限は Lv10）
const hireCost = (staff, role) => Math.ceil(STAFF_ROLES[role].base * Math.pow(1.35, staff.filter(s=>s.role===role).length));
const trainCost = st => Math.ceil(STAFF_ROLES[st.role].base * 0.9 * Math.pow(1.35, st.lv - 1));   /* Sprint 4: 1.45→1.35 */
const studioCost = lv => 600 * Math.pow(3, lv - 1);
function staffSums(staff){
  const s = { prog:0, progW:0, qa:0, testDP:0, ship:0, rp:0, careW:0, byRole:{} };
  for(const st of staff){
    /* Sprint 4: 熟練ボーナス（Lv5 +15% / Lv10 +30%）を game と同一に */
    const m = (1 + 0.25*(st.lv - 1)) * (st.lv >= 10 ? 1.3 : st.lv >= 5 ? 1.15 : 1);
    s.byRole[st.role] = (s.byRole[st.role]||0) + 1;
    if(st.role === "prog"){ s.prog += STAFF_ROLES.prog.out * m; s.progW += m; }
    if(st.role === "test"){ s.qa += STAFF_ROLES.test.out * m; s.testDP += 4 * m; }
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
const PLAYER = { minutesPerDay: 180, keysPerHour: 2400, cursorPxPerHour: 90000, requestMatchRate: 0.4,
                 clickSessions: [30, 90, 150], clickSessionMin: 3, clicksPerMin: 40,
                 codingFrac: 0.93,
                 fishCatchPerSession: 0.7,   // セッション中に捕まえる金の魚の期待値（匹）
                 bugCoinsPerSession: 29 };   // セッション中のバグ叩き収入の期待値（🪙）

/* 1セッションぶんのクリック生産（DP/分, 倍率適用前）。
   コンボはクリックごとに +0.10（上限 comboCapBonus）、2.5秒以内の連続で維持される前提。 */
function sessionClickDPperMin(cu, focus){
  const clicks = PLAYER.clicksPerMin * PLAYER.clickSessionMin;
  const capB = comboCapBonus(cu);
  let sum = 0;
  for(let i = 0; i < clicks; i++) sum += 1 + Math.min(capB, (i + 1) * 0.10);
  const avgMult = sum / clicks;
  const critF = 1 + critRate(cu) * 9;   // クリティカル ×10 の期待値係数
  return PLAYER.clicksPerMin * clickPower(cu, focus) * avgMult * critF;
}

function simulate(days, active){
  seed = 20261024; // プレイヤー間で乱数を揃える
  const up = {}, res = {}, cu = {};
  let staff = [], studioLv = 1;
  let coins = 0, rp = 0, dust = 0, dustTotal = 0, runDP = 0, bugStock = 0;
  /* Sprint 3: 星屑ショップの最小モデル。特典は永続し、倍率は通算獲得
     (dustTotal) で決まる。貪欲方針: 初期資金(3) → 集中ブースト(5) の順に買う */
  const perks = {};
  let reportLv = 0;             /* Sprint 4: 反復研究レベル（引っ越しでリセット） */
  let coinsEarned = 0, econ = null;   /* Sprint 4: 30日目の支出可能性の材料 */
  let wip = { code:0, tested:0, built:0 }, wip2 = { code:0, tested:0, built:0 };
  let line2 = false;
  let ideas = 0, bigStreak = 0;
  let project = { size:"TUT", total: BAL.sizes.TUT, ideaCost:0, planning:false }, projDP = 0;   // 初回はチュートリアル 120DP
  let project2 = null, proj2DP = 0;
  let totalReleasesEver = 0;
  const releasesByDay = [];
  const milestones = { firstReleaseMin: null, botDay: null, prestigeDay: null, prestigeFeasibleDay: null,
                       firstUpgradeDay: null, firstHireDay: null, line2Day: null,
                       resT1Day: null, resAllDay: null };
  /* チュートリアル導線 (research/TUTORIAL_DESIGN.md §5) との対応 — 導線の解放
     トリガーは、その段階で買う物の価格以下に置いてあり、sim の購入マイル
     ストーンより先に (または同時に) 発火する。経済定数は導線と無関係:
       Stage 1 (初リリース)      = firstReleaseMin の瞬間そのもの
       Stage 2 (研究, 累計RP>=2)  = 最初の魚 (+2RP) — 初回研究購入より前
       Stage 4 (仲間, 累計>=220)  = firstHireDay の雇用 (最安 220) と同時か前
       Stage 5 (依頼, 雇用>=1)    = firstHireDay
       Stage 6 (第2ライン研究)    = line2Day の建設より前 (研究完了の瞬間)
       Stage 7 (引っ越し gain>=5)= prestigeFeasibleDay (到達可能になった日) */
  const sizePool = ["S","S","M","M","L"];
  let snapshot7 = null;

  const dustMult = () => 1 + BAL.dustBonus * dustTotal;   /* Sprint 3: 倍率は通算獲得で決まる */
  const rates = () => {
    const ss = staffSums(staff);
    return {
      ss,
      test: BAL.stageBaseRate + 6*(up.tester||0) + ss.testDP,
      build: BAL.stageBaseRate + 5*(up.ci||0) + 4*(up.pack||0),
      ship: BAL.stageBaseRate + 6*(up.bot||0) + ss.ship,
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
  function drawProject(){
    // 所要時間ベース抽選（game の drawSizeByTime と同じ）: 実効スループットで 40分〜3時間
    const R = rates();
    const boost = Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
    const cf = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
    const prodSide = ((BAL.basePerMin + boost) * cf + R.bot + R.ss.prog) * dpMult(up) * dustMult() * firstBoost();
    const rate = Math.max(1, Math.min(prodSide, R.test, R.build, R.ship));
    const weighted = ["XS","S","S","M","M","L"];
    const ok = weighted.filter(x => { const m = BAL.sizes[x]/rate; return m >= 40 && m <= 180; });
    let size;
    if(bigStreak >= 1){ bigStreak = 0; size = ok.includes("S") ? "S" : (ok[0] || "XS"); }
    else if(ok.length) size = ok[Math.floor(rnd()*ok.length)];
    else size = ["XS","S","M","L"].reduce((a,c) => Math.abs(BAL.sizes[c]/rate-90) < Math.abs(BAL.sizes[a]/rate-90) ? c : a);
    if(bigStreak === 0 && BAL.sizes[size]/rate > 150) bigStreak = 1; else if(BAL.sizes[size]/rate <= 150) bigStreak = 0;
    return settle({ size, total: BAL.sizes[size], ideaCost: IDEA_COST[size]||0, planning: false });
  }
  function release(sz, isLine2){
    let c = BAL.coinBase[sz] * (isLine2 ? BAL.line2CoinRate : 1) * (1 + 0.10*(up.ci||0)) * dustMult();
    let r = BAL.rpBase[sz];
    if(!isLine2 && rnd() < PLAYER.requestMatchRate){ c += Math.round(c * 0.6); r += 1; }
    coins += Math.round(c); coinsEarned += Math.round(c); dayCoins += Math.round(c); rp += r; ideas += 2;
    totalReleasesEver++;
    return drawProject();
  }
  let dayCoins = 0;

  for(let day = 1; day <= days; day++){
    let dayReleases = 0;
    dayCoins = 0;
    for(let min = 0; min < PLAYER.minutesPerDay; min++){
      const R = rates(), ss = R.ss;
      const mlt = dpMult(up) * dustMult();
      const codingFrac = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*ss.careW);
      // --- 生産 ---
      const boost = Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      let raw = (BAL.basePerMin + boost) * codingFrac + R.bot + ss.prog;
      const inSession = active && PLAYER.clickSessions.some(s0 => min >= s0 && min < s0 + PLAYER.clickSessionMin);
      let clickRaw = 0;
      if(inSession){
        clickRaw = sessionClickDPperMin(cu, perks.focus);
        ideas += 0.02 * (cu.synidea||0) * PLAYER.clicksPerMin;   // ひらめき連動
        rp += 0.004 * (cu.synrp||0) * PLAYER.clicksPerMin;   // 研究メモ連動
        if(PLAYER.clickSessions.includes(min)){              // セッション開始分にイベント期待値を加算
          rp += 2 * PLAYER.fishCatchPerSession;
          const evCoins = Math.round(80 * dustMult()) * PLAYER.fishCatchPerSession + PLAYER.bugCoinsPerSession;
          coins += evCoins; coinsEarned += evCoins; dayCoins += evCoins;
        }
      }
      const fb = firstBoost();
      const resMultV = 1 + 0.02 * reportLv;   /* Sprint 4: 反復研究の生産倍率 */
      const produced = (raw - clickRaw * 0.8) * mlt * fb * resMultV;   // クリックの80%は下の直接計上側へ
      wip.code += produced; runDP += produced;
      bugStock += produced * BAL.bugPerDP;
      // 応援クリックの80%は工程をバイパスして直接進捗へ（企画中は全量が仕掛品行き）
      if(clickRaw > 0){
        if(project.planning){ const ex = clickRaw * mlt * fb * resMultV; wip.code += ex; runDP += ex; bugStock += ex * BAL.bugPerDP; }
        else { const direct = clickRaw * 0.8 * mlt * fb * resMultV; projDP += direct; runDP += direct; }
      }
      ideas += IDEA_PER_MIN + 0.3 * ss.careW;
      // 企画中: アイデアが貯まったら着工
      for(const pr of [project, project2]){
        if(pr && pr.planning && ideas >= pr.ideaCost){ ideas -= pr.ideaCost; pr.planning = false; }
      }
      if(line2){
        /* Sprint 4: 第2ライン高速化 (res_eff2 ×1.5) と反復研究も反映 */
        const produced2 = (BAL.line2BaseRate + 0.8 * ss.progW) * mlt * mlt * (res.res_eff2 ? 1.5 : 1) * resMultV;  // 出荷版の二重適用を再現
        wip2.code += produced2; runDP += produced2;
        bugStock += produced2 * BAL.bugPerDP;
      }
      // --- 工程処理（各ライン独立の工程容量。game 側と同期: 2026-10-26 飢餓修正） ---
      const bugF = bugStock > 8 ? Math.max(0.5, 1 - (bugStock - 8) * 0.02) : 1;
      const caps = { test: R.test, build: R.build, ship: R.ship };
      const used = project.planning ? { test:0, build:0, ship:0, credited:0 } : processPipe(wip, caps, bugF);
      projDP += used.credited;
      if(line2 && project2){
        const used2 = project2.planning ? { credited:0 } : processPipe(wip2, caps, bugF);
        proj2DP += used2.credited;
      }
      // --- バグ処理（QA＋みゅけのデバッグ叩き近似） ---
      bugStock = Math.max(0, bugStock - qaPerMin(up, res, ss));
      if(bugStock > 3) bugStock = Math.max(0, bugStock - Math.min(bugStock - 3, 3));
      rp += ss.rp;
      /* Sprint 4: ティア1全完了後の研究員は第二の仕事でアイデアも生む (game と同じ ×0.6) */
      if(ss.rp > 0 && RESEARCH.filter(r => !r.requires).every(r => res[r.id])) ideas += ss.rp * 0.6;
      // --- リリース判定 ---
      while(projDP >= project.total){
        projDP -= project.total;
        project = release(project.size, false);
        dayReleases++;
        if(milestones.firstReleaseMin === null) milestones.firstReleaseMin = min + 1;
      }
      if(line2 && project2){
        while(proj2DP >= project2.total){
          proj2DP -= project2.total;
          project2 = release(project2.size, true);
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
      if(RESEARCH.every(r => res[r.id]) && rp >= repeatCost(reportLv)){ rp -= repeatCost(reportLv); reportLv++; }
      /* Sprint 4: 研究の枯渇タイミングを記録（ティア1 = 前提なし研究の全完了日、
         全研究 = 反復を除く全研究の完了日） */
      if(milestones.resT1Day === null && RESEARCH.filter(r => !r.requires).every(r => res[r.id])) milestones.resT1Day = day;
      if(milestones.resAllDay === null && RESEARCH.every(r => res[r.id])) milestones.resAllDay = day;
      // --- 購入（最大4件/分） ---
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
          if(staff.length >= STAFF_CAPS[studioLv - 1] && studioLv < STAFF_CAPS.length) goals.push({ kind:"studio", c: studioCost(studioLv) });
          if(goals.length){
            goals.sort((a, b) => a.c - b.c);
            const g = goals[0];
            if(coins < g.c) return false; // 貯金中
            coins -= g.c;
            if(g.kind === "line2"){
              line2 = true; project2 = drawProject(); proj2DP = 0;
              if(milestones.line2Day === null) milestones.line2Day = day;
            } else {
              studioLv++;
            }
            return true;
          }
          // 4) 貪欲: 最安の候補を買う
          const ssNow = staffSums(staff);
          let best = null;
          const consider = (kind, key, c, extra) => { if(coins >= c && (!best || c < best.c)) best = { kind, key, c, extra }; };
          for(const def of UPGRADE_DEFS){
            const lv = up[def.id]||0;
            if(lv < def.max) consider("upgrade", def.id, cost(def, lv));
          }
          if(staff.length < STAFF_CAPS[studioLv - 1]){
            let rolePick = null, roleCost = Infinity, roleCount = Infinity;
            for(const role of Object.keys(STAFF_ROLES)){
              const n = ssNow.byRole[role]||0, c = hireCost(staff, role);
              if(n < roleCount || (n === roleCount && c < roleCost)){ rolePick = role; roleCost = c; roleCount = n; }
            }
            consider("hire", rolePick, roleCost);
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
    /* Sprint 4: その日の経済スナップショット（引っ越し判定の前に取る）。
       ご褒美価格は game の treatCost と同じ式（その日の初回購入価格） */
    econ = { dayCoins, coinsEarned, treatCost: Math.ceil(150 * (1 + coinsEarned / 25000)) };
    if(day === 7){
      const R = rates();
      const mlt = dpMult(up) * dustMult();
      const codingFrac = Math.min(0.96, PLAYER.codingFrac + 0.005*(up.chair||0) + 0.01*R.ss.careW);
      const boost = Math.min((PLAYER.keysPerHour/60)/BAL.keysPerDP + (PLAYER.cursorPxPerHour/60)/BAL.cursorPxPerDP, BAL.boostCapPerMin);
      const passivePerMin = ((BAL.basePerMin + boost) * codingFrac + R.bot + R.ss.prog) * mlt;
      const clickPerMin = sessionClickDPperMin(cu, perks.focus) * mlt;
      snapshot7 = { passivePerMin, clickPerMin, ratio: (passivePerMin + clickPerMin) / passivePerMin, staff: staff.length, studioLv };
    }
    // --- プレステージ（星屑10個ぶんで実施。5個ぶん到達日も記録） ---
    const gain = Math.floor(runDP / BAL.prestigeDPPerDust);
    if(milestones.prestigeFeasibleDay === null && gain >= 5) milestones.prestigeFeasibleDay = day;
    if(gain >= 10){
      if(milestones.prestigeDay === null) milestones.prestigeDay = day;
      dust += gain; dustTotal += gain; runDP = 0; rp = 0; bugStock = 0; ideas = 0;
      reportLv = 0;   /* Sprint 4: 反復研究もリセット対象 (game と同一) */
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
    for(const pk of [["seedmoney", 3], ["focus", 5]]){
      if(!perks[pk[0]] && dust >= pk[1]){ dust -= pk[1]; perks[pk[0]] = true; }
    }
  }
  return { milestones, releasesByDay, totalReleasesEver, dust, dustTotal, snapshot7, reportLv, econ };
}

const sum = (arr, n) => arr.slice(0, n).reduce((a,b)=>a+b, 0);
function report(label, r){
  console.log("=== " + label + " ===");
  console.log("初リリース: 初日の開始から約 " + r.milestones.firstReleaseMin + " 分");
  console.log("初アップグレード: " + (r.milestones.firstUpgradeDay ?? "なし") + " 日目");
  console.log("初雇用: " + (r.milestones.firstHireDay ?? "未達") + " 日目");
  console.log("初オートメーション（子ねこボット）: " + (r.milestones.botDay ?? "未達") + " 日目");
  console.log("第2ライン建設: " + (r.milestones.line2Day ?? "未達") + " 日目");
  console.log("リリース数: 7日目まで " + sum(r.releasesByDay, 7) + " 作品 / 30日目まで " + r.totalReleasesEver + " 作品");
  console.log("プレステージ実行可能（星屑5個ぶん）: " + (r.milestones.prestigeFeasibleDay ? r.milestones.prestigeFeasibleDay + " 日目" : "30日以内に未達"));
  console.log("プレステージ実施（星屑10個ぶん・方針）: " + (r.milestones.prestigeDay ? r.milestones.prestigeDay + " 日目" : "30日以内に未実施"));
  console.log("30日後の星屑: 通算 " + r.dustTotal + "（所持 " + r.dust + "、ショップ購入後の残り）");
  console.log("研究の枯渇: ティア1全完了 " + (r.milestones.resT1Day ? r.milestones.resT1Day + " 日目" : "30日以内に未完") +
    " / ティア2込み全研究完了 " + (r.milestones.resAllDay ? r.milestones.resAllDay + " 日目" : "30日以内に未完") +
    " / 反復研究は 30日目で Lv" + r.reportLv + "（生産 +" + (r.reportLv * 2) + "%・枯渇しない）");
  if(r.econ) console.log("30日目の支出可能性: その日のコイン収入 " + r.econ.dayCoins + "🪙 / 通算収入 " + r.econ.coinsEarned +
    "🪙 / 高級おやつ価格 " + r.econ.treatCost + "🪙 → 1日収入で約 " + Math.floor(r.econ.dayCoins / Math.max(1, r.econ.treatCost)) + " 個買える");
  const pd = r.milestones.prestigeDay;
  if(pd && r.releasesByDay.length >= pd + 2){
    console.log("回復の速さ（星屑ショップ込み）: 初回ラン2日目 " + r.releasesByDay[1] +
      " 作品 vs 引っ越し2日後（" + (pd + 2) + "日目） " + r.releasesByDay[pd + 1] + " 作品");
  }
  console.log("日別リリース: " + r.releasesByDay.join(","));
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
console.log("30日リリース比（アクティブ/パッシブ）: " + (ra7.totalReleasesEver / Math.max(1, rp7.totalReleasesEver)).toFixed(2) + " 倍");
console.log("Sprint 1 ゲート: 初リリース ≤ 約5分（両タイプ） / 30日総量アクティブ ≥ 放置×1.3 / 7日目以降は全日 ≥1 リリース");
console.log("ゲート判定: 初リリース passive=" + rp7.milestones.firstReleaseMin + "分 active=" + ra7.milestones.firstReleaseMin + "分 / 比率 " +
  (ra7.totalReleasesEver/Math.max(1,rp7.totalReleasesEver)).toFixed(2) + "倍 / 7日目以降の0リリース日 passive=" +
  rp7.releasesByDay.slice(6).filter(x=>x===0).length + " active=" + ra7.releasesByDay.slice(6).filter(x=>x===0).length);
console.log("Sprint 3: 星屑ショップ最小モデル（初期資金→集中を貪欲購入）を有効化。プレステージ到達日と引っ越し後の回復は各レポートの「回復の速さ」行を参照");
