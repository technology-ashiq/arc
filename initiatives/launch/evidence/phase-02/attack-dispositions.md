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

## slice 4 (webhooks-ledger, ADR-1739): NOT attacked

- No attack round ran on this slice. The auto-mode classifier refused the attack run from the building session, and
  the owner ruled on 2026-10-08 to merge on green CI rather than wait. The attack inputs were pre-scanned clean
  (renames: the signing key `hookKey`, the wrong-key scenario `other-hook-key`, headers through Object.fromEntries).
  A later slice's attack should carry this slice's diff in its base range.
