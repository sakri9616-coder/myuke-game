/* ---------- 描画の軽量化: 変わらないフレームは canvas に触らない (2026-10-27) ----------
   帯は画面のリフレッシュごと (60Hz、高リフレッシュの画面ではそれ以上) に描き直して
   いるが、静かな場面ではほとんどのフレームが前のフレームと 1 ピクセルも違わない。
   そこで帯の描画命令をいったん記録し、命令列 (と開始時の状態) が前フレームと完全に
   同じなら本物の canvas には何もしない。canvas が汚れなければ、合成・転送
   (GPU と OS の透明窓の合成) も走らない。違えば記録した命令をそのまま本物へ流すので、
   描かれる絵は従来と同一 (絵の作り方は変えない。描くかどうかを決めるだけ)。
   - 状態の読み出し (getTransform / measureText / globalAlpha ほか) は、同じ状態変更を
     受け取る 1×1 の影の context が答える (本物と同じ規則で正規化・計測される)
   - 中身が後から変わりうる画像 (使い回すオフスクリーン) やグラデーション等の
     オブジェクトが混じったフレームは比較せず必ず描く。比較に使えるのは
     stripStaticImages に登録された、作ったあと書き換えないスプライトだけ
   - getImageData (ホバーの縁取り) は、その時点までの命令を本物へ流してから読む
   - canvas の大きさが変わった・フォントが読み込まれた・context を失った後は必ず描く
   - Canvas API の無い環境 (smoke の DOM スタブ) では記録せず、本物をそのまま使う */
const stripStaticImages = new WeakSet<object>();
const STRIP_FRAME_STATE_FNS = new Set(["save", "restore", "setTransform", "resetTransform", "translate", "scale", "rotate", "transform", "setLineDash", "reset"]);
const STRIP_FRAME_QUERY_FNS = new Set(["getTransform", "measureText", "getLineDash"]);
const STRIP_FRAME_DIRECT_FNS = new Set(["createLinearGradient", "createRadialGradient", "createConicGradient", "createPattern", "createImageData", "isPointInPath", "isPointInStroke", "getContextAttributes", "isContextLost", "putImageData", "drawFocusIfNeeded"]);
let stripFrame: any = null;
let stripFrameStats = { presented: 0, skipped: 0 };
function makeStripFrameCtx(real){
  if(!real || typeof CanvasRenderingContext2D === "undefined" || !(real instanceof CanvasRenderingContext2D)) return real;
  const shadowCv = document.createElement("canvas");
  shadowCv.width = 1; shadowCv.height = 1;
  const shadow: any = shadowCv.getContext("2d");
  const P = CanvasRenderingContext2D.prototype;
  const props = [];
  const fr: any = {
    open: false, volatile: false, flushed: 0, prevValid: false, w: 0, h: 0,
    cur: [], prev: [], start: [], prevStart: []
  };
  stripFrame = fr;
  const invalidate = () => { fr.prevValid = false; };
  try{ real.canvas.addEventListener("contextrestored", invalidate); }catch(e){}
  try{ if(document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", invalidate); }catch(e){}
  /* 記録 1 件 = [名前, 引数の数, 引数...] を平らな配列に積む。配列の引数
     (setLineDash) は写しを持つ。比較できない引数が来たらこのフレームは必ず描く */
  const rec = (name, args) => {
    const c = fr.cur;
    c.push(name, args.length);
    for(let i = 0; i < args.length; i++){
      let v = args[i];
      if(v && typeof v === "object"){
        if(Array.isArray(v)) v = v.slice();
        else if(!stripStaticImages.has(v)) fr.volatile = true;
      }
      c.push(v);
    }
  };
  const play = (ops, from) => {
    let i = from;
    while(i < ops.length){
      const name = ops[i], n = ops[i + 1];
      if(name.charCodeAt(0) === 61){ real[name.slice(1)] = ops[i + 2]; }   /* "=prop" */
      else if(n === 0) real[name]();
      else real[name].apply(real, ops.slice(i + 2, i + 2 + n));
      i += 2 + n;
    }
  };
  const applyStart = () => {
    const s = fr.start;
    for(let k = 0; k < props.length; k++) real[props[k]] = s[k];
    const j = props.length;
    real.setTransform(s[j], s[j + 1], s[j + 2], s[j + 3], s[j + 4], s[j + 5]);
    if(real.setLineDash) real.setLineDash(s.slice(j + 6));
  };
  const flush = () => {
    if(fr.flushed === 0) applyStart();
    play(fr.cur, fr.flushed);
    fr.flushed = fr.cur.length;
  };
  const same = (a, b) => {
    if(a.length !== b.length) return false;
    for(let i = 0; i < a.length; i++){
      const x = a[i], y = b[i];
      if(x === y) continue;
      if(Array.isArray(x) && Array.isArray(y) && x.length === y.length && x.every((v, k) => v === y[k])) continue;
      return false;
    }
    return true;
  };
  const rc: any = { canvas: real.canvas };
  for(const k of Object.getOwnPropertyNames(P)){
    if(k === "constructor" || k === "canvas") continue;
    const d = Object.getOwnPropertyDescriptor(P, k);
    if(typeof d.value === "function"){
      if(STRIP_FRAME_QUERY_FNS.has(k)) rc[k] = function(){ return shadow[k].apply(shadow, arguments); };
      else if(STRIP_FRAME_DIRECT_FNS.has(k)) rc[k] = function(){ return real[k].apply(real, arguments); };
      else if(k === "getImageData") rc[k] = function(){ if(fr.open) flush(); return (real.getImageData as any).apply(real, arguments); };
      else {
        const st = STRIP_FRAME_STATE_FNS.has(k);
        rc[k] = function(){
          if(st) shadow[k].apply(shadow, arguments);
          if(fr.open) rec(k, arguments);
          else { invalidate(); return real[k].apply(real, arguments); }
        };
      }
    } else if(d.get && d.set){
      props.push(k);
      const key = "=" + k;
      Object.defineProperty(rc, k, {
        get(){ return shadow[k]; },
        set(v){
          shadow[k] = v;
          if(fr.open) rec(key, [v]);
          else { invalidate(); real[k] = v; }
        }
      });
    }
  }
  fr.begin = () => {
    fr.open = true; fr.volatile = false; fr.flushed = 0;
    fr.cur.length = 0;
    const s = fr.start;
    s.length = 0;
    for(const k of props){
      const v = shadow[k];
      if(v && typeof v === "object") fr.volatile = true;
      s.push(v);
    }
    const m = shadow.getTransform();
    s.push(m.a, m.b, m.c, m.d, m.e, m.f);
    if(shadow.getLineDash) for(const v of shadow.getLineDash()) s.push(v);
  };
  fr.end = () => {
    fr.open = false;
    const cv = real.canvas;
    const dirty = fr.volatile || fr.flushed > 0 || !fr.prevValid ||
      cv.width !== fr.w || cv.height !== fr.h ||
      !same(fr.start, fr.prevStart) || !same(fr.cur, fr.prev);
    if(dirty){
      flush();
      stripFrameStats.presented++;
    } else {
      stripFrameStats.skipped++;
    }
    fr.w = cv.width; fr.h = cv.height;
    fr.prevValid = true;
    let t = fr.prev; fr.prev = fr.cur; fr.cur = t;
    t = fr.prevStart; fr.prevStart = fr.start; fr.start = t;
  };
  return rc;
}
/* 帯 1 フレーム分の描画を囲む。例外で途中終了しても、そこまでの命令は描く (従来と同じ) */
function stripFrameRun(fn){
  if(!stripFrame) return fn();
  stripFrame.begin();
  try{ return fn(); }
  finally{ stripFrame.end(); }
}
window.__miyukeDrawStats = function(){ return Object.assign({}, stripFrameStats); };
