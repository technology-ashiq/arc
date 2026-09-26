# Debt ledger — lane `design`

> Intentional shortcuts are debts; unrecorded debts are forgotten forever. Every deliberate
> compromise gets a row: **what · where · why accepted · cost of leaving it · pay-down trigger.**
> Lane-scoped. Opened 2026-09-26 with the LOW leftovers of Phase 02 slice B's two attack rounds
> (the round cap is two per PR).

| what | where | why accepted | cost of leaving it | pay-down trigger |
|---|---|---|---|---|
| The address checked for privacy is resolved separately from the one `fetch` connects to (DNS rebinding window) | `design-robots.mjs` `refusePrivate` / `realTransport` (r2 B13) | Closing it needs a custom dispatcher that pins the resolved address; the host binding already limits which names are fetched at all | A bound gallery host that rebinds to a private address between the two lookups | Any fetch from a host not on a registry `hosts` list, or a second fetching tool |
| Host binding compares the host name only; scheme and port are not bound, so a plain-http first URL is allowed | `design-refpack.mjs` `hostAllowed` (r2 B14) | The downgrade check covers redirects; the first URL is written by the curator from the gallery's own links | A pack row fetched over http | A curator run that records an http URL in `sources.md` |
| The log field sanitiser strips C0 controls and DEL only; C1 controls, U+2028/2029 and bidi overrides pass | `design-refpack.mjs` `field` (r2 B9) | The logs are machine-written TSV under `.claude/state/`, read by scripts, not rendered | A terminal or viewer that renders those characters shows a misleading line | The logs gain a human-facing reader |
| `design` imports `engine/yaml-subset.mjs` without declaring `engine` in its product manifest's `requires` | `products/design/manifest.json`, `design-refpack.mjs`, `design-sources-lint.mjs` (r1 B14, r2 B11) | Declaring it changes what the sync installs for every design consumer, which is a product decision, not a slice fix; the lint already had the same undeclared import | A consumer synced with design but not engine gets an import error | The next change to `products/design/manifest.json` `requires`, or any sync without engine |
| "Zero attempts" is proven by attempts.log being absent, which a builder that writes nowhere would also satisfy | `tests/design-refpack.bats` registry cases (r1 B15, r2 B12) | The paired happy-path cases prove the same builder does write attempts.log when it fetches; the test file is the owner's red-first work and is not edited in this slice | A builder that stopped logging would pass the zero-attempt cases, and fail only the happy path | The next edit to `tests/design-refpack.bats` adds a positive control asserting attempts.log is written on an allowed fetch |
