import os, subprocess, sys
from PIL import Image

REPO = os.path.expanduser('~/workspace/miyuke-game')
PNGDIR = os.path.join(REPO, 'research/art-refs-20261111-furniture-new/png')
TOOL = os.path.join(REPO, 'tools/import-sakuri-art.py')

# みゅー作画 新規16点 (2026-11-11 作画・S12 適用済み): PNG は正本マップ
# (~/workspace/tools/artwork/<base>.json) から実色で書き出したもの。
# PNG 名 = スプライト名 (prop_ + ベース名から new_ を除いたもの)
slugs = ['cardboard_fort', 'cat_rack', 'keyboard', 'monitors', 'ipo_bell',
         'build_lamp', 'hammock', 'laser', 'can_tower', 'stock_board',
         'first_desk', 'massage_chair', 'snack_wagon', 'paper_pile',
         'xmas_tree', 'sunny_perch']
jobs = [(f'prop_{s}.png', f'prop_{s}') for s in slugs]

print(f'{len(jobs)} import jobs')
for png, name in jobs:
    path = os.path.join(PNGDIR, png)
    im = Image.open(path)
    cell = f'{im.width}x{im.height}'
    r = subprocess.run([sys.executable, TOOL, 'sheet', path, '--name', name,
                        '--cell', cell, '--static', '--no-validate'],
                       capture_output=True, text=True, cwd=REPO)
    tail = (r.stdout + r.stderr).strip().splitlines()
    print(f'--- {name} ({cell}) rc={r.returncode}')
    for line in tail[-6:]:
        print('   ', line)
    if r.returncode != 0:
        print('FAILED, aborting batch')
        sys.exit(1)
print('ALL IMPORTS DONE')
