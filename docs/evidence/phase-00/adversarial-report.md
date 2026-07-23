# Phase 00 ckpt A — adversarial construct-a-breaking-input pass

**Date:** 2026-07-22 · **Target:** `.claude/scripts/hq/` (emitter, validator, canonical
serializer, redaction scanner, storage, dual-mode contract) · **Method:** six attacker
agents, one lens each, fresh context, no access to each other's findings. Every claimed
finding was then handed to an independent skeptic whose instruction was to REFUTE it and who
had to reproduce the wrong behaviour personally before confirming.

**Result: 45 agents · 38 claimed findings · 25 CONFIRMED · 13 refuted · 1 agent blocked.**

This is the non-negotiable from `PLAN.md` ("emitter/validator/replayer/reader are
parser-class code → mandatory adversarial pass, holes fixed + pinned as red fixtures, BEFORE
FAIL-mode promotion"), and it earned its keep: the code it attacked had passed 22/22 of its
own tests and a 37-fixture hostile corpus. The council v2+v3 history (43 real holes in code
that looked correct) repeated almost exactly.

The blocked agent was verifying the global-spine finding; the safety classifier stopped it
because the repro writes into the user's real `~/.claude/state/hq`. The finding was fixed
anyway on its merits — see G4.

## The worst of it

**A. An attacker could rewrite `actor` and `outcome` on a sealed event, in strict mode.**
`assertNoDuplicateKeys` compared the RAW text of each key, so `"actor"` and `"actor"`
read as two different keys to the scanner and as ONE key to `JSON.parse` — which keeps the
last. The event was accepted, and the sha computed over the collapsed object certified the
attacker's values as genuine. Fixture 18 (literal duplicate) passed throughout, because it
tests the only spelling the scanner could see. The scanner now decodes escapes before
comparing (`31-bad-actor-control` style bypasses included). Pinned: `38-dup-key-escaped`.

**B. A credential in a normal JSON field went straight onto the spine.**
Every deny rule was written for prose (`api_key = "..."`), so `{"password":"..."}` — the
shape a real hook payload, config dump, or provider webhook actually has — matched nothing.
Redaction now has a STRUCTURAL layer that reads what the keys claim to hold, matched on key
segments so `DB_PASSWORD` and `stripeSecretKey` are caught while `tokenizer` and `tokens_in`
are not. Pinned: `42-secret-structural`, `43-secret-prefixed-key`.

**C. Secret bytes were written to the quarantine log in cleartext.**
Only `SECRET` and `REDACT_FAIL` produced stub-only records. Every other rejection — a bad
`ts`, an unknown kind — fires BEFORE the scanner runs, and those wrote the raw input
verbatim into an append-only file. A payload carrying a live credential and a typo'd kind
leaked. The emitter now scans any input before persisting it and downgrades to stub-only on
a hit, on a scanner throw, or on any doubt at all. This was ADR-0028 being violated by the
code that cites it.

**D. Mutual exclusion could be handed to three processes at once.**
The stale-lock breaker deleted the lock file by age alone, and release was an unconditional
`unlink` — so a breaker could take a live holder's lock, and that holder's release would
then delete the NEW owner's lock. Ownership is now a token written into the lock file:
release deletes only a lock this process still owns, and the holder re-verifies ownership
after acquiring. Stale/timeout were also retuned (a 3 s timeout under a 15 s stale window
meant a crashed emitter stalled every hook for 5 s and then dropped the event).

**E. A torn tail silently destroyed the NEXT event.**
Appending onto a file whose last line lacked its newline welded the new event to the torn
remains — both unparseable, while the emitter printed a ULID and reported success. Appends
now detect a missing trailing newline and heal it first. Same fix for the idem index, where
a torn tail was swallowing the following entry and quietly defeating REQ-03's cross-day
dedupe.

## Everything confirmed, and what closed it

| # | Confirmed hole | Fix | Pinned as |
|---|---|---|---|
| A1 | Escaped duplicate key bypasses DUP_KEY; rewrites top-level identity fields | scanner decodes escapes before comparing keys | `38-dup-key-escaped` |
| A2 | Integers past 2^53 stored rounded; the sha then certifies a number nobody sent | integer tokens must be safe integers; decimals capped at 17 significant digits | `39-bigint-precision` |
| A3 | `-0` canonicalizes to `0`, colliding with a real `0` event as a duplicate | `-0` refused outright | `41-negative-zero` |
| A4 | Verdict depended on V8 stack size, not the schema (deep nesting → uncatchable RangeError) | explicit `MAX_DEPTH` in scanner, canonicalizer and scanners | `40-deep-nesting` |
| A5 | `formatIst`/`dayOf` emitted non-RFC3339 outside 4-digit years, yielding malformed day filenames | year bounds enforced | — |
| B1 | Structural JSON credential fields invisible to every rule | structural redaction layer | `42-secret-structural` |
| B2 | Prefixed/suffixed credential names defeated the word boundary | segment-based key matching | `43-secret-prefixed-key` |
| B3 | base64 candidate budget silently disabled the base64 view (padding hid a secret) | exhausting the budget now raises `REDACT_FAIL` — never a clean pass | — |
| B4 | Split-secret view was insertion-order dependent | joins in forward, reverse and sorted order | `45-secret-split-reordered` |
| B5 | Zero-width character mid-token evaded every view | zero-width/format characters stripped in dedicated views | `44-secret-zero-width` |
| B6 | Modern key formats had no rule (`sk-proj-`, `github_pat_`, DSN inline passwords) | rules added | `46-secret-dsn`, `47-secret-modern-formats` |
| B7 | Quadratic backtracking in the jwt rule: 60 KB payload stalled a hook 21–35 s | linear, backtracking-free JWT scan; every other quantifier bounded | — |
| C1 | Quarantine persisted raw secret bytes on any non-secret rejection (ADR-0028 bypass) | scan-before-persist, stub-only on any doubt | behavioural test |
| D1 | Stale-lock breaker could delete a LIVE holder's lock; release deleted other processes' locks | token ownership, verified on acquire and release | behavioural test |
| D2 | 3 s lock timeout under a 15 s stale window: hooks stalled then dropped events for ~16 s | stale 5 s; timeouts split hook 2 s / strict 15 s | — |
| D3 | Index append failing after a successful day append produced a phantom SKIP, so retries duplicated | the receipt exists once written; index failure is reported as a warning, not a failure | — |
| E1 | Torn tail welded the next event onto it; both unparseable, success reported | appends heal a missing trailing newline | behavioural test |
| E2 | Torn tail in the idem index swallowed the next entry, defeating REQ-03 | same heal on the index | — |
| F1 | idem preimage omitted `venture`/`outcome` — a second venture's revenue was silently dropped | both included in the preimage | — |
| F2 | Caller-supplied idem on `ingest` let anyone pre-claim and suppress a genuine receipt | `ingest` always derives idem from content | behavioural test |
| F3 | No bound on `ts` vs the spine's clock: far-future events created day files no close could reach | ts bounded ahead of the spine clock | `48-ts-far-future` |
| F4 | `cost` bounded only by sign; 1e308 poisoned any aggregate | magnitude ceiling on tokens and rupees | `49-cost-huge` |
| F5 | `supersedes` could equal `id` — a cycle for any chain-resolving replay | self-supersede refused | `50-supersedes-self` |
| G1 | Flag VALUES flipped the mode: `--actor ingest` made a hook exit 2; `--strict=…` degraded strict to hook | both wrapper and emitter WALK the command line instead of grepping it | behavioural test |
| G2 | A broken/truncated `lib/*.mjs` made hook mode exit 1 with a raw stack trace | wrapper absorbs any non-zero exit in hook mode | behavioural test |
| G3 | `--id`/`--ts` were undocumented, unchecked caller overrides of identity and day placement | removed from the synthesis path (`--event-file` remains the explicit route) | — |
| G4 | With no repo above cwd, one project's receipts were written into the user's GLOBAL `~/.claude/state/hq` | spine root requires `.claude` and `.git` together; otherwise it refuses to guess | behavioural test |

## Accepted, not fixed

**ULID intra-millisecond ordering.** Two emitter processes in the same millisecond produce
ULIDs with no defined order between them, so a `--since <ulid>` cursor that sorts by string
can skip an event. Not a ckpt-A defect: REQ-09's acceptance already specifies that cursor
catch-up resolves ties by append order (file position), never by string comparison, and
Phase 3 pins it with a same-millisecond-burst fixture. Recorded as a contract note in
`lib/canonical.mjs` so the ckpt-B reader cannot get it wrong by accident.

## Refuted (13)

Thirteen claims did not survive their skeptic — mostly proposed evasions that the existing
views already caught, and two ReDoS claims whose timings did not reproduce. They are left
unlogged by design: the reconcile rule is accept-and-apply or drop silently, and a list of
things that turned out to be fine is noise a future reader would have to re-litigate.

## Corpus

37 fixtures before the pass, **50 after** — every confirmed input-shaped hole has a fixture
asserted in BOTH modes, plus seven behavioural regression tests for the holes that only
exist as timing, filesystem state, or argv shape. `bats tests/spine-emit.bats`: **29/29**.
