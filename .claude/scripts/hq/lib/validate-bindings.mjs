// validate-bindings.mjs -- an approval knows what it waits on and what it is bound to (face v2 Phase 16, REQ-20, ADR-1355).
//
// A PROFILE, NOT A KIND. `approval.requested` keeps its open payload, and three OPTIONAL fields ride it, each held to a
// closed shape here the moment it appears (ADR-1916's pattern; `decision.recorded` is untouched):
//
//   bound_to      { kind: "plan-expect", expect: <64 hex>, op: <face op id>, input: { <field>: <text> } }
//                 the request approves exactly the plan whose digest is `expect`; `op` and `input` name the registered
//                 work-door plan the inbox re-derives DRY-RUN to see whether it moved (the digest alone names no plan)
//   depends_on    [<approval.requested ULID>, ...]  1..8, distinct, never the request's own id
//   decision_key  "<lane>:<subject>:<stable-id>"   an exact string: never trimmed, never case-folded
//
// What this file cannot see is the spine: that a parent RESOLVES to an approval.requested (and not a decision), and that
// no cycle forms, are checked by arc-event at emit (parentProblem below, called with the events it read). A key that
// differs from one of the three only by case or punctuation is REFUSED, never normalised and never exempt: a
// `dependsOn` the fold silently ignores is a request that lists OPEN while its author believes it waits.

import { SpineError, ULID_RE } from "./canonical.mjs";

export const BINDING_KEYS = Object.freeze(["bound_to", "depends_on", "decision_key"]);
export const MAX_PARENTS = 8;
const HEX64 = /^[0-9a-f]{64}$/;
const OP_ID = /^[a-z][a-z0-9-]{0,40}\.[a-z][a-z0-9-]{0,40}$/;
const INPUT_KEY = /^[a-z][a-z0-9_-]{0,31}$/;
// lane : subject : stable-id. Each part is visible ASCII with no separator of its own; no whitespace anywhere, so a
// trailing space is a grammar failure, never a second key that looks like the first (spec (c)).
export const DECISION_KEY_RE = /^[a-z][a-z0-9-]{0,63}:[A-Za-z0-9][A-Za-z0-9._/-]{0,127}:[A-Za-z0-9][A-Za-z0-9._/-]{0,127}$/;
const MAX_INPUT_KEYS = 16;
const MAX_INPUT_BYTES = 512;

const bad = (why) => new SpineError("BAD_BINDING", why);
const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const squash = (k) => String(k).toLowerCase().replace(/[\W_]+/g, "");
const SQUASHED = new Map(BINDING_KEYS.map((k) => [squash(k), k]));

/** C0, DEL and C1: a control character in a value the inbox prints forges a line or reaches the tty. */
function hasControl(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f) || c === 0x2028 || c === 0x2029) return true;
  }
  return false;
}

/** Does this event carry the profile -- one of the three keys, or a near miss of one? */
export function isBindingRequest(event) {
  if (!event || event.kind !== "approval.requested" || !isPlain(event.payload)) return false;
  return Object.keys(event.payload).some((k) => SQUASHED.has(squash(k)));
}

/**
 * The profile's shape, judged without the spine. Throws BAD_BINDING naming the first violation.
 * @param {{ id: string, payload: Record<string, unknown> }} event
 */
export function assertBindings(event) {
  const p = event.payload;
  for (const k of Object.keys(p)) {
    const meant = SQUASHED.get(squash(k));
    if (meant !== undefined && meant !== k) throw bad(`"${k}" is not "${meant}" -- a binding key is exact, never normalised (a near miss would be ignored by the inbox fold)`);
  }
  if ("bound_to" in p) {
    const b = p.bound_to;
    if (!isPlain(b)) throw bad("bound_to must be an object { kind, expect, op, input }");
    for (const k of Object.keys(b)) if (!["kind", "expect", "op", "input"].includes(k)) throw bad(`bound_to has unknown key "${k}" (closed to kind|expect|op|input)`);
    if (b.kind !== "plan-expect") throw bad(`bound_to.kind ${JSON.stringify(b.kind)} is not "plan-expect", the one binding there is`);
    if (typeof b.expect !== "string" || !HEX64.test(b.expect)) throw bad("bound_to.expect must be the plan's 64-hex digest, lowercase");
    if (typeof b.op !== "string" || !OP_ID.test(b.op)) throw bad(`bound_to.op ${JSON.stringify(b.op)} is not a work-door op id (room.verb)`);
    if (!isPlain(b.input)) throw bad("bound_to.input must be an object of the op's fields");
    const keys = Object.keys(b.input);
    if (keys.length > MAX_INPUT_KEYS) throw bad(`bound_to.input names ${keys.length} fields; at most ${MAX_INPUT_KEYS}`);
    for (const k of keys) {
      if (!INPUT_KEY.test(k)) throw bad(`bound_to.input key ${JSON.stringify(k)} is not a field name`);
      const v = b.input[k];
      if (typeof v !== "string") throw bad(`bound_to.input.${k} must be text, as the work door takes it`);
      if (Buffer.byteLength(v, "utf8") > MAX_INPUT_BYTES) throw bad(`bound_to.input.${k} is longer than ${MAX_INPUT_BYTES} bytes`);
      if (hasControl(v)) throw bad(`bound_to.input.${k} carries a control character or a line separator`);
    }
  }
  if ("depends_on" in p) {
    const d = p.depends_on;
    if (!Array.isArray(d) || d.length === 0) throw bad("depends_on must be a non-empty list of approval.requested ULIDs");
    if (d.length > MAX_PARENTS) throw bad(`depends_on names ${d.length} parents; at most ${MAX_PARENTS}`);
    const seen = new Set();
    for (const id of d) {
      if (typeof id !== "string" || !ULID_RE.test(id)) throw bad(`depends_on entry ${JSON.stringify(id)} is not a ULID`);
      if (id === event.id) throw bad("a request cannot depend on itself");
      if (seen.has(id)) throw bad(`depends_on names ${id} twice`);
      seen.add(id);
    }
  }
  if ("decision_key" in p) {
    const key = p.decision_key;
    if (typeof key !== "string" || !DECISION_KEY_RE.test(key)) throw bad(`decision_key ${JSON.stringify(key)} is not "<lane>:<subject>:<stable-id>" -- exact, with no whitespace`);
  }
}

/**
 * Why a request's parents cannot be accepted, judged against the spine as read -- or null. Each parent must be an
 * approval.requested already on the spine (a decision's ULID, or any other kind, is refused by name), and following
 * depends_on from the parents must never come back to this request (a cycle no fold can resolve).
 * @param {{ id: string, payload: Record<string, unknown> }} event
 * @param {{ event: { id: string, kind: string, payload?: unknown } }[]} events  the spine, in append order
 * @returns {{ code: string, why: string } | null}
 */
export function parentProblem(event, events) {
  const parents = Array.isArray(event.payload.depends_on) ? event.payload.depends_on : [];
  if (parents.length === 0) return null;
  /** @type {Map<string, { id: string, kind: string, payload?: unknown }>} */
  const byId = new Map();
  for (const e of events) if (e && e.event && typeof e.event.id === "string" && !byId.has(e.event.id)) byId.set(e.event.id, e.event);
  for (const id of parents) {
    const found = byId.get(id);
    if (!found) return { code: "PARENT_UNKNOWN", why: `depends_on names ${id}, which is not on this spine` };
    if (found.kind !== "approval.requested") return { code: "PARENT_NOT_REQUEST", why: `depends_on names ${id}, a ${found.kind} -- a parent is the approval.requested it waits on, never its decision` };
  }
  // Walk the parents' own depends_on; reaching this request is a cycle. Bounded by the spine: each id is visited once.
  const seen = new Set();
  const stack = [...parents];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === event.id) return { code: "PARENT_CYCLE", why: `depends_on reaches ${event.id} again through its parents -- a cycle no request could ever leave` };
    if (seen.has(id)) continue;
    seen.add(id);
    const e = byId.get(id);
    const pp = e && isPlain(e.payload) && Array.isArray(/** @type {any} */ (e.payload).depends_on) ? /** @type {any} */ (e.payload).depends_on : [];
    for (const q of pp) if (typeof q === "string") stack.push(q);
  }
  return null;
}
