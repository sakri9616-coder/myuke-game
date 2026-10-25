# Machinations & internal-economy modeling — Joris Dormans; Adams & Dormans

- Type: LINK ONLY card (platform is commercial; the underlying framework is published in the book below).
- Sources: platform https://machinations.io/ ; framework book: Ernest W. Adams & Joris Dormans, *Game Mechanics: Advanced Game Design* (New Riders, 2012), whose "internal economy" chapters define the diagram language.
- Authors: Joris Dormans (game designer/researcher; creator of Machinations) and Ernest W. Adams (design consultant/author). The framework is widely taught in game-design programs.

## The reasoning method, distilled

- **Draw the economy before tuning it.** Every resource is a *pool* (a stock). Elements that create resources are *sources*, elements that remove them are *drains/sinks*, *converters* transform one resource into another, *traders* exchange between actors. Flows have rates. If you can't draw it, you don't yet understand your own economy.
- **Find the feedback loops and sign them.** A loop where more of X produces more of X is *positive* (accelerating — needs a cost curve that outgrows it, or it explodes). A loop where more of X suppresses X is *negative* (stabilizing — needs a floor, or it can stall progress to zero).
- **Two failure shapes cover most economy bugs**: *runaway accumulation* (a pool with a source but no real sink inflates until the currency is meaningless) and *starvation* (a sink with no reliable source makes a feature quietly unusable). Audit every pool for both.
- **Simulate the diagram, not just the numbers.** Playing the diagram forward at different activity levels shows which pool breaks first — the same job our `tools/balance-sim.js` does for the DP economy in code.

## For みゅけ

DP, コイン, 星屑， アイデア, and QA/bugs are our pools; staff and production are converters; research and the 星屑 shop are sinks; 引っ越し is a converter with a reset. Economy proposals should attach this diagram (or its delta). See `checklist-economy-structure.md`.
