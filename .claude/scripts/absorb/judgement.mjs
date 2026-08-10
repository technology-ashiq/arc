#!/usr/bin/env node
// judgement.mjs -- the sealed blind A/B (absorb Phase 03, REQ-06 / ADR-0603).
//
// Three subcommands, and the order between them is the whole property:
//   seal    randomize labels, COMMIT to the mapping by hash, print the approval payload
//   reveal  ONLY after a decision.recorded exists -- write the plaintext mapping into the bundle
//   verify  re-derive the mapping and check it hashes to the commitment the owner judged against
//
// WHY A HASH COMMITMENT AND NOT A "SEALED FILE". The Phase 01 attack panel found the first design
// was an honour system: the plaintext mapping sat on disk from the start, and the only control was
// that one code path declined to display it. The owner doing the judging has a filesystem. A
// commit-and-reveal hash makes "sealed" true no matter which door is used to look -- and it is
// stdlib, so A2 (zero deps) holds.
//
// WHERE THE PLAINTEXT LIVES BEFORE THE REVEAL. Not in the bundle -- that is the point. The mapping
// is derived from a random nonce kept in `.claude/state/absorb/seals/`, which is gitignored
// (.gitignore:45) and excluded from sync-to-project. The BUNDLE carries only the commitment, so
// nothing committed to git can reveal the mapping early, and a reviewer reading the bundle before
// the decision learns nothing.
//
// PROPOSE-ONLY (REQ-07). This file writes no registry status. It never marks anything adopted or
// retired; it prepares a question and, afterwards, records the answer's provenance. The decision
// itself is the owner's, recorded through `arc-inbox` on the existing kinds.
//
// Exit codes: 0 done · 2 usage/input error · 3 refused (a reveal before its decision, or a tamper)
//             4 stale preimage format -- RE-SEAL, and explicitly not a tamper.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";
// The pool is owned by the VALIDATOR (no side effects); this script consumes it.
import { LABEL_POOL } from "../hq/lib/validate-absorb.mjs";

// A test-only env door, the same convention ARC_SPINE_ROOT uses. Without it the bats suite would
// write seals into the shared repo state, where two parallel CI shards could collide on one
// correlation and the resealing guard would fire on the wrong run.
const SEAL_DIR = process.env.ARC_ABSORB_SEAL_DIR || join(".claude", "state", "absorb", "seals");
const SUBJECT = "absorb.ab-judgement";
const MIN_FIXTURES = 3;

const die = (msg, code = 2) => { console.error(`judgement: ${msg}`); process.exit(code); };
const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const argv = process.argv.slice(2);
const cmd = argv[0];
function flag(name) {
  const hits = [];
  for (let i = 1; i < argv.length; i++) if (argv[i] === name) hits.push(i);
  if (hits.length === 0) return null;
  if (hits.length > 1) die(`${name} given ${hits.length} times -- an operator error, not a last-wins override`);
  const v = argv[hits[0] + 1];
  if (v === undefined || v.startsWith("--")) die(`${name} needs a value`);
  return v;
}

// THE PREIMAGE MUST BE INJECTIVE, and v1 was not. It joined rows with `\n` and keys to values with
// `=` -- both IN-BAND delimiters over values it never validated. So one preimage string re-parsed as
// several different mappings, and the Phase 03 adversarial pass produced a mapping edited AFTER
// sealing that `verify` reported as **OK**: fold the next sorted row into the previous row's value
// and the bytes are identical. `{L:"a", "L-alt":"S"}` and `{L:"a\nL-alt=S"}` hashed the same.
//
// A non-total encoder in a hash preimage is a collision generator wearing a fix's clothes -- the
// exact lesson docs/retro-log.md records for 2026-08-04 (configHash folding NaN and -Infinity to
// null). Canonical JSON over sorted keys has no in-band delimiter: JSON escapes what would otherwise
// terminate a field, so no value can impersonate structure.
const PREIMAGE_VERSION = "v2";
const preimage = (mapping, nonce) =>
  `absorb.ab-judgement.${PREIMAGE_VERSION}\n` +
  JSON.stringify(Object.keys(mapping).sort().map((k) => [k, mapping[k]])) +
  `\nnonce=${nonce}\n`;

// And the values are validated at the door as well, because a canonical encoder makes a collision
// impossible while a rejected input makes the whole question moot.
const CTRL = new RegExp("[\u0000-\u001f\u007f\u0080-\u009f]");   // C0, DEL and C1 (CSI). Built from a STRING so no control byte is ever written literally into this file -- one was, and grep then read the whole file as binary.
const badVariant = (v) =>
  v === "" ? "is empty"
  : CTRL.test(v) ? "carries a control character"
  : v.includes("=") ? "carries `=`, which was v1's key/value delimiter"
  : null;

// Labels that carry no information about what they label. A label like "old" or "absorbed" is not
// blind, and validate-absorb.mjs refuses those at the spine -- so they are never generated here.


if (cmd === "seal") {
  const candidate = flag("--candidate");
  const variantsArg = flag("--variants");
  const fixturesArg = flag("--fixtures");
  const evidence = flag("--evidence");
  const correlation = flag("--correlation");
  if (!candidate || !variantsArg || !fixturesArg || !evidence || !correlation)
    // The usage string said `name=path,name=path` -- v1's format, which v2 REJECTS with a specific
    // error about `=` being v1's delimiter. So the only documentation of this flag told the caller to
    // do the one thing that cannot work, and the error message assumed the caller had read v1's docs
    // rather than this line. Cost a round trip on the first real seal of the cycle.
    die("usage: judgement.mjs seal --candidate T-NN --variants nameA,nameB --fixtures a,b,c --evidence PATH --correlation ID\n" +
        "       --variants takes variant NAMES only (no paths, no `=`): the seal assigns the blind labels.");

  // Validated BEFORE any join(). `--correlation "../../../../initiatives/absorb/evidence/planoff/LEAK"`
  // wrote the plaintext mapping AND its nonce to a git-TRACKED path, because .gitignore covers
  // `.claude/state/` and one `../` walks straight out of it. Property 1 was breakable by an argument.
  // The grammar also kills an OS-divergent guard: "RUN-9" vs "run-9" collided on win32/darwin and not
  // on linux, and a trailing space quietly made a second seal beside the first.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(correlation))
    die(`--correlation ${JSON.stringify(correlation)} must match [A-Za-z0-9][A-Za-z0-9._-]{0,63} -- it becomes a filename, and a traversal in it writes the plaintext mapping outside the gitignored seal directory`);
  if (!/^T-[0-9]{2,}$/.test(candidate))
    die(`--candidate ${JSON.stringify(candidate)} must be a registry row id in T-NN form -- sealing an unemittable candidate burns the correlation, and the resealing guard then blocks the corrected re-seal`);

  const variants = variantsArg.split(",").map((s) => s.trim()).filter(Boolean);
  if (variants.length < 2) die("--variants needs at least two entries (name=path,name=path)");
  if (variants.length > LABEL_POOL.length)
    die(`${variants.length} variants but only ${LABEL_POOL.length} blind labels exist -- v1 silently DROPPED the extras and then reported the full count on stderr, which is a lie about what was sealed`);
  if (new Set(variants).size !== variants.length)
    die("--variants carries a duplicate -- an A/B against itself would be blessed by a valid receipt");
  for (const v of variants) {
    const why = badVariant(v);
    if (why) die(`--variants entry ${JSON.stringify(v)} ${why}`);
  }
  const fixtures = fixturesArg.split(",").map((s) => s.trim()).filter(Boolean);
  if (new Set(fixtures).size !== fixtures.length)
    die("--fixtures carries a duplicate -- three copies of one fixture is not three representative fixtures (REQ-03)");
  if (fixtures.length < MIN_FIXTURES)
    die(`--fixtures needs at least ${MIN_FIXTURES} entries (REQ-03: the A/B runs on at least ${MIN_FIXTURES} representative fixtures of the target class)`);

  if (existsSync(join(SEAL_DIR, `${correlation}.json`)))
    die(`a seal already exists for correlation "${correlation}" -- resealing would replace the commitment the owner is judging against`);

  // Randomize which label goes to which variant. A shuffled COPY of the pool, so two seals in the
  // same run cannot collide on an ordering.
  const pool = LABEL_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE(0) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const labels = pool.slice(0, variants.length);
  const mapping = {};
  labels.forEach((l, i) => { mapping[l] = variants[i]; });

  const nonce = randomBytes(16).toString("hex");
  const commitment = sha256(preimage(mapping, nonce));

  mkdirSync(SEAL_DIR, { recursive: true });
  writeFileSync(
    join(SEAL_DIR, `${correlation}.json`),
    JSON.stringify({ correlation, candidate, mapping, nonce, commitment, preimage_version: PREIMAGE_VERSION, sealed_at_note: "gitignored state; the bundle carries only the commitment" }, null, 2) + "\n",
    "utf8"
  );

  // The bundle gets the commitment and NOTHING that reveals the mapping.
  const bundle = resolve(evidence);
  mkdirSync(bundle, { recursive: true });
  // A reused bundle would carry the PREVIOUS run's revealed plaintext beside this run's commitment,
  // so a pre-decision bundle would contain a mapping. Test 1 only ever saw a virgin directory.
  if (existsSync(join(bundle, "mapping.json")))
    die(`${evidence} already holds a revealed mapping.json from an earlier judgement -- sealing into it would leave plaintext in a pre-decision bundle`);
  writeFileSync(join(bundle, "commitment.txt"),
    `${commitment}\n\n` +
    `sha256 of the sealed label-to-variant mapping for correlation ${correlation}.\n` +
    `The mapping itself is NOT here and is not in git: it is derived from a nonce under\n` +
    `.claude/state/absorb/seals/ (gitignored), and is written into this bundle as mapping.json\n` +
    `ONLY after a decision.recorded exists for the approval. Run:\n` +
    `  node .claude/scripts/absorb/judgement.mjs reveal --correlation ${correlation} --evidence ${evidence}\n`,
    "utf8");

  // The payload the owner is asked to judge. Printed rather than emitted, because emitting is a
  // separate deliberate act and this file proposes only.
  const payload = { subject: SUBJECT, candidate, fixtures, labels, commitment, evidence_path: evidence, correlation };
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.stderr.write(
    `judgement: sealed ${variants.length} variants as ${labels.join(", ")} -- the mapping is NOT in the bundle.\n` +
    `judgement: emit the payload above as approval.requested, then the owner picks through arc-inbox.\n`
  );
  process.exitCode = 0;
} else if (cmd === "reveal") {
  const correlation = flag("--correlation");
  const evidence = flag("--evidence");
  const decidedBy = flag("--decision");   // the decision.recorded ULID -- LOOKED UP, never trusted
  if (!correlation || !evidence) die("usage: judgement.mjs reveal --correlation ID --evidence PATH --decision ULID");
  if (!decidedBy)
    die("reveal needs --decision: the mapping is revealed ONLY after a decision.recorded exists, because that ordering is the entire property", 3);
  // v1 accepted ANY non-empty string here -- `--decision "no"` and `--decision "I made it up"` both
  // revealed the mapping. So the ordering property was a SELF-DECLARATION, not a check: a reveal
  // before any decision existed needed only the operator to type a word. That is running-defect #8
  // again, the flag added to close a silent skip reintroducing the silence one level up.
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(decidedBy))
    die(`--decision ${JSON.stringify(decidedBy)} is not a ULID -- it must be the id of a real decision.recorded event, and it is looked up rather than believed`, 3);

  const sealPath = join(SEAL_DIR, `${correlation}.json`);
  if (!existsSync(sealPath)) die(`no seal for correlation "${correlation}" at ${sealPath}`);
  let seal;
  try { seal = JSON.parse(readFileSync(sealPath, "utf8")); } catch (e) { die(`seal is unreadable: ${e.message}`); }

  if ((seal.preimage_version || "v1") !== PREIMAGE_VERSION)
    die(`seal "${correlation}" was sealed under preimage ${seal.preimage_version || "v1"} and the current format is ${PREIMAGE_VERSION} -- NOT a tamper, a stale format. Re-seal under a new correlation and re-queue; this approval cannot be revealed`, 4);
  const recomputed = sha256(preimage(seal.mapping, seal.nonce));
  if (recomputed !== seal.commitment)
    die(`the seal does not match its own commitment (${recomputed} vs ${seal.commitment}) -- the mapping changed after sealing, so this judgement proves nothing`, 3);

  const bundle = resolve(evidence);
  const commitFile = join(bundle, "commitment.txt");
  if (!existsSync(commitFile)) die(`no commitment.txt in ${evidence} -- nothing was sealed into this bundle`);
  const published = readFileSync(commitFile, "utf8").split("\n")[0].trim();
  if (published !== seal.commitment)
    die(`the bundle's published commitment (${published}) is not the seal's (${seal.commitment}) -- the owner judged against a different mapping`, 3);

  // ---------- THE DECISION IS LOOKED UP ON THE SPINE ----------
  // This is what turns the ordering property from a claim into a check, and it closes BOTH Phase 03
  // blockers with one lookup: the decision must EXIST, it must decide THIS judgement, and its reason
  // must name a pick. ADR-0603 Amendment 1 said "absorb's chain validates that prefix" and until now
  // nothing did -- the full chain ran green with the reason "looks nicer" and no label ever named.
  const { query } = await import("../hq/spine.mjs");
  const { spineRoot } = await import("../hq/lib/spine-io.mjs");
  const root = spineRoot();

  const decisions = (await query(root, { kind: "decision.recorded" })).events;
  const hit = decisions.find((e) => e.event.id === decidedBy);
  if (!hit)
    die(`decision ${decidedBy} does not exist on the spine at ${root} -- the mapping is revealed only AFTER a real decision, and typing a ULID is not making one`, 3);

  // It must decide THIS judgement, not merely be some decision. Nothing bound the pieces together
  // before: a reveal succeeded against any bundle whose commitment.txt happened to match.
  const approvals = (await query(root, { kind: "approval.requested" })).events;
  const decides = hit.event.payload && hit.event.payload.decides;
  const approval = approvals.find((e) => e.event.id === decides);
  if (!approval)
    die(`decision ${decidedBy} decides ${JSON.stringify(decides)}, which is not an approval.requested on this spine`, 3);
  const ap = approval.event.payload || {};
  if (ap.subject !== SUBJECT)
    die(`decision ${decidedBy} decides an approval whose subject is ${JSON.stringify(ap.subject)}, not ${JSON.stringify(SUBJECT)} -- that is a different gate`, 3);
  if (ap.commitment !== seal.commitment)
    die(`decision ${decidedBy} decides an approval committed to ${ap.commitment}, but this seal's commitment is ${seal.commitment} -- the owner judged a DIFFERENT mapping`, 3);
  if (ap.correlation !== correlation)
    die(`decision ${decidedBy} decides correlation ${JSON.stringify(ap.correlation)}, not ${JSON.stringify(correlation)}`, 3);

  // ADR-0603 Amendment 1: the pick rides in `reason`, prefixed `pick=<label>; `, because
  // assertDecision closes decision.recorded to decides|verdict|reason and a fourth key would widen a
  // contract every lane depends on. The prefix is worth nothing unvalidated, so it is validated here.
  const reason = (hit.event.payload && hit.event.payload.reason) || "";
  const pick = /^pick=(\S+);\s/.exec(reason);
  if (!pick)
    die(`decision ${decidedBy} has reason ${JSON.stringify(reason.slice(0, 60))}, which does not start with "pick=<label>; " -- ADR-0603 requires the winning label to be NAMED in the decision, and a judgement that names no label is a coin flip with a receipt`, 3);
  const picked = pick[1];
  if (!Object.prototype.hasOwnProperty.call(seal.mapping, picked))
    die(`decision ${decidedBy} picked ${JSON.stringify(picked)}, which is not one of this judgement's blind labels (${Object.keys(seal.mapping).join(", ")})`, 3);

  writeFileSync(join(bundle, "mapping.json"),
    JSON.stringify({
      correlation,
      candidate: seal.candidate,
      decided_by: decidedBy,
      decides_approval: decides,
      verdict: hit.event.payload.verdict,
      picked_label: picked,
      picked_variant: seal.mapping[picked],
      commitment: seal.commitment,
      mapping: seal.mapping,
    }, null, 2) + "\n",
    "utf8");
  process.stdout.write(
    `judgement: revealed ${Object.keys(seal.mapping).length} labels into ${evidence}/mapping.json\n` +
    `judgement: decision ${decidedBy} picked ${picked} = ${seal.mapping[picked]}\n`);
  process.exitCode = 0;
} else if (cmd === "verify") {
  const correlation = flag("--correlation");
  if (!correlation) die("usage: judgement.mjs verify --correlation ID");
  const sealPath = join(SEAL_DIR, `${correlation}.json`);
  if (!existsSync(sealPath)) die(`no seal for correlation "${correlation}"`);
  let seal;
  try { seal = JSON.parse(readFileSync(sealPath, "utf8")); } catch (e) { die(`seal is unreadable: ${e.message}`, 3); }
  if (!seal || typeof seal.mapping !== "object" || seal.mapping === null)
    die(`seal for "${correlation}" has no mapping -- it is destroyed, not merely mismatched`, 3);

  // A STALE FORMAT IS NOT A TAMPER, and reporting one as the other is a wrong diagnosis on the most
  // serious message this tool emits. When the Phase 03 adversarial pass proved the v1 preimage was
  // not injective, the fix silently invalidated every seal already outstanding -- including a real
  // queued approval the owner was about to spend a decision on, which `verify` then reported as
  // MISMATCH: "the mapping changed after sealing". It had not. The format had.
  const sealed = seal.preimage_version || "v1";
  if (sealed !== PREIMAGE_VERSION) {
    process.stdout.write(
      `judgement: STALE-FORMAT -- sealed under preimage ${sealed}, current is ${PREIMAGE_VERSION}.\n` +
      `judgement: this is NOT a tamper. The commitment cannot be recomputed under a different format,\n` +
      `judgement: so RE-SEAL under a new correlation and re-queue the approval. Do not spend a\n` +
      `judgement: decision on the old one -- its reveal would refuse.\n`);
    process.exitCode = 4;
  } else {
    const recomputed = sha256(preimage(seal.mapping, seal.nonce));
    const ok = recomputed === seal.commitment;
    process.stdout.write(`judgement: ${ok ? "OK" : "MISMATCH"} -- ${recomputed}${ok ? "" : ` != ${seal.commitment}`}\n`);
    process.exitCode = ok ? 0 : 3;
  }
} else {
  die(`unknown command ${JSON.stringify(cmd)} (seal | reveal | verify)`);
}
