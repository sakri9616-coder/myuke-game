/* ---------- 管理メニューの分割ビュー (VS Code のエディタグループ風) ----------
   - タブは必ずどれか1つのグループにだけ属する。同じタブが2枚並ばないので、
     proj-bar・bubble などの ID 契約はそのまま保たれる
   - 左端のアイコン列 (アクティビティバー) に全タブが常に並ぶ。タブを閉じても
     ここから開き直せる (管理メニューは取り外し式のコンソールで、閉じて困る機能を作らない)
   - タブはドラッグで別のタブ列へ移すか、パネルの上下左右の端へ落として分割する
   - 配置は管理ウィンドウの localStorage に置く UI の好み。セーブ (SAVE_KEY) には混ぜない
   - 帯 (body.strip) では main ごと隠れているので何もしない。DOM の無いスタブ環境では
     組み立てに失敗して layoutLive = false のまま、従来の1枚表示 (#tabs / #panel) で動く */
const LAYOUT_KEY = "miyuke-menu-layout-v1";
const LAYOUT_MAX_GROUPS = 4;
const LAYOUT_MIN_PX = 260;   /* 分割の境目をドラッグしても、これより狭いグループは作らない */
let layoutSeq = 1;
let focusGroupId = 0;
const groupDom = {};   /* グループ id -> { root, tabs, crumbTab, crumbCtx, panel, body } */

function tabLabel(id){ const t = TABS.find(x => x[0] === id); return t ? t[1] : id; }
function tabIcon(id){ return tabLabel(id).split(" ")[0]; }
function tabName(id){ return tabLabel(id).split(" ").slice(1).join(" "); }
function newGroup(tabs){ return { g:1, id: layoutSeq++, tabs: tabs.slice(), active: tabs[0] || null }; }
/* 既定: 広い窓なら左右2分割。左は眺める系 (進捗・応援・依頼・作品棚)、右は買う系
   (工場・スタッフ・研究)。めったに開かない統計・設定はアイコン列から開く */
function layoutDefault(){
  const wide = (window.innerWidth || 0) >= 1000;
  if(!wide) return newGroup(["proj", "factory", "staff", "click", "requests", "research", "shelf"]);
  return { dir:"row", sizes:[0.45, 0.55], kids:[
    newGroup(["proj", "click", "requests", "shelf"]),
    newGroup(["factory", "staff", "research"])
  ]};
}
function layoutGroups(node = menuLayout, out = []){
  if(!node) return out;
  if(node.g) out.push(node); else for(const k of node.kids) layoutGroups(k, out);
  return out;
}
function groupById(id){ return layoutGroups().find(g => g.id === id) || null; }
function groupOfTab(tab){ return layoutGroups().find(g => g.tabs.indexOf(tab) >= 0) || null; }
function focusedGroup(){ return groupById(focusGroupId) || layoutGroups()[0] || null; }
/* そのタブが今どこかのグループで表に出ているか (updater などの「設定を開いていたら再描画」用) */
function tabVisible(tab){
  if(!layoutLive) return currentTab === tab;
  return layoutGroups().some(g => g.active === tab);
}
/* 読み込んだ配置の検査: 未知のタブ・重複を落とし、空のグループと1人だけの分割を畳む */
function layoutSanitize(node, seen){
  if(!node || typeof node !== "object") return null;
  if(node.g){
    const tabs = (Array.isArray(node.tabs) ? node.tabs : []).filter(t =>
      typeof t === "string" && TABS.some(x => x[0] === t) && !seen[t] && (seen[t] = true));
    const g = newGroup(tabs);
    if(tabs.indexOf(node.active) >= 0) g.active = node.active;
    return g;
  }
  if(!Array.isArray(node.kids)) return null;
  const kids = [], sizes = [];
  node.kids.forEach((k, i) => {
    const s = layoutSanitize(k, seen);
    if(s){ kids.push(s); sizes.push(Number(node.sizes && node.sizes[i]) > 0 ? Number(node.sizes[i]) : 1); }
  });
  return layoutNormalize({ dir: node.dir === "col" ? "col" : "row", kids, sizes });
}
function layoutNormalize(node){
  if(!node || node.g) return node;
  const kids = [], sizes = [];
  node.kids.forEach((k, i) => {
    const n = layoutNormalize(k);
    if(!n || (n.g && !n.tabs.length)) return;
    /* 同じ向きの分割の入れ子は1段に均す (VS Code と同じ見え方) */
    if(!n.g && n.dir === node.dir){
      const tot = n.sizes.reduce((a, b) => a + b, 0) || 1;
      n.kids.forEach((kk, j) => { kids.push(kk); sizes.push(node.sizes[i] * n.sizes[j] / tot); });
    } else { kids.push(n); sizes.push(node.sizes[i] || 1); }
  });
  if(!kids.length) return null;
  if(kids.length === 1) return kids[0];
  const tot = sizes.reduce((a, b) => a + b, 0) || 1;
  return { dir: node.dir, kids, sizes: sizes.map(s => s / tot) };
}
function layoutTidy(){
  menuLayout = layoutNormalize(menuLayout) || newGroup([]);
  if(!groupById(focusGroupId)) focusGroupId = layoutGroups()[0].id;
  const fg = focusedGroup();
  currentTab = (fg && fg.active) || currentTab;
}
function layoutSave(){
  try{
    const plain = n => n.g ? { g:1, tabs: n.tabs, active: n.active } : { dir: n.dir, sizes: n.sizes, kids: n.kids.map(plain) };
    const fi = layoutGroups().indexOf(focusedGroup());
    localStorage.setItem(LAYOUT_KEY, JSON.stringify({ v:1, root: plain(menuLayout), focus: fi }));
  }catch(e){}
}
function layoutLoad(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null"); }catch(e){ raw = null; }
  const root = raw && raw.v === 1 ? layoutSanitize(raw.root, {}) : null;
  menuLayout = root || layoutDefault();
  const gs = layoutGroups();
  focusGroupId = (raw && gs[raw.focus] ? gs[raw.focus] : gs[0]).id;
  layoutTidy();
}
function resetMenuLayout(){
  try{ localStorage.removeItem(LAYOUT_KEY); }catch(e){}
  menuLayout = layoutDefault();
  focusGroupId = layoutGroups()[0].id;
  layoutTidy(); layoutMount(); renderPanel();
}

/* ---------- 操作 ---------- */
function activateTab(g, tab){
  g.active = tab; focusGroupId = g.id; currentTab = tab;
  tutVisitTab(tab);   /* チュートリアル: 🆕 は初回訪問で消える (viewer ではコマンド化される) */
}
/* タブを開く: どこかで開いていればそのグループへ、無ければ今のグループの隣に足す */
function openTab(tab){
  let g = groupOfTab(tab);
  if(!g){
    g = focusedGroup();
    const at = g.tabs.indexOf(g.active);
    g.tabs.splice(at < 0 ? g.tabs.length : at + 1, 0, tab);
  }
  activateTab(g, tab);
  layoutCommit();
}
function detachTab(tab){
  const g = groupOfTab(tab);
  if(!g) return;
  const i = g.tabs.indexOf(tab);
  g.tabs.splice(i, 1);
  if(g.active === tab) g.active = g.tabs[Math.min(i, g.tabs.length - 1)] || null;
}
function closeTab(tab){
  const g = groupOfTab(tab);
  if(!g) return;
  detachTab(tab);
  /* 最後の1グループは空でも残す (アイコン列から開き直す場所) */
  if(g.id === focusGroupId && g.active) currentTab = g.active;
  layoutCommit();
}
function moveTabTo(tab, gid, index){
  const g = groupById(gid);
  if(!g) return;
  const src = groupOfTab(tab);
  if(src === g){
    const from = g.tabs.indexOf(tab);
    if(index > from) index--;
  }
  detachTab(tab);
  g.tabs.splice(Math.max(0, Math.min(index, g.tabs.length)), 0, tab);
  activateTab(g, tab);
  layoutCommit();
}
/* 端へ落とした: 落とし先グループの隣に新しいグループを作る (VS Code の分割と同じ) */
function splitWithTab(tab, gid, side){
  const target = groupById(gid);
  if(!target) return;
  const src = groupOfTab(tab);
  if(src === target && target.tabs.length <= 1) return;   /* 自分1枚だけを自分の横へは割れない */
  if(layoutGroups().length >= LAYOUT_MAX_GROUPS && !(src && src.tabs.length === 1)){
    moveTabTo(tab, gid, target.tabs.length); return;
  }
  detachTab(tab);
  const ng = newGroup([tab]);
  const dir = side === "left" || side === "right" ? "row" : "col";
  const before = side === "left" || side === "top";
  const place = (node) => {
    if(node === target) return { dir, sizes:[0.5, 0.5], kids: before ? [ng, target] : [target, ng] };
    if(node.g) return node;
    const i = node.kids.indexOf(target);
    if(i >= 0 && node.dir === dir){
      const half = node.sizes[i] / 2;
      node.kids.splice(before ? i : i + 1, 0, ng);
      node.sizes.splice(i, 1, half, half);
      return node;
    }
    node.kids = node.kids.map(place);
    return node;
  };
  menuLayout = place(menuLayout);
  activateTab(ng, tab);
  layoutCommit();
}
function layoutCommit(){
  layoutTidy(); layoutSave(); layoutMount(); renderPanel();
}
function focusGroup(gid){
  if(focusGroupId === gid) return;
  focusGroupId = gid;
  const g = focusedGroup();
  if(g && g.active) currentTab = g.active;
  for(const k of Object.keys(groupDom)){
    const d = groupDom[k];
    d.root.classList.toggle("focused", +k === gid);
    /* 「今のグループ」のパネルだけが #panel を名乗る (旧来の参照と検証ツールの契約) */
    d.panel.id = +k === gid ? "panel" : "";
  }
  layoutSave();
  renderEditorBreadcrumbs();
}

/* ---------- DOM の組み立て ---------- */
function layoutMakeGroupDom(gid){
  const root = document.createElement("div");
  root.className = "egroup";
  const tabs = document.createElement("div");
  tabs.className = "tabs"; tabs.setAttribute("role", "tablist");
  const crumbs = document.createElement("div");
  crumbs.className = "editor-crumbs"; crumbs.setAttribute("aria-hidden", "true");
  const a = document.createElement("span"); a.textContent = "miyuke";
  const s1 = document.createElement("span"); s1.textContent = "›";
  const crumbTab = document.createElement("span"); crumbTab.className = "crumb-tab";
  const s2 = document.createElement("span"); s2.textContent = "›";
  const crumbCtx = document.createElement("span"); crumbCtx.className = "crumb-ctx";
  for(const x of [a, s1, crumbTab, s2, crumbCtx]) crumbs.appendChild(x);
  const body = document.createElement("div");
  body.className = "egroup-body";
  const panel = document.createElement("div");
  panel.className = "panel";
  body.appendChild(crumbs); body.appendChild(panel);
  root.appendChild(tabs); root.appendChild(body);
  root.addEventListener("pointerdown", () => focusGroup(gid), true);
  return { root, tabs, crumbTab, crumbCtx, panel, body, scroll: {} };
}
function layoutTabButton(tab, gid){
  const btn = document.createElement("button");
  btn.type = "button"; btn.textContent = tabLabel(tab); btn.dataset.tab = tab;
  btn.setAttribute("role", "tab");
  btn.title = tabName(tab) + "（ドラッグで移動・分割）";
  const mark = document.createElement("span");
  mark.className = "editor-tabmark"; mark.setAttribute("role", "button");
  mark.setAttribute("aria-label", tabName(tab) + "を閉じる");
  mark.addEventListener("pointerdown", (e) => { e.stopPropagation(); });
  mark.addEventListener("click", (e) => { e.stopPropagation(); closeTab(tab); });
  btn.appendChild(mark);
  btn.onclick = () => { const g = groupById(gid); if(g){ activateTab(g, tab); layoutCommit(); } };
  btn.addEventListener("auxclick", (e) => { if(e.button === 1){ e.preventDefault(); closeTab(tab); } });
  btn.addEventListener("pointerdown", (e) => tabDragStart(e, tab));
  return btn;
}
function layoutBuildNode(node, parent){
  if(node.g){
    let d = groupDom[node.id];
    if(!d) d = groupDom[node.id] = layoutMakeGroupDom(node.id);
    d.root.style.flex = "";
    while(d.tabs.firstChild) d.tabs.removeChild(d.tabs.firstChild);
    for(const t of node.tabs) d.tabs.appendChild(layoutTabButton(t, node.id));
    d.root.classList.toggle("focused", node.id === focusGroupId);
    d.panel.id = node.id === focusGroupId ? "panel" : "";
    parent.appendChild(d.root);
    return d.root;
  }
  const box = document.createElement("div");
  box.className = "esplit " + node.dir;
  node.kids.forEach((k, i) => {
    if(i > 0) box.appendChild(layoutGutter(node, i));
    const el = layoutBuildNode(k, box);
    el.style.flex = node.sizes[i] + " 1 0px";
  });
  parent.appendChild(box);
  return box;
}
/* 分割の境目: ドラッグで隣り合う2つの比率を動かす */
function layoutGutter(node, i){
  const gut = document.createElement("div");
  gut.className = "egutter " + node.dir;
  gut.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const box = gut.parentElement;
    const r = box.getBoundingClientRect();
    const total = node.dir === "row" ? r.width : r.height;
    const pair = node.sizes[i - 1] + node.sizes[i];
    const startPos = node.dir === "row" ? e.clientX : e.clientY;
    const startA = node.sizes[i - 1];
    const minF = Math.min(pair / 2, LAYOUT_MIN_PX / Math.max(1, total));
    const a = gut.previousElementSibling as HTMLElement, b = gut.nextElementSibling as HTMLElement;
    gut.classList.add("drag");
    const move = (ev) => {
      const d = ((node.dir === "row" ? ev.clientX : ev.clientY) - startPos) / Math.max(1, total);
      const na = Math.max(minF, Math.min(pair - minF, startA + d));
      node.sizes[i - 1] = na; node.sizes[i] = pair - na;
      a.style.flex = na + " 1 0px"; b.style.flex = (pair - na) + " 1 0px";
    };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      gut.classList.remove("drag"); layoutSave();
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  });
  return gut;
}
function layoutMount(){
  const area = document.getElementById("editor-area");
  /* 組み直すとパネルが一度外れてスクロール位置が消えるので、覚えて戻す */
  const tops = {};
  for(const k of Object.keys(groupDom)) tops[k] = groupDom[k].panel.scrollTop;
  while(area.firstChild) area.removeChild(area.firstChild);
  const alive = {};
  for(const g of layoutGroups()) alive[g.id] = true;
  for(const k of Object.keys(groupDom)) if(!alive[k]) delete groupDom[k];
  layoutBuildNode(menuLayout, area).style.flex = "1 1 0px";
  for(const k of Object.keys(tops)) if(groupDom[k] && groupDom[k].panel.scrollTop !== tops[k]) groupDom[k].panel.scrollTop = tops[k];
  document.body.classList.toggle("ed-split", layoutGroups().length > 1);
  layoutPaintActivity();
}
function layoutBuildActivity(){
  const bar = document.getElementById("activity-bar");
  for(const [id] of TABS){
    const b = document.createElement("button");
    b.type = "button"; b.dataset.tab = id; b.dataset.kind = "act";
    b.textContent = tabIcon(id);
    b.title = tabName(id);
    b.setAttribute("aria-label", tabName(id) + "を開く");
    if(id === "stats") b.style.marginTop = "auto";   /* 低頻度 (統計・設定) は VS Code の歯車と同じく下に寄せる */
    b.onclick = () => openTab(id);
    b.addEventListener("pointerdown", (e) => tabDragStart(e, id));
    bar.appendChild(b);
  }
}
function layoutPaintActivity(){
  try{
    for(const b of document.getElementById("activity-bar").children){
      const id = (b as HTMLElement).dataset.tab;
      const shown = layoutGroups().some(g => g.active === id);
      b.classList.toggle("on", shown);
      b.classList.toggle("open", !!groupOfTab(id));
      b.classList.toggle("locked", tutTabLocked(id));
    }
  }catch(e){}
}
/* paintTabs / updateTabBadges が塗る全タブボタン (タブ列 + アイコン列) */
function allTabButtons(){
  if(!layoutLive) return Array.prototype.slice.call(tabsEl.children);
  const out = [];
  for(const k of Object.keys(groupDom)) for(const b of groupDom[k].tabs.children) out.push(b);
  for(const b of document.getElementById("activity-bar").children) out.push(b);
  return out;
}

/* ---------- タブのドラッグ (ポインタで自前に。WebView のファイルドロップ処理と競合しない) ---------- */
let tabDrag = null;
function tabDragStart(e, tab){
  if(e.button !== 0) return;
  tabDrag = { tab, x: e.clientX, y: e.clientY, on: false, ghost: null, hint: null, drop: null };
  window.addEventListener("pointermove", tabDragMove);
  window.addEventListener("pointerup", tabDragEnd);
  window.addEventListener("pointercancel", tabDragEnd);
}
function tabDropAt(x, y){
  for(const g of layoutGroups()){
    const d = groupDom[g.id];
    const tr = d.tabs.getBoundingClientRect();
    if(x >= tr.left && x <= tr.right && y >= tr.top - 4 && y <= tr.bottom){
      let idx = g.tabs.length;
      const btns = d.tabs.children;
      for(let i = 0; i < btns.length; i++){
        const r = btns[i].getBoundingClientRect();
        if(y <= r.bottom && x < r.left + r.width / 2){ idx = i; break; }
      }
      return { kind:"strip", gid: g.id, index: idx, rect: tr, btn: btns[idx] || null };
    }
    const br = d.body.getBoundingClientRect();
    if(x >= br.left && x <= br.right && y >= br.top && y <= br.bottom){
      const fx = (x - br.left) / br.width, fy = (y - br.top) / br.height;
      let side = "center";
      const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
      if(edge < 0.25) side = edge === fx ? "left" : edge === 1 - fx ? "right" : edge === fy ? "top" : "bottom";
      /* 狭すぎて割れない向きは「このグループへ移動」に落とす */
      if((side === "left" || side === "right") && br.width < LAYOUT_MIN_PX * 2) side = "center";
      if((side === "top" || side === "bottom") && br.height < 240) side = "center";
      return { kind:"body", gid: g.id, side, rect: br };
    }
  }
  return null;
}
function tabDragMove(e){
  const t = tabDrag;
  if(!t) return;
  if(!t.on){
    if(Math.abs(e.clientX - t.x) + Math.abs(e.clientY - t.y) < 7) return;
    t.on = true;
    t.ghost = document.createElement("div"); t.ghost.className = "tab-ghost"; t.ghost.textContent = tabLabel(t.tab);
    t.hint = document.createElement("div"); t.hint.className = "drop-hint";
    document.body.appendChild(t.ghost); document.body.appendChild(t.hint);
    document.body.classList.add("tab-dragging");
  }
  t.ghost.style.left = (e.clientX + 12) + "px"; t.ghost.style.top = (e.clientY + 10) + "px";
  const d = t.drop = tabDropAt(e.clientX, e.clientY);
  const h = t.hint.style;
  if(!d){ h.display = "none"; return; }
  h.display = "block";
  t.hint.className = "drop-hint " + (d.kind === "strip" ? "strip" : d.side);
  const r = d.rect;
  if(d.kind === "strip"){
    const br = d.btn ? d.btn.getBoundingClientRect() : null;
    const lastBtn = d.btn ? null : groupDom[d.gid].tabs.lastElementChild;
    const lr = lastBtn ? lastBtn.getBoundingClientRect() : null;
    const x = br ? br.left : lr ? lr.right : r.left;
    const top = br ? br.top : lr ? lr.top : r.top;
    const hh = br ? br.height : lr ? lr.height : r.height;
    h.left = (x - 1) + "px"; h.top = top + "px"; h.width = "3px"; h.height = Math.max(20, hh) + "px";
    return;
  }
  let L = r.left, T = r.top, W = r.width, H = r.height;
  if(d.side === "left") W = W / 2;
  else if(d.side === "right"){ L += W / 2; W = W / 2; }
  else if(d.side === "top") H = H / 2;
  else if(d.side === "bottom"){ T += H / 2; H = H / 2; }
  h.left = L + "px"; h.top = T + "px"; h.width = W + "px"; h.height = H + "px";
}
function tabDragEnd(){
  const t = tabDrag;
  tabDrag = null;
  window.removeEventListener("pointermove", tabDragMove);
  window.removeEventListener("pointerup", tabDragEnd);
  window.removeEventListener("pointercancel", tabDragEnd);
  if(!t || !t.on) return;   /* 動かしていなければ普通のクリック (onclick 側で開く) */
  try{ t.ghost.remove(); t.hint.remove(); }catch(e){}
  document.body.classList.remove("tab-dragging");
  /* ドラッグの直後に来る click で、落とした先のタブ切り替えが上書きされないように1回だけ握る */
  const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
  window.addEventListener("click", swallow, { capture: true, once: true });
  setTimeout(() => window.removeEventListener("click", swallow, true), 0);
  const d = t.drop;
  if(!d) return;
  if(d.kind === "strip") moveTabTo(t.tab, d.gid, d.index);
  else if(d.side === "center"){ const g = groupById(d.gid); moveTabTo(t.tab, d.gid, g ? g.tabs.length : 0); }
  else splitWithTab(t.tab, d.gid, d.side);
}

/* パンくず (飾り): 各グループの今のタブと状態。textContent なのでプロジェクト名は不活性 */
function renderEditorBreadcrumbs(){
  if(!layoutLive){ renderEditorBreadcrumb(); return; }
  const keep = currentTab;
  for(const g of layoutGroups()){
    const d = groupDom[g.id];
    if(!d) continue;
    currentTab = g.active;
    const label = g.active ? tabLabel(g.active) : "";
    const ctx = g.active ? editorCrumbContext() : "";
    if(d.crumbTab.textContent !== label) d.crumbTab.textContent = label;
    if(d.crumbCtx.textContent !== ctx) d.crumbCtx.textContent = ctx;
  }
  currentTab = keep;
}

/* 組み立て: 失敗したら (スタブの DOM など) 従来の1枚表示のまま */
function initMenuLayout(){
  const area = document.getElementById("editor-area");
  const legacy = document.getElementById("egroup-legacy");
  if(!area || !legacy || typeof area.removeChild !== "function" || !document.getElementById("activity-bar")) return;
  try{
    layoutLoad();
    layoutBuildActivity();
    layoutLive = true;
    layoutMount();   /* #editor-area を作り直すので、1枚表示の #tabs / #panel はここで外れる */
  }catch(e){
    console.error("[miyuke] 分割ビューを組み立てられませんでした (1枚表示で続けます)", e);
    layoutLive = false;
    try{ while(area.firstChild) area.removeChild(area.firstChild); area.appendChild(legacy); }catch(err){}
  }
}
initMenuLayout();
