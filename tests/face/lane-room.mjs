#!/usr/bin/env node
// lane-room.mjs -- what the shared lane-room fold ANSWERS over a loaded page (face v2 Phase 03, money
// ring; the factory ring's debt-ledger row, paid).
//
// tests/face/module-frame.mjs proves the SHAPE of every fold: it runs, its reads are declared, its NOT
// SERVED and work-door lists match the evidence. It folds with `{}` only, so every `state: "ok"` branch
// the kernel and factory attackers made -- BAD_BODY, WRONG_LANE, WRONG_FILE, WRONG_KINDS, the partial
// page's `+`, the unread `—`, "time unreadable", the meter drawn only for a measured burn -- had no
// negative control, and seven mutants of the toolbelt's fold survived every gate. This suite folds
// face/src/lib/lane-room.mjs over loaded payloads, branch by branch, and runs the toolbelt checks
// against those seven mutants: each must FAIL here, or the checks measure nothing.
//
// Also held here, because they are the same file's answers: a read the module's manifest cannot make is
// refused by the shared fold with the host's own rule (registry.readProblem) instead of being planned and
// dropped; the catalogue is built in ONE pass over the rooms; and the lane card no longer says a thing
// twice (the factory ring's shot review).
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is
// "RAN: <n> checks, <f> failed", and the suite FAILs below its own floor.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");
const TOOLBELT = join(REPO, "face", "src", "modules", "factory", "toolbelt", "fold.mjs");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const lr = await import(pathToFileURL(join(LIB, "lane-room.mjs")).href);
const reg = await import(pathToFileURL(join(LIB, "registry.mjs")).href);
const spine = await import(pathToFileURL(join(LIB, "spine.mjs")).href);
check("lane-room.mjs, registry.mjs and spine.mjs loaded with the exports this suite folds (vacuous-pass guard)",
  ["laneRoom", "kindCount", "hasKind", "countedOn", "runsBy", "laneBadge", "laneKpi", "heldAcrossRooms", "holdsCount", "roomLink", "sourceFile", "catalogueOf"]
    .every((k) => typeof lr[k] === "function") && typeof reg.readKey === "function" && typeof spine.laneCard === "function",
  Object.keys(lr).join(","));

// ── fixtures ────────────────────────────────────────────────────────────────────────────────────────
const MANIFEST = Object.freeze({ id: "bench", ring: "kernel", routes: ["/api/lane/:id", "/api/spine", "/api/file/:id"], asOf: true });
const room = (over = {}) => ({ id: "bench", name: "Bench", ring: "kernel", status: "built", sentence: "Drivers are compared, never trusted.", lede: "scored runs", holds: { kinds: ["run.completed", "promotion.proposed"], lanes: ["bench"], concepts: ["scorecard"], adrs: ["0900"] }, ...over });
const ctxFor = (r, over = {}) => ({ room: r, rooms: [r], mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: null, laneMap: undefined, picks: {}, manifest: MANIFEST, ...over });
const ev = (id, kind, ts, payload = {}, outcome = "") => ({ day: String(ts).slice(0, 10), seq: 1, event: { id, ts, kind, venture: "arc", actor: "sim", outcome, payload } });
const laneBody = (lane, header = {}, phases = []) => ({ lane, header: { status: "LIVE", phase: "03", appetite: "10d", burn: "4d", ...header }, phases, phasesOmitted: 0 });

/** Fold once to learn the reads, then again with each read answered by `answer(read)`. */
const foldLoaded = (r, answer, over = {}, opts = {}) => {
  const ctx = ctxFor(r, over);
  const first = lr.laneRoom({}, ctx, opts);
  const payloads = Object.create(null);
  for (const read of first.reads) {
    const p = answer(read);
    if (p !== undefined) payloads[reg.readKey(read)] = p;
  }
  return { first, base: lr.laneRoom(payloads, ctx, opts) };
};
const ok = (data) => ({ state: "ok", data });
const byRoute = (map) => (read) => (Object.hasOwn(map, read.route) ? map[read.route] : undefined);

// ── the lane ────────────────────────────────────────────────────────────────────────────────────────
{
  const { first, base } = foldLoaded(room(), byRoute({ "/api/lane/:id": ok(laneBody("bench")), "/api/spine": ok({ count: 0, more: false, events: [] }) }));
  check("LANE: the fold asks the door for its lane by name and for its trail by kind", first.reads.some((r) => r.route === "/api/lane/:id" && r.param === "bench") && first.reads.some((r) => r.route === "/api/spine"), JSON.stringify(first.reads));
  check("LANE: before any answer the lane reads as reading, never as refused", first.lane.isReading === true && first.lane.isRefused === false);
  check("LANE: a lane body the door served is drawn, with its header's status", base.lane.isDrawn === true && base.lane.card.isRead === true && base.lane.card.status === "LIVE", JSON.stringify(base.lane));
  check("LANE: the badge and the strip read the same status", lr.laneBadge(base) === "bench lane · LIVE" && lr.laneKpi(base).v === "LIVE", `${lr.laneBadge(base)} / ${lr.laneKpi(base).v}`);
}
{
  const { base } = foldLoaded(room(), byRoute({ "/api/lane/:id": ok({ header: {} }) }));
  check("LANE BAD_BODY: a 200 with no lane name is a refusal with a code, never 'reading' for ever", base.lane.isRefused === true && base.lane.refusal.code === "BAD_BODY" && base.lane.isReading === false, JSON.stringify(base.lane.refusal));
  check("LANE BAD_BODY: the strip reads unread and names the code", lr.laneKpi(base).v === "—" && lr.laneKpi(base).sub === "BAD_BODY", JSON.stringify(lr.laneKpi(base)));
}
{
  const { base } = foldLoaded(room(), byRoute({ "/api/lane/:id": ok(laneBody("growth", { status: "BLOCKED" })) }));
  check("LANE WRONG_LANE: another lane's body is refused by name", base.lane.isRefused === true && base.lane.refusal.code === "WRONG_LANE" && /growth/.test(base.lane.refusal.human), JSON.stringify(base.lane.refusal));
  check("LANE WRONG_LANE: the strip asks isRefused FIRST and never draws the other lane's status", lr.laneKpi(base).v === "—" && lr.laneKpi(base).sub === "WRONG_LANE" && lr.laneBadge(base) === "bench lane · not read", `${JSON.stringify(lr.laneKpi(base))} / ${lr.laneBadge(base)}`);
}
{
  const { first } = foldLoaded(room({ holds: { kinds: ["run.completed"] } }), () => undefined);
  check("NO LANE: a room the registry gives no lane asks for none and says so, never as a refusal",
    first.hasLane === false && first.lane.isRefused === false && first.lane.absent !== "" && !first.reads.some((r) => r.route === "/api/lane/:id") && lr.laneKpi(first).sub === first.laneAbsent, JSON.stringify(first.lane));
}
{
  const { first } = foldLoaded(room({ holds: { lanes: ["Bench Lane"], kinds: [] } }), () => undefined);
  check("BAD_LANE_NAME: a lane name the door will not take is refused and never asked for",
    first.lane.isRefused === true && first.lane.refusal.code === "BAD_LANE_NAME" && !first.reads.some((r) => r.route === "/api/lane/:id"), JSON.stringify(first.lane.refusal));
}
{
  const { base } = foldLoaded(room({ holds: { lanes: ["bench", "evolve"], kinds: [] } }), byRoute({ "/api/lane/:id": ok(laneBody("bench")) }));
  check("TWO LANES: a second lane the card does not draw is named", /2 lanes/.test(base.lane.note) && /evolve/.test(base.lane.note), base.lane.note);
}

// ── the trail ───────────────────────────────────────────────────────────────────────────────────────
{
  const page = { count: 5, more: true, events: [ev("01K1", "run.completed", "2026-09-17T08:00:00+05:30", { driver: "sonnet" }), ev("01K2", "promotion.proposed", "2026-09-17T09:00:00+05:30")] };
  const { base } = foldLoaded(room(), byRoute({ "/api/lane/:id": ok(laneBody("bench")), "/api/spine": ok(page) }));
  check("TRAIL PARTIAL: a page the door says has more past it is partial", base.trail.isPartial === true && base.trail.isDrawn === true, JSON.stringify({ isPartial: base.trail.isPartial, isDrawn: base.trail.isDrawn }));
  check("TRAIL PARTIAL: a figure counted on it carries its + and says the page is the oldest", lr.kindCount(base, "run.completed") === "1+" && /more past it/.test(lr.countedOn(base, "run.completed")), `${lr.kindCount(base, "run.completed")} / ${lr.countedOn(base, "run.completed")}`);
}
{
  const page = { count: 4, more: false, events: [ev("01K1", "run.completed", "2026-09-17T08:00:00+05:30")] };
  const { base } = foldLoaded(room(), byRoute({ "/api/spine": ok(page) }));
  check("TRAIL PARTIAL: a count larger than the page it came with is partial even when more is false", base.trail.isPartial === true && lr.kindCount(base, "run.completed") === "1+", String(lr.kindCount(base, "run.completed")));
}
{
  const page = { count: 1, more: false, events: [ev("01K1", "run.completed", "2026-09-17T08:00:00+05:30")] };
  const { base } = foldLoaded(room(), byRoute({ "/api/spine": ok(page) }));
  check("TRAIL WHOLE: a whole page counts without a + and names the page it counted", base.trail.isPartial === false && lr.kindCount(base, "run.completed") === "1" && /the page the door sent/.test(lr.countedOn(base, "run.completed")), lr.countedOn(base, "run.completed"));
  check("UNREAD: a kind the registry does not home here was never asked for, so it reads — and never 0", lr.kindCount(base, "deal.won") === "—" && lr.hasKind(base, "deal.won") === false);
}
{
  const { base } = foldLoaded(room(), byRoute({ "/api/spine": ok({ count: 0 }) }));
  check("TRAIL BAD_BODY: a page with no events list is refused, not drawn as an empty trail", base.trail.isRefused === true && base.trail.refusal.code === "BAD_BODY" && base.trail.showEmpty === false && lr.kindCount(base, "run.completed") === "—", JSON.stringify(base.trail.refusal));
}
{
  const page = { count: 1, more: false, events: [ev("01K1", "deal.won", "2026-09-17T08:00:00+05:30")] };
  const { base } = foldLoaded(room(), byRoute({ "/api/spine": ok(page) }));
  check("TRAIL WRONG_KINDS: a page carrying a kind this room never asked for is not its trail", base.trail.isRefused === true && base.trail.refusal.code === "WRONG_KINDS" && /deal\.won/.test(base.trail.refusal.human) && base.trail.rows.length === 0, JSON.stringify(base.trail.refusal));
}
{
  const { first } = foldLoaded(room({ holds: { lanes: ["bench"], kinds: ["Not A Kind", "run.completed"] } }), () => undefined);
  check("KINDS: a registry kind this shell will not ask for is named in the trail's note, never widened into the ask",
    /Not A Kind/.test(first.trail.note) && first.trail.kinds.join(",") === "run.completed", first.trail.note);
}
{
  const { first } = foldLoaded(room({ holds: { lanes: ["bench"] } }), () => undefined);
  check("NO KINDS: a room homing no kind asks for no trail and says why", first.trail.isHomed === false && !first.reads.some((r) => r.route === "/api/spine") && lr.countedOn(first, "x") === "the registry homes no such kind here");
}

// ── runs, grouped ───────────────────────────────────────────────────────────────────────────────────
{
  const events = [
    { id: "a", ts: "2026-09-17T10:00:00+05:30", kind: "run.completed", venture: "arc", actor: "x", outcome: "", day: "2026-09-17", payload: { driver: "opus", outcome: "passed", duration_ms: 1200 } },
    { id: "b", ts: "2026-09-16T10:00:00+05:30", kind: "run.completed", venture: "arc", actor: "x", outcome: "", day: "2026-09-16", payload: { driver: "opus", outcome: "failed" } },
    { id: "c", ts: "not a time", kind: "run.completed", venture: "arc", actor: "x", outcome: "ok", day: "", payload: { driver: "haiku" } },
    { id: "d", ts: "2026-09-17T11:00:00+05:30", kind: "run.completed", venture: "arc", actor: "x", outcome: "", day: "2026-09-17", payload: {} },
  ];
  const rows = lr.runsBy(events, "driver", ["duration_ms"]);
  const opus = rows.find((r) => r.name === "opus");
  const haiku = rows.find((r) => r.name === "haiku");
  check("RUNS: grouped by the field, newest first, and a receipt without the field is not guessed into a group", rows.length === 2 && rows[0].name === "opus", JSON.stringify(rows.map((r) => r.name)));
  check("RUNS: the LAST run is the newest by timestamp, not the last on the page", opus !== undefined && opus.last === "last passed" && opus.runs === "2 runs" && /duration_ms 1200/.test(opus.detail), JSON.stringify(opus));
  check("RUNS: a timestamp this shell cannot read says so rather than being sliced into a clock", haiku !== undefined && haiku.when === "time unreadable", JSON.stringify(haiku));
  check("RUNS: on a partial page the count says it is that page's", lr.runsBy(events, "driver", [], true)[0].runs === "2 runs on that page");
}

// ── the files ───────────────────────────────────────────────────────────────────────────────────────
{
  const file = (over = {}) => ok({ id: "hq-policy", path: "hq.policy.yaml", sha256: "a".repeat(64), text: "a: 1\nb: 2\n", ...over });
  const a = foldLoaded(room(), byRoute({ "/api/file/:id": file() }), {}, { files: ["hq-policy"] }).base.sources[0];
  check("FILE: a served file is its path, its hash and its size in lines, never its content as a table", a.isRead === true && a.path === "hq.policy.yaml" && a.sha === `sha256 ${"a".repeat(12)}` && a.size === "2 lines", JSON.stringify(a));
  const w = foldLoaded(room(), byRoute({ "/api/file/:id": file({ id: "router" }) }), {}, { files: ["hq-policy"] }).base.sources[0];
  check("FILE WRONG_FILE: another file's body under this id is refused by name", w.isRefused === true && w.refusal.code === "WRONG_FILE" && w.isRead === false, JSON.stringify(w));
  const b = foldLoaded(room(), byRoute({ "/api/file/:id": file({ text: undefined }) }), {}, { files: ["hq-policy"] }).base.sources[0];
  check("FILE BAD_BODY: a body with no text is not a file", b.isRefused === true && b.refusal.code === "BAD_BODY", JSON.stringify(b));
  const e = foldLoaded(room(), byRoute({ "/api/file/:id": file({ text: "" }) }), {}, { files: ["hq-policy"] }).base.sources[0];
  check("FILE: an empty file is 0 lines, not 1", e.size === "0 lines", e.size);
}

// ── the manifest binds the shared fold (factory-ring debt row, paid) ────────────────────────────────
{
  const laneOnly = { ...MANIFEST, routes: ["/api/lane/:id"] };
  const { first } = foldLoaded(room(), () => undefined, { manifest: laneOnly });
  check("MANIFEST: a trail the manifest cannot read is REFUSED by the shared fold, with the host's own rule",
    first.trail.isRefused === true && first.trail.refusal.code === "READ_REFUSED" && /\/api\/spine/.test(first.trail.refusal.human) && first.trail.isReading === false, JSON.stringify(first.trail.refusal));
  check("MANIFEST: and it is never planned, so the host has nothing to drop and the panel never reads 'reading' for ever",
    !first.reads.some((r) => r.route === "/api/spine") && first.reads.some((r) => r.route === "/api/lane/:id") && reg.plannedReads(first, laneOnly).problems.length === 0, JSON.stringify(first.reads));
  check("MANIFEST: the refusal sentence IS registry.readProblem's, not a second spelling",
    first.trail.refusal.human === reg.readProblem({ route: "/api/spine", query: { kind: "promotion.proposed,run.completed", limit: 1000 }, poll: true }, laneOnly), first.trail.refusal.human);
  const files = foldLoaded(room(), () => undefined, { manifest: laneOnly }, { files: ["hq-policy"] }).first;
  check("MANIFEST: a file the manifest cannot read is refused the same way", files.sources[0].isRefused === true && files.sources[0].refusal.code === "READ_REFUSED" && !files.reads.some((r) => r.route === "/api/file/:id"), JSON.stringify(files.sources[0]));
  const bare = foldLoaded(room(), () => undefined, { manifest: undefined }).first;
  check("MANIFEST: a fold handed NO manifest fails closed -- every read refused, none planned",
    bare.reads.length === 0 && bare.lane.refusal.code === "READ_REFUSED" && bare.trail.refusal.code === "READ_REFUSED", JSON.stringify({ reads: bare.reads, lane: bare.lane.refusal, trail: bare.trail.refusal }));
  const host = reg.foldContext({ room: room(), rooms: [], mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: null, laneMap: undefined, door: null, onOpen: () => {} }, {}, MANIFEST);
  check("MANIFEST: the host hands a fold the manifest it checks reads against", host.manifest === MANIFEST && !("door" in host), JSON.stringify(Object.keys(host)));
}

// ── what the registry holds ─────────────────────────────────────────────────────────────────────────
{
  const { first } = foldLoaded(room({ holds: { lanes: ["bench"], kinds: [], lints: "citation-lint", jobs: ["a", 3] } }), () => undefined);
  check("HOLDS: a list the registry carried in a shape this shell cannot read is named, and its count is unread",
    /lints/.test(first.holdsNote) && /jobs/.test(first.holdsNote) && lr.holdsCount(first, "lints") === "—" && lr.holdsCount(first, "jobs") === "—", first.holdsNote);
  check("HOLDS: the readable part of a damaged list is still drawn", first.held.jobs.join(",") === "a", JSON.stringify(first.held));
}

// ── the catalogue, built in ONE pass (factory-ring debt row, paid) ──────────────────────────────────
{
  let holdsReads = 0;
  let idReads = 0;
  const counted = (id, holds) => ({
    get id() { idReads++; return id; },
    name: id.toUpperCase(),
    ring: "kernel",
    status: "built",
    get holds() { holdsReads++; return holds; },
  });
  const N = 3000;
  const rooms = Array.from({ length: N }, (_, i) => counted(`r${i}`, { commands: [`cmd-${i}`], agents: [`agent-${i % 7}`], hooks: [] }));
  const built = lr.catalogueOf({ rooms }, ["commands", "agents", "hooks", "rules", "lints", "processes", "gates", "products", "capabilities"]);
  check("CATALOGUE: every section is built from one pass -- each room's holds read ONCE, not once per section",
    holdsReads === N, `holds read ${holdsReads} times over ${N} rooms`);
  check("CATALOGUE: a row's room link is answered from a map, not a search per row -- ids read a bounded number of times",
    idReads <= N * 4, `id read ${idReads} times over ${N} rooms`);
  check("CATALOGUE: every row is there, one per room and name", built.commands.rows.length === N && built.agents.rows.length === N && built.hooks.rows.length === 0, `${built.commands.rows.length} ${built.agents.rows.length}`);
  const legacy = lr.heldAcrossRooms({ rooms: [counted("a", { commands: ["x"] })] }, "commands");
  check("CATALOGUE: heldAcrossRooms is the one-section view of the same build", legacy.rows.length === 1 && legacy.rows[0].name === "x");
  const odd = lr.catalogueOf({ rooms: [{ name: "no id", holds: { commands: ["x"] } }, { id: "soon", name: "Soon", status: "planned", planned: true, holds: { commands: ["arc-soon"] } }] }, ["commands"]);
  check("CATALOGUE: a room with no id is counted as unreadable, never drawn as 'undefined'", odd.commands.unreadable.includes("a room with no id") && !odd.commands.rows.some((r) => /undefined/.test(r.key)), JSON.stringify(odd.commands));
  check("CATALOGUE: a planned room's row is kept, and cannot be opened", odd.commands.rows.length === 1 && odd.commands.rows[0].canOpen === false && odd.commands.rows[0].room === "", JSON.stringify(odd.commands.rows));
}

// ── the lane card says each thing once (factory ring shot review, paid in the money ring's kit pass) ──
{
  const noAppetite = spine.laneCard(laneBody("design", { appetite: "", burn: "" }));
  check("KIT: a lane with no appetite says NO APPETITE BOUGHT once -- the burn line is not a lowercased copy of it",
    noAppetite.distance === "NO APPETITE BOUGHT" && noAppetite.burn === "" && noAppetite.hasMeter === false, JSON.stringify({ distance: noAppetite.distance, burn: noAppetite.burn }));
  const measured = spine.laneCard(laneBody("bench", { appetite: "10d", burn: "4d" }));
  check("KIT: a measured lane still carries its burn line and its meter", measured.hasMeter === true && /4d of 10d spent/.test(measured.burn), measured.burn);
  const withBrief = spine.laneCard(laneBody("develop", {}, [
    { phase: 1, file: "phase-01-spec.md", kind: "spec", title: "Phase 01 — The proof floor" },
    { phase: 1, file: "phase-01-tasks.md", kind: "tasks", title: "Build Brief — phase 01 · The proof floor" },
    { phase: 2, file: "phase-02-tasks.md", kind: "tasks", title: "Build Brief — phase 02 · Only a brief" },
    { phase: null, file: "notes.md", kind: null, title: "Notes" },
  ]));
  check("KIT: a phase's spec and its Build Brief are ONE row, the spec's title, the brief named beside it",
    withBrief.phases.length === 3 && withBrief.phases[0].label === "01" && withBrief.phases[0].title === "Phase 01 — The proof floor" && withBrief.phases[0].also === "tasks",
    JSON.stringify(withBrief.phases));
  check("KIT: a phase with only a brief keeps it as its row, and an unnumbered file stays its own row",
    withBrief.phases[1].label === "02" && /Only a brief/.test(withBrief.phases[1].title) && withBrief.phases[1].also === "" && withBrief.phases[2].title === "Notes", JSON.stringify(withBrief.phases));
}

// ── the toolbelt's catalogue, and the seven mutants that walked past every gate ─────────────────────
const TOOLBELT_ROOMS = [
  { id: "toolbelt", name: "Toolbelt", ring: "factory", status: "built", sentence: "t", lede: "", holds: {} },
  { id: "alpha", name: "Alpha Room", ring: "command", status: "built", holds: { commands: ["arc-review", "arc-ship", "ship-it"], agents: ["qa-tester"], hooks: ["pre-commit"], lints: ["slop-lint"], rules: ["testing"] } },
  { id: "beta", name: "Factory Floor", ring: "factory", status: "built", holds: { commands: ["arc-audit"], agents: ["code-reviewer", "security-auditor"], processes: ["arc-commit"] } },
  { id: "soon", name: "Soon", ring: "money", status: "planned", planned: true, holds: { commands: ["arc-soon"] } },
];
const SECTION_KEYS = "commands,agents,hooks,rules,lints,processes,gates,products,capabilities";
/** The toolbelt checks, as a list of what failed -- run against the real fold and every mutant. */
const toolbeltFailures = (fold) => {
  const out = [];
  const at = (rooms, find = "") => fold({}, { room: rooms[0], rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: null, laneMap: undefined, picks: { find }, manifest: { id: "toolbelt", ring: "factory", routes: [], asOf: false } });
  let f;
  try { f = at(TOOLBELT_ROOMS); } catch (e) { return [`threw: ${e.message}`]; }
  const sec = (x, key) => x.sections.find((s) => s.key === key);
  if (x_keys(f) !== SECTION_KEYS) out.push(`sections are ${x_keys(f)}`);
  if (!sec(f, "hooks") || sec(f, "hooks").rows.map((r) => r.name).join(",") !== "pre-commit") out.push("hooks section lost its row");
  const kpi = (x, key) => (x.kpis.find((k) => k.key === key) || {}).v;
  if (kpi(f, "commands") !== "5" || kpi(f, "agents") !== "3") out.push(`kpis commands=${kpi(f, "commands")} agents=${kpi(f, "agents")}`);
  if (sec(f, "commands").count !== "5") out.push(`commands count ${sec(f, "commands").count}`);
  const sub = at(TOOLBELT_ROOMS, "view");
  if (!sec(sub, "commands").rows.some((r) => r.name === "arc-review")) out.push("the find box is not a substring match");
  const upper = at(TOOLBELT_ROOMS, "ARC-REVIEW");
  if (!sec(upper, "commands").rows.some((r) => r.name === "arc-review")) out.push("the find box is case-sensitive");
  const byRoom = at(TOOLBELT_ROOMS, "factory floor");
  if (sec(byRoom, "agents").rows.length !== 2) out.push("the find box does not match a room's name");
  if (kpi(sub, "total") !== "12") out.push(`the total counts the filtered rows (${kpi(sub, "total")})`);
  const damaged = TOOLBELT_ROOMS.map((r) => (r.id === "beta" ? { ...r, holds: { ...r.holds, commands: "not a list" } } : r));
  const d = at(damaged);
  if (sec(d, "commands").count !== "—" || !/beta/.test(d.catalogueNote)) out.push(`an unreadable list reads ${sec(d, "commands").count}`);
  if (!sec(f, "commands").rows.some((r) => r.name === "arc-soon" && r.canOpen === false)) out.push("a planned room's row is dropped or openable");
  return out;
};
const x_keys = (f) => (Array.isArray(f.sections) ? f.sections.map((s) => s.key).join(",") : "no sections");
{
  const real = (await import(pathToFileURL(TOOLBELT).href)).fold;
  const fails = toolbeltFailures(real);
  check("TOOLBELT: the real fold passes every catalogue check", fails.length === 0, fails.join(" ; "));
  const source = readFileSync(TOOLBELT, "utf8");
  const libUrl = pathToFileURL(LIB).href;
  const MUTANTS = [
    ["a deleted section", '["hooks", "Hooks"],', ""],
    ["a count that reads another section", 'key: "commands", v: figure("commands")', 'key: "commands", v: figure("agents")'],
    ["a prefix-only filter", "r.name.toLowerCase().includes(needle)", "r.name.toLowerCase().startsWith(needle)"],
    ["a filter that ignores the room", " || r.roomName.toLowerCase().includes(needle)", ""],
    ["a case-sensitive filter", "const needle = find.trim().toLowerCase();", "const needle = find.trim();"],
    ["an unreadable list counted as a number", 'count: s.unreadable.length > 0 ? "—" : fmtInt(rows.length),', "count: fmtInt(rows.length),"],
    ["a total over the filtered rows", "const total = all.reduce(", "const total = sections.reduce("],
  ];
  const scratch = mkdtempSync(join(tmpdir(), "lane-room-mutants-"));
  try {
    let n = 0;
    for (const [label, find, replace] of MUTANTS) {
      n += 1;
      check(`MUTANT ${n} (${label}) applies to the real toolbelt fold (vacuous-pass guard)`, source.includes(find), JSON.stringify(find));
      if (!source.includes(find)) continue;
      const mutated = source.replace(find, replace).replaceAll('"../../../lib/', `"${libUrl}/`);
      const file = join(scratch, `mutant-${n}.mjs`);
      writeFileSync(file, mutated);
      let mfold = null;
      try { mfold = (await import(pathToFileURL(file).href)).fold; } catch (e) { check(`MUTANT ${n} (${label}) imports`, false, e.message); continue; }
      const caught = toolbeltFailures(mfold);
      check(`MUTANT ${n} (${label}) is FAILED by the catalogue checks`, caught.length > 0, "the mutant passed every check");
    }
    check("all seven mutants were built and run", n === 7, String(n));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 50 ? 0 : 1;
