/* ---------- v2: スタッフ ----------
   雇用費: 同じ役職の人数 n に対して ceil(base × 1.35^n)
   育成費: ceil(base × 0.9 × 1.45^(lv-1))、効果は lv ごとに +25%（lv1 = 基本値） */
/* バッチ9 (sakuri 決定): 三毛スタッフ (mike2) は みゅけ と区別がつかないため
   実装しない — COATS から外し、旧セーブの該当個体は load() で決定的に
   着せ替える (recoatFor)。シャム (syamu) を新規追加 */
const COATS = ["kuro","chatora","sabatora","hachiware","shiro","syamu","hachiware_gray","chashiro"];
const COAT_NAMES = { kuro:"黒猫", chatora:"茶トラ", sabatora:"サバトラ", hachiware:"ハチワレ", shiro:"白猫", syamu:"シャム", hachiware_gray:"灰ハチワレ", chashiro:"茶白" };
const COAT_COLORS = {
  kuro:{ body:"#3a3230", sub:"#555049", face:"#3a3230" },
  chatora:{ body:"#f09a3e", sub:"#d97f26", face:"#f09a3e" },
  sabatora:{ body:"#9a8f85", sub:"#7d7268", face:"#9a8f85" },
  hachiware:{ body:"#3a3230", sub:"#2e2826", face:"#fff8ee" },
  shiro:{ body:"#fff8ee", sub:"#e8ded0", face:"#fff8ee" },
  syamu:{ body:"#dbd5c7", sub:"#432f23", face:"#dbd5c7" },
  hachiware_gray:{ body:"#5b5b5d", sub:"#282929", face:"#dbd5c7" },
  chashiro:{ body:"#d9b278", sub:"#604b40", face:"#fff0d0" }
};
/* COATS 外の毛柄 (旧 mike2 等) を、個体 id から決定的に有効な毛柄へ写す。
   同じセーブなら必ず同じ結果 (乱数・時刻に依存しない) */
function recoatFor(st){
  const s = String(st && st.id != null ? st.id : (st && st.name) || "");
  let h = 0;
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COATS[h % COATS.length];
}
const STAFF_ROLES = {
  prog:    { name:"プログラマ猫", stage:"実装",   base:210, out:6,    unit:"DP/分",   desc:"コード生産 +6 DP/分" },
  test:    { name:"テスター",     stage:"テスト", base:180, out:0.5,  unit:"バグ/分", desc:"QA +0.5 バグ/分・テスト速度 +8 DP/分" },
  carry:   { name:"運搬係",       stage:"出荷",   base:150, out:8,    unit:"DP/分",   desc:"出荷速度 +8 DP/分" },
  research:{ name:"研究員",       stage:"研究",   base:245, out:0.25, unit:"研究P/分", desc:"研究P +0.25/分（少しずつ）" },
  care:    { name:"お世話係",     stage:"お世話", base:170, out:1,    unit:"",        desc:"集中力の減り軽減＋たまに差し入れ＋おねだりに代わりに応える" },
  sales:   { name:"営業",         stage:"営業",   base:230, out:0,    unit:"",        desc:"依頼を自動で取ってくる（Lvが高いほど良い依頼）" },
  /* 再設計 段階2（sakuri 承認済み）: 中盤から応援の一部を任せられる。あなたの応援とは別枠で、必ず上乗せになる
     （応援係はコンボ・会心・応援の熱・応援P を持たない。それはみゅけと遊ぶあなたの腕前） */
  cheer:   { name:"応援係",       stage:"応援",   base:400, out:0.5,  unit:"回/秒",   desc:"みゅけの横で応援する（0.5回/秒）。あなたの応援は別枠で上乗せ" }
};
/* 社格ごとに開く新しい軸（再設計 段階3）。予告の枠と昇格のログに出す */
const RANK_UNLOCKS = { 2: "営業の雇用と依頼の自動受注", 3: "応援係", 4: "大型案件とチャレンジの目標", 5: "グループ子会社", 6: "持株化への道" };
const CHEER_STAFF_RANK = 3;   /* 応援係を雇える社格（中小）。序盤の応援はあなたの手で */
function roleLocked(role){ return role === "cheer" && (S.studioLv || 1) < CHEER_STAFF_RANK; }
const STAFF_CAPS = [3, 6, 10, 16, 24, 36];  // スタジオLv1..6 の雇用上限（レーンB Phase B・社格ラダー）
const STAFF_MAX_LV = 10;
/* 社格ラダー（Phase B）: スタジオLvをそのまま社格として扱う。新システムは増やさない。
   インディー/零細＝クリッカー期、中小/中堅＝自動化期、準大手/大企業＝経営期 */
const COMPANY_RANKS = ["インディー", "零細", "中小", "中堅", "準大手", "大企業"];
function rankName(lv){
  const i = Math.max(1, Math.min(STAFF_CAPS.length, lv || 1)) - 1;
  return i === COMPANY_RANKS.length - 1 ? spaceName("rank6", COMPANY_RANKS[i]) : COMPANY_RANKS[i];   /* v2.26.1: 宇宙編の呼び名 */
}
function companyRank(){ return rankName(S.studioLv); }
function staffCap(){
  if(challengeActive("minority")) return 6;   /* 第2ウェーブ K: 少数精鋭は社格・技術の上限を上書きする */
  return STAFF_CAPS[S.studioLv - 1] + (hasLegacyTech("cap1") ? 6 : 0) + (hasLegacyTech("cap2") ? 6 : 0);   /* 第2ウェーブ J: 上限拡張 I/II で 36→42→48 */
}
const STUDIO_COSTS = [0, 400, 1200, 3600, 7200, 18000];
function studioCost(lv){ return STUDIO_COSTS[lv]; }  // 段階3 からは使わない（社格は企業価値で自動昇格）。旧版の表示と sim の比較用に残す
/* レベルデザイン改修: 訓練は Lv10 の先も続けられる（実質無限）。出力は Lv11 以降
   +0.10/Lv に逓減し、コストは Lv11 以降さらに ×1.35^(Lv−10) が上乗せされる */
function staffMult(st){ return 1 + 0.25 * Math.min(st.lv - 1, 9) + 0.10 * Math.max(0, st.lv - 10); }
function hireCost(role){
  const n = S.staff.filter(s => s.role === role).length;
  return Math.ceil(STAFF_ROLES[role].base * Math.pow(1.35, n));
}
function trainCost(st){
  /* Sprint 4: 終盤の育成コストを緩和（1.45 → 1.35 乗）(C2-P1-4) */
  let c = STAFF_ROLES[st.role].base * 0.9 * Math.pow(1.35, st.lv - 1);
  if(st.lv > STAFF_MAX_LV) c *= Math.pow(1.35, st.lv - STAFF_MAX_LV);   /* レベルデザイン改修: Lv11 以降の追加曲線 */
  return Math.ceil(c);
}
/* Sprint 4: 熟練ボーナス（Lv5 で +15%、Lv10 で +30%）。育成の終着点を作る */
function staffOutMult(st){
  let m = staffMult(st) * (st.lv >= 10 ? 1.3 : st.lv >= 5 ? 1.15 : 1);
  if(challengeActive("minority")) m *= 1.25;   /* 第2ウェーブ K: 少人数の補正 */
  if(S.challengeRewards && S.challengeRewards.minority) m *= 1.1;   /* 第2ウェーブ K: 永続報酬 */
  /* 第2ウェーブ M: 役員のオーラ — 同じ役職の役員1匹につき +10%（加算で重なる） */
  if(S.executives && S.executives.length){
    const n = S.executives.filter(e => e.role === st.role).length;
    if(n) m *= 1 + 0.1 * n;
  }
  return m;
}
/* ---------- Phase C: 部署（既存ロールの束ね＋部署Lv） ----------
   部署は新しい人員システムではなく、ロールの読み替え＋部署Lv の倍率だけ。
   倍率は staffSums の集計にのみ掛かり、他の計算は従来どおり */
const DEPTS = {
  prog:    { name:"開発部", icon:"💻" },
  test:    { name:"テスト部", icon:"🧪" },
  carry:   { name:"運用部", icon:"📦" },
  research:{ name:"研究部", icon:"🔬" },
  care:    { name:"総務部", icon:"💛" },
  sales:   { name:"営業部", icon:"💼" },
  cheer:   { name:"応援団", icon:"📣" }
};
const DEPT_MAX_LV = 10;
function freshDepts(){ return { prog:1, test:1, carry:1, research:1, care:1, sales:1, cheer:1 }; }
function deptLv(role){ return (S.depts && S.depts[role]) || 1; }
/* レベルデザイン改修: 部署も Lv10 の先まで上げられる。倍率は Lv11 以降 +0.05/Lv に逓減
   （コスト式 ×2^Lv はそのまま延長するので、自然に壁になる） */
function deptMultForLv(lv){ return 1 + 0.15 * Math.min(lv - 1, 9) + 0.05 * Math.max(0, lv - 10); }
function deptMult(role){ return deptMultForLv(deptLv(role)); }
function deptCost(role){ return Math.ceil(300 * Math.pow(2, deptLv(role) - 1)); }
function deptChief(role){
  let best = null;
  for(const st of S.staff) if(st.role === role && (!best || st.lv > best.lv)) best = st;
  return best;
}
function buyDept(role){
  if(!S.depts) S.depts = freshDepts();
  const cost = deptCost(role);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost;
  S.depts[role] = deptLv(role) + 1;
  SoundKit.play("purchase");
  addLog(DEPTS[role].icon + " " + DEPTS[role].name + " が Lv" + S.depts[role] + " に（出力 ×" + fmtDec(deptMult(role), 2) + "）（-" + fmt(cost) + "🪙）");
  say(DEPTS[role].name + "を強化したにゃ！ みんなの出力が上がるよ");
  save(); renderPanel();
}
/* ---------- 再設計 段階5: 部署の節目で部長に任せる（Lv3・6・10）----------
   Lv3 は部署ごとの仕事、Lv6 は所属の猫の自動育成、Lv10 は空きがあれば同じ役職を自動で補充。
   任せるには部長（所属の猫が1匹以上）が要る。自動の買い物は「所持コインの半分で払える」ときだけ
   （あなたの買い物の分を残す）。第2ラインは廃止し、開発部 Lv3 の「並行開発」に置き換えた
   （作る手が増えるだけで、テスト以降の工程は本社と共有 — 詰まりの往復が生まれる） */
const DEPT_LV3 = {   /* 列には「（」の前だけが出るので、前半だけで効果がわかる書き方にする */
  prog:    "実装 +50%（並行開発: 開発部の実装が1.5倍）",
  test:    "在庫バグを自動でつぶす（テスター1匹につき毎分1匹）",
  carry:   "出荷力の半分をビルドにも（運用部がビルド工程も手伝う）",
  research:"研究を自動で進める（安い研究から順に選ぶ）",
  care:    "集中力が60%を下回らない（総務部の下支え）",
  sales:   "依頼の規模が下ぶれしない（クライアント規模の取りこぼしなし）",
  cheer:   "応援係の応援でも応援P（応援団の熱）"
};
function delegateList(role){ return [[3, DEPT_LV3[role]], [6, "自動育成（部長が所属の猫を育てる）"], [10, "自動補充（空きがあれば同じ役職を雇う）"]]; }
function delegated(role, lv){ return deptLv(role) >= lv && !!deptChief(role); }
function parallelDevMult(){ return delegated("prog", 3) ? 1.5 : 1; }
let delegateClock = 0;
/* 1秒ティックから（5秒に1回だけ動く） */
function deptDelegateTick(){
  if(++delegateClock % 5) return;
  if(delegated("research", 3) || exitMs("autoResearch")){   /* 段階6: EXIT 1回目の節目でも */
    const next = RESEARCH_DEFS.filter(r => !S.research[r.id] && (!r.requires || S.research[r.requires])).sort((a, b) => a.cost - b.cost)[0];
    if(next && S.rp >= next.cost){ S.rp -= next.cost; S.research[next.id] = true; addLog("🔬 研究部が『" + next.name + "』を進めた（-" + next.cost + "🔬）"); }
  }
  for(const role of Object.keys(DEPTS)){
    if(delegated(role, 6)){
      const cand = S.staff.filter(s => s.role === role).sort((a, b) => a.lv - b.lv)[0];   /* レベルデザイン改修: 訓練は無限になったので最も低い猫を育て続ける */
      if(cand){
        const c = trainCost(cand);
        if(c <= S.coins * 0.5){ S.coins -= c; cand.lv++; addLog("🎓 " + DEPTS[role].name + "の部長が " + cand.name + " を Lv" + cand.lv + " に育てた（-" + fmt(c) + "🪙）"); }
      }
    }
    if(delegated(role, 10) && !roleLocked(role) && S.staff.length < staffCap() && hireCost(role) <= S.coins * 0.5) hireStaff(role, true);
  }
  /* 段階6: EXIT の節目の自動購入（所持コインの半分で払える一番安いものを1つ。ログは出さない＝高頻度の買い物でログを埋めない） */
  if(exitMs("autoEquip")){
    let best = null, bc = Infinity;
    for(const d of UPGRADE_DEFS){ const lv = S.upgrades[d.id] || 0; if(lv < d.max){ const c = upgradeCost(d, lv); if(c < bc){ bc = c; best = d; } } }
    if(best && bc <= S.coins * 0.5){ S.coins -= bc; S.upgrades[best.id] = (S.upgrades[best.id] || 0) + 1; announceMilestone(best, S.upgrades[best.id]); }
  }
  if(exitMs("autoDept")){
    let best = null, bc = Infinity;
    for(const role of Object.keys(DEPTS)) if(deptLv(role) <= DEPT_MAX_LV && !roleLocked(role) && deptCost(role) < bc){ bc = deptCost(role); best = role; }   /* 自動 Lv.up は従来の上限（Lv10→11）まで。先は手動で */
    if(best && bc <= S.coins * 0.5){ if(!S.depts) S.depts = freshDepts(); S.coins -= bc; S.depts[best] = deptLv(best) + 1; }
  }
}
/* ---------- Sprint 4: ご褒美（終盤コインシンク） ----------
   価格 = base × (1 + 総収入/25000) × 1.5^(効果中に重ねている数)。
   稼ぐほど高くなるので、終盤でも「余り続ける」ことがない設計。
   v2.12.1: 「その日の購入回数（壁時計の日付で戻る）」をやめ、効果が残っている間の重ね買いだけ高くする */
const TREAT_BLOCK_MS = 30 * 60000;
function treatStack(def){
  const until = def.id === "treat_snack" ? (S.buffs && S.buffs.prodUntil) : (S.buffs && S.buffs.clickUntil);
  return Math.max(0, Math.ceil(((until || 0) - Date.now()) / TREAT_BLOCK_MS));
}
const TREAT_DEFS = [
  { id:"treat_snack", name:"🎁 高級おやつ",   base:150, desc:"集中力 +30、その後30分 生産 +15%" },
  { id:"treat_toy",   name:"🎁 高級おもちゃ", base:200, desc:"集中力 +10、その後30分 クリック効率 +10%" }
];
function treatCost(def){
  return Math.ceil(def.base * (1 + S.totals.coinsEarned / 25000) * Math.pow(1.5, treatStack(def)));
}
function buyTreat(id){
  const def = TREAT_DEFS.find(t => t.id === id);
  if(!def) return;
  const cost = treatCost(def);
  if(S.coins < cost){ say("コインが足りないにゃ"); return; }
  S.coins -= cost;
  S.today.treats = (S.today.treats || 0) + 1;
  if(!S.buffs || typeof S.buffs !== "object") S.buffs = {};
  const now = Date.now();
  if(id === "treat_snack"){
    addConc(30);
    S.buffs.prodUntil = Math.max(S.buffs.prodUntil || 0, now) + TREAT_BLOCK_MS;
    say("高級おやつ！ しあわせ〜（30分 生産+15%）");
  } else {
    addConc(10);
    S.buffs.clickUntil = Math.max(S.buffs.clickUntil || 0, now) + TREAT_BLOCK_MS;
    say("新しいおもちゃ！ わくわく（30分 クリック+10%）");
  }
  SoundKit.play("purchase");
  addLog("🎁 " + def.name.replace("🎁 ","") + "を買った（-" + fmt(cost) + "🪙）");
  save(); renderPanel();
}
/* Sprint 4: 全員まとめて +1Lv（全額払える時だけ・中途半端な適用はしない）。
   レベルデザイン改修: 訓練は無限になったので、全員が常に対象 */
function buyBulkTrain(){
  const targets = S.staff.slice();
  if(!targets.length){ say("まだスタッフがいないにゃ"); return; }
  const total = targets.reduce((a, s) => a + trainCost(s), 0);
  if(S.coins < total){ say("全員分にはコインが足りないにゃ（あと " + fmt(total - S.coins) + "🪙）"); return; }
  S.coins -= total;
  for(const st of targets) st.lv = (st.lv || 1) + 1;
  SoundKit.play("purchase");
  addLog("🎓 全員+1Lv育成（-" + fmt(total) + "🪙）");
  say("みんな1レベル上がったにゃ！");
  save(); renderPanel();
}
/* スタッフ合計は1フレームの描画中に30回ほど呼ばれる (工程レート・山・ボトルネック判定…)。
   描画中は S が変わらないので、render() の間だけ1回の計算結果を使い回す
   (48匹＋役員の終盤で描画の JS 時間が約6割減る。値は同一) */
let staffSumsCacheActive = false, staffSumsFrameCache = null;
function staffSums(){
  if(!staffSumsCacheActive) return computeStaffSums();
  return staffSumsFrameCache || (staffSumsFrameCache = computeStaffSums());
}
function computeStaffSums(){
  const s = { prog:0, progW:0, qa:0, testDP:0, ship:0, rp:0, careW:0, cheer:0, count:0, byRole:{} };
  for(const st of S.staff){
    const m = staffOutMult(st) * deptMult(st.role), def = STAFF_ROLES[st.role];   /* Sprint 4: 熟練ボーナス込み / Phase C: 部署Lv 倍率 */
    s.byRole[st.role] = (s.byRole[st.role]||0) + 1;
    if(st.role === "prog"){ s.prog += def.out * m * parallelDevMult(); s.progW += m; }   /* 段階5: 開発部 Lv3 の並行開発 */
    if(st.role === "test"){ s.qa += def.out * m; s.testDP += BAL.testStaffDP * m; }
    if(st.role === "carry"){ s.ship += def.out * m; }
    if(st.role === "research"){ s.rp += def.out * m; }
    if(st.role === "care"){ s.careW += m; }
    if(st.role === "cheer"){ s.cheer += def.out * m; }
    s.count++;
  }
  return s;
}
const CAT_NAME_A = ["むぎ","そら","はな","こた","ぽん","まる","ちび","ゆき","あずき","もも","りん","すず","とら","みそ","わた","きな","ごま","うに","たら","ぷりん","ちゃい","ほし","つき","かぜ"];
const CAT_NAME_B = ["たろう","こ","まる","すけ","のすけ","み","ぽん","吉","衛門","太","子","ら","蔵","介","乃","々"];
function genCatName(){
  for(let i = 0; i < 30; i++){
    const n = CAT_NAME_A[Math.floor(Math.random()*CAT_NAME_A.length)] +
              CAT_NAME_B[Math.floor(Math.random()*CAT_NAME_B.length)];
    if(!S.staff.some(s => s.name === n)) return n;
  }
  return "ねこ" + (S.staffSeq + 1) + "号";
}

/* ---------- v2: 応援クリック ----------
   基本威力 0.15DP（セッション中の生産が放置の約2〜3倍になるよう sim で調整。
   v2.1 再調整: 威力の伸びとコンボ上限を抑え、強化後も倍率が暴れないようにした）。
   コンボ: 連続クリックで倍率 +0.10/回（上限は基本 +1.75倍、うちわで伸びる）。
   クリティカル: 基本5%（旗で +1%/Lv）で ×10。 */
/* 応援強化は応援P（クリックで貯まる、みゅけ自身の腕前）で買う。コインの使い道（設備）と
   取り合わないので「労働を主役にするほど伸びる」別の成長曲線になる。肉球とグローブは
   上限100・節目（設備と同じ MILESTONE_LVS）つきで、売却しても腕前として残る（持株化で畳む）。
   肉球 = 自動生産との連動率（会社の桁に追従する終盤の伸び）、グローブ = 素の威力（序盤の伸び） */
const CLICK_DEFS = [
  { id:"paw",    name:"肉球トレーニング", base:40,  max:100, grow:1.12, ms:true, desc:"自動生産との連動 +25%/Lv" },
  { id:"glove",  name:"高級グローブ",     base:60,  max:100, grow:1.12, ms:true, desc:"クリック威力 +0.18/Lv" },
  /* 段階5: うちわ＋旗 → 応援の質。ひらめき連動はオーバークロックのゲージの溜まりへ。研究メモ連動は廃止 */
  { id:"quality",name:"応援の質",         base:250, max:12, desc:"コンボ上限 +0.25倍/Lv・会心率 +1%/Lv" },
  { id:"synidea",name:"ひらめき連動",     base:350, max:5,  desc:"応援でたまるオーバークロックのゲージ +20%/Lv" }
];
function clickCost(def, lv){ return Math.ceil(def.base * Math.pow(def.grow || 1.30, lv)); }   // Sprint 1: 価格成長 1.55→1.30（アクティブが放置に負けない経済へ）／ 応援P 払い・上限100の2種は 1.12
function clickLinkMult(){ return (1 + 0.25 * upEff(S.clickUp, "paw")); }
const CLICK_POWER_BASE = 0.25;   /* てぶくろ Lv0 の威力（持ち場の手助けで「威力の倍率」を測る基準） */
/* レベルデザイン改修: 経営方針のクリック側の倍率（労働特化 ×2／自動化特化 ×0.7） */
function runPolicyClickMult(){ return S.runPolicy === "labor" ? 2 : S.runPolicy === "auto" ? 0.7 : 1; }
function clickPower(){
  const base = CLICK_POWER_BASE + 0.18*upEff(S.clickUp, "glove");
  return base * (hasPerk("focus") ? 1.1 : 1) * buffClickMult() * branchMult("b_labor") * runPolicyClickMult();   /* 星屑特典「集中ブースト」＋ご褒美バフ＋段階6の枝「星の肉球」＋経営方針 */
}
function comboCapBonus(){ return 2.0 + 0.25*(S.clickUp.quality||0); }   // 倍率 = 1 + min(これ, 連続×0.10) → 基本最大 ×3.0
function critRate(){ return 0.08 + 0.01*(S.clickUp.quality||0); }

/* ---------- プロジェクト生成 ---------- */
const GENRES = [
  { id:"app",    name:"アプリ",   lockedBy:null,        feats:["ログイン画面","データ保存","通知機能","ダークモード","ウィジェット"] },
  { id:"tool",   name:"ツール",   lockedBy:null,        feats:["一括変換","履歴機能","ショートカット対応","プレビュー","自動バックアップ"] },
  { id:"sns",    name:"SNS",      lockedBy:null,        feats:["プロフィール","タイムライン","いいね機能","画像投稿","フォロー整理"] },
  { id:"site",   name:"サイト",   lockedBy:null,        feats:["トップページ","検索機能","お問い合わせ","アクセシビリティ","高速化"] },
  { id:"widget", name:"ウィジェット", lockedBy:null,    feats:["時計表示","天気表示","メモ欄","色テーマ","サイズ変更"] },
  { id:"game",   name:"ゲーム",   lockedBy:"res_game",  feats:["タイトル画面","スコア機能","レベル生成","セーブ機能","ランキング"] },
  { id:"ai",     name:"AIツール", lockedBy:"res_ai",    feats:["要約機能","分類機能","添削機能","履歴検索","辞書登録"] },
  { id:"robot",  name:"ロボット", lockedBy:"res_robot", feats:["センサー連携","巡回モード","充電管理","音声コマンド","安全停止"] }
];
const SUBJECTS = [
  { name:"猫用天気予報",     desc:"今日は毛が逆立つかどうかを教えてくれる" },
  { name:"毛糸在庫管理",     desc:"転がした毛糸玉の数を数える" },
  { name:"段ボール評価『箱ログ』", desc:"座り心地を星5つでレビュー" },
  { name:"お昼寝最適化",     desc:"日向の移動に合わせて寝床を提案" },
  { name:"お魚クーポン管理", desc:"期限切れ前にそっと知らせる" },
  { name:"カーソル追いかけ練習", desc:"狩りの反射神経トレーニング" },
  { name:"ゴロゴロ記録",     desc:"ご機嫌な瞬間をログに残す" },
  { name:"窓際レポート",     desc:"外の鳥と通行人を観察日誌に" },
  { name:"にくきゅうスタンプ帳", desc:"歩いた場所に肉球マーク" },
  { name:"夜鳴き翻訳",       desc:"深夜の「にゃー」を文章化する" },
  { name:"ひなたマップ",     desc:"家の中の日向スポットを可視化" },
  { name:"カリカリ在庫予報", desc:"ごはんの減り具合から買い時を予測" }
];
const COMMIT_MSGS = [
  "feat: {feat} を実装したにゃ", "fix: バグを{n}匹たたいた", "refactor: 毛並みのように整えた",
  "docs: 肉球でコメントを書いた", "test: アヒル検査員が承認したにゃ", "chore: 毛糸のほつれを直した",
  "feat: {feat} の土台ができた", "perf: お昼寝の合間に高速化した"
];
const REQUEST_CLIENTS = ["隣の黒猫","商店街の看板猫","駅前のたま先輩","図書館の三毛猫","パン屋の茶トラ","漁港のボス猫"];
/* C2-P1-5: 依頼文はクライアント別の口調でバリエーションを持たせる（文面のみ。
   報酬・抽選・クライアント数は不変）。{g} にジャンル名が入る。未知のクライアントは旧テンプレにフォールバックし、既存セーブの保存済み文面は書き換えない */
const REQUEST_TONES = {
  "隣の黒猫": ["{g}のやつ、作れるかにゃ", "{g}、ひとつ頼めるかにゃ"],
  "商店街の看板猫": ["{g}の注文をお願いできるかにゃ。うちの目玉にしたいんだ", "{g}を作ってほしいにゃ。売れ筋になりそうでね"],
  "駅前のたま先輩": ["{g}を作ってくれないかね。わしのお墨付きだよ", "{g}のひとつ、頼めるかねぇ"],
  "図書館の三毛猫": ["{g}の作品を、ひとつ作ってほしいの。静かなのがいいな", "{g}について、ひとつお願いできるかしら"],
  "パン屋の茶トラ": ["{g}、焼きたてみたいなのを作ってほしいにゃ！", "{g}をひとつお願いにゃ。ほかほかのがいいな"],
  "漁港のボス猫": ["{g}を作れ。出来がよけりゃ魚を分けてやる", "{g}、ひとつ頼むぜ。腕を見せてみな"]
};
function requestText(client, genreName){
  for(const pl of SPACE_CLIENT_PLACES) if(client.startsWith(pl)) client = client.slice(pl.length);   /* v2.26.1: 「月の」などを外して口調を引く */
  const tones = REQUEST_TONES[client];
  if(!tones) return genreName+"の注文を作ってほしいにゃ";
  return tones[Math.floor(Math.random()*tones.length)].split("{g}").join(genreName);
}
const CHEER_LINES = ["にゃっ！", "その調子にゃ！", "カタカタ…カタカタ…", "応援、届いてるにゃ", "よーし、やる気にゃ", "指、疲れてないかにゃ？"];

/* ---------- 研究 ---------- */
const RESEARCH_DEFS: ResearchDef[] = [
  { id:"res_game",    name:"新ジャンル：ゲーム",   cost:2, desc:"プロジェクトに「ゲーム」が混ざるようになる" },
  { id:"res_ai",      name:"新ジャンル：AIツール", cost:4, desc:"プロジェクトに「AIツール」が混ざるようになる" },
  { id:"res_robot",   name:"新ジャンル：ロボット", cost:6, desc:"プロジェクトに「ロボット」が混ざるようになる" },
  { id:"res_bottrain",name:"ヘルパー研修",         cost:5, desc:"子ねこボットの効率 +50%" },
  /* Sprint 4: ティア2（前提つき）。序盤で研究が「卒業」して RP が死に資源に
     なる問題 (C2-P1-1) への対策。効果は全て実データに効くものだけを置く */
  { id:"res_game2",   name:"ゲーム・デラックス",   cost:8, tier:2, requires:"res_game",    desc:"ゲーム作品の報酬コイン +30%" },
  { id:"res_ai2",     name:"推論チューニング",     cost:8, tier:2, requires:"res_ai",      desc:"AIツール作品の研究P +1" },
  { id:"res_robot2",  name:"ロボット量産ライン",  cost:8, tier:2, requires:"res_robot",   desc:"ロボット作品のバグ混入が半分になる" },
  { id:"res_play2",   name:"一人遊び：宝探し",     cost:6, tier:2, desc:"一人遊びに「宝探し」が増える（アイデア多め、たまにコイン）" },
  { id:"res_bot2",    name:"ボットAI学習",         cost:8, tier:2, requires:"res_bottrain", desc:"子ねこボットの効率がさらに +50%" }
];
/* 再設計 段階5: 反復研究・アヒル会議・観葉植物・集中の極意・第2ラインの研究は廃止。研究の木は1社の中で
   数分ごとに開いていく大きさに絞り、余った研究P は売却のときにジャンル知見になって残る（理念書7「残るもの」） */
function tier1Done(){ return RESEARCH_DEFS.filter(r => !r.tier).every(r => S.research[r.id]); }
/* ---------- 再設計 段階5: ジャンル知見（会社を売っても残る）----------
   売却の瞬間に残っていた研究P を、その会社で出した作品のジャンルへ本数の割合で配る。
   知見 Lv = √(ポイント) の整数部、そのジャンルの作品の値段 +10%/Lv。持株化でも消えない */
function knowLvFor(pts){ return Math.floor(Math.sqrt(Math.max(0, pts || 0))); }
function knowLv(g){ return knowLvFor(S.genreKnow && S.genreKnow[g]); }
function knowMult(g){ return 1 + 0.1 * knowLv(g); }
function knowPreview(){
  const rp = Math.floor(S.rp || 0), by = S.runGenre || {};
  let tot = 0;
  for(const g in by) tot += by[g] || 0;
  if(!(rp > 0) || !(tot > 0)) return [];
  return Object.keys(by).filter(g => by[g] > 0).map(g => ({ g, add: rp * by[g] / tot }));
}
function convertKnow(){
  const pv = knowPreview();
  if(!pv.length) return;
  if(!S.genreKnow || typeof S.genreKnow !== "object") S.genreKnow = {};
  const parts = [];
  for(const x of pv){
    const before = knowLv(x.g);
    S.genreKnow[x.g] = (S.genreKnow[x.g] || 0) + x.add;
    const gd = GENRES.find(g => g.id === x.g);
    parts.push((gd ? gd.name : x.g) + " +" + fmtDec(x.add, 1) + (knowLv(x.g) > before ? "（Lv" + knowLv(x.g) + "）" : ""));
  }
  addLog("📚 余った研究P がジャンル知見になった: " + parts.join("・"));
}

/* ---------- 実績 ---------- */
const STAMP_DEFS = [
  { id:"first_bug",    name:"初バグ",           test:s=>s.totals.bugsSquashed>=1 },
  { id:"first_release",name:"初リリース",       test:s=>s.totals.releases>=1 },
  { id:"commits100",   name:"100コミット",      test:s=>s.totals.commits>=100, prog:s=>[s.totals.commits,100] },
  { id:"cursor10km",   name:"カーソル10km",     test:s=>s.totals.cursorPx>=100*1000*37.79, prog:s=>[Math.floor(s.totals.cursorPx/37.79),100000] },
  { id:"releases10",   name:"10作品リリース",   test:s=>s.totals.releases>=10, prog:s=>[s.totals.releases,10] },
  { id:"coins5000",    name:"通算5000コイン",   test:s=>s.totals.coinsEarned>=5000, prog:s=>[Math.floor(s.totals.coinsEarned),5000] },
  { id:"nightowl",     name:"夜ふかし開発",     test:s=>s.flags.nightCommit===true },
  { id:"bot_buy",      name:"初めての同僚",     test:s=>(s.upgrades.bot||0)>=1 },
  { id:"prestige1",    name:"EXIT経験者",   test:s=>s.prestiges>=1 },
  { id:"play_all",     name:"一人遊びマスター", test:s=>["yarn","groom","watch","chase","zoomies"].every(p=>s.flags["play_"+p]) },
  { id:"first_hire",   name:"初めての雇用",     test:s=>s.totals.hired>=1 },
  { id:"staff5",       name:"チーム5人",        test:s=>s.staff.length>=5, prog:s=>[s.staff.length,5] },
  { id:"parallel_dev", name:"並行開発",         test:s=>!!(s.depts && s.depts.prog >= 3) },
  { id:"goldfish",     name:"金のフィッシュ",  test:s=>s.totals.goldFish>=1 },
  { id:"click1000",    name:"応援1000回",       test:s=>s.totals.clicks>=1000, prog:s=>[s.totals.clicks,1000] },
  /* 工程・設備の実績（詰まり解消／全工程グリーンは trackLineStamps が1秒ティックでフラグを立てる） */
  { id:"bn_cleared",   name:"詰まり解消",       test:s=>s.flags.bnCleared===true },
  { id:"all_green",    name:"全工程グリーン",   test:s=>s.flags.allGreen===true },
  { id:"equip_all",    name:"設備ひと通り",     test:s=>UPGRADE_DEFS.every(u=>(s.upgrades[u.id]||0)>=1), prog:s=>[UPGRADE_DEFS.filter(u=>(s.upgrades[u.id]||0)>=1).length,UPGRADE_DEFS.length] },
  { id:"equip_max",    name:"設備を極めた",     test:s=>UPGRADE_DEFS.some(u=>(s.upgrades[u.id]||0)>=u.max) },
  { id:"know_lv3",     name:"得意ジャンル",     test:s=>Object.keys(s.genreKnow||{}).some(g=>knowLvFor(s.genreKnow[g])>=3), prog:s=>[Math.max(0,...Object.keys(s.genreKnow||{}).map(g=>knowLvFor(s.genreKnow[g]))),3] },
  { id:"dept5",        name:"部署 Lv5",         test:s=>Object.values(s.depts||{}).some(v=>Number(v)>=5), prog:s=>[Math.max(1,...Object.values(s.depts||{}).map(Number)),5] },
  /* v2.25.0: 再設計で増えた遊び（社格・5つの収入源・星屑・子会社・チャレンジ・おねだり…）にも目標を。
     報酬は付けない（数値は動かさない）。hint は未取得のときに出す「何をすればいいか」。
     回数系は totals の加算カウンタ（旧セーブは 0 から）、それ以外はいまの状態を見る（取れたスタンプは残る） */
  { id:"click10000",   name:"応援1万回",        test:s=>s.totals.clicks>=10000, prog:s=>[s.totals.clicks,10000] },
  { id:"crit100",      name:"会心100回",        test:s=>s.totals.crits>=100, prog:s=>[s.totals.crits,100] },
  { id:"want10",       name:"おねだり名人",     hint:"みゅけのおねだりに10回応える", test:s=>(s.totals.wantsDone||0)>=10, prog:s=>[s.totals.wantsDone||0,10] },
  { id:"norinori",     name:"ノリノリ",         hint:"集中力を100%より上に", test:s=>s.concentration>100 },
  { id:"fever1",       name:"オーバークロック", hint:"机脇のゲージを満タンにして発動", test:s=>(s.totals.fevers||0)>=1 },
  { id:"swarm1",       name:"バグ全滅",         hint:"バグ大量発生を全部叩く", test:s=>(s.totals.swarms||0)>=1 },
  { id:"releases100",  name:"100作品リリース",  test:s=>s.totals.releases>=100, prog:s=>[s.totals.releases,100] },
  { id:"deathmarch",   name:"デスマーチ",       hint:"未完のまま出荷する（負債で払う）", test:s=>(s.totals.deathMarches||0)>=1 },
  { id:"brand100",     name:"評判の会社",       hint:"品質の良い作品を出し続ける", test:s=>(s.brand||0)>=100, prog:s=>[Math.floor(s.brand||0),100] },
  { id:"layout",       name:"模様替え",         hint:"帯の ✥ 並べ替えで家具を動かす", test:s=>Object.keys(s.layout||{}).length+Object.keys(s.layoutProps||{}).length>=1 },
  { id:"bulk10",       name:"まとめ買い",       hint:"「最大」や長押しで10個以上まとめて買う", test:s=>s.flags.bulkBuy===true },
  { id:"rank3",        name:"中小企業",         test:s=>(s.maxStudioLv||1)>=3, prog:s=>[s.maxStudioLv||1,3] },
  { id:"rank6",        name:"大企業",           test:s=>(s.maxStudioLv||1)>=6, prog:s=>[s.maxStudioLv||1,6] },
  { id:"cheer_hire",   name:"応援係の着任",     hint:"中小企業で応援係を雇う", test:s=>s.staff.some(st=>st.role==="cheer") },
  { id:"staff_lv10",   name:"育成を極めた",     test:s=>s.staff.some(st=>(st.lv||1)>=STAFF_MAX_LV), prog:s=>[Math.max(1,...s.staff.map(st=>st.lv||1)),STAFF_MAX_LV] },
  { id:"dept_all5",    name:"全部署 Lv5",       test:s=>Object.keys(DEPTS).every(r=>Number((s.depts||{})[r]||1)>=5), prog:s=>[Object.keys(DEPTS).filter(r=>Number((s.depts||{})[r]||1)>=5).length,Object.keys(DEPTS).length] },
  { id:"req10",        name:"依頼10件達成",     test:s=>(s.totals.requestsDone||0)>=10, prog:s=>[s.totals.requestsDone||0,10] },
  { id:"bigdeal",      name:"大型案件達成",     hint:"大型案件を納期内に出荷する", test:s=>(s.totals.bigDealsDone||0)>=1 },
  { id:"ip1",          name:"自社IP",           hint:"バグ0で IP 指定の作品を出荷する", test:s=>(s.ips||[]).length>=1 },
  { id:"ip3",          name:"シリーズ3本",      test:s=>(s.ips||[]).length>=3, prog:s=>[(s.ips||[]).length,3] },
  { id:"people50",     name:"総勢50人",         test:()=>totalPeople()>=50, prog:()=>[totalPeople(),50] },
  { id:"sub1",         name:"グループ子会社",   hint:"準大手で子会社を設立する", test:s=>(s.subs||[]).length>=1 },
  { id:"subs3",        name:"グループ3社",      test:s=>(s.subs||[]).length>=3, prog:s=>[(s.subs||[]).length,3] },
  { id:"sub_sold",     name:"部分EXIT",         hint:"子会社を1社売却する", test:s=>(s.totals.subsSold||0)>=1 },
  /* G5: 5つの収入源のどれも主役になれる。社格 準大手 以上で、この会社の収入の内訳の1位になったらかつ売れる規模（星屑3個）に育っていたら（序盤や売却直後は、寄せなくても労働や作品棚が1位になるので） */
  ...Object.keys(INCOME_SRCS).map(src => ({ id:"main_"+src, name:"主役: "+INCOME_SRCS[src].replace(/（.*）/, ""),
    hint:"準大手・星屑3個の規模で、"+INCOME_SRCS[src].replace(/（.*）/, "")+"を収入1位に",
    test:s=>(s.studioLv||1)>=5 && (s.runPeakValue||0)>=3*dustValueUnit() && mainIncomeSrc()===src })),
  { id:"main_all",     name:"5つの稼ぎ方",      test:s=>Object.keys(INCOME_SRCS).every(k=>s.stamps["main_"+k]), prog:s=>[Object.keys(INCOME_SRCS).filter(k=>s.stamps["main_"+k]).length,Object.keys(INCOME_SRCS).length] },
  { id:"exec1",        name:"役員猫",           hint:"EXIT のとき猫を役員に残す", test:s=>(s.executives||[]).length>=1 },
  { id:"dust20",       name:"星屑20個",         test:s=>(s.dustTotal||0)>=20 || (s.holdings||0)>=1, prog:s=>[Math.floor(s.dustTotal||0),20] },
  { id:"dust_shop",    name:"星屑の買い物",     hint:"星屑ショップで特典を買う", test:s=>Object.keys(s.dustPerks||{}).some(k=>s.dustPerks[k]) },
  { id:"branch10",     name:"星の枝 Lv10",      test:s=>DUST_PERKS.some(p=>p.branch && Number((s.dustPerks||{})[p.id]||0)>=10), prog:s=>[Math.max(0,...DUST_PERKS.filter(p=>p.branch).map(p=>Number((s.dustPerks||{})[p.id]||0))),10] },
  { id:"exits5",       name:"連続起業家",       test:s=>s.prestiges>=5, prog:s=>[s.prestiges,5] },
  { id:"challenge1",   name:"縛りプレイ",       hint:"チャレンジを1つ達成する", test:s=>Object.keys(s.challengeRewards||{}).length>=1 },
  { id:"challenge_all",name:"全チャレンジ制覇", test:s=>CHALLENGE_DEFS.every(c=>(s.challengeRewards||{})[c.id]), prog:s=>[CHALLENGE_DEFS.filter(c=>(s.challengeRewards||{})[c.id]).length,CHALLENGE_DEFS.length] },
  { id:"exits12",      name:"売却の達人",       test:s=>s.prestiges>=HOLD_EXITS, prog:s=>[s.prestiges,HOLD_EXITS] },
  { id:"holdings1",    name:"ホールディングス", hint:"持株化の条件をそろえる", test:s=>(s.holdings||0)>=1 },
  { id:"legacy_all",   name:"レガシー総取り",   test:s=>LEGACY_TECHS.every(t=>(s.legacyTech||{})[t.id]), prog:s=>[LEGACY_TECHS.filter(t=>(s.legacyTech||{})[t.id]).length,LEGACY_TECHS.length] },
  /* v2.26.1 宇宙編（フレーバー）: 持株化の回数で章が進む。数値は動かさない（sim 実測: 放置で約3〜4時間に1回） */
  { id:"holdings2",    name:"空のむこう",       test:s=>(s.holdings||0)>=2,  prog:s=>[s.holdings||0,2] },
  { id:"holdings3",    name:"人工衛星",         test:s=>(s.holdings||0)>=3,  prog:s=>[s.holdings||0,3] },
  { id:"holdings4",    name:"月面支社",         test:s=>(s.holdings||0)>=4,  prog:s=>[s.holdings||0,4] },
  { id:"holdings5",    name:"火星スタジオ",     test:s=>(s.holdings||0)>=5,  prog:s=>[s.holdings||0,5] },
  { id:"holdings7",    name:"軌道エレベーター", test:s=>(s.holdings||0)>=7,  prog:s=>[s.holdings||0,7] },
  { id:"holdings9",    name:"銀河いちばん",     test:s=>(s.holdings||0)>=9,  prog:s=>[s.holdings||0,9] },
  { id:"holdings10",   name:"星屑のゆくえ",     test:s=>(s.holdings||0)>=10, prog:s=>[s.holdings||0,10] }
];

/* ---------- 実績フレーバーシナリオ（v2.26.1） ----------
   文案の正本は sakuri（叩き台は https://claude.ai/artifact/R3pc6Eogiaky6YEHNPtj22 ）。
   ここを書き換えるだけで台詞が変わる。数値・報酬には一切かかわらない。
   - SKITS: スタンプを取ったときに小芝居ウィンドウで演じる場面。並び = 物語の順。
     先の場面をもう見ていたら、後から取れた前の場面は流さず統計タブの ▶ にだけ残す。
     panels は [ポーズ, セリフ, 演出?]。ポーズは miyuke_<ポーズ> のアニメ（code_a/debug/happy/
     idle/sleep/snack/think/walk/yarn）。演出 "walkin" = モブの猫が右から歩いてくる、
     "crowd" = モブの猫たちが行き来する。セリフが空のコマは演出だけを見せる */
const SKITS: SkitDef[] = [
  { id:"first_release", chapter:"序章", title:"ひとりの机", panels:[
    ["think", "誰かの役に立てばいいにゃー"], ["happy", "感想うれしいにゃー！"], ["idle", "ゆっくりでいいにゃー"] ] },
  { id:"play_all", chapter:"序章", title:"ぜんぶひとり", panels:[
    ["yarn", "企画も実装もテストも、ぜんぶひとりにゃ"], ["idle", "……そろそろ、だれかに手伝ってほしいにゃ"] ] },
  { id:"first_hire", chapter:"1章", title:"はじめての同僚", panels:[
    ["walk", "", "walkin"], ["think", "よろしくなのにゃー！", "walkin"], ["happy", "机、もうひとついるね", "walkin"] ] },
  { id:"releases10", chapter:"1章", title:"しるしだらけ", panels:[
    ["idle", "カレンダー、印だらけだにゃ"], ["happy", "ひとりだったころが懐かしいにゃ"] ] },
  { id:"rank3", chapter:"2章", title:"会社っぽくなってきた", panels:[
    ["think", "ついにみゅけが社長にゃー"], ["code_a", "でも、キーボードを叩くのはかわらにゃいにゃー"] ] },
  { id:"ip1", chapter:"2章", title:"うちの子", panels:[
    ["happy", "IPとしてリーリースできたにゃー！うれしいにゃー！"], ["think", "ところで、IPってなんだにゃ？"] ] },
  { id:"rank6", chapter:"3章", title:"大きな家", panels:[
    ["idle", "", "crowd"], ["think", "そろそろ全員の名前を覚えられなくなってきちゃったにゃ", "crowd"], ["snack", "でも、おやつの時間はみんな一緒だにゃ！", "crowd"] ] },
  { id:"prestige1", chapter:"4章", title:"売る日", panels:[
    ["idle", "みゅけには、あの会社は少し大きすぎたのにゃ"], ["sleep", "これくらいがちょうどいいにゃ"], ["code_a", "...でも、またみんなのために働きたいにゃー"] ] },
  { id:"exits5", chapter:"5章", title:"何度でも", panels:[
    ["walk", "何を目指してるのかわからなくなってきちゃったにゃ"], ["happy", "でも、たのしいからいいにゃー"] ] },
  { id:"holdings1", chapter:"終章", title:"また、ひとりの机で", panels:[
    ["think", "ほーるでぃんぐす化に成功したにゃー！"], ["idle", "長い道のりだったにゃ"], ["code_a", "...ところで、ほーるでぃんぐすってなんだにゃ？"] ] },
  { id:"holdings2", chapter:"6章", title:"空のむこう", panels:[
    ["think", "星屑って、ほんとにお星さまから来てるのかにゃ？"], ["idle", "見に行ってみたいにゃー"] ] },
  { id:"holdings3", chapter:"7章", title:"人工衛星", panels:[
    ["code_a", "衛星から配信すれば、どこでも遊べるにゃ"], ["happy", "宇宙で遊んでるねこも、いるかもしれないにゃ！"] ] },
  { id:"holdings4", chapter:"8章", title:"月面支社", panels:[
    ["walk", "ふわふわするにゃー"], ["snack", "おやつが浮いて、たべにくいにゃ…"] ] },
  { id:"holdings5", chapter:"9章", title:"火星スタジオ", panels:[
    ["think", "火星には、ねこがいないにゃ"], ["code_a", "じゃあ、来たくなるゲームを作るにゃ！"] ] },
  { id:"holdings7", chapter:"10章", title:"軌道エレベーター", panels:[
    ["idle", "宇宙から、最初の机まで一本だにゃ"], ["sleep", "……たまには帰って、あの椅子で寝るにゃ"] ] },
  { id:"holdings9", chapter:"11章", title:"銀河いちばん", panels:[
    ["happy", "銀河でいちばんの会社になったにゃー！"], ["think", "……ところで、銀河ってなんだにゃ？"] ] },
  { id:"holdings10", chapter:"大終章", title:"星屑のゆくえ", panels:[
    ["idle", "星屑は、みんなが遊んだあとのきらきらだったのにゃ"], ["happy", "だからいっぱい集まってたのにゃー"],
    ["code_a", "みんながもっときらきらするために、みゅけ、きょうも開発中にゃ！"] ] }
];
/* A: スタンプを持っているときだけ、モブのスタッフの雑談に混ざる一言 */
const STAMP_CHAT_LINES: [string, string][] = [
  ["first_hire", "社長、最初は１ひきだったってほんと？"],
  ["deathmarch", "もう椅子で寝るのは嫌だにゃー"],
  ["ip1", "ファンレターが来てたにゃ！"],
  ["rank6", "おっきい建物で、走り放題にゃ！"],
  ["prestige1", "前の会社の話、社長はあんまりしないにゃ"],
  ["exec1", "役員さん、むかしからいるらしいにゃ"],
  ["exits5", "みゅけ社長は敏腕とウワサだにゃー"],
  ["holdings2", "社長、また宇宙の話してるにゃ"],
  ["holdings4", "月支社のおやつ、宅配で届くにゃ"]
];
/* 2周目以降（EXIT 経験あり）に社格が上がったとき、みゅけが帯の上で言う一言 */
const RANKUP_AGAIN_LINES: Record<number, string> = {
  2: "この机の並び、前にも見た気がするにゃ",
  3: "また社長になっちゃったにゃー。今度は照れないにゃ",
  6: "ずいぶん早くここまで来たように感じるにゃ"
};
/* C: 思い出の家具をクリックしたときの一言 */
const FURNITURE_LINES: Record<string, string> = {
  easel: "いちばん最初の絵。まだ下手っぴ",
  calendar: "しるしがびっしりだにゃー",
  trophy: "どれもこれも、思い出の品だにゃー"
};
/* 宇宙編の呼び名: そのスタンプを取ったら表示名だけが変わる（内部キー・数値・セーブは同じ）。
   後ろの段ほど優先 */
const SPACE_NAMES: Record<string, [string, string][]> = {
  rank6:   [["holdings2", "宇宙企業"], ["holdings9", "銀河企業"]],
  line:    [["holdings3", "衛星配信ライン"]],
  subs:    [["holdings4", "月面支社"]],
  courier: [["holdings4", "🚀 宇宙便が納品"]],
  catalog: [["holdings7", "星間ストア"]],
  sales:   [["holdings7", "星間営業"]],
  legacy:  [["holdings4", "星間技術"]]
};
/* 月面支社のあと、新しく作る子会社の土地（9章からは順に回す） */
const SPACE_SUB_PLACES = ["月面支社", "火星スタジオ", "小惑星ラボ"];
/* 星間営業のころ、依頼主の前に付く土地 */
const SPACE_CLIENT_PLACES = ["月の", "火星の"];

