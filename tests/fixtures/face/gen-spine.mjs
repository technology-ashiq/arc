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
// `--phase04 1` adds one deterministic block of the receipts face v2 Phase 04's read routes fold (council, bench,
// hires, jobs, leads, growth, legal, evolve, policy) to the FIRST day, so each route's door arm can assert a
// payload that came from a receipt rather than an empty list. Off by default: every other caller's spine is
// byte-identical to what it was.
const PHASE04 = args.phase04 === "1";

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

/**
 * The Phase 04 block: one receipt of each shape a Phase 04 route folds, with the payload fields its lane's own
 * parser reads. A payload that is a function is built from the ids written before it (a supersede, a decision).
 * @param {string} day
 */
function phase04Block(day) {
  return [
    // council: two calls, one scored -- the verdict ledger and the calibration read them.
    { kind: "council.verdict", payload: ({ hex }) => ({ session_id: "c-fixture-1", question_hash: hex("q1"), call: "proceed", confidence: "High" }) },
    { kind: "council.verdict", payload: ({ hex }) => ({ session_id: "c-fixture-2", question_hash: hex("q2"), call: "hold", confidence: "Low" }) },
    { kind: "council.outcome", payload: ({ ts }) => ({ session_id: "c-fixture-1", outcome: "happened", observed_at: ts, source_id: "fixture-source" }) },
    // bench: one scored run, NO PROPOSAL on its class.
    { kind: "run.completed", actor: "arc-bench", payload: ({ hex }) => ({ scorecard_sha: hex("scorecard"), normalizer_version: 1, subject: "claude-code:haiku", model_applied: "haiku", outcome: "ok", classes: [{ task_class: "commit-msg-draft", eligible: false, reason: "NO PROPOSAL - fixture below the floor", assertions: 0, schema: 0 }] }) },
    // a hire's dispatch through the runtime driver.
    { kind: "run.completed", actor: "arc-run", payload: { process: "build-in-public-draft", driver: "hermes", outcome: "ok", duration_ms: 1200, model_source: "fixture" } },
    // a scheduled job's fire.
    { kind: "run.completed", actor: "scheduler:brief-materialize", payload: { job: "brief-materialize", outcome: "ok", duration_ms: 40 } },
    // leads: two sends to one lead, one to another, and a suppression -- HMAC-shaped ids, never a contact.
    { kind: "outreach.sent", payload: ({ ts }) => ({ lead_id: "lead_hmac_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", campaign: "fixture", submitted_at: ts, rehearsal: true }) },
    { kind: "outreach.sent", payload: ({ ts }) => ({ lead_id: "lead_hmac_v1_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", campaign: "fixture", submitted_at: ts, rehearsal: true }) },
    { kind: "outreach.sent", payload: ({ ts }) => ({ lead_id: "lead_hmac_v1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", campaign: "fixture", submitted_at: ts, rehearsal: true }) },
    { kind: "lead.suppressed", payload: ({ ts }) => ({ lead_id: "lead_hmac_v1_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", reason: "unsubscribe", suppressed_at: ts }) },
    // growth: a piece published, then corrected -- the chain's head is the correction.
    { kind: "content.published", payload: ({ hex }) => ({ site: "fixture.example", slug: "fixture-piece", url: "https://fixture.example/fixture-piece", title: "Fixture piece", template_id: "t-fixture", cluster_id: "k-fixture", content_sha: hex("piece-v1"), pr_ref: "fixture#1" }) },
    { kind: "content.published", supersedes: 10, payload: ({ hex }) => ({ site: "fixture.example", slug: "fixture-piece", url: "https://fixture.example/fixture-piece", title: "Fixture piece, corrected", template_id: "t-fixture", cluster_id: "k-fixture", content_sha: hex("piece-v2"), pr_ref: "fixture#2" }) },
    { kind: "approval.requested", payload: { what: "fixture cluster plan", gate: "cluster" } },
    // legal: one piece held at the publish gate, and decided.
    { kind: "approval.requested", payload: ({ hex }) => ({ what: "fixture terms page", gate: "legal", subject: "legal.publish", sha: hex("terms") }) },
    { kind: "decision.recorded", payload: ({ ids }) => ({ decides: ids[13], reason: "fixture legal approval", verdict: "approve" }) },
    // evolve: one experiment, two arms, one measured window.
    { kind: "experiment.opened", payload: { experiment_id: "x-fixture", module: "fixture", surface: "fixture-surface", target_path: "docs/fixture.md", base_sha: "0".repeat(64), split: 50, ttl_days: 14, arms: ["+a", "+b"] } },
    { kind: "experiment.measured", payload: { experiment_id: "x-fixture", arm: "+a", unit_id: "u1", unit_count: 3, metric: "fixture_metric", window_start: day, window_end: day } },
    { kind: "experiment.measured", payload: { experiment_id: "x-fixture", arm: "+b", unit_id: "u2", unit_count: 2, metric: "fixture_metric", window_start: day, window_end: day } },
    // policy: one earned rung, folded under the ceiling.
    { kind: "policy.level.changed", payload: { action_kind: "process:review-diff", capability: "read", to_level: "L2", from_level: "L1", evidence: "docs/trial-ledger.md#fixture" } },
    // money: one real and one simulated receipt on the day, and three cost lines -- two currencies, one unmeasurable --
    // so the day series has both substances and two currencies on ONE day, which is where a sum would hide.
    { kind: "revenue.received", venture: "lexos", payload: { amount: 250000, currency: "INR", venture: "lexos", provider: "fixture", provider_payment_id: "pay_fixture_real_1" } },
    { kind: "revenue.simulated", venture: "lexos", payload: { amount: 99900, currency: "INR", venture: "lexos", provider: "fixture", provider_payment_id: "pay_fixture_sim_1" } },
    { kind: "cost.incurred", payload: { amount: 12345, currency: "INR", source: "measured", label: "fixture api" } },
    { kind: "cost.incurred", payload: { amount: 500, currency: "USD", source: "estimated", label: "fixture gpu" } },
    { kind: "cost.incurred", payload: { amount: 1.5, currency: "INR", source: "estimated", label: "fixture unmeasurable" } },
  ];
}
let phase04Written = 0;

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
  if (PHASE04 && d === 0) {
    // Written after the day's own events, a minute past its last one, in one fixed order.
    const t0 = dayBase + n * 2400 + 60_000;
    const hex = (s) => sha256Hex(`${SEED}|p04|${s}`);
    const ids = [];
    phase04Block(day).forEach((spec, j) => {
      const { ts } = istParts(t0 + j * 1000);
      const id = newUlid(t0 + j * 1000, `p04-${j}`);
      ids.push(id);
      const event = {
        actor: spec.actor || "gen-spine", cost: null, evidence: null, id,
        idem: hex(`idem-${j}`), kind: spec.kind, model: null, outcome: "ok",
        payload: typeof spec.payload === "function" ? spec.payload({ ts, ids, hex }) : spec.payload,
        process: "gen-spine@1.0.0", run_id: "r-fix-p04",
        supersedes: spec.supersedes === undefined ? null : ids[spec.supersedes], ts, v: 1, venture: spec.venture || "arc",
      };
      event.sha = eventSha(event);
      lines.push(canonicalize(event));
      phase04Written++;
    });
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
  dir: OUT, events: written + phase04Written, ...(PHASE04 ? { base: written, phase04: phase04Written } : {}), days: summaryDays.length,
  closedDays: summaryDays.length - 1, openApproval,
  hostile: HOSTILE.length, seed: SEED,
}) + "\n");
