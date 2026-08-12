# ADR 0802 — a job authorizes as `process:<name>`, reusing the closed subject set

**Status:** accepted
**Date:** 2026-08-12
**Product:** `scheduler`
**Reversibility:** one-way
**Revisit trigger:** a third job class appears that is neither a script nor an engine process, or job count passes ~8 and the per-job process stub becomes ceremony — either reopens the case for a dedicated `job:` subject class.

## Context

`PLAN-scheduler.md` SCH-B gives every job a mandatory `policy_kind` field which "must name a
kind present in the LIVE `hq.policy.yaml`", and SCH-G requires the wrapper to authorize every
job through the shared POL-D library. Its worked example uses `report.compile`, `ledger.seal`
and `ops.probe`, described as placeholders to be "aligned at Phase 0".

They cannot be aligned, because they are wrong by **shape**, not by name. Verified against the
live engine:

- `hq.policy.yaml`'s `kinds:` map is a **subject** set, not an action-kind set. Its four live
  entries are `session:interactive`, `process:kickoff-plan`, `process:review-diff`,
  `process:commit-msg-draft`.
- `authorizeAction({ kind, capability, resource })` takes `kind` = the subject and `capability`
  from a fixed set of eight (read · write · shell · network · message · publish · deploy ·
  spend). A dotted `report.compile` is neither.
- `lib/policy/lint.mjs:123-127` enforces a **closed subject set** per ADR-0504: a kind is
  exactly `session:interactive`, or `process:NAME` where NAME is the filename stem of an
  existing `processes/*.process.yaml` — *"the subject set is a directory listing, not an
  invention"*. A `job:brief-materialize` row fails the validator outright.
- Deny-by-default (POL-B) makes an absent kind read-only at L1 and L0 for everything else, and
  `authorizeRun` blocks a run that declares an L0 capability. Both v1 jobs write. So with no
  row, **both v1 jobs are blocked** — the feature does not work at all.

`hq.policy.yaml` is on `ungrantable_resources` (ADR-0502) *and* in `.claude/settings.json`'s
`permissions.deny` block. No agent can edit it. Whichever option is chosen, the rows arrive as
an owner-applied file — the same shape as policy Phase 04's three settings edits, whose own
lesson was that the workable form is a complete generated file to copy, not a diff to apply.

## Options considered

1. **`process:<job>` — give each job a `processes/<job>.process.yaml` stub** — pros: zero
   policy-engine change; validator passes because the subject resolves to a real file;
   `declaredCapabilities(doc)` already reads `doc.tools`, so each job declares `fs.read` /
   `fs.write` and gets real intersection enforcement for free; one owner paste. Cons: each job
   becomes nominally reachable as `arc-run --process <job>`, which is a confusion surface.
2. **A new `job:` subject class** — pros: architecturally honest; no manual-run surface. Cons:
   amends ADR-0504's closed set and edits `lint.mjs` + `subjects.mjs`, both agent-denied, so it
   costs three owner pastes plus a re-run of policy's 64-row hostile corpus to prove the wider
   rule opened no hole; reopens a CLOSED lane; does not fit a 3-day appetite.
3. **Run jobs under `session:interactive`** — pros: costs nothing. Cons: an unattended
   scheduled job is precisely not an interactive session, and that subject's write roots
   (`initiatives/** docs/** tests/**`) do not cover `.claude/state/hq/briefs/**` anyway.

## Decision

**Option 1, chosen by the owner at kickoff on 2026-08-12.** Each v1 job ships a
`processes/<job>.process.yaml` stub declaring only the tools it uses, and a matching
`kinds: process:<job>` row in `hq.policy.yaml` applied by the owner.

The reason that carried the most weight: option 1 is the only one that is already in-model.
`kickoff-lint`'s own `[birth-rule]` check exists to warn when a process file lands **without** a
policy row — the relation this option satisfies by construction. It buys a real capability
intersection for two jobs at the cost of one paste, and leaves the cleaner subject class
available later when job volume justifies it.

The manual-run confusion surface is closed by a guard: a job stub carries `job_stub: true`, and
`arc-run` reads it on the entry-resolution path it already has, refusing with a non-zero exit
before any driver is selected. Fixtures prove both directions — a stub is refused, the three real
processes still run.

**That guard is a change to engine code, and this plan's first draft forbade all engine code
while making the guard a Phase-0 exit criterion.** The contradiction was found by the kickoff
attack panel, not by its author. It is resolved by naming the exception rather than by dropping
either half: PLAN § Current state now carries one scoped engine exception — this check and
nothing else — and SCH-K's `--actor` passthrough stays deferred.

**Evidence:** `hq.policy.yaml` lines 96-147 (live subject set); `lib/policy/authorize.mjs:182`
(`authorizeAction` signature) and `:265` (L1 → `propose`, so `mayExecute` is false);
`lib/policy/reduce.mjs` `resolveEffectivePolicy` (`cap = BIRTH_CAP`, `effective =
min(ceiling, cap)`); `lib/policy/lint.mjs:123-127` (closed subject set, ADR-0504);
`lib/policy/run-gate.mjs:318-334` (a run is blocked only on an L0 denial — requiring `execute`
"would deny every run in the repo"); `lib/policy/subjects.mjs` (subject = filename stem);
`.claude/settings.json:42-47` (`hq.policy.yaml` and `lib/policy/**` denied to agents). All read
2026-08-12.
**Confidence:** high
**Rejected because:** option 2 — three owner pastes plus a policy-engine change and a hostile-corpus
re-run do not fit the appetite; option 3 — misdescribes an unattended job as an interactive
session and does not reach the needed write root regardless.

## Consequences

**Easier.** Zero policy-engine code changes; the policy lane stays CLOSED. Each job's
capabilities are declared in one file and enforced by machinery that is already adversarially
proven, rather than by a second interpretation written in this lane.

**Harder — the honest half.** Two `processes/*.process.yaml` files now exist that are not
engine processes, in a directory the engine lane owns. The guard that stops `arc-run` executing
them is new code whose absence would be silent, so it is a Phase-0 exit criterion with its own
fixture rather than a note. And the schema field keeps the name `policy_kind` while its value
is now a subject — `jobs-lint` validates it against the live subject set, so a wrong value
fails at commit time rather than at 06:00.

**What we would revisit if this goes wrong.** If the `arc-run` refusal guard proves leaky under
the adversarial pass, option 2 becomes the cheaper answer and the stubs are deleted rather than
patched — a leaky guard on an execution path is not worth defending twice.
