/* ---------- 描画の軽量化: 変わらないフレームは canvas に触らない (2026-10-27) ----------
   帯は画面のリフレッシュごと (60Hz、高リフレッシュの画面ではそれ以上) に描き直して
   いるが、静かな場面ではほとんどのフレームが前のフレームと 1 ピクセルも違わない。
   そこで帯の描画命令をいったん記録し、命令列 (と開始時の状態) が前フレームと完全に
   同じなら本物の canvas には何もしない。canvas が汚れなければ、合成・転送
   (GPU と OS の透明窓の合成) も走らない。違えば記録した命令をそのまま本物へ流すので、
   描かれる絵は従来と同一 (絵の作り方は変えない。描くかどうかを決めるだけ)。
   - 状態 (変換行列・プロパティ・save の積み) は JS で持ち、描く命令の直前に本物と違う値だけを送る
     (2026-10-28。下の makeStripFrameCtx を参照)
   - 中身が後から変わりうる画像 (使い回すオフスクリーン) やグラデーション等の
     オブジェクトが混じったフレームは比較せず必ず描く。比較に使えるのは
     stripStaticImages に登録された、作ったあと書き換えないスプライトだけ
   - getImageData (ホバーの縁取り) は、その時点までの命令を本物へ流してから読む
   - canvas の大きさが変わった・フォントが読み込まれた・context を失った後は必ず描く
   - Canvas API の無い環境 (smoke の DOM スタブ) では記録せず、本物をそのまま使う */
const stripStaticImages = new WeakSet<object>();
const STRIP_FRAME_DIRECT_FNS = new Set(["createLinearGradient", "createRadialGradient", "createConicGradient", "createPattern", "createImageData", "isPointInPath", "isPointInStroke", "getContextAttributes", "isContextLost", "putImageData", "drawFocusIfNeeded"]);
/* 変換行列をまとめて変える命令。JS 側で行列を計算し、本物には結果の setTransform だけを送る */
const STRIP_FRAME_MATRIX_FNS = new Set(["setTransform", "resetTransform", "translate", "scale", "rotate", "transform"]);
let stripFrame: any = null;
let stripFrameStats = { presented: 0, skipped: 0 };
function makeStripFrameCtx(real){
  if(!real || typeof CanvasRenderingContext2D === "undefined" || !(real instanceof CanvasRenderingContext2D)) return real;
  /* 2026-10-28: 状態 (変換行列・プロパティ・save の積み) は JS で持ち、本物へは
     「描く命令の直前に、本物と違っている値だけ」を送る。帯 1 フレームの命令 約1,400 件の
     半分は save/restore/setTransform/imageSmoothingEnabled の繰り返しだった。
     - save/restore は JS の中だけで済ませる (clip を含む save だけ本物の save/restore を使う)
     - 値を変えても、次に描くまでに戻せば本物には何も送らない
     - getTransform は DOMMatrix を作らない (a〜f だけの軽い写しを返す)
     描かれる絵は従来と同一 (各描画の時点で本物の状態が同じになるように送るだけ)。
     以前の 1×1 の影の canvas は無くなった。文字幅 (measureText) だけは本物の計測が要るので
     計測用の 1×1 に聞き、フォントと文字列ごとに覚える (状態が溜まらないよう時々作り直す。v2.14.1) */
  const P = CanvasRenderingContext2D.prototype;
  const props: string[] = [];
  for(const k of Object.getOwnPropertyNames(P)){
    if(k === "canvas") continue;
    const d = Object.getOwnPropertyDescriptor(P, k);
    if(d && d.get && d.set) props.push(k);
  }
  const NP = props.length;
  const propIdx: Record<string, number> = {};
  props.forEach((k, i) => { propIdx[k] = i; });
  const fr: any = {
    open: false, volatile: false, flushed: 0, prevValid: false, w: 0, h: 0,
    cur: [], prev: [], start: [], prevStart: []
  };
  stripFrame = fr;
  const invalidate = () => { fr.prevValid = false; };
  const measureCache = new Map<string, any>();
  try{ real.canvas.addEventListener("contextrestored", invalidate); }catch(e){}
  try{ if(document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", () => { invalidate(); measureCache.clear(); }); }catch(e){}
  /* 描き手から見た状態 (lv/lm/ld) と、本物に送り済みの状態 (rv/rm/rd) */
  let lv: any[] = props.map(k => real[k]), lm = [1, 0, 0, 1, 0, 0], ld: number[] = [];
  try{ const m0 = real.getTransform(); lm = [m0.a, m0.b, m0.c, m0.d, m0.e, m0.f]; }catch(e){}
  try{ if(real.getLineDash) ld = real.getLineDash().slice(); }catch(e){}
  let rv = lv.slice(), rm = lm, rd = ld;
  /* save の積み: 描き手の状態の写しと、本物の save を置いた位置 (at)・その時の本物の状態 */
  const stack: any[] = [];
  /* 文字幅の計測 */
  let meas: any = null, measAge = 0, measFont = "";
  const measure = (text) => {
    const font = lv[propIdx.font];
    const key = font + "\u0000" + text;
    let r = measureCache.get(key);
    if(r) return r;
    if(!meas || ++measAge > 2000){
      const cv = document.createElement("canvas");
      cv.width = 1; cv.height = 1;
      meas = cv.getContext("2d"); measAge = 0; measFont = "";
    }
    if(measFont !== font){ meas.font = font; measFont = font; }
    const m = meas.measureText(text);
    r = { width: m.width, actualBoundingBoxLeft: m.actualBoundingBoxLeft, actualBoundingBoxRight: m.actualBoundingBoxRight,
      actualBoundingBoxAscent: m.actualBoundingBoxAscent, actualBoundingBoxDescent: m.actualBoundingBoxDescent,
      fontBoundingBoxAscent: m.fontBoundingBoxAscent, fontBoundingBoxDescent: m.fontBoundingBoxDescent };
    if(measureCache.size > 4000) measureCache.clear();
    measureCache.set(key, r);
    return r;
  };
  const isVol = v => !!v && typeof v === "object" && !Array.isArray(v) && !stripStaticImages.has(v);
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
  /* 描く命令の直前: 本物と違っている値だけを送る (記録中は記録へ、枠の外は本物へ直接) */
  const sync = () => {
    const open = fr.open, c = fr.cur;
    for(let i = 0; i < NP; i++){
      const v = lv[i];
      if(rv[i] === v) continue;
      rv[i] = v;
      if(open){ if(isVol(v)) fr.volatile = true; c.push("=" + props[i], 1, v); }
      else real[props[i]] = v;
    }
    const m = lm;
    if(m !== rm && !(m[0] === rm[0] && m[1] === rm[1] && m[2] === rm[2] && m[3] === rm[3] && m[4] === rm[4] && m[5] === rm[5])){
      if(open) c.push("setTransform", 6, m[0], m[1], m[2], m[3], m[4], m[5]);
      else real.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    }
    rm = m;
    if(ld !== rd && !(ld.length === rd.length && ld.every((v, k) => v === rd[k]))){
      if(open) c.push("setLineDash", 1, ld.slice());
      else real.setLineDash(ld);
    }
    rd = ld;
  };
  const mul = (m, a, b, c, d, e, f) => [
    m[0] * a + m[2] * b, m[1] * a + m[3] * b,
    m[0] * c + m[2] * d, m[1] * c + m[3] * d,
    m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]
  ];
  const fin = (xs) => { for(const x of xs) if(!isFinite(x)) return false; return true; };
  const matrixOp = (k, a) => {
    const m = lm;
    let n = null;
    if(k === "setTransform"){
      if(a.length <= 1){
        const o = a[0] || {};
        n = [o.a ?? o.m11 ?? 1, o.b ?? o.m12 ?? 0, o.c ?? o.m21 ?? 0, o.d ?? o.m22 ?? 1, o.e ?? o.m41 ?? 0, o.f ?? o.m42 ?? 0].map(Number);
      } else n = [+a[0], +a[1], +a[2], +a[3], +a[4], +a[5]];
    }
    else if(k === "resetTransform") n = [1, 0, 0, 1, 0, 0];
    else if(k === "translate") n = mul(m, 1, 0, 0, 1, +a[0], +a[1]);
    else if(k === "scale") n = mul(m, +a[0], 0, 0, +a[1], 0, 0);
    else if(k === "rotate"){ const c = Math.cos(+a[0]), s = Math.sin(+a[0]); n = mul(m, c, s, -s, c, 0, 0); }
    else if(k === "transform") n = mul(m, +a[0], +a[1], +a[2], +a[3], +a[4], +a[5]);
    if(n && fin(n)) lm = n;   /* 本物と同じく、有限でない値は無視する */
    if(!fr.open) invalidate();
  };
  const doSave = () => {
    const ent: any = { v: lv.slice(), m: lm, d: ld, at: -1, clip: false, rv: null, rm: null, rd: null };
    if(fr.open){
      /* 本物の save が要るか (中で clip するか) は restore の時に決める。置き場所だけ取っておく */
      ent.at = fr.cur.length; fr.cur.push("~", 0);
      ent.rv = rv.slice(); ent.rm = rm; ent.rd = rd;
    } else {
      invalidate(); sync(); real.save();
      ent.clip = true; ent.rv = rv.slice(); ent.rm = rm; ent.rd = rd;
    }
    stack.push(ent);
  };
  const doRestore = () => {
    const ent = stack.pop();
    if(!ent) return;   /* 積みが空の restore は本物でも何もしない */
    if(ent.clip){
      /* clip を含む save は本物の save/restore で戻す (本物の状態も save の時点に戻る) */
      if(fr.open && ent.at >= 0){ fr.cur[ent.at] = "save"; fr.cur.push("restore", 0); }
      else { invalidate(); real.restore(); }
      rv = ent.rv; rm = ent.rm; rd = ent.rd;
    }
    lv = ent.v; lm = ent.m; ld = ent.d;
  };
  const play = (ops, from) => {
    let i = from;
    while(i < ops.length){
      const name = ops[i], n = ops[i + 1];
      const c0 = name.charCodeAt(0);
      if(c0 === 61){ real[name.slice(1)] = ops[i + 2]; }   /* "=prop" */
      else if(c0 === 126){}                                /* "~" 空き命令 (本物の save が要らなかった場所) */
      else switch(n){
        case 0: real[name](); break;
        case 1: real[name](ops[i + 2]); break;
        case 2: real[name](ops[i + 2], ops[i + 3]); break;
        case 3: real[name](ops[i + 2], ops[i + 3], ops[i + 4]); break;
        case 4: real[name](ops[i + 2], ops[i + 3], ops[i + 4], ops[i + 5]); break;
        case 5: real[name](ops[i + 2], ops[i + 3], ops[i + 4], ops[i + 5], ops[i + 6]); break;
        case 6: real[name](ops[i + 2], ops[i + 3], ops[i + 4], ops[i + 5], ops[i + 6], ops[i + 7]); break;
        default: real[name].apply(real, ops.slice(i + 2, i + 2 + n));
      }
      i += 2 + n;
    }
  };
  /* フレームの頭: 本物をこのフレームの開始時の (送り済みの) 状態にそろえる */
  const applyStart = () => {
    const s = fr.start;
    for(let k = 0; k < NP; k++) real[props[k]] = s[k];
    real.setTransform(s[NP], s[NP + 1], s[NP + 2], s[NP + 3], s[NP + 4], s[NP + 5]);
    if(real.setLineDash) real.setLineDash(s[NP + 6]);
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
      if(k === "getTransform") rc[k] = function(){ const m = lm; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; };
      else if(k === "getLineDash") rc[k] = function(){ return ld.slice(); };
      else if(k === "measureText") rc[k] = function(t){ return measure(String(t)); };
      else if(STRIP_FRAME_DIRECT_FNS.has(k)) rc[k] = function(){ return real[k].apply(real, arguments); };
      else if(k === "getImageData") rc[k] = function(){ if(fr.open) flush(); else sync(); return (real.getImageData as any).apply(real, arguments); };
      else if(STRIP_FRAME_MATRIX_FNS.has(k)) rc[k] = function(){ matrixOp(k, arguments); };
      else if(k === "save") rc[k] = doSave;
      else if(k === "restore") rc[k] = doRestore;
      else if(k === "setLineDash") rc[k] = function(a){
        if(!a || typeof a.length !== "number") return;
        const x = Array.prototype.slice.call(a).map(Number);
        if(!x.every(v => isFinite(v) && v >= 0)) return;   /* 本物と同じく不正な値は無視 */
        ld = x.length % 2 ? x.concat(x) : x;
        if(!fr.open) invalidate();
      };
      else if(k === "reset"){
        rc[k] = function(){
          sync();
          if(fr.open) fr.cur.push("reset", 0); else { invalidate(); real.reset(); }
          /* reset は積みも捨てる (以後の restore は本物でも空振り) */
          for(const ent of stack) if(ent.at >= 0 && !ent.clip) fr.cur[ent.at] = "~";
          stack.length = 0;
          const fresh: any = document.createElement("canvas").getContext("2d");
          lv = props.map(p => fresh[p]); lm = [1, 0, 0, 1, 0, 0]; ld = [];
          rv = lv.slice(); rm = lm; rd = ld;
        };
      }
      else {
        const isClip = k === "clip";
        rc[k] = function(){
          if(isClip && stack.length) stack[stack.length - 1].clip = true;
          sync();
          if(fr.open) rec(k, arguments);
          else { invalidate(); return real[k].apply(real, arguments); }
        };
      }
    } else if(d.get && d.set){
      const i = propIdx[k];
      Object.defineProperty(rc, k, {
        get(){ return lv[i]; },
        set(v){ lv[i] = v; if(!fr.open) invalidate(); }
      });
    }
  }
  fr.begin = () => {
    fr.open = true; fr.volatile = false; fr.flushed = 0;
    fr.cur.length = 0;
    /* 開始状態 = 本物に送り済みの状態 + 描き手から見た状態 (どちらも次の命令列を決める) */
    const s = fr.start;
    s.length = 0;
    for(let k = 0; k < NP; k++){ const v = rv[k]; if(isVol(v)) fr.volatile = true; s.push(v); }
    s.push(rm[0], rm[1], rm[2], rm[3], rm[4], rm[5], rd);
    for(let k = 0; k < NP; k++){ const v = lv[k]; if(isVol(v)) fr.volatile = true; s.push(v); }
    s.push(lm[0], lm[1], lm[2], lm[3], lm[4], lm[5], ld);
  };
  fr.end = () => {
    fr.open = false;
    /* 例外で途中終了などで save が残ったら、本物にも save を置いておく (以後の restore は本物で戻す) */
    for(const ent of stack) if(ent.at >= 0){ fr.cur[ent.at] = "save"; ent.at = -1; ent.clip = true; }
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
