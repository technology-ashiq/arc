# ADR 1004 — LEG-D: the receipt attests to BYTES, and the preimage carries its own version

**Status:** accepted
**Date:** 2026-08-12
**Product:** `legal`
**Reversibility:** one-way
**Revisit trigger:** a venture's stack genuinely cannot serve a static checked-in policy route (not
"prefers not to" — cannot), so the static-MDX constraint would exclude a venture arc actually needs
to serve. The verification model is then reopened, and whatever replaces it must still answer "does
the served page match the approved bytes" without trusting the renderer.

## Context

Decided under the owner's **Build-out Mandate (2026-08-09)**, receipt `01KZTM348858PDH44K4HA64CVA`
(ADR-1000). Locked at the v1.1 freeze as LEG-D. Non-negotiable per the owner's kickoff instruction.

The red-team's third, sixth and seventh findings are one failure with three faces: **approved ≠
served.** A page is approved, then the facts are edited before the commit (TOCTOU); or the approved
bytes are never what deploys; or an `effective_date` is backdated so a page appears to have been in
force before it existed.

## Options considered

1. **Receipt attests to a human's INTENT** ("the owner approved the refund policy") — readable, and
   worth nothing: it cannot distinguish the approved page from a later edit.
2. **Receipt attests to BYTES** — a bound triple of hashes that a later re-render either reproduces
   or does not.

## Decision

**Option 2**, with four mechanisms, all of which are Phase-1 exit criteria:

1. **Render is a pure function.** `(facts, template_set@sha, engine@version) → bytes`, byte-reproducible
   and fixture-proven. No clock, no locale, no environment, no model in the render path.
2. **The decision binds the triple.** `decision.recorded` carries `(facts_sha256, output_sha256[],
   template_set_sha)`. Publish **refuses** any mismatch, so a post-approval facts edit forces
   re-approval rather than silently shipping. Fixture-pinned as a TOCTOU test.
3. **Date law.** `effective_date >= decision timestamp`, and strictly monotonic per page. A
   backdating attempt is a FAIL with its own fixture.
4. **Drift is detectable after the fact.** `arc-legal --verify` re-renders and diffs the venture's
   committed pages, exiting nonzero on drift; a ~10-line CI guard in the venture repo compares
   committed-page hashes against the latest publish receipt. **Policy routes are static checked-in
   MDX/MD only** — CMS, SSR and dynamic content on these routes are banned. That constraint is not
   fastidiousness; it is the thing that makes verification possible at all.

**Two hard-won rules the preimage must obey, both from arc's own record:**

- **The canonicaliser is total and type-tagged, or it is a collision generator.** `arc-evolve`
  2026-08-04: a `configHash` gave `floor: 1000` and `floor: "1000"` the same hash; the
  `JSON.stringify` fix then folded `NaN` and `-Infinity` to `null`, so a *deliberately disabled*
  floor hashed identically to an unset one. The facts canonicaliser **refuses** what it cannot
  represent — `undefined`, `NaN`, `±Infinity`, `BigInt`, cycles — rather than coercing, and tags
  types so `1000` and `"1000"` can never collide.
- **The preimage carries its own version inside the sealed record.** `arc-absorb` 2026-08-09:
  changing a preimage format silently invalidated every outstanding commitment, and the verifier
  then accused the owner's own sealed judgement of TAMPERING. `--verify` reports **stale-format**
  and **tamper** as different outcomes with different exit codes. A wrong diagnosis on the most
  serious message a tool emits is worse than no message.

And one rule about how the guard is proven: **the negative control is a mutant, not a grep.**
`arc-evolve` 2026-08-04 — a propose-only guard was a grep, and a mutant module that overwrote the
canonical file, deleted the champion, committed and spawned a deploy walked straight past it. The
hash guard's test builds a page that differs from the receipt and asserts the guard goes red.

**Evidence:** `docs/retro-log.md` 2026-08-04 (`arc-evolve`, non-total encoder; porous grep guard),
2026-08-09 (`arc-absorb`, preimage-format migration + TAMPERED misdiagnosis), 2026-08-12
(`arc-memory`, *"a gate PRINTED its own contract and compared against nothing"*).
**Confidence:** high
**Rejected because:** Option 1 — an intent receipt cannot answer the only question that matters.

## Consequences

Easier: "did this page change without a receipt" becomes a command, and a venture's CI answers it on
every push without arc being present.

Harder: ventures lose the option of dynamic policy routes, and every template edit forces visible
per-venture re-approval (ADR-1009 / `--bump-templates`). Both are the point.

**The one-way part** is the static-MDX constraint, which is why it carries the revisit trigger
above: it is a standing constraint on every consumer repo, not a local choice.
