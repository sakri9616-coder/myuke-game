/* ---------- プロジェクト ---------- */
function unlockedGenres(){
  return GENRES.filter(g => !g.lockedBy || S.research[g.lockedBy]);
}
/* 着工時のアイデア消費（企画工程を実在させる）。チュートリアルと XS は無料で序盤を詰まらせない */
const IDEA_COST = { TUT:0, XS:0, S:2, M:5, L:10 };
/* サイズ抽選は「現在の実効スループットで何分かかるか」で行う（目標 40分〜3時間）。
   大きすぎるサイズを引いた直後は次に S 以下を保証する（ピティ）。 */
function drawSizeByTime(){
  const rate = Math.max(1, Math.min(productionRate(), testRate() * bugFactor(), buildRate(), shipRate()));
  const weighted = ["XS","S","S","M","M","L"];
  const ok = weighted.filter(s => { const m = BAL.sizes[s] / rate; return m >= 40 && m <= 180; });
  if(S.bigDrawStreak >= 1){
    S.bigDrawStreak = 0;
    return ok.includes("S") ? "S" : (ok[0] || "XS");
  }
  let size;
  if(ok.length) size = ok[Math.floor(Math.random()*ok.length)];
  else size = ["XS","S","M","L"].reduce((a, c) =>
    Math.abs(BAL.sizes[c] / rate - 90) < Math.abs(BAL.sizes[a] / rate - 90) ? c : a);
  S.bigDrawStreak = (BAL.sizes[size] / rate > 150) ? S.bigDrawStreak + 1 : 0;
  return size;
}
/* ---------- 企画を練る（2026-10-27・工程中心化）----------
   余ったアイデアを、進行中の作品の企画に注ぎ込む。企画Lv 1つにつき
   作品の価格 +15%・その作品のバグ混入 -15%（仕様が固まるほどテストが楽になる）。
   最大 Lv3、練れるのは進捗が半分に届くまで。費用は作品の大きさに比例し、
   Lv が上がるほど重い（totalDP/20 × 次のLv）。どの作品に練り込むかを選ぶのが判断になる */
const PLAN_MAX = 3;
function planLv(p){ return (p && p.planLv) || 0; }
function planCost(p){ return Math.ceil(p.totalDP / 20) * (planLv(p) + 1); }
function planPriceMult(p){ return 1 + 0.15 * planLv(p); }
function planBugMult(p){ return 1 - 0.15 * planLv(p); }
function canPlan(p, dp){ return !!p && p.size !== "TUT" && planLv(p) < PLAN_MAX && dp < p.totalDP * 0.5; }
function planProject(which){
  const l2 = which === "l2";
  const p = l2 ? S.line2.project : S.project;
  const dp = l2 ? S.line2.projectDP : S.projectDP;
  if(!canPlan(p, dp)){ say("この作品の企画はもう練れないにゃ"); return; }
  const cost = planCost(p);
  if(S.ideas < cost){ say("アイデアが足りないにゃ（あと " + Math.ceil(cost - S.ideas) + " 個）"); return; }
  S.ideas -= cost;
  p.planLv = planLv(p) + 1;
  addLog("💡 『" + p.name + "』の企画を練った（企画Lv" + p.planLv + "・価格 ×" + planPriceMult(p).toFixed(2) + "・バグ -" + Math.round(15 * p.planLv) + "%）（アイデア-" + cost + "）");
  say("企画を練ったにゃ！ いい作品になりそう");
  save(); renderPanel();
}
/* プロジェクトの着工可否を決める: アイデアが足りれば消費して着工、
   足りなければ planning（企画中）にして、貯まるまで工程に流さない */
function settleProject(p){
  if(!p) return p;
  if(typeof p.ideaCost !== "number") p.ideaCost = IDEA_COST[p.size] || 0;
  if(p.ideaCost <= 0){ p.planning = false; return p; }
  if(S.ideas >= p.ideaCost){
    S.ideas -= p.ideaCost; p.planning = false;
    addLog("💡 『"+p.name+"』に着工（アイデア-"+p.ideaCost+"）");
  } else {
    p.planning = true;
    addLog("『"+p.name+"』は企画中… アイデアがあと"+(p.ideaCost - Math.floor(S.ideas))+"個必要にゃ");
  }
  return p;
}
/* 企画中プロジェクトにアイデアが貯まったら着工する（tick から毎秒呼ばれる） */
function tryStartPlanning(){
  for(const p of [S.project, S.line2.project]){
    if(p && p.planning && S.ideas >= (p.ideaCost || 0)){
      S.ideas -= p.ideaCost; p.planning = false;
      addLog("💡 企画がまとまった！『"+p.name+"』に着工（アイデア-"+p.ideaCost+"）");
      say("企画がまとまったにゃ！『"+p.name+"』作るよ");
    }
  }
}
/* ---------- Sprint 4: 作品名ジェネレータ ----------
   [接頭辞]×[対象]×[ジャンル]×[版表記] の組合せで 500 通りを大きく超える。
   直近12作品と同名は避ける（S.recentNames に履歴を持つ・セーブ対象） */
const NAME_PREFIXES = ["猫用","全力","秘密の","真夜中の","もふもふ","無限","ちいさな","伝説の","爆速","夢の","究極の","放課後の"];
const NAME_SUFFIXES = ["2.0","DX","完全版","リマスター","プラス","・改","2026","にゃん仕様"];
function composeName(subj, genre){
  if(!Array.isArray(S.recentNames)) S.recentNames = [];
  let name = subj.name + genre.name;
  for(let i = 0; i < 10; i++){
    let n = subj.name + genre.name;
    if(Math.random() < 0.45) n = NAME_PREFIXES[Math.floor(Math.random()*NAME_PREFIXES.length)] + n;
    if(Math.random() < 0.35) n += NAME_SUFFIXES[Math.floor(Math.random()*NAME_SUFFIXES.length)];
    name = n;
    if(!S.recentNames.includes(n)) break;
  }
  S.recentNames.push(name);
  if(S.recentNames.length > 12) S.recentNames.splice(0, S.recentNames.length - 12);
  return name;
}
/* 作品の「その作品だけの物語」1行を、開発の実データ（バグ数・開発時間・
   昼寝回数・生まれた時刻）から作る。棚タブに刻まれる */
function makeHighlight(p, devMin, naps){
  const bugs = Math.round(p.bugs || 0);
  const hour = p.startedAt ? new Date(p.startedAt).getHours() : 12;
  if(bugs === 0) return "バグゼロの奇跡の一作";
  if(bugs >= 15) return "バグ" + bugs + "匹と格闘した力作";
  if(naps === 0 && devMin >= 20) return "昼寝ゼロで走り切った集中の一作";
  if(hour >= 0 && hour < 5) return "深夜に生まれた、静かな力作";
  if(devMin <= 8) return "あっという間に駆け抜けた一作";
  if(bugs >= 8) return "バグと戦いながら育った一作";
  const pool = ["みゅけのお気に入り", "手応えのある一作", "棚の主役候補", "コツコツ育てた自信作"];
  let h = 0; const nm = p.name || "";
  for(let i = 0; i < nm.length; i++) h = (h * 31 + nm.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
/* 第2ウェーブ L: 開発ジャンルは方針 (devGenrePref) で重みづけして引く。
   固定はしない — 方針のジャンルが3倍出やすいだけ */
function pickDevGenre(gs){
  let total = 0;
  const ws = gs.map(g => { const w = 1 + (S.devGenrePref && g.id === S.devGenrePref ? 3 : 0); total += w; return w; });
  let r = Math.random() * total;
  for(let i = 0; i < gs.length; i++){ r -= ws[i]; if(r <= 0) return gs[i]; }
  return gs[gs.length - 1];
}
function genProject(sizeOverride, genreId?){
  const gs = unlockedGenres();
  const genre = genreId ? GENRES.find(g=>g.id===genreId) : pickDevGenre(gs);
  const subj = SUBJECTS[Math.floor(Math.random()*SUBJECTS.length)];
  const size = sizeOverride || drawSizeByTime();
  const featPool = genre.feats.slice();
  const nFeat = 3 + Math.floor(Math.random()*3);
  const feats = [];
  for(let i=0;i<nFeat && featPool.length;i++){
    feats.push(featPool.splice(Math.floor(Math.random()*featPool.length),1)[0]);
  }
  return {
    name: composeName(subj, genre), genre: genre.id, genreName: genre.name,
    desc: subj.desc, size, totalDP: BAL.sizes[size],
    feats, doneFeats: 0, startedAt: Date.now(), bugs: 0, napsAtStart: S.totals.naps,
    ideaCost: IDEA_COST[size] || 0, planning: (IDEA_COST[size] || 0) > 0,
    icon: Math.floor(Math.random()*8), activeSec: 0
  };
}
function startProject(sizeOverride, genreId?){
  if(!genreId && S.nextRequestGenre){ genreId = S.nextRequestGenre; S.nextRequestGenre = null; }
  S.project = settleProject(genProject(sizeOverride, genreId));
  attachModules(S.project);   /* Wave H: L 作品にモジュール（第1ラインのみ） */
  S.projectDP = 0; S.commitMark = 0;
  addLog("新しいプロジェクト『"+S.project.name+"』を開始（"+S.project.size+" / "+S.project.totalDP+"DP）");
  say("新プロジェクト『"+S.project.name+"』、はじめるにゃ。");
}
