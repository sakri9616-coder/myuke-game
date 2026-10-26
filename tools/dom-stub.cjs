/* dom-stub.cjs — miyuke-smoke.js と strip-fresh-measure.js で共有する DOM スタブ。
   従来は両ファイルの先頭にほぼ同一の makeCtx / makeEl が複製されており、
   片方だけの修正がもう片方に届かない温床だったため、ここに一本化した。
   共有版は smoke 側の上位互換（el.dispatch() と onclick を呼ぶ click() を含む）。
   fresh-measure は要素の click/dispatch を使わないため、追加メソッドは挙動を変えない。
   makeFakeDate は fresh-measure の偽時計パターンを共通化したもの。
   ゲーム本体は変更しない。 */
"use strict";

function makeCtx(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "measureText") return () => ({ width: 10 });
      if (p === "createLinearGradient" || p === "createRadialGradient")
        return () => ({ addColorStop() {} });
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
      toggle(c, force) {
        if (force === undefined) force = !this._s.has(c);
        if (force) this._s.add(c); else this._s.delete(c);
        return force;
      },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (this._listeners[t] || []).slice().forEach(fn => fn(ev || {})); },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, getAttribute() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    getBoundingClientRect() {
      return this._rect || { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 };
    },
    getContext() { if (!this._ctx) this._ctx = makeCtx(this); return this._ctx; },
    focus() {}, blur() {}, remove() {},
    click() { if (this.onclick) this.onclick({}); }
  };
  return el;
}

/* 偽時計: サンドボックスの Date を差し替えるためのもの。
   now は advance() でのみ進み、ホストの実時間には一切依存しない。
   引数つき new FakeDate(...) は通常の Date として振る舞う。 */
function makeFakeDate(startMs) {
  let now = startMs;
  class FakeDate extends Date {
    constructor(...a) { super(...(a.length ? a : [now])); }
    static now() { return now; }
  }
  return {
    FakeDate,
    advance: ms => { now += ms; },
    now: () => now
  };
}

module.exports = { makeCtx, makeEl, makeFakeDate };
