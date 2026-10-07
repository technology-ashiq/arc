// load.mjs -- the evidence fold's file side (POL-L). Everything that touches disk lives here so fold.mjs stays pure.
//
// The spine is read the way run-gate's `loadPolicyEvents` reads the policy chain, because an evidence reading is
// only as trustworthy as the lines it folds: every event passes the spine's own validator AND an `eventSha`
// recompute (shape is not integrity), and counts once by `idem`, the spine's own identity -- so a copied day-file
// cannot double a receipt and a re-sealed copy with a fresh id cannot either.
//
// The ROOT is the governing root (run-gate `policyRoot`, derived from this module's location), never a flag or an
// environment variable: a reading whose spine a caller can point elsewhere is a reading a caller can choose.
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { validateEvent } from "../validate.mjs";
import { eventSha } from "../canonical.mjs";
import { policyRoot, loadPolicyFromDisk, loadPolicyEvents } from "../policy/run-gate.mjs";

export { policyRoot };

/** Every sealed, valid event on the root's spine, in append order (day files sorted, lines in order). */
export function loadSpineEvents(root) {
  const dir = join(root, ".claude", "state", "hq", "events");
  if (!existsSync(dir)) return { events: [], rejected: 0 };
  const events = [];
  const seen = new Set();
  let rejected = 0;
  // Only the day files. `_quarantine/` is a directory and holds exactly what the spine refused.
  const files = readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  for (const file of files) {
    const path = join(dir, file);
    // A day file that is not a regular file (a FIFO blocks readFileSync forever) is skipped, not read.
    try { if (!lstatSync(path).isFile()) { rejected++; continue; } } catch { rejected++; continue; }
    let text;
    try { text = readFileSync(path, "utf8"); } catch { rejected++; continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      let e;
      try { e = JSON.parse(line); } catch { rejected++; continue; }
      try { validateEvent(e); } catch { rejected++; continue; }
      let sealed;
      try { sealed = eventSha(e); } catch { rejected++; continue; }
      if (typeof e.sha !== "string" || e.sha !== sealed) { rejected++; continue; }
      const key = typeof e.idem === "string" && e.idem ? e.idem : e.id;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push(e);
    }
  }
  return { events, rejected };
}

/**
 * Policy, the gate's own transition chain, and every sealed event, from one root. The transitions come from
 * `loadPolicyEvents` rather than a filter over `events`, because that loader also resolves every promotion to a
 * real decision -- a second filter here would be a second interpretation of which promotions count (POL-D).
 */
export function loadEvidenceInputs(root = policyRoot()) {
  const policy = loadPolicyFromDisk(root);
  if (!policy) return null;
  const transitions = loadPolicyEvents(root);
  const { events, rejected } = loadSpineEvents(root);
  return { root, policy, transitions, events, rejected };
}
