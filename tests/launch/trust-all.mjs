// REQ-09 over every BUILT adapter in the real registry (ADR-1719, ADR-1749). Each adapter is checked four ways, and the
// arm prints the count it checked first, so an empty sweep cannot pass:
//   digest    a CRLF copy keeps its digest; a one-byte edit changes it, and checkAdapter refuses the row as DIGEST_DRIFT
//   hosts     scaffold and verify run under a row whose hosts[] lists nothing reachable: no request ever leaves
//             (globalThis.fetch counts them), and any request the adapter tried was refused as HOST_REFUSED
//   write     ctx.write outside the venture root throws WRITE_REFUSED
//   sensitive each sensitive_actions[] entry is refused as APPROVAL_PENDING until approved
// Prints `RAN all` first and `DONE <json>` last.
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRegistry, PRODUCT, PATHS } from "../../.claude/scripts/launch/lib/catalog.mjs";
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";
import { adapterDigest } from "../../.claude/scripts/launch/lib/scan.mjs";
import { checkAdapter, resolvePaths } from "../../.claude/scripts/launch/lib/runner.mjs";

console.log("RAN all");
const rows = loadRegistry().filter((r) => existsSync(join(PRODUCT, r.adapter)));
const sent = [];
globalThis.fetch = async (u) => { sent.push(String(u)); throw new TypeError("fetch failed"); };
const tmp = mkdtempSync(join(tmpdir(), "launch-trust-all-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

const results = [];
for (const row of rows) {
  const r = { id: row.id };
  const src = join(PRODUCT, row.adapter);
  const bytes = readFileSync(src, "utf8");
  // digest: a CRLF copy and a one-byte edit, in a providers tree of their own so checkAdapter reads them.
  const prov = join(tmp, row.id, "providers");
  const at = join(prov, row.adapter.replace(/^providers\//, ""));
  mkdirSync(dirname(at), { recursive: true });
  const reg = join(tmp, row.id, "registry.yaml");
  writeFileSync(reg, "providers: []\n");
  // Normalise first: an autocrlf checkout already holds CRLF, and a bare \n -> \r\n would make it \r\r\n (attack 143525f B10).
  writeFileSync(at, bytes.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"));
  const pinned = adapterDigest(src);
  r.crlfSame = adapterDigest(at) === pinned;
  writeFileSync(at, bytes + " ");
  r.editDiffers = adapterDigest(at) !== pinned;
  try {
    checkAdapter({ ...resolvePaths({ registry: reg, providersDir: prov }), providersDir: prov }, { ...row, status: "vetted", digest: pinned });
    r.drift = "none";
  } catch (e) { r.drift = e.code || "error"; }
  // hosts + write + sensitive: the real adapter under the real ctx, with a row that allows no reachable host.
  const root = join(tmp, row.id, "venture");
  mkdirSync(root, { recursive: true });
  const env = Object.fromEntries((row.env_keys || []).map((k) => [k, "fixture_value_0123456789abcdefABCDEF"]));
  const fenced = { ...row, hosts: ["fixture.invalid"] };
  const ctxFor = (approvals = []) => makeCtx({
    profile: { slug: "arc-sandbox", type: "saas-b2b", region: "in", payment_model: "gateway", honesty_class: "rehearsal", brand: { name: "arc sandbox", domain: "sandbox.automemory.ai" } },
    board: {}, slot: { id: row.slot }, row: fenced, root, resources: [], upstream: {}, tag: `arc-sandbox@${row.slot}@${row.id}`, attempt: 1,
    signal: undefined, env, report: () => {}, approvals,
  });
  const before = sent.length;
  const mod = await import(pathToFileURL(src).href);
  const codes = [];
  for (const step of ["scaffold", "verify"]) {
    try {
      const out = await mod[step](ctxFor());
      if (out && out.ok === false && /HOST_REFUSED/.test(String(out.reason))) codes.push("HOST_REFUSED");
    } catch (e) { codes.push(e.code || "error"); }
  }
  r.leaked = sent.length - before;
  r.hostRefused = codes.includes("HOST_REFUSED");
  try { ctxFor().write("../outside.txt", "x"); r.write = "written"; } catch (e) { r.write = e.code || "error"; }
  r.sensitive = (row.sensitive_actions || []).map((a) => {
    try { ctxFor().sensitive(a); return `${a}:allowed`; } catch (e) { return `${a}:${e.code}`; }
  });
  r.sensitiveApproved = (row.sensitive_actions || []).map((a) => {
    try { ctxFor([a]).sensitive(a); return `${a}:allowed`; } catch (e) { return `${a}:${e.code}`; }
  });
  results.push(r);
}
console.log(`DONE ${JSON.stringify({ checked: results.length, registry: PATHS.registry.split(/[\\/]/).pop(), results })}`);
