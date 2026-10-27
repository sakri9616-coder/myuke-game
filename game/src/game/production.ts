/* ---------- 進行：生産 → 仕掛品 → 工程処理 → 出荷（プロジェクト進捗） ----------
   v1 の addDP はここに分割された。生産は wip.code（実装済み・テスト待ち）に入り、
   テスト→ビルド→出荷の各工程がレート（DP/分）で次へ流す。最遅工程がボトルネック。 */
let boostUsedThisMin = 0, boostMinute = -1;
function boostGate(amount, link = 1){
  const m = Math.floor(Date.now()/60000);
  if(m !== boostMinute){ boostMinute = m; boostUsedThisMin = 0; }
  const room = BAL.boostCapPerMin * link - boostUsedThisMin;
  const use = Math.max(0, Math.min(amount, room));
  boostUsedThisMin += use;
  return use;
}
/* 生産倍率は「通算で獲得した星屑」で決める（星屑ショップで使っても下がらない） */
/* 星屑の通算獲得（旧セーブは dustTotal を持たないので所持分で代用） */
function dustTotal(){ return typeof S.dustTotal === "number" ? S.dustTotal : S.dust; }
/* 星屑の倍率（再設計 段階3・sakuri 承認 2026-10-27）: 1個 +dustBonus（+50%）、上限なし。
   段階3より前に貯めた星屑の倍率（旧式: +4%・通算100個から平方根）は S.dustLegacyMult に固めて掛け合わせる
   （旧セーブの倍率は1つも下がらず、そこから新しい星屑ぶんが掛かる）。売却益が企業価値の平方根で伸びるので、
   倍率が星屑に比例でも周回ごとの伸びは多項式に収まる（sim の G8 で確認） */
function dustMultOld(d){ const c = 100; return 1 + 0.04 * (d <= c ? d : c * Math.sqrt(d / c)); }
function dustMultFor(d){ return (S.dustLegacyMult || 1) * (1 + BAL.dustBonus * Math.max(0, d - (S.dustLegacyBase || 0))); }
function dustMult(){ return dustMultFor(dustTotal()); }
/* 作品単価への星屑の効き（dustPriceExp 乗）。工程にも星屑倍率が掛かり出荷数そのものが伸びるので、
   単価まで同じだけ効くと コイン ∝ 倍率² になる */
function dustPriceMult(){ return Math.pow(dustMult(), BAL.dustPriceExp); }
/* 売却益（再設計 段階3）: この会社が届いた企業価値の最高値から。dustSoftcap 個までは比例、超えた分は
   dustGainExp 乗で伸びる（上限は無い）。20個のあたりが「売りどき」で、そこから先は待つほど効率が落ちる。
   旧: 開発量 DP から出していたので、応援で手を動かした量がそのまま星屑になっていた */
function dustGainFromValue(v){
  const x = v / BAL.valuePerDust, c = BAL.dustSoftcap;
  return Math.floor(x <= c ? x : c * Math.pow(x / c, BAL.dustGainExp));
}
/* 自動昇格の閾値（再設計 段階3）: RANK_VALUE[いまの社格] に企業価値が届いたら次の社格へ。下がることはない */
const RANK_VALUE = [0, 5e3, 3e4, 2e5, 1e6, 5e6];
function nextRankValue(){ return S.studioLv < STAFF_CAPS.length ? RANK_VALUE[S.studioLv] : null; }
/* 1秒ティックから: 企業価値の最高値を記録し、届いた社格へ上げる */
function tickCompanyValue(){
  const v = companyValue();
  if(!(v <= (S.runPeakValue || 0))) S.runPeakValue = v;
  while(S.studioLv < STAFF_CAPS.length && S.runPeakValue >= RANK_VALUE[S.studioLv]) promoteRank();
}
function hasPerk(id){ return !!(S.dustPerks && S.dustPerks[id]); }
/* Sprint 4: レベル制の星屑特典（S.dustPerks[id] が数値ならそのレベル、
   旧来の true は Lv1 として読む） */
function perkLv(id){
  const v = S.dustPerks && S.dustPerks[id];
  return typeof v === "number" ? v : (v ? 1 : 0);
}
function perkProdMult(){ return 1 + 0.02 * perkLv("starcharm"); }   /* 星のチャーム: 生産 +2%/Lv */
/* レーンA・集中力 redesign: 集中力は生産倍率そのものになる。100% で +35%、
   50% で +17.5%、0% でも ×1.0 を割らない＝罰でなく伸び。アニメ速度の
   concentrationFactor() とは別物（あちらは再生速度、こちらは生産量）。 */
function concProdMult(){ const c = Math.max(0, Math.min(100, S.concentration || 0)); return 1 + 0.35 * (c / 100); }
function buffProdMult(){ return (S.buffs && S.buffs.prodUntil > Date.now()) ? 1.15 : 1; }  /* ご褒美バフ */
function buffClickMult(){ return (S.buffs && S.buffs.clickUntil > Date.now()) ? 1.10 : 1; }
/* 生産に一律で掛かる追加倍率（反復研究・星屑特典・ご褒美） */
function legacyMult(){ return hasLegacyTech("quantum") ? 1.25 : 1; }   /* 第2ウェーブ J: 量子コンピュータ */
function extraMult(){ return resMult() * extraMultBase(); }
function extraMultBase(){ return perkProdMult() * buffProdMult() * fishProdMult() * legacyMult() * (S.challengeRewards && S.challengeRewards.idle ? 1.15 : 1) * (policyIs("mass") ? 1.1 : 1); }   /* 経営方針「量産体制」 */   /* 第2ウェーブ K: 完全放置の永続報酬は自動生産 +15% */
/* 倍率: 全DP（強化）× 会社全体（星屑・特典・技術遺産・チャレンジ報酬）× やる気MAX × 反復研究（工程ごと）。
   全DP と会社全体は実装と全工程に同じだけ効くので、強化はどれを買っても目に見えて速くなり、
   どこが詰まるかは設備の速度と担当スタッフ（足し算）で決まる */
function companyMult(){ return dustMult() * extraMultBase(); }
function stageMult(stage){ return dpMult(S.upgrades) * companyMult() * firstBoost() * repMult(stage); }
function qaRate(){
  return (qaPerMin(S.upgrades) + (S.research.res_duckplay ? 0.2 : 0) + staffSums().qa) * stageMult("test");
}
function testRate(){ return (BAL.stageBaseRate + BAL.equipDP.tester*upEff(S.upgrades, "tester") + staffSums().testDP) * stageMult("test"); }
function buildRate(){ return (BAL.stageBaseRate + BAL.equipDP.ci*upEff(S.upgrades, "ci") + BAL.equipDP.pack*upEff(S.upgrades, "pack")) * stageMult("build"); }
function shipRate(){ return (BAL.stageBaseRate + BAL.equipDP.bot*(S.upgrades.bot||0) + staffSums().ship) * stageMult("ship"); }
function botRate(){ return 2 * (S.upgrades.bot||0) * (S.research.res_bottrain ? 1.5 : 1) * (S.research.res_bot2 ? 1.5 : 1); }
/* 初リリースまでの加速（最初の5分を設計する）: まだ1作も出していない間だけ
   「引っ越したてのみゅけのやる気MAX」で生産 ×3.4。帯で無操作でも初リリースが
   約5〜6分で届くように実測で調整した値（tools/strip-fresh-measure.js）。
   Sprint 1 の ×1.5 では帯の無操作は約11〜12分かかっていた (C2-P0-2) */
function firstBoost(){ return S.totals.releases === 0 ? 3.4 : 1; }
function productionRate(){
  return (BAL.basePerMin + botRate() + staffSums().prog) * dpMult(S.upgrades) * dustMult() * firstBoost() * extraMult();
}
/* 第2ラインの素の生産量。倍率は produceDP 側で掛かる（以前は line2Rate を
   そのまま produceDP に渡していたため、アップグレード×星屑の倍率が二重に掛かっていた） */
function line2BaseRate(){
  return (BAL.line2BaseRate + 0.8 * staffSums().progW) * (S.research.res_eff2 ? 1.5 : 1);
}
function line2Rate(){ return line2BaseRate() * dpMult(S.upgrades) * dustMult() * extraMult(); }
function bugFactor(){
  return S.bugStock > 8 ? Math.max(0.5, 1 - (S.bugStock - 8) * 0.02) : 1;
}
/* ---------- 拡張ウェーブ G: 技術的負債とブランド力 ----------
   負債は会社の生産効率を逓減させ（1/(1+debt/50): 50で×0.5、450で約×0.1、
   ゲームオーバーにはならない）、ブランドは品質出荷の蓄積で価格に乗る
   （1 + brand×0.02、上限 brand 450 で ×10）。どちらも EXIT で清算される */
function debtEff(){ return 1 / (1 + (S.debt || 0) / 50); }
function brandMult(){ return 1 + Math.min(450, S.brand || 0) * 0.02; }
let dmRelease = false;   /* デスマーチ出荷の最中だけ立つ揮発フラグ（ブランド評価の対象外にする） */
function applyShipQuality(p){
  if(dmRelease) return;   /* デスマーチの負債・ブランドは doDeathMarchCore 側で一括計上する */
  const shippedBugs = Math.floor(S.bugStock);
  if(shippedBugs > 0){
    const add = Math.round(shippedBugs * 1.5);
    if(add > 0){
      S.debt = Math.min(500, (S.debt || 0) + add);
      if(add >= 5) addLog("🐛 バグを抱えたままの出荷で技術的負債 +" + add + "（現在 " + Math.round(S.debt) + "・生産効率 ×" + debtEff().toFixed(2) + "）");
    }
  }
  let delta = 0;
  const featsDone = p.doneFeats >= (p.feats ? p.feats.length : 0);
  if(shippedBugs === 0) delta = featsDone ? 4 : 3;
  else if(shippedBugs <= 3) delta = 1;
  else if(shippedBugs >= 10) delta = -3;
  /* 第2ウェーブ K: ブラック企業の永続報酬はブランドの増え幅 +50%（減る側は据え置き） */
  if(delta > 0 && S.challengeRewards && S.challengeRewards.black) delta = Math.round(delta * 1.5);
  if(delta !== 0){
    S.brand = Math.max(0, Math.min(450, (S.brand || 0) + delta));
    addLog(delta > 0
      ? "⭐ 評判アップ: ブランド力 " + Math.round(S.brand) + "（単価 ×" + brandMult().toFixed(2) + "）"
      : "📉 評判ダウン: ブランド力 " + Math.round(S.brand) + "（単価 ×" + brandMult().toFixed(2) + "）");
  }
}
/* ---------- 拡張ウェーブ G': デスマーチ出荷 ----------
   DP 70% 以上の作品を、残工程を飛ばして即リリースする。納期内なら依頼
   ボーナスは満額（releaseProject の通常経路を通すため）。代価は負債
   （飛ばした割合 × サイズ係数 ＋ 残バグ ×2）とブランド -2 で、
   applyShipQuality の通常計上は dmRelease で止めてこちらで一括計上する。
   確認ダイアログは呼び出し側（帯側のラッパー / viewer スタブ）だけが持つ */
const DM_SIZE_FACTOR = { TUT: 15, XS: 30, S: 60, M: 120, L: 240 };
/* ---------- Wave H: モジュール完成の箱運び（配達猫の型の流用） ---------- */
let stripModCart = null;
function spawnStripModCart(name){
  if(stripModCart) return;
  const coats = S.staff.map(s => s.coat).filter(Boolean);
  stripModCart = { x: stripVW + 24, name, coat: coats.length ? coats[Math.floor(Math.random() * coats.length)] : "kuro", dir: -1, done: false };
}
/* ---------- Wave H: モジュールツリー（L サイズの部品化） ----------
   L の作品はジャンルに応じた 2〜3 個のモジュールを持つ（セーブは
   project.modules の追加のみ・第1ラインだけ）。内製は自動生産の
   一部がミニラインとしてモジュールへ流れ（配分は重み・既定は均等）、
   必要 DP への投資率がそのまま品質になる（最大 1.5）。外注は
   コインで即完成・品質 0.8。本体のビルド工程は全モジュールの完成を
   待つ（統合）。価格には Π(0.8 + 0.4×品質) が乗る              */
const MOD_NAMES = {
  app: ["基盤ライブラリ", "UIキット", "データ層"],
  tool: ["解析エンジン", "プラグイン基盤", "レポート出力"],
  sns: ["フィード基盤", "通知システム", "モデレーション"],
  site: ["CMSコア", "決済連携", "サイト内検索"],
  widget: ["描画コア", "設定まわり", "連携API"],
  game: ["ゲームエンジン", "UIまわり", "サウンド"],
  ai: ["学習基盤", "推論エンジン", "データ収集"],
  robot: ["制御ファーム", "センサー融合", "音声まわり"]
};
const MOD_FLOW = 0.3;          /* 未完成モジュールへの自動生産の配分率 */
const MOD_FLOW_POLISH = 0.1;   /* 全完成後の品質磨きへの配分率 */
function attachModules(p){
  if(!p || p.size !== "L" || p.modules) return p;
  const names = (MOD_NAMES[p.genre] || MOD_NAMES.app).slice();
  const off = Math.floor(Math.random() * names.length);
  const n = 2 + (Math.random() < 0.5 ? 1 : 0);
  p.modules = [];
  for(let i = 0; i < n; i++){
    p.modules.push({ name: names[(off + i) % names.length],
      need: Math.round(p.totalDP * (0.25 + Math.random() * 0.15)),
      inv: 0, out: false, w: 1, done: false });
  }
  return p;
}
/* 品質の天井はこの1箇所で決める（読み取り・磨き込み・デスマーチの
   強制品質が同じ天井を見ること。J の事後チェック指摘で統一） */
function moduleQualityCap(){ return hasLegacyTech("ai_base") ? 1.75 : 1.5; }
function moduleQuality(m){
  if(m.out) return 0.8;
  if(m.forcedQ) return m.forcedQ;
  return Math.min(moduleQualityCap(), m.inv / m.need);
}
function moduleComplete(m){ return !!(m.out || m.done || m.inv >= m.need); }
function modulesDone(p){ return !p || !p.modules || p.modules.every(moduleComplete); }
function modulePriceMult(p){
  if(!p || !p.modules) return 1;
  let mult = 1;
  for(const m of p.modules) mult *= 0.8 + 0.4 * moduleQuality(m);
  return mult;
}
function moduleOutCost(m){ return Math.ceil(m.need * 0.5); }   /* 外注単価: 必要DP × 0.5（納期を買う手段として sim で調整） */
function divertToModules(a){
  const p = S.project;
  if(!p || !p.modules) return 0;
  const open = p.modules.filter(m => !m.out && !moduleComplete(m));
  const polish = p.modules.filter(m => !m.out && moduleComplete(m) && moduleQuality(m) < moduleQualityCap());
  const targets = open.length ? open : polish;
  if(!targets.length) return 0;
  const pool = a * (open.length ? MOD_FLOW : MOD_FLOW_POLISH);
  const wsum = targets.reduce((s, m) => s + (m.w || 1), 0);
  for(const m of targets){
    m.inv += pool * (m.w || 1) / wsum;
    if(!m.done && m.inv >= m.need){
      m.done = true;
      addLog("🧩 モジュール『" + m.name + "』が完成！");
      say("モジュール『" + m.name + "』できたにゃ！");
      spawnStripModCart(m.name);
    }
  }
  return pool;
}
function moduleOutsourceCore(i){
  const p = S.project;
  if(!p || !p.modules || !p.modules[i]) return;
  const m = p.modules[i];
  if(m.out || moduleComplete(m)) return;
  const cost = moduleOutCost(m);
  if(S.coins < cost){ say("コインが足りないにゃ…"); return; }
  S.coins -= cost; m.out = true; m.done = true;
  addLog("🧩 モジュール『" + m.name + "』を外注した（-" + fmt(cost) + "🪙・品質 0.8）");
  say("『" + m.name + "』は外注したにゃ。無難な出来になるよ");
  save(); renderPanel();
}
function moduleWeightCore(i, d){
  const p = S.project;
  if(!p || !p.modules || !p.modules[i]) return;
  const m = p.modules[i];
  m.w = Math.max(1, Math.min(3, (m.w || 1) + d));
  save(); renderPanel();
}
/* パネルのボタンから呼ばれる素の入口（viewer ではスタブが差し替える） */
function moduleOutsource(i){ moduleOutsourceCore(i); }
function moduleWeight(i, d){ moduleWeightCore(i, d); }
function deathMarchInfo(){
  const p = S.project;
  if(!p || p.planning || !p.totalDP) return null;
  const frac = S.projectDP / p.totalDP;
  if(frac < 0.7) return null;
  const bugs = Math.floor(S.bugStock);
  const debtAdd = Math.round((1 - frac) * (DM_SIZE_FACTOR[p.size] || 60)) + bugs * 2;
  return { frac, debtAdd, bugs };
}
function doDeathMarchCore(){
  const info = deathMarchInfo();
  if(!info) return;
  const p = S.project;
  S.debt = Math.min(500, (S.debt || 0) + info.debtAdd);
  S.brand = Math.max(0, (S.brand || 0) - 2);
  /* Wave H: デスマーチはモジュールの統合も強制完了する（品質は投資率
     そのまま・最低 0.5。価格にはその品質で乗る） */
  if(S.project.modules) for(const m of S.project.modules){
    if(!moduleComplete(m)){ m.forcedQ = Math.max(0.5, Math.min(moduleQualityCap(), m.inv / m.need)); m.done = true; }
  }
  addLog("🔥 デスマーチ出荷！『" + p.name + "』残工程を飛ばして即リリース（技術的負債 +" + info.debtAdd + "・ブランド -2）");
  say("デスマーチにゃ！ えいやで出すよ（負債 +" + info.debtAdd + "）");
  dmRelease = true;
  S.projectDP = p.totalDP;
  S.wip = { code: 0, tested: 0, built: 0 };
  releaseProject();
  dmRelease = false;
  save(); renderPanel();
}
function doDeathMarch(){
  const info = deathMarchInfo();
  if(!info) return;
  if(!confirm("デスマーチ出荷しますか？\n残りの工程を飛ばして『" + S.project.name + "』を即リリースします。\n代価: 技術的負債 +" + info.debtAdd + " / ブランド -2")) return;
  doDeathMarchCore();
}
/* ---------- 拡張ウェーブ G': バグ外注（sakuri 案） ----------
   バグ在庫と負債が積んだときの、金で買うリリーフバルブ。射程は承認どおり
   「バグ在庫の全消し＋負債 −40%」、費用は少々重く（バグ ×30 ＋ 負債 ×15）、
   総務のケア（人で返す）との二択が経営判断になる。
   v2.12.1: 10 分のクールダウン（介入できない待ち）をやめ、次のリリースまでに続けて頼むほど
   ×VENDOR_REPEAT_MULT ずつ高くする（リリースで元に戻る） */
const VENDOR_REPEAT_MULT = 1.5;
function vendorCost(){
  const bugs = Math.floor(S.bugStock);
  const debtCut = Math.floor((S.debt || 0) * 0.4);
  const uses = S.vendorUses || 0;
  return { bugs, debtCut, uses, coins: Math.ceil((bugs * 30 + Math.floor(S.debt || 0) * 15) * Math.pow(VENDOR_REPEAT_MULT, uses)) };
}
function outsourceBugsCore(){
  const c = vendorCost();
  if(c.bugs <= 0 && c.debtCut <= 0){ say("いまは外注するものがないにゃ（バグも負債もきれいだよ）"); return; }
  if(S.coins < c.coins){ say("コインが足りないにゃ（必要 " + fmt(c.coins) + "🪙）"); return; }
  S.coins -= c.coins;
  S.bugStock = 0;
  S.debt = Math.max(0, (S.debt || 0) - c.debtCut);
  S.vendorUses = (S.vendorUses || 0) + 1;   /* 次のリリースまで、続けて頼むほど高くなる */
  addLog("🧳 外注ベンダーに依頼: バグ " + c.bugs + " 匹を一掃・技術的負債 -" + c.debtCut + "（-" + fmt(c.coins) + "🪙）");
  say("ベンダーさんがバグを全部持って帰ったにゃ！ すっきりしたね");
  spawnStripVendor();
  save(); renderPanel();
}
function outsourceBugs(){
  const c = vendorCost();
  if(c.bugs <= 0 && c.debtCut <= 0){ outsourceBugsCore(); return; }
  if(!confirm("外注ベンダーに依頼しますか？\nバグ " + c.bugs + " 匹を全消し ＋ 技術的負債 -" + c.debtCut + "\n費用: " + fmt(c.coins) + "🪙")) return;
  outsourceBugsCore();
}
/* 生産: 倍率を掛けて対象ラインの実装バッファへ。バグは生産量に応じて全体に混入する */
/* ---------- 拡張ウェーブ F: オーバークロック（フィーバー） ----------
   実作業（入力ブースト）と応援クリックでゲージが貯まり、プレイヤーが任意の
   タイミングで発動する 30 秒の加速時間（承認済み仕様書 F 節・数値は承認値）。
   供給の線引きは入力ブーストと同じ: OS 集計が OFF のときはゲーム内クリック
   だけで細く貯まる。発動中は生産 ×5（バグの発生は基礎量で数える — 加速の
   代価にバグを増やさない）・応援クリック ×3（再設計で ×20 から変更）・バグが湧きやすい */
const FEVER = { chargePerBoostDP: 0.2, chargePerClick: 0.06, durationMs: 30000, prodMult: 5, clickMult: 3, passiveMax: 0.2 };
let feverUntil = 0;   /* 発動中だけ意味がある揮発状態（保存しない） */
let feverBugNext = 0;
function feverActive(){ return Date.now() < feverUntil; }
/* 未発動のゲージは「蓄熱」として自動生産を底上げする（最大 +20%）。
   発動中はこの分は発動倍率に内包されるので二重には掛けない */
function feverPassive(){ return feverActive() ? 1 : 1 + FEVER.passiveMax * ((S.fever && S.fever.gauge) || 0) / 100; }
/* ---------- F 再設計（Argon フォローアップ 2026-10-26） ----------
   ・クリック式のハイブリッド化: 1クリック = 基礎値 + 自動生産(DP/秒) × 5%
     （成長軸は基礎値でなく会社の自動生産への連動に移る）
   ・入力バケツ: DP が付くクリックは秒 5 回まで（発動中は 8 回）。人間の
     クリックは届かない速度で、連打ツールへの堰として働く。反応やコンボは
     バケツの外でも止めない（v2.4.2 の原則）
   ・流入制限は案B（減衰貫通）の読み替え: クリック DP の直接進捗への
     貫通は 20% に絞り、残り 80% は第1工程への流入として工程キャップ
     （テスト/ビルド/出荷レート）に堰き止めさせる。案A でない理由は
     dev-log に記録（当社の工程はライン内で全段が常時存在し、段階解放
     されるのは第2ラインと部署のため）
   ・フィーバーのクリック倍率は ×20 → ×3（×20 は無上限の貫通構造に
     乗ると連打ツールで爆発する、という Argon の警告による置換。
     承認仕様の字面との差分として報告に明記する）                    */
const CLINK = { linkRate: 0.05, bucketMax: 15, bucketPerSec: 5, bucketPerSecFever: 8, directShare: 0.2, carryMult: 3 };   /* carryMult: 1クリックで手で運べる仕掛品 = 威力 × 3 */
let clickBucket = CLINK.bucketMax, clickBucketAt = Date.now();
let autoProdEMA = 0;        /* 自動生産レート (DP/秒) の指数移動平均 */
let autoProdSecAcc = 0;     /* 直近1秒の自動生産の積算（tick で EMA へ） */
let prodMuted = false;      /* true の間の produceDP は「入力由来」: 自動生産に数えず、フィーバー生産倍率も掛けない */
/* 1クリックの基礎（倍率前）= 素の威力 ＋ 自動生産の linkRate 分。クリックには produceDP などで
   生産倍率が掛かるので、
   ・連動分は倍率を割り戻して足す（二重に掛けると周回が進むほどクリックが全てを代替する）
   ・素の威力は星屑倍率を平方根でだけ受ける（手作業の比重は周回とともに下がり、自動化・経営へ移る）
   どちらも理念書3「労働には対価、ただし全ては代替しない」。連動分があるので終盤でも必ず効く */
function clickProdMult(){ return dpMult(S.upgrades) * dustMult() * firstBoost() * extraMult() * concProdMult(); }
function clickBaseDP(){ return clickPower() / Math.sqrt(dustMult()) + autoProdEMA * CLINK.linkRate * clickLinkMult() / Math.max(1e-9, clickProdMult()); }
/* 表示用: 倍率込みで実際に進む 1クリックの DP（帯の浮き文字・コンボ表示・パネル） */
function clickShownDP(){ return clickBaseDP() * clickProdMult(); }
function clickBucketTake(){
  const now = Date.now();
  const rate = feverActive() ? CLINK.bucketPerSecFever : CLINK.bucketPerSec;
  clickBucket = Math.min(CLINK.bucketMax, clickBucket + (now - clickBucketAt) / 1000 * rate);
  clickBucketAt = now;
  if(clickBucket < 1) return false;
  clickBucket -= 1;
  return true;
}
function chargeFever(amount){
  if(feverActive() || !S.fever) return;
  const before = S.fever.gauge || 0;
  S.fever.gauge = Math.min(100, before + amount * (hasPerk("starlight") ? 1.15 : 1) * ideaChargeMult());   /* 第2ウェーブ I: 星あかりで充填 +15% ／ アイデアの蓄えで速まる（企画を練ると減る） */
  if(before < 100 && S.fever.gauge >= 100 && !IS_VIEWER){
    say("⚡ オーバークロック準備完了にゃ！ 机脇のゲージをクリックで発動できるよ");
    addLog("⚡ オーバークロックのゲージが満タンになった");
  }
}
function activateFever(){
  if(feverActive()) return;
  if(!S.fever || (S.fever.gauge || 0) < 100){
    say("ゲージがまだ " + Math.floor((S.fever && S.fever.gauge) || 0) + "% にゃ。作業や応援で貯まるよ");
    return;
  }
  S.fever.gauge = 0;
  feverUntil = Date.now() + FEVER.durationMs;
  feverBugNext = Date.now() + 3000;
  SoundKit.play("releaseFanfare");
  say("⚡ オーバークロック発動にゃ！！ 30秒、全力で回すよ！");
  addLog("⚡ オーバークロック発動（30秒: 生産×5・クリック×3）");
  if(document.body.classList.contains("strip"))
    addStripFloater(stripDeskCX(), STRIP_GROUND - 62, "⚡ FEVER!", "#e2543e");
  save(); renderPanel();
}
function produceDP(amount, target){
  const fromInput = prodMuted;
  const aBase = amount * dpMult(S.upgrades) * dustMult() * firstBoost() * extraMult() * concProdMult() * debtEff() * feverPassive();
  const a = aBase * (feverActive() && !fromInput ? FEVER.prodMult : 1);
  if(!fromInput) autoProdSecAcc += a;   /* F再設計: 自動生産レートの計測（入力由来は数えない） */
  /* Sprint 4: ロボット量産ライン研究があると、ロボット作品だけバグ混入が半分。企画を練った作品もバグが出にくい */
  const proj = target === "l2" ? S.line2.project : S.project;
  const bugMul = ((proj && proj.genre === "robot" && S.research.res_robot2) ? 0.5 : 1) * planBugMult(proj) * (challengeActive("black") ? 3 : 1) *   /* 第2ウェーブ K: ブラック企業はバグ ×3 */
    (fromInput ? BAL.inputBugRate : 1);   /* 応援・入力で増えた分はバグが出にくい（頑張るほど詰まる逆転を防ぐ） */
  if(target === "l2"){ S.line2.wip.code += a; if(S.line2.project) S.line2.project.bugs += aBase * BAL.bugPerDP * bugMul; }
  else {
    /* Wave H: 自動生産の一部はモジュールのミニラインへ（入力由来は対象外） */
    let inflow = a;
    if(!fromInput && S.project && S.project.modules && !S.project.planning) inflow -= divertToModules(a);
    S.wip.code += inflow;
    if(S.project) S.project.bugs += aBase * BAL.bugPerDP * bugMul;
    S.totals.lines += a * 1.05; S.today.lines += a * 1.05;
  }
  S.runDP += a;
  S.bugStock += aBase * BAL.bugPerDP * bugMul;
  /* 第2ウェーブ K: 完全放置中はフィーバーが自動生産から細く貯まる */
  if(!fromInput && challengeActive("idle")) chargeFever(a * 0.02);
  /* チュートリアル: 初めてバグ在庫が積まれた瞬間だけ、ほったらかしで
     大丈夫なことを1回伝える (マイクロビート) */
  if(S.tut && !S.tut.seen.first_bug && S.bugStock >= 1 && !IS_VIEWER){
    S.tut.seen.first_bug = true;
    say("バグが出たにゃ。あたしが勝手に叩くから大丈夫だよ");
  }
}
/* 工程中心（2026-10-27）: 応援は「みゅけが手で運ぶ」。溜まった仕掛品を下流から
   （ビルド済み → テスト済み → 実装済みの順に）手で出荷まで運び、その場で進捗に計上する。
   運べた量（DP）を返す。仕掛品が無ければ 0。新しい DP は生まないので星屑の元（runDP）には
   数えない。v2.7.0 までは応援の8割が実装に積まれるだけで、後工程が詰まっていると
   いくらクリックしても進捗ゲージが動かなかった */
function cheerCarry(amount){
  if(!S.project || S.project.planning || amount <= 0) return 0;
  const w = S.wip;
  let left = amount;
  for(const k of ["built", "tested", "code"]){
    const take = Math.min(left, w[k]);
    w[k] -= take; left -= take;
    if(left <= 0) break;
  }
  const moved = amount - left;
  if(moved > 0) creditProject(moved);
  return moved;
}
/* 工程処理: caps = {test, build, ship}（この tick で使える DP 量）。使った分を返す */
function processPipe(wip, caps, bugF, creditFn){
  const t = Math.min(wip.code, caps.test * bugF);   wip.code -= t;   wip.tested += t;
  const bd = Math.min(wip.tested, caps.build);      wip.tested -= bd; wip.built += bd;
  const sh = Math.min(wip.built, caps.ship);        wip.built -= sh;
  if(sh > 0) creditFn(sh);
  return { test:t, build:bd, ship:sh };
}
/* 出荷分をプロジェクト進捗に計上（機能チェック・コミット・リリース判定） */
function creditProject(a){
  const p = S.project;
  if(!p || p.planning) return;
  S.projectDP += a;
  payFlow(p, Math.min(a, Math.max(0, p.totalDP - (S.projectDP - a))), false);
  const featThreshold = p.totalDP / (p.feats.length + 1);
  while(p.doneFeats < p.feats.length && S.projectDP >= featThreshold * (p.doneFeats + 1)){
    p.doneFeats++;
    say("『"+p.feats[p.doneFeats-1]+"』できたにゃ！");
    addLog("機能『"+p.feats[p.doneFeats-1]+"』が完成");
    pulseMilestone();
    spawnFeatNote(1);   /* 可視生産: 付箋が机からボードへ飛ぶ (演出のみ) */
  }
  /* コミットの刻みは仕事の桁に合わせる（段階3: 桁が大きい会社では DP 100 ごとの刻みだと1回の入金で
     数百万回ループして帯が止まった）。1回の呼び出しで演出するのは3回まで、残りは数だけ進める */
  const cstep = BAL.commitEvery * (p.scale || 1);
  for(let n = 0; S.projectDP - S.commitMark >= cstep; n++){
    if(n >= 3){ const k = Math.floor((S.projectDP - S.commitMark) / cstep); S.commitMark += k * cstep; S.totals.commits += k; S.today.commits += k; break; }
    S.commitMark += cstep;
    doCommit();
  }
  S.packages = Math.floor(S.projectDP / (p.totalDP/6));
  if(S.projectDP >= p.totalDP) releaseProject();
}
function creditProject2(a){
  const L = S.line2, p = L.project;
  if(!p || p.planning) return;
  L.projectDP += a;
  payFlow(p, Math.min(a, Math.max(0, p.totalDP - (L.projectDP - a))), true);
  const featThreshold = p.totalDP / (p.feats.length + 1);
  while(p.doneFeats < p.feats.length && L.projectDP >= featThreshold * (p.doneFeats + 1)){
    p.doneFeats++;
    addLog("第2ライン: 機能『"+p.feats[p.doneFeats-1]+"』が完成");
    spawnFeatNote(2);   /* 可視生産: 第2ラインの付箋も自分のボードへ */
  }
  const cstep2 = BAL.commitEvery * (p.scale || 1);
  for(let n = 0; L.projectDP - L.commitMark >= cstep2; n++){
    if(n >= 3){ const k = Math.floor((L.projectDP - L.commitMark) / cstep2); L.commitMark += k * cstep2; S.totals.commits += k; S.today.commits += k; break; }
    L.commitMark += cstep2;
    S.totals.commits++; S.today.commits++;
    stripGitLog2.push({ at: Date.now(), seed: Math.random() });
    if(stripGitLog2.length > 3) stripGitLog2.shift();
    if(Math.random() < 0.2) addLog("第2ライン: コミットしたにゃ");
  }
  if(L.projectDP >= p.totalDP) releaseProject2();
}
function doCommit(){
  S.totals.commits++; S.today.commits++;
  SoundKit.play("phaseComplete");
  pulseMilestone();
  /* 可視生産: モニタの git ログ面に新しい行が1行増える (演出のみ) */
  stripGitLog.push({ at: Date.now(), seed: Math.random() });
  if(stripGitLog.length > 3) stripGitLog.shift();
  const p = S.project;
  const feat = p && p.feats[Math.min(p.doneFeats, p.feats.length-1)] || "土台";
  let msg = COMMIT_MSGS[Math.floor(Math.random()*COMMIT_MSGS.length)]
    .replace("{feat}", feat).replace("{n}", String(1+Math.floor(Math.random()*3)));
  addLog("コミット: " + msg);
  const h = new Date().getHours();
  if(h >= 0 && h < 5) S.flags.nightCommit = true;
  if(Math.random() < 0.35) say(msg);
  checkStamps();
}
/* 開発にかかった分数（実働秒があればそれ、旧セーブは経過時間）。最低1分 */
function projectDevMin(p){
  return Math.max(1, Math.round((typeof p.activeSec === "number" ? p.activeSec * 1000 : Date.now() - p.startedAt)/60000));
}
/* リリースの記帳（第1・第2ライン共通）: 入金・研究P・通算・出荷品質・作品棚。
   出荷品質 → 負債とブランド（拡張ウェーブ G）は第2ラインも同じ会社の評判 */
function recordRelease(p, coins, rp, devMin, projectDP, naps, line2){
  S.coins += coins; S.totals.coinsEarned += coins;
  S.rp += rp;
  S.totals.releases++; S.today.releases++;
  S.vendorUses = 0;    /* v2.12.1: バグ外注の続け頼みの割増はリリースで戻る */
  trendOnShip();   /* v2.12.1: トレンドは出荷の本数で回る（自社IP は段階1から毎秒のシリーズ売上） */
  lastReleaseInfo = { name: p.name, at: Date.now() };   /* Sprint 4: 帯チップ用 */
  applyShipQuality(p);
  const entry = {
    name: p.name, genreName: p.genreName, size: p.size,
    date: new Date().toLocaleDateString("ja-JP"),
    devMin, lines: Math.round(projectDP * 1.05),
    bugs: Math.round(p.bugs), naps,
    icon: (typeof p.icon === "number" ? p.icon : Math.floor(Math.random()*8))
  } as ShelfEntry;
  if(line2) entry.line2 = true;
  entry.highlight = makeHighlight(p, devMin, naps);
  S.shelf.unshift(entry);
}
/* ---------- 自動収益を毎秒の流れに（2026-10-27・目標像仕様書「秒ごとに上がっていく収益を眺める」）----------
   作品の値段のうち FLOW_SHARE は、出荷工程を通った DP に比例して作りながら入金する（帯に 🪙/秒）。
   残りはリリースの瞬間にボーナスの山として入る。1作品で受け取る合計は従来と同じ
   （依頼ボーナス・IP の扱いもリリース側で従来どおり計算し、入金済みの分を差し引く）。
   IP ねらいの作品は賭けなので流れでは払わない（成否はリリースで決まる） */
const FLOW_SHARE = 0.6;
function basePriceCoins(p, line2){
  let c = BAL.coinBase[p.size] * (p.scale || 1) * (line2 ? BAL.line2CoinRate : 1) * (1 + 0.10*upEff(S.upgrades, "ci")) * dustPriceMult() * brandMult() * (line2 ? 1 : modulePriceMult(p)) * planPriceMult(p) * (challengeActive("black") ? 2 : 1) * trendMult(p.genre);   /* 第2ウェーブ K: ブラック企業は価格 ×2 ／ L: 市場の流れ */
  if(p.genre === "game" && S.research.res_game2) c *= 1.3;   /* Sprint 4: ティア2研究のジャンル深化（ゲーム=コイン+30%） */
  return c;
}
let coinFlowFrac = 0, coinFlowSecAcc = 0, coinFlowEMA = 0;   /* 端数・この1秒の流入・🪙/秒 の平滑値（表示用） */
function creditFlowCoins(c){
  coinFlowSecAcc += c;
  coinFlowFrac += c;
  if(coinFlowFrac >= 1){ const n = Math.floor(coinFlowFrac); coinFlowFrac -= n; S.coins += n; S.totals.coinsEarned += n; }
}
function payFlow(p, a, line2){
  if(!p || p.ip || a <= 0 || !(p.totalDP > 0)) return;
  const c = basePriceCoins(p, line2) * FLOW_SHARE * a / p.totalDP;
  p.flowPaid = (p.flowPaid || 0) + c;
  creditFlowCoins(c);
}
/* ---------- 作品棚の毎秒売上（再設計 段階1・2026-10-27 sakuri 承認）----------
   出した作品は棚に並んで売れ続ける: リリースの瞬間に 値段 × CAT.ratePerMin /分 で売れ始め、
   次の作品が出るたびに ×CAT.decay（新作に客が移る）。棚に並ぶのは新しい順に CAT.max 本。
   自社IP になった作品はシリーズとして減衰せず、値段 × CAT.seriesPerMin /分 を EXIT まで稼ぐ
   （v2.12.1 の「出荷1本ごとのロイヤリティ」を置き換え。仕事の桁に追従するのは従来どおり）。
   収入が「リリースの山」だけだと、作る速さの遅い放置プレイでは買い物→収入の複利がほとんど回らなかった。
   棚とシリーズは会社の資産なので EXIT で消える */
/* sim 実測（game-sim・3シード、段階1）: 0.015 では放置の停滞が 70分、0.04 で 66分、0.08 で 29分。
   秒5クリックの星屑20個は 0.015〜0.08 でほぼ変わらない（15〜18分）。張り付きはリリースが速いぶん棚がすぐ入れ替わり、
   放置はリリースの間が長いぶん棚が長く稼ぐ: 同じ作品棚が遊び方で効き方を変える */
const CAT = { ratePerMin: 0.09, decay: 0.8, max: 12, seriesPerMin: 0.04 };
function catalogAdd(p, price){
  if(!Array.isArray(S.catalog)) S.catalog = [];
  for(const e of S.catalog) e.r *= CAT.decay;
  S.catalog.unshift({ n: p.name, r: price * CAT.ratePerMin / 60 });
  if(S.catalog.length > CAT.max) S.catalog.length = CAT.max;
}
function seriesRate(ip){ return ip.price * CAT.seriesPerMin / 60 * Math.max(1, workScale() / (ip.scale || 1)); }
/* 🪙/秒（棚＋シリーズ） */
function catalogRate(){
  let r = 0;
  for(const e of (S.catalog || [])) r += e.r || 0;
  for(const ip of (S.ips || [])) r += seriesRate(ip);
  return r;
}
/* いまの自動収入 🪙/秒（作りながらの入金・棚・シリーズ・子会社。リリースの山は含めない） */
function incomePerSec(){
  let r = Math.max(coinFlowEMA, catalogRate());
  for(const sub of (S.subs || [])) r += subRates(sub).coins / 60;
  return r;
}
/* ---------- 企業価値（再設計 段階3）----------
   会社が「あなたの手なしで」1時間に稼ぐコイン。買い手が買うのは会社であって、あなたの応援ではない。
   = 自動生産のうち工程を通って出荷できる量 × いまの作品の DP 単価 ＋ 作品棚とシリーズ ＋ 子会社。
   応援や実作業は会社を速く育てる手段で、価値そのものには数えない */
function autoIncomePerSec(){
  const p = S.project;
  let r = catalogRate();
  if(p && p.totalDP > 0){
    const dps = Math.min(productionRate(), testRate() * bugFactor(), buildRate(), shipRate()) / 60;
    r += dps * basePriceCoins(p, false) / p.totalDP;
  }
  for(const sub of (S.subs || [])) r += subRates(sub).coins / 60;
  return r;
}
function companyValue(){ return autoIncomePerSec() * 3600; }
/* イベント報酬: 収入の sec 秒ぶん。従来の式 floor を下回らない */
function rewardCoins(sec, floor){ return Math.max(floor, Math.round(sec * incomePerSec())); }
function tickCatalog(){
  const c = catalogRate();
  if(c > 0) creditFlowCoins(c);
}
/* 1秒ティックから呼ぶ: 🪙/秒 の表示値を更新 */
function tickCoinFlow(){ coinFlowEMA = coinFlowEMA * 0.8 + coinFlowSecAcc * 0.2; coinFlowSecAcc = 0; }
function releaseProject(){
  const p = S.project;
  const devMin = projectDevMin(p);
  let coins = Math.round(basePriceCoins(p, false));
  let rp = Math.round(BAL.rpBase[p.size] * Math.sqrt(p.scale || 1));   /* 仕事の桁: 研究Pは桁の平方根で（研究は固定価格の木なので） */
  /* Sprint 4: ティア2研究のジャンル深化（AI=研究P+1。ゲームのコイン+30% は basePriceCoins） */
  if(p.genre === "ai" && S.research.res_ai2) rp += 1;
  const ipBase = coins;   /* 第2ウェーブ L: シリーズ売上と棚売上の元本 = 依頼ボーナスを含まない通常価格 */
  let requestBonus = "";
  if(S.activeRequest && S.activeRequest.genre === p.genre){
    /* Phase C: ボーナス率は依頼のティアで決まる（手動受注は従来どおり +60%）。
       要求サイズ未満の作品で達成した場合は半額（満額条件の明示） */
    const rq = S.activeRequest;
    let rate = typeof rq.bonus === "number" ? rq.bonus : 0.6;
    let shortNote = "";
    if(rq.reqSize && SIZE_ORDER.indexOf(p.size) < SIZE_ORDER.indexOf(rq.reqSize)){
      rate = rate / 2;
      shortNote = "（要求サイズ未満のためボーナス半額）";
    }
    /* 拡張ウェーブ G: 納期を過ぎた出荷はボーナスが消える（作品は通常価格で売れる） */
    let lateNote = "";
    if(rq.deadlineAt && Date.now() > rq.deadlineAt){
      rate = 0;
      lateNote = "（納期を過ぎたためボーナスなし）";
    }
    const bonus = Math.round(coins * rate);
    coins += bonus; rp += 1;
    requestBonus = rate > 0 ? "（依頼達成ボーナス +"+bonus+"🪙）" : "";
    addLog(rate > 0
      ? "依頼達成！『"+p.name+"』"+requestBonus+shortNote
      : "依頼は完了: 『"+p.name+"』"+lateNote);
    S.activeRequest = null; genRequests();
    maybeSpawnBigDeal();
    maybeAutoAcquire();   /* Phase C: 枠が空いたら営業が次を取ってくる */
  }
  /* 第2ウェーブ L: IP が成立する出荷は即時の入金が売却額の30%になる
     （残りはシリーズの毎秒売上。成立しない指定作は通常どおり全額） */
  const ipOk = ipConvertible(p);
  if(ipOk) coins = Math.round(coins * 0.3);
  else if(p.ip) coins = Math.round(coins * IP_FAIL_MULT);   /* IP 狙いの空振り: 作り込みが中途半端 */
  const flowed = Math.round(p.flowPaid || 0);   /* 作りながら入金済みの分（帳簿の合計は coins のまま） */
  const bonusNow = Math.max(0, coins - flowed);
  recordRelease(p, coins, rp, devMin, S.projectDP, S.totals.naps - p.napsAtStart, false);
  settleIP(p, ipBase, S.shelf[0], ipOk);   /* 第2ウェーブ L: IP 指定があればここで成立判定 */
  if(!ipOk) catalogAdd(p, ipBase);   /* 再設計 段階1: 棚に並んで売れ続ける（IP はシリーズとして別に稼ぐ） */
  S.coins += bonusNow - coins;   /* recordRelease が全額を足すので、入金済みの分を戻す */
  S.totals.coinsEarned += bonusNow - coins;
  coins = bonusNow;
  addLog("🎉 リリース！『"+p.name+"』 +"+fmt(coins)+"🪙"+(flowed > 0 ? "（作りながら +"+fmt(flowed)+"🪙 入金済み）" : "")+" / +"+rp+"🔬 "+requestBonus);
  shelfGlowFrame = frame + 40;   /* Sprint 3: 棚の最新作を約6秒ハイライト */
  spawnStripCoinFountain(coins);   /* 可視生産: コインは実際に付与された時だけ湧く */
  say("『"+p.name+"』リリースできたにゃ〜！ +"+coins+"コイン");
  SoundKit.play("releaseFanfare");
  pulseMilestone();
  catState = "celebrate"; stateUntil = Date.now() + 4500; stateEnteredAt = Date.now();
  S.packages = 0; S.ideas += 2;
  startProjectSoft();
  checkStamps();
  save();
  tutCheck();
}
function releaseProject2(){
  const L = S.line2, p = L.project;
  const devMin = projectDevMin(p);
  let coins = Math.round(basePriceCoins(p, true));
  let rp = Math.round(BAL.rpBase[p.size] * Math.sqrt(p.scale || 1));   /* 仕事の桁: 研究Pは桁の平方根で（研究は固定価格の木なので） */
  if(p.genre === "ai" && S.research.res_ai2) rp += 1;
  const ipBase2 = coins;   /* 第2ウェーブ L: 元本は30%カット前の通常価格 */
  const ipOk2 = ipConvertible(p);
  if(ipOk2) coins = Math.round(coins * 0.3);   /* 第2ウェーブ L: 第2ラインも即時は30% */
  else if(p.ip) coins = Math.round(coins * IP_FAIL_MULT);
  const flowed2 = Math.round(p.flowPaid || 0);
  const bonus2 = Math.max(0, coins - flowed2);
  recordRelease(p, coins, rp, devMin, L.projectDP, 0, true);
  S.flags.line2Released = true;
  settleIP(p, ipBase2, S.shelf[0], ipOk2);   /* 第2ウェーブ L: 第2ラインの指定作も同じ判定 */
  if(!ipOk2) catalogAdd(p, ipBase2);
  S.coins += bonus2 - coins; S.totals.coinsEarned += bonus2 - coins;
  coins = bonus2;
  addLog("🎉 第2ラインでリリース！『"+p.name+"』 +"+fmt(coins)+"🪙"+(flowed2 > 0 ? "（作りながら +"+fmt(flowed2)+"🪙 入金済み）" : "")+" / +"+rp+"🔬");
  shelfGlowFrame = frame + 40;   /* Sprint 3: 棚の最新作を約6秒ハイライト */
  spawnStripCoinFountain(coins);   /* 可視生産: コインは実際に付与された時だけ湧く */
  SoundKit.play("releaseFanfare");
  pulseMilestone();
  const np = settleProject(genProject(null, L.genre, line2Rate()));
  L.project = np; L.projectDP = 0; L.commitMark = 0;
  addLog("第2ラインの次のプロジェクト『"+np.name+"』を用意した（"+np.size+"）");
  checkStamps();
  save();
  tutCheck();
}
function startProjectSoft(){
  // リリース直後: 次プロジェクトを用意するが進捗は次 tick から。
  // 依頼の予約ジャンルがあれば、それを次作品に適用して予約を消費する
  let genreId = null;
  if(S.nextRequestGenre){ genreId = S.nextRequestGenre; S.nextRequestGenre = null; }
  const prevScale = (S.project && S.project.scale) || 1;
  const nr = settleProject(genProject(null, genreId));
  S.project = nr; S.projectDP = 0; S.commitMark = 0;
  attachModules(S.project);   /* Wave H */
  addLog("次のプロジェクト『"+nr.name+"』を用意した（"+nr.size+" / "+fmt(nr.totalDP)+"DP）");
  /* 仕事の桁が上がった瞬間は解放ジャンプとして知らせる（理念書4） */
  if((nr.scale || 1) > prevScale){
    addLog("📈 仕事の桁が上がった！ 作品の規模も報酬も ×" + fmt(nr.scale) + "（いまの会社の速さに見合う仕事が来るようになった）");
    say("仕事の桁が上がったにゃ！ ×" + fmt(nr.scale) + " の大仕事だよ");
  }
}

