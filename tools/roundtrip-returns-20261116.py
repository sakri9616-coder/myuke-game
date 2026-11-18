import json, os, subprocess, sys
from PIL import Image

REPO = os.path.expanduser('~/workspace/miyuke-game')
PNGDIR = os.path.join(REPO, 'research/sakuri-returns-20261113/png')

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

jobs = [('prop_tablet.png', 'prop_tablet'),
        ('prop_succulent.png', 'prop_succulent'),
        ('prop_storage_box.png', 'prop_storage_box')]

total_diff = 0
for png, name in jobs:
    im = Image.open(os.path.join(PNGDIR, png)).convert('RGBA')
    rows = sprites[name]
    assert len(rows) == im.height and len(rows[0]) == im.width, f'{name}: size mismatch'
    diff = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            ch = rows[y][x]
            if a < 128:
                ok = ch == '.'
            else:
                ok = ch != '.' and palette[ch].upper() == f'#{r:02X}{g:02X}{b:02X}'
            if not ok:
                diff += 1
    total_diff += diff
    print(f'{name}: diff {diff}')
print(f'TOTAL DIFF: {total_diff} across {len(jobs)} sprites')
sys.exit(1 if total_diff else 0)
