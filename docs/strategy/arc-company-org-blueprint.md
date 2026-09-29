# arc — Company Org Blueprint (roles → modules)

> 2026-07-25. **Strategy lens, not a plan.** This doc answers one question: *if arc is a
> company, who works here?* It maps a full ~50-role SaaS-company org chart onto arc's
> actual modules — what exists, what's planned (briefs), what's missing, and what stays
> human forever. It supersedes nothing and schedules nothing; `plans/README.md` still owns
> ordering and triggers. Companion additions landed with it: `plans/BRIEF-legal-pack.md`
> (new) + scope notes in BRIEF-growth / BRIEF-leads / BRIEF-ledger (v1.1 lines).
> Grounding: repo audit of this date + 2026 external evidence (§7).

---

## 1. The honest frame

A 100%-autonomous company does not exist in mid-2026. The achievable, evidence-backed
target — already stated in `records/arc-money-engine-plan.md` §2 — is:

> **~85–90% of execution automated; the human CEO spends 30–60 min/day on approvals,
> kill calls, taste, and everything that touches money, accounts, or law.**

What the 2026 evidence says agents can actually hold, per function:

| Function | Autonomy reality (mid-2026) | Anchor evidence |
|---|---|---|
| Coding / build | Strongest (~65% SWE-bench class; Devin ~$492M ARR) | Cognition 2026 |
| Customer support | Strong PMF, but real resolution 45–53% (marketed ~65%) | Sierra ~$200M ARR · Intercom Fin production data |
| Content / SEO | Strong, with a human quality gate | industry-wide |
| General office tasks | ~30% full completion — the ceiling is real | CMU TheAgentCompany |
| Outbound sales (full-auto SDR) | Failed as a category (11x; Artisan pivoted to human-in-loop) | 2025-26 postmortems |
| Closing, pricing, legal, ad spend, banking/KYC | Human only | consensus + liability |

Design consequence: **build + content + support are the autonomous core; sell + decide +
own are human-gated.** arc's WARN-first / trial-ledger / approval-inbox culture already
implements exactly this split — the org below assumes it everywhere.

## 2. Snapshot — what the company has today (audit 2026-07-25)

| Layer | Contents | State |
|---|---|---|
| Governance | Constitution **adopted v1.0** (2026-08-06, hash-pinned receipt) · council (12 jurors + verifier + cross-model juror, SHA-256-bound) · Brier calibration scripts · approval inbox | Design world-class; **calibration data = 0** |
| Factory | kickoff v3.5 · 22 commands · 23 agents · attack panel · simulation gate · phase-done evidence · retro · trial-ledger · 334 bats · 3-OS CI | The build problem is solved |
| Security | arc-scan (semgrep/codeql/gitleaks/trivy/trufflehog/zap) · rls-gate · guard hooks | Enterprise-grade for a solo shop |
| HQ | Receipt spine live (Phase-04 dogfood) · brief · inbox · revenue ingest (simulated) | Mechanism proven, live value pending |
| **Operator layer** | `seo-article-writer` — one ~25-line skill. That is the entire staff of marketing, sales, and support. | **The gap this lens exposes** |
| Strategy shelf | 4 full PLANs + 13 BRIEFs, each with a paste-ready kickoff prompt | Ready, trigger-gated |

One line: world-class **management, engineering, and governance**; the **operator
departments have zero employees** — by design (pull-triggers), but the org view makes the
imbalance visible.

## 3. Flagship grades (kept honest)

- **arc-council — 8.5/10.** Mechanically-enforced honesty (POINT-ID grading, one-round
  rebuttal, no-rubber-stamp lint, cross-model juror byte-binding, append-only outcomes +
  Brier) is ahead of every public framework checked. Holding it back: zero scored
  verdicts (session-001 retrofit pending → the calibration flywheel has never turned),
  juror covered 3/17 points in its one live run, cost knob is all-or-nothing.
- **arc-kickoff v3.5 — 9/10.** Appetite→tier derivation, kill tripwires, ADR
  reversibility + revisit triggers, adversarial attack panel, simulation gate,
  deterministic lint, slopsquatting check — benchmarked against GSD/superpowers/gstack
  (planner-bench). Holding it back: 7 substance gates still WARN-trial (promotion via
  retro only).
- Shared verdict: the **code is world-best; the receipts of use are not yet** — scored
  council verdicts and promoted gates are what turn both into claimable products. Moat =
  accumulated calibration data, not the scripts.

## 4. The full org chart — moved to the generated chart

**This section is now generated.** The hand-kept chart that stood here (about 50 roles in 9 departments, a
snapshot dated 2026-07-25) went stale within a week. The 2026-08-03 audit found four departments marked
EXISTS with no row behind them. It is replaced by **`org/CHART.md`**, which
`.claude/scripts/org/org-catalog.mjs --chart` renders from one role card per job under `org/roles/`.
That chart has 71 roles in 10 departments, and every count is derived from the cards. `org-coverage` fails CI
when a card and the tree disagree (org lane, ADR-1602 / ADR-1610). The old table is in git history at
this file's revisions before 2026-09-30. The rest of this blueprint (§1–3 and §5–7) stays as the reasoning record.

## 5. The shape rule — roles are a catalog, not headcount

Do **not** build ~50 standing agents. The 2026 failure math: multi-agent systems burn
~15× single-chat tokens (Anthropic's own numbers); at 90% per-step reliability a 5-step
chain succeeds 59% of the time; parallel writers fragment context (Cognition). The
consensus that works — and that arc already embodies — is **workflows with agentic
steps**: fan out only for read-heavy parallel work (research, attack panels, review),
keep writing/coding single-threaded.

| Company concept | arc equivalent |
|---|---|
| Department | a module/workflow (growth, ops, leads, ledger…) |
| Employee | an **on-demand spawned agent** — exists for the task, then gone |
| Job description | `.claude/agents/*.md` + skills (catalog, not headcount) |
| Manager / standup | spine + `arc brief` + inbox |
| HR & performance review | trial-ledger + retro + autonomy ladder (L0→L3) |
| Hiring | `sync-to-project` install |
| Salary / budget | token-cost caps (REQ-08, when revived) |
| Promotion | WARN→FAIL, L1→L2 on evidence (e.g. 20 unedited approvals) |
| Firing | attic + kill criteria |
| Board | council + Constitution |
| CEO | Ashiq — 30–60 min/day |

## 6. What this lens changed (and deliberately didn't)

**Landed with this doc (docs-only; every build still waits for its trigger):**
1. `plans/BRIEF-legal-pack.md` — new. Customer-facing legal pages per venture (role #51).
2. BRIEF-growth v1.1 — lifecycle-email scope + brand-kit one-shot (roles #27, #33, #46).
3. BRIEF-leads v1.1 — pipeline receipt kinds flagged as an ADR at its kickoff (role #41).
4. BRIEF-ledger v1.1 — named as where REQ-08 "agent payroll" revives (role #49).

**Standing retro-agenda items (no new module needed):**
- Adopt the Constitution (first `constitution.adopted` event).
- Sanction the council session-001 retrofit — the calibration flywheel starts there.
- Start the build-in-public habit (§12.4) — one honest post per phase close.

**Explicitly NOT building (this lens found no reason to change course):**
- No standing agent org-chart; no autonomous SDR; no ads engineer before ₹25k MRR and a
  human-held ad account; trader stays last and never load-bearing; no department is built
  before a venture pulls it. **Customer #1 outranks every row in §4.**

## 7. External evidence (checked 2026-07-25)

- TheAgentCompany (CMU) — agents ~30% full completion on office tasks: arxiv.org/abs/2412.14161
- OpenAI GDPval — near expert-parity on deliverable-style tasks, ~100× faster/cheaper: openai.com/index/gdpval
- Anthropic, multi-agent research system — orchestrator-worker wins for parallel research at ~15× token cost: anthropic.com/engineering/multi-agent-research-system
- Cognition — "Don't Build Multi-Agents" (context fragmentation): cognition.com/blog/dont-build-multi-agents
- Sierra ~$200M ARR / Fin real resolution 45–53% / Devin ~$492M ARR / 11x SDR postmortem — support & coding have PMF; full-auto sales does not.

## Provenance

Produced 2026-07-25 in a Cowork session (Ashiq + Claude): repo audit + 2026 research +
the role-catalog exercise. Approved by Ashiq as a docs-only drop (this file + the brief
edits listed in §6). Nothing here changes code, gates, or ordering by itself; every
module still enters through its trigger → `/arc-kickoff` → review → explicit approval.
