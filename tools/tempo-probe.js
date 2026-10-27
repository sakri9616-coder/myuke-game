#!/usr/bin/env node
/* テンポ測定（2026-10-27・sakuri 目標「秒5クリックで20分張り付けば高効率な売却に届く」）
   実ゲームのビルドを Playwright の時計の早回しで動かし、新規の会社で
   「秒5回クリック＋ゲームの詰まりの助言どおりに買う」張り付きプレイを続けたときの
   runDP・売却で得る星屑・コインを記録する。balance-sim の模型ではなく実コードを測る。

   使い方: node tools/tempo-probe.js [--html=/path/game.html] [--min=20] [--cps=5] [--seed=save.json] [--buy=hint|none]
   目標: 20 分で星屑 20 個（BAL.dustSoftcap ＝伸びが鈍る境目。runDP = 20 × prestigeDPPerDust）
   html を省くと desktop/dist/index.html（node game/build.mjs の出力）を使う */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const arg = (name, def) => { const a = process.argv.find(x => x.startsWith("--" + name + "=")); return a ? a.split("=").slice(1).join("=") : def; };
const html = path.resolve(arg("html", path.join(__dirname, "..", "desktop", "dist", "index.html")));
const minutes = +arg("min", 20), cps = +arg("cps", 5), buy = arg("buy", "hint");
const seedPath = arg("seed", "");
if(!fs.existsSync(html)) throw new Error("game html not found: " + html + "（先に node game/build.mjs）");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 210 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.clock.install({ time: new Date("2026-10-27T09:00:00+09:00") });
  if(seedPath){
    const seed = fs.readFileSync(seedPath, "utf8");
    await page.addInitScript(s => { try{ localStorage.setItem("miyuke-save-v1", s); }catch(e){} }, seed);
  }
  await page.goto("file://" + html);
  await page.clock.runFor(1500);
  /* 描画は測定に関係しないので止める（早回しが数倍速くなる）。--render で残す */
  if(!process.argv.includes("--render")) await page.evaluate(() => { window.render = () => {}; window.requestAnimationFrame = () => 0; });
  /* --tweak='BAL.coinBase.S*=10;...' で数値を仮に変えて測る（実験用。ゲームには残らない） */
  const tweak = arg("tweak", "");
  if(tweak) await page.evaluate(t => { (0, eval)(t); }, tweak);

  await page.evaluate(({ cps, buy }) => {
    const w = window;
    w.__probe = { buys: [], releases: 0 };
    /* 秒 cps 回、帯のみゅけを応援クリック（実プレイヤーと同じ cheerClick の入口） */
    setInterval(() => { cheerClick(400, 150); noteInput(); }, Math.round(1000 / cps));
    if(buy === "none") return;
    /* 買い方（コイン）: ゲーム自身の詰まりの助言（bottleneckFix）を最優先。助言の品が買えないうちは、
       その 1/4 以下の安い物だけ先に買う。助言が無いときは一番安い物を買う。研究は買えたら買う */
    const costOf = key => {
      const [kind, id] = key.split(":");
      if(kind === "up"){ const d = UPGRADE_DEFS.find(u => u.id === id); const lv = S.upgrades[id] || 0; return d && lv < d.max ? upgradeCost(d, lv) : Infinity; }
      if(kind === "hire") return S.staff.length < staffCap() ? hireCost(id) : Infinity;
      if(kind === "studio") return S.studioLv < STAFF_CAPS.length ? studioCost(S.studioLv) : Infinity;
      return Infinity;
    };
    const doBuy = key => {
      const [kind, id] = key.split(":");
      const before = S.coins;
      if(kind === "up") buyUpgrade(id);
      else if(kind === "hire") hireStaff(id); else if(kind === "studio") buyStudio();
      if(S.coins < before) w.__probe.buys.push([Math.round(S.totals.playSec), key, Math.round(before - S.coins)]);
      return S.coins < before;
    };
    setInterval(() => {
      for(let guard = 0; guard < 20; guard++){
        const cands = UPGRADE_DEFS.map(d => "up:" + d.id)
          .concat(["hire:prog", "hire:test", "hire:carry"])
          .concat(S.staff.length >= staffCap() ? ["studio:"] : []);
        const fx = (typeof bottleneckFix === "function") ? bottleneckFix() : null;
        let fixKey = fx && fx.fix ? fx.fix.replace(/^up:/, "up:").replace(/^hire:/, "hire:") : null;
        if(fixKey && S.staff.length >= staffCap() && fixKey.startsWith("hire:")) fixKey = "studio:";
        const fixCost = fixKey ? costOf(fixKey) : Infinity;
        let pick = null;
        if(fixKey && fixCost <= S.coins) pick = fixKey;
        else {
          let best = null, bc = Infinity;
          for(const k of cands){ const c = costOf(k); if(c < bc){ bc = c; best = k; } }
          if(best && bc <= S.coins && (fixCost === Infinity || bc <= fixCost / 4)) pick = best;
        }
        if(!pick || !doBuy(pick)) break;
      }
      /* 応援強化は応援P（クリックで貯まる別の財布）で買う: 肉球とグローブを安い方から */
      for(let guard = 0; guard < 20; guard++){
        const ids = ["paw", "glove", "uchiwa"].filter(id => { const d = CLICK_DEFS.find(u => u.id === id); return d && (S.clickUp[id] || 0) < d.max; });
        if(!ids.length) break;
        const cost = id => clickCost(CLICK_DEFS.find(u => u.id === id), S.clickUp[id] || 0);
        const id = ids.sort((a, b) => cost(a) - cost(b))[0];
        if((S.cheerP || 0) < cost(id)) break;
        buyClickUp(id); w.__probe.buys.push([Math.round(S.totals.playSec), "click:" + id, cost(id)]);
      }
      for(const r of RESEARCH_DEFS){
        if(!S.research[r.id] && (!r.requires || S.research[r.requires]) && S.rp >= r.cost) buyResearch(r.id);
      }
    }, 2000);
  }, { cps, buy });

  const rows = [];
  for(let m = 1; m <= minutes; m++){
    await page.clock.runFor(60000);
    const r = await page.evaluate(() => ({
      runDP: S.runDP, coins: S.coins, dust: dustGainFromDP(S.runDP), shipped: (S.shelf || []).length,
      studio: S.studioLv, staff: S.staff.length, clicks: S.totals.clicks,
      proj: S.project ? S.project.size + " " + Math.round(S.projectDP) + "/" + Math.round(S.project.totalDP) : "-",
      autoPerMin: Math.round(productionRate())
    }));
    rows.push(Object.assign({ min: m }, r));
    if(m % 2 === 0 || m === minutes)
      console.log(`${String(m).padStart(3)}分 runDP ${Math.round(r.runDP).toLocaleString().padStart(9)} / 星屑 ${String(r.dust).padStart(3)} / コイン ${Math.round(r.coins).toLocaleString().padStart(8)} / 出荷 ${r.shipped} / 社格 ${r.studio}・${r.staff}人 / 自動 ${r.autoPerMin}DP/分 / 作品 ${r.proj}`);
  }
  const last = rows[rows.length - 1];
  const bal = await page.evaluate(() => ({ per: BAL.prestigeDPPerDust, soft: BAL.dustSoftcap }));
  const target = bal.per * bal.soft;
  console.log(`結果: ${minutes}分・秒${cps}クリック（${last.clicks} 回）で runDP ${Math.round(last.runDP).toLocaleString()}（目標 ${target.toLocaleString()} の ${(last.runDP / target * 100).toFixed(0)}%）・星屑 ${last.dust}（目標 ${bal.soft}）`);
  const probe = await page.evaluate(() => window.__probe);
  console.log("買った物（先頭 30）: " + probe.buys.slice(0, 30).map(b => Math.round(b[0] / 60) + "分 " + b[1]).join(", "));
  if(errors.length) console.log("ページのエラー: " + errors.slice(0, 3).join(" | "));
  await browser.close();
})();
