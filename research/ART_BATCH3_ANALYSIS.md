# sakuri art batch 3 — read-only analysis (2026-10-24)

Basis: importer parser (tools/import-sakuri-art.py) composited frames vs the sprite data
embedded in game/index.html (byte-identical to graphics/sprites.js at analysis time;
palette = 47 colors). No game files were modified. All files 32bpp RGBA, no tags,
no semi-transparent pixels anywhere.

## Per-file results

| file | canvas | frames | durations (file) | colors used | NEW vs current 47-color palette | pixel diff vs integrated |
|---|---|---|---|---|---|---|
| miyuke_idle.aseprite (re-up) | 48×40 | 6 | 300×6 | 15 | none | **0 frames / 0 px — identical** |
| miyuke_code_a.aseprite (re-up) | 48×40 | 4 | 300×4 | 20 | none | **0 frames / 0 px — identical** |
| miyuke_snack-2.aseprite | 48×40 | 17 | 100×12, **300 (F13)**, 100×4 | 23 | none | **0 frames / 0 px** — pixels identical to v1; only F13 duration changed |
| miyuke_sleep-2.aseprite | 48×40 | **7** (was 6) | **600×7, encoded in the file itself** | 13 | none | F1–F2 identical; F3 10px, F4 34px, F5 42px, F6 114px differ; F7 brand-new |
| miyuke_think.aseprite (new) | 48×40 | 4 | 300×4 (1.2s loop) | 16 | **#F1BF41 (29px)** | no ANIMS entry exists; all 4 frames differ 415–522px from the legacy static `miyuke_think` |
| miyuke_debug.aseprite (new) | 48×40 | 7 | 300×7 (2.1s) | 18 | **#211711 (241px)** | all 7 frames differ 411–602px from the legacy static `miyuke_debug` |
| bug PNG (standalone) | 16×16 | 1 | — | 4 opaque colors | **#211711 (47px)** — same new color as debug | 69px differ vs current `icon_bug` |

Colors used (opaque, hex):
- idle (15): #45414A #463126 #604B40 #897164 #9F4D20 #C53333 #CC823C #D4B9AC #DFCDB7 #EC8952 #F49A45 #F49CAC #F6A4B3 #F8CF69 #FFF5E6
- code_a (20): idle set + #151821 #222631 #2F3444 #929CB6 #E9EFFF (monitor palette)
- snack-2 (23): #132538 #3F5267 #406A99 #45414A #463126 #46678A #578BC5 #604B40 #897164 #9F4D20 #BB354E #C53333 #C7DCF3 #CC823C #D4B9AC #DFCDB7 #E5E3CD #EC8952 #F49A45 #F49CAC #F6A4B3 #F8CF69 #FFF5E6 (same set as v1)
- sleep-2 (13): #143E8B #3770D8 #45414A #463126 #604B40 #C53333 #CC823C #D4B9AC #DFCDB7 #F49A45 #F49CAC #F8CF69 #FFF5E6 (same set as v1)
- think (16): #45414A #463126 #604B40 #897164 #9F4D20 #C53333 #CC823C #D4B9AC #DFCDB7 #EC8952 **#F1BF41 (new)** #F49A45 #F49CAC #F6A4B3 #F8CF69 #FFF5E6 — #F1BF41 is the "?" fill (F2/F3 12px each, F4 5px)
- debug (18): **#211711 (new)** #45414A #463126 #604B40 #85CA91 #897164 #9F4D20 #C53333 #CC823C #D4B9AC #DFCDB7 #E66B52 #EC8952 #F49A45 #F49CAC #F6A4B3 #F8CF69 #FFF5E6
- bug PNG (4): #211711×47 (new), #45414A×12, #E66B52×12, #85CA91×2; 73 opaque px, bbox x2–13/y2–13

## Findings per file

### idle / code_a re-uploads
No-ops. Frame pixels, counts and durations match the integrated versions exactly.
Nothing to integrate.

### snack-2 — timing-only change
Pixels are 100% identical to v1 (and to the integrated data). The single change:
**frame 13 duration 100ms → 300ms.** F13 is pixel-identical to F4/F7/F10 — the middle
pose of the 3-frame chew cycle (head down at the fish). With the established loop
(artist note, still no tag in file: frames 3–14 ×3), the loop segment grows
1200ms → 1400ms and the total eat animation **4.1s → 4.7s**.
⚠ Integration consequence: `giveSnack()` hard-codes `setState("eat", 4100)` with the
4.1s math in a comment — it must become 4700 (or `animDuration("miyuke_snack")`),
otherwise the state ends 0.6s before the animation.

### sleep-2 — correction baked in + breathing redraw + closing frame
- The file now encodes **600ms/frame itself** (v1 file said 100ms; the artist's oral
  correction is now in the data — no `--override-ms` needed at import).
- 7 frames: cycle 3.6s → **4.2s**.
- The blue "Z" track is pixel-identical in F1–F6. All changes are in the cat's body:
  F3 tail-side patch shifts a few px; F4–F5 the back orange/white boundary moves;
  F6 face/ears/body shading redrawn (114px — the largest change). Reads as a subtle
  breathing motion added to the loaf.
- **F7 is new**: the cat is pixel-identical to v1's final F6 cat, with only the last
  7 blue Z-speck pixels removed — a clean Z-less closing/hold frame.

### think — brand-new animation for an existing state
Frame by frame (front-facing seated pose, red collar + bell, whiskers — her current design):
1. Eyes open (narrow vertical pupils), gaze up-right, no mark — alert "なに？"
2. Eyes closed, big gold "?" appears upper-right, head tilts — pondering.
3. Eyes still closed, "?" holds, slight head/tail shift — still thinking.
4. Eyes closed, "?" crumbles into dissolving dots — the question fades; loops to F1.

State-machine fit (from game/index.html `stateTick`): the `think` state **already exists**
and currently renders the legacy static sprite. It is entered (a) when
`S.project.planning` (idea cost unmet) with p=0.7 — `setState("think",4000)`,
"企画を考え中…ひらめき待ちにゃ", and on completion grants `S.ideas += 1 + monitor Lv`;
(b) in the general rotation at r<0.72 — "うーん、どう作るかにゃ…". The 1.2s loop fits the
4s state (≈3 cycles). Proposed triggers, in priority order:
1. **Drop-in replacement for the existing `think` state** (both entries above) — zero
   new logic; this is plainly what the pose is for.
2. Optional: one 1.2–2.4s think pass when a new project is generated
   (`genProject`/`startNextProject`) before coding starts — "conceiving the project".
   Currently project start has no pose at all.
3. Optional: extend the planning-think branch to line 2 — `stateTick` checks only
   `S.project.planning`, while `stageStatus()` tracks line-2 planning too (p2).

### debug — her version of the bug-squash pose
Frame by frame:
1. Seated front; the bug sits intact between her forelegs (see pairing below).
2. She leans in, paws pinning the bug; body starts to rise.
3. She stretches tall (body elongated), paws lifted — wind-up. 
4. Near-hold of the stretch (57px from F3) — anticipation beat.
5. Slam down into a low crouch; the bug bursts into dark fragments along the ground.
6. Still crouched; fragments scattered wider — aftermath.
7. Back to a clean normal sit; no bug, no fragments — reset.

Trigger (game/index.html `stateTick`): when the current state expires, if
`S.bugStock >= 4` and the roll `r < 0.45` → `setState("debug", 4000)`. bugStock accrues
from production (`BAL.bugPerDP = 0.012`). During debug, the per-second QA tick has a
30% chance to squash 1 stock bug (`totals.bugsSquashed++`, occasional
"バグ、たたいたにゃ！"). This is separate from the clickable bug-swarm event.
Timing: state is 4000ms, animation is 2100ms one pass — imported with the default
whole-range infinite loop it plays ≈1.9 cycles (impact F5 lands at ~1.2–1.5s and
~3.3–3.6s), which is compatible with the multi-squash tick logic; flagging only
because it is a loop-vs-one-shot choice for integration, not a defect.

### Standalone bug PNG — pairs with debug, and fills icon_bug
- Current rendering: `SPRITE_SPEC icon_bug = [16,16]`; the only gameplay draw is the
  strip renderer: `sDrawSprite("icon_bug", bp.x, bp.y + 6, 1.2)` → 19.2×19.2 virtual
  units, bottom-center anchor, 18×18 hit rect. Full/panel mode draws no bug sprite
  (header uses the 🐛 emoji). The graphics preview atlas renders all sprites at 3×.
  **A 16×16 source fits the slot exactly — no rescaling needed.**
- vs current icon_bug (71 opaque px: #604B40×48, #45414A×11, #E66B52×10, #85CA91×2):
  same design (green eyes, salmon center stripe, gray flanks, six legs, antennae),
  redrawn darker — outline/body becomes the new #211711 and leg/antenna geometry
  shifts slightly; 69px differ.
- **Pairing with miyuke_debug is exact**: debug F1–F4 embed this very bug at offset
  (15,26) of the 48×40 canvas — all 73 opaque pixels match 1:1. F5–F6 it is the
  fragment scatter (31 / 22 dark pixels), F7 it is gone. So the debug animation is
  self-contained; the standalone PNG is still needed separately as the roaming
  swarm sprite (`icon_bug`). Both files share the single new palette color #211711,
  so one palette extension covers both.

## Integration notes (for whoever lands this after the Strip Canon refactor)
- Palette extensions needed: **#F1BF41** (think) and **#211711** (debug + bug) — 47 → 49 colors.
- snack-2: update the hard-coded eat duration 4100 → 4700 alongside the ANIMS durations.
- sleep-2: import without `--override-ms` (600ms is in the file now); ANIMS goes 6f → 7f.
- idle / code_a: skip — byte-for-byte equivalent art already integrated.
