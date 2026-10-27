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
  coinBase:  { TUT:60,  XS:90,  S:150, M:340,  L:750 },
  rpBase:    { TUT:1,   XS:1,   S:1,   M:2,    L:4 },
  bugPerDP: 0.012,          // DPあたりのバグ混入
  inputBugRate: 0.3,        // 応援クリック・入力ブースト由来の DP のバグ混入倍率
  qaBasePerMin: 0.6,        // テスト工程の基本処理能力 バグ/分
  commitEvery: 100,         // 何DPごとにコミット演出
  prestigeDPPerDust: 8000,  // 星屑1個ぶんのDP（第2ウェーブ I: 12,000→8,000 で EXIT を小刻み化）
  dustSoftcap: 20,          // 1回の売却でこの個数を超えた分は dustGainExp 乗で伸びる
  dustGainExp: 0.5,         // （平方根。0.6 以上だと sim の active で 30 日に星屑 8,000 個超まで暴走した）
  dustPriceExp: 0.5,        // 作品単価には星屑倍率の dustPriceExp 乗で効く
  dustBonus: 0.04,          // 星屑1個の永続ボーナス(+4% ライン全体の生産と作品単価)
  dustMultSoftcap: 100,     // 通算星屑がこれを超えた分は倍率に平方根で効く（上限ではない。v2.8.0 の 30 から緩めた）
  scaleRefMin: 10,          // 仕事の桁: M 作品が今の実効スループットでこの分数を下回るほど速くなったら、作品の規模と報酬を 1/2/5/10… 倍に上げる
  stageBaseRate: 30,        // テスト/ビルド/出荷の基本スループット DP/分
  equipDP: { tester: 6, ci: 6, pack: 5, bot: 6 },   // 設備 1Lv ごとの工程速度 DP/分（自動テスト機→テスト、CI・梱包機→ビルド、子ねこボット→出荷）
  testStaffDP: 8,           // テスター1匹のテスト速度 DP/分
  line2BaseRate: 4,         // 第2ラインの基本生産 DP/分
  line2BuildCost: 1500,     // 第2ライン建設費 🪙
  line2CoinRate: 0.7        // 第2ラインのリリース報酬倍率
};
const UPGRADE_DEFS = [
  { id:"keyboard", name:"メカニカルキーボード", stage:"実装", base:40,  desc:"全DP +5%/Lv", max:10 },
  { id:"ide",      name:"高機能IDE",           stage:"実装", base:120, desc:"全DP +8%/Lv", max:10 },
  { id:"monitor",  name:"ワイドモニター",       stage:"実装", base:260, desc:"考え中アイデア +1/Lv", max:5 },
  { id:"chair",    name:"ふかふか椅子",         stage:"実装", base:180, desc:"集中力の減り -8%/Lv", max:5 },
  { id:"duck",     name:"ラバーダック検査員",   stage:"テスト", base:60, desc:"QA +0.4 バグ/分/Lv", max:10 },
  { id:"tester",   name:"自動テスト機",         stage:"テスト", base:240, desc:"QA +1.2 バグ/分・テスト速度 +6 DP/分/Lv", max:8 },
  { id:"ci",       name:"CIマシン",             stage:"ビルド", base:200, desc:"コイン +10%/Lv・全DP +3%/Lv・ビルド速度 +6 DP/分/Lv", max:10 },
  { id:"pack",     name:"自働梱包機",           stage:"ビルド", base:160, desc:"全DP +4%/Lv・ビルド速度 +5 DP/分/Lv", max:10 },
  { id:"bot",      name:"子ねこボット",         stage:"運搬", base:350, desc:"自動で +2DP/分/Lv（同僚）・出荷速度 +6 DP/分/Lv", max:3 }
];
function upgradeCost(def, lv){ return Math.ceil(def.base * Math.pow(1.15, lv)); }
/* 全DP 倍率: どの強化を買っても、ライン全体（実装と全工程）が目に見えて速くなる
   （理念書4「成長をはっきり体感させる」。v2.8.0 で自分の工程だけに絞ったのは、
   詰まっていない工程の強化が何も変えず、買っても手応えがなかったので戻した）。
   工程ごとの差は、設備の速度（equipDP）と担当スタッフの足し算で付く */
function dpMult(up){
  return 1 + 0.05*(up.keyboard||0) + 0.08*(up.ide||0) + 0.03*(up.ci||0) + 0.04*(up.pack||0);
}
function qaPerMin(up){ return BAL.qaBasePerMin + 0.4*(up.duck||0) + 1.2*(up.tester||0); }

