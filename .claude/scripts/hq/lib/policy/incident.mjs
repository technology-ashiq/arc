/**
 * Turning a denial into an authority loss (REQ-03 / ADR-0505, phases 01 and 02).
 *
 * `buildDemotion` decided what a demotion IS from the moment Phase 0 shipped, and had no caller.
 * The reducer folded `policy.demoted` events nobody wrote; `arc-run` carried a comment claiming
 * the cap dropped mid-run, which it never did. This module is the missing half: it writes the
 * two receipts, in order, through the ONE writer.
 *
 * WHEN IT FIRES, AND WHY THAT LINE AND NOT ANOTHER.
 *
 * Only on a `deny` for a pair whose level would otherwise have said EXECUTE. Each half of that
 * is load-bearing, and the second half is narrower than the obvious reading:
 *
 *   - Never on `propose`. L1 is where every pair is BORN, and a propose is the system working
 *     exactly as designed: prepare and record, never perform. Demoting on it would walk the
 *     entire policy to L0 within a handful of ordinary tool calls -- an enforcement engine that
 *     disables the session it is protecting.
 *   - Never at effective L0. There, the deny IS the level: the pair holds nothing, so there is
 *     nothing to take, and `buildDemotion` returns null anyway. Emitting an incident per routine
 *     deny-by-default would also bury the spine in receipts for a system behaving correctly --
 *     every `publish` attempt in a session where publish is L0.
 *   - AND NEVER AT L1 EITHER, even though a deny CAN land there. The integrity checks -- the
 *     un-grantable resource list above all -- are hoisted out of the L2 branch and refuse at any
 *     level, so `session:interactive/write` sitting at its L1 birth cap still gets a hard deny
 *     for touching `.claude/settings.json`. Reading that as an overreach would be wrong twice
 *     over: the pair never held authority to perform that write at all, so the deny is the grant
 *     working rather than evidence of reaching past it; and since every pair is born at L1, it
 *     would make the FIRST such attempt in any fresh repo cost the session its ability even to
 *     propose. `decisionForLevel` is the test, not a rank comparison, because the question is
 *     exactly "would this level have executed" and that is the function that answers it (POL-D:
 *     no second interpretation).
 *
 * What remains is the case worth a receipt: a pair that HOLDS execute authority and reached past
 * what that authority covers -- a path outside the declared write roots, an argv0 outside the
 * allowlist, a domain that is not on the list, `spend` above its hard ceiling, an un-grantable
 * resource reached while genuinely at L2. Holding a grant and overreaching is a different act
 * from not holding one, and only the first is evidence about trust.
 *
 * BEST EFFORT, NEVER LOAD-BEARING. The caller has already decided to deny before it calls this.
 * A receipt that cannot be written is REPORTED and never swallowed, but it does not un-deny the
 * action and it must never turn a deny into an allow -- quarantine is not enforcement success
 * (ADR-0106/0032), and neither is a failed emit. Every failure path here returns a reason
 * string; none of them throw into a caller that is mid-denial.
 *
 * THE ORDER IS THE CITATION. `incident.raised` first, because a demotion must cite the incident
 * that caused it (`buildDemotion` refuses without one) -- that citation is what stops the
 * machine-derived kind from becoming a cheap path to an authority change with nothing to point
 * at. No incident id, no demotion.
 */

import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { decisionForLevel } from "./model.mjs";
import { buildDemotion } from "./promotion.mjs";

/**
 * A hook runs inside a human's blocking tool call. Ten seconds of a contended spine lock is a
 * frozen session, so this budget is deliberately tighter than `arc-run`'s -- the headless runner
 * can afford to wait for a receipt and an interactive surface cannot. Exceeding it loses the
 * receipt, loudly, and still denies.
 */
const EMIT_TIMEOUT_MS = 5000;

/** ULIDs only. A non-ULID on stdout means the emitter reported something other than an id. */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function emit(root, kind, payload, extra = []) {
  // stderr is CAPTURED, not inherited. A missing or broken emitter otherwise writes a raw shell
  // error straight past this module and the caller reports nothing at all -- two half-messages
  // where the operator needs one that says the ledger did not record the overreach.
  const out = execFileSync("bash", [
    join(root, ".claude/scripts/hq/arc-event.sh"), "emit", kind,
    "--payload", JSON.stringify(payload), "--strict", ...extra,
  ], { encoding: "utf8", cwd: root, timeout: EMIT_TIMEOUT_MS, killSignal: "SIGKILL",
       stdio: ["ignore", "pipe", "pipe"] });
  const id = String(out).trim().split("\n").pop().trim();
  if (!ULID.test(id)) throw new Error(`the emitter returned no event id (${id.slice(0, 60)})`);
  return id;
}

/**
 * Record a denial that cost a level, and return what happened.
 *
 * Returns `{ demoted: false, reason }` when nothing was taken. `skipped: true` marks the ONE
 * quiet case -- the level would not have executed, so this was never an overreach and there is
 * nothing for an operator to hear about. Every other failure is loud by contract: "there was
 * nothing left to take" and "the ledger could not record this" must never read alike, and a
 * caller that prints only on success turns a broken emitter into silence.
 */
export function recordOverreach({ kind, capability, effective, what, root }, { policy, events }) {
  if (decisionForLevel(effective) !== "execute")
    return { demoted: false, skipped: true, reason:
      `${effective} would not have executed this anyway -- the deny is the grant working, not an overreach` };

  let incidentId;
  try {
    incidentId = emit(root, "incident.raised", {
      what, severity: "high", source: `policy ${kind}/${capability}`,
    });
  } catch (e) {
    return { demoted: false, reason: `could not raise the incident: ${String(e.message).split("\n")[0]}` };
  }

  let payload;
  try {
    payload = buildDemotion({ kind, capability, incidentId }, { policy, events });
  } catch (e) {
    return { demoted: false, incidentId, reason: `the demotion could not be built: ${String(e.message).split("\n")[0]}` };
  }
  // Already at the floor by the library's own reckoning. The incident still stands on its own.
  if (!payload) return { demoted: false, incidentId, reason: "nothing left to take" };

  try {
    const demotionId = emit(root, "policy.demoted", payload);
    return { demoted: true, incidentId, demotionId, from: payload.from_level, to: payload.to_level };
  } catch (e) {
    return { demoted: false, incidentId, reason: `the demotion could not be sealed: ${String(e.message).split("\n")[0]}` };
  }
}
