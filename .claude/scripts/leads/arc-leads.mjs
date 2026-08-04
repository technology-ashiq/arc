#!/usr/bin/env node
// arc-leads — the outbound engine's CLI (Cycle 8, ADR-0400..0413).
//
// Phase 00 subcommands only: `store init`, `research`, `preflight`, `state`.
// Sending, caps, suppression and the reply path arrive in Phases 01-02; the real campaign is
// Phase 03 and is BLOCKED on business physics no code produces (ADR-0413).
//
// Exit codes are stable and distinct, because a caller that cannot tell "refused" from
// "crashed" retries the wrong one:
//   0 ok · 2 usage/validation · 3 refused by a gate · 4 provider transport · 5 store error

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initStore, openStore, leadId, fingerprint, StoreError, storePath } from "./lib/store.mjs";
import { lintCandidates } from "./lib/research-lint.mjs";
import { source, verifier, ProviderError, PROVIDER_EXIT } from "./lib/deps.mjs";
import { preflight, PREFLIGHT_REFUSED } from "./lib/preflight.mjs";
import { leadsIdem } from "../hq/lib/validate-leads.mjs";
import { readAllEvents } from "./lib/spine-read.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");

const die = (code, msg) => { console.error(`arc-leads: ${msg}`); process.exit(code); };

// ---------- emit ----------
//
// The ONE leads emitter (C15). Every leads receipt is constructed here from a literal shape,
// so "no PII in a payload" is a property of one function rather than a habit spread over the
// codebase. --idem is never passed: the emitter derives it for leads kinds and refuses a
// supplied one (anti-preclaim, ADR-0400).
function emit(kind, payload, { evidence = null } = {}) {
  const sh = join(REPO_ROOT, ".claude/scripts/hq/arc-event.sh");
  const args = ["emit", kind, "--payload", JSON.stringify(payload), "--actor", "arc-leads", "--strict"];
  if (evidence) args.push("--evidence", evidence);
  return execFileSync("bash", [sh, ...args], { encoding: "utf8" });
}

// ---------- store init ----------
function cmdStoreInit() {
  try {
    const { dir, storeId, version } = initStore({ repoRoot: REPO_ROOT });
    console.log(`arc-leads: store initialised at ${dir}`);
    console.log(`  store_id: ${storeId}`);
    console.log(`  secret:   secret.v${version} (mode 0600)`);
    console.log("");
    console.log("BACK THIS UP. Outside the repo there is no git safety net, and losing the");
    console.log("secret breaks suppression matching permanently: a person who unsubscribed");
    console.log("would resurface in a future research list and be contacted again (ADR-0410).");
  } catch (e) {
    die(e instanceof StoreError ? 5 : 2, e.message);
  }
}

// ---------- research ----------
async function cmdResearch(icpPath) {
  if (!icpPath) die(2, "usage: arc-leads research <icp-file>");
  if (!existsSync(icpPath)) die(2, `ICP file not found: ${icpPath}`);
  const icp = JSON.parse(readFileSync(icpPath, "utf8"));
  const campaign = icp.campaign;
  if (!/^[a-z0-9-]{1,64}$/.test(String(campaign || "")))
    die(2, `ICP "campaign" must match [a-z0-9-]{1,64} (got ${JSON.stringify(campaign)}) — "|" is the idem delimiter`);

  let store;
  try { store = openStore({ repoRoot: REPO_ROOT }); }
  catch (e) { die(5, e.message); }

  let candidates;
  try { candidates = await source().search(icp); }
  catch (e) { die(e instanceof ProviderError ? PROVIDER_EXIT : 2, e.message); }

  // Verify every address BEFORE linting, so `held` is decided by the verifier rather than by
  // whichever branch happened to run first.
  const verdicts = new Map();
  for (const c of candidates) verdicts.set(String(c.email).toLowerCase(), await verifier().verify(c.email));

  const { accepted, rejected } = lintCandidates(candidates, verdicts);

  const dossierDir = join(store.dir, "dossiers");
  mkdirSync(dossierDir, { recursive: true });
  const fp = fingerprint(store);

  for (const a of accepted) {
    const id = leadId(store, a.email);
    // The dossier holds the PII. It lives in the store, outside the repo, and nothing here
    // ever reaches a receipt.
    writeFileSync(join(dossierDir, `${id}.json`), JSON.stringify({
      lead_id: id, name: a.name, email: a.email, firm: a.firm, firm_domain: a.firm_domain,
      geography: a.geography, provenance: a.provenance, source_urls: a.source_urls,
      facts: a.facts, citable_facts: a.citable_facts,
      email_status: a.email_status, below_bar: a.below_bar, below_bar_reason: a.below_bar_reason,
      campaign, store_id: store.storeId,
    }, null, 2) + "\n");

    emit("lead.researched", {
      lead_id: id, campaign, provenance: a.provenance, geography: a.geography,
      email_status: a.email_status, fact_count: a.fact_count,
      store_id: store.storeId, store_fingerprint: fp,
      ...(a.below_bar ? { below_bar: true } : {}),
    });
  }

  // Rejected candidates keep a record too: the 25 must be a filtered set with an audit trail,
  // not a survivor list. A rejection without a reason is invalid and refuses here.
  const rejPath = join(store.dir, "rejected.jsonl");
  const lines = rejected.map((r) => {
    if (!r.exclusion_reason) die(2, `internal: a rejection for "${r.firm}" carries no exclusion_reason`);
    return JSON.stringify(r);
  });
  writeFileSync(rejPath, lines.length ? lines.join("\n") + "\n" : "");

  const pass = accepted.filter((a) => !a.below_bar && a.email_status === "verified").length;
  const held = accepted.filter((a) => a.email_status === "held").length;
  const below = accepted.filter((a) => a.below_bar).length;
  console.log(`arc-leads research: ${pass} PASS · ${held} HELD · ${below} BELOW-BAR · ${rejected.length} REJECTED`);
  console.log(`  dossiers: ${accepted.length} in ${dossierDir}`);
  for (const r of rejected) console.log(`  REJECTED ${r.firm}: ${r.exclusion_reason}`);
}

// ---------- preflight ----------
async function cmdPreflight() {
  const res = await preflight({ warmupApproved: process.env.LEADS_WARMUP_APPROVED === "1" });
  for (const f of res.findings) console.log(`  ${f.ok ? "ok  " : "REFUSED"} ${f.rule}: ${f.detail}`);
  if (!res.ok) {
    console.error("arc-leads preflight: REFUSED — no send may happen until every clause passes live (REQ-00)");
    process.exit(PREFLIGHT_REFUSED);
  }
  console.log("arc-leads preflight: PASS");
}

// ---------- state ----------
//
// A PURE FOLD over the spine. No cache, no file written, nothing under
// .claude/state/hq/derived/. REQ-03 forbids a mutable counter, so there is nothing to wipe --
// which is why the replay fixture asserts determinism, order-independence and
// fold-completeness rather than "wipe and replay", a test that would delete nothing and
// assert nothing.
function cmdState(json) {
  const events = readAllEvents();
  const leads = new Map();
  const campaigns = {};
  const touch = (id) => leads.get(id) || leads.set(id, { last_touch_at: null, lead_id: id, suppressed: false, touches: 0 }).get(id);

  for (const e of events) {
    const p = e.payload || {};
    if (e.kind === "lead.researched") touch(p.lead_id);
    else if (e.kind === "outreach.sent") {
      const l = touch(p.lead_id);
      l.touches += 1;
      if (!l.last_touch_at || p.submitted_at > l.last_touch_at) l.last_touch_at = p.submitted_at;
      (campaigns[p.campaign] ||= { replied: 0, submitted: 0 }).submitted += 1;
    } else if (e.kind === "outreach.replied") {
      touch(p.lead_id);
      (campaigns[p.campaign] ||= { replied: 0, submitted: 0 }).replied += 1;
    } else if (e.kind === "lead.suppressed") touch(p.lead_id).suppressed = true;
  }

  const out = {
    campaigns: Object.fromEntries(Object.keys(campaigns).sort().map((k) => [k, campaigns[k]])),
    leads: [...leads.values()].sort((a, b) => (a.lead_id < b.lead_id ? -1 : a.lead_id > b.lead_id ? 1 : 0)),
  };
  if (json) process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  return out;
}

// ---------- main ----------
const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "store" && rest[0] === "init") cmdStoreInit();
  else if (cmd === "research") await cmdResearch(rest[0]);
  else if (cmd === "preflight") await cmdPreflight();
  else if (cmd === "state") cmdState(rest.includes("--json"));
  else {
    console.error("arc-leads: usage: arc-leads <store init|research ICP.json|preflight|state --json>");
    console.error("  Phase 00 surface only. Sending arrives in Phase 01; the real campaign is BLOCKED (ADR-0413).");
    process.exit(2);
  }
} catch (e) {
  if (e instanceof StoreError) die(5, e.message);
  if (e instanceof ProviderError) die(PROVIDER_EXIT, `${e.kind}: ${e.message}`);
  die(2, e.message);
}
