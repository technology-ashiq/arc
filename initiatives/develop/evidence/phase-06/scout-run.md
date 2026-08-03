# capability-scout — one real run, 2026-08-03

The need was arc's own recorded debt: `/arc-develop checkpoint` cannot compute a public-API
surface diff or a circular-dependency check, because arc core is zero-dependency and has nothing
that can read code structure.

**Run through a general-purpose agent carrying the definition inline, not through the registered
`capability-scout` type.** Agent types register at session start and the definition was written in
this session — the registry was asked for the type by name and refused it. That is the identical
debt Cycle 5 recorded for `spec-fidelity` and paid down one session later, and it is recorded in
`initiatives/develop/debt-ledger.md` rather than glossed. What this run proves is the CONTRACT;
what it does not prove is that the frontmatter loads.

## What it returned

Five rows. Every one carries a resolved version, a published `dist.integrity`, and a separate
statement about `dist.attestations` — the two provenance fields kept apart, which is the thing
ADR-0110 says must never be collapsed.

| candidate | the fact that decides it |
|---|---|
| `dependency-cruiser@18.1.1` | attestations PRESENT, GitHub OIDC trusted publisher. Writes files by documented design → will need a recorded human OK. Published one day before the run |
| `dpdm@4.3.0` | ships `prepare` and `prepublishOnly` → write-capable on manifest evidence alone, before any source scan |
| `skott@0.35.11` | no lifecycle hooks, but its dependency set includes an HTTP server stack — it can serve a local web app, not merely read code |
| `madge@8.0.0` | carried forward as already-refused, not re-proposed. `refused-on: human-ok` |
| `@microsoft/api-extractor@7.58.12` | attestations ABSENT — a real provenance gap on the one Microsoft-published candidate. Reads `.d.ts`, so it cannot read arc's own `.mjs` core |

## Why this is evidence rather than output

Four behaviours the definition demands, all present without being asked for again:

1. **It wrote nothing.** No file created, no allowlist touched, no lock row.
2. **Unknowns stayed unknown.** "Whether its own source spawns is `unknown — not determined; the
   gate computes that from the fetched tree, and I fetched nothing`." That is the cell the
   definition asks for, in the place where a plausible-sounding guess would have been easiest.
3. **It reported a gap in its own coverage** — "No candidate resolved for a *complexity delta* —
   the third item in that debt row was not searched for and is not represented above." Nobody
   asked it to audit itself.
4. **It read source rather than READMEs where the claim mattered.** For api-extractor it quoted
   `Extractor.ts` performing the surface comparison and the two `FileSystem.writeFile` calls that
   class it write-capable — not the marketing page.

It also volunteered the thing a popularity-ranking scout would have buried: `dependency-cruiser`
was published **one day** before the run, so pinning 18.1.1 pins something nobody has run for
long. Recency is context, and it said so as context.

## What a human would run next

```
npm pack <candidate>      # fetch, never install
# write candidate.json, add the name to capability-allowlist.txt
bash .claude/scripts/develop/capability-vet.sh \
  --candidate <fetched dir> \
  --allowlist .claude/scripts/develop/capability-allowlist.txt \
  --lock .claude/scripts/develop/capability-lock.json
```

Three of the five are write-capable by the scout's own reading, so the gate will demand a recorded
human OK for each. That is the arrangement working, not a bottleneck to route around.
