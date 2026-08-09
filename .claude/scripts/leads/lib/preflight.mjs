// preflight.mjs — REQ-00, the deliverability gate. CODE, not a checklist.
//
// The failure this closes: an evidence FILE saying "DMARC is green" is a file, and a file can
// be stale, copied from another project, or simply wrong. So every checkable clause is
// checked LIVE — DNS is resolved, provider auth is queried through the interface — and the
// evidence file is never an input to PASS.
//
// The warm-up clause is the honest exception and is treated as one. Where the provider
// exposes send history we read it and compare. Where it does not, the gate prints
// `warm-up: ATTESTED — not verified` and REFUSES until a human approves that exact string in
// the inbox. It never prints PASS for a clause it could not verify: a gate that reports
// success for an unchecked claim teaches everyone downstream to trust the wrong thing.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve as pathResolve } from "node:path";
import { fileURLToPath } from "node:url";

// Anchored to the REPO, never to process.cwd(). A relative default meant an operator-lowered
// cap silently evaporated the moment the command ran from another directory (falling back to
// DEFAULTS), and a leads.json planted in a hostile cwd won outright -- including the
// sending_domain that every List-Unsubscribe header is built from.
const REPO_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_CONFIG = pathResolve(REPO_ROOT, ".claude/config/leads.json");
import { dns, provider } from "./deps.mjs";

export const PREFLIGHT_OK = 0;
export const PREFLIGHT_REFUSED = 3;

const MIN_WARMUP_DAYS = 14;

export function loadConfig(path = process.env.LEADS_CONFIG || DEFAULT_CONFIG) {
  if (!existsSync(path)) throw new Error(`leads config not found at ${path}`);
  return JSON.parse(readFileSync(path, "utf8"));
}

// A sending domain must not be the product domain, and must not be a SUBDOMAIN of it:
// spam filters aggregate reputation to the organizational domain, so a burned subdomain
// burns its parent. `mail.lexos.app` is not isolation (ADR-0402).
// Pinned in CODE, exactly as caps.mjs pins its ceilings (ADR-0403): values live in config,
// ENFORCEMENT lives in code, and config may only make a limit STRICTER. product_domains is a
// ceiling-class value and did not get that treatment -- LEADS_CONFIG points loadConfig at any
// file, so the *definition* of "product domain" was itself overridable and a config carrying
// "product_domains": [] passed lexos.app clean through the ADR-0402 refusal. Config may ADD a
// product domain; it can never remove one of these.
export const PRODUCT_DOMAINS = Object.freeze(["lexos.app", "automemory.ai"]);

// Config-supplied product domains must be an ARRAY of non-empty strings. `productDomains || []`
// read "the key is absent" as "nothing is a product domain", and a JSON string iterated
// character by character and matched nothing -- either way one edit made the whole refusal
// evaporate silently. Same shape check seedSmokeFinding already applies to ev.mailboxes.
export function configuredProductDomains(cfg) {
  const raw = cfg && cfg.product_domains;
  if (raw === undefined || raw === null) return { list: [], error: null };
  if (!Array.isArray(raw))
    return { list: [], error: `product_domains must be an array; got ${typeof raw}. A non-array is refused rather than read as an empty list, because an empty list disables ADR-0402 entirely` };
  const list = raw.map(normDomain).filter(Boolean);
  if (list.length !== raw.length)
    return { list, error: `product_domains holds ${raw.length - list.length} entr(y/ies) that are not non-empty domain strings — refused rather than skipped` };
  return { list, error: null };
}

export function domainConflict(sending, productDomains) {
  const s = normDomain(sending);
  // Both sides go through the SAME normaliser. They did not: this function trimmed neither
  // side while normDomain trimmed, so ONE leading space on a product_domains entry silently
  // disabled that entry and the product domain passed as a fine dedicated domain. Two
  // derivations of one normalisation, in this file, 36 lines apart -- defect class D5.
  for (const raw of [...PRODUCT_DOMAINS, ...(productDomains || [])]) {
    const p = normDomain(raw);
    if (!p) continue;
    if (s === p) return `sending domain "${s}" IS the product domain`;
    if (s.endsWith("." + p)) return `sending domain "${s}" is a subdomain of product domain "${p}" — reputation aggregates to the organizational domain, so a burn takes the parent with it`;
  }
  return null;
}

// ---- ADR-0416 rehearsal mode ----
//
// ADR-0416 narrowed ADR-0402 in PROSE and nothing enforced the narrowing: `product_domains`
// did not even name `automemory.ai`, so the dedicated-domain refusal could not fire for the
// one domain the ADR exists to control. This is that enforcement.
//
// THREE independent signals, all required, and the ABSENCE of any of them is the safe state:
//
//   declared — env ARC_LEADS_REHEARSAL=1. Deliberately an environment declaration and not a
//              caller-passed argument: a function parameter someone forgets to pass defaults
//              to permissive, whereas a missing env var refuses. Forgetting is fail-closed.
//   locked   — env ARC_LEADS_REHEARSAL_ALLOWLIST with at least one ADDRESS-SHAPED entry.
//              Shape is checked, not just non-emptiness: `ARC_LEADS_REHEARSAL_ALLOWLIST=yes`
//              is otherwise a one-word unlock of the product domain.
//   named    — the sending domain equals cfg.rehearsal_domain exactly. Without this, turning
//              rehearsal on would unlock EVERY product domain, `lexos.app` included.
//
// Rehearsal mode is a property of the environment and the config, never of a call site.
export function rehearsalMode(env = process.env) {
  const declared = String(env.ARC_LEADS_REHEARSAL || "").trim() === "1";
  const allowlist = String(env.ARC_LEADS_REHEARSAL_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@") && !s.startsWith("@") && !s.endsWith("@"));
  return { declared, locked: allowlist.length > 0, count: allowlist.length };
}

function normDomain(d) {
  return String(d || "").trim().toLowerCase().replace(/\.$/, "");
}

// ONE resolver, used by preflight AND by the sequencer that builds List-Unsubscribe. Two
// readers deriving the sending domain by two paths is how a send one counts becomes a send
// the other does not -- this lane has already paid for that lesson once (ADR-0403 vs REQ-05).
export function effectiveSendingDomain(cfg, env = process.env) {
  const r = rehearsalMode(env);
  const named = normDomain(cfg && cfg.rehearsal_domain);
  const plain = { domain: normDomain(cfg && cfg.sending_domain), rehearsal: false, mode: r, blocked: null };
  if (!r.declared) return plain;

  // DECLARED but incomplete is a REFUSAL, never a quiet fall-back to sending_domain. All three
  // signals are checked HERE, in the resolver every caller shares, because the first version
  // checked `locked` only inside preflight() -- and the send path never calls preflight(). One
  // env var was therefore the whole unlock: `ARC_LEADS_REHEARSAL=1 arc-leads daily` bound the
  // product domain into every List-Unsubscribe and entered the send loop, while preflight sat
  // in a different subcommand refusing correctly and being asked nothing. Defect class D6, and
  // the reason a guard belongs in the shared resolver rather than in one of its callers.
  if (!named)
    return { ...plain, blocked: "rehearsal_domain is unset in config, so rehearsal mode has no named domain to bind (ADR-0416)" };
  if (!PRODUCT_DOMAINS.includes(named))
    return { ...plain, blocked: `rehearsal_domain "${named}" is not one of the code-pinned product domains (${PRODUCT_DOMAINS.join(", ")}). Rehearsal mode unlocks a LISTED name, never an arbitrary one a config edit supplies (ADR-0416)` };
  if (!r.locked)
    return { ...plain, blocked: "ARC_LEADS_REHEARSAL_ALLOWLIST holds no address-shaped entry. Rehearsal mode without a lock is not rehearsal mode: the lock is the whole of what makes ADR-0416 narrower than ADR-0402 (ADR-0416)" };
  return { domain: named, rehearsal: true, mode: r, blocked: null };
}

export function effectiveDkimSelector(cfg, isRehearsal) {
  if (isRehearsal) return (cfg && cfg.rehearsal_dkim_selector) || (cfg && cfg.dkim_selector) || "default";
  return (cfg && cfg.dkim_selector) || "default";
}

async function txt(name) {
  try { return (await dns().resolveTxt(name)).map((r) => r.join("")); }
  catch { return []; }
}

// `preflight()` is REQ-00 and ONLY REQ-00: is this domain fit to send from. REQ-07 (the
// fake→real gap: a dated seed-inbox smoke) is a DIFFERENT requirement with a different gate,
// and it lives in seedSmokeFinding below. Folding it in here was the first attempt and it was
// wrong twice over — it made two REQ-00 tests fail for a REQ-07 reason, which is the tell:
// when a gate starts failing for reasons outside the question it asks, it has been given two
// jobs. `arc-leads preflight` is the composition point; it runs both and reports both.
export async function preflight({ config, warmupApproved = false, env = process.env } = {}) {
  const cfg = config || loadConfig();
  const findings = [];
  const refuse = (rule, detail) => findings.push({ ok: false, rule, detail });
  const pass = (rule, detail) => findings.push({ ok: true, rule, detail });

  // A path where an object belongs used to be diagnosed as "sending_domain is empty", which is
  // a confident wrong answer from the one gate whose whole principle is never to report on
  // something it did not check.
  if (typeof config === "string")
    throw new TypeError("preflight({config}) takes a parsed config OBJECT; pass loadConfig(path) instead of the path");

  const { list: configured, error: pdError } = configuredProductDomains(cfg);
  if (pdError) {
    refuse("product-domains", pdError + " (ADR-0402)");
    return { ok: false, findings };
  }

  const eff = effectiveSendingDomain(cfg, env);
  const domain = eff.domain;

  if (eff.blocked) {
    refuse("rehearsal-mode", `ADR-0416 rehearsal mode is DECLARED but incomplete, so it is REFUSED rather than quietly falling back: ${eff.blocked}`);
    return { ok: false, findings };
  }

  // The substitution is ANNOUNCED, never silent. In rehearsal mode the configured
  // sending_domain is not used at all, and a reader of this output must be able to see that
  // without knowing the resolver's internals.
  if (eff.rehearsal)
    pass("rehearsal-mode", `ADR-0416 rehearsal mode is DECLARED — the domain under test is rehearsal_domain "${domain}"; the configured sending_domain ("${normDomain(cfg.sending_domain) || "empty"}") is not used for this run`);

  if (!domain) {
    refuse("sending-domain", "sending_domain is empty — no dedicated cold-outbound domain exists yet (ADR-0413). This is the honest committed value, and it refuses rather than passing vacuously");
    return { ok: false, findings };
  }

  const conflict = domainConflict(domain, configured);
  if (conflict) {
    if (!eff.rehearsal) refuse("dedicated-domain", conflict + " (ADR-0402)");
    // NOT "locked to N recipients": nothing on the send path enforces the list yet, and a gate
    // that describes containment it does not perform teaches the reader to trust the wrong
    // thing. Per-recipient refusal before any network call is phase-03 slice 04, and until it
    // lands this says only what is true -- that a lock is DECLARED.
    else pass("dedicated-domain", `${domain} IS a product domain, permitted ONLY because ADR-0416 rehearsal mode is declared, named, and a lock of ${eff.mode.count} address-shaped entr(y/ies) is declared. The gate checks that the lock EXISTS; per-recipient enforcement at send time is slice 04 and is not proven by this row`);
  } else pass("dedicated-domain", `${domain} is neither the product domain nor a subdomain of it`);

  // ---- live DNS, not a file ----
  const spf = (await txt(domain)).filter((r) => r.startsWith("v=spf1"));
  spf.length ? pass("spf", spf[0]) : refuse("spf", `no v=spf1 TXT record resolves for ${domain} (live lookup)`);

  const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => r.startsWith("v=DMARC1"));
  if (!dmarc.length) refuse("dmarc", `no v=DMARC1 TXT record resolves for _dmarc.${domain} (live lookup)`);
  else if (/p\s*=\s*none/.test(dmarc[0])) refuse("dmarc", `DMARC policy is p=none — published but not enforcing: ${dmarc[0]}`);
  else pass("dmarc", dmarc[0]);

  const selector = effectiveDkimSelector(cfg, eff.rehearsal);
  const dkim = await txt(`${selector}._domainkey.${domain}`);
  dkim.length ? pass("dkim", `${selector}._domainkey resolves`) : refuse("dkim", `no DKIM TXT at ${selector}._domainkey.${domain} (live lookup)`);

  // ---- provider auth status, through the interface ----
  let auth = null;
  try { auth = await provider().authStatus(); }
  catch (e) { refuse("provider-auth", `provider authStatus() failed: ${e.message}`); }

  if (auth) {
    for (const k of ["spf", "dkim", "dmarc"])
      auth[k] ? pass(`provider-${k}`, "provider reports authenticated") : refuse(`provider-${k}`, `provider reports ${k} NOT authenticated — a live DNS record the provider cannot see does not send mail`);

    // The warm-up clause.
    if (typeof auth.warmup_days === "number") {
      const claimed = readWarmupLog(cfg.warmup_log_path);
      if (auth.warmup_days < MIN_WARMUP_DAYS)
        refuse("warmup", `provider history shows ${auth.warmup_days}d of warm-up; ${MIN_WARMUP_DAYS}d required`);
      else if (claimed !== null && claimed > auth.warmup_days)
        refuse("warmup", `warm-up log claims ${claimed}d but provider history shows ${auth.warmup_days}d — the log is evidence for a human, never an input to PASS`);
      else pass("warmup", `provider history shows ${auth.warmup_days}d`);
    } else if (warmupApproved) {
      pass("warmup", "ATTESTED — not verified (approved in the inbox)");
    } else {
      refuse("warmup", "warm-up: ATTESTED — not verified. The provider exposes no send history, so this clause cannot be checked live; it requires an arc-inbox approval of this exact string. The gate never prints PASS for a clause it could not verify");
    }
  }

  return { ok: findings.every((f) => f.ok), findings };
}

// REQ-07. Seed-inbox smoke evidence must exist, be DATED, and be no older than 7 days.
//
// Undated is refused rather than accepted-with-a-warning: an undated file is indistinguishable
// from evidence produced before the last DNS change, and the whole point of the clause is that
// deliverability evidence decays. Unparseable is refused for the same reason — "we could not
// read it" must never read as "there was nothing wrong with it".
export const SEED_EVIDENCE_MAX_AGE_DAYS = 7;

export function seedSmokeFinding(path, now = Date.now()) {
  const rule = "seed-smoke";
  const p = String(path || "").trim();
  if (!p)
    return { ok: false, rule, detail: `seed_evidence_path is empty — no dated seed-inbox smoke exists. Phase-3 entry requires a run <=${SEED_EVIDENCE_MAX_AGE_DAYS} days old against >=2 owned seed mailboxes (REQ-07, ADR-0413)` };
  if (!existsSync(p))
    return { ok: false, rule, detail: `seed_evidence_path points at ${p}, which does not exist` };
  let ev;
  try { ev = JSON.parse(readFileSync(p, "utf8")); }
  catch { return { ok: false, rule, detail: `seed evidence at ${p} is not readable JSON — refusing, because an unreadable gate artifact must never pass as an unremarkable one` }; }

  const stamp = typeof ev.dated === "string" ? Date.parse(ev.dated) : NaN;
  if (!Number.isFinite(stamp))
    return { ok: false, rule, detail: `seed evidence at ${p} carries no parseable "dated" field — undated evidence cannot be shown to be fresh, so it is refused rather than trusted` };
  const ageDays = (now - stamp) / 86400000;
  if (ageDays > SEED_EVIDENCE_MAX_AGE_DAYS)
    return { ok: false, rule, detail: `seed evidence is ${ageDays.toFixed(1)} days old; the limit is ${SEED_EVIDENCE_MAX_AGE_DAYS} (REQ-07)` };
  if (ageDays < 0)
    return { ok: false, rule, detail: `seed evidence is dated ${Math.abs(ageDays).toFixed(1)} days in the FUTURE — refusing rather than treating a forward-dated artifact as fresh` };

  // DISTINCT, non-empty strings. `length >= 2` alone accepted the same mailbox listed twice
  // and even `[null, 0]` — and this is REQ-07, the gate that decides whether a real campaign
  // may start. "Two mailboxes" means two, and the point of the clause is provider diversity.
  const raw = Array.isArray(ev.mailboxes) ? ev.mailboxes : [];
  const mailboxes = [...new Set(raw.filter((m) => typeof m === "string" && m.trim()).map((m) => m.trim().toLowerCase()))];
  if (mailboxes.length < 2)
    return { ok: false, rule, detail: `seed evidence names ${mailboxes.length} distinct non-empty mailbox(es) out of ${raw.length} entries; REQ-07 requires >=2 owned seed mailboxes (Gmail + Outlook-class)` };
  const missing = ["inbox_placement", "auth_headers", "unsubscribe", "reply_ingested", "bounce_ingested"]
    .filter((k) => ev[k] !== true);
  if (missing.length)
    return { ok: false, rule, detail: `seed evidence does not assert ${missing.join(", ")} — every clause must be true, and an absent clause is a failed one` };
  return { ok: true, rule, detail: `seed smoke ${ageDays.toFixed(1)}d old across ${mailboxes.length} mailboxes` };
}

function readWarmupLog(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const log = JSON.parse(readFileSync(path, "utf8"));
    return typeof log.days === "number" ? log.days : null;
  } catch { return null; }
}
