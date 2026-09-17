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
import { ASOF_ROUTES } from "./door.mjs";

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
 *
 * @typedef {FoldContext & { door: import("./door.mjs").Door, onOpen: (id: string) => void }} ModuleContext
 *   what a View is handed beside fold()'s result
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
  const bad = m.routes.filter((r) => typeof r !== "string" || !r.startsWith("/api/"));
  if (bad.length) return `module.mjs declares a route that is not a door path: ${JSON.stringify(bad[0])}`;
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
    const manifest = e.parts["module.mjs"].default;
    const why = manifestProblem(manifest, e.ring, e.id);
    if (why) { problems.push({ key: e.key, kind: "manifest", why }); continue; }
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
export function foldContext(ctx) {
  return {
    room: ctx.room, rooms: ctx.rooms, mode: ctx.mode, token: ctx.token,
    needs: ctx.needs, needsUnplaced: ctx.needsUnplaced, inventories: ctx.inventories, laneMap: ctx.laneMap,
  };
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
