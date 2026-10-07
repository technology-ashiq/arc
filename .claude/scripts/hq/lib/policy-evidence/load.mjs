// load.mjs -- the evidence fold's file side (POL-L). Everything that touches disk lives here so fold.mjs stays pure.
//
// The spine is read the way run-gate's `loadPolicyEvents` reads the policy chain, because an evidence reading is
// only as trustworthy as the lines it folds: every event passes the spine's own validator AND an `eventSha`
// recompute (shape is not integrity), and counts once by `idem`, the spine's own identity -- so a copied day-file
// cannot double a receipt and a re-sealed copy with a fresh id cannot either.
//
// The ROOT is the governing root (run-gate `policyRoot`, derived from this module's location), never a flag. And it
// is CHECKED before anything is read (attack r1 L1/B1/B2): a linked worktree's gitignored spine is a real, valid,
// unreachable copy -- Cycle 9's own close emitted into one -- so reading it answers "17 BELOW-BAR, 0 refusals"
// confidently and wrongly. The same refusal covers a missing spine and a writer pointed elsewhere.
import { closeSync, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { validateEvent } from "../validate.mjs";
import { eventSha } from "../canonical.mjs";
import { policyRoot, loadPolicyFromDisk, loadPolicyEvents } from "../policy/run-gate.mjs";

export { policyRoot };

export class EvidenceRootError extends Error {}

const BOM = String.fromCharCode(0xfeff);
const sameDir = (a, b) => {
  const ra = realpathSync(a), rb = realpathSync(b);
  return process.platform === "win32" ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
};

/**
 * Is this root's spine the canonical one? Refuses, by name:
 *   - a LINKED WORKTREE (`.git` is a file): its spine is gitignored and private to that checkout;
 *   - a root with no spine directory at all: no evidence is not the same as evidence of nothing;
 *   - an `ARC_SPINE_ROOT` naming a different spine than this root's: the writer (arc-event honours it) and this
 *     reader would disagree silently, and refusals would land where nothing reads them.
 */
export function assertCanonicalSpine(root) {
  const git = join(root, ".git");
  let st = null;
  try { st = lstatSync(git); } catch { /* no .git: a sandbox or an exported tree, judged by its spine below */ }
  if (st && st.isFile())
    throw new EvidenceRootError(`${root} is a linked git worktree -- its spine is private to this checkout and is not the canonical one; run from the main clone`);
  const spine = join(root, ".claude", "state", "hq");
  const events = join(spine, "events");
  if (!existsSync(events))
    throw new EvidenceRootError(`no spine at ${events} -- an absent spine is not evidence of nothing`);
  if ("ARC_SPINE_ROOT" in process.env) {
    const named = process.env.ARC_SPINE_ROOT;
    if (!named || !existsSync(named) || !sameDir(named, spine))
      throw new EvidenceRootError(`ARC_SPINE_ROOT (${named || "empty"}) is not this root's spine (${spine}) -- the writer and this reader would disagree`);
  }
  return events;
}

/** Read a day file through ONE descriptor: the type check and the read cannot be split by a swap (attack r1 B7). */
function readDayFile(path) {
  let fd;
  try {
    fd = openSync(path, "r");
    if (!fstatSync(fd).isFile()) return null;
    return readFileSync(fd, "utf8");
  } catch { return null; }
  finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closing a read descriptor cannot lose data */ } }
}

/** Every sealed, valid event in an events directory, in append order (day files sorted, lines in order). */
export function loadSpineEvents(eventsDir) {
  if (!existsSync(eventsDir)) return { events: [], rejected: 0, dayFiles: 0 };
  const events = [];
  const seen = new Set();
  let rejected = 0;
  // Only the day files. `_quarantine/` is a directory and holds exactly what the spine refused.
  const files = readdirSync(eventsDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).sort();
  for (const file of files) {
    let text = readDayFile(join(eventsDir, file));
    if (text === null) { rejected++; continue; }
    if (text.startsWith(BOM)) text = text.slice(1);
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
  return { events, rejected, dayFiles: files.length };
}

/**
 * Policy, the gate's own transition chain, and every sealed event, from one CHECKED root. The transitions come from
 * `loadPolicyEvents` rather than a filter over `events`, because that loader also resolves every promotion to a real
 * decision -- a second filter here would be a second interpretation of which promotions count (POL-D).
 */
export function loadEvidenceInputs(root = policyRoot()) {
  const policy = loadPolicyFromDisk(root);
  if (!policy) return null;
  const eventsDir = assertCanonicalSpine(root);
  const transitions = loadPolicyEvents(root);
  const { events, rejected, dayFiles } = loadSpineEvents(eventsDir);
  return { root, eventsDir, policy, transitions, events, rejected, dayFiles };
}
