/* Handwork art order: hand-authored literal pixel maps; . = transparent.
 * Offline previews only; all characters and colors reuse graphics/sprites.js.
 */
window.MIYUKE_ENV_SPRITES_HANDWORK = {
  palette: {
    O: '#604B40', W: '#FFF5E6', A: '#F49A45', F: '#463126',
    P: '#F49CAC', H: '#C53333', R: '#E66B52', s: '#E9EFFF',
    T: '#C99A66', t: '#996D49', Y: '#FFDA64',
    '£': '#39261D', '¥': '#856551', 'µ': '#9D9C92', '®': '#543628'
  },
  sprites: {
    /* 18x16; anchor: bottom-centre (9,16); calico paw raises a red stamp above the QA card. */
    fx_handwork_test_0: [
      '..................',
      '..OOOO............',
      '..OAAWO...........',
      '..OAAWWOO.........',
      '..OFWWWWWO........',
      '...OFWPWWO........',
      '....OWPWWO........',
      '.....OOOOWO.......',
      '.......OHO........',
      '......OHRHO.......',
      '......OOOOO.......',
      '..................',
      '..................',
      '....OOOOOOOOOO....',
      '....OssssssssO....',
      '....OOOOOOOOOO....'
    ],
    /* 18x16; anchor: bottom-centre (9,16); same paw presses the stamp onto the fixed QA card, two impact strokes. */
    fx_handwork_test_1: [
      '..................',
      '..OOOO............',
      '..OAAWO...........',
      '..OAAWO...........',
      '..OFWWO...........',
      '..OFWWWO..........',
      '...OWWWWO.........',
      '...OWPWWWO........',
      '....OWPWWO........',
      '.....OOOOWO.......',
      '.......OHO........',
      '......OHRHO.......',
      '....Y.OOOOO.Y.....',
      '...YOOOOOOOOOOY...',
      '....OsssHHsssO....',
      '....OOOOOOOOOO....'
    ],
    /* 18x16; anchor: bottom-centre (9,16); calico paw lifts a small wooden mallet over a fixed card bundle. */
    fx_handwork_build_0: [
      '........OOOOOOO...',
      '........OTTTTTO...',
      '........OtttttO...',
      '........OOOOOOO...',
      '..OOOO....OtO.....',
      '..OAAWO..OtO......',
      '..OAAWWOOtO.......',
      '..OFWWWWWO........',
      '...OFWPWWO........',
      '....OWPWWO........',
      '.....OOOO.........',
      '..................',
      '....OOOOOOOOOO....',
      '....OssssssssO....',
      '....OOOOOOOOOO....',
      '....OOOOOOOOOO....'
    ],
    /* 18x16; anchor: bottom-centre (9,16); same paw swings the mallet down onto the fixed bundle, two impact strokes. */
    fx_handwork_build_1: [
      '..................',
      '..................',
      '..................',
      '..................',
      '..OOOO............',
      '..OAAWO...........',
      '..OAAWWOO.........',
      '..OFWWWWWO........',
      '...OFWPWWOOOOOO...',
      '....OWPWWOTTTTO...',
      '.....OOOtOttttO...',
      '....Y.....OOOOO.Y.',
      '...YOOOOOOOOOO...Y',
      '....OssssssssO....',
      '....OOOOOOOOOO....',
      '....OOOOOOOOOO....'
    ],
    /* 18x16; anchor: bottom-centre (9,16); calico paw braces to push a tiny icon_box-colored parcel right. */
    fx_handwork_ship_0: [
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '.OOOO.............',
      '.OAAWOOO..........',
      '.OAAWWWWO..££££££.',
      '.OFWWWPPWO£¥µ¥¥¥¥£',
      '..OFWWPPWO£¥µ¥¥¥®£',
      '...OWWWWOO£¥¥¥¥¥®£',
      '....OOOO..£¥¥¥¥¥®£',
      '..........£¥¥¥¥¥®£',
      '..........£®®®®®®£',
      '..........££££££££'
    ],
    /* 18x16; anchor: bottom-centre (9,16); same paw extends into the parcel, dust behind; parcel contact stays grounded. */
    fx_handwork_ship_1: [
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '..................',
      '.OOOO.............',
      '.OAAWOOOO.........',
      '.OAAWWWWWO..£££££.',
      '.OFWWWWWPPW£¥µ¥¥¥£',
      '..OFWWWWPPW£¥µ¥¥®£',
      '...OWWWWWOO£¥¥¥¥®£',
      '....OOOOO..£¥¥¥¥®£',
      '..W.......£¥¥¥¥¥®£',
      '.WWW.W....£®®®®®®£',
      '..........££££££££'
    ],
    /* 10x10; anchor: bottom-centre (5,10); small downward-pointing calico paw with pink pads, upper hover pose. */
    icon_tap_0: [
      '..........',
      '...OOOO...',
      '...OAAO...',
      '..OFWWWO..',
      '.OFWPWWWO.',
      '.OWPPPWPO.',
      '.OWWPWWWO.',
      '..OWOWOO..',
      '...OOO....',
      '..........'
    ],
    /* 10x10; anchor: bottom-centre (5,10); identical pad-facing paw translated down exactly 1px, lower hover pose. */
    icon_tap_1: [
      '..........',
      '..........',
      '...OOOO...',
      '...OAAO...',
      '..OFWWWO..',
      '.OFWPWWWO.',
      '.OWPPPWPO.',
      '.OWWPWWWO.',
      '..OWOWOO..',
      '...OOO....'
    ]
  }
};
