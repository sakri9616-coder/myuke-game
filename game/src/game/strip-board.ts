/* ---------- プロジェクトボード（帯の可読レイヤー） ----------
   「アプリの開発進捗が帯から一目で読めなきゃ意味ない」(sakuri) への構造的な答え。
   モニタ内の進捗 (R10 のダイジェティック詳細) は残し、その上に「離れて見て読める」
   層として、机クラスタの背後に立つ木枠ボードを常設する。
   配置の決定: 地面レベルの机クラスタ左端 (イーゼル 0.20W) は 1280px 幅では
   棚・PC・カレンダーに挟まれて太いバーの置き場がない。そこでボード面は
   クラスタ上空の完全に空いた帯 (y 4..34) に掲げ、支柱 2 本を机の背後に落とす。
   イーゼルは地上の装飾として存続し、ボードとは高さで住み分ける (置換しない)。
   支柱は細い標識柱で、棚の柵柱と同じ視覚重量級。歩行者・みゅけ・吹き出しは
   常にボードより手前に描かれる (R2)。中身の算数はメニューのヒーローカードと
   同一: frac = projectDP/totalDP、% は floor、目盛りは k/(feats+1) の節目位置 */
/* hMain: メインボードの高さ。机に座ったみゅけの耳 (y≒48) より上で収まる 44 にして、
   ボードの文字が彼女の頭や椅子の背に隠れないようにする (2026-10-27 整理。旧 64) */
const STRIP_BOARD = { top: 3, h: 30, w: 204, w2: 108, hMain: 44 };
/* メインボードの進捗バーの位置 (描画と付箋アニメの着地点で共有) */
function mainBoardBar(bx){
  return { x: bx + 4, y: STRIP_BOARD.top + 19.5, w: STRIP_BOARD.w - 8, h: 7.5 };
}
/* ボードの吊りメモ札（幅150）。はみ出す文は … で切る */
function drawStripMemoTag(mx0, my0, memoTxt, width?){
  const mw = width || 150;
  const memoGold = !!S.bigDeal;   /* Phase C: 大型案件の間はメモが金色に明滅（色＋動きの二経路） */
  sR(mx0, my0, mw, 16, memoGold ? "#d9a41a" : "#8a6a44");
  sR(mx0 + 1.5, my0 + 1.5, mw - 3, 13, memoGold && blinkOn(50, 25) ? "#ffe9a8" : "#fff5e6");
  sR(mx0 + 5, my0 - 0.5, 3, 3, "#e2543e");
  sctx.save();
  sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.textAlign = "left"; sctx.textBaseline = "middle"; sctx.fillStyle = "#4a3b2c";
  sctx.fillText(fitMemoText(memoTxt, mw - 10), mx0 + 5, my0 + 8.4);
  sctx.restore();
  stripHitRects.memo = { x: mx0, y: my0, w: mw, h: 16 };
}
/* メモ文を幅 maxW に収める (現在の sctx.font で測る)。末尾の「（あと 28🪙）」のような
   括弧書きは、目的の達成に要る数字なので残し、前半を … で詰める */
function fitMemoText(mt, maxW){
  if(sctx.measureText(mt).width <= maxW) return mt;
  const open = mt.lastIndexOf("（");
  const tail = (open > 0 && mt.endsWith("）")) ? mt.slice(open) : "";
  let head = tail ? mt.slice(0, open) : mt;
  while(head.length > 1 && sctx.measureText(head + "…" + tail).width > maxW - 3) head = head.slice(0, -1);
  return head + "…" + tail;
}
function projectBoardModel(p, dp){
  if(!p) return { has: false, frac: 0, pct: -1, ticks: [], planning: false };
  if(p.planning){
    const cost = p.ideaCost || 0;
    const frac = cost > 0 ? Math.max(0, Math.min(1, Math.floor(S.ideas) / cost)) : 0;
    return { has: true, frac, pct: -1, ticks: [], planning: true };
  }
  const frac = Math.max(0, Math.min(1, dp / p.totalDP));
  const ticks = [];
  const n = (p.feats ? p.feats.length : 0);
  for(let k = 1; k <= n; k++) ticks.push(k / (n + 1));
  return { has: true, frac, pct: Math.floor(frac * 100), ticks, planning: false };
}
function drawStripProjectBoard(bcx, bw, p, dp, key, small){
  const G = STRIP_GROUND, top = STRIP_BOARD.top;
  const bh = small ? STRIP_BOARD.h : STRIP_BOARD.hMain;
  const bx = Math.round(bcx - bw / 2);
  const m = projectBoardModel(p, dp);
  /* 詰まりの視覚信号はボードが担う (帯の ⚠ はここが一目で読める形)。
     帰属ラインが決まらない詰まりは第1ラインのボードに寄せる (二重表示にしない) */
  const bnAll = currentBottleneck();
  const bn = bnAll && (small ? bnAll.line === 2 : bnAll.line !== 2) ? bnAll : null;
  /* 支柱と足 (机本体より先に描く: 支柱は机・PC・みゅけの背後に落ちる) */
  sShadow(bcx, G - 0.5, bw * 0.66);
  for(const px of [bx + 9, bx + bw - 12]){
    sR(px, top + bh - 2, 3, G - (top + bh - 2), "#8a6a44");
    sR(px - 1.5, G - 2, 6, 2, "#8a6a44");
  }
  /* ボード面: tier 0 は木枠 + 紙面。tier>=1 のメインはワイドカンバン面
     (prop_kanban_wide 204×64・全面クリアに生地の行を描く)。小型ボードは木枠 */
  const ix = bx + 2.5, iy = top + 2.5, iw = bw - 5, ih = bh - 5;
  const wideFace = !small && officeTier(S) >= 1 && sDrawSpriteStretchV("prop_kanban_wide", bcx, top + bh, bh, 4);
  if(!wideFace){
    sR(bx, top, bw, bh, "#8a6a44");
    sR(bx, top, bw, 1.6, "#cfa06a");
    sR(ix, iy, iw, ih, "#fff5e6");
  }
  /* リリース直後は金枠で脈打つ (棚の最新作グローと同じ言語) */
  const noteLandAt = small ? stripBoardPulseAt2 : stripBoardPulseAt;
  if(((!small && lastReleaseInfo && Date.now() - lastReleaseInfo.at < 6000) ||
      stripNow - noteLandAt < 650) && frame % 6 < 3){
    sR(bx - 1, top - 1, bw + 2, 1.4, "#ffd94d"); sR(bx - 1, top + bh - 0.4, bw + 2, 1.4, "#ffd94d");
    sR(bx - 1, top - 1, 1.4, bh + 2, "#ffd94d"); sR(bx + bw - 0.4, top - 1, 1.4, bh + 2, "#ffd94d");
  }
  /* 小型ボード (第2ライン) は従来の姿: 完成 feat の付箋が上枠にピン留めされる */
  if(small && p && !m.planning && p.doneFeats > 0){
    const nFeats = p.feats ? p.feats.length : 0;
    for(let k = 0; k < Math.min(p.doneFeats, nFeats); k++){
      const nx = bx + 18 + k * 6.5, ny = top + 2.5;
      sDrawSprite("icon_note_" + (k % 4), nx + 2.5, ny + 8, 2);
    }
  }
  /* 作品アイコン (棚に載る箱と同色 = 「この色の箱が増える」の予告編) */
  const col = p ? SHELF_BOX_COLS[(typeof p.icon === "number" ? p.icon : 0) % SHELF_BOX_COLS.length] : "#9a8f85";
  if(!m.planning || blinkOn(12, 7)){   /* 企画中はモニタと同じ点滅 */
    sR(ix + 1.5, iy + 1.5, 12, 12, col);
    sR(ix + 1.5, iy + 4.5, 12, 1.2, "#00000033");
  }
  if(small){
    /* ===== 小型ボード (第2ライン): % + 太バーだけの従来形 ===== */
    sctx.save();
    sctx.font = "700 15px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "left"; sctx.textBaseline = "middle";
    sctx.fillStyle = bn ? "#d9534f" : "#4a3b2c";
    sctx.fillText(m.planning ? "💡" : (!m.has ? "—" : Math.round(m.frac * 100) + "%"), ix + 16.5, iy + 8);
    sctx.restore();
    if(bn){
      sR(ix + iw - 13.5, iy + 1, 11, 11, "#e2543e");
      sctx.save();
      sctx.font = "700 8px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.textAlign = "center"; sctx.textBaseline = "middle"; sctx.fillStyle = "#fff5e6";
      sctx.fillText("⚠", ix + iw - 8, iy + 6.8);
      sctx.restore();
    }
    const sBarY = iy + ih - 9.5;
    sR(ix + 0.7, sBarY - 0.8, iw - 1.4 + 1.6, 9.1, "#604B40");
    sR(ix + 1.5, sBarY, iw - 3, 7.5, "#101d16");
    if(m.frac > 0)
      sR(ix + 1.5, sBarY, Math.max(1, (iw - 3) * m.frac), 7.5, bn ? "#e2543e" : (m.planning ? "#ffd94d" : "#7be495"));
    for(const t of m.ticks) sR(ix + 1.5 + Math.round((iw - 3) * t), sBarY, 1.2, 7.5, "#fff3b0");
    stripHitRects[key] = { x: bx, y: top, w: bw, h: bh };
    return;
  }
  /* ===== リーダーボード (メイン) =====
     2026-10-27 整理 (sakuri:「情報量がごちゃごちゃ」): 帯から一目で読むべきものだけを
     3行に残し、細部はメニューのヒーローカード (クリックで開く) に任せる。
       r1: 進捗 % (主役の数字は1つだけ) + 『作品名』 + ジャンル (詰まり時は ⚠)
       r2: 太い進捗バー (節目の目盛り付き)
       r3: 左 = いま気にすること1つ / 右 = 集中力メーター + コイン
     ボードから外したもの: 説明文・DP 実数・規模ピル・機能チップ列・生産 +N%・QA・
     バグ在庫 (どれもメニューに同じ表示がある)。吊りメモとコイン札はボードの中へ */
  sctx.save();
  sctx.textAlign = "left"; sctx.textBaseline = "middle";
  /* r1: 大 % + 『作品名』 + 右端にジャンルピル (詰まり時は ⚠ プレート) */
  sctx.font = "700 19px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.fillStyle = bn ? "#d9534f" : "#4a3b2c";
  const pctTxt = m.planning ? "💡" : (!m.has ? "—" : Math.round(m.frac * 100) + "%");
  sctx.fillText(pctTxt, ix + 16.5, iy + 8.5);
  const pctW = sctx.measureText(pctTxt).width;
  if(p){
    sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    /* 第2ウェーブ L: ジャンルピルに市場の流れと IP 指定を足す */
    const genreTxt = p.genreName ? p.genreName + trendTag(p.genre) + (p.ip ? "🏷" : "") : "";
    const genreW = genreTxt ? sctx.measureText(genreTxt).width + 6 : 0;
    const slotW = bn ? 15 : genreW;
    const nameLim = ix + iw - 3 - slotW;
    const nx = ix + 16.5 + pctW + 5;
    sctx.font = "700 11px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.fillStyle = "#4a3b2c";
    let nm = "『" + p.name + "』";
    if(nx + sctx.measureText(nm).width > nameLim){
      let cut = p.name;
      while(cut.length > 1 && nx + sctx.measureText("『" + cut + "…』").width > nameLim) cut = cut.slice(0, -1);
      nm = "『" + cut + "…』";
    }
    sctx.fillText(nm, nx, iy + 8.5);
    if(bn){
      sR(ix + iw - 13.5, iy + 2, 11, 11, "#e2543e");
      sctx.font = "700 9.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.textAlign = "center"; sctx.fillStyle = "#fff5e6";
      sctx.fillText("⚠", ix + iw - 8, iy + 8);
      sctx.textAlign = "left";
    } else if(genreW){
      const gx = ix + iw - 3 - genreW;
      sR(gx, iy + 2.5, genreW, 11.5, col);
      sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.fillStyle = "#fff5e6"; sctx.textAlign = "center";
      sctx.fillText(genreTxt, gx + genreW / 2, iy + 8.3);
      sctx.textAlign = "left";
    }
  }
  /* r2: 太いバー (節目ティック付き)。枠→溝→充填→目盛りの順 */
  const bar = mainBoardBar(bx);
  sR(bar.x - 0.8, bar.y - 0.8, bar.w + 1.6, bar.h + 1.6, "#604B40");
  sR(bar.x, bar.y, bar.w, bar.h, "#101d16");
  if(m.frac > 0)
    sR(bar.x, bar.y, Math.max(1, bar.w * m.frac), bar.h, bn ? "#e2543e" : (m.planning ? "#ffd94d" : "#7be495"));
  for(const t of m.ticks) sR(bar.x + Math.round(bar.w * t), bar.y, 1.2, bar.h, "#fff3b0");
  /* r3 右から: コイン札 → 集中力メーター (数字ではなく残量で見せる) */
  const ry = iy + 27, rh = 11, rcy = ry + rh / 2 + 0.3;
  sctx.font = "700 8px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  const coinTxt = "🪙 " + fmt(Math.floor(S.coins));
  const coinW = Math.max(36, sctx.measureText(coinTxt).width + 9);
  const coinX = ix + iw - 1.5 - coinW;
  sR(coinX, ry, coinW, rh, "#8a6a44");
  sR(coinX + 1, ry + 1, coinW - 2, rh - 2, "#d9b23a");
  sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "center";
  sctx.fillText(coinTxt, coinX + coinW / 2, rcy);
  sctx.textAlign = "left";
  const concW = 18, concX = coinX - 4 - concW;
  sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  const brainW = sctx.measureText("🧠").width;
  sctx.fillText("🧠", concX - brainW - 1.5, rcy);
  const conc = Math.max(0, Math.min(100, S.concentration)) / 100;
  sR(concX, ry + 3, concW, 5, "#604B40");
  if(conc > 0) sR(concX + 1, ry + 4, Math.max(1, (concW - 2) * conc), 3, "#5aa4c2");
  /* r3 左: いま気にすること1つ (企画中の案内 > メモ > 詰まり > 次の機能) */
  const lx = ix + 1.5, lw = concX - brainW - 5 - lx;
  const memoTxt = stripMemoText();
  const memoHere = memoTxt && !propEntry("memo") && layoutEdit.dragId !== "memo";
  if(p && m.planning){
    sctx.fillStyle = "#8a6a44";
    sctx.fillText(fitMemoText("💡 アイデア あと " + Math.max(0, (p.ideaCost || 0) - Math.floor(S.ideas)) + " 個で着工", lw), lx, rcy);
  } else if(memoHere){
    /* 吊りメモはボードの中の付箋に (クリック先・大型案件の金色の明滅は従来どおり) */
    const memoGold = !!S.bigDeal;
    sR(lx, ry, lw, rh, memoGold ? "#d9a41a" : "#d8c9ae");
    sR(lx + 1, ry + 1, lw - 2, rh - 2, memoGold && blinkOn(50, 25) ? "#ffe9a8" : "#f3e7cd");
    sR(lx + 3, ry + 3.5, 3, 3, "#e2543e");
    sctx.fillStyle = "#4a3b2c";
    sctx.fillText(fitMemoText(memoTxt, lw - 10), lx + 8, rcy);
    stripHitRects.memo = { x: lx, y: ry, w: lw, h: rh };
  } else if(p && bn){
    sctx.fillStyle = "#d9534f";
    /* 工程名で言う (旧表示は第2ラインが無いと「第nullライン」になっていた) */
    const stName = { plan: "企画", code: "実装", test: "テスト", build: "ビルド", ship: "出荷" }[bnAll.stage] || "工程";
    sctx.fillText(fitMemoText("⚠ " + stName + "が詰まり中" + (bnAll.line ? "（第" + bnAll.line + "ライン）" : ""), lw), lx, rcy);
  } else if(p && p.feats && p.feats.length){
    const done = Math.min(p.doneFeats || 0, p.feats.length);
    const txt = done < p.feats.length
      ? "▸ 次の機能：" + p.feats[done] + "（" + done + "/" + p.feats.length + "）"
      : "▸ 仕上げ中（" + done + "/" + p.feats.length + "）";
    sctx.fillStyle = "#8a6a44";
    sctx.fillText(fitMemoText(txt, lw), lx, rcy);
  }
  sctx.restore();
  /* Wave H: モジュールチップ列（ボード右側に吊るす縦タグ — ボード下は
     机と猫に遮られるため側面に置く）。統合待ちでテスト済みが詰まって
     いる間は赤く明滅する（動き＋色の二経路） */
  if(!small && p && p.modules && p.modules.length){
    const waiting = !modulesDone(p) && S.wip.tested >= 30;
    const blink = waiting && (motionReduced() || Math.floor(stripNow / 400) % 2 === 0);
    const cw = 66;
    sctx.save();
    sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "center"; sctx.textBaseline = "middle";
    p.modules.forEach((md, i) => {
      const cxp = bx + bw + 4, cyp = top + 14 + i * 13;
      const done = moduleComplete(md);
      sR(cxp, cyp, cw, 11, blink ? "#e2543e" : (done ? "#58a64a" : "#2d2d2d"));
      sR(cxp, cyp, cw, 1, done ? "#3d7a34" : "#454545");
      sctx.fillStyle = "#f5efe2";
      const label = md.name + " " + (md.out ? "外注" : done ? "★" + moduleQuality(md).toFixed(1) : Math.min(100, Math.floor(md.inv / md.need * 100)) + "%");
      sctx.fillText(label, cxp + cw / 2, cyp + 5.8);
    });
    sctx.restore();
    sctx.textAlign = "left";
  }
  /* Phase B・社格チップ（リーダーボード右上）: r1 は作品名＋ピル、r2 は DP 実数＋
     生産 +N% で既に満杯で、ボード上端は帯の上端から 3px しかないため、面の中に
     押し込まず右端にタブとして張り出す。帯の上段はボード以外に高い家具がなく、
     右隣の家具（研究机・第2ライン机）は地面側の低い物なので重ならない。
     端に寄せた配置では反対側へ逃がし、両端とも入らなければ出さない（表示のみで
     クリック判定は持たない。社格の確認はメニューのチップでもできる） */
  {
    const rankTxt = companyRank() + " " + S.staff.length + "/" + staffCap() + "人" +
      (S.subs && S.subs.length ? " ・ グループ" + S.subs.length + "社・総勢" + totalPeople() + "人" : "") +
      (S.holdings ? " ・ 持株×" + S.holdings : "") +   /* 第2ウェーブ J: 持株化の回数が帯でも読める */
      (S.challenge ? " ・ 🎯" + (challengeDef(S.challenge.id) || {}).name : "");   /* 第2ウェーブ K: 挑戦中は帯でも分かる */
    sctx.save();
    sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "left"; sctx.textBaseline = "middle";
    const tw = sctx.measureText(rankTxt).width + 10;
    let tx = bx + bw + 1;
    if(tx + tw > stripVW - 2) tx = bx - tw - 1;
    if(tx >= 1){
      sR(tx, top + 1, tw, 12, "#8a6a44");
      sR(tx + 1, top + 2, tw - 2, 10, "#fff5e6");
      sctx.fillStyle = "#4a3b2c";
      sctx.fillText(rankTxt, tx + 5, top + 7);
    }
    sctx.restore();
  }
  /* Stage 3: ボードに付く小物 — 電話 (スタッフ)。コイン残高はボード r3 の札に移した。
     Phase E: 電話は独立した配置項目 (propPlace)。既定ではボード左端についてくるが、
     ドラッグで切り離せば机や棚の上にも載る。メモは切り離した時だけ下のブロックで描く */
  const phonePl = propPlace("phone");
  if(!tutTabLocked("staff") && sDrawSprite("prop_phone", phonePl.cx, phonePl.baseY, 1)){
    stripObjArt.phone = { name: "prop_phone", gx: phonePl.cx, gy: phonePl.baseY, s: 1 };
    stripHitRects.phone = { x: phonePl.cx - 12, y: phonePl.baseY - 24, w: 24, h: 24 };
    if(S.staff.length < staffCap() && Object.keys(STAFF_ROLES).some(r => hireCost(r) <= S.coins) && blinkOn(50, 30)){
      /* 雇用可能の合図: 電話の右上に付く小さな金バッジ (上下の帯状ラインは
         ホバーの輪と紛れるため v2.4.7 で廃止) */
      sR(phonePl.cx + 7.5, phonePl.baseY - 27.5, 4.4, 4.4, "#ffd94d");
      sR(phonePl.cx + 9.1, phonePl.baseY - 26.6, 1.2, 2.6, "#4a3b2c");
    }
  }
  const memoDet = stripMemoText();
  if(memoDet && (propEntry("memo") || layoutEdit.dragId === "memo")){
    /* Phase E: メモを掴んで切り離した姿 — ボードから独立し、地面に立つ札になる */
    const memoPl = propPlace("memo");
    drawStripMemoTag(memoPl.cx - 75, memoPl.baseY - 16, memoDet);
  }
  stripHitRects[key] = { x: bx, y: top, w: bw, h: bh };
}
function drawStripProjectBoardMain(){
  drawStripProjectBoard(propPlace("board").cx, STRIP_BOARD.w, S.project, S.projectDP, "board", false);
}
function drawStripProjectBoard2(){
  drawStripProjectBoard(stripDesk2CX(), STRIP_BOARD.w2, S.line2.project, S.line2.projectDP, "board2", true);
}

