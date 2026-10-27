/* ---------- IA コンパクト化: 折りたたみセクション ----------
   低頻度のまとまりを既定で閉じて置くための共通部品。開閉状態はセッション内
   だけ保持する (panelFold)。中身は閉じていても常に描画する (CSS で隠すだけ)
   ので、data-fix ジャンプやスモークの innerHTML 契約は不変。
   defOpen は「まだ触られていないときの既定」。ゲーム状態から決める */
const panelFold = {};
function foldIsOpen(key, defOpen){ return (key in panelFold) ? panelFold[key] : !!defOpen; }
function toggleFold(key, defOpen){
  panelFold[key] = !foldIsOpen(key, defOpen);
  renderPanel();
}
function foldSec(key, defOpen, title, summary, bodyHTML){
  const open = foldIsOpen(key, defOpen);
  return "<div class='fold" + (open ? "" : " closed") + "' data-fold='" + key + "'>" +
    "<button type='button' class='fold-head' aria-expanded='" + (open ? "true" : "false") + "' onclick='toggleFold(\"" + key + "\"," + (defOpen ? 1 : 0) + ")'>" +
    "<span class='fold-arrow'>" + (open ? "▾" : "▸") + "</span><span>" + title + "</span>" +
    (summary ? "<span class='fold-sum'>" + summary + "</span>" : "") + "</button>" +
    "<div class='fold-body'>" + bodyHTML + "</div></div>";
}
/* 大きい数字のスタットブロック (数値は文章でなく数字そのものを見せる) */
function statBlock(label, val, unit){
  return "<div class='stat'><div class='sl'>" + label + "</div><div class='sv'>" + val +
    (unit ? " <small>" + unit + "</small>" : "") + "</div></div>";
}
/* スタッフカード用: スプライト (canvas) の data URL 化。無い/失敗時は空文字。
   sakuri作画 ANIMS がある毛柄はアニメ1フレーム目 (48×40)、他は sit 静止画 */
const sprUrlCache = {};
function spriteURL(name){
  if(name in sprUrlCache) return sprUrlCache[name];
  let url = "";
  const cv = spriteCache[name];
  if(cv && typeof cv.toDataURL === "function"){ try{ url = cv.toDataURL(); }catch(e){ url = ""; } }
  sprUrlCache[name] = url;
  return url;
}
function staffPortrait(coat){
  let name = "staff_" + coat + "_sit";
  const a = ANIMS["staff_" + coat + "_sit"];
  if(a && a.frames && a.frames.length && hasSprite(a.frames[0])) name = a.frames[0];
  const url = spriteURL(name);
  if(url) return "<img src='" + url + "' alt='" + (COAT_NAMES[coat] || "") + "'>";
  return "<span class='coatdot big' style='background:" + ((COAT_COLORS[coat] || {}).body || "#ccc") + "'></span>";
}
/* 実績ボード: 段（工程・設備・会社・みゅけ）ごとにカードを並べる。
   絵は既存スプライトをそのまま使い、未取得は CSS でシルエットにする（新たに描かない） */
function stampProg(st){
  if(!st.prog) return null;
  const pr = st.prog(S);
  return [Math.max(0, Math.min(pr[0], pr[1])), pr[1]];
}
function trophyCardHTML(st){
  const got = S.stamps[st.id];
  const url = st.icon ? spriteURL(st.icon) : "";
  /* 絵の大きさをそろえる: 小さい 16px アイコンは整数倍で拡大（ドット絵を崩さない） */
  const cv = spriteCache[st.icon], k = cv ? Math.max(1, Math.floor(52 / Math.max(cv.width, cv.height))) : 1;
  const art = url ? "<img src='" + url + "' alt=''" + (cv ? " width='" + cv.width * k + "' height='" + cv.height * k + "'" : "") + ">" : "<span class='tc-emoji'>" + (got ? "🏅" : "🔒") + "</span>";
  let sub = got ? "<div class='tc-sub'>" + esc(String(got)) + "</div>" : "<div class='tc-sub'>" + esc(st.hint || "") + "</div>";
  const pr = got ? null : stampProg(st);
  if(pr) sub += "<div class='meter'><i style='width:" + Math.floor(pr[0] / pr[1] * 100) + "%'></i></div><div class='tc-sub'>" + fmt(pr[0]) + " / " + fmt(pr[1]) + "</div>";
  return "<div class='tcard " + (got ? "got" : "lock") + "' title='" + esc(st.hint || "") + "'><div class='tc-art'>" + art + "</div>" +
    "<div class='tc-nm'>" + (got ? "" : "🔒 ") + esc(st.name) + "</div>" + sub + "</div>";
}
function trophyBoardHTML(){
  const all = STAMP_DEFS, got = all.filter(st => S.stamps[st.id]).length;
  let h = "<h3>🏅 実績ボード</h3>" + condBarsHTML([["🏅", got, all.length, "集めた実績"]]);
  /* もうすぐ取れそうなもの（進捗のある未取得を近い順に3つ） */
  const near = all.filter(st => !S.stamps[st.id] && st.prog)
    .map(st => ({ st, f: (p => p[0] / p[1])(stampProg(st)) })).filter(x => x.f > 0)
    .sort((a, b) => b.f - a.f).slice(0, 3);
  if(near.length) h += "<h3 style='margin-top:12px'>🎯 もうすぐ</h3><div class='tboard'>" + near.map(x => trophyCardHTML(x.st)).join("") + "</div>";
  for(const c of STAMP_CATS){
    const list = all.filter(st => st.cat === c.id);
    if(!list.length) continue;
    const n = list.filter(st => S.stamps[st.id]).length;
    h += "<h3 style='margin-top:12px'>" + c.icon + " " + c.name + " <span class='lvbadge'>" + n + " / " + list.length + "</span></h3>" +
      "<div class='tboard'>" + list.map(trophyCardHTML).join("") + "</div>";
  }
  return h;
}
function kv(k,v){ return "<div class='kv'><span>"+k+"</span><b>"+v+"</b></div>"; }
function togglePause(){ S.settings.pauseInput = !S.settings.pauseInput; save(); renderPanel(); }
/* Sprint 2: サウンド設定。トグルは現在の実効状態を反転して明示保存する
   （帯⇔フルの自動既定より、明示した設定が常に優先される） */
function resetStripPos(){
  /* 帯を既定位置 (プライマリ画面の下端) に戻す。実移動は Rust 側 */
  tauriCmd("reset_strip_position");
  say("帯を画面下に戻したにゃ");
}
/* 帯の大きさ。v2.4.6 で基準を変更 (sakuri 指示): 旧 70% を新 100% (標準) とし、
   S.settings.stripSize は新基準の相対値 (1 = 帯の高さ 147px 相当)。
   Rust へは実効倍率 (0.7 × 相対値) を送る。帯 (owner) だけが Rust へ送り、
   メニュー (viewer) からは VERBS 経由で帯が実行する */
const STRIP_SIZE_BASE = 0.7;
/* 旧絶対倍率 (210px 基準) → 新基準の相対値への変換 (load の移行用) */
function migrateStripSize(oldAbs){
  return Math.min(1.45, Math.max(0.7, oldAbs / STRIP_SIZE_BASE));
}
function setStripSize(v){
  const n = Number(v);
  if(!isFinite(n)) return;
  S.settings.stripSize = Math.min(1.45, Math.max(0.7, n));
  save(); applyStripScale(); renderPanel();
  if(!IS_VIEWER) say("帯の大きさを " + Math.round(S.settings.stripSize * 100) + "% にしたにゃ");
}
function applyStripScale(){
  if(IS_VIEWER || !inTauri()) return;
  tauriCmd("set_strip_scale", { scale: STRIP_SIZE_BASE * (S.settings.stripSize || 1) });
}
function toggleSound(){
  S.settings.sound = !SoundKit.enabled();
  SoundKit.unlock();   /* ボタンのクリック自体がユーザー操作なので、その場で鳴らせる */
  save(); renderPanel();
  if(S.settings.sound) SoundKit.play("purchase");
}
function setSoundVol(v){
  S.settings.soundVol = Math.min(1, Math.max(0, (parseInt(v, 10) || 0) / 100));
  SoundKit.applyVolume();
  save();
}
/* ---------- Sprint 4: セーブの書き出し／読み込み ----------
   書き出しは直前に save() した localStorage の現物を JSON ファイルに。読み込みは
   形だけを軽く検証してから load() に通す（壊れた/別物のファイルで状態を壊さない） */
function serializeSave(){
  save();
  try { return localStorage.getItem(SAVE_KEY) || ""; } catch(e){ return ""; }
}
/* ダウンロード実行だけを切り出した共通部品 (UI 操作は呼び出し側の領分)。
   owner の exportSave と、コマンド経由でテキストを受け取った viewer の両方が使う */
function downloadSaveText(text){
  try {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "miyuke-save.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch(e){ return false; }
}
function exportSave(){
  const text = serializeSave();
  if(!text){ say("セーブが見つからないにゃ"); return; }
  if(downloadSaveText(text)){
    addLog("💾 セーブデータを書き出した");
    say("セーブを書き出したにゃ");
  } else say("書き出しに失敗したにゃ");
}
function importSaveText(text){
  let obj = null;
  try { obj = JSON.parse(text); } catch(e){ return false; }
  if(!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
  if(typeof obj.coins !== "number" && !obj.totals) return false;
  const ok = load(JSON.stringify(obj));
  if(ok){
    save();   /* 読み込んだ内容をファイルと localStorage の両方へ確定する */
    sessBase = { releases: S.totals.releases, coinsEarned: S.totals.coinsEarned, startedAt: Date.now() };
    renderPanel(); renderHeader();
  }
  return ok;
}
function importSaveFile(input){
  const f = input && input.files && input.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result || "");
    /* viewer: ファイル読みは menu 側で行い、検証と load は帯 (owner) が
       コマンド経由で実行する。成否のフィードバックは cmd-result のノート表示 */
    if(IS_VIEWER){ importSaveText(text); }
    else if(importSaveText(text)){
      say("セーブを読み込んだにゃ！");
      addLog("💾 セーブデータを読み込んだ");
    } else say("そのファイルは読み込めなかったにゃ");
    input.value = "";
  };
  reader.readAsText(f);
}
/* 初期化の実体 (確認なし)。コマンド経由では帯がこれを実行し、確認は menu 側で
   済ませてから送られる (帯の帯画面で confirm を出さないため) */
function doResetSave(){
  saveBlocked = false;   /* 読めなかったセーブの保護も、初期化の意思表示で解除する */
  localStorage.removeItem(SAVE_KEY);
  S = freshState(); startProject("TUT"); genRequests();
  sessBase = { releases:0, coinsEarned:0, startedAt: Date.now() };
  returnInfo = null; returnWakeAt = 0;
  const rcEl = document.getElementById("return-card"); if(rcEl) rcEl.style.display = "none";
  addLog("はじめまして。みゅけ、開発をはじめるにゃ。");
  save(); renderPanel(); renderHeader(); updateComboUI();
}
function resetSave(){
  if(!confirm("セーブデータを初期化しますか？")) return;
  if(!confirm("本当に消しますか？作品棚・実績・星屑も消えます。")) return;
  doResetSave();
}

/* ---------- Sprint 4: コーディング速度は「集中力」連動（sakuri 方向転換） ----------
   当初は入力レート連動で実装したが、sakuri の指定で変更: カタカタの速さは
   やる気＝集中力ゲージで決まる。集中力が低いと 0.5 倍、満タンで 2 倍。
   下限があるので止まって見えることはない。
   仕組みは ANIMS 汎用: 基準名ごとにレートドライバを登録しておき、
   ランタイムがその倍率でアニメ時計を進める。sakuri の本番コーディング絵
   (miyuke_code_a = 4フレーム版) が来ても、この表に載っているだけで
   同じ速度ロジックを継承する（描画側の特例は作らない） */
function concentrationFactor(){
  const c = Math.max(0, Math.min(100, S.concentration || 0));
  return 0.5 + 1.5 * (c / 100);
}
const ANIM_RATES = { concentration: () => concentrationFactor() };
const ANIM_RATE_DRIVERS = {
  miyuke_code_a: "concentration",
  miyuke_code_b: "concentration"
};
function animRateFor(base){
  const d = ANIM_RATE_DRIVERS[base];
  return d && ANIM_RATES[d] ? ANIM_RATES[d]() : 1;
}
/* ドライバ付き ANIMS の専用時計: 状態に入るたびリセットし、
   実時間 × 現在のレート で積算する（レートが途中で変わっても滑らか） */
const animClock = { base: null, entered: 0, acc: 0, last: 0 };
function drivenElapsed(base){
  const now = Date.now();
  if(animClock.base !== base || animClock.entered !== stateEnteredAt){
    animClock.base = base; animClock.entered = stateEnteredAt;
    animClock.acc = 0; animClock.last = now;
  }
  const dt = Math.min(1000, now - animClock.last);
  animClock.last = now;
  animClock.acc += dt * animRateFor(base);
  return animClock.acc;
}
/* 手続き描画側の a/b トグル（前足・体の揺れ）も同じ集中力ドライバで進める */
let codePhaseMs = 0;       /* コーディングアニメの位相 (ms) */
function advanceCodePhase(dtMs){
  codePhaseMs += dtMs * concentrationFactor();
}
function codeFrameBit(){ return Math.floor(codePhaseMs / 300) % 2; }
let lastRenderAt = 0;

/* 入力パルスの記録（Phase 2 の継ぎ目）。アニメ速度にはもう使わない */
let inputHits = [];        /* 入力パルスの時刻 (ms)。直近4秒だけ保持 */
function noteInput(){
  const now = Date.now();
  inputHits.push(now);
  while(inputHits.length && now - inputHits[0] > 4000) inputHits.shift();
  if(inputHits.length > 240) inputHits.splice(0, inputHits.length - 240);
}

