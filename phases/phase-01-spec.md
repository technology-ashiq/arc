# Phase 01 — Brief mode, design-lint v0, and the module manifest

**Goal (one line):** A UI-bearing build can get a machine-checked 4-contract design brief, and design installs as a first-class `products/design/` module — with the old QA design surface untouched (ADR-0042).
**Appetite:** 1 day
**Depends on:** phase-00

## Exit criteria (Definition of Done)

- [ ] Brief mode produces a 4-section brief (interaction model = every question in `docs/templates/design-brief-template.md`'s interaction-model section, not a restated count · art direction with taste recorded as design ADRs · platform-contract table · content contract — ADR-0036) for a real arc surface; design-lint v0 fails the brief if its answer count != the template's live question count (drift gate, not a duplicated number in REQ-05/REQ-07)
- [ ] `design-lint.mjs` v0 (`.claude/scripts/design/`, rides the gate-runner per ADR-0046): passes the complete fixture brief; fails fixtures each missing one section/contract; flags lorem-ipsum strings in reviewed routes
- [ ] **Contrast + target-size checks are IN, per ADR-0048** — this reverses the earlier line here that deferred contrast-AA ("add via `/arc-change` when a REQ needs it"); Phase 00's live demo is that trigger. The critic reported a contrast VIOLATION carrying a sampled RGB and a ratio to two decimals; independent measurement showed the elements passed and the cited colour existed nowhere. Numbers must come from a script, so design-lint computes WCAG contrast from the declared tokens and measures target size — and checks both against the floor **the brief declares**, never a hardcoded constant (the ≥44px used in Phase 00 is this project's declared floor and WCAG AAA 2.5.5; WCAG AA's own minimum, 2.5.8, is 24px — a lint hardcoding either silently overrides the product's contract). Fixtures: one passing pair, one failing pair, one brief declaring a non-default floor.
- [ ] Adversarial construct-a-breaking-input pass run against design-lint v0 (non-negotiable), covering at minimum one fixture per retro-log markdown-contract bug class — case-fold-before-compare, last-of/repeated-section, anchored-not-`$`-under-`/m` regex, real-calendar-date validation, and a heading-level/emphasis cosmetic-variant bypass (council v2+v3) — not only missing-section fixtures; every found hole fixed + pinned as a fixture
- [ ] `products/design/manifest.json` exists (module in-repo per ADR-0033) and resolves via `arc-products.mjs`; product-lint green; sync-to-project installs the module; **sync-golden tree-manifest regenerated as a named step** (diff delta first, only intended paths moved) — **partly landed in Phase 00 out of necessity**: the manifest and the `arc-products.mjs` CATALOG entry had to exist the moment Phase 00 put a file under `.claude/`, because `sync.bats`'s manifests-vs-reality invariant refuses any payload file no manifest owns. What remains here is the rest: install/resolve proof, product-lint in CI, and the old-surface-untouched check
- [ ] Old `/arc-design` + `design-reviewer` untouched and still green (ADR-0042 — parallel run)
- [ ] tests added & green (one bats file, foreground)
- [ ] live demo run + output checked
- [ ] tracker updated (PROGRESS.md row ✅ + done-log)

## Verification plan

- **Test command:** `bats tests/design-lint.bats`
- **Expected failure first:** the test asserts design-lint exits non-zero on the
  missing-content-contract fixture brief and zero on the complete fixture brief. Before
  the phase is built the test fails at "design-lint.mjs: no such file" — red proven,
  then built to green (both directions fixture-proven).
- **Live demo scenario:** run brief mode on an arc-internal surface → lint the produced
  brief green → delete one section → lint fails naming the missing section → run
  `sync-to-project` against a scratch target → module lands, product-lint green.
- **Real-system check:** manifest resolved by the real `arc-products.mjs` resolver and
  real product-lint (their hostile-fixture testbeds stay green, untouched).
- **Expected evidence:** lint output on pass + fail fixtures · adversarial-pass findings
  list with pinned fixtures · product-lint output · named sync-golden regen commit.

## Rabbit holes in this phase

- Brief-parsing regexes — apply the retro-log markdown-contract checklist (tolerant
  detection, strict value grammar, last-of repeated sections, anchored regexes).
- Moving/retiring anything under `products/qa` — NO (ADR-0042): the new manifest adds,
  it does not migrate yet.
- Gate promotion — the design gate stays `warn` (no-go).

## Out of scope for this phase

Explore mode (Phase 2) · library/pilot (Phase 3) · kickoff step-4.5 wiring (ADR-0043) ·
retiring the old reviewer (ADR-0042 trigger not yet fired).

## Your-setup / pending

None.

## Non-negotiables (verbatim from PLAN)

- The critic never writes product code — enforced mechanically (no Edit tool + PreToolUse edit-hook path scope + scoped receipt Bash), never by prose (ADR-0034).
- No lorem ipsum in any reviewed artifact — realistic content from the content contract.
- No absolute quality scores anywhere; numbers exist only as blind comparative ranking.
- Every design review and every owner decision leaves a spine receipt in the closed vocabulary (ADR-0035).
- Taste is a decision recorded as a design ADR, never a research finding; research receipts only for factual/pattern claims.
- A new gate/lint/parser is not done until an adversarial construct-a-breaking-input pass has run and the found holes are fixed + pinned as fixtures.
- Any edit to a product-shipped file treats sync-golden regen as a named step: diff the delta first, confirm only intended paths moved, then re-record.
