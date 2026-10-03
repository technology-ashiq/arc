// The adapter's whole world (ADR-1704, ADR-1719). An adapter gets this object and nothing else: a fetch wrapped to
// its row's hosts, a writer confined to the venture root, a resource reporter that persists before returning, and a
// sensitive-action check that pauses for the owner. Every refusal is an Error with a .code an adapter cannot mistake.
import { mkdirSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute } from "node:path";

export function refusal(code, message, extra = {}) {
  return Object.assign(new Error(message), { code }, extra);
}

export function hostAllowed(host, hosts) {
  const h = String(host).toLowerCase();
  return (hosts || []).some((a) => h === a.toLowerCase() || h.endsWith(`.${a.toLowerCase()}`));
}

// The nearest existing ancestor, resolved through symlinks -- so a link inside the venture root that points
// outside it cannot carry a write out (the path string alone would look confined).
function realAncestor(p) {
  let cur = p;
  while (!existsSync(cur)) {
    const up = dirname(cur);
    if (up === cur) return cur;
    cur = up;
  }
  return realpathSync(cur);
}

export function confinedPath(root, rel) {
  if (typeof rel !== "string" || rel === "" || isAbsolute(rel)) throw refusal("WRITE_REFUSED", `write path ${JSON.stringify(rel)} must be relative to the venture root`);
  const realRoot = realpathSync(root);
  const abs = resolve(realRoot, rel);
  const inside = (p) => { const r = relative(realRoot, p); return r === "" ? false : !r.startsWith("..") && !isAbsolute(r); };
  if (!inside(abs)) throw refusal("WRITE_REFUSED", `write ${rel} resolves outside the venture root`);
  const anc = realAncestor(dirname(abs));
  if (anc !== realRoot && !inside(anc)) throw refusal("WRITE_REFUSED", `write ${rel} passes through a link that leaves the venture root`);
  return abs;
}

const PROBE_HOSTS = ["dns.google", "cloudflare-dns.com"];

export function makeCtx({ profile, board, slot, row, root, resources, tag, attempt, signal, env, report, approvals = [] }) {
  const queued = [];
  const guardedFetch = (hosts) => async (url, init = {}) => {
    let u;
    try { u = new URL(url); } catch { throw refusal("HOST_REFUSED", `not a URL: ${url}`); }
    if (u.protocol !== "https:") throw refusal("HOST_REFUSED", `${u.protocol} refused; adapters speak https only`);
    if (!hostAllowed(u.hostname, hosts)) throw refusal("HOST_REFUSED", `${u.hostname} is not in this provider's hosts[] (${hosts.join(", ")})`);
    if (signal && signal.aborted) throw refusal("ABORTED", "slot timeout reached");
    return fetch(u, { ...init, signal });
  };
  const probeFetch = guardedFetch(PROBE_HOSTS);
  return Object.freeze({
    profile, board, slot, provider: row.id, root, resources: [...(resources || [])], tag, attempt, signal,
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
