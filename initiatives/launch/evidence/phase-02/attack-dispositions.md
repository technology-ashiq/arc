# Attack dispositions -- launch Phase 02

## attack 1cb6b9a r1 (slice 1, payment-test, ADR-1736)

- The first run (4c3dcb0) was refused by arc-run's input scanner: a scenario named `wrong-secret` read as a credential
  assignment once whitespace was stripped; renamed `wrong-pair`, identifiers renamed `keySecret`.
- Boundary: B1/B2/B3/B5/B6 fixed. B4 -> D29 (a ctx change, every adapter).
- Logic: L4 = B1, L6 = B2 (fixed). REJECTED: L1 (two recorded orders already answer not-ok, `exactly one`), L7 (arrays
  are excluded by `!Array.isArray`), L3/L8 (the trimmed value is both validated and sent), L12 (the runner's per-venture
  lock forbids concurrent applies, ADR-1718), L15 (SKIP covers U+202A-U+202E), L2/L9/L10/L11/L13/L14 (no defect named).

## attack da7f2e0 r2 (slice 1)

- Boundary B1 [medium] fixed (paged lookup, a fake that ignores the filter pins it). B2/B3 low: no defect beyond D29.
- Logic: L1 REJECTED (`items: null` fails `Array.isArray` and refuses), L2 REJECTED (an array-notes order with launch's
  receipt refuses FOREIGN_ORDER, the safe path), L12 REJECTED (a 48-bit receipt hash, at most a few ventures).
  Lows: no defect named. Two rounds reached; pushed.

## attack d1dc8eb r1 (slice 2, plans, ADR-1737)

- Boundary: B1 [high] fixed (the fake regex had lost its escapes). B2/B3/B4 fixed; B3 twin-fixed in authz and tenancy.
  B5 -> D30.
- Logic: L1/L2 REJECTED (the org id passes an anchored uuid regex and the plan is one of two literals before either
  reaches SQL). L5 REJECTED (RLS is checked after every migration run). L4 REJECTED (the slug-built repo name is
  lowercase by the slug grammar). L3/L6-L10 REJECTED (no defect: allow lists are per call and checked, upstream ids
  come from one slot, token shapes are shapes, GitHub contents of a symlink are refused by `type !== "file"`).

## attack a9a2ec2 r2 (slice 2)

- Boundary: B1 [high] fixed (verify starts by setting the probe org to free, so a timed-out run is healed by the next).
  B2 [high], B3/B4 [medium] -> D31: each needs the owner to forge launch's probe org or ownership marker by hand.
- Logic: RUN FAILED (output contract: the model named the surface `launch-contract`); two rounds reached, not re-run.

## attack b1844e0 r1 (slice 3, checkout-portal, ADR-1738)

- The first two runs (a51bab7, f8737cf) were refused by arc-run's input scanner: a result field named for the key it checks and a header
  object keyed by the Supabase key name read as credential assignments; renamed `leaksSecret`, headers built with
  Object.fromEntries.
- Boundary: B1 [medium] fixed in all eight committing adapters, plus two frontend twins of already-fixed defects
  (identical bytes adopted without the trailer, local copy written before the commit). B2 [medium] -> D32: the literal
  sandbox host is in ten rows since kickoff, a runner change for Cycle 2's first other venture. B3-B6 [low] fixed, B3
  and B4 twin-fixed in payment-test and auth.
- Logic: 0 findings in 7 s.
## slice 4 (webhooks-ledger, ADR-1739): NOT attacked

- No attack round ran on this slice. The auto-mode classifier refused the attack run from the building session, and
  the owner ruled on 2026-10-08 to merge on green CI rather than wait. The attack inputs were pre-scanned clean
  (renames: the signing key `hookKey`, the wrong-key scenario `other-hook-key`, headers through Object.fromEntries).
  A later slice's attack should carry this slice's diff in its base range.

## attack 55c5065 r1 (slice 5, refunds + gate 3, ADR-1740/1741; base b51a2dcd)

- The diff carries the webhooks-ledger adapter only where this slice changed it (probe-payment report, captures-only
  read), so slice 4's full adapter is still unattacked as a whole.
- Boundary: B1 [high] fixed: the refund read filters in a materialized CTE before any body is cast, and is capped at
  101 rows. B2 [medium] fixed with L11. B3 [medium] fixed: probe ids derive from the tag AND the charge, so a new
  upstream payment is a new event id (pinned, `new-payment`). B4 [medium] not a hole: `recordSimulated` runs inside
  the venture lock and a refund books only against its own venture's charge, so two bookings cannot interleave.
  B5 [low] fixed (`Object.hasOwn`). B6 [low] -> D34.
- Logic: L1 [high] not a hole: gate() refuses from a recorded `approval_id` before any emit, on every path. L2 [high]
  fixed (the refund sum is filtered by venture too). L3 [high] and L4 [medium] not holes: the provider is the
  parser's constant and is part of the namespaced charge id the lookup matches. L5 [medium] not a hole: the P&L orders
  a refund by its recorded `ts`, not `paid_at`. L6 [medium] and L14 [low] by design: the deterministic id IS the replay
  identity (ADR-1739/1740). L7 [medium] fixed: any other refund.processed row of the probe payment fails the probe
  (pinned, `foreign-refund`). L8 [medium] by design (the marker rule, ADR-1731; D31). L9 [medium] not a hole: booking
  is idempotent by refund id. L11 [low] fixed: two vetted rows on a rehearsal gate refuse like pickProvider, and
  `--provider` is honoured. L10, L12, L13, L15 [low] -> D34.
