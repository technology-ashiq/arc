// spine-read.mjs — reader-only access to the spine, for leads' derivations.
//
// Reader-only is the house rule and it is load-bearing here specifically: ADR-0403 derives
// every cap and suppression count from receipts, so if anything in this lane could WRITE
// derived state, a cap would become a number someone can edit.
//
// It also FAILS CLOSED. An unreadable day file is an error, never an empty day: a fold that
// treats "I could not read it" as "there was nothing there" reports zero sends and lets the
// 21st send of the day through. That is the same class as the quarantined-receipt failure
// pre-mortem row 1 records, arriving from the read side instead of the write side.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spineRoot, eventsDir, quarantineDir } from "../../hq/lib/spine-io.mjs";

const DAY_RE = /^(\d{4}-\d{2}-\d{2})\.jsonl$/;
// The entries spine-io is KNOWN to put in events/ that are not day files: the quarantine
// directory, a day-close marker, and the write lock. Listed rather than pattern-matched loosely,
// so that adding a fourth kind of file over there is a decision somebody makes here.
const KNOWN_NON_DAY_RE = /^(_quarantine|\.lock|\d{4}-\d{2}-\d{2}\.closed)$/;

export function readAllEvents({ root = spineRoot(), allowMissing = false } = {}) {
  const dir = eventsDir(root);
  // The guard was on readFileSync and OMITTED on the adjacent directory read -- so a wrong
  // ARC_SPINE_ROOT folded to zero events silently, which is the same "I could not read it
  // therefore there was nothing there" this module's header argues against. Same class, one
  // line up. Callers that genuinely expect an empty spine (a fresh store) opt in explicitly.
  if (!existsSync(dir)) {
    if (allowMissing) return [];
    throw new Error(`spine events directory ${dir} does not exist — refusing to fold to zero events, because a cap derived from zero receipts never trips (set allowMissing for a genuinely fresh spine)`);
  }
  // THE LISTING IS PARTITIONED, NOT FILTERED. `readdirSync(dir).filter(DAY_RE.test)` DISCARDED
  // every non-match in silence -- one line away from the missing-directory guard above and the
  // unreadable-file guard below, both of which refuse. A `2026-08-04.jsonl.orig` left by a merge
  // or a restore therefore hid a real send: the line was physically on disk and the report said
  // `real: 0` at exit 0. Same class as an unreadable day, arriving through a filename.
  //
  // So: day files are read, the three entries spine-io itself creates are skipped BY NAME, and
  // anything else is an error. A file in events/ that nobody can classify is a file that may
  // hold receipts, and "I do not recognise this" must never resolve to "there was nothing there".
  const days = [];
  const unknown = [];
  for (const entry of readdirSync(dir)) {
    if (DAY_RE.test(entry)) days.push(entry);
    else if (!KNOWN_NON_DAY_RE.test(entry)) unknown.push(entry);
  }
  if (unknown.length)
    throw new Error(`spine events directory ${dir} holds ${unknown.length} entr${unknown.length === 1 ? "y" : "ies"} that ${unknown.length === 1 ? "is" : "are"} neither a day file nor a known marker (${unknown.sort().join(", ")}) — refusing to fold, because a file this reader cannot classify may hold receipts and skipping it silently is how a real send becomes a zero`);
  // AN EMPTY events/ IS THE SAME ZERO AS A MISSING ONE. The directory exists the moment anything
  // takes the write lock, so "present but holding no day file" is a genuine field state -- and it
  // returned `[]`, i.e. `real: 0` at exit 0, from a spine that had never recorded anything. A
  // caller that opted into `allowMissing` has already said an empty spine is a legitimate answer.
  if (days.length === 0 && !allowMissing)
    throw new Error(`spine events directory ${dir} holds no day file at all — refusing to fold to zero events, because "nothing was recorded here" and "no send happened" are different answers (set allowMissing for a genuinely fresh spine)`);
  days.sort();

  const out = [];
  for (const day of days) {
    const path = join(dir, day);
    let text;
    try { text = readFileSync(path, "utf8"); }
    catch (e) { throw new Error(`spine day file ${path} is unreadable (${e.code}) — refusing to fold, because an unreadable day counted as an empty one would under-report every cap`); }

    let lineNo = 0;
    for (const line of text.split("\n")) {
      lineNo++;
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); }
      catch { throw new Error(`spine day file ${path}:${lineNo} is not valid JSON — refusing to fold a partially-read day`); }
      // `42`, `null`, `"x"` and `[]` are all valid JSON and none of them is an event. They used
      // to be PUSHED, and then read as an event with no `kind` -- silently dropped from every
      // count, with none of the `path:lineNo` diagnostic the branch directly above provides. A
      // line the reader cannot interpret is the same refusal as a line it cannot parse.
      if (ev === null || typeof ev !== "object" || Array.isArray(ev))
        throw new Error(`spine day file ${path}:${lineNo} parsed as ${Array.isArray(ev) ? "an array" : ev === null ? "null" : typeof ev} rather than an event object — refusing to fold a day holding a line that is not a receipt`);
      out.push(ev);
    }
  }
  // Sort by id (ULID: lexicographic order is time order). The fold must not depend on the
  // order lines happen to sit in on disk -- that is the order-independence property the
  // Phase-00 fixture asserts, and sorting here is what makes it true rather than lucky.
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * How many day files this spine actually holds — asked BEFORE folding, by a caller that has to
 * tell "I read nothing because nothing is there" from "I read nothing".
 *
 * `state --json` folds with `allowMissing`, which is right for the question it answers ("what
 * does this install know about") and wrong for the number it printed: on a spine that does not
 * exist it published `sends: {0,0,0,0}` at exit 0, under the key its own comment calls
 * "ADR-0416's mixing guard, reported as a COUNT". One reader, two configurations, and the
 * unguarded one publishing the safety number. It now publishes counts only when it read a day.
 */
export function dayFileCount({ root = spineRoot() } = {}) {
  const dir = eventsDir(root);
  if (!existsSync(dir)) return { days: 0, why: `spine events directory ${dir} does not exist` };
  const days = readdirSync(dir).filter((f) => DAY_RE.test(f)).length;
  return { days, why: days === 0 ? `spine events directory ${dir} holds no day file` : null };
}

/**
 * The receipts the emitter REFUSED, which no fold has ever opened.
 *
 * `readAllEvents` reads `events/*.jsonl` and nothing under `.claude/scripts/leads/` has ever
 * opened `events/_quarantine/`. The emitter quarantines-and-exits-0 in hook mode, so a real send
 * whose receipt was rejected — one unknown payload key is enough — left the spine with `real: 0`
 * at exit 0. Reproduced: `SKIP BAD_LEADS ... (quarantined)`, emitter exit 0, and the report then
 * answered `{"rehearsal":5,"real":0,"total":5}` with a sixth, real, send in the quarantine file.
 *
 * That is the zero that means "I could not look", which is the one thing this reporter exists not
 * to say. It is counted, never parsed: a quarantine record is by definition an input that failed
 * validation, and interpreting it would be inventing a receipt the emitter refused to write.
 */
export function quarantineCount({ root = spineRoot() } = {}) {
  const dir = quarantineDir(root);
  if (!existsSync(dir)) return { records: 0, files: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  let records = 0;
  for (const f of files) {
    let text;
    try { text = readFileSync(join(dir, f), "utf8"); }
    catch (e) { throw new Error(`spine quarantine file ${join(dir, f)} is unreadable (${e.code}) — refusing to fold, because an uncountable quarantine is the same blind spot as an unread one`); }
    for (const line of text.split("\n")) if (line.trim()) records++;
  }
  return { records, files };
}
