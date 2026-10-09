# Phase 04 — attack dispositions

## attack 143525f r1 (fit rules, override, trust sweep, neon, wiring, weekly watch, ADR-1748..1751; base bd4c444e)

- Logic: the run failed, and no findings came back from it. The worktree spine guard refused its `run.completed` emit, so the
  failure is not recorded; round 2 runs the surface again. Boundary: 11, every one fixed or closed in this session:
  - B1 [high] neon adopted a same-named project on a first run (`recorded` empty). Every project launch did not record is
    now refused, first run or not; the contract has a `foreign` arm that asserts no SQL ran.
  - B2 [medium] neon could alter an owner's `launch_probe`. Closed by B1: the migration runs only in a project launch
    created, so no owner table can be there.
  - B3 [high] an UNVERIFIABLE (drifted) slot under `--public-only` raised nothing, and the watch read exit 1 as
    "already raised". That path now raises `incident.raised` too. The runner ends with `watch-result failed=N raised=M`,
    and the watch accepts exit 1 only when N equals M.
  - B4 [medium] a timeout or kill read as exit 1. The watch now checks `error`, `signal` and a null status first.
  - B5 [medium] a failed watch still stamped the week done. The stamp is now written only when every board was watched.
    Each board gets at most 8 minutes and the run 25 minutes, inside the job's 30-minute budget.
  - B6 [low] a future stamp skipped the watch for ever. A stamp counts only when it is 0 to 6 days old.
  - B7 [medium] the owner apply refused CRLF files. It now matches the anchor in either EOL and writes in the file's own.
  - B8 [low] a `repository` starting `--` reached venture-register as a flag. It must now be owner/name.
  - B9 [low] an adapter reason starting `env:` was read as skipped(env). Only the worker's `missing_env` flag counts now.
    PAUSED stays the adapter's word, as `ok` is.
  - B10 [low] the trust sweep's CRLF copy doubled the CRs on an autocrlf checkout. It now normalises first.
  - B11 [low] the fixture digest can carry a CR. `tr -d '\r'` strips it.

## attack 530c056 r1 (both surfaces again at the fixed head; base bd4c444e) — the last round under the two-round cap

- Logic: 15. Boundary: 6. High and medium fixed; the lows go to D38.
  - L1/L8 [high/medium] a thrown error under `--public-only` ended the loop before the watch-result line. Every thrown
    error now raises and is counted.
  - L2/L9 [high/low] an unparseable `last_verified` ranked as never but printed raw. Only a YYYY-MM-DD day counts; anything
    else ranks and prints as never.
  - L3/L12 [medium/low] an override skipped the fit rules silently. It stays the owner's call (ADR-1748), and the line now
    says `outside the fit rules: <rule>`.
  - L4, L5, L10, L11, L14: the attacker gave no breaking input, or the behaviour is intended. Rejected.
  - L6/L7/L13 [medium] PAUSED read from a reason prefix. Rejected with a reason: unlike `env:` (a fact the runner owns),
    the pause is the adapter's own verdict, and a digest-pinned adapter could answer `ok` outright. Listed in D38.
  - B1 [high] the r1 fix refused launch's own half-made project on a rerun. launch now records a `neon-project-intent`
    before the POST and adopts a hit when the intent is on record. New `half-made` arm.
  - B2 [medium] one failing board re-ran the whole fleet daily and re-raised the others' incidents. Stamps are now per
    board, and a failed board retries alone.
  - L15, B4, B5, B6 [low]: D38.
