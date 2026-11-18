import json, os, re, subprocess, sys
from PIL import Image

REPO = os.path.expanduser('~/workspace/miyuke-game')
ART = os.path.expanduser('~/workspace/tools/artwork')
PNGDIR = os.path.join(REPO, 'research/art-refs-20261111-furniture-r6/png')
TOOL = os.path.join(REPO, 'tools/import-sakuri-art.py')

# 作画側パレット解決: gpt_era (char->hex) + S12 トーン (hex->char) +
# finish_s レジストリ (hex->char)。競合があれば即エラーにする
# (roundtrip-new16-20261116.py と同じ解決規則)
char2hex = {}
for c, h in json.load(open(os.path.join(ART, 'gpt_era.json')))['palette'].items():
    char2hex[c] = h.upper()
for fname in ('s12_colors.json', 'extra_colors.json'):
    for h, c in json.load(open(os.path.join(ART, fname))).items():
        if c in char2hex and char2hex[c] != h.upper():
            raise SystemExit(f'palette char conflict: {c} {char2hex[c]} vs {h}')
        char2hex[c] = h.upper()

# みゅー作画 R6 描き直し (2026-11-11・S12-S18 適用済み): 正本マップは
# ~/workspace/tools/artwork/prop_<slug>_r6.json。
# 除外: tablet / succulent / storage_box は sakuri 本人の描き直し版
# (2026-11-13 戻り・c5ec100 統合) が正本なので R6 版は取り込まない。
slugs = ['desk_l', 'desk_lift', 'table_long', 'side_table', 'wagon',
         'bookshelf', 'display_shelf', 'locker', 'partition', 'plant_large',
         'rug_large', 'bench',
         'sofa', 'printer', 'router', 'headphone_stand', 'speaker', 'mic_arm',
         'power_strip', 'nas', 'vr_headset', 'flower_vase', 'kettle', 'mug',
         'globe', 'plush', 'gaming_chair', 'zabuton', 'safe', 'toaster',
         'shredder', 'mirror', 'humidifier', 'robot_vacuum', 'vending',
         'heater', 'kotatsu']

os.makedirs(PNGDIR, exist_ok=True)
print(f'{len(slugs)} import jobs')
total_new = 0
for slug in slugs:
    base = f'prop_{slug}_r6'
    rows = json.load(open(os.path.join(ART, base + '.json')))[base]
    h, w = len(rows), len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                hexv = char2hex[ch]
                px[x, y] = (int(hexv[1:3], 16), int(hexv[3:5], 16),
                            int(hexv[5:7], 16), 255)
    png = os.path.join(PNGDIR, f'prop_{slug}.png')
    im.save(png)
    r = subprocess.run([sys.executable, TOOL, 'sheet', png,
                        '--name', f'prop_{slug}', '--cell', f'{w}x{h}',
                        '--static', '--no-validate'],
                       capture_output=True, text=True, cwd=REPO)
    out = r.stdout + r.stderr
    m = re.search(r'PALETTE EXTENDED: (\{.*\})', out)
    n_new = len(re.findall(r'#[0-9A-Fa-f]{6}', m.group(1))) if m else 0
    total_new += n_new
    print(f'--- prop_{slug} ({w}x{h}) rc={r.returncode} new_colors={n_new}')
    if r.returncode != 0:
        print(out)
        print('FAILED, aborting batch')
        sys.exit(1)
print(f'ALL IMPORTS DONE, total new colors: {total_new}')
