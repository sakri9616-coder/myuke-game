# Game Balance Concepts — Ian Schreiber (with Brenda Romero)

- Type: LINK ONLY card (free online course; later expanded into the book *Game Balance*, CRC Press, 2021).
- Source: https://gamebalanceconcepts.wordpress.com/ (the author's earlier general course lives at https://gamedesignconcepts.wordpress.com/)
- Author: Ian Schreiber — game designer/programmer and educator; the course is a long-running, widely used teaching text on *how to reason* about balance rather than a table of numbers.

## The reasoning method, distilled

- **Balance is relationships between options, and relationships come in kinds.**
  - *Transitive* (A > B > C along one dimension): put every option's cost and benefit on a **single cost curve**. If the curve is right, most of the balance follows; use fractional costs when you need finer control than integers allow.
  - *Intransitive* (rock–paper–scissors): options beat each other in a cycle. Reason with payoff matrices and solve for the equilibrium mix instead of asking "which is strongest?"
  - *Chance*: reason in distributions, and remember players systematically misjudge odds (the course uses Monty Hall as the standing humility example) — perceived odds are a design surface too.
- **"Everything needs a counter."** A strategy or purchase with no counter becomes the dominant strategy; a choice that is never right is a dead option. Both are balance bugs, and both are detectable on paper before any playtest.
- **Cost curves are the main tool.** Decide the *shape* of the relationship between what a thing costs and what it does (e.g., linear cost for exponential effect, or the reverse) before picking any individual numbers.
- **Separate "balanced" from "fun", and "fair" means something specific**: roughly, equal resources/skill should give equal chances — asymmetries must be intentional and priced.
- **Playtesting is an instrument, not a vibe.** Give testers specific assignments and questions, change one variable at a time, and record results against the model so the model improves.

## For みゅけ

The transitive/intransitive split maps directly onto our two kinds of choices: staff/research/perk purchases are (mostly) transitive and belong on one DP cost curve; research *paths* and staff mixes should be intransitive — situationally, not globally, better. See `checklist-transitive-intransitive.md`.
