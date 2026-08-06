/**
 * E2 drift detection (ADR-0506): two ordered checks over ONE buffer.
 *
 *   1. sha256 of the live CONSTITUTION.md must equal the value pinned in hq.policy.yaml.
 *      Failure means the Constitution changed without a new adoption receipt.
 *   2. ONLY THEN, parse the E2 paragraph and compare it element-wise to ungrantable_actions.
 *
 * The first draft of this check compared the file hash and called that a quote-drift check. It
 * is not: hashing CONSTITUTION.md proves the Constitution has not changed and says nothing
 * whatever about whether the five strings copied into hq.policy.yaml still match it. The named
 * failure mode -- a drifted copy -- would have passed. That is the poster-document failure class
 * appearing inside the control built to prevent it.
 *
 * WHY A STRICT PROSE PARSER IS SAFE HERE, and only here: step 1 gates step 2, so the parser's
 * input is a file whose bytes are pinned. Reformat E2 -- even rewrap a line -- and the hash check
 * fails first, by name. Brittleness only hurts when the input can drift silently, and this input
 * provably cannot. Both steps read ONE buffer, so there is no TOCTOU gap between them.
 *
 * Byte-stability across the win32 dev box and the ubuntu CI runners comes from .gitattributes
 * (`* text=auto eol=lf`, repo-wide) -- verified, not assumed: CONSTITUTION.md holds zero CR
 * bytes. It is safe by one line in that file rather than by nature, which is why the failure
 * message below names .gitattributes.
 */

import { createHash } from "node:crypto";

const HEADING = "**E2 · Human Sovereignty.**"; // U+00B7 MIDDLE DOT -- read as UTF-8
const OPEN = "belong to the human alone: ";
const CLOSE = ". No level";

export class ConstitutionError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "ConstitutionError";
    this.code = code || "BAD_CONSTITUTION_PIN";
  }
}

/** Step 1: the version pin. */
export function checkConstitutionHash(buffer, pinnedSha256) {
  const actual = createHash("sha256").update(buffer).digest("hex");
  if (actual !== pinnedSha256) {
    throw new ConstitutionError(
      `CONSTITUTION.md sha256 is ${actual} but hq.policy.yaml pins ${pinnedSha256}. Either the ` +
        `Constitution changed without a new constitution.adopted receipt, or the checkout rewrote ` +
        `its bytes -- check .gitattributes still pins it to LF before assuming the text changed.`,
      "CONSTITUTION_HASH_MISMATCH"
    );
  }
  return actual;
}

/**
 * Step 2: extract E2's five items. Runs only after the hash check has passed.
 * Returns exactly five strings or throws -- a short list is never silently accepted.
 */
export function parseE2(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => l.trim() === HEADING);
  if (at === -1)
    throw new ConstitutionError(`the E2 heading was not found in CONSTITUTION.md`, "E2_NOT_FOUND");

  const para = [];
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].trim() === "") break;
    para.push(lines[i].trim());
  }
  const joined = para.join(" ");

  const open = joined.indexOf(OPEN);
  const close = joined.indexOf(CLOSE);
  if (open === -1 || close === -1 || close <= open)
    throw new ConstitutionError(
      `the E2 paragraph does not match the expected shape -- looked for ${JSON.stringify(OPEN)} ` +
        `followed by ${JSON.stringify(CLOSE)}`,
      "E2_SHAPE"
    );

  const items = joined
    .slice(open + OPEN.length, close)
    .split(", ")
    .map((s) => s.trim());

  if (items.length !== 5)
    throw new ConstitutionError(
      `E2 parsed to ${items.length} items, expected exactly 5: ${JSON.stringify(items)}`,
      "E2_COUNT"
    );
  return items;
}

/** Step 2b: the quote in the policy file must equal the parsed clause, element for element. */
export function checkE2Quote(declared, actual) {
  if (!Array.isArray(declared))
    throw new ConstitutionError("ungrantable_actions must be a list", "E2_QUOTE_SHAPE");
  if (declared.length !== actual.length)
    throw new ConstitutionError(
      `ungrantable_actions has ${declared.length} entries but E2 names ${actual.length}`,
      "E2_QUOTE_DRIFT"
    );
  for (let i = 0; i < actual.length; i++) {
    if (declared[i] !== actual[i])
      throw new ConstitutionError(
        `ungrantable_actions[${i}] is ${JSON.stringify(declared[i])} but E2 says ` +
          `${JSON.stringify(actual[i])} -- the quote drifted from the adopted text`,
        "E2_QUOTE_DRIFT"
      );
  }
  return actual;
}

/** The whole gate, in the only order that is sound. */
export function verifyConstitution(buffer, pinnedSha256, declaredActions) {
  checkConstitutionHash(buffer, pinnedSha256);
  const actual = parseE2(buffer.toString("utf8"));
  checkE2Quote(declaredActions, actual);
  return actual;
}
