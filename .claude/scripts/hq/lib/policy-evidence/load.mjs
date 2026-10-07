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
import { closeSync, constants as fsConstants, existsSync, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateEvent } from "../validate.mjs";
import { eventSha } from "../canonical.mjs";
import { policyRoot, loadPolicyFromDisk, loadPolicyEvents } from "../policy/run-gate.mjs";

export { policyRoot };

export class EvidenceRootError extends Error {}

const BOM = String.fromCharCode(0xfeff);
const sameDir = (a, b) => {
  const ra = realpathSync.native(a), rb = realpathSync.native(b); // native: expands Windows 8.3 short names (RUNNER~1)
  return process.platform === "win32" ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
};

/** Do two paths name the same spine directory? Realpath when it exists (both sides), else the resolved path. */
export function sameSpine(a, b) {
  const real = (p) => { try { return realpathSync.native(p); } catch { return resolve(p); } };
  const ra = real(a), rb = real(b);
  return process.platform === "win32" ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

/** The canonical spine of the governing root -- the one the evidence reader reads. Writers compare against this. */
export const canonicalSpine = (root = policyRoot()) => join(root, ".claude", "state", "hq");

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

// O_NONBLOCK so opening a FIFO with no writer returns instead of hanging (attack r2 B1); O_NOFOLLOW so a symlinked
// day file is refused rather than read from wherever it points (attack r2 L10). Both are absent on Windows, where
// a FIFO cannot sit in a directory and the lstat below already refuses a link.
const OPEN_FLAGS = fsConstants.O_RDONLY | (fsConstants.O_NONBLOCK || 0) | (fsConstants.O_NOFOLLOW || 0);

/**
 * Read a day file safely, or return null. The path is lstat'ed first (a link, FIFO, socket or directory is not a day
 * file), then opened non-blocking without following links, then the DESCRIPTOR is checked and read -- so neither a
 * swap between check and read (attack r1 B7) nor a blocking open (r2 B1) can hang or redirect a reader. Shared by
 * the evidence reader and arc-run's writer-side day bound, so the hardening exists once (r2 B5).
 */
export function readDayFile(path) {
  try { if (!lstatSync(path).isFile()) return null; } catch { return null; }
  let fd;
  try {
    fd = openSync(path, OPEN_FLAGS);
    if (!fstatSync(fd).isFile()) return null;
    return readFileSync(fd, "utf8");
  } catch { return null; }
  finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closing a read descriptor cannot lose data */ } }
}

/** Parse, validate and seal-check one line; null when it is not a sealed, valid event. A BOM is stripped per line. */
function sealedEvent(line) {
  const l = line.startsWith(BOM) ? line.slice(1) : line;
  if (!l.trim()) return null;
  let e;
  try { e = JSON.parse(l); validateEvent(e); } catch { return null; }
  let sealed;
  try { sealed = eventSha(e); } catch { return null; }
  return typeof e.sha === "string" && e.sha === sealed ? e : null;
}

/**
 * arc-run's day bound (ADR-0509): is a CORROBORATED deny refusal for this pair already sealed in today's file? Only a
 * sealed, valid refusal whose cited gate incident precedes it, comes from the same process@version and names this
 * capability in its typed denials counts -- the fold's own rule. A forged or junk line matching three fields must not
 * suppress the genuine receipt for the rest of the day (attack r2 B3). Any read failure answers "not sealed".
 */
export function sealedRefusalToday({ eventsDir, day, actionKind, capability, process: proc }) {
  const text = readDayFile(join(eventsDir, `${day}.jsonl`));
  if (text === null) return null;
  const incidents = new Map();
  for (const line of text.split("\n")) {
    if (!line.includes("incident.raised") && !line.includes("policy.refusal")) continue;
    const e = sealedEvent(line);
    if (!e) continue;
    if (e.kind === "incident.raised" && e.payload && e.payload.source === "arc-run policy gate") { incidents.set(e.id, e); continue; }
    const p = e.payload;
    if (e.kind !== "note.logged" || !p || p.subject !== "policy.refusal" || p.decision !== "deny") continue;
    if (p.action_kind !== actionKind || p.capability !== capability || e.process !== proc) continue;
    const inc = incidents.get(p.incident_ref);
    if (inc && inc.id < e.id && inc.process === e.process && Array.isArray(inc.payload.denials) &&
        inc.payload.denials.some((d) => d && d.capability === p.capability && d.level === p.level)) return e.id;
  }
  return null;
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
    const text = readDayFile(join(eventsDir, file));
    if (text === null) { rejected++; continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const e = sealedEvent(line);
      if (!e) { rejected++; continue; }
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
