// The adapter's whole world (ADR-1704, ADR-1719). An adapter gets this object and nothing else: a fetch wrapped to
// its row's hosts, a writer confined to the venture root, a resource reporter that persists before returning, and a
// sensitive-action check that pauses for the owner. Every refusal is an Error with a .code an adapter cannot mistake.
import { mkdirSync, writeFileSync, realpathSync, lstatSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, join, sep } from "node:path";

export function refusal(code, message, extra = {}) {
  return Object.assign(new Error(message), { code }, extra);
}

export function hostAllowed(host, hosts) {
  const h = String(host).toLowerCase();
  return (hosts || []).some((a) => h === a.toLowerCase() || h.endsWith(`.${a.toLowerCase()}`));
}

// Every component from the root down to the LEAF is lstat'ed, and any symlink refuses -- wherever it points, dangling
// included. Resolving only the ancestors (the first version) let `root/evil -> /outside` carry a write out through
// the leaf itself (attack 06cbc03 L1). An adapter never needs to write through a link, so none is followed.
export function confinedPath(root, rel) {
  if (typeof rel !== "string" || rel === "" || isAbsolute(rel)) throw refusal("WRITE_REFUSED", `write path ${JSON.stringify(rel)} must be relative to the venture root`);
  // `C:foo` (drive-relative), `file.txt:stream` (an NTFS stream) and device names read as files on one OS and as
  // something else on Windows; none is a file an adapter needs (attack 06cbc03 B6).
  for (const part of rel.split(/[\\/]/))
    if (part.includes(":") || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i.test(part) || /[. ]$/.test(part) && part !== "." && part !== "..")
      throw refusal("WRITE_REFUSED", `write path ${JSON.stringify(rel)} has a component (${part}) that is not a plain file name on every OS`);
  const realRoot = realpathSync(root);
  const abs = resolve(realRoot, rel);
  const r = relative(realRoot, abs);
  if (r === "" || r.startsWith("..") || isAbsolute(r)) throw refusal("WRITE_REFUSED", `write ${rel} resolves outside the venture root`);
  let cur = realRoot;
  for (const part of r.split(sep)) {
    cur = join(cur, part);
    let st;
    try { st = lstatSync(cur); } catch (e) { if (e.code === "ENOENT") break; throw e; }
    if (st.isSymbolicLink()) throw refusal("WRITE_REFUSED", `write ${rel} passes through a link (${relative(realRoot, cur)}); adapters never write through links`);
  }
  return abs;
}

const PROBE_HOSTS = ["dns.google", "cloudflare-dns.com"];

// `upstream` holds what the runner recorded for this slot's own depends_on slots, nothing wider (ADR-1725). Each value
// is another adapter's output: the reader validates it before using it.
function freezeUpstream(upstream) {
  return Object.freeze(Object.fromEntries(Object.entries(upstream || {}).map(([s, rs]) =>
    [s, Object.freeze((rs || []).map((r) => Object.freeze({ kind: String(r.kind), id: String(r.id) })))])));
}

export function makeCtx({ profile, board, slot, row, root, resources, upstream, tag, attempt, signal, env, report, approvals = [] }) {
  const queued = [];
  const guardedFetch = (hosts) => async (url, init = {}) => {
    let u;
    try { u = new URL(url); } catch { throw refusal("HOST_REFUSED", `not a URL: ${url}`); }
    if (u.protocol !== "https:") throw refusal("HOST_REFUSED", `${u.protocol} refused; adapters speak https only`);
    if (!hostAllowed(u.hostname, hosts)) throw refusal("HOST_REFUSED", `${u.hostname} is not in this provider's hosts[] (${hosts.join(", ")})`);
    if (signal && signal.aborted) throw refusal("ABORTED", "slot timeout reached");
    // Redirects are never followed: the allowlist checks one URL, and a followed 3xx would land on a host nobody
    // checked (attack 3b48ed1 B1). The adapter sees the 3xx and may call ctx.fetch on its Location, which is checked.
    return fetch(u, { ...init, redirect: "manual", signal });
  };
  const probeFetch = guardedFetch(PROBE_HOSTS);
  return Object.freeze({
    profile, board, slot, provider: row.id, root, resources: [...(resources || [])], upstream: freezeUpstream(upstream), tag, attempt, signal,
    env: Object.freeze({ ...env }),
    fetch: guardedFetch(row.hosts || []),
    write(rel, text) {
      const abs = confinedPath(root, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, text);
      return rel;
    },
    report(resource) {
      if (!resource || typeof resource.kind !== "string" || typeof resource.id !== "string")
        throw refusal("BAD_RESOURCE", "report() takes { kind, id }");
      report({ kind: resource.kind, id: resource.id, tag });
    },
    sensitive(action) {
      if (!(row.sensitive_actions || []).includes(action))
        throw refusal("SENSITIVE_UNDECLARED", `${action} is not in this provider's sensitive_actions[]`);
      if (!approvals.includes(action)) throw refusal("APPROVAL_PENDING", `${action} needs the owner's approval first`, { action });
    },
    probe: Object.freeze({
      // DNS over HTTPS from two independent public resolvers; the caller compares the answers.
      async doh(name, type = "A") {
        const q = `name=${encodeURIComponent(name)}&type=${type}`;
        const ask = async (base) => (await probeFetch(`${base}?${q}`, { headers: { accept: "application/dns-json" } })).json();
        return { google: await ask("https://dns.google/resolve"), cloudflare: await ask("https://cloudflare-dns.com/dns-query") };
      },
    }),
    emit(kind, payload) {
      if (kind !== "note.logged") throw refusal("EMIT_REFUSED", "an adapter may only queue note.logged; receipts are the runner's");
      queued.push({ kind, payload });
    },
    get queued() { return queued; },
  });
}
