'use strict';
// Offline validation and PNG previews only. No game execution or runtime art generation.
// node graphics/render-env-preview-vis2.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),zlib=require('node:zlib');
function load(file,key){const c={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,file),'utf8'),c,{timeout:1000});return c.window[key];}
const original=load('sprites.js','MIYUKE_SPRITES');
const {palette,sprites}=load('env-sprites-visible2.js','MIYUKE_ENV_SPRITES_VIS2');
const specs={
  "ui_board_9": {"group":"G","w":24,"h":24,"description":"Dark wood planning board with cream paper and one bright top rim stripe.","slice":{"type":"9","a":6,"b":6},"ground":false,"anchor":"top-left"},
  "ui_board_glow_9": {"group":"G","w":12,"h":12,"description":"Gold overlay rim; transparent center.","slice":{"type":"9","a":4,"b":4},"ground":false,"anchor":"top-left"},
  "ui_board_post_3v": {"group":"G","w":6,"h":14,"description":"Wood support with a small splayed floor foot.","slice":{"type":"3v","a":3,"b":4},"ground":false,"anchor":"top-left"},
  "ui_bar_track_3": {"group":"G","w":12,"h":9,"description":"Brown rim around a dark green-slate progress groove.","slice":{"type":"3","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_bar_fill_green_3": {"group":"G","w":6,"h":8,"description":"Progress fill green; shared silhouette and bright upper stripe.","slice":{"type":"3","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_bar_fill_yellow_3": {"group":"G","w":6,"h":8,"description":"Progress fill yellow; shared silhouette and bright upper stripe.","slice":{"type":"3","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_bar_fill_red_3": {"group":"G","w":6,"h":8,"description":"Progress fill red; shared silhouette and bright upper stripe.","slice":{"type":"3","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_bar_tick": {"group":"G","w":2,"h":8,"description":"Cream milestone line.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_0": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 0.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_1": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 1.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_2": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 2.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_3": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 3.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_4": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 4.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_5": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 5.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_6": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 6.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_project_7": {"group":"G","w":12,"h":12,"description":"Small project folder; color set 7.","slice":null,"ground":true,"anchor":"bottom-center"},
  "ui_pill_0_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 0.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_1_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 1.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_2_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 2.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_3_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 3.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_4_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 4.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_5_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 5.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_6_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 6.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_pill_7_9": {"group":"G","w":10,"h":12,"description":"Rounded genre label; color set 7.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "icon_warn_plate": {"group":"G","w":11,"h":11,"description":"Red warning triangle with cream exclamation pictogram.","slice":null,"ground":true,"anchor":"bottom-center"},
  "ui_tab_9": {"group":"G","w":12,"h":12,"description":"Wood-rim cream shoulder tab for rank or focus.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_tab_gold_9": {"group":"G","w":12,"h":12,"description":"Gold-rim coin tab with gold face; same rim geometry.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_meter_track_3": {"group":"G","w":8,"h":5,"description":"Small focus groove.","slice":{"type":"3","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_meter_fill_3": {"group":"G","w":4,"h":3,"description":"Pale blue focus fill.","slice":{"type":"3","a":1,"b":1},"ground":false,"anchor":"top-left"},
  "ui_memo_9": {"group":"G","w":16,"h":16,"description":"Hanging wood-rim cream memo.","slice":{"type":"9","a":4,"b":4},"ground":false,"anchor":"top-left"},
  "ui_memo_gold_9": {"group":"G","w":16,"h":16,"description":"Hanging gold-rim pale gold memo.","slice":{"type":"9","a":4,"b":4},"ground":false,"anchor":"top-left"},
  "icon_pin": {"group":"G","w":4,"h":4,"description":"Red pushpin; tiny canvas has no margins.","slice":null,"ground":false,"anchor":"bottom-center"},
  "icon_cord": {"group":"G","w":2,"h":4,"description":"Wood-brown hanging cord; tiny canvas has no margins.","slice":null,"ground":false,"anchor":"bottom-center"},
  "ui_chip_todo_9": {"group":"G","w":8,"h":11,"description":"Module chip todo; identical shape across three states.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_chip_done_9": {"group":"G","w":8,"h":11,"description":"Module chip done; identical shape across three states.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "ui_chip_alert_9": {"group":"G","w":8,"h":11,"description":"Module chip alert; identical shape across three states.","slice":{"type":"9","a":3,"b":3},"ground":false,"anchor":"top-left"},
  "icon_project_mini_0": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 0.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_1": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 1.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_2": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 2.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_3": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 3.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_4": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 4.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_5": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 5.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_6": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 6.","slice":null,"ground":false,"anchor":"top-left"},
  "icon_project_mini_7": {"group":"H","w":5,"h":5,"description":"Miniature project folder; color set 7.","slice":null,"ground":false,"anchor":"top-left"},
  "ui_minibar_track_3": {"group":"H","w":6,"h":3,"description":"Tiny monitor progress groove.","slice":{"type":"3","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_minibar_fill_3": {"group":"H","w":4,"h":3,"description":"Tiny green progress fill.","slice":{"type":"3","a":1,"b":1},"ground":false,"anchor":"top-left"},
  "ui_minibar_fill_yellow_3": {"group":"H","w":4,"h":3,"description":"Tiny yellow planning fill.","slice":{"type":"3","a":1,"b":1},"ground":false,"anchor":"top-left"},
  "ui_minibar_tick": {"group":"H","w":1,"h":3,"description":"Tiny cream milestone.","slice":null,"ground":false,"anchor":"top-left"},
  "screen_gitlog_0": {"group":"H","w":10,"h":2,"description":"Dim green commit dot and short log stroke.","slice":null,"ground":false,"anchor":"top-left"},
  "screen_gitlog_1": {"group":"H","w":14,"h":2,"description":"Dim green commit dot and short log stroke.","slice":null,"ground":false,"anchor":"top-left"},
  "screen_gitlog_2": {"group":"H","w":18,"h":2,"description":"Dim green commit dot and short log stroke.","slice":null,"ground":false,"anchor":"top-left"},
  "screen_gitlog_3": {"group":"H","w":22,"h":2,"description":"Dim green commit dot and short log stroke.","slice":null,"ground":false,"anchor":"top-left"},
  "screen_gitlog_new": {"group":"H","w":18,"h":2,"description":"Bright green latest commit dot and orange end marker.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_research_desk": {"group":"I","w":72,"h":28,"description":"Small wood desk, three technical books at left and an open book at center.","slice":null,"ground":true,"anchor":"bottom-center"},
  "prop_research_desk_on": {"group":"I","w":72,"h":28,"description":"Same research desk; brighter open pages and one purple book glint.","slice":null,"ground":true,"anchor":"bottom-center"},
  "desk_wood_main": {"group":"I","w":116,"h":3,"description":"Wood desktop; exact existing laminate canvas, placement and silhouette.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_fence": {"group":"I","w":104,"h":26,"description":"Low quiet wood fence, spaced pickets and two horizontal rails.","slice":null,"ground":true,"anchor":"bottom-center"},
  "prop_shelf_box_0": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 0.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_1": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 1.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_2": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 2.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_3": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 3.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_4": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 4.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_5": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 5.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_6": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 6.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_shelf_box_7": {"group":"I","w":10,"h":9,"description":"Small released-project box with cream tape; color set 7.","slice":null,"ground":false,"anchor":"top-left"},
  "fx_shelf_glow": {"group":"I","w":12,"h":11,"description":"Gold shelf-box outline with a transparent center.","slice":null,"ground":false,"anchor":"top-left"},
  "prop_trophy_stand": {"group":"I","w":24,"h":12,"description":"Stepped wood award pedestal; existing award mounts above.","slice":null,"ground":true,"anchor":"bottom-center"},
  "prop_easel": {"group":"I","w":22,"h":28,"description":"A-shaped wood easel legs and two crossbars; existing poster rests above.","slice":null,"ground":true,"anchor":"bottom-center"},
  "fx_shadow_3": {"group":"J","w":12,"h":5,"description":"Single dark-brown stepped oval shadow; game supplies opacity.","slice":{"type":"3","a":4,"b":4},"ground":false,"anchor":"top-left"},
  "prop_rug_3": {"group":"J","w":16,"h":5,"description":"Single warm wood-brown rug with stepped ends and small fringe tips.","slice":{"type":"3","a":4,"b":4},"ground":false,"anchor":"top-left"},
  "prop_fever_gauge": {"group":"K","w":15,"h":44,"description":"Empty wood-and-brass tube; cream window x3..11, y3..40 inclusive.","slice":null,"ground":true,"anchor":"bottom-center"},
  "ui_gauge_fill_blue_3v": {"group":"K","w":9,"h":6,"description":"Vertical gauge blue; same shape with a bright surface stripe.","slice":{"type":"3v","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_gauge_fill_gold_3v": {"group":"K","w":9,"h":6,"description":"Vertical gauge gold; same shape with a bright surface stripe.","slice":{"type":"3v","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "ui_gauge_fill_red_3v": {"group":"K","w":9,"h":6,"description":"Vertical gauge red; same shape with a bright surface stripe.","slice":{"type":"3v","a":2,"b":2},"ground":false,"anchor":"top-left"},
  "icon_bolt": {"group":"K","w":8,"h":10,"description":"Compact gold lightning signal.","slice":null,"ground":true,"anchor":"bottom-center"},
  "prop_star_deco_0": {"group":"K","w":11,"h":11,"description":"Gold shelf star ornament on a tiny stand; twinkle frame 0.","slice":null,"ground":true,"anchor":"bottom-center"},
  "prop_star_deco_1": {"group":"K","w":11,"h":11,"description":"Same star canvas and stand; twinkle frame 1 changes two highlights.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_update_ribbon": {"group":"K","w":6,"h":8,"description":"Tiny red update ribbon with forked end; only two drawable columns.","slice":null,"ground":true,"anchor":"bottom-center"},
  "icon_badge_hire": {"group":"K","w":7,"h":7,"description":"Gold hire badge with dark exclamation; tiny canvas has no margins.","slice":null,"ground":false,"anchor":"bottom-center"},
  "icon_memo": {"group":"K","w":9,"h":11,"description":"Cream request paper, red header and two slate lines.","slice":null,"ground":true,"anchor":"bottom-center"}
};
const out=path.join(__dirname,'env-preview-vis2'),scale=4,gray='#808080',rgb=h=>Buffer.from(h.slice(1),'hex');
﻿const expected={};
function expect(names,w,h){for(const n of names.split(' '))expected[n]=[w,h];}
expect('ui_board_9',24,24);expect('ui_board_glow_9',12,12);expect('ui_board_post_3v',6,14);
expect('ui_bar_track_3',12,9);expect('ui_bar_fill_green_3 ui_bar_fill_yellow_3 ui_bar_fill_red_3',6,8);expect('ui_bar_tick',2,8);
for(let i=0;i<8;i++){expect('icon_project_'+i,12,12);expect('ui_pill_'+i+'_9',10,12);expect('icon_project_mini_'+i,5,5);expect('prop_shelf_box_'+i,10,9);}
expect('icon_warn_plate',11,11);expect('ui_tab_9 ui_tab_gold_9',12,12);expect('ui_meter_track_3',8,5);expect('ui_meter_fill_3',4,3);expect('ui_memo_9 ui_memo_gold_9',16,16);expect('icon_pin',4,4);expect('icon_cord',2,4);expect('ui_chip_todo_9 ui_chip_done_9 ui_chip_alert_9',8,11);
expect('ui_minibar_track_3',6,3);expect('ui_minibar_fill_3 ui_minibar_fill_yellow_3',4,3);expect('ui_minibar_tick',1,3);for(let i=0;i<4;i++)expect('screen_gitlog_'+i,10+4*i,2);expect('screen_gitlog_new',18,2);
expect('prop_research_desk prop_research_desk_on',72,28);expect('desk_wood_main',116,3);expect('prop_fence',104,26);expect('fx_shelf_glow',12,11);expect('prop_trophy_stand',24,12);expect('prop_easel',22,28);expect('fx_shadow_3',12,5);expect('prop_rug_3',16,5);
expect('prop_fever_gauge',15,44);expect('ui_gauge_fill_blue_3v ui_gauge_fill_gold_3v ui_gauge_fill_red_3v',9,6);expect('icon_bolt',8,10);expect('prop_star_deco_0 prop_star_deco_1',11,11);expect('icon_update_ribbon',6,8);expect('icon_badge_hire',7,7);expect('icon_memo',9,11);
assert.deepEqual(Object.keys(sprites).sort(),Object.keys(expected).sort(),'Exact order inventory');
assert.deepEqual(Object.keys(specs).sort(),Object.keys(expected).sort(),'Metadata inventory');
// Slice dimensions are checked against the order independently of the art metadata.
for(const [n,m]of Object.entries(specs))if(m.slice){
 const type=n.endsWith('_9')?'9':n.endsWith('_3v')?'3v':'3';
 let a=type==='9'?(n==='ui_board_9'?6:n==='ui_board_glow_9'||n.startsWith('ui_memo_')?4:3):
 n==='ui_board_post_3v'?3:n.startsWith('ui_gauge_fill_')?2:n==='fx_shadow_3'||n==='prop_rug_3'?4:
 n==='ui_bar_track_3'?3:n.startsWith('ui_bar_fill_')||n==='ui_meter_track_3'||n==='ui_minibar_track_3'?2:1;
 const b=n==='ui_board_post_3v'?4:a;
 assert.deepEqual(m.slice,{type,a,b},n+' order slice geometry');
}
const used=new Set();let slices=0,grounded=0;
const uniform=chars=>new Set(chars).size===1;
for(const [n,rows]of Object.entries(sprites)){
 const [w,h]=expected[n],m=specs[n];assert.equal(rows.length,h,n+' height');assert.equal(m.w,w);assert.equal(m.h,h);
 for(const row of rows){assert.equal([...row].length,w,n+' row width');for(const c of row){assert(c==='.'||palette[c],n+' palette '+c);if(c!=='.')used.add(c);}}
 assert(!original.sprites[n],n+' existing sprite collision');
 if(m.ground){grounded++;assert(rows.slice(0,2).every(r=>/^\.+$/.test(r)),n+' top margin');assert(rows.every(r=>r.startsWith('..')&&r.endsWith('..')),n+' side margins');}
 const s=m.slice;if(!s){assert(!/^(ui_|fx_shadow_|prop_rug_).*_(9|3|3v)$/.test(n),n+' missing slice');continue;}slices++;
 // All horizontal stretched strips must be row-constant; vertical strips column-constant.
 if(s.type==='9'||s.type==='3')for(let y=0;y<h;y++)assert(uniform([...rows[y]].slice(s.a,w-s.b)),n+' horizontal stretch row '+y);
 if(s.type==='9'||s.type==='3v')for(let x=0;x<w;x++)assert(uniform(rows.slice(s.a,h-s.b).map(r=>[...r][x])),n+' vertical stretch column '+x);
 assert(s.a+s.b<(s.type==='3v'?h:w),n+' valid slice width');
}
for(const[c,hex]of Object.entries(palette)){assert.equal(hex,original.palette[c],'Exact palette reuse '+c);assert(used.has(c),'Unused palette '+c);}
// Enforce nearest sRGB project hues across all four color sets, including non-ASCII keys.
const channels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const targets=['#e8873a','#5aa469','#4a90c2','#c25a7a','#8a6fc9','#d9b23a','#4fb3a9','#a05a3a'];
for(let i=0;i<8;i++){const target=channels(targets[i]);const dist=h=>channels(h).reduce((s,v,j)=>s+(v-target[j])**2,0);const best=Math.min(...Object.values(original.palette).map(dist));const hue=sprites['ui_pill_'+i+'_9'][4][4];assert.equal(dist(palette[hue]),best,'Nearest hue '+i);for(const n of ['icon_project_'+i,'icon_project_mini_'+i,'prop_shelf_box_'+i])assert(sprites[n].some(r=>r.includes(hue)),n+' shared hue');}
const shape=n=>sprites[n].map(r=>r.replace(/[^.]/g,'#')).join('\n');
for(const family of [['ui_bar_fill_green_3','ui_bar_fill_yellow_3','ui_bar_fill_red_3'],['ui_chip_todo_9','ui_chip_done_9','ui_chip_alert_9'],['ui_gauge_fill_blue_3v','ui_gauge_fill_gold_3v','ui_gauge_fill_red_3v']])for(const n of family)assert.equal(shape(n),shape(family[0]),n+' identical shape');
assert.equal(shape('desk_wood_main'),original.sprites.desk_laminate_main.map(r=>r.replace(/[^.]/g,'#')).join('\n'),'Desktop silhouette');
let deskChanges=0,purple=0;for(let y=0;y<28;y++)for(let x=0;x<72;x++){const a=sprites.prop_research_desk[y][x],b=sprites.prop_research_desk_on[y][x];if(a!==b){deskChanges++;assert(x>=31&&x<=48&&y>=8&&y<=14,'Research glow confined to book');if(b===';')purple++;}}assert(deskChanges>0);assert.equal(purple,1,'One purple glint');
assert.equal(shape('prop_star_deco_0'),shape('prop_star_deco_1'),'Stable star canvas and silhouette');
for(const n of ['fx_shadow_3','prop_rug_3'])assert.equal(new Set(sprites[n].join('').replaceAll('.','')).size,1,n+' one opaque color');
for(const n of ['ui_board_glow_9','fx_shelf_glow']){const r=sprites[n];for(let y=2;y<r.length-2;y++)assert(/^\.+$/.test(r[y].slice(2,-2)),n+' transparent center');}
for(let y=3;y<=40;y++)assert.equal(sprites.prop_fever_gauge[y].slice(3,12),'W'.repeat(9),'Gauge exact window');
console.log(`PASS: ${Object.keys(sprites).length} exact names/sizes; ${grounded} grounded margins; ${slices} slice invariants; ${used.size} reused colors; 0 new colors; hue/state/book/star/window/transparent-center consistency.`);


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

﻿function stretch(rows,s,w,h){
 const sw=rows[0].length,sh=rows.length;
 function axis(p,dst,src,a,b){return p<a?p:p>=dst-b?src-(dst-p):a+Math.floor((p-a)*(src-a-b)/(dst-a-b));}
 return Array.from({length:h},(_,y)=>Array.from({length:w},(_,x)=>{
  const sx=s.type==='3v'?x:axis(x,w,sw,s.a,s.b);
  const sy=s.type==='3'?y:axis(y,h,sh,s.a,s.b);
  return rows[sy][sx];
 }).join(''));
}
fs.mkdirSync(out,{recursive:true});const all=Object.entries(sprites);
for(const[n,rows]of all){const m=specs[n];const pic=surface(m.w*4,m.h*4,gray);draw(pic,rows,0,0);save(path.join(out,n+'.png'),pic);
 if(m.slice){const w=m.slice.type==='3v'?m.w:m.slice.type==='9'?96:80,h=m.slice.type==='3'?m.h:40;
 const stretched=stretch(rows,m.slice,w,h),image=surface(w*4,h*4,gray);draw(image,stretched,0,0);save(path.join(out,'stretch-'+n+'.png'),image);
 }
}
// Grouped rows and wide cells preserve all labels and 116px-wide art at native 4x.
const cols=3,cellW=488,cellH=208;const groups=['G','H','I','J','K'];
let height=64;for(const g of groups)height+=32+Math.ceil(all.filter(([n])=>specs[n].group===g).length/cols)*cellH;
const sheet=surface(cols*cellW,height,gray);label(sheet,'MIYUKE / VISIBLE SYSTEMS / ORDER 2',16,12,'#2F3444');label(sheet,'4X NEAREST / 808080 / '+all.length+' SPRITES / ZERO NEW COLORS',16,32,'#2F3444');let offset=64;
for(const g of groups){label(sheet,'GROUP '+g,16,offset+8,'#2F3444');offset+=32;const list=all.filter(([n])=>specs[n].group===g);list.forEach(([n,r],i)=>{const x=i%cols*cellW,y=offset+Math.floor(i/cols)*cellH;label(sheet,n,x+12,y+6,'#2F3444');label(sheet,r[0].length+' X '+r.length+' PX',x+12,y+22,'#2F3444');draw(sheet,r,x+Math.floor((cellW-r[0].length*4)/2),y+cellH-8-r.length*4);});offset+=Math.ceil(list.length/cols)*cellH;}
save(path.join(out,'contact-sheet.png'),sheet);
// Read emitted PNG headers back to verify the complete artifact inventory and pixel sizes.
const expectedFiles=['contact-sheet.png'];
for(const[n,r]of all){const m=specs[n];expectedFiles.push(n+'.png');if(m.slice)expectedFiles.push('stretch-'+n+'.png');
 for(const stretched of [false,...(m.slice?[true]:[])]){
  const file=(stretched?'stretch-':'')+n+'.png',png=fs.readFileSync(path.join(out,file));
  const w=stretched?(m.slice.type==='3v'?m.w:m.slice.type==='9'?96:80):m.w;
  const h=stretched?(m.slice.type==='3'?m.h:40):m.h;
  assert.equal(png.readUInt32BE(16),w*4,file+' output width');assert.equal(png.readUInt32BE(20),h*4,file+' output height');
  assert.equal(png[25],2,file+' opaque RGB preview');
 }
}
assert.deepEqual(fs.readdirSync(out).sort(),expectedFiles.sort(),'Exact PNG artifact inventory');
console.log('PASS: emitted PNG inventory, 4x dimensions, opaque RGB headers.');
console.log(`Written: ${all.length} individual PNGs + ${slices} stretch PNGs + contact-sheet.png (all 4x nearest on #808080).`);
