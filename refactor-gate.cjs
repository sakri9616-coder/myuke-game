/* refactor-gate.cjs — per-stage verification gate for the Opus refactor run.
   Runs the smoke test and balance sim against THIS worktree (the rig
   defaults to the main tree, so the env override is set here).
   Exit 0 = GATE PASS, 1 = GATE FAIL. */
const { spawnSync } = require("child_process");
const path = require("path");
const ROOT = __dirname;
const env = {
  ...process.env,
  MIYUKE_GAME_HTML: path.join(ROOT, "game", "index.html"),
  MIYUKE_DESK: path.join(ROOT, "desktop") + "/",
};
function run(file) {
  const r = spawnSync("node", [path.join(ROOT, "tools", file)], {
    env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
let ok = true;
const smoke = run("miyuke-smoke.js");
const m = smoke.out.match(/SMOKE RESULT: (\d+) passed, (\d+) failed/);
console.log(m ? `SMOKE: ${m[1]} passed, ${m[2]} failed` : "SMOKE: summary line not found");
if (smoke.code !== 0 || !m || m[2] !== "0") { ok = false; console.log("SMOKE GATE: FAIL"); console.log(smoke.out.slice(-3000)); }
else console.log("SMOKE GATE: PASS");

const sim = run("balance-sim.js");
const r = sim.out.match(/コイン比 ([\d.]+) 倍 \/ 星屑比: ([\d.]+) 倍 \/ 件数比: ([\d.]+) 倍/);
const f = sim.out.match(/初リリース passive=([\d.]+)分 active=([\d.]+)分/);
if (r) console.log(`SIM RATIOS: coin=${r[1]} dust=${r[2]} count=${r[3]} (need coin>=1.1, dust>=1.3, count>=1.0)`);
if (f) console.log(`SIM FIRST RELEASE: passive=${f[1]}min active=${f[2]}min (need both <=5)`);
const ratiosOk = r && parseFloat(r[1]) >= 1.1 && parseFloat(r[2]) >= 1.3 && parseFloat(r[3]) >= 1.0;
const firstOk = f && parseFloat(f[1]) <= 5 && parseFloat(f[2]) <= 5;
if (!ratiosOk || !firstOk) { ok = false; console.log("SIM GATE: FAIL"); console.log(sim.out.slice(-3000)); }
else console.log("SIM GATE: PASS");
console.log(ok ? "GATE: PASS" : "GATE: FAIL");
process.exit(ok ? 0 : 1);
