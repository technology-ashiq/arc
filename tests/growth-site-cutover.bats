#!/usr/bin/env bats
# Phase 01 -- the domain cutover, driven through the EMITTER where receipts are involved.
#
# The phase spec names one case as the expected-failure-first control: "a pre-cutover receipt
# cannot be corrected by editing it" must be RED until the supersede path exists. The fixture
# attempts an in-place rewrite of the Phase 0 receipt, the suite must refuse it, and the correct
# path must then produce TWO receipts with an intact `supersedes` link and the original bytes
# unchanged on disk.
#
# Two defects found on 2026-08-16 while building this are pinned here as negative controls,
# because both failed SILENTLY and one of them survived a phase close:
#
#   1. `content.published` payloads cannot carry `supersedes` -- the shape is closed to eight
#      fields with `optional: []`. Any reader resolving a chain via `payload.supersedes` reads a
#      key that can never exist, so its superseded set is always empty and every receipt looks
#      like a head.
#   2. The chain is keyed on the EVENT ULID, not on `content_sha`. A re-pin changes `site` and
#      `url` and leaves the bytes alone, so both receipts share one `content_sha`; a comparison
#      against `content_sha` filtered BOTH out and dropped a real week of clicks from the join.
#
# The test that was meant to cover this used two DIFFERENT content_shas -- the one shape where a
# content_sha-keyed chain works -- so it passed against both defects. That is the vacuous pass
# `.claude/rules/testing.md` names, and it is why the fixtures below use ONE sha.
bats_require_minimum_version 1.5.0
load 'test_helper'

EVENT() { echo "$ARC_ROOT/.claude/scripts/hq/arc-event.sh"; }

SHA_A='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
PREVIEW_SITE='arc-site-ecru.vercel.app'
PERMANENT_SITE='arc.automemory.ai'

# The Phase 0 receipt, on the preview host, exactly as the steel thread emits it.
PRE_PAYLOAD="{\"site\":\"$PREVIEW_SITE\",\"slug\":\"receipts-driven-os\",\"url\":\"https://$PREVIEW_SITE/blog/receipts-driven-os\",\"title\":\"Receipts driven OS\",\"template_id\":\"title-a\",\"cluster_id\":\"c-000\",\"content_sha\":\"$SHA_A\",\"pr_ref\":\"#2\"}"

# The same receipt on the permanent host, written OUT rather than derived with sed. The previous
# form was `sed "s/$PREVIEW_SITE/$PERMANENT_SITE/g"`, and both hostnames are full of dots that sed
# reads as "any character" -- it matched here only because a dot also matches a dot. A fixture that
# is correct by coincidence is a fixture that breaks the first time a host contains a hyphen where
# the pattern expects one.
REPIN_PAYLOAD="{\"site\":\"$PERMANENT_SITE\",\"slug\":\"receipts-driven-os\",\"url\":\"https://$PERMANENT_SITE/blog/receipts-driven-os\",\"title\":\"Receipts driven OS\",\"template_id\":\"title-a\",\"cluster_id\":\"c-000\",\"content_sha\":\"$SHA_A\",\"pr_ref\":\"#2\"}"

_spine() {
  SPINE="$BATS_TEST_TMPDIR/spine-$1"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
}

_landed() { grep -rho '"kind":"content.published"' "$SPINE/events" 2>/dev/null | wc -l | tr -d ' '; }

# Quarantine is MEASURED, not best-effort. The `2>/dev/null | grep -c . || true` form makes a
# failed measurement look identical to a clean run, which is the same absence-reported-as-zero
# confusion the spine's own MISSING-vs-zero rule exists to prevent. The directory is created up
# front so `cat` has something to read and a real read error stays a real error.
_quarantined() {
  mkdir -p "$SPINE/events/_quarantine"
  find "$SPINE" -path "*_quarantine*" -name "*.jsonl" -exec cat {} + | grep -c . | tr -d ' '
}

# Every event line in the canonical log, oldest first.
#
# SORTED by filename. `find -exec cat` returns directory order, which is filesystem-dependent, and
# these tests index l[0]/l[1] as "first receipt" and "second receipt". A cutover that straddles
# midnight writes two date files, and on a host that walks them in another order the assertions
# would swap the two receipts and fail for a reason nothing in the test names.
_lines() { find "$SPINE/events" -name "*.jsonl" | LC_ALL=C sort | xargs cat 2>/dev/null; }

# cd into ARC_ROOT and import RELATIVELY, which is the idiom every other growth suite uses. An
# absolute path built from $PWD does not survive here: under MSYS it is /c/Users/... and Node on
# Windows resolves that to C:\c\Users\..., so the module is simply not found on one of the three
# CI legs while passing on the other two.
_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const C = await import("./.claude/scripts/growth/lib/cutover.mjs");
const VC = await import("./.claude/scripts/hq/lib/validate-content.mjs");
const err = (f) => { try { f(); return "NO_THROW"; } catch (e) { return e.code || e.name; } };'

# ---------------------------------------------------------------------------------------------
# The expected-failure-first control, named by the phase spec.
# ---------------------------------------------------------------------------------------------

@test "cutover: a pre-cutover receipt cannot be corrected by EDITING it -- the bytes on disk are untouched" {
  _spine edit
  run bash "$(EVENT)" emit content.published --payload "$PRE_PAYLOAD" --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$(_landed)" = "1" ]
  [ "$(_quarantined)" = "0" ]

  # Capture the original bytes BEFORE attempting anything, so "unchanged" is measured rather than
  # asserted from memory.
  local before
  before="$(_lines)"
  [ -n "$before" ]

  # The wrong path: re-emit the same slug with the host swapped and NO supersedes link. This is
  # what "editing it" looks like to a spine that cannot be edited -- it does not rewrite the first
  # receipt, it appends a second one that claims to BE the first. The append-only log is what makes
  # the original bytes survive, and this case asserts that survival directly.
  run bash "$(EVENT)" emit content.published --payload "$REPIN_PAYLOAD" --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # The first receipt's bytes are still there, verbatim, as a prefix of the log.
  local after
  after="$(_lines)"
  case "$after" in "$before"*) : ;; *) echo "ORIGINAL BYTES CHANGED"; echo "$after"; false ;; esac
}

@test "cutover: the correct path produces TWO receipts with an intact supersedes link" {
  _spine link
  run bash "$(EVENT)" emit content.published --payload "$PRE_PAYLOAD" --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # Read the emitted event's ULID off the spine. The cutover NEVER invents one: `supersedes` names
  # an event, and an id this test made up would prove nothing about the real chain.
  local first_id
  first_id="$(_lines | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=s.trim().split(String.fromCharCode(10)).filter(Boolean).map(JSON.parse).filter(e=>e.kind==='content.published');console.log(l[0].id);})")"
  [ -n "$first_id" ]

  run bash "$(EVENT)" emit content.published --payload "$REPIN_PAYLOAD" --supersedes "$first_id" --strict
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  [ "$(_landed)" = "2" ]
  [ "$(_quarantined)" = "0" ]

  # The second receipt supersedes the first BY ULID, and the two idems differ.
  local report
  report="$(_lines | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=s.trim().split(String.fromCharCode(10)).filter(Boolean).map(JSON.parse).filter(e=>e.kind==='content.published');const a=l[0],b=l[1];console.log([b.supersedes===a.id,a.idem!==b.idem,a.payload.content_sha===b.payload.content_sha,b.payload.site].join(' '));})")"
  # link intact | idems differ | bytes identical | new host
  [ "$report" = "true true true $PERMANENT_SITE" ]
}

@test "cutover: idem CHANGES with site, which is what makes the correction a new fact" {
  # `site` is in the idem preimage (ADR-1101). If it were not, the re-pin would hash identically
  # to the original and be dropped as DUP_IDEM -- the ~100-receipt C2 loss class, reproduced by
  # exactly the correction this phase exists to perform.
  run _node "$PRE
    const base = { slug: 'x', url: 'https://a.test/blog/x', title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: '$SHA_A', pr_ref: '#2' };
    const a = VC.contentIdem('content.published', { ...base, site: 'a.test' });
    const b = VC.contentIdem('content.published', { ...base, site: 'b.test' });
    console.log(a === b ? 'COLLIDES' : 'DISTINCT');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "DISTINCT" ]
}

# ---------------------------------------------------------------------------------------------
# The cutover module itself.
# ---------------------------------------------------------------------------------------------

@test "cutover: repin replaces ONLY the host and preserves the path byte-for-byte" {
  # Re-deriving the path from the slug was the alternative, and it would silently rewrite a
  # correct URL into a well-formed 404 the moment an article is served from anywhere but /blog/.
  run _node "$PRE
    console.log(C.repinUrl('https://old.vercel.app/writing/2026/x/', 'arc.automemory.ai'));
    console.log(err(() => C.repinUrl('https://old.vercel.app', 'arc.automemory.ai')));
    console.log(err(() => C.repinUrl('http://old.vercel.app/blog/x', 'arc.automemory.ai')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "${lines[0]}" = "https://arc.automemory.ai/writing/2026/x/" ]
  [ "${lines[1]}" = "BAD_URL" ]
  [ "${lines[2]}" = "BAD_URL" ]
}

@test "cutover: a prior event without its ULID is REFUSED -- the chain is not keyed on content_sha" {
  run _node "$PRE
    const payload = { site: 'old.test', slug: 'x', url: 'https://old.test/blog/x', title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: '$SHA_A', pr_ref: '#2' };
    console.log(err(() => C.repinReceipt({ payload }, 'arc.automemory.ai')));
    console.log(err(() => C.repinReceipt({ id: '$SHA_A', payload }, 'arc.automemory.ai')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # Missing entirely, and present-but-a-sha. The second is the defect this phase found: a sha is
  # 64 hex chars and a ULID is 26 Crockford base32, so the grammar catches the confusion.
  #
  # The code is BAD_EVENT, not BAD_PRIOR_ID. `repinReceipt` and `planCutover` now share one
  # `assertEventIds` guard -- introduced because validating `id` in one and trusting `supersedes`
  # in the other is exactly how the stale receipt got re-pinned beside its successor -- and one
  # rule keeps one code. The caller context is in the message, not in a second error name.
  [ "${lines[0]}" = "BAD_EVENT" ]
  [ "${lines[1]}" = "BAD_EVENT" ]
}

@test "cutover: re-pinning something already on the permanent host is REFUSED, not reported as work" {
  # An identical receipt would be dropped as DUP_IDEM, and a cutover that emitted nothing while
  # reporting success is indistinguishable from one that worked.
  run _node "$PRE
    const payload = { site: 'arc.automemory.ai', slug: 'x', url: 'https://arc.automemory.ai/blog/x', title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: '$SHA_A', pr_ref: '#2' };
    console.log(err(() => C.repinReceipt({ id: '01KZZZZZZZZZZZZZZZZZZZZZZ1', payload }, 'arc.automemory.ai')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ALREADY_PINNED" ]
}

@test "cutover: planCutover takes heads only, and refuses an id-less event rather than assuming it is one" {
  run _node "$PRE
    const p = (site, slug) => ({ site, slug, url: 'https://' + site + '/blog/' + slug, title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: '$SHA_A', pr_ref: '#2' });
    const A = '01KZZZZZZZZZZZZZZZZZZZZZZ1', B = '01KZZZZZZZZZZZZZZZZZZZZZZ2', D = '01KZZZZZZZZZZZZZZZZZZZZZZ4';
    // A is superseded by B; B is a head on the old host; D is a head already on the new host.
    const events = [
      { id: A, supersedes: null, payload: p('old.test', 'x') },
      { id: B, supersedes: A, payload: p('old.test', 'x') },
      { id: D, supersedes: null, payload: p('arc.automemory.ai', 'y') }];
    const plan = C.planCutover(events, 'arc.automemory.ai');
    console.log([plan.todo.length, plan.headCount, plan.alreadyPinned, plan.todo[0].supersedes].join(' '));
    console.log(err(() => C.planCutover([{ supersedes: null, payload: p('old.test', 'z') }], 'arc.automemory.ai')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # One correction, two heads, one already pinned, and the correction supersedes B -- NOT A.
  [ "${lines[0]}" = "1 2 1 01KZZZZZZZZZZZZZZZZZZZZZZ2" ]
  [ "${lines[1]}" = "BAD_EVENT" ]
}

@test "cutover: the pinned site is read from config and re-checked against the grammar" {
  # Criterion 4. Before this existed the host was typed on the command line, and because `site` is
  # in the idem preimage a typo would have been accepted as a DISTINCT fact rather than refused as
  # a mistake -- a receipt claiming an article lives somewhere it does not.
  run _node "$PRE
    console.log(C.loadSiteConfig({ schema: 1, site: 'arc.automemory.ai' }).site);
    console.log(err(() => C.loadSiteConfig({ schema: 1, site: 'https://arc.automemory.ai' })));
    console.log(err(() => C.loadSiteConfig({ schema: 1, site: 'arc.automemory.ai/blog' })));
    console.log(err(() => C.loadSiteConfig({ schema: 1, site: 'ARC.automemory.ai' })));
    console.log(err(() => C.loadSiteConfig({ schema: 2, site: 'arc.automemory.ai' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "${lines[0]}" = "arc.automemory.ai" ]
  [ "${lines[1]}" = "BAD_SITE_CONFIG" ]
  [ "${lines[2]}" = "BAD_SITE_CONFIG" ]
  [ "${lines[3]}" = "BAD_SITE_CONFIG" ]
  [ "${lines[4]}" = "BAD_SITE_CONFIG" ]
}

@test "cutover: the committed site.json is valid and matches the ADR-1118 address" {
  # Asserts the REAL file, not a fixture. A loader proven only against inline objects says nothing
  # about the config the code will actually read.
  run _node "$PRE
    const fs = await import('node:fs');
    const cfg = C.loadSiteConfig(JSON.parse(fs.readFileSync('initiatives/growth/site.json', 'utf8')));
    console.log(cfg.site);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "arc.automemory.ai" ]
}

# ---------------------------------------------------------------------------------------------
# The sitemap agrees with the spine, both directions.
# ---------------------------------------------------------------------------------------------

@test "cutover: every published slug is in the sitemap, and no article is in the sitemap without a receipt" {
  run _node "$PRE
    const H = 'arc.automemory.ai';
    const xml = (urls) => '<urlset>' + urls.map((u) => '<loc>' + u + '</loc>').join('') + '</urlset>';
    const on = (host, paths) => xml(['https://' + host + '/'].concat(paths.map((p) => 'https://' + host + p)));
    const ok = C.checkSitemapCoverage(on(H, ['/blog/a/', '/blog/b/']), ['a', 'b'], H);
    const gap = C.checkSitemapCoverage(on(H, ['/blog/a/']), ['a', 'b'], H);
    const ghost = C.checkSitemapCoverage(on(H, ['/blog/a/', '/blog/ghost/']), ['a'], H);
    console.log([ok.ok, ok.parsed, gap.ok, gap.missing.join(','), ghost.ok, ghost.extra.join(',')].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The homepage is in every sitemap and has no receipt; it must NOT count as a ghost article.
  [ "$output" = "true 3 false b false ghost" ]
}

@test "cutover: a sitemap still advertising the OLD host fails -- the host is the thing this phase changes" {
  # The first version of checkSitemapCoverage stripped the host and compared slugs only, so this
  # exact input returned ok:true. A coverage check that cannot see the one field being changed is
  # decoration, and it was criterion 6's evidence.
  run _node "$PRE
    const H = 'arc.automemory.ai';
    const stale = '<urlset><loc>https://old.vercel.app/blog/a/</loc><loc>https://old.vercel.app/blog/b/</loc></urlset>';
    const r = C.checkSitemapCoverage(stale, ['a', 'b'], H);
    console.log([r.ok, r.missing.join(','), r.wrongHost.length, r.parsed].join(' '));
    // And the host is REQUIRED, so no caller can opt out of the check by omitting it.
    console.log(err(() => C.checkSitemapCoverage(stale, ['a'], undefined)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "${lines[0]}" = "false a,b 2 2" ]
  [ "${lines[1]}" = "BAD_SITE" ]
}

@test "cutover: planCutover REFUSES every ambiguity instead of counting it as work" {
  # Each of these was previously planned, reported as a correction, and then refused by the spine
  # -- which reports a no-op as a success. Found by an adversarial pass, not by this suite.
  run _node "$PRE
    const SHA = '$SHA_A';
    const A = '01KZZZZZZZZZZZZZZZZZZZZZZ1', B = '01KZZZZZZZZZZZZZZZZZZZZZZ2', D = '01KZZZZZZZZZZZZZZZZZZZZZZ4';
    const H = 'arc.automemory.ai';
    const p = (site, slug) => ({ site, slug, url: 'https://' + site + '/blog/' + slug, title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: SHA, pr_ref: '#2' });
    const ev = (id, sup, payload) => ({ id, supersedes: sup, payload });
    console.log(err(() => C.planCutover([ev(A, null, p('old.test','x')), ev(B, A, p('old.test','x')), ev(D, A, p('old.test','x'))], H)));
    console.log(err(() => C.planCutover([ev(A, B, p('old.test','x')), ev(B, A, p('old.test','x'))], H)));
    console.log(err(() => C.planCutover([ev(A, null, null)], H)));
    console.log(err(() => C.planCutover([ev(A, null, p('old.test','x')), ev(B, null, p('old.test','x'))], H)));
    console.log(err(() => C.planCutover([ev(A, SHA, p('old.test','x'))], H)));
    console.log(err(() => C.planCutover([ev(A, null, p('old.test','x')), ev(A, null, p('old.test','y'))], H)));
    console.log(err(() => C.planCutover([ev(A, null, p('old.test','x')), ev(B, A, p(H,'x')), ev(D, B, p('old.test','x'))], H)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "${lines[0]}" = "FORKED_CHAIN" ]     # two receipts supersede one predecessor
  [ "${lines[1]}" = "CHAIN_CYCLE" ]      # every event superseded; no head at all
  [ "${lines[2]}" = "UNREADABLE_HEAD" ]  # was counted as "already pinned"
  [ "${lines[3]}" = "AMBIGUOUS_SLUG" ]   # two live heads for one slug
  [ "${lines[4]}" = "BAD_SUPERSEDES" ]   # a content_sha where a ULID belongs
  [ "${lines[5]}" = "DUPLICATE_EVENT" ]
  [ "${lines[6]}" = "WOULD_COLLIDE" ]    # the correction re-creates a receipt already on the spine
}

@test "cutover: an inherited payload field is refused, not silently dropped from the correction" {
  # repinReceipt read fields with typeof payload[f] (prototype chain) and rebuilt with own keys
  # only, so an inherited field passed the check and then vanished -- the truncation the
  # UNKNOWN_FIELD guard exists to refuse. validate-content.mjs fixed this same shape one file over.
  run _node "$PRE
    const proto = Object.create({ pr_ref: '#9' });
    Object.assign(proto, { site: 'old.test', slug: 'x', url: 'https://old.test/blog/x', title: 'T', template_id: 'title-a', cluster_id: 'c-000', content_sha: '$SHA_A' });
    console.log(err(() => C.repinReceipt({ id: '01KZZZZZZZZZZZZZZZZZZZZZZ1', payload: proto }, 'arc.automemory.ai')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "INCOMPLETE_PRIOR" ]
}

# ---------------------------------------------------------------------------------------------
# Self-count. Required of a suite that IS the proof of a rule (.claude/rules/testing.md).
# ---------------------------------------------------------------------------------------------

@test "cutover: this suite registers every test it declares" {
  # bats silently DROPS a @test whose name carries a non-ASCII character -- five such tests in
  # Cycle 7 were never registered, never ran and never failed, and the file stayed green. The only
  # observable signal is the count falling. This asserts the count, and also re-checks the cause
  # directly so a failure says WHICH of the two happened.
  local declared
  declared="$(grep -c '^@test' "$BATS_TEST_FILENAME")"
  [ "$declared" -eq 14 ] || { echo "declared $declared, expected 14 -- update this number deliberately, never to make it pass"; false; }

  run grep -nP '^@test.*[^\x00-\x7F]' "$BATS_TEST_FILENAME"
  [ "$status" -ne 0 ] || { echo "non-ASCII in a @test name -- bats will drop it silently:"; echo "$output"; false; }
}
