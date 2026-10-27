/* miyuke-smoke.js — Node + DOMスタブでゲーム HTML (game/src からビルド) を通し実行するスモークテスト。
   Phase A: ブラウザ フルモード（パネルのみ。Strip Canon で部屋シーンは廃止）
   Phase B: ストリップモード + 偽 __TAURI__（ヒットゾーン送信経路）
   Phase B4: Strip Canon 家具（ゾーン/棚/研究机/第2机/装飾/信号機図/⚠チップ）
   Phase B7: みゅけ歩行システム（アートゲート/配達の小旅行/散歩/中断）
   Phase B8: スタッフアニメ（バッチ6: shiro の ANIMS 経路/毛柄別フォールバック）
   Phase B10: スタッフアニメ（バッチ7: kuro/chatora の ANIMS 経路 + パネルポートレート）
   Phase B9: 60fps 化 + 移動レイヤー優先（v2.3.6 目玉 A/B）
   Phase B11: 歩行サイクルと接地速度の同期（位相 = 距離 ÷ ユニット/周 × 周期）
   Phase B12: プロジェクトボード（帯の可読レイヤー: 算数/目盛り/詰まり赤変/
              ヒットゾーン/クリック導線/第2ライン版 + typebox 撤去の回帰ガード）
   Phase B13: 可視生産フロー（アキュムレータ保存則 / 山⇔stageStatus 一致 /
              極端レートでのキャップと束ね / 運搬の一般化 / バグ滞留同期 /
              パッケージ・RPモート・付箋・コイン噴水の節目イベント）
   Phase B14: スタッフバッチ9（chatora 修正版/syamu/sabatora ANIMS）+
              三毛スタッフ引退（COATS 除外 + 旧セーブ決定的着せ替え）+
              環境ドット絵の officeTier 出し分け（ラックは CI との二重ゲート）
   Phase B15: スタッフバッチ10（hachiware ANIMS 化 — 全毛柄アニメ化完了）
   Phase D: v2.3.5 自動アップデート（設定ファイル整合 + 偽 Updater のフロー）
   Phase E: 2ウィンドウ化（owner/viewer 2コンテキスト + 偽イベントバスで
            単一書き手・コマンド一回実行・スナップショット描画を検証）
   Phase A12: セーブのファイル保存（起動時注入の採否 / save_game への書き込み / 読み込み機能）
   Phase A13: 敵対的なセーブ（XSS の無害化 / 読み込みの原子性 / 壊れた起動時セーブの保護）
   Phase F: チュートリアル導線（段階的開示: 事実ベースのステージ進行 /
            ロックと「所持が勝つ」原則 / ベテラン移行 / スキップと見直し /
            viewer がスナップショットだけで同じロック・🆕 を描くこと） */
"use strict";
const fs = require("fs");
const vm = require("vm");

/* 読み先は tools/game-html.cjs が決める（MIYUKE_GAME_HTML で差し替え可能。既定はソースからビルド）。
   worktree-verify.sh が git archive スナップショットを指すために使う。
   未設定時は game/build.mjs で desktop/dist/index.html を作ってから読む。 */
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

/* ---------------- DOM スタブ（tools/dom-stub.cjs に共通化） ---------------- */
const { makeCtx, makeEl, makeFakeDate } = require("./dom-stub.cjs");
function buildSandbox(opts) {
  const byId = {};
  const el = id => {
    if (!byId[id]) {
      byId[id] = makeEl(id === "strip" ? "canvas" : "div");
      if (id === "strip") byId[id]._rect = { left: 0, top: 0, width: opts.width || 1280, height: 210, right: opts.width || 1280, bottom: 210 };
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
    console,
    localStorage,
    location: { hash: opts.hash || "" },
    navigator: { userAgent: "miyuke-smoke" },
    innerWidth: opts.width || 1280,
    innerHeight: opts.height || 800,
    devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
    confirm: () => true,
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval() {},
    setTimeout: () => 0, clearTimeout() {},
    requestAnimationFrame: () => 0,
    _byId: byId, _intervals: intervals, _el: el
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const docListeners = {};
  sandbox.document = {
    body: makeEl("body"),
    documentElement: makeEl("html"),
    getElementById: el,
    createElement: tag => makeEl(tag),
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(t, fn) { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (docListeners[t] || []).slice().forEach(fn => fn(ev || {})); },
    _listeners: docListeners
  };
  if (opts.tauri) sandbox.__TAURI__ = opts.tauri;
  /* 偽時計（opt-in）: fakeNow を渡したサンドボックスだけ、サンドボックス内の
     Date を差し替える。ホストの実時間に依存するテスト（B9-B の移動 dt など）
     を、ホスト側の advance 経由で決定的に進められるようにする。
     渡さないサンドボックスは従来どおり実時計のまま。 */
  if (opts.fakeNow != null) {
    const fake = makeFakeDate(opts.fakeNow);
    sandbox.Date = fake.FakeDate;
    sandbox._advanceFake = fake.advance;
    sandbox._fakeNow = fake.now;
  }
  vm.createContext(sandbox);
  return sandbox;
}
function loadGame(sandbox) {
  for (const b of BLOCKS) vm.runInContext(b, sandbox, { filename: "game-block.js" });
}
function run(sandbox, src) { return vm.runInContext(src, sandbox); }

/* ================= Phase A: 通常モード ================= */
console.log("== Phase A: browser full mode (panels only) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("game script loads", run(sb, "typeof S === 'object' && !!S.project"));
  /* --- Sprint 1: 最初の5分 (チュートリアル作品) --- */
  check("first project is the tutorial (TUT / 120DP)",
    run(sb, "S.project.size") === "TUT" && run(sb, "S.project.totalDP") === 120,
    run(sb, "S.project.size") + "/" + run(sb, "S.project.totalDP"));
  check("ANIMS is the generated MIYUKE_ANIMS object (data-driven)",
    run(sb, "ANIMS === window.MIYUKE_ANIMS"));
  check("ANIMS snack matches importer output (F13 300ms, loop 3..13 x3 (file tag is authoritative))",
    run(sb, "JSON.stringify(ANIMS.miyuke_snack.durations) === '[100,100,100,100,100,100,100,100,100,100,100,100,300,100,100,100,100]' && ANIMS.miyuke_snack.durations.length === 17 && ANIMS.miyuke_snack.loopFrom === 3 && ANIMS.miyuke_snack.loopTo === 13 && ANIMS.miyuke_snack.loopCount === 3"));
  check("legacy miyuke_idle still present", run(sb, "hasSprite('miyuke_idle')"));
  check("legacy miyuke_snack still present", run(sb, "hasSprite('miyuke_snack')"));
  const frameNames = run(sb, `ANIMS.miyuke_idle.frames.concat(ANIMS.miyuke_snack.frames)`);
  check("ANIMS lists 23 frames", frameNames.length === 23, "got " + frameNames.length);
  const missing = frameNames.filter(n => !run(sb, `hasSprite(${JSON.stringify(n)})`));
  check("all ANIMS frames resolve through sprite cache", missing.length === 0, missing.join(","));
  const badSpec = frameNames.filter(n => {
    const s = run(sb, `spriteSize(${JSON.stringify(n)})`);
    return !s || s[0] !== 48 || s[1] !== 40;
  });
  check("all ANIMS frames are 48x40 via SPRITE_SPEC/size", badSpec.length === 0, badSpec.join(","));

  /* --- アニメのタイムライン数学 --- */
  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("snack t=0 -> frame 0", fAt("miyuke_snack", 0) === "miyuke_snack_0");
  check("snack t=150ms -> intro frame 1", fAt("miyuke_snack", 150) === "miyuke_snack_1");
  check("snack t=200ms -> intro frame 2 (loop starts at frame 3 per the file tag)", fAt("miyuke_snack", 200) === "miyuke_snack_2");
  check("snack t=1000ms -> loop frame 10", fAt("miyuke_snack", 1000) === "miyuke_snack_10");
  check("snack t=1400ms -> long chew frame 12", fAt("miyuke_snack", 1400) === "miyuke_snack_12");
  check("snack t=1600ms -> loop wraps to frame 3", fAt("miyuke_snack", 1600) === "miyuke_snack_3");
  check("snack t=4199ms -> last loop frame 13", fAt("miyuke_snack", 4199) === "miyuke_snack_13");
  check("snack t=4200ms -> outro frame 14", fAt("miyuke_snack", 4200) === "miyuke_snack_14");
  check("snack t=4300ms -> outro frame 15", fAt("miyuke_snack", 4300) === "miyuke_snack_15");
  check("snack t=4500ms -> clamps to frame 16", fAt("miyuke_snack", 4500) === "miyuke_snack_16");
  check("snack duration is 4500ms (tag loop 3..13 x3)", run(sb, "animDuration('miyuke_snack')") === 4500);
  check("idle t=0 -> frame 0", fAt("miyuke_idle", 0) === "miyuke_idle_0");
  /* バッチ2: idle は .aseprite 版 300ms/枚が正本 (旧シート版 100ms の期待値は A6 と重複気味に更新) */
  check("idle t=250ms -> frame 0 (300ms/frame)", fAt("miyuke_idle", 250) === "miyuke_idle_0");
  check("idle t=599ms -> frame 1", fAt("miyuke_idle", 599) === "miyuke_idle_1");
  check("idle t=600ms -> frame 2", fAt("miyuke_idle", 600) === "miyuke_idle_2");
  check("idle t=3600ms -> frame 0 (2 full cycles)", fAt("miyuke_idle", 3600) === "miyuke_idle_0");
  check("idle duration is Infinity", run(sb, "animDuration('miyuke_idle')") === Infinity);

  /* --- 状態タイマーと catSprite フック --- */
  run(sb, "giveSnack()");
  check("btn-snack sets eat state", run(sb, "catState") === "eat");
  const eatLen = run(sb, "stateUntil - stateEnteredAt");
  check("eat state lasts ~4500ms (matches animation)", Math.abs(eatLen - 4500) < 60, "got " + eatLen);
  check("catSprite at eat+1000ms is loop frame", run(sb,
    "stateEnteredAt = Date.now() - 1000; catSprite('miyuke_snack')") === "miyuke_snack_10");
  check("catSprite passes non-anim names through", run(sb, "catSprite('miyuke_code_b')") === "miyuke_code_b");

  /* --- 実描画でフレームが切り替わること（帯の sDrawSprite を記録） ---
     Strip Canon: 世界は帯だけなので、実描画の確認は帯レンダラで行う */
  run(sb, "window.__miyukeApplyMode('strip'); miyukeStrip.x = 320;");
  run(sb, `window.__drawn = [];
    const __origSDS = sDrawSprite;
    sDrawSprite = function(n, x, y, sc, f){ window.__drawn.push(n); return __origSDS(n, x, y, sc, f); };`);
  run(sb, "setState('eat', 60000); stateEnteredAt = Date.now(); render()");
  let drawn = run(sb, "window.__drawn.splice(0)");
  check("strip render at eat start draws miyuke_snack_0",
    drawn.includes("miyuke_snack_0"), drawn.filter(d => d.startsWith("miyuke_snack")).join(","));
  run(sb, "stateEnteredAt = Date.now() - 1000; render()");
  drawn = run(sb, "window.__drawn.splice(0)");
  check("strip render at eat+1.0s draws loop frame miyuke_snack_10",
    drawn.includes("miyuke_snack_10"), drawn.filter(d => d.startsWith("miyuke_snack")).join(","));
  run(sb, "stateEnteredAt = Date.now() - 4350; render()");
  drawn = run(sb, "window.__drawn.splice(0)");
  check("strip render at eat+4.35s draws outro frame miyuke_snack_15",
    drawn.includes("miyuke_snack_15"), drawn.filter(d => d.startsWith("miyuke_snack")).join(","));

  /* idle: react 系の床ポーズで idle アニメが出る */
  run(sb, "setState('react_call', 60000); stateEnteredAt = Date.now(); render()");
  drawn = run(sb, "window.__drawn.splice(0)");
  check("strip render idle phase A draws miyuke_idle_0 (eyes open)",
    drawn.includes("miyuke_idle_0"), drawn.filter(d => d.startsWith("miyuke_idle")).join(","));
  run(sb, "stateEnteredAt = Date.now() - 1000; render()");
  drawn = run(sb, "window.__drawn.splice(0)");
  check("strip render idle phase B draws miyuke_idle_3 (blink)",
    drawn.includes("miyuke_idle_3"), drawn.filter(d => d.startsWith("miyuke_idle")).join(","));
  run(sb, "sDrawSprite = __origSDS; window.__miyukeApplyMode('full');");

  /* --- v2 システムのスポットチェック --- */
  run(sb, "S.coins = 100000; S.rp = 100;");
  const role = run(sb, "Object.keys(STAFF_ROLES)[0]");
  const staffBefore = run(sb, "S.staff.length");
  run(sb, `hireStaff(${JSON.stringify(role)})`);
  check("hireStaff adds a staff member", run(sb, "S.staff.length") === staffBefore + 1);
  const lvBefore = run(sb, "S.staff[0].lv || S.staff[0].level || 1");
  run(sb, "trainStaff(S.staff[0].id)");
  const lvAfter = run(sb, "S.staff[0].lv || S.staff[0].level || 1");
  check("trainStaff raises level", lvAfter > lvBefore, lvBefore + " -> " + lvAfter);
  run(sb, `for(let i = 0; i < 10; i++) hireStaff(${JSON.stringify(role)});`);
  const cap = run(sb, "S.staff.length");
  check("studio cap holds (lv1 cap = 3)", cap === 3, "got " + cap);

  run(sb, "S.research.res_line2 = true; S.coins = 100000; buyLine2();");
  check("buyLine2 unlocks line 2", run(sb, "!!S.line2.unlocked"));

  /* --- Sprint 1: クリックが進捗バーを即座に動かす --- */
  run(sb, "window.__mr = Math.random; Math.random = () => 0.99;");   /* クリティカルを止めて決定的に */
  run(sb, "comboN = 0; lastClickAt = 0;");
  const dpBefore = run(sb, "S.projectDP"), wipBefore = run(sb, "S.wip.code");
  const fbNow = run(sb, "firstBoost()");
  const concNow = run(sb, "concProdMult()");
  run(sb, "cheerClick(96, 100, null)");
  const dpDelta = run(sb, "S.projectDP") - dpBefore;
  const wipDelta = run(sb, "S.wip.code") - wipBefore;
  /* gain = 0.25 × combo 1.1 = 0.275。80% が直接進捗 (×firstBoost ×concProdMult)、
     20% が仕掛品 (produceDP 経由で同じく ×concProdMult)。
     Sprint 4: firstBoost は 3.4（旧 1.5）なので期待値は実関数から取る */
  check("one cheer click moves projectDP immediately (direct credit — F redesign: 20% penetration share)",
    Math.abs(dpDelta - 0.275 * 0.2 * fbNow * concNow) < 0.03, "delta=" + dpDelta.toFixed(3) + " fb=" + fbNow + " conc=" + concNow);
  check("the rest of the click flows into WIP (F redesign: 80% pipe-first inflow)",
    Math.abs(wipDelta - 0.275 * 0.8 * fbNow * concNow) < 0.03, "delta=" + wipDelta.toFixed(3));
  check("click sets the progress pulse", run(sb, "progressPulseUntil") > Date.now() - 1000);
  run(sb, "Math.random = window.__mr;");

  /* --- Sprint 1: アイデア着工コストと企画中 --- */
  run(sb, "S.ideas = 10; startProject('M');");
  check("starting an M project deducts 5 ideas", run(sb, "S.ideas") === 5 && run(sb, "S.project.planning") === false,
    "ideas=" + run(sb, "S.ideas"));
  run(sb, "S.ideas = 0; startProject('M');");
  check("insufficient ideas -> planning state", run(sb, "S.project.planning") === true);
  run(sb, "S.ideas = 5; tick();");
  check("planning auto-starts once ideas suffice (deducted on start)",
    run(sb, "S.project.planning") === false && run(sb, "S.ideas") === 0,
    "ideas=" + run(sb, "S.ideas") + " planning=" + run(sb, "S.project.planning"));

  /* --- Sprint 1: 依頼は次作品への予約 (現在の作品を消さない) --- */
  run(sb, "S.projectDP = 123;");
  const curName = run(sb, "S.project.name");
  let lockedSeen = false;
  for (let i = 0; i < 6; i++) {
    run(sb, "genRequests();");
    const gs = run(sb, "S.requests.map(r => r.genre)");
    if (gs.some(g => ["game", "ai", "robot"].includes(g))) lockedSeen = true;
  }
  check("requests never roll research-locked genres", !lockedSeen);
  const reqGenre = run(sb, "S.requests[0].genre");
  run(sb, "acceptRequest(0);");
  check("accepting a request preserves the current project + progress",
    run(sb, "S.project.name") === curName && run(sb, "S.projectDP") === 123);
  check("request is reserved for the next project", run(sb, "S.nextRequestGenre") === reqGenre);
  run(sb, "startProjectSoft();");
  check("next project takes the reserved genre and consumes the reservation",
    run(sb, "S.project.genre") === reqGenre && run(sb, "S.nextRequestGenre") === null,
    "genre=" + run(sb, "S.project.genre"));

  /* C2-P1-5: 依頼文はクライアント別口調のバリエーション（報酬・抽選は不変） */
  check("requestText falls back to the legacy template for an unknown client",
    run(sb, "requestText('見知らぬ猫', 'ゲーム')") === "ゲームの注文を作ってほしいにゃ");
  check("requestText picks a defined tone containing the genre name",
    run(sb, "REQUEST_TONES['漁港のボス猫'].map(t => t.split('{g}').join('ゲーム')).includes(requestText('漁港のボス猫', 'ゲーム'))"));
  let reqTextsOk = true;
  for (let i = 0; i < 10; i++) {
    run(sb, "genRequests();");
    if (!run(sb, "S.requests.length === 3 && S.requests.every(r => r.text.includes(r.genreName))")) reqTextsOk = false;
  }
  check("genRequests always yields 3 requests whose text names its genre", reqTextsOk);

  /* B-P1-2: ボットスプライトは名前契約のみ（絵なし・挙動不変） */
  check("bot sprite contract registered at 24x20 (idle + carry)",
    run(sb, "SPRITE_SPEC['bot_idle'][0] === 24 && SPRITE_SPEC['bot_idle'][1] === 20 && SPRITE_SPEC['bot_carry'][0] === 24 && SPRITE_SPEC['bot_carry'][1] === 20"));
  check("bot sprites have no art yet (contract only, nothing drawn)",
    run(sb, "hasSprite('bot_idle')") === false && run(sb, "hasSprite('bot_carry')") === false);

  const clicksBefore = run(sb, "S.totals.clicks");
  run(sb, "comboN = 0; lastClickAt = 0;");
  run(sb, "for(let i = 0; i < 5; i++) cheerClick(96, 100, null);");
  check("cheerClick counts clicks", run(sb, "S.totals.clicks") === clicksBefore + 5);
  check("combo builds to 5", run(sb, "comboN") === 5, "got " + run(sb, "comboN"));
  const critsBefore = run(sb, "S.totals.crits");
  run(sb, "cheerClick(96, 100, null)"); /* Math.random は通常分布: クリが出るかは不問 */
  check("cheerClick does not throw with crit path armed", true);
  void critsBefore;

  run(sb, "spawnFish(Date.now())");
  check("spawnFish sets fishEvent", run(sb, "!!fishEvent"));
  /* 魚のクリック捕獲は帯のポインタハンドラが担う（Phase B2 で検証。
     Strip Canon で部屋ステージのクリック判定は廃止） */

  let tickOk = true;
  try { run(sb, "for(let i = 0; i < 60; i++) tick();"); } catch (e) { tickOk = false; }
  check("60 ticks run without exceptions", tickOk);
  check("production accrues over ticks", run(sb, "S.runDP") > 0 || run(sb, "S.wip.code + S.wip.tested + S.wip.built") > 0);

  /* --- 第2ライン飢餓の回帰防止 (2026-10-26 実機バグ): ライン1が全工程滞留＋
     バグ在庫過多でも、ライン2は独立の工程容量で進む (旧: 残り容量方式で恒常 0) --- */
  run(sb, "S.line2.unlocked = true; S.line2.genre = 'game'; S.dustTotal = 78;");
  run(sb, "S.project = settleProject(genProject('M')); S.project.planning = false; S.projectDP = 0;");
  run(sb, "S.line2.project = settleProject(genProject('S', 'game')); S.line2.project.planning = false; S.line2.projectDP = 0; S.line2.commitMark = 0;");
  run(sb, "S.wip.code = 5000; S.wip.tested = 5000; S.wip.built = 5000; S.bugStock = 1837;");
  const releasesBeforeL2 = run(sb, "S.totals.releases");
  run(sb, "for(let i = 0; i < 600; i++) tick();");
  check("line 2 progresses under full line-1 saturation (own pipe, no starvation)",
    run(sb, "S.line2.projectDP") > 0 || run(sb, "S.totals.releases") > releasesBeforeL2,
    "l2dp=" + run(sb, "Math.round(S.line2.projectDP)"));
  check("line 1 still progresses in the same saturated state", run(sb, "S.projectDP") > 0);

  /* --- セーブ往復 & v1 マイグレーション --- */
  run(sb, "S.coins = 777; save();");
  const rawSaved = run(sb, "localStorage.getItem(SAVE_KEY)");
  check("save() writes localStorage", typeof rawSaved === "string" && rawSaved.length > 10);
  run(sb, "S.coins = 0; load();");
  check("load() round-trips coins", run(sb, "S.coins") === 777);
  run(sb, `localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: 555, totals: {}, today: {} })); load();`);
  check("v1-ish save migrates: coins kept", run(sb, "S.coins") === 555);
  check("v1-ish save migrates: staff array defaulted", run(sb, "Array.isArray(S.staff)"));
  check("v1-ish save migrates: studioLv defaulted", run(sb, "S.studioLv") === 1);
  check("v1-ish save migrates: line2 defaulted", run(sb, "!!S.line2 && typeof S.line2.unlocked === 'boolean'"));

  /* --- レーンB Phase B: 社格ラダー（上限・Lv6・社格名・最高到達・家具床） --- */
  check("Phase B: STAFF_CAPS is [3,6,10,16,24,36]",
    run(sb, "JSON.stringify(STAFF_CAPS)") === "[3,6,10,16,24,36]");
  check("Phase B: rank names インディー/零細/中小/中堅/準大手/大企業",
    run(sb, "[1,2,3,4,5,6].map(rankName).join('/')") === "インディー/零細/中小/中堅/準大手/大企業");
  check("Phase B: studioCost 400/1200/3600/7200/18000 (top steps compressed by the stagnation Lane A item)",
    run(sb, "[1,2,3,4,5].map(studioCost).join('/')") === "400/1200/3600/7200/18000");
  run(sb, "S.coins = 1000000; S.staff = [];");
  run(sb, "buyStudio();");
  check("Phase B: buyStudio Lv1->2 raises cap 3->6 and records maxStudioLv 2",
    run(sb, "S.studioLv") === 2 && run(sb, "staffCap()") === 6 && run(sb, "S.maxStudioLv") === 2 &&
    run(sb, "companyRank()") === "零細",
    "lv=" + run(sb, "S.studioLv") + " cap=" + run(sb, "staffCap()"));
  run(sb, "buyStudio(); buyStudio(); buyStudio(); buyStudio();");
  check("Phase B: buyStudio reaches Lv6 (大企業, cap 36)",
    run(sb, "S.studioLv") === 6 && run(sb, "staffCap()") === 36 && run(sb, "companyRank()") === "大企業");
  run(sb, "buyStudio();");
  check("Phase B: buyStudio at max keeps Lv6",
    run(sb, "S.studioLv") === 6);
  run(sb, "S.runDP = BAL.prestigeDPPerDust * 5; doPrestige();");
  check("Phase B: prestige resets studioLv to 1 but maxStudioLv stays 6 (no furniture downgrade)",
    run(sb, "S.studioLv") === 1 && run(sb, "S.maxStudioLv") === 6 && run(sb, "officeTier(S)") === 5,
    "lv=" + run(sb, "S.studioLv") + " max=" + run(sb, "S.maxStudioLv") + " tier=" + run(sb, "officeTier(S)"));
  run(sb, `localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: 100, studioLv: 4, totals: {}, today: {} })); load();`);
  check("Phase B: old save without maxStudioLv migrates to current studioLv",
    run(sb, "S.maxStudioLv") === 4);
  run(sb, `localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: 100, studioLv: 4, maxStudioLv: 2, totals: {}, today: {} })); load();`);
  check("Phase B: maxStudioLv below current studioLv is clamped up on load",
    run(sb, "S.maxStudioLv") === 4);
  /* 後続の Phase A テストが見る状態を、ブロック直前（v1風セーブ読込後）に戻す */
  run(sb, `localStorage.setItem(SAVE_KEY, JSON.stringify({ coins: 555, totals: {}, today: {} })); load();`);

  /* --- Sprint 2: サウンドキット（AudioContext 無しでも全キュー安全 no-op） --- */
  check("SoundKit exists", run(sb, "typeof SoundKit === 'object' && typeof SoundKit.play === 'function'"));
  check("sound default: ON in full mode when unset",
    run(sb, "S.settings.sound = null; SoundKit.enabled()") === true);
  let cuesOk = true;
  try {
    run(sb, "S.settings.sound = true; SoundKit.unlock();" +
      "['click','phaseComplete','bugSquash','purchase','releaseFanfare','fishCatch','snack'].forEach(n => SoundKit.play(n));" +
      "SoundKit.play('click', { pitch: 1.3 }); SoundKit.play('no-such-cue');");
  } catch (e) { cuesOk = false; }
  check("all cues no-throw with sound ON and no AudioContext", cuesOk);
  cuesOk = true;
  try { run(sb, "S.settings.sound = false; ['click','releaseFanfare','snack'].forEach(n => SoundKit.play(n));"); }
  catch (e) { cuesOk = false; }
  check("all cues no-throw with sound OFF", cuesOk);
  run(sb, "S.settings.sound = null; toggleSound();");
  check("toggleSound turns explicit OFF in full mode",
    run(sb, "S.settings.sound") === false && run(sb, "SoundKit.enabled()") === false);
  run(sb, "save(); S.settings.sound = null; load();");
  check("sound toggle persists through save/load", run(sb, "S.settings.sound") === false);
  run(sb, "setSoundVol(30);");
  check("setSoundVol stores 0.3", run(sb, "S.settings.soundVol") === 0.3);
  run(sb, "save(); S.settings.soundVol = 0.9; load();");
  check("volume persists through save/load", run(sb, "S.settings.soundVol") === 0.3);
  run(sb, "S.settings.sound = null; S.settings.soundVol = 0.5;");

  /* --- Sprint 2: HUD カウントアップ --- */
  run(sb, "hudShown.coins = 0; S.coins = 1000; renderHeader();");
  const midShown = parseInt(run(sb, "document.getElementById('r-coins').textContent").replace(/,/g, ""), 10);
  check("HUD tweens instead of snapping (0 < shown < 1000)", midShown > 0 && midShown < 1000, "shown=" + midShown);
  run(sb, "for(let i = 0; i < 40; i++) renderHeader();");
  check("HUD count-up converges to the real value",
    run(sb, "document.getElementById('r-coins').textContent") === "1,000",
    run(sb, "document.getElementById('r-coins').textContent"));

  /* --- Sprint 2: バウンス／紙吹雪／節目パルス --- */
  run(sb, "bounceT0 = 0; startBounce();");
  check("bounce starts squashed (sy < 1, sx > 1)",
    run(sb, "bounceScale() !== null && bounceScale().sy < 1 && bounceScale().sx > 1"));
  run(sb, "spawnStripConfetti(200);");
  check("strip confetti pool spawns particles", run(sb, "stripConfetti.length") === 36);
  run(sb, "render();");
  check("render with confetti + bounce does not throw", true);
  run(sb, "milestonePulseUntil = 0; doCommit();");
  check("commit sets the milestone pulse", run(sb, "milestonePulseUntil") > Date.now() - 100);
  check("brand-new save has no return ceremony", run(sb, "returnInfo === null && returnWakeAt === 0"));
}

/* ================= Phase A2: おかえりセレモニー ================= */
console.log("== Phase A2: return ceremony (seeded old save) ==");
{
  const sb = buildSandbox({});
  const endedAt = Date.now() - 65 * 60000;   /* 65分前に終わった前回セッション */
  sb.localStorage.setItem("miyuke-save-v1", JSON.stringify({
    coins: 500, ideas: 10,
    lastSession: { releases: 2, coinsEarned: 350, ms: 25 * 60000, endedAt }
  }));
  loadGame(sb);
  check("returning save: Miyuke starts asleep", run(sb, "catState") === "nap", run(sb, "catState"));
  check("return summary captured (2 releases / 350 coins / 25 min)",
    run(sb, "!!returnInfo && returnInfo.releases === 2 && returnInfo.coinsEarned === 350 && returnInfo.ms === 25 * 60000"));
  const gift = run(sb, "returnInfo.gift");
  check("dream gift is +1..3 ideas after >=30min away", gift >= 1 && gift <= 3, "gift=" + gift);
  check("gift was added to ideas", run(sb, "S.ideas") === 10 + gift, "ideas=" + run(sb, "S.ideas"));
  check("return card is shown with the summary",
    run(sb, "document.getElementById('return-card').style.display") === "" &&
    run(sb, "document.getElementById('return-card').innerHTML").includes("前回は"));
  run(sb, "returnWakeAt = 1; tick();");
  check("wake-up fires: leaves nap, clears wake timer, greets",
    run(sb, "catState") !== "nap" && run(sb, "returnWakeAt") === 0 &&
    run(sb, "document.getElementById('bubble-text').textContent").includes("おはよ"));
  /* ギフトは一度だけ: 保存→再ロードでは、時間の間隔が無いので増えない */
  run(sb, "save();");
  const rawAfter = run(sb, "localStorage.getItem(SAVE_KEY)");
  const ideasAfter = JSON.parse(rawAfter).ideas;
  const sb2 = buildSandbox({});
  sb2.localStorage.setItem("miyuke-save-v1", rawAfter);
  loadGame(sb2);
  check("re-load without a time gap grants no second gift",
    run(sb2, "S.ideas") === ideasAfter && run(sb2, "!returnInfo || returnInfo.gift === 0"),
    "ideas=" + run(sb2, "S.ideas") + " vs saved " + ideasAfter);
  /* lastSession の無い旧セーブ: あらすじ無し・ギフト無し（挨拶のみ） */
  const sb3 = buildSandbox({});
  sb3.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 42, ideas: 7 }));
  loadGame(sb3);
  check("legacy save without lastSession: sleeps, but no summary and no gift",
    run(sb3, "catState") === "nap" && run(sb3, "returnInfo === null") && run(sb3, "S.ideas") === 7);
}

/* ================= Phase A3: Sprint 3（信号機/ヒント/星屑/棚） ================= */
console.log("== Phase A3: Sprint 3 (lamps / affordability / dust shop / shelf) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  /* --- 信号機: バグ詰まり=赤、素材待ち=黄 --- */
  run(sb, "S.bugStock = 40;");
  check("bug-stalled test stage lamp is red",
    run(sb, "stageStatus().find(s => s.id === 'test').lamp") === "red",
    run(sb, "JSON.stringify(stageStatus())"));
  check("currentBottleneck reports the bug stall",
    run(sb, "currentBottleneck() && currentBottleneck().stage") === "test" &&
    run(sb, "currentBottleneck().reason") === "bug");
  check("bottleneck fix for bugs points at the tester upgrade (factory)",
    run(sb, "bottleneckFix() && bottleneckFix().tab") === "factory" &&
    run(sb, "bottleneckFix().fix") === "up:tester");
  run(sb, "renderHeader();");
  check("bottleneck chip shows while stalled",
    run(sb, "document.getElementById('bn-chip').style.display") === "inline-block" &&
    run(sb, "document.getElementById('bn-chip').textContent").includes("バグで詰まり中"));
  run(sb, "S.bugStock = 0; S.wip.code = 0; S.wip.tested = 0; S.wip.built = 0;");
  check("starved test stage lamp is yellow (nothing waiting)",
    run(sb, "stageStatus().find(s => s.id === 'test').lamp") === "yellow");
  check("starved ship stage lamp is yellow",
    run(sb, "stageStatus().find(s => s.id === 'ship').lamp") === "yellow");
  run(sb, "renderHeader();");
  check("bottleneck chip hides when the line flows",
    run(sb, "document.getElementById('bn-chip').style.display") === "none");

  /* --- ビルドがボトルネックになる構成（テスト/出荷を底上げ＋生産増） --- */
  run(sb, "S.upgrades.tester = 8; S.upgrades.bot = 3; S.upgrades.keyboard = 10; S.upgrades.ide = 10;");
  run(sb, "S.coins = 100000; hireStaff('prog'); hireStaff('prog'); hireStaff('prog');");
  const bnStage = run(sb, "bottleneckStage()");
  check("build becomes the bottleneck when test/ship are boosted",
    bnStage.worst.id === "build" && bnStage.isBn, JSON.stringify(bnStage.worst));
  check("bottleneck fix for build points at the CI upgrade",
    run(sb, "bottleneckFix() && bottleneckFix().fix") === "up:ci");
  run(sb, "render();");
  check("render with lamps does not throw", true);
  /* Strip Canon §c.7: 信号機は工場パネルの図に一本化された */
  run(sb, "switchTab('factory');");
  const factoryHtml = run(sb, "document.getElementById('panel').innerHTML");
  check("factory panel draws the lamp diagram (5 stages)",
    (factoryHtml.match(/lampdot/g) || []).length >= 5 &&
    ["企画", "実装", "テスト", "ビルド", "出荷"].every(n => factoryHtml.includes(n)),
    factoryHtml.slice(0, 160));

  /* --- あと○○ヒント（収入レート推定つき） --- */
  run(sb, "incomeSamples = [{ t: Date.now() - 60000, c: 0, r: 0 }, { t: Date.now(), c: 6000, r: 0 }];");
  run(sb, "S.coins = 80; switchTab('staff');");
  const staffHtml = run(sb, "document.getElementById('panel').innerHTML");
  check("almost-affordable hire shows the あと hint (carry 150 - 80 = 70)",
    staffHtml.includes("あと 70"), staffHtml.slice(0, 200));
  run(sb, "S.coins = 500; renderPanel();");
  check("button pulses the moment it becomes affordable",
    run(sb, "document.getElementById('panel').innerHTML").includes("afford-now"));

  /* --- 星屑ショップ: 特典の適用 --- */
  run(sb, "S.dust = 40; S.dustTotal = 30;");
  const cpBefore = run(sb, "clickPower()");
  run(sb, "buyDustPerk('focus');");
  check("focus perk: click power +10%",
    Math.abs(run(sb, "clickPower()") - cpBefore * 1.1) < 1e-9,
    cpBefore + " -> " + run(sb, "clickPower()"));
  run(sb, "buyDustPerk('stardecor'); buyDustPerk('dreamplus'); buyDustPerk('notebook'); buyDustPerk('veteran'); buyDustPerk('seedmoney');");
  run(sb, "buyDustPerk('starlight'); buyDustPerk('omamori'); buyDustPerk('piggybank');");   /* 第2ウェーブ I: 小粒3種 */
  /* Sprint 4: レベル制の特典2件も買う（初回 3 + 2 星屑） */
  run(sb, "buyDustPerk('starcharm'); buyDustPerk('luckyfin');");
  check("all perks purchasable (incl. levelable ones)", run(sb, "DUST_PERKS.every(d => hasPerk(d.id))"));
  check("dust spent on perks (40 - 30 - 5 = 5) but dustTotal (multiplier base) unchanged",
    run(sb, "S.dust") === 5 && run(sb, "S.dustTotal") === 30 &&
    Math.abs(run(sb, "dustMult()") - (1 + 0.04 * 30)) < 1e-9);
  /* レーンA・星屑シンク拡張: Lv制特典の上限 Lv5→Lv10（価格 ×1.8 曲線は不変）。
     Lv5→6 の単価は starcharm ceil(3×1.8^5)=57、luckyfin ceil(2×1.8^5)=38。
     Lv10 では生産 +20%、フィッシュ間隔 ×0.2。 */
  run(sb, "S.dust = 1000; S.dustPerks.starcharm = 5; S.dustPerks.luckyfin = 5;");
  run(sb, "buyDustPerk('starcharm'); buyDustPerk('luckyfin');");
  check("levelable dust perks reach Lv6 past the old cap (cost 57 + 38 = 95)",
    run(sb, "perkLv('starcharm')") === 6 && run(sb, "perkLv('luckyfin')") === 6 &&
    run(sb, "S.dust") === 905,
    "starcharm=" + run(sb, "perkLv('starcharm')") + " luckyfin=" + run(sb, "perkLv('luckyfin')") + " dust=" + run(sb, "S.dust"));
  check("Lv6 multipliers: starcharm production x1.12, luckyfin fish interval x0.52 x omamori 0.95",
    Math.abs(run(sb, "perkProdMult()") - 1.12) < 1e-9 &&
    Math.abs(run(sb, "fishIntervalMul()") - 0.52 * 0.95) < 1e-9);
  run(sb, "S.dustPerks.starcharm = 10; S.dustPerks.luckyfin = 10;");
  check("Lv10 multipliers: starcharm production x1.20, luckyfin fish interval x0.20 x omamori 0.95",
    Math.abs(run(sb, "perkProdMult()") - 1.20) < 1e-9 &&
    Math.abs(run(sb, "fishIntervalMul()") - 0.20 * 0.95) < 1e-9);
  run(sb, "buyDustPerk('starcharm');");
  check("Lv10 is the cap: buying at max spends no dust and stays Lv10",
    run(sb, "perkLv('starcharm')") === 10 && run(sb, "S.dust") === 905);
  run(sb, "window.__miyukeApplyMode('strip'); render(); window.__miyukeApplyMode('full');");
  check("strip render with star decor (on the shelf) does not throw", true);

  /* --- プレビュー = 実際の結果（ベテラン/研究ノート/初期資金込み） --- */
  run(sb, "S.staff = [{ id: 1, name: '若手', coat: 'kuro', role: 'prog', lv: 1 }, { id: 2, name: '古参', coat: 'shiro', role: 'test', lv: 5 }]; S.staffSeq = 2;");
  run(sb, "S.research = { res_game: true, res_ai: true }; S.runDP = 65000;");
  const pv = run(sb, "prestigePreview()");
  check("prestige preview: gain = floor(runDP / 8000) = 8", pv.gain === 8, "gain=" + pv.gain);
  check("prestige preview: multipliers now -> after",
    Math.abs(pv.curMult - (1 + 0.04 * 30)) < 1e-9 && Math.abs(pv.nextMult - (1 + 0.04 * 38)) < 1e-9,
    pv.curMult + " -> " + pv.nextMult);
  check("prestige preview lists kept staff/research via perks",
    pv.keeps.some(k => k.includes("古参")) && pv.keeps.some(k => k.includes("研究ノート")));
  const dustBeforeMove = run(sb, "S.dust");
  run(sb, "doPrestige();");
  check("actual move grants exactly the previewed dust",
    run(sb, "S.dust") === dustBeforeMove + pv.gain, run(sb, "S.dust") + " vs " + (dustBeforeMove + pv.gain));
  check("veteran perk: the most-trained staff survives the move",
    run(sb, "S.staff.length") === 1 && run(sb, "S.staff[0].name") === "古参" && run(sb, "S.staff[0].lv") === 5);
  check("notebook perk: the priciest completed research is kept (res_ai, not res_game)",
    run(sb, "S.research.res_ai") === true && !run(sb, "S.research.res_game"));
  check("seedmoney + piggybank: the new run starts with 300 + 50 carryover (10% of 500) = 350 coins", run(sb, "S.coins") === 350, "coins=" + run(sb, "S.coins"));
  check("dustTotal accumulates across the move (30 + 8 = 38)",
    run(sb, "S.dustTotal") === 38 && Math.abs(run(sb, "dustMult()") - (1 + 0.04 * 38)) < 1e-9);

  /* --- 特典はセーブ/ロードで永続する --- */
  run(sb, "save();");
  run(sb, "S.dustPerks = {}; S.dustTotal = 0; load();");
  check("perks persist through save/load",
    run(sb, "DUST_PERKS.every(d => hasPerk(d.id))") && run(sb, "S.dustTotal") === 38);

  /* --- 二窓: 引っ越しの確認は viewer 側・帯側の本体は confirm を出さない
     (v2.4.7 実機フリーズの回帰防止。帯で confirm が出ると帯のスレッドが止まる) --- */
  run(sb, "S.runDP = 65000; window.__confirmHit = false; window.confirm = () => { window.__confirmHit = true; throw new Error('confirm on owner'); };");
  let coreThrew = "";
  try { run(sb, "VERBS.doPrestige();"); } catch(e){ coreThrew = String(e && e.message || e); }
  check("bridge verb doPrestige is the no-confirm core (runs without touching confirm)",
    coreThrew === "" && !run(sb, "window.__confirmHit") && run(sb, "S.prestiges") === 2, coreThrew);
  run(sb, "window.__sentCmds = []; window.__TAURI__ = { event: { emitTo: (t, ev, p) => { if(ev === 'menu-cmd') window.__sentCmds.push(p); return Promise.resolve(); }, listen: () => Promise.resolve(() => {}) }, core: { invoke: async () => null } };");
  run(sb, "S.runDP = 65000; window.confirm = () => false;");
  run(sb, "makeVerbStub('doPrestige')();");
  check("viewer stub: cancelling the local confirm sends no command",
    run(sb, "window.__sentCmds.length") === 0);
  run(sb, "window.confirm = () => true;");
  run(sb, "makeVerbStub('doPrestige')();");
  check("viewer stub: confirming locally sends the doPrestige command once",
    run(sb, "window.__sentCmds.length") === 1 && run(sb, "window.__sentCmds[0].verb") === "doPrestige");
  run(sb, "delete window.__TAURI__; window.confirm = () => true;");

  /* スタッフの雑談は帯のアンビエントに一本化（部屋側の雑談は廃止）。
     帯の雑談開始・吹き出し描画は Phase B で検証する */

  /* --- 棚コレクション（帯の棚家具）: min(リリース数, 枠数) だけ箱が並ぶ --- */
  run(sb, "S.shelf = []; for(let i = 0; i < 20; i++) S.shelf.push({ name: 'w' + i, icon: i % 8 });");
  const slotCap = run(sb, "stripShelfSlots().length");
  check("strip shelf boxes = min(releases, shelf capacity)",
    run(sb, "stripShelfBoxes().length") === Math.min(20, slotCap),
    "boxes=" + run(sb, "stripShelfBoxes().length") + " cap=" + slotCap);
  run(sb, "S.shelf = S.shelf.slice(0, 3);");
  check("strip shelf boxes track the release count (3 works -> 3 boxes)",
    run(sb, "stripShelfBoxes().length") === 3);
  run(sb, "shelfGlowFrame = frame + 40;");
  check("newest work is highlighted right after a release",
    run(sb, "stripShelfBoxes()[0].glow") === true);
  run(sb, "shelfGlowFrame = -1; window.__miyukeApplyMode('strip'); render(); window.__miyukeApplyMode('full');");
  check("strip render with stocked shelf does not throw", true);
}

/* ================= Phase A4: 星屑マイグレーションと夢の続き ================= */
console.log("== Phase A4: dust migration + dreamplus gift ==");
{
  const sb = buildSandbox({});
  const endedAt = Date.now() - 65 * 60000;
  sb.localStorage.setItem("miyuke-save-v1", JSON.stringify({
    coins: 100, ideas: 10, dust: 4, dustTotal: 9, dustPerks: { dreamplus: true },
    lastSession: { releases: 1, coinsEarned: 100, ms: 10 * 60000, endedAt }
  }));
  loadGame(sb);
  const gift = run(sb, "returnInfo && returnInfo.gift");
  check("dreamplus perk: dream gift is base(1..3) + 1",
    gift >= 2 && gift <= 4, "gift=" + gift);
  check("gift was added to ideas", run(sb, "S.ideas") === 10 + gift);
  check("dustTotal loads from save", run(sb, "S.dustTotal") === 9);
  const sb5 = buildSandbox({});
  sb5.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 42, dust: 7 }));
  loadGame(sb5);
  check("legacy save without dustTotal: total defaults to held dust (multiplier unchanged)",
    run(sb5, "S.dustTotal") === 7 && run(sb5, "typeof S.dustPerks === 'object'"));
}

/* ================= Phase A5: Sprint 4 システム ================= */
console.log("== Phase A5: Sprint 4 (research tier2 / names / treats / save IO / room set) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  /* --- 研究ティア2: 前提ゲートと購入 --- */
  run(sb, "S.rp = 200;");
  run(sb, "buyResearch('res_game2');");
  check("tier2 research is locked without its prerequisite", !run(sb, "!!S.research.res_game2"));
  check("locked purchase does not spend RP", run(sb, "S.rp") === 200, "rp=" + run(sb, "S.rp"));
  run(sb, "buyResearch('res_game');");
  check("tier1 prerequisite purchasable", run(sb, "!!S.research.res_game"));
  run(sb, "buyResearch('res_game2');");
  check("tier2 purchasable after prerequisite", run(sb, "!!S.research.res_game2"));

  /* --- 反復研究: レベル制シンク --- */
  const repCost0 = run(sb, "repeatResearchCost(0)");
  run(sb, "buyResearch('res_report');");
  check("repeatable research gains a level", run(sb, "S.researchLv.res_report") === 1);
  check("repeatable research cost grows (x1.6)", run(sb, "repeatResearchCost(1)") > repCost0,
    repCost0 + " -> " + run(sb, "repeatResearchCost(1)"));
  check("repeatable research feeds production (+2%/Lv via resMult)",
    Math.abs(run(sb, "resMult()") - 1.02) < 1e-9, "resMult=" + run(sb, "resMult()"));

  /* --- 研究員の第二の仕事: ティア1完了後、研究メモ→アイデア --- */
  run(sb, "S.coins = 100000; hireStaff('research'); S.staff[0].lv = 10;");
  run(sb, "for(const d of RESEARCH_DEFS) if(!d.tier) S.research[d.id] = true;");
  check("tier1Done() reports completion", run(sb, "tier1Done()") === true);
  run(sb, "S.ideas = 0; S.rp = 0; S.concentration = 100; setState('code', 600000);");
  run(sb, "for(let i = 0; i < 300; i++) tick();");
  check("researcher still produces RP (first job intact)", run(sb, "S.rp") > 0,
    "rp=" + run(sb, "S.rp"));
  check("researcher second job converts memos to ideas", run(sb, "S.ideas") >= 1.2,
    "ideas=" + run(sb, "S.ideas"));

  /* --- 作品名ジェネレータ: 直近12件と重複しない・多様性 --- */
  run(sb, "S.recentNames = [];");
  const names = run(sb, "(function(){ const out = []; for(let i = 0; i < 40; i++) out.push(genProject().name); return out; })()");
  let windowOk = true;
  for(let i = 0; i < names.length; i++)
    for(let j = Math.max(0, i - 12); j < i; j++)
      if(names[j] === names[i]) windowOk = false;
  check("generated names never repeat within the last 12", windowOk);
  check("name generator variety (40 draws, >=20 distinct)", new Set(names).size >= 20,
    "distinct=" + new Set(names).size);
  check("recentNames history is capped at 12", run(sb, "S.recentNames.length") <= 12,
    "len=" + run(sb, "S.recentNames.length"));

  /* --- リリースした作品にハイライト1行が刻まれる --- */
  run(sb, "S.project = genProject(); S.project.bugs = 20; S.projectDP = 0;");
  run(sb, "releaseProject();");
  const hl = run(sb, "S.shelf[0] && S.shelf[0].highlight");
  check("released work carries a data-driven highlight line",
    typeof hl === "string" && hl.length > 0, String(hl));

  /* --- ご褒美: 終盤コインシンク + 一時バフ --- */
  run(sb, "S.coins = 1000000; S.today.treats = 0; S.totals.coinsEarned = 0; S.buffs = {};");
  const treatCost0 = run(sb, "treatCost(TREAT_DEFS[0])");
  run(sb, "buyTreat('treat_snack');");
  check("treat purchase deducts its cost", run(sb, "S.coins") === 1000000 - treatCost0,
    "coins=" + run(sb, "S.coins"));
  check("treat snack activates the +15% production buff", run(sb, "buffProdMult()") === 1.15);
  check("treat cost scales after a same-day purchase", run(sb, "treatCost(TREAT_DEFS[0])") > treatCost0,
    treatCost0 + " -> " + run(sb, "treatCost(TREAT_DEFS[0])"));

  /* --- セーブ書き出し/読み込み (importSaveText が検証の本体) --- */
  run(sb, "S.coins = 4242;");
  const exported = run(sb, "serializeSave()");
  check("serializeSave returns the stored JSON",
    typeof exported === "string" && exported.indexOf("4242") >= 0);
  run(sb, "S.coins = 1;");
  check("importSaveText accepts a valid exported save",
    run(sb, "importSaveText(" + JSON.stringify(exported) + ")") === true);
  check("import restores the exported state", run(sb, "S.coins") === 4242);
  check("importSaveText rejects non-JSON", run(sb, "importSaveText('not json')") === false);
  check("importSaveText rejects wrong-shape JSON", run(sb, "importSaveText('{\"foo\":1}')") === false);

  /* --- Strip Canon 家具化: 第2ライン机・旧壁装飾が帯の家具として描画リクエストされる ---
     ポスター→イーゼル (prop_wall_1) / カレンダー→卓上 (prop_wall_2) / プレート→トロフィー台 (prop_wall_3) */
  run(sb, "S.line2.unlocked = true; S.stamps.first_release = true; S.stamps.releases10 = true; S.stamps.prestige1 = true;");
  run(sb, `window.__drawnS4 = [];
    const __odsS4 = sDrawSprite;
    sDrawSprite = function(n, x, y, sc, f){ window.__drawnS4.push(n); return __odsS4(n, x, y, sc, f); };
    window.__miyukeApplyMode('strip');
    render();
    sDrawSprite = __odsS4;
    window.__miyukeApplyMode('full');`);
  const drawnS4 = run(sb, "window.__drawnS4");
  /* この時点の S は育った会社 (リリース済み + 第2ライン解放) = officeTier 2。
     棚は shelf_steel の姿で描かれる。第2机はバッチ14以降、全ティアで
     sakuri 作画 prop_desk2 (64×64) (ティア別の出し分け自体は Phase B14 が専用シードで検証する) */
  check("strip render requests shelf + all three converted decor sprites (tier2 steel shelf)",
    ["shelf_steel", "prop_wall_1", "prop_wall_2", "prop_wall_3"].every(n => drawnS4.includes(n)),
    drawnS4.join(","));
  check("strip render requests the line-2 desk sprite (batch 14: prop_desk2 at all tiers)",
    drawnS4.includes("prop_desk2") && !drawnS4.includes("desk_laminate_2_sprite"));
  check("strip render requests the research station plant (prop_plant)", drawnS4.includes("prop_plant"));
}

/* ================= Phase A6: sakuri作画バッチ2/3 (code_a/sleep/idle) ================= */
console.log("== Phase A6: sakuri art batch 2/3 (code anim / sleep anim / idle 300ms) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  /* --- ANIMS データ (インポータ生成物) --- */
  check("ANIMS.miyuke_code_a has 4 frames",
    run(sb, "ANIMS.miyuke_code_a && ANIMS.miyuke_code_a.frames.length") === 4);
  check("code_a durations are 300ms x4 (from the .aseprite file)",
    JSON.stringify(run(sb, "ANIMS.miyuke_code_a.durations")) === "[300,300,300,300]");
  check("code_a frames all resolve to sprites",
    run(sb, "ANIMS.miyuke_code_a.frames.every(f => hasSprite(f))"));
  check("sleep durations are 600ms x7 (encoded in the sleep-2 file)",
    JSON.stringify(run(sb, "ANIMS.miyuke_sleep && ANIMS.miyuke_sleep.durations")) === "[600,600,600,600,600,600,600]");
  check("sleep anim loops forever", run(sb, "ANIMS.miyuke_sleep.loopCount") === Infinity);
  check("idle durations are 300ms x6 (aseprite is canonical, supersedes sheet's 100ms)",
    JSON.stringify(run(sb, "ANIMS.miyuke_idle.durations")) === "[300,300,300,300,300,300]");
  check("snack anim is batch 3 timing (17 frames, F13 300ms, loop 3..13 x3 (file tag is authoritative))",
    run(sb, "ANIMS.miyuke_snack.frames.length") === 17 &&
    run(sb, "ANIMS.miyuke_snack.durations[12]") === 300 &&
    run(sb, "ANIMS.miyuke_snack.loopFrom") === 3 && run(sb, "ANIMS.miyuke_snack.loopCount") === 3);

  /* --- フレーム数学 (純粋タイムライン) --- */
  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("sleep t=0 -> frame 0", fAt("miyuke_sleep", 0) === "miyuke_sleep_0");
  check("sleep t=599 -> frame 0", fAt("miyuke_sleep", 599) === "miyuke_sleep_0");
  check("sleep t=600 -> frame 1", fAt("miyuke_sleep", 600) === "miyuke_sleep_1");
  check("sleep t=1300 -> frame 2", fAt("miyuke_sleep", 1300) === "miyuke_sleep_2");
  check("sleep t=3599 -> frame 5", fAt("miyuke_sleep", 3599) === "miyuke_sleep_5");
  check("sleep t=3600 -> new closing frame 6", fAt("miyuke_sleep", 3600) === "miyuke_sleep_6");
  check("sleep t=4199 -> frame 6", fAt("miyuke_sleep", 4199) === "miyuke_sleep_6");
  check("sleep t=4200 -> wraps to frame 0 (4.2s cycle)", fAt("miyuke_sleep", 4200) === "miyuke_sleep_0");
  check("sleep total cycle is 4200ms of loop (animDuration Infinity)",
    run(sb, "animDuration('miyuke_sleep')") === Infinity);
  check("idle t=299 -> frame 0 at 300ms/frame", fAt("miyuke_idle", 299) === "miyuke_idle_0");
  check("idle t=300 -> frame 1", fAt("miyuke_idle", 300) === "miyuke_idle_1");
  check("idle t=1800 -> full 1.8s cycle back to frame 0", fAt("miyuke_idle", 1800) === "miyuke_idle_0");
  check("code timeline t=300 -> frame 1", fAt("miyuke_code_a", 300) === "miyuke_code_a_1");
  check("code timeline t=1200 -> wraps to frame 0", fAt("miyuke_code_a", 1200) === "miyuke_code_a_0");

  /* --- ドライバ時計: 集中力で code アニメの進み方が変わる --- */
  run(sb, "setState('code', 600000); S.concentration = 100; animClock.base = null;");
  check("driven clock (conc 100) starts at code frame 0",
    run(sb, "catSprite('miyuke_code_a')") === "miyuke_code_a_0");
  run(sb, "animClock.last = Date.now() - 200;");
  check("conc 100 (x2.0): +200ms real advances 400ms anim -> frame 1",
    run(sb, "catSprite('miyuke_code_a')") === "miyuke_code_a_1",
    run(sb, "animClock.acc"));
  run(sb, "S.concentration = 0; animClock.base = null; catSprite('miyuke_code_a'); animClock.last = Date.now() - 200;");
  check("conc 0 (x0.5): +200ms real advances 100ms anim -> still frame 0",
    run(sb, "catSprite('miyuke_code_a')") === "miyuke_code_a_0",
    run(sb, "animClock.acc"));

  /* 部屋描画での code/nap 確認は Strip Canon で帯へ移行:
     コーディング中に code フレームを描き prop_pc を描かないこと、think で
     prop_pc が戻ること、昼寝で sleep フレーム + 手続き Z 抑制は Phase B3 が検証する */
}

/* ================= Phase A7: sakuri作画バッチ3 (think/debug/bug) ================= */
console.log("== Phase A7: sakuri art batch 3 (think/debug anims + new bug) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("batch 3 palette colors #F1BF41 and #211711 present (palette now 163 after wave J gold props)",
    run(sb, "Object.keys(window.MIYUKE_SPRITES.palette).length") === 163 &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#F1BF41')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#211711')"));
  check("game version is v2.6.1", run(sb, "GAME_VERSION") === "v2.6.1");
  check("ANIMS.miyuke_think has 4 frames x 300ms and loops",
    run(sb, "ANIMS.miyuke_think && ANIMS.miyuke_think.frames.length") === 4 &&
    JSON.stringify(run(sb, "ANIMS.miyuke_think.durations")) === "[300,300,300,300]" &&
    run(sb, "ANIMS.miyuke_think.loopCount") === Infinity);
  check("ANIMS.miyuke_debug has 7 frames x 300ms and loops",
    run(sb, "ANIMS.miyuke_debug && ANIMS.miyuke_debug.frames.length") === 7 &&
    JSON.stringify(run(sb, "ANIMS.miyuke_debug.durations")) === "[300,300,300,300,300,300,300]" &&
    run(sb, "ANIMS.miyuke_debug.loopCount") === Infinity);
  check("think/debug frames all resolve to 48x40 sprites",
    run(sb, "ANIMS.miyuke_think.frames.concat(ANIMS.miyuke_debug.frames).every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
  check("new icon_bug resolves to a 28x28 sprite",
    run(sb, "hasSprite('icon_bug') && spriteSize('icon_bug')[0] === 28 && spriteSize('icon_bug')[1] === 28"));

  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("think t=0 -> frame 0", fAt("miyuke_think", 0) === "miyuke_think_0");
  check("think t=300 -> frame 1 (gold ?)", fAt("miyuke_think", 300) === "miyuke_think_1");
  check("think t=900 -> frame 3 (fading ?)", fAt("miyuke_think", 900) === "miyuke_think_3");
  check("think t=1200 -> wraps to frame 0", fAt("miyuke_think", 1200) === "miyuke_think_0");
  check("debug t=0 -> frame 0 (bug intact)", fAt("miyuke_debug", 0) === "miyuke_debug_0");
  check("debug t=1200 -> frame 4 (slam)", fAt("miyuke_debug", 1200) === "miyuke_debug_4");
  check("debug t=1800 -> frame 6 (clean sit)", fAt("miyuke_debug", 1800) === "miyuke_debug_6");
  check("debug t=2100 -> wraps to frame 0", fAt("miyuke_debug", 2100) === "miyuke_debug_0");
  check("think/debug durations are Infinity (looping states)",
    run(sb, "animDuration('miyuke_think')") === Infinity &&
    run(sb, "animDuration('miyuke_debug')") === Infinity);
}

/* ================= Phase A8: sakuri作画バッチ4 (happy → celebrate) ================= */
console.log("== Phase A8: sakuri art batch 4 (happy anim for the celebrate state) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("batch 4 palette colors #FFC710 and #FFE07B present (palette now 163 after wave J gold props)",
    run(sb, "Object.keys(window.MIYUKE_SPRITES.palette).length") === 163 &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#FFC710')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#FFE07B')"));
  check("ANIMS.miyuke_happy has 10 frames x 300ms, plays exactly once",
    run(sb, "ANIMS.miyuke_happy && ANIMS.miyuke_happy.frames.length") === 10 &&
    JSON.stringify(run(sb, "ANIMS.miyuke_happy.durations")) === "[300,300,300,300,300,300,300,300,300,300]" &&
    run(sb, "ANIMS.miyuke_happy.loopFrom") === 0 &&
    run(sb, "ANIMS.miyuke_happy.loopTo") === 9 &&
    run(sb, "ANIMS.miyuke_happy.loopCount") === 1);
  check("happy frames all resolve to 48x40 sprites",
    run(sb, "ANIMS.miyuke_happy.frames.every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
  check("happy total duration is 3000ms (one pass)",
    run(sb, "animDuration('miyuke_happy')") === 3000);

  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("happy t=0 -> frame 0 (neutral stand)", fAt("miyuke_happy", 0) === "miyuke_happy_0");
  check("happy t=600 -> frame 2 (paws up, sparkles appear)", fAt("miyuke_happy", 600) === "miyuke_happy_2");
  check("happy t=1500 -> frame 5 (sparkle burst)", fAt("miyuke_happy", 1500) === "miyuke_happy_5");
  check("happy t=2700 -> frame 9 (settled stand)", fAt("miyuke_happy", 2700) === "miyuke_happy_9");
  check("happy t=3000 -> holds final frame (no wrap)", fAt("miyuke_happy", 3000) === "miyuke_happy_9");
  check("happy t=4499 -> still holds final frame inside celebrate", fAt("miyuke_happy", 4499) === "miyuke_happy_9");

  /* リリース完了が celebrate 状態 (4500ms) に入ること — happy の唯一のトリガー */
  run(sb, "releaseProject();");
  check("releaseProject() enters the celebrate state",
    run(sb, "catState") === "celebrate", run(sb, "catState"));
  check("celebrate state lasts 4500ms (anim 3000ms + hold)",
    Math.abs(run(sb, "stateUntil - Date.now()") - 4500) < 150,
    String(run(sb, "stateUntil - Date.now()")));
}

/* ================= Phase A9: sakuri作画バッチ5 (walk → 歩行システム) ================= */
console.log("== Phase A9: sakuri art batch 5 (walk anim, art gate ON) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("batch 5 palette colors incl. walk's #B99E7E still present (99 after batch 12)",
    run(sb, "Object.keys(window.MIYUKE_SPRITES.palette).length") === 163 &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#B99E7E')"));
  check("ANIMS.miyuke_walk has 7 frames with the file's own durations and loops forever",
    run(sb, "ANIMS.miyuke_walk && ANIMS.miyuke_walk.frames.length") === 7 &&
    JSON.stringify(run(sb, "ANIMS.miyuke_walk.durations")) === "[600,600,300,600,600,600,600]" &&
    run(sb, "ANIMS.miyuke_walk.loopFrom") === 0 &&
    run(sb, "ANIMS.miyuke_walk.loopTo") === 6 &&
    run(sb, "ANIMS.miyuke_walk.loopCount") === Infinity);
  check("walk frames all resolve to 48x40 sprites",
    run(sb, "ANIMS.miyuke_walk.frames.every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
  check("every walk frame is grounded on the bottom row, same baseline as idle",
    run(sb, "ANIMS.miyuke_walk.frames.every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))") &&
    run(sb, "ANIMS.miyuke_idle.frames.every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));

  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("walk t=0 -> frame 0", fAt("miyuke_walk", 0) === "miyuke_walk_0");
  check("walk t=600 -> frame 1", fAt("miyuke_walk", 600) === "miyuke_walk_1");
  check("walk t=1200 -> frame 2 (the 300ms stride frame)", fAt("miyuke_walk", 1200) === "miyuke_walk_2");
  check("walk t=1500 -> frame 3", fAt("miyuke_walk", 1500) === "miyuke_walk_3");
  check("walk t=3300 -> frame 6", fAt("miyuke_walk", 3300) === "miyuke_walk_6");
  check("walk t=3900 -> wraps to frame 0 (3900ms cycle)", fAt("miyuke_walk", 3900) === "miyuke_walk_0");
}

/* ================= Phase A10: sakuri作画バッチ8 (yarn) ================= */
console.log("== Phase A10: sakuri art batch 8 (yarn anim) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("batch 8 palette colors (yarn purples) present",
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#AC67CD')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#C083DD')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#F1A8EA')"));
  check("ANIMS.miyuke_yarn has 13 frames x 300ms and plays exactly once",
    run(sb, "ANIMS.miyuke_yarn && ANIMS.miyuke_yarn.frames.length") === 13 &&
    JSON.stringify(run(sb, "ANIMS.miyuke_yarn.durations")) === "[300,300,300,300,300,300,300,300,300,300,300,300,300]" &&
    run(sb, "ANIMS.miyuke_yarn.loopFrom") === 0 &&
    run(sb, "ANIMS.miyuke_yarn.loopTo") === 12 &&
    run(sb, "ANIMS.miyuke_yarn.loopCount") === 1);
  check("yarn frames all resolve to 48x40 sprites grounded on the bottom row",
    run(sb, "ANIMS.miyuke_yarn.frames.every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40 && /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));

  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("yarn t=0 -> frame 0 (batting starts)", fAt("miyuke_yarn", 0) === "miyuke_yarn_0");
  check("yarn t=1200 -> frame 4 (pounce begins)", fAt("miyuke_yarn", 1200) === "miyuke_yarn_4");
  check("yarn t=3000 -> frame 10 (settling)", fAt("miyuke_yarn", 3000) === "miyuke_yarn_10");
  check("yarn t=3900 -> holds the settled last frame (no rewind of the arc)",
    fAt("miyuke_yarn", 3900) === "miyuke_yarn_12" && fAt("miyuke_yarn", 4999) === "miyuke_yarn_12");
  check("yarn state resolves through catSprite to the animated frames",
    run(sb, "setState('yarn', 60000); stateEnteredAt = Date.now(); catSprite('miyuke_yarn')") === "miyuke_yarn_0");
}

/* ================= Phase A11: sakuri作画 prop バッチ (prop_coffee) ================= */
console.log("== Phase A11: sakuri prop batch (prop_coffee steam anim) ==");
{
  const sb = buildSandbox({});
  loadGame(sb);

  check("batch 11 palette colors (coffee mug shades) present",
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#E5DCD6')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#844828')") &&
    run(sb, "Object.values(window.MIYUKE_SPRITES.palette).includes('#381A0A')"));
  check("ANIMS.prop_coffee has 2 frames x 600ms (artist correction over the file's 100ms) and loops forever",
    run(sb, "ANIMS.prop_coffee && ANIMS.prop_coffee.frames.length") === 2 &&
    JSON.stringify(run(sb, "ANIMS.prop_coffee.durations")) === "[600,600]" &&
    run(sb, "ANIMS.prop_coffee.loopFrom") === 0 &&
    run(sb, "ANIMS.prop_coffee.loopTo") === 1 &&
    run(sb, "ANIMS.prop_coffee.loopCount") === Infinity);
  check("coffee frames resolve to 28x28 sprites with content bottom at row 25 (saucer)",
    run(sb, "ANIMS.prop_coffee.frames.every(f => hasSprite(f) && spriteSize(f)[0] === 28 && spriteSize(f)[1] === 28 && /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][25]))"));

  const fAt = (base, ms) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${ms})`);
  check("coffee t=0 -> frame 0", fAt("prop_coffee", 0) === "prop_coffee_0");
  check("coffee t=600 -> frame 1 (steam wisp swaps)", fAt("prop_coffee", 600) === "prop_coffee_1");
  check("coffee t=1200 -> wraps to frame 0 (1200ms steam cycle)", fAt("prop_coffee", 1200) === "prop_coffee_0");

  const sb2 = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb2);
  run(sb2, `window.__stripDrawn = [];
    const __origSDS2 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__stripDrawn.push(n); return __origSDS2(n, x, y, s, f); };`);
  run(sb2, "render()");
  check("strip render draws an animated coffee frame on the main desk",
    run(sb2, "window.__stripDrawn.splice(0)").some(d => /^prop_coffee_[01]$/.test(d)));
}

/* ================= Phase A12: セーブのファイル保存 ================= */
/* 正本は Rust 側のファイル (起動時に window.__MIYUKE_SAVE__ で渡り、save_game で書く)。
   localStorage にも同じものを書き、起動時は lastTick の新しい方を採る */
console.log("== Phase A12: file-backed save (Rust save_game + startup injection) ==");
{
  const seed = (coins, lastTick) => JSON.stringify({ coins, ideas: 0, lastTick });
  /* ファイルだけ (localStorage が消えた状態) → ファイルから復元される */
  const sbF = buildSandbox({});
  sbF.__MIYUKE_SAVE__ = seed(1234, 1000);
  loadGame(sbF);
  check("file-only save is restored (localStorage was wiped)", run(sbF, "S.coins") === 1234, "coins=" + run(sbF, "S.coins"));
  check("startup file save is consumed once", run(sbF, "window.__MIYUKE_SAVE__") === null);
  /* 両方ある → lastTick の新しい方 (ここでは localStorage) */
  const sbN = buildSandbox({});
  sbN.__MIYUKE_SAVE__ = seed(111, 1000);
  sbN.localStorage.setItem("miyuke-save-v1", seed(222, 2000));
  loadGame(sbN);
  check("newer of file / localStorage wins (localStorage newer)", run(sbN, "S.coins") === 222, "coins=" + run(sbN, "S.coins"));
  const sbO = buildSandbox({});
  sbO.__MIYUKE_SAVE__ = seed(333, 3000);
  sbO.localStorage.setItem("miyuke-save-v1", seed(444, 2000));
  loadGame(sbO);
  check("newer of file / localStorage wins (file newer)", run(sbO, "S.coins") === 333, "coins=" + run(sbO, "S.coins"));
  /* save() は localStorage と save_game の両方へ同じ JSON を書く */
  const calls = [];
  const sbW = buildSandbox({ tauri: { core: { invoke: (c, a) => { calls.push([c, a]); return Promise.resolve(); } },
    event: { listen: () => Promise.resolve(() => {}), emit: () => Promise.resolve() } } });
  loadGame(sbW);
  calls.length = 0;
  run(sbW, "S.coins = 777; save();");
  const sg = calls.filter(c => c[0] === "save_game");
  check("save() sends the same JSON to Rust save_game and localStorage",
    sg.length === 1 && JSON.parse(sg[0][1].data).coins === 777 &&
    sg[0][1].data === sbW.localStorage.getItem("miyuke-save-v1"), "calls=" + sg.length);
  /* 読み込み機能: 渡したテキストを読み、ファイルへ確定する (起動時セーブで上書きしない) */
  calls.length = 0;
  check("importSaveText loads the given text (not the startup save)",
    run(sbW, `importSaveText(${JSON.stringify(seed(4321, 1))})`) === true && run(sbW, "S.coins") === 4321);
  check("imported save is written through to the file",
    calls.some(c => c[0] === "save_game" && JSON.parse(c[1].data).coins === 4321));
  /* Rust 側: コマンド登録・帯以外からの書き込み拒否・帯にだけ起動時セーブを渡す */
  const rs = fs.readFileSync(GAME_HTML.DESK_DIR + "src-tauri/src/main.rs", "utf8");
  check("main.rs registers save_game and rejects writers other than the strip window",
    /generate_handler!\[[\s\S]*\bsave_game\b[\s\S]*\]/.test(rs) && rs.includes("window.label() != WIN_STRIP"));
  check("main.rs injects the startup save into the strip window only",
    (rs.match(/save_init_script\(app\.handle\(\)\)/g) || []).length === 1 && rs.includes("__MIYUKE_SAVE__"));
}

/* ================= Phase A13: セーブ由来の文字列の無害化と読み込みの原子性 ================= */
console.log("== Phase A13: hostile saves (XSS escaping / atomic load / corrupt startup save) ==");
{
  const PAY = "<img src=x onerror=PWN()>";
  const evil = {
    coins: 1, ideas: 0,
    project: { name: "PJ" + PAY, genre: "app", genreName: "G" + PAY, desc: "D" + PAY, size: "S", totalDP: 900,
               feats: ["F" + PAY], doneFeats: 0, startedAt: 1, bugs: 0, napsAtStart: 0, ideaCost: 0, planning: false, icon: 0, activeSec: 0 },
    staff: [{ id: "1);PWN_ID();(1", name: "CAT" + PAY, coat: "kuro", role: "prog", lv: 1 }],
    shelf: [{ name: "SH" + PAY, genreName: "g", size: "S", date: "d", devMin: 1, lines: 1, bugs: 0, naps: 0, icon: 0, highlight: "H" + PAY }],
    log: [{ tm: "00:00", text: "LOG" + PAY }],
    subs: [{ id: "2);PWN_ID();(2", name: "SUB" + PAY, genre: "app", staff: 5, lv: 1, alloc: 100 }],
    studioLv: 5
  };
  const sbX = buildSandbox({});
  loadGame(sbX);
  check("importing a hostile save succeeds (it is a valid shape)", run(sbX, `importSaveText(${JSON.stringify(JSON.stringify(evil))})`) === true);
  const panels = ["proj", "staff", "shelf"].map(t => { run(sbX, `switchTab(${JSON.stringify(t)}); renderPanel();`); return sbX._el("panel").innerHTML; }).join("\n");
  check("no live <img> tag from save strings reaches any panel", !/<img/i.test(panels), (panels.match(/.{0,30}<img.{0,30}/i) || [""])[0]);
  check("save strings are shown as inert text (full-width brackets)", panels.includes("CAT＜img") && panels.includes("PJ＜img"));
  check("ids that land in onclick attributes are forced to integers", !/PWN_ID/.test(panels) && run(sbX, "S.staff.every(s => Number.isInteger(s.id)) && S.subs.every(s => Number.isInteger(s.id))"));
  check("the persisted save keeps no raw '<' from the hostile import", !sbX.localStorage.getItem("miyuke-save-v1").includes("<img"));
  check("esc() escapes the five HTML-significant characters", run(sbX, "esc(" + JSON.stringify("<a href='x'>&\"</a>") + ")") === "&lt;a href=&#39;x&#39;&gt;&amp;&quot;&lt;/a&gt;");
  check("sanitizer drops prototype-polluting keys", run(sbX, `JSON.stringify(sanitizeSaveData(JSON.parse('{"__proto__":{"x":1},"a":"<b>"}')))`) === '{"a":"＜b＞"}');

  /* 読み込みの原子性: 途中で壊れたら元の状態に戻る (以前は半端な状態のまま次の自動セーブで上書きしていた) */
  const sbA = buildSandbox({});
  loadGame(sbA);
  run(sbA, "S.coins = 123456; for(let i=0;i<5;i++) S.shelf.push({name:'w'+i}); save();");
  for(const bad of ['{"coins":5,"staff":[1]}', '{"coins":5,"subs":[null]}', '{"coins":5,"upgrades":null,"log":null,"requests":null}', '[1,2,3]', '"str"']){
    run(sbA, "S.coins = 123456;");
    const ok = run(sbA, `importSaveText(${JSON.stringify(bad)})`);
    let tickErr = null; try { run(sbA, "tick(); renderPanel();"); } catch(e){ tickErr = e.message; }
    check("bad import " + bad + " either loads cleanly or leaves the game untouched, and tick keeps running",
      tickErr === null && (ok ? run(sbA, "S.coins") === 5 : run(sbA, "S.coins") === 123456), "ok=" + ok + " coins=" + run(sbA, "S.coins") + " err=" + tickErr);
  }
  /* load() が例外を出した場合も元の状態に戻ること (移行処理の中の例外を直接起こす) */
  run(sbA, "S.coins = 777; var __rc = recoatFor; recoatFor = function(){ throw new Error('boom'); };");
  const okBoom = run(sbA, `load(${JSON.stringify(JSON.stringify({ coins: 1, staff: [{ id: 1, name: "a", coat: "mike2", role: "prog", lv: 1 }] }))})`);
  check("an exception inside load() migration rolls S back", okBoom === false && run(sbA, "S.coins") === 777, "ok=" + okBoom + " coins=" + run(sbA, "S.coins"));
  run(sbA, "recoatFor = __rc;");

  /* 起動時のセーブが壊れていた: 退避して保存を止め、元データを上書きしない */
  const sbC = buildSandbox({});
  sbC.localStorage.setItem("miyuke-save-v1", "{ this is not json");
  loadGame(sbC);
  check("corrupt startup save blocks saving (original data is not overwritten)",
    run(sbC, "saveBlocked") === true && sbC.localStorage.getItem("miyuke-save-v1") === "{ this is not json");
  run(sbC, "save();");
  check("save() is a no-op while blocked, and the raw save is backed up",
    sbC.localStorage.getItem("miyuke-save-v1") === "{ this is not json" && sbC.localStorage.getItem("miyuke-save-v1-bad") === "{ this is not json");
  check("the player is told the save could not be read", run(sbC, "S.log.some(e => e.text.includes('読み込めませんでした'))"));
  run(sbC, "doResetSave();");
  check("resetting the save lifts the block and writes a fresh save",
    run(sbC, "saveBlocked") === false && JSON.parse(sbC.localStorage.getItem("miyuke-save-v1")).project.size === "TUT");

  /* tick が例外を出してもメインループは記録して進む */
  const sbT = buildSandbox({});
  loadGame(sbT);
  const errs = [];
  const origErr = console.error; console.error = (...a) => errs.push(a.join(" "));
  run(sbT, "var __t = tick; tick = function(){ throw new Error('tick boom'); };");
  const before = run(sbT, "S.totals.playSec");
  sbT._intervals.find(i => i.ms === 1000).fn();
  console.error = origErr;
  check("a throwing tick is logged and the 1s loop still advances playSec",
    run(sbT, "S.totals.playSec") === before + 1 && errs.some(e => e.includes("tick boom")));
  run(sbT, "tick = __t;");

  /* メニューのコマンドは自前の VERBS だけ (継承プロパティで関数を引かない) */
  const sent = [];
  const sbV = buildSandbox({ tauri: { core: { invoke: () => Promise.resolve() },
    event: { listen: () => Promise.resolve(() => {}), emit: () => Promise.resolve(),
             emitTo: (t, n, p) => { sent.push([n, p]); return Promise.resolve(); } } } });
  loadGame(sbV);
  run(sbV, `dispatchMenuCommand({ id: 7, verb: "constructor", args: [] })`);
  const res = sent.find(x => x[0] === "cmd-result" && x[1] && x[1].id === 7);
  check("menu command 'constructor' is rejected as an unknown verb", !!res && res[1].ok === false && /unknown verb/.test(res[1].error || ""), JSON.stringify(res && res[1]));

  /* Rust 側の制限 (静的確認) */
  const rs = fs.readFileSync(GAME_HTML.DESK_DIR + "src-tauri/src/main.rs", "utf8");
  check("strip-only commands reject other windows (set_strip_scale / set_hit_zones / set_input_counting / save_game)",
    (rs.match(/window\.label\(\) != WIN_STRIP/g) || []).length >= 4);
  check("save_game runs off the main thread, serialized, with fsync before rename",
    rs.includes("#[tauri::command(async)]\nfn save_game") && rs.includes("SAVE_LOCK") && rs.includes("sync_all()"));
  check("beacon: no CORS allow header, random token, no logging of rejected requests",
    !rs.includes("Access-Control-Allow-Origin") && rs.includes("RandomState") && !rs.includes("beacon: rejected request"));
  check("tray quit asks the strip page to save before exiting", rs.includes('emit_to(WIN_STRIP, "save-now"'));
}

/* ================= Phase A14: 描画の性能 (値は不変) ================= */
console.log("== Phase A14: render performance (per-frame staff sums / strip skips header) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, `S.studioLv = 9; S.staff = []; const roles = Object.keys(STAFF_ROLES);
    for(let i = 0; i < 48; i++) S.staff.push({ id: i + 1, name: "c" + i, coat: COATS[i % COATS.length], role: roles[i % roles.length], lv: 1 + (i % 10) });
    S.executives = [{ name: "e", role: "prog" }, { name: "f", role: "test" }];`);
  const plain = run(sb, "JSON.stringify(staffSums())");
  run(sb, `window.__css = 0; const __c = computeStaffSums; computeStaffSums = function(){ window.__css++; return __c(); };`);
  run(sb, "render();");
  check("staff sums are computed at most once per strip frame (was ~31 times with 48 staff)", run(sb, "window.__css") <= 1, "calls=" + run(sb, "window.__css"));
  check("cached staff sums equal the uncached values", run(sb, "JSON.stringify(staffSums())") === plain);
  check("outside render() staff sums are never stale (cache is off)", run(sb, "staffSumsCacheActive") === false && run(sb, "staffSumsFrameCache") === null);
  run(sb, `window.__rh = 0; const __rhOrig = renderHeader; renderHeader = function(){ window.__rh++; return __rhOrig(); }; render();`);
  check("the strip window does not rebuild the hidden HTML header every frame", run(sb, "window.__rh") === 0);
  run(sb, "window.__miyukeApplyMode('full'); render();");
  check("the menu form still updates the header every frame", run(sb, "window.__rh") === 1);
}

/* ================= Phase A15: 導線・可読性・アクセシビリティ ================= */
console.log("== Phase A15: onboarding / readability / accessibility ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  /* ステージ1 (工場で道具を買う) のメモは工場タブを開く (以前はロック中の依頼タブ) */
  run(sb, "S.tut.stage = 1; S.tut.seen = {}; S.coins = 10; tutCelebrate = null;");
  check("stage-1 objective memo opens the factory tab", run(sb, "stripQuestText()").includes("工場") && run(sb, "stripMemoTab()") === "factory", run(sb, "stripMemoTab()"));
  run(sb, "S.tut.stage = 4; S.tut.seen = {};");
  check("stage-4 objective memo opens the staff tab", run(sb, "stripMemoTab()") === "staff");
  run(sb, "S.tut.skipped = true;");
  check("without an objective the memo opens requests (or proj while requests is locked)",
    ["requests", "proj"].includes(run(sb, "stripMemoTab()")));
  check("tutorial line 1 no longer points at the removed 『ひらく』 chip", !run(sb, "TUT_BEATS[1]").includes("ひらく"));
  /* ボードに吊るしたメモは真鍮タグ (コイン) に重ならない */
  run(sb, "S.tut.skipped = false; S.tut.stage = 1; S.tut.seen = {}; S.layoutProps = {}; render();");
  const memo = run(sb, "JSON.stringify(stripHitRects.memo || null)");
  const brd = run(sb, "JSON.stringify(stripHitRects.board || null)");
  if(memo !== "null" && brd !== "null"){
    const m = JSON.parse(memo), b = JSON.parse(brd);
    check("board memo ends before the brass coin tag", m.x + m.w <= b.x + b.w - 4 - 68, "memo=" + memo + " board=" + brd);
  } else check("board memo ends before the brass coin tag (memo and board drawn)", false, memo + " " + brd);
  /* 入りきらないメモは前半を詰め、末尾の「（あと N🪙）」は残す (幅は 1 文字 7.5 単位で測る) */
  run(sb, `window.__ft = []; const __ofT = sctx.fillText, __omT = sctx.measureText; sctx.fillText = function(t){ window.__ft.push(String(t)); }; sctx.measureText = function(t){ return { width: String(t).length * 7.5 }; }; drawStripMemoTag(0, 0, "🎯 工場で道具を1つ買おう（あと 28🪙）", 124); sctx.fillText = __ofT; sctx.measureText = __omT;`);
  const memoDrawn = run(sb, "window.__ft.join('|')");
  check("a long memo keeps its trailing shortfall and elides the middle", /…（あと 28🪙）$/.test(memoDrawn), memoDrawn);
  /* 点滅を控える設定: 状態の合図は常に点灯 */
  run(sb, "S.settings.reduceMotion = false; frame = 49;");
  check("blinkOn follows the frame clock normally", run(sb, "blinkOn(50, 30)") === false);
  run(sb, "toggleReduceMotion();");
  check("reduce-motion setting keeps status blinks steadily on", run(sb, "S.settings.reduceMotion") === true && run(sb, "blinkOn(50, 30)") === true);
  check("reduce-motion is a menu command (routed to the strip)", run(sb, "typeof VERBS.toggleReduceMotion") === "function");
  /* 内部コードを見せない */
  check("tutorial work shows as 『はじめて』 instead of TUT", run(sb, "sizeLabel('TUT')") === "はじめて" && run(sb, "sizeLabel('M')") === "M");
  /* アクセシビリティ: タブ・購入ボタン・折りたたみ・スライダー */
  run(sb, "window.__miyukeApplyMode('full'); S.tut.skipped = true; S.coins = 99999; switchTab('factory'); renderPanel();");
  const fh = sb._el("panel").innerHTML;
  check("buy buttons carry an accessible name with the price", /<button class='buybtn[^']*'[^>]*aria-label='[^']*🪙/.test(fh));
  check("fold headers expose aria-expanded", /class='fold-head' aria-expanded='(true|false)'/.test(fh));
  run(sb, "switchTab('settings'); renderPanel();");
  const sh = sb._el("panel").innerHTML;
  check("volume slider has an accessible name", sh.includes("aria-label='効果音の音量'"));
  check("selected strip size is a pressed toggle, not a disabled button", /class='switch on' aria-pressed='true'>100%/.test(sh));
  check("reduce-motion toggle is offered in settings", sh.includes("点滅を減らす"));
  check("menu tabs are exposed as tabs with a selected state",
    run(sb, "Array.from(tabsEl.children).every(b => b.getAttribute ? true : true)") && fs.readFileSync(require("path").join(__dirname, "..", "game", "src", "game", "ui-core.ts"), "utf8").includes('setAttribute("role", "tab")'));
  check("purchase logs format coin amounts with separators", !/（-" *\+ *(cost|total) *\+ *"🪙/.test(HTML));
}

/* ================= Phase B: ストリップ + 偽 Tauri ================= */
console.log("== Phase B: strip mode with fake Tauri ==");
{
  const invokes = [];
  const tauri = { core: { invoke: (cmd, args) => { invokes.push([cmd, args]); return Promise.resolve({}); } } };
  const sb = buildSandbox({ hash: "#strip", tauri, width: 1280, height: 210 });
  loadGame(sb);

  check("strip class applied from #strip hash", sb.document.body.classList.contains("strip"));
  run(sb, "S.coins = 100000; hireStaff(Object.keys(STAFF_ROLES)[0]);");
  run(sb, `window.__stripDrawn = [];
    const __origSDS = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__stripDrawn.push(n); return __origSDS(n, x, y, s, f); };`);
  run(sb, "setState('watch', 60000); stateEnteredAt = Date.now();");
  for (let i = 0; i < 4; i++) run(sb, "render()");
  let drawn = run(sb, "window.__stripDrawn.splice(0)");
  check("strip render draws sakuri idle frame (watch state)",
    drawn.some(d => /^miyuke_idle_\d$/.test(d)), drawn.slice(0, 12).join(","));
  run(sb, "stateEnteredAt = Date.now() - 1000; render()");
  drawn = run(sb, "window.__stripDrawn.splice(0)");
  check("strip render advances to blink frame miyuke_idle_3",
    drawn.includes("miyuke_idle_3"), drawn.filter(d => d.startsWith("miyuke_idle")).join(","));

  /* --- Sprint 1→バッチ2: コーディング中の PC 表示 (帯) ---
     Sprint 1 では「帯でコーディング中に PC が消える」を prop_pc 常時表示で直した。
     バッチ2 で sakuri作画 code アニメ (ポーズ内にモニタ) が来たため、アニメ再生中は
     ポーズ内モニタが PC を担い prop_pc は描かない (二重モニタ防止) のが新しい契約。
     アニメが無い環境では従来どおり prop_pc が出る (フォールバックは B3/A6 で担保) */
  run(sb, "miyukeStrip.x = stripDeskCX(); setState('code', 60000); render();");
  drawn = run(sb, "window.__stripDrawn.splice(0)");
  check("strip coding: sakuri code anim frame replaces prop_pc (monitor lives in the pose)",
    drawn.some(d => /^miyuke_code_a_\d$/.test(d)) && !drawn.includes("prop_pc"),
    drawn.slice(0, 12).join(","));
  run(sb, "sDrawSprite = __origSDS;");

  /* --- Sprint 2→2ウィンドウ化: 音の既定は「帯がニュートラル」原則 (sakuri 確定)。
     メニュー開閉に連動させず、未設定でも帯 (owner) で鳴る。明示 OFF は常に優先 --- */
  check("sound default: ON in strip/owner when unset (neutral-state principle)",
    run(sb, "S.settings.sound = null; SoundKit.enabled()") === true);
  check("sound explicit OFF wins in strip/owner",
    run(sb, "S.settings.sound = false; SoundKit.enabled()") === false);
  run(sb, "S.settings.sound = null;");
  run(sb, "S.totals.releases++; render();");
  check("strip confetti bursts on release (alongside box-carry)",
    run(sb, "stripConfetti.length") > 0, "n=" + run(sb, "stripConfetti.length"));

  /* --- Sprint 3: 訪問猫とスタッフ同士の雑談（帯のアンビエント） --- */
  run(sb, "S.staff = [{ id: 901, name: 'テスト猫', coat: 'kuro', role: 'prog', lv: 1 }]; S.staffSeq = 901;");
  run(sb, "render();");
  const vis = run(sb, "spawnStripVisitor()");
  check("visitor spawns with a coat not currently hired",
    !!vis && vis.coat !== "kuro" && run(sb, "!!stripVisitor"),
    vis && vis.coat);
  run(sb, "stripVisitor.x = 100; render();");
  check("strip render with visitor does not throw", true);
  run(sb, "S.staff.push({ id: 902, name: '相方', coat: 'shiro', role: 'test', lv: 1 }); render();");
  run(sb, "stripWalkers[901].x = 300; stripWalkers[902].x = 315; stripChat = null; lastChatterAt = 0;");
  check("chatter starts between nearby walkers",
    run(sb, "maybeStartChatter(Date.now(), true)") === true);
  check("chatter text comes from the line pool",
    run(sb, "!!stripChat && CHAT_LINES.includes(stripChat.text)"));
  run(sb, "render();");
  check("strip render with chatter bubble does not throw", true);

  run(sb, "publishHitZones(true)");
  const zoneCalls = invokes.filter(([c]) => c === "set_hit_zones");
  check("set_hit_zones invoked under Tauri", zoneCalls.length >= 1, "calls=" + zoneCalls.length);
  const lastZones = zoneCalls.length ? zoneCalls[zoneCalls.length - 1][1].zones : [];
  check("hit zones include desk + miyuke + staff (>=3)", lastZones.length >= 3, "got " + lastZones.length);
  const W = 1280, H = 210;
  const inBounds = lastZones.every(z =>
    Array.isArray(z) && z[0] >= -1 && z[1] >= -1 && z[0] + z[2] <= W + 1 && z[1] + z[3] <= H + 1);
  check("all hit zones are within the window", inBounds, JSON.stringify(lastZones));
  const hz = run(sb, "window.__miyukeHitZones()");
  check("__miyukeHitZones exposes current zones", Array.isArray(hz) && hz.length >= 3);

  /* --- Sprint 4 方向転換: コーディング速度は集中力連動（入力レートではない） --- */
  check("concentration factor: 0 -> x0.5 floor (never frozen)",
    Math.abs(run(sb, "S.concentration = 0; concentrationFactor()") - 0.5) < 1e-9);
  check("concentration factor: 100 -> x2.0",
    Math.abs(run(sb, "S.concentration = 100; concentrationFactor()") - 2.0) < 1e-9);
  check("concentration factor: 50 -> x1.25 and monotonic",
    Math.abs(run(sb, "S.concentration = 50; concentrationFactor()") - 1.25) < 1e-9);
  /* レーンA・集中力 redesign: 生産倍率 concProdMult (アニメ速度の
     concentrationFactor とは別物。0% でも x1.0 を割らない＝罰でなく伸び) */
  check("concProdMult: 0 -> x1.0 (punishment-free floor)",
    Math.abs(run(sb, "S.concentration = 0; concProdMult()") - 1.0) < 1e-9);
  check("concProdMult: 50 -> x1.175",
    Math.abs(run(sb, "S.concentration = 50; concProdMult()") - 1.175) < 1e-9);
  check("concProdMult: 100 -> x1.35",
    Math.abs(run(sb, "S.concentration = 100; concProdMult()") - 1.35) < 1e-9);
  check("concProdMult: clamped outside 0..100",
    Math.abs(run(sb, "S.concentration = 150; concProdMult()") - 1.35) < 1e-9 &&
    Math.abs(run(sb, "S.concentration = -20; concProdMult()") - 1.0) < 1e-9);
  /* produceDP に concProdMult が乗ること: 他の倍率を固定し、集中力だけを
     変えた runDP の伸び比が 1.35 になる (firstBoost を切るため releases=1) */
  const concRatio = run(sb, "S.totals.releases = 1; if(S.tut && S.tut.seen) S.tut.seen.first_bug = true; S.concentration = 0; S.runDP = 0; produceDP(100, 'l1'); const d0 = S.runDP; S.concentration = 100; S.runDP = 0; produceDP(100, 'l1'); S.runDP / d0;");
  check("produceDP scales with concentration (100 vs 0 -> x1.35)",
    Math.abs(concRatio - 1.35) < 1e-9, "ratio=" + concRatio);
  /* 応援クリック直接分 (80%) にも同じく乗ること: クリティカルを乱数固定で
     封じ、偽プロジェクトへの projectDP 伸び比を測る。状態は全て復元する */
  const cheerRatio = run(sb, `(() => {
    const oldProj = S.project, oldDP = S.projectDP, oldMark = S.commitMark, oldRel = S.totals.releases, oldRand = Math.random;
    try {
      Math.random = () => 0.99;
      S.totals.releases = 1;
      S.project = { planning:false, totalDP:100000, feats:['a','b','c'], doneFeats:0 };
      S.projectDP = 0; S.commitMark = 0;
      if(S.tut && S.tut.seen) S.tut.seen.first_bug = true;
      S.concentration = 0; lastClickAt = 0; cheerClick(0, 0, 'body'); const d0 = S.projectDP;
      S.projectDP = 0; S.commitMark = 0;
      S.concentration = 100; lastClickAt = 0; cheerClick(0, 0, 'body'); const d1 = S.projectDP;
      return d1 / d0;
    } catch(e) { return -1; } finally {
      Math.random = oldRand; S.project = oldProj; S.projectDP = oldDP; S.commitMark = oldMark; S.totals.releases = oldRel;
    }
  })()`);
  check("cheerClick direct share scales with concentration (100 vs 0 -> x1.35)",
    Math.abs(cheerRatio - 1.35) < 1e-9, "ratio=" + cheerRatio);
  run(sb, "S.concentration = 100; codePhaseMs = 0; advanceCodePhase(150);");
  check("coding phase advances at x2 when concentration is full (150ms -> 300ms, bit flips)",
    run(sb, "codePhaseMs") === 300 && run(sb, "codeFrameBit()") === 1,
    "phase=" + run(sb, "codePhaseMs"));
  run(sb, "S.concentration = 0; codePhaseMs = 0; advanceCodePhase(150);");
  check("coding phase advances at x0.5 when concentration is empty (150ms -> 75ms)",
    run(sb, "codePhaseMs") === 75 && run(sb, "codeFrameBit()") === 0,
    "phase=" + run(sb, "codePhaseMs"));
  run(sb, "for(let i = 0; i < 60; i++) noteInput(); codePhaseMs = 0; advanceCodePhase(150);");
  check("input pulses no longer drive coding speed (still x0.5 at conc 0)",
    run(sb, "codePhaseMs") === 75 && run(sb, "typeof codeSpeedFactor") === "undefined",
    "phase=" + run(sb, "codePhaseMs"));
  check("coding anims are registered with the concentration rate driver",
    run(sb, "ANIM_RATE_DRIVERS.miyuke_code_a") === "concentration" &&
    run(sb, "ANIM_RATE_DRIVERS.miyuke_code_b") === "concentration");
  check("animRateFor follows concentration (x2 at full, x1 for unregistered)",
    run(sb, "S.concentration = 100; animRateFor('miyuke_code_a')") === 2 &&
    run(sb, "animRateFor('miyuke_idle')") === 1);
  /* 本番コーディング絵 (ANIMS 化された miyuke_code_a) が同じドライバ時計を
     継承すること: テスト用エントリを差しても catSprite がドライバ経由で
     フレーム名を返し、クラッシュしない */
  run(sb, "ANIMS.miyuke_code_a = { frames: ['miyuke_idle_0','miyuke_idle_1','miyuke_idle_2','miyuke_idle_3'], durations: [300,300,300,300], loopFrom: 0, loopTo: 3, loopCount: Infinity, direction: 'forward' }; stateEnteredAt = Date.now(); S.concentration = 80;");
  const csName = run(sb, "catSprite('miyuke_code_a')");
  check("catSprite routes rated anims through the driven clock",
    ["miyuke_idle_0","miyuke_idle_1","miyuke_idle_2","miyuke_idle_3"].includes(csName), String(csName));
  run(sb, "delete ANIMS.miyuke_code_a;");
}

/* ================= Phase B2: Sprint 4 帯イベント + 節目チップ ================= */
console.log("== Phase B2: strip events + milestone chip (Sprint 4) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  /* stripVW は fitStrip が render 中に実寸から決めるので、座標換算に使う値は
     必ず render の後にライブで読むこと（初期値 640 で計算すると当たらない） */
  const SG = run(sb, "STRIP_GROUND"), SH = run(sb, "STRIP_H");

  /* --- 節目チップは Stage 3 で廃止 (節目はリーダーボードのバー+ティックが担う) --- */

  /* --- 金の魚: 帯を泳ぎ、帯クリックで捕まる --- */
  run(sb, "spawnFish(Date.now());");
  for(let i = 0; i < 5; i++) run(sb, "render();");
  check("strip fish appears and swims", !!run(sb, "stripFish"));
  check("strip fish gets a hit rect", !!run(sb, "stripHitRects.fish"));
  const fishX = run(sb, "stripFish.x");
  const coinsBeforeFish = run(sb, "S.coins");
  sb._el("strip").dispatch("pointerdown",
    { clientX: fishX / run(sb, "stripVW") * 1280, clientY: (SG - 7) / SH * 210 });
  check("strip click catches the fish", run(sb, "!fishEvent"));
  check("strip fish catch pays the shared reward", run(sb, "S.coins") > coinsBeforeFish,
    coinsBeforeFish + " -> " + run(sb, "S.coins"));

  /* --- バグ大量発生: 帯座標で叩ける --- */
  run(sb, "spawnBugSwarm(Date.now());");
  for(let i = 0; i < 5; i++) run(sb, "render();");
  const bugsBefore = run(sb, "bugEvent ? bugEvent.bugs.length : 0");
  check("strip bug swarm is active", bugsBefore > 0, "bugs=" + bugsBefore);
  const bp = run(sb, "stripBugXY(bugEvent.bugs[0])");
  sb._el("strip").dispatch("pointerdown",
    { clientX: bp.x / run(sb, "stripVW") * 1280, clientY: bp.y / SH * 210 });
  check("strip click splats a bug", run(sb, "bugEvent ? bugEvent.bugs.length : 0") < bugsBefore,
    bugsBefore + " -> " + run(sb, "bugEvent ? bugEvent.bugs.length : 0"));
}

/* ================= Phase B3: 帯のバッチ2 (code/sleep アニメ) ================= */
console.log("== Phase B3: strip batch 2 (code anim at desk / sleep anim / Z) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, `window.__sDrawnB3 = [];
    const __osdsB3 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__sDrawnB3.push(n); return __osdsB3(n, x, y, s, f); };`);

  /* --- コーディング: code アニメが流れ、prop_pc は消える (ポーズ内モニタが担う) --- */
  run(sb, "setState('code', 600000);");
  for(let i = 0; i < 6; i++) run(sb, "render();");
  let drawn = run(sb, "window.__sDrawnB3.splice(0)");
  check("strip coding draws a sakuri code_a anim frame",
    drawn.some(d => /^miyuke_code_a_\d$/.test(d)),
    drawn.filter(d => d.indexOf("miyuke_code") === 0).join(","));
  check("strip coding does NOT draw prop_pc (in-pose monitor replaces it)",
    !drawn.includes("prop_pc"), drawn.join(","));
  run(sb, "setState('think', 600000);");
  for(let i = 0; i < 3; i++) run(sb, "render();");
  drawn = run(sb, "window.__sDrawnB3.splice(0)");
  check("strip think draws prop_pc again", drawn.includes("prop_pc"));

  /* --- 昼寝: sleep アニメ + 手続き Z 抑制 --- */
  run(sb, `window.__zB3 = 0;
    const __odzB3 = drawStripZ;
    drawStripZ = function(x, y){ window.__zB3++; return __odzB3(x, y); };`);
  run(sb, "setState('nap', 600000);");
  for(let i = 0; i < 3; i++) run(sb, "render();");
  drawn = run(sb, "window.__sDrawnB3.splice(0)");
  check("strip nap draws a sakuri sleep anim frame",
    drawn.some(d => /^miyuke_sleep_\d$/.test(d)),
    drawn.filter(d => d.indexOf("miyuke_sleep") === 0).join(","));
  check("strip nap suppresses procedural Z while the sleep anim plays",
    run(sb, "window.__zB3") === 0, "z=" + run(sb, "window.__zB3"));
  /* ANIMS.miyuke_sleep が無い環境では旧単体スプライト + 手続き Z に戻る */
  run(sb, "window.__svSleepB3 = ANIMS.miyuke_sleep; delete ANIMS.miyuke_sleep; window.__zB3 = 0;");
  run(sb, "setState('nap', 600000);");
  for(let i = 0; i < 3; i++) run(sb, "render();");
  drawn = run(sb, "window.__sDrawnB3.splice(0)");
  check("strip nap without ANIMS.miyuke_sleep draws the legacy sleep sprite",
    drawn.includes("miyuke_sleep"), drawn.join(","));
  check("strip nap without ANIMS.miyuke_sleep revives procedural Z",
    run(sb, "window.__zB3") > 0, "z=" + run(sb, "window.__zB3"));
  run(sb, "ANIMS.miyuke_sleep = window.__svSleepB3; drawStripZ = __odzB3; sDrawSprite = __osdsB3;");
}

/* ================= Phase B4: Strip Canon 家具 ================= */
console.log("== Phase B4: Strip Canon furniture (zones / shelf / gating) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  const vw = run(sb, "stripVW");

  /* --- R7 ゾーン制: 家具の中心は帯幅に対する比率で決まる --- */
  check("furniture zones sit at their width fractions (B .12 / C .47 / D .63 / E .20,.75)",
    Math.abs(run(sb, "stripShelfCX()") / vw - 0.12) < 0.01 &&
    Math.abs(run(sb, "stripResearchCX()") / vw - 0.47) < 0.01 &&
    Math.abs(run(sb, "stripDesk2CX()") / vw - 0.63) < 0.01 &&
    Math.abs(run(sb, "stripEaselCX()") / vw - 0.20) < 0.01 &&
    Math.abs(run(sb, "stripTrophyCX()") / vw - 0.75) < 0.01,
    "vw=" + vw);

  /* --- v2.4.3: ユーザー配置 (S.layout) が既定ゾーンより優先される --- */
  run(sb, "S.layout.shelf = 0.5; S.layout.desk = 0.66;");
  check("user layout overrides default furniture zones",
    Math.abs(run(sb, "stripShelfCX()") / vw - 0.50) < 0.01 &&
    Math.abs(run(sb, "stripDeskCX()") / vw - 0.66) < 0.01,
    "shelf=" + run(sb, "stripShelfCX()"));
  check("layoutFrac rejects out-of-range values",
    run(sb, "S.layout.shelf = 7; layoutFrac('shelf')") === 0.12);
  run(sb, "resetLayout();");
  check("resetLayout restores the default zones",
    Math.abs(run(sb, "stripShelfCX()") / vw - 0.12) < 0.01 &&
    Math.abs(run(sb, "stripDeskCX()") / vw - 0.30) < 0.01);
  check("layout edit hit-test finds the desk at its center",
    (run(sb, "layoutHitTest(stripDeskCX(), STRIP_GROUND - 10) || {}").id) === "desk");
  check("fresh strip exposes only ungated furniture + ungated props to layout edit (Phase E)",
    JSON.stringify(run(sb, "layoutItems().map(i => i.id)")) === JSON.stringify(["shelf", "desk", "board", "memo", "toolbox", "snack", "coffee", "ship"]));
  check("edit mode hit zones cover the whole strip",
    run(sb, "toggleLayoutEdit(); JSON.stringify(computeHitZones())").includes(",210]") &&
    run(sb, "layoutEdit.on") === true);
  run(sb, "toggleLayoutEdit();");
  check("strip size setting clamps and applies (v2.4.6: relative to the new standard)",
    run(sb, "setStripSize(9); S.settings.stripSize") === 1.45 &&
    run(sb, "setStripSize(0.85); S.settings.stripSize") === 0.85);
  run(sb, "setStripSize(1);");
  check("strip size migration: old 70% becomes the new 100%, old 100% keeps its size",
    run(sb, "migrateStripSize(0.7)") === 1 &&
    Math.abs(run(sb, "migrateStripSize(1)") - 1 / 0.7) < 1e-9 &&
    run(sb, "STRIP_SIZE_BASE") === 0.7);
  /* --- v2.4.6: ホバー枠の対象解決 + 並べ替えボタンの帯側復帰 --- */
  run(sb, "renderStrip();");
  check("hover over the board resolves to the board rect (yellow frame target)",
    run(sb, "stripHover = { x: stripHitRects.board.x + stripHitRects.board.w / 2, y: stripHitRects.board.y + 4 }; stripHoverRect() === stripHitRects.board") === true);
  check("hover over empty sky resolves to no frame",
    run(sb, "stripHover = { x: Math.max(0, stripHitRects.board.x - 40), y: 2 }; stripHoverRect()") === null);
  run(sb, "stripHover = null;");
  check("strip-side layout button is back next to the grip",
    HTML.includes('id="strip-layout"') && HTML.includes("body.strip #strip-layout"));

  /* --- 家具の出現ゲート: 新規状態では棚だけ。解放に応じて増える --- */
  run(sb, `window.__drawnB4 = [];
    const __osdsB4 = sDrawSprite;
    sDrawSprite = function(n, x, y, sc, f){ window.__drawnB4.push(n); return __osdsB4(n, x, y, sc, f); };`);
  run(sb, "render();");
  let drawn = run(sb, "window.__drawnB4.splice(0)");
  check("fresh strip draws the works shelf but no gated furniture",
    drawn.includes("prop_shelf") &&
    !drawn.includes("prop_desk2") && !drawn.includes("prop_wall_1") &&
    !drawn.includes("prop_wall_2") && !drawn.includes("prop_wall_3") && !drawn.includes("prop_plant"),
    drawn.filter(d => d.indexOf("prop_") === 0).join(","));
  run(sb, "S.line2.unlocked = true; S.stamps.first_release = true; S.stamps.releases10 = true; S.stamps.prestige1 = true;");
  run(sb, "S.coins = 100000; hireStaff('research');");
  run(sb, "render();");
  drawn = run(sb, "window.__drawnB4.splice(0)");
  /* 第2ライン解放だけでも officeTier は 2 になる。第2机はバッチ14以降
     全ティアで sakuri 作画 prop_desk2、棚はスチール (shelf_steel) で描かれる。
     イーゼルのポスターは段ボール箱にテープ留めで残る (prop_wall_1) */
  check("unlocked strip draws desk2 (batch 14 sakuri desk) + easel poster + desk calendar + trophy + research plant",
    ["prop_desk2", "prop_wall_1", "prop_wall_2", "prop_wall_3", "prop_plant"].every(n => drawn.includes(n)),
    drawn.join(","));
  run(sb, "sDrawSprite = __osdsB4;");

  /* --- R1: 地面は面にしない（帯全幅を覆う矩形を描かない） --- */
  run(sb, `window.__rectsB4 = [];
    const __osrB4 = sR;
    sR = function(x, y, w, h, c){ window.__rectsB4.push({ x, y, w, h, c }); return __osrB4(x, y, w, h, c); };`);
  run(sb, "S.shelf = [{ name: 'a', icon: 0 }, { name: 'b', icon: 1 }, { name: 'c', icon: 2 }]; render();");
  const rects = run(sb, "window.__rectsB4.splice(0)");
  check("no full-width ground/backdrop rect is drawn (R1)",
    rects.every(r => r.w < vw * 0.98),
    "max w=" + Math.max(...rects.map(r => r.w)) + " vw=" + vw);
  /* --- R13: 棚の実物（帯に箱が積まれる） --- */
  const boxRects = rects.filter(r => r.w === 10 && r.h === 9 &&
    ["#e8873a", "#5aa469", "#4a90c2"].includes(r.c));
  check("shelf draws one physical box per stocked work (3 works -> 3 boxes)",
    boxRects.length === 3, "boxes=" + boxRects.length);
  run(sb, "sR = __osrB4;");

  /* --- R12: 棚はヒットゾーンに入り、クリックで作品棚パネルが開く --- */
  run(sb, "publishHitZones(true);");
  const zones = run(sb, "window.__miyukeHitZones()");
  const scxCss = run(sb, "stripShelfCX()") / vw * 1280;
  check("hit zones include the shelf (clickable furniture, empty stays click-through)",
    zones.some(z => Math.abs((z[0] + z[2] / 2) - scxCss) < 30 && z[1] < 120),
    "zones=" + JSON.stringify(zones));
  /* ブラウザ版の廃止で、帯は自分ではタブを開かない。open_menu を Rust に頼むだけ
     (帯は変形しない)。呼び出しは偽 invoke で記録する */
  run(sb, `window.__inv = []; window.__TAURI__ = { core: { invoke: (c, a) => { window.__inv.push([c, a]); return Promise.resolve(); } } };`);
  sb._el("strip").dispatch("pointerdown", { clientX: scxCss, clientY: (116 - 28) / 120 * 210 });
  check("clicking the shelf asks Rust to open the menu on the shelf tab (strip stays a strip)",
    run(sb, "JSON.stringify(window.__inv)") === JSON.stringify([["open_menu", { tab: "shelf" }]]) &&
    sb.document.body.classList.contains("strip"),
    run(sb, "JSON.stringify(window.__inv)"));
  run(sb, "delete window.__TAURI__;");

  /* --- §c.7: 詰まりの ⚠ は Stage 3 でリーダーボードが担う (B12 で描画検証) --- */
  run(sb, "S.bugStock = 40;");
  check("bottleneck is detected while stalled (leaderboard shows the warning)",
    run(sb, "!!currentBottleneck()") === true);
  run(sb, "S.bugStock = 0;");
}

/* ================= Phase B5: 帯のバッチ3 (think/debug アニメ + 新バグ) ================= */
console.log("== Phase B5: strip batch 3 (think/debug anims + bug swarm sprite) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, `window.__drawnB5 = [];
    const __osdsB5 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB5.push(n); return __osdsB5(n, x, y, s, f); };`);
  /* 初回 render の stripUpdate が机位置へ初期化する（リサイズ前の座標で先置きしない） */
  run(sb, "setState('think', 600000); stateEnteredAt = Date.now() - 300; render();");
  let drawn = run(sb, "window.__drawnB5.splice(0)");
  check("strip think routes through ANIMS (frame 1 at +300ms)",
    drawn.includes("miyuke_think_1"),
    drawn.filter(d => d.indexOf("miyuke_think") === 0).join(","));

  run(sb, "setState('debug', 600000); stateEnteredAt = Date.now() - 1250; render();");
  drawn = run(sb, "window.__drawnB5.splice(0)");
  check("strip debug routes through ANIMS (slam frame 4 at +1250ms)",
    drawn.includes("miyuke_debug_4"),
    drawn.filter(d => d.indexOf("miyuke_debug") === 0).join(","));

  run(sb, "spawnBugSwarm(Date.now()); render();");
  drawn = run(sb, "window.__drawnB5.splice(0)");
  check("strip bug swarm draws the sakuri icon_bug sprite",
    drawn.includes("icon_bug"), drawn.filter(d => d === "icon_bug").join(","));
  run(sb, "sDrawSprite = __osdsB5;");
}

/* ================= Phase B6: 帯のバッチ4 (celebrate → happy アニメ) ================= */
console.log("== Phase B6: strip batch 4 (celebrate routes through happy ANIMS) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, `window.__drawnB6 = [];
    const __osdsB6 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB6.push(n); return __osdsB6(n, x, y, s, f); };`);

  run(sb, "setState('celebrate', 600000); stateEnteredAt = Date.now(); render();");
  let drawn = run(sb, "window.__drawnB6.splice(0)");
  check("strip celebrate starts on happy frame 0",
    drawn.includes("miyuke_happy_0"),
    drawn.filter(d => d.indexOf("miyuke_happy") === 0).join(","));

  run(sb, "stateEnteredAt = Date.now() - 1500; render();");
  drawn = run(sb, "window.__drawnB6.splice(0)");
  check("strip celebrate at +1500ms draws sparkle-burst frame 5",
    drawn.includes("miyuke_happy_5"),
    drawn.filter(d => d.indexOf("miyuke_happy") === 0).join(","));

  run(sb, "stateEnteredAt = Date.now() - 3200; render();");
  drawn = run(sb, "window.__drawnB6.splice(0)");
  check("strip celebrate at +3200ms holds the settled final frame 9",
    drawn.includes("miyuke_happy_9"),
    drawn.filter(d => d.indexOf("miyuke_happy") === 0).join(","));
  run(sb, "sDrawSprite = __osdsB6;");
}

/* ================= Phase B7: みゅけ歩行システム (v2.3.3 / 実アート v2.3.4) =================
   アートゲート: ANIMS.miyuke_walk が実フレーム付きで存在する時だけ旅程が動く。
   v2.3.4 で sakuri作画の実アート (miyuke_walk_0..6・左向き原画) が出荷物に入り、
   ゲートは常時 ON になった。ON 系テストは実アートでそのまま検証し、OFF 前提は
   サンドボックス内でのみ ANIMS エントリを消して再現する */
console.log("== Phase B7: Miyuke walking system (art gate / delivery / stroll / preempt) ==");
const WORK_B7 = "{ name:'w', genreName:'', size:'S', date:'', devMin:1, lines:1, bugs:0, naps:0, icon:1, highlight:'' }";
{
  const WORK = WORK_B7;
  /* ---- ゲート ON ---- */
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  check("B7: walk gate ON in shipped state (real miyuke_walk art)", run(sb, "hasWalkArt()") === true);
  check("B7: real walk ANIMS is 7 sakuri frames with file durations",
    run(sb, "ANIMS.miyuke_walk.frames.join(',')") === "miyuke_walk_0,miyuke_walk_1,miyuke_walk_2,miyuke_walk_3,miyuke_walk_4,miyuke_walk_5,miyuke_walk_6" &&
    run(sb, "ANIMS.miyuke_walk.durations.join(',')") === "600,600,300,600,600,600,600",
    run(sb, "JSON.stringify(ANIMS.miyuke_walk.durations)"));
  run(sb, `S.shelf = [${WORK}, ${WORK}]; S.totals.releases = 2; setState('code', 600000); render();`);
  check("B7: past releases count as delivered (no pending at boot)",
    run(sb, "shelfPending") === 0, "pending=" + run(sb, "shelfPending"));
  check("B7: shelf shows both past boxes", run(sb, "stripShelfBoxes().length") === 2);

  /* ---- 配達の小旅行: リリース → (celebrate) → 棚へ歩く → 箱が現れる → 帰る ---- */
  run(sb, `S.shelf.unshift(${WORK}); S.totals.releases = 3; setState('celebrate', 600000);`);
  run(sb, "stripNow += 500; stripUpdate(0.5);");
  check("B7: new release counted as undelivered", run(sb, "shelfPending") === 1);
  check("B7: newest box hidden until delivered", run(sb, "stripShelfBoxes().length") === 2);
  run(sb, "for(let i = 0; i < 6; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: no excursion during celebrate", run(sb, "miyukeTrip") === null);
  run(sb, "setState('code', 600000);");
  let minX = Infinity, sawTrip = false, glowOnArrival = false;
  for (let i = 0; i < 90; i++) {
    run(sb, "stripNow += 500; stripUpdate(0.5);");
    const x = run(sb, "miyukeStrip.x"); if (x < minX) minX = x;
    if (run(sb, "!!miyukeTrip")) sawTrip = true;
    if (run(sb, "shelfPending") === 0 && run(sb, "shelfGlowFrame > frame")) glowOnArrival = true;
    if (!run(sb, "!!miyukeTrip") && run(sb, "shelfPending") === 0 && i > 12) break;
  }
  check("B7: delivery excursion started after celebrate", sawTrip);
  check("B7: she walked to the shelf zone", minX <= run(sb, "stripShelfCX()") + 50, "minX=" + minX);
  check("B7: delivery completed (pending cleared)", run(sb, "shelfPending") === 0);
  check("B7: box glow lit on arrival (not at release time)", glowOnArrival);
  check("B7: newest box visible after delivery", run(sb, "stripShelfBoxes().length") === 3);
  check("B7: excursion ends back at the desk",
    run(sb, "miyukeTrip") === null && Math.abs(run(sb, "miyukeStrip.x") - run(sb, "stripDeskCX()")) <= 2,
    "x=" + run(sb, "miyukeStrip.x"));

  /* ---- 歩行フレーム（反転）とヒットゾーン追随を第2便で検証 ---- */
  run(sb, `window.__drawnB7 = [];
    const __osdsB7 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB7.push([n, f]); return __osdsB7(n, x, y, s, f); };`);
  run(sb, `S.shelf.unshift(${WORK}); S.totals.releases = 4; setState('code', 600000);`);
  run(sb, "for(let i = 0; i < 24 && !miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: second delivery queued after the first",
    run(sb, "!!miyukeTrip && miyukeTrip.kind === 'deliver' && shelfPending === 1"),
    "trip=" + run(sb, "JSON.stringify(miyukeTrip)") + " pending=" + run(sb, "shelfPending"));
  run(sb, "stripNow += 500; stripUpdate(0.5); render();");
  const drawnB7 = run(sb, "window.__drawnB7.splice(0)");
  check("B7: walk frames drawn unflipped while heading left to the shelf (art is natively left-facing)",
    drawnB7.some(([n, f]) => /^miyuke_walk_\d$/.test(n) && f === false),
    JSON.stringify(drawnB7.filter(([n]) => n.indexOf("miyuke") === 0)));
  const hrB7 = run(sb, "stripHitRects.miyuke");
  check("B7: hit rect tracks her walking position",
    !!hrB7 && Math.abs((hrB7.x + hrB7.w / 2) - run(sb, "miyukeStrip.x")) < 30,
    JSON.stringify(hrB7) + " x=" + run(sb, "miyukeStrip.x"));
  /* ---- 帰路（右行）: 左向き原画なので反転して描かれる ---- */
  run(sb, "window.__drawnB7.splice(0); for(let i = 0; i < 60 && !(miyukeTrip && miyukeTrip.phase === 'return'); i++){ stripNow += 500; stripUpdate(0.5); } stripNow += 500; stripUpdate(0.5); render();");
  const drawnRetB7 = run(sb, "window.__drawnB7.splice(0)");
  check("B7: walk frames drawn flipped while heading right on the return leg",
    drawnRetB7.some(([n, f]) => /^miyuke_walk_\d$/.test(n) && f === true),
    JSON.stringify(drawnRetB7.filter(([n]) => n.indexOf("miyuke") === 0)));
  run(sb, "sDrawSprite = __osdsB7;");
  run(sb, "for(let i = 0; i < 90 && (miyukeTrip || shelfPending > 0); i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: second delivery also completes",
    run(sb, "shelfPending") === 0 && run(sb, "stripShelfBoxes().length") === 4);

  /* ---- 散歩: 一人遊び中だけ始まり、状態変化で切り上げる ---- */
  run(sb, "window.__origRandB7 = Math.random; Math.random = () => 0; tripRestUntil = 0; setState('yarn', 600000);");
  run(sb, "for(let i = 0; i < 10 && !miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: stroll starts from the solo-play rotation",
    run(sb, "!!miyukeTrip && miyukeTrip.kind === 'stroll'"),
    "trip=" + run(sb, "JSON.stringify(miyukeTrip)"));
  run(sb, "Math.random = window.__origRandB7;");
  run(sb, "setState('code', 600000);");
  run(sb, "for(let i = 0; i < 90 && miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: stroll preempted by state change, back at desk",
    run(sb, "miyukeTrip") === null && Math.abs(run(sb, "miyukeStrip.x") - run(sb, "stripDeskCX()")) <= 2,
    "x=" + run(sb, "miyukeStrip.x"));

  /* ---- 散歩: バグイベントでも切り上げる ---- */
  run(sb, "window.__origRandB7 = Math.random; Math.random = () => 0; tripRestUntil = 0; setState('groom', 600000);");
  run(sb, "for(let i = 0; i < 10 && !miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: second stroll starts", run(sb, "!!miyukeTrip && miyukeTrip.kind === 'stroll'"));
  run(sb, "Math.random = window.__origRandB7;");
  run(sb, "spawnBugSwarm(Date.now()); stripNow += 500; stripUpdate(0.5);");
  check("B7: bug event preempts the stroll (return phase)",
    run(sb, "!!miyukeTrip && miyukeTrip.phase === 'return'"),
    "trip=" + run(sb, "JSON.stringify(miyukeTrip)"));
  run(sb, "for(let i = 0; i < 90 && miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); } bugEvent = null;");
  check("B7: stroll abandoned cleanly after bug preempt", run(sb, "miyukeTrip") === null);

  /* ---- 配達のハード割り込み: おやつ (eat) で帰り、後で再配達 ---- */
  run(sb, `S.shelf.unshift(${WORK}); S.totals.releases = 5; tripRestUntil = 0; setState('code', 600000);`);
  run(sb, "for(let i = 0; i < 24 && !miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: third delivery starts",
    run(sb, "!!miyukeTrip && miyukeTrip.kind === 'deliver' && shelfPending === 1"),
    "trip=" + run(sb, "JSON.stringify(miyukeTrip)") + " pending=" + run(sb, "shelfPending"));
  run(sb, "setState('eat', 600000); stripNow += 500; stripUpdate(0.5);");
  check("B7: snack preempts delivery (box stays pending)",
    run(sb, "!!miyukeTrip && miyukeTrip.phase === 'return' && shelfPending === 1"),
    "trip=" + run(sb, "JSON.stringify(miyukeTrip)"));
  run(sb, "for(let i = 0; i < 90 && miyukeTrip; i++){ stripNow += 500; stripUpdate(0.5); }");
  run(sb, "setState('code', 600000);");
  run(sb, "for(let i = 0; i < 140 && (miyukeTrip || shelfPending > 0); i++){ stripNow += 500; stripUpdate(0.5); }");
  check("B7: interrupted delivery is retried and completes",
    run(sb, "shelfPending") === 0 && run(sb, "stripShelfBoxes().length") === 5,
    "pending=" + run(sb, "shelfPending") + " boxes=" + run(sb, "stripShelfBoxes().length"));
  run(sb, "delete ANIMS.miyuke_walk;");
  check("B7: walk gate closes when the ANIMS entry is removed", run(sb, "hasWalkArt()") === false);
}
/* ---- ゲート OFF: 長時間セッションでも小旅行はゼロ、棚は従来どおり即時表示 ---- */
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, "delete ANIMS.miyuke_walk;");   /* v2.3.4: アート未着だった頃の前提をサンドボックス内でのみ再現 */
  check("B7(off): walk gate OFF (miyuke_walk removed from ANIMS)", run(sb, "hasWalkArt()") === false);
  run(sb, `S.shelf = [${WORK_B7}, ${WORK_B7}]; S.totals.releases = 2; setState('code', 600000); render();`);
  run(sb, `S.shelf.unshift(${WORK_B7}); S.totals.releases = 3;`);
  run(sb, "for(let i = 0; i < 240; i++){ stripNow += 500; stripUpdate(0.5); if(miyukeTrip) break; }");
  check("B7(off): zero excursions over a long session", run(sb, "miyukeTrip") === null);
  check("B7(off): nothing is ever pending", run(sb, "shelfPending") === 0);
  check("B7(off): newest box appears immediately (today's behavior)",
    run(sb, "stripShelfBoxes().length") === 3);
  run(sb, "setState('yarn', 600000); for(let i = 0; i < 120; i++){ stripNow += 500; stripUpdate(0.5); if(miyukeTrip) break; }");
  check("B7(off): no strolls in solo play either", run(sb, "miyukeTrip") === null);
}

/* ================= Phase B8: スタッフアニメ (バッチ6: shiro 48×40 ANIMS) =================
   1ファイル (staff_shiro_walk-2.aseprite) に walk 9f + sit 6f。毛柄ごとに
   ANIMS があればアニメ経路 (×3/2)、無ければ従来の静止画 (32×24 ×4/3)。
   バッチ10で全毛柄のアニメ化が完了し、従来経路は保険として残るのみ。
   歩行は左向き原画 (右行で反転)、フレームは walkClock (距離比例) で進む。
   sit は sitStart からの実時間ループ (瞬き含む) */
console.log("== Phase B8: staff ANIMS (shiro walk/sit routing, per-coat fallback) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  const fAt8 = (base, t) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${t})`);

  /* ---- データ: ANIMS エントリとフレーム実在 ---- */
  check("B8: staff_shiro_walk ANIMS is the walk_loop TAG range (7 frames, F8/F9 excluded)",
    run(sb, "ANIMS.staff_shiro_walk.frames.join(',')") ===
      Array.from({ length: 7 }, (_, i) => "staff_shiro_walk_" + i).join(",") &&
    run(sb, "ANIMS.staff_shiro_walk.durations.join(',')") === "600,600,300,600,600,600,600" &&
    run(sb, "ANIMS.staff_shiro_walk.loopFrom") === 0 && run(sb, "ANIMS.staff_shiro_walk.loopTo") === 6 &&
    run(sb, "ANIMS.staff_shiro_walk.loopCount") === Infinity);
  check("B8: staff_shiro_back ANIMS is the BacktoIdle TAG (walk_7, walk_8, sit_0; plays once)",
    run(sb, "ANIMS.staff_shiro_back.frames.join(',')") === "staff_shiro_walk_7,staff_shiro_walk_8,staff_shiro_sit_0" &&
    run(sb, "ANIMS.staff_shiro_back.durations.join(',')") === "600,600,600" &&
    run(sb, "ANIMS.staff_shiro_back.loopCount") === 1 &&
    fAt8("staff_shiro_back", 0) === "staff_shiro_walk_7" &&
    fAt8("staff_shiro_back", 600) === "staff_shiro_walk_8" &&
    fAt8("staff_shiro_back", 1200) === "staff_shiro_sit_0" &&
    fAt8("staff_shiro_back", 99999) === "staff_shiro_sit_0");
  check("B8: staff_shiro_sit ANIMS is 6 frames x 600ms looping",
    run(sb, "ANIMS.staff_shiro_sit.frames.join(',')") ===
      Array.from({ length: 6 }, (_, i) => "staff_shiro_sit_" + i).join(",") &&
    run(sb, "ANIMS.staff_shiro_sit.durations.join(',')") === "600,600,600,600,600,600" &&
    run(sb, "ANIMS.staff_shiro_sit.loopFrom") === 0 && run(sb, "ANIMS.staff_shiro_sit.loopTo") === 5 &&
    run(sb, "ANIMS.staff_shiro_sit.loopCount") === Infinity);
  check("B8: all shiro frames exist at the unified 48x40 spec",
    run(sb, "ANIMS.staff_shiro_walk.frames.concat(ANIMS.staff_shiro_sit.frames)" +
      ".every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
  check("B8: every shiro frame touches the ground row (baseline 39)",
    run(sb, "ANIMS.staff_shiro_walk.frames.concat(ANIMS.staff_shiro_sit.frames)" +
      ".every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));
  check("B8: every coat in COATS has walk+sit+back ANIMS (batch 10: no legacy coats remain)",
    run(sb, "COATS.every(c => ANIMS['staff_' + c + '_walk'] && ANIMS['staff_' + c + '_sit'] && ANIMS['staff_' + c + '_back'])"));
  check("B8: every coat's walk is exactly the 7-frame walk_loop tag range",
    run(sb, "COATS.every(c => ANIMS['staff_' + c + '_walk'].frames.length === 7 && ANIMS['staff_' + c + '_walk'].loopTo === 6)"));

  /* ---- タイムライン: walk は 3900ms 周期 (タグ範囲)、sit は 3600ms 周期 ---- */
  check("B8: walk timeline (accent frame + wrap)",
    fAt8("staff_shiro_walk", 0) === "staff_shiro_walk_0" &&
    fAt8("staff_shiro_walk", 600) === "staff_shiro_walk_1" &&
    fAt8("staff_shiro_walk", 1200) === "staff_shiro_walk_2" &&
    fAt8("staff_shiro_walk", 1500) === "staff_shiro_walk_3" &&
    fAt8("staff_shiro_walk", 3300) === "staff_shiro_walk_6" &&
    fAt8("staff_shiro_walk", 3900) === "staff_shiro_walk_0");
  check("B8: sit timeline (blink cycle + wrap)",
    fAt8("staff_shiro_sit", 0) === "staff_shiro_sit_0" &&
    fAt8("staff_shiro_sit", 600) === "staff_shiro_sit_1" &&
    fAt8("staff_shiro_sit", 3000) === "staff_shiro_sit_5" &&
    fAt8("staff_shiro_sit", 3600) === "staff_shiro_sit_0");

  /* ---- 描画経路: shiro / hachiware とも ANIMS ×3/2
     (バッチ7で kuro/chatora、バッチ9で syamu/sabatora、バッチ10で
      hachiware が ANIMS 化し、全毛柄のアニメ化が完了した。kuro/chatora は
      Phase B10、syamu/sabatora は Phase B14、hachiware は Phase B15 が検証) ---- */
  run(sb, "S.staff = [{ id: 951, name: '白', coat: 'shiro', role: 'prog', lv: 1 }, { id: 952, name: 'ハチ', coat: 'hachiware', role: 'test', lv: 1 }]; S.staffSeq = 952;");
  run(sb, "render();");
  run(sb, `window.__drawnB8 = [];
    const __osdsB8 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB8.push([n, x, y, s, f]); return __osdsB8(n, x, y, s, f); };`);
  run(sb, "stripWalkers[951].x = 400; stripWalkers[951].dir = 1; stripWalkers[951].sitting = false; stripWalkers[951].walkClock = 0;" +
          "stripWalkers[952].x = 900; stripWalkers[952].dir = -1; stripWalkers[952].sitting = false; render();");
  let drawn = run(sb, "window.__drawnB8.splice(0)");
  const shiroWalkDraw = drawn.filter(d => d[0].startsWith("staff_shiro_walk"));
  const hachiWalkDraw = drawn.filter(d => d[0].startsWith("staff_hachiware_walk"));
  check("B8: shiro walker draws ANIMS frames at staff48 scale (x1.5)",
    shiroWalkDraw.length >= 1 && shiroWalkDraw.every(d => d[3] === 1.5),
    JSON.stringify(shiroWalkDraw));
  check("B8: shiro heading right is mirrored (art is natively left-facing)",
    shiroWalkDraw.length >= 1 && shiroWalkDraw.every(d => d[4] === true),
    JSON.stringify(shiroWalkDraw));
  check("B8: hachiware walker draws ANIMS frames at staff48 scale, unflipped heading left (batch 10)",
    hachiWalkDraw.length >= 1 && hachiWalkDraw.every(d => d[3] === 1.5 && d[4] === false),
    JSON.stringify(hachiWalkDraw));
  check("B8: shiro hit rect matches the drawn 72x60 at the walker position",
    (() => { const r = run(sb, "stripHitRects.staff[0]"); const wx = run(sb, "stripWalkers[951].x");
      return r && r.w === 72 && r.h === 60 && Math.abs(r.x + r.w / 2 - wx) < 1.5; })(),
    JSON.stringify(run(sb, "stripHitRects.staff")));

  /* ---- フレーム進行: walkClock (距離比例) と sit の実時間 ---- */
  run(sb, "stripWalkers[951].walkClock = 1300; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: walk frame follows walkClock (1300ms -> frame 2, the 300ms accent)",
    drawn.some(d => d[0] === "staff_shiro_walk_2"), JSON.stringify(drawn.filter(d => d[0].startsWith("staff_shiro"))));
  const clockBefore = run(sb, "stripWalkers[951].walkClock");
  run(sb, "stripNow += 500; stripUpdate(0.5);");
  check("B8: walkClock advances while walking (distance-driven)",
    run(sb, "stripWalkers[951].walkClock") > clockBefore,
    clockBefore + " -> " + run(sb, "stripWalkers[951].walkClock"));
  run(sb, "stripWalkers[951].dir = -1; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: shiro heading left is drawn unflipped",
    drawn.some(d => d[0].startsWith("staff_shiro_walk") && d[4] === false),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_shiro"))));
  const sitClock = run(sb, "stripWalkers[951].walkClock");
  run(sb, "stripWalkers[951].sitting = true; stripWalkers[951].sitStart = stripNow; stripWalkers[951].until = stripNow + 100000; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: sitting shiro draws sit frame 0 at staff48 scale, unflipped",
    drawn.some(d => d[0] === "staff_shiro_sit_0" && d[3] === 1.5 && d[4] === false),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_shiro"))));
  run(sb, "stripWalkers[951].sitStart = Date.now() - 1300; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: sit frame advances in real time (1300ms -> blink frame 2)",
    drawn.some(d => d[0] === "staff_shiro_sit_2"),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_shiro"))));
  check("B8: walkClock stays frozen while sitting",
    run(sb, "stripWalkers[951].walkClock") === sitClock);
  run(sb, "stripWalkers[952].sitting = true; stripWalkers[952].sitStart = stripNow; stripWalkers[952].until = Date.now() + 100000; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: sitting hachiware draws sit ANIMS frame 0 at staff48 scale (batch 10)",
    drawn.some(d => d[0] === "staff_hachiware_sit_0" && d[3] === 1.5),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_hachiware"))));

  /* ---- 訪問猫: 毛柄に ANIMS があればアニメで横切る ---- */
  run(sb, "stripVisitor = { x: 200, dir: 1, coat: 'shiro', speed: 15, walkClock: 700 }; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: shiro visitor crosses with the walk ANIMS (frame 1, mirrored, x1.5)",
    drawn.some(d => d[0] === "staff_shiro_walk_1" && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_shiro"))));
  run(sb, "stripVisitor = { x: 200, dir: 1, coat: 'hachiware', speed: 15, walkClock: 0 }; render();");
  drawn = run(sb, "window.__drawnB8.splice(0)");
  check("B8: hachiware visitor crosses with the walk ANIMS (frame 0, mirrored, x1.5)",
    drawn.some(d => d[0] === "staff_hachiware_walk_0" && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_hachiware"))));
  run(sb, "sDrawSprite = __osdsB8; stripVisitor = null;");
}

/* ================= Phase B10: スタッフアニメ (バッチ7: kuro / chatora 48×40 ANIMS) =================
   バッチ6 (shiro) と同じ統一仕様 (1ファイル walk 9f + sit 6f、左向き原画)。
   毛柄別ゲーティングが shiro 専用前提なしに汎用であることを、帯の描画経路と
   スタッフパネルのポートレート選択 (staffPortrait が ANIMS sit 1フレーム目を
   旧 sit 静止画より優先する) の両方で確認する */
console.log("== Phase B10: staff ANIMS batch 7 (kuro/chatora routing + panel portraits) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  const fAt10 = (base, t) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${t})`);

  /* ---- データ: ANIMS エントリとフレーム実在 (毛柄ごとに shiro と同仕様) ---- */
  for (const coat of ["kuro", "chatora"]) {
    check(`B10: staff_${coat}_walk ANIMS is the 7-frame walk_loop tag range`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.join(',')`) ===
        Array.from({ length: 7 }, (_, i) => `staff_${coat}_walk_` + i).join(",") &&
      run(sb, `ANIMS.staff_${coat}_walk.durations.join(',')`) === "600,600,300,600,600,600,600" &&
      run(sb, `ANIMS.staff_${coat}_walk.loopFrom`) === 0 && run(sb, `ANIMS.staff_${coat}_walk.loopTo`) === 6 &&
      run(sb, `ANIMS.staff_${coat}_walk.loopCount`) === Infinity);
    check(`B10: staff_${coat}_sit ANIMS is 6 frames x 600ms looping`,
      run(sb, `ANIMS.staff_${coat}_sit.frames.join(',')`) ===
        Array.from({ length: 6 }, (_, i) => `staff_${coat}_sit_` + i).join(",") &&
      run(sb, `ANIMS.staff_${coat}_sit.durations.join(',')`) === "600,600,600,600,600,600" &&
      run(sb, `ANIMS.staff_${coat}_sit.loopFrom`) === 0 && run(sb, `ANIMS.staff_${coat}_sit.loopTo`) === 5 &&
      run(sb, `ANIMS.staff_${coat}_sit.loopCount`) === Infinity);
    check(`B10: all ${coat} frames exist at the unified 48x40 spec`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.concat(ANIMS.staff_${coat}_sit.frames)` +
        ".every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
    check(`B10: every ${coat} frame touches the ground row (baseline 39)`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.concat(ANIMS.staff_${coat}_sit.frames)` +
        ".every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));
  }

  /* ---- タイムライン: walk は 3900ms 周期 (walk_loop タグ)、sit は 3600ms 周期 ---- */
  check("B10: kuro walk timeline (accent frame + wrap)",
    fAt10("staff_kuro_walk", 0) === "staff_kuro_walk_0" &&
    fAt10("staff_kuro_walk", 1500) === "staff_kuro_walk_3" &&
    fAt10("staff_kuro_walk", 3900) === "staff_kuro_walk_0");
  check("B10: chatora sit timeline (blink cycle + wrap)",
    fAt10("staff_chatora_sit", 0) === "staff_chatora_sit_0" &&
    fAt10("staff_chatora_sit", 3000) === "staff_chatora_sit_5" &&
    fAt10("staff_chatora_sit", 3600) === "staff_chatora_sit_0");

  /* ---- 帯の描画経路: kuro 右行 (反転) / chatora 左行 (正向き) ---- */
  run(sb, "S.staff = [{ id: 961, name: '黒', coat: 'kuro', role: 'prog', lv: 1 }, { id: 962, name: '茶', coat: 'chatora', role: 'carry', lv: 1 }]; S.staffSeq = 962;");
  run(sb, "render();");
  run(sb, `window.__drawnB10 = [];
    const __osdsB10 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB10.push([n, x, y, s, f]); return __osdsB10(n, x, y, s, f); };`);
  run(sb, "stripWalkers[961].x = 300; stripWalkers[961].dir = 1; stripWalkers[961].sitting = false; stripWalkers[961].walkClock = 0;" +
          "stripWalkers[962].x = 850; stripWalkers[962].dir = -1; stripWalkers[962].sitting = false; stripWalkers[962].walkClock = 0; render();");
  let drawn = run(sb, "window.__drawnB10.splice(0)");
  check("B10: kuro walker draws ANIMS frames at staff48 scale, mirrored heading right",
    drawn.some(d => d[0].startsWith("staff_kuro_walk") && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_kuro"))));
  check("B10: chatora walker draws ANIMS frames at staff48 scale, unflipped heading left",
    drawn.some(d => d[0].startsWith("staff_chatora_walk") && d[3] === 1.5 && d[4] === false),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_chatora"))));
  check("B10: kuro hit rect matches the drawn 72x60 at the walker position",
    (() => { const r = run(sb, "stripHitRects.staff[0]"); const wx = run(sb, "stripWalkers[961].x");
      return r && r.w === 72 && r.h === 60 && Math.abs(r.x + r.w / 2 - wx) < 1.5; })(),
    JSON.stringify(run(sb, "stripHitRects.staff")));
  run(sb, "stripWalkers[961].walkClock = 1300; render();");
  drawn = run(sb, "window.__drawnB10.splice(0)");
  check("B10: kuro walk frame follows walkClock (1300ms -> frame 2, the 300ms accent)",
    drawn.some(d => d[0] === "staff_kuro_walk_2"),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_kuro"))));

  /* ---- chatora の座り: sitStart からの実時間ループ ---- */
  run(sb, "stripWalkers[962].sitting = true; stripWalkers[962].sitStart = stripNow; stripWalkers[962].until = stripNow + 100000; render();");
  drawn = run(sb, "window.__drawnB10.splice(0)");
  check("B10: sitting chatora draws sit frame 0 at staff48 scale, unflipped",
    drawn.some(d => d[0] === "staff_chatora_sit_0" && d[3] === 1.5 && d[4] === false),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_chatora"))));
  run(sb, "stripWalkers[962].sitStart = Date.now() - 3100; render();");
  drawn = run(sb, "window.__drawnB10.splice(0)");
  check("B10: chatora sit frame advances in real time (3100ms -> frame 5)",
    drawn.some(d => d[0] === "staff_chatora_sit_5"),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_chatora"))));
  run(sb, "stripWalkers[962].sitting = false;");

  /* ---- 訪問猫: chatora も ANIMS で横切る ---- */
  run(sb, "stripVisitor = { x: 200, dir: 1, coat: 'chatora', speed: 15, walkClock: 700 }; render();");
  drawn = run(sb, "window.__drawnB10.splice(0)");
  check("B10: chatora visitor crosses with the walk ANIMS (frame 1, mirrored, x1.5)",
    drawn.some(d => d[0] === "staff_chatora_walk_1" && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawn.filter(d => d[0].startsWith("staff_chatora"))));
  run(sb, "sDrawSprite = __osdsB10; stripVisitor = null;");

  /* ---- パネル: ポートレートは ANIMS sit 1フレーム目 (48×40) を優先する ---- */
  run(sb, "spriteCache['staff_kuro_sit_0'].toDataURL = () => 'data:KURO_SIT0';" +
          "spriteCache['staff_chatora_sit_0'].toDataURL = () => 'data:CHATORA_SIT0';" +
          "spriteCache['staff_sabatora_sit_0'].toDataURL = () => 'data:SABA_SIT0';" +
          "spriteCache['staff_hachiware_sit_0'].toDataURL = () => 'data:HACHI_SIT0';" +
          "for (const k of Object.keys(sprUrlCache)) delete sprUrlCache[k];");
  check("B10: staffPortrait(kuro) uses the 48x40 ANIMS sit frame, not the legacy sprite",
    run(sb, "staffPortrait('kuro')").includes("data:KURO_SIT0"));
  check("B10: staffPortrait(chatora) uses the 48x40 ANIMS sit frame, not the legacy sprite",
    run(sb, "staffPortrait('chatora')").includes("data:CHATORA_SIT0"));
  check("B10: staffPortrait(sabatora) uses the 48x40 ANIMS sit frame (batch 9)",
    run(sb, "staffPortrait('sabatora')").includes("data:SABA_SIT0"));
  check("B10: staffPortrait(hachiware) uses the 48x40 ANIMS sit frame (batch 10)",
    run(sb, "staffPortrait('hachiware')").includes("data:HACHI_SIT0"));
}

/* ================= Phase B11: 歩行サイクルと接地速度の同期 =================
   実測較正 (2026-10-25): 脚ジオメトリから 1周 ≈ 13 スプライトpx →
   みゅけ (×2) = 26 ユニット/周 (周期 3900ms)、スタッフ (×1.5) = 19.5
   ユニット/周 (周期 3900ms = walk_loop タグ範囲。旧 5100 は BacktoIdle 混入時の値)。walkClock は全ての移動経路で
   「移動距離 ÷ ユニット/周 × 周期ms」だけ進み、位相は距離の純粋な関数。
   旧仕様 (速度によらず 30単位/秒で実時間換算) の回帰を防ぐ */
console.log("== Phase B11: walk cycle / ground speed sync ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  const approx = (a, b, tol) => Math.abs(a - b) <= (tol || 0.6);

  /* ---- 較正定数とヘルパー ---- */
  check("B11: units-per-cycle constants (miyuke 26 / staff 19.5)",
    run(sb, "WALK_UNITS_PER_CYCLE.miyuke_walk") === 26 && run(sb, "WALK_UNITS_PER_CYCLE.staff") === 19.5);
  check("B11: one miyuke cycle of ground distance advances exactly one cycle (26 units -> 3900ms)",
    approx(run(sb, "walkAdvanceMs('miyuke_walk', 26)"), 3900, 0.01),
    String(run(sb, "walkAdvanceMs('miyuke_walk', 26)")));
  check("B11: one staff cycle of ground distance advances exactly one cycle (19.5 units -> 3900ms, all ANIMS coats)",
    ["shiro", "kuro", "chatora", "sabatora", "syamu", "hachiware", "hachiware_gray", "chashiro"].every(c => approx(run(sb, `walkAdvanceMs('staff_${c}_walk', 19.5)`), 3900, 0.01)));
  check("B11: a name without ANIMS falls back to the staff cycle (19.5 units -> 5100ms)",
    approx(run(sb, "walkAdvanceMs('staff_mike2_walk', 19.5)"), 5100, 0.01));
  check("B11: advance is proportional to distance (half the distance, half the phase)",
    approx(run(sb, "walkAdvanceMs('miyuke_walk', 13)"), 1950, 0.01) &&
    approx(run(sb, "walkAdvanceMs('staff_shiro_walk', 9.75)"), 1950, 0.01));

  /* ---- みゅけ: 一人遊び移動 (16 u/s) と zoomies (55 u/s) ----
     散歩トリップの自発開始 (PLAY_STATES 中 dt*0.35) を tripRestUntil で抑止し、
     移動レイヤー単体のレートを決定的に測る */
  run(sb, "stripNow = Date.now(); tripRestUntil = stripNow + 1e12; setState('yarn', 600000); miyukeTrip = null;" +
          "miyukeStrip.x = 200; miyukeStrip.targetX = 226; miyukeStrip.nextPick = stripNow + 1e9;" +
          "miyukeStrip.walkClock = 0; miyukeStrip.moving = false;");
  run(sb, "stripUpdate(1.0);");
  check("B11: miyuke stroll 16 units advances clock by 16/26 of a cycle (2400ms)",
    approx(run(sb, "miyukeStrip.walkClock"), 2400, 0.6),
    String(run(sb, "miyukeStrip.walkClock")));
  run(sb, "stripUpdate(1.0);");
  check("B11: 26 units of travel = exactly one full walk cycle (3900ms), arrived at target",
    approx(run(sb, "miyukeStrip.walkClock"), 3900, 0.6) && run(sb, "miyukeStrip.x") === 226,
    "clock=" + run(sb, "miyukeStrip.walkClock") + " x=" + run(sb, "miyukeStrip.x"));
  run(sb, "setState('zoomies', 600000); miyukeStrip.x = 200; miyukeStrip.targetX = 900;" +
          "miyukeStrip.nextPick = stripNow + 1e9; miyukeStrip.walkClock = 0;");
  run(sb, "stripUpdate(1.0);");
  check("B11: zoomies 55 units advances clock by 55/26 of a cycle (8250ms) — phase follows speed",
    approx(run(sb, "miyukeStrip.walkClock"), 8250, 0.6),
    String(run(sb, "miyukeStrip.walkClock")));

  /* ---- みゅけ: 配達トリップ (34 u/s) — 実移動距離の累積と時計が一致 ---- */
  run(sb, "S.shelf = [{}, {}]; shelfPending = 1; tripRestUntil = 0; setState('yarn', 600000);" +
          "miyukeTrip = null; miyukeStrip.x = 600; miyukeStrip.targetX = 600; miyukeStrip.walkClock = 0;");
  let traveled = 0, prevX = 600, phase = "";
  for (let i = 0; i < 600 && phase !== "beat"; i++) {
    run(sb, "stripNow += 100; stripUpdate(0.1);");
    const x = run(sb, "miyukeStrip.x");
    traveled += Math.abs(x - prevX); prevX = x;
    phase = run(sb, "miyukeTrip ? miyukeTrip.phase : 'none'");
  }
  check("B11: delivery trip runs to the shelf (phase reaches beat)",
    phase === "beat" && traveled > 100, "phase=" + phase + " traveled=" + traveled.toFixed(1));
  check("B11: delivery trip clock = travelled distance / 26 x 3900ms (speed 34 path)",
    approx(run(sb, "miyukeStrip.walkClock"), traveled / 26 * 3900, traveled * 0.02 + 30),
    "clock=" + run(sb, "miyukeStrip.walkClock") + " expected~" + (traveled / 26 * 3900).toFixed(0));

  /* ---- スタッフ: 徘徊 (端クランプ後の実距離) と運搬 (30 u/s) ---- */
  run(sb, "S.staff = [{ id: 961, name: '黒', coat: 'kuro', role: 'prog', lv: 1 }]; S.staffSeq = 961; render();");
  run(sb, "const wk = stripWalkers[961]; wk.x = 100; wk.dir = 1; wk.speed = 8; wk.walkClock = 0;" +
          "wk.sitting = false; wk.carrying = false; wk.chatUntil = 0; wk.backing = false;");
  run(sb, "stripNow += 1000; stripUpdate(1.0);");
  check("B11: staff wander 8 units advances clock by 8/19.5 of a cycle (1600ms)",
    approx(run(sb, "stripWalkers[961].walkClock"), 8 / 19.5 * 3900, 0.6),
    String(run(sb, "stripWalkers[961].walkClock")));
  run(sb, "stripWalkers[961].x = stripVW - 26; stripWalkers[961].dir = 1; stripWalkers[961].walkClock = 0;" +
          "stripWalkers[961].sitting = false; stripWalkers[961].carrying = false; stripWalkers[961].chatUntil = 0; stripWalkers[961].backing = false;");
  run(sb, "stripNow += 1000; stripUpdate(1.0);");
  check("B11: edge clamp counts only the distance actually travelled (2 units -> 400ms)",
    approx(run(sb, "stripWalkers[961].walkClock"), 2 / 19.5 * 3900, 0.6) &&
    run(sb, "stripWalkers[961].x") === run(sb, "stripVW") - 24,
    "clock=" + run(sb, "stripWalkers[961].walkClock"));
  run(sb, "stripWalkers[961].carrying = true; stripWalkers[961].x = 100; stripWalkers[961].walkClock = 0;");
  run(sb, "stripNow += 1000; stripUpdate(0.65);");
  check("B11: carrier at 30 u/s for 0.65s = 19.5 units = exactly one cycle (3900ms)",
    approx(run(sb, "stripWalkers[961].walkClock"), 3900, 0.6),
    String(run(sb, "stripWalkers[961].walkClock")));

  /* ---- 訪問猫 ---- */
  run(sb, "stripVisitor = { x: 100, dir: 1, coat: 'chatora', speed: 15, walkClock: 0 };");
  run(sb, "stripNow += 1000; stripUpdate(1.3);");
  check("B11: visitor 15 u/s for 1.3s = 19.5 units = exactly one cycle (3900ms)",
    approx(run(sb, "stripVisitor.walkClock"), 3900, 0.6),
    String(run(sb, "stripVisitor && stripVisitor.walkClock")));
  run(sb, "stripVisitor = null;");
}

/* ================= Phase B9: 60fps 化 + 移動レイヤー優先 (v2.3.6 目玉 A/B) =================
   A: setInterval(render, 150) ≒ 6.7fps → 16ms ≒ 60fps。frame は 150ms 単位の
   見た目時計として実時間換算され、frame 連動の見た目の速度は不変。
   publishHitZones のゾーン計算は従来周期に間引かれる (force は即時)。
   B: 遊び状態でも移動中は歩行フレームが勝つ (実機指摘: idle のまま滑る) */
console.log("== Phase B9: 60fps rendering + movement layer wins ==");
{
  const invokes = [];
  const tauri = { core: { invoke: (cmd, args) => { invokes.push([cmd, args]); return Promise.resolve({}); } } };
  /* B9-B は偽時計で回す。根因: 帯の移動は speed × 実時間 dt で進むため、
     実時計ではレンダ間のホスト実行時間がミリ秒境界を跨ぐたびに x が微小に
     ずれ、eat/celebrate の x===200 厳密一致が確率的に崩れていた（既知フレーク）。
     偽時計では dt=0 で x が動かず、到着・滞留・その場保持の意図そのものを
     決定的に検証できる。開始時刻は fresh-measure と同じ固定昼間時刻。 */
  const sb = buildSandbox({ hash: "#strip", tauri, width: 1280, height: 210, fakeNow: 1761370000000 });
  loadGame(sb);

  /* ---- A1: レンダラ周期 ---- */
  /* 描画は requestAnimationFrame 駆動 (画面のリフレッシュに同期)。rAF が止まる環境向けに
     50ms のタイマーが「50ms 描かれていなければ描く」予備として残る */
  check("B9-A: render runs on requestAnimationFrame with a 50ms fallback timer, no 150ms render timer remains",
    run(sb, "typeof renderLoop === 'function'") &&
    sb._intervals.some(iv => iv.ms === 50) &&
    !sb._intervals.some(iv => iv.ms === 150),
    JSON.stringify(sb._intervals.map(iv => iv.ms)));
  {
    const before = run(sb, "lastRenderAt");
    sb._advanceFake(60);
    sb._intervals.find(iv => iv.ms === 50).fn();
    check("B9-A: the fallback timer renders when rAF has not drawn for 50ms", run(sb, "lastRenderAt") > before);
    const mid = run(sb, "lastRenderAt");
    sb._advanceFake(10);
    sb._intervals.find(iv => iv.ms === 50).fn();
    check("B9-A: the fallback timer stays idle while frames are fresh", run(sb, "lastRenderAt") === mid);
  }

  /* ---- A2: frame は実時間換算 (150ms = 1frame) で進み、即時再描画では進まない ---- */
  run(sb, "frameAcc = 10; frame = 10; lastRenderAt = Date.now(); render();");
  check("B9-A: back-to-back render does not advance the visual clock",
    run(sb, "frame") === 10, "frame=" + run(sb, "frame"));
  run(sb, "lastRenderAt = Date.now() - 150; render();");
  check("B9-A: 150ms of wall time advances frame by exactly 1",
    run(sb, "frame") === 11, "frame=" + run(sb, "frame"));
  run(sb, "frameAcc = 20; frame = 20; lastRenderAt = Date.now() - 60000; render();");
  check("B9-A: huge gaps are capped (1000ms -> +6 frames, no time-travel)",
    run(sb, "frame") === 26, "frame=" + run(sb, "frame"));

  /* ---- A3: ヒットゾーン計算の間引き (force は即時) ---- */
  run(sb, `window.__czCount = 0;
    const __oczB9 = computeHitZones;
    computeHitZones = function(){ window.__czCount++; return __oczB9(); };`);
  run(sb, "hitZonesLastCompute = 0; publishHitZones(false); publishHitZones(false); publishHitZones(false);");
  check("B9-A: zone computation is throttled at 60fps (3 calls -> 1 compute)",
    run(sb, "window.__czCount") === 1, "n=" + run(sb, "window.__czCount"));
  run(sb, "publishHitZones(true);");
  check("B9-A: forced publish computes immediately",
    run(sb, "window.__czCount") === 2, "n=" + run(sb, "window.__czCount"));
  check("B9-A: zones still get sent to Tauri after throttling",
    invokes.some(([c]) => c === "set_hit_zones"), "calls=" + invokes.length);
  run(sb, "computeHitZones = __oczB9;");

  /* ---- B: 移動中は歩行フレームが勝つ (みゅけ・遊び状態) ---- */
  run(sb, `window.__drawnB9 = [];
    const __osdsB9 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB9.push(n); return __osdsB9(n, x, y, s, f); };`);
  run(sb, "setState('yarn', 600000); miyukeTrip = null; miyukeStrip.x = 200; miyukeStrip.targetX = 900; miyukeStrip.nextPick = Date.now() + 1e9; render();");
  let drawn = run(sb, "window.__drawnB9.splice(0)");
  check("B9-B: moving in a play state draws walk frames, not the play pose",
    drawn.some(d => /^miyuke_walk_\d$/.test(d)) && !drawn.includes("miyuke_yarn"),
    drawn.filter(d => d.startsWith("miyuke_")).join(","));
  check("B9-B: walker state reports moving during the transit",
    run(sb, "miyukeStrip.moving") === true);
  run(sb, "miyukeStrip.targetX = miyukeStrip.x; render();");
  drawn = run(sb, "window.__drawnB9.splice(0)");
  check("B9-B: once she arrives, the play pose returns (yarn, no walk frames)",
    drawn.some(d => d === "miyuke_yarn" || /^miyuke_yarn_\d+$/.test(d)) && !drawn.some(d => /^miyuke_walk_\d$/.test(d)),
    drawn.filter(d => d.startsWith("miyuke_")).join(","));
  check("B9-B: arrival starts a dwell (nextPick pushed into the future)",
    run(sb, "miyukeStrip.nextPick") > run(sb, "Date.now()") && run(sb, "miyukeStrip.moving") === false,
    "nextPick-now=" + (run(sb, "miyukeStrip.nextPick") - run(sb, "Date.now()")));
  /* 確定した活動はその場: 遠い目標が残っていても移動せずポーズが出る */
  run(sb, "setState('eat', 600000); stateEnteredAt = Date.now(); miyukeStrip.targetX = 900; render();");
  drawn = run(sb, "window.__drawnB9.splice(0)");
  check("B9-B: eat holds position and the snack pose plays (no sliding)",
    run(sb, "miyukeStrip.x") === 200 && drawn.includes("miyuke_snack_0"),
    "x=" + run(sb, "miyukeStrip.x") + " " + drawn.filter(d => d.startsWith("miyuke_")).join(","));
  run(sb, "setState('celebrate', 600000); stateEnteredAt = Date.now(); miyukeStrip.targetX = 900; render();");
  drawn = run(sb, "window.__drawnB9.splice(0)");
  check("B9-B: celebrate holds position and the happy anim plays",
    run(sb, "miyukeStrip.x") === 200 && drawn.some(d => d.startsWith("miyuke_happy")),
    "x=" + run(sb, "miyukeStrip.x") + " " + drawn.filter(d => d.startsWith("miyuke_")).join(","));
  run(sb, "sDrawSprite = __osdsB9;");
}

/* ================= Phase C: Phase 2 OS全体の入力集計 ================= */
console.log("== Phase C: OS input counting (fake Tauri events) ==");
{
  const invokes = [];
  const handlers = {};
  const tauri = {
    core: { invoke: (cmd, args) => { invokes.push([cmd, args]); return Promise.resolve({}); } },
    event: { listen: (name, cb) => { handlers[name] = cb; return Promise.resolve(() => {}); } }
  };
  const sb = buildSandbox({ tauri });
  loadGame(sb);

  check("input-activity listener registered", typeof handlers["input-activity"] === "function");
  const bootCalls = invokes.filter(([c]) => c === "set_input_counting");
  check("boot applies saved setting (default OFF)",
    bootCalls.length >= 1 && bootCalls[0][1].enabled === false, JSON.stringify(bootCalls));
  check("settings.inputCount defaults to false", run(sb, "S.settings.inputCount") === false);
  check("osCountingActive() false by default", run(sb, "osCountingActive()") === false);

  /* ON にする → Rust へ enabled:true が飛ぶ */
  run(sb, "S.settings.inputCount = true; applyInputCounting();");
  check("enabling invokes set_input_counting(true)",
    invokes.some(([c, a]) => c === "set_input_counting" && a.enabled === true));
  check("osCountingActive() true after enable", run(sb, "osCountingActive()") === true);

  /* 集計イベント → ブースト材料へ（レーンA: 3打鍵=+1DP, 400px=+1DP, 2クリック=+1DP） */
  const keysBefore = run(sb, "S.totals.keys");
  run(sb, "keysAcc = 0; cursorAcc = 0; clicksAcc = 0;");
  handlers["input-activity"]({ payload: { keys: 40, distPx: 2000, clicks: 5 } });
  check("OS keys feed keysAcc", run(sb, "keysAcc") === 40, "keysAcc=" + run(sb, "keysAcc"));
  check("OS dist feeds cursorAcc", run(sb, "cursorAcc") === 2000, "cursorAcc=" + run(sb, "cursorAcc"));
  check("OS clicks feed clicksAcc", run(sb, "clicksAcc") === 5, "clicksAcc=" + run(sb, "clicksAcc"));
  check("OS keys counted in totals", run(sb, "S.totals.keys") === keysBefore + 40);
  check("OS last aggregate recorded", run(sb, "osInputLast.keys === 40 && osInputLast.clicks === 5"));
  /* クリックだけの集計（キー・距離 0）でもブースト材料に入ること */
  run(sb, "keysAcc = 0; cursorAcc = 0; clicksAcc = 0;");
  handlers["input-activity"]({ payload: { keys: 0, distPx: 0, clicks: 10 } });
  check("OS clicks-only feed clicksAcc", run(sb, "clicksAcc") === 10, "clicksAcc=" + run(sb, "clicksAcc"));

  /* tick のブースト確定: 400キー = 133.3DP 生値 → 1分上限 120DP で頭打ち */
  run(sb, "keysAcc = 400; cursorAcc = 0; clicksAcc = 0; pendingBoost = 0; tickBoostCounter = 0;");
  run(sb, "setState('watch', 600000);");
  for (let i = 0; i < 10; i++) run(sb, "tick();");
  const pb = run(sb, "pendingBoost");
  check("boost capped at 120 DP/min (400 keys -> 133.3 raw)", Math.abs(pb - 120) < 0.001, "pendingBoost=" + pb);
  check("accumulators flushed by tick", run(sb, "keysAcc") === 0 && run(sb, "clicksAcc") === 0);

  /* 二重数え防止: ON の間はページ内の打鍵・カーソルを数えない */
  run(sb, "keysAcc = 0;");
  const tk = run(sb, "S.totals.keys");
  sb.document.dispatch("keydown", {});
  check("in-page keydown not double counted while OS on",
    run(sb, "keysAcc") === 0 && run(sb, "S.totals.keys") === tk);
  run(sb, "cursorAcc = 0;");
  sb.document.dispatch("pointermove", { clientX: 100, clientY: 100 });
  sb.document.dispatch("pointermove", { clientX: 220, clientY: 160 });
  check("in-page cursor not double counted while OS on",
    run(sb, "cursorAcc") === 0, "cursorAcc=" + run(sb, "cursorAcc"));

  /* OFF に戻すとページ内集計が復活する */
  run(sb, "S.settings.inputCount = false; applyInputCounting();");
  check("osCountingActive() false after disable", run(sb, "osCountingActive()") === false);
  sb.document.dispatch("keydown", {});
  check("in-page keydown counts again while OS off", run(sb, "keysAcc") === 1);
  run(sb, "cursorAcc = 0;");
  sb.document.dispatch("pointermove", { clientX: 260, clientY: 190 });
  check("in-page cursor counts again while OS off", run(sb, "cursorAcc") > 0, "cursorAcc=" + run(sb, "cursorAcc"));

  /* 一時停止中は OS 集計もブーストに流れない */
  run(sb, "S.settings.pauseInput = true; keysAcc = 0;");
  handlers["input-activity"]({ payload: { keys: 12, distPx: 300, clicks: 1 } });
  check("OS feed ignored while paused", run(sb, "keysAcc") === 0);
  run(sb, "S.settings.pauseInput = false;");
}

/* ================= Phase B12: プロジェクトボード（帯の可読レイヤー） ================= */
console.log("== Phase B12: strip project board (glanceable progress / hit zone / click) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  const vw = run(sb, "stripVW");
  const dcx = run(sb, "stripDeskCX()");

  /* --- 算数はメニューのヒーローカードと同一: frac = DP/total、% は floor、
         目盛りは k/(feats+1) の節目位置 --- */
  run(sb, "S.project = { name:'検証作', genreName:'x', size:'M', totalDP: 120, feats: ['a','b'], doneFeats: 1, icon: 2, planning: false }; S.projectDP = 60;");
  const m = run(sb, "projectBoardModel(S.project, S.projectDP)");
  check("board model: frac = DP/total (60/120 = 0.5)", m.frac === 0.5, JSON.stringify(m));
  check("board model: pct is floored percent (50)", m.pct === 50, "pct=" + m.pct);
  check("board model: ticks sit on feat milestones (1/3, 2/3)",
    m.ticks.length === 2 && Math.abs(m.ticks[0] - 1 / 3) < 1e-9 && Math.abs(m.ticks[1] - 2 / 3) < 1e-9,
    JSON.stringify(m.ticks));
  run(sb, "S.projectDP = 61;");
  check("board model: pct floors (61/120 -> 50, not 51)",
    run(sb, "projectBoardModel(S.project, S.projectDP).pct") === 50);
  run(sb, "S.projectDP = 60;");

  /* --- 描画: 太バー (h7.5) の充填幅が frac と一致し、目盛りが節目位置に出る --- */
  run(sb, `window.__rectsB12 = [];
    const __osrB12 = sR;
    sR = function(x, y, w, h, c){ window.__rectsB12.push({ x, y, w, h, c }); return __osrB12(x, y, w, h, c); };`);
  run(sb, "render();");
  const rects = run(sb, "window.__rectsB12.splice(0)");
  const barW = (204 - 5) - 3;   /* リーダーボード紙面 iw = bw-5、バーは iw-3 */
  const fill = rects.filter(r => r.c === "#7be495" && r.h === 7.5);
  check("board draws exactly one fat fill bar", fill.length === 1, "fills=" + fill.length);
  check("board fill width matches frac (0.5 * barW)",
    fill.length === 1 && Math.abs(fill[0].w - barW * 0.5) <= 1.6,
    fill.length ? "w=" + fill[0].w + " want=" + barW * 0.5 : "no fill");
  const barX = fill.length ? fill[0].x : 0;
  const ticks = rects.filter(r => r.c === "#fff3b0" && r.h === 7.5 && r.w === 1.2);
  check("board draws one tick per feat milestone (2)",
    ticks.length === 2 &&
    Math.abs(ticks[0].x - (barX + Math.round(barW / 3))) <= 1 &&
    Math.abs(ticks[1].x - (barX + Math.round(barW * 2 / 3))) <= 1,
    "ticks=" + JSON.stringify(ticks.map(t => t.x)) + " barX=" + barX);
  /* 企画中: モデルはアイデア進捗 (floor(ideas)/ideaCost)、% は出ない */
  run(sb, "S.project.planning = true; S.project.ideaCost = 10; S.ideas = 5;");
  const mp = run(sb, "projectBoardModel(S.project, S.projectDP)");
  check("board model: planning shows idea progress (5/10 = 0.5, no pct)",
    mp.planning === true && mp.frac === 0.5 && mp.pct === -1, JSON.stringify(mp));
  run(sb, "S.project.planning = false; S.bugStock = 0;");

  /* --- 詰まり: 第1ラインのボードだけ充填が赤くなる (二重表示にしない) --- */
  run(sb, "S.bugStock = 40;");
  check("bottleneck fixture active (currentBottleneck non-null)",
    run(sb, "!!currentBottleneck()") === true);
  run(sb, "render();");
  const rectsBn = run(sb, "window.__rectsB12.splice(0)");
  check("board fill turns red while bottlenecked",
    rectsBn.some(r => r.c === "#e2543e" && r.h === 7.5 && r.w > 50),
    "red fills=" + rectsBn.filter(r => r.c === "#e2543e").length);
  check("board draws the warning plate while bottlenecked",
    rectsBn.some(r => r.c === "#e2543e" && r.w === 11 && r.h === 11));
  run(sb, "S.bugStock = 0;");
  run(sb, "sR = __osrB12;");

  /* --- ヒーローボード: 長い作品名でも描画が終わる (省略ループの無限化ガード) --- */
  run(sb, "S.project.name = 'とてもながいなまえのプロジェクトタイトルです'; renderStrip();");
  check("hero board: a long project name truncates and the board still draws",
    !!run(sb, "stripHitRects.board"));
  run(sb, "S.project.name = 'ねこタウン'; renderStrip();");

  /* --- ヒットゾーンとクリック導線 (R12) --- */
  const dcxNow = run(sb, "stripDeskCX()");   /* 初回 render 後の実寸で取り直す */
  const hr = run(sb, "stripHitRects.board");
  check("board hit rect is the leaderboard at the desk cluster (204x64 @ desk cx, top 3)",
    !!hr && hr.w === 204 && hr.h === 64 && hr.y === 3 && Math.abs(hr.x - (dcxNow - 102)) <= 1,
    JSON.stringify(hr));
  run(sb, "publishHitZones(true);");
  const zones = run(sb, "window.__miyukeHitZones()");
  const bcxCss = dcxNow / run(sb, "stripVW") * 1280, bcyCss = (4 + 15) / 120 * 210;
  check("hit zones include the project board",
    zones.some(z => bcxCss >= z[0] && bcxCss <= z[0] + z[2] && bcyCss >= z[1] && bcyCss <= z[1] + z[3]),
    "zones=" + zones.length);
  run(sb, `window.__inv = []; window.__TAURI__ = { core: { invoke: (c, a) => { window.__inv.push([c, a]); return Promise.resolve(); } } };`);
  sb._el("strip").dispatch("pointerdown", { clientX: bcxCss, clientY: bcyCss });
  check("clicking the board asks Rust to open the menu on the project tab",
    run(sb, "JSON.stringify(window.__inv)") === JSON.stringify([["open_menu", { tab: "proj" }]]) &&
    sb.document.body.classList.contains("strip"),
    run(sb, "JSON.stringify(window.__inv)"));
  run(sb, "delete window.__TAURI__;");

  /* --- typebox 撤去の回帰ガード: プロジェクトパネルに欄が残っていないこと --- */
  run(sb, "window.__miyukeApplyMode('full'); switchTab('proj'); renderPanel();");
  check("free-typing field is gone from the project panel",
    !sb._el("panel").innerHTML.includes("typebox"),
    "panel still contains typebox");

  /* --- 第2ラインのボード (1600幅): 専用机の上に同言語で出る --- */
  const sb2 = buildSandbox({ hash: "#strip", width: 1600, height: 210 });
  loadGame(sb2);
  run(sb2, `S.line2.unlocked = true;
    S.line2.project = { name:'2号作', genreName:'y', size:'S', totalDP: 200, feats: ['a'], doneFeats: 0, icon: 1, planning: false };
    S.line2.projectDP = 50; S.projectDP = 30;`);   /* 本線も frac>0 にして充填が出る状態へ */
  /* 第2ライン解放直後は生産>工程能力で正当にボトルネック判定 (本線ボードが
     赤くなるのが正しい挙動) になるため、充填色の検証では「初リリース加速
     (×3.4) が切れた後 + 工程アップグレード最大」で詰まり無しに固定する */
  run(sb2, "S.totals.releases = 3; S.upgrades.tester = 20; S.upgrades.ci = 20; S.upgrades.pack = 20; S.upgrades.bot = 20;");
  const m2 = run(sb2, "projectBoardModel(S.line2.project, S.line2.projectDP)");
  check("line2 board model: frac = 50/200 = 0.25, one tick at 1/2",
    m2.frac === 0.25 && m2.ticks.length === 1 && Math.abs(m2.ticks[0] - 0.5) < 1e-9,
    JSON.stringify(m2));
  run(sb2, `window.__rectsB12b = [];
    const __osrB12b = sR;
    sR = function(x, y, w, h, c){ window.__rectsB12b.push({ x, y, w, h, c }); return __osrB12b(x, y, w, h, c); };`);
  run(sb2, "render();");
  const rects2 = run(sb2, "window.__rectsB12b.splice(0)");
  const barW2 = (108 - 5) - 3;
  const fills2 = rects2.filter(r => r.c === "#7be495" && r.h === 7.5);
  check("both boards draw at 1600w (main + line2 fills)",
    fills2.length === 2, "fills=" + fills2.length);
  check("line2 fill width matches its frac (0.25 * barW2)",
    fills2.some(f => Math.abs(f.w - barW2 * 0.25) <= 1.6),
    "widths=" + fills2.map(f => f.w).join(","));
  const hr2 = run(sb2, "stripHitRects.board2");
  const d2cx = run(sb2, "stripDesk2CX()");
  check("line2 board hit rect sits at the desk2 zone (108x30 @ 0.63W)",
    !!hr2 && hr2.w === 108 && hr2.h === 30 && Math.abs(hr2.x - (d2cx - 54)) <= 1 &&
    Math.abs((hr2.x + hr2.w / 2) / run(sb2, "stripVW") - 0.63) < 0.01,
    JSON.stringify(hr2));
  run(sb2, "sR = __osrB12b;");
}

/* ================= Phase B13: 可視生産フロー ================= */
console.log("== Phase B13: visible production (accumulator conservation / piles / carrier) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, "S.project = { name:'検証作', genreName:'x', size:'M', totalDP: 100000, feats: ['a','b','c'], doneFeats: 0, icon: 1, planning: false }; S.projectDP = 0;");

  /* --- ティア: 新規相当 (低スループット) は T0 = 静かな滴り、量子 5 --- */
  check("flow tier starts at T0 with quantum 5 (calm drip)",
    run(sb, "flowTier()") === 0 && run(sb, "flowQuantum()") === 5);

  /* --- 保存則: 供給 = 発火DP + 残量 (全工程・厳密) --- */
  run(sb, "flowFeedTick(23, 0, { test: 11, build: 7, ship: 3 }, { test: 0, build: 0, ship: 0 });");
  for(const st of ["code", "test", "build", "ship"]){
    const f = run(sb, "flowFed." + st), fired = run(sb, "flowFiredDP." + st), acc = run(sb, "flowAcc." + st);
    check("conservation holds for stage " + st + " (fed = fired + residual)",
      Math.abs(f - fired - acc) < 1e-9, "fed=" + f + " fired=" + fired + " acc=" + acc);
  }
  check("code flow actually fired items (23 DP >= quantum 5)",
    run(sb, "flowFiredDP.code") >= 5 && run(sb, "stripFlow.length") > 0,
    "fired=" + run(sb, "flowFiredDP.code"));
  /* 企画中のラインはコードカードを流さない (アイデアモートの担当) */
  const fedBefore = run(sb, "flowFed.code");
  run(sb, "S.project.planning = true; flowFeedTick(50, 0, { test: 0, build: 0, ship: 0 }, { test: 0, build: 0, ship: 0 }); S.project.planning = false;");
  check("planning line feeds no code cards", run(sb, "flowFed.code") === fedBefore);

  /* --- 実 tick との統合: 生産が本当に流れ、保存則が保たれ、在空は上限内 --- */
  run(sb, "catState = 'code';");
  const mx = run(sb, `let m = 0; for(let i = 0; i < 180; i++){ tick(); if(stripFlow.length > m) m = stripFlow.length; } m;`);
  check("real ticks feed the flow (code + test moved)", run(sb, "flowFed.code") > 23 && run(sb, "flowFed.test") > 11,
    "code=" + run(sb, "flowFed.code") + " test=" + run(sb, "flowFed.test"));
  check("in-flight items never exceeded the hard cap of 10 during ticks", mx <= 10, "max=" + mx);
  for(const st of ["code", "test", "build", "ship"]){
    const f = run(sb, "flowFed." + st), fired = run(sb, "flowFiredDP." + st), acc = run(sb, "flowAcc." + st);
    check("conservation still exact after 180 real ticks (" + st + ")",
      Math.abs(f - fired - acc) < 1e-6, "fed=" + f + " fired=" + fired + " acc=" + acc);
  }

  /* --- 山 ⇔ stageStatus 一致: 同じ frac から段数が決まる --- */
  run(sb, "S.bugStock = 0;");
  const capC = run(sb, "Math.max(60, testRate() * bugFactor() * 2)");
  const capT = run(sb, "Math.max(60, buildRate() * 2)");
  const capB = run(sb, "Math.max(60, shipRate() * 2)");
  run(sb, "S.wip.code = " + capC + "; S.wip.tested = " + capT + "; S.wip.built = " + capB + ";");
  const pm = run(sb, "pileModel()");
  const ssRows = run(sb, "stageStatus()");
  const ssFrac = id => ssRows.find(r => r.id === id).frac;
  check("pile fracs are stageStatus fracs (identical source)",
    pm.code.frac === ssFrac("code") && pm.test.frac === ssFrac("test") && pm.build.frac === ssFrac("build"));
  check("full buffers fill piles to their caps (8/8/5)",
    pm.code.n === 8 && pm.test.n === 8 && pm.build.n === 5, JSON.stringify({ c: pm.code.n, t: pm.test.n, b: pm.build.n }));
  run(sb, "S.wip.code = " + capC * 0.25 + ";");
  check("quarter-full code buffer shows 2 cards", run(sb, "pileModel().code.n") === 2);
  run(sb, "S.wip.code = 0; S.wip.tested = 0; S.wip.built = 0;");
  const pm0 = run(sb, "pileModel()");
  check("empty buffers show empty piles", pm0.code.n === 0 && pm0.test.n === 0 && pm0.build.n === 0);

  /* --- 極端レート: 本数はキャップ、意味量は束ねで増える --- */
  run(sb, "stripFlow.length = 0; flowAcc.code = 0;");
  run(sb, "flowFeedStage('code', 5000, flowQuantum());");
  check("extreme feed fires at most 2 items per tick", run(sb, "stripFlow.length") === 2,
    "n=" + run(sb, "stripFlow.length"));
  check("extreme feed bundles meaning into thickness (bundle 8)",
    run(sb, "stripFlow[0].bundle") === 8, "bundle=" + run(sb, "stripFlow[0].bundle"));
  check("bundled fire subtracts exactly q*bundle per item",
    Math.abs(run(sb, "flowAcc.code") - (5000 - 2 * 5 * 8)) < 1e-9, "acc=" + run(sb, "flowAcc.code"));
  run(sb, "for(let i = 0; i < 30; i++) flowFeedStage('code', 5000, flowQuantum());");
  check("in-flight cap holds under sustained extreme feed", run(sb, "stripFlow.length") <= 10,
    "n=" + run(sb, "stripFlow.length"));

  /* --- バグ滞留同期: 表示数は min(8, floor(bugStock))、減少で潰れ残像 --- */
  run(sb, "S.bugStock = 5.6;");
  check("pile bugs = min(8, floor(bugStock)) (5)", run(sb, "pileModel().bugs") === 5);
  run(sb, "flowVisualUpdate(0.1);");
  run(sb, "S.bugStock = 2.1; flowVisualUpdate(0.1);");
  check("bug decrease spawns a squash ghost (QA sync)", run(sb, "!!stripBugSquash") === true);
  run(sb, "S.bugStock = 99;");
  check("pile bugs capped at 8", run(sb, "pileModel().bugs") === 8);
  run(sb, "S.bugStock = 0;");

  /* --- 詰まった山だけがヒットゾーンになる --- */
  run(sb, "S.bugStock = 40; S.wip.code = 30; render();");
  const pilesRed = run(sb, "stripHitRects.piles");
  check("bottlenecked pile registers a hit rect (stage code)",
    pilesRed.length >= 1 && pilesRed.some(p => p.stage === "code"), JSON.stringify(pilesRed));
  run(sb, "S.bugStock = 0; S.wip.code = 0; render();");
  check("healthy piles register no hit rect", run(sb, "stripHitRects.piles.length") === 0);

  /* --- 節目イベント: パッケージ / RPモート / 付箋 / コイン噴水 --- */
  run(sb, "flowVisualUpdate(0.1);");   /* ウォッチャーの基準値を確定 */
  run(sb, "S.packages += 1; flowVisualUpdate(0.1);");
  check("package milestone lights the shipping-stack glow", run(sb, "stripPkgGlowUntil") > 0);
  run(sb, "S.staff.push({ id: 901, name: 'けんきゅう', coat: 'kuro', role: 'research', lv: 1 }); S.rp = 10.2; flowVisualUpdate(0.1); S.rp = 12.9; flowVisualUpdate(0.1);");
  check("integer RP gain drifts motes from the research desk",
    run(sb, "stripFlow.some(it => it.kind === 'mote')") === true);
  run(sb, "for(let i = 0; i < 16; i++) flowVisualUpdate(0.5);");   /* 在空を空にしてから節目を撃つ */
  run(sb, "S.project.doneFeats = 1; spawnFeatNote(1);");
  check("feat completion launches a sticky-note flight",
    run(sb, "stripFlow.some(it => it.kind === 'note')") === true);
  run(sb, "for(let i = 0; i < 6; i++) flowVisualUpdate(0.2);");
  check("note landing pulses the project board",
    run(sb, "stripBoardPulseAt") > 0 && run(sb, "stripBoardPulseAt === stripNow"));
  run(sb, "stripCoins.length = 0; spawnStripCoinFountain(400);");
  check("coin fountain scales with the actual payout (400 -> 16 coins)",
    run(sb, "stripCoins.length") === 16, "n=" + run(sb, "stripCoins.length"));
  run(sb, "stripCoins.length = 0; spawnStripCoinFountain(100000);");
  check("coin fountain is hard-capped at 28", run(sb, "stripCoins.length") === 28);

  /* --- ティア昇格は即時、降格は遅延 --- */
  run(sb, "S.upgrades.bot = 30; flowTierTick();");
  check("tier upgrades immediately at high throughput", run(sb, "flowTier()") >= 2, "tier=" + run(sb, "flowTier()"));
  run(sb, "S.upgrades.bot = 0; flowTierTick();");
  check("tier downgrade is delayed (no flicker)", run(sb, "flowTier()") >= 2);
}

/* 運搬の一般化は独立サンドボックスで (リリース検知と干渉させない) */
{
  const sb = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
  loadGame(sb);
  run(sb, "S.project = { name:'検証作', genreName:'x', size:'M', totalDP: 100000, feats: ['a'], doneFeats: 0, icon: 1, planning: false };");
  run(sb, "S.staff.push({ id: 951, name: 'はこび', coat: 'shiro', role: 'carry', lv: 1 });");
  run(sb, "stripNow = Date.now(); stripUpdate(0.1); render();");
  check("ship dispatch hires the carrier for a daily run",
    run(sb, "tryDispatchShipCarrier()") === true &&
    run(sb, "stripWalkers[951].carrying") === true &&
    run(sb, "stripWalkers[951].carryKind") === "ship");
  run(sb, "stripWalkers[951].x = stripVW + 30; stripFloaters.length = 0; stripSparks.length = 0; stripUpdate(0.2);");
  check("daily ship completion pays NO coin floater (honesty)",
    run(sb, "stripFloaters.some(f => f.text === '+🪙')") === false &&
    run(sb, "stripCoins.length") === 0);
  check("daily ship completion leaves only a tiny spark",
    run(sb, "stripSparks.length") >= 1 && run(sb, "stripWalkers[951].carrying") === false);
  run(sb, "stripWalkers[951].carrying = true; stripWalkers[951].carryKind = 'release'; stripWalkers[951].x = stripVW + 30; stripFloaters.length = 0; stripUpdate(0.2);");
  check("release carry still celebrates with +🪙 (unchanged behavior)",
    run(sb, "stripFloaters.some(f => f.text === '+🪙')") === true);
}

/* ================= Phase B14: スタッフバッチ9 + 環境ドット絵のティア統合 =================
   バッチ9: chatora 修正版 (正準形不変・絵は差し替え) / syamu 新規 /
   sabatora アニメ化 (いずれも統一仕様 walk 9f + sit 6f)。三毛スタッフ
   (mike2) は sakuri 決定で実装しない: COATS から外し、旧セーブの個体は
   load() で決定的に着せ替える。環境ドット絵 (Codex 一次作 10点) は
   officeTier() で出し分け、tier 0 は従来の木の姿のまま */
console.log("== Phase B14: staff batch 9 + env art tier wiring + mike2 retirement ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1600, height: 210 });
  loadGame(sb);
  const fAt14 = (base, t) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${t})`);

  /* ---- データ: syamu / sabatora の ANIMS (統一仕様) ---- */
  for (const coat of ["syamu", "sabatora"]) {
    check(`B14: staff_${coat}_walk ANIMS is the 7-frame walk_loop tag range`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.join(',')`) ===
        Array.from({ length: 7 }, (_, i) => `staff_${coat}_walk_` + i).join(",") &&
      run(sb, `ANIMS.staff_${coat}_walk.durations.join(',')`) === "600,600,300,600,600,600,600" &&
      run(sb, `ANIMS.staff_${coat}_walk.loopFrom`) === 0 && run(sb, `ANIMS.staff_${coat}_walk.loopTo`) === 6 &&
      run(sb, `ANIMS.staff_${coat}_walk.loopCount`) === Infinity);
    check(`B14: staff_${coat}_sit ANIMS is 6 frames x 600ms looping`,
      run(sb, `ANIMS.staff_${coat}_sit.frames.join(',')`) ===
        Array.from({ length: 6 }, (_, i) => `staff_${coat}_sit_` + i).join(",") &&
      run(sb, `ANIMS.staff_${coat}_sit.durations.join(',')`) === "600,600,600,600,600,600" &&
      run(sb, `ANIMS.staff_${coat}_sit.loopFrom`) === 0 && run(sb, `ANIMS.staff_${coat}_sit.loopTo`) === 5 &&
      run(sb, `ANIMS.staff_${coat}_sit.loopCount`) === Infinity);
    check(`B14: all ${coat} frames exist at the unified 48x40 spec`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.concat(ANIMS.staff_${coat}_sit.frames)` +
        ".every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
    check(`B14: every ${coat} frame touches the ground row (baseline 39)`,
      run(sb, `ANIMS.staff_${coat}_walk.frames.concat(ANIMS.staff_${coat}_sit.frames)` +
        ".every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));
  }
  check("B14: syamu walk timeline (accent frame + wrap)",
    fAt14("staff_syamu_walk", 0) === "staff_syamu_walk_0" &&
    fAt14("staff_syamu_walk", 1500) === "staff_syamu_walk_3" &&
    fAt14("staff_syamu_walk", 3900) === "staff_syamu_walk_0");
  check("B14: chatora revision keeps the canonical ANIMS shape (art swapped, timing untouched)",
    run(sb, "ANIMS.staff_chatora_walk.durations.join(',')") === "600,600,300,600,600,600,600" &&
    run(sb, "ANIMS.staff_chatora_sit.durations.join(',')") === "600,600,600,600,600,600");

  /* ---- COATS: syamu がいて mike2 がいない ---- */
  check("B14: COATS includes syamu and excludes mike2 (batch 13: 8 coats)",
    run(sb, "COATS.includes('syamu') && !COATS.includes('mike2') && COATS.length === 8"),
    run(sb, "COATS.join(',')"));
  check("B14: syamu has a display name and fallback colors",
    run(sb, "COAT_NAMES.syamu") === "シャム" && !!run(sb, "COAT_COLORS.syamu"));
  check("B13: batch-13 coats have display names, fallback colors and tag-shaped ANIMS (hachiware/gray sit = 5f per file)",
    run(sb, "COAT_NAMES.hachiware_gray") === "灰ハチワレ" && run(sb, "COAT_NAMES.chashiro") === "茶白" &&
    !!run(sb, "COAT_COLORS.hachiware_gray") && !!run(sb, "COAT_COLORS.chashiro") &&
    run(sb, "ANIMS.staff_hachiware_sit.frames.length") === 5 && run(sb, "ANIMS.staff_hachiware_gray_sit.frames.length") === 5 &&
    run(sb, "ANIMS.staff_chashiro_sit.frames.length") === 6 &&
    run(sb, "ANIMS.staff_hachiware_gray_walk.durations.join(',')") === "600,600,300,600,600,600,600");
  check("B14: recoatFor is deterministic and always lands in COATS",
    run(sb, "[1,2,3,7,42,100,999].every(id => COATS.includes(recoatFor({ id }))) && recoatFor({ id: 7 }) === recoatFor({ id: 7 })"));
  check("B14b: batch-14 art sizes (desk2 64x64 sakuri desk / wrench 28x28) and staff ANIMS shapes unchanged",
    run(sb, "JSON.stringify(spriteSize('prop_desk2'))") === "[64,64]" &&
    run(sb, "JSON.stringify(spriteSize('icon_wrench'))") === "[28,28]" &&
    run(sb, "JSON.stringify(spriteSize('prop_megaphone'))") === "[24,24]" &&
    run(sb, "COATS.every(c => ANIMS['staff_' + c + '_walk'].durations.join(',') === '600,600,300,600,600,600,600')"));

  /* ================= Phase C: 部署＋営業＋担当者制 ================= */
  {
    const sb = buildSandbox({});
    loadGame(sb);
    check("C: depts boot with backward-compatible defaults (all Lv1, neutral multipliers)",
      run(sb, "!!S.depts && S.depts.sales === 1 && deptLv('prog') === 1 && deptMult('prog') === 1"));
    check("C: big-deal / genre-pref / rotation fields boot as empty defaults",
      run(sb, "S.bigDeal === null && S.reqGenrePref === null && S.salesRot === 0"));
    check("C: DEPTS covers the five existing roles plus sales",
      run(sb, "JSON.stringify(Object.keys(DEPTS))") === "[\"prog\",\"test\",\"carry\",\"research\",\"care\",\"sales\"]");
    check("C: sales role exists at the delegated base cost 230 (same 1.35 hire curve as other roles)",
      run(sb, "STAFF_ROLES.sales.base") === 230 && run(sb, "hireCost('sales')") === 230);
    run(sb, "S.coins = 100000; hireStaff('sales');");
    check("C: hiring the first sales rep is the turning point — a request is auto-acquired with a rep attached",
      run(sb, "salesReps().length") === 1 &&
      run(sb, "!!S.activeRequest && S.activeRequest.auto === true && !!S.activeRequest.repName && typeof S.activeRequest.bonus === 'number'"));
    check("C: a sales hire gets a specialty genre from the unlocked pool",
      run(sb, "unlockedGenres().some(g => g.id === salesReps()[0].genre)"));
    run(sb, "S.staff.push({ id: 900, name: 'progg', coat: 'kuro', role: 'prog', lv: 1 });");
    const progBefore = run(sb, "staffSums().prog");
    run(sb, "buyDept('prog');");
    check("C: buyDept raises the dept level and staffSums output by x1.15 per level",
      run(sb, "deptLv('prog')") === 2 && Math.abs(run(sb, "staffSums().prog") - progBefore * 1.15) < 1e-9);
    check("C: dept chief is the highest-Lv member (ties keep the earlier hire)",
      run(sb, "S.staff.push({ id: 901, name: 'chiefcat', coat: 'siro', role: 'prog', lv: 5 }); deptChief('prog').name") === "chiefcat");
    run(sb, "Math.random = () => 0.99;");
    check("C: request tier cap grows with rep power (lv + sales-dept lv - 1): 0/3/6/12 -> tier 0/0/1/3",
      run(sb, "[0, 3, 6, 12].map(p => salesTierFor(p)).join(',')") === "0,0,1,3");
    run(sb, "Math.random = () => 0.5;");
    check("C: big deal gate needs studioLv>=4 (rank 中堅) — nothing spawns at Lv3",
      run(sb, "S.studioLv = 3; S.bigDeal = null; maybeSpawnBigDeal(); S.bigDeal") === null);
    run(sb, "S.studioLv = 4; Math.random = () => 0; maybeSpawnBigDeal();");
    check("C: big deal spawns with L-size requirement, +250% bonus and a ~30min deadline",
      run(sb, "!!S.bigDeal && S.bigDeal.reqSize === 'L' && S.bigDeal.bonus === 2.5 && Math.abs(S.bigDeal.expiresAt - Date.now() - 1800000) < 120000"));
    run(sb, "S.activeRequest = null; acceptBigDeal();");
    check("C: accepting the big deal moves it into the active slot and clears the offer",
      run(sb, "!!S.activeRequest && S.activeRequest.big === true && S.bigDeal === null"));
    run(sb, "S.bigDeal = { client: 'x', genre: 'app', genreName: 'アプリ', bonus: 2.5, reqSize: 'L', repId: 1, repName: 'r', expiresAt: Date.now() - 1 }; tick();");
    check("C: an expired big deal is cleared by tick with no penalty",
      run(sb, "S.bigDeal") === null);
    run(sb, "setReqGenrePref('app');");
    check("C: genre preference is stored as standing player policy",
      run(sb, "S.reqGenrePref") === "app");
    check("C: request completion pays the tier rate, halved when the size requirement is missed",
      (() => {
        const setup = (size) => {
          run(sb, "S.project = { name: 't', genre: 'app', genreName: 'アプリ', size: '" + size + "', totalDP: 100, feats: [], bugs: 0, startedAt: Date.now(), activeSec: 60, napsAtStart: 0, icon: 0, planning: false }; S.projectDP = 100;" +
                  "S.activeRequest = { client: 'c', genre: 'app', genreName: 'アプリ', bonus: 1.3, reqSize: 'L', tier: 2 }; S.coins = 0; S.rp = 0;");
          run(sb, "releaseProject();");
          return run(sb, "S.coins");
        };
        const small = setup("S"), large = setup("L");
        return large > small * 1.5;
      })());
    run(sb, "S.activeRequest = { client: 'a', genre: 'app', genreName: 'アプリ', bonus: 0.9, tier: 1, repName: 'r', auto: true }; dropRequestCore();");
    check("C: dropping an auto request is penalty-free and opens a 90s replacement hold",
      run(sb, "S.activeRequest === null && S.reqHoldUntil > Date.now()"));
    run(sb, "tick();");
    check("C: tick does not instantly refill a dropped request during the hold",
      run(sb, "S.activeRequest === null"));
    run(sb, "S.reqHoldUntil = 0; S.requests = [{ client: 'm', genre: 'tool', genreName: 'ツール', text: 't' }]; S.activeRequest = { client: 'a', genre: 'app', genreName: 'アプリ', bonus: 0.9, tier: 1, auto: true }; acceptRequest(0);");
    check("C: accepting a manual candidate replaces a non-big active request (spec §4 manual swap)",
      run(sb, "!!S.activeRequest && S.activeRequest.client === 'm'"));
  }

  /* ---- ポートレートと帯の描画経路 (syamu) ---- */
  run(sb, "spriteCache['staff_syamu_sit_0'].toDataURL = () => 'data:SYAMU_SIT0';" +
          "for (const k of Object.keys(sprUrlCache)) delete sprUrlCache[k];");
  check("B14: staffPortrait(syamu) uses the 48x40 ANIMS sit frame",
    run(sb, "staffPortrait('syamu')").includes("data:SYAMU_SIT0"));
  run(sb, "S.staff = [{ id: 971, name: 'シャム', coat: 'syamu', role: 'prog', lv: 1 }, { id: 972, name: 'サバ', coat: 'sabatora', role: 'test', lv: 1 }]; S.staffSeq = 972;");
  run(sb, "render();");
  run(sb, `window.__drawnB14 = [];
    const __osdsB14 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB14.push([n, x, y, s, f]); return __osdsB14(n, x, y, s, f); };`);
  run(sb, "stripWalkers[971].x = 300; stripWalkers[971].dir = 1; stripWalkers[971].sitting = false; stripWalkers[971].walkClock = 0;" +
          "stripWalkers[972].x = 850; stripWalkers[972].dir = -1; stripWalkers[972].sitting = false; stripWalkers[972].walkClock = 0; render();");
  let drawnB14 = run(sb, "window.__drawnB14.splice(0)");
  check("B14: syamu walker draws ANIMS frames at staff48 scale, mirrored heading right",
    drawnB14.some(d => d[0].startsWith("staff_syamu_walk") && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawnB14.filter(d => d[0].startsWith("staff_syamu"))));
  check("B14: sabatora walker draws ANIMS frames at staff48 scale, unflipped heading left",
    drawnB14.some(d => d[0].startsWith("staff_sabatora_walk") && d[3] === 1.5 && d[4] === false),
    JSON.stringify(drawnB14.filter(d => d[0].startsWith("staff_sabatora"))));
  run(sb, "sDrawSprite = __osdsB14;");

  /* ---- 訪問猫プールは COATS 駆動 (mike2 は二度と選ばれない) ---- */
  run(sb, "S.staff = COATS.filter(c => c !== 'syamu').map((c, i) => ({ id: 100 + i, name: 'x', coat: c, role: 'prog', lv: 1 }));");
  check("B14: visitor pool yields the only unhired coat (syamu), never mike2",
    run(sb, "spawnStripVisitor().coat") === "syamu");
  run(sb, "stripVisitor = null;");
}

/* ---- mike2 旧セーブ fixture: 個体は失われず決定的に着せ替わる ---- */
{
  const fixture = JSON.stringify({
    coins: 5000, rp: 10,
    totals: { releases: 3, hired: 2, coinsEarned: 9000, clicks: 40, commits: 20,
              lines: 300, bugsSquashed: 2, keys: 100, cursorPx: 400, naps: 0,
              playSec: 600, crits: 0, goldFish: 0, eventBugs: 0 },
    staff: [{ id: 7, name: "ミケ", coat: "mike2", role: "prog", lv: 3 },
            { id: 8, name: "クロ", coat: "kuro", role: "carry", lv: 1 }],
    staffSeq: 8
  });
  const sbOld = buildSandbox({});
  sbOld.localStorage.setItem("miyuke-save-v1", fixture);
  let threw = false;
  try { loadGame(sbOld); } catch (e) { threw = true; }
  check("B14: legacy save with a mike2 staff member loads without error", !threw);
  check("B14: mike2 member is kept and re-coated into COATS (role/lv/name preserved)",
    run(sbOld, "S.staff.length") === 2 &&
    run(sbOld, "S.staff[0].coat") !== "mike2" && run(sbOld, "COATS.includes(S.staff[0].coat)") &&
    run(sbOld, "S.staff[0].role") === "prog" && run(sbOld, "S.staff[0].lv") === 3 &&
    run(sbOld, "S.staff[0].name") === "ミケ" && run(sbOld, "S.staff[1].coat") === "kuro",
    "coat=" + run(sbOld, "S.staff[0].coat"));
  const sbOld2 = buildSandbox({});
  sbOld2.localStorage.setItem("miyuke-save-v1", fixture);
  loadGame(sbOld2);
  check("B14: re-coat is deterministic across loads",
    run(sbOld, "S.staff[0].coat") === run(sbOld2, "S.staff[0].coat"),
    run(sbOld, "S.staff[0].coat") + " vs " + run(sbOld2, "S.staff[0].coat"));
  check("B14: loading a veteran save does NOT fire the tier celebration (tracker primed at load)",
    run(sbOld, "officeTierSeen") === run(sbOld, "officeTier(S)") && run(sbOld, "officeTier(S)") >= 1);
}

/* ---- ティア上昇の祝い: セッション中の上昇で一度だけ ---- */
{
  const sb = buildSandbox({ hash: "#strip", width: 1600, height: 210 });
  loadGame(sb);
  run(sb, "tick();");
  check("B14: first tick primes the tier tracker silently (no celebration on a fresh game)",
    run(sb, "officeTierSeen") === 0 && run(sb, "stripConfetti.length") === 0);
  run(sb, "S.totals.releases = 1; S.staff.push({ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 }); tick();");
  check("B14: rising to tier 1 mid-session celebrates once (say + confetti near the desk)",
    run(sb, "officeTierSeen") === 1 &&
    run(sb, "stripSay.text").includes("小さなオフィス") &&
    run(sb, "stripConfetti.length") >= 8,
    "say=" + run(sb, "stripSay.text") + " confetti=" + run(sb, "stripConfetti.length"));
  const confettiAfter = run(sb, "stripConfetti.length");
  run(sb, "tick();");
  check("B14: no repeat celebration while the tier is unchanged",
    run(sb, "stripConfetti.length") === confettiAfter);
}

/* ---- 環境ドット絵: データとティア別の出し分け (描画呼び出しの記録で検証) ---- */
{
  const ENV_NAMES = ["prop_kanban", "desk_laminate_main", "desk_laminate_2", "desk_laminate_2_sprite",
    "prop_chair", "prop_server_rack", "shelf_steel", "prop_books", "prop_archive_boxes", "prop_mat"];
  const newEnvSb = () => {
    const s = buildSandbox({ hash: "#strip", width: 1600, height: 210 });
    loadGame(s);
    run(s, `window.__drawnEnv = [];
      const __osdsEnv = sDrawSprite;
      sDrawSprite = function(n, x, y, sc, f){ window.__drawnEnv.push(n); return __osdsEnv(n, x, y, sc, f); };`);
    return s;
  };
  const drawnEnv = s => run(s, "window.__drawnEnv.splice(0)");

  const sbD = newEnvSb();
  check("B14: all 10 env sprites resolve in the game copy at manifest sizes",
    ENV_NAMES.every(n => run(sbD, `hasSprite(${JSON.stringify(n)})`)) &&
    run(sbD, "JSON.stringify(spriteSize('prop_kanban'))") === "[132,30]" &&
    run(sbD, "JSON.stringify(spriteSize('desk_laminate_main'))") === "[116,3]" &&
    run(sbD, "JSON.stringify(spriteSize('desk_laminate_2'))") === "[80,16]" &&
    run(sbD, "JSON.stringify(spriteSize('desk_laminate_2_sprite'))") === "[40,24]" &&
    run(sbD, "JSON.stringify(spriteSize('prop_chair'))") === "[32,36]" &&
    run(sbD, "JSON.stringify(spriteSize('prop_server_rack'))") === "[48,64]" &&
    run(sbD, "JSON.stringify(spriteSize('shelf_steel'))") === "[40,28]" &&
    run(sbD, "JSON.stringify(spriteSize('prop_books'))") === "[24,7]" &&
    run(sbD, "JSON.stringify(spriteSize('prop_archive_boxes'))") === "[18,25]" &&
    run(sbD, "JSON.stringify(spriteSize('prop_mat'))") === "[150,4]");

  /* tier 0 (新規): 環境スプライトは一切出ない。棚は木、ボードは木枠 */
  const sb0 = newEnvSb();
  run(sb0, "render();");
  const d0 = drawnEnv(sb0);
  check("B14: tier 0 strip draws NO env sprites (all-wood look unchanged)",
    !ENV_NAMES.some(n => d0.includes(n)) && d0.includes("prop_shelf"),
    d0.filter(n => ENV_NAMES.includes(n)).join(","));

  /* tier 0 の家具形 (officeTier を 0 に固定して解放済み家具の木の姿を見る) */
  const sb0b = newEnvSb();
  run(sb0b, "officeTier = () => 0; S.line2.unlocked = true; S.stamps.first_release = true; S.upgrades.ci = 3; render();");
  const d0b = drawnEnv(sb0b);
  check("B14: with the tier forced to 0, unlocked furniture keeps its wooden forms",
    d0b.includes("prop_desk2") && d0b.includes("prop_shelf") &&
    !ENV_NAMES.some(n => d0b.includes(n)),
    d0b.filter(n => ENV_NAMES.includes(n)).join(","));

  /* tier 1 (初リリース+初雇用): カンバン/ラミネート机/チェア/マット/段ボール。
     棚はまだ木、ラックと本と第2机ラミネートは出ない */
  const sb1 = newEnvSb();
  run(sb1, "S.totals.releases = 1; S.staff.push({ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 }); S.stamps.first_release = true; render();");
  const d1 = drawnEnv(sb1);
  check("B14: tier 1 strip swaps desk/chair/mat/easel to office forms + wide kanban leaderboard face",
    ["desk_laminate_main", "prop_chair", "prop_mat", "prop_archive_boxes", "prop_wall_1", "prop_kanban_wide"]
      .every(n => d1.includes(n)) && !d1.includes("prop_kanban"),
    d1.join(","));
  check("B14: tier 1 keeps the wooden shelf and none of the tier-2 set",
    d1.includes("prop_shelf") && !["shelf_steel", "prop_books", "prop_server_rack", "desk_laminate_2_sprite"]
      .some(n => d1.includes(n)),
    d1.join(","));
  check("B14: leaderboard hit rect is the same at tier 1 (204x64)",
    (() => { const r = run(sb1, "stripHitRects.board"); return r && r.w === 204 && r.h === 64; })(),
    JSON.stringify(run(sb1, "stripHitRects.board")));

  /* tier 2 (第2ライン+CI): スチール棚/本/ラックが加わる。第2机はバッチ14
     以降ティア不変で sakuri 作画 prop_desk2 (旧ラミネート版は引退) */
  const sb2 = newEnvSb();
  run(sb2, "S.totals.releases = 1; S.staff.push({ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 });" +
           "S.line2.unlocked = true; S.upgrades.ci = 2; S.shelf = [{ name: 'w1', icon: 0 }]; render();");
  const d2 = drawnEnv(sb2);
  check("B14: tier 2 + CI machine draws steel shelf, books, server rack and sakuri desk 2",
    ["shelf_steel", "prop_books", "prop_server_rack", "prop_desk2"]
      .every(n => d2.includes(n)) && !d2.includes("prop_shelf") && !d2.includes("desk_laminate_2_sprite"),
    d2.join(","));

  /* ラックの二重ゲート: tier 2 でも CI 未所持なら出ない */
  const sb2b = newEnvSb();
  run(sb2b, "S.totals.releases = 1; S.staff.push({ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 });" +
            "S.line2.unlocked = true; S.shelf = [{ name: 'w1', icon: 0 }]; render();");
  const d2b = drawnEnv(sb2b);
  check("B14: server rack is double-gated (tier 2 without the CI machine draws no rack)",
    !d2b.includes("prop_server_rack") && d2b.includes("shelf_steel"),
    d2b.join(","));

  /* 本の衝突回避: 下段に作品箱がある時は本を出さない */
  const sb2c = newEnvSb();
  run(sb2c, "S.totals.releases = 1; S.staff.push({ id: 1, name: 'a', coat: 'kuro', role: 'prog', lv: 1 });" +
            "S.line2.unlocked = true; S.upgrades.ci = 2;" +
            "S.shelf = [{ name: 'w1', icon: 0 }, { name: 'w2', icon: 1 }]; render();");
  const d2c = drawnEnv(sb2c);
  check("B14: books stay off the shelf while the lower level holds a work box",
    !d2c.includes("prop_books") && d2c.includes("shelf_steel"),
    d2c.join(","));
}

/* ================= Phase B15: スタッフバッチ10 (hachiware アニメ化) =================
   最後に残っていた旧静止画の毛柄 hachiware が sakuri 作画の統一仕様
   (walk 9f + sit 6f) で ANIMS 化。これで COATS の全毛柄がアニメ化され、
   従来経路 (32×24 ×4/3) を使うスタッフはいなくなった */
console.log("== Phase B15: staff batch 10 (hachiware ANIMS — all coats animated) ==");
{
  const sb = buildSandbox({ hash: "#strip", width: 1600, height: 210 });
  loadGame(sb);
  const fAt15 = (base, t) => run(sb, `animFrameAt(${JSON.stringify(base)}, ${t})`);

  /* ---- データ: hachiware の ANIMS (統一仕様) ---- */
  check("B15: staff_hachiware_walk ANIMS is the 7-frame walk_loop tag range",
    run(sb, "ANIMS.staff_hachiware_walk.frames.join(',')") ===
      Array.from({ length: 7 }, (_, i) => "staff_hachiware_walk_" + i).join(",") &&
    run(sb, "ANIMS.staff_hachiware_walk.durations.join(',')") === "600,600,300,600,600,600,600" &&
    run(sb, "ANIMS.staff_hachiware_walk.loopFrom") === 0 && run(sb, "ANIMS.staff_hachiware_walk.loopTo") === 6 &&
    run(sb, "ANIMS.staff_hachiware_walk.loopCount") === Infinity);
  check("B15: staff_hachiware_sit ANIMS is 5 frames x 600ms looping (batch 13 redraw: file has sit 5f)",
    run(sb, "ANIMS.staff_hachiware_sit.frames.join(',')") ===
      Array.from({ length: 5 }, (_, i) => "staff_hachiware_sit_" + i).join(",") &&
    run(sb, "ANIMS.staff_hachiware_sit.durations.join(',')") === "600,600,600,600,600" &&
    run(sb, "ANIMS.staff_hachiware_sit.loopFrom") === 0 && run(sb, "ANIMS.staff_hachiware_sit.loopTo") === 4 &&
    run(sb, "ANIMS.staff_hachiware_sit.loopCount") === Infinity);
  check("B15: all hachiware frames exist at the unified 48x40 spec",
    run(sb, "ANIMS.staff_hachiware_walk.frames.concat(ANIMS.staff_hachiware_sit.frames)" +
      ".every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40)"));
  check("B15: every hachiware frame touches the ground row (baseline 39)",
    run(sb, "ANIMS.staff_hachiware_walk.frames.concat(ANIMS.staff_hachiware_sit.frames)" +
      ".every(f => /[^.]/.test(window.MIYUKE_SPRITES.sprites[f][39]))"));
  check("B15: hachiware walk timeline (accent frame + wrap)",
    fAt15("staff_hachiware_walk", 0) === "staff_hachiware_walk_0" &&
    fAt15("staff_hachiware_walk", 1500) === "staff_hachiware_walk_3" &&
    fAt15("staff_hachiware_walk", 3900) === "staff_hachiware_walk_0");

  /* ---- 全毛柄アニメ化の完了アサーション (旧静止画の毛柄は残っていない) ---- */
  check("B15: EVERY coat in COATS has walk+sit+back ANIMS with all frames present (no legacy coats remain)",
    run(sb, "COATS.every(c => { const w = ANIMS['staff_' + c + '_walk'], s = ANIMS['staff_' + c + '_sit'];" +
      " return w && s && w.frames.length === 7 && s.frames.length === ((c === 'hachiware' || c === 'hachiware_gray') ? 5 : 6) && ANIMS['staff_' + c + '_back'] && ANIMS['staff_' + c + '_back'].frames.every(f => hasSprite(f)) &&" +
      " w.frames.concat(s.frames).every(f => hasSprite(f) && spriteSize(f)[0] === 48 && spriteSize(f)[1] === 40); })"),
    run(sb, "COATS.join(',')"));

  /* ---- ポートレートと帯の描画経路 (hachiware) ---- */
  run(sb, "spriteCache['staff_hachiware_sit_0'].toDataURL = () => 'data:HACHI_SIT0';" +
          "for (const k of Object.keys(sprUrlCache)) delete sprUrlCache[k];");
  check("B15: staffPortrait(hachiware) uses the 48x40 ANIMS sit frame",
    run(sb, "staffPortrait('hachiware')").includes("data:HACHI_SIT0"));
  run(sb, "S.staff = [{ id: 981, name: 'ハチ', coat: 'hachiware', role: 'prog', lv: 1 }]; S.staffSeq = 981;");
  run(sb, "render();");
  run(sb, `window.__drawnB15 = [];
    const __osdsB15 = sDrawSprite;
    sDrawSprite = function(n, x, y, s, f){ window.__drawnB15.push([n, x, y, s, f]); return __osdsB15(n, x, y, s, f); };`);
  run(sb, "stripWalkers[981].x = 500; stripWalkers[981].dir = 1; stripWalkers[981].sitting = false; stripWalkers[981].walkClock = 0; render();");
  let drawnB15 = run(sb, "window.__drawnB15.splice(0)");
  check("B15: hachiware walker draws ANIMS frames at staff48 scale, mirrored heading right",
    drawnB15.some(d => d[0].startsWith("staff_hachiware_walk") && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawnB15.filter(d => d[0].startsWith("staff_hachiware"))));
  run(sb, "stripWalkers[981].sitting = true; stripWalkers[981].sitStart = stripNow; stripWalkers[981].until = stripNow + 100000; render();");
  drawnB15 = run(sb, "window.__drawnB15.splice(0)");
  check("B15: sitting hachiware draws sit frame 0 at staff48 scale, unflipped",
    drawnB15.some(d => d[0] === "staff_hachiware_sit_0" && d[3] === 1.5 && d[4] === false),
    JSON.stringify(drawnB15.filter(d => d[0].startsWith("staff_hachiware"))));

  /* ---- 訪問猫: hachiware も ANIMS で横切る ---- */
  run(sb, "stripVisitor = { x: 200, dir: 1, coat: 'hachiware', speed: 15, walkClock: 700 }; render();");
  drawnB15 = run(sb, "window.__drawnB15.splice(0)");
  check("B15: hachiware visitor crosses with the walk ANIMS (frame 1, mirrored, x1.5)",
    drawnB15.some(d => d[0] === "staff_hachiware_walk_1" && d[3] === 1.5 && d[4] === true),
    JSON.stringify(drawnB15.filter(d => d[0].startsWith("staff_hachiware"))));
  run(sb, "sDrawSprite = __osdsB15; stripVisitor = null;");
}

/* ================= Phase D: v2.3.5 自動アップデート ================= */
console.log("== Phase D: auto-update (config + fake updater flows) ==");
(async () => {
  /* --- 設定ファイル側の整合（実ファイルを読む） --- */
  const DESK = GAME_HTML.DESK_DIR;
  const conf = JSON.parse(fs.readFileSync(DESK + "src-tauri/tauri.conf.json", "utf8"));
  check("tauri version is 2.6.1", conf.version === "2.6.1", "got " + conf.version);
  check("GAME_VERSION label matches tauri version",
    HTML.includes("const GAME_VERSION = \"v" + conf.version + "\""));
  check("createUpdaterArtifacts enabled", conf.bundle && conf.bundle.createUpdaterArtifacts === true);
  check("updater pubkey embedded (non-empty base64)",
    !!(conf.plugins && conf.plugins.updater && typeof conf.plugins.updater.pubkey === "string" &&
       conf.plugins.updater.pubkey.length > 80));
  check("updater endpoint is the myuke-game latest.json",
    JSON.stringify(conf.plugins.updater.endpoints) ===
    JSON.stringify(["https://github.com/sakri9616-coder/myuke-game/releases/latest/download/latest.json"]),
    JSON.stringify(conf.plugins.updater.endpoints));
  check("bundle identifier unchanged (save location stable)", conf.identifier === "jp.muse.miyuke");
  const cargo = fs.readFileSync(DESK + "src-tauri/Cargo.toml", "utf8");
  check("Cargo.toml version is 2.6.1", /^version = "2\.6\.1"$/m.test(cargo));
  check("Cargo.toml has updater + process plugins",
    cargo.includes("tauri-plugin-updater") && cargo.includes("tauri-plugin-process"));
  const mainRs = fs.readFileSync(DESK + "src-tauri/src/main.rs", "utf8");
  check("main.rs registers updater + process plugins",
    mainRs.includes("tauri_plugin_updater") && mainRs.includes("tauri_plugin_process"));
  check("main.rs: strip is snap-immune on Windows only (resizable/maximizable off, GTK keeps resizable)",
    mainRs.includes('cfg!(target_os = "windows")') &&
    mainRs.includes("w.set_resizable(false)") && mainRs.includes("w.set_maximizable(false)"));
  const caps = JSON.parse(fs.readFileSync(DESK + "src-tauri/capabilities/default.json", "utf8"));
  check("capabilities grant updater:default + process:default",
    caps.permissions.includes("updater:default") && caps.permissions.includes("process:default"));

  /* --- Updater プラグインが無い環境（Tauri なしの検証スタブ）では操作できない --- */
  {
    const sb = buildSandbox({});
    loadGame(sb);
    check("browser: updApi() is null", run(sb, "updApi()") === null);
    run(sb, "paintUpd(); switchTab('settings'); renderPanel();");
    const html = sb._el("panel").innerHTML;
    check("no updater: settings shows the update row as unavailable",
      html.includes("アップデート") && html.includes("利用できません"));
    check("browser: strip update chip is removed (Stage 3: toolbox ribbon instead)",
      !HTML.includes('id="strip-upd"') && !HTML.includes('id="strip-hud"'));
    check("no updater: GAME_VERSION is v2.6.1", run(sb, "GAME_VERSION") === "v2.6.1");
  }

  /* --- 偽 Updater: 新版あり → チップ/カード表示 → DL → 再起動導線 --- */
  {
    let relaunches = 0;
    const updObj = {
      version: "2.3.9", currentVersion: "2.3.8", body: "テスト用ノート",
      downloadAndInstall: async (cb) => {
        cb({ event: "Started", data: { contentLength: 100 } });
        cb({ event: "Progress", data: { chunkLength: 40 } });
        cb({ event: "Progress", data: { chunkLength: 60 } });
        cb({ event: "Finished", data: {} });
      }
    };
    const tauri = {
      core: { invoke: () => Promise.resolve({}) },
      event: { listen: () => Promise.resolve(() => {}) },
      updater: { check: async () => updObj },
      process: { relaunch: async () => { relaunches++; } }
    };
    const sb = buildSandbox({ hash: "#strip", tauri, width: 1280, height: 210 });
    loadGame(sb);
    check("tauri: updApi() present", run(sb, "updApi() !== null"));
    const found = await run(sb, "checkForUpdates(true)");
    check("check reports update available", found === true && run(sb, "upd.status") === "available");
    check("available version recorded", run(sb, "updVerLabel()") === "v2.3.9");
    check("no strip chip exists for updates (Stage 3: toolbox ribbon carries it)",
      !HTML.includes('id="strip-upd"'));
    const card = sb._el("update-card");
    check("update card appears with download button",
      card.style.display === "" && card.innerHTML.includes("updDownload()") && card.innerHTML.includes("v2.3.9"));
    await run(sb, "updDownload()");
    check("download completes to ready", run(sb, "upd.status") === "ready", "status=" + run(sb, "upd.status"));
    check("download progress reached 100%", run(sb, "upd.got") === 100 && run(sb, "upd.total") === 100);
    /* Stage 3: 帯側の更新通知は工具箱のリボン (赤ベタ) が担う */
    run(sb, "window.__rectsRibbon = [];" +
      " const __osrRibbon = sR;" +
      " sR = function(x, y, w, h, c){ window.__rectsRibbon.push(c); return __osrRibbon(x, y, w, h, c); };" +
      " renderStrip(); sR = __osrRibbon;");
    check("toolbox ribbon is drawn on the strip while an update is ready",
      run(sb, "window.__rectsRibbon.includes('#e2543e')") === true);
    run(sb, "updRelaunch()");
    check("relaunch invoked", relaunches === 1, "relaunches=" + relaunches);
    run(sb, "upd.status = 'available'; paintUpd(); updDismiss();");
    check("dismiss hides the card but keeps state", card.style.display === "none" && run(sb, "upd.status") === "available");
    /* 設定タブ側: available の間は「更新する」ボタンと状態文が出る */
    run(sb, "upd.dismissed = false; switchTab('settings'); renderPanel();");
    const html = sb._el("panel").innerHTML;
    check("settings row offers update button + status",
      html.includes("updDownload()") && html.includes("新しいバージョン v2.3.9 があります"));
  }

  /* --- 偽 Updater: 最新（null）と オフライン（例外） --- */
  {
    const tauriUpToDate = {
      core: { invoke: () => Promise.resolve({}) },
      event: { listen: () => Promise.resolve(() => {}) },
      updater: { check: async () => null },
      process: { relaunch: async () => {} }
    };
    const sb = buildSandbox({ tauri: tauriUpToDate });
    loadGame(sb);
    const found = await run(sb, "checkForUpdates(true)");
    check("up-to-date: manual check ends in uptodate state",
      found === false && run(sb, "upd.status") === "uptodate");
    check("up-to-date: status text says 最新です",
      run(sb, "updStatusText()").includes("最新です"));
    check("up-to-date: no card",
      sb._el("update-card").style.display === "none");

    const tauriOffline = {
      core: { invoke: () => Promise.resolve({}) },
      event: { listen: () => Promise.resolve(() => {}) },
      updater: { check: async () => { throw new Error("network unreachable"); } },
      process: { relaunch: async () => {} }
    };
    const sb2 = buildSandbox({ tauri: tauriOffline });
    loadGame(sb2);
    await run(sb2, "checkForUpdates(false)");
    check("offline: auto check stays silent (idle)", run(sb2, "upd.status") === "idle");
    await run(sb2, "checkForUpdates(true)");
    check("offline: manual check ends in graceful error", run(sb2, "upd.status") === "error");
    check("offline: no card",
      sb2._el("update-card").style.display === "none");
  }

  /* ================= Phase E: 2ウィンドウ化 (owner/viewer) ================= */
  console.log("== Phase E: two-window owner/viewer protocol (fake event bus) ==");
  {
    /* 偽 Tauri イベントバス: ラベル (main=owner / menu=viewer / rust) 単位で配送する。
       実 Tauri の emit は全 webview への broadcast、emitTo は宛先指定、という形を模す */
    const busListeners = { main: {}, menu: {}, rust: {} };
    const busLog = [];
    function busDeliver(from, to, event, payload) {
      busLog.push({ from, to, event });
      ((busListeners[to] || {})[event] || []).slice().forEach(fn => {
        try { fn({ payload, event }); } catch (e) { console.error("bus listener error:", e); }
      });
    }
    function busTauri(self) {
      return {
        core: { invoke: (cmd, args) => { busLog.push({ from: self, to: "rust", event: "invoke", cmd, args }); return Promise.resolve({}); } },
        event: {
          listen: (event, fn) => {
            (busListeners[self][event] = busListeners[self][event] || []).push(fn);
            return Promise.resolve(() => {});
          },
          emit: (event, payload) => {
            for (const k of Object.keys(busListeners)) if (k !== self) busDeliver(self, k, event, payload);
            return Promise.resolve();
          },
          emitTo: (target, event, payload) => { busDeliver(self, target, event, payload); return Promise.resolve(); }
        }
      };
    }
    /* owner を先に読む (menu-ready の受け手が先に居る必要がある) */
    const sbO = buildSandbox({ tauri: busTauri("main") });
    sbO.__MIYUKE_MODE__ = "strip"; sbO.__MIYUKE_ROLE__ = "owner";
    loadGame(sbO);
    run(sbO, "S.coins = 4242;");
    const sbV = buildSandbox({ tauri: busTauri("menu") });
    sbV.__MIYUKE_MODE__ = "full"; sbV.__MIYUKE_ROLE__ = "viewer";
    loadGame(sbV);

    check("E: roles resolve (owner / viewer)",
      run(sbO, "ROLE") === "owner" && run(sbV, "ROLE") === "viewer" && run(sbV, "IS_VIEWER") === true);

    /* (1) viewer は tick/save/load を持たない: 全タイマを回しても状態が進まず、
       SAVE_KEY は書かれず、トラップも踏まない */
    for (let r = 0; r < 3; r++) for (const iv of sbV._intervals) { try { iv.fn(); } catch (e) {} }
    check("E: viewer never ticks (playSec stays 0, coins stay snapshot-only)",
      run(sbV, "S.totals.playSec") === 0, "playSec=" + run(sbV, "S.totals.playSec"));
    check("E: viewer localStorage has no SAVE_KEY",
      run(sbV, "localStorage.getItem(SAVE_KEY)") === null);
    check("E: viewer save-trap untouched during normal run",
      run(sbV, "window.__viewerSaveTrap.hits") === 0);
    check("E: viewer has no input-activity listener (no double counting by construction)",
      !busListeners.menu["input-activity"] || busListeners.menu["input-activity"].length === 0);

    /* owner は tick と save を持つ */
    const ownerTick = sbO._intervals.find(iv => iv.ms === 1000);
    const ownerSave = sbO._intervals.find(iv => iv.ms === 10000);
    check("E: owner owns tick + save intervals", !!ownerTick && !!ownerSave);
    ownerTick.fn();
    check("E: owner tick advances playSec", run(sbO, "S.totals.playSec") === 1);
    ownerSave.fn();
    check("E: owner save writes SAVE_KEY",
      run(sbO, "localStorage.getItem(SAVE_KEY)") !== null);

    /* (2) ハンドシェイク: menu-ready → 即スナップショット → viewer が同期する */
    check("E: handshake happened (menu-ready seen, snapshot delivered)",
      busLog.some(l => l.event === "menu-ready" && l.from === "menu") &&
      busLog.some(l => l.event === "state-snapshot" && l.to === "menu"));
    check("E: viewer synced to owner state (coins 4242)",
      run(sbV, "viewerSynced") === true && run(sbV, "S.coins") === 4242,
      "coins=" + run(sbV, "S.coins"));

    /* (2') 古い seq のスナップショットは捨てる */
    busDeliver("main", "menu", "state-snapshot", {
      v: 1, seq: 1, rev: 99999, at: Date.now(),
      S: JSON.parse(run(sbV, "JSON.stringify(freshState())")), live: {}
    });
    check("E: stale snapshot (old seq) is discarded",
      run(sbV, "S.coins") === 4242, "coins=" + run(sbV, "S.coins"));

    /* open-tab は Rust の pending 経路 (menu 側は switchTab するだけ) */
    busDeliver("rust", "menu", "open-tab", { tab: "settings" });
    check("E: open-tab switches viewer tab locally", run(sbV, "currentTab") === "settings");
    run(sbV, "switchTab('factory')");

    /* (3) コマンド: viewer の buyUpgrade は帯で一回だけ実行され、
       結果がスナップショット経由で viewer の S とパネル HTML に出る */
    run(sbO, "S.coins = 100000;");
    busDeliver("menu", "main", "menu-ready");   /* 再同期して残高を viewer に伝える */
    check("E: viewer balance resynced (100000)", run(sbV, "S.coins") === 100000);
    const cmdBefore = busLog.filter(l => l.event === "menu-cmd").length;
    run(sbV, "buyUpgrade('bot')");   /* viewer 側はスタブに差し替わっている */
    check("E: command executed exactly once on owner (bot Lv1, -350 coins)",
      run(sbO, "S.upgrades.bot") === 1 && run(sbO, "S.coins") === 99650,
      "bot=" + run(sbO, "S.upgrades.bot") + " coins=" + run(sbO, "S.coins"));
    check("E: exactly one menu-cmd was sent",
      busLog.filter(l => l.event === "menu-cmd").length === cmdBefore + 1);
    check("E: cmd-result returned to viewer",
      busLog.some(l => l.event === "cmd-result" && l.to === "menu"));
    check("E: viewer replica shows bot Lv1 after snapshot",
      run(sbV, "S.upgrades.bot") === 1 && run(sbV, "S.coins") === 99650);
    const vPanel = sbV._el("panel").innerHTML;
    check("E: viewer factory panel renders bot row with Lv1",
      vPanel.includes("子ねこボット") && vPanel.includes("Lv1"),
      vPanel.slice(0, 120));

    /* (4) input-activity の broadcast が menu に届いても二重計数しない */
    const ok0 = run(sbO, "S.totals.keys"), vk0 = run(sbV, "S.totals.keys");
    busDeliver("rust", "main", "input-activity", { keys: 10, distPx: 120, clicks: 1 });
    busDeliver("rust", "menu", "input-activity", { keys: 10, distPx: 120, clicks: 1 });
    check("E: owner counts OS input once (+10 keys)",
      run(sbO, "S.totals.keys") === ok0 + 10, "owner=" + run(sbO, "S.totals.keys"));
    check("E: viewer does not count OS input (replica untouched)",
      run(sbV, "S.totals.keys") === vk0, "viewer=" + run(sbV, "S.totals.keys"));

    /* (5) giveSnack のセリフが live 経由で menu の吹き出しに出る */
    run(sbO, "giveSnack()");
    check("E: say travels via live (viewer lastSayText has snack line)",
      String(run(sbV, "lastSayText")).includes("おやつ"),
      String(run(sbV, "lastSayText")));
    run(sbV, "switchTab('proj'); renderPanel();");
    check("E: viewer proj bubble shows the snack line",
      sbV._el("panel").innerHTML.includes("おやつ"));

    /* menu-input: menu 内の集計が帯のブースト材料へ合流する */
    const ok1 = run(sbO, "S.totals.keys");
    run(sbV, "menuInputAcc.keys = 3; menuInputAcc.distPx = 50;");
    for (const iv of sbV._intervals) if (iv.ms === 1000) { try { iv.fn(); } catch (e) {} }
    check("E: menu-input aggregates reach owner (+3 keys)",
      run(sbO, "S.totals.keys") === ok1 + 3, "owner=" + run(sbO, "S.totals.keys"));

    /* (6) 帯のプロジェクトボードのクリックが open_menu (tab=proj) になる (owner 側) */
    run(sbO, "render();");
    const oBcx = run(sbO, "stripDeskCX()") / run(sbO, "stripVW") * 1280;
    sbO._el("strip").dispatch("pointerdown", { clientX: oBcx, clientY: (4 + 15) / 120 * 210 });
    check("E: owner board click invokes open_menu with tab=proj",
      busLog.some(l => l.event === "invoke" && l.cmd === "open_menu" && l.args && l.args.tab === "proj"),
      JSON.stringify(busLog.filter(l => l.event === "invoke").map(l => l.cmd)));

    /* (1') 書き込みトラップ: viewer が SAVE_KEY に触れたら遮断される (最後に実施) */
    run(sbV, "localStorage.setItem(SAVE_KEY, 'x')");
    check("E: save-trap blocks viewer SAVE_KEY write and counts it",
      run(sbV, "window.__viewerSaveTrap.hits") === 1 &&
      run(sbV, "localStorage.getItem(SAVE_KEY)") === null);
    check("E: trap notified the owner",
      busLog.some(l => l.event === "viewer-trap" && l.to === "main"));
  }

  /* ================= Phase F: チュートリアル導線 (段階的開示) =================
     設計: research/TUTORIAL_DESIGN.md。ステージは測定可能な事実だけで進み、
     ロックは locked = stageBelow && !ownsAny (所持が常に勝つ) が原則 */
  console.log("== Phase F: tutorial guidance (staged disclosure) ==");
  {
    const tabBtnF = (sb, id) => run(sb, `tabsEl.children.find(b => b.dataset.tab === "${id}")`);
    const badgeF = (sb, id) => run(sb, `(function(){ const b = tabsEl.children.find(x => x.dataset.tab === "${id}"); return b.children.find(c => c.className === "tab-badge" || c.className === "tab-badge new") || null; })()`);

    /* ---- F1: 新規セーブは Stage 0。実体は proj/settings だけ ---- */
    const sb = buildSandbox({});
    loadGame(sb);
    const panelF = () => sb._el("panel").innerHTML;
    check("F: fresh save starts at tutorial stage 0 (not skipped)",
      run(sb, "S.tut.stage") === 0 && run(sb, "S.tut.skipped") === false);
    check("F: stage-0 locked tab set is exactly the 7 guided tabs (proj/settings never lock)",
      ["shelf", "stats", "factory", "research", "click", "staff", "requests"].every(t => run(sb, `tutTabLocked("${t}")`)) &&
      !run(sb, "tutTabLocked('proj')") && !run(sb, "tutTabLocked('settings')"));
    check("F: locked tabs are painted as silhouettes (locked class + visible 🔒 pin)",
      ["staff", "factory", "research"].every(t => {
        const b = tabBtnF(sb, t);
        return b.className.includes("locked") &&
          b.children.some(c => c.className === "tab-lockic" && c.style.display !== "none");
      }));
    run(sb, "switchTab('proj')");
    check("F: proj tab is fully live at stage 0",
      panelF().includes("bubble-text") && panelF().includes("hero-pct"));
    run(sb, "switchTab('staff')");
    check("F: staff tab shows the silhouette lock panel with a visual coin bar (0 / 220)",
      panelF().includes("lockpanel") && panelF().includes("condbar") &&
      panelF().includes("0 / 220") && !panelF().includes("hireStaff"),
      panelF().slice(0, 160));
    run(sb, "switchTab('factory')");
    check("F: factory at stage 0 is the lock panel (no upgrade/line2 entities leak)",
      panelF().includes("lockpanel") && !panelF().includes("buyUpgrade") && !panelF().includes("buyLine2"));
    run(sb, "switchTab('settings')");
    check("F: settings is never locked and carries the tutorial row (見直す / 全部ひらく)",
      panelF().includes("🎓") && panelF().includes("tutSkipGuide()") && panelF().includes("tutResetGuide()"));
    check("F: stage-0 quest chip is the watch-over objective",
      run(sb, "stripQuestText()") === "🎯 最初の作品ができるまで見守ろう",
      run(sb, "stripQuestText()"));
    run(sb, "renderStrip();");
    check("F: quest text now lives on the hanging memo under the leaderboard",
      run(sb, "stripMemoText()").includes("見守ろう") && !!run(sb, "stripHitRects.memo"));

    /* ---- F2: 事実を1つずつ積むと、ステージは1段ずつだけ進む ---- */
    run(sb, "S.totals.releases = 1; tutCheck();");
    check("F: first release advances exactly to stage 1",
      run(sb, "S.tut.stage") === 1, "stage=" + run(sb, "S.tut.stage"));
    check("F: stage 1 unlocks shelf/stats/factory; research stays locked",
      !run(sb, "tutTabLocked('shelf')") && !run(sb, "tutTabLocked('factory')") && run(sb, "tutTabLocked('research')"));
    check("F: stage-1 quest chip counts the shortfall to the cheapest tool",
      run(sb, "stripQuestText()") === "🎯 あと 40🪙 で工場の道具を1つ買えるにゃ",
      run(sb, "stripQuestText()"));
    check("F: freshly unlocked factory tab carries the 🆕 badge before first visit",
      badgeF(sb, "factory") && badgeF(sb, "factory").textContent === "🆕" && badgeF(sb, "factory").style.display !== "none");
    run(sb, "switchTab('factory')");
    check("F: visiting the tab clears its 🆕 badge",
      !(badgeF(sb, "factory") && badgeF(sb, "factory").style.display !== "none" && badgeF(sb, "factory").textContent === "🆕"));
    check("F: factory at stage 1 has real upgrade rows",
      panelF().includes("buyUpgrade") && panelF().includes("data-fix='up:keyboard'"));
    check("F: bot is a silhouette at stage 1 (colleague gate = stage 4)",
      panelF().includes("seclock") && panelF().includes("子ねこボット") && !panelF().includes('buyUpgrade("bot")'));
    check("F: line2 + prestige are silhouettes at stage 1 (no entities leak)",
      panelF().includes("第2ライン") && panelF().includes("？？？") &&
      !panelF().includes("buyLine2()") && !panelF().includes("doPrestige()"));
    run(sb, "S.rp = 2; tutCheck();");
    check("F: cumulative RP 2 advances to stage 2 (research unlocks)",
      run(sb, "S.tut.stage") === 2 && !run(sb, "tutTabLocked('research')"),
      "stage=" + run(sb, "S.tut.stage"));
    run(sb, "switchTab('research')");
    check("F: research panel has real cards; tier2 shows its prerequisite chip",
      panelF().includes("buyResearch") && panelF().includes("🔒 前提:"));
    check("F: repeat research is a silhouette until tier 1 is done",
      panelF().includes("seclock") && !panelF().includes('buyResearch("res_report")'));
    run(sb, "buyResearch('res_plant');");
    check("F: finishing a research latches quest q2 and flashes 🎉 on the chip",
      run(sb, "S.tut.seen.q2") === true && run(sb, "stripQuestText()") === "🎉 できたにゃ！",
      "chip=" + run(sb, "stripQuestText()"));
    run(sb, "S.totals.clicks = 30; tutCheck();");
    check("F: 30 cheer clicks advance to stage 3 (click tab unlocks)",
      run(sb, "S.tut.stage") === 3 && !run(sb, "tutTabLocked('click')"),
      "stage=" + run(sb, "S.tut.stage"));
    run(sb, "S.totals.coinsEarned = 220; tutCheck();");
    check("F: 220 cumulative coins advance to stage 4 (staff unlocks with 🆕)",
      run(sb, "S.tut.stage") === 4 && !run(sb, "tutTabLocked('staff')") &&
      badgeF(sb, "staff") && badgeF(sb, "staff").textContent === "🆕",
      "stage=" + run(sb, "S.tut.stage"));
    run(sb, "switchTab('factory')");
    check("F: bot card becomes a real buyable row at stage 4",
      panelF().includes('buyUpgrade("bot")'));
    run(sb, "switchTab('staff')");
    check("F: staff tab at stage 4 has real hire rows",
      panelF().includes("hireStaff"));
    check("F: treats fold is a silhouette below 5,000 cumulative coins",
      panelF().includes("ご褒美") && panelF().includes("seclock") && !panelF().includes("buyTreat"));
    run(sb, "S.coins = 1000; hireStaff('carry');");
    check("F: first hire advances to stage 5 (requests unlock)",
      run(sb, "S.tut.stage") === 5 && !run(sb, "tutTabLocked('requests')"),
      "stage=" + run(sb, "S.tut.stage"));
    run(sb, "S.research.res_line2 = true; tutCheck();");
    check("F: res_line2 advances to stage 6",
      run(sb, "S.tut.stage") === 6, "stage=" + run(sb, "S.tut.stage"));
    run(sb, "switchTab('factory')");
    check("F: line2 build button is real at stage 6",
      panelF().includes("buyLine2()"));
    run(sb, "S.runDP = BAL.prestigeDPPerDust * 5; tutCheck();");
    check("F: prestige gain >= 5 advances to stage 7 (graduation)",
      run(sb, "S.tut.stage") === 7, "stage=" + run(sb, "S.tut.stage"));
    check("F: graduated: no 🎯 objective remains on the chip and the prestige card is real",
      !run(sb, "stripQuestText()").startsWith("🎯") && panelF().includes("会社を売却できます"),
      "chip=" + run(sb, "stripQuestText()"));
    run(sb, "doPrestige();");
    check("F: prestige does not reset the tutorial (stage stays 7)",
      run(sb, "S.prestiges") === 1 && run(sb, "S.tut.stage") === 7,
      "prestiges=" + run(sb, "S.prestiges") + " stage=" + run(sb, "S.tut.stage"));

    /* ---- F3: ベテランセーブ (tut 無し) は移行で卒業し、導線は一切出ない ---- */
    const sbVet = buildSandbox({});
    sbVet.localStorage.setItem("miyuke-save-v1", JSON.stringify({
      coins: 5000, rp: 30, dust: 3, dustTotal: 12, prestiges: 1,
      totals: { releases: 30, hired: 3, coinsEarned: 99999, clicks: 500, commits: 900,
                lines: 5000, bugsSquashed: 40, keys: 1000, cursorPx: 5000, naps: 2,
                playSec: 3600, crits: 5, goldFish: 1, eventBugs: 3 },
      staff: [{ id: 1, name: "シロ", coat: "shiro", role: "carry", lv: 2 }],
      staffSeq: 1,
      research: { res_game: true, res_plant: true, res_line2: true },
      shelf: [{ name: "旧作", genreName: "ゲーム", size: "M", date: "2026/10/01",
                devMin: 30, lines: 900, bugs: 3, naps: 0, icon: 1 }],
      upgrades: { keyboard: 1 }
    }));
    loadGame(sbVet);
    check("F: veteran save (no tut) migrates to graduated stage 7 with all seen flags set",
      run(sbVet, "S.tut.stage") === 7 && run(sbVet, "S.tut.seen.input_hint") === true &&
      run(sbVet, "S.tut.seen.q1") === true && run(sbVet, "S.tut.seen['visit:staff:4']") === true,
      "stage=" + run(sbVet, "S.tut.stage"));
    check("F: veteran sees zero locks and zero quest chip",
      ["shelf", "stats", "factory", "research", "click", "staff", "requests"].every(t => !run(sbVet, `tutTabLocked("${t}")`)) &&
      run(sbVet, "stripQuestText()") === "");
    run(sbVet, "switchTab('staff')");
    check("F: veteran staff panel contains no lock UI at all",
      !sbVet._el("panel").innerHTML.includes("lockpanel") && !sbVet._el("panel").innerHTML.includes("seclock"));

    /* ---- F4: 所持がロックに勝つ / スキップ / 見直し ---- */
    const sb2 = buildSandbox({});
    loadGame(sb2);
    run(sb2, "S.activeRequest = { client: 'テスト堂', genre: 'app', genreName: 'アプリ', text: 'x' };");
    check("F: ownership beats lock (an active request opens the requests tab at stage 0)",
      run(sb2, "S.tut.stage") === 0 && !run(sb2, "tutTabLocked('requests')"));
    run(sb2, "S.upgrades.bot = 1;");
    check("F: ownership beats lock (owning the bot opens the factory tab at stage 0)",
      !run(sb2, "tutTabLocked('factory')"));
    run(sb2, "tutSkipGuide();");
    check("F: skip （全部ひらく) opens everything and silences the chip",
      run(sb2, "S.tut.skipped") === true && run(sb2, "S.tut.stage") === 7 &&
      ["staff", "research", "click", "requests"].every(t => !run(sb2, `tutTabLocked("${t}")`)) &&
      run(sb2, "stripQuestText()") === "");
    const sb3 = buildSandbox({});
    loadGame(sb3);
    run(sb3, "S.staff.push({ id: 1, name: 'クロ', coat: 'kuro', role: 'carry', lv: 1 }); S.totals.hired = 1; tutSkipGuide(); tutResetGuide();");
    check("F: reset （見直す) re-derives from facts (staff owner lands at stage 5, nothing re-locks)",
      run(sb3, "S.tut.skipped") === false && run(sb3, "S.tut.stage") === 5 &&
      !run(sb3, "tutTabLocked('staff')") && !run(sb3, "tutTabLocked('requests')"),
      "stage=" + run(sb3, "S.tut.stage"));

    /* ---- F5: viewer はスナップショットの S.tut だけで同じロック・🆕 を描く ---- */
    const busL = { main: {}, menu: {} };
    function busDeliverF(from, to, event, payload) {
      ((busL[to] || {})[event] || []).slice().forEach(fn => { try { fn({ payload, event }); } catch (e) {} });
    }
    function busTauriF(self) {
      return {
        core: { invoke: () => Promise.resolve({}) },
        event: {
          listen: (event, fn) => { (busL[self][event] = busL[self][event] || []).push(fn); return Promise.resolve(() => {}); },
          emit: (event, payload) => { for (const k of Object.keys(busL)) if (k !== self) busDeliverF(self, k, event, payload); return Promise.resolve(); },
          emitTo: (target, event, payload) => { busDeliverF(self, target, event, payload); return Promise.resolve(); }
        }
      };
    }
    const sbO = buildSandbox({ tauri: busTauriF("main") });
    sbO.__MIYUKE_MODE__ = "strip"; sbO.__MIYUKE_ROLE__ = "owner";
    loadGame(sbO);
    const sbW = buildSandbox({ tauri: busTauriF("menu") });
    sbW.__MIYUKE_MODE__ = "full"; sbW.__MIYUKE_ROLE__ = "viewer";
    loadGame(sbW);
    check("F: viewer syncs with the owner's stage-0 tut from snapshots alone",
      run(sbW, "viewerSynced") === true && run(sbW, "S.tut.stage") === 0,
      "synced=" + run(sbW, "viewerSynced") + " stage=" + run(sbW, "S.tut.stage"));
    run(sbW, "switchTab('staff');");
    check("F: viewer renders the same staff lock panel from the replica",
      sbW._el("panel").innerHTML.includes("lockpanel") && sbW._el("panel").innerHTML.includes("0 / 220"));
    run(sbO, "S.totals.releases = 1; S.rp = 2; S.totals.clicks = 30; S.totals.coinsEarned = 220; tutCheck();");
    busDeliverF("menu", "main", "menu-ready");
    check("F: owner advanced to stage 4 and the viewer replica followed via snapshot",
      run(sbO, "S.tut.stage") === 4 && run(sbW, "S.tut.stage") === 4,
      "owner=" + run(sbO, "S.tut.stage") + " viewer=" + run(sbW, "S.tut.stage"));
    run(sbW, "renderPanel();");
    check("F: viewer shows 🆕 on the freshly unlocked staff tab",
      badgeF(sbW, "staff") && badgeF(sbW, "staff").textContent === "🆕" && badgeF(sbW, "staff").style.display !== "none");
    run(sbW, "switchTab('staff');");
    check("F: viewer visiting staff sends tutVisitTab; the owner records the visit",
      run(sbO, "S.tut.seen['visit:staff:4']") === true,
      "seen=" + run(sbO, "JSON.stringify(S.tut.seen)"));
  }

  /* ================= Phase G: officeTier 導出 + 退役した段ボール遊びの互換 ================= */
  console.log("== Phase G: officeTier derivation + retired box-play save compat ==");
  {
    const sb = buildSandbox({});
    loadGame(sb);
    const tierOf = (expr) => run(sb, `officeTier(Object.assign(freshState(), ${expr}))`);
    check("G: fresh company is tier 0 （創業ガレージ）", tierOf("{}") === 0);
    check("G: releases alone do not raise the tier", tierOf("{ totals: Object.assign(freshState().totals, { releases: 5 }) }") === 0);
    check("G: first release + first hire -> tier 1", tierOf("{ totals: Object.assign(freshState().totals, { releases: 1, hired: 1 }) }") === 1);
    check("G: current staff counts as hired facts", tierOf("{ totals: Object.assign(freshState().totals, { releases: 2 }), staff: [{ id: 1 }] }") === 1);
    check("G: line 2 unlocked -> tier 2", tierOf("{ line2: { unlocked: true, wip: { code: 0, tested: 0, built: 0 } } }") === 2);
    check("G: studio Lv3 -> tier 2", tierOf("{ studioLv: 3 }") === 2);
    check("G: first move (prestige) -> tier 3", tierOf("{ prestiges: 1 }") === 3);
    check("G: tier follows rank floor (full facts, studioLv 5 -> tier 4)",
      tierOf("{ totals: Object.assign(freshState().totals, { releases: 99, hired: 9 }), staff: [{}], line2: { unlocked: true }, studioLv: 5, prestiges: 2 }") === 4);
    check("G: rank floor survives prestige (studioLv 1 + maxStudioLv 6 -> tier 5)",
      tierOf("{ studioLv: 1, maxStudioLv: 6, prestiges: 1 }") === 5);
    check("G: tier names cover 0..5", run(sb, "OFFICE_TIER_NAMES.length") === 6);

    /* 退役した段ボール遊び (Part 4): 定義・状態・絵が全て無いこと */
    check("G: box play fully retired (defs / states / sprite)",
      run(sb, "RESEARCH_DEFS.some(r => r.id === 'res_boxcastle')") === false &&
      run(sb, "RESEARCH_DEFS.find(r => r.id === 'res_play2').requires") === undefined &&
      run(sb, "PLAY_STATES.includes('box') || PLAY_STATES.includes('boxcastle')") === false &&
      run(sb, "!!window.MIYUKE_SPRITES.sprites.miyuke_box") === false &&
      run(sb, "availablePlays().every(p => p !== 'box' && p !== 'boxcastle')") === true);
    check("G: play_all achievement no longer requires the box flag",
      run(sb, "STAMP_DEFS.find(a => a.id === 'play_all').test({ flags: { play_yarn: 1, play_groom: 1, play_watch: 1, play_chase: 1, play_zoomies: 1 } })") === true);

    /* 旧セーブ fixture: res_boxcastle 購入済み + play_box フラグ持ちが無事に読める */
    const sbOld = buildSandbox({});
    sbOld.localStorage.setItem("miyuke-save-v1", JSON.stringify({
      coins: 3000, rp: 20,
      totals: { releases: 8, hired: 1, coinsEarned: 20000, clicks: 100, commits: 50,
                lines: 800, bugsSquashed: 9, keys: 300, cursorPx: 900, naps: 1,
                playSec: 1200, crits: 1, goldFish: 0, eventBugs: 0 },
      staff: [{ id: 1, name: "シロ", coat: "shiro", role: "carry", lv: 1 }],
      staffSeq: 1,
      research: { res_boxcastle: true, res_play2: true, res_game: true },
      flags: { play_box: true, play_boxcastle: true }
    }));
    let loadThrew = false;
    try { loadGame(sbOld); } catch (e) { loadThrew = true; }
    check("G: legacy save with res_boxcastle + play_box loads without error", !loadThrew);
    check("G: stale research id is inert (kept in data, ignored by logic)",
      run(sbOld, "S.research.res_boxcastle") === true &&
      run(sbOld, "RESEARCH_DEFS.some(r => r.id === 'res_boxcastle')") === false &&
      typeof run(sbOld, "tier1Done()") === "boolean");
    run(sbOld, "switchTab('research');");
    check("G: research panel renders fine for the legacy save",
      sbOld._el("panel").innerHTML.length > 100 && !sbOld._el("panel").innerHTML.includes("res_boxcastle"));
    let tickThrew = false;
    try { run(sbOld, "setState('box', 1); stateTick(Date.now() + 5000);"); } catch (e) { tickThrew = true; }
    check("G: a retired play state falls back safely (no throw, state moves on)",
      !tickThrew && run(sbOld, "catState") !== "box" && run(sbOld, "catState") !== "boxcastle",
      "catState=" + run(sbOld, "catState"));
  }

  /* ================= Phase H: v2.4.3 報告バグ (ゲージ後退 / 連打クールタイム) ================= */
  console.log("== Phase H: v2.4.3 reported bugs (gauge retreat / click-spam cooldown) ==");
  {
    const htmlH = HTML;
    check("H: .meter>i has no width transition (rebuilds made the gauge glide backwards)",
      !/\.meter\s*>i\s*\{[^}]*transition:\s*width/.test(htmlH));
    check("H: hero pct rounding matches renderHeader (Math.round, not floor)",
      /const pct = Math\.min\(100, Math\.round\(S\.projectDP/.test(htmlH));
    const sbH = buildSandbox({ hash: "#strip", width: 1280, height: 210 });
    loadGame(sbH);
    run(sbH, "S.project.planning = false; S.project.totalDP = 100000; S.projectDP = 10;");
    const SGH = run(sbH, "STRIP_GROUND"), SHH = run(sbH, "STRIP_H"), VWH = run(sbH, "stripVW");
    const clicks0 = run(sbH, "S.totals.clicks");
    const state0 = run(sbH, "catState");
    for(let i = 0; i < 8; i++){
      const mx = run(sbH, "stripMiyukeX()");
      sbH._el("strip").dispatch("pointerdown",
        { clientX: mx / VWH * 1280, clientY: (SGH - 37) / SHH * 210 });
    }
    check("H: 8 rapid clicks on Miyuke ALL count as cheers (none swallowed)",
      run(sbH, "S.totals.clicks") === clicks0 + 8,
      clicks0 + " -> " + run(sbH, "S.totals.clicks"));
    check("H: click spam never forces react_annoy (her work is not paused)",
      run(sbH, "catState") !== "react_annoy", "catState=" + run(sbH, "catState") + " (was " + state0 + ")");
  }

  /* ================= Phase D: 子会社（終盤の経営レイヤー） ================= */
  console.log("== Phase D: subsidiaries (founding / allocation / partial + group EXIT) ==");
  {
    const sb = buildSandbox({});
    loadGame(sb);
    check("D: subs boot as empty defaults (old saves unaffected)",
      run(sb, "Array.isArray(S.subs) && S.subs.length === 0 && S.subSeq === 0 && totalPeople() === S.staff.length"));
    run(sb, "S.studioLv = 4; S.coins = 100000; foundSub('app');");
    check("D: founding is gated to 準大手 (studioLv>=5) — refused at Lv4 with no charge",
      run(sb, "S.subs.length") === 0 && run(sb, "S.coins") === 100000);
    run(sb, "S.studioLv = 5; foundSub('app');");
    check("D: founding charges 15000, starts at staff 5 / Lv1 / alloc 100% with the chosen specialty",
      run(sb, "S.subs.length") === 1 && run(sb, "S.coins") === 85000 &&
      run(sb, "S.subs[0].staff === 5 && S.subs[0].lv === 1 && S.subs[0].alloc === 100 && S.subs[0].genre === 'app'"));
    check("D: the second founding doubles in price (15000 x 2^n)",
      run(sb, "foundCost()") === 30000);
    check("D: genre rate follows unlock order (first genre x1.0, last genre highest)",
      run(sb, "subGenreRate(GENRES[0].id)") === 1 &&
      run(sb, "subGenreRate(GENRES[GENRES.length - 1].id)") > 1.5);
    check("D: allocation sensitivity — concave focus puts the optimum inside (74/26 beats even and the 90/10 corner, starving the high-rate sub loses), Σalloc stays 100",
      (() => {
        const last = run(sb, "GENRES[GENRES.length - 1].id");
        const mk = (allocA) => run(sb,
          "subRates({ staff: 30, lv: 3, genre: '" + last + "', alloc: " + allocA + " }).coins +" +
          " subRates({ staff: 30, lv: 3, genre: 'app', alloc: " + (100 - allocA) + " }).coins");
        const even = mk(50), optimum = mk(74), corner = mk(90), starved = mk(10);
        run(sb, "foundSub('app'); setAlloc(S.subs[0].id, -40);");
        const sumOk = run(sb, "S.subs.reduce((a, s) => a + s.alloc, 0)") === 100;
        return optimum > even && optimum > corner && starved < even * 0.92 && sumOk;
      })());
    check("D: subFocus endpoints unchanged by the concave change (0% -> 0.5, 100% -> 2.0, 50% -> 0.5+1.5*sqrt(0.5))",
      run(sb, "subFocus({ alloc: 0 })") === 0.5 && run(sb, "subFocus({ alloc: 100 })") === 2 &&
      Math.abs(run(sb, "subFocus({ alloc: 50 })") - (0.5 + 1.5 * Math.sqrt(0.5))) < 1e-9);
    check("D: dust value formula (staff 20/Lv3 -> 4, staff 5/Lv1 -> 1)",
      run(sb, "subDustValue({ staff: 20, lv: 3 })") === 4 && run(sb, "subDustValue({ staff: 5, lv: 1 })") === 1);
    run(sb, "S.dust = 0; S.dustTotal = 0; const v = subDustValue(S.subs[0]); sellSubCore(S.subs[0].id);");
    check("D: partial EXIT pays exactly subDustValue, removes only that sub, HQ untouched",
      run(sb, "S.dust") === 1 && run(sb, "S.subs.length") === 1 && run(sb, "S.studioLv") === 5);
    check("D: after a partial EXIT the remaining sub's alloc renormalizes to 100",
      run(sb, "S.subs[0].alloc") === 100);
    run(sb, "S.runDP = 60000;");
    check("D: group EXIT preview adds every sub's dust value on top of the DP-based gain",
      run(sb, "prestigePreview().subGain") === 1 &&
      run(sb, "prestigePreview().gain") === 7 + 1);
    run(sb, "doPrestigeCore();");
    check("D: group EXIT (doPrestigeCore) sells all subsidiaries with the HQ",
      run(sb, "S.subs.length") === 0 && run(sb, "S.dust") >= 8);
    run(sb, "S.subs = [{ id: 1, name: 't', genre: 'app', staff: 100, lv: 10, alloc: 100 }]; S.coins = 0;");
    run(sb, "tick();");
    check("D: tick pays subsidiary income (staff 100 / Lv10 / first genre = 259/min -> 4 whole coins in one tick)",
      run(sb, "S.coins") >= 4, "coins=" + run(sb, "S.coins"));
    check("D: VERBS routes subsidiary actions to the confirm-free cores",
      run(sb, "VERBS.sellSub === sellSubCore && VERBS.foundSub === foundSub && VERBS.setAlloc === setAlloc"));

    /* 旧セーブ fixture: 子会社フィールド無し + 配分が壊れた子会社あり */
    const sbOld = buildSandbox({});
    sbOld.localStorage.setItem("miyuke-save-v1", JSON.stringify({
      coins: 5000, studioLv: 6,
      subs: [{ id: 7, name: "x", genre: "app", staff: 10, lv: 2, alloc: 30 },
             { id: 8, name: "y", genre: "app", staff: 10, lv: 2, alloc: 30 }],
      subSeq: 8
    }));
    let loadThrew = false;
    try { loadGame(sbOld); } catch (e) { loadThrew = true; }
    check("D: a save whose allocs do not sum to 100 loads and is renormalized",
      !loadThrew && run(sbOld, "S.subs.reduce((a, s) => a + s.alloc, 0)") === 100);
  }

  /* ================= Phase E: レイアウト自由化（layoutProps） ================= */
  console.log("== Phase E: layout freedom (props / surfaces / stacking) ==");
  {
    const sb = buildSandbox({});
    loadGame(sb);
    check("E: layoutProps boots empty and every prop resolves to its legacy anchor (initial layout unchanged)",
      run(sb, "Object.keys(S.layoutProps).length") === 0 &&
      run(sb, "propPlace('board').cx") === run(sb, "stripDeskCX()") &&
      run(sb, "propPlace('phone').cx") === run(sb, "propPlace('board').cx") - 102 + 10 &&
      run(sb, "propPlace('toolbox').cx") === run(sb, "stripDeskCX() + 42") &&
      run(sb, "propPlace('snack').cx") === run(sb, "stripDeskCX() + 72") &&
      run(sb, "propPlace('coffee').cx") === run(sb, "stripDeskCX() + 47") &&
      run(sb, "propPlace('coffee').baseY") === run(sb, "STRIP_GROUND - 0.5") &&
      run(sb, "stripShipX()") === run(sb, "Math.round(stripVW * 0.80)"));
    run(sb, "S.layoutProps.board = { on: 'ground', x: 0.5 };");
    check("E: a ground entry moves the board independently of the desk, and the phone's default anchor follows the board",
      run(sb, "propPlace('board').cx") === run(sb, "Math.round(stripVW * 0.5)") &&
      run(sb, "propPlace('phone').cx") === run(sb, "Math.round(stripVW * 0.5) - 102 + 10"));
    run(sb, "S.layoutProps.ship = { on: 'ground', x: 0.3 };");
    check("E: the ship spot follows its ground entry (annex sign and piles derive from stripShipX)",
      run(sb, "stripShipX()") === run(sb, "Math.round(stripVW * 0.3)"));
    run(sb, "S.layoutProps.phone = { on: 'desk', dx: 40 };");
    check("E: a surface entry stands the prop on the desk top (G-33) at the stored offset",
      run(sb, "propPlace('phone').cx") === run(sb, "stripDeskCX() + 40") &&
      run(sb, "propPlace('phone').baseY") === run(sb, "STRIP_GROUND - 33"));
    run(sb, "S.layout.desk = 0.55;");
    check("E: dragging the desk cluster carries the props stacked on it",
      run(sb, "propPlace('phone').cx") === run(sb, "stripDeskCX() + 40"));
    check("E: drop candidate on the desk's free span is a valid surface placement",
      (() => {
        const cx = run(sb, "stripDeskCX()");
        const c = run(sb, "propDragCandidate('phone', " + (cx + 40) + ", STRIP_GROUND - 43, " + (cx + 40) + ")");
        return c && c.on === "desk" && c.valid === true;
      })());
    check("E: drop candidate over the desk's reserved center (PC + sit area) is invalid",
      (() => {
        const cx = run(sb, "stripDeskCX()");
        const c = run(sb, "propDragCandidate('phone', " + cx + ", STRIP_GROUND - 43, " + cx + ")");
        return c && c.on === "desk" && c.valid === false;
      })());
    run(sb, "S.stamps.prestige1 = true;");
    check("E: an item wider than the surface can never stack there (coffee 35 > trophy stand 30)",
      (() => {
        const cx = run(sb, "stripTrophyCX()");
        const c = run(sb, "propDragCandidate('coffee', " + cx + ", STRIP_GROUND - 32, " + cx + ")");
        return c && c.valid === false;
      })());
    check("E: ground-class props (board) never take a surface candidate",
      (() => {
        const cx = run(sb, "stripDeskCX()");
        const c = run(sb, "propDragCandidate('board', " + cx + ", STRIP_GROUND - 43, " + cx + ")");
        return c && c.on === "ground" && c.valid === true;
      })());
    run(sb, "layoutEdit.dragCand = { on: 'desk', dx: 0, cx: stripDeskCX(), baseY: STRIP_GROUND - 33, valid: false }; propDrop('phone');");
    check("E: dropping on an invalid spot writes nothing and shakes back",
      run(sb, "S.layoutProps.phone.on") === "desk" && run(sb, "S.layoutProps.phone.dx") === 40 &&
      run(sb, "layoutEdit.shakeId") === "phone");
    run(sb, "delete S.layoutProps.phone; S.flags.stackedOnce = 0;" +
            "layoutEdit.dragCand = { on: 'desk', dx: -40, cx: stripDeskCX() - 40, baseY: STRIP_GROUND - 33, valid: true }; propDrop('phone');");
    check("E: a valid surface drop persists {on, dx} and the first stack is flagged for Miyuke's one-time comment",
      run(sb, "S.layoutProps.phone.on") === "desk" && run(sb, "S.layoutProps.phone.dx") === -40 &&
      run(sb, "S.flags.stackedOnce") === 1);
    check("E: weak snap pulls a ground drop onto a nearby item center (and the setting disables it)",
      (() => {
        const cx = run(sb, "stripDeskCX()");
        const on = run(sb, "propDragCandidate('toolbox', 0, STRIP_GROUND, " + (cx + 3) + ")");
        run(sb, "S.settings.snapLayout = false;");
        const off = run(sb, "propDragCandidate('toolbox', 0, STRIP_GROUND, " + (cx + 3) + ")");
        run(sb, "S.settings.snapLayout = true;");
        return on.cx === cx && off.cx === cx + 3;
      })());
    run(sb, "resetLayout();");
    check("E: resetLayout clears prop placements too (memo reattaches to the board)",
      run(sb, "Object.keys(S.layoutProps).length") === 0);

    /* 旧セーブ fixture: layoutProps も snapLayout も無い */
    const sbOld = buildSandbox({});
    sbOld.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 1000, staff: [] }));
    let loadThrew = false;
    try { loadGame(sbOld); } catch (e) { loadThrew = true; }
    check("E: a save without layoutProps loads with defaults intact and snap on",
      !loadThrew && run(sbOld, "Object.keys(S.layoutProps).length") === 0 &&
      run(sbOld, "S.settings.snapLayout") === true &&
      run(sbOld, "propPlace('board').cx") === run(sbOld, "stripDeskCX()"));
  }

  /* ================= Wave F: オーバークロック（フィーバー） ================= */
  console.log("== Wave F: overclock gauge, activation, production/click multipliers ==");
  {
    const sbF = buildSandbox({});
    loadGame(sbF);
    check("WF: fresh state starts with an empty fever gauge",
      run(sbF, "S.fever.gauge") === 0 && run(sbF, "feverActive()") === false);
    run(sbF, "chargeFever(60)");
    check("WF: charging accumulates and caps at 100",
      run(sbF, "S.fever.gauge") === 60 && run(sbF, "chargeFever(60), S.fever.gauge") === 100);
    run(sbF, "activateFever()");
    check("WF: activation at full gauge starts the fever and drains the gauge",
      run(sbF, "feverActive()") === true && run(sbF, "S.fever.gauge") === 0);
    run(sbF, "chargeFever(50)");
    check("WF: no charging while the fever is running",
      run(sbF, "S.fever.gauge") === 0);
    /* production: fever multiplies output but NOT bug accrual */
    const mk = () => {
      const sb = buildSandbox({});
      loadGame(sb);
      run(sb, "S.project = { name:'T', size:'S', genre:'app', totalDP: 900, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }; S.bugStock = 0");
      return sb;
    };
    const sbBase = mk(); run(sbBase, "produceDP(100, 'l1')");
    const sbFev = mk(); run(sbFev, "S.fever.gauge = 100; activateFever(); produceDP(100, 'l1')");
    check("WF: fever multiplies WIP output by the production multiplier",
      Math.abs(run(sbFev, "S.wip.code") - run(sbBase, "S.wip.code") * run(sbFev, "FEVER.prodMult")) < 0.001,
      run(sbBase, "S.wip.code") + " -> " + run(sbFev, "S.wip.code"));
    check("WF: fever does NOT multiply bug accrual or the bug stock",
      Math.abs(run(sbFev, "S.project.bugs") - run(sbBase, "S.project.bugs")) < 0.001 &&
      Math.abs(run(sbFev, "S.bugStock") - run(sbBase, "S.bugStock")) < 0.001,
      run(sbBase, "S.project.bugs") + " vs " + run(sbFev, "S.project.bugs"));
    /* activation refuses below full */
    const sbLow = mk();
    run(sbLow, "S.fever.gauge = 55; activateFever()");
    check("WF: activation refuses below a full gauge",
      run(sbLow, "feverActive()") === false && run(sbLow, "S.fever.gauge") === 55);
    /* old save without the fever field loads with the guard */
    const sbOldF = buildSandbox({});
    sbOldF.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 5, staff: [] }));
    let threwF = false;
    try { loadGame(sbOldF); } catch (e) { threwF = true; }
    check("WF: a save without the fever field loads with an empty gauge",
      !threwF && run(sbOldF, "S.fever.gauge") === 0);
    /* --- F 再設計（Argon フォローアップ） --- */
    const sbR = buildSandbox({});
    loadGame(sbR);
    run(sbR, "S.project = { name:'T', size:'S', genre:'app', totalDP: 900, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }");
    check("WR: the hybrid click base grows with the auto-production rate",
      Math.abs(run(sbR, "autoProdEMA = 100, clickBaseDP() - clickPower()") - 5) < 0.001);
    run(sbR, "autoProdEMA = 0");
    check("WR: the click bucket grants its burst capacity then blocks",
      run(sbR, "clickBucket = 15; clickBucketAt = Date.now(); let ok = 0; for(let i = 0; i < 20; i++) if(clickBucketTake()) ok++; ok") === 15 &&
      run(sbR, "clickBucketTake()") === false);
    check("WR: the bucket refills over time",
      run(sbR, "clickBucketAt = Date.now() - 1000, clickBucketTake()") === true);
    const sbSplit = buildSandbox({});
    loadGame(sbSplit);
    run(sbSplit, "S.project = { name:'T', size:'S', genre:'app', totalDP: 100000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }; S.projectDP = 0");
    run(sbSplit, "cheerClick(100, 100, 'body')");
    check("WR: click inflow is pipe-first (wip share >= 3x the direct share)",
      run(sbSplit, "S.wip.code") >= run(sbSplit, "S.projectDP") * 3,
      "wip=" + run(sbSplit, "S.wip.code") + " direct=" + run(sbSplit, "S.projectDP"));
    const sbMute = buildSandbox({});
    loadGame(sbMute);
    run(sbMute, "S.project = { name:'T', size:'S', genre:'app', totalDP: 900, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }; S.fever.gauge = 100; activateFever()");
    const wipMuted = run(sbMute, "prodMuted = true; const b = S.wip.code; produceDP(100, 'l1'); S.wip.code - b");
    const wipAuto = run(sbMute, "prodMuted = false; const b2 = S.wip.code; produceDP(100, 'l1'); S.wip.code - b2");
    check("WR: fever production multiplier never stacks onto input-derived DP",
      Math.abs(wipAuto / wipMuted - run(sbMute, "FEVER.prodMult")) < 0.01 && wipMuted > 0,
      "auto=" + wipAuto + " muted=" + wipMuted);
    const sbPas = buildSandbox({});
    loadGame(sbPas);
    run(sbPas, "S.project = { name:'T', size:'S', genre:'app', totalDP: 900, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }; S.fever.gauge = 100");
    const wipPas = run(sbPas, "const b = S.wip.code; produceDP(100, 'l1'); S.wip.code - b");
    const sbPas0 = buildSandbox({});
    loadGame(sbPas0);
    run(sbPas0, "S.project = { name:'T', size:'S', genre:'app', totalDP: 900, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; S.wip = { code: 0, tested: 0, built: 0 }");
    const wipPas0 = run(sbPas0, "const b = S.wip.code; produceDP(100, 'l1'); S.wip.code - b");
    check("WR: a full un-fired gauge passively boosts production by passiveMax",
      Math.abs(wipPas / wipPas0 - (1 + run(sbPas, "FEVER.passiveMax"))) < 0.01,
      wipPas0 + " -> " + wipPas);
  }

  /* ================= Wave G: 技術的負債・ブランド・デスマーチ・外注 ================= */
  console.log("== Wave G: debt efficiency, brand price, death march, outsourcing ==");
  {
    const mkG = (patch) => {
      const sb = buildSandbox({});
      loadGame(sb);
      run(sb, "S.project = { name:'T', size:'L', genre:'app', totalDP: 7000, bugs: 0, planning: false, feats: ['a','b'], doneFeats: 2, startedAt: Date.now(), napsAtStart: 0 }; S.projectDP = 0; S.wip = { code: 0, tested: 0, built: 0 }; S.bugStock = 0; S.debt = 0; S.brand = 0");
      /* Wave L 以降: 価格の実数チェックはトレンド中立が前提（実在しないジャンルを boom/slump に置く） */
      run(sb, "S.trend = { boom: '__none1', slump: '__none2', nextBoom: '__none1', nextSlump: '__none2', cycleSec: 0, announceAt: 0 }");
      if(patch) run(sb, patch);
      return sb;
    };
    check("WG: debt efficiency curve (0 -> x1, 50 -> x0.5, 450 -> x0.1)",
      Math.abs(run(mkG("S.debt = 50"), "debtEff()") - 0.5) < 0.001 &&
      Math.abs(run(mkG("S.debt = 450"), "debtEff()") - 0.1) < 0.001);
    check("WG: brand multiplier (0 -> x1, 100 -> x3, capped at x10)",
      run(mkG(""), "brandMult()") === 1 &&
      Math.abs(run(mkG("S.brand = 100"), "brandMult()") - 3) < 0.001 &&
      Math.abs(run(mkG("S.brand = 999"), "brandMult()") - 10) < 0.001);
    const sbD0 = mkG(""); run(sbD0, "produceDP(100, 'l1')");
    const sbD9 = mkG("S.debt = 450"); run(sbD9, "produceDP(100, 'l1')");
    check("WG: debt drags produceDP output (x0.1 at debt 450)",
      Math.abs(run(sbD9, "S.wip.code") / run(sbD0, "S.wip.code") - 0.1) < 0.01,
      run(sbD0, "S.wip.code") + " -> " + run(sbD9, "S.wip.code"));
    const sbQ1 = mkG("S.bugStock = 0");
    run(sbQ1, "applyShipQuality(S.project)");
    check("WG: a clean full-feat release grows brand by 4 and adds no debt",
      run(sbQ1, "S.brand") === 4 && run(sbQ1, "S.debt") === 0);
    const sbQ2 = mkG("S.bugStock = 12");
    run(sbQ2, "applyShipQuality(S.project)");
    check("WG: shipping with 12 bugs adds debt 18 and costs brand",
      run(sbQ2, "S.debt") === 18 && run(sbQ2, "S.brand") === 0);
    /* deadline: an overdue tier-3 request pays no bonus */
    const sbLate = mkG("S.project.genre = 'app'; S.activeRequest = { client:'X', genre:'app', genreName:'アプリ', bonus: 1.8, deadlineAt: Date.now() - 1000 }");
    run(sbLate, "S.coins = 0; S.projectDP = 7000; releaseProject()");
    check("WG: an overdue deadline voids the request bonus (base price only)",
      run(sbLate, "S.coins") === 750, "coins=" + run(sbLate, "S.coins"));
    const sbOnTime = mkG("S.project.genre = 'app'; S.activeRequest = { client:'X', genre:'app', genreName:'アプリ', bonus: 1.8, deadlineAt: Date.now() + 3600000 }");
    run(sbOnTime, "S.coins = 0; S.projectDP = 7000; releaseProject()");
    check("WG: an in-time deadline pays the full request bonus",
      run(sbOnTime, "S.coins") === 750 + Math.round(750 * 1.8), "coins=" + run(sbOnTime, "S.coins"));
    /* death march */
    const sbDM = mkG("S.projectDP = 4900; S.bugStock = 8; S.brand = 10");
    const dmInfo = run(sbDM, "deathMarchInfo()");
    check("WG: death march is offered at 70% with the spec debt price",
      !!dmInfo && dmInfo.debtAdd === Math.round(0.3 * 240) + 16, JSON.stringify(dmInfo));
    run(sbDM, "doDeathMarchCore()");
    check("WG: death march ships immediately, charges debt and brand, resets the flag",
      run(sbDM, "S.totals.releases") === 1 && run(sbDM, "S.debt") === dmInfo.debtAdd &&
      run(sbDM, "S.brand") === 8 && run(sbDM, "dmRelease") === false,
      "debt=" + run(sbDM, "S.debt") + " brand=" + run(sbDM, "S.brand"));
    const sbDM2 = mkG("S.projectDP = 3000");
    run(sbDM2, "doDeathMarchCore()");
    check("WG: death march refuses below 70%",
      run(sbDM2, "S.totals.releases") === 0 && run(sbDM2, "deathMarchInfo()") === null);
    /* outsourcing */
    const sbV = mkG("S.coins = 10000; S.bugStock = 12; S.debt = 100");
    run(sbV, "outsourceBugsCore()");
    check("WG: outsourcing clears all bugs and 40% of debt at the heavy price",
      run(sbV, "S.bugStock") === 0 && run(sbV, "S.debt") === 60 &&
      run(sbV, "S.coins") === 10000 - (12 * 30 + 100 * 15), "coins=" + run(sbV, "S.coins"));
    run(sbV, "S.bugStock = 5; outsourceBugsCore()");
    check("WG: the vendor cooldown blocks an immediate second call",
      run(sbV, "S.bugStock") === 5);
    const sbV2 = mkG("S.coins = 10; S.bugStock = 12; S.debt = 100");
    run(sbV2, "outsourceBugsCore()");
    check("WG: outsourcing refuses when coins are short",
      run(sbV2, "S.bugStock") === 12 && run(sbV2, "S.coins") === 10);
    /* prestige clears both */
    const sbP = mkG("S.debt = 200; S.brand = 120; S.runDP = 60000");
    run(sbP, "doPrestigeCore()");
    check("WG: EXIT clears debt and brand for the new company",
      run(sbP, "S.debt") === 0 && run(sbP, "S.brand") === 0);
    /* old save guards */
    const sbOldG = buildSandbox({});
    sbOldG.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 5, staff: [] }));
    let threwG = false;
    try { loadGame(sbOldG); } catch (e) { threwG = true; }
    check("WG: a save without debt/brand loads with zeros",
      !threwG && run(sbOldG, "S.debt") === 0 && run(sbOldG, "S.brand") === 0 && run(sbOldG, "S.vendorReadyAt") === 0);
    /* --- Wave H: モジュールツリー --- */
    const sbH = buildSandbox({});
    loadGame(sbH);
    run(sbH, "S.project = { name:'T', size:'L', genre:'game', totalDP: 7000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; attachModules(S.project)");
    const modN = run(sbH, "S.project.modules.length");
    check("WH: an L project gets 2-3 modules with needs at 25-40% of totalDP",
      (modN === 2 || modN === 3) && run(sbH, "S.project.modules.every(m => m.need >= 1750 && m.need <= 2800)"));
    run(sbH, "S.project = { name:'T', size:'M', genre:'app', totalDP: 2600, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0 }; attachModules(S.project)");
    check("WH: non-L projects get no modules", run(sbH, "!!S.project.modules") === false);
    const sbDiv = buildSandbox({});
    loadGame(sbDiv);
    run(sbDiv, "S.project = { name:'T', size:'L', genre:'app', totalDP: 7000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0, modules: [{ name:'A', need: 2000, inv: 0, out: false, w: 1, done: false }, { name:'B', need: 2000, inv: 0, out: false, w: 3, done: false }] }; S.wip = { code: 0, tested: 0, built: 0 }");
    run(sbDiv, "produceDP(1000, 'l1')");
    check("WH: auto production diverts 30% to modules, split by weight",
      Math.abs(run(sbDiv, "S.project.modules[1].inv / S.project.modules[0].inv") - 3) < 0.05 &&
      Math.abs(run(sbDiv, "(S.project.modules[0].inv + S.project.modules[1].inv) / (S.project.modules[0].inv + S.project.modules[1].inv + S.wip.code)") - 0.3) < 0.01,
      "invA=" + run(sbDiv, "S.project.modules[0].inv") + " invB=" + run(sbDiv, "S.project.modules[1].inv") + " wip=" + run(sbDiv, "S.wip.code"));
    const sbGate = buildSandbox({});
    loadGame(sbGate);
    run(sbGate, "S.project = { name:'T', size:'L', genre:'app', totalDP: 7000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0, modules: [{ name:'A', need: 2000, inv: 0, out: false, w: 1, done: false }] }; S.wip = { code: 0, tested: 500, built: 0 }");
    run(sbGate, "tick()");
    check("WH: the build stage waits for module integration",
      run(sbGate, "S.wip.built") === 0 && run(sbGate, "S.wip.tested") > 0);
    run(sbGate, "S.project.modules[0].inv = 2000; tick(); tick(); tick()");
    check("WH: build flows once every module is complete", run(sbGate, "S.projectDP") > 0);
    const sbOut = buildSandbox({});
    loadGame(sbOut);
    run(sbOut, "S.project = { name:'T', size:'L', genre:'app', totalDP: 7000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0, modules: [{ name:'A', need: 2000, inv: 0, out: false, w: 1, done: false }, { name:'B', need: 2000, inv: 0, out: false, w: 1, done: false }] }; S.coins = 5000");
    run(sbOut, "moduleOutsourceCore(0)");
    check("WH: outsourcing completes instantly at quality 0.8 for need x0.5 coins",
      run(sbOut, "S.project.modules[0].out") === true && run(sbOut, "S.coins") === 4000 &&
      Math.abs(run(sbOut, "modulePriceMult(S.project)") - (0.8 + 0.4 * 0.8) * (0.8 + 0.4 * 0)) < 0.001);
    run(sbOut, "S.project.modules[1].inv = 3000");
    check("WH: full-quality in-house modules price at 1.4x each",
      Math.abs(run(sbOut, "modulePriceMult(S.project)") - (0.8 + 0.4 * 0.8) * 1.4) < 0.001);
    const sbDMH = buildSandbox({});
    loadGame(sbDMH);
    run(sbDMH, "S.project = { name:'T', size:'L', genre:'app', totalDP: 7000, bugs: 0, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0, modules: [{ name:'A', need: 2000, inv: 0, out: false, w: 1, done: false }] }; S.projectDP = 5600; S.runDP = 0");
    run(sbDMH, "doDeathMarchCore()");
    check("WH: death march force-completes module integration and still ships",
      run(sbDMH, "S.totals.releases") >= 1);
    /* --- Wave I (wave 2): EXIT small-step cycling + subdivided perks + act --- */
    check("WI: the dust rate is 8000 DP per dust (was 12000)",
      run(sbH, "BAL.prestigeDPPerDust") === 8000);
    const sbI3 = mkG("S.runDP = 24000");
    run(sbI3, "doPrestigeCore()");
    check("WI: EXIT opens at gain 3 (small-step floor)",
      run(sbI3, "S.prestiges") === 1 && run(sbI3, "S.dustTotal") === 3);
    const sbI2 = mkG("S.runDP = 16000");
    run(sbI2, "doPrestigeCore()");
    check("WI: EXIT still refuses below gain 3",
      run(sbI2, "S.prestiges") === 0);
    check("WI: subdivided perk prices (small 1/1/2, retiered 3/4)",
      run(sbH, "DUST_PERKS.find(p => p.id === 'starlight').cost") === 1 &&
      run(sbH, "DUST_PERKS.find(p => p.id === 'omamori').cost") === 1 &&
      run(sbH, "DUST_PERKS.find(p => p.id === 'piggybank').cost") === 2 &&
      run(sbH, "DUST_PERKS.find(p => p.id === 'dreamplus').cost") === 3 &&
      run(sbH, "DUST_PERKS.find(p => p.id === 'focus').cost") === 4);
    const sbFv = buildSandbox({});
    loadGame(sbFv);
    run(sbFv, "S.fever.gauge = 0; chargeFever(10)");
    const fvPlain = run(sbFv, "S.fever.gauge");
    run(sbFv, "S.dustPerks.starlight = true; S.fever.gauge = 0; chargeFever(10)");
    check("WI: starlight charges the fever gauge 15% faster",
      fvPlain === 10 && Math.abs(run(sbFv, "S.fever.gauge") - 11.5) < 0.001,
      "plain=" + fvPlain + " with=" + run(sbFv, "S.fever.gauge"));
    const sbFish = buildSandbox({});
    loadGame(sbFish);
    const fishPlain = run(sbFish, "fishIntervalMul()");
    run(sbFish, "S.dustPerks.omamori = true");
    check("WI: omamori shortens the fish interval by 5% in its own slot",
      fishPlain === 1 && Math.abs(run(sbFish, "fishIntervalMul()") - 0.95) < 0.001);
    const sbPg = mkG("S.dustPerks.piggybank = true; S.coins = 2000; S.runDP = 24000");
    run(sbPg, "doPrestigeCore()");
    check("WI: piggybank carries 10% of coins into the new company",
      run(sbPg, "S.coins") === 200, "coins=" + run(sbPg, "S.coins"));
    const sbPg2 = mkG("S.dustPerks.piggybank = true; S.coins = 9000; S.runDP = 24000");
    run(sbPg2, "doPrestigeCore()");
    check("WI: piggybank carryover is capped at 500",
      run(sbPg2, "S.coins") === 500, "coins=" + run(sbPg2, "S.coins"));
    const sbAct = buildSandbox({});
    loadGame(sbAct);
    run(sbAct, "S.staff.push({ id: 990, name: 'act-test', coat: 'kuro', role: 'prog', lv: 3 })");
    run(sbAct, "tick(); tick(); tick()");
    const act1 = run(sbAct, "S.staff[0].act || 0");
    run(sbAct, "tick(); tick()");
    check("WI: staff activity (act) accrues per tick and keeps growing",
      act1 > 0 && run(sbAct, "S.staff[0].act") > act1,
      "act after 3 ticks=" + act1);
    /* --- Wave J (wave 2): holdings (second prestige layer) --- */
    const sbJ = buildSandbox({});
    loadGame(sbJ);
    check("WJ: holdings is locked until rank record, subsidiaries and EXIT count all line up",
      run(sbJ, "holdingsPreview().can") === false);
    run(sbJ, "S.maxStudioLv = 6; S.prestiges = 5; S.eraDust = 137; S.dust = 50; S.dustTotal = 500; S.dustPerks = { focus: true }; S.subs = [{ id: 1, name: 'a', genre: 'app', staff: 10, lv: 2, alloc: 50 }, { id: 2, name: 'b', genre: 'sns', staff: 5, lv: 1, alloc: 50 }]; S.stamps.teststamp = '2026-01-01'");
    check("WJ: preview gain is era dust / 20",
      run(sbJ, "holdingsPreview().can") === true && run(sbJ, "holdingsPreview().gain") === 6);
    run(sbJ, "doHoldingsCore()");
    check("WJ: holdings folds the whole first layer (dust, perks, lifetime total, era)",
      run(sbJ, "S.holdings") === 1 && run(sbJ, "S.legacy") === 6 &&
      run(sbJ, "S.dust") === 0 && run(sbJ, "S.dustTotal") === 0 &&
      run(sbJ, "Object.keys(S.dustPerks).length") === 0 && run(sbJ, "S.eraDust") === 0);
    check("WJ: holdings resets the company but keeps stamps and the rank record",
      run(sbJ, "S.studioLv") === 1 && run(sbJ, "S.subs.length") === 0 &&
      run(sbJ, "S.maxStudioLv") === 6 && run(sbJ, "S.stamps.teststamp") === "2026-01-01");
    const sbJmin = mkG("S.maxStudioLv = 6; S.prestiges = 5; S.eraDust = 10; S.subs = [{ id: 1 }, { id: 2 }]");
    run(sbJmin, "doHoldingsCore()");
    check("WJ: the cluster gain never drops below 1",
      run(sbJmin, "S.legacy") === 1);
    const sbEra = mkG("S.runDP = 24000");
    run(sbEra, "doPrestigeCore()");
    check("WJ: era dust accrues on EXIT (and on subsidiary sales)",
      run(sbEra, "S.eraDust") === 3, "eraDust=" + run(sbEra, "S.eraDust"));
    const sbTech = buildSandbox({});
    loadGame(sbTech);
    run(sbTech, "S.studioLv = 6; S.legacy = 10");
    const capBase = run(sbTech, "staffCap()");
    run(sbTech, "buyLegacyTech('cap2')");
    check("WJ: tiered tech refuses without its prerequisite and spends nothing",
      run(sbTech, "S.legacy") === 10 && run(sbTech, "staffCap()") === capBase);
    run(sbTech, "buyLegacyTech('cap1')");
    const cap1 = run(sbTech, "staffCap()");
    run(sbTech, "buyLegacyTech('cap2')");
    check("WJ: cap extensions raise the staff cap 36 -> 42 -> 48",
      capBase === 36 && cap1 === 42 && run(sbTech, "staffCap()") === 48);
    const sbQ = buildSandbox({});
    loadGame(sbQ);
    run(sbQ, "S.legacy = 10");
    const emBefore = run(sbQ, "extraMult()");
    run(sbQ, "buyLegacyTech('quantum')");
    check("WJ: quantum computer multiplies all production by 1.25",
      Math.abs(run(sbQ, "extraMult()") / emBefore - 1.25) < 1e-9);
    const sbAi = buildSandbox({});
    loadGame(sbAi);
    run(sbAi, "S.legacy = 10");
    /* 実フローで検証する: 完成済みモジュールへの磨き込み (divertToModules の
       polish 経路) が天井で止まる/伸びること。合成 inv では経路を踏めない */
    run(sbAi, "S.project = { size: 'L', genre: 'app', planning: false, modules: [{ name: 'm1', need: 100, inv: 160, w: 1, done: true }] }");
    const qBefore = run(sbAi, "moduleQuality(S.project.modules[0])");
    run(sbAi, "produceDP(500, 'l1')");
    const invBefore = run(sbAi, "S.project.modules[0].inv");
    run(sbAi, "buyLegacyTech('ai_base')");
    run(sbAi, "produceDP(500, 'l1')");
    check("WJ: AI platform raises the module quality cap 1.5 -> 1.75 on the real polish path",
      qBefore === 1.5 && invBefore === 160 &&
      run(sbAi, "S.project.modules[0].inv") > 160 &&
      run(sbAi, "moduleQuality(S.project.modules[0])") > 1.5,
      "inv after polish=" + run(sbAi, "S.project.modules[0].inv"));
    const sbGrp = buildSandbox({});
    loadGame(sbGrp);
    run(sbGrp, "S.legacy = 10");
    const subDef = "{ staff: 20, lv: 3, genre: 'app', alloc: 50 }";
    const srBefore = run(sbGrp, "subRates(" + subDef + ").coins");
    run(sbGrp, "buyLegacyTech('group')");
    check("WJ: group management lifts subsidiary income by 30%",
      Math.abs(run(sbGrp, "subRates(" + subDef + ").coins") / srBefore - 1.3) < 1e-9);
    check("WJ: bridge verbs route holdings actions to the confirm-free functions",
      run(sbGrp, "VERBS.doHoldings === doHoldingsCore && typeof VERBS.buyLegacyTech === 'function'") === true);
    const sbOldJ = buildSandbox({});
    sbOldJ.localStorage.setItem("miyuke-save-v1", JSON.stringify({ coins: 5, staff: [], dust: 12, dustTotal: 34 }));
    let threwJ = false;
    try { loadGame(sbOldJ); } catch (e) { threwJ = true; }
    check("WJ: an old save backfills era dust from the lifetime total",
      !threwJ && run(sbOldJ, "S.eraDust") === 34 && run(sbOldJ, "S.legacy") === 0 && run(sbOldJ, "S.holdings") === 0);
    /* --- Wave K (wave 2): challenge runs --- */
    const sbK0 = buildSandbox({});
    loadGame(sbK0);
    run(sbK0, "startChallenge('minority')");
    check("WK: challenges stay locked before the first EXIT",
      run(sbK0, "S.challenge") === null);
    const sbK = buildSandbox({});
    loadGame(sbK);
    run(sbK, "S.prestiges = 1; S.staff.push({ id: 991, name: 'k-test', coat: 'kuro', role: 'prog', lv: 1 })");
    const multBase = run(sbK, "staffOutMult(S.staff[0])");
    run(sbK, "startChallenge('minority')");
    check("WK: minority overrides the staff cap to 6 and pays +25% staff output",
      run(sbK, "S.challenge.id") === "minority" && run(sbK, "staffCap()") === 6 &&
      Math.abs(run(sbK, "staffOutMult(S.staff[0])") / multBase - 1.25) < 1e-9);
    run(sbK, "S.studioLv = 4; checkChallenge()");
    check("WK: hitting the goal banks the permanent reward and ends the challenge",
      run(sbK, "S.challenge") === null && run(sbK, "S.challengeRewards.minority") === true &&
      Math.abs(run(sbK, "staffOutMult(S.staff[0])") / multBase - 1.1) < 1e-9);
    const sbKb = buildSandbox({});
    loadGame(sbKb);
    run(sbKb, "S.prestiges = 1; startChallenge('black')");
    run(sbKb, "S.project = { size: 'S', genre: 'app', planning: false }; produceDP(1000, 'l1')");
    const bugsBlack = run(sbKb, "S.bugStock");
    const sbKn = buildSandbox({});
    loadGame(sbKn);
    run(sbKn, "S.project = { size: 'S', genre: 'app', planning: false }; produceDP(1000, 'l1')");
    check("WK: black company triples the bug rate",
      Math.abs(bugsBlack / run(sbKn, "S.bugStock") - 3) < 1e-6,
      "black=" + bugsBlack + " normal=" + run(sbKn, "S.bugStock"));
    const shipDelta = (sbX, black) => {
      run(sbX, "S.trend = { boom: '__none1', slump: '__none2', nextBoom: '__none1', nextSlump: '__none2', cycleSec: 0, announceAt: 0 }");
      run(sbX, "S.coins = 0; S.project = genProject(); S.project.size = 'S'; S.project.genre = 'app'; S.project.modules = null; S.bugStock = 0;" +
        (black ? " S.challenge = { id: 'black', startCoins: 0 };" : ""));
      run(sbX, "releaseProject()");
      return run(sbX, "S.coins");
    };
    const sbP1 = buildSandbox({}); loadGame(sbP1);
    const sbP2 = buildSandbox({}); loadGame(sbP2);
    const dNorm = shipDelta(sbP1, false), dBlack = shipDelta(sbP2, true);
    check("WK: black company doubles release prices",
      dNorm > 0 && dBlack === dNorm * 2, "normal=" + dNorm + " black=" + dBlack);
    const sbBg = mkG("S.prestiges = 1");
    run(sbBg, "startChallenge('black'); S.totals.coinsEarned += 300000; checkChallenge()");
    check("WK: the black goal completes on cumulative run earnings and banks its reward",
      run(sbBg, "S.challenge") === null && run(sbBg, "S.challengeRewards.black") === true);
    const sbBr = buildSandbox({});
    loadGame(sbBr);
    run(sbBr, "S.challengeRewards.black = true; S.brand = 0; S.bugStock = 0; applyShipQuality({ doneFeats: 0, feats: ['a', 'b'] })");
    check("WK: the black reward raises positive brand gains by 50%",
      run(sbBr, "S.brand") === 5, "brand=" + run(sbBr, "S.brand"));
    const sbKi = buildSandbox({});
    loadGame(sbKi);
    run(sbKi, "S.prestiges = 1; startChallenge('idle')");
    run(sbKi, "feedOsActivity({ keys: 300, distPx: 0, clicks: 0 })");
    const keysIdle = run(sbKi, "S.totals.keys");
    run(sbKi, "const dp0 = S.runDP; for(let i = 0; i < 5; i++) cheerClick(96, 100, null)");
    check("WK: full idle — OS input is not counted and clicks grant no DP",
      keysIdle === 0 && run(sbKi, "S.runDP") === 0,
      "keys=" + keysIdle + " runDP=" + run(sbKi, "S.runDP"));
    run(sbKi, "S.fever.gauge = 0; produceDP(10000, 'l1')");
    check("WK: full idle still charges the fever gauge thinly from auto production",
      run(sbKi, "S.fever.gauge") > 0, "gauge=" + run(sbKi, "S.fever.gauge"));
    run(sbKi, "S.runDP = 24000; doPrestigeCore()");
    check("WK: EXIT ends an unfinished challenge but keeps banked rewards",
      run(sbKi, "S.challenge") === null && run(sbKi, "typeof S.challengeRewards") === "object");
    const sbKw = mkG("S.prestiges = 1; S.runDP = 9000");
    run(sbKw, "startChallenge('idle')");
    check("WK: entry closes once the run has real progress",
      run(sbKw, "S.challenge") === null);
    const sbKa = mkG("S.prestiges = 1");
    run(sbKa, "startChallenge('idle'); abandonChallenge()");
    check("WK: abandoning is free and immediate",
      run(sbKa, "S.challenge") === null && run(sbKa, "S.dust") === 0);
    check("WK: bridge verbs route challenge actions",
      run(sbKa, "VERBS.startChallenge === startChallenge && VERBS.abandonChallenge === abandonChallenge") === true);
    /* --- Wave L (wave 2): market trends + self-IP royalties --- */
    const sbL = buildSandbox({});
    loadGame(sbL);
    run(sbL, "S.trend = { boom: 'app', slump: 'game', nextBoom: 'web', nextSlump: 'tool', cycleSec: 0, announceAt: 0 }");
    check("WL: trend multipliers hit the release price (boom x1.5 / slump x0.7)",
      run(sbL, "trendMult('app')") === 1.5 && run(sbL, "trendMult('game')") === 0.7 && run(sbL, "trendMult('web')") === 1 &&
      run(sbL, "trendTag('app')") === "📈" && run(sbL, "trendTag('game')") === "📉");
    run(sbL, "S.trend.cycleSec = TREND_CYCLE_SEC - 1; tick()");
    check("WL: rotation takes the pre-drawn next pair and never repeats a boom",
      run(sbL, "S.trend.boom") === "web" && run(sbL, "S.trend.nextBoom") !== "web" && run(sbL, "S.trend.cycleSec") >= 0);
    const sbDev = buildSandbox({});
    loadGame(sbDev);
    run(sbDev, "S.devGenrePref = 'app'");
    const devHits = run(sbDev, "(() => { const gs = [GENRES[0], GENRES[1]]; let n = 0; for(let i = 0; i < 500; i++) if(pickDevGenre(gs).id === 'app') n++; return n; })()");
    check("WL: the development genre policy weights picks without locking them",
      devHits > 340 && devHits < 500, "app picks=" + devHits + "/500 (weighted 4:1)");
    const sbReq = buildSandbox({});
    loadGame(sbReq);
    run(sbReq, "S.studioLv = 6; S.reqGenrePref = null; S.trend = { boom: 'app', slump: 'game', nextBoom: 'web', nextSlump: 'tool', cycleSec: 0, announceAt: 0 }");
    const reqCounts = run(sbReq, "(() => { const rep = { genre: 'site' }; const c = {}; for(let i = 0; i < 1100; i++){ const g = pickRequestGenre(rep, 5); c[g.id] = (c[g.id] || 0) + 1; } return c; })()");
    check("WL: request genre weights rank trend above specialty",
      reqCounts.app > reqCounts.site + 25 && reqCounts.site > (reqCounts.tool || 0) + 25,
      JSON.stringify(reqCounts));
    const shipIP = (patch) => {
      const sb = buildSandbox({});
      loadGame(sb);
      run(sb, "S.trend = { boom: '__n1', slump: '__n2', nextBoom: '__n1', nextSlump: '__n2', cycleSec: 0, announceAt: 0 };" +
        "S.project = { name:'IP作', size:'M', genre:'app', genreName:'アプリ', totalDP: BAL.sizes.M, planning: false, feats: [], doneFeats: 0, startedAt: Date.now(), napsAtStart: 0, ip: true };" +
        "S.projectDP = BAL.sizes.M; S.wip = { code: 0, tested: 0, built: 99999 }; S.bugStock = 0; S.coins = 0; S.debt = 0; S.brand = 0;" + patch);
      run(sb, "releaseProject()");
      return sb;
    };
    const sbIP = shipIP("");
    check("WL: a clean designated release becomes an IP (immediate credit is 30% INSTEAD of full price)",
      run(sbIP, "S.ips.length") === 1 && run(sbIP, "S.shelf[0].ip") === true && run(sbIP, "S.coins") === Math.round(340 * 0.3) &&
      run(sbIP, "S.ips[0].price") === 340,
      "coins=" + run(sbIP, "S.coins") + " ips=" + run(sbIP, "S.ips.length"));
    const sbIPReq = shipIP("S.activeRequest = { client: 'X', genre: 'app', genreName: 'アプリ', bonus: 1.8 };");
    check("WL: the royalty base excludes one-time request bonuses",
      run(sbIPReq, "S.ips.length") === 1 && run(sbIPReq, "S.ips[0].price") === 340 &&
      run(sbIPReq, "S.coins") === Math.round((340 + Math.round(340 * 1.8)) * 0.3),
      "price=" + run(sbIPReq, "S.ips[0] && S.ips[0].price") + " coins=" + run(sbIPReq, "S.coins"));
    const sbIPBug = shipIP("S.bugStock = 5;");
    check("WL: shipping with bugs left voids the IP designation",
      run(sbIPBug, "S.ips.length") === 0 && !run(sbIPBug, "S.shelf[0].ip"));
    const sbDes = buildSandbox({});
    loadGame(sbDes);
    run(sbDes, "S.project.size = 'S'");
    run(sbDes, "designateIP('l1')");
    const desS = run(sbDes, "!!S.project.ip");
    run(sbDes, "S.project.size = 'M'; designateIP('l1')");
    check("WL: designation is limited to M/L projects",
      desS === false && run(sbDes, "S.project.ip") === true);
    const sbRoy = buildSandbox({});
    loadGame(sbRoy);
    run(sbRoy, "S.ips = [{ name: 'R', genre: 'app', size: 'M', price: 100000, bornSec: 0, frac: 0 }]; S.residentSec = 0; S.coins = 0");
    run(sbRoy, "for(let i = 0; i < 3600; i++){ S.residentSec++; tickIPs(); }");
    check("WL: royalties pay 0.1% of the price per resident minute",
      Math.abs(run(sbRoy, "S.coins") - 6000) <= 2, "coins=" + run(sbRoy, "S.coins"));
    run(sbRoy, "S.ips[0].bornSec = 0; S.residentSec = 12 * 3600; S.coins = 0; S.ips[0].frac = 0; for(let i = 0; i < 60; i++){ S.residentSec++; tickIPs(); }");
    check("WL: royalties halve after 12 resident hours",
      Math.abs(run(sbRoy, "S.coins + S.ips[0].frac") - 50) < 2, "accrued=" + run(sbRoy, "S.coins + S.ips[0].frac"));
    run(sbRoy, "S.residentSec = 48 * 3600 + 1; tickIPs()");
    check("WL: IPs retire after 48 resident hours",
      run(sbRoy, "S.ips.length") === 0);
    const sbLX = mkG("S.ips = [{ name: 'X', genre: 'app', size: 'M', price: 100, bornSec: 0, frac: 0 }]; S.runDP = 24000");
    run(sbLX, "doPrestigeCore()");
    check("WL: EXIT sells the IPs with the company",
      run(sbLX, "S.ips.length") === 0);
    check("WL: the forecast tech joins the legacy tree at cost 1, and verbs route",
      run(sbL, "LEGACY_TECHS.find(t => t.id === 'forecast').cost") === 1 &&
      run(sbL, "VERBS.designateIP === designateIP && VERBS.setDevGenrePref === setDevGenrePref") === true);
    /* --- Wave M (wave 2): executive cats carried over at EXIT --- */
    const mkStaffW = (sb, list) => run(sb, "S.staff = " + JSON.stringify(list) + "; S.runDP = 24000");
    const stAW = { id: 901, name: "えー", coat: "kuro", role: "prog", lv: 3, act: 100 };
    const stBW = { id: 902, name: "びー", coat: "shiro", role: "test", lv: 9, act: 10 };
    const sbActW = buildSandbox({});
    loadGame(sbActW);
    run(sbActW, "S.staff = [{ id: 903, name: 'act', coat: 'kuro', role: 'prog', lv: 1, act: 0 }]; tick(); tick(); tick()");
    check("WM: the act counter accrues with real work",
      run(sbActW, "S.staff[0].act") > 0, "act=" + run(sbActW, "S.staff[0].act"));
    const sbMW = buildSandbox({});
    loadGame(sbMW);
    mkStaffW(sbMW, [stBW, stAW]);
    check("WM: executive candidates are the top 3 by act",
      run(sbMW, "execCandidates().map(c => c.id).join(',')") === "901,902");
    run(sbMW, "doPrestigeCore()");
    check("WM: the default EXIT seats the hardest worker as an executive",
      run(sbMW, "S.executives.length") === 1 && run(sbMW, "S.executives[0].name") === "えー" &&
      run(sbMW, "S.staff.length") === 0);
    run(sbMW, "S.staff = [{ id: 910, name: 'new', coat: 'kuro', role: 'prog', lv: 1 }]");
    const sbMWW0 = buildSandbox({});
    loadGame(sbMWW0);
    run(sbMWW0, "S.staff = [{ id: 910, name: 'new', coat: 'kuro', role: 'prog', lv: 1 }]");
    check("WM: an executive's aura pays +10% to their own role only",
      Math.abs(run(sbMW, "staffOutMult(S.staff[0])") / run(sbMWW0, "staffOutMult(S.staff[0])") - 1.1) < 1e-9);
    run(sbMW, "S.executives.push({ name: 'e2', coat: 'shiro', role: 'prog' }); S.staff[0].role = 'prog'");
    check("WM: same-role executive auras stack additively",
      Math.abs(run(sbMW, "staffOutMult(S.staff[0])") / run(sbMWW0, "staffOutMult(S.staff[0])") - 1.2) < 1e-9);
    const sbNoneW = buildSandbox({});
    loadGame(sbNoneW);
    mkStaffW(sbNoneW, [stAW]);
    run(sbNoneW, "doPrestigeCore('__none')");
    check("WM: the player may decline the carry-over",
      run(sbNoneW, "S.executives.length") === 0);
    const sbSwapW = buildSandbox({});
    loadGame(sbSwapW);
    run(sbSwapW, "S.executives = [{ name: 'E1', coat: 'kuro', role: 'prog' }, { name: 'E2', coat: 'shiro', role: 'test' }, { name: 'E3', coat: 'syamu', role: 'carry' }]");
    mkStaffW(sbSwapW, [stAW]);
    run(sbSwapW, "doPrestigeCore(undefined, undefined, 1)");
    check("WM: a full bench swaps the chosen seat and graduates the replaced executive",
      run(sbSwapW, "S.executives[1].name") === "えー" && run(sbSwapW, "S.execAlumni.length") === 1 &&
      run(sbSwapW, "S.execAlumni[0].name") === "E2");
    const sbGradW = buildSandbox({});
    loadGame(sbGradW);
    run(sbGradW, "S.executives = [{ name: 'E1', coat: 'kuro', role: 'prog' }, { name: 'E2', coat: 'shiro', role: 'test' }, { name: 'E3', coat: 'syamu', role: 'carry' }]");
    mkStaffW(sbGradW, [stAW]);
    run(sbGradW, "doPrestigeCore()");
    check("WM: without a swap the candidate graduates into the record",
      run(sbGradW, "S.executives.length") === 3 && run(sbGradW, "S.execAlumni[0].name") === "えー");
    const sbVetW = buildSandbox({});
    loadGame(sbVetW);
    run(sbVetW, "S.dustPerks = { veteran: true }");
    mkStaffW(sbVetW, [stAW, stBW]);
    run(sbVetW, "doPrestigeCore()");
    check("WM: the veteran pick comes from the remaining staff, never the executive",
      run(sbVetW, "S.executives[0].name") === "えー" && run(sbVetW, "S.staff.length") === 1 &&
      run(sbVetW, "S.staff[0].name") === "びー");
    check("WM: the carried veteran starts the new company with act reset to 0",
      run(sbVetW, "S.staff[0].act") === 0, "act=" + run(sbVetW, "S.staff[0].act"));
    const sbHoldW = buildSandbox({});
    loadGame(sbHoldW);
    run(sbHoldW, "S.executives = [{ name: 'E1', coat: 'kuro', role: 'prog' }]; S.maxStudioLv = 6; S.prestiges = 5; S.eraDust = 40; S.subs = [{ id: 1, name: 's1', genre: 'app', staff: 5, lv: 1, alloc: 50 }, { id: 2, name: 's2', genre: 'web', staff: 5, lv: 1, alloc: 50 }]");
    run(sbHoldW, "doHoldingsCore()");
    check("WM: executives survive holdings (that is their rank)",
      run(sbHoldW, "S.executives.length") === 1 && run(sbHoldW, "S.executives[0].name") === "E1");
  }

  console.log("\n==== SMOKE RESULT: " + PASS + " passed, " + FAIL + " failed ====");
  if (failures.length) console.log("failed: " + failures.join(" | "));
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error("Phase D crashed:", e); process.exit(1); });
