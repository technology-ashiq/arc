// deploy.mjs — the preview-deploy interface (ADR-1004), its offline fake, and the Vercel adapter.
//
// THE INTERFACE HAS NO `promote` VERB, AND THAT IS THE DESIGN.
// Promotion to the live site is the human's merge (ADR-1002, Constitution E2). A `promote` that
// exists "for symmetry" is a function some later refactor will call, and the guard protecting the
// most important rule in this lane would then be a code review rather than an absent capability.
// The review pack needs exactly one thing from a host — a URL a human can open — so that is
// exactly what this exposes.
//
// The fake is not a stub that returns a canned string. It serves the built directory over real
// HTTP on a real port, because the thing under test is "a reviewer can open this and see the
// article", and a canned URL proves nothing about that. arc-engine 2026-08-03: a fake that
// swapped the code path let a three-driver contract suite pass while zero real driver code ran.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import { spawn } from "node:child_process";

const TEXT = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
};

const mimeFor = (p) => {
  const dot = p.lastIndexOf(".");
  return (dot >= 0 && TEXT[p.slice(dot)]) || "application/octet-stream";
};

/**
 * Resolve a request path inside `root`, refusing anything that escapes it.
 *
 * The confinement is done on the NORMALISED path and re-checked against the root prefix, not by
 * looking for ".." in the raw request — a percent-encoded or doubled-up traversal walks straight
 * past a substring check, and this server is pointed at a directory that sits next to the repo.
 */
function resolveInside(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, "");
  const abs = join(root, rel);
  const rootWithSep = root.endsWith(sep) ? root : root + sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

/**
 * The FAKE preview host: serves `dir` on an ephemeral port and returns the same shape the real
 * adapter returns. Callers must `await handle.close()`.
 */
export async function previewFake(dir) {
  const server = createServer(async (req, res) => {
    let abs = resolveInside(dir, req.url || "/");
    if (abs === null) {
      res.writeHead(403).end("outside root");
      return;
    }
    try {
      let s = await stat(abs).catch(() => null);
      // A directory request maps to its index.html — the shape a static host serves.
      if (s?.isDirectory()) {
        abs = join(abs, "index.html");
        s = await stat(abs).catch(() => null);
      }
      // `/blog/x` with no extension maps to `/blog/x/index.html`, which is how Astro emits pages.
      if (!s) {
        const alt = join(abs, "index.html");
        if (await stat(alt).catch(() => null)) abs = alt;
        else {
          res.writeHead(404).end("not found");
          return;
        }
      }
      res.writeHead(200, { "content-type": mimeFor(abs) }).end(await readFile(abs));
    } catch {
      res.writeHead(500).end("error");
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    id: `fake-${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

/**
 * The REAL adapter. Shells out to the Vercel CLI and returns the preview URL it prints.
 *
 * Deliberately narrow: `--prebuilt` is not used and no production flag exists in this module at
 * all. A preview deployment is not indexed and is not the site; making the production path
 * unreachable from here is the same decision as omitting `promote`.
 */
export function previewVercel(dir, { cwd = process.cwd(), env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["deploy", dir, "--yes"];
    if (env.VERCEL_TOKEN) args.push("--token", env.VERCEL_TOKEN);
    const child = spawn("vercel", args, { cwd, env, shell: false });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => reject(new Error(`vercel is not runnable here: ${e.message}`)));
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`vercel exited ${code}: ${err.trim() || out.trim()}`));
      // The CLI prints the deployment URL on stdout; take the LAST https line so a progress
      // banner carrying a docs link cannot be mistaken for the deployment.
      const url = out.split("\n").map((l) => l.trim()).filter((l) => /^https:\/\/\S+$/.test(l)).pop();
      if (!url) return reject(new Error("vercel printed no deployment URL"));
      resolve({ url, id: url, close: async () => {} });
    });
  });
}

/**
 * Pick an implementation. The fake is the default everywhere except an explicit real run, so a
 * test that forgets to choose gets the offline one rather than reaching the network.
 */
export function deployProvider(name = process.env.ARC_GROWTH_DEPLOY || "fake") {
  if (name === "fake") return { preview: previewFake };
  if (name === "vercel") return { preview: previewVercel };
  throw new Error(`unknown deploy provider ${JSON.stringify(name)} — expected fake or vercel`);
}
