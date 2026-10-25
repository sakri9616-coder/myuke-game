# Revision 2 — user art review fixes (sprites.js / preview.html / SPRITES.md)

The game's owner reviewed the sprite atlas and gave three specific criticisms. Two reference crops are attached as images: (1) staff_mike2 sit/walk, (2) miyuke_code_a. Fix all of them, in place, keeping sprite names, the palette system, and the file format identical.

## 0. STRICT PIXEL SIZE SPEC (the director failed to fix this before — it overrides every "about" size in BRIEF.md)
No approximate sizes anymore. Every sprite gets EXACTLY this canvas, filled with transparent padding as needed:
- ALL Miyuke sprites: **48×40**. Ground baseline = bottom two rows (feet/body bottom rest on rows 38–39). Anchor = bottom-center (x=24). Seated poses: ear tips no higher than row 4, head width ~18px.
- ALL staff cat sprites: **32×24**. Baseline = rows 22–23. Anchor = bottom-center (x=16). Body height ≤18px above baseline.
- Duck sprites: **24×20**. Baseline = rows 18–19.
- Icons: **16×16** (already correct — keep).
- Props, exactly: prop_plant **16×20**, prop_coffee **16×16**, prop_server **24×32**, prop_packmachine **48×24**, prop_shelf **40×28**. Props rest on their bottom row.
- Scale contract when composited in one scene: Miyuke : staff : duck = 48 : 32 : 24 px wide (staff are 2/3 her size, the duck is half). 1 sprite px = 1 stage px; the game upscales by integers only.
- Content keeps ≥2px transparent margin on left/right/top (baseline contact at the bottom edge is allowed).
- Identical canvas + baseline across all poses of a character, so animation frames never jitter.
- In SPRITES.md, print this table as the canonical size spec, and in your final summary include a dimension check: every sprite name with its actual WxH and PASS/FAIL against this table.

## 1. Anatomy: bodies are floppy, limbs float
Owner's words: 体がぐにゃぐにゃすぎる (bodies are too wobbly/melty), 手足が浮いてる (paws/legs are floating).
- Every limb must be connected to the torso by contiguous pixels — no detached or 1px-diagonal-only limbs.
- Feet/paws stand on a shared ground baseline (the bottom rows of the sprite) unless the pose is explicitly airborne (miyuke_happy). Sitting poses: body bottom sits flat on the baseline, front paws are vertical columns from chest to baseline.
- Torso silhouettes must be firm and stable — smooth, confident outlines, no wavy/melting sides. Keep the same body proportions for a character across all poses (head size, torso height, leg length ~3–4px).
- Worst offenders: ALL staff *_walk sprites (legs splayed sideways, bodies stretched and sagging, paws floating mid-air) and staff_shiro_walk (reads as a blob). Redo the walks as proper side-view quadrupeds: rigid horizontal torso, head connected by a neck at the front, four short legs UNDER the torso in a simple mid-stride (front pair slightly forward, back pair slightly back), all reaching the baseline, tail attached at the rear.
- Self-check you must run and report: for every staff sprite, the cat (all its pixels) forms exactly ONE connected component. For Miyuke sprites, extra components are allowed only for intended props (laptop, yarn ball, box, keyboard, snack, Zzz/sparkle/? marks) — never for a limb.

## 2. miyuke_box reads as "just a neck"
Owner: ダンボールのみゅけは首だけになってる — in the box sprite she looks like a severed head/neck sitting in a box.
- Redraw: she is sitting INSIDE the box. Show her shoulders and upper chest above the box rim, head connected to the shoulders (no pinched neck), and both front paws draped over the front edge of the box (paws hanging down the box's front face). The box front overlaps her lower body, which is fine — but the read must be "cat in a box", not "head in a box".

## 3. miyuke_code_a / code_b: both the cat AND the screen face the viewer
Owner: プログラムしてるはずなのに画面とみゅけが一緒にこっち見てる — she's supposed to be programming, but she and the monitor both stare at the audience like a logo.
- Redraw code_a/code_b in SIDE PROFILE: Miyuke faces the laptop (pick one direction and keep it consistent), seated in profile, gaze toward the screen, both front paws on the keyboard deck alternating between the two frames (that's the typing animation). Draw the laptop in profile too: we see the screen from its side/back edge as a glowing panel angled toward her face — a thin sliver of code lines on the visible inner edge is fine, but the display must not be a full front-facing rectangle competing with her face.
- Her calico identity must survive the profile view: keep the orange ear visible, the tricolor tail curling behind her, and add the black cheek patch on the visible side of her face if the facing direction allows it — state in SPRITES.md which side we see and where each marking went.
- Apply the same "face your work" logic where relevant: miyuke_debug should face TOWARD the bug she is slapping (profile or 3/4, gaze on the bug — add a small bug target in front of her paw if needed); miyuke_think's gaze goes up/away in thought. Front-facing poses are fine for idle/happy/snack (she is interacting with the viewer there).

## Process
- Edit sprites.js in place; preview.html reads from it, so re-verify the atlas renders.
- Update SPRITES.md with a "Revision 2" section: what changed per sprite, the connected-component check results, and the profile-view marking note.
- Validate the JS loads (node) and every sprite's rows are equal length.
- Print a summary when done.