# Vercel Web Design Guidelines (agent skill) — LINK-ONLY reference card

- **Source:** https://github.com/vercel-labs/agent-skills — skill folder `skills/web-design-guidelines/`
- **Author:** Vercel (official agent-skills collection)
- **License:** No license stated at repo root (verified 2026-10-26) → **link-only, do not vendor the skill or its rules file**
- **Verified:** ★32,999, last push 2026-10-14 (GitHub API, 2026-10-26)

## What slop it prevents
This is an *audit* skill, not a generation prompt: when invoked, the agent fetches the current guidelines file from upstream and reviews existing UI code against 100+ concrete rules — accessibility, focus states, typography, spacing, animation, forms, and common visual defaults — then reports violations file-by-file. It catches the "looks fine, reads generic" layer that generation-side prompts miss.

## How we use it
- Model for a **menu-UI review step**: after a Codex art/UI delivery or a background-loop UI change, run a guidelines-style audit pass over the changed panel (read the upstream rules fresh each time; they are maintained and versioned by Vercel, so a vendored copy would go stale).
- Pair with Anthropic's frontend-design skill (installed locally in this folder): frontend-design steers *generation*; Vercel's guidelines steer *review*.
- みゅけ caveat: the rules target web product UI. Apply the accessibility/typography/spacing rules to the management menu; ignore landing-page-specific rules for the desktop strip.
