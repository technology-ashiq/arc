#!/usr/bin/env node
// money-ring.mjs -- what the money ring's shared folds ANSWER over loaded payloads (face v2 Phase 03, money ring).
//
// module-frame folds every module with nothing loaded and proves its SHAPE: its reads are declared, its lists
// match the evidence, its planned rooms carry no LIVE word. It cannot see what a fold answers once the door has
// spoken, and the money ring's attacker built seventeen mutants of this ring's decisions that no gate caught:
// the substance check deleted, green painted without the gate, the planned row guessed, the seal rule dropped.
// This suite folds face/src/lib/money-room.mjs, face/src/lib/planned-room.mjs and the money and ventures folds
// over loaded payloads, branch by branch -- each check fails when the decision it names is removed.
//
// VACUOUS-PASS GUARD: the first check proves the modules loaded; the last line is
// "RAN: <n> checks, <f> failed", and the suite FAILs below its own floor.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");
const MODULES = join(REPO, "face", "src", "modules", "money");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

const reg = await import(pathToFileURL(join(LIB, "registry.mjs")).href);
const mr = await import(pathToFileURL(join(LIB, "money-room.mjs")).href);
const pr = await import(pathToFileURL(join(LIB, "planned-room.mjs")).href);
const smoke = await import(pathToFileURL(join(REPO, "face", "scripts", "smoke.mjs")).href);
const foldOf = async (id) => (await import(pathToFileURL(join(MODULES, id, "fold.mjs")).href)).fold;
const manifestOf = async (id) => (await import(pathToFileURL(join(MODULES, id, "module.mjs")).href)).default;
check("money-room.mjs, planned-room.mjs and the smoke's pill rule loaded (vacuous-pass guard)",
  ["moneyReads", "substanceView", "costView", "killLinesView", "gateView"].every((k) => typeof mr[k] === "function")
  && ["plannedRoom", "plannedFigure", "plannedKinds"].every((k) => typeof pr[k] === "function") && typeof smoke.livePill === "function",
  `${Object.keys(mr).join(",")} | ${Object.keys(pr).join(",")}`);

const registry = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "rooms.generated.json"), "utf8"));
const roomOf = (id) => registry.rooms.find((r) => r.id === id);
const ctxFor = (id, manifest, over = {}) => ({ room: roomOf(id), rooms: registry.rooms, mode: "sim", token: null, needs: {}, needsUnplaced: 0, inventories: registry.inventories, laneMap: undefined, picks: {}, manifest, ...over });
const ok = (data) => ({ state: "ok", data });
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

// ── fixtures: the door's bodies, as the money brain writes them ─────────────────────────────────────────
const MONEY_MANIFEST = { id: "money", ring: "money", routes: ["/api/health", "/api/pnl"], asOf: false };
const health = (mode, kinds) => ({ mode, now: "2026-09-18 10:00 IST", spine: { kinds } });
const pnl = (mode, over = {}) => ({
  mode: "live",
  model: {
    mode,
    ventures: [{ venture: "lexos", cashIn: 299900, mrr: 299900, gross: 299900, fees: null, tax: null, net: null, rows: [{ id: "01KR0001", ts: "2026-09-10T10:00:00+05:30", paymentId: "pay_1", amount: 299900, currency: "INR", amountInr: 299900 }], costs: [] }],
    overhead: { venture: "arc", lines: [] },
    mrr: { asOfMonth: null, transitions: [], byVenture: {} },
    needsYou: [],
    counts: { revenue: 1, charges: 1, refunds: 0, costs: 0 },
  },
  kill: { present: true, receipted: true, digest: "d".repeat(12), path: "ventures.yaml", ventures: [{ venture: "lexos", criteria: [{ criterion: "days_without_revenue", status: "OK", threshold: 90, value: 8, distance: 82, unit: "days" }], worst: "OK", absentCount: 0 }], crossings: [], warnings: [] },
  ...over,
});
const answerMoney = (h, real, sim) => (read) => (read.route === "/api/health" ? h : read.query && read.query.simulated === "1" ? sim : real);

// ── the reads, and the manifest that binds them ─────────────────────────────────────────────────────────
{
  const m = mr.moneyReads({}, { manifest: MONEY_MANIFEST });
  check("READS: the money rooms ask for health, the real P&L and the simulated P&L -- three reads, never merged",
    m.reads.length === 3 && m.reads.some((r) => r.route === "/api/health") && m.reads.filter((r) => r.route === "/api/pnl").length === 2 && m.reads.some((r) => r.query && r.query.simulated === "1"), JSON.stringify(m.reads));
  const none = mr.moneyReads({}, { manifest: undefined });
  check("READS: a fold handed no manifest reads nothing, and says so in every panel",
    none.reads.length === 0 && none.health.refusal.code === "READ_REFUSED" && none.real.refusal.code === "READ_REFUSED" && none.sim.refusal.code === "READ_REFUSED", JSON.stringify({ reads: none.reads, real: none.real.refusal }));
}

// ── the substance each body names ───────────────────────────────────────────────────────────────────────
const readsWith = (h, real, sim) => {
  const payloads = Object.create(null);
  const first = mr.moneyReads({}, { manifest: MONEY_MANIFEST });
  for (const r of first.reads) payloads[reg.readKey(r)] = answerMoney(h, real, sim)(r);
  return mr.moneyReads(payloads, { manifest: MONEY_MANIFEST });
};
{
  const good = readsWith(ok(health("live", ["revenue.received"])), ok(pnl("real")), ok(pnl("simulated")));
  check("SUBSTANCE: a real body naming \"real\" and a simulated body naming \"simulated\" are both drawn", good.real.isRead === true && good.sim.isRead === true && good.realView !== null && good.simView !== null);
  for (const bad of ["SIMULATED", "sim", "simulated ", undefined]) {
    const m = readsWith(ok(health("live", [])), ok(pnl(bad)), ok(pnl("simulated")));
    check(`SUBSTANCE: the real read answered with model.mode ${JSON.stringify(bad ?? null)} is refused WRONG_SUBSTANCE, never drawn as real`,
      m.real.isRefused === true && m.real.refusal.code === "WRONG_SUBSTANCE" && m.realView === null && m.killView === null, JSON.stringify(m.real.refusal));
  }
  const notPnl = readsWith(ok(health("live", [])), ok({ error: "nope" }), ok(pnl("simulated")));
  check("SUBSTANCE: a body that is not a P&L at all is not a served P&L with nothing in it", notPnl.real.isRefused === true && notPnl.realView === null);
  const swapped = readsWith(ok(health("live", [])), ok(pnl("real")), ok(pnl("real")));
  check("SUBSTANCE: the simulated read answered with the real body is refused, never a second real panel", swapped.sim.refusal.code === "WRONG_SUBSTANCE" && swapped.simView === null);
}

// ── the green gate, and the door's data mode over it ─────────────────────────────────────────────────────
{
  const live = readsWith(ok(health("live", ["revenue.received"])), ok(pnl("real")), ok(pnl("simulated")));
  const real = mr.substanceView(live, "real");
  const sim = mr.substanceView(live, "simulated");
  check("GATE: on a live door where revenue.received has fired, real rows wear green -- through the gate",
    live.gate.spendable === true && real.rows.length === 1 && real.rows[0].ink === "var(--green)", JSON.stringify(real.rows));
  check("GATE: simulated rows wear the non-real ink always, gate or no gate", sim.rows.length === 1 && sim.rows[0].ink === "var(--sim-fg)" && sim.isSim === true);
  const simDoor = readsWith(ok(health("sim", ["revenue.received"])), ok(pnl("real")), ok(pnl("simulated")));
  check("GATE: a door reading a SIMULATED spine never spends green, whatever kinds its spine holds",
    simDoor.gate.spendable === false && /simulated spine/.test(simDoor.gate.why) && mr.substanceView(simDoor, "real").rows[0].ink !== "var(--green)", simDoor.gate.why);
  const unfired = readsWith(ok(health("live", [])), ok(pnl("real")), ok(pnl("simulated")));
  check("GATE: revenue.received never fired keeps green unspent", unfired.gate.spendable === false && mr.substanceView(unfired, "real").rows[0].ink === "var(--faint)");
  const noKinds = readsWith(ok({ mode: "live", spine: { kinds: "revenue.received" } }), ok(pnl("real")), ok(pnl("simulated")));
  check("HEALTH: a health body with no kinds LIST is refused, and the gate says health did not answer -- never 'has never fired'",
    noKinds.health.isRefused === true && noKinds.health.refusal.code === "BAD_BODY" && noKinds.healthView === null && noKinds.gate.spendable === false && /has not answered/.test(noKinds.gate.why) && !/never fired/.test(noKinds.gate.why), noKinds.gate.why);
}

// ── costs, counted and never summed ──────────────────────────────────────────────────────────────────────
{
  const state = { isReading: false, isRefused: false, isRead: true, refusal: { code: "", human: "" } };
  const lines = [{ id: "c1", ts: "2026-09-01T00:00:00+05:30", source: "measured", amount: 12345, currency: "INR", label: "api" }, { id: "c2", ts: "2026-09-02T00:00:00+05:30", source: "estimated", amount: 500, currency: "USD", label: "gpu" }];
  const money = await import(pathToFileURL(join(LIB, "money.mjs")).href);
  const c = mr.costView("cost", "lede", money.costTally(lines, "why"), state);
  check("COST: lines are counted by currency and by source, and no total is printed",
    c.isDrawn === true && c.count === "2 lines" && c.chips.some((x) => x.text === "INR · 1 receipt") && c.chips.some((x) => x.text === "USD · 1 receipt") && /No cost total is shown/.test(c.rule), JSON.stringify(c.chips));
  const empty = mr.costView("cost", "lede", money.costTally([], "why"), state);
  check("COST: an empty list is empty, not a zero", empty.isEmpty === true && empty.isDrawn === false);
}

// ── the money fold ───────────────────────────────────────────────────────────────────────────────────────
{
  const fold = await foldOf("money");
  const manifest = await manifestOf("money");
  const { full } = loaded(fold, ctxFor("money", manifest), answerMoney(ok(health("live", ["revenue.received", "revenue.simulated"])), ok(pnl("real")), ok(pnl("simulated"))));
  check("MONEY: the fired badge, the figures and both substances come from the reads", full.isRealFired === true && full.realPanel.isDrawn === true && full.simPanel.isDrawn === true && full.figures.length === 2, JSON.stringify({ badge: full.badge }));
  check("MONEY: the kill lines are a panel with one venture's criterion", full.kill.isPanel === true && full.kill.rows.length === 1 && full.kill.rows[0].criterion === "days_without_revenue", JSON.stringify(full.kill.rows));
  check("MONEY: three NOT SERVED panels and three work-door cards", reg.notServedOf(full).length === 3 && reg.verbPendingOf(full).length === 3);
}

// ── the ventures fold, over each state of the kill panel ─────────────────────────────────────────────────
{
  const fold = await foldOf("ventures");
  const manifest = await manifestOf("ventures");
  const fileBody = ok({ id: "ventures", path: "ventures.yaml", sha256: "e".repeat(64), text: "a: 1\n" });
  const answer = (realBody) => (read) => (read.route === "/api/file/:id" ? fileBody : answerMoney(ok(health("live", [])), ok(realBody), ok(pnl("simulated")))(read));
  const panel = loaded(fold, ctxFor("ventures", manifest), answer(pnl("real"))).full;
  check("VENTURES: a receipted panel draws the roster, and the declared ventures come from that panel alone",
    panel.cards.length === 1 && panel.cards[0].isDeclared === true && /lexos/.test(panel.declared) && panel.counts[0].v === "1", JSON.stringify({ declared: panel.declared, counts: panel.counts }));
  const unreceipted = loaded(fold, ctxFor("ventures", manifest), answer(pnl("real", { kill: { present: true, receipted: false, digest: "f".repeat(64), path: "ventures.yaml" } }))).full;
  check("VENTURES: an unreceipted criteria file measures nothing -- no roster, every count unread, never 0",
    unreceipted.cards.length === 0 && unreceipted.counts.every((c) => c.v === "—") && unreceipted.hasKillNote === true, JSON.stringify(unreceipted.counts));
  check("VENTURES: three unread tiles carry three captions, and the refusal's code on exactly one (shot review)",
    new Set(unreceipted.counts.map((c) => c.sub)).size === 3 && unreceipted.counts.filter((c) => c.sub.includes("UNRECEIPTED")).length === 1,
    JSON.stringify(unreceipted.counts.map((c) => c.sub)));
  check("VENTURES: the refusal is drawn once, and the headline points at it instead of repeating it",
    !unreceipted.summary.detail.includes("f".repeat(64)) && unreceipted.killNote.human.includes("f".repeat(64)), unreceipted.summary.detail);
  const withMoney = pnl("real", { kill: { present: false } });
  const absent = loaded(fold, ctxFor("ventures", manifest), answer(withMoney)).full;
  check("VENTURES: an ABSENT criteria file declares nothing, so money booked to a venture is truly booked with no kill line",
    absent.cards.length === 1 && absent.cards[0].isDeclared === false && absent.cards[0].hasFinding === true && absent.cards[0].finding.code === "VENTURE_WITHOUT_KILL_LINES", JSON.stringify(absent.cards.map((c) => c.finding)));
}

// ── the planned rooms ─────────────────────────────────────────────────────────────────────────────────────
const plannedText = readFileSync(join(REPO, "initiatives", "face", "contracts", "planned-rooms.json"), "utf8");
const fileBody = (text, id = "planned-rooms") => ok({ id, path: "initiatives/face/contracts/planned-rooms.json", sha256: "b".repeat(64), text });
const plannedWith = (id, body, over = {}) => {
  const manifest = { id, ring: "money", routes: ["/api/file/:id"], asOf: false };
  const ctx = ctxFor(id, manifest, over);
  const first = pr.plannedRoom({}, ctx);
  const payloads = Object.create(null);
  for (const r of first.reads) payloads[reg.readKey(r)] = body;
  return pr.plannedRoom(payloads, ctx);
};
const rowsJson = (rows) => JSON.stringify({ rooms: rows });
{
  const none = pr.plannedRoom({}, ctxFor("trader", undefined));
  check("PLANNED: a fold handed no manifest reads nothing", none.reads.length === 0 && none.refusal.code === "READ_REFUSED");
  const real = plannedWith("trader", fileBody(plannedText));
  check("PLANNED: the real registry row draws trader's line and seals", real.isRead === true && real.line.length === 11 && real.seals.length === 3, JSON.stringify({ line: real.line.length, seals: real.seals }));
  check("PLANNED: the seal that names a word never prints the word", real.seals.includes("the word — never rendered") && !real.seals.some((s) => /\bWIN\b/.test(s)), JSON.stringify(real.seals));
  for (const seal of ["WIN (the word).", "WIN  (the word)", "WIN (the word)", "WIN (the word)​", "WIN （the word）", "(the word) WIN", "WIN [the word]"]) {
    const t = plannedWith("trader", fileBody(rowsJson([{ room: "trader", line: ["a"], seals: [seal] }])));
    check(`PLANNED: the seal ${JSON.stringify(seal)} is masked, the word never printed`, t.seals.length === 1 && t.seals[0] === "the word — never rendered", JSON.stringify(t.seals));
  }
  const missingId = plannedWith("trader", ok({ path: "x", sha256: "b".repeat(64), text: plannedText }));
  check("PLANNED: a body naming no file is WRONG_FILE, never drawn as the planned registry", missingId.isRefused === true && missingId.refusal.code === "WRONG_FILE");
  const other = plannedWith("trader", fileBody(plannedText, "ventures"));
  check("PLANNED: another file's body is WRONG_FILE", other.refusal.code === "WRONG_FILE");
  const two = plannedWith("trader", fileBody(rowsJson([{ room: "trader", line: ["a"] }, { room: "trader", line: ["b"] }])));
  check("PLANNED: two rows for one room are refused -- choosing one would be a guess", two.refusal.code === "TWO_PLANNED_ROWS" && two.isRead === false);
  const unreadRows = plannedWith("trader", fileBody(rowsJson(["trader", 7, { room: "ops", line: ["a"] }])));
  check("PLANNED: no readable row plus rows this shell cannot read is UNREAD, never 'no row'", unreadRows.refusal.code === "UNREAD_PLANNED_ROWS");
  const noRow = plannedWith("trader", fileBody(rowsJson([{ room: "ops", line: ["a"] }])));
  check("PLANNED: no row at all is NO_PLANNED_ROW", noRow.refusal.code === "NO_PLANNED_ROW");
  const noId = plannedWith("trader", fileBody(rowsJson([{ room: "", line: ["a"] }])), { room: { ...roomOf("trader"), id: "" } });
  check("PLANNED: a room with no id never matches a row whose room is empty", noId.refusal.code === "NO_ROOM_ID" && noId.isRead === false);
  const literal = plannedWith("ops", fileBody(rowsJson([{ room: "ops", line: ["a"], shows_today: ["the literal text &lt;b&gt; is not a tag"], source: "AT&amp;T plan" }]).replace(/&/g, "&amp;")));
  check("PLANNED: the file's text is un-escaped ONCE -- a literal entity in it stays literal",
    literal.showsToday[0] === "the literal text &lt;b&gt; is not a tag" && literal.source === "AT&amp;T plan", JSON.stringify({ shows: literal.showsToday, source: literal.source }));
  const damaged = plannedWith("ops", fileBody(rowsJson([{ room: "ops", line: ["q", 7, null, "b"], shows_today: "docs" }])));
  const stations = pr.plannedFigure(damaged, "stations", "Stations", "line", "sub");
  const today = pr.plannedFigure(damaged, "today", "Today", "showsToday", "sub");
  check("PLANNED: a damaged list's figure is unread, never the short number that could be read",
    stations.v === "—" && today.v === "—" && damaged.line.length === 2 && damaged.hasNote === true, JSON.stringify({ stations, today }));
  const kindsText = plannedWith("ops", fileBody(plannedText), { room: { ...roomOf("ops"), holds: { kinds: "incident.raised" } } });
  check("PLANNED: kinds the registry carried unreadably are unread, never 'homes no receipt kind'",
    pr.plannedKinds(kindsText).v === "—" && /could not read/.test(kindsText.kindsSentence), kindsText.kindsSentence);
}

// ── F3: no planned fold says LIVE, in any case, whatever the door sends ─────────────────────────────────────
{
  const keysNamedLive = (v, out = [], seen = new Set()) => {
    if (!v || typeof v !== "object" || seen.has(v)) return out;
    seen.add(v);
    for (const [k, x] of Object.entries(v)) {
      if (/live/i.test(k) && x === true) out.push(k);
      keysNamedLive(x, out, seen);
    }
    return out;
  };
  const strings = (v, out = [], seen = new Set()) => {
    if (typeof v === "string") { out.push(v); return out; }
    if (!v || typeof v !== "object" || seen.has(v)) return out;
    seen.add(v);
    for (const x of Object.values(v)) strings(x, out, seen);
    return out;
  };
  check("F3: MUTANT -- the pill rule catches a Live pill in any case and passes prose that says live",
    smoke.livePill("● Live") && smoke.livePill("live") && smoke.livePill("L​IVE") && !smoke.livePill("once two ventures are live, support stops being one person") && !smoke.livePill("paper-live (human gate)"));
  for (const id of ["ops", "trader", "discover"]) {
    const fold = await foldOf(id);
    const manifest = await manifestOf(id);
    const { first, full } = loaded(fold, ctxFor(id, manifest), (r) => (r.route === "/api/file/:id" ? fileBody(plannedText) : undefined));
    for (const [label, f] of [["with nothing loaded", first], ["with its file read", full]]) {
      const pills = strings(f).filter((s) => smoke.livePill(s));
      check(`F3: ${id} ${label} returns no LIVE pill in any case`, pills.length === 0, pills.join(" ; "));
      check(`F3: ${id} ${label} returns no boolean field named for liveness`, keysNamedLive(f).length === 0, keysNamedLive(f).join(","));
    }
    check(`F3: ${id}'s badge is the planned badge, word for word`, full.badge === pr.PLANNED_BADGE && full.isPlanned === true);
    const flows = reg.rehearsalOf(full);
    check(`REHEARSAL: ${id}'s flows are each one card, drawn once`, flows.length === full.flows.length && new Set(flows.map((x) => x.verb)).size === flows.length, flows.map((x) => x.verb).join(","));
  }
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 45 ? 0 : 1;
