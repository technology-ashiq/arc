// scenarios.mjs -- the evidence fold's fixtures, runnable against the real fold OR a mutant of it (POL-L, REQ-01..03).
//
//   node scenarios.mjs <path-to-fold.mjs> <scenario>
//
// Prints `RAN <scenario>` first, then `PASS <scenario>` and exits 0 when every expectation holds, or
// `ASSERT-FAILED <scenario>: <why>` and exits 1. A crash prints neither PASS nor ASSERT-FAILED, so a caller that
// expects a mutant to be KILLED asserts on ASSERT-FAILED -- a mutant that merely crashed proves nothing.
//
// Events here are bare objects: the fold is pure and validation is the loader's job (load.mjs), tested separately.
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [foldPath, scenario] = process.argv.slice(2);
const F = await import(pathToFileURL(resolve(foldPath)).href);
process.stdout.write(`RAN ${scenario}\n`);

const fail = (why) => { process.stdout.write(`ASSERT-FAILED ${scenario}: ${why}\n`); process.exit(1); };
const expect = (cond, why) => { if (!cond) fail(why); };

// Monotonic ULID-shaped ids: lexicographic order is time order, as on the real spine.
let seq = 0;
const id = () => `01K${String(++seq).padStart(23, "0")}`;
const ts = (day, time = "12:00:00") => `${day}T${time}+05:30`;

const policy = {
  kinds: {
    "session:interactive": {
      e2: [], read: { level: "L3" }, write: { level: "L1" },
      shell: { level: "L1", evidence_days: 35 }, network: { level: "L1" },
      message: { level: "L0" }, publish: { level: "L0" }, deploy: { level: "L0" }, spend: { level: "L0" },
    },
    "process:demo": {
      e2: [], read: { level: "L3" }, shell: { level: "L1", evidence_days: 10 }, network: { level: "L0" },
    },
  },
};
// Phase 02's writer table, injected: the shipped table has no interactive writer yet, so without this no
// in-scope cell could ever be fresh and every positive control would be impossible to build.
const PHASE02 = { headless: ["L0"], interactive: ["L1"] };
const WIDE = { headless: ["L0", "L1"], interactive: ["L1"] };

const refusal = (o) => ({
  id: id(), kind: "note.logged", ts: ts(o.day, o.time), process: o.process ?? "policy-hook@1.0.0", outcome: "fail",
  payload: { subject: "policy.refusal", action_kind: o.kind ?? "session:interactive", capability: o.cap ?? "shell",
    level: o.level ?? "L1", decision: o.decision ?? "propose", surface: o.surface ?? "interactive",
    reason: "fixture", ...(o.incident_ref ? { incident_ref: o.incident_ref } : {}) },
});
const incident = (o) => ({
  id: id(), kind: "incident.raised", ts: ts(o.day), process: o.process ?? "demo@1.0.0", outcome: "fail",
  payload: { what: o.what ?? "policy denied demo: process:demo/shell is denied", severity: "high", source: o.source ?? "arc-run policy gate",
    denials: o.denials ?? [{ capability: "shell", level: "L0" }] },
});
// process:demo/shell held at L0 by a demotion, so a headless L0 deny is consistent and only corroboration decides.
const demotedToL0 = () => [{ id: id(), kind: "policy.demoted", ts: ts("2026-10-01"), payload: { action_kind: "process:demo", capability: "shell" } }];
const headlessDeny = (o) => refusal({ kind: "process:demo", level: "L0", decision: "deny", surface: "headless", process: "demo@1.0.0", day: "2026-10-02", ...o });
const throws = (fn) => { try { fn(); return false; } catch { return true; } };
const fold = (events, asOf, writers, transitions = []) =>
  F.foldEvidence({ policy, transitions, events, asOf, ...(writers ? { writers } : {}) });
const cell = (r, subject, cap) => r.cells.find((c) => c.subject === subject && c.capability === cap);

const S = {
  // The fold RAN over every pair: subjects x 8, before any state is believed.
  ran() {
    const r = fold([], "2026-10-07");
    expect(r.cells.length === 2 * 8, `expected 16 cells, got ${r.cells.length}`);
    expect(r.subjects === 2, "subject count");
  },
  // Invariant (a): zero receipts is BELOW-BAR, never PASS -- with a writer (absent) and without one (unknown).
  zeroReceipts() {
    const withWriter = cell(fold([], "2026-10-07", PHASE02), "session:interactive", "shell");
    expect(withWriter.below_bar === true && withWriter.state === "absent", `with a writer: ${JSON.stringify(withWriter)}`);
    const noWriter = cell(fold([], "2026-10-07"), "session:interactive", "shell");
    expect(noWriter.below_bar === true && noWriter.state === "unknown", `without a writer: ${JSON.stringify(noWriter)}`);
  },
  // The positive control: a broken fold that reports everything BELOW-BAR cannot pass this.
  freshControl() {
    const c = cell(fold([refusal({ day: "2026-10-01" })], "2026-10-07", PHASE02), "session:interactive", "shell");
    expect(c.state === "fresh" && c.below_bar === false && c.evidence_age_days === 6, `fresh control: ${JSON.stringify(c)}`);
  },
  // Invariant (b): fresh at exactly N, BELOW-BAR at N+1, byte-identical across two replays.
  dayBoundary() {
    const evs = [refusal({ day: "2026-09-01" })];
    const atN = cell(fold(evs, "2026-10-06", PHASE02), "session:interactive", "shell");      // 35 days
    const atN1 = cell(fold(evs, "2026-10-07", PHASE02), "session:interactive", "shell");     // 36 days
    expect(atN.state === "fresh" && atN.evidence_age_days === 35, `at N: ${JSON.stringify(atN)}`);
    expect(atN1.below_bar === true && atN1.reason === "stale" && atN1.evidence_age_days === 36, `at N+1: ${JSON.stringify(atN1)}`);
    const a = JSON.stringify(fold(evs, "2026-10-07", PHASE02)), b = JSON.stringify(fold(evs, "2026-10-07", PHASE02));
    expect(a === b, "two replays differ");
  },
  // IST days: 23:59:59 and 00:00:00 IST are different days, though both sit on one UTC date.
  istBucketing() {
    const late = cell(fold([refusal({ day: "2026-10-01", time: "23:59:59" })], "2026-10-02", PHASE02), "session:interactive", "shell");
    const early = cell(fold([refusal({ day: "2026-10-02", time: "00:00:00" })], "2026-10-02", PHASE02), "session:interactive", "shell");
    expect(late.evidence_age_days === 1, `23:59:59 IST on 10-01 is 1 day before 10-02, got ${late.evidence_age_days}`);
    expect(early.evidence_age_days === 0, `00:00:00 IST on 10-02 is day 0, got ${early.evidence_age_days}`);
  },
  // Nothing after the as-of day exists for this reading: no negative age, no freshness from the future.
  future() {
    const c = cell(fold([refusal({ day: "2026-10-09" })], "2026-10-07", PHASE02), "session:interactive", "shell");
    expect(c.state === "absent" && c.evidence_age_days === null && c.last_refusal === null, `future: ${JSON.stringify(c)}`);
  },
  // A missing N is BELOW-BAR with its own reason, never PASS and never a crash.
  noBarDeclared() {
    const c = cell(fold([refusal({ day: "2026-10-06", cap: "network" })], "2026-10-07", PHASE02), "session:interactive", "network");
    expect(c.below_bar === true && c.reason === "no-bar-declared" && c.n === null, `no N: ${JSON.stringify(c)}`);
  },
  // The fold reads no clock: Date.now and an argument-less Date both throw, and the fold still answers.
  noClock() {
    const RealDate = Date;
    globalThis.Date = class extends RealDate {
      constructor(...a) { if (a.length === 0) throw new Error("clock read"); super(...a); }
      static now() { throw new Error("clock read"); }
    };
    try {
      const c = cell(fold([refusal({ day: "2026-10-01" })], "2026-10-07", PHASE02), "session:interactive", "shell");
      expect(c.evidence_age_days === 6, "age changed with no clock");
    } finally { globalThis.Date = RealDate; }
  },
  // A receipt whose level disagrees with the replayed effective level describes a decision nobody made.
  inconsistent() {
    // A writer exists at L0, so the receipt reaches the consistency check rather than being discarded as forged.
    const c = cell(fold([refusal({ day: "2026-10-06", level: "L0", decision: "deny" })], "2026-10-07", { headless: ["L0"], interactive: ["L0", "L1"] }), "session:interactive", "shell");
    expect(c.last_refusal === null && c.discarded.inconsistent === 1 && c.below_bar === true, `inconsistent: ${JSON.stringify(c)}`);
  },
  // A consistent L0 refusal from before a promotion does not prove the L1 the pair holds now.
  l0BeforePromotion() {
    const demoted = { id: id(), kind: "policy.demoted", ts: ts("2026-10-01"), payload: { action_kind: "process:demo", capability: "shell" } };
    const inc = incident({ day: "2026-10-02" });
    const ref = refusal({ day: "2026-10-02", kind: "process:demo", level: "L0", decision: "deny", surface: "headless", process: "demo@1.0.0", incident_ref: inc.id });
    const raised = { id: id(), kind: "policy.level.changed", ts: ts("2026-10-03"), payload: { action_kind: "process:demo", capability: "shell", to_level: "L1" } };
    const c = cell(fold([inc, ref], "2026-10-07", WIDE, [demoted, raised]), "process:demo", "shell");
    expect(c.effective === "L1", `effective now ${c.effective}`);
    expect(c.last_refusal === ref.id && c.last_refusal_level === "L0", "the L0 refusal is attributed");
    expect(c.qualifying_refusal === null && c.below_bar === true && c.state === "absent", `L0 must not refresh L1: ${JSON.stringify(c)}`);
  },
  // A headless refusal with no incident from arc-run's gate behind it is unverified and refreshes nothing.
  unverifiedHeadless() {
    const ref = refusal({ day: "2026-10-06", kind: "process:demo", level: "L1", decision: "deny", surface: "headless", process: "demo@1.0.0", incident_ref: id() });
    const c = cell(fold([ref], "2026-10-07", WIDE), "process:demo", "shell");
    expect(c.last_refusal === null && c.discarded.unverified === 1 && c.below_bar === true, `unverified: ${JSON.stringify(c)}`);
  },
  // The positive control for corroboration: incident first, same day, same process@version, typed denial -- attributed.
  corroborated() {
    const chain = demotedToL0();
    const inc = incident({ day: "2026-10-02" });
    const ref = headlessDeny({ incident_ref: inc.id });
    const c = cell(fold([inc, ref], "2026-10-07", null, chain), "process:demo", "shell");
    expect(c.last_refusal === ref.id && c.discarded.unverified === 0, `corroborated: ${JSON.stringify(c)}`);
  },
  // attack r1 L2: an incident written AFTER the refusal it is cited by cannot vouch for it.
  incidentAfterRefusal() {
    const chain = demotedToL0();
    const pre = id();
    const ref = headlessDeny({ incident_ref: "PLACEHOLDER" });
    const inc = incident({ day: "2026-10-02" });
    ref.payload.incident_ref = inc.id;
    expect(pre < ref.id && ref.id < inc.id, "fixture order");
    const c = cell(fold([ref, inc], "2026-10-07", null, chain), "process:demo", "shell");
    expect(c.last_refusal === null && c.discarded.unverified === 1, `later incident: ${JSON.stringify(c)}`);
  },
  // attack r1 L3: an incident whose typed denials do not name this capability at this level vouches for nothing.
  incidentWithoutDenial() {
    const chain = demotedToL0();
    const inc = incident({ day: "2026-10-02", denials: [{ capability: "write", level: "L0" }] });
    const ref = headlessDeny({ incident_ref: inc.id });
    const c = cell(fold([inc, ref], "2026-10-07", null, chain), "process:demo", "shell");
    expect(c.last_refusal === null && c.discarded.unverified === 1, `no matching denial: ${JSON.stringify(c)}`);
  },
  // attack r1 L5: another VERSION of the same process is another process.
  versionMismatch() {
    const chain = demotedToL0();
    const inc = incident({ day: "2026-10-02", process: "demo@1.0.0" });
    const ref = headlessDeny({ incident_ref: inc.id, process: "demo@2.0.0" });
    const c = cell(fold([inc, ref], "2026-10-07", null, chain), "process:demo", "shell");
    expect(c.last_refusal === null && c.discarded.unverified === 1, `version mismatch: ${JSON.stringify(c)}`);
  },
  // attack r1 L7/B4: an impossible day is refused, never rolled over into a plausible one.
  invalidAsOf() {
    expect(throws(() => fold([], "2026-02-30")), "2026-02-30 was accepted");
    expect(throws(() => fold([], "2026-13-01")), "month 13 was accepted");
    expect(!throws(() => fold([], "2028-02-29")), "a real leap day was refused");
  },
  // attack r1 L9: a policy with no subject is nothing evaluated, never a clean zero-cell reading.
  emptyPolicy() {
    expect(throws(() => F.foldEvidence({ policy: { kinds: {} }, transitions: [], events: [], asOf: "2026-10-07" })), "an empty policy folded");
  },
  // An interactive refusal before any interactive writer exists is forged by construction.
  forgedBeforeWriter() {
    const c = cell(fold([refusal({ day: "2026-10-06" })], "2026-10-07"), "session:interactive", "shell");
    expect(c.last_refusal === null && c.discarded.unverified === 1 && c.state === "unknown", `forged: ${JSON.stringify(c)}`);
  },
  // Prose is never parsed: an incident naming the capability in `what` is not a refusal.
  proseIgnored() {
    const c = cell(fold([incident({ day: "2026-10-06", what: "policy denied demo: session:interactive/shell refused" })], "2026-10-07", PHASE02), "session:interactive", "shell");
    expect(c.last_refusal === null && c.state === "absent", `prose: ${JSON.stringify(c)}`);
  },
  // The guard's run.completed is every cell's last audit; a process's own ok run is its shell success.
  carriers() {
    const guard = { id: id(), kind: "run.completed", ts: ts("2026-10-05"), process: "policy-evidence-guard@1.0.0", outcome: "partial", payload: {} };
    const run = { id: id(), kind: "run.completed", ts: ts("2026-10-06"), process: "demo@1.0.0", outcome: "ok", payload: {} };
    const r = fold([guard, run], "2026-10-07");
    expect(r.cells.every((c) => c.last_audit === guard.id), "last_audit missing on some cell");
    expect(cell(r, "process:demo", "shell").last_success === run.id, "shell success not attributed to the process run");
    expect(cell(r, "session:interactive", "shell").last_success === null, "the interactive session has no success carrier");
  },
};

if (!Object.prototype.hasOwnProperty.call(S, scenario)) { process.stdout.write(`UNKNOWN-SCENARIO ${scenario}\n`); process.exit(2); }
S[scenario]();
process.stdout.write(`PASS ${scenario}\n`);
