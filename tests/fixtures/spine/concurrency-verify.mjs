#!/usr/bin/env node
// Section E's assertions, in ONE process.
//
// Why a helper and not inline shell: the subject's checks are set comparisons over 200 JSON
// objects, and doing that in bash means either jq (not installed on every CI leg) or a
// process per line (200 spawns on the leg where spawning is the whole cost). One node call
// does all of it, and node is guaranteed present -- it is the emitter's own runtime.
//
// REQUIRED_KEYS is IMPORTED from the validator rather than restated here. A copied key list
// is a second source of truth that drifts silently, and the drift would land in exactly the
// direction that matters: a schema gaining a key while the concurrency test keeps passing
// against the old shape.
//
//   concurrency-verify.mjs --control <file> --writers <n> --width <bytes>
//   concurrency-verify.mjs --spine <root> --ids <dir> --expect <n>
//
// Exit: 0 all assertions hold | 1 an assertion failed (every failure printed, not just the
// first -- one CI run should tell you everything that is wrong).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
// A RELATIVE static import on purpose: a dynamic import of an absolute path throws on
// windows, where "E:\..." is not a valid module specifier and needs a file:// URL.
import { REQUIRED_KEYS } from "../../../.claude/scripts/hq/lib/validate.mjs";

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? undefined : argv[i + 1];
};

const failures = [];
const fail = (msg) => failures.push(msg);

// ---------------------------------------------------------------------------- control ----
// The control's job is to prove this leg can actually interleave two writers. A CLEAN
// result is not good news: it means the harness never achieved contention, so the subject's
// pass below carries no information about concurrency at all.
function checkControl(file, writers, width) {
  const raw = readFileSync(file, "utf8");
  const parts = raw.split("\n");
  if (parts[parts.length - 1] !== "") return `TORN no trailing newline (last write was cut off)`;
  const lines = parts.slice(0, -1);

  if (lines.length !== writers)
    return `TORN ${lines.length} lines from ${writers} writers (a torn line splits one write into two)`;

  const chars = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length !== width)
      return `TORN line ${i + 1} is ${line.length} bytes, each writer wrote ${width}`;
    const c = line[0];
    if (line !== c.repeat(line.length))
      return `TORN line ${i + 1} mixes more than one writer's fill character`;
    chars.add(c);
  }
  if (chars.size !== writers)
    return `TORN ${chars.size} distinct fill characters across ${writers} writers`;

  return "CLEAN";
}

// ---------------------------------------------------------------------------- subject ----
function dayFiles(root) {
  const dir = join(root, "events");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))
    .sort()
    .map((n) => join(dir, n));
}

function checkSubject(root, idsDir, expect) {
  const files = dayFiles(root);
  if (files.length === 0) fail("no day file was written at all");
  // More than one day file is legitimate: a run straddling IST midnight rolls over. The
  // assertions below are per-file for the byte-level ones and pooled for the id multiset,
  // so a rollover cannot quietly halve the expected count.
  if (files.length > 1)
    process.stdout.write(`note: ${files.length} day files (the run straddled midnight)\n`);

  const seenIds = [];
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    const name = basename(file);

    if (!raw.endsWith("\n")) fail(`${name}: does not end with a newline (last line is truncated)`);
    if (raw.endsWith("\n\n")) fail(`${name}: ends with more than one newline`);

    const parts = raw.split("\n");
    const lines = parts[parts.length - 1] === "" ? parts.slice(0, -1) : parts;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const at = `${name}:${i + 1}`;
      if (line.length === 0) { fail(`${at}: zero-length line`); continue; }

      let obj;
      try {
        obj = JSON.parse(line);
      } catch (e) {
        // This is the assertion a torn write fails: half a record is not JSON.
        fail(`${at}: does not parse as JSON (${e.message}) -- first 120 bytes: ${JSON.stringify(line.slice(0, 120))}`);
        continue;
      }

      // A truncated line can still parse if the tear happens to land on a brace. The key
      // set is what catches that: a partial record is missing fields.
      const keys = Object.keys(obj).sort();
      const want = [...REQUIRED_KEYS, "sha"].sort();
      if (keys.length !== want.length || keys.some((k, n) => k !== want[n]))
        fail(`${at}: key set is [${keys.join(",")}], schema is [${want.join(",")}]`);

      if (typeof obj.id === "string") seenIds.push(obj.id);
    }
  }

  // What the emitters said they wrote, straight from their stdout.
  const emitted = [];
  for (const n of readdirSync(idsDir).sort()) {
    if (!/^ids-/.test(n)) continue;
    for (const line of readFileSync(join(idsDir, n), "utf8").split("\n"))
      if (line !== "") emitted.push(line.trim());
  }

  if (emitted.length !== expect)
    fail(`emitters reported ${emitted.length} ids, expected ${expect}`);
  if (seenIds.length !== emitted.length)
    fail(`day files hold ${seenIds.length} events, emitters reported ${emitted.length}`);

  // Multiset equality, not set equality: set equality would hide a duplicate.
  const a = [...seenIds].sort();
  const b = [...emitted].sort();
  const missing = b.filter((id, i) => a[i] !== id);
  if (a.length !== b.length || missing.length > 0) {
    const inFile = new Set(a);
    const lost = b.filter((id) => !inFile.has(id));
    const emittedSet = new Set(b);
    const extra = a.filter((id) => !emittedSet.has(id));
    const dupes = a.filter((id, i) => i > 0 && a[i - 1] === id);
    if (lost.length) fail(`${lost.length} event(s) LOST -- emitted but not on the spine: ${lost.slice(0, 5).join(",")}`);
    if (extra.length) fail(`${extra.length} event(s) on the spine that no emitter reported: ${extra.slice(0, 5).join(",")}`);
    if (dupes.length) fail(`${dupes.length} DUPLICATE id(s) on the spine: ${dupes.slice(0, 5).join(",")}`);
    if (!lost.length && !extra.length && !dupes.length) fail("id multisets differ for a reason none of the three checks named");
  }

  return seenIds.length;
}

// ------------------------------------------------------------------------------- main ----
if (flag("control") !== undefined) {
  const writers = Number(flag("writers"));
  const width = Number(flag("width"));
  if (!Number.isInteger(writers) || !Number.isInteger(width)) {
    process.stderr.write("concurrency-verify: --control needs --writers and --width\n");
    process.exit(1);
  }
  process.stdout.write(`${checkControl(flag("control"), writers, width)}\n`);
  process.exit(0);
}

const root = flag("spine");
const ids = flag("ids");
const expect = Number(flag("expect"));
if (!root || !ids || !Number.isInteger(expect)) {
  process.stderr.write("concurrency-verify: needs --spine <root> --ids <dir> --expect <n>\n");
  process.exit(1);
}

const count = checkSubject(root, ids, expect);
if (failures.length) {
  for (const f of failures) process.stdout.write(`FAIL ${f}\n`);
  process.exit(1);
}
process.stdout.write(`OK ${count} events, zero interleaving\n`);
