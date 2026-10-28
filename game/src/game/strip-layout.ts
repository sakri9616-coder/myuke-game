/* ---------- Phase E: レイアウト自由化（layoutProps） ----------
   小物と機能オブジェクトを家具と同格の配置項目にする。保存は追加フィールド
   S.layoutProps のみ: { on: "ground", x: 帯幅比 } または { on: 面id, dx: 面中心
   からの px }。エントリが無い項目は従来のアンカーで描くので、旧セーブの
   見た目は1ピクセルも変わらない。面に載れるのは小物クラスだけ — 制約は
   機能ではなく幾何学（幅・高さ上限120・面の予約域）だけ。
   ボードと出荷スポットは地面クラスのみ（ボードは幅204で台に載らない、
   出荷は運び屋の行き先が宙に浮かないため） */
const PROP_DEFS = {
  board:     { label: "進捗ボード",   w: 204, h: 44, cls: "ground" },   /* h = STRIP_BOARD.hMain (strip-board.ts はこの後に読まれるので数値で持つ) */
  memo:      { label: "つりメモ",     w: 150, h: 16, cls: "ground" },
  phone:     { label: "電話",         w: 24,  h: 24, cls: "small" },
  toolbox:   { label: "工具箱",       w: 24,  h: 24, cls: "small" },
  megaphone: { label: "メガホン",     w: 24,  h: 24, cls: "small" },
  snack:     { label: "おやつ箱",     w: 24,  h: 24, cls: "small" },
  coffee:    { label: "コーヒー",     w: 35,  h: 35, cls: "small" },
  plant:     { label: "植木",         w: 13,  h: 16, cls: "small" },
  ship:      { label: "出荷スポット", w: 92,  h: 48, cls: "ground" },
};
function layoutSurfaces(){
  const G = STRIP_GROUND;
  const list = [
    /* 机の天板は G-33（バッチ14 校正）。中央 ±22 はノートPC＋座り場所として予約 */
    { id: "desk",     cx: stripDeskCX(),     y: G - 33, w: 128, reserved: [[-22, 22]] },
    { id: "shelf",    cx: stripShelfCX(),    y: G - 42, w: 104 },
    /* 研究机: 左の本の山と中央の開いた本が予約。植木の定位置は右の空き */
    { id: "research", cx: stripResearchCX(), y: G - 12, w: 68,  reserved: [[-30, -12], [-7, 14]], on: hasResearcher() },   /* prop_research_desk の天板 (原寸 row 16)・本の山・開いた本 */
    { id: "trophy",   cx: stripTrophyCX(),   y: G - 22, w: 30,  on: !!S.stamps.prestige1 },
  ];
  return list.filter(s => s.on !== false);
}
function propEntry(id){
  const lp = (typeof S !== "undefined") ? S.layoutProps : null;
  return (lp && lp[id] && typeof lp[id] === "object") ? lp[id] : null;
}
/* エントリが無いときの置き場 = 従来のアンカーそのもの（初期配置の不変条件） */
function propDefaultPlace(id){
  const G = STRIP_GROUND;
  switch(id){
    case "board": return { cx: stripDeskCX(), baseY: G };
    case "phone": return { cx: Math.round(propPlace("board").cx - STRIP_BOARD.w / 2) + 10, baseY: G };
    case "toolbox": return { cx: stripDeskCX() + 42, baseY: G };
    case "megaphone": return { cx: stripDeskCX() - 76, baseY: G + 1 };
    case "snack": return { cx: stripDeskCX() + 72, baseY: G };
    case "coffee": return { cx: stripDeskCX() + 47, baseY: G - 0.5 };
    case "plant": return { cx: stripResearchCX() + 22, baseY: G - 12 };
    case "ship": return { cx: Math.round(stripVW * 0.87), baseY: G };
    /* 既定ではボード左下に吊る2行の札 (並べ替えで掴む矩形がそこに重なるように) */
    case "memo": return { cx: Math.round(propPlace("board").cx - STRIP_BOARD.w / 2) + 4 + 75, baseY: STRIP_BOARD.top + STRIP_BOARD.hMain + 18 };
  }
  return { cx: stripDeskCX(), baseY: G };
}
function propPlace(id){
  if(layoutEdit.dragId === id && layoutEdit.dragCand)
    return { cx: layoutEdit.dragCand.cx, baseY: layoutEdit.dragCand.baseY, dragging: true };
  const e = propEntry(id);
  if(e){
    if(e.on === "ground" && typeof e.x === "number")
      return { cx: Math.round(e.x * stripVW), baseY: STRIP_GROUND, placed: true };
    const sf = layoutSurfaces().find(s => s.id === e.on);
    if(sf) return { cx: sf.cx + (e.dx || 0), baseY: sf.y, placed: true };
    /* 面が消えた（あり得ないが）場合は既定へ落とす */
  }
  const d = propDefaultPlace(id);
  if(layoutEdit.shakeId === id && stripNow < layoutEdit.shakeUntil)
    d.cx += Math.round(Math.sin((layoutEdit.shakeUntil - stripNow) / 28) * 2.2);
  return d;
}
/* 弱いスナップ: 他の配置項目の中心へ 4px 以内で吸着（設定で切替） */
function snapCX(cx, selfId){
  if(typeof S !== "undefined" && S.settings && S.settings.snapLayout === false) return cx;
  for(const it of layoutItems()){
    if(it.id === selfId) continue;
    if(Math.abs(cx - it.cx) <= 4) return it.cx;
  }
  return cx;
}
function propDragCandidate(id, ux, uy, centerX){
  const def = PROP_DEFS[id];
  if(def.cls === "small"){
    for(const sf of layoutSurfaces()){
      if(uy >= sf.y - def.h - 14 && uy <= sf.y + 10 && Math.abs(ux - sf.cx) <= sf.w / 2 + 8){
        if(def.w > sf.w)
          return { on: sf.id, cx: centerX, baseY: sf.y, valid: false };
        const dx = Math.max(-sf.w / 2 + def.w / 2, Math.min(sf.w / 2 - def.w / 2, Math.round(centerX - sf.cx)));
        const cxAbs = sf.cx + dx;
        const reservedHit = (sf.reserved || []).some(r => cxAbs + def.w / 2 > sf.cx + r[0] && cxAbs - def.w / 2 < sf.cx + r[1]);
        const heightOk = (STRIP_GROUND - (sf.y - def.h)) <= 120;
        return { on: sf.id, dx, cx: cxAbs, baseY: sf.y, valid: !reservedHit && heightOk };
      }
    }
  }
  let cx = Math.max(def.w / 2 + 2, Math.min(stripVW - def.w / 2 - 2, Math.round(centerX)));
  cx = snapCX(cx, id);
  return { on: "ground", x: Math.round(cx / stripVW * 1000) / 1000, cx, baseY: STRIP_GROUND, valid: true };
}
function propDrop(id){
  const cand = layoutEdit.dragCand;
  if(!cand) return;
  if(!cand.valid){
    /* 置けない場所で離した: 元の場所へ震えて戻る（エントリは書かない） */
    layoutEdit.shakeId = id; layoutEdit.shakeUntil = stripNow + 320;
    return;
  }
  if(!S.layoutProps || typeof S.layoutProps !== "object") S.layoutProps = {};
  if(cand.on === "ground") S.layoutProps[id] = { on: "ground", x: cand.x };
  else {
    S.layoutProps[id] = { on: cand.on, dx: cand.dx };
    if(!S.flags.stackedOnce){
      S.flags.stackedOnce = 1;   /* 初めての重ね置きに一度だけコメント */
      say("おっ、家具の上に置けたにゃ！ 重ね置き、いい感じだね");
    }
  }
  save();
}
function toggleReduceMotion(){
  S.settings.reduceMotion = !S.settings.reduceMotion;
  save(); renderPanel();
}
function toggleSnapLayout(){
  S.settings.snapLayout = !S.settings.snapLayout;
  save(); renderPanel();
}
/* 並べ替え中の家具アウトライン (UI 描画: 世界の絵ではないのでコード描画可) */
function drawLayoutEditOverlay(){
  if(!layoutEdit.on || !sctx) return;
  sctx.setTransform(stripScale, 0, 0, stripScale, 0, 0);
  sctx.save();
  sctx.font = "700 8px 'Hiragino Maru Gothic ProN','Hiragino Sans',sans-serif";
  sctx.textAlign = "center";
  /* Phase E: 小物をドラッグ中は、載せられる面を点線ガイドで示す */
  const dragDef = layoutEdit.dragId ? PROP_DEFS[layoutEdit.dragId] : null;
  if(dragDef && dragDef.cls === "small"){
    for(const sf of layoutSurfaces()){
      sctx.strokeStyle = "rgba(74,144,194,0.85)";
      sctx.lineWidth = 0.8;
      sctx.setLineDash([3, 2.5]);
      sctx.beginPath(); sctx.moveTo(sf.cx - sf.w / 2, sf.y - 0.5); sctx.lineTo(sf.cx + sf.w / 2, sf.y - 0.5); sctx.stroke();
      for(const r of (sf.reserved || [])){
        sctx.strokeStyle = "rgba(226,84,62,0.8)";
        sctx.beginPath(); sctx.moveTo(sf.cx + r[0], sf.y - 0.5); sctx.lineTo(sf.cx + r[1], sf.y - 0.5); sctx.stroke();
        sctx.strokeStyle = "rgba(74,144,194,0.85)";
      }
    }
    sctx.setLineDash([]);
  }
  for(const it of layoutItems()){
    const x = it.cx - it.w / 2, y = it.top;
    const active = layoutEdit.dragId === it.id;
    const invalid = active && layoutEdit.dragCand && !layoutEdit.dragCand.valid;
    sctx.strokeStyle = invalid ? "#e2543e" : (active ? "#ff9d2e" : "rgba(255,253,248,0.9)");
    sctx.fillStyle = invalid ? "rgba(226,84,62,0.20)" : (active ? "rgba(255,157,46,0.14)" : "rgba(255,253,248,0.07)");
    sctx.lineWidth = active ? 1.3 : 0.8;
    sctx.setLineDash([3.5, 2.5]);
    sctx.beginPath();
    if(sctx.roundRect) sctx.roundRect(x, y, it.w, it.h + 2, 4); else sctx.rect(x, y, it.w, it.h + 2);
    sctx.fill(); sctx.stroke();
    sctx.setLineDash([]);
    sctx.fillStyle = invalid ? "#e2543e" : (active ? "#ff9d2e" : "rgba(70,49,38,0.9)");
    sctx.fillText(it.label, it.cx, y - 2.5);
  }
  sctx.restore();
}
function hasResearcher(){ return S.staff.some(st => st.role === "research"); }
/* クラスタ足元の薄いラグ (R1/R9): 家具クラスタの下だけに敷く最淡色の帯。
   帯全幅の土帯・背景帯は禁止 (R1)。地面の表現はこれと接地影だけ */
function sRug(cx, w){
  /* 2026-10-27 第2次発注: ラグの絵 (prop_rug_3) を薄く敷く。透明度だけコード側 */
  sctx.save();
  sctx.globalAlpha = 0.14;
  sDrawNine("prop_rug_3", cx - w / 2, STRIP_GROUND - 1.5, w, 5, 4, 0);
  sctx.restore();
}
function stripResize(){
  if(!stripCv) return;
  const w = window.innerWidth || 960, h = window.innerHeight || 210;
  /* 上限 3: 225〜300% の画面でも帯の canvas が窓より小さくならない
     (2 で頭打ちにすると CSS 側で不均一に拡大されてドットがぼやけていた) */
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const pw = Math.max(320, Math.round(w * dpr)), ph = Math.max(80, Math.round(h * dpr));
  if(stripCv.width !== pw) stripCv.width = pw;
  if(stripCv.height !== ph) stripCv.height = ph;
  stripScale = stripCv.height / STRIP_H;
  stripVW = stripCv.width / stripScale;
}
window.addEventListener("resize", stripResize);
window.__miyukeOnModeChange = function(mode){
  stripResize();
  if(mode === "strip") publishHitZones(true);
  else renderPanel();
};
function sShadow(cx, cy, w){
  /* R4: 全接地物で同一様式。影の絵 (fx_shadow_3) を横に伸ばし、透明度だけコード側 */
  sctx.save();
  sctx.globalAlpha = 0.28;
  sDrawNine("fx_shadow_3", cx - w / 2, cy - 2.5, w, 5, 4, 0);
  sctx.restore();
}
/* ストリップ用スプライト描画（下端中央アンカー、flip は歩行者用）。
   帯の倍率 (stripScale) は 1.225 や 1.53 のような半端な値なので、仮想座標で丸めてから
   拡大すると、ドット1つが 2px だったり 3px だったりして、歩くたびに絵が波打っていた。
   拡大・平行移動だけの変換なら、デバイス画素の上で位置と大きさを丸めて描く
   (ホバーの縁取り drawHoverSpriteHalo と同じ方式。大きさの差は最大 0.5px) */
function sDrawSprite(name, gx, gy, scale, flip?){
  const cv = spriteCache[name];
  if(!cv) return false;
  scale = scale || 1;
  const w = cv.width * scale, h = cv.height * scale;
  sctx.imageSmoothingEnabled = false;
  const m = typeof sctx.getTransform === "function" ? sctx.getTransform() : null;
  if(m && m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0){
    const dw = Math.max(1, Math.round(w * m.a)), dh = Math.max(1, Math.round(h * m.d));
    const ddx = Math.round(gx * m.a + m.e - dw / 2), ddy = Math.round(gy * m.d + m.f) - dh;
    sctx.save();
    /* 反転しない絵は単位行列のまま描く先の位置を渡す (続けて貼る絵の間で変換行列を送り直さない) */
    if(flip){ sctx.setTransform(-1, 0, 0, 1, ddx + dw, ddy); sctx.drawImage(cv, 0, 0, dw, dh); }
    else { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(cv, ddx, ddy, dw, dh); }
    sctx.restore();
    stripSpriteLog.push({ name, flip: !!flip, x: ddx, y: ddy, w: dw, h: dh, parts: [[0, 0, cv.width, cv.height, 0, 0, dw, dh]] });
    return true;
  }
  const dx = Math.round(gx - w / 2), dy = Math.round(gy - h);
  if(flip){
    sctx.save();
    sctx.translate(dx + w, dy); sctx.scale(-1, 1);
    sctx.drawImage(cv, 0, 0, w, h);
    sctx.restore();
  } else {
    sctx.drawImage(cv, dx, dy, w, h);
  }
  return true;
}
/* 縦に伸縮して描く (上下 cap 行の枠はそのまま、中央の行だけを高さ h に合わせる)。
   中央が一様な看板の地 (prop_kanban_wide) を、原寸と違う高さのボードに使うため */
function sDrawSpriteStretchV(name, gx, gy, h, cap){
  const cv = spriteCache[name];
  if(!cv) return false;
  const m = typeof sctx.getTransform === "function" ? sctx.getTransform() : null;
  if(!m || m.b !== 0 || m.c !== 0 || h === cv.height || cv.height <= cap * 2) return sDrawSprite(name, gx, gy, 1);
  const top = gy - h, x0 = gx - cv.width / 2;
  const X = (v) => Math.round(v * m.a + m.e), Y = (v) => Math.round(v * m.d + m.f);
  const dx = X(x0), dw = X(x0 + cv.width) - dx;
  const y0 = Y(top), y1 = Y(top + cap), y2 = Y(gy - cap), y3 = Y(gy);
  sctx.save();
  sctx.imageSmoothingEnabled = false;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.drawImage(cv, 0, 0, cv.width, cap, dx, y0, dw, y1 - y0);
  sctx.drawImage(cv, 0, cap, cv.width, cv.height - cap * 2, dx, y1, dw, y2 - y1);
  sctx.drawImage(cv, 0, cv.height - cap, cv.width, cap, dx, y2, dw, y3 - y2);
  sctx.restore();
  stripSpriteLog.push({ name, flip: false, x: dx, y: y0, w: dw, h: y3 - y0, parts: [
    [0, 0, cv.width, cap, 0, 0, dw, y1 - y0], [0, cap, cv.width, cv.height - cap * 2, 0, y1 - y0, dw, y2 - y1], [0, cv.height - cap, cv.width, cap, 0, y2 - y0, dw, y3 - y2]] });
  return true;
}
/* 伸び縮みする枠の絵 (第2次発注 §2): 左上 (x, y)・大きさ (w, h) の箱に、角 kx×ky を
   原寸のまま残し、辺と中央を最近傍で引き伸ばして貼る。_9 は kx,ky とも、_3 は ky=0、
   _3v は kx=0。形も色も絵のまま (コードは切り分けて並べるだけ) */
function sDrawNine(name, x, y, w, h, kx, ky, kyb?){
  const cv = spriteCache[name];
  if(!cv) return false;
  const kb = typeof kyb === "number" ? kyb : ky;   /* 下端だけ別の幅 (支柱の足など) */
  const m = typeof sctx.getTransform === "function" ? sctx.getTransform() : null;
  const a = m ? m.a : 1, d = m ? m.d : 1, e = m ? m.e : 0, f = m ? m.f : 0;
  const X = (v) => Math.round(v * a + e), Y = (v) => Math.round(v * d + f);
  const sx = [0, kx, cv.width - kx, cv.width], sy = [0, ky, cv.height - kb, cv.height];
  const dx = [X(x), X(x + kx), X(x + w - kx), X(x + w)], dy = [Y(y), Y(y + ky), Y(y + h - kb), Y(y + h)];
  const parts = [];
  for(let j = 0; j < 3; j++) for(let i = 0; i < 3; i++){
    const sw = sx[i + 1] - sx[i], sh = sy[j + 1] - sy[j], dw = dx[i + 1] - dx[i], dh = dy[j + 1] - dy[j];
    if(sw > 0 && sh > 0 && dw > 0 && dh > 0) parts.push([sx[i], sy[j], sw, sh, dx[i] - dx[0], dy[j] - dy[0], dw, dh]);
  }
  sctx.save();
  sctx.imageSmoothingEnabled = false;
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  /* 2026-10-28: 切り分けた最大9枚を、同じ大きさなら組み上がった1枚として使い回す
     (帯 1 フレームの drawImage の約6割が枠の部品だった。影 fx_shadow_3 だけで 140 回)。
     部品は重ならないので、1枚で貼っても半透明を含めて同じ絵になる */
  const W = dx[3] - dx[0], H = dy[3] - dy[0];
  const apart = dx[0] <= dx[1] && dx[1] <= dx[2] && dx[2] <= dx[3] && dy[0] <= dy[1] && dy[1] <= dy[2] && dy[2] <= dy[3];   /* 枠より小さく描くと部品が重なる。その時は従来どおり1枚ずつ */
  const img = apart && parts.length > 1 && W > 0 && H > 0 ? nineComposite(name + ":" + kx + ":" + ky + ":" + kb + ":" + (dx[1] - dx[0]) + ":" + (dx[2] - dx[1]) + ":" + W + ":" + (dy[1] - dy[0]) + ":" + (dy[2] - dy[1]) + ":" + H, cv, parts, W, H) : null;
  if(img) sctx.drawImage(img[0], img[1], img[2], W, H, dx[0], dy[0], W, H);
  else for(const pt of parts) sctx.drawImage(cv, pt[0], pt[1], pt[2], pt[3], dx[0] + pt[4], dy[0] + pt[5], pt[6], pt[7]);
  sctx.restore();
  if(parts.length) stripSpriteLog.push({ name, flip: false, x: dx[0], y: dy[0], w: dx[3] - dx[0], h: dy[3] - dy[0], parts });
  return true;
}
/* 組み上がった枠の絵の置き場 (1枚の大きな canvas に棚詰めで並べる)。鍵は絵の名前・角の幅・各部品を貼る大きさ (これで部品の切り出しも決まる)。
   小さな canvas に組むと、ブラウザが小さい canvas だけ別の描き方 (GPU を使わない) にするため、
   引き伸ばしの最近傍の丸めが帯と1px食い違うことがあった。帯と同じ描き方になる大きさにまとめる。
   いっぱいになったら新しい1枚に替える (前の1枚は、まだ描いていない命令が使い終わるまで残る) */
const NINE_ATLAS = 1024;
let nineAtlas: { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; x: number; y: number; rowH: number } | null = null;
const nineCache = new Map<string, any[]>();
function nineComposite(key, src, parts, W, H){
  if(W > NINE_ATLAS || H > 256) return null;
  const hit = nineCache.get(key);
  if(hit) return hit;
  let A = nineAtlas;
  if(A && A.x + W > NINE_ATLAS){ A.x = 0; A.y += A.rowH + 1; A.rowH = 0; }
  if(!A || A.y + H > NINE_ATLAS){
    const cv = document.createElement("canvas");
    cv.width = NINE_ATLAS; cv.height = NINE_ATLAS;
    const g = cv.getContext("2d");
    if(!g) return null;
    g.imageSmoothingEnabled = false;
    stripStaticImages.add(cv);   /* 置いた絵は書き換えない (空きに足すだけ) ので、フレームの比較に使える */
    A = nineAtlas = { cv, g, x: 0, y: 0, rowH: 0 };
    nineCache.clear();
  }
  const ox = A.x, oy = A.y;
  for(const pt of parts) A.g.drawImage(src, pt[0], pt[1], pt[2], pt[3], ox + pt[4], oy + pt[5], pt[6], pt[7]);
  A.x += W + 1; A.rowH = Math.max(A.rowH, H);
  const r = [A.cv, ox, oy];
  nineCache.set(key, r);
  return r;
}
/* 左上 (x, y) に原寸 (または w×h に引き伸ばし) で貼る。画面の中身・札の中の小物用 */
function sDrawTL(name, x, y, w?, h?){
  const cv = spriteCache[name];
  if(!cv) return false;
  return sDrawNine(name, x, y, w || cv.width, h || cv.height, 0, 0);
}
/* 作品の色番号 (0〜7)。icon_project_* / ui_pill_*_9 / prop_shelf_box_* の番号 */
function projectColorIdx(p){ return ((p && typeof p.icon === "number" ? p.icon : 0) % 8 + 8) % 8; }
/* みゅけを描きつつ、表示矩形をヒットゾーン用に記録する */
function sDrawMiyuke(name, gx, gy, scale, flip?){
  name = catSprite(name);   /* アニメ対象（idle/snack/think/debug等）は現在フレームに差し替え */
  /* Sprint 2: 足元アンカーでスクワッシュ＆ストレッチ（帯でも音は出ないが動きは出す） */
  const bsc = bounceScale();
  let ok;
  if(bsc){
    sctx.save(); sctx.translate(gx, gy); sctx.scale(bsc.sx, bsc.sy); sctx.translate(-gx, -gy);
    ok = sDrawSprite(name, gx, gy, scale, flip);
    sctx.restore();
  } else {
    ok = sDrawSprite(name, gx, gy, scale, flip);
  }
  const sz = spriteSize(name) || [48, 40];
  const s = scale || 1;
  stripHitRects.miyuke = { x: gx - sz[0] * s / 2, y: gy - sz[1] * s, w: sz[0] * s, h: sz[1] * s };
  if(ok) stripObjArt.miyuke = { name, gx, gy, s, flip: !!flip };
  return ok;
}
/* v2.3.3: 歩行中のみゅけ（歩行時計でフレームを選び、進行方向で反転する。
   歩行フレーム原画は左向きなので右行 (dir>0) で反転する。
   ヒットゾーンは sDrawMiyuke が実位置で記録する） */
function sDrawMiyukeWalking(gx, gy){
  const frameName = animFrameAt("miyuke_walk", miyukeStrip.walkClock || 0);
  return sDrawMiyuke(frameName, gx, gy, SPRITE_SCALES.strip.miyuke, miyukeStrip.dir > 0);
}
/* 帯を横切る猫（訪問猫・配達猫・ベンダー・箱運び）: 毛柄の walk ANIMS を接地同期で描く */
function sDrawStripWalker(v, G){
  sShadow(v.x, G - 0.5, 50);
  sDrawSprite(animFrameAt("staff_" + v.coat + "_walk", v.walkClock || 0), v.x, G, SPRITE_SCALES.strip.staff48, v.dir > 0);
}
/* デスクのPC (prop_pc) */
function drawStripPC(cx, gy){ sDrawSprite("prop_pc", cx, gy, 1); }
/* Sprint 4: PCモニタの中に実プロジェクトを見せる（ダイジェティック進捗）。
   画面下部に進捗バー＋次の節目の目盛り、左上に作品アイコン色の小箱。
   prop_pc スプライト／手続き描画どちらのモニタにも重ねて描く */
/* git ログ行 (可視生産 P2): 直近コミット最大2行をモニタ面の空き帯に描く。
   新着行は右から滑り込み、古い行は沈む。コミットした事実だけが増える */
function drawStripGitLog(log, x, yTop, w){
  if(!log || !log.length) return;
  for(let i = 0; i < 2; i++){
    const e = log[log.length - 1 - i];
    if(!e) break;
    const y = yTop + i * 2.7;
    const slide = i === 0 ? Math.max(0, 7 - (Date.now() - e.at) / 45) : 0;
    /* 行の絵: 新着は明るい行 (screen_gitlog_new)、古い行は長さ4種 (幅 10/14/18/22) から
       seed と面の幅で選ぶ */
    let nm = "screen_gitlog_new";
    if(i > 0){
      let k = Math.min(3, Math.floor(e.seed * 4));
      while(k > 0 && 10 + k * 4 > w) k--;
      nm = "screen_gitlog_" + k;
    }
    sDrawTL(nm, x + slide, y);
  }
}
function drawStripPCScreen(cx, gy){
  drawStripIdeScreen(cx - 1, gy - 15, 1);   /* 高機能IDE の段 (画面の中身) */
  drawStripProgressScreen(cx - 11, gy - 25, cx - 9, gy - 15, 18);
}
/* モニタ面の共通描画: ジャンル色の小箱 (ix, iy) と進捗バー (bx, by, 幅 bw)、
   バーの上に git ログ面（幅 bw-2）を重ねる */
function drawStripProgressScreen(ix, iy, bx, by, bw){
  const p = S.project;
  if(!p) return;
  sDrawTL("icon_project_mini_" + projectColorIdx(p), ix - 0.5, iy - 0.5);
  sDrawNine("ui_minibar_track_3", bx, by, bw, 3, 2, 0);
  if(p.planning){
    if(blinkOn(12, 7)) sDrawNine("ui_minibar_fill_yellow_3", bx + 1, by, 4, 2, 1, 0);   /* 企画中は点滅 */
  } else {
    const frac = Math.max(0, Math.min(1, stripMeter("dp1", S.projectDP) / p.totalDP));
    if(frac > 0) sDrawNine("ui_minibar_fill_3", bx, by, Math.max(2, bw * frac), 2, 1, 0);
    const ft = 1 / (p.feats.length + 1);
    const nextM = ft * ((p.doneFeats || 0) + 1);
    if(nextM < 1) sDrawTL("ui_minibar_tick", bx + Math.round(bw * nextM), by);
  }
  drawStripGitLog(stripGitLog, bx, by - 5.5, bw - 2);
}
/* sakuri作画バッチ2: code アニメ再生中は prop_pc を描かない代わりに、ポーズ内の
   モニタへ同じ進捗表示を重ねる。ポーズ内モニタの画面域 (スプライト原寸 x1..20,
   y24..34) は、みゅけを (cx+6, G-2) に ×2 で描くと帯座標で (cx-40..cx-2, G-34..G-14)
   になる。バーは彼女の体 (x cx-16〜) に被らない左寄せにする */
function drawStripCodeScreen(cx, G){
  drawStripIdeScreen(cx - 20, G - 14, 2);   /* ポーズ内モニタ (原寸 20×10 を2倍) */
  drawStripProgressScreen(cx - 37, G - 31, cx - 37, G - 20, 20);
}
function drawStripZ(x, y){
  sctx.save();
  sctx.fillStyle = "#7a86a8";
  const o = (frame >> 2) % 3;
  sctx.globalAlpha = 0.85;
  sctx.font = "700 9px sans-serif"; sctx.fillText("Z", x, y - o * 2);
  sctx.font = "700 6px sans-serif"; sctx.fillText("Z", x + 7, y - 8 - o * 2);
  sctx.restore();
}
function addStripFloater(x, y, text, color?){
  /* 連打で同じ場所に重なって読めなくならないよう、出たばかりの近い文字の上に積む */
  const now = Date.now();
  const stacked = stripFloaters.filter(f => now - f.born < 350 && Math.abs(f.x - x) < 16 && Math.abs(f.y - y) < 20).length;
  stripFloaters.push({ x, y: y - Math.min(3, stacked) * 11, text, color: color || "#e8873a", born: now });
  if(stripFloaters.length > 12) stripFloaters.shift();
}
/* 浮き文字のまとめ（再設計 段階2）: 同じ key の文字が出て間もないうちは、新しく出さずに数を足して書き換える。
   秒5回の連打でも文字は約2つ/秒に収まり、1つずつの数は大きく読める */
function addStripFloaterSum(x, y, key, val, render, color?){
  const now = Date.now();
  const f = stripFloaters.find(f => f.key === key && now - f.born < 450);
  if(f){ f.val += val; f.text = render(f.val); return; }
  stripFloaters.push({ x, y, text: render(val), color: color || "#e8873a", born: now, key, val });
  if(stripFloaters.length > 12) stripFloaters.shift();
}
function addStripSpark(x, y, big?){
  stripSparks.push({ x, y, born: Date.now(), big: !!big, seed: Math.random() * Math.PI });
  if(stripSparks.length > 10) stripSparks.shift();
}
