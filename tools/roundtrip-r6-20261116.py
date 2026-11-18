import json, os, subprocess, sys

REPO = os.path.expanduser('~/workspace/miyuke-game')
ART = os.path.expanduser('~/workspace/tools/artwork')

# 作画側パレット解決: gpt_era (char->hex) + S12 トーン (hex->char) +
# finish_s レジストリ (hex->char)。競合があれば即エラーにする
char2hex = {}
for c, h in json.load(open(os.path.join(ART, 'gpt_era.json')))['palette'].items():
    char2hex[c] = h.upper()
for fname in ('s12_colors.json', 'extra_colors.json'):
    for h, c in json.load(open(os.path.join(ART, fname))).items():
        if c in char2hex and char2hex[c] != h.upper():
            raise SystemExit(f'palette char conflict: {c} {char2hex[c]} vs {h}')
        char2hex[c] = h.upper()

node_code = """
const fs = require('node:fs');
const vm = require('node:vm');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('graphics/sprites.js', 'utf8'), context);
process.stdout.write(JSON.stringify(context.window.MIYUKE_SPRITES));
"""
out = subprocess.run(['node', '-e', node_code], capture_output=True, text=True, cwd=REPO)
data = json.loads(out.stdout)
palette, sprites = data['palette'], data['sprites']

# R6 描き直し37点 (tablet / succulent / storage_box は sakuri 版が正本で除外)
slugs = ['desk_l', 'desk_lift', 'table_long', 'side_table', 'wagon',
         'bookshelf', 'display_shelf', 'locker', 'partition', 'plant_large',
         'rug_large', 'bench',
         'sofa', 'printer', 'router', 'headphone_stand', 'speaker', 'mic_arm',
         'power_strip', 'nas', 'vr_headset', 'flower_vase', 'kettle', 'mug',
         'globe', 'plush', 'gaming_chair', 'zabuton', 'safe', 'toaster',
         'shredder', 'mirror', 'humidifier', 'robot_vacuum', 'vending',
         'heater', 'kotatsu']
jobs = [(f'prop_{s}_r6', f'prop_{s}') for s in slugs]

total_diff = 0
for base, name in jobs:
    src = json.load(open(os.path.join(ART, base + '.json')))[base]
    rows = sprites[name]
    assert len(rows) == len(src) and len(rows[0]) == len(src[0]), f'{name}: size mismatch'
    diff = 0
    for y in range(len(src)):
        for x in range(len(src[0])):
            want = src[y][x]
            ch = rows[y][x]
            if want == '.':
                ok = ch == '.'
            else:
                ok = ch != '.' and palette[ch].upper() == char2hex[want]
            if not ok:
                diff += 1
    total_diff += diff
    print(f'{name}: diff {diff}')
print(f'TOTAL DIFF: {total_diff} across {len(jobs)} sprites')
sys.exit(1 if total_diff else 0)
