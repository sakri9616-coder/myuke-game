# CUTENESS.md — chibi pass (owner feedback, supersedes FRONT.md)

The owner's aesthetic standard is now clear: **chibi proportions = cute; realistic
proportions = not cute.** Two complaints drive this pass:
1. Side-profile Miyuke hides her face → work poses go FRONT-facing (as in FRONT.md).
2. The staff cats' limbs are too long → staff go properly chibi: big heads, stubby
   legs, round low bodies.

Note: a previous run may have partially edited the 3 Miyuke sprites before being
stopped — treat their current state as untrusted and redo them per this brief.

## Part 1 — Miyuke work poses, FRONT-facing (3 sprites)

Replace `miyuke_code_a`, `miyuke_code_b`, `miyuke_debug` exactly as FRONT.md
specifies: front-facing in the style of miyuke_idle (big round head, both eyes, pink
nose, orange RIGHT-ear patch, patch-sized black LEFT-cheek patch), paws on a keyboard
strip, plain monitor panel beside/behind her is fine, code_b differs from code_a only
in paw pixels; debug = front-facing, one paw raised toward a small bug low in front
of her. 48×40, grounded, one connected cat.

## Part 2 — Staff cats go chibi (12 sprites)

Redraw all `staff_<coat>_sit` and `staff_<coat>_walk` (coats: kuro, chatora,
sabatora, hachiware, shiro, mike2 — keep each coat's colors/markings identical) with
chibi proportions inside the same 32×24 canvas:

- **Head: big** — roughly 40–50% of the sprite's height, round, face readable (two
  eyes, nose) in both sit and walk poses.
- **Legs: stubby** — 3–4 px tall at most, short and thick; the belly sits LOW, close
  to the ground line. No long slender legs, no tall torso.
- **Body: round and compact** — a plump oval, not a long horizontal tube. Walk pose:
  body low over 4 short legs, each leg still a separate ground contact on the bottom
  2 rows; head at the front, tail short-ish and connected at the rear.
- Sit pose: round haunch mound, short front legs (3–5 px visible), tail curled at
  the side, big head on top.
- Keep them clearly smaller and simpler than Miyuke (she is the star), but the same
  chibi language as miyuke_idle.

## Hard rules (unchanged)

- Staff exactly 32×24, Miyuke exactly 48×40; ground = bottom 2 rows; anchor
  bottom-center; palette chars only; equal row widths.
- Every cat (staff and Miyuke) is exactly ONE connected component; no detached or
  floating parts.
- All other sprites (duck, icons, props, other Miyuke poses) stay byte-identical.
- Regenerate preview.html / preview.png / SPRITES.md, re-run full validation
  (dimension table for all 38, component checks, typing-paw confinement), and in the
  summary state the staff head-height and leg-height (in px) you used, per pose type.
