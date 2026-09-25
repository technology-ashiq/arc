#!/usr/bin/env node
/**
 * develop.mjs -- the deterministic core of `/arc-develop` (Phase 00 steel thread).
 *
 * arc commands are markdown prompt files; their verdicts and their file writes belong to
 * scripts, which is what makes them testable offline (ADR-0047: the runner owns the verdict
 * and the receipt). The markdown wrapper calls this.
 *
 * Modes: start | next | prove | status | checkpoint | handoff
 *
 * `next --dry-run` plans the advance -- the next slice and the Context Pack its `sources:` line would record -- and
 * writes nothing: no ledger write, no receipt. Its last line is the digest of that write ({"expect":...}). `next
 * --expect D` does the advance only if the digest still holds (PLAN_STALE otherwise), then writes a strict
 * `note.logged` receipt and prints its id. This is the face's "Open a slice" (face v2 Phase 05, ADR-1341 §1): the
 * harness's own ledger, written in place, on the owner's click, never another lane's file.
 *
 * Lane contract (.claude/rules/lanes.md, ADR-0054/0068): `--lane` is the ONLY way to name a
 * lane; the command's own arguments are never read as lanes. Resolution is IMPORTED from
 * core/lane-resolve.mjs, never re-implemented, and `--for develop` needs no resolver edit.
 * Root-mode prints no lane line at all -- that is a permanent consumer contract for venture
 * repos, not a migration shim.
 *
 * This script never COMMITS and never writes to the spine's exit code (ADR-0065). It does read
 * git -- `checkpoint` asks what changed, and the Context Pack asks what churns -- because a
 * check that cannot see the change cannot check it. Reading mutates nothing.
 *
 * Zero dependencies, Node 18+.
 */

import { createHash } from "node:crypto";
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { laneHeader, parseLaneArgs, renderHuman, resolveLane } from "../core/lane-resolve.mjs";
import { buildPack, renderPack, sourcesField } from "./context-pack.mjs";
import { PLACEHOLDER, PREDICTION_FIELDS, VERDICTS, isFilled, isProven, parseLedger, progress, renderLedger, scoreProblem, setSliceField } from "./ledger.mjs";
import { RISK_GLOBS } from "./quality.mjs";
import { scanSecrets, sizeScaledCap } from "../hq/lib/redact.mjs";
import { withGitReader } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt, withExclusiveLock } from "../core/plan-expect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_ROOT = resolve(HERE, "..", "..", "..");
const MODES = new Set(["start", "next", "prove", "status", "checkpoint", "handoff"]);
/** Every receipt this phase is responsible for, in lifecycle order. */
const EXPECTED_KINDS = ["develop.started", "slice.done", "handoff.ready"];

const out = [];
const say = (s = "") => out.push(s);
// Written SYNCHRONOUSLY, then the exit: a caller parses the receipt line, and process.exit right after an asynchronous
// pipe write can cut it (the fixed-defects row every face tool carries).
const flush = (code) => {
  // A reader that closed its end loses the lines, never the exit (PR 3b, the arc-event twin).
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost */ } }
  process.exit(code);
};
const die = (msg, code = 2) => { say(`STOP: ${msg}`); flush(code); };
/** A refusal raised INSIDE a lock: thrown, so the lock is released before the exit. */
class NextStop extends Error { constructor(code) { super("stop"); this.code = code; } }

const pad = (n) => String(n).padStart(2, "0");

// ---------------------------------------------------------------------------
// Receipts -- emitted through the existing spine, never a second implementation.
// A spine failure must never change this command's exit code: the receipt is audit
// telemetry, not the truth (design source §3 durable-truth table).
// ---------------------------------------------------------------------------
async function emit(kind, payload) {
  try {
    const { execFileSync } = await import("node:child_process");
    execFileSync(
      process.execPath,
      [join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs"), "emit", kind, "--payload", JSON.stringify(payload)],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    return true;
  } catch {
    return false;   // deliberate: see the comment above this function
  }
}

/** Which of this phase's receipt kinds have actually landed on the spine. */
async function landedKinds() {
  const seen = new Set();
  try {
    const { spineRoot, eventsDir } = await import("../hq/lib/spine-io.mjs");
    const dir = eventsDir(spineRoot());
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
        if (!line.trim()) continue;
        try { seen.add(JSON.parse(line).kind); } catch { /* a torn line is not a crash */ }
      }
    }
  } catch { /* no spine yet is a legitimate state, not an error */ }
  return seen;
}

// ---------------------------------------------------------------------------
// Derived Build Brief fields. Every one is a deterministic function of files on
// disk -- no judgement, no summarising (phase-00-spec.md).
// ---------------------------------------------------------------------------

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/**
 * Section body by heading name, at any heading level, to the next heading of any level.
 *
 * The terminator is `$(?![\s\S])` -- a real end-of-INPUT assertion -- and not a bare `$`.
 * Under /m, which `^` needs here, `$` means end of LINE, so a bare `$` makes the lazy body
 * match stop at the first newline and every section comes back empty. That exact mistake is
 * in the retro-log (2026-07-16, "`$` under /m as end-of-string") and it bit this function on
 * its first run.
 */
function sectionOf(md, name) {
  const re = new RegExp(`^[ \\t]*#{1,6}[ \\t]*${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n[ \\t]*#{1,6}[ \\t]+|$(?![\\s\\S]))`, "im");
  return (md.match(re) || [, ""])[1];
}

/** reqs: the REQ-NN tokens on the spec's `Serves` line, in order. */
function deriveReqs(spec) {
  const line = (spec.match(/^.*\bServes\b.*$/im) || [""])[0];
  return [...line.matchAll(/REQ-\d+/gi)].map((m) => m[0].toUpperCase());
}

/** adrs: EVERY ADR-NNNN token in the spec, deduped, sorted ascending. Run it, don't curate. */
function deriveAdrs(spec) {
  return [...new Set([...spec.matchAll(/ADR-(\d{4})/g)].map((m) => m[1]))].sort();
}

/**
 * no-gos: from the LANE'S PLAN.md `## No-gos` section -- the first **bold** span of each
 * bullet, trailing punctuation stripped. A bullet with no bold lead is a PLAN authoring
 * error and is recorded as `(unnamed)` rather than guessed at.
 */
function deriveNoGos(planMd) {
  const body = sectionOf(planMd, "No-gos");
  const items = [];
  for (const line of body.split("\n")) {
    if (!/^[ \t]*-[ \t]+/.test(line)) continue;
    const bold = line.match(/\*\*(.+?)\*\*/);
    items.push(bold ? bold[1].replace(/[.,;:]+$/, "").trim() : "(unnamed)");
  }
  return items;
}

/** non-negotiables: byte-for-byte from the SPEC's own gate-verified block, not from PLAN. */
function deriveNonNegotiables(spec) {
  const body = sectionOf(spec, "Non-negotiables");
  return body.split("\n").filter((l) => /^[ \t]*-[ \t]+/.test(l)).map((l) => l.replace(/^[ \t]*-[ \t]+/, "").trimEnd());
}

/**
 * blast-radius: a FILTER, never a transformation. Collect backtick-quoted path-like tokens,
 * keep those git knows or that sit under a directory git knows, emit them verbatim, deduped
 * and sorted. A surviving token is never collapsed to its parent directory.
 */
function deriveBlastRadius(spec, root) {
  const tokens = new Set();
  for (const m of spec.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim();
    if (!/[/.]/.test(t) || /\s/.test(t)) continue;      // not path-like
    if (/^-|^\$|^https?:/.test(t)) continue;            // flags, vars, URLs are not paths
    tokens.add(t.replace(/^\.\//, ""));
  }
  const known = [];
  let dropped = 0;
  for (const t of [...tokens].sort()) {
    const abs = join(root, t);
    if (existsSync(abs)) { known.push(t); continue; }
    // Survives if any ancestor directory exists -- a file this phase is about to create.
    let dir = dirname(abs), lives = false;
    while (dir.length > root.length) { if (existsSync(dir)) { lives = true; break; } dir = dirname(dir); }
    if (lives) known.push(t); else dropped++;
  }
  return { paths: known, dropped };
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

function ledgerPaths(tracker, n) {
  return {
    spec: join(tracker, "phases", `phase-${pad(n)}-spec.md`),
    tasks: join(tracker, "phases", `phase-${pad(n)}-tasks.md`),
  };
}

/** Read an existing ledger, or null. Parse errors are reported, never thrown. */
function readLedger(path) {
  if (!existsSync(path)) return null;
  return parseLedger(readFileSync(path, "utf8"));
}

async function modeStart(ctx, n) {
  const { spec: specPath, tasks } = ledgerPaths(ctx.tracker, n);
  if (!existsSync(specPath))
    die(`phase-${pad(n)}-spec.md not found at ${specPath} — /arc-develop builds an APPROVED phase, it does not invent one`);

  const existing = readLedger(tasks);
  if (existing && existing.slices.some(isProven)) {
    const proven = existing.slices.filter(isProven).map((s) => s.id).join(", ");
    die(
      `phase-${pad(n)}-tasks.md already holds proven slice(s) ${proven} — refusing to overwrite. ` +
      `Regenerating would orphan their commit SHAs from any ledger reference (ADR-0065).`,
      3,
    );
  }

  const specRaw = readFileSync(specPath);
  const spec = specRaw.toString("utf8");
  const planPath = join(ctx.tracker, "PLAN.md");
  const planMd = existsSync(planPath) ? readFileSync(planPath, "utf8") : "";

  const blast = deriveBlastRadius(spec, ctx.root);
  const title = (spec.match(/^#[ \t]+(.*\S)/m) || [, `phase ${pad(n)}`])[1].replace(/^Phase\s+\d+\s*[—-]\s*/i, "");

  const brief = {
    "spec-hash": `sha256:${sha256(specRaw)}`,
    lane: ctx.mode === "root" ? "(root-mode)" : ctx.lane,
    reqs: deriveReqs(spec).join(", "),
    adrs: deriveAdrs(spec).join(", "),
    "blast-radius": blast.paths.length ? blast.paths.join(", ") : "(none)",
    "no-gos": deriveNoGos(planMd).join(", "),
  };
  if (blast.dropped) brief["blast-radius-dropped"] = String(blast.dropped);

  // One slice per exit-criteria checkbox: the phase's own definition of done, decomposed.
  //
  // A checkbox wraps across lines in every real spec, so this walks the section and joins
  // each box's continuation lines instead of regex-matching one line at a time. The
  // single-line version silently truncated every title at the first newline ("exits 1 on
  // each of the three") -- found by running the harness against its own phase-01 spec.
  const boxes = [];
  for (const line of sectionOf(spec, "Exit criteria").split("\n")) {
    const open = line.match(/^[ \t]*-[ \t]*\[[ xX]\][ \t]*(.*)$/);
    if (open) { boxes.push(open[1].trim()); continue; }
    if (!boxes.length) continue;
    if (/^[ \t]*(-|\d+\.)[ \t]/.test(line) || !line.trim()) continue;  // next item, or a gap
    boxes[boxes.length - 1] += " " + line.trim();                       // continuation
  }
  const cleaned = boxes.map((b) => b.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (cleaned.length === 0) die(`${specPath} has no Exit criteria checkboxes — nothing to decompose into slices`);

  const slices = cleaned.map((text, i) => ({
    id: pad(i + 1),
    fields: {
      title: text.replace(/\s+/g, " ").trim(),
      kind: "logic",
      risk: i === 0 ? "high" : "medium",
      proof: PLACEHOLDER,
      tier: PLACEHOLDER,
      sources: `phase-${pad(n)}-spec.md`,
      decision: PLACEHOLDER,
      result: PLACEHOLDER,
      commit: PLACEHOLDER,
    },
  }));

  const predictions = Object.fromEntries(PREDICTION_FIELDS.map((k) => [k, PLACEHOLDER]));

  mkdirSync(dirname(tasks), { recursive: true });
  writeFileSync(tasks, renderLedger({
    phase: pad(n), title, brief,
    nonNegotiables: deriveNonNegotiables(spec),
    predictions, slices,
  }), "utf8");

  await emit("develop.started", { lane: ctx.mode === "root" ? null : ctx.lane, phase: pad(n), slices: slices.length });

  say(`Wrote ${tasks}`);
  say(`  ${slices.length} slices, 0 proven — declare each slice's proof BEFORE implementing it.`);
  if (blast.dropped) say(`  ${blast.dropped} path token(s) dropped from the blast radius (no known file or directory).`);
  say("");
  say("Next: /arc-develop next");
  flush(0);
}

/** Locate the current ledger without being told a phase number: the lowest unfinished one. */
function findLedger(tracker) {
  const dir = join(tracker, "phases");
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter((f) => /^phase-\d+-tasks\.md$/.test(f)).sort();
  if (!files.length) return null;
  for (const f of files) {
    const parsed = parseLedger(readFileSync(join(dir, f), "utf8"));
    if (parsed.slices.some((s) => !isProven(s))) return { file: f, path: join(dir, f), parsed };
  }
  const last = files[files.length - 1];
  return { file: last, path: join(dir, last), parsed: parseLedger(readFileSync(join(dir, last), "utf8")) };
}

/**
 * The lock's NAME for one ledger: its real path, as the filesystem compares it -- `e:\work_hub` and `E:\Work_Hub` are
 * one file on Windows and were two locks, so an apply ran beside a held one (PR 4 round-2 shell attack).
 * @param {string} ledgerReal
 */
function nextLockName(ledgerReal) {
  let real = ledgerReal;
  try { real = realpathSync.native(ledgerReal); } catch { /* the caller resolved it already */ }
  const key = process.platform === "win32" || process.platform === "darwin" ? real.toLowerCase() : real;
  return `arc-develop-next-${createHash("sha256").update(key).digest("hex").slice(0, 16)}.lock`;
}

/**
 * A temp file a killed apply left beside the ledger (`.phase-NN-tasks.md.<pid>.tmp`, PR 4 round-2 shell attack): swept
 * when it is older than ten minutes -- no live apply holds one that long.
 * @param {string} dir
 */
function sweepLeftTemps(dir) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    if (!/^\.phase-[0-9]{2,3}-tasks\.md\.[0-9]+\.tmp$/.test(n)) continue;
    try { if (Date.now() - statSync(join(dir, n)).mtimeMs > 10 * 60_000) unlinkSync(join(dir, n)); } catch { /* another sweeper */ }
  }
}

/**
 * Whether a slice.done for this slice is already on the spine: true, false, or null when a day could not be read. The
 * bound apply raises it only on a clear false, so a click never adds a second one to the room's count (PR 4 round-2
 * logic attack: three applies, three slice.done for one proven slice).
 * The COMMIT is part of the match: lanes reuse phase and slice numbers across cycles, and a slice re-proven at a new
 * commit raised nothing because an old cycle's slice.done matched (PR 4 round-3 logic attack).
 * @param {string | null} lane @param {string | null} phase @param {string} slice @param {string | null} commit
 */
async function sliceDoneLanded(lane, phase, slice, commit) {
  try {
    const { spineRoot, eventsDir } = await import("../hq/lib/spine-io.mjs");
    const dir = eventsDir(spineRoot());
    if (!existsSync(dir)) return false;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".jsonl")) continue;
      for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
        if (!line.includes("slice.done")) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        const p = e && e.payload;
        if (e.kind === "slice.done" && p && p.slice === slice && (p.lane ?? null) === lane && String(p.phase ?? "") === String(phase ?? "") && (p.commit ?? null) === (commit ?? null)) return true;
      }
    }
    return false;
  } catch { return null; }
}

/**
 * The fence every face write to a ledger crosses (next's plan/apply and prove): the ledger resolves inside the repo,
 * and it is the one the room shows. Returns the ledger's real path, or dies. One function, so a fix made for one verb
 * is made for both -- "validate one read, compare another" was closed in one file and left open in its twin.
 * @returns {string}
 */
function fenceLedger(ctx, led) {
  let ledgerReal;
  // FENCED: the ledger and its phases folder resolve inside the repo. A junction on phases/ sent the write to a file
  // outside it while the room's own reader refused that file (PR 4 shell attack).
  try { ledgerReal = realpathSync(led.path); } catch { die(`${led.file} cannot be resolved -- not read, not written`); }
  let top;
  try { top = realpathSync(ctx.root); } catch { die("the repository root cannot be resolved -- nothing was written"); }
  if (!ledgerReal.startsWith(top + sep)) die(`${led.file} resolves outside the repository -- not read, not written`);
  // The room reads the ledger its lane's header names; the verb must write that one (PR 4 shell attack: the room
  // showed phase 01 while next planned a write to phase 00).
  // And only where the room shows a slice at all -- a LIVE lane whose header names a numbered phase. The check ran only
  // for a numbered header, so a closed cycle ("08 (cycle closed)") had its merged ledger rewritten by one click the
  // room never showed (PR 4 round-2 logic attack).
  if (ctx.mode !== "root") {
    const header = laneHeader(join(ctx.tracker, "PROGRESS.md"));
    const hp = String(header.phase || "").trim();
    // EXACTLY as the room compares it: "live" was upper-cased here and passed, while /api/slices lists "LIVE" alone
    // and hid the lane (PR 4 round-3 logic attack).
    const st = String(header.status || "").trim();
    if (st !== "LIVE") die(`the ${ctx.lane} lane is ${st || "not LIVE"} -- the face's next slice runs only in a LIVE lane, the one the room shows; nothing was written`);
    if (!/^[0-9]{1,3}$/.test(hp)) die(`the ${ctx.lane} lane's header names no phase number (${JSON.stringify(hp)}) -- the room shows no slice for it, so this verb writes none`);
    if (led.file !== `phase-${hp.padStart(2, "0")}-tasks.md`)
      die(`the lane's header names phase ${hp}, and the lowest unfinished ledger is ${led.file} -- the room and this verb would read different ledgers; finish or fix ${led.file} first`);
  }
  return ledgerReal;
}

async function modeNext(ctx, bind = {}) {
  const led = findLedger(ctx.tracker);
  if (!led) die("no slice ledger found — run /arc-develop start <n> first");
  const { slices, errors } = led.parsed;
  for (const e of errors) say(`WARN  [ledger] ${led.file}:${e.line} — ${e.msg}`);
  // A bound run (the face's plan or apply) writes nothing and emits nothing until its digest is checked.
  const bound = bind.dryRun === true || bind.expect !== undefined;
  let ledgerReal = led.path;
  if (bound) ledgerReal = fenceLedger(ctx, led);
  const before = readFileSync(led.path, "utf8");
  const phase = (led.file.match(/phase-(\d+)-tasks/) || [, null])[1];

  // The advance step, and the ONLY mode that emits slice.done. It reads what the session
  // left behind and moves the marker; it never fills result:, never runs git (ADR-0065).
  const proven = slices.filter(isProven);
  if (proven.length && !bound) {
    const last = proven[proven.length - 1];
    // `phase` is carried because Phase 08's time-to-first-proven-slice pairs a
    // `develop.started` with the first `slice.done` OF THE SAME PHASE, and without it the
    // metric is not derivable at all — which is exactly what it reported on this repo the
    // first time it ran. The kind vocabulary is closed (ADR-0026); a payload field is not.
    // Receipts already on the spine lack it, so the metric becomes derivable forward and says
    // so rather than pretending to cover history it cannot see.
    await emit("slice.done", {
      lane: ctx.mode === "root" ? null : ctx.lane,
      phase: (led.file.match(/phase-(\d+)-tasks/) || [, null])[1],
      slice: last.id,
      tier: last.fields.tier ?? null,
      commit: last.fields.commit ?? null,
    });
  }

  // ADR-0103: the checkpoint runs INLINE at the slice boundary, not as a separate command a
  // human has to remember. The identical script runs either way, so a forced extra invocation
  // would buy ritual, not rigor — and ceremony cost per validated slice is one of this
  // product's own outcome metrics. `checkpoint` stays callable standalone.
  if (proven.length) {
    const cp = await modeCheckpoint(ctx, { inline: true });
    if (cp.tripped.length || cp.markers.length) say("");
  }

  const { proven: p, total, next } = progress(slices);
  if (!next) {
    // Wording is fixed by phase-00-spec.md and asserted by bats -- keep the literal
    // "all slices proven" substring if this line is ever reworded.
    say(`all slices proven (${total}/${total}) — run /arc-develop handoff.`);
    // A bound run has nothing to open, and says so as a refusal: a plan that would write nothing is not a plan.
    flush(bound ? 2 : 0);
  }
  say(`slice ${next.id} — ${next.fields.title ?? "(untitled)"}`);
  say(`  kind:  ${next.fields.kind ?? "?"}`);
  say(`  proof: ${next.fields.proof ?? "?"}`);
  say(`  tier:  ${next.fields.tier ?? "?"}`);
  say("");

  // The Context Pack (Phase 05, ADR-0111): what past work already knows about this slice,
  // handed over BEFORE the slice is built rather than remembered afterwards.
  //
  // A pack that cannot be assembled must not take `next` down with it -- the harness's job is
  // to hand out the next slice -- but it must not be silent either, because a retrieval that
  // quietly returns nothing is indistinguishable from a repo that knows nothing. So the
  // failure is printed and recorded, and the slice is still handed out.
  // Assembly and recording are separate failures and are reported separately. Wrapping both
  // in one `try` made a read-only ledger print a full, correct pack and then announce
  // "Context Pack — unavailable" underneath it: two contradictory statements in one run, exit
  // 0, and a `sources:` line silently left at its previous value.
  let pack = null;
  try {
    pack = buildPack({
      root: ctx.root,
      brief: led.parsed.brief,
      slice: next,
      lane: ctx.mode === "root" ? null : ctx.lane,
    });
    for (const line of renderPack(pack, next.id)) say(line);
    say("");
  } catch (e) {
    say(`Context Pack — could not be assembled: ${e?.message ?? e}`);
    say("");
  }
  // The ledger text the advance would write: the pack recorded on the next slice's sources: line.
  let after = before;
  let unrecorded = "";
  if (pack) {
    try {
      // `at:` binds the write to the block the READER handed out, by line. Binding by id alone
      // is what let a duplicate id send one slice's pack into another slice's audit trail.
      const { text, changed, reason } = setSliceField(
        before, next.id, "sources", sourcesField(next.fields.sources, pack), { at: next.line },
      );
      if (changed && text !== before) after = text;
      else if (!changed) unrecorded = reason;
    } catch (e) {
      unrecorded = e?.message ?? String(e);
    }
  }

  if (bound) {
    // A plan that would write nothing is not a plan: applied, it only emitted receipts -- and each click added one to
    // the room's "slices proven" (PR 4 logic attack).
    if (after === before) die(`nothing to record: ${led.file} would not change${unrecorded ? ` (the pack cannot be recorded -- ${unrecorded})` : " -- slice " + next.id + "'s sources already hold this pack"}`);
    // The receipt the apply raises, judged by the spine BEFORE anything is written: a slice id that reads as a key wrote
    // the ledger and then had its receipt refused (PR 4 logic attack; the pin and propose twins).
    const receipt = { note: "develop.next", lane: ctx.mode === "root" ? null : ctx.lane, phase, slice: next.id, recorded: true };
    const refused = spineRefusal(join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs"), "note.logged", receipt);
    if (refused) die(`the spine would refuse this apply's receipt, so nothing is written: ${refused}`);
    // The slice.done this apply may raise is judged too: a proven slice whose id read as a key had its receipt refused
    // with no trace after the ledger was written (PR 4 round-2 logic attack).
    const lastProven = proven.length ? proven[proven.length - 1] : null;
    const doneReceipt = lastProven ? { lane: ctx.mode === "root" ? null : ctx.lane, phase, slice: lastProven.id, tier: lastProven.fields.tier ?? null, commit: lastProven.fields.commit ?? null } : null;
    if (doneReceipt) {
      const doneRefused = spineRefusal(join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs"), "slice.done", doneReceipt);
      if (doneRefused) die(`the spine would refuse slice ${lastProven.id}'s slice.done, so nothing is written: ${doneRefused}`);
    }
    // The digest covers the ledger as read, the slice handed out and the exact text that would be written.
    const digest = planDigest({
      lane: ctx.mode === "root" ? null : ctx.lane, ledger: led.file, phase, slice: next.id,
      before: createHash("sha256").update(before).digest("hex"), after: createHash("sha256").update(after).digest("hex"),
    });
    if (bind.dryRun) {
      say(after !== before ? `would record the Context Pack on slice ${next.id}'s sources: line in ${led.file}` : `${led.file} would not change${unrecorded ? ` (the pack cannot be recorded -- ${unrecorded})` : ""}`);
      say("dry run -- no ledger write and no receipt");
      say(expectLine(digest));
      flush(0);
    }
    const stale = staleReason(bind.expect, digest);
    if (stale) die(stale);
    // ONE APPLY PER LEDGER, through the shared lock (core/plan-expect.mjs): the hand-rolled one broke a stale lock in
    // three steps and let two applies in (PR 4 round-2 shell attack). A lock left by a killed apply clears after ten
    // minutes. A refusal inside is THROWN: die() exits the process, and an exit skips the lock's release.
    const stop = (msg, code = 2) => { say(`STOP: ${msg}`); throw new NextStop(code); };
    let entered = false;
    const applyNext = async () => {
    entered = true;
    sweepLeftTemps(dirname(ledgerReal));
    // Whether slice.done is due is decided BEFORE the write: a day the spine could not read made the look answer
    // "unknown", and the apply wrote the ledger and dropped the receipt without a word (PR 4 round-3 shell attack).
    const doneDue = doneReceipt ? await sliceDoneLanded(doneReceipt.lane, phase, doneReceipt.slice, doneReceipt.commit) : true;
    if (doneDue === null) stop(`a day file of the spine cannot be read, so whether slice ${doneReceipt.slice}'s slice.done is already recorded is unknown -- nothing was written`);
    // RE-READ, THEN AN ATOMIC WRITE. The digest was checked against the ledger as read seconds earlier; the build
    // session edits this file, and an edit landing while the pack was built was silently written over (PR 4 attacks).
    let now;
    try { now = readFileSync(led.path, "utf8"); } catch (e) { stop(`${led.file} could not be read again (${e && e.code ? e.code : "error"}) -- nothing was written`); }
    if (now !== before) stop(`PLAN_STALE -- ${led.file} changed while this apply ran (the session edited it); nothing was written, plan again`);
    const tmp = join(dirname(ledgerReal), `.${led.file}.${process.pid}.tmp`);
    try { writeFileSync(tmp, after, { encoding: "utf8", flag: "wx" }); renameSync(tmp, ledgerReal); }
    catch (e) {
      try { unlinkSync(tmp); } catch { /* not made */ }
      // Nothing was written: exit 2, by name -- an uncaught EPERM was exit 1, "the ledger IS written" (PR 4 attacks).
      stop(`${led.file} could not be written (${e && e.code ? e.code : "error"}) -- nothing was written`);
    }
    if (unrecorded) say(`WARN  [sources] the pack above was NOT recorded — ${unrecorded}`);
    // The slice.done the unbound run emits, for the last proven slice -- ONCE per slice: raised only when the spine
    // clearly holds none for it -- then the op's OWN receipt, strict, its id printed.
    if (doneReceipt && doneDue === false) await emit("slice.done", doneReceipt);
    const rec = await emitNoteReceipt(receipt);
    say(`Progress: ${p}/${total} proven.`);
    if (rec.state === "unknown") { say(`STOP: ${led.file} IS written, and whether its receipt landed is unknown -- ${rec.why}. Look at the spine before applying again`); throw new NextStop(1); }
    if (!rec.id) { say(`STOP: ${led.file} IS written, and its receipt ${rec.state === "landed" ? "landed without its id" : "was not raised"} -- ${rec.why}`); throw new NextStop(1); }
    say(`receipt: note.logged ${rec.id}`);
    };
    let held;
    // Beside the SPINE, as every sibling tool's: under TEMP, two applies with different TEMP values took two locks and
    // both wrote (PR 4 round-3 attacks).
    let lockDir;
    try { const { spineRoot } = await import("../hq/lib/spine-io.mjs"); lockDir = join(spineRoot(), "locks"); }
    catch (e) { die(`the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
    try { held = await withExclusiveLock(lockDir, nextLockName(ledgerReal), applyNext); }
    catch (e) {
      if (e instanceof NextStop) flush(e.code);
      // Only the TAKE is the lock's: a fault inside the apply keeps its own cause.
      if (entered) throw e;
      die(`the apply's lock could not be taken -- ${e && e.message ? e.message : "error"}; nothing was written`);
    }
    if (held.busy) die("another apply of this lane's next slice is running -- nothing was written; wait for it and plan again (a lock left by a killed apply clears after ten minutes)");
    flush(0);
  }

  if (after !== before) {
    try { writeFileSync(led.path, after, "utf8"); }
    catch (e) {
      say(`WARN  [sources] the pack above was NOT recorded — ${e?.message ?? e}`);
      say(`      ${led.file}'s sources: line still holds its previous value.`);
    }
  } else if (unrecorded) say(`WARN  [sources] the pack above was NOT recorded — ${unrecorded}`);

  say(`Progress: ${p}/${total} proven.`);
  flush(0);
}

/**
 * PROVE (face v2 Phase 06, the develop room's "Prove a slice" session verb): write the next unproven slice's `result:`
 * and `commit:` from a session's scratch file, then its slice.done -- tagged with the session's process so arc-run can
 * vouch for it, its id printed. The session holds no Edit on the ledger: this is its one writer, through the same fence,
 * lock and atomic write as next's apply. The commit must already be merged (an ancestor of HEAD); an unmerged SHA is
 * a claim, not a proof. It never runs a test: "tests green" means green on CI, and the result names that evidence.
 * @param {{ resultFile: string, commit: string, asProcess: string, dryRun: boolean }} opts
 */
async function modeProve(ctx, phaseNum, opts) {
  if (phaseNum === null) die("prove needs the phase the room shows: prove <n> --result-file PATH --commit SHA");
  const led = findLedger(ctx.tracker);
  if (!led) die("no slice ledger found — run /arc-develop start <n> first");
  const ledgerReal = fenceLedger(ctx, led);
  const phase = (led.file.match(/phase-(\d+)-tasks/) || [, null])[1];
  if (phase === null || Number(phase) !== phaseNum) die(`the ledger the room shows is ${led.file}, not phase ${pad(phaseNum)} -- nothing was written`);
  const before = readFileSync(led.path, "utf8");
  const parsed = parseLedger(before);
  const { proven: p0, total, next } = progress(parsed.slices);
  if (!next) die(`all slices in ${led.file} are proven (${total}/${total}) -- nothing to prove`);

  const scratch = readProofResult(ctx.root, opts.resultFile);
  const result = scratch.text;
  let hit = null;
  try { const v = scanSecrets(result, { result }, { maxCandidates: sizeScaledCap(result) }); if (v.hit) hit = v.rule; } catch { hit = "unscannable"; }
  if (hit) die(`the result matches the secret rule ${hit} -- the ledger is tracked in a public repo, so nothing was written`);
  const commit = await mergedCommit(ctx.root, opts.commit);

  // Both fields bound to the block the READER handed out, by line: the heading does not move when a field is written.
  let after = before;
  for (const [key, value] of [["result", result], ["commit", commit]]) {
    const w = setSliceField(after, next.id, key, value, { at: next.line });
    if (!w.changed) die(`slice ${next.id}'s ${key}: line cannot be written -- ${w.reason}`);
    after = w.text;
  }
  // The write must prove exactly this slice and nothing else: read back, one more proven, and it is this one.
  const re = parseLedger(after);
  const mine = re.slices.find((s) => s.line === next.line);
  if (!mine || mine.id !== next.id || !isProven(mine) || progress(re.slices).proven !== p0 + 1)
    die(`the written ledger does not read back as slice ${next.id} proven -- nothing was written`);

  const lane = ctx.mode === "root" ? null : ctx.lane;
  const doneReceipt = { lane, phase, slice: next.id, tier: next.fields.tier ?? null, commit };
  const flags = opts.asProcess ? ["--process", opts.asProcess] : [];
  const arcEvent = join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs");
  const refused = spineRefusal(arcEvent, "slice.done", doneReceipt, { cwd: ctx.root, flags });
  if (refused) die(`the spine would refuse slice ${next.id}'s slice.done, so nothing was written: ${refused}`);

  if (opts.dryRun) {
    say(`would prove slice ${next.id} — ${next.fields.title ?? "(untitled)"} in ${led.file}`);
    say(`  result: ${result.length > 160 ? `${result.slice(0, 157)}...` : result}`);
    say(`  commit: ${commit}`);
    say("dry run -- no ledger write and no receipt");
    flush(0);
  }

  const stop = (msg, code = 2) => { say(`STOP: ${msg}`); throw new NextStop(code); };
  let entered = false;
  let lockDir;
  try { const { spineRoot } = await import("../hq/lib/spine-io.mjs"); lockDir = join(spineRoot(), "locks"); }
  catch (e) { die(`the spine cannot be found (${e && e.code ? e.code : "error"}) -- nothing was written`); }
  let held;
  try {
    // next's lock, by the ledger's real path: a prove and a next apply never write one ledger at once.
    held = await withExclusiveLock(lockDir, nextLockName(ledgerReal), async () => {
      entered = true;
      sweepLeftTemps(dirname(ledgerReal));
      const due = await sliceDoneLanded(lane, phase, next.id, commit);
      if (due === null) stop(`a day file of the spine cannot be read, so whether slice ${next.id}'s slice.done is already recorded is unknown -- nothing was written`);
      if (due === true) stop(`slice ${next.id} at ${commit} already has its slice.done on the spine -- nothing was written`);
      let now;
      try { now = readFileSync(led.path, "utf8"); } catch (e) { stop(`${led.file} could not be read again (${e && e.code ? e.code : "error"}) -- nothing was written`); }
      if (now !== before) stop(`PLAN_STALE -- ${led.file} changed while this prove ran; nothing was written, run it again`);
      const tmp = join(dirname(ledgerReal), `.${led.file}.${process.pid}.tmp`);
      try { writeFileSync(tmp, after, { encoding: "utf8", flag: "wx" }); renameSync(tmp, ledgerReal); }
      catch (e) {
        try { unlinkSync(tmp); } catch { /* not made */ }
        stop(`${led.file} could not be written (${e && e.code ? e.code : "error"}) -- nothing was written`);
      }
      // The result file is CONSUMED: a leftover was read by the next click and stamped on the next slice (B3).
      try { unlinkSync(scratch.real); } catch { /* the proof stands */ }
      say(`proved slice ${next.id} in ${led.file} at ${commit}`);
      say(`Progress: ${p0 + 1}/${total} proven.`);
      const rec = emitReceipt(arcEvent, "slice.done", doneReceipt, { cwd: ctx.root, timeoutMs: 60_000, flags });
      if (rec.state === "unknown") stop(`${led.file} IS written, and whether its slice.done landed is unknown -- ${rec.why}. Look at the spine before proving again`, 1);
      if (!rec.id) stop(`${led.file} IS written, and its slice.done ${rec.state === "landed" ? "landed without its id" : "was not raised"} -- ${rec.why}`, 1);
      say(`receipt: slice.done ${rec.id}`);
    });
  } catch (e) {
    if (e instanceof NextStop) flush(e.code);
    if (entered) throw e;
    die(`the prove's lock could not be taken -- ${e && e.message ? e.message : "error"}; nothing was written`);
  }
  if (held.busy) die("another write to this lane's ledger is running -- nothing was written; wait for it and prove again (a lock left by a killed run clears after ten minutes)");
  flush(0);
}

const PROOF_SCRATCH = [".claude", "state", "develop-proof"];
const RESULT_CAP = 1500;

/** The session's result line: directly under .claude/state/develop-proof/, a plain file, one line, capped. */
function readProofResult(root, path) {
  if (!path) die("prove needs --result-file PATH (the result line, written under .claude/state/develop-proof/)");
  // A drive-absolute, UNC or device path is refused before anything resolves it: path.relative across two drives
  // returns the target itself, which no `..` check sees (lesson-log and rule-propose's twin, attack 3e97a85 B1).
  if (isAbsolute(path) || /^[\\/]{2}/.test(path) || /^[A-Za-z]:/.test(path)) die("--result-file is a path inside the repo, not an absolute, drive or UNC path");
  let dir, real;
  try { dir = realpathSync.native(join(root, ...PROOF_SCRATCH)); } catch { die("this clone has no .claude/state/develop-proof directory -- write the result there first"); }
  try { real = realpathSync.native(resolve(root, path)); } catch (e) { die(`--result-file cannot be resolved (${e.code || "error"})`); }
  // The scratch directory itself resolves inside the repo: a junction on .claude/state sent the read elsewhere (attack
  // 1f95807 B12). A `:` names an NTFS alternate stream, content no listing of the directory shows (B11).
  let top;
  try { top = realpathSync.native(root); } catch { die("the repository root cannot be resolved"); }
  if (!dir.startsWith(top + sep)) die(".claude/state/develop-proof resolves outside the repository");
  const rel = relative(dir, real);
  if (!rel || isAbsolute(rel) || rel.startsWith("..") || rel.includes("/") || rel.includes("\\") || rel.includes(":")) die("--result-file must sit directly in .claude/state/develop-proof/");
  let fd, text;
  try {
    // lstat BEFORE open: a FIFO blocks open() for ever waiting for a writer.
    if (!lstatSync(real).isFile()) die("--result-file is not a plain file");
    fd = openSync(real, "r");
    const st = fstatSync(fd);
    if (!st.isFile()) die("--result-file is not a plain file");
    if (st.size > RESULT_CAP * 4) die(`--result-file is ${st.size} bytes -- a result is one line of at most ${RESULT_CAP} characters`);
    const buf = Buffer.alloc(RESULT_CAP * 4 + 1);
    const n = readSync(fd, buf, 0, buf.length, 0);
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(0, n)); } catch { die("--result-file is not valid UTF-8"); }
  } finally { if (fd !== undefined) try { closeSync(fd); } catch { /* closed */ } }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  text = text.replace(/\r?\n$/, "");
  if (/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(text)) die("the result holds a control, format or line-break character -- it is ONE line");
  if (text !== text.trim() || text.length < 20 || text.length > RESULT_CAP) die(`the result is one line of 20 to ${RESULT_CAP} characters, not padded`);
  if (text.includes(PLACEHOLDER) || !isFilled(text)) die("the result is still a placeholder -- name the evidence that proved the slice");
  return { text, real };
}

/**
 * The commit, resolved and MERGED: an ancestor of origin/main, the mainline CI ran on -- never of whatever HEAD this
 * clone has checked out, where a WIP commit on a feature branch passed as "merged" and a stale local main refused a
 * real merge (attack 1f95807 B8). It must be the commit the caller named (B10). Through the one bounded git reader (B9).
 * Returned as its 8-character short form, and the ref it was checked against.
 */
async function mergedCommit(root, given) {
  if (!/^[0-9a-f]{7,40}$/.test(given || "")) die("prove needs --commit SHA: 7 to 40 lowercase hex characters");
  let answer;
  try {
    answer = await withGitReader(root, async (read) => {
      const main = await read(["rev-parse", "--verify", "--quiet", "refs/remotes/origin/main^{commit}"], { ok: [0, 1] });
      if (main.status !== 0) return { why: "this clone has no origin/main -- fetch it; a proof is checked against the mainline" };
      const full = await read(["rev-parse", "--verify", "--quiet", `${given}^{commit}`], { ok: [0, 1] });
      const sha = full.status === 0 ? full.out.trim() : "";
      if (!/^[0-9a-f]{40,64}$/.test(sha) || !sha.startsWith(given)) return { why: `${given} is not a commit this clone holds -- nothing was written` };
      const anc = await read(["merge-base", "--is-ancestor", sha, main.out.trim()], { ok: [0, 1] });
      if (anc.status === 1) return { why: `${given} is not merged (not an ancestor of origin/main) -- an unmerged commit is a claim, not a proof` };
      return { sha };
    });
  } catch (e) { die(`git could not answer whether ${given} is merged (${e && e.message ? e.message : "error"}) -- nothing was written`); }
  if (answer.why) die(answer.why);
  return answer.sha.slice(0, 8);
}

async function modeStatus(ctx) {
  const led = findLedger(ctx.tracker);
  if (!led) {
    say("No slice ledger yet — run /arc-develop start <n>.");
    flush(0);
  }
  const { slices, errors } = led.parsed;
  const { proven, total, next } = progress(slices);
  const phase = (led.file.match(/phase-(\d+)-tasks/) || [, "??"])[1];

  const lanePart = ctx.mode === "root" ? "" : ` · ${ctx.lane}`;
  say(`develop${lanePart} · phase ${phase} · slice ${proven}/${total}`);
  say(next ? `Next unproven slice: ${next.id} — ${next.fields.title ?? "(untitled)"}` : "All slices proven — run handoff.");

  const landed = await landedKinds();
  const seen = EXPECTED_KINDS.filter((k) => landed.has(k));
  const missing = EXPECTED_KINDS.filter((k) => !landed.has(k));
  say(`Receipts seen: ${seen.length ? seen.slice(-3).join(", ") : "(none)"}`);
  // Never report position as though a receipt landed when it did not: a silent gap is how
  // 100 lost receipts read as "working as designed" for four days (retro-log 2026-07-28).
  if (missing.length) say(`Receipts missing: ${missing.join(", ")}`);
  for (const e of errors) say(`WARN  [ledger] ${led.file}:${e.line} — ${e.msg}`);
  flush(0);
}

async function modeHandoff(ctx, n) {
  const led = n === null ? findLedger(ctx.tracker) : (() => {
    const { tasks } = ledgerPaths(ctx.tracker, n);
    return existsSync(tasks) ? { file: `phase-${pad(n)}-tasks.md`, path: tasks, parsed: parseLedger(readFileSync(tasks, "utf8")) } : null;
  })();
  if (!led) die("no slice ledger found — nothing to hand off");

  const { slices, brief, scores } = led.parsed;
  const { proven, total } = progress(slices);

  // Predictions are scored HERE or the handoff does not happen. This is where confidence
  // comes from in this product: a record of what was predicted and what actually occurred,
  // accumulated over phases -- never a number the model asserts about itself. A prediction
  // block that is written and never scored is decoration, and decoration is how "we had a
  // retro" became a substitute for a record.
  const problems = new Map();
  for (const k of PREDICTION_FIELDS) {
    const p = scoreProblem(scores[k]);
    if (p) problems.set(k, p);
  }
  const REASON = {
    missing: "not scored",
    "bad-verdict": `verdict must be one of ${VERDICTS.join(" | ")}`,
    "no-reference": "verdict with no settling reference — say what settles it",
    "self-declared-number": "carries a number asserted about its own quality",
  };

  if (problems.size) {
    say(`Handoff refused — ${problems.size} of ${PREDICTION_FIELDS.length} predictions are not scored.`);
    for (const [k, p] of problems) say(`  ${k}: ${REASON[p]}`);
    say("");
    say("Score each one against what actually happened, then rerun. Add to the ledger:");
    say("");
    say("### Prediction scores");
    say("");
    for (const k of PREDICTION_FIELDS) {
      const predicted = brief[k] ? ` (predicted: ${brief[k]})` : "";
      say(!problems.has(k)
        ? `${k}: ${scores[k]}`
        : `${k}: hit|miss|unforeseen — <the ledger line or commit that settles it>${predicted}`);
    }
    say("");
    say(`A verdict is one of: ${VERDICTS.join(" | ")}. \`unforeseen\` is not a synonym for \`miss\` —`);
    say("a miss is a prediction that was wrong; unforeseen is what nobody predicted at all.");
    flush(4);
  }

  await emit("handoff.ready", { lane: ctx.mode === "root" ? null : ctx.lane, proven, total });

  const tally = VERDICTS.map((v) => `${PREDICTION_FIELDS.filter((k) => scores[k].trim().toLowerCase().startsWith(v)).length} ${v}`).join(" · ");
  say(`Handoff pack — ${proven}/${total} slices proven`);
  say(`Prediction calibration — ${tally}`);
  for (const k of PREDICTION_FIELDS) say(`  ${k}: ${scores[k]}`);
  say("");
  for (const s of slices) {
    say(`  ${isProven(s) ? "✓" : "·"} slice ${s.id}  tier=${s.fields.tier ?? "?"}  ${s.fields.title ?? ""}`);
  }
  say("");
  // The evidence pack is a FILE, not a printout. A fidelity pass found this half of the
  // exit criterion absent: handoff printed a pack and assembled nothing, so there was
  // nothing for /arc-phase-done to read and nothing left behind after the terminal scrolled.
  const phaseNo = (led.file.match(/phase-(\d+)-tasks/) || [, pad(n ?? 0)])[1];
  const evDir = ctx.mode === "root"
    ? join(ctx.root, "docs", "evidence", `phase-${phaseNo}`)
    : join(ctx.tracker, "evidence", `phase-${phaseNo}`);
  const pack = [
    `# Handoff pack — phase ${phaseNo}${ctx.mode === "root" ? "" : ` · lane ${ctx.lane}`}`,
    "",
    `${proven}/${total} slices proven.`,
    "",
    "## Prediction calibration",
    "",
    `${tally}`,
    "",
    ...PREDICTION_FIELDS.map((k) => `- **${k}** — ${scores[k]}`),
    "",
    "## Proofs",
    "",
    "| slice | tier | proof | commit |",
    "|---|---|---|---|",
    ...slices.map((s) => `| ${s.id} | ${s.fields.tier ?? "?"} | ${(s.fields.proof ?? "?").replace(/\|/g, "\\|")} | ${s.fields.commit ?? "?"} |`),
    "",
    "## Spec-fidelity",
    "",
    "Run the `spec-fidelity` agent over this phase's spec and diff, and paste its report",
    "below. It reads ONLY those two files — never this pack, never the ledger — because the",
    "session that wrote the code cannot see its own blind spots.",
    "",
    "<!-- paste the fidelity report here; the verdict line is the last line of its output -->",
    "",
  ].join("\n");
  mkdirSync(evDir, { recursive: true });
  writeFileSync(join(evDir, "handoff.md"), pack, "utf8");
  say(`Evidence pack written: ${join(evDir, "handoff.md").replace(ctx.root, "").replace(/^[\\/]/, "")}`);
  say("");

  say(proven === total
    ? "Ready for /arc-phase-done — develop never closes a phase."
    : `NOT ready: ${total - proven} slice(s) still unproven.`);
  flush(0);
}

// ---------------------------------------------------------------------------
// Checkpoint (Phase 03) -- risk is PATH-MATCHED by script, never self-assessed.
//
// The judgement "is this slice risky?" is exactly the judgement a model under time pressure
// gets wrong, and always in the same direction. So the trigger is a glob list, and the only
// question the script asks is which paths the change touched.
// ---------------------------------------------------------------------------

// The risk classes now live in quality.mjs, which is the ONE place they are declared. Phase 07
// needs the identical list to decide which slices owe approach sketches, and the debt ledger
// already records what two copies of "risky paths" do: a glob added to one never reaches the
// other. Imported at the top of this file.

/** Debt markers. A new one with no ledger row is a shortcut nobody will remember taking. */
const MARKER_RE = /\b(TODO|FIXME|HACK|XXX)\b/;

/**
 * Files changed since a reference. This READS git; it never writes through it. ADR-0102's
 * rule is that the harness does not COMMIT on your behalf — asking git what changed is the
 * only way a checkpoint can know what to check, and it mutates nothing.
 */
async function changedFiles(root, since) {
  try {
    const { execFileSync } = await import("node:child_process");
    const args = since ? ["diff", "--name-only", since] : ["diff", "--name-only", "HEAD"];
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").map((s) => s.trim()).filter(Boolean);
  } catch { return []; }
}

async function modeCheckpoint(ctx, opts = {}) {
  const files = opts.files ?? await changedFiles(ctx.root, opts.since);
  if (!files.length) {
    say("checkpoint: no changed files to check.");
    if (!opts.inline) flush(0);
    return { tripped: [], markers: [], files: 0 };
  }

  const tripped = RISK_GLOBS
    .map((g) => ({ name: g.name, hits: files.filter((f) => g.re.test(f)) }))
    .filter((g) => g.hits.length);

  // Marker scan: a new TODO/FIXME/HACK/XXX must have a debt-ledger row, or the shortcut is
  // forgotten forever. WARN-only — the ledger is Phase 03's newest artifact and blocking on
  // it before it has been used once would be a gate promoted on nothing.
  const debtPath = ctx.mode === "root" ? join(ctx.root, "docs", "develop", "debt-ledger.md")
                                       : join(ctx.tracker, "debt-ledger.md");
  const debt = existsSync(debtPath) ? readFileSync(debtPath, "utf8") : "";
  const markers = [];
  for (const f of files) {
    const abs = join(ctx.root, f);
    if (!existsSync(abs)) continue;
    let text = "";
    try { text = readFileSync(abs, "utf8"); } catch { continue; }
    text.split("\n").forEach((l, i) => {
      if (MARKER_RE.test(l) && !debt.includes(f)) markers.push({ file: f, line: i + 1 });
    });
  }

  say(`checkpoint: ${files.length} changed file(s)`);
  if (tripped.length) {
    for (const g of tripped) say(`  RISK  ${g.name} — ${g.hits.slice(0, 4).join(", ")}${g.hits.length > 4 ? ` (+${g.hits.length - 4})` : ""}`);
    say("");
    say("  Risk-triggered checkpoint. Before the next slice: is the change confined to what the");
    say("  slice declared, and does its proof actually exercise the risky path?");
  } else {
    say("  no risk globs tripped");
  }
  for (const m of markers.slice(0, 8)) {
    say(`  WARN  [debt-marker] ${m.file}:${m.line} — new marker with no row in ${debtPath.replace(ctx.root, "").replace(/^[\\/]/, "")} [trial]`);
  }
  if (!opts.inline) flush(0);
  return { tripped, markers, files: files.length };
}

/**
 * The checkpoint's OWN receipt (`checkpoint --receipt`, face v2 Phase 05, ADR-1339). Unlike emit() above, a failure
 * here IS the command's failure: the receipt is what was asked for, so a refused or lost one exits non-zero and says
 * why, and the ULID the spine assigned is printed so the caller can read it back.
 * @returns {Promise<{ id: string | null, why: string | null }>}
 */
async function emitCheckpointReceipt(ctx, cp) {
  return emitNoteReceipt({
    note: "develop.checkpoint",
    lane: ctx.mode === "root" ? null : ctx.lane,
    files: cp.files,
    tripped: cp.tripped.map((g) => g.name),
    markers: cp.markers.length,
  });
}

/**
 * A strict note.logged: its failure is the command's failure, and the id the spine assigned is returned. Through the
 * shared emit (core/plan-expect.mjs): a payload file, and three outcomes -- an unknown one (REJECT INTERNAL, a lost id
 * line) was read as "not raised", the twin of the PR 3b round-4 row.
 * @returns {Promise<{ state: "landed" | "refused" | "unknown", id: string | null, why: string | null }>}
 */
async function emitNoteReceipt(payload) {
  return emitReceipt(join(ARC_ROOT, ".claude", "scripts", "hq", "arc-event.mjs"), "note.logged", payload);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

// `--receipt` is taken out before the lane parser sees argv: that parser reads every unknown token as a positional,
// so left in, it would be read as a phase argument -- the swallowed-flag hazard the Phase 05 probe named.
const rawArgv = process.argv.slice(2);
if (rawArgv.some((a) => a.startsWith("--receipt="))) { say("STOP: --receipt takes no value"); flush(2); }
const wantsReceipt = rawArgv.includes("--receipt");
// --dry-run and --expect are taken out the same way, for the same reason; each given once.
if (rawArgv.some((a) => a.startsWith("--dry-run=") || a.startsWith("--expect="))) { say("STOP: write --dry-run bare and --expect <digest>, never with ="); flush(2); }
const dryRun = rawArgv.includes("--dry-run");
const expectAt = rawArgv.indexOf("--expect");
if (rawArgv.filter((a) => a === "--dry-run").length > 1 || rawArgv.filter((a) => a === "--expect").length > 1) { say("STOP: --dry-run and --expect are each given once"); flush(2); }
const expectValue = expectAt === -1 ? undefined : rawArgv[expectAt + 1];
if (expectAt !== -1 && (expectValue === undefined || expectValue.startsWith("-"))) { say("STOP: --expect needs the digest a plan printed"); flush(2); }
// prove's three valued flags, taken out the same way: each once, each with a value that is not itself a flag.
const PROVE_FLAGS = ["--result-file", "--commit", "--as-process"];
if (rawArgv.some((a) => PROVE_FLAGS.some((f) => a.startsWith(`${f}=`)))) { say("STOP: write --result-file, --commit and --as-process with a space, never with ="); flush(2); }
const proveAt = {};
for (const f of PROVE_FLAGS) {
  if (rawArgv.filter((a) => a === f).length > 1) { say(`STOP: ${f} is given once`); flush(2); }
  const at = rawArgv.indexOf(f);
  if (at === -1) continue;
  const v = rawArgv[at + 1];
  if (v === undefined || v === "" || v.startsWith("-")) { say(`STOP: ${f} needs a value`); flush(2); }
  proveAt[f] = at;
}
const proveValue = (f) => (proveAt[f] === undefined ? "" : rawArgv[proveAt[f] + 1]);
const provePositions = new Set(Object.values(proveAt).flatMap((at) => [at, at + 1]));
if (proveValue("--as-process") && !/^[a-z][a-z0-9-]{0,63}@[0-9]+\.[0-9]+\.[0-9]+$/.test(proveValue("--as-process"))) { say("STOP: --as-process is <process>@<major.minor.patch>"); flush(2); }
const argv = rawArgv.filter((a, i) => a !== "--receipt" && a !== "--dry-run" && !(expectAt !== -1 && (i === expectAt || i === expectAt + 1)) && !provePositions.has(i));
const { lane, laneGiven, laneDup, root: rootArg, positionals } = parseLaneArgs(argv);
// EVERY other dash-word is refused, never read as a positional: `start 5 --dry-run` used to write the ledger for real,
// because the lane parser keeps an unknown flag as a positional and nothing read it (the Phase 05 CLI probe's hazard).
const strayFlag = positionals.find((p) => /^[-\u2010-\u2015\u2212]/.test(p));
if (strayFlag) { say(`STOP: unknown flag ${JSON.stringify(strayFlag)} -- develop takes --lane --root --receipt (checkpoint) --dry-run and --expect (next) --result-file --commit --as-process and --dry-run (prove)`); flush(2); }

const mode = positionals[0];
if (!mode || !MODES.has(mode)) {
  say(`usage: develop.mjs <${[...MODES].join("|")}> [phase] [--lane NAME] [--root PATH] [--receipt (checkpoint only)]`);
  flush(mode ? 2 : 0);
}
if (wantsReceipt && mode !== "checkpoint") { say("STOP: --receipt belongs to checkpoint -- the other modes write their own receipts"); flush(2); }
if (expectAt !== -1 && mode !== "next") { say("STOP: --expect belongs to next -- the face's apply of opening a slice"); flush(2); }
if (dryRun && mode !== "next" && mode !== "prove") { say("STOP: --dry-run belongs to next and prove"); flush(2); }
if (Object.keys(proveAt).length && mode !== "prove") { say("STOP: --result-file, --commit and --as-process belong to prove"); flush(2); }
// prove writes the ledger of the repository it runs in, never one --root names: a session steered by what it read
// pointed the one writer at another clone (attack 1f95807 B2).
if (mode === "prove" && rootArg) { say("STOP: prove takes no --root -- it proves a slice of the repository it runs in"); flush(2); }
if (dryRun && expectAt !== -1) { say("STOP: --dry-run plans and --expect applies; give one"); flush(2); }

let root = rootArg;
if (!root) {
  try {
    const { execFileSync } = await import("node:child_process");
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { root = ""; }
  if (!root) root = process.cwd();
}
root = resolve(root);

const r = resolveLane({ root, lane, laneGiven, laneDup, surface: "develop" });
if (r.code !== 0) {
  // Non-zero resolver exit: print exactly what it printed and stop. Never improvise a lane.
  for (const l of renderHuman(r)) say(l);
  flush(r.code);
}
// Lane echo FIRST in lane-mode, before anything else. Root-mode prints no lane line at all.
if (r.mode === "lane") { say(`Selected lane: ${r.lane} (via ${r.via})`); say(""); }

const ctx = { root, mode: r.mode, lane: r.lane, tracker: r.mode === "root" ? root : join(root, r.tracker) };

const phaseArg = positionals[1];
const phaseNum = phaseArg === undefined ? null : Number(phaseArg);
if (phaseArg !== undefined && !Number.isInteger(phaseNum)) die(`'${phaseArg}' is not a phase number`);

if (mode === "start") {
  if (phaseNum === null) die("start needs a phase number: /arc-develop start <n>");
  await modeStart(ctx, phaseNum);
} else if (mode === "next") {
  await modeNext(ctx, { dryRun, expect: expectValue });
} else if (mode === "prove") {
  await modeProve(ctx, phaseNum, { resultFile: proveValue("--result-file"), commit: proveValue("--commit"), asProcess: proveValue("--as-process"), dryRun });
} else if (mode === "status") {
  await modeStatus(ctx);
} else if (mode === "handoff") {
  await modeHandoff(ctx, phaseNum);
} else if (wantsReceipt) {
  const cp = await modeCheckpoint(ctx, { inline: true });
  const r2 = await emitCheckpointReceipt(ctx, cp);
  if (!r2.id) { say(`STOP: the checkpoint receipt was not written -- ${r2.why}`); flush(1); }
  say(`receipt: note.logged ${r2.id}`);
  flush(0);
} else {
  await modeCheckpoint(ctx);
}
