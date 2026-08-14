#!/usr/bin/env bats
# Phase 05 -- the EVO-H0 feed (REQ-05, ADR-1108/1109). The spec-verify gate, the weekly ingest and
# its refusals, and the brief line.
#
# THE FAILURE THIS PHASE IS BUILT AGAINST DOES NOT ERROR. A mis-set export range, or a week
# boundary defined in the wrong timezone, produces PLAUSIBLE WRONG DATA attributed to the wrong
# week -- worse than a gap, because a gap is visible. Every test below is a refusal, and each
# refusal names both of the things it compared.
#
# ASCII-only test names; the file asserts its registered count at the bottom.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const I = await import("./.claude/scripts/growth/lib/ingest.mjs");
const SV = await import("./.claude/scripts/growth/lib/spec-verify.mjs");
const F = await import("./.claude/scripts/growth/lib/feed.mjs");
const V = await import("./.claude/scripts/hq/lib/validate-leads.mjs");
const err = (fn) => { try { fn(); return "NO-THROW"; } catch (e) { return e.code || e.name; } };
const DAY = 86400000;'

# ---------- (a) the spec-verify, as a gate rather than a claim ----------

@test "feed: the spec-verify reproduces exactly ADR-1109's four findings against the LIVE validator" {
  # A verify run once by hand is a claim. This one re-runs, and BOTH directions block: a NEW
  # finding means the shared organ moved under us, and a MISSING one means the owning lane fixed
  # its validator and growth's conformance decision must be re-read.
  run _node "$PRE
    const r = SV.runSpecVerify(V);
    const v = SV.verdict(r);
    console.log(v.pass + ' ' + v.got.join(',') + ' | missing=' + (v.missing.join(',') || 'none') + ' new=' + (v.unexpected.join(',') || 'none'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true D1,D2,D3,D4 | missing=none new=none" ]
}

@test "feed: the spec-verify refuses to report at all when its own control payload fails" {
  # THE POSITIVE CONTROL, and it is not decoration: it fired on its author. The first conforming
  # payload was missing `unit_count`, so every probe below it would have been "refused" for the
  # wrong reason and the gate would have reported four findings that meant nothing.
  run _node "$PRE
    const stub = { assertLeads() { throw Object.assign(new Error('nope'), { code: 'BAD_LEADS' }); } };
    console.log(err(() => SV.runSpecVerify(stub)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "CONTROL_FAILED" ]
}

@test "feed: a validator that accepts everything makes the gate BLOCK, not pass" {
  # The other direction. If leads ever widened its grammars to accept ISO weeks and dotted
  # surfaces, all four known deviations would vanish -- and a gate that reported PASS on that would
  # be reporting "no drift" about a validator that had completely changed.
  run _node "$PRE
    const permissive = { assertLeads() { return true; } };
    const v = SV.verdict(SV.runSpecVerify(permissive));
    console.log(v.pass + ' missing=' + v.missing.join(','));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "false missing=D1,D2,D3,D4" ]
}

@test "feed: the CLI spec-verify exits non-zero on drift and zero when it matches" {
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" spec-verify
  [ "$status" -eq 0 ] || { echo "spec-verify blocked against the live validator: $output"; false; }
  [[ "$output" == *"D1"* && "$output" == *"D4"* ]]
}

# ---------- (b) the window encoding: PT days converted, never an independent IST boundary ----------

@test "feed: the window bounds are the verified PT days converted to IST instants" {
  # ADR-1108's adversarial pass killed the first version of this rule, which took the ISO week's
  # Monday 00:00+05:30 as the bound. PT and IST are ~12.5h apart, so an independently-defined
  # Monday-IST boundary covers a DIFFERENT span of instants than the PT week the CSV reports --
  # and that failure does not error, it attributes real clicks to the wrong week.
  run _node "$PRE
    const d = I.isoWeekDays('2026-W36');
    const b = I.istBoundsForPacificDays(d);
    console.log(d[0] + '..' + d[6] + ' | ' + b.window_start + ' | ' + b.window_end + ' | ' + ((b.endMs - b.startMs) / 3600000) + 'h');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # 12:30 IST is midnight Pacific in August. NOT 00:00+05:30, which is what an independent IST
  # boundary would have produced.
  [ "$output" = "2026-08-31..2026-09-06 | 2026-08-31T12:30:00+05:30 | 2026-09-07T12:30:00+05:30 | 168h" ]
}

@test "feed: a week containing a DST transition is 169 hours, not 168" {
  # The proof that the offset is read from a real IANA zone rather than hardcoded. 2026-11-01 is
  # the US fall-back and sits inside ISO week 44; a fixed -7/-8 would silently mis-stamp it.
  run _node "$PRE
    const w44 = I.istBoundsForPacificDays(I.isoWeekDays('2026-W44'));
    const w36 = I.istBoundsForPacificDays(I.isoWeekDays('2026-W36'));
    console.log(((w44.endMs - w44.startMs) / 3600000) + ' ' + ((w36.endMs - w36.startMs) / 3600000) + ' ' + w44.window_end);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "169 168 2026-11-02T13:30:00+05:30" ]
}

@test "feed: the derived window is accepted by the LIVE validator" {
  # The encoding is only correct if the real validator takes it. Asserting the string shape here
  # would be asserting that this file agrees with itself.
  run _node "$PRE
    const b = I.istBoundsForPacificDays(I.isoWeekDays('2026-W36'));
    const payload = { module: 'growth', surface: 'title-template', metric: 'clicks', value: 12,
      unit_count: 12, window_start: b.window_start, window_end: b.window_end, source_id: I.sourceIdFor('2026-W36') };
    console.log(err(() => V.assertLeads({ kind: 'metric.observed', payload })));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO-THROW" ]
}

@test "feed: a malformed or non-existent ISO week is refused" {
  run _node "$PRE
    console.log([err(() => I.isoWeekDays('2026-W54')), err(() => I.isoWeekDays('2026-36')),
                 err(() => I.isoWeekDays('2026-W00')), err(() => I.isoWeekDays(''))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_WEEK BAD_WEEK BAD_WEEK BAD_WEEK" ]
}

# ---------- (b) the refusals ----------

@test "feed: the range-match guard refuses a mismatch and names BOTH ranges" {
  run _node "$PRE
    const d = I.isoWeekDays('2026-W36');
    let msg = '';
    try { I.assertRangeMatch({ start: '2026-08-24', end: '2026-08-30' }, d); } catch (e) { msg = e.message; }
    console.log(err(() => I.assertRangeMatch({ start: d[0], end: d[6] }, d)) + ' ' +
                err(() => I.assertRangeMatch({ start: '2026-08-24', end: d[6] }, d)) + ' ' +
                err(() => I.assertRangeMatch(null, d)) + ' ' +
                (msg.includes('2026-08-24') && msg.includes('2026-08-31') ? 'names-both' : 'NAMES-ONE'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "NO-THROW RANGE_MISMATCH NO_EXPORT_RANGE names-both" ]
}

@test "feed: the lag floor refuses a week under three days old" {
  # A floor, NOT a completeness guarantee. Search Console backfills for days, so an early read is a
  # wrong read -- and because the CSV cannot say "preliminary", a re-ingest yielding different
  # numbers is EXPECTED and lands as a correction rather than an overwrite.
  run _node "$PRE
    const d = I.isoWeekDays('2026-W36');
    const lastEnd = Date.parse(d[6] + 'T00:00:00Z') + DAY;
    console.log(err(() => I.assertLagFloor(d, lastEnd + DAY)) + ' ' +
                err(() => I.assertLagFloor(d, lastEnd + 5 * DAY)) + ' ' +
                err(() => I.assertLagFloor(d, 'now')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "TOO_EARLY NO-THROW BAD_NOW" ]
}

@test "feed: the parser identifies columns by header CONTENT and refuses an unknown set" {
  # The exact filenames inside the export ZIP, and whether headers localize to the account's UI
  # language, could not be verified from any primary source. So it refuses rather than guessing by
  # position -- a positional guess silently reads the wrong column.
  run _node "$PRE
    const ok = I.parseGscCsv('Top pages,Clicks' + String.fromCharCode(10) + '\"https://a.test/x/\",12');
    const alt = I.parseGscCsv('URL,Click' + String.fromCharCode(10) + '\"https://a.test/x/\",12');
    console.log(ok.rows.length + ' ' + alt.rows.length + ' ' +
                err(() => I.parseGscCsv('Foo,Bar' + String.fromCharCode(10) + '1,2')) + ' ' +
                err(() => I.parseGscCsv('')) + ' ' +
                err(() => I.parseGscCsv('Page,Clicks')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1 1 UNRECOGNISED_HEADERS EMPTY_EXPORT EMPTY_EXPORT" ]
}

@test "feed: a thousands-separated click count parses, and a non-numeric one is refused" {
  run _node "$PRE
    const r = I.parseGscCsv('Page,Clicks' + String.fromCharCode(10) + '\"https://a.test/x/\",\"1,020\"');
    console.log(r.rows[0].clicks + ' ' + err(() => I.parseGscCsv('Page,Clicks' + String.fromCharCode(10) + '\"https://a.test/x/\",lots')));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "1020 BAD_ROW" ]
}

@test "feed: the slug join takes the supersedes-chain HEAD, not the stale receipt" {
  # The Phase 1 domain cutover leaves TWO receipts per pre-cutover slug. A join on slug alone picks
  # the stale preview one and attributes a week of real clicks to a URL nobody visited.
  run _node "$PRE
    const receipts = [
      { slug: 'a', url: 'https://old.vercel.app/blog/a/', content_sha: 'old' },
      { slug: 'a', url: 'https://arc.automemory.ai/blog/a/', content_sha: 'new', supersedes: 'old' }];
    const head = I.resolveSlugUrl([{ url: 'https://arc.automemory.ai/blog/a/', clicks: 9 }], receipts);
    const stale = I.resolveSlugUrl([{ url: 'https://old.vercel.app/blog/a/', clicks: 9 }], receipts);
    // Joined EXPLICITLY as strings. Written as bare + it is arithmetic: 1 + 0 is 1, not '10', and
    // the assertion then compares a number-shaped string it never meant to build.
    console.log([head.joined.length, head.unjoined.length].join('/') + ' ' +
                [stale.joined.length, stale.unjoined.length].join('/') + ' ' +
                (head.joined[0] ? head.joined[0].content_sha : 'NONE'));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # The live URL joins to the head; the superseded URL does NOT join and is reported unjoined.
  [ "$output" = "1/0 0/1 new" ]
}

@test "feed: a window is COMPLETE only after every receipt is confirmed, and MISSING otherwise" {
  # MISSING is never zero. A zero claims the week had no traffic; MISSING is the truth, which is
  # that nobody knows. This lane has already had an emitter exit 0 while its receipts sat in
  # quarantine.
  run _node "$PRE
    console.log([I.windowState({ emitted: 3, attempted: 3 }).state,
                 I.windowState({ emitted: 2, attempted: 3 }).state,
                 I.windowState({ emitted: 0, attempted: 3 }).state,
                 I.windowState({ emitted: 0, attempted: 0 }).state].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "COMPLETE MISSING MISSING MISSING" ]
}

@test "feed: the CLI ingest refuses without a declared export range" {
  printf 'Page,Clicks\n"https://a.test/x/",12\n' > "$BATS_TEST_TMPDIR/e.csv"
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" ingest "$BATS_TEST_TMPDIR/e.csv" --week 2026-W36
  [ "$status" -ne 0 ] || { echo "ingested with no range-match guard: $output"; false; }
  [[ "$output" == *"NO_EXPORT_RANGE"* ]]
}

@test "feed: the CLI ingest prints no site total" {
  # Search Console anonymizes low-volume rows, so a per-row sum UNDER-reports -- and a total that
  # is quietly too low is the plausible-wrong-number this whole path is built against.
  printf 'Page,Clicks\n"https://a.test/x/",12\n"https://a.test/y/",30\n' > "$BATS_TEST_TMPDIR/e.csv"
  run node "$ARC_ROOT/.claude/scripts/growth/arc-growth.mjs" ingest "$BATS_TEST_TMPDIR/e.csv" \
    --week 2026-W32 --range-start 2026-08-03 --range-end 2026-08-09
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" != *"total"* ]] || { echo "the ingest printed a total: $output"; false; }
  [[ "$output" == *"MISSING, never zero"* ]]
}

# ---------- (c) the brief line ----------

@test "feed: with no receipts the empty state says the clock has not started, not zero" {
  # And it is OPT-IN. Returned unconditionally, it put a permanent block about a parked lane into
  # every other lane's daily brief -- and `spine-brief.bats` was right to break over it.
  run _node "$PRE
    const asked = F.feedLines([], Date.parse('2026-09-14T00:00:00Z'), { includeEmpty: true });
    const brief = F.feedLines([], Date.parse('2026-09-14T00:00:00Z'));
    console.log(asked.length + ' ' + brief.length + ' | ' + asked[0]);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == "1 0 | "* ]] || { echo "the empty state is not opt-in: $output"; false; }
  [[ "$output" == *"NO metric.observed receipts"* ]]
  [[ "$output" != *": 0 "* ]] || { echo "the line reported a zero: $output"; false; }
}

@test "feed: the brief line reports age and names the MISSING weeks" {
  run _node "$PRE
    const ev = [{ event: { kind: 'metric.observed', payload: { module: 'growth', surface: 'title-template',
      window_start: '2026-08-31T12:30:00+05:30', window_end: '2026-09-07T12:30:00+05:30', source_id: 'gsc-2026-W36' } } }];
    const l = F.feedLines(ev, Date.parse('2026-09-14T00:00:00Z'), { expectedWeeks: ['2026-W36', '2026-W37'] });
    console.log(l.join(' // '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [[ "$output" == *"newest ends 6 day(s) ago"* ]]
  [[ "$output" == *"MISSING 2026-W37"* ]]
}

@test "feed: another lane's metric.observed receipts are not counted as growth's" {
  run _node "$PRE
    const ev = [{ event: { kind: 'metric.observed', payload: { module: 'leads', surface: 'campaign' } } }];
    const l = F.feedLines(ev, Date.parse('2026-09-14T00:00:00Z'), { includeEmpty: true });
    console.log(l[0].includes('NO metric.observed') ? 'ignored' : 'COUNTED-ANOTHER-LANE');"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "ignored" ]
}

@test "feed: the feed line needs an explicit clock" {
  # An implicit clock cannot be tested, and this line's whole job is reporting an age.
  run _node "$PRE
    console.log(err(() => F.feedLines([], undefined)) + ' ' + err(() => F.feedLines('not an array', 1)));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "BAD_NOW BAD_INPUT" ]
}

@test "feed: arc-brief renders the growth lines when given them and is unchanged without" {
  # The wiring into a SHARED organ. The baseline must be byte-identical when no lines are passed,
  # because ten suites from four other lanes assert on this renderer's output.
  # `env VAR=x _node ...` cannot work: `_node` is a bats FUNCTION, and env execs a program. It
  # failed with "env: '_node': No such file or directory" -- a test that never ran the thing it
  # was asserting about.
  export ARC_SPINE_ROOT="$BATS_TEST_TMPDIR/spine"
  run _node "const B = await import(\"./.claude/scripts/hq/arc-brief.mjs\");
    const withLines = B.render('2026-08-14', [], [], { feedLines: ['growth feed: test line'] });
    const without = B.render('2026-08-14', [], [], {});
    console.log((withLines.includes('growth feed: test line') ? 'rendered' : 'DROPPED') + ' ' +
                (without.includes('growth feed') ? 'LEAKED' : 'absent') + ' ' + JSON.stringify(without));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = 'rendered absent "brief 2026-08-14\n"' ]
}

@test "feed: a correction lands and a re-ingest stays idempotent" {
  # ADR-1117, found by probing the LIVE code at the Phase 05 close rather than reading it. The idem
  # preimage excludes `value` (correctly -- it identifies WHICH measurement this is, not what it
  # said) and the emitter derives the leads key WITHOUT `supersedes`, though it passes `supersedes`
  # for the experiment family two lines away. So a re-ingest with different numbers hashed
  # IDENTICALLY and was dropped as DUP_IDEM: the correction path that ADR-1108 calls load-bearing
  # did not work, and every file read on its own looked correct.
  run _node "$PRE
    const base = { module: 'growth', surface: 'title-template', metric: 'clicks', value: 12, unit_count: 12,
      window_start: '2026-08-03T12:30:00+05:30', window_end: '2026-08-10T12:30:00+05:30', source_id: I.sourceIdFor('2026-W32') };
    const same = V.leadsIdem('metric.observed', base);
    const reingest = V.leadsIdem('metric.observed', { ...base });
    const naive = V.leadsIdem('metric.observed', { ...base, value: 19, unit_count: 19 });
    const fixed = V.leadsIdem('metric.observed', { ...base, value: 19, unit_count: 19, source_id: I.sourceIdFor('2026-W32', 2) });
    console.log([(same === reingest) ? 'idempotent' : 'NOT-IDEMPOTENT',
                 (same === naive) ? 'naive-collides' : 'NAIVE-ESCAPED',
                 (same !== fixed) ? 'revision-lands' : 'REVISION-COLLIDES',
                 err(() => V.assertLeads({ kind: 'metric.observed', payload: { ...base, source_id: I.sourceIdFor('2026-W32', 2) } }))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  # 'naive-collides' is the NEGATIVE CONTROL: it pins the defect ADR-1117 works around. If the
  # emitter is ever fixed it flips to NAIVE-ESCAPED and this test goes red on purpose, which is
  # ADR-1117's revisit trigger firing rather than rotting.
  [ "$output" = "idempotent naive-collides revision-lands NO-THROW" ]
}

@test "feed: the revision suffix is an explicit act and refuses a nonsense value" {
  run _node "$PRE
    console.log([I.sourceIdFor('2026-W32'), I.sourceIdFor('2026-W32', 2),
                 err(() => I.sourceIdFor('2026-W32', 0)), err(() => I.sourceIdFor('2026-W32', 1.5))].join(' '));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "gsc-2026-W32 gsc-2026-W32-r2 BAD_REVISION BAD_REVISION" ]
}

@test "feed: the spec-verify probes the emitter surface, not only the validator" {
  # D1-D4 diff the payload GRAMMAR. This asks a different question of a different file: can a
  # correction land at all? Probed so that when the emitter IS fixed, the answer changes here
  # rather than in someone's memory.
  run _node "$PRE
    const p = SV.probeCorrectionCollision(V);
    console.log(p.collides + ' ' + p.revisionEscapes);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "true true" ]
}

@test "feed: bats registers every test this file declares" {
  declared="$(grep -c '^@test ' "$BATS_TEST_FILENAME")"
  registered="$(bats --count "$BATS_TEST_FILENAME")"
  [ "$registered" -eq "$declared" ] || { echo "declared $declared, bats registered $registered"; false; }
  [ "$declared" -gt 15 ]
}
