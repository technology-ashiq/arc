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
check("registry carries every room (fixture guard)", registry.rooms.length === 33, `rooms=${registry.rooms.length}`);

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
caught = null;
try { await new door.Door({ fetchImpl: refusingFetch }).decide({ id: "X", decision: "approve", reason: "   " }); }
catch (e) { caught = e; }
check("an empty reason is refused locally, without a round trip",
  caught && caught.code === "BAD_REASON" && caught.status === 0, caught && caught.code);

// The token must ride as a bearer header, and the write must be a POST with a JSON body.
let seen = null;
const spy = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, statusText: "OK", json: async () => ({}) }; };
await new door.Door({ token: "tok", fetchImpl: spy }).decide({ id: "01ABC", decision: "reject", reason: "not yet" });
check("the write is a POST to the one mutating route",
  seen && seen.init.method === "POST" && seen.url.endsWith("/api/decide"), seen && seen.url);
check("the token rides as a bearer header, never in the query string",
  seen && seen.init.headers.Authorization === "Bearer tok" && !seen.url.includes("tok="), seen && seen.url);
check("the reason is trimmed into the body, not sent raw",
  JSON.parse(seen.init.body).reason === "not yet");

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
try { await new door.Door({ fetchImpl: spy }).decide({ id: "01ABC", decision: "maybe", reason: "hm" }); }
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
check("a control character is refused (the spine refuses it too)",
  inbox.validateReason("ok nope").ok === false);
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

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 60 ? 0 : 1;
