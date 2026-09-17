// registry.mjs -- which module draws which served room, and the other questions the shell asks of
// the served registry (face v2 Phase 02, ADR-1306, ADR-1320, ADR-1321).
//
// THE SERVED REGISTRY IS THE ONLY ROOM LIST. `GET /api/rooms` says which rooms exist, in which ring
// and in which order; a module folder only ATTACHES to one of them. A folder is a list too, so the
// attachment is checked both ways: a folder whose id the door does not serve is an orphan and draws
// nothing, and a served room with no module draws through the generic module and is reported by
// id. tests/face/module-frame.mjs holds this file's answer on the real tree EQUAL to face-coverage's
// module half, so the browser and the gate cannot disagree about which rooms are generic.
//
// Dependency-free like every lib module: node imports it with no install, and a decision here is
// a decision a test can hold. No room id is spelled in this file -- the shell names no room.
import { byRing } from "./rooms.mjs";
import { ASOF_ROUTES, DOOR_ROUTES, DoorError } from "./door.mjs";
import { refusalOf, stamp } from "./inbox.mjs";
import { ASK_GRANTS, askable, askThrough, readOnly } from "./ask.mjs";

/** A module is these four files, and no fifth (ADR-1320). */
export const MODULE_FILES = Object.freeze(["module.mjs", "fold.mjs", "ops.mjs", "View.tsx"]);
const NAME = /^[a-z][a-z0-9-]*$/;
// Exactly what `import.meta.glob('./modules/*/*/FILE')` produces: three segments under modules/.
const KEY = /^\.\/modules\/([^/\\?#]+)\/([^/\\?#]+)\/(module\.mjs|fold\.mjs|ops\.mjs|View\.tsx)$/;

/**
 * @typedef {object} ModuleManifest
 * @property {string} id       the served room id this module draws; equals its folder
 * @property {string} ring     the served ring; equals its ring folder
 * @property {string[]} routes the door routes fold() reads (REQ-05); empty for a module that reads none
 * @property {boolean} asOf    whether the shell's as-of scrub reaches this module
 *
 * @typedef {object} FoldContext  what fold() is handed: data only, never the door or a handler
 * @property {import("./rooms.mjs").Room} room
 * @property {import("./rooms.mjs").Room[]} rooms
 * @property {string | undefined} mode
 * @property {string | null} token
 * @property {Record<string, number>} needs
 * @property {number} needsUnplaced
 * @property {Record<string, Record<string, string>> | null | undefined} inventories
 * @property {Record<string, string> | undefined} laneMap
 * @property {Record<string, string>} [picks]  what the View picked (a lane, a filter, an open receipt), a copy
 *
 * @typedef {Omit<FoldContext, "picks"> & { door: import("./door.mjs").Door, onOpen: (id: string) => void }} ModuleContext
 *   what the shell hands the frame for a room
 *
 * @typedef {ModuleContext & { picks: Record<string, string>, onPick: (key: string, value: string) => void,
 *   onAct: (route: string, body: Record<string, unknown>) => void, onReread: () => void }} ModuleViewContext
 *   what a View is handed beside fold()'s result: the door only through the host's three handlers
 *
 * @typedef {{ route: string, param?: string, query?: Record<string, string | number>, poll?: boolean, act?: boolean }} Read
 *   one door read a fold asks for (or, with `act`, the log of one act route)
 * @typedef {{ state: "loading" } | { state: "pending" } | { state: "ok", data: any } | { state: "refused", code: string, human: string }} Payload
 * @typedef {Read & { key: string, path: string }} PlannedRead
 * @typedef {{ n: number, body: Record<string, unknown>, result: Payload }} ActRecord
 * @typedef {{ isNotServed: true, panel: string, route: string, sentence: string }} NotServed
 *
 * @typedef {object} AttachedModule
 * @property {string} key   "ring/id"
 * @property {string} ring
 * @property {string} id
 * @property {ModuleManifest} manifest
 * @property {(payloads: Record<string, unknown>, ctx: FoldContext) => Record<string, unknown>} fold
 * @property {unknown[]} ops
 * @property {unknown} View
 * @property {unknown} Icon
 *
 * @typedef {{ key: string, kind: "bad-key"|"incomplete"|"manifest"|"orphan"|"template"|"misplaced"|"duplicate", why: string }} ModuleProblem
 * @typedef {{ attached: Record<string, AttachedModule>, generic: string[], problems: ModuleProblem[], extras?: string[] }} Attachment
 */

/**
 * A glob key read into its ring, id and file -- or refused. Only the shape the glob produces is
 * accepted, so a key from anywhere else cannot attach a module by accident.
 * @param {unknown} key
 * @returns {{ ok: true, ring: string, id: string, file: string } | { ok: false, why: string }}
 */
export function parseModuleKey(key) {
  if (typeof key !== "string") return { ok: false, why: "a module key is a string" };
  const m = KEY.exec(key);
  if (!m) return { ok: false, why: `${JSON.stringify(key)} is not ./modules/RING/ID/FILE with FILE one of ${MODULE_FILES.join(", ")}` };
  const ring = /** @type {string} */ (m[1]);
  const id = /** @type {string} */ (m[2]);
  const file = /** @type {string} */ (m[3]);
  if (!NAME.test(ring) || !NAME.test(id)) return { ok: false, why: `${JSON.stringify(key)}: a ring and an id are kebab-case` };
  return { ok: true, ring, id, file };
}

/** @param {unknown} v */
const isComponent = (v) => typeof v === "function" || (v !== null && typeof v === "object" && "$$typeof" in /** @type {object} */ (v));

/**
 * Why a manifest is not the one its folder needs, or null when it is.
 * @param {unknown} manifest @param {string} ring @param {string} id
 */
function manifestProblem(manifest, ring, id) {
  if (!manifest || typeof manifest !== "object") return "module.mjs has no default export object";
  const m = /** @type {Record<string, unknown>} */ (manifest);
  if (m.id !== id) return `module.mjs names id ${JSON.stringify(m.id)} inside the folder for ${JSON.stringify(id)}`;
  if (m.ring !== ring) return `module.mjs names ring ${JSON.stringify(m.ring)} inside the ${JSON.stringify(ring)} ring folder`;
  if (!Array.isArray(m.routes)) return "module.mjs declares no routes list";
  // A route the door does not serve is never declared: its panel is NOT SERVED (face v2 Phase 03, REQ-05).
  const bad = m.routes.filter((r) => typeof r !== "string" || !Object.hasOwn(DOOR_ROUTES, r));
  if (bad.length) return `module.mjs declares ${JSON.stringify(bad[0])}, which the door does not serve -- a panel that needs it renders NOT SERVED`;
  if (typeof m.asOf !== "boolean") return "module.mjs declares asOf as something other than true or false";
  return null;
}

/**
 * Group what the glob found into modules, and name every folder that is not a whole one.
 * @param {Record<string, any>} found  glob key -> the module namespace the bundler loaded
 * @returns {{ modules: AttachedModule[], problems: ModuleProblem[] }}
 */
export function collectModules(found) {
  /** @type {Map<string, { key: string, ring: string, id: string, parts: Record<string, any> }>} */
  const byKey = new Map();
  /** @type {ModuleProblem[]} */
  const problems = [];
  for (const [key, ns] of Object.entries(found || {})) {
    const k = parseModuleKey(key);
    if (!k.ok) { problems.push({ key, kind: "bad-key", why: k.why }); continue; }
    const mk = `${k.ring}/${k.id}`;
    let entry = byKey.get(mk);
    if (!entry) { entry = { key: mk, ring: k.ring, id: k.id, parts: {} }; byKey.set(mk, entry); }
    entry.parts[k.file] = ns;
  }
  /** @type {AttachedModule[]} */
  const modules = [];
  for (const e of byKey.values()) {
    const missing = MODULE_FILES.filter((f) => !e.parts[f]);
    if (missing.length) { problems.push({ key: e.key, kind: "incomplete", why: `the folder is missing ${missing.join(", ")}` }); continue; }
    const foldNs = e.parts["fold.mjs"];
    const opsNs = e.parts["ops.mjs"];
    const viewNs = e.parts["View.tsx"];
    if (typeof foldNs.fold !== "function") { problems.push({ key: e.key, kind: "incomplete", why: "fold.mjs exports no fold()" }); continue; }
    if (!Array.isArray(opsNs.ops)) { problems.push({ key: e.key, kind: "incomplete", why: "ops.mjs exports no ops list" }); continue; }
    if (!isComponent(viewNs.default)) { problems.push({ key: e.key, kind: "incomplete", why: "View.tsx has no default component" }); continue; }
    const declared = e.parts["module.mjs"].default;
    const why = manifestProblem(declared, e.ring, e.id);
    if (why) { problems.push({ key: e.key, kind: "manifest", why }); continue; }
    // A frozen COPY: routes are checked once, here, and a fold holding the module's own object cannot widen
    // them afterwards (face v2 Phase 03 attack).
    const manifest = Object.freeze({ ...declared, routes: Object.freeze([...declared.routes]) });
    modules.push({
      key: e.key, ring: e.ring, id: e.id, manifest, fold: foldNs.fold, ops: opsNs.ops,
      View: viewNs.default, Icon: isComponent(viewNs.Icon) ? viewNs.Icon : null,
    });
  }
  return { modules, problems };
}

/** @param {{ template?: boolean, status?: string }} r */
const isTemplate = (r) => r.template === true || r.status === "template";

/**
 * Attach modules to the served registry, both ways (ADR-1321).
 * @param {{ rooms?: import("./rooms.mjs").Room[] }} registry
 * @param {{ modules: AttachedModule[], problems: ModuleProblem[] }} collected
 * @param {string[]} [exempted]  ids an ADR-1327 exemption row names: an unserved folder with one of
 *   these ids is an EXTRA -- kept, not drawn from the served rail, and not a problem -- exactly as
 *   face-coverage's module half reads the same rows (face v2 Phase 02 attack: the two disagreed)
 * @returns {Attachment}
 */
export function attachModules(registry, collected, exempted = []) {
  const rooms = registry && Array.isArray(registry.rooms) ? registry.rooms : [];
  const served = new Map(rooms.map((r) => [r.id, r]));
  /** @type {ModuleProblem[]} */
  const problems = [...((collected && collected.problems) || [])];
  // No prototype: `attached[id]` for a served id such as `constructor` must be undefined, not
  // Object's constructor -- which drew a room as a module with no module (face v2 Phase 02 attack).
  /** @type {Record<string, AttachedModule>} */
  const attached = Object.create(null);
  /** @type {Map<string, AttachedModule[]>} */
  const byId = new Map();
  const exemptSet = new Set(Array.isArray(exempted) ? exempted : []);
  /** @type {string[]} */
  const extras = [];
  for (const m of (collected && collected.modules) || []) byId.set(m.id, [...(byId.get(m.id) || []), m]);
  for (const [id, list] of byId) {
    if (list.length > 1) {
      problems.push({ key: list.map((m) => m.key).join(" + "), kind: "duplicate", why: `"${id}" has a module folder in ${list.length} rings; neither draws it` });
      continue;
    }
    const m = /** @type {AttachedModule} */ (list[0]);
    const room = served.get(id);
    if (!room && exemptSet.has(id)) { extras.push(m.key); continue; }
    if (!room) { problems.push({ key: m.key, kind: "orphan", why: `/api/rooms serves no room "${id}" -- an orphan module draws nothing` }); continue; }
    if (isTemplate(room)) { problems.push({ key: m.key, kind: "template", why: `"${id}" is the lane-room template, not a room` }); continue; }
    if (room.ring !== m.ring) { problems.push({ key: m.key, kind: "misplaced", why: `/api/rooms serves "${id}" in ring "${room.ring}" -- the served ring wins (ADR-1306)` }); continue; }
    attached[id] = m;
  }
  const generic = rooms.filter((r) => !isTemplate(r) && !Object.hasOwn(attached, r.id)).map((r) => r.id);
  return { attached, generic, problems, extras };
}

/**
 * What draws a room: its module, or the generic module.
 * @param {string} roomId @param {Attachment} attachment
 * @returns {{ kind: "module", key: string } | { kind: "generic" }}
 */
export function renderFor(roomId, attachment) {
  const m = attachment && attachment.attached && Object.hasOwn(attachment.attached, roomId) ? attachment.attached[roomId] : undefined;
  return m ? { kind: "module", key: m.key } : { kind: "generic" };
}

/**
 * The problems that name a room's id -- what the generic module says when a folder for the room
 * exists but could not attach (misplaced, incomplete, a manifest naming something else).
 * @param {string} roomId @param {Attachment} attachment
 * @returns {ModuleProblem[]}
 */
export function problemsFor(roomId, attachment) {
  const problems = attachment && Array.isArray(attachment.problems) ? attachment.problems : [];
  return problems.filter((p) => p.key.split(" + ").some((k) => k.split("/")[1] === roomId));
}

/**
 * Which generic renderer draws a room with no module: the registry's own `render` field decides.
 * @param {{ render?: string } | null | undefined} room
 * @returns {"index" | "generic"}
 */
export function fallbackFor(room) {
  return room && room.render === "index" ? "index" : "generic";
}

/**
 * The rail's groups, in the SERVED ring order (never a constant in the shell), the template left
 * out, planned rooms last in their ring, and a room in an undeclared ring shown as unplaced.
 * @param {{ rings?: string[], rooms?: import("./rooms.mjs").Room[] }} registry
 */
export function railGroups(registry) {
  const rooms = registry && Array.isArray(registry.rooms) ? registry.rooms : [];
  const rings = registry && Array.isArray(registry.rings) ? registry.rings : [];
  return byRing(rooms, rings);
}

/**
 * The room the shell opens on: the first openable, unplanned room in the served order -- and a
 * planned one before nothing at all. Null only for a registry with no openable room.
 * @param {{ rings?: string[], rooms?: import("./rooms.mjs").Room[] }} registry
 * @returns {string | null}
 */
export function homeRoom(registry) {
  const groups = railGroups(registry);
  for (const g of groups) for (const r of g.rooms) if (!r.planned && r.status !== "planned") return r.id;
  for (const g of groups) for (const r of g.rooms) return r.id;
  return null;
}

/**
 * The room that homes a kind -- how the header's inbox chip finds where the approvals it counts
 * are decided, without naming that room.
 * @param {{ rooms?: import("./rooms.mjs").Room[] }} registry @param {string} kind
 * @returns {string | null}
 */
export function roomHoldingKind(registry, kind) {
  const rooms = registry && Array.isArray(registry.rooms) ? registry.rooms : [];
  const hit = rooms.find((r) => !isTemplate(r) && r.holds && Array.isArray(r.holds.kinds) && r.holds.kinds.includes(kind));
  return hit ? hit.id : null;
}

/**
 * Whether the shell's as-of scrub reaches a room. A module can say it does not (a room whose
 * numbers are month-scoped), and a file-borne or index room has no day-granular history at all.
 * @param {import("./rooms.mjs").Room | null | undefined} room
 * @param {{ asOf?: boolean } | null | undefined} manifest
 */
export function asOfReaches(room, manifest) {
  if (!room) return false;
  if (manifest && manifest.asOf === false) return false;
  const state = room.live ? room.live.state : undefined;
  if (state === "file-borne" || state === "index") return false;
  return ASOF_ROUTES.length > 0;
}

/**
 * What fold() is handed: the context's data, and never the door or a handler -- a fold that could
 * call the door would not be a fold.
 * @param {ModuleContext} ctx
 * @returns {FoldContext}
 */
export function foldContext(ctx, picks = {}) {
  return {
    room: ctx.room, rooms: ctx.rooms, mode: ctx.mode, token: ctx.token,
    needs: ctx.needs, needsUnplaced: ctx.needsUnplaced, inventories: ctx.inventories, laneMap: ctx.laneMap,
    picks: { ...picks },
  };
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// The read host (face v2 Phase 03, REQ-05, ADR-1324): a module DECLARES routes, its fold ASKS for
// reads, and the host (shell/RoomFrame.tsx) loads exactly those and folds again. Every decision of
// that loop is here, where node can hold it; the host only runs effects.
// ───────────────────────────────────────────────────────────────────────────────────────────────

/** How often a read a fold marks `poll` is read again. The brief is not polled: it shells the CLI. */
export const POLL_MS = 45_000;

/** @type {Payload} */
export const LOADING = Object.freeze({ state: "loading" });

/** @param {unknown} manifest @returns {string[]} */
const declaredRoutes = (manifest) => {
  const routes = manifest && typeof manifest === "object" ? /** @type {{ routes?: unknown }} */ (manifest).routes : null;
  return Array.isArray(routes) ? routes.filter((r) => typeof r === "string") : [];
};

/** @param {string} route */
const routeSpec = (route) => (typeof route === "string" && Object.hasOwn(DOOR_ROUTES, route) ? DOOR_ROUTES[route] ?? null : null);

/**
 * The one key a read is loaded and looked up under. A JSON tuple, so an id carrying any separator
 * cannot make two reads collide; the query sorted, so its order cannot make one read two.
 * @param {Read} read
 */
export function readKey(read) {
  if (read.act === true) return JSON.stringify([read.route, "act"]);
  const q = read.query && typeof read.query === "object" ? read.query : {};
  const pairs = Object.keys(q).sort().map((k) => [k, String(q[k])]);
  return JSON.stringify([read.route, read.param ?? null, pairs]);
}

/**
 * The route a key was made for, or null for a string that is not a read key.
 * @param {string} key
 */
function routeOfKey(key) {
  try {
    const t = JSON.parse(key);
    return Array.isArray(t) && typeof t[0] === "string" ? t[0] : null;
  } catch { return null; }
}

/**
 * The door path of a read: its id encoded into the route, its query sorted.
 * @param {Read} read
 */
export function readPath(read) {
  const spec = routeSpec(read.route);
  const base = spec && spec.param ? read.route.replace(":id", encodeURIComponent(String(read.param))) : read.route;
  const q = read.query && typeof read.query === "object" ? read.query : {};
  const p = new URLSearchParams();
  for (const k of Object.keys(q).sort()) p.set(k, String(q[k]));
  const qs = p.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Why this module may not make this read, or null.
 * @param {unknown} read @param {unknown} manifest
 * @returns {string | null}
 */
export function readProblem(read, manifest) {
  if (!read || typeof read !== "object" || Array.isArray(read)) return "a read is an object naming a route";
  const r = /** @type {Record<string, unknown>} */ (read);
  const route = r.route;
  if (typeof route !== "string") return "a read names its route as a string";
  const spec = routeSpec(route);
  if (!spec) return `${route} is not a route the door serves -- a panel that needs it renders NOT SERVED`;
  if (!declaredRoutes(manifest).includes(route)) return `${route} is not in this module's routes (REQ-05)`;
  if (spec.method !== "GET") return `${route} is an act, not a read -- only a View's handler reaches it, through ctx.onAct`;
  if (spec.param) {
    if (typeof r.param !== "string" || r.param === "" || r.param.length > 256) return `${route} needs an id: a non-empty string`;
    if (r.param === "." || r.param === "..") return `${route} takes an id, not a dot segment -- ${JSON.stringify(r.param)} would climb out of its path`;
    try { encodeURIComponent(r.param); } catch { return `${route}'s id is not well-formed text (an unpaired surrogate) and cannot be put in a path`; }
  } else if (r.param !== undefined) return `${route} takes no id`;
  if (r.query !== undefined) {
    if (!r.query || typeof r.query !== "object" || Array.isArray(r.query)) return `${route}'s query is an object`;
    for (const [k, v] of Object.entries(r.query)) {
      if (k === "asof") return `${route} is never asked for an asof by a module -- the door client applies the shell's scrub`;
      if (!spec.query.includes(k)) return `${route} takes no ${JSON.stringify(k)} (it takes ${spec.query.join(", ") || "no query"})`;
      if (!(typeof v === "string" || (typeof v === "number" && Number.isFinite(v)))) return `${route}'s ${k} is a string or a number`;
    }
  }
  if (r.poll !== undefined && typeof r.poll !== "boolean") return `${route}'s poll is true or false`;
  if (r.act !== undefined) return `${route}: a read is never an act log`;
  return null;
}

/**
 * The reads a fold asked for, each checked against the module's manifest: the ones the host makes (once
 * each, with key and path), and a sentence for each it refuses.
 * @param {unknown} folded @param {unknown} manifest
 * @returns {{ reads: PlannedRead[], problems: string[] }}
 */
export function plannedReads(folded, manifest) {
  /** @type {PlannedRead[]} */
  const reads = [];
  /** @type {string[]} */
  const problems = [];
  const asked = folded && typeof folded === "object" ? /** @type {{ reads?: unknown }} */ (folded).reads : null;
  if (!Array.isArray(asked)) return { reads, problems };
  /** @type {Map<string, PlannedRead>} */
  const byKey = new Map();
  for (const r of asked) {
    // One snapshot per read, taken once: a getter cannot show readProblem one route and readKey another
    // ("validate one read, compare another", face v2 Phase 03 attack).
    const snap = snapshotRead(r);
    const why = snap === null ? "a read is an object naming a route" : readProblem(snap, manifest);
    if (why !== null || snap === null) { problems.push(String(why)); continue; }
    const key = readKey(snap);
    const had = byKey.get(key);
    // A repeat of a read keeps the poll flag of either copy.
    if (had) { if (snap.poll === true) had.poll = true; continue; }
    const planned = { ...snap, key, path: readPath(snap) };
    byKey.set(key, planned);
    reads.push(planned);
  }
  return { reads, problems };
}

/**
 * A read copied into a plain object: every field read exactly once, the query copied the same way.
 * @param {unknown} r
 * @returns {Read | null}
 */
function snapshotRead(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return null;
  const o = /** @type {Record<string, unknown>} */ (r);
  const route = o.route;
  const param = o.param;
  const poll = o.poll;
  const act = o.act;
  const rawQuery = o.query;
  /** @type {Record<string, unknown>} */
  const snap = { route };
  if (param !== undefined) snap.param = param;
  if (poll !== undefined) snap.poll = poll;
  if (act !== undefined) snap.act = act;
  if (rawQuery !== undefined) {
    if (!rawQuery || typeof rawQuery !== "object" || Array.isArray(rawQuery)) snap.query = rawQuery;
    else {
      /** @type {Record<string, unknown>} */
      const q = {};
      for (const k of Object.keys(rawQuery)) q[k] = /** @type {Record<string, unknown>} */ (rawQuery)[k];
      snap.query = q;
    }
  }
  return /** @type {Read} */ (/** @type {unknown} */ (snap));
}

/**
 * Which planned reads the host starts now: every one neither loaded nor in flight, and -- when a poll is
 * due -- every polled one again, keeping its last payload on screen while it reads.
 * @param {PlannedRead[]} planned @param {Record<string, Payload>} loaded @param {Set<string>} inflight @param {boolean} pollDue
 * @returns {PlannedRead[]}
 */
export function readsToLoad(planned, loaded, inflight, pollDue) {
  return planned.filter((r) => !inflight.has(r.key) && (!Object.hasOwn(loaded, r.key) || (pollDue && r.poll === true)));
}

/**
 * The payloads fold() may see: exactly the loaded reads and act logs whose route the manifest declares.
 * Anything else THROWS -- a fold that could see an undeclared route would draw a fact its manifest does
 * not cite (REQ-05), and the host only ever stores declared reads, so a throw here is a host bug named.
 * @param {unknown} manifest @param {Record<string, Payload>} loaded
 * @returns {Record<string, Payload>}
 */
export function payloadsFor(manifest, loaded) {
  const routes = declaredRoutes(manifest);
  /** @type {Record<string, Payload>} */
  const out = Object.create(null);
  for (const [key, payload] of Object.entries(loaded || {})) {
    const route = routeOfKey(key);
    if (route === null) throw new Error(`a payload under ${JSON.stringify(key)}, which is not a read key, cannot reach a fold`);
    if (!routes.includes(route)) throw new Error(`a payload for ${route} cannot reach this fold: the module does not declare that route (REQ-05)`);
    out[key] = payload;
  }
  return out;
}

/**
 * A read's payload as a fold sees it: LOADING until the host has it, never absent.
 * @param {Record<string, Payload>} payloads @param {Read} read
 * @returns {Payload}
 */
export function payloadOf(payloads, read) {
  const key = readKey(read);
  const p = payloads && Object.hasOwn(payloads, key) ? payloads[key] : undefined;
  return p ?? LOADING;
}

/**
 * The one way the host folds a module: its declared payloads only, and the View's picks as a copy.
 * @param {AttachedModule} module @param {Record<string, Payload>} loaded @param {ModuleContext} ctx @param {Record<string, string>} picks
 */
export function foldModule(module, loaded, ctx, picks) {
  return module.fold(payloadsFor(module.manifest, loaded), foldContext(ctx, picks));
}

/**
 * Whether the module's manifest declares a route -- how the host refuses an act on an undeclared route
 * without storing a payload under a key every later fold would refuse.
 * @param {unknown} manifest @param {unknown} route
 */
export function routeDeclared(manifest, route) {
  return typeof route === "string" && declaredRoutes(manifest).includes(route);
}

/**
 * Why this module may not make this act, or null.
 * @param {unknown} route @param {unknown} body @param {unknown} manifest
 * @returns {string | null}
 */
export function actProblem(route, body, manifest) {
  if (typeof route !== "string") return "an act names its route as a string";
  const spec = routeSpec(route);
  if (!spec) return `${route} is not a route the door serves`;
  if (!declaredRoutes(manifest).includes(route)) return `${route} is not in this module's routes (REQ-05)`;
  if (spec.method !== "POST") return `${route} is a read, not an act`;
  if (!body || typeof body !== "object" || Array.isArray(body)) return `${route}'s body is an object`;
  if (route === "/api/ask") {
    const q = /** @type {Record<string, unknown>} */ (body).q;
    const ok = askable(typeof q === "string" ? q : "");
    if (!ok.ok) return ok.why;
  }
  return null;
}

/**
 * An act begins: its record joins the route's log as pending, numbered in order.
 * @param {Record<string, Payload>} loaded @param {string} route @param {Record<string, unknown>} body
 * @returns {{ loaded: Record<string, Payload>, n: number }}
 */
export function actStarted(loaded, route, body) {
  const key = readKey({ route, act: true });
  const cur = Object.hasOwn(loaded, key) ? loaded[key] : undefined;
  const prev = cur !== undefined && cur.state === "ok" && Array.isArray(cur.data) ? /** @type {ActRecord[]} */ (cur.data) : [];
  const n = prev.length;
  return { loaded: { ...loaded, [key]: { state: "ok", data: [...prev, { n, body: { ...body }, result: { state: "pending" } }] } }, n };
}

/**
 * An act lands: record `n` of the route's log takes its result.
 * @param {Record<string, Payload>} loaded @param {string} route @param {number} n @param {Payload} result
 * @returns {Record<string, Payload>}
 */
export function actSettled(loaded, route, n, result) {
  const key = readKey({ route, act: true });
  const cur = Object.hasOwn(loaded, key) ? loaded[key] : undefined;
  if (cur === undefined || cur.state !== "ok" || !Array.isArray(cur.data)) return loaded;
  const log = /** @type {ActRecord[]} */ (cur.data);
  return { ...loaded, [key]: { state: "ok", data: log.map((rec) => (rec.n === n ? { ...rec, result } : rec)) } };
}

/**
 * What the host keeps once an act lands: an act the door marks `rereads` (a stamp) changes what every
 * read shows, so every read is dropped and read again; the act logs stay.
 * @param {Record<string, Payload>} loaded @param {string} route
 * @returns {Record<string, Payload>}
 */
export function afterAct(loaded, route) {
  const spec = routeSpec(route);
  return spec && spec.rereads ? dropReads(loaded) : loaded;
}

/**
 * Whether an act, once it lands, changes what every read shows -- the host reads everything again.
 * @param {string} route
 */
export function actRereads(route) {
  const spec = routeSpec(route);
  return spec !== null && spec.rereads === true;
}

/**
 * Every read dropped and every act log kept -- what "read it all again" means (a stamp landing, or the
 * owner asking for a fresh read).
 * @param {Record<string, Payload>} loaded
 * @returns {Record<string, Payload>}
 */
export function dropReads(loaded) {
  /** @type {Record<string, Payload>} */
  const kept = {};
  for (const [key, payload] of Object.entries(loaded)) {
    let t = null;
    try { t = JSON.parse(key); } catch { /* not a read key; dropped with the reads */ }
    // An act log's key is a TWO-tuple; a read of a lane whose id is "act" is a three-tuple and drops.
    if (Array.isArray(t) && t.length === 2 && t[1] === "act") kept[key] = payload;
  }
  return kept;
}

/**
 * The door client call an act makes. A stamp goes through `Door.decide`, which refuses a bad id, verdict
 * or reason before the request leaves; an ask goes through a READ-ONLY handle granted ASK_GRANTS, so the
 * brain has no hands on this path either (ADR-1325). Any other route is refused by name.
 * @param {import("./door.mjs").Door} door @param {string} route @param {Record<string, unknown>} body
 * @returns {Promise<unknown>}
 */
export function actCall(door, route, body) {
  if (route === "/api/decide") {
    // inbox.stamp refuses a bad id, verdict or reason by the spine's own rules before the request
    // leaves, and speaks the door's wire field (`verdict`); it is passed exactly what the View sent.
    const verdict = /** @type {"approve" | "reject"} */ (body.verdict);
    try {
      return stamp(door, { id: String(body.id), verdict, reason: typeof body.reason === "string" ? body.reason : "" });
    } catch (e) { return Promise.reject(e); }
  }
  if (route === "/api/ask") return askThrough(readOnly(door, ASK_GRANTS), typeof body.q === "string" ? body.q : "");
  return Promise.reject(new DoorError("UNKNOWN_ACT", `${route} is not an act this face makes`, 0));
}

/**
 * A read that failed, as a payload a fold can word: the door's refusal code and a sentence a person reads.
 * @param {unknown} err
 * @returns {Payload}
 */
export function refusedPayload(err) {
  const r = refusalOf(err);
  return { state: "refused", code: r.code, human: r.human };
}

/**
 * A panel the door cannot fill yet, named with the route it needs (ADR-1324). The View draws the kit's
 * NotServed for it; the phase's NOT SERVED list is derived from these, never typed.
 * @param {string} panel @param {string} route @param {string} sentence  what the panel would show
 * @returns {NotServed}
 */
export function notServed(panel, route, sentence) {
  return Object.freeze({ isNotServed: true, panel: String(panel), route: String(route), sentence: String(sentence) });
}

/**
 * A verb v0.7 draws on this panel that the face does not yet perform: it arrives with the work door in
 * Phase 05 (ADR-1326), and until then the panel says so rather than drawing a form that writes nothing.
 * @param {string} verb  what the owner would do  @param {string} sentence  what it would write, and where
 * @returns {{ isVerbPending: true, verb: string, sentence: string }}
 */
export function verbPending(verb, sentence) {
  return Object.freeze({ isVerbPending: true, verb: String(verb), sentence: String(sentence) });
}

/**
 * Every NOT SERVED entry in a fold's output, nested anywhere, in document order.
 * @param {unknown} folded
 * @returns {NotServed[]}
 */
export function notServedOf(folded) {
  /** @type {NotServed[]} */
  const out = [];
  const seen = new Set();
  /** @param {unknown} v @param {number} depth */
  const walk = (v, depth) => {
    if (!v || typeof v !== "object" || seen.has(v) || depth > 64) return;
    seen.add(v);
    if (v instanceof Map || v instanceof Set) { for (const child of v.values()) walk(child, depth + 1); return; }
    // Data properties only: a getter is never called, so a value that builds a new object on each read cannot
    // recurse forever (face v2 Phase 03 attack).
    const props = Object.getOwnPropertyDescriptors(v);
    /** @param {string} k @returns {unknown} */
    const data = (k) => {
      const d = Object.hasOwn(props, k) ? props[k] : undefined;
      return d !== undefined && "value" in d ? d.value : undefined;
    };
    if (data("isNotServed") === true && typeof data("route") === "string" && typeof data("panel") === "string") { out.push(/** @type {NotServed} */ (/** @type {unknown} */ (v))); return; }
    for (const d of Object.values(props)) if ("value" in d) walk(d.value, depth + 1);
  };
  walk(folded, 0);
  return out;
}

/**
 * The header's data-mode chip. A sim spine is violet's (the non-real family), live is the product's
 * own colour, and a mode the door did not state is drawn as unstated -- never as live.
 * @param {string | undefined} mode
 * @returns {{ label: string, tone: "live" | "sim" | "unknown", dot: string, title: string }}
 */
export function modeChip(mode) {
  if (mode === "sim") return { label: "Simulated", tone: "sim", dot: "var(--sim-fg)", title: "a fixture spine: arc's real vocabulary, simulated events -- no number here is real" };
  if (mode === "live") return { label: "Live spine", tone: "live", dot: "var(--mode-live)", title: "reading the canonical spine" };
  return { label: "Mode unstated", tone: "unknown", dot: "var(--text-3)", title: `the door named no data mode this shell knows (${JSON.stringify(mode ?? null)}), so nothing here is labelled live` };
}

/**
 * The header's inbox chip, from how many approvals the door's inbox holds open. A read that failed
 * (null) is "inbox unread" -- never "Inbox zero", which is a claim about the company made from nothing.
 * @param {number | null | undefined} open
 * @returns {{ label: string, isWaiting: boolean }}
 */
export function inboxChip(open) {
  if (typeof open !== "number" || !Number.isInteger(open) || open < 0) return { label: "inbox unread", isWaiting: false };
  if (open === 0) return { label: "Inbox zero", isWaiting: false };
  return { label: `${open} waiting`, isWaiting: true };
}

/**
 * The line under a dock answer: which half of the brain answered and how many receipts it cites. The
 * dock does not check them, and says so.
 * @param {string} halfLabel @param {number} citations
 */
export function citationLine(halfLabel, citations) {
  const n = Number.isInteger(citations) && citations >= 0 ? citations : 0;
  return `${String(halfLabel).toLowerCase()} · ${n} receipt${n === 1 ? "" : "s"} cited -- not checked here; the room that answers questions checks each one`;
}
