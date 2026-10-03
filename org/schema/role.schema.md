# The role card

A role card is one YAML file per job at `org/roles/DEPT/ID.role.yaml`. It **binds** things that
already exist, such as agents, skills, scripts, a process and a router tier. It adds only what
nothing else in arc holds: mission, stages, seat, origin, reporting line, E2 exposure, produces and
consumes, fixtures, KPI, autonomy ceiling and tenure (ADR-1601).

**The grammar lives in code, not here.** `.claude/scripts/org/lib/card.mjs` is the only definition.
A second copy of the field list in prose would drift the way the blueprint's §4 did. Read that
file's `KEYS` and `validateCard`. `example-seo-strategist.role.yaml` beside this file is a card the validator
accepts, and `tests/org-card.bats` loads it.

## Why each rule exists

- **`seat` and `legitimacy` are separate.** A seat says who holds the job. `legitimacy` says how
  the holder got it: `genesis` covers the seats that existed on 2026-09-29, approved once over the
  catalog digest (ADR-1602), and `interview:ULID` covers a bench fixture run with the owner's
  verdict (ADR-1614). *Staffed* is derived from the two together and is never typed.
- **`origin` is `own` or `hired` and nothing else.** A hire that is later rewritten as an own agent
  simply becomes `own`, and `history:` carries the provenance (ADR-1614).
- **No field names a model.** A seat binds a router tier, and `engine/router.yaml` decides the
  model. `hire.source` is the one exception, because it records where a hire came from.
- **`e2` holds only the verbatim `ungrantable_actions` strings, read from `hq.policy.yaml` at gate
  time.** A non-empty list means the owner holds the seat (ADR-1609).
- **`produces` / `consumes` are artifact kinds, not messages.** Every consumed kind needs a
  producer (REQ-13, ADR-1617).
- **Lists are always block form.** The ADR-0200 YAML subset refuses non-empty flow lists. It also
  misreads a list item containing `": "` as a mapping, so `org-catalog` refuses to write one.

## Tools

- `node .claude/scripts/org/org-coverage.mjs` checks that the cards and the tree agree, in both
  directions. It runs FAIL-FROM-BIRTH, and `--mutant-selftest` attacks it.
- `node .claude/scripts/org/org-catalog.mjs --chart` renders `org/CHART.md` and `org/chart.json`.
  Add `--check` to find hand edits.
- `node .claude/scripts/org/org-catalog.mjs --digest` prints the value the genesis approval covers.
