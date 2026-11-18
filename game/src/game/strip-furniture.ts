/* ================= Strip Canon: 帯の家具群 (§c 家具移行スペック) =================
   部屋シーンの視覚要素は全て帯の家具として再配置した。配置は R7 ゾーン制、
   高さは R5 予算（家具 ≤90 / 装飾 ≤40 / 背面物 ≤28）、影は R4 統一樣式。
   描画順は renderStrip が R3 の固定順（ラグ・影→背面物→家具→運搬物→キャラ→
   吹き出し→HUD）を守る */

/* 新ラック（2026-11-02 sakuri 決定・みゅー作画）: 160×96 原寸のショーケース。
   段階は officeTier で 木 (0-1) → スチール (2-3) → ガラス＆金 (4-5) */
function rackStageName(){
  if(!hasSprite("prop_rack_wood")) return null;
  const tier = officeTier(S);
  if(tier >= 4 && hasSprite("prop_rack_glass")) return "prop_rack_glass";
  if(tier >= 2 && hasSprite("prop_rack_steel")) return "prop_rack_steel";
  return "prop_rack_wood";
}
/* 帯の作品棚スロット（棚板の実測位置・帯座標）。
   新ラック: 板の上面は上から G-69/G-48/G-27/G-6、横は内側 4 列（箱 20×18・ピッチ 36）。
   旧棚 prop_shelf (40×28) を ×2 接地: 板の内側は 上段 yb=G-30 / 下段 yb=G-10、
   横は棚中心から 4 枠ずつ。スプライトが無い場合は手続き棚 (76×52) の 2 段×5 枠 */
function stripShelfSlots(){
  const scx = stripShelfCX(), G = stripTierG("back");   /* 棚は背景段: 板の位置は棚の基線からの相対 */
  const slots = [];
  if(rackStageName()){
    for(const yb of [G - 69, G - 48, G - 27, G - 6]){
      for(const dx of [-64, -28, 8, 44]) slots.push({ x: scx + dx, yb, w: 20, h: 18 });
    }
  } else if(hasSprite("prop_shelf")){
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
  const G = stripTierG("back"), scx = stripShelfCX();   /* 背景段の基線（§3.1） */
  const tier = officeTier(S);
  const rackName = rackStageName();
  sRug(scx, rackName ? 176 : 100, G);
  /* 背面の柵セグメント（高さ 24・幅 100 = R9 の許容背面物の上限）。
     tier>=2 では撤去する (オフィス化で最もテーマ外だった要素。
     OFFICE_ART_DIRECTION の DROP リスト)。新ラックは背面まで覆うので常に出さない */
  if(tier < 2 && !rackName) sDrawSprite("prop_fence", scx, G, 1);
  sShadow(scx, G - 0.5, rackName ? 152 : 72);
  let topY;
  if(rackName && sDrawSprite(rackName, scx, G, 1)){
    stripObjArt.shelf = { name: rackName, gx: scx, gy: G, s: 1 };
    topY = G - 96;
  } else {
    /* tier>=2: 棚枠はスチール (shelf_steel 40×28 — prop_shelf と同一キャンバス・
       同一接地。板の上面はスロット基線 G-30/G-10 と正確に一致する) */
    const shelfDrawn = (tier >= 2 && sDrawSprite("shelf_steel", scx, G, 2)) ? "shelf_steel"
      : (sDrawSprite("prop_shelf", scx, G, 2) ? "prop_shelf" : null);
    if(shelfDrawn) stripObjArt.shelf = { name: shelfDrawn, gx: scx, gy: G, s: 2 };
    topY = G - 56;
  }
  const shelfBoxes = stripShelfBoxes();
  /* tier>=2: 技術書の列 (prop_books) を下段に置く。下段に作品箱が1つでも
     ある時は衝突するので出さない (空いている段だけの装飾)。新ラックでは出さない */
  if(!rackName && tier >= 2 && !shelfBoxes.some(b => b.yb === G - 10)) sDrawSprite("prop_books", scx, G - 10, 2);
  for(const bx of shelfBoxes){
    if(bx.w >= 20){
      /* 新ラック: 箱は原寸の2倍で並ぶ */
      sDrawSprite("prop_shelf_box_" + bx.ci, bx.x + bx.w / 2, bx.yb, bx.w / 10);
      if(bx.glow && frame % 12 < 9) sDrawSprite("fx_shelf_glow", bx.x + bx.w / 2, bx.yb + 1, 2);   /* 新作・IP 作品の金の縁 */
    } else {
      sDrawTL("prop_shelf_box_" + bx.ci, bx.x, bx.yb - bx.h);
      if(bx.glow && frame % 12 < 9) sDrawTL("fx_shelf_glow", bx.x - 1, bx.yb - bx.h - 1);   /* 新作・IP 作品の金の縁 */
    }
  }
  if(hasPerk("stardecor")) drawStripStarOnShelf(scx, topY);
  /* 再設計 B13（§1.2 拍2）: 卒業の拍では棚の箱に封がされる（「しまった」ではなく「収めた」見え方） */
  if(ceremonyPhase() === "sealed"){
    sctx.save();
    sctx.font = "700 9px 'Hiragino Maru Gothic ProN','Noto Sans JP',sans-serif";
    sctx.textAlign = "center"; sctx.textBaseline = "middle";
    const tw2 = sctx.measureText("封").width + 10;
    sDrawNine("ui_tab_gold_9", scx - tw2 / 2, topY - 13, tw2, 12, 3, 3);
    sctx.fillStyle = "#4a3b2c";
    sctx.fillText("封", scx, topY - 6.5);
    sctx.restore();
  }
  /* 再設計 B13（§1.5 拍3）: 持株化の金の点灯 */
  if(Date.now() < holdingsGlowUntil && blinkOn(10, 6)){   /* 点滅を減らす設定では点灯固定に読み替える */
    sDrawSprite("fx_spark_2", scx - 24, topY - 4, 1);
    sDrawSprite("fx_spark_2", scx + 22, topY - 4, 1);
  }
  /* 第2ウェーブ J: オフィスグレードの置物（レガシー技術・Codex 作画の小物）。
     A8（2026-11-02 みゅー作画）: 点灯条件を満たすまでは、同じスロットに
     未点灯の姿（形は同じ・くすんだ色）が置かれる（ux-r3 §4.3-3 点灯状態スロット） */
  /* 置物の接地: 棚スプライトの絵は row 4 から始まるので、天板の見かけの上面は
     topY + 8。星もトロフィーもそこに 2px 沈めて載せる (sakuri 2026-11-02:
     トロフィーは床ではなく棚の上。星の浮きも同じ理由で解消)。
     横位置は天板の内側 (支柱の内側) に寄せる — 端ギリギリだと地震で落ちる (同日 sakuri) */
  /* 新ラック: 冠の上面は topY+3 — 1px だけ触れる座り (sakuri 2026-11-02: めり込み禁止)。
     横は冠の内寄せ ±55。旧棚は天板の見かけ topY+8 に 2px 沈めて ±20 */
  const ornX = rackName ? 55 : 20, ornY = rackName ? topY + 4 : topY + 10;
  if(legacyGrade() >= 1 && hasSprite("prop_star_gold")) sDrawSprite("prop_star_gold", scx - ornX, ornY, 1);
  else if(hasSprite("a8_star_unlit")) sDrawSprite("a8_star_unlit", scx - ornX, ornY, 1);
  if(legacyGrade() >= 3 && hasSprite("prop_trophy_gold")) sDrawSprite("prop_trophy_gold", scx + ornX, ornY, 1);
  else if(hasSprite("a8_trophy_unlit")) sDrawSprite("a8_trophy_unlit", scx + ornX, ornY, 1);
  stripHitRects.shelf = { x: scx - (rackName ? 80 : 40), y: topY, w: rackName ? 160 : 80, h: G - topY };
}
/* 研究ステーション（ゾーン C, §c.3）: 研究員が雇われた時だけ現れる小型机。
   本の山＋開いた本＋植木鉢。不在ならゾーンは空白（密度予算の自然な増減） */
function drawStripResearchStation(){
  const G = stripTierG("mid"), rcx = stripResearchCX();   /* 研究机は中景段（§3.1） */
  sRug(rcx, 84, G);
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
