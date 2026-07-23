#!/usr/bin/env node
// arc-inbox -- approvals are receipts too (REQ-06).
//
// SPINE-G (ADR-0030): this is a reader-only consumer. The OPEN set is recomputed on every run
// by folding decision.recorded onto approval.requested THROUGH the spine reader -- no approval
// state is stored anywhere but the spine, so a wiped derived index (REQ-04) rebuilds to the
// same inbox. Decisions are WRITTEN only through arc-event, the one writer; this file never
// opens events/*.jsonl or state.db, which is what REQ-09's grep-lint checks.
//
// Usage:
//   arc-inbox inbox                       # list OPEN approvals (approval.requested, undecided)
//   arc-inbox approve <ULID> --reason R   # record decision.recorded verdict=approve
//   arc-inbox reject  <ULID> --reason R   # record decision.recorded verdict=reject

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SpineError, ULID_RE, sha256Hex } from "./lib/canonical.mjs";
import { spineRoot } from "./lib/spine-io.mjs";
import { query } from "./spine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = join(HERE, "arc-event.mjs");

// The idem of a decision is keyed on the approval it DECIDES, never on its reason. arc-event
// folds the reason into its derived idem (arc-event.mjs), so a different-reason second
// decision, a concurrent double-decide, or a replay after the derived index was wiped would
// otherwise slip through as a distinct event. This stable key makes any second decision on the
// same approval collide as DUP_IDEM -- the backstop behind the read-check below.
const decisionIdem = (approvalId) => sha256Hex(`decision.recorded|${approvalId}`);

async function loadApprovals(root) {
  // Two reads through the ONLY public API, across all days, in append order.
  const requested = (await query(root, { kind: "approval.requested" })).events;
  const decided = (await query(root, { kind: "decision.recorded" })).events;
  const decidedIds = new Set(decided.map((e) => e.event.payload && e.event.payload.decides));
  return { requested, decidedIds };
}

async function listInbox(root) {
  const { requested, decidedIds } = await loadApprovals(root);
  const open = requested.filter((e) => !decidedIds.has(e.event.id));
  if (!open.length) { process.stderr.write("inbox: no open approvals\n"); return 0; }
  for (const e of open) {
    const p = e.event.payload || {};
    const what = typeof p.what === "string" ? p.what : "";
    const gate = typeof p.gate === "string" ? p.gate : "?";
    process.stdout.write(`${e.event.id}  ${what}  (${gate})  ${e.event.venture}\n`);
  }
  return 0;
}

async function decide(root, verdict, id, reason) {
  if (typeof id !== "string" || !ULID_RE.test(id))
    throw new SpineError("BAD_ARGS", `<id> ${JSON.stringify(id)} is not a ULID`);
  if (typeof reason !== "string" || reason.length === 0)
    throw new SpineError("BAD_ARGS", `${verdict} needs a non-empty --reason`);

  const { requested, decidedIds } = await loadApprovals(root);
  const approval = requested.find((e) => e.event.id === id);
  if (!approval) {
    // Name the mistake: an id that exists but is the wrong kind is a caller error worth a
    // distinct message, not a silent "unknown".
    const any = (await query(root, {})).events.find((e) => e.event.id === id);
    if (any) throw new SpineError("WRONG_KIND", `${id} is a ${any.event.kind}, not an approval.requested`);
    throw new SpineError("UNKNOWN_APPROVAL", `${id} is not an approval on this spine`);
  }
  if (decidedIds.has(id))
    throw new SpineError("ALREADY_DECIDED", `${id} already has a decision -- decisions are final (supersede on a new day if truly needed)`);

  const payload = JSON.stringify({ decides: id, reason, verdict });
  // The one writer, strict. A malformed decision (assertDecision) or a decision lost to a
  // concurrent decider -- which lands as DUP_IDEM on the shared key above -- exits non-zero,
  // and we surface it rather than pretend the decision was recorded.
  try {
    execFileSync(process.execPath, [
      ARC_EVENT, "emit", "decision.recorded",
      "--payload", payload,
      "--idem", decisionIdem(id),
      "--venture", approval.event.venture,
      "--process", "arc-inbox@1.0.0",
      "--strict",
    ], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    const stderr = e.stderr ? e.stderr.toString().trim() : "";
    throw new SpineError("DECISION_REFUSED", stderr || `arc-event refused the decision (exit ${e.status})`);
  }
  process.stderr.write(`inbox: ${verdict} recorded for ${id}\n`);
  return 0;
}

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const name = a.slice(2);
      if (name !== "reason") throw new SpineError("BAD_ARGS", `unknown flag --${name}`);
      const next = argv[i + 1];
      if (next === undefined) throw new SpineError("BAD_ARGS", `flag --${name} needs a value`);
      flags[name] = next; i++; continue;
    }
    positional.push(a);
  }
  return { positional, flags };
}

async function main(argv) {
  const { positional, flags } = parse(argv);
  const command = positional[0] || "inbox";
  const root = spineRoot();
  if (command === "inbox") return listInbox(root);
  if (command === "approve" || command === "reject")
    return decide(root, command, positional[1], flags.reason);
  throw new SpineError("BAD_ARGS", `unknown command ${JSON.stringify(command)} (inbox | approve <id> --reason R | reject <id> --reason R)`);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    const code = err instanceof SpineError ? err.code : "INTERNAL";
    process.stderr.write(`arc-inbox: ERROR ${code} -- ${err.message}\n`);
    process.exit(2);
  });
