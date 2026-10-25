# FRONT.md — Miyuke work poses go back to FRONT-facing (owner's decision)

The owner has decided: **Miyuke may face the viewer even while working — cuteness
wins over realistic facing direction.** The monitor does NOT need to show its screen
contents. The Revision-2 side-profile poses are anatomically fine but read as "not
cute" because the face is hidden.

## Task (small, targeted — edit sprites.js in place)

Replace ONLY these 3 sprites. Leave the other 35 sprites byte-identical.

- **miyuke_code_a / miyuke_code_b** — FRONT-facing Miyuke at her desk, in the style of
  the well-liked miyuke_idle: big round head, both eyes, pink nose, small mouth,
  orange patch on the RIGHT ear, black patch on the LEFT cheek (patch-sized), seated
  body firm and grounded. Her front paws rest on a keyboard strip along the bottom of
  the sprite; a simple monitor sits beside/behind her (a plain dark screen panel is
  fine — code lines optional, screen interior may stay plain). Tricolor tail curled at
  her side. code_a and code_b differ ONLY in paw pixels (alternating typing), same as
  the Revision-2 constraint.
- **miyuke_debug** — FRONT-facing Miyuke, alert/curious expression, one front paw
  raised mid-swat toward a small bug placed low in front of her (between/below her
  paws). Face fully visible and cute, same markings.

## Hard rules (unchanged)

- Exactly 48×40 each; ground = bottom 2 rows (rows 38–39); anchor bottom-center.
- The cat is exactly ONE connected component; limbs attached, feet grounded, firm
  silhouette (all REVISION.md anatomy rules still apply).
- Palette chars only; equal row widths.
- Regenerate preview.html / preview.png / SPRITES.md entries for the 3 changed
  sprites, and re-run your validation (dimensions table + components + typing-paw
  confinement) for the full set in the summary.

Cuteness checklist for yourself before finishing: does she look like the same cat as
miyuke_idle? Is the face the first thing you see? Would this read as adorable at 2x
game scale (96×80)?
