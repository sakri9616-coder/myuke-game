'use strict';

// Offline cuteness-pass checks. Run: node validate-sprites.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const context = { window: {} };
const source = fs.readFileSync(path.join(__dirname, 'sprites.js'), 'utf8');
vm.runInNewContext(source, context, { timeout: 1000 });
const { palette, sprites } = context.window.MIYUKE_SPRITES;
const coats = ['kuro', 'chatora', 'sabatora', 'hachiware', 'shiro', 'syamu', 'hachiware_gray', 'chashiro'];
const required = [
  ...['idle', 'code_a', 'code_b', 'think', 'debug', 'sleep', 'yarn', 'snack', 'happy'].map(pose => `miyuke_${pose}`),
  // sakuri作画アニメーションのフレーム (Sprint 1: バリデーション対象に追加)
  ...Array.from({length: 6}, (_, i) => `miyuke_idle_${i}`),
  ...Array.from({length: 17}, (_, i) => `miyuke_snack_${i}`),
  // sakuri作画バッチ2 (code_a はモニタ込みポーズ、sleep は Z 込み)
  ...Array.from({length: 4}, (_, i) => `miyuke_code_a_${i}`),
  ...Array.from({length: 6}, (_, i) => `miyuke_sleep_${i}`),
  // sakuri作画バッチ4 (happy: リリース時の celebrate ポーズ)
  ...Array.from({length: 10}, (_, i) => `miyuke_happy_${i}`),
  // sakuri作画バッチ8 (yarn: 一人遊び「毛糸玉」の本編アニメ)
  ...Array.from({length: 13}, (_, i) => `miyuke_yarn_${i}`),
  ...coats.flatMap(coat => ['sit', 'walk'].map(pose => `staff_${coat}_${pose}`)),
  // sakuri作画バッチ9 (syamu 新規 + sabatora アニメ化: walk 9f + sit 6f)
  ...['syamu', 'sabatora'].flatMap(coat => [
    ...Array.from({length: 9}, (_, i) => `staff_${coat}_walk_${i}`),
    ...Array.from({length: 6}, (_, i) => `staff_${coat}_sit_${i}`)]),
  // sakuri作画バッチ10 (hachiware アニメ化: walk 9f + sit 6f — 全毛柄 ANIMS 化完了)
  // バッチ13差し替え: hachiware は全面描き直しで sit が 5f になった (ファイルが正)
  ...Array.from({length: 9}, (_, i) => `staff_hachiware_walk_${i}`),
  ...Array.from({length: 5}, (_, i) => `staff_hachiware_sit_${i}`),
  // sakuri作画バッチ13 (hachiware_gray 新規: walk 9f + sit 5f / chashiro 新規: walk 9f + sit 6f)
  ...Array.from({length: 9}, (_, i) => `staff_hachiware_gray_walk_${i}`),
  ...Array.from({length: 5}, (_, i) => `staff_hachiware_gray_sit_${i}`),
  ...Array.from({length: 9}, (_, i) => `staff_chashiro_walk_${i}`),
  ...Array.from({length: 6}, (_, i) => `staff_chashiro_sit_${i}`),
  // 環境ドット絵 (Codex 一次作・ENV_ART_MANIFEST)
  'prop_kanban', 'desk_laminate_main', 'desk_laminate_2', 'desk_laminate_2_sprite',
  'prop_chair', 'prop_server_rack', 'shelf_steel', 'prop_books', 'prop_archive_boxes', 'prop_mat',
  'duck_idle', 'duck_check',
  // sakuri作画バッチ11 (prop_coffee: 湯気2フレームの小物アニメ)
  'prop_coffee_0', 'prop_coffee_1',
  ...['coin', 'idea', 'bug', 'box', 'star', 'fish', 'book', 'wrench', 'heart'].map(item => `icon_${item}`),
  ...['plant', 'coffee', 'server', 'packmachine', 'shelf', 'pc'].map(item => `prop_${item}`),
];
const props = { prop_plant: [16, 20], prop_coffee: [28, 28], prop_coffee_0: [28, 28], prop_coffee_1: [28, 28], prop_server: [24, 32], prop_packmachine: [48, 24], prop_shelf: [40, 28], prop_pc: [40, 32], prop_ship: [48, 48], prop_annex_sign: [48, 48], prop_sign_gold: [48, 48], prop_star_gold: [24, 24], prop_trophy_gold: [24, 24], prop_snackbox: [24, 24], prop_snackbox_shut: [24, 24],
  /* Sprint 4: 第2ラインの机と壁飾りスロット（仮絵・さくら差し替え可） */
  prop_desk2: [64, 64], prop_wall_1: [20, 24], prop_wall_2: [20, 24], prop_wall_3: [28, 16],
  /* 環境ドット絵 (Codex 一次作): 家具は帯の実フットプリント寸法が正本 */
  prop_kanban: [132, 30], prop_kanban_wide: [204, 64], prop_phone: [24, 24], prop_megaphone: [24, 24], prop_toolbox: [24, 24], desk_laminate_main: [116, 3], desk_laminate_2: [80, 16],
  desk_laminate_2_sprite: [40, 24], prop_chair: [32, 36], prop_server_rack: [48, 64],
  shelf_steel: [40, 28], prop_books: [24, 7], prop_archive_boxes: [18, 25], prop_mat: [150, 4] };
const ENV_SPRITES = new Set(['prop_kanban', 'prop_kanban_wide', 'prop_phone', 'prop_megaphone', 'prop_toolbox', 'desk_laminate_main', 'desk_laminate_2',
  'desk_laminate_2_sprite', 'prop_chair', 'prop_server_rack', 'shelf_steel',
  'prop_books', 'prop_archive_boxes', 'prop_mat']);
function expected(name) {
  /* sakuri作画スタッフアニメのフレーム (staff_<coat>_<pose>_N) は 48×40 統一仕様。
     基準名そのものの旧スタッフ絵は従来どおり 32×24 */
  if (/^staff_\w+_(?:sit|walk)_\d+$/.test(name)) return [48, 40];
  /* バッチ9: syamu の基準絵は sakuri作画フレーム (48×40) そのもの。
     バッチ13: hachiware_gray / chashiro も同様 (旧絵が無い新規毛柄) */
  if (/^staff_(syamu|hachiware_gray|chashiro)_(?:sit|walk)$/.test(name)) return [48, 40];
  if (name === 'icon_box') return [28, 28];   /* バッチ12: sakuri 作画の荷物箱は 28×28 */
  if (name === 'icon_bug') return [28, 28];   /* 2026-10-26: sakuri 作り直しのバグは 28×28 */
  if (name === 'icon_wrench') return [28, 28];   /* バッチ14: sakuri 作画のスパナは 28×28 */
  return name.startsWith('miyuke_') ? [48, 40] : name.startsWith('staff_') ? [32, 24]
    : name.startsWith('duck_') ? [24, 20] : name.startsWith('bot_') ? [24, 20]
    : name.startsWith('icon_') ? [16, 16] : props[name];
}
function components(rows, include = () => true) {
  const width = rows[0].length;
  const unseen = new Set();
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (key !== '.' && include(x, y, key)) unseen.add(y * width + x);
  }));
  const result = [];
  while (unseen.size) {
    const first = unseen.values().next().value, stack = [first], pixels = [];
    unseen.delete(first);
    while (stack.length) {
      const current = stack.pop(), x = current % width, y = Math.floor(current / width);
      pixels.push([x, y]);
      for (const [nx, ny] of [[x-1, y], [x+1, y], [x, y-1], [x, y+1]]) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= rows.length) continue;
        const next = ny * width + nx;
        if (unseen.delete(next)) stack.push(next);
      }
    }
    result.push(pixels);
  }
  return result.sort((a, b) => b.length - a.length);
}

// Semantic exclusions are explicit object regions, not a rule that blindly
// accepts all small components. The cat is checked again without any prop
// that could otherwise conceal a detached limb by joining it to the body.
const catOnly = {
  miyuke_idle: () => true,
  miyuke_code_a: (x, y) => !(x >= 4 && x <= 13 && y >= 21 && y <= 31)
    && !(x >= 8 && x <= 11 && y >= 32 && y <= 35) && !(x >= 4 && x <= 33 && y >= 36),
  miyuke_code_b: (x, y) => !(x >= 4 && x <= 13 && y >= 21 && y <= 31)
    && !(x >= 8 && x <= 11 && y >= 32 && y <= 35) && !(x >= 4 && x <= 33 && y >= 36),
  miyuke_think: (x, y) => !(x >= 37 && y <= 13),
  miyuke_debug: (x, y) => !(x >= 21 && x <= 26 && y >= 37),
  miyuke_sleep: (x, y) => y >= 19 && y <= 36,
  miyuke_yarn: (x, y) => !(x <= 14 && y >= 30) && !(x <= 21 && y >= 38),
  miyuke_snack: (x, y, key) => !'BbC'.includes(key),
  miyuke_happy: x => x >= 10 && x <= 40,
};
const extras = {
  miyuke_think: [[37, 5, 41, 10], [38, 12, 39, 13]],
  miyuke_debug: [[21, 37, 26, 39]],
  miyuke_sleep: [[31, 7, 36, 11], [39, 15, 42, 18]],
  miyuke_happy: [[5, 11, 7, 13], [41, 7, 43, 9]],
};
const extraLabels = {
  miyuke_think: 'question-mark hook + dot', miyuke_debug: 'bug target',
  miyuke_sleep: 'two Z glyphs', miyuke_happy: 'two sparkles',
};

for (const name of required) assert.ok(sprites[name], `required sprite missing: ${name}`);
assert.equal(Object.keys(palette).length, 163, 'Shared palette count changed (23 base + 140 extension: 17 batch1 + 5 batch2 monitor + 2 batch2 sleep-Z + 2 batch3 + 2 batch4 happy sparkles + 1 batch5 walk + 2 batch6 staff shiro eyes/collar + 5 batch7 staff kuro + 8 batch7 staff chatora + 3 batch8 yarn purples + 10 batch9 syamu siamese + 4 batch9 sabatora silver + 1 batch10 hachiware muzzle + 7 batch11 coffee mug shades + 7 batch12 icon_box parcel browns + 2 batch13 hachiware_gray + 4 batch13 chashiro + 1 batch14 chatora tan + 2 batch14 wrench steel + 9 batch14 desk2 + 5 batch14 megaphone + 15 annex sign (Codex, quantized on integration) + 26 wave J gold props (Codex sign/star/trophy))');
for (const [key, value] of Object.entries(palette)) {
  assert.equal(key.length, 1); assert.notEqual(key, '.'); assert.match(value, /^#[0-9a-f]{6}$/i);
}

let failed = 0;
function check(test, message) { if (!test) { console.error(`FAIL: ${message}`); failed++; } }
// (旧) バイト単位の保護ハッシュは、sakuriさんのパレット拡張とアニメ資産の
// 追加で失効した。代わりに下の構造検査 (寸法・行長・未定義文字・接地) が
// 全エントリを走査する。加えて sprites.js と game/index.html の内蔵コピーの
// 一致をここで必須化する (二重管理の乖離検出)。
{
  const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'game', 'index.html'), 'utf8');
  const grab = t => { const i = t.indexOf('window.MIYUKE_SPRITES'); return t.slice(i, t.indexOf('\n};', i) + 3); };
  check(grab(gameSrc) === grab(source), 'game/index.html embedded MIYUKE_SPRITES differs from sprites.js');
  const grabA = t => { const i = t.indexOf('window.MIYUKE_ANIMS'); return i < 0 ? '' : t.slice(i, t.indexOf('/* ===== MIYUKE_ANIMS ここまで ===== */', i)); };
  check(grabA(gameSrc) === grabA(source), 'game/index.html embedded MIYUKE_ANIMS differs from sprites.js');
  console.log('PASS: embedded copies in game/index.html match sprites.js (sprites + ANIMS).\n');
  /* B-P1-2: 子ねこボットのスプライト契約（名前＋寸法のみ。絵自体は未着手で、
     required には入れない）。絵が届いたら上の expected() 経由で寸法検査される */
  for (const name of ['bot_idle', 'bot_carry']) {
    check(gameSrc.includes('SPRITE_SPEC["' + name + '"]'), 'bot sprite contract missing in game/index.html: ' + name);
    check(JSON.stringify(expected(name)) === '[24,20]', 'bot sprite contract size is 24x20: ' + name);
    /* 絵が届いた場合の実寸検査は下の全エントリ走査（expected() 経由）が担う */
  }
}
console.log('| Sprite | Actual W×H | Required W×H | Result |');
console.log('| --- | --- | --- | --- |');
for (const [name, rows] of Object.entries(sprites)) {
  const [w, h] = expected(name);
  const rectangular = Array.isArray(rows) && rows.length > 0 && rows.every(row => typeof row === 'string' && row.length === rows[0].length);
  const pass = rectangular && rows.length === h && rows[0].length === w;
  console.log(`| ${name} | ${rows[0].length}×${rows.length} | ${w}×${h} | ${pass ? 'PASS' : 'FAIL'} |`);
  check(pass, `${name}: dimensions / equal row widths`);
  if (!rectangular) continue;
  // sakuri作画アニメのフレームは本人の構図が正本 (code_a のモニタは x=1 まで、
  // sleep の Z は上端近くまで届き、debug の伸びポーズは row 1 まで届く) なので、
  // Codex時代のマージン規則は適用しない
  const sakuriAnim = /^(?:miyuke_(idle|snack|code_a|sleep|think|debug|happy|walk|yarn)|staff_\w+_(?:walk|sit))_\d+$/.test(name)
    || /^staff_(syamu|hachiware_gray|chashiro)_(?:walk|sit)$/.test(name);
  /* 環境ドット絵は帯の実フットプリントに合わせて端まで描くのが正本
     (カンバンの枠・机の天板など) なので、マージン規則の対象外。
     接地だけを個別に担保する */
  const envSprite = ENV_SPRITES.has(name);
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    check(key === '.' || Object.hasOwn(palette, key), `${name}: unknown key ${key} at ${x},${y}`);
    if (!sakuriAnim && !envSprite && (y < 2 || x < 2 || x >= w - 2)) check(key === '.', `${name}: margin at ${x},${y}`);
  }));
  if (name.startsWith('staff_')) {
    check(rows.slice(0, 6).every(row => /^\.+$/.test(row)), `${name}: maximum 18px occupied height`);
  }
  if (sakuriAnim) {
    // sakuri作画アニメ: 接地は「下2行のどちらかに画素がある」ことだけを見る
    check(/[^.]/.test(rows[h-1]) || /[^.]/.test(rows[h-2]), `${name}: ground contact in bottom 2 rows`);
    continue;
  }
  if (name === 'prop_megaphone') {
    // sakuri作画バッチ14: 原画は内容が row 22 までで最下行が透明。接地は
    // row 22 で担保し、描画側はアンカーを 1 押し下げて地面に載せる
    check(/[^.]/.test(rows[22]), `${name}: content bottom contact at row 22 (sakuri megaphone)`);
    continue;
  }
  if (envSprite) {
    // 環境ドット絵: 最下行に画素があること (接地) だけを担保する
    check(/[^.]/.test(rows[h-1]), `${name}: bottom-row contact (env)`);
    continue;
  }
  if (name === 'prop_coffee' || name === 'prop_coffee_0' || name === 'prop_coffee_1') {
    // sakuri作画バッチ11: 原画は内容が row 25 までで下2行が透明 (ソーサーが
    // 内容下端)。接地は row 25 で担保し、描画側はアンカーを 2*scale 押し下げて
    // 天板に載せる。湯気は上端近くまで届く本人の構図が正本
    check(/[^.]/.test(rows[25]), `${name}: content bottom contact at row 25 (sakuri coffee)`);
    continue;
  }
  if (name === 'prop_desk2') {
    // sakuri作画バッチ14: 原画 (64×64) は内容が row 60 までで下3行が透明。
    // 接地は row 60 で担保し、描画側はアンカーを 3行×2倍 = 6 押し下げて
    // 脚・引き出しの下端を地面に載せる (prop_coffee と同じ流儀)
    check(/[^.]/.test(rows[60]), `${name}: content bottom contact at row 60 (sakuri desk2)`);
    continue;
  }
  if (!name.startsWith('icon_') && name !== 'miyuke_happy') {
    check(/[^.]/.test(rows[h-1]), `${name}: bottom-row contact`);
    if (!name.startsWith('prop_')) check(/[^.]/.test(rows[h-2]), `${name}: both ground rows occupied`);
  }
  if (name.startsWith('miyuke_') && name !== 'miyuke_happy') {
    check(rows.slice(0, 4).every(row => /^\.+$/.test(row)), `${name}: seated ear top above row 4`);
  }
  if (name === 'miyuke_happy') check(rows.slice(36).every(row => /^\.+$/.test(row)), 'Happy: four clear rows beneath jump');
}

console.log('\nFour-neighbor connected components (diagonal contact does not count):');
/* 解剖学チェック (脚スパン・目・鼻・頭寸法) は Codex 時代の基準絵 (32×24) 専用。
   sakuri作画のスタッフアニメフレーム (_N) は次ブロックで 1 連結だけを見る */
for (const [name, rows] of Object.entries(sprites).filter(([name]) => name.startsWith('staff_') && !/_\d+$/.test(name)
  && !/^staff_(syamu|hachiware_gray|chashiro)_(?:sit|walk)$/.test(name))) {
  const count = components(rows).length;
  check(count === 1, `${name}: ${count} cat components`);
  console.log(`${name}: ${count} component — ${count === 1 ? 'PASS' : 'FAIL'}`);
  if (name.endsWith('_walk')) {
    const contacts = [...rows.at(-1).matchAll(/[^.]+/g)].map(match => [match.index, match.index + match[0].length - 1]);
    for (const y of [21, 22, 23]) {
      const spans = [...rows[y].matchAll(/[^.]+/g)].map(match => [match.index, match.index + match[0].length - 1]);
      check(JSON.stringify(spans) === JSON.stringify([[8,10],[12,14],[20,22],[24,26]]), `${name}: four thick separate legs at row ${y}`);
    }
    // Three visible rows below the belly; every foot attaches directly to it.
    for (const [x1, x2] of contacts) {
      for (let y = 20; y <= 23; y++) check(/[^.]/.test(rows[y].slice(x1, x2+1)), `${name}: leg at ${x1},${y}`);
    }
  } else {
    for (const x of [12, 18]) for (let y = 21; y <= 23; y++) {
      check(/^[^.]{4}$/.test(rows[y].slice(x, x+4)), `${name}: three-row, four-pixel-wide front paw`);
    }
  }
  const headX = name.endsWith('_walk') ? 4 : 9;
  const eye = name.startsWith('staff_kuro_') ? 'Y' : 'K';
  check(rows[12][headX+4] === eye && rows[12][headX+9] === eye && rows[13][headX+6] === 'P', `${name}: two readable eyes and a pink nose`);
  check(rows[6][headX+1] === 'O' && rows[17].slice(headX+3,headX+11) === 'OOOOOOOO', `${name}: 12px head, ear tips through jaw`);
}
/* sakuri作画スタッフアニメのフレーム: 体は 1 連結であることだけを担保する
   (歩行の脚も瞬きの瞼も本体から離れない)。バッチ9 の syamu 基準絵
   (フレーム1枚の複製) も同じ扱いにする */
for (const [name, rows] of Object.entries(sprites).filter(([name]) => /^staff_\w+_(?:walk|sit)_\d+$/.test(name)
  || /^staff_(syamu|hachiware_gray|chashiro)_(?:walk|sit)$/.test(name))) {
  const count = components(rows).length;
  check(count === 1, `${name}: ${count} cat components (sakuri staff frame)`);
  console.log(`${name}: ${count} component — ${count === 1 ? 'PASS' : 'FAIL'}`);
}
for (const [name, rows] of Object.entries(sprites).filter(([name]) => required.includes(name) && name.startsWith('miyuke_') && !/_\d+$/.test(name))) {
  const all = components(rows), cat = components(rows, catOnly[name]), allowed = extras[name] || [];
  const validExtras = all.length === 1 + allowed.length && all.slice(1).every(component =>
    allowed.some(([x1, y1, x2, y2]) => component.every(([x, y]) => x >= x1 && x <= x2 && y >= y1 && y <= y2)));
  check(validExtras, `${name}: unrecognized extra component`);
  check(cat.length === 1, `${name}: ${cat.length} cat-only components after excluding props`);
  if (['miyuke_code_a', 'miyuke_code_b', 'miyuke_debug'].includes(name)) {
    for (const y of [38,39]) check(cat[0].some(([,py]) => py === y), `${name}: cat itself grounded on row ${y}`);
    check(rows.slice(8,23).every((row, i) => row.slice(15,33) === sprites.miyuke_idle[8+i].slice(15,33)), `${name}: idle face and markings retained exactly`);
  }
  console.log(`${name}: ${all.length} total; cat-only ${cat.length}; ${extraLabels[name] || 'no detached objects'} — ${validExtras && cat.length === 1 ? 'PASS' : 'FAIL'}`);
}

const a = sprites.miyuke_code_a, b = sprites.miyuke_code_b;
let changed = 0, silhouetteChanges = 0;
a.forEach((row, y) => [...row].forEach((key, x) => {
  if (key !== b[y][x]) {
    changed++;
    if ((key === '.') !== (b[y][x] === '.')) silhouetteChanges++;
    check(((x >= 18 && x <= 23) || (x >= 25 && x <= 30)) && y >= 33 && y <= 35, `Typing changed a non-paw pixel at ${x},${y}`);
  }
}));
check(changed > 0 && silhouetteChanges > 0, 'Typing must change paw position, not only color');
for (const rows of [a, b]) {
  for (const [x1, x2] of [[18,23],[25,30]]) check(/[^.]/.test(rows[35].slice(x1,x2+1)), 'Both typing paws touch deck');
}
console.log(`\nTyping: ${changed} changed pixels (${silhouetteChanges} silhouette changes), confined to paws; both paws touch deck.`);
console.log('Staff proportions: sit and walk heads 14×12px (rows 6–17, 50% of canvas height); visible legs 3px (rows 21–23); sit paws 4px wide, walk paws 3px wide.');
/* ---- ANIMS (生成物) の整合: フレーム実在・durations 長・ループ範囲・snack 総尺 ---- */
{
  const anims = context.window.MIYUKE_ANIMS || {};
  check(anims.miyuke_idle && anims.miyuke_snack, 'MIYUKE_ANIMS has idle + snack');
  for (const [base, a] of Object.entries(anims)) {
    check(Array.isArray(a.frames) && Array.isArray(a.durations) && a.frames.length === a.durations.length,
      `${base}: frames/durations length mismatch`);
    for (const fn of a.frames) check(!!sprites[fn], `${base}: frame sprite missing: ${fn}`);
    check(a.loopFrom >= 0 && a.loopTo >= a.loopFrom && a.loopTo < a.frames.length, `${base}: loop range out of bounds`);
  }
  if (anims.miyuke_snack) {
    const a = anims.miyuke_snack;
    const seg = (i0, i1) => a.durations.slice(i0, i1 + 1).reduce((x, y) => x + y, 0);
    const total = seg(0, a.loopFrom - 1) + seg(a.loopFrom, a.loopTo) * a.loopCount + seg(a.loopTo + 1, a.frames.length - 1);
    check(total === 4500, `snack total must be 4500ms (got ${total})`);
    check(a.loopFrom === 3 && a.loopTo === 13, 'snack loop must be the file tag range (0-based 3..13)');
  }
  /* sakuri作画バッチ2: code_a (300ms×4・モニタ込み) / idle は .aseprite 版
     300ms×6 が正本。バッチ3: sleep はファイル内 600ms×7 が正本 */
  if (anims.miyuke_code_a) {
    const a = anims.miyuke_code_a;
    check(a.frames.length === 4 && a.durations.every(d => d === 300),
      `code_a anim must be 4 frames x 300ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
  }
  if (anims.miyuke_sleep) {
    const a = anims.miyuke_sleep;
    check(a.frames.length === 7 && a.durations.every(d => d === 600),
      `sleep anim must be 7 frames x 600ms (encoded in file; got ${JSON.stringify(a.durations)})`);
    check(a.loopCount === Infinity, 'sleep anim must loop forever');
  }
  if (anims.miyuke_idle) {
    check(anims.miyuke_idle.durations.every(d => d === 300),
      `idle anim durations must be 300ms (aseprite canonical; got ${JSON.stringify(anims.miyuke_idle.durations)})`);
  }
  /* sakuri作画バッチ3: think (300ms×4) / debug (300ms×7) */
  if (anims.miyuke_think) {
    const a = anims.miyuke_think;
    check(a.frames.length === 4 && a.durations.every(d => d === 300) && a.loopCount === Infinity,
      `think anim must be 4 frames x 300ms looping (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
  }
  if (anims.miyuke_debug) {
    const a = anims.miyuke_debug;
    check(a.frames.length === 7 && a.durations.every(d => d === 300) && a.loopCount === Infinity,
      `debug anim must be 7 frames x 300ms looping (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
  }
  /* sakuri作画バッチ4: happy (300ms×10・1回再生して最終フレームで静止。
     celebrate 状態 4500ms のうち前半3秒が本編、残りは締めの通常立ち) */
  if (anims.miyuke_happy) {
    const a = anims.miyuke_happy;
    check(a.frames.length === 10 && a.durations.every(d => d === 300),
      `happy anim must be 10 frames x 300ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 9 && a.loopCount === 1,
      `happy anim must play once (loop 0..9 x1; got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    const seg = (i0, i1) => a.durations.slice(i0, i1 + 1).reduce((x, y) => x + y, 0);
    const total = seg(0, a.loopFrom - 1) + seg(a.loopFrom, a.loopTo) * a.loopCount + seg(a.loopTo + 1, a.frames.length - 1);
    check(total === 3000, `happy total must be 3000ms (got ${total})`);
  }
  /* sakuri作画バッチ5: walk (7フレーム・ファイル内 durations が正本:
     600,600,300,600,600,600,600 = 周期3900ms・全区間ループ。
     原画は左向き — 移動レイヤー側で右行時に反転する) */
  if (anims.miyuke_walk) {
    const a = anims.miyuke_walk;
    check(a.frames.length === 7 && JSON.stringify(a.durations) === JSON.stringify([600, 600, 300, 600, 600, 600, 600]),
      `walk anim must be 7 frames x [600,600,300,600,600,600,600] (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 6 && a.loopCount === Infinity,
      `walk anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
  }
  /* sakuri作画バッチ6: スタッフ (shiro) — 1ファイルに walk 9f + sit 6f。
     walk はファイル内 durations が正本 (600,600,300,600×6 = 周期5100ms・全区間
     ループ)。sit は全 600ms×6・全区間ループ (最終フレームは F10 の複製で
     開眼ポーズが 1.2s 保持される、作家のループ閉鎖そのまま) */
  if (anims.staff_shiro_walk) {
    const a = anims.staff_shiro_walk;
    check(a.frames.length === 7 && JSON.stringify(a.durations) === JSON.stringify([600, 600, 300, 600, 600, 600, 600]),
      `staff_shiro_walk anim must be the 7-frame walk_loop tag range x [600,600,300,600x4] (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 6 && a.loopCount === Infinity,
      `staff_shiro_walk anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
  }
  if (anims.staff_shiro_sit) {
    const a = anims.staff_shiro_sit;
    check(a.frames.length === 6 && a.durations.every(d => d === 600),
      `staff_shiro_sit anim must be 6 frames x 600ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 5 && a.loopCount === Infinity,
      `staff_shiro_sit anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
  }
  /* sakuri作画バッチ7: スタッフ (kuro / chatora) — shiro と同じ統一仕様
     (1ファイルに walk 9f + sit 6f、ファイル内 durations が正本、全区間ループ)。
     chatora walk F1 の (24,34) は元絵で alpha 23/255 の不可視スペックのため
     取り込み時に透過へ寄せた (原画との差異はこの1pxのみ) */
  for (const coat of ['kuro', 'chatora']) {
    if (anims[`staff_${coat}_walk`]) {
      const a = anims[`staff_${coat}_walk`];
      check(a.frames.length === 7 && JSON.stringify(a.durations) === JSON.stringify([600, 600, 300, 600, 600, 600, 600]),
        `staff_${coat}_walk anim must be the 7-frame walk_loop tag range x [600,600,300,600x4] (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === 6 && a.loopCount === Infinity,
        `staff_${coat}_walk anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
    if (anims[`staff_${coat}_sit`]) {
      const a = anims[`staff_${coat}_sit`];
      check(a.frames.length === 6 && a.durations.every(d => d === 600),
        `staff_${coat}_sit anim must be 6 frames x 600ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === 5 && a.loopCount === Infinity,
        `staff_${coat}_sit anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
  }
  /* sakuri作画バッチ9: スタッフ (chatora 修正版 / syamu 新規 / sabatora アニメ化)。
     chatora はバッチ7と同一の正準形のまま絵だけ差し替え (新規色なし)。
     syamu / sabatora も同じ統一仕様 (1ファイルに walk 9f + sit 6f、
     ファイル内 durations が正本、全区間ループ)。3ファイル共通で F1 の
     (24,34) にある alpha 23 の不可視スペックは取り込み時に透過へ寄せた
     (バッチ7 chatora と同一の扱い・原画との差異はこの1pxのみ) */
  for (const coat of ['syamu', 'sabatora']) {
    if (anims[`staff_${coat}_walk`]) {
      const a = anims[`staff_${coat}_walk`];
      check(a.frames.length === 7 && JSON.stringify(a.durations) === JSON.stringify([600, 600, 300, 600, 600, 600, 600]),
        `staff_${coat}_walk anim must be the 7-frame walk_loop tag range x [600,600,300,600x4] (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === 6 && a.loopCount === Infinity,
        `staff_${coat}_walk anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
    if (anims[`staff_${coat}_sit`]) {
      const a = anims[`staff_${coat}_sit`];
      check(a.frames.length === 6 && a.durations.every(d => d === 600),
        `staff_${coat}_sit anim must be 6 frames x 600ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === 5 && a.loopCount === Infinity,
        `staff_${coat}_sit anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
  }
  /* sakuri作画バッチ13: スタッフ (hachiware 全面描き直し / hachiware_gray 新規 /
     chashiro 新規)。hachiware と hachiware_gray はファイル自体が 14f で sit が
     5f (Idle タグ 9–13 が正本)。walk は従来どおりタグ区間 7f・全区間ループ */
  for (const [coat, sitN] of [['hachiware', 5], ['hachiware_gray', 5], ['chashiro', 6]]) {
    if (anims[`staff_${coat}_walk`]) {
      const a = anims[`staff_${coat}_walk`];
      check(a.frames.length === 7 && JSON.stringify(a.durations) === JSON.stringify([600, 600, 300, 600, 600, 600, 600]),
        `staff_${coat}_walk anim must be the 7-frame walk_loop tag range x [600,600,300,600x4] (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === 6 && a.loopCount === Infinity,
        `staff_${coat}_walk anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
    if (anims[`staff_${coat}_sit`]) {
      const a = anims[`staff_${coat}_sit`];
      check(a.frames.length === sitN && a.durations.every(d => d === 600),
        `staff_${coat}_sit anim must be ${sitN} frames x 600ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
      check(a.loopFrom === 0 && a.loopTo === sitN - 1 && a.loopCount === Infinity,
        `staff_${coat}_sit anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    }
  }
  /* sakuri作画バッチ8: yarn (300ms×13・一回再生して最終フレームで静止。
     一人遊び yarn 状態は 5000ms 滞留で、本編 3900ms + 締めの座り静止
     1100ms という配分。物語アーク (ちょいちょい→飛びかかり→見守り) を
     途中で巻き戻さないため全区間ループにはしない — happy と同じ規約) */
  if (anims.miyuke_yarn) {
    const a = anims.miyuke_yarn;
    check(a.frames.length === 13 && a.durations.every(d => d === 300),
      `yarn anim must be 13 frames x 300ms (got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 12 && a.loopCount === 1,
      `yarn anim must play once (loop 0..12 x1; got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
    const seg = (i0, i1) => a.durations.slice(i0, i1 + 1).reduce((x, y) => x + y, 0);
    const total = seg(0, a.loopFrom - 1) + seg(a.loopFrom, a.loopTo) * a.loopCount + seg(a.loopTo + 1, a.frames.length - 1);
    check(total === 3900, `yarn total must be 3900ms (got ${total})`);
  }
  /* sakuri作画バッチ11: prop_coffee (湯気2フレーム。ファイル内の duration は
     100ms だが、本人の修正で 600ms/フレーム が正本 — sleep と同じ前例。
     湯気はゆっくり揺れるのが正解で、全区間ループの交互表示) */
  if (anims.prop_coffee) {
    const a = anims.prop_coffee;
    check(a.frames.length === 2 && JSON.stringify(a.durations) === JSON.stringify([600, 600]),
      `prop_coffee anim must be 2 frames x 600ms (artist correction; got ${a.frames.length}f ${JSON.stringify(a.durations)})`);
    check(a.loopFrom === 0 && a.loopTo === 1 && a.loopCount === Infinity,
      `prop_coffee anim must loop the whole range forever (got ${a.loopFrom}..${a.loopTo} x${a.loopCount})`);
  }
  console.log('ANIMS: frames exist, durations aligned, loop ranges in bounds, snack total 4500ms.');
}
console.log(failed ? `FAIL: ${failed} checks failed.` : 'PASS: all sprites (legacy + animation frames + prop_pc) — dimensions, equal row widths (ragged = error), palette keys, margins, baselines, staff components, Miyuke cat masks, typing stability, ANIMS consistency, embedded-copy sync.');
process.exitCode = failed ? 1 : 0;
