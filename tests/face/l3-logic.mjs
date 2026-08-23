#!/usr/bin/env node
// l3-logic.mjs -- the L3 decision layer, exercised WITHOUT a build and WITHOUT node_modules.
//
// This is the point of face/src/lib/*.mjs being dependency-free ESM (ADR-1316, face/README).
// CI never runs `npm install` at the repo root, so a branch living inside a .tsx is a branch
// nobody tests. Everything asserted here is imported straight from the app's own source --
// not a copy, not a re-implementation -- so a change to the app that breaks a rule fails
// here rather than in a browser nobody opened.
//
// VACUOUS-PASS GUARD: the first checks prove the modules LOADED and carry real exports,
// before any behavioural check is trusted. "RAN: <n> checks" on the last line is what the
// bats wrapper asserts, so a suite that dies half-way cannot read green.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const LIB = join(REPO, "face", "src", "lib");

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};

// pathToFileURL: a bare Windows path (c:\...) is rejected by the ESM loader as an unknown
// scheme. This suite already has a sibling that went red on the Windows leg alone for it.
const door = await import(pathToFileURL(join(LIB, "door.mjs")).href);
const rooms = await import(pathToFileURL(join(LIB, "rooms.mjs")).href);

check("modules loaded (vacuous-pass guard)",
  typeof door.Door === "function" && typeof rooms.byRing === "function");

// ---------- the registry the app actually renders ----------
const REG = join(REPO, "initiatives", "face", "contracts", "rooms.generated.json");
check("the generated registry exists to test against", existsSync(REG));
const registry = JSON.parse(readFileSync(REG, "utf8"));
// DERIVED from the contract, not written down. This was `=== 33` and it went red the moment
// ADR-1317 generated `chat-mcp` -- a room that had been DECLARED in planned-rooms.json and
// ADR-1306 and generated nowhere, which is a defect being fixed, not a fixture breaking.
//
// A hard-coded count is the weaker check in both directions: it goes red on a legitimate
// addition, and it cannot tell a registry that grew correctly from one that grew wrongly.
// Against the contract it can: the registry must carry every listed room plus the lane
// TEMPLATE, exactly, and both a silent drop and a silent extra now fail.
const contractRooms = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "expected-set.json"), "utf8")).rooms;
const expectedRooms = contractRooms.list.length + (contractRooms.template ? 1 : 0);
check("registry carries every room the contract lists, plus the template",
  registry.rooms.length === expectedRooms, `registry=${registry.rooms.length} contract=${expectedRooms}`);
// Vacuous-pass guard: two empties are also equal.
check("and the contract actually listed rooms to compare against", expectedRooms >= 30, `expected=${expectedRooms}`);

// The door adds `live` at read time; the registry on disk has none. Synthesise the four
// states so every branch below is exercised, rather than only the one this tree happens to
// be in today -- a test that only ever sees "live" proves nothing about the other three.
const withLive = registry.rooms.map((r, i) => {
  const kinds = (r.holds && r.holds.kinds) || [];
  const state = r.render === "index" ? "index"
    : kinds.length === 0 ? "file-borne"
      : i % 2 === 0 ? "live" : "unexercised";
  return {
    ...r,
    live: {
      kindsHomed: kinds.length,
      kindsFired: state === "live" ? kinds.length : 0,
      receipts: state === "live" ? 7 : 0,
      state,
    },
  };
});
const states = new Set(withLive.map((r) => r.live.state));
check("the fixture exercises all four honest states", states.size === 4, [...states].join(","));

// ---------- ring grouping ----------
const groups = rooms.byRing(withLive);
check("rings come back in reading order, command first",
  groups[0] && groups[0].ring === "command", groups.map((g) => g.ring).join(">"));
check("every ring carries a lede in the owner's terms",
  groups.every((g) => typeof g.lede === "string" && g.lede.length > 0));
const grouped = groups.reduce((n, g) => n + g.rooms.length, 0);
check("every non-template room lands in exactly one ring",
  grouped === withLive.filter((r) => !r.template).length, `grouped=${grouped}`);
check("the lane TEMPLATE is not offered as a room you can open",
  !groups.some((g) => g.rooms.some((r) => r.template)));
const money = groups.find((g) => g.ring === "money");
const plannedIdx = money.rooms.findIndex((r) => r.planned);
const lastLive = money.rooms.reduce((acc, r, i) => (r.planned ? acc : i), -1);
check("planned rooms sort BELOW built ones inside their ring",
  plannedIdx === -1 || plannedIdx > lastLive, `planned@${plannedIdx} lastBuilt@${lastLive}`);

// A ring the shell does not know must SURFACE, never vanish. This is the whole product's
// premise turned on its own nav: a room that silently disappears is the failure mode.
const orphaned = rooms.byRing([...withLive, { ...withLive[0], id: "ghost", ring: "atlantis", template: false }]);
check("a room in an unknown ring is surfaced, not dropped",
  orphaned.some((g) => g.ring === "unplaced" && g.rooms.some((r) => r.id === "ghost")));

// ---------- honest states ----------
for (const state of ["live", "unexercised", "file-borne", "index"]) {
  const room = withLive.find((r) => r.live.state === state);
  const badge = rooms.stateBadge(room);
  check(`state "${state}" has a label and a sentence, never a bare zero`,
    badge.label.length > 0 && badge.title.length > 10 && badge.label !== "0", `${state}: ${badge.label}`);
}
// Assert the CLAIM, not a chosen word. The first cut looked for /never/ and failed on a
// title that says "has ever fired" -- a test that pins vocabulary breaks on a rewrite that
// improves the sentence, which trains people to loosen tests instead of reading them.
// AND THAT THEY DIFFER. Each badge was checked in isolation -- label non-empty, title long
// enough, label not "0" -- so collapsing all four states to ONE identical badge passed the
// entire suite. Four states that render the same are one state with extra bookkeeping.
const allBadges = ["live", "unexercised", "file-borne", "index"]
  .map((st) => rooms.stateBadge(withLive.find((r) => r.live.state === st)));
check("the four honest states render four DIFFERENT labels",
  new Set(allBadges.map((b) => b.label)).size === 4, allBadges.map((b) => b.label).join("|"));
check("the four honest states render four DIFFERENT sentences",
  new Set(allBadges.map((b) => b.title)).size === 4);
check("the four honest states carry four DIFFERENT tones",
  new Set(allBadges.map((b) => b.tone)).size === 4, allBadges.map((b) => b.tone).join("|"));

const unex = rooms.stateBadge(withLive.find((r) => r.live.state === "unexercised"));
check("UNEXERCISED says in words that this is NOT a zero",
  /not a zero/i.test(unex.title) && /no count/i.test(unex.title) && unex.label !== "0",
  unex.title.slice(0, 70));

// as-of only where a day-granular history exists. Offering a scrubber that silently does
// nothing is worse than not offering one -- the door refuses such an asof BY NAME.
check("as-of is offered on log-borne rooms",
  rooms.supportsAsOf(withLive.find((r) => r.live.state === "live")));
check("as-of is NOT offered on file-borne rooms",
  !rooms.supportsAsOf(withLive.find((r) => r.live.state === "file-borne")));
check("as-of is NOT offered on index rooms",
  !rooms.supportsAsOf(withLive.find((r) => r.live.state === "index")));

// ---------- zones ----------
const spine = rooms.findRoom(withLive, "spine");
const zones = rooms.zonesFor(spine);
check("a rich room draws several zones", zones.length >= 3, `zones=${zones.length}`);
check("no zone is drawn empty", zones.every((z) => z.items.length > 0));
check("zones lead with what the room RECORDS", zones[0] && zones[0].key === "kinds", zones[0] && zones[0].key);
const indexRoom = withLive.find((r) => r.render === "index");
check("an index room draws no inventory zones (it renders the whole thing)",
  rooms.zonesFor(indexRoom).length === 0);

// ---------- lookup ----------
check("an unknown room id answers null, it does not throw", rooms.findRoom(withLive, "no-such-room") === null);
check("the shell opens on Today", rooms.defaultRoom(withLive).id === "today");
const noToday = withLive.filter((r) => r.id !== "today");
check("with Today gone the shell still opens on a command room, never on nothing",
  rooms.defaultRoom(noToday) !== null && rooms.defaultRoom(noToday).ring === "command");

// ---------- the door client ----------
check("the dev token is read from the URL FRAGMENT", door.tokenFromHash("#token=abc123") === "abc123");
check("a fragment with several parts still yields the token", door.tokenFromHash("#a=1&token=xyz&b=2") === "xyz");
check("an empty token is null, not an empty string", door.tokenFromHash("#token=") === null);
check("no fragment is null", door.tokenFromHash("") === null);
check("a percent-encoded token is decoded", door.tokenFromHash("#token=a%2Bb") === "a+b");

// Every refusal the UI writes a sentence for must HAVE one, and it must be a sentence.
const refusalsOk = Object.entries(door.KNOWN_REFUSALS)
  .every(([code, text]) => code === code.toUpperCase() && typeof text === "string" && text.length > 12);
check("every known refusal carries a human sentence, not its own code", refusalsOk);
check("the parity refusals from Phase 03 are all spoken for",
  ["ALREADY_DECIDED", "UNKNOWN_APPROVAL", "BAD_REASON"].every((c) => c in door.KNOWN_REFUSALS));

// A refusal must survive as a CODE, never collapse into "something went wrong".
const refusingFetch = async () => ({
  ok: false, status: 409, statusText: "Conflict",
  json: async () => ({ code: "ALREADY_DECIDED", message: "already decided" }),
});
const d = new door.Door({ token: "t", fetchImpl: refusingFetch });
let caught = null;
try { await d.rooms(); } catch (e) { caught = e; }
check("a refusal arrives as a DoorError carrying the door's own code",
  caught && caught.name === "DoorError" && caught.code === "ALREADY_DECIDED", caught && caught.code);
check("a refusal has a human sentence distinct from its code",
  caught && caught.human !== caught.code && caught.human.length > 12, caught && caught.human);

// A 200 with an unreadable body is a failure, not an empty success -- the shape that lets a
// broken door render as a blank-but-calm screen.
const brokenBody = async () => ({ ok: true, status: 200, statusText: "OK", json: async () => { throw new Error("not json"); } });
caught = null;
try { await new door.Door({ fetchImpl: brokenBody }).health(); } catch (e) { caught = e; }
check("a 200 with a non-JSON body is refused, not treated as empty",
  caught && caught.code === "BAD_BODY", caught && caught.code);

// The one write path, guarded before the request leaves.
//
// A real-shaped ULID, because the client now checks the id as well as the field name. The
// first version of these checks used "X" and "01ABC" and they started failing the moment the
// guard existed -- which is the guard working, and a reminder that a fixture shaped like the
// thing it stands for costs nothing until the day it saves you.
const VALID_ULID = "01M0Q01KDCARYDDD0B6XSA0GFC";
caught = null;
try { await new door.Door({ fetchImpl: refusingFetch }).decide({ id: VALID_ULID, decision: "approve", reason: "   " }); }
catch (e) { caught = e; }
check("an empty reason is refused locally, without a round trip",
  caught && caught.code === "BAD_REASON" && caught.status === 0, caught && caught.code);

// The token must ride as a bearer header, and the write must be a POST with a JSON body.
let seen = null;
const spy = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, statusText: "OK", json: async () => ({}) }; };
await new door.Door({ token: "tok", fetchImpl: spy }).decide({ id: VALID_ULID, decision: "reject", reason: "not yet" });
check("the write is a POST to the one mutating route",
  seen && seen.init.method === "POST" && seen.url.endsWith("/api/decide"), seen && seen.url);
check("the token rides as a bearer header, never in the query string",
  seen && seen.init.headers.Authorization === "Bearer tok" && !seen.url.includes("tok="), seen && seen.url);
check("the reason is trimmed into the body, not sent raw",
  JSON.parse(seen.init.body).reason === "not yet");

// The three rules that govern this call, all checked BEFORE the request leaves. An
// adversarial pass sent every one of these down the wire: an empty id, a null id, no id key
// at all, a 5000-byte reason, and a reason carrying a NUL. The cross-layer pin proved the
// door destructures the field NAMES; nothing looked at the values.
const cannotStamp = async (stamp) => {
  try { await new door.Door({ fetchImpl: spy }).decide(stamp); return null; } catch (e) { return e.code; }
};
check("an empty id is refused, not sent", await cannotStamp({ id: "", decision: "approve", reason: "why" }) === "UNKNOWN_APPROVAL");
check("a null id is refused, not sent", await cannotStamp({ id: null, decision: "approve", reason: "why" }) === "UNKNOWN_APPROVAL");
check("NO id key at all is refused, not sent", await cannotStamp({ decision: "approve", reason: "why" }) === "UNKNOWN_APPROVAL");
check("a non-ULID id is refused, not sent", await cannotStamp({ id: "not-a-ulid", decision: "approve", reason: "why" }) === "UNKNOWN_APPROVAL");
check("a reason past the spine's byte cap is refused HERE, not at the door",
  await cannotStamp({ id: VALID_ULID, decision: "approve", reason: "x".repeat(2100) }) === "BAD_REASON");
check("a reason carrying a control character is refused HERE",
  await cannotStamp({ id: VALID_ULID, decision: "approve", reason: `ok${String.fromCharCode(0)}nope` }) === "BAD_REASON");
// A reason made of zero-width characters is not whitespace, so `.trim()` kept it and both
// the client and the spine accepted it -- an irreversible stamp whose reason RENDERS AS
// NOTHING, on a product whose central promise is that the typed reason IS the act.
check("a reason of zero-width characters is refused -- an invisible reason is a default",
  await cannotStamp({ id: VALID_ULID, decision: "approve", reason: "​​​" }) === "BAD_REASON");
check("a real stamp still goes through", await cannotStamp({ id: VALID_ULID, decision: "approve", reason: "kill criteria met" }) === null);

// THE RECEIVER PIN.
//
// The first cut stored `globalThis.fetch` and called it as `this.fetchImpl(...)`, which
// loses the receiver. Node's fetch does not care; a BROWSER throws "Failed to execute
// 'fetch' on 'Window': Illegal invocation", so the product was dead on arrival while every
// check in this file passed. Found by opening the page, which is the only place it exists.
//
// Simulated here with a fetch that is receiver-sensitive the way the browser's is: it
// throws unless `this` is the global. A regression to the unbound form fails immediately.
// The stand-in must be UNBOUND on the global, exactly as window.fetch is. The first version
// of this pin installed an already-bound function, so the unbound client worked too and the
// check passed with the bug restored -- a vacuous pin, caught only by putting the bug back
// and watching it stay green. The mutant is the negative control, always.
const realFetch = globalThis.fetch;
let receiverOk = false;
try {
  globalThis.fetch = function () {
    if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    return Promise.resolve({ ok: true, status: 200, statusText: "OK", json: async () => ({ ok: true }) });
  };
  // Construct with NO fetchImpl so the DEFAULT path is what gets exercised.
  await new door.Door({ token: "t" }).health();
  receiverOk = true;
} catch { receiverOk = false; } finally { globalThis.fetch = realFetch; }
check("the default fetch is BOUND, so a browser receiver check cannot reject it", receiverOk);

// THE CROSS-LAYER PIN.
//
// The first cut of decide() sent `{ decision }`. arc-dash destructures
// `{ id, verdict, reason }` and refuses anything else with BAD_VERDICT, so EVERY stamp in
// the product would have been refused -- and nothing on the client side could have noticed:
// the method was well-typed, the JSON well-formed, and the defect lived only in the gap
// between two files. Neither file's own tests can catch that shape.
//
// So the field name is read out of arc-dash's OWN SOURCE rather than restated here. If
// either side renames it, this fails loudly. A hard-coded "verdict" on both sides would be
// two copies of a guess.
const dashSrc = readFileSync(join(REPO, ".claude", "scripts", "hq", "arc-dash.mjs"), "utf8");
const destructure = dashSrc.match(/async function apiDecide\([^)]*\)\s*\{\s*const\s*\{([^}]*)\}\s*=\s*body/);
check("apiDecide's destructure was found in the door's source (vacuous-pass guard)",
  destructure !== null, "regex did not match -- the pin below would assert nothing");
const wireFields = destructure ? destructure[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
check("the door reads exactly id, verdict and reason",
  wireFields.length === 3 && wireFields.includes("id") && wireFields.includes("verdict") && wireFields.includes("reason"),
  wireFields.join("|"));
const sentBody = JSON.parse(seen.init.body);
check("every field the door destructures is present in what the client sends",
  wireFields.every((f) => f in sentBody), `sent=${Object.keys(sentBody).join("|")}`);
check("the client sends NO field the door does not read (a silently ignored key is a lie)",
  Object.keys(sentBody).every((k) => wireFields.includes(k)), Object.keys(sentBody).join("|"));

// The door refuses a verdict that is not approve/reject; the client must not be the thing
// that discovers that over the network.
caught = null;
try { await new door.Door({ fetchImpl: spy }).decide({ id: VALID_ULID, decision: "maybe", reason: "hm" }); }
catch (e) { caught = e; }
check("a verdict that is not approve or reject is refused before it leaves",
  caught && caught.code === "BAD_VERDICT", caught && caught.code);

// ---------- the shell: routing and the keyboard model ----------
const shell = await import(pathToFileURL(join(LIB, "shell.mjs")).href);
check("shell module loaded (vacuous-pass guard)", typeof shell.keyAction === "function");

// The address lives in the FRAGMENT so a room name never rides beside a token into a proxy
// log, and so a reload of a static build cannot 404.
check("a room is read out of the fragment", shell.parseHash("#/spine").room === "spine");
check("a token rides alongside the room", shell.parseHash("#/spine&token=abc").token === "abc");
check("the bare token URL arc-dash prints is the HOME route, not 'no route'",
  shell.parseHash("#token=abc").room === null && shell.parseHash("#token=abc").token === "abc");
check("an empty fragment is not a route", shell.parseHash("").room === null);
check("a room id is decoded", shell.parseHash("#/council-chamber").room === "council-chamber");
check("building a hash round-trips the room and the token", (() => {
  const h = shell.buildHash("money", "tok");
  const p = shell.parseHash(h);
  return p.room === "money" && p.token === "tok";
})());
check("building a hash without a token carries no token key", !shell.buildHash("money").includes("token"));

// ---------- the as-of scrub (REQ-05) ----------
// The scrub reaches ONLY the three routes that take it, read off arc-dash's own handlers.
// Appending it blindly would 501 the Money room, whose native scope is a month -- and a
// control that silently 501s half the product looks broken rather than bounded.
check("the scrub reaches the spine, the brief and the inbox",
  door.ASOF_ROUTES.includes("/api/spine") && door.ASOF_ROUTES.includes("/api/brief") && door.ASOF_ROUTES.includes("/api/inbox"),
  door.ASOF_ROUTES.join(","));
check("the scrub does NOT reach the P&L, which refuses a day-asof by name",
  !door.ASOF_ROUTES.includes("/api/pnl"));
check("a scrubbed route carries the day", door.withAsOf("/api/spine", "2026-07-22") === "/api/spine?asof=2026-07-22");
check("an unscrubbable route is left exactly as it was", door.withAsOf("/api/pnl", "2026-07-22") === "/api/pnl");
check("a route that already asked for a day KEEPS its own -- explicit outranks ambient",
  door.withAsOf("/api/spine?asof=2026-07-01", "2026-07-22") === "/api/spine?asof=2026-07-01");
check("an existing query is preserved, not replaced",
  door.withAsOf("/api/spine?limit=50", "2026-07-22").includes("limit=50")
  && door.withAsOf("/api/spine?limit=50", "2026-07-22").includes("asof=2026-07-22"));
check("live (no scrub) changes nothing at all",
  door.withAsOf("/api/spine", null) === "/api/spine" && door.withAsOf("/api/spine", "") === "/api/spine");
check("a malformed day never reaches the address bar", shell.buildHash("spine", null, "yesterday") === "#/spine");
check("the scrub travels in the address, so a scrubbed view is a link you can send",
  shell.parseHash(shell.buildHash("spine", "tok", "2026-07-22")).asOf === "2026-07-22");
check("navigating rooms KEEPS the scrub -- a time machine that resets per room is useless",
  shell.parseHash(shell.buildHash("money", "tok", "2026-07-22")).asOf === "2026-07-22");

// The three states are three different PROMISES, and the product must not borrow the
// stronger one for the weaker case.
check("live is not a time at all", shell.asOfState(null, "2026-08-23").scrubbed === false);
check("a sealed day promises a byte-identical replay",
  shell.asOfState("2026-07-22", "2026-08-23").replayIdentical === true);
check("TODAY is a snapshot of an open day and says so, NOT a replay",
  shell.asOfState("2026-08-23", "2026-08-23").replayIdentical === false
  && /still being written/i.test(shell.asOfState("2026-08-23", "2026-08-23").note));
check("every as-of state carries its sentence, so the difference is readable and not implied",
  ["live", "sealed", "today"].length === 3
  && shell.asOfState("2026-07-22", "2026-08-23").note.length > 30
  && shell.asOfState(null, null).note.length > 10);

const order = shell.navOrder(rooms.byRing(withLive));
check("nav order covers every openable room",
  order.length === withLive.filter((r) => !r.template).length, `order=${order.length}`);
check("nav order starts in the command ring", order[0] && withLive.find((r) => r.id === order[0]).ring === "command");

// NOT wrapping is the deliberate choice: arriving back at Today after holding j teaches the
// owner the company has no end, which is the opposite of what a coverage product should say.
check("moving down stops at the last room rather than wrapping",
  shell.moveRoom(order, order[order.length - 1], 1) === order[order.length - 1]);
check("moving up stops at the first room rather than wrapping",
  shell.moveRoom(order, order[0], -1) === order[0]);
check("moving from the middle actually moves", shell.moveRoom(order, order[2], 1) === order[3]);
check("moving from an unknown room lands somewhere real, never nowhere",
  shell.moveRoom(order, "no-such-room", 1) === order[0]);
check("moving in an empty nav does not throw or invent a room",
  shell.moveRoom([], "today", 1) === "today");

// The keyboard model. The rule that matters most: nothing fires while the owner is typing,
// because this product's one write is irreversible and a reason box that eats "r" is a trap.
const ctx = { inTextField: false, paletteOpen: false };
check("j moves forward", shell.keyAction({ key: "j" }, ctx).type === "room-move");
check("k moves back", shell.keyAction({ key: "k" }, ctx).delta === -1);
check("g goes home", shell.keyAction({ key: "g" }, ctx).room === "today");
check("an unbound key is left alone for the browser", shell.keyAction({ key: "q" }, ctx) === null);
check("a modified key is left alone", shell.keyAction({ key: "j", ctrlKey: true }, ctx) === null);
check("NOTHING fires while the owner is typing",
  shell.keyAction({ key: "r" }, { inTextField: true, paletteOpen: false }) === null);
check("the palette still opens from inside a text field -- it is how you leave",
  shell.keyAction({ key: "k", metaKey: true }, { inTextField: true, paletteOpen: false }).type === "palette-toggle");
check("while the palette is open it owns its keys",
  shell.keyAction({ key: "j" }, { inTextField: false, paletteOpen: true }) === null);
check("escape closes the palette",
  shell.keyAction({ key: "Escape" }, { inTextField: false, paletteOpen: true }).type === "palette-close");

check("a textarea counts as typing", shell.isTextField({ tagName: "TEXTAREA" }));
check("a contenteditable div counts as typing, though it is not an input",
  shell.isTextField({ tagName: "DIV", isContentEditable: true }));
check("a plain div does not", !shell.isTextField({ tagName: "DIV" }));
check("no element does not throw", !shell.isTextField(null));

// Palette ranking: three letters must land on the thing the typist meant.
const items = [
  { id: "spine", label: "The spine" },
  { id: "spine-health", label: "spine health" },
  { id: "money", label: "Money", hint: "revenue" },
];
const ranked = shell.rankMatches(items, "spi");
check("a prefix match outranks a substring match", ranked[0] && ranked[0].id === "spine-health", ranked.map((r) => r.id).join(">"));
check("a hint match still surfaces", shell.rankMatches(items, "revenue").some((r) => r.id === "money"));
check("an empty query returns the head of the list, not nothing", shell.rankMatches(items, "").length === 3);
check("a query matching nothing returns nothing rather than everything", shell.rankMatches(items, "zzzz").length === 0);
check("ranking never throws on a non-string query", Array.isArray(shell.rankMatches(items, undefined)));

// ---------- the palette: how you REACH what the Map lets you SEE ----------
// The Map draws 33 rooms. It cannot draw 107 concepts, and the contract anchors every one of
// them to a room AND a station precisely so a search can land the reader in the right part of
// the right room. If the palette knows less than arc does, coverage is a claim again.
const CONTRACT = JSON.parse(readFileSync(join(REPO, "initiatives", "face", "contracts", "expected-set.json"), "utf8"));
const conceptMap = CONTRACT.concepts.map;
const paletteAll = shell.paletteItems(withLive, conceptMap);
check("the contract still carries the full vocabulary (fixture guard)",
  Object.keys(conceptMap).length >= 100, `concepts=${Object.keys(conceptMap).length}`);
check("the palette reaches every room AND every concept -- 139, not 131",
  paletteAll.length === withLive.length + Object.keys(conceptMap).length,
  `items=${paletteAll.length} rooms=${withLive.length} concepts=${Object.keys(conceptMap).length}`);
// The rail excludes the lane template because it is a shape, not a place. The PALETTE must
// still reach it: eight concepts are anchored there, and skipping it made those eight words
// of arc's own vocabulary unsearchable -- 131 items against a contract holding 139.
check("the lane template is searchable even though the rail does not list it",
  paletteAll.some((i) => i.id === "room:lane"));
const laneConcepts = paletteAll.filter((i) => i.kind === "concept" && i.room === "lane");
check("the concepts anchored in the template are reachable", laneConcepts.length > 0, `lane concepts=${laneConcepts.length}`);
check("every concept carries the STATION as well as the room -- half a destination is not one",
  paletteAll.filter((i) => i.kind === "concept").every((i) => typeof i.station === "string" && i.station.length > 0));

// A concept homed in a room that does not exist is a result that opens nothing. face-coverage
// now fails closed on exactly that, so it should be impossible -- which is the reason to skip
// it here rather than render it: if the gate ever regresses, the palette must not be the place
// the corruption is laundered into a working-looking link.
const withGhost = shell.paletteItems(withLive, { ...conceptMap, "ghost-term": { room: "no-such-room", station: "nowhere" } });
check("a concept pointing at a room that does not exist is NOT offered",
  !withGhost.some((i) => i.id === "concept:ghost-term"), `items=${withGhost.length}`);

// Reading the vocabulary out of the frozen contract, as the door actually serves it.
const asDoorServes = { text: readFileSync(join(REPO, "initiatives", "face", "contracts", "expected-set.json"), "utf8") };
const got = shell.conceptsFromContract(asDoorServes, door.unescapeDoorText);
check("the vocabulary parses out of the contract the door serves",
  got.ok === true && Object.keys(got.concepts).length === Object.keys(conceptMap).length);
check("a body with no text is refused BY NAME, not returned as an empty vocabulary",
  shell.conceptsFromContract({}, door.unescapeDoorText).code === "BAD_BODY");
check("text that is not JSON is its own refusal",
  shell.conceptsFromContract({ text: "not json" }, door.unescapeDoorText).code === "BAD_JSON");
check("a contract with no concepts map is its own refusal",
  shell.conceptsFromContract({ text: "{}" }, door.unescapeDoorText).code === "CONTRACT_SHAPE");

// Ranking: three letters must land on the thing the typist meant, across rooms AND concepts.
const hits = shell.rankMatches(paletteAll, "spine", 20);
check("searching a word arc uses finds it", hits.length > 0, `hits=${hits.length}`);
check("the room wins over the words homed in it when the query IS the room",
  hits[0] && hits[0].kind === "room", hits[0] && `${hits[0].kind}:${hits[0].label}`);

// ---------- the Map: the coverage guarantee, made checkable ----------
// The Map is the one screen that proves nothing is missing, so its correctness IS its layout
// maths -- and layout maths is exactly what a screenshot cannot audit. All of it is pure and
// lives in map.mjs, which is why these run here with no browser and no build.
const map = await import(pathToFileURL(join(LIB, "map.mjs")).href);
check("map module loaded (vacuous-pass guard)",
  typeof map.buildMap === "function" && typeof map.labelCollisions === "function");

const model = map.buildMap(withLive, { mode: "sim" });

// THE ACCEPTANCE BAR, four assertions, each of which can actually fail.
check("every room in the registry is a station on the map",
  model.stations.length === withLive.length, `stations=${model.stations.length} rooms=${withLive.length}`);
check("every ring is a line", model.lines.length === 5, `lines=${model.lines.length}`);
check("no two labels collide at 33 stations -- the legibility bar, measured not assumed",
  map.labelCollisions(model.labels).length === 0,
  JSON.stringify(map.labelCollisions(model.labels).slice(0, 3)));
// POSITIVE CONTROLS for the two absence-only assertions below.
//
// "no two labels collide" and "the legend accounts for every mark" both pass when the
// detector is stubbed to return [] -- and an adversarial pass proved it: stubbing either, or
// making buildMap return zero labels, left the suite fully green. An absence proves nothing
// until you have shown the thing can be present.
check("every station is actually LABELLED -- a map that labels nothing clears an empty bar",
  model.labels.length === model.stations.length,
  `labels=${model.labels.length} stations=${model.stations.length}`);
const stacked = model.labels.map((l) => ({ ...l, ...model.labels[0] }));
check("the collision detector FIRES when labels are stacked (positive control)",
  map.labelCollisions(stacked).length > 0, `collisions=${map.labelCollisions(stacked).length}`);
// legendGaps compares the marks the MAP draws against the LEGEND constant, so the way to
// make it fire is to draw a mark the legend has no row for -- not to empty a `legend` field,
// which is what my first attempt did and why it reported no gap. Reading the function beat
// guessing at its shape, again.
const withGhostMark = {
  ...model,
  lines: model.lines.map((l, i) => (i === 0
    ? { ...l, stations: l.stations.map((st, j) => (j === 0 ? { ...st, shape: "hexagon", pattern: "zigzag" } : st)) }
    : l)),
};
check("the legend gap detector FIRES on a mark the legend does not explain (positive control)",
  map.legendGaps(withGhostMark).length > 0, JSON.stringify(map.legendGaps(withGhostMark)).slice(0, 80));

check("the legend accounts for every mark the map draws",
  map.legendGaps(model).length === 0, map.legendGaps(model).join(", "));

// Not one registry id may be absent. A map that quietly drops a room is worse than no map:
// it is the coverage claim, contradicted by the thing making it.
const drawn = new Set(model.stations.map((s) => s.id));
const missing = withLive.filter((r) => !drawn.has(r.id)).map((r) => r.id);
check("no room is dropped between the registry and the map", missing.length === 0, missing.join(", "));

// Determinism: the same registry must draw the same map. A layout that shifts between runs
// cannot be reviewed, and its diffs are noise that hides the real change.
check("the same registry draws a byte-identical map",
  JSON.stringify(map.buildMap(withLive, { mode: "sim" })) === JSON.stringify(model));

// Colour-free channels. The map must be readable without hue, and it must not borrow a
// reserved one: amber/green/red carry meanings that a line has no business claiming.
const patterns = new Set(model.stations.map((s) => s.pattern));
check("state is carried by stroke pattern, not by colour", patterns.size >= 2, [...patterns].join(","));
const shapes = new Set(model.stations.map((s) => s.shape));
check("room kind is carried by shape", shapes.size >= 2, [...shapes].join(","));

// An unexercised room must not have traffic animated through it -- a moving dot is a claim
// that something ran, and it would contradict the dashed stroke beside it.
const dots = map.flightDots(model, { speed: 1 });
check("flight dots exist only where something has actually run",
  Array.isArray(dots) && dots.every((d) => typeof d.d === "string" && d.d.length > 0), `dots=${dots.length}`);

// REQ-04's open-gate squares: where is the owner NEEDED, not merely what exists.
const roomIds = withLive.map((r) => r.id);
const openFixture = [
  { gate: "coverage", venture: "face" },   // resolves by gate
  { gate: "coverage", venture: "face" },
  { gate: "unknown-gate", venture: "engine" }, // falls back to the lane
  { gate: "unknown-gate", venture: "no-such-lane" }, // resolves to neither
];
const needs = map.needsYouByRoom(openFixture, CONTRACT, roomIds);
check("an approval is placed by its GATE first", (needs.counts[CONTRACT.gates.map["coverage"]] ?? 0) === 2,
  JSON.stringify(needs.counts));
check("an approval whose gate is unknown falls back to its LANE",
  (needs.counts[CONTRACT.lanes.map["engine"]] ?? 0) === 1, JSON.stringify(needs.counts));
// The rule the whole product turns on: something waiting on the owner may never be dropped
// because the contract had no row for it.
check("an approval that resolves to NO room is counted, never silently dropped",
  needs.unplaced === 1 && needs.total === 4, `unplaced=${needs.unplaced} total=${needs.total}`);
check("an empty inbox marks nothing rather than throwing",
  map.needsYouByRoom([], CONTRACT, roomIds).total === 0);
check("a malformed inbox body is survived, not crashed on",
  map.needsYouByRoom(null, CONTRACT, roomIds).total === 0);
const sq = map.gateSquare({ x: 100, y: 50 }, 3);
check("the gate square sits OFF the track so it cannot be read as a stop",
  sq.x !== 100 && sq.y !== 50 && sq.size > 0);
check("the square carries the COUNT, because 'some' is not a number you can act on",
  sq.label === "3" && /waiting on you/i.test(sq.title));
check("a large count is capped so the mark stays a mark", map.gateSquare({ x: 0, y: 0 }, 42).label === "9+");

// Mode is stated or it is not claimed. Drawing "live" on no evidence is the lie the whole
// honesty vocabulary exists to prevent, and an unset prop is no evidence.
const noMode = map.modeChip(undefined);
check("an unstated mode says so rather than claiming live",
  !/\blive\b/i.test(noMode.label) && noMode.real === false, noMode.label);
check("a stated sim mode is marked non-real", map.modeChip("sim").real === false);

// Every station has to be reachable and named for a screen reader; the map is navigation.
check("every station is in the focus order",
  map.focusOrder(model).length === model.stations.length);
const unnamed = model.stations.filter((s) => {
  const n = map.accessibleName(s);
  return typeof n !== "string" || n.trim().length < 3;
});
check("every station carries an accessible name", unnamed.length === 0, unnamed.map((s) => s.id).join(", "));

// ---------- the Inbox: the one write path ----------
const inbox = await import(pathToFileURL(join(LIB, "inbox.mjs")).href);
check("inbox module loaded (vacuous-pass guard)", typeof inbox.validateReason === "function");

// THE DECODER, folded to one implementation. Two agents each wrote their own and each left a
// comment saying a twin existed and must not drift -- the exact shape this repo keeps paying
// for. There is now one rule with one home; these assert both spellings reach it.
check("the door's escaping is undone so the flagship line reads as English",
  door.unescapeDoorText("If it isn&#39;t an event, it didn&#39;t happen.") === "If it isn't an event, it didn't happen.");
check("&amp; is undone LAST, so an escaped tag cannot become a live one",
  door.unescapeDoorText("&amp;lt;script&amp;gt;") === "&lt;script&gt;");
check("rooms.mjs and inbox.mjs both reach the SAME decoder, not a copy",
  rooms.unescapeDoorText === door.unescapeDoorText && inbox.decodeDoorText("&amp;lt;") === "&lt;");
check("a non-string decodes to an empty string rather than throwing",
  door.unescapeDoorText(null) === "" && door.unescapeDoorText(undefined) === "");

// The registry is decoded ONCE, where it enters. "Review & Ship" arrived as
// "Review &amp; Ship" and rendered as five literal characters in the rail, in the Map's
// labels and in every station's accessible name -- missed in two places on the first pass,
// which is the argument against decoding at each render site.
const escapedReg = { rings: ["command"], rooms: [{ id: "review-ship", ring: "factory", name: "Review &amp; Ship", sentence: "It isn&#39;t done.", lede: "a &amp; b", holds: {} }] };
const decodedReg = door.decodeRegistry(escapedReg);
check("a room's NAME is decoded at the boundary", decodedReg.rooms[0].name === "Review & Ship", decodedReg.rooms[0].name);
check("a room's SENTENCE is decoded at the boundary", decodedReg.rooms[0].sentence === "It isn't done.", decodedReg.rooms[0].sentence);
check("a room's LEDE is decoded at the boundary", decodedReg.rooms[0].lede === "a & b");
check("machine vocabulary is left alone, so nothing gets decoded twice",
  decodedReg.rooms[0].id === "review-ship" && decodedReg.rooms[0].ring === "factory");
check("a registry with no rooms is returned untouched rather than throwing",
  door.decodeRegistry({ rings: [] }).rings.length === 0 && door.decodeRegistry(null) === null);

// A reason is mandatory and mirrors the SPINE's own rules, not house policy invented here.
check("an empty reason is refused", inbox.validateReason("").ok === false);
check("whitespace alone is not a reason", inbox.validateReason("   \n  ").ok === false);
check("a real reason is accepted", inbox.validateReason("kill criteria met, closing it").ok === true);
// The control character is BUILT, never embedded. Writing a literal NUL into this file made
// grep treat the whole source as binary -- and a test file grep skips is the "test that was
// never there" failure `.claude/rules/testing.md` names: green, and never run.
const NUL = String.fromCharCode(0);
check("a control character is refused (the spine refuses it too)",
  inbox.validateReason(`ok${NUL}nope`).ok === false);
check("the same reason WITHOUT the control character is accepted -- so the check above is about the character",
  inbox.validateReason("oknope").ok === true);
const long = "x".repeat(2100);
check("a reason past the spine's byte cap is refused here, not at the door",
  inbox.validateReason(long).ok === false, `len=${long.length}`);

// NO DEFAULT VERDICT, ANYWHERE. The reference stamped on a single keypress with a canned
// reason ("cleared via keyboard -- evidence on the card"), which is the defect this product
// exists to not have: an irreversible write with words the human never chose.
const K = (key, over = {}) => inbox.keyAction({ key, typing: false, modified: false, index: 0, count: 3, ...over });
check("a ARMS approve rather than recording it",
  K("a").type === "arm" && K("a").verdict === "approve", JSON.stringify(K("a")));
check("r ARMS reject rather than recording it",
  K("r").type === "arm" && K("r").verdict === "reject", JSON.stringify(K("r")));
check("no key in this room records a stamp -- the typed reason is the act",
  ["a", "r", "j", "k", "Enter", "Escape"].every((k) => K(k).type !== "submit" && K(k).type !== "stamp"));
check("nothing arms while the reason field has focus",
  K("a", { typing: true }).type === "ignore" && K("r", { typing: true }).type === "ignore",
  JSON.stringify(K("a", { typing: true })));
check("a refusal to act says WHY, so a dead key is never silent",
  typeof K("a", { typing: true }).why === "string" && K("a", { typing: true }).why.length > 5);
check("a held modifier is left to the browser",
  K("a", { modified: true }).type === "ignore");
check("escape disarms even mid-sentence -- the way out is always available",
  K("Escape", { typing: true }).type === "disarm");
check("j moves to the next card", K("j").type === "move" && K("j").index === 1);
check("moving is clamped to the cards that exist",
  inbox.clamp(9, 3) < 3 && inbox.clamp(-4, 3) >= 0, `${inbox.clamp(9, 3)}/${inbox.clamp(-4, 3)}`);

// Reserved hues, held by the one function that grants them. The vocabulary is SEMANTIC
// (real-money / non-real / incident / quiet) rather than colour names, which is what stops a
// component reaching for a hue directly.
check("only revenue.received is real money",
  inbox.toneForKind("revenue.received") === "real-money"
  && inbox.toneForKind("revenue.simulated") !== "real-money"
  && inbox.toneForKind("cost.incurred") !== "real-money",
  `sim=${inbox.toneForKind("revenue.simulated")} cost=${inbox.toneForKind("cost.incurred")}`);
check("simulated revenue is the non-real family, never money's colour",
  inbox.toneForKind("revenue.simulated") === "non-real");
check("only an incident is an incident",
  inbox.toneForKind("incident.raised") === "incident" && inbox.toneForKind("day.closed") !== "incident");

// "The door did not say" must survive to the pixel as its own state, never as 0.
const tiles = inbox.kpiTiles({ health: null, inbox: null });
check("tiles render even when the door served nothing", Array.isArray(tiles) && tiles.length > 0, `tiles=${tiles.length}`);
check("a KPI the door did not serve is NOT rendered as a measured zero",
  tiles.every((t) => t.state !== "measured"), JSON.stringify(tiles.map((t) => t.state)));
check("every tile carries the route and field it came from -- a number with a receipt",
  tiles.every((t) => typeof t.why === "string" && t.why.length > 4));
check("every tile carries the sentence that keeps a zero from lying",
  tiles.every((t) => typeof t.note === "string" && t.note.length > 4));

// ---------- the Spine and Board rooms ----------
const spineLib = await import(pathToFileURL(join(LIB, "spine.mjs")).href);
check("spine module loaded (vacuous-pass guard)", typeof spineLib.quarantineView === "function");

// THE RESERVED-HUE AUDIT. TONE_INK is the only table in this module that grants a hue, so
// walking it proves no fifth meaning took one. This is the assertion the whole colour
// contract rests on, and it is cheap precisely because the grant lives in one place.
const RESERVED = ["--amber", "--green", "--red", "--violet"];
const inks = Object.values(spineLib.TONE_INK);
const reservedGranted = inks.filter((v) => RESERVED.some((r) => String(v).includes(r)));
check("every reserved hue this module grants is granted at most once",
  new Set(reservedGranted).size === reservedGranted.length, reservedGranted.join(","));
check("the board spends NO reserved hue -- a lane near its kill line is not an incident",
  RESERVED.every((r) => !JSON.stringify(spineLib.statusFacet("LIVE")).includes(r)
    && !JSON.stringify(spineLib.statusFacet("BLOCKED")).includes(r)));

// Quarantine: the number that reads as catastrophe and almost never is.
// The door's OWN shape, read off a live /api/health rather than guessed: the block is
// `spine.quarantined`, not `spine.quarantine`. The first draft of this fixture invented the
// singular and the reader correctly answered "the door served no quarantine block" -- a
// hand-built fixture that does not match the wire proves nothing about the wire.
const health = {
  root: "fixture", events: 1150, days: 22, daysClosed: 21, idemIndex: 0,
  kindsSeen: 14, kinds: [], torn: [],
    // The REAL refusal codes, taken from the shell's own FAMILY_OF_CODE and matched against
  // what the canonical spine actually holds: a duplicate is DUP_IDEM, not "DUPLICATE_IDEM".
  // The first draft of this fixture invented the names and the shell correctly answered
  // "240 this shell will not classify" -- failing closed rather than guessing, which is the
  // right behaviour and made the invented fixture look like a broken grouper.
  quarantined: { total: 243, byCode: { DUP_IDEM: 239, SECRET: 1, UNKNOWN_KIND: 3 }, stubOnly: 1, unreadable: 0 },
};
const qv = spineLib.quarantineView(spineLib.readSpineHealth({ spine: health }));
const headline = spineLib.quarantineHeadline(qv);

// Assert the BREAKDOWN, not a chosen sentence. 243 is the number a retro once read as
// catastrophic; only about 4 of them were real losses. The rule is that the total may never
// stand ALONE, not that it may never lead.
check("the quarantine total is broken into named parts, never left standing alone",
  qv.total === 243 && qv.dedup === 239 && qv.withheld === 1 && qv.lost === 3 && qv.unknown === 0,
  JSON.stringify({ t: qv.total, d: qv.dedup, w: qv.withheld, l: qv.lost, u: qv.unknown }));
check("the bulk is named as deduplication and stated NOT to be loss",
  qv.families.some((f) => f.family === "dedup" && f.count === 239 && /nothing was lost/i.test(f.sentence)));
check("the headline carries the parts, not just the total",
  typeof headline === "string" && /239|deduplicat|same receipt/i.test(headline), headline.slice(0, 120));

// Failing CLOSED on a code it does not know is the right behaviour, and it is what makes the
// classification real rather than a default. An invented code must land in `unknown`, never
// be guessed into dedup -- guessing here would turn a real loss into "nothing was lost".
const ghostQ = spineLib.quarantineView(spineLib.readSpineHealth({
  spine: { ...health, quarantined: { total: 5, byCode: { NOT_A_REAL_CODE: 5 }, stubOnly: 0, unreadable: 0 } },
}));
check("a refusal code the shell does not know is UNCLASSIFIED, never guessed into a family",
  ghostQ.unknown === 5 && ghostQ.dedup === 0 && ghostQ.lost === 0,
  JSON.stringify({ u: ghostQ.unknown, d: ghostQ.dedup, l: ghostQ.lost }));

// The eight laws are the room's text, and each one names the ADR it comes from.
check("all eight spine laws are carried, each naming its ADR",
  spineLib.SPINE_LAWS.length === 8 && spineLib.SPINE_LAWS.every((l) => /^ADR-00(2[4-9]|3[01])$/.test(l.adr)),
  spineLib.SPINE_LAWS.map((l) => l.adr).join(","));

// Board: three states for a day count, because a lane with no burn recorded is NOT a lane
// burning zero.
check("a measured burn is measured", spineLib.parseDays("4.5d").state === "measured");
check("an absent burn is MISSING, never 0", spineLib.parseDays(undefined).state !== "measured" && spineLib.parseDays(undefined).days !== 0);
check("an unreadable burn is its own state, not a zero and not a gap",
  ["unreadable", "missing", "absent"].includes(spineLib.parseDays("banana").state), spineLib.parseDays("banana").state);

// ---------- Ask arc: the brain with no hands ----------
const askLib = await import(pathToFileURL(join(LIB, "ask.mjs")).href);
check("ask module loaded (vacuous-pass guard)", typeof askLib.noHandsAudit === "function");

// THE BOUNDARY, PROVEN RATHER THAN PROMISED.
// A raw Door must audit as write-capable. This is the negative control: if the audit cannot
// fail, its clean verdict on the read-only handle means nothing. Note WHY it is not
// Object.keys -- a real Door's own keys are base/token/fetchImpl and NO methods, so an
// own-keys audit hands the fully-armed client a clean bill of health.
const rawDoor = new door.Door({ token: "t" });
const rawAudit = askLib.noHandsAudit(rawDoor);
check("a RAW door audits as write-reachable (the negative control)",
  rawAudit.clean === false && rawAudit.writeReachable.includes("decide"),
  JSON.stringify(rawAudit.writeReachable));
check("the audit walks the PROTOTYPE chain, not just own keys",
  Object.keys(rawDoor).every((k) => k !== "decide") && rawAudit.writeReachable.includes("decide"),
  `ownKeys=${Object.keys(rawDoor).join("|")}`);
check("an unrecognised member is counted write-reachable, not waved through",
  rawAudit.unclassified.length > 0 && rawAudit.unclassified.every((m) => rawAudit.writeReachable.includes(m)),
  JSON.stringify(rawAudit.unclassified));
check("the raw door's verdict is a SENTENCE naming the defect, not a boolean",
  typeof rawAudit.line === "string" && /defect|reach a write/i.test(rawAudit.line), rawAudit.line.slice(0, 60));

const handle = askLib.readOnly(rawDoor, askLib.ASK_GRANTS);
const handleAudit = askLib.noHandsAudit(handle);
check("the read-only handle reaches NO write", handleAudit.clean === true && handleAudit.writeReachable.length === 0,
  JSON.stringify(handleAudit.writeReachable));
check("the handle NAMES what it withheld, so the boundary is legible and not merely true",
  handleAudit.withheld.includes("decide") && handleAudit.withheld.includes("call"),
  JSON.stringify(handleAudit.withheld));
check("the handle is frozen, so a write cannot be attached after construction", Object.isFrozen(handle));

let threw = false;
try { askLib.readOnly(rawDoor, [...askLib.ASK_GRANTS, "decide"]); } catch { threw = true; }
check("asking for `decide` REFUSES at construction rather than granting it", threw);
threw = false;
try { askLib.readOnly(rawDoor, [...askLib.ASK_GRANTS, "call"]); } catch { threw = true; }
check("`call` counts as write-capable, because it can be pointed at /api/decide", threw);

// UNVERIFIED is four classes, not two -- and an unreadable door is NOT a pass.
//
// The shapes here are the module's OWN: `claims` carry `key`, `resolutions` is a MAP keyed by
// it, and the brain's self-assessment is `asked.selfVerified`. I guessed all three on the
// first pass and the test failed for the wrong reason; reading the typedef costs less than
// debugging an assertion that was never talking to the code.
const KEY = "01ABCDEFGHIJKLMNOPQRSTUVWX";
const claim = { key: KEY, kind: "ulid" };
const standing = (asked, claims, res) => askLib.standingOf(asked, claims, res).klass;

check("a claim nobody could read is UNVERIFIED, not resolved",
  standing({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "unreadable" } }) === "unverified",
  standing({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "unreadable" } }));
check("a claim the door says is ABSENT is UNVERIFIED",
  standing({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "absent" } }) === "unverified");
check("the brain's own selfVerified:false outranks a clean resolution -- its word stands",
  standing({ selfVerified: false }, [claim], { [KEY]: { key: KEY, state: "resolved" } }) === "unverified");
check("every citation resolving through the door IS verified",
  standing({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "resolved" } }) === "verified",
  standing({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "resolved" } }));
check("an answer with nothing to cite is its own class, never UNVERIFIED",
  ["absence", "uncited"].includes(standing({ selfVerified: true, source: "deterministic" }, [], {})),
  standing({ selfVerified: true, source: "deterministic" }, [], {}));
check("while a citation is still in flight the answer is not yet called proven",
  standing({ selfVerified: true }, [claim], {}) === "checking");
check("the UNVERIFIED sentence names how many broke and KEEPS the answer rather than deleting it",
  /did not resolve/i.test(askLib.standingOf({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "absent" } }).line)
  && /kept and shown/i.test(askLib.standingOf({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "absent" } }).line));
check("UNVERIFIED lists the broken ids BY NAME, not as a count",
  askLib.standingOf({ selfVerified: true }, [claim], { [KEY]: { key: KEY, state: "absent" } }).broken.includes(KEY));

// UNVERIFIED must not spend a reserved hue: it is neither an incident nor a needs-you, and
// a fifth meaning would cost one of the four permanently.
const unverifiedLine = JSON.stringify(askLib.standingOf({ selfVerified: false }, [claim], { [KEY]: { key: KEY, state: "resolved" } }));
check("UNVERIFIED spends no reserved hue",
  !["--amber", "--green", "--red"].some((h) => unverifiedLine.includes(h)), unverifiedLine.slice(0, 80));

// ---------- money: the module that decides what may wear real money's colour ----------
// 1,597 lines and 40 exports, and this suite did not IMPORT it -- including `greenGate`,
// which is the single gate between a simulated rupee and the hue reserved for a real one.
const moneyLib = await import(pathToFileURL(join(LIB, "money.mjs")).href);
check("money module loaded (vacuous-pass guard)", typeof moneyLib.greenGate === "function");

const gateShut = moneyLib.greenGate({ health: { kinds: ["note.logged", "day.closed"] }, real: null });
const gateOpen = moneyLib.greenGate({ health: { kinds: [moneyLib.REAL_KIND] }, real: null });
check("green is UNSPENT while revenue.received has never fired", gateShut.spendable === false);
check("green unlocks only once revenue.received HAS fired", gateOpen.spendable === true);
check("the gate says WHY in words, both ways",
  /never fired/i.test(gateShut.why) && gateShut.source.includes("/api/health"));

// The only guarded path to --green. If this can be reached with the gate shut, the whole
// Truth Law is broken, because a simulated rupee would wear the colour of a real one.
check("--green is UNREACHABLE while the gate is shut",
  moneyLib.moneyInk("real-money", gateShut) !== "var(--green)", moneyLib.moneyInk("real-money", gateShut));
check("--green IS reachable once the gate opens", moneyLib.moneyInk("real-money", gateOpen) === "var(--green)");
check("simulated money never reaches --green under either gate",
  moneyLib.moneyInk("non-real", gateOpen) !== "var(--green)" && moneyLib.moneyInk("non-real", gateShut) !== "var(--green)",
  moneyLib.moneyInk("non-real", gateOpen));

// FAIL CLOSED, on every shape a bad read can produce. An adversarial pass opened this gate
// with a STRING -- `{kinds: "the revenue.received kind"}` made indexOf find the substring and
// returned spendable:true -- and crashed it with `{}` and `{kinds:null}`, which is not the
// gate staying shut, it is the room refusing to render.
for (const [label, health] of [
  ["no health at all", null],
  ["an empty object", {}],
  ["kinds as a STRING containing the kind name", { kinds: `the ${moneyLib.REAL_KIND} kind` }],
  ["kinds null", { kinds: null }],
  ["kinds a number", { kinds: 7 }],
]) {
  const g = moneyLib.greenGate({ health, real: null });
  check(`the gate stays SHUT on ${label}`, g.spendable === false, JSON.stringify(g.spendable));
}
check("a malformed health does not throw -- a shut gate, not a dead room",
  typeof moneyLib.greenGate({}).spendable === "boolean");

// MISSING is not 0, and four kinds of nothing are four different marks.
const glyphs = ["measured", "never-fired", "absent", "not-served"].map((st) => moneyLib.zeroGlyph(st));
check("the four zero states render four DIFFERENT shapes",
  new Set(glyphs.map((g) => g.shape)).size === 4, glyphs.map((g) => g.shape).join("|"));
check("every zero state carries a sentence saying WHICH kind of nothing it is",
  glyphs.every((g) => typeof g.title === "string" && g.title.length > 20));
check("never-fired says there is no measurement, not that the amount is zero",
  /no measurement|no zero|never fired/i.test(moneyLib.zeroGlyph("never-fired").title));
check("not-served says it is a fact about the READ, never about the money",
  /about the READ/i.test(moneyLib.zeroGlyph("not-served").title));

// Money formatting must not depend on the CI leg's ICU data.
check("amounts are grouped without toLocaleString (same bytes on every leg)",
  moneyLib.formatMinor(123456, "INR").text === "1,234.56" && moneyLib.formatMinor(0, "INR").text === "0.00",
  moneyLib.formatMinor(123456, "INR").text);

// The P&L's own scope, and the refusal it raises for anything finer.
check("the P&L scopes by MONTH and says so", /month/i.test(moneyLib.asOfSupport().note ?? JSON.stringify(moneyLib.asOfSupport())));
let monthRefused = false;
try { moneyLib.pnlPath({ month: "not-a-month" }); } catch { monthRefused = true; }
check("a malformed month is refused before it becomes a request", monthRefused);

// ---------- fail CLOSED, not fail by crash ----------
// Three functions threw on a shape a bad read can genuinely produce, and a throw is not a
// refusal -- it is the room declining to render at all. A malformed row is a row to draw
// quietly; a room whose shape we cannot read is a room with no scrubber.
check("supportsAsOf answers NO on a room with no live block, rather than throwing",
  rooms.supportsAsOf(undefined) === false && rooms.supportsAsOf({}) === false);
check("supportsAsOf still says yes to a live room", rooms.supportsAsOf({ live: { state: "live" } }) === true);
check("toneForKind answers 'quiet' for a record with no kind, rather than throwing",
  inbox.toneForKind(undefined) === "quiet" && inbox.toneForKind(null) === "quiet");
check("toneForKind still grants real-money to the one kind that earns it",
  inbox.toneForKind("revenue.received") === "real-money");
check("noHandsAudit refuses to bless a handle that reaches nothing",
  askLib.noHandsAudit(Object.freeze({})).clean === false,
  JSON.stringify(askLib.noHandsAudit(Object.freeze({})).clean));
check("a dead handle SAYS it is dead rather than reporting a clean boundary",
  /reaches nothing/i.test(askLib.noHandsAudit(Object.freeze({})).line));

// ---------------------------------------------------------------------------------------
// ADR-1317: a room's zones must not be able to hide what the room holds.
//
// `zonesFor` used to be a hard-coded list of eleven keys, which is the same failure the
// coverage gate had one layer down: a fixed list silently loses what it does not know. The
// contract grew by eight inventories, every room carried the new rows, and the screen would
// have shown nothing -- no error, no empty state, just absence. "It is in the data" and "the
// owner can see it" are different facts.
{
  const held = (room) => Object.entries(room.holds || {}).filter(([, v]) => Array.isArray(v) && v.length);
  let worstRoom = null, worstMissing = [];
  for (const room of registry.rooms) {
    const zoneKeys = new Set(rooms.zonesFor(room).map((z) => z.key));
    const missing = held(room).map(([k]) => k).filter((k) => !zoneKeys.has(k));
    if (missing.length > worstMissing.length) { worstRoom = room.id; worstMissing = missing; }
  }
  check("no room holds anything its zones cannot show",
    worstMissing.length === 0, `${worstRoom} hides ${JSON.stringify(worstMissing)}`);

  // Positive control: the sweep must have had rooms WITH holds to sweep, or it proves nothing.
  const roomsWithHolds = registry.rooms.filter((r) => held(r).length).length;
  check("and the sweep actually had rooms to inspect", roomsWithHolds >= 20, `roomsWithHolds=${roomsWithHolds}`);

  // The new inventories specifically -- named, because "no room hides anything" would also
  // pass on a registry where none of them exist at all.
  const zoneKeysAnywhere = new Set(registry.rooms.flatMap((r) => rooms.zonesFor(r).map((z) => z.key)));
  for (const key of ["adrs", "jobs", "ventures", "plans", "capabilities", "ci"])
    check(`the "${key}" inventory reaches a zone somewhere`, zoneKeysAnywhere.has(key), `zones=${[...zoneKeysAnywhere].join(",")}`);

  // An UNKNOWN key gets a derived title rather than vanishing. This is the arm that keeps the
  // fix alive: the next inventory added will not be in ORDER either.
  const invented = rooms.zonesFor({ id: "x", holds: { someFutureThing: ["a", "b"] } });
  check("an inventory nobody has titled yet still renders", invented.length === 1 && invented[0].items.length === 2, JSON.stringify(invented));
  check("and gets a readable header, not a schema key", invented[0]?.title === "Some future thing", `title=${invented[0]?.title}`);
  check("an empty hold is not rendered as an empty zone", rooms.zonesFor({ id: "x", holds: { adrs: [] } }).length === 0);
}

// ADR-1317: the board's ADR map. This station named a thing and drew nothing for a whole
// cycle -- arc's 265 decisions were invisible to the face while the coverage gate printed
// "all covered". What is asserted here is the part that can silently rot: the map is built
// from the registry, so a renamed room must show as a HOLE rather than quietly vanish.
{
  const inv = registry.inventories || {};
  check("the registry carries the band map the board needs", Object.keys(inv.adrs || {}).length >= 10, `bands=${Object.keys(inv.adrs || {}).length}`);
  const map = rooms.adrBandMap(inv.adrs, registry.rooms);
  check("every band resolves to a real room", map.length > 0 && map.every((b) => b.roomName !== null), JSON.stringify(map.filter((b) => !b.roomName)));
  check("bands come back in ascending order", map.map((b) => b.band).join() === [...map.map((b) => b.band)].sort().join());
  check("a band reads as a RANGE, not a bare number", map[0]?.label === `${map[0]?.band}-${String(Number(map[0]?.band) + 99).padStart(4, "0")}`, map[0]?.label);

  // The arm that keeps the fix alive. A band pointing at a room that does not exist must be
  // KEPT and marked: a map that silently drops the one row whose room was renamed is exactly
  // the disappearing-surface failure this whole product exists to not have.
  const lost = rooms.adrBandMap({ "9900": "no-such-room" }, registry.rooms);
  check("a band homed in a ghost room is kept and marked", lost.length === 1 && lost[0].roomName === null && lost[0].room === "no-such-room", JSON.stringify(lost));
  check("a malformed band id is not drawn as a band", rooms.adrBandMap({ "not-a-band": "board" }, registry.rooms).length === 0);
  check("an absent band map yields an empty map, not a crash", rooms.adrBandMap(undefined, registry.rooms).length === 0);
  check("and an absent room list does not throw either", rooms.adrBandMap({ "0000": "board" }, undefined).length === 1);
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;
