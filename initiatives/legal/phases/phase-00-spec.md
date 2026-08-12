# Phase 00 — steel thread: three core pages, end to end

**Goal (one line):** a fixture venture's `facts.yaml` renders the three hardest policy pages through
a real, pure render function, all three lints run on the RENDERED bytes, and the whole path is
byte-reproducible — the plan's own kill-criteria floor, reached by building forward.
**Appetite:** 2 days — blown appetite = cut scope or kill, never extend silently
**Depends on:** none

## Why this phase exists in this shape

The design source's Phase 0 authored ALL content and rendered nothing, so at 40% of appetite nothing
would have gone input → render → output. ADR-1000 restructures it: content stays first (these three
pages hold every hard clause), and the deliverable is exactly the kill-criteria fallback — *"ship the
three core pages' content + bank the engine"* — so the fallback is reached by building forward
rather than by retreating.

**Why REQ-01 says Phase 1 while this phase builds its machinery:** every REQ maps to exactly one
phase — the phase in which it fully CLOSES. REQ-01 is "one facts file becomes seven correct pages",
and seven pages do not exist until Phase 1. Phase 0 builds the schema, the render, the lints and the
six cross-product fixtures that REQ-01 will be closed against, and closes REQ-02 (the evidence-linked
money and DPDP lines, which live in the three pages authored here). A phase-0 exit criterion is not
a REQ; this file's checklist is what Phase 0 is judged on.

## Executor contract — everything Phase 0 needs that lives nowhere else

<!-- Written to close 13 blockers found by the simulation gate, which reads ONLY PLAN.md and this
     file. Anything an executor must know and cannot derive from those two belongs here, inlined,
     not cited. A citation to a file the executor may not open is a blocker wearing a reference. -->

**CLI shape.** `.claude/scripts/legal/arc-legal.mjs`, `#!/usr/bin/env node`, zero-dep ESM.
Subcommands in Phase 0: `render`. Flags: `--venture NAME` (required), `--out DIR` (required in
tests, defaults to `legal/rendered/` relative to the venture root), `--help`. Flag values are always
separate argv entries (`--venture X`, never `--venture=X`) and every flag value is quoted at call
sites. Unknown flag or missing required flag prints usage to stderr and exits `2`.

**Exit codes** — three, deliberately, so "could not check" is never the same shape as "clean":
- `0` — the render produced bytes. WARN-level lint findings are PRINTED and do **not** change the
  exit code while their group is in TRIAL; in Phase 0 no group is promoted, so no lint finding
  exits nonzero.
- `2` — the render could not produce trustworthy bytes: schema violation, a named parse error, a
  canonicaliser refusal, or a finding in a lint group that has been promoted out of TRIAL.
- `3` — could not run at all: unknown venture, unreadable facts file, missing template set. Never
  folded into `0` or `2`.

**Facts file.** `facts.yaml` at the venture root. The parser accepts a deliberately small YAML
subset and every construct outside it is a NAMED parse error, not a best-effort read:

| Accepted | Rejected with a named error |
|---|---|
| UTF-8; LF or CRLF; `#` comments outside quotes | anchors, aliases, tags, merge keys, flow collections `{}` `[]` |
| top-level mapping, 2-space indent, nesting depth <= 3 | multi-line and folded scalars |
| block sequences (`- ` items) | tabs anywhere in indentation |
| double-quoted strings, and bare tokens matching `^[A-Za-z0-9_@./:+-]+$` | a bare token with a leading zero (`030`) — the YAML 1.1 octal trap |

Typing is explicit, never inferred loosely: INT only for `^-?(0\|[1-9][0-9]*)$`, BOOL only for exactly
`true` / `false`, DATE only for `^\d{4}-\d{2}-\d{2}$`; everything else is a string. A quoted `"1000"`
is a string and a bare `1000` is an INT, and the canonicaliser type-tags both so they cannot collide.

**Facts fields for Phase 0** (the three risk tiers of ADR-1002 — ENUM/INT/BOOL/DATE are safe,
FORMAT is regex-bounded, FREE-TEXT is length- and charset-bounded and denylisted on OUTPUT):

| Field | Tier | Values / bound |
|---|---|---|
| `operator.type` | ENUM | `individual` / `entity` |
| `operator.legal_name`, `operator.trade_name` | FREE-TEXT | <= 80 chars, no markup, no URL |
| `geographic_address` | FREE-TEXT | <= 200 chars, no markup, no URL |
| `support.email`, `grievance.email` | FORMAT | anchored email regex |
| `support.phone` | FORMAT | `^\+?[0-9 -]{6,20}$` |
| `grievance.name` | FREE-TEXT | <= 80 chars |
| `grievance.ack_hours` | INT | 1..720 |
| `data_categories[]`, `purposes[]` | ENUM | closed vocabularies in `products/legal/data/vocab.json` |
| `retention` | ENUM | `until-account-deletion` / `statutory-period` / `fixed-months` |
| `deletion_route.mailbox` | FORMAT | anchored email regex |
| `analytics[]` | ENUM | allow-list in `vocab.json`; empty array is legal |
| `payment_model` | ENUM | `gateway` / `mor` / `none` |
| `payment_provider` | ENUM | `razorpay` / `none` |
| `refund_window_days` | INT | 0..365 |
| `gst_registered` | BOOL | + `gstin` FORMAT `^[0-9A-Z]{15}$` required when `true` |
| `stores_third_party_client_data` | BOOL | when `true`, `sub_processors[]` must be NON-EMPTY |
| `sub_processors[]` | FREE-TEXT | <= 80 chars each |
| `site_url` | FORMAT | `^https://` only |
| `routes.<page>` | FORMAT | `^/[a-z0-9/-]{1,64}$`, defaults per ADR-1010 item 7 |
| `effective_date` | DATE | ISO date |

**Template syntax.** Templates live at `products/legal/templates/v1/PAGE.tmpl.md`. Two constructs
only, and no expression language:

```
{{#clause id=REFUND.WINDOW when=payment_model=gateway}}
We refund to your original payment method within {{ facts.refund_window_days }} days.
{{/clause}}
```

`id=` is a dotted uppercase clause id, unique within the page. `when=` is a single `field=value`
equality against a top-level or dotted facts field, or is omitted (always included). `{{ facts.x.y }}`
is a dotted path lookup and nothing else. Every emitted clause writes a marker into the rendered
bytes — `<!-- clause:REFUND.WINDOW set:v1@SHA -->` — so **trace-lint reads the RENDERED output**, never
the template source. The enum-to-clause map is `products/legal/data/clause-map.json`, with **one key per branching field** —
both of REQ-01's axes, not only the payment one:

```json
{ "payment_model":   { "gateway": ["REFUND.WINDOW"], "mor": ["REFUND.MOR"], "none": ["REFUND.OFFLINE"] },
  "gst_registered":  { "true":    ["PRICING.GSTIN"], "false": ["PRICING.NO_GST"] } }
```

A clause id emitted into a page but absent from every branch list of the field that selected it is a
trace-lint FAIL; a clause id listed for a branch that was NOT selected but appearing in the output is
a branch-mismatch FAIL. Those are the two directions, and both are fixture-pinned.

**The grievance window is DATA, not a remembered number.**
`products/legal/data/grievance-windows.json` holds one row per instrument and the template prints
the STRICTEST value across rows whose `in_force_from` has passed. A row with no `source_url` is a
lint FAIL — the module's own thesis applied to itself. **The two Phase-0 seed rows are supplied
here in full, so the executor copies rather than researches** (this phase does no network work):

```json
[
  { "instrument": "Consumer Protection (E-Commerce) Rules 2020",
    "ack_hours": 48, "resolve_days": 30,
    "source_url": "https://www.indialaw.in/blog/blog/consumer-protection-e-commerce-rules-2020/",
    "in_force_from": "2020-07-23", "source_kind": "secondary", "verified_on": "2026-08-03" },
  { "instrument": "DPDP Rules 2025, Rule 14(3)",
    "ack_hours": null, "resolve_days": 90,
    "source_url": "https://www.dpdpa.com/dpdparules/rule14.html",
    "in_force_from": "2027-05-13", "source_kind": "secondary", "verified_on": "2026-08-12" }
]
```

Both rows are `source_kind: secondary` and both are re-verified against the gazette before the first
REAL venture publish (Phase 3, assumptions-ledger row 2). `resolve_days: null` is legal and means
the instrument sets no resolution window; `ack_hours: null` likewise. A `null` is NOT a zero and the
strictest-value computation skips nulls rather than treating them as the tightest bound.

**Dark-pattern-free cancellation** (ADR-1008), the three testable criteria the refund page must
state and the checklist must later check: (a) cancelling takes no more steps than subscribing did;
(b) auto-renewal amount and date are disclosed before the charge, not after; (c) no retention maze —
no mandatory call, no offer-gate, no hidden final step. The page states each as a commitment in
plain words; a scenario fixture ("cancellation path") must resolve to the clause carrying them.

**FREE-TEXT bounds**, applied at the point of interpolation and again on rendered bytes:
allowed characters are `A-Za-z0-9`, space, and `. , ' - & / ( ) @ :` — nothing else. Rejected
outright: `<` `>` `[` `]` `{` `}` `|` `\` backtick, any control character, any `\r` or `\n`, any
run of 2+ spaces, and any substring matching `https?://` or `www.` (a URL in a name field is a link
smuggled into a sentence). Length bounds are per-field in the table above. The check that matters is
the one on the RENDERED output — an input-side check alone is defeated by any encoding the renderer
later undoes.

**Closed vocabularies**, seeded in `products/legal/data/vocab.json`, extended only by reviewed diff:
- `data_categories`: `identity` · `contact` · `account-credentials` · `billing` · `usage-analytics` ·
  `device-and-log` · `support-correspondence` · `client-matter-content` · `uploaded-documents`
- `purposes`: `provide-the-service` · `authenticate-and-secure` · `billing-and-invoicing` ·
  `support-and-communication` · `legal-and-regulatory` · `service-improvement`
- `analytics`: `none` · `first-party-only` · `plausible` · `posthog` · `google-analytics`

**`--venture NAME` resolution in Phase 0** is exactly one rule: `NAME` resolves to
`tests/fixtures/legal/ventures/NAME/facts.yaml`, relative to the repo root, and a `NAME` containing
a path separator or `..` is refused. Resolving against a real venture root is Phase 3 scope and no
code for it exists in this phase.

**Output contract** — the one channel every lint test and REQ-02's evidence recording depend on:
- Human-readable findings go to **stderr**, one per line, exactly
  `WARN <group>:<page>:<clause-id>:<message>` or `FAIL <group>:<page>:<clause-id>:<message>`, where
  `<group>` is `value` / `trace` / `completeness`. A finding with no clause id uses `-`.
- A machine-readable sidecar is written to `DIR/_run.json` alongside the pages, holding
  `{engine_version, template_set_sha, facts_sha256, pages: [{page, output_sha256, clauses: [id],
  transforms: [name], evidence_links: [{claim, url}]}], findings: [{group, page, clause, level,
  message}], exit_code}`. Tests assert against this sidecar, never by scraping prose.
- "A lint goes RED" in this phase means **the finding appears in `_run.json.findings` with
  `level: "FAIL"`** — the exit code stays `0` while the group is in TRIAL, and asserting on the exit
  code alone would be a test that passes whatever the lint does.

**Trial-ledger entry** — append one row to the existing table in `docs/trial-ledger.md`, matching its
columns exactly: `| date | gate | run-ref | fired? | false-positive? |`. Do not add columns and do
not reformat existing rows.

**`$SCRATCH`** in the demo below is any writable temp directory the operator exports; nothing is
written into the repo tree by a render during this phase.

**Compliance-claim denylist**, seeded in `products/legal/data/claim-denylist.json` and checked
case-insensitively against RENDERED bytes: `certified`, `compliant`, `compliance guaranteed`,
`government approved`, `ISO`, `SOC 2`, `GDPR compliant`, `DPDP compliant`, `reviewed by counsel`,
`legally binding advice`, `bank-grade`, `100% secure`, `guaranteed`. Extending it is a reviewed diff.

**Fixture ventures** — six files, one per cell of `payment_model` x `gst_registered`, at
`tests/fixtures/legal/ventures/NAME/facts.yaml`:
`fixture-gateway-gst` · `fixture-gateway-nogst` · `fixture-mor-gst` · `fixture-mor-nogst` ·
`fixture-none-gst` · `fixture-none-nogst`. There is no seventh; the demo below uses two of these six
by their real names.

**Product manifest.** `products/legal/manifest.json`, same key set every other product uses —
`name`, `version`, `requires`, `commands`, `agents`, `scripts`, `docs` (an array of
`{src, dest}` pairs). Sync is `bash sync-to-project.sh TARGET_DIR` from the repo root.
Regenerating the byte-identity fixture, as one named step after diffing the delta:
`bash sync-to-project.sh "$SCRATCH" >/dev/null && _arc_tree_manifest "$SCRATCH" > tests/fixtures/sync-golden/tree-manifest.txt`
(`_arc_tree_manifest` is defined in `tests/test_helper.bash`).

**The adversarial agents are Task-tool subagents**, `subagent_type: general-purpose`, spawned fresh
with no sight of the implementation session. Two code surfaces, separate charters: (a) decision
logic — the lint rules, the clause map, the branch selection; (b) the shell and OS boundary —
argv quoting, paths, encodings, CRLF, case-insensitive filesystems, embedded programs. Three text
stances, one agent each: hostile customer · regulator · competitor's lawyer. Each prompt carries
`initiatives/legal/evidence/fixed-defect-list.md` with the instruction to check every entry in every
OTHER file.

**Tracker.** `initiatives/legal/PROGRESS.md` — flip this phase's row in the `## Phases` table from
`pending` to `✅ done <date>`, append a done-log entry naming the CI run id, re-derive the
appetite-burn line rather than carrying it forward, and rewrite `## Now`.

## Exit criteria (Definition of Done)

- [ ] `products/legal/schema/facts.schema.json` (or its zero-dep equivalent) implements ADR-1002's three risk tiers; every field is tiered, and an unknown enum value is a parse error rather than a passthrough.
- [ ] `tests/fixtures/legal/ventures/` holds **SIX sibling fixture facts files spanning the full `payment_model` x `gst_registered` cross product** (ADR-1011), named exactly as the executor contract lists them. Three files with `gst_registered` varied incidentally across a subset leaves untested cells in a product REQ-01 claims both axes select branches on.
- [ ] `products/legal/data/` holds `vocab.json`, `clause-map.json`, `grievance-windows.json` and `claim-denylist.json`, each shaped as the executor contract defines, and a lint FAILs any `grievance-windows.json` row missing a `source_url`.
- [ ] Three pages AUTHORED as original text: `terms`, `privacy`, `refund-cancellation` — carrying the DPDP Rule-3 notice block **stating explicitly that it is adopted voluntarily and in ADVANCE of the Rules' commencement** (ADR-1006: Rule 3 commences 13/14-May-2027, and the non-negotiables forbid implying an obligation is in force before it is), the processor clause, the unified grievance block with the strictest window printed, and the dark-pattern-free cancellation wording (ADR-1008).
- [ ] `.claude/scripts/legal/arc-legal.mjs render --venture NAME --out DIR` writes those three pages as static MDX under `DIR/` and exits `0`, printing any TRIAL-level lint findings as warnings without changing the exit code. The three exit codes behave exactly as the executor contract above defines them, and a fixture asserts all three are reachable — `3` (unknown venture) is distinct from `2` (bad facts) is distinct from `0`.
- [ ] value-lint, trace-lint and completeness-lint all run over the rendered output. WARN-first in TRIAL; the trial set and its promotion criteria are recorded in `docs/trial-ledger.md` in the same change — with `git log origin/main --oneline -5 -- docs/trial-ledger.md` run immediately BEFORE editing it, per the shared-file rule in `.claude/rules/lanes.md`, because bench, engine and leads are all LIVE and that ledger grows by append.
- [ ] Byte-reproducibility fixture: two renders of identical inputs produce identical bytes, asserted on the bytes and not on a summary line.
- [ ] Canonicaliser-totality fixture: `1000` vs `"1000"`, and a disabled vs unset optional field, produce DIFFERENT `facts_sha256` values; a numeric field written `030` produces a NAMED PARSE ERROR rather than being silently coerced to `24` (YAML 1.1 octal ambiguity); NFC and NFD encodings of an identical string value produce the SAME `facts_sha256` (normalised before hashing, never left to accidental byte equality); `undefined` / `NaN` / `+Infinity` / `-Infinity` / `BigInt` / a cycle are REFUSED with a named error rather than coerced (ADR-1004, assumptions row 7).
- [ ] **Every `@test` name across `tests/legal-*.bats` is 7-bit ASCII**, and each suite DERIVES and asserts its own registered-test count rather than pinning a literal. bats silently drops a `@test` whose title carries a non-ASCII character — five tests were never registered, never ran and never failed, and the file was green (`arc-evolve` 2026-08-04). The bullet above used to read `±Infinity`, and that character sat inside the very criterion protecting the hash chain.
- [ ] The render records, per page, **which transforms it applied** (escaping, normalisation) — ADR-1002's transform-disclosure obligation.
- [ ] **Two-surface adversarial pass on the three lints**, by two FRESH agents that have not seen the implementation: one on decision logic, one on the shell and OS boundary. Every found hole fixed and pinned as a fixture. Each attacker prompt carries this lane's running fixed-defect list with the instruction to check each entry in every OTHER file.
- [ ] The running fixed-defect list is committed as `initiatives/legal/evidence/fixed-defect-list.md` (one row per hole: file · defect class · fix commit) and updated in the SAME commit as each fix. Phases 1–3 name this list in their attacker prompts; it must be a file they can read by path, not a session's memory of Phase 0 — the twin-fix recurrence was only closed once the list became a persisted artifact every OTHER file is checked against (`arc-absorb` 2026-08-09 / 2026-08-10).
- [ ] **Negative control that RUNS:** a mutant renderer (one that emits an unpinned clause, and one that lets a denylisted claim through) is executed and each lint is asserted to go RED. A grep is never the guard.
- [ ] **Text attack panel on the RENDERED bytes** of the three pages, three stances (hostile customer · regulator · competitor's lawyer). Findings triaged; anything the panel calls unsound in the processor or DPDP clause fires the kill-criteria path (ADR-1007).
- [ ] `products/legal/manifest.json` exists; `tests/fixtures/sync-golden/tree-manifest.txt` regenerated as a NAMED step with the delta diffed first.
- [ ] tests added and green **on CI**, per-JOB conclusions read (never the watcher's exit code).
- [ ] tracker updated (`PROGRESS.md` row ✅ + done-log) and the evidence bundle written to `initiatives/legal/evidence/phase-00/`.

## Verification plan

- **Test command:** `bats tests/legal-render.bats` then `bats tests/legal-lints.bats` then
  `bats tests/legal-hash.bats` — one file at a time, foreground; **CI is the gate**
  (`.claude/rules/testing.md`). `legal-render.bats` covers the render's purity and the three-branch
  selection; `legal-lints.bats` covers value / trace / completeness plus the mutant negative
  controls; `legal-hash.bats` covers canonicaliser totality and byte-reproducibility.
- **Expected failure first:** `bats tests/legal-render.bats` fails on its first case,
  `@test "a fixture facts file renders three pages"`, with
  `bash: .claude/scripts/legal/arc-legal.mjs: No such file or directory` and status `127` — nothing
  exists yet.
  **The second red is the one that matters:** `@test "a mutant renderer that emits an unpinned
  clause turns trace-lint red"` copies the render tree, patches it to emit a clause with no
  template-block id, runs the real lint against the mutant's output, and asserts the lint EXITS
  NONZERO. It fails today and must keep failing until trace-lint is built as a lookup over the
  enum→clause map — because a lint that merely counts clauses, or that reads the template source
  instead of the rendered bytes, stays GREEN against this mutant. That is the whole control: the
  guard is proven by something that runs, not by a grep.
  **Third red:** `@test "1000 and the string 1000 do not share a facts hash"` feeds two facts files
  differing only in the scalar type of `refund_window_days` and asserts the two `facts_sha256`
  values DIFFER. It is red until the canonicaliser type-tags scalars. `arc-evolve` 2026-08-04
  shipped exactly this collision, and the JSON.stringify "fix" then folded `NaN` to `null`.
  **Fourth red:** `@test "a page with zero mandatory clauses fails completeness, not provenance"`
  renders a facts file whose privacy page emits only its heading, and asserts completeness-lint
  reports a MISSING-CLAUSE failure naming the clause id — not a pass. A gate whose only failure mode
  is rule-breaking cannot detect an empty page (retro-log 2026-07-30).
  **Fifth red:** `@test "a compliance claim smuggled through a free-text value is caught in the
  RENDERED output"` sets `trade_name` to a value carrying a denylisted claim token in an encoding
  the renderer undoes, and asserts value-lint fires on the rendered bytes. A denylist applied to the
  INPUT stays green here.
- **Live demo scenario:** (1) `node .claude/scripts/legal/arc-legal.mjs render --venture
  "fixture-gateway-gst" --out "$SCRATCH/a"` → three `.mdx` files written under `$SCRATCH/a`, exit
  `0`, and the printed transform list names every escaping and normalisation step applied.
  (2) Open the rendered `refund-cancellation.mdx` **and read it** — an agent's report about the text
  is not the text (retro-log 2026-07-30). (3) `… --venture "fixture-none-nogst" --out "$SCRATCH/b"`
  → the same command against the `payment_model: none` fixture prints no gateway processing-day
  language and no refund-to-original-method wording, and its GST lines differ from (1).
  (4) `… --venture "no-such-venture"` → exit `3`, not `2` and not `0`. (5) Re-run (1) into
  `$SCRATCH/c` and `sha256sum` every file in `a` and `c` → identical.
- **Real-system check:** n/a — fakes only this phase. No provider is contacted, no site is fetched,
  no venture repo is written to.
- **Expected evidence:** `initiatives/legal/evidence/phase-00/` holding the CI run id with per-job
  conclusions, the two adversarial reports (one per surface) with every finding and its fixture, the
  text-attack-panel report over the rendered bytes, the mutant negative-control output showing each
  lint RED, and the two byte-identical render hashes.

## Rabbit holes in this phase

- **Prose perfectionism on the three pages.** ADR-1009's answerability is the bar; taste is post-ship.
- **Making trace-lint clever.** It is a lookup over the enum→clause map. Anything smarter is a future ADR.
- **Over-normalising for hash stability.** The transform that buys determinism can delete the signal
  being judged (retro-log 2026-07-30) — hence the transform-disclosure exit criterion.
- **Writing the lints and their tests in one pass.** The pass condition (scenario set, clause-ID map)
  is committed in its OWN commit before the harness exists (ADR-1009, retro-log 2026-08-10).

## Out of scope for this phase

The other four pages, the scenario fixture set, the completeness lint over all seven, the inbox
wiring and the hash-chain enforcement → Phase 1. `--verify`, pins, `--bump-templates`, the checklist
and the probe → Phase 2. Any real venture facts → Phase 3.

## Your-setup / pending

Nothing. This phase runs entirely offline against fixtures — no keys, no accounts, no network, and
**no research**: every regulatory value the executor must write down (the two grievance-window rows,
the denylist, the vocabularies) is supplied verbatim in the executor contract above, precisely so
that "author an evidence-linked legal fact" never collides with "do not use the network". The two
fresh attackers and the text attack panel are agents this session spawns, not owner actions.

## Non-negotiables (verbatim from PLAN)

- Not a lawyer, never pretends to be: no invented legal claims, and no compliance badge without a demonstrable truth plus an evidence link (Constitution E3, ADR-0012). Rendered pages carry no "reviewed by counsel" implication until ADR-1007 fires and it is true, and no page or checklist may imply a DPDP obligation is in force before it commences (ADR-1006).
- The human gate is permanent (REQ-06): every publish is L1, propose-only, and no auto-publish path exists in code. `targets.publish` in `hq.policy.yaml` stays empty (ADR-1003).
- All three lints (value / trace / completeness) are WARN-first in TRIAL, and no promotion to FAIL happens without an adversarial pass first — facts files and templates are hostile input (ADR-1002, ADR-1009).
- Every gate gets TWO fresh attackers with different surfaces (decision logic · shell and OS boundary), and each attacker prompt carries this lane's running fixed-defect list with "check each one in every OTHER file". The negative control is a MUTANT that runs, never a grep.
- The text-level attack panel runs on the RENDERED bytes of the authored set before Phase 0 closes — content is parser-class too, and a transform applied for lint stability must declare what signal it destroys (ADR-1002).
- Hash-chain law (ADR-1004): no publish without a bound receipt; no silent edits; no backdating; the canonicaliser is total and type-tagged; the preimage carries its own version and `--verify` reports stale-format and tamper as different exit codes.
- Emitter and reader discipline: zero new event kinds; every emit verified in `events/` AND `events/_quarantine/` by event id, never by ULID substring; `decision.recorded` only via `arc-inbox`.
- Zero-dep Node and POSIX (A2); central `tests/` (ADR-0021); tests run on CI, never on this box; never delete — superseded template versions and retired pages keep their files (A10).
- Original drafting only: no copied third-party policy text.
- Constitution articles this plan upholds, for kickoff-lint: E3, A2, A5, A8, A9, A10.
