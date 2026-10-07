#!/usr/bin/env node
/**
 * gate-parity.mjs -- REQ-01: no blocking rule is enforced only below merge-time (distribute ADR-2002).
 *
 *   node .claude/scripts/core/gate-parity.mjs [--root DIR] [--mutant-selftest]
 *
 * The expected set is DERIVED FROM DISK, never from the table being checked (fixed-defects k):
 *   - the blocking events are the `.claude/hooks/<Event>.sh` files that call `arc_dispatch <Event> blocking`;
 *   - the fragments are every `*.sh` in those events' `.d/` directories;
 *   - the gate rules are the `name:` entries of arc.gates.yaml.
 * Each must have exactly one row in engine/enforcement.yaml, and each row must point at something that
 * exists. A `blocking` row's merge_time is a bats test that exists and cannot skip, or a `repo:` setting
 * that `arc-doctor --repo` reads back; its commit_time command appears verbatim in .githooks/.
 *
 * FAIL-FROM-BIRTH: `--mutant-selftest` copies the tree, plants a hook-only blocking fragment, and passes
 * only if the copy's run names it -- after first proving the unplanted copy is clean, so a gate that
 * reports everything cannot pass the selftest either.
 *
 * Exit: 0 no gaps · 1 gaps (each printed `GAP <id>: <reason>`) · 2 COULD NOT SCAN / usage.
 * The last line of every completed run is `RAN gate-parity`.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";

const REPO_SETTINGS = new Set(["protected-main", "required-checks"]);
const SOURCE_RE = /^(hook):([A-Za-z-]+)\/([A-Za-z0-9._-]+\.sh)$|^(gate):([a-z0-9-]+)$|^(action):([a-z0-9-]+)$/;

class CouldNotScan extends Error {}

function readText(p, what) {
  let t;
  try { t = readFileSync(p, "utf8"); } catch { throw new CouldNotScan(`${what} unreadable: ${p}`); }
  if (t.trim() === "") throw new CouldNotScan(`${what} is empty: ${p}`);
  return t.replace(/\r/g, "");
}

/** The blocking events, read from each event script's own dispatch line. */
export function blockingEvents(root) {
  const dir = join(root, ".claude", "hooks");
  let names;
  try { names = readdirSync(dir); } catch { throw new CouldNotScan(`no hooks directory at ${dir}`); }
  const events = [];
  for (const f of names.sort()) {
    if (!f.endsWith(".sh") || f.startsWith("_") || f === "policy-decide.sh") continue;
    const ev = f.slice(0, -3);
    const text = readFileSync(join(dir, f), "utf8").replace(/\r/g, "");
    const re = new RegExp(`^\\s*arc_dispatch\\s+${ev.replace(/[-]/g, "\\-")}\\s+blocking\\b`, "m");
    if (re.test(text)) events.push(ev);
  }
  return events;
}

export function blockingFragments(root, events) {
  const out = [];
  for (const ev of events) {
    const d = join(root, ".claude", "hooks", `${ev}.d`);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).sort()) if (f.endsWith(".sh")) out.push(`${ev}/${f}`);
  }
  return out;
}

function gateNames(root) {
  const parsed = parseYamlSubset(readText(join(root, "arc.gates.yaml"), "arc.gates.yaml"));
  if (!parsed.ok) throw new CouldNotScan(`arc.gates.yaml does not parse at line ${parsed.error.line}: ${parsed.error.what}`);
  const gates = parsed.value && parsed.value.gates;
  if (!Array.isArray(gates) || gates.length === 0) throw new CouldNotScan("arc.gates.yaml has no gates list");
  return gates.map((g) => (g && typeof g.name === "string" ? g.name : null));
}

/** A bats test's body: the lines after `@test "<name>" {` up to the next top-level `}`. Null when absent. */
function batsTestBody(text, name) {
  const lines = text.split("\n");
  const head = `@test "${name}" {`;
  const i = lines.findIndex((l) => l === head);
  if (i < 0) return null;
  const body = [];
  for (let k = i + 1; k < lines.length && lines[k] !== "}"; k++) body.push(lines[k]);
  return body;
}

export function check(root) {
  const events = blockingEvents(root);
  if (events.length === 0) throw new CouldNotScan("no hook event dispatches in blocking mode");
  const fragments = blockingFragments(root, events);
  if (fragments.length === 0) throw new CouldNotScan(`0 fragments under the blocking events (${events.join(", ")})`);
  const gates = gateNames(root);

  const parsed = parseYamlSubset(readText(join(root, "engine", "enforcement.yaml"), "engine/enforcement.yaml"));
  if (!parsed.ok) throw new CouldNotScan(`engine/enforcement.yaml does not parse at line ${parsed.error.line}: ${parsed.error.what}`);
  const rows = parsed.value && parsed.value.rules;
  if (!Array.isArray(rows) || rows.length === 0) throw new CouldNotScan("engine/enforcement.yaml has no rules list");

  const hookText = [".githooks/pre-commit", ".githooks/pre-push"]
    .map((p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8").replace(/\r/g, "") : ""))
    .join("\n").split("\n").map((l) => l.trim());

  const gaps = [];
  const gap = (id, why) => gaps.push(`GAP ${id}: ${why}`);
  const ids = new Set();
  const coveredHooks = new Map();
  const coveredGates = new Map();

  for (const r of rows) {
    const id = r && typeof r.id === "string" && r.id.trim() ? r.id : "(row with no id)";
    if (ids.has(id)) gap(id, "duplicate id");
    ids.add(id);
    const m = typeof r.source === "string" ? SOURCE_RE.exec(r.source) : null;
    if (!m) { gap(id, `source must be hook:EVENT/FILE.sh, gate:NAME or action:NAME, got ${JSON.stringify(r.source)}`); continue; }
    if (m[1] === "hook") {
      const key = `${m[2]}/${m[3]}`;
      coveredHooks.set(key, (coveredHooks.get(key) || 0) + 1);
      if (!existsSync(join(root, ".claude", "hooks", `${m[2]}.d`, m[3]))) gap(id, `names ${key}, which does not exist`);
      else if (!events.includes(m[2])) gap(id, `names ${key}, but ${m[2]} is not a blocking event`);
    } else if (m[4] === "gate") {
      coveredGates.set(m[5], (coveredGates.get(m[5]) || 0) + 1);
      if (!gates.includes(m[5])) gap(id, `names gate ${m[5]}, which arc.gates.yaml does not define`);
    }
    for (const col of ["tool_time", "commit_time", "merge_time"]) {
      if (typeof r[col] !== "string" || r[col].trim() === "") gap(id, `${col} is missing or empty`);
    }
    if (r.class === "advisory") {
      if (typeof r.advisory_reason !== "string" || r.advisory_reason.trim() === "") gap(id, "advisory with no advisory_reason");
    } else if (r.class === "blocking") {
      const mt = typeof r.merge_time === "string" ? r.merge_time.trim() : "";
      if (mt === "" || mt.startsWith("n/a")) gap(id, "blocking with no merge-time truth");
      else if (mt.startsWith("repo:")) {
        if (!REPO_SETTINGS.has(mt.slice(5))) gap(id, `unknown repository setting ${mt}`);
      } else {
        const sep = mt.indexOf("::");
        const file = sep > 0 ? mt.slice(0, sep) : "";
        const name = sep > 0 ? mt.slice(sep + 2) : "";
        if (!/^tests\/[A-Za-z0-9._-]+\.bats$/.test(file) || !name) gap(id, `merge_time must be tests/FILE.bats::TEST or repo:SETTING, got ${JSON.stringify(mt)}`);
        else if (!existsSync(join(root, file))) gap(id, `merge_time test not found: ${file} does not exist`);
        else {
          const body = batsTestBody(readFileSync(join(root, file), "utf8").replace(/\r/g, ""), name);
          if (body === null) gap(id, `merge_time test not found: ${file} has no @test "${name}"`);
          else if (body.some((l) => /^\s*skip(\s|$)/.test(l))) gap(id, `merge_time test can skip: ${file}::${name}`);
        }
      }
      const ct = typeof r.commit_time === "string" ? r.commit_time.trim() : "";
      if (ct !== "" && !ct.startsWith("n/a") && !hookText.includes(ct)) gap(id, `commit_time command not run by .githooks: ${ct}`);
    } else gap(id, `class must be blocking or advisory, got ${JSON.stringify(r.class)}`);
  }

  for (const f of fragments) {
    const n = coveredHooks.get(f) || 0;
    if (n === 0) gap(`hook:${f}`, "blocking fragment with no row in engine/enforcement.yaml");
    else if (n > 1) gap(`hook:${f}`, `${n} rows name this fragment`);
  }
  for (const g of gates) {
    if (g === null) { gap("gate:(unnamed)", "arc.gates.yaml entry with no name"); continue; }
    const n = coveredGates.get(g) || 0;
    if (n === 0) gap(`gate:${g}`, "gate rule with no row in engine/enforcement.yaml");
    else if (n > 1) gap(`gate:${g}`, `${n} rows name this gate`);
  }
  return { fragments: fragments.length, rules: gates.length, rows: rows.length, gaps };
}

function mutantSelftest(root) {
  const tmp = mkdtempSync(join(tmpdir(), "gate-parity-"));
  try {
    for (const p of [".claude/hooks", ".githooks", "arc.gates.yaml", "engine/enforcement.yaml", "tests"]) {
      const from = join(root, p);
      if (!existsSync(from)) throw new CouldNotScan(`mutant-selftest: ${p} missing in ${root}`);
      if (p === "tests") {
        mkdirSync(join(tmp, "tests"), { recursive: true });
        for (const f of readdirSync(from)) if (f.endsWith(".bats")) cpSync(join(from, f), join(tmp, "tests", f));
      } else cpSync(from, join(tmp, p), { recursive: true });
    }
    const clean = check(tmp);
    if (clean.gaps.length !== 0) return { ok: false, why: `the unplanted copy already has ${clean.gaps.length} gap(s), so the selftest proves nothing` };
    const ev = blockingEvents(tmp)[0];
    writeFileSync(join(tmp, ".claude", "hooks", `${ev}.d`, "99-mutant.sh"), "#!/usr/bin/env bash\nexit 2\n");
    const planted = check(tmp);
    const named = planted.gaps.some((g) => g.includes("99-mutant.sh"));
    return named ? { ok: true, why: `caught 99-mutant (${ev}.d/99-mutant.sh)` } : { ok: false, why: "the planted fragment was NOT named" };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function main(argv) {
  let root = null;
  let selftest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") {
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("--")) { console.error("gate-parity: --root needs a directory"); return 2; }
      if (root !== null) { console.error("gate-parity: --root given twice"); return 2; }
      root = v; i++;
    } else if (a === "--mutant-selftest") selftest = true;
    else { console.error(`gate-parity: unknown argument ${JSON.stringify(a)}`); return 2; }
  }
  root = resolve(root ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..", ".."));
  try {
    if (selftest) {
      const r = mutantSelftest(root);
      console.log(`mutant-selftest: ${r.why}`);
      console.log("RAN gate-parity");
      return r.ok ? 0 : 1;
    }
    const r = check(root);
    console.log(`gate-parity: ${r.fragments} fragments, ${r.rules} rules, ${r.rows} rows, ${r.gaps.length} gaps`);
    for (const g of r.gaps) console.log(g);
    console.log("RAN gate-parity");
    return r.gaps.length ? 1 : 0;
  } catch (e) {
    if (e instanceof CouldNotScan) { console.log(`gate-parity: COULD NOT SCAN -- ${e.message}`); return 2; }
    throw e;
  }
}

// Main guard: both sides realpath'd, so a symlinked checkout or a /var -> /private/var temp dir still runs (class a).
const self = realpathSync(fileURLToPath(import.meta.url));
const invoked = process.argv[1] ? (() => { try { return realpathSync(process.argv[1]); } catch { return null; } })() : null;
if (invoked === self) process.exitCode = main(process.argv.slice(2));
