/* Bug swarm art order: hand-authored literal pixel maps; . = transparent.
 * Preview renderer is offline only. Existing global palette, zero new colors.
 */
window.MIYUKE_ENV_SPRITES_BUGS = {
  palette: {
    z: '#211711', K: '#45414A', R: '#E66B52',
    d: '#465464', B: '#71BED3', S: '#C7DCF3',
    s: '#E9EFFF', W: '#FFF5E6', Y: '#FFDA64'
  },
  sprites: {
    /* 14x10; anchor: bottom-centre (7,10); right-facing crawler, two antennae and three leg pairs, step 0. */
    icon_bug_s_0: [
      '..............',
      '.........z.z..',
      '...zzzz..zz...',
      '..zRRRRzzKKz..',
      '.zRRRRRzKKKKz.',
      '.zRRRRRzKKKKz.',
      '..zzzzzzzzzz..',
      '...z..z..z....',
      '..zz.zz.zz....',
      '.z..z..z......'
    ],
    /* 14x10; anchor: bottom-centre (7,10); same crawler, alternating near/far legs, step 1. */
    icon_bug_s_1: [
      '..............',
      '.........z.z..',
      '...zzzz..zz...',
      '..zRRRRzzKKz..',
      '.zRRRRRzKKKKz.',
      '.zRRRRRzKKKKz.',
      '..zzzzzzzzzz..',
      '...z..z..z....',
      '..zz..zz..zz..',
      '.z...z..z.....'
    ],
    /* 26x13; anchor: bottom-centre (13,13); six small red beetles in two close rows, shuffle 0. */
    icon_bug_swarm_s_0: [
      '..........................',
      '.....z.z.....z.z.....z.z..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.zRRRzKKzzRRRzKKzzRRRzKKz.',
      '..zRRzKz..zRRzKz..zRRzKz..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.z.z.z...z.z.z...z.z.z....',
      '.....z.z.....z.z.....z.z..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.zRRRzKKzzRRRzKKzzRRRzKKz.',
      '..zRRzKz..zRRzKz..zRRzKz..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.z.z.z...z.z.z...z.z.z....'
    ],
    /* 26x13; anchor: bottom-centre (13,13); same six beetles, moving interior seams and alternating feet, shuffle 1. */
    icon_bug_swarm_s_1: [
      '..........................',
      '.....z.z.....z.z.....z.z..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.zRRzKKKzzRRRzKKzzRRzKKKz.',
      '..zRzKKz..zRRzKz..zRzKKz..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.z..z.z..z..z.z..z..z.z...',
      '.....z.z.....z.z.....z.z..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.zRRRzKKzzRRzKKKzzRRRzKKz.',
      '..zRRzKz..zRzKKz..zRRzKz..',
      '..zzzzzz..zzzzzz..zzzzzz..',
      '.z..z.z..z..z.z..z..z.z...'
    ],
    /* 44x20; anchor: bottom-centre (22,20); seventeen overlapping beetles, mound rows 3+4+5+5, shuffle 0. */
    icon_bug_swarm_l_0: [
      '............................................',
      '..............z.z.....z.z.....z.z...........',
      '...........zzzzzz..zzzzzz..zzzzzz...........',
      '..........zRRRzKKzzRRRzKKzzRRRzKKz..........',
      '...........zRRzKz..zRRzKz..zRRzKz...........',
      '..........z.z.....z.z.....z.z.....z.z.......',
      '.......zzzzzz..zzzzzz..zzzzzz..zzzzzz.......',
      '......zRRRzKKzzRRRzKKzzRRRzKKzzRRRzKKz......',
      '.......zRRzKz..zRRzKz..zRRzKz..zRRzKz.......',
      '......z.z.....z.z.....z.z.....z.z.....z.z...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..zRRRzKKzzRRRzKKzzRRRzKKzzRRRzKKzzRRRzKKz..',
      '...zRRzKz..zRRzKz..zRRzKz..zRRzKz..zRRzKz...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '......z.z.....z.z.....z.z.....z.z.....z.z...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..zRRRzKKzzRRRzKKzzRRRzKKzzRRRzKKzzRRRzKKz..',
      '...zRRzKz..zRRzKz..zRRzKz..zRRzKz..zRRzKz...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..z.z.z...z.z.z...z.z.z...z.z.z...z.z.z.....'
    ],
    /* 44x20; anchor: bottom-centre (22,20); same seventeen-beetle mound, inner bodies wriggle and feet alternate, shuffle 1. */
    icon_bug_swarm_l_1: [
      '............................................',
      '..............z.z.....z.z.....z.z...........',
      '...........zzzzzz..zzzzzz..zzzzzz...........',
      '..........zRRzKKKzzRRRzKKzzRRzKKKz..........',
      '...........zRzKKz..zRRzKz..zRzKKz...........',
      '..........z.z.....z.z.....z.z.....z.z.......',
      '.......zzzzzz..zzzzzz..zzzzzz..zzzzzz.......',
      '......zRRRzKKzzRRzKKKzzRRRzKKzzRRzKKKz......',
      '.......zRRzKz..zRzKKz..zRRzKz..zRzKKz.......',
      '......z.z.....z.z.....z.z.....z.z.....z.z...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..zRRzKKKzzRRRzKKzzRRzKKKzzRRRzKKzzRRzKKKz..',
      '...zRzKKz..zRRzKz..zRzKKz..zRRzKz..zRzKKz...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '......z.z.....z.z.....z.z.....z.z.....z.z...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..zRRRzKKzzRRzKKKzzRRRzKKzzRRzKKKzzRRRzKKz..',
      '...zRRzKz..zRzKKz..zRRzKz..zRzKKz..zRRzKz...',
      '...zzzzzz..zzzzzz..zzzzzz..zzzzzz..zzzzzz...',
      '..z..z.z..z..z.z..z..z.z..z..z.z..z..z.z....'
    ],
    /* 12x10; anchor: bottom-centre (6,10); falling cyan adhesive patch with a small white medical plus. */
    fx_patch: [
      '............',
      '..dddddddd..',
      '.dSSSSSSSSd.',
      '.dSBBBBBBSd.',
      '.dSBBWBBBSd.',
      '.dSBWWWBBSd.',
      '.dSBBWBBBSd.',
      '.dSBBBBBBSd.',
      '.dSSSSSSSSd.',
      '..dddddddd..'
    ],
    /* 16x12; anchor: bottom-centre (8,12); rounded pale smoke puff with small cream/yellow sparkle, pop 0. */
    fx_bug_poof_0: [
      '................',
      '............Y...',
      '...SSS.....YWY..',
      '..SsssS.....Y...',
      '..SsssSSSS......',
      '.SssssssssSS....',
      '.SsssssssssS....',
      '..SsssssssssSS..',
      '...SsssssssssSS.',
      '...SSsssssssSS..',
      '.....SSSSSSS....',
      '.......SS.......'
    ],
    /* 16x12; anchor: bottom-centre (8,12); scattered pale smoke fragments, same extent and ground datum, pop 1. */
    fx_bug_poof_1: [
      '................',
      '............s...',
      '..sss........s..',
      '..ss.........s..',
      '......ss........',
      '.ss...s.........',
      '.s.......ss.....',
      '.........ss.....',
      '...ss........ss.',
      '...s.........s..',
      '.......ss.......',
      '.......s........'
    ],
    /* 14x6; anchor: bottom-centre (7,6); flattened red beetle with three splayed leg pairs, brief click impact. */
    fx_bug_splat: [
      '..............',
      '..z..z..z..z..',
      '...zzzzzzzz...',
      '.zzRRRRRRKKzz.',
      '..zzzzzzzzzz..',
      '.zz..zz..zz...'
    ]
  }
};
