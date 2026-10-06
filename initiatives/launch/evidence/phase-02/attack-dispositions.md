# Attack dispositions -- launch Phase 02

## attack d1dc8eb r1 (slice 2, plans, ADR-1737)

- Boundary: B1 [high] fixed (the fake regex had lost its escapes). B2/B3/B4 fixed; B3 twin-fixed in authz and tenancy.
  B5 -> D30.
- Logic: L1/L2 REJECTED (the org id passes an anchored uuid regex and the plan is one of two literals before either
  reaches SQL). L5 REJECTED (RLS is checked after every migration run). L4 REJECTED (the slug-built repo name is
  lowercase by the slug grammar). L3/L6-L10 REJECTED (no defect: allow lists are per call and checked, upstream ids
  come from one slot, token shapes are shapes, GitHub contents of a symlink are refused by `type !== "file"`).
