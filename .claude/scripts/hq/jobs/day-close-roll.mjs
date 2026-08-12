#!/usr/bin/env node
/**
 * day-close-roll.mjs -- seal every unsealed day up to yesterday, oldest first, idempotently.
 *
 * The heartbeat's first duty is sealing the books, which turns tamper-evidence from an
 * occasional act into a daily fact.
 *
 * WHY THE ROLL IS HERE AND NOT IN THE CLI (ADR-0805). `arc-event close-day` closes exactly ONE
 * day, throws DAY_CLOSED when the day already has a marker, and throws NO_DAY when the day file
 * does not exist. It is neither idempotent nor multi-day, and the design source assumed it was
 * both. Adding `--roll` to the spine's own emitter would be a cross-lane diff to the most
 * safety-critical file in the repo for one consumer, so the walk lives here and borrows
 * `listDays` / `isDayClosed` rather than re-deriving what "unsealed" means.
 *
 * THREE OUTCOMES, KEPT DISTINGUISHABLE. `sealed`, `already_sealed` and `empty` are counted
 * separately and all three land in the receipt. Collapsing them into one exit code is the
 * vacuous-pass shape this repo has shipped three times: a run that sealed nothing because there
 * was nothing to seal and a run that sealed three days would produce the identical receipt, and
 * the fixture asserting exit 0 would pass for both.
 *
 * ON RETRY AFTER A CRASH. The wrapper's own `run.completed` receipt is keyed `job@slot`, so a
 * retry at the same slot is DUP_IDEM-quarantined by design (SCH-E double-fire protection). That
 * is safe here only because the WORK is receipted independently: every day sealed emits its own
 * `day.closed` event with its own idem. So a crash-then-retry loses the second run-receipt and
 * loses none of the evidence, which is the property the Phase-0 fixture asserts -- rather than
 * asserting exit 0, which would be true in the failure case too.
 *
 * Zero dependencies, Node 18+.
 */

import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spineRoot, listDays, isDayClosed } from "../lib/spine-io.mjs";
import { formatIst, dayOf, nowMs } from "../lib/canonical.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = resolve(HERE, "..", "arc-event.mjs");

/** Today in IST. Never the host's local day -- a UTC box would seal a day that is still open. */
function todayIst() {
  return dayOf(formatIst(nowMs()));
}

function main() {
  const root = spineRoot();
  const today = todayIst();

  // Oldest first. Ordering is load-bearing and lives only here: sealing out of order would
  // write a close marker for a later day while an earlier one is still open, and the immutability
  // window (ADR-0029) is then claimed for a day whose predecessor can still be appended to.
  const days = listDays(root)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter((d) => d < today)
    .sort();

  const result = { sealed: [], already_sealed: [], empty: [], failed: [] };

  for (const day of days) {
    if (isDayClosed(root, day)) {
      result.already_sealed.push(day);
      continue;
    }
    // `--strict` IS LOAD-BEARING, NOT DECORATION. arc-event runs in hook mode by default and
    // exits 0 on EVERY failure -- it writes `SKIP <code>` to stderr and returns success, so a
    // lock timeout, a torn append, a validation failure and a bad date all looked identical to
    // a sealed day. Measured: `close-day --date not-a-date` exits 0. Without this flag the job
    // reported `sealed=N failed=0` while sealing nothing, and the wrapper wrote a receipt
    // saying the books were closed. That is not a benign misread; it is failure reported as
    // success, on the one job whose entire purpose is tamper-evidence.
    //
    // argv array, never a shell string: a day is interpolated here, and a shell string is where
    // interpolation becomes injection. There is no shell in this path.
    const r = spawnSync(process.execPath, [ARC_EVENT, "close-day", "--date", day, "--strict"], {
      encoding: "utf8",
      windowsHide: true,
    });

    // The spawn itself can fail without ever producing a status: ENOENT, EACCES, EMFILE, or a
    // maxBuffer overflow all arrive as `r.error` with `status === null`.
    if (r.error) {
      result.failed.push({ day, status: null, stderr: `spawn failed: ${r.error.code || r.error.message}` });
      continue;
    }

    const stderr = String(r.stderr || "");
    // THE VERDICT COMES FROM THE FILESYSTEM, NOT FROM THE CHILD'S STDERR. A close marker either
    // exists afterwards or it does not; classifying on a stderr pattern means a legitimate
    // failure whose message happens to contain the token is filed as benign. Read the artifact,
    // do not parse the report about it.
    const closedNow = isDayClosed(root, day);
    if (r.status === 0 && closedNow) {
      result.sealed.push(day);
    } else if (closedNow) {
      // Raced with another sealer between the check above and this call: it is closed, and this
      // process is not the one that closed it. Benign, and counted as what it is.
      result.already_sealed.push(day);
    } else if (/NO_DAY/.test(stderr)) {
      // The day file vanished between listDays and here. A day with no events never had a file
      // and so was never in the list -- it is not a day that needs sealing.
      result.empty.push(day);
    } else {
      result.failed.push({ day, status: r.status, stderr: stderr.trim().slice(0, 400) });
    }
  }

  // The last stdout line is the job's structured result; the wrapper folds it into the receipt.
  process.stdout.write(
    `day-close-roll: sealed=${result.sealed.length} already_sealed=${result.already_sealed.length} ` +
      `empty=${result.empty.length} failed=${result.failed.length}\n`,
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);

  if (result.failed.length) {
    for (const f of result.failed)
      process.stderr.write(`day-close-roll: ${f.day} did not seal (exit ${f.status}): ${f.stderr}\n`);
    process.exit(1);
  }
  process.exit(0);
}

try {
  main();
} catch (e) {
  process.stderr.write(`day-close-roll: ${e?.message || e}\n`);
  process.exit(1);
}
