/* ---------- v2.3.5: 自動アップデート（GitHub Releases / Tauri Updater） ----------
   チェック先は tauri.conf.json の plugins.updater.endpoints（GitHub Releases の
   latest.json）。更新ファイルは同梱の公開鍵で署名検証される（Rust 側プラグイン）。
   ページ側は「見つける→知らせる→落とす→再起動を促す」だけを担う。
   起動時の自動チェックは無言（見つけた時だけ帯の吹き出し＋チップと
   管理画面のカードで知らせる。遊びは止めない）。手動チェックは設定タブ。
   ブラウザ版では機能ごと隠す（updApi が null の間は何も表示されない）。 */
let upd = { status: "idle", obj: null, version: null, body: "", got: 0, total: 0, dismissed: false };
function updApi(){
  try{
    const T = window.__TAURI__;
    return (T && T.updater && typeof T.updater.check === "function") ? T.updater : null;
  }catch(e){ return null; }
}
function updVerLabel(){
  if(!upd.version) return "";
  return "v" + String(upd.version).replace(/^v/, "");
}
function updStatusText(){
  switch(upd.status){
    case "checking": return "確認中…";
    case "available": return "✨ 新しいバージョン " + updVerLabel() + " があります";
    case "downloading": {
      const pct = upd.total > 0 ? Math.floor(upd.got / upd.total * 100) : 0;
      return "ダウンロード中… " + pct + "%";
    }
    case "ready": return "ダウンロード完了。再起動すると更新が終わります";
    case "uptodate": return "最新です（" + GAME_VERSION + "）";
    case "error": return "確認できませんでした（通信エラーの可能性があります）";
    default: return "";
  }
}
/* 管理画面カード・設定タブの状態表示を upd から描き直す
   (帯側の更新通知は Stage 3 で工具箱のリボンに移設済み) */
function paintUpd(){
  const active = upd.status === "available" || upd.status === "downloading" || upd.status === "ready";
  const card = document.getElementById("update-card");
  if(card){
    if(active && !upd.dismissed){
      let btn;
      if(upd.status === "available") btn = "<button onclick='updDownload()'>ダウンロードして更新</button>";
      else if(upd.status === "downloading") btn = "<button disabled>ダウンロード中…</button>";
      else btn = "<button onclick='updRelaunch()'>再起動して更新を完了する</button>";
      card.innerHTML =
        "<div class='rc-head'><span>🆕 アップデートがあります</span>" +
        "<button class='rc-close' onclick='updDismiss()'>✕</button></div>" +
        "<div>新しいバージョン <b>" + updVerLabel() + "</b> が出ています。" +
        (upd.status === "downloading"
          ? "（" + (upd.total > 0 ? Math.floor(upd.got / upd.total * 100) : 0) + "% ダウンロード済み）"
          : upd.status === "ready" ? "ダウンロードは終わっています。" : "") +
        "</div><div style='margin-top:6px'>" + btn + "</div>";
      card.style.display = "";
    } else card.style.display = "none";
  }
  const st = document.getElementById("upd-status");
  if(st) st.textContent = updStatusText();
}
/* 更新チェック本体。manual=true の時だけ「最新です／確認できませんでした」を残す */
async function checkForUpdates(manual){
  const api = updApi();
  if(!api) return false;
  if(upd.status === "checking" || upd.status === "downloading" || upd.status === "ready") return false;
  upd.status = "checking"; paintUpd();
  try{
    const u = await api.check();
    if(u){
      upd.obj = u; upd.version = u.version; upd.body = u.body || "";
      upd.status = "available"; upd.dismissed = false;
      say("新しいバージョン " + updVerLabel() + " があるにゃ！ 設定タブから更新できるよ");
      addLog("🆕 アップデート " + updVerLabel() + " が見つかった");
    } else {
      upd.status = manual ? "uptodate" : "idle";
    }
  }catch(e){
    upd.status = manual ? "error" : "idle";   /* オフライン等は自動チェックでは無言 */
  }
  paintUpd();
  if(typeof currentTab !== "undefined" && currentTab === "settings") renderPanel();
  return upd.status === "available";
}
function updCheckManual(){ checkForUpdates(true); }
async function updDownload(){
  if(!upd.obj || upd.status !== "available") return;
  upd.status = "downloading"; upd.got = 0; upd.total = 0;
  paintUpd(); if(typeof currentTab !== "undefined" && currentTab === "settings") renderPanel();
  let lastPct = -1;
  try{
    await upd.obj.downloadAndInstall((ev) => {
      if(!ev) return;
      if(ev.event === "Started"){ upd.total = (ev.data && ev.data.contentLength) || 0; }
      else if(ev.event === "Progress"){
        upd.got += (ev.data && ev.data.chunkLength) || 0;
        const pct = upd.total > 0 ? Math.floor(upd.got / upd.total * 100) : 0;
        if(pct !== lastPct){ lastPct = pct; paintUpd(); }
      }
    });
    upd.status = "ready";
    say("ダウンロードできたにゃ。再起動すると更新が完了するよ");
    addLog("⬇ アップデート " + updVerLabel() + " をダウンロードした（再起動で完了）");
  }catch(e){
    upd.status = "available";
    say("ダウンロードに失敗したにゃ… もう一度試してみて");
  }
  paintUpd();
  if(typeof currentTab !== "undefined" && currentTab === "settings") renderPanel();
}
function updRelaunch(){
  try{
    const T = window.__TAURI__;
    if(T && T.process && typeof T.process.relaunch === "function"){
      const p = T.process.relaunch();
      if(p && p.catch) p.catch(function(){});
    }
  }catch(e){}
}
function updDismiss(){ upd.dismissed = true; paintUpd(); }
/* 帯チップから: 管理画面の設定タブを開く（openShelfPanel と同じ open_menu 経路） */
function updOpenSettings(){
  if(IS_VIEWER){ switchTab("settings"); return; }
  if(!document.body.classList.contains("strip")){ switchTab("settings"); return; }
  if(inTauri()){ tauriCmd("open_menu", { tab: "settings" }); return; }
  switchTab("settings");
  window.__miyukeApplyMode("full");   /* ブラウザ (solo): 従来どおりページ内切替 */
}
/* 起動時: 少し待ってから無言で確認する（ブラウザでは無操作）。
   次回リリース分: 起動時1回だけでは、起動中に公開された更新を再起動まで検出できない
   (sakuri 実機報告: 動いたり動かなかったり)。30分ごとに無言で再確認する。
   検出済み (available) や進行中は checkForUpdates 側のガードと状態条件で弾く */
function initUpdater(){
  if(!inTauri() || !updApi()) return;
  setTimeout(() => { checkForUpdates(false); }, 4000);
  setInterval(() => {
    if(upd.status === "idle" || upd.status === "uptodate" || upd.status === "error")
      checkForUpdates(false);
  }, 30 * 60 * 1000);
}

