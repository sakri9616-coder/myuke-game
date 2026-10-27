/* Visible systems second art order. Literal pixel maps; . = transparent.
 * Art only: no runtime drawing or character assets. Existing palette only.
 */
window.MIYUKE_ENV_SPRITES_VIS2 = {
  palette: {
  "/": "#AC67CD",
  ";": "#C083DD",
  "A": "#F49A45",
  "B": "#71BED3",
  "D": "#718293",
  "G": "#85CA91",
  "H": "#C53333",
  "L": "#C1C8CB",
  "O": "#604B40",
  "R": "#E66B52",
  "S": "#C7DCF3",
  "T": "#C99A66",
  "W": "#FFF5E6",
  "Y": "#FFDA64",
  "Z": "#F1BF41",
  "]": "#74A571",
  "b": "#408599",
  "d": "#465464",
  "f": "#EC8952",
  "g": "#437660",
  "h": "#F8CF69",
  "j": "#132538",
  "m": "#578BC5",
  "p": "#D66D87",
  "s": "#E9EFFF",
  "t": "#996D49",
  "u": "#2F3444",
  "w": "#DFCDB7",
  "y": "#C99A42",
  "ぅ": "#4F87C0",
  "さ": "#975037"
},
  sprites: {
    /* 24x24; anchor: top-left (0,0); slice k=6; Dark wood planning board with cream paper and one bright top rim stripe. */
    ui_board_9: [
          ".OOOOOOOOOOOOOOOOOOOOOO.",
          "OTTTTTTTTTTTTTTTTTTTTTTO",
          "OTttttttttttttttttttttTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWWWWWWWWWtTO",
          "OTttttttttttttttttttttTO",
          "OTTTTTTTTTTTTTTTTTTTTTTO",
          ".OOOOOOOOOOOOOOOOOOOOOO."
    ],
    /* 12x12; anchor: top-left (0,0); slice k=4; Gold overlay rim; transparent center. */
    ui_board_glow_9: [
          "..yyyyyyyy..",
          ".yYYYYYYYYy.",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          ".yYYYYYYYYy.",
          "..yyyyyyyy.."
    ],
    /* 6x14; anchor: top-left (0,0); slice k=3 top / 4 bottom; Wood support with a small splayed floor foot. */
    ui_board_post_3v: [
          "..OO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          "..TO..",
          ".OTTO.",
          ".OTTO.",
          "OTTTTO",
          "OOOOOO"
    ],
    /* 12x9; anchor: top-left (0,0); slice k=3; Brown rim around a dark green-slate progress groove. */
    ui_bar_track_3: [
          ".OOOOOOOOOO.",
          "OttttttttttO",
          "OjjjjjjjjjjO",
          "OjjjjjjjjjjO",
          "OjjjjjjjjjjO",
          "OjjjjjjjjjjO",
          "OjjjjjjjjjjO",
          "OjjjjjjjjjjO",
          ".OOOOOOOOOO."
    ],
    /* 6x8; anchor: top-left (0,0); slice k=2; Progress fill green; shared silhouette and bright upper stripe. */
    ui_bar_fill_green_3: [
          "GGGGGG",
          "]]]]]]",
          "]]]]]]",
          "]]]]]]",
          "]]]]]]",
          "]]]]]]",
          "]]]]]]",
          "]]]]]]"
    ],
    /* 6x8; anchor: top-left (0,0); slice k=2; Progress fill yellow; shared silhouette and bright upper stripe. */
    ui_bar_fill_yellow_3: [
          "YYYYYY",
          "yyyyyy",
          "yyyyyy",
          "yyyyyy",
          "yyyyyy",
          "yyyyyy",
          "yyyyyy",
          "yyyyyy"
    ],
    /* 6x8; anchor: top-left (0,0); slice k=2; Progress fill red; shared silhouette and bright upper stripe. */
    ui_bar_fill_red_3: [
          "RRRRRR",
          "HHHHHH",
          "HHHHHH",
          "HHHHHH",
          "HHHHHH",
          "HHHHHH",
          "HHHHHH",
          "HHHHHH"
    ],
    /* 2x8; anchor: top-left (0,0); Cream milestone line. */
    ui_bar_tick: [
          "WW",
          "WW",
          "WW",
          "WW",
          "WW",
          "WW",
          "WW",
          "WW"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 0. */
    icon_project_0: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OfffOOO...",
          "..OffffffO..",
          "..OffffffO..",
          "..OffffffO..",
          "..OffffffO..",
          "..OffffffO..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 1. */
    icon_project_1: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..O]]]OOO...",
          "..O]]]]]]O..",
          "..O]]]]]]O..",
          "..O]]]]]]O..",
          "..O]]]]]]O..",
          "..O]]]]]]O..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 2. */
    icon_project_2: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OぅぅぅOOO...",
          "..OぅぅぅぅぅぅO..",
          "..OぅぅぅぅぅぅO..",
          "..OぅぅぅぅぅぅO..",
          "..OぅぅぅぅぅぅO..",
          "..OぅぅぅぅぅぅO..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 3. */
    icon_project_3: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OpppOOO...",
          "..OppppppO..",
          "..OppppppO..",
          "..OppppppO..",
          "..OppppppO..",
          "..OppppppO..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 4. */
    icon_project_4: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..O///OOO...",
          "..O//////O..",
          "..O//////O..",
          "..O//////O..",
          "..O//////O..",
          "..O//////O..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 5. */
    icon_project_5: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OZZZOOO...",
          "..OZZZZZZO..",
          "..OZZZZZZO..",
          "..OZZZZZZO..",
          "..OZZZZZZO..",
          "..OZZZZZZO..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 6. */
    icon_project_6: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OmmmOOO...",
          "..OmmmmmmO..",
          "..OmmmmmmO..",
          "..OmmmmmmO..",
          "..OmmmmmmO..",
          "..OmmmmmmO..",
          "...OOOOOO...",
          "............"
    ],
    /* 12x12; anchor: bottom-center (6,12); Small project folder; color set 7. */
    icon_project_7: [
          "............",
          "............",
          "............",
          "...OOO......",
          "..OさささOOO...",
          "..OささささささO..",
          "..OささささささO..",
          "..OささささささO..",
          "..OささささささO..",
          "..OささささささO..",
          "...OOOOOO...",
          "............"
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 0. */
    ui_pill_0_9: [
          ".OOOOOOOO.",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 1. */
    ui_pill_1_9: [
          ".OOOOOOOO.",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 2. */
    ui_pill_2_9: [
          ".OOOOOOOO.",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 3. */
    ui_pill_3_9: [
          ".OOOOOOOO.",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 4. */
    ui_pill_4_9: [
          ".OOOOOOOO.",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          "O////////O",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 5. */
    ui_pill_5_9: [
          ".OOOOOOOO.",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 6. */
    ui_pill_6_9: [
          ".OOOOOOOO.",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          ".OOOOOOOO."
    ],
    /* 10x12; anchor: top-left (0,0); slice k=3; Rounded genre label; color set 7. */
    ui_pill_7_9: [
          ".OOOOOOOO.",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          ".OOOOOOOO."
    ],
    /* 11x11; anchor: bottom-center (5.5,11); Red warning triangle with cream exclamation pictogram. */
    icon_warn_plate: [
          "...........",
          "...........",
          ".....O.....",
          "....OHO....",
          "....OWO....",
          "...OHWHO...",
          "...OHWHO...",
          "..OHHHHHO..",
          "..OHHWHHO..",
          "..OOOOOOO..",
          "..........."
    ],
    /* 12x12; anchor: top-left (0,0); slice k=3; Wood-rim cream shoulder tab for rank or focus. */
    ui_tab_9: [
          ".OOOOOOOOOO.",
          "OTTTTTTTTTTO",
          "OTttttttttTO",
          "OTtWWWWWWtTO",
          "OTtWWWWWWtTO",
          "OTtWWWWWWtTO",
          "OTtWWWWWWtTO",
          "OTtWWWWWWtTO",
          "OTtWWWWWWtTO",
          "OTttttttttTO",
          "OTTTTTTTTTTO",
          ".OOOOOOOOOO."
    ],
    /* 12x12; anchor: top-left (0,0); slice k=3; Gold-rim coin tab with gold face; same rim geometry. */
    ui_tab_gold_9: [
          ".OOOOOOOOOO.",
          "OyyyyyyyyyyO",
          "OyYYYYYYYYyO",
          "OyYhhhhhhYyO",
          "OyYhhhhhhYyO",
          "OyYhhhhhhYyO",
          "OyYhhhhhhYyO",
          "OyYhhhhhhYyO",
          "OyYhhhhhhYyO",
          "OyYYYYYYYYyO",
          "OyyyyyyyyyyO",
          ".OOOOOOOOOO."
    ],
    /* 8x5; anchor: top-left (0,0); slice k=2; Small focus groove. */
    ui_meter_track_3: [
          ".OOOOOO.",
          "OttttttO",
          "OjjjjjjO",
          "OjjjjjjO",
          ".OOOOOO."
    ],
    /* 4x3; anchor: top-left (0,0); slice k=1; Pale blue focus fill. */
    ui_meter_fill_3: [
          "SSSS",
          "BBBB",
          "BBBB"
    ],
    /* 16x16; anchor: top-left (0,0); slice k=4; Hanging wood-rim cream memo. */
    ui_memo_9: [
          ".OOOOOOOOOOOOOO.",
          "OTTTTTTTTTTTTTTO",
          "OTttttttttttttTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTtWWWWWWWWWWtTO",
          "OTttttttttttttTO",
          "OTTTTTTTTTTTTTTO",
          ".OOOOOOOOOOOOOO."
    ],
    /* 16x16; anchor: top-left (0,0); slice k=4; Hanging gold-rim pale gold memo. */
    ui_memo_gold_9: [
          ".OOOOOOOOOOOOOO.",
          "OyyyyyyyyyyyyyyO",
          "OyYYYYYYYYYYYYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYhhhhhhhhhhYyO",
          "OyYYYYYYYYYYYYyO",
          "OyyyyyyyyyyyyyyO",
          ".OOOOOOOOOOOOOO."
    ],
    /* 4x4; anchor: bottom-center (2,4); Red pushpin; tiny canvas has no margins. */
    icon_pin: [
          ".RR.",
          "RHRH",
          ".OH.",
          ".O.."
    ],
    /* 2x4; anchor: bottom-center (1,4); Wood-brown hanging cord; tiny canvas has no margins. */
    icon_cord: [
          "Ot",
          "Ot",
          "Ot",
          "Ot"
    ],
    /* 8x11; anchor: top-left (0,0); slice k=3; Module chip todo; identical shape across three states. */
    ui_chip_todo_9: [
          ".uuuuuu.",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          "uddddddu",
          ".uuuuuu."
    ],
    /* 8x11; anchor: top-left (0,0); slice k=3; Module chip done; identical shape across three states. */
    ui_chip_done_9: [
          ".uuuuuu.",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          "uggggggu",
          ".uuuuuu."
    ],
    /* 8x11; anchor: top-left (0,0); slice k=3; Module chip alert; identical shape across three states. */
    ui_chip_alert_9: [
          ".uuuuuu.",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          "uHHHHHHu",
          ".uuuuuu."
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 0. */
    icon_project_mini_0: [
          "OOO..",
          "OffOO",
          "OfffO",
          "OfffO",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 1. */
    icon_project_mini_1: [
          "OOO..",
          "O]]OO",
          "O]]]O",
          "O]]]O",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 2. */
    icon_project_mini_2: [
          "OOO..",
          "OぅぅOO",
          "OぅぅぅO",
          "OぅぅぅO",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 3. */
    icon_project_mini_3: [
          "OOO..",
          "OppOO",
          "OpppO",
          "OpppO",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 4. */
    icon_project_mini_4: [
          "OOO..",
          "O//OO",
          "O///O",
          "O///O",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 5. */
    icon_project_mini_5: [
          "OOO..",
          "OZZOO",
          "OZZZO",
          "OZZZO",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 6. */
    icon_project_mini_6: [
          "OOO..",
          "OmmOO",
          "OmmmO",
          "OmmmO",
          "OOOOO"
    ],
    /* 5x5; anchor: top-left (0,0); Miniature project folder; color set 7. */
    icon_project_mini_7: [
          "OOO..",
          "OささOO",
          "OさささO",
          "OさささO",
          "OOOOO"
    ],
    /* 6x3; anchor: top-left (0,0); slice k=2; Tiny monitor progress groove. */
    ui_minibar_track_3: [
          "OjjjjO",
          "OjjjjO",
          "OOOOOO"
    ],
    /* 4x3; anchor: top-left (0,0); slice k=1; Tiny green progress fill. */
    ui_minibar_fill_3: [
          "GGGG",
          "]]]]",
          "]]]]"
    ],
    /* 4x3; anchor: top-left (0,0); slice k=1; Tiny yellow planning fill. */
    ui_minibar_fill_yellow_3: [
          "YYYY",
          "yyyy",
          "yyyy"
    ],
    /* 1x3; anchor: top-left (0,0); Tiny cream milestone. */
    ui_minibar_tick: [
          "W",
          "W",
          "W"
    ],
    /* 10x2; anchor: top-left (0,0); Dim green commit dot and short log stroke. */
    screen_gitlog_0: [
          "gg..gggg..",
          "gg........"
    ],
    /* 14x2; anchor: top-left (0,0); Dim green commit dot and short log stroke. */
    screen_gitlog_1: [
          "gg..gggggggg..",
          "gg............"
    ],
    /* 18x2; anchor: top-left (0,0); Dim green commit dot and short log stroke. */
    screen_gitlog_2: [
          "gg..gggggggggggg..",
          "gg................"
    ],
    /* 22x2; anchor: top-left (0,0); Dim green commit dot and short log stroke. */
    screen_gitlog_3: [
          "gg..gggggggggggggggg..",
          "gg...................."
    ],
    /* 18x2; anchor: top-left (0,0); Bright green latest commit dot and orange end marker. */
    screen_gitlog_new: [
          "GG..gggggggggggAA.",
          "GG................"
    ],
    /* 72x28; anchor: bottom-center (36,28); Small wood desk, three technical books at left and an open book at center. */
    prop_research_desk: [
          "........................................................................",
          "........................................................................",
          "........................................................................",
          "........uuuuuuuuuuuuuu..................................................",
          "........uBBBBBBBBBBBBu..................................................",
          "........uWWWWWWWWWWWWu..................................................",
          "........ubbbbbbbbbbbbu..................................................",
          ".......uuuuuuuuuuuuuuuu........OOOOOOOO..OOOOOOOO.......................",
          ".......uLLLLLLLLLLLLLLu.......OWWWWWWWWOOwwwwwwwwO......................",
          ".......uWWWWWWWWWWWWWWu.......OWWWWWWWWOOwwwwwwwwO......................",
          ".......uddddddddddddddu.......OWWDDWWWWOOwwDDwwwwO......................",
          "........uuuuuuuuuuuuuuuu......OWWWWWWWWOOwwwwwwwwO......................",
          "........uGGGGGGGGGGGGGGu......OWWDDDDWWOOwwDDDDwwO......................",
          "........uWWWWWWWWWWWWWWu......OWWWWWWWWOOwwwwwwwwO......................",
          "........uggggggggggggggu......OWWWWWWWWOOwwwwwwwwO......................",
          "........uuuuuuuuuuuuuuuu.......OOOOOOOOOOOOOOOOOO.......................",
          "...OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...",
          "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..",
          "..tttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt..",
          "...OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTOttttttttttttttttttttttttttttttttttttttttttttttttttttOTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OOOO....................................................OOOO......"
    ],
    /* 72x28; anchor: bottom-center (36,28); Same research desk; brighter open pages and one purple book glint. */
    prop_research_desk_on: [
          "........................................................................",
          "........................................................................",
          "........................................................................",
          "........uuuuuuuuuuuuuu..................................................",
          "........uBBBBBBBBBBBBu..................................................",
          "........uWWWWWWWWWWWWu..................................................",
          "........ubbbbbbbbbbbbu..................................................",
          ".......uuuuuuuuuuuuuuuu........OOOOOOOO..OOOOOOOO.......................",
          ".......uLLLLLLLLLLLLLLu.......OssssssssOOssssssssO......................",
          ".......uWWWWWWWWWWWWWWu.......OssssssssOOsssss;ssO......................",
          ".......uddddddddddddddu.......OssDDssssOOssDDssssO......................",
          "........uuuuuuuuuuuuuuuu......OssssssssOOssssssssO......................",
          "........uGGGGGGGGGGGGGGu......OssDDDDssOOssDDDDssO......................",
          "........uWWWWWWWWWWWWWWu......OssssssssOOssssssssO......................",
          "........uggggggggggggggu......OssssssssOOssssssssO......................",
          "........uuuuuuuuuuuuuuuu.......OOOOOOOOOOOOOOOOOO.......................",
          "...OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...",
          "..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT..",
          "..tttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt..",
          "...OOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO...",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTOttttttttttttttttttttttttttttttttttttttttttttttttttttOTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OTTO....................................................OTTO......",
          "......OOOO....................................................OOOO......"
    ],
    /* 116x3; anchor: top-left (0,0); Wood desktop; exact existing laminate canvas, placement and silhouette. */
    desk_wood_main: [
          "OTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTO",
          "tttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttt",
          "tOOOttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttttOOOt"
    ],
    /* 104x26; anchor: bottom-center (52,26); Low quiet wood fence, spaced pickets and two horizontal rails. */
    prop_fence: [
          "........................................................................................................",
          "........................................................................................................",
          ".....OOO............OOO............OOO............OOO............OOO............OOO............OOO......",
          ".....ttt............ttt............ttt............ttt............ttt............ttt............ttt......",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "...tOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOttttttttttOtttOtt...",
          "....OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO..........OtttO.....",
          "....OOOOO..........OOOOO..........OOOOO..........OOOOO..........OOOOO..........OOOOO..........OOOOO....."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 0. */
    prop_shelf_box_0: [
          ".OOOOOOOO.",
          "OffffffffO",
          "OffffffffO",
          "OfffwwfffO",
          "OfffwwfffO",
          "OffffffffO",
          "OffffffffO",
          "OffffffffO",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 1. */
    prop_shelf_box_1: [
          ".OOOOOOOO.",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]ww]]]O",
          "O]]]ww]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          "O]]]]]]]]O",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 2. */
    prop_shelf_box_2: [
          ".OOOOOOOO.",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅwwぅぅぅO",
          "OぅぅぅwwぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          "OぅぅぅぅぅぅぅぅO",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 3. */
    prop_shelf_box_3: [
          ".OOOOOOOO.",
          "OppppppppO",
          "OppppppppO",
          "OpppwwpppO",
          "OpppwwpppO",
          "OppppppppO",
          "OppppppppO",
          "OppppppppO",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 4. */
    prop_shelf_box_4: [
          ".OOOOOOOO.",
          "O////////O",
          "O////////O",
          "O///ww///O",
          "O///ww///O",
          "O////////O",
          "O////////O",
          "O////////O",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 5. */
    prop_shelf_box_5: [
          ".OOOOOOOO.",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZwwZZZO",
          "OZZZwwZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          "OZZZZZZZZO",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 6. */
    prop_shelf_box_6: [
          ".OOOOOOOO.",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmwwmmmO",
          "OmmmwwmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          "OmmmmmmmmO",
          ".OOOOOOOO."
    ],
    /* 10x9; anchor: top-left (0,0); Small released-project box with cream tape; color set 7. */
    prop_shelf_box_7: [
          ".OOOOOOOO.",
          "OささささささささO",
          "OささささささささO",
          "OさささwwさささO",
          "OさささwwさささO",
          "OささささささささO",
          "OささささささささO",
          "OささささささささO",
          ".OOOOOOOO."
    ],
    /* 12x11; anchor: top-left (0,0); Gold shelf-box outline with a transparent center. */
    fx_shelf_glow: [
          "..yyyyyyyy..",
          ".yYYYYYYYYy.",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          "yY........Yy",
          ".yYYYYYYYYy.",
          "..yyyyyyyy.."
    ],
    /* 24x12; anchor: bottom-center (12,12); Stepped wood award pedestal; existing award mounts above. */
    prop_trophy_stand: [
          "........................",
          "........................",
          "...OOOOOOOOOOOOOOOOOO...",
          "..OTTTTTTTTTTTTTTTTTTO..",
          "..OttttttttttttttttttO..",
          "...OOOOOOOOOOOOOOOOOO...",
          "....OTTTTTTTTTTTTTTO....",
          "....OttttttttttttttO....",
          "....OTTTTTTTTTTTTTTO....",
          "....OttttttttttttttO....",
          "...OTTTTTTTTTTTTTTTTO...",
          "..OOOOOOOOOOOOOOOOOOOO.."
    ],
    /* 22x28; anchor: bottom-center (11,28); A-shaped wood easel legs and two crossbars; existing poster rests above. */
    prop_easel: [
          "......................",
          "......................",
          ".........OOOO.........",
          ".........OOOO.........",
          ".........OOOO.........",
          ".........OOOO.........",
          "........OT..tO........",
          "........OT..tO........",
          "........OT..tO........",
          "........OT..tO........",
          ".......OT....tO.......",
          ".......OT....tO.......",
          ".......OT....tO.......",
          ".......OT....tO.......",
          "......OT......tO......",
          "......OT......tO......",
          "......OT......tO......",
          "....TTTTTTTTTTTTTT....",
          "....OOOOOOOOOOOOOO....",
          "....OOOOOOOOOOOOOO....",
          ".....OT........tO.....",
          ".....OT........tO.....",
          "....OT..........tO....",
          "....OT.tttttttt.tO....",
          "....OT.tttttttt.tO....",
          "....OT..........tO....",
          "...OT............tO...",
          "...OT............tO..."
    ],
    /* 12x5; anchor: top-left (0,0); slice k=4; Single dark-brown stepped oval shadow; game supplies opacity. */
    fx_shadow_3: [
          "....OOOO....",
          "..OOOOOOOO..",
          "OOOOOOOOOOOO",
          "..OOOOOOOO..",
          "....OOOO...."
    ],
    /* 16x5; anchor: top-left (0,0); slice k=4; Single warm wood-brown rug with stepped ends and small fringe tips. */
    prop_rug_3: [
          "...tttttttttt...",
          ".tttttttttttttt.",
          "tttttttttttttttt",
          ".tttttttttttttt.",
          "...tttttttttt..."
    ],
    /* 15x44; anchor: bottom-center (7.5,44); Empty wood-and-brass tube; cream window x3..11, y3..40 inclusive. */
    prop_fever_gauge: [
          "...............",
          "...............",
          "..yyyyyyyyyyy..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..OWWWWWWWWWO..",
          "..yyyyyyyyyyy..",
          "..OTTTTTTTTTO..",
          "..OOOOOOOOOOO.."
    ],
    /* 9x6; anchor: top-left (0,0); slice k=2; Vertical gauge blue; same shape with a bright surface stripe. */
    ui_gauge_fill_blue_3v: [
          "BBBBBBBBB",
          "ぅぅぅぅぅぅぅぅぅ",
          "ぅぅぅぅぅぅぅぅぅ",
          "ぅぅぅぅぅぅぅぅぅ",
          "ぅぅぅぅぅぅぅぅぅ",
          "ぅぅぅぅぅぅぅぅぅ"
    ],
    /* 9x6; anchor: top-left (0,0); slice k=2; Vertical gauge gold; same shape with a bright surface stripe. */
    ui_gauge_fill_gold_3v: [
          "YYYYYYYYY",
          "yyyyyyyyy",
          "yyyyyyyyy",
          "yyyyyyyyy",
          "yyyyyyyyy",
          "yyyyyyyyy"
    ],
    /* 9x6; anchor: top-left (0,0); slice k=2; Vertical gauge red; same shape with a bright surface stripe. */
    ui_gauge_fill_red_3v: [
          "RRRRRRRRR",
          "HHHHHHHHH",
          "HHHHHHHHH",
          "HHHHHHHHH",
          "HHHHHHHHH",
          "HHHHHHHHH"
    ],
    /* 8x10; anchor: bottom-center (4,10); Compact gold lightning signal. */
    icon_bolt: [
          "........",
          "........",
          "....YY..",
          "...YY...",
          "..YYY...",
          "..YYYY..",
          "....YY..",
          "...YY...",
          "..YY....",
          "..Y....."
    ],
    /* 11x11; anchor: bottom-center (5.5,11); Gold shelf star ornament on a tiny stand; twinkle frame 0. */
    prop_star_deco_0: [
          "...........",
          "...........",
          ".....O.....",
          ".....YO....",
          "....OYYO...",
          "..OYYYYYO..",
          "...OYYYO...",
          "...OY.YO...",
          "..OO...OO..",
          ".....O.....",
          "....OOO...."
    ],
    /* 11x11; anchor: bottom-center (5.5,11); Same star canvas and stand; twinkle frame 1 changes two highlights. */
    prop_star_deco_1: [
          "...........",
          "...........",
          ".....O.....",
          ".....YO....",
          "....OWYO...",
          "..OYYYYYO..",
          "...OYYWO...",
          "...OY.YO...",
          "..OO...OO..",
          ".....O.....",
          "....OOO...."
    ],
    /* 6x8; anchor: bottom-center (3,8); Tiny red update ribbon with forked end; only two drawable columns. */
    icon_update_ribbon: [
          "......",
          "......",
          "..RR..",
          "..RR..",
          "..HH..",
          "..RR..",
          "..RR..",
          "..R..."
    ],
    /* 7x7; anchor: bottom-center (3.5,7); Gold hire badge with dark exclamation; tiny canvas has no margins. */
    icon_badge_hire: [
          "..yyy..",
          ".yYYYy.",
          "yYYOYYy",
          "yYYOYYy",
          "yYYYYYy",
          ".yYOYy.",
          "..yyy.."
    ],
    /* 9x11; anchor: bottom-center (4.5,11); Cream request paper, red header and two slate lines. */
    icon_memo: [
          ".........",
          ".........",
          "..OOOOO..",
          "..ORRRO..",
          "..OWWWO..",
          "..ODDWO..",
          "..OWWWO..",
          "..ODDWO..",
          "..OWWWO..",
          "..OWWWO..",
          "..OOOOO.."
    ],
  },
};
