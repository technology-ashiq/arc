# Phase 00 — Foundations

**Goal (one line):** The steel thread — an ICP file in, 29 dossiers (25 PASS) in a private
store outside the repo, and one typed receipt on the spine carrying no PII, with the
deliverability gate refusing on a live check.
**Appetite:** 1.5 days
**Depends on:** none

## Ordering constraint (non-negotiable within this phase)

**ADR-0410 lands FIRST.** The private store, the HMAC secret, and the tripwire lint are
built and green **before the researcher exists**. Building the researcher first would create
PII before the thing that protects it.

## Exit criteria (Definition of Done)

- [ ] **ADR-0410 store**: resolves from `ARC_LEADS_STORE` env with an `os.homedir()`-based `~/.arc/leads/` default — **never a literal `~`** (POSIX sh does not expand `~` inside a variable, and the Windows leg's `HOME` and `USERPROFILE` differ). Store path appears in **no** tracked file. **The HMAC secret is minted by exactly one explicit command (`arc-leads store init`) and is never auto-created** — every other entry point that finds no secret STOPs with `store not initialised — check ARC_LEADS_STORE`
- [ ] **Store identity binding (Phase-00 half only — see C19)**: each store carries a `store_id` + secret fingerprint `sha256(secret)[0:8]`, stamped into every `lead.researched` payload. Fixtures: unset `ARC_LEADS_STORE` on a box that has a real store → refused, nothing initialised · two different stores → different `lead_id` for the same address. **The fingerprint-mismatch and empty-journal fixtures move to Phase 01**, which is where the send path and journal reader exist
- [ ] **Tripwire lint green and hostile-proven on every CI leg**: email-shaped string in a tracked non-fixture file → FAIL · non-reserved-domain address inside a declared fixture path (`tests/fixtures/leads/**`) → FAIL (C5's reserved list is authoritative; scan scope + exit codes in C16) · **store path in any tracked file → FAIL in BOTH native forms** (backslash `C:\Users\...\.arc\leads` and `/c/Users/.../.arc/leads`), case-folded — a prior cycle lost an entire capability scan to one backslash in a path · a fixture asserts the resolved store path is absolute and outside the repo root **on each leg**
- [ ] **ADR-0400 + ADR-0408 vocabulary in ONE edit**: `KINDS` 31 → **39** — the seven pipeline kinds **plus** `metric.observed` in the same commit, so the closed vocabulary, the sync-golden and the install manifest are each touched exactly once this cycle. Closed-payload validators; total-preimage idem formulas; `lead_hmac_v1_HEX32` id grammar; `metric.observed` `source_id` grammar accepting **both** `h-HEX16` and `lead_hmac_v1_` forms; stream-contract fixture scoped to the validator per C20
- [ ] **`approval.requested` gets a leads-scoped emitter guard, NOT a closed validator** (C15). It is an in-flight shared kind other lanes emit; imposing a closed key set from this lane would break them. Instead `lib/receipts.mjs` is the only leads approval-emitter, builds the payload from a fixed literal, and a fixture asserts exactly those keys with no email-shaped or >200-char value
- [ ] **ADR-0411 journal schema** defined and validated: intent = `{idempotency_key, lead_hmac, campaign, touch_n, draft_sha, submitted_at, store_fingerprint}`. **`submitted_at` is stamped immediately before submit and is the ONLY clock ADR-0403's daily cap buckets by** — the spine emit time is not, or a recovery receipt written after midnight moves a send to the next IST day and frees a slot on both. `outreach.sent` payloads carry `submitted_at` (provider timestamp when available, else the intent's). The reconciler itself is Phase 01
- [ ] **ICP file format** defined (it names the `campaign`, per C14's charset); `arc-leads research ICP.json` on the C6 corpus produces **29 dossiers — 25 PASS, 1 HELD, 3 BELOW-BAR — and 5 rejections with exclusion reasons**
- [ ] **ADR-0409 research lint** green: purchased → rejected · login-wall → rejected · missing geography → rejected · out-of-allowlist (ADR-0406) → rejected · unverified email → HELD · rejected candidate with no exclusion reason → invalid · **ICP-generic-only fact → BELOW-BAR dossier, not citable for REQ-02**
- [ ] **REQ-00 deliverability preflight** (C10/C18) refuses on a **live** check failure regardless of what any evidence file claims; **never prints PASS for the attested warm-up clause**; **refuses on the committed empty `sending_domain`** — the honest value, since the domain does not exist (ADR-0413)
- [ ] **Provider interface + fake** (ADR-0402's four requirements), contract tests green against the fake — **including the test that points the real `lib/provider.mjs` at an unreachable endpoint and asserts it reached its own code**, so the fake is proven to swap the response and not the code path
- [ ] **ADR-0401**: a unit assertion proves the emitter resolves to the COMPANY spine, not a venture's — asserted on the resolved path, never by writing fixture receipts into the real organ (the demo runs under a temp `ARC_SPINE_ROOT`)
- [ ] **Emitter reality check**: after wiring, LOOK in `events/` **and** `events/_quarantine/` and assert which holds the receipt. Exit 0 from the emitter is not evidence anything was written (this class has cost three cycles)
- [ ] Receipt fixtures green: raw email in payload → rejected · bare unkeyed `h-HEX16` as a **lead id** → rejected · non-UTC timestamp spelling → rejected (C14) · `campaign` containing `|` → rejected · duplicate send idem impossible · **`state --json` determinism + order-independence + fold-completeness** per C11 (no campaign report exists yet — that artifact is Phase 03)
- [ ] **Sync-golden + `leads` install-manifest section regenerated in the same commit** as any `.claude/**` change
- [ ] tests green **on CI** (never on this box) — per-JOB conclusions read, not the watcher's exit code
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Contracts (frozen at kickoff — type from THESE, never from an ADR)

> The executor's information set is PLAN.md + this file. A contract that lives only in an
> ADR is a blocker, not a reference. The simulation gate found 13; they are closed here.

### C1 — The eight new kinds (`KINDS` 31 → 39, ONE edit)

```
lead.researched   outreach.sent   outreach.replied   meeting.booked
lead.suppressed   deal.won        deal.lost          metric.observed
```

### C2 — Closed payloads (exact key sets; unknown key → reject)

| Kind | Required | Optional |
|---|---|---|
| `lead.researched` | `lead_id, campaign, provenance, geography, email_status, fact_count, store_id, store_fingerprint` | `below_bar` |
| `outreach.sent` | `lead_id, campaign, touch_n, idem_key, provider_message_id, submitted_at, draft_sha` | — |
| `outreach.replied` | `lead_id, campaign, triage_class, ingested_at` | `in_reply_to_touch` |
| `meeting.booked` | `lead_id, campaign, booked_at` | — |
| `lead.suppressed` | `lead_id, reason, suppressed_at` | `campaign` |
| `deal.won` / `deal.lost` | `lead_id, campaign, decided_at` | `amount_inr` |
| `metric.observed` | `module, surface, metric, value, unit_count, window_start, window_end, source_id` | `variant, cohort` |

**Forbidden in every payload:** any raw email, name, URL, subject, body, or free-text
summary field. `email_status ∈ {verified, held}`. `triage_class ∈ {interested, later, no,
bounce, unsubscribe}`. `reason ∈ {bounce, unsubscribe, manual}`.

### C3 — Idem preimages (total; absent optional = literal `-`)

```
lead.researched   sha256("lead.researched|"  + campaign + "|" + lead_id)
outreach.sent     sha256("outreach.sent|"    + campaign + "|" + lead_id + "|" + touch_n)
outreach.replied  sha256("outreach.replied|" + campaign + "|" + lead_id + "|" + ingested_at)
meeting.booked    sha256("meeting.booked|"   + campaign + "|" + lead_id + "|" + booked_at)
lead.suppressed   sha256("lead.suppressed|"  + lead_id  + "|" + reason)
deal.won|lost     sha256("<kind>|"           + campaign + "|" + lead_id)
metric.observed   sha256("metric.observed|module|surface|variant|cohort|metric|window_start|window_end|source_id")
```

### C4 — Lead id derivation

```
secret   = 32 random bytes, hex-encoded, at $ARC_LEADS_STORE/secret.v1  (mode 0600)
lead_id  = "lead_hmac_v1_" + HMAC-SHA256(key=raw 32 bytes, msg=normalize(email)).hex().slice(0,32)
normalize(email) = email.trim().toLowerCase()
store_fingerprint = sha256(hex-encoded secret string).slice(0,8)
store_id = 16 random hex chars, at $ARC_LEADS_STORE/store_id
```

**Keyring:** secrets are `secret.v1 … secret.vN`; rotation ADDS a version and retires none.
Suppression checks derive under **every** retained version and refuse on any hit.

### C5 — Closed allowlists

```
PROVENANCE_ALLOWLIST = ["firm-site", "public-directory", "public-listing", "manual-linkedin-note"]
JURISDICTION_ALLOWLIST = ["IN"]     // ISO 3166-1 alpha-2, uppercase
FIXTURE_RESERVED_DOMAINS = ["example.com", "example.net", "example.org", ".test", ".invalid"]
```

### C6 — Lead source (the dependency the plan was missing)

The researcher needs candidates from somewhere, and offline-first means an interface + fake
like every other dep. Added to PLAN's External-dependencies table.

```
.claude/scripts/leads/lib/source.mjs       search(icp) -> [candidate]
.claude/scripts/leads/lib/source-fake.mjs  reads tests/fixtures/leads/candidates.json

candidate = {
  name, email, firm,
  geography,                  // ISO-3166 alpha-2, uppercase
  provenance,                 // one of C5's PROVENANCE_ALLOWLIST, or a bad value for negatives
  source_urls: [ url, ... ],  // >=2 required
  facts: [ { text, evidence_url, relevance } ]   // relevance = the fact->offer line; "" means missing
}
```

**Fixture corpus `tests/fixtures/leads/candidates.json` — 34 rows, reserved domains only.**
The outcome space is four-way, not two-way; the earlier "25 accepted + 9 rejected" was
self-contradictory because HELD and BELOW-BAR are *accepted-with-a-flag*:

| Bucket | Count | Rows |
|---|---|---|
| PASS (clean dossier) | 25 | the ICP-fitting 25 |
| **REJECTED** (no dossier written) | 5 | purchased provenance · login-wall provenance · missing geography · `geography: "DE"` · fewer than 2 `source_urls` |
| **HELD** (dossier written, `email_status: held`, never sendable) | 1 | unverifiable email |
| **BELOW-BAR** (dossier written, `below_bar: true`, not citable for REQ-02) | 3 | zero facts · ICP-generic-only fact · fact with `relevance: ""` |

So: **dossiers written = 29** (25 + 1 HELD + 3 BELOW-BAR), **rejected = 5**, and the demo
asserts `ls $ARC_LEADS_STORE/dossiers | wc -l` → **29**, of which **25 are PASS**. Rejected
candidates are recorded at `$ARC_LEADS_STORE/rejected.jsonl`, one object per line, each
carrying `{ candidate_ref, exclusion_reason, source_urls }` — a rejection written without an
`exclusion_reason` is itself invalid (that is the ninth negative fixture, asserted against
the writer rather than smuggled into the corpus).

### C6b — "ICP-generic fact": the deterministic predicate

A self-labelling fixture flag would be a vacuous pass, so the rule is mechanical. Definitions
are pinned because they decide which rows trip:

- **trigram = CHARACTER trigram** over `normalize(text)` (lowercased, punctuation stripped,
  whitespace collapsed to single spaces).
- **similarity = Jaccard over trigram sets**, threshold **≥0.8**.
- **co-citer count is ABSOLUTE, not a percentage.** An earlier draft said "≥20% of other
  candidates", which at 34 rows means ≥7 co-citers and could never fire on a 3-row seed —
  the rule contradicted its own corpus.

A fact is **ICP-generic** when **either**:

1. **≥3 other candidates in the same run** carry a fact at ≥0.8 similarity to it; **or**
2. its `evidence_url` host is not the lead's own `firm` domain **and** that URL appears as
   evidence on **≥2 other candidates** (a shared directory listing is not lead-specific).

**How this reconciles with C6's frozen counts — the key point:** being ICP-generic marks the
*fact*, not the candidate. A candidate drops to BELOW-BAR only when it is left with **fewer
than 2 citable facts** after generic ones are struck.

So the corpus carries **four** candidates citing "the firm has a website" and the shared
directory URL: three of them are among the 25 PASS rows and each also carries two
lead-specific facts, so they stay **PASS** with the generic fact struck. The fourth carries
*only* the generic fact and the shared URL, so it is left with zero citable facts and is the
single **ICP-generic-only** BELOW-BAR row. Both rules fire on that one row — rule 2 is not a
separate fifth candidate.

BELOW-BAR therefore stays exactly **3**: zero facts · ICP-generic-only · `relevance: ""`.
Counts hold: **25 PASS · 1 HELD · 3 BELOW-BAR · 5 REJECTED = 34**.

The fixture asserts against the **same 34-row corpus** — no micro-corpus — so the rule is
exercised at the scale it ships at, and the demo's numbers and the unit assertions cannot
drift apart.

### C13 — Fake injection

One mechanism, one env var:

```
ARC_LEADS_FAKE=1     # lib/*.mjs each export a factory that returns the fake when set
```

Each real module ends with `export default process.env.ARC_LEADS_FAKE ? fake : real`. Tests
set it; nothing else does. **The one exception is the provider-code-path test** (DoD), which
deliberately runs with `ARC_LEADS_FAKE` UNSET so the real module executes — that is what
makes it prove the fake swaps the response and not the code path.

### C14 — Timestamps

**Every `*_at` and `window_*` field is ISO-8601 UTC with a literal `Z`, second precision, no
offset form:** `YYYY-MM-DDTHH:MM:SSZ`. The validator rejects anything else, including a
`+05:30` offset spelling of the same instant — C3 concatenates these into idem preimages, so
two spellings would be two idems. **IST is a rendering and bucketing concern only:** the
daily cap converts `submitted_at` to Asia/Kolkata at comparison time via
`Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`, never by storing local time.

`campaign` is `[a-z0-9-]{1,64}` — `|` is the idem delimiter and must not be smuggleable into
a campaign name.

### C15 — `approval.requested` is NOT given a closed validator

Reversing an earlier decision, on the simulator's finding: `approval.requested` is an
**in-flight shared kind other lanes already emit**, and imposing a closed key set on it from
this lane would break them. Instead, scoped to leads:

- `lib/receipts.mjs` exposes the only leads approval-emitter, and it constructs the payload
  from a fixed literal — `{what, gate, draft_ref, lead_hmac, campaign, lint_status, draft_sha}`
- a fixture asserts that emitter's output has **exactly** those keys and that no value
  matches an email shape or exceeds 200 chars (a draft body cannot fit)
- no change to `validate.mjs`'s handling of `approval.requested`

### C16 — Tripwire scan scope

```
scope   = git ls-files, filtered to: .claude/scripts/leads/** , products/leads/** ,
          initiatives/leads/** , tests/leads-*.bats , tests/fixtures/leads/**
          , .claude/config/leads.json
exit    = 0 clean · 2 violation (path + line + rule named) · 3 usage error
```

**Leads-owned paths only**, deliberately: repo-wide would turn CI red on pre-existing tracked
content on commit 1, and the guard's job is to stop *this lane* leaking. Declared fixture
paths = `tests/fixtures/leads/**` (a path prefix, not a declaration file). Everything in
scope but outside that prefix FAILs on any email shape; inside it, only C5's reserved domains
pass. **C5's list is authoritative** over the DoD's shorter paraphrase.

### C17 — The real `lib/provider.mjs` with no vendor bound

It is a thin HTTPS client: base URL from `LEADS_PROVIDER_BASE_URL` (no default), `node:https`
transport, JSON bodies. With no vendor bound it has no credentials and no endpoint, which is
exactly what the code-path test exercises: set `LEADS_PROVIDER_BASE_URL=https://127.0.0.1:1`,
`ARC_LEADS_FAKE` unset, call `submit()`, and assert it exits **4** (`ProviderError:
transport`) — its own failure code from its own catch block, not a module-not-found and not
the fake's success path.

### C18 — `.claude/config/leads.json` (tracked, non-secret)

```json
{
  "sending_domain": "",
  "product_domains": ["lexos.app"],
  "warmup_log_path": "",
  "seed_evidence_path": "",
  "caps": {
    "per_ist_day": 20, "per_ist_day_ceiling": 20,
    "touches_per_lead": 2, "touches_per_lead_ceiling": 2,
    "rolling_window_days": 7,
    "send_window_ist": { "days": [1,2,3,4,5], "start": "09:30", "end": "18:00" }
  },
  "below_bar": { "min_cited_facts": 2, "similarity_threshold": 0.70 }
}
```

`sending_domain: ""` is the honest committed value — the domain does not exist (ADR-0413).
**Preflight refuses on an empty `sending_domain`**, which is itself a fixture. Tests override
the path with `LEADS_CONFIG=` so the committed config is never mutated by a test. Config may
lower a cap, never raise it past its `_ceiling` twin.

### C19 — What is Phase 00 vs Phase 01 (store-binding fixtures)

Phase 00 has no send path and no journal reader, so it proves only the half it owns:

- **Phase 00:** `store init` mints `secret.v1`/`store_id`; `store_fingerprint` is stamped
  into every `lead.researched` payload; a fixture asserts an unset `ARC_LEADS_STORE` on a
  box with a real store REFUSES and initialises nothing; a fixture asserts two different
  stores produce different `lead_id` for the same address.
- **Phase 01 (moved there):** "fingerprint mismatch → all sends refused" and "an empty
  journal in a mismatched store is not zero unresolved intents" — both need the send path
  and the journal reader. The **campaign record** they compare against lives at
  `$ARC_LEADS_STORE/campaigns/CAMPAIGN.json` `{ campaign, store_id, store_fingerprint,
  created_at }`, written by Phase 01's `arc-leads campaign init`.

### C7 — Provider interface

```
submit({ idem_key, to, subject, body, headers })   -> { ok, provider_message_id, submitted_at } | throws ProviderError
lookupByMessageId(idem_key)                        -> { found, provider_message_id, status } 
suppressionList()                                  -> [ normalized_email ]
authStatus()                                       -> { spf, dkim, dmarc, warmup_days | null }
```

`warmup_days: null` means the provider does not expose history → REQ-00's ATTESTED path.
`ADR-0402`'s "four requirements" = API-send-with-custom-domain · suppression API ·
idempotency-key **or** message-id lookup · inbound route (nice-to-have).

### C8 — Module paths (load-bearing: only `.claude/**` is sync-gated)

Everything ships under `.claude/scripts/leads/` — `arc-leads.mjs` (CLI) and
`lib/{store,receipts,source,source-fake,provider,provider-fake,dns,dns-fake,verify-email,verify-email-fake,journal,preflight,research-lint}.mjs`,
plus `pii-tripwire.sh`. Shared-organ edits, both of them: `.claude/scripts/hq/lib/validate.mjs` and `.claude/scripts/core/arc-products.mjs` (the `CATALOG` array, per C9).

### C9 — Sync gate (three artifacts, same commit)

1. `products/leads/manifest.json` — same shape as `products/evolve/manifest.json`, listing
   every `.claude/scripts/leads/**` file under `scripts`. `sync.bats`'s
   manifests-vs-reality invariant refuses any payload file no manifest owns.
2. `CATALOG` in `.claude/scripts/*/arc-products.mjs` gains `"leads"`.
3. Regenerate the golden:
   `bash sync-to-project.sh /tmp/g && (source tests/test_helper.bash; _arc_tree_manifest /tmp/g) > tests/fixtures/sync-golden/tree-manifest.txt`
   — **diff the delta first**, confirm only intended paths moved, then re-record.

### C10 — Preflight invocation

`arc-leads preflight` reads `.claude/config/leads.json` (non-secret, tracked):
`{ sending_domain, product_domains[], warmup_log_path, seed_evidence_path, caps{...} }`.
It resolves SPF/DKIM/DMARC live via `lib/dns.mjs`, calls `authStatus()`, and compares
`warmup_days` against the log. Exit 0 = PASS, 3 = REFUSED (reason named), never PASS on an
unverified attestation.

### C11 — `arc-leads state --json` is a PURE READER, and the replay fixture proves determinism

The earlier draft said the fixture "wipes derived state and replays". **There is no derived
state to wipe** — REQ-03 forbids a cache, and the ADR-0410 store is *source* data holding PII
that a PII-free spine cannot rebuild. A wipe-and-replay fixture would therefore delete
nothing and assert nothing: exactly the vacuous-pass class pre-mortem row 8 exists to catch.

`state --json` is a **pure fold over the spine**, no cache, no file written, `.claude/state/hq/derived/`
never created. Shape:

```json
{ "campaigns": { "NAME": { "replied": 0, "submitted": 0 } },
  "leads": [ { "last_touch_at": null, "lead_id": "...", "suppressed": false, "touches": 0 } ] }
```

Keys sorted `LC_ALL=C` at every level, 2-space indent, trailing newline.

**The three assertions that actually have code under them:**

1. **Determinism** — two independent processes over the same spine produce byte-identical output.
2. **Order-independence** — shuffle the spine's JSONL line order into a temp spine; output is
   byte-identical. This is the real replay property, and it can fail.
3. **Fold-completeness** — append one more `lead.researched` receipt; exactly one `leads[]`
   entry appears and nothing else changes. Proves the fold READ the new line rather than
   returning a cached or hardcoded shape.

**Phase 00 emits only `lead.researched`, so `touches` is 0 for every lead** — the fixture
proves the fold replays, not that sending works.

### C20 — The `metric.observed` stream-contract fixture's subject

Phase 00 builds no aggregator, so "never summed with `experiment.measured`" has nothing to
execute against — an assertion with no code path under it is the vacuous-pass class again.
**Scoped down to what Phase 00 genuinely owns:** the fixture asserts the *validator*, not a
reader. Three cases against `validate.mjs`:

1. a well-formed `metric.observed` validates, under **both** `source_id` grammars
   (`h-HEX16` and `lead_hmac_v1_HEX32`)
2. a `metric.observed` payload carrying any `experiment.*` key (`variant_arm`, `trial_id`)
   is **rejected** — the two streams cannot be conflated at the payload level
3. two `metric.observed` in the same window differing only by `variant` produce **different**
   idems (C3's total preimage, absent optionals as literal `-`)

The *summing* contract belongs to whatever reader consumes the feed, and that reader is
evolve's, not this lane's. Recorded here so Phase 03 does not re-litigate the scope.

### C12 — CI registration

None needed. Unsharded legs run `bats -r tests/`, so `tests/leads-*.bats` is auto-discovered
— **no `.github/**` edit** (a cross-lane shared file this phase must not touch). CI already
reconciles executed-vs-declared TAP counts, which is the mechanism behind pre-mortem row 8;
each file additionally asserts its own declared `@test` count.

## Verification plan

- **Test command:** `bats tests/leads-pii-tripwire.bats tests/leads-receipts.bats tests/leads-research-lint.bats tests/leads-preflight.bats tests/leads-provider-contract.bats`
- **Expected failure first:** `tests/leads-pii-tripwire.bats` → `"email-shaped string in tracked non-fixture file is rejected"` fails RED with `bash: .claude/scripts/leads/pii-tripwire.sh: No such file or directory` before the phase is built. It is first on purpose: the tripwire is the guard that must exist before any dossier does. Second red: `tests/leads-receipts.bats` → `"bare unkeyed lead id is rejected"` fails with `UNKNOWN_KIND: lead.researched` — proving the vocabulary genuinely does not exist yet rather than the test being vacuous. **Every bats file asserts its own declared `@test` count and uses ASCII-only test names**, so a silently-dropped test is itself a failure.
- **Live demo scenario:** **`export ARC_SPINE_ROOT=$(mktemp -d)` FIRST** — the demo emits 29 `lead.researched` receipts derived from an `example.com` fixture corpus, and the spine is append-only with no delete and no `.simulated` twin for these kinds, so writing them to the real company spine would permanently mix real and simulated (a PLAN non-negotiable) and pollute the very counts ADR-0403 and REQ-05 later fold. **The ADR-0401 exit criterion — that the receipt lands on the COMPANY spine and not a venture's — is proven by a unit assertion on the emitter's resolved path, never by writing to the real organ.** Then `export ARC_LEADS_STORE=$(mktemp -d) ARC_LEADS_FAKE=1` and `node .claude/scripts/leads/arc-leads.mjs store init` then `... research tests/fixtures/leads/icp-fake.json` → prints **25 PASS · 1 HELD · 3 BELOW-BAR · 5 REJECTED** with exclusion reasons (C6); `ls $ARC_LEADS_STORE/dossiers | wc -l` → **29**; `wc -l < $ARC_LEADS_STORE/rejected.jsonl` → **5**; `git status --porcelain` → clean; the receipts visible **in the temp spine's `events/`, not `_quarantine/`**, with `lead_id` matching `^lead_hmac_v1_[0-9a-f]{32}$`. (C3's per-lead idem means **29** `lead.researched` receipts, one per dossier.)
- **Real-system check:** n/a — fakes only this phase, except the provider-code-path test above, which deliberately uses the real module against an unreachable endpoint.
- **Expected evidence:** CI job output for all five bats files (per-JOB conclusions); the demo transcript; `initiatives/leads/evidence/phase-00/manifest.json`.

## Rabbit holes in this phase

Perfect ICP taxonomy → **one ICP, fake fixture only** · email-finder cascades → **one vetted
source interface + manual fill** · trying to prove the tripwire catches *arbitrary* prose PII
→ **it cannot, and ADR-0410 says so; location isolation is the wall, the lint is the alarm**.

## Out of scope for this phase

Caps, suppression, the send path, the reconciler, the personalization lint, the review
boundary → Phase 01. Reply ingestion → Phase 02. Any real provider or real send → Phase 03
(BLOCKED, ADR-0413).

## Your-setup / pending

Nothing for Phases 0–2 — the whole phase runs offline on fakes. CI uses a temp store.
**Owner obligation named by ADR-0410:** once a real store exists, its backup — and the HMAC
secret's backup — is yours. Losing the secret breaks suppression matching permanently.

## Non-negotiables (verbatim from PLAN)

- Every send human-approved (L1) until an ADR-0407 promotion is granted — proposed by evidence, decided by the human, never assumed.
- Caps and suppression are code with fixtures, not policy text. Adversarial breaking pass on cap enforcement, suppression, the personalization lint and the reply parser before any WARN→FAIL promotion.
- No purchased lists, no scraped emails from login-walled sources, no fake personalization — all three structurally enforced by lint and fixtures, never merely requested.
- Domain reputation is a company asset: dedicated cold domain, warm-up respected, unsubscribe honored instantly, List-Unsubscribe everywhere, breakers on bounce and complaint.
- No LinkedIn automation (ToS) — LinkedIn first-touch drafts are for manual sending only.
- No raw PII on the spine, in receipts, in argv, or anywhere under the repo directory: keyed HMAC lead ids (ADR-0400); names, emails, drafts and journal only in the ADR-0410 private store outside the repo, tripwire-lint-watched.
- Spine discipline: standard emitter, reader-only consumption, closed payloads, total-preimage idems, `supersedes` corrections, real and simulated never mixed.
- Zero-dep Node plus POSIX; the provider sits behind an interface with a fake, so Phases 0–2 build with zero real emails.
