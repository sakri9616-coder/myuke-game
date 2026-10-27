'use strict';

// Offline pixel-map renderer. Run from any directory:
//   node graphics/render-env-preview-vis.cjs [sprite_name ...]
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
const { palette, sprites } = load('env-sprites-visible.js', 'MIYUKE_ENV_SPRITES_VIS');
const out = path.join(__dirname, 'env-preview-vis');
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

const sizes = {};
function expect(names,w,h){for(const n of names.split(' '))sizes[n]=[w,h];}
expect('prop_backlog_0 prop_backlog_1 prop_backlog_2',24,28);
expect('prop_qa_tray prop_build_stand',32,8);
expect('icon_card icon_card_ok',12,8);
expect('icon_note_0 icon_note_1 icon_note_2 icon_note_3 icon_mote',6,6);
expect('prop_signal_green prop_signal_yellow prop_signal_red',8,18);
expect('prop_jam_cone',10,10);
expect('prop_keyboard_1 prop_keyboard_2 prop_keyboard_3',24,6);
expect('screen_ide_0 screen_ide_1 screen_ide_2',20,10);
expect('prop_monitor_sub_1 prop_monitor_sub_2 prop_autotester_1 prop_autotester_2',28,28);
expect('prop_chair_0 prop_chair_2',32,36);
expect('prop_ci_1',24,32);
expect('prop_packer_1 prop_packer_2',40,28);
expect('bot_idle bot_carry bot_walk_a bot_walk_b',24,20);
expect('prop_debt_pile_1 prop_debt_pile_2 prop_debt_pile_3',16,12);
expect('fx_spark_0 fx_spark_1 fx_spark_2',9,9);
for(let i=0;i<5;i++){expect('fx_confetti_'+i+'_a',3,2);expect('fx_confetti_'+i+'_b',1,2);}
assert.deepEqual(Object.keys(sprites).sort(),Object.keys(sizes).sort(),'Exact 51-name order inventory');
const used=new Set();
for (const [name, rows] of Object.entries(sprites)) {
  assert(Array.isArray(rows)&&rows.length&&rows[0].length, name+': empty');
  assert.deepEqual([rows[0].length,rows.length],sizes[name],name+': size');
  for(const [y,row] of rows.entries()){
    assert.equal(row.length,sizes[name][0],name+': row '+y+' width');
    for(const k of row){assert(k==='.'||palette[k],name+': unknown '+k);if(k!=='.')used.add(k);}
  }
  assert(!original.sprites[name],name+': existing name collision');
  if(name.startsWith('screen_'))assert(rows.every(r=>!r.includes('.')),name+': opaque inset');
  else if(!name.startsWith('fx_')){
    assert(rows.slice(0,2).every(r=>/^\.+$/.test(r)),name+': top margin');
    assert(rows.every(r=>r.startsWith('..')&&r.endsWith('..')),name+': side margins');
    assert(/[^.]/.test(rows.at(-1)),name+': ground row');
  }
}
assert.equal(used.size,Object.keys(palette).length,'No unused palette entries');
const sameGround=names=>{const rows=names.map(n=>sprites[n].at(-1).replace(/[^.]/g,'x'));assert(rows.every(r=>r===rows[0]),names+': shared ground footprint');};
for(const names of [
 ['prop_backlog_0','prop_backlog_1','prop_backlog_2'],
 ['prop_signal_green','prop_signal_yellow','prop_signal_red'],
 ['prop_keyboard_1','prop_keyboard_2','prop_keyboard_3'],
 ['prop_chair_0','prop_chair_2'],['prop_autotester_1','prop_autotester_2'],
 ['prop_packer_1','prop_packer_2'],['prop_debt_pile_1','prop_debt_pile_2','prop_debt_pile_3']
])sameGround(names);
for(const n of ['prop_chair_0','prop_chair_2'])assert.deepEqual(Array.from(sprites[n].slice(28)),Array.from(original.sprites.prop_chair.slice(28)),n+': existing caster base');
for(const n of ['bot_idle','bot_carry','bot_walk_a','bot_walk_b'])assert(sprites[n].slice(18).every(r=>/[^.]/.test(r)),n+': rows 18–19');
for(const n of ['bot_walk_a','bot_walk_b'])assert.deepEqual(Array.from(sprites[n].slice(0,18)),Array.from(sprites.bot_idle.slice(0,18)),n+': stable body');
for(const n of ['prop_signal_yellow','prop_signal_red']){
 const normalize=rows=>rows.join('').replace(/[GgYyRH]/g,'!');
 assert.equal(normalize(sprites[n]),normalize(sprites.prop_signal_green),'Signal lamp-only variants');
}
// Select front colors by exact nearest squared distance in the existing sRGB palette.
for(const [i,target] of ['#e2543e','#ffd94d','#5aa469','#4a90c2','#f49cac'].entries()){
 const channels=h=>[1,3,5].map(p=>parseInt(h.slice(p,p+2),16));
 const t=channels(target),dist=h=>channels(h).reduce((v,c,j)=>v+(c-t[j])**2,0);
 const nearest=Object.entries(original.palette).sort((a,b)=>dist(a[1])-dist(b[1]))[0];
 const front=sprites['fx_confetti_'+i+'_a'][0][0],edge=sprites['fx_confetti_'+i+'_b'][0][0];
 assert.equal(dist(palette[front]),dist(nearest[1]),'Confetti '+i+': nearest existing color');
 const luminance=h=>channels(h).reduce((v,c,j)=>v+c*[.2126,.7152,.0722][j],0);
 assert(luminance(palette[edge])<luminance(palette[front]),'Confetti '+i+': darker edge');
}
console.log('PASS: 51 names, exact sizes, equal-width rows, margins, ground, opaque screens, existing palette, state consistency, nearest confetti colors.');

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


// Named cells preserve order A, B, C, D, and exact 4x artwork.
const all=Object.entries(sprites),cols=5,cellW=232,cellH=196;
const sheet=surface(cols*cellW,64+Math.ceil(all.length/cols)*cellH,gray);
label(sheet,'MIYUKE / VISIBLE SYSTEMS / A B C D',16,12,'#2F3444');
label(sheet,'4X NEAREST / 808080 / 51 SPRITES / ZERO NEW COLORS',16,32,'#2F3444');
all.forEach(([name,rows],i)=>{
 const x=(i%cols)*cellW,y=64+Math.floor(i/cols)*cellH;
 label(sheet,name,x+8,y+4,'#2F3444');
 label(sheet,rows[0].length+' X '+rows.length+' PX',x+8,y+20,'#2F3444');
 draw(sheet,rows,x+Math.floor((cellW-rows[0].length*scale)/2),y+cellH-12-rows.length*scale);
});
save(path.join(out,'contact-sheet.png'),sheet);
console.log('Validated '+all.length+' sprites; '+Object.keys(palette).length+' reused colors; 0 new colors; contact sheet written.');
