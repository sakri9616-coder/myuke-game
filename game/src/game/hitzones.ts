/* ---------- ヒットゾーンの計算と Rust への送信 ----------
   仮想座標の記録矩形を、キャンバスの実表示 rect で CSS px（= ウィンドウ内
   論理px）に変換する。みゅけ +10px / スタッフ +8px の余白つき。HUD は DOM の
   実 rect をそのまま使う。矩形が 2px 超動いたら再送（最大 200ms に1回）。 */
let hitZonesCache = null;    /* 最後に送信したゾーン（int 化済み） */
let hitZonesLastSent = 0;
let hitZonesLastCompute = 0; /* v2.3.6(予定) A: 60fps 化で計算自体も間引く */
let hitZonesCurrent = [];    /* 最後に計算したゾーン（検証・デバッグ用） */
function computeHitZones(){
  const zones = [];
  if(!stripCv) return zones;
  const rect = stripCv.getBoundingClientRect();
  if(!rect.width || !rect.height) return zones;
  /* 並べ替え中は帯全体を掴めるようにする (ドラッグが家具の外で切れない) */
  if(layoutEdit.on){
    return [[Math.round(rect.left), Math.round(rect.top),
             Math.round(rect.width), Math.round(rect.height)]];
  }
  const sx = rect.width / stripVW, sy = rect.height / STRIP_H;
  const R = stripHitRects;
  const push = (r, pad) => {
    if(!r) return;
    zones.push([
      Math.round(rect.left + r.x * sx - pad), Math.round(rect.top + r.y * sy - pad),
      Math.round(r.w * sx + pad * 2), Math.round(r.h * sy + pad * 2)
    ]);
  };
  push(R.desk, 2);
  push(R.shelf, 4);   /* Strip Canon: 棚も「見えている物」としてクリック可能に (R12) */
  push(R.board, 4);   /* プロジェクトボードも同様 (R12: 物から管理への導線) */
  push(R.board2, 4);
  for(const pr of (R.piles || [])) push(pr, 4);   /* 可視生産: 詰まった山も押せる */
  push(R.snack, 4);   /* 2026-10-25: おやつ箱も押せる */
  push(R.research, 4); push(R.rack, 4); push(R.trophy, 4); push(R.calendar, 4);
  push(R.memo, 4); push(R.phone, 4); push(R.megaphone, 4); push(R.toolbox, 4);
  push(R.duck, 6);
  push(R.fish, 6);
  for(const br of (R.bugs || [])) push(br, 4);
  for(const sr of R.staff) push(sr, 8);
  push(R.miyuke, 10);
  push(R.bubble, 4);
  const grip = document.getElementById("strip-grip");
  if(grip && document.body.classList.contains("strip")){
    const gr = grip.getBoundingClientRect();
    if(gr.width) zones.push([Math.round(gr.left), Math.round(gr.top), Math.round(gr.width), Math.round(gr.height)]);
  }
  const layoutBtnEl = document.getElementById("strip-layout");
  if(layoutBtnEl && document.body.classList.contains("strip")){
    const lr = layoutBtnEl.getBoundingClientRect();
    if(lr.width) zones.push([Math.round(lr.left), Math.round(lr.top), Math.round(lr.width), Math.round(lr.height)]);
  }
  const W = window.innerWidth || rect.width, H = window.innerHeight || rect.height;
  return zones.map(z => {
    const x = Math.max(0, z[0]), y = Math.max(0, z[1]);
    return [x, y, Math.max(0, Math.min(z[2], W - x)), Math.max(0, Math.min(z[3], H - y))];
  }).filter(z => z[2] > 0 && z[3] > 0);
}
function hitZonesChanged(a, b){
  if(!a || !b || a.length !== b.length) return true;
  for(let i = 0; i < a.length; i++)
    for(let j = 0; j < 4; j++)
      if(Math.abs(a[i][j] - b[i][j]) > 2) return true;
  return false;
}
function publishHitZones(force){
  if(!stripCv || !document.body.classList.contains("strip")) return;
  /* 60fps で毎フレーム計算すると DOM rect 読みが無駄に走る。ゾーン計算は
     従来周期 (150ms) に間引く — 送信側は元々 200ms+変化時のみなので、
     クリック判定の追随性は従来と変わらない。force は即時計算する */
  if(!force && Date.now() - hitZonesLastCompute < 150) return;
  hitZonesLastCompute = Date.now();
  const zones = computeHitZones();
  hitZonesCurrent = zones;
  if(!zones.length) return;   /* 空ゾーンは送らない（帯が丸ごと素通しになる事故防止） */
  const T = window.__TAURI__;
  if(!T) return;   /* Tauri の無い検証環境では計算だけ（送信先が無い） */
  const now = Date.now();
  if(!force){
    if(now - hitZonesLastSent < 200) return;
    if(!hitZonesChanged(zones, hitZonesCache)) return;
  }
  hitZonesCache = zones;
  hitZonesLastSent = now;
  try{
    const inv = (T.core && T.core.invoke) ? T.core.invoke.bind(T.core) : T.invoke;
    const p = inv("set_hit_zones", { zones });
    if(p && p.catch) p.catch(function(){});
  }catch(e){}
}
window.__miyukeHitZones = function(){ return hitZonesCurrent; };
/* ストリップのクリック: みゅけ本人は反応、それ以外は応援クリック */
if(stripCv){
  stripCv.addEventListener("pointerdown", (e) => {
    const rect = stripCv.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const ux = (e.clientX - rect.left) / rect.width * stripVW;
    const uy = (e.clientY - rect.top) / rect.height * STRIP_H;
    lastInputAt = Date.now();
    noteInput();
    /* v2.4.0: 並べ替え中は家具のドラッグだけを受け付ける (通常クリックは無効) */
    if(layoutEdit.on){
      const hit = layoutHitTest(ux, uy);
      if(hit){
        layoutEdit.dragId = hit.id;
        layoutEdit.grabDX = ux - hit.cx;
        if(hit.prop) layoutEdit.dragCand = propDragCandidate(hit.id, ux, uy, ux - layoutEdit.grabDX);
        stripCv.style.cursor = "grabbing";
        try{ stripCv.setPointerCapture(e.pointerId); }catch(err){}
      }
      return;
    }
    /* Sprint 4: 金の魚・バグは帯のクリックで捕まえられる。
       応援クリックより先に判定する */
    if(fishEvent && stripFish && Math.hypot(ux - stripFish.x, uy - (STRIP_GROUND - 7)) <= 20){
      const fx = stripFish.x;
      catchFish(fx, STRIP_GROUND - 16);
      addStripFloater(fx, STRIP_GROUND - 30, "🐟 ゲット！", "#d9a41a");
      renderHeader();
      return;
    }
    if(bugEvent){
      for(let i = 0; i < bugEvent.bugs.length; i++){
        const bp = stripBugXY(bugEvent.bugs[i]);
        if(Math.hypot(ux - bp.x, uy - bp.y) <= 13){
          splatBug(i, bp.x, bp.y);
          addStripFloater(bp.x, bp.y - 12, "+6🪙", "#5aa469");
          renderHeader();
          return;
        }
      }
    }
    /* Strip Canon (R12): 作品棚のクリックで作品棚パネルを開く */
    if(stripHitRects.shelf){
      const sr = stripHitRects.shelf;
      if(ux >= sr.x && ux <= sr.x + sr.w && uy >= sr.y && uy <= sr.y + sr.h){
        openShelfPanel();
        return;
      }
    }
    /* プロジェクトボードのクリックでプロジェクトパネルを開く (R12) */
    for(const bkey of ["board", "board2"]){
      const br = stripHitRects[bkey];
      if(br && ux >= br.x && ux <= br.x + br.w && uy >= br.y && uy <= br.y + br.h){
        openProjPanel();
        return;
      }
    }
    /* 2026-10-25: おやつ箱のクリックで おやつ (旧メニューのボタンから移設) */
    if(stripHitRects.snack){
      const nr = stripHitRects.snack;
      if(ux >= nr.x && ux <= nr.x + nr.w && uy >= nr.y && uy <= nr.y + nr.h){
        giveSnack();
        return;
      }
    }
    /* F: オーバークロック・ゲージのクリックで発動（家具タブ導線より先に判定） */
    if(stripHitRects.fever){
      const fr = stripHitRects.fever;
      if(ux >= fr.x && ux <= fr.x + fr.w && uy >= fr.y && uy <= fr.y + fr.h){
        activateFever();
        return;
      }
    }
    /* Stage 3: 家具オブジェクト → 対応タブ (物から管理への導線を全タブに) */
    for(const [rkey, tab] of [["memo", stripMemoTab()], ["phone", "staff"], ["megaphone", "click"], ["toolbox", "settings"], ["research", "research"], ["rack", "factory"], ["trophy", "stats"], ["calendar", "stats"]]){
      const rr = stripHitRects[rkey];
      if(rr && ux >= rr.x && ux <= rr.x + rr.w && uy >= rr.y && uy <= rr.y + rr.h){
        openTabPanel(tab);
        return;
      }
    }
    /* 可視生産: 詰まった (赤い) 山のクリックで対策パネルを開く。
       赤くない山は素通り (応援クリック側へ落とす) */
    for(const pr of (stripHitRects.piles || [])){
      if(ux >= pr.x && ux <= pr.x + pr.w && uy >= pr.y && uy <= pr.y + pr.h){
        openBottleneckFixPanel();
        return;
      }
    }
    const mx = stripMiyukeX();
    let part = null;
    if(Math.abs(ux - mx) <= 44 && uy >= STRIP_GROUND - 82 && uy <= STRIP_GROUND + 2){
      if(uy < STRIP_GROUND - 50) part = "head";
      else if(uy > STRIP_GROUND - 24 && Math.abs(ux - mx) < 20) part = "belly";
      else part = "body";
    }
    /* v2.3.3: 散歩中のみゅけをクリックしたら、散歩を切り上げて帰らせる */
    if(part && miyukeTrip && miyukeTrip.kind === "stroll") miyukeTrip.phase = "return";
    if(part){
      const now = Date.now();
      clickTimes = clickTimes.filter(t => now - t < 2000); clickTimes.push(now);
      if(clickTimes.length >= 6){
        /* v2.4.2: 連打への文句は台詞だけにする。以前はこのクリック自体を
           握りつぶし、さらに react_annoy (2.2秒) でみゅけの作業まで止めて
           いたため、「5回ごとにクールタイムがある」ように感じた。本来の
           応援クリック (ゲームの核の操作) は絶対に落とさない・止めない */
        clickTimes = [];
        say("もう！しっぽブンブンだにゃ。ちょっと落ち着いて…");
      }
    } else {
      clickTimes = [];
    }
    const crit = cheerClick(ux, uy, part);
    addStripSpark(ux, uy, crit);
    if(!crit) addStripFloater(ux, uy - 9, "+" + (clickBaseDP() * comboMult()).toFixed(1) + "DP");
    else addStripFloater(ux, uy - 9, "CRITICAL!", "#d9534f");
    if(part && !crit){
      if(part === "head"){ S.concentration = Math.min(100, S.concentration + 2); say("ん。…悪くないにゃ"); }
      if(part === "body"){ say("カタカタの邪魔しないでにゃ〜（嬉しいけど）"); }
      if(part === "belly"){ say("そこはダメにゃ！ひっくり返る…"); setState("react_annoy", 900); }
      if(Math.random() < 0.15){ S.ideas += 1; addLog("なでられてひらめいた（アイデア+1）"); }
    } else if(!part && !crit && Math.random() < 0.3){
      say(CHEER_LINES[Math.floor(Math.random() * CHEER_LINES.length)]);
    }
    renderHeader();
  });
  /* v2.4.6: ホバー位置 (論理座標) を記録する。アクションのある家具の黄色枠に使う */
  stripCv.addEventListener("pointermove", (e) => {
    const rect = stripCv.getBoundingClientRect();
    if(!rect.width || !rect.height){ stripHover = null; return; }
    stripHover = {
      x: (e.clientX - rect.left) / rect.width * stripVW,
      y: (e.clientY - rect.top) / rect.height * STRIP_H
    };
  });
  stripCv.addEventListener("pointerleave", () => { stripHover = null; });
  /* v2.4.0: 家具ドラッグの追随と確定 (離した瞬間にセーブへ保存)。
     Phase E: 小物・機能オブジェクトは候補 (面 or 地面) を計算して下書きし、
     離した瞬間に propDrop が確定する (家具クラスタは従来どおり直接書く) */
  stripCv.addEventListener("pointermove", (e) => {
    if(!layoutEdit.on || !layoutEdit.dragId) return;
    const rect = stripCv.getBoundingClientRect();
    if(!rect.width) return;
    const ux = (e.clientX - rect.left) / rect.width * stripVW;
    const uy = (e.clientY - rect.top) / rect.height * STRIP_H;
    const it = layoutItems().find(i => i.id === layoutEdit.dragId);
    if(!it) return;
    if(it.prop){
      layoutEdit.dragCand = propDragCandidate(it.id, ux, uy, ux - layoutEdit.grabDX);
      return;
    }
    const half = it.w / 2;
    let cx = Math.max(half + 2, Math.min(stripVW - half - 2, ux - layoutEdit.grabDX));
    cx = snapCX(cx, it.id);
    if(!S.layout || typeof S.layout !== "object") S.layout = {};
    S.layout[it.id] = Math.round(cx / stripVW * 1000) / 1000;
  });
  const endLayoutDrag = () => {
    if(!layoutEdit.dragId) return;
    const it = layoutItems().find(i => i.id === layoutEdit.dragId);
    if(it && it.prop) propDrop(it.id);
    layoutEdit.dragId = null;
    layoutEdit.dragCand = null;
    stripCv.style.cursor = layoutEdit.on ? "grab" : "";
    save(); publishHitZones(true);
  };
  stripCv.addEventListener("pointerup", endLayoutDrag);
  stripCv.addEventListener("pointercancel", endLayoutDrag);
}

function render(){
  staffSumsCacheActive = true;
  try{ renderFrame(); }
  finally{ staffSumsCacheActive = false; staffSumsFrameCache = null; }
}
function renderFrame(){
  /* v2.3.6(予定) A: 60fps 化 (旧: setInterval 150ms ≒ 6.7fps で全員が
     カクカク滑って見えた)。移動・物理は元々 dt ベース、アニメは壁時計/
     walkClock ベースなので再生速度は変わらない。frame は実時間から
     150ms 単位に換算し、frame 連動の見た目の速度を従来と同一に保つ */
  const nowR = Date.now();
  const dtR = lastRenderAt ? Math.min(1000, nowR - lastRenderAt) : 0;
  frameAcc += dtR / 150;
  frame = Math.floor(frameAcc);
  /* Sprint 4: コーディング位相を実時間で進める（集中力連動） */
  if(lastRenderAt) advanceCodePhase(dtR);
  lastRenderAt = nowR;
  /* 帯ではヘッダもパネルも表示されない (display:none) ので、HUD の更新はメニュー形態だけ */
  if(document.body.classList.contains("strip")){ renderStrip(); publishHitZones(false); return; }
  renderHeader();   /* Sprint 2: HUD のカウントアップをフレーム駆動で滑らかにする */
  /* Strip Canon: フルモードにシーンは描かない（R11: 管理側はパネルのみ）。
     みゅけの世界は帯だけ。フルではヘッダとパネルの DOM 更新のみ行う */
}
/* 描画は画面のリフレッシュに合わせる (requestAnimationFrame)。setInterval(16ms) だと
   60Hz の画面で 0.4 秒ごとに1回、同じリフレッシュに2回描いて歩きがカクついていた。
   rAF が止まる環境 (隠れた窓・WebView の事情) に備え、50ms 描かれなかったら
   従来どおりタイマーからも描く (どちらで描いても時間ベースなので速度は同じ) */
function renderLoop(){
  render();
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);
setInterval(() => { if(Date.now() - lastRenderAt >= 50) render(); }, 50);

