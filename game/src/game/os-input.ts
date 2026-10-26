/* ---------- Phase 2: OS全体の入力集計（Tauri デスクトップ版のみ） ----------
   Rust 側（rdev）が OS 全体の「打鍵の回数・クリックの回数・カーソルの移動距離」
   だけを数え、約5秒ごとに "input-activity" イベントで集計を送ってくる。
   どのキーか・何を打ったかは Rust 側でも一切見ていない。既定は OFF で、
   設定で明示的に ON にしたときだけ Rust 側の集計が始まる。
   ON の間はページ内の打鍵／カーソル集計と二重に数えない（OS 側が同じ入力を
   見ているため）。ページ内の応援クリックは別系統なので影響しない。 */
let osInputLast = { keys:0, distPx:0, clicks:0, at:0 };   /* 直近に届いた OS 集計（設定画面の表示用） */
let osInputWanted = false;   /* ページが Rust へ要求した状態（= settings.inputCount の実効値） */
function inTauri(){ return !!window.__TAURI__; }
function osCountingActive(){ return osInputWanted; }
/* v2.4.1: invoke 無応答時の beacon フォールバック (ブートストラップ側と同方式) */
const BEACON_CMDS = {
  open_menu: function(a){ return ["open-menu", (a && a.tab) ? a.tab : null]; },
  set_mode_full: function(){ return ["open-menu", null]; },
  hide_main_window: function(){ return ["hide-strip", null]; },
  hide_strip_window: function(){ return ["hide-strip", null]; }
};
function beaconCmd(c, t){
  try{
    const B = window.__MIYUKE_BEACON__;
    if(!B) return;
    const u = "http://127.0.0.1:" + B.port + "/cmd?k=" + B.token + "&c=" + c + (t ? "&t=" + encodeURIComponent(t) : "");
    fetch(u, { mode: "cors" }).catch(function(){});
  }catch(e){}
}
function tauriCmd(cmd, args?){
  try{
    const T = window.__TAURI__;
    if(!T) return null;
    const inv = (T.core && T.core.invoke) ? T.core.invoke.bind(T.core) : T.invoke;
    const p = inv(cmd, args);
    if(p && p.catch) p.catch(function(){});
    const bc = BEACON_CMDS[cmd];
    if(p && bc){
      let settled = false;
      const mark = function(){ settled = true; };
      try{ p.then(mark, mark); }catch(e){}
      setTimeout(function(){ if(!settled){ const pair = bc(args); beaconCmd(pair[0], pair[1]); } }, 700);
    }
    return p;
  }catch(e){ return null; }
}
/* 設定値を Rust 側へ反映する（ブラウザでは何もしない） */
function applyInputCounting(){
  osInputWanted = !!(S.settings && S.settings.inputCount);
  if(!inTauri()) return;
  tauriCmd("set_input_counting", { enabled: osInputWanted });
}
/* Rust からの集計を、ページ内集計と同じブースト材料（keysAcc / cursorAcc / clicksAcc）に流す。
   換算式と1分上限は tick 側の既存処理（boostGate）がそのまま担う */
function feedOsActivity(p){
  if(!p) return;
  const keys = Math.max(0, Math.floor(Number(p.keys) || 0));
  const dist = Math.max(0, Number(p.distPx) || 0);
  const clicks = Math.max(0, Math.floor(Number(p.clicks) || 0));
  osInputLast = { keys: keys, distPx: dist, clicks: clicks, at: Date.now() };
  if(S.settings.pauseInput) return;   /* 一時停止中はページ内と同じく集計しない */
  if(challengeActive("idle")) return;   /* 第2ウェーブ K: 完全放置中は入力カウント自体が止まる */
  if(keys > 0 || dist > 0 || clicks > 0){
    keysAcc += keys; cursorAcc += dist; clicksAcc += clicks;
    S.totals.keys += keys; S.today.keys += keys;
    S.totals.cursorPx += dist; S.today.cursorPx += dist;
    /* OSクリックはブースト材料（clicksAcc）にだけ流す。S.totals.clicks は
       応援クリックの実績系なので混ぜない（レーンA・clicksPerDP 配線） */
    lastInputAt = Date.now();
    noteInput();
  }
}
/* 起動時: イベント購読を張り、保存済み設定が ON なら集計を開始する。
   viewer は input-activity を購読しない (Rust の broadcast が両窓に届くため、
   購読すると OS 集計が二重計数になる。設計 §5.2) */
function initInputCounting(){
  if(IS_VIEWER) return;
  if(!inTauri()) return;
  try{
    const T = window.__TAURI__;
    if(T.event && T.event.listen){
      const pr = T.event.listen("input-activity", function(ev){ feedOsActivity(ev && ev.payload); });
      if(pr && pr.catch) pr.catch(function(){});
    }
  }catch(e){}
  applyInputCounting();
}
/* 設定タブのトグル */
function toggleInputCount(){
  if(!inTauri()) return;
  S.settings.inputCount = !S.settings.inputCount;
  save(); applyInputCounting(); renderPanel();
  say(S.settings.inputCount
    ? "OS全体の入力カウントを始めるにゃ（数えるのは回数と距離だけ）"
    : "OS全体の入力カウントを止めたにゃ");
}

