#!/usr/bin/env node
// session-dock.mjs -- the session dock's decisions and its click-only rule (face v2 Phase 06; REQ-08, ADR-1326).
//
// Two halves:
//   1. lib/sessions.mjs under node: which verbs a room carries, a not-shippable verb says why, Start's courtesy block,
//      what a start sends, how an attached run reads, when polling stops.
//   2. THE CLICK-ONLY GATE, as a structural check over face/src: door.sessionStart is called at exactly ONE site, inside
//      the dock's onStart handler, and that handler is bound to a button's onClick; door.mjs's sessionStart fetches a
//      fresh click token before it starts. Each mutant the phase spec names is planted into the real source and must
//      FAIL the gate: an auto-start on mount (useEffect), a start on reload (a mount-time call again, by another route),
//      a start from Ask, a start from the attach poll, and a start that skips the click token.
//   The browser flow (face/scripts/flows.mjs) is the runtime half: it counts the door's start requests across mount,
//   reload and attach and requires 0.
//
// VACUOUS-PASS GUARD: the gate is shown to PASS the real tree (a positive control that finds the one call site) before
// any mutant is judged, and the last line is "RAN: <n> checks".

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const SRC = join(REPO, "face", "src");
const S = await import(pathToFileURL(join(SRC, "lib", "sessions.mjs")).href);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

// ---- 1. the decisions ----
const registry = {
  drivers: ["auto", "mock", "codex"],
  processes: ["kickoff-plan", "review-diff"],
  sessions: [
    { id: "review-ship.review", room: "review-ship", label: "Review the diff", process: "review-diff", processReady: true, receipt: { kind: "review.completed" }, spends: true, confirmStep: null, pickProcess: false,
      fields: [{ name: "base", label: "Base branch", placeholder: "main", type: "text", max: 100, required: false }] },
    { id: "review-ship.ship", room: "review-ship", label: "Ship", process: "ship-run", processReady: false, receipt: { kind: "ship.done" }, spends: true, confirmStep: "deploy", pickProcess: false, fields: [] },
    { id: "review-ship.qa", room: "review-ship", label: "Run QA", process: "qa-run", processReady: false, receipt: { kind: "qa.completed" }, spends: true, confirmStep: null, pickProcess: false,
      fields: [{ name: "url", label: "URL", placeholder: "http://localhost:3000", type: "text", max: 300, required: true }] },
    { id: "executor.dispatch", room: "executor", label: "Dispatch a process", process: null, processReady: true, receipt: { kind: "run.completed" }, spends: true, confirmStep: null, pickProcess: true, fields: [] },
  ],
  runs: [
    { sid: "000000001abcdefg", session: "review-ship.review", state: "running", startedAt: 1 },
    { sid: "000000002abcdefg", session: "executor.dispatch", state: "done", startedAt: 2 },
  ],
};
{
  const cards = S.sessionCards("review-ship", registry);
  check("sessionCards: a room gets its own verbs and no other room's", cards.length === 3 && cards.every((c) => c.id.startsWith("review-ship.")), cards.map((c) => c.id).join(","));
  check("sessionCards: a room with no verbs gets none", S.sessionCards("today", registry).length === 0);
  check("sessionCards: while the registry loads there are no cards (the dock waits, never guesses)", S.sessionCards("review-ship", null).length === 0);
  const ship = cards.find((c) => c.id === "review-ship.ship");
  const qa = cards.find((c) => c.id === "review-ship.qa");
  check("a confirm-step verb is not shippable, and says why in the owner's words", ship && !ship.ready && /confirmation before its deploy step/.test(ship.why), ship && ship.why);
  check("a verb with no process file is not shippable, and names the file", qa && !qa.ready && /qa-run\.process\.yaml/.test(qa.why), qa && qa.why);
  check("startBlocked: a not-shippable verb is blocked with its why", S.startBlocked(ship, {}, "") === ship.why);
  const review = cards.find((c) => c.id === "review-ship.review");
  check("startBlocked: a ready verb with only optional fields is live", S.startBlocked(review, {}, "") === null);
  const dispatch = S.sessionCards("executor", registry)[0];
  check("startBlocked: dispatch waits for a process pick", S.startBlocked(dispatch, {}, "") === "pick the process to dispatch" && S.startBlocked(dispatch, {}, "review-diff") === null);
  check("startBody: empty fields are left out, the driver defaults to auto, and nothing is trimmed",
    JSON.stringify(S.startBody(review, { base: " main " }, "", "x")) === JSON.stringify({ input: { base: " main " }, driver: "auto" })
    && JSON.stringify(S.startBody(review, { base: "" }, "mock", "")) === JSON.stringify({ input: {}, driver: "mock" }));
  check("startBody: only dispatch sends a process", S.startBody(dispatch, {}, "auto", "review-diff").process === "review-diff" && !("process" in S.startBody(review, {}, "auto", "review-diff")));
  check("startBody carries no click token: door.sessionStart fetches a fresh one itself", !("click" in S.startBody(review, {}, "auto", "")));
  check("roomRuns: only this room's verbs' runs", JSON.stringify(S.roomRuns("review-ship", registry).map((r) => r.sid)) === JSON.stringify(["000000001abcdefg"]));
  check("driverChoices: the door's list, or auto alone while it loads", S.driverChoices(registry).join(",") === "auto,mock,codex" && S.driverChoices(null).join(",") === "auto");
  const running = S.sessionRunView({ sid: "x", state: "running", lines: ["a &amp; b"], receipts: [], unattributed: [] });
  check("sessionRunView: a running run is polled, and door-escaped text is decoded", S.sessionPolling({ phase: "attached", run: running }) && running.lines[0] === "a & b" && !running.done);
  const unknown = S.sessionRunView({ sid: "x", state: "unknown", note: "read again" });
  check("sessionRunView: UNKNOWN is read again, never final", S.sessionPolling({ phase: "attached", run: unknown }));
  for (const st of ["done", "ended", "stale"]) check(`sessionRunView: ${st} is final and stops the poll`, !S.sessionPolling({ phase: "attached", run: S.sessionRunView({ state: st }) }));
  const moved = S.sessionRunView({ state: "running", branchMoved: { from: "feat/x", to: "main" } });
  check("sessionRunView: a moved checkout is said", /from feat\/x to main/.test(moved.branchMoved));
  const done = S.sessionRunView({ state: "done", receipts: [{ id: "01ABC", kind: "note.logged", ts: "t" }], unattributed: ["01XYZ"] });
  check("sessionVerdict: a done run names how many receipts were credited", /1 receipt/.test(S.sessionVerdict(done)) && done.unattributed.length === 1);
  check("sessionVerdict: done with none credited says so, never success", /no receipt credited/.test(S.sessionVerdict(S.sessionRunView({ state: "done" }))));
}

// Round-1 attack fixes (a320d86 B11, B13) held under node.
{
  const bad = { sessions: [
    { id: "x.bad-fields", room: "today", label: "L", fields: [null, 7, { label: "no name" }, { name: "ok", label: "Ok", placeholder: "", type: "text", max: 10, required: false }] },
    { id: "x.fields-not-list", room: "today", label: "L", fields: "nope" },
    null,
  ] };
  let cards = null, threw = null;
  try { cards = S.sessionCards("today", bad); } catch (e) { threw = e; }
  check("a malformed row never throws at render: bad fields are dropped and counted, a row whose fields is no list is skipped",
    threw === null && cards.length === 1 && cards[0].fields.length === 1 && cards[0].droppedFields === 3, threw ? String(threw) : JSON.stringify(cards));
  check("pollDelay: the base interval with no failure, doubling per failure, capped at 30 s",
    S.pollDelay(0) === S.SESSION_POLL_MS && S.pollDelay(1) === S.SESSION_POLL_MS * 2 && S.pollDelay(50) === 30_000 && S.pollDelay(-3) === S.SESSION_POLL_MS);
  check("terminalRefusal: a run gone or never this door's ends the poll; a transient failure does not",
    S.terminalRefusal("UNKNOWN_RUN") && S.terminalRefusal("RUN_OUTSIDE") && !S.terminalRefusal("UNREACHABLE") && !S.terminalRefusal("RUN_UNREADABLE"));
}

// ---- 2. the click-only gate ----
// What the gate reads: every file under face/src. A code file is read whatever its spelling of JS or TS; a file of a
// kind the gate cannot read as code is refused by name unless it is a known non-code asset (attack a320d86 B9).
//
// It judges the RAW text -- no comment stripper. A stripper that did not tokenise strings deleted real code (`'x //
// y'` hid a call to the line's end, `'/*' ... '*/'` hid everything between), so it transformed exactly what it judged
// (round-2 attack d90c3b1 B12). Instead the identifiers are kept OUT of prose: outside lib/door.mjs, face/src never
// names the start method or the handler in a comment, so any raw occurrence is code -- whatever its spelling: `?.(`,
// `.call(`, `.apply(`, an alias, a bracket (B11).
const CODE = /\.(tsx?|mts|cts|mjs|cjs|jsx?|vue|svelte|html)$/;
const ASSET = /\.(css|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|md|txt)$/;
/** @returns {{ rel: string, text: string, code: boolean, asset: boolean }[]} */
function sources(dir = SRC, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { sources(p, out); continue; }
    // CRLF normalised: a checkout with Windows line endings must be judged the same as the committed text (B13).
    out.push({ rel: relative(SRC, p).split(sep).join("/"), text: CODE.test(n) ? readFileSync(p, "utf8").replace(/\r\n?/g, "\n") : "", code: CODE.test(n), asset: ASSET.test(n) });
  }
  return out;
}

/**
 * The gate: null when the tree holds, else why not. The rule, whole:
 *   - every file under face/src is code the gate reads or a known asset;
 *   - outside lib/door.mjs the identifier `sessionStart` occurs EXACTLY ONCE in all of face/src, in
 *     shell/SessionDock.tsx, inside `const onStart = () => { ... }`;
 *   - in the dock, `onStart` occurs exactly twice: its declaration and `onClick={onStart}` -- so no hook, render body
 *     or other handler can reach it;
 *   - no file but lib/door.mjs names the start route or the click-token route;
 *   - door.mjs's sessionStart refuses a caller's click, fetches a fresh one before it posts, and spreads it last.
 * A slice boundary that is not found is a refusal, never a slice to the end of the file (B13).
 * @param {{ rel: string, text: string, code: boolean, asset: boolean }[]} files
 */
function clickOnlyGate(files) {
  const unread = files.filter((f) => !f.code && !f.asset);
  if (unread.length) return `the gate cannot read ${unread.map((f) => f.rel).join(", ")} as code, and it is no known asset`;
  const uses = [];
  for (const f of files.filter((x) => x.code && x.rel !== "lib/door.mjs")) {
    for (const m of f.text.matchAll(/\bsessionStart\b/g)) uses.push({ rel: f.rel, at: /** @type {number} */ (m.index) });
    if (/\/api\/session-click/.test(f.text) || /\/api\/session\/[^\n]*\/start/.test(f.text)) return `${f.rel} names a session route itself -- only door.mjs may`;
  }
  if (uses.length !== 1) return `the start method is named at ${uses.length} place(s) outside door.mjs (${uses.map((u) => u.rel).join(", ")}); the rule is exactly one`;
  const [u] = uses;
  if (u.rel !== "shell/SessionDock.tsx") return `the one start call is in ${u.rel}, not the dock`;
  const dock = files.find((f) => f.rel === "shell/SessionDock.tsx").text;
  const start = dock.indexOf("const onStart = () => {");
  if (start < 0) return "the dock has no onStart handler";
  const end = dock.indexOf("\n  }\n", start);
  if (end < 0) return "the dock's onStart handler has no end the gate can find";
  if (!(u.at > start && u.at < end)) return "the start call is not inside onStart";
  const handlerUses = (dock.match(/\bonStart\b/g) || []).length;
  if (handlerUses !== 2 || !/onClick=\{onStart\}/.test(dock)) return `onStart occurs ${handlerUses} time(s) in the dock; the rule is its declaration and onClick={onStart}, nothing else`;
  const door = files.find((f) => f.rel === "lib/door.mjs").text;
  const from = door.indexOf("async sessionStart(");
  if (from < 0) return "door.mjs has no sessionStart";
  const to = door.indexOf("\n  }\n", from);
  if (to < 0) return "door.mjs's sessionStart has no end the gate can find";
  const def = door.slice(from, to);
  const clickAt = def.indexOf("/api/session-click");
  const startAt = def.indexOf("/start`");
  if (clickAt < 0 || startAt < 0 || clickAt > startAt) return "door.sessionStart does not fetch a fresh click token before it posts the start";
  if (!/hasOwn\(body,\s*"click"\)/.test(def) || !/\{\s*\.\.\.body,\s*click\s*\}/.test(def)) return "door.sessionStart lets a caller's click stand (it must refuse one, and spread the fresh token last)";
  return null;
}

const real = sources();
check("positive control: the gate reads the real tree, finds the dock and door.mjs (vacuous-pass guard)",
  real.some((f) => f.rel === "shell/SessionDock.tsx" && f.code) && real.some((f) => f.rel === "lib/door.mjs" && f.code) && real.filter((f) => f.code).length > 50, `files=${real.length}`);
check("THE REAL TREE HOLDS: one sessionStart call, inside onStart, bound to onClick; door.mjs fetches a click first", clickOnlyGate(real) === null, clickOnlyGate(real) || "");

/** The real tree with one file's text replaced. @param {string} rel @param {(t: string) => string} edit */
const mutate = (rel, edit) => real.map((f) => (f.rel === rel ? { ...f, text: edit(f.text) } : f));
/** The real tree with one file added. */
const addFile = (rel, text, isCode = true) => [...real, { rel, text, code: isCode, asset: false }];
const DOCK = "shell/SessionDock.tsx";
const BEFORE_BLOCKED = "  const blocked = startBlocked(card, values, proc)";
const plant = (line) => mutate(DOCK, (t) => t.replace(BEFORE_BLOCKED, `${line}\n${BEFORE_BLOCKED}`));
const mutants = [
  ["an auto-start on mount (a useEffect in the dock that starts)", plant("  useEffect(() => {\n    door.sessionStart(card.id, startBody(card, values, driver, proc))\n  }, [door])")],
  ["an auto-start on mount, no braces: useEffect(() => onStart(), [])", plant("  useEffect(() => onStart(), [])")],
  ["an auto-start on every render: useEffect with no deps", plant("  useEffect(() => { onStart() })")],
  ["an auto-start in a layout effect", plant("  useLayoutEffect(() => { onStart() }, [])")],
  ["a start from the render body", plant("  if (!sid) onStart()")],
  ["a start by optional call: sessionStart?.(", plant("  useEffect(() => { door.sessionStart?.(card.id, startBody(card, values, driver, proc)) }, [])")],
  ["a start by .call", plant("  useEffect(() => { door.sessionStart.call(door, card.id, startBody(card, values, driver, proc)) }, [])")],
  ["a start through an alias", plant("  const s = door.sessionStart.bind(door); useEffect(() => { s(card.id, startBody(card, values, driver, proc)) }, [])")],
  ["a start hidden behind a string holding // (the stripper's hole)", plant("  const a = 'x // y'; useEffect(() => { door.sessionStart(card.id, startBody(card, values, driver, proc)) }, [])")],
  ["a start hidden between strings holding /* and */", plant("  const a = '/*'\n  useEffect(() => { door.sessionStart(card.id, startBody(card, values, driver, proc)) }, [])\n  const b = '*/'")],
  ["a start on reload (the room frame starts one as it mounts)", mutate("shell/RoomFrame.tsx", (t) => t.replace("import SessionDock from './SessionDock'", "import SessionDock from './SessionDock'\nvoid (globalThis as any).door?.sessionStart('review-ship.review', { input: {}, driver: 'auto' })"))],
  ["a start from Ask", mutate("lib/ask.mjs", (t) => `${t}\nexport function askStarts(door) { return door.sessionStart("council.convene", { input: {}, driver: "auto" }); }\n`)],
  ["a start from the attach poll", mutate(DOCK, (t) => t.replace("door.sessionRun(sid).then(", "door.sessionStart(session, { input: {}, driver: 'auto' }); door.sessionRun(sid).then("))],
  ["a start through door.call on the start route", plant("  useEffect(() => { door.call('/api/session/review-ship.review/start', { method: 'POST', body: {} }) }, [])")],
  ["a click token fetched outside door.mjs", mutate("lib/ask.mjs", (t) => `${t}\nexport const grab = (door) => door.call("/api/session-click", { method: "POST" });\n`)],
  ["a start by bracket access", plant("  useEffect(() => { door['sessionStart'](card.id, { input: {}, driver: 'auto' }) }, [])")],
  ["a start from a new .jsx file", addFile("shell/Boot.jsx", "export default function Boot({ door }) { door.sessionStart('review-ship.review', { input: {}, driver: 'auto' }); return null }\n")],
  ["a start from a new .js file", addFile("shell/boot.js", "export const boot = (door) => door.sessionStart('org.lane-birth', { input: {}, driver: 'auto' })\n")],
  ["a file of a kind the gate cannot read", addFile("shell/boot.wasm", "", false)],
  ["a start that skips the click token (door.mjs posts without asking for one)", mutate("lib/door.mjs", (t) => t.replace('const { click } = await this.call("/api/session-click", { method: "POST" });', "const click = \"replayed-token-000000000000\";"))],
  ["a caller's click allowed to override the fresh one (spread order)", mutate("lib/door.mjs", (t) => t.replace("body: { ...body, click } }", "body: { click, ...body } }"))],
  ["onStart no longer bound to the button (called on render instead)", mutate(DOCK, (t) => t.replace("onClick={onStart}", "onClick={() => {}} data-x={String(onStart())}"))],
];
check("positive control: every mutant actually changed the tree it plants into",
  mutants.every(([, files]) => files.length !== real.length || files.some((f, i) => f.text !== real[i].text)),
  mutants.filter(([, files]) => files.length === real.length && files.every((f, i) => f.text === real[i].text)).map(([n]) => n).join(" | "));
for (const [name, files] of mutants) {
  const why = clickOnlyGate(files);
  check(`MUTANT REFUSED by the click-only gate: ${name}`, why !== null, why || "the gate passed it");
}

// The count is DERIVED, never hand-kept: the bats wrapper pins MUTANTS against the number of REFUSED lines, and a
// hand-written floor that drifted one above the real count made a green suite exit 1 (round-2 attack d90c3b1 B1, B14).
console.log(`MUTANTS: ${mutants.length}`);
console.log(`RAN: ${ran} checks`);
process.exitCode = failed === 0 && ran > mutants.length ? 0 : 1;
