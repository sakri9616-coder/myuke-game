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
  const mark = document.createElement("span");
  mark.className = "editor-tabmark"; mark.setAttribute("aria-hidden", "true");
  btn.appendChild(mark);
  if(id===currentTab) btn.className = "on";
  btn.onclick = ()=>{ switchTab(id); };
  tabsEl.appendChild(btn);
}
function fmt(n){ return Math.floor(n).toLocaleString("ja-JP"); }
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
  const have = cur === "rp" ? S.rp : cur === "dust" ? S.dust : S.coins;
  const afford = have >= cost;
  const deficit = Math.max(0, Math.ceil(cost - have));
  let st = afford ? "afford" : "far";
  if(!afford && cur !== "dust"){
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
  const unit = cur === "rp" ? "🔬" : cur === "dust" ? "⭐" : "🪙";
  /* メニュー刷新 P1: 価格は金の価格タグとして分離表示 (MENU_REDESIGN_SPEC §4.5) */
  let label = (prefix ? "<span class='buy-act'>" + prefix + "</span>" : "") +
    "<span class='pricetag'>" + fmt(cost) + unit + "</span>";
  let cls = "buybtn";
  if(a.almost){ label += " <span class='ahint'>あと " + fmt(a.deficit) + unit + "</span>"; cls += " almost"; }
  /* 再描画でボタンが作り直されてもパルスが頭から始まり直さないよう、経過時間ぶん位相をずらす */
  let pulseStyle = "";
  if(a.pulse){ cls += " afford-now"; pulseStyle = " style='animation-delay:-" + Math.max(0, Date.now() - (affordPulseAt[key] || 0)) + "ms'"; }
  const dis = (!a.afford || extraDisabled) ? " disabled" : "";
  return "<button class='" + cls + "' onclick='" + onclick + "'" + dis + pulseStyle + ">" + label + "</button>";
}
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
