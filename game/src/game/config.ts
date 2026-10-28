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
  boostLinkRef: 50,         // 再設計 段階2（段階4で 40→50: 強化の列が増えて張り付きが速くなりすぎた分）: 自動生産がこの DP/分を超えたら、入力ブーストの重みと上限を比例して伸ばす
  sizes:     { TUT:120, XS:400, S:900, M:2600, L:7000 },
  coinBase:  { TUT:600, XS:900, S:1500, M:3400, L:7500 },   // 再設計 段階3: ×10（設備・猫が数分〜十数分で元を取る速さに。旧: 猫1匹の元が取れるまで約3時間）
  rpBase:    { TUT:1,   XS:2,   S:2,   M:3,    L:5 },   // 再設計 段階1: 放置で研究が 40〜70分止まっていたので 1/1/2/4 から上げた
  bugPerDP: 0.012,          // DPあたりのバグ混入
  inputBugRate: 0.3,
  /* 再設計 段階1: イベントの報酬は「いまの収入の N 秒ぶん」（従来の式は下限として残す）。
     収入の桁が上がってもイベントの手応えが目減りしない（研究資料: 報酬は収入に連動させ、値段は独自の指数で伸ばす） */
  rewardSec: { fish: 90, bug: 3, sweep: 15, stockBug: 2, treasure: 45 },
  stockBugCoin: 4,          // 在庫バグを手で潰した報酬（×仕事の桁×√潰した匹数）        // 応援クリック・入力ブースト由来の DP のバグ混入倍率
  qaBasePerMin: 0.6,        // テスト工程の基本処理能力 バグ/分
  commitEvery: 100,         // 何DPごとにコミット演出
  valuePerDust: 7e6,        // 再設計 段階3: 星屑1個ぶんの企業価値（1時間の自動収入 🪙）。旧: 開発量 DP で数えていた（prestigeDPPerDust）
  dustValueExp: 2.7,        // 星屑1個ぶんの企業価値 = valuePerDust × 星屑倍率^これ（production.ts の dustValueUnit。インフレ修正）。
                            // sim（放置10日・20個で売る）: 2.5 で2社目以降が7分まで縮み、3.0 で売却が1日1回未満に止まる。2.7 で 2社目以降 約20〜40分
  holdBaseStep: 10,         // 持株化1回ごとに星屑倍率の土台が ×これ（2026-10-28。時代の通算星屑に連動させると速い時代ほど土台が伸びて暴走した・sim）
  holdValueExp: 1.65,       // 持株の土台（S.dustLegacyMult）が企業価値の単位に効く指数（2026-10-28。company.ts の holdBaseNext）。
                            // sim（放置23日）: 1.5 で中盤の持株化が1日に2回まで速まり、2.0 で2回目の持株化が14日目まで遅れる。1.65 で持株化の間隔は修正前とほぼ同じ
  dustSoftcap: 20,          // 1回の売却でこの個数を超えた分は dustGainExp 乗で伸びる
  dustGainExp: 0.5,         // （平方根。0.6 以上だと sim の active で 30 日に星屑 8,000 個超まで暴走した）
  dustPriceExp: 0.5,        // 作品単価には星屑倍率の dustPriceExp 乗で効く
  dustBonus: 0.5,           // 再設計 段階3: 星屑1個の永続ボーナス +50%（旧 +4%・通算100個から平方根）。1回の高効率な売却（20個）で生産 ×11・収入 約 ×36
  scaleRefMin: 10,          // 仕事の桁: M 作品が今の実効スループットでこの分数を下回るほど速くなったら、作品の規模と報酬を 1/2/5/10… 倍に上げる
  stageBaseRate: 80,        // テスト/ビルド/出荷の基本スループット DP/分（再設計 段階3: 30→80。放置の出荷が工程で詰まり、応援で手運びしないと進まなかった）
  equipDP: { tester: 6, ci: 11, pack: 6, bot: 6 },   // 設備 1Lv ごとの工程速度 DP/分（自動テスト機→テスト、CI→ビルド、梱包機・子ねこボット→出荷）
  testStaffDP: 8            // テスター1匹のテスト速度 DP/分
};
/* 再設計 段階5（整理）: 重なっていた設備をまとめた。キーボード＋IDE → 開発環境、CI＋梱包機のビルド → CI 1本
   （梱包機は名前どおり出荷の設備へ）、ラバーダックは在庫バグの相棒（QA は自動テスト機に一本化）、
   ふかふか椅子は見た目の家具（社格で替わる。集中力は総務のお世話係に集約）、ワイドモニターは企画 Lv の上限、
   子ねこボットは上限3を外した */
const UPGRADE_DEFS = [
  { id:"devenv",   name:"開発環境",             stage:"実装", base:60,  desc:"全DP +12%/Lv（キーボードと IDE をひとつに）", max:100, ms:true },
  { id:"monitor",  name:"ワイドモニター",       stage:"実装", base:400, desc:"企画を練れる上限 +1 Lv/Lv", max:3 },
  { id:"duck",     name:"ラバーダック",         stage:"テスト", base:60, desc:"在庫バグを潰すたび、テスト待ちの仕掛品をテスト2秒ぶん/Lv 先へ送る", max:100, ms:true },
  { id:"tester",   name:"自動テスト機",         stage:"テスト", base:240, desc:"QA +1.2 バグ/分・テスト速度 +6 DP/分/Lv", max:100, ms:true },
  { id:"ci",       name:"CIマシン",             stage:"ビルド", base:200, desc:"ビルド速度 +11 DP/分/Lv・全DP +5%/Lv・コイン +10%/Lv", max:100, ms:true },
  { id:"pack",     name:"自働梱包機",           stage:"出荷", base:160, desc:"出荷速度 +6 DP/分/Lv・全DP +3%/Lv", max:100, ms:true },
  { id:"bot",      name:"子ねこボット",         stage:"出荷", base:350, desc:"自動で +2DP/分/Lv（同僚）・出荷速度 +6 DP/分/Lv", max:100, ms:true }
];
function upgradeCost(def, lv){ return Math.ceil(def.base * Math.pow(1.15, lv)); }
/* 再設計 段階4（sakuri 2026-10-27「プレイヤーが各成長要素を選択して自由にビルドできる」）:
   経営方針のプリセットをやめ、収入源ごとに専用の強化の列を置く。どこに積むかで主役が決まる。
   労働＝応援強化（肉球・グローブ）、本社ライン＝設備と開発部、作品棚・営業・子会社＝下の3列。
   レベルは S.upgrades に入り、設備と同じく会社ごと（売却で 0）。価格は設備と同じ 1.15 倍ずつ。
   初期価格は設備の数十倍（安いと張り付きの最初の10分で全部の列が伸び、20分の目安が 6 分に縮んだ・sim） */
const ENGINE_DEFS = [
  { id:"direct", engine:"line",    name:"直販ルート",       base:9000,  max:100, ms:true, desc:"作品の売上（作りながら・リリース時）+10%/Lv。作品棚には効かない" },
  { id:"promo",  engine:"catalog", name:"販促キャンペーン", base:9000,  max:100, ms:true, desc:"作品棚とシリーズの売上 +10%/Lv" },
  { id:"shelfx", engine:"catalog", name:"棚を広げる",       base:15000,  max:20,  desc:"棚に並ぶ作品 +2本/Lv・売れ続ける時間 +10%/Lv" },
  { id:"scout",  engine:"sales",   name:"目利き",           base:9000,  max:100, ms:true, desc:"依頼達成ボーナス +10%/Lv・大型案件の届く確率 +10%/Lv（上限 50%）" },
  { id:"gmgmt",  engine:"subs",    name:"グループ経営",     base:9000,  max:100, ms:true, desc:"子会社の売上 +40%/Lv" }
];
function engineLv(id){ return upEff(S.upgrades, id); }
/* 収入源の名前（内訳の表示と sim の G5 で使う） */
const INCOME_SRCS = { labor:"労働（応援・イベント）", line:"本社ライン", catalog:"作品棚", sales:"営業（依頼ボーナス）", subs:"子会社" };
/* 節目ジャンプ（理念書4「解放ジャンプ」・スケール対価）: 主要な設備と応援強化は Lv 上限を
   100 まで開け、Lv10・25・50・100 に届くたびに、その節目の Lv の半分ぶんの効果が上乗せされる
   （Lv10 で実効 Lv15＝効果 ×1.5、Lv25 で 29.5→42.5 …）。上乗せは足し算なので、節目を越えた後は
   普通に1Lvずつ伸びる。sim 実測（8シード平均）: 節目の倍率を掛け算（×2）にすると 30 日の星屑が
   19 倍、節目の Lv を丸ごと足すと 4〜5 倍まで膨らんだので、半分に留めた（v2.9.0 比 約2倍）。
   価格は 1.15 倍（応援P 払いの肉球・グローブは 1.12 倍）ずつ伸びるので、上限が無いぶん収入の桁に追従する
   シンクになる。旧セーブのレベルはそのまま読める（上限を広げただけ） */
const MILESTONE_LVS = [10, 25, 50, 100];
const MILESTONE_SHARE = 0.5;   /* 節目で上乗せする Lv の割合 */
function milestoneBonus(lv){ let b = 0; for(const c of MILESTONE_LVS) if(lv >= c) b += c * MILESTONE_SHARE; return b; }
function nextMilestone(lv){ return MILESTONE_LVS.find(c => c > lv) || null; }
/* パネル用: 「節目ボーナス +N Lv 分・次は LvM」の一言 */
function milestoneNote(def, lv){
  if(!def.ms) return "";
  const b = milestoneBonus(lv), nx = nextMilestone(lv);
  return "<br>" + (b > 0 ? "節目ボーナス +" + b + "Lv分・" : "") + (nx ? "節目 Lv" + nx + " で +" + (nx * MILESTONE_SHARE) + "Lv分" : "全節目達成");
}
/* 効果の計算に使う実効レベル（レベル ＋ 節目ボーナス） */
function upEff(up, id){ const lv = up[id] || 0; return lv + milestoneBonus(lv); }
/* 全DP 倍率: どの強化を買っても、ライン全体（実装と全工程）が目に見えて速くなる
   （理念書4「成長をはっきり体感させる」。v2.8.0 で自分の工程だけに絞ったのは、
   詰まっていない工程の強化が何も変えず、買っても手応えがなかったので戻した）。
   工程ごとの差は、設備の速度（equipDP）と担当スタッフの足し算で付く */
function dpMult(up){
  return 1 + 0.12*upEff(up, "devenv") + 0.05*upEff(up, "ci") + 0.03*upEff(up, "pack");
}
function qaPerMin(up){ return BAL.qaBasePerMin + 1.2*upEff(up, "tester"); }

