# Karpathy Guidelines (LLM coding behavior) — LINK-ONLY reference card

- **Source:** https://github.com/multica-ai/andrej-karpathy-skills (originally published by Forrest Chang as forrestchang/andrej-karpathy-skills; the repo has since moved)
- **Author:** Principles from Andrej Karpathy's public observations on LLM coding failure modes; packaged as agent instructions by Forrest Chang / Multica
- **License:** No license file in the repo (verified 2026-10-26) → **link-only, do not copy the text into our files**
- **Verified:** ★223,691, last push 2026-04-20 (GitHub API, 2026-10-26). Also mirrored as a plain AGENTS.md gist.

## What slop it prevents
Four named LLM failure modes: (1) silently guessing instead of surfacing assumptions, (2) bloated abstractions and speculative features, (3) drive-by edits to unrelated code/comments/formatting, (4) wandering toward vague goals with no verifiable success criteria.

## The four principles (summary)
1. **Think Before Coding** — state assumptions, present alternatives instead of silently picking one, push back when a simpler approach exists, stop and ask when confused.
2. **Simplicity First** — minimum code that solves the problem; no unrequested features, abstractions, configurability, or error handling for impossible scenarios.
3. **Surgical Changes** — touch only what the task requires; match existing style; every changed line should trace to the request.
4. **Goal-Driven Execution** — turn the task into verifiable success criteria (e.g. a reproducing test) and loop until they pass.

## How we use it
- Paste the relevant principle (not the whole file — read it upstream) into subagent briefs and background-loop task instructions for `game/index.html` / `desktop/` work, especially "Surgical Changes" for a codebase where unrelated churn breaks sprite wiring and smoke tests.
- Complements Ponytail (installed locally): Ponytail decides *how little to write*; Karpathy governs *how to behave around existing code*.
- **Caution when adopting:** one public critique (oplane, 2026) notes the "no error handling for impossible scenarios" rule has no security carve-out. When we borrow that rule, keep trust-boundary validation and data-loss prevention explicitly exempt — Ponytail's version already does this.
