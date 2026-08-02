#!/usr/bin/env node
/**
 * develop-lint.mjs -- the proof floor (Phase 01).
 *
 * ADR-0101 draws the BLOCK/WARN line on a principle rather than a preference:
 * **false-block risk lives in pattern matching, never in "did the file parse".**
 *
 *   BLOCK (exit 1), structural -- presence-or-parse questions with no judgement in them:
 *     [ledger-unparseable]  the file either satisfies the ADR-0100 grammar or it does not
 *     [brief-stale]         the recorded spec-hash either matches the spec or it does not
 *     [slice-unproven]      a ticked slice either carries proof/tier/commit or it does not
 *
 *   WARN-first (exit 0, `[trial]` suffix), heuristic -- promotes to BLOCK only via
 *   docs/trial-ledger.md, arc's existing mechanism:
 *     [self-declared-number]  a regex that could trip on a legitimate version or count
 *     [tier-floor]            evidence-strength floors per slice kind
 *
 * Every BLOCK ships with a negative-control fixture proving it CAN fail. A control that has
 * never been seen to fail is a coin, not a gate (retro-log 2026-08-02).
 *
 * Lane-aware by IMPORT, never re-implementation: resolveLane from core/lane-resolve.mjs,
 * exactly as kickoff-lint does. Lane echo first, canonical output order.
 *
 * WARN shape is arc's house format, four lines, so a WARN is actionable without reading code:
 *   [check-name] FILE:LINE — <what>
 *     Expected: ...
 *     Found:    ...
 *     Example:  ...
 *
 * Zero dependencies, Node 18+.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { parseLaneArgs, renderHuman, resolveLane } from "../core/lane-resolve.mjs";
import { TIERS, KINDS, isFilled, isProven, parseLedger } from "./ledger.mjs";

// ---------- output ----------
const failures = [];
const warnings = [];
const lines = [];
const say = (s = "") => lines.push(s);

const fail = (group, where, what, expected, found, example) => {
  failures.push({ group, where, what, expected, found, example });
};
const warn = (group, where, what, expected, found, example) => {
  warnings.push({ group, where, what, expected, found, example });
};
const render = (f, kind) => {
  say(`${kind} [${f.group}] ${f.where} — ${f.what}`);
  if (f.expected !== undefined) say(`  Expected: ${f.expected}`);
  if (f.found !== undefined) say(`  Found:    ${f.found}`);
  if (f.example !== undefined) say(`  Example:  ${f.example}`);
};

// ---------- WARN-first trial set (ADR-0101) ----------
// A group leaves TRIAL only via docs/trial-ledger.md: fixture-proven + >=3 clean dogfood
// runs with zero false positives + a retro sign-off. Promotion is deleting one line here.
const TRIAL = new Set(["self-declared-number", "tier-floor"]);
const SUBSTANCE = new Set(["self-declared-number", "tier-floor"]);

// ---------- CLI ----------
const cli = parseLaneArgs(process.argv.slice(2));
let root = cli.root;
if (!root) {
  try {
    const { execFileSync } = await import("node:child_process");
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { root = ""; }
  if (!root) root = process.cwd();
}
root = resolve(root);

const r = resolveLane({ root, lane: cli.lane, laneGiven: cli.laneGiven, laneDup: cli.laneDup, surface: "lint" });
if (r.code !== 0) {
  for (const l of renderHuman(r)) console.log(l);
  process.exit(r.code);
}
if (r.mode === "lane") { console.log(`Selected lane: ${r.lane} (via ${r.via})`); console.log(""); }

const troot = r.mode === "root" ? root : join(root, r.tracker);
const phasesDir = join(troot, "phases");

// ---------- collect ledgers ----------
let entries = [];
try { entries = readdirSync(phasesDir); } catch { entries = []; }

// Case-INSENSITIVE: on Windows and macOS the filesystem preserves case but matches without
// it, so a `phase-00-tasks.MD` was skipped by a case-sensitive filter and the lint then
// printed "no slice ledger yet" and exited 0 over a directory holding a full ledger.
const ledgerFiles = entries.filter((f) => /^phase-\d+-tasks\.md$/i.test(f)).sort();

// A file that is ledger-SHAPED but not ledger-NAMED is not "nothing to check" — it is a
// ledger the gate cannot see, which is worse than an unparseable one.
for (const f of entries.filter((f) => !/^phase-\d+-tasks\.md$/i.test(f) && /tasks?\.(md|markdown|txt)$/i.test(f))) {
  fail("ledger-unparseable", `phases/${f}`, "a ledger-shaped file this lint does not read",
    "phase-NN-tasks.md", f, "phase-01-tasks.md");
}

// A phase with a spec but no ledger is an unstarted phase, which is legal — but a phase
// whose ledger vanished is not, and both used to print the same reassuring line.
const specPhases = entries.filter((f) => /^phase-\d+-spec\.md$/i.test(f)).map((f) => f.match(/\d+/)[0]);
const ledgerPhases = new Set(ledgerFiles.map((f) => f.match(/\d+/)[0]));

if (ledgerFiles.length === 0 && failures.length === 0) {
  console.log(
    specPhases.length
      ? `develop-lint: ${specPhases.length} phase spec(s) present, no slice ledger yet — run /arc-develop start <n>.`
      : "develop-lint: no slice ledger yet — nothing to check.",
  );
  process.exit(0);
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// A number the model asserts ABOUT ITSELF. Deliberately narrow: it looks for a
// confidence/score/certainty claim carrying a number, not for numbers in general -- a
// version string, a line count or a duration is legitimate and must not trip it.
const SELF_DECLARED =
  /\b(confidence|certainty|confident|score|scored|rating|rated|likelihood|probability|success[- ]rate|accuracy)\b[^.\n]{0,24}?\b\d{1,3}(?:\.\d+)?\s*%?/i;

for (const file of ledgerFiles) {
  const path = join(phasesDir, file);
  const raw = readFileSync(path, "utf8");
  const { brief, slices, errors } = parseLedger(raw);
  const phase = (file.match(/phase-(\d+)-tasks/) || [, "??"])[1];

  // ---------- BLOCK 1: [ledger-unparseable] ----------
  // Structural. Every error carries the offending slice id and line, never a whole-file
  // failure with no location -- a gate that fails closed with no address is unfixable.
  for (const e of errors) {
    fail(
      "ledger-unparseable",
      `${file}:${e.line}`,
      e.msg,
      "one `key: value` per line, one slice per `slice:` heading, no repeated keys (ADR-0100)",
      e.id ? `slice ${e.id}` : "brief header",
      "#### slice: 03",
    );
  }

  // ---------- BLOCK 2: [brief-stale] ----------
  // Structural. What Ashiq sees must be what the build runs on: if the spec moved after the
  // brief was written, the brief is describing a phase that no longer exists.
  const specPath = join(phasesDir, `phase-${phase}-spec.md`);
  const recorded = (brief["spec-hash"] || "").trim();

  // The brief must be bound to the spec it NAMES, not only to the one its filename implies.
  // A brief headed "phase 01", saved as phase-00-tasks.md and carrying phase 00's hash,
  // passed clean: a reviewer read a brief pinned to phase 01 while the gate had verified
  // phase 00. The hash matched — it was just the hash of a different phase.
  const titleLine = (raw.split("\n").find((l) => /^#[^#]/.test(l)) || "").trim();
  const titlePhase = titleLine.match(/phase[ \t]+0*(\d+)/i);
  if (titlePhase && Number(titlePhase[1]) !== Number(phase)) {
    fail("brief-stale", `${file}:1`, "the brief names a different phase than its filename",
      `phase ${Number(phase)}`, titleLine, `# Build Brief — phase ${Number(phase)} · …`);
  }
  if (!recorded) {
    fail("brief-stale", `${file}:1`, "brief carries no `spec-hash:` line",
      "spec-hash: sha256:<64 hex>", "(absent)", "spec-hash: sha256:2aa8419035…");
  } else if (!existsSync(specPath)) {
    fail("brief-stale", `${file}:1`, `brief references a phase spec that does not exist`,
      `phases/phase-${phase}-spec.md present`, "(missing)", `phases/phase-${phase}-spec.md`);
  } else {
    const actual = `sha256:${sha256(readFileSync(specPath))}`;
    if (recorded !== actual) {
      fail("brief-stale", `${file}:1`,
        `the spec changed after this brief was written — rerun \`/arc-develop start ${Number(phase)}\``,
        actual, recorded, `spec-hash: ${actual}`);
    }
  }

  // ---------- per-slice checks ----------
  for (const s of slices) {
    const at = `${file}:${s.line}`;
    const f = s.fields;
    const ticked = isFilled(f.result) || isFilled(f.commit);

    // ---------- BLOCK 3: [slice-unproven] ----------
    // Structural. A slice that claims to be done must carry all three: what proved it, how
    // strong that proof is, and the commit the proof ran against (ADR-0102).
    if (ticked) {
      for (const key of ["proof", "tier", "commit"]) {
        if (!isFilled(f[key])) {
          fail("slice-unproven", at,
            `slice ${s.id} is ticked but carries no \`${key}:\``,
            `${key}: a real value`, `${key}: ${f[key] ?? "(absent)"}`,
            key === "proof" ? "proof: contract — `npm run test -- tokens`" : key === "tier" ? "tier: contract" : "commit: 8c46844");
          continue;
        }
        if (key === "tier" && !TIERS.includes(f.tier.trim())) {
          fail("slice-unproven", at, `slice ${s.id} has an unknown evidence tier`,
            TIERS.join(" | "), f.tier, "tier: contract");
        }
        // Structural, not heuristic: a commit reference is a hex SHA or it is not one.
        // Without this, `commit: yes` satisfies "the field is filled" and the proof-to-code
        // link the whole ledger rests on becomes a word.
        // A proof must SAY something checkable. `proof: it works` clears "the field is
        // filled" and means nothing — so a proof names its evidence tier or carries the
        // command that produced it. This is the positive requirement that makes
        // proof-before-implementation enforceable rather than a field to populate.
        if (key === "proof") {
          const p = f.proof.trim();
          const namesTier = TIERS.some((t) => p.toLowerCase().includes(t));
          const hasCommand = /`[^`]+`/.test(p);
          if (!namesTier && !hasCommand) {
            fail("slice-unproven", at, `slice ${s.id}'s \`proof:\` names neither an evidence tier nor a command`,
              "an evidence tier word, or the command in backticks", p,
              "proof: contract — `npm run test -- tokens`");
          }
        }
        if (key === "commit" && !/^[0-9a-f]{7,40}$/i.test(f.commit.trim())) {
          fail("slice-unproven", at, `slice ${s.id}'s \`commit:\` is not a commit SHA`,
            "7-40 hex characters", f.commit.trim(), "commit: 8c46844");
        }
      }
    }

    // ---------- WARN: [self-declared-number] ----------
    for (const [k, v] of Object.entries(f)) {
      if (typeof v !== "string") continue;
      const m = v.match(SELF_DECLARED);
      if (m) {
        warn("self-declared-number", at,
          `slice ${s.id} field \`${k}\` asserts a number about its own quality`,
          "a number computed by a tool or earned from a scored outcome",
          m[0].trim(),
          "proof: contract — `npm run test -- auth` (12 assertions, all green)");
      }
    }

    // ---------- WARN: [tier-floor] ----------
    const kind = (f.kind || "").trim();
    if (!kind) {
      warn("tier-floor", at, `slice ${s.id} carries no \`kind:\`, so no evidence floor can be checked`,
        KINDS.join(" | "), "(absent)", "kind: ui");
    } else if (!KINDS.includes(kind)) {
      warn("tier-floor", at, `slice ${s.id} has an unknown \`kind:\``, KINDS.join(" | "), kind, "kind: logic");
    } else if (isProven(s)) {
      const floor = kind === "ui" ? "e2e-visual" : kind === "external-dep" ? "contract" : null;
      if (floor) {
        const have = TIERS.indexOf((f.tier || "").trim());
        if (have >= 0 && have < TIERS.indexOf(floor)) {
          warn("tier-floor", at,
            `slice ${s.id} is \`kind: ${kind}\` but its strongest evidence is \`${f.tier.trim()}\``,
            `at least \`${floor}\` for a ${kind} slice`, f.tier.trim(), `tier: ${floor}`);
        }
      }
    }
  }
}

// ---------- report ----------
for (const w of warnings) render(w, "WARN ");
say(
  `[trial-status] ${[...SUBSTANCE].filter((g) => !TRIAL.has(g)).length} substance gate(s) live, ` +
  `${TRIAL.size} in trial — promote via /arc-retro (criteria: docs/trial-ledger.md)`,
);
if (failures.length) {
  say("");
  say(`develop-lint: ${failures.length} check(s) FAILED`);
  say("");
  for (const f of failures) render(f, "FAIL ");
  say("");
  say("Fix and rerun. Prose assurances don't count.");
  console.log(lines.join("\n"));
  process.exit(1);
}
say("develop-lint: all checks passed ✔");
console.log(lines.join("\n"));
process.exit(0);
