#!/usr/bin/env node
// policy-promote.mjs -- raise the promotion request for one (kind, capability) pair (face v2 Phase 05 kernel ring,
// ADR-1340; the promotion chain is POL-C, lib/policy/promotion.mjs).
//
//   policy-promote.mjs --kind K --capability C --to L --evidence REF [--what TEXT]
//
// It computes the `approval.requested` payload under the strict `policy.promotion` profile with the policy library's
// own buildPromotionRequest -- from_level folded from the spine, the ceiling and policy_hash read from the CURRENT
// hq.policy.yaml, the trial-ledger citation as given -- has the spine's validator judge it (arc-event --dry-run, which
// writes nothing), and prints the exact emit as its LAST stdout line: {"emit":["emit","approval.requested",...]}. It
// writes nothing itself. The owner's click runs that line; the owner's stamp in the inbox is the decision; the level
// changes only when the decision is applied, and re-derives the ceiling then (a lowered ceiling refuses a stale yes).
//
// hq.policy.yaml is an un-grantable target (ADR-0502): raising a CEILING is a human repo edit, and nothing here -- or
// anywhere in the face -- writes that file. This asks for a level WITHIN the ceiling.
//
// Exit: 0 planned · 2 refused (the library's or the validator's own words).

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePolicyYaml } from "./lib/policy/yaml.mjs";
import { policyRoot } from "./lib/policy/run-gate.mjs";
import { buildPromotionRequest } from "./lib/policy/promotion.mjs";
import { CAPABILITIES, LEVELS } from "./lib/policy/model.mjs";
import { readAll, spineRoot } from "./spine.mjs";
import { isOneLine } from "../core/one-line.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ARC_EVENT = join(HERE, "arc-event.mjs");
const FLAGS = ["--kind", "--capability", "--to", "--evidence", "--what"];

class Stop extends Error {}
function die(msg) { process.stderr.write(`policy-promote: ${msg}\n`); process.exitCode = 2; throw new Stop(); }

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!FLAGS.includes(a)) die(`unknown argument ${JSON.stringify(a)} -- known: ${FLAGS.join(" ")}`);
    if (Object.hasOwn(out, a)) die(`${a} given twice; pick one`);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("--")) die(`${a} needs a value`);
    out[a] = v;
    i++;
  }
  for (const req of ["--kind", "--capability", "--to", "--evidence"]) if (!out[req]) die(`${req} is required`);
  if (!/^(session|process):[a-z][a-z0-9-]{0,63}$/.test(out["--kind"])) die(`--kind ${JSON.stringify(out["--kind"])} is not an action kind (session:NAME or process:NAME)`);
  if (!CAPABILITIES.includes(out["--capability"])) die(`--capability must be one of ${CAPABILITIES.join(", ")}`);
  if (!LEVELS.includes(out["--to"])) die(`--to must be one of ${LEVELS.join(", ")}`);
  for (const k of ["--evidence", "--what"]) if (out[k] !== undefined && !isOneLine(out[k])) die(`${k} is one line of text, with no control or invisible characters`);
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const root = policyRoot();
  let policy;
  try { policy = parsePolicyYaml(readFileSync(join(root, "hq.policy.yaml"), "utf8")); }
  catch (e) { die(`hq.policy.yaml could not be read: ${e?.message || e}`); }
  if (!policy || !policy.kinds || !Object.hasOwn(policy.kinds, a["--kind"])) die(`hq.policy.yaml declares no kind ${a["--kind"]} -- a subject is born by a reviewed edit to that file, not by a promotion`);
  // Every transition on the spine, through the reader: the level the pair is AT is folded, never taken from a form.
  const { events } = await readAll(spineRoot(), "scan");
  let payload;
  try {
    payload = buildPromotionRequest(
      { kind: a["--kind"], capability: a["--capability"], toLevel: a["--to"], trialLedgerRef: a["--evidence"], what: a["--what"] },
      { policy, events: events.map((e) => e.event) },
    );
  } catch (e) { die(e?.message || String(e)); }
  const emit = ["emit", "approval.requested", "--payload", JSON.stringify(payload), "--strict"];
  // The spine's own validator judges the payload before it is offered: a plan the emitter would refuse is a plan that
  // lies about what apply will do.
  const dry = spawnSync(process.execPath, [ARC_EVENT, ...emit, "--dry-run"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (dry.status !== 0) die(`the spine would refuse this request: ${String(dry.stderr || "").trim().split("\n").filter(Boolean)[0] || `exit ${dry.status}`}`);
  process.stdout.write(`policy-promote: ${payload.what}\n`);
  process.stdout.write(`policy-promote: ${payload.action_kind}/${payload.capability} is at ${payload.from_level}; asking for ${payload.to_level}, citing ${payload.trial_ledger_ref}\n`);
  process.stdout.write("policy-promote: the level moves only when you approve this in the inbox and the decision is applied\n");
  process.stdout.write(JSON.stringify({ emit }) + "\n");
}

main().catch((e) => { if (!(e instanceof Stop)) { process.stderr.write(`policy-promote: ${e?.message || e}\n`); process.exitCode = 2; } });
