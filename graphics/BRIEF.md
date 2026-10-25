# Graphics brief — pixel sprites for 『みゅけ、きょうも開発中』

You are the graphics artist for a cute pixel-art desktop-pet idle game about a calico cat programmer named みゅけ. An attached screenshot shows the current game and its current (rough) look. Your job: produce proper pixel-art sprite data that the game can render on Canvas, replacing the rough shapes.

## Character identity (must stay consistent in every sprite)
- みゅけ: white-based calico cat. ORANGE right ear, a BLACK patch on her LEFT cheek, pink nose and inner ears, tail with white/orange/black segments. Small, round, readable at tiny sizes. Kawaii but not babyish.

## Deliverables (create in this folder)
1. `sprites.js` — a plain JS file defining `window.MIYUKE_SPRITES` = { palette, sprites }.
   - Each sprite: an array of equal-length strings; each character maps to `palette` (a hex color) or `.` for transparent.
   - Palette keys: single characters. Keep the palette small and shared.
   - **STRICT SIZE SPEC (no approximate sizes — this overrides any "about" wording; canonical copy in REVISION.md §0 and DESIGN.md)**:
     - ALL Miyuke sprites: exactly **48×40**. Ground baseline = bottom two rows (rows 38–39). Anchor = bottom-center (x=24). Seated poses: ear tips no higher than row 4, head width ~18px.
     - ALL staff cat sprites: exactly **32×24**. Baseline = rows 22–23. Anchor = bottom-center (x=16). Body height ≤18px above baseline.
     - Duck sprites: exactly **24×20**. Baseline = rows 18–19.
     - Icons: exactly **16×16**.
     - Props, exactly: `prop_plant` **16×20**, `prop_coffee` **16×16**, `prop_server` **24×32**, `prop_packmachine` **48×24**, `prop_shelf` **40×28**. Props rest on their bottom row.
     - Scale contract in one scene: Miyuke : staff : duck = 48 : 32 : 24 px wide (staff are 2/3 her size, the duck is half). 1 sprite px = 1 stage px; integer-multiple upscaling only. Keep ≥2px transparent margin on left/right/top (baseline contact at the bottom edge is allowed). Identical canvas + baseline across all poses of a character, so animation frames never jitter.
   - Miyuke sprites:
     `miyuke_idle`, `miyuke_code_a`, `miyuke_code_b` (two typing frames at a laptop: paws alternate), `miyuke_think` (one paw to chin, tail curled), `miyuke_debug` (paw raised to slap), `miyuke_sleep` (curled up asleep on a keyboard shape), `miyuke_yarn` (playing with a yarn ball), `miyuke_box` (sitting in a cardboard box, head poking out), `miyuke_snack` (holding/eating a small fish snack), `miyuke_happy` (little jump, paws up, for release celebrations)
   - Staff cat variants, sitting pose + one walking pose each. Coats: `kuro` (black), `chatora` (orange tabby with stripes), `sabatora` (grey tabby), `hachiware` (black-and-white tuxedo), `shiro` (pure white), `mike2` (a different calico pattern from Miyuke's). Names: `staff_<coat>_sit`, `staff_<coat>_walk`.
   - QA duck: `duck_idle`, `duck_check` (with a tiny magnifying glass or checkmark board).
   - Icons: `icon_coin`, `icon_idea` (light bulb), `icon_bug`, `icon_box` (package), `icon_star`, `icon_fish`, `icon_book`, `icon_wrench`, `icon_heart`.
   - Props: `prop_plant`, `prop_coffee`, `prop_server` (CI machine with blinking light), `prop_packmachine`, `prop_shelf` (sizes fixed by the spec above; still note them in SPRITES.md).
2. `preview.html` — standalone page that loads sprites.js and renders every sprite on a labeled grid at 3x integer scale on both a light and a dark background, so a human can check readability and identity consistency.
3. `SPRITES.md` — integration notes: palette table, full sprite list with sizes and intended use, and a short example of building an offscreen canvas from a pixel map and drawImage-ing it with integer scaling.

## Rules
- No external assets, fonts, or images. Everything is data in sprites.js.
- Sprites must be hand-authored pixel maps in the file (not generated at runtime by code drawing shapes).
- Favor bold readable silhouettes over detail; this art is displayed small.
- Keep Miyuke's markings identical across all her sprites (orange RIGHT ear, black LEFT cheek patch).
- When done, print a summary of what you made.