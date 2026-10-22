#!/usr/bin/env node
// availability.mjs -- the five-state availability, branch by branch (face v2 Phase 15, REQ-19, ADR-1354).
//
// What it proves, each check failing when the decision it names is removed:
//   ENUM      one enum of five states; a state outside it is a programming error, never drawn
//   THROW     a fake adapter that throws is `unknown` with its class, never 0 -- and a MUTANT that maps a throw to 0 is
//             caught by the same check; a declared not-applicable stays not-applicable under a throw
//   TABLE     a served table in flight or refused is `unknown`, answered with no row is `zero`, with rows `served`
//   NOT SERVED a panel the door cannot fill is not-instrumented (or declared not-applicable) and names source and owner
//   FOLDS     every module folded with nothing loaded names a valid state and a source for every field it draws
//   COUNTS    a fold with 2 unknown and 1 not-instrumented field reads 2 and 1 in the header's counts
//   LINT      face-pure's availability arm FAILs a module that spells a state itself
//   FIELD_UNKNOWN  money.ingest and ventures.kill-review refuse FIELD_UNKNOWN on an unreadable ventures.yaml, with no
//             tool run and no event; ventures.register and the money ops that read no such field are not gated
//   REPLAY    two folds of one recorded payload set give byte-identical states (ADR-1305)
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is "RAN: <n> checks, <f> failed", and
// the bats wrapper FAILs below its own floor and on any missing arm.
import { mkdtempSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const throwsCode = (fn) => { try { fn(); return null; } catch (e) { return e && (e.code || e.name); } };

const av = await import(pathToFileURL(join(LIB, "availability.mjs")).href);
const reg = await import(pathToFileURL(join(LIB, "registry.mjs")).href);
const served = await import(pathToFileURL(join(LIB, "served.mjs")).href);
const pure = await import(pathToFileURL(join(REPO, ".claude", "scripts", "core", "face-pure.mjs")).href);
const cov = await import(pathToFileURL(join(REPO, ".claude", "scripts", "core", "face-coverage.mjs")).href);
check("availability.mjs, registry.mjs, served.mjs, face-pure and face-coverage loaded (vacuous-pass guard)",
  typeof av.availabilityField === "function" && typeof av.stateOfAdapter === "function" && typeof reg.availabilityOf === "function"
  && typeof served.servedTable === "function" && typeof pure.scanAvailabilityLiterals === "function" && typeof cov.availabilityFindings === "function");

// ── ENUM ───────────────────────────────────────────────────────────────────────────────────────────
check("ENUM: exactly five states, in the order the spec names them",
  JSON.stringify(av.STATES) === JSON.stringify(["served", "zero", "unknown", "not-applicable", "not-instrumented"]), JSON.stringify(av.STATES));
check("ENUM: a state outside the five is a TypeError, never drawn", throwsCode(() => av.availabilityField({ availability: "missing" })) === "TypeError");
check("ENUM: an unknown field with no failure class says UNSTATED, never nothing",
  av.availabilityField({ availability: av.Availability.UNKNOWN, source: "GET /api/x" }).failure === "UNSTATED");
check("ENUM: only an unknown field carries a failure class",
  av.availabilityField({ availability: av.Availability.ZERO, source: "s", failure: "ENOENT" }).failure === "");

// ── THROW (the spec's fake adapter, and the mutant that maps a throw to 0) ──────────────────────────
const throwing = () => { const e = new Error("the source is gone"); e.code = "ENOENT"; throw e; };
/** The decision under test: a throw is unknown with its class, and never 0. */
const throwIsUnknown = (impl) => {
  const r = impl(null, throwing);
  return r.availability === "unknown" && r.failure === "ENOENT" && r.value !== 0;
};
check("THROW: a fake adapter that throws maps to unknown with its failure class, never to 0", throwIsUnknown(av.stateOfAdapter), JSON.stringify(av.stateOfAdapter(null, throwing)));
const mutantToZero = (declared, read) => { try { return av.stateOfAdapter(declared, read); } catch { return { availability: "zero", failure: "", value: 0 }; } };
const mutantSwallow = (declared, read) => { let v; try { v = read(); } catch { v = 0; } return av.stateOfAdapter(declared, () => v); };
check("THROW MUTANT: an adapter mapping a throw to 0 is FAILED by the same check", !throwIsUnknown(mutantSwallow) && throwIsUnknown(av.stateOfAdapter), JSON.stringify(mutantSwallow(null, throwing)));
check("THROW MUTANT: the control is not vacuous (a wrapper that never throws stays correct)", throwIsUnknown(mutantToZero));
check("THROW: a declared not-applicable stays not-applicable when its adapter throws",
  av.stateOfAdapter(av.Availability.NOT_APPLICABLE, throwing).availability === "not-applicable");
check("THROW: a declared not-instrumented stays not-instrumented when its adapter throws",
  av.stateOfAdapter(av.Availability.NOT_INSTRUMENTED, throwing).availability === "not-instrumented");
check("THROW: an adapter answering nothing is unknown NO_ANSWER, not zero",
  av.stateOfAdapter(null, () => undefined).availability === "unknown" && av.stateOfAdapter(null, () => NaN).failure === "NO_ANSWER");
check("THROW: an adapter answering 0 or an empty list is zero; answering rows is served",
  av.stateOfAdapter(null, () => 0).availability === "zero" && av.stateOfAdapter(null, () => []).availability === "zero" && av.stateOfAdapter(null, () => [1]).availability === "served");

// ── TABLE ──────────────────────────────────────────────────────────────────────────────────────────
const spec = { panel: "P", route: "/api/x", columns: ["a"], listKey: "rows", empty: "none", row: (r) => ({ key: String(r.a), cells: [String(r.a)] }) };
const reading = { isReading: true, isRefused: false, refusal: { code: "", human: "" }, isRead: false, body: {}, source: "" };
const refusedSt = { isReading: false, isRefused: true, refusal: { code: "FORBIDDEN", human: "no" }, isRead: false, body: {}, source: "" };
const readSt = (rows) => ({ isReading: false, isRefused: false, refusal: { code: "", human: "" }, isRead: true, body: { route: "/api/x", rows }, source: "" });
const t1 = served.servedTable(reading, spec), t2 = served.servedTable(refusedSt, spec), t3 = served.servedTable(readSt([]), spec), t4 = served.servedTable(readSt([{ a: 1 }]), spec);
check("TABLE: a read in flight is unknown PENDING -- not yet known is not zero", t1.avail.availability === "unknown" && t1.avail.failure === "PENDING", JSON.stringify(t1.avail));
check("TABLE: a refused read is unknown with the refusal's code", t2.avail.availability === "unknown" && t2.avail.failure === "FORBIDDEN", JSON.stringify(t2.avail));
check("TABLE: answered with no row is zero", t3.avail.availability === "zero", JSON.stringify(t3.avail));
check("TABLE: answered with rows is served", t4.avail.availability === "served", JSON.stringify(t4.avail));
check("TABLE: a body with no list is unknown BAD_BODY, never zero",
  served.servedTable({ ...readSt([]), body: { route: "/api/x" } }, spec).avail.failure === "BAD_BODY");
check("TABLE: every table names its route as its source", [t1, t2, t3, t4].every((t) => t.avail.source === "GET /api/x"));

// ── NOT SERVED ─────────────────────────────────────────────────────────────────────────────────────
const ns = reg.notServed("Panel", "/api/y", "what it would show", { owner: "ledger" });
check("NOT SERVED: defaults to not-instrumented, names its route as source and its owner lane",
  ns.avail.availability === "not-instrumented" && ns.avail.source === "GET /api/y" && ns.avail.owner_lane === "ledger" && ns.isNotServed === true, JSON.stringify(ns));
check("NOT SERVED: a declared not-applicable is kept",
  reg.notServed("P", "/api/y", "s", { owner: "x", state: "not-applicable" }).avail.availability === "not-applicable");
check("NOT SERVED: served, zero and unknown are refused -- they are states of a read, and this panel makes none",
  ["served", "zero", "unknown"].every((st) => throwsCode(() => reg.notServed("P", "/api/y", "s", { owner: "x", state: st })) === "TypeError"));

// ── FOLDS (the coverage walker over the real tree) ─────────────────────────────────────────────────
{
  const tree = await cov.treeAvailability(REPO);
  const half = cov.availabilityFindings(tree);
  const folded = Array.isArray(tree.modules) ? tree.modules.filter((m) => m.error === undefined).length : 0;
  check("FOLDS: every module folds with nothing loaded and names a valid state and a source for every field (zero findings)",
    !tree.unreadable && folded >= 36 && half.fields > 0 && half.findings.length === 0, `folded=${folded} fields=${half.fields} ${half.findings.slice(0, 3).join(" | ")}`);
  const ns15 = tree.modules.flatMap((m) => m.notServed || []);
  check("FOLDS: every NOT SERVED panel on the tree is not-instrumented or not-applicable and names an owner lane",
    ns15.length >= 15 && ns15.every((n) => ["not-instrumented", "not-applicable"].includes(n.avail.availability) && n.avail.owner_lane !== ""), `n=${ns15.length}`);
  // round 2 B1/B2/B3: a finding's text is one line, with the checkout's path withheld in every spelling.
  {
    const BS = String.fromCharCode(92);
    const repoW = ["C:", "x", "repo"].join(BS);
    const msgs = ["C:/x/repo/a.mjs", [repoW, "a.mjs"].join(BS), "file:///C:/x/repo/a.mjs"];
    check("FOLDS: a thrown message has the checkout path withheld in either separator and as a file URL",
      msgs.every((m) => { const o = cov.withholdPath(m, repoW).toLowerCase(); return o.includes("<repo>") && !o.includes("x/repo") && !o.includes(["x", "repo"].join(BS)); }), msgs.map((m) => cov.withholdPath(m, repoW)).join(" | "));
    const NL = String.fromCharCode(10);
    const forged = { states: tree.states, modules: [{ key: "x/y", fields: [], notServed: [{ panel: "P" + NL + "FAIL forged", route: "/api/x", sentence: "s", avail: { isAvailability: true, owner_lane: "" } }] }] };
    const fs1 = cov.availabilityFindings(forged).findings;
    check("FOLDS: a panel name carrying a newline cannot forge a finding line", fs1.length === 1 && fs1.every((f) => !f.includes(NL)), JSON.stringify(fs1));
  }
  const first = tree.modules.find((m) => m.error === undefined && m.fields.length > 0);
  const mutant = { ...tree, modules: tree.modules.map((m) => (m === first ? { ...m, fields: m.fields.map((f, i) => (i === 0 ? { ...f, source: "" } : f)) } : m)) };
  check("FOLDS MUTANT: a field with no source FAILs the walker", cov.availabilityFindings(mutant).findings.some((f) => f.includes("names no source")));
}

// ── COUNTS ─────────────────────────────────────────────────────────────────────────────────────────
{
  const folded = {
    a: served.servedTable(reading, spec),
    b: { nested: [served.servedTable(refusedSt, spec)] },
    c: reg.notServed("Q", "/api/q", "s", { owner: "plan" }),
    d: served.servedTable(readSt([{ a: 1 }]), spec),
    e: reg.notServed("R", "/api/r", "s", { owner: "plan", state: "not-applicable" }),
  };
  const c = reg.availabilityCountsOf(folded);
  check("COUNTS: 2 unknown + 1 not-instrumented read 2 and 1 in the header (served and not-applicable counted in neither)",
    c.unknown === 2 && c.notInstrumented === 1, JSON.stringify(c));
  check("COUNTS: a fold with nothing to count reads 0 and 0, which the header draws as nothing", JSON.stringify(reg.availabilityCountsOf({ x: 1 })) === JSON.stringify({ unknown: 0, notInstrumented: 0 }));
}

// ── LINT ───────────────────────────────────────────────────────────────────────────────────────────
{
  const kinds = (src) => pure.scanAvailabilityLiterals(src, "fold.mjs").map((f) => f.kind);
  check("LINT: a module spelling not-instrumented in a string FAILs", kinds(`const s = "not-instrumented";`).includes("availability-literal"));
  check("LINT: a module spelling not-applicable in a template FAILs", kinds("const s = `not-applicable`;").includes("availability-literal"));
  check("LINT: a literal given to an availability key FAILs", kinds(`const f = { availability: "served" };`).includes("availability-literal")
    && kinds(`const f = { "availability": "zero" };`).includes("availability-literal"));
  // attack c0fc549 B7: the raw token, a `+` join and an assignment each hid a typed state from the first scan.
  check("LINT: an escaped spelling, a + join and an assignment each FAIL", kinds(String.raw`const s = "not\u002dinstrumented";`).includes("availability-literal")
    && kinds(`const s = "not-" + "applicable";`).includes("availability-literal")
    && kinds(`x.availability = "served";`).includes("availability-literal") && kinds("x[\"availability\"] = `zero`;").includes("availability-literal"));
  // round 2 B4: a literal one token deeper -- a ternary, parentheses -- is the same typed state.
  check("LINT: a literal inside a ternary or parentheses given to availability FAILs", kinds(`const f = { availability: ok ? "served" : "zero" };`).includes("availability-literal")
    && kinds(`x.availability = ("served");`).includes("availability-literal"));
  check("LINT: a long + chain of literals is judged in linear time", (() => { const t = Date.now(); kinds("const s = " + Array(20000).fill('"a"').join(" + ") + ";"); return Date.now() - t < 5000; })());
  check("LINT: a module taking its state from the enum passes", kinds(`import { Availability } from "../../../lib/availability.mjs"; const f = { availability: Availability.ZERO };`).length === 0);
  check("LINT: the real module tree passes", (() => { const r = pure.lintModules(join(REPO, "face", "src", "modules"), { base: REPO }); return r.modules >= 36 && r.findings.filter((f) => f.kind === "availability-literal").length === 0; })());
}

// ── FIELD_UNKNOWN ──────────────────────────────────────────────────────────────────────────────────
{
  const tmp = mkdtempSync(join(tmpdir(), "face-avail-"));
  try {
    // A child process, so ARC_VENTURES_FILE reaches face-ops exactly as the door's environment would carry it.
    const probe = join(HERE, "availability-probe.mjs");
    const spine = join(tmp, "spine");
    const run = (venturesFile) => spawnSync(process.execPath, [probe], {
      cwd: REPO, encoding: "utf8", timeout: 120000, killSignal: "SIGKILL",
      env: { ...process.env, ARC_VENTURES_FILE: venturesFile, ARC_SPINE_ROOT: spine },
    });
    const missing = run(join(tmp, "no-such-ventures.yaml"));
    let out = null;
    try { out = JSON.parse(missing.stdout.trim().split(/\r?\n/).pop()); } catch { /* checked below */ }
    // Bounded: a probe that never exits names itself here rather than hanging the shard (attack c0fc549 B4).
    check("FIELD_UNKNOWN: the probe ran and answered (vacuous-pass guard)", !missing.error && missing.status === 0 && out !== null, `${missing.error ? missing.error.code : ""} ${missing.status} ${missing.stderr}`);
    if (out !== null) {
      check("FIELD_UNKNOWN: the gated ops are exactly the ones whose fields name an existing thing (Phase 15 + Cycle 17 P01)", JSON.stringify(out.gated) === JSON.stringify(["leads.daily-send", "legal.full-read", "money.close-month", "money.ingest", "org.seat-assign", "ventures.kill-review"]), JSON.stringify(out.gated));
      for (const id of ["money.ingest", "ventures.kill-review"]) {
        const r = out.results[id];
        check(`FIELD_UNKNOWN: ${id} planned against an unreadable ventures.yaml refuses FIELD_UNKNOWN (status ${409}), and no tool ran`,
          r && r.code === "FIELD_UNKNOWN" && r.status === 409 && r.ran === false && /ENOENT/.test(r.message), JSON.stringify(r));
      }
      check("FIELD_UNKNOWN: ventures.register reads no such field and is not gated", out.results["ventures.register"].code !== "FIELD_UNKNOWN", JSON.stringify(out.results["ventures.register"]));
    }
    check("FIELD_UNKNOWN: no event was written -- the spine directory was never created", !existsSync(spine) || readdirSync(spine).length === 0);
    const good = run(join(REPO, "ventures.yaml"));
    let gout = null;
    try { gout = JSON.parse(good.stdout.trim().split(/\r?\n/).pop()); } catch { /* checked below */ }
    check("FIELD_UNKNOWN control: with a readable ventures.yaml neither op refuses FIELD_UNKNOWN",
      !good.error && gout !== null && ["money.ingest", "ventures.kill-review"].every((id) => gout.results[id].code !== "FIELD_UNKNOWN"), `${good.error ? good.error.code : ""} ${good.status} ${String(good.stdout ?? "").slice(-400)}`);
  } finally {
    // A cleanup that fails is said, never thrown past the RAN line (attack c0fc549 B3).
    try { rmSync(tmp, { recursive: true, force: true }); } catch (e) { console.log(`WARN could not remove ${tmp}: ${e && e.code}`); }
  }
}

// ── REPLAY (ADR-1305) ──────────────────────────────────────────────────────────────────────────────
{
  const MODULES = join(REPO, "face", "src", "modules", "money");
  const rooms = JSON.parse((await import("node:fs")).readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
  const fold = (await import(pathToFileURL(join(MODULES, "money", "fold.mjs")).href)).fold;
  const manifest = (await import(pathToFileURL(join(MODULES, "money", "module.mjs")).href)).default;
  const ctx = { room: rooms.rooms.find((r) => r.id === "money"), rooms: rooms.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: rooms.inventories, laneMap: undefined, picks: {}, manifest };
  // One spine prefix, as the door answers an as-of read of it: the first read refused, the rest still in flight.
  const first = fold({}, ctx);
  const recorded = Object.create(null);
  reg.plannedReads(first, manifest).reads.forEach((r, i) => {
    recorded[r.key] = i === 0 ? { state: "refused", code: "NO_SPINE", human: "the as-of day has no spine file" } : { state: "pending" };
  });
  const a = JSON.stringify(reg.availabilityOf(fold(recorded, ctx)));
  const b = JSON.stringify(reg.availabilityOf(fold(JSON.parse(JSON.stringify(recorded)), ctx)));
  check("REPLAY: two replays of one spine prefix give byte-identical states", a === b && a.length > 2 && a.includes("\"unknown\""), a.slice(0, 200));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 ? 0 : 1;
