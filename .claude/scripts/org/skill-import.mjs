#!/usr/bin/env node
/**
 * skill-import.mjs -- a public SKILL.md reaches a role only pinned, vetted and on a proposal branch (org Cycle 20
 * Phase 02, REQ-04, ADR-1628).
 *
 *   skill-import.mjs github:OWNER/REPO/PATH/SKILL.md@SHA --role ROLE [--source real|fake] (--dry-run | --expect DIGEST)
 *
 * Fetch (a 40-hex commit pin is mandatory) -> vet (lib/skill-vet.mjs, refuse by default, every failure listed) ->
 * one proposal branch off main holding everything main needs to stay green when it merges:
 *   .claude/skills/NAME/SKILL.md        the bytes exactly as vetted
 *   .claude/skills/NAME/PROVENANCE.md   source, commit, digest of the vetted bytes
 *   org/roles/DEPT/ROLE.role.yaml       binds.skills gains NAME (REQ-09: the seat change and the card, one branch)
 *   products/org/manifest.json          the two files listed, so product-lint maps them
 *   tests/fixtures/sync-golden/...      their two golden lines
 *   initiatives/face/contracts/...      skill:NAME homed in the toolbelt room, and what face-sections derives
 * then approval.requested. The owner's checkout is never touched; nothing merges by itself.
 *
 * Exit 0 planned or written, 1 refused (the skill, the role or main), 2 operator error.
 */
import { realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYamlSubset } from "../engine/yaml-subset.mjs";
import { baseText, checkProposal, mainDirNames, planProposal, proposalBranch, writeProposal } from "../core/proposal-branch.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, emitReceipt } from "../core/plan-expect.mjs";
import { deriveFromContract } from "../core/face-sections.mjs";
import { parseSource, fetchSkill, SourceError } from "./lib/skill-source.mjs";
import { vetSkill } from "./lib/skill-vet.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const FIXTURES = join(REPO, "tests", "fixtures", "org", "skills");
const GOLDEN = "tests/fixtures/sync-golden/tree-manifest.txt";
const CONTRACT = "initiatives/face/contracts/expected-set.json";
const ROOM_COPY = "initiatives/face/contracts/room-copy.json";
const REGISTRY = "initiatives/face/contracts/rooms.generated.json";
const ORG_MANIFEST = "products/org/manifest.json";
const SKILL_ROOM = "toolbelt";
const ROLE_RE = /^[a-z][a-z0-9-]{0,63}$/;

class Stop extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const stop = (code, msg) => { throw new Stop(code, msg); };

export function parseArgs(argv) {
  const a = { source: null, role: null, mode: "real", dryRun: false, expect: undefined };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) stop(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t === "--role" || t === "--source" || t === "--expect") {
      if (seen.has(t)) stop(2, `${t} given twice -- an operator error, never last-wins`);
      seen.add(t);
      const v = argv[i + 1];
      if (v === undefined || v === "" || v.startsWith("-")) stop(2, `${t} needs a value`);
      if (t === "--role") a.role = v; else if (t === "--source") a.mode = v; else a.expect = v;
      i++;
      continue;
    }
    if (t.startsWith("-")) stop(2, `unknown option ${JSON.stringify(t)}`);
    if (a.source !== null) stop(2, "one source per import");
    a.source = t;
  }
  if (a.source === null) stop(2, "usage: skill-import.mjs github:OWNER/REPO/PATH/SKILL.md@SHA --role ROLE (--dry-run | --expect DIGEST)");
  if (!a.role || !ROLE_RE.test(a.role)) stop(2, `--role ${JSON.stringify(a.role)} is not a role id`);
  if (a.mode !== "real" && a.mode !== "fake") stop(2, `--source is real or fake, not ${JSON.stringify(a.mode)}`);
  if (a.dryRun && a.expect !== undefined) stop(2, "--dry-run plans and --expect applies; give one");
  if (!a.dryRun && a.expect === undefined) stop(2, "an import is bound to a plan: run it with --dry-run first, read the diff, then again with the --expect it prints");
  return a;
}

const canonical = (value) => JSON.stringify(value, null, 2) + "\n";
function canonicalJson(path, text) {
  let value;
  try { value = JSON.parse(text); } catch { stop(1, `${path} on main is not JSON`); }
  if (canonical(value) !== text) stop(1, `${path} on main is not in the canonical form the generator writes -- regenerate it first`);
  return value;
}

/** The golden with one line inserted in byte order (LC_ALL=C), as agent-scaffold inserts its own. */
export function addGoldenLine(text, path, content) {
  if (text.startsWith("\uFEFF") || text.includes("\r") || !text.endsWith("\n")) stop(1, "the sync golden on main is not plain LF lines");
  const lines = text.split("\n").filter((l) => l !== "");
  if (lines.some((l) => l.split("\t")[0] === path)) stop(1, `${path} is already in the sync golden`);
  const line = `${path}\t${createHash("sha256").update(content.replace(/\r/g, "")).digest("hex")}`;
  const at = lines.findIndex((l) => Buffer.compare(Buffer.from(l.split("\t")[0]), Buffer.from(path)) > 0);
  if (at < 0) lines.push(line); else lines.splice(at, 0, line);
  return lines.join("\n") + "\n";
}

/**
 * The card with NAME added to binds.skills, by a text splice (comments and order kept), then proven by a re-parse:
 * the only difference from the original is that one list entry.
 */
export function addSkillToCard(raw, name) {
  // BOM and CRLF folded first: a Notepad-saved card spliced to mixed endings (attack bc27378 B6).
  const text = String(raw).replace(/^[\uFEFF]/, "").split("\r\n").join("\n");
  const before = parseYamlSubset(text);
  if (!before.ok || !before.value || !before.value.binds) stop(1, "the role card on main does not parse");
  const skills = Array.isArray(before.value.binds.skills) ? before.value.binds.skills : null;
  if (!skills) stop(1, "the role card has no binds.skills list");
  if (skills.includes(name)) stop(1, `the role already binds the skill ${name}`);
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^ {2}skills:/.test(l));
  if (i < 0) stop(1, "the role card has no `  skills:` line under binds");
  if (/^ {2}skills: \[\]\s*$/.test(lines[i])) lines.splice(i, 1, "  skills:", `    - '${name}'`);
  else {
    let j = i + 1;
    while (j < lines.length && /^ {4}- /.test(lines[j])) j++;
    if (j === i + 1) stop(1, "the role card's binds.skills is in a shape this splice does not understand");
    lines.splice(j, 0, `    - '${name}'`);
  }
  const out = lines.join("\n");
  const after = parseYamlSubset(out);
  const want = JSON.parse(JSON.stringify(before.value));
  want.binds.skills = [...skills, name];
  if (!after.ok || JSON.stringify(after.value) !== JSON.stringify(want)) stop(1, "splicing the skill into the card changed something else -- refusing");
  return out;
}

async function main(argv) {
  const a = parseArgs(argv);
  let src;
  try { src = parseSource(a.source); } catch (e) { if (e instanceof SourceError) stop(1, `${e.code}: ${e.message}`); throw e; }

  // The card, from MAIN's tree: a proposal edits what main holds, never the checkout.
  const depts = await mainDirNames({ repo: REPO, dir: "org/roles" });
  const base = depts.base;
  let cardPath = null, card = null;
  for (const d of depts.names) {
    const r = await baseText({ repo: REPO, path: `org/roles/${d}/${a.role}.role.yaml` });
    if (r.base !== base) stop(1, "main moved while its files were read -- run it again");
    if (r.text !== null) { cardPath = `org/roles/${d}/${a.role}.role.yaml`; card = r.text; break; }
  }
  if (!cardPath) stop(1, `NO_ROLE: no role card ${a.role} on main`);

  let fetched;
  try { fetched = fetchSkill(src, { mode: a.mode, fixtureRoot: FIXTURES }); }
  catch (e) { if (e instanceof SourceError) stop(1, `${e.code}: ${e.message}`); throw e; }

  const skillDirs = await mainDirNames({ repo: REPO, dir: ".claude/skills" });
  const agentFiles = await mainDirNames({ repo: REPO, dir: ".claude/agents" });
  if (skillDirs.base !== base || agentFiles.base !== base) stop(1, "main moved while its files were read -- run it again");
  const taken = [...skillDirs.names, ...agentFiles.names.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3))];
  const v = vetSkill(fetched.text, { taken });
  if (!v.ok) {
    const lines = v.failures.map((f) => `  ${f.code}: ${f.why}`).join("\n");
    stop(1, `REFUSED -- the skill failed ${v.failures.length} condition(s) of the vet (ADR-1628); nothing written:\n${lines}`);
  }
  const name = v.name;
  const skillPath = `.claude/skills/${name}/SKILL.md`;
  const provPath = `.claude/skills/${name}/PROVENANCE.md`;
  const digest = createHash("sha256").update(fetched.text).digest("hex");
  const sourceLine = `github:${src.owner}/${src.repo}/${src.path}@${src.sha}`;
  const provenance = [
    `# ${name} -- provenance`,
    "",
    `- source: ${sourceLine}`,
    `- fetched via: ${fetched.via}`,
    `- sha256 of SKILL.md as vetted: ${digest}`,
    `- vetted by: .claude/scripts/org/lib/skill-vet.mjs (ADR-1628, refuse by default)`,
    `- bound to role: ${a.role}`,
    "",
    "Imported by skill-import.mjs as a proposal. The vet is a pattern list and cannot prove a skill benign; read",
    "SKILL.md before approving.",
    "",
  ].join("\n");

  const [golden, contract, copy, registry] = await Promise.all([GOLDEN, CONTRACT, ROOM_COPY, REGISTRY].map((p) => baseText({ repo: REPO, path: p })));
  for (const r of [golden, contract, copy, registry]) if (r.base !== base) stop(1, "main moved while its files were read -- run it again");
  if (golden.text === null || contract.text === null || copy.text === null) stop(1, "main lacks the sync golden or the face contract");
  const c = canonicalJson(CONTRACT, contract.text);
  const capMap = c.capabilities && c.capabilities.map;
  if (!capMap || typeof capMap !== "object") stop(1, `${CONTRACT} has no capabilities.map`);
  if (Object.hasOwn(capMap, `skill:${name}`)) stop(1, `skill:${name} already has a room in the contract`);
  const seated = { ...c, capabilities: { ...c.capabilities, map: { ...capMap, [`skill:${name}`]: SKILL_ROOM } } };

  const products = await mainDirNames({ repo: REPO, dir: "products" });
  if (products.base !== base) stop(1, "main moved while its files were read -- run it again");
  const manifests = {};
  for (const p of products.names.filter((x) => /^[a-z][a-z0-9-]{0,40}$/.test(x))) {
    const r = await baseText({ repo: REPO, path: `products/${p}/manifest.json` });
    if (r.base !== base) stop(1, "main moved while its files were read -- run it again");
    if (r.text !== null) manifests[p] = r.text;
  }
  if (!manifests.org) stop(1, `${ORG_MANIFEST} is not on main`);
  const om = canonicalJson(ORG_MANIFEST, manifests.org);
  const files0 = Array.isArray(om.files) ? om.files : [];
  if (files0.includes(skillPath)) stop(1, `${ORG_MANIFEST} already lists ${skillPath}`);
  manifests.org = canonical({ ...om, files: [...files0, skillPath, provPath].sort() });
  let copyValue;
  try { copyValue = JSON.parse(copy.text); } catch { stop(1, `${ROOM_COPY} on main is not JSON`); }
  const derived = deriveFromContract(seated, copyValue, manifests);

  let goldenText = addGoldenLine(golden.text, skillPath, fetched.text);
  goldenText = addGoldenLine(goldenText, provPath, provenance);
  const files = [
    { path: skillPath, content: fetched.text },
    { path: provPath, content: provenance },
    { path: cardPath, content: addSkillToCard(card, name) },
    { path: GOLDEN, content: goldenText },
    { path: CONTRACT, content: canonical(seated) },
    ...Object.keys(manifests).filter((p) => p === "org" || Object.hasOwn(derived.manifests, p))
      .map((p) => ({ path: `products/${p}/manifest.json`, content: derived.manifests[p] ?? manifests[p] })),
    ...(registry.text === derived.registryText ? [] : [{ path: REGISTRY, content: derived.registryText }]),
  ];
  const allow = files.map((f) => f.path);
  const branch = proposalBranch("skill-import", name);
  const checked = await checkProposal({ repo: REPO, branch, paths: allow, allow, base });
  if (checked.base !== base) stop(1, "main moved while the import was planned -- run it again");

  const what = `import the skill "${name}" for the role ${a.role}, pinned at commit ${src.sha.slice(0, 12)}`;
  const approval = (commit) => ({ what, gate: "skill-import", adr: "ADR-1628", skill: name, role: a.role, skill_file: skillPath, skill_sha256: digest, branch, base, commit });
  const refused = spineRefusal(ARC_EVENT, "approval.requested", approval("0".repeat(base.length)), { cwd: REPO });
  if (refused) stop(1, `the approval this import raises would be refused by the spine, so nothing is written: ${refused}`);
  const message = `skills: ${what} (a proposal, ADR-1628)\n\nSource ${sourceLine}. Vetted by skill-vet (ToxicSkills threat model); the skill, its provenance, the role card, the org manifest, the sync golden and the face contract with what it derives, so main stays green when this merges.\nWritten by skill-import.`;
  const planned = planDigest({ branch, base, files, message, approval: approval("0".repeat(base.length)) });

  if (a.dryRun) {
    const plan = await planProposal({ repo: REPO, branch, files, allow, base });
    const out = [`skill-import: would ${what}`, `skill-import: ${files.length} files on a new branch ${branch} off main ${base.slice(0, 12)}, then approval.requested`,
      plan.diff.replace(/\n$/, ""), "skill-import: dry run -- no branch, no object, no receipt was written", expectLine(planned)];
    process.stdout.write(out.join("\n") + "\n");
    return 0;
  }
  const stale = staleReason(a.expect, planned);
  if (stale) stop(1, stale);
  const w = await writeProposal({ repo: REPO, branch, files, allow, base, message,
    beforeRef: (commit) => { const no = spineRefusal(ARC_EVENT, "approval.requested", approval(commit), { cwd: REPO }); if (no) stop(1, `the spine would refuse this approval with its real commit, so no branch was written: ${no}`); } });
  process.stdout.write(`skill-import: wrote ${branch} at ${w.commit.slice(0, 12)} off main ${w.base.slice(0, 12)}\n`);
  const got = emitReceipt(ARC_EVENT, "approval.requested", approval(w.commit), { cwd: REPO, timeoutMs: 60_000 });
  if (got.state !== "landed") stop(1, `the branch ${branch} IS written, and its approval ${got.state === "refused" ? "was not raised" : "may not have landed"} -- ${got.why}`);
  if (!got.id) stop(1, `the branch ${branch} IS written, and its approval landed without its id -- ${got.why}`);
  process.stdout.write(`receipt: approval.requested ${got.id}\n`);
  return 0;
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}
if (isMainModule()) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => {
    if (e instanceof Stop) { process.stderr.write(`skill-import: ${e.message}\n`); process.exitCode = e.code; return; }
    process.stderr.write(`skill-import: ${e && e.stack ? e.stack : e}\n`);
    process.exitCode = 2;
  });
}
