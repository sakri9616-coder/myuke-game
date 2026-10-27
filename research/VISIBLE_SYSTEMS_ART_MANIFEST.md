# Visible systems art manifest

2026-10-27 · Art-only review pack for 『みゅけ、きょうも開発中』.

[Data](../graphics/env-sprites-visible.js) exports `window.MIYUKE_ENV_SPRITES_VIS`; literal equal-width pixel rows, `.` transparent. [Contact sheet](../graphics/env-preview-vis/contact-sheet.png): every sprite at **4× nearest-neighbor on #808080**. Individual previews use the same scale and background.

Reproduce and validate offline: `node graphics/render-env-preview-vis.cjs`. Standard library only; no game execution.

Anchors use native edge coordinates. Grounded props/icons: bottom-center `(w/2,h)`. Screen insets: top-left `(0,0)`. Effects: canvas center. Chairs use game scale **2×**, all other assets **1×**. Every grounded prop/icon retains at least two transparent rows/columns at top/left/right. Effects and opaque screen insets are exempt.

## A

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_backlog_0](../graphics/env-preview-vis/prop_backlog_0.png) | 24×28 | bottom-center (12,28) | Empty aluminum planning whiteboard; main desk left. | `DLsu` | None |
| [prop_backlog_1](../graphics/env-preview-vis/prop_backlog_1.png) | 24×28 | bottom-center (12,28) | A few yellow sticky notes; idea backlog accumulating. | `DLYsuy` | None |
| [prop_backlog_2](../graphics/env-preview-vis/prop_backlog_2.png) | 24×28 | bottom-center (12,28) | Six yellow sticky notes fill the board; ready to implement. | `DLYsuy` | None |
| [prop_qa_tray](../graphics/env-preview-vis/prop_qa_tray.png) | 32×8 | bottom-center (16,8) | Slate metal document tray at stripQAX; open receiving lip. | `DLdu` | None |
| [prop_build_stand](../graphics/env-preview-vis/prop_build_stand.png) | 32×8 | bottom-center (16,8) | Low cardboard build platform at stripBuildX. | `OTt` | None |
| [icon_card](../graphics/env-preview-vis/icon_card.png) | 12×8 | bottom-center (6,8) | White code card with two cool syntax strokes; piles and transfers. | `Bmsu` | None |
| [icon_card_ok](../graphics/env-preview-vis/icon_card_ok.png) | 12×8 | bottom-center (6,8) | Tested code card; green upper-right check. | `Gsu` | None |
| [icon_note_0](../graphics/env-preview-vis/icon_note_0.png) | 6×6 | bottom-center (3,6) | Yellow completion sticky note; desk to board. | `Yy` | None |
| [icon_note_1](../graphics/env-preview-vis/icon_note_1.png) | 6×6 | bottom-center (3,6) | Pink completion sticky note; desk to board. | `Pp` | None |
| [icon_note_2](../graphics/env-preview-vis/icon_note_2.png) | 6×6 | bottom-center (3,6) | Pale blue completion sticky note; desk to board. | `Bb` | None |
| [icon_note_3](../graphics/env-preview-vis/icon_note_3.png) | 6×6 | bottom-center (3,6) | Green completion sticky note; desk to board. | `Gg` | None |
| [icon_mote](../graphics/env-preview-vis/icon_mote.png) | 6×6 | bottom-center (3,6) | Purple research glint rising from the research desk. | `/:;` | None |

## B

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_signal_green](../graphics/env-preview-vis/prop_signal_green.png) | 8×18 | bottom-center (4,18) | Single green workflow lamp on a slate post; beside each station. | `DGdgu` | None |
| [prop_signal_yellow](../graphics/env-preview-vis/prop_signal_yellow.png) | 8×18 | bottom-center (4,18) | Single yellow workflow lamp on a slate post; beside each station. | `DYduy` | None |
| [prop_signal_red](../graphics/env-preview-vis/prop_signal_red.png) | 8×18 | bottom-center (4,18) | Single red workflow lamp on a slate post; beside each station. | `DHRdu` | None |
| [prop_jam_cone](../graphics/env-preview-vis/prop_jam_cone.png) | 10×10 | bottom-center (5,10) | Red/white jam cone; beside blocked work. | `RWsu` | None |

## C

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_keyboard_1](../graphics/env-preview-vis/prop_keyboard_1.png) | 24×6 | bottom-center (12,6) | Mechanical keyboard with pale keycaps. | `Ldsu` | None |
| [prop_keyboard_2](../graphics/env-preview-vis/prop_keyboard_2.png) | 24×6 | bottom-center (12,6) | Backlit mechanical keyboard with cyan key lights. | `BLdsu` | None |
| [prop_keyboard_3](../graphics/env-preview-vis/prop_keyboard_3.png) | 24×6 | bottom-center (12,6) | Split ergonomic keyboard with inward thumb clusters. | `Ldsu` | None |
| [screen_ide_0](../graphics/env-preview-vis/screen_ide_0.png) | 20×10 | top-left (0,0) | Monochrome code strokes; full opaque monitor inset. | `Gu` | None |
| [screen_ide_1](../graphics/env-preview-vis/screen_ide_1.png) | 20×10 | top-left (0,0) | Cool syntax strokes and gutter marks; full opaque monitor inset. | `BDGmu` | None |
| [screen_ide_2](../graphics/env-preview-vis/screen_ide_2.png) | 20×10 | top-left (0,0) | Left file tree and two editor panes; full opaque monitor inset. | `BGmnu` | None |
| [prop_monitor_sub_1](../graphics/env-preview-vis/prop_monitor_sub_1.png) | 28×28 | bottom-center (14,28) | One landscape auxiliary display; cool syntax lines. | `BDGdmu` | None |
| [prop_monitor_sub_2](../graphics/env-preview-vis/prop_monitor_sub_2.png) | 28×28 | bottom-center (14,28) | Landscape display plus upright second screen; shared main stand. | `BDGdmu` | None |
| [prop_chair_0](../graphics/env-preview-vis/prop_chair_0.png) | 32×36 | bottom-center (16,36) | Round laminate stool; same seat band and casters as existing chair; game scale 2. | `DLdu` | None |
| [prop_chair_2](../graphics/env-preview-vis/prop_chair_2.png) | 32×36 | bottom-center (16,36) | Padded high-back slate chair with headrest and armrests; game scale 2. | `DLdnu` | None |
| [prop_autotester_1](../graphics/env-preview-vis/prop_autotester_1.png) | 28×28 | bottom-center (14,28) | Compact tester with large green success check. | `DGLSu` | None |
| [prop_autotester_2](../graphics/env-preview-vis/prop_autotester_2.png) | 28×28 | bottom-center (14,28) | Larger automated tester with green lamp bank and roller belt. | `DGLSgu` | None |
| [prop_ci_1](../graphics/env-preview-vis/prop_ci_1.png) | 24×32 | bottom-center (12,32) | Compact desktop CI server with exactly two green LEDs. | `DGLgu` | None |
| [prop_packer_1](../graphics/env-preview-vis/prop_packer_1.png) | 40×28 | bottom-center (20,28) | Manual packing bench, taped cardboard box and right-hand crank. | `DLOTdtuw` | None |
| [prop_packer_2](../graphics/env-preview-vis/prop_packer_2.png) | 40×28 | bottom-center (20,28) | Automatic overhead tape arch and wide roller belt; same bench and box. | `DLOTdtuw` | None |
| [bot_idle](../graphics/env-preview-vis/bot_idle.png) | 24×20 | bottom-center (12,20) | Round slate-and-cream kitten robot; two dot eyes and one orange badge; sakuri-redrawable draft. | `ABDWdu` | None |
| [bot_carry](../graphics/env-preview-vis/bot_carry.png) | 24×20 | bottom-center (12,20) | Same robot carrying an icon_box-style taped cardboard box on its head. | `ABDOTWdtuw` | None |
| [bot_walk_a](../graphics/env-preview-vis/bot_walk_a.png) | 24×20 | bottom-center (12,20) | Walk frame a; alternating wheel-feet on duck ground rows 18–19. | `ABDWdu` | None |
| [bot_walk_b](../graphics/env-preview-vis/bot_walk_b.png) | 24×20 | bottom-center (12,20) | Walk frame b; alternating wheel-feet on duck ground rows 18–19. | `ABDWdu` | None |
| [prop_debt_pile_1](../graphics/env-preview-vis/prop_debt_pile_1.png) | 16×12 | bottom-center (8,12) | Low stack of technical-debt documents. | `Ddsu` | None |
| [prop_debt_pile_2](../graphics/env-preview-vis/prop_debt_pile_2.png) | 16×12 | bottom-center (8,12) | Tall layered paper stack on the same footprint. | `Ddsu` | None |
| [prop_debt_pile_3](../graphics/env-preview-vis/prop_debt_pile_3.png) | 16×12 | bottom-center (8,12) | Collapsed documents and a toppled taped box; same baseline. | `OTdstuw` | None |

## D

| Sprite / preview | Pixels | Anchor | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [fx_spark_0](../graphics/env-preview-vis/fx_spark_0.png) | 9×9 | center (4.5,4.5) | Click sparkle frame 0: white cross with yellow/orange tips. | `AWY` | None |
| [fx_spark_1](../graphics/env-preview-vis/fx_spark_1.png) | 9×9 | center (4.5,4.5) | Click sparkle frame 1: separated expanding particles. | `AWY` | None |
| [fx_spark_2](../graphics/env-preview-vis/fx_spark_2.png) | 9×9 | center (4.5,4.5) | Click sparkle frame 2: sparse small fading particles. | `AY` | None |
| [fx_confetti_0_a](../graphics/env-preview-vis/fx_confetti_0_a.png) | 3×2 | center (1.5,1) | Confetti red: front face; nearest existing RGB color. | `R` | None |
| [fx_confetti_0_b](../graphics/env-preview-vis/fx_confetti_0_b.png) | 1×2 | center (0.5,1) | Confetti red: edge-on, darker matching family. | `H` | None |
| [fx_confetti_1_a](../graphics/env-preview-vis/fx_confetti_1_a.png) | 3×2 | center (1.5,1) | Confetti yellow: front face; nearest existing RGB color. | `9` | None |
| [fx_confetti_1_b](../graphics/env-preview-vis/fx_confetti_1_b.png) | 1×2 | center (0.5,1) | Confetti yellow: edge-on, darker matching family. | `y` | None |
| [fx_confetti_2_a](../graphics/env-preview-vis/fx_confetti_2_a.png) | 3×2 | center (1.5,1) | Confetti green: front face; nearest existing RGB color. | `]` | None |
| [fx_confetti_2_b](../graphics/env-preview-vis/fx_confetti_2_b.png) | 1×2 | center (0.5,1) | Confetti green: edge-on, darker matching family. | `g` | None |
| [fx_confetti_3_a](../graphics/env-preview-vis/fx_confetti_3_a.png) | 3×2 | center (1.5,1) | Confetti blue: front face; nearest existing RGB color. | `ぅ` | None |
| [fx_confetti_3_b](../graphics/env-preview-vis/fx_confetti_3_b.png) | 1×2 | center (0.5,1) | Confetti blue: edge-on, darker matching family. | `Q` | None |
| [fx_confetti_4_a](../graphics/env-preview-vis/fx_confetti_4_a.png) | 3×2 | center (1.5,1) | Confetti pink: front face; nearest existing RGB color. | `P` | None |
| [fx_confetti_4_b](../graphics/env-preview-vis/fx_confetti_4_b.png) | 1×2 | center (0.5,1) | Confetti pink: edge-on, darker matching family. | `p` | None |

## Palette reuse

**New colors proposed: 0. Suggested new characters: none.** All colors and character assignments match the global palette exactly. Cool slate/white equipment, cardboard brown, and restrained warm accents follow the existing props. IDE code uses cool syntax colors to avoid multiple warm accents; gutter marks are short bars, never letters or numerals.

| Character | Existing hex |
| --- | --- |
| `9` | `#FCDE53` |
| `/` | `#AC67CD` |
| `:` | `#F1A8EA` |
| `;` | `#C083DD` |
| `A` | `#F49A45` |
| `B` | `#71BED3` |
| `D` | `#718293` |
| `G` | `#85CA91` |
| `H` | `#C53333` |
| `L` | `#C1C8CB` |
| `O` | `#604B40` |
| `P` | `#F49CAC` |
| `Q` | `#406A99` |
| `R` | `#E66B52` |
| `S` | `#C7DCF3` |
| `T` | `#C99A66` |
| `W` | `#FFF5E6` |
| `Y` | `#FFDA64` |
| `]` | `#74A571` |
| `b` | `#408599` |
| `d` | `#465464` |
| `g` | `#437660` |
| `m` | `#578BC5` |
| `n` | `#3F5267` |
| `p` | `#D66D87` |
| `s` | `#E9EFFF` |
| `t` | `#996D49` |
| `u` | `#2F3444` |
| `w` | `#DFCDB7` |
| `y` | `#C99A42` |
| `ぅ` | `#4F87C0` |

Confetti front colors use nearest Euclidean sRGB matches across the entire existing global palette to the five requested swatches: `R #E66B52`, `9 #FCDE53`, `] #74A571`, `ぅ #4F87C0`, `P #F49CAC`. The existing Japanese palette character `ぅ` is one pixel just like an ASCII palette character. The darker edge faces use `H`, `y`, `g`, `Q`, `p` respectively. Lamp variants differ only at the same four lamp pixels (G/g, Y/y, R/H).

## Consistency and scope

All 51 requested NEW names are supplied, authored in complete A→B→C→D groups. Existing chair, duck frames and server rack are intentionally reused by the future integration; no duplicate art supplied. Existing files remain untouched. No game, version bump or commit.

Board states share the entire frame and feet. Keyboards share their bottom row; dual screens retain the main display support while adding the upright screen. Testers and packers retain shared bases as equipment grows. Chairs copy the existing eight-row caster/column base at native density and retain its seat-height band; the new high-back padding respects the required top margin. Robot body stays fixed through walk/carry states and its wheel-feet occupy rows 18–19, matching duck_idle. Debt piles retain the bottom outline while accumulating height and disorder.

Nothing omitted from the sprite set. Detail intentionally simplified: 6×6 icons have only 2×4 drawable pixels under the required margins, so notes use color plus a folded corner; the mote uses a compact purple glint. Code cards use short strokes and a minimal green check. Keyboard tier 3 uses a notched split and inward thumb keys within its 20×4 drawable area. Robots are the expressly requested first draft for sakuri to redraw.

Validation passed for all **51 sprites**: exact inventory and canvas sizes, equal-width rows, two-pixel margins, occupied ground rows, fully opaque screen insets, 31 exact reused palette entries, stable shared bases, chair alignment to the existing caster base, bot rows 18–19 and fixed walking body, lamp-only signal changes, nearest confetti face colors and darker edge colors. All 51 individual PNGs plus the named contact sheet were rendered at 4× nearest-neighbor on #808080. The contact sheet was visually inspected; monitor bezel alignment and the larger tester enclosure were refined and inspected again. Game composition is untested, as requested.
