/* strip-fresh-measure.js — 無操作の帯（新規セーブ）で初リリースまでの時間を実測する。
   smoke と同じ DOM スタブ + 偽時計 (Date 差し替え) で tick/render を1秒ずつ回す。 */
"use strict";
const fs = require("fs");
const vm = require("vm");

/* smoke と同じく tools/game-html.cjs 経由（MIYUKE_GAME_HTML で差し替え可能。既定はソースからビルド）。 */
const HTML = require("./game-html.cjs").readGameHtml();
const BLOCKS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* DOM スタブと偽時計は tools/dom-stub.cjs に共通化（smoke と同一物を使う） */
const { makeEl, makeFakeDate } = require("./dom-stub.cjs");

function trial(trialNo) {
  const fake = makeFakeDate(1761370000000); // 固定開始時刻（昼間）
  const FakeDate = fake.FakeDate;
  const byId = {};
  const el = id => {
    if (!byId[id]) {
      byId[id] = makeEl(id === "stage" || id === "strip" ? "canvas" : "div");
      if (id === "stage") byId[id]._rect = { left: 0, top: 0, width: 480, height: 380, right: 480, bottom: 380 };
      if (id === "strip") byId[id]._rect = { left: 0, top: 0, width: 1280, height: 210, right: 1280, bottom: 210 };
    }
    return byId[id];
  };
  const store = new Map();
  const sandbox = {
    console, Date: FakeDate,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k)
    },
    location: { hash: "#strip" },
    navigator: { userAgent: "miyuke-measure" },
    innerWidth: 1280, innerHeight: 210, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    confirm: () => true,
    setInterval: () => 0, clearInterval() {},
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    body: makeEl("body"),
    documentElement: makeEl("html"),
    getElementById: el,
    createElement: tag => makeEl(tag),
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}
  };
  vm.createContext(sandbox);
  for (const b of BLOCKS) vm.runInContext(b, sandbox, { filename: "game-block.js" });
  const run = src => vm.runInContext(src, sandbox);
  const strip = run("document.body.classList.contains('strip')");
  const t0 = fake.now();
  let firstAt = null;
  for (let sec = 0; sec < 1500; sec++) {
    fake.advance(1000);
    run("tick()");
    run("render()");
    if (run("S.totals.releases") >= 1) { firstAt = (fake.now() - t0) / 1000; break; }
  }
  console.log("trial " + trialNo + ": strip=" + strip + " first release at " +
    (firstAt === null ? ">1500s (NOT REACHED)" : firstAt + "s (" + (firstAt / 60).toFixed(1) + " min)"));
  return firstAt;
}

const results = [];
for (let i = 1; i <= 5; i++) results.push(trial(i));
const done = results.filter(x => x !== null);
if (done.length) {
  console.log("SUMMARY: min=" + Math.min(...done) + "s max=" + Math.max(...done) +
    "s median=" + done.sort((a, b) => a - b)[Math.floor(done.length / 2)] + "s");
}
