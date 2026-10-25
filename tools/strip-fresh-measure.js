/* strip-fresh-measure.js — 無操作の帯（新規セーブ）で初リリースまでの時間を実測する。
   smoke と同じ DOM スタブ + 偽時計 (Date 差し替え) で tick/render を1秒ずつ回す。 */
"use strict";
const fs = require("fs");
const vm = require("vm");

const HTML = fs.readFileSync("/home/hatch/workspace/miyuke-game/game/index.html", "utf8");
const BLOCKS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function makeCtx(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return () => undefined;
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
function makeEl(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    children: [], style: {}, dataset: {}, _listeners: {},
    textContent: "", innerHTML: "", value: "", className: "",
    width: 0, height: 0, offsetWidth: 100, offsetHeight: 20,
    classList: {
      _s: new Set(),
      add(...cs) { cs.forEach(c => this._s.add(c)); },
      remove(...cs) { cs.forEach(c => this._s.delete(c)); },
      toggle(c, force) { if (force === undefined) force = !this._s.has(c); if (force) this._s.add(c); else this._s.delete(c); return force; },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() { return this._rect || { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 }; },
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    focus() {}, blur() {}, remove() {}, click() {}
  };
  return el;
}

function trial(trialNo) {
  let T = 1761370000000; // 固定開始時刻（昼間）
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [T])); }
    static now() { return T; }
  }
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
  const t0 = T;
  let firstAt = null;
  for (let sec = 0; sec < 1500; sec++) {
    T += 1000;
    run("tick()");
    run("render()");
    if (run("S.totals.releases") >= 1) { firstAt = (T - t0) / 1000; break; }
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
