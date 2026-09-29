# Fixed defects — the org lane's running list

Every attacker prompt carries this file, with one instruction: **check each line in every OTHER
file you are shown, not only the file it was fixed in.** Every attacker pass adds its fixed holes
here, one line each.

Format: **defect** — where it was fixed — *the pattern to check elsewhere*.

- **The model-string scan read `.claude/` inside script paths as the model "claude", which would fail every card that binds a script** — `card.mjs` `NOT_SCANNED` (paths + `hire.source`), 07568bd — *any word-bounded regex run over a free-text field that also holds paths*
- **The ADR-0200 yaml subset reads a quoted sequence item holding ": " as a one-key mapping (`- 'a: b'` becomes `{"'a": "b'"}`), a silent misread** — `emit.mjs` refuses such items and `validateCard` fails a non-string list item, 07568bd (the parser is the engine lane's, reported and not fixed here) — *every list-of-strings field read through `parseYamlSubset`*
- **The self-test's scratch tree held EMPTY placeholder scripts, but face-coverage's walkers IMPORT the YAML parser from the tree they read, so ventures.yaml read as unreadable** — `org-coverage.mjs` `buildScratch` copies the real `yaml-subset.mjs` bytes, 07568bd — *any scratch or fixture tree that stubs a file a walker imports rather than lists*
- **ADR-1622's first draft seated the social card `vacant` while giving it an E2 string, which ADR-1609 forbids; the gate refused the card** — ADR-1622 erratum, the card is `seat: human`, 07568bd — *any ADR or spec line that sets `seat` for a role that carries `e2`*
- **A card mission (the phrase risk_ordered phases before any code is written, hyphen written here as `_` so this line does not trip the same rule) read as an OpenAI key once the secret scanner stripped whitespace, and arc-run refused the whole attack input** — `product-manager` mission reworded — *any prose containing sk plus a hyphen (risk, task, desk + hyphen) followed by 32+ word characters once spaces are removed*
