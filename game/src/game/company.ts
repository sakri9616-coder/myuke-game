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
const SUB_MAX_LV = 10;
const SUB_NAME_A = ["ねこねこ", "まるまる", "にゃんころ", "ふわラボ", "こねこ", "たまご", "ひげ", "すやすや"];
function subGenreRate(genreId){
  const i = GENRES.findIndex(g => g.id === genreId);
  return 1 + 0.1 * Math.max(0, i);   /* 解放が遅いジャンルほど単価が高い */
}
function subLvMult(sub){ return 1 + 0.3 * (sub.lv - 1); }
function subFocus(sub){ return 0.5 + 1.5 * Math.sqrt((sub.alloc || 0) / 100); }
function subRates(sub){
  const base = sub.staff * subLvMult(sub) * subFocus(sub) * (hasLegacyTech("group") ? 1.3 : 1);   /* 第2ウェーブ J: グループ経営 +30% */
  return { coins: base * 0.35 * subGenreRate(sub.genre), dp: base * 0.2 };
}
function subDustValue(sub){ return Math.max(1, Math.floor((sub.staff * 25 + sub.lv * 500) / 500)); }
function subsTotalStaff(){ return (S.subs || []).reduce((a, s) => a + s.staff, 0); }
function totalPeople(){ return S.staff.length + subsTotalStaff(); }
function foundCost(){ return 15000 * Math.pow(2, (S.subs || []).length); }
function subHeadCost(sub){ return Math.ceil(120 * Math.pow(1.06, sub.staff)); }
function subHeadCostN(sub, n){
  let t = 0;
  for(let i = 0; i < n; i++) t += Math.ceil(120 * Math.pow(1.06, sub.staff + i));
  return t;
}
function subScaleCost(sub){ return Math.ceil(4000 * Math.pow(2.2, sub.lv - 1)); }
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
  let name = SUB_NAME_A[(S.subSeq || 0) % SUB_NAME_A.length] + g.name + "工房";
  if(S.subs.some(s => s.name === name)) name += " " + (S.subs.filter(s => s.name.startsWith(name.split(" ")[0])).length + 1) + "号";
  const sub = { id: ++S.subSeq, name, genre: g.id, staff: 5, lv: 1, alloc: 0 };
  S.subs.push(sub);
  normalizeAlloc();
  SoundKit.play("purchase");
  addLog("🏢 子会社「"+name+"」を設立！（-" + fmt(cost) + "🪙）得意は"+g.name+"、人員 5 人で発足");
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
  addLog("🏢 "+sub.name+" が規模Lv"+sub.lv+" に（出力 ×"+subLvMult(sub).toFixed(1)+"）（-" + fmt(cost) + "🪙）");
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
  { id:"piggybank", name:"星の貯金箱",   cost:2,  desc:"売却時、所持コインの 10%（最大 500🪙）を新会社に持ち越します" },
  { id:"stardecor", name:"棚の星飾り",   cost:2,  desc:"帯の作品棚の天板に星の飾りが出ます（見た目の自慢）" },
  { id:"seedmoney", name:"初期資金",     cost:3,  desc:"売却して創業した直後の所持コインが 300🪙 から始まります" },
  { id:"dreamplus", name:"夢の続き",     cost:3,  desc:"夢のお土産（30分以上あけて戻った時のアイデア）が +1 個増えます" },
  { id:"focus",     name:"集中ブースト", cost:4,  desc:"応援クリックの威力 +10%" },
  { id:"notebook",  name:"研究ノート",   cost:6,  desc:"売却時に、完了した研究を1件（最も研究Pが高かったもの）引き継ぎます" },
  { id:"veteran",   name:"ベテラン制度", cost:8,  desc:"売却時に、最も育ったスタッフ1人が新会社に来てくれます" },
  /* Sprint 4: レベル制（反復購入できる星屑シンク）。S.dustPerks[id] に数値で持つ */
  { id:"starcharm", name:"星のチャーム", lv:true, baseCost:3, costMul:1.8, maxLv:10, desc:"生産 +2%/Lv（最大Lv10）" },
  { id:"luckyfin",  name:"幸運のヒレ",   lv:true, baseCost:2, costMul:1.8, maxLv:10, desc:"フィッシュの間隔 -8%/Lv（最大Lv10）" }
];
function fishIntervalMul(){ return (1 - 0.08 * perkLv("luckyfin")) * (hasPerk("omamori") ? 0.95 : 1); }   /* 第2ウェーブ I: 星屑のお守りで別枠 -5% */
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
  const subGain = (S.subs || []).reduce((a, s) => a + subDustValue(s), 0);
  const gain = Math.floor(S.runDP / BAL.prestigeDPPerDust) + subGain;
  const total = dustTotal();
  const resets = ["コイン", "アップグレード", "研究", "スタッフ", "第2ライン", "応援強化"];
  if(subGain > 0) resets.push("子会社");
  const keeps = ["作品棚", "日報", "実績", "星屑と購入済み特典"];
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
  if(hasPerk("seedmoney")) keeps.push("初期資金 300🪙");
  if(hasPerk("piggybank")) keeps.push("星の貯金箱（コインの10%・最大500🪙を持ち越し）");
  if(S.executives && S.executives.length) keeps.push("役員 " + S.executives.map(e => "『"+e.name+"』").join(""));   /* 第2ウェーブ M */
  return {
    gain, subGain,
    curMult: 1 + BAL.dustBonus * total,
    nextMult: 1 + BAL.dustBonus * (total + gain),
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
    "<div style='font-size:12px'><b>🎗 役員の引き継ぎ</b> <span style='color:var(--sub)'>この会社で一番働いた猫が次の会社の役員になります（上限3匹・頭数に数えず、同じ役職に +10% のオーラ）</span></div>" +
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
function doPrestige(){
  const pv = prestigePreview();
  const gain = pv.gain;
  if(gain < 3){ say("売却には星屑3個ぶんの実績がいるにゃ（現在 "+gain+" 個ぶん）"); return; }
  if(!confirm("会社を売却しますか？\n星屑 "+gain+" 個を得て、生産倍率は ×"+pv.curMult.toFixed(2)+" → ×"+pv.nextMult.toFixed(2)+" になります。\nリセット: "+pv.resets.join("・")+"\n引き継ぎ: "+pv.keeps.join("・"))) return;
  doPrestigeCore(execSelArg(), vetSelArg(), swapSelArg());
}
/* 確認なしの本体。menu (viewer) からは VERBS 経由でこちらが呼ばれ、確認は
   viewer 側スタブで済ませる (resetSave / doResetSave と同じ分担)。
   帯 (owner) で confirm を出すと帯のスレッドがモーダルで止まり、cmd-result も
   スナップショットも返らなくなって全体が固まる (v2.4.7 実機バグ・二窓リグで再現済み) */
/* 会社ひとつ分の状態を新会社の初期値へ戻す（EXIT と持株化で共通）。
   特典による持ち越しは呼び出し側がこの後に上書きする */
function resetCompanyRun(){
  S.coins = 0; S.rp = 0; S.ideas = 0; S.bugStock = 0; S.packages = 0;
  S.debt = 0; S.brand = 0; S.vendorReadyAt = 0;   /* 拡張ウェーブ G: 負債もブランドも新会社では清算（承認済み） */
  S.upgrades = {}; S.runDP = 0; S.activeRequest = null; S.nextRequestGenre = null;
  S.research = {};
  S.researchLv = {};   /* Sprint 4: 反復研究もリセット対象 */
  S.depts = freshDepts(); S.bigDeal = null; S.salesRot = 0;   /* Phase C: 部署投資と大型案件もリセット（希望ジャンルは方針なので残す） */
  S.challenge = null;   /* 第2ウェーブ K: 未達のチャレンジは会社と一緒に終わる（報酬層は残る） */
  S.ips = [];   /* 第2ウェーブ L: 自社IP は会社の資産 — 売却・持株化で消える */
  S.subs = [];   /* Phase D: グループEXIT — 子会社も売却対象（価値は gain に上乗せ済み） */
  /* v2: スタッフ・スタジオ・応援強化・ラインもリセット（ジャンル特化の希望だけ残す） */
  S.staff = [];
  S.clickUp = {}; S.studioLv = 1;
  /* Phase B: S.maxStudioLv はここでリセットしない — 最高到達社格は売却後も残る永続記録 */
  S.wip = { code:0, tested:0, built:0 };
  S.line2 = { unlocked:false, genre:S.line2.genre, project:null, projectDP:0, commitMark:0, wip:{ code:0, tested:0, built:0 } };
}
function doPrestigeCore(execSel, vetSel, swapSel){
  const pv = prestigePreview();
  const gain = pv.gain;
  if(gain < 3) return;   /* 第2ウェーブ I: 小口 EXIT の下限は 3 個 */
  const coinsBefore = S.coins;   /* 星の貯金箱の持ち越し計算用（リセット前に確保） */
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
  const totalBefore = dustTotal();
  S.dust += gain; S.dustTotal = totalBefore + gain; S.prestiges++;
  S.eraDust = (S.eraDust || 0) + gain;   /* 第2ウェーブ J: 時代の通算星屑（星団の材料） */
  resetCompanyRun();
  /* 特典の引き継ぎ: 初期資金・星の貯金箱・研究ノート・ベテラン */
  S.coins = (hasPerk("seedmoney") ? 300 : 0) + (hasPerk("piggybank") ? Math.min(500, Math.floor(coinsBefore * 0.1)) : 0);
  if(keptResearch) for(const rid of keptResearch) S.research[rid] = true;
  if(keptStaff){ S.staff = [keptStaff]; S.staffSeq = Math.max(S.staffSeq, keptStaff.id); }
  addLog("🏢 会社を売却して、新会社を創業！ 星屑 +"+gain+"（永続ボーナス +"+Math.round(BAL.dustBonus*S.dustTotal*100)+"%）");
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
  if(hasPerk("seedmoney")) addLog("⭐ 初期資金: 300🪙 からスタート");
  if(hasPerk("piggybank") && S.coins > (hasPerk("seedmoney") ? 300 : 0)) addLog("⭐ 星の貯金箱: 前の会社のコインを持ち越した");
  say("売却成立だにゃ〜！ 星屑"+gain+"個ゲット");
  startProject("S");
  /* 第2ウェーブ M: 役員がいる会社の創業は「おかえり」から始まる */
  if(S.executives && S.executives.length)
    say("『"+S.executives[0].name+"』、おかえりにゃ。また一緒にやるにゃ！");
  pendingExecPick = pendingVetPick = pendingExecSwap = undefined;
  checkStamps(); save(); renderPanel();
  tutCheck();   /* tut は引っ越しリセット対象外 (卒業状態を維持する) */
}

/* ---------- 第2ウェーブ J: ホールディングス化（第2層プレステージ） ----------
   条件は最高到達社格 Lv6＋子会社2社＋EXIT 5回。持株化は EXIT のリセットに
   「第1層（星屑・星屑特典・通算星屑）を畳む」を足したもので、星団とレガシー
   技術・作品棚・実績・最高到達社格・レイアウトは残る。星団の益は時代の
   通算星屑（eraDust＝星屑を買っても減らない）÷20・最低1 — 特典を買うことが
   星団を減らさない形にしてある */
const LEGACY_TECHS = [
  { id:"forecast", name:"トレンド予報",       cost:1, desc:"次の市場の流れ（ブームと不況）が先読みできます" },
  { id:"grade1",  name:"オフィスグレード I",   cost:1, desc:"帯の棚に金の星の置物が出ます" },
  { id:"cap1",    name:"上限拡張 I",           cost:2, desc:"スタッフ上限 +6" },
  { id:"ai_base", name:"AI 開発基盤",          cost:2, desc:"モジュールの品質上限 1.5 → 1.75" },
  { id:"group",   name:"グループ経営",         cost:2, desc:"子会社の収益 +30%" },
  { id:"quantum", name:"量子コンピュータ",     cost:3, desc:"全生産 +25%" },
  { id:"cap2",    name:"上限拡張 II",          cost:3, req:"cap1", desc:"スタッフ上限 さらに +6（合わせて最大48人）" },
  { id:"grade2",  name:"オフィスグレード II",  cost:2, req:"grade1", desc:"別館看板が金の本社看板になります" },
  { id:"grade3",  name:"オフィスグレード III", cost:3, req:"grade2", desc:"帯の棚に金のトロフィーが出ます" }
];
function hasLegacyTech(id){ return !!(S.legacyTech && S.legacyTech[id]); }
function legacyGrade(){ return hasLegacyTech("grade3") ? 3 : hasLegacyTech("grade2") ? 2 : hasLegacyTech("grade1") ? 1 : 0; }
function holdingsPreview(){
  const cond = {
    lv6: (S.maxStudioLv || 1) >= 6,
    subs: (S.subs || []).length >= 2,
    exits: (S.prestiges || 0) >= 5
  };
  return { cond, can: cond.lv6 && cond.subs && cond.exits,
           gain: Math.max(1, Math.floor((S.eraDust || 0) / 20)) };
}
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
/* 確認なしの本体（doPrestigeCore と同じ分担: 確認は帯側のラッパーと
   viewer スタブ側。帯で confirm を出すと全体が固まる） */
function doHoldingsCore(){
  const hp = holdingsPreview();
  if(!hp.can) return;
  const gain = hp.gain;
  S.holdings = (S.holdings || 0) + 1;
  S.legacy = (S.legacy || 0) + gain;
  /* 第1層は畳む: 星屑・特典・通算（生産倍率の素）・時代の通算 */
  S.dust = 0; S.dustTotal = 0; S.dustPerks = {}; S.eraDust = 0;
  /* EXIT と同じリセット（特典の引き継ぎは無い — 特典そのものが畳まれる） */
  resetCompanyRun();
  addLog("🏛️ ホールディングス化！ グループは持株会社の傘下に入った（星団 +"+gain+"・持株化 "+S.holdings+" 回目）");
  say("持株化したにゃ〜！ 星団"+gain+"個ゲット。これからもよろしくにゃ");
  startProject("S");
  checkStamps(); save(); renderPanel();
  tutCheck();
}
function doHoldings(){
  const hp = holdingsPreview();
  if(!hp.can){ say("持株化の条件がまだ揃ってないにゃ"); return; }
  if(!confirm("ホールディングス化しますか？\n星団 "+hp.gain+" 個を得ます。\nリセット: コイン・スタッフ・研究・部署・子会社・星屑と星屑特典（第1層は畳まれます）\n残るもの: レガシー技術・作品棚・実績スタンプ・最高到達社格・レイアウト")) return;
  doHoldingsCore();
}

/* ---------- 第2ウェーブ K: チャレンジ周回 ----------
   会社を設立した直後（初回 EXIT 以降・Lv1・実績が1星屑ぶん未満）だけ
   受けられる縛りプレイ。同時に1つだけ、放棄はいつでも無償。目標を
   満たした瞬間に達成となり、報酬は EXIT でも持株化でも消えない
   永続パッシブ層 (challengeRewards) に入る。未達のまま会社を手放すと
   チャレンジは消える (ペナルティはそれだけ) */
const BLACK_RUN_COINS_GOAL = 300000;
const CHALLENGE_DEFS = [
  { id:"minority", name:"少数精鋭",     rule:"スタッフ上限 6人（社格・技術より優先）／ スタッフの出力 +25%", goal:"スタジオ Lv4 到達", reward:"全スタッフの出力 +10%（永続）" },
  { id:"black",    name:"ブラック企業", rule:"バグ発生率 ×3 ／ 販売価格 ×2", goal:"この会社で累計 300,000🪙 稼ぐ", reward:"ブランドの増え幅 +50%（永続）" },
  { id:"idle",     name:"完全放置",     rule:"応援クリックと実作業ブーストが DP を生まない ／ フィーバーは自動生産から細く貯まる", goal:"スタジオ Lv4 到達", reward:"自動生産 +15%（永続）" }
];
function challengeDef(id){ return CHALLENGE_DEFS.find(c => c.id === id) || null; }
function challengeActive(id){ return !!(S.challenge && S.challenge.id === id); }
function challengeStartable(){
  return !S.challenge && ((S.prestiges || 0) >= 1 || (S.holdings || 0) >= 1) &&
    S.studioLv === 1 && S.runDP < BAL.prestigeDPPerDust;
}
function startChallenge(id){
  if(!challengeDef(id) || S.challenge) return;
  if(!challengeStartable()){ say("チャレンジは会社を設立した直後だけ受けられるにゃ"); return; }
  S.challenge = { id: id, startCoins: S.totals.coinsEarned || 0 };
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
  if(c.id === "black") return (S.totals.coinsEarned || 0) - (c.startCoins || 0) >= BLACK_RUN_COINS_GOAL;
  return S.studioLv >= 4;   /* minority / idle は Lv4 到達が目標 */
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
   トレンドは常駐時間で回る市場の流れ（2時間周期）: ブームのジャンルは
   価格 ×1.5、不況は ×0.7。同じジャンルのブームは連続しない。開発の
   ジャンル選びはプレイヤーの方針 (devGenrePref) で重みづけし、
   依頼の自動獲得では 希望 ＞ トレンド ＞ 得意 の順に効く */
const TREND_CYCLE_SEC = 7200;
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
   即時に価格の30%、その後は価格の 0.1%/分 のロイヤリティが
   12時間ごとに半減しながら48時間入る（生涯で約 ×1.65） */
function designateIP(which){
  const p = which === "l2" ? (S.line2 && S.line2.project) : S.project;
  if(!p || p.ip) return;
  if(p.size !== "M" && p.size !== "L"){ say("自社IPにできるのは M / L の作品だけにゃ"); return; }
  if((S.ips || []).length >= 3){ say("自社IPは同時に3つまでにゃ"); return; }
  p.ip = true;
  addLog("🏷 『"+p.name+"』を自社IPに指定（バグ0で出荷すると IP 化します）");
  say("『"+p.name+"』、自社IPねらいでいくにゃ！");
  save(); renderPanel();
}
/* 成立判定と登録だけを行う。即時の入金は release 側で「売却額の30%」に
   置き換え済み（全額＋30%ではない — それだと IP 指定が無条件に最適になる。
   レビュー室の事後チェックで確定した経済）。ロイヤリティの元本は
   依頼ボーナスを含まない通常価格 */
function settleIP(p, basePrice, work, ipOk){
  if(!p.ip) return;
  if(!ipOk){
    if(Math.floor(S.bugStock) > 0) addLog("🏷 『"+p.name+"』はバグが残っていたので自社IPにできなかったにゃ");
    else addLog("🏷 自社IPの枠がいっぱいで『"+p.name+"』は通常リリースに");
    return;
  }
  if(!Array.isArray(S.ips)) S.ips = [];
  S.ips.push({ name: p.name, genre: p.genre, size: p.size, price: basePrice, bornSec: S.residentSec || 0, frac: 0 });
  if(work) work.ip = true;
  addLog("🏷 『"+p.name+"』が自社IPになった！ 即時は売却額の30%だけ受け取り、残りはロイヤリティで入るにゃ");
  say("『"+p.name+"』、自社IPになったにゃ！");
}
function ipConvertible(p){
  return !!p.ip && Math.floor(S.bugStock) <= 0 && (S.ips || []).length < 3;
}
function tickIPs(){
  if(!S.ips || !S.ips.length) return;
  const nowSec = S.residentSec || 0;
  let changed = false;
  for(const ip of S.ips.slice()){
    const ageH = (nowSec - (ip.bornSec || 0)) / 3600;
    if(ageH >= 48){
      S.ips.splice(S.ips.indexOf(ip), 1);
      addLog("🏷 自社IP『"+ip.name+"』はロイヤリティ期間を終えたにゃ（48時間）");
      changed = true;
      continue;
    }
    const decay = Math.pow(0.5, Math.floor(ageH / 12));
    ip.frac = (ip.frac || 0) + ip.price * 0.001 * decay / 60;
    if(ip.frac >= 1){
      const pay = Math.floor(ip.frac);
      ip.frac -= pay;
      S.coins += pay; S.totals.coinsEarned += pay;
      if(Math.random() < 0.25 && document.body.classList.contains("strip"))
        addStripFloater(stripShelfCX(), STRIP_GROUND - 70, "💰 ロイヤリティ", "#c9962e");
      changed = true;
    }
  }
  if(changed) save();
}
function checkStamps(){
  for(const st of STAMP_DEFS){
    if(!S.stamps[st.id] && st.test(S)){
      S.stamps[st.id] = new Date().toLocaleDateString("ja-JP");
      addLog("🏅 実績スタンプ『"+st.name+"』をゲット！");
    }
  }
}

