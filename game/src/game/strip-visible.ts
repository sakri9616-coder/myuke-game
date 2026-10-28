/* ---------- システムを絵で見せる (2026-10-27 sakuri) ----------
   「すべての工程、ボトルネック、アップグレード段階は、ビジュアルで表現されるべき」
   「コードでグラフィックを描くのは禁止」への答え。発注書は
   research/VISIBLE_SYSTEMS_ART_ORDER.md。ここは「どの絵を・どこに・いくつ置くか」
   だけを決め、絵そのものは全部スプライト。絵が無い名前は描かない (hasSprite で
   黙ってスキップする。コードの四角で代用しない) */

/* アップグレード Lv → 見た目の段 (0 = 未購入 / 1.. = 絵の段)。cuts は各段の下限 Lv */
const UPGRADE_VIS_CUTS = {
  keyboard: [1, 4, 8],
  ide:      [1, 5],
  monitor:  [1, 3],
  chair:    [1, 3],
  duck:     [1, 4, 8],
  tester:   [1, 4],
  ci:       [1, 4, 8],
  pack:     [1, 5],
};
/* 段階5: キーボードと IDE の絵は「開発環境」の Lv、椅子の絵は社格で決まる（見た目の家具） */
function upgradeVisLv(id){
  if(id === "keyboard" || id === "ide") return S.upgrades.devenv || 0;
  if(id === "chair") return (S.studioLv || 1) >= 4 ? 3 : (S.studioLv || 1) >= 2 ? 1 : 0;
  return S.upgrades[id] || 0;
}
function upgradeVisTier(id){
  const lv = upgradeVisLv(id), cuts = UPGRADE_VIS_CUTS[id] || [1];
  let t = 0;
  for(const c of cuts) if(lv >= c) t++;
  return t;
}
/* 段に対応する絵の名前。絵が届いていなければ null */
function upgradeVisSprite(id){
  const t = upgradeVisTier(id);
  let nm = null;
  if(id === "keyboard") nm = t ? "prop_keyboard_" + t : null;
  else if(id === "monitor") nm = t ? "prop_monitor_sub_" + t : null;
  else if(id === "tester") nm = t ? "prop_autotester_" + t : null;
  else if(id === "pack") nm = t ? "prop_packer_" + t : null;
  else if(id === "ide") nm = "screen_ide_" + t;
  return nm && hasSprite(nm) ? nm : null;
}
/* 椅子: Lv0 はスツール、1〜2 は既存の椅子、3〜5 はハイバック。新しい絵が無い間は
   従来どおり「オフィスティア1以上で既存の椅子」 */
function chairSpriteName(){
  const t = upgradeVisTier("chair");
  if(t >= 2 && hasSprite("prop_chair_2")) return "prop_chair_2";
  if(t >= 1) return "prop_chair";
  if(hasSprite("prop_chair_0")) return "prop_chair_0";
  return officeTier(S) >= 1 ? "prop_chair" : null;
}
/* 工程ステーションの位置 (信号柱を立てる x)。山・台と同じアンカーを使う */
function stationSignalXs(){
  const cx = stripDeskCX();
  return {
    plan:  backlogX() + 17,
    code:  cx - 66,
    test:  stripQAX() + 20,
    build: stripBuildX() + 20,
    ship:  stripShipX() + 34,
  };
}
/* 各工程の信号柱 (緑=流れている / 黄=溜まり気味・素材待ち / 赤=詰まり)。
   判定は工場タブの信号機図と同じ stageStatus の lamp */
function drawStripStationSignals(){
  if(!hasSprite("prop_signal_green")) return;
  const G = STRIP_GROUND, xs = stationSignalXs();
  for(const st of stageStatus()){
    const x = xs[st.id];
    if(typeof x !== "number") continue;
    sDrawSprite("prop_signal_" + st.lamp, x, G, 2);   /* 2倍: ランプの色が遠目でも読める大きさに */
  }
}
/* 企画の付箋ボード: 企画中はアイデアの溜まり具合 (0 / 途中 / 着工できる)、
   開発中はアイデアの在庫があるかどうか */
function backlogSpriteName(){
  const p = S.project;
  let st = 0;
  if(p && p.planning){
    const cost = p.ideaCost || 0;
    const f = cost > 0 ? Math.floor(S.ideas) / cost : 0;
    st = f >= 1 ? 2 : f > 0 ? 1 : 0;
  } else if(S.ideas >= 1) st = 1;
  const nm = "prop_backlog_" + st;
  return hasSprite(nm) ? nm : null;
}
/* 主机まわりのアップグレード (サブモニタ・キーボード)。家具層で、みゅけより背面。
   サブモニタは code ポーズ内のモニタ (cx-40〜cx) の左に並んでデュアル構成に見える */
function drawStripDeskUpgrades(cx){
  const G = STRIP_GROUND;
  const mon = upgradeVisSprite("monitor");
  if(mon) sDrawSprite(mon, cx - 54, G, 1);
  const kb = upgradeVisSprite("keyboard");
  if(kb) sDrawSprite(kb, cx - 54, G, 1);
}
/* 企画の付箋ボードの置き場: 作品棚の左隣 (主机の左は電話・メガホン・サブモニタで埋まっている) */
function backlogX(){ return propPlace("plan").cx; }
function drawStripBacklog(){
  const bl = backlogSpriteName();
  if(bl) sDrawSprite(bl, backlogX(), STRIP_GROUND, 1);
}
/* モニタ画面の中身 (高機能IDE の段)。prop_pc の画面 (1x) か、みゅけの code ポーズ内の
   モニタ (2x) に貼る。進捗バーはこの上に重なる */
function drawStripIdeScreen(gx, gy, scale){
  const nm = upgradeVisSprite("ide");
  if(nm) sDrawSprite(nm, gx, gy, scale);
}
/* 工程ステーションの機械: 自動テスト機 (QA トレイの背後)・梱包機 (ビルド台の背後)・
   企画の付箋ボード。CI (小型サーバ → ラック → ラック2台) は drawStripServerRack が描く */
function drawStripLineUpgrades(){
  const G = STRIP_GROUND;
  const at = upgradeVisSprite("tester");
  if(at) sDrawSprite(at, stripQAX(), G, 1);      /* トレイと仕掛品の山はこの手前に積まれる */
  const pk = upgradeVisSprite("pack");
  if(pk) sDrawSprite(pk, stripBuildX(), G, 1);
  drawStripBacklog();
}
/* CI の段: 1 = 小型サーバ / 2 = ラック / 3 = ラック2台。小型サーバの絵が無い間は
   従来のゲート (オフィスティア2以上で1台) */
function ciRackCount(){
  if(!hasSprite("prop_ci_1")) return officeTier(S) >= 2 && S.upgrades.ci > 0 ? 1 : 0;
  const t = upgradeVisTier("ci");
  return t >= 3 ? 2 : t >= 2 ? 1 : 0;
}
function ciSmallServer(){ return hasSprite("prop_ci_1") && upgradeVisTier("ci") === 1; }
/* ラバーダックの羽数 (Lv 1〜3 / 4〜7 / 8〜10 → 1 / 2 / 3)。1羽目は従来どおり机の脇、
   2羽目以降は QA トレイの両脇で検査する */
function duckCount(){ return upgradeVisTier("duck"); }

/* ---------- 子ねこボット: Lv の台数だけ、ビルド台と出荷台の間を往復して箱を運ぶ ----------
   見た目専用 (シミュレーションには触らない)。行き (出荷へ) は箱を頭に載せ、帰りは手ぶら */
let stripBots = [];
function updateStripBots(dt){
  /* 段階5: 上限3を外したので、Lv3 までは台数どおり、その先は節目（Lv10・25・50・100）ごとに1台ずつ増える（帯は最大7台） */
  const blv = S.upgrades.bot || 0;
  const n = hasSprite("bot_idle") ? Math.min(7, blv <= 3 ? blv : 3 + MILESTONE_LVS.filter(c => blv >= c).length) : 0;
  while(stripBots.length < n) stripBots.push({ x: stripBuildX() + stripBots.length * 14, dir: 1, walkClock: 0, pause: stripBots.length * 0.8 });
  if(stripBots.length > n) stripBots.length = n;
  /* ビルド台と出荷スポットは並べ替えで左右が入れ替わり得る。sd = 出荷へ向かう向き */
  const sd = stripBotOutDir(), x0 = stripBuildX() + 8 * sd, x1 = stripShipX() - 22 * sd;
  for(const b of stripBots){
    if(b.pause > 0){ b.pause -= dt; continue; }
    b.x += b.dir * 22 * dt;
    b.walkClock += dt * 1000;
    if(b.dir === sd && (x1 - b.x) * sd <= 0){ b.x = x1; b.dir = -sd; b.pause = 0.6; }
    else if(b.dir !== sd && (b.x - x0) * sd <= 0){ b.x = x0; b.dir = sd; b.pause = 0.9; }
  }
}
function stripBotOutDir(){ return stripShipX() >= stripBuildX() ? 1 : -1; }
function drawStripBots(){
  const G = STRIP_GROUND, sd = stripBotOutDir();
  for(const b of stripBots){
    let nm;
    if(b.pause > 0) nm = b.dir !== sd ? "bot_carry" : "bot_idle";
    else if(b.dir === sd && hasSprite("bot_carry")) nm = "bot_carry";
    else nm = Math.floor(b.walkClock / 220) % 2 ? "bot_walk_b" : "bot_walk_a";
    if(!hasSprite(nm)) nm = "bot_idle";
    sDrawSprite(nm, b.x, G, 1, b.dir > 0);
  }
}
