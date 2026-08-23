#!/usr/bin/env node
// gen-spine.mjs -- deterministic fixture-spine generator for the face lane (REQ-09).
//
// Two phases consume synthetic spines this file produces (PLAN external-deps row): the
// Phase 03 cursor/perf fixture (10k events) and the Phase 06 honesty-classes fixture
// (real + simulated + rehearsal rows that no panel may sum). The generator is
// deterministic BY CONSTRUCTION: it pins ARC_SPINE_RAND and derives every timestamp from
// a fixed base, so two runs with the same seed produce byte-identical day files -- which
// is what lets the vacuous-pass guard assert row counts BEFORE any perf number is read.
//
//   node gen-spine.mjs --out <dir> [--count 10000] [--seed face-v1] [--days 30]
//
// Prints a JSON summary line: { dir, events, days, closedDays, openApproval, hostile }.
// The LAST day stays UNSEALED and carries a deliberately torn (truncated) final line --
// the mid-write shape the spine-health reader counts and the cursor must survive.

import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith("--")) { args[a.slice(2)] = process.argv[i + 1]; i++; }
}
const OUT = args.out ? resolve(args.out) : null;
if (!OUT) { process.stderr.write("gen-spine: --out <dir> is required\n"); process.exit(1); }
const COUNT = Number(args.count || 10000);
const DAYS = Number(args.days || 30);
const SEED = args.seed || "face-v1";

// Pin the deterministic doors BEFORE importing the emitter's own primitives.
process.env.ARC_SPINE_RAND = SEED;
const { canonicalize, eventSha, newUlid, sha256Hex } = await import("../../../.claude/scripts/hq/lib/canonical.mjs");

// Base clock: 2026-07-20T09:00:00+05:30, one fixture-day per calendar day, events spread
// a deterministic 2.4s apart. IST = UTC+5:30; the day string is derived the same way the
// emitter derives it (from the +05:30 wall clock).
const DAY_MS = 24 * 60 * 60 * 1000;
const BASE_UTC = Date.parse("2026-07-20T03:30:00Z"); // 09:00 IST
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

function istParts(ms) {
  const d = new Date(ms + IST_OFFSET);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  const day = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  const ts = `${day}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+05:30`;
  return { day, ts };
}

// Kind mix -- weighted to look like the real spine (mostly note.logged), with the
// honesty-classes rows and the decision pairs the fixtures assert against.
const MIX = [
  ["note.logged", 62], ["run.completed", 12], ["metric.observed", 8],
  ["lead.researched", 4], ["review.completed", 3], ["commit.done", 2],
  ["approval.requested", 3], ["decision.recorded", 3], ["revenue.simulated", 2], ["phase.closed", 1],
];
const WHEEL = MIX.flatMap(([k, w]) => Array(w).fill(k));

const HOSTILE = [
  { note: "<script>document.title='owned'</script><img src=x onerror=alert(1)>" },
  { note: "bidi ‮gnihtemos‬ and a fake RTL run ⁦inside⁩" },
  { note: "A".repeat(60 * 1024) }, // 60 KB body -- under the emit cap, over any sane render
];

mkdirSync(join(OUT, "events"), { recursive: true });

const perDay = Math.ceil(COUNT / DAYS);
let written = 0;
let salt = 0;
let openApproval = null;
const pendingApprovals = [];
const summaryDays = [];

for (let d = 0; d < DAYS && written < COUNT; d++) {
  const dayBase = BASE_UTC + d * DAY_MS;
  const { day } = istParts(dayBase);
  const lines = [];
  const n = Math.min(perDay, COUNT - written);
  for (let i = 0; i < n; i++) {
    const ms = dayBase + i * 2400;
    const { ts } = istParts(ms);
    const id = newUlid(ms, `e${salt}`);
    let kind = WHEEL[salt % WHEEL.length];
    let payload;

    if (kind === "approval.requested") {
      payload = { what: `fixture approval ${salt}`, gate: "fixture" };
      pendingApprovals.push(id);
    } else if (kind === "decision.recorded" && pendingApprovals.length > 1) {
      // Always keep at least one approval OPEN (the parity fixture decides it live).
      const decides = pendingApprovals.shift();
      payload = { decides, reason: `fixture reason ${salt}`, verdict: salt % 2 ? "approve" : "reject" };
    } else if (kind === "decision.recorded") {
      kind = "note.logged";
      payload = { note: `fixture note ${salt}` };
    } else if (kind === "revenue.simulated") {
      payload = { amount_minor: 100000 + salt, currency: "INR", month: day.slice(0, 7), simulated: true };
    } else if (kind === "metric.observed") {
      // REHEARSAL-class rows for the honesty fixture: labelled, never summable with real.
      payload = { metric: "fixture.metric", value: salt % 100, class: salt % 3 === 0 ? "REHEARSAL" : "real" };
    } else if (kind === "note.logged" && salt % 997 === 0 && HOSTILE.length) {
      payload = HOSTILE[salt % HOSTILE.length];
    } else {
      payload = { note: `fixture ${kind} ${salt}` };
    }

    const event = {
      actor: "gen-spine", cost: null, evidence: null, id,
      idem: sha256Hex(`${SEED}|${salt}`), kind, model: null, outcome: "ok",
      payload, process: "gen-spine@1.0.0", run_id: `r-fix-${d}`,
      supersedes: null, ts, v: 1, venture: "arc",
    };
    event.sha = eventSha(event);
    lines.push(canonicalize(event));
    salt++;
    written++;
  }
  writeFileSync(join(OUT, "events", `${day}.jsonl`), lines.join("\n") + "\n");
  summaryDays.push(day);
}

// The open approval the parity fixture decides: the newest still-pending one.
openApproval = pendingApprovals.length ? pendingApprovals[pendingApprovals.length - 1] : null;

// Seal every day but the last (sealed days are the replay-identical boundary, REQ-05);
// leave the last day OPEN and tear its tail (a mid-write truncated line).
const lastDay = summaryDays[summaryDays.length - 1];
for (const day of summaryDays.slice(0, -1)) {
  writeFileSync(join(OUT, "events", `${day}.closed`), `${SEED}-seal-${day}\n`);
}
appendFileSync(join(OUT, "events", `${lastDay}.jsonl`), '{"actor":"gen-spine","id":"01TRUNCAT');

process.stdout.write(JSON.stringify({
  dir: OUT, events: written, days: summaryDays.length,
  closedDays: summaryDays.length - 1, openApproval,
  hostile: HOSTILE.length, seed: SEED,
}) + "\n");
