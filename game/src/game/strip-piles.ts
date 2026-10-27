/* ---------- 可視生産: 工程の「山」(静止画の正直さ) ----------
   山の高さは stageStatus() の frac そのもの — メニューの仕掛品バーと
   常に同じ事実を指す。B=実装バッファ (テスト待ちカード)、C=テスト済み
   (ビルド待ちカード)、D=ビルド済み (出荷待ちの箱)。赤変は stageStatus の
   lamp (B はバグ過多の赤滲みも併せる) に従い、判定を二重実装しない */
function pileModel(){
  const st = stageStatus();
  const byId: Record<string, any> = {};
  for(const s of st) byId[s.id] = s;
  const bugF = bugFactor();
  const capC = Math.max(60, testRate() * bugF * 2), capT = Math.max(60, buildRate() * 2);
  return {
    code:  { frac: byId.code.frac,  n: Math.round(byId.code.frac * 8),
             red: byId.code.lamp === "red" || S.bugStock > 8 },
    test:  { frac: byId.test.frac,  n: Math.round(byId.test.frac * 8),
             red: byId.test.lamp === "red" },
    build: { frac: byId.build.frac, n: Math.round(byId.build.frac * 5),
             red: byId.build.lamp === "red" },
    l2: S.line2.unlocked ? {
      codeN: Math.round(Math.min(1, S.line2.wip.code / capC) * 4),
      testN: Math.round(Math.min(1, S.line2.wip.tested / capT) * 4)
    } : null
  };
}
/* カード1枚 (icon_card / テスト済みは icon_card_ok)。
   bundle は束ね表示: 後ろにずらした影カードで厚みを付ける (§3.2) */
function drawFlowCard(x, y, bundle, tickMark, _seed?){
  const layers = bundle >= 4 ? 2 : bundle >= 2 ? 1 : 0;
  const cardNm = tickMark ? "icon_card_ok" : "icon_card";
  /* カードの絵 (12×8、下端中央アンカー)。束は後ろにずらして重ねる */
  for(let l = layers; l >= 0; l--) sDrawSprite(cardNm, x - l * 1.3, y + 4 - l * 1.3, 1);
}
/* 山の格子: 横2列×段。idx は下段から。カード系 (B/C) と箱系 (D) で寸法が違う */
function pileSlotPos(cx, idx, boxKind){
  const col = idx % 2, row = Math.floor(idx / 2);
  if(boxKind){
    /* 2026-10-25: icon_box は 28×28 (sakuri 作画・可視部は下端から 8 行上) になったため、
       接地と段ピッチを可視部基準に補正 (旧 16×16 前提のピッチでは箱が浮いて見える) */
    /* 2026-10-26: prop_ship が 48×48 (Codex 描き直し) になり台の天面が G-16 へ
       上がったため、スタック全体を 12 上へ (旧 +3.2 → -8.8) */
    if(idx === 4) return { x: cx, yb: STRIP_GROUND - 8.8 - 2 * 9.2 };   /* 5個目は天辺中央 */
    return { x: cx + (col === 0 ? -6.8 : 6.8), yb: STRIP_GROUND - 8.8 - row * 9.2 };
  }
  return { x: cx + (col === 0 ? -5.9 : 5.9), yb: STRIP_GROUND - 3.5 - row * 7.6 };
}
function drawStripPiles(){
  const G = STRIP_GROUND, m = pileModel();
  /* --- B: QA トレイ (机と研究机の間) --- */
  const bx = stripQAX();
  /* 2026-10-27: トレイ・台・カードは絵。詰まりは赤線ではなく信号柱 (strip-visible.ts) と
     山の左に置く三角コーンで見せる */
  sDrawSprite("prop_qa_tray", bx, G, 1);
  if(m.code.red) sDrawSprite("prop_jam_cone", bx - 21, G, 1);
  for(let i = 0; i < m.code.n; i++){
    const p = pileSlotPos(bx, i, false);
    drawFlowCard(p.x, p.yb - 3.25, 1, false, i * 0.37);
  }
  /* バグ滞留は山の上ではなく、帯の地面を這う在庫バグとして描く (strip-bugs.ts) */
  if(m.code.red) stripHitRects.piles.push({ x: bx - 15, y: Math.min(G - 12, pileTopY("code") - 6), w: 30, h: G - Math.min(G - 12, pileTopY("code") - 6), stage: "code" });
  /* --- C: ビルド置き場 (サーバ予定地の足元。木箱台) --- */
  const cxp = stripBuildX();
  sDrawSprite("prop_build_stand", cxp, G, 1);
  if(m.test.red) sDrawSprite("prop_jam_cone", cxp - 21, G, 1);
  for(let i = 0; i < m.test.n; i++){
    const p = pileSlotPos(cxp, i, false);
    drawFlowCard(p.x, p.yb - 3.25, 1, true, i * 0.53);
  }
  if(m.test.red) stripHitRects.piles.push({ x: cxp - 14, y: Math.min(G - 12, pileTopY("test") - 6), w: 28, h: G - Math.min(G - 12, pileTopY("test") - 6), stage: "test" });
  /* --- D: 出荷スタック (箱の積み場 + 「出荷」札) --- */
  const dx = stripShipX();
  /* 2026-10-26: prop_ship は Codex 描き直し (48×48・「出荷」の文字も絵の側)。
     コード描きのフォールバックと文字載せは廃止 (アートへのスクリプト混入禁止) */
  sDrawSprite("prop_ship", dx + 2, G, 1);
  /* Phase D: 子会社がある間だけ、出荷スポットの隣に別館の看板が立つ。
     第2ウェーブ J: オフィスグレード II 以上では金の本社看板に差し替わる */
  if(S.subs && S.subs.length){
    if(legacyGrade() >= 2 && hasSprite("prop_sign_gold")) sDrawSprite("prop_sign_gold", dx - 42, G, 1);
    else if(hasSprite("prop_annex_sign")) sDrawSprite("prop_annex_sign", dx - 42, G, 1);
  }
  if(m.build.red) sDrawSprite("prop_jam_cone", dx - 32, G, 1);
  for(let i = 0; i < m.build.n; i++){
    const p = pileSlotPos(dx, i, true);
    sDrawSprite("icon_box", p.x, p.yb, 0.78);
  }
  /* パッケージ節目: 完成箱が次のスロットに光って現れる (実イベントの残像) */
  if(stripNow < stripPkgGlowUntil){
    const gi = m.build.n;
    const p = gi === 4 ? { x: dx, yb: G + 3.2 - 2 * 9.2 } : pileSlotPos(dx, gi, true);
    if(gi < 5){
      sDrawSprite("icon_box", p.x, p.yb, 0.78);
      if(frame % 6 < 3) sDrawNine("fx_shelf_glow", p.x - 7, p.yb - 15.6, 14, 11.4, 3, 3);
    }
  }
  if(m.build.red) stripHitRects.piles.push({ x: dx - 16, y: Math.min(G - 12, pileTopY("build") - 6), w: 32, h: G - Math.min(G - 12, pileTopY("build") - 6), stage: "build" });
}
/* 第2ラインのミニフロー: 第2机の天面左端に小さい山2つ (実装/テスト済み) */
function drawStripLine2Piles(){
  if(!S.line2.unlocked) return;
  const G = STRIP_GROUND, m = pileModel();
  if(!m.l2) return;
  /* バッチ14: 新 prop_desk2 (64×64) の天板は ×2 接地で G-33 付近。
     ミニ山はノートPC (dcx-22..+18) を避けて天板の左右に置く */
  const topY = spriteSize("prop_desk2") ? G - 33 : G - 16;
  const dcx = stripDesk2CX();
  const mini = (cxOff, n, tickMark) => {
    for(let i = 0; i < n; i++) sDrawSprite(tickMark ? "icon_card_ok" : "icon_card", dcx + cxOff, topY - i * 4, 1);
  };
  mini(-38, m.l2.codeN, false);
  mini(34, m.l2.testN, true);
}
/* 移動中の物 (描画層④: 家具より手前・キャラより後ろ) */
function drawStripFlowItems(){
  const G = STRIP_GROUND;
  for(const it of stripFlow){
    if(it.age < 0) continue;
    const t = Math.min(1, it.age / it.dur);
    const x = it.x0 + (it.x1 - it.x0) * t;
    let y = it.y0 + (it.y1 - it.y0) * t - Math.sin(t * Math.PI) * (it.arc || 0);
    if(it.kind === "card"){
      drawFlowCard(x, y, it.bundle || 1, !!it.tick, it.seed || 0);
    } else if(it.kind === "morph"){
      if(t < 0.5) drawFlowCard(x, y, it.bundle || 1, true, it.seed || 0);
      else sDrawSprite("icon_box", x, y + 6.5, 0.8);
    } else if(it.kind === "slide"){
      sctx.save();
      if(t > 0.8) sctx.globalAlpha = 1 - (t - 0.8) / 0.2;
      sDrawSprite("icon_box", x, G - 1, 0.85);
      sctx.restore();
    } else if(it.kind === "note"){
      sDrawSprite("icon_note_" + ((it.ni || 0) % 4), x, y + 6, 2);
    } else if(it.kind === "mote"){
      y = it.y0 - t * 15;
      sctx.save(); sctx.globalAlpha = 1 - t;
      sDrawSprite("icon_mote", x, y + 6, 2);
      sctx.restore();
    } else if(it.kind === "idea"){
      sctx.save();
      if(t > 0.7) sctx.globalAlpha = 1 - (t - 0.7) / 0.3;
      sDrawSprite("icon_idea", x, y + 5, 0.7);
      sctx.restore();
    }
  }
}
/* 詰まった山のクリック → 対策を開く (棚・ボードと同じ open_menu 経路) */
function openBottleneckFixPanel(){
  if(IS_VIEWER){ gotoBottleneckFix(); return; }
  if(!document.body.classList.contains("strip")){ gotoBottleneckFix(); return; }
  const f = bottleneckFix();
  tauriCmd("open_menu", { tab: f ? f.tab : "factory" });
}

/* サーバーラック（0.55W の空きスロット）: tier>=2 (開発スタジオ規模) かつ
   CIマシン所持の二重ゲート。48×64 を 1× で接地 (2× では高さ予算 90 を超える)。
   ビルド置き場 (0.53W) とは左下が僅かに重なるが、ラックは家具層・山は
   その手前に描かれるため「ラックの足元に仕掛品が積まれる」自然な奥行きになる。
   装飾のみ: ヒット矩形は持たない (クリック透過を維持) */
function drawStripServerRack(){
  const G = STRIP_GROUND, rx = stripRackCX();
  /* 2026-10-27: CI の段で 小型サーバ → ラック → ラック2台 (strip-visible.ts) */
  if(ciSmallServer()){
    sDrawSprite("prop_ci_1", rx, G, 1);
    stripObjArt.rack = { name: "prop_ci_1", gx: rx, gy: G, s: 1 };
    stripHitRects.rack = { x: rx - 12, y: G - 32, w: 24, h: 32 };
    return;
  }
  const racks = ciRackCount();
  if(!racks) return;
  if(racks >= 2){ sShadow(rx - 46, G - 0.5, 44); sDrawSprite("prop_server_rack", rx - 46, G, 1); }
  sShadow(rx, G - 0.5, 44);
  sDrawSprite("prop_server_rack", rx, G, 1);
  stripObjArt.rack = { name: "prop_server_rack", gx: rx, gy: G, s: 1 };
  /* Stage 3: ラッククリック → 工場タブ */
  stripHitRects.rack = { x: rx - 24, y: G - 64, w: 48, h: 64 };
}

/* イーゼル看板（ゾーン E 0.20W, §c.5）: 旧ポスター（prop_wall_1）の家具化。高さ 26 単位級 */
function drawStripEasel(){
  const G = STRIP_GROUND;
  /* カレンダーとの衝突回避込みの実描画位置 (stripEaselDrawX に集約) */
  const ex = stripEaselDrawX();
  sShadow(ex, G - 0.5, 20);
  /* tier>=1: イーゼルは段ボール箱の山 (prop_archive_boxes) に置き換わる。
     ポスター (prop_wall_1) の表示機能は失わず、箱の前面にテープ留めした
     形で残す (半分の大きさで中段の箱の正面に貼る) */
  if(officeTier(S) >= 1 && sDrawSprite("prop_archive_boxes", ex, G, 1)){
    sDrawSprite("prop_wall_1", ex, G - 9, 0.5);
    return;
  }
  sDrawSprite("prop_easel", ex, G, 1);   /* A字の脚と横木。ポスターを立てかける */
  sDrawSprite("prop_wall_1", ex, G - 10, 0.9);   /* 横木 (原寸 row 17) に立てかける */
}
/* トロフィー台（ゾーン E 0.75W, §c.5）: 旧表彰プレート（prop_wall_3）の家具化。高さ 30 単位級 */
function drawStripTrophy(){
  const G = STRIP_GROUND, tx = stripTrophyCX();
  sShadow(tx, G - 0.5, 22);
  sDrawSprite("prop_trophy_stand", tx, G, 1);
  sDrawSprite("prop_wall_3", tx, G - 10, 0.8);
  /* Stage 3: トロフィー台クリック → 統計タブ */
  stripHitRects.trophy = { x: tx - 12, y: G - 24, w: 24, h: 24 };
}
/* 棚クリック → 管理ウィンドウの作品棚タブを開く (R12: 物から管理への導線)。
   2ウィンドウ化: 帯は変形しない。Rust の open_menu にタブ指定で任せる
   (帯に残るのはシミュレーションだけ。タブの所有は menu 側) */
/* 帯の家具オブジェクト → 管理ウィンドウの該当タブを開く共通導線 (Stage 3) */
function openTabPanel(tab){
  if(IS_VIEWER){ switchTab(tab); return; }
  if(!document.body.classList.contains("strip")){ switchTab(tab); return; }
  tauriCmd("open_menu", { tab: tab });
}
function openShelfPanel(){ openTabPanel("shelf"); }
/* プロジェクトボードのクリック → 管理ウィンドウのプロジェクトタブを開く
   (openShelfPanel と同じ open_menu / pending_tab 経路。帯は変形しない) */
function openProjPanel(){ openTabPanel("proj"); }

let stripLastFrameAt = 0;   /* 前フレームの時刻 (dt 計算用。0 = 初回) */
function renderStrip(){
  if(!sctx) return;
  stripResize();
  const now = Date.now();
  stripNow = now;
  const dt = Math.min(0.5, (now - (stripLastFrameAt || now)) / 1000);
  stripLastFrameAt = now;
  stripUpdate(dt);
  /* ヒットゾーン記録をこのフレーム分にリセット（吹き出しは描画時に再設定される） */
  stripHitRects.miyuke = null; stripHitRects.staff = [];
  stripHitRects.duck = null; stripHitRects.bubble = null;
  stripHitRects.fish = null; stripHitRects.bugs = []; stripHitRects.stockBugs = []; stripHitRects.shelf = null;
  stripHitRects.board = null; stripHitRects.board2 = null; stripHitRects.piles = [];
  stripHitRects.snack = null;
  stripHitRects.research = null; stripHitRects.rack = null; stripHitRects.trophy = null;
  stripHitRects.calendar = null; stripHitRects.memo = null; stripHitRects.phone = null;
  stripHitRects.megaphone = null; stripHitRects.toolbox = null;
  stripHitRects.fever = null;
  stripObjArt = {}; stripStaffArt = [];
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, stripCv.width, stripCv.height);
  sctx.setTransform(stripScale, 0, 0, stripScale, 0, 0);
  const G = STRIP_GROUND, cx = stripDeskCX();
  stripHitRects.desk = { x: cx - 62, y: G - 31, w: 124, h: 35 };  /* 机板＋PC */
  const coding = catState === "code" || catState === "code_slow";
  const atDesk = stripAtDesk();
  /* --- 家具レイヤー (R3 の固定順: ラグ・影 → 背面物 → 家具本体) ---
     地面は「線」であって「面」にしない (R1): 全幅の地面帯は敷かず、
     ラグは各家具クラスタの下だけ。歩行者はこの後に描くので常に家具の手前 (R2) */
  drawStripShelf();                                 /* B: 作品棚＋柵 (②背面物+③) */
  if(hasResearcher()) drawStripResearchStation();   /* C: 研究机 */
  if(S.line2.unlocked) drawStripDesk2();            /* D: 第2ライン机 */
  if(S.line2.unlocked) drawStripProjectBoard2();   /* D': 第2ラインのプロジェクトボード */
  drawStripServerRack();                            /* E': サーバーラック (tier>=2 + CIマシン) */
  if(S.stamps.first_release) drawStripEasel();      /* E: イーゼル */
  if(S.stamps.prestige1) drawStripTrophy();         /* E: トロフィー台 */
  /* --- デスクゾーン（常設のワークステーション） --- */
  /* §c.1: 机クラスタのラグ 150×4。tier>=1 では疲労軽減マット (prop_mat) に
     差し替わる (アンカー (cx, G+3) で従来のラグ矩形と同フットプリント) */
  if(!(officeTier(S) >= 1 && sDrawSprite("prop_mat", cx, G + 3, 1))) sRug(cx, 150);
  sShadow(cx, G - 0.5, 122);
  drawStripProjectBoardMain();                      /* 机の背後のプロジェクトボード (支柱は机より背面) */
  /* tier>=1: オフィスチェアを みゅけ の背後 (家具層) に置く。猫と PC は
     この後に描くので常に椅子より手前 */
  /* 2026-10-27: 椅子は「ふかふか椅子」の Lv で段が変わる (strip-visible.ts) */
  const chairNm = chairSpriteName();
  if(chairNm) sDrawSprite(chairNm, cx + 12, G, 2);
  /* 主机の天板: tier>=1 ではラミネート (desk_laminate_main 116×3) */
  sDrawSprite(officeTier(S) >= 1 ? "desk_laminate_main" : "desk_wood_main", cx, G, 1);
  drawStripDeskUpgrades(cx);   /* サブモニタ・キーボード・企画の付箋ボード (アップグレードの段) */
  /* PC はコーディング中も含め常時表示（みゅけより後ろのレイヤー）。
     ただし sakuri作画 code アニメのフレームが解決できる間は、ポーズ内のモニタが
     PC を担うので prop_pc は描かず、進捗表示はポーズ内モニタへ重ねる（二重モニタ防止）。
     みゅけの接地アンカー (cx+6, G-2) は従来のコーディング配置と同一に保つ */
  const codeFrame = (coding && atDesk) ? catSprite("miyuke_code_a") : null;
  const sakuriCoding = !!codeFrame && codeFrame !== "miyuke_code_a" && hasSprite(codeFrame);
  if(!sakuriCoding){
    drawStripPC(cx - 34, G - 2);
    drawStripPCScreen(cx - 34, G - 2);   /* Sprint 4: モニタ内に実プロジェクトの進捗 */
  } else {
    drawStripCodeScreen(cx, G);   /* バッチ2: ポーズ内モニタへ進捗表示 */
  }
  /* 机上コーヒー（仕事場クラスタの仕上げ §c.1）と卓上カレンダー（§c.5:
     旧カレンダーはクラスタ内小物として机の脇に。高さ約14単位・独立ゾーンなし）
     バッチ11: sakuri作画 prop_coffee (28×28・湯気2フレーム 600ms 交互) に差し替え。
     湯気の時計は duckSprite と同じ絶対時刻。原画は内容が row 25 までで下2行が
     透明なため、ソーサーの下端が天板 (G-3) に接するようアンカーを 2*scale
     押し下げてある。家具層の小物なのでヒットゾーンは持たない */
  const coffeeSpr = ANIMS.prop_coffee ? animFrameAt("prop_coffee", Date.now()) : "prop_coffee";
  const coffeePl = propPlace("coffee");
  sDrawSprite(coffeeSpr, coffeePl.cx, coffeePl.baseY, 1.25);
  /* 2026-10-25: おやつ箱 (sakuri 指示でメニューのボタンから移設)。机の右足元に置く。
     クールダウン中は蓋が閉まった絵 (prop_snackbox_shut) になって「まだ」を絵で示す */
  const snackReadyNow = Date.now() >= snackReadyAt;
  const snackPl = propPlace("snack");
  sDrawSprite(snackReadyNow ? "prop_snackbox" : "prop_snackbox_shut", snackPl.cx, snackPl.baseY, 1);
  stripObjArt.snack = { name: snackReadyNow ? "prop_snackbox" : "prop_snackbox_shut", gx: snackPl.cx, gy: snackPl.baseY, s: 1 };
  if(snackReadyNow && !motionReduced()){
    /* 開けられる合図: 蓋の上でキラキラ (第1次の fx_spark の3コマを繰り返す) */
    const ph = frame % 90;
    if(ph < 45) sDrawSprite("fx_spark_" + Math.min(2, Math.floor(ph / 15)), snackPl.cx, snackPl.baseY - 21, 1);
  }
  stripHitRects.snack = { x: snackPl.cx - 14, y: snackPl.baseY - 25, w: 28, h: 25 };
  if(S.stamps.releases10){
    sDrawSprite("prop_wall_2", cx - 70, G, 0.6);
    /* Stage 3: 卓上カレンダークリック → 統計タブ (日々の記録) */
    stripHitRects.calendar = { x: cx - 79, y: G - 16, w: 18, h: 16 };
  }
  /* Stage 3: メガホン (応援タブ) — 既定は机の左足元。Phase E で独立配置 */
  const megaPl = propPlace("megaphone");
  if(!tutTabLocked("click") && sDrawSprite("prop_megaphone", megaPl.cx, megaPl.baseY, 1)){
    stripObjArt.megaphone = { name: "prop_megaphone", gx: megaPl.cx, gy: megaPl.baseY, s: 1 };
    stripHitRects.megaphone = { x: megaPl.cx - 12, y: megaPl.baseY - 24, w: 24, h: 24 };
  }
  /* Stage 3: 工具箱 (設定タブ) — 既定は机の下。更新がある時は赤リボン+金パルス。
     Phase E で独立配置 (机や棚の上にも載る) */
  const toolPl = propPlace("toolbox");
  if(sDrawSprite("prop_toolbox", toolPl.cx, toolPl.baseY, 1)){
    stripObjArt.toolbox = { name: "prop_toolbox", gx: toolPl.cx, gy: toolPl.baseY, s: 1 };
    stripHitRects.toolbox = { x: toolPl.cx - 12, y: toolPl.baseY - 24, w: 24, h: 24 };
    if(upd.status === "available" || upd.status === "downloading" || upd.status === "ready"){
      if(blinkOn(50, 30)) sDrawSprite("icon_update_ribbon", toolPl.cx, toolPl.baseY - 17, 1);   /* 更新ありの赤いリボン */
    }
  }
  /* F: オーバークロック・ゲージ（机の右脇に立つ縦の筒 prop_fever_gauge 15×44）。
     溜まり具合は中身の絵の色＋量 (青＝溜め中、金＝満タン、赤＝発動中で残り時間)。
     中身の窓は筒の原寸 x3〜11, y3〜40 = 帯で (gx-4.5, G-41)〜(gx+4.5, G-3) */
  {
    const gx = stripDeskCX() + 88, gh = 38, wy = G - 3;
    const fActive = feverActive();
    const fFrac = fActive ? Math.max(0, (feverUntil - Date.now()) / FEVER.durationMs)
                          : (S.fever ? (S.fever.gauge || 0) / 100 : 0);
    sDrawSprite("prop_fever_gauge", gx, G, 1);
    if(fFrac > 0){
      const fh = Math.max(4, Math.round(gh * Math.min(1, fFrac)));
      sDrawNine("ui_gauge_fill_" + (fActive ? "red" : fFrac >= 1 ? "gold" : "blue") + "_3v", gx - 4.5, wy - fh, 9, fh, 0, 2);
    }
    if(fFrac >= 1 && !fActive && blinkOn(50, 30)) sDrawSprite("icon_bolt", gx, G - 43, 1);
    if(fActive && frame % 24 === 0)   /* 発動中は机から火花（軽い演出・既存の仕組み） */
      stripSparks.push({ x: stripDeskCX() - 20 + Math.random() * 40, y: G - 34, born: Date.now() });
    stripHitRects.fever = { x: gx - 7, y: G - 52, w: 14, h: 52 };
  }
  /* G: 技術的負債の散らかり（机の周りの書類の山。負債の帯域で増える —
     ダイジェティック表現: 数字を見なくても「荒れてきた」が分かる） */
  {
    const dNow = S.debt || 0;
    const stacks = dNow >= 250 ? 3 : dNow >= 120 ? 2 : dNow >= 40 ? 1 : 0;
    const spots = [stripDeskCX() - 128, stripDeskCX() + 122, stripDeskCX() - 148];
    for(let i = 0; i < stacks; i++){
      const px = spots[i];
      sDrawSprite("prop_debt_pile_" + (stacks - i), px, G, 1);   /* 2026-10-27: 帯域ごとの山の絵 (3 は箱も倒れている) */
    }
  }
  /* --- 可視生産: 工程の山 (家具層) と第2ラインのミニ山、移動中の物 (層④) --- */
  drawStripLineUpgrades();     /* 自動テスト機・梱包機 (アップグレードの段)。山の背後に立つ機械 */
  drawStripPiles();
  drawStripLine2Piles();
  drawStripStationSignals();   /* 工程ごとの信号柱 (緑/黄/赤) */
  drawStripFlowItems();
  updateStripBots(dt);
  drawStripBots();             /* 子ねこボット (Lv の台数だけ運搬) */
  /* --- みゅけ --- */
  if(miyukeTrip){
    /* v2.3.3: 旅程中は移動レイヤーが姿を握る（移動中=歩行フレーム、滞在中=アイドル） */
    const gx = miyukeStrip.x;
    sShadow(gx, G - 0.5, 74);
    if(miyukeStrip.moving && hasWalkArt()) sDrawMiyukeWalking(gx, G);
    else sDrawMiyuke("miyuke_idle", gx, G, SPRITE_SCALES.strip.miyuke);
  } else if(atDesk){
    if(coding){
      if(sakuriCoding){
        if(!sDrawMiyuke("miyuke_code_a", cx + 6, G - 2, SPRITE_SCALES.strip.miyuke)) sDrawMiyuke("miyuke_idle", cx + 12, G - 2, SPRITE_SCALES.strip.miyuke);
      } else {
        const nm = codeFrameBit() ? "miyuke_code_a" : "miyuke_code_b";
        if(!sDrawMiyuke(nm, cx + 6, G - 2, SPRITE_SCALES.strip.miyuke)) sDrawMiyuke("miyuke_idle", cx + 12, G - 2, SPRITE_SCALES.strip.miyuke);
      }
    } else {
      const nm = catState === "think" ? "miyuke_think" : catState === "debug" ? "miyuke_debug" : "miyuke_sleep";
      sDrawMiyuke(nm, cx + 12, G - 2, SPRITE_SCALES.strip.miyuke);
      /* バッチ2: sleep アニメ (Z 内蔵) 再生中は手続き Z を重ねない */
      if(catState === "nap" && catSprite("miyuke_sleep") === "miyuke_sleep") drawStripZ(cx + 40, G - 76);
    }
  } else if(stripIsDeskState()){
    /* 机へ移動中（歩行アートがある時は歩行フレームで戻る） */
    sShadow(miyukeStrip.x, G - 0.5, 74);
    if(miyukeStrip.moving && hasWalkArt()) sDrawMiyukeWalking(miyukeStrip.x, G);
    else sDrawMiyuke("miyuke_idle", miyukeStrip.x, G + (miyukeStrip.moving && frame % 2 ? -1 : 0), SPRITE_SCALES.strip.miyuke);
  } else {
    const gx = miyukeStrip.x;
    sShadow(gx, G - 0.5, 74);
    /* v2.3.6(予定) B: 移動中は移動レイヤーが勝つ。遊び場への移動中に
       idle/遊びポーズのまま滑って見えるのが実機で指摘された (sakuri)。
       到着して静止したら状態ポーズに戻る。歩行アートが無い環境では
       従来どおり状態ポーズ+ボブで滑る (フォールバック温存) */
    if(miyukeStrip.moving && hasWalkArt()){
      sDrawMiyukeWalking(gx, G);
    } else {
      let nm = "miyuke_idle";
      if(catState === "celebrate") nm = "miyuke_happy";
      else if(catState === "yarn") nm = "miyuke_yarn";
      else if(catState === "eat") nm = "miyuke_snack";
      sDrawMiyuke(nm, gx, G + (miyukeStrip.moving && frame % 2 ? -1 : 0), SPRITE_SCALES.strip.miyuke);
      if(catState === "duckplay"){
        sDrawSprite(duckSprite(), gx + 46, G, 1);
        const dsz2 = spriteSize("duck_idle") || [24, 20];
        stripHitRects.duck = { x: gx + 46 - dsz2[0] / 2, y: G - dsz2[1], w: dsz2[0], h: dsz2[1] };
      }
    }
    if(catState === "celebrate"){
      for(let i = 0; i < 6; i++)
        sDrawSprite("fx_confetti_" + (i % 4) + ((frame + i) % 4 < 2 ? "_a" : "_b"), gx - 42 + ((i * 29 + frame * 7) % 84), 20 + ((i * 17 + frame * 9) % 52), 1);
    }
  }
  /* --- スタッフのウォーカー ---
     バッチ6: 毛柄ごとに ANIMS (sakuri作画 48×40) があればアニメ経路、
     無ければ従来の静止画 (32×24) 経路。歩行フレームは移動距離で進む
     walkClock、座りは sitStart からの実時間で選ぶ。sakuri作画の歩行は
     左向き原画なので右行 (dir>0) で反転する (miyuke_walk と同規約) */
  for(const st of S.staff){
    const wk = stripWalkers[st.id];
    if(!wk) continue;
    const base = "staff_" + st.coat + (wk.backing ? "_back" : wk.sitting ? "_sit" : "_walk");
    const sa = ANIMS[base];
    const useAnim = !!(sa && sa.frames.some(f => hasSprite(f)));
    let nm = base, ssc = SPRITE_SCALES.strip.staff, flip = wk.dir < 0 && !wk.sitting;
    if(useAnim){
      ssc = SPRITE_SCALES.strip.staff48;
      nm = wk.backing ? animFrameAt(base, stripNow - (wk.backStart || stripNow))
           : wk.sitting ? animFrameAt(base, stripNow - (wk.sitStart || stripNow))
                      : animFrameAt(base, wk.walkClock || 0);
      flip = !wk.sitting && wk.dir > 0;
    }
    const ssz0 = spriteSize(nm);
    sShadow(wk.x, G - 0.5, ssz0 ? ssz0[0] * ssc * 0.7 : 30);
    const bob = useAnim ? 0 : (wk.sitting ? 0 : (frame % 2 ? 0 : -0.8));
    const drawn = sDrawSprite(nm, wk.x, G + bob, ssc, flip);
    const ssz = drawn ? (spriteSize(nm) || [32, 24]) : null;
    let srect = ssz
      ? { x: wk.x - ssz[0] * ssc / 2, y: (G + bob) - ssz[1] * ssc, w: ssz[0] * ssc, h: ssz[1] * ssc }
      : { x: wk.x - 17, y: G - 30, w: 34, h: 30 };
    if(wk.carrying){ const t2 = Math.min(srect.y, G - (ssz ? ssz[1] * ssc + 11 : 43)); srect.h += srect.y - t2; srect.y = t2; }
    stripHitRects.staff.push(srect);
    stripStaffArt.push(drawn ? { name: nm, gx: wk.x, gy: G + bob, s: ssc, flip } : null);
    if(deptChief(st.role) === st){
      /* Phase C: 部長バッジ（その部署で一番 Lv の高いスタッフに自動で付く） */
      sctx.save();
      sctx.font = "9px sans-serif"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
      /* 描画の軽量化: x はデバイス画素に揃える (猫の絵と同じ丸め。ずれは 0.5px 未満)。
         端数のままだと歩くたびに毎フレーム描き直しになっていた */
      sctx.fillText("⭐", Math.round(wk.x * stripScale) / stripScale, srect.y - 4);
      sctx.restore();
    }
    if(wk.carrying){
      const bw = ssz ? ssz[0] * ssc : 32 * SPRITE_SCALES.strip.staff;
      const bh = ssz ? ssz[1] * ssc : 24 * SPRITE_SCALES.strip.staff;
      if(wk.carryKind === "memo"){
        /* Phase C: 依頼メモは白いカード＋赤帯で（荷物箱と見分ける） */
        sDrawSprite("icon_memo", wk.x + bw * 0.26 * wk.dir, G - bh * 0.8 + 1, 1);
      } else {
        sDrawSprite("icon_box", wk.x + bw * 0.26 * wk.dir, G - bh * 0.8, 1);
      }
    }
    /* Sprint 3: 雑談の吹き出し（話している1匹の頭上だけ） */
    if(stripChat && stripChat.whoId === st.id && now < stripChat.until)
      drawStripChatBubble(wk.x, srect.y - 2, stripChat.text);
  }
  /* --- 第2ウェーブ M: 役員猫（デスクの脇に座る常駐メンバー） ---
     生産はせず、頭数にも数えない。🎗 は部長の ⭐ と並ぶ頭上バッジ */
  (S.executives || []).slice(0, 3).forEach((ex, i) => {
    const exX = stripDeskCX() - 96 - i * 32;
    const base = "staff_" + ex.coat + "_sit";
    const sa = ANIMS[base];
    let nm = base, esc = SPRITE_SCALES.strip.staff;
    if(sa && sa.frames.some(f => hasSprite(f))){ nm = animFrameAt(base, stripNow - i * 700); esc = SPRITE_SCALES.strip.staff48; }
    sShadow(exX, G - 0.5, 34);
    sDrawSprite(nm, exX, G, esc);
    const esz = spriteSize(nm);
    sctx.save();
    sctx.font = "9px sans-serif"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
    sctx.fillText("🎗", exX, G - (esz ? esz[1] * esc : 30) - 4);
    sctx.restore();
  });
  /* --- Sprint 3: 訪問猫（雇っていない毛柄が横切るだけ・干渉なし） ---
     バッチ6: その毛柄に ANIMS があれば歩行アニメで横切る */
  if(stripVisitor){
    const v = stripVisitor;
    const vbase = "staff_" + v.coat + "_walk";
    const va = ANIMS[vbase];
    if(va && va.frames.some(f => hasSprite(f))){
      sDrawStripWalker(v, G);
    } else {
      sShadow(v.x, G - 0.5, 30);
      const vbob = frame % 2 ? 0 : -0.8;
      sDrawSprite(vbase, v.x, G + vbob, SPRITE_SCALES.strip.staff, v.dir < 0);
    }
  }
  /* --- Phase D: 子会社の配達猫（荷物を持って本社へ） --- */
  if(stripDelivery){
    const v = stripDelivery;
    sDrawStripWalker(v, G);
    if(!v.done) sDrawSprite("icon_box", v.x - 16 * v.dir, G - 46, 1);
  }
  /* --- 拡張ウェーブ G: 外注ベンダーの猫（帰りはバグを持っている） --- */
  if(stripVendor){
    const v = stripVendor;
    sDrawStripWalker(v, G);
    if(v.done) sDrawSprite("icon_bug", v.x - 16 * v.dir, G - 46, 0.7);
  }
  if(stripModCart){
    const v = stripModCart;
    sDrawStripWalker(v, G);
    if(!v.done) sDrawSprite("icon_box", v.x - 16 * v.dir, G - 46, 1);
  }
  /* --- Sprint 4: 帯のクリックイベント（金の魚・バグの群れ） ---
     帯の上でクリックイベントとして描き、クリックで捕まえられる。
     報酬・制限時間は共有イベント側（catchFish / splatBug）がそのまま担う */
  if(fishEvent && stripFish){
    const hop = Math.abs(Math.sin(stripNow / 170)) * 3;
    const fx = stripFish.x;
    sShadow(fx, G - 0.5, 26);
    sDrawSprite("icon_fish", fx, G - 1 - hop, 1.6);
    if(frame % 8 < 4){ sDrawSprite("fx_spark_2", fx - 13, G - 10 - hop, 1); sDrawSprite("fx_spark_2", fx + 12, G - 12 - hop, 1); }
    stripHitRects.fish = { x: fx - 15, y: G - 20, w: 30, h: 22 };
  }
  drawStripStockBugs();   /* 在庫バグ (常に地面を這う。イベントのバグより奥) */
  if(bugEvent){
    for(const bg of bugEvent.bugs){
      const bp = stripBugXY(bg);
      sDrawSprite("icon_bug", bp.x, bp.y + 6, 0.7);
      stripHitRects.bugs.push({ x: bp.x - 9, y: bp.y - 9, w: 18, h: 18 });
    }
  }
  /* 星飾りは棚の天板へ移行済み（drawStripShelf 内, §c.5） */
  /* --- QAアヒル（デスク脇に常駐） --- */
  if((S.upgrades.duck || 0) > 0){
    const dx = cx + 76;
    sShadow(dx, G - 0.5, 24);
    const dnm = duckSprite();   /* Sprint 4: ANIMS の2フレーム再生 */
    const dgy = G - (frame % 6 < 3 ? 0 : 0.8);
    sDrawSprite(dnm, dx, dgy, 1);
    const dsz = spriteSize(dnm) || [24, 20];
    stripHitRects.duck = { x: dx - dsz[0] / 2, y: dgy - dsz[1], w: dsz[0], h: dsz[1] };
    /* 2026-10-27: Lv 4〜7 で2羽、8〜10 で3羽 */
    for(let i = 1; i < duckCount(); i++){
      const ex = stripQAX() + 18 + i * 16;   /* 2羽目以降は QA トレイの右で検査する (信号柱の外側) */
      sShadow(ex, G - 0.5, 20);
      sDrawSprite(dnm, ex, G - ((frame + i * 3) % 6 < 3 ? 0 : 0.8), 1);
    }
  }
  /* --- フローターとクリックのキラキラ --- */
  drawStripSparks(now);
  drawStripFloaters(now);
  /* --- リリースの紙吹雪（帯） --- */
  drawStripConfetti(now, dt);
  /* --- リリースのコイン噴水 (可視生産 P3): 棚から湧いて右下 HUD へ吸い込まれる --- */
  if(stripCoins.length){
    const tx = stripVW - 34, ty = STRIP_H - 14;
    for(const c of stripCoins){
      const age = (now - c.born) / 1000 - c.delay / 1000;
      if(age < 0) continue;
      const dtC = Math.min(0.05, dt);
      c.vy += 150 * dtC;
      c.x += c.vx * dtC; c.y += c.vy * dtC;
      if(c.y > STRIP_GROUND - 2){ c.y = STRIP_GROUND - 2; c.vy *= -0.42; c.vx *= 0.9; }   /* 地面で跳ねる */
      const dx = tx - c.x, dy = ty - c.y, dd = Math.hypot(dx, dy);
      if(age > 0.55 && dd > 2){ c.x += dx / dd * 120 * dtC; c.y += dy / dd * 120 * dtC; }  /* 吸い込み */
      if(dd < 9) c.dead = true;
      sctx.save();
      if(age > 0.75) sctx.globalAlpha = Math.max(0, 1 - (age - 0.75) / 0.35);
      sDrawSprite("icon_coin", c.x, c.y + 6, 0.75);
      sctx.restore();
    }
    stripCoins = stripCoins.filter(c => !c.dead && (now - c.born) / 1000 < 1.6);
  }
  /* --- ホバー中の操作可能オブジェクトを黄色く縁取る (sakuri 指示)。
     v2.4.7: 矩形の枠をやめ、絵のシルエットに沿う輪にした --- */
  if(!layoutEdit.on){
    const ht = stripHoverTarget();
    if(ht) drawHoverTarget(ht);
  }
  /* --- 並べ替えモードの家具アウトライン (吹き出しより背面) --- */
  drawLayoutEditOverlay();
  /* --- セリフ吹き出し（頭上・約4秒で消える） --- */
  drawStripBubble(stripMiyukeX(), G - 82);
}
/* ---------- 演出の粒（キラキラ・浮き文字・紙吹雪） ----------
   絵はすべてスプライト (fx_spark_* / fx_confetti_*)。コードが持つのは動きだけ */
/* クリックのキラキラ: 中心で 3コマ (光る → 開く → 消える)。周りに小さな光が
   放射状に減速しながら散る。big (CRITICAL) は 2倍の絵で、散る光も多く遠く */
function drawStripSparks(now){
  for(const sp of stripSparks){
    const life = sp.big ? 0.55 : 0.4;
    const t = (now - sp.born) / 1000 / life;
    if(t > 1) continue;
    const sc = sp.big ? 2 : 1;
    sDrawSprite("fx_spark_" + Math.min(2, Math.floor(t * 3)), sp.x, sp.y + 4.5 * sc, sc);
    const n = sp.big ? 6 : 4, reach = sp.big ? 16 : 10;
    const r = reach * (1 - (1 - t) * (1 - t) * (1 - t));
    for(let i = 0; i < n; i++){
      const a = (i / n) * Math.PI * 2 + (sp.seed || 0);
      sDrawSprite("fx_spark_2", sp.x + Math.cos(a) * r, sp.y + Math.sin(a) * r + t * 3 + 4.5, 1);
    }
  }
  stripSparks = stripSparks.filter(sp => now - sp.born <= (sp.big ? 550 : 400));
}
/* 浮き文字: ポンと膨らんで出て、減速しながら昇り、後半だけ消えていく。
   帯は透明で下はユーザーの壁紙なので、濃い縁取りでどの背景でも読めるようにする */
function drawStripFloaters(now){
  sctx.save();
  sctx.font = "700 10px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.textAlign = "center";
  sctx.lineJoin = "round";
  sctx.lineWidth = 2.6;
  sctx.strokeStyle = "#2b201acc";
  for(const f of stripFloaters){
    const age = (now - f.born) / 1000;
    if(age > 1.4) continue;
    const t = age / 1.4;
    const rise = 14 * (1 - (1 - t) * (1 - t));
    const pop = age < 0.09 ? 0.6 + age / 0.09 * 0.6 : age < 0.18 ? 1.2 - (age - 0.09) / 0.09 * 0.2 : 1;
    sctx.globalAlpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);
    sctx.save();
    sctx.translate(f.x, f.y - rise);
    if(pop !== 1) sctx.scale(pop, pop);
    sctx.strokeText(f.text, 0, 0);
    sctx.fillStyle = f.color;
    sctx.fillText(f.text, 0, 0);
    sctx.restore();
  }
  sctx.restore();
  stripFloaters = stripFloaters.filter(f => now - f.born <= 1400);
}
/* 紙吹雪: 紙片の絵を、表 (a) と裏返り途中 (b) で切り替えて「ひらひら」に見せる。
   空気抵抗で横流れが落ち着き、落下は終端速度で頭打ちになって左右に揺れる */
function drawStripConfetti(now, dt){
  for(const p of stripConfetti){
    const age = (now - p.born) / 1000;
    if(age > 2.2) continue;
    p.vy = Math.min(22, p.vy + 30 * dt);
    p.vx *= Math.max(0, 1 - 1.2 * dt);
    p.rot += p.vr * dt;
    p.x += (p.vx + Math.sin(p.rot * 0.7) * 6) * dt; p.y += p.vy * dt;
    const ci = Math.max(0, CONFETTI_COLS.indexOf(p.col));
    sctx.save();
    sctx.globalAlpha = age < 1.6 ? 1 : Math.max(0, 1 - (age - 1.6) / 0.6);
    sDrawSprite("fx_confetti_" + ci + (Math.abs(Math.cos(p.rot)) > 0.5 ? "_a" : "_b"), p.x, p.y + 1, 1);
    sctx.restore();
  }
  stripConfetti = stripConfetti.filter(p => now - p.born <= 2200 && p.y < STRIP_H + 6);
}
