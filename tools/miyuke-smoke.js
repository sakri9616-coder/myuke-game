/* miyuke-smoke.js — 最低限の動作保証だけを確かめるスモークテスト。
   Node + DOM スタブでゲーム HTML (game/src からビルド) を実行し、
   「起動する・開発が進む・リリースできる・買える・保存できる・帯が描ける・
   2つの窓が同期する・リリースの設定が揃っている」ことだけを見る。
   演出の細部 (アニメのフレーム・座標・色など) は確かめない。
   バランスの保証は tools/game-sim.js、帯の初リリース時間は
   tools/strip-fresh-measure.js、スプライトは graphics/validate-sprites.cjs が担う。
   出力の最終行 "SMOKE RESULT: N passed, M failed" は tools/verify-all.sh が読む。 */
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

/* 読み先は tools/game-html.cjs が決める（MIYUKE_GAME_HTML で差し替え可能。既定はソースからビルド）。 */
const GAME_HTML = require("./game-html.cjs");
const HTML = GAME_HTML.readGameHtml();
const BLOCKS = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (BLOCKS.length < 2) { console.error("script blocks not found"); process.exit(1); }

let PASS = 0, FAIL = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { PASS++; console.log("  PASS  " + name); }
  else { FAIL++; failures.push(name); console.log("  FAIL  " + name + (extra ? "  -- " + extra : "")); }
}
function noThrow(fn) { try { fn(); return true; } catch (e) { console.log("    (threw) " + (e && e.message)); return false; } }

/* ---------------- DOM スタブ（tools/dom-stub.cjs に共通化） ---------------- */
const { makeEl } = require("./dom-stub.cjs");
function buildSandbox(opts) {
  opts = opts || {};
  const byId = {};
  const el = id => {
    if (!byId[id]) {
      byId[id] = makeEl(id === "strip" ? "canvas" : "div");
      if (id === "strip") byId[id]._rect = { left: 0, top: 0, width: 1280, height: 266, right: 1280, bottom: 266 };
    }
    return byId[id];
  };
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const intervals = [];
  const sandbox = {
    console, localStorage,
    location: { hash: opts.hash || "" },
    navigator: { userAgent: "miyuke-smoke" },
    innerWidth: 1280, innerHeight: opts.hash === "#strip" ? 266 : 800, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    confirm: () => true,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0,
    _intervals: intervals, _el: el
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    body: makeEl("body"), documentElement: makeEl("html"),
    getElementById: el, createElement: tag => makeEl(tag),
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener() {}, removeEventListener() {}
  };
  if (opts.tauri) sandbox.__TAURI__ = opts.tauri;
  if (opts.role) { sandbox.__MIYUKE_ROLE__ = opts.role; sandbox.__MIYUKE_MODE__ = opts.role === "viewer" ? "full" : "strip"; }
  vm.createContext(sandbox);
  return sandbox;
}
function loadGame(sb) { for (const b of BLOCKS) vm.runInContext(b, sb, { filename: "game-block.js" }); }
function run(sb, src) { return vm.runInContext(src, sb); }
/* 呼び出しを記録するだけの偽 Tauri */
function recordingTauri(calls) {
  return {
    core: { invoke: (c, a) => { calls.push([c, a]); return Promise.resolve({}); } },
    event: { listen: () => Promise.resolve(() => {}), emit: () => Promise.resolve(), emitTo: () => Promise.resolve() }
  };
}

/* ================= 1. 起動と基本の流れ ================= */
console.log("== 1. boot and core loop ==");
{
  const sb = buildSandbox();
  check("game loads with a tutorial project", noThrow(() => loadGame(sb)) && run(sb, "S.project && S.project.size") === "TUT");
  const dp0 = run(sb, "S.projectDP");
  for (let i = 0; i < 30; i++) run(sb, "tick()");
  check("ticks advance the project", run(sb, "S.projectDP") > dp0, dp0 + " -> " + run(sb, "S.projectDP"));
  const coins0 = run(sb, "S.coins"), rel0 = run(sb, "S.totals.releases");
  run(sb, "S.projectDP = S.project.totalDP; releaseProject();");
  check("a release pays coins, adds to the shelf and starts the next project",
    run(sb, "S.totals.releases") === rel0 + 1 && run(sb, "S.coins") > coins0 && run(sb, "S.shelf.length") === 1 && run(sb, "S.project.size") !== "TUT");
  check("the first release advances the tutorial", run(sb, "S.tut.stage") >= 1);
  run(sb, "S.coins = 100000; S.rp = 100;");
  run(sb, "buyUpgrade('devenv'); hireStaff(Object.keys(STAFF_ROLES)[0]); buyResearch(RESEARCH_DEFS[0].id);");
  check("upgrades, hiring and research can be bought",
    run(sb, "S.upgrades.devenv") === 1 && run(sb, "S.staff.length") === 1 && run(sb, `S.research[RESEARCH_DEFS[0].id]`) === true && run(sb, "S.coins") < 100000);
  run(sb, "S.coins = 3000; S.log.length = 0;");
  const held = run(sb, "buyMany('buyUpgrade', ['devenv'], 50)");
  check("press-and-hold buys until coins run out, with one log line",
    held > 1 && held < 50 && run(sb, "S.upgrades.devenv") === 1 + held && run(sb, "S.log.filter(l => l.text.startsWith('アップグレード')).length") === 1 && run(sb, "quietBuy") === null,
    held + " bought, log " + run(sb, "JSON.stringify(S.log.map(l => l.text))"));
  run(sb, "S.tut.skipped = true;");
  const tabs = run(sb, "TABS.map(t => t[0])");
  const bad = tabs.filter(t => !noThrow(() => run(sb, `switchTab(${JSON.stringify(t)}); renderPanel();`)) || run(sb, "document.getElementById('panel').innerHTML.length") < 50);
  check("every menu tab renders", bad.length === 0, bad.join(","));
}

/* ================= 2. セーブ ================= */
console.log("== 2. save ==");
{
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.coins = 4321; S.shelf.push({ name: 'w', genreName: 'g', size: 'S', date: 'd', devMin: 1, lines: 1, bugs: 0, naps: 0, icon: 0, highlight: '' }); save();");
  const sb2 = buildSandbox();
  sb2.localStorage.setItem("miyuke-save-v1", sb.localStorage.getItem("miyuke-save-v1"));
  loadGame(sb2);
  check("save and load round-trip", run(sb2, "S.coins") === 4321 && run(sb2, "S.shelf.length") === 1);

  const calls = [];
  const sbF = buildSandbox({ tauri: recordingTauri(calls) });
  sbF.__MIYUKE_SAVE__ = JSON.stringify({ coins: 1234, lastTick: 1000 });
  loadGame(sbF);
  calls.length = 0;
  run(sbF, "save();");
  check("restores from the save file and writes back through save_game",
    run(sbF, "S.coins") === 1234 && calls.some(c => c[0] === "save_game" && JSON.parse(c[1].data).coins === 1234));

  run(sbF, "S.coins = 123456;");
  const okBad = run(sbF, `importSaveText(${JSON.stringify('{"coins":5,"subs":[null],"upgrades":null}')})`);
  check("a broken import never wipes the current game",
    run(sbF, "S.coins") === (okBad ? 5 : 123456) && noThrow(() => run(sbF, "tick(); renderPanel();")));

  const sbC = buildSandbox();
  sbC.localStorage.setItem("miyuke-save-v1", "{ this is not json");
  loadGame(sbC);
  run(sbC, "save();");
  check("a corrupt startup save is kept, not overwritten", sbC.localStorage.getItem("miyuke-save-v1") === "{ this is not json");

  const sbX = buildSandbox();
  loadGame(sbX);
  run(sbX, `importSaveText(${JSON.stringify(JSON.stringify({ coins: 1, staff: [{ id: "1);x();(1", name: "<img src=x onerror=x()>", coat: "kuro", role: "prog", lv: 1 }] }))})`);
  run(sbX, "S.tut.skipped = true; switchTab('staff'); renderPanel();");
  const html = sbX._el("panel").innerHTML;
  check("names from a save are never rendered as live HTML", !/<img/i.test(html) && !/x\(\);\(1/.test(html));
}

/* ================= 3. 帯 (ストリップ) ================= */
console.log("== 3. strip ==");
{
  const calls = [];
  const sb = buildSandbox({ hash: "#strip", tauri: recordingTauri(calls) });
  loadGame(sb);
  run(sb, "window.__drawn = []; const __o = sDrawSprite; sDrawSprite = function(n){ window.__drawn.push(n); return __o.apply(null, arguments); };");
  check("a fresh strip renders and draws Miyuke", noThrow(() => run(sb, "render();")) && run(sb, "window.__drawn.some(n => n.startsWith('miyuke'))"));
  run(sb, "publishHitZones(true);");
  check("hit zones are sent to Rust for click-through", calls.some(c => c[0] === "set_hit_zones" && c[1].zones.length > 0));
  calls.length = 0;
  run(sb, "openShelfPanel();");
  check("clicking furniture asks Rust to open the menu tab", calls.some(c => c[0] === "open_menu" && c[1].tab === "shelf"));
  run(sb, "S.tut.skipped = false; S.tut.stage = 1; S.tut.seen = {}; S.coins = 10; tutCelebrate = null;");
  check("the stage-1 objective memo opens the factory tab", run(sb, "stripMemoTab()") === "factory");
  run(sb, "S.bugStock = 10000; stripNow = Date.now() + 1000; render(); stripNow += 1000; render();");
  const bugs0 = run(sb, "S.bugStock"), coins0 = run(sb, "S.coins");
  run(sb, "const __r = stripHitRects.stockBugs[0]; stripStockBugClick(__r.x + __r.w / 2, __r.y + __r.h / 2);");
  check("10,000 stock bugs draw as at most 20 sprites and a click squashes some for coins",
    run(sb, "stripBugVis.length") <= 20 && run(sb, "S.bugStock") < bugs0 && run(sb, "S.coins") > coins0);

  const vet = fs.readFileSync(path.join(__dirname, "strip-seeds", "veteran.json"), "utf8");
  const sbV = buildSandbox({ hash: "#strip" });
  sbV.localStorage.setItem("miyuke-save-v1", vet);
  loadGame(sbV);
  check("a late-game strip renders for many frames", noThrow(() => { for (let i = 0; i < 20; i++) run(sbV, "render(); tick();"); }));
}

/* ================= 4. 2つの窓 (帯 = owner / メニュー = viewer) ================= */
console.log("== 4. two windows ==");
{
  const listeners = { main: {}, menu: {} };
  const invokes = [];
  const bus = self => ({
    core: { invoke: (c, a) => { invokes.push([self, c, a]); return Promise.resolve({}); } },
    event: {
      listen: (ev, fn) => { (listeners[self][ev] = listeners[self][ev] || []).push(fn); return Promise.resolve(() => {}); },
      emit: (ev, payload) => { for (const k of Object.keys(listeners)) if (k !== self) (listeners[k][ev] || []).forEach(fn => fn({ payload })); return Promise.resolve(); },
      emitTo: (to, ev, payload) => { (listeners[to][ev] || []).forEach(fn => fn({ payload })); return Promise.resolve(); }
    }
  });
  const sbO = buildSandbox({ tauri: bus("main"), role: "owner" });
  loadGame(sbO);
  run(sbO, "S.coins = 5000; S.tut.skipped = true; S.tut.stage = 7;");
  const sbM = buildSandbox({ tauri: bus("menu"), role: "viewer" });
  loadGame(sbM);
  run(sbO, "sendSnapshotNow();");
  check("the menu mirrors the strip's state from snapshots", run(sbM, "IS_VIEWER") === true && run(sbM, "S.coins") === 5000);
  const lv0 = run(sbO, "S.upgrades.devenv || 0");
  run(sbM, "buyUpgrade('devenv');");
  check("a purchase in the menu runs exactly once in the strip", run(sbO, "S.upgrades.devenv || 0") === lv0 + 1);
  check("the menu never writes the save", invokes.every(x => !(x[0] === "menu" && x[1] === "save_game")));
}

/* ================= 5. 会社の売却 (プレステージ) ================= */
console.log("== 5. prestige ==");
{
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.runPeakValue = BAL.valuePerDust * 5; S.coins = 99999; S.upgrades = { devenv: 3 };");
  const gain = run(sb, "prestigePreview().gain");
  run(sb, "doPrestigeCore('__none', '__auto', -1);");
  check("selling the company grants stardust and starts a new company",
    gain >= 3 && run(sb, "S.dust") === gain && run(sb, "S.prestiges") === 1 && run(sb, "S.coins") < 99999 && !run(sb, "S.upgrades.devenv"));
}
{
  /* 再設計 段階5: 余った研究P は売却でジャンル知見になって残り、そのジャンルの値段を上げる */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.genreKnow = {}; S.runGenre = { game: 3, app: 1 }; S.rp = 40; S.runPeakValue = BAL.valuePerDust * 5;");
  const p0 = run(sb, "basePriceCoins({ size: 'S', genre: 'game', scale: 1 })");
  run(sb, "doPrestigeCore('__none', '__auto', -1);");
  check("leftover research points become lasting genre know-how on sale",
    run(sb, "Math.round(S.genreKnow.game)") === 30 && run(sb, "Math.round(S.genreKnow.app)") === 10 && run(sb, "S.rp") === 0 &&
    run(sb, "knowLv('game')") === 5 && run(sb, "basePriceCoins({ size: 'S', genre: 'game', scale: 1 })") > p0);
}
{
  /* 再設計 段階5: 部署の節目で任せる（開発部 Lv3 = 並行開発、Lv6 = 部長の自動育成） */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.staff = [{ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 }]; S.depts = freshDepts(); S.coins = 1e9;");
  const before = run(sb, "computeStaffSums().prog");
  run(sb, "S.depts.prog = 6; for(let i = 0; i < 5; i++) deptDelegateTick();");
  check("department milestones delegate work (parallel dev, auto-training)",
    run(sb, "computeStaffSums().prog") > before * 1.4 && run(sb, "S.staff[0].lv") === 2 && !run(sb, "'line2' in S"));
}
{
  /* 再設計 段階6: EXIT の節目（3回目で零細から創業）と、星屑の枝（列の投資で効きが伸びる）、子会社の配当と再投資 */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.prestiges = 2; S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  const rank = run(sb, "S.studioLv");
  run(sb, "S.dust = 100; buyDustPerk('b_line');");
  const m0 = run(sb, "directMult()");
  run(sb, "S.upgrades.direct = 20;");
  const m1 = run(sb, "directMult() / (1 + 0.1 * engineLv('direct'))");
  run(sb, "S.studioLv = 5; S.coins = 1e12; foundSub('app'); S.subs[0].div = 0; const l0 = S.subs[0].staff + S.subs[0].lv; S.coins = 0; for(let i = 0; i < 400; i++) tick(); globalThis.__subGrow = S.subs[0].staff + S.subs[0].lv - l0;");
  check("exit milestones, stardust branches and subsidiary reinvestment work",
    rank === 2 && Math.abs(m0 - 1.15) < 1e-9 && Math.abs(m1 - 1.3) < 1e-9 && run(sb, "__subGrow") > 0 && !run(sb, "'starcharm' in S.dustPerks"));
}
{
  /* 2026-10-28: 持株化で星屑は畳まれるが、星屑倍率の土台は ×10 で残る（宇宙編でも桁が伸びる） */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.maxStudioLv = 6; S.subs = [{ id: 1, name: 'a', genre: 'app', staff: 5, lv: 1, alloc: 50 }, { id: 2, name: 'b', genre: 'app', staff: 5, lv: 1, alloc: 50 }]; S.prestiges = 12; S.eraDust = 1000; S.dustTotal = 1000; doHoldingsCore();");
  check("holdings fold stardust but keep a x10 multiplier base", run(sb, "S.holdings") === 1 && run(sb, "S.dustTotal") === 0 && run(sb, "dustMult()") === 10);
}
{
  /* 再設計 段階1: 出した作品は棚で毎秒売れ続け、棚は会社と一緒に売却で消える */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.coins = 0; catalogAdd({ name: 'テスト作' }, 6000); for(let i = 0; i < 10; i++) tickCatalog();");
  const sold = run(sb, "S.coins");
  run(sb, "S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  check("released works keep selling every second until the company is sold",
    sold >= 135 && sold <= 150 && run(sb, "S.catalog.length") === 0);   /* 再設計 B4: life 4.25 で 6000×4.25/30/60×10秒 = 141.7（初作なので間隔係数1） */
}
{
  /* 再設計 B13: EXIT／持株化の儀式（S1 インライン確認・S3 の拍・S4 余韻）。
     confirm() は使わず、実行で ceremony が立ち、余韻の告知がメモ優先枠に用意される */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true; S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  const exitCere = run(sb, "!!ceremony && ceremony.kind === 'exit' && afterglowNotes.length >= 1 && firstReleasePending");
  run(sb, "startProject('S'); S.project.doneFeats = 99; releaseProject();");
  const firstRel = run(sb, "S.log.some(l => l.text.includes('再出発の初リリース')) && !firstReleasePending");
  run(sb, "currentTab = 'factory'; S.pendingPolicy = 'labor'; prestigeAsk();");
  const cert = run(sb, "document.getElementById('panel').innerHTML");
  const certOk = cert.includes("卒業証書") && cert.includes("売却して、卒業する") && cert.includes("もう少し育てる") &&
    cert.includes("（変更する）") && cert.includes("星屑ショップの永続特典は、売却しても消えません");
  run(sb, "prestigeCancel(); S.maxStudioLv = 6; S.subs = [{ id: 1, name: 'a', genre: 'app', staff: 5, lv: 1, alloc: 0 }, { id: 2, name: 'b', genre: 'app', staff: 5, lv: 1, alloc: 0 }]; S.eraExitPts = 12; S.eraDust = 1500; S.prestiges = 12; S.eraStartPrestiges = 0;");
  run(sb, "currentTab = 'factory'; holdingsAsk();");
  const hcert = run(sb, "document.getElementById('panel').innerHTML");
  run(sb, "doHoldingsCore();");
  const holdCere = run(sb, "!!ceremony && ceremony.kind === 'holdings' && afterglowNotes[0].includes('新しい時代が始まりました')");
  const hcertOk = hcert.includes("時代の記録") && hcert.includes("時代を終わらせ、次へ進む") && hcert.includes("この時代を、もう少し生きる") && hcert.includes("星屑の時代");
  check("EXIT and holdings run the ceremony states without confirm(), with certificates and afterglow (B13)",
    exitCere && firstRel && certOk && holdCere && hcertOk);
}
{
  /* 再設計 B12: 割り込み告知は全体で1回/20秒まで。フィーバーのバグは「的」種別（fever フラグ）。
     メモは単一スロット: 割り込み告知があっても報告ローテーションが必ず枠を得る */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true; lastEventSayAt = 0; spawnBugSwarm(Date.now(), 6, true);");
  const feverFlag = run(sb, "!!(bugEvent && bugEvent.fever)");
  const say1 = run(sb, "lastSayText");
  run(sb, "spawnFish(Date.now());");
  const cappedSay = run(sb, "lastSayText") === say1;
  run(sb, "bugEvent = null; spawnBugSwarm(Date.now(), 6);");
  const normalFlag = run(sb, "!!(bugEvent && !bugEvent.fever)");
  run(sb, "S.trend = { boom: 'app', announceAt: Date.now() }; lastReportText = '報告テスト'; lastReportAt = Date.now();");
  const memo1 = run(sb, "stripMemoText()");
  const memoOk = memo1.includes("ブーム中") || memo1.includes("報告テスト");
  check("interruption announcements are capped at one per 20s, fever bugs are a marked target type, memo slot arbitrates (B12)",
    feverFlag && cappedSay && say1.includes("的だと思って") && normalFlag && memoOk);
}
{
  /* 再設計 B11: 別館看板の段階はグループ総勢で駆動し、周回内ラッチし、EXIT でリセットされる。
     配当の文型は子会社名から始まる「リリースされました——配当が届きました」形 */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true;");
  run(sb, "S.subs = [{ id: 1, name: 'テスト工房', genre: 'app', staff: 24, lv: 1, alloc: 0 }]; S.annexStage = 0;");
  const st1 = run(sb, "annexStageNow()");
  run(sb, "S.subs[0].staff = 200; annexStageTick();");
  const st2 = run(sb, "annexStage()"), announced = run(sb, "S.log[0].text");
  run(sb, "S.subs[0].staff = 10;");
  const latched = run(sb, "annexStage()");
  run(sb, "S.subs[0].divAcc = 500; S.subs[0].divClock = 0; S.subs[0].divCycle = 1; tick();");
  const divLog = run(sb, "S.log.find(l => l.text.includes('配当') && l.text.includes('届きました'))");
  run(sb, "S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  const reset = run(sb, "(S.annexStage || 0)") === 0;
  check("annex sign stages follow group headcount with a run latch, dividends use the arrival wording, stage resets at EXIT (B11)",
    st1 === 1 && st2 === 2 && announced.includes("別館の看板が大きくなりました") && latched === 2 && !!divLog && divLog.text.startsWith("🏢 『テスト工房』") && reset);
}
{
  /* 再設計 C1 #12 改訂形: プロジェクトカードに「次の仕事の桁 ×N」の予告が出る（帯の現行作品の行には出ない） */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true; startProject('M'); renderPanel();");
  const html = run(sb, "document.getElementById('panel').innerHTML");
  check("next work scale preview is shown in the project card (C1 #12 revised)",
    html.includes("次の仕事の桁: ×") && !html.includes("次の階段まで"));
}
{
  /* 再設計 C8: EXIT の履歴が残り、時代単位の収入累計は会社リセットを生き残る（B13 の材料） */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.eraIncome = { labor: 123 }; S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  check("exit history is recorded and era income survives a company reset (C8)",
    run(sb, "S.exitHistory.length") === 1 && run(sb, "S.exitHistory[0].gain") >= 3 && run(sb, "S.exitHistory[0].pts") >= 1 &&
    run(sb, "(S.eraIncome || {}).labor") === 123 && run(sb, "Object.keys(S.incomeBy || {}).length") === 0);
}
{
  /* 再設計 B10: 推しの一本 — 指定で価格の読み替えと棚・シリーズのスナップショットが効き、EXIT で指定が終わる */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true; startProject('M'); S.project.planLv = 2;");
  run(sb, "currentTab = 'proj'; renderPanel();");
  const btnHtml = run(sb, "document.getElementById('panel').innerHTML");
  const base = run(sb, "planPriceMult(S.project)");
  run(sb, "designateOshi();");
  const boosted = run(sb, "planPriceMult(S.project)");
  const miyukeSay = run(sb, "stripSay.text");   /* 企画者はスタッフ不在のため みゅけ本人 */
  run(sb, "S.catalog = []; catalogAdd(S.project, 1000);");
  const catR = run(sb, "S.catalog[0].r"), catOshi = run(sb, "S.catalog[0].oshi");
  const plainR = run(sb, "clearOshi(); lastCatalogAtSec = -1; S.catalog = []; catalogAdd(S.project, 1000); S.catalog[0].r");   /* B4 の間隔係数を測り直すため前回リリース時刻をリセット（係数自体は B4 ブロックで検証） */
  const serPlain = run(sb, "seriesRate({ price: 1000, scale: 1 })");
  const serOshi = run(sb, "seriesRate({ price: 1000, scale: 1, oshi: true })");
  run(sb, "designateOshi(); save();");
  const kept = run(sb, "!!S.project.oshi");
  run(sb, "S.project.planning = false; creditProject(S.project.totalDP / (S.project.feats.length + 1) + 1);");   /* 着工直後は企画中（planning）で進捗が入らないため外してから機能を1つ灯らせる */
  const featMemo = run(sb, "lastReportText"), projName = run(sb, "S.project.name");
  run(sb, "S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
{
  /* 再設計 B10（r4-oshi2）: 推しの枠は1周回に1本。推し作品のリリースで消費され、
     枠消費後の指定は拒否され、EXIT で回復する。リリース前の移し直しは自由 */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.tut.skipped = true;");
  run(sb, "startProject('S'); designateOshi();");
  const des1 = run(sb, "S.project.oshi === true && !S.oshiSlotSpent");
  run(sb, "S.project.doneFeats = 99; releaseProject();");
  const spent = run(sb, "S.oshiSlotSpent === true");
  run(sb, "designateOshi();");
  const refused = run(sb, "S.project.oshi !== true");
  run(sb, "S.runPeakValue = BAL.valuePerDust * 5; doPrestigeCore('__none', '__auto', -1);");
  const cleared = run(sb, "S.oshiSlotSpent === false");
  run(sb, "designateOshi();");
  const redes = run(sb, "S.project.oshi === true");
  run(sb, "clearOshi(); currentTab = 'proj';");
  run(sb, "S.oshiSlotSpent = true; renderPanel();");
  const uiNote = run(sb, "document.getElementById('panel').innerHTML.includes('この会社の枠は使いました')");
  check("oshi slot: one per company, spent on release, refused after, cleared at EXIT (B10 r4-oshi2)",
    des1 && spent && refused && cleared && redes && uiNote);
  check("oshi: price reads planLv +1 tier, catalog x1.3 and series x1.25 snapshot, cleared at EXIT (B10)",
    Math.abs(boosted - base - 0.2) < 1e-9 && Math.abs(catR / plainR - 1.3) < 1e-9 && catOshi === true &&
    Math.abs(serOshi / serPlain - 1.25) < 1e-9 && kept && run(sb, "!!(S.project && S.project.oshi)") === false);
  check("oshi wording: button is この一本を推す, miyuke-planner has her own line, feat completion leaves the section 2.4 memo (B10 review fix)",
    btnHtml.includes("この一本を推す") && !btnHtml.includes("この作品を推しにする") &&
    miyukeSay === "この一本、わたしも気に入ってる。" &&
    featMemo === "推しの一本『" + projName + "』：機能が一つ灯りました。");
}
}
{
  /* 再設計 段階3: 社格は企業価値が届くと自動で上がる（コインでは買えない） */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.studioLv = 1; S.coins = 1e9; buyStudio();");
  const bought = run(sb, "S.studioLv");
  run(sb, "S.runPeakValue = RANK_VALUE[2]; tickCompanyValue();");
  check("rank rises automatically once company value reaches it",
    bought === 1 && run(sb, "S.studioLv") === 3 && run(sb, "S.coins") === 1e9);
}
{
  /* 再設計 段階4: 収入源の強化の列（メニューから呼べる動詞）と、収入の内訳 */
  const sb = buildSandbox();
  loadGame(sb);
  run(sb, "S.coins = 1e9; S.catalog = [{ n: 'x', r: 10 }];");
  const r0 = run(sb, "catalogRate()");
  run(sb, "buyEngine('promo'); tickCatalog();");
  check("engine upgrades are menu verbs and boost their income source",
    run(sb, "typeof VERBS.buyEngine === 'function' && HOLD_VERBS.buyEngine === 1") && run(sb, "S.upgrades.promo") === 1 &&
    run(sb, "catalogRate()") > r0 * 1.05 && run(sb, "mainIncomeSrc()") === "catalog");
}

{
  /* 再設計 段階2: 1分押し続けると応援の熱が1段上がり、クリックが強くなる */
  const sb = buildSandbox();
  loadGame(sb);
  const before = run(sb, "heatMult()");
  run(sb, "lastClickAt = Date.now(); for(let i = 0; i < 60; i++){ heatClicksThisSec = 1; tickHeat(); }");
  check("a minute of steady cheering heats up the clicks", before === 1 && run(sb, "heatLv()") === 1 && run(sb, "heatMult()") > 1);
}

/* ================= 6. リリースの設定 ================= */
console.log("== 6. release config ==");
{
  const DESK = GAME_HTML.DESK_DIR;
  const conf = JSON.parse(fs.readFileSync(DESK + "src-tauri/tauri.conf.json", "utf8"));
  const cargo = fs.readFileSync(DESK + "src-tauri/Cargo.toml", "utf8");
  const mainRs = fs.readFileSync(DESK + "src-tauri/src/main.rs", "utf8");
  check("app version matches GAME_VERSION and Cargo.toml",
    HTML.includes('const GAME_VERSION = "v' + conf.version + '"') && new RegExp('^version = "' + conf.version.replace(/\./g, "\\.") + '"$', "m").test(cargo));
  check("updater is configured (endpoint, pubkey, signed artifacts, plugin registered)",
    conf.bundle.createUpdaterArtifacts === true && conf.plugins.updater.pubkey && conf.plugins.updater.endpoints.length > 0 &&
    mainRs.includes("tauri_plugin_updater"));
  check("bundle identifier is unchanged (save location stays put)", conf.identifier === "jp.muse.miyuke");
  check("save_game is registered and only the strip window may write", /\bsave_game\b/.test(mainRs) && mainRs.includes("window.label() != WIN_STRIP"));
}

console.log("\n==== SMOKE RESULT: " + PASS + " passed, " + FAIL + " failed ====");
if (failures.length) console.log("failed: " + failures.join(" | "));
process.exit(FAIL ? 1 : 0);
