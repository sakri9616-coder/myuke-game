# Miyuke sprite pack — cuteness pass

Load `sprites.js` as a normal browser script. It assigns `window.MIYUKE_SPRITES = { palette, sprites }`. All 38 sprites are literal arrays of equal-width strings, with no imports, external assets or runtime sprite generators. `.` is transparent; all opaque pixels use the unchanged shared 23-color palette.

Open `preview.html` beside `sprites.js` to see all 38 sprites on peach `#FFF0DE` and dark slate `#252B35` at exact 3× scale. Cards share a floor, show actual dimensions and baseline rows, and offer floor/anchor guides. Expand the validation table for full-map and cat-only component counts. `preview.png` is regenerated from those 76 actual canvas outputs; `preview-cuteness-atlas.png` is an identical copy with a fresh filename for image viewers that cache by path. The PNG is a contact sheet, not a browser screenshot.

## Cuteness pass scope and proportions

[CUTENESS.md](CUTENESS.md) supersedes the earlier facing and staff-proportion directions. Exactly 15 maps changed: `miyuke_code_a`, `miyuke_code_b`, `miyuke_debug` and all 12 staff poses. The other 23 sprite definitions, shared palette and all source outside the targeted arrays are byte-identical to the pre-pass file. A SHA-256 check in `validate-sprites.cjs` enforces that preservation.

Both staff poses use the same 14×12 head stencil, with ear tips on row 6 and the jaw on row 17. This is 50% of the 24px canvas height. Both eyes and the pink nose remain visible; walk bodies point left while their faces turn toward the viewer. Their bodies sit low, with a broad shoulder connection beneath the head. Short tails connect directly to the haunch or rear.

| Pose | Head W × H | Head rows, inclusive | Visible leg height | Leg rows, inclusive | Foot width / ground contacts |
| --- | --- | --- | --- | --- | --- |
| All six staff sit poses | 14 × 12px | 6–17 | **3px** | 21–23 | Two 4px-wide front paws, x=12–15 and 18–21; low haunches also meet the floor. |
| All six staff walk poses | 14 × 12px | 6–17 | **3px** | 21–23 | Four 3px-wide feet, x=8–10, 12–14, 20–22, 24–26, separate on both ground rows. |

The seated haunch is a compact 17px-wide mound with curved shoulders. The walk body has a rounded back, a low belly on row 20 and only three exposed leg rows beneath it. Miyuke retains her larger 18×15 head and 48×40 canvas, so staff remain visibly smaller and simpler.

## Canonical size spec — Revision 2, Section 0

This table overrides every earlier approximate size, including BRIEF.md. Dimensions include transparent padding. Coordinates and row numbers are zero based.

| Sprite family / name | Exact W × H | Ground rows | Bottom-center anchor | Content rule |
| --- | --- | --- | --- | --- |
| ALL `miyuke_*` | **48 × 40** | **38–39** | **(24, 40)** | Seated ear tips at row 4 or lower; 18px head width. Happy is airborne. |
| ALL `staff_*` | **32 × 24** | **22–23** | **(16, 24)** | Cat height ≤18px: no cat pixels above row 6. |
| ALL `duck_*` | **24 × 20** | **18–19** | **(12, 20)** | Both poses share head/body position and foot contacts. |
| ALL `icon_*` | **16 × 16** | None | UI placement | Canvas retained; artwork inset for margin compliance. |
| `prop_plant` | **16 × 20** | **19** | (8, 20) | Pot on bottom row. |
| `prop_coffee` | **16 × 16** | **15** | (8, 16) | Saucer on bottom row. |
| `prop_server` | **24 × 32** | **31** | (12, 32) | Rack feet on bottom row. |
| `prop_packmachine` | **48 × 24** | **23** | (24, 24) | Machine feet on bottom row. |
| `prop_shelf` | **40 × 28** | **27** | (20, 28) | Shelf feet on bottom row. |

Every map has at least two fully transparent columns at both sides and two fully transparent top rows, including icons. Bottom contact is allowed. Anchors lie on the geometric bottom edge, just below the last pixel row. Keep the whole canvas when changing poses; never crop or apply pose-specific floor offsets.

The scene contract is **Miyuke : staff : duck = 48 : 32 : 24** in canvas width. Staff are 2/3 of her canvas width and the duck is half. **One sprite pixel equals one stage pixel.** Upscale the whole scene by a positive integer only; do not independently normalize sprites to the same display width.

## Identity and work poses

Miyuke's three changed work poses reuse the **exact idle head pixels** in x=15–32, y=8–22: two eyes, pink nose, tiny mouth, orange **viewer-right ear**, and a patch-sized black **viewer-left cheek**. The plain dark monitor sits left of her in the typing frames. Her forearms connect to the chest and both paws touch the keyboard's top row (36). Her body and visible right hind foot remain connected and grounded without using the monitor or keyboard as bridges. The white-root/orange-middle/black-tip tail curls beside her.

Typing A/B differ at **12 pixels, including eight silhouette changes**, solely inside the two paw regions x=18–23 and x=25–30, y=33–35. All other typing pixels are identical. In debug, the raised forepaw bends inward above a small beetle at x=21–26, y=37–39; the support forepaw and haunches reach the floor. The beetle is intentionally separate from the cat.

`miyuke_yarn` keeps its original left profile and visible black-cheek side; `miyuke_think` still looks up/right. Their maps and all other untargeted poses are unchanged. The six staff coats retain their colors and characteristic markings:

| Coat | Preserved identity |
| --- | --- |
| `kuro` | Black fur, subtle gray shading, two gold eyes. |
| `chatora` | Orange coat; darker forehead, flank and tail stripes. |
| `sabatora` | Silver-gray coat; darker forehead, flank and tail stripes. |
| `hachiware` | Black cap, back and tail; white blaze, muzzle, bib and paws. |
| `shiro` | Cream-white coat, warm shadow, pink ears and nose. |
| `mike2` | Orange viewer-left ear, black viewer-right cheek, orange tail; orange rear flank in walk. |

## Palette

| Key | Hex | Intended role |
| --- | --- | --- |
| `O` | `#604B40` | Warm outline / wood ink |
| `W` | `#FFF5E6` | Cream white fur / paper |
| `w` | `#DFCDB7` | Cream fur shadow / steam |
| `A` | `#F49A45` | Calico orange / tabby fur |
| `a` | `#CC6C32` | Orange shadow / tabby stripes |
| `K` | `#45414A` | Black fur / eyes |
| `k` | `#6B626C` | Black fur shadow highlight |
| `P` | `#F49CAC` | Pink inner ears / yarn / heart |
| `p` | `#D66D87` | Pink shadow / mouth / yarn outline |
| `Y` | `#FFDA64` | Gold / duck / bulb / stars |
| `y` | `#C99A42` | Gold shadow / tape |
| `B` | `#71BED3` | Teal fish / book covers |
| `b` | `#408599` | Teal outline / sleep marks |
| `G` | `#85CA91` | Mint terminal text / leaves / QA tick |
| `g` | `#437660` | Deep green leaves / terminal shadow |
| `T` | `#C99A66` | Cardboard / shelf wood |
| `t` | `#996D49` | Cardboard shadow / shelf edges |
| `D` | `#718293` | Slate machine casing |
| `d` | `#465464` | Deep slate screen / machine edges |
| `R` | `#E66B52` | Coral bill / book spine |
| `L` | `#C1C8CB` | Silver fur / wrench / server slots |
| `l` | `#8F9AA1` | Silver shadow / tabby stripes |
| `C` | `#FFFFFF` | White specular highlights |

## Full inventory and dimension validation

Actual sizes are measured from the final literal maps, including transparent padding. Every row width, palette key, margin and required ground contact passes. Untargeted descriptions below document existing behavior; their sprite bytes did not change.

| Sprite | Actual W × H | Required W × H | Result | Current pose / pass status |
| --- | --- | --- | --- | --- |
| `miyuke_idle` | 48 × 40 | 48 × 40 | PASS | Unchanged. Redrawn 18px head, firm seated torso, two vertical chest-to-floor forepaws and a connected tricolor tail. |
| `miyuke_code_a` | 48 × 40 | 48 × 40 | PASS | Front-facing idle face; plain monitor beside her, two connected typing paws on the keyboard, grounded haunch and curled tricolor tail. |
| `miyuke_code_b` | 48 × 40 | 48 × 40 | PASS | Same as A; only the two paw shapes alternate. Head, body, tail, monitor and keyboard are identical. |
| `miyuke_think` | 48 × 40 | 48 × 40 | PASS | Unchanged. Pupils look up/right toward the question mark; bent paw touches chin through a connected forearm; other paw planted. |
| `miyuke_debug` | 48 × 40 | 48 × 40 | PASS | Front-facing idle face, one bent forepaw raised over a small beetle low between her grounded feet. |
| `miyuke_sleep` | 48 × 40 | 48 × 40 | PASS | Unchanged. Same 18px head with closed eyes, firm curled torso, tucked connected paws and tail; rests on a floor-aligned keyboard. |
| `miyuke_yarn` | 48 × 40 | 48 × 40 | PASS | Unchanged. Left profile faces the yarn; broad connected reaching foreleg, grounded support paw, round pink ball with attached loose strand. |
| `miyuke_box` | 48 × 40 | 48 × 40 | PASS | Unchanged. Broad shoulders and six rows of upper chest above the front rim; both attached forepaws hang down the box face. Box hides lower body. |
| `miyuke_snack` | 48 × 40 | 48 × 40 | PASS | Unchanged. Front-facing snack pose; both elbows and paws connect to the torso while holding a small teal fish; seated haunches and hind feet grounded. |
| `miyuke_happy` | 48 × 40 | 48 × 40 | PASS | Unchanged. Head/body proportions retained in a jump four pixels above the floor; raised paws connect through bent elbows; two intentional sparkles. |
| `staff_kuro_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Black fur, subtle gray shading, two gold eyes. |
| `staff_kuro_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Black fur, subtle gray shading, two gold eyes. |
| `staff_chatora_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Orange coat; darker forehead, flank and tail stripes. |
| `staff_chatora_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Orange coat; darker forehead, flank and tail stripes. |
| `staff_sabatora_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Silver-gray coat; darker forehead, flank and tail stripes. |
| `staff_sabatora_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Silver-gray coat; darker forehead, flank and tail stripes. |
| `staff_hachiware_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Black cap, back and tail; white blaze, muzzle, bib and paws. |
| `staff_hachiware_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Black cap, back and tail; white blaze, muzzle, bib and paws. |
| `staff_shiro_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Cream-white coat, warm shadow, pink ears and nose. |
| `staff_shiro_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Cream-white coat, warm shadow, pink ears and nose. |
| `staff_mike2_sit` | 32 × 24 | 32 × 24 | PASS | Big front-facing head over a low round haunch, two stubby front paws and a curled side tail. Orange viewer-left ear, black viewer-right cheek, orange tail; orange rear flank in walk. |
| `staff_mike2_walk` | 32 × 24 | 32 × 24 | PASS | Big readable face at the front of a low oval body, four stubby legs and a short connected rear tail. Orange viewer-left ear, black viewer-right cheek, orange tail; orange rear flank in walk. |
| `duck_idle` | 24 × 20 | 24 × 20 | PASS | Unchanged. 24×20 canvas; stable rounded body, right-facing bill, two attached feet on rows 18–19. |
| `duck_check` | 24 × 20 | 24 × 20 | PASS | Unchanged. Same head/body placement and feet as idle; attached wing holds a checkmark clipboard without covering both foot contacts. |
| `icon_coin` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; gold coin with highlight and currency stroke redrawn inside the strict two-pixel top/side margins. |
| `icon_idea` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; bulb with separate light rays redrawn inside the strict two-pixel top/side margins. |
| `icon_bug` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; coral-backed beetle with attached legs/antennae redrawn inside the strict two-pixel top/side margins. |
| `icon_box` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; taped cardboard package redrawn inside the strict two-pixel top/side margins. |
| `icon_star` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; gold five-point release star redrawn inside the strict two-pixel top/side margins. |
| `icon_fish` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; teal snack fish redrawn inside the strict two-pixel top/side margins. |
| `icon_book` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; teal book with page edge and label redrawn inside the strict two-pixel top/side margins. |
| `icon_wrench` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; silver open-ended wrench redrawn inside the strict two-pixel top/side margins. |
| `icon_heart` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16 canvas retained; pink heart with white highlight redrawn inside the strict two-pixel top/side margins. |
| `prop_plant` | 16 × 20 | 16 × 20 | PASS | Unchanged. 16×20; compact branching leaves inside the margins, pot seated on row 19. |
| `prop_coffee` | 16 × 16 | 16 × 16 | PASS | Unchanged. 16×16; compact mug/handle, two deliberate steam wisps, saucer on row 15. |
| `prop_server` | 24 × 32 | 24 × 32 | PASS | Unchanged. 24×32; existing rack details centered with clear margins; both rack feet on row 31. |
| `prop_packmachine` | 48 × 24 | 48 × 24 | PASS | Unchanged. 48×24; conveyor and arch centered; one repeated display row removed to clear the top margin; feet on row 23. |
| `prop_shelf` | 40 × 28 | 40 × 28 | PASS | Unchanged. 40×28; existing shelf, books and package centered; shelf feet on row 27. |

## Connected-component validation

Four-neighbor flood fills reject diagonal-only contact. All 12 staff sprites are exactly one component. Each Miyuke cat is also exactly one component after excluding explicit props and effects; no object can act as a hidden bridge between disconnected limbs. Full-map counts and allowed separate-object regions pass for all 10 Miyuke sprites.

| Sprite | All opaque components | Cat-only components | Separate objects | Result |
| --- | --- | --- | --- | --- |
| `miyuke_idle` | 1 | 1 | None | PASS |
| `miyuke_code_a` | 1 | 1 | None | PASS |
| `miyuke_code_b` | 1 | 1 | None | PASS |
| `miyuke_think` | 3 | 1 | Question-mark hook and dot | PASS |
| `miyuke_debug` | 2 | 1 | One beetle between the feet | PASS |
| `miyuke_sleep` | 3 | 1 | Two Z glyphs | PASS |
| `miyuke_yarn` | 1 | 1 | None | PASS |
| `miyuke_box` | 1 | 1 | None | PASS |
| `miyuke_snack` | 1 | 1 | None | PASS |
| `miyuke_happy` | 3 | 1 | Two gold sparkles | PASS |
| `staff_kuro_sit` | 1 | 1 | None | PASS |
| `staff_kuro_walk` | 1 | 1 | None | PASS |
| `staff_chatora_sit` | 1 | 1 | None | PASS |
| `staff_chatora_walk` | 1 | 1 | None | PASS |
| `staff_sabatora_sit` | 1 | 1 | None | PASS |
| `staff_sabatora_walk` | 1 | 1 | None | PASS |
| `staff_hachiware_sit` | 1 | 1 | None | PASS |
| `staff_hachiware_walk` | 1 | 1 | None | PASS |
| `staff_shiro_sit` | 1 | 1 | None | PASS |
| `staff_shiro_walk` | 1 | 1 | None | PASS |
| `staff_mike2_sit` | 1 | 1 | None | PASS |
| `staff_mike2_walk` | 1 | 1 | None | PASS |

The unchanged happy pose is intentionally airborne, with its last four rows transparent. The unchanged sleep and box poses rest on the keyboard and box respectively. Every changed cat itself reaches both required ground rows. All staff walks have four separate contacts on rows 22 and 23.

## Reproduce the validation

```sh
node --check sprites.js
node validate-sprites.cjs
```

`validate-sprites.cjs` loads the actual browser data and exits nonzero on failure. It prints all 38 actual/required dimensions and checks the exact inventory, rectangular maps, unchanged palette/source, known palette keys, transparent margins, baselines, staff height, 12px heads, visible faces, 3px legs, four walking feet, all 22 cats' four-neighbor connectivity, Miyuke's permitted effects and typing-paw confinement.

Final result: **38/38 dimensions PASS; 38/38 rectangular maps PASS; palette/margins/baselines PASS; 12/12 staff components PASS; 10/10 Miyuke cat-only components PASS; 23/23 untargeted sprite definitions byte-identical; typing-paw confinement PASS.**

The atlas's actual JavaScript also passed a DOM/canvas harness: **76 renders, 635,328 output pixels checked against exact 3× palette pixels, 38 validation rows, 76 accessible labels and working guide toggling**. The resulting light/dark contact sheets were visually inspected. Browser CSS/layout was not exercised by this harness.

## Canvas integration

Rasterize and cache each map once, then draw with a shared bottom-center anchor. The default scale is one sprite pixel per stage pixel; use integer scaling when displaying the complete scene.

```html
<script src="sprites.js"></script>
<canvas id="game" width="528" height="144"></canvas>
<script>
const { palette, sprites } = window.MIYUKE_SPRITES;
const cache = new Map();

function bitmap(name, colors = palette) {
  const rows = sprites[name];
  if (!rows) throw new Error(`Unknown sprite: ${name}`);
  const image = document.createElement('canvas');
  image.width = rows[0].length;
  image.height = rows.length;
  const ctx = image.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (key === '.') return;
    ctx.fillStyle = colors[key];
    ctx.fillRect(x, y, 1, 1);
  }));
  return image;
}

function drawSprite(ctx, name, anchorX, floorY, scale = 1) {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error('Use a positive integer scale');
  }
  if (!cache.has(name)) cache.set(name, bitmap(name));
  const image = cache.get(name);
  const x = Math.round(anchorX) - image.width * scale / 2;
  const y = Math.round(floorY) - image.height * scale;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, x, y, image.width * scale, image.height * scale);
}

const ctx = document.getElementById('game').getContext('2d');
// Same integer scale and floor for all three; widths are 144 : 96 : 72.
drawSprite(ctx, 'miyuke_idle', 90, 132, 3);
drawSprite(ctx, 'staff_shiro_walk', 240, 132, 3);
drawSprite(ctx, 'duck_idle', 360, 132, 3);
</script>
```

After resizing a canvas, set `imageSmoothingEnabled = false` again. Use `image-rendering: pixelated` and integer CSS ratios; keep backing-store and displayed dimensions aligned to whole pixels.

## Placement and animation

- Use the whole fixed canvas and bottom-center anchor for every pose. Do not trim transparent padding, add per-pose baseline adjustments, or rescale individual characters. Props also rest on their bottom row. Icons are UI objects without ground contact.
- Alternate `miyuke_code_a` and `miyuke_code_b` every 180–240 ms at the exact same anchor. Both paws remain on the keyboard while their knuckles/contact shape alternate. Repaint the background or clear the old full canvas before drawing the next frame.
- Use debug for a brief slap, think for planning, and happy for a jump/release burst. The jump offset is already in the map; no extra floor offset is needed.
- Staff sit/walk are distinct poses, not a complete two-frame gait. The walk is a single mid-stride silhouette; move it in integer stage pixels. Keep its floor fixed.
- Switch duck idle/check at the same anchor. The board belongs to the check sprite, and both feet retain the same placement.
- `prop_server` contains lit green/amber LEDs. To blink, cache a dim bitmap with `bitmap('prop_server', { ...palette, G: palette.g, Y: palette.y })`. This also dims the terminal deliberately; do not mutate the shared palette.
