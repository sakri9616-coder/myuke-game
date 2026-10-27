/* ---------- UI ---------- */
const TABS = [
  ["proj","📋 プロジェクト"], ["staff","👥 スタッフ"], ["factory","🏭 工場"], ["click","👆 応援"],
  ["shelf","📚 作品棚"], ["requests","📮 依頼"], ["research","🔬 研究"], ["stats","📊 統計"], ["settings","⚙️ 設定"]
];
let currentTab = "proj";
const tabsEl = document.getElementById("tabs");
for(const [id,label] of TABS){
  const btn = document.createElement("button");
  btn.textContent = label; btn.dataset.tab = id;
  btn.setAttribute("role", "tab");
  btn.setAttribute("aria-selected", id === currentTab ? "true" : "false");
  const mark = document.createElement("span");
  mark.className = "editor-tabmark"; mark.setAttribute("aria-hidden", "true");
  btn.appendChild(mark);
  if(id===currentTab) btn.className = "on";
  btn.onclick = ()=>{ switchTab(id); };
  tabsEl.appendChild(btn);
}
/* 万進法の表示（再設計 段階0）: 1万未満は従来どおり桁区切りの整数。1万からは 4 桁ごとに単位を
   切り替え、有効数字 3〜4 桁で出す（1.23万・45.6億・789兆…無量大数）。その先は 1.23e72。
   桁区切りのまま並べると兆を超えたあたりで帯に収まらなくなるため。単位の名前自体が成長の手応えになる */
const MAN_UNITS = ["", "万", "億", "兆", "京", "垓", "秭", "穣", "溝", "澗", "正", "載", "極", "恒河沙", "阿僧祇", "那由他", "不可思議", "無量大数"];
function fmt(n){
  if(!isFinite(n)) return String(n);
  if(n < 0) return "-" + fmt(-n);
  if(n < 1e4) return Math.floor(n).toLocaleString("ja-JP");
  const k = Math.min(MAN_UNITS.length - 1, Math.floor(Math.log10(n) / 4));
  const v = n / Math.pow(10, 4 * k);
  if(v >= 1e4) return String(Math.floor(n / Math.pow(10, Math.floor(Math.log10(n)) - 2)) / 100) + "e" + Math.floor(Math.log10(n));
  const d = v < 10 ? 2 : v < 100 ? 1 : 0;
  return String(Math.floor(v * Math.pow(10, d)) / Math.pow(10, d)) + MAN_UNITS[k];
}
/* クリックの DP 表示: 小さいうちは小数1桁、100 以上は桁区切りの整数 */
function fmtClickDP(n){ return n < 100 ? n.toFixed(1) : fmt(n); }
/* 毎秒の量の表示: 10 未満は小数1桁 */
function fmtRate(n){ return n < 10 ? n.toFixed(1) : fmt(Math.round(n)); }
/* 作品の規模の表示名 (内部コード TUT はプレイヤーに見せない) */
function sizeLabel(size){ return size === "TUT" ? "はじめて" : size; }
/* Sprint 2: HUD の数字は実値へイージングで追いつく（線形な即時更新は「機械的で
   死んで見える」ので、増減どちらも少し遅れて滑らかに収束させる） */
const hudShown = { coins: null, ideas: null, packages: null, bugs: null, rp: null, dust: null };
function hudNum(key, target){
  const cur = hudShown[key];
  if(cur === null || typeof cur !== "number"){ hudShown[key] = target; return target; }
  const diff = target - cur;
  if(Math.abs(diff) < 1){ hudShown[key] = target; return target; }
  hudShown[key] = cur + diff * 0.32;
  return hudShown[key];
}
/* ---------- Sprint 3: 「あと○○」ヒントと買える瞬間のパルス ----------
   収入レートは直近約2分の実績（コイン/研究Pの増分）から推定する。
   あと約2分で買える物だけ「あと ○○」を出し、買えるようになった瞬間に
   ボタンを光らせる（音はフル画面を見ている時だけ。帯では絶対に鳴らさない）。 */
let incomeSamples = [];   /* { t, c: coins, r: rp }（ランタイムのみ・保存しない） */
function sampleIncome(now){
  incomeSamples.push({ t: now, c: S.coins, r: S.rp });
  while(incomeSamples.length && now - incomeSamples[0].t > 130000) incomeSamples.shift();
}
function incomeRatePerMin(cur){
  if(incomeSamples.length < 2) return 0;
  const key = cur === "rp" ? "r" : "c";
  const newest = incomeSamples[incomeSamples.length - 1];
  const now = newest.t;
  let oldest = newest;
  for(const s of incomeSamples){ if(now - s.t <= 125000){ oldest = s; break; } }
  const dtMin = (newest.t - oldest.t) / 60000;
  if(dtMin < 0.3) return 0;
  return Math.max(0, (newest[key] - oldest[key]) / dtMin);
}
const affordPrev = {};    /* key -> "far"|"almost"|"afford"（遷移検知用） */
const affordPulseAt = {}; /* key -> 買えるようになった時刻 */
function affordInfo(key, cost, cur){
  const have = cur === "rp" ? S.rp : cur === "dust" ? S.dust : cur === "cheerP" ? (S.cheerP || 0) : S.coins;
  const afford = have >= cost;
  const deficit = Math.max(0, Math.ceil(cost - have));
  let st = afford ? "afford" : "far";
  if(!afford && cur !== "dust" && cur !== "cheerP"){
    const rate = incomeRatePerMin(cur);
    if(rate > 0 && deficit <= rate * 2) st = "almost";
  }
  const prev = affordPrev[key];
  if(prev && prev !== "afford" && st === "afford"){
    affordPulseAt[key] = Date.now();
    /* メニューが見えている時だけ、控えめな「買えるよ」の音を鳴らす
       (閉じて隠れているメニューの裏で鳴らさない) */
    let audible = false;
    try{ audible = !document.body.classList.contains("strip") && !document.hidden; }catch(e){}
    if(audible) SoundKit.play("ready");
  }
  affordPrev[key] = st;
  return { afford, deficit, almost: st === "almost",
           pulse: afford && (Date.now() - (affordPulseAt[key] || 0) < 9000) };
}
/* 購入ボタンの共通生成: 価格＋（あと少しなら）不足分ヒント＋到達パルス */
function buyBtn(key, cost, cur, onclick, extraDisabled?, prefix?){
  const a = affordInfo(key, cost, cur);
  const unit = cur === "rp" ? "🔬" : cur === "dust" ? "⭐" : cur === "cheerP" ? "応援P" : "🪙";
  /* メニュー刷新 P1: 価格は金の価格タグとして分離表示 (MENU_REDESIGN_SPEC §4.5) */
  let label = (prefix ? "<span class='buy-act'>" + prefix + "</span>" : "") +
    "<span class='pricetag'>" + fmt(cost) + unit + "</span>";
  let cls = "buybtn";
  if(a.almost){ label += " <span class='ahint'>あと " + fmt(a.deficit) + unit + "</span>"; cls += " almost"; }
  /* 再描画でボタンが作り直されてもパルスが頭から始まり直さないよう、経過時間ぶん位相をずらす */
  let pulseStyle = "";
  if(a.pulse){ cls += " afford-now"; pulseStyle = " style='animation-delay:-" + Math.max(0, Date.now() - (affordPulseAt[key] || 0)) + "ms'"; }
  const dis = (!a.afford || extraDisabled) ? " disabled" : "";
  /* 読み上げ名: 価格だけ (「46🪙」) では何のボタンか分からないので、操作と不足分も添える */
  const aria = (prefix ? prefix.replace(/<[^>]*>/g, "") : "購入") + " " + fmt(cost) + unit + (a.almost ? "（あと " + fmt(a.deficit) + unit + "）" : "");
  return "<button class='" + cls + "' onclick='" + onclick + "'" + dis + pulseStyle + " aria-label='" + esc(aria) + "'>" + label + "</button>";
}
/* 購入ボタンの長押し: 押している間、加速しながら買えるだけ買う。
   - ボタンは再描画で作り直されるので、要素ではなく onclick の「動詞(引数)」を覚えて買い続ける
   - 1歩ごとに buyMany で n 回まとめて買う (保存・再描画は1歩に1回)。n と間隔は押している長さで増える
   - 長押しが始まったら、指を離した時の click は捨てる (1回余計に買わない)
   - 管理ウィンドウ (viewer) では1歩を1コマンドで帯へ送り、返事が来てから次の歩に進む */
const BUY_HOLD_DELAY = 380;   /* これより長く押したら長押し */
const buyHold = { verb: "", args: null as any[] | null, timer: 0, start: 0, active: false, eatClick: false };
function buyHoldParse(btn){
  const m = /^\s*(\w+)\((.*)\)\s*$/.exec(btn.getAttribute("onclick") || "");
  if(!m || !Object.prototype.hasOwnProperty.call(HOLD_VERBS, m[1])) return null;
  try{ return { verb: m[1], args: JSON.parse("[" + m[2] + "]") }; }catch(e){ return null; }
}
function buyHoldStop(){
  clearTimeout(buyHold.timer);
  buyHold.timer = 0; buyHold.verb = ""; buyHold.args = null;
  buyHold.active = false;
}
function buyHoldStep(){
  if(!buyHold.verb) return;
  buyHold.active = true;
  buyHold.eatClick = true;
  const t = (Date.now() - buyHold.start) / 1000;
  /* 最初の約1秒は1個ずつ、そのあと 0.6秒ごとに倍。間隔も 260ms → 90ms へ縮める */
  const n = t < 1 ? 1 : Math.min(200, Math.ceil(Math.pow(2, (t - 1) / 0.6)));
  const gap = Math.max(90, 260 - t * 170);
  const next = (bought) => {
    if(!buyHold.verb) return;
    if(!(bought >= n)){ buyHoldStop(); return; }   /* 買えなくなったら止める */
    buyHold.timer = setTimeout(buyHoldStep, gap);
  };
  if(IS_VIEWER){
    sendMenuCmd("buyMany", [buyHold.verb, buyHold.args, n], null, (m) => {
      next(m && m.ok && m.payload ? Number(m.payload.value) || 0 : 0);
    });
  } else next(buyMany(buyHold.verb, buyHold.args, n));
}
try{
  document.addEventListener("pointerdown", (e) => {
    buyHoldStop();
    buyHold.eatClick = false;
    if(e.button !== 0) return;
    const btn = e.target && (e.target as HTMLElement).closest ? (e.target as HTMLElement).closest("button.buybtn") as HTMLButtonElement : null;
    if(!btn || btn.disabled) return;
    const p = buyHoldParse(btn);
    if(!p) return;
    buyHold.verb = p.verb; buyHold.args = p.args; buyHold.start = Date.now() + BUY_HOLD_DELAY;
    buyHold.timer = setTimeout(buyHoldStep, BUY_HOLD_DELAY);
  }, true);
  for(const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, () => {
    buyHoldStop();
    /* 押した要素が再描画で消えていると click は来ないので、捨てる指示は少しで失効させる */
    if(buyHold.eatClick) setTimeout(() => { buyHold.eatClick = false; }, 60);
  }, true);
  window.addEventListener("blur", buyHoldStop);
  document.addEventListener("click", (e) => {
    if(!buyHold.eatClick) return;
    buyHold.eatClick = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
  document.addEventListener("contextmenu", (e) => { if(buyHold.verb) e.preventDefault(); }, true);   /* タッチ長押しのメニューを出さない */
}catch(e){}
/* 値が変わった時だけ書く (毎フレーム同じ文字を書き直すとスタイル再計算が走る) */
function setTextIfChanged(id, text){
  const el = document.getElementById(id);
  if(el && el.textContent !== text) el.textContent = text;
}
function renderHeader(){
  renderEditorBreadcrumb();
  setTextIfChanged("r-coins", fmt(hudNum("coins", S.coins)));
  setTextIfChanged("r-ideas", fmt(hudNum("ideas", S.ideas)));
  setTextIfChanged("r-pkg", fmt(hudNum("packages", S.packages)));
  setTextIfChanged("r-bugs", fmt(hudNum("bugs", S.bugStock)));
  setTextIfChanged("r-rp", fmt(hudNum("rp", S.rp)));
  setTextIfChanged("r-dust", fmt(hudNum("dust", S.dust)));
  const cb = document.getElementById("conc-bar");
  if(cb) cb.style.width = Math.round(S.concentration)+"%";
  const pb = document.getElementById("proj-bar");
  if(pb && S.project) pb.style.width =
    Math.min(100, Math.round(S.projectDP / S.project.totalDP * 100)) + "%";
  const pm = document.getElementById("proj-meter");
  /* パルスは明るさで (scale は中心原点で左右にはみ出すため v2.4.7 で廃止 —
     sakuri: 「進捗バー左側に突き出てるぞ」) */
  if(pm) pm.style.filter = (Date.now() < milestonePulseUntil) ? "brightness(1.4)"
    : (Date.now() < progressPulseUntil) ? "brightness(1.18)" : "";
  const plM = document.getElementById("proj-label");
  if(plM) plM.style.color = (Date.now() < milestonePulseUntil) ? "#d9534f" : "";
  const pl = document.getElementById("proj-label");
  if(pl && S.project){
    const p = S.project;
    if(p.planning){
      pl.textContent = "💡 企画中… アイデア あと " + Math.max(0, (p.ideaCost || 0) - Math.floor(S.ideas)) + " 個で着工";
    } else {
      const ft = p.totalDP / (p.feats.length + 1);
      const nextAt = p.doneFeats < p.feats.length ? ft * (p.doneFeats + 1) : p.totalDP;
      pl.textContent = "現在のプロジェクト進捗（次の節目まで あと " +
        Math.max(0, Math.ceil(nextAt - S.projectDP)) + " DP）";
    }
  }
  /* Sprint 3: ボトルネックチップ（詰まりがある時だけプロジェクトパネルに出す。
     クリックで対策の購入行までジャンプする） */
  const bnChip = document.getElementById("bn-chip");
  if(bnChip){
    const bn = currentBottleneck();
    if(bn){
      const txt = "⚠ " + bn.text + " → 対策を見る";
      if(bnChip.textContent !== txt) bnChip.textContent = txt;
      bnChip.style.display = "inline-block";
    } else bnChip.style.display = "none";
  }
  /* IDE 化 (OFFICE P1): ヘッダの診断表示。バグ在庫チップは在庫がある時だけ
     エラー色にし、詰まりは bn-chip と同じ currentBottleneck() を映す
     (新しい判定ロジックは入れない・表示の再配置だけ) */
  const diagBugs = document.getElementById("r-bugs");
  if(diagBugs && diagBugs.parentElement)
    diagBugs.parentElement.classList.toggle("has-bugs", S.bugStock > 0);
  const diagBn = document.getElementById("r-bneck");
  if(diagBn){
    const bnH = currentBottleneck();
    if(bnH){ diagBn.style.display = ""; diagBn.title = bnH.text; }
    else diagBn.style.display = "none";
  }
  /* Stage 3: 節目チップと目的チップは廃止 (情報はリーダーボードと吊りメモへ) */
}
