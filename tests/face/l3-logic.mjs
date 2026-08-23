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

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exitCode = failed === 0 && ran >= 35 ? 0 : 1;
