/* ---------- 在庫バグを帯に出す (2026-10-27) ----------
   sakuri「バグは大量発生イベントでないときにも画面に出して、手動でも潰せるように」
   「一万匹のプレイも想定」「自動的にパッチが当たってバグが撃破される演出も」。
   在庫バグ (S.bugStock) を帯の地面に常に這わせ、クリックで潰せる。
   - 描く枚数は匹数によらず最大 20 枚: 12 匹までは1匹ずつ、それを超えたら1匹描きは
     8 匹に留め、残りを「群れ」の絵で描く。群れの数は匹数の桁で増える (13匹で数個、
     1万匹で 12 個)。1 つの群れが表す匹数は 残り ÷ 群れの数
   - 動きは BUG_STEP_MS ごとの刻みで進める (毎フレーム動かさない)。刻みの間のフレームは
     命令列が同じになり、描画の軽量化 (strip-frame.ts の同一フレーム省略) が効き続ける
   - QA・みゅけのデバッグで減ったぶんは「パッチ」が落ちて貼り付き、煙で消える
     (1匹ずつ間隔を空けて駆逐する。1万匹が一気に減っても演出は同時 4 つまで)
   - 絵は research/BUG_SWARM_ART_ORDER.md の発注品。届いていない絵は、既存の icon_bug /
     fx_spark_2 を並べて代わりにする (新しい絵をコードで描かない) */
const BUG_INDIV_MAX = 12;        /* これ以下は全部1匹ずつ描く */
const BUG_INDIV_WITH_SWARM = 8;  /* 群れがいるときの1匹描きの数 */
const BUG_SWARM_MAX = 12;
const BUG_STEP_MS = 220;         /* 這う刻み。1刻みで 2px 進む (≒9px/秒) */
const BUG_FX_MAX = 4;
/* 当たり判定は見た目の約3倍 (sakuri 2026-10-27「数倍大きく。後ろの物が掴めなくなっても結構」)。
   地面から上へ広げる。帯の何もない所は従来どおり素通し (判定はバグの周りだけ) */
const BUG_HIT = { one: [42, 30], s: [72, 36], l: [120, 54] };
let stripBugVis = [];            /* {kind:"one"|"s"|"l", x, tx, dir, ph, n} */
let stripBugFx = [];             /* {kind:"patch"|"splat", x, at} */
let stripBugStepAt = 0, stripBugStepN = 0;
let stripBugFxNextAt = 0;
/* 匹数 → 描く物の組み立て。純関数 (smoke から検算できる) */
function bugVisModel(n){
  n = Math.max(0, Math.floor(n || 0));
  if(n <= BUG_INDIV_MAX) return { indiv: n, swarms: 0, share: 0, big: false };
  const rest = n - BUG_INDIV_WITH_SWARM;
  const swarms = Math.min(BUG_SWARM_MAX, 1 + Math.floor(Math.log10(rest) * 3));
  const share = rest / swarms;
  return { indiv: BUG_INDIV_WITH_SWARM, swarms, share, big: share >= 20 };
}
/* 群れ1つを叩いたときに潰れる匹数: 群れは約3回で消える (桁が増えても手数は同じ) */
function bugSwarmChunk(share){ return Math.max(1, Math.ceil(share / 3)); }
/* 手で潰した報酬 (コイン)。仕事の桁 (workScale) に連動し、群れをまとめて潰したときは
   匹数の平方根ぶん厚くする (1匹 ×1・100匹 ×10・1万匹 ×100)。匹数自体も生産に比例して
   増えるので、平方根で抑えて報酬の二重インフレを避ける */
function stockBugReward(squashed){
  const k = Math.sqrt(Math.max(1, squashed));
  return Math.max(1, rewardCoins(BAL.rewardSec.stockBug * k, Math.round(BAL.stockBugCoin * workScale() * k)));   /* 段階1: 収入の2秒×√匹数（下限は従来の式） */
}
/* 在庫バグの見た目の範囲: QA トレイの周りから、匹数の桁に応じて帯の端まで広がる */
function stripBugSpan(n){
  const half = Math.min(stripVW / 2, 40 + 30 * Math.log2(1 + n));
  const c = stripQAX();
  return { lo: Math.max(12, c - half), hi: Math.min(stripVW - 12, c + half) };
}
function stripBugPickX(sp){ return Math.round(sp.lo + Math.random() * (sp.hi - sp.lo)); }
/* 帯側 (stripUpdate から毎フレーム): 匹数の変化を見て、絵の数を合わせ、刻みで動かす。
   sakuri「出たバグが自動で駆逐されていく視覚的楽しさが重要」: 匹数が減っても絵はすぐには
   消さない。出てから BUG_MIN_LIFE 以上這った絵から順に、パッチが落ちて貼り付き、
   煙になって消える (BUG_PATCH_GAP ごとに1匹。一気に減っても1匹ずつ駆逐されていく) */
const BUG_MIN_LIFE = 2500, BUG_PATCH_GAP = 300;
function stripBugsUpdate(){
  const n = Math.max(0, Math.floor(S.bugStock || 0));
  const m = bugVisModel(n), sp = stripBugSpan(n);
  const want = [];
  for(let i = 0; i < m.indiv; i++) want.push("one");
  for(let i = 0; i < m.swarms; i++) want.push(m.big && i % 2 === 0 ? "l" : "s");
  const live = stripBugVis.filter(v => !v.dying);
  /* 足りない絵は QA トレイから這い出てくる (群れは範囲のどこかに湧く) */
  for(let i = live.length; i < want.length; i++){
    const x0 = want[i] === "one" ? stripQAX() : stripBugPickX(sp);
    const v = { kind: want[i], x: x0, tx: stripBugPickX(sp), dir: 1, ph: Math.floor(Math.random() * 4), n: 1, born: stripNow, dying: false };
    stripBugVis.push(v); live.push(v);
  }
  /* 余った絵は、十分這ったものからパッチで駆逐する */
  if(live.length > want.length && stripNow >= stripBugFxNextAt && stripBugFx.length < BUG_FX_MAX){
    let victim = null;
    for(let i = live.length - 1; i >= 0; i--) if(stripNow - live[i].born >= BUG_MIN_LIFE){ victim = live[i]; break; }
    if(victim){
      victim.dying = true;
      stripBugFxNextAt = stripNow + BUG_PATCH_GAP;
      stripBugFx.push({ kind: "patch", x: victim.x, at: stripNow, vis: victim });
    }
  }
  let k = 0;
  for(const v of stripBugVis){
    if(v.dying) continue;
    if(k < want.length){ v.kind = want[k]; v.n = want[k] === "one" ? 1 : m.share; }
    else { v.n = v.kind === "one" ? 1 : m.share; }   /* 駆逐待ち (在庫はもう減っている) */
    k++;
  }
  /* 刻み: 1匹は目的地へ 2px ずつ這い、着いたら時々次の目的地を選ぶ。群れはその場でうごめく */
  if(stripNow - stripBugStepAt < BUG_STEP_MS) return;
  stripBugStepAt = stripNow; stripBugStepN++;
  for(const v of stripBugVis){
    if(v.dying) continue;
    if(v.tx < sp.lo || v.tx > sp.hi) v.tx = stripBugPickX(sp);
    const d = v.tx - v.x;
    if(v.kind === "one"){
      if(Math.abs(d) >= 2){ v.dir = d > 0 ? 1 : -1; v.x += v.dir * 2; v.ph++; }
      else if(Math.random() < 0.06) v.tx = stripBugPickX(sp);
    } else {
      if(Math.abs(d) >= 1 && stripBugStepN % 3 === 0){ v.dir = d > 0 ? 1 : -1; v.x += v.dir; }
      if((stripBugStepN + v.ph) % 3 === 0) v.ph++;
      if(Math.random() < 0.01) v.tx = stripBugPickX(sp);
    }
  }
}
function stripBugSprite(kind, ph){
  const nm = kind === "one" ? "icon_bug_s_" : kind === "l" ? "icon_bug_swarm_l_" : "icon_bug_swarm_s_";
  const f = nm + (ph % 2);
  return hasSprite(f) ? f : null;
}
/* 届いていない群れの絵の代わり: 既存の icon_bug を小さく寄せて並べる */
const BUG_FALLBACK_CLUSTER = {
  s: [[-6, 0], [5, 0], [0, -4], [-1, 1]],
  l: [[-14, 0], [-5, 0], [5, 0], [14, 0], [-9, -5], [1, -6], [10, -5], [-3, -10], [6, -10]]
};
function drawStripStockBugs(){
  const G = STRIP_GROUND;
  stripHitRects.stockBugs = [];
  /* 群れを奥、1匹描きを手前に描く (クリックの当たりも手前が優先: 記録順の後ろから調べる) */
  for(let j = 0; j < stripBugVis.length; j++){
    const i = (j + BUG_INDIV_WITH_SWARM) % stripBugVis.length;
    const v = stripBugVis[i];
    const nm = stripBugSprite(v.kind, v.ph);
    if(nm) sDrawSprite(nm, v.x, G, 1, v.dir < 0);
    else if(v.kind === "one") sDrawSprite("icon_bug", v.x, G + 3, 0.5, v.dir < 0);
    else for(const o of BUG_FALLBACK_CLUSTER[v.kind]) sDrawSprite("icon_bug", v.x + o[0] + ((v.ph + o[0]) % 2), G + 3 + o[1], 0.45);
    const hs = BUG_HIT[v.kind];
    stripHitRects.stockBugs.push({ x: v.x - hs[0] / 2, y: G - hs[1], w: hs[0], h: hs[1], vis: v });
  }
  /* 演出: パッチ (落下 260ms → 貼り付き 160ms → 煙 2コマ 300ms) / 手で潰した跡 (240ms → 煙) */
  for(let i = stripBugFx.length - 1; i >= 0; i--){
    const fx = stripBugFx[i], t = stripNow - fx.at;
    const fall = fx.kind === "patch" ? 260 : 0, stick = fx.kind === "patch" ? 160 : 240;
    if(t >= fall + stick + 300){ stripBugFx.splice(i, 1); continue; }
    if(fx.vis && t >= fall){ const vi = stripBugVis.indexOf(fx.vis); if(vi >= 0) stripBugVis.splice(vi, 1); fx.vis = null; }
    if(t < fall){
      const y = G - 40 + Math.round(t / fall * 34);
      if(!sDrawSprite("fx_patch", fx.x, y + 6, 1)) sDrawSprite("fx_spark_2", fx.x, y, 1);
    } else if(t < fall + stick){
      if(fx.kind === "patch") sDrawSprite("fx_patch", fx.x, G - 2, 1);
      else if(!sDrawSprite("fx_bug_splat", fx.x, G, 1)) sDrawSprite("icon_bug", fx.x, G + 3, 0.5);
    } else {
      const f = t < fall + stick + 150 ? 0 : 1;
      if(!sDrawSprite("fx_bug_poof_" + f, fx.x, G, 1)) sDrawSprite("fx_spark_2", fx.x, G - 4 - f * 3, 1);
    }
  }
}
/* 帯のクリック: 当たった在庫バグを潰す。当たれば true */
function stripStockBugClick(ux, uy){
  const R = stripHitRects.stockBugs || [];
  for(let k = R.length - 1; k >= 0; k--){
    const r = R[k];
    if(ux < r.x - 3 || ux > r.x + r.w + 3 || uy < r.y - 3 || uy > r.y + r.h + 3) continue;
    const v = r.vis;
    if(!v || stripBugVis.indexOf(v) < 0) continue;
    if(v.dying) continue;
    squashStockBug(v.kind === "one" ? 1 : bugSwarmChunk(v.n), v.x);
    if(v.kind === "one") stripBugVis.splice(stripBugVis.indexOf(v), 1);   /* 叩いた1匹はその場で潰れる */
    return true;
  }
  return false;
}
/* 手で在庫バグを潰す (労働の対価: コイン + オーバークロックの充填。減ったバグはテストの
   詰まり・出荷時の負債・IP 化の条件にそのまま効く) */
function squashStockBug(count, x){
  const have = Math.floor(S.bugStock || 0);
  /* 絵が見えている限り叩けば報われる (在庫が先に QA で減っていても1匹ぶんは払う) */
  const k = Math.max(1, Math.min(have, Math.floor(count)));
  S.bugStock = Math.max(0, S.bugStock - k);
  S.totals.bugsSquashed += k; S.today.bugs += k;
  const coins = stockBugReward(k);
  S.coins += coins; S.totals.coinsEarned += coins; creditIncome("labor", coins);
  /* 段階5: ラバーダック（在庫バグの相棒）。潰したバグごとにテスト待ちの仕掛品をテストの duck×2 秒ぶん先へ送る */
  if((S.upgrades.duck || 0) > 0 && S.wip){
    const mv = Math.min(S.wip.code, testRate() / 60 * 2 * upEff(S.upgrades, "duck") * Math.sqrt(k));
    if(mv > 0){ S.wip.code -= mv; S.wip.tested += mv; }
  }
  chargeFever(FEVER.chargePerClick);
  SoundKit.play("bugSquash");
  stripBugFx.push({ kind: "splat", x, at: stripNow || Date.now() });
  if(stripBugFx.length > BUG_FX_MAX * 2) stripBugFx.shift();
  addStripFloater(x, STRIP_GROUND - 18, (k > 1 ? "🐛×" + fmt(k) + " " : "") + "+" + fmt(coins) + "🪙", "#5aa469");
  checkStamps();
  return k;
}
