# PLAN — arc-design · "The Designer" (design capability as a first-class arc module)

> Written 2026-07-26, grounded against the repo during Cycle-2 Phase-04 dogfood.
> **Status: kickoff-grade, FROZEN.** Decisions consolidated over 4 spec rounds (v2 →
> v2.3: one repo audit + three external design reviews, every point adjudicated).
> Part 4's decision record is LOCKED — attack this plan at kickoff, don't re-litigate
> the record. Attack-panel / plan-simulator findings mutate the PLAN it produces, not
> this file.
> Decisions are named **DES-A…** below and get real ADR numbers at kickoff from the next
> free slot (pack convention — see `../README.md` correction #2).
> Companion inputs: the 4 LexOS design drafts (brand.md · references.md ·
> design-system.md · tokens-proposal.md — land in the Lexos repo `docs/design/`).
> Recommended appetite: **5 days → M-tier** (final number = owner's call at kickoff step 1).

---

# PART 1 — WHY (the audit)

## 1.1 The problem
arc ships serious products (kickoff, council, spine, QA) but design was never a
first-class citizen. Council decides "world's best product" with 13 jurors; design gets
one post-hoc reviewer. Goal: **council-level rigour for design — a world-class designer
product, not a prettier reviewer.**

## 1.2 What exists today (repo-verified 2026-07-26)
- `council-designer` — 1 of ~13 jurors; decision lens only, not craft.
- `design-reviewer` agent + `/arc-design` command — under **products/qa/**; scores 8
  dimensions 0-10, AI-slop blacklist, fixes in code, agent-browser screenshots.
- `.claude/rules/ui.md` (877B) · `docs/branding.md` (356B, all TODO) ·
  `docs/ui-conventions.md` (484B) · agent-browser `vitals`/`diff` (QA-only use).
- review-ledger already supports a `design` stamp (wired to /arc-design PASS — unused).

## 1.3 The 7 gaps
1. `/arc-kickoff` v3.5 (10 steps) has ZERO design step → no design artifact ever exists →
   reviewer has no intent to review against.
2. No taste input / reference corpus anywhere.
3. `/arc-design` emits NO spine receipt → design invisible to HQ brief, trial-ledger,
   calibration.
4. No design-system artifact — docs reference `styles/tokens.css`; no template, no lint.
5. **design-reviewer has no vision** — takes screenshots but nothing makes it read the
   PNG back. It judges code, not the screen.
6. Asymmetry: 3 plan-attackers · 13 jurors · 6 scanners vs **1** design agent.
7. No `design` gate in `arc.gates.yaml` — opt-in only via ARC_REQUIRED_REVIEWS.

## 1.4 Root cause
arc doctrine = **anchored creation → unanchored verification → deterministic gates**.
Plan has all three layers. Design has only half a verification layer.
**No design artifact = nothing to attack, lint, receipt, or calibrate.**
Post-hoc review can fix padding; it can never fix the wrong screen.

---

# PART 2 — WHAT (the product)

## 2.0 Definition of done — REQ-01, externally testable, TWO evidence streams
> Arc takes a real product premise and produces THREE distinctive, usable,
> production-feasible directions.

Phase-3 blind test (₹0: design communities, peers, LexOS lawyer contacts; arc origin
undisclosed), recorded as two SEPARATE evidence files:
- **Stream A — experienced designers:** coherent, distinctive, feasible, well-crafted?
  PASS = ≥2 of 3 directions taken seriously.
- **Stream B — target users:** understand and complete the key task without confusion?
  PASS = completion without intervention.
A peer's "looks good" never counts as user validation; a user completing a task never
counts as craft evaluation. **Both streams must pass.** Arc judging arc ≠ proof.

Non-goal: replacing the owner's taste. Goal: making it researched, reusable, enforceable,
and IMPROVING.

## 2.1 Two systems, never merged (kernel/venture mirror)
- **arc design principles** (kernel, ALL products): typography, hierarchy, a11y floor,
  interaction quality bar, motion restraint, content realism ("no lorem ipsum in any
  reviewed artifact"). Enduring. Changes need an arc-level ADR.
- **Product art direction** (per product, `docs/design/`): premise-derived feel words,
  brand stance, reference selections, density, personality, product design ADRs.
The first keeps the floor high; the second stops every product looking like one template.

## 2.2 Command surface — one command, five modes
`/arc-designer <mode> [target]` (working name; may remain `/arc-design`)

| mode | when | output |
|---|---|---|
| `brief` | kickoff step 4.5, UI-bearing builds | 4-section brief + design ADRs |
| `explore` | after brief, before UI code | 3 isolated variants + rankings → human decision |
| `build` | during a UI phase | implements the picked direction with canonical tokens |
| `review` | phase close | defect report vs the BRIEF + contracts (not vibes) → receipt + stamp |
| `suggest` | anytime | diagnosis + ranked suggestions w/ reference receipts + effort tags; NO code, no stamps |

Tier governs EFFORT DEPTH only (S = brief-lite + review · M = +explore 2-3 variants ·
L = full + deeper critique passes). Tier NEVER governs device coverage — the platform
contract does (§2.4C).

## 2.3 Agent roster + write permissions (creation writes, verification inspects)

| role | model | writes | may NEVER write |
|---|---|---|---|
| design-researcher | sonnet | library entries, factual receipts | brief, variants |
| design-director | opus | brief, thesis assignments, rejections | variant code |
| ui-composer ×3 | sonnet | own variant IN OWN WORKTREE + own temp tokens | brief, other variants |
| design-critic | sonnet + **VISION mandatory** | critique artifact + receipt ONLY | any product code, brief, variants |
| design-jury ×3 | sonnet, blind | ranking + reasons artifact | everything else |
| human (owner) | — | decision + rationale + prediction | — |

**Critic read-only is enforced MECHANICALLY, using arc's existing machinery — no new infra:**
1. Agent frontmatter `tools:` — Read, Bash (scoped), Glob, Grep, Write. **NO Edit.**
2. `.claude/hooks/PreToolUse-edit.d/` (existing freeze-hook pattern, cf. 00-freeze.sh):
   critic Write allowed ONLY under `docs/design/critique/**`; any other path blocks.
3. Receipts via scoped permission `Bash(bash .claude/scripts/hq/arc-event.sh:*)` —
   the exact /arc-qa allowed-tools pattern.

**Fix flow (preserves "beats report-only"):** critic reports → CREATION side fixes
(composer during explore; build mode during implementation) → critic re-verifies.
The verifier approving its own edits is impossible by construction.

## 2.4 Brief mode — FOUR required sections (all design-lint-checked)

**A. Interaction model — 7 answers, no pixels until they exist:**
1. The user's job in ONE sentence.
2. The primary OBJECT of the product.
3. The primary ACTION on it.
4. What must be VISIBLE before that action.
5. Progressive disclosure vs always-visible — the explicit split.
6. After success / failure / interruption / return — what does the user see?
7. What becomes FASTER once the user has learned the product (expert path).

**B. Art direction:**
- **Taste = DECISION, not research finding.** Derived from premise + brand stance +
  audience; recorded as design ADRs (one-way doors: dark mode, density, brand mark,
  motion stance — each with a revisit trigger).
- Research receipts required ONLY for factual/pattern claims (user expectations, domain
  conventions, competitor IA). Never for taste itself. Kills research theatre.
- 3 feel words + 3 anti-words · state matrix (empty/loading/error/success/disabled per
  surface) · product-specific slop kill-list · a11y floor (AA, visible focus, ≥44px
  targets, reduced-motion honoured).

**C. Platform contract (replaces any tier-based device rule):**

| Surface | Required? |
|---|---|
| Desktop | yes/no |
| Mobile | yes/no |
| Tablet | yes/no |
| Keyboard-first | yes/no |
| Reduced motion | yes/no |

Declared per product in the brief. The critic verifies EXACTLY this contract — nothing
skipped, nothing padded.

**D. Content contract:**
- Product nouns + object naming (mental-model decisions, not copy details)
- Primary action verbs
- Voice + tone
- Terms users ALREADY understand (domain vocabulary, never invented labels)
- Sensitive / error / destructive-action language
- Content density rules
Composers must use this vocabulary; the critic flags violations as VIOLATION class.

## 2.5 Explore mode — interaction theses + IA matrix + isolation

**Theses, not styles.** Composer ×3, each assigned a DIFFERENT product-structure thesis,
chosen per product from: command center (dense, keyboard-first) · guided workflow (steps,
progressive disclosure) · canvas (spatial object manipulation) · narrative (content-led,
paced) · review workspace (compare, annotate, approve) · ambient assistant (AI present,
not dominant). Each variant opens with:
> **"This product wins because the user can ___ without ___."**

**Divergence test = IA-difference matrix** (string distance proves words differ, not
concepts). Each variant fills:

| dimension | A | B | C |
|---|---|---|---|
| primary object | | | |
| primary action | | | |
| info before action | | | |
| navigation model | | | |
| progressive-disclosure rule | | | |
| expert path | | | |
| failure/recovery path | | | |

**≥3 dimensions must materially differ across concepts.** Lint checks the matrix exists;
the DIRECTOR judges "materially" and rejects same-app-different-styling variants.
Three similar thesis lines ⇒ exploration FAILED ⇒ reassign theses.

**Isolation (parallel real-stack exploration made safe):**
- All three start from the SAME immutable base revision (SHA recorded in the brief dir).
- One worktree per composer (`.claude/worktrees/` — existing arc dir); fallback: separate
  variant route namespace.
- Separate temp token set per variant (variant-a/b/c) — visual consistency during
  exploration, zero raw one-off CSS. The WINNER's set → canonical product tokens post-pick.
- NOTHING merges into the product until the human decision.
- ONE deterministic render command shared by all variants (same data fixture, same port
  scheme, same viewport script) — otherwise screenshot comparisons are not comparisons.

**Real-stack rule:** product stack exists ⇒ variants from its real primitives (LexOS:
`app/ui.ts` + Tailwind). HTML sketching allowed ONLY greenfield. The chosen direction
survives implementation by construction.

**Realistic content mandatory:** real-shaped data from the content contract (Indian
names, ₹ amounts, real-length titles). No lorem ipsum — lintable.

## 2.6 Critique — defect model, never score-chasing
Critic (VISION mandatory — reads every PNG back before judging):
- **Coverage:** task flows across the 5 deciding screens (not isolated shots) · full
  state matrix · keyboard + focus order · realistic-data reflow · every surface the
  platform contract declares · vocabulary vs the content contract.
- **Findings — three classes (code-reviewer / simulator pattern):**
  - `VIOLATION` — breaks a principle, the brief, the interaction model, or a contract →
    creation side MUST fix; max 2 revision rounds, then it's a human call.
  - `WEAKNESS` — important; listed; fixed at build time.
  - `POLISH` — optional; logged.
- **NO absolute quality scores** (agents optimizing a number converge to safe-average).
  Numbers exist ONLY as blind comparative ranking (§2.7).

## 2.7 Judgment, merge rule, and the learning ledger

```
brief (interaction model + art direction + platform contract + content contract)
  → 3 theses (director rejects weak divergence via IA matrix)
  → isolated real-stack prototypes (own worktree, own temp tokens, shared render command)
  → critic: defect classes vs the contracts → creation fixes → critic re-verifies
  → blind comparative ranking ×3 (no cross-talk; rankings + reasons recorded)
  → OWNER DECIDES — three legal outcomes:
       (a) pick one direction
       (b) reject all → theses reassigned, loop restarts
       (c) constrained merge → MUST declare a NEW thesis and re-enter critique
           (no Frankenstein best-bits assembly)
  → decision recorded WITH rationale AND a falsifiable PREDICTION:
       "We expect <direction> to <measurable effect> because <mechanism>."
  → winner's temp tokens → canonical product design system
    (tokens are an OUTPUT of direction, not an input)
  → build mode implements · task-flow verification (agent-browser drives real flows)
  → POST-RELEASE: outcome evidence (user feedback, support issues, completion, adoption,
    observed friction) attached to the prediction
  → receipts + stamps (§2.10)
```
The pick-rationale calibrates *preference*; predictions + outcomes + evals + external
streams calibrate *quality*. **Two ledgers, kept distinct.**

## 2.8 Design intelligence library (arc-kernel asset, compounding taste)
Four reference types — the PRINCIPLE recorded, never just the screenshot:
- **Pattern** — how experts solve a specific interaction problem.
- **Craft** — typography, density, hierarchy, motion, details.
- **Brand** — emotional stance / visual language to emulate.
- **Anti** — right for another product, wrong for this intent (recorded WHY).

Entry format: *"Linear's density works because project state is visible without
navigation — do not copy its appearance."*
**Every entry tagged:** product domain · user type · platform · interaction problem ·
confidence · outcome (when known). Untagged observations don't enter.
**Refresh is EVENT-TRIGGERED** (domain / audience / platform / competitive-landscape
change — assumption-ledger trigger pattern). No timer.
Accumulates: reference principles + pick rationales + predictions + outcome evidence.
References are for patterns/vocabulary — copying a specific design = slop with extra
steps (and legal risk).

## 2.9 Design evals suite (W3+, NEVER an early gate)
`design-evals/` corpus — 7 hard briefs: complex dashboard · first-run onboarding · empty
state · destructive action · dense mobile workflow · long-form edit/review surface ·
error recovery. Each: human-approved benchmark direction + rationale. Re-run the pipeline
periodically → compare → "is the capability improving?" gets an answer beyond artifact
count. (Council Brier-ledger analog for design.)

## 2.10 Deterministic layer
- **`design-lint.mjs` v0 checks:** brief has ALL FOUR sections (7 interaction answers ·
  art direction · platform-contract table · content contract) · IA matrix present per
  variant · thesis lines present · base-revision SHA recorded · temp-token file per
  variant, no raw hex in variant code · declared contrast pairs pass AA · no lorem-ipsum
  strings in reviewed routes · canonical tokens exist post-pick.
- **`arc.gates.yaml`:** `design` gate, **warn mode first** (v3.5 WARN-first doctrine);
  promote to block only via retro + owner's OK.
- **Spine — closed vocabulary ONLY (ADR-0026, 18 kinds, never extend):**
  - design reviews → `review.completed` payload `{"lens":"design"}`
  - pick + prediction → `decision.recorded` payload
  - outcome evidence → `note.logged`
- **review-ledger:** existing `design` stamp finally used; stamped only on PASS.

## 2.11 External tool stack — W3+ ONLY (accelerators, not intelligence)
Researched 2026-07-26; re-verify at install (slopsquatting rule applies to MCPs too:
registry + official docs + receipt):
- Anthropic frontend-design plugin (free; generic — import then OVERRIDE with arc brief)
- shadcn MCP (already available locally) · Magic MCP / 21st.dev (freemium)
- Figma MCP (official; only if a Figma file enters the flow)
- tweakcn / free shadcn themes · Mobbin-style galleries (research input only)
- agent-browser — already in arc; this is the EYES transport from Phase 0, not W3.
**V1 rule: prove the loop with agent-browser + existing rendering FIRST. Then earn tools.**

---

# PART 3 — HOW (packaging, phases, pilot)

## 3.1 Packaging
**`products/design/manifest.json` module** inside the arc repo — moves arc-design.md +
design agents out of `products/qa/`. NEVER a separate repo: gates, spine, ledger,
sync-to-project all live in-repo. Public/SaaS differentiator: no other AI dev framework
ships a design gate.

## 3.2 Build order (risk-first sketch — final shape comes from the kickoff itself)
- **Phase 0 — steel thread. Build EXACTLY this; earn the rest:** critic vision +
  mechanical read-only enforcement (tool list + edit-hook path scope) + spine emit +
  warn gate + minimal brief template → **ONE real route independently inspected
  end-to-end with a reliable receipt on the spine.** Proves the verification spine
  before any generation exists.
- **Phase 1:** full brief mode (4 sections) + design-lint v0 + kickoff step 4.5 hook
  (UI-bearing builds only, router condition) + `products/design/manifest.json`.
- **Phase 2:** explore mode — theses assignment, IA matrix, worktree isolation,
  per-variant tokens, shared render command, defect critic, blind ranking,
  pick/reject/merge flow + prediction capture.
- **Phase 3:** intelligence library (tagged schema) + LexOS pilot end-to-end +
  **external blind test, two evidence streams (REQ-01 answered here).**
- **Later cycles via `/arc-change`:** evals suite · MCP accelerators · outcome-evidence
  tooling · motion/tablet depth · suggest-mode polish · gate warn→block (via retro).

## 3.3 LexOS pilot (dogfood-then-promote)
Companion inputs already drafted (2026-07-26): `brand.md` (brand navy #14385C — 12.0:1
on white; hover #1B4B79; active #0F2A46; tint #EEF3F8; system font stack; no dark mode
with revisit trigger; ₹0 wordmark "Lex" navy + "OS" ink; LexOS slop kill-list) ·
`references.md` (12-row corpus: Attio, Linear, Stripe, Height, Razorpay, Zoho Books,
Clio/PracticePanther/eCourts = IA+vocabulary only, Basecamp, GOV.UK DS; anti-references;
the 5 deciding screens — client portal flagged underrated) · `design-system.md` (5 laws,
token map, state matrix, a11y floor, review contract) · `tokens-proposal.md` (~35-line
patch; does NOT touch danger/status/spacing/disabled values — `disabled:bg-gray-500`
4.83:1 and Map-based statusBadge in ui.ts are deliberate, do not "clean up").

**Pilot brief upgrade needed (Phase 3):**
- Interaction model — open question: primary object = case or client? (routes today are
  client-heavy; lawyers think in cases. This ONE answer decides the dashboard IA.)
- Platform contract: desktop Y · mobile Y (lawyers check on phones) · tablet N ·
  keyboard-first Y (clerk data entry) · reduced-motion Y.
- Content contract: case / client / matter / document / deadline vocabulary — resolve
  with real lawyer input (this doubles as Stream B's first data point).
- Known product gaps the pilot must address: silent saves (no toast product-wide) ·
  no modal/confirm · no ₹/date formatter (Indian grouping) · no pagination · no
  multi-column invoice table (Phase 5) · raw Tailwind literals (gray-900 = 4 meanings).

---

# PART 4 — DECISIONS

## 4.1 ADR-ready decisions (named per pack convention; numbers assigned at kickoff)
- **DES-A** — packaging: `products/design/` module in-repo, never a separate repo.
- **DES-B** — verification is read-only, enforced mechanically (tool list + edit-hook
  path scope + scoped receipt Bash); creation fixes, critic re-verifies.
- **DES-C** — spine vocabulary stays CLOSED (ADR-0026): design rides
  `review.completed {"lens":"design"}` / `decision.recorded` / `note.logged`.
- **DES-D** — the brief carries four contracts (interaction model · art direction ·
  platform contract · content contract); coverage is contract-driven, tier = effort only.
- **DES-E** — exploration diverges by interaction THESIS with the IA-difference matrix
  (≥3 of 7 differ) in isolated worktrees with per-variant temp tokens.
- **DES-F** — learning is prediction-based: pick rationale + falsifiable prediction +
  post-release outcome; preference ledger ≠ quality ledger.
- **DES-G** — external tools (MCPs/plugins) deferred to W3+; the loop must first prove
  itself on agent-browser + existing rendering.
- **DES-H** — REQ-01 requires two external blind evidence streams (designers + users).

## 4.2 Superseded record (LOCKED — do not re-litigate at kickoff)

| # | superseded | replaced by | why |
|---|---|---|---|
| 1 | dense/calm/bold aesthetic charters | interaction theses + IA matrix | styles diverge skins, not concepts |
| 2 | score < 7 → regenerate loop | defect classes; ranking only for comparison | Goodhart: agents chase numbers into safe-average |
| 3 | 90-day trend timer | event-triggered library refresh | fashion cycle ≠ product judgment |
| 4 | HTML variants as normal path | real-stack rule + worktree isolation | chosen design must survive implementation |
| 5 | MCP stack in v1 | W3+, after pilot proves loop | accelerators ≠ differentiating intelligence |
| 6 | critic fixes its own findings (current repo agent) | read-only critic, creation fixes, critic re-verifies | verifier approving its own work = no verification |
| 7 | tier-based device coverage | platform contract | contract > blunt heuristic |
| 8 | tokens only after pick, nothing during | per-variant temp tokens → canonical | consistency during exploration without debt |
| 9 | single mixed external panel | two separate evidence streams | designers and users answer different questions |
| 10 | new spine kind `design.reviewed` | `review.completed {"lens":"design"}` | ADR-0026: vocabulary CLOSED at 18 |
| 11 | trend corpus as system centre | tagged intelligence library | principles compound; galleries don't |
| 12 | string-distance thesis check | IA-difference matrix, ≥3 of 7 differ | words differing ≠ concepts differing |

# PART 5 — HONEST LIMITS (keep these true)
- More agents ≠ taste. Quality comes from: the tagged library, eyes on real pixels,
  and the owner's decision — arc's job is making that taste reusable, enforceable,
  improving.
- Trends inform; the brief decides. A trend enters a product only via a design ADR.
- References are principles, never appearances.
- The system's "world-class" claim is only as good as Stream A + Stream B evidence.
- Do not expand the roster or add tools until Phase 0's receipt is boringly reliable.

---

# KICKOFF PROMPT (paste-ready)

```
/arc-kickoff arc-design "The Designer" — design capability as a first-class arc module (products/design/): brief → explore → critique → decide → learn, with a read-only vision critic, warn-first design gate, and spine receipts.

Ground rules for this kickoff:
- Read docs/strategy/plans/PLAN-design.md FIRST. Its Part 4 decisions (DES-A…DES-H + the 12-row superseded record) are LOCKED — assign ADR numbers from the next free slot, do not re-litigate. Attack the PLAN you produce, not the record.
- Brownfield: run codebase-surveyor (design-reviewer + /arc-design exist under products/qa; review-ledger has an unused design stamp; agent-browser is the eyes).
- OS-track module build inside arc. Phase 0 = the steel thread in §3.2 — build exactly that first.
- Companion inputs: the 4 LexOS design drafts (Lexos repo docs/design/) — the Phase-3 pilot target.
- Appetite: I will give the number (recommendation on file: 5 days → M-tier).
```
