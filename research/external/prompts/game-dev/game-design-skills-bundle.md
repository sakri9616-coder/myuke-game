# Game Design Skills Bundle (agent skills) — LINK-ONLY reference card

- **Source:** https://github.com/Stanestane/game-design-skills-bundle
- **Author:** Stanestane (OpenClaw / ClawHub-ready bundle)
- **License:** NOASSERTION (no clear license detected, verified 2026-10-26) → **link-only, do not copy skill text**
- **Verified:** ★86, 18 forks, last push 2026-09-19 (GitHub API, 2026-10-26). Small and single-author — treat as a promising reference, not an authority.

## What slop it prevents
Generic, template-shaped game design output from agents. The bundle packages game-design work as discrete agent skills: emotional direction, feature design workflows, design audits, FTUE (first-time user experience) design, pitch decks, prototyping, and red-team design review. Each skill forces the agent through a designer's checklist instead of letting it improvise a feature from genre averages.

## How we use it
- The closest game-design-specific agent-instruction set found in this survey. Read the **red-team design review** and **design audit** skills upstream before finalizing a new feature spec for the 相談リスト — run our spec through their checklists manually.
- The **FTUE** skill is directly relevant to the v2.3.8 tutorial work: compare its first-session checklist against our 7-stage tutorial design.
- Honest gap: dedicated anti-slop instructions for game *development* are scarce. The game-specific rule files that exist are engine-API guardrails (e.g. Unity rules inside awesome-cursorrules, installed alongside this card), not design-taste instructions. For UI/balance generation orders to Codex, our flow combines this bundle's checklists with the frontend-design and Ponytail instructions instead.
