/* strip-capture.js — Playwright でビルド済みゲーム (desktop/dist/index.html)#strip を開き、帯（既定 1280×266）の
   スクリーンショットを撮る。検証の常設化（tools/verify-all.sh）の一部。
   既存のプレイヤーセーブは読まない（新規プロファイルで開くため常に新規セーブ）。
   既存ファイルへの上書きはしない（証拠は常に新規ファイル名にする運用）。
   使い方: node tools/strip-capture.js --out=/path/to.png [--width=1280] [--height=266] [--wait=3000]
     [--seed=/path/to/save.json]
   --seed を渡すと、その JSON を localStorage の miyuke-save-v1 として先に投入してから
   開く（進行後状態の帯撮影用。load() が既定値マージで補完するため部分セーブでよい）。
   渡さない場合は従来どおり新規セーブ（新規プロファイルで既存セーブを読まない）。
   依存: Playwright + Chromium（miyuke-editor2-capture.js と同じ解決順）。
   終了コード: 0 = 撮影成功かつ JS エラーなし、1 = それ以外。 */
"use strict";
const fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "..");
const arg = name => (process.argv.find(x => x.startsWith("--" + name + "=")) || "").split("=").slice(1).join("=");
const out = arg("out");
const width = parseInt(arg("width") || "1280", 10);
const height = parseInt(arg("height") || "266", 10);
const waitMs = parseInt(arg("wait") || "3000", 10);
const seedPath = arg("seed");
let seedJson = null;
if (seedPath) {
  if (!fs.existsSync(seedPath)) throw new Error("Seed file not found: " + seedPath);
  seedJson = fs.readFileSync(seedPath, "utf8");
  JSON.parse(seedJson); // 早期に形だけ検証する（中身の妥当性は load() の既定値マージに委ねる）
}
if (!out) throw new Error("Supply --out=/path/to.png");
if (fs.existsSync(out)) throw new Error("Refusing to overwrite existing file: " + out);
let chromium;
for (const modulePath of [process.env.MIYUKE_PLAYWRIGHT_MODULE, "playwright", "/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright"].filter(Boolean)) {
  try { ({ chromium } = require(modulePath)); break; } catch {}
}
if (!chromium) throw new Error("Playwright is unavailable; set MIYUKE_PLAYWRIGHT_MODULE to an installed copy");
async function main() {
  const executablePath = process.env.MIYUKE_CHROME_PATH || (fs.existsSync("/opt/meta-chromium/chrome") ? "/opt/meta-chromium/chrome" : undefined);
  const errors = [];
  // NOTE: --disable-crashpad-for-testing hangs navigation with this Chromium build
  // (goto never resolves); verified by A/B on 2026-10-25. Do not re-add it.
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({ viewport: { width, height } });
    if (seedJson) {
      await context.addInitScript(({ seed }) => {
        localStorage.clear();
        localStorage.setItem("miyuke-save-v1", seed);
      }, { seed: seedJson });
    }
    const page = await context.newPage();
    page.on("pageerror", e => errors.push("pageerror: " + (e && e.message)));
    page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
    // NOTE: waitUntil "load" never fires for this page (as in miyuke-editor2-capture.js);
    // domcontentloaded is the established working condition.
    await page.goto("file://" + require("./game-html.cjs").gameHtmlPath() + "#strip", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(waitMs);
    const info = await page.evaluate(() => {
      const canvas = document.getElementById("strip");
      return {
        stripClass: document.body.classList.contains("strip"),
        canvasFound: !!canvas,
        canvasW: canvas ? canvas.width : null,
        canvasH: canvas ? canvas.height : null,
      };
    });
    if (!info.stripClass) errors.push("body.strip class missing (not in strip mode)");
    if (!info.canvasFound) errors.push("canvas#strip not found");
    await page.screenshot({ path: out });
    const size = fs.statSync(out).size;
    if (!size) errors.push("screenshot is empty");
    console.log("STRIP_CAPTURE " + (errors.length ? "FAIL" : "OK") +
      " out=" + out + " bytes=" + size + " seed=" + (seedPath || "fresh") +
      " strip=" + info.stripClass + " canvas=" + info.canvasW + "x" + info.canvasH +
      " errors=" + errors.length);
    if (errors.length) { for (const e of errors) console.log("  error: " + e); process.exitCode = 1; }
  } finally {
    await browser.close();
  }
}
main().catch(e => { console.error("STRIP_CAPTURE FAIL: " + (e && e.stack || e)); process.exit(1); });
