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
