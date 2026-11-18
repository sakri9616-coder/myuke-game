import os, subprocess, sys
from PIL import Image

REPO = os.path.expanduser('~/workspace/miyuke-game')
PNGDIR = os.path.join(REPO, 'research/sakuri-returns-20261113/png')
TOOL = os.path.join(REPO, 'tools/import-sakuri-art.py')

# sakuri 追加戻り3点 (2026-11-13): PNG 名 = スプライト名 (検証済み PNG を使用)
jobs = [('prop_tablet.png', 'prop_tablet'),
        ('prop_succulent.png', 'prop_succulent'),
        ('prop_storage_box.png', 'prop_storage_box')]

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
