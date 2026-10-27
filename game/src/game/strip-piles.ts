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
    bugs: Math.min(8, Math.floor(S.bugStock)),
    l2: S.line2.unlocked ? {
      codeN: Math.round(Math.min(1, S.line2.wip.code / capC) * 4),
      testN: Math.round(Math.min(1, S.line2.wip.tested / capT) * 4)
    } : null
  };
}
/* カード1枚 (白紙 + シンタタックス色の短線2本。モニタ画面と同色セット)。
   bundle は束ね表示: 後ろにずらした影カードで厚みを付ける (§3.2) */
function drawFlowCard(x, y, bundle, tickMark, seed){
  const layers = bundle >= 4 ? 2 : bundle >= 2 ? 1 : 0;
  const cols = FLOW_CARD_COLS;
  const c1 = cols[Math.floor((seed || 0) * 4) % 4], c2 = cols[(Math.floor((seed || 0) * 4) + 1) % 4];
  for(let l = layers; l >= 0; l--){
    const ox = x - l * 1.3, oy = y - l * 1.3;
    sR(ox - 5.6, oy - 3.8, 11.2, 7.6, "#604B40");
    sR(ox - 5, oy - 3.25, 10, 6.5, "#fff5e6");
    if(l === 0){
      sR(ox - 3.8, oy - 1.7, 6.4, 1.1, c1);
      sR(ox - 3.8, oy + 0.5, 4.4, 1.1, c2);
      if(tickMark){ sR(ox + 2.9, oy - 3.25, 2.1, 2.1, "#7be495"); sR(ox + 3.4, oy - 2.7, 1.1, 1.1, "#fff5e6"); }
    }
  }
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
  sR(bx - 14, G - 3, 28, 3, "#445464"); sR(bx - 14, G - 3, 28, 1, "#66707c");
  if(m.code.red) sR(bx - 14, G - 3.6, 28, 1.1, "#e2543e");
  for(let i = 0; i < m.code.n; i++){
    const p = pileSlotPos(bx, i, false);
    drawFlowCard(p.x, p.yb - 3.25, 1, false, i * 0.37);
  }
  /* バグ滞留: 山の上にバグが這う (min(8, bugStock))。QA/debug で減ると潰れる */
  if(m.bugs > 0){
    const topY = G - 3.5 - Math.max(1, Math.ceil(m.code.n / 2)) * 7.6;
    for(let i = 0; i < m.bugs; i++){
      const jx = Math.sin((frame + i * 7) * 0.35) * 1.2;
      const gx = bx - 8 + (i % 4) * 5.4 + jx, gy = topY - 1.5 - Math.floor(i / 4) * 4.5;
      if(!sDrawSprite("icon_bug", gx, gy + 4, 0.32)) sR(gx - 2, gy - 2, 4.5, 3.5, "#3a3230");
    }
  }
  if(stripBugSquash && stripNow - stripBugSquash.at < 300){
    const sa = 1 - (stripNow - stripBugSquash.at) / 300;
    sctx.save(); sctx.globalAlpha = sa;
    if(!sDrawSprite("icon_bug", stripBugSquash.x, stripBugSquash.y + 5, 0.32))
      sR(stripBugSquash.x - 2, stripBugSquash.y - 1, 4.5, 2, "#3a3230");
    sctx.restore();
  }
  if(m.code.red) stripHitRects.piles.push({ x: bx - 15, y: Math.min(G - 12, pileTopY("code") - 6), w: 30, h: G - Math.min(G - 12, pileTopY("code") - 6), stage: "code" });
  /* --- C: ビルド置き場 (サーバ予定地の足元。木箱台) --- */
  const cxp = stripBuildX();
  sR(cxp - 13, G - 4, 26, 4, "#8a6a44"); sR(cxp - 13, G - 4, 26, 1.2, "#b08954");
  if(m.test.red) sR(cxp - 13, G - 4.6, 26, 1.1, "#e2543e");
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
  if(m.build.red) sR(dx - 20, G - 16.6, 44, 1.1, "#e2543e");
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
      if(frame % 6 < 3){
        sR(p.x - 7, p.yb - 15.6, 14, 1.2, "#ffd94d"); sR(p.x - 7, p.yb - 5.4, 14, 1.2, "#ffd94d");
        sR(p.x - 7, p.yb - 15.6, 1.2, 10.2, "#ffd94d"); sR(p.x + 5.8, p.yb - 15.6, 1.2, 10.2, "#ffd94d");
      }
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
    for(let i = 0; i < n; i++){
      const yb = topY - i * 5;
      sR(dcx + cxOff - 4, yb - 4.5, 8, 4.5, "#604B40");
      sR(dcx + cxOff - 3.6, yb - 4.1, 7.2, 3.7, "#fff5e6");
      if(tickMark) sR(dcx + cxOff + 1.6, yb - 4.1, 1.8, 1.8, "#7be495");
    }
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
      sR(x - 2.5, y - 2.5, 5, 5, it.col || "#ffd94d");
      sR(x - 2.5, y - 2.5, 5, 1.2, "#00000022");
    } else if(it.kind === "mote"){
      y = it.y0 - t * 15;
      sctx.save(); sctx.globalAlpha = 1 - t;
      sR(x - 1.6, y - 1.6, 3.2, 3.2, it.col || "#c586c0");
      sR(x - 0.5, y - 0.5, 1, 1, "#ffffff");
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
  if(officeTier(S) < 2 || !(S.upgrades.ci > 0)) return;
  const G = STRIP_GROUND, rx = stripRackCX();
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
  sR(ex - 7, G - 4, 2, 4, "#8a6a44"); sR(ex + 5, G - 4, 2, 4, "#8a6a44");
  if(!sDrawSprite("prop_wall_1", ex, G - 3, 0.9)){
    sR(ex - 9, G - 25, 18, 22, "#fff5e6"); sR(ex - 9, G - 25, 18, 5, "#e2543e");
    sR(ex - 5, G - 16, 3, 3, "#f09a3e"); sR(ex + 3, G - 16, 3, 3, "#5aa469");
    sR(ex - 7, G - 8, 14, 2, "#9a8f85");
  }
}
/* トロフィー台（ゾーン E 0.75W, §c.5）: 旧表彰プレート（prop_wall_3）の家具化。高さ 30 単位級 */
function drawStripTrophy(){
  const G = STRIP_GROUND, tx = stripTrophyCX();
  sShadow(tx, G - 0.5, 22);
  sR(tx - 9, G - 9, 18, 9, "#8a6a44");
  sR(tx - 10, G - 10, 20, 2, "#b08954");
  if(!sDrawSprite("prop_wall_3", tx, G - 10, 0.8)){
    sR(tx - 11, G - 23, 22, 13, "#d9b23a"); sR(tx - 9, G - 21, 18, 9, "#f5d76e");
    sR(tx - 4, G - 19, 8, 3, "#8a6a44");
  }
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
  stripHitRects.fish = null; stripHitRects.bugs = []; stripHitRects.shelf = null;
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
  if(officeTier(S) >= 1) sDrawSprite("prop_chair", cx + 12, G, 2);
  /* 主机の天板: tier>=1 ではラミネート (desk_laminate_main 116×3) */
  if(!(officeTier(S) >= 1 && sDrawSprite("desk_laminate_main", cx, G, 1))){
    sR(cx - 58, G - 3, 116, 3, "#b08954");
    sR(cx - 58, G - 3, 116, 1.1, "#cfa06a");
  }
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
  if(!sDrawSprite(coffeeSpr, coffeePl.cx, coffeePl.baseY, 1.25)){
    sR(coffeePl.cx - 1, coffeePl.baseY - 12.5, 8, 10, "#e2543e"); sR(coffeePl.cx + 7, coffeePl.baseY - 9.5, 3, 4, "#e2543e");
  }
  /* 2026-10-25: おやつ箱 (sakuri 指示でメニューのボタンから移設)。机の右足元に置く。
     クールダウン中は蓋が閉まった絵 (prop_snackbox_shut) になって「まだ」を絵で示す */
  const snackReadyNow = Date.now() >= snackReadyAt;
  const snackPl = propPlace("snack");
  sDrawSprite(snackReadyNow ? "prop_snackbox" : "prop_snackbox_shut", snackPl.cx, snackPl.baseY, 1);
  stripObjArt.snack = { name: snackReadyNow ? "prop_snackbox" : "prop_snackbox_shut", gx: snackPl.cx, gy: snackPl.baseY, s: 1 };
  if(snackReadyNow && blinkOn(90, 45)){
    sR(snackPl.cx - 0.6, snackPl.baseY - 26, 1.2, 4, "#ffd94d"); sR(snackPl.cx - 1.8, snackPl.baseY - 24.8, 3.6, 1.2, "#ffd94d");
  }
  stripHitRects.snack = { x: snackPl.cx - 14, y: snackPl.baseY - 25, w: 28, h: 25 };
  if(S.stamps.releases10){
    if(!sDrawSprite("prop_wall_2", cx - 70, G, 0.6)){
      sR(cx - 76, G - 14, 12, 14, "#fff5e6"); sR(cx - 76, G - 14, 12, 4, "#e2543e");
      sR(cx - 73, G - 8, 2, 2, "#9a8f85"); sR(cx - 69, G - 8, 2, 2, "#9a8f85"); sR(cx - 65, G - 8, 2, 2, "#9a8f85");
    }
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
      sR(toolPl.cx - 1, toolPl.baseY - 23.5, 2, 5, "#e2543e");
      if(blinkOn(50, 30)) sR(toolPl.cx - 1.6, toolPl.baseY - 24.4, 3.2, 1.4, "#ffd94d");
    }
  }
  /* F: オーバークロック・ゲージ（机の右脇に立つ縦ゲージ。UI なのでコード描画可）。
     溜まり具合は色＋量、満タンは金の明滅、発動中は赤で残り時間を減らして示す */
  {
    const gx = stripDeskCX() + 88, gh = 38, gw = 9;
    const fActive = feverActive();
    const fFrac = fActive ? Math.max(0, (feverUntil - Date.now()) / FEVER.durationMs)
                          : (S.fever ? (S.fever.gauge || 0) / 100 : 0);
    sR(gx - gw / 2 - 1.5, G - gh - 1.5, gw + 3, gh + 3, "#604B40");
    sR(gx - gw / 2, G - gh, gw, gh, "#fff5e6");
    if(fFrac > 0){
      const fh = Math.max(1.5, gh * Math.min(1, fFrac));
      sR(gx - gw / 2, G - fh, gw, fh, fActive ? "#e2543e" : (fFrac >= 1 ? (blinkOn(50, 30) ? "#ffd94d" : "#f0b429") : "#4a90c2"));
    }
    if(fFrac >= 1 && !fActive && blinkOn(50, 30)){
      sctx.save();
      sctx.font = "9px sans-serif"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
      sctx.fillText("⚡", gx, G - gh - 7);
      sctx.restore();
    }
    if(fActive && frame % 24 === 0)   /* 発動中は机から火花（軽い演出・既存の仕組み） */
      stripSparks.push({ x: stripDeskCX() - 20 + Math.random() * 40, y: G - 34, born: Date.now() });
    stripHitRects.fever = { x: gx - 3, y: G - gh - 9, w: 13, h: gh + 11 };
  }
  /* G: 技術的負債の散らかり（机の周りの書類の山。負債の帯域で増える —
     ダイジェティック表現: 数字を見なくても「荒れてきた」が分かる） */
  {
    const dNow = S.debt || 0;
    const stacks = dNow >= 250 ? 3 : dNow >= 120 ? 2 : dNow >= 40 ? 1 : 0;
    const spots = [stripDeskCX() - 128, stripDeskCX() + 122, stripDeskCX() - 148];
    for(let i = 0; i < stacks; i++){
      const px = spots[i];
      for(let j = 0; j < 3; j++)
        sR(px - 7 + (j % 2) * 1.5, G - 2 - j * 2.2, 14, 2, j % 2 ? "#e9e0c8" : "#f7f1de");
      sR(px - 6, G - 8.6, 12, 1, "#d8cfb8");
      if(i === 2) sR(px + 9, G - 3, 6, 3, "#c9a86a");   /* 3段目は倒れた箱も */
    }
  }
  /* --- 可視生産: 工程の山 (家具層) と第2ラインのミニ山、移動中の物 (層④) --- */
  drawStripPiles();
  drawStripLine2Piles();
  drawStripFlowItems();
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
      const cols = ["#e2543e", "#ffd94d", "#5aa469", "#4a90c2"];
      for(let i = 0; i < 6; i++) sR(gx - 42 + ((i * 29 + frame * 7) % 84), 18 + ((i * 17 + frame * 9) % 52), 2.2, 2.2, cols[i % 4]);
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
    if(!drawn) sDrawStaffFallback(st.coat, wk.x, G);
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
      sctx.fillText("⭐", wk.x, srect.y - 4);
      sctx.restore();
    }
    if(wk.carrying){
      const bw = ssz ? ssz[0] * ssc : 32 * SPRITE_SCALES.strip.staff;
      const bh = ssz ? ssz[1] * ssc : 24 * SPRITE_SCALES.strip.staff;
      if(wk.carryKind === "memo"){
        /* Phase C: 依頼メモは白いカード＋赤帯で（荷物箱と見分ける） */
        const mxp = wk.x + bw * 0.26 * wk.dir;
        sR(mxp - 3.5, G - bh * 0.8 - 8, 7, 9, "#fff5e6");
        sR(mxp - 3.5, G - bh * 0.8 - 8, 7, 1.4, "#e2543e");
        sR(mxp - 2, G - bh * 0.8 - 4.5, 4, 1, "#9a8f85");
        sR(mxp - 2, G - bh * 0.8 - 2.5, 4, 1, "#9a8f85");
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
    if(!sDrawSprite(nm, exX, G, esc)) sDrawStaffFallback(ex.coat, exX, G);
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
      if(!sDrawSprite(vbase, v.x, G + vbob, SPRITE_SCALES.strip.staff, v.dir < 0))
        sDrawStaffFallback(v.coat, v.x, G);
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
    if(!sDrawSprite("icon_fish", fx, G - 1 - hop, 1.6)){
      sR(fx - 9, G - 9 - hop, 15, 8, "#ffd94d"); sR(fx + 6, G - 10 - hop, 6, 10, "#f5b81e");
      sR(fx - 12, G - 7 - hop, 4, 4, "#ffd94d"); sR(fx - 10, G - 6 - hop, 2, 2, "#3a3230");
    }
    if(frame % 8 < 4){ sR(fx - 13, G - 14 - hop, 2, 2, "#ffffff"); sR(fx + 11, G - 16 - hop, 2, 2, "#ffffff"); }
    stripHitRects.fish = { x: fx - 15, y: G - 20, w: 30, h: 22 };
  }
  if(bugEvent){
    for(const bg of bugEvent.bugs){
      const bp = stripBugXY(bg);
      if(!sDrawSprite("icon_bug", bp.x, bp.y + 6, 0.7)){
        sR(bp.x - 3, bp.y - 3, 7, 6, "#3a3230"); sR(bp.x - 5, bp.y - 1, 2, 2, "#3a3230");
        sR(bp.x + 4, bp.y - 1, 2, 2, "#3a3230"); sR(bp.x - 1, bp.y - 5, 2, 2, "#e2543e");
      }
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
  }
  /* --- フローターとクリックのキラキラ --- */
  for(const sp of stripSparks){
    const age = (now - sp.born) / 1000;
    if(age > 0.4) continue;
    sctx.save();
    sctx.globalAlpha = 1 - age / 0.4;
    sR(sp.x - 5, sp.y - 5 - age * 6, 2, 2, "#ffd94d");
    sR(sp.x + 3, sp.y - 3 - age * 6, 2, 2, "#e8873a");
    sR(sp.x - 1, sp.y - 8 - age * 9, 2, 2, "#ffffff");
    sctx.restore();
  }
  stripSparks = stripSparks.filter(sp => now - sp.born <= 400);
  sctx.save();
  sctx.font = "700 10px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.textAlign = "center";
  for(const f of stripFloaters){
    const age = (now - f.born) / 1000;
    if(age > 1.4) continue;
    sctx.globalAlpha = Math.max(0, 1 - age / 1.4);
    sctx.fillStyle = f.color;
    sctx.fillText(f.text, f.x, f.y - age * 11);
  }
  sctx.restore();
  stripFloaters = stripFloaters.filter(f => now - f.born <= 1400);
  /* --- リリースの紙吹雪（帯） --- */
  for(const p of stripConfetti){
    const age = (now - p.born) / 1000;
    if(age > 2.2) continue;
    p.vy += 30 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    sctx.save();
    sctx.translate(p.x, p.y); sctx.rotate(p.rot);
    sctx.globalAlpha = Math.max(0, 1 - age / 2.2);
    sctx.fillStyle = p.col; sctx.fillRect(-1.6, -1.1, 3.2, 2.2);
    sctx.restore();
  }
  stripConfetti = stripConfetti.filter(p => now - p.born <= 2200 && p.y < STRIP_H + 6);
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
      if(!sDrawSprite("icon_coin", c.x, c.y + 6, 0.75)) sR(c.x - 3, c.y - 3, 6, 6, "#ffd94d");
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
