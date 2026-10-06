// tests/discover/probe.mjs -- pure-function probes for the discover bats suites.
// Usage: node tests/discover/probe.mjs <case> [args...]   (run with cwd = repo root)
// Every case ends by printing `RAN <case>` so a suite can assert the probe reached its end.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lib = (p) => import(new URL(`../../.claude/scripts/discover/${p}`, import.meta.url).href);
const [, , which, ...args] = process.argv;
const out = (s) => process.stdout.write(s + "\n");

const cases = {
  async normalize() {
    const { normalizeText, normalizeCount, ABSENT, wellFormed } = await lib("lib/normalize.mjs");
    const cp = (...c) => String.fromCodePoint(...c);
    const checks = [
      ["null", normalizeText(null) === ABSENT],
      ["blank", normalizeText(" \n\t ") === ABSENT],
      ["newline-flattened", normalizeText("a\nb\r\nc") === "a b c"],
      ["format-chars-gone", !/\p{Cf}/u.test(normalizeText(`x${cp(0x202e)}y${cp(0x200b)}z${cp(0xfeff)}`))],
      ["nul-gone", !normalizeText(`a${cp(0)}b`).includes(cp(0))],
      ["lone-surrogate-wellformed", (() => { const s = normalizeText("a" + String.fromCharCode(0xd800) + "b"); return s === wellFormed(s) && s.includes(String.fromCharCode(0xfffd)); })()],
      ["cap-bytes", new TextEncoder().encode(normalizeText("é".repeat(5000), 100)).length <= 100],
      ["cap-no-split", !normalizeText("é".repeat(5000), 101).includes(cp(0xfffd))],
      ["count-negative", normalizeCount(-1) === ABSENT],
      ["count-float", normalizeCount(1.5) === ABSENT],
      ["count-string", normalizeCount("7") === ABSENT],
      ["count-zero", normalizeCount(0) === 0],
    ];
    for (const [n, ok] of checks) out(`${ok ? "PASS" : "FAIL"} ${n}`);
  },
  async jaccard() {
    const { jaccard, tokens, stem } = await lib("lib/cluster.mjs");
    out(`same ${jaccard(["a", "b"], ["b", "a"])}`);
    out(`half ${jaccard(["a", "b"], ["a", "c"])}`);
    out(`empty ${jaccard([], ["a"])}`);
    out(`stem ${stem("invoices")} ${stem("companies")} ${stem("class")}`);
    out(`tokens ${tokens("Ask HN: How do you chase late invoices?").join(",")}`);
  },
  // Same records in three orders -> one document.
  async shuffle() {
    const { fixtureFetch, mine } = await lib("miners/hn.mjs");
    const { cluster, clustersDocument, sha256 } = await lib("lib/cluster.mjs");
    const fx = JSON.parse(readFileSync(join(ROOT, args[0]), "utf8"));
    const queries = fx.responses.map((r) => r.query);
    const { records, skipped } = await mine(queries, { fetchImpl: fixtureFetch(fx), pace: async () => {} });
    if (records.length < 12) throw new Error(`fixture too small: ${records.length} records`);
    const orders = [records, [...records].reverse(), [...records.slice(7), ...records.slice(0, 7)]];
    const hashes = orders.map((rs) => sha256(clustersDocument("x", rs, skipped, cluster(rs))));
    out(`records ${records.length}`);
    out(hashes.every((h) => h === hashes[0]) ? `SHUFFLE_EQUAL ${hashes[0]}` : `SHUFFLE_DIFFER ${hashes.join(" ")}`);
  },
  // A reject whose tokens match the biggest cluster marks it, and only it.
  async rejectmatch() {
    const { fixtureFetch, mine } = await lib("miners/hn.mjs");
    const { cluster } = await lib("lib/cluster.mjs");
    const fx = JSON.parse(readFileSync(join(ROOT, args[0]), "utf8"));
    const { records } = await mine(fx.responses.map((r) => r.query), { fetchImpl: fixtureFetch(fx), pace: async () => {} });
    const base = cluster(records).clusters;
    const target = base[0];
    const marked = cluster(records, { rejects: [{ receipt: "01TESTRECEIPT0000000000000", tokens: target.top_tokens }] }).clusters;
    const hits = marked.filter((c) => c.previously_rejected === "01TESTRECEIPT0000000000000");
    // A reject marks its own cluster and any near-duplicate of it (Jaccard >= threshold): that is the point.
    out(`marked ${hits.length >= 1 ? "some" : "none"} target ${hits.some((c) => c.cluster_fp === target.cluster_fp)} unmarked ${marked.length - hits.length > 0}`);
  },
  // Structural facts about a clusters.json, asserted by count before any hash is compared.
  async shape() {
    const doc = JSON.parse(readFileSync(args[0], "utf8"));
    out(`records ${doc.records}`);
    out(`clusters ${doc.clusters.length}`);
    out(`multi ${doc.clusters.filter((c) => c.size >= 2).length}`);
    out(`noFloat ${!/[0-9]\.[0-9]/.test(JSON.stringify(doc.clusters.map((c) => [c.size, c.first_ts])))}`);
    out(`skipped ${JSON.stringify(doc.skipped)}`);
  },
  // Facts about records.ndjson from the hostile fixture.
  async hostile() {
    const rows = readFileSync(args[0], "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const by = Object.fromEntries(rows.map((r) => [r.source_id, r]));
    const enc = new TextEncoder();
    out(`rows ${rows.length}`);
    out(`singleLine ${rows.every((r) => !/[\r\n]/.test(r.title) && !/[\r\n]/.test(r.text))}`);
    out(`noFormat ${rows.every((r) => !/[\p{Cc}\p{Cf}]/u.test(r.title + r.text))}`);
    out(`textCapped ${rows.every((r) => enc.encode(r.text).length <= 4096)}`);
    out(`subst ${(by["hn:101"] || {}).title}`);
    out(`badCounts ${JSON.stringify((by["hn:109"] || {}).engagement)} ${(by["hn:109"] || {}).ts}`);
    out(`replacement ${String((by["hn:110"] || {}).title).includes(String.fromCodePoint(0xfffd))}`);
  },
  // The reject reader, over whatever ARC_SPINE_ROOT holds.
  async rejects() {
    const { readRejects } = await import(new URL("../../.claude/scripts/discover/lib/spine.mjs", import.meta.url).href);
    const r = await readRejects();
    out(`rejects ${r.length} ${r.map((x) => x.tokens.join("+")).join(" ")}`);
  },
  async captured() {
    const { capturedIds } = await import(new URL("../../.claude/scripts/discover/lib/spine.mjs", import.meta.url).href);
    out(`captured ${(await capturedIds()).size}`);
  },
};

if (!cases[which]) { process.stderr.write(`probe: unknown case ${which}\n`); process.exitCode = 2; }
else { await cases[which](); out(`RAN ${which}`); }
