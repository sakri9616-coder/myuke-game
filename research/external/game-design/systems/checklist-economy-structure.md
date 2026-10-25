# Checklist — economy structure audit (ours, after Dormans / Machinations)

Apply before proposing economy changes, and once per major version as a health check. Works on paper; attach the sketch to the proposal.

1. **Draw it.** List every resource pool (DP, コイン, 星屑, アイデア, bugs/QA stock…). For each pool: every source (with rate), every sink, every converter in/out. A pool you can't complete this for is a pool nobody understands yet.
2. **Sign the loops.** Mark each feedback loop positive (self-accelerating) or negative (self-limiting). Positive loops must name the cost curve that outgrows them; negative loops must name the floor that keeps progress from stalling to zero.
3. **Runaway test.** Which pool has a source but no meaningful sink at some game stage? That currency inflates into meaninglessness there (see the backlog's 星屑 Lv5+ sink question). Name the stage and the fix, or the explicit decision to let it be a pure score.
4. **Starvation test.** Which sink can demand a resource the player cannot reliably produce at that stage? That feature is quietly dead. Name the stage.
5. **Activity stress.** Mentally (or in balance-sim) run the diagram at 0.5× and 2× player activity. Which pool breaks first in each direction? That's where the next tuning proposal should aim.
6. **Visibility.** Can the player see the loop they are inside — board, buffer bars, lamps — or does the economy happen to them invisibly? Invisible economies feel random; give the main loop a diegetic face.
