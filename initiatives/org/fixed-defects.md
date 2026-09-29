# org — fixed defects (carried into every attacker prompt)

Each row is a hole found and closed. An attacker checks every OTHER file for the same shape:
a fix is not applied until it has been attacked somewhere it was never made.

| # | Found | Shape | Where fixed | Check elsewhere for |
|---|---|---|---|---|
| 1 | build, 2026-09-30 | The model-string scan read `.claude/` inside script PATHS as the model "claude". Every card that binds a script would have failed. | `card.mjs` `NOT_SCANNED` (paths + `hire.source`) | any word-bounded regex run over a free-text field that also holds paths |
| 2 | build, 2026-09-30 | The ADR-0200 yaml subset reads a QUOTED sequence item holding `": "` as a one-key mapping (`- 'a: b'` → `{"'a": "b'"}`). This is a silent misread. The gate caught the one that reached a card. | `emit.mjs` refuses such items; `validateCard` fails a non-string list item | every list-of-strings field read through `parseYamlSubset` (engine lane owns the parser; reported, not fixed here) |
| 3 | build, 2026-09-30 | The self-test scratch tree held EMPTY placeholder scripts. `face-coverage`'s walkers load the YAML parser from the tree they read, so `ventures.yaml` read as unreadable and two arms failed for the wrong reason. | `org-coverage.mjs` `buildScratch` copies `yaml-subset.mjs` bytes | any scratch/fixture tree that stubs a file a walker IMPORTS rather than lists |
| 4 | build, 2026-09-30 | ADR-1622's first draft seated the social card `vacant` while giving it an E2 string. ADR-1609 forbids that, and the gate refused the card. | ADR-1622 erratum; the card is `seat: human` | any ADR or spec line that sets `seat` for a role carrying `e2` |
