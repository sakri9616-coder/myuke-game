import json, os, subprocess, sys
from PIL import Image

REPO = os.path.expanduser('~/workspace/miyuke-game')
PNGDIR = os.path.join(REPO, 'research/sakuri-returns-20261111/png')
TOOL = os.path.join(REPO, 'tools/import-sakuri-art.py')

audit = json.load(open(os.path.join(REPO, 'research/sakuri-returns-20261111/audit.json')))
jobs = []  # (png_file, sprite_name)
for key in sorted(audit.keys()):
    name = key[:-3] if key.endswith('_r5') else key  # prop_x_r5 -> prop_x
    if name == 'prop_console':
        continue  # mixer version: kept aside, NOT prop_console
    jobs.append((key + '.png', name))
jobs.append(('CSgame.png', 'prop_console'))
jobs.append(('prop_3d_printer_r5.png', 'prop_3d_printer'))

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
    for line in tail[-4:]:
        print('   ', line)
    if r.returncode != 0:
        print('FAILED, aborting batch')
        sys.exit(1)
print('ALL IMPORTS DONE')
