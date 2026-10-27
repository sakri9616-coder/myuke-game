/* ---------- 2ウィンドウ化 (Phase 0/1): 同期プロトコル (設計 §3) ----------
   輸送は Tauri イベント (emitTo / listen)。menu→帯: コマンド {id, verb, args}。
   帯→menu: フルスナップショット {v, seq, rev, at, S, live} を menu 表示中のみ
   2Hz + コマンド実行直後 + セリフ直後。配送保証は無いので ready/heartbeat で
   ハンドシェイクする (ready → 帯が即1回送信、heartbeat 5秒途絶 → 送信停止)。
   設計制約 (sakuri 確定の原則): 重要な体験・通知・操作はすべてメニュー非表示でも
   成立すること。メニューは着脱式の管理コンソールであり、開いていないと欠ける
   状態を作らない。スナップショットが「表示中のみ」なのは表示のための同期だから
   原則と矛盾しない (帯側の進行は menu の存否と無関係に回り続ける)。 */

/* コマンドの動詞レジストリ: 既存の操作関数名をそのまま動詞にする。
   exportSave だけは「帯がテキストを作り、ダウンロードは menu 側」の分担のため
   テキストを返す専用エントリ。resetSave は確認なしの実体 (確認は送り側で済ませる) */
function exportSaveText(){
  const t = serializeSave();
  if(t){ addLog("💾 セーブデータを書き出した"); say("セーブを書き出したにゃ"); }
  return t;
}
const VERBS = {
  buyUpgrade: buyUpgrade, buyResearch: buyResearch, buyClickUp: buyClickUp, buyEngine: buyEngine,
  hireStaff: hireStaff, trainStaff: trainStaff, buyBulkTrain: buyBulkTrain,
  buyTreat: buyTreat, buyStudio: buyStudio,
  acceptRequest: acceptRequest, genRequests: genRequests,
  buyDept: buyDept, setReqGenrePref: setReqGenrePref, acceptBigDeal: acceptBigDeal, declineBigDeal: declineBigDeal,
  dropRequest: dropRequestCore,
  foundSub: foundSub, addSubStaff: addSubStaff, scaleSub: scaleSub, setAlloc: setAlloc, setSubDiv: setSubDiv, sellSub: sellSubCore,
  activateFever: activateFever,
  buyDustPerk: buyDustPerk, doPrestige: doPrestigeCore,
  buyLegacyTech: buyLegacyTech, doHoldings: doHoldingsCore,
  startChallenge: startChallenge, abandonChallenge: abandonChallenge,
  setDevGenrePref: setDevGenrePref, designateIP: designateIP, planProject: planProject,
  doDeathMarch: doDeathMarchCore,
  outsourceBugs: outsourceBugsCore,
  moduleOutsource: moduleOutsourceCore,
  moduleWeight: moduleWeightCore,
  giveSnack: giveSnack,
  togglePause: togglePause, toggleSound: toggleSound, setSoundVol: setSoundVol,
  toggleInputCount: toggleInputCount,
  setStripSize: setStripSize, resetLayout: resetLayout, toggleLayoutEdit: toggleLayoutEdit, toggleSnapLayout: toggleSnapLayout, toggleReduceMotion: toggleReduceMotion,
  tutSkipGuide: tutSkipGuide, tutResetGuide: tutResetGuide, tutVisitTab: tutVisitTab,
  updCheckManual: updCheckManual, updDownload: updDownload,
  updRelaunch: updRelaunch, updDismiss: updDismiss,
  buyMany: buyMany,
  exportSave: exportSaveText, importSaveText: importSaveText, resetSave: doResetSave
};

/* 長押し連続購入: 同じ購入を最大 n 回つづけて行い、実際に買えた回数を返す。
   1回ごとの保存・再描画・スナップショットは quietBuy で止めて、最後に1回だけ行う。
   ログは同じ形の行 (数字と（）内の違いだけ) を1行にまとめ、×回数を添える。
   買えなくなった (どの通貨も減らなかった) 時点で止める。メニューからは1コマンドで届く */
const HOLD_VERBS = {
  buyUpgrade: 1, buyEngine: 1, buyResearch: 1, buyClickUp: 1, hireStaff: 1, trainStaff: 1, buyBulkTrain: 1,
  buyTreat: 1, buyStudio: 1, buyDept: 1, addSubStaff: 1, scaleSub: 1, buyDustPerk: 1
};
let bulkLogLast: { entry: { tm: string; text: string }; shape: string; n: number } | null = null;
function buyMany(verb, args, n){
  if(IS_VIEWER || quietBuy) return 0;
  if(typeof verb !== "string" || !Object.prototype.hasOwnProperty.call(HOLD_VERBS, verb)) return 0;
  const fn = VERBS[verb];
  const a = Array.isArray(args) ? args : [];
  const max = Math.max(1, Math.min(200, Math.floor(Number(n) || 1)));
  const wallet = () => S.coins + "|" + S.rp + "|" + S.dust + "|" + (S.cheerP || 0);
  let bought = 0;
  quietBuy = { log: [] };
  try{
    for(let i = 0; i < max; i++){
      const before = wallet();
      fn.apply(null, a);
      if(wallet() === before) break;
      bought++;
    }
  }catch(e){ console.error("[miyuke] buyMany で例外", e); }
  const logs = quietBuy.log;
  quietBuy = null;
  /* 同じ形の購入ログ (数字違い) は最後の1行に「×回数」を添えてまとめる。節目などはそのまま残る */
  const shapes = {}, order = [];
  for(const L of logs){
    /* 節目ジャンプ (✨) は1つずつ知らせたいのでまとめない */
    const k = L.text.charAt(0) === "✨" ? "✨" + order.length : L.text.replace(/（[^）]*）/g, "").replace(/[0-9.,]+/g, "#");
    if(!shapes[k]){ shapes[k] = { text: L.text, n: 0 }; order.push(k); }
    shapes[k].text = L.text; shapes[k].n++;
  }
  for(const k of order){
    /* 直前の歩のまとめ行がログの先頭に残っていれば、そこへ回数を足す (長押し1回でログを埋めない) */
    const top = S.log[0];
    if(bulkLogLast && top === bulkLogLast.entry && bulkLogLast.shape === k){
      bulkLogLast.n += shapes[k].n;
    } else {
      addLog(shapes[k].text);
      bulkLogLast = { entry: S.log[0], shape: k, n: shapes[k].n };
    }
    bulkLogLast.entry.text = shapes[k].text + (bulkLogLast.n > 1 ? " ×" + bulkLogLast.n : "");
  }
  if(bought > 0){
    if(lastSayText) say(lastSayText);
    save(); renderPanel();
  }
  bumpRev();   /* menu からのコマンドなら、返事と一緒にスナップショットが1回だけ送られる */
  return bought;
}
window.__miyukeBuyMany = buyMany;   /* テスト/デバッグ用フック */

/* ----- owner 側: スナップショット送信とコマンド実行 ----- */
function buildSnapshot(){
  return {
    v: 1, seq: ++snapSeq, rev: snapRev, at: Date.now(),
    S: JSON.parse(JSON.stringify(S)),
    live: {
      say: { text: stripSay.text, until: stripSay.until },
      catState: catState,
      combo: { n: comboN, mult: comboMult() },
      snackReadyIn: Math.max(0, snackReadyAt - Date.now()),
      upd: { status: upd.status, version: upd.version, got: upd.got, total: upd.total, dismissed: upd.dismissed },
      osInput: { wanted: osInputWanted, last: osInputLast },
      rates: { coinsPerMin: incomeRatePerMin("coins"), rpPerMin: incomeRatePerMin("rp") },
      returnInfo: returnInfo,
      menuAwake: menuAwake
    }
  };
}
function sendSnapshotNow(){
  if(IS_VIEWER || !menuAwake || !inTauri()) return;
  const T = window.__TAURI__;
  if(!(T.event && T.event.emitTo)) return;
  try{
    const p = T.event.emitTo("menu", "state-snapshot", buildSnapshot());
    if(p && p.catch) p.catch(function(){});
  }catch(e){}
}
window.__miyukeSendSnapshot = sendSnapshotNow;   /* テスト/デバッグ用フック */
function cmdPayload(v){
  if(typeof v === "string") return { text: v };
  if(typeof v === "boolean" || typeof v === "number") return { value: v };
  return null;
}
function dispatchMenuCommand(m){
  const reply = (ok, payload, error?) => {
    const T = window.__TAURI__;
    if(T && T.event && T.event.emitTo){
      try{
        const p = T.event.emitTo("menu", "cmd-result",
          { id: m && m.id, ok: !!ok, payload: payload || null, error: error || null });
        if(p && p.catch) p.catch(function(){});
      }catch(e){}
    }
    bumpRev(); sendSnapshotNow();   /* 実行直後は即時スナップショット (設計 §3.4) */
  };
  /* 自前のプロパティだけを許す ("constructor" などの継承プロパティで関数を引かない) */
  const fn = m && typeof m.verb === "string" && Object.prototype.hasOwnProperty.call(VERBS, m.verb) ? VERBS[m.verb] : null;
  SoundKit.unlock();   /* メニューでの操作もユーザー操作として扱い、帯の音を鳴らせるようにする */
  if(!fn){ reply(false, null, "unknown verb: " + (m && m.verb)); return; }
  try{
    const r = fn.apply(null, Array.isArray(m.args) ? m.args : []);
    if(r && typeof r.then === "function"){
      r.then(v => reply(true, cmdPayload(v)),
             e => reply(false, null, String((e && e.message) || e)));
    } else reply(true, cmdPayload(r));
  }catch(e){ reply(false, null, String((e instanceof Error && e.message) || e)); }
}
/* menu 内の入力 (キー回数・カーソル距離だけ) を帯のブースト材料へ合流させる。
   ゲート (一時停止 / OS集計との二重計数防止) は帯が一元管理する (設計 §3.5) */
function feedMenuInput(p){
  if(!p || S.settings.pauseInput) return;
  if(osCountingActive()) return;
  const keys = Math.max(0, Math.floor(Number(p.keys) || 0));
  const dist = Math.max(0, Number(p.distPx) || 0);
  if(keys > 0){ keysAcc += keys; S.totals.keys += keys; S.today.keys += keys; }
  if(dist > 0){ cursorAcc += dist; S.totals.cursorPx += dist; S.today.cursorPx += dist; }
  if(keys > 0 || dist > 0){ lastInputAt = Date.now(); noteInput(); }
}
function initOwnerProtocol(){
  if(IS_VIEWER || !inTauri()) return;
  const T = window.__TAURI__;
  if(!(T.event && T.event.listen)) return;
  const on = (ev, fn) => { try{ const p = T.event.listen(ev, fn); if(p && p.catch) p.catch(function(){}); }catch(e){} };
  on("menu-ready", () => { menuLastBeat = Date.now(); menuAwake = true; sendSnapshotNow(); });
  on("menu-heartbeat", () => { menuLastBeat = Date.now(); menuAwake = true; });
  on("menu-cmd", (ev) => { dispatchMenuCommand(ev && ev.payload); });
  on("menu-input", (ev) => { feedMenuInput(ev && ev.payload); });
  on("save-now", () => { save(); });   /* トレイの「終了」直前に Rust が送る (最後の進行を書き残す) */
  on("viewer-trap", (ev) => { try{ console.warn("[miyuke] viewer save-trap:", JSON.stringify(ev && ev.payload)); }catch(e){} });
  /* 2Hz の定期送信。heartbeat が 5 秒途絶えたら menu は消えた/固まったものとして止める */
  setInterval(() => {
    if(menuAwake && Date.now() - menuLastBeat > 5000) menuAwake = false;
    sendSnapshotNow();
  }, 500);
}

/* ----- viewer 側: スナップショット受信・コマンド送信・書き込みトラップ ----- */
let viewerSeq = -1, viewerRev = -1, viewerSynced = false;
let cmdSeq = 0;
const pendingCmds = {};            /* id -> { btn, timer, onResult } */
const menuInputAcc = { keys: 0, distPx: 0 };   /* §3.5: menu 内入力の集計 (回数と距離だけ) */
const viewerSaveTrap = { hits: 0 };
window.__viewerSaveTrap = viewerSaveTrap;
let viewerReturnShown = false;

let viewerNoteTimer;
function showViewerNote(text){
  let el = document.getElementById("viewer-note");
  if(!el){
    el = document.createElement("div");
    el.id = "viewer-note";
    el.style.cssText = "position:fixed;top:10px;right:12px;z-index:99;background:#fff5e6;" +
      "border:2px solid #604b40;border-radius:10px;padding:6px 12px;font-size:12.5px;" +
      "font-weight:700;box-shadow:0 2px 8px rgba(40,26,12,.25);display:none";
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.display = "";
  clearTimeout(viewerNoteTimer);
  viewerNoteTimer = setTimeout(() => { el.style.display = "none"; }, 3200);
}
function sendMenuCmd(verb, args, btn, onResult){
  const T = window.__TAURI__;
  if(!(T && T.event && T.event.emitTo)){ showViewerNote("帯と通信できませんでした"); return; }
  const id = ++cmdSeq;
  const rec = { btn: btn || null, onResult: onResult || null, timer: 0 };
  pendingCmds[id] = rec;
  if(rec.btn) rec.btn.disabled = true;
  /* 帯が受け取れない間は 400ms で諦めてボタンを戻す。自動リトライはしない
     (購入等のコマンドは冪等でないので二重実行を防ぐ。設計 §3.3) */
  rec.timer = setTimeout(() => {
    if(pendingCmds[id]){
      delete pendingCmds[id];
      if(rec.btn) rec.btn.disabled = false;
      showViewerNote("帯と通信できませんでした");
    }
  }, 400);
  try{
    const p = T.event.emitTo("main", "menu-cmd", { id: id, verb: verb, args: args || [] });
    if(p && p.catch) p.catch(function(){});
  }catch(e){ showViewerNote("帯と通信できませんでした"); }
}
function handleCmdResult(m){
  if(!m) return;
  const rec = pendingCmds[m.id];
  if(!rec) return;
  delete pendingCmds[m.id];
  clearTimeout(rec.timer);
  if(rec.btn) rec.btn.disabled = false;
  if(rec.onResult){ try{ rec.onResult(m); }catch(e){} }
  else if(!m.ok) showViewerNote("帯と通信できませんでした");
}
function makeVerbStub(verb){
  return function(){
    const args = Array.prototype.slice.call(arguments);
    if(verb === "resetSave"){
      /* 二重確認は menu 側で済ませてから送る (帯の帯画面で confirm を出さない) */
      if(!confirm("セーブデータを初期化しますか？")) return;
      if(!confirm("本当に消しますか？作品棚・実績・星屑も消えます。")) return;
    }
    if(verb === "doPrestige"){
      /* 確認は menu 側で済ませてから送る (resetSave と同じ。帯側で confirm が
         出ると帯のスレッドが止まって全体が固まる)。文面は帯側 doPrestige と同一 */
      const pv = prestigePreview();
      if(pv.gain < 3){ showViewerNote("売却には星屑3個ぶんの実績がいるにゃ（現在 " + pv.gain + " 個ぶん）"); return; }
      if(!confirm("会社を売却しますか？\n星屑 " + pv.gain + " 個を得て、生産倍率は ×" + pv.curMult.toFixed(2) + " → ×" + pv.nextMult.toFixed(2) + " になります。\nリセット: " + pv.resets.join("・") + "\n引き継ぎ: " + pv.keeps.join("・"))) return;
      args.push(execSelArg(), vetSelArg(), swapSelArg());   /* 第2ウェーブ M: 役員とベテランの選択を帯へ渡す */
    }
    if(verb === "doHoldings"){
      /* 持株化の確認も menu 側で済ませる (doPrestige と同じ分担) */
      const hp = holdingsPreview();
      if(!hp.can){ showViewerNote("持株化の条件がまだ揃っていないにゃ"); return; }
      if(!confirm("ホールディングス化しますか？\n星団 " + hp.gain + " 個を得ます。\nリセット: コイン・スタッフ・研究・部署・子会社・星屑と星屑特典（第1層は畳まれます）\n残るもの: レガシー技術・作品棚・実績スタンプ・最高到達社格・レイアウト")) return;
    }
    if(verb === "resetLayout"){
      /* 手で並べた配置が消えるので確認する (帯側では confirm を出さない) */
      if(!confirm("家具と小物の並びを初期配置に戻しますか？\n手で動かした配置は消えます")) return;
    }
    if(verb === "outsourceBugs"){
      /* 外注の確認は menu 側で済ませる (帯側では confirm を出さない) */
      const bugs = Math.floor(S.bugStock), debtCut = Math.floor((S.debt || 0) * 0.4);
      const coins = bugs * 30 + Math.floor(S.debt || 0) * 15;
      if((bugs > 0 || debtCut > 0) && !confirm("外注ベンダーに依頼しますか？\nバグ " + bugs + " 匹を全消し ＋ 技術的負債 -" + debtCut + "\n費用: " + coins + "🪙")) return;
    }
    if(verb === "doDeathMarch"){
      /* デスマーチの確認は menu 側で済ませる (帯側では confirm を出さない) */
      const p = S.project;
      if(p && p.totalDP){
        const frac = S.projectDP / p.totalDP;
        const bugs = Math.floor(S.bugStock);
        const debtAdd = Math.round((1 - frac) * ({ TUT: 15, XS: 30, S: 60, M: 120, L: 240 }[p.size] || 60)) + bugs * 2;
        if(frac >= 0.7 && !confirm("デスマーチ出荷しますか？\n残りの工程を飛ばして『" + p.name + "』を即リリースします。\n代価: 技術的負債 +" + debtAdd + " / ブランド -2")) return;
      }
    }
    if(verb === "dropRequest"){
      /* 大型案件の見送りだけ menu 側で確認する (帯側では confirm を出さない) */
      if(S.activeRequest && S.activeRequest.big){
        if(!confirm("大型案件（" + S.activeRequest.client + "）を見送りますか？\n大きなボーナスを逃します（ペナルティはありません）")) return;
      }
    }
    if(verb === "sellSub"){
      /* 部分EXIT の確認は menu 側で済ませる (帯側では confirm を出さない) */
      const sub = (S.subs || []).find(s => s.id === (args && args[0]));
      if(sub){
        if(!confirm("子会社「" + sub.name + "」を売却しますか？（部分EXIT）\n星屑 " + subDustValue(sub) + " 個を得ます。本社と他の子会社はそのまま残ります")) return;
      }
    }
    let btn = null;
    try{
      const ev = window.event;
      const t = ev && (ev.currentTarget || ev.target) as HTMLElement;
      if(t && t.tagName === "BUTTON") btn = t;
    }catch(e){}
    sendMenuCmd(verb, args, btn, (m) => {
      if(verb === "exportSave"){
        if(m.ok && m.payload && m.payload.text){
          if(downloadSaveText(m.payload.text)) showViewerNote("セーブを書き出したにゃ");
          else showViewerNote("書き出しに失敗したにゃ");
        } else showViewerNote("書き出しに失敗したにゃ");
      } else if(verb === "importSaveText"){
        showViewerNote(m.ok && m.payload && m.payload.value
          ? "セーブを読み込んだにゃ！" : "そのファイルは読み込めなかったにゃ");
      } else if(!m.ok){
        showViewerNote("帯と通信できませんでした");
      }
    });
  };
}
function installViewerStubs(){
  for(const verb of Object.keys(VERBS)){
    try{ window[verb] = makeVerbStub(verb); }catch(e){}
  }
}
function applySnapshot(snap){
  if(!snap || typeof snap.seq !== "number") return;
  if(snap.seq <= viewerSeq) return;          /* 古い/重複スナップショットは捨てる */
  viewerSeq = snap.seq;
  const L = snap.live || {};
  if(snap.S) S = snap.S;                     /* レプリカへ丸ごと差し替え (唯一の真実は帯) */
  if(L.say){
    stripSay = { text: L.say.text || "", until: L.say.until || 0 };
    if(L.say.text && L.say.text !== lastSayText){
      lastSayText = L.say.text;
      const bt = document.getElementById("bubble-text");
      if(bt) bt.textContent = lastSayText;
    }
  }
  if(L.combo) comboN = L.combo.n || 0;
  if(typeof L.snackReadyIn === "number") snackReadyAt = Date.now() + L.snackReadyIn;
  if(L.upd){
    upd.status = L.upd.status || "idle"; upd.version = L.upd.version || null;
    upd.got = L.upd.got || 0; upd.total = L.upd.total || 0; upd.dismissed = !!L.upd.dismissed;
    paintUpd();
  }
  if(L.osInput){ osInputLast = L.osInput.last || osInputLast; osInputWanted = !!L.osInput.wanted; }
  /* おかえりカード: 帯が用意した returnInfo を menu 側の DOM で描く (§5.3)。
     閉じる操作は menu ローカル (帯の状態に影響しない純表示) */
  if(L.returnInfo){
    returnInfo = L.returnInfo;
    if(!viewerReturnShown){ viewerReturnShown = true; renderReturnCard(); }
  } else if(returnInfo){
    returnInfo = null; viewerReturnShown = false; closeReturnCard();
  }
  if(returnShownAt && Date.now() - returnShownAt > 4 * 60000){ returnShownAt = 0; closeReturnCard(); }
  viewerSynced = true;
  renderHeader();
  /* 隠れている間はパネルを作り直さない (再表示時は menu-ready → 新しいスナップショットで描く) */
  if(snap.rev !== viewerRev && !document.hidden){ viewerRev = snap.rev; renderPanel(); }
}
function notifySaveTrap(kind){
  const T = window.__TAURI__;
  if(T && T.event && T.event.emitTo){
    try{
      const p = T.event.emitTo("main", "viewer-trap", { kind: kind, at: Date.now() });
      if(p && p.catch) p.catch(function(){});
    }catch(e){}
  }
}
function initViewer(){
  /* 第3層ガード: 書き込みトラップ。viewer が SAVE_KEY へ書こうとしたら
     遮断し、コンソールエラー + 帯への通知で開発中に即検出する (設計 §2.3/§5.5) */
  try{
    const ls = window.localStorage;
    if(ls){
      const origSet = ls.setItem.bind(ls), origRemove = ls.removeItem.bind(ls);
      ls.setItem = function(k, v){
        if(k === SAVE_KEY){
          viewerSaveTrap.hits++;
          console.error("[viewer] SAVE_KEY への書き込みを遮断しました");
          notifySaveTrap("setItem");
          return;
        }
        return origSet(k, v);
      };
      ls.removeItem = function(k){
        if(k === SAVE_KEY){
          viewerSaveTrap.hits++;
          console.error("[viewer] SAVE_KEY の削除を遮断しました");
          notifySaveTrap("removeItem");
          return;
        }
        return origRemove(k);
      };
    }
  }catch(e){}
  installViewerStubs();
  const T = window.__TAURI__;
  if(T && T.event && T.event.listen){
    const on = (ev, fn) => { try{ const p = T.event.listen(ev, fn); if(p && p.catch) p.catch(function(){}); }catch(e){} };
    on("state-snapshot", (ev) => { applySnapshot(ev && ev.payload); });
    on("cmd-result", (ev) => { handleCmdResult(ev && ev.payload); });
    on("open-tab", (ev) => { const t = ev && ev.payload && ev.payload.tab; if(t) switchTab(t); });
  }
  const emitBc = (ev) => {
    const T2 = window.__TAURI__;
    if(T2 && T2.event && T2.event.emit){
      try{ const p = T2.event.emit(ev); if(p && p.catch) p.catch(function(){}); }catch(e){}
    }
  };
  emitBc("menu-ready");   /* 帯と Rust の両方が拾う (帯: 即スナップショット / Rust: open-tab 再送) */
  /* 隠れている間は heartbeat を止める: 帯は5秒で「menu は寝ている」と判断し、
     2Hz のスナップショット送信を止める (閉じたメニューのために同期し続けない) */
  setInterval(() => { if(!document.hidden) emitBc("menu-heartbeat"); }, 2000);
  /* 再表示直後の取りこぼし防止: 見える状態に戻ったら ready を送り直す (冪等) */
  try{
    document.addEventListener("visibilitychange", () => { if(!document.hidden) emitBc("menu-ready"); });
  }catch(e){}
  /* §3.5: menu 内の入力は回数と距離だけを 1 秒ごとに帯へ送る (内容は読まない) */
  setInterval(() => {
    if(menuInputAcc.keys <= 0 && menuInputAcc.distPx <= 0) return;
    const T3 = window.__TAURI__;
    if(T3 && T3.event && T3.event.emitTo){
      try{
        const p = T3.event.emitTo("main", "menu-input",
          { keys: menuInputAcc.keys, distPx: Math.round(menuInputAcc.distPx) });
        if(p && p.catch) p.catch(function(){});
      }catch(e){}
    }
    menuInputAcc.keys = 0; menuInputAcc.distPx = 0;
  }, 1000);
}

