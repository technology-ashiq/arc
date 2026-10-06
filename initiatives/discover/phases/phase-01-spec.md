# Phase 01 — A hostile hunt on fakes, a real replay, and one live mini-hunt

**Goal (one line):** a niche query flows mine → normalize → dedupe/cluster → `clusters.json`, byte-identical on all 3 OS legs against a committed golden, with every injection fixture refused closed; then one live mini-hunt from the main clone leaves real `idea.captured` receipts.
**Appetite:** 3 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** phase-00
**REQs closed here:** REQ-01, REQ-02
**Day-4 kill + 50% tripwire:** at the Phase 01 exit (day 4), if a hostile fixture hunt is not byte-identical, or any injection fixture is not refused → STOP and re-plan; if Phase 01 is not closed by day 4 → scope-cut conversation (cut order in PLAN).
**No cross-lane dependency:** the miner taps growth's adapter transport (ADR-1915).

## Scope (in order)

1. **Recording first (attack C3).** Before any miner code: a read-only `curl` of ≤ 20 HN Algolia requests at 1 req/s from the worktree (no spine write, so the worktree restriction does not apply), redacted and committed to `tests/discover/fixtures/recorded/hn.json`.
2. `.claude/scripts/discover/miners/hn.mjs`: runs growth's `hnAlgoliaAdapter` with a `fetchImpl` tap that paces (1 req/s), sets the UA (ADR-1904), caps the body and records each response; parses the tapped hits into NDJSON `source_url · text · engagement · ts · source_id`. `--offline-fixture` swaps ONLY the `fetchImpl` transport and runs the real adapter with `offline: false`.
3. `.claude/scripts/discover/lib/normalize.mjs`: NFC, control-character strip, byte cap per field, non-UTF8 → U+FFFD; output is data only, never interpolated into a command.
4. `.claude/scripts/discover/lib/cluster.mjs`: Jaccard over growth's `STOP`-filtered tokens, similarity stored as an integer (`overlap*10000/union`, floored), fixed threshold, code-point (never locale) ordering, LF-only output, no path or clock in `clusters.json` (ADR-1902); `cluster_fp` = sha256 of the sorted top-8 stem tokens; the cross-cycle reject reader goes through the spine reader (ADR-1907). The reject payload shape is pinned in one fixture that the Phase 03 writer test also loads.
5. `arc-discover.mjs hunt {niche} --offline-fixture {dir} --out {dir}` replacing the Phase 00 stub; `idea.captured` per new item (idem `hn:{objectID}`, deduped by a spine read BEFORE emitting, so `DUP_IDEM` never appears) and `run.completed process=discover@0.1.0`.
6. **After the merge, from the MAIN clone:** a live mini-hunt on the owner-named niche (≤ 20 requests); the production `idea.captured` count for `process=discover` is read from the spine and recorded.

## Exit criteria (Definition of Done)

- [ ] REQ-01 fixtures green on CI, each asserting RAN first; an adapter success with zero tapped responses is `COULD NOT SCAN`
- [ ] REQ-02: the fixture snapshot is asserted non-empty first (≥ 12 records, ≥ 3 clusters, at least one cluster with ≥ 2 members, each asserted by count before any hash is compared); a bats arm fails if the real adapter code path is not entered; the same snapshot gives an equal `clusters.json` sha256 across two runs and a shuffled-input run, compared to the golden committed at `tests/discover/fixtures/hn-snap-01/clusters.sha256`, so all 3 legs equal one committed value
- [ ] `discover-miner.bats` FAILS (never skips) if `recorded/hn.json` is missing or has 0 hits, and asserts a real-adapter-only field (`objectID`) came out of the replay
- [ ] the double-fetch fixture gives one `idea.captured`; the reject fixture gives `previously rejected {receipt id}`
- [ ] live mini-hunt receipts found by id in `events/` (not `_quarantine/`); production `idea.captured` count > 0 recorded
- [ ] `/arc-attack` two surfaces on the local commit carrying `fixed-defects.md`; every high/medium fixed; lows → `debt-ledger.md`
- [ ] CI per JOB green via `ci-digest.mjs`, head SHA asserted
- [ ] closed through `/arc-phase-done 01` from the MAIN clone right after the merge; lane header + PORTFOLIO row in the same commit

## Verification plan

- **Test command:** CI bats `tests/discover-miner.bats` · `tests/discover-cluster.bats` (never run on this box).
- **Expected failure first:** `discover-cluster.bats` "a title carrying a command substitution never executes and appears escaped in clusters.json" (hostile text read from a fixture file, never from the test name) fails first because `/arc-hunt` is still the Phase 00 stub and exits 2 with `not built yet`. `discover-miner.bats` "429 is SOURCE_HTTP, never an empty result" fails first for the same reason.
- **Live demo scenario:** from the main clone after the merge: `node .claude/scripts/discover/arc-discover.mjs hunt "invoice reminders" --offline-fixture tests/discover/fixtures/hn-snap-01 --out {tmp}/h1` twice → the printed sha256 equals `tests/discover/fixtures/hn-snap-01/clusters.sha256`; the shortlist lists clusters with `source_url`s. Then the live mini-hunt on the owner's niche prints its receipt ids.
- **Real-system check:** live mini-hunt receipts in the canonical spine's `events/`; the recorded HN response replays through the real adapter on CI.
- **Expected evidence:** `initiatives/discover/evidence/phase-01/` holds the hash lines, the recording's provenance (date, request count), the live receipt ids + quarantine listing, the production count, the CI run id with per-job conclusions.

## Rabbit holes in this phase

- Tuning the Jaccard threshold beyond the fixture snapshot: pick it once and record the value.
- Editing growth's adapter "just to add a field": ADR-1911 routes it to growth.

## Out of scope for this phase

- scoring, council, exporter, inbox
- any second source

## Non-negotiables (verbatim from PLAN)

- Miner, normalizer, clusterer and exporter are parser-class: hostile web text must never reach a shell, an eval or the yaml, proven by injection fixtures in BOTH the clusterer and the exporter (twin-fix rule).
- The `venture.yaml` is written by a serializer, never string-built, and carries exactly the LAU-J fields (ADR-1905).
- Two-surface adversarial pass via `/arc-attack` (ADR-0226) per PR, logic and boundary, carrying `initiatives/discover/fixed-defects.md`; the author is never the attacker.
- Deterministic pipeline: the same snapshot gives identical clusters, scores, order and yaml bytes on all 3 OS legs against a committed golden hash; no float, locale sort, CRLF, wall-clock or absolute path in any hashed output.
- Evidence links are preserved end to end: a score without clickable sources is invalid, and a `venture.yaml` without a linked `.hunt.md` is invalid.
- Zero new spine kinds and no edit to any council payload; reads go through the spine reader only (ADR-1906, ADR-1910).
- growth's adapter and launch's contract are imported, never copied or edited (ADR-1901, ADR-1912).
- Zero npm deps; central `tests/`; tests run on CI only, and every fixture asserts it RAN before asserting what it printed.
- Model tiers are named by ADR-0069 tier names; no quiet `model:` edits.
