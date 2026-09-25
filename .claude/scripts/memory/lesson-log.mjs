#!/usr/bin/env node
// lesson-log.mjs -- the memory lane's ONE writer of a retro-log lesson (face v2 Phase 06 slice 04, the "Log a
// lesson" session verb; /arc-retro step 3 and 3b for one row).
//
//   lesson-log.mjs --row-file PATH [--as-process NAME@VER] [--dry-run]
//
// A headless run held Edit on the whole of docs/retro-log.md, so "append one row and change nothing else" was a
// sentence in a prompt (attack 3e97a85 B8), and a row carrying a fragment of a file it read went into a tracked file
// unscanned (B9). This tool is the only way the session verb touches the log. It reads the row from a file under
// .claude/state/lesson-log/ (bytes, never argv), and then:
//
//   1. checks the row is ONE line in the log's form: `YYYY-MM-DD | <project> | <pattern> | <prevention> | <tags>`,
//      a real date, 2 to 5 lowercase tags, no `|` inside a field, no control character;
//   2. scans it with the spine's secret rules -- the log is tracked, in a public repo;
//   3. runs the near-duplicate rule conflict-check.mjs runs (findNearDuplicates, >= 2 shared tags AND jaccard >= 0.5)
//      over the log as it is now. A hit is NOT appended: the candidates are named, and amending a past row stays a
//      person's judgement (ADR-0705: the check surfaces, it never resolves);
//   4. appends the row as the file's last line, one write, the rest of the file untouched;
//   5. emits note.logged {what, file, appended, duplicate_of} -- tagged --process NAME@VER when a run asks -- and
//      prints `receipt: note.logged <ULID>`.
//
// --dry-run does 1-3 and prints what 4 and 5 would do, writing nothing.
//
// Exit: 0 done · 1 the row IS appended and its receipt is not (said so, never retried silently) · 2 refused, nothing
// written.

import { closeSync, fstatSync, openSync, readSync, readFileSync, appendFileSync, realpathSync, lstatSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseRetroLog } from "./adapters/retro-log.mjs";
import { findNearDuplicates, RETRO_LOG } from "./conflict-check.mjs";
import { emitReceipt, spineRefusal } from "../core/plan-expect.mjs";
import { scanSecrets, sizeScaledCap } from "../hq/lib/redact.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const SCRATCH = [".claude", "state", "lesson-log"];
const ROW_CAP = 1200;
const PROCESS_RE = /^[a-z][a-z0-9-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;

function die(code, msg) { process.stderr.write(`lesson-log: ${msg}\n`); process.exitCode = code; throw new Stop(); }
class Stop extends Error {}
let appended = false;

function parseArgs(argv) {
  const out = { rowFile: "", asProcess: "", dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { if (out.dryRun) die(2, "--dry-run given twice"); out.dryRun = true; continue; }
    if (a !== "--row-file" && a !== "--as-process") die(2, `unknown argument ${JSON.stringify(a).slice(0, 80)} -- known: --row-file --as-process --dry-run`);
    if (seen.has(a)) die(2, `${a} given twice; pick one`);
    seen.add(a);
    const v = argv[i + 1];
    if (typeof v !== "string" || v === "" || v.startsWith("--")) die(2, `${a} needs a value`);
    i += 1;
    if (a === "--row-file") out.rowFile = v; else out.asProcess = v;
  }
  if (!out.rowFile) die(2, "usage: lesson-log.mjs --row-file PATH [--as-process NAME@VER] [--dry-run]");
  if (out.asProcess && !PROCESS_RE.test(out.asProcess)) die(2, "--as-process is <process>@<major.minor.patch>");
  return out;
}

/** The row file: under .claude/state/lesson-log/, a plain file, read through its descriptor with a cap. */
function readRow(path) {
  // A drive-absolute, UNC or device path is refused before anything resolves it: path.relative across two drives
  // returns the target itself, which no `..` check sees (attack 3e97a85 B1, rule-propose's twin).
  if (isAbsolute(path) || /^[\\/]{2}/.test(path) || /^[A-Za-z]:/.test(path)) die(2, "--row-file is a path inside the repo, not an absolute, drive or UNC path");
  let dir, real;
  try { dir = realpathSync.native(join(REPO, ...SCRATCH)); } catch { die(2, "this clone has no .claude/state/lesson-log directory -- write the row there first"); }
  try { real = realpathSync.native(resolve(REPO, path)); } catch (e) { die(2, `--row-file cannot be resolved (${e.code || "error"})`); }
  const rel = relative(dir, real);
  if (!rel || isAbsolute(rel) || rel.startsWith("..") || rel.includes("/") || rel.includes("\\")) die(2, "--row-file must sit directly in .claude/state/lesson-log/");
  let fd;
  try {
    // lstat BEFORE open: a FIFO blocks open() for ever waiting for a writer.
    if (!lstatSync(real).isFile()) die(2, "--row-file is not a plain file");
    fd = openSync(real, "r");
    const st = fstatSync(fd);
    if (!st.isFile()) die(2, "--row-file is not a plain file");
    if (st.size > ROW_CAP) die(2, `--row-file is ${st.size} bytes -- a row is at most ${ROW_CAP}`);
    const buf = Buffer.alloc(ROW_CAP + 1);
    const n = readSync(fd, buf, 0, ROW_CAP + 1, 0);
    if (n > ROW_CAP) die(2, `a row is at most ${ROW_CAP} bytes`);
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, n)); } catch { die(2, "--row-file is not valid UTF-8"); }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return text.replace(/\r?\n$/, "");
  } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closed */ } }
}

/** The log's own form, strictly. Returns the row's fields, or dies naming what is wrong. */
export function checkRow(row) {
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(row)) return "the row holds a control, format or line-break character -- it is ONE line";
  const parts = row.split(" | ");
  if (parts.length !== 5) return "the row is `YYYY-MM-DD | <project> | <pattern> | <prevention> | <tags>`: five fields joined by ` | `";
  const [date, project, pattern, prevention, tags] = parts;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const real = d && new Date(Date.UTC(+d[1], +d[2] - 1, +d[3]));
  if (!d || real.getUTCFullYear() !== +d[1] || real.getUTCMonth() !== +d[2] - 1 || real.getUTCDate() !== +d[3]) return `the date ${JSON.stringify(date).slice(0, 20)} is not a real YYYY-MM-DD day`;
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(project)) return "the project is a lowercase slug";
  for (const [name, v] of [["pattern", pattern], ["prevention", prevention]]) {
    if (!v.trim() || v !== v.trim()) return `the ${name} is empty or padded`;
    if (v.includes("|")) return `the ${name} holds a \`|\`, which would split the row`;
  }
  const t = tags.split(",");
  if (t.length < 2 || t.length > 5 || !t.every((x) => /^[a-z0-9][a-z0-9-]{0,30}$/.test(x))) return "tags are 2 to 5 lowercase tokens joined by commas, no spaces";
  return { date, project, pattern, prevention, tags };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const row = readRow(args.rowFile);
  const fields = checkRow(row);
  if (typeof fields === "string") die(2, fields);
  let hit = null;
  try { const v = scanSecrets(row, { row }, { maxCandidates: sizeScaledCap(row) }); if (v.hit) hit = v.rule; } catch { hit = "unscannable"; }
  if (hit) die(2, `the row matches the secret rule ${hit} -- the log is tracked in a public repo, so nothing is written`);

  const logPath = join(REPO, RETRO_LOG);
  let logText;
  try { logText = readFileSync(logPath, "utf8"); } catch (e) { die(2, `${RETRO_LOG} cannot be read (${e.code || "error"})`); }
  const parsed = parseRetroLog(logText);
  const hits = findNearDuplicates({ prevention: fields.prevention, tags: fields.tags }, parsed.records);
  const duplicateOf = hits.map((h) => `${RETRO_LOG}:${h.record.line}`);
  const payload = { what: "lesson", file: RETRO_LOG, appended: duplicateOf.length === 0, duplicate_of: duplicateOf.join(",") };
  const flags = args.asProcess ? ["--process", args.asProcess] : [];
  const refused = spineRefusal(ARC_EVENT, "note.logged", payload, { cwd: REPO, flags });
  if (refused) die(2, `the receipt this lesson raises would be refused by the spine, so nothing is written: ${refused}`);

  if (args.dryRun) {
    process.stdout.write(duplicateOf.length ? `lesson-log: would NOT append -- near-duplicate of ${duplicateOf.join(", ")}\n` : `lesson-log: would append to ${RETRO_LOG}:\n  ${row}\n`);
    process.stdout.write("lesson-log: dry run -- nothing written, no receipt\n");
    return;
  }
  if (!duplicateOf.length) {
    // One write, the row alone, after exactly one newline: the file's last line is never rewritten.
    appendFileSync(logPath, `${logText.endsWith("\n") ? "" : "\n"}${row}\n`, { encoding: "utf8", flag: "a" });
    appended = true;
    process.stdout.write(`lesson-log: appended to ${RETRO_LOG}\n`);
  } else {
    process.stdout.write(`lesson-log: NOT appended -- near-duplicate of ${duplicateOf.join(", ")}\n`);
  }
  const got = emitReceipt(ARC_EVENT, "note.logged", payload, { cwd: REPO, timeoutMs: 60_000, flags });
  if (got.state !== "landed" || !got.id) die(appended ? 1 : 2, `${appended ? "the row IS appended, and " : ""}its receipt did not land -- ${got.why}`);
  process.stdout.write(`receipt: note.logged ${got.id}\n`);
}

// Run only as the CLI. Both sides realpathed: argv[1] beside import.meta.url silently no-ops behind a symlink.
function isMainModule() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try { return realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (!(e instanceof Stop)) {
      process.stderr.write(`lesson-log: ${appended ? "the row IS appended, and then this failed" : "nothing was written"}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}\n`);
      process.exitCode = appended ? 1 : 2;
    }
  }
}
