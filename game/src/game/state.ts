/* ---------- 状態マシン ---------- */
let catState = "code", stateUntil = Date.now() + 4000, lastInputAt = Date.now();
/* アニメーション用: 現在の状態に入った時刻（ランタイムのみ・セーブしない） */
let stateEnteredAt = Date.now();
const PLAY_STATES = ["yarn","groom","watch","chase","zoomies","duckplay","treasure"];
function availablePlays(){
  return PLAY_STATES.filter(p =>
    (p!=="duckplay" || S.research.res_duckplay) &&
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
    /* res_plant の効果は正確に +20%（22 → 26.4） */
    S.concentration = Math.min(100, S.concentration + (S.research.res_plant ? 26.4 : 22));
    S.ideas += (catState==="treasure" ? 4 : 2);
    /* Sprint 4: 宝探しはたまに小銭も見つける */
    if(catState==="treasure" && Math.random() < 0.35){
      const c = 10 + Math.floor(Math.random()*15);
      S.coins += c; S.totals.coinsEarned += c;
      say("宝探しで "+c+"🪙 見つけたにゃ！");
      addLog("🗺️ 宝探しで "+c+"🪙 を見つけた");
    }
  }
  if(catState === "think"){ S.ideas += 1 + (S.upgrades.monitor||0); }
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
function spawnFish(now){
  fishEvent = { x: 34 + Math.random()*172, y: 40 + Math.random()*86, until: now + 10000 };
  /* Sprint 4: 帯でも魚が見える・触れる。帯側の位置は帯の仮想座標で別に持つ
     （stripFish は帯レンダラが初期化し、帯の更新で泳がせる） */
  stripFish = null;
  say("✨ 金のひらめきフィッシュが現れたにゃ！クリックで捕まえて！");
  addLog("✨ 金のひらめきフィッシュが現れた");
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
  fishEvent = null;
  nextFishAt = Date.now() + (150000 + Math.random()*120000) * fishIntervalMul();   /* Sprint 4: 幸運のヒレ */
  const coins = Math.round(80 * dustMult() * workScale());   /* 仕事の桁ぶん報酬も伸びる */   // Sprint 1: セッション中のイベント収入を厚く
  S.rp += 2; S.coins += coins; S.totals.coinsEarned += coins;
  S.totals.goldFish++;
  SoundKit.play("fishCatch");
  addFloater(bx, by - 10, "🐟 +2🔬 +" + fmt(coins) + "🪙", "#d9a41a");
  say("金のひらめきフィッシュ、捕まえたにゃ！！ 研究P+2");
  addLog("🐟 金のひらめきフィッシュを捕まえた（研究P+2 / +"+coins+"🪙）");
  checkStamps(); save();
  tutCheck();
}
function splatBug(i, bx, by){
  bugEvent.bugs.splice(i, 1);
  SoundKit.play("bugSquash");
  const squash = 6 * workScale();   /* 仕事の桁ぶん報酬も伸びる */
  S.coins += squash; S.totals.coinsEarned += squash;
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
    const sweep = 20 * workScale();
    S.coins += sweep; S.totals.coinsEarned += sweep;
    bugEvent = null;
    nextBugAt = Date.now() + 180000 + Math.random()*150000;
    say("バグ全滅！ボーナス+" + fmt(sweep) + "コインにゃ");
    addLog("🐛 バグ大量発生を全て叩いた（ボーナス+" + fmt(sweep) + "🪙）");
  }
  checkStamps(); save();
}

/* ---------- v2: 応援クリック（コンボ） ---------- */
let comboN = 0, lastClickAt = 0, ideaFrac = 0, rpFrac = 0;
let progressPulseUntil = 0;   /* バーにパルス演出を出す期限 (ms) */
function comboMult(){
  return 1 + Math.min(comboCapBonus(), comboN * 0.10);
}
function updateComboUI(){
  const el = document.getElementById("combo-info");
  if(!el) return;
  if(comboN >= 2){
    el.textContent = "👆 応援コンボ ×" + comboMult().toFixed(1) + "（" + comboN + "連続） 1クリック +" +
      fmtClickDP(clickShownDP() * comboMult()) + "DP";
  } else {
    el.textContent = "👆 帯のみゅけをクリックで応援！ 1クリック +" + fmtClickDP(clickShownDP()) +
      "DP（連続でコンボ、たまにクリティカル×10）";
  }
}
function cheerClick(bx, by, _part?){   /* 部位ごとの反応は呼び出し側 (hitzones) が担う */
  const now = Date.now();
  comboN = (now - lastClickAt <= 2500) ? comboN + 1 : 1;
  lastClickAt = now;
  S.totals.clicks++;
  const crit = Math.random() < critRate();
  let gain = clickBaseDP() * comboMult();   /* F再設計: ハイブリッド式（基礎＋自動生産連動） */
  if(crit){ gain *= 10; S.totals.crits++; }
  if(feverActive()) gain *= FEVER.clickMult;   /* F再設計: 発動中のクリックは ×3（旧 ×20 は Argon の警告で置換） */
  /* F再設計: バケツを通ったクリックだけが DP を生む（反応・コンボは無条件）。
     流入は案B 読み替え: 直接進捗は 20%、残り 80% は第1工程へ流して
     工程キャップに堰き止めさせる。企画中は全量が仕掛品になる。
     工程中心: さらに溜まった仕掛品を手で運んで出荷する（cheerCarry） */
  if(!challengeActive("idle") && clickBucketTake()){   /* 第2ウェーブ K: 完全放置中はクリックが DP を生まない（反応とコンボだけ残る） */
    if(!feverActive()) chargeFever(FEVER.chargePerClick);
    S.cheerP = (S.cheerP || 0) + 1;   /* 応援P: DP が付いたクリック1回につき1（バケツで秒5回まで） */
    prodMuted = true;
    produceDP(gain * (1 - CLINK.directShare), "l1");
    if(S.project && S.project.planning) produceDP(gain * CLINK.directShare, "l1");
    prodMuted = false;
    if(S.project && !S.project.planning){
      const direct = gain * CLINK.directShare * clickProdMult();
      S.runDP += direct;
      S.totals.lines += direct * 1.05; S.today.lines += direct * 1.05;
      creditProject(direct);
      /* 工程中心: 溜まった仕掛品を手で運んで出荷する（クリック威力 × carryMult ぶん） */
      const carried = S.project ? cheerCarry(gain * CLINK.carryMult * clickProdMult()) : 0;
      progressPulseUntil = Date.now() + 500;
      addFloater(bx, by - 22, "+" + (direct + carried).toFixed(1) + "DP すすんだ！" + (carried > 0 ? "（📦 手で運んだ）" : ""), "#e8873a");
    }
    if(crit){
      addFloater(bx, by - 12, "CRITICAL! +" + gain.toFixed(0) + "DP", "#d9534f");
      say("クリティカル応援！！ すごいパワーだにゃ！");
    }
  }
  // 連動シナジー（端数は貯めて整数化）
  ideaFrac += 0.02 * (S.clickUp.synidea||0);
  if(ideaFrac >= 1){ const n = Math.floor(ideaFrac); ideaFrac -= n; S.ideas += n; }
  rpFrac += 0.004 * (S.clickUp.synrp||0);
  if(rpFrac >= 1){ const n = Math.floor(rpFrac); rpFrac -= n; S.rp += n; addLog("研究メモ連動で研究P+"+n); }
  /* Sprint 2: 応援の音（コンボで微上昇）と、みゅけのバウンス */
  SoundKit.play("click", { pitch: 1 + Math.min(comboN, 12) * 0.02 + (crit ? 0.25 : 0) });
  startBounce();
  updateComboUI();
  checkStamps();
  tutCheck();   /* 応援クリック数もステージの事実 (2→3 の述語) */
  return crit;
}

