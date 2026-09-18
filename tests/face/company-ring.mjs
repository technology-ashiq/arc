#!/usr/bin/env node
// company-ring.mjs -- what the company ring's folds ANSWER over loaded payloads, and the four extra rooms the
// owner's ruling unblocked (face v2 Phase 03, company ring; ADR-1327, ADR-1337; carried finding F1).
//
// module-frame folds every module with nothing loaded and proves its SHAPE. This suite folds the company ring's
// readers over the door's real bodies -- the constitution, the logbook, the portfolio's band table, the contract's
// glossary -- and over mutants of them, branch by branch, so each check fails when the decision it names is
// removed. F1 is held here: the ADR band map names the LANE that owns each century, read from PORTFOLIO.md's band
// table, never the room the contract homes the band in.
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is
// "RAN: <n> checks, <f> failed", and the suite FAILs below its own floor.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");
const MODULES = join(REPO, "face", "src", "modules");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const reg = await import(pathToFileURL(join(LIB, "registry.mjs")).href);
const cr = await import(pathToFileURL(join(LIB, "company-room.mjs")).href);
const smoke = await import(pathToFileURL(join(REPO, "face", "scripts", "smoke.mjs")).href);
const foldOf = async (ring, id) => (await import(pathToFileURL(join(MODULES, ring, id, "fold.mjs")).href)).fold;
const manifestOf = async (ring, id) => (await import(pathToFileURL(join(MODULES, ring, id, "module.mjs")).href)).default;
check("company-room.mjs, the extras reader and the smoke's extras line loaded (vacuous-pass guard)",
  ["constitutionOf", "historyOf", "bandsOf", "glossaryOf", "fileText"].every((k) => typeof cr[k] === "function")
  && typeof reg.extraRooms === "function" && typeof reg.withExtras === "function" && typeof smoke.extrasLine === "function",
  `${Object.keys(cr).join(",")} | extraRooms=${typeof reg.extraRooms} | extrasLine=${typeof smoke.extrasLine}`);

const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
const contract = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "expected-set.json"), "utf8"));
const exemptText = readFileSync(join(REPO, "initiatives", "face", "contracts", "module-exemptions.json"), "utf8");
const roomOf = (id) => registry.rooms.find((r) => r.id === id);
const ctxFor = (room, manifest, over = {}) => ({ room, rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest, ...over });

// The door's /api/file body: every string escaped once, as arc-dash's escapeDeep writes it.
const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const served = (id, path, text) => ({ state: "ok", data: { mode: "sim", badge: "file, not log", id, path, sha256: createHash("sha256").update(text).digest("hex"), text: escape(text) } });
const real = (rel) => readFileSync(join(REPO, rel), "utf8").replace(/\r\n/g, "\n");
const CONSTITUTION = real("CONSTITUTION.md");
const HISTORY = real("docs/HISTORY.md");
const PORTFOLIO = real("PORTFOLIO.md");
const EXPECTED = real("initiatives/face/contracts/expected-set.json");

/** Fold once to learn the reads, then again with each answered by `answer(read)`. */
const loaded = (fold, ctx, answer) => {
  const first = fold({}, ctx);
  const payloads = Object.create(null);
  for (const read of reg.plannedReads(first, ctx.manifest).reads) {
    const p = answer(read);
    if (p !== undefined) payloads[read.key] = p;
  }
  return { first, full: fold(payloads, ctx) };
};
const byFile = (files, extra = () => undefined) => (read) => (read.route === "/api/file/:id" ? files[read.param] : extra(read));

// ── law: the constitution, read from the file the door serves ─────────────────────────────────────────────
{
  const law = cr.constitutionOf(CONSTITUTION);
  const section = (title) => {
    const at = CONSTITUTION.indexOf(title);
    const next = CONSTITUTION.indexOf("\n## ", at + 1);
    return at < 0 ? "" : CONSTITUTION.slice(at, next < 0 ? undefined : next);
  };
  const workingIds = [...section("## Working articles").matchAll(/^\*\*(A\d+) · /gm)].map((m) => m[1]);
  check("LAW: the three eternal articles are E1, E2 and E3, each with a name and its text",
    law.isRead && law.eternal.map((a) => a.id).join(",") === "E1,E2,E3" && law.eternal.every((a) => a.name !== "" && a.text !== ""), JSON.stringify(law.eternal.map((a) => [a.id, a.name])));
  check("LAW: the working articles are every A-numbered article the file carries, in order",
    workingIds.length > 0 && JSON.stringify(law.working.map((a) => a.id)) === JSON.stringify(workingIds), `law=${law.working.map((a) => a.id)} file=${workingIds}`);
  check("LAW: the precedence is the file's own line, in its order",
    JSON.stringify(law.precedence) === JSON.stringify(["Constitution", "ADRs", "PLAN.md", "code"]), JSON.stringify(law.precedence));
  check("LAW: the version and the adoption line are the file's", law.version === "v1.0" && /ADOPTED v1\.0/.test(law.adoption), `${law.version} | ${law.adoption}`);
  check("LAW: the amendment steps and the enforcement teeth are read, not typed", law.amendment.length > 0 && law.teeth.length > 0, `${law.amendment.length} | ${law.teeth.length}`);
  const renamed = cr.constitutionOf(CONSTITUTION.replace("## Eternal articles", "## Everlasting articles"));
  check("LAW: a file whose eternal section is renamed reads that section as UNREAD, never as zero articles",
    renamed.eternal.length === 0 && renamed.unread.includes("eternal") && renamed.working.length === law.working.length, JSON.stringify(renamed.unread));

  const manifest = await manifestOf("company", "law");
  const fold = await foldOf("company", "law");
  const ctx = ctxFor(roomOf("law"), manifest);
  const ev = (id, kind, ts) => ({ day: ts.slice(0, 10), seq: 1, event: { id, ts, kind, venture: "arc", actor: "owner", outcome: "", payload: {} } });
  const page = (events) => ({ state: "ok", data: { count: events.length, more: false, events } });
  const answer = (spine, files = { constitution: served("constitution", "CONSTITUTION.md", CONSTITUTION) }) => byFile(files, (r) => (r.route === "/api/spine" ? spine : undefined));
  const full = loaded(fold, ctx, answer(page([ev("01KZ0001", "constitution.adopted", "2026-08-06T10:00:00+05:30")]))).full;
  const kpi = (f, key) => (f.kpis.find((k) => k.key === key) || { v: "?" }).v;
  check("LAW FOLD: the counts are the articles the file carries", kpi(full, "eternal") === "3" && kpi(full, "working") === String(workingIds.length), JSON.stringify(full.kpis));
  const never = loaded(fold, ctx, answer(page([]))).full;
  const unread = loaded(fold, ctx, answer(undefined)).full;
  check("LAW FOLD: adoption is counted from the spine's receipts -- one read, none on an empty page, and unread while the page is not",
    kpi(full, "adopted") === "1" && kpi(never, "adopted") === "0" && kpi(unread, "adopted") === "—", `${kpi(full, "adopted")} | ${kpi(never, "adopted")} | ${kpi(unread, "adopted")}`);
  const wrong = loaded(fold, ctx, answer(page([]), { constitution: served("portfolio", "PORTFOLIO.md", PORTFOLIO) })).full;
  check("LAW FOLD: a body naming another file is refused WRONG_FILE, and no article is drawn from it",
    wrong.doc.isRefused && wrong.doc.refusal.code === "WRONG_FILE" && wrong.law.eternal.length === 0 && kpi(wrong, "eternal") === "—", JSON.stringify(wrong.doc.refusal));
  const amp = cr.constitutionOf("# The arc Constitution (v9)\n\n## Eternal articles (x)\n\n**E1 · A &amp; B.**\nText.\n");
  check("LAW: the door's escapes are undone ONCE -- the fold reads the text the door escaped, never doubly", amp.eternal[0]?.name !== "A &amp;amp; B", JSON.stringify(amp.eternal));
}

// ── story: the logbook's cycles, in the logbook's order ───────────────────────────────────────────────────
{
  const h = cr.historyOf(HISTORY);
  const entries = HISTORY.slice(HISTORY.indexOf("## Entries")).split("\n## ")[0];
  const heads = [...entries.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
  check("STORY: every logbook entry is a chapter, in the file's order", h.isRead && h.entries.length === heads.length && h.entries.length > 0, `story=${h.entries.length} file=${heads.length}`);
  check("STORY: an entry's cycle code, closing date and lane are read from its heading",
    h.entries[0]?.code === "C11" && h.entries[0]?.lane === "memory" && h.entries[0]?.date === "2026-08-12", JSON.stringify(h.entries[0]));
  check("STORY: an entry with no cycle code (a parked engine) is still a chapter, with its status and no invented code",
    h.entries.some((e) => e.code === "" && /PARKED/.test(e.status)), JSON.stringify(h.entries.map((e) => [e.code, e.status])));
  const gone = cr.historyOf(HISTORY.replace("## Entries", "## Logbook"));
  check("STORY: a logbook with no Entries section reads as UNREAD, never as a company with no history", gone.entries.length === 0 && gone.unread === true);
  const manifest = await manifestOf("company", "story");
  const fold = await foldOf("company", "story");
  const full = loaded(fold, ctxFor(roomOf("story"), manifest), byFile({ history: served("history", "docs/HISTORY.md", HISTORY) })).full;
  check("STORY FOLD: the chapters and the newest entry's date come from the file the door served",
    full.chapters.length === heads.length && full.newest === "2026-08-12", `${full.chapters.length} | ${full.newest}`);
}

// ── org, and F1: the band map names LANES ─────────────────────────────────────────────────────────────────
{
  const lanes = Object.keys(contract.lanes.map);
  const b = cr.bandsOf(PORTFOLIO);
  const row = (band) => b.rows.find((r) => r.band === band);
  check("F1: the face band 1300-1399 names the lane face, not the room toolbelt", row("1300–1399")?.lane === "face", JSON.stringify(row("1300–1399")));
  check("F1: the band 1000-1099 names the lane ledger, not the room money", row("1000–1099")?.lane === "ledger", JSON.stringify(row("1000–1099")));
  check("F1: the company band names no lane and says whose it is", row("0001–0099")?.isLane === false && /company/.test(row("0001–0099")?.owner ?? ""), JSON.stringify(row("0001–0099")));
  check("F1: the next unclaimed century is drawn as open, not as a lane", b.rows.some((r) => r.isOpen && r.lane === ""), JSON.stringify(b.rows.filter((r) => r.isOpen)));
  const named = b.rows.filter((r) => r.isLane).map((r) => r.lane);
  check("F1: every lane the band map names is a lane in the contract -- never a room id standing in for one",
    named.length >= 13 && named.every((l) => lanes.includes(l)), `named=${named.join(",")}`);
  // The negative control: Cycle 15's panel, which printed the contract's band -> ROOM map. The same check FAILs it.
  const roomsAsLanes = Object.values(registry.inventories.adrs || {});
  check("F1: MUTANT -- the Cycle 15 band map (bands homed to ROOMS) fails the same lane check",
    roomsAsLanes.length > 0 && !roomsAsLanes.every((l) => lanes.includes(l)), `rooms=${roomsAsLanes.join(",")}`);
  const noTable = cr.bandsOf(PORTFOLIO.replace("## ADR number bands", "## Numbering"));
  check("F1: a portfolio with no band table reads the map as UNREAD, and draws no band", noTable.rows.length === 0 && noTable.unread === true);

  const manifest = await manifestOf("company", "org");
  const fold = await foldOf("company", "org");
  const board = { state: "ok", data: { mode: "sim", badge: "file, not log", updated: "2026-09-18", lanes: [
    { lane: "face", header: { status: "LIVE", cycle: "arc-face v2 (Cycle 16)", phase: "03", "blocked-on": "—" } },
    { lane: "bench", header: { status: "LIVE", cycle: "arc-bench", phase: "02", "blocked-on": "the owner's stamp" } },
    { lane: "absorb", header: { status: "IDLE", cycle: "arc-absorb", phase: "—", "blocked-on": "—" } },
  ] } };
  const full = loaded(fold, ctxFor(roomOf("org"), manifest), byFile({ portfolio: served("portfolio", "PORTFOLIO.md", PORTFOLIO) }, (r) => (r.route === "/api/board" ? board : undefined))).full;
  check("ORG FOLD: the band map it draws names lanes (F1 in the module that renders it)",
    full.bands.rows.length === b.rows.length && full.bands.rows.find((r) => r.band === "1300–1399")?.lane === "face", JSON.stringify(full.bands.rows.slice(0, 3)));
  check("ORG FOLD: awake, idle and waiting are counted from the lanes' own headers",
    full.counts.live === 2 && full.counts.idle === 1 && full.waiting.length === 1 && full.waiting[0].lane === "bench", JSON.stringify({ counts: full.counts, waiting: full.waiting }));
}

// ── concepts: the glossary, from the contract the door serves ─────────────────────────────────────────────
{
  const g = cr.glossaryOf(EXPECTED, registry.rooms);
  const terms = Object.keys(contract.concepts.map);
  check("CONCEPTS: every term the contract carries, each with its room and station", g.isRead && g.count === terms.length && g.terms.every((t) => t.room !== ""), `${g.count} vs ${terms.length}`);
  check("CONCEPTS: a term whose room is served is homed; the unhomed list is the rest, counted", g.unhomed.length === g.terms.filter((t) => !t.isHomed).length);
  const manifest = await manifestOf("company", "concepts");
  const fold = await foldOf("company", "concepts");
  const withQ = loaded(fold, ctxFor(roomOf("concepts"), manifest, { picks: { q: "spine" } }), byFile({ "expected-set": served("expected-set", "initiatives/face/contracts/expected-set.json", EXPECTED) })).full;
  check("CONCEPTS FOLD: a search shows at most eight hits, each containing what was typed",
    withQ.search.hits.length > 0 && withQ.search.hits.length <= 8 && withQ.search.hits.every((h) => h.term.toLowerCase().includes("spine") || h.room.includes("spine")), JSON.stringify(withQ.search.hits.map((h) => h.term)));
  const broken = loaded(fold, ctxFor(roomOf("concepts"), manifest), byFile({ "expected-set": served("expected-set", "initiatives/face/contracts/expected-set.json", "{ not json") })).full;
  check("CONCEPTS FOLD: a contract that does not parse is refused, and no term is invented", broken.glossary.terms.length === 0 && broken.glossary.isRefused === true, JSON.stringify(broken.glossary.refusal));
}

// ── the extras: rows the shell draws as rooms arc does not serve (ADR-1327) ───────────────────────────────
{
  const file = (text) => ({ state: "ok", data: { id: "module-exemptions", path: "initiatives/face/contracts/module-exemptions.json", sha256: "e".repeat(64), text } });
  const x = reg.extraRooms(file(exemptText));
  check("EXTRAS: the two exempted rooms are read with their ring and sentence", x.problem === "" && JSON.stringify(x.ids.slice().sort()) === JSON.stringify(["agents", "executor"]) && x.rooms.every((r) => r.ring === "factory" && r.sentence !== ""), JSON.stringify(x));
  const noAdr = reg.extraRooms(file(JSON.stringify({ exemptions: [{ id: "executor", name: "Executor", ring: "factory", sentence: "s", lede: "" }] })));
  check("EXTRAS: a row that cites no ADR-1327 is refused, and draws nothing", noAdr.rooms.length === 0 && noAdr.problem !== "", noAdr.problem);
  const clash = reg.withExtras(registry, reg.extraRooms(file(JSON.stringify({ exemptions: [{ id: "law", adr: "ADR-1327", name: "Law", ring: "company", sentence: "s", lede: "" }] }))));
  check("EXTRAS: a row naming a SERVED room never replaces it -- the registry wins", clash.rooms.filter((r) => r.id === "law").length === 1 && clash.rooms.find((r) => r.id === "law")?.status !== "extra");
  check("EXTRAS: an unreadable file draws no extra room and says why", reg.extraRooms({ state: "refused", code: "UNKNOWN_FILE_ID", human: "no" }).rooms.length === 0);
  const line = smoke.extrasLine({ mood: "dark", extras: { expected: ["agents", "executor"], opened: ["agents", "executor"], errors: 0 } });
  check("EXTRAS: the smoke's line names what it opened against what the file lists", /smoke: extras mood=dark expected=2 opened=2/.test(line), line);
}

// ── the rest: agents, executor, factory, learn, strategy fold over what the door and the registry serve ─────
{
  const shell = reg.withExtras(registry, reg.extraRooms({ state: "ok", data: { id: "module-exemptions", path: "p", sha256: "e".repeat(64), text: exemptText } }));
  const extraRoom = (id) => shell.rooms.find((r) => r.id === id);
  const agentsHeld = registry.rooms.reduce((n, r) => n + ((r.holds && Array.isArray(r.holds.agents)) ? r.holds.agents.length : 0), 0);
  const agents = loaded(await foldOf("factory", "agents"), ctxFor(extraRoom("agents"), await manifestOf("factory", "agents"), { rooms: shell.rooms }), () => undefined).full;
  check("AGENTS FOLD: the roster is every agent the registry homes, each with its room", agents.roster.length === agentsHeld && agentsHeld > 0 && agents.roster.every((a) => a.room !== ""), `${agents.roster.length} vs ${agentsHeld}`);
  const executor = loaded(await foldOf("factory", "executor"), ctxFor(extraRoom("executor"), await manifestOf("factory", "executor"), { rooms: shell.rooms }), () => undefined).full;
  check("EXECUTOR FOLD: its employees are the registry's agents, and the contractors' roster is NOT SERVED until /api/roster",
    executor.kpis.find((k) => k.key === "employees")?.v === String(agentsHeld) && reg.notServedOf(executor).some((n) => n.route === "/api/roster"), JSON.stringify(executor.kpis));
  const board = { state: "ok", data: { mode: "sim", badge: "file, not log", updated: null, lanes: [
    { lane: "face", header: { status: "LIVE", cycle: "arc-face v2 (Cycle 16)", phase: "03", "blocked-on": "—" } },
    { lane: "absorb", header: { status: "IDLE", cycle: "arc-absorb", phase: "—", "blocked-on": "—" } },
  ] } };
  const factory = loaded(await foldOf("factory", "factory"), ctxFor(roomOf("factory"), await manifestOf("factory", "factory")), (r) => (r.route === "/api/board" ? board : undefined)).full;
  check("FACTORY FOLD: the floor is every running cycle and the phase it is on, from the lanes' own headers",
    factory.floor.length === 1 && factory.floor[0].lane === "face" && factory.floor[0].phase === "03", JSON.stringify(factory.floor));
  const learn = loaded(await foldOf("company", "learn"), ctxFor(roomOf("learn"), await manifestOf("company", "learn")), () => undefined).full;
  check("LEARN FOLD: what /api/learn will fold is NOT SERVED, by that route", reg.notServedOf(learn).length > 0 && reg.notServedOf(learn).every((n) => n.route === "/api/learn"), JSON.stringify(reg.notServedOf(learn).map((n) => n.route)));
  const strategy = loaded(await foldOf("company", "strategy"), ctxFor(roomOf("strategy"), await manifestOf("company", "strategy")), (r) => (r.route === "/api/board" ? board : undefined)).full;
  check("STRATEGY FOLD: the shelf is every plan the registry homes here", strategy.shelf.length === (roomOf("strategy").holds.plans || []).length && strategy.shelf.length > 0, `${strategy.shelf.length}`);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
const FLOOR = 40;
if (ran < FLOOR) { console.log(`FAIL the suite ran ${ran} checks, below its floor of ${FLOOR}`); process.exit(1); }
process.exit(failed === 0 ? 0 : 1);
