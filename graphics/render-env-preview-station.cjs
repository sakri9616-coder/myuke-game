'use strict';
// Offline preview only: renders literal artist-authored maps; never imported by the game.
// node graphics/render-env-preview-station.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),zlib=require('node:zlib');
function load(file,key){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),c,{timeout:1000});return c.window[key];}
const original=load('sprites.js','MIYUKE_SPRITES');
const previous=load('env-sprites-handwork.js','MIYUKE_ENV_SPRITES_HANDWORK');
const {palette,sprites}=load('env-sprites-station.js','MIYUKE_ENV_SPRITES_STATION');
const specs={prop_station_plan:[48,44],prop_station_test:[48,44],prop_station_build:[48,44],prop_station_ship:[64,48],fx_handwork_plan_0:[18,16],fx_handwork_plan_1:[18,16],fx_handwork_code_0:[18,16],fx_handwork_code_1:[18,16]};
const pairs=['fx_handwork_plan','fx_handwork_code'];
const scale=4,gray='#808080',out=path.join(__dirname,'env-preview-station');
const used=new Set();
assert.deepEqual(Object.keys(sprites).sort(),Object.keys(specs).sort());
for(const [c,hex]of Object.entries(palette))assert.equal(hex,original.palette[c],'Reused character/hex '+c);
for(const[n,rows]of Object.entries(sprites)){
 const[w,h]=specs[n];assert.equal(rows.length,h,n+' height');
 rows.forEach((r,y)=>{assert.equal(r.length,w,n+' width row '+y);for(const c of r)if(c!=='.'){assert(palette[c],n+' undefined color '+c);used.add(c);}});
 if(n.startsWith('prop_'))assert.match(rows[h-1],/[^.]/,n+' grounded');
 console.log('PASS '+n+': '+w+'x'+h+', palette reused');
}
assert.deepEqual([...used].sort(),Object.keys(palette).sort(),'No unused colors');
for(const base of pairs){
 const a=sprites[base+'_0'],b=sprites[base+'_1'];
 assert.equal(a[15],b[15],base+' fixed bottom');
 assert.notEqual(a.join(''),b.join(''),base+' distinct frames');
 for(let frame=0;frame<2;frame++){
  const rows=sprites[base+'_'+frame],ref=previous.sprites['fx_handwork_test_'+frame];
  // Exact pixel positions and colors through the wrist; only tools below it differ.
  for(let y=0;y<(frame?10:8);y++)assert.equal(rows[y],ref[y],base+' exact reference paw row '+y);
 }
}
// Low partitions occupy 25/44 (plan), 24/44 (test/build), or 24/48 (dock wings).
// Everything above them must belong to a separate tool or the loading shutter frame.
const upperTools={
 prop_station_plan:[19,[[3,4,34,11],[7,15,1,4],[22,15,1,4]]],
 prop_station_test:[20,[[11,3,10,9],[29,4,12,10],[0,5,8,15],[7,12,10,1],[33,13,8,1],[40,14,1,6]]],
 prop_station_build:[20,[[6,2,30,11],[37,4,11,10],[3,13,42,1],[3,14,1,6],[44,14,4,6]]],
 prop_station_ship:[24,[[4,0,56,4],[4,4,4,20],[56,4,4,20]]]
};
for(const[n,[top,tools]]of Object.entries(upperTools)){
 const rs=sprites[n];
 assert(top>=rs.length/3 && top<=rs.length/2,n+' low partition height');
 for(let y=0;y<top;y++)for(let x=0;x<rs[0].length;x++)if(rs[y][x]!=='.')
  assert(tools.some(([tx,ty,w,h])=>x>=tx&&x<tx+w&&y>=ty&&y<ty+h),n+' transparent above partition '+x+','+y);
}
// Reserved areas are exactly flat wall bands/baseboard or transparency, with no tool exceptions.
for(const[n,x0,y0,w,h]of [['prop_station_plan',24,16,24,28],['prop_station_test',8,14,32,30],['prop_station_build',4,14,40,30],['prop_station_ship',8,4,48,44]]){
 const rs=sprites[n],top=upperTools[n][0];
 for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){
  let expected='.';
  if(n!=='prop_station_ship' && y>=top){
   expected=y===43?'O':y===42?'t':y===top?'T':'w';
   if(n==='prop_station_plan' && x===46)expected='O';
   if(n==='prop_station_plan' && x===47)expected='.';
  }
  assert.equal(rs[y][x],expected,n+' plain reserved area '+x+','+y);
 }
}
console.log('PASS: low partitions; transparent upper areas except tools/shutter frame; plain reserved foreground areas.');
console.log('PASS: exact reference paws; 2 fixed canvases/ground lines; '+used.size+' reused colors, 0 new colors.');
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
    if(key!=='.') rect(image,x+px*scale,y+py*scale,scale,scale,(palette[key] || original.palette[key]));
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
    [...glyphs[c]].forEach((b,p)=>{if(b==='1') rect(image,x+i*8+(p%3)*2,y+Math.floor(p/3)*2,2,2,'#FFF5E6');});
  });
}
fs.mkdirSync(out,{recursive:true});
const rendered=[];
function emit(name,image){save(name,image);rendered.push([name,image]);}
for(const[name,rows]of Object.entries(sprites)){const image=surface(rows[0].length*4,rows.length*4,gray);draw(image,rows,0,0);emit(name+'.png',image);}
const cellW=288,cellH=244;
const sheet=surface(cellW*2,36+cellH*4,gray);label(sheet,'STATION / 8 SPRITES / 4X',12,12);
Object.entries(sprites).forEach(([name,rows],i)=>{const x=i%2*cellW,y=36+Math.floor(i/2)*cellH;label(sheet,name,x+12,y+8);label(sheet,rows[0].length+' X '+rows.length+' PX',x+12,y+24);draw(sheet,rows,x+(cellW-rows[0].length*4)/2,y+cellH-8-rows.length*4);});
emit('contact-sheet.png',sheet);
const anim=surface(cellW*2,36+132*2,gray);label(anim,'FRAME 0 / FRAME 1 / FIXED ANCHORS',12,12);
pairs.forEach((base,i)=>{for(let f=0;f<2;f++){const n=base+'_'+f,rs=sprites[n],x=f*cellW,y=36+i*132;label(anim,n,x+12,y+8);draw(anim,rs,x+(cellW-rs[0].length*4)/2,y+124-rs.length*4);}});emit('anim.png',anim);
// All layers use bottom-centre anchors on one ground line; listed order is back to front.
// Plan backlog is 10px right of booth centre, inside its reserved right-hand 24px.
const overlays=[['plan','prop_backlog_1'],['test','prop_qa_tray','prop_autotester_2'],['build','prop_build_stand','prop_packer_2'],['ship','prop_ship']];
const overlay=surface(cellW*2,36+cellH*2,gray);label(overlay,'BOOTH / EXISTING PROPS / SAME GROUND',12,12);
overlays.forEach(([stage,...props],i)=>{const x=i%2*cellW,y=36+Math.floor(i/2)*cellH,cx=x+cellW/2,ground=y+cellH-8;label(overlay,'PROP_STATION_'+stage,x+12,y+8);for(const name of ['prop_station_'+stage,...props]){const rows=sprites[name]||original.sprites[name];assert(rows,name+' exists');draw(overlay,rows,cx+(stage==='plan'&&name==='prop_backlog_1'?48:0)-rows[0].length*scale/2,ground-rows.length*scale);}});emit('overlay.png',overlay);
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
assert.deepEqual(fs.readdirSync(out).sort(),rendered.map(([n])=>n).sort(),'Exact 11-PNG inventory');
console.log('PASS: all 11 PNGs decoded, CRCs and pixels validated; individual previews exact 4x nearest on #808080.');
console.log('Written: 8 individual PNGs + contact-sheet.png + anim.png + overlay.png.');

