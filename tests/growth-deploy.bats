#!/usr/bin/env bats
# Phase 00 -- the preview-deploy interface (ADR-1104).
#
# The fake is held to a higher bar than "returns a URL". It must actually SERVE the directory
# over HTTP, because the thing the review pack depends on is a human opening the link and seeing
# the article -- and a canned string satisfies a type signature while proving nothing about that.
# arc-engine, 2026-08-03: a fake that swapped the code path let a three-driver contract suite pass
# while zero real driver code ran.
#
# The other half of this file is the absence test. There is no `promote` verb and there must never
# be one: promotion to the live site is the human's merge (E2, ADR-1102). An absent capability is
# a stronger guarantee than a code review.
bats_require_minimum_version 1.5.0
load 'test_helper'

_node() { cd "$ARC_ROOT" && node --input-type=module -e "$1"; }

PRE='const { previewFake, deployProvider } = await import("./.claude/scripts/growth/lib/deploy.mjs");
const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const { join } = await import("node:path");
const root = mkdtempSync(join(tmpdir(), "growth-deploy-"));
mkdirSync(join(root, "blog", "hello"), { recursive: true });
writeFileSync(join(root, "blog", "hello", "index.html"), "<h1>the article body</h1>");
writeFileSync(join(root, "index.html"), "<h1>home</h1>");
writeFileSync(join(root, "llms.txt"), "# arc");'

@test "the fake serves the built article over real HTTP at a real port" {
  run _node "$PRE
    const h = await previewFake(root);
    const res = await fetch(h.url + \"/blog/hello/\");
    const body = await res.text();
    await h.close();
    console.log(res.status + \" \" + (body.includes(\"the article body\") ? \"served\" : \"EMPTY\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "200 served" ]
}

@test "an extensionless blog path resolves to its index.html, the way a static host serves it" {
  # Astro emits /blog/<slug>/index.html. If the fake only served exact files, every preview URL in
  # every review pack would 404 and the gate would be testing the fake rather than the site.
  run _node "$PRE
    const h = await previewFake(root);
    const res = await fetch(h.url + \"/blog/hello\");
    await h.close();
    console.log(String(res.status));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "200" ]
}

@test "a traversal out of the served root is refused" {
  # This server is pointed at a directory sitting next to a repo full of private tooling. The
  # confinement is done on the normalised path, not by looking for dot-dot in the raw request,
  # because a percent-encoded traversal walks straight past a substring check.
  run _node "$PRE
    const h = await previewFake(root);
    const a = await fetch(h.url + \"/../../../etc/passwd\");
    const b = await fetch(h.url + \"/%2e%2e%2f%2e%2e%2fetc%2fpasswd\");
    await h.close();
    console.log((a.status >= 400 ? \"refused\" : \"LEAKED\") + \" \" + (b.status >= 400 ? \"refused\" : \"LEAKED\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "refused refused" ]
}

@test "a missing page is a 404 and not a 200 with an empty body" {
  # Otherwise a review pack could carry a preview URL that looks fine and shows nothing.
  run _node "$PRE
    const h = await previewFake(root);
    const res = await fetch(h.url + \"/blog/does-not-exist/\");
    await h.close();
    console.log(String(res.status));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "404" ]
}

@test "the interface exposes no promote verb, in either provider" {
  # E2 is enforced by absence. If this ever fails, someone added a machine path to the live site.
  run _node "$PRE
    const names = [\"fake\", \"vercel\"].map(n => Object.keys(deployProvider(n)).sort().join(\",\"));
    const anyPromote = names.some(n => n.includes(\"promote\"));
    console.log(names.join(\" | \") + \" \" + (anyPromote ? \"HAS-PROMOTE\" : \"no-promote\"));"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "preview | preview no-promote" ]
}

@test "the default provider is the offline fake, so a forgotten choice never reaches the network" {
  run _node "$PRE
    const before = process.env.ARC_GROWTH_DEPLOY;
    delete process.env.ARC_GROWTH_DEPLOY;
    const chosen = deployProvider();
    process.env.ARC_GROWTH_DEPLOY = before ?? \"\";
    console.log(chosen.preview.name);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "previewFake" ]
}

@test "an unknown provider name is refused rather than silently falling back" {
  run _node "$PRE
    let code = \"ACCEPTED\";
    try { deployProvider(\"netlify\"); } catch { code = \"refused\"; }
    console.log(code);"
  [ "$status" -eq 0 ] || { echo "$output"; false; }
  [ "$output" = "refused" ]
}
