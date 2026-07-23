// Deterministic synthetic spine generator (assumptions ledger row 2).
//
// Builds N days of realistic-volume events so `arc brief` can be TIMED against a spine the
// size a real quarter produces, and so the equivalence gate has something bigger than a
// three-event fixture to disagree on.
//
// Deterministic by construction: a seeded PRNG, timestamps computed from a base day passed
// in, and no Math.random or wall-clock anywhere -- the same arguments must always produce
// the same bytes, or the golden comparisons downstream mean nothing.
//
// Usage: node gen-synthetic.mjs <out-spine-root> [days] [events-per-day] [base-YYYY-MM-DD]

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const OUT = process.argv[2];
const DAYS = Number(process.argv[3] || 90);
const PER_DAY = Number(process.argv[4] || 40);
const BASE = process.argv[5] || "2026-01-01";

if (!OUT) {
  process.stderr.write("usage: gen-synthetic.mjs <out-spine-root> [days] [per-day] [base-day]\n");
  process.exit(2);
}

const KINDS = [
  "note.logged", "commit.done", "review.completed", "qa.completed", "run.completed",
  "phase.closed", "ship.done", "idea.captured", "cost.incurred", "approval.requested",
];
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

// A tiny deterministic PRNG (mulberry32). Seeded once, so run N is run N+1.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canon(value) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return JSON.stringify(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canon).join(",") + "]";
  return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canon(value[k])).join(",") + "}";
}
const sha256 = (t) => createHash("sha256").update(Buffer.from(t, "utf8")).digest("hex");

function ulid(ms, salt) {
  let out = "";
  let n = Math.floor(ms);
  for (let i = 0; i < 10; i++) { out = CROCKFORD[n % 32] + out; n = Math.floor(n / 32); }
  const bytes = createHash("sha256").update(salt).digest();
  for (let i = 0; i < 16; i++) out += CROCKFORD[bytes[i] & 31];
  return out;
}

const baseMs = Date.parse(`${BASE}T00:00:00+05:30`);
const rand = prng(20260722);
const eventsDir = join(OUT, "events");
mkdirSync(eventsDir, { recursive: true });

let total = 0;
for (let d = 0; d < DAYS; d++) {
  const dayMs = baseMs + d * 86400000;
  const day = new Date(dayMs + 5.5 * 3600000).toISOString().slice(0, 10);
  const lines = [];
  for (let i = 0; i < PER_DAY; i++) {
    // Spread events across the working day so timestamps are plausible, not all midnight.
    const ms = dayMs + Math.floor(rand() * 12 * 3600000) + 9 * 3600000;
    const shifted = new Date(ms + 5.5 * 3600000);
    const p = (v, w = 2) => String(v).padStart(w, "0");
    const ts =
      `${shifted.getUTCFullYear()}-${p(shifted.getUTCMonth() + 1)}-${p(shifted.getUTCDate())}` +
      `T${p(shifted.getUTCHours())}:${p(shifted.getUTCMinutes())}:${p(shifted.getUTCSeconds())}+05:30`;
    const kind = KINDS[Math.floor(rand() * KINDS.length)];
    const idem = sha256(`synthetic|${d}|${i}|${kind}`);
    const event = {
      id: ulid(ms, idem),
      v: 1,
      ts: ts.slice(0, 10) === day ? ts : `${day}T12:00:00+05:30`, // keep every event in its own day file
      idem,
      actor: "arc-event",
      process: "synthetic@1.0.0",
      model: null,
      venture: rand() < 0.3 ? "venturemind" : "arc",
      run_id: `r-syn-${d}`,
      kind,
      payload: { seq: i, note: `synthetic event ${i} of day ${d}` },
      outcome: rand() < 0.9 ? "ok" : "partial",
      cost: null,
      evidence: null,
      supersedes: null,
    };
    const { sha, ...rest } = event; // eslint-disable-line no-unused-vars
    event.sha = sha256(canon(rest));
    lines.push(canon(event));
    total++;
  }
  writeFileSync(join(eventsDir, `${day}.jsonl`), lines.join("\n") + "\n", "utf8");
}

process.stdout.write(`generated ${total} events across ${DAYS} days in ${OUT}\n`);
