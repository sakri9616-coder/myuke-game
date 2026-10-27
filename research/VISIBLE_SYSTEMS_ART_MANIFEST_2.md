# Visible systems art manifest — order 2

2026-10-27 · Art-only review pack for 『みゅけ、きょうも開発中』.

[Data](../graphics/env-sprites-visible2.js) exports `window.MIYUKE_ENV_SPRITES_VIS2` as `{ palette, sprites }` with literal equal-width rows; `.` is transparent. [Contact sheet](../graphics/env-preview-vis2/contact-sheet.png) includes every sprite, grouped G → H → I → J → K, at **4× nearest-neighbor on #808080**. Individual previews use the same scale/background.

Reproduce offline: `node graphics/render-env-preview-vis2.cjs`. Node standard library only. The renderer reads data, validates it, and writes previews; it is not game code. No game was run.

## Anchors and slices

Anchors use native canvas edge coordinates. Grounded props/icons use bottom-center `(w/2,h)`, with two transparent rows at the top and two columns at each side; bottom contact is allowed. Tiny `icon_pin`, `icon_cord`, and `icon_badge_hire` retain bottom-center anchors but have **no margins**, as expressly allowed. UI, monitor insets, shelf boxes and overlay effects use top-left `(0,0)`; their margins are exempt. `desk_wood_main` also uses top-left and copies the existing 116×3 desktop silhouette exactly.

`_9`: k×k corners fixed, horizontal edges stretch horizontally, vertical edges vertically, center both ways. `_3`: left/right k columns fixed. `_3v`: top/bottom k rows fixed. Every stretched row/column is constant along the stretch direction; no stretched textures. All 9-slice tests are 96×40 native pixels; horizontal tests are 80 pixels wide with original height; vertical tests are 40 pixels tall with original width. PNGs show those results at 4×.

## G

| Sprite / preview | Pixels | Anchor / slice | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [ui_board_9](../graphics/env-preview-vis2/ui_board_9.png) | 24×24 | top-left (0,0); k=6; [stretch](../graphics/env-preview-vis2/stretch-ui_board_9.png) | Dark wood planning board with cream paper and one bright top rim stripe. | `OTWt` | None |
| [ui_board_glow_9](../graphics/env-preview-vis2/ui_board_glow_9.png) | 12×12 | top-left (0,0); k=4; [stretch](../graphics/env-preview-vis2/stretch-ui_board_glow_9.png) | Gold overlay rim; transparent center. | `Yy` | None |
| [ui_board_post_3v](../graphics/env-preview-vis2/ui_board_post_3v.png) | 6×14 | top-left (0,0); k=3 top / 4 bottom; [stretch](../graphics/env-preview-vis2/stretch-ui_board_post_3v.png) | Wood support with a small splayed floor foot. | `OT` | None |
| [ui_bar_track_3](../graphics/env-preview-vis2/ui_bar_track_3.png) | 12×9 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_bar_track_3.png) | Brown rim around a dark green-slate progress groove. | `Ojt` | None |
| [ui_bar_fill_green_3](../graphics/env-preview-vis2/ui_bar_fill_green_3.png) | 6×8 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_bar_fill_green_3.png) | Progress fill green; shared silhouette and bright upper stripe. | `G]` | None |
| [ui_bar_fill_yellow_3](../graphics/env-preview-vis2/ui_bar_fill_yellow_3.png) | 6×8 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_bar_fill_yellow_3.png) | Progress fill yellow; shared silhouette and bright upper stripe. | `Yy` | None |
| [ui_bar_fill_red_3](../graphics/env-preview-vis2/ui_bar_fill_red_3.png) | 6×8 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_bar_fill_red_3.png) | Progress fill red; shared silhouette and bright upper stripe. | `HR` | None |
| [ui_bar_tick](../graphics/env-preview-vis2/ui_bar_tick.png) | 2×8 | top-left (0,0) | Cream milestone line. | `W` | None |
| [icon_project_0](../graphics/env-preview-vis2/icon_project_0.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 0. | `Of` | None |
| [icon_project_1](../graphics/env-preview-vis2/icon_project_1.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 1. | `O]` | None |
| [icon_project_2](../graphics/env-preview-vis2/icon_project_2.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 2. | `Oぅ` | None |
| [icon_project_3](../graphics/env-preview-vis2/icon_project_3.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 3. | `Op` | None |
| [icon_project_4](../graphics/env-preview-vis2/icon_project_4.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 4. | `/O` | None |
| [icon_project_5](../graphics/env-preview-vis2/icon_project_5.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 5. | `OZ` | None |
| [icon_project_6](../graphics/env-preview-vis2/icon_project_6.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 6. | `Om` | None |
| [icon_project_7](../graphics/env-preview-vis2/icon_project_7.png) | 12×12 | bottom-center (6,12) | Small project folder; color set 7. | `Oさ` | None |
| [ui_pill_0_9](../graphics/env-preview-vis2/ui_pill_0_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_0_9.png) | Rounded genre label; color set 0. | `Of` | None |
| [ui_pill_1_9](../graphics/env-preview-vis2/ui_pill_1_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_1_9.png) | Rounded genre label; color set 1. | `O]` | None |
| [ui_pill_2_9](../graphics/env-preview-vis2/ui_pill_2_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_2_9.png) | Rounded genre label; color set 2. | `Oぅ` | None |
| [ui_pill_3_9](../graphics/env-preview-vis2/ui_pill_3_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_3_9.png) | Rounded genre label; color set 3. | `Op` | None |
| [ui_pill_4_9](../graphics/env-preview-vis2/ui_pill_4_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_4_9.png) | Rounded genre label; color set 4. | `/O` | None |
| [ui_pill_5_9](../graphics/env-preview-vis2/ui_pill_5_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_5_9.png) | Rounded genre label; color set 5. | `OZ` | None |
| [ui_pill_6_9](../graphics/env-preview-vis2/ui_pill_6_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_6_9.png) | Rounded genre label; color set 6. | `Om` | None |
| [ui_pill_7_9](../graphics/env-preview-vis2/ui_pill_7_9.png) | 10×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_pill_7_9.png) | Rounded genre label; color set 7. | `Oさ` | None |
| [icon_warn_plate](../graphics/env-preview-vis2/icon_warn_plate.png) | 11×11 | bottom-center (5.5,11) | Red warning triangle with cream exclamation pictogram. | `HOW` | None |
| [ui_tab_9](../graphics/env-preview-vis2/ui_tab_9.png) | 12×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_tab_9.png) | Wood-rim cream shoulder tab for rank or focus. | `OTWt` | None |
| [ui_tab_gold_9](../graphics/env-preview-vis2/ui_tab_gold_9.png) | 12×12 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_tab_gold_9.png) | Gold-rim coin tab with gold face; same rim geometry. | `OYhy` | None |
| [ui_meter_track_3](../graphics/env-preview-vis2/ui_meter_track_3.png) | 8×5 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_meter_track_3.png) | Small focus groove. | `Ojt` | None |
| [ui_meter_fill_3](../graphics/env-preview-vis2/ui_meter_fill_3.png) | 4×3 | top-left (0,0); k=1; [stretch](../graphics/env-preview-vis2/stretch-ui_meter_fill_3.png) | Pale blue focus fill. | `BS` | None |
| [ui_memo_9](../graphics/env-preview-vis2/ui_memo_9.png) | 16×16 | top-left (0,0); k=4; [stretch](../graphics/env-preview-vis2/stretch-ui_memo_9.png) | Hanging wood-rim cream memo. | `OTWt` | None |
| [ui_memo_gold_9](../graphics/env-preview-vis2/ui_memo_gold_9.png) | 16×16 | top-left (0,0); k=4; [stretch](../graphics/env-preview-vis2/stretch-ui_memo_gold_9.png) | Hanging gold-rim pale gold memo. | `OYhy` | None |
| [icon_pin](../graphics/env-preview-vis2/icon_pin.png) | 4×4 | bottom-center (2,4) | Red pushpin; tiny canvas has no margins. | `HOR` | None |
| [icon_cord](../graphics/env-preview-vis2/icon_cord.png) | 2×4 | bottom-center (1,4) | Wood-brown hanging cord; tiny canvas has no margins. | `Ot` | None |
| [ui_chip_todo_9](../graphics/env-preview-vis2/ui_chip_todo_9.png) | 8×11 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_chip_todo_9.png) | Module chip todo; identical shape across three states. | `du` | None |
| [ui_chip_done_9](../graphics/env-preview-vis2/ui_chip_done_9.png) | 8×11 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_chip_done_9.png) | Module chip done; identical shape across three states. | `gu` | None |
| [ui_chip_alert_9](../graphics/env-preview-vis2/ui_chip_alert_9.png) | 8×11 | top-left (0,0); k=3; [stretch](../graphics/env-preview-vis2/stretch-ui_chip_alert_9.png) | Module chip alert; identical shape across three states. | `Hu` | None |

## H

| Sprite / preview | Pixels | Anchor / slice | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [icon_project_mini_0](../graphics/env-preview-vis2/icon_project_mini_0.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 0. | `Of` | None |
| [icon_project_mini_1](../graphics/env-preview-vis2/icon_project_mini_1.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 1. | `O]` | None |
| [icon_project_mini_2](../graphics/env-preview-vis2/icon_project_mini_2.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 2. | `Oぅ` | None |
| [icon_project_mini_3](../graphics/env-preview-vis2/icon_project_mini_3.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 3. | `Op` | None |
| [icon_project_mini_4](../graphics/env-preview-vis2/icon_project_mini_4.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 4. | `/O` | None |
| [icon_project_mini_5](../graphics/env-preview-vis2/icon_project_mini_5.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 5. | `OZ` | None |
| [icon_project_mini_6](../graphics/env-preview-vis2/icon_project_mini_6.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 6. | `Om` | None |
| [icon_project_mini_7](../graphics/env-preview-vis2/icon_project_mini_7.png) | 5×5 | top-left (0,0) | Miniature project folder; color set 7. | `Oさ` | None |
| [ui_minibar_track_3](../graphics/env-preview-vis2/ui_minibar_track_3.png) | 6×3 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_minibar_track_3.png) | Tiny monitor progress groove. | `Oj` | None |
| [ui_minibar_fill_3](../graphics/env-preview-vis2/ui_minibar_fill_3.png) | 4×3 | top-left (0,0); k=1; [stretch](../graphics/env-preview-vis2/stretch-ui_minibar_fill_3.png) | Tiny green progress fill. | `G]` | None |
| [ui_minibar_fill_yellow_3](../graphics/env-preview-vis2/ui_minibar_fill_yellow_3.png) | 4×3 | top-left (0,0); k=1; [stretch](../graphics/env-preview-vis2/stretch-ui_minibar_fill_yellow_3.png) | Tiny yellow planning fill. | `Yy` | None |
| [ui_minibar_tick](../graphics/env-preview-vis2/ui_minibar_tick.png) | 1×3 | top-left (0,0) | Tiny cream milestone. | `W` | None |
| [screen_gitlog_0](../graphics/env-preview-vis2/screen_gitlog_0.png) | 10×2 | top-left (0,0) | Dim green commit dot and short log stroke. | `g` | None |
| [screen_gitlog_1](../graphics/env-preview-vis2/screen_gitlog_1.png) | 14×2 | top-left (0,0) | Dim green commit dot and short log stroke. | `g` | None |
| [screen_gitlog_2](../graphics/env-preview-vis2/screen_gitlog_2.png) | 18×2 | top-left (0,0) | Dim green commit dot and short log stroke. | `g` | None |
| [screen_gitlog_3](../graphics/env-preview-vis2/screen_gitlog_3.png) | 22×2 | top-left (0,0) | Dim green commit dot and short log stroke. | `g` | None |
| [screen_gitlog_new](../graphics/env-preview-vis2/screen_gitlog_new.png) | 18×2 | top-left (0,0) | Bright green latest commit dot and orange end marker. | `AGg` | None |

## I

| Sprite / preview | Pixels | Anchor / slice | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_research_desk](../graphics/env-preview-vis2/prop_research_desk.png) | 72×28 | bottom-center (36,28) | Small wood desk, three technical books at left and an open book at center. | `BDGLOTWbdgtuw` | None |
| [prop_research_desk_on](../graphics/env-preview-vis2/prop_research_desk_on.png) | 72×28 | bottom-center (36,28) | Same research desk; brighter open pages and one purple book glint. | `;BDGLOTWbdgstu` | None |
| [desk_wood_main](../graphics/env-preview-vis2/desk_wood_main.png) | 116×3 | top-left (0,0) | Wood desktop; exact existing laminate canvas, placement and silhouette. | `OTt` | None |
| [prop_fence](../graphics/env-preview-vis2/prop_fence.png) | 104×26 | bottom-center (52,26) | Low quiet wood fence, spaced pickets and two horizontal rails. | `Ot` | None |
| [prop_shelf_box_0](../graphics/env-preview-vis2/prop_shelf_box_0.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 0. | `Ofw` | None |
| [prop_shelf_box_1](../graphics/env-preview-vis2/prop_shelf_box_1.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 1. | `O]w` | None |
| [prop_shelf_box_2](../graphics/env-preview-vis2/prop_shelf_box_2.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 2. | `Owぅ` | None |
| [prop_shelf_box_3](../graphics/env-preview-vis2/prop_shelf_box_3.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 3. | `Opw` | None |
| [prop_shelf_box_4](../graphics/env-preview-vis2/prop_shelf_box_4.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 4. | `/Ow` | None |
| [prop_shelf_box_5](../graphics/env-preview-vis2/prop_shelf_box_5.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 5. | `OZw` | None |
| [prop_shelf_box_6](../graphics/env-preview-vis2/prop_shelf_box_6.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 6. | `Omw` | None |
| [prop_shelf_box_7](../graphics/env-preview-vis2/prop_shelf_box_7.png) | 10×9 | top-left (0,0) | Small released-project box with cream tape; color set 7. | `Owさ` | None |
| [fx_shelf_glow](../graphics/env-preview-vis2/fx_shelf_glow.png) | 12×11 | top-left (0,0) | Gold shelf-box outline with a transparent center. | `Yy` | None |
| [prop_trophy_stand](../graphics/env-preview-vis2/prop_trophy_stand.png) | 24×12 | bottom-center (12,12) | Stepped wood award pedestal; existing award mounts above. | `OTt` | None |
| [prop_easel](../graphics/env-preview-vis2/prop_easel.png) | 22×28 | bottom-center (11,28) | A-shaped wood easel legs and two crossbars; existing poster rests above. | `OTt` | None |

## J

| Sprite / preview | Pixels | Anchor / slice | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [fx_shadow_3](../graphics/env-preview-vis2/fx_shadow_3.png) | 12×5 | top-left (0,0); k=4; [stretch](../graphics/env-preview-vis2/stretch-fx_shadow_3.png) | Single dark-brown stepped oval shadow; game supplies opacity. | `O` | None |
| [prop_rug_3](../graphics/env-preview-vis2/prop_rug_3.png) | 16×5 | top-left (0,0); k=4; [stretch](../graphics/env-preview-vis2/stretch-prop_rug_3.png) | Single warm wood-brown rug with stepped ends and small fringe tips. | `t` | None |

## K

| Sprite / preview | Pixels | Anchor / slice | Shows / use | Palette characters | New colors |
| --- | --- | --- | --- | --- | --- |
| [prop_fever_gauge](../graphics/env-preview-vis2/prop_fever_gauge.png) | 15×44 | bottom-center (7.5,44) | Empty wood-and-brass tube; cream window x3..11, y3..40 inclusive. | `OTWy` | None |
| [ui_gauge_fill_blue_3v](../graphics/env-preview-vis2/ui_gauge_fill_blue_3v.png) | 9×6 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_gauge_fill_blue_3v.png) | Vertical gauge blue; same shape with a bright surface stripe. | `Bぅ` | None |
| [ui_gauge_fill_gold_3v](../graphics/env-preview-vis2/ui_gauge_fill_gold_3v.png) | 9×6 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_gauge_fill_gold_3v.png) | Vertical gauge gold; same shape with a bright surface stripe. | `Yy` | None |
| [ui_gauge_fill_red_3v](../graphics/env-preview-vis2/ui_gauge_fill_red_3v.png) | 9×6 | top-left (0,0); k=2; [stretch](../graphics/env-preview-vis2/stretch-ui_gauge_fill_red_3v.png) | Vertical gauge red; same shape with a bright surface stripe. | `HR` | None |
| [icon_bolt](../graphics/env-preview-vis2/icon_bolt.png) | 8×10 | bottom-center (4,10) | Compact gold lightning signal. | `Y` | None |
| [prop_star_deco_0](../graphics/env-preview-vis2/prop_star_deco_0.png) | 11×11 | bottom-center (5.5,11) | Gold shelf star ornament on a tiny stand; twinkle frame 0. | `OY` | None |
| [prop_star_deco_1](../graphics/env-preview-vis2/prop_star_deco_1.png) | 11×11 | bottom-center (5.5,11) | Same star canvas and stand; twinkle frame 1 changes two highlights. | `OWY` | None |
| [icon_update_ribbon](../graphics/env-preview-vis2/icon_update_ribbon.png) | 6×8 | bottom-center (3,8) | Tiny red update ribbon with forked end; only two drawable columns. | `HR` | None |
| [icon_badge_hire](../graphics/env-preview-vis2/icon_badge_hire.png) | 7×7 | bottom-center (3.5,7) | Gold hire badge with dark exclamation; tiny canvas has no margins. | `OYy` | None |
| [icon_memo](../graphics/env-preview-vis2/icon_memo.png) | 9×11 | bottom-center (4.5,11) | Cream request paper, red header and two slate lines. | `DORW` | None |

## Palette reuse

**New colors proposed: 0. New characters: none.** Every entry is copied exactly from the existing global palette, including its original non-ASCII character. No alpha colors are supplied; shadow/rug opacity belongs to integration.

Color sets share the same face hue across project folders, mini folders, pills, and shelf boxes. Matching uses minimum squared Euclidean distance in existing 8-bit sRGB, with no new colors:

| Index | Requested hue | Existing character | Existing hex |
| --- | --- | --- | --- |
| 0 | #e8873a | `f` | `#EC8952` |
| 1 | #5aa469 | `]` | `#74A571` |
| 2 | #4a90c2 | `ぅ` | `#4F87C0` |
| 3 | #c25a7a | `p` | `#D66D87` |
| 4 | #8a6fc9 | `/` | `#AC67CD` |
| 5 | #d9b23a | `Z` | `#F1BF41` |
| 6 | #4fb3a9 | `m` | `#578BC5` |
| 7 | #a05a3a | `さ` | `#975037` |

The existing palette has no close teal or muted violet match: set 6 uses `m #578BC5` and set 4 uses `/ #AC67CD`, the mathematical nearest matches. Set 2 remains distinct at `ぅ #4F87C0`. This is a documented palette approximation, not a proposed new color.

| Character | Existing hex |
| --- | --- |
| `/` | `#AC67CD` |
| `;` | `#C083DD` |
| `A` | `#F49A45` |
| `B` | `#71BED3` |
| `D` | `#718293` |
| `G` | `#85CA91` |
| `H` | `#C53333` |
| `L` | `#C1C8CB` |
| `O` | `#604B40` |
| `R` | `#E66B52` |
| `S` | `#C7DCF3` |
| `T` | `#C99A66` |
| `W` | `#FFF5E6` |
| `Y` | `#FFDA64` |
| `Z` | `#F1BF41` |
| `]` | `#74A571` |
| `b` | `#408599` |
| `d` | `#465464` |
| `f` | `#EC8952` |
| `g` | `#437660` |
| `h` | `#F8CF69` |
| `j` | `#132538` |
| `m` | `#578BC5` |
| `p` | `#D66D87` |
| `s` | `#E9EFFF` |
| `t` | `#996D49` |
| `u` | `#2F3444` |
| `w` | `#DFCDB7` |
| `y` | `#C99A42` |
| `ぅ` | `#4F87C0` |
| `さ` | `#975037` |

## Consistency, detail limits, and scope

All **80 requested names** are delivered in complete G (36), H (17), I (15), J (2), K (10) groups. Nothing omitted. This order explicitly requests wood frames, wood desks, fence, easel and warm rug; those specific instructions take precedence over the broader office-direction material replacement proposals. Slate outlines, cool technical-book covers and cream paper sit alongside the previous signal lamps, backlog boards and card/tray art. Characters remain entirely sakuri’s scope.

Board/tab/memo frames share `O` outlines and the same three-pixel rim logic (`T/t` wood or `y/Y` gold); the bright stripe is on the upper rim. All three progress fills, three chip states and three gauge fills use identical geometry and differ only in color. The research pair is pixel-identical outside the open book; only its pages brighten, with exactly one purple glint pixel. The star pair keeps its canvas, silhouette and stand; two highlight pixels twinkle. Shelf/board glow centers are transparent.

The required 2px margins leave only 2 drawable columns for the 6×8 update ribbon and 4 for the 8×10 bolt; these use compact silhouettes. The 9×11 memo has a five-pixel-wide paper including outline, so its two gray strokes are two pixels long. The warning triangle uses a one-pixel-wide cream exclamation. Tiny hire badge/pin/cord use the explicit no-margin exception. Wood grain is omitted from stretchable frames to protect clean scaling. Shadow and rug each contain one opaque color, with stepped rounded ends; the rug’s end tips suggest fringe without a second color.

Validation passed: exact inventory and dimensions, every row width, 20 grounded margins, exact reuse of 31 palette entries, all 32 directional slice invariants, nearest project hues in all four sets, shared state shapes, exact desktop silhouette, book-only research changes, one purple glint, stable star silhouette, transparent glow centers, single-color shadow/rug, and exact gauge window `(x3..11,y3..40)`. Output: **80 individual PNGs + 32 stretch PNGs + 1 named contact sheet = 113 PNGs**. The contact sheet and representative frame, post, gauge, desk, star and warning previews were visually inspected.

No existing files were edited. No game execution, version bump, integration or commit. Game composition remains untested as requested.

## Group G follow-up validation ? 2026-10-27

This follow-up was scoped to G only. All 36 G sprites were already present on entry; no sprite data or renderer was edited by this run. The existing H?K content and full-pack manifest were retained. G consists of: board 24?24; glow 12?12; post 6?14; bar track 12?9; three bar fills 6?8; tick 2?8; eight folders 12?12; eight pills 10?12; warning 11?11; two tabs 12?12; meter track 8?5 and fill 4?3; two memos 16?16; pin 4?4; cord 2?4; three chips 8?11.

The existing standard-library renderer regenerated all existing previews. G accounts for 36 individual PNGs and 24 stretch PNGs. An independent PNG decode checked all 1,171,920 pixels in those 60 files against the source maps, confirming exact 4? nearest-neighbor samples, #808080 transparent-pixel backing, and preserved slice corners/caps. The G manifest section contains all 36 linked entries. The contact sheet, stretched board and stretched gold tab were visually inspected. New colors proposed: 0; nothing trimmed. The tiny pin and cord retain their allowed no-margin exception. No game was run and no commit was made.
