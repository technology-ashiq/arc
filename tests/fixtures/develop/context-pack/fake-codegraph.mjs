#!/usr/bin/env node
/**
 * A stand-in for the real `codegraph` binary, so the codegraph leg of the neighbourhood
 * contract is exercised on machines and CI legs where no `.codegraph/` index exists.
 *
 * Offline-first (build playbook): every external dependency gets an interface, a fake and a
 * real implementation. This is the fake. Its output is deliberately AWKWARD — unsorted, with
 * a duplicate, a `path:line` suffix and one path that does not exist — because the contract
 * the adapter must satisfy is "sorted, deduped, repo-relative, exists", and a tidy fake would
 * let an adapter that does none of that pass.
 *
 * `--fail` makes it exit non-zero, which is how the fallback-on-error path is proven.
 */
if (process.argv.includes("--fail")) {
  process.stderr.write("codegraph: index is corrupt\n");
  process.exit(1);
}

process.stdout.write(
  [
    "Symbols near src/auth/alpha.js:",
    "",
    "  src/auth/gamma.js:12   verifyToken()",
    "  src/auth/alpha.js:3    alpha()",
    "  src/auth/gamma.js:40   refresh()",
    "  src/auth/nope.js:1     ghost()",
    "  CLAUDE.md",
    "",
  ].join("\n"),
);
