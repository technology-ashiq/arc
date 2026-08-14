#!/usr/bin/env node
// arc-brief -- the day in one screen.
//
// ckpt B ships the MINIMAL renderer only, because REQ-04's acceptance invokes
// `arc brief --date D` to prove replay determinism and Phase 2 does not exist yet. The
// one-screen noise budget, the needs-you/money/progress/background grouping and the
// overflow-to-counts behaviour (REQ-05) are Phase 2's work, not a missing piece here.
//
// SPINE-G (ADR-0030): every byte below comes from the spine reader. This file contains no
// path to events/*.jsonl and no path to state.db, which is what REQ-09's grep-lint checks.
//
// Output is deterministic by construction: fixed field order, counts sorted by kind name,
// events in append order. That is what makes it byte-comparable across a rebuild and across
// engines.
//
// Usage: arc-brief [--date YYYY-MM-DD] [--venture V] [--engine scan|sqlite]

import { SpineError, dayOf, formatIst, nowMs } from "./lib/canonical.mjs";
import { spineRoot } from "./lib/spine-io.mjs";
import { query } from "./spine.mjs";
import { deriveKillPanel } from "./lib/ledger/kill-panel.mjs";
import { dailySpend, renderSpendLine } from "./lib/ledger/costs.mjs";
import { derivePanel, needsYouLines, loadJobs, loadPanelInputs } from "./lib/jobs/panel.mjs";
import { policyRoot } from "./lib/policy/run-gate.mjs";

const VALUE_FLAGS = new Set(["date", "venture", "engine"]);
const BOOL_FLAGS = new Set(["full"]);

// REQ-05: every kind maps to exactly one group; the order here is the render order. needs-you
// and money are never collapsed; background then progress collapse to counts when a day
// overflows the line budget.
// Every row below that is not a company kind was decided by the lane that owns it, not by this
// file. The table sat 22 kinds behind the vocabulary for months precisely because guessing on
// another lane's behalf felt worse than leaving a hole -- so the question was routed to each
// lane and answered with evidence. Two of the four sections carry a consequence a lane cannot
// see from its own side, and both bit during that round:
//
//   needs-you and money NEVER collapse. A high-volume kind here buries the day.
//   background ALWAYS collapses, and it collapses BEFORE the line budget is measured.
//   progress collapses only AFTER, and as a whole -- so a high-volume kind in progress does not
//   only collapse itself, it pushes every OTHER lane's progress into a count on the same day.
//
// That last clause is why `experiment.assigned` and `experiment.measured` are down in background
// rather than up in progress with the other six experiment kinds: they are per-UNIT, not
// per-experiment (`validate-experiment.mjs:118-119` require `unit_id`), so one live experiment is
// an N-hundred-line stream. Group choice for a high-volume kind is a cross-lane side effect.
const GROUPS = [
  // `policy.demoted` sits with the things that need a human. It is machine-derived and needs no
  // approval to happen -- which is exactly why it belongs here: authority dropping silently is
  // the one authority change nobody asked for. The incident it cites is already on this line;
  // what the incident cannot say is which grant was lost.
  //
  // `outreach.replied` is deliberately NOT here, and the reasoning generalises: leads triage is
  // fully automatic, and the one class of five that needs a human already emits
  // `approval.requested` (`ingest.mjs:301`), which is on this line. Adding the parent kind would
  // double-surface one demand and drag the other four classes -- including `bounce`, a
  // `triage_class` rather than its own kind -- into the tier that never collapses.
  //
  // `slice.stuck` is two signals under one name: `backstop: fingerprint-3x` is machine-directed,
  // `attempts-5` is addressed to a person. The table keys on kind, not payload, so the more
  // severe reading wins. It has fired zero times to date, so never-collapsing costs nothing; if
  // it ever fires at volume it is the first kind in the vocabulary needing payload-level routing.
  ["needs-you", ["approval.requested", "incident.raised", "policy.demoted",
                 "handoff.ready", "slice.stuck", "promotion.proposed", "meeting.booked"]],
  // This is the money VIEW, not cash movement -- `revenue.simulated` is here and ADR-0026 marks
  // it never in P&L, and `spend.reserved` is an earmark rather than a payment. `deal.won` belongs
  // on those terms: it is the rarest and highest-value receipt the leads lane emits, and a
  // `deal.won` with no matching `revenue.received` is an unpaid invoice visible in one glance --
  // a reconciliation that only works while both sit in the same never-collapsing section.
  // It renders as a bare line until its payload carries `amount` + `currency`; `amount_inr` is
  // already paise (`validate-leads.mjs:307`), so that is a field-name gap in the leads lane's own
  // ADR band, not a semantic one. A visibly incomplete money line announces the gap; a
  // correctly-formatted progress line would hide it while under-ranking the event.
  // `month.closed` (ADR-1004) lands in MONEY rather than progress, and the choice is load-bearing
  // in one direction: money never collapses to a count. A close is at most twelve events a year, so
  // it costs this section nothing, and it is the one line that says a month's numbers are now
  // frozen and reconciled against the provider. Filed under progress it would collapse on any busy
  // day, which is exactly the day a close is most likely to have happened.
  ["money",     ["revenue.received", "revenue.simulated", "cost.incurred",
                 "spend.reserved", "spend.released", "deal.won", "month.closed"]],
  // `experiment.rolled_back` is here rather than in needs-you because ADR-0305 makes the machine
  // propose-only in both directions: its payload carries a `commit_ref`, which exists only
  // because a human already merged. The part that needed eyes fired earlier as `incident.raised`.
  // Filing a closed loop in the section reserved for open ones is how people learn to skim it.
  //
  // `content.published` lands here on exactly that precedent. Its payload carries `pr_ref`, which
  // exists only because a human merged the publishing PR -- publishing is E2 and the machine never
  // merges (ADR-1102) -- so the part that needed eyes has already happened and needs-you would
  // re-ask a question that was answered. It is not background either: background is the collapsing
  // tier for per-unit streams, and this fires once per article, at single digits per week. It is
  // also the most externally-visible receipt the company emits, and the one kind whose absence
  // from a brief would mean nobody noticed the site had changed.
  ["progress",  ["kickoff.done", "phase.closed", "review.completed", "qa.completed", "commit.done",
                 "ship.done", "run.completed", "decision.recorded", "council.verdict",
                 "policy.level.changed", "develop.started", "slice.done",
                 "experiment.opened", "experiment.verdict", "experiment.promoted",
                 "experiment.rolled_back", "experiment.closed", "council.outcome",
                 "outreach.replied", "deal.lost", "constitution.adopted",
                 "content.published"]],
  ["background",["note.logged", "redaction.applied", "day.closed", "idea.captured",
                 "experiment.assigned", "experiment.measured",
                 "lead.researched", "outreach.sent", "lead.suppressed", "metric.observed"]],
  // NOT a group anything routes to by name -- the catch-all for a vocabulary kind this file
  // does not know. `GROUP_OF.get` returned undefined for such a kind and the event was simply
  // skipped, and a brief that silently omits a kind reads exactly like a quiet day. That is the
  // failure mode the UNREADABLE LINES counter one screen down already exists to prevent.
  //
  // It should now be permanently EMPTY: every one of the closed 45 is assigned above, and the
  // coverage test in `tests/policy-brief.bats` derives its list from `KINDS` and fails if a kind
  // is added without a section. A lane extending the vocabulary gives it a home in the same
  // change, which is the only version of this that does not rot -- the catch-all ran 22 kinds
  // deep because a line saying "no group assigned" named a file but never named an owner.
  // Renders last, and collapses with background (see the always-collapse tier below).
  ["ungrouped", []],
];
const GROUP_OF = new Map();
for (const [g, kinds] of GROUPS) for (const k of kinds) GROUP_OF.set(k, g);

// Money is stored in MINOR units (paise); a receipt shows major.minor.
function moneyLine(ev) {
  const p = ev.payload || {};
  if (Number.isInteger(p.amount) && typeof p.currency === "string")
    return `  ${ev.kind}  ${p.currency} ${Math.floor(p.amount / 100)}.${String(p.amount % 100).padStart(2, "0")}  ${ev.venture}`;
  // A release carries no amount -- it points at the reservation it frees. WHO decided nothing
  // was charged is the fact that matters: `policy` and `provider_attested_no_charge` are
  // different claims, and the second rests on a provider's word (ADR-0508). An auditor must be
  // able to tell them apart without a second query.
  if (typeof p.released_on === "string")
    return `  ${ev.kind}  released_on=${p.released_on}  ${ev.venture}`;
  return `  ${ev.kind}`;
}

// An authority change with no pair and no direction on it is a notification, not a receipt.
// Both policy kinds carry (action_kind, capability, from_level, to_level) by validator, so the
// line is total for them.
function authorityLine(ev) {
  const p = ev.payload || {};
  if (typeof p.action_kind === "string" && typeof p.capability === "string")
    return `  ${ev.kind}  ${p.action_kind}/${p.capability}  ${p.from_level} -> ${p.to_level}`;
  return `  ${ev.kind}`;
}

const AUTHORITY_KINDS = new Set(["policy.level.changed", "policy.demoted"]);

// Non-money, non-authority lines are just the kind -- the group and its count are the signal,
// and per-event detail lives in the feed.
function eventLine(ev, group) {
  if (group === "money") return moneyLine(ev);
  if (AUTHORITY_KINDS.has(ev.kind)) return authorityLine(ev);
  return `  ${ev.kind}`;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) throw new SpineError("BAD_ARGS", `unexpected argument "${a}"`);
    const eq = a.indexOf("=");
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const name = a.slice(2);
    if (BOOL_FLAGS.has(name)) { flags[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
    const next = argv[i + 1];
    if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
    flags[name] = next;
    i++;
  }
  return flags;
}

/**
 * THREE KINDS OF DERIVED needs-you LINE now arrive here, from two lanes, and they share one
 * property worth stating once: none of them corresponds to an event, and none of them ever will.
 *
 * `jobLines` (scheduler SCH-F) — silence emits nothing. A job that died writes no receipt, so the
 * only way it can appear in a brief is for the reader to derive it from the schedule against the
 * spine. Only OVERDUE jobs produce a line, so a healthy schedule adds nothing and a lane adding a
 * job to hq.jobs.yaml cannot disturb anybody else's pinned output.
 *
 * `killCrossings` and `killNotice` (ledger REQ-03, ADR-1000) — a crossing is a fact about data the
 * spine already holds, computed at render; recording it would make the meter part of the history it
 * measures. Crossings land in needs-you because a crossing needs a human; a WARNING deliberately
 * does not, because a needs-you that fires before anything has happened trains the reader to skim
 * the one group that must never be skimmed. `killNotice` says the panel could not be evaluated at
 * all, which is the state a moved goalpost produces.
 *
 * All three arrive PRE-COMPUTED so this file does no deriving of its own.
 */
export function render(day, events, torn,
  { full = false, jobLines = [], killCrossings = [], killNotice = null, spendLine = null, feedLines = [] } = {}) {
  // Test-only door; production budget is 40 lines (one screen).
  const budget = Number(process.env.ARC_BRIEF_MAX_LINES || 40);

  const buckets = new Map(GROUPS.map(([g]) => [g, []]));
  for (const e of events) {
    // Fall THROUGH to ungrouped, never skip. The old form was `if (g) push`, and the comment
    // beside it asserted that every closed-vocabulary kind maps to a group -- true when it was
    // written and false the moment ADR-0508 added four.
    buckets.get(GROUP_OF.get(e.event.kind) || "ungrouped").push(e.event);
  }
  const collapsed = new Set();

  // Rendered kill crossings, deterministic by venture then criterion -- the brief is compared
  // byte-for-byte across a rebuild and across engines, so an array's arrival order is not an order.
  const killLines = killCrossings
    .slice()
    .sort((a, b) => (a.venture < b.venture ? -1 : a.venture > b.venture ? 1
      : a.criterion < b.criterion ? -1 : a.criterion > b.criterion ? 1 : 0))
    .map((c) => `  kill line CROSSED  ${c.venture}  ${c.criterion} ${c.value} of ${c.threshold} ${c.unit || ""}`.trimEnd());
  // AN UNEVALUATED PANEL SAYS SO. `arc pnl` already refuses loudly when the criteria file is
  // unreceipted, and this file used to fall back to an empty crossings array on the strength of
  // that -- which only helps someone who runs `arc pnl`. An adversarial pass took a genuinely
  // crossed line, nudged the threshold by one (still crossed), and the daily brief went from
  // naming the crossing to saying nothing at all, exit 0, zero bytes of warning. Moving a goalpost
  // is thus a one-line way to make the alarm stop, on the surface a human actually reads daily.
  //
  // This is arc-pnl's own rule -- ABSENT rows are printed, never dropped -- applied one file over,
  // which is where this lane's twin-fix defects keep being found.
  if (killNotice) killLines.push(`  ${killNotice}`);

  const groupLines = (g) => {
    const evs = buckets.get(g);
    // needs-you may be non-empty on crossings alone. The old guard returned early on zero EVENTS,
    // which would have dropped every crossing on a quiet day -- exactly the day a crossed kill line
    // is most likely to be the only thing that matters.
    // BOTH lanes' derived lines ride here, and both are counted by the head below.
    //
    // They arrived separately: `jobLines` (scheduler) was special-cased down in `assemble`, and
    // `killLines` (ledger) was added here where the count is computed. Neither side knew about the
    // other, so once both were live the head read `needs-you (1)` above three lines -- the exact
    // shared-organ collision `.claude/rules/lanes.md` warns about, and invisible to either lane
    // alone because each one's own tests only ever produce its own kind of line.
    const extra = g === "needs-you" ? [...killLines, ...jobLines.map((l) => `  ${l}`)] : [];
    if (!evs.length && !extra.length) return [];
    if (collapsed.has(g)) {
      // needs-you never collapses, which is the ONLY reason the count branch below can ignore
      // `extra`. Asserted rather than assumed: if a later change ever makes this group collapsible,
      // a crossed kill line would vanish into a count silently, and the group it vanished from is
      // the one the whole budget mechanism exists to protect.
      if (extra.length) throw new Error(`arc-brief: group "${g}" carries ${extra.length} rendered line(s) that are not events and must never be collapsed into a count`);
      const c = new Map();
      for (const ev of evs) c.set(ev.kind, (c.get(ev.kind) || 0) + 1);
      const parts = [...c.keys()].sort().map((k) => `${k} ${c.get(k)}`).join(" · ");
      // Collapsing is a LAYOUT change and never a compression of the instruction. The sentence
      // naming this file is the only way another lane learns it owes its kinds a group, and the
      // generic hint one screen down matches `background` and `progress` by name, so it never
      // reaches here -- both clauses ride on the head instead.
      const tail = g === "ungrouped" ? "  — no group assigned in arc-brief.mjs; --full to expand" : "";
      return [`${g}: ${evs.length} (${parts})${tail}`];
    }
    // The catch-all says why it is not empty. A count under a name nobody recognises is a
    // puzzle; this is an instruction.
    const head = g === "ungrouped"
      ? `ungrouped (${evs.length})  — no group assigned in arc-brief.mjs`
      : `${g} (${evs.length + extra.length})`;
    return [head, ...evs.map((ev) => eventLine(ev, g)), ...extra];
  };

  const assemble = () => {
    const out = [`brief ${day}`];
    for (const [g] of GROUPS) {
      // Derived job lines ride WITH needs-you rather than in a group of their own: a job that
      // has gone silent is the same class of fact as an approval waiting on a human, and giving
      // it a separate heading is how it becomes a section people learn to scroll past.
      //
      // They are folded into `groupLines`' own `extra` now rather than appended here, so the
      // group's head COUNTS them. Appending after the fact is what made the count wrong the moment
      // a second lane started writing into the same group.
      const gl = groupLines(g);
      if (gl.length) out.push("", ...gl);
      // THE DAILY SPEND LINE (REQ-06), under money and only when there is spend. Deliberately NOT
      // folded into groupLines' `extra`: that feeds the group's head COUNT, and this line summarises
      // the very events that count already covers -- it would report one more event than the day
      // holds. `spendLine` is non-null only when a cost.incurred is in the day, so the money group
      // is non-empty by construction; the gl.length guard makes that explicit rather than assumed.
      if (g === "money" && spendLine && gl.length) out.push(spendLine);
    }
    // THE GROWTH FEED LINES (growth REQ-05(c)). Unconditional and OUTSIDE the group buckets, on
    // purpose: this is the only visible readout of a clock that runs whether or not anyone is
    // watching, and a line that appears only when there are receipts cannot report the case that
    // matters most -- that there are none. A stale feed already cost arc five silent days, so the
    // caller re-derives these from the spine on every read and nothing here caches them.
    if (feedLines.length) out.push("", ...feedLines);
    // A damaged line is reported in the brief itself: "the day looks quiet" and "the day is
    // unreadable" must never render the same.
    if (torn.length) out.push("", `UNREADABLE LINES: ${torn.length}`);
    return out;
  };

  let out = assemble();
  if (!full) {
    // background and ungrouped are BOTH noise floors -- ALWAYS a count, never a wall of
    // note.logged lines. progress then collapses too only when the day STILL overflows one
    // screen. needs-you and money always stay expanded.
    //
    // ungrouped joined this tier because the catch-all that stopped kinds vanishing then had no
    // budget of its own: 50 develop/slice receipts on one day rendered a 53-line brief against
    // the 40-line screen, 50 of those lines identical. It had been sitting in the never-collapse
    // tier beside needs-you and money, whose exemption does not transfer -- every one of THEIR
    // lines needs human eyes, and an ungrouped line is a kind waiting for its lane to claim a
    // group. It is also 22 kinds wide, which made it the group most able to bury needs-you: the
    // one group that must never be buried.
    for (const g of ["background", "ungrouped"]) if (buckets.get(g).length) collapsed.add(g);
    if (collapsed.size) out = assemble();
    if (out.length > budget && buckets.get("progress").length) { collapsed.add("progress"); out = assemble(); }
    if (collapsed.size)
      for (let i = 0; i < out.length; i++)
        if (/^(background|progress): \d+ \(/.test(out[i])) { out[i] += "   — --full to expand"; break; }
  }
  return out.join("\n") + "\n";
}

async function main(argv) {
  const flags = parseArgs(argv);
  const day = flags.date ?? dayOf(formatIst(nowMs()));
  // A REAL DAY, not merely the shape. The loose form accepted `2026-13-45` and rendered an empty
  // brief for it at exit 0, so a typo'd date reported a quiet day instead of refusing -- and "the
  // day looks quiet" versus "you asked for a day that does not exist" is exactly the distinction
  // this file's torn-line handling exists to preserve. arc-pnl's --month already refuses the same
  // class; this is its twin, and it was left open.
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!dm) throw new SpineError("BAD_ARGS", `--date "${day}" is not YYYY-MM-DD`);
  const probe = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3])));
  if (probe.getUTCFullYear() !== Number(dm[1]) || probe.getUTCMonth() !== Number(dm[2]) - 1 || probe.getUTCDate() !== Number(dm[3]))
    throw new SpineError("BAD_ARGS", `--date "${day}" is not a real calendar date`);

  const root = spineRoot();
  const { events, torn } = await query(root, { date: day, venture: flags.venture, engine: flags.engine });
  // Kill crossings are scoped to the WHOLE spine, not to `day`: a line crossed on the 3rd is still
  // crossed on the 9th, and a needs-you item that appeared for one day and then went quiet is
  // indistinguishable from one that was dealt with. An unreceipted criteria file yields no panel
  // and therefore no crossings -- the brief says nothing rather than reporting lines it cannot
  // trust, and `arc pnl` is the surface that refuses loudly.
  const panel = await deriveKillPanel(root, { engine: flags.engine });
  const killCrossings = panel.present && panel.receipted ? panel.crossings : [];
  const killNotice = panel.present && !panel.receipted
    ? `kill lines NOT EVALUATED -- ventures.yaml is unreceipted (digest ${panel.digest}); run arc-pnl for the full refusal`
    : null;
  // `.map(r => r.event)` is load-bearing: the reader returns RECORDS, and dailySpend THROWS on a
  // record rather than quietly reporting no spend on a day full of it -- which is the kill-panel
  // scar this lane already has, in the same shape.
  const spendLine = renderSpendLine(dailySpend(events.map((r) => r.event), { day }));

  // The jobs panel is DERIVED, never queried: silence emits nothing, so a job that has gone
  // quiet appears here only because the schedule was read against the spine. Failure to derive
  // it must not take the brief down with it -- a brief that refuses to render because a
  // schedule file is malformed is strictly worse than a brief with no jobs in it, and
  // `jobs-lint` is the gate that makes a malformed schedule loud in the place it belongs.
  let jobLines = [];
  try {
    const jobs = loadJobs(policyRoot());
    if (jobs.length) {
      const { events: runs, observedFrom } = await loadPanelInputs(root, day);
      const rows = derivePanel({ day, jobs, events: runs, observedFrom });
      jobLines = needsYouLines(rows);
    }
  } catch { jobLines = []; }

  // The growth feed line, RE-DERIVED FROM THE SPINE ON EVERY READ (growth REQ-05(c)). Never
  // cached: a cache would mean the line kept saying what was true the last time something wrote
  // it, which is precisely the failure the line exists to prevent. Wrapped like the jobs panel
  // above, and for the same reason -- a brief that refuses to render because one lane's derivation
  // threw is strictly worse than a brief without that lane's line.
  //
  // SILENCE WHEN THERE IS NO FEED. `includeEmpty` is deliberately not passed: a lane whose clock
  // has not started does not get a permanent line in everyone else's brief, inside a renderer with
  // a 40-line one-screen budget. Growth's empty state lives in growth's tracker.
  let growthFeedLines = [];
  try {
    const { feedLines: deriveFeed } = await import("../growth/lib/feed.mjs");
    growthFeedLines = deriveFeed(events, nowMs());
  } catch { growthFeedLines = []; }

  process.stdout.write(render(day, events, torn,
    { full: flags.full === true, jobLines, killCrossings, killNotice, spendLine, feedLines: growthFeedLines }));
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-brief: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
