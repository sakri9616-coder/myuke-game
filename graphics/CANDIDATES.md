# CANDIDATES.md — cuter "at work" poses for Miyuke

The owner reviewed Revision 2 and gave a new verdict on the side-profile coding pose:
**"The profile Miyuke is NOT cute."** The anatomy is fine — the problem is that a pure
side view hides her face: only one eye shows, the black cheek patch becomes a big dark
block, and the chibi charm of the front-facing sprites (miyuke_idle is well liked) is lost.

## Task

Draw **3 candidate replacements** for the coding pose only (48×40, same palette and format
as sprites.js, same strict rules from REVISION.md §0 and the anatomy rules: one connected
cat, grounded limbs, firm silhouette). Put them in a NEW file `candidates.js` as
`window.MIYUKE_CANDIDATES = { palette, sprites: { cand_a, cand_b, cand_c } }` and build a
`candidates.html` + rendered `candidates.png` comparison sheet showing each candidate at
large zoom (≥8x) on the game's cream background, next to the CURRENT miyuke_code_a and
miyuke_idle for comparison. Do NOT modify sprites.js.

## The three directions (one candidate each)

- **cand_a — 3/4 front-side view.** Her body is angled: face turned mostly toward the
  viewer (BOTH eyes visible, cheek patch reads as a patch) but her head and gaze clearly
  turned toward the laptop at her left; both front paws on the keyboard deck. The laptop
  can angle toward her. This should read "she is working" AND keep the face.
- **cand_b — 3/4 back-side view (over-the-shoulder).** We see her from behind-left: back
  of head with the orange ear patch visible, one cheek/eye peeking as she looks at a
  glowing code monitor in front of her, paws on the keyboard. Classic cute desktop-pet
  composition; the monitor shows simple code lines.
- **cand_c — front view, working cues.** Fully front-facing like miyuke_idle (maximum
  face), but unmistakably at work: monitor beside her angled so its code screen is
  visible behind/beside her shoulder, her eyes glancing sideways toward it, front paws
  down on a keyboard strip at the base, tail curled around the desk edge.

## Cuteness requirements (the whole point)

- Head large and round (chibi proportions, close to miyuke_idle's head-to-body ratio).
- Face must read at 2x game scale: eyes, pink nose, mouth where the angle allows.
- Calico markings: orange patch on the RIGHT ear, black patch on the LEFT cheek (scaled
  like a patch, not half the face), tricolor tail.
- Prefer charm over realism: it is fine to cheat perspective for cuteness.
- Each candidate must still satisfy: exactly 48×40, ground = bottom 2 rows, cat = one
  connected component (props may be separate), palette chars only.

In your final summary, describe each candidate in one line and give the exact-dimension
PASS/FAIL table for the 3 candidates.
