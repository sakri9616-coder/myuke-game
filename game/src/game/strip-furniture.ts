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
      ci: projectColorIdx(view[i]),
      glow: (i === 0 && frame < shelfGlowFrame) || !!view[i].ip });   /* 第2ウェーブ L: IP 作品は金の縁で常時点灯 */
  }
  return out;
}
/* 星屑特典「棚の星飾り」: 棚の天板に載る小物として統合 (§c.5。旧: デスク横の浮遊星) */
function drawStripStarOnShelf(scx, topY){
  /* 2コマのまたたき (prop_star_deco_0/_1)。天板に接地 */
  sDrawSprite("prop_star_deco_" + (frame % 30 < 4 ? 1 : 0), scx + 18, topY, 1);
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
  if(tier < 2) sDrawSprite("prop_fence", scx, G, 1);
  sShadow(scx, G - 0.5, 72);
  let topY;
  /* tier>=2: 棚枠はスチール (shelf_steel 40×28 — prop_shelf と同一キャンバス・
     同一接地。板の上面はスロット基線 G-30/G-10 と正確に一致する) */
  const shelfDrawn = (tier >= 2 && sDrawSprite("shelf_steel", scx, G, 2)) ? "shelf_steel"
    : (sDrawSprite("prop_shelf", scx, G, 2) ? "prop_shelf" : null);
  if(shelfDrawn) stripObjArt.shelf = { name: shelfDrawn, gx: scx, gy: G, s: 2 };
  topY = G - 56;
  const shelfBoxes = stripShelfBoxes();
  /* tier>=2: 技術書の列 (prop_books) を下段に置く。下段に作品箱が1つでも
     ある時は衝突するので出さない (空いている段だけの装飾) */
  if(tier >= 2 && !shelfBoxes.some(b => b.yb === G - 10)) sDrawSprite("prop_books", scx, G - 10, 2);
  for(const bx of shelfBoxes){
    sDrawTL("prop_shelf_box_" + bx.ci, bx.x, bx.yb - bx.h);
    if(bx.glow && frame % 12 < 9) sDrawTL("fx_shelf_glow", bx.x - 1, bx.yb - bx.h - 1);   /* 新作・IP 作品の金の縁 */
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
  /* 机・本の山・開いた本 (prop_research_desk)。研究ポイントで終わらせられる研究があれば
     開いた本が光る絵 (prop_research_desk_on) とゆっくり交互に出す */
  const canFinish = RESEARCH_DEFS.some(d => !S.research[d.id] && d.cost <= S.rp);
  sDrawSprite(canFinish && blinkOn(60, 40) ? "prop_research_desk_on" : "prop_research_desk", rcx, G, 1);
  /* 植木鉢（研究机の右が既定）: prop_plant は装飾スロット級に小さく使う (§c.8)。
     Phase E で独立配置 (他の面にも載せられる) */
  const plantPl = propPlace("plant");
  sDrawSprite("prop_plant", plantPl.cx, plantPl.baseY, 0.8);
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
  sDrawSprite("prop_desk2", dcx, G + 6, 2);
  drawStripDesk2Screen(dcx, G);
}
/* ライン2の進捗をモニタ内にダイジェティック表示（主モニタと同じ流儀 R10）。
   バッチ14: prop_desk2 (64×64) のノートPC画面域（原寸 x23..39, y29..39）は
   ×2 接地 (アンカー G+6) で (dcx-18..+14, G-62..G-42) */
function drawStripDesk2Screen(dcx, G){
  const q = S.line2.project;
  if(!q) return;
  sDrawTL("icon_project_mini_" + projectColorIdx(q), dcx - 16.5, G - 60.5);
  const bx = dcx - 16, bw = 28;
  sDrawNine("ui_minibar_track_3", bx, G - 48, bw, 3, 2, 0);
  if(q.planning){
    if(blinkOn(12, 7)) sDrawNine("ui_minibar_fill_yellow_3", bx + 1, G - 48, 4, 2, 1, 0);
  } else {
    const frac = Math.max(0, Math.min(1, S.line2.projectDP / q.totalDP));
    if(frac > 0) sDrawNine("ui_minibar_fill_3", bx, G - 48, Math.max(2, bw * frac), 2, 1, 0);
  }
  drawStripGitLog(stripGitLog2, dcx - 14, G - 54, 24);
}
