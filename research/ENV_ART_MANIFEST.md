# Environment art first pass

2026-10-25 · 『みゅけ、きょうも開発中』 · Environment only; character art remains sakuri's.

[Sprite data](../graphics/env-sprites.js) exports `window.MIYUKE_ENV_SPRITES` with the same `{ palette, sprites: { name: string[] } } structure as [sprites.js](../graphics/sprites.js). All rows are literal, equal-width strings; `.` means transparent. The separate namespace avoids replacing existing sprites when reviewing the pack. Integration has not been performed.

[Contact sheet](../graphics/env-preview/contact-sheet.png) and ten individual previews are rendered at **4× nearest-neighbor**, with transparent pixels shown on **#808080**. Preview PNGs have an opaque background; the string maps are the transparent source for Aseprite work. The offline [Node renderer](../graphics/render-env-preview.cjs) reads the data, validates palette reuse and rectangular maps, and writes PNGs using standard-library zlib. It does not load or run the game.

```sh
node graphics/render-env-preview.cjs
# Optional: regenerate one preview, plus the complete contact sheet.
node graphics/render-env-preview.cjs prop_kanban
```

## Coordinate and tier contract

The 210 CSS-pixel strip uses **120 virtual units**, with `G = STRIP_GROUND = 116`. At DPR 1 its final canvas transform is 210/120 = 1.75. The scale below is the sprite's scale **before** that transform. Applying 2× to every asset would break the small procedural furniture footprints.

Native anchors are edge coordinates: `(width/2, height)` is bottom-center, with the last opaque row ending at that edge. `cx = stripDeskCX()`, `dcx = stripDesk2CX()`, and `scx = stripShelfCX()`. All coordinates below are virtual strip units unless explicitly called native pixels.

The existing `officeTier()` mapping is unchanged: 0 garage/wood; 1 small office after a release and a hire; 2 dev studio after line 2 opens or studio level reaches 3; 3 HQ after a prestige. Tier 1 assets continue through tiers 2–3; tier 2 assets continue through tier 3. Existing visibility conditions still apply. These are the user's requested art thresholds, regardless of older prose suggesting later furniture upgrades.

## Sprite inventory

Every sprite proposes **zero new colors**. Palette character strings are case-sensitive and omit transparent `.`.

| Sprite / preview | Native pixels | Tier | Native anchor; proposed draw anchor and scale | Replaces / fits | Palette characters |
| --- | --- | --- | --- | --- | --- |
| [prop_kanban](../graphics/env-preview/prop_kanban.png) | 132×30 | ≥1 | Face bottom-center `(66,30)`; `(cx,34)` at 1× | Main `drawStripProjectBoard` face, `sR(bx,4,132,30)` | `YyBbGgDdLlCmsu` |
| [desk_laminate_main](../graphics/env-preview/desk_laminate_main.png) | 116×3 | ≥1 | Bottom-center `(58,3)`; `(cx,G)` at 1× | `renderStrip` slab `(cx-58,G-3,116,3)` and top highlight | `dLlsu` |
| [desk_laminate_2](../graphics/env-preview/desk_laminate_2.png) | 80×16 | ≥1, line 2 visible | Bottom-center `(40,16)`; `(dcx,G)` at 1× | Procedural fallback's 80×3 top plus two 3×13 legs | `DdLlsu` |
| [desk_laminate_2_sprite](../graphics/env-preview/desk_laminate_2_sprite.png) | 40×24 | ≥1, line 2 visible | Bottom-center `(20,24)`; `(dcx,G)` at 2× | Additional companion: active `prop_desk2` path, exact 80×48 canvas | `KTtDdLlmSsu` |
| [prop_chair](../graphics/env-preview/prop_chair.png) | 32×36 | ≥1 | Bottom-center `(16,36)`; `(cx+12,G)` at 2× | New chair behind seated cat; 64×72 envelope inside main cluster | `Ddnu` |
| [prop_server_rack](../graphics/env-preview/prop_server_rack.png) | 48×64 | ≥2 | Bottom-center `(24,64)`; `(round(stripVW*0.55),G)` at 1× | No existing server placement; requested 48×64 native fallback | `YBGgDdLnSu` |
| [shelf_steel](../graphics/env-preview/shelf_steel.png) | 40×28 | ≥2 | Bottom-center `(20,28)`; `(scx,G)` at 2× | Active `prop_shelf`, exact 80×56 canvas and hit rectangle | `dLsu` |
| [prop_books](../graphics/env-preview/prop_books.png) | 24×7 | ≥2 | Bottom-center `(12,7)`; `(scx,G-10)` at 2× | Removable row fitting one lower shelf opening, 48×14 | `YyBbGgLMmsu` |
| [prop_archive_boxes](../graphics/env-preview/prop_archive_boxes.png) | 18×25 | ≥1 | Bottom-center `(9,25)`; `(ex,G)` at 1× | Easel/poster and feet, within 18×25 envelope | `2OwdiJs` |
| [prop_mat](../graphics/env-preview/prop_mat.png) | 150×4 | ≥1 | Bottom-center `(75,4)`; `(cx,G+3)` at 1× | Main `sRug(cx,150)` rectangle `(cx-75,G-1,150,4)` | `Ddn` |

### prop_kanban

An aluminum perimeter with dark slate corner caps surrounds a clean cool-white writing surface. Tiny 3×5 TODO / DOING / DONE letters use gray / blue / green; the notes use yellow / cyan / green. Yellow is its one warm accent family. The notes are decorative first-pass dressing, not a representation of actual completed features.

The **main face stays exactly 132×30**. In face-local coordinates:

- Existing project icon: x=4..16, y=4..16.
- Existing large percentage starts at x=19, vertically centered at y=10.5. The left field through x=56 remains clear.
- Column headings occupy x=57..111, y=3..7; notes and separators end at y=15.
- Existing warning plate: x=116..127, y=3.5..14.5; this field remains clear.
- Existing fat bar: x=4, y=18, width=124, height=7.5. Its outer frame spans x=3.2..128.8 and y=17.2..26.3. The entire corresponding art region is blank white.

The `board` hit rectangle, live icon, percentage, progress math, ticks, warning, release pulse, and completed-feature pin overlays can retain their coordinates. Draw the face before those overlays. The long support poles remain a separate procedural element, outside this face-only asset. The secondary board is 108×30; this main-board sprite must **not** be squeezed into it. A dedicated compact face is outside this requested set.

### desk_laminate_main

Light laminate, a slate front edge, and two dark metal end caps replace the wood. **The actual main desk has only three units of height and no existing legs.** The 116×3 footprint leaves no room for freestanding legs below the top while keeping the same ground line. This version therefore preserves the shallow plinth and suggests metal supports in the bottom row. Taller legs would require a later layout decision, moving the top or extending below G. No warm accent.

### desk_laminate_2 and desk_laminate_2_sprite

The procedural fallback really is an 80×16 furniture envelope: top at G−16 with height 3, legs at dcx−38 and dcx+35 with width 3 and height 13. `desk_laminate_2` matches all those endpoints, with slim metal legs and dark ground caps. Its existing procedural monitor remains separate. No warm accent.

The current game normally resolves **`prop_desk2`**, whose geometry differs: a 40×24 map at 2×, a visible desk top at native x=4..35/y=15..17, and legs at x=5..6 and 33..34/y=18..23. The additional `desk_laminate_2_sprite` changes only those furniture pixels. Its existing monitor, screen window, stand, and cardboard stack are copied without alteration. The cardboard remains its sole warm material. Use one desk asset for the matching rendering path; do not layer both.

`drawStripDesk2Screen` still targets native x=15..26/y=4..11 in the companion. Existing line-2 work piles can retain their active-path G−18 baseline. The main desk hit rectangle remains `(cx-62,G-31,124,35)`.

### prop_chair

Dark mesh back with sparse rectangular weave marks, a headrest, lumbar band, armrests, cushion, gas lift, and caster spokes. Four slate colors keep it subordinate to the cat. Its feet reach native row 35. This is a new furniture layer, drawn behind the cat and desk; no character pixels or anchors are changed. At 2× it occupies 64×72 units, below the 90-unit furniture height budget. No warm accent.

### prop_server_rack

A newly authored four-bay rack with recessed vents, pale handles, status dots, and a low cable loop. The old `prop_server` was inspected but not copied. Green/cyan dots and one amber standby dot sit on broad slate surfaces. Amber is the sole warm accent family; it is static decoration, not live CI state.

There is **no `prop_server` placement call or reserved rectangle in the current renderer**. The native 48×64 fallback follows the request. Draw it at 1× to retain the art direction's 48×64 strip envelope; 2× would exceed the 90-unit height budget. Hand-authored 2×2 pixel clusters make its visual weight consistent with the other props drawn at 2×.

Optional future LED overlays can target native x=34..35 at y=12..13, 22..23, 32..33, and 42..43. The documented E-zone center 0.55W is a proposed placement only: the newer build pile is at 0.53W, so their collision needs an integration review. No placement or visibility logic has been added.

### shelf_steel

The 40×28 canvas, native visible outer extents x=5..34, top row 4, upright positions, and feet at row 27 match the loaded wooden shelf. There is no filled back, baked book, box, fence, or star. White laminate surfaces and narrow steel uprights keep the shelf visually light. No warm accent.

The existing `stripShelfSlots()` baselines are G−30 and G−10, equivalent to native y=13 and y=23. The new shelf surfaces begin **exactly at those rows**, eliminating the old one-native-pixel gap between those baselines and its wooden boards at y=14/24. Runtime box coordinates, counts, colors, and latest-release glow stay unchanged. The star can retain its separate existing anchor. The shelf's separately drawn fence is not part of this asset and would need to be omitted by the future tier integration.

### prop_books

Eight small tech-book spines with pale label stripes, including two stepped leaning volumes. Blue/cyan/green and off-white dominate; one yellow volume supplies the warm accent. The 24×7 row fits native shelf x=8..31/y=16..22 and rests directly on its y=23 lower deck.

Both existing shelf levels can contain release boxes; there is **no permanently vacant third level**. This removable art can dress a vacant lower level or a future alternate shelf arrangement. Do not overlay it on occupied release boxes or displace those boxes as part of a simple material swap. No release-box pixels are baked into this asset.

### prop_archive_boxes

Three offset closed cartons with taped lids, inventory labels, a handhold, and one small scuff. Muted cardboard is the only warm material family. Label strokes are slate; no character illustration is added.

`drawStripEasel` currently uses an 18×21.6 canvas (`prop_wall_1` 20×24 at 0.9×) anchored at G−3, plus feet ending at G. Its fallback is 18×22 at G−25. The new 18×25 stack fits that combined envelope using an integer grid. Keep the current collision adjustment: `ex = stripEaselCX()`, reduced to `min(ex,cx-96)` when the calendar is unlocked. The old poster can remain a separate source asset; this stack does not redraw its cat motif.

### prop_mat

A cool-gray anti-fatigue mat with one central seam and one-pixel cut corners. The primary rug envelope stays 150×4; its bottom-center anchor is **G+3**, not G. The former fractional hem at G+2.4 with height 0.8 is represented by the bottom raster row. All art colors are flat and opaque; no alpha palette extension, gradient, or antialiasing is used. Future integration may apply whole-sprite opacity to match the old faint rug, but the preview shows the actual palette colors. No warm accent.

## Palette reuse

**New colors proposed: 0. Suggested new characters: none.** The pack uses 25 of the existing 70 colors. Cool whites and grays already describe laminate and aluminum, slate colors cover the dark hardware, and existing muted browns cover archives. Extra ramps or pure-black outlines are unnecessary.

| Characters | Existing hex colors, in character order | Purpose |
| --- | --- | --- |
| `u d D n` | `#2F3444 #465464 #718293 #3F5267` | Slate outlines, hardware, mesh, mat |
| `L l s C S` | `#C1C8CB #8F9AA1 #E9EFFF #FFFFFF #C7DCF3` | Laminate, aluminum, board face, labels, existing monitor |
| `M m B b` | `#46678A #578BC5 #71BED3 #408599` | Cool syntax accents and book spines |
| `G g` | `#85CA91 #437660` | DONE heading, green notes/books/LEDs |
| `Y y` | `#FFDA64 #C99A42` | Single warm accent family on board/books/rack |
| `O 2 i J w` | `#604B40 #B99E7E #897164 #D4B9AC #DFCDB7` | Archive outlines, cardboard, lid plane, tape |
| `K T t` | `#45414A #C99A66 #996D49` | Unchanged monitor/box pixels in the active second-desk companion |

## Handoff and limits

All nine requested sprites are finished, plus the active second-desk companion. Nothing was cut from the requested list. Full-height main-desk legs cannot coexist with its measured three-unit envelope; the supplied art documents that constraint instead of changing the layout. No alternate tier-3 art, compact secondary board, runtime overlays, or furniture integration is included.

Review covers flat-color pixel maps, exact dimensions, palette characters, ground rows, preview pixels, board overlay clear areas, shelf contact rows, and preservation of the companion monitor/cardboard. Every individual preview and the contact sheet was visually inspected. `game/index.html`, `graphics/sprites.js`, and `DESIGN.md` are unchanged. The game was not run; no version bump or commit was made. Strip composition and live-state validation remain part of the later integration pass.
