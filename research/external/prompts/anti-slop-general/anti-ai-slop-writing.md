# anti-ai-slop-writing — LINK-ONLY reference card

- **Source:** https://github.com/jalaalrd/anti-ai-slop-writing
- **Author:** Jalaaldeen (jalaalrd)
- **License:** No license file in the repo (verified 2026-10-26) → **link-only, do not copy**
- **Verified:** ★568, 56 forks, last push 2026-04-18 (GitHub API, 2026-10-26). Works with Claude Code, Codex, Cursor, Gemini CLI and other agents.

## What slop it prevents
Generation-time AI tells in prose. Where stop-slop (installed locally) is an *editing* pass, this skill is a *pre-drafting constraint set*: 50+ banned words, 35+ banned phrases, 16 banned sentence openers, 10 banned structural patterns, plus punctuation/formatting leaks. Its lists are grounded in Wikipedia's "Signs of AI writing", Carnegie Mellon research (2025), and Buffer's large-scale post analysis. It treats uniform sentence length as the single most measurable AI signal and bans the default rule-of-three and staccato parataxis.

## How we use it
- Read upstream when drafting **English** outward text (release notes, README, store copy): load the banned lists into the drafting brief so the first draft avoids tells instead of needing a cleanup pass.
- For Japanese dev-room reports and in-game text, its word lists don't transfer (English-centric), but the structural rules do: vary sentence length, no rule-of-three padding, no staccato fragments. stop-slop's structure file (installed) covers the same ground for review.
- Optional: the avoid-slop directory (https://github.com/shannhk/avoid-slop) catalogs more tools in this space, including Matt Shumer's *unslop*, which empirically profiles a model's defaults and generates a custom avoidance skill — worth a look if we ever want a みゅけ-specific avoidance profile.
