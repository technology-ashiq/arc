// skill-vet.mjs -- the gate an imported SKILL.md passes or is refused at (org Cycle 20 Phase 02, ADR-1628).
//
// REFUSES BY DEFAULT and reports EVERY failed condition, as capability-vet.sh does: one run tells the owner all that
// is wrong. A skill is text an agent will read as instructions, so the threat model is ToxicSkills -- injection,
// pipe-to-shell, credential reads, exfiltration, and text a human reviewer cannot see. A pattern list cannot prove a
// skill benign; a PASS only lets it reach a proposal branch the owner reads.
//
// Pure: the caller hands in the bytes and the names main already holds.

export const MAX_SKILL_BYTES = 64 * 1024;
export const SKILL_NAME_RE = /^[a-z][a-z0-9-]{1,40}[a-z0-9]$/;

// Invisible or direction-changing characters: zero-width, bidi embeddings/overrides/isolates, the BOM past byte 0,
// every other Unicode format character, and C0/C1 controls other than tab and newline.
const INVISIBLE_RE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]|\p{Cf}|[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;

// Each rule: [code, what, regex]. Case-insensitive; matched against the whole text and against a copy with every run
// of whitespace collapsed to one space, so a phrase split over lines or padded with spaces is still the phrase.
const RULES = [
  ["OVERRIDE", "tells the reader to ignore, override or replace its instructions",
    /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(previous|prior|above|earlier|system|all|your|the)\b[^.\n]{0,20}\b(instructions?|rules|prompt|guidelines|polic(y|ies))\b|\byou are now\b|\bnew system prompt\b|\bdeveloper mode\b|\bjailbreak\b/i],
  ["PIPE_SHELL", "pipes downloaded content into an interpreter",
    /\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n]*\|\s*(sudo\s+)?(ba|z|da|k|c)?sh\b|\b(curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\n]*\|\s*(python\d?|node|perl|ruby|php|iex|invoke-expression|pwsh|powershell)\b|\b(ba|z)?sh\s+<\(\s*(curl|wget)|\beval\s+["'`]?\$\(\s*(curl|wget)|\biex\s*\(\s*(new-object|iwr|irm|invoke-webrequest)/i],
  ["CREDENTIALS", "reads a credential store or secret-bearing environment",
    /(~|\$home|%userprofile%)?[\\/]\.ssh[\\/]|\bid_(rsa|ed25519|ecdsa)\b|\.aws[\\/]credentials|\.netrc\b|\.npmrc\b|\.pypirc\b|\.git-credentials\b|\.docker[\\/]config\.json|\bkeychain\b|\bsecurity\s+find-(generic|internet)-password|(^|[\s"'`(/])\.env(\.local|\.production)?\b|\b(ANTHROPIC|OPENAI|OPENROUTER|GITHUB|GH|AWS|STRIPE|SUPABASE)_[A-Z_]*(KEY|TOKEN|SECRET)\b|\bprintenv\b|\bprocess\.env\b|\$env:|\bos\.environ\b/i],
  ["EXFILTRATE", "sends repo content or data to an outside endpoint",
    /\b(curl|wget|invoke-webrequest|invoke-restmethod|iwr|irm)\b[^\n]*(\s-d\b|\s--data(-binary|-raw|-urlencode)?\b|\s-F\b|\s--form\b|\s--upload-file\b|\s-T\b|\s-X\s*(POST|PUT)\b|-Method\s+(Post|Put))|\bwebhook\.site\b|\bngrok\b|\brequestbin\b|\bpipedream\b|\bpastebin\b|\btransfer\.sh\b|\bburpcollaborator\b|\binteract\.sh\b|\bdiscord(app)?\.com\/api\/webhooks\b/i],
  ["HIDDEN_TEXT", "carries text a reviewer does not see rendered (HTML comment or hidden element)",
    /<!--[\s\S]*?-->|<\s*(div|span|p)[^>]*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0)/i],
  ["OBFUSCATED", "carries a long encoded blob (base64 or hex) a reviewer cannot read",
    /[A-Za-z0-9+/]{200,}={0,2}|\b(?:[0-9a-f]{2}){120,}\b/i],
];

/** The frontmatter's name and description, or null. Only a leading `---` block of `key: value` lines is read. */
export function frontmatter(text) {
  const t = text.replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return null;
  const end = t.indexOf("\n---", 4);
  if (end < 0) return null;
  const fm = {};
  for (const line of t.slice(4, end).split("\n")) {
    const m = /^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!Object.hasOwn(fm, m[1])) fm[m[1]] = v;
  }
  return fm;
}

/**
 * @param {string} text the SKILL.md as fetched
 * @param {{ taken?: Iterable<string> }} [o] skill (and agent) names main already holds
 * @returns {{ ok: boolean, name: string|null, failures: {code: string, why: string}[] }}
 */
export function vetSkill(text, { taken = [] } = {}) {
  const failures = [];
  const fail = (code, why) => failures.push({ code, why });
  if (typeof text !== "string") return { ok: false, name: null, failures: [{ code: "NOT_TEXT", why: "the fetched skill is not text" }] };
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes === 0) fail("EMPTY", "the skill is empty");
  if (bytes > MAX_SKILL_BYTES) fail("OVERSIZE", `${bytes} bytes, over the ${MAX_SKILL_BYTES}-byte cap`);
  if (text.includes("�")) fail("NOT_UTF8", "the bytes did not decode as UTF-8 (a replacement character is present)");
  const body = text.startsWith("﻿") ? text.slice(1) : text;
  const inv = INVISIBLE_RE.exec(body);
  if (inv) fail("INVISIBLE", `an invisible or direction-changing character U+${inv[0].codePointAt(0).toString(16).toUpperCase().padStart(4, "0")} at offset ${inv.index}`);

  const fm = frontmatter(body);
  let name = null;
  if (!fm) fail("FRONTMATTER", "no leading --- frontmatter block");
  else {
    if (!fm.name) fail("FRONTMATTER", "frontmatter has no name");
    else if (!SKILL_NAME_RE.test(fm.name)) fail("BAD_NAME", `name ${JSON.stringify(fm.name)} is not a lowercase kebab skill name (3-42 characters)`);
    else name = fm.name;
    if (!fm.description) fail("FRONTMATTER", "frontmatter has no description");
  }
  if (name && new Set(taken).has(name)) fail("COLLISION", `a skill or agent named ${name} already exists on main`);

  const collapsed = body.replace(/\s+/g, " ");
  for (const [code, why, re] of RULES) {
    const hit = re.exec(body) || re.exec(collapsed);
    if (hit) fail(code, `${why}: ${JSON.stringify(hit[0].slice(0, 80))}`);
  }
  return { ok: failures.length === 0, name, failures };
}
