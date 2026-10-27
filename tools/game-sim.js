/* game-sim.js — 本物のゲームコードを偽時計で回すバランス計測（再設計 段階0の試作）。
   balance-sim.js はゲームの写しを持つため、子会社・部署・営業・IP などを模していなかった。
   ここではゲーム HTML をそのまま DOM スタブ（tools/dom-stub.cjs）で動かし、
   買い物と応援はゲームの関数を呼ぶ「プレイヤーボット」が行う。描画は回さない。
   使い方: node tools/game-sim.js [profile] [minutes] [seed]
     profile: idle | light | click5 （click5 = 秒5クリックを張り付きのあいだ続ける）
   出力: 初回 EXIT 可能（星屑3個）と高効率（20個）に届いた時刻、星屑の内訳、クリック由来の割合 */
"use strict";
const vm = require("vm");
const HTML = require("./game-html.cjs").readGameHtml();
const BLOCKS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const { makeEl, makeFakeDate } = require("./dom-stub.cjs");

/* 乱数はシード付きにする（A/B を共通乱数で比べるため） */
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const PROFILES = {
  idle:   { clicksPerSec: 0, sessionMin: 0 },
  passive:{ clicksPerSec: 0, sessionMin: 0, typing: true },                     /* balance-sim の passive: 打鍵 2400/時・カーソル 9万px/時 */
  light:  { clicksPerSec: 40 / 60, sessionMin: 3, sessionsAt: [30, 90, 150], typing: true },   /* balance-sim の active と同じ */
  click5: { clicksPerSec: 5, sessionMin: 20, typing: true }                                /* 張り付き 20分（目標像のテンポ目標） */
};

function makeGame(seed){
  const fake = makeFakeDate(1761370000000);
  const rnd = mulberry32(seed);
  const byId = {};
  const el = id => {
    if(!byId[id]){
      byId[id] = makeEl(id === "stage" || id === "strip" ? "canvas" : "div");
      if(id === "strip") byId[id]._rect = { left: 0, top: 0, width: 1280, height: 210, right: 1280, bottom: 210 };
    }
    return byId[id];
  };
  const store = new Map();
  const mathR = Object.create(Math); mathR.random = rnd;
  const sandbox = {
    console: { log(){}, warn(){}, error: console.error }, Date: fake.FakeDate, Math: mathR,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    location: { hash: "#strip" }, navigator: { userAgent: "miyuke-game-sim" },
    innerWidth: 1280, innerHeight: 210, devicePixelRatio: 1,
    addEventListener(){}, removeEventListener(){}, confirm: () => true,
    setInterval: () => 0, clearInterval(){}, setTimeout: () => 0, clearTimeout(){}, requestAnimationFrame: () => 0
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  sandbox.document = { body: makeEl("body"), documentElement: makeEl("html"), getElementById: el,
    createElement: tag => makeEl(tag), querySelector(){ return null; }, querySelectorAll(){ return []; }, addEventListener(){} };
  vm.createContext(sandbox);
  for(const b of BLOCKS) vm.runInContext(b, sandbox, { filename: "game-block.js" });
  vm.runInContext(BOT_SRC, sandbox, { filename: "bot.js" });
  return { fake, run: src => vm.runInContext(src, sandbox), sandbox };
}

/* プレイヤーボット（ゲームの文脈で動く）。研究は買えるものから、応援P は肉球とグローブの安いほう、
   コインは下の botBuy の方針で買う */
const BOT_SRC = `
var BOT = { clickDP: 0, autoDP: 0 };
function botBuy(){
  for(const r of RESEARCH_DEFS){ if(!S.research[r.id] && (!r.requires || S.research[r.requires]) && S.rp >= r.cost) buyResearch(r.id); }
  for(let i = 0; i < 20; i++){
    const paw = CLICK_DEFS[0], glove = CLICK_DEFS[1];
    const cp = clickCost(paw, S.clickUp.paw || 0), cg = clickCost(glove, S.clickUp.glove || 0);
    const pick = cp <= cg ? paw : glove, c = Math.min(cp, cg);
    if((S.cheerP || 0) < c) break;
    buyClickUp(pick.id);
  }
  /* コインの買い方は tempo-probe.js（テンポ担当スレッド）と同じ: ゲーム自身の詰まりの助言（bottleneckFix）を
     最優先し、助言の品が買えないうちはその 1/4 以下の安い物だけ先に買う。助言が無ければ最安を買う */
  const costOf = key => {
    const [kind, id] = key.split(":");
    if(kind === "up"){ const d = UPGRADE_DEFS.find(u => u.id === id); const lv = S.upgrades[id] || 0; return d && lv < d.max ? upgradeCost(d, lv) : Infinity; }
    if(kind === "hire") return S.staff.length < staffCap() ? hireCost(id) : Infinity;
    if(kind === "studio") return S.studioLv < STAFF_CAPS.length ? studioCost(S.studioLv) : Infinity;
    return Infinity;
  };
  const doBuy = key => {
    const [kind, id] = key.split(":"), before = S.coins;
    if(kind === "up") buyUpgrade(id); else if(kind === "hire") hireStaff(id); else if(kind === "studio") buyStudio();
    return S.coins < before;
  };
  for(let guard = 0; guard < 40; guard++){
    const cands = UPGRADE_DEFS.map(d => "up:" + d.id).concat(["hire:prog", "hire:test", "hire:carry"])
      .concat(S.studioLv >= 2 && !S.staff.some(x => x.role === "sales") ? ["hire:sales"] : [])
      .concat(STAFF_ROLES.cheer && !roleLocked("cheer") ? ["hire:cheer"] : [])
      .concat(S.staff.length >= staffCap() ? ["studio:"] : []);
    const fx = bottleneckFix();
    let fixKey = fx && fx.fix ? fx.fix : null;
    if(fixKey && S.staff.length >= staffCap() && fixKey.startsWith("hire:")) fixKey = "studio:";
    const fixCost = fixKey ? costOf(fixKey) : Infinity;
    let pick = null;
    if(fixKey && fixCost <= S.coins) pick = fixKey;
    else {
      let best = null, bc = Infinity;
      for(const k of cands){ const c = costOf(k); if(c < bc){ bc = c; best = k; } }
      if(best && bc <= S.coins && (fixCost === Infinity || bc <= fixCost / 4)) pick = best;
    }
    if(!pick || !doBuy(pick)) break;
  }
}
function botJumpSig(){
  let ms = 0; for(const k in S.upgrades) for(const c of MILESTONE_LVS) if((S.upgrades[k] || 0) >= c) ms++;
  for(const k in S.clickUp) for(const c of MILESTONE_LVS) if((S.clickUp[k] || 0) >= c) ms++;
  return [S.studioLv, ms, Object.keys(S.research).length, workScale(), dustTotal(), (S.subs || []).length].join(",");
}
function botClick(n){
  const before = S.runDP;
  for(let i = 0; i < n; i++){ cheerClick(640, 150); if(typeof noteInput === "function") noteInput(); }
  if(typeof fishEvent !== "undefined" && fishEvent) catchFish(640, 150);
  BOT.clickDP += S.runDP - before;
}
`;

/* 1回の通し: days 日 × minPerDay 分の常駐。日と日のあいだは PC が眠る（時計だけ進め、世界は止まる）。
   張り付きのクリックは毎日の常駐の頭 sessionMin 分（light は sessionsAt の分）。
   売却は星屑 exitAt 個に届いたら行う（0 なら売らない）。時刻はすべて「常駐した分」で数える */
function simulate(opts){
  const P = PROFILES[opts.profile];
  const days = opts.days || 1, minPerDay = opts.minPerDay || 180, exitAt = opts.exitAt || 0;
  const g = makeGame(opts.seed || 1);
  const { fake, run } = g;
  if(opts.tweak || process.env.SIM_TWEAK) run(opts.tweak || process.env.SIM_TWEAK);   /* 数値を仮に変えて測る（実験用。ゲームには残らない） */
  if(opts.policy) run("choosePolicy(" + JSON.stringify(opts.policy) + ")");
  const R = { jumps: [], profile: opts.profile, seed: opts.seed || 1, firstRelease: null, firstExit3: null, firstExit20: null,
    exits: [], zeroReleaseDays: 0, dayReleases: [], maxGapMin: 0, maxDryMin: 0, maxCoins: 0, log: [] };
  let clickAcc = 0, t = 0, lastJump = 0, lastCE = 0, dry = 0;
  let sig = run("botJumpSig()");
  for(let day = 0; day < days; day++){
    const rel0 = run("S.totals.releases");
    for(let m = 0; m < minPerDay; m++){
      const inSession = P.clicksPerSec > 0 && (P.sessionsAt ? P.sessionsAt.some(s0 => m >= s0 && m < s0 + P.sessionMin) : m < P.sessionMin);
      for(let s = 0; s < 60; s++){
        fake.advance(1000);
        if(P.typing) run("keysAcc += 40 / 60; cursorAcc += 1500 / 60;");
        run("tick()");
        if(inSession){
          clickAcc += P.clicksPerSec;
          const n = Math.floor(clickAcc); clickAcc -= n;
          if(n > 0) run("botClick(" + n + ")");
        }
        if(s % 5 === 0) run("botBuy()");
      }
      t++;
      if(R.firstRelease === null && run("S.totals.releases") >= 1) R.firstRelease = t;
      const gain = run("prestigePreview().gain");
      if(R.firstExit3 === null && gain >= 3) R.firstExit3 = t;
      if(R.firstExit20 === null && gain >= 20) R.firstExit20 = t;
      const ce = run("S.totals.coinsEarned");
      /* 入金の途切れ: コインが1枚も入らなかった分が何分続いたか（段階1: 毎秒売上の確認） */
      if(ce > lastCE){ lastCE = ce; dry = 0; } else { dry++; R.maxDryMin = Math.max(R.maxDryMin, dry); }
      R.maxCoins = Math.max(R.maxCoins, ce);
      /* 停滞: 新しい軸や節目（社格・設備の節目・研究・仕事の桁・売却）がない区間の最長 */
      const ns = run("botJumpSig()");
      if(ns !== sig){ R.jumps.push(t); if(t - lastJump > R.maxGapMin){ R.maxGapMin = t - lastJump; R.maxGapAt = [lastJump, t, sig, ns]; } sig = ns; lastJump = t; }
      if(exitAt && gain >= exitAt){
        run("doPrestigeCore('__none', '__auto', -1)");
        R.exits.push({ t, gain });
        if(opts.policy) run("choosePolicy(" + JSON.stringify(opts.policy) + ")");
      }
      if(opts.onMinute) opts.onMinute(t, run);
      if(t % 10 === 0) R.log.push({ t, day: day + 1, runDP: Math.round(run("S.runDP")), gain, coins: Math.round(run("S.coins")), rel: run("S.totals.releases"), rank: run("S.studioLv"), staff: run("S.staff.length"), dust: run("dustTotal()") });
    }
    const dr = run("S.totals.releases") - rel0;
    R.dayReleases.push(dr);
    if(day >= 6 && dr === 0) R.zeroReleaseDays++;
    fake.advance(21 * 3600 * 1000);   /* PC の電源 OFF（世界は止まる。理念書2章） */
  }
  R.maxGapMin = Math.max(R.maxGapMin, t - lastJump);
  R.clickShare = run("BOT.clickDP / Math.max(1, S.totals.lines / 1.05)");
  R.dustTotal = run("dustTotal()");
  return R;
}

/* ゲート改訂3（再設計 2026-10-27・sakuri 承認）。G5（寄せたビルドで主役）は段階4、G8（90日の天井）は段階3で本実装 */
function gates(seeds){
  const med = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  const INF = 1e9, v = x => x === null ? INF : x;
  const rows = [];
  const cl = [], pa = [];
  for(let sd = 1; sd <= seeds; sd++){
    cl.push(simulate({ profile: "click5", days: 1, minPerDay: 40, seed: sd }));
    pa.push(simulate({ profile: "passive", days: 1, minPerDay: 180, seed: sd }));
  }
  const fr = Math.max(med(cl.map(r => v(r.firstRelease))), med(pa.map(r => v(r.firstRelease))));
  rows.push(["G1", "初リリース ≤5分（両プロファイル）", fr + "分", fr <= 5]);
  const c20 = med(cl.map(r => v(r.firstExit20)));
  rows.push(["G2", "秒5クリックで星屑20個に15〜25分", c20 >= INF ? "40分で未到達" : c20 + "分", c20 >= 15 && c20 <= 25]);
  const p20 = med(pa.map(r => v(r.firstExit20)));
  rows.push(["G3", "放置だけで星屑20個に3時間以内", p20 >= INF ? "3時間で未到達" : p20 + "分", p20 <= 180]);
  const ratio = med(cl.map((r, i) => simGainAt(r, 40) / Math.max(1, simGainAt(pa[i], 40))));
  rows.push(["G4", "同じ買い方なら張り付きが速い（40分時点の星屑比 >1.0）", ratio.toFixed(2), ratio > 1]);
  rows.push(["G5", "5つの収入源のどれも、寄せたビルドで最大の収入源になれる", "段階4で実装", null]);
  /* 張り付きの停滞は、実際にクリックしている最初の20分の中だけで測る（手を離した後は放置の扱い） */
  const gapIn = (r, end) => { let last = 0, g = 0; for(const j of r.jumps){ if(j > end) break; g = Math.max(g, j - last); last = j; } return Math.max(g, end - last); };
  const gap = med(cl.map(r => gapIn(r, 20)));
  const gapP = med(pa.map(r => r.maxGapMin));
  rows.push(["G6", "停滞（軸も節目もない区間）張り付き≤5分・放置≤30分", gap + "分 / " + gapP + "分", gap <= 5 && gapP <= 30]);
  const long = simulate({ profile: "passive", days: 10, minPerDay: 180, seed: 1, exitAt: 20 });
  rows.push(["G7", "7日目以降の0リリース日 = 0（放置10日）", long.zeroReleaseDays + "日", long.zeroReleaseDays === 0]);
  rows.push(["G8", "最大値 < 1e250（放置10日の通算コイン）", long.maxCoins.toExponential(2), long.maxCoins < 1e250]);
  return { rows, cl, pa, long };
}
function simGainAt(r, t){ let g = 0; for(const l of r.log) if(l.t <= t) g = l.gain; return g; }

if(require.main === module){
  const a = process.argv.slice(2);
  const t0 = Date.now();
  if(a[0] === "gates"){
    const n = Number(a[1] || 3);
    const G = gates(n);
    console.log("== ゲート改訂3（game-sim・" + n + "シードの中央値） ==");
    for(const [id, name, val, ok] of G.rows) console.log((ok === null ? "  --  " : ok ? "  PASS " : "  FAIL ") + id + " " + name + ": " + val);
    const cs = G.cl.map(r => (r.clickShare * 100).toFixed(0) + "%").join(" / ");
    console.log("参考: 秒5クリック40分のクリック由来 DP " + cs + "、放置10日の売却 " + G.long.exits.length + " 回（初回 " + (G.long.exits[0] ? G.long.exits[0].t + "分" : "なし") + "）、通算星屑 " + G.long.dustTotal + "、入金の最長途切れ " + G.long.maxDryMin + "分");
    console.log("（実行 " + ((Date.now() - t0) / 1000).toFixed(1) + "秒）");
  } else {
    const profile = a[0] || "click5", minutes = Number(a[1] || 30), seed = Number(a[2] || 1);
    const r = simulate({ profile, days: 1, minPerDay: minutes, seed });
    const fm = x => x === null ? "未到達" : x + "分";
    console.log("profile=" + profile + " seed=" + seed + " " + minutes + "分  (実行 " + ((Date.now() - t0) / 1000).toFixed(1) + "秒)");
    console.log("  初リリース " + fm(r.firstRelease) + " / 星屑3個 " + fm(r.firstExit3) + " / 星屑20個 " + fm(r.firstExit20) + " / 最長の停滞 " + r.maxGapMin + "分" + (r.maxGapAt ? " " + JSON.stringify(r.maxGapAt) : ""));
    console.log("  クリック由来 " + (r.clickShare * 100).toFixed(0) + "%");
    for(const l of r.log) console.log("   " + JSON.stringify(l));
  }
}
module.exports = { simulate, gates };
