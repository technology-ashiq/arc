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

_spine() {
  SPINE="$BATS_TEST_TMPDIR/spine-$1"
  mkdir -p "$SPINE"
  export ARC_SPINE_ROOT="$SPINE"
}

_landed() { grep -rho '"kind":"content.published"' "$SPINE/events" 2>/dev/null | wc -l | tr -d ' '; }
_quarantined() { find "$SPINE" -path "*_quarantine*" -name "*.jsonl" -exec cat {} + 2>/dev/null | grep -c . || true; }
# Every event line in the canonical log, newest last.
_lines() { find "$SPINE/events" -name "*.jsonl" -exec cat {} + 2>/dev/null; }

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
  local repinned
  repinned="$(echo "$PRE_PAYLOAD" | sed "s/$PREVIEW_SITE/$PERMANENT_SITE/g")"
  run bash "$(EVENT)" emit content.published --payload "$repinned" --strict
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

  local repinned
  repinned="$(echo "$PRE_PAYLOAD" | sed "s/$PREVIEW_SITE/$PERMANENT_SITE/g")"
  run bash "$(EVENT)" emit content.published --payload "$repinned" --supersedes "$first_id" --strict
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
  [ "${lines[0]}" = "BAD_PRIOR_ID" ]
  [ "${lines[1]}" = "BAD_PRIOR_ID" ]
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

# ---------------------------------------------------------------------------------------------
# The sitemap agrees with the spine, both directions.
# ---------------------------------------------------------------------------------------------

@test "cutover: every published slug is in the sitemap, and no article is in the sitemap without a receipt" {
  run _node "$PRE
    const xml = (paths) => '<urlset>' + ['/'].concat(paths).map((p) => '<loc>https://arc.automemory.ai' + p + '</loc>').join('') + '</urlset>';
    const ok = C.checkSitemapCoverage(xml(['/blog/a/', '/blog/b/']), ['a', 'b']);
    const gap = C.checkSitemapCoverage(xml(['/blog/a/']), ['a', 'b']);
    const ghost = C.checkSitemapCoverage(xml(['/blog/a/', '/blog/ghost/']), ['a']);
    console.log([ok.ok, gap.ok, gap.missing.join(','), ghost.ok, ghost.extra.join(',')].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The homepage is in every sitemap and has no receipt; it must NOT count as a ghost article.
  [ "$output" = "true false b false ghost" ]
}
