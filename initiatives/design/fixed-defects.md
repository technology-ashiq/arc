# Fixed defects — the design lane's running list

Every attacker prompt carries this file, with one instruction: **check each line in every OTHER
file you are shown, not only the file it was fixed in.** Every attacker pass appends its fixed
holes here, one line each. The fuller Phase 01 history is in
[`evidence/phase-01/adversarial-open.md`](evidence/phase-01/adversarial-open.md).

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

## Phase 02 slice B, attack round 1 (2026-09-26)

- **An emptied oversize body passed through as a 2xx**, so a huge robots.txt read as "no rules" and became ALLOW (B1) — `design-robots.mjs` — *a capped read is truncated or refused, never handed on empty as a success.*
- **The licence was checked on one input and the fetch made on another** (`--source` row vs `--url` host) (B2) — `design-refpack.mjs` — *every permission check binds to the exact value that is then used.*
- **Redirects were followed by the HTTP client**, skipping the registry, robots and attempt log for every hop (B3) — `design-robots.mjs`, `design-refpack.mjs` — *redirects are manual, and each hop passes every gate the first request did.*
- **Test seams shipped ungated in a production CLI** and a fixture read as a real fetch (B4) — `design-refpack.mjs` — *a fake transport needs an explicit env and stamps what it produced.*
- **Remote text compiled into a regex** (backtracking at the remote's choice) (B5) — `design-robots.mjs` — *never build a RegExp from untrusted text; use a linear matcher.*
- **Paths compared without percent-encoding normalisation**, so a DISALLOW missed (B6) — `design-robots.mjs` — *normalise both sides of a path comparison the same way.*
- **Check-then-create with a truncating write** lost a concurrent writer's first row (B7) — `design-refpack.mjs` — *create exclusively (`wx`) and append; never exists()-then-write.*
- **A subprocess result was ignored** and success printed anyway (B8) — `design-refpack.mjs` — *read status and error of every spawn whose failure matters.*
- **An id validated on one argument and used raw from another source** (registry id into a path and a log) (B9) — `design-refpack.mjs` — *validate every value at the point it becomes a path or a log field, and assert containment.*
- **`find()` took the first of duplicate rows**, so a later restriction was never seen (B10) — `design-refpack.mjs` — *count matches; exactly one or refuse.*
- **Remote text reached a tab-separated log verbatim** (B11) — `design-refpack.mjs` — *strip control characters from every logged field.*
- **A Windows reserved device name passed the id grammar** (B12) — `design-refpack.mjs` — *the lane-name reserved list applies to every id that becomes a directory.*
- **A full URL with its query string went into a committed file** in a public repo (B13) — `design-refpack.mjs` — *drop query and fragment before anything is committed.*

## Phase 02 slice B, attack round 2 (2026-09-26)

- **A seam gate added to one CLI and not its sibling** (B1) — `design-robots.mjs` — *a fix to one entry point is checked in every entry point that shares the seam.*
- **A plain-object lookup keyed by remote text** found an inherited property (`constructor`) (B2) — `design-refpack.mjs` — *use `Object.hasOwn` or a Map for any lookup keyed by untrusted input.*
- **An IPv4-in-IPv6 address in the URL parser's hex spelling** passed the private check (B3) — `design-robots.mjs` — *parse addresses to bytes before classifying; never match their text.*
- **The second gate on a redirect was added to one redirect loop only** (robots hops unbound) (B4) — `design-robots.mjs` — *every loop that follows a redirect carries the same guards.*
- **A failing probe command read as "not applicable"** (git rev-parse error skipped the mark) (B5) — `design-refpack.mjs` — *only a positive "absent" skips; an error is a failure.*
- **Cleanup deleted a content-addressed file an earlier run owned** (B6) — `design-refpack.mjs` — *clean up only what this run created.*
- **A non-text 2xx parsed as an empty rule set** and became ALLOW (B8) — `design-robots.mjs` — *check the content type and shape before a body is trusted as the format it claims.*
- **Emptiness checked before sanitising** (B7) — `design-refpack.mjs` — *validate the value that will be written, after every transform.*
- **A caller read the parser's "someone else" code, 1, which is also bash's crash code** (ADR-1419 r1 B2) — `composer-scope-check.sh`, `composer-write-check.sh` — *a verdict gets a code the runtime never produces by accident; every unknown code is judged.*
- **A size guard written for one tool reached another through a new entry point** (a composer's own 100 KB page refused) (r1 B1) — `composer-bash-check.sh --identity` — *a guard reused by a new caller is re-checked against that caller's real inputs.*
- **An unparseable payload was answered "not a composer" before the fail-closed branch could see it** (r1 B3) — `composer-bash-check.sh --identity` — *"other" is a positive result about a payload that was read; unreadable is its own answer.*
- **A sibling script's version was checked for completeness, not for the feature asked of it** (r1 B8) — the `--identity` handshake — *check the capability you call, not only that the file is whole.*
- **A refusal test aimed at a path another rule already refuses** (r1 B5) — `design-composer-eyes.bats` — *aim a gate's test where only that gate can refuse, and assert its reason.*
- **A verdict code shared with bash's syntax-error code** (2 read as "refuse", locking every caller) (ADR-1419 r2 B2) — `composer-*-check.sh` — *every verdict code is one the runtime never makes; the r1 fix moved one verdict and left its twin.*
- **A subprocess that failed produced an empty string read as a positive answer** (`tr` in the identity normaliser) (r2 B1) — `composer-bash-check.sh` — *a non-empty input that transforms to empty is a failure, never a value.*
