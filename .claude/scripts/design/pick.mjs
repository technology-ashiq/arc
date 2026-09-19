#!/usr/bin/env node
// pick.mjs -- record the owner's pick of an explore's variant, as an approval (face v2 Phase 05 factory ring, ADR-1341 §5).
//
//   pick.mjs --explore <id> --pick a|b|c --why TEXT [--dry-run | --expect D]
//
// Explore mode ends in "owner pick" (design-explore.sh's own header), and the pick was a hand-written PICK.md. This
// tool checks the explore is on this checkout with its three variants, that no pick was recorded for it before (a
// PICK.md, or a design-pick approval on the spine), and raises approval.requested {gate: design-pick, explore, pick,
// why}. Your stamp in the inbox is the pick. It writes no file.
//
//   --dry-run   the approval it would raise, judged by the spine, and as its LAST line the digest an apply is bound to:
//               the approval AND the variants' bytes, so a variant rebuilt between the plan and the click is a stale plan
//   --expect D  raises it only if that digest still holds (PLAN_STALE otherwise)
//   (neither)   refused: an apply is bound to a plan
//
// Exit: 0 done · 1 the approval's write is in doubt (said so) · 2 refused, nothing raised.

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, writeSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isOneLine } from "../core/one-line.mjs";
import { planDigest, expectLine, staleReason, spineRefusal, withExclusiveLock, emitReceipt } from "../core/plan-expect.mjs";
import { query } from "../hq/spine.mjs";
import { spineRoot } from "../hq/lib/spine-io.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const ARC_EVENT = join(REPO, ".claude", "scripts", "hq", "arc-event.mjs");
const VARIANTS = Object.freeze(["a", "b", "c"]);
// design-explore.sh's own id grammar: lowercase kebab, spelled out rather than a locale range.
const ID_RE = /^[abcdefghijklmnopqrstuvwxyz0123456789-]{1,64}$/;
const MAX_VARIANT_BYTES = 8 * 1024 * 1024;

class Stop extends Error {}
const out = [];
const say = (s) => out.push(s);
function die(code, msg) { process.stderr.write(`pick: ${msg}\n`); process.exitCode = code; throw new Stop(); }

function parseArgs(argv) {
  const a = { explore: "", pick: "", why: "", expect: undefined, dryRun: false };
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--dry-run") { if (a.dryRun) die(2, "--dry-run given twice"); a.dryRun = true; continue; }
    if (t.startsWith("--dry-run=")) die(2, `--dry-run takes no value; write it bare, not ${t}`);
    if (!["--explore", "--pick", "--why", "--expect"].includes(t)) die(2, `unknown argument ${JSON.stringify(t)} -- known: --explore --pick --why --expect --dry-run`);
    if (seen.has(t)) die(2, `${t} given twice; pick one`);
    seen.add(t);
    const v = argv[i + 1];
    if (v === undefined || v === "" || v.startsWith("-")) die(2, `${t} needs a value`);
    a[t.slice(2)] = v;
    i++;
  }
  if (a.dryRun && a.expect !== undefined) die(2, "--dry-run plans and --expect applies; give one");
  if (!ID_RE.test(a.explore)) die(2, `--explore ${JSON.stringify(a.explore)} is an explore id (lowercase kebab)`);
  if (!VARIANTS.includes(a.pick)) die(2, `--pick is one of ${VARIANTS.join(", ")}`);
  if (!a.why) die(2, "--why is required: a pick carries its reason");
  if (!isOneLine(a.why)) die(2, "--why is one line of text, with no control or invisible characters");
  return a;
}

/**
 * A variant's bytes, fingerprinted: every regular file under it, by relative path and sha256, in a fixed order. A link
 * is refused rather than followed -- a variant is files the composer wrote.
 * @param {string} dir
 */
function fingerprint(dir) {
  const rows = [];
  let bytes = 0;
  const walk = (d, rel) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      const st = lstatSync(p);
      const r = rel ? `${rel}/${n}` : n;
      if (st.isSymbolicLink()) die(2, `${r} in ${dir.slice(REPO.length + 1)} is a link -- a variant is files the composer wrote`);
      if (st.isDirectory()) { walk(p, r); continue; }
      if (!st.isFile()) continue;
      bytes += st.size;
      if (bytes > MAX_VARIANT_BYTES) die(2, `${dir.slice(REPO.length + 1)} is past ${MAX_VARIANT_BYTES} bytes -- not a variant this tool fingerprints`);
      rows.push(`${r}\t${createHash("sha256").update(readFileSync(p)).digest("hex")}`);
    }
  };
  walk(dir, "");
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const ex = join(REPO, "docs", "design", "explore", a.explore);
  // The explore on THIS checkout, fenced to it: a junction that points elsewhere is not this repo's explore.
  if (!existsSync(ex)) die(2, `no explore ${a.explore} on this checkout (docs/design/explore/${a.explore}) -- open one first`);
  if (!realpathSync(ex).startsWith(realpathSync(REPO) + sep)) die(2, `docs/design/explore/${a.explore} resolves outside this repo`);
  const missing = VARIANTS.filter((v) => !existsSync(join(ex, `variant-${v}`)));
  if (missing.length) die(2, `${a.explore} has no variant-${missing.join(", variant-")} -- a pick is among three built variants`);
  // Each VARIANT folder is itself fenced: a variant-b that was a junction to a folder outside the repo was fingerprinted
  // as the composer's work (PR 4 attacks, both). A link is refused, and the folder must resolve inside the explore.
  const exReal = realpathSync(ex);
  for (const v of VARIANTS) {
    const vd = join(ex, `variant-${v}`);
    if (lstatSync(vd).isSymbolicLink()) die(2, `variant-${v} of ${a.explore} is a link -- a variant is files the composer wrote`);
    if (!realpathSync(vd).startsWith(exReal + sep)) die(2, `variant-${v} of ${a.explore} resolves outside the explore`);
  }
  if (!existsSync(join(ex, `variant-${a.pick}`, "index.html"))) die(2, `variant-${a.pick} of ${a.explore} has no index.html -- its composer has not built it`);
  if (existsSync(join(ex, "PICK.md"))) die(2, `${a.explore} already has a PICK.md -- a pick is recorded once`);
  // A pick raised before, on the spine, is a pick recorded -- stamped or still open. A day file the reader could not
  // open is a day it cannot answer for, so it refuses: a pick in an unreadable day was raised again (PR 4 shell attack).
  const alreadyRaised = async () => {
    const q = await query(spineRoot(), { kind: "approval.requested", engine: "scan" });
    if (q.unreadable && q.unreadable.length) die(2, `the spine has ${q.unreadable.length} day file(s) it could not read (${q.unreadable[0].day}: ${q.unreadable[0].code}) -- it cannot tell whether this explore was picked; try again`);
    return q.events.some((e) => e.event && e.event.payload && e.event.payload.gate === "design-pick"
      && (e.event.payload.explore_dir === exploreDir || e.event.payload.explore === a.explore));
  };
  const exploreDir = `docs/design/explore/${a.explore}/`;
  if (await alreadyRaised()) die(2, `a pick of ${a.explore} is already in the inbox or decided -- a pick is recorded once`);
  const fingerprints = Object.fromEntries(VARIANTS.map((v) => [v, fingerprint(join(ex, `variant-${v}`))]));
  // The explore named by its folder and quoted in the sentence: a bare id holding "sk-" joined the next string into a
  // key (PR 4 shell attack, the agent and explore twins).
  const payload = {
    what: `pick variant ${a.pick} of the design explore "${a.explore}"`,
    gate: "design-pick", explore_dir: exploreDir, pick: a.pick, why: a.why,
    variant_sha: fingerprints[a.pick],
  };
  const refused = spineRefusal(ARC_EVENT, "approval.requested", payload, { cwd: REPO });
  if (refused) die(2, `the spine would refuse this pick, so nothing is raised: ${refused}`);
  // The digest binds the approval AND every variant's bytes: a variant rebuilt after the owner looked is a new plan.
  const digest = planDigest({ kind: "approval.requested", payload, variants: fingerprints });
  say(`pick: ${payload.what}`);
  say(`pick: variant-${a.pick} is ${fingerprints[a.pick].slice(0, 12)} as it stands; your stamp in the inbox is the pick`);
  if (a.dryRun) {
    say("pick: dry run -- nothing was raised");
    say(expectLine(digest));
    return;
  }
  if (a.expect === undefined) die(2, "an apply is bound to a plan: run it with --dry-run first, then again with the --expect it prints");
  const stale = staleReason(a.expect, digest);
  if (stale) die(2, stale);
  // THE CHECK AND THE EMIT, ONE HOLDER AT A TIME: three picks of one explore planned apart and applied at once all
  // passed the check before any landed (PR 4 logic attack). The lock sits beside the spine, never in events/.
  const held = await withExclusiveLock(join(spineRoot(), "locks"), `design-pick-${a.explore}.lock`, async () => {
    if (await alreadyRaised()) die(2, `a pick of ${a.explore} was raised a moment ago -- a pick is recorded once`);
    // Through the shared emit (core/plan-expect.mjs): a payload file, and three outcomes -- a refusal names nothing raised,
    // anything else may have landed (the PR 3b round-4 row, twin).
    const got = emitReceipt(ARC_EVENT, "approval.requested", payload, { cwd: REPO, timeoutMs: 60_000 });
    if (got.state === "refused") die(1, `the pick was not raised -- ${got.why}`);
    if (got.state !== "landed" || !got.id) die(1, `the pick may have been raised -- ${got.why}; look in your inbox before picking again`);
    return got.id;
  });
  if (held.busy) die(2, `another pick of ${a.explore} is being raised right now -- nothing was raised; read your inbox`);
  say(`receipt: approval.requested ${held.value}`);
}

function isMainModule() {
  try { return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMainModule()) {
  try { await main(); }
  catch (e) {
    if (!(e instanceof Stop)) { process.stderr.write(`pick: ${e instanceof Error ? e.message : e}\n`); process.exitCode = 2; }
  }
  // A reader that closed its end loses these lines, never the outcome: the exit code is already set (PR 3b, arc-event twin).
  if (out.length) { try { writeSync(1, out.join("\n") + "\n"); } catch { /* the lines are lost; the effect and its exit are not */ } }
}
