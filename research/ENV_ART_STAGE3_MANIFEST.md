# Stage 3 environment art first pass

2026-10-26 · 『みゅけ、きょうも開発中』 · Environment only; sakuri owns all character art.

[Sprite data](../graphics/env-sprites-stage3.js) exports `window.MIYUKE_ENV_SPRITES_3` in the existing `{ palette, sprites: { name: string[] } }` format. Maps are literal equal-width strings; `.` is transparent. This standalone pack has not been integrated into the game.

[Contact sheet](../graphics/env-preview3/contact-sheet.png) and four individual PNGs show the data at **4× nearest-neighbor on #808080**. PNG backgrounds are opaque for review; transparency remains in the source maps. The offline [Node renderer](../graphics/render-env-preview3.cjs) mirrors the previous pack's standard-library PNG encoder and validates exact dimensions, palette reuse, margins, ground rows, and the blank board interior. It does not run the game.

```sh
node graphics/render-env-preview3.cjs
```

## Inventory and anchors

Anchors are native edge coordinates: `(width/2,height)` is bottom-center. All current placement calls use scale 1. `G = STRIP_GROUND`; the board face starts at `STRIP_BOARD.top` (currently 3). Supports, hit rectangles, live text, chips, bars and update effects remain runtime responsibilities.

| Sprite / preview | Native size | Bottom-center anchor | Use / current placement | Palette characters |
| --- | --- | --- | --- | --- |
| [prop_phone](../graphics/env-preview3/prop_phone.png) | 12×18 | `(6,18)` | Staff/hiring phone beside the main board's left post; `drawStripProjectBoard`, `(bx+10,G)` | `LRWdu` |
| [prop_megaphone](../graphics/env-preview3/prop_megaphone.png) | 18×13 | `(9,13)` | Cheer/click floor prop left of desk; `renderStrip`, `(cx-76,G)` | `RWuw` |
| [prop_toolbox](../graphics/env-preview3/prop_toolbox.png) | 20×12 | `(10,12)` | Settings toolbox under desk; `renderStrip`, `(cx+42,G)` | `#-DLu` |
| [prop_kanban_wide](../graphics/env-preview3/prop_kanban_wide.png) | 204×64 | Face `(102,64)` | Tier ≥1 main leaderboard face; `drawStripProjectBoard`, `(bcx,STRIP_BOARD.top+64)` | `DLdlsu` |

### prop_phone

Front-side upright charcoal/slate body with a cream handset resting across the top, a single vermilion lamp pixel at native `(5,7)`, and six pale keypad marks. Two protruding slate pixels at `(8,11)` and `(8,13)` suggest a coiled cord. The handset is intentionally chunky to read inside the eight-pixel usable width. Top two rows and left/right two columns are transparent; the body reaches the bottom row. Red is the sole warm accent, alongside neutral cream.

### prop_megaphone

A cream cone steps upward toward the right, finishing in a vermilion rim band. A tiny outlined rear mouthpiece and matching red handle establish the silhouette. The handle rests on the bottom row. Top/left/right margins are two pixels; cream and its existing neutral shadow stay flat. Rim and handle share one warm accent family.

### prop_toolbox

A sturdy warm red-brown case with a dark lid seam, a slate outline, and gray metal handle and latch. The open handle begins on row 2; the case is grounded on row 11. The top two rows and left/right two columns stay transparent. Red-brown is the only warm material family; there are no decorative labels or baked update ribbons.

### prop_kanban_wide

Full-bleed aluminum perimeter with slate corner caps; no transparent pixels or exterior margin. Frame occupies x=0..1 / 202..203 and y=0..2 / 61..63. The entire writing surface, x=2..201 and y=3..60, is uniform cool white `s`. There are no letters, notes, columns, bars, chips, mounting legs, or tray. This protects the main board's live leaderboard overlays and avoids carrying the old 132×30 board's decorative columns into the new face. No warm accent.

## Palette reuse

**New colors proposed: 0. Suggested new characters: none.** All 11 entries match `graphics/sprites.js` verbatim.

| Characters | Existing hex colors, in character order | Purpose |
| --- | --- | --- |
| `u d` | `#2F3444 #465464` | Slate outlines, phone body, board perimeter |
| `D L l` | `#718293 #C1C8CB #8F9AA1` | Metal frame, handle, latch and keypad |
| `W w` | `#FFF5E6 #DFCDB7` | Cream handset and megaphone; cone shadow |
| `R` | `#E66B52` | Vermilion lamp, megaphone rim and handle |
| `# -` | `#8A4C33 #663D37` | Warm red-brown toolbox body and dark lid seam |
| `s` | `#E9EFFF` | Uniform cool-white board writing surface |

## Handoff and limits

All four requested sprites are complete; nothing was trimmed from the requested set. Phone keypad and cord detail are deliberately sparse to fit the mandated margins at native scale. All pixels are flat colors with no gradients or antialiasing. The renderer checks passed and the rendered art was visually inspected. Game composition has not been tested: the game was not run. `game/index.html`, `graphics/sprites.js`, and `graphics/env-sprites.js` were not edited; no version bump or commit was made.
