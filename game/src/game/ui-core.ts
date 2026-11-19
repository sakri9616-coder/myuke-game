/* ---------- UI ---------- */
/* 並びはよく開く順 (2026-10-27 sakuri: アクセス頻度でタブ分け)。統計・設定は低頻度。
   子会社は 2026-10-28 sakuri の指示でスタッフから独立したタブ (並びはスタッフの隣) */
const TABS = [
  ["proj","📋 プロジェクト"], ["factory","🏭 工場"], ["staff","👥 スタッフ"], ["subs","🏢 子会社"], ["click","👆 応援"],
  ["requests","📮 依頼"], ["research","🔬 研究"], ["shelf","📚 作品棚"], ["stats","📊 統計"], ["howto","📖 遊び方"], ["settings","⚙️ 設定"]
];
let currentTab = "proj";   /* 分割ビューでは「今のグループ」の表のタブ */
let layoutLive = false;    /* 分割ビューが組み上がったか (ui-layout)。false なら従来の1枚表示 */
let menuLayout = null;
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
/* SI 接頭辞風の表示: 1000 未満は整数のまま。1000 からは 3 桁ごとに k・m・g・t・p・e と単位を
   切り替え、有効数字 3 桁で出す（1.23k・45.6m・789g…）。e（10^18）の先は 1.23e21 の指数表記。
   桁区切りのまま並べると帯に収まらなくなるため。単位の繰り上がり自体が成長の手応えになる */
const SI_UNITS = ["", "k", "m", "g", "t", "p", "e"];
function fmt(n){
  if(!isFinite(n)) return String(n);
  if(n < 0) return "-" + fmt(-n);
  if(n < 1e3) return String(Math.floor(n));
  let e = Math.floor(Math.log10(n));
  if(n / Math.pow(10, e) >= 10) e++;   /* log10 の丸め誤差で 1 桁小さく出る境目の補正 */
  const k = Math.floor(e / 3);
  if(k >= SI_UNITS.length) return String(Math.floor(n / Math.pow(10, e - 2)) / 100) + "e" + e;
  const v = n / Math.pow(10, 3 * k);
  const d = v < 10 ? 2 : v < 100 ? 1 : 0;
  return String(Math.floor(v * Math.pow(10, d) + 1e-9) / Math.pow(10, d)) + SI_UNITS[k];
}
/* 小数つきの量・倍率の表示: 1000 未満は小数 d 桁、それ以上は fmt と同じ単位表記 */
function fmtDec(n, d){ return Math.abs(n) < 1e3 ? n.toFixed(d) : fmt(n); }
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
function buyBtn(key, cost, cur, onclick, extraDisabled?, prefix?, steps?){
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
  /* +50/+100 の合計が埋まっている時は、長押しポップアップ用のデータをボタンに持たせる (常設のボタンにはしない) */
  let bulkAttr = "";
  if(steps && (steps.c50 != null || steps.c100 != null)){
    const bi = bulkInfoOf(steps.onclick || onclick, cur, steps);
    if(bi) bulkAttr = " data-bulk='" + esc(JSON.stringify(bi)) + "'";
  }
  const btn = "<button class='" + cls + "' onclick='" + onclick + "'" + dis + pulseStyle + bulkAttr + " aria-label='" + esc(aria) + "'>" + label + "</button>";
  return steps ? "<span class='buypair'>" + btn + maxBtn(steps.onclick || onclick, dis) + "</span>" : btn;
}
/* 「最大」: 右隣の素ボタンで、同じ購入を買えるだけ一括で買う (長押しと同じ buyMany を1回だけ呼ぶ)。
   管理ウィンドウでは buyMany がコマンドの送り口なので、そのまま帯へ1コマンドで届く */
const BUY_MAX_N = 1000;
function maxBtn(onclick, dis){
  const m = /^\s*(\w+)\((.*)\)\s*$/.exec(onclick);
  if(!m) return "";
  return "<button class='buybtn maxbtn' onclick='buyMany(" + JSON.stringify(m[1]) + ",[" + m[2] + "]," + BUY_MAX_N + ")'" + dis +
    " aria-label='買えるだけ買う' title='買えるだけ買う'>最大</button>";
}
/* onclick 文字列 "動詞(引数)" を { v, a } に分解する */
function parseOnclick(onclick){
  const m = /^\s*(\w+)\((.*)\)\s*$/.exec(onclick || "");
  if(!m) return null;
  let args;
  try{ args = JSON.parse("[" + m[2] + "]"); }
  catch(e){
    args = m[2].trim() ? m[2].split(",").map(s => {
      s = s.trim();
      const q = /^'(.*)'$/.exec(s) || /^"(.*)"$/.exec(s);
      if(q) return q[1];
      const n = Number(s);
      return isNaN(n) ? s : n;
    }) : [];
  }
  return { v: m[1], a: args };
}
/* 長押しポップアップ用の購入データ: 対象の動詞・引数・通貨と、+50/+100 の合計価格。
   steps.onclick があれば本体と別の動詞に向けられる (一括育成: 本体は全員+1Lv の全額必須、
   ポップアップ側は安い順に配る bulkTrainStep) */
function bulkInfoOf(onclick, cur, steps){
  const p = parseOnclick(onclick);
  if(!p) return null;
  return { v: p.v, a: p.a, cur, c50: steps.c50 != null ? steps.c50 : null, c100: steps.c100 != null ? steps.c100 : null };
}
/* ステップの合計価格: 残り回数 rem が n に満たない購入肢は出さない (届かない回数の合計は見せない)。
   costAt(i) は「これから i 回目 (0 始まり)」の価格。両肢とも無い場合は空オブジェクトを返し、
   呼び出し側には「最大」だけが付く (雇用を上限まで埋める・上限の近い強化の買い切り用) */
function stepCosts(rem, costAt){
  const o: { c50?: number; c100?: number } = {};
  if(rem >= 50){ let t = 0; for(let i = 0; i < 50; i++) t += costAt(i); o.c50 = t; }
  if(rem >= 100){ let t = 0; for(let i = 0; i < 100; i++) t += costAt(i); o.c100 = t; }
  return o;
}
/* 一括育成ステップの合計価格: 安い順配分 (bulkTrainStep) をレベルの写しで模擬して数える */
function bulkStepCosts(){
  const sim = S.staff.map(s => ({ role: s.role, lv: s.lv || 1 }));
  const total = (n) => {
    const cp = sim.map(s => ({ ...s }));
    let t = 0;
    for(let k = 0; k < n; k++){
      let bi = -1, bc = Infinity;
      for(let i = 0; i < cp.length; i++){ const c = trainCost(cp[i] as any); if(c < bc){ bc = c; bi = i; } }
      if(bi < 0) break;
      t += bc; cp[bi].lv++;
    }
    return t;
  };
  return { c50: total(50), c100: total(100) };
}
/* 購入ボタンの長押しまとめ買い (2026-11-19 sakuri 指示「購入長押し→ドラッグ→50か100か」。
   ポップアップ型・ラジアル型は廃止し、四角ボタンに統一。ボタンをむやみに増やさないための形で、
   旧・長押し連打買いはこのジェスチャに置き換えた):
   - data-bulk を持つ購入ボタンだけが対象 (合計価格は描画時に buyBtn が埋める)。「最大」は従来どおり隣の素ボタン
   - 元ボタンの真上に buybtn と同じ見た目の +50 / +100 ボタンが浮く (出現・格納アニメーション付き)。
     元ボタンの上で離せば1回買い (通常クリックと同じ)
   - 380ms 押し続けたらボタンを出す。押したまま動かしてボタンに合わせ、離すとその回数ぶん買う
   - ボタンの上で離さなければ買わない (キャンセル)。合計が払えないボタンは選べない
   - ボタンを出したら、離した拍子の click は捨てる (1回余計に買わない)
   - 管理ウィンドウ (viewer) では buyMany を1コマンドで帯へ送る */
const BULK_POP_DELAY = 380;   /* これより長く押したら長押し */
const bulkPop = { info: null as any, btn: null as any, el: null as any, rows: null as any[] | null, hot: -1, timer: 0, pending: false, open: false, eatClick: false, sx: 0, sy: 0, rect: null as any, onclickStr: "" };
function bulkPopRows(info){
  const unit = info.cur === "rp" ? "🔬" : info.cur === "dust" ? "⭐" : info.cur === "cheerP" ? "応援P" : "🪙";
  const rows = [];
  for(const pair of [[50, info.c50], [100, info.c100]]){
    if(pair[1] == null) continue;
    rows.push({ n: pair[0], total: pair[1], ok: affordInfo("", pair[1], info.cur).afford, price: fmt(pair[1]) + unit });
  }
  return rows;
}
function bulkPopCancelPending(){
  clearTimeout(bulkPop.timer);
  bulkPop.timer = 0; bulkPop.pending = false;
}
function bulkPopClose(){
  const el = bulkPop.el;
  bulkPop.el = null; bulkPop.open = false; bulkPop.hot = -1;
  if(bulkPop.btn && bulkPop.btn.isConnected){ bulkPop.btn.classList.remove("bulk-src"); bulkPop.btn.classList.remove("bulk-hot"); }
  if(!el) return;
  /* 格納アニメーション: 元ボタンへ吸い込まれるように縮んで消える */
  if(el.animate){
    const a = el.animate(
      [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.55)", opacity: 0 }],
      { duration: 110, easing: "ease-in" });
    a.onfinish = () => el.remove();
    setTimeout(() => el.remove(), 200);   /* onfinish が来ない環境向けの保険 */
  } else el.remove();
}
function bulkPopOpen(btn, info){
  bulkPopClose();
  const opts = bulkPopRows(info);
  if(!opts.length) return;
  /* ボタンは再描画で作り直されることがあるので、生きていれば現在の位置、消えていれば押した時点の位置を使う */
  const br = (btn && btn.isConnected) ? btn.getBoundingClientRect() : bulkPop.rect;
  /* 先頭 (index 0) は元ボタン自身のゾーン: 枠は出さず、離せば1回買いになる */
  const rows = [{ n: 1, ok: true, rect: { left: br.left, right: br.right, top: br.top, bottom: br.bottom } }];
  const el = document.createElement("div");
  el.id = "bulkfloat";
  el.style.visibility = "hidden";
  /* フォントは元ボタンの computed style をそのまま使う (body 直下に出すので、パネルのフォント指定が継承されない) */
  const cs = getComputedStyle(btn);
  el.style.fontFamily = cs.fontFamily; el.style.fontSize = cs.fontSize;
  el.style.fontWeight = cs.fontWeight; el.style.fontStyle = cs.fontStyle;
  el.style.letterSpacing = cs.letterSpacing; el.style.lineHeight = cs.lineHeight;
  el.innerHTML = opts.map((r, k) => "<div class='buybtn bulkfloat-btn" + (r.ok ? "" : " dis") + "' data-i='" + (k + 1) + "'><span class='buy-act'>+" + r.n + "</span><span class='pricetag'>" + r.price + "</span></div>").join("<span class='bulkfloat-sep'></span>");
  document.body.appendChild(el);
  const fr = el.getBoundingClientRect();
  let x = Math.min(Math.max(6, br.left + br.width / 2 - fr.width / 2), window.innerWidth - fr.width - 6);
  let y = br.top - fr.height - 4;
  const below = y < 6;
  if(below) y = br.bottom + 4;
  el.style.left = x + "px"; el.style.top = y + "px";
  el.style.transformOrigin = (br.left + br.width / 2 - x) + "px " + (below ? "0" : "100%");
  el.style.visibility = "";
  el.querySelectorAll(".bulkfloat-btn").forEach((btnEl, k) => {
    const r = btnEl.getBoundingClientRect();
    rows.push({ n: opts[k].n, ok: opts[k].ok, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom } });
    /* 出現アニメーション: 元ボタンの側から少し浮き上がって開く */
    if((btnEl as HTMLElement).animate) (btnEl as HTMLElement).animate(
      [{ transform: "translateY(" + (below ? "-6px" : "6px") + ") scale(.7)", opacity: 0 }, { transform: "none", opacity: 1 }],
      { duration: 140, delay: k * 30, easing: "cubic-bezier(.2,.9,.3,1.2)", fill: "backwards" });
  });
  if(btn && btn.isConnected) btn.classList.add("bulk-src");
  bulkPop.el = el; bulkPop.rows = rows; bulkPop.open = true; bulkPop.hot = -1;
}
function bulkPopHotAt(x, y){
  if(!bulkPop.rows) return -1;
  for(let i = 0; i < bulkPop.rows.length; i++){
    const r = bulkPop.rows[i].rect;
    if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return bulkPop.rows[i].ok ? i : -1;
  }
  return -1;
}
function bulkPopPaint(){
  if(bulkPop.btn && bulkPop.btn.isConnected) bulkPop.btn.classList.toggle("bulk-hot", bulkPop.hot === 0);
  if(!bulkPop.el) return;
  bulkPop.el.querySelectorAll(".bulkfloat-btn").forEach(btnEl =>
    btnEl.classList.toggle("hot", Number(btnEl.getAttribute("data-i")) === bulkPop.hot));
}
function bulkPopBuy(i){
  const info = bulkPop.info, row = bulkPop.rows && bulkPop.rows[i];
  const onclickStr = bulkPop.onclickStr, btn = bulkPop.btn;
  const menuRect = bulkPop.el ? bulkPop.el.getBoundingClientRect() : null;
  bulkPopClose();
  if(!info || !row) return;
  if(row.n === 1){
    /* ボタンそのものの行: 通常クリックと同じ経路で1回買う (再描画で元の要素が消えていたら同じ onclick の現行ボタンを探す)。
       eatClick は合成 click を守るために一時的に下ろし、離した拍子の実 click を捨てるため直後に戻す */
    let target = (btn && btn.isConnected) ? btn : null;
    if(!target && onclickStr) document.querySelectorAll("button.buybtn").forEach(b => {
      if(!target && b.getAttribute("onclick") === onclickStr) target = b;
    });
    if(target){
      bulkPop.eatClick = false;
      (target as HTMLButtonElement).click();
      bulkPop.eatClick = true;
    } else {
      const p = parseOnclick(onclickStr);
      if(p && VERBS[p.v]){
        if(IS_VIEWER) sendMenuCmd(p.v, p.a, null, null);
        else VERBS[p.v].apply(null, p.a);
      }
    }
    return;
  }
  if(IS_VIEWER) sendMenuCmd("buyMany", [info.v, info.a, row.n], null, null);
  else buyMany(info.v, info.a, row.n);
  floatBuyText(menuRect, "+" + row.n, true);
  popButtonLater(onclickStr, 0);
}
try{
  document.addEventListener("pointerdown", (e) => {
    bulkPopCancelPending();
    if(bulkPop.open) bulkPopClose();
    bulkPop.eatClick = false;
    if(e.button !== 0) return;
    const btn = e.target && (e.target as HTMLElement).closest ? (e.target as HTMLElement).closest("button.buybtn") as HTMLButtonElement : null;
    if(!btn || btn.disabled) return;
    const raw = btn.getAttribute("data-bulk");
    if(!raw) return;
    let info; try{ info = JSON.parse(raw); }catch(err){ return; }
    bulkPop.info = info; bulkPop.btn = btn; bulkPop.pending = true;
    bulkPop.onclickStr = btn.getAttribute("onclick") || "";
    bulkPop.sx = e.clientX; bulkPop.sy = e.clientY; bulkPop.rect = btn.getBoundingClientRect();
    bulkPop.timer = setTimeout(() => { bulkPop.pending = false; bulkPop.eatClick = true; bulkPopOpen(btn, info); }, BULK_POP_DELAY);
  }, true);
  document.addEventListener("pointermove", (e) => {
    if(bulkPop.pending && Math.hypot(e.clientX - bulkPop.sx, e.clientY - bulkPop.sy) > 12) bulkPopCancelPending();
    if(bulkPop.open){ bulkPop.hot = bulkPopHotAt(e.clientX, e.clientY); bulkPopPaint(); }
  }, true);
  for(const ev of ["pointerup", "pointercancel"]) document.addEventListener(ev, (e) => {
    bulkPopCancelPending();
    if(bulkPop.open){
      const h = ev === "pointerup" ? bulkPopHotAt((e as PointerEvent).clientX, (e as PointerEvent).clientY) : -1;
      if(h >= 0) bulkPopBuy(h); else bulkPopClose();
    }
    /* 押した要素が再描画で消えていると click は来ないので、捨てる指示は少しで失効させる */
    if(bulkPop.eatClick) setTimeout(() => { bulkPop.eatClick = false; }, 60);
  }, true);
  window.addEventListener("blur", () => { bulkPopCancelPending(); bulkPopClose(); });
  document.addEventListener("keydown", (e) => { if((e as KeyboardEvent).key === "Escape"){ bulkPopCancelPending(); bulkPopClose(); } }, true);
  document.addEventListener("click", (e) => {
    if(!bulkPop.eatClick) return;
    bulkPop.eatClick = false;
    e.stopPropagation(); e.preventDefault();
  }, true);
  document.addEventListener("contextmenu", (e) => { if(bulkPop.pending || bulkPop.open) e.preventDefault(); }, true);   /* タッチ長押しのメニューを出さない */
}catch(e){}
/* ===== 購入フィードバックのアニメーション (2026-11-19 sakuri 指示「メニューと購入にアニメーション」) =====
   時間の階段は CSS の --dur-1〜4 と同じ 80/120/180/300ms に揃える。パネルは再描画が多いので、
   アニメは body 直下のオーバーレイ (浮き文字) か、再描画後の要素への WAAPI (ポップ) で付ける。
   reduced-motion の時は全部止める */
const RMQ = (() => { try{ return window.matchMedia("(prefers-reduced-motion: reduce)"); }catch(e){ return null; } })();
function motionOK(){ return !RMQ || !RMQ.matches; }
/* 買ったボタン (または長押しメニュー) の位置から +N の浮き文字を出す */
function floatBuyText(rect, text, big){
  if(!motionOK() || !rect) return;
  try{
    const el = document.createElement("div");
    el.className = "buyfloat" + (big ? " big" : "");
    el.textContent = text;
    el.style.left = (rect.left + rect.width / 2) + "px";
    el.style.top = (rect.top - 4) + "px";
    document.body.appendChild(el);
    const anim = el.animate([
      { transform: "translate(-50%,-100%)", opacity: 1 },
      { transform: "translate(-50%,calc(-100% - 26px))", opacity: 0 }
    ], { duration: 650, easing: "cubic-bezier(.2,.7,.3,1)" });
    if(anim) anim.onfinish = () => el.remove();
    setTimeout(() => { if(el.parentNode) el.remove(); }, 900);
  }catch(e){}
}
/* 再描画後の同じボタンにポップを付ける (onclick 文字列で照合。viewer の反映待ちも拾うよう少し粘る) */
function popButtonLater(onclickStr, tries){
  if(!motionOK() || !onclickStr) return;
  let found = null;
  document.querySelectorAll("button.buybtn").forEach(b => {
    if(!found && b.getAttribute("onclick") === onclickStr) found = b;
  });
  if(found){
    (found as HTMLElement).animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.07)", offset: .35 }, { transform: "scale(1)" }],
      { duration: 180, easing: "cubic-bezier(.2,.9,.3,1.2)" });
    return;
  }
  if((tries || 0) < 12) setTimeout(() => popButtonLater(onclickStr, (tries || 0) + 1), 40);
}
/* 通常の購入クリック: 浮き文字 + ポップ。「最大」(buyMany) は浮き文字なしでポップだけ */
try{
  document.addEventListener("click", (e) => {
    if(bulkPop.open || bulkPop.pending) return;   /* 長押し購入は bulkPopBuy 側で出す */
    const t = e.target as HTMLElement;
    const btn = t && t.closest ? (t.closest("button.buybtn") as HTMLElement) : null;
    if(!btn || (btn as HTMLButtonElement).disabled) return;
    const oc = btn.getAttribute("onclick") || "";
    if(oc.indexOf("buyMany(") < 0) floatBuyText(btn.getBoundingClientRect(), "+1", false);
    popButtonLater(oc, 0);
  }, true);
}catch(e){}

/* 説明文は「遊び方」タブに集約した (sakuri 指示 2026-11-20)。作業タブのカードに残すのは
   節目予告などの機能情報だけ — 中身が空なら行そのものを出さない */
function dsLine(html){ return html ? "<div class='ds'>" + html + "</div>" : ""; }
/* 値が変わった時だけ書く (毎フレーム同じ文字を書き直すとスタイル再計算が走る) */
function setTextIfChanged(id, text){
  const el = document.getElementById(id);
  if(el && el.textContent !== text) el.textContent = text;
}
/* ヘッダー数字のロールは hudNum が毎フレーム 0.32 ずつ寄せる既存の平滑化が担っている
   (生産の微増は即時に見え、購入・売却の大きな出入りだけが目に見えて流れる)。
   2026-11-19 に専用ローラーを足しかけて二重平滑になったのでやめた */
function renderHeader(){
  renderEditorBreadcrumb();
  setTextIfChanged("r-coins", fmt(hudNum("coins", S.coins)));
  setTextIfChanged("r-ideas", fmt(hudNum("ideas", S.ideas)));
  setTextIfChanged("r-pkg", fmt(hudNum("packages", S.packages)));
  setTextIfChanged("r-bugs", fmt(hudNum("bugs", S.bugStock)));
  setTextIfChanged("r-rp", fmt(hudNum("rp", S.rp)));
  setTextIfChanged("r-dust", fmt(hudNum("dust", S.dust)));
  const cb = document.getElementById("conc-bar");
  if(cb) cb.style.width = Math.min(100, Math.round(S.concentration))+"%";
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
        fmt(Math.max(0, Math.ceil(nextAt - S.projectDP))) + " DP）";
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
  /* レーン生産効率 (2026-11-20 sakuri 指示): 常時参照したい情報は青色帯に小型で置く。
     詰まっている工程は色+▼で示す。プロジェクトが無い・生産ゼロの間は出さない */
  const lanesEl = document.getElementById("r-lanes");
  if(lanesEl){
    let html = "";
    try{
      const prod = productionRate();
      if(S.project || prod > 0){
        const bn = bottleneckStage();
        const parts = [["生産", prod, ""], ["テスト", testRate() * bugFactor(), "test"], ["ビルド", buildRate(), "build"], ["出荷", shipRate(), "ship"]];
        html = "🏭 " + parts.map(p => {
          const t = p[0] + " " + fmtRate(p[1]) + "/分";
          return (bn.isBn && p[2] && bn.worst.id === p[2]) ? "<span class='lane-bn'>" + t + "▼</span>" : t;
        }).join(" ・ ");
      }
    }catch(e){ html = ""; }
    if(html){ lanesEl.style.display = ""; if(lanesEl.innerHTML !== html) lanesEl.innerHTML = html; }
    else lanesEl.style.display = "none";
  }
  /* Stage 3: 節目チップと目的チップは廃止 (情報はリーダーボードと吊りメモへ) */
}
