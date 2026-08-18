# Phase 08 / REQ-07 — the three real dispatches, 2026-08-18

The clause named **uncuttable** at kickoff: *"the process runs through the runtime ≥3 times on arc's
own build-out journey, with `run.completed` receipts confirmed present in `.claude/state/hq/events/`
and absent from `_quarantine/`."*

Three dispatches issued, from the **main clone** (a worktree cannot emit to the spine), against the
owner-approved pack, on the **confined** network. All three receipts landed. None quarantined.

## The invocation

```
node .claude/scripts/engine/arc-run.mjs \
  --process build-in-public-draft --driver hermes --budget min=10 \
  --input @{pack_ref: "pack-2026-08-18-cycle7", pack: <5,086 bytes of pack CONTENT>}

  ARC_HERMES_IMAGE    nousresearch/hermes-agent@sha256:16788311e2fa…3712c9e
  ARC_HERMES_DATA     a template carrying config.yaml, provider `openrouter`,
                      model `poolside/laguna-s-2.1:free`, `_config_version: 12`
  ARC_HERMES_NETWORK  arc-egress          (internal, via egress-session.sh up)
  ARC_HERMES_PROXY    http://arc-eproxy:3128
  ARC_HERMES_EGRESS   engine/egress-allowlist.txt   (one entry: openrouter.ai:443)
```

The pack arrives as **content**, not as a reference, so REQ-06's data boundary scans what is
actually leaving rather than a twenty-five-character id.

## The three receipts

| # | receipt | outcome | attempts | wall | proposal |
|---|---|---|---|---|---|
| 1 | `01M0ASG8YDJA8SBYTAHWE3VJHN` | `fail` / `schema` | 2 | 216,737 ms | `01M0ASG8JG8X6PQ0045MJ6TY8Q` |
| 2 | `01M0ASSNJB1EM9NR4J2SD0XJHR` | `fail` / `schema` | 2 | 306,974 ms | `01M0ASSN5SYARR7RJYRBSPN089` |
| 3 | `01M0ASY9CE73D7ES4XNRT4PM9H` | `fail` / `driver` | 2 | 150,503 ms | — |

Every one carries `runtime: hermes@sha256:16788311e2fa+cfg.e4c4ccd145d0`. **That is the CONFINED
config hash** — the same value fixture 7 recorded, and distinct from the unconfined
`cfg.9c642d0847ca`. The receipts prove the posture rather than asserting it.

Quarantine checked per id: **none present**.

## The honest result: three receipts, zero usable drafts

Runs 1 and 2 produced JSON the schema refused — `$.draft: required property is absent` — on the
first attempt AND on ADR-0204's single same-tier retry, after which the ladder stopped and recorded
a tier-change **proposal**. Nothing escalated itself; acting on either proposal means editing
`engine/router.yaml` in a reviewed diff citing ADR-0069. That is the ladder behaving exactly as
designed, on the real path, twice.

Run 3 never produced parseable JSON at all. Its last lines name the cause and they are the finding:

```
⚠️ File-mutation verifier: 2 file(s) were NOT modified this turn despite any wording above
that may suggest otherwise. … • /tmp/build-in-public-draft-cyc…
```

**The runtime tried to WRITE THE DRAFT TO A FILE instead of returning it.** It is an agent, and its
instinct on an authoring task is to do the work in the filesystem and then report on the filesystem.
The `-z` flag makes the session headless; it does not make it single-turn or tool-free. The prior
`commit-msg-draft` transcript shows the same shape from the other side — the runtime asked
clarifying questions and offered to answer *once you provide this information*.

So the confound named three sessions ago in `runtime-answer-reliability.md` is now measured on the
**hosted** model as well, and it is not the model being small: it is an agentic runtime being asked
for a one-shot document. The parser was never the problem, and this time neither was the model tier.

**REQ-07's verdict arm is capability-gap and was waived in writing before any of this ran.** The DoD
says *"win, lose or split, the receipt is the deliverable"*. Three receipts, three measured
outcomes, zero fabrication.

## What this run also measured, and did not go looking for

**THE USAGE REPORT WAS WRITTEN AND READ.** All three receipts carry
`model: poolside/laguna-s-2.1:free` with `model_source: runtime`. That value has exactly one source
in the code: `cost.model`, and `cost` is only constructed inside the block that reads a **fresh
usage report from the workspace**. So `hermes --usage-file` wrote a report on these runs, carrying a
grammar-valid model id — but no token counts, since no cost fields reached the receipts.

ADR-0221 shipped that reader as *"fail-safe plumbing, and NOT claimed to work against the real
runtime"*. On the real path it fired and filled the seat. **The ADR's clause 4 is therefore
partially falsified and needs an amendment** rather than a quiet edit.

**And the probe written to announce that day could not announce it.** `tests/engine-usage-flag-probe.mjs`
was run immediately afterwards and returned:

```
SKIP engine-usage-flag-probe -- the runtime exited 1, so the "written even when the run fails"
clause is the only one in play and this probe does not test it
```

A probe that skips on the exact condition under which the file appears cannot go red the day it
appears. That is the same defect class the DoD contrasted it against — `bench-steel-probe.mjs`
staying green through the change it existed to announce — arriving by a different route.

**What is NOT established: the trigger.** Two direct container probes were run to isolate it and
both produced no file — a successful trivial one-shot (`{"ok": true}`, exit 0), and a failing one
(HTTP 401 on a bogus key). The three dispatches that DID produce a report were long agentic sessions
(150–307 s) with real tool use. The plausible reading is that the report is written when a session
does substantial work, and that this is what "one report in five runs" was recording all along — but
that is a hypothesis with two negative results behind it, not a measurement, and it is written here
as such.

## What this run did NOT produce, and why that is a miss

**No scrubbed transcript was stored for any of the three dispatches.** `storeTranscript` is opt-in on
`ARC_RUN_TRANSCRIPT_DIR` (deliberately, since arc-run belongs to no lane), and the dispatch script
did not set it. REQ-03 requires a scrubbed transcript per dispatch at
`initiatives/engine/evidence/phase-NN/`, so three dispatches went past that requirement with the
storage half armed and unused.

The cost is concrete rather than procedural: runs 1 and 2 returned JSON that was *close* — a JSON
object the schema rejected for one missing property — and **the exact shape the runtime returned is
now unrecoverable**. That is the one artifact which would have said whether the fix is a prompt
change, a schema change, or neither. The workspaces are swept and nothing else kept it.

## The approval is spent

ADR-0214 / REQ-06: one approval covers **N dispatches with N declared at approval**. This pack was
approved `external-ok, N=3` (`decision.recorded 01M08SST2T0Z5PJ6XCTAGWXKGW` deciding
`approval.requested 01M08QMQYA2N0JVNJAV2M50ZM7`). Three were issued. **A fourth dispatch against this
pack would exceed the terms the owner approved**, so no retry was attempted — the boundary is the
point of the mechanism, and spending it quietly would make the count decorative.

A retry needs a new pack approval. It also needs the transcript directory set, and it should carry a
process-body change telling the runtime not to write files — both of which are engine work, and
neither of which was in scope while the approval had already been spent.
