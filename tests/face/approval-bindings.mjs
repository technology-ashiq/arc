#!/usr/bin/env node
// approval-bindings.mjs -- an approval knows what it waits on and what it is bound to (face v2 Phase 16, REQ-20, ADR-1355).
//
// What it proves, each check failing when the decision it names is removed:
//   KINDS      no new kind; decision.recorded still refuses a fourth field
//   PROFILE    bound_to / depends_on / decision_key are held to closed shapes: 9 parents, a self-reference, a duplicate,
//              a near-miss key, a decision_key with a trailing space are each refused
//   EMIT       a parent that is a decision's ULID, or not on the spine, is refused at emit; a cycle is refused
//   PARENT     an undecided parent -> WAITING and approve refuses PARENT_OPEN; a rejected parent -> STALE(parent-rejected)
//              and approve refuses PARENT_REJECTED with the spine's line count unchanged; an approved parent -> OPEN
//   KEY        two requests sharing a key -> one OPEN, one DUPLICATE_OF; deciding either resolves both; one decision
//   BOUND      a request bound to a plan digest reads OPEN while the plan holds and STALE(plan-moved) once it moves;
//              approve refuses PLAN_STALE; an approved one whose plan moved reads "approved · stale · re-plan needed";
//              the re-derive writes nothing (the spine, the export and the lock dir are identical before and after)
//   LINE       inbox prints OPEN only, each line ending in its state; --all prints every state
//   REPLAY     the fold over a day-cut prefix shows WAITING, and OPEN once the parent's decision is in the cut
//   FACE       the Inbox room draws each state as a badge from the door's fold, arms approve only on OPEN, and an
//              unevaluable binding is REQ-19's unknown
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is "RAN: <n> checks, <f> failed".
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const HQ = join(REPO, ".claude", "scripts", "hq");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${String(detail).slice(0, 600)}`); }
  else console.log(`ok ${name}`);
};
const code = (fn) => { try { fn(); return null; } catch (e) { return e && e.code; } };

const V = await import(pathToFileURL(join(HQ, "lib", "validate.mjs")).href);
const B = await import(pathToFileURL(join(HQ, "lib", "validate-bindings.mjs")).href);
const F = await import(pathToFileURL(join(HQ, "lib", "approval-fold.mjs")).href);
const C = await import(pathToFileURL(join(HQ, "lib", "canonical.mjs")).href);
check("validate.mjs, validate-bindings.mjs, approval-fold.mjs loaded (vacuous-pass guard)",
  typeof V.validateEvent === "function" && typeof B.assertBindings === "function" && typeof F.foldApprovals === "function");

// ── KINDS + PROFILE (pure) ─────────────────────────────────────────────────────────────────────────
const ulid = (n) => `01M5${String(n).padStart(22, "0")}`.slice(0, 26);
const req = (payload, id = ulid(99)) => {
  const e = { v: 1, id, ts: C.formatIst(C.nowMs()), idem: "a".repeat(64), actor: "test", process: "test@1.0.0", model: null, venture: "arc", run_id: "r-test", kind: "approval.requested", payload, outcome: "ok", cost: null, evidence: null, supersedes: null };
  return e;
};
const vcode = (e) => code(() => V.validateEvent(e));
{
  check("KINDS: no kind names a binding -- the three fields ride approval.requested", !V.KINDS.some((k) => /bind|depend|stale|duplicate/i.test(k)) && V.KINDS.includes("approval.requested"), V.KINDS.join(","));
  const dec = { ...req({}), kind: "decision.recorded", payload: { decides: ulid(1), verdict: "approve", reason: "x", bound_to: {} } };
  dec.idem = C.sha256Hex(`decision.recorded|${ulid(1)}`);
  check("KINDS: decision.recorded still refuses a fourth field", vcode(dec) === "BAD_DECISION", vcode(dec));
  const okBound = { kind: "plan-expect", expect: "b".repeat(64), op: "money.ingest", input: { provider: "razorpay", export: "x.csv", venture: "lexos" } };
  check("PROFILE: a valid bound_to, depends_on and decision_key are accepted", vcode(req({ what: "w", bound_to: okBound, depends_on: [ulid(1)], decision_key: "face:availability:p15" })) === null,
    vcode(req({ what: "w", bound_to: okBound, depends_on: [ulid(1)], decision_key: "face:availability:p15" })));
  check("PROFILE: bound_to of another kind, a short digest or an unknown key is refused",
    vcode(req({ bound_to: { ...okBound, kind: "other" } })) === "BAD_BINDING" && vcode(req({ bound_to: { ...okBound, expect: "abc" } })) === "BAD_BINDING"
    && vcode(req({ bound_to: { ...okBound, cmd: "rm" } })) === "BAD_BINDING");
  check("PROFILE: 9 parents are refused, 8 accepted", vcode(req({ depends_on: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(ulid) })) === "BAD_BINDING" && vcode(req({ depends_on: [1, 2, 3, 4, 5, 6, 7, 8].map(ulid) })) === null);
  check("PROFILE: a request depending on itself is refused", vcode(req({ depends_on: [ulid(99)] }, ulid(99))) === "BAD_BINDING");
  check("PROFILE: a parent named twice is refused", vcode(req({ depends_on: [ulid(1), ulid(1)] })) === "BAD_BINDING");
  check("PROFILE: a decision_key with a trailing space is refused -- exact, never normalised",
    vcode(req({ decision_key: "face:availability:p15 " })) === "BAD_BINDING" && vcode(req({ decision_key: "face:availability:p15" })) === null);
  check("PROFILE: a near-miss key (dependsOn, Decision-Key) is refused, never ignored",
    vcode(req({ dependsOn: [ulid(1)] })) === "BAD_BINDING" && vcode(req({ "Decision-Key": "a:b:c" })) === "BAD_BINDING");
  // EMIT-side judgment, pure: a cycle A -> B -> A.
  const A = ulid(10), Bid = ulid(11);
  const events = [{ event: { id: Bid, kind: "approval.requested", payload: { depends_on: [A] } } }];
  const cyc = B.parentProblem({ id: A, payload: { depends_on: [Bid] } }, events);
  check("EMIT: a cycle A -> B -> A is refused (PARENT_CYCLE)", cyc !== null && cyc.code === "PARENT_CYCLE", JSON.stringify(cyc));
}

// ── the spine, through the real CLIs ───────────────────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), "face-bind-"));
const spine = join(tmp, "spine");
mkdirSync(join(spine, "events"), { recursive: true });
const env = { ...process.env, ARC_SPINE_ROOT: spine };
delete env.ARC_VENTURES_FILE;
const node = (args, extra = {}) => spawnSync(process.execPath, args, { cwd: REPO, encoding: "utf8", env: { ...env, ...extra }, timeout: 180000, killSignal: "SIGKILL" });
const emit = (payload) => {
  const r = node([join(HQ, "arc-event.mjs"), "emit", "approval.requested", "--payload", JSON.stringify(payload), "--strict"]);
  return { id: String(r.stdout || "").trim().split(/\r?\n/).pop(), status: r.status, err: String(r.stderr || "") };
};
const inbox = (...a) => node([join(HQ, "arc-inbox.mjs"), ...a]);
const lines = () => readdirSync(join(spine, "events")).filter((f) => f.endsWith(".jsonl")).reduce((n, f) => n + readFileSync(join(spine, "events", f), "utf8").split("\n").filter((l) => l !== "").length, 0);
const lineOf = (out, id) => String(out || "").split(/\r?\n/).find((l) => l.startsWith(id)) ?? "";

try {
  const P = emit({ what: "parent", gate: "test" });
  const Ch = emit({ what: "child", gate: "test", depends_on: [P.id] });
  check("PARENT: a parent and its child are raised (vacuous-pass guard)", P.status === 0 && Ch.status === 0 && C.ULID_RE.test(P.id) && C.ULID_RE.test(Ch.id), `${P.err} ${Ch.err}`);
  let r = inbox("inbox");
  check("LINE: inbox prints OPEN only, each line ending in its state", r.status === 0 && lineOf(r.stdout, P.id).endsWith("[OPEN]") && lineOf(r.stdout, Ch.id) === "", r.stdout + r.stderr);
  const eqAll = inbox("inbox", "--all=1");
  check("LINE: --all takes no value -- --all=1 is refused, never read as OPEN-only", eqAll.status === 2 && /--all takes no value/.test(eqAll.stderr), `${eqAll.status} ${eqAll.stderr}`);
  const okAll = inbox("owner-key", "init", "--all");
  check("LINE: --all with any command but inbox is refused before dispatch, owner-key's included", okAll.status === 2 && /--all belongs with inbox/.test(okAll.stderr), `${okAll.status} ${okAll.stderr}`);
  r = inbox("inbox", "--all");
  check("PARENT: an undecided parent -> WAITING(<parent>) in --all", lineOf(r.stdout, Ch.id).endsWith(`[WAITING(${P.id})]`), r.stdout + r.stderr);
  let before = lines();
  r = inbox("approve", Ch.id, "--reason", "too early");
  check("PARENT: approve on a waiting child refuses PARENT_OPEN, zero events written", r.status === 2 && /PARENT_OPEN/.test(r.stderr) && lines() === before, `${r.status} ${r.stderr}`);
  r = inbox("reject", P.id, "--reason", "no");
  check("PARENT: the parent is rejected (fixture step)", r.status === 0, r.stderr);
  r = inbox("inbox", "--all");
  check("PARENT: a rejected parent -> STALE(parent-rejected)", lineOf(r.stdout, Ch.id).endsWith("[STALE(parent-rejected)]"), r.stdout);
  before = lines();
  r = inbox("approve", Ch.id, "--reason", "anyway");
  check("PARENT: approve on a rejected parent's child refuses PARENT_REJECTED, the spine's line count unchanged", r.status === 2 && /PARENT_REJECTED/.test(r.stderr) && lines() === before, `${r.status} ${r.stderr}`);
  const P2 = emit({ what: "parent two", gate: "test" });
  const Ch2 = emit({ what: "child two", gate: "test", depends_on: [P2.id] });
  inbox("approve", P2.id, "--reason", "go");
  r = inbox("inbox");
  check("PARENT: an approved parent -> its child is OPEN", lineOf(r.stdout, Ch2.id).endsWith("[OPEN]"), r.stdout);

  // EMIT refusals against the real spine.
  const decLine = readdirSync(join(spine, "events")).flatMap((f) => readFileSync(join(spine, "events", f), "utf8").split("\n")).find((l) => l.includes("\"decision.recorded\""));
  const decId = decLine ? JSON.parse(decLine).id : "";
  before = lines();
  const toDecision = emit({ what: "x", depends_on: [decId] });
  check("EMIT: a parent that is a decision's ULID is refused (PARENT_NOT_REQUEST), nothing written", toDecision.status !== 0 && /PARENT_NOT_REQUEST/.test(toDecision.err) && lines() === before, toDecision.err);
  const toNowhere = emit({ what: "x", depends_on: [ulid(77)] });
  check("EMIT: a parent not on the spine is refused (PARENT_UNKNOWN)", toNowhere.status !== 0 && /PARENT_UNKNOWN/.test(toNowhere.err), toNowhere.err);

  // KEY
  const K1 = emit({ what: "one", gate: "test", decision_key: "face:bindings:k1" });
  const K2 = emit({ what: "two", gate: "test", decision_key: "face:bindings:k1" });
  r = inbox("inbox", "--all");
  check("KEY: two OPEN requests sharing a key -> the later one is DUPLICATE_OF the earlier",
    lineOf(r.stdout, K1.id).endsWith("[OPEN]") && lineOf(r.stdout, K2.id).endsWith(`[DUPLICATE_OF ${K1.id}]`), r.stdout);
  r = inbox("approve", K2.id, "--reason", "the duplicate decides it");
  const r2 = inbox("inbox", "--all");
  const decK = readdirSync(join(spine, "events")).flatMap((f) => readFileSync(join(spine, "events", f), "utf8").split("\n")).filter((l) => l.includes("\"decision.recorded\"") && (l.includes(K1.id) || l.includes(K2.id)));
  check("KEY: deciding either resolves both -- the sibling reads resolved-by <decision>, one decision.recorded",
    r.status === 0 && decK.length === 1 && lineOf(r2.stdout, K1.id).endsWith(`[resolved-by ${JSON.parse(decK[0]).id}]`), `${r.stderr} ${decK.length} ${r2.stdout}`);
  before = lines();
  r = inbox("reject", K1.id, "--reason", "second decision");
  check("KEY: a second decision on the key is refused (DUPLICATE_DECIDED), nothing written", r.status === 2 && /DUPLICATE_DECIDED/.test(r.stderr) && lines() === before, r.stderr);

  // BOUND -- a real work-door plan, money.ingest, over a copy of a fixture export.
  const exp = join(tmp, "settle.csv");
  copyFileSync(join(REPO, "tests", "fixtures", "ledger", "razorpay", "01-good-multi-row.csv"), exp);
  const plan = () => {
    const p = node([join(HQ, "ledger-ingest.mjs"), "--export", `razorpay=${exp}`, "--venture", "lexos", "--dry-run"]);
    const last = String(p.stdout || "").trim().split(/\r?\n/).pop() ?? "";
    try { return JSON.parse(last).expect; } catch { return `none:${p.status}:${String(p.stderr).slice(0, 200)}`; }
  };
  const D = plan();
  check("BOUND: the plan prints a digest (vacuous-pass guard)", /^[0-9a-f]{64}$/.test(D), D);
  const bound = { kind: "plan-expect", expect: D, op: "money.ingest", input: { provider: "razorpay", export: exp, venture: "lexos" } };
  const Bq = emit({ what: "bound", gate: "test", bound_to: bound });
  const snap = () => {
    const out = [];
    const walk = (d) => { for (const n of readdirSync(d).sort()) { const p = join(d, n); const s = statSync(p); if (s.isDirectory()) walk(p); else out.push(`${p}|${s.size}|${createHash("sha256").update(readFileSync(p)).digest("hex")}`); } };
    walk(tmp);
    return out.join("\n");
  };
  const s0 = snap();
  r = inbox("inbox", "--all");
  const s1 = snap();
  check("BOUND: while the plan holds the bound request reads OPEN", Bq.status === 0 && lineOf(r.stdout, Bq.id).endsWith("[OPEN]"), `${Bq.err} ${r.stdout} ${r.stderr}`);
  check("BOUND: the re-derive wrote nothing -- the spine, the export and every lock are byte-identical before and after", s0 === s1 && s0.length > 0);
  copyFileSync(join(REPO, "tests", "fixtures", "ledger", "razorpay", "02-crlf-bom.csv"), exp);
  r = inbox("inbox", "--all");
  check("BOUND: once the plan moves the request reads STALE(plan-moved)", lineOf(r.stdout, Bq.id).endsWith("[STALE(plan-moved)]"), r.stdout + r.stderr);
  before = lines();
  r = inbox("approve", Bq.id, "--reason", "approve the moved plan");
  check("BOUND: approve refuses PLAN_STALE, the apply's own code, nothing written", r.status === 2 && /PLAN_STALE/.test(r.stderr) && lines() === before, r.stderr);
  const D2 = plan();
  const Bq2 = emit({ what: "bound two", gate: "test", bound_to: { ...bound, expect: D2 } });
  r = inbox("approve", Bq2.id, "--reason", "the plan as it stands");
  copyFileSync(join(REPO, "tests", "fixtures", "ledger", "razorpay", "01-good-multi-row.csv"), exp);
  const r3 = inbox("inbox", "--all");
  check("BOUND: an approved request whose plan moved reads approved · stale · re-plan needed in the decided view",
    r.status === 0 && lineOf(r3.stdout, Bq2.id).endsWith("[approved · stale · re-plan needed]"), `${r.stderr} ${r3.stdout}`);
  const Bq3 = emit({ what: "bound to nothing", gate: "test", bound_to: { ...bound, op: "money.no-such-op" } });
  r = inbox("inbox", "--all");
  check("BOUND: a binding that cannot be evaluated reads UNKNOWN(<class>), never OPEN", lineOf(r.stdout, Bq3.id).endsWith("[UNKNOWN(UNKNOWN_OP)]"), r.stdout);

  // Rebuild: the inbox reads the log, so a wiped derived index changes nothing.
  const a1 = inbox("inbox", "--all").stdout;
  rmSync(join(spine, "derived"), { recursive: true, force: true });
  const a2 = inbox("inbox", "--all").stdout;
  check("REBUILD: a wiped derived index gives a byte-identical inbox", a1 === a2 && a1.length > 0);
} finally {
  try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN could not remove ${tmp}: ${e && e.code}`); }
}

// ── REPLAY (ADR-1305): the fold over a day-cut prefix ───────────────────────────────────────────────
{
  const I = await import(pathToFileURL(join(HQ, "arc-inbox.mjs")).href);
  const P = ulid(1), Ch = ulid(2), D = ulid(3);
  const requested = [{ event: { id: P, kind: "approval.requested", venture: "arc", payload: {} }, day: "2026-10-01" }, { event: { id: Ch, kind: "approval.requested", venture: "arc", payload: { depends_on: [P] } }, day: "2026-10-01" }];
  const decided = [{ event: { id: D, kind: "decision.recorded", venture: "arc", payload: { decides: P, verdict: "approve", reason: "x" } }, day: "2026-10-02" }];
  const at = async (day) => (await F.foldApprovals(I.cutToDay(requested, day), I.cutToDay(decided, day))).find((f) => f.id === Ch).label;
  const w1 = await at("2026-10-01"), w1b = await at("2026-10-01"), o2 = await at("2026-10-02");
  check("REPLAY: as of the first day the child is WAITING, twice byte-identical; as of the parent's decision it is OPEN",
    w1 === `WAITING(${P})` && w1 === w1b && o2 === "OPEN", `${w1} ${o2}`);
  // attack 4f462e9 B7: a parent entry that is not a ULID is never echoed -- it reads PARENT_MISSING with no ref text.
  const forged = await F.foldApprovals([{ event: { id: ulid(6), kind: "approval.requested", venture: "arc", payload: { depends_on: ["X\u001b[2J\nFAKE"] } }, day: "d" }], []);
  check("FOLD: a parent entry that is not a ULID reads UNKNOWN(PARENT_MISSING) and echoes nothing", forged[0].label === "UNKNOWN(PARENT_MISSING)" && forged[0].ref === "", JSON.stringify(forged[0].label + "|" + forged[0].ref));
  // B2: a decide re-derives only its own request; every other bound request answers NOT_REDERIVED without a plan run.
  const ps = I.planStateFor({ only: ulid(7) });
  const other = await ps({ op: "money.ingest", input: {}, expect: "d".repeat(64) }, { event: { id: ulid(8) } });
  check("FOLD: a decide's planState re-derives only the request being decided", other && other.failure === "NOT_REDERIVED", JSON.stringify(other));
  // round 2 B6: a relative path in a bound plan's input is refused before any plan runs.
  const rel = await I.planStateOf({ op: "money.ingest", input: { provider: "razorpay", export: "some/dir/x.csv", venture: "lexos" }, expect: "e".repeat(64) });
  check("FOLD: a bound plan reading a relative path is UNKNOWN(RELATIVE_PATH), never re-derived", rel && rel.failure === "RELATIVE_PATH", JSON.stringify(rel));
  const unbound = await F.foldApprovals([{ event: { id: ulid(5), kind: "approval.requested", venture: "arc", payload: { bound_to: { kind: "plan-expect", expect: "c".repeat(64), op: "a.b", input: {} } } }, day: "d" }], []);
  check("REPLAY: a bound request folded with no re-deriver (an as-of read) is UNKNOWN(NOT_REDERIVED), never OPEN", unbound[0].label === "UNKNOWN(NOT_REDERIVED)", unbound[0].label);
}

// ── FACE: the Inbox room draws the door's fold ─────────────────────────────────────────────────────
{
  const rooms = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const MOD = join(REPO, "face", "src", "modules", "command", "inbox");
  const fold = (await import(pathToFileURL(join(MOD, "fold.mjs")).href)).fold;
  const manifest = (await import(pathToFileURL(join(MOD, "module.mjs")).href)).default;
  const reg = await import(pathToFileURL(join(REPO, "face", "src", "lib", "registry.mjs")).href);
  const item = (n, state, label) => ({ id: ulid(n), day: "2026-10-13", ts: "2026-10-13 10:00 IST", venture: "arc", what: `w${n}`, gate: "test", payload: {}, state, label, ref: "", failure: state === "UNKNOWN" ? "UNKNOWN_OP" : "" });
  const body = { mode: "sim", asof: null, openCount: 1, heldCount: 4, decidedCount: 0, open: [item(1, "OPEN", "OPEN"), item(2, "WAITING", `WAITING(${ulid(1)})`), item(3, "STALE", "STALE(plan-moved)"), item(4, "DUPLICATE_OF", `DUPLICATE_OF ${ulid(1)}`), item(5, "UNKNOWN", "UNKNOWN(UNKNOWN_OP)")] };
  const ctx = (picks) => ({ room: rooms.rooms.find((r) => r.id === "inbox"), rooms: rooms.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: rooms.inventories, laneMap: undefined, picks, manifest });
  const payloads = (picks) => {
    const first = fold({}, ctx(picks));
    const out = Object.create(null);
    for (const r of reg.plannedReads(first, manifest).reads) if (r.route === "/api/inbox") out[r.key] = { state: "ok", data: body };
    return out;
  };
  const f = fold(payloads({}), ctx({}));
  const cards = f.waiting.cards;
  check("FACE: the five states are drawn as five badges from the door's fold", cards.map((c) => c.badge).join(",") === "open,waiting,stale,duplicate,unknown", cards.map((c) => c.badge).join(","));
  check("FACE: approve arms only the OPEN card; reject arms any card in a named state", cards.map((c) => c.canArm).join(",") === "true,false,false,false,false" && cards.every((c) => c.canReject));
  check("FACE: an unevaluable binding is REQ-19's unknown; the rest are served", cards.map((c) => c.availability).join(",") === "served,served,served,served,unknown", cards.map((c) => c.availability).join(","));
  const armedWaiting = fold(payloads({ armed: `${ulid(2)}|approve` }), ctx({ armed: `${ulid(2)}|approve` }));
  check("FACE: arming approve on a WAITING card arms nothing", armedWaiting.waiting.cards.every((c) => !c.isArmed) && !armedWaiting.armed.canStamp);
  const noState = fold({ ...payloads({}) }, ctx({}));
  check("FACE: the waiting KPI counts OPEN only (openCount), not the held cards", noState.kpis[0].v === "1", noState.kpis[0].v);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
