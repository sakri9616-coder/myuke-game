/* ================= Strip Canon: 帯の家具群 (§c 家具移行スペック) =================
   部屋シーンの視覚要素は全て帯の家具として再配置した。配置は R7 ゾーン制、
   高さは R5 予算（家具 ≤90 / 装飾 ≤40 / 背面物 ≤28）、影は R4 統一樣式。
   描画順は renderStrip が R3 の固定順（ラグ・影→背面物→家具→運搬物→キャラ→
   吹き出し→HUD）を守る */

/* 帯の作品棚スロット（棚板の実測位置・帯座標）。
   prop_shelf (40×28) を ×2 接地: 板の内側は 上段 yb=G-30 / 下段 yb=G-10、
   横は棚中心から 4 枠ずつ。スプライトが無い場合は手続き棚 (76×52) の 2 段×5 枠 */
function stripShelfSlots(){
  const scx = stripShelfCX(), G = STRIP_GROUND;
  const slots = [];
  if(hasSprite("prop_shelf")){
    for(const dx of [-25, -12.5, 0, 12.5]){
      slots.push({ x: scx + dx, yb: G - 30, w: 10, h: 9 });
      slots.push({ x: scx + dx, yb: G - 10, w: 10, h: 9 });
    }
  } else {
    for(let i = 0; i < 5; i++){
      slots.push({ x: scx - 30 + i * 12, yb: G - 36, w: 10, h: 9 });
      slots.push({ x: scx - 30 + i * 12, yb: G - 16, w: 10, h: 9 });
    }
  }
  return slots;
}
/* 並ぶ数は min(総リリース数≒ S.shelf.length, 枠数)。最新作は金枠グロー（旧部屋棚と同じ規則）。
   v2.3.3: 歩行ゲート ON の間は未配達分 (shelfPending) を先頭から伏せる —
   最新作の箱は、みゅけが棚まで運んで置いた瞬間に初めて現れる */
function stripShelfBoxes(){
  const slots = stripShelfSlots();
  const skip = hasWalkArt() ? Math.min(shelfPending, S.shelf.length) : 0;
  const view = skip ? S.shelf.slice(skip) : S.shelf;
  const n = Math.min(view.length, slots.length);
  const out = [];
  for(let i = 0; i < n; i++){
    const sl = slots[i];
    out.push({ x: sl.x, yb: sl.yb, w: sl.w, h: sl.h,
      color: SHELF_BOX_COLS[(view[i].icon || 0) % SHELF_BOX_COLS.length],
      glow: (i === 0 && frame < shelfGlowFrame) || !!view[i].ip });   /* 第2ウェーブ L: IP 作品は金の縁で常時点灯 */
  }
  return out;
}
/* 星屑特典「棚の星飾り」: 棚の天板に載る小物として統合 (§c.5。旧: デスク横の浮遊星) */
function drawStripStarOnShelf(scx, topY){
  const x = scx + 18, y = topY - 5 + (frame % 20 < 10 ? 0 : 0.7);
  sR(x - 2, y, 5, 5, "#ffd94d");
  sR(x - 1, y - 2, 3, 2, "#ffd94d"); sR(x - 1, y + 5, 3, 2, "#ffd94d");
  sR(x - 4, y + 1, 2, 3, "#ffd94d"); sR(x + 3, y + 1, 2, 3, "#ffd94d");
  sR(x, y + 2, 1, 1, "#fff3b0");
  if(frame % 30 < 4) sR(x + 6, y - 2, 2, 2, "#fff3b0");
}
/* 作品棚（ゾーン B, §c.2）: 柵セグメント（背面物）＋棚本体＋作品ボックス。
   「成果は左」という読み順を作るランドマーク（帯で唯一 90 単位級まで高い家具） */
function drawStripShelf(){
  const G = STRIP_GROUND, scx = stripShelfCX();
  const tier = officeTier(S);
  sRug(scx, 100);
  /* 背面の柵セグメント（高さ 24・幅 100 = R9 の許容背面物の上限）。
     tier>=2 では撤去する (オフィス化で最もテーマ外だった要素。
     OFFICE_ART_DIRECTION の DROP リスト) */
  if(tier < 2){
    const fy = G - 24;
    sR(scx - 50, fy + 6, 100, 2.4, "#a9835acc");
    sR(scx - 50, fy + 15, 100, 2.4, "#a9835acc");
    for(let i = 0; i < 5; i++) sR(scx - 48 + i * 24, fy, 3, 24, "#b08954cc");
  }
  sShadow(scx, G - 0.5, 72);
  let topY;
  /* tier>=2: 棚枠はスチール (shelf_steel 40×28 — prop_shelf と同一キャンバス・
     同一接地。板の上面はスロット基線 G-30/G-10 と正確に一致する) */
  const shelfDrawn = (tier >= 2 && sDrawSprite("shelf_steel", scx, G, 2)) ? "shelf_steel"
    : (sDrawSprite("prop_shelf", scx, G, 2) ? "prop_shelf" : null);
  if(shelfDrawn){
    stripObjArt.shelf = { name: shelfDrawn, gx: scx, gy: G, s: 2 };
    topY = G - 56;
  } else {
    /* フォールバック棚: 板2段の簡素な家具 (76×52) */
    sR(scx - 38, G - 52, 76, 52, "#8a6a44");
    sR(scx - 35, G - 49, 70, 43, "#6e5433");
    sR(scx - 38, G - 30, 76, 3, "#8a6a44");
    sR(scx - 38, G - 8, 76, 3, "#8a6a44");
    topY = G - 52;
  }
  const shelfBoxes = stripShelfBoxes();
  /* tier>=2: 技術書の列 (prop_books) を下段に置く。下段に作品箱が1つでも
     ある時は衝突するので出さない (空いている段だけの装飾) */
  if(tier >= 2 && !shelfBoxes.some(b => b.yb === G - 10)) sDrawSprite("prop_books", scx, G - 10, 2);
  for(const bx of shelfBoxes){
    sR(bx.x, bx.yb - bx.h, bx.w, bx.h, bx.color);
    sR(bx.x, bx.yb - bx.h + 3, bx.w, 1.2, "#00000033");
    if(bx.glow){
      sR(bx.x - 1, bx.yb - bx.h - 1, bx.w + 2, 1.2, "#ffd94d");
      sR(bx.x - 1, bx.yb, bx.w + 2, 1.2, "#ffd94d");
      sR(bx.x - 1, bx.yb - bx.h - 1, 1.2, bx.h + 2, "#ffd94d");
      sR(bx.x + bx.w, bx.yb - bx.h - 1, 1.2, bx.h + 2, "#ffd94d");
      if(frame % 6 < 3) sR(bx.x + bx.w + 1, bx.yb - bx.h - 3, 2, 2, "#fff3b0");
    }
  }
  if(hasPerk("stardecor")) drawStripStarOnShelf(scx, topY);
  /* 第2ウェーブ J: オフィスグレードの置物（レガシー技術・Codex 作画の小物） */
  if(legacyGrade() >= 1 && hasSprite("prop_star_gold")) sDrawSprite("prop_star_gold", scx - 30, topY + 2, 1);
  if(legacyGrade() >= 3 && hasSprite("prop_trophy_gold")) sDrawSprite("prop_trophy_gold", scx + 28, G - 8, 1);
  stripHitRects.shelf = { x: scx - 40, y: topY, w: 80, h: G - topY };
}
/* 研究ステーション（ゾーン C, §c.3）: 研究員が雇われた時だけ現れる小型机。
   本の山＋開いた本＋植木鉢。不在ならゾーンは空白（密度予算の自然な増減） */
function drawStripResearchStation(){
  const G = STRIP_GROUND, rcx = stripResearchCX();
  sRug(rcx, 84);
  sShadow(rcx, G - 0.5, 62);
  sR(rcx - 32, G - 14, 64, 3, "#b08954");
  sR(rcx - 32, G - 14, 64, 1.1, "#cfa06a");
  sR(rcx - 30, G - 11, 3, 11, "#8a6a44");
  sR(rcx + 27, G - 11, 3, 11, "#8a6a44");
  /* 本の山（机の左） */
  sR(rcx - 28, G - 17.5, 11, 3.5, "#4a90c2"); sR(rcx - 28, G - 17.5, 11, 1, "#ffffff55");
  sR(rcx - 27, G - 20.5, 9, 3, "#c25a7a"); sR(rcx - 27, G - 20.5, 9, 1, "#ffffff55");
  sR(rcx - 28.5, G - 23.5, 10, 3, "#5aa469");
  /* 開いた本（机の中央） */
  sR(rcx - 6, G - 16.5, 13, 2.5, "#fff5e6"); sR(rcx - 0.5, G - 16.5, 1, 2.5, "#d8c9ae");
  /* 植木鉢（研究机の右が既定）: prop_plant は装飾スロット級に小さく使う (§c.8)。
     Phase E で独立配置 (他の面にも載せられる) */
  const plantPl = propPlace("plant");
  if(!sDrawSprite("prop_plant", plantPl.cx, plantPl.baseY, 0.8)){
    sR(plantPl.cx - 3, plantPl.baseY - 6, 6, 6, "#7a5230"); sR(plantPl.cx - 5, plantPl.baseY - 12, 10, 6, "#5aa469"); sR(plantPl.cx - 2, plantPl.baseY - 15, 4, 4, "#6fbb7a");
  }
  /* Stage 3: 研究机クリック → 研究タブ */
  stripHitRects.research = { x: rcx - 34, y: G - 30, w: 68, h: 30 };
}
/* 第2ライン机（ゾーン D, §c.4）: 主机の小型版。部屋時代のコンベアは帯では
   再現しない（信号機図は工場パネルに一本化 §c.7） */
function drawStripDesk2(){
  const G = STRIP_GROUND, dcx = stripDesk2CX();
  sRug(dcx, 100);
  sShadow(dcx, G - 0.5, 74);
  /* バッチ14 (sakuri 作画): prop_desk2 は 64×64 (木の机＋ノートPC＋引き出し) に
     差し替え。旧 40×24 前提の desk_laminate_2_sprite (ティア連動の差し替え) は
     絵の形が合わないため使わず、全ティアで sakuri の机を使う。下端の透過
     3行分だけアンカーを押し下げて接地させる (prop_coffee と同じ流儀) */
  const drawn = sDrawSprite("prop_desk2", dcx, G + 6, 2);
  if(!drawn){
    sR(dcx - 40, G - 16, 80, 3, "#b08954");
    sR(dcx - 38, G - 13, 3, 13, "#8a6a44"); sR(dcx + 35, G - 13, 3, 13, "#8a6a44");
    sR(dcx - 12, G - 40, 24, 17, "#445464"); sR(dcx - 10, G - 38, 20, 13, "#2e4a3e");
  }
  drawStripDesk2Screen(dcx, G);
}
/* ライン2の進捗をモニタ内にダイジェティック表示（主モニタと同じ流儀 R10）。
   バッチ14: prop_desk2 (64×64) のノートPC画面域（原寸 x23..39, y29..39）は
   ×2 接地 (アンカー G+6) で (dcx-18..+14, G-62..G-42) */
function drawStripDesk2Screen(dcx, G){
  const q = S.line2.project;
  if(!q) return;
  const col = SHELF_BOX_COLS[(typeof q.icon === "number" ? q.icon : 0) % SHELF_BOX_COLS.length];
  sR(dcx - 16, G - 60, 4, 4, col);
  sR(dcx - 16, G - 58, 4, 1, "#00000033");
  const bx = dcx - 16, bw = 28;
  sR(bx, G - 48, bw, 3, "#101d16");
  if(q.planning){
    if(blinkOn(12, 7)) sR(bx + 1, G - 47, 3, 1, "#ffd94d");
  } else {
    const frac = Math.max(0, Math.min(1, S.line2.projectDP / q.totalDP));
    if(frac > 0) sR(bx, G - 48, Math.max(1, bw * frac), 3, "#7be495");
  }
  drawStripGitLog(stripGitLog2, dcx - 14, G - 54, 24);
}
