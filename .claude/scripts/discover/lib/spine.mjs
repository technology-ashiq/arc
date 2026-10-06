// discover/spine -- every spine read goes through the reader (SPINE-G, ADR-0030); every write
// through arc-event --strict, so a refused event is a failure here, never a silent exit 0.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { query } from "../../hq/spine.mjs";
import { spineRoot } from "../../hq/lib/spine-io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = join(HERE, "..", "..", "hq", "arc-event.mjs");
export const DISCOVER_VERSION = "0.1.0";
export const PROCESS = `discover@${DISCOVER_VERSION}`;
export const WINNER_GATE = "discover-winner";
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export class DiscoverError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function read(kind) {
  const r = await query(spineRoot(), { kind, engine: "scan" });
  // A day the reader could not open may hold the very event we are asking about.
  if (r.unreadable.length) throw new DiscoverError("COULD_NOT_SCAN", `spine has unreadable day(s): ${r.unreadable.join(", ")}`);
  return r.events.map((e) => e.event);
}

/** source_ids discover already captured -- so a re-fetch emits nothing and DUP_IDEM never fires. */
export async function capturedIds() {
  const ids = new Set();
  for (const ev of await read("idea.captured"))
    if (String(ev.process || "").startsWith("discover") && ev.payload && typeof ev.payload.source_id === "string") ids.add(ev.payload.source_id);
  return ids;
}

/**
 * Rejected winners, as [{ receipt, tokens }] (ADR-1916). decision.recorded is closed to
 * decides|verdict|reason, so the tokens live on the approval.requested it decides.
 */
export async function readRejects() {
  const asks = new Map();
  for (const ev of await read("approval.requested"))
    if (ev.payload && ev.payload.gate === WINNER_GATE && Array.isArray(ev.payload.cluster_tokens)) asks.set(ev.id, ev.payload.cluster_tokens.filter((t) => typeof t === "string"));
  const out = [];
  for (const ev of await read("decision.recorded")) {
    const p = ev.payload || {};
    if (p.verdict === "reject" && asks.has(p.decides)) out.push({ receipt: ev.id, tokens: asks.get(p.decides) });
  }
  return out;
}

export const WEIGHTS_GATE = "discover-weights";

/** Is `decision` an approve of a discover-weights request carrying exactly `sha`? (DIS-C) */
export async function weightsApproved(decision, sha) {
  const dec = (await read("decision.recorded")).find((ev) => ev.id === decision);
  if (!dec || (dec.payload || {}).verdict !== "approve") return false;
  const ask = (await read("approval.requested")).find((ev) => ev.id === dec.payload.decides);
  return Boolean(ask && ask.payload && ask.payload.gate === WEIGHTS_GATE && ask.payload.weights_sha256 === sha);
}

/** council.verdict receipts keyed by question_hash (ADR-1910: the hash is the only thread). */
export async function verdictsByHash(hashes) {
  const want = new Set(hashes);
  const out = new Map();
  for (const ev of await read("council.verdict")) {
    const p = ev.payload || {};
    if (want.has(p.question_hash) && !out.has(p.question_hash)) out.set(p.question_hash, { receipt: ev.id, session_id: p.session_id, call: p.call, confidence: p.confidence });
  }
  return out;
}

/** The decision that decides `requestId`, or null while it is still open. */
export async function decisionFor(requestId) {
  const ev = (await read("decision.recorded")).find((e) => (e.payload || {}).decides === requestId);
  return ev ? { id: ev.id, verdict: ev.payload.verdict, reason: ev.payload.reason } : null;
}

/** Emit one event; returns its ULID or throws UNRECEIPTED with arc-event's own reason. */
export function emit(kind, payload, { idem } = {}) {
  // Through a file, never argv: a long title list overruns the Windows command line (attack dfe58d2 B6).
  const dir = mkdtempSync(join(tmpdir(), "discover-emit-"));
  const file = join(dir, "payload.json");
  const args = [ARC_EVENT, "emit", kind, "--strict", "--process", PROCESS, "--payload-file", file];
  if (idem) args.push("--idem", idem);
  let r;
  try {
    writeFileSync(file, JSON.stringify(payload));
    r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 60000, killSignal: "SIGKILL" });
  }
  finally { rmSync(dir, { recursive: true, force: true }); }
  const id = (r.stdout || "").trim().split("\n").pop();
  if (r.status !== 0 || !ULID.test(id || ""))
    throw new DiscoverError("UNRECEIPTED", `${kind} was not recorded: ${(r.stderr || "").trim().split("\n").pop() || `exit ${r.status}`}`);
  return id;
}
