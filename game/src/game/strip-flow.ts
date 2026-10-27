/* ---------- 可視生産フロー: 供給と発火 ----------
   tick から毎秒、実フローの増分だけを受ける薄い層。量子を超えた分だけ
   移動アニメを発火し、残りはアキュムレータに残す (保存則が壊れない) */
function flowFeedTick(d1, d2, u1, u2){
  if(IS_VIEWER) return;   /* viewer はシミュレーションも演出供給も持たない */
  flowTierTick();
  flowStaggerN = 0;
  const q = flowQuantum();
  /* コード生成: 企画中のラインは「企画フェーズ」なのでカードは流さない
     (§1.4 — 企画中はアイデアのモートが担当する)。バッファ自体は正直に溜まる */
  let codeFeed = 0;
  if(!(S.project && S.project.planning)) codeFeed += Math.max(0, d1);
  if(!(S.line2.project && S.line2.project.planning)) codeFeed += Math.max(0, d2);
  flowFeedStage("code", codeFeed, q);
  flowFeedStage("test", Math.max(0, (u1.test || 0) + (u2.test || 0)), q);
  flowFeedStage("build", Math.max(0, (u1.build || 0) + (u2.build || 0)), q);
  flowFeedStage("ship", Math.max(0, (u1.ship || 0) + (u2.ship || 0)), q);
}
function flowFeedStage(stage, amount, q){
  if(amount <= 0) return;
  flowFed[stage] += amount;
  flowAcc[stage] += amount;
  let budget = 2;   /* 1 tick の発火は工程ごとに最大2個 (在空上限と合わせる) */
  while(budget-- > 0 && flowAcc[stage] >= q){
    if(stripFlow.length >= 10) break;         /* 同時移動 ≤10 (ハードキャップ) */
    /* 束ね: 端数が大きい時は1枚の意味量を増やす (本数を増やさない原則 §3.2) */
    let b = 1;
    while(b < 8 && flowAcc[stage] >= q * b * 4) b *= 2;
    if(!fireFlowItem(stage, b)) break;
    flowAcc[stage] -= q * b;
    flowFiredDP[stage] += q * b;
  }
}
function fireFlowItem(stage, bundle){
  const G = STRIP_GROUND, cx = stripDeskCX();
  const delay = (flowStaggerN++) * 0.15;
  const jx = (Math.random() - 0.5) * 6;
  if(stage === "code"){
    stripFlow.push({ kind: "card", bundle, tick: false, seed: Math.random(),
      x0: cx - 18, y0: G - 18, x1: stripQAX() + jx, y1: G - 7, age: -delay, dur: 0.55, arc: 7 });
    return true;
  }
  if(stage === "test"){
    stripFlow.push({ kind: "card", bundle, tick: true, seed: Math.random(),
      x0: stripQAX(), y0: G - 9, x1: stripBuildX() + jx, y1: G - 7, age: -delay, dur: 0.6, arc: 7 });
    return true;
  }
  if(stage === "build"){
    stripFlow.push({ kind: "morph", bundle, seed: Math.random(),
      x0: stripBuildX(), y0: G - 9, x1: stripShipX() + jx, y1: G - 8, age: -delay, dur: 0.85, arc: 9 });
    return true;
  }
  /* ship: まず運搬係の日常運搬として発火を試みる。空きがなければ
     箱がそのまま右端へ滑り出る (出荷された事実の最小表現) */
  if(tryDispatchShipCarrier()) return true;
  stripFlow.push({ kind: "slide", bundle,
    x0: stripShipX(), y0: G - 8, x1: stripVW + 24, y1: G - 8,
    age: -delay, dur: Math.max(0.5, (stripVW + 24 - stripShipX()) / 115), arc: 0 });
  return true;
}
/* 日常の出荷運搬: D に箱がある前提で、運搬役優先・最寄り次点、同時最大2、
   ディスパッチ間隔 1.5 秒。リリース運搬 (carryKind "release") とは区別する */
function tryDispatchShipCarrier(){
  if(stripNow - lastShipDispatchAt < 1500) return false;
  let carrying = 0;
  for(const id in stripWalkers) if(stripWalkers[id].carrying) carrying++;
  if(carrying >= 2) return false;
  let rolePick = null, nearPick = null, nearD = Infinity;
  for(const st of S.staff){
    const wk = stripWalkers[st.id];
    if(!wk || wk.carrying) continue;
    if(wk.chatUntil && stripNow < wk.chatUntil) continue;
    if(st.role === "carry" && !rolePick) rolePick = wk;
    const d = Math.abs(wk.x - stripShipX());
    if(d < nearD){ nearD = d; nearPick = wk; }
  }
  const pick = rolePick || nearPick;
  if(!pick) return false;
  pick.carrying = true; pick.carryKind = "ship"; pick.sitting = false;
  lastShipDispatchAt = stripNow;
  return true;
}
/* feat 完成: 付箋が机からボードの DONE 側 (下枠のピン留め位置) へ飛ぶ */
function spawnFeatNote(line){
  if(IS_VIEWER || stripFlow.length >= 10) return;
  const G = STRIP_GROUND;
  const small = line === 2;
  const p = small ? S.line2.project : S.project;
  if(!p) return;
  const bcx = small ? stripDesk2CX() : stripDeskCX();
  const bw = small ? STRIP_BOARD.w2 : STRIP_BOARD.w;
  const bx = Math.round(bcx - bw / 2);
  const slot = Math.max(0, (p.doneFeats || 1) - 1);
  /* 着地点: 小型ボードは上枠の付箋列、リーダーボードは進捗バー上のその機能の節目 */
  let tx1 = bx + 20.5 + slot * 6.5, ty1 = STRIP_BOARD.top + 5;
  if(!small && p.feats && p.feats.length){
    const bar = mainBoardBar(bx);
    tx1 = bar.x + Math.round(bar.w * (slot + 1) / (p.feats.length + 1)) - 2.5;
    ty1 = bar.y - 1;
  }
  stripFlow.push({ kind: "note", line, ni: slot % 4,
    x0: bcx + 4, y0: G - 32,
    x1: tx1, y1: ty1,
    age: 0, dur: 0.6, arc: 24 });
}
/* リリース時だけのコイン噴水: 棚の新箱から湧いて右下 HUD 方向へ吸い込まれる。
   日常の出荷では絶対に呼ばない (コインは実際に付与された時だけ — 正直さ) */
function spawnStripCoinFountain(coins){
  if(IS_VIEWER) return;
  const budget = Math.max(0, 140 - particleTotal());
  const n = Math.max(0, Math.min(Math.round(6 + (coins || 0) / 40), 28, budget));
  const boxes = stripShelfBoxes();
  const src = boxes.length ? boxes[0] : { x: stripShelfCX(), yb: STRIP_GROUND - 30 };
  for(let i = 0; i < n; i++){
    const a = Math.random();
    stripCoins.push({
      x: src.x + (Math.random() - 0.5) * 8, y: src.yb - 6,
      vx: 26 + a * 46, vy: -(58 + Math.random() * 46),
      born: Date.now(), delay: i * 45, seed: Math.random()
    });
  }
  if(stripCoins.length > 28) stripCoins.splice(0, stripCoins.length - 28);
}

function stripUpdate(dt){
  const cx = stripDeskCX();
  if(miyukeStrip.x < 0){ miyukeStrip.x = cx; miyukeStrip.targetX = cx; }
  /* v2.3.3: 歩行アートがある時だけ旅程レイヤーが targetX を握る。
     旅程が無い間の目標決定は従来どおり（ゲート OFF では完全に同一の挙動） */
  const walkOn = hasWalkArt();
  if(walkOn) walkTripUpdate(dt);
  if(!miyukeTrip){
    const desk = stripIsDeskState();
    if(desk){
      miyukeStrip.targetX = cx;
    } else if(catState === "eat" || catState === "celebrate" || catState.startsWith("react")){
      /* v2.3.6(予定) B: 確定した活動 (おやつ/お祝い/クリック反応) は
         その場で行う。活動中のふらふら移動が「ポーズのまま滑る」温床だった */
      miyukeStrip.targetX = miyukeStrip.x;
    } else {
      /* 一人遊び: 目的地まで歩き (移動中は歩行フレーム)、着いたらその場で
         遊ぶ (状態ポーズ)。旧仕様は到着と同時に次の目的地を引いたため
         遊びポーズのまま常時滑っていた — 到着で滞留 (6-13s) を張る */
      if(!miyukeStrip.nextPick) miyukeStrip.nextPick = stripNow + 6000 + Math.random() * 7000;
      if(!miyukeStrip.moving && stripNow > miyukeStrip.nextPick){
        let lo, hi;
        if(catState === "zoomies"){ lo = 52; hi = stripVW - 52; }
        else { lo = Math.min(cx + 100, stripVW - 120); hi = stripVW - 56; }
        miyukeStrip.targetX = hi > lo ? lo + Math.random() * (hi - lo) : hi;
        miyukeStrip.nextPick = stripNow + 6000 + Math.random() * 7000;
      }
    }
  }
  const speed = miyukeTrip ? miyukeTrip.speed : (catState === "zoomies" ? 55 : 16);
  const dx = miyukeStrip.targetX - miyukeStrip.x;
  if(Math.abs(dx) > 1){
    const stepLen = Math.min(Math.abs(dx), speed * dt);
    miyukeStrip.x += Math.sign(dx) * stepLen;
    miyukeStrip.moving = true; miyukeStrip.dir = dx > 0 ? 1 : -1;
    /* 歩行時計: 実際に動いた距離ぶんだけ位相を進める (接地同期) */
    if(walkOn) miyukeStrip.walkClock += walkAdvanceMs("miyuke_walk", stepLen);
  } else {
    if(miyukeStrip.moving) miyukeStrip.nextPick = stripNow + 6000 + Math.random() * 7000;   /* 到着: その場で遊ぶ滞留 */
    miyukeStrip.moving = false;
  }
  /* スタッフのウォーカー同期と移動 */
  const seen = {};
  for(const st of S.staff){
    seen[st.id] = true;
    let wk = stripWalkers[st.id];
    if(!wk){
      wk = stripWalkers[st.id] = {
        x: st.role === "research" ? stripResearchCX() : 40 + Math.random() * Math.max(40, stripVW - 80),
        dir: Math.random() < 0.5 ? -1 : 1,
        speed: 5 + Math.random() * 4, sitting: false, until: 0, carrying: false, carryKind: null,
        walkClock: 0, sitStart: 0, backing: false, backStart: 0, pendingSitMs: 0
      };
    }
    if(wk.chatUntil && stripNow < wk.chatUntil){
      /* Sprint 3: 雑談中は立ち止まる（アンビエント） */
    } else if(wk.carrying){
      wk.backing = false;
      if(wk.carryKind === "memo"){
        /* Phase C: 営業が取ってきた依頼のメモを机まで運ぶ（届けたら ✦） */
        const tx = stripDeskCX();
        const dx = tx - wk.x;
        if(Math.abs(dx) < 10){
          wk.carrying = false; wk.carryKind = null;
          addStripSpark(tx, 48);
        } else {
          wk.dir = dx > 0 ? 1 : -1;
          wk.x += wk.dir * 30 * dt;
          wk.walkClock = (wk.walkClock || 0) + walkAdvanceMs("staff_" + st.coat + "_walk", 30 * dt);
        }
      } else {
      wk.dir = 1;
      wk.x += 30 * dt;
      wk.walkClock = (wk.walkClock || 0) + walkAdvanceMs("staff_" + st.coat + "_walk", 30 * dt);   /* 接地同期 */
      if(wk.x > stripVW + 24){
        const kind = wk.carryKind || "release";
        wk.carrying = false; wk.carryKind = null; wk.x = stripVW - 30; wk.dir = -1;
        if(kind === "ship"){
          /* 日常の出荷: コインは出さない (正直さ)。極小の ✦ だけ */
          addStripSpark(stripVW - 14, STRIP_GROUND - 22);
        } else {
          addStripFloater(stripVW - 26, STRIP_GROUND - 36, "+🪙", "#d9a41a");
        }
      }
      }
    } else if(wk.backing){
      /* BacktoIdle タグ (sakuri 作画): 歩行をやめる時は戻りモーション (F8–F10) を
         1回再生してから座る。最終フレーム = 座りの初フレームで継ぎ目なし */
      if(stripNow - (wk.backStart || stripNow) >= 1800){
        wk.backing = false; wk.sitting = true; wk.sitStart = stripNow;
        wk.until = stripNow + (wk.pendingSitMs || 4000);
      }
    } else if(wk.sitting){
      if(stripNow > wk.until){ wk.sitting = false; wk.dir = Math.random() < 0.5 ? -1 : 1; }
    } else {
      const wkX0 = wk.x;
      wk.x += wk.dir * wk.speed * dt;
      if(wk.x < 24){ wk.x = 24; wk.dir = 1; }
      if(wk.x > stripVW - 24){ wk.x = stripVW - 24; wk.dir = -1; }
      /* Strip Canon §c.3: 研究員は研究ステーションの前面が持ち場（大きく離れない） */
      if(st.role === "research"){
        const rcx = stripResearchCX();
        if(wk.x < rcx - 46){ wk.x = rcx - 46; wk.dir = 1; }
        if(wk.x > rcx + 46){ wk.x = rcx + 46; wk.dir = -1; }
      }
      /* 再設計 段階2: 応援係はみゅけのそばが持ち場 */
      if(st.role === "cheer" && miyukeStrip.x > 0){
        const mx = miyukeStrip.x;
        if(wk.x < mx - 60){ wk.x = mx - 60; wk.dir = 1; }
        if(wk.x > mx + 60){ wk.x = mx + 60; wk.dir = -1; }
      }
      /* Phase C: 大型案件の担当はメモ（机クラスタ）のそばで待つ */
      if(S.bigDeal && S.bigDeal.repId === st.id){
        const mcx = stripDeskCX();
        if(wk.x < mcx - 100){ wk.x = mcx - 100; wk.dir = 1; }
        if(wk.x > mcx + 60){ wk.x = mcx + 60; wk.dir = -1; }
      }
      wk.walkClock = (wk.walkClock || 0) + walkAdvanceMs("staff_" + st.coat + "_walk", Math.abs(wk.x - wkX0));   /* 接地同期 (クランプ後の実距離) */
      if(Math.random() < dt * 0.05){ wk.backing = true; wk.backStart = stripNow; wk.pendingSitMs = 2500 + Math.random() * 3500; }
    }
  }
  for(const id of Object.keys(stripWalkers)) if(!seen[id]) delete stripWalkers[id];
  /* リリース検知: 一番デスクに近いウォーカーが荷物を運んで画面端へ */
  if(lastReleasesSeen < 0) lastReleasesSeen = S.totals.releases;
  if(S.totals.releases > lastReleasesSeen){
    /* v2.3.3: 歩行ゲート ON の間は、新作は「未配達」として数える
       （帯の棚に最新作の箱が出るのは、みゅけが運び終えた瞬間になる） */
    if(hasWalkArt()) shelfPending += S.totals.releases - lastReleasesSeen;
    lastReleasesSeen = S.totals.releases;
    spawnStripConfetti(cx);   /* Sprint 2: 帯でもリリースは紙吹雪で祝う（音は出さない） */
    let best = null, bd = Infinity;
    for(const st of S.staff){
      const wk = stripWalkers[st.id];
      if(wk && !wk.carrying){
        const d = Math.abs(wk.x - cx);
        if(d < bd){ bd = d; best = wk; }
      }
    }
    if(best){ best.carrying = true; best.carryKind = "release"; best.sitting = false; }
  }
  /* Sprint 4: 帯のクリックイベントの動き。魚は足場ライン上を泳ぎ、
     バグの群れは帯を這う（帯の仮想座標で動かす） */
  if(fishEvent){
    if(!stripFish) stripFish = { x: Math.random() < 0.5 ? -16 : stripVW + 16, dir: 0 };
    if(!stripFish.dir) stripFish.dir = stripFish.x < stripVW / 2 ? 1 : -1;
    stripFish.x += stripFish.dir * 26 * dt;
    if(stripFish.x < 14){ stripFish.x = 14; stripFish.dir = 1; }
    if(stripFish.x > stripVW - 14){ stripFish.x = stripVW - 14; stripFish.dir = -1; }
  } else if(stripFish) stripFish = null;
  if(bugEvent){
    for(const bg of bugEvent.bugs){
      if(typeof bg.sf !== "number"){ bg.sf = 0.1 + Math.random() * 0.8; bg.sy = 2 + Math.random() * 10; bg.svf = (Math.random() - 0.5) * 0.03; }
      bg.sf += (bg.svf || 0) * dt;
      if(bg.sf < 0.03){ bg.sf = 0.03; bg.svf = Math.abs(bg.svf || 0.02); }
      if(bg.sf > 0.97){ bg.sf = 0.97; bg.svf = -Math.abs(bg.svf || 0.02); }
    }
  }
  stripBugsUpdate();   /* 在庫バグ: 匹数に合わせた絵の数と這う刻み */
  flowVisualUpdate(dt);   /* 可視生産フロー: 移動物の進行と節目ウォッチャー */
  stripAmbientUpdate(dt);   /* Sprint 3: 雑談と訪問猫 */
}
/* 可視生産フロー: 帯側 (60fps) の進行。発火は tick の flowFeedTick が担い、
   ここは「飛んでいる物の移動」と「状態変化の節目検知」だけを行う */
function flowVisualUpdate(dt){
  /* 移動物の進行 (age は発火ずらしの遅延込み) */
  for(let i = stripFlow.length - 1; i >= 0; i--){
    const it = stripFlow[i];
    it.age += dt;
    if(it.age >= it.dur){
      if(it.kind === "note"){
        if(it.line === 2) stripBoardPulseAt2 = stripNow; else stripBoardPulseAt = stripNow;
      }
      stripFlow.splice(i, 1);
    }
  }
  const G = STRIP_GROUND;
  /* パッケージ節目: S.packages が増えたら D に完成箱が光って積まれる */
  if(lastPackagesSeen < 0) lastPackagesSeen = S.packages;
  else if(S.packages > lastPackagesSeen){
    stripPkgGlowUntil = stripNow + 2600;
    addStripFloater(stripShipX(), G - 46, "📦", "#d9a41a");
    lastPackagesSeen = S.packages;
  } else if(S.packages < lastPackagesSeen) lastPackagesSeen = S.packages;
  /* 研究Pモート: 整数部が増えた分だけ研究机から紫のモート (研究員在籍時) */
  const rpInt = Math.floor(S.rp);
  if(lastRpIntSeen < 0) lastRpIntSeen = rpInt;
  else if(rpInt > lastRpIntSeen){
    if(hasResearcher() && particleTotal() < 132){
      const n = Math.min(2, rpInt - lastRpIntSeen);
      for(let i = 0; i < n; i++)
        stripFlow.push({ kind: "mote", col: "#c586c0",
          x0: stripResearchCX() + (Math.random() - 0.5) * 22, y0: G - 24,
          x1: 0, y1: 0, age: -i * 0.2, dur: 1.3, arc: 0 });
    }
    lastRpIntSeen = rpInt;
  } else if(rpInt < lastRpIntSeen) lastRpIntSeen = rpInt;
  /* 企画中: アイデアが増えるたび、モニタからボードの BACKLOG 側へ
     小さな 💡 モートが吸われる (ideas の増加イベント駆動 §1.4) */
  const ideasInt = Math.floor(S.ideas);
  if(lastIdeasSeen < 0) lastIdeasSeen = ideasInt;
  else if(ideasInt > lastIdeasSeen){
    if(S.project && S.project.planning && particleTotal() < 132 && stripFlow.length < 10){
      const bcx = stripDeskCX();
      stripFlow.push({ kind: "idea",
        x0: bcx - 24, y0: G - 28,
        x1: bcx - STRIP_BOARD.w / 2 + 12, y1: STRIP_BOARD.top + 12,
        age: 0, dur: 1.6, arc: 10 });
    }
    lastIdeasSeen = ideasInt;
  } else if(ideasInt < lastIdeasSeen) lastIdeasSeen = ideasInt;
}
/* 山の天面 y (バグ・着地位置の計算用)。pileModel と同じ段数規則 */
function pileTopY(which){
  const m = pileModel();
  const n = which === "build" ? m.build.n : m[which].n;
  const rows = Math.max(1, Math.ceil(n / 2));
  const baseY = which === "build" ? STRIP_GROUND - 15.5 : STRIP_GROUND - 3.5;  /* build は出荷台の天面 (prop_ship 48×48 化で -12) */
  return baseY - rows * (which === "build" ? 9.2 : 7.6);   /* build 段ピッチは pileSlotPos と一致 (2026-10-25 icon_box 28×28 化) */
}
