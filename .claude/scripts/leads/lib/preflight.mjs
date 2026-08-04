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
export function domainConflict(sending, productDomains) {
  const s = String(sending || "").toLowerCase().replace(/\.$/, "");
  for (const raw of productDomains || []) {
    const p = String(raw).toLowerCase().replace(/\.$/, "");
    if (!p) continue;
    if (s === p) return `sending domain "${s}" IS the product domain`;
    if (s.endsWith("." + p)) return `sending domain "${s}" is a subdomain of product domain "${p}" — reputation aggregates to the organizational domain, so a burn takes the parent with it`;
  }
  return null;
}

async function txt(name) {
  try { return (await dns().resolveTxt(name)).map((r) => r.join("")); }
  catch { return []; }
}

export async function preflight({ config, warmupApproved = false } = {}) {
  const cfg = config || loadConfig();
  const findings = [];
  const refuse = (rule, detail) => findings.push({ ok: false, rule, detail });
  const pass = (rule, detail) => findings.push({ ok: true, rule, detail });

  const domain = String(cfg.sending_domain || "").trim();
  if (!domain) {
    refuse("sending-domain", "sending_domain is empty — no dedicated cold-outbound domain exists yet (ADR-0413). This is the honest committed value, and it refuses rather than passing vacuously");
    return { ok: false, findings };
  }

  const conflict = domainConflict(domain, cfg.product_domains);
  if (conflict) refuse("dedicated-domain", conflict + " (ADR-0402)");
  else pass("dedicated-domain", `${domain} is neither the product domain nor a subdomain of it`);

  // ---- live DNS, not a file ----
  const spf = (await txt(domain)).filter((r) => r.startsWith("v=spf1"));
  spf.length ? pass("spf", spf[0]) : refuse("spf", `no v=spf1 TXT record resolves for ${domain} (live lookup)`);

  const dmarc = (await txt(`_dmarc.${domain}`)).filter((r) => r.startsWith("v=DMARC1"));
  if (!dmarc.length) refuse("dmarc", `no v=DMARC1 TXT record resolves for _dmarc.${domain} (live lookup)`);
  else if (/p\s*=\s*none/.test(dmarc[0])) refuse("dmarc", `DMARC policy is p=none — published but not enforcing: ${dmarc[0]}`);
  else pass("dmarc", dmarc[0]);

  const selector = cfg.dkim_selector || "default";
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

function readWarmupLog(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const log = JSON.parse(readFileSync(path, "utf8"));
    return typeof log.days === "number" ? log.days : null;
  } catch { return null; }
}
