#!/usr/bin/env node
/**
 * hq/adr-record.mjs -- write ONE ADR into docs/adr/ at the next free number of a lane's century, and emit its
 * note.logged receipt (face Phase 06, the strategy room's "Record an ADR" session verb).
 *
 *   adr-record.mjs --lane NAME --adr-file PATH [--as-process NAME@VER] [--dry-run]
 *
 * The ADR file is written by the session into .claude/state/adr-record/ and holds the title on its first line, a
 * blank line, then the body, which carries a `## Context` and a `## Decision` section. This script is the one writer
 * of docs/adr/ for the verb: it picks the number, writes the heading block, secret-scans the text and emits the receipt.
 * `adr.recorded` is not a kind (ADR-0026 closes the vocabulary); an ADR is a note with a file.
 *
 * THE NUMBER. A lane numbers only inside its own century, read from PORTFOLIO.md's band table. Taken numbers are read
 * from this tree, from every branch this repository holds (local and origin/*) and from every sibling worktree's
 * docs/adr/ on disk: three lanes once claimed one century in the same week because each looked at its own worktree.
 * A number an unsaved editor buffer holds is still invisible; kickoff-lint's [adr-dup] is the control for that.
 *
 * Exit 0 written (or planned) · 1 the ADR IS written and its receipt did not land · 2 refused, nothing written.
 */
import { closeSync, fstatSync, openSync, readSync, readFileSync, readdirSync, realpathSync, lstatSync, writeFileSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { emitReceipt, spineRefusal, withExclusiveLock } from "../core/plan-expect.mjs";
import { withGitReader } from "../core/proposal-branch.mjs";
import { scanSecrets, sizeScaledCap } from "./lib/redact.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const SCRATCH = [".claude", "state", "adr-record"];
const ADR_DIR = "docs/adr";
const ADR_CAP = 20_000;
const LANE_RE = /^[a-z][a-z0-9-]{0,63}$/;
const PROCESS_RE = /^[a-z][a-z0-9-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/;

function die(code, msg) { process.stderr.write(`adr-record: ${msg}\n`); process.exitCode = code; throw new Stop(); }
class Stop extends Error {}
let written = false;

function parseArgs(argv) {
  const out = { lane: "", adrFile: "", asProcess: "", dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") { if (out.dryRun) die(2, "--dry-run given twice"); out.dryRun = true; continue; }
    if (a !== "--lane" && a !== "--adr-file" && a !== "--as-process") die(2, `unknown argument ${JSON.stringify(a).slice(0, 80)} -- known: --lane --adr-file --as-process --dry-run`);
    if (seen.has(a)) die(2, `${a} given twice; pick one`);
    seen.add(a);
    const v = argv[i + 1];
    if (typeof v !== "string" || v === "" || v.startsWith("--")) die(2, `${a} needs a value`);
    i += 1;
    if (a === "--lane") out.lane = v; else if (a === "--adr-file") out.adrFile = v; else out.asProcess = v;
  }
  if (!out.lane || !out.adrFile) die(2, "usage: adr-record.mjs --lane NAME --adr-file PATH [--as-process NAME@VER] [--dry-run]");
  if (!LANE_RE.test(out.lane)) die(2, "--lane is a lane name: [a-z][a-z0-9-]*, at most 64");
  if (out.asProcess && !PROCESS_RE.test(out.asProcess)) die(2, "--as-process is <process>@<major.minor.patch>");
  return out;
}

/** The ADR file: directly under .claude/state/adr-record/, a plain file, read through its descriptor with a cap. */
function readAdr(path) {
  // A drive-absolute, UNC or device path is refused before anything resolves it: path.relative across two drives
  // returns the target itself, which no `..` check sees (lesson-log and rule-propose's twin, attack 3e97a85 B1).
  if (isAbsolute(path) || /^[\\/]{2}/.test(path) || /^[A-Za-z]:/.test(path)) die(2, "--adr-file is a path inside the repo, not an absolute, drive or UNC path");
  let dir, real;
  try { dir = realpathSync.native(join(REPO, ...SCRATCH)); } catch { die(2, "this clone has no .claude/state/adr-record directory -- write the ADR there first"); }
  try { real = realpathSync.native(resolve(REPO, path)); } catch (e) { die(2, `--adr-file cannot be resolved (${e.code || "error"})`); }
  // The scratch directory itself resolves inside the repo: a junction on .claude/state sent the read elsewhere (B12).
  let top;
  try { top = realpathSync.native(REPO); } catch { die(2, "the repository root cannot be resolved"); }
  if (!dir.startsWith(top + sep)) die(2, ".claude/state/adr-record resolves outside the repository");
  const rel = relative(dir, real);
  // A `:` names an NTFS alternate stream, content no listing of the directory shows (B11).
  if (!rel || isAbsolute(rel) || rel.startsWith("..") || rel.includes("/") || rel.includes("\\") || rel.includes(":")) die(2, "--adr-file must sit directly in .claude/state/adr-record/");
  let fd;
  try {
    // lstat BEFORE open: a FIFO blocks open() for ever waiting for a writer.
    if (!lstatSync(real).isFile()) die(2, "--adr-file is not a plain file");
    fd = openSync(real, "r");
    const st = fstatSync(fd);
    if (!st.isFile()) die(2, "--adr-file is not a plain file");
    if (st.size > ADR_CAP) die(2, `--adr-file is ${st.size} bytes -- an ADR is at most ${ADR_CAP}`);
    const buf = Buffer.alloc(ADR_CAP + 1);
    const n = readSync(fd, buf, 0, ADR_CAP + 1, 0);
    if (n > ADR_CAP) die(2, `an ADR is at most ${ADR_CAP} bytes`);
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, n)); } catch { die(2, "--adr-file is not valid UTF-8"); }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return { text: text.replace(/\r\n/g, "\n"), real };
  } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closed */ } }
}

/** The ADR's own form. Returns { title, body }, or a string naming what is wrong. */
export function checkAdr(text) {
  // Tabs and newlines are the only control characters a markdown body needs; a lone CR, a NUL or a line separator
  // hides a line from one reader and shows it to another.
  if (/[\u0000-\u0008\u000B-\u001F\u007F\p{Cf}\p{Zl}\p{Zp}]/u.test(text)) return "the ADR holds a control, format or line-separator character";
  const lines = text.replace(/\n+$/, "").split("\n");
  const title = lines[0] ?? "";
  if (title !== title.trim() || title.length < 8 || title.length > 120) return "line 1 is the title: 8 to 120 characters, not padded";
  if (/^#/.test(title)) return "line 1 is the title alone -- the `# ADR NNNN` heading is written by this script";
  if (lines[1] !== "") return "line 2 is blank: the title, a blank line, then the body";
  const body = lines.slice(2);
  if (body.some((l) => /^# /.test(l))) return "the body holds a second `# ` heading -- the ADR has one, written by this script";
  if (body.some((l) => /^\*\*(Status|Date|Lane):\*\*/.test(l))) return "the body restates a header field (Status, Date or Lane) -- this script writes them";
  for (const h of ["## Context", "## Decision"]) {
    if (!body.includes(h)) return `the body has no \`${h}\` section`;
  }
  const decision = body.slice(body.indexOf("## Decision") + 1).join("\n").split(/\n## /)[0];
  if (!decision.trim()) return "the `## Decision` section is empty";
  return { title, body: body.join("\n") };
}

/** A filename slug from the title: lowercase ascii words joined by `-`, at most 60 characters. */
export function slugOf(title) {
  const words = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean);
  let s = "";
  for (const w of words) { const next = s ? `${s}-${w}` : w; if (next.length > 60) break; s = next; }
  return s || "decision";
}

/** The lane's century from PORTFOLIO.md's band table: exactly one row `| AAAA–BBBB | \`lane\` ...`. */
export function bandOf(portfolioText, lane) {
  const rows = [];
  for (const line of portfolioText.split(/\r?\n/)) {
    const m = /^\| (\d{4})[–-](\d{4}) \| `([a-z][a-z0-9-]*)`/.exec(line);
    if (m && m[3] === lane) rows.push({ lo: Number(m[1]), hi: Number(m[2]) });
  }
  if (rows.length !== 1) return rows.length ? `PORTFOLIO.md's band table gives the ${lane} lane ${rows.length} centuries -- refusing to guess` : `PORTFOLIO.md's band table gives the ${lane} lane no century`;
  if (!(rows[0].lo < rows[0].hi)) return `the ${lane} lane's century ${rows[0].lo}-${rows[0].hi} is not a range`;
  return rows[0];
}

const numOf = (name) => { const m = /^(\d{4})-.*\.md$/.exec(name); return m ? Number(m[1]) : null; };

/**
 * Every ADR number this tree, every branch the repository holds and every sibling worktree on disk carries, through the
 * one bounded git reader. Git's names are read NUL-separated (-z): a quoted `"1330-na\303\257ve.md"` did not start with
 * a digit and its number was issued again (attack 1f95807 B5). A ref's docs/adr is asked in ONE batch, and each answer
 * is present or missing; any other answer, a timeout or an exit fails the run -- a failure to look is not "nothing
 * taken" (B6).
 * @param {(args: string[], o?: { ok?: number[], input?: string }) => Promise<{ out: string, status: number }>} read
 */
async function takenNumbers(read) {
  const taken = new Set();
  const add = (names) => { for (const n of names) { const v = numOf(n); if (v !== null) taken.add(v); } };
  try { add(readdirSync(join(REPO, ADR_DIR))); } catch (e) { die(2, `${ADR_DIR} cannot be read (${e.code || "error"})`); }
  const refs = (await read(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/remotes"])).out.split("\n").filter((r) => r && !r.endsWith("/HEAD"));
  const trees = new Set();
  if (refs.length) {
    const asked = (await read(["cat-file", "--batch-check=%(objectname) %(objecttype)"], { input: refs.map((r) => `${r}:${ADR_DIR}\n`).join("") })).out.split("\n").filter(Boolean);
    if (asked.length !== refs.length) die(2, `git answered ${asked.length} of ${refs.length} branches -- the free number is unknown, nothing written`);
    asked.forEach((line, i) => {
      const m = /^([0-9a-f]{40,64}) tree$/.exec(line);
      if (m) trees.add(m[1]);
      else if (line !== `${refs[i]}:${ADR_DIR} missing`) die(2, `git cannot say whether ${refs[i].slice(0, 120)} holds ${ADR_DIR} (${line.slice(0, 120)}) -- the free number is unknown, nothing written`);
    });
  }
  for (const tree of trees) add((await read(["ls-tree", "-z", "--name-only", tree])).out.split("\u0000"));
  // Sibling worktrees: a claim written and not yet committed is on disk only. A worktree git lists and whose ADR
  // directory is absent holds nothing; one that cannot be READ is not absent, and fails the run (B7).
  for (const rec of (await read(["worktree", "list", "--porcelain", "-z"])).out.split("\u0000")) {
    if (!rec.startsWith("worktree ")) continue;
    const dir = join(rec.slice("worktree ".length), ADR_DIR);
    let names;
    try { names = readdirSync(dir); }
    catch (e) {
      if (e && (e.code === "ENOENT" || e.code === "ENOTDIR")) continue;
      die(2, `the worktree ADR directory ${dir} cannot be read (${e && e.code ? e.code : "error"}) -- the free number is unknown, nothing written`);
    }
    add(names);
  }
  return taken;
}

/** The next number: one past the highest taken inside the century, or its first number. Holes are never refilled. */
export function nextNumber(taken, band) {
  let hi = band.lo - 1;
  for (const n of taken) if (n >= band.lo && n <= band.hi && n > hi) hi = n;
  return hi + 1 <= band.hi ? hi + 1 : null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(join(REPO, "initiatives", args.lane, "PROGRESS.md"))) die(2, `there is no ${args.lane} lane (initiatives/${args.lane}/PROGRESS.md) -- an ADR is recorded for a born lane`);
  const scratch = readAdr(args.adrFile);
  const adr = checkAdr(scratch.text);
  if (typeof adr === "string") die(2, adr);
  let hit = null;
  try { const v = scanSecrets(adr.body, { title: adr.title, body: adr.body }, { maxCandidates: sizeScaledCap(adr.body) }); if (v.hit) hit = v.rule; } catch { hit = "unscannable"; }
  if (!hit) try { const v = scanSecrets(adr.title, { title: adr.title }, { maxCandidates: sizeScaledCap(adr.title) }); if (v.hit) hit = v.rule; } catch { hit = "unscannable"; }
  if (hit) die(2, `the ADR matches the secret rule ${hit} -- docs/adr is tracked in a public repo, so nothing is written`);

  let portfolio;
  try { portfolio = readFileSync(join(REPO, "PORTFOLIO.md"), "utf8"); } catch (e) { die(2, `PORTFOLIO.md cannot be read (${e.code || "error"})`); }
  const band = bandOf(portfolio, args.lane);
  if (typeof band === "string") die(2, band);
  const date = new Date().toISOString().slice(0, 10);
  const slug = slugOf(adr.title);
  const flags = args.asProcess ? ["--process", args.asProcess] : [];

  const plan = async (read) => {
    const number = nextNumber(await takenNumbers(read), band);
    if (number === null) die(2, `the ${args.lane} lane's century ${band.lo}-${band.hi} is full -- nothing written`);
    const nnnn = String(number).padStart(4, "0");
    const file = `${ADR_DIR}/${nnnn}-${slug}.md`;
    const text = `# ADR ${nnnn} — ${adr.title}\n\n**Status:** accepted\n**Date:** ${date}\n**Lane:** ${args.lane}\n**Recorded by:** the face's Record an ADR session${args.asProcess ? ` (\`${args.asProcess}\`)` : ""}\n\n${adr.body.replace(/\n+$/, "")}\n`;
    const payload = { what: "adr", file, lane: args.lane, number: nnnn };
    const refused = spineRefusal(ARC_EVENT, "note.logged", payload, { cwd: REPO, flags });
    if (refused) die(2, `the receipt this ADR raises would be refused by the spine, so nothing is written: ${refused}`);
    return { file, text, payload };
  };
  const git = (fn) => withGitReader(REPO, fn).catch((e) => { if (e instanceof Stop) throw e; die(2, `${e && e.message ? e.message : "git failed"} -- the free number is unknown, nothing written`); });

  if (args.dryRun) {
    const p = await git((read) => plan(read));
    process.stdout.write(`adr-record: would write ${p.file}:\n${p.text.split("\n").slice(0, 8).map((l) => `  ${l}`).join("\n")}\n`);
    process.stdout.write("adr-record: dry run -- nothing written, no receipt\n");
    return;
  }

  // ONE WRITER AT A TIME ACROSS EVERY WORKTREE: the lock lives in git's COMMON directory, which all worktrees of this
  // repository share. Beside each checkout's spine, two worktrees took two locks and both issued one number under two
  // names (attack 1f95807 B4). The number is chosen again INSIDE the lock, and the file is created exclusively.
  const common = await git(async (read) => (await read(["rev-parse", "--path-format=absolute", "--git-common-dir"])).out.trim());
  if (!common || !isAbsolute(common)) die(2, "git named no common directory -- nothing written");
  const held = await withExclusiveLock(join(common, "arc-locks"), "adr-record", async () => {
    const p = await git((read) => plan(read));
    const target = join(REPO, p.file);
    // Written beside the target, then renamed in: a failed write never leaves a partial ADR in a tracked directory, and
    // "nothing written" is true of every refusal (B13).
    const tmp = join(REPO, ADR_DIR, `.adr-record.${process.pid}.tmp`);
    try { writeFileSync(tmp, p.text, { encoding: "utf8", flag: "wx" }); }
    catch (e) { try { unlinkSync(tmp); } catch { /* not made */ } die(2, `${p.file} could not be written (${e.code || "error"}) -- nothing written`); }
    if (existsSync(target)) { try { unlinkSync(tmp); } catch { /* gone */ } die(2, `${p.file} already exists -- nothing written`); }
    try { renameSync(tmp, target); }
    catch (e) { try { unlinkSync(tmp); } catch { /* gone */ } die(2, `${p.file} could not be written (${e.code || "error"}) -- nothing written`); }
    written = true;
    process.stdout.write(`adr-record: wrote ${p.file}\n`);
    // The scratch file is CONSUMED: a leftover was read by the next click and recorded again under its lane (B3).
    try { unlinkSync(scratch.real); } catch { /* the ADR stands */ }
    const got = emitReceipt(ARC_EVENT, "note.logged", p.payload, { cwd: REPO, timeoutMs: 60_000, flags });
    if (got.state === "unknown") die(1, `${p.file} IS written, and whether its receipt landed is unknown -- ${got.why}. Look at the spine before recording again`);
    if (got.state !== "landed" || !got.id) die(1, `${p.file} IS written, and its receipt did not land -- ${got.why}`);
    process.stdout.write(`receipt: note.logged ${got.id}\n`);
  });
  if (held.busy) die(2, "another ADR is being recorded -- nothing written; try again (a lock left by a killed run clears after ten minutes)");
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
      process.stderr.write(`adr-record: ${written ? "the ADR IS written, and then this failed" : "nothing was written"}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}\n`);
      process.exitCode = written ? 1 : 2;
    }
  }
}
