/* game-html.cjs — 検証ツール (smoke / balance-sim / fresh-measure ほか) が読む
   ゲーム HTML の出所を一本化する。
   - MIYUKE_GAME_HTML があればそのファイルを読む (worktree-verify.sh がスナップショットを指す)
   - 無ければ game/build.mjs でソースから desktop/dist/index.html をビルドしてから読む
     (常に今のソースを検証する。ビルド済みの古い成果物を誤って検証しない) */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_HTML = path.join(ROOT, "desktop", "dist", "index.html");
const DESK_DIR = process.env.MIYUKE_DESK || path.join(ROOT, "desktop") + path.sep;

let built = false;
function gameHtmlPath(){
  if(process.env.MIYUKE_GAME_HTML) return process.env.MIYUKE_GAME_HTML;
  if(!built){
    execFileSync(process.execPath, [path.join(ROOT, "game", "build.mjs"), "--out=" + DEFAULT_HTML], { stdio: ["ignore", "ignore", "inherit"] });
    built = true;
  }
  return DEFAULT_HTML;
}
function readGameHtml(){ return fs.readFileSync(gameHtmlPath(), "utf8"); }

module.exports = { ROOT, DESK_DIR, gameHtmlPath, readGameHtml };
