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
| Governance | Constitution draft · council (12 jurors + verifier + cross-model juror, SHA-256-bound) · Brier calibration scripts · approval inbox | Design world-class; **calibration data = 0** |
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

## 4. The full org chart — ~50 roles, 9 departments

Legend: **EXISTS** (live in repo) · **PLANNED** (a brief/plan owns it) · **MISSING** (no
owner yet) · **HUMAN** (deliberately never automated).

### A. Board & governance
| # | Role | arc seat | State |
|---|---|---|---|
| 1 | Board of directors | `/arc-council` (stances + experts + verifier + juror) | EXISTS |
| 2 | Constitution / charter | `arc-CONSTITUTION-draft.md` (adoption pending) | EXISTS (draft) |
| 3 | Internal auditor | spine gap-audit + evidence bundles | EXISTS |
| 4 | Calibration keeper | council-calibrate + Brier scoreboard | EXISTS — data 0 |

### B. CEO office
| # | Role | arc seat | State |
|---|---|---|---|
| 5 | CEO — vision, kill calls, taste, accounts, money | Ashiq | HUMAN (permanent) |
| 6 | Chief of staff — the day in one screen | `arc brief` + inbox | EXISTS |
| 7 | EA / scheduler | BRIEF-scheduler (policy engine is prereq) | PLANNED |
| 8 | Strategy analyst | council + this strategy pack | EXISTS |

### C. Product
| # | Role | arc seat | State |
|---|---|---|---|
| 9 | Product manager | `/arc-kickoff` + question-planner | EXISTS |
| 10 | Business analyst (premise check) | product-challenger | EXISTS |
| 11 | Market researcher (pain mining) | PLAN-discover | PLANNED |
| 12 | Competitive intel | discover competitor-mode (complaint mining) | PLANNED |
| 13 | UX researcher (stranger tests) | manual 3-stranger check | HUMAN (right call at this scale) |
| 14 | Pricing analyst | V-B ADR, human until customer #10 | HUMAN (for now) |
| 15 | Technical writer (user docs/FAQ) | dev docs exist; user-facing manual in Cycle-3 | PLANNED (partial) |

### D. Engineering
| # | Role | arc seat | State |
|---|---|---|---|
| 16 | Architect | kickoff ADR flow + council-engineer | EXISTS |
| 17 | Developers | Claude Code main loop + factory | EXISTS |
| 18 | Code reviewer | code-reviewer + review ledger | EXISTS |
| 19 | QA engineer | qa-tester (real browser + axe + vitals) | EXISTS |
| 20 | Security engineer | security-auditor + arc-scan | EXISTS |
| 21 | DevOps / release | ship + deploy-guard + canary | EXISTS |
| 22 | SRE / monitoring | BRIEF-ops (scheduled sweep + health report) | PLANNED |
| 23 | Data engineer (analytics wiring) | per-venture manual (Cycle-3 REQ-05) | MISSING (acceptably) |
| 24 | Performance engineer | vitals/lighthouse inside qa-tester | EXISTS (partial) |

### E. Design
| # | Role | arc seat | State |
|---|---|---|---|
| 25 | Design reviewer | design-reviewer (score ≥8 gate) | EXISTS |
| 26 | UI designer (generation) | ad-hoc via tools; review is gated, generation isn't | PLANNED (loose) |
| 27 | Brand designer (logo/OG/palette) | brand-kit one-shot → BRIEF-growth v1.1 | PLANNED (new) |
| 28 | Video / creative producer | BRIEF-growth video pipeline | PLANNED |

### F. Marketing / growth
| # | Role | arc seat | State |
|---|---|---|---|
| 29 | Head of growth | BRIEF-growth | PLANNED |
| 30 | SEO specialist | seo-article-writer (basic; programmatic upgrade at growth v1) | EXISTS (v0) |
| 31 | Content editor / quality gate | growth slop-lint (WARN-first) | PLANNED |
| 32 | Build-in-public / social | master plan §12.4 — **unstarted, free, compounds** | MISSING |
| 33 | Email / lifecycle marketing | lifecycle scope → BRIEF-growth v1.1 | PLANNED (new) |
| 34 | Performance ads | deferred; ad spend is forever-human | HUMAN (deliberate) |
| 35 | PR / launch manager | Cycle-3 launch-week playbook (5 channels) | EXISTS (manual playbook) |
| 36 | Community manager | — | MISSING (post-customers) |
| 37 | Marketing analyst (funnel) | REQ-05 counts now; ledger later | PLANNED |

### G. Sales
| # | Role | arc seat | State |
|---|---|---|---|
| 38 | SDR (outbound, capped, personalized) | BRIEF-leads — L1 draft-approve | PLANNED |
| 39 | Account executive (closing) | Ashiq — trust lands on humans | HUMAN |
| 40 | Sales engineer (demos/technical) | product + docs + FAQ | PLANNED (indirect) |
| 41 | RevOps / CRM (pipeline truth) | pipeline receipt kinds → ADR at leads kickoff | MISSING (ADR queued) |
| 42 | Partnerships / BD | — | MISSING (post-₹25k MRR) |

### H. Support / success
| # | Role | arc seat | State |
|---|---|---|---|
| 43 | Support L1 (triage + drafts) | BRIEF-ops; expect 45–55% honest auto-resolution | PLANNED |
| 44 | Support L2 (bug → fix → ship) | the factory itself (fix-issue → review → ship) | EXISTS (a real strength) |
| 45 | KB / FAQ writer | Cycle-3 REQ + generator later | PLANNED (partial) |
| 46 | Onboarding / activation | lifecycle scope → BRIEF-growth v1.1 | PLANNED (new) |
| 47 | Retention / churn analyst | BRIEF-ledger (churn views) | PLANNED |

### I. Finance / legal / HR
| # | Role | arc seat | State |
|---|---|---|---|
| 48 | Bookkeeper / P&L | BRIEF-ledger; `revenue.received` ingest already live | PLANNED (mechanism EXISTS) |
| 49 | Cost accountant ("agent payroll") | REQ-08 (cut in Cycle 2) revives in BRIEF-ledger v1.1 | PLANNED (deferred) |
| 50 | Tax / compliance | MoR route (Paddle/Dodo/Creem) + Razorpay domestic | EXISTS (decision) |
| 51 | Legal (ToS / privacy / refunds) | **BRIEF-legal-pack (new)** | PLANNED (new) |
| 52 | Policy / risk officer | BRIEF-policy (capability vectors) + Constitution | PLANNED + EXISTS |
| 53 | HR — performance, promotion, firing | trial-ledger + retro + autonomy ladder + attic | EXISTS — **arc's unique organ** |
| 54 | Recruiter (onboarding new roles) | sync-to-project + skill authoring | EXISTS (partial) |

**Snapshot:** ~20 EXISTS · ~19 PLANNED · ~10 MISSING (6 of them now have owners via this
drop) · 5 HUMAN by design.

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
