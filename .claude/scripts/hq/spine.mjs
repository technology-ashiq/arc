#!/usr/bin/env node
// spine -- the reader. ADR-0030: this is arc's ONLY public API.
//
// Nothing outside this file and arc-replay may open events/*.jsonl or state.db. Every
// consumer (brief, inbox, and every later module) goes through here, keeps its own cursor,
// and gets back events in APPEND ORDER.
//
// Append order, not ULID order. Two emitter processes in the same millisecond produce ULIDs
// with no defined order between them, so a cursor that sorts by string can silently skip an
// event. The spine's order is the order lines were written: day file by day, line by line.
// `--since` therefore means "everything after the line carrying this id", never a string
// comparison (REQ-09, and a confirmed finding of the Phase-0 adversarial pass).
//
// Engine (ADR-0024): the canonical path is a JSONL scan and works on Node >= 18. When
// node:sqlite exists (Node 22+) and a replay has built state.db, the sqlite path is an
// INDEX over the very same stored lines -- it re-reads the same bytes rather than deriving
// anything, which is what makes the equivalence gate meaningful instead of decorative.
//
// Usage:
//   spine read [--kind K] [--since ULID] [--venture V] [--date YYYY-MM-DD] [--limit N]
//   spine cursor                       # the id of the newest event, for a consumer to store
//   spine days                         # the days that exist

import { existsSync, readFileSync } from "node:fs";
import { SpineError, ULID_RE } from "./lib/canonical.mjs";
import { dayFile, listDays, spineRoot, derivedDir } from "./lib/spine-io.mjs";
import { join } from "node:path";

export const STATE_DB = (root) => join(derivedDir(root), "state.db");

/** Which engine to use. `auto` prefers sqlite when it is genuinely available. */
export function chooseEngine(root, requested) {
  const want = requested || process.env.ARC_SPINE_ENGINE || "auto";
  if (want === "scan") return "scan";
  if (!existsSync(STATE_DB(root))) return want === "sqlite" ? "sqlite-missing" : "scan";
  return want === "sqlite" ? "sqlite" : "sqlite";
}

/**
 * Read every event in append order.
 * Returns { events, torn } -- torn lines are REPORTED, never silently dropped: a line the
 * reader cannot parse is exactly the kind of damage that must not look like an empty day.
 */
export function scanAll(root) {
  const events = [];
  const torn = [];
  let seq = 0;
  for (const day of listDays(root)) {
    const file = dayFile(root, day);
    let text;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "") continue;
      let event;
      try { event = JSON.parse(line); } catch {
        torn.push({ day, line: i + 1 });
        continue;
      }
      events.push({ event, day, seq: seq++, line });
    }
  }
  return { events, torn };
}

/**
 * Read all events through the chosen engine.
 *
 * node:sqlite is imported LAZILY. A static import would make this whole module unloadable
 * on Node 18 and take the canonical scan path down with it -- the accelerator must never be
 * able to break the path it is only supposed to accelerate.
 */
export async function readAll(root, engine) {
  const chosen = chooseEngine(root, engine);
  if (chosen === "sqlite-missing")
    throw new SpineError("NO_STATE_DB", "sqlite engine requested but state.db does not exist -- run arc-replay");
  if (chosen === "sqlite") {
    try {
      const { DatabaseSync } = await import("node:sqlite");
      const db = new DatabaseSync(STATE_DB(root), { readOnly: true });
      try {
        const rows = db.prepare("SELECT seq, day, line FROM events ORDER BY seq ASC").all();
        const events = [];
        // Damage recorded by the replay that built this index. Reading it back is what
        // keeps the two engines telling the same story about a damaged day.
        const torn = db.prepare("SELECT day, line FROM torn ORDER BY day, line").all()
          .map((t) => ({ day: t.day, line: t.line }));
        for (const r of rows) {
          try { events.push({ event: JSON.parse(r.line), day: r.day, seq: r.seq, line: r.line }); }
          catch { torn.push({ day: r.day, line: r.seq }); }
        }
        return { events, torn, engine: "sqlite" };
      } finally { db.close(); }
    } catch (e) {
      if (process.env.ARC_SPINE_ENGINE === "sqlite")
        throw new SpineError("NO_SQLITE", `sqlite engine requested but unusable: ${e.message}`);
      // auto: fall back to the canonical path, which always works
    }
  }
  return { ...scanAll(root), engine: "scan" };
}

/**
 * Filter in append order. `since` is positional: find the line carrying that id and take
 * everything after it. A cursor the spine has never seen is an error, not an empty result --
 * silently returning nothing is how a consumer sleeps through its own broken state.
 */
export function applyFilters(events, { kind, since, venture, date, limit } = {}) {
  let out = events;
  if (since !== undefined && since !== null) {
    if (!ULID_RE.test(since)) throw new SpineError("BAD_CURSOR", `--since "${since}" is not a ULID`);
    const at = out.findIndex((e) => e.event.id === since);
    if (at === -1) throw new SpineError("CURSOR_NOT_FOUND", `cursor ${since} is not on this spine`);
    out = out.slice(at + 1);
  }
  if (kind) { const wanted = new Set(String(kind).split(",")); out = out.filter((e) => wanted.has(e.event.kind)); }
  if (venture) out = out.filter((e) => e.event.venture === venture);
  if (date) out = out.filter((e) => e.day === date);
  if (limit !== undefined && limit !== null) out = out.slice(0, Number(limit));
  return out;
}

export async function query(root, filters = {}) {
  const { events, torn, engine } = await readAll(root, filters.engine);
  return { events: applyFilters(events, filters), torn, engine };
}

// ---------- CLI ----------
const VALUE_FLAGS = new Set(["kind", "since", "venture", "date", "limit", "engine"]);

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const name = a.slice(2);
      if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
      const next = argv[i + 1];
      if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
      flags[name] = next;
      i++;
      continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

async function main(argv) {
  const { positional, flags } = parseArgs(argv);
  const command = positional[0] || "read";
  const root = spineRoot();

  if (command === "days") {
    for (const d of listDays(root)) process.stdout.write(`${d}\n`);
    return 0;
  }

  const { events, torn, engine } = await query(root, flags);
  if (torn.length)
    process.stderr.write(`spine: WARN ${torn.length} unparseable line(s) on the spine -- ${torn.map((t) => `${t.day}:${t.line}`).join(", ")}\n`);

  if (command === "cursor") {
    const all = (await readAll(root, flags.engine)).events;
    process.stdout.write(all.length ? `${all[all.length - 1].event.id}\n` : "\n");
    return 0;
  }
  if (command !== "read") throw new SpineError("BAD_ARGS", `unknown command "${command}"`);

  for (const e of events) process.stdout.write(`${e.line}\n`);
  if (process.env.ARC_SPINE_DEBUG) process.stderr.write(`spine: engine=${engine} events=${events.length}\n`);
  return 0;
}

// Only run the CLI when invoked directly -- importers get the library, not a side effect.
if (process.argv[1] && process.argv[1].endsWith("spine.mjs")) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      const code = err instanceof SpineError ? err.code : "INTERNAL";
      process.stderr.write(`spine: ERROR ${code} -- ${err.message}\n`);
      process.exit(2);
    });
}
