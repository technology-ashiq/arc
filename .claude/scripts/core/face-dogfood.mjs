#!/usr/bin/env node
// face-dogfood -- REQ-10's evidence, computed instead of claimed.
//
// The requirement is not "the owner used the face". It is: for five real days, EVERY decision
// he made went THROUGH the face -- and that is provable, because both sides leave a record.
// L2's request journal writes a line for each POST /api/decide it served, carrying the ULID
// of the receipt it emitted; the spine holds every `decision.recorded` there has ever been.
// Matching them is arithmetic, and arithmetic is what this file does.
//
// THE INTERESTING NUMBER IS NOT "matched". It is the two ways the sets can differ:
//
//   spine-only  a decision.recorded with no journal line -> a decision made OUTSIDE the face.
//               This is REQ-10's actual failure mode, and the only one that can fail the
//               dogfood. A day with one of these is a day the owner went round the product.
//   journal-only  a journal line claiming a receipt the spine does not have -> the face said
//               it wrote something that is not there. Rarer and worse: the product lied.
//
// A run with zero of both, across five distinct days, is the requirement met. Anything else
// is reported with the ids, because "roughly matched" is not a claim this lane accepts.
//
//   face-dogfood.mjs [repo-root] [--journal DIR] [--spine DIR] [--days N] [--day YYYY-MM-DD ...] [--json]
//
// `--day` (repeatable) narrows the verdict to the named days and turns on the op clause: each
// named day needs a face decision and a face op whose receipt the spine holds.
//   face-dogfood.mjs --selftest
//
// Exit: 0 requirement met | 1 not met (named) | 2 could not read the inputs.
//
// Runs from the MAIN CLONE for a live check: spineRoot() refuses a linked worktree by design,
// so a worktree run must name its inputs with --spine/--journal. That is not a limitation to
// work around; a worktree has no canonical spine and an answer derived from one would be
// about nothing.

import { readFileSync, existsSync, readdirSync, realpathSync, writeSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** "Was this file RUN, or imported?" -- realpath BOTH sides. The endsWith form no-ops behind a rename. */
function isMainModule() {
  try {
    const invoked = process.argv[1];
    if (!invoked) return false;
    return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_DEFAULT = join(HERE, "..", "..", "..");
const REQUIRED_DAYS = 5;
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// ---------- readers (pure enough to test: they take a directory, not a repo) ----------

/**
 * Every decision the FACE says it made, from L2's request journal.
 *
 * A journal line is EVIDENCE, never truth (the door's own comment says so, and a failed
 * journal write is reported rather than fatal). So a missing line is not proof a decision
 * did not happen -- it is proof this file cannot see it, which is why `spineOnly` below is
 * reported as a finding rather than silently treated as "not through the face".
 *
 * @param {string} dir
 * @returns {{ days: string[], entries: { day: string, ts: string, decision: string, decides: string }[], ops: { day: string, op: string, receipt: string }[], lines: number, torn: number }}
 */
export function readJournal(dir) {
  if (!existsSync(dir)) return { days: [], entries: [], ops: [], lines: 0, torn: 0 };
  const entries = [];
  const ops = [];
  const days = [];
  let lines = 0;
  let torn = 0;
  for (const f of readdirSync(dir).filter((n) => /^journal-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
    const day = f.slice("journal-".length, -".jsonl".length);
    days.push(day);
    const parsed = parseJournalText(day, readFileSync(join(dir, f), "utf8"));
    entries.push(...parsed.entries);
    ops.push(...parsed.ops);
    lines += parsed.lines;
    torn += parsed.torn;
  }
  return { days, entries, ops, lines, torn };
}

/**
 * One journal day's text -> its decisions and ops. Pure, so the selftest drives it with a string
 * and writes no file: a write in this file would make plan-bound-audit list it as a writer.
 * @param {string} day @param {string} text
 */
export function parseJournalText(day, text) {
  const entries = [];
  const ops = [];
  let lines = 0;
  let torn = 0;
  {
    for (const raw of text.split("\n")) {
      if (!raw.trim()) continue;
      lines++;
      let e;
      // A torn line is COUNTED, not skipped in silence. A journal that lost half its lines
      // and a journal that recorded nothing look identical unless someone says so.
      try { e = JSON.parse(raw); } catch { torn++; continue; }
      // `null`, a number or an array parses fine and is not a line the door writes.
      if (e === null || typeof e !== "object" || Array.isArray(e)) { torn++; continue; }
      // A work-door APPLY that landed: the op clause's evidence. A plan, a refusal or a failed
      // apply wrote nothing, so it is not an op that ran. The receipt must be a ULID: it is
      // printed into evidence files, and free text there could forge a verdict line.
      if (e.work === true && e.phase === "apply" && e.ok === true) {
        if (typeof e.receipt === "string" && ULID.test(e.receipt)) ops.push({ day, op: String(e.op ?? ""), receipt: e.receipt });
        else torn++;
        continue;
      }
      if (e.path !== "/api/decide" || e.status !== 200) continue;
      if (typeof e.decision !== "string" || typeof e.decides !== "string") { torn++; continue; }
      entries.push({ day, ts: String(e.ts ?? ""), decision: e.decision, decides: e.decides });
    }
  }
  return { entries, ops, lines, torn };
}

/**
 * Every decision the SPINE holds, through THE reader (ADR-0030).
 *
 * The first cut of this parsed the day files itself, justified by "spine.mjs refuses a linked
 * worktree". That reason does not survive being checked: it is `spineRoot()`, the RESOLVER,
 * that refuses a worktree -- `readAll(root)` takes the root explicitly, which is exactly how
 * arc-dash drives a sim spine. Avoiding the resolver never required avoiding the reader.
 *
 * The difference is not tidiness. `readAll` serves the sqlite index when one exists and falls
 * back to the scan, so a hand-rolled day-file walk would read a DIFFERENT set from everything
 * else on a tree carrying `state.db` -- and would count torn lines by its own rule. A dogfood
 * verdict that disagrees with the spine's own health reader about what the spine contains is
 * evidence nobody can use.
 *
 * @param {string} root  the spine root
 * @returns {Promise<{ days: string[], receipts: { day: string, id: string, decides: string }[], ids: Map<string, { kind: string, process: string, day: string }>, torn: number }>}
 */
export async function readSpineDecisions(root) {
  if (!existsSync(join(root, "events"))) return { days: [], receipts: [], ids: new Map(), torn: 0 };
  const { readAll } = await import(pathToFileURL(join(REPO_DEFAULT, ".claude", "scripts", "hq", "spine.mjs")).href);
  const { events, torn } = await readAll(root);
  const receipts = [];
  const days = new Set();
  // Every id, so an op's journalled receipt is checked against the spine -- the same "the face
  // claims, the spine proves" rule the decisions follow.
  /** @type {Map<string, { kind: string, process: string, day: string }>} */
  const ids = new Map();
  // The envelope is { event, day, seq, line } -- the EVENT is one level in. Reading `e.kind`
  // off the envelope is not a crash, it is `undefined`, so every kind test quietly answers no
  // and the report comes back well-formed and wrong. That exact mistake shipped in the door's
  // /api/rooms handler and was caught only by a count that could not have been true.
  for (const { event, day } of events) {
    days.add(day);
    if (event?.id) ids.set(String(event.id), { kind: String(event.kind ?? ""), process: String(event.process ?? ""), day });
    if (event?.kind !== "decision.recorded") continue;
    receipts.push({ day, id: String(event.id ?? ""), decides: String(event.payload?.decides ?? "") });
  }
  return { days: [...days].sort(), receipts, ids, torn: torn.length };
}

// ---------- the match (pure: two record sets -> a verdict) ----------

/**
 * @typedef {object} DogfoodVerdict
 * @property {boolean} met
 * @property {number} daysWithFaceDecisions
 * @property {number} requiredDays
 * @property {string[] | null} window          the named days, or null for all history
 * @property {Record<string, number> | null} opsByDay  spine-proven face ops per named day
 * @property {number} outsideAllHistory      outside-face decisions across ALL history, window or not
 * @property {string[]} days                the days that carried at least one face decision
 * @property {number} matched
 * @property {{ id: string, day: string, decides: string }[]} spineOnly
 * @property {{ decision: string, day: string, decides: string }[]} journalOnly
 * @property {number} journalTorn
 * @property {number} spineTorn
 * @property {string[]} reasons              why it is not met, named. Empty when it is.
 * @property {string} headline
 */

/**
 * Match what the face claims against what the spine holds.
 *
 * @param {ReturnType<typeof readJournal>} journal
 * @param {ReturnType<typeof readSpineDecisions>} spine
 * @param {{ requiredDays?: number, window?: string[], receiptOf?: (op: string) => ({ kind: string, process?: string } | null) }} [opts]
 * @returns {DogfoodVerdict}
 */
export function dogfoodVerdict(journal, spine, opts = {}) {
  const requiredDays = opts.requiredDays ?? REQUIRED_DAYS;
  // A window narrows the question to the days being claimed. Without one, every day either
  // side has ever seen counts -- which is the honest default, because a dogfood you have to
  // pick the window for is a dogfood you can pick the window to pass.
  //
  // So a NAMED window pays for itself (Phase 08 amendment, 2026-10-14): every named day must
  // carry a face decision AND a face op whose receipt the spine holds -- a named day that
  // decided nothing is a reason, not a quiet zero -- and the outside-face count across ALL
  // history is still reported beside the windowed one, so the window narrows the verdict
  // without hiding what lies outside it.
  const window = opts.window ? [...new Set(opts.window)].sort() : null;
  const inWindow = (day) => !window || window.includes(day);

  const spineById = new Map();
  for (const r of spine.receipts) if (inWindow(r.day)) spineById.set(r.id, r);
  const journalById = new Map();
  for (const e of journal.entries) if (inWindow(e.day)) journalById.set(e.decision, e);

  const matched = [...journalById.keys()].filter((id) => spineById.has(id));
  const journalOnly = [...journalById.values()].filter((e) => !spineById.has(e.decision));
  const spineOnly = [...spineById.values()].filter((r) => !journalById.has(r.id));

  // The days that COUNT are the days a decision went through the face. A day the owner opened
  // the face and decided nothing is not a dogfood day; the requirement is about deciding.
  const days = [...new Set(matched.map((id) => journalById.get(id).day))].sort();

  // Outside the face across all history, whatever the window: context, never a reason.
  const journalAll = new Set(journal.entries.map((e) => e.decision));
  const outsideAllHistory = spine.receipts.filter((r) => !journalAll.has(r.id)).length;

  // The op clause, only under a named window (the five-day default never asked for it).
  // An op counts when the journal says the apply landed AND the spine holds its receipt.
  const opsByDay = {};
  const opsUnproven = [];
  const opsDuplicate = [];
  if (window) {
    for (const d of window) opsByDay[d] = 0;
    // IDENTITY, not membership: the receipt must be an event on the SAME day, of the kind (and
    // process, where the row names one) that the op's own registry row says it writes, and each
    // receipt proves one op once. "Any id the spine holds" let a decision pass as an op, and
    // "any non-decision id" let any note that day pass (attack r1 B1, r2 L1/B2). No registry
    // given, no op proven: the clause fails closed rather than open.
    const receiptOf = typeof opts.receiptOf === "function" ? opts.receiptOf : () => null;
    const used = new Set();
    for (const o of journal.ops ?? []) {
      if (!inWindow(o.day)) continue;
      if (used.has(o.receipt)) { opsDuplicate.push(o); continue; }
      const ev = spine.ids instanceof Map ? spine.ids.get(o.receipt) : undefined;
      const want = receiptOf(o.op);
      if (ev && want && ev.day === o.day && ev.kind === want.kind && (!want.process || ev.process === want.process)) {
        used.add(o.receipt);
        opsByDay[o.day]++;
      } else opsUnproven.push(o);
    }
  }

  const reasons = [];
  if (window) {
    const noDecision = window.filter((d) => !days.includes(d));
    if (noDecision.length)
      reasons.push(`named day(s) with no decision through the face: ${noDecision.join(", ")} -- a named day that decided nothing is not a dogfood day`);
    const noOp = window.filter((d) => !opsByDay[d]);
    if (noOp.length)
      reasons.push(`named day(s) with no face op whose receipt is on the spine: ${noOp.join(", ")}`);
    if (opsUnproven.length)
      reasons.push(`${opsUnproven.length} op journal line(s) claim a receipt the spine does not hold as that op's own receipt that day -- the face said it wrote something that is not there: ${opsUnproven.slice(0, 5).map((o) => `${o.receipt} (${o.day})`).join(", ")}${opsUnproven.length > 5 ? ", …" : ""}`);
    if (opsDuplicate.length)
      reasons.push(`${opsDuplicate.length} op journal line(s) repeat a receipt already counted -- the door journals one line per apply: ${opsDuplicate.slice(0, 5).map((o) => `${o.receipt} (${o.day})`).join(", ")}${opsDuplicate.length > 5 ? ", …" : ""}`);
  }
  if (spineOnly.length)
    reasons.push(`${spineOnly.length} decision(s) were recorded on the spine with no journal line -- decided OUTSIDE the face, which is exactly what REQ-10 asks not to happen: ${spineOnly.slice(0, 5).map((r) => `${r.id} (${r.day})`).join(", ")}${spineOnly.length > 5 ? ", …" : ""}`);
  if (journalOnly.length)
    reasons.push(`${journalOnly.length} journal line(s) claim a receipt the spine does not hold -- the face said it wrote something that is not there: ${journalOnly.slice(0, 5).map((e) => `${e.decision} (${e.day})`).join(", ")}${journalOnly.length > 5 ? ", …" : ""}`);
  if (days.length < requiredDays)
    reasons.push(`${days.length} of ${requiredDays} days carried a decision through the face`);
  if (journal.torn)
    reasons.push(`${journal.torn} journal line(s) could not be read, so this count is a floor and not a total`);
  // THE SPINE TWIN. A torn journal line was a reason and a torn SPINE line was only a footnote
  // printed after `met` had already been decided -- so a run with five clean days and one
  // unreadable spine line said "REQ-10 MET: every one of them on the spine", exit 0.
  //
  // That line may be the `decision.recorded` made OUTSIDE the face, which is the single failure
  // REQ-10 exists to detect: it cannot be matched against a journal entry precisely because it
  // cannot be read. Twin-fix shape, and the selftest carried an arm for the journal half and
  // none for this one -- so the missing half was invisible in the code AND in its control.
  if (spine.torn)
    reasons.push(`${spine.torn} spine line(s) could not be read, so "every decision is accounted for" cannot be claimed -- an unreadable line may be the one made outside the face`);

  const met = reasons.length === 0;
  const headline = met
    ? `REQ-10 MET: ${matched.length} decision(s) across ${days.length} days, every one of them through the face and every one of them on the spine.`
    : `REQ-10 NOT MET: ${matched.length} matched, ${spineOnly.length} decided outside the face, ${journalOnly.length} claimed but absent, ${days.length} of ${requiredDays} days.`;

  return {
    met,
    daysWithFaceDecisions: days.length,
    requiredDays,
    window,
    opsByDay: window ? opsByDay : null,
    outsideAllHistory,
    days,
    matched: matched.length,
    spineOnly,
    journalOnly,
    journalTorn: journal.torn,
    spineTorn: spine.torn,
    reasons,
    headline,
  };
}

// ---------- CLI ----------

async function run(repo, flags) {
  // DERIVED the way the door derives it, not guessed.
  //
  // This read `.claude/state/hq/dash-journal`, a path the door has never written to. arc-dash
  // uses `ARC_DASH_JOURNAL_DIR || join(dirname(spineRoot), "face")`, and spineRoot() is
  // `<repo>/.claude/state/hq` -- so the journal lives at `<repo>/.claude/state/face`. The tool
  // that settles REQ-10 could not find its own input, and would have failed closed with "no
  // journal directory" on the owner's real tree: honest, and useless.
  //
  // I invented the path instead of reading the file that defines it. Two layers of this lane's
  // own rules say not to (verify a path against its defining file; derive, do not copy), and a
  // cross-layer pin in tests/face/dash-doors.mjs now reads arc-dash's source so the two cannot
  // drift apart again in silence.
  const spineRoot = flags.spine ?? join(repo, ".claude", "state", "hq");
  const journalDir = flags.journal
    ?? process.env.ARC_DASH_JOURNAL_DIR
    ?? join(dirname(spineRoot), "face");

  // FAIL CLOSED on inputs that are not there, BEFORE reading either of them. "0 decisions,
  // requirement not met" and "I could not find the journal" are different facts and the second
  // must not wear the first's clothes -- a dogfood reporting "not met" because it read the
  // wrong directory would send someone looking for a behaviour problem that does not exist.
  //
  // The order used to be the other way round, with both reads above these guards. It happened
  // to be harmless because each reader returns empty for a missing input, which is exactly the
  // kind of "harmless" that stops being harmless the first time a reader throws instead.
  if (!existsSync(journalDir)) {
    process.stderr.write(`face-dogfood: ERROR -- no journal directory at ${journalDir}. That is a fact about this READ, not about the owner's days.\n`);
    return 2;
  }
  if (!existsSync(join(spineRoot, "events"))) {
    process.stderr.write(`face-dogfood: ERROR -- no spine events/ under ${spineRoot}. From a linked worktree there is no canonical spine; name one with --spine.\n`);
    return 2;
  }

  const journal = readJournal(journalDir);
  const spine = await readSpineDecisions(spineRoot);

  // The op clause reads each op's receipt kind from the SAME registry the door applies from.
  let receiptOf;
  if (flags.window) {
    const { opById } = await import(pathToFileURL(join(REPO_DEFAULT, ".claude", "scripts", "hq", "face-ops.mjs")).href);
    receiptOf = (opId) => { const row = opById(opId); return row && row.receipt ? row.receipt : null; };
  }
  const v = dogfoodVerdict(journal, spine, { requiredDays: flags.days ?? REQUIRED_DAYS, window: flags.window, receiptOf });
  if (flags.json) {
    process.stdout.write(JSON.stringify(v, null, 2) + "\n");
    return v.met ? 0 : 1;
  }
  process.stdout.write(`${v.headline}\n`);
  if (v.window) {
    process.stdout.write(`  named days: ${v.window.join(", ")}\n`);
    process.stdout.write(`  face ops on the spine per named day: ${v.window.map((d) => `${d}=${v.opsByDay[d]}`).join(", ")}\n`);
    process.stdout.write(`  all history, not just these days: ${v.outsideAllHistory} decision(s) made outside the face\n`);
  }
  if (v.days.length) process.stdout.write(`  days through the face: ${v.days.join(", ")}\n`);
  for (const r of v.reasons) process.stdout.write(`  - ${r}\n`);
  if (v.spineTorn) process.stdout.write(`  note: ${v.spineTorn} spine line(s) unreadable; the spine's own health reader owns that number\n`);
  return v.met ? 0 : 1;
}

// ---------- the negative control ----------
function selftest() {
  const lines = [];
  let ok = true;
  const armed = (label, cond, detail = "") => {
    if (!cond) ok = false;
    lines.push(`${label.padEnd(52)} ${cond ? "PASS" : `FAIL ${detail}`}`);
  };

  const mkJournal = (entries) => ({ days: [...new Set(entries.map((e) => e.day))], entries, lines: entries.length, torn: 0 });
  const mkSpine = (receipts) => ({ days: [...new Set(receipts.map((r) => r.day))], receipts, torn: 0 });
  const day = (n) => `2026-08-${String(10 + n).padStart(2, "0")}`;
  const id = (n) => `01M0Q01KDCARYDDD0B6XSA0G${String(n).padStart(2, "0")}`;

  // Five clean days, one decision each, both sides agreeing.
  const clean = Array.from({ length: 5 }, (_, i) => ({ day: day(i), ts: "", decision: id(i), decides: `A${i}` }));
  const cleanSpine = clean.map((e) => ({ day: e.day, id: e.decision, decides: e.decides }));
  const good = dogfoodVerdict(mkJournal(clean), mkSpine(cleanSpine));
  armed("five clean days meet the requirement", good.met === true, JSON.stringify(good.reasons));
  armed("and it says how many days, not just yes", good.daysWithFaceDecisions === 5);

  // THE ARM THAT MATTERS. A decision made outside the face is the failure REQ-10 is about,
  // and it must fail even though every OTHER number still looks healthy.
  const outside = dogfoodVerdict(
    mkJournal(clean),
    mkSpine([...cleanSpine, { day: day(2), id: id(99), decides: "A99" }]),
  );
  armed("a decision made OUTSIDE the face fails the requirement", outside.met === false);
  armed("and it names the receipt, not just a count", outside.spineOnly.some((r) => r.id === id(99)));
  armed("and it says WHY in the reason, not only in a field",
    outside.reasons.some((r) => /outside the face/i.test(r)));

  // The rarer, worse case: the face claims a receipt the spine does not hold.
  const lied = dogfoodVerdict(
    mkJournal([...clean, { day: day(3), ts: "", decision: id(98), decides: "A98" }]),
    mkSpine(cleanSpine),
  );
  armed("a journal line with no receipt fails the requirement", lied.met === false);
  armed("and it is reported as the face claiming something absent",
    lied.reasons.some((r) => /is not there|does not hold/i.test(r)));

  // Four days is four days.
  const four = dogfoodVerdict(mkJournal(clean.slice(0, 4)), mkSpine(cleanSpine.slice(0, 4)));
  armed("four days does not pass as five", four.met === false && four.daysWithFaceDecisions === 4);

  // Several decisions on ONE day are one day. The requirement is five DAYS, and a burst is
  // the obvious way to fake it.
  const burst = Array.from({ length: 9 }, (_, i) => ({ day: day(0), ts: "", decision: id(i), decides: `A${i}` }));
  const burstV = dogfoodVerdict(mkJournal(burst), mkSpine(burst.map((e) => ({ day: e.day, id: e.decision, decides: e.decides }))));
  armed("nine decisions in one day is still one day", burstV.met === false && burstV.daysWithFaceDecisions === 1);

  // Empty is not met, and does not throw.
  const empty = dogfoodVerdict(mkJournal([]), mkSpine([]));
  armed("an empty journal is NOT met, and does not throw", empty.met === false && empty.matched === 0);

  // A torn journal line makes the count a floor, and the verdict says so rather than
  // reporting a total it cannot support.
  const tornV = dogfoodVerdict({ ...mkJournal(clean), torn: 3 }, mkSpine(cleanSpine));
  armed("a torn journal line makes the count a floor, and it is not met",
    tornV.met === false && tornV.reasons.some((r) => /floor/i.test(r)));

  // THE SPINE TWIN of the arm above, which did not exist. Five clean days plus one unreadable
  // SPINE line reported "REQ-10 MET: every one of them on the spine", exit 0 -- while the
  // unreadable line may be the decision made outside the face, the one thing this file exists
  // to catch. The arm is here so the missing half cannot go missing again.
  const spineTornV = dogfoodVerdict(mkJournal(clean), { ...mkSpine(cleanSpine), torn: 1 });
  armed("a torn SPINE line also fails it, not just a torn journal line",
    spineTornV.met === false && spineTornV.reasons.some((r) => /spine line/i.test(r)));
  armed("and it says WHY: the unreadable line may be the one made outside",
    spineTornV.reasons.some((r) => /outside the face/i.test(r)));

  // ---- the named window (Phase 08 amendment, 2026-10-14) ----
  // An op journal entry and a spine that holds every id it is asked about.
  const op = (d, r) => ({ day: d, op: "today.capture-idea", receipt: r });
  const withOps = (entries, ops) => ({ ...mkJournal(entries), ops });
  // `extra` are the ops whose receipts the spine holds, each on its own op's day.
  const spineIds = (receipts, extra) => ({ ...mkSpine(receipts), ids: new Map([
    ...receipts.map((r) => [r.id, { kind: "decision.recorded", day: r.day }]),
    ...extra.map((o) => [o.receipt, { kind: "idea.captured", process: "", day: o.day }]),
  ]) });
  // The registry the CLI reads from face-ops.mjs, reduced to the one row these arms use.
  const rOf = (opId) => (opId === "today.capture-idea" ? { kind: "idea.captured" } : null);
  const w2 = [day(1), day(2)];
  const twoOps = [op(day(1), "R1"), op(day(2), "R2")];

  // THE NEGATIVE CONTROL for the window: an old outside-face decision (day 0) fails the
  // all-history verdict, and the window over two clean days with an op each is MET.
  const hist = [...cleanSpine.slice(0, 3), { day: day(0), id: id(97), decides: "A97" }];
  const histJ = clean.slice(0, 3);
  armed("all history still fails on an old outside decision",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2 }).met === false);
  const wGood = dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2, receiptOf: rOf, window: w2 });
  armed("two named clean days with an op each are MET", wGood.met === true, JSON.stringify(wGood.reasons));
  armed("and the outside count across ALL history is still reported", wGood.outsideAllHistory === 1);

  // An outside decision INSIDE a named day still fails it.
  armed("an outside decision on a named day fails the window",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds([...hist, { day: day(2), id: id(96), decides: "A96" }], twoOps), { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);

  // A named day with no op fails, and says which day.
  const noOpV = dogfoodVerdict(withOps(histJ, [op(day(1), "R1")]), spineIds(hist, [op(day(1), "R1")]), { requiredDays: 2, receiptOf: rOf, window: w2 });
  armed("a named day with no face op fails the window",
    noOpV.met === false && noOpV.reasons.some((r) => r.includes("no face op") && r.includes(day(2))));

  // An op whose receipt is NOT on the spine is not an op that ran -- the journal's word alone
  // is never enough, exactly as for decisions.
  const ghost = dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(2), "GHOST")]), spineIds(hist, [op(day(1), "R1")]), { requiredDays: 2, receiptOf: rOf, window: w2 });
  armed("an op whose receipt the spine lacks does not count",
    ghost.met === false && ghost.opsByDay[day(2)] === 0 && ghost.reasons.some((r) => /does not hold/.test(r)));
  // A spine with no id set (an old caller) proves no op at all, rather than every op.
  armed("a spine without ids proves no op, never every op",
    dogfoodVerdict(withOps(histJ, twoOps), mkSpine(hist), { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);

  // A named day that decided nothing is a reason, even if the other days reach the count.
  const w3 = [day(1), day(2), day(4)];
  const emptyDayV = dogfoodVerdict(withOps(histJ, [...twoOps, op(day(4), "R4")]), spineIds(hist, [...twoOps, op(day(4), "R4")]), { requiredDays: 2, receiptOf: rOf, window: w3 });
  armed("a named day with no face decision fails the window",
    emptyDayV.met === false && emptyDayV.reasons.some((r) => r.includes("no decision") && r.includes(day(4))));

  // Naming one day cannot pass a two-day floor.
  armed("one named day does not pass a two-day floor",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2, receiptOf: rOf, window: [day(1)] }).met === false);

  // Naming a day twice is one day, not two.
  armed("a day named twice is still one day",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2, receiptOf: rOf, window: [day(1), day(1)] }).met === false);

  // An op on a day OUTSIDE the window does not lend itself to a named day.
  armed("an op outside the window does not count for a named day",
    dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(0), "R0")]), spineIds(hist, [op(day(1), "R1"), op(day(0), "R0")]), { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);

  // IDENTITY, not membership (attack r1 B1). A day's own DECISION id quoted as its op, a real
  // op receipt from ANOTHER day, and one receipt journalled twice each prove nothing.
  const asDecision = dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(2), id(2))]), spineIds(hist, [op(day(1), "R1")]), { requiredDays: 2, receiptOf: rOf, window: w2 });
  armed("a decision id quoted as an op receipt does not count",
    asDecision.met === false && asDecision.opsByDay[day(2)] === 0);
  armed("an op receipt from another day does not count",
    dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(2), "R0")]), spineIds(hist, [op(day(1), "R1"), op(day(0), "R0")]), { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);
  const reused = dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(1), "R1")]), spineIds(hist, [op(day(1), "R1")]), { requiredDays: 1, receiptOf: rOf, window: [day(1)] });
  armed("one receipt journalled twice is one op",
    reused.opsByDay[day(1)] === 1 && reused.met === false && reused.reasons.some((r) => /repeat a receipt/.test(r)));

  // The KIND the op's own row names (attack r2 L1/B2): any other same-day event -- a note, a
  // stamp, a run.completed -- is not this op's receipt.
  const noteAsOp = { ...spineIds(hist, [op(day(1), "R1")]) };
  noteAsOp.ids.set("N2", { kind: "note.logged", process: "", day: day(2) });
  armed("a same-day event of another kind does not count as the op",
    dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), op(day(2), "N2")]), noteAsOp, { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);
  armed("an op the registry does not know does not count",
    dogfoodVerdict(withOps(histJ, [op(day(1), "R1"), { day: day(2), op: "no.such-op", receipt: "R2" }]), spineIds(hist, twoOps), { requiredDays: 2, receiptOf: rOf, window: w2 }).met === false);
  armed("no registry given proves no op, never every op",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2, window: w2 }).met === false);
  const procOf = (opId) => (opId === "today.capture-idea" ? { kind: "idea.captured", process: "arc-event@1.0.0" } : null);
  armed("a row that names a process holds the receipt to it",
    dogfoodVerdict(withOps(histJ, twoOps), spineIds(hist, twoOps), { requiredDays: 2, receiptOf: procOf, window: w2 }).met === false);

  // The reader (attack r1 B2, B5): a non-object line and a non-ULID receipt are torn, never a
  // crash and never text that reaches the evidence files.
  const ulidOk = "01M40FQRQ6Q9G3QPCMZ0VP3TRG";
  const text = [
    "null", "7", "[]",
    JSON.stringify({ work: true, phase: "apply", ok: true, op: "x", receipt: "R\nREQ-10 MET" }),
    JSON.stringify({ work: true, phase: "apply", ok: true, op: "x", receipt: ulidOk }),
  ].join("\n") + "\n";
  let rj = null;
  try { rj = parseJournalText("2026-08-11", text); } catch { rj = null; }
  armed("a journal line that is not an object is torn, not a crash", rj !== null && rj.torn === 4, JSON.stringify(rj));
  armed("and only a ULID receipt is read as an op", rj !== null && rj.ops.length === 1 && rj.ops[0].receipt === ulidOk);

  // The --day guard.
  const NOW =Date.parse("2026-10-14T06:00:00Z");
  armed("--day refuses a non-date", dayRefusal("2026-1-4", [], NOW) !== null && dayRefusal(undefined, [], NOW) !== null);
  armed("--day refuses an impossible date", dayRefusal("2026-02-30", [], NOW) !== null);
  armed("--day refuses a future day", /future/.test(dayRefusal("2026-10-15", [], NOW) ?? ""));
  armed("--day refuses a repeat", /twice/.test(dayRefusal("2026-10-13", ["2026-10-13"], NOW) ?? ""));
  armed("--day accepts today in IST", dayRefusal("2026-10-14", [], Date.parse("2026-10-13T20:00:00Z")) === null);

  for (const l of lines) process.stdout.write(l + "\n");
  // Derived from the arms that registered, so a suite can compare its PASS count to it.
  process.stdout.write(`RAN: ${lines.length} arms\n`);
  process.stdout.write(`face-dogfood selftest: ${ok ? "PASS -- the requirement can be failed, by every route it can be failed by" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

const KNOWN_FLAGS = ["--journal", "--spine", "--days", "--day", "--json", "--selftest"];

/**
 * Why a `--day` value is refused, or null when it is usable. The days are IST, as the journal
 * and the spine name them, so "the future" is judged against today in IST.
 * @param {string | undefined} raw
 * @param {string[]} already
 * @param {number} [nowMs]
 */
export function dayRefusal(raw, already, nowMs = Date.now()) {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "is not a day (want YYYY-MM-DD)";
  const t = Date.parse(`${raw}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== raw) return "is not a calendar date";
  const todayIst = new Date(nowMs + 330 * 60_000).toISOString().slice(0, 10);
  if (raw > todayIst) return `is in the future (today is ${todayIst} IST)`;
  if (already.includes(raw)) return "is named twice";
  return null;
}

/** An unrecognised `--` argument is exit 2, for the reason the sibling gates state at length. */
function refuseUnknownFlags(argv, known) {
  // The bare flag, and a SINGLE dash too.
  //
  // This used to strip at `=` so `--journal=DIR` passed the guard -- and then the parse loop,
  // which only matches the space form, ignored it. The command answered about the DEFAULT
  // journal while the caller believed it had named one. Both siblings refuse the equals form
  // outright (`face-sections --check=true` exits 2); accepting a spelling and then not
  // honouring it is worse than refusing it, because the caller gets an answer either way.
  const bad = argv.filter((a) => a.startsWith("-") && !known.includes(a));
  if (bad.length) {
    process.stderr.write(`face-dogfood: unknown flag(s) ${bad.join(", ")} -- known flags are ${known.join(", ")}.\n`);
    process.exit(2);
  }
}

if (isMainModule()) {
  const argv = process.argv.slice(2);
  refuseUnknownFlags(argv, KNOWN_FLAGS);
  if (argv.includes("--selftest")) process.exit(selftest());
  const flags = { json: argv.includes("--json") };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--journal") flags.journal = argv[++i];
    else if (argv[i] === "--spine") flags.spine = argv[++i];
    else if (argv[i] === "--days") {
      // VALIDATED, never a bare Number(). `--days abc` produced NaN, `requiredDays ?? DEFAULT`
      // only guards null and undefined, and `days.length < NaN` is false -- so the one floor
      // that makes an empty run fail was deleted by a typo, and the command printed
      // "REQ-10 MET" over an empty journal and an empty spine, exit 0. The lane's headline
      // evidence claim was made true by one CLI word with nothing behind it. `--days 0` did
      // the same thing on purpose.
      const raw = argv[++i];
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1) {
        process.stderr.write(`face-dogfood: --days ${raw} is not a number of days (want an integer >= 1). Refusing: an unusable value here silently REMOVES the floor this command exists to enforce.
`);
        process.exit(2);
      }
      flags.days = n;
    }
    else if (argv[i] === "--day") {
      // A REAL calendar date, not in the future, named once. `2026-02-30` would match no file
      // and fail anyway, but a typo should be a refusal that names it, not a NOT MET that sends
      // someone looking at the owner's day. A future day is a claim about a day not yet lived.
      const raw = argv[++i];
      const why = dayRefusal(raw, flags.window ?? []);
      if (why) {
        // writeSync: the message must land before process.exit, on every OS (attack r2 B1).
        writeSync(2, `face-dogfood: --day ${raw} ${why}. Refusing: a named day is the claim this command checks.\n`);
        process.exit(2);
      }
      (flags.window ??= []).push(raw);
    }
  }
  // The repo is the first argument no flag consumed -- by POSITION, not by value. Comparing
  // values let `--days 02` (parsed as 2, compared as "2") leak "02" in as the repo root.
  const consumed = new Set();
  argv.forEach((a, i) => { if (["--journal", "--spine", "--days", "--day"].includes(a)) consumed.add(i + 1); });
  // At most one, and never a day: `--days 1 2026-10-13` is a forgotten `--day`, and reading it
  // as a repo would judge all history while the caller believed one day was named.
  const positionals = argv.filter((a, i) => !a.startsWith("-") && !consumed.has(i));
  if (positionals.length > 1 || positionals.some((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))) {
    writeSync(2, `face-dogfood: unexpected argument(s) ${positionals.join(", ")} -- one repo root at most, and a day is named with --day YYYY-MM-DD.\n`);
    process.exit(2);
  }
  const repo = positionals[0] || REPO_DEFAULT;
  // `run` reads the spine through the canonical reader, which is async (it may open the sqlite
  // index). A bare try/catch around an async call catches nothing: the promise rejects after
  // the try block has already returned, so a read failure would have gone out as an unhandled
  // rejection -- and node's exit code for that is 1, which this CLI defines as "requirement
  // not met". A failed READ reported as a failed DOGFOOD is the exact confusion the fail-closed
  // guards above exist to prevent, arriving through the error path instead of the happy one.
  run(repo, flags)
    .then((code) => process.exit(code))
    .catch((err) => { process.stderr.write(`face-dogfood: ERROR -- ${err.message}\n`); process.exit(2); });
}
