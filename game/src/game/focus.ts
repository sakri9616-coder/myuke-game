/* ---------- 集中力の「おねだり」(v2.21.0) ----------
   sakuri (2026-10-28):「集中力システムを遊びとして改善」。旧来の集中力は 25分かけて減るだけの
   メーターで、おやつも 20秒クールダウンのボタンだった (判断の場面がない)。
   ここでは、作業中のみゅけがときどき頭の上に「おねだり」を出す (🐟 おやつ / ✋ なでて / 📣 おうえん)。
   制限時間のうちに合う世話をすると、集中力が 100% を超えて「ノリノリ」(最大 150%) まで上がり、
   ごきげん連続の数だけ大きくなるご褒美 (N秒ぶんの収入) が出る。逃しても罰はなく、連続が切れるだけ。
   お世話係がいれば、少し待ったあと代わりに応える (ノリノリは控えめ・連続は伸びない) = 手作業 → 自動化の勾配。
   ノリノリ分は減りが速い (overDrain 倍) ので、張り付いて応え続けたときだけ高く保てる */
const WANT = {
  firstSec: 40,            /* 起動してから最初のおねだりまで (作業中の秒) */
  everyMinSec: 50, everyMaxSec: 100,   /* 次のおねだりまで (作業中の秒、乱数) */
  lowConc: 40,             /* 集中力がこれを下回ったら待たずに出す */
  windowSec: 20,           /* 応えられる時間 */
  gain: 35,                /* 応えたときの集中力 (100% を超えて max まで) */
  max: 150,                /* ノリノリの上限 */
  overDrain: 4,            /* 100% を超えた分の減りの速さ (通常の何倍か) */
  rewardSec: 20,           /* ご褒美 = rewardSec × (1 + streakStep × 連続) 秒ぶんの収入 */
  streakStep: 0.25, streakMax: 8,
  careDelaySec: 12,        /* お世話係が代わりに応えるまで (お世話力で縮む) */
  careGain: 15,
  pats: 3, cheers: 12      /* なでて = 頭を3回、おうえん = みゅけを12回クリック */
};
const WANT_KINDS = {
  snack: { icon: "🐟", label: "おやつ", ask: "おなかすいたにゃ… おやつ箱あけてほしいにゃ", need: 1 },
  pat:   { icon: "✋", label: "なでて", ask: "あたま、なでてほしいにゃ", need: WANT.pats },
  cheer: { icon: "📣", label: "おうえん", ask: "おうえんしてにゃ！ ラストスパートにゃ", need: WANT.cheers }
};
let want = null;           /* { kind, at, until, n } 表示中のおねだり (セーブしない一時状態) */
let wantCountdown = WANT.firstSec;
let wantStreak = 0;
function wantIs(kind){ return !!want && want.kind === kind; }
/* 集中力を足す。100% 以下の回復は 100% で止め、ノリノリ分 (100% 超) は削らない */
function addConc(x){ S.concentration = Math.max(S.concentration, Math.min(100, S.concentration + x)); }
/* 1秒ティックから (作業中のみ進む。企画中・休憩中は止まる) */
function tickWant(coding){
  const now = Date.now();
  if(want){
    const careW = staffSums().careW;
    const careAt = want.at + Math.max(4, WANT.careDelaySec / Math.max(1, careW)) * 1000;
    if(careW > 0 && now >= careAt) return wantDone("care");
    if(now >= want.until){
      want = null;
      if(wantStreak > 0) addLog("おねだりを見のがした（ごきげん×" + wantStreak + " はリセット）");
      wantStreak = 0;
      wantCountdown = WANT.everyMinSec;
    }
    return;
  }
  if(!coding || challengeActive("idle")) return;
  wantCountdown--;
  if(wantCountdown > 0 && S.concentration >= WANT.lowConc) return;
  const kinds = Object.keys(WANT_KINDS);
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  want = { kind, at: now, until: now + WANT.windowSec * 1000, n: 0 };
  say(WANT_KINDS[kind].ask);
}
/* 世話をしたら呼ぶ (おやつ箱・頭なで・みゅけへの応援クリック)。合っていれば数を進める */
function wantProgress(kind){
  if(!want || want.kind !== kind) return false;
  want.n++;
  if(want.n >= WANT_KINDS[kind].need) wantDone("you");
  return true;
}
function wantDone(by){
  const kind = want.kind;
  want = null;
  wantCountdown = WANT.everyMinSec + Math.floor(Math.random() * (WANT.everyMaxSec - WANT.everyMinSec + 1));
  const hx = stripMiyukeX(), fy = STRIP_GROUND - 70;
  const strip = document.body.classList.contains("strip");
  if(by === "care"){
    S.concentration = Math.min(WANT.max, Math.max(S.concentration, Math.min(100, S.concentration + WANT.careGain)) + (S.concentration >= 100 ? WANT.careGain * 0.5 : 0));
    const carer = S.staff.find(s => s.role === "care");
    addLog("🍵 " + (carer ? carer.name : "お世話係") + "が「" + WANT_KINDS[kind].label + "」に応えた（集中力+" + WANT.careGain + "）");
    if(strip) addStripFloater(hx, fy, "🍵 お世話 +" + WANT.careGain + "%", "#3f8f4a");
    return;
  }
  S.concentration = Math.min(WANT.max, S.concentration + WANT.gain);
  wantStreak = Math.min(WANT.streakMax, wantStreak + 1);
  const c = rewardCoins(WANT.rewardSec * (1 + WANT.streakStep * (wantStreak - 1)), 5);
  S.coins += c; S.totals.coinsEarned += c; creditIncome("labor", c);
  S.ideas += 1;
  SoundKit.play("ready");
  if(strip) addStripFloater(hx, fy, "ごきげん×" + wantStreak + "  +" + fmt(c) + "🪙", "#c97a2e");
  say(S.concentration > 100 ? "ノリノリだにゃ！（集中 " + Math.round(S.concentration) + "%）" : "ありがとにゃ！ 集中もどった");
  addLog("💗 おねだり「" + WANT_KINDS[kind].label + "」に応えた（ごきげん×" + wantStreak + "・+" + fmt(c) + "🪙・集中力+" + WANT.gain + "）");
}
/* 帯: みゅけの頭の右下 (セリフ吹き出しの下) に、おねだりの絵 (絵文字)・回数・残り時間の細いメーター。
   頭の左はボードの吊りメモ札が下がっているので右に出す */
function drawStripWant(hx, G){
  if(!want) return;
  const now = Date.now();
  const k = WANT_KINDS[want.kind];
  const frac = Math.max(0, Math.min(1, (want.until - now) / (WANT.windowSec * 1000)));
  const bob = motionReduced() ? 0 : Math.round(Math.sin(now / 220) * 1.5);
  const w = k.need > 1 ? 40 : 26, h = 21, x = Math.round(hx + 16), y = G - 52 + bob;
  sctx.save();
  sctx.fillStyle = frac < 0.3 && Math.floor(now / 250) % 2 ? "#ffe7a8" : "#fffaf2";
  sctx.strokeStyle = "#6b5540"; sctx.lineWidth = 0.7;
  stripRoundRect(x, y, w, h, 5); sctx.fill(); sctx.stroke();
  sctx.beginPath();   /* 頭のほうへ向くしっぽ */
  sctx.moveTo(x + 0.5, y + 5); sctx.lineTo(x + 0.5, y + 10); sctx.lineTo(x - 5, y + 3);
  sctx.closePath(); sctx.fill();
  sctx.textBaseline = "middle"; sctx.fillStyle = "#4a3b2c";
  sctx.font = "700 13px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.textAlign = "center";
  sctx.fillText(k.icon, x + 13, y + 8.5);
  if(k.need > 1){
    sctx.font = "700 8px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.fillText(want.n + "/" + k.need, x + 31, y + 9);
  }
  sDrawNine("ui_meter_track_3", x + 3, y + h - 6, w - 6, 4, 2, 0);
  if(frac > 0) sDrawNine("ui_meter_fill_3", x + 4, y + h - 5.5, Math.max(1, (w - 8) * frac), 3, 1, 0);
  sctx.restore();
  stripHitRects.want = { x, y, w, h };
}
