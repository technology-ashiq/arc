// skill-source.mjs -- where an imported skill's bytes come from (org Cycle 20 Phase 02, ADR-1628).
//
// One interface, two implementations (offline-first): `fake` reads a fixture directory, `real` asks GitHub's contents
// API through the `gh` CLI. A source is ALWAYS pinned to a 40-hex commit: a branch or tag is a moving target, and a
// skill vetted at one commit and fetched at another is not the skill that was vetted.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEG_RE = /^[A-Za-z0-9._-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export class SourceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

/**
 * `github:OWNER/REPO/PATH@SHA`, PATH ending in SKILL.md.
 * @returns {{ owner: string, repo: string, path: string, sha: string }}
 */
export function parseSource(s) {
  const m = /^github:([^/@]+)\/([^/@]+)\/([^@]+)@(.*)$/.exec(String(s));
  if (!m) {
    if (/^github:[^@]+$/.test(String(s))) throw new SourceError("UNPINNED", `${JSON.stringify(s)} names no commit -- pin it: github:OWNER/REPO/PATH@<40-hex sha>`);
    throw new SourceError("BAD_SOURCE", `${JSON.stringify(s)} is not github:OWNER/REPO/PATH@SHA`);
  }
  const [, owner, repo, path, sha] = m;
  if (!SHA_RE.test(sha)) throw new SourceError("UNPINNED", `@${JSON.stringify(sha)} is not a 40-hex commit -- a branch or tag moves after it is vetted`);
  const segs = path.split("/");
  for (const x of [owner, repo, ...segs]) {
    if (!SEG_RE.test(x) || x === "." || x === ".." || x.startsWith("-")) throw new SourceError("BAD_SOURCE", `${JSON.stringify(x)} is not a plain path segment`);
  }
  if (segs[segs.length - 1] !== "SKILL.md") throw new SourceError("BAD_SOURCE", `${path} is not a SKILL.md`);
  return { owner, repo, path, sha };
}

/**
 * @param {{ owner: string, repo: string, path: string, sha: string }} src
 * @param {{ mode: "fake"|"real", fixtureRoot?: string, gh?: string }} o
 * @returns {{ text: string, via: string }}
 */
export function fetchSkill(src, { mode, fixtureRoot, gh = "gh" }) {
  if (mode === "fake") {
    if (!fixtureRoot) throw new SourceError("NO_FIXTURE", "the fake source needs a fixture root");
    try {
      return { text: readFileSync(join(fixtureRoot, src.owner, src.repo, ...src.path.split("/")), "utf8"), via: "fake" };
    } catch (e) {
      throw new SourceError("NOT_FOUND", `no fixture for ${src.owner}/${src.repo}/${src.path} (${e.code || "error"})`);
    }
  }
  if (mode !== "real") throw new SourceError("BAD_MODE", `source mode ${JSON.stringify(mode)} is fake or real`);
  let raw;
  try {
    // argv, never a joined string; the ref is the pinned commit.
    raw = execFileSync(gh, ["api", `repos/${src.owner}/${src.repo}/contents/${src.path}?ref=${src.sha}`],
      { encoding: "utf8", timeout: 30_000, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    throw new SourceError("FETCH_FAILED", `gh api failed: ${String(e.stderr || e.message || e).split("\n")[0].slice(0, 200)}`);
  }
  let j;
  try { j = JSON.parse(raw); } catch { throw new SourceError("FETCH_FAILED", "gh api answered with something that is not JSON"); }
  if (!j || j.type !== "file" || j.encoding !== "base64" || typeof j.content !== "string")
    throw new SourceError("FETCH_FAILED", "the contents API did not return one base64 file");
  const buf = Buffer.from(j.content.replace(/\s+/g, ""), "base64");
  // Strict UTF-8: a lossy decode would hand the vet different text from the bytes that land.
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { throw new SourceError("NOT_UTF8", "the skill's bytes are not UTF-8"); }
  return { text, via: `github contents API @ ${src.sha}` };
}
