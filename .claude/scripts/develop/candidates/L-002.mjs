/**
 * Candidate L-002 — "a fire-and-forget emitter reporting success while its receipt was
 * silently quarantined".
 *
 * This is the executable half of learning row L-002. It is handed one fixture and returns
 * whether the failure that row describes is present in it. Nothing else.
 *
 * The shape it looks for is NOT "an emitter exists" — it is the specific pairing that made
 * the failure invisible: something reports success (exit 0, "ok", "success", a swallowed
 * error) in the same artifact where a write was rejected, discarded, quarantined or dropped.
 * A candidate that flagged every mention of a receipt would catch this one fixture and block
 * every legitimate one, which is exactly the trade the replay's two counts exist to expose.
 */

// "Reports success" is wider than an exit code. The failure this catches is a claim of
// health made in the same breath as a lost write, and the most dangerous form of that claim
// is prose: "working as designed", "no data loss". The 2026-07-28 incident was exactly that
// — 22 quarantine rejections read as "dedup working as designed, no data loss", while 100
// real receipts were gone. Restricting this to `exit 0` would miss the instance that cost
// four days.
const REPORTS_SUCCESS =
  /\b(exit(?:ed|s)?\s*0|exit code 0|reported success|returned success|\bok\b|"success"|working as designed|no data loss|as expected|nothing (?:was )?lost|never changes? the (?:command's )?exit code)\b/i;
const WRITE_LOST = /\b(quarantin\w*|UNKNOWN_KIND|rejected|discarded|dropped|never landed|silently swallow\w*|lost receipts?)\b/i;
const CATCH_ALL = /catch\s*\{\s*\}|catch\s*\{[^}]*\/\*[^*]*\*\/\s*\}/;

export function check(fixture) {
  const text = String(fixture?.body ?? "");

  const success = REPORTS_SUCCESS.test(text);
  const lost = WRITE_LOST.test(text);

  if (success && lost) {
    return {
      flagged: true,
      why: "an artifact that both reports success and describes a write being rejected or discarded — verify the receipt actually landed rather than trusting the exit code",
    };
  }

  // A bare empty catch around a writer is the same failure one step earlier: the error is
  // swallowed before anything can report it.
  if (CATCH_ALL.test(text) && /emit|receipt|write|spine/i.test(text)) {
    return {
      flagged: true,
      why: "a write path swallowing its own error, so success is indistinguishable from a discarded write",
    };
  }

  return { flagged: false, why: "no success-report paired with a lost write" };
}
