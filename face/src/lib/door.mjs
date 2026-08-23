// door.mjs -- the typed client for the L2 `arc dash` door (ADR-1301/1312).
//
// Dependency-free ESM on purpose: CI never runs `npm install` at the repo root, so anything
// that needs node_modules to be exercised cannot be exercised. This module is imported
// directly by node in the test matrix, and by the React views in the browser, with no build
// step between the two.
//
// It knows the door's REFUSALS as well as its answers. A door that refuses by name is only
// useful if the client surfaces the name -- swallowing a refusal into a generic "failed" is
// how a product ends up telling its owner "something went wrong" about a machine that said
// exactly what was wrong.

/** @typedef {{ code: string, message: string, status: number }} Refusal */

/**
 * The refusal codes the door emits that a HUMAN has to see verbatim, because each one means
 * a different thing the owner might do next. Anything not in this set is still surfaced by
 * code -- this list is what the UI is allowed to write a sentence for, not a filter.
 * @type {Record<string, string>}
 */
export const KNOWN_REFUSALS = {
  ALREADY_DECIDED: "This one has already been decided. The record does not change.",
  UNKNOWN_APPROVAL: "No approval with that id is open.",
  BAD_REASON: "A reason is required, in your own words.",
  UNKNOWN_ROUTE: "That is not a route on this door.",
  BAD_ARGS: "The door could not read those arguments.",
  LIMIT_INVALID: "That page size is outside the door's cap.",
  CURSOR_INVALID: "That cursor is not one this door issued.",
  REGISTRY_ABSENT: "The room registry has not been generated yet.",
  ASOF_UNSUPPORTED: "This panel is file-borne; it has no day-granular history to scrub to.",
};

export class DoorError extends Error {
  /** @param {string} code @param {string} message @param {number} status */
  constructor(code, message, status) {
    super(message);
    this.name = "DoorError";
    this.code = code;
    this.status = status;
  }
  /** The sentence to show a person. Falls back to the door's own words, never to "error". */
  get human() {
    return KNOWN_REFUSALS[this.code] || this.message || this.code;
  }
}

/**
 * @typedef {object} DoorOptions
 * @property {string} [base]   origin of the door. "" in the browser (vite proxies /api).
 * @property {string} [token]  bearer token. The door is localhost + token only (ADR-1312).
 * @property {typeof fetch} [fetchImpl] injectable for tests -- no network in a unit test.
 */

/**
 * Read the dev token out of the URL fragment, which is how arc-dash hands it over
 * (`open http://127.0.0.1:8317/#token=...`). The FRAGMENT is deliberate: it is never sent
 * to a server and never lands in a proxy log, unlike a query string.
 * @param {string} hash
 * @returns {string | null}
 */
export function tokenFromHash(hash) {
  if (typeof hash !== "string" || hash.length === 0) return null;
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const part of raw.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) !== "token") continue;
    const v = decodeURIComponent(part.slice(eq + 1));
    return v.length ? v : null;
  }
  return null;
}

export class Door {
  /** @param {DoorOptions} [opts] */
  constructor(opts = {}) {
    this.base = opts.base ?? "";
    this.token = opts.token ?? null;
    // BOUND, not merely referenced.
    //
    // `globalThis.fetch` stored on an instance and called as `this.fetchImpl(...)` loses its
    // receiver, and the browser throws "Failed to execute 'fetch' on 'Window': Illegal
    // invocation". Node's fetch does not care, so every test here passed and the product was
    // dead on arrival in a browser -- the failure only exists where the tests are not.
    //
    // Found by opening the page. Nothing in the type system or the node suite could have
    // said it: this is the class that only a running browser reports.
    /** @type {typeof fetch} */
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * @param {string} path
   * @param {{ method?: string, body?: unknown, signal?: AbortSignal }} [init]
   * @returns {Promise<any>}
   */
  async call(path, init = {}) {
    /** @type {Record<string, string>} */
    const headers = { Accept: "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(`${this.base}${path}`, {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      ...(init.signal ? { signal: init.signal } : {}),
    });

    // A refusal has a body with a code. A crash may not. Both must end up as a DoorError
    // carrying SOMETHING a person can read -- an empty catch here is how "failed to fetch"
    // becomes the only thing the product ever says.
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON body; handled below */ }

    if (!res.ok) {
      const code = (body && (body.code || body.error)) || `HTTP_${res.status}`;
      const message = (body && (body.message || body.detail)) || res.statusText || "the door refused";
      throw new DoorError(String(code), String(message), res.status);
    }
    if (body === null) throw new DoorError("BAD_BODY", "the door answered 200 with a body that is not JSON", res.status);
    return body;
  }

  /** @param {AbortSignal} [signal] */
  health(signal) { return this.call("/api/health", { signal }); }
  /** @param {AbortSignal} [signal] */
  rooms(signal) { return this.call("/api/rooms", { signal }); }
  /** @param {AbortSignal} [signal] */
  brief(signal) { return this.call("/api/brief", { signal }); }
  /** @param {AbortSignal} [signal] */
  inbox(signal) { return this.call("/api/inbox", { signal }); }
  /** @param {AbortSignal} [signal] */
  board(signal) { return this.call("/api/board", { signal }); }
  /** @param {string} lane @param {AbortSignal} [signal] */
  lane(lane, signal) { return this.call(`/api/lane/${encodeURIComponent(lane)}`, { signal }); }
  /** @param {AbortSignal} [signal] */
  pnl(signal) { return this.call("/api/pnl", { signal }); }

  /**
   * A sanctioned file, by ID rather than by path. The door holds an ALLOW-LIST and answers
   * UNKNOWN_FILE_ID for anything else, so the id set is the door's to define and this
   * client's only job is not to invent one. Callers pass the id; nobody builds a path.
   * @param {string} id @param {AbortSignal} [signal]
   */
  file(id, signal) { return this.call(`/api/file/${encodeURIComponent(id)}`, { signal }); }

  /**
   * @param {{ since?: string, kind?: string, date?: string, limit?: number, asof?: string }} q
   * @param {AbortSignal} [signal]
   */
  spine(q = {}, signal) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null) p.set(k, String(v));
    const qs = p.toString();
    return this.call(`/api/spine${qs ? `?${qs}` : ""}`, { signal });
  }

  /**
   * THE ONE WRITE. Deliberately not called `post` or `submit`: the name of this method is
   * the name of the act, and there is exactly one of them in the product.
   *
   * THE WIRE FIELD IS `verdict`, NOT `decision`.
   *
   * The first cut of this method sent `decision`, and `arc-dash.mjs` destructures
   * `{ id, verdict, reason }` and refuses anything else with BAD_VERDICT. Every stamp in the
   * product would have been refused, and nothing on this side of the wire could have noticed:
   * the method is well-typed, the JSON is well-formed, and the failure only exists in the gap
   * between two files. A cross-layer test now pins the field name against arc-dash's own
   * source, so renaming it on either side fails loudly instead of silently.
   *
   * The ARGUMENT stays `decision` because that is what it is in English; only the wire name
   * is the door's to choose.
   *
   * @param {{ id: string, decision: "approve" | "reject", reason: string }} stamp
   */
  decide(stamp) {
    const reason = typeof stamp.reason === "string" ? stamp.reason.trim() : "";
    // Refused HERE as well as at the door. Not because the door cannot be trusted -- it can,
    // and its BAD_REASON is the authority -- but because a round trip to be told the box was
    // empty is a worse experience than being told before the request leaves.
    if (!reason) throw new DoorError("BAD_REASON", "a reason is required, in your own words", 0);
    if (stamp.decision !== "approve" && stamp.decision !== "reject")
      throw new DoorError("BAD_VERDICT", `a stamp is approve or reject, not ${JSON.stringify(stamp.decision)}`, 0);
    return this.call("/api/decide", { method: "POST", body: { id: stamp.id, verdict: stamp.decision, reason } });
  }

  /** @param {string} q */
  ask(q) { return this.call("/api/ask", { method: "POST", body: { q } }); }
}
