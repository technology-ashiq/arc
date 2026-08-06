#!/usr/bin/env node
/**
 * policy-matrix -- the hook-interception feasibility matrix (REQ-01, ADR-0503, POL-H).
 *
 * GENERATED FROM .mcp.json, never hand-listed. That is the whole design: the scope boundary is a
 * file in the repo, so it is derivable, diffable, and it FAILS LOUDLY. A server declared in
 * .mcp.json with no row here is an exit-2 build failure rather than a silently unenforced
 * channel, which means adding a fifth server breaks the build instead of widening the hole.
 *
 *   node .claude/scripts/hq/policy-matrix.mjs [--from .mcp.json] [--out path.json] [--md path.md]
 *
 * Exit codes: 0 every row carries a verdict and a capability · 1 usage/IO · 2 a row or a server
 * could not be classified.
 *
 * "Hook later" is not a state (POL-H). Every row lands on one of three verdicts:
 *   intercepted  a fixture proves a PreToolUse fragment can block it
 *   static-deny  assigned a permissions.deny rule, because ADR-0501 says a hook that never runs
 *                cannot deny and these classes are not cheaply reversible
 *   capped-l1    the surface may not exceed L1 (POL-G applied to an unprovable surface)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildResourceGuard, guardedEntryFor } from "./lib/policy/resources.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(readFileSync(join(HERE, "lib", "policy", "tool-capabilities.json"), "utf8"));

/** The same un-grantable set the engine enforces, so this tool cannot be turned against it. */
const GUARDED = [
  ".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/**", "hq.policy.yaml",
  ".claude/scripts/hq/lib/policy/**", ".claude/scripts/hq/policy-lint.mjs",
  ".claude/scripts/hq/policy-matrix.mjs",
];

/** ADR-0501: the classes whose misuse is not cheaply reversible carry a static deny as well. */
const STATIC_DENY = new Set(["spend", "deploy", "publish"]);

function verdictFor(capabilities) {
  if (capabilities.some((c) => STATIC_DENY.has(c))) return "static-deny";
  return "intercepted";
}

function arg(argv, name, fallback) {
  const i = argv.indexOf(name);
  return i === -1 || i === argv.length - 1 ? fallback : argv[i + 1];
}

function main(argv) {
  const from = arg(argv, "--from", ".mcp.json");
  const outJson = arg(argv, "--out", "initiatives/policy/evidence/phase-00/hook-matrix.json");
  const outMd = arg(argv, "--md", null);

  const mcpPath = resolve(process.cwd(), from);
  if (!existsSync(mcpPath)) {
    process.stderr.write(`policy-matrix: no such file: ${from}\n`);
    return 1;
  }
  const mcp = JSON.parse(readFileSync(mcpPath, "utf8"));
  const servers = Object.keys(mcp.mcpServers || mcp || {});

  const rows = [];
  const problems = [];

  // Built-in tool classes first -- they exist whatever .mcp.json says.
  for (const [tool, capabilities] of Object.entries(TABLE.builtin.tools)) {
    rows.push({
      surface: "builtin", server: null, tool, capability: capabilities,
      verdict: verdictFor(capabilities),
      fixture: "tests/policy-hook-matrix.bats:a fragment exiting 2 blocks the tool call",
    });
  }
  rows.push({
    surface: "builtin", server: null, tool: "*", capability: TABLE.builtin.default,
    verdict: verdictFor(TABLE.builtin.default),
    fixture: "tests/policy-hook-matrix.bats:a fragment exiting 2 blocks the tool call",
  });

  for (const server of servers) {
    const entry = TABLE.servers[server];
    if (!entry) {
      problems.push(
        `server ${JSON.stringify(server)} is declared in ${from} but absent from ` +
        `lib/policy/tool-capabilities.json -- an unclassified server is a build failure, never a ` +
        `default, because that is how an unenforced side-effect channel gets in quietly`
      );
      continue;
    }
    for (const [tool, capabilities] of Object.entries(entry.tools || {})) {
      rows.push({
        surface: "mcp", server, tool: `mcp__${server}__${tool}`, capability: capabilities,
        verdict: verdictFor(capabilities),
        fixture: "tests/policy-hook-matrix.bats:a fragment exiting 2 blocks the tool call",
      });
    }
    // The catch-all row. Its capability is the server's conservative default, so a tool nobody
    // enumerated is treated as the most dangerous thing this server can do.
    rows.push({
      surface: "mcp", server, tool: `mcp__${server}__*`, capability: entry.default,
      verdict: verdictFor(entry.default),
      fixture: "tests/policy-hook-matrix.bats:a fragment exiting 2 blocks the tool call",
    });
  }

  for (const r of rows) {
    if (!r.verdict) problems.push(`${r.tool} has no verdict`);
    if (!Array.isArray(r.capability) || r.capability.length === 0)
      problems.push(`${r.tool} has no capability`);
  }
  for (const server of servers)
    if (!rows.some((r) => r.server === server))
      problems.push(`server ${JSON.stringify(server)} produced zero rows`);

  // Both output paths are checked against the un-grantable list before anything is created.
  // An adversarial pass pointed out that mkdirSync({recursive:true}) + writeFileSync on an
  // attacker-supplied --out is an arbitrary-path write primitive living inside the policy
  // engine itself -- `--out .claude/settings.json` is the same call as the honest one.
  const guard = buildResourceGuard(GUARDED, process.cwd());
  for (const candidate of [outJson, outMd].filter(Boolean)) {
    const hit = guardedEntryFor(candidate, guard);
    if (hit) {
      process.stderr.write(`policy-matrix: refusing to write ${candidate} -- it resolves to the un-grantable resource ${hit}\n`);
      return 2;
    }
  }

  const outPath = resolve(process.cwd(), outJson);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(rows, null, 2) + "\n", "utf8");

  if (outMd) {
    const md = [
      "# Hook-interception feasibility matrix",
      "",
      `Generated from \`${from}\` by \`policy-matrix.mjs\`. Do not hand-edit -- a server with no`,
      "row is an exit-2 build failure, which is what keeps this honest.",
      "",
      "| surface | server | tool | capability | verdict |",
      "|---|---|---|---|---|",
      ...rows.map((r) =>
        `| ${r.surface} | ${r.server || "-"} | \`${r.tool}\` | ${r.capability.join(", ")} | ${r.verdict} |`),
      "",
    ].join("\n");
    const mdPath = resolve(process.cwd(), outMd);
    mkdirSync(dirname(mdPath), { recursive: true });
    writeFileSync(mdPath, md, "utf8");
  }

  if (problems.length) {
    process.stderr.write(`policy-matrix: ${problems.length} unclassified row(s)/server(s)\n`);
    for (const p of problems) process.stderr.write(`  - ${p}\n`);
    return 2;
  }

  process.stdout.write(
    `policy-matrix: ${rows.length} rows across ${servers.length} declared server(s) + built-ins -> ${outJson}\n`
  );
  for (const r of rows) process.stdout.write(`  ${r.verdict.padEnd(12)} ${r.tool}  [${r.capability.join(",")}]\n`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
