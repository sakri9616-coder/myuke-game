/* ---------- Sprint 3: ライン信号機とボトルネックの1クリック対策 ----------
   ランプの意味: 緑=流れている / 黄=素材待ち（飢え）または溜まり気味 /
   赤=止まっている（バグ詰まり・在庫飽和で下流が捌けない）。
   第2ラインはテスト/ビルド/出荷の処理能力を第1ラインと共有するので、
   ランプとバーは両ライン合算の流れ・在庫で判定する（仕掛品表示も合算）。 */
function bottleneckStage(){
  const prod = productionRate();
  const stages = [
    { id:"test", name:"テスト", rate: testRate() * bugFactor() },
    { id:"build", name:"ビルド", rate: buildRate() },
    { id:"ship", name:"出荷", rate: shipRate() }
  ];
  let worst = stages[0];
  for(const s of stages) if(s.rate < worst.rate) worst = s;
  return { prod, worst, isBn: worst.rate < prod };
}
function bottleneckInfo(){
  const b = bottleneckStage();
  return { prod: b.prod, worst: { name: b.worst.name, rate: b.worst.rate }, isBn: b.isBn };
}
/* Sprint 4: 企画ランプの進み具合は「次の着工に必要なアイデア」基準 (C2-P2-2)。
   /10 固定だと序盤は常時満タン・終盤は常時空っぽで嘘になっていた */
function planFrac(){
  const cost = (S.project && S.project.planning) ? (S.project.ideaCost || 0)
    : (IDEA_COST[S.project ? S.project.size : "S"] || 0);
  if(cost <= 0) return 1;
  return Math.min(1, S.ideas / cost);
}
function stageStatus(){
  const bugF = bugFactor();
  const inflow = productionRate();
  const tEff = testRate() * bugF, bR = buildRate(), sR = shipRate();
  const wCode = S.wip.code, wTested = S.wip.tested, wBuilt = S.wip.built;
  /* バーの容量 = 下流が約2分で捌ける量（最低60DP）。満杯=飽和の目安 */
  const capCode = Math.max(60, tEff * 2), capTested = Math.max(60, bR * 2), capBuilt = Math.max(60, sR * 2);
  const planning = !!(S.project && S.project.planning);
  let codeLamp = "green";
  if(wCode >= capCode && tEff < inflow) codeLamp = "red";
  else if(inflow <= 0.01) codeLamp = "yellow";
  let testLamp = "green";
  if(S.bugStock > 8 && bugF <= 0.85) testLamp = "red";
  else if(wCode <= 0.01) testLamp = "yellow";
  else if(wTested >= capTested && bR < tEff) testLamp = "yellow";
  let buildLamp = "green";
  if(wBuilt >= capBuilt && sR < bR * 0.6) buildLamp = "red";
  else if(wTested <= 0.01 || (wBuilt >= capBuilt && sR < bR)) buildLamp = "yellow";
  let shipLamp = "green";
  if(wBuilt <= 0.01 || (S.project && S.project.planning)) shipLamp = "yellow";
  return [
    { id:"plan",  name:"企画",   lamp: planning ? "yellow" : "green", frac: planFrac() },
    { id:"code",  name:"実装",   lamp: codeLamp,  frac: Math.min(1, wCode / capCode) },
    { id:"test",  name:"テスト", lamp: testLamp,  frac: Math.min(1, wTested / capTested) },
    { id:"build", name:"ビルド", lamp: buildLamp, frac: Math.min(1, wBuilt / capBuilt) },
    { id:"ship",  name:"出荷",   lamp: shipLamp,  frac: S.project ? Math.min(1, S.projectDP / S.project.totalDP) : 0 }
  ];
}
/* いま一番の詰まり（チップ表示用）。なければ null */
function currentBottleneck(){
  if(S.bugStock > 8 && bugFactor() <= 0.85)
    return { stage:"test", reason:"bug",
      text: "テストがバグで詰まり中（バグ在庫 " + Math.floor(S.bugStock) + "匹）" };
  const b = bottleneckStage();
  if(b.isBn){
    return { stage: b.worst.id, reason:"rate",
      text: b.worst.name + "がボトルネック（" + Math.floor(b.worst.rate) + " DP/分）" };
  }
  return null;
}
/* 詰まり → 直し方（開くタブと、光らせる購入行 data-fix）の解決 */
function bottleneckFix(){
  const bn = currentBottleneck();
  if(!bn) return null;
  const upFree = id => { const d = UPGRADE_DEFS.find(u => u.id === id); return d && (S.upgrades[id] || 0) < d.max; };
  if(bn.stage === "test"){
    if(upFree("tester")) return { tab:"factory", fix:"up:tester" };
    return { tab:"staff", fix:"hire:test" };
  }
  if(bn.stage === "build"){
    if(upFree("ci")) return { tab:"factory", fix:"up:ci" };
    return { tab:"staff", fix:"hire:prog" };
  }
  if(bn.stage === "ship"){
    if(upFree("pack")) return { tab:"factory", fix:"up:pack" };
    if(upFree("bot")) return { tab:"factory", fix:"up:bot" };
    return { tab:"staff", fix:"hire:carry" };
  }
  return { tab:"factory", fix:null };
}
function switchTab(id){
  currentTab = id;
  tutVisitTab(id);   /* チュートリアル: 🆕 は初回訪問で消える (viewer ではコマンド化される) */
  renderPanel();
  paintTabs();
}
/* タブの見た目を状態から塗り直す: 現在タブの "on" + ロック中の
   シルエット (locked クラス + 🔒 ピン)。renderPanel の末尾からも呼ばれる */
function paintTabs(){
  try{
    for(const x of tabsEl.children){
      const id = (x as HTMLElement).dataset && (x as HTMLElement).dataset.tab;
      const locked = tutTabLocked(id);
      x.className = (id === currentTab ? "on" : "") + (locked ? " locked" : "");
      x.setAttribute("aria-selected", id === currentTab ? "true" : "false");
      let lk = null;
      for(const c of x.children) if(c.className === "tab-lockic") lk = c;
      if(locked && !lk){
        lk = document.createElement("span"); lk.className = "tab-lockic"; lk.textContent = "🔒";
        x.appendChild(lk);
      }
      if(lk) lk.style.display = locked ? "" : "none";
    }
  }catch(e){}
}
function gotoBottleneckFix(){
  const fix = bottleneckFix();
  if(!fix){ switchTab("factory"); return; }
  switchTab(fix.tab);
  if(!fix.fix) return;
  try{
    let el = document.querySelector("#panel [data-fix='" + fix.fix + "']");
    /* IA コンパクト化: 対策の購入行が閉じた折りたたみの中にある場合は先に開く
       （折りたたみは見た目だけの畳み込みで、機能を塞がないための連動） */
    if(el && el.closest){
      const fd = el.closest("[data-fold]");
      if(fd && fd.classList && fd.classList.contains("closed")){
        panelFold[fd.getAttribute("data-fold")] = true;
        renderPanel();
        el = document.querySelector("#panel [data-fix='" + fix.fix + "']");
      }
    }
    if(el){
      if(el.scrollIntoView) el.scrollIntoView({ block:"center" });
      el.classList.add("flash");
      setTimeout(() => { try{ el.classList.remove("flash"); }catch(e){} }, 3200);
    }
  }catch(e){}
}
/* Decorative editor path only: reuse the selected tab and live display state.
   textContent keeps project names inert; no timers, commands or saved fields. */
function renderEditorBreadcrumb(){
  if(document.body.classList.contains("strip")) return;
  const tabEl = document.getElementById("editor-breadcrumb-tab");
  const contextEl = document.getElementById("editor-breadcrumb-context");
  if(!tabEl || !contextEl) return;
  const selected = TABS.find(t => t[0] === currentTab);
  const label = selected ? selected[1] : "";
  const context = (IS_VIEWER && !viewerSynced) ? "同期中…"
    : tutTabLocked(currentTab) ? "🔒 解放条件"
    : currentTab === "staff" ? companyRank() + " " + S.staff.length + "/" + staffCap() + "人"
    : currentTab === "research" ? "研究P " + fmt(S.rp)
    : currentTab === "settings" ? GAME_VERSION
    : (S.project ? S.project.name : "—");
  if(tabEl.textContent !== label) tabEl.textContent = label;
  if(contextEl.textContent !== context) contextEl.textContent = context;
}
/* 段階4: 収入源ごとの強化の列（作品棚・営業・子会社）。行の形は設備と同じ */
function engineRowsHTML(engine){
  let h = "";
  for(const def of ENGINE_DEFS.filter(d => d.engine === engine)){
    const lv = S.upgrades[def.id] || 0, maxed = lv >= def.max;
    h += "<div class='item buy slim' data-fix='eng:" + def.id + "'><div><span class='nm'>" + def.name + "</span> <span class='lvbadge'>Lv" + lv + "</span>" +
      "<div class='ds'>" + def.desc + milestoneNote(def, lv) + "</div></div>" +
      (maxed ? "<span class='tagchip'>MAX</span>" : buyBtn("eng:" + def.id, upgradeCost(def, lv), "coins", "buyEngine(\"" + def.id + "\")")) + "</div>";
  }
  return h;
}
/* 段階4: この会社の収入の内訳（どの収入源が主役か）。何も稼いでいないうちは出さない */
function incomeBreakdownHTML(){
  const by = S.incomeBy || {}, tot = Object.keys(INCOME_SRCS).reduce((a, k) => a + (by[k] || 0), 0);
  if(!(tot > 0)) return "";
  const main = mainIncomeSrc();
  let rows = "";
  for(const k of Object.keys(INCOME_SRCS)){
    const pct = Math.round((by[k] || 0) / tot * 100);
    rows += "<div style='display:flex;align-items:center;gap:6px;font-size:12px;margin-top:3px'><span style='min-width:150px'>" + (k === main ? "👑 " : "") + INCOME_SRCS[k] + "</span>" +
      "<div class='meter' style='flex:1;height:8px'><i style='width:" + pct + "%'></i></div><b style='min-width:38px;text-align:right'>" + pct + "%</b></div>";
  }
  return foldSec("income", false, "💰 収入の内訳（この会社）", "主役: " + (main ? INCOME_SRCS[main] : "―"), rows +
    "<div class='note' style='font-size:11.5px;margin-top:4px'>どの収入源に強化を積むかで主役が変わります（労働＝応援タブ、本社ライン＝工場とスタッフ、作品棚・営業・子会社＝各タブの強化）</div>");
}
function renderPanel(){
  if(quietBuy) return;   /* 長押し連続購入の途中は描かない (最後に buyMany が1回描く) */
  renderEditorBreadcrumb();
  const el = document.getElementById("panel");
  /* 2ウィンドウ化: viewer は初回スナップショットが届くまで実データと
     誤認させない (freshState のゼロを本物の状態として見せない。設計 §3.2) */
  if(IS_VIEWER && !viewerSynced){
    panelLastHTML = null;
    el.innerHTML = "<div class='note' style='margin-top:14px'>🐱 帯と同期中…（帯ウィンドウから状態が届くまでお待ちください）</div>";
    return;
  }
  /* チュートリアル導線: ロック中のタブは中身の代わりにシルエット +
     ビジュアル条件 (アイコン+メーター+現在/必要数) のパネルを出す。
     タブ自体は常に見えている (存在を隠さない) */
  if(tutTabLocked(currentTab)){
    panelLastHTML = null;
    el.innerHTML = tutLockPanelHTML(currentTab);
    updateTabBadges();
    paintTabs();
    return;
  }
  let h = "";
  if(currentTab === "proj"){
    /* Strip Canon: 旧ステージカードの常設UIはここへ移設（部屋シーンは廃止、
       管理画面はパネルのみ = R11）。ID は renderHeader / say が参照する既存契約を維持 */
    h += "<div id='bubble'><span class='who'>みゅけ</span>：<span id='bubble-text'>" +
      (lastSayText || "おはよ、続きやるね。").replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span></div>";
    h += "<div id='combo-info'></div>";
    h += "<button id='bn-chip' type='button' onclick='gotoBottleneckFix()'></button>";
    h += incomeBreakdownHTML();
    /* 2026-10-25 (sakuri 指示): ボタン列は廃止。「名前を呼ぶ」「プロジェクトを眺める」は
       フレーバー専用なので削除し、「おやつ」は帯のおやつ箱 (prop_snackbox) へ移設した */
    /* IA コンパクト化: プロジェクトは「ヒーローカード」1枚に集約する。
       進捗% (大) + 節目刻みのメーター + 機能チップ + 集中力 + 状態チップで
       文章を絵に置き換える。#proj-label / #proj-meter / #proj-bar /
       #conc-bar の ID 契約は維持 (renderHeader が毎フレーム書き換える)。
       メーター本体は下の if(p) ブロック内でヒーローの一部として出す */
    /* (あそびかた説明はヒーローの後ろの折りたたみへ移動。
       自由タイピング欄は撤去済み: 入力ブーストは OS 入力カウント (帯 owner) と
       menu-input 転送が担う。owner でも欄は出ないのが仕様) */
    const p = S.project;
    if(p){
      const pct = Math.min(100, Math.round(S.projectDP / p.totalDP * 100));   /* v2.4.2: renderHeader と同じ丸めに統一 (floor だと再構築のたびに最大1%後退して見えた) */
      const segPct = 100 / ((p.feats ? p.feats.length : 0) + 1);   /* メーターの刻み = 節目の位置 */
      h += "<div class='hero'>";
      h += "<div class='hero-top'>" +
        (p.planning ? "<span class='hero-pct'>💡</span>"
                    : "<span class='hero-pct'>" + pct + "<small>%</small></span>") +
        "<span class='hero-name'>『" + esc(p.name) + "』</span>" +
        "<span class='tagchip'>" + esc(p.genreName) + "</span>" +
        "<span class='tagchip'>" + sizeLabel(p.size) + " / " + fmt(p.totalDP) + "DP</span>" +
        (p.desc ? "<span class='note' style='font-size:12px'>" + esc(p.desc) + "</span>" : "") + "</div>";
      h += "<div id='proj-label' style='margin-top:8px;font-size:12px;color:var(--sub)'>現在のプロジェクト進捗</div>" +
        "<div class='meter' id='proj-meter' style='background-size:" + segPct + "% 100%'><i id='proj-bar' style='width:" + pct + "%'></i></div>";
      if(p.planning) h += "<div class='bn' style='margin-top:7px'>💡 企画中： アイデア あと " + Math.max(0,(p.ideaCost||0)-Math.floor(S.ideas)) +
        " 個で着工（必要 " + (p.ideaCost||0) + " 個）</div>";
      if(p.feats && p.feats.length){
        h += "<div class='feats'>";
        p.feats.forEach((f,i)=>{ h += "<span class='featchip" + (i<p.doneFeats ? " done" : "") + "'>" + (i<p.doneFeats ? "✅" : "⬜") + " " + f + "</span>"; });
        h += "</div>";
      }
      h += "<div class='concrow'><span>🧠 集中力</span>" +
        "<div class='meter conc'><i id='conc-bar' style='width:" + Math.round(S.concentration) + "%'></i></div>" +
        "<b>" + Math.round(S.concentration) + "%</b>" +
        "<span>生産 +" + Math.round((concProdMult() - 1) * 100) + "%</span></div>";
      h += "<div class='chiprow'>" +
        "<span class='vchip'>📈 進捗 <b>" + fmt(S.projectDP) + " / " + fmt(p.totalDP) + " DP</b></span>" +
        "<span class='vchip'>🐛 バグ在庫 <b>" + fmt(S.bugStock) + "</b></span>" +
        "<span class='vchip'>🔍 QA <b>" + qaRate().toFixed(1) + "/分</b></span>" +
        "</div>";
      h += "</div>";
      /* 拡張ウェーブ G': デスマーチ出荷（DP 70%以上で出現）と納期の表示 */
      {
        const dmi = deathMarchInfo();
        const dl = S.activeRequest && S.activeRequest.deadlineAt
          ? Math.max(0, Math.ceil((S.activeRequest.deadlineAt - Date.now()) / 60000)) : null;
        if(dmi || dl !== null){
          h += "<div style='margin-top:7px;display:flex;gap:7px;align-items:center;flex-wrap:wrap'>" +
            (dl !== null ? "<span class='vchip'>⏰ 納期 あと約 " + dl + " 分" + (dl <= 10 ? "（急いで！）" : "") + "</span>" : "") +
            (dmi ? "<button onclick='doDeathMarch()'>🔥 デスマーチ出荷（進捗 " + Math.round(dmi.frac * 100) + "%・負債 +" + dmi.debtAdd + "）</button>" : "") +
            "</div>";
        }
        /* 段階5: 品質★（企画・モジュール・ブランドをまとめた値段の目盛り） */
        h += "<div class='chiprow'><span class='vchip' title='値段 ×1.5 ごとに星1つ'>品質 <b>" + starText(qualityStars(p)) + "</b> 値段 ×" + qualityMult(p).toFixed(2) +
          "（企画 ×" + planPriceMult(p).toFixed(2) + (p.modules ? "・モジュール ×" + modulePriceMult(p).toFixed(2) : "") + "・ブランド ×" + brandMult().toFixed(2) + "）</span></div>";
        /* 企画を練る: アイデアを使って価格とバグを良くする（進捗 50% まで）。
           使ったアイデアのぶん、オーバークロックの溜まりが遅くなる（蓄えとの天秤） */
        if(canPlan(p, S.projectDP) || planLv(p) > 0){
          const pc = planCost(p), after = ideaChargeMultFor((S.ideas || 0) - pc);
          h += "<div style='margin-top:7px;display:flex;gap:7px;align-items:center;flex-wrap:wrap'>" +
            (planLv(p) > 0 ? "<span class='vchip'>💡 企画Lv" + planLv(p) + "（価格 ×" + planPriceMult(p).toFixed(2) + "・バグ -" + Math.round(15 * planLv(p)) + "%）</span>" : "") +
            (canPlan(p, S.projectDP) ? "<button onclick='planProject(\"l1\")'" + (S.ideas < pc ? " disabled" : "") + " title='手元のアイデアはオーバークロックのゲージを速く溜める。使うとそのぶん遅くなる。放置が多いなら練るほうが得'>💡 企画を練る（価格 +" + Math.round(PLAN_PRICE_STEP * 100) + "%・バグ -15%・アイデア " + fmt(pc) + "・⚡溜まり ×" + ideaChargeMult().toFixed(2) + " → ×" + after.toFixed(2) + "）</button>" : "") +
            "</div>";
        }
        /* 第2ウェーブ L: 自社IPの指定（M/L・企画中は不可。成立はバグ0出荷） */
        if(p.ip || canDesignateIP(p, S.projectDP)){
          const bugsNow = Math.floor(S.bugStock);
          h += "<div style='margin-top:7px'>" + (p.ip
            ? "<span class='vchip'>🏷 自社IPねらい：出荷時のバグ <b>" + bugsNow + "</b> 匹" + (bugsNow > 0 ? "（0にしないと価格 ×" + IP_FAIL_MULT + "）" : "（成立ライン）") + "</span>"
            : "<button onclick='designateIP(\"l1\")' title='バグを0にして出荷できる見込みがあり、しばらく売却しないなら得。バグが残ると損、IPは売却で消える'>🏷 自社IPを狙う（規模 ×" + IP_SIZE_MULT + "・バグ0出荷で生涯 約×2.3／バグが残ると価格 ×" + IP_FAIL_MULT + "）</button>") + "</div>";
        }
        /* Wave H: モジュール（L 作品のみ） */
        if(p.modules){
          h += "<div style='margin-top:8px;border-top:1px solid var(--line);padding-top:6px'>" +
            "<div style='font-size:12px'><b>🧩 モジュール</b> <span style='color:var(--sub)'>完成するまで本体のビルドは待機します。価格は品質の掛け算（現在 ×" + modulePriceMult(p).toFixed(2) + "）</span></div>";
          p.modules.forEach((m, i) => {
            const q = moduleQuality(m), done = moduleComplete(m);
            const pct = Math.min(150, Math.round(m.inv / m.need * 100));
            h += "<div style='display:flex;align-items:center;gap:6px;margin-top:4px;font-size:12px'>" +
              "<span style='min-width:96px'>" + (done ? "✅" : "🧩") + " " + esc(m.name) + "</span>" +
              (m.out ? "<span class='tag'>外注・品質 0.8</span>"
                     : "<span style='flex:1;background:#1a1a1a;border:1px solid var(--line);height:8px'><span style='display:block;height:100%;width:" + Math.min(100, pct / 1.5) + "%;background:" + (done ? "#58a64a" : "#4a90c2") + "'></span></span>" +
                       "<span style='min-width:86px'>投資 " + pct + "%・品質 " + q.toFixed(2) + "</span>" +
                       (done ? "<span class='tag'>完成</span>"
                             : "<span>重み <button onclick='moduleWeight(" + i + ",-1)'>−</button> " + (m.w || 1) + " <button onclick='moduleWeight(" + i + ",1)'>＋</button></span>" +
                               "<button onclick='moduleOutsource(" + i + ")'>外注 " + fmt(moduleOutCost(m)) + "🪙</button>")) +
              "</div>";
          });
          h += "</div>";
        }
      }
    } else {
      /* プロジェクトが無い瞬間だけのフォールバック (従来の集中力メーター) */
      h += "<div style='margin-top:10px;font-size:12px;color:var(--sub)'>集中力</div>" +
        "<div class='meter conc'><i id='conc-bar' style='width:100%'></i></div>" +
        "<div id='proj-label' style='margin-top:8px;font-size:12px;color:var(--sub)'>現在のプロジェクト進捗</div>" +
        "<div class='meter' id='proj-meter'><i id='proj-bar' style='width:0%'></i></div>";
    }
    /* 低頻度は折りたたみへ: あそびかた (初回向けの説明) と日報ログ (振り返り) */
    h += foldSec("howto", false, "❓ あそびかた", "",
      "<div class='note' style='font-size:12px'>みゅけはデスクトップ下部の帯に住んでいます。帯のみゅけをクリックで「応援クリック」（進捗バースト＋コンボ）や反応が楽しめます。" +
      "設定で「OS入力カウント」を ON にすると、あなたのタイピングやカーソル移動が開発ブーストになります（数えるのは回数と距離だけ）。金色の魚やバグの群れが帯に出たらクリックで捕まえよう（逃がしてもペナルティなし）。</div>");
    let logHTML = "<div class='log'>";
    for(const e of S.log.slice(0,18)) logHTML += "<div><span class='tm'>" + esc(e.tm) + "</span> " + esc(e.text) + "</div>";
    logHTML += "</div>";
    h += foldSec("log", false, "📓 日報ログ", S.log.length ? "全 " + S.log.length + " 件" : "", logHTML);
  }
  if(currentTab === "staff"){
    const ss = staffSums();
    const ROLE_ICONS = { prog:"💻", test:"🐛", carry:"📦", research:"🔬", care:"🍪", sales:"💼", cheer:"📣" };  /* メニュー刷新 P1: 行アイコンソケット用 */
    h += "<h3>👥 スタッフ（"+ss.count+" / 上限 "+staffCap()+"人・"+companyRank()+" Lv"+S.studioLv+"）</h3>";
    /* スタジオ拡張は雇用の前提 — 細い行で常時見せる (最大時は1行に畳む) */
    /* 再設計 段階3: スタジオ拡張の枠は「次の社格の予告」（sakuri 2026-10-27）。社格は企業価値が届くと自動で上がる */
    if(S.studioLv < STAFF_CAPS.length){
      const need = nextRankValue(), have = S.runPeakValue || 0;
      const opens = RANK_UNLOCKS[S.studioLv + 1];
      h += "<div class='item slim rankbox' data-fix='studio'><div><span class='sock sm'>🏠</span><span class='nm'>スタジオ拡張 Lv"+(S.studioLv+1)+"（"+rankName(S.studioLv+1)+"）</span>"+
        " <span class='tagchip'>企業価値 "+fmt(have)+" / "+fmt(need)+"</span>"+
        "<div class='meter' style='margin-top:5px'><i style='width:"+Math.min(100, Math.round(have / need * 100))+"%'></i></div><div class='ds'>企業価値が届くと自動で昇格 ・ 雇用上限が "+STAFF_CAPS[S.studioLv]+" 人に"+(opens ? " ・ "+opens+"が開く" : "")+"</div></div></div>";
    } else {
      h += "<div class='item slim'><span class='sock sm'>🏠</span>スタジオ最大（大企業・上限 "+staffCap()+"人）</div>";
    }
    /* 第2ウェーブ M: 役員は頭数外の常駐メンバー。オーラの内訳を見せる */
    if((S.executives || []).length){
      h += "<div class='stagehead'>🎗 役員（頭数に数えません・同じ役職に +10%/匹 のオーラ）</div>" +
        S.executives.map(e => kv("🎗 " + e.name, (STAFF_ROLES[e.role] || {}).name + " のオーラ +10%")).join("") +
        ((S.execAlumni || []).length ? kv("卒業した役員・候補", S.execAlumni.map(a => a.name).join("・")) : "");
    }
    /* IA: 在籍スタッフを最初に — スプライトカードで顔ぶれが一目で分かる。
       雇用・ご褒美はカード群の下 (折りたたみ) へ、スタジオ拡張は細い行で常設 */
    if(S.buffs.prodUntil > Date.now() || S.buffs.clickUntil > Date.now()){
      h += "<div class='chiprow' style='margin-top:0'>" +
        (S.buffs.prodUntil > Date.now() ? "<span class='vchip'>⚡ 生産+15% <b>あと約"+Math.ceil((S.buffs.prodUntil-Date.now())/60000)+"分</b></span>" : "") +
        (S.buffs.clickUntil > Date.now() ? "<span class='vchip'>👆 クリック+10% <b>あと約"+Math.ceil((S.buffs.clickUntil-Date.now())/60000)+"分</b></span>" : "") +
        "</div>";
    }
    /* 再設計 段階4（sakuri のスケッチ 2026-10-27）: 部署を横一列に並べ、各列に見出し（部署名＋Lv.up・雇用）と所属の猫を縦に並べる。
       カード・行・ボタンは従来の部品のまま（雰囲気は引き継ぐ） */
    const staffEff = (st, m) => {
      const def = STAFF_ROLES[st.role];
      if(st.role === "prog") return "実装 +" + (def.out*m).toFixed(1) + " DP/分";
      if(st.role === "test") return "QA +" + (def.out*m).toFixed(1) + " バグ/分 ・ テスト +" + (4*m).toFixed(0) + " DP/分";
      if(st.role === "carry") return "出荷 +" + (def.out*m).toFixed(0) + " DP/分";
      if(st.role === "research") return "研究 +" + (def.out*m).toFixed(2) + " P/分" + (tier1Done() ? " ・ 💡 +" + (def.out*m*0.6).toFixed(2) + "/分" : "");
      if(st.role === "care") return "集中力キープ ・ たまに差し入れ";
      if(st.role === "sales"){
        const sg = GENRES.find(x => x.id === st.genre);
        return "依頼を自動獲得 ・ 得意：" + (sg ? sg.name : "―") + " ・ 担当力 " + (st.lv + deptLv("sales") - 1);
      }
      return def.desc;
    };
    if(!S.staff.length) h += "<div class='note' style='font-size:12px'>まだスタッフはいません。部署の「雇用」から最初の仲間を雇おう。</div>";
    h += "<div class='deptcols'>";
    for(const role of Object.keys(DEPTS)){
      const d = DEPTS[role], def = STAFF_ROLES[role], lv = deptLv(role), n = ss.byRole[role] || 0;
      const maxed = lv >= DEPT_MAX_LV, chief = deptChief(role), locked = roleLocked(role);
      /* 部署は工場の工程カードと同じ作り（色の上辺・名前とLv・大きな数字・Lvのバー・小さな説明）で、雇用もここに置く。
         所属の猫はスケッチどおり1行ずつの軽い行にして、部署との情報量の差をはっきりさせる */
      const total = role === "prog" ? [ss.prog.toFixed(1), "DP/分", "実装の合計"]
        : role === "test" ? [ss.qa.toFixed(1), "バグ/分", "テスト速度 +" + ss.testDP.toFixed(0) + " DP/分"]
        : role === "carry" ? [ss.ship.toFixed(0), "DP/分", "出荷の合計"]
        : role === "research" ? [ss.rp.toFixed(2), "研究P/分", "研究の合計"]
        : role === "care" ? [ss.careW.toFixed(1), "お世話力", "集中力の減りを抑える"]
        : role === "sales" ? [String(S.staff.filter(x => x.role === "sales").reduce((a, x) => a + x.lv + lv - 1, 0)), "担当力", "依頼を自動で取ってくる"]
        : [ss.cheer.toFixed(1), "回/秒", "みゅけの横で応援"];
      h += "<div class='deptcol" + (locked ? " locked" : "") + "'>" +
        "<div class='depthead' data-fix='hire:" + role + "'>" +
        "<div class='rh'><span>" + d.icon + "</span><span class='nm'>" + d.name + "</span><span class='dlv'>Lv" + lv + "</span></div>" +
        "<div class='rv'>" + total[0] + " <small>" + total[1] + "</small></div>" +
        "<span class='lampbar'><i style='width:" + Math.round(lv / DEPT_MAX_LV * 100) + "%'></i></span>" +
        "<div class='rs'>" + total[2] + "</div>" +
        "<div class='rs'>所属 " + n + "人 ・ ×" + deptMult(role).toFixed(2) + (maxed ? "（最大）" : "→" + (deptMult(role) + 0.15).toFixed(2)) + "</div>" +
        /* 段階5: 部署の節目（Lv3・6・10）で任せられる仕事。済んだものは ✓、次の1つは Lv つきで */
        (() => {
          const dl = delegateList(role), done = dl.filter(x => lv >= x[0]), nx = dl.find(x => lv < x[0]);
          const short = t => t.split("（")[0];
          return "<div class='rs dl' title='" + esc(dl.map(x => "Lv" + x[0] + ": " + x[1]).join("\n")) + "'>" +
            done.map(x => "✓ " + short(x[1])).join(" ・ ") + (done.length && !chief ? "（部長がいない）" : "") +
            (nx ? (done.length ? "<br>" : "") + "Lv" + nx[0] + ": " + short(nx[1]) : "") + "</div>";
        })() +
        (locked ? "<div class='rs'>社格「" + rankName(CHEER_STAFF_RANK) + "」から</div>" : "") +
        "<div class='dh-btns'>" +
        (maxed ? "<span class='tagchip'>MAX</span>" : buyBtn("dept:" + role, deptCost(role), "coins", "buyDept(\"" + role + "\")", false, "Lv.up ")) +
        buyBtn("hire:" + role, hireCost(role), "coins", "hireStaff(\"" + role + "\")", ss.count >= staffCap() || locked, "雇用 ") +
        "</div></div>";
      for(const st of S.staff.filter(x => x.role === role)){
        const m = staffOutMult(st) * deptMult(role);   /* Sprint 4: 熟練ボーナス込み表示 / Phase C: 部署倍率も表示に一致 */
        const tc = trainCost(st), smax = st.lv >= STAFF_MAX_LV, eff = staffEff(st, m);
        /* 行には自分の分の数字だけ（工程名と単位は列の見出しにある）。全文は title に */
        const short = def.unit ? "+" + (def.out * m).toFixed(def.out < 1 ? 2 : 1)
          : role === "sales" ? "担当 " + (st.lv + lv - 1) : "×" + m.toFixed(2);
        h += "<div class='catrow' title='" + esc(st.name + "（" + COAT_NAMES[st.coat] + "）" + eff) + "'>" +
          "<div class='sc-img'>" + staffPortrait(st.coat) + "</div>" +
          "<div class='sc-top'><span class='nm'>" + (chief === st ? "⭐" : "") + esc(st.name) + "</span><span class='lvbadge'>Lv" + st.lv + "</span></div>" +
          "<div class='cr-bot'><span class='sc-eff'>" + short + "</span>" +
          (smax ? "<span class='tagchip'>MAX</span>" : buyBtn("train:"+st.id, tc, "coins", "trainStaff("+st.id+")")) + "</div></div>";
      }
      h += "</div>";
    }
    h += "</div>";
    /* 一括育成は「まとめて上げる」高頻度操作なので列の直下に細い行で */
    const bulkTargets = S.staff.filter(s => (s.lv || 1) < STAFF_MAX_LV);
    if(bulkTargets.length){
      const bulkCost = bulkTargets.reduce((a, s) => a + trainCost(s), 0);
      h += "<div class='item buy slim'><div><span class='sock sm'>🎓</span><span class='nm'>全員+1Lv 育成</span> <small>対象 "+bulkTargets.length+"人</small></div>"+
        buyBtn("bulk", bulkCost, "coins", "buyBulkTrain()")+"</div>";
    }
    /* Phase D: 子会社（準大手から）。レバーは設立・人員・規模Lv・資金配分、
       出口は部分EXIT（子会社だけ売却）。グループEXIT は工場タブの売却に合算。
       解放前はスタッフタブに何も出さない（施錠表示は卒業済みプレイヤーへの
       ノイズになる — smoke F の原則）。予告はスタジオ拡張の行と昇格ログで担う */
    if(S.studioLv >= 5) {
      let subHTML = "";
      for(const sub of (S.subs || [])){
        const r = subRates(sub);
        const gname = (GENRES.find(g => g.id === sub.genre) || {}).name || sub.genre;
        subHTML += "<div class='item slim'><div><span class='sock'>🏢</span><span class='nm'>" + esc(sub.name) + "</span>" +
          " <span class='tagchip'>得意: " + gname + "</span> <span class='tagchip'>規模Lv" + sub.lv + "</span> <span class='tagchip'>人員 " + sub.staff + "人</span>" +
          "<div class='ds'>売上 +" + fmt(r.coins) + "🪙/分 ・ 生産 +" + r.dp.toFixed(1) + " DP/分 ・ 売却（部分EXIT）で星屑 " + subDustValue(sub) + " 個</div>" +
          "<div class='ds'>資金配分 <b>" + sub.alloc + "%</b>（注力度 ×" + subFocus(sub).toFixed(2) + "）" +
          (S.subs.length > 1 ? " <button onclick='setAlloc(" + sub.id + ",-10)'>−10%</button> <button onclick='setAlloc(" + sub.id + ",10)'>＋10%</button>" : "") + "</div>" +
          "<div class='ds'>配当率 <b>" + subDiv(sub) + "%</b>（本社へ +" + fmt(r.coins * subDiv(sub) / 100) + "🪙/分・残りは人員と規模に再投資）" +
          " <button onclick='setSubDiv(" + sub.id + ",-25)'" + (subDiv(sub) <= 0 ? " disabled" : "") + ">−25%</button> <button onclick='setSubDiv(" + sub.id + ",25)'" + (subDiv(sub) >= 100 ? " disabled" : "") + ">＋25%</button></div></div></div>" +
          "<div class='item buy slim'><div><span class='nm'>人員を増やす</span><div class='ds'>人は抽象的に数える（帯には出ない）</div></div><span>" +
          buyBtn("substaff1:" + sub.id, subHeadCost(sub), "coins", "addSubStaff(" + sub.id + ",1)", false, "+1人 ") +
          buyBtn("substaff10:" + sub.id, subHeadCostN(sub, 10), "coins", "addSubStaff(" + sub.id + ",10)", false, "+10人 ") + "</span></div>" +
          "<div class='item buy slim'><div><span class='nm'>規模を上げる</span><div class='ds'>出力 ×" + subLvMult(sub).toFixed(1) + (sub.lv >= SUB_MAX_LV ? "（最大）" : " → ×" + subLvMult({ lv: sub.lv + 1 }).toFixed(1)) + milestoneNote({ ms: true }, sub.lv) + "</div></div>" +
          (sub.lv >= SUB_MAX_LV ? "<span class='tagchip'>MAX</span>" : buyBtn("subscale:" + sub.id, subScaleCost(sub), "coins", "scaleSub(" + sub.id + ")")) + "</div>" +
          "<div class='item slim'><div><span class='nm'>この子会社を売却（部分EXIT）</span><div class='ds'>星屑 +" + subDustValue(sub) + " 個。本社はそのまま残ります</div></div>" +
          "<button onclick='sellSub(" + sub.id + ")'>売却する</button></div>";
      }
      let foundHTML = "<div class='item slim'><div><span class='sock'>🌱</span><span class='nm'>新しい子会社を設立</span>" +
        "<div class='ds'>設立費 " + fmt(foundCost()) + "🪙 ・ 得意ジャンルを選んで設立（人員 5 人で発足）</div><div style='margin-top:5px'>";
      for(const g of unlockedGenres())
        foundHTML += "<button onclick='foundSub(\"" + g.id + "\")'" + (S.coins < foundCost() ? " disabled" : "") + ">" + g.name + "</button> ";
      foundHTML += "</div></div></div>";
      foundHTML += engineRowsHTML("subs");   /* 段階4: 子会社の強化の列 */
      h += foldSec("subs", false, "🏢 グループ子会社",
        (S.subs || []).length ? (S.subs.length + "社・総勢 " + totalPeople() + "人") : "まだ子会社はありません",
        subHTML + foundHTML);
    }
    /* Sprint 4: ご褒美（終盤のコインシンク）は低頻度なので折りたたみへ */
    let treatHTML = "";
    for(const def of TREAT_DEFS){
      treatHTML += "<div class='item buy slim' data-fix='treat:"+def.id+"'><div><span class='nm'>"+def.name+"</span><div class='ds'>"+def.desc+"</div></div>"+
        buyBtn("treat:"+def.id, treatCost(def), "coins", "buyTreat(\""+def.id+"\")")+"</div>";
    }
    /* チュートリアル導線: ご褒美は終盤のコインシンク。累計5,000🪙 までは
       折りたたみ自体をシルエットにする (使ったことがあれば常に実体) */
    const treatsOwned = (S.today.treats || 0) > 0 || S.buffs.prodUntil > Date.now() || S.buffs.clickUntil > Date.now();
    if(!treatsOwned && Math.floor(S.totals.coinsEarned) < 5000 && !(S.tut && S.tut.skipped)){
      h += secLockHTML("🎁", "ご褒美（みんなへ）",
        [["🪙", Math.floor(S.totals.coinsEarned), 5000, "累計コイン"]],
        "もっと稼げるようになったら、みんなにご褒美をあげられるにゃ");
    } else {
      h += foldSec("treats", false, "🎁 ご褒美（みんなへ）", "価格は収入と、効果中の重ね買いで上昇", treatHTML);
    }
  }
  if(currentTab === "factory"){
    const bn = bottleneckInfo();
    h += "<h3>🏭 開発工場</h3>";
    /* 拡張ウェーブ G: 会社の経営状態（負債とブランド）。数値は大きく、説明は短く */
    {
      const d = Math.round(S.debt || 0), b = Math.round(S.brand || 0);
      h += "<div class='statgrid'>" +
        statBlock("技術的負債", d, "生産効率 ×" + debtEff().toFixed(2)) +
        statBlock("ブランド力", b, "品質★の値段 ×" + brandMult().toFixed(2)) +
        "</div>" +
        "<div class='note'>バグを抱えたまま出荷すると負債が積みます（総務が少しずつ返済）。バグのない出荷でブランドが育ち、単価が上がります。どちらも EXIT で清算されます</div>";
      /* 拡張ウェーブ G': バグ外注（金で買うリリーフバルブ） */
      const vc = vendorCost();
      h += "<div style='margin:7px 0'><button onclick='outsourceBugs()' " +
        ((vc.bugs <= 0 && vc.debtCut <= 0) || S.coins < vc.coins ? "disabled" : "") +
        ">" + (vc.bugs <= 0 && vc.debtCut <= 0 ? "🧳 バグ外注（片付けるバグも負債もないにゃ）" : "🧳 バグ外注（バグ全消し＋負債 -" + vc.debtCut + "） " + fmt(vc.coins) + "🪙") + "</button>" +
        (vc.uses > 0 ? " <span class='note'>続け頼みで ×" + Math.pow(VENDOR_REPEAT_MULT, vc.uses).toFixed(2).replace(/\.?0+$/, "") + "（次のリリースで元の値段に戻る）</span>" : "") + "</div>";
    }
    /* IA: 信号機図とレート表を1本の帯に統合 (図が主役・数字は大きく)。
       Strip Canon §c.7: 信号機は工場パネルの図に一本化（stageStatus の合算判定）。
       緑=流れている / 黄=素材待ち・溜まり気味 / 赤=バグ詰まり・在庫飽和。
       バーは下流の在庫バッファ。lampdot / lampbar の部品はそのまま使う */
    {
      const stgs = stageStatus();
      const lampCol = l => l === "red" ? "#d9534f" : l === "yellow" ? "#e8b93a" : "#5aa469";
      const cell = (s, val, unit, sub) =>
        "<div class='ratecell pipe-" + s.lamp + "'><div class='rh'><span class='lampdot' style='background:" + lampCol(s.lamp) + "'></span>" + esc(s.name) + "</div>" +
        "<div class='rv'>" + val + " <small>" + unit + "</small></div>" +
        "<span class='lampbar'><i class='" + (s.lamp === "red" ? "bnbar" : "") + "' style='width:" + Math.round(Math.min(1, s.frac || 0) * 100) + "%'></i></span>" +
        "<div class='rs'>" + sub + "</div></div>";
      h += "<div class='ratestrip'>" +
        cell(stgs[0], fmt(S.ideas), "💡 在庫", "着工 S2・M5・L10") +
        cell(stgs[1], productionRate().toFixed(1), "DP/分", "仕掛品 " + fmt(S.wip.code) + " DP") +
        cell(stgs[2], testRate().toFixed(0), "DP/分", "QA " + qaRate().toFixed(1) + " バグ/分 ・ 仕掛品 " + fmt(S.wip.tested)) +
        cell(stgs[3], buildRate().toFixed(0), "DP/分", "仕掛品 " + fmt(S.wip.built) + " DP") +
        cell(stgs[4], shipRate().toFixed(0), "DP/分", S.project ? "現プロジェクト " + Math.min(100, Math.round(S.projectDP / S.project.totalDP * 100)) + "%" : "") +
        "</div>";
    }
    if(bn.isBn){
      h += "<div class='bn' style='margin-top:5px'>⚠️ ボトルネック: "+bn.worst.name+"工程（"+bn.worst.rate.toFixed(0)+
        " DP/分 ← 生産 "+bn.prod.toFixed(1)+" DP/分）"+
        " <button onclick='gotoBottleneckFix()'>対策を見る</button></div>";
    } else {
      h += "<div class='ok' style='margin-top:5px'>✅ ラインは順調です（生産 "+bn.prod.toFixed(1)+" DP/分）</div>";
    }
    /* 段階5: 第2ラインは廃止。開発部 Lv3 の並行開発で作る手が増える（テスト以降は共有） */
    h += "<div class='note' style='margin-top:6px'>🏭 並行開発: " + (delegated("prog", 3)
      ? "稼働中（開発部の実装 ×" + parallelDevMult().toFixed(1) + "。テスト以降の工程は共有なので、下流が詰まりやすくなります）"
      : "開発部を Lv3 にすると、開発部の実装が +50%（部長＝開発部の猫が1匹以上いること）") + "</div>";
    h += "<h3 style='margin-top:12px'>⬆️ 工程アップグレード</h3>";
    h += engineRowsHTML("line");   /* 段階4: 本社ラインの強化の列（作品の売上） */
    /* 工程の区切り見出しは廃し、工程名は各カードのチップで示す (1グリッド化) */
    h += "<div class='buygrid'>";
    for(const def of UPGRADE_DEFS){
      if(def.id === "bot") continue;   /* ボットは「同僚」枠としてグリッドの外に別掲 */
      const lv = S.upgrades[def.id]||0, cost = upgradeCost(def, lv), maxed = lv>=def.max;
      h += "<div class='item buy slim' data-fix='up:"+def.id+"'><div><span class='nm'>"+def.name+"</span> <span class='lvbadge'>Lv"+lv+"</span> <span class='tagchip'>"+def.stage+"</span>"+
        "<div class='ds'>"+def.desc+milestoneNote(def, lv)+"</div></div>"+
        (maxed ? "<span class='tagchip'>MAX</span>" : buyBtn("up:"+def.id, cost, "coins", "buyUpgrade(\""+def.id+"\")"))+"</div>";
    }
    h += "</div>";
    /* 子ねこボットは「道具」でなく「同僚」: 解放は仲間 (Stage 4) と同じ。
       それまではシルエット (条件は累計コインのバー) */
    if(tutLocked(TUT_STAGE.STAFF, (S.upgrades.bot || 0) > 0)){
      h += secLockHTML("🤖", "子ねこボット",
        [["🪙", Math.floor(S.totals.coinsEarned), 220, "累計コイン（仲間の解放条件）"]],
        "仲間が増える頃に、ボットも仲間にできるにゃ");
    } else {
      const bdef = UPGRADE_DEFS.find(u => u.id === "bot");
      const blv = S.upgrades.bot || 0, bcost = upgradeCost(bdef, blv), bmaxed = blv >= bdef.max;
      h += "<div class='item buy slim' data-fix='up:bot'><div><span class='nm'>"+bdef.name+"</span> <span class='lvbadge'>Lv"+blv+"</span> <span class='tagchip'>"+bdef.stage+"</span>"+
        "<div class='ds'>"+bdef.desc+milestoneNote(bdef, blv)+"</div></div>"+
        (bmaxed ? "<span class='tagchip'>MAX</span>" : buyBtn("up:bot", bcost, "coins", "buyUpgrade(\"bot\")"))+"</div>";
    }
    const pv = prestigePreview();
    /* 星屑ショップ: 買えるものだけを行にし、購入済み・MAX はチップに畳む */
    let dustRows = "", dustChips = "";
    for(const def of DUST_PERKS){
      if(def.lv){
        /* Sprint 4: レベル制の特典（反復購入） */
        const lv = perkLv(def.id), maxed = lv >= def.maxLv;
        const cost = Math.ceil(def.baseCost * Math.pow(def.costMul, lv));
        if(maxed){ dustChips += "<span class='featchip done'>✅ "+def.name+" MAX</span>"; continue; }
        /* 段階6: 枝は「いまの効き」と「この会社の列の投資でどれだけ強まっているか」を出す */
        const desc = def.branch
          ? def.desc + " ×" + branchMult(def.id).toFixed(2) + "（次 ×" + (1 + 0.15 * (lv + 1) * (1 + branchInvest(def.branch) / 20)).toFixed(2) + "・" + (def.branch === "labor" ? "応援強化" : "この会社の列") + "の Lv で効きが伸びる）"
          : def.desc;
        dustRows += "<div class='item buy slim' data-fix='perk:"+def.id+"'><div><span class='nm'>"+def.name+"</span> <span class='lvbadge'>Lv"+lv+"</span>"+
          "<div class='ds'>"+desc+"</div></div>"+
          buyBtn("perk:"+def.id, cost, "dust", "buyDustPerk(\""+def.id+"\")", false, "強化 ")+"</div>";
        continue;
      }
      if(hasPerk(def.id)){ dustChips += "<span class='featchip done'>✅ "+def.name+"</span>"; continue; }
      dustRows += "<div class='item buy slim' data-fix='perk:"+def.id+"'><div><span class='nm'>"+def.name+"</span>"+
        "<div class='ds'>"+def.desc+"</div></div>"+
        buyBtn("perk:"+def.id, def.cost, "dust", "buyDustPerk(\""+def.id+"\")")+"</div>";
    }
    const dustBody = (dustRows ? "<div class='buygrid'>"+dustRows+"</div>" : "") +
      (dustChips ? "<div class='feats'>"+dustChips+"</div>" : "") +
      "<div class='note' style='margin-top:6px'>永続特典（売却しても消えません）。生産倍率は通算の星屑（現在 "+fmt(S.dustTotal||0)+" 個）で決まるので、使っても下がりません</div>";
    /* プレステージは低頻度: 実行できる時だけ表のカードに出し、それ以外は
       星屑ショップと一緒に折りたたみにまとめる */
    const prestigeBtn = "<button class='primary' onclick='doPrestige()' "+(pv.gain<3?"disabled":"")+">会社を売却する（星屑 +"+pv.gain+"）</button>";
    if(tutLocked(TUT_STAGE.PRESTIGE, tutOwnsDust())){
      /* チュートリアル導線: 引っ越しと星屑ショップは卒業 (Stage 7) の深層。
         それまでは正体を伏せた深部シルエットだけを見せる */
      h += "<div class='seclock'><div class='seclock-head'><span class='silh'>⭐</span><span>？？？</span>" +
        "<span class='fold-sum'>🔒 深いところにある何か</span></div>" +
        condBarsHTML([["⭐", pv.gain, 3, "星屑（今回の実績ぶん）"]]) +
        "<div class='lockline'>🐱 まだ内緒にゃ。たくさん作ると分かるよ</div></div>";
    } else if(pv.gain >= 3){
      h += "<div class='item' style='border-color:var(--gold-d);margin-top:12px'><div class='buy'><div>"+
        "<span class='sock'>🏢</span><span class='nm'>会社を売却できます！</span>"+
        "<div class='ds'>星屑 <b>+"+pv.gain+"</b> ・ 生産倍率 ×"+pv.curMult.toFixed(2)+" → <b>×"+pv.nextMult.toFixed(2)+"</b>（企業価値の最高 "+fmt(S.runPeakValue || 0)+"）</div></div>"+
        prestigeBtn + "</div>"+
        "<div class='note' style='margin-top:4px'>リセット: "+pv.resets.join("・")+" ／ 引き継ぎ: "+pv.keeps.map(esc).join("・")+" ／ 最高到達社格: "+rankName(S.maxStudioLv||S.studioLv)+"</div>" + exitMsHTML() + "</div>";
      h += execSelectHTML();   /* 第2ウェーブ M: 役員とベテランの選出（売却カードの中） */
      h += foldSec("dustshop", false, "⭐ 星屑ショップ", "所持 "+fmt(S.dust)+" ⭐", dustBody);
    } else {
      const preBody = kv("企業価値の最高", fmt(S.runPeakValue || 0)+" ＝ 星屑 "+pv.gain+" 個ぶん（3個から売却可能・"+fmt(BAL.valuePerDust * BAL.dustSoftcap)+" で20個の売りどき）") +
        kv("生産倍率（星屑ボーナス）", "現在 ×"+pv.curMult.toFixed(2)+" → 売却後 ×"+pv.nextMult.toFixed(2)) +
        (pv.subGain > 0 ? kv("うち子会社ぶん（目安）", "星屑 約 "+pv.subGain+" 個（子会社の売上も企業価値に入っています）") : "") +
        kv("EXIT回数", S.prestiges+" 回") + exitMsHTML() +
        kv("最高到達社格", rankName(S.maxStudioLv||S.studioLv)+"（売却しても記録は残ります）") +
        "<div class='note'>リセット: "+pv.resets.join("・")+"<br>引き継ぎ: "+pv.keeps.map(esc).join("・")+"</div>" +
        "<div style='margin:7px 0'>"+prestigeBtn+"</div>" +
        "<div class='stagehead'>⭐ 星屑ショップ（所持 "+fmt(S.dust)+")</div>" + dustBody;
      h += foldSec("prestige", false, "🏢 EXIT（事業売却） ・ ⭐ 星屑ショップ", "星屑 +"+pv.gain+" 個ぶん", preBody);
    }
    /* 第2ウェーブ J: ホールディングス化（第2層）。条件が遠いうちは出さず、
       近づいたら進捗、揃ったらカード、持株化後はレガシー技術の店が出る */
    if(!tutLocked(TUT_STAGE.PRESTIGE, tutOwnsDust())){
      const hp = holdingsPreview();
      if(hp.can){
        h += "<div class='item' style='border-color:var(--gold-d);margin-top:12px'><div class='buy'><div>" +
          "<span class='sock'>🏛️</span><span class='nm'>ホールディングス化できます！</span>" +
          "<div class='ds'>グループ全体を持株会社化して、星団 <b>+" + hp.gain + "</b> を得ます。星屑と星屑特典は畳まれますが、レガシー技術・作品棚・実績・最高到達社格は残ります</div></div>" +
          "<button class='primary' onclick='doHoldings()'>持株化する（星団 +" + hp.gain + "）</button></div></div>";
      } else if((S.maxStudioLv || 1) >= 5 || (S.prestiges || 0) >= 5){
        h += foldSec("holdings", false, "🏛️ ホールディングス化（第2層）", "星団 +" + hp.gain + " 個ぶん",
          kv("条件: 最高到達社格", rankName(S.maxStudioLv || S.studioLv) + (hp.cond.lv6 ? " ✅" : "（大企業が目標）")) +
          kv("条件: 子会社", ((S.subs || []).length) + " / 2 社" + (hp.cond.subs ? " ✅" : "")) +
          kv("条件: EXIT 回数", (S.prestiges || 0) + " / " + HOLD_EXITS + " 回" + (hp.cond.exits ? " ✅" : "")) +
          kv("条件: この時代の通算星屑", fmt(S.eraDust || 0) + " / " + fmt(HOLD_ERA_DUST) + " 個" + (hp.cond.era ? " ✅" : "（星団は桁3つごとに1個）")));
      }
      if((S.holdings || 0) > 0 || (S.legacy || 0) > 0){
        let techRows = "", techChips = "";
        for(const def of LEGACY_TECHS){
          if(hasLegacyTech(def.id)){ techChips += "<span class='featchip done'>✅ " + def.name + "</span>"; continue; }
          const locked = def.req && !hasLegacyTech(def.req);
          techRows += "<div class='item buy slim'><div><span class='nm'>" + def.name + "</span>" +
            "<div class='ds'>" + def.desc + (locked ? "（先に『" + (LEGACY_TECHS.find(t => t.id === def.req) || {}).name + "』が必要）" : "") + "</div></div>" +
            "<button class='buybtn' onclick='buyLegacyTech(\"" + def.id + "\")'" + (((S.legacy || 0) < def.cost || locked) ? " disabled" : "") + "><span class='pricetag'>" + def.cost + " 🌌</span></button></div>";
        }
        const techBody = (techRows ? "<div class='buygrid'>" + techRows + "</div>" : "") +
          (techChips ? "<div class='chiprow'>" + techChips + "</div>" : "");
        h += foldSec("legacy", false, "🌌 レガシー技術", "所持 " + fmt(S.legacy || 0) + " 🌌 ・ 持株化 " + (S.holdings || 0) + " 回", techBody);
      }
    }
    /* 第2ウェーブ K: チャレンジ周回（設立直後のエントリー・放棄無償・報酬は永続） */
    if(!tutLocked(TUT_STAGE.PRESTIGE, tutOwnsDust())){
      if(S.challenge){
        const cdef = challengeDef(S.challenge.id);
        if(cdef){
          const prog = S.challenge.id === "black"
            ? "企業価値の最高 " + fmt(S.runPeakValue || 0) + " / " + fmt(BLACK_GOAL_DUST * BAL.valuePerDust)
            : "現在 Lv" + S.studioLv + " / 目標 Lv" + challengeGoalLv();
          h += "<div class='item' style='border-color:var(--gold-d);margin-top:12px'><div class='buy'><div>" +
            "<span class='sock'>🎯</span><span class='nm'>チャレンジ中: " + cdef.name + "</span>" +
            "<div class='ds'>" + cdef.rule + "<br>目標: " + cdef.goal + "（" + prog + "）／ 報酬: " + cdef.reward + "</div></div>" +
            "<button onclick='abandonChallenge()'>やめる</button></div></div>";
        }
      } else {
        let chRows = "";
        for(const cdef of CHALLENGE_DEFS){
          const owned = S.challengeRewards && S.challengeRewards[cdef.id];
          chRows += "<div class='item buy slim'><div><span class='nm'>" + cdef.name + "</span>" + (owned ? " <span class='tagchip'>✅ 報酬獲得済み</span>" : "") +
            "<div class='ds'>" + cdef.rule + "<br>目標: " + cdef.goal + " ／ 報酬: " + cdef.reward + "</div></div>" +
            "<button class='buybtn' onclick='startChallenge(\"" + cdef.id + "\")'" + (challengeStartable() ? "" : " disabled") + "><span class='buy-act'>挑戦する</span></button></div>";
        }
        const chNote = challengeStartable() ? "" : "<div class='note'>チャレンジは、会社を設立した直後（Lv1・実績が星屑1個ぶん未満）だけ受けられます。初回 EXIT のあと解放されます</div>";
        const ownedN = S.challengeRewards ? Object.keys(S.challengeRewards).length : 0;
        h += foldSec("challenge", false, "🎯 チャレンジ", ownedN ? "報酬 " + ownedN + " / 3 獲得" : "縛りプレイで永続報酬", chRows + chNote);
      }
    }
    /* 第2ウェーブ L: 市場トレンド（価格の流れと開発方針・自社IP の台帳） */
    {
      ensureTrend();
      const t = S.trend;
      const gName = id => { const g = GENRES.find(x => x.id === id); return g ? g.name : "？"; };
      let trBody = kv("📈 ブーム（価格 ×1.5）", gName(t.boom)) +
        kv("📉 不況（価格 ×0.7）", gName(t.slump)) +
        kv("次の入れ替えまで", "あと " + Math.max(1, TREND_CYCLE_SHIPS - (t.ships || 0)) + " 本（出荷）");
      if(hasLegacyTech("forecast")) trBody += kv("🔮 トレンド予報（次の流れ）", "📈 " + gName(t.nextBoom) + " ／ 📉 " + gName(t.nextSlump));
      trBody += "<div class='stagehead'>開発ジャンルの方針（重みづけ・固定にはならない）</div><div>" +
        "<button onclick='setDevGenrePref(null)'" + (!S.devGenrePref ? " class='primary'" : "") + ">おまかせ</button> " +
        GENRES.map(g => "<button onclick='setDevGenrePref(\"" + g.id + "\")'" + (S.devGenrePref === g.id ? " class='primary'" : "") + ">" + g.name + "</button>").join(" ") + "</div>";
      if((S.ips || []).length){
        trBody += "<div class='stagehead'>🏷 自社IP（" + S.ips.length + " / 3）・シリーズの相乗: 子会社の売上 +" + Math.round((seriesSubMult() - 1) * 100) + "%・依頼達成ボーナス +" + Math.round((seriesReqMult() - 1) * 100) + "%</div>" + S.ips.map(ip =>
          kv("『" + esc(ip.name) + "』", "シリーズ売上 +" + fmtRate(seriesRate(ip)) + "🪙/秒")).join("");
      }
      h += foldSec("trend", false, "📊 市場トレンド", "📈 " + gName(t.boom) + " ／ 📉 " + gName(t.slump), trBody);
    }
  }
  if(currentTab === "click"){
    h += "<h3>👆 応援クリック</h3>";
    /* IA: 威力は文章でなく大きな数字で。説明は1行だけに圧縮 */
    h += "<div class='statgrid'>" +
      statBlock("1クリックの威力", fmtClickDP(clickShownDP()), "DP") +
      statBlock("コンボ上限", "×" + (1 + comboCapBonus()).toFixed(2), "") +
      statBlock("クリティカル", Math.round(critRate()*100) + "%", "当たると ×10") +
      statBlock("通算クリック", fmt(S.totals.clicks), "回") +
      "</div>";
    h += "<div class='note'>帯のみゅけをクリックで応援（80%はその場で進捗に）。金の魚やバグの群れもクリックで捕獲（逃がしてもペナルティなし）</div>";
    /* 拡張ウェーブ F: オーバークロックの状態と発動（帯のゲージからも発動できる） */
    {
      const g = S.fever ? Math.floor(S.fever.gauge || 0) : 0;
      const act = feverActive();
      h += "<div class='kv'><span>⚡ オーバークロック</span><b>" +
        (act ? "発動中！ あと " + Math.ceil((feverUntil - Date.now()) / 1000) + " 秒（生産×5・クリック×3）"
             : "ゲージ " + g + "%" + (g >= 100 ? " — 発動できます！" : "（実作業と応援で貯まります・アイデアの蓄えで溜まり ×" + ideaChargeMult().toFixed(2) + "・蓄熱で生産 +" + Math.round(FEVER.passiveMax * g) + "%）")) + "</b></div>";
      /* 押せない理由をボタン自体に書く (ゲージが満タンになると押せる) */
      if(!act) h += "<button " + (g >= 100 ? "" : "disabled") + " onclick=\"activateFever()\">" + (g >= 100 ? "⚡ オーバークロック発動（30秒）" : "⚡ オーバークロック（ゲージ100%で発動）") + "</button>";
    }
    h += "<h3 style='margin-top:12px'>応援強化（所持 応援P "+fmt(S.cheerP || 0)+"）</h3>";
    h += "<div class='note'>応援P はクリックで応援するたびに 1 貯まります。コインとは別の財布で、売却しても腕前として残ります</div>";
    h += "<div class='buygrid'>";
    for(const def of CLICK_DEFS){
      const lv = S.clickUp[def.id]||0, cost = clickCost(def, lv), maxed = lv>=def.max;
      h += "<div class='item buy slim' data-fix='click:"+def.id+"'><div><span class='nm'>"+def.name+"</span> <span class='lvbadge'>Lv"+lv+"</span>"+
        "<div class='ds'>"+def.desc+milestoneNote(def, lv)+"</div></div>"+
        (maxed ? "<span class='tagchip'>MAX</span>" : buyBtn("click:"+def.id, cost, "cheerP", "buyClickUp(\""+def.id+"\")"))+"</div>";
    }
    h += "</div>";
    const clickLog = kv("通算クリック", fmt(S.totals.clicks) + " 回") +
      kv("クリティカル", fmt(S.totals.crits) + " 回") +
      kv("捕まえた金のフィッシュ", fmt(S.totals.goldFish) + " 匹") +
      kv("叩いたイベントバグ", fmt(S.totals.eventBugs) + " 匹");
    h += foldSec("clicklog", false, "📊 応援の記録", "🐟 "+fmt(S.totals.goldFish)+" 匹 ・ 🐛 "+fmt(S.totals.eventBugs)+" 匹", clickLog);
  }
  if(currentTab === "shelf"){
    h += "<h3>📚 作品棚（"+S.shelf.length+"作品）</h3>";
    /* 段階4: 作品棚の強化の列（ここに積むと作品棚が主役になる） */
    h += "<div class='note' style='font-size:12px'>棚の売上 <b>"+fmtRate(catalogRate())+"🪙/秒</b> ・ 並んでいる作品 "+(S.catalog || []).length+" / "+catalogMax()+" 本</div>" + engineRowsHTML("catalog");
    if(!S.shelf.length) h += "<div>まだ作品がありません。最初のリリースをお楽しみに。</div>";
    /* IA: 作品は背表紙カードのグリッドで (1行リストの縦伸びを解消) */
    h += "<div class='shelfgrid'>";
    for(const w of S.shelf){
      h += "<div class='workcard'><div><span class='sock sm'>📖</span><span class='nm'>『"+esc(w.name)+"』</span></div>"+
        "<div class='chiprow' style='margin-top:5px'><span class='tagchip'>"+esc(w.genreName)+"</span><span class='tagchip'>"+w.size+"</span>"+(w.q?"<span class='tagchip'>"+starText(w.q)+"</span>":"")+"</div>"+
        (w.highlight ? "<div class='wc-hl'>✨ "+esc(w.highlight)+"</div>" : "")+
        "<div class='wc-stats'>"+esc(w.date)+" リリース ・ 開発 "+w.devMin+"分 ・ "+fmt(w.lines)+"行 ・ バグ "+w.bugs+"匹 ・ 昼寝 "+w.naps+"回</div></div>";
    }
    h += "</div>";
  }
  if(currentTab === "requests"){
    h += "<h3>📮 依頼ボード</h3><div class='note'>ペナルティなし。受けると<b>次の作品</b>がそのジャンルに（進行中は消えません）。リリースでボーナス" +
      (salesReps().length ? "。💼 営業がいるので、枠が空くと自動で取ってきます" : "") + "。大型案件とティア3には<b>納期</b>があります（過ぎるとボーナス消滅）</div>";
    h += engineRowsHTML("sales");   /* 段階4: 営業の強化の列 */
    if(S.bigDeal){
      const bd = S.bigDeal, leftMin = Math.max(0, Math.ceil((bd.expiresAt - Date.now()) / 60000));
      h += "<div class='item' style='border-color:var(--gold-d)'><div class='buy'><div><span class='sock'>🌟</span><span class='nm'>大型案件：" + esc(bd.client) + "</span>" +
        "<div class='ds'>「" + esc(bd.genreName) + "」の L サイズ以上で達成 ・ コイン+250% ・ 担当：" + bd.repName + " ・ ⏳ あと約" + leftMin + "分</div></div>" +
        "<span><button class='primary' onclick='acceptBigDeal()' " + (S.activeRequest ? "disabled" : "") + ">受ける</button> " +
        "<button onclick='declineBigDeal()'>見送る</button></span></div></div>";
    }
    if(S.activeRequest){
      const r = S.activeRequest;
      h += "<div class='item slim'><span class='sock'>📌</span><span class='nm'>受注中：" + esc(r.client) + "</span>" +
        "<div class='ds'>次の作品（" + esc(r.genreName) + "）をリリースで達成（コイン+" + Math.round((typeof r.bonus === "number" ? r.bonus : 0.6) * requestBonusMult() * 100) + "%・研究P+1）" +
        (r.tier ? " ・ クライアント: " + REQUEST_TIERS[r.tier].name : "") +
        (r.reqSize ? " ・ " + r.reqSize + "サイズ以上で満額（未満は半額）" : "") +
        (r.repName ? " ・ 担当: " + r.repName : "") +
        (r.deadlineAt ? " ・ ⏰ 納期 あと約 " + Math.max(0, Math.ceil((r.deadlineAt - Date.now()) / 60000)) + "分" : "") + "</div>" +
        "<div style='margin-top:5px'><button onclick='dropRequest()'>見送る（差し替え）</button></div></div>";
    }
    S.requests.forEach((r,i)=>{
      h += "<div class='item buy slim'><div><span class='sock'>📨</span><span class='nm'>" + esc(r.client) + "</span><div class='ds'>" + esc(r.text) + "</div></div>" +
        "<button onclick='acceptRequest(" + i + ")' " + (S.activeRequest && S.activeRequest.big ? "disabled" : "") + ">受ける</button></div>";
    });
    if(!S.requests.length && !S.activeRequest) h += "<button onclick='genRequests();save();renderPanel()'>依頼を探す</button>";
    /* Phase C: 希望ジャンル（プレイヤーの方針）。営業は力量が高いほど寄せて取る */
    {
      let chips = "<button onclick='setReqGenrePref(null)'" + (!S.reqGenrePref ? " class='primary'" : "") + ">おまかせ</button> ";
      for(const g of unlockedGenres())
        chips += "<button onclick='setReqGenrePref(\"" + g.id + "\")'" + (S.reqGenrePref === g.id ? " class='primary'" : "") + ">" + g.name + "</button> ";
      h += "<div class='item slim'><div><span class='sock'>🧭</span><span class='nm'>希望ジャンル</span>" +
        "<div class='ds'>営業が取ってくる依頼の寄せ先です（営業がいると効きます）</div>" +
        "<div style='margin-top:5px'>" + chips + "</div></div></div>";
    }
  }
  if(currentTab === "research"){
    h += "<h3>🔬 研究（研究P "+fmt(S.rp)+"）</h3>";
    /* IA: 進められる研究だけをカードに。完了分はチップに畳んで折りたたみへ */
    let resCards = "", resDone = "", resDoneN = 0;
    for(const def of RESEARCH_DEFS){
      if(S.research[def.id]){ resDone += "<span class='featchip done'>✅ "+def.name+"</span>"; resDoneN++; continue; }
      const reqDef = def.tier === 2 ? RESEARCH_DEFS.find(r => r.id === def.requires) : null;
      const locked = reqDef && !S.research[def.requires];
      resCards += "<div class='item buy slim' data-fix='res:"+def.id+"'><div><span class='nm'>"+def.name+"</span>"+
        (def.tier === 2 ? " <span class='tagchip'>ティア2</span>" +
          (reqDef ? " <span class='tagchip'>"+(locked ? "🔒 前提: " : "✅ 前提: ")+reqDef.name+"</span>" : "") : "")+
        "<div class='ds'>"+def.desc+"</div></div>"+
        buyBtn("res:"+def.id, def.cost, "rp", "buyResearch(\""+def.id+"\")", locked)+"</div>";
    }
    if(resCards) h += "<div class='buygrid'>"+resCards+"</div>";
    else h += "<div class='note' style='font-size:12px'>🎓 この会社の研究はすべて済みました。残りの研究P は売却のときジャンル知見になります</div>";
    /* 段階5: ジャンル知見（会社を売っても残る）。いまの Lv と、売却したら増える分 */
    {
      const pv = knowPreview();
      let rows = "";
      for(const g of GENRES){
        const pts = (S.genreKnow && S.genreKnow[g.id]) || 0, add = (pv.find(x => x.g === g.id) || { add: 0 }).add;
        if(!(pts > 0) && !(add > 0)) continue;
        const lv = knowLvFor(pts), nextPts = Math.pow(lv + 1, 2), lv2 = knowLvFor(pts + add);
        rows += "<div class='item slim'><div><span class='nm'>" + g.name + "</span> <span class='lvbadge'>Lv" + lv + "</span>" +
          (lv2 > lv ? " <span class='tagchip'>売却で Lv" + lv2 + "</span>" : "") +
          "<div class='ds'>" + g.name + "の作品の値段 +" + (lv * 10) + "% ・ 知見 " + pts.toFixed(1) + " / 次の Lv まで " + nextPts +
          (add > 0 ? " ・ 売却で +" + add.toFixed(1) : "") + "</div></div></div>";
      }
      h += "<h3 style='margin-top:12px'>📚 ジャンル知見（会社を売っても残る）</h3>" +
        "<div class='note'>売却のとき、残っている研究P がこの会社で出した作品のジャンルへ本数の割合で入ります。知見 Lv ごとにそのジャンルの値段 +10%</div>" +
        (rows ? "<div class='buygrid'>" + rows + "</div>" : "<div class='note' style='font-size:12px'>まだ知見はありません。作品を出して研究P を残したまま売却すると貯まります</div>");
    }
    if(resDone) h += foldSec("resdone", false, "✅ 完了した研究", resDoneN+" 件", "<div class='feats'>"+resDone+"</div>");
  }
  if(currentTab === "stats"){
    const t = S.today, T = S.totals;
    h += "<h3>📊 今日の記録（"+t.date+"）</h3>";
    /* IA: 今日の数字は大きなスタットで。通算は折りたたみに (たまに見るだけ) */
    h += "<div class='statgrid'>" +
      statBlock("⌨️ タイピング", fmt(t.keys), "回") +
      statBlock("🖱️ カーソル移動", (t.cursorPx/3779).toFixed(1), "m") +
      statBlock("💻 書いたコード", fmt(t.lines), "行") +
      statBlock("🐛 叩いたバグ", fmt(t.bugs), "匹") +
      statBlock("📝 コミット", fmt(t.commits), "回") +
      statBlock("🎉 リリース", fmt(t.releases), "作品") +
      "</div>";
    h += "<h3 style='margin-top:12px'>🏅 実績スタンプ</h3>";
    for(const st of STAMP_DEFS){
      const got = S.stamps[st.id];
      /* Sprint 4: 未取得スタンプにも進捗 (現在値/目標) を出す (C2-P2-7) */
      let progTxt = "";
      if(!got && st.prog){
        const pr = st.prog(S);
        progTxt = "<br><small>(" + fmt(Math.min(pr[0], pr[1])) + " / " + fmt(pr[1]) + ")</small>";
      }
      h += "<span class='stamp "+(got?"got":"lock")+"'>"+(got?"🏅":"🔒")+" "+esc(st.name)+(got?"<br><small>"+esc(got)+"</small>":progTxt)+"</span>";
    }
    const totalsHTML = kv("タイピング", fmt(T.keys)+" 回") + kv("カーソル移動", (T.cursorPx/3779/1000).toFixed(2)+" km") +
      kv("コード", fmt(T.lines)+" 行") + kv("叩いたバグ", fmt(T.bugsSquashed)+" 匹") +
      kv("コミット", fmt(T.commits)+" 回") + kv("リリース", fmt(T.releases)+" 作品") +
      kv("稼いだコイン", fmt(T.coinsEarned)+" 🪙") + kv("昼寝", fmt(T.naps)+" 回") +
      kv("スタッフ雇用", fmt(T.hired)+" 人") + kv("応援クリック", fmt(T.clicks)+" 回") +
      kv("一緒にいた時間", Math.round(T.playSec/60)+" 分");
    h += foldSec("totals", false, "📈 通算の記録", "リリース "+fmt(T.releases)+" 作品 ・ "+Math.round(T.playSec/60)+" 分", totalsHTML);
  }
  if(currentTab === "settings"){
    h += "<h3>⚙️ 設定</h3>";
    /* IA: プライバシーの約束は1行に圧縮して常設 (信頼情報なので畳まない) */
    h += "<div class='note' style='font-size:12px'>🔒 記録するのはタイピングの<b>回数</b>とカーソルの<b>移動距離</b>だけ。内容は読み取らず、通信もしません（保存先はこの PC のアプリ用フォルダだけ）</div>";
    h += "<div class='item buy slim'><div><span class='sock'>🎵</span><span class='nm'>サウンド</span><div class='ds'>Web Audio 合成の効果音。帯で鳴ります（メニューの開閉には連動しません）</div></div>"+
      "<button class='switch"+(SoundKit.enabled()?" on":"")+"' onclick='toggleSound()'>"+(SoundKit.enabled()?"ON":"OFF")+"</button></div>";
    h += "<div class='item buy slim'><div><span class='sock'>🎚️</span><span class='nm'>音量</span><div class='ds'>効果音の大きさ</div></div>"+
      "<input type='range' min='0' max='100' step='5' value='"+Math.round(SoundKit.volume()*100)+"' oninput='setSoundVol(this.value)' aria-label='効果音の音量' style='width:110px'></div>";
    h += "<div class='item buy slim'><div><span class='sock'>◥</span><span class='nm'>帯の位置</span><div class='ds'>帯の右上の ◥ をドラッグすると好きな場所へ動かせます（位置は保存されます）</div></div>"+
      "<button onclick='resetStripPos()'>画面下に戻す</button></div>";
    /* 帯の大きさ (v2.4.6: 旧70% = 新100% 基準。占有を抑えるのが本来の目的) */
    {
      const curPct = Math.round((S.settings.stripSize || 1) * 100);
      let sizeBtns = "";
      for(const pct of [70, 85, 100, 115, 130]){
        sizeBtns += "<button onclick='setStripSize(" + (pct / 100) + ")'" +
          (pct === curPct ? " class='switch on' aria-pressed='true'" : " aria-pressed='false'") + ">" + pct + "%</button>";
      }
      h += "<div class='item buy slim'><div><span class='sock'>🔍</span><span class='nm'>帯の大きさ</span><div class='ds'>帯の高さと、みゅけや家具の表示サイズが変わります</div></div>"+
        "<span style='display:flex;gap:4px'>" + sizeBtns + "</span></div>";
    }
    h += "<div class='item buy slim'><div><span class='sock'>✥</span><span class='nm'>家具の並び</span><div class='ds'>並べ替えモード中は、帯の家具も小物もドラッグで好きな場所へ動かせます（机や棚の上に重ね置きもできます）</div></div>"+
      "<span style='display:flex;gap:4px'><button onclick='toggleLayoutEdit()'>並べ替えモード</button><button onclick='resetLayout()'>初期配置に戻す</button></span></div>";
    h += "<div class='item buy slim'><div><span class='sock'>🧲</span><span class='nm'>並べ替えのスナップ</span><div class='ds'>ドラッグ中、近くの家具の中心へ弱く吸着します</div></div>"+
      "<button class='switch"+(S.settings.snapLayout?" on":"")+"' onclick='toggleSnapLayout()' aria-pressed='"+(S.settings.snapLayout?"true":"false")+"'>"+(S.settings.snapLayout?"ON":"OFF")+"</button></div>";
    h += "<div class='item buy slim'><div><span class='sock'>🌙</span><span class='nm'>点滅を減らす</span><div class='ds'>帯の点滅（企画中・雇える・ゲージ満タンなどの合図）を点けっぱなしにします。OS の「視差効果を減らす」が ON のときも自動で控えます</div></div>"+
      "<button class='switch"+(S.settings.reduceMotion?" on":"")+"' onclick='toggleReduceMotion()' aria-pressed='"+(S.settings.reduceMotion?"true":"false")+"'>"+(S.settings.reduceMotion?"ON":"OFF")+"</button></div>";
    h += "<div class='item buy slim'><div><span class='sock'>⏸️</span><span class='nm'>入力カウントを一時停止</span><div class='ds'>タイピング／カーソルの集計を止めます（基本進捗は続きます）</div></div>"+
      "<button onclick='togglePause()'>"+(S.settings.pauseInput?"再開する":"停止する")+"</button></div>";
    /* Phase 2: OS全体の入力カウント（既定OFF） */
    {
      const osDesc = "他のアプリでの<b>打鍵の回数</b>と<b>カーソルの移動距離</b>も数えて開発ブーストに使います（内容は記録しません・通信なし・既定OFF）。"+
        "管理者として実行されているウィンドウへの入力は、Windows の仕組み上 数えられません";
      let osStatus = "";
      const osBtn = "<button class='switch"+(S.settings.inputCount?" on":"")+"' onclick='toggleInputCount()'>"+(S.settings.inputCount?"ON（数えています）":"OFF")+"</button>";
      if(S.settings.inputCount && osInputLast.at){
        osStatus = "<div class='ds'>直近の集計: キー "+osInputLast.keys+" 回 ／ カーソル "+(osInputLast.distPx/3779).toFixed(1)+" m ／ クリック "+osInputLast.clicks+" 回</div>";
      }
      h += "<div class='item buy slim'><div><span class='sock'>🖥️</span><span class='nm'>OS全体の入力カウント</span><div class='ds'>"+osDesc+"</div>"+osStatus+"</div>"+osBtn+"</div>";
    }
    /* v2.3.5: 自動アップデート（GitHub Releases） */
    {
      const updDesc = "GitHub の配布ページで新版を確認します（更新ファイルは署名検証されます）。現在のバージョン: " + GAME_VERSION;
      let updBtn, updStatus = "";
      /* viewer には updater 権限が無い (実行は帯の領分) が、状態表示と操作ボタンは
         live.upd スナップショットで駆動する (ボタン自体はコマンド化される) */
      if(updApi() || IS_VIEWER){
        if(upd.status === "downloading") updBtn = "<button disabled>ダウンロード中…</button>";
        else if(upd.status === "ready") updBtn = "<button onclick='updRelaunch()'>再起動して更新する</button>";
        else if(upd.status === "available") updBtn = "<button onclick='updDownload()'>更新する（" + updVerLabel() + "）</button>";
        else if(upd.status === "checking") updBtn = "<button disabled>確認中…</button>";
        else updBtn = "<button onclick='updCheckManual()'>アップデートを確認</button>";
        const msg = updStatusText();
        if(msg) updStatus = "<div class='ds' id='upd-status'>" + msg + "</div>";
      } else {
        updBtn = "<button disabled>利用できません</button>";   /* Updater プラグインが無い (検証環境など) */
      }
      h += "<div class='item buy slim'><div><span class='sock'>🔄</span><span class='nm'>アップデート</span><div class='ds'>"+updDesc+"</div>"+updStatus+"</div>"+updBtn+"</div>";
    }
    /* チュートリアル導線: 現在地の表示と スキップ/見直し (確認モーダルなし・即時) */
    {
      const t = S.tut || { stage: 0, seen: {}, skipped: false };
      const stateTxt = t.skipped ? "全部ひらいた状態（ガイドなし）"
        : t.stage >= TUT_STAGE.PRESTIGE ? "卒業 — 全てのガイドが解放済み"
        : "いま: " + TUT_STAGE_NAMES[t.stage] + "（次は「" + TUT_STAGE_NAMES[t.stage + 1] + "」で開きます）";
      h += "<div class='item buy slim'><div><span class='sock'>🎓</span><span class='nm'>チュートリアル</span>" +
        "<div class='ds'>遊び方を少しずつ開いていくガイド。解放済みのものは巻き戻りません — " + stateTxt + "</div></div>" +
        "<span style='display:inline-flex;gap:6px;flex:none'>" +
        "<button onclick='tutResetGuide()'>最初から見直す</button>" +
        "<button onclick='tutSkipGuide()'>全部ひらく</button></span></div>";
    }
    /* 低頻度は折りたたみにまとめる: セーブの出し入れ / 危険ゾーンと詳細 */
    let saveHTML = "<div class='item buy slim'><div><span class='sock'>💾</span><span class='nm'>セーブを書き出す</span><div class='ds'>今のセーブデータを JSON ファイルで保存します（バックアップ・引っ越し用）</div></div>"+
      "<button onclick='exportSave()'>書き出す</button></div>";
    saveHTML += "<div class='item buy slim'><div><span class='sock'>📂</span><span class='nm'>セーブを読み込む</span><div class='ds'>書き出した JSON から復元します（今のセーブは上書きされます。形式が違うファイルは弾きます）</div></div>"+
      "<button onclick='document.getElementById(\"save-file\").click()'>ファイルを選ぶ</button>"+
      "<input type='file' id='save-file' accept='.json,application/json' style='display:none' onchange='importSaveFile(this)'></div>";
    h += foldSec("setsave", false, "💾 セーブデータ", "書き出し / 読み込み", saveHTML);
    let miscHTML = "<div class='item slim'><span class='sock'>⚠️</span><span class='nm'>セーブデータ初期化</span><div class='ds'>作品棚や実績も含め、すべて消えます</div>"+
      "<button class='danger' onclick='resetSave()'>初期化する</button></div>";
    miscHTML += "<div class='note'>スプライト差し替え: window.MIYUKE_SPRITES（graphics/sprites.js）を読み込むとドット絵が差し替わります。</div>";
    miscHTML += "<div class='note'>バージョン: " + GAME_VERSION + "（Strip Canon: 部屋シーン廃止・帯の家具化／Phase 2: OS全体の入力カウント／v2.3.5: GitHub 自動アップデート）</div>";
    h += foldSec("setmisc", false, "⚠️ その他・危険ゾーン", GAME_VERSION, miscHTML);
  }
  setPanelHTML(el, h);
  if(currentTab === "proj") updateComboUI();   /* 再描画で消えたコンボ表示を戻す */
  updateTabBadges();
  paintTabs();
}
/* パネルの作り直し。
   - 中身が前回と同じなら DOM を触らない (フォーカスもアニメも保たれる)
   - スライダーをドラッグしている最中は作り直さない (つまみが手から外れないように)
   - キーボードでフォーカスしていたボタンは、作り直した後も同じボタンへ戻す
     (5秒ごとの再描画でフォーカスが body へ飛び、キーボードだけでは買えなかった)
   - スクロール位置は作り直しの前後で保つ。フォーカスを戻すときに画面外の
     ボタンへスクロールで引き戻さない (押したボタンから離れて読んでいると、
     再描画のたびに押したボタンの位置へロールバックしていた) */
let panelLastHTML = null, panelPointerDown = false;
try{
  document.addEventListener("pointerdown", () => { panelPointerDown = true; }, true);
  document.addEventListener("pointerup", () => { panelPointerDown = false; }, true);
}catch(e){}
function setPanelHTML(el, h){
  if(h === panelLastHTML && el.innerHTML) return;
  const a = document.activeElement as HTMLElement | null;
  const inPanel = !!(a && a !== document.body && typeof el.contains === "function" && el.contains(a));
  if(inPanel && a.tagName === "INPUT" && panelPointerDown) return;
  let focusKey = null;
  if(inPanel && a.tagName === "BUTTON"){
    const sig = a.getAttribute("onclick") || a.textContent;
    const same = Array.prototype.filter.call(el.querySelectorAll("button"), b => (b.getAttribute("onclick") || b.textContent) === sig);
    focusKey = { sig, idx: Math.max(0, same.indexOf(a)) };
  }
  const top = el.scrollTop, left = el.scrollLeft;
  el.innerHTML = h;
  panelLastHTML = h;
  if(focusKey){
    const same = Array.prototype.filter.call(el.querySelectorAll("button"), b => (b.getAttribute("onclick") || b.textContent) === focusKey.sig);
    const target = same[Math.min(focusKey.idx, same.length - 1)];
    if(target && typeof target.focus === "function") target.focus({ preventScroll:true });
  }
  if(el.scrollTop !== top) el.scrollTop = top;
  if(el.scrollLeft !== left) el.scrollLeft = left;
}
/* メニュー刷新 P1: タブバッジ（買えるものがある/新しい依頼があるタブに赤ドット。
   判定は既存の afford 系ヘルパの流用のみ。失敗しても描画を止めないよう握りつぶす） */
function updateTabBadges(){
  try{
    const want: Record<string, number> = {};
    if(S.requests && S.requests.length && !S.activeRequest) want.requests = S.requests.length;
    const ss = staffSums();
    if(ss.count < staffCap() && Object.keys(STAFF_ROLES).some(r => hireCost(r) <= S.coins)) want.staff = 1;
    if(RESEARCH_DEFS.some(d => !S.research[d.id] && d.cost <= S.rp)) want.research = 1;
    if(UPGRADE_DEFS.some(d => (S.upgrades[d.id]||0) < d.max && upgradeCost(d, S.upgrades[d.id]||0) <= S.coins)) want.factory = 1;
    if(CLICK_DEFS.some(d => (S.clickUp[d.id]||0) < d.max && clickCost(d, S.clickUp[d.id]||0) <= (S.cheerP || 0))) want.click = 1;
    for(const b of tabsEl.children){
      const id = (b as HTMLElement).dataset && (b as HTMLElement).dataset.tab;
      let bd = null;
      for(const c of b.children) if(c.className === "tab-badge" || c.className === "tab-badge new") bd = c;
      /* チュートリアル導線: ロック中のタブにバッジは出さない (シルエット +
         🔒 だけが手がかり。開いたタブでは、解放されたてで未訪問なら 🆕 を
         通常の赤ドットより優先して出す。訪問すると消えて通常表示に戻る) */
      const tabLockedNow = tutTabLocked(id);
      let isNew = false;
      if(S.tut && !S.tut.skipped && !tabLockedNow){
        const keys = TUT_FRESH[id] || [];
        isNew = keys.some(k => parseInt(k.split(":")[1], 10) <= tutEffStage() && !(S.tut.seen || {})["visit:" + k]);
      }
      if(isNew){
        if(!bd){ bd = document.createElement("span"); b.appendChild(bd); }
        bd.className = "tab-badge new";
        bd.textContent = "🆕";
        bd.style.display = "";
      } else if(want[id] && !tabLockedNow){
        if(!bd){ bd = document.createElement("span"); b.appendChild(bd); }
        bd.className = "tab-badge";
        bd.textContent = want[id] > 1 ? String(want[id]) : "";
        bd.setAttribute("aria-label", id === "requests" ? "新しい依頼があります" : "買えるものがあります");   /* 色だけで伝えない */
        bd.style.display = "";
      } else if(bd){ bd.style.display = "none"; }
    }
  }catch(e){}
}
