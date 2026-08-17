#!/usr/bin/env bats
# Phase 04 -- the publish path, the A/B slot, and the GEO parts (REQ-03, REQ-04, ADR-1102/1106/1113).
#
# THE POINT OF THIS FILE is the E2 guard and its running mutant. E2 is Tier E and unamendable: the
# machine writes branches and drafts, a human merges every publish. ADR-1102 puts the enforcement in
# the command itself and makes the guard a PARSE of the module graph, never a grep -- because a grep
# missed `from "fs"`, `fs/promises`, `child_process` and async exec/spawn the last time this repo
# tried one, and a mutant that overwrote the canonical file, deleted the champion, committed and
# spawned a deploy walked straight past it.
#
# THE MUTANT IS THE NEGATIVE CONTROL, and it is three separate fixtures rather than one, so each
# escape's rejection is attributable to a NAMED rule. A mutant that crashes on an unrelated fault
# before reaching its target behaviour is not a passing negative control (ADR-1102, verbatim).
#
# ASCII-only test names; the file asserts its registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const G = await import("./.claude/scripts/growth/lib/guard.mjs");
const E = await import("./.claude/scripts/growth/lib/exec-allowlist.mjs");
const T = await import("./.claude/scripts/growth/lib/templates.mjs");
const P = await import("./.claude/scripts/growth/lib/publish.mjs");
const GEO = await import("./.claude/scripts/growth/lib/geo.mjs");
const fs = await import("node:fs");
const CHOKE = ".claude/scripts/growth/lib/exec-allowlist.mjs";
const ENTRY = ".claude/scripts/growth/lib/publish.mjs";
const err = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.code || e.name; } };
const sha = (c) => c.repeat(64);
const pack = (over = {}) => ({ slug: "three-states-not-two", previewUrl: "https://preview.example.com/x",
  slopReport: "clean", citationReport: "clean", diff: "+1 -0", povLine: "POV: ...",
  templateId: "title-a", contentSha: sha("a"), ...over });'

# ---------- the module-graph guard is a PARSE ----------

@test "publish: the real publish graph carries no merge, push or deploy capability" {
  run _node "$PRE
    const r = G.auditPublishGraph(ENTRY, { chokePoint: CHOKE });
    console.log(r.modules.length + ' modules | ' + (r.findings.length ? r.findings.map((f) => f.rule).join(',') : 'none'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"| none"* ]] || { echo "the shipped publish graph has a finding: $output"; false; }
  # Positive control: the walk must have visited real modules, so 'none' is not the answer to an
  # empty graph.
  [[ "$output" != "0 modules"* ]] || { echo "the graph walk found nothing to audit: $output"; false; }
}

@test "publish: the guard reads CODE, not text that merely looks like code" {
  # This is the whole difference from a grep. An import named inside a comment or a string is not
  # an import, and a grep counts both.
  run _node "$PRE
    const src = 'import x from \"node:fs\";' + String.fromCharCode(10) +
                '// import y from \"child_process\";' + String.fromCharCode(10) +
                'const s = \"import z from child_process\";' + String.fromCharCode(10);
    const found = G.importsOf(src);
    console.log(found.length + ' ' + found.map((i) => i.specifier).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 node:fs" ]
}

@test "publish: a non-literal import specifier is a finding, not a silent pass" {
  # A graph walker that cannot resolve a specifier has not proven anything about what is behind it.
  # The path travels by ENVIRONMENT. A Windows temp path interpolated into a JS string literal
  # turns its backslashes into escape sequences -- which is how the sibling suite's exemplar test
  # failed on exactly one CI leg while passing everywhere else.
  export MUT_DYN="$BATS_TEST_TMPDIR/dyn.mjs"
  run _node "$PRE
    fs.writeFileSync(process.env.MUT_DYN, 'const n = \"fs\"; const m = await import(n);');
    const r = G.auditPublishGraph(process.env.MUT_DYN, { chokePoint: CHOKE });
    console.log(r.findings.map((f) => f.rule).join(',') || 'NONE');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"NON_LITERAL_IMPORT"* ]]
}

# ---------- the running mutant: three escapes, each attributable ----------

@test "publish: mutant escape 1 -- a merge is refused, and the refusal names the verb" {
  run _node "$PRE
    const m = await import('./tests/fixtures/growth/mutants/escape-1-merge.mjs');
    console.log([err(() => m.escapeViaGitMerge()), err(() => m.escapeViaGhPrMerge())].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BANNED_VERB BANNED_VERB" ]
}

@test "publish: mutant escape 2 -- every shape of a default-branch push is refused" {
  # Four spellings, because "push to main" has more than one and a guard that knows only the
  # obvious one has a hole. The bare `git push` is the interesting case: it names no branch at all
  # and pushes the current one to its upstream.
  run _node "$PRE
    const m = await import('./tests/fixtures/growth/mutants/escape-2-push-main.mjs');
    console.log([err(() => m.escapeViaPushMain()), err(() => m.escapeViaBarePush()),
                 err(() => m.escapeViaRefspec()), err(() => m.escapeViaForce())].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "PROTECTED_BRANCH UNSAFE_PUSH PROTECTED_BRANCH UNSAFE_PUSH" ]
}

@test "publish: mutant escape 3 -- a deploy hook is caught even with no import at all" {
  # This escape broke the FIRST version of the guard. `fetch` is a global, so a module-graph audit
  # that walked only import specifiers reported a clean graph while the escape sat in plain sight.
  run _node "$PRE
    const r = G.auditPublishGraph('tests/fixtures/growth/mutants/escape-3-deploy-hook.mjs', { chokePoint: CHOKE });
    console.log(r.findings.map((f) => f.rule).sort().join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NETWORK_CALL,SPAWN_OUTSIDE_CHOKE_POINT" ]
}

@test "publish: the allowlist tables themselves cannot contain a publishing verb" {
  # The second half of the audit. A mutant that adds `merge` to GIT_ALLOWED changes no import and
  # no call site, so the graph walk alone would report clean.
  run _node "$PRE
    const clean = G.auditAllowlists(E);
    const mutant = G.auditAllowlists({ ...E, GIT_ALLOWED: [...E.GIT_ALLOWED, 'merge'] });
    const gutted = G.auditAllowlists({ ...E, BANNED_VERBS: [], PROTECTED_BRANCHES: [] });
    console.log((clean.length ? clean.map((f) => f.rule).join(',') : 'clean') + ' | ' +
                mutant.map((f) => f.rule).sort().join(',') + ' | ' +
                gutted.map((f) => f.rule).sort().join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "clean | BANNED_VERB_ALLOWED,PUBLISHING_VERB_ALLOWED | EMPTY_BANNED_LIST,EMPTY_PROTECTED_LIST" ]
}

@test "publish: only the choke point may spawn a subprocess" {
  run _node "$PRE
    const r = G.auditPublishGraph('tests/fixtures/growth/mutants/escape-3-deploy-hook.mjs', { chokePoint: CHOKE });
    const spawn = r.findings.filter((f) => f.rule === 'SPAWN_OUTSIDE_CHOKE_POINT');
    const choke = G.auditPublishGraph(CHOKE, { chokePoint: CHOKE });
    console.log(spawn.length + ' ' + (choke.findings.length === 0 ? 'choke-point-clean' : 'CHOKE-POINT-FLAGGED'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 choke-point-clean" ]
}

# ---------- the review pack ----------

@test "publish: a pack without a preview URL is INVALID, not incomplete" {
  run _node "$PRE
    console.log([err(() => P.buildReviewPack(pack({ previewUrl: undefined }))),
                 err(() => P.buildReviewPack(pack({ previewUrl: '' }))),
                 err(() => P.buildReviewPack(pack({ previewUrl: 'http://insecure/x' }))),
                 err(() => P.buildReviewPack(pack({ diff: '' }))),
                 err(() => P.buildReviewPack(pack()))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO_PREVIEW_URL NO_PREVIEW_URL BAD_PREVIEW_URL INCOMPLETE_PACK NO-THROW" ]
}

@test "publish: the pack is ONE item carrying all five sections" {
  run _node "$PRE
    const p = P.buildReviewPack(pack());
    console.log(p.sections.map((s) => s.name).join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "preview,slop-lint,citation-lint,diff,pov-floor" ]
}

@test "publish: the CLI refuses to build a pack with no preview URL" {
  # The library refusal is not the whole story: the CLI is the caller, and a caller that swallowed
  # the error would leave the guard uncovered where it actually runs.
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" publish three-states-not-two \
    --article "$ARC_ROOT/initiatives/growth/exemplars/01-what-a-rate-limit-taught-us-about-evidence.md" \
    --plan "$ARC_ROOT/initiatives/growth/clusters/c-001.json" --offline
  [ "$status" -ne 0 ] || { echo "the CLI built a pack with no preview URL: $output"; false; }
  [[ "$output" == *"NO_PREVIEW_URL"* ]]
}

@test "render: the arm comes from the ASSIGNMENT, and a draft naming its own is overridden" {
  # FOUND ON THE FIRST REAL ARTICLE, 2026-08-18. `render` took template_id from the DRAFT while
  # `publish` computed assignArm(slug) independently, so the two could disagree -- and they did on
  # the first one written: the frontmatter said title-a, the assignment said title-b.
  #
  # Not cosmetic. template_id is a content.published payload field validated on its VALUES (REQ-04),
  # so the file would claim one arm while the receipt carried the other, and every A/B number
  # derived from those receipts would describe an experiment that did not happen. A draft naming its
  # own arm is a draft opting itself out of the experiment.
  #
  # This drives the CLI, not renderMdx, because the derivation lives in the CLI -- testing the
  # library here would leave the actual caller uncovered, which is the shape the sibling test above
  # was written for.
  local d="$BATS_TEST_TMPDIR/draft.json" out="$BATS_TEST_TMPDIR/a.mdx"
  # The slug is chosen because assignArm maps it to title-b; the draft deliberately claims title-a.
  cat > "$d" <<'JSON'
{"title":"T","meta":"M","slug":"multi-agent-ai-coding-workflows","template_id":"title-a","pubDate":"2026-08-18","body":"Body text."}
JSON
  [ -s "$d" ] || { echo "fixture is empty -- an empty fixture is a silent pass generator"; false; }

  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" render \
    --draft "$d" --plan "$ARC_ROOT/initiatives/growth/clusters/c-001.json" --out "$out"
  [ "$status" -eq 0 ] || { echo "$output"; false; }

  # Assert it RAN before asserting what it wrote.
  [ -s "$out" ] || { echo "render exited 0 and wrote nothing"; false; }
  grep -q 'template_id: "title-b"' "$out" || { echo "arm not derived from the slug:"; grep template_id "$out"; false; }
  grep -q 'template_id: "title-a"' "$out" && { echo "the draft's arm survived into the file"; false; }

  # The positive control: the derivation agrees with the function publish uses, rather than with a
  # constant this test happens to hardcode.
  run _node "const T = await import('./.claude/scripts/growth/lib/templates.mjs');
    console.log(T.assignArm('multi-agent-ai-coding-workflows'));"
  [ "$output" = "title-b" ]
}

# ---------- the A/B slot ----------

@test "publish: arm assignment is replay-identical through the PRODUCTION path" {
  # The fixture invokes the REAL command twice and compares what it printed. A hash
  # re-implemented inside the test would prove the test agrees with itself: arc-engine, 2026-08-03,
  # where a fake that swapped the code path let a three-driver contract suite pass while zero real
  # driver code ran.
  args=(publish three-states-not-two
    --article "$ARC_ROOT/initiatives/growth/exemplars/01-what-a-rate-limit-taught-us-about-evidence.md"
    --plan "$ARC_ROOT/initiatives/growth/clusters/c-001.json"
    --preview "https://preview.example.com/x" --offline)
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" "${args[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  first="$(printf '%s\n' "$output" | grep '^arm: ')"
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" "${args[@]}"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  second="$(printf '%s\n' "$output" | grep '^arm: ')"
  [ -n "$first" ] || { echo "the command printed no arm line at all"; false; }
  [ "$first" = "$second" ] || { echo "arm not replay-identical: [$first] vs [$second]"; false; }
}

@test "publish: template_id is validated on its VALUES, not merely its presence" {
  # arc-memory, 2026-08-12: an enum enforced on a field's NAME let a confident wrong value pass as
  # clean for a whole cycle.
  run _node "$PRE
    console.log([err(() => T.assertTemplateId('title-a')), err(() => T.assertTemplateId('title-c')),
                 err(() => T.assertTemplateId('')), err(() => T.assertTemplateId(undefined))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO-THROW BAD_TEMPLATE_ID BAD_TEMPLATE_ID BAD_TEMPLATE_ID" ]
}

@test "publish: the enumerated template set and the files on disk agree" {
  # ONE list, two readers, and this is the thing that fails when they drift. A validator that read
  # the directory itself would be a spine check with a filesystem dependency; a constant with no
  # drift test is a constant that goes stale.
  run _node "$PRE
    const onDisk = T.loadTemplates('initiatives/growth/templates').map((t) => t.template_id).sort();
    const enumerated = [...T.TEMPLATE_IDS].sort();
    console.log(onDisk.join(',') + ' | ' + enumerated.join(',') + ' | ' +
                (onDisk.join(',') === enumerated.join(',') ? 'agree' : 'DRIFTED'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "title-a,title-b | title-a,title-b | agree" ]
}

@test "publish: a template file whose id does not match its filename is refused" {
  # Two files claiming one identity would make the arm a slug resolves to depend on read order.
  export TPL_DIR="$BATS_TEST_TMPDIR/tpl"
  run _node "$PRE
    const d = process.env.TPL_DIR;
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(d + '/title-a.md', '---' + String.fromCharCode(10) + 'template_id: title-b' + String.fromCharCode(10) + 'version: 1' + String.fromCharCode(10) + '---' + String.fromCharCode(10));
    console.log(err(() => T.loadTemplates(d)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_TEMPLATE" ]
}

@test "publish: growth emits zero experiment kinds" {
  # That stream is evolve's and the two are never summed (ADR-0302, ADR-1106). An absence check, so
  # it carries a positive control: the grep must be able to find something in these files at all.
  run bash -c "grep -rl 'experiment\.' '$ARC_ROOT/.claude/scripts/growth/' || true"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ -z "$output" ] || { echo "a growth source names an experiment kind: $output"; false; }
  run bash -c "grep -rl 'content\.published' '$ARC_ROOT/.claude/scripts/growth/' || true"
  [ -n "$output" ] || { echo "positive control failed: the grep finds nothing in growth at all"; false; }
}

# ---------- update vs duplicate, and the unedited counter ----------

@test "publish: re-publishing a slug is an update, not a duplicate page" {
  # REWRITTEN 2026-08-16 (ADR-1119). This pinned `supersedes === content_sha` as correct, and it
  # is not: the spine's `supersedes` is a ULID naming an EVENT, and after a site re-pin BOTH
  # receipts carry one content_sha, so the sha could not identify which event it meant even if the
  # grammar had allowed it. The fixture also used two DIFFERENT shas, the single shape in which a
  # sha-keyed pointer looks like it works. Both receipts below share one sha, deliberately.
  run _node "$PRE
    const A = '01KZZZZZZZZZZZZZZZZZZZZZZ1', B = '01KZZZZZZZZZZZZZZZZZZZZZZ2';
    const none = P.classifyPublication('a', []);
    const again = P.classifyPublication('a', [
      { id: A, slug: 'a', content_sha: sha('x') },
      { id: B, slug: 'a', content_sha: sha('x') }]);
    console.log(none.kind + ' ' + again.kind + ' ' + again.priorCount + ' ' + (again.supersedesEventId === B ? 'names-last-event' : 'WRONG-TARGET'));
    // Bare payloads can no longer answer this question, and say so instead of guessing.
    console.log(err(() => P.classifyPublication('a', [{ slug: 'a', content_sha: sha('x') }])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "${lines[0]}" = "new update 2 names-last-event" ]
  [ "${lines[1]}" = "BAD_INPUT" ]
}

@test "publish: sha-equal increments the counter and sha-different neither increments nor resets" {
  # The asymmetry is the rule. An edited article is not evidence about the drafting, and it is not
  # counter-evidence either -- zeroing on an edit would make the number a measure of the last
  # article rather than of the twenty (ADR-1107).
  run _node "$PRE
    const t = P.tallyUnedited([
      { draft_sha: sha('a'), approved_sha: sha('a') },
      { draft_sha: sha('b'), approved_sha: sha('c') },
      { draft_sha: sha('d'), approved_sha: sha('d') },
      { draft_sha: sha('e'), approved_sha: sha('f') }]);
    console.log(t.unedited + ' ' + t.edited + ' ' + t.bar + ' ' + t.l2Eligible);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # 2 unedited survive two interleaved edits: the count did not reset.
  [ "$output" = "2 2 20 false" ]
}

@test "publish: a truncated sha is refused rather than silently read as an edit" {
  run _node "$PRE
    console.log(err(() => P.tallyUnedited([{ draft_sha: 'abc', approved_sha: 'abc' }])));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_INPUT" ]
}

# ---------- GEO: well-formed, and never described as a lever ----------

@test "publish: the Article JSON-LD is well-formed and refuses what it cannot evidence" {
  run _node "$PRE
    const good = GEO.articleJsonLd({ title: 'T', description: 'D', url: 'https://arc.automemory.ai/blog/x/',
      datePublished: '2026-08-14', authorName: 'arc', publisherName: 'Automemory' });
    console.log(good['@type'] + ' ' + good['@context'] + ' ' +
      err(() => GEO.articleJsonLd({ title: 'T', description: 'D', url: 'http://insecure/x', datePublished: '2026-08-14', authorName: 'a', publisherName: 'p' })) + ' ' +
      err(() => GEO.articleJsonLd({ title: 'T', description: 'D', url: 'https://x.test/', datePublished: 'yesterday', authorName: 'a', publisherName: 'p' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "Article https://schema.org BAD_ARTICLE BAD_ARTICLE" ]
}

@test "publish: an empty FAQPage is refused rather than rendered" {
  # A FAQPage with no questions is a structured-data claim that the page answers questions it does
  # not answer. E3 applies to machine-readable fields as much as to prose.
  run _node "$PRE
    console.log(err(() => GEO.faqJsonLd([])) + ' ' + err(() => GEO.faqJsonLd([{ question: 'Q?', answer: '' }])) + ' ' +
                GEO.faqJsonLd([{ question: 'Q?', answer: 'A.' }]).mainEntity.length);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "EMPTY_FAQ BAD_FAQ 1" ]
}

@test "publish: JSON-LD cannot close its own script tag" {
  run _node "$PRE
    const s = GEO.jsonLdScript({ a: '</' + 'script>' });
    console.log(s.includes('</' + 'script>' + String.fromCharCode(10)) ? 'closes-normally' : 'NO-CLOSE');
    console.log(/<\\\\\\//.test(s) ? 'escaped' : 'NOT-ESCAPED');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"escaped"* ]]
}

@test "publish: llms.txt is checked well-formed and never called a lever" {
  # ADR-1113 forbids llms.txt from appearing in any exit criterion as a lever. The assertion here
  # is shape and nothing else, and no test in this file measures an effect from it.
  run _node "$PRE
    const t = GEO.llmsTxt({ siteName: 'arc', siteUrl: 'https://arc.automemory.ai', summary: 's',
      links: [{ title: 'a', url: 'https://arc.automemory.ai/blog/a/' }] });
    console.log((t.startsWith('# arc') ? 'titled' : 'NO-TITLE') + ' ' +
                (t.includes('> s') ? 'summarised' : 'NO-SUMMARY') + ' ' +
                err(() => GEO.llmsTxt({ siteName: 'a', siteUrl: 'http://insecure', summary: 's' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "titled summarised BAD_LLMS" ]
}

@test "publish: the disclaimer names the author entity and the not-advice line" {
  run _node "$PRE
    const d = GEO.disclaimerFooter({ authorName: 'arc' });
    console.log((d.includes('arc') ? 'named' : 'UNNAMED') + ' ' +
                (d.includes('not professional advice') ? 'disclaimed' : 'NO-DISCLAIMER') + ' ' +
                err(() => GEO.disclaimerFooter({ authorName: '' })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "named disclaimed BAD_DISCLAIMER" ]
}

@test "publish: bats registers every test this file declares" {
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 18 ]
}
