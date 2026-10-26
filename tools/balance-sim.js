"use strict";
/* ============================================================
   みゅけ バランスシミュレーション v2.1 (Node, 依存なし)
   共有定数（BAL 等）は game/index.html から抽出する（単一ソース。下記ローダ参照）。

   モデル概要（ゲーム実装との対応）:
   - 生産: 基本進捗(8/分)＋入力ブーストは「コーディング系の状態」のときだけ進む。
     状態マシンの遷移確率（遊び約8%＋集中力切れの休憩）から稼働率 ≈ 0.93 と置く。
     子ねこボットとプログラマ猫は状態によらず常時生産する。
   - 生産はすべて produceDP() を通る = dpMult × dustMult が掛かる。
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
   game/index.html から読み込み時に抽出する。sim 側に写しを持たないので、
   数値変更は game 側だけで済む。抽出に失敗したら sim は即座にエラーで止まる
   (古い写しで静かに回り続ける事故を防ぐ)。 */
const fs = require("fs");
const path = require("path");
const GAME_SRC = fs.readFileSync(path.join(__dirname, "..", "game", "index.html"), "utf8");
function extractLiteral(name){
  const marker = "const " + name + " =";
  const start = GAME_SRC.indexOf(marker);
  if(start < 0) throw new Error("balance-sim: game/index.html に " + marker + " が見つからない (抽出失敗)");
  let i = start + marker.length;
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
const dpMult = up => 1 + 0.05*(up.keyboard||0) + 0.08*(up.ide||0) + 0.03*(up.ci||0) + 0.04*(up.pack||0);
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
   コンボはクリックごとに +0.10（上限 comboCapBonus）、2.5秒以内の連続で維持される前提。
   F 再設計（ハイブリッド式）: 1クリックの基礎 = clickPower + 自動生産(DP/秒) × 5%。
   自動生産は倍率適用後の値（実機の autoProdEMA 相当）を渡すこと。
   なお実機の流入制限（直接20%・残りは工程キャップ）と入力バケツ（300/分）は
   40/分の人間プロファイルでは拘束しないため、この日次モデルでは抽象化する
   （拘束するのは連打ツール域のみ — それが再設計の目的） */
function sessionClickDPperMin(cu, focus, autoPostPerMin){
  const clicks = PLAYER.clicksPerMin * PLAYER.clickSessionMin;
  const capB = comboCapBonus(cu);
  let sum = 0;
  for(let i = 0; i < clicks; i++) sum += 1 + Math.min(capB, (i + 1) * 0.10);
  const avgMult = sum / clicks;
  const critF = 1 + critRate(cu) * 9;   // クリティカル ×10 の期待値係数
  const base = clickPower(cu, focus) + (autoPostPerMin || 0) / 60 * 0.05;
  return PLAYER.clicksPerMin * base * avgMult * critF;
}

function simulate(days, active, reqMode){
  seed = 20261024; // プレイヤー間で乱数を揃える
  const up = {}, res = {}, cu = {};
  let staff = [], studioLv = 1;
  let coins = 0, rp = 0, dust = 0, dustTotal = 0, runDP = 0, bugStock = 0;
  let brand = 0;   /* Wave G: ブランド力（品質出荷で蓄積・価格に複利・EXIT で清算） */
  /* Sprint 3: 星屑ショップの最小モデル。特典は永続し、倍率は通算獲得
     (dustTotal) で決まる。貪欲方針: 初期資金(3) → 集中ブースト(5) の順に買う */
  const perks = {};
  let reportLv = 0;             /* Sprint 4: 反復研究レベル（引っ越しでリセット） */
  let coinsEarned = 0, econ = null;   /* Sprint 4: 30日目の支出可能性の材料 */
  let wip = { code:0, tested:0, built:0 }, wip2 = { code:0, tested:0, built:0 };
  let line2 = false;
  let ideas = 0, bigStreak = 0, reqDone = 0, curDay = 1;   /* reqDone/curDay: Phase C の依頼比較用 */
  let project = { size:"TUT", total: BAL.sizes.TUT, ideaCost:0, planning:false }, projDP = 0;   // 初回はチュートリアル 120DP
  let project2 = null, proj2DP = 0;
  let totalReleasesEver = 0;
  const releasesByDay = [];
  const milestones = { firstReleaseMin: null, botDay: null, prestigeDay: null, prestigeFeasibleDay: null,
                       firstUpgradeDay: null, firstHireDay: null, line2Day: null,
                       resT1Day: null, resAllDay: null,
                       /* Phase B・社格到達日: Lv1 は開始時（0日目）。売却で Lv1 に戻っても
                          初回到達日は上書きしない（最高到達の記録として読む） */
                       rankDays: { 1: 0 } };
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
    let c = BAL.coinBase[sz] * (isLine2 ? BAL.line2CoinRate : 1) * (1 + 0.10*(up.ci||0)) * dustMult() * (1 + brand * 0.02);   /* Wave G: ブランド価格倍率 */
    let r = BAL.rpBase[sz];
    if(!isLine2 && reqMode === "auto"){
      /* Phase C・自動獲得: 枠は常時埋まり全リリースが依頼達成。ボーナス率は
         担当者の成長に伴うティア期待値（〜7日 +60% / 〜20日 +85% / 以後 +130%）、
         要求サイズ未満の半額を見込み ×0.9 の保守係数 */
      const rate = curDay <= 7 ? 0.6 : curDay <= 20 ? 0.85 : 1.3;
      c += Math.round(c * rate * 0.9); r += 1; reqDone++;
    }
    else if(!isLine2 && rnd() < PLAYER.requestMatchRate){ c += Math.round(c * 0.6); r += 1; reqDone++; }
    coins += Math.round(c); coinsEarned += Math.round(c); dayCoins += Math.round(c); rp += r; ideas += 2;
    totalReleasesEver++;
    /* Wave G: ブランド増減は実機どおり出荷時のバグ在庫で決まる
       （0 → +3 / 〜3 → +1 / 10〜 → −3 / その他 0。feat 全達成の +4 は未モデル） */
    { const fb2 = Math.floor(bugStock);
      brand = Math.max(0, Math.min(450, brand + (fb2 <= 0 ? 3 : fb2 <= 3 ? 1 : fb2 >= 10 ? -3 : 0))); }
    return drawProject();
  }
  let dayCoins = 0;

  for(let day = 1; day <= days; day++){
    curDay = day;
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
        clickRaw = sessionClickDPperMin(cu, perks.focus, raw * mlt);
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
      /* Wave F: フィーバー寄与の実効係数（解析節の中盤 +22.4% を全期間一律には
         せず保守化 — アクティブは発動運用込み ×1.18、パッシブは蓄熱のみ ×1.04） */
      const feverF = active ? 1.18 : 1.04;
      /* F 再設計の流入（直接20%・工程80%）: 工程ぶんは自動生産と合算して
         仕掛品へ（この sim 自身の工程キャップで堰き止められる） */
      const produced = (raw + clickRaw * 0.8) * mlt * fb * resMultV * feverF;
      wip.code += produced; runDP += produced;
      bugStock += produced * BAL.bugPerDP;
      // 応援クリックの20%だけが工程をバイパスして直接進捗へ（企画中は全量が仕掛品行き）
      if(clickRaw > 0){
        if(project.planning){ const ex = clickRaw * mlt * fb * resMultV * feverF; wip.code += ex; runDP += ex; bugStock += ex * BAL.bugPerDP; }
        else { const direct = clickRaw * 0.2 * mlt * fb * resMultV * feverF; projDP += direct; runDP += direct; }
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
      /* 帯の山を見て潰す近似: アクティブなプレイヤーは滞留を積極的に潰す
         （上限 6/分）、パッシブはたまのチラ見（上限 1/分）。ブランド帯域の
         判定はこのドレイン後の在庫で実機に倣う */
      if(bugStock > 3) bugStock = Math.max(0, bugStock - Math.min(bugStock - 3, active ? 6 : 1));
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
          if(staff.length >= Math.ceil(STAFF_CAPS[studioLv - 1] * 0.6) && studioLv < STAFF_CAPS.length) goals.push({ kind:"studio", c: studioCost(studioLv) });
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
              if(milestones.rankDays[studioLv] === undefined) milestones.rankDays[studioLv] = day;
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
      const clickPerMin = sessionClickDPperMin(cu, perks.focus, passivePerMin) * mlt;
      snapshot7 = { passivePerMin, clickPerMin, ratio: (passivePerMin + clickPerMin) / passivePerMin, staff: staff.length, studioLv };
    }
    // --- プレステージ（星屑10個ぶんで実施。5個ぶん到達日も記録） ---
    const gain = Math.floor(runDP / BAL.prestigeDPPerDust);
    if(milestones.prestigeFeasibleDay === null && gain >= 5) milestones.prestigeFeasibleDay = day;
    if(gain >= 10){
      if(milestones.prestigeDay === null) milestones.prestigeDay = day;
      dust += gain; dustTotal += gain; runDP = 0; rp = 0; bugStock = 0; ideas = 0;
      brand = 0;   /* Wave G: ブランドは EXIT で清算（承認済み仕様） */
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
  return { milestones, releasesByDay, totalReleasesEver, dust, dustTotal, snapshot7, reportLv, econ, reqDone };
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
/* ゲート定義の改訂（レビュー室【可】・2026-10-26、レーンA 集中力の件で反映）:
   旧ゲート文言は「30日総量」だが実装はリリース件数比だった不一致を直す。
   主指標＝通算コイン収入比 ≥1.3、副指標＝星屑通算比を併記、件数比は廃止せず
   報告指標として残し合格条件は「積極が放置を下回らないこと（≥1.0）」。
   初リリース ≤5分・7日目以降0リリース日 0 は不変。 */
const coinRatio = ra7.econ.coinsEarned / Math.max(1, rp7.econ.coinsEarned);
const dustRatio = ra7.dustTotal / Math.max(1, rp7.dustTotal);
const countRatio = ra7.totalReleasesEver / Math.max(1, rp7.totalReleasesEver);
console.log("30日コイン比（アクティブ/パッシブ）: " + coinRatio.toFixed(2) + " 倍 / 星屑比: " + dustRatio.toFixed(2) + " 倍 / 件数比: " + countRatio.toFixed(2) + " 倍");
console.log("Sprint 1 ゲート（改訂）: 初リリース ≤ 約5分（両タイプ） / 主指標＝通算コイン収入比 ≥1.3 かつ 件数比 ≥1.0（星屑比は併記） / 7日目以降は全日 ≥1 リリース");
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
   × ジャンル単価。注力度 = 0.5 + 1.5×(配分/100) — 配分0%でも止まらず
   （×0.5)、100%で ×2.0。ジャンル単価 = 1 + 0.1×解放順インデックス
   （app=1.0 … robot=1.7）。コイン = レート × 0.35、DP = レート × 0.2。
   ゲート: 配分を振るとグループ合計が実際に動くこと（経営判断になる） */
console.log("");
console.log("== Phase D: 子会社の配分感度（人員30・規模Lv3 の2社）==");
{
  const subCoins = (staff, lv, genreIdx, alloc) =>
    staff * (1 + 0.3 * (lv - 1)) * (0.5 + 1.5 * alloc / 100) * 0.35 * (1 + 0.1 * genreIdx);
  const A = (a) => subCoins(30, 3, 7, a);        /* robot（単価1.7） */
  const B = (a) => subCoins(30, 3, 0, a);        /* app（単価1.0） */
  const even = A(50) + B(50), toA = A(90) + B(10), toB = A(10) + B(90);
  console.log("均等 50/50: " + even.toFixed(1) + "🪙/分（A " + A(50).toFixed(1) + " + B " + B(50).toFixed(1) + "）");
  console.log("高単価へ集中 90/10: " + toA.toFixed(1) + "🪙/分（" + (toA / even >= 1 ? "+" : "") + ((toA / even - 1) * 100).toFixed(1) + "%）");
  console.log("低単価へ集中 10/90: " + toB.toFixed(1) + "🪙/分（" + ((toB / even - 1) * 100).toFixed(1) + "%）");
  console.log("感度判定: 集中で " + ((toA / even - 1) * 100).toFixed(1) + "% 増 / 逆集中で " + Math.abs((toB / even - 1) * 100).toFixed(1) + "% 減 — 配分がグループ合計を動かす（±10%超が目安）: " +
    (toA / even > 1.10 && toB / even < 0.90 ? "PASS" : "FAIL"));
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
  const srcF = fs.readFileSync("/home/hatch/workspace/miyuke-game/game/index.html", "utf8");
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
