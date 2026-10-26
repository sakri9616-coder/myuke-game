/* ---------- 入力とリアクション ---------- */
let lastMouse = null, snackReadyAt = 0, clickTimes = [];
/* ページ内カーソル移動のブースト集計。Strip Canon で部屋ビューが無くなったため、
   対象はページ全体に広げ、距離は実 px で数える（旧: バッファpx×3 の目安換算）。
   OS全体集計 ON の間は二重に数えない（Phase 2 の規約どおり） */
document.addEventListener("pointermove", (e)=>{
  /* 2ウィンドウ化 §3.5: viewer は自分の S (レプリカ) を汚さない。menu 内の
     カーソル移動は「距離だけ」を集計して帯へ送り、合流は帯が一元管理する */
  if(IS_VIEWER){
    if(lastMouse){
      const dv = Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
      if(dv > 0) menuInputAcc.distPx += dv;
    }
    lastMouse = { x: e.clientX, y: e.clientY };
    return;
  }
  if(lastMouse && !S.settings.pauseInput){
    const d = Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y);
    if(d > 0){
      if(!osCountingActive()){ cursorAcc += d; S.totals.cursorPx += d; S.today.cursorPx += d; }
      lastInputAt = Date.now();
      if(d > 2) noteInput();
      checkStamps();
    }
  }
  lastMouse = { x: e.clientX, y: e.clientY };
});
document.addEventListener("keydown", ()=>{
  // キーの内容は読まない。回数だけを数える。
  if(IS_VIEWER){ menuInputAcc.keys++; return; }   /* §3.5: viewer は回数だけ帯へ送る */
  if(S.settings.pauseInput) return;
  lastInputAt = Date.now();
  noteInput();   /* 入力パルスの記録（Phase 2 の継ぎ目） */
  if(osCountingActive()) return;   /* Phase 2: OS集計が同じ打鍵を数えるため二重に数えない */
  keysAcc++; S.totals.keys++; S.today.keys++;
});
/* Strip Canon: アクションボタンはプロジェクトパネル内の HTML から呼ばれる */
function giveSnack(){
  const now = Date.now();
  if(now < snackReadyAt){ say("さっき食べたばかりにゃ…"); return; }
  snackReadyAt = now + 20000;
  /* おやつアニメ全長に合わせる: intro 0.3s + ループ(タグ区間 F4〜F14)1.3s×3 + outro 0.3s = 4.5s */
  setState("eat", animDuration("miyuke_snack"));
  S.concentration = Math.min(100, S.concentration + 18);
  SoundKit.play("snack");
  say("おやつ！…ありがとうにゃ。集中力もどった");
  addLog("おやつをあげた（集中力+18）");
}
/* callMiyuke / rerollProject は 2026-10-25 に廃止 (sakuri 指示: フレーバーボタン不要。
   react_call ポーズ自体は帯クリック反応のローテーション側で現役) */

/* ---------- Sprint 2: おかえりセレモニー ----------
   既存セーブで起動したら、みゅけはまず寝ている（sleep ポーズ＋Zzz）。
   約1.2秒後に起きて挨拶し、前回セッションの「あらすじ」カードをそっと出す。
   30分以上あいていたら「夢のお土産」として アイデア+1〜3。これは進捗そのもの
   ではなく再開の触媒で、オフライン進行（PCオフ中は進捗停止）の原則は不変。 */
let returnInfo = null;    /* { releases, coinsEarned, ms, gift } 前回のあらすじ */
let returnWakeAt = 0;     /* 起床する時刻（0 = セレモニーなし） */
let returnShownAt = 0;    /* Sprint 4: カード表示時刻（自動で閉じる用） */
function fmtSessionDur(ms){
  const mins = Math.max(1, Math.round(ms / 60000));
  if(mins < 60) return "約" + mins + "分";
  return "約" + Math.floor(mins / 60) + "時間" + (mins % 60 ? (mins % 60) + "分" : "");
}
function renderReturnCard(){
  const el = document.getElementById("return-card");
  if(!el || !returnInfo) return;
  let h = "<div class='rc-head'><span>🏠 おかえりなさい！</span>" +
    "<button class='rc-close' onclick='closeReturnCard()' aria-label='閉じる'>×</button></div>";
  h += "<div>前回は " + fmtSessionDur(returnInfo.ms) + " 一緒にいて、🎉 <b>" + returnInfo.releases +
    "作品</b> リリース、🪙 <b>" + fmt(returnInfo.coinsEarned) + "コイン</b> かせいだにゃ。</div>";
  if(returnInfo.gift > 0)
    h += "<div class='rc-gift'>💡 夢でアイデアが浮かんだにゃ（アイデア+" + returnInfo.gift + "）</div>";
  el.innerHTML = h;
  el.style.display = "";
  returnShownAt = Date.now();   /* Sprint 4: 4分後に tick が静かに閉じる */
}
function closeReturnCard(){
  const el = document.getElementById("return-card");
  if(el) el.style.display = "none";
}
function setupReturnCeremony(){
  /* まず寝かせる。起床は tick() が returnWakeAt を見て行う */
  catState = "nap"; stateUntil = Date.now() + 1200; stateEnteredAt = Date.now();
  returnWakeAt = Date.now() + 1200;
  const prev = S.lastSession;
  if(!prev || typeof prev.ms !== "number") return;   /* 旧セーブ: あらすじ無し、挨拶のみ */
  returnInfo = { releases: prev.releases || 0, coinsEarned: prev.coinsEarned || 0, ms: prev.ms || 0, gift: 0 };
  const awayMs = Date.now() - (prev.endedAt || 0);
  if(awayMs >= 30 * 60000){
    returnInfo.gift = 1 + Math.floor(Math.random() * 3) + (hasPerk("dreamplus") ? 1 : 0);   /* 星屑特典「夢の続き」 */
    S.ideas += returnInfo.gift;
    S.lastGiftAt = Date.now();
    addLog("💤 夢のお土産: 寝ている間にアイデアが浮かんだ（アイデア+" + returnInfo.gift + "）");
  }
  renderReturnCard();
}

