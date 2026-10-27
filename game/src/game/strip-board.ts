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
const STRIP_BOARD = { top: 3, h: 30, w: 204, w2: 108 };
/* ボードの吊りメモ札（幅150）。はみ出す文は … で切る */
function drawStripMemoTag(mx0, my0, memoTxt){
  const mw = 150;
  const memoGold = !!S.bigDeal;   /* Phase C: 大型案件の間はメモが金色に明滅（色＋動きの二経路） */
  sR(mx0, my0, mw, 16, memoGold ? "#d9a41a" : "#8a6a44");
  sR(mx0 + 1.5, my0 + 1.5, mw - 3, 13, memoGold && frame % 50 < 25 ? "#ffe9a8" : "#fff5e6");
  sR(mx0 + 5, my0 - 0.5, 3, 3, "#e2543e");
  sctx.save();
  sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.textAlign = "left"; sctx.textBaseline = "middle"; sctx.fillStyle = "#4a3b2c";
  let mt = memoTxt;
  if(sctx.measureText(mt).width > mw - 10){
    while(mt.length > 1 && sctx.measureText(mt).width > mw - 13) mt = mt.slice(0, -1);
    mt += "…";
  }
  sctx.fillText(mt, mx0 + 5, my0 + 8.4);
  sctx.restore();
  stripHitRects.memo = { x: mx0, y: my0, w: mw, h: 16 };
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
/* リーダーボードの feat チップ配置 (描画と付箋アニメの着地点で共有)。
   帯のメインボード = プロジェクトボード × メニューのヒーローカードの統合
   (2026-10-25 sakuri: 同じ機能はリーダーボード状の1枚にまとめる) */
function featChipRects(p, ix, iw){
  if(!p || !p.feats || !p.feats.length) return [];
  sctx.save();
  sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  let maxLen = Math.max(...p.feats.map(f => f.length));
  const build = () => p.feats.map((f, k) => {
    let nm = f;
    if(nm.length > maxLen) nm = nm.slice(0, maxLen) + "…";
    const label = (k < p.doneFeats ? "✅ " : "⬜ ") + nm;
    return { label, w: sctx.measureText(label).width + 9, done: k < p.doneFeats };
  });
  let chips = build();
  let total = chips.reduce((a, c) => a + c.w, 0) + (chips.length - 1) * 3;
  while(total > iw - 3 && maxLen > 2){
    maxLen--;
    chips = build();
    total = chips.reduce((a, c) => a + c.w, 0) + (chips.length - 1) * 3;
  }
  let x = ix + 1.5;
  for(const c of chips){ c.x = x; x += c.w + 3; }
  sctx.restore();
  return chips;
}
function drawStripProjectBoard(bcx, bw, p, dp, key, small){
  const G = STRIP_GROUND, top = STRIP_BOARD.top;
  const bh = small ? STRIP_BOARD.h : 64;   /* メインはリーダーボード (204×64) */
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
  const wideFace = !small && officeTier(S) >= 1 && sDrawSprite("prop_kanban_wide", bcx, top + bh, 1);
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
      sR(nx, ny, 5, 5, FLOW_CARD_COLS[k % FLOW_CARD_COLS.length]);
      sR(nx, ny, 5, 1.2, "#00000022");
    }
  }
  /* 作品アイコン (棚に載る箱と同色 = 「この色の箱が増える」の予告編) */
  const col = p ? SHELF_BOX_COLS[(typeof p.icon === "number" ? p.icon : 0) % SHELF_BOX_COLS.length] : "#9a8f85";
  if(!m.planning || frame % 12 < 7){   /* 企画中はモニタと同じ点滅 */
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
  /* ===== リーダーボード (メイン): ヒーローカードの全行をボードの面に ===== */
  sctx.save();
  sctx.textAlign = "left"; sctx.textBaseline = "middle";
  /* r1: 大 % + 『作品名』 + 右端にジャンル/規模ピル (詰まり時は ⚠ プレート) */
  sctx.font = "700 19px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  sctx.fillStyle = bn ? "#d9534f" : "#4a3b2c";
  const pctTxt = m.planning ? "💡" : (!m.has ? "—" : Math.round(m.frac * 100) + "%");
  sctx.fillText(pctTxt, ix + 16.5, iy + 9);
  const pctW = sctx.measureText(pctTxt).width;
  if(p){
    /* 右端スロット: ピル2つ (幅を測って名前の上限を決める) */
    sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    const sizeTxt = p.size + " / " + fmt(p.totalDP) + "DP";
    const sizeW = sctx.measureText(sizeTxt).width + 6;
    /* 第2ウェーブ L: ジャンルピルに市場の流れと IP 指定を足す */
    const genreTxt = p.genreName ? p.genreName + trendTag(p.genre) + (p.ip ? "🏷" : "") : "";
    const genreW = genreTxt ? sctx.measureText(genreTxt).width + 6 : 0;
    const slotW = bn ? 15 : sizeW + (genreW ? genreW + 3 : 0);
    const nameLim = ix + iw - 3 - slotW;
    let nx = ix + 16.5 + pctW + 5;
    sctx.font = "700 11px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.fillStyle = "#4a3b2c";
    let nm = "『" + p.name + "』";
    if(nx + sctx.measureText(nm).width > nameLim){
      let cut = p.name;
      while(cut.length > 1 && nx + sctx.measureText("『" + cut + "…』").width > nameLim) cut = cut.slice(0, -1);
      nm = "『" + cut + "…』";
    }
    sctx.fillText(nm, nx, iy + 9);
    if(bn){
      sR(ix + iw - 13.5, iy + 1, 11, 11, "#e2543e");
      sctx.font = "700 9.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.textAlign = "center"; sctx.fillStyle = "#fff5e6";
      sctx.fillText("⚠", ix + iw - 8, iy + 7);
      sctx.textAlign = "left";
    } else {
      let px2 = ix + iw - 3 - sizeW;
      sR(px2, iy + 3, sizeW, 11.5, "#e8dcc4");
      sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "center";
      sctx.fillText(sizeTxt, px2 + sizeW / 2, iy + 8.8);
      if(genreW){
        px2 -= genreW + 3;
        sR(px2, iy + 3, genreW, 11.5, col);
        sctx.fillStyle = "#fff5e6";
        sctx.fillText(genreTxt, px2 + genreW / 2, iy + 8.8);
      }
      sctx.textAlign = "left";
    }
    /* r2: 説明文 (企画中は着工までの案内) */
    sctx.font = "7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.fillStyle = "#8a6a44";
    let r2 = "";
    if(m.planning) r2 = "💡 企画中： アイデア あと " + Math.max(0, (p.ideaCost || 0) - Math.floor(S.ideas)) + " 個で着工（必要 " + (p.ideaCost || 0) + " 個）";
    else if(p.desc) r2 = p.desc;
    /* r2 右端: 進捗 DP 実数 + 生産 +N% (集中力 redesign の表示移設先。r5 中央は
       机のみゅけの頭に隠れるため、説明行の空いた右へ置く — DP 実数と同じ前例。
       企画中は生産が発生しないため DP 実数と同じ !planning ゲートに載せる) */
    const dpTxt = !m.planning ? "📈 " + fmt(Math.floor(dp)) + " / " + fmt(p.totalDP) + " DP" : "";
    const prodTxt = !m.planning ? "生産 +" + Math.round((concProdMult() - 1) * 100) + "%" : "";
    if(r2){
      let lim = iw - 6;
      if(!m.planning) lim -= sctx.measureText(dpTxt).width + 7 + sctx.measureText(prodTxt).width + 7;
      while(r2.length > 1 && sctx.measureText(r2).width > lim) r2 = r2.slice(0, -1);
      sctx.fillText(r2, ix + 2, iy + 20.5);
    }
    if(!m.planning){
      sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
      sctx.fillStyle = "#4a3b2c"; sctx.textAlign = "right";
      sctx.fillText(prodTxt, ix + iw - 3 - sctx.measureText(dpTxt).width - 7, iy + 20.5);
      sctx.fillText(dpTxt, ix + iw - 3, iy + 20.5);
      sctx.textAlign = "left";
    }
  }
  /* r3: 太いバー (節目ティック付き)。枠→溝→充填→目盛りの順 */
  const barX = ix + 1.5, barW = iw - 3, barY = iy + 26.5, barH = 7.5;
  sR(barX - 0.8, barY - 0.8, barW + 1.6, barH + 1.6, "#604B40");
  sR(barX, barY, barW, barH, "#101d16");
  if(m.frac > 0)
    sR(barX, barY, Math.max(1, barW * m.frac), barH, bn ? "#e2543e" : (m.planning ? "#ffd94d" : "#7be495"));
  for(const t of m.ticks) sR(barX + Math.round(barW * t), barY, 1.2, barH, "#fff3b0");
  /* r4: feat チップ列 (ヒーローの featchip そのまま: ✅/⬜ + 名前) */
  if(p && !m.planning && p.feats && p.feats.length){
    const chips = featChipRects(p, ix, iw);
    sctx.font = "700 7px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "center";
    for(const c of chips){
      sR(c.x, iy + 37.5, c.w, 10.5, c.done ? "#7be495" : "#f3e7cd");
      sR(c.x, iy + 37.5, c.w, 1, c.done ? "#4da868" : "#d8c9ae");
      sctx.fillStyle = "#4a3b2c";
      sctx.fillText(c.label, c.x + c.w / 2, iy + 42.8);
    }
    sctx.textAlign = "left";
  }
  /* r5: 集中力 + 進捗DP + QA + バグ在庫 (ヒーローの concrow / chiprow) */
  sctx.font = "700 7.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
  const ry = iy + 52.5;
  const conc = Math.round(S.concentration);
  sctx.fillStyle = "#4a3b2c";
  sctx.fillText("🧠 集中力", ix + 2, ry);
  const cbX = ix + 2 + sctx.measureText("🧠 集中力").width + 3;
  sR(cbX, ry - 2.7, 30, 5.4, "#604B40");
  sR(cbX + 1, ry - 1.6, 28 * Math.max(0, Math.min(100, conc)) / 100, 3.2, "#5aa4c2");
  sctx.fillText(conc + "%", cbX + 33, ry);
  let mx = cbX + 33 + sctx.measureText(conc + "%").width + 7;
  if(p && !m.planning && bn){
    sctx.fillStyle = "#d9534f";
    sctx.fillText("⚠ 詰まりは第" + bnAll.line + "ライン", mx, ry);
  }
  if(p && !m.planning){
    sctx.textAlign = "right";
    const bugTxt = "🐛 " + fmt(Math.floor(S.bugStock));
    sctx.fillStyle = S.bugStock > 0 ? "#d9534f" : "#4a3b2c";
    sctx.fillText(bugTxt, ix + iw - 3, ry);
    sctx.fillStyle = "#4a3b2c";
    sctx.fillText("🔍 QA " + qaRate().toFixed(1) + "/分", ix + iw - 3 - sctx.measureText(bugTxt).width - 7, ry);
    sctx.textAlign = "left";
  }
  sctx.restore();
  /* Wave H: モジュールチップ列（ボード右側に吊るす縦タグ — ボード下は
     机と猫に遮られるため側面に置く）。統合待ちでテスト済みが詰まって
     いる間は赤く明滅する（動き＋色の二経路） */
  if(!small && p && p.modules && p.modules.length){
    const waiting = !modulesDone(p) && S.wip.tested >= 30;
    const blink = waiting && (Math.floor(stripNow / 400) % 2 === 0);
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
  /* Stage 3: ボードに付く小物 — 電話 (スタッフ) と真鍮タグ (コイン残高・表示のみ)。
     Phase E: 電話は独立した配置項目 (propPlace)。既定ではボード左端についてくるが、
     ドラッグで切り離せば机や棚の上にも載る。吊りメモは下のブロックで同様に解決 */
  const phonePl = propPlace("phone");
  if(!tutTabLocked("staff") && sDrawSprite("prop_phone", phonePl.cx, phonePl.baseY, 1)){
    stripObjArt.phone = { name: "prop_phone", gx: phonePl.cx, gy: phonePl.baseY, s: 1 };
    stripHitRects.phone = { x: phonePl.cx - 12, y: phonePl.baseY - 24, w: 24, h: 24 };
    if(S.staff.length < staffCap() && Object.keys(STAFF_ROLES).some(r => hireCost(r) <= S.coins) && frame % 50 < 30){
      /* 雇用可能の合図: 電話の右上に付く小さな金バッジ (上下の帯状ラインは
         ホバーの輪と紛れるため v2.4.7 で廃止) */
      sR(phonePl.cx + 7.5, phonePl.baseY - 27.5, 4.4, 4.4, "#ffd94d");
      sR(phonePl.cx + 9.1, phonePl.baseY - 26.6, 1.2, 2.6, "#4a3b2c");
    }
  }
  const memoTxt = stripMemoText();
  if(memoTxt && (propEntry("memo") || layoutEdit.dragId === "memo")){
    /* Phase E: メモを掴んで切り離した姿 — ボードから独立し、地面に立つ札になる */
    const memoPl = propPlace("memo");
    drawStripMemoTag(memoPl.cx - 75, memoPl.baseY - 16, memoTxt);
  }
  if(memoTxt && !propEntry("memo") && layoutEdit.dragId !== "memo"){
    sR(bx + 14, top + bh - 1, 2, 3, "#604B40"); sR(bx + 138, top + bh - 1, 2, 3, "#604B40");
    drawStripMemoTag(bx + 4, top + bh + 2, memoTxt);
  }
  {
    const tw = 68, tx0 = bx + bw - 4 - tw, ty0 = top + bh + 2;
    sR(bx + bw - 18, top + bh - 1, 2, 3, "#604B40");
    sR(tx0, ty0, tw, 16, "#8a6a44");
    sR(tx0 + 1.5, ty0 + 1.5, tw - 3, 13, "#d9b23a");
    sctx.save();
    sctx.font = "700 8.5px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "center"; sctx.textBaseline = "middle"; sctx.fillStyle = "#4a3b2c";
    sctx.fillText("🪙 " + fmt(Math.floor(S.coins)), tx0 + tw / 2, ty0 + 8.4);
    sctx.restore();
  }
  stripHitRects[key] = { x: bx, y: top, w: bw, h: bh };
}
function drawStripProjectBoardMain(){
  drawStripProjectBoard(propPlace("board").cx, STRIP_BOARD.w, S.project, S.projectDP, "board", false);
}
function drawStripProjectBoard2(){
  drawStripProjectBoard(stripDesk2CX(), STRIP_BOARD.w2, S.line2.project, S.line2.projectDP, "board2", true);
}

