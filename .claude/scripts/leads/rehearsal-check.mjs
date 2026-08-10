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
import { CAMPAIGN_NAME_RE } from "./lib/drafts.mjs";

// The repo root is derived from THIS file's location, not from the working directory, so the
// check answers the same way from anywhere. `cmdDaily` anchors on the same root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

// `process.env` ITSELF, not a copy — and the copy was a CRITICAL of exactly the kind this file
// was written to prevent.
//
// On Windows `process.env` is case-INsensitive; a spread copy of it is a plain object and is
// case-sensitive. Verified on this box: set `zz_low_test`, and `process.env.ZZ_LOW_TEST` reads
// `"v"` while `{...process.env}.ZZ_LOW_TEST` reads `undefined`. `cmdDaily` passes the real
// `process.env`, so a stale allowlist exported under any other casing was invisible to this
// check and decisive for the send — the check printing `entries: 5, OK` while the send resolved
// one stale address, which is the sentence in this file's own header. One fact derived two
// ways, reintroduced by the defensive copy meant to avoid a side effect.
//
// The side effect the copy was avoiding does not matter here: this is a short-lived process
// whose only job is to report, it exits immediately after, and mutating its own environment is
// precisely what `cmdDaily` does. Being wrong the same way the send is wrong is the whole point.
const env = process.env;
let info;
try {
  info = loadEnvLocal({ root: REPO_ROOT });
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
// THE RAW ENTRIES ARE COUNTED FROM THE VARIABLE, not from the resolved list — a threshold that
// compares a de-duplicated list against itself can never fire (D3), and the first version did
// exactly that: `loadAllowlist` already builds a `Set` over `normalizeEmail`, so
// `recipients.length !== distinct.size` was provably always false and the runbook documented an
// output the script could not emit. Five typed entries containing a case twin and a zero-width
// twin printed `entries 3, distinct 3, OK`.
//
// `normalizeEmail` is the store's definition of address identity — the one `leadId` hashes — so
// two typed entries that collapse to one person are visible as the collapse they are.
const typed = String(env[REHEARSAL_ALLOWLIST_VAR] || "").split(",").map((s) => s.trim()).filter(Boolean);
const distinct = new Set(recipients.map((a) => normalizeEmail(a)));

// WHERE the value came from, because that is the question a stale export makes urgent. The file
// declared it; the environment may have overridden it; `applied` tells us which.
// THREE STATES, NOT TWO. A name that is declared but NOT applied has two completely different
// causes, and reporting the wrong one sends the operator to the wrong place: the environment
// may have overridden the file, or the file may simply have left it EMPTY (`loadEnvLocal`
// classifies a blank as `blank` and never applies it). The first version reported "a value
// exported earlier in this shell is what the send will use" to an operator whose file said
// `ARC_LEADS_REHEARSAL_ALLOWLIST=` and whose shell held nothing at all. D2.
const fromFile = (info.names || []).includes(REHEARSAL_ALLOWLIST_VAR);
const isBlank = (info.blank || []).includes(REHEARSAL_ALLOWLIST_VAR);
const wasApplied = (info.applied || []).includes(REHEARSAL_ALLOWLIST_VAR);
const overridden = fromFile && !wasApplied && !isBlank;
// FOUR STATES. The comment above said three and the code had three, and the missing one is the
// ORDINARY STARTING STATE: nothing in the file and nothing in the environment. It fell through
// to "the ENVIRONMENT (the file does not declare it)", which the runbook maps to the strongest
// instruction in the whole document — "stop, your addresses went through your shell history" —
// told to an operator on a fresh clone who has set nothing anywhere. A check whose header says
// reporting the wrong cause sends the operator to the wrong place did exactly that.
const setNowhere = !fromFile && (env[REHEARSAL_ALLOWLIST_VAR] === undefined || env[REHEARSAL_ALLOWLIST_VAR] === "");
const source = wasApplied
  ? ENV_LOCAL
  : isBlank
    ? `${ENV_LOCAL} declares it EMPTY, so it counts as unset`
    : setNowhere
      ? "NOWHERE — it is not in the file and not in this shell"
      : fromFile
        ? "the ENVIRONMENT (it overrode the file)"
        : "the ENVIRONMENT (the file does not declare it)";

console.log("");
console.log(`${REHEARSAL_ALLOWLIST_VAR} resolved from: ${source}`);
console.log(`  entries you typed         : ${typed.length}`);
console.log(`  entries the send will use : ${recipients.length}`);
console.log(`  distinct people           : ${distinct.size}`);
console.log(`ARC_LEADS_REHEARSAL declared: ${mode.declared}`);
console.log(`rehearsal mode locked       : ${mode.locked}  (count ${mode.count})`);

const problems = [];
if (!mode.declared) problems.push("ARC_LEADS_REHEARSAL is not 1 in THIS shell — the mode is deliberately not a file setting, so export it here");
if (!recipients.length) problems.push(`${REHEARSAL_ALLOWLIST_VAR} resolves to no address-shaped entry — every send will refuse`);
if (typed.length !== distinct.size) problems.push(`you typed ${typed.length} entr(y/ies) and the send resolves ${distinct.size} distinct person(s) — the difference is entries that collapsed together (a case or zero-width twin) or that are not address-shaped. You have ${distinct.size} recipients, not ${typed.length}`);
if (overridden) problems.push(`the environment is overriding ${ENV_LOCAL} — a value exported earlier in this shell is what the send will use, NOT what you just edited into the file`);
if (isBlank) problems.push(`${ENV_LOCAL} declares ${REHEARSAL_ALLOWLIST_VAR} with an empty value — that counts as unset, so fill it in rather than looking for an override`);
if (setNowhere) problems.push(`${REHEARSAL_ALLOWLIST_VAR} is set nowhere — add it to ${ENV_LOCAL} with the five addresses. This is the first-run state, not a leak: nothing has gone through your shell history`);

// THE CAMPAIGN NAME, CHECKED IN THE SAME COMMAND, because it is the same class of failure and
// it was the other document-level CRITICAL. `research` takes the campaign from the ICP FILE and
// `draft`/`daily` take it from argv, and nothing compared them — so a walk with two different
// names reported success at every step and answered the phase's one question with
// "Campaign(s) with receipts: (none)", exit 2, after every irreversible act. Optional, because
// the allowlist half of this check is useful before an ICP file exists.
// PARSED AS A CONSUMING LOOP, not by scanning for each flag independently. `cmdMail`,
// `cmdReport` and `cmdIngestReply` were each rewritten from `indexOf` into exactly this shape
// after it shipped a bug three times, and the comment on the first of them calls the scan "D5
// in miniature": `--icp --campaign walk` makes the scan for `--icp` return the NEXT FLAG as its
// value, and an unknown flag, a duplicate or a bare positional is silently ignored. A new
// operator-facing file is not the place to reintroduce it.
let icpPath = null, wanted = null;
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = (name) => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith("--")) {
        console.error(`rehearsal-check: ${name} needs a value`);
        process.exit(2);
      }
      i++;
      return v;
    };
    if (a === "--icp") {
      if (icpPath !== null) { console.error("rehearsal-check: --icp was given twice"); process.exit(2); }
      icpPath = take("--icp");
    } else if (a === "--campaign") {
      if (wanted !== null) { console.error("rehearsal-check: --campaign was given twice"); process.exit(2); }
      wanted = take("--campaign");
    } else {
      console.error(`rehearsal-check: unexpected argument ${JSON.stringify(a)} — this takes --icp <path> and --campaign <name>, or nothing`);
      process.exit(2);
    }
  }
}
if (icpPath !== null || wanted !== null) {
  console.log("");
  if (icpPath === null || wanted === null) {
    console.error("rehearsal-check: --icp and --campaign are checked against each other, so pass both or neither");
    process.exit(2);
  }
  let icpCampaign;
  try {
    const { readFileSync } = await import("node:fs");
    icpCampaign = JSON.parse(readFileSync(icpPath, "utf8")).campaign;
  } catch (e) {
    // THE ERROR IS CLASSIFIED, NEVER INTERPOLATED. Node's `JSON.parse` message quotes the input
    // it choked on — so pointing `--icp` at a corpus file printed a lead's address into the
    // terminal and into any log that captured it, and the only thing standing between that and
    // ADR-0410 was Node's truncation width. This file's own header promises it prints no
    // address, ever; that promise cannot be delegated to another program's error formatting.
    const why = e && e.code === "ENOENT" ? "no such file"
      : e && e.code ? `unreadable (${e.code})`
      : "it is not valid JSON, or it has no top-level \"campaign\" field";
    console.error(`rehearsal-check: could not read a campaign out of ${icpPath} — ${why}`);
    process.exit(2);
  }
  console.log(`campaign in ${icpPath} : ${JSON.stringify(icpCampaign)}`);
  console.log(`campaign you will type  : ${JSON.stringify(wanted)}`);
  // Compared as EXACT strings. The filesystem is case-insensitive on two of the three CI legs
  // and the spine is not, which is the whole reason a mismatch survived a full walk.
  if (icpCampaign !== wanted)
    problems.push(`the ICP file says ${JSON.stringify(icpCampaign)} and you are about to type ${JSON.stringify(wanted)} — research would file its receipts under one name and the approvals and the report would use the other`);
  // The grammar is checked ALWAYS, not only when the two names agree: a mismatched pair whose
  // intended name is also ungrammatical would otherwise be reported as one problem and hit the
  // second at the CLI. And the regex is IMPORTED, so this can never bless a name the CLI refuses.
  if (!CAMPAIGN_NAME_RE.test(String(wanted)))
    problems.push(`${JSON.stringify(wanted)} is not [a-z0-9-]{1,64} — every leads command refuses it, and "|" is the idem delimiter`);
  if (icpCampaign === wanted && CAMPAIGN_NAME_RE.test(String(wanted))) console.log("campaign agreement      : PASS");
}

if (problems.length) {
  console.error("");
  for (const p of problems) console.error(`rehearsal-check: PROBLEM — ${p}`);
  process.exit(2);
}
console.log("");
console.log("rehearsal-check: OK");
