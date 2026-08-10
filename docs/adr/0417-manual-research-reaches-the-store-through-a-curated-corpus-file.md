# ADR 0417 — manual research reaches the store through a curated corpus file

**Status:** proposed
**Date:** 2026-08-10
**Product:** `leads`
**Reversibility:** reversible (it binds one dependency behind an interface that already exists; a later automated source replaces the impl and nothing else)
**Revisit trigger:** an automated discovery source is vetted through `/arc-capability` and meets ADR-0409's provenance classes — at which point this impl becomes one of two, selected by config, and this ADR records why the file path stayed.

## Context

Phase 03's whole deliverable is five complete journeys: research → dossier → draft → lint →
approval → send → receipt → reply → triage → auto-stop. On 2026-08-10, walking
`phase-03-runbook.md` against the fake, the journey turned out to be blocked at its **first**
step, and the runbook already said so in a STOP box that had never been acted on.

Verified against the code rather than the document:

- `arc-leads research` exits **4**: `no automated lead source is bound — v1 research is manual
  against ADR-0409's allowlisted classes`.
- `verifier().verify()` throws: `no email verifier is bound — selected from the capability
  report at Phase-3 entry`.
- The **single** `writeFileSync` into `dossiers/` in the whole leads tree is inside
  `cmdResearch`, which dies at the source binding before reaching it.
- `lead_id` is an ADR-0400 keyed HMAC of the address under the store secret, so it cannot be
  computed by hand.

Those four together mean there is **no path by which a manually-researched person enters the
store.** Not a hard one — none.

**And the plan already said the answer.** PLAN.md's External-dependencies table gives the lead
source's real impl as *"manual research against ADR-0409's allowlisted classes"* — the same
words `sourceReal.search()` refuses with. The design decision was made at kickoff; what was
never built is the mechanism by which manual research becomes a dossier. The interface is
`search(icp)` returning candidates, and a human doing manual research holds exactly that — a
list of candidates — with nowhere to put it.

`sourceFake` already reads a 34-candidate corpus from `tests/fixtures/leads/candidates.json`.
The real impl is the same read, from a path the operator supplies, outside the repository.

## Decision

**Bind `source()`'s real impl to a curated corpus file supplied by the operator**, passed by
path, read through the same `lintCandidates` gate the fake corpus goes through.

1. The path arrives as a **flag or a config key, never as inline argv content** — a corpus holds
   names and addresses, and ADR-0412 keeps those out of process listings, shell history and
   Node's `Command failed:` message. The path itself is not the data.
2. The file **must live outside the repository**. The PII tripwire treats every tracked leads
   path as a violation on sight, and this is the file most likely to be dropped in the repo root
   by someone in a hurry. The impl refuses a path that resolves inside the repo, in the same
   shape as `assertOutsideRepo` already refuses it for the store.
3. **Every candidate goes through `lintCandidates` unchanged.** Provenance class from ADR-0409's
   closed allowlist, geography from ADR-0406's, ≥2 distinct source links, ≥1 lead-specific fact
   with an evidence URL and a relevance line. A hand-written corpus gets **no** relaxation — it
   is the input most likely to cut corners, being written by the person who wants the result.
4. It is a **read**, never a write. The impl does not normalise, deduplicate, enrich, or repair
   the file; a corpus that fails the lint is reported and refused, not fixed. The lint's verdict
   classes (PASS / HELD / BELOW-BAR / REJECTED) are the whole vocabulary.
5. **The fake stays.** Selecting the real impl is `usingFakes()` as everywhere else, so the
   offline-first contract and `tests/leads-research-lint.bats` are untouched.

## What this deliberately does not decide

**S2, the email verifier, is not decided here.** ADR-0402/0409 route it to `/arc-capability`,
and it is a different question with a worse failure mode: a wrong verifier bounces mail from a
domain that costs 2–4 calendar weeks to warm. It stays open, and Phase 03's five journeys need
it answered too — a corpus with no verifier still dies on the first address. Recorded as a
separate item so that closing this ADR is not read as unblocking the phase on its own.

## Consequences

**Good.** The blocker is removed with an impl that already has an interface, a fake, a contract
test and a lint — no new dependency, no vendor, no network. It matches what PLAN already
declared. Five known-good candidates for the rehearsal are trivially expressible.

**Bad, and accepted.** Manual research does not scale and was never meant to: REQ-01's 25 leads
are a person's afternoon. The corpus is also a real PII file living outside git with no backup
story of its own beyond the store's.

**The honest risk.** A hand-written corpus is written by the person who wants it to pass, which
is precisely the `gate-author-cannot-be-its-attacker` shape. The lint is the only thing standing
between "I researched these" and "I typed these", and it must run on this input with no
exception — which is why point 3 above is stated as a non-relaxation rather than as a default.

## The assumption this exposes

PLAN's ledger row *"25 leads meeting ADR-0409's closed provenance allowlist are findable for a
single ICP without purchased data"* is marked as tested by Phase 0. Phase 0 tested it against
`source-fake.mjs`, a corpus **built as 25 clean + 9 each failing exactly one lint rule** — a
fixture constructed to contain 25 qualifying leads was used to answer whether 25 qualifying
leads are findable. That is circular, the row is **untested**, and this ADR's corpus file is the
first thing that can actually test it. The ledger is annotated rather than the row re-graded,
because an untested assumption and a surviving one look identical on that table, which is the
ledger's own stated reason for existing.
