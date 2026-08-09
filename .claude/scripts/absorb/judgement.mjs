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
// Exit codes: 0 done · 2 usage/input error · 3 refused (a reveal before its decision).

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { randomBytes, createHash } from "node:crypto";

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

// The canonical preimage. Sorted by LABEL so the same mapping always hashes the same way regardless
// of the order the variants were supplied in -- a commitment that depends on argument order is a
// commitment to nothing.
const preimage = (mapping, nonce) =>
  `absorb.ab-judgement.v1\n` +
  Object.keys(mapping).sort().map((k) => `${k}=${mapping[k]}`).join("\n") +
  `\nnonce=${nonce}\n`;

// Labels that carry no information about what they label. A label like "old" or "absorbed" is not
// blind, and validate-absorb.mjs refuses those at the spine -- so they are never generated here.
const LABEL_POOL = [
  "crimson", "harbor", "lantern", "meridian", "quartz", "thicket",
  "vellum", "zephyr", "cobalt", "fathom", "juniper", "kestrel",
];

if (cmd === "seal") {
  const candidate = flag("--candidate");
  const variantsArg = flag("--variants");
  const fixturesArg = flag("--fixtures");
  const evidence = flag("--evidence");
  const correlation = flag("--correlation");
  if (!candidate || !variantsArg || !fixturesArg || !evidence || !correlation)
    die("usage: judgement.mjs seal --candidate T-NN --variants name=path,name=path --fixtures a,b,c --evidence PATH --correlation ID");

  const variants = variantsArg.split(",").map((s) => s.trim()).filter(Boolean);
  if (variants.length < 2) die("--variants needs at least two entries (name=path,name=path)");
  const fixtures = fixturesArg.split(",").map((s) => s.trim()).filter(Boolean);
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
    JSON.stringify({ correlation, candidate, mapping, nonce, commitment, sealed_at_note: "gitignored state; the bundle carries only the commitment" }, null, 2) + "\n",
    "utf8"
  );

  // The bundle gets the commitment and NOTHING that reveals the mapping.
  const bundle = resolve(evidence);
  mkdirSync(bundle, { recursive: true });
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
  const decidedBy = flag("--decision");   // the decision.recorded ULID, or a path to proof of it
  if (!correlation || !evidence) die("usage: judgement.mjs reveal --correlation ID --evidence PATH --decision ULID");
  if (!decidedBy)
    die("reveal needs --decision: the mapping is revealed ONLY after a decision.recorded exists, because that ordering is the entire property", 3);

  const sealPath = join(SEAL_DIR, `${correlation}.json`);
  if (!existsSync(sealPath)) die(`no seal for correlation "${correlation}" at ${sealPath}`);
  let seal;
  try { seal = JSON.parse(readFileSync(sealPath, "utf8")); } catch (e) { die(`seal is unreadable: ${e.message}`); }

  const recomputed = sha256(preimage(seal.mapping, seal.nonce));
  if (recomputed !== seal.commitment)
    die(`the seal does not match its own commitment (${recomputed} vs ${seal.commitment}) -- the mapping changed after sealing, so this judgement proves nothing`, 3);

  const bundle = resolve(evidence);
  const commitFile = join(bundle, "commitment.txt");
  if (!existsSync(commitFile)) die(`no commitment.txt in ${evidence} -- nothing was sealed into this bundle`);
  const published = readFileSync(commitFile, "utf8").split("\n")[0].trim();
  if (published !== seal.commitment)
    die(`the bundle's published commitment (${published}) is not the seal's (${seal.commitment}) -- the owner judged against a different mapping`, 3);

  writeFileSync(join(bundle, "mapping.json"),
    JSON.stringify({ correlation, candidate: seal.candidate, decided_by: decidedBy, commitment: seal.commitment, mapping: seal.mapping }, null, 2) + "\n",
    "utf8");
  process.stdout.write(`judgement: revealed ${Object.keys(seal.mapping).length} labels into ${evidence}/mapping.json (decision ${decidedBy})\n`);
  process.exitCode = 0;
} else if (cmd === "verify") {
  const correlation = flag("--correlation");
  if (!correlation) die("usage: judgement.mjs verify --correlation ID");
  const sealPath = join(SEAL_DIR, `${correlation}.json`);
  if (!existsSync(sealPath)) die(`no seal for correlation "${correlation}"`);
  const seal = JSON.parse(readFileSync(sealPath, "utf8"));
  const recomputed = sha256(preimage(seal.mapping, seal.nonce));
  const ok = recomputed === seal.commitment;
  process.stdout.write(`judgement: ${ok ? "OK" : "MISMATCH"} -- ${recomputed}${ok ? "" : ` != ${seal.commitment}`}\n`);
  process.exitCode = ok ? 0 : 3;
} else {
  die(`unknown command ${JSON.stringify(cmd)} (seal | reveal | verify)`);
}
