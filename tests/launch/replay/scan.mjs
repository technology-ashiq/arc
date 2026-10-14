// The redaction check CI runs over every replay recording (Phase 01 verification plan): it FAILS on a live token shape,
// a Supabase project ref other than the fixture one, an unmasked session cookie or magic-link token, a Cloudflare-
// shaped id that is not a placeholder, or an address outside the venture's probe users and the placeholder.
//   node tests/launch/replay/scan.mjs [dir]   -> "scan: files=N findings=0" (exit 0) or the findings (exit 1)
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "recorded");
console.log("RAN scan");
const MASKED = /^[aXx0_+/=.-]*$/;
const findings = [];
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
for (const f of files) {
  const s = readFileSync(join(dir, f), "utf8");
  const add = (what) => findings.push(`${f}: ${what}`);
  for (const m of s.matchAll(/eyJ([A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,})/g)) if (!MASKED.test(m[1])) add("a JWT that is not masked");
  for (const m of s.matchAll(/\b(sb_secret_|sb_publishable_|sbp_|re_|rzp_test_|rzp_live_|gho_|ghp_|ghs_|ghu_|sntrys_|sntryu_)([A-Za-z0-9_+/=-]{8,})/g))
    if (!MASKED.test(m[2])) add(`a ${m[1]} token that is not masked`);
  for (const m of s.matchAll(/AIza([0-9A-Za-z_-]{35})/g)) if (!MASKED.test(m[1])) add("a Google key that is not masked");
  for (const m of s.matchAll(/\b([a-z0-9]{20})\.supabase\.co\b/g)) if (m[1] !== "fixtureref0000000001") add("a Supabase project ref");
  for (const m of s.matchAll(/(?:\bid|\bref|organization_id|organization_slug|project_ref)\\?"\s*:\s*\\?"([a-z0-9]{20})\\?"/g))
    if (!/^fixture(ref|org|id)0*[0-9]+$/.test(m[1])) add("a Supabase project or organization id");
  for (const m of s.matchAll(/base64-([A-Za-z0-9+/=_-]{8,})/g)) if (!MASKED.test(m[1])) add("a session cookie value");
  for (const m of s.matchAll(/(?:hashed_token|token_hash|access_token|refresh_token)\\?"\s*:\s*\\?"([A-Za-z0-9._~+/=-]{8,})/g)) if (!MASKED.test(m[1])) add("a login token");
  for (const m of s.matchAll(/[?&](?:token|token_hash|code)=([A-Za-z0-9._~%-]{8,})/g)) if (!MASKED.test(m[1])) add("a link token");
  for (const m of s.matchAll(/\b[0-9a-f]{32}\b/g)) if (!/^0+[0-9]+$/.test(m[0])) add("a 32-hex id that is not a placeholder");
  for (const m of s.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g))
    if (!/@sandbox\.automemory\.ai$/.test(m[0]) && m[0] !== "owner@example.invalid") add("an e-mail address");
  if (/(?<!technology-)ashiq/i.test(s)) add("the owner's name");
}
// A directory with no recording is not a clean one (attack 9eaf4f1 B8).
if (!files.length) findings.push(`${dir}: no recording to scan`);
for (const x of findings) console.log(x);
console.log(`scan: files=${files.length} findings=${findings.length}`);
process.exit(findings.length ? 1 : 0);
