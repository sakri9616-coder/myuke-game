/* ---------- 初期化とメインループ ---------- */
buildSprites();
{ const vl = document.getElementById("ver-label"); if(vl) vl.textContent = GAME_VERSION; }
let hadSave = false;
if(IS_VIEWER){
  /* viewer: load/tick/save/入力集計 init/アップデータ init/セレモニーを一切
     走らせない (起動経路の分離 = 第1層ガード)。状態は帯のスナップショットで届く */
  initViewer();
} else {
  hadSave = load();
  if(saveBlocked){
    /* 起動時のセーブが壊れていた: 元のデータは残して保存を止め、プレイヤーに知らせる */
    addLog("⚠️ セーブデータを読み込めませんでした。元のデータは残してあり、この起動中は保存しません（設定タブで読み込み直すか、初期化できます）");
  }
  initInputCounting();   /* Phase 2: OS全体の入力集計（購読＋保存済み設定の反映。Tauri が無ければ無操作） */
  initUpdater();   /* v2.3.5: 起動時の無言アップデート確認（Tauri のみ・少し遅らせて1回） */
  initOwnerProtocol();   /* 2ウィンドウ化: menu との同期 (Tauri の owner のみ実働) */
  applyStripScale();   /* v2.4.0: 保存済みの帯の大きさを Rust 側へ再主張 (冪等) */
  /* Sprint 2: セッション基準（このセッションの実績が、次回の「あらすじ」になる） */
  sessBase = { releases: S.totals.releases, coinsEarned: S.totals.coinsEarned, startedAt: Date.now() };
  if(hadSave) setupReturnCeremony();
  if(!S.project){ S.project = settleProject(genProject(S.totals.releases===0 && S.shelf.length===0 ? "TUT" : null)); S.projectDP = 0; attachModules(S.project); }
  if(S.line2.unlocked && !S.line2.project){ S.line2.project = settleProject(genProject(null, S.line2.genre)); S.line2.projectDP = 0; S.line2.commitMark = 0; }
  if(!S.requests.length && !S.activeRequest) genRequests();
  if(!hadSave){
    addLog("みゅけが引っ越してきた。開発、はじめるにゃ。");
    nextFishAt = Date.now() + 170000;   /* 初回だけ金の魚を3分目までに確定出現させる */
  }
  else { addLog("おかえり。続きやるね（進捗は一緒にいる間だけ進むよ）"); }
  if(!S.project.startedAt) S.project.startedAt = Date.now();
}
renderHeader(); renderPanel(); updateComboUI();
if(!IS_VIEWER){
  setInterval(()=>{
    /* tick の途中で例外が出ても記録して次の秒へ進む (黙って毎秒止まり続けないように) */
    try{ tick(); }catch(e){ console.error("[miyuke] tick で例外", e); }
    S.totals.playSec += 1; bumpRev();
  }, 1000);
  setInterval(save, 10000);
  window.addEventListener("beforeunload", save);
}
setInterval(()=>{ renderPanel(); }, 5000);   /* 全ロール共通の安全網 (viewer は同期表示のまま) */
/* 既存セーブでは寝たまま始まる（挨拶は起床時に tick が言う）。新規は従来どおり。
   viewer は挨拶しない (セリフの所有は帯。menu の吹き出しは live.say で届く) */
if(!IS_VIEWER) say(saveBlocked ? "セーブが読めなかったにゃ…元のデータは残してあるよ。設定タブを見てね" : hadSave ? "すぅ…すぅ…" : "はじめまして、みゅけだにゃ。小さい工場もよろしくね。");
