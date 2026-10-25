# Diegetic UI taxonomy — Fagerholt & Lorentzon, "Beyond the HUD" (2009)

- Type: LINK ONLY card (thesis/paper © the authors; course materials below are the accessible teaching sources).
- Primary source: Erik Fagerholt & Magnus Lorentzon, *Beyond the HUD — User Interfaces for Increased Player Immersion in FPS Games* (Chalmers University of Technology, 2009).
- Teaching sources (verified):
  - Trinity Western University, GAME 470 Unit 2 "Game User Interface": https://create.twu.ca/game470/unit-2-game-user-interface/
  - Stony Brook lecture notes on game UI (states the taxonomy and credits Fagerholt & Lorentzon 2009): https://www3.cs.stonybrook.edu/~tony/ui/lectures/game_design/gameUI.pdf
  - Practitioner framing: https://gdkeys.com/keys-efficient-user-interfaces/
- Visual companion: Edd Coates' **Game UI Database** (gameuidatabase.com) — thousands of categorized screenshots of shipped game UI; the standard "how do real games solve this exact element" reference.

## The classification, distilled

Any UI element can be classified by two yes/no questions — **does it exist inside the game world** (could the characters perceive it?) and **is it presented within the fiction's space?**

- **Diegetic** — exists in the world *and* in the fiction's space (an in-world object that carries information: our leaderboard board, desk phone, toolbox).
- **Spatial** — presented in the world's space but not part of the fiction (labels/markers floating at positions: speech bubbles, hover outlines).
- **Meta** — represents state through the world's presentation without being an object in it (screen-edge effects, a vignette when tired).
- **Non-diegetic** — neither: classic HUD and menus, rendered only for the player.

## The trade-offs, distilled

- Diegetic maximizes coherence/immersion but inherits the world's constraints: size, occlusion, viewing angle, and the fiction itself — information is limited to what an in-world object could plausibly show.
- Non-diegetic maximizes control: exact shape/color/placement, readability protected from world state, can live in unused screen areas — at the cost of breaking the fiction's surface.
- Spatial is the natural home for *positional* information; meta is the natural home for *state* feedback that should be felt rather than read.
- The design failure is not choosing any one of these — it is choosing *unconsciously*, per element, with no consistent rule.

## For みゅけ

This is the taxonomy our HUD object-ification already follows implicitly: diegetic objects on the strip, non-diegetic in the management menu. The card exists so the choice becomes explicit per element — see `checklist-diegetic-density.md`.
