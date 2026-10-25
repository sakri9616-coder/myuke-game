'use strict';

// Offline pixel-map renderer. Run from any directory:
//   node graphics/render-env-preview.cjs [sprite_name ...]
// No game, browser, dependencies, font rasterizer, or image smoothing.
// Like validate-sprites.cjs, load the plain browser data in an isolated VM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');

function load(file, key) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { timeout: 1000 });
  return context.window[key];
}
const original = load('sprites.js', 'MIYUKE_SPRITES');
const { palette, sprites } = load('env-sprites-fix1.js', 'MIYUKE_ENV_SPRITES_FIX1');
const out = path.join(__dirname, 'env-preview-fix1');
const names = process.argv.slice(2);
for (const name of names) assert(sprites[name], `Unknown sprite: ${name}`);
const entries = Object.entries(sprites).filter(([name]) => !names.length || names.includes(name));
const scale = 4, gray = '#808080';
const rgb = hex => Buffer.from(hex.slice(1), 'hex');

// Palette subset must remain an exact copy of existing game colors.
for (const [key, hex] of Object.entries(palette)) {
  assert.match(hex, /^#[0-9a-f]{6}$/i);
  assert.equal(hex, original.palette[key], `New or remapped palette character: ${key}`);
}
for (const [name, rows] of Object.entries(sprites)) {
  assert(Array.isArray(rows) && rows.length && rows[0].length, `${name}: empty map`);
  for (const [y, row] of rows.entries()) {
    assert.equal(row.length, rows[0].length, `${name}: ragged row ${y}`);
    for (const key of row) assert(key === '.' || palette[key], `${name}: unknown character ${key}`);
  }
  assert(/[^.]/.test(rows.at(-1)), `${name}: empty ground row`);
  assert.equal(rows.length, name === 'prop_ship' ? 48 : 24);
  assert.equal(rows[0].length, rows.length);
}

function surface(w, h, color) {
  const pixels = Buffer.alloc(w * h * 3);
  const fill = rgb(color);
  for (let i = 0; i < pixels.length; i += 3) fill.copy(pixels, i);
  return { w, h, pixels };
}
function rect(image, x, y, w, h, color) {
  const fill = rgb(color);
  assert(x >= 0 && y >= 0 && x + w <= image.w && y + h <= image.h, 'Drawing outside preview');
  for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
    fill.copy(image.pixels, (py * image.w + px) * 3);
  }
}
function draw(image, rows, x, y) {
  rows.forEach((row, py) => [...row].forEach((key, px) => {
    if (key !== '.') rect(image, x + px * scale, y + py * scale, scale, scale, palette[key]);
  }));
}

// Minimal truecolor PNG encoder using Node's standard zlib and PNG chunks.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const tag = Buffer.from(type), body = Buffer.concat([tag, data]);
  let crc = 0xFFFFFFFF;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  body.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, result.length - 4);
  return result;
}
function save(file, image) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.w, 0); header.writeUInt32BE(image.h, 4);
  header[8] = 8; header[9] = 2; // 8-bit RGB, opaque mid-gray behind transparent pixels.
  const scanlines = Buffer.alloc(image.h * (image.w * 3 + 1));
  for (let y = 0; y < image.h; y++) {
    image.pixels.copy(scanlines, y * (image.w * 3 + 1) + 1, y * image.w * 3, (y + 1) * image.w * 3);
  }
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// Hand-set 3x5 caption glyphs keep the contact sheet free of antialiasing too.
const glyphs = {
  A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110',
  E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101',
  I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'101111111111101', O:'010101101101010', P:'110101110100100',
  Q:'010101101111011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
  U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111', '0':'111101101101111', '1':'010110010010111',
  '2':'110001010100111', '3':'110001010001110', '4':'101101111001001', '5':'111100110001110',
  '6':'011100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001110',
  '_':'000000000000111', '-':'000000111000000', '/':'001001010100100', '.':'000000000000010',
  ':':'000010000010000', '+':'000010111010000', ' ':'000000000000000',
};
function label(image, value, x, y, color = '#E9EFFF') {
  [...value.toUpperCase()].forEach((ch, i) => {
    assert(glyphs[ch], `Missing caption glyph: ${ch}`);
    [...glyphs[ch]].forEach((bit, p) => {
      if (bit === '1') rect(image, x + i * 8 + (p % 3) * 2, y + Math.floor(p / 3) * 2, 2, 2, color);
    });
  });
}

fs.mkdirSync(out, { recursive: true });
for (const [name, rows] of entries) {
  const image = surface(rows[0].length * scale, rows.length * scale, gray);
  draw(image, rows, 0, 0);
  save(path.join(out, `${name}.png`), image);
  console.log(`${name}: ${rows[0].length}x${rows.length} -> ${image.w}x${image.h}`);
}

// Always show the full current set, in authoring priority order. Cells retain
// the same 4x scale; tall props are never enlarged to fill their panel.
const all = Object.entries(sprites), columns = 3;
const cellW = Math.max(208, ...all.map(([, rows]) => rows[0].length * scale + 48));
const cellH = Math.max(208, ...all.map(([, rows]) => rows.length * scale + 90));
const sheet = surface(columns * cellW, Math.ceil(all.length / columns) * cellH + 60, gray);
label(sheet, 'MIYUKE / ENV FIX1', 24, 16);
label(sheet, '4X / 808080 BACKGROUND', 24, 36, '#C1C8CB');
all.forEach(([name, rows], i) => {
  const x = (i % columns) * cellW, y = 60 + Math.floor(i / columns) * cellH;
  label(sheet, name, x + 24, y + 16);
  label(sheet, `${rows[0].length} X ${rows.length} PX`, x + 24, y + 34, '#C1C8CB');
  rect(sheet, x + 16, y + 56, cellW - 32, cellH - 72, gray);
  draw(sheet, rows, x + Math.floor((cellW - rows[0].length * scale) / 2), y + cellH - 32 - rows.length * scale);
});
save(path.join(out, 'contact-sheet.png'), sheet);
console.log(`Validated ${all.length} sprites; ${Object.keys(palette).length} reused colors; contact sheet written.`);
