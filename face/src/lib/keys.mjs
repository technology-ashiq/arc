// keys.mjs -- the no-key check, on the face's side (face v2 Phase 06; ADR-1325).
//
// ADR-1325: no provider key lives in the browser. The door never serves one on purpose; this is the check that a
// room's reads did not carry one by accident -- a router comment, a receipt payload, a refusal's stderr, a file the
// door parsed. It runs in the READ HOST (registry.mjs foldModule), over every payload of every room, whatever its state
// and in every field (attack 57d014d B1, B2): a key found is WITHHELD -- replaced before any fold sees it, so no room
// can draw it (B4) -- and named, by the read it arrived in and its shape, never its text.
//
// The shapes are the provider-key rules of the spine's redactor (.claude/scripts/hq/lib/redact.mjs DENY_RULES), kept
// here because the face imports nothing from outside face/ (ADR-1319), with one deliberate difference: a LEFT BOUNDARY,
// so `task-<32 chars>` is an id and not an OpenAI key (B6). tests/face/engine-room.mjs derives the set from the
// redactor's own names and crosses every rule at its minimum length and one below it (B5).

const L = "(?<![A-Za-z0-9_-])";
/** @type {readonly { name: string, re: RegExp }[]} */
export const KEY_RULES = Object.freeze([
  { name: "anthropic-key", re: new RegExp(`${L}sk-ant-[A-Za-z0-9_-]{20,}`) },
  { name: "openai-key", re: new RegExp(`${L}sk-(?:proj-)?[A-Za-z0-9_-]{32,}`) },
  { name: "github-token", re: new RegExp(`${L}gh[pousr]_[A-Za-z0-9]{36,}`) },
  { name: "github-fine-grained-pat", re: new RegExp(`${L}github_pat_[A-Za-z0-9_]{22,}`) },
  { name: "aws-access-key-id", re: new RegExp(`${L}AKIA[0-9A-Z]{16}`) },
  { name: "aws-secret-access-key", re: /\baws_secret_access_key\s{0,8}[:=]\s{0,8}['"]?[A-Za-z0-9/+]{40}/i },
  { name: "google-api-key", re: new RegExp(`${L}AIza[0-9A-Za-z_-]{35}`) },
  { name: "stripe-key", re: new RegExp(`${L}sk_(?:live|test)_[A-Za-z0-9]{16,}`) },
  { name: "slack-token", re: new RegExp(`${L}xox[baprs]-[A-Za-z0-9-]{10,}`) },
  { name: "npm-token", re: new RegExp(`${L}npm_[A-Za-z0-9]{36}`) },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----/ },
]);

/** Each rule with its global twin, compiled once: a fold scans every string of every read on every re-read. */
const GLOBAL_RULES = KEY_RULES.map((r) => ({ name: r.name, re: r.re, g: new RegExp(r.re.source, `${r.re.flags}g`) }));

/** Past this depth a value is not scanned -- and is then WITHHELD WHOLE and named, never passed as clean (B3). */
export const SCAN_DEPTH = 64;
const WITHHELD = /\[[a-z0-9-]+ withheld\]/;

/**
 * A copy of `value` with every provider-key shape replaced by `[<shape> withheld]`, and the shapes found. Keys of
 * objects are scanned too. A subtree past SCAN_DEPTH is replaced whole and reported as `unscanned-depth`. A marker a
 * previous pass left is reported as `withheld-upstream`, so a second pass never reads a scrubbed leak as no leak.
 * @param {unknown} value @returns {{ value: unknown, found: string[] }}
 */
export function scrubKeys(value) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {string} s */
  const str = (s) => {
    let out = s;
    if (WITHHELD.test(out)) found.add("withheld-upstream");
    // The non-global rule tests (no lastIndex state); the global twin, compiled once, replaces.
    for (const r of GLOBAL_RULES) if (r.re.test(out)) { found.add(r.name); out = out.replace(r.g, `[${r.name} withheld]`); }
    return out;
  };
  /** @param {unknown} v @param {number} depth @returns {unknown} */
  const walk = (v, depth) => {
    if (typeof v === "string") return str(v);
    if (v === null || typeof v !== "object") return v;
    if (depth >= SCAN_DEPTH) { found.add("unscanned-depth"); return "[unscanned-depth withheld]"; }
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    /** @type {Record<string, unknown>} */
    const o = Object.create(null);
    for (const [k, x] of Object.entries(v)) o[str(k)] = walk(x, depth + 1);
    return o;
  };
  const out = walk(value, 0);
  return { value: out, found: [...found].sort() };
}

/** The shapes found in a value, by name -- the read-only half of scrubKeys. @param {unknown} value @returns {string[]} */
export function keyShapes(value) {
  return scrubKeys(value).found;
}

/**
 * Every payload of a room with its keys withheld, and one line per read that carried one: the read's key and the
 * shapes, never the text. Every payload is scanned WHOLE, whatever its state -- a refusal's human text and a stderr
 * carry keys as easily as a body (B2). A payloads argument that is not an object is itself a finding.
 * @template {Record<string, unknown>} T
 * @param {T} payloads @returns {{ payloads: T, leaks: string[] }}
 */
export function withholdKeys(payloads) {
  if (payloads === null || typeof payloads !== "object" || Array.isArray(payloads)) return { payloads, leaks: ["(payloads): not an object -- unscanned"] };
  /** @type {Record<string, unknown>} */
  const out = {};
  const leaks = [];
  for (const [key, p] of Object.entries(payloads)) {
    const { value, found } = scrubKeys(p);
    out[key] = found.length ? value : p;
    if (found.length) leaks.push(`${key}: ${found.join(", ")}`);
  }
  return { payloads: /** @type {T} */ (out), leaks: leaks.sort() };
}

/** The leak lines alone. @param {Record<string, unknown>} payloads @returns {string[]} */
export function keyLeaks(payloads) {
  return withholdKeys(payloads).leaks;
}

/** The sentence a room draws for its leaks, or "". @param {string[]} leaks */
export function keyLeakSentence(leaks) {
  return leaks.length === 0 ? "" : `a provider key reached this browser (ADR-1325), in ${leaks.join(" · ")} -- withheld here, and the door must never serve one`;
}
