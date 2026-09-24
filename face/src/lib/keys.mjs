// keys.mjs -- the no-key check, on the face's side (face v2 Phase 06; ADR-1325).
//
// ADR-1325: no provider key lives in the browser. The door never serves one on purpose; this is the check that a
// room's reads did not carry one by accident -- a router comment, a receipt payload, a file the door parsed. A room
// that finds one does not draw it quietly: it names the read the key arrived in, so the owner sees a door defect, not
// a table.
//
// The shapes are the provider-key rules of the spine's redactor (.claude/scripts/hq/lib/redact.mjs DENY_RULES), kept
// here because the face imports nothing from outside face/ (ADR-1319). tests/face/engine-room.mjs holds the two lists
// to the same samples, so one cannot learn a shape the other misses.

/** @type {readonly { name: string, re: RegExp }[]} */
export const KEY_RULES = Object.freeze([
  { name: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "openai-key", re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { name: "github-token", re: /gh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "github-fine-grained-pat", re: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: "aws-access-key-id", re: /AKIA[0-9A-Z]{16}/ },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_-]{35}/ },
  { name: "stripe-key", re: /sk_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { name: "slack-token", re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]{0,32}PRIVATE KEY-----/ },
]);

/**
 * The provider-key shapes found anywhere in a value, by name. Walks strings, arrays and objects -- keys included,
 * since a key can arrive as a map key as easily as a value. Bounded by depth, so a hostile payload cannot recurse it.
 * @param {unknown} value @returns {string[]}
 */
export function keyShapes(value) {
  /** @type {Set<string>} */
  const found = new Set();
  /** @param {unknown} v @param {number} depth */
  const walk = (v, depth) => {
    if (depth > 64) return;
    if (typeof v === "string") { for (const r of KEY_RULES) if (r.re.test(v)) found.add(r.name); return; }
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    if (v !== null && typeof v === "object") for (const [k, x] of Object.entries(v)) { walk(k, depth + 1); walk(x, depth + 1); }
  };
  walk(value, 0);
  return [...found].sort();
}

/**
 * Which of a room's answered reads carry a provider-key shape: one line per read, naming the read and the shape --
 * never the key.
 * @param {Record<string, { state: string, data?: unknown }>} payloads the host's payloads, keyed by read key
 * @returns {string[]}
 */
export function keyLeaks(payloads) {
  const out = [];
  for (const [key, p] of Object.entries(payloads && typeof payloads === "object" ? payloads : {})) {
    if (!p || p.state !== "ok") continue;
    const shapes = keyShapes(p.data);
    if (shapes.length) out.push(`${key}: ${shapes.join(", ")}`);
  }
  return out.sort();
}
