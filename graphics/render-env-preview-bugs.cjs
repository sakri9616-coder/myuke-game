'use strict';
// Offline art preview only; no game imports, runtime drawing or sprite generation.
// node graphics/render-env-preview-bugs.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), zlib = require('node:zlib');
function load(file, key) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { timeout: 1000 });
  return context.window[key];
}
const original = load('sprites.js', 'MIYUKE_SPRITES');
const { palette, sprites } = load('env-sprites-bugs.js', 'MIYUKE_ENV_SPRITES_BUGS');
const specs = {
  icon_bug_s_0: [14,10], icon_bug_s_1: [14,10],
  icon_bug_swarm_s_0: [26,13], icon_bug_swarm_s_1: [26,13],
  icon_bug_swarm_l_0: [44,20], icon_bug_swarm_l_1: [44,20],
  fx_patch: [12,10], fx_bug_poof_0: [16,12], fx_bug_poof_1: [16,12], fx_bug_splat: [14,6]
};
const pairs = ['icon_bug_s', 'icon_bug_swarm_s', 'icon_bug_swarm_l', 'fx_bug_poof'];
const scale = 4, gray = '#808080', out = path.join(__dirname, 'env-preview-bugs');
const used = new Set();
function bounds(rows) {
  const points = rows.flatMap((r,y) => [...r].flatMap((c,x) => c === '.' ? [] : [[x,y]]));
  return [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])),
    Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))];
}
assert.deepEqual(Object.keys(sprites).sort(), Object.keys(specs).sort(), 'Exact ordered inventory');
for (const [key, hex] of Object.entries(palette)) {
  assert.equal(hex, original.palette[key], `Existing palette character and hex: ${key}`);
}
for (const [name, rows] of Object.entries(sprites)) {
  const [w,h] = specs[name];
  assert.equal(rows.length, h, name + ' row count');
  rows.forEach((r,y) => {
    assert.equal(r.length,w,`${name} row ${y} width`);
    assert.equal(r[0],'.',name + ' left margin');
    assert.equal(r[w-1],'.',name + ' right margin');
    for (const c of r) if(c !== '.') { assert(palette[c],name + ' undefined color ' + c); used.add(c); }
  });
  assert.equal(rows[0],'.'.repeat(w),name + ' top margin');
  assert.match(rows[h-1],/[^.]/,name + ' bottom contact');
  if(name.startsWith('icon_bug') || name === 'fx_bug_splat') {
    assert([...rows.join('')].every(c=>'.zKR'.includes(c)),name + ' exact bug colors');
    for(const c of 'zKR') assert(rows.join('').includes(c),name + ' bug identity ' + c);
  }
  console.log(`PASS ${name}: ${w}x${h}, top/left/right margin >=1px, grounded, existing palette.`);
}
assert.deepEqual([...used].sort(),Object.keys(palette).sort(),'No unused palette entries');
for (const base of pairs) {
  const a = sprites[base+'_0'], b = sprites[base+'_1'];
  assert.deepEqual(bounds(a),bounds(b),base + ' fixed silhouette extent and ground datum');
  assert.notEqual(a.join(''),b.join(''),base + ' distinct animation frames');
  if(base.startsWith('icon_bug')) {
    const last = a.length-1;
    // Crawler feet may alternate; the whole body/antenna mask remains fixed.
    const movingRows = base === 'icon_bug_s' ? new Set([8,last]) :
      base === 'icon_bug_swarm_s' ? new Set([6,last]) : new Set([last]);
    for(let y=0;y<a.length;y++) if(!movingRows.has(y)) {
      assert.equal(a[y].replace(/[^.]/g,'#'),b[y].replace(/[^.]/g,'#'),base+' stable body mask');
    }
  }
}
for(const suffix of ['0','1']) {
  for(const [base,lines,count] of [['icon_bug_swarm_s',[3,9],6],['icon_bug_swarm_l',[3,7,11,16],17]]) {
    const rows = sprites[base+'_'+suffix];
    assert.equal(lines.reduce((n,y)=>n+(rows[y].match(/K+/g)||[]).length,0),count,base+' visible heads');
  }
}
const density = rows => [...rows.join('')].filter(c=>c!=='.').length;
assert(density(sprites.fx_bug_poof_1) < density(sprites.fx_bug_poof_0)/2,'Dissipated smoke density');
assert(!sprites.fx_bug_poof_1.join('').includes('S'),'Smoke loses its denser rim');
console.log(`PASS: 4 stable animation extents; fixed bug body masks; 6/17 visible swarm heads; dissipating smoke; ${used.size} reused colors, 0 new colors.`);

const rgb = h => Buffer.from(h.slice(1),'hex');
function surface(w,h,color) {
  const pixels = Buffer.alloc(w*h*3), fill = rgb(color);
  for(let i=0;i<pixels.length;i+=3) fill.copy(pixels,i);
  return {w,h,pixels};
}
function rect(image,x,y,w,h,color) {
  assert(x>=0 && y>=0 && x+w<=image.w && y+h<=image.h,'Preview bounds');
  const fill=rgb(color);
  for(let py=y;py<y+h;py++) for(let px=x;px<x+w;px++) fill.copy(image.pixels,(py*image.w+px)*3);
}
function draw(image,rows,x,y) {
  rows.forEach((row,py)=>[...row].forEach((key,px)=>{
    if(key!=='.') rect(image,x+px*scale,y+py*scale,scale,scale,palette[key]);
  }));
}
// Same standard-library truecolor PNG approach as render-env-preview-vis2.cjs.
const crcTable=Array.from({length:256},(_,n)=>{
  for(let i=0;i<8;i++) n=n&1?0xEDB88320^(n>>>1):n>>>1;
  return n>>>0;
});
function chunk(type,data) {
  const body=Buffer.concat([Buffer.from(type),data]); let crc=0xFFFFFFFF;
  for(const byte of body) crc=crcTable[(crc^byte)&255]^(crc>>>8);
  const result=Buffer.alloc(data.length+12);
  result.writeUInt32BE(data.length,0); body.copy(result,4);
  result.writeUInt32BE((crc^0xFFFFFFFF)>>>0,result.length-4); return result;
}
function save(file,image) {
  const header=Buffer.alloc(13); header.writeUInt32BE(image.w,0); header.writeUInt32BE(image.h,4);
  header[8]=8; header[9]=2;
  const scanlines=Buffer.alloc(image.h*(image.w*3+1));
  for(let y=0;y<image.h;y++) image.pixels.copy(scanlines,y*(image.w*3+1)+1,y*image.w*3,(y+1)*image.w*3);
  fs.writeFileSync(path.join(out,file),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]));
}
// Caption glyphs are preview labels only, never part of delivered sprite maps.
const glyphs={
  A:'010101111101101', B:'110101110101110', C:'011100100100011', D:'110101101101110',
  E:'111100110100111', F:'111100110100100', G:'011100101101011', H:'101101111101101',
  I:'111010010010111', J:'001001001101010', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'101111111111101', O:'010101101101010', P:'110101110100100',
  Q:'010101101111011', R:'110101110101101', S:'011100010001110', T:'111010010010010',
  U:'101101101101111', V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111', '0':'111101101101111', '1':'010110010010111',
  '2':'110001010100111', '3':'110001010001110', '4':'101101111001001', '5':'111100110001110',
  '6':'011100111101111', '7':'111001010010010', '8':'111101111101111', '9':'111101111001110',
  '_':'000000000000111', '/':'001001010100100', ' ':'000000000000000'
};
function label(image,value,x,y) {
  [...value.toUpperCase()].forEach((c,i)=>{
    assert(glyphs[c],'Caption glyph '+c);
    [...glyphs[c]].forEach((b,p)=>{if(b==='1') rect(image,x+i*8+(p%3)*2,y+Math.floor(p/3)*2,2,2,palette.d);});
  });
}
fs.mkdirSync(out,{recursive:true});
const rendered=[];
function emit(name,image) { save(name,image); rendered.push([name,image]); }
for(const [name,rows] of Object.entries(sprites)) {
  const image=surface(rows[0].length*4,rows.length*4,gray); draw(image,rows,0,0); emit(name+'.png',image);
}
const cellW=280,cellH=132;
const sheet=surface(cellW*2,48+cellH*5,gray);
label(sheet,'BUG SWARM / 10 SPRITES / 4X',12,12);
Object.entries(sprites).forEach(([name,rows],i)=>{
  const x=(i%2)*cellW,y=48+Math.floor(i/2)*cellH;
  label(sheet,name,x+12,y+8); label(sheet,rows[0].length+' X '+rows.length+' PX',x+12,y+24);
  draw(sheet,rows,x+(cellW-rows[0].length*4)/2,y+cellH-8-rows.length*4);
});
emit('contact-sheet.png',sheet);
const anim=surface(cellW*2,40+pairs.length*cellH,gray);
label(anim,'FRAME 0 / FRAME 1 / FIXED ANCHORS',12,12);
pairs.forEach((base,i)=>{
  for(let f=0;f<2;f++) {
    const name=base+'_'+f,rows=sprites[name],x=f*cellW,y=40+i*cellH;
    label(anim,name,x+12,y+8);
    draw(anim,rows,x+(cellW-rows[0].length*4)/2,y+cellH-8-rows.length*4);
  }
});
emit('anim.png',anim);
// Decode every emitted PNG, verify all CRCs and compare every pixel to its backing buffer.
// Individual buffers are additionally checked independently against literal source pixels.
for(const [name,image] of rendered) {
  const png=fs.readFileSync(path.join(out,name));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a',name+' signature');
  assert.equal(png.readUInt32BE(16),image.w,name+' PNG width');
  assert.equal(png.readUInt32BE(20),image.h,name+' PNG height');
  assert.equal(png[24],8); assert.equal(png[25],2);
  const idat=[];
  for(let pos=8;pos<png.length;) {
    const len=png.readUInt32BE(pos),type=png.toString('ascii',pos+4,pos+8),data=png.subarray(pos+8,pos+8+len);
    assert.deepEqual(png.subarray(pos,pos+len+12),chunk(type,data),name+' chunk CRC');
    if(type==='IDAT') idat.push(data);
    pos+=len+12;
  }
  const raw=zlib.inflateSync(Buffer.concat(idat)),stride=image.w*3+1;
  assert.equal(raw.length,stride*image.h);
  for(let y=0;y<image.h;y++) {
    assert.equal(raw[y*stride],0,name+' PNG filter');
    assert.deepEqual(raw.subarray(y*stride+1,(y+1)*stride),image.pixels.subarray(y*image.w*3,(y+1)*image.w*3),name+' decoded pixels');
  }
  const rows=sprites[name.slice(0,-4)];
  if(rows) for(let y=0;y<image.h;y++) for(let x=0;x<image.w;x++) {
    const c=rows[Math.floor(y/4)][Math.floor(x/4)],expected=rgb(c==='.'?gray:palette[c]);
    assert.deepEqual(raw.subarray(y*stride+1+x*3,y*stride+4+x*3),expected,name+' source sample');
  }
}
assert.deepEqual(fs.readdirSync(out).sort(),rendered.map(([n])=>n).sort(),'Exact 12-PNG inventory');
console.log('PASS: all 12 PNGs decoded, CRCs and pixels validated; individual previews exact 4x nearest on #808080.');
console.log('Written: 10 individual PNGs + contact-sheet.png + anim.png (all four two-frame pairs).');
