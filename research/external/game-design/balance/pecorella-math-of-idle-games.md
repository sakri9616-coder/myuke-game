# The Math of Idle Games, Parts I–III — Anthony Pecorella (Kongregate)

- Type: LINK ONLY card (articles © the author / Kongregate / Game Developer; no republication license).
- Sources (all three parts, originally the Kongregate developer blog, 2016; mirrored on Game Developer):
  - Part I: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i
  - Part II: http://blog.kongregate.com/the-math-of-idle-games-part-ii/ (derivative-based growth: generators that produce other generators)
  - Part III: https://www.gamedeveloper.com/design/the-math-of-idle-games-part-iii
- Author: Anthony Pecorella (Kongregate; lead producer on the mobile AdVenture Capitalist). The articles ship with the actual spreadsheet models used for the charts — model first, tune second.

## The reasoning method, distilled

- **Vocabulary first.** Primary currency (the number that goes up), generators (things that produce it, income = currency/sec), primary *exchange* currency (an intermediate that converts into the primary at a controllable rate — an extra tuning lever), multipliers (anything that multiplies generator power), prestige (reset for persistent acceleration).
- **The seesaw.** Costs grow geometrically — `cost_next = cost_base × rate^owned` — while production grows roughly linearly in units owned, times multipliers. An exponential always eventually outruns any polynomial, so every run has a natural wall. Balancing is choosing *where* the wall sits and what relieves it (milestone multipliers, prestige), not whether it exists.
- **Milestone multipliers pace the mid-game.** A stacking ×2 at 25/50/100 owned repeatedly bumps production back toward costs and creates purchase spikes the player can feel and plan around.
- **Rotate dominance, or older generators die.** If the newest generator is always the best income source once affordable, earlier ones become dead choices. Staggering per-generator multiplier schedules makes different lines take turns being the priority, so the player keeps re-reading the board.
- **Felt impact beats ratio-optimality.** A purchase can be mathematically optimal yet worthless as a decision if its effect is too small to perceive. Players buy in bulk and by feel; design for the decision they can actually sense.
- **Closed forms for bulk buying.** Bulk cost `b · r^k (r^n − 1)/(r − 1)` and the max-affordable formula let the UI offer honest "buy max" without simulation loops.
- **Prestige is a fractional exponent.** In the shipped games surveyed in Part III, prestige gain scales as a root of run earnings (square root in Realm Grinder, cube root in Cookie Clicker, ~1/7 power in Egg, Inc.). The root *is* the cadence dial: with a square root, doubling prestige gain requires ~4× the earnings; with a cube root, ~8×.
- **Offline earnings are a pacing decision, not a gift.** Cap length and shape (flat rate vs. staircase of sub-prestiges, as in Egg, Inc.) trade "come back often" against "long absence still feels rewarded" — pick deliberately per game.

## For みゅけ

This is the closest published reasoning to our exact genre math: staff and research lines are generators, DP is the primary currency, 引っ越し is prestige. Any change to hire costs, research prices, or prestige rewards should be expressible in this vocabulary before it is proposed (see `checklist-idle-curve-tuning.md` and `checklist-balance-proposal-gate.md`).
