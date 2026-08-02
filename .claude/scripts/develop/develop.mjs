#!/usr/bin/env node
/**
 * develop.mjs -- the deterministic core of `/arc-develop` (Phase 00 steel thread).
 *
 * arc commands are markdown prompt files; their verdicts and their file writes belong to
 * scripts, which is what makes them testable offline (ADR-0047: the runner owns the verdict
 * and the receipt). The markdown wrapper calls this.
 *
 * Modes: start | next | status | checkpoint | handoff
 *
 * Lane contract (.claude/rules/lanes.md, ADR-0054/0068): `--lane` is the ONLY way to name a
 * lane; the command's own arguments are never read as lanes. Resolution is IMPORTED from
 * core/lane-resolve.mjs, never re-implemented, and `--for develop` needs no resolver edit.
 * Root-mode prints no lane line at all -- that is a permanent consumer contract for venture
 * repos, not a migration shim.
 *
 * This script NEVER invokes git and NEVER writes to the spine's exit code (ADR-0065).
 *
 * Zero dependencies, Node 18+.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseLaneArgs, renderHuman, resolveLane } from "../core/lane-resolve.mjs";
import { PLACEHOLDER, PREDICTION_FIELDS, isProven, parseLedger, progress, renderLedger } from "./ledger.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_ROOT = resolve(HERE, "..", "..", "..");
const MODES = new Set(["start", "next", "status", "checkpoint", "handoff"]);
/** Every receipt this phase is responsible for, in lifecycle order. */
const EXPECTED_KINDS = ["develop.started", "slice.done", "handoff.ready"];

const out = [];
const say = (s = "") => out.push(s);
const flush = (code) => {
  if (out.length) process.stdout.write(out.join("\n") + "\n");
  process.exit(code);
};
const die = (msg, code = 2) => { say(`STOP: ${msg}`); flush(code); };

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

async function modeNext(ctx) {
  const led = findLedger(ctx.tracker);
  if (!led) die("no slice ledger found — run /arc-develop start <n> first");
  const { slices, errors } = led.parsed;
  for (const e of errors) say(`WARN  [ledger] ${led.file}:${e.line} — ${e.msg}`);

  // The advance step, and the ONLY mode that emits slice.done. It reads what the session
  // left behind and moves the marker; it never fills result:, never runs git (ADR-0065).
  const proven = slices.filter(isProven);
  if (proven.length) {
    const last = proven[proven.length - 1];
    await emit("slice.done", {
      lane: ctx.mode === "root" ? null : ctx.lane,
      slice: last.id,
      tier: last.fields.tier ?? null,
      commit: last.fields.commit ?? null,
    });
  }

  const { proven: p, total, next } = progress(slices);
  if (!next) {
    // Wording is fixed by phase-00-spec.md and asserted by bats -- keep the literal
    // "all slices proven" substring if this line is ever reworded.
    say(`all slices proven (${total}/${total}) — run /arc-develop handoff.`);
    flush(0);
  }
  say(`slice ${next.id} — ${next.fields.title ?? "(untitled)"}`);
  say(`  kind:  ${next.fields.kind ?? "?"}`);
  say(`  proof: ${next.fields.proof ?? "?"}`);
  say(`  tier:  ${next.fields.tier ?? "?"}`);
  say("");
  say(`Progress: ${p}/${total} proven.`);
  flush(0);
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

  const { slices } = led.parsed;
  const { proven, total } = progress(slices);
  await emit("handoff.ready", { lane: ctx.mode === "root" ? null : ctx.lane, proven, total });

  say(`Handoff pack — ${proven}/${total} slices proven`);
  for (const s of slices) {
    say(`  ${isProven(s) ? "✓" : "·"} slice ${s.id}  tier=${s.fields.tier ?? "?"}  ${s.fields.title ?? ""}`);
  }
  say("");
  say(proven === total
    ? "Ready for /arc-phase-done — develop never closes a phase."
    : `NOT ready: ${total - proven} slice(s) still unproven.`);
  flush(0);
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const { lane, laneGiven, laneDup, root: rootArg, positionals } = parseLaneArgs(argv);

const mode = positionals[0];
if (!mode || !MODES.has(mode)) {
  say(`usage: develop.mjs <${[...MODES].join("|")}> [phase] [--lane NAME] [--root PATH]`);
  flush(mode ? 2 : 0);
}

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
  await modeNext(ctx);
} else if (mode === "status") {
  await modeStatus(ctx);
} else if (mode === "handoff") {
  await modeHandoff(ctx, phaseNum);
} else {
  say("no checks wired yet — checkpoint becomes real in Phase 03.");
  flush(0);
}
