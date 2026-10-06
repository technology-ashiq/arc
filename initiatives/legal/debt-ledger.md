# Debt ledger — the legal lane

LOW findings left after the two attack rounds a PR is allowed (memory: attack rounds capped at two),
one line each, with where they came from. Each is paid in a later slice or closed with a reason.

## Phase 01/02 closes (attacks 1f6acdd, cef0d6e, e28fcf1, 3f82dad)

- **Logic surface ran only on the last commit.** Three earlier logic runs failed on transport or
  contract (saturated free model; a proxy model id arc-run refused; a deepseek answer missing a
  `fix` field). The fourth, `3f82dad` on `deepseek/deepseek-v4-flash-0731`, ran and its high and
  mediums are fixed in this PR. Pay: none owed beyond the record.
- **cef0d6e B7 / 3f82dad B8 class** — `--venture` reaches `join(PRODUCT, "published", venture + ".json")`
  with no grammar or exact-case check at that call; a reserved Windows device name or a case
  variant resolves another file. The facts path is confined elsewhere. Pay: route the ledger path
  through the same venture-name confinement `factsPathFor` uses.
- **3f82dad B6** — the reachability excerpt is matched against the page text including its
  generated header, so an excerpt taken from the header comment would match. Pay: match against
  the body below the header only.
- **3f82dad B9** — `c.note` in the printed diff is not passed through `shown`. Today it is only
  ever one of two engine constants ("page is new", "page is gone"). Pay: pass it through `shown`
  when a note can carry ledger text.
- **3f82dad L3 / e28fcf1 B5 (accepted, not fixed)** — a served-evidence PASS is self-attested: the
  probe arm that would fetch the URL is designated cut #1 at kickoff. The row now SAYS
  `self-attested, not fetched`. Pay: the probe arm, when a venture is live.
- **e28fcf1 B6** — `flat()` normalises only markdown emphasis and whitespace; served HTML differs
  in entities, smart quotes and link syntax, so a real excerpt can fail to match. Fails closed
  (FAIL, never a false PASS). Pay: normalise entities and quotes when the probe arm lands.
- **e28fcf1 B9** — the attacker's carried list is condensed by `build-attack-input.mjs`; if two
  rows share a class lead, the condensed line names only one file. Pay: include the file in the
  condensed line.
