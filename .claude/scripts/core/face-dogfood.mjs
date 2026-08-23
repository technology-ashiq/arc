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
//   face-dogfood.mjs [repo-root] [--journal DIR] [--spine DIR] [--days N] [--json]
//   face-dogfood.mjs --selftest
//
// Exit: 0 requirement met | 1 not met (named) | 2 could not read the inputs.
//
// Runs from the MAIN CLONE for a live check: spineRoot() refuses a linked worktree by design,
// so a worktree run must name its inputs with --spine/--journal. That is not a limitation to
// work around; a worktree has no canonical spine and an answer derived from one would be
// about nothing.

import { readFileSync, existsSync, readdirSync, realpathSync } from "node:fs";
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
 * @returns {{ days: string[], entries: { day: string, ts: string, decision: string, decides: string }[], lines: number, torn: number }}
 */
export function readJournal(dir) {
  if (!existsSync(dir)) return { days: [], entries: [], lines: 0, torn: 0 };
  const entries = [];
  const days = [];
  let lines = 0;
  let torn = 0;
  for (const f of readdirSync(dir).filter((n) => /^journal-\d{4}-\d{2}-\d{2}\.jsonl$/.test(n)).sort()) {
    const day = f.slice("journal-".length, -".jsonl".length);
    days.push(day);
    for (const raw of readFileSync(join(dir, f), "utf8").split("\n")) {
      if (!raw.trim()) continue;
      lines++;
      let e;
      // A torn line is COUNTED, not skipped in silence. A journal that lost half its lines
      // and a journal that recorded nothing look identical unless someone says so.
      try { e = JSON.parse(raw); } catch { torn++; continue; }
      if (e.path !== "/api/decide" || e.status !== 200) continue;
      if (typeof e.decision !== "string" || typeof e.decides !== "string") { torn++; continue; }
      entries.push({ day, ts: String(e.ts ?? ""), decision: e.decision, decides: e.decides });
    }
  }
  return { days, entries, lines, torn };
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
 * @returns {Promise<{ days: string[], receipts: { day: string, id: string, decides: string }[], torn: number }>}
 */
export async function readSpineDecisions(root) {
  if (!existsSync(join(root, "events"))) return { days: [], receipts: [], torn: 0 };
  const { readAll } = await import(pathToFileURL(join(REPO_DEFAULT, ".claude", "scripts", "hq", "spine.mjs")).href);
  const { events, torn } = await readAll(root);
  const receipts = [];
  const days = new Set();
  // The envelope is { event, day, seq, line } -- the EVENT is one level in. Reading `e.kind`
  // off the envelope is not a crash, it is `undefined`, so every kind test quietly answers no
  // and the report comes back well-formed and wrong. That exact mistake shipped in the door's
  // /api/rooms handler and was caught only by a count that could not have been true.
  for (const { event, day } of events) {
    days.add(day);
    if (event?.kind !== "decision.recorded") continue;
    receipts.push({ day, id: String(event.id ?? ""), decides: String(event.payload?.decides ?? "") });
  }
  return { days: [...days].sort(), receipts, torn: torn.length };
}

// ---------- the match (pure: two record sets -> a verdict) ----------

/**
 * @typedef {object} DogfoodVerdict
 * @property {boolean} met
 * @property {number} daysWithFaceDecisions
 * @property {number} requiredDays
 * @property {string[]} days                 the days that carried at least one face decision
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
 * @param {{ requiredDays?: number, window?: string[] }} [opts]
 * @returns {DogfoodVerdict}
 */
export function dogfoodVerdict(journal, spine, opts = {}) {
  const requiredDays = opts.requiredDays ?? REQUIRED_DAYS;
  // A window narrows the question to the days being claimed. Without one, every day either
  // side has ever seen counts -- which is the honest default, because a dogfood you have to
  // pick the window for is a dogfood you can pick the window to pass.
  const inWindow = (day) => !opts.window || opts.window.includes(day);

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

  const reasons = [];
  if (spineOnly.length)
    reasons.push(`${spineOnly.length} decision(s) were recorded on the spine with no journal line -- decided OUTSIDE the face, which is exactly what REQ-10 asks not to happen: ${spineOnly.slice(0, 5).map((r) => `${r.id} (${r.day})`).join(", ")}${spineOnly.length > 5 ? ", …" : ""}`);
  if (journalOnly.length)
    reasons.push(`${journalOnly.length} journal line(s) claim a receipt the spine does not hold -- the face said it wrote something that is not there: ${journalOnly.slice(0, 5).map((e) => `${e.decision} (${e.day})`).join(", ")}${journalOnly.length > 5 ? ", …" : ""}`);
  if (days.length < requiredDays)
    reasons.push(`${days.length} of ${requiredDays} days carried a decision through the face`);
  if (journal.torn)
    reasons.push(`${journal.torn} journal line(s) could not be read, so this count is a floor and not a total`);

  const met = reasons.length === 0;
  const headline = met
    ? `REQ-10 MET: ${matched.length} decision(s) across ${days.length} days, every one of them through the face and every one of them on the spine.`
    : `REQ-10 NOT MET: ${matched.length} matched, ${spineOnly.length} decided outside the face, ${journalOnly.length} claimed but absent, ${days.length} of ${requiredDays} days.`;

  return {
    met,
    daysWithFaceDecisions: days.length,
    requiredDays,
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
  const journalDir = flags.journal ?? join(repo, ".claude", "state", "hq", "dash-journal");
  const spineRoot = flags.spine ?? join(repo, ".claude", "state", "hq");

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

  const v = dogfoodVerdict(journal, spine, { requiredDays: flags.days ?? REQUIRED_DAYS });
  if (flags.json) {
    process.stdout.write(JSON.stringify(v, null, 2) + "\n");
    return v.met ? 0 : 1;
  }
  process.stdout.write(`${v.headline}\n`);
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

  for (const l of lines) process.stdout.write(l + "\n");
  process.stdout.write(`face-dogfood selftest: ${ok ? "PASS -- the requirement can be failed, by every route it can be failed by" : "FAIL"}\n`);
  return ok ? 0 : 1;
}

const KNOWN_FLAGS = ["--journal", "--spine", "--days", "--json", "--selftest"];

/** An unrecognised `--` argument is exit 2, for the reason the sibling gates state at length. */
function refuseUnknownFlags(argv, known) {
  const bad = argv.filter((a) => a.startsWith("--") && !known.includes(a.split("=")[0]));
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
    else if (argv[i] === "--days") flags.days = Number(argv[++i]);
  }
  const repo = argv.find((a) => !a.startsWith("--")
    && a !== flags.journal && a !== flags.spine && String(flags.days) !== a) || REPO_DEFAULT;
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
