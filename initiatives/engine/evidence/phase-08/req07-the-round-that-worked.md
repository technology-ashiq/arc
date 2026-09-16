# REQ-07 — three real dispatches, three receipts, three drafts. 2026-08-24

The round the cycle was built for. **Owner-approved, confined, receipted, and it produced usable
drafts** — which the 2026-08-18 round did not.

## The approval, first, because the round is bounded by it

```
approval.requested  01M0QZ9Q76FQCW0DR640JG7ZW5   pack-2026-08-23-cycle7, external-ok, n: 3
decision.recorded   01M0QZCWNN43RPHRCGNRRAZ3MX   verdict: approve, reason: "external-ok, N=3"
                                                  decides: 01M0QZ9Q76FQCW0DR640JG7ZW5
```

**Three dispatches were approved and exactly three were issued.** A fourth would exceed the terms
the owner set, and spending it quietly would make the count decorative — which is the same reason
the 2026-08-18 round stopped at three and did not retry when its drafts came back empty.

The `decision.recorded` names the request it decides, and `decides` must be a real ULID or the
receipt quarantines silently. Both were read back off the spine rather than trusted from an exit
code.

## The three runs

| # | receipt | outcome | attempts | wall | model |
|---|---|---|---|---|---|
| 1 | `01M0QZQ1SSKTCHXAZQZ5WGG917` | **ok** | 1 | 40,715 ms | `poolside/laguna-s-2.1:free` |
| 2 | `01M0QZSMMXZ0G4K4WPACMMHP4P` | **ok** | 1 | 35,770 ms | `poolside/laguna-s-2.1:free` |
| 3 | `01M0QZV7A96F29EBR0MMY51SZ1` | **ok** | 1 | 38,941 ms | `poolside/laguna-s-2.1:free` |

**Counted from the SPINE, never from the suite:** three `run.completed` for
`build-in-public-draft@1.0.0` in `.claude/state/hq/events/2026-08-24.jsonl`, and **zero** anywhere in
`_quarantine/` — the newest quarantine file is dated 2026-08-19 and mentions this process nowhere.

**One attempt each.** The 2026-08-18 round took two attempts per dispatch and ended on
`$.draft: required property is absent` every time, because `drivers/hermes.mjs` sent the runtime a
process name and the input JSON and never the process brief. With the brief arriving, the ladder was
not needed once.

**The model seat is measured, not asserted.** `model: poolside/laguna-s-2.1:free` with
`model_source: runtime` and `runtime: hermes@sha256:16788311e2fa+cfg…` — ADR-0221's identity field
populated on every receipt, from the usage report the vendor flag was once pinned as never writing.

## The posture

Confined, on the certified path rather than a convenient one:

```
network   arc-egress            (--internal; no gateway, no route out except through the sidecar)
proxy     http://arc-eproxy:3128
allowlist engine/egress-allowlist.txt -- ONE entry: openrouter.ai:443
image     nousresearch/hermes-agent@sha256:16788311e2fa…3712c9e   (pinned by digest, verified present)
home      a PRIVATE copy per dispatch (ADR-0222)
```

`egress-session.sh up` before the round and `down` after — the driver never creates networks,
because a driver that did would be arc taking on infrastructure it cannot clean up after a SIGKILL.

## The transcript half, earning its keep on the first round it applies to

**Three transcripts, stored automatically**, 2,678 bytes for the first. This is the Phase 06 fix
working on the first real dispatch that ran after it: the 2026-08-18 round lost its transcripts
because storage was opt-in and the dispatch script did not set the flag, and the near-miss JSON
shape from that round is still unrecoverable as a result.

Both streams are stored and labelled, so the draft itself is in the trail rather than only the
runtime's chatter — which matters here, because the answer IS the artifact under review.

## The drafts

Stored at `evidence/phase-08/drafts/`, one file per receipt, secret-scanned.

| # | chars | sources it cited |
|---|---|---|
| 1 | 443 | `#ci-killed-three-of-my-own-assertions` |
| 2 | 461 | `#ci-killed-three-of-my-own-assertions`, `#the-test-that-was-green-because-it-was-reading-our-own-banner` |
| 3 | 542 | `# ci-killed-three-of-my-own-assertions` |

**All three chose the same angle, and that is a finding rather than a defect.** The pack carried five
entries and bounds the DATA, not the take (ADR-0218); the runtime picked the CI entry every time.
Whether that is the strongest entry or the most recent one is not answerable from three runs, and it
is written down here rather than guessed at.

**One small inconsistency, recorded because a citation is a join key:** draft 3 cites
`# ci-killed-…` with a space after the hash, where 1 and 2 do not. The output schema requires a
non-empty string and nothing more, so nothing rejected it — a citation format nobody validates is a
join that will not join.

## What was CUT, and stays cut

The **hand-written results table summarising the runs and their verdicts** was cut on 2026-08-16 in
the scope-cut conversation, and the **fourth and later dispatches** with it. This file records what
happened; it is not that table, and no verdict summary is written here. *Win, lose or split, the
receipt is the deliverable.*

## The verdict arm

**Capability-gap, and honestly waived in one line:** no current driver runs this class as a process,
so a paired baseline is impossible rather than merely absent. That waiver is in the process file
itself (`baseline: waived: capability-gap`), enforced by `process-lint` with a closed reason, a real
sentence and a date — the gate was extended to accept it precisely because the only compliant
alternative was a fabricated pin.

Per-draft verdicts are the owner's: `judge: ashiq` on the router row, accept/reject plus one line,
never a line-edit (ADR-0218). **Publishing is a human copying it out** — the L1-drafts ceiling is
absolute and nothing here is published.

## The verdict requests, and three older ones that should be closed

Three `approval.requested` receipts are on the spine and open in the inbox, one per draft:

```
01M0QZZSF8EBPFA7MGBB8CKFG9   draft #1
01M0QZZTBHYV7RA6QA8X588JKT   draft #2
01M0QZZV1KRAP616ZH86CS2WZ4   draft #3
```

Each carries the draft text and the sources it cited, so the verdict is made against the artifact
rather than against a reference to it — the same reason REQ-06 inlines the pack instead of passing a
`pack_ref`.

**And the inbox is carrying three verdict requests from the 2026-08-18 round** — `01M0B663APQMV49EQR9AGR1WJQ`,
`01M0B6642HPE0S3PJ6DDF76CVV`, `01M0B664M83R2SFF29SD3BXBSE` — for drafts that were never produced. They
are questions with no artifact behind them, and they have sat open for six days. Recorded here rather
than quietly reused: an inbox that accumulates unanswerable items is an inbox people stop reading,
which is the failure ADR-0216's idempotent-proposal rule exists to prevent one queue over.

**Four `engine-escalation` proposals from that round are open too**, the rung-2 receipts from its
schema failures. Those are the ladder working; they are named here so the count is understood rather
than discovered.
