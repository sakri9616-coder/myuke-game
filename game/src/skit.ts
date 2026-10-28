/* ---------- 小芝居ウィンドウ (v2.26.0) ----------
   帯 (owner) から "skit-play" で場面 { id, chapter, title, panels:[{pose, text, fx, ms}], coat } が届いたら、
   みゅけのドット絵とセリフで1コマずつ演じ、終わったらフェードして自分で隠れる。
   ゲームの本体は読み込まない (この窓はセーブもシミュレーションも持たない)。
   - クリック: 次のコマ / 右上の ≫: 最後まで飛ばす / ドラッグ: 窓を動かす (位置は Rust が覚える)
   - 窓はフォーカスを取らない (Rust 側で focusable(false))
   - 枠は ui_memo_9 を仮に使う (専用の窓枠の絵が届いたら名前を差し替えるだけ)。絵は貼るだけで描かない */
(function(){
  const SK_W = 240, SK_H = 160, SK_SCALE = 2;
  const SK_FRAME = "ui_memo_9", SK_FRAME_K = 4;
  const SK_GROUND = 104;
  const T = window.__TAURI__;
  const cv = document.getElementById("sk-stage") as HTMLCanvasElement;
  const textEl = document.getElementById("sk-text");
  const headEl = document.getElementById("sk-head");
  const skipEl = document.getElementById("sk-skip");
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  cv.width = SK_W * dpr; cv.height = SK_H * dpr;
  const ctx = cv.getContext("2d");
  const SPR = window.MIYUKE_SPRITES || { palette: {} };
  const ANIM = window.MIYUKE_ANIMS || {};
  const cache: Record<string, HTMLCanvasElement | null> = {};
  /* スプライトの文字列マップを、使う時に1枚ずつキャンバスへ起こす (帯の buildSprites と同じ読み方) */
  function sprite(name){
    if(name in cache) return cache[name];
    const rows = (SPR.sprites || {})[name];
    if(!rows || !rows.length || !rows[0]){ cache[name] = null; return null; }
    const c = document.createElement("canvas");
    c.width = rows[0].length; c.height = rows.length;
    const x = c.getContext("2d");
    for(let y = 0; y < rows.length; y++) for(let i = 0; i < rows[y].length; i++){
      const col = SPR.palette[rows[y][i]];
      if(col){ x.fillStyle = col; x.fillRect(i, y, 1, 1); }
    }
    cache[name] = c;
    return c;
  }
  /* アニメの経過時間からフレーム名 (ループ区間は繰り返す。導入と締めは簡略) */
  function frameAt(base, t){
    const a = ANIM[base];
    if(!a) return base;
    const total = a.durations.reduce((s, d) => s + d, 0) || 1;
    let off = t % total;
    for(let i = 0; i < a.frames.length; i++){ off -= a.durations[i] || 0; if(off < 0) return a.frames[i]; }
    return a.frames[a.frames.length - 1];
  }
  /* 下中央を (gx, gy) に合わせて貼る。flip = 左右反転 */
  function draw(name, gx, gy, scale, flip){
    const c = sprite(name);
    if(!c) return;
    const w = c.width * scale, h = c.height * scale;
    ctx.save();
    if(flip){ ctx.translate(Math.round(gx), 0); ctx.scale(-1, 1); ctx.drawImage(c, Math.round(-w / 2), Math.round(gy - h), w, h); }
    else ctx.drawImage(c, Math.round(gx - w / 2), Math.round(gy - h), w, h);
    ctx.restore();
  }
  /* 伸び縮みする枠: 角 k を残して辺と中央を最近傍で引き伸ばす (帯の sDrawNine と同じ切り方) */
  function nine(name, x, y, w, h, k, s){
    const c = sprite(name);
    if(!c) return;
    const sx = [0, k, c.width - k, c.width], sy = [0, k, c.height - k, c.height];
    const dx = [x, x + k * s, x + w - k * s, x + w], dy = [y, y + k * s, y + h - k * s, y + h];
    for(let j = 0; j < 3; j++) for(let i = 0; i < 3; i++)
      ctx.drawImage(c, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j], dx[i], dy[j], dx[i + 1] - dx[i], dy[j + 1] - dy[j]);
  }

  let cur = null;      /* { id, panels, i, at, coat, crowd } */
  let raf = 0, ending = false;
  function render(now){
    raf = 0;
    if(!cur) return;
    const p = cur.panels[cur.i];
    const t = now - cur.start;
    const pt = now - cur.at;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SK_W, SK_H);
    nine(SK_FRAME, 0, 0, SK_W, SK_H, SK_FRAME_K, SK_SCALE);
    /* 演出: 行き来するモブ (みゅけの後ろ) */
    if(p.fx === "crowd"){
      for(const m of cur.crowd){
        const span = SK_W + 60, x = ((m.x0 + m.dir * t * m.v / 1000) % span + span) % span - 30;
        draw(frameAt("staff_" + m.coat + "_walk", t), x, SK_GROUND - 6, 1, m.dir > 0);
      }
    }
    draw(frameAt("miyuke_" + p.pose, pt), 92, SK_GROUND, SK_SCALE, false);
    /* 演出: モブの猫が右から歩いてきて、となりで座る */
    if(p.fx === "walkin"){
      const walk = Math.min(1, (now - cur.walkAt) / 1600);
      const x = 260 - (260 - 172) * walk;
      if(walk < 1) draw(frameAt("staff_" + cur.coat + "_walk", t), x, SK_GROUND, 1.5, false);
      else draw("staff_" + cur.coat + "_sit", x, SK_GROUND, 1.5, false);
    }
    raf = requestAnimationFrame(render);
  }
  function showPanel(){
    const p = cur.panels[cur.i];
    textEl.textContent = p.text || "";
    cur.at = performance.now();
    if(p.fx === "walkin" && !cur.walkAt) cur.walkAt = cur.at;
    clearTimeout(cur.timer);
    cur.timer = setTimeout(next, Math.max(800, p.ms || 3000));
    if(!raf) raf = requestAnimationFrame(render);
  }
  function next(){
    if(!cur || ending) return;
    if(cur.i + 1 >= cur.panels.length){ finish(); return; }
    cur.i++;
    showPanel();
  }
  function finish(){
    if(!cur || ending) return;
    ending = true;
    clearTimeout(cur.timer);
    const id = cur.id;
    document.body.classList.remove("on");
    setTimeout(() => {
      cur = null; ending = false;
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      textEl.textContent = ""; headEl.textContent = "";
      emitMain("skit-done", { id });
      invoke("hide_skit");
    }, 380);
  }
  function play(d){
    if(!d || !Array.isArray(d.panels) || !d.panels.length) return;
    if(cur){ clearTimeout(cur.timer); }
    ending = false;
    const coats = ["kuro", "chatora", "sabatora", "hachiware", "shiro", "syamu", "hachiware_gray", "chashiro"];
    const coat = coats.includes(d.coat) ? d.coat : "shiro";
    const crowd = [0, 1, 2].map(i => ({ coat: coats[(coats.indexOf(coat) + i * 3) % coats.length], x0: 30 + i * 85, dir: i % 2 ? -1 : 1, v: 22 + i * 7 }));
    cur = { id: d.id, panels: d.panels, i: 0, start: performance.now(), at: 0, walkAt: 0, coat, crowd, timer: 0 };
    headEl.textContent = (d.chapter || "") + (d.title ? "「" + d.title + "」" : "");
    document.body.classList.add("on");
    showPanel();
  }

  function invoke(cmd, args?){
    try{ const p = T && T.core && T.core.invoke(cmd, args || {}); if(p && p.catch) p.catch(function(){}); }catch(e){}
  }
  function emitMain(ev, payload){
    try{ const p = T && T.event && T.event.emitTo && T.event.emitTo("main", ev, payload); if(p && p.catch) p.catch(function(){}); }catch(e){}
  }
  /* クリック = 次のコマ、押したまま動かす = 窓のドラッグ */
  let down = null;
  window.addEventListener("pointerdown", (e) => {
    if(e.button !== 0) return;
    down = { x: e.screenX, y: e.screenY, onSkip: e.target === skipEl, dragged: false };
  });
  window.addEventListener("pointermove", (e) => {
    if(!down || down.dragged) return;
    if(Math.abs(e.screenX - down.x) + Math.abs(e.screenY - down.y) < 5) return;
    down.dragged = true;
    try{
      const w = T && T.window && T.window.getCurrentWindow && T.window.getCurrentWindow();
      const p = w && w.startDragging();
      if(p && p.catch) p.catch(function(){});
    }catch(err){}
  });
  window.addEventListener("pointerup", () => {
    const d = down; down = null;
    if(!d || d.dragged) return;
    if(d.onSkip) finish(); else next();
  });
  window.addEventListener("contextmenu", (e) => e.preventDefault());

  if(T && T.event && T.event.listen){
    const on = (ev, fn) => { try{ const p = T.event.listen(ev, fn); if(p && p.catch) p.catch(function(){}); }catch(e){} };
    on("skit-play", (ev) => play(ev && ev.payload));
    on("skit-hello", () => emitMain("skit-ready", {}));
    emitMain("skit-ready", {});
  }
  /* 検証用フック (ブラウザで開いて絵を確かめる) */
  (window as any).__miyukeSkitPlay = play;
})();
