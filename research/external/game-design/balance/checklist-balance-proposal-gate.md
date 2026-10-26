# Checklist — the balance proposal gate (ours)

A balance or economy proposal in the backlog's 相談リスト is ready for sakuri when it states all of these. This gate merges `schreiber-game-balance-concepts.md`, `pecorella-math-of-idle-games.md`, and `../systems/machinations-economy-modeling.md`.

0. **Phase declaration (sakuri's gameplay gradient, 2026-10-26 — required header).** Which phase does this serve: early = clicker-weighted (clicking is the engine) / mid = automation (income arrives as passive income) / late = management （配分・倍率・売却タイミングの意思決定， never replaceable by clicking speed)? State how the proposal affects the transitions — the click share of income falling and the automation share rising must stay trackable in the sim's production breakdown and in the felt design. A proposal that lets raw speed dominate the late game fails this gate by definition.
1. **Sources & sinks.** Which resource pools does it touch (DP, コイン, 星屑, アイデア, bugs/QA…), and for each: source rate up/down, sink added/removed/changed? (Diagram deltas welcome — see the economy-structure checklist.)
2. **Curves, old → new.** For every changed price or rate: base, growth rate, exponent — before and after. Plus the consequence: how the seesaw point / wall moves.
3. **Time-to-reward targets.** Stated pacing targets before → after (e.g. first release ≤ 5 min passive, next-upgrade wait at day 3 ≈ N min). Numbers, not adjectives.
4. **Dominance & counter.** The transitive/intransitive audit result: what it must not dominate, what its counter is.
5. **Evidence plan.** Which balance-sim gate or playtest observation would confirm the change — and, explicitly, what result would make us revert it. A proposal with no falsifier is a preference, label it as such.
6. **Perception path.** How will the player *feel* this change, and through which strip-visible signal (board, buffer bars, lamp, ceremony)? If they can't feel it, say why it still matters.
