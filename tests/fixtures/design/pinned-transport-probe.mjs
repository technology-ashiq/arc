// Probe for design-robots.mjs realTransport (phase-02 logic pass, attack r1 B1).
// A local server counts the requests that reach it; an injected resolver plays the rebinding
// host. Prints one JSON line. Usage: node pinned-transport-probe.mjs <path to design-robots.mjs>
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const { realTransport } = await import(pathToFileURL(process.argv[2]).href);
let hits = 0;
const server = createServer((req, res) => { hits++; res.end("User-agent: *\nAllow: /\n"); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

async function attempt(transport, url) {
  try { const r = await transport.get(url); return { ok: true, status: r.status }; }
  catch (e) { return { ok: false, error: String(e && e.message) }; }
}

const out = { ran: [] };

// A: the host resolves to loopback. The check and the connection share ONE resolution.
let callsA = 0;
const loopback = async () => { callsA++; return [{ address: "127.0.0.1", family: 4 }]; };
out.a = await attempt(realTransport({ resolve: loopback }), `http://rebind.test:${port}/robots.txt`);
out.a.calls = callsA;
out.ran.push("a");

// B: a public address with a private one beside it. Every address is checked, not the first.
const mixed = async () => [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
out.b = await attempt(realTransport({ resolve: mixed }), `http://rebind.test:${port}/robots.txt`);
out.b.calls = 1;
out.ran.push("b");

// C: an IP literal skips any lookup, so it is checked on the value itself.
out.c = await attempt(realTransport(), `http://127.0.0.1:${port}/robots.txt`);
out.ran.push("c");

out.hits = hits;
server.close();
process.stdout.write(`${JSON.stringify(out)}\n`);
