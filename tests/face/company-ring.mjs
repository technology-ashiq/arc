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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  ["constitutionOf", "historyOf", "bandsOf", "glossaryOf", "fileText", "boardLanes", "laneLinks", "realDate"].every((k) => typeof cr[k] === "function")
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
  // The newest entry is whatever the file's first heading says -- read here with a regex of the
  // test's own, independent of the fold. It was pinned to C11/memory/2026-08-12, which went red
  // the day the next cycle closed and appended its entry (docs, C17): the logbook grows.
  const first = /^(C\d+) · .* — [A-Z]+ (\d{4}-\d{2}-\d{2}) · lane `([^`]+)`$/.exec(heads[0] || "") || [];
  check("STORY: an entry's cycle code, closing date and lane are read from its heading",
    first.length === 4 && h.entries[0]?.code === first[1] && h.entries[0]?.lane === first[3] && h.entries[0]?.date === first[2], `${JSON.stringify(h.entries[0])} vs ${JSON.stringify(first.slice(1))}`);
  check("STORY: an entry with no cycle code (a parked engine) is still a chapter, with its status and no invented code",
    h.entries.some((e) => e.code === "" && /PARKED/.test(e.status)), JSON.stringify(h.entries.map((e) => [e.code, e.status])));
  const gone = cr.historyOf(HISTORY.replace("## Entries", "## Logbook"));
  check("STORY: a logbook with no Entries section reads as UNREAD, never as a company with no history", gone.entries.length === 0 && gone.unread === true);
  const manifest = await manifestOf("company", "story");
  const fold = await foldOf("company", "story");
  const full = loaded(fold, ctxFor(roomOf("story"), manifest), byFile({ history: served("history", "docs/HISTORY.md", HISTORY) })).full;
  check("STORY FOLD: the chapters and the newest entry's date come from the file the door served",
    full.chapters.length === heads.length && full.newest === first[2], `${full.chapters.length} | ${full.newest} vs ${first[2]}`);
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
  check("AGENTS FOLD: the roster is every agent the registry homes, each with the room it is homed in", agents.roster.length === agentsHeld && agentsHeld > 0 && agents.roster.every((a) => a.roomName !== ""), `${agents.roster.length} vs ${agentsHeld}`);
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

// ── the company ring attack: every hole the two attackers demonstrated, pinned so removing its fix fails here ──
{
  // A section carried in a shape the reader cannot read is UNREADABLE -- "—" with its own sentence -- never "0".
  const dashed = cr.constitutionOf(CONSTITUTION.replace(/\*\*(E\d) · /g, "**$1 — "));
  check("ATTACK LAW: eternal articles written with a dash are still read", dashed.eternal.map((a) => a.id).join(",") === "E1,E2,E3", JSON.stringify(dashed.eternal.map((a) => a.id)));
  const headed = cr.constitutionOf(CONSTITUTION.replace(/^\*\*(A\d+) · (.+?)\*\*$/gm, "### $1 · $2"));
  check("ATTACK LAW: working articles as headings are UNREADABLE, never zero", headed.working.length === 0 && headed.unreadable.includes("working") && !headed.unread.includes("working"), JSON.stringify({ unread: headed.unread, unreadable: headed.unreadable }));
  const lawFold = await foldOf("company", "law");
  const lawCtx = ctxFor(roomOf("law"), await manifestOf("company", "law"));
  const headedFold = loaded(lawFold, lawCtx, byFile({ constitution: served("constitution", "CONSTITUTION.md", CONSTITUTION.replace(/^\*\*(A\d+) · (.+?)\*\*$/gm, "### $1 · $2")) })).full;
  check("ATTACK LAW FOLD: an unreadable section prints — and says why", (headedFold.kpis.find((k) => k.key === "working") || {}).v === "—" && /cannot read/.test(headedFold.workingNote), headedFold.workingNote);
  const prose = cr.constitutionOf(CONSTITUTION.replace(/## Amendment process\n\n[\s\S]*?\n## /, "## Amendment process\n\nAn amendment is proposed in writing. It cools for seven days.\n\n## "));
  check("ATTACK LAW: an amendment section written as prose is read as its paragraphs", prose.amendment.length === 1 && /cools for seven days/.test(prose.amendment[0] ?? ""), JSON.stringify(prose.amendment));
  const glued = cr.constitutionOf(CONSTITUTION + "\n> An aside that is not the adoption line.\n");
  check("ATTACK LAW: a later quote is never glued onto the adoption line", !/An aside/.test(glued.adoption) && /ADOPTED v1\.0/.test(glued.adoption), glued.adoption);
  check("ATTACK LAW: the version is the document's own title, not a later heading", cr.constitutionOf("# Notes\n\n# Appendix (v9)\n").version === "" && cr.constitutionOf(CONSTITUTION).version === "v1.0");

  // The logbook: an unreadable table or Entries section is never read as none; a code travels with its own date.
  const noColText = HISTORY.replace(/^(\| C\d+ \|[^\n]*?)\| [^|\n]*\|\s*$/gm, "$1|");
  const noCol = cr.historyOf(noColText);
  // Derived from the file, never pinned: every closed cycle adds a glance row (it was 14, then docs C17 made it 15; the one row read is the un-numbered parked engine).
  const cutRows = (HISTORY.match(/^\| C\d+ \|[^\n]*\|\s*$/gm) || []).length;
  check("ATTACK STORY: glance rows with a column removed are COUNTED as unreadable, never dropped", noCol.cyclesMalformed === cutRows && noCol.cycles.length === 1, JSON.stringify({ state: noCol.cyclesState, bad: noCol.cyclesMalformed, read: noCol.cycles.length }));
  const noColFold = loaded(await foldOf("company", "story"), ctxFor(roomOf("story"), await manifestOf("company", "story")), byFile({ history: served("history", "docs/HISTORY.md", noColText) })).full;
  const cyclesKpi = noColFold.kpis.find((k) => k.key === "cycles") || { v: "?", sub: "" };
  check("ATTACK STORY FOLD: a glance table with unreadable rows prints — and counts them, never the short number", cyclesKpi.v === "—" && new RegExp(`${cutRows} rows this reader could not read`).test(cyclesKpi.sub), JSON.stringify(cyclesKpi));
  const noRule = cr.historyOf(HISTORY.replace(/^\|---\|[-|]*\|\s*$/m, ""));
  check("ATTACK STORY: a glance table with no separator row is UNREADABLE", noRule.cyclesState === "unreadable", noRule.cyclesState);
  const deep = cr.historyOf(HISTORY.replace(/^### /gm, "#### "));
  check("ATTACK STORY: entries written as #### are UNREADABLE, never a company with no history", deep.entries.length === 0 && deep.entriesState === "unreadable" && deep.unread === false, deep.entriesState);
  const moved = HISTORY.replace(/(### C1 · Orchestrator[^\n]*)/, "### C13 · arc-ledger \"the money brain\" — CLOSED 2099-12-31 · lane `ledger`\n\nA chapter filed low.\n\n$1");
  const mh = cr.historyOf(moved);
  check("ATTACK STORY: the newest chapter is the one with the latest date, and its code travels with it", mh.newestEntry !== null && mh.newestEntry.code === "C13" && mh.newest === "2099-12-31", JSON.stringify(mh.newestEntry && { code: mh.newestEntry.code, date: mh.newestEntry.date }));
  const storyFold = await foldOf("company", "story");
  const sf = loaded(storyFold, ctxFor(roomOf("story"), await manifestOf("company", "story")), byFile({ history: served("history", "docs/HISTORY.md", moved) })).full;
  check("ATTACK STORY FOLD: the lag names the newest chapter with ITS date, and counts the rows with no chapter", /C13 arc-ledger "the money brain", closed 2099-12-31/.test(sf.lag) && /have a row and no chapter yet/.test(sf.lag), sf.lag);
  check("ATTACK STORY: a date that is no calendar day is no date", cr.realDate("2026-19-45") === "" && cr.realDate("2026-02-30") === "" && cr.realDate("closed 2026-08-12 ·") === "2026-08-12");

  // F1's band map: a backticked word is a lane only where it stands as the owner, is a lane name, and is on the board.
  const bandText = (rows) => `## ADR number bands\n\n| Band | Owner |\n|---|---|\n${rows.join("\n")}\n\n## Next\n`;
  const lanes = new Set(["develop", "face"]);
  const odd = cr.bandsOf(bandText(["| 0001–0099 | `model-policy`'s Cycle 5 holds 0063–0071 |", "| 0100–0199 | `develop` |", "| 1300–1399 | `face` — claimed at birth, 2026-08-19 |", "| 1400–1499 | `law` — a room, not a lane |", "| 1500–1599 | `con` |"]), lanes);
  const row = (b) => odd.rows.find((r) => r.band === b);
  check("ATTACK F1: a backticked word followed by prose is not a lane claim", row("0001–0099")?.isLane === false, JSON.stringify(row("0001–0099")));
  check("ATTACK F1: a room id the board does not carry as a lane is never drawn as one, and is named", row("1400–1499")?.isLane === false && odd.unverified.includes("law"), JSON.stringify({ row: row("1400–1499"), unverified: odd.unverified }));
  check("ATTACK F1: a reserved device name is never a lane", row("1500–1599")?.isLane === false, JSON.stringify(row("1500–1599")));
  check("ATTACK F1: real lanes on the board stay lanes", row("0100–0199")?.lane === "develop" && row("1300–1399")?.lane === "face");
  const messy = cr.bandsOf(bandText(["| 0100—0199 | `develop` |", "| 0500–599 | `policy` |", "| 1300–1399 | `face` |", "| 1300–1399 | `face` |"]) + "\n| 9900–9999 | `ghost` |\n");
  check("ATTACK F1: a band written with an em dash is read; a malformed row is NAMED; a century claimed twice is NAMED",
    messy.rows.some((r) => r.band === "0100–0199") && messy.malformed.length === 1 && /0500–599/.test(messy.malformed[0] ?? "") && messy.duplicates.includes("1300–1399"), JSON.stringify({ malformed: messy.malformed, dup: messy.duplicates }));
  check("ATTACK F1: a second table in the section is never merged into the map", !messy.rows.some((r) => r.band === "9900–9999"));

  // The board: each lane once, each a lane name.
  const kept = cr.boardLanes([{ lane: "face" }, { lane: "" }, { lane: "../../docs" }, { lane: "face" }, { lane: "bench" }]);
  check("ATTACK BOARD: a nameless, path-like or repeated lane is left out and counted", kept.rows.map((r) => r.lane).join(",") === "face,bench" && kept.dropped === 3, JSON.stringify(kept));
  const stratFold = await foldOf("company", "strategy");
  const dirty = { state: "ok", data: { mode: "sim", badge: "file, not log", updated: null, lanes: [
    { lane: "face", header: { status: "LIVE", cycle: "c", phase: "03" } }, { header: { status: "LIVE", cycle: "c", phase: "01" } },
    { lane: "../../docs", header: { status: "LIVE", cycle: "c", phase: "01" } }, { lane: "face", header: { status: "LIVE", cycle: "c", phase: "03" } },
  ] } };
  const st = loaded(stratFold, ctxFor(roomOf("strategy"), await manifestOf("company", "strategy")), (r) => (r.route === "/api/board" ? dirty : undefined)).full;
  check("ATTACK STRATEGY FOLD: one live plan per lane, no path from a lane that is no name, the rest counted", st.live.length === 1 && st.live.every((p) => !p.path.includes("..") && !p.path.includes("//")) && st.hasDropped === true, JSON.stringify(st.live.map((p) => p.path)));

  // The extras: the shell draws a row only where its module lives, and never a row made of invisible characters.
  const file = (rows) => ({ state: "ok", data: { id: "module-exemptions", path: "initiatives/face/contracts/module-exemptions.json", sha256: "e".repeat(64), text: JSON.stringify({ exemptions: rows }) } });
  const mods = [{ id: "executor", ring: "factory" }, { id: "agents", ring: "factory" }];
  const moved2 = reg.withExtras(registry, reg.extraRooms(file([{ id: "executor", adr: "ADR-1327", name: "Executor", ring: "company", sentence: "s" }, { id: "ghost", adr: "ADR-1327", name: "Ghost", ring: "money", sentence: "s" }])), mods);
  check("ATTACK EXTRAS: a row in a ring its module is not in, or with no module, is never drawn -- and is named",
    !moved2.rooms.some((r) => r.id === "executor" || r.id === "ghost") && moved2.extrasDropped.length === 2, JSON.stringify(moved2.extrasDropped));
  const invisible = reg.extraRooms(file([{ id: "executor", adr: "ADR-1327", name: "\u200b", ring: "factory", sentence: "\u2060\u00ad" }]));
  check("ATTACK EXTRAS: a name or sentence made of invisible characters is refused", invisible.rooms.length === 0 && invisible.problem !== "", invisible.problem);
  const noSha = reg.extraRooms({ state: "ok", data: { id: "module-exemptions", text: exemptText } });
  check("ATTACK EXTRAS: a body with no path or hash is not the file", noSha.rooms.length === 0 && /path or hash/.test(noSha.problem), noSha.problem);

  // The agents roster: a partial roster says so beside what it draws.
  const broken = registry.rooms.map((r) => (r.id === "council-chamber" ? { ...r, holds: { ...r.holds, agents: "not a list" } } : r));
  const shell2 = reg.withExtras({ ...registry, rooms: broken }, reg.extraRooms({ state: "ok", data: { id: "module-exemptions", path: "p", sha256: "e".repeat(64), text: exemptText } }));
  const ag = loaded(await foldOf("factory", "agents"), ctxFor(shell2.rooms.find((r) => r.id === "agents"), await manifestOf("factory", "agents"), { rooms: shell2.rooms }), () => undefined).full;
  check("ATTACK AGENTS FOLD: a roster missing a room's agents is PARTIAL, says so, and counts nothing", ag.isRosterPartial === true && /council-chamber/.test(ag.partial) && ag.kpis[0].v === "—", JSON.stringify({ partial: ag.partial, v: ag.kpis[0].v }));

  // fileText copies the body ONCE: a getter cannot pass as one file and draw another's text.
  let reads = 0;
  const shifty = { state: "ok", get data() { reads++; return reads === 1 ? { id: "constitution", path: "CONSTITUTION.md", sha256: "a".repeat(64), text: "# The arc Constitution (v1.0)\n" } : { id: "portfolio", path: "PORTFOLIO.md", sha256: "b".repeat(64), text: PORTFOLIO }; } };
  const ft = cr.fileText({ [reg.readKey({ route: "/api/file/:id", param: "constitution" })]: shifty }, lawCtx, "constitution", []);
  check("ATTACK FILETEXT: the body is read once, and its provenance and text come from that one read", ft.source.isRead && ft.text === "# The arc Constitution (v1.0)\n", JSON.stringify({ isRead: ft.source.isRead, text: String(ft.text).slice(0, 30) }));

  // The glossary: a non-object entry is no term; the template is no home; an empty station is no station.
  const g2 = cr.glossaryOf(JSON.stringify({ concepts: { map: { "a word": { room: "law", station: "" }, broken: "x", nope: null, "in the template": { room: "lane", station: "s" } } } }), registry.rooms);
  check("ATTACK GLOSSARY: entries that are not objects are counted unreadable, and a term homed in the template is unhomed",
    g2.count === 2 && g2.unreadable === 2 && g2.unhomed.some((t) => t.term === "in the template"), JSON.stringify({ count: g2.count, unreadable: g2.unreadable, unhomed: g2.unhomed.map((t) => t.term) }));

  // The smoke's contract reader: a repeated extra id is a setup error, as a repeated served id is.
  const tmp = mkdtempSync(join(tmpdir(), "company-ring-"));
  mkdirSync(join(tmp, "initiatives", "face", "contracts"), { recursive: true });
  writeFileSync(join(tmp, "initiatives", "face", "contracts", "module-exemptions.json"), JSON.stringify({ exemptions: [{ id: "executor", ring: "factory", sentence: "a" }, { id: "executor", ring: "money", sentence: "b" }] }));
  let threw = "";
  try { smoke.expectedExtras(tmp); } catch (e) { threw = String(e && e.message); }
  check("ATTACK SMOKE: an exemption file listing an id twice is a setup error, never two readers keeping different copies", /a second time/.test(threw), threw);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
const FLOOR = 65;
if (ran < FLOOR) { console.log(`FAIL the suite ran ${ran} checks, below its floor of ${FLOOR}`); failed++; }
// exitCode, never exit(): exit() races stdout where the pipe is asynchronous (macOS), and the RAN line is the proof.
process.exitCode = failed === 0 ? 0 : 1;
