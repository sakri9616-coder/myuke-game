/* デスクトップ版の形態（form）とロール（role）。
   2ウィンドウ化 (Phase 0/1, 設計 research/TWO_WINDOW_ARCHITECTURE.md):
   帯ウィンドウ (ラベル main, ロール owner) は画面下部の透明な帯に固定され、
   二度と変形しない。管理画面は第2ウィンドウ (ラベル menu, ロール viewer) が
   同じ index.html を「フル形態」で読み、帯からのスナップショットで描画する。
   形態はウィンドウごとに固定で、「切替」ではなく boot 時に1回だけ決まる。
   ブラウザ (Tauri でない環境) は従来どおり1ページで両形態を切り替える solo。
   Tauri からは初期化スクリプトで __MIYUKE_MODE__ / __MIYUKE_ROLE__ が渡される。
   ブラウザ確認用に #strip ハッシュでもストリップに入れる（旧 #overlay も互換）。 */
(function(){
  "use strict";
  var isTauri = !!window.__TAURI__;
  var role = window.__MIYUKE_ROLE__;
  if(role !== "owner" && role !== "viewer" && role !== "solo")
    role = isTauri ? "owner" : "solo";
  window.__MIYUKE_ROLE__ = role;
  function tauriInvoke(cmd, args?){
    try{
      var T = window.__TAURI__;
      if(T && T.core && T.core.invoke) return T.core.invoke(cmd, args);
      if(T && T.invoke) return T.invoke(cmd, args);
    }catch(e){}
    return null;
  }
  /* v2.4.1: invoke が届かない環境への迂回路。応答が 700ms 無いコマンドは
     Rust が起動時に立てた 127.0.0.1 beacon へ直接 GET して実行させる
     (init script で渡されたポート+起動毎トークンを使う。通常環境では
     invoke が即答するので beacon は一切使われない) */
  function beaconCmd(c, t){
    try{
      var B = window.__MIYUKE_BEACON__;
      if(!B) return;
      var u = "http://127.0.0.1:" + B.port + "/cmd?k=" + B.token + "&c=" + c + (t ? "&t=" + encodeURIComponent(t) : "");
      fetch(u, { mode: "cors" }).catch(function(){});
    }catch(e){}
  }
  function armBeaconWatch(p, c, t?){
    if(!p || !p.then){ beaconCmd(c, t); return; }
    var settled = false;
    p.then(function(){ settled = true; }, function(){ settled = true; });
    setTimeout(function(){ if(!settled) beaconCmd(c, t); }, 700);
  }
  function normalize(mode){
    if(mode === "overlay") return "strip";   /* 旧称は互換のためストリップに寄せる */
    return mode;
  }
  function initialMode(){
    var m = normalize(window.__MIYUKE_MODE__);
    if(m === "strip" || m === "full") return m;
    if(location.hash === "#strip" || location.hash === "#overlay") return "strip";
    return "full";
  }
  function applyMode(mode){
    mode = normalize(mode);
    if(mode !== "strip" && mode !== "full") return;
    window.__MIYUKE_MODE__ = mode;
    document.body.classList.toggle("strip", mode === "strip");
    var back = document.getElementById("btn-to-overlay");
    if(back) back.style.display = (mode === "full" && isTauri) ? "" : "none";
    if(mode === "full" && isTauri && role !== "viewer"){
      /* solo/旧来経路の防御策: フル形態では全域ヒットゾーンを1回送り、帯用の
         クリック透過が残っていても管理画面では絶対に素通しにならないようにする。
         viewer は帯のヒットゾーンを決して上書きしない（送るのは帯だけ） */
      var fp = tauriInvoke("set_hit_zones", { zones: [[0, 0, window.innerWidth || 0, window.innerHeight || 0]] });
      if(fp && fp.catch) fp.catch(function(){});
    }
    if(window.__miyukeOnModeChange){
      try{ window.__miyukeOnModeChange(mode); }catch(e){}
    }
  }
  window.__miyukeApplyMode = applyMode;
  applyMode(initialMode());
  var openBtn = document.getElementById("strip-open");
  if(openBtn) openBtn.addEventListener("click", function(){
    if(!isTauri){ applyMode("full"); return; }  /* ブラウザプレビューではページ内切替だけ */
    /* 帯は変形しない。「ひらく」= 管理ウィンドウ (menu) を Rust に出してもらう。
       2.3.8 の実バグ修正: open_menu は tab: Option<String> を取るが、空オブジェクト
       {} を渡すと引数解決に失敗し、返る promise が reject されて無言で死んでいた
       (ボードクリックの { tab: "proj" } は通っていた)。キー有りの形で渡し、
       失敗時は互換エイリアス set_mode_full へフォールバックする */
    var p = tauriInvoke("open_menu", { tab: null });
    var fallback = function(){
      var q = tauriInvoke("set_mode_full");
      if(q && q.catch) q.catch(function(){});
      armBeaconWatch(q, "open-menu");
    };
    if(!p) fallback();
    else if(p.catch) p.catch(fallback);
    armBeaconWatch(p, "open-menu");
  });
  var hideBtn = document.getElementById("strip-hide");
  if(hideBtn) hideBtn.addEventListener("click", function(){
    var p = tauriInvoke("hide_main_window");
    if(p && p.catch) p.catch(function(){});
    armBeaconWatch(p, "hide-strip");
  });
  var layoutBtn = document.getElementById("strip-layout");
  if(layoutBtn) layoutBtn.addEventListener("click", function(){
    if(typeof toggleLayoutEdit === "function") toggleLayoutEdit();
  });
  var grip = document.getElementById("strip-grip");
  var gripDownAt = null;
  if(grip) grip.addEventListener("pointerdown", function(e){
    gripDownAt = { x: e.clientX, y: e.clientY, t: Date.now() };
    if(!isTauri) return;
    e.preventDefault();
    /* OS のドラッグ移動を開始 (帯ウィンドウ = このページのウィンドウ)。
       移動後の位置は Rust 側 (Moved イベント) で保存される */
    try{
      var W = window.__TAURI__ && window.__TAURI__.window;
      if(W && W.getCurrentWindow){
        var r = W.getCurrentWindow().startDragging();
        if(r && r.catch) r.catch(function(){});
      }
    }catch(err){}
  });
  /* Stage 3: グリップのタップ (動かさずに離す) = かくす。旧「かくす」チップの移設先。
     ドラッグと区別するため、移動 6px 未満かつ 400ms 未満だけをタップとみなす */
  if(grip) grip.addEventListener("pointerup", function(e){
    if(!gripDownAt) return;
    var moved = Math.hypot(e.clientX - gripDownAt.x, e.clientY - gripDownAt.y);
    var dt = Date.now() - gripDownAt.t;
    gripDownAt = null;
    if(!isTauri || moved > 6 || dt > 400) return;
    var p = tauriInvoke("hide_main_window");
    if(p && p.catch) p.catch(function(){});
    armBeaconWatch(p, "hide-strip");
  });
  var backBtn = document.getElementById("btn-to-overlay");
  if(backBtn) backBtn.addEventListener("click", function(){
    if(isTauri && role === "viewer"){
      /* 「デスクトップに戻す」= 管理ウィンドウを閉じる (帯は最初からデスクトップにいる) */
      tauriInvoke("close_menu");
      return;
    }
    var p = tauriInvoke("set_mode_strip");
    if(p && p.then) p.then(function(){ applyMode("strip"); }, function(){});
    else if(!isTauri) applyMode("strip");
  });
})();
