// tests/distribute/redact-replay.mjs -- replays debt row 24's quarantined ship.done through arc-event's own seal
// path (validate -> scan), for tests/distribute-redact-replay.bats. Each case is a payload; the line printed is the
// verdict the emitter would reach, `hit <rule>` or `clean`. The positive control must stay a hit.
// Usage: node tests/distribute/redact-replay.mjs   Last line: `RAN redact-replay`.
import { scanSecrets } from "../../.claude/scripts/hq/lib/redact.mjs";

// The envelope arc-event seals around a payload, in its canonical (sorted-key, compact) form. `process` sorts right
// after `payload` and its value holds an `@`, which is what a bare-host URL at the payload's end ran into.
const envelope = (payload) => ({
  actor: "arc-event", cost: null, evidence: "initiatives/distribute/evidence/phase-07/transcripts/5c-arc-ship.jsonl",
  id: "01M4TFXJ3SBRKA9JXCJRH9QP4P", idem: "ab7b712bf56ba83b243be2346698a27ef6a2b5bc3cb4e27d6d410419cdd97fd4", kind: "ship.done",
  model: "openrouter/deepseek/deepseek-v4-flash-0731", outcome: "ok", payload, process: "arc-event@1.0.0", run_id: "r-adhoc",
  ts: "2026-10-13T16:50:50+05:30",
});
const canonical = (v) => (v === null || typeof v !== "object" ? JSON.stringify(v)
  : Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`);

// The credential controls are assembled here, never written whole: the repo's own secret scanners (and arc-attack's
// input scan) would refuse a file that holds the shape, which is the rule working.
const AT = String.fromCharCode(64);
const dsn = ["postgres", "://", "arc", ":", "hunter2222", AT, "db.internal:5432/x"].join("");
const split = [["postgres", "://", "arc_app"].join(""), [":", "s3cr3tpassword", AT, "db.internal:5432/arc"].join("")];

const cases = [
  ["landed", { harness: "opencode", summary: "ship.done for feat/distribute-c2-oc-session (Vercel production)", url: "wt-oc-req03.vercel.app" }],
  ["bare-https", { harness: "opencode", summary: "ship.done for feat/distribute-c2-oc-session (Vercel production)", url: "https://wt-oc-req03.vercel.app" }],
  ["team-https", { harness: "opencode", summary: "Production: https://wt-oc-req03-technology-ashiqs-projects.vercel.app [3s]", url: "https://wt-oc-req03-technology-ashiqs-projects.vercel.app" }],
  ["pr-url", { harness: "opencode", summary: "shipped to the PR; deploy https://wt-oc-req03.vercel.app", url: "https://github.com/technology-ashiq/arc/pull/416" }],
  ["control", { harness: "opencode", summary: "db", url: dsn }],
  // A DSN split at its colon across two fields is rebuilt by the scanner's adjacency joins, quote rule or not.
  ["control-split", { a: split[0], b: split[1] }],
];
for (const [name, payload] of cases) {
  const event = envelope(payload);
  const v = scanSecrets(canonical(event), event);
  process.stdout.write(`${name} ${v.hit ? `hit ${v.rule}` : "clean"}\n`);
}
process.stdout.write("RAN redact-replay\n");
