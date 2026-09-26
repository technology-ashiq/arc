#!/usr/bin/env node
// live-work.mjs -- the live lanes' work verbs, APPLIED in scratch (face v2 Phase 05 PR 5c, ADR-1344).
//
//   leads daily      the send bound to its plan: what would go out, then only that -- and on every tree today the
//                    leads lane's own gate refuses the send itself (no warmed sending domain, ADR-0402/0413)
//   legal propose    the full-read gate: the pages rendered, the payload publish re-derives written, and ONE
//                    approval.requested (gate legal, subject legal.publish) raised into the inbox the face stamps in
//
// Every run uses a scratch spine, a scratch store and a scratch leads config. VACUOUS-PASS GUARD: each plan is proven
// to print a digest, each refusal is matched by its own words, and the last line is "RAN: <n> checks".

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const S = (...p) => join(REPO, ".claude", "scripts", ...p);
const ZERO = "0".repeat(64);

let ran = 0, failed = 0;
const check = (name, cond, detail = "") => {
  ran++;
  if (!cond) { failed++; console.log(`FAIL ${name} ${detail}`); }
  else console.log(`ok ${name}`);
};
const tmp = mkdtempSync(join(tmpdir(), "face-live-work-"));
const spine = (name) => { const d = join(tmp, name); mkdirSync(join(d, "events"), { recursive: true }); return d; };
const spineEvents = (root) => readdirSync(join(root, "events")).filter((n) => n.endsWith(".jsonl")).sort()
  .flatMap((n) => readFileSync(join(root, "events", n), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)));
const lastLine = (out) => String(out).trim().split(/\r?\n/).pop() || "";
const lastExpect = (out) => { try { const j = JSON.parse(lastLine(out)); return typeof j.expect === "string" && /^[0-9a-f]{64}$/.test(j.expect) ? j.expect : null; } catch { return null; } };
const node = (args, env = {}, cwd = REPO) => spawnSync(process.execPath, args, { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 180_000 });

// ---- the leads daily send: bound to its plan ----
{
  const sp = spine("leads-spine");
  const store = join(tmp, "leads-store");
  const base = { ARC_SPINE_ROOT: sp, ARC_LEADS_STORE: store, ARC_LEADS_FAKE: "1" };
  const al = (args, env = {}) => node([S("leads", "arc-leads.mjs"), ...args], { ...base, ...env });

  // The argv contract first: a send is bound to a plan, and the two flags are exclusive. These hold before the tool
  // reads a config, a store or the clock, so they hold on every tree.
  for (const [why, args, re] of [
    ["a send with no plan behind it", ["daily", "pilot"], /bound to a plan/],
    ["a plan and an apply in one run", ["daily", "pilot", "--dry-run", "--expect", ZERO], /give one/],
    ["a digest that is not one", ["daily", "pilot", "--expect", "not-a-digest"], /64-hex digest/],
    ["a repeated flag", ["daily", "pilot", "--dry-run", "--dry-run"], /given twice/],
    ["an argument it does not take", ["daily", "pilot", "--send-it"], /unknown argument/],
  ]) {
    const r = al(args);
    check(`leads daily refuses ${why}`, r.status === 2 && re.test(r.stderr), `${r.status} ${r.stderr.slice(0, 160)}`);
  }
  // A scratch config WITH a domain, so the plan and its binding can be proven. Nothing is sent: the fake provider is on,
  // and the spine is checked for outreach.* after every run.
  const cfg = join(tmp, "leads.json");
  writeFileSync(cfg, JSON.stringify({ ...JSON.parse(readFileSync(join(REPO, ".claude", "config", "leads.json"), "utf8")), sending_domain: "outbound.example.test" }, null, 2) + "\n");
  const env = { LEADS_CONFIG: cfg };
  const noStore = al(["daily", "pilot", "--dry-run"], env);
  check("leads daily refuses a store that was never initialised", noStore.status !== 0 && /store not initialised/.test(noStore.stderr), noStore.stderr.slice(0, 120));
  const init = al(["store", "init"], env);
  const camp = al(["campaign", "init", "pilot"], env);
  // THE LANE'S OWN GATE, on the tree's real config: no warmed sending domain is evidenced, so the send cannot run at all
  // (ADR-0402/0413) -- and the face's card shows exactly this refusal. Asked with a store, so the store check is past.
  const gated = al(["daily", "pilot", "--dry-run"], { LEADS_CONFIG: join(REPO, ".claude", "config", "leads.json") });
  check("leads daily refuses on the lane's own gate where no sending domain is evidenced", gated.status === 3 && /no sending_domain configured/.test(gated.stderr), `${gated.status} ${gated.stderr.slice(0, 120)}`);
  check("leads fixture: a scratch store and campaign (vacuous-pass guard)", init.status === 0 && camp.status === 0, `${init.stderr} ${camp.stderr}`);
  const empty = al(["daily", "pilot", "--dry-run"], env);
  check("leads daily refuses to plan a send with no approved draft -- and prints no digest to bind to", empty.status === 2 && /nothing to plan/.test(empty.stderr) && lastExpect(empty.stdout) === null, empty.stderr.slice(0, 140));

  // One draft, approved through the inbox exactly as the send path reads it.
  const D = await import(pathToFileURL(S("leads", "lib", "drafts.mjs")).href);
  const ST = await import(pathToFileURL(S("leads", "lib", "store.mjs")).href);
  // THIS PROCESS'S OWN ENVIRONMENT, not only the children's: `storePath()` reads ARC_LEADS_STORE here too, and without
  // it an in-process write lands in the operator's REAL store under their home directory (it did, once).
  process.env.ARC_LEADS_STORE = store;
  process.env.LEADS_CONFIG = cfg;
  const opened = ST.openStore({ repoRoot: REPO });
  check("leads fixture: the in-process store is the scratch one, never the operator's (vacuous-pass guard)", resolve(ST.storePath()) === resolve(store), ST.storePath());
  const rec = D.writeDraft(opened, { campaign: "pilot", lead_id: "a".repeat(64), touch_n: 1, body: "A short probe body, for the plan only.", cites: ["https://example.test/a"], lintStatus: "PASS" });
  const req = node([S("hq", "arc-event.mjs"), "emit", "approval.requested", "--payload", JSON.stringify(D.approvalPayload(rec)), "--strict"], base);
  const stamp = node([S("hq", "arc-inbox.mjs"), "approve", req.stdout.trim(), "--reason", "live-work fixture"], base);
  check("leads fixture: the draft is approved in the inbox (vacuous-pass guard)", req.status === 0 && stamp.status === 0, `${req.stderr} ${stamp.stderr}`);

  const plan = al(["daily", "pilot", "--dry-run"], env);
  const d = lastExpect(plan.stdout);
  const sent = () => spineEvents(sp).filter((e) => String(e.kind).startsWith("outreach.")).length;
  check("leads daily, planned: the approved draft and the sha the owner approved, a digest, and nothing sent",
    plan.status === 0 && !!d && plan.stdout.includes(rec.draft_ref) && plan.stdout.includes(rec.draft_sha.slice(0, 12)) && sent() === 0,
    `${plan.status} ${plan.stderr.slice(0, 140)}`);
  const stale = al(["daily", "pilot", "--expect", ZERO], env);
  check("leads daily refuses a send whose digest is not the plan's, and sends nothing", stale.status === 2 && /PLAN_STALE|not what the plan showed/.test(stale.stderr) && sent() === 0, stale.stderr.slice(0, 140));
  // THE DIGEST IS NOT A CONSTANT: a second approved draft changes what the plan describes, so the first plan's digest no
  // longer applies -- without this the suite passed a planDigest that ignored every input (PR 5c round-1 attacks).
  const rec2 = D.writeDraft(opened, { campaign: "pilot", lead_id: "b".repeat(64), touch_n: 1, body: "A second probe body, for the digest.", cites: ["https://example.test/b"], lintStatus: "PASS" });
  const req2 = node([S("hq", "arc-event.mjs"), "emit", "approval.requested", "--payload", JSON.stringify(D.approvalPayload(rec2)), "--strict"], base);
  node([S("hq", "arc-inbox.mjs"), "approve", req2.stdout.trim(), "--reason", "live-work fixture"], base);
  const plan2 = al(["daily", "pilot", "--dry-run"], env);
  const d2 = lastExpect(plan2.stdout);
  const afterChange = al(["daily", "pilot", "--expect", d || ZERO], env);
  check("leads daily: another approved draft is another plan -- the digest moves and the first one no longer applies",
    plan2.status === 0 && !!d2 && d2 !== d && plan2.stdout.includes(rec2.draft_ref) && afterChange.status === 2 && sent() === 0,
    `${d && d.slice(0, 12)} -> ${d2 && d2.slice(0, 12)} / ${afterChange.status} ${afterChange.stderr.slice(0, 120)}`);
  // WHO IT GOES TO is in the plan: the approval's sha covers the body only, so a record rewritten to another lead and
  // subject after the plan kept the digest and was sent under it (PR 5c round-2 logic attack). Rewritten, the plan is
  // stale; restored, it applies again.
  {
    const draftFile = join(store, "drafts", `${rec2.draft_ref}.json`);
    const original = readFileSync(draftFile, "utf8");
    writeFileSync(draftFile, JSON.stringify({ ...JSON.parse(original), lead_id: "c".repeat(64), subject: "a subject nobody planned" }, null, 2) + "\n");
    const swapped = al(["daily", "pilot", "--expect", d2 || ZERO], env);
    const replanned = lastExpect(al(["daily", "pilot", "--dry-run"], env).stdout);
    writeFileSync(draftFile, original);
    check("leads daily: a draft rewritten to another lead after the plan makes the plan stale, and nothing is sent",
      swapped.status === 2 && /PLAN_STALE|not what the plan showed/.test(swapped.stderr) && replanned !== null && replanned !== d2 && sent() === 0,
      `${swapped.status} ${swapped.stderr.slice(0, 140)} / ${replanned && replanned.slice(0, 12)}`);
    check("leads fixture: the restored draft plans the same digest again (vacuous-pass guard)", lastExpect(al(["daily", "pilot", "--dry-run"], env).stdout) === d2);
  }
  // Bound: the send path RUNS. The drafts' leads are not in this scratch store, so the send refuses each by name -- a
  // refusal at the send is the mechanism working, and it is still not a send. The draft's ref in the output is the proof
  // that runDaily was reached, not merely that something printed the word "refused".
  const bound = al(["daily", "pilot", "--expect", d2 || ZERO], env);
  check("leads daily, bound to its plan: the send path runs and names each draft it refuses, and no outreach receipt is written",
    (bound.status === 0 || bound.status === 3) && bound.stdout.includes(rec.draft_ref) && /REFUSED/.test(bound.stdout) && sent() === 0,
    `${bound.status} ${(bound.stdout + bound.stderr).slice(0, 220)}`);
}

// ---- the legal full-read gate: rendered, written, raised ----
{
  const sp = spine("legal-spine");
  const out = join(tmp, "legal-out");
  const venture = readdirSync(join(REPO, "tests", "fixtures", "legal", "ventures")).sort()[0];
  // ARC_LEGAL_VENTURE_DIR is cleared: an operator who exports it would render a REAL venture into this scratch run.
  const lg = (...args) => node([S("legal", "arc-legal.mjs"), "propose", "--venture", venture, "--out", out, ...args], { ARC_SPINE_ROOT: sp, ARC_LEGAL_VENTURE_DIR: "" });
  check("legal fixture: the repository holds a fixture venture to render (vacuous-pass guard)", typeof venture === "string" && venture.length > 0, String(venture));

  const unbound = lg();
  check("legal propose refuses a request with no plan behind it", unbound.status === 2 && /bound to a plan/.test(unbound.stderr) && !existsSync(join(out, "_approval.json")), unbound.stderr.slice(0, 140));
  const both = lg("--dry-run", "--expect", ZERO);
  check("legal propose refuses a plan and an apply in one run", both.status === 2 && /Give one|give one/.test(both.stderr), both.stderr.slice(0, 120));
  // PR 5c round-2 attacks: the parser's three quiet holes, and the plan bound to a STRING rather than a directory.
  {
    const lgRaw = (args, cwd) => node([S("legal", "arc-legal.mjs"), "propose", "--venture", venture, ...args], { ARC_SPINE_ROOT: sp, ARC_LEGAL_VENTURE_DIR: "" }, cwd);
    const typo = lgRaw(["--out", out, "--ventur-dir", tmp, "--dry-run"]);
    check("legal propose refuses a flag it does not take (a typo never runs on the default source)", typo.status === 2 && /does not take --ventur-dir/.test(typo.stderr), typo.stderr.slice(0, 120));
    const blank = lgRaw(["--out", out, "--venture-dir", "", "--dry-run"]);
    check("legal propose refuses an EMPTY --venture-dir rather than reading it as absent", blank.status === 2 && /has no value/.test(blank.stderr), blank.stderr.slice(0, 120));
    for (const dir of ["cwd-a", "cwd-b"]) mkdirSync(join(tmp, dir), { recursive: true });
    const inA = lastExpect(lgRaw(["--out", "rel-out", "--dry-run"], join(tmp, "cwd-a")).stdout);
    const inB = lastExpect(lgRaw(["--out", "rel-out", "--dry-run"], join(tmp, "cwd-b")).stdout);
    check("legal propose binds the DIRECTORY: one relative --out from two folders is two plans", inA !== null && inB !== null && inA !== inB, `${inA} ${inB}`);
  }
  const plan = lg("--dry-run");
  const d = lastExpect(plan.stdout);
  check("legal propose, planned: the pages, the facts and the payload sha, a digest -- and nothing written into --out",
    plan.status === 0 && !!d && /^payload [0-9a-f]{64}$/m.test(plan.stdout) && /facts [0-9a-f]{64} \(from the fixtures root\)/.test(plan.stdout) && !existsSync(out) && spineEvents(sp).length === 0,
    `${plan.status} ${plan.stderr.slice(0, 140)}`);
  // NOTHING means nothing: the first cut rendered into --out before this check, so a refusal left 8 files behind while
  // saying "nothing was written" -- and the check only looked for the payload file (PR 5c round-1 attacks, both).
  const stale = lg("--expect", ZERO);
  check("legal propose refuses an apply whose digest is not the plan's, and --out holds NOTHING at all",
    stale.status === 2 && !existsSync(out) && spineEvents(sp).length === 0, `${stale.status} ${existsSync(out) ? readdirSync(out).join(",") : "absent"} ${stale.stderr.slice(0, 120)}`);

  const ap = lg("--expect", d || ZERO);
  const file = join(out, "_approval.json");
  const payload = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const raised = spineEvents(sp).filter((e) => e.kind === "approval.requested" && e.payload && e.payload.gate === "legal");
  const CANON = await import(pathToFileURL(S("legal", "lib", "canonical.mjs")).href);
  const sha = existsSync(file) ? CANON.bytesHash(Buffer.from(readFileSync(file, "utf8"), "utf8")) : "";
  check("legal propose, applied: the payload written, its pages rendered, and ONE request naming that payload's sha",
    ap.status === 0 && !!payload && payload.subject === "legal.publish" && raised.length === 1 && raised[0].payload.sha === sha && raised[0].payload.subject === "legal.publish"
      && readdirSync(out).filter((n) => n.endsWith(".mdx")).length === payload.pages.length,
    `${ap.status} ${ap.stderr.slice(0, 160)} raised=${raised.length}`);
  // The printed commands are the ones a person can run: the id the stamp needs, and the id `publish --request` needs.
  check("legal propose prints the stamp and the publish commands, both naming the script that exists and the request's id",
    raised.length === 1 && ap.stdout.includes(`arc-inbox.mjs approve ${raised[0].id}`) && ap.stdout.includes(`--request ${raised[0].id}`) && !ap.stdout.includes("arc-inbox.sh"),
    ap.stdout.slice(-300));
  // SENTINELS in --out from here on: every refusal below must leave the folder byte-for-byte as it was. Only the stale
  // digest was pinned that way, so a propose that wrote BEFORE its duplicate or spine check passed every assertion
  // (PR 5c round-2 shell attack).
  const page = readdirSync(out).filter((n) => n.endsWith(".mdx")).sort()[0];
  writeFileSync(join(out, page), "SENTINEL-PAGE\n");
  writeFileSync(file, "SENTINEL-PAYLOAD\n");
  const untouched = () => readFileSync(join(out, page), "utf8") === "SENTINEL-PAGE\n" && readFileSync(file, "utf8") === "SENTINEL-PAYLOAD\n";
  // ONE QUESTION PER PAYLOAD, refused before the write: the same bytes twice is the same question.
  const again = lg("--expect", d || ZERO);
  check("legal propose refuses the same bytes a second time, before writing, and raises no second request",
    again.status === 2 && /already in your inbox/.test(again.stderr) && spineEvents(sp).filter((e) => e.kind === "approval.requested").length === 1 && untouched(), again.stderr.slice(0, 160));
  // A FOLDER where a page belongs is refused before the first write -- the copy used to fail half-way, some approved
  // pages overwritten and the old payload kept, reported as a stack trace (PR 5c round-2 attacks, both).
  {
    const out2 = join(tmp, "legal-out-2");
    mkdirSync(join(out2, page), { recursive: true });
    writeFileSync(join(out2, "_approval.json"), "SENTINEL-PAYLOAD\n");
    // ANOTHER venture, so the payload is not the one already in the inbox and the duplicate check cannot answer first.
    const venture2 = readdirSync(join(REPO, "tests", "fixtures", "legal", "ventures")).sort()[1];
    const lg2 = (...args) => node([S("legal", "arc-legal.mjs"), "propose", "--venture", venture2, "--out", out2, ...args], { ARC_SPINE_ROOT: sp, ARC_LEGAL_VENTURE_DIR: "" });
    const d2 = lastExpect(lg2("--dry-run").stdout);
    check("legal fixture: a second venture plans into a second --out (vacuous-pass guard)", typeof venture2 === "string" && venture2 !== venture && d2 !== null, `${venture2} ${d2}`);
    const blocked = lg2("--expect", d2 || ZERO);
    check("legal propose into an --out with a FOLDER where a page belongs writes nothing and says why, with no stack",
      blocked.status === 2 && /nothing was written/.test(blocked.stderr) && /is a folder or a link/.test(blocked.stderr) && !/\bat \w+ \(|EIO|node:internal/.test(blocked.stderr)
        && readFileSync(join(out2, "_approval.json"), "utf8") === "SENTINEL-PAYLOAD\n" && statSync(join(out2, page)).isDirectory(),
      blocked.stderr.slice(0, 200));
  }
  // An unknown read is never "not raised": a torn line refuses the apply.
  const day = readdirSync(join(sp, "events")).find((n) => n.endsWith(".jsonl"));
  writeFileSync(join(sp, "events", day), `${readFileSync(join(sp, "events", day), "utf8")}{"kind":"approval.re`);
  const torn = lg("--expect", d || ZERO);
  check("legal propose refuses a spine it cannot read whole, and leaves --out as it was", torn.status === 2 && /torn line|cannot read/.test(torn.stderr) && untouched(), torn.stderr.slice(0, 160));
}

console.log(`RAN: ${ran} checks, ${failed} failed`);
process.exit(failed === 0 && ran >= 24 ? 0 : 1);
