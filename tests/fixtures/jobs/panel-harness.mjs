#!/usr/bin/env node
/**
 * panel-harness.mjs -- drives the panel derivation against an injected schedule.
 *
 * WHY A FILE. The first version of the disabled-job test built a `file://` URL from a shell
 * variable inside `node -e`, which Git Bash hands over as a POSIX path (`/c/Users/...`) that
 * Node refuses as not absolute. It failed on the box that wrote it and would have failed on the
 * Windows CI leg for the same reason -- and this repo's rule already says an embedded program
 * belongs in its own file the moment it wants anything awkward. A relative import needs no URL
 * construction at all.
 *
 * Usage: node panel-harness.mjs <dir-holding-hq.jobs.yaml> <day> [observedFrom]
 * Output: one `ROW:` line per job, then `HARNESS-DONE <n>` -- printed only after the derivation
 * ran to completion, so a test can assert it RAN before asserting what it found.
 */

import { derivePanel, loadJobs, needsYouLines } from "../../../.claude/scripts/hq/lib/jobs/panel.mjs";

const [dir, day, observedFrom] = process.argv.slice(2);
if (!dir || !day) {
  process.stderr.write("usage: panel-harness.mjs <dir> <day> [observedFrom]\n");
  process.exit(64);
}

const jobs = loadJobs(dir);
if (jobs.length === 0) {
  // A fixture that loaded no jobs would make every assertion below vacuously true.
  process.stderr.write(`panel-harness: ${dir} yielded no jobs -- the fixture is empty\n`);
  process.exit(1);
}

const rows = derivePanel({ day, jobs, events: [], observedFrom: observedFrom || null });
for (const r of rows)
  process.stdout.write(`ROW:${r.name} state=${r.state} enabled=${r.enabled} overdue=${r.overdue} missed=${r.missed}\n`);
process.stdout.write(`NEEDSYOU:${needsYouLines(rows).length}\n`);
process.stdout.write(`HARNESS-DONE ${rows.length}\n`);
