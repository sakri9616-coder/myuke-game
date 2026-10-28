/* ---------- 実績フレーバーシナリオ（v2.26.0）: 小芝居の順番待ちと再生・宇宙編の呼び名 ----------
   台本は defs.ts の SKITS（文案の正本は sakuri）。小芝居は帯・メニューとは別の小さな
   ウィンドウ（ラベル "skit"・skit.html）が演じる。帯 (owner) は「いつ・どの場面を」決めて
   送るだけで、ゲームの進行は止めない。数値・報酬には一切かかわらない。
   - 物語の順にしか流さない: 先の場面をもう見ていたら、後から取れた前の場面は
     "skipped"（統計タブの ▶ でだけ見られる）。例: 雇用のあとに取れた「一人遊びマスター」
   - 次の場面までは SKIT_GAP_MS 空ける（張り付くと最初の2分でスタンプが13個取れる。sim 実測）
   - Tauri の無い検証環境 (sim / smoke) では窓を出さず、見たことにして先へ進む */
const SKIT_GAP_MS = 60000;
const SKIT_ORDER: Record<string, number> = {};
SKITS.forEach((sk, i) => { SKIT_ORDER[sk.id] = i; });
let skitQueue: { id: string; replay: boolean }[] = [];
let skitPlaying: { id: string; until: number } | null = null;
let skitLastEnd = 0;
let skitWinReady = false;

function skitDef(id){ return SKITS.find(sk => sk.id === id) || null; }
/* 1コマの長さ: 約3秒。長いセリフは読めるだけ延ばす */
function skitPanelMs(text){ return Math.max(3000, 1200 + [...(text || "")].length * 110); }
/* 物語のどこまで見たか（見た場面の中でいちばん後ろの並び順） */
function skitFurthest(){
  let m = -1;
  for(const id of Object.keys(S.skits || {})) if(S.skits[id] === "played" && SKIT_ORDER[id] > m) m = SKIT_ORDER[id];
  return m;
}
/* checkStamps から: スタンプを取ったら、その場面を順番待ちに入れる */
function skitOnStamp(id){
  if(IS_VIEWER || !(id in SKIT_ORDER) || !S.skits || S.skits[id]) return;
  if(SKIT_ORDER[id] < skitFurthest()){ S.skits[id] = "skipped"; return; }
  if(!skitQueue.some(q => q.id === id)) skitQueue.push({ id, replay: false });
}
/* 統計タブの ▶: 見た場面も、時期を過ぎて飛ばした場面も、もう一度演じる（記録は変えない） */
function playSkit(id){
  if(IS_VIEWER || typeof id !== "string" || !skitDef(id) || !S.skits || !S.skits[id]) return;
  skitQueue = skitQueue.filter(q => q.id !== id);
  skitQueue.unshift({ id, replay: true });
  skitTick(Date.now());
}
/* 1秒ティックから */
function skitTick(now){
  if(IS_VIEWER) return;
  if(skitPlaying){
    if(now < skitPlaying.until) return;
    skitPlaying = null; skitLastEnd = now;   /* 窓から終わりの知らせが来なかった時の保険 */
  }
  if(!skitQueue.length) return;
  /* ▶ の再生は先頭のまま。ほかは物語の順（同時に取れたら前の場面から） */
  const head = skitQueue[0].replay ? skitQueue[0] : skitQueue.slice().sort((a, b) => SKIT_ORDER[a.id] - SKIT_ORDER[b.id])[0];
  if(!head.replay && skitLastEnd && now - skitLastEnd < SKIT_GAP_MS) return;
  if(inTauri() && !skitWinReady) return;   /* 窓の読み込みを待つ */
  skitQueue = skitQueue.filter(q => q !== head);
  if(!head.replay){
    if(SKIT_ORDER[head.id] < skitFurthest()){ S.skits[head.id] = "skipped"; return; }
    S.skits[head.id] = "played";
  }
  skitShow(head.id, now);
}
function skitShow(id, now){
  const sk = skitDef(id);
  if(!sk) return;
  const panels = sk.panels.map(p => ({ pose: p[0], text: p[1] || "", fx: p[2] || "", ms: skitPanelMs(p[1]) }));
  const total = panels.reduce((a, p) => a + p.ms, 0);
  if(!inTauri()){ skitLastEnd = now; return; }
  skitPlaying = { id, until: now + total + 8000 };
  const T = window.__TAURI__;
  try{
    const p = T.event.emitTo("skit", "skit-play", { id, chapter: sk.chapter, title: sk.title, panels, coat: skitMobCoat() });
    if(p && p.catch) p.catch(function(){});
  }catch(e){}
  /* 窓の初回位置: 帯のみゅけの頭の真上（2回目からは窓を置いた場所に出る。Rust が覚える） */
  let ax = 0, ay = 0;
  try{
    const r = document.getElementById("strip").getBoundingClientRect();
    ax = r.left + stripMiyukeX() / stripVW * r.width;
    ay = r.top + (STRIP_GROUND - 70) / STRIP_H * r.height;
  }catch(e){}
  try{
    const q = T.core.invoke("show_skit", { x: ax, y: ay });
    if(q && q.catch) q.catch(function(){});
  }catch(e){}
}
/* 「はじめての同僚」などで歩いてくるモブ: 今いるスタッフの毛柄から（名前は出さない） */
function skitMobCoat(){
  const coats = (S.staff || []).map(s => s.coat).filter(c => COATS.includes(c));
  const src = coats.length ? coats : COATS;
  return src[Math.floor(Math.random() * src.length)];
}
function initSkitProtocol(){
  if(IS_VIEWER || !inTauri()) return;
  const T = window.__TAURI__;
  if(!(T.event && T.event.listen)) return;
  const on = (ev, fn) => { try{ const p = T.event.listen(ev, fn); if(p && p.catch) p.catch(function(){}); }catch(e){} };
  on("skit-ready", () => { skitWinReady = true; });
  on("skit-done", () => { skitPlaying = null; skitLastEnd = Date.now(); });
  /* 窓が先に読み込み済みなら、呼びかけに ready で答える（取りこぼし防止） */
  try{ const p = T.event.emitTo("skit", "skit-hello", {}); if(p && p.catch) p.catch(function(){}); }catch(e){}
}

/* ---------- 宇宙編の呼び名（表示名だけ。内部キー・数値・セーブは同じ） ---------- */
function spaceName(key, def){
  const steps = SPACE_NAMES[key];
  let name = def;
  if(steps && S && S.stamps) for(const [stamp, nm] of steps) if(S.stamps[stamp]) name = nm;
  return name;
}
function incomeSrcName(k){
  const base = INCOME_SRCS[k] || k;
  if(k === "line" || k === "catalog" || k === "subs") return spaceName(k, base);
  if(k === "sales") return base.replace("営業", spaceName("sales", "営業"));
  return base;
}
/* 新しく作る子会社の名前（月面支社のあとは土地の名前で） */
function spaceSubName(genreName){
  if(!S.stamps.holdings4) return null;
  const places = S.stamps.holdings5 ? SPACE_SUB_PLACES : SPACE_SUB_PLACES.slice(0, 1);
  return places[(S.subSeq || 0) % places.length] + "（" + genreName + "）";
}
/* 星間営業のころの依頼主（表示だけ。依頼文の口調は元の依頼主のまま） */
function spaceClient(c){
  if(!S.stamps.holdings7) return c;
  return SPACE_CLIENT_PLACES[Math.floor(Math.random() * SPACE_CLIENT_PLACES.length)] + c;
}
/* メニューのタブ名（子会社・作品棚）。変わった時だけボタンの文字を書き換える */
function syncSpaceTabLabels(){
  for(const t of TABS){
    const want = t[0] === "subs" ? "🏢 " + spaceName("subs", "子会社") : t[0] === "shelf" ? "📚 " + spaceName("catalog", "作品棚") : null;
    if(!want || t[1] === want) continue;
    t[1] = want;
    document.querySelectorAll("button[data-tab='" + t[0] + "']").forEach(b => {
      const el = b as HTMLElement;
      if(el.dataset.kind === "act"){ el.title = tabName(t[0]); el.setAttribute("aria-label", tabName(t[0]) + "を開く"); return; }
      const tx = Array.from(el.childNodes).find(n => n.nodeType === 3);
      if(tx) tx.textContent = want; else el.insertBefore(document.createTextNode(want), el.firstChild);
    });
  }
}
