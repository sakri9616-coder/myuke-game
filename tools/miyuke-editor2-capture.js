/* Disposable, deterministic browser evidence for the menu art pass.
   node tools/miyuke-editor2-capture.js --before=/path/to/pre-pass.html --tag=rev2
   Self-check mode for verify-all (single version, no second file needed):
   node tools/miyuke-editor2-capture.js --self --tag=verify --outdir=/path/to/dir
   In --self mode, before defaults to the current build (desktop/dist/index.html), so the
   before/after comparison becomes a determinism + menu-health check: any
   pageerror, broken hire fold, horizontal overflow, or newly-scrolling tab
   in the CURRENT menu fails the run. --outdir defaults to the project root
   (historical behavior); verify-all passes its own log directory.
   Requires Playwright and Chromium; never reads or writes the player's save.
   Optional: MIYUKE_PLAYWRIGHT_MODULE / MIYUKE_CHROME_PATH for local installs. */
"use strict";
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const root = path.resolve(__dirname, "..");
const arg = name => (process.argv.find(x => x.startsWith("--" + name + "=")) || "").split("=").slice(1).join("=");
const self = process.argv.includes("--self");
const outdir = arg("outdir");
let before = arg("before");
const currentHtml = require("./game-html.cjs").gameHtmlPath();
if(self && !before) before = currentHtml;
const tag = arg("tag") || new Date().toISOString().replace(/[:.]/g, "-");
if(!before || !fs.existsSync(before)) throw new Error("Supply --before=/path/to/pre-pass.html (or --self to compare the current game against itself)");
if(!/^[\w-]+$/.test(tag)) throw new Error("Use letters, digits, underscores or hyphens in --tag");
let chromium;
for(const modulePath of [process.env.MIYUKE_PLAYWRIGHT_MODULE, "playwright", "/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright"].filter(Boolean)){
  try{ ({ chromium } = require(modulePath)); break; }catch{}
}
if(!chromium) throw new Error("Playwright is unavailable; set MIYUKE_PLAYWRIGHT_MODULE to an installed copy");
const tabs = ["proj", "staff", "factory", "click", "shelf", "requests", "research", "stats", "settings"];
// Same veteran facts as menu-ide-after-*-rev1.png; fixed project removes RNG drift.
const veteran = {
  coins:5000, rp:30, dust:3, dustTotal:12, prestiges:1,
  totals:{releases:30,hired:3,coinsEarned:99999,clicks:500,commits:900,lines:5000,bugsSquashed:40,keys:1000,cursorPx:5000,naps:2,playSec:3600,crits:5,goldFish:1,eventBugs:3},
  staff:[{id:1,name:"シロ",coat:"shiro",role:"carry",lv:2}], staffSeq:1,
  research:{res_game:true,res_plant:true,res_line2:true}, upgrades:{keyboard:1},
  shelf:[{name:"旧作",genreName:"ゲーム",size:"M",date:"2026/10/01",devMin:30,lines:900,bugs:3,naps:0,icon:1}]
};
const outBase = outdir ? path.resolve(outdir) : root;
if(outdir) fs.mkdirSync(outBase, {recursive:true});
const out = name => path.join(outBase, "menu-editor2-" + name + "-" + tag);
for(const version of ["before", "after"]){
  for(const tab of [...tabs, "lock"]){
    if(fs.existsSync(out(version + "-" + tab) + ".png")) throw new Error("Choose a new --tag; evidence must not be overwritten");
  }
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "miyuke-editor2-capture-"));
fs.copyFileSync(before, path.join(tmp, "before.html"));
fs.copyFileSync(currentHtml, path.join(tmp, "after.html"));
async function measure(page){
  return page.evaluate(() => {
    const panel = document.getElementById("panel"), rect = panel.getBoundingClientRect();
    const text = [], walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const n = walker.currentNode, e = n.parentElement;
      if(!n.textContent.trim() || !e || e.closest("script,style,[aria-hidden='true']") || !e.getClientRects().length) continue;
      text.push({text:n.textContent.trim(),size:parseFloat(getComputedStyle(e).fontSize)});
    }
    return {clientHeight:panel.clientHeight,scrollHeight:panel.scrollHeight,height:rect.height,top:rect.top,
      scrollFree:panel.scrollHeight<=panel.clientHeight+1,horizontalOverflow:panel.scrollWidth>panel.clientWidth+1,
      pageOverflow:document.documentElement.scrollWidth>innerWidth,headerHeight:document.querySelector("header").offsetHeight,
      controls:[...document.querySelectorAll("#tabs button,#panel button,#panel input,#panel select,#panel textarea")].map(e=>({
        tag:e.tagName,id:e.id,text:e.textContent,click:e.getAttribute("onclick"),disabled:e.disabled})),text};
  });
}
async function main(){
  const executablePath = process.env.MIYUKE_CHROME_PATH || (fs.existsSync("/opt/meta-chromium/chrome") ? "/opt/meta-chromium/chrome" : undefined);
  let browser;
  const result = {viewport:{width:1180,height:860},before:{},after:{},errors:[]};
  try{
    // NOTE: --disable-crashpad-for-testing is deliberately NOT passed here.
    // It hangs page.goto on this Chromium build (/opt/meta-chromium/chrome);
    // strip-capture.js hit the same hang on 2026-10-25 and removing the flag
    // fixed it. Self-mode reproduced the hang before this change.
    browser = await chromium.launch({executablePath,headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
    for(const version of ["before", "after"]){
      for(const locked of [false, true]){
        const context = await browser.newContext({viewport:result.viewport,deviceScaleFactor:1});
        await context.addInitScript(({seed}) => {
          localStorage.clear(); localStorage.setItem("miyuke-save-v1",JSON.stringify(seed));
          let rng=123456789;
          Math.random=()=>((rng=(rng*1664525+1013904223)>>>0)/4294967296);
          Date.now=()=>1792921260000;
          window.setInterval=()=>0;
        },{seed:locked?{tut:{stage:0,seen:{},skipped:false}}:veteran});
        const page = await context.newPage();
        page.on("pageerror", e => result.errors.push(version+": "+e.message));
        await page.goto("file://" + path.join(tmp,version+".html"),{waitUntil:"domcontentloaded",timeout:20000}); await page.waitForTimeout(1200);
        await page.evaluate(async () => { await document.fonts.ready; });
        if(!locked) await page.evaluate(() => {
          S.project={...S.project,name:"コロコロ記録アプリプラス",genreName:"アプリ",size:"S",totalDP:900,
            desc:"ご機嫌な時間をログに残す",planning:true,ideaCost:2,doneFeats:0,
            feats:["通知機能","ログイン画面","ダークモード","ウィジェット","データ保存"]};
          S.ideas=0; S.projectDP=0; S.concentration=100;
          lastSayText="おはよ〜！ おかえりなにゃ。続きやるね";
        });
        for(const tab of locked?["lock"]:tabs){
          await page.evaluate(tab => {
            switchTab(tab==="lock"?"staff":tab); renderPanel(); renderHeader();
            document.getElementById("panel").scrollTop=0;
          },tab);
          result[version][tab] = await measure(page);
          await page.screenshot({path:out(version+"-"+tab)+".png",animations:"disabled"});
        }
        if(!locked){
          await page.evaluate(() => switchTab("staff"));
          await page.locator("[data-fold='hire'] .fold-head").click();
          if(!await page.locator("[data-fold='hire'] .fold-body").isVisible()) result.errors.push(version+": hire fold did not open");
          await page.locator("[data-fold='hire'] .fold-head").click();
          if(await page.locator("[data-fold='hire'] .fold-body").isVisible()) result.errors.push(version+": hire fold did not close");
        }
        await context.close();
      }
    }
    for(const tab of [...tabs,"lock"]){
      const a=result.before[tab], b=result.after[tab];
      if(JSON.stringify(a.controls)!==JSON.stringify(b.controls)) result.errors.push(tab+": controls differ");
      for(let i=0;i<a.text.length;i++){
        if(a.text[i]?.text===b.text[i]?.text && b.text[i].size<a.text[i].size) result.errors.push(tab+": font size reduced: "+b.text[i].text);
      }
      if(b.horizontalOverflow || b.pageOverflow) result.errors.push(tab+": horizontal overflow");
      if(a.scrollFree && !b.scrollFree) result.errors.push(tab+": newly scrolling");
      if(b.scrollHeight>a.scrollHeight+16) result.errors.push(tab+": content grew more than 16px");
      console.log(`${tab}: ${a.scrollHeight}/${a.clientHeight} -> ${b.scrollHeight}/${b.clientHeight} px (scroll/client)`);
    }
    fs.writeFileSync(out("measurements")+".json",JSON.stringify(result,null,2));
    if(result.errors.length){ console.error(result.errors.join("\n")); process.exitCode=1; }
  }finally{ if(browser) await browser.close(); fs.rmSync(tmp,{recursive:true,force:true}); }
}
main().catch(e=>{console.error("Capture could not complete:\n"+e.message);process.exitCode=1;});
