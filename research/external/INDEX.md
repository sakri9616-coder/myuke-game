# Anti-Slop Prompt & Instruction Corpus — INDEX

Purpose (sakuri, 2026-10-26): this folder is **not** game-design reading material. It is a working set of
**human-authored prompts, instruction files, and checklists whose job is to stop AI agents (みゅー,
subagents, the background loop, Codex) from producing slop** — generic prose, generic UI, and bloated
code. Every entry below says what slop it prevents and where it plugs into our dev flow.

Star counts and dates verified via the GitHub API on 2026-10-26. Entries marked **[FULL COPY]** are
installed locally under the license noted; **[LINK ONLY]** entries are original summary cards (the
upstream license does not clearly permit copying, or the source is a living document).

---

## prompts/anti-slop-general/ — prose

### 1. stop-slop — [FULL COPY]
- **Path:** `prompts/anti-slop-general/stop-slop/` (`SKILL.md` + `references/phrases.md`, `structures.md`, `examples.md`, `LICENSE`)
- **Author / source:** Hardik Pandya — https://github.com/hardikpandya/stop-slop
- **License:** MIT · ★18,334 · last push 2026-03-17
- **Prevents:** AI writing tells in prose — throat-clearing openers, emphasis crutches, business jargon,
  binary contrasts ("not X, it's Y"), dramatic fragmentation, passive voice, metronomic sentence rhythm,
  em-dash abuse. Ends with a 5-dimension scoring rubric (revise below 35/50).
- **Our use:** the **review pass for all outward and dev-room prose** — progress reports to みゅけ開発室,
  release notes, in-game text drafts. The background loop can run its Quick Checks against any report
  before posting. English-oriented lists; the structural rules transfer to Japanese.

### 2. anti-ai-slop-writing — [LINK ONLY]
- **Card:** `prompts/anti-slop-general/anti-ai-slop-writing.md`
- **Author / source:** Jalaaldeen — https://github.com/jalaalrd/anti-ai-slop-writing
- **License:** none stated → link only · ★568 · last push 2026-04-18
- **Prevents:** the same tells as stop-slop, but at *generation* time: banned words/phrases/openers loaded
  before drafting, grounded in Wikipedia's Signs of AI Writing and published research.
- **Our use:** read upstream when drafting English text from scratch; complements stop-slop (draft-side
  vs review-side).

## prompts/design/ — UI generation & review

### 3. Anthropic frontend-design skill — [FULL COPY]
- **Path:** `prompts/design/anthropic-frontend-design-SKILL.md` (+ `anthropic-frontend-design-LICENSE.txt`)
- **Author / source:** Anthropic (official skills repo) — https://github.com/anthropics/skills (`skills/frontend-design/`)
- **License:** Apache-2.0 (LICENSE.txt inside the skill folder) · repo ★183,703 · last push 2026-10-09
- **Prevents:** "distributional convergence" — the generic AI look. It bans overused fonts (Inter, Roboto,
  Arial, system fonts, Space Grotesk), purple gradients on white, predictable layouts, and — in the
  current version — names the three cliché "AI looks" (warm cream + serif + terracotta; near-black +
  acid accent; broadsheet hairline columns) as defaults to avoid. Forces the agent to commit to one
  deliberate aesthetic direction and execute it with intent in typography, color, spacing, motion.
- **Our use:** **the preamble for Codex UI orders and any subagent doing menu/strip UI work** — pasted
  ahead of the order, with みゅけ's own direction (programmer's-office code-editor skin, pixel-art world,
  readability floor) stated as the committed direction so the skill's "pick a direction" step lands on
  ours instead of inventing one. Fits sakuri's Codex briefing rule: requirements + style rules only.

### 4. Vercel Web Design Guidelines — [LINK ONLY]
- **Card:** `prompts/design/vercel-web-design-guidelines.md`
- **Author / source:** Vercel — https://github.com/vercel-labs/agent-skills (`skills/web-design-guidelines/`)
- **License:** not stated at repo root → link only · ★32,999 · last push 2026-10-14
- **Prevents:** review-side UI slop — an audit skill that checks UI code against 100+ maintained rules
  (accessibility, focus states, typography, animation, forms).
- **Our use:** the model for a **post-delivery UI audit step** in the background loop (read the rules
  fresh from upstream each audit; don't vendor). Generation = #3, review = #4.

## prompts/code-quality/ — code generation

### 5. Ponytail (AGENTS.md + SKILL.md) — [FULL COPY]
- **Path:** `prompts/code-quality/ponytail-AGENTS.md` (compact rules-file version),
  `prompts/code-quality/ponytail-SKILL.md` (full skill), `ponytail-LICENSE`
- **Author / source:** Dietrich Gebert — https://github.com/DietrichGebert/ponytail
- **License:** MIT · ★176,010 · last push 2026-10-18
- **Prevents:** AI code bloat — wrappers, premature abstractions, new dependencies for a few lines,
  "future-proof" scaffolding. Core is a decision ladder: (1) does it need to exist? (2) already in this
  codebase? (3) stdlib? (4) native platform feature? (5) installed dependency? (6) one line? (7) only
  then, the minimum that works. Explicitly *protects* trust-boundary validation, data-loss prevention,
  security, and accessibility from the laziness ladder. Ships lite/full/ultra levels.
- **Our use:** **default instruction block for the background dev loop and coding subagents** on
  `game/index.html` / `desktop/` — the AGENTS.md version drops straight into a task brief. `full` level
  as the default; `lite` when sakuri is reviewing the diff personally. Also the philosophical match for
  the harness-optimization mandate: least code that fully solves it.

### 6. Karpathy Guidelines — [LINK ONLY]
- **Card:** `prompts/code-quality/karpathy-guidelines.md`
- **Author / source:** Andrej Karpathy's observations, packaged by Forrest Chang / Multica —
  https://github.com/multica-ai/andrej-karpathy-skills
- **License:** none stated → link only · ★223,691 · last push 2026-04-20
- **Prevents:** silent assumption-guessing, over-complication, drive-by refactoring of unrelated code,
  and vague-goal wandering (Think Before Coding / Simplicity First / Surgical Changes / Goal-Driven
  Execution).
- **Our use:** brief-writing discipline for subagents and the loop — especially "Surgical Changes" +
  "Goal-Driven Execution" (verifiable success criteria = our smoke/sim/screenshot gates). Read upstream;
  pair with Ponytail (#5). Note the security carve-out caution in the card.

### 7. awesome-cursorrules — JS/TS code-quality rule — [FULL COPY of selected files]
- **Path:** `prompts/code-quality/awesome-cursorrules/javascript-typescript-code-quality.mdc`
- **Author / source:** PatrickJS (Patrick) + community — https://github.com/PatrickJS/awesome-cursorrules
- **License:** CC0-1.0 · ★41,022 · last push 2026-05-30
- **Prevents:** framework-ignorant generic code. The repo is the canonical .cursorrules/.mdc collection;
  we vendor only the one file relevant to our vanilla JS/TS frontend.
- **Our use:** reference when a task brief needs JS/TS house rules; also the format reference if we ever
  write a みゅけ-specific `.mdc` rule set (e.g. sprite-wiring conventions) — one concern per file,
  scoped globs, verifiable instructions.

## prompts/game-dev/ — game-specific instructions

### 8. awesome-cursorrules — ASCII simulation game rule — [FULL COPY]
- **Path:** `prompts/game-dev/awesome-cursorrules/ascii-simulation-game.mdc`
- **Author / source:** community contribution in PatrickJS/awesome-cursorrules (CC0-1.0)
- **Prevents:** generic-code drift in a simulation-game project: the rule installs an "expert game
  designer + programmer" stance with game-specific design/coding practices for all decisions.
- **Our use:** a lightweight **stance prompt for game-logic work** (economy ticks, staff behavior,
  production flow) when a subagent touches simulation code — pair with Ponytail so the stance doesn't
  license bloat. Honest note: it is short and generic compared to #3/#5; its value is showing the
  .mdc pattern for a game project, and it is the only sim-game rule in the canonical collection
  (no Godot/Unity/Unreal rules exist there beyond a Unity file-list entry).

### 9. Game Design Skills Bundle — [LINK ONLY]
- **Card:** `prompts/game-dev/game-design-skills-bundle.md`
- **Author / source:** Stanestane — https://github.com/Stanestane/game-design-skills-bundle
- **License:** NOASSERTION → link only · ★86 · last push 2026-09-19
- **Prevents:** template-shaped game design — agent skills for emotional direction, feature workflows,
  design audits, FTUE, prototyping, and red-team design review.
- **Our use:** run feature specs for the 相談リスト through its audit / red-team checklists (read
  upstream); compare its FTUE checklist against the v2.3.8 tutorial. Small single-author project —
  a reference, not an authority.

## checklists/ — review passes

### 10. ponytail-review — [FULL COPY]
- **Path:** `checklists/ponytail-review-SKILL.md`
- **Author / source:** Dietrich Gebert (Ponytail repo) — https://github.com/DietrichGebert/ponytail
- **License:** MIT
- **Prevents:** bloated diffs surviving review — a diff-review skill hunting bugs, security issues,
  missing tests, and *what to delete* (unneeded dependencies, reinvented stdlib, dead flexibility);
  every finding must state what goes wrong and how to fix it.
- **Our use:** **the background loop's review step** — after implementing a backlog item and before the
  smoke/sim/screenshot gates, run this review over the diff. Also usable on Codex deliveries before
  integration.

### 11. Wikipedia: Signs of AI writing — [LINK ONLY]
- **Card:** `checklists/wikipedia-signs-of-ai-writing.md`
- **Author / source:** WikiProject AI Cleanup (Wikipedia editors) —
  https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing · License: CC BY-SA 4.0
- **Prevents:** unnamed "this reads like AI" vagueness — the canonical human catalogue of AI tells that
  #1 and #2 are built on.
- **Our use:** the reference behind prose review; template for a future みゅけ-specific Japanese
  tell-list for staff chatter / quest text / report prose.

---

## How this corpus was built (and what was left out)

- **Pivot (2026-10-26):** an earlier pass collected game-design *knowledge* (idle-game math articles,
  UI databases, pattern books). Per sakuri's corrected direction, knowledge articles are out — only
  resources usable *as AI instructions* were kept, and none of the earlier candidates were
  instruction-shaped, so nothing carried over.
- **Excluded on a safety flag:** one web-search result in this survey failed a safety check. Sources
  named only in that result were **not** fetched or installed, however popular they appear to be;
  if sakuri wants them evaluated, that needs a separate go-ahead.
- **Rejected as slop / not credible:** anonymous or AI-generated "awesome anti-slop" aggregator lists;
  a 4★ Unity rules repo that is a free teaser for a paid kit (scoyoc5/unity-ai-agent-rules);
  book-companion repos with no adoption (0★). Directories of tools (e.g. shannhk/avoid-slop) are
  pointers, not instructions — mentioned inside card #2 instead of installed.
- **Known gap:** there is no mature, human-authored anti-slop instruction set for *game balance/economy
  generation* specifically. Our flow covers balance work by combining Ponytail + Karpathy (process)
  with our own `tools/balance-sim.js` gates (verification) — the instructions prevent process slop;
  the simulator catches numeric slop.

---

# Round 2 — Game-Design Reasoning Library (`game-design/`)

Added 2026-10-26 at sakuri's direction, refining Round 1: anti-slop material specialized for
game-balance/economy *generation* is still not wanted (the "Known gap" above stands, by choice).
What was missing and is now installed is **game-specific design reasoning material** — how to think
about game UI, game systems, and balance tuning. (This supersedes the Round 1 survey note above
that kept design *knowledge* out: reasoning frameworks and methodology are in; raw data tables and
AI-generated listicles are still out.) All GitHub sources below were verified via the GitHub API on
2026-10-26; web sources were read directly. **[FULL COPY]** = installed locally under the noted
license; **[CARD]** = our own-words summary card (license does not permit copying).

**Wiring rules for our flow:**
- Balance/economy proposals in the backlog's 相談リスト must pass
  `game-design/balance/checklist-balance-proposal-gate.md`, which cites the balance/ and systems/
  sources below.
- UI work (strip or menu) references `game-design/ui/` — the two checklists there run with the
  Round 1 UI passes (#3/#4), not instead of them.
- New-feature design references `game-design/systems/` — the MDA review runs on the proposal
  before implementation.

## game-design/ui/ — game UI design

### U1. Diegetic UI taxonomy — Fagerholt & Lorentzon (2009) — [CARD]
- **Card:** `game-design/ui/diegetic-ui-taxonomy.md`
- **Source:** *Beyond the HUD* (Chalmers, 2009); taught at https://create.twu.ca/game470/unit-2-game-user-interface/ and in Stony Brook's lecture notes; visual companion = Edd Coates' Game UI Database.
- **Supports:** classifying every element diegetic / spatial / meta / non-diegetic *deliberately*, with the trade-offs of each class.
- **Our use:** the vocabulary behind the strip's HUD object-ification; run `game-design/ui/checklist-diegetic-density.md` on strip/menu changes.

### U2. The Gamer's Brain — Celia Hodent — [CARD]
- **Card:** `game-design/ui/hodent-gamers-brain.md`
- **Source:** book (CRC Press, 2017; 2nd ed. 2025) + GDC talks; framework summary linked in the card.
- **Supports:** UI reasoning from cognitive science — perception (Gestalt, form follows function), memory (forgetting curve → never require remembering off-screen state), attention (inattentional blindness → salience and minimum workload).
- **Our use:** `game-design/ui/checklist-brain-and-access.md`; the standing argument for why strip state changes need motion/redundant channels, given the player is usually looking at their real work.

### U3. APX — Accessible Player Experiences (AbleGamers) — [CARD]
- **Card:** `game-design/ui/apx-accessible-patterns.md`
- **Source:** pattern deck https://ablegamers.shop/products/apx-cards (companion site accessible.games); research background via University of York.
- **Supports:** accessibility as reusable design patterns (Second Channel, Do More With Less, …) instead of a late compliance audit.
- **Our use:** readability/affordance rules in the brain-and-access checklist — no color-only signals, click-count budgets by frequency.

### U4. 2DGD "From Zero To Hero" — Accessibility chapter — [FULL COPY]
- **Path:** `game-design/ui/2dgd-accessibility.md` (license text: `game-design/2dgd-license-CC-BY-NC-SA.txt`)
- **Source:** the open book *2D Game Development: From Zero To Hero* — https://github.com/2DGD-F0TH/2DGD_F0TH · CC BY-NC-SA 4.0 · ★464 · active.
- **Supports:** practical, 2D-specific accessibility reasoning in full text.
- **Our use:** reference text behind U3's checklist items.

### U5. UI checklists — [OURS]
- `game-design/ui/checklist-diegetic-density.md` — classification, density, affordance, occlusion, shipped-reference check.
- `game-design/ui/checklist-brain-and-access.md` — perception/memory/attention + second-channel/readability/click-budget checks.

## game-design/systems/ — game systems design

### S1. MDA framework — Hunicke, LeBlanc & Zubek (2004) — [CARD]
- **Card:** `game-design/systems/mda-framework.md`
- **Source:** AAAI workshop paper; accessible presentations linked in the card (FutureLearn unit, explainer).
- **Supports:** feature reasoning in both directions — target Aesthetics → Dynamics → Mechanics, and forward-checking the dynamics mechanics will actually create; the eight aesthetics as a vocabulary for intended feelings.
- **Our use:** `game-design/systems/checklist-mda-feature-review.md` runs on every feature proposal (みゅけ's defaults: Submission / Sensation / Discovery).

### S2. The Chemistry of Game Design — Dan Cook (skill atoms) — [CARD]
- **Card:** `game-design/systems/cook-skill-atoms.md`
- **Source:** https://lostgarden.com/2021/03/13/the-chemistry-of-game-design-2/ (2007 original, 2021 revision).
- **Supports:** core-loop analysis — a skill atom is a feedback loop (model → action → simulation → feedback → model update); progression = skill chains; a broken feedback stage makes a system feel dead regardless of its numbers.
- **Our use:** `game-design/systems/checklist-skill-atom-loop.md` for new systems and "feels dead" diagnoses.

### S3. Machinations / internal-economy modeling — Dormans; Adams & Dormans — [CARD]
- **Card:** `game-design/systems/machinations-economy-modeling.md`
- **Source:** platform https://machinations.io/ ; framework in *Game Mechanics: Advanced Game Design* (2012).
- **Supports:** economy *structure* reasoning — pools, sources, sinks, converters, signed feedback loops; runaway-accumulation and starvation audits.
- **Our use:** `game-design/systems/checklist-economy-structure.md`; economy proposals attach the diagram delta (the paper twin of `tools/balance-sim.js`).

### S4. Gameplay Design Patterns — Björk & Holopainen — [CARD]
- **Card:** `game-design/systems/gameplay-design-patterns.md`
- **Source:** *Patterns in Game Design* (2005) + the gdp3 pattern wiki (link in card).
- **Supports:** a shared vocabulary for design intentions, including which patterns instantiate or conflict with each other.
- **Our use:** naming what ambient/strip systems already are, and conflict-checking new patterns before building them.

### S5. The Art of Game Design: A Book of Lenses — Jesse Schell — [CARD]
- **Card:** `game-design/systems/schell-book-of-lenses.md`
- **Source:** book (2008; 3rd ed. 2020); listed in the open bibliography linked in the card.
- **Supports:** question-driven design review (lenses: Core Loop, Goals, Surprise, Problem Statement…) and the Elemental Tetrad — a system that lives only in menu text has failed the presentation leg.
- **Our use:** lens picks are embedded in the MDA and skill-atom checklists.

### S6. 2DGD "From Zero To Hero" — design chapters — [FULL COPY]
- **Paths:** `game-design/systems/2dgd-gameplay-flow.md`, `game-design/systems/2dgd-consolidating-mechanics.md` · CC BY-NC-SA 4.0 (see U4).
- **Supports:** gameplay-flow archetypes with pros/cons, and teach → remind → re-use-in-new-contexts as the way mechanics are consolidated (progression-gate reasoning).
- **Our use:** reference when structuring tutorials and feature unlock order.

## game-design/balance/ — balance reasoning

### B1. Game Balance Concepts — Ian Schreiber — [CARD]
- **Card:** `game-design/balance/schreiber-game-balance-concepts.md`
- **Source:** free course https://gamebalanceconcepts.wordpress.com/ ; expanded into *Game Balance* (CRC Press, 2021, with Brenda Romero).
- **Supports:** the core tuning grammar — transitive relations on a single cost curve; intransitive (rock-paper-scissors) relations via payoff matrices; probability and its misperception; "everything needs a counter"; playtesting as an instrumented activity.
- **Our use:** `game-design/balance/checklist-transitive-intransitive.md` for every new purchasable or qualitative fork.

### B2. The Math of Idle Games I–III — Anthony Pecorella — [CARD]
- **Card:** `game-design/balance/pecorella-math-of-idle-games.md`
- **Source:** Kongregate developer blog (2016), mirrored at https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i (Parts I–III; spreadsheet models published with the articles).
- **Supports:** *our genre's* math reasoning — geometric cost vs. linear production seesaw; milestone multipliers; rotating dominance between generator lines; felt impact over ratio-optimality; prestige as a fractional exponent (the cadence dial); offline earnings as a pacing choice.
- **Our use:** `game-design/balance/checklist-idle-curve-tuning.md`; the vocabulary (generator / multiplier / wall / prestige exponent) is required in balance proposals.

### B3. 2DGD "From Zero To Hero" — balancing chapters — [FULL COPY]
- **Paths:** `game-design/balance/2dgd-difficulty-curves.md`, `game-design/balance/2dgd-economy.md`, `game-design/balance/2dgd-perceived-fairness.md` · CC BY-NC-SA 4.0 (see U4).
- **Supports:** difficulty-curve shapes with trade-offs, supply/demand basics for in-game economies, and perceived-fairness reasoning (when the fix is presentation, not numbers).
- **Our use:** reference text for the balance gate below, esp. the math-vs-perception split.

### B4. Balance checklists — [OURS]
- `game-design/balance/checklist-idle-curve-tuning.md` — name the curves, find the seesaw point, dominance rotation, felt impact, prestige exponent.
- `game-design/balance/checklist-transitive-intransitive.md` — one-curve test, dominance scan, name the counter, cycle check.
- `game-design/balance/checklist-balance-proposal-gate.md` — **the gate**: sources/sinks, curves old→new, time-to-reward targets, dominance & counter, evidence plan with a falsifier, perception path. No 相談リスト balance proposal ships without it.

## Discovery index — [CARD]

### D1. awesome-game-design — Roobyx
- **Card:** `game-design/awesome-game-design-index.md` · https://github.com/Roobyx/awesome-game-design · CC-BY-4.0 · ★696 · actively maintained.
- **Use:** first stop when a design question has no card yet — find the canonical source there, then card/copy it properly. Lists point; primary sources teach.

## Round 2 — deliberately rejected

- **Donchitos/Claude-Code-Game-Studios** (★27.5k) — an AI-agent workflow kit, not human design reasoning; this library is for the reasoning, not for more agent scaffolding.
- **vyakart/magictools** (★17.6k) and similar — directories of tools; pointers, not reasoning (same rule as Round 1).
- **Code-pattern repos** (e.g. Unity design-pattern collections) — software architecture, not game design; our genre's questions are not answered there.
- **"Tycoon economy" agent-skill files** (tiny, unverifiable authorship) — exactly the AI-generated instruction slop Round 1 exists to avoid.
- **GDD templates** (several small repos) — document scaffolding, not reasoning; our DESIGN.md practice already covers the need.
- **SEO listicles and content-farm "game balance tips"** — unverifiable authorship, no method. When in doubt, this library prefers one 2004 workshop paper over fifty blog posts.
