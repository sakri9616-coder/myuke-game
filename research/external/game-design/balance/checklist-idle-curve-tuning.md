# Checklist — idle/incremental curve tuning (ours, after Pecorella)

Apply to any proposal that changes prices, production, multipliers, or prestige in the DP economy. A proposal that can't fill in these lines isn't ready.

1. **Name every curve.** For each generator line touched (みゅけ's own work, each staff tier, research lines, perks): base cost `b`, growth rate `r` (cost = b · r^owned), base production, multiplier schedule. No unnamed numbers, no "slightly more expensive".
2. **Find the seesaw point.** Where does cost growth overtake income — i.e. how does time-to-next-purchase evolve over a run? Is the wall where the design wants it: milestone multipliers before it, prestige after it?
3. **Check dominance rotation.** Which line yields the most income at hour 1 / day 1 / day 7, before and after the change? If the same line wins at all three horizons, older lines are dead content — stagger milestone multipliers or per-line perks until dominance rotates.
4. **Felt-impact test.** Is the best purchase's effect visible within one session — a production jump the player can see on the strip board? A ratio-optimal but imperceptible upgrade is a non-decision; enlarge it or merge it.
5. **Prestige math, stated.** Prestige gain ∝ earnings^(1/k): write down k. Doubling prestige gain then requires ×2^k run earnings — is that the cadence we want between 引っ越し？ Also state the offline-earnings cap and shape next to it; the two are tuned together, never separately.
6. **Bulk honesty.** If the UI offers ×10 / max buying, prices come from the closed-form bulk formula, not a loop approximation.
