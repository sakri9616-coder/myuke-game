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
  prog:    { name:"プログラマ猫", stage:"実装",   base:210, out:2.2,  unit:"DP/分",   desc:"コード生産 +2.2 DP/分" },
  test:    { name:"テスター",     stage:"テスト", base:180, out:0.5,  unit:"バグ/分", desc:"QA +0.5 バグ/分・テスト速度 +4 DP/分" },
  carry:   { name:"運搬係",       stage:"出荷",   base:150, out:5,    unit:"DP/分",   desc:"出荷速度 +5 DP/分" },
  research:{ name:"研究員",       stage:"研究",   base:245, out:0.25, unit:"研究P/分", desc:"研究P +0.25/分（少しずつ）" },
  care:    { name:"お世話係",     stage:"お世話", base:170, out:1,    unit:"",        desc:"集中力の減り軽減＋たまに差し入れ" },
  sales:   { name:"営業",         stage:"営業",   base:230, out:0,    unit:"",        desc:"依頼を自動で取ってくる（Lvが高いほど良い依頼）" }
};
const STAFF_CAPS = [3, 6, 10, 16, 24, 36];  // スタジオLv1..6 の雇用上限（レーンB Phase B・社格ラダー）
const STAFF_MAX_LV = 10;
/* 社格ラダー（Phase B）: スタジオLvをそのまま社格として扱う。新システムは増やさない。
   インディー/零細＝クリッカー期、中小/中堅＝自動化期、準大手/大企業＝経営期 */
const COMPANY_RANKS = ["インディー", "零細", "中小", "中堅", "準大手", "大企業"];
function rankName(lv){ return COMPANY_RANKS[Math.max(1, Math.min(STAFF_CAPS.length, lv || 1)) - 1]; }
function companyRank(){ return rankName(S.studioLv); }
function staffCap(){
  if(challengeActive("minority")) return 6;   /* 第2ウェーブ K: 少数精鋭は社格・技術の上限を上書きする */
  return STAFF_CAPS[S.studioLv - 1] + (hasLegacyTech("cap1") ? 6 : 0) + (hasLegacyTech("cap2") ? 6 : 0);   /* 第2ウェーブ J: 上限拡張 I/II で 36→42→48 */
}
const STUDIO_COSTS = [0, 400, 1200, 3600, 7200, 18000];
function studioCost(lv){ return STUDIO_COSTS[lv]; }  // STUDIO_COSTS[現Lv] = 次Lvへの費用: 400/1200/3600/7200/18000（上段は停滞是正のレーンAで圧縮、2026-10-26）
function staffMult(st){ return 1 + 0.25 * (st.lv - 1); }
function hireCost(role){
  const n = S.staff.filter(s => s.role === role).length;
  return Math.ceil(STAFF_ROLES[role].base * Math.pow(1.35, n));
}
function trainCost(st){
  /* Sprint 4: 終盤の育成コストを緩和（1.45 → 1.35 乗）(C2-P1-4) */
  return Math.ceil(STAFF_ROLES[st.role].base * 0.9 * Math.pow(1.35, st.lv - 1));
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
  sales:   { name:"営業部", icon:"💼" }
};
const DEPT_MAX_LV = 10;
function freshDepts(){ return { prog:1, test:1, carry:1, research:1, care:1, sales:1 }; }
function deptLv(role){ return (S.depts && S.depts[role]) || 1; }
function deptMult(role){ return 1 + 0.15 * (deptLv(role) - 1); }
function deptCost(role){ return Math.ceil(300 * Math.pow(2, deptLv(role) - 1)); }
function deptChief(role){
  let best = null;
  for(const st of S.staff) if(st.role === role && (!best || st.lv > best.lv)) best = st;
  return best;
}
function buyDept(role){
  if(!S.depts) S.depts = freshDepts();
  if(deptLv(role) >= DEPT_MAX_LV){ say("その部署はもう最大レベルにゃ"); return; }
  const cost = deptCost(role);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost;
  S.depts[role] = deptLv(role) + 1;
  SoundKit.play("purchase");
  addLog(DEPTS[role].icon + " " + DEPTS[role].name + " が Lv" + S.depts[role] + " に（出力 ×" + deptMult(role).toFixed(2) + "）（-" + fmt(cost) + "🪙）");
  say(DEPTS[role].name + "を強化したにゃ！ みんなの出力が上がるよ");
  save(); renderPanel();
}
/* ---------- Sprint 4: ご褒美（終盤コインシンク） ----------
   価格 = base × (1 + 総収入/25000) × 1.5^(その日の購入回数)。
   稼ぐほど高くなるので、終盤でも「余り続ける」ことがない設計 */
const TREAT_DEFS = [
  { id:"treat_snack", name:"🎁 高級おやつ",   base:150, desc:"集中力 +30、その後30分 生産 +15%" },
  { id:"treat_toy",   name:"🎁 高級おもちゃ", base:200, desc:"集中力 +10、その後30分 クリック効率 +10%" }
];
function treatCost(def){
  return Math.ceil(def.base * (1 + S.totals.coinsEarned / 25000) * Math.pow(1.5, S.today.treats || 0));
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
    S.concentration = Math.min(100, S.concentration + 30);
    S.buffs.prodUntil = Math.max(S.buffs.prodUntil || 0, now) + 30 * 60000;
    say("高級おやつ！ しあわせ〜（30分 生産+15%）");
  } else {
    S.concentration = Math.min(100, S.concentration + 10);
    S.buffs.clickUntil = Math.max(S.buffs.clickUntil || 0, now) + 30 * 60000;
    say("新しいおもちゃ！ わくわく（30分 クリック+10%）");
  }
  SoundKit.play("purchase");
  addLog("🎁 " + def.name.replace("🎁 ","") + "を買った（-" + fmt(cost) + "🪙）");
  save(); renderPanel();
}
/* Sprint 4: 全員まとめて +1Lv（全額払える時だけ・中途半端な適用はしない） */
function buyBulkTrain(){
  const targets = S.staff.filter(s => (s.lv || 1) < STAFF_MAX_LV);
  if(!targets.length){ say("みんな最大レベルにゃ"); return; }
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
  const s = { prog:0, progW:0, qa:0, testDP:0, ship:0, rp:0, careW:0, count:0, byRole:{} };
  for(const st of S.staff){
    const m = staffOutMult(st) * deptMult(st.role), def = STAFF_ROLES[st.role];   /* Sprint 4: 熟練ボーナス込み / Phase C: 部署Lv 倍率 */
    s.byRole[st.role] = (s.byRole[st.role]||0) + 1;
    if(st.role === "prog"){ s.prog += def.out * m; s.progW += m; }
    if(st.role === "test"){ s.qa += def.out * m; s.testDP += 4 * m; }
    if(st.role === "carry"){ s.ship += def.out * m; }
    if(st.role === "research"){ s.rp += def.out * m; }
    if(st.role === "care"){ s.careW += m; }
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
const CLICK_DEFS = [
  { id:"paw",    name:"肉球トレーニング", base:80,  max:10, desc:"クリック威力 +0.06/Lv" },
  { id:"glove",  name:"高級グローブ",     base:300, max:10, desc:"クリック威力 +0.18/Lv" },
  { id:"uchiwa", name:"応援うちわ",       base:200, max:8,  desc:"コンボ上限 +0.25倍/Lv" },
  { id:"cheer",  name:"応援団の旗",       base:500, max:5,  desc:"クリティカル率 +1%/Lv" },
  { id:"synidea",name:"ひらめき連動",     base:350, max:5,  desc:"クリックでアイデア +0.02/Lv（端数は貯まる）" },
  { id:"synrp",  name:"研究メモ連動",     base:800, max:5,  desc:"クリックで研究P +0.004/Lv（端数は貯まる）" }
];
function clickCost(def, lv){ return Math.ceil(def.base * Math.pow(1.30, lv)); }   // Sprint 1: 価格成長 1.55→1.30（アクティブが放置に負けない経済へ）
function clickPower(){
  const base = 0.25 + 0.06*(S.clickUp.paw||0) + 0.18*(S.clickUp.glove||0);
  return base * (hasPerk("focus") ? 1.1 : 1) * buffClickMult();   /* 星屑特典「集中ブースト」＋ご褒美バフ */
}
function comboCapBonus(){ return 2.0 + 0.25*(S.clickUp.uchiwa||0); }   // 倍率 = 1 + min(これ, 連続×0.10) → 基本最大 ×3.0
function critRate(){ return 0.08 + 0.01*(S.clickUp.cheer||0); }

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
  { id:"res_duckplay",name:"一人遊び：アヒル会議", cost:3, desc:"一人遊びにラバーダック相談が増え、QA +0.2/分" },
  { id:"res_plant",   name:"小物：観葉植物",       cost:2, desc:"集中力の回復が +20%" },
  { id:"res_bottrain",name:"ヘルパー研修",         cost:5, desc:"子ねこボットの効率 +50%" },
  { id:"res_line2",   name:"第2ラインの設計",     cost:5, desc:"工場タブで第2ライン（並行開発ライン）を建設できるようになる" },
  /* Sprint 4: ティア2（前提つき）。序盤で研究が「卒業」して RP が死に資源に
     なる問題 (C2-P1-1) への対策。効果は全て実データに効くものだけを置く */
  { id:"res_game2",   name:"ゲーム・デラックス",   cost:8, tier:2, requires:"res_game",    desc:"ゲーム作品の報酬コイン +30%" },
  { id:"res_ai2",     name:"推論チューニング",     cost:8, tier:2, requires:"res_ai",      desc:"AIツール作品の研究P +1" },
  { id:"res_robot2",  name:"ロボット量産ライン",  cost:8, tier:2, requires:"res_robot",   desc:"ロボット作品のバグ混入が半分になる" },
  { id:"res_eff2",    name:"第2ライン高速化",     cost:10, tier:2, requires:"res_line2",  desc:"第2ラインの生産 +50%" },
  { id:"res_zen",     name:"集中の極意",           cost:6, tier:2, requires:"res_plant",   desc:"集中力の減りが 25% 軽くなる" },
  { id:"res_play2",   name:"一人遊び：宝探し",     cost:6, tier:2, desc:"一人遊びに「宝探し」が増える（アイデア多め、たまにコイン）" },
  { id:"res_bot2",    name:"ボットAI学習",         cost:8, tier:2, requires:"res_bottrain", desc:"子ねこボットの効率がさらに +50%" }
];
/* Sprint 4: 反復研究（RP の恒常シンク）。レベルは S.researchLv に持つ。
   工程別の4本（sakuri 決定 2026-10-27）: 詰まっている工程を研究で伸ばす選択にする。
   実装の id は旧「効率化レポート」の res_report を引き継ぐ（旧セーブのレベルは実装に入る） */
const REPEAT_RESEARCHES: ResearchDef[] = [
  { id:"res_report",  stage:"impl",  name:"実装の効率化レポート", cost:10, repeatable:true, desc:"実装 +5%/Lv" },
  { id:"res_rep_test",  stage:"test",  name:"テスト手順書",       cost:10, repeatable:true, desc:"テスト速度と QA +5%/Lv" },
  { id:"res_rep_build", stage:"build", name:"ビルド高速化メモ",   cost:10, repeatable:true, desc:"ビルド速度 +5%/Lv" },
  { id:"res_rep_ship",  stage:"ship",  name:"出荷動線の見直し",   cost:10, repeatable:true, desc:"出荷速度 +5%/Lv" }
];
const REPEAT_RESEARCH = REPEAT_RESEARCHES[0];
function repeatResearchCost(lv){ return Math.ceil(REPEAT_RESEARCH.cost * Math.pow(1.6, lv)); }
function repLv(id){ return (S.researchLv && S.researchLv[id]) || 0; }
function repMult(stage){
  const def = REPEAT_RESEARCHES.find(r => r.stage === stage);
  return 1 + 0.05 * (def ? repLv(def.id) : 0);
}
function tier1Done(){ return RESEARCH_DEFS.filter(r => !r.tier).every(r => S.research[r.id]); }
function resMult(){ return repMult("impl"); }   /* 実装ぶん（extraMult 経由で実装・第2ライン・クリックに掛かる） */

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
  { id:"line2_first",  name:"第2ライン初出荷", test:s=>s.flags.line2Released===true },
  { id:"goldfish",     name:"金のフィッシュ",  test:s=>s.totals.goldFish>=1 },
  { id:"click1000",    name:"応援1000回",       test:s=>s.totals.clicks>=1000, prog:s=>[s.totals.clicks,1000] }
];

