#!/usr/bin/env node
/**
 * council-lint — gate for the arc-council deliverable artifacts, verdicts, and evidence briefs.
 * Zero deps. Exit 0 = pass; exit 1 = named failures.
 *
 * Modes:
 *   node .claude/scripts/council/council-lint.mjs [repo-root]
 *     Static — the /arc-council command + the core member agents exist with valid frontmatter.
 *   node .claude/scripts/council/council-lint.mjs --verdict <file>
 *     Verdict — POINT-ID cross-reference: every [Pn] cited in KEY REASONS/DISSENT must be rated
 *     Supported/Plausible in the verifier's ratings, and the verifier must have contested >=1 point. (ADR-0007)
 *   node .claude/scripts/council/council-lint.mjs --brief <file>
 *     Brief — a deep Evidence Brief needs >=3 facts, each with a confidence label; in a `live` brief
 *     each High/Med fact needs >=2 independent source URLs or an explicit low-confidence mark. (REQ-04, ADR-0003)
 *
 * Roster grows per phase: Phase 0 = advocate/skeptic/neutral; Phase 1 adds verifier; Phase 2 adds
 * researcher; Phase 3 adds the 7 domain experts.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const flagVal = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
};
const verdictFile = flagVal("--verdict");
const briefFile = flagVal("--brief");
const jurorArtifactFile = flagVal("--juror-artifact");
const consumed = new Set();
for (const f of ["--verdict", "--brief", "--juror-artifact"]) {
  const i = args.indexOf(f);
  if (i >= 0) consumed.add(i), consumed.add(i + 1);
}
const root = args.find((a, i) => !a.startsWith("--") && !consumed.has(i)) || ".";

const failures = [];
const fail = (msg) => failures.push(msg);

function report() {
  if (failures.length) {
    console.error(`council-lint: ${failures.length} check(s) FAILED\n`);
    for (const f of failures) console.error(`FAIL  ${f}`);
    console.error("\nFix and rerun.");
    process.exit(1);
  }
  console.log("council-lint: all checks passed ✔");
  process.exit(0);
}

// minimal YAML-frontmatter reader (key: value between the first --- fences)
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) fm[mm[1].toLowerCase()] = mm[2].trim();
  }
  return fm;
}

// a real ISO calendar date (rejects shape-valid impossibilities like 2026-13-45 / 2026-11-31)
function isValidISODate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// ------------------------------------------------------------------ verdict mode
if (verdictFile) {
  if (!existsSync(verdictFile)) {
    fail(`verdict file not found: ${verdictFile}`);
    report();
  }
  const raw = readFileSync(verdictFile, "utf8");
  // Strip fenced ``` code blocks so an illustrative/template fence can't satisfy the line checks —
  // a real saved verdict is never fenced (session files carry the sections as plain markdown).
  const text = raw.replace(/```[\s\S]*?```/g, "\n");

  const rm = text.match(/(?:^|\n)[ \t]*##\s*VERIFIER\s+RATINGS[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  const ratings = {};
  if (rm)
    for (const mm of rm[1].matchAll(/\b([A-Z]{1,2}\d+)\s*[:\-–]\s*(Supported|Plausible|Weak|Contested)\b/gi))
      ratings[mm[1].toUpperCase()] = mm[2][0].toUpperCase() + mm[2].slice(1).toLowerCase();
  const ratedIds = Object.keys(ratings);
  if (ratedIds.length === 0)
    fail(`${verdictFile}: no "## VERIFIER RATINGS" section with \`Pn: <Supported|Plausible|Weak|Contested>\` lines`);

  // v2 REBUTTAL LOG + FIRST-PASS anchor (ADR-0008 → hardened by ADR-0014). The no-rubber-stamp
  // invariant is measured on the FIRST-PASS ratings: a run is a rubber-stamp iff the verifier
  // contested nothing on its FIRST pass. When a rebuttal ran, the verifier's first-pass grades are
  // persisted as ## FIRST-PASS RATINGS and the ## REBUTTAL LOG is a checked diff — each line's PRE
  // must equal the first-pass grade and POST the final grade, so a fabricated "pre: Contested" can't
  // manufacture a contest the persisted verifier output doesn't show.
  const tc = (s) => s[0].toUpperCase() + s.slice(1).toLowerCase();
  const parseRatings = (body) => {
    const r = {};
    for (const mm of body.matchAll(/\b([A-Z]{1,2}\d+)\s*[:\-–]\s*(Supported|Plausible|Weak|Contested)\b/gi))
      r[mm[1].toUpperCase()] = tc(mm[2]);
    return r;
  };
  if ((text.match(/(^|\n)[ \t]*#{1,6}[ \t]*REBUTTAL\s+LOG\b/gi) || []).length > 1)
    fail(`${verdictFile}: more than one REBUTTAL LOG section heading — a verdict has exactly one`);
  if ((text.match(/(^|\n)[ \t]*#{1,6}[ \t]*FIRST-PASS\s+RATINGS\b/gi) || []).length > 1)
    fail(`${verdictFile}: more than one FIRST-PASS RATINGS section heading — a verdict has exactly one`);
  const fpm = text.match(/(?:^|\n)[ \t]*##\s*FIRST-PASS\s+RATINGS[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  const firstPass = fpm ? parseRatings(fpm[1]) : null;
  const rebSec = text.match(/(?:^|\n)[ \t]*##\s*REBUTTAL\s+LOG[^\n]*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (rebSec) {
    if (!firstPass || Object.keys(firstPass).length === 0)
      fail(`${verdictFile}: ## REBUTTAL LOG present but no ## FIRST-PASS RATINGS section — the log's pre-column must be anchored to the verifier's persisted first-pass grades, else a contest can be fabricated (ADR-0014)`);
    const rebLines = [...rebSec[1].matchAll(
      /^[ \t]*[-*]?\s*([A-Z]{1,2}\d+):\s*(Supported|Plausible|Weak|Contested)\s*(?:→|->)\s*(Supported|Plausible|Weak|Contested)\b\s*(?:[—–-]\s*(.+))?$/gim,
    )];
    if (rebLines.length === 0)
      fail(`${verdictFile}: ## REBUTTAL LOG present but has no structured "ID: pre → post — reason" line (ADR-0008)`);
    for (const m of rebLines) {
      const id = m[1].toUpperCase(), pre = tc(m[2]), post = tc(m[3]), reason = (m[4] || "").trim();
      if (!ratings[id]) fail(`${verdictFile}: REBUTTAL LOG cites unrated point ${id} — not in VERIFIER RATINGS`);
      else if (ratings[id] !== post)
        fail(`${verdictFile}: REBUTTAL LOG ${id} post-rating "${post}" != its final VERIFIER RATING "${ratings[id]}" (ADR-0008)`);
      if (firstPass && !firstPass[id])
        fail(`${verdictFile}: REBUTTAL LOG ${id} has no ## FIRST-PASS RATING to anchor its pre-column (ADR-0014)`);
      else if (firstPass && firstPass[id] !== pre)
        fail(`${verdictFile}: REBUTTAL LOG ${id} pre-rating "${pre}" != its ## FIRST-PASS RATING "${firstPass[id]}" — the log must record the verifier's actual first-pass grade (ADR-0014)`);
      if (!/^(Weak|Contested)$/.test(pre))
        fail(`${verdictFile}: REBUTTAL LOG ${id} pre-rating "${pre}" is not Weak/Contested — only a contested point is rebutted (ADR-0014)`);
      if (reason.length < 4) fail(`${verdictFile}: REBUTTAL LOG ${id} has no reason for the pre→post change`);
    }
  }

  // no-rubber-stamp — measured on the FIRST-PASS ratings when a rebuttal ran, else on the final
  // ratings. A verifier that contested nothing on its first pass is a rubber-stamp (fairness.md #6);
  // a rebuttal that resolved every contested point still carries that first-pass contest on record.
  const graded = firstPass && Object.keys(firstPass).length ? firstPass : ratings;
  const gradedIds = Object.keys(graded);
  const contested = gradedIds.filter((id) => /^(Weak|Contested)$/.test(graded[id]));
  if (gradedIds.length > 0 && contested.length === 0)
    fail(`${verdictFile}: verifier contested nothing — 0 of ${gradedIds.length} first-pass points Weak/Contested (rubber-stamp signal)`);

  // v3 cross-model juror (ADR-0015..0018): a deep verdict carries ONE `Juror:` line — a model
  // (`<model> @ <host>`) or `unavailable (<reason>)`. A named model requires the SCRIPT-written
  // ## JUROR RATINGS to be present + parseable and to cover the ANCHOR SET: every id rated
  // Weak/Contested in ## FIRST-PASS RATINGS plus every ## REBUTTAL LOG id — the no-rubber-stamp
  // fabrication surface (ADR-0017). DETECTION is tolerant (a line a human reads as a juror
  // attribution — bulleted, bolded, odd spacing, any heading level — is enforced as one, so a
  // cosmetic variant can't display a juror while dodging the checks); the value GRAMMAR is strict
  // and fails closed on near-misses. Pre-v3 verdicts carry no Juror: line and no requirement.
  // detection tolerates ANY shape a human reads as a juror attribution: bullets (-*+), numbered
  // (1. 1)), blockquote (>), heading (#..), emphasis (**) — so none can display a juror yet dodge the gate.
  const attrPrefix = "(?:[-*+>][ \\t]+|\\d+[.)][ \\t]+|#{1,6}[ \\t]*)?";
  const jurorLines = [...text.matchAll(new RegExp(`^[ \\t]*${attrPrefix}(?:\\*{1,2})?Juror(?:\\*{1,2})?[ \\t]*:(?:\\*{1,2})?[ \\t]*(.+?)[ \\t]*$`, "gim"))]
    .map((m) => m[1].replace(/\*{1,2}\s*$/, "").trim());
  if (jurorLines.length > 1)
    fail(`${verdictFile}: ${jurorLines.length} Juror: lines — a verdict carries exactly one (multiplicity guard; reword any prose line that begins with "Juror:")`);
  if ((text.match(/(^|\n)[ \t]*#{1,6}[ \t]*JUROR\s+RATINGS\b/gi) || []).length > 1)
    fail(`${verdictFile}: more than one JUROR RATINGS section heading — a verdict has exactly one (multiplicity guard)`);
  const jm = text.match(/(?:^|\n)[ \t]*#{1,6}[ \t]*JUROR\s+RATINGS[^\n]*\n([\s\S]*?)(?=\n[ \t]*#{1,6}[ \t]*\S|$)/i);
  let jurorNamed = false;
  if (jurorLines.length === 1) {
    const v = jurorLines[0];
    if (/^unavailable\s*\(.+\)$/i.test(v)) jurorNamed = false; // the valid unavailable grammar
    else if (/^unavailable\b/i.test(v))
      fail(`${verdictFile}: Juror: line "${v}" matches neither grammar — "MODEL @ HOST" or "unavailable (REASON)"; an unavailable juror needs a parenthesized reason, and a model name must not begin with "unavailable" (ADR-0016)`);
    else jurorNamed = true; // named model — artifact required
  }
  const jurorIds = jm
    ? [...jm[1].matchAll(/^[ \t]*[-*]?\s*([A-Z]{1,2}\d+):\s*(Supported|Plausible|Weak|Contested)\b/gim)].map((m) => m[1].toUpperCase())
    : [];
  const jurorEmptyMarker = jm ? /\(no rebuttal ran — nothing to grade\)/.test(jm[1]) : false;
  const jurorParseable = jurorIds.length > 0 || jurorEmptyMarker;
  if (jurorNamed && (!jm || !jurorParseable))
    fail(`${verdictFile}: Juror: names a model but ## JUROR RATINGS is ${jm ? 'unparseable — needs structured "ID: rating — reason" lines or the empty-set marker' : "missing"} (required-when-configured, ADR-0016)`);
  if (jm && !jurorNamed)
    fail(`${verdictFile}: ## JUROR RATINGS present but no single Juror: line naming a model — the artifact must be attributed (ADR-0018)`);
  if (jurorNamed && jm && jurorParseable) {
    const anchorIds = new Set();
    if (firstPass) for (const [fid, fr] of Object.entries(firstPass)) if (/^(Weak|Contested)$/.test(fr)) anchorIds.add(fid);
    if (rebSec) for (const m of rebSec[1].matchAll(/^[ \t]*[-*]?\s*([A-Z]{1,2}\d+):/gim)) anchorIds.add(m[1].toUpperCase());
    for (const aid of anchorIds)
      if (!jurorIds.includes(aid))
        fail(`${verdictFile}: ${aid} is on the anchor set (first-pass Weak/Contested or REBUTTAL LOG) but absent from ## JUROR RATINGS — the juror must cover the anchors (ADR-0017)`);
    if (anchorIds.size > 0 && jurorEmptyMarker && jurorIds.length === 0)
      fail(`${verdictFile}: ## JUROR RATINGS claims "(no rebuttal ran)" but the verdict carries ${anchorIds.size} anchor id(s) — the empty-set marker cannot stand in for grading real anchors (ADR-0017)`);
  }

  // v3 REQ-05 (ADR-0018, forced by the kickoff attack panel): the SHA-256 verdict↔artifact binding.
  // A named juror requires a Juror-Artifact-SHA256: line; with --juror-artifact FILE the lint verifies
  // the hash AND that the verdict's DISPLAYED juror section matches the script-written artifact
  // id-for-id and rating-for-rating — a doctored display or a hand-made artifact is named, not passed.
  const shaLines = [...text.matchAll(new RegExp(`^[ \\t]*${attrPrefix}(?:\\*{1,2})?Juror-Artifact-SHA256(?:\\*{1,2})?[ \\t]*:(?:\\*{1,2})?[ \\t]*(\\S+?)[ \\t]*$`, "gim"))]
    .map((m) => m[1].replace(/\*{1,2}$/, ""));
  if (shaLines.length > 1)
    fail(`${verdictFile}: ${shaLines.length} Juror-Artifact-SHA256: lines — a verdict carries exactly one`);
  if (jurorNamed && shaLines.length === 0)
    fail(`${verdictFile}: Juror: names a model but no Juror-Artifact-SHA256: line — the verdict must be byte-bound to the script-written artifact (REQ-05, ADR-0018)`);
  if (shaLines.length === 1 && !/^[a-f0-9]{64}$/i.test(shaLines[0]))
    fail(`${verdictFile}: Juror-Artifact-SHA256 "${shaLines[0].slice(0, 20)}…" is not a 64-hex SHA-256`);
  if (jurorArtifactFile) {
    if (!existsSync(jurorArtifactFile)) fail(`${verdictFile}: --juror-artifact ${jurorArtifactFile} not found`);
    else {
      // hash over CRLF-normalized bytes so a re-saved (Windows EOL) artifact isn't a false "wrong artifact".
      const artRaw = readFileSync(jurorArtifactFile, "utf8").replace(/\r\n/g, "\n");
      const artHash = createHash("sha256").update(artRaw, "utf8").digest("hex");
      if (shaLines.length === 1 && /^[a-f0-9]{64}$/i.test(shaLines[0]) && artHash !== shaLines[0].toLowerCase())
        fail(`${verdictFile}: artifact hash ${artHash.slice(0, 12)}… != the verdict's Juror-Artifact-SHA256 ${shaLines[0].toLowerCase().slice(0, 12)}… — the referenced file is not the artifact this verdict claims, or its bytes changed (REQ-05)`);
      const am = artRaw.match(/(?:^|\n)[ \t]*#{1,6}[ \t]*JUROR\s+RATINGS[^\n]*\n([\s\S]*?)(?=\n[ \t]*#{1,6}[ \t]*\S|$)/i);
      const pairRe = /^[ \t]*[-*]?\s*([A-Z]{1,2}\d+):\s*(Supported|Plausible|Weak|Contested)\b\s*[—–-]?\s*(.*)$/gim;
      const norm = (s) => s.trim().replace(/\s+/g, " ");
      const pairsOf = (s) => { const p = new Map(); if (s) for (const m of s.matchAll(pairRe)) if (!p.has(m[1].toUpperCase())) p.set(m[1].toUpperCase(), { r: tc(m[2]), reason: norm(m[3] || "") }); return p; };
      const artPairs = pairsOf(am ? am[1] : null);
      const verPairs = pairsOf(jm ? jm[1] : null);
      for (const [aid, a] of artPairs) {
        if (!verPairs.has(aid))
          fail(`${verdictFile}: the artifact rates ${aid} but the verdict's JUROR RATINGS omits it — the displayed section diverges from the script-written artifact (REQ-05)`);
        else if (verPairs.get(aid).r !== a.r)
          fail(`${verdictFile}: JUROR RATINGS shows ${aid}: ${verPairs.get(aid).r} but the script-written artifact says ${a.r} — the displayed rating was doctored (REQ-05)`);
        else if (verPairs.get(aid).reason !== a.reason)
          fail(`${verdictFile}: JUROR RATINGS reason for ${aid} differs from the script-written artifact — the displayed reasoning was doctored (REQ-05)`);
      }
      for (const vid of verPairs.keys())
        if (!artPairs.has(vid))
          fail(`${verdictFile}: the verdict's JUROR RATINGS adds ${vid} which the script-written artifact never graded (REQ-05)`);
    }
  }

  // v2 REQ-01 (decision core): EXACTLY ONE filled DECISION line and ONE filled CONFIDENCE line — an
  // unfilled template placeholder ("DECISION: YES | NO | ...") or a decoy second line is rejected.
  const decLines = [...text.matchAll(/^[ \t]*DECISION:.*$/gim)].map((m) => m[0]);
  let decision = null;
  if (decLines.length === 0) fail(`${verdictFile}: no "DECISION:" line (decision-core check)`);
  else if (decLines.length > 1) fail(`${verdictFile}: ${decLines.length} DECISION: lines — a verdict commits to exactly one (decision-core check)`);
  else {
    const m = decLines[0].match(/^[ \t]*DECISION:\s*(YES|NO|CONDITIONAL|WAIT)\s*$/i);
    if (!m) fail(`${verdictFile}: DECISION: line is unfilled or invalid — must be exactly one of YES|NO|CONDITIONAL|WAIT (decision-core check)`);
    else decision = m[1].toUpperCase();
  }
  const confLines = [...text.matchAll(/^[ \t]*CONFIDENCE:.*$/gim)].map((m) => m[0]);
  let confidence = null;
  if (confLines.length === 0) fail(`${verdictFile}: no "CONFIDENCE:" line (decision-core check)`);
  else if (confLines.length > 1) fail(`${verdictFile}: ${confLines.length} CONFIDENCE: lines — exactly one (decision-core check)`);
  else {
    const m = confLines[0].match(/^[ \t]*CONFIDENCE:\s*(High|Medium|Low)\s*$/i);
    if (!m) fail(`${verdictFile}: CONFIDENCE: line is unfilled or invalid — must be exactly one of High|Medium|Low (decision-core check)`);
    else confidence = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  }

  // v2 REQ-02 (model-knowledge discipline): a High claim requires an explicit "Research mode: live"
  // line. Any other or absent mode (offline / model-knowledge / model knowledge / unstated) caps at
  // Medium — so no synonym, typo, or omission of the mode token can smuggle an offline High through.
  const isLive = /^[ \t]*Research mode:\s*live\s*$/im.test(text);
  if (confidence === "High" && !isLive)
    fail(`${verdictFile}: CONFIDENCE: High without an explicit "Research mode: live" line — an offline or unstated-mode run is capped at Medium (model-knowledge discipline)`);

  // v2 REQ-03 citation rating: every [Pn] cited OUTSIDE ## UNRESOLVED / ## DISPUTED must be
  // Supported/Plausible. Scanning the whole verdict MINUS those two sections (rather than trying to
  // bound KEY REASONS/DISSENT) is robust to section-boundary games — a Weak cite anywhere it could
  // ground the decision is caught, while a Contested pair may still be shown under ## UNRESOLVED.
  const citable = text
    .replace(/##\s*UNRESOLVED[\s\S]*?(?=\n##\s|$)/i, "")
    .replace(/##\s*DISPUTED[\s\S]*?(?=\n##\s|$)/i, "")
    .replace(/##\s*REBUTTAL\s+LOG[\s\S]*?(?=\n##\s|$)/i, "") // rating-changes, not decision-grounding cites
    .replace(/#{1,6}[ \t]*JUROR\s+RATINGS[\s\S]*?(?=\n##\s|$)/i, ""); // independent grades, not decision-grounding cites
  const citedOutside = [...new Set([...citable.matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase()))];
  for (const id of citedOutside) {
    if (!ratings[id]) fail(`${verdictFile}: cites unrated point ${id} outside UNRESOLVED — not in VERIFIER RATINGS`);
    else if (!/^(Supported|Plausible)$/.test(ratings[id]))
      fail(`${verdictFile}: cites ${id} rated ${ratings[id]} — only Supported/Plausible may ground a KEY REASON or DISSENT`);
  }

  // v2 REQ-01: a DISSENT section citing >=1 surviving point must exist — EXCEPT a WAIT verdict with
  // zero Supported/Plausible ratings (arc-council.md step-6 escape hatch: nothing survived to cite).
  // The header is matched ANCHORED to line-start so the word "dissent" in prose can't stand in for it.
  const dm = text.match(/(?:^|\n)[ \t]*DISSENT\b([\s\S]*?)(?=\n[ \t]*CHEAPEST TEST|\n##\s|$)/i);
  const dissentCited = dm ? [...new Set([...dm[1].matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase()))] : [];
  const surviving = ratedIds.filter((id) => /^(Supported|Plausible)$/.test(ratings[id]));
  const waitExempt = decision === "WAIT" && surviving.length === 0;
  if (!waitExempt && dissentCited.length === 0)
    fail(`${verdictFile}: no DISSENT section citing a [Pn] surviving point (decision-core check; only an all-Weak WAIT is exempt)`);

  // v2 REQ-03: a present ## UNRESOLVED must cite >=1 BRACKETED rebuttal-set POINT-ID (a rated id or a
  // ## DISPUTED-listed id) — a bare prose token like "Q4" or "CO2" is not a citation.
  const um = text.match(/##\s*UNRESOLVED([\s\S]*?)(?=\n##\s|$)/i);
  if (um) {
    const disputedText = (text.match(/##\s*DISPUTED([\s\S]*?)(?=\n##\s|$)/i) || [, ""])[1];
    const disputedIds = new Set([...disputedText.matchAll(/\b([A-Z]{1,2}\d+)\b/g)].map((m) => m[1].toUpperCase()));
    const unresolvedCited = [...um[1].matchAll(/\[([A-Z]{1,2}\d+)\]/gi)].map((m) => m[1].toUpperCase());
    if (!unresolvedCited.some((id) => ratings[id] || disputedIds.has(id)))
      fail(`${verdictFile}: ## UNRESOLVED present but cites no bracketed rebuttal-set POINT-ID (a rated or DISPUTED id) — list the unresolved IDs or drop the section`);
  }

  // v2 REQ-04 calibration lines (validate-if-present): deep runs emit Review-by/Resolution and
  // review appends ## OUTCOME; pre-v2 sessions carry none of these and stay valid. When present,
  // the format is enforced so the calibration script (council-calibrate.mjs) can always parse them.
  // A verdict may carry MORE THAN ONE Review-by / ## OUTCOME (append-only re-review, ADR-0012) —
  // EVERY one is validated, not just the first.
  const rbLines = [...text.matchAll(/^Review-by:\s*(.+?)\s*$/gim)];
  for (const m of rbLines)
    if (!isValidISODate(m[1]))
      fail(`${verdictFile}: Review-by: "${m[1]}" is not a valid YYYY-MM-DD calendar date (calibration line)`);
  const resLine = text.match(/^Resolution:\s*(.*)$/im);
  const resVal = resLine ? resLine[1].trim() : "";
  const resPlaceholder = /^(TODO|TBD|N\/?A|x{2,}|\.{2,}|-+)$/i.test(resVal);
  if (rbLines.length && (resVal.length < 4 || resPlaceholder))
    fail(`${verdictFile}: a Review-by needs a real Resolution: criterion (a falsifiable HIT/MISS test, not empty or a placeholder) — a scheduled verdict with nothing to grade against is unreviewable`);
  else if (resLine && (resVal.length < 4 || resPlaceholder))
    fail(`${verdictFile}: Resolution: line is empty or a placeholder — name the falsifiable HIT/MISS criterion (calibration line)`);
  for (const m of text.matchAll(/##\s*OUTCOME([\s\S]*?)(?=\n##\s|$)/gi))
    if (!/^RESULT:\s*(HIT|MISS|UNRESOLVED)\s*$/im.test(m[1]))
      fail(`${verdictFile}: a ## OUTCOME has no valid "RESULT: HIT|MISS|UNRESOLVED" line — outcomes are HIT, MISS, or UNRESOLVED, never free text (ADR-0012)`);

  // fairness invariant (Phase 4): the Chair pre-registers a prediction before reading the verifier
  if (!/^\s*PREDICTION:/im.test(text))
    fail(`${verdictFile}: no PREDICTION: line — the Chair must pre-register a prediction before reading the verifier (fairness invariant)`);
  report();
}

// ------------------------------------------------------------------ brief mode
if (briefFile) {
  if (!existsSync(briefFile)) {
    fail(`brief file not found: ${briefFile}`);
    report();
  }
  const text = readFileSync(briefFile, "utf8");
  const modeMatch = text.match(/Research mode:\s*(live|model-knowledge)/i);
  const mode = modeMatch ? modeMatch[1].toLowerCase() : null;
  if (!mode) fail(`${briefFile}: no "Research mode: live|model-knowledge" line`);

  const factLines = text.split(/\r?\n/).filter((l) => /^\s*[-*]\s*F\d+\b/.test(l));
  if (factLines.length < 3)
    fail(`${briefFile}: ${factLines.length} fact(s) — a deep Evidence Brief needs >=3 (REQ-04)`);
  for (const line of factLines) {
    const id = (line.match(/\b(F\d+)\b/) || [])[1] || "F?";
    const conf = (line.match(/[\[(](High|Med|Medium|Low)[\])]/i) || [])[1];
    if (!conf) {
      fail(`${briefFile}: fact ${id} has no [High|Med|Low] confidence label`);
      continue;
    }
    const isLow = /^low$/i.test(conf) || /\b(unverified|model prior|model-knowledge|single source)\b/i.test(line);
    const urls = (line.match(/https?:\/\/\S+/g) || []).length;
    if (mode === "live" && !isLow && urls < 2)
      fail(`${briefFile}: fact ${id} is ${conf} in a live brief but has ${urls} source URL(s) — need >=2 independent sources or an explicit low-confidence mark (REQ-04)`);
  }
  report();
}

// ------------------------------------------------------------------ static mode
const read = (p) => readFileSync(join(root, p), "utf8");
const exists = (p) => existsSync(join(root, p));

const CMD = ".claude/commands/arc-council.md";
if (!exists(CMD)) fail(`${CMD} missing — build the arc-council command`);
else {
  const fm = frontmatter(read(CMD));
  if (!fm) fail(`${CMD}: no YAML frontmatter`);
  else
    for (const k of ["description", "argument-hint", "allowed-tools"])
      if (!fm[k]) fail(`${CMD}: frontmatter missing "${k}"`);
}

const CORE_AGENTS = [
  "council-advocate",
  "council-skeptic",
  "council-neutral",
  "council-verifier",
  "council-researcher",
];
// Phase 3: the 7 domain experts (convened per-question by the Chair, but all must EXIST). REQ-07.
const DOMAIN_AGENTS = [
  "council-strategist",
  "council-risk-analyst",
  "council-marketer",
  "council-designer",
  "council-engineer",
  "council-policy-analyst",
  "council-life-counselor",
];
for (const name of [...CORE_AGENTS, ...DOMAIN_AGENTS]) {
  const p = `.claude/agents/${name}.md`;
  if (!exists(p)) {
    fail(`${name} missing (${p})`);
    continue;
  }
  const fm = frontmatter(read(p));
  if (!fm) {
    fail(`${p}: no YAML frontmatter`);
    continue;
  }
  for (const k of ["name", "description", "tools", "model"])
    if (!fm[k]) fail(`${p}: frontmatter missing "${k}"`);
  if (fm.name && fm.name !== name)
    fail(`${p}: frontmatter name "${fm.name}" != filename "${name}"`);
}

report();
