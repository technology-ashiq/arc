/**
 * Candidate L-004 — "a success claim whose evidence cannot observe the thing it claims".
 *
 * This replaces L-002, which an unanchored evaluator rejected. Its critique is the design
 * brief for this one, so it is worth stating what was wrong rather than quietly rewriting:
 *
 *   - L-002 matched two BAGS OF WORDS against a whole document, with nothing requiring the
 *     success claim and the lost write to be about the same operation. "We dropped the legacy
 *     column. Full suite ok, exit 0." flagged.
 *   - It keyed on one incident's vocabulary — `UNKNOWN_KIND`, `no data loss`, and an optional
 *     possessive in `never changes? the (?:command's )? exit code`, which is what covering two
 *     remembered sentences looks like rather than a failure class.
 *   - One alternative could never fire: `"success"` inside `\b(...)\b` requires a word
 *     character immediately before the quote.
 *   - A second branch flagged on an empty catch with NO success claim at all, contradicting
 *     the predicate the candidate's own message asserted.
 *
 * This version keys on the RELATION, which is the thing that makes the failure a failure:
 * **a claim of success whose stated evidence is incapable of observing the operation being
 * claimed.** An exit code cannot see whether a write landed. A count of items accepted cannot
 * see whether they persisted. That mismatch is the defect; the vocabulary is incidental.
 *
 * A correctly-handled rejection reported accurately ("malformed record rejected as designed,
 * exit 0, no data lost") is NOT this failure, because nothing is claimed that the evidence
 * cannot support. Those cases are pinned as clean controls F-106 and F-107.
 */

/** Evidence that cannot observe a write: process-level signals and caller-side counts. */
const BLIND_EVIDENCE =
  /\b(exit(?:ed|s)?\s+(?:code\s+)?0|exit code 0|returned\s+0|process exited|the (?:command|script|run)\s+(?:still\s+)?(?:exited|returns?|reported))\b/i;

/** A claim about the WRITE having happened — the thing the evidence above cannot see. */
const WRITE_CLAIM =
  /\b(receipts?|records?|events?|rows?|writes?|messages?)\b[^.\n]{0,60}?\b(landed|persisted|written|saved|stored|recorded|delivered|accepted)\b|\b(landed|persisted|written|saved|stored|recorded)\b[^.\n]{0,40}?\b(receipts?|records?|events?|rows?)\b/i;

/** Direct evidence that the write did NOT happen. */
const WRITE_FAILED =
  /\b(quarantin\w+|rejected|discarded|dropped|never landed|not persisted|lost|silently swallow\w+)\b/i;

/** The write path swallowing its own error, so no report can ever be wrong. */
const SWALLOWED = /catch\s*\(?[^)]*\)?\s*\{\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)?\s*\}/;

/** Language that says the rejection was CORRECT — a handled case, not a lost write. */
const BY_DESIGN = /\b(as designed|by design|as intended|expected(?:ly)?|correctly|deliberate\w*|on purpose)\b/i;

/** Split into sentences so a claim and its evidence must actually sit together. */
const sentences = (t) => t.split(/(?<=[.!?])\s+|\n{2,}/).filter((s) => s.trim());

export function check(fixture) {
  const text = String(fixture?.body ?? "");

  for (const s of sentences(text)) {
    // A rejection described as correct is a handled case. It is the true negative this check
    // exists to survive, and skipping it here is why F-106 and F-107 stay clean.
    if (BY_DESIGN.test(s)) continue;

    const blind = BLIND_EVIDENCE.test(s);
    const failed = WRITE_FAILED.test(s);
    const claim = WRITE_CLAIM.test(s);

    // The relation: within ONE sentence, a process-level signal offered as evidence about a
    // write, while that same sentence says the write did not happen.
    if (blind && failed) {
      return {
        flagged: true,
        why: "a success signal that cannot observe a write is offered in the same breath as the write failing — verify the record landed, do not read the exit code",
      };
    }
    // Or: a claim that records landed, resting only on a process-level signal.
    if (blind && claim && !failed) {
      return {
        flagged: true,
        why: "a claim that records landed, evidenced by an exit code that cannot see whether they did",
      };
    }
  }

  // An error swallowed on the write path is the same defect one step earlier: no report can
  // ever be wrong, because nothing can ever report.
  if (SWALLOWED.test(text) && /\b(emit|receipt|spine|persist|writeFile|insert)\b/i.test(text)) {
    return {
      flagged: true,
      why: "a write path swallowing its own error, so a success report is unfalsifiable rather than true",
    };
  }

  return { flagged: false, why: "no success claim resting on evidence that cannot observe the write" };
}
