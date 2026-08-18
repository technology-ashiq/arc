# ADR 0221 — the runtime identity leaves the model seat, and the usage flag that would have filled it does not reliably write

> **AMENDED 2026-08-18 BY ADR-0224 — clause 4 of this ADR is now measurably wrong, and it is flagged
> here rather than only in the amending ADR because a reader who lands on this file alone would act on
> a false claim.** Clause 4 ships the `--usage-file` reader as *"fail-safe plumbing, and NOT claimed
> to work against the real runtime"*. On the real path the reader FIRED: all three REQ-07 dispatches
> filled the model seat with `model_source: runtime`, and a `-t vision` run produced a complete report
> — `input_tokens 2134`, `output_tokens 193`, `api_calls 1`, model present. What is false is the
> **vendor's** documented promise that the report is *"written even when the run fails"*: four of six
> observed runs wrote one, and one that did not was a failing run. The trigger stays unestablished.
> Everything else in this ADR stands, including the seat decision itself.
>
> (This repo does not usually back-annotate an amended ADR — the amending one names its target. The
> exception is made because the stale sentence is not a design preference but a statement of fact
> about the runtime, and a stale copy lies.)

**Status:** accepted
**Date:** 2026-08-16
**Product:** `engine` — Cycle 7, executor v1. Amends ADR-0212, applies ADR-0220's rule. **Clause 4 amended by ADR-0224.**
**Reversibility:** two-way
No schema widens and no event kind is added. The seat value and the payload field are both already-legal shapes; reverting means going back to a seat that quarantines the receipt, which is what ADR-0212 as written produces.
**Revisit trigger:** `hermes --usage-file PATH` starts writing a report reliably, carrying token counts and a model. `tests/engine-usage-flag-probe.mjs` asserts today's behaviour, **goes red on that day, and leaves the file on disk to be read** — at which point the seat can carry a measured model id and clause 4 below is re-decided rather than left as fail-safe plumbing.

Routed via `/arc-change --lane engine` on 2026-08-16.

## Context

Two accepted ADRs of this cycle disagree about one field, and the disagreement was found by a
quarantined receipt rather than by reading them side by side.

**ADR-0212 says the runtime occupies the model seat:** *"MP-F's fingerprint records runtime name +
version + pinned config hash in place of provider/model id"*. Built that way, the seat value was
`hermes@sha256:<digest>+cfg.<hash>` — and the spine's `MODEL_RE`
(`^[A-Za-z0-9][A-Za-z0-9:._/-]{0,127}$`, `validate.mjs:116`) admits neither `@` nor `+`. The first
hermes `run.completed` was **quarantined with `BAD_MODEL` while arc-run reported the run fine.** It
was found by reading the landed file, not the exit code.

**ADR-0220's amendment says the opposite, and gives the reason:** the seat *"stays a clean model
id"* because it answers *which model ran*, and *"encoding a second fact into it forces every reader
to parse a string to get either one — which is exactly how `tier:X` came to assert a routing
decision nothing had applied."* Provenance went to a separate payload field, `model_source`.

ADR-0220 is right, and its rule decides this. What remained open was whether the seat could be
filled *honestly* for a runtime, since arc does not choose the runtime's model.

## The measurement that was supposed to settle it, and what it actually showed

The vendor's `--help`, read off the digest-pinned image rather than the docs site:

```
--usage-file PATH     One-shot mode only: after the run, write a JSON usage
                      report (estimated cost, token counts, model,
                      api_calls) to PATH. The report is written even when
                      the run fails, so pipelines can always account for
                      spend. No effect outside -z/--oneshot.
```

A runtime that reports `model` makes the seat answerable as a **measurement**. That was the plan,
and this ADR was first drafted around it.

**Then the flag was run, five times, and it does not reliably write anything.** Image
`nousresearch/hermes-agent@sha256:16788311e2fa3035456bdc1bafb8ec2b1777db64ebf020af9bb7eb73c3712c9e`,
`Hermes Agent v0.20.0 (2026.8.3)`, 2026-08-16. Every run exited **0**:

| # | Path asked for | Volume | Wall | Report written? |
|---|---|---|---|---|
| 1 | `/opt/data/probe.usage.json` | warm | 129s | **no** |
| 2 | `/tmp/hermes-usage.json` | warm, `--rm` omitted, `docker diff` over the whole container FS | ~130s | **no** |
| 3 | `/opt/data/probe.usage.json` | warm | 78s | **YES — 410 bytes** |
| 4 | `/opt/data/clean.usage.json` | **fresh volume, config only** | 145s | **no** |
| 5 | `/opt/data/keepme.usage.json` | warm | 301s | **no** |

Run 2 is explained and does **not** count as evidence against the flag: the image ships
`HERMES_WRITE_SAFE_ROOT=/opt/data` and denies writes outside it — measured directly, the agent
reporting *"Write denied: … is outside HERMES_WRITE_SAFE_ROOT (/opt/data)"*. A `/tmp` target was
measuring the confinement, not the feature. **That correction is itself a Phase 06 finding:** write
confinement to the mounted volume is real and enforced, which fixture 1 needs.

Runs 1, 4 and 5 asked inside the safe root, succeeded, and produced nothing. Run 3 produced a file
— **and its 410 bytes were destroyed by this probe's own teardown before anyone read them.** So the
one observation that could distinguish *the flag wrote it* from *the agent wrote it, having seen the
filename in its own argv* was thrown away. That is a method failure and it is recorded as one: the
verdict was carried without looking at the artifact, which this repo has already written down twice.
The probe no longer deletes anything.

**What is therefore known:** the flag is documented, is accepted without error, and produced a
report in **one run out of five**, with the provenance of that one report unresolved. That is not a
foundation a receipt field can stand on.

It surfaced only because Phase 04's evidence bundle was audited against its own Verification plan.
The plan required `smoke-usage.json`; the bundle did not have it; the driver comment explaining the
absence read *"No usage flag is passed that has not been verified against the vendor"* — implying
none existed. That comment was false, the flag existed, and the flag then turned out not to work
reliably either. **Sixth false comment this cycle**, and the first whose correction needed
correcting twice.

**A larger finding arrived alongside, and it is not about the flag.** Across those five runs against
`llama3.1:8b`, the same pinned prompt produced: the correct JSON once, a web page title
(*"Example Domain" is the title of the page*), two `write_file`-denied messages, and a bash syntax
error returned as JSON. **The runtime does not reliably honour a one-shot output contract on this
model.** That is REQ-01's parser working perfectly on output that is simply not the answer, and it
is a direct risk to REQ-07's three real runs. It is recorded here because it was measured here;
Phase 06 and Phase 08 inherit it.

## Options considered

1. **Widen `MODEL_RE` to admit `@` and `+`.** Rejected: a spine schema every product shares, changed
   for one driver's string format, legalising exactly the two-facts-in-one-field shape ADR-0220
   diagnosed.
2. **Seat stays `unpinned`; runtime identity moves to its own payload field.**
3. **Fill the seat from the runtime's usage report.** Not available — see above.

## Decision

**Option 2, with option 3 built as fail-safe plumbing that is pinned as inert rather than claimed as working.**

1. **The runtime's identity leaves the seat.** `hermes@sha256:<digest>+cfg.<hash>` becomes its own
   `run.completed` payload field, `runtime`. It is provenance; the seat is a model id; one string
   carrying both is ADR-0220's named defect. This is the part that unquarantines the receipt.

2. **The seat is `unpinned` for a runtime, and that is the honest value.** arc does not choose the
   model, the runtime will not say which it used, and no third party can. Absent beats estimated
   (ADR-0069 b5). A seat reading `unpinned` next to a `runtime` field naming the contractor is a
   receipt that says exactly what is and is not known.

3. **ADR-0212 is amended, not superseded.** Everything else stands: the runtime is a driver class,
   its internal model choice is not a b(1) tier change, the row is a reviewed production routing
   decision, the L1-drafts ceiling, the four mandatory row fields. Only *"in place of
   provider/model id"* is replaced by clauses 1 and 2.

4. **The reader ships, exercised by a fixture and pinned by a probe — never by assertion.**
   `drivers/hermes` passes `--usage-file` and reads the report back if one exists, mapping token
   counts to `source: "measured"` and a grammar-valid `model` to the seat with
   `model_source: "runtime"`. Today that branch cannot fire against the real runtime. Therefore:
   - **it is exercised by a fixture that plants a usage file**, so the code is proven to RUN rather
     than proven to compile — an unexercised branch with a comment claiming it works is the vacuous
     pass this repo keeps paying for;
   - **`tests/engine-usage-flag-probe.mjs` asserts that no report appears on the real image**, so
     the day one does the probe goes **red** and this ADR is revisited. This is deliberately the
     inverse of `bench-steel-probe.mjs`, which stayed green through the very change it was written
     to announce because it pinned a mechanism instead of a conclusion. This probe pins the
     conclusion: *no file appears*. It also **runs against the configured `ARC_HERMES_DATA` volume
     or declines** — an empty volume has no model endpoint, so a probe that made its own would skip
     forever, which is a green tick nobody earned — and it **deletes nothing**, because the one
     report that did appear was destroyed by an earlier version of this same file before it could
     be read.
   - **`model_source: "runtime"` is a real fourth value and is documented as currently unreachable
     in production.** Recording a runtime-reported model as `router` would assert a routing decision
     nothing applied; the value exists so that mistake is not available later.

5. **Tokens would be measured; the estimated cost never is.** If a report ever lands, its token
   counts are `source: "measured"` and its **`estimated cost` is never written to a cost field** —
   REQ-05 says provider-reported or absent, and a runtime's own estimate is neither.

6. **Precedence, so a driver can never rewrite routing.** A routed pin and a `--trial-model`
   override both win over a runtime-reported model. The reported value only ever fills a seat that
   would otherwise be empty — and a runtime row carries no `models:` entry anyway (ADR-0217).

## Consequences

- Every hermes `run.completed` carries `runtime`, and a seat of `unpinned`. Readers that expected
  the identity in the seat must read the new field. Nothing is quarantined.
- `model_source` gains a value that no production run can currently produce. That is written down
  here rather than discovered by someone grepping for it.
- **Phase 04's evidence bundle cannot contain `smoke-usage.json` and must say why.** It is recorded
  as a named absence with these four probes attached, not quietly dropped from the expected list.
- The cost sidecar gains two optional keys (`model`, `runtime`) as the driver→arc-run channel. The
  `model` key `produce()` already returned was **dead**: the shared caller destructures
  `{ output, cost }` and discards the rest, so `drivers/hermes` has been returning a model nothing
  read since it was written. Seventh dead assertion this cycle.

**Evidence:** vendor `--help` and the five runs tabulated above, against `sha256:16788311e2fa…3712c9e` on 2026-08-16 · `HERMES_WRITE_SAFE_ROOT=/opt/data` observed enforcing a write denial · `MODEL_RE` at `.claude/scripts/hq/lib/validate.mjs:116` · `model_source` stamped at `.claude/scripts/engine/arc-run.mjs` `emitRun` · ADR-0212 § Decision · ADR-0220 § Amendment 2026-08-14 · the `BAD_MODEL` quarantine recorded in `initiatives/engine/PROGRESS.md` · reader behaviour proven by `tests/engine-usage-reader.bats` (9 tests) with four mutants killed (flag not passed → 7 red · `MODEL_RE` guard removed → 2 red · sidecar drops the model → 1 red · estimate leaks into `inr` → 1 red).

**Confidence:** **high on the seat decision** — it is ADR-0220's rule applied, not a new judgement, and it holds whatever the flag turns out to do · **high that the flag cannot be depended on today** (four clean nothings, one unexplained file) · **LOW on the mechanism itself**, deliberately: one report in five appeared and its contents were destroyed before reading, so *whether the flag works at all* is genuinely open and is written that way rather than rounded to a clean "no". The reader's behaviour is proven against planted reports; its correctness against a **real vendor** report is unproven by construction and labelled as such.
