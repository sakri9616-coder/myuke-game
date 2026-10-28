#!/usr/bin/env node
/* build.mjs — game/src のソースから Tauri が読む 1 枚の index.html を組み立てる。
   使い方: node game/build.mjs [--out=<path>]   (既定: desktop/dist/index.html)
   - index.html (骨格) の @@STYLES@@ / @@BOOT@@ / @@MAIN@@ を置換する
   - スプライトは graphics/sprites.js をそのまま取り込む (コピーを持たない)
   - TypeScript は型注釈を空白に置き換えて連結する (型チェックは npm run typecheck)
   - 本体は GAME_SOURCES の順に連結する。全ファイルは同じグローバルスコープを
     共有するスクリプトなので、順序は実行順そのもの (トップレベルの const/let は
     定義より前のファイルから参照できない) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tsBlankSpace from "ts-blank-space";

const GAME = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(GAME, "..");
const SRC = path.join(GAME, "src");

export const GAME_SOURCES = [
  "config", "defs", "save", "tutorial", "office", "sound", "juice", "project",
  "production", "state", "focus", "tick", "purchase", "company",
  "strip-frame", "strip-meter", "strip-core", "strip-walk", "strip-layout", "strip-flow", "strip-ambient",
  "strip-furniture", "strip-board", "strip-piles", "strip-visible", "strip-bugs", "hitzones",
  "ui-core", "ui-panel", "ui-misc", "ui-layout", "os-input", "updater", "input", "sync", "main"
];

/* 改行は LF に揃えて読む (Windows の CI は core.autocrlf で CRLF をチェックアウトするため、
   揃えないとテンプレートの差し込み位置が見つからない。生成物も OS によらず同じになる) */
const read = p => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
/* 型注釈を同じ幅の空白に置き換えるだけの変換 (ts-blank-space)。行・桁・コメントは
   ソースのまま残るので、実行時エラーの位置がソースと一致する。型チェックは
   npm run typecheck が担う (enum や namespace のような実行時コードを生む構文は使わない) */
const strip = p => tsBlankSpace(read(p), node => {
  throw new Error(p + ": ts-blank-space で消せない構文: " + node.getText());
});

export function buildHtml(){
  const main =
    '"use strict";\n' +
    "/* ===== スプライトデータ (graphics/sprites.js を同梱; 差し替え時はこのブロックを置換) ===== */\n" +
    read(path.join(ROOT, "graphics", "sprites.js")) +
    "/* ===== スプライトデータここまで ===== */\n" +
    GAME_SOURCES.map(n => strip(path.join(SRC, "game", n + ".ts"))).join("");
  const parts = {
    "@@STYLES@@\n": read(path.join(SRC, "styles.css")),
    "@@BOOT@@\n": strip(path.join(SRC, "boot.ts")),
    "@@MAIN@@\n": main
  };
  let html = read(path.join(SRC, "index.html"));
  for(const [mark, body] of Object.entries(parts)){
    if(html.split(mark).length !== 2) throw new Error("template marker missing or duplicated: " + mark.trim());
    html = html.replace(mark, () => body);
  }
  return html;
}

if(process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)){
  const outArg = process.argv.find(a => a.startsWith("--out="));
  const out = outArg ? path.resolve(outArg.slice(6)) : path.join(ROOT, "desktop", "dist", "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buildHtml());
  console.log("BUILD_OK " + path.relative(process.cwd(), out));
}
