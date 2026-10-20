// Debt D29: a request the slot timeout aborts reaches the adapter as code ABORTED, never as the DOMException's own
// numeric code. The REAL makeCtx, a transport that hangs until aborted, and an AbortController the arm fires.
// Prints `RAN ctx-abort` first and `DONE <json>` last.
import { makeCtx } from "../../.claude/scripts/launch/lib/ctx.mjs";

console.log("RAN ctx-abort");
globalThis.fetch = (u, init = {}) => new Promise((_, rej) => {
  init.signal.addEventListener("abort", () => rej(Object.assign(new Error("This operation was aborted"), { name: "AbortError", code: 20 })), { once: true });
});
const ac = new AbortController();
const ctx = makeCtx({ profile: { slug: "fx", brand: { domain: "fixture.invalid" } }, board: {}, slot: { id: "probe" }, row: { id: "fake", hosts: ["fixture.invalid"] },
  root: process.cwd(), resources: [], upstream: {}, tag: "t", attempt: 1, signal: ac.signal, env: {}, report: () => {} });
const p = ctx.fetch("https://fixture.invalid/").then(() => ({ resolved: true }), (e) => ({ code: e.code, name: e.name, message: e.message }));
setTimeout(() => ac.abort(), 10);
const got = await p;
console.log(`DONE ${JSON.stringify({ got })}`);
