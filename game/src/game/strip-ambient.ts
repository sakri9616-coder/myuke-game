/* ---------- Sprint 3: 帯のアンビエント（スタッフ同士の雑談と訪問猫） ----------
   完全に飾り: 資源もクリックも音も発生しない。たまに近くのスタッフ同士が
   立ち止まって小さい吹き出しで喋り、数十分に1回、まだ雇っていない毛柄の
   「訪問猫」が帯を横切るだけ。 */
const CHAT_LINES = [
  "バグ、あと少しにゃ", "テスト全緑だった！", "デプロイまだかにゃ", "この機能、推せる",
  "おやつ何時だっけ", "カリカリ派？ウェット派？", "ごはんが楽しみにゃ", "お魚、食べたい…",
  "にゃーん（意味はない）", "毛づくろいしたい…", "段ボール、あそこに…", "お昼寝は正義にゃ"
];
/* v2.26.0: 取ったスタンプに応じた一言 (defs.ts の STAMP_CHAT_LINES) も雑談の候補に混ぜる */
function pickChatLine(){
  const pool = CHAT_LINES.concat(STAMP_CHAT_LINES.filter(([st]) => S.stamps[st]).map(([, t]) => t));
  return pool[Math.floor(Math.random() * pool.length)];
}
let stripChat = null;      /* { whoId, text, until } */
let lastChatterAt = 0;
function maybeStartChatter(now, force){
  if(stripChat){
    if(now < stripChat.until) return false;
    stripChat = null;
  }
  if(!force && now - lastChatterAt < 25000) return false;
  const walkers = [];
  for(const st of S.staff){
    const wk = stripWalkers[st.id];
    if(wk && !wk.carrying) walkers.push({ st, wk });
  }
  for(let i = 0; i < walkers.length; i++){
    for(let j = i + 1; j < walkers.length; j++){
      if(Math.abs(walkers[i].wk.x - walkers[j].wk.x) < 30){
        const sp = Math.random() < 0.5 ? walkers[i] : walkers[j];
        stripChat = { whoId: sp.st.id,
          text: pickChatLine(), until: now + 2800 };
        walkers[i].wk.chatUntil = now + 2800;
        walkers[j].wk.chatUntil = now + 2800;
        lastChatterAt = now;
        return true;
      }
    }
  }
  return false;
}
let stripVisitor = null;   /* { x, dir, coat, speed } */
let subCoinFrac = 0;       /* Phase D: 子会社コインの端数（セーブしない。<1枚の端数は再起動で消える） */
let stripDelivery = null;  /* Phase D: 子会社の配達猫 { x, dir, coat, speed, walkClock, done } */
let stripVendor = null;    /* 拡張ウェーブ G: 外注ベンダーの猫（バグを回収に来る） */
let nextDeliveryAt = 0;
let nextVisitorAt = 0;
function spawnStripVisitor(){
  const hired = new Set(S.staff.map(s => s.coat));
  const pool = COATS.filter(c => !hired.has(c));
  const src = pool.length ? pool : COATS;
  const coat = src[Math.floor(Math.random() * src.length)];
  const fromLeft = Math.random() < 0.5;
  stripVisitor = { x: fromLeft ? -20 : stripVW + 20, dir: fromLeft ? 1 : -1,
    coat, speed: 13 + Math.random() * 5, walkClock: 0 };
  return stripVisitor;
}
/* Phase D: 子会社の配達猫。売上は tick で計上済み — これは知覚のための
   訪問で、余分なコインは出さない（出荷の ✦ と同じ正直さ） */
function spawnStripDelivery(){
  const coat = COATS[Math.floor(Math.random() * COATS.length)];
  stripDelivery = { x: stripVW + 20, dir: -1, coat, speed: 17, walkClock: 0, done: false };
  return stripDelivery;
}
/* 拡張ウェーブ G: ベンダーの猫は右から手ぶらで来て、机でバグを受け取り、
   バグを持って右へ帰る（配達猫と逆の物流） */
function spawnStripVendor(){
  if(stripVendor) return stripVendor;
  const coat = COATS[Math.floor(Math.random() * COATS.length)];
  stripVendor = { x: stripVW + 20, dir: -1, coat, speed: 17, walkClock: 0, done: false };
  return stripVendor;
}
function stripAmbientUpdate(dt){
  /* 雑談: たまに試みる（成立条件は maybeStartChatter 側で判定） */
  if(Math.random() < dt * 0.25) maybeStartChatter(stripNow, false);
  if(stripChat && stripNow >= stripChat.until) stripChat = null;
  /* 訪問猫: 初回は1.5〜3.5分後、以降は12〜25分間隔で横切る */
  if(!stripVisitor){
    if(nextVisitorAt === 0) nextVisitorAt = stripNow + 90000 + Math.random() * 120000;
    else if(stripNow >= nextVisitorAt) spawnStripVisitor();
  } else {
    stripVisitor.x += stripVisitor.dir * stripVisitor.speed * dt;
    stripVisitor.walkClock = (stripVisitor.walkClock || 0) + walkAdvanceMs("staff_" + stripVisitor.coat + "_walk", stripVisitor.speed * dt);   /* 接地同期 */
    if(stripVisitor.x < -30 || stripVisitor.x > stripVW + 30){
      stripVisitor = null;
      nextVisitorAt = stripNow + (12 + Math.random() * 13) * 60000;
    }
  }
  /* Phase D: 配達猫は右から来て机で納品し、右へ帰る（3〜6分間隔） */
  if(!stripDelivery){
    if(S.subs && S.subs.length){
      if(nextDeliveryAt === 0) nextDeliveryAt = stripNow + 120000;
      else if(stripNow >= nextDeliveryAt) spawnStripDelivery();
    }
  } else {
    const d = stripDelivery;
    stepStripCourier(d, d.speed, dt, spaceName("courier", "📦 子会社から納品"), "#4a90c2");
    if(d.x > stripVW + 30){
      stripDelivery = null;
      nextDeliveryAt = stripNow + (3 + Math.random() * 3) * 60000;
    }
  }
  /* 拡張ウェーブ G: ベンダーの猫（机でバグを受け取って帰る） */
  if(stripVendor){
    stepStripCourier(stripVendor, stripVendor.speed, dt, "🧳 バグ回収！", "#8a6a44");
    if(stripVendor.x > stripVW + 30) stripVendor = null;
  }
  /* Wave H: モジュールの箱運び（右から箱を持って机へ・帰りは手ぶら） */
  if(stripModCart){
    stepStripCourier(stripModCart, 17, dt, "🧩 モジュール到着！", "#58a64a");
    if(stripModCart.x > stripVW + 30) stripModCart = null;
  }
}
/* 右から来て机で荷を渡し、右へ帰る運び猫の1ステップ（到着の瞬間だけ ✦ と吹き出し） */
function stepStripCourier(v, speed, dt, label, color){
  v.x += v.dir * speed * dt;
  v.walkClock = (v.walkClock || 0) + walkAdvanceMs("staff_" + v.coat + "_walk", speed * dt);
  if(!v.done && Math.abs(v.x - stripDeskCX()) < 14){
    v.done = true; v.dir = 1;
    addStripSpark(stripDeskCX(), STRIP_GROUND - 40);
    addStripFloater(stripDeskCX(), STRIP_GROUND - 48, label, color);
  }
}
function drawStripChatBubble(hx, topY, text){
  sctx.save();
  sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  const tw = sctx.measureText(text).width;
  const bw = tw + 9, bh = 12.5;
  const bx = Math.max(2, Math.min(stripVW - bw - 2, hx - bw / 2));
  const by = Math.max(2, topY - bh - 3);
  sctx.globalAlpha = 0.95;
  sctx.fillStyle = "#fffaf2"; sctx.strokeStyle = "#6b5540"; sctx.lineWidth = 0.6;
  stripRoundRect(bx, by, bw, bh, 3); sctx.fill(); sctx.stroke();
  const tx = Math.max(bx + 5, Math.min(bx + bw - 5, hx));
  sctx.beginPath();
  sctx.moveTo(tx - 2, by + bh - 0.5); sctx.lineTo(tx + 2, by + bh - 0.5); sctx.lineTo(hx, by + bh + 3);
  sctx.closePath();
  sctx.fillStyle = "#fffaf2"; sctx.fill();
  sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "left"; sctx.textBaseline = "middle";
  sctx.fillText(text, bx + 4, by + bh / 2 + 0.3);
  sctx.restore();
}
function stripAtDesk(){ return stripIsDeskState() && Math.abs(miyukeStrip.x - stripDeskCX()) < 8; }
function stripMiyukeX(){ return stripAtDesk() ? stripDeskCX() + 12 : miyukeStrip.x; }
function stripRoundRect(x, y, w, h, r){
  sctx.beginPath();
  sctx.moveTo(x + r, y);
  sctx.arcTo(x + w, y, x + w, y + h, r);
  sctx.arcTo(x + w, y + h, x, y + h, r);
  sctx.arcTo(x, y + h, x, y, r);
  sctx.arcTo(x, y, x + w, y, r);
  sctx.closePath();
}
function drawStripBubble(hx, topY){
  const now = Date.now();
  const remain = stripSay.until - now;
  if(!stripSay.text || remain <= 0) return;
  let t = stripSay.text;
  if(t.length > 30) t = t.slice(0, 30) + "…";
  sctx.save();
  sctx.font = "700 9.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  const tw = sctx.measureText(t).width;
  const bw = tw + 12, bh = 16;
  let bx = Math.max(3, Math.min(stripVW - bw - 3, hx - bw / 2));
  let by = Math.max(2, topY - bh - 4);
  /* 頭上がプロジェクトボードに重なるとき (机に座っている間はいつも) は、ボードの文字を
     隠さないよう頭の横・ボードの下に出す。右に入らなければ左、どちらも無理なら頭上 */
  let side = 0;
  const br = stripHitRects.board;
  if(br && bx < br.x + br.w && bx + bw > br.x && by < br.y + br.h){
    const sy = br.y + br.h + 2;
    if(hx + 12 + bw <= stripVW - 3){ side = 1; bx = hx + 12; by = sy; }
    else if(hx - 32 - bw >= 3){ side = -1; bx = hx - 32 - bw; by = sy; }
  }
  stripHitRects.bubble = side ? { x: bx - 5, y: by, w: bw + 10, h: bh } : { x: bx, y: by, w: bw, h: bh + 5 };  /* しっぽ分も含める */
  sctx.globalAlpha = 0.96 * Math.min(1, remain / 600);
  sctx.fillStyle = "#fffaf2"; sctx.strokeStyle = "#6b5540"; sctx.lineWidth = 0.7;
  stripRoundRect(bx, by, bw, bh, 4); sctx.fill(); sctx.stroke();
  sctx.beginPath();
  if(side){
    /* 横出しのしっぽは頭のほうへ水平に向ける */
    const ex = side > 0 ? bx + 0.5 : bx + bw - 0.5, cy = by + bh / 2 + 1;
    sctx.moveTo(ex, cy - 2.5); sctx.lineTo(ex, cy + 2.5); sctx.lineTo(ex - side * 5, cy + 3.5);
  } else {
    const tx = Math.max(bx + 6, Math.min(bx + bw - 6, hx));
    sctx.moveTo(tx - 2.5, by + bh - 0.5); sctx.lineTo(tx + 2.5, by + bh - 0.5); sctx.lineTo(hx, by + bh + 4);
  }
  sctx.closePath();
  sctx.fillStyle = "#fffaf2"; sctx.fill();
  sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "left"; sctx.textBaseline = "middle";
  sctx.fillText(t, bx + 5.5, by + bh / 2 + 0.4);
  sctx.restore();
}

