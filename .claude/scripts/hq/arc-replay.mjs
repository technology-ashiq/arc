#!/usr/bin/env node
// arc-replay -- rebuild every derived thing from the spine.
//
// REQ-04: state is derived, never truth. Deleting all of derived/ and replaying must
// reproduce byte-identical output. That is only true if replay reads ONLY the JSONL and
// never carries anything forward, so this script always rebuilds from empty -- there is no
// incremental path and there should not be one.
//
// What it derives:
//   derived/idem.index   idem -> id, rebuilt WHOLE. This is also the repair for the two
//                        confirmed crash windows: an event appended without its index
//                        entry, and a torn index tail that swallowed the entry after it.
//   derived/state.db     an sqlite INDEX over the same stored lines (Node 22+ only).
//                        It stores each line verbatim, so the sqlite reader returns the
//                        same bytes the scan reader does rather than a re-derivation.
//
// Usage: arc-replay [--quiet]

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { SpineError } from "./lib/canonical.mjs";
import { derivedDir, idemIndexPath, spineRoot, withLock } from "./lib/spine-io.mjs";
import { STATE_DB, scanAll } from "./spine.mjs";

// Resolved BEFORE the lock is taken, because everything done while holding the lock must be
// synchronous -- see the note on withLock below.
async function loadSqlite() {
  try {
    const { DatabaseSync } = await import("node:sqlite");
    return DatabaseSync;
  } catch {
    return null;
  }
}

function buildStateDb(DatabaseSync, root, events, torn) {
  if (!DatabaseSync) return { built: false, reason: "node:sqlite unavailable (Node < 22)" };

  const path = STATE_DB(root);
  // Rebuild from empty. An accelerator that accumulates is an accelerator that can disagree
  // with the truth it is supposed to be indexing.
  try { rmSync(path, { force: true }); } catch { /* nothing to remove */ }

  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE events (
        seq     INTEGER PRIMARY KEY,
        id      TEXT NOT NULL,
        day     TEXT NOT NULL,
        kind    TEXT NOT NULL,
        venture TEXT NOT NULL,
        ts      TEXT NOT NULL,
        line    TEXT NOT NULL
      );
      CREATE INDEX events_kind    ON events(kind);
      CREATE INDEX events_venture ON events(venture);
      CREATE INDEX events_day     ON events(day);
      -- Damage is part of the state, so the index has to carry it. Without this table the
      -- sqlite reader cannot see a torn line (it never made it into events) and would
      -- render a damaged day as a quiet one, while the scan reader flagged it -- the two
      -- engines would disagree on the one thing it is most dangerous to be wrong about.
      CREATE TABLE torn (day TEXT NOT NULL, line INTEGER NOT NULL);
    `);
    const insert = db.prepare(
      "INSERT INTO events (seq, id, day, kind, venture, ts, line) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    const insertTorn = db.prepare("INSERT INTO torn (day, line) VALUES (?, ?)");
    db.exec("BEGIN");
    for (const e of events)
      insert.run(e.seq, e.event.id, e.day, e.event.kind, e.event.venture, e.event.ts, e.line);
    for (const t of torn) insertTorn.run(t.day, t.line);
    db.exec("COMMIT");
    return { built: true };
  } finally {
    db.close();
  }
}

async function main(argv) {
  const quiet = argv.includes("--quiet");
  const root = spineRoot();

  // Load the accelerator BEFORE taking the lock. withLock is synchronous and releases in a
  // finally block, so handing it an async body would return a pending promise and drop the
  // lock while the work was still running -- a lock that is not held is worse than no lock,
  // because the code reads as if it were safe.
  const DatabaseSync = await loadSqlite();

  // Hold the write lock: replaying while an emitter appends would index a half-written
  // view and then claim it is the whole truth.
  const result = withLock(root, () => {
    const { events, torn } = scanAll(root);

    mkdirSync(derivedDir(root), { recursive: true });
    const lines = events.map((e) => `${e.event.idem}\t${e.event.id}`);
    writeFileSync(idemIndexPath(root), lines.length ? lines.join("\n") + "\n" : "", "utf8");

    const db = buildStateDb(DatabaseSync, root, events, torn);
    return { count: events.length, torn, db };
  });

  if (!quiet) {
    process.stdout.write(`replayed ${result.count} event(s)\n`);
    process.stdout.write(`idem index: ${result.count} entr${result.count === 1 ? "y" : "ies"}\n`);
    process.stdout.write(`state.db: ${result.db.built ? "built" : `skipped (${result.db.reason})`}\n`);
  }
  if (result.torn.length) {
    process.stderr.write(
      `arc-replay: WARN ${result.torn.length} unparseable line(s) skipped -- ${result.torn.map((t) => `${t.day}:${t.line}`).join(", ")}\n`,
    );
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-replay: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
