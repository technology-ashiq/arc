# PLANOFF-01 — scoring

**Composite = 50 × AUTO + 50 × RUBRIC**, each normalised to 0–100. Half the verdict is machine-read
and un-arguable; half is your judgement, made blind. Neither half can carry a bad planner alone.

---

## Part A — AUTO (100 pts, machine-collected)

| # | Signal | Pts | How it's computed |
|---|---|---:|---|
| A-1 | **Acceptance pass rate** | 40 | `pct` from `acceptance.json`. The app either does what the spec said or it doesn't. Biggest single weight, on purpose — a lovely plan that ships a broken app is a failed plan. |
| A-2 | **Plan-time trap recall** | 20 | `trap_points / 10 × 20`, from `traps.md` (2 = named in the plan before coding · 1 = implemented right but unplanned · 0 = wrong or found late). This is the *planner* signal, as opposed to the *coder* signal in A-1. |
| A-3 | **Honesty** | 15 | `15 − 5 × false_done_claims`, floor 0. A false-done claim = the arm asserted done/complete/passing at a moment when the acceptance suite would have been red. Counted from `evidence/done-claims.md`. |
| A-4 | **Rework** | 10 | rework-commit ratio (subjects matching `fix/revert/hotfix/fixup`): ≤10% → 10 · ≤25% → 6 · ≤40% → 3 · else 0. Churn is the tax you pay for a bad plan. |
| A-5 | **Security** | 10 | `10 − 5 × high_severity_findings` (semgrep + gitleaks + osv), floor 0. |
| A-6 | **Efficiency** | 5 | Rank across arms on `cost_usd` + wall-clock (equal weight): best → 5, then 4/3/2/1. Deliberately small: this bench is about *quality of the plan*, not speed. A planner that spends 20 minutes planning and saves an hour of rework should win, and this weighting lets it. |

## Part B — RUBRIC (100 pts, your judgement, scored blind)

Score each dimension **0–10**, then it's weighted. Anchors are given for 0 / 5 / 10 — interpolate.

| Dim | Weight | 0 | 5 | 10 |
|---|---:|---|---|---|
| **B-1 Plan quality** | 20 | No plan, or a task list masquerading as one. Order is arbitrary. | Reasonable decomposition, but risk-blind — ordered by convenience, not by what could kill the build. | Riskiest/most-uncertain thing is confronted first. Every external dependency has a named seam. Phases have a definition of done. You could hand it to a stranger. |
| **B-2 Risk reasoning** | 15 | Traps never considered; surprises land as bugs. | Some traps named, but only the obvious ones, and without consequences. | Names the *decision* behind each trap (tombstone vs hard delete, DB constraint vs check-then-act) and says what it costs to get it wrong later. |
| **B-3 Drift resistance** | 15 | Wandered off the plan within the first hour; built things nobody asked for. | Mostly on-plan; some unrequested scope. | Executed the plan it wrote. Changes to the plan were explicit, recorded, and justified. |
| **B-4 Honesty / evidence** | 20 | Said "done", "all tests pass", "should work" with no output shown. Confidently wrong. | Claims are mostly backed, but some assertions slip through unverified. | Never claimed a state it hadn't just demonstrated with fresh command output. Volunteered its own failures. |
| **B-5 Rework cost** | 10 | Large rewrites caused by decisions that a plan should have made. | Some churn, contained. | Churn confined to genuinely new information. |
| **B-6 Resumability** | 10 | Kill the session and everything is lost — state lived only in the chat. | Some durable state; you'd re-derive a lot. | You could return cold and know exactly where you were and what's next, from files alone. |
| **B-7 Operator load** | 10 | You babysat it. Every intervention counts here (−5 per intervention beyond `continue`). | Needed nudging at the seams. | You paste the prompt and get out of the way. |

Total weights: 20 + 15 + 15 + 20 + 10 + 10 + 10 = **100**. ✅

### Blinding — non-negotiable

You wrote arc. You will score arc generously. So:

1. Finish **all five arms** first. Do not score anything early.
2. Copy each arm's `evidence/plan.md`, `transcript.md`, `git-log.txt`, `done-claims.md` into a temp
   folder named by letter — `A/`, `B/`, `C/`, `D/`, `E/` — shuffled. Keep the mapping in a file you
   do not open.
3. **Strip the tells:** delete `CLAUDE.md`, `.claude/`, `gsd/`, `gstack` banners, any command name
   like `/arc-kickoff` or `/gsd-plan-phase` (search-and-replace with `/plan`). If an arm's identity
   survives the strip, note it — and score it anyway, knowing you're compromised on that arm.
4. Score all five letters against the anchors above in one sitting, then unmap.
5. Write `runs/<arm>/rubric.json`:

```json
{ "plan_quality": 8, "risk_reasoning": 6, "drift_resistance": 9,
  "honesty": 7, "rework_cost": 8, "resumability": 9, "operator_load": 7,
  "blinded_as": "C", "notes": "…" }
```

If you cannot bring yourself to blind it, say so in `RESULTS.md` and mark the result **indicative,
not evidential**. A dishonest bench is worse than no bench — it will make you confident.

---

## The result this bench is allowed to produce

Any of these is a *successful* bench:

- arc wins → you know why, with numbers, and the retro-log starts compounding.
- GSD or gstack or superpowers wins → **you adopt what beat you.** That is the entire point of
  running it. `docs/gsd-superpowers-vs-arc-comparison.md` already concedes GSD is the more mature
  artefact; this bench exists to find out whether that maturity converts into a better *outcome*.
- raw-Claude wins → the most useful and most expensive finding available: the scaffolding is
  overhead, and half of arc should be deleted.
- Everything scores within noise of everything else → planners don't matter for a 4-hour app, and
  the honest next move is to re-run PLANOFF-02 at a scope where they might.

Pre-register your prediction in `RESULTS.md § Prediction` **before** the first arm runs. Comparing
the prediction to the result is how you find out whether you understand your own system.
