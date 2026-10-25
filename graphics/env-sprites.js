/* Environment first pass for みゅけ、きょうも開発中.
 * Hand-authored flat pixel maps; sakuri owns all character art.
 * Standalone art pack: deliberately not merged into MIYUKE_SPRITES.
 * Same { palette, sprites: { name: string[] } } data format as sprites.js.
 * Every palette entry is reused verbatim from graphics/sprites.js.
 * '.' = transparent. Sizes are native pixels; scale/anchors are per sprite.
 * See research/ENV_ART_MANIFEST.md for geometry and integration boundaries.
 */
window.MIYUKE_ENV_SPRITES = {
  palette: {
    "2": "#B99E7E",
    "O": "#604B40",
    "w": "#DFCDB7",
    "K": "#45414A",
    "Y": "#FFDA64",
    "y": "#C99A42",
    "B": "#71BED3",
    "b": "#408599",
    "G": "#85CA91",
    "g": "#437660",
    "T": "#C99A66",
    "t": "#996D49",
    "D": "#718293",
    "d": "#465464",
    "L": "#C1C8CB",
    "l": "#8F9AA1",
    "C": "#FFFFFF",
    "i": "#897164",
    "J": "#D4B9AC",
    "M": "#46678A",
    "m": "#578BC5",
    "n": "#3F5267",
    "S": "#C7DCF3",
    "s": "#E9EFFF",
    "u": "#2F3444",
  },
  sprites: {
    /* Tier >=1 (small office through HQ); 132x30; anchor: face bottom-center (66,30).
     * Draw at (round(stripDeskCX()), STRIP_BOARD.top + STRIP_BOARD.h), scale 1.
     * Replaces drawStripProjectBoard MAIN face sR(bx,top,132,30), not support poles.
     * Keeps x=4..56 for icon/giant %, x=116..127 for warning, y=17..27 for fat bar clear.
     * Native size equals strip units (not the usual prop x2); do not scale to the 108-wide board. */
    prop_kanban: [
      ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.",
      "duLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLud",
      "dlsCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCsld",
      "dlsssssssssssssssssssssssssssssssssssssssssssssssssssssssdddssdssddsssdssLsmmsssmssmmmsmsmssmmsLsggsssgssgsgsgggssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssdssdsdsdsdsdsdsLsmsmsmsmssmssmmmsmsssLsgsgsgsgsgggsgssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssdssdsdsdsdsdsdsLsmsmsmsmssmssmmmsmsmsLsgsgsgsgsgggsggsssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssdssdsdsdsdsdsdsLsmsmsmsmssmssmmmsmsmsLsgsgsgsgsgggsgssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssdsssdssddsssdssLsmmsssmssmmmsmsmssmmsLsggsssgssgsgsgggssssssssssssssssssld",
      "dlsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssLsssssssssssssssssssssLssssssssssssssssssssssssssssssssssld",
      "dlsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssLsssssssssssssssssssssLssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssYYYYYssssssssLsssssssBBBBBsssssssssLsssssGGGGGssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssYsssYYsssssssLsssssssBsssBBssssssssLsssssGsssGGsssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssYYYYYYsssssssLsssssssBBBBBBssssssssLsssssGGGGGGsssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssYYYYYYsssssssLsssssssBBBBBBssssssssLsssssGGGGGGsssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssyyyyyysssssssLsssssssbbbbbbssssssssLsssssggggggsssssssssssssssssssssssld",
      "dlsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssLsssssssssssssssssssssLssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "dlssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssld",
      "duDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDud",
      ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.",
    ],
    /* Tier >=1; 116x3; anchor: bottom-center (58,3), at (stripDeskCX(), G), scale 1.
     * Replaces renderStrip sR(cx-58,G-3,116,3) and its 1.1-unit top highlight.
     * The current main desk is a 3-unit plinth with NO leg clearance: dark metal end caps
     * stay inside that envelope. Full-height legs would require a layout change. */
    desk_laminate_main: [
      "lssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssl",
      "LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL",
      "duuudddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddduuud",
    ],
    /* Tier >=1 when line 2 is available; 80x16; anchor: bottom-center (40,16).
     * At (stripDesk2CX(),G), scale 1. Replaces drawStripDesk2 FALLBACK furniture only:
     * sR(dcx-40,G-16,80,3), legs (dcx-38/G-13,3x13) and (dcx+35/G-13,3x13).
     * Keep the separate fallback monitor and progress drawing. The active prop_desk2
     * path differs: use desk_laminate_2_sprite below for that exact sprite footprint. */
    desk_laminate_2: [
      "lssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssl",
      "LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL",
      "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "..ddd......................................................................ddd..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uDu......................................................................uDu..",
      "..uuu......................................................................uuu..",
    ],
    /* Tier >=1 when line 2 is available; active-path companion; 40x24; anchor (20,24).
     * At (stripDesk2CX(),G), scale 2: exact 80x48 canvas of current prop_desk2.
     * Replaces that sprite as a unit; only wood desktop rows 15..17 and legs 18..23 change.
     * Original monitor, screen window (x15..26/y4..11), and cardboard stack are unchanged.
     * Do not also draw desk_laminate_2: that is only for the procedural fallback. */
    desk_laminate_2_sprite: [
      "........................................",
      "........................................",
      "........................................",
      "..............KKKKKKKKKKKKKK............",
      "..............KSSSSSSSSSSSSK............",
      "..............KSSSSSSSSSSSSK............",
      "..............KSmmmmmmSSSSSK............",
      "..............KSSSSSSSSSSSSK............",
      "..............KSmmmmSSSSSSSK............",
      "..............KSSSSSSSSSSSSK............",
      "..............KSmmmmmmmSSSSK............",
      "..............KSSSSSSSSSSSSKttttttt.....",
      "..............KKKKKKKKKKKKKKTTTTTTT.....",
      "...................KKKK.....TTTTTTT.....",
      "...............LLLLLLLLLL...TTTTTTT.....",
      "....lssssssssssssssssssssssssssssssl....",
      "....LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL....",
      "....dddddddddddddddddddddddddddddddd....",
      ".....uD..........................Du.....",
      ".....uD..........................Du.....",
      ".....uD..........................Du.....",
      ".....uD..........................Du.....",
      ".....uD..........................Du.....",
      ".....uu..........................uu.....",
    ],
    /* Tier >=1; 32x36; anchor: bottom-center (16,36); at (stripDeskCX()+12,G), scale 2.
     * New office-chair layer behind the seated cat and desk; 64x72 strip-unit envelope.
     * No existing chair rect to replace. Fits inside the main 116-wide cluster and <=90 height.
     * Caster pixels touch row 35; do not move the cat anchor or add a new hit rectangle. */
    prop_chair: [
      "...........uuuuuuuuuu...........",
      "..........uudddddddduu..........",
      "..........uudddddddduu..........",
      "..........uuuuuuuuuuuu..........",
      "...........uuuuuuuuuu...........",
      "..............uDDu..............",
      ".........uuuuuuuuuuuuuu.........",
      ".......uudddddddddddddduu.......",
      ".......unnnnnnnnnnnnnnnnu.......",
      "......uunnnnnnnnnnnnnnnnuu......",
      "......unnnunnnunnnunnnunnu......",
      "......unnnunnnunnnunnnunnu......",
      "......unnnunnnunnnunnnunnu......",
      "......unddddddddddddddddnu......",
      "......unnnunnnunnnunnnunnu......",
      "......unnnunnnunnnunnnunnu......",
      "......unnnunnnunnnunnnunnu......",
      "......unddddddddddddddddnu......",
      "......unnnnnnnnnnnnnnnnnnu......",
      "......uunnnnnnnnnnnnnnnnuu......",
      "......uuudddddddddddddduuu......",
      "..uuuuuuudddddddddddddduuuuuuu..",
      "..uuuuuuuuuuuuuuuuuuuuuuuuuuuu..",
      "....dd....................dd....",
      "....dduddddddddddddddddddudd....",
      "....duunnnnnnnnnnnnnnnnnnuud....",
      "....duuuuuuuuuuuuuuuuuuuuuud....",
      "......uuuuuuuuuuuuuuuuuuuu......",
      "............uuuuuuuu............",
      "............uuuuuuuu............",
      "..............uDuu..............",
      "..........dddduDuudddd..........",
      ".......uuuuuuuuDuuuuuuuuu.......",
      ".....ddddddddduDuuddddddddd.....",
      "....uuuuuuuuuuuDuuuuuuuuuuuu....",
      "....uuuu......uuuu......uuuu....",
    ],
    /* Tier >=2; 48x64 native (requested fallback size); anchor: bottom-center (24,64).
     * No prop_server placement call or placement rect exists in renderStrip; old 24x32 art is unused.
     * Proposed anchor (round(stripVW*0.55),G), scale 1: 48x64 strip units, NOT scale 2.
     * Chunky 2x2 native clusters match the visual weight of other props drawn at x2.
     * Feet touch row 63. Live LED centers: x34..35, y12..13/22..23/32..33/42..43. */
    prop_server_rack: [
      "......uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu......",
      "......uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu......",
      "....uuDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDuu....",
      "....uuDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDuu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuDDDDDDDDuuuuuuSSSSSSSSSSuunndduu....",
      "....uuddnnuuDDDDDDDDuuuuuuSSSSSSSSSSuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuudddddduudduudduuddddddBBuunndduu....",
      "....uuddnnuudddddduudduudduuddddddBBuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddGGuunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddYYuunndduu....",
      "....uuddnnuuLLddDDDDDDDDDDddddddddYYuunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuuLLdddduudduudduudddddddduunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuudddddduudduudduuddddddgguunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuudduudddduudddduudddduudduunndduu....",
      "....uuddnnuudduudddduudddduudddduudduunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuddnnuuuuuuuuuuuuuuuuuuuuuuuuuuuunndduu....",
      "....uuuudddddddddddddddddddddddddddddddduuuu....",
      "....uuuudddddddddddddddddddddddddddddddduuuu....",
      "......uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu......",
      "......uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu......",
      "......dddddd........uuuuuuuu........dddddd......",
      "......dddddd........uuuuuuuu........dddddd......",
      "......uuuuuu........................uuuuuu......",
      "......uuuuuu........................uuuuuu......",
    ],
    /* Tier >=2; 40x28; anchor: bottom-center (20,28), at (stripShelfCX(),G), scale 2.
     * Replaces prop_shelf in drawStripShelf: exact 80x56 canvas / existing shelf hit rectangle.
     * Outer visible uprights remain x5..7 and x32..34; top remains row 4; feet row 27.
     * Release slots remain unchanged: shelf surfaces native y13/y23 = G-30/G-10.
     * Frame only: no baked release boxes, books, fence, background panel, or star decoration. */
    shelf_steel: [
      "........................................",
      "........................................",
      "........................................",
      "........................................",
      ".....uuuuuuuuuuuuuuuuuuuuuuuuuuuuuu.....",
      ".....ussssssssssssssssssssssssssssu.....",
      ".....uddddddddddddddddddddddddddddu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....udd........................ddu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....ussssssssssssssssssssssssssssu.....",
      ".....uLLLLLLLLLLLLLLLLLLLLLLLLLLLLu.....",
      ".....uddddddddddddddddddddddddddddu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....udd........................ddu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....uLd........................dLu.....",
      ".....ussssssssssssssssssssssssssssu.....",
      ".....uLLLLLLLLLLLLLLLLLLLLLLLLLLLLu.....",
      ".....uddddddddddddddddddddddddddddu.....",
      ".....uLd........................dLu.....",
      ".....uuu........................uuu.....",
    ],
    /* Tier >=2; 24x7; anchor: bottom-center (12,7), scale 2; one shelf level = 48x14.
     * At (stripShelfCX(),G-10), occupies shelf_steel native x8..31/y16..22.
     * New removable tech-book row; replaces no release-box pixels. Lower shelf surface is y23.
     * Use on a vacant level or as alternate dressing: a full release shelf has no spare slots.
     * Eight spines (two leaning); all bottom edges touch row 6. */
    prop_books: [
      "...uuu...uuu....uuu.uuu.",
      "uuuusLuuuuBb....umM.uGg.",
      "umMussuGgussuuu.uss.uss.",
      "ussusLussuBbuYyuuumMuGg.",
      "umMusLuGguBbussusumM.uGg",
      "umMusLuGguBbuYyusumM.uGg",
      "uuuuuuuuuuuuuuuuuuuuuuuu",
    ],
    /* Tier >=1; 18x25; anchor: bottom-center (9,25), at (ex,G), scale 1.
     * Replaces drawStripEasel poster + two feet; existing 18-wide envelope is G-25..G.
     * Active prop_wall_1 canvas is 20x24 at 0.9, anchored G-3: 18x21.6 plus 3-unit feet.
     * Reuse ex = min(stripEaselCX(),stripDeskCX()-96) when the calendar is unlocked.
     * Cardboard is the sole warm material; labels contain no character drawing. */
    prop_archive_boxes: [
      "....OOOOOOOOOOOO..",
      "....OJJJwwJJJiiO..",
      "....iiiiiiiiiiii..",
      "....O22222222iiO..",
      "....O2sssss22iiO..",
      "....O2sddds22iiO..",
      "....O22222222iiO..",
      ".OOOOOOOOOOOOOOO..",
      ".OJJJJJJwwJJJiiO..",
      ".O222222ww222iiO..",
      ".OiiiiiiiiiiiiiO..",
      ".O2ssssss2222iiO..",
      ".O2sdddss2222iiO..",
      ".O2sdssss2222iiO..",
      ".O22222222222iiO..",
      "OOOOOOOOOOOOOOOOOO",
      "OJJJJJJJwwJJJJiiiO",
      "O2222222ww2222iiiO",
      "OiiiiiiiiiiiiiiiiO",
      "O22sssssss2222iiiO",
      "O22sddddss22OOiiiO",
      "O22sssssss2222iiiO",
      "O22sdddsss2222iiiO",
      "O2222222222ii2iiiO",
      "OOOOOOOOOOOOOOOOOO",
    ],
    /* Tier >=1; 150x4; anchor: bottom-center (75,4), at (stripDeskCX(),G+3), scale 1.
     * Replaces main-cluster sRug(cx,150): primary rect (cx-75,G-1,150,4).
     * Bottom anchor is G+3, NOT G; otherwise the mat shifts upward by three units.
     * The old fractional hem (G+2.4, height 0.8) is quantized into the bottom row.
     * One cool tile seam; rounded one-pixel corners; render below furniture and shadows. */
    prop_mat: [
      ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.",
      "dDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDnnDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd",
      "dDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDnnDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDd",
      ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd.",
    ],
  },
};
