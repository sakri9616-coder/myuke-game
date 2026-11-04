/* ---------- Phase D: 子会社（終盤の経営レイヤー） ----------
   準大手（スタジオLv5）から設立できる半自律ユニット。人員は抽象的な数で
   数え（帯に描く本社の猫は最大36匹まで）、収益は受動コイン＋DP。
   プレイヤーのレバー: 設立 / 人員投資 / 規模Lv / 資金配分（合計100%）。
   配分は「注力度」として効く（0% で ×0.5、100% で ×2.0）ため、配分を
   動かすとグループ合計が変わる — それが経営判断になる。注力度は
   凹関数 0.5+1.5×sqrt(配分/100)（2026-10-26 23:17回・Phase D 注記 (ii)）:
   線形だと高単価社への100%集中が常に最善で配分判断が消えるため、
   逓減する注力度で最適配分を内点（約74/26）に移し、誤配分は損になる形にした。端点は不変。
   売却は2段構え: 子会社だけ売る部分EXIT（星屑は subDustValue と同額）と、
   本社ごと売るグループEXIT（売却益に全子会社の価値が上乗せされる）。
   部分EXIT の星屑 = グループEXIT での当該子会社の寄与分と同額にそろえて
   あるため、「部分 ≤ グループ寄与」の反証条件は構造的に保たれる */
/* 主役を選べる収入源（2026-10-27）: 子会社の売上と価格は、本社の作品単価と同じ桁
   （仕事の桁 × 星屑倍率の dustPriceExp 乗 = subUnit）に載せる。売上も価格も同じ単位で
   伸びるので、元が取れるまでの時間は周回が進んでも変わらない（理念書4 スケール対価）。
   1日 3 時間・ほぼ毎日売却するペースでも、設立は約1時間で元が取れ、人員と規模の掛け算で
   本社を追い抜ける大きさまで育つ。規模は上限100・節目つき（設備と同じ MILESTONE_LVS） */
const SUB_ECON = { found: 200, foundMul: 2, head: 30, headMul: 1.03, scale: 150, scaleMul: 1.5, coinPerStaff: 0.7, lvStep: 0.3 };   /* 段階4: 0.35→0.7（子会社に寄せたビルドで子会社が稼ぎ頭になれるように・sim の G5） */
const SUB_MAX_LV = 100;
function subUnit(){ return workScale() * Math.pow(dustMult(), BAL.dustPriceExp); }
const SUB_NAME_A = ["ねこねこ", "まるまる", "にゃんころ", "ふわラボ", "こねこ", "たまご", "ひげ", "すやすや"];
function subGenreRate(genreId){
  const i = GENRES.findIndex(g => g.id === genreId);
  return 1 + 0.1 * Math.max(0, i);   /* 解放が遅いジャンルほど単価が高い */
}
function subLvMult(sub){ return 1 + SUB_ECON.lvStep * (upEff({ lv: sub.lv }, "lv") - 1); }
function subFocus(sub){ return 0.5 + 1.5 * Math.sqrt((sub.alloc || 0) / 100); }
function subRates(sub){
  const base = sub.staff * subLvMult(sub) * subFocus(sub) * (hasLegacyTech("group") ? 1.3 : 1);   /* 第2ウェーブ J: グループ経営 +30% */
  return { coins: base * SUB_ECON.coinPerStaff * subGenreRate(sub.genre) * subUnit() * (1 + 0.4 * engineLv("gmgmt")) * branchMult("b_subs") * seriesSubMult(), dp: base * 0.2 };   /* 段階4: 子会社の列「グループ経営」／段階6: 星屑の枝とシリーズの相乗 */
}
/* 段階6: 配当と再投資。売上のうち配当率ぶんが本社のコインに入り、残りは子会社が自分の人員と規模に
   つぎ込む（複利）。配当を絞るほど今のコインは減り、子会社は速く育つ */
function subDiv(sub){ return typeof sub.div === "number" ? sub.div : 100; }
/* レベルデザイン改修: 子会社も本社と同じく「作品を作ってリリースする」会社として見せる。
   いま作っている作品名は表示専用（経済には影響しない）。リリースのたびに次の作品へ進む */
function subWorkName(sub){
  const g = GENRES.find(x => x.id === sub.genre) || GENRES[0];
  const subj = SUBJECTS[Math.abs(sub.workIdx || 0) % SUBJECTS.length];
  return subj.name + g.name;
}
/* 配当リリースの周期（秒）: 売上が大きい子会社ほど速く回す。20〜90 秒に収める */
function subReleaseCycle(sub){ return Math.max(20, Math.min(90, Math.round(1800 / Math.max(1, subRates(sub).coins)))); }
function setSubDiv(id, delta){
  const sub = (S.subs || []).find(s => s.id === id);
  if(!sub) return;
  sub.div = Math.max(0, Math.min(100, subDiv(sub) + delta));
  save(); renderPanel();
}
function subReinvest(sub, coins){
  sub.reinv = (sub.reinv || 0) + coins;
  for(let guard = 0; guard < 50; guard++){
    /* 人員と規模のうち、値段あたりの伸びが大きいほうを買う */
    const hc = subHeadCost(sub), sc = sub.lv < SUB_MAX_LV ? subScaleCost(sub) : Infinity;
    const hg = 1 / sub.staff / hc, sg = (subLvMult({ lv: sub.lv + 1 }) / subLvMult(sub) - 1) / sc;
    const scale = sg > hg, c = scale ? sc : hc;
    if(sub.reinv < c) break;
    sub.reinv -= c;
    if(scale) sub.lv++; else sub.staff++;
  }
}
/* 段階4: 子会社の売却益も企業価値から（その子会社の1時間の売上 ÷ 星屑1個ぶんの企業価値）。
   旧: 人員と規模の固定式で、安い子会社をいくつも作るだけで星屑が出た */
function subDustValue(sub){ return Math.floor(subRates(sub).coins * 60 / dustValueUnit()); }
function subsTotalStaff(){ return (S.subs || []).reduce((a, s) => a + s.staff, 0); }
/* 再設計 B11（leveldesign-r4-sign が正本、閾値は較正裁定 leveldesign-r4-sign2 で差し替え）:
   別館看板の成長段階はグループ総勢の単一指標で駆動する。
   段階1 = 設立そのもの／200人→2／320人→3／450人→4。段階は周回内ラッチ（下がらない）。
   駆動元は旧 legacyGrade >= 2 からここへ移した（金の看板に二つの意味を持たせない） */
const ANNEX_STAGE_STEPS = [200, 320, 450];
function annexStageNow(){
  if(!(S.subs || []).length) return 0;
  const tot = subsTotalStaff();
  for(let i = ANNEX_STAGE_STEPS.length - 1; i >= 0; i--) if(tot >= ANNEX_STAGE_STEPS[i]) return i + 2;
  return 1;
}
function annexStage(){ return Math.max(annexStageNow(), S.annexStage || 0); }
/* 毎秒ティックから: 段階が上がった瞬間だけ1回告知する（designer-r3 §3.2 の文案） */
function annexStageTick(){
  const now = annexStageNow();
  if(now > (S.annexStage || 0)){
    S.annexStage = now;
    annexStageFxAt = Date.now();
    if(now >= 2){ addLog("🏢 別館の看板が大きくなりました——向こうも育っています。"); reportNote("別館の看板が大きくなりました——向こうも育っています。"); }
  }
}
function totalPeople(){ return S.staff.length + subsTotalStaff(); }
function foundCost(){ return Math.ceil(SUB_ECON.found * Math.pow(SUB_ECON.foundMul, (S.subs || []).length) * subUnit()); }
function subHeadCost(sub){ return Math.ceil(SUB_ECON.head * Math.pow(SUB_ECON.headMul, sub.staff) * subUnit()); }
function subHeadCostN(sub, n){
  let t = 0;
  for(let i = 0; i < n; i++) t += Math.ceil(SUB_ECON.head * Math.pow(SUB_ECON.headMul, sub.staff + i) * subUnit());
  return t;
}
function subScaleCost(sub){ return Math.ceil(SUB_ECON.scale * Math.pow(SUB_ECON.scaleMul, sub.lv - 1) * subUnit()); }
function normalizeAlloc(){
  const subs = S.subs || [];
  if(!subs.length) return;
  let sum = subs.reduce((a, s) => a + (s.alloc || 0), 0);
  if(sum === 100) return;
  if(sum <= 0) subs.forEach(s => s.alloc = Math.floor(100 / subs.length));
  else subs.forEach(s => s.alloc = Math.floor(s.alloc * 100 / sum));
  let rest = 100 - subs.reduce((a, s) => a + s.alloc, 0);
  for(let i = 0; rest > 0; i = (i + 1) % subs.length){ subs[i].alloc++; rest--; }
}
function foundSub(genreId){
  if(S.studioLv < 5){ say("子会社は準大手（スタジオLv5）からにゃ"); return; }
  const cost = foundCost();
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  const g = GENRES.find(x => x.id === genreId) || GENRES[0];
  S.coins -= cost;
  if(!Array.isArray(S.subs)) S.subs = [];
  let name = spaceSubName(g.name) || SUB_NAME_A[(S.subSeq || 0) % SUB_NAME_A.length] + g.name + "工房";   /* v2.26.1: 宇宙編は土地の名前 */
  if(S.subs.some(s => s.name === name)) name += " " + (S.subs.filter(s => s.name.startsWith(name.split(" ")[0])).length + 1) + "号";
  const sub = { id: ++S.subSeq, name, genre: g.id, staff: 5, lv: 1, alloc: 0 };
  S.subs.push(sub);
  normalizeAlloc();
  SoundKit.play("purchase");
  addLog("🏢 子会社「"+name+"」を設立！（-" + fmt(cost) + "🪙）得意は"+g.name+"、人員 5 人で発足");
  /* 再設計 B11（designer-r3 §3.2）: 新しい別館の告知は1回だけ。段階上昇の告知と同じくメモ枠（reportNote）にも載せる */
  addLog("🏢 新しい別館ができました。隣の明かりが、また一つ増えました。");
  reportNote("新しい別館ができました。隣の明かりが、また一つ増えました。");
  say("子会社「"+name+"」ができたにゃ！ グループ経営のはじまりだね");
  save(); renderPanel();
}
function addSubStaff(id, n){
  const sub = (S.subs || []).find(s => s.id === id);
  if(!sub) return;
  const total = subHeadCostN(sub, n);
  if(S.coins < total){ say("コインが足りないにゃ…"); return; }
  S.coins -= total; sub.staff += n;
  addLog("🏢 "+sub.name+" に "+n+" 人を採用（人員 "+sub.staff+" 人）（-" + fmt(total) + "🪙）");
  save(); renderPanel();
}
function scaleSub(id){
  const sub = (S.subs || []).find(s => s.id === id);
  if(!sub) return;
  if(sub.lv >= SUB_MAX_LV){ say("その子会社はもう最大規模にゃ"); return; }
  const cost = subScaleCost(sub);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; sub.lv++;
  addLog("🏢 "+sub.name+" が規模Lv"+sub.lv+" に（出力 ×"+fmtDec(subLvMult(sub), 1)+"）（-" + fmt(cost) + "🪙）");
  say(sub.name+"が大きくなったにゃ！");
  save(); renderPanel();
}
function setAlloc(id, delta){
  const subs = S.subs || [];
  const sub = subs.find(s => s.id === id);
  if(!sub || subs.length < 2) return;
  const nv = Math.max(0, Math.min(100, (sub.alloc || 0) + delta));
  if(nv === sub.alloc) return;
  sub.alloc = nv;
  /* 差分は他の子会社から付け替える（合計は常に100%に保つ） */
  let excess = subs.reduce((a, s) => a + s.alloc, 0) - 100;
  const others = subs.filter(s => s !== sub).sort((a, b) => b.alloc - a.alloc);
  for(const o of others){
    if(excess === 0) break;
    if(excess > 0){ const d = Math.min(o.alloc, excess); o.alloc -= d; excess -= d; }
    else { const d = Math.min(100 - o.alloc, -excess); o.alloc += d; excess += d; }
  }
  if(excess !== 0) sub.alloc -= excess;
  save(); renderPanel();
}
function sellSubCore(id){
  const subs = S.subs || [];
  const i = subs.findIndex(s => s.id === id);
  if(i < 0) return;
  const sub = subs[i];
  const gain = subDustValue(sub);
  subs.splice(i, 1);
  S.totals.subsSold = (S.totals.subsSold || 0) + 1;
  normalizeAlloc();
  const totalBefore = dustTotal();
  S.dust += gain; S.dustTotal = totalBefore + gain;
  S.eraDust = (S.eraDust || 0) + gain;   /* 第2ウェーブ J: 時代の通算にも積む */
  addLog("🏢 子会社「"+sub.name+"」を売却（部分EXIT）: 星屑 +"+gain+"（本社はそのまま）");
  say(sub.name+"を売却したにゃ。星屑 +"+gain+" ゲット");
  save(); renderPanel();
}
function sellSub(id){
  const sub = (S.subs || []).find(s => s.id === id);
  if(!sub) return;
  if(!confirm("子会社「"+sub.name+"」を売却しますか？（部分EXIT）\n星屑 "+subDustValue(sub)+" 個を得ます。本社と他の子会社はそのまま残ります")) return;
  sellSubCore(id);
}
/* ---------- Sprint 3: 星屑ショップ（永続特典）と引っ越しプレビュー ----------
   星屑は「所持分（S.dust）」を消費して特典を買う。生産倍率は通算獲得
   （S.dustTotal）で決まるので、買い物をしても倍率が下がることはない。
   特典は引っ越ししても消えない（S.dustPerks はリセット対象外）。 */
const DUST_PERKS = [
  { id:"starlight", name:"星あかり",     cost:1,  desc:"フィーバーのゲージが +15% たまりやすくなります" },
  { id:"omamori",   name:"星屑のお守り", cost:1,  desc:"金の魚の間隔が -5% になります（幸運のヒレと重なります）" },
  { id:"piggybank", name:"星の貯金箱",   cost:2,  desc:"売却時、所持コインの 10%（上限は前の会社の収入30分ぶん）を新会社に持ち越します" },
  { id:"stardecor", name:"棚の星飾り",   cost:2,  desc:"帯の作品棚の天板に星の飾りが出ます（見た目の自慢）" },
  { id:"seedmoney", name:"初期資金",     cost:3,  desc:"新会社が、前の会社の自動収入10分ぶん（最低 3,000🪙）を持って始まります" },
  { id:"dreamplus", name:"夢の続き",     cost:3,  desc:"夢のお土産（30分以上あけて戻った時のアイデア）が +1 個増えます" },
  { id:"focus",     name:"応援ブースト", cost:4,  desc:"応援クリックの威力 +10%" },
  { id:"notebook",  name:"研究ノート",   cost:6,  desc:"売却時に、完了した研究を1件（最も研究Pが高かったもの）引き継ぎます" },
  { id:"veteran",   name:"ベテラン制度", cost:8,  desc:"売却時に、最も育ったスタッフ1人が新会社に来てくれます" },
  /* Sprint 4: レベル制（反復購入できる星屑シンク）。S.dustPerks[id] に数値で持つ。段階6: 星のチャームは廃止（枝に置き換え） */
  { id:"luckyfin",  name:"幸運のヒレ",   lv:true, baseCost:2, costMul:1.8, maxLv:10, desc:"フィッシュの間隔 -8%/Lv（最大Lv10）" },
  /* 段階6: 収入源ごとの枝（上限なし）。1Lv +15%。その会社でその収入源の強化の列に投資したほど強く効く
     （列の Lv 20 ごとに枝の効きが +100%）。どの収入源を主役にするかで、星屑の使い道も分かれる */
  { id:"b_labor",   name:"星の肉球（応援）",   lv:true, branch:"labor",   baseCost:2, costMul:1.5, maxLv:Infinity, desc:"応援クリックの威力" },
  { id:"b_line",    name:"星の本社工房", lv:true, branch:"line",    baseCost:2, costMul:1.5, maxLv:Infinity, desc:"作品の売上（作りながら・リリース時）" },
  { id:"b_catalog", name:"星の作品棚",   lv:true, branch:"catalog", baseCost:2, costMul:1.5, maxLv:Infinity, desc:"作品棚とシリーズの売上" },
  { id:"b_sales",   name:"星の名刺（営業）",   lv:true, branch:"sales",   baseCost:2, costMul:1.5, maxLv:Infinity, desc:"依頼達成ボーナス" },
  { id:"b_subs",    name:"星の子会社", lv:true, branch:"subs",    baseCost:2, costMul:1.5, maxLv:Infinity, desc:"子会社の売上" }
];
/* 枝が効く強さの元: この会社でその収入源の列に積んだ Lv（労働は応援強化。腕前なので売却しても残る） */
const BRANCH_ENGINE = { labor: null, line: "direct", catalog: "promo", sales: "scout", subs: "gmgmt" };
function branchInvest(src){
  const e = BRANCH_ENGINE[src];
  return e ? (S.upgrades[e] || 0) : ((S.clickUp.paw || 0) + (S.clickUp.glove || 0)) / 2;
}
function branchMult(id){
  const lv = perkLv(id);
  if(!lv) return 1;
  const def = DUST_PERKS.find(p => p.id === id);
  return 1 + 0.15 * lv * (1 + branchInvest(def.branch) / 20);
}
/* 段階6: シリーズの相乗（自社IP 1本ごとに 子会社の売上 +10%・依頼達成ボーナス +5%） */
function seriesSubMult(){ return 1 + 0.1 * (S.ips || []).length; }
function seriesReqMult(){ return 1 + 0.05 * (S.ips || []).length; }
function fishIntervalMul(){ return (1 - 0.08 * perkLv("luckyfin")) * (hasPerk("omamori") ? 0.95 : 1); }   /* 第2ウェーブ I: 星屑のお守りで別枠 -5% */
function nextFishDelayMs(){ return (150000 + Math.random() * 120000) * fishIntervalMul(); }   /* 次の金の魚までの間隔（Sprint 4: 幸運のヒレ） */
function buyDustPerk(id){
  const def = DUST_PERKS.find(p => p.id === id);
  if(!def) return;
  if(!S.dustPerks || typeof S.dustPerks !== "object") S.dustPerks = {};
  /* Sprint 4: レベル制の特典は繰り返し買える（価格は costMul 倍ずつ） */
  if(def.lv){
    const lv = perkLv(id);
    if(lv >= def.maxLv){ say("もう最大レベルにゃ"); return; }
    const cost = Math.ceil(def.baseCost * Math.pow(def.costMul, lv));
    if(S.dust < cost){ say("星屑が足りないにゃ…"); return; }
    S.dust -= cost; S.dustPerks[id] = lv + 1;
    SoundKit.play("purchase");
    addLog("⭐ 星屑ショップ: 『"+def.name+"』Lv"+(lv+1)+"（星屑-"+cost+"）");
    say("『"+def.name+"』Lv"+(lv+1)+" にゃ！");
    save(); renderPanel();
    return;
  }
  if(S.dustPerks[id]){ say("もう持ってるにゃ"); return; }
  if(S.dust < def.cost){ say("星屑が足りないにゃ…"); return; }
  S.dust -= def.cost; S.dustPerks[id] = true;
  SoundKit.play("purchase");
  addLog("⭐ 星屑ショップ: 『"+def.name+"』を購入（星屑-"+def.cost+"）");
  say("『"+def.name+"』、ゲットにゃ！");
  save(); renderPanel();
}
/* 引っ越しの事前計算: 得られる星屑・倍率の変化・リセット/引き継ぎ一覧。
   doPrestige 本体もこの gain を使うので、プレビューと実際の結果は必ず一致する */
function prestigePreview(){
  /* Phase D: グループEXIT — 売却益には全子会社の価値が上乗せされる */
  /* 段階3: 企業価値の最高値から。段階4: 子会社の売上は企業価値に入っているので、子会社ぶんを別に足さない（内訳の表示用に数える） */
  const subGain = (S.subs || []).reduce((a, s) => a + subDustValue(s), 0);
  /* レベルデザイン改修: 経営方針「売却特化」の会社は、EXIT の星屑が ×1.25（最後に掛けて floor。
     プレビューと実際の獲得量を一致させるため、倍率はここで掛ける） */
  const gain = Math.floor(dustGainFromValue(S.runPeakValue || 0) * (S.runPolicy === "sell" ? 1.25 : 1));
  const total = dustTotal();
  const resets = ["コイン", "アップグレード", "研究", "スタッフ"];
  if((S.subs || []).length) resets.push("子会社");
  const keeps = ["作品棚", "日報", "実績", "星屑と購入済み特典", "応援強化と応援P（みゅけの腕前）", "ジャンル知見（余った研究P " + fmt(Math.floor(S.rp || 0)) + " も知見になる）"];
  if(hasPerk("veteran") && S.staff.length){
    const vet = S.staff.slice().sort((a,b) => b.lv - a.lv)[0];
    resets.splice(resets.indexOf("スタッフ"), 1);
    keeps.push("最古参スタッフ『"+vet.name+"』（ベテラン制度）");
  }
  const nbTop = hasPerk("notebook") ? notebookTopResearch() : null;
  if(nbTop){
    resets.splice(resets.indexOf("研究"), 1);
    keeps.push("研究『"+nbTop.name+"』"+(nbTop.requires ? "とその前提" : "")+"（研究ノート）");
  }
  if(hasPerk("seedmoney")) keeps.push("初期資金 " + fmt(seedMoney()) + "🪙");
  if(hasPerk("piggybank")) keeps.push("星の貯金箱（コインの10% " + fmt(piggyCarry(S.coins)) + "🪙 を持ち越し）");
  const nx = nextExitMs();
  if(nx && (S.prestiges || 0) + 1 >= nx.n) keeps.push("売却実績の節目「" + nx.name + "」が開く");
  if(S.executives && S.executives.length) keeps.push("役員 " + S.executives.map(e => "『"+e.name+"』").join(""));   /* 第2ウェーブ M */
  return {
    gain, subGain,
    curMult: dustMultFor(total),
    nextMult: dustMultFor(total + gain),
    resets, keeps
  };
}
/* ---------- 第2ウェーブ M: 役員猫の引き継ぎ ----------
   EXIT のとき、この会社で一番働いた（act = 実働の蓄積）猫が「役員」と
   して次の会社に残る。役員は頭数に数えず生産もしないが、同じ役職の
   部門に +10%/匹 のオーラを出す（staffOutMult）。上限3匹・持株化でも
   残る。選出は EXIT プレビュー（作品タブの売却カード）で行い、
   ベテラン指名は役員に選ばれなかった猫から行う */
let pendingExecPick, pendingVetPick, pendingExecSwap;
function execCandidates(){
  return S.staff.slice().sort((a, b) => (b.act || 0) - (a.act || 0)).slice(0, 3);
}
function resolvedExecPickId(){
  if(pendingExecPick === null) return null;
  if(typeof pendingExecPick === "number") return pendingExecPick;
  const c = execCandidates();
  return c.length ? c[0].id : null;
}
function pickExec(id){ pendingExecPick = id; renderPanel(); }
function pickVet(id){ pendingVetPick = id; renderPanel(); }
function pickSwap(i){ pendingExecSwap = i; renderPanel(); }
function execSelectHTML(){
  if(!S.staff.length) return "";
  const roleName = r => (STAFF_ROLES[r] || {}).name || r;
  const cands = execCandidates();
  let hh = "<div style='margin-top:8px;border-top:1px solid var(--line);padding-top:6px'>" +
    "<div style='font-size:12px'><b>🎗 役員に残す猫（ベテラン制度）</b> <span style='color:var(--sub)'>この会社で一番働いた猫が次の会社の役員になります（上限3匹・頭数に数えず、同じ役職に +10% のオーラ）</span></div>" +
    "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:4px'>";
  for(const c of cands){
    const sel = pendingExecPick === undefined ? c === cands[0] : pendingExecPick === c.id;
    hh += "<button onclick='pickExec(" + c.id + ")'" + (sel ? " class='primary'" : "") + ">🎗 " + esc(c.name) + "（" + roleName(c.role) + "）</button>";
  }
  hh += "<button onclick='pickExec(null)'" + (pendingExecPick === null ? " class='primary'" : "") + ">引き継がない</button></div>";
  if((S.executives || []).length >= 3 && pendingExecPick !== null){
    hh += "<div style='font-size:12px;margin-top:5px'>役員は満席です。入れ替える相手を選んでください（選ばなければ候補は記録に卒業します）</div>" +
      "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:3px'>";
    S.executives.forEach((e, i) => { hh += "<button onclick='pickSwap(" + i + ")'" + (pendingExecSwap === i ? " class='primary'" : "") + ">" + esc(e.name) + " と入替</button>"; });
    hh += "<button onclick='pickSwap(-1)'" + (pendingExecSwap === undefined || pendingExecSwap === -1 ? " class='primary'" : "") + ">入れ替えない</button></div>";
  }
  if(hasPerk("veteran")){
    const rest = S.staff.filter(s => s.id !== resolvedExecPickId()).sort((a, b) => b.lv - a.lv).slice(0, 3);
    if(rest.length){
      hh += "<div style='font-size:12px;margin-top:6px'><b>⭐ ベテランの引き継ぎ</b> <span style='color:var(--sub)'>役員とは別に、1人だけスタッフとして一緒に来ます</span></div>" +
        "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:3px'>";
      for(const c of rest){
        const sel = pendingVetPick === undefined ? c === rest[0] : pendingVetPick === c.id;
        hh += "<button onclick='pickVet(" + c.id + ")'" + (sel ? " class='primary'" : "") + ">" + esc(c.name) + "（Lv" + c.lv + "・" + roleName(c.role) + "）</button>";
      }
      hh += "</div>";
    }
  }
  return hh + "</div>";
}
function execSelArg(){ const id = resolvedExecPickId(); return id === null ? "__none" : id; }
function vetSelArg(){ return typeof pendingVetPick === "number" ? pendingVetPick : "__auto"; }
function swapSelArg(){ return typeof pendingExecSwap === "number" ? pendingExecSwap : -1; }
/* 研究ノート（星屑特典）で次の会社へ残す研究: 取得済みのうち最も高価なもの */
function notebookTopResearch(){
  const done = RESEARCH_DEFS.filter(r => S.research[r.id]).sort((a,b) => b.cost - a.cost);
  return done[0] || null;
}
/* 再設計 C3: 売却の内訳の物差し — 星屑の出どころ（比例枠ぶん／√域ぶん／売却特化ぶん）と
   売却実績の内訳（大きさ分＋時代ボーナス分）。付与側（doPrestigeCore の ptsGain）と一致させる */
function prestigeBreakdown(){
  const base = dustGainFromValue(S.runPeakValue || 0), cap = dustGainCap();
  const gain = Math.floor(base * (S.runPolicy === "sell" ? 1.25 : 1));
  return {
    propPart: Math.min(base, cap), sqrtPart: Math.max(0, base - cap),
    policyPart: Math.max(0, gain - base),
    ptsSize: gain >= 300 ? 3 : gain >= 100 ? 2 : 1,
    ptsEra: (S.eraDust || 0) >= HOLD_ERA_DUST ? 1 : 0
  };
}
function doPrestige(){
  /* 再設計 B13（ux-r3 §4.1 S1）: window.confirm は廃止。確認は売却カード内のインライン確認
     （卒業証書）が担い、ここは S2 の実行だけを行う */
  const pv = prestigePreview();
  const gain = pv.gain;
  if(gain < 3){ say("売却には星屑3個ぶんの実績がいるにゃ（現在 "+gain+" 個ぶん）"); return; }
  doPrestigeCore(execSelArg(), vetSelArg(), swapSelArg());
}
/* 確認なしの本体。menu (viewer) からは VERBS 経由でこちらが呼ばれ、確認は
   viewer 側スタブで済ませる (resetSave / doResetSave と同じ分担)。
   帯 (owner) で confirm を出すと帯のスレッドがモーダルで止まり、cmd-result も
   スナップショットも返らなくなって全体が固まる (v2.4.7 実機バグ・二窓リグで再現済み) */
/* 段階6: EXIT の節目。売却の回数で、2社目以降の立ち上がりを短くする仕組みが増えていく（持株化でも残る） */
const EXIT_MILESTONES = [
  { n: 1,  id: "autoResearch", name: "研究の自動選択", desc: "研究部がなくても、安い研究から自動で進めます" },
  { n: 3,  id: "start2",       name: "零細から創業",   desc: "新会社が社格「零細」から始まります" },
  { n: 5,  id: "autoEquip",    name: "設備の自動購入", desc: "所持コインの半分で買える設備を自動で買います" },
  { n: 8,  id: "start3",       name: "中小から創業",   desc: "新会社が社格「中小」から始まります" },
  { n: 12, id: "autoDept",     name: "部署の自動 Lv.up", desc: "所持コインの半分で上げられる部署を自動で上げます" }
];
function exitMs(id){ const m = EXIT_MILESTONES.find(x => x.id === id); return !!m && (S.prestiges || 0) >= m.n; }
function nextExitMs(){ return EXIT_MILESTONES.find(m => (S.prestiges || 0) < m.n) || null; }
function startRank(){ return exitMs("start3") ? 3 : exitMs("start2") ? 2 : 1; }
function exitMsHTML(){
  const nx = nextExitMs();   /* 再設計 C1: 次の節目までの残量（あと◯回）を最初の未達に付ける */
  return "<div class='note' style='margin-top:4px'>🎖 売却実績の節目: " + EXIT_MILESTONES.map(m =>
    ((S.prestiges || 0) >= m.n ? "✅" : "○") + m.n + "回 " + m.name + (nx && m === nx ? "（あと " + (m.n - (S.prestiges || 0)) + " 回）" : "")).join(" ／ ") + "</div>";
}
/* 段階6: 固定額だった持ち越しを、前の会社の自動収入の N 分ぶんにした（桁が上がっても効き目が残る） */
function seedMoney(){ return Math.max(3000, Math.floor(autoIncomePerSec() * 600)); }
function piggyCarry(coins){ return Math.min(Math.floor(coins * 0.1), Math.max(5000, Math.floor(autoIncomePerSec() * 1800))); }
/* 会社ひとつ分の状態を新会社の初期値へ戻す（EXIT と持株化で共通）。
   特典による持ち越しは呼び出し側がこの後に上書きする */
function resetCompanyRun(){
  S.coins = 0; S.rp = 0; S.ideas = 0; S.bugStock = 0; S.packages = 0;
  S.debt = 0; S.brand = 0;   /* 拡張ウェーブ G: 負債もブランドも新会社では清算（承認済み） */
  S.upgrades = {}; S.runDP = 0; S.runPeakValue = 0; S.incomeBy = {}; S.runHandDP = 0; S.activeRequest = null; S.nextRequestGenre = null;
  S.runStartedAt = Date.now();   /* 再設計 C8: EXIT 履歴の「所要」の起点。eraIncome は時代の間は消さない */
  /* レベルデザイン改修: 時代マイルストーン「シード突破」（eraDust 150）に届いた時代は、
     新しい会社が設備 Lv10 から始まる（ワイドモニターは企画上限の専用枠なので対象外） */
  if((S.eraDust || 0) >= 150) for(const id of ["devenv", "duck", "tester", "ci", "pack", "bot"]) S.upgrades[id] = 10;
  /* レベルデザイン改修: 経営方針は EXIT のたびに消費される。予約していた方針が次の会社に移り、予約は空になる */
  S.runPolicy = S.pendingPolicy || null; S.pendingPolicy = null;
  S.research = {}; S.runGenre = {};   /* 段階5: ジャンル知見の配分はこの会社の出荷から */
  S.depts = freshDepts(); S.bigDeal = null; S.salesRot = 0;   /* Phase C: 部署投資と大型案件もリセット（希望ジャンルは方針なので残す） */
  S.challenge = null;   /* 第2ウェーブ K: 未達のチャレンジは会社と一緒に終わる（報酬層は残る） */
  S.ips = [];   /* 第2ウェーブ L: 自社IP は会社の資産 — 売却・持株化で消える */
  S.catalog = [];   /* 再設計 段階1: 作品棚の売上も会社の資産 */
  S.annexStage = 0;   /* 再設計 B11: 看板の段階も会社と一緒にリセット（次周回は段階1から） */
  lastCatalogAtSec = -1;   /* 再設計 B4: 間隔係数の起点も会社と一緒にリセット（次の会社は最初の1本から） */
  S.subs = [];   /* Phase D: グループEXIT — 子会社も売却対象（価値は gain に上乗せ済み） */
  /* v2: スタッフ・スタジオ・ラインもリセット（ジャンル特化の希望だけ残す） */
  S.staff = [];
  S.studioLv = startRank();   /* 応援強化と応援P はみゅけ自身の腕前なので売却では残す（持株化で畳む）。段階6: EXIT の節目で開始社格が上がる */
  /* Phase B: S.maxStudioLv はここでリセットしない — 最高到達社格は売却後も残る永続記録 */
  S.wip = { code:0, tested:0, built:0 };
}
function doPrestigeCore(execSel, vetSel, swapSel){
  const pv = prestigePreview();
  const gain = pv.gain;
  if(gain < 3) return;   /* 第2ウェーブ I: 小口 EXIT の下限は 3 個 */
  const coinsBefore = S.coins;   /* 星の貯金箱の持ち越し計算用（リセット前に確保） */
  const carryCoins = (hasPerk("seedmoney") ? seedMoney() : 0) + (hasPerk("piggybank") ? piggyCarry(coinsBefore) : 0);   /* 段階6: 前の会社の収入の N 分ぶん */
  /* 第2ウェーブ M: 役員候補はリセット前に確定する（未指定なら act 1位） */
  let execCand = null;
  if(execSel !== "__none" && S.staff.length){
    execCand = (typeof execSel === "number")
      ? (S.staff.find(s => s.id === execSel) || null)
      : (execCandidates()[0] || null);
  }
  /* 特典の引き継ぎ対象はリセット前に確保する。ベテランは役員候補を
     除いた残りから選ぶ（同じ猫が両方になることはない） */
  let keptStaff = null;
  if(hasPerk("veteran") && S.staff.length){
    const rest = S.staff.filter(s => !execCand || s.id !== execCand.id);
    const pick = (typeof vetSel === "number") ? rest.find(s => s.id === vetSel) : null;
    const vet = pick || rest.slice().sort((a,b) => b.lv - a.lv)[0];
    if(vet) keptStaff = JSON.parse(JSON.stringify(vet));
    /* 第2ウェーブ M 事後チェック対応: act は「その周回」の活躍度なので、
       引き継ぎ時に 0 へ戻す。戻さないと前会社の通算 act を抱えたベテランが
       次周回の役員候補トップを最初から固定してしまう */
    if(keptStaff) keptStaff.act = 0;
  }
  let keptResearch = null;
  const nbTop = hasPerk("notebook") ? notebookTopResearch() : null;
  if(nbTop){
    /* Sprint 4: ティア2を残すときは前提チェーンごと引き継ぐ（前提なしの
       ティア2だけが残って効果だけ生きる、という状態を作らない） */
    keptResearch = [];
    let cur = nbTop;
    while(cur){ keptResearch.push(cur.id); cur = cur.requires ? RESEARCH_DEFS.find(r => r.id === cur.requires) : null; }
  }
  convertKnow();   /* 段階5: 余った研究P をジャンル知見に（リセット前） */
  /* レベルデザイン改修: 売却実績 pt。この EXIT で得た星屑が多いほど pt が増え、
     時代の通算星屑が条件（1,000）に届いている EXIT には +1pt のボーナスが付く */
  const eraBefore = S.eraDust || 0;
  const ptsGain = (gain >= 300 ? 3 : gain >= 100 ? 2 : 1) + (eraBefore >= HOLD_ERA_DUST ? 1 : 0);
  const newEraPts = eraExitPts() + ptsGain;
  const totalBefore = dustTotal();
  S.dust += gain; S.dustTotal = totalBefore + gain; S.prestiges++;
  S.eraExitPts = newEraPts;
  S.eraDust = (S.eraDust || 0) + gain;   /* 第2ウェーブ J: 時代の通算星屑（星団の材料） */
  /* 再設計 C8: EXIT の履歴を残す（B13 の「前回との差」・時代の記録の材料。直近50件まで） */
  if(!Array.isArray(S.exitHistory)) S.exitHistory = [];
  S.exitHistory.push({ t: Date.now(), gain, pts: ptsGain, secs: Math.max(0, Math.round((Date.now() - (S.runStartedAt || Date.now())) / 1000)), peak: S.runPeakValue || 0 });
  if(S.exitHistory.length > 50) S.exitHistory.splice(0, S.exitHistory.length - 50);
  resetCompanyRun();
  /* 特典の引き継ぎ: 初期資金・星の貯金箱・研究ノート・ベテラン */
  S.coins = carryCoins;
  if(keptResearch) for(const rid of keptResearch) S.research[rid] = true;
  if(keptStaff){ S.staff = [keptStaff]; S.staffSeq = Math.max(S.staffSeq, keptStaff.id); }
  addLog("🏢 会社を売却して、新会社を創業！ 星屑 +"+gain+"（永続ボーナス +"+Math.round((dustMultFor(S.dustTotal) - 1)*100)+"%）");
  addLog("🎖 売却実績 +"+ptsGain+"（現在 "+newEraPts+" / "+HOLD_EXITS+"）");
  /* 第2ウェーブ M: 役員の就任・交代・卒業（役員枠は EXIT では消えない） */
  if(execCand){
    const snap = { name: execCand.name, coat: execCand.coat, role: execCand.role };
    if(!Array.isArray(S.executives)) S.executives = [];
    if(!Array.isArray(S.execAlumni)) S.execAlumni = [];
    if(S.executives.length < 3){
      S.executives.push(snap);
      addLog("🎗 役員就任: 『"+snap.name+"』が新会社の役員になった（同じ役職に +10% のオーラ）");
    } else if(typeof swapSel === "number" && swapSel >= 0 && swapSel < S.executives.length){
      const out = S.executives[swapSel];
      S.execAlumni.push({ name: out.name, role: out.role });
      S.executives[swapSel] = snap;
      addLog("🎗 役員交代: 『"+snap.name+"』が就任し、『"+out.name+"』は記録に卒業した");
    } else {
      S.execAlumni.push({ name: snap.name, role: snap.role });
      addLog("🎗 『"+snap.name+"』は役員に空きがなく、記録に卒業した");
    }
  }
  if(keptStaff) addLog("⭐ ベテラン制度: "+keptStaff.name+"（Lv"+keptStaff.lv+"）が一緒についてきた");
  if(keptResearch && keptResearch.length) addLog("⭐ 研究ノート: 『"+(RESEARCH_DEFS.find(r=>r.id===keptResearch[0])||{}).name+"』を引き継いだ");
  if(carryCoins > 0) addLog("⭐ " + (hasPerk("seedmoney") ? "初期資金" : "") + (hasPerk("seedmoney") && hasPerk("piggybank") ? "と" : "") + (hasPerk("piggybank") ? "星の貯金箱" : "") + ": " + fmt(carryCoins) + "🪙 からスタート");
  const msNow = EXIT_MILESTONES.find(m => m.n === S.prestiges);
  if(msNow) addLog("🎖 EXIT " + msNow.n + " 回目の節目: 「" + msNow.name + "」— " + msNow.desc);
  startProject("S");
  /* 再設計 B13: 売却の瞬間は儀式（S3）が担う。締めのセリフは儀式の拍に委ね、
     余韻（S4）の差の告知をここで用意する（designer-r3 §1.2／§1.3） */
  startExitCeremony({
    execName: execCand ? execCand.name : null,
    keptName: keptStaff ? keptStaff.name : null,
    keptResearchName: keptResearch && keptResearch.length ? (RESEARCH_DEFS.find(r => r.id === keptResearch[0]) || {}).name : null,
    eraSeedStart: eraBefore >= 150,
    startLv: S.studioLv || 1
  });
  pendingExecPick = pendingVetPick = pendingExecSwap = undefined;
  checkStamps(); save(); renderPanel();
  tutCheck();   /* tut は引っ越しリセット対象外 (卒業状態を維持する) */
}

/* ---------- 第2ウェーブ J: ホールディングス化（第2層プレステージ） ----------
   条件は最高到達社格 Lv6＋子会社2社＋EXIT 12回＋時代の通算星屑（段階6）。持株化は EXIT のリセットに
   「第1層（星屑・星屑特典・通算星屑）を畳む」を足したもので、星団とレガシー
   技術・作品棚・実績・最高到達社格・レイアウトは残る。星団の益は時代の
   通算星屑（eraDust＝星屑を買っても減らない）の平方根（÷100 の平方根・最低1） — 特典を買うことが
   星団を減らさない形にしてある */
const LEGACY_TECHS = [
  { id:"forecast", name:"トレンド予報",       cost:1, desc:"次の市場の流れ（ブームと不況）が先読みできます" },
  { id:"cap1",    name:"雇用枠拡張 I",           cost:2, desc:"スタッフ上限 +6" },
  { id:"ai_base", name:"AI 開発基盤",          cost:2, desc:"モジュールの品質上限 1.5 → 1.75" },
  { id:"group",   name:"持株経営基盤",         cost:2, desc:"子会社の収益 +30%" },
  { id:"quantum", name:"量子コンピュータ",     cost:3, desc:"全生産 +25%" },
  { id:"cap2",    name:"雇用枠拡張 II",          cost:3, req:"cap1", desc:"スタッフ上限 さらに +6（合わせて最大48人）" }
];
function hasLegacyTech(id){ return !!(S.legacyTech && S.legacyTech[id]); }
/* 段階6: 見た目だけのオフィスグレードは星団で買わず、持株化の回数で開く（星団は力の解放だけに使う）。
   1回目: 棚に金の星・2回目: 金の本社看板・3回目: 金のトロフィー */
function legacyGrade(){ return Math.min(3, S.holdings || 0); }
/* 段階6: 持株化までの長さ。EXIT 5回 → 12回（節目をひと通り開いてから）に加えて、この時代の通算星屑 1,000個。
   インフレ修正（星屑1個ぶんの企業価値が倍率に連動）のあとは、放置 1日3時間で通算星屑 約1,000個が約1週間（sim の参考値） */
const HOLD_EXITS = 12, HOLD_ERA_DUST = 1000;
/* レベルデザイン改修: 持株化の「EXIT 12回」は「売却実績 12pt」に変わった。
   eraExitPts は時代内カウンタ（EXIT で加算・持株化で 0）。旧セーブ移行と直接操作に
   備え、この時代の EXIT 回数（通算 − 時代開始時の通算、上限 HOLD_EXITS）を下限にする */
function eraExitCount(){
  const start = typeof S.eraStartPrestiges === "number" ? S.eraStartPrestiges : (S.holdings || 0) * HOLD_EXITS;
  return Math.max(0, (S.prestiges || 0) - start);
}
function eraExitPts(){
  const stored = typeof S.eraExitPts === "number" && isFinite(S.eraExitPts) ? S.eraExitPts : 0;
  return Math.max(stored, Math.min(HOLD_EXITS, eraExitCount()));
}
/* 再設計 A1（leveldesign-r3 確定形）: 星団の獲得は階段表。条件の 1,000 で 3 個を保証し、
   eraDust が閾値を1つ越えるごとに +1（段の幅は緩やかに広がる: 250→2,300）。9,500 超では
   増えず 11 個で頭打ち（旧 0.65 乗式は無制限に伸びた。極端に長い時代ほど保守側にずれる
   のが確定形で、R&D 加速を抑える方向）。閾値ちょうどの獲得数は旧式と一致する
   （1,250→4・1,750→5・2,400→6・3,200→7・4,200→8・5,500→9・7,200→10・9,500→11）。
   初回の持株化だけ +1 個 */
const CLUSTER_STEPS = [1250, 1750, 2400, 3200, 4200, 5500, 7200, 9500];
function clusterGainFor(eraDust){
  let n = 0;
  for(const t of CLUSTER_STEPS) if(eraDust >= t) n++;
  return 3 + n + ((S.holdings || 0) === 0 ? 1 : 0);
}
function holdingsPreview(){
  const cond = {
    lv6: (S.maxStudioLv || 1) >= 6,
    subs: (S.subs || []).length >= 2,
    exits: eraExitPts() >= HOLD_EXITS,
    era: (S.eraDust || 0) >= HOLD_ERA_DUST
  };
  return { cond, can: cond.lv6 && cond.subs && cond.exits && cond.era,
           gain: clusterGainFor(S.eraDust || 0),
           baseNow: S.dustLegacyMult || 1, baseNext: holdBaseNext() };
}
/* 持株の土台（2026-10-28・宇宙編の桁）: 持株化で星屑は畳まれるが、星屑倍率の土台（S.dustLegacyMult）は
   持株化1回ごとに ×BAL.holdBaseStep（10）掛け上がって残る。土台は星屑倍率の一部なので生産と単価に効き、企業価値の単位
   （dustValueUnit）には別の指数 holdValueExp で効く — 売却と持株化のテンポは修正前とほぼ同じまま、時代ごとに収入の桁が上がる
   （sim 放置23日: 通算コイン 1e16 で頭打ち → 持株化7回で 1e26）。
   旧: 持株化のたびに倍率が ×1 に戻り、2回目以降の時代は毎回同じ桁（1e16 前後）で頭打ちだった（理念書4章の停滞区間） */
function holdBaseNext(){ return (S.dustLegacyMult || 1) * BAL.holdBaseStep; }
function buyLegacyTech(id){
  const def = LEGACY_TECHS.find(t => t.id === id);
  if(!def || hasLegacyTech(id)) return;
  if(def.req && !hasLegacyTech(def.req)){ say("先に前提の技術がいるにゃ"); return; }
  if((S.legacy || 0) < def.cost){ say("星団が足りないにゃ…"); return; }
  if(!S.legacyTech || typeof S.legacyTech !== "object") S.legacyTech = {};
  S.legacy -= def.cost; S.legacyTech[id] = true;
  SoundKit.play("purchase");
  addLog("🌌 レガシー技術: 『"+def.name+"』を取得（星団-"+def.cost+"）");
  say("『"+def.name+"』、取得にゃ！");
  save(); renderPanel();
}
/* レベルデザイン改修: 星団の無限シンク「恒久R&D投資」。レガシー技術を全部そろえた
   あとの星団の使い道。コストは 2, 3, 4… と購入回数で増え、上限なし。
   効果は production.ts の dustBonusEff が読む（星屑1個 = +50% → +60% → …） */
function allLegacyOwned(){ return LEGACY_TECHS.every(t => hasLegacyTech(t.id)); }
function rdInvestCost(){ return 2 + (S.rdInvest || 0); }
function buyRdInvest(){
  if(!allLegacyOwned()){ say("レガシー技術を全部そろえると開くにゃ"); return; }
  const cost = rdInvestCost();
  if((S.legacy || 0) < cost){ say("星団が足りないにゃ…"); return; }
  S.legacy -= cost; S.rdInvest = (S.rdInvest || 0) + 1;
  SoundKit.play("purchase");
  addLog("🌌 恒久研究（星屑増幅） Lv"+S.rdInvest+"（星団-"+cost+"）: 星屑1個の生産ボーナスが +"+Math.round(dustBonusEff()*100)+"%/個 になった");
  say("恒久研究にゃ！ 星屑の効きが強くなったよ");
  save(); renderPanel();
}
/* レベルデザイン改修: 経営方針（次の会社への特性）。売却パネルで事前に選んでおき、
   EXIT のたびに消費される。効果の実体は production.ts（生産・売却）／defs.ts（クリック）／
   tick.ts（入力ブースト）にある */
const POLICY_DEFS = {
  labor: { name:"労働特化",   desc:"応援クリック威力と入力ブースト ×2・自動生産 ×0.8" },
  auto:  { name:"自動化特化", desc:"自動生産 ×1.3・応援クリック威力 ×0.7" },
  sell:  { name:"売却特化",   desc:"EXIT の獲得星屑 ×1.25・生産 ×0.85" }
};
function setRunPolicy(p){
  S.pendingPolicy = (p && POLICY_DEFS[p]) ? p : null;
  if(S.pendingPolicy) addLog("🧭 次期経営方針を「"+POLICY_DEFS[S.pendingPolicy].name+"」に予約した");
  save(); renderPanel();
}
/* レベルデザイン改修: 時代マイルストーン（eraDust で進む・その時代の間ずっと有効）。
   効果の実体: 150 = resetCompanyRun の開始設備 Lv10／400 = production.ts の clickLinkRate／
   750 = production.ts の companyValue ×2 */
const ERA_MILESTONES = [
  { at: 150, name: "シード突破", desc: "新しい会社が設備 Lv10 から始まる" },
  { at: 400, name: "シリーズA", desc: "応援クリックの自動生産連動が 5% → 8%" },
  { at: 750, name: "IPO準備", desc: "企業価値の算定 ×2" }
];
/* 確認なしの本体（doPrestigeCore と同じ分担: 確認は帯側のラッパーと
   viewer スタブ側。帯で confirm を出すと全体が固まる） */
function doHoldingsCore(){
  const hp = holdingsPreview();
  if(!hp.can) return;
  const gain = hp.gain, base = hp.baseNext;
  /* 再設計 B13: 時代の記録と呼び名の変化は、畳む前に確保する（designer-r3 §1.5） */
  const NAME_DEFS = { rank6: COMPANY_RANKS[COMPANY_RANKS.length - 1], line: INCOME_SRCS.line || "ライン", subs: "子会社", catalog: "作品棚", sales: "営業", legacy: "レガシー技術" };
  const cerePre = {
    oldEraName: eraName(),
    exitsInEra: (S.prestiges || 0) - (S.eraStartPrestiges || 0),
    eraDustTotal: S.eraDust || 0,
    namesBefore: {} as Record<string, string>,
    nameDefs: NAME_DEFS as Record<string, string>
  };
  for(const k of Object.keys(NAME_DEFS)) cerePre.namesBefore[k] = spaceName(k, NAME_DEFS[k]);
  S.holdings = (S.holdings || 0) + 1;
  S.legacy = (S.legacy || 0) + gain;
  /* 第1層は畳む: 星屑・特典・通算（生産倍率の素）・時代の通算 */
  S.dust = 0; S.dustTotal = 0; S.dustPerks = {}; S.eraDust = 0; S.eraIncome = {}; S.dustLegacyMult = base; S.dustLegacyBase = 0;   /* 持株の土台は残る。再設計 C8: 時代の収入累計は時代ごとに仕切り直す */
  S.eraExitPts = 0; S.eraStartPrestiges = S.prestiges || 0;   /* レベルデザイン改修: 売却実績は新しい時代で 0 から */
  S.clickUp = {}; S.cheerP = 0;   /* 腕前（応援強化）も第1層と一緒に畳む */
  convertKnow();   /* 段階5: ジャンル知見は持株化でも残る（余った研究P も知見に） */
  /* EXIT と同じリセット（特典の引き継ぎは無い — 特典そのものが畳まれる） */
  resetCompanyRun();
  addLog("🏛️ ホールディングス化！ グループは持株会社の傘下に入った（星団 +"+gain+"・持株化 "+S.holdings+" 回目・星屑倍率の土台 ×"+fmt(base)+"）");
  startProject("S");
  checkStamps();
  /* 再設計 B13: 時代の転換は儀式（S3）が担う。呼び名の変化はスタンプ確定後に比べる */
  {
    const renames = [];
    for(const k of Object.keys(cerePre.namesBefore)){
      const now = spaceName(k, cerePre.nameDefs[k]);
      if(now !== cerePre.namesBefore[k]) renames.push({ from: cerePre.namesBefore[k], to: now });
    }
    startHoldingsCeremony({ gain, oldEraName: cerePre.oldEraName, newEraName: eraName(), renames, firstHoldings: S.holdings === 1 });
  }
  save(); renderPanel();
  tutCheck();
}
function doHoldings(){
  /* 再設計 B13（ux-r3 §4.1 S1）: window.confirm は廃止。確認は持株化カード内のインライン確認
     （時代の記録）が担い、ここは S2 の実行だけを行う */
  const hp = holdingsPreview();
  if(!hp.can){ say("持株化の条件がまだ揃ってないにゃ"); return; }
  doHoldingsCore();
}

/* ---------- 再設計 B13: 時代の名前と儀式（EXIT 卒業・持株化 改元） ----------
   遷移は ux-r3 §4（S0 日常 → S1 確認 → S2 実行 → S3 儀式 → S4 余韻）、文案は designer-r3 §1。
   儀式は帯の上だけで完結し、操作は奪わない。禁止語（喪失の語）は表示文に使わない */
function eraName(){
  /* 第1の時代は「星屑の時代」。以降は宇宙編の呼び名の到達に合わせて世界の呼び名が進む */
  if(S.stamps && S.stamps.holdings9) return "銀河の時代";
  if(S.stamps && S.stamps.holdings7) return "星間の時代";
  if(S.stamps && S.stamps.holdings4) return "月面の時代";
  if(S.stamps && S.stamps.holdings2) return "宇宙の時代";
  return "星屑の時代";
}
/* S3 の拍を進める（帯の常駐更新から呼ばれる）。t0 は最初の呼び出しで立つ（窓の切替に遅れても拍が潰れない） */
function ceremonyTick(){
  if(!ceremony) return;
  if(!ceremony.t0) ceremony.t0 = Date.now();
  const el = Date.now() - ceremony.t0;
  while(ceremony.step < ceremony.beats.length && ceremony.beats[ceremony.step].at <= el){
    const b = ceremony.beats[ceremony.step++];
    try{ b.run(); }catch(e){}
  }
  if(el >= ceremony.dur) ceremony = null;
}
/* 帯の描画が読む儀式の局面（看板の社名・棚の封） */
function ceremonyPhase(){
  if(!ceremony || !ceremony.t0) return "";
  const el = Date.now() - ceremony.t0;
  if(ceremony.kind === "exit"){
    if(el < 1300) return "signoff";
    if(el < 7000) return "sealed";
    return "newsign";
  }
  return "";
}
function startExitCeremony(pre){
  /* S4 余韻: 差の告知は発動の瞬間に1回ずつ、メモの優先枠へ（designer-r3 §1.3） */
  const notes = [(S.prestiges || 0) + " 回目の会社が始まりました。前の会社より速いはず——どこが違うか、見ていてください。"];
  if(pre.startLv > 1) notes.push("この会社は『" + rankName(pre.startLv) + "』から始まります。前の卒業が、ここに生きています。");
  if(pre.eraSeedStart) notes.push("時代のしるし：設備が Lv10 から始まりました。");
  if(pre.keptResearchName) notes.push("研究の引き継ぎ：『" + pre.keptResearchName + "』は、前の会社の成果です。");
  afterglowNotes = notes; afterglowShownAt = 0;
  firstReleasePending = true;
  /* S3 の拍（§1.2）: 看板の社名が消える → 棚に封 → 猫の一言 → 新しい看板と迎え */
  const cats = (S.staff || []).slice();
  const beats = [
    { at: 2600, run(){ say("おつかれさま。いい会社だったね。"); if(cats[0]) stripChat = { whoId: cats[0].id, text: "お世話になりました！", until: stripNow + 2600 }; } },
    { at: 5000, run(){ if(cats[1]) stripChat = { whoId: cats[1].id, text: "次の会社でも、がんばるにゃ。", until: stripNow + 2600 }; } },
    { at: 7200, run(){
      if(pre.execName){
        const ec = cats.find(c => c.name === pre.execName);
        if(ec) stripChat = { whoId: ec.id, text: "おかえり。続きから始めよう。", until: stripNow + 2800 };
        else say(pre.execName + "、おかえりにゃ。また一緒にやるにゃ！");
      } else if(pre.keptName){
        /* レビュー室の注記（§1.3）: 役員がいなくてもベテランが付いてきた場合は、その猫の迎えの一言を出す */
        const kc = cats.find(c => c.name === pre.keptName);
        if(kc) stripChat = { whoId: kc.id, text: "また会えたね。よろしくにゃ。", until: stripNow + 2800 };
        else say("また会えたね。よろしくにゃ。");
      } else say("さあ、新しい会社の始まりだにゃ。");
    } }
  ];
  ceremony = { kind: "exit", t0: 0, step: 0, beats, dur: 9800 };
}
function startHoldingsCeremony(pre){
  /* S4 余韻: 変わったことの告知は最大3件まで、順に（§1.6） */
  const changes = [];
  if(pre.newEraName !== pre.oldEraName) changes.push("この時代は『" + pre.newEraName + "』です。");
  if(pre.firstHoldings) changes.push("レガシー技術が開きました。星団の使い道は、研究のその先です。");
  changes.push("星屑倍率の土台が大きくなりました。これからの星屑は、もっと重くなります。");
  const kept = changes.slice(0, 3);
  afterglowNotes = ["新しい時代が始まりました。この時代で変わったことは、" + kept.length + "つあります。"].concat(kept);
  afterglowShownAt = 0;
  /* S3 の拍（§1.5 の核）: 静けさ → 時代の記録 → 金の点灯 → 呼び名 → 星団 → みゅけの一言 */
  const beats = [
    { at: 1600, run(){ addLog("🏛️ 『" + pre.oldEraName + "』を記録に収めました。消えたのではなく、収められました。"); } },
    { at: 3400, run(){ holdingsGlowUntil = Date.now() + 12000; } },
    { at: 5400, run(){ if(pre.renames.length) say("呼び名が変わりました：" + pre.renames[0].from + " は、これから『" + pre.renames[0].to + "』と呼ばれます。中身は同じ——時代が進んだ証です。"); } },
    { at: 7800, run(){
      ceremonyEraBanner = { name: pre.newEraName, until: Date.now() + 3600 };
      if(document.body.classList.contains("strip"))
        addStripFloater(102, 24, "星団 +" + pre.gain + " ——次の時代の種です。", "#d9a514");
    } },
    { at: 11200, run(){ say("時代が変わるね。……よし、また始めよう。"); } }
  ];
  ceremony = { kind: "holdings", t0: 0, step: 0, beats, dur: 14000 };
}
/* §1.4: 持株化の条件が1つ埋まるたび、帯メモで1回だけ知らせる */
let lastHoldCondMask = -1;
function holdingsCondTick(){
  if((S.prestiges || 0) < 1 && (S.maxStudioLv || 1) < 5) { lastHoldCondMask = 0; return; }   /* 遠いうちは数えない */
  const hp = holdingsPreview();
  const mask = (hp.cond.lv6 ? 1 : 0) | (hp.cond.subs ? 2 : 0) | (hp.cond.exits ? 4 : 0) | (hp.cond.era ? 8 : 0);
  if(lastHoldCondMask >= 0 && mask !== lastHoldCondMask){
    const cnt = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
    if(cnt(mask) > cnt(lastHoldCondMask)) reportNote("時代の終わりが、一つ近づきました。");
  }
  lastHoldCondMask = mask;
}

/* ---------- 第2ウェーブ K: チャレンジ周回 ----------
   会社を設立した直後（初回 EXIT 以降・Lv1・実績が1星屑ぶん未満）だけ
   受けられる縛りプレイ。同時に1つだけ、放棄はいつでも無償。目標を
   満たした瞬間に達成となり、報酬は EXIT でも持株化でも消えない
   永続パッシブ層 (challengeRewards) に入る。未達のまま会社を手放すと
   チャレンジは消える (ペナルティはそれだけ) */
/* 段階6: 目標の見直し。ブラック企業は累計コイン（桁が上がると一瞬で届いた）から企業価値へ。
   社格の目標は開始社格 +3（EXIT の節目で開始社格が上がっても易しくならない） */
const BLACK_GOAL_DUST = 10;
const CHALLENGE_DEFS = [
  { id:"minority", name:"少数精鋭",     rule:"スタッフ上限 6人（社格・技術より優先）／ スタッフの出力 +25%", goal:"開始社格から 3 段上へ", reward:"全スタッフの出力 +10%（永続）" },
  { id:"black",    name:"ブラック企業", rule:"バグ発生率 ×3 ／ 販売価格 ×2", goal:"企業価値を星屑 " + BLACK_GOAL_DUST + " 個ぶんまで", reward:"ブランドの増え幅 +50%（永続）" },
  { id:"idle",     name:"完全放置",     rule:"応援クリックと実作業ブーストが DP を生まない ／ フィーバーは自動生産から細く貯まる", goal:"開始社格から 3 段上へ", reward:"自動生産 +15%（永続）" }
];
function challengeGoalLv(){ return Math.min(STAFF_CAPS.length, (S.challenge && S.challenge.startLv || startRank()) + 3); }
function challengeDef(id){ return CHALLENGE_DEFS.find(c => c.id === id) || null; }
function challengeActive(id){ return !!(S.challenge && S.challenge.id === id); }
function challengeStartable(){
  return !S.challenge && ((S.prestiges || 0) >= 1 || (S.holdings || 0) >= 1) &&
    S.studioLv === startRank() && (S.runPeakValue || 0) < dustValueUnit();
}
function startChallenge(id){
  if(!challengeDef(id) || S.challenge) return;
  if(!challengeStartable()){ say("チャレンジは会社を設立した直後だけ受けられるにゃ"); return; }
  S.challenge = { id: id, startLv: S.studioLv };
  addLog("🎯 チャレンジ開始: 『"+challengeDef(id).name+"』— "+challengeDef(id).rule);
  say("チャレンジ『"+challengeDef(id).name+"』、はじめるにゃ！");
  save(); renderPanel();
}
function abandonChallenge(){
  if(!S.challenge) return;
  addLog("🎯 チャレンジ『"+challengeDef(S.challenge.id).name+"』をやめた（ペナルティなし）");
  S.challenge = null;
  say("チャレンジはやめたにゃ。また今度ね");
  save(); renderPanel();
}
function challengeGoalMet(){
  const c = S.challenge;
  if(!c) return false;
  if(c.id === "black") return (S.runPeakValue || 0) >= BLACK_GOAL_DUST * dustValueUnit();
  return S.studioLv >= challengeGoalLv();   /* minority / idle は開始社格 +3 */
}
function checkChallenge(){
  const c = S.challenge;
  if(!c || !challengeGoalMet()) return;
  const def = challengeDef(c.id);
  if(!def) { S.challenge = null; return; }
  if(!S.challengeRewards || typeof S.challengeRewards !== "object") S.challengeRewards = {};
  S.challengeRewards[c.id] = true;
  S.challenge = null;
  addLog("🏆 チャレンジ達成: 『"+def.name+"』！ 報酬「"+def.reward+"」を獲得");
  say("チャレンジ達成にゃ〜！！ 『"+def.name+"』クリア！");
  SoundKit.play("releaseFanfare");
  save(); renderPanel();
}

/* ---------- 第2ウェーブ L: 市場トレンド＋自社IP ----------
   トレンドは出荷の本数で回る市場の流れ（10本ごと。v2.12.1 までは常駐2時間）: ブームのジャンルは
   価格 ×1.5、不況は ×0.7。同じジャンルのブームは連続しない。開発の
   ジャンル選びはプレイヤーの方針 (devGenrePref) で重みづけし、
   依頼の自動獲得では 希望 ＞ トレンド ＞ 得意 の順に効く */
const TREND_CYCLE_SHIPS = 10;   /* 2026-10-27（v2.12.1）: 常駐2時間ごと → 出荷10本ごと（速く作るほど流れも速く回る） */
function trendOnShip(){
  ensureTrend();
  S.trend.ships = (S.trend.ships || 0) + 1;
  if(S.trend.ships >= TREND_CYCLE_SHIPS){ rotateTrend(); S.trend.ships = 0; }
}
function trendPool(){ const u = unlockedGenres(); return (u.length ? u : GENRES).map(g => g.id); }
function drawNextTrend(){
  const t = S.trend;
  if(!t) return;
  const pool = trendPool().filter(id => id !== t.boom);   /* 連続ブームの禁止 */
  t.nextBoom = pool[Math.floor(Math.random() * pool.length)];
  const rest = trendPool().filter(id => id !== t.nextBoom);
  t.nextSlump = rest[Math.floor(Math.random() * rest.length)];
}
function trendInit(){
  const pool = trendPool();
  const boom = pool[Math.floor(Math.random() * pool.length)];
  let slump = pool[Math.floor(Math.random() * pool.length)];
  if(slump === boom) slump = pool[(pool.indexOf(boom) + 1) % pool.length];
  S.trend = { boom: boom, slump: slump, nextBoom: null, nextSlump: null, cycleSec: 0, announceAt: 0 };
  drawNextTrend();
}
function ensureTrend(){ if(!S.trend || !S.trend.boom) trendInit(); }
function trendMult(genreId){
  ensureTrend();
  return genreId === S.trend.boom ? 1.5 : genreId === S.trend.slump ? 0.7 : 1;
}
function trendTag(genreId){
  ensureTrend();
  return genreId === S.trend.boom ? "📈" : genreId === S.trend.slump ? "📉" : "";
}
function rotateTrend(){
  const t = S.trend;
  t.boom = t.nextBoom; t.slump = t.nextSlump; t.cycleSec = 0;
  drawNextTrend();
  t.announceAt = Date.now();
  const bg = GENRES.find(g => g.id === t.boom), sg = GENRES.find(g => g.id === t.slump);
  addLog("📊 市場の流れが変わった: 「"+(bg ? bg.name : "")+"」がブーム（価格 ×1.5）／「"+(sg ? sg.name : "")+"」は不況（×0.7）");
  say("市場の流れが変わったにゃ。「"+(bg ? bg.name : "")+"」がブームだよ！");
}
function setDevGenrePref(id){ S.devGenrePref = id || null; save(); renderPanel(); }
/* 自社IP: M/L の作品をパネルで指定し、バグ0で出荷すると成立する。
   即時に価格の30%、その後はシリーズとして値段 × CAT.seriesPerMin /分 を EXIT まで毎秒稼ぐ
   （再設計 段階1。v2.12.1 までは出荷1本ごと、その前は常駐時間でロイヤリティが入っていた。production.ts の作品棚を参照）。
   2026-10-27 作り直し（sakuri「手動で操作する意味がない。バグがないときのボーナス程度」）:
   旧仕様は指定しても損がなく、指定できるなら常に指定するだけだった。いまは賭けにした。
   ・IP 作品は作り込みが要る: 指定した瞬間に作品の規模が ×IP_SIZE_MULT（値段の元は据え置き）
   ・出荷時にバグが残っていると IP 化は空振りし、作り込みが中途半端で価格 ×IP_FAIL_MULT
   ・成立した IP は会社の資産で、EXIT で消える（売却が近いなら狙わない）
   バグを0にして出荷できる見込み（QA の余力・帯のバグを手で叩く労働）と、売却までの残り時間を
   読んで狙うかを決める。損益分岐の成立率は sim の Wave L に出す */
const IP_SIZE_MULT = 1.5, IP_FAIL_MULT = 0.8;
function canDesignateIP(p, dp){ return !!p && !p.ip && !p.planning && (p.size === "M" || p.size === "L") && dp < p.totalDP * 0.5 && (S.ips || []).length < 3; }
function designateIP(_which?){
  const p = S.project, dp = S.projectDP;
  if(!p || p.ip) return;
  if(p.size !== "M" && p.size !== "L"){ say("自社IPにできるのは M / L の作品だけにゃ"); return; }
  if((S.ips || []).length >= 3){ say("自社IPは同時に3つまでにゃ"); return; }
  if(dp >= p.totalDP * 0.5){ say("IPにするなら、半分できる前に決めないとにゃ"); return; }
  p.ip = true;
  p.totalDP = Math.round(p.totalDP * IP_SIZE_MULT);
  addLog("🏷 『"+p.name+"』を自社IPねらいに（大作化：必要DP ×"+IP_SIZE_MULT+" → "+fmt(p.totalDP)+"DP。バグ0で出荷すれば IP 化、バグが残ると価格 ×"+IP_FAIL_MULT+"）");
  say("『"+p.name+"』、自社IPねらいでいくにゃ！ 出荷のときはバグ0にしないとね");
  save(); renderPanel();
}
/* 成立判定と登録だけを行う。即時の入金は release 側で「売却額の30%」に
   置き換え済み（全額＋30%ではない — それだと IP 指定が無条件に最適になる。
   レビュー室の事後チェックで確定した経済）。シリーズ売上の元本は
   依頼ボーナスを含まない通常価格 */
function settleIP(p, basePrice, work, ipOk){
  if(!p.ip) return;
  if(!ipOk){
    if(Math.floor(S.bugStock) > 0){ addLog("🏷 『"+p.name+"』はバグが残っていたので自社IPにできなかったにゃ（作り込みが空振りして価格 ×"+IP_FAIL_MULT+"）"); say("バグが残ってて IP にできなかったにゃ…"); }
    else addLog("🏷 自社IPの枠がいっぱいで『"+p.name+"』は通常リリースに");
    return;
  }
  if(!Array.isArray(S.ips)) S.ips = [];
  S.ips.push({ name: p.name, genre: p.genre, size: p.size, price: basePrice, bornSec: S.residentSec || 0, frac: 0, ships: 0, scale: p.scale || 1 });
  if(work) work.ip = true;
  addLog("🏷 『"+p.name+"』が自社IPになった！ 即時は売却額の30%だけ受け取り、あとはシリーズとして毎秒売れ続けるにゃ");
  say("『"+p.name+"』、自社IPになったにゃ！");
}
function ipConvertible(p){
  return !!p.ip && Math.floor(S.bugStock) <= 0 && (S.ips || []).length < 3;
}
/* 実績ボードの工程系: 詰まり→解消 と 全工程グリーン は「その瞬間」の事実なので、
   1秒ティックで見てフラグに残す（checkStamps はクリックごとにも呼ばれるので重い判定は置かない） */
let stampBnSeen = false;
function trackLineStamps(){
  if(!S.flags.bnCleared){
    if(currentBottleneck()) stampBnSeen = true;
    else if(stampBnSeen) S.flags.bnCleared = true;
  }
  if(!S.flags.allGreen && S.project && stageStatus().every(st => st.lamp === "green")) S.flags.allGreen = true;
  checkStamps();
}
function checkStamps(){
  for(const st of STAMP_DEFS){
    if(!S.stamps[st.id] && st.test(S)){
      S.stamps[st.id] = new Date().toLocaleDateString("ja-JP");
      addLog("🏅 実績スタンプ『"+st.name+"』をゲット！");
      skitOnStamp(st.id);   /* v2.26.1: 実績フレーバーの小芝居（物語の順・間隔は flavor.ts） */
    }
  }
}

