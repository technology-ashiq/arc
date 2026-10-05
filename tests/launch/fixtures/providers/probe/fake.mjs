// Fixture adapter for the runner and trust suites. Its "provider" is a JSON file (FAKE_PROVIDER_FILE) that outlives a
// killed process, so a test can count what really exists after a crash. Behaviour is steered by env:
//   FAKE_DIE_AFTER=rN          create + report rN, then SIGKILL this process (a real kill, no finally blocks run)
//   FAKE_DIE_BEFORE_REPORT=rN  create rN at the provider, then SIGKILL before reporting it
//   FAKE_KILL_PARENT=rN        after reporting rN, SIGKILL the runner holding the lock, then this process
//   FAKE_SLEEP_MS=n            after r1, wait n ms (the slot timeout must kill us first)
//   FAKE_HOLD_MS=n             print FAKE_HOLDING, then wait n ms before doing anything (the concurrency fixture)
//   FAKE_FETCH_HOST=h          call ctx.fetch("https://h/") before creating anything
//   FAKE_WRITE=rel             call ctx.write(rel) before creating anything
//   FAKE_SENSITIVE=action      call ctx.sensitive(action) before creating anything
//   FAKE_PRINT_UPSTREAM=1      print `FAKE_UPSTREAM <json of ctx.upstream>` before creating anything
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export const id = "fake";
export const slot = "probe";

const file = () => process.env.FAKE_PROVIDER_FILE;
const read = () => (existsSync(file()) ? JSON.parse(readFileSync(file(), "utf8")) : []);
const sleep = (ms, signal) => new Promise((res, rej) => {
  const t = setTimeout(res, ms);
  if (signal) signal.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { code: "ABORTED" })); });
});

export async function scaffold(ctx) {
  const env = process.env;
  if (env.FAKE_HOLD_MS) { console.log("FAKE_HOLDING"); await sleep(Number(env.FAKE_HOLD_MS)); }
  if (env.FAKE_FETCH_HOST) await ctx.fetch(`https://${env.FAKE_FETCH_HOST}/`);
  if (env.FAKE_WRITE) ctx.write(env.FAKE_WRITE, "fixture\n");
  if (env.FAKE_SENSITIVE) ctx.sensitive(env.FAKE_SENSITIVE);
  if (env.FAKE_PRINT_UPSTREAM) console.log(`FAKE_UPSTREAM ${JSON.stringify(ctx.upstream)}`);
  for (const name of ["r1", "r2"]) {
    const have = read().find((r) => r.tag === ctx.tag && r.name === name);
    let rid = have && have.id;
    if (!rid) {
      const all = read();
      rid = `${name}-${all.length + 1}`;
      writeFileSync(file(), JSON.stringify([...all, { tag: ctx.tag, name, id: rid }]));
      console.log(`FAKE_CREATED ${name}`);
      if (env.FAKE_DIE_BEFORE_REPORT === name) process.kill(process.pid, "SIGKILL");
    }
    ctx.report({ kind: "fake", id: rid });
    if (env.FAKE_DIE_AFTER === name) process.kill(process.pid, "SIGKILL");
    if (env.FAKE_KILL_PARENT === name) { process.kill(process.ppid, "SIGKILL"); process.kill(process.pid, "SIGKILL"); }
    if (name === "r1" && env.FAKE_SLEEP_MS) await sleep(Number(env.FAKE_SLEEP_MS), ctx.signal);
  }
  return { files: [], resources: read().filter((r) => r.tag === ctx.tag), notes: [] };
}

export function envContract() {
  return process.env.FAKE_NEEDS_KEY ? [process.env.FAKE_NEEDS_KEY] : [];
}

// The fixture's outside world is the provider file: verify asks it, never the runner's own state.
export async function verify(ctx) {
  const mine = read().filter((r) => r.tag === ctx.tag);
  return mine.length === 2 ? { ok: true, answerer: "fake-provider-file", evidence: { resources: mine.length } } : { ok: false, reason: `provider holds ${mine.length} of 2` };
}

export async function teardown(ctx) {
  return { steps: ctx.resources.map((r, i) => ({ order: i + 1, action: "delete", resource: r.id })) };
}
