/* ---------- 1秒ティック ---------- */
let keysAcc = 0, cursorAcc = 0, clicksAcc = 0, careTimer = 200;
function tick(){
  if(IS_VIEWER) return;   /* viewer はシミュレーションを持たない (第2層ガード) */
  const now = Date.now();
  /* オフィスティア上昇の小さな祝い (環境アート統合): 事実が進んで帯の家具が
     会社らしくなった瞬間に一度だけ。load() で初期化済みのトラッカーが
     セッション中の上昇だけを拾う (ベテランセーブの読み込みでは祝わない) */
  const otNow = officeTier(S);
  if(officeTierSeen === null) officeTierSeen = otNow;
  else if(otNow > officeTierSeen){
    officeTierSeen = otNow;
    say("オフィスが「" + OFFICE_TIER_NAMES[otNow] + "」らしくなったにゃ！");
    const tCx = stripDeskCX();
    for(let i = 0; i < 8; i++){
      stripConfetti.push({ x: tCx + (Math.random() - 0.5) * 60, y: STRIP_GROUND - 55 - Math.random() * 15,
        vx: (Math.random() - 0.5) * 12, vy: -(7 + Math.random() * 12),
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 8,
        col: CONFETTI_COLS[i % CONFETTI_COLS.length], born: Date.now() });
    }
    if(stripConfetti.length > 80) stripConfetti.splice(0, stripConfetti.length - 80);
  } else if(otNow < officeTierSeen) officeTierSeen = otNow;
  /* Phase C: 受注枠が空いていれば営業が自動で埋める（読み込み直後の回復もここ）。
     大型案件の期限切れもここで静かに処理する */
  if(!S.activeRequest && salesReps().length && now > (S.reqHoldUntil || 0)) autoAcquireRequest();
  if(S.bigDeal && now > S.bigDeal.expiresAt){
    addLog("🌟 大型案件は期限切れになった: "+S.bigDeal.client+"（ペナルティなし）");
    S.bigDeal = null; save();
  }
  sampleIncome(now);   /* Sprint 3: 「あと○○」ヒント用の収入サンプル */
  /* Sprint 2: おかえりの起床（寝ていたみゅけが起きて挨拶する） */
  if(returnWakeAt && now >= returnWakeAt){
    returnWakeAt = 0;
    /* Sprint 4: 帯の起床挨拶にも前回のリリース数を入れる (C2-P2-8) */
    const rel = returnInfo && returnInfo.releases > 0 ? "前回は" + returnInfo.releases + "作品リリースしたにゃ。" : "";
    if(returnInfo && returnInfo.gift > 0)
      say("おはよ〜！ 夢でアイデア浮かんだにゃ（アイデア+" + returnInfo.gift + "）。" + rel + "おかえり！");
    else
      say("おはよ〜！ " + rel + "おかえりなにゃ。続きやるね");
    setState("react_call", 1600);
  }
  /* Sprint 4: おかえりカードは4分で静かに閉じる (C2-P2-8) */
  if(returnShownAt && now - returnShownAt > 4 * 60000){ returnShownAt = 0; closeReturnCard(); }
  tryStartPlanning();
  /* Sprint 4: 開発時間は壁時計ではなくアクティブ稼働秒で数える (C2-P2-1)。
     企画中（着工待ち）の時間は含めない */
  if(S.project && !S.project.planning) S.project.activeSec = (S.project.activeSec || 0) + 1;
  stateTick(now);
  trackLineStamps();
  eventTick(now);
  if(comboN > 0 && now - lastClickAt > 2500){ comboN = 0; updateComboUI(); }
  const coding = ["code","code_slow","think","debug"].includes(catState);
  const ss = staffSums();
  /* 第2ウェーブ I: 活躍度カウンタ（M の役員選出の材料。tick = 1秒ごとに、その猫の
     出力倍率ぶんを積む。表示はまだしない。みゅけ本人は S.staff にいないため対象外） */
  for(const st of S.staff) st.act = (st.act || 0) + staffOutMult(st) * deptMult(st.role);
  /* 可視生産フロー: 工程に入る前の実装バッファを測り、生産分だけを
     アキュムレータへ供給する (演出専用。応援クリックの produceDP は
     tick の外で起きるため、この差分には混ざらない = 設計 #11) */
  const _fc1 = S.wip.code;
  // 基本進捗 (DP/分 → /秒)。プログラミング系の状態でのみ進む
  if(coding) produceDP(BAL.basePerMin/60, "l1");
  // 子ねこボットとプログラマ猫は状態によらず働く
  if((S.upgrades.bot||0) > 0) produceDP(botRate()/60, "l1");
  if(ss.prog > 0) produceDP(ss.prog/60, "l1");
  if(ss.cheer > 0) staffCheerTick(ss.cheer);   /* 再設計 段階2: 応援係 */
  if(delegated("test", 3) && S.bugStock > 0) S.bugStock = Math.max(0, S.bugStock - (ss.byRole.test || 0) / 60);   /* 段階5: テスト部 Lv3 の見回り */
  deptDelegateTick();   /* 段階5: 部署の節目（自動研究・自動育成・自動補充） */
  /* Phase D: 子会社の受動収益。DP は工程に乗り、コインは端数を貯めて直接入る */
  if(S.subs && S.subs.length){
    let subCoin = 0, subDP = 0;
    for(const sub of S.subs){
      const r = subRates(sub), dv = subDiv(sub) / 100;
      subCoin += r.coins * dv; subDP += r.dp;
      if(dv < 1) subReinvest(sub, r.coins * (1 - dv) / 60);   /* 段階6: 配当しない分は子会社が自分に再投資 */
    }
    if(subDP > 0) produceDP(subDP/60, "l1");
    if(subCoin > 0){
      subCoinFrac += subCoin/60;
      const whole = Math.floor(subCoinFrac);
      if(whole > 0){ subCoinFrac -= whole; S.coins += whole; S.totals.coinsEarned += whole; }
      creditIncome("subs", subCoin/60);   /* 段階4: 収入の内訳 */
    }
  }
  const _fd1 = S.wip.code - _fc1;
  // 工程処理: 各ラインが独立の工程容量を持つ (sakuri 設計 2026-10-26:
  // ライン2もライン1と同じ仕組みのハコを持つ)。旧方式 (ライン1優先・ライン2は
  // 残り) は、生産に倍率が乗り工程容量に乗らないため進行したセーブで残りが
  // 恒常的に 0 になり、ライン2が飢餓して永遠に完走しなかった (実機バグ)
  const bugF = bugFactor();
  const caps = { test: testRate()/60, build: buildRate()/60, ship: shipRate()/60 };
  /* 再設計 段階1: ビルドはモジュールの完成を待たない（Wave H の「全モジュール完成まで build 0」は
     放置で L 作品が何時間も止まり、入金ゼロの日を作っていた）。未完成のモジュールは出荷時の品質＝値段にだけ効く */
  const capsL1 = caps;
  /* 企画中プロジェクトは工程に流さない（仕掛品は実装バッファに溜まる） */
  const used = (S.project && S.project.planning)
    ? { test:0, build:0, ship:0 }
    : processPipe(S.wip, capsL1, bugF, creditProject);
  /* 可視生産フローへの供給: 実フローの積分だけが帯の「物の流れ」になる */
  flowFeedTick(_fd1, used);
  // 研究員の研究Pトリクル
  if(ss.rp > 0) S.rp += ss.rp/60;
  /* Sprint 4: ティア1研究を全て終えた研究員は、第二の仕事として余った
     時間の研究メモをアイデアに変える（研究が終わっても失業しない） */
  if(ss.rp > 0 && tier1Done()) S.ideas += ss.rp * 0.6 / 60;
  // お世話係: たまに差し入れ
  if(ss.careW > 0){
    careTimer--;
    if(careTimer <= 0){
      careTimer = 210 + Math.floor(Math.random()*120);
      /* Sprint 4: Lv5以上のお世話係は差し入れが豪華になる（熟練の見返り） */
      const careMaster = S.staff.some(s => s.role === "care" && (s.lv || 1) >= 5);
      S.concentration = Math.min(100, S.concentration + (careMaster ? 18 : 12));
      S.ideas += careMaster ? 2 : 1;
      const carer = S.staff.find(s => s.role === "care");
      addLog("🍵 " + (carer ? carer.name : "お世話係") + "が差し入れを持ってきた（集中力+" + (careMaster ? 18 : 12) + "・アイデア+" + (careMaster ? 2 : 1) + "）");
      if(Math.random() < 0.5) say("差し入れだにゃ！みんな休憩〜");
    }
  }
  // バグのQA処理
  if(S.bugStock > 0){
    const processed = Math.min(S.bugStock, qaRate()/60);
    S.bugStock -= processed;
    if(catState === "debug"){
      if(Math.random() < 0.3 && S.bugStock >= 1){
        S.bugStock = Math.max(0, S.bugStock - 1);
        S.totals.bugsSquashed++; S.today.bugs++;
        if(Math.random()<0.4) say("バグ、たたいたにゃ！");
      }
    }
  }
  /* 拡張ウェーブ G: 総務（ケア）が技術的負債を少しずつ返す（部署Lv は staffSums 経由で効く） */
  if(S.debt > 0 && ss.careW > 0) S.debt = Math.max(0, S.debt - ss.careW * 0.9 / 60);
  checkChallenge();   /* 第2ウェーブ K: 目標の充足は毎秒見る（Lv到達・累計コイン） */
  /* 第2ウェーブ L: 常駐秒を積む */
  S.residentSec = (S.residentSec || 0) + 1;
  ensureTrend();
  /* トレンドは v2.12.1 から出荷の本数で回る（recordRelease → trendOnShip） */
  tickCatalog();    /* 再設計 段階1: 作品棚とシリーズの毎秒売上 */
  tickHeat();       /* 再設計 段階2: 応援の熱 */
  tickCompanyValue();   /* 再設計 段階3: 企業価値の最高値と自動昇格 */
  tickCoinFlow();   /* 🪙/秒 の表示値 */
  // 集中力
  if(coding){
    let drain = 100 / (25*60);   /* 段階5: 椅子は見た目の家具になり、集中力はお世話係に集約 */
    drain *= Math.max(0.45, 1 - 0.15 * ss.careW);   // お世話係が減りを軽くする
    S.concentration = Math.max(delegated("care", 3) ? Math.min(60, S.concentration) : 0, S.concentration - drain);   /* 段階5: 総務部 Lv3 の下支え */
  }
  // 入力ブーストの確定（10秒ごとにまとめて加算し、上限を適用）
  tickBoostCounter++;
  if(tickBoostCounter >= 10){
    tickBoostCounter = 0;
    let boost = keysAcc / BAL.keysPerDP + cursorAcc / BAL.cursorPxPerDP + clicksAcc / BAL.clicksPerDP;
    keysAcc = 0; cursorAcc = 0; clicksAcc = 0;
    /* 再設計 段階2: 実作業は自動生産に連動する（打鍵1回の重みも1分の上限も、自動生産が BAL.boostLinkRef DP/分を
       超えた分だけ比例して伸びる）。固定の 120 DP/分のままだと会社が育つほど実作業が無意味になっていた（理念書3） */
    const boostLink = Math.max(1, autoProdEMA * 60 / Math.max(1e-9, clickProdMult()) / BAL.boostLinkRef);   /* 倍率は produceDP が掛けるので割り戻す（応援の連動分と同じ） */
    boost = boostGate(boost * boostLink, boostLink);
    if(boost > 0) chargeFever(boost * FEVER.chargePerBoostDP);   /* F: 実作業がオーバークロックのゲージを貯める */
    prodMuted = true;   /* F再設計: ブーストは入力由来（自動生産に数えず、発動倍率も二重に掛けない） */
    if(boost > 0.01 && coding) produceDP(boost, "l1");
    else if(boost > 0.01) pendingBoost += boost;
    if(pendingBoost > 0 && coding){ produceDP(pendingBoost, "l1"); pendingBoost = 0; }
    prodMuted = false;
  }
  /* F再設計: 自動生産レートの EMA を毎秒更新（クリック連動ボーナスの基礎） */
  autoProdEMA = autoProdEMA * 0.9 + autoProdSecAcc * 0.1;
  autoProdSecAcc = 0;
  tutCheck();   /* チュートリアル導線: 事実ベースの進行チェック (毎秒) */
  renderHeader();
}
let tickBoostCounter = 0, pendingBoost = 0;

