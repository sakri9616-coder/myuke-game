# Checklist — transitive / intransitive option audit (ours, after Schreiber)

Apply to any new purchasable (staff tier, research node, 星屑 perk) or any new qualitative fork (research paths, staff mixes).

1. **One-curve test (transitive options).** Place the new option and all its peers on a single cost/benefit curve. Write the exchange rate being assumed (e.g. "1 staff level ≈ X DP/min at this stage"). If it can't be placed on the curve, the pricing basis is unclear — stop and find it.
2. **Dominance scan.** Is the new option strictly worse than a peer at similar cost in every situation (dead option) or strictly better in every situation (dominant strategy)? Both are bugs; reprice or redesign before shipping.
3. **Name the counter.** Write one concrete situation where a reasonable player should NOT buy it. If none exists, it has no counter and will become the only strategy.
4. **Cycle check (qualitative forks).** For path/mix choices, sketch the payoff cycle: A beats B when …, B beats C when …, C beats A when …. If the cycle is empty, the fork is a disguised linear ladder — price it as a ladder and drop the pretense of choice.
5. **Math vs. perception.** State whether the change targets the actual math, the player's *perception* of fairness/value (see `2dgd-perceived-fairness.md`), or both. Perception-only problems get presentation fixes, not number changes.
