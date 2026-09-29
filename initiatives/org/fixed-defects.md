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
- **Role ids and produced kinds become file names, and Windows opens `con.role.yaml` as a device whatever the extension** — `card.mjs` `isId` refuses the reserved device names, attack d62ae10 B1 — *every id that becomes a path segment: venture slugs, team manifests, docs/schemas/KIND.md*
- **`--chart` and `--digest` ran over whatever `collect()` could parse, silently dropping a broken card, so a genesis approval could bless a different catalog** — `org-catalog.mjs` `soundWorld` refuses on any gate finding, B2 — *any reader that renders or digests a collection whose collector records failures on a side list*
- **`--draft` put an unvalidated seed id and agent stem into `join()`, which normalises `../` straight out of org/roles/** — ids and stems held to `isId`, writes use flag `wx`, B3 — *every path built from a data value*
- **`--chart --check` compared raw bytes, so an autocrlf checkout read as a hand edit** — `readOr` folds CRLF to LF, B4 — *every regenerate-and-compare check*
- **The emitter's ": " guard copied one misread by hand and could miss a sibling (`a:` at end of item)** — the guard widened to `:` then a space or line end, and `emitYaml` now asserts parse(emit(x)) == x before returning, B5 — *any guard that restates another component's behaviour instead of deriving it*
- **`--draft` validated rows while writing, so a bad row 40 left rows 1-39 on disk** — every row is validated and built in memory first, duplicates refused, B6 — *any batch writer that validates inside its write loop*
- **`process.exit(c)` right after a burst of console.log can truncate piped stdout** — both CLIs set `process.exitCode`, B7 — *every CLI main tail in the lane*
- **The self-test built its scratch tree before the try/finally, so a throw during the build leaked a temp tree** — the dir is created first, built inside try/finally, and removed on SIGINT, B8 — *every mkdtemp whose cleanup sits in a finally opened after other work*
