// rehearsal-check.mjs — "will the rehearsal see the five people I put in .env.local?"
//
// This exists because the runbook's version of this check was a shell one-liner, and a shell
// one-liner cannot answer that question. Three separate reasons, each of which was a real
// finding against the document:
//
//  1. IT RESOLVED A DIFFERENT FACT. The one-liner read the FILE (`env: {}`); the send reads the
//     file into `process.env`, where ENV-WINS-OVER-FILE. An operator with a stale
//     ARC_LEADS_REHEARSAL_ALLOWLIST exported in the shell — which is exactly what running the
//     PREVIOUS version of runbook step 1 leaves behind — was told `entries: 5` while the send
//     resolved the one stale address. One fact derived two ways, in the fix for a defect whose
//     name is one fact derived two ways.
//  2. IT WAS A THIRD PARSER OF ADDRESSES. Its shape test was a regex far stricter than
//     `isAddressShaped`, and its duplicate test lower-cased where the store uses `normalizeEmail`
//     (NFC + zero-width strip). Both directions were reproducible: a list containing a
//     zero-width-space twin reported `duplicates: 0` against a real lock of 4, and a valid
//     single-label domain reported `all address-shaped: false` against a real lock of 5.
//  3. IT DID NOT RUN ON THE OPERATOR'S SHELL. PowerShell 5.1 legacy native-argument passing
//     strips the double quotes out of `node -e '...'` and splits on the spaces inside them.
//
// So the check is a FILE, invoked as `node <path>` — identical in bash, Git Bash and PowerShell
// — and every number in it comes from the same functions the send path uses. If this disagrees
// with the send, the bug is in one of those functions and both will be wrong together, which is
// the only honest kind of check.
//
// IT PRINTS NO ADDRESS, ever. Counts and booleans only (ADR-0410): the whole point of the file
// it reads is that its contents do not travel, and this output is meant to be pasted into an
// evidence bundle.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, EnvError, ENV_LOCAL } from "./lib/env.mjs";
import { assertEnvLocalNames } from "./lib/mail.mjs";
import { rehearsalMode, rehearsalRecipients, REHEARSAL_ALLOWLIST_VAR } from "./lib/preflight.mjs";
import { normalizeEmail } from "./lib/store.mjs";

// The repo root is derived from THIS file's location, not from the working directory, so the
// check answers the same way from anywhere. `cmdDaily` anchors on the same root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// A COPY of process.env, resolved exactly as `cmdDaily` resolves it: the file fills in what the
// environment has not already set. Copied rather than used directly so a check can never leave
// the process it ran in holding credentials it did not have before.
const env = { ...process.env };
let info;
try {
  info = loadEnvLocal({ root: REPO_ROOT, env });
} catch (e) {
  console.error(`rehearsal-check: ${e instanceof EnvError ? e.message : e.message}`);
  process.exit(2);
}

console.log(`${ENV_LOCAL}: ${info.present ? "present" : "ABSENT"} at ${info.path}`);
if (info.present && info.skipped.length)
  console.log(`  line(s) ${info.skipped.join(", ")} are not NAME=value and were skipped`);
if (info.present && info.blank.length)
  console.log(`  declared with an empty value (counts as unset): ${info.blank.join(", ")}`);

// The same refusal `daily` applies. A file naming a test door is a refusal here too, so the
// operator finds out at the check rather than at the send.
try {
  assertEnvLocalNames(info.names || [], ENV_LOCAL);
  console.log("  forbidden-name guard: PASS");
} catch (e) {
  console.error(`  forbidden-name guard: REFUSED — ${e.message}`);
  process.exit(2);
}

const mode = rehearsalMode(env);
const recipients = rehearsalRecipients(env, REHEARSAL_ALLOWLIST_VAR);
// `normalizeEmail` is the store's definition of address identity — the one `leadId` hashes — so
// two entries that collapse to one person are counted as one here too.
const distinct = new Set(recipients.map((a) => normalizeEmail(a)));

// WHERE the value came from, because that is the question a stale export makes urgent. The file
// declared it; the environment may have overridden it; `applied` tells us which.
const fromFile = (info.names || []).includes(REHEARSAL_ALLOWLIST_VAR);
const wasApplied = (info.applied || []).includes(REHEARSAL_ALLOWLIST_VAR);
const source = wasApplied ? ENV_LOCAL : (fromFile ? "the ENVIRONMENT (it overrode the file)" : "the ENVIRONMENT (the file does not declare it)");

console.log("");
console.log(`${REHEARSAL_ALLOWLIST_VAR} resolved from: ${source}`);
console.log(`  entries the send will use : ${recipients.length}`);
console.log(`  distinct people           : ${distinct.size}`);
console.log(`ARC_LEADS_REHEARSAL declared: ${mode.declared}`);
console.log(`rehearsal mode locked       : ${mode.locked}  (count ${mode.count})`);

const problems = [];
if (!mode.declared) problems.push("ARC_LEADS_REHEARSAL is not 1 in THIS shell — the mode is deliberately not a file setting, so export it here");
if (!recipients.length) problems.push(`${REHEARSAL_ALLOWLIST_VAR} resolves to no address-shaped entry — every send will refuse`);
if (recipients.length !== distinct.size) problems.push(`${recipients.length - distinct.size} entr(y/ies) collapse to a person already on the list`);
if (fromFile && !wasApplied) problems.push(`the environment is overriding ${ENV_LOCAL} — a value exported earlier in this shell is what the send will use, NOT what you just edited into the file`);

// THE CAMPAIGN NAME, CHECKED IN THE SAME COMMAND, because it is the same class of failure and
// it was the other document-level CRITICAL. `research` takes the campaign from the ICP FILE and
// `draft`/`daily` take it from argv, and nothing compared them — so a walk with two different
// names reported success at every step and answered the phase's one question with
// "Campaign(s) with receipts: (none)", exit 2, after every irreversible act. Optional, because
// the allowlist half of this check is useful before an ICP file exists.
const argIcp = process.argv.indexOf("--icp");
const argCampaign = process.argv.indexOf("--campaign");
if (argIcp !== -1 || argCampaign !== -1) {
  console.log("");
  if (argIcp === -1 || argCampaign === -1) {
    console.error("rehearsal-check: --icp and --campaign are checked against each other, so pass both or neither");
    process.exit(2);
  }
  const icpPath = process.argv[argIcp + 1];
  const wanted = process.argv[argCampaign + 1];
  let icpCampaign;
  try {
    const { readFileSync } = await import("node:fs");
    icpCampaign = JSON.parse(readFileSync(icpPath, "utf8")).campaign;
  } catch (e) {
    console.error(`rehearsal-check: could not read a campaign out of ${icpPath} — ${e.message}`);
    process.exit(2);
  }
  console.log(`campaign in ${icpPath} : ${JSON.stringify(icpCampaign)}`);
  console.log(`campaign you will type  : ${JSON.stringify(wanted)}`);
  // Compared as EXACT strings. The filesystem is case-insensitive on two of the three CI legs
  // and the spine is not, which is the whole reason a mismatch survived a full walk.
  if (icpCampaign !== wanted)
    problems.push(`the ICP file says ${JSON.stringify(icpCampaign)} and you are about to type ${JSON.stringify(wanted)} — research would file its receipts under one name and the approvals and the report would use the other`);
  else if (!/^[a-z0-9-]{1,64}$/.test(String(wanted)))
    problems.push(`${JSON.stringify(wanted)} is not [a-z0-9-]{1,64} — the CLI refuses it, and "|" is the idem delimiter`);
  else console.log("campaign agreement      : PASS");
}

if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`rehearsal-check: PROBLEM — ${p}`);
  process.exit(2);
}
console.log("");
console.log("rehearsal-check: OK");
