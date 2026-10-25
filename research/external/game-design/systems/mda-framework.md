# MDA framework — Hunicke, LeBlanc & Zubek (2004)

- Type: LINK ONLY card (academic paper; no open republication license).
- Source: "MDA: A Formal Approach to Game Design and Game Research", Proc. AAAI Workshop on Challenges in Game AI, 2004. Accessible presentations of the paper's content:
  - FutureLearn course unit ("Game Design and Development: Video Game Design Principles"): https://www.futurelearn.com/courses/game-design-and-development-challenges-in-video-game-design/game-design-principles-in-video-games/run/content/steps/print
  - Explainer: https://yukaichou.com/gamification-analysis/mda-framework-hunicke-leblanc-zubek-mechanics-dynamics-aesthetics/
- Authors: Robin Hunicke, Marc LeBlanc, Robert Zubek. One of the most cited design frameworks in the field.

## The reasoning method, distilled

- **Three layers.** *Mechanics* = the rules and data (components, actions, control mechanisms). *Dynamics* = the run-time behavior that emerges when mechanics meet player input. *Aesthetics* = the emotional responses evoked in the player.
- **The direction asymmetry is the tool.** The designer can only build mechanics, reasoning forward M → D → A. The player experiences the reverse, A → D → M. Review in *both* directions: start from the feeling you want and ask which player behaviors produce it and which mechanics produce those behaviors; then forward-check what dynamics your mechanics will *actually* create, including degenerate ones nobody intended.
- **The eight aesthetics give target feelings a vocabulary**: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission. Naming the intended 1–2 per feature exposes mismatches early — e.g. a Challenge-shaped system smuggled into a game whose core aesthetic is Submission.
- A design is not done when the mechanics work; it is done when the *dynamics* players settle into produce the *aesthetics* aimed at.

## For みゅけ

みゅけ's core aesthetics are Submission （まったり共存）, Sensation, and Discovery — not Challenge. Feature proposals should name their target aesthetic and trace it back to mechanics before any code; see `checklist-mda-feature-review.md`.
