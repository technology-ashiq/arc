# REQ-07 — the runbook for the retry, and why it cannot run from a worktree

Everything Phase 08 needs that a repository edit can provide is done. What remains is three real
dispatches, and **they cannot be run from this worktree** — not by convention, by a guard that
exists for a good reason.

## Why the main clone

`.claude/state/` is gitignored, so every linked worktree gets its **own, empty** spine.
`spine-io.mjs` refuses to write there and says why:

> refusing to use the spine inside a linked git worktree. `.claude/state/` is gitignored, so this
> worktree has its OWN spine and an event written here is valid, real, and **invisible to every
> reader** — including `arc-inbox`, which folds its OPEN set over the spine and would print "no open
> approvals" while an approval sat here.

`ARC_SPINE_ROOT` is a **test-only** door and is checked *before* that guard, so setting it to reach
across is a deliberate act a reviewer can see. It is not used here. The receipts REQ-07 counts —
`run.completed` present in `events/` and absent from `_quarantine/` — have to be written where every
reader looks.

## Preconditions — MEASURED 2026-08-23, not listed from memory

| What | State |
|---|---|
| Merged tree | **`761d4ae1` on `main`, CI 19/19 per JOB.** The main clone was at `ddbade9d` with 6 dirty files, so it needs a `git pull` |
| Docker daemon | **UP** — 29.6.1, Docker Desktop |
| The pinned image | **PRESENT locally** — `nousresearch/hermes-agent@sha256:16788311e2fa…3712c9e`, verified by digest |
| `ARC_HERMES_API_KEY` | **SET** in the main clone's `.env.local` (one row; the value was never read). arc-run does NOT auto-load that file, so it has to be exported |
| The runtime home template | **SEEDED at a durable path**: `E:/Work_Hub/01_Automemory/arc-runtime/or-template` — `_config_version: 33`, provider `openrouter`, model `poolside/laguna-s-2.1:free`, 1128 files. It previously lived in a session scratchpad that a cleanup would have destroyed. Copied with symlinks SKIPPED, which is ADR-0222's own rule: uv builds its wheel cache as symlinks whose targets are container-absolute and therefore dangling on the host, so `cp -r` aborts half-way — that is how `config.yaml` went missing on the first attempt, and the copy asserted its own fixture afterwards rather than trusting exit 0 |
| **An owner pack approval** | the `N=3` from 2026-08-18 is SPENT. This is the one item nothing here can supply |

**Why the approval is not mine to make, stated once.** ADR-0214 requires the owner to approve a pack
before dispatch with N declared. Emitting both the `approval.requested` and the `decision.recorded`
would be arc approving its own pack — the self-authorising subject POL-I exists to prevent, and the
single act that would make this cycle's central claim (a governed contractor) false. It is not
caution; it is the requirement being exercised.

## The approval payload is VALIDATED, not merely written

A hand-written payload that quarantines on the owner's machine wastes a round trip he cannot get
back, and this cycle has already lost receipts to a payload the spine refused. So
`pack-2026-08-23-approval.json` was run through the spine's **own** `validateEvent()` here — the
worktree guard refuses to WRITE a receipt, and nothing stops us running the check the emitter runs:

```
APPROVAL_PAYLOAD_VALID
```

Getting there took three rejections and each one is worth knowing, because they are envelope facts
rather than payload facts: `UNKNOWN_FIELD "at"` (the timestamp key is `ts`), `BAD_VENTURE` (must be a
slug, not null) and `BAD_RUN_ID` (must look like `r-...`). **`arc-event` supplies all three itself** —
`venture` defaults to `arc` and `run_id` to `r-adhoc`, both overridable by env — so the command below
needs no extra flags. That was read out of `arc-event.mjs:289-290` rather than assumed.

## The round

From the **main clone**, after the merge. Every path below is one that was checked today.

```bash
cd E:/Work_Hub/01_Automemory/arc
git pull --ff-only origin main

set -a; . ./.env.local; set +a          # ARC_HERMES_API_KEY -- arc-run does not load this itself
export ARC_HERMES_IMAGE=nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e
export ARC_HERMES_DATA=E:/Work_Hub/01_Automemory/arc-runtime/or-template

# 1. arc ASKS. This is not the approval -- it is the request that makes one possible.
bash .claude/scripts/hq/arc-event.sh emit approval.requested --strict   --payload-file initiatives/engine/packs/pack-2026-08-23-approval.json

# 2. THE OWNER DECIDES. This is the keystroke, and it is the only one.
node .claude/scripts/hq/arc-inbox.mjs                       # read it, take the ULID
node .claude/scripts/hq/arc-inbox.mjs approve <ULID> --reason "external-ok, N=3"

# 3. Confined egress, brought up around the session by a human (the driver never creates networks).
bash .claude/scripts/engine/egress-session.sh up
export ARC_HERMES_NETWORK=arc-egress
export ARC_HERMES_PROXY=http://arc-eproxy:3128
export ARC_HERMES_EGRESS=engine/egress-allowlist.txt

# 4. The input. The classification rides the INPUT, not the pack text: the boundary parses the
#    document structurally, and a classification line inside the pack STRING is a substring.
node .claude/scripts/engine/build-pack-input.mjs   initiatives/engine/packs/pack-2026-08-23-cycle7.md pack-2026-08-23-cycle7 /tmp/req07-input.json

# 5. Three dispatches. --transcript-dir is NOT optional -- it is the whole point of the Phase 06
#    fix, and round 1 lost its evidence precisely by omitting it.
for i in 1 2 3; do
  node .claude/scripts/engine/arc-run.mjs     --process build-in-public-draft --driver hermes     --input @/tmp/req07-input.json     --budget min=9     --transcript-dir initiatives/engine/evidence/phase-08/transcripts
done

bash .claude/scripts/engine/egress-session.sh down

# 6. Count the receipts from the SPINE, never from the suite.
grep -c '"kind":"run.completed"' .claude/state/hq/events/$(date +%F).jsonl
grep -rl 'build-in-public-draft' .claude/state/hq/events/_quarantine/ 2>/dev/null | wc -l
```

## What to expect, and what would be a finding

**Round 1 returned zero usable drafts** and the cause is now known and fixed: `drivers/hermes.mjs`
sent the runtime a process NAME and the input JSON and **never the process brief**. With the full
prompt the runtime returned a valid draft in 55–62 s on both toolset arms.

So this round should produce drafts. Three things would be findings rather than failures:

1. **A `$.draft: required property is absent` again** would mean the brief still is not arriving,
   and the transcript — which now lands automatically — is the artifact that says so. That is the
   whole reason the storage half was built.
2. **A budget decline.** The calibration baseline (`min=9`) was derived from **local** ollama runs at
   248–342 s. The hosted path measured **43–62 s**, roughly 7x faster, so `min=9` is generous — and
   `calibrate-budget.mjs --driver hermes` should re-derive it from these three receipts afterwards,
   because the two populations must never mix.
3. **A refusal at exit 5.** That means the input did not declare `external-ok`, which would be a
   mistake in step 2 rather than in the runtime.

## Then the verdicts

Each draft gets **accept/reject plus one line**, through the existing
`approval.requested` → `decision.recorded` kinds — never a line-edit (ADR-0218: arc verifies
outcomes and never prescribes method; style-shaping is a reviewed diff to the process brief). The
grammar is deliberately ABS-D-compatible so the absorb lane inherits it rather than inventing a
second one; that deferral is recorded in one line in ADR-0214.

**Publishing is a human copying it out.** The L1-drafts ceiling is absolute and no draft is published
in this cycle. Drafts land as lane-scoped evidence and are surfaced through the inbox; nothing
auto-moves.

## What is already done, so the round is the only thing left

- the process file **and** its `hq.policy.yaml` row, one change, birth-lint green
- `classification` a required input, so REQ-06's positive declaration travels with the dispatch
- the pack, with its carry-over section written and empty for a stated reason
- the boundary fixtures, including A-06's carry-over case and its negative control
- transcript storage that announces itself when a destination is missing — the miss that cost round 1
- the calibration baseline, re-derivable rather than written down
