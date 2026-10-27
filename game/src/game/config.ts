/* ============================================================
   みゅけ、きょうも開発中 — デスクトップ常駐版 (Tauri)
   v2: スタッフ雇用 / 工場ラインの深化（工程レート・仕掛品・第2ライン）
       / 応援クリッカー（コンボ・クリティカル・クリックイベント）
   バランス数値は tools/balance-sim.js と同一の定数を使うこと。
   プライバシー: 記録するのは打鍵の「回数」とカーソルの「移動距離」だけ。
   キーの内容は一切読み取らない・保存しない。
   スプライト: window.MIYUKE_SPRITES があれば帯レンダラ経由で使い、
   無ければ従来の手続き描画にフォールバックする（graphics/SPRITES.md 参照）。
   ============================================================ */
const BAL = {
  basePerMin: 8,            // 基本進捗 DP/分
  keysPerDP: 3,             // 何打鍵で +1DP（レーンA・入力ブースト強化）
  cursorPxPerDP: 400,       // 何px移動で +1DP（レーンA・入力ブースト強化）
  clicksPerDP: 2,           // 何クリック（OS集計のストローク）で +1DP（レーンA新設）
  boostCapPerMin: 120,      // 入力ブーストの1分上限(DP)（レーンA・入力ブースト強化）
  sizes:     { TUT:120, XS:400, S:900, M:2600, L:7000 },
  coinBase:  { TUT:60,  XS:120, S:200, M:460,  L:1000 },   // 工程中心化で CI のコイン +10%/Lv を外したぶん底上げ（2026-10-27）
  rpBase:    { TUT:1,   XS:1,   S:1,   M:2,    L:4 },
  bugPerDP: 0.012,          // DPあたりのバグ混入
  inputBugRate: 0.3,        // 応援クリック・入力ブースト由来の DP のバグ混入倍率
  qaBasePerMin: 0.6,        // テスト工程の基本処理能力 バグ/分
  commitEvery: 100,         // 何DPごとにコミット演出
  prestigeDPPerDust: 6000,  // 星屑1個ぶんのDP（第2ウェーブ I: 12,000→8,000 で EXIT を小刻み化。工程中心化で実装の伸びが緩やかになったので 6,000）
  dustSoftcap: 20,          // 1回の売却でこの個数を超えた分は平方根で伸びる（星屑×倍率の複利暴走を止める）
  dustBonus: 0.04,          // 星屑1個の永続ボーナス(+4% ライン全体の生産。作品単価には平方根で効く: dustPriceMult)
  dustMultSoftcap: 30,      // 通算星屑がこれを超えた分は、倍率に平方根で効く
  stageBaseRate: 15,        // テスト/ビルド/出荷の素の処理能力 DP/分（工程の能力は担当スタッフと設備で伸ばす）
  equipDP: { tester: 6, ci: 6, pack: 5, bot: 6 },   // 設備 1Lv ごとの工程速度 DP/分（自動テスト機→テスト、CI・梱包機→ビルド、子ねこボット→出荷）
  testStaffDP: 8,           // テスター1匹のテスト速度 DP/分
  buildEquipPct: 0.05,      // CIマシン・自働梱包機 1Lv ごとのビルド倍率（ビルドは担当スタッフがいない設備の工程）
  line2BaseRate: 4,         // 第2ラインの基本生産 DP/分
  line2BuildCost: 1500,     // 第2ライン建設費 🪙
  line2CoinRate: 0.7        // 第2ラインのリリース報酬倍率
};
const UPGRADE_DEFS = [
  { id:"keyboard", name:"メカニカルキーボード", stage:"実装", base:40,  desc:"実装 +8%/Lv", max:10 },
  { id:"ide",      name:"高機能IDE",           stage:"実装", base:120, desc:"実装 +12%/Lv", max:10 },
  { id:"monitor",  name:"ワイドモニター",       stage:"実装", base:260, desc:"考え中アイデア +1/Lv", max:5 },
  { id:"chair",    name:"ふかふか椅子",         stage:"実装", base:180, desc:"集中力の減り -8%/Lv", max:5 },
  { id:"duck",     name:"ラバーダック検査員",   stage:"テスト", base:60, desc:"QA +0.4 バグ/分/Lv", max:10 },
  { id:"tester",   name:"自動テスト機",         stage:"テスト", base:240, desc:"QA +1.2 バグ/分・テスト速度 +6 DP/分/Lv", max:8 },
  { id:"ci",       name:"CIマシン",             stage:"ビルド", base:200, desc:"ビルド速度 +6 DP/分・ビルド +5%/Lv", max:10 },
  { id:"pack",     name:"自働梱包機",           stage:"ビルド", base:160, desc:"ビルド速度 +5 DP/分・ビルド +5%/Lv", max:10 },
  { id:"bot",      name:"子ねこボット",         stage:"運搬", base:350, desc:"自動で +2DP/分/Lv（同僚）・出荷速度 +6 DP/分/Lv", max:3 }
];
function upgradeCost(def, lv){ return Math.ceil(def.base * Math.pow(1.15, lv)); }
/* 工程中心（2026-10-27）: アップグレードは自分の工程にだけ効く。
   実装の倍率はキーボードと IDE、ビルドの倍率は CI と梱包機 */
function implMult(up){ return 1 + 0.08*(up.keyboard||0) + 0.12*(up.ide||0); }
function buildEquipMult(up){ return 1 + BAL.buildEquipPct * ((up.ci||0) + (up.pack||0)); }
function qaPerMin(up){ return BAL.qaBasePerMin + 0.4*(up.duck||0) + 1.2*(up.tester||0); }

