# PHASE03-CHAIN-V2 — the first real owner judgement, and a blind result worth more than the demo

**Purpose:** prove the ADR-0603 receipt chain end to end with a REAL owner decision on the REAL
spine. Phase 03's spec called this a *synthetic* blind A/B, because its job was the machinery rather
than the verdict.

## Protocol (fixed before the decision)

Two variants of arc's review step, one carrying the pre-emit verification gate (T-01) and one as it
stands. Labels drawn from a fixed pool of information-free words and randomised per seal. The
label-to-variant mapping committed as a sha256 **before** the request was emitted, held outside git in
`.claude/state/absorb/seals/` (gitignored), and revealed only after a `decision.recorded` existed that
names this approval and a pick.

## Result

| | |
|---|---|
| approval | `01KZK9EPKCN0DJBW91QB67RYNP` |
| decision | `01KZKBYSQ5J46Y82PRN7W3AJNH` |
| reason | `pick=meridian; read clearer` |
| commitment | `3ead20018da71807f9e36e56f7db65f68779eaf50e9cee165966e2fb34b90855` |
| revealed | `meridian = reviewproc-with-verification-gate` · `crimson = reviewproc-as-it-stands` |

**THE OWNER PICKED THE VARIANT CARRYING T-01, BLIND.** Nothing in the request indicated which label
was which; the mapping was behind a hash until the decision landed. That makes this a genuine — if
small — blind preference for the review step carrying the pre-emit verification gate, recorded as a
receipt rather than a recollection.

## What this is NOT

**It is not an adoption, and it is not REQ-03's A/B.** No fixture was executed. The three fixtures
named in the request describe the defect class the technique targets; they were not run, because
ADR-0602 Amendment 1 leaves T-01 with no landing site and so there is no absorbed-way to execute.
`T-01` stays `candidate` with `decision_refs` deliberately **empty** — filling it would let the cap
lint treat this as an adopted row.

**REQ-08 remains NOT MET.** One blind preference on wording is not evidence that a technique works.

## The attempt that had to be thrown away

A first approval (`01KZJXBNKT6PEYC87TW5D53QTP`) was queued and then became **unrevealable**: its
commitment was computed under the v1 preimage, which the Phase 03 adversarial pass proved
non-injective, and the v2 fix silently invalidated every outstanding seal. `verify` then reported
`MISMATCH — the mapping changed after sealing`, accusing the owner's own seal of tampering when the
format had changed underneath it.

**A stale format is not a tamper.** The seal now records `preimage_version`, `verify` and `reveal`
report the two differently with a distinct exit code, and the dead approval was closed as a rejection
whose reason says it is not a judgement on the technique. Caught by verifying the seal before spending
the decision — which is the entire reason to verify rather than trust.
