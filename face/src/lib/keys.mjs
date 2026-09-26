// keys.mjs -- the no-key check, on the face's side (face v2 Phase 06; ADR-1325).
//
// ADR-1325: no provider key lives in the browser. The door never serves one on purpose; this is the check that a
// room's reads did not carry one by accident -- a router comment, a receipt payload, a refusal's stderr, a file the
// door parsed. It runs in the READ HOST (registry.mjs foldModule), over every payload of every room and the context it
// folds with, whatever its state and in every field (attack 57d014d B1, B2): a key found is WITHHELD -- replaced
// before any fold sees it, so no room can draw it (B4) -- and named by the read and its shape, never its text.
//
// The shapes are the provider-key rules of the spine's redactor (.claude/scripts/hq/lib/redact.mjs DENY_RULES), kept
// here because the face imports nothing from outside face/ (ADR-1319). ONE deliberate difference: the OpenAI rule
// needs a non-word character (or the start) before `sk-`, so `task-<32 chars>` is an id and not a key; every other rule
// is as the redactor has it, unbounded (round-2 attack 4010c52 B1). No lookbehind: an engine without it would throw
// at load and take every room down (B11). A key behind an ANSI colour code, a JSON-escaped newline or a URL-encoded
// break is found through a normalised view, and the whole string is withheld (B1). tests/face/engine-room.mjs derives
// the set from the redactor's own names and crosses every rule at its minimum length and one below it.

/** @type {readonly { name: string, re: RegExp }[]} */
export const KEY_RULES = Object.freeze([
  { name: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  // The one bounded rule: the captured left context is put back on replace.
  { name: "openai-key", re: /(^|[^A-Za-z0-9_-])sk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "github-fine-grained-pat", re: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: "aws-access-key-id", re: /AKIA[0-9A-Z]{16}/ },
  // Assignment-shaped: an optional closing quote before [:=] also takes the JSON form `"aws_secret_access_key":"..."`,
  // and walk() tests an object entry as `key=value` (B2).
  { name: "aws-secret-access-key", re: /\baws_secret_access_key['"]?\s{0,8}[:=]\s{0,8}['"]?[A-Za-z0-9/+]{40}/i },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "stripe-key", re: /sk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "npm-token", re: /npm_[A-Za-z0-9]{36}/ },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----/ },
]);

/** Each rule with its global twin, compiled once: a fold scans every string of every read on every re-read. */
const GLOBAL_RULES = KEY_RULES.map((r) => ({ name: r.name, re: r.re, g: new RegExp(r.re.source, `${r.re.flags}g`), bounded: r.name === "openai-key" }));

/** Past this depth a value is not scanned -- and is then WITHHELD WHOLE and named, never passed as clean (B3). */
export const SCAN_DEPTH = 64;
const DEPTH_NAME = "unscanned-depth";
const marker = (/** @type {string} */ name) => `[${name} withheld]`;
// ONLY this scanner's own markers are recognised -- by exact rule name -- so a tool line that says "[diff withheld]"
// or "[path withheld]" is text, not a leak (B5). A marker keeps its shape: a second pass reports the SAME name (B4).
const MARKERS = new Map([...KEY_RULES.map((r) => r.name), DEPTH_NAME].map((n) => [marker(n), n]));
// What an escape or a colour code hides a key behind: ANSI CSI sequences, JSON/C escapes, URL-encoded breaks.
const HIDERS = /\u001b\[[0-9;?]*[A-Za-z]|\\[nrtu]|%0[AaDd9]|%20/g;

/**
 * A copy of `value` with every provider-key shape replaced by `[<shape> withheld]`, and the shapes found. Keys of
 * objects are scanned too. A subtree past SCAN_DEPTH is replaced whole and reported. A marker a previous pass left is
 * reported under its own shape, so a second pass never reads a scrubbed leak as no leak.
 * @param {unknown} value @returns {{ value: unknown, found: string[] }}
 */
export function scrubKeys(value) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {string} s */
  const str = (s) => {
    for (const [m, n] of MARKERS) if (s.includes(m)) found.add(n);
    let out = s;
    for (const r of GLOBAL_RULES) {
      if (!r.re.test(out)) continue;
      found.add(r.name);
      out = r.bounded ? out.replace(r.g, (_m, pre) => `${pre}${marker(r.name)}`) : out.replace(r.g, marker(r.name));
    }
    // The normalised view: a key a colour code or an escape sat in front of. Positions do not map back, so the whole
    // string is withheld -- losing a line is the safe direction.
    const plain = out.replace(HIDERS, " ");
    if (plain !== out) for (const r of GLOBAL_RULES) if (r.re.test(plain)) { found.add(r.name); return marker(r.name); }
    return out;
  };
  /** @param {unknown} v @param {number} depth @returns {unknown} */
  const walk = (v, depth) => {
    if (typeof v === "string") return str(v);
    if (v === null || typeof v !== "object") return v;
    if (depth >= SCAN_DEPTH) { found.add(DEPTH_NAME); return marker(DEPTH_NAME); }
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    /** @type {Record<string, unknown>} */
    const o = Object.create(null);
    for (const [k, x] of Object.entries(v)) {
      let name = str(k);
      // Two keys that scrub to one name are both kept, the second numbered, and the collision is said (B12).
      if (Object.hasOwn(o, name)) { let n = 2; while (Object.hasOwn(o, `${name} #${n}`)) n++; name = `${name} #${n}`; found.add("key-collision"); }
      // An entry is also read as `key=value`: an assignment-shaped key split across the key and the value (B2).
      const joined = typeof x === "string" ? `${k}=${x}` : "";
      const assigned = joined !== "" && GLOBAL_RULES.find((r) => r.name === "aws-secret-access-key")?.re.test(joined);
      if (assigned) found.add("aws-secret-access-key");
      Object.defineProperty(o, name, { value: assigned ? marker("aws-secret-access-key") : walk(x, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return o;
  };
  const out = walk(value, 0);
  return { value: out, found: [...found].sort() };
}

/** The shapes found in a value, by name -- the read-only half of scrubKeys. @param {unknown} value @returns {string[]} */
export function keyShapes(value) {
  return scrubKeys(value).found;
}

/** A read key as a leak line may print it: the key itself scrubbed -- a key can ride in a read's own id (B3). @param {string} k */
const safeKey = (k) => String(scrubKeys(k).value);

/**
 * Every payload of a room with its keys withheld, and one line per read that carried one: the read's key and the
 * shapes, never the text. Every payload is scanned WHOLE, whatever its state -- a refusal's human text and a stderr
 * carry keys as easily as a body. A payloads argument that is not an object is itself a finding, and NOTHING of it
 * reaches a fold (B10).
 * @template {Record<string, unknown>} T
 * @param {T} payloads @returns {{ payloads: T, leaks: string[] }}
 */
export function withholdKeys(payloads) {
  /** @type {Record<string, unknown>} */
  const out = Object.create(null);
  if (payloads === null || typeof payloads !== "object" || Array.isArray(payloads)) return { payloads: /** @type {T} */ (out), leaks: ["(payloads): not an object -- nothing of it was folded"] };
  const leaks = [];
  for (const [key, p] of Object.entries(payloads)) {
    const { value, found } = scrubKeys(p);
    Object.defineProperty(out, key, { value: found.length ? value : p, enumerable: true, writable: true, configurable: true });
    if (found.length) leaks.push(`${safeKey(key)}: ${found.join(", ")}`);
  }
  return { payloads: /** @type {T} */ (out), leaks: leaks.sort() };
}

/** The leak lines alone. @param {Record<string, unknown>} payloads @returns {string[]} */
export function keyLeaks(payloads) {
  return withholdKeys(payloads).leaks;
}

/** A string a room draws, scrubbed -- for text the host builds itself (a refusal, a stale line). @param {string} s */
export function scrubText(s) {
  return String(scrubKeys(String(s)).value);
}

/** The sentence a room draws for its leaks, or "". @param {string[]} leaks */
export function keyLeakSentence(leaks) {
  return leaks.length === 0 ? "" : `a provider key reached this browser (ADR-1325), in ${leaks.join(" · ")} -- withheld here, and the door must never serve one`;
}
