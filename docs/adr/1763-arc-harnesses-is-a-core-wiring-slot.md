# ADR 1763 — `arc-harnesses` is a core wiring slot: a venture is born with arc installed

**Status:** accepted
**Date:** 2026-10-15
**Product:** `launch`
**Reversibility:** two-way
**Revisit trigger:** `arc init` changes what a no-`--target` install places, or `doctor --dir` changes its summary line.
Either one breaks this slot's verify, and the slot is re-read against the new contract.

## Context

The distribute lane closed Cycle 3 (v0.2.0) with `node bin/arc.mjs init --dir <venture>`. With no `--target`, it
installs every verified harness (`.claude/`, `.codex/`, `.opencode/`, `.agents/skills/`) under one v2
`.arc-install.json`, and registers the venture in `~/.arc-private/consumers.json` for the weekly distribute-radar.
Distribute's REQ-15 asks that a new venture be born with that install through a launch `core` slot. The catalog is
launch's, so distribute asked launch to decide (A-17). Declining fires A-17's falsifier, and REQ-15's clause is cut.

The ask fits launch's own goal, the venture factory. A venture launch builds but arc cannot work in is half-born.
Appetite stands at 12 of 18 days, and the slot needs no account, no token and no network.

## Decision

1. **Slot `arc-harnesses`**, group `wiring`, tier `core`, `depends_on: [repo]`.
   - Exit criterion: `node bin/arc.mjs doctor --dir <venture>` reports 0 missing and 0 unmanaged-conflict, and the
     install names all four harnesses.
   - Verify: `arc-harnesses-probe`.

   It is `wiring`, not `delivery` (distribute proposed `delivery`):
   - Its exit is a fact about arc, read from arc's own install code.
   - Only a wiring slot may ask `ctx.probe.arc` (ADR-1751).

   It depends on `repo`, so the install lands in a working tree launch made.
2. **Provider row `arc-checkout`.** The arc checkout itself; no account, no token, `env_keys: []`.
   - scaffold asks arc to install, through a new probe question `harness-install`. The question runs
     `bin/arc.mjs init --dir <venture root>` from arc's root: one install, every harness, no `--force`. A doctor that
     is already clean skips the install, so a resumed slot writes nothing twice.
   - verify asks `harnesses`, which runs arc's own `doctor()` on the venture root. It is `ok` only when 0 missing,
     0 unmanaged-conflict and the four targets are present.

   An adapter still runs nothing itself. The runner's probe holds both commands, the same way `passport` holds
   `venture-register` (ADR-1751).
3. **Vetting.** `launch-coverage --require-core-vetted` counts this core slot like any other. The row is vetted by the
   same consolidated scout record and owner decision as the other 32 rows, once its real verify has passed on
   `arc-sandbox` (ADR-1705).

Adding the slot changes the derived counts: 86 slots, 34 core. A-08 already says the count is derived, never a target.

## Consequences

- A launched venture carries arc in every harness, and distribute-radar watches it from day one.
- The install writes into the venture's working tree. Committing it is the venture repo's next commit, not this slot's:
  the slot proves placement, not publication.
- distribute validates REQ-15 in its own docs PR once this lands on main.
