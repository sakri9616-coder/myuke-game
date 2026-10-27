/* ---------- 状態マシン ---------- */
let catState = "code", stateUntil = Date.now() + 4000, lastInputAt = Date.now();
/* アニメーション用: 現在の状態に入った時刻（ランタイムのみ・セーブしない） */
let stateEnteredAt = Date.now();
const PLAY_STATES = ["yarn","groom","watch","chase","zoomies","duckplay","treasure"];
function availablePlays(){
  return PLAY_STATES.filter(p =>
    p!=="duckplay" &&   /* 段階5: アヒル会議の研究は廃止 */
    (p!=="treasure" || S.research.res_play2));
}
function pickRestState(){
  const pool = availablePlays();
  return pool[Math.floor(Math.random()*pool.length)];
}
function setState(st, ms){ catState = st; stateUntil = Date.now() + ms; stateEnteredAt = Date.now(); }
function stateTick(now){
  if(now < stateUntil) return;
  const hour = new Date().getHours();
  const night = hour >= 23 || hour < 5;
  // 集中力が尽きたら休憩か昼寝
  if(S.concentration <= 15 && catState !== "nap"){
    if(Math.random() < 0.45){ setState("nap", 9000); S.totals.naps++; say("ちょっとだけ…キーボードで寝るにゃ"); return; }
    const ps = pickRestState(); setState(ps, 5000); flagPlay(ps); return;
  }
  // 状態ごとの後処理
  if(catState === "nap"){ S.concentration = Math.min(100, S.concentration + 45); }
  if(PLAY_STATES.includes(catState)){
    S.concentration = Math.min(100, S.concentration + 22);
    S.ideas += (catState==="treasure" ? 4 : 2);
    /* Sprint 4: 宝探しはたまに小銭も見つける */
    if(catState==="treasure" && Math.random() < 0.35){
      const c = rewardCoins(BAL.rewardSec.treasure, 10 + Math.floor(Math.random()*15));
      S.coins += c; S.totals.coinsEarned += c; creditIncome("labor", c);
      say("宝探しで "+fmt(c)+"🪙 見つけたにゃ！");
      addLog("🗺️ 宝探しで "+fmt(c)+"🪙 を見つけた");
    }
  }
  if(catState === "think"){ S.ideas += 1; }
  // 企画中は「考え中」でアイデアを貯めるのが仕事になる
  if(S.project && S.project.planning && Math.random() < 0.7){
    setState("think", 4000); say("企画を考え中…ひらめき待ちにゃ"); return;
  }
  // 次の状態を決める
  const idleLong = now - lastInputAt > 5*60000;
  const r = Math.random();
  if(S.bugStock >= 4 && r < 0.45){ setState("debug", 4000); return; }
  if(r < 0.62){ setState(night && Math.random()<0.3 ? "code_slow" : "code", 5000 + Math.random()*5000); return; }
  if(r < 0.72){ setState("think", 4000); say("うーん、どう作るかにゃ…"); return; }
  if(r < 0.80 || idleLong){ const ps = pickRestState(); setState(ps, 5000); flagPlay(ps); return; }
  setState("code", 6000);
}
function flagPlay(ps){ S.flags["play_"+ps] = true; if(ps==="duckplay") S.flags.play_duck = true; }

/* ---------- v2: クリックイベント（金の魚／バグ大量発生） ----------
   どちらも時間切れで消えるだけ。取り逃がしてもペナルティは一切ない。 */
let fishEvent = null, bugEvent = null;
let nextFishAt = Date.now() + 90000, nextBugAt = Date.now() + 160000;
/* 魚の種類（再設計 段階2）: 金（コイン＋研究P）・応援（しばらく応援 ×FISH.cheerMult）・大漁（しばらく生産 ×FISH.haulMult）。
   効き目は揮発（保存しない）。色違いの絵は発注中で、それまでは同じ絵で、現れた時の台詞と捕まえた時の文字で種類が分かる */
const FISH = { cheerMult: 5, cheerSec: 15, haulMult: 3, haulSec: 60 };
const FISH_KINDS = {
  gold:  { name: "金のひらめきフィッシュ", w: 2 },
  cheer: { name: "応援フィッシュ",         w: 1 },
  haul:  { name: "大漁フィッシュ",         w: 1 }
};
let cheerFishUntil = 0, haulFishUntil = 0;
function fishClickMult(){ return Date.now() < cheerFishUntil ? FISH.cheerMult : 1; }
function fishProdMult(){ return Date.now() < haulFishUntil ? FISH.haulMult : 1; }
function pickFishKind(){
  let r = Math.random() * 4;
  for(const k in FISH_KINDS){ r -= FISH_KINDS[k].w; if(r < 0) return k; }
  return "gold";
}
function spawnFish(now){
  fishEvent = { x: 34 + Math.random()*172, y: 40 + Math.random()*86, until: now + 10000, kind: pickFishKind() };
  /* Sprint 4: 帯でも魚が見える・触れる。帯側の位置は帯の仮想座標で別に持つ
     （stripFish は帯レンダラが初期化し、帯の更新で泳がせる） */
  stripFish = null;
  const fname = FISH_KINDS[fishEvent.kind].name;
  say("✨ " + fname + "が現れたにゃ！クリックで捕まえて！");
  addLog("✨ " + fname + "が現れた");
}
function spawnBugSwarm(now, count?){
  const bugs = [];
  const n = count || 6;
  for(let i = 0; i < n; i++){
    bugs.push({ x: 20 + Math.random()*200, y: 30 + Math.random()*118,
      vx: (Math.random()-0.5) * 22, vy: (Math.random()-0.5) * 14,
      /* Sprint 4: 帯側の這い位置（帯仮想座標。sx は帯幅に対する割合で持ち、
         実際の x は描画時に stripVW へ写す。sy は地面からの高さ） */
      sf: 0.08 + Math.random()*0.84, sy: 2 + Math.random()*10,
      svf: (Math.random()-0.5) * 0.03 });
  }
  bugEvent = { bugs, until: now + 20000 };
  say("🐛 バグが大量発生！？ 叩くとコインだにゃ（逃がしても平気だよ）");
  addLog("🐛 バグ大量発生イベント！");
}
function eventTick(now){
  /* F: フィーバー中はバグが湧きやすい（潰すとボーナス DP の的になる） */
  if(feverActive() && !bugEvent && now >= feverBugNext){
    spawnBugSwarm(now, 10);
    feverBugNext = now + 12000;
  }
  if(!fishEvent && !bugEvent){
    if(now >= nextFishAt && nextFishAt <= nextBugAt) spawnFish(now);
    else if(now >= nextBugAt) spawnBugSwarm(now);
  }
  if(fishEvent && now > fishEvent.until){
    fishEvent = null;
    nextFishAt = now + (150000 + Math.random()*120000) * fishIntervalMul();   /* Sprint 4: 幸運のヒレ */
  }
  if(bugEvent && now > bugEvent.until){
    bugEvent = null;
    nextBugAt = now + 180000 + Math.random()*150000;
    if(Math.random() < 0.5) say("バグたちはどこかへ行ったにゃ（被害なし）");
  }
  // バグの群れが発生する（帯の上を這う）
  if(bugEvent){
    for(const bg of bugEvent.bugs){
      bg.x += bg.vx * 0.15; bg.y += bg.vy * 0.15;
      if(bg.x < 8 || bg.x > 232){ bg.vx *= -1; bg.x = Math.max(8, Math.min(232, bg.x)); }
      if(bg.y < 24 || bg.y > 156){ bg.vy *= -1; bg.y = Math.max(24, Math.min(156, bg.y)); }
    }
  }
}
/* フローター（+DP等の一時表示）は帯だけに存在する（Strip Canon）。
   呼び出し側の座標は帯の仮想座標で渡される。フルモードでは表示先が無いので捨てる */
function addFloater(x, y, text, color){
  if(!document.body.classList.contains("strip")) return;
  addStripFloater(x, y, text, color);
}
function catchFish(bx, by){
  const kind = (fishEvent && fishEvent.kind) || "gold";
  fishEvent = null;
  nextFishAt = Date.now() + (150000 + Math.random()*120000) * fishIntervalMul();   /* Sprint 4: 幸運のヒレ */
  if(kind === "cheer" || kind === "haul"){
    const cheer = kind === "cheer", now = Date.now();
    if(cheer) cheerFishUntil = Math.max(cheerFishUntil, now) + FISH.cheerSec * 1000;
    else haulFishUntil = Math.max(haulFishUntil, now) + FISH.haulSec * 1000;
    S.totals.goldFish++;
    SoundKit.play("fishCatch");
    const what = cheer ? "応援 ×" + FISH.cheerMult + "（" + FISH.cheerSec + "秒）" : "生産 ×" + FISH.haulMult + "（" + FISH.haulSec + "秒）";
    addFloater(bx, by - 10, "🐟 " + what, cheer ? "#e2543e" : "#3a8fd9");
    say(FISH_KINDS[kind].name + "、捕まえたにゃ！ " + what);
    addLog("🐟 " + FISH_KINDS[kind].name + "を捕まえた（" + what + "）");
    checkStamps(); save();
    tutCheck();
    return;
  }
  const coins = rewardCoins(BAL.rewardSec.fish, Math.round(80 * dustMult() * workScale()));   /* 収入の90秒ぶん（下限は従来の式） */   // Sprint 1: セッション中のイベント収入を厚く
  S.rp += 2; S.coins += coins; S.totals.coinsEarned += coins; creditIncome("labor", coins);
  S.totals.goldFish++;
  SoundKit.play("fishCatch");
  addFloater(bx, by - 10, "🐟 +2🔬 +" + fmt(coins) + "🪙", "#d9a41a");
  say("金のひらめきフィッシュ、捕まえたにゃ！！ 研究P+2");
  addLog("🐟 金のひらめきフィッシュを捕まえた（研究P+2 / +"+fmt(coins)+"🪙）");
  checkStamps(); save();
  tutCheck();
}
function splatBug(i, bx, by){
  bugEvent.bugs.splice(i, 1);
  SoundKit.play("bugSquash");
  const squash = rewardCoins(BAL.rewardSec.bug, 6 * workScale());   /* 収入の3秒ぶん（下限は従来の式） */
  S.coins += squash; S.totals.coinsEarned += squash; creditIncome("labor", squash);
  S.totals.bugsSquashed++; S.today.bugs++; S.totals.eventBugs++;
  if(feverActive()){
    /* F: フィーバー中のバグ潰しはボーナス DP（応援クリック2回ぶん・入力由来として扱う） */
    const dp = clickBaseDP() * comboMult() * 2;
    prodMuted = true;
    produceDP(dp, "l1");
    prodMuted = false;
    addFloater(bx, by - 16, "+" + dp.toFixed(0) + "DP", "#e2543e");
  }
  addFloater(bx, by - 8, "+" + fmt(squash) + "🪙", "#5aa469");
  if(bugEvent.bugs.length === 0){
    const sweep = rewardCoins(BAL.rewardSec.sweep, 20 * workScale());
    S.coins += sweep; S.totals.coinsEarned += sweep; creditIncome("labor", sweep);
    bugEvent = null;
    nextBugAt = Date.now() + 180000 + Math.random()*150000;
    say("バグ全滅！ボーナス+" + fmt(sweep) + "コインにゃ");
    addLog("🐛 バグ大量発生を全て叩いた（ボーナス+" + fmt(sweep) + "🪙）");
  }
  checkStamps(); save();
}

/* ---------- 応援の熱（再設計 段階2・2026-10-27 承認）----------
   秒1回以上の応援を続けた時間で熱が上がる（HEAT.secPerLv 秒ごとに1段、1段ごとにクリック ×HEAT.perLv）。
   コンボ（2.5秒で切れる）と違い、HEAT.graceSec 秒までの手休めでは下がらない。それより長く離すと
   1秒ごとに HEAT.coolPerSec 秒ぶん冷める。張り付いて押し続けるほど労働の手応えが育つ（理念書3） */
const HEAT = { secPerLv: 60, maxLv: 10, perLv: 1.1, graceSec: 10, coolPerSec: 6 };
let heatSec = 0, heatClicksThisSec = 0;
function heatLv(){ return Math.min(HEAT.maxLv, Math.floor(heatSec / HEAT.secPerLv)); }
function heatMult(){ return Math.pow(HEAT.perLv, heatLv()); }
/* 1秒ティックから呼ぶ */
function tickHeat(){
  const before = heatLv();
  if(heatClicksThisSec > 0) heatSec = Math.min(HEAT.maxLv * HEAT.secPerLv, heatSec + 1);
  else if(Date.now() - lastClickAt > HEAT.graceSec * 1000) heatSec = Math.max(0, heatSec - HEAT.coolPerSec);
  heatClicksThisSec = 0;
  const lv = heatLv();
  if(lv > before && document.body.classList.contains("strip"))
    addStripFloater(miyukeStrip.x > 0 ? miyukeStrip.x : stripVW / 2, STRIP_GROUND - 64, "🔥 応援の熱 Lv" + lv + "（×" + heatMult().toFixed(2) + "）", "#e2543e");
}

/* 応援係（再設計 段階2）: 1秒に cheersPerSec 回ぶん、素の応援（コンボ・会心・熱なし）を実装工程へ送る。
   入力由来として扱い（自動生産に数えない）、あなたのクリックの堰（秒5回）とは別枠。浮き文字は3秒ごとにまとめて出す */
let staffCheerAcc = 0, staffCheerShowAt = 0;
function staffCheerTick(cheersPerSec){
  if(challengeActive("idle") || (S.project && S.project.planning)) return;
  const dp = clickBaseDP() * cheersPerSec;
  prodMuted = true;
  produceDP(dp, "l1");
  prodMuted = false;
  staffCheerAcc += dp * clickProdMult();
  if(delegated("cheer", 3) && !challengeActive("idle")) S.cheerP = (S.cheerP || 0) + cheersPerSec;   /* 段階5: 応援団 Lv3 */
  const now = Date.now();
  if(now - staffCheerShowAt >= 3000 && document.body.classList.contains("strip")){
    staffCheerShowAt = now;
    addStripFloater(miyukeStrip.x > 0 ? miyukeStrip.x - 26 : stripVW / 2, STRIP_GROUND - 50, "📣 +" + fmtClickDP(staffCheerAcc) + "DP", "#c97a2e");
    staffCheerAcc = 0;
  }
}

/* ---------- v2: 応援クリック（コンボ） ---------- */
let comboN = 0, lastClickAt = 0;
let progressPulseUntil = 0;   /* バーにパルス演出を出す期限 (ms) */
function comboMult(){
  return 1 + Math.min(comboCapBonus(), comboN * 0.10);
}
function updateComboUI(){
  /* 帯の形態では表示されない (連打のたびに DOM を書き換えない) */
  if(document.body.classList.contains("strip")) return;
  const el = document.getElementById("combo-info");
  if(!el) return;
  const heat = heatLv() > 0 ? "・🔥熱 Lv" + heatLv() + " ×" + heatMult().toFixed(2) : "";
  if(comboN >= 2){
    el.textContent = "👆 応援コンボ ×" + comboMult().toFixed(1) + "（" + comboN + "連続）" + heat + " 1クリック +" +
      fmtClickDP(clickShownDP() * comboMult() * heatMult()) + "DP";
  } else {
    el.textContent = "👆 帯のみゅけをクリックで応援！ 1クリック +" + fmtClickDP(clickShownDP()) +
      "DP（連続でコンボ、たまにクリティカル×10）";
  }
}
/* 工程の持ち場の手助け（v2.12.1 → 2026-10-27 作り直し）。sakuri「企画実装テストビルド出荷に個別のグラフィック
   （会議室等）があり、そのグラフィックをクリックしてボトルネックを手助けする」「手助けは応援の効果も受けるべき」。
   持ち場をクリックすると、みゅけが手でその工程を進める:
     plan  = 会議室: アイデアを出す（企画中の着工待ち・企画を練る・ゲージの溜まりに効く）
     test  = テスト室: 実装済み → テスト済み
     build = ビルド室: テスト済み → ビルド済み
     ship  = 出荷場: ビルド済み → 出荷（作品の進捗）
   実装の持ち場はみゅけの机で、そこを押すのは従来の応援クリック。
   量には応援の効果がすべて乗る: 威力（てぶくろ）・自動生産連動（肉球）・コンボ（うちわ）・クリティカル（声援）・
   応援の熱・応援フィッシュ・オーバークロック。堰（秒5回のバケツ）・応援P・ゲージの溜まり・連動シナジーも応援クリックと共通 */
const HANDWORK_MULT = 5;
const PLAN_IDEAS_PER_HELP = 0.1;   /* 会議室1回のアイデア（威力 1 倍・倍率なしのとき）。10回で1個 */
const HANDWORK_STAGES = ["plan", "test", "build", "ship"];
let handworkFx: { stage: string; at: number } | null = null;   /* 帯の手作業の絵（揮発） */
/* 応援クリックと同じ倍率（コンボ・熱・フィッシュ・クリティカル・オーバークロック） */
function cheerHelpMult(crit){
  return comboMult() * heatMult() * fishClickMult() * (crit ? 10 : 1) * (feverActive() ? FEVER.clickMult : 1);
}
function handworkClick(stage){
  const now = Date.now();
  comboN = (now - lastClickAt <= 2500) ? comboN + 1 : 1;
  lastClickAt = now;
  S.totals.clicks++;
  handworkFx = { stage, at: now };
  heatClicksThisSec++;
  const crit = Math.random() < critRate();
  if(crit) S.totals.crits++;
  let moved = 0, ideas = 0;
  if(!challengeActive("idle")) S.cheerP = (S.cheerP || 0) + 1;   /* 応援P は押した回数ぶん（段階2） */
  if(!challengeActive("idle") && S.project && clickBucketTake()){
    if(!feverActive()) chargeFever(FEVER.chargePerClick);
    const m = cheerHelpMult(crit);
    if(stage === "plan"){
      ideas = PLAN_IDEAS_PER_HELP * (clickPower() / CLICK_POWER_BASE) * m;
      S.ideas = (S.ideas || 0) + ideas;
      S.totals.handworkIdeas = (S.totals.handworkIdeas || 0) + ideas;
    } else if(!S.project.planning){
      const amt = clickBaseDP() * m * HANDWORK_MULT * clickProdMult();
      const w = S.wip;
      if(stage === "test"){ moved = Math.min(amt, w.code); w.code -= moved; w.tested += moved; }
      else if(stage === "build"){ moved = Math.min(amt, w.tested); w.tested -= moved; w.built += moved; }
      else if(stage === "ship"){ moved = Math.min(amt, w.built); w.built -= moved; creditProject(moved); }
      if(moved > 0){ S.totals.handwork = (S.totals.handwork || 0) + moved; progressPulseUntil = now + 500; }
    }
  }
  clickSynergyTick();
  SoundKit.play("click", { pitch: 1 + Math.min(comboN, 12) * 0.02 + (crit ? 0.25 : 0) });
  updateComboUI();
  checkStamps();
  return { moved, ideas, crit };
}
/* 連動シナジー（端数は貯めて整数化）。応援クリックと持ち場の手助けで共通 */
function clickSynergyTick(){}   /* 段階5: ひらめき連動はゲージの溜まり（chargeFever）へ。研究メモ連動は廃止 */
function cheerClick(bx, by, _part?){   /* 部位ごとの反応は呼び出し側 (hitzones) が担う */
  const now = Date.now();
  comboN = (now - lastClickAt <= 2500) ? comboN + 1 : 1;
  lastClickAt = now;
  S.totals.clicks++;
  const crit = Math.random() < critRate();
  let gain = clickBaseDP() * comboMult() * heatMult() * fishClickMult();   /* F再設計: ハイブリッド式（基礎＋自動生産連動）／段階2: 応援の熱 */
  heatClicksThisSec++;
  if(crit){ gain *= 10; S.totals.crits++; }
  if(feverActive()) gain *= FEVER.clickMult;   /* F再設計: 発動中のクリックは ×3（旧 ×20 は Argon の警告で置換） */
  /* F再設計: バケツを通ったクリックだけが DP を生む（反応・コンボは無条件）。
     流入は案B 読み替え: 直接進捗は 20%、残り 80% は第1工程へ流して
     工程キャップに堰き止めさせる。企画中は全量が仕掛品になる。
     工程中心: さらに溜まった仕掛品を手で運んで出荷する（cheerCarry） */
  /* 応援P は押した回数ぶん貯まる（段階2: sakuri 2026-10-27「秒5回までの制限いらない」。DP の堰は従来どおり） */
  if(!challengeActive("idle")) S.cheerP = (S.cheerP || 0) + 1;
  if(!challengeActive("idle") && clickBucketTake()){   /* 第2ウェーブ K: 完全放置中はクリックが DP を生まない（反応とコンボだけ残る） */
    if(!feverActive()) chargeFever(FEVER.chargePerClick);
    prodMuted = true;
    produceDP(gain * (1 - CLINK.directShare), "l1");
    if(S.project && S.project.planning) produceDP(gain * CLINK.directShare, "l1");
    prodMuted = false;
    if(S.project && !S.project.planning){
      const direct = gain * CLINK.directShare * clickProdMult();
      S.runDP += direct; S.runHandDP = (S.runHandDP || 0) + direct;
      S.totals.lines += direct * 1.05; S.today.lines += direct * 1.05;
      creditProject(direct);
      /* 工程中心: 溜まった仕掛品を手で運んで出荷する（クリック威力 × carryMult ぶん） */
      const carried = S.project ? cheerCarry(gain * CLINK.carryMult * clickProdMult()) : 0;
      progressPulseUntil = Date.now() + 500;
      if(document.body.classList.contains("strip"))
        addStripFloaterSum(bx, by - 22, "adv", direct + carried, v => "+" + fmtClickDP(v) + "DP すすんだ！", "#e8873a");
    }
    if(crit){
      addFloater(bx, by - 12, "CRITICAL! +" + gain.toFixed(0) + "DP", "#d9534f");
      say("クリティカル応援！！ すごいパワーだにゃ！");
    }
  }
  clickSynergyTick();
  /* Sprint 2: 応援の音（コンボで微上昇）と、みゅけのバウンス */
  SoundKit.play("click", { pitch: 1 + Math.min(comboN, 12) * 0.02 + (crit ? 0.25 : 0) });
  startBounce();
  updateComboUI();
  checkStamps();
  tutCheck();   /* 応援クリック数もステージの事実 (2→3 の述語) */
  return crit;
}

