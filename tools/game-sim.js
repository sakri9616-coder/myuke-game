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

/* プレイヤーボット（ゲームの文脈で動く）。買い方は balance-sim の「目的型カジュアル」に寄せた最小限:
   研究は買えるものから、応援P は肉球とグローブの安いほう、コインは「詰まり工程の担当雇用・設備・社格」の最安 */
const BOT_SRC = `
var BOT = { clickDP: 0, autoDP: 0 };
function botBottleneck(){
  const r = { impl: productionRate(), test: testRate() * bugFactor(), build: buildRate(), ship: shipRate() };
  return Object.keys(r).reduce((a, k) => r[k] < r[a] ? k : a, "impl");
}
function botBuy(){
  for(const r of RESEARCH_DEFS){ if(!S.research[r.id] && (!r.requires || S.research[r.requires]) && S.rp >= r.cost) buyResearch(r.id); }
  for(let i = 0; i < 20; i++){
    const paw = CLICK_DEFS[0], glove = CLICK_DEFS[1];
    const cp = clickCost(paw, S.clickUp.paw || 0), cg = clickCost(glove, S.clickUp.glove || 0);
    const pick = cp <= cg ? paw : glove, c = Math.min(cp, cg);
    if((S.cheerP || 0) < c) break;
    buyClickUp(pick.id);
  }
  for(let i = 0; i < 50; i++){
    const bn = botBottleneck();
    const cands = [];
    const roleFor = { impl: "prog", test: "test", ship: "carry" }[bn];
    const free = S.staff.length < staffCap();
    if(free && roleFor) cands.push({ c: hireCost(roleFor), f: () => hireStaff(roleFor) });
    if(free && S.studioLv >= 2 && !S.staff.some(s => s.role === "sales")) cands.push({ c: hireCost("sales"), f: () => hireStaff("sales") });
    const eq = { impl: ["keyboard", "ide"], test: ["tester"], build: ["ci", "pack"], ship: ["bot"] }[bn].concat(["keyboard", "ide"]);
    for(const id of eq){ const d = UPGRADE_DEFS.find(u => u.id === id); const lv = S.upgrades[id] || 0; if(lv < d.max) cands.push({ c: upgradeCost(d, lv), f: () => buyUpgrade(id) }); }
    if(!free && S.studioLv < STAFF_CAPS.length) cands.push({ c: studioCost(S.studioLv), f: () => buyStudio() });
    if(!cands.length) break;
    const best = cands.reduce((a, b) => b.c < a.c ? b : a);
    if(S.coins < best.c) break;
    best.f();
  }
}
function botClick(n){
  const before = S.runDP;
  for(let i = 0; i < n; i++) cheerClick(640, 150);
  if(typeof fishEvent !== "undefined" && fishEvent) catchFish(640, 150);
  BOT.clickDP += S.runDP - before;
}
`;

function simulate(profileName, minutes, seed){
  const P = PROFILES[profileName];
  const g = makeGame(seed);
  const { fake, run } = g;
  let firstExit3 = null, firstExit20 = null, clickAcc = 0;
  const log = [];
  for(let sec = 0; sec < minutes * 60; sec++){
    fake.advance(1000);
    const before = run("S.runDP");
    if(P.typing) run("keysAcc += 40 / 60; cursorAcc += 1500 / 60;");
    run("tick()");
    const min = sec / 60;
    const inSession = P.clicksPerSec > 0 && (P.sessionsAt ? P.sessionsAt.some(s => min >= s && min < s + P.sessionMin) : min < P.sessionMin);
    if(inSession){
      clickAcc += P.clicksPerSec;
      const n = Math.floor(clickAcc); clickAcc -= n;
      if(n > 0) run("botClick(" + n + ")");
    }
    if(sec % 5 === 0) run("botBuy()");
    const gain = run("prestigePreview().gain");
    if(firstExit3 === null && gain >= 3) firstExit3 = min;
    if(firstExit20 === null && gain >= 20) firstExit20 = min;
    if(sec % 300 === 0) log.push({ min: Math.round(min), runDP: Math.round(run("S.runDP")), gain, coins: Math.round(run("S.coins")), rel: run("S.totals.releases"), rank: run("S.studioLv"), staff: run("S.staff.length") });
    void before;
  }
  const runDP = run("S.runDP"), clickDP = run("BOT.clickDP");
  return { profile: profileName, seed, minutes, firstExit3, firstExit20, runDP: Math.round(runDP), clickShare: runDP ? clickDP / runDP : 0,
    gain: run("prestigePreview().gain"), releases: run("S.totals.releases"), rank: run("S.studioLv"), log };
}

if(require.main === module){
  const profile = process.argv[2] || "click5";
  const minutes = Number(process.argv[3] || 30);
  const seed = Number(process.argv[4] || 1);
  const t0 = Date.now();
  const r = simulate(profile, minutes, seed);
  const fm = x => x === null ? "未到達" : x.toFixed(1) + "分";
  console.log("profile=" + r.profile + " seed=" + r.seed + " " + r.minutes + "分  (実行 " + ((Date.now() - t0) / 1000).toFixed(1) + "秒)");
  console.log("  星屑3個(EXIT可能): " + fm(r.firstExit3) + " / 星屑20個(高効率): " + fm(r.firstExit20));
  console.log("  終了時: runDP " + r.runDP + " / 星屑 " + r.gain + " / リリース " + r.releases + " / 社格Lv " + r.rank + " / クリック由来 " + (r.clickShare * 100).toFixed(0) + "%");
  for(const l of r.log) console.log("   " + JSON.stringify(l));
}
module.exports = { simulate };
