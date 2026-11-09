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
             red: byId.build.lamp === "red" }
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
    if(idx === 4) return { x: cx, yb: stripTierG("mid") - 8.8 - 2 * 9.2 };   /* 5個目は天辺中央 */
    return { x: cx + (col === 0 ? -6.8 : 6.8), yb: stripTierG("mid") - 8.8 - row * 9.2 };
  }
  return { x: cx + (col === 0 ? -5.9 : 5.9), yb: stripTierG("mid") - 3.5 - row * 7.6 };   /* 山は持ち場（中景段）基準 */
}
/* 工程の持ち場（2026-10-27、sakuri の訂正で v2.12.1 の「詰まった山を押す」から作り直し）。
   企画＝会議室・テスト＝テスト室・ビルド＝ビルド室・出荷＝出荷場のブース（prop_station_*、背景の仕切り壁と道具）を
   地面に立て、ブースをクリックするとみゅけがその工程を手で進める（handworkClick）。実装の持ち場はみゅけの机。
   ブースはいつでも押せる。いま詰まっている工程のブースの上では肉球の合図 icon_tap が上下し、手助け中は工程ごとの
   手作業の絵 fx_handwork_<工程> が動く。詰まった山の左の三角コーンは従来どおり対策パネル（設備・人 = 手動 → 自動化）。
   ブースの絵が届く前は、今ある台（付箋ボード・QA トレイ・木箱台・出荷台）が持ち場の見た目を担う（コードで代用しない） */
const STATION_PILE = { test: "code", build: "test", ship: "build" };   /* 持ち場 → 手前に積まれる入力の山 */
const STATION_BOX = { plan: { w: 48, h: 44 }, test: { w: 48, h: 44 }, build: { w: 48, h: 44 }, ship: { w: 64, h: 48 } };
function stationCX(stage){
  if(stage === "plan") return backlogX();
  if(stage === "test") return stripQAX();
  if(stage === "build") return stripBuildX();
  return stripShipX() + 2;
}
function stationNeedsHelp(m, stage){
  if(stage === "plan") return !!(S.project && S.project.planning);
  const pile = STATION_PILE[stage];
  if(m[pile].red && m[pile].n > 0) return true;
  const bn = currentBottleneck();
  return !!bn && bn.stage === stage && m[pile].n > 0;
}
/* ブース本体（家具層のいちばん奥）。絵が無ければ描かない */
function drawStripStationBooths(){
  const G = stripTierG("back");   /* ブースは背景段（§3.1） */
  for(const st of HANDWORK_STAGES){
    const nm = "prop_station_" + st;
    if(hasSprite(nm)) sDrawSprite(nm, stationCX(st), G, 1);
  }
}
/* 手作業の絵・押せる合図・当たり判定（山と信号柱を描いた後） */
function drawStripStationHelp(m){
  const G = stripTierG("mid");   /* 手助けの合図と判定は持ち場（中景段） */
  for(const st of HANDWORK_STAGES){
    const cx = stationCX(st), box = STATION_BOX[st];
    const topY = st === "plan" ? G - 30 : Math.min(G - 8, pileTopY(STATION_PILE[st]) - 1);
    const hw = handworkFx && handworkFx.stage === st && stripNow - handworkFx.at < 450 ? handworkFx : null;
    const fxNm = hw ? "fx_handwork_" + st + "_" + (stripNow - hw.at < 220 ? 1 : 0) : null;
    if(fxNm && hasSprite(fxNm)) sDrawSprite(fxNm, cx, topY + 2, 1);
    else if(!hw && stationNeedsHelp(m, st)) sDrawSprite("icon_tap_" + (blinkOn(40, 20) ? 0 : 1), cx, topY - 2, 1);
    stripHitRects.stations.push({ x: cx - box.w / 2, y: G - box.h, w: box.w, h: box.h, stage: st });
  }
}
function drawStripPiles(){
  const G = stripTierG("mid"), m = pileModel();   /* 台・山・コーンは持ち場（中景段）。別館看板だけ背景段 (GB) */
  /* --- B: QA トレイ (机と研究机の間) --- */
  const bx = stripQAX();
  /* 2026-10-27: トレイ・台・カードは絵。詰まりは赤線ではなく信号柱 (strip-visible.ts) と
     山の左に置く三角コーンで見せる */
  const jam = { code: stationNeedsHelp(m, "test"), test: stationNeedsHelp(m, "build"), build: stationNeedsHelp(m, "ship") };
  sDrawSprite("prop_qa_tray", bx, G, 1);
  if(jam.code) sDrawSprite("prop_jam_cone", bx - 21, G, 1);
  for(let i = 0; i < m.code.n; i++){
    const p = pileSlotPos(bx, i, false);
    drawFlowCard(p.x, p.yb - 3.25, 1, false, i * 0.37);
  }
  /* バグ滞留は山の上ではなく、帯の地面を這う在庫バグとして描く (strip-bugs.ts) */
  if(jam.code) stripHitRects.piles.push({ x: bx - 27, y: G - 11, w: 12, h: 11, cone: true });
  /* --- C: ビルド置き場 (サーバ予定地の足元。木箱台) --- */
  const cxp = stripBuildX();
  sDrawSprite("prop_build_stand", cxp, G, 1);
  if(jam.test) sDrawSprite("prop_jam_cone", cxp - 21, G, 1);
  for(let i = 0; i < m.test.n; i++){
    const p = pileSlotPos(cxp, i, false);
    drawFlowCard(p.x, p.yb - 3.25, 1, true, i * 0.53);
  }
  if(jam.test) stripHitRects.piles.push({ x: cxp - 27, y: G - 11, w: 12, h: 11, cone: true });
  /* --- D: 出荷スタック (箱の積み場 + 「出荷」札) --- */
  const dx = stripShipX();
  /* 2026-10-26: prop_ship は Codex 描き直し (48×48・「出荷」の文字も絵の側)。
     コード描きのフォールバックと文字載せは廃止 (アートへのスクリプト混入禁止) */
  sDrawSprite("prop_ship", dx + 2, G, 1);
  /* Phase D: 子会社がある間だけ、出荷スポットの隣に別館の看板が立つ。
     第2ウェーブ J: オフィスグレード II 以上では金の本社看板に差し替わる */
  if(S.subs && S.subs.length){
    const GB = stripTierG("back");   /* 看板は背景段の「気配」（§4.3）。出荷場（中景）とは段が違う */
    /* 看板の板の部分だけ → 子会社タブ */
    stripHitRects.annex = { x: dx - 59, y: GB - 44, w: 34, h: 22 };
    /* 再設計 B11: 看板は子会社の段階（総勢ラッチ）で育つ。旧 legacyGrade >= 2 の金の切り替えは廃止した。
       A1（2026-11-02 みゅー作画）: 段階ごとの専用絵が揃った — 段階2=屋根と明かりの木の看板／
       段階3=銀の看板／段階4=持ち上げた金の看板。絵が無い段階は旧来の拡縮で読ませる。
       段階4だけが金の縁（金の看板に二つの意味を持たせない） */
    const ast = annexStage();
    const signNm = ast >= 4 ? "prop_annex_sign_4" : ast === 3 ? "prop_annex_sign_3" : ast === 2 ? "prop_annex_sign_2" : "prop_annex_sign";
    if(hasSprite(signNm)) sDrawSprite(signNm, dx - 42, GB, 1);
    else if(ast >= 4 && hasSprite("prop_sign_gold")) sDrawSprite("prop_sign_gold", dx - 42, GB, 1);
    else if(hasSprite("prop_annex_sign")) sDrawSprite("prop_annex_sign", dx - 42, GB, ast >= 3 ? 1.3 : ast >= 2 ? 1.15 : 1);
    /* A5: 看板に掛ける「いまの顔」の札（伸縮キット: 左端 + 4px 単位 + 右端）。
       作品名の文字は表示側が板の上に書く（designer-r3 §3.2） */
    if(hasSprite("a5_tag_l") && hasSprite("a5_tag_m") && hasSprite("a5_tag_r")){
      const face = subWorkName(S.subs[S.subs.length - 1]);
      sctx.save();
      sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      const tw = Math.ceil(sctx.measureText(face).width);
      const units = Math.max(1, Math.ceil((tw + 8 - 20) / 4));
      const tagW = 20 + units * 4, tagCx = dx - 42, tagB = GB - 2;
      sDrawSprite("a5_tag_l", tagCx - tagW / 2 + 5, tagB, 1);
      for(let u = 0; u < units; u++) sDrawSprite("a5_tag_m", tagCx - tagW / 2 + 12 + u * 4, tagB, 1);
      sDrawSprite("a5_tag_r", tagCx + tagW / 2 - 5, tagB, 1);
      sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
      sctx.fillText(face, tagCx, tagB - 11.5);
      sctx.restore();
    }
    /* A4: 配当の明かり（光だけの重ね絵）。別館がある間は淡く灯り、配当の到着で
       一度明るくなって fx_sparkle が3箇所で瞬く。絵が無い間は旧 UI の灯り */
    if(hasSprite("a4_dividend_light")){
      const lit = Date.now() < annexArriveFlashUntil;
      sctx.save();
      sctx.globalAlpha = lit ? 1 : 0.55;
      sDrawSprite("a4_dividend_light", dx - 42, GB, 1);
      sctx.restore();
      if(lit && !motionReduced()){
        const el = 1200 - Math.max(0, annexArriveFlashUntil - Date.now());
        const fr = fxFrameAt([70, 70, 120, 70, 90], el % 420);
        if(fr >= 0){
          sDrawSprite("fx_sparkle_" + fr, dx - 42, GB - 42, 1);
          sDrawSprite("fx_sparkle_" + ((fr + 2) % 5), dx - 56, GB - 22, 1);
          sDrawSprite("fx_sparkle_" + ((fr + 3) % 5), dx - 28, GB - 22, 1);
        }
      }
    } else {
      const lit = Date.now() < annexArriveFlashUntil;
      sctx.save();
      sctx.fillStyle = lit ? "rgba(255, 205, 74, 0.9)" : "rgba(255, 205, 74, 0.45)";
      sctx.beginPath(); sctx.arc(dx - 42 + 17, GB - 46, lit ? 4.2 : 2.6, 0, Math.PI * 2); sctx.fill();
      sctx.restore();
    }
    /* 段階が上がった瞬間は fx_sparkle_burst が看板の上で弾ける */
    if(annexStageFxAt && Date.now() - annexStageFxAt < 420 && !motionReduced() && hasSprite("fx_sparkle_burst_0")){
      const fr = fxFrameAt([60, 60, 110, 80, 110], Date.now() - annexStageFxAt);
      if(fr >= 0) sDrawSprite("fx_sparkle_burst_" + fr, dx - 42, GB - 30, 1.4);
    }
  }
  if(jam.build) sDrawSprite("prop_jam_cone", dx - 32, G, 1);
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
  if(jam.build) stripHitRects.piles.push({ x: dx - 38, y: G - 11, w: 12, h: 11, cone: true });
}
/* 移動中の物 (描画層④: 家具より手前・キャラより後ろ) */
function drawStripFlowItems(){
  const G = stripTierG("mid");   /* 滑り出る箱は出荷場（中景段）の地面を滑る */
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
  const G = stripTierG("back"), rx = stripRackCX();   /* サーバーラックは背景段（§3.1） */
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
  const G = stripTierG("mid");   /* イーゼルは中景段の立て看板 */
  /* カレンダーとの衝突回避込みの実描画位置 (stripEaselDrawX に集約) */
  const ex = stripEaselDrawX();
  stripHitRects.easel = { x: ex - 14, y: G - 34, w: 28, h: 34 };   /* v2.26.1: 思い出の家具（クリックでみゅけの一言） */
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
/* トロフィー台（ゾーン E 0.93W・2026-10-27 に出荷場の右へ, §c.5）: 旧表彰プレート（prop_wall_3）の家具化。高さ 30 単位級 */
function drawStripTrophy(){
  const G = stripTierG("mid"), tx = stripTrophyCX();   /* トロフィー台は中景段（§3.1） */
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
  stripSpriteLog = [];   /* ホバーの縁取り用: このフレームに貼った絵の記録 (strip-core.ts) */
  /* ヒットゾーン記録をこのフレーム分にリセット（吹き出しは描画時に再設定される） */
  stripHitRects.miyuke = null; stripHitRects.staff = [];
  stripHitRects.duck = null; stripHitRects.bubble = null;
  stripHitRects.fish = null; stripHitRects.bugs = []; stripHitRects.stockBugs = []; stripHitRects.shelf = null;
  stripHitRects.board = null; stripHitRects.board2 = null; stripHitRects.piles = []; stripHitRects.stations = [];
  stripHitRects.snack = null; stripHitRects.want = null;
  stripHitRects.research = null; stripHitRects.rack = null; stripHitRects.trophy = null; stripHitRects.annex = null;
  stripHitRects.calendar = null; stripHitRects.memo = null; stripHitRects.phone = null; stripHitRects.easel = null;
  stripHitRects.megaphone = null; stripHitRects.toolbox = null;
  stripHitRects.fever = null;
  stripObjArt = {}; stripStaffArt = [];
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.clearRect(0, 0, stripCv.width, stripCv.height);
  sctx.setTransform(stripScale, 0, 0, stripScale, 0, 0);
  const G = STRIP_GROUND, cx = stripDeskCX();
  /* 段基線（§3.1）: GM = 中景（机クラスタ・持ち場・スタッフ等の生活面）、
     GB = 背景（ブース・棚・ボード・ラック）。G は前景 = みゅけ専有 */
  const GM = stripTierG("mid"), GB = stripTierG("back");
  /* 座位は段ではなく家具に従属する（§3.3）: みゅけの座面は机（中景）の
     基線 +3。数値としては従来の G-2 と同じ位置に落ちる */
  const seatY = GM + 3;
  stripHitRects.desk = { x: cx - 62, y: GM - 31, w: 124, h: 35 };  /* 机板＋PC */
  const coding = catState === "code" || catState === "code_slow";
  const atDesk = stripAtDesk();
  /* --- 家具レイヤー (R3 の固定順: ラグ・影 → 背面物 → 家具本体) ---
     地面は「線」であって「面」にしない (R1): 全幅の地面帯は敷かず、
     ラグは各家具クラスタの下だけ。歩行者はこの後に描くので常に家具の手前 (R2) */
  drawStripStationBooths();                         /* 工程の持ち場のブース (会議室・テスト室・ビルド室・出荷場)。いちばん奥 */
  drawStripShelf();                                 /* B: 作品棚＋柵 (②背面物+③) */
  if(hasResearcher()) drawStripResearchStation();   /* C: 研究机 */
  drawStripServerRack();                            /* E': サーバーラック (tier>=2 + CIマシン) */
  if(S.stamps.first_release) drawStripEasel();      /* E: イーゼル */
  if(S.stamps.prestige1) drawStripTrophy();         /* E: トロフィー台 */
  /* --- デスクゾーン（常設のワークステーション） --- */
  /* §c.1: 机クラスタのラグ 150×4。tier>=1 では疲労軽減マット (prop_mat) に
     差し替わる (アンカー (cx, G+3) で従来のラグ矩形と同フットプリント) */
  if(!(officeTier(S) >= 1 && sDrawSprite("prop_mat", cx, GM + 3, 1))) sRug(cx, 150, GM);
  sShadow(cx, GM - 0.5, 122);
  drawStripProjectBoardMain();                      /* 机の背後のプロジェクトボード (支柱は机より背面) */
  /* tier>=1: オフィスチェアを みゅけ の背後 (家具層) に置く。猫と PC は
     この後に描くので常に椅子より手前 */
  /* 2026-10-27: 椅子は「ふかふか椅子」の Lv で段が変わる (strip-visible.ts) */
  const chairNm = chairSpriteName();
  if(chairNm) sDrawSprite(chairNm, cx + 12, GM, 2);
  /* 主机の天板: tier>=1 ではラミネート (desk_laminate_main 116×3) */
  sDrawSprite(officeTier(S) >= 1 ? "desk_laminate_main" : "desk_wood_main", cx, GM, 1);
  drawStripDeskUpgrades(cx);   /* サブモニタ・キーボード・企画の付箋ボード (アップグレードの段) */
  /* PC はコーディング中も含め常時表示（みゅけより後ろのレイヤー）。
     ただし sakuri作画 code アニメのフレームが解決できる間は、ポーズ内のモニタが
     PC を担うので prop_pc は描かず、進捗表示はポーズ内モニタへ重ねる（二重モニタ防止）。
     みゅけの接地アンカー (cx+6, G-2) は従来のコーディング配置と同一に保つ */
  const codeFrame = (coding && atDesk) ? catSprite("miyuke_code_a") : null;
  const sakuriCoding = !!codeFrame && codeFrame !== "miyuke_code_a" && hasSprite(codeFrame);
  if(!sakuriCoding){
    drawStripPC(cx - 34, GM - 2);   /* PC は机（中景段）の天板まわり。机基線からの相対は従来どおり -2 */
    drawStripPCScreen(cx - 34, GM - 2);   /* Sprint 4: モニタ内に実プロジェクトの進捗 */
  } else {
    drawStripCodeScreen(cx, seatY + 2);   /* バッチ2: ポーズ内モニタへ進捗表示（座位の猫に従属） */
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
  const snackReadyNow = Date.now() >= snackReadyAt || wantIs("snack");   /* v2.21.0: おねだり中は開く */
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
    /* 既定は机の脇。2026-10-28 から並べ替えで動かせる (机や棚の上にも載る) */
    const calPl = propPlace("calendar");
    sDrawSprite("prop_wall_2", calPl.cx, calPl.baseY, 0.6);
    /* Stage 3: 卓上カレンダークリック → 統計タブ (日々の記録) */
    stripHitRects.calendar = { x: calPl.cx - 9, y: calPl.baseY - 16, w: 18, h: 16 };
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
    const feverPl = propPlace("fever");   /* 既定は机の右脇。2026-10-28 から並べ替えで動かせる */
    const gx = feverPl.cx, gb = feverPl.baseY, gh = 38, wy = gb - 3;
    const fActive = feverActive();
    const fFrac = fActive ? Math.max(0, (feverUntil - Date.now()) / FEVER.durationMs)
                          : (S.fever ? stripMeter("fever", S.fever.gauge || 0) / 100 : 0);
    sDrawSprite("prop_fever_gauge", gx, gb, 1);
    if(fFrac > 0){
      const fh = Math.max(4, Math.round(gh * Math.min(1, fFrac)));
      sDrawNine("ui_gauge_fill_" + (fActive ? "red" : fFrac >= 1 ? "gold" : "blue") + "_3v", gx - 4.5, wy - fh, 9, fh, 0, 2);
    }
    if(fFrac >= 1 && !fActive && blinkOn(50, 30)) sDrawSprite("icon_bolt", gx, gb - 43, 1);
    if(fActive && frame % 24 === 0)   /* 発動中は机から火花（軽い演出・既存の仕組み） */
      stripSparks.push({ x: stripDeskCX() - 20 + Math.random() * 40, y: G - 34, born: Date.now() });
    /* 再設計 B8（C1 #15＋ux-r3 §2.5）: 溜め中は筒の上に「あと◯% ・ 生産+◯%」（蓄熱の現在値）を出す */
    if(!fActive && fFrac > 0 && fFrac < 1){
      const gNow = Math.floor((S.fever && S.fever.gauge) || 0);
      if(gNow > 0){
        const heatTxt = "あと" + (100 - gNow) + "% ・ 生産+" + Math.round(FEVER.passiveMax * gNow) + "%";
        sctx.save();
        sctx.font = "700 9px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
        sctx.textAlign = "center"; sctx.textBaseline = "bottom";
        sctx.lineWidth = 2.5; sctx.strokeStyle = "#fff8ec";
        sctx.strokeText(heatTxt, gx, gb - 45);
        sctx.fillStyle = "#4a3b2c";
        sctx.fillText(heatTxt, gx, gb - 45);
        sctx.restore();
      }
    }
    stripHitRects.fever = { x: gx - 7, y: gb - 52, w: 14, h: 52 };
  }
  /* 再設計 B8（ux-r3 §2.2）: OS入力カウントの常駐目印 — 机の左隅の小物。
     A10（2026-11-02 みゅー作画）: ドームランプの絵が担う。数えている間だけ
     暖かく灯る（色は入力中であることの結論）。絵が無い間は UI の点で示す */
  {
    const dcx = stripDeskCX() - 58, dcy = GM - 36;
    if(hasSprite("a10_marker_lit") && hasSprite("a10_marker_unlit")){
      sDrawSprite(osCountingActive() ? "a10_marker_lit" : "a10_marker_unlit", dcx, GM - 30, 0.8);
    } else {
      sctx.save();
      sctx.fillStyle = "#5a4a38";
      sctx.beginPath(); sctx.arc(dcx, dcy, 3.2, 0, Math.PI * 2); sctx.fill();
      if(osCountingActive()){
        sctx.fillStyle = "rgba(88, 166, 74, 0.35)";
        sctx.beginPath(); sctx.arc(dcx, dcy, 5.4, 0, Math.PI * 2); sctx.fill();
        sctx.fillStyle = "#58a64a";
        sctx.beginPath(); sctx.arc(dcx, dcy, 2.1, 0, Math.PI * 2); sctx.fill();
      } else {
        sctx.fillStyle = "#8a7a62";
        sctx.beginPath(); sctx.arc(dcx, dcy, 1.6, 0, Math.PI * 2); sctx.fill();
      }
      sctx.restore();
    }
  }
  /* G: 技術的負債の散らかり（机の周りの書類の山。負債の帯域で増える —
     ダイジェティック表現: 数字を見なくても「荒れてきた」が分かる） */
  {
    const dNow = S.debt || 0;
    const stacks = dNow >= 250 ? 3 : dNow >= 120 ? 2 : dNow >= 40 ? 1 : 0;
    const spots = [stripDeskCX() - 128, stripDeskCX() + 122, stripDeskCX() - 148];
    for(let i = 0; i < stacks; i++){
      const px = spots[i];
      sDrawSprite("prop_debt_pile_" + (stacks - i), px, GM, 1);   /* 2026-10-27: 帯域ごとの山の絵 (3 は箱も倒れている)。机まわり（中景段）の散らかり */
    }
  }
  /* --- 可視生産: 工程の山 (家具層) と第2ラインのミニ山、移動中の物 (層④) --- */
  drawStripLineUpgrades();     /* 自動テスト機・梱包機 (アップグレードの段)。山の背後に立つ機械 */
  drawStripPiles();
  drawStripStationSignals();   /* 工程ごとの信号柱 (緑/黄/赤) */
  drawStripStationHelp(pileModel());   /* 持ち場の手作業の絵・押せる合図・当たり判定 */
  drawStripFlowItems();
  updateStripBots(dt);
  drawStripBots();             /* 子ねこボット (Lv の台数だけ運搬) */
  /* --- キャラ層（§3.2/§5-2）: 中景キャラ（ボット・スタッフ・役員・訪問/配達・
     アヒル）を先に描き、前景のみゅけをキャラ層の最後に描く。スタッフが
     みゅけの前面を横切ることは構造的に起きない --- */
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
    ssc = stripArtScale(ssc);   /* 実際に描かれる大きさ (ドット倍率を整数に丸めた後) で影と当たり判定を作る */
    const ssz0 = spriteSize(nm);
    sShadow(wk.x, GM - 0.5, ssz0 ? ssz0[0] * ssc * 0.7 : 30);
    const bob = useAnim ? 0 : (wk.sitting ? 0 : (frame % 2 ? 0 : -0.8));
    const drawn = sDrawSprite(nm, wk.x, GM + bob, ssc, flip);
    const ssz = drawn ? (spriteSize(nm) || [32, 24]) : null;
    let srect = ssz
      ? { x: wk.x - ssz[0] * ssc / 2, y: (GM + bob) - ssz[1] * ssc, w: ssz[0] * ssc, h: ssz[1] * ssc }
      : { x: wk.x - 17, y: GM - 30, w: 34, h: 30 };
    if(wk.carrying){ const t2 = Math.min(srect.y, GM - (ssz ? ssz[1] * ssc + 11 : 43)); srect.h += srect.y - t2; srect.y = t2; }
    stripHitRects.staff.push(srect);
    stripStaffArt.push(drawn ? { name: nm, gx: wk.x, gy: GM + bob, s: ssc, flip } : null);
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
        sDrawSprite("icon_memo", wk.x + bw * 0.26 * wk.dir, GM - bh * 0.8 + 1, 1);
      } else {
        sDrawSprite("icon_box", wk.x + bw * 0.26 * wk.dir, GM - bh * 0.8, 1);
      }
      /* A11（ux-r3 §2.4）: 運搬が始まった瞬間だけ、担当猫の頭上に荷物の印が
         少し浮かぶ（行き先が運搬に流れたことの景色側の合図） */
      if(wk.parcelFxAt && Date.now() - wk.parcelFxAt < 1400 && hasSprite("a11_parcel")){
        const pbob = Math.sin((Date.now() - wk.parcelFxAt) / 110) * 1.3;
        sDrawSprite("a11_parcel", wk.x, srect.y - 9 + pbob, 0.8);
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
    sShadow(exX, GM - 0.5, 34);
    sDrawSprite(nm, exX, GM, esc);
    const esz = spriteSize(nm);
    sctx.save();
    sctx.font = "9px sans-serif"; sctx.textAlign = "center"; sctx.textBaseline = "middle";
    sctx.fillText("🎗", exX, GM - (esz ? esz[1] * esc : 30) - 4);
    sctx.restore();
  });
  /* --- Sprint 3: 訪問猫（雇っていない毛柄が横切るだけ・干渉なし） ---
     バッチ6: その毛柄に ANIMS があれば歩行アニメで横切る */
  if(stripVisitor){
    const v = stripVisitor;
    const vbase = "staff_" + v.coat + "_walk";
    const va = ANIMS[vbase];
    if(va && va.frames.some(f => hasSprite(f))){
      sDrawStripWalker(v, GM);
    } else {
      sShadow(v.x, GM - 0.5, 30);
      const vbob = frame % 2 ? 0 : -0.8;
      sDrawSprite(vbase, v.x, GM + vbob, SPRITE_SCALES.strip.staff, v.dir < 0);
    }
  }
  /* --- Phase D: 子会社の配達猫（荷物を持って本社へ） --- */
  if(stripDelivery){
    const v = stripDelivery;
    sDrawStripWalker(v, GM);
    sDrawStripWalkerBox(v, GM);   /* 箱は描画実寸 bh 基準（固定 G-46 は廃止） */
  }
  if(stripModCart){
    const v = stripModCart;
    sDrawStripWalker(v, GM);
    sDrawStripWalkerBox(v, GM);   /* 箱は描画実寸 bh 基準（固定 G-46 は廃止） */
  }
  /* --- QAアヒル（デスク脇に常駐。中景キャラ） --- */
  if((S.upgrades.duck || 0) > 0){
    const dx = cx + 76;
    sShadow(dx, GM - 0.5, 24);
    const dnm = duckSprite();   /* Sprint 4: ANIMS の2フレーム再生 */
    const dgy = GM - (frame % 6 < 3 ? 0 : 0.8);
    sDrawSprite(dnm, dx, dgy, 1);
    const dsz = spriteSize(dnm) || [24, 20];
    stripHitRects.duck = { x: dx - dsz[0] / 2, y: dgy - dsz[1], w: dsz[0], h: dsz[1] };
    /* 2026-10-27: Lv 4〜7 で2羽、8〜10 で3羽 */
    for(let i = 1; i < duckCount(); i++){
      const ex = stripQAX() + 18 + i * 16;   /* 2羽目以降は QA トレイの右で検査する (信号柱の外側) */
      sShadow(ex, GM - 0.5, 20);
      sDrawSprite(dnm, ex, GM - ((frame + i * 3) % 6 < 3 ? 0 : 0.8), 1);
    }
  }
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
        if(!sDrawMiyuke("miyuke_code_a", cx + 6, seatY, SPRITE_SCALES.strip.miyuke)) sDrawMiyuke("miyuke_idle", cx + 12, seatY, SPRITE_SCALES.strip.miyuke);
      } else {
        const nm = codeFrameBit() ? "miyuke_code_a" : "miyuke_code_b";
        if(!sDrawMiyuke(nm, cx + 6, seatY, SPRITE_SCALES.strip.miyuke)) sDrawMiyuke("miyuke_idle", cx + 12, seatY, SPRITE_SCALES.strip.miyuke);
      }
    } else {
      const nm = catState === "think" ? "miyuke_think" : catState === "debug" ? "miyuke_debug" : "miyuke_sleep";
      sDrawMiyuke(nm, cx + 12, seatY, SPRITE_SCALES.strip.miyuke);
      /* バッチ2: sleep アニメ (Z 内蔵) 再生中は手続き Z を重ねない */
      if(catState === "nap" && catSprite("miyuke_sleep") === "miyuke_sleep") drawStripZ(cx + 40, seatY - 74);
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
  /* --- Sprint 4: 帯のクリックイベント（金の魚・バグの群れ） ---
     帯の上でクリックイベントとして描き、クリックで捕まえられる。
     報酬・制限時間は共有イベント側（catchFish / splatBug）がそのまま担う */
  if(fishEvent && stripFish){
    const hop = Math.abs(Math.sin(stripNow / 170)) * 3;
    const fx = stripFish.x;
    sShadow(fx, G - 0.5, 26);
    sDrawSprite("icon_fish", fx, G - 1 - hop, 0.8);
    if(frame % 8 < 4){ sDrawSprite("fx_spark_2", fx - 13, G - 10 - hop, 1); sDrawSprite("fx_spark_2", fx + 12, G - 12 - hop, 1); }
    stripHitRects.fish = { x: fx - 15, y: G - 20, w: 30, h: 22 };
  }
  drawStripStockBugs();   /* 在庫バグ (常に地面を這う。イベントのバグより奥) */
  if(bugEvent){
    for(const bg of bugEvent.bugs){
      const bp = stripBugXY(bg);
      const l0 = stripSpriteLog.length;
      /* 再設計 B12（ux-r3 §2.9）: フィーバーのバグは「的」として通常バグと区別する。
         A9（2026-11-02 みゅー作画）: 金の胴に的を背負った専用の絵が担う。
         絵が無い間だけ金の輪（UI の印）で示す */
      if(bugEvent.fever && hasSprite("a9_fever_target")){
        /* 絵の内容下端が icon_bug と同じ地面に着くよう 2px 押し下げる */
        sDrawSprite("a9_fever_target", bp.x, bp.y + 8, 0.75);
      } else {
        if(bugEvent.fever){
          sctx.save();
          sctx.strokeStyle = "rgba(240, 190, 60, 0.95)"; sctx.lineWidth = 1.4;
          sctx.beginPath(); sctx.arc(bp.x, bp.y + 6, 8 + (frame % 16 < 8 ? 0 : 1), 0, Math.PI * 2); sctx.stroke();
          sctx.restore();
        }
        sDrawSprite("icon_bug", bp.x, bp.y + 6, 0.7);
      }
      stripHitRects.bugs.push({ x: bp.x - 30, y: bp.y - 30, w: 60, h: 60, art: [l0, stripSpriteLog.length] });   /* 判定は見た目の約3倍 */
    }
  }
  /* 星飾りは棚の天板へ移行済み（drawStripShelf 内, §c.5） */
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
  drawStripWant(stripMiyukeX(), G);   /* v2.21.0: 集中力のおねだり */
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
