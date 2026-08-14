#!/usr/bin/env bats
# Phase 02 -- the miner (REQ-01). Sources are named, candidates are evidenced, and nothing is
# invented.
#
# Several tests here exist because the FIRST REAL mining run failed in ways no fixture run could
# have shown, which is exactly why the phase spec demands a real run:
#   - 41 valid links were called "dead" on HTTP 429. A rate limit is UNKNOWN, not dead, and
#     collapsing the two is MISSING-read-as-zero.
#   - whole HN titles were used as keywords, so the proposal's pillar came out as "dspack studio",
#     a product name nobody searches.
#   - a story reposted three times corroborated itself three times, manufacturing
#     "operating system for 916" (from a $916 price) as a three-story topic.
# Each of those is pinned below as a fixture so it cannot come back.
#
# ASCII-only test names; the file asserts its registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const M = await import("./.claude/scripts/growth/lib/mine.mjs");
const E = await import("./.claude/scripts/growth/lib/evidence.mjs");
const A = await import("./.claude/scripts/growth/lib/adapters.mjs");
const src = (over = {}) => JSON.stringify({ schema: 1, sources: [ {
  id: "hn-algolia", kind: "community", enabled: true,
  access: { method: "official-public-api", endpoint: "https://x.test/a", auth: "none",
            terms_url: "https://x.test/terms" },
  queries: ["agent build system"], ...over } ] });
const cand = (over = {}) => ({ keyword: "ai agents", evidence_url: "https://news.ycombinator.com/item?id=1",
  intent: "informational", gap_note: "attested in 2 independent HN stories", source_id: "hn-algolia", ...over });
const err = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.code || e.name; } };
const aerr = async (fn) => { try { await fn(); return "NO-THROW"; } catch (e) { return e.code || e.name; } };'

# ---------- the source list is named, and its permissions are checked ----------

@test "mine: a well-formed source list loads and reports its enabled sources" {
  run _node "$PRE
    const cfg = M.loadSources(src());
    console.log(M.enabledSources(cfg).length + ' ' + cfg.sources[0].id);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 hn-algolia" ]
}

@test "mine: an enabled source whose access is not an official API is refused" {
  # The non-negotiable is official APIs only. This is the line that enforces it rather than
  # trusting whoever edits the file to remember.
  run _node "$PRE
    console.log(err(() => M.loadSources(src({ access: { method: 'scrape', terms_url: 'https://x.test/t' } }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SOURCES" ]
}

@test "mine: an enabled source with no terms_url is refused" {
  run _node "$PRE
    console.log(err(() => M.loadSources(src({ access: { method: 'official-api' } }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SOURCES" ]
}

@test "mine: a disabled source must say why it is disabled" {
  run _node "$PRE
    console.log(err(() => M.loadSources(src({ enabled: false }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SOURCES" ]
}

@test "mine: an enabled manual-entry source must name the file holding its rows" {
  run _node "$PRE
    const bad = err(() => M.loadSources(src({ access: { method: 'manual-entry' }, queries: [] })));
    const ok  = err(() => M.loadSources(src({ access: { method: 'manual-entry', file: 'rows.jsonl' }, queries: [] })));
    console.log(bad + ' ' + ok);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SOURCES NO-THROW" ]
}

@test "mine: a duplicate source id is refused" {
  run _node "$PRE
    const two = JSON.parse(src()); two.sources.push(JSON.parse(src()).sources[0]);
    console.log(err(() => M.loadSources(JSON.stringify(two))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SOURCES" ]
}

# ---------- a candidate is evidenced, or it is not a candidate ----------

@test "mine: a candidate with no evidence_url is refused structurally, not warned about" {
  run _node "$PRE
    console.log([err(() => M.assertCandidate(cand({ evidence_url: '' }))),
                 err(() => M.assertCandidate(cand({ evidence_url: 'not-a-url' }))),
                 err(() => M.assertCandidate(cand()))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO_EVIDENCE NO_EVIDENCE NO-THROW" ]
}

@test "mine: the candidate shape is closed and every field is required" {
  run _node "$PRE
    const extra = err(() => M.assertCandidate({ ...cand(), sneaky: 'x' }));
    const missing = M.CANDIDATE_KEYS.map((k) => { const c = cand(); delete c[k]; return err(() => M.assertCandidate(c)); });
    console.log(extra + ' ' + missing.length + ' ' + (missing.every((e) => e !== 'NO-THROW') ? 'all-refused' : 'A-HOLE:' + missing.join(',')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CANDIDATE 5 all-refused" ]
}

@test "mine: an intent outside the closed set is refused" {
  run _node "$PRE
    console.log(err(() => M.assertCandidate(cand({ intent: 'navigational' }))) + ' ' +
                err(() => M.assertCandidate(cand({ intent: 'Informational' }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CANDIDATE BAD_CANDIDATE" ]
}

@test "mine: a control character in any candidate field is refused" {
  run _node "$PRE
    console.log(err(() => M.assertCandidate(cand({ keyword: 'ai' + String.fromCharCode(13) + 'agents' }))));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_CANDIDATE" ]
}

# ---------- no invented keywords: provenance and silence are both errors ----------

@test "mine: an enabled source with no adapter is an error, never a silent zero" {
  # A silent zero here is indistinguishable from a quiet market, which is the misreading this
  # whole lane exists to prevent.
  run _node "$PRE
    console.log(await aerr(() => M.mine({ cfg: M.loadSources(src()), adapters: {} })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO_ADAPTER" ]
}

@test "mine: an adapter cannot launder a keyword under another source id" {
  run _node "$PRE
    const adapters = { 'hn-algolia': async () => [cand({ source_id: 'somewhere-else' })] };
    console.log(await aerr(() => M.mine({ cfg: M.loadSources(src()), adapters })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_PROVENANCE" ]
}

@test "mine: a run with no enabled source refuses rather than returning nothing" {
  run _node "$PRE
    const cfg = M.loadSources(src({ enabled: false, disabled_reason: 'owner sign-off pending' }));
    console.log(await aerr(() => M.mine({ cfg, adapters: {} })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO_SOURCES" ]
}

# ---------- own-pages exclusion ----------

@test "mine: a keyword the site already targets is excluded regardless of word order" {
  run _node "$PRE
    const cands = [cand({ keyword: 'agent build system' }), cand({ keyword: 'something else entirely' })];
    const left = M.excludeOwnPages(cands, new Set(['system-build-agent']));
    console.log(left.length + ' ' + (left[0] ? left[0].keyword : 'NONE'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 something else entirely" ]
}

@test "mine: a sitemap with no loc entries is a parse failure, not an empty site" {
  # Returning [] here would silently switch the own-pages exclusion OFF and the miner would start
  # proposing keywords the site already ranks for.
  run _node "$PRE
    console.log(err(() => E.parseSitemap('<urlset></urlset>')) + ' ' + err(() => E.parseSitemap('')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_SITEMAP BAD_SITEMAP" ]
}

@test "mine: sitemap urls become own targets by their last path segment" {
  run _node "$PRE
    const xml = '<urlset><url><loc>https://s.test/blog/receipts-driven-os</loc></url>' +
                '<url><loc>https://s.test/</loc></url></urlset>';
    const t = [...E.ownTargetsFromSitemap(xml)];
    console.log(t.length + ' ' + t[0]);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 receipts-driven-os" ]
}

# ---------- evidence has THREE states, and 429 is not death ----------

@test "mine: a rate-limited link is UNKNOWN, never dead" {
  # The regression that started this file: the first real run drove 41 live HN links into "did
  # not resolve" on 429 and the candidate pool silently shrank by 80 percent.
  run _node "$PRE
    const res = (status) => ({ status, ok: status >= 200 && status < 300, headers: { get: () => null } });
    const r = E.httpResolver({ fetchImpl: async () => res(429), maxRetries: 0, pauseMs: 0, sleep: async () => {} });
    const d = E.httpResolver({ fetchImpl: async () => res(404), maxRetries: 0, pauseMs: 0, sleep: async () => {} });
    const l = E.httpResolver({ fetchImpl: async () => res(200), maxRetries: 0, pauseMs: 0, sleep: async () => {} });
    console.log([(await r('https://x.test/a')).state, (await d('https://x.test/a')).state, (await l('https://x.test/a')).state].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "unknown dead live" ]
}

@test "mine: a url the fake resolver was never told about is unknown, not live" {
  run _node "$PRE
    const f = E.fakeResolver({ 'https://x.test/known': true });
    console.log([(await f('https://x.test/known')).state, (await f('https://x.test/never-mentioned')).state].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "live unknown" ]
}

@test "mine: partitioning keeps unknown separate from dead" {
  run _node "$PRE
    const cs = [cand({ evidence_url: 'https://x.test/live' }), cand({ keyword: 'k2', evidence_url: 'https://x.test/dead' }),
                cand({ keyword: 'k3', evidence_url: 'https://x.test/huh' })];
    const f = E.fakeResolver({ 'https://x.test/live': true, 'https://x.test/dead': false });
    const p = await E.partitionByEvidence(cs, f);
    console.log([p.live.length, p.dead.length, p.unknown.length].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 1 1" ]
}

# ---------- attestation: a headline is not a keyword ----------

@test "mine: a phrase attested by only one story is not a candidate" {
  run _node "$PRE
    const items = [{ title: 'dspack studio', objectID: '1', query: 'q' }];
    console.log(A.attestedCandidates(items, 'hn-algolia').length + '');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "0" ]
}

@test "mine: the same story reposted cannot corroborate itself" {
  # Three objectIDs, ONE headline. Counting ids made "operating system for 916" look like a
  # three-story topic; attestation counts distinct titles for exactly this reason.
  run _node "$PRE
    const same = (id) => ({ title: 'ai agents build an operating system', objectID: id, query: 'q' });
    const reposts = A.attestedCandidates([same('1'), same('2'), same('3')], 'hn-algolia');
    const real = A.attestedCandidates([same('1'), { title: 'ai agents in production', objectID: '9', query: 'q' }], 'hn-algolia');
    console.log(reposts.length + ' ' + real.length + ' ' + (real[0] ? real[0].keyword : 'NONE'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "0 1 ai agents" ]
}

@test "mine: a phrase carrying a bare number is not a keyword" {
  run _node "$PRE
    const items = [{ title: 'agents build an operating system for 916 dollars', objectID: '1', query: 'q' },
                   { title: 'agents build an operating system for 916 bucks', objectID: '2', query: 'q' }];
    const out = A.attestedCandidates(items, 'hn-algolia').map((c) => c.keyword);
    console.log((out.some((k) => /916/.test(k)) ? 'LEAKED:' + out.join('|') : 'no-numbers') + ' ' + (out.length > 0 ? 'found-some' : 'FOUND-NOTHING'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "no-numbers found-some" ]
}

@test "mine: every attested candidate passes the candidate contract" {
  # The adapter and the validator are written apart; this is the seam where a drift between them
  # would otherwise surface only in production.
  run _node "$PRE
    const items = [{ title: 'ai agents build things', objectID: '1', query: 'q' },
                   { title: 'ai agents everywhere', objectID: '2', query: 'q' }];
    const out = A.attestedCandidates(items, 'hn-algolia');
    out.forEach((c) => M.assertCandidate(c));
    console.log(out.length > 0 ? 'all-valid-' + out.length : 'NOTHING-TO-CHECK');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == all-valid-* ]]
}

@test "mine: the exclusion count is the number excluded, not the number of own pages" {
  # The CLI printed `own-page exclusions ${ownTargets.size}` -- the number of pages READ FROM THE
  # SITEMAP under a label claiming it was the number of candidates removed. A real run against the
  # live sitemap therefore reported "own-page exclusions 1" while excluding nothing, and a run that
  # wrongly excluded a dozen real keywords would have reported "1" just the same. The only number a
  # human has for checking criterion 2's guard was not measuring the guard.
  run _node "$PRE
    const adapters = { 'hn-algolia': async () => [cand({ keyword: 'alpha topic' }), cand({ keyword: 'beta topic' })] };
    // TWO own pages, exactly ONE of which matches a candidate. A count that reports own-pages
    // would say 2; a count that reports exclusions says 1. The numbers must disagree, or the test
    // cannot tell which one is being printed.
    const r = await M.mine({ cfg: M.loadSources(src()), adapters, ownTargets: new Set(['alpha-topic', 'unrelated-page']) });
    console.log(r.candidates.length + ' left, ' + r.ownExcluded + ' excluded');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 left, 1 excluded" ]
}

@test "mine: a run that excludes nothing reports zero exclusions" {
  # The negative control for the test above. If ownExcluded silently went back to reporting the
  # own-page count, this asserts 0 while two own pages were read -- so the two tests together
  # cannot both pass on the wrong number.
  run _node "$PRE
    const adapters = { 'hn-algolia': async () => [cand({ keyword: 'alpha topic' })] };
    const r = await M.mine({ cfg: M.loadSources(src()), adapters, ownTargets: new Set(['nothing-matches', 'also-not-this']) });
    console.log(r.candidates.length + ' left, ' + r.ownExcluded + ' excluded');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 left, 0 excluded" ]
}

@test "mine: bats registers every test this file declares" {
  # MEASURED, not asserted: bats silently DROPS a @test whose name carries a non-ASCII character,
  # and the natural response to that red is to bump a literal, restoring green on a suite running
  # one test fewer.
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 15 ]
}
