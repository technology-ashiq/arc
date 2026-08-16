// content-sha.mjs — the one definition of `content.published.content_sha` (ADR-1101).
//
// It is `sha256` over the RAW BYTES of the published `.mdx` file as it exists in the site repo's
// merged tree. Three things it is deliberately NOT, each of which was a live option:
//
//   - NOT a git blob sha. `git hash-object` prefixes a header before hashing, so the value would
//     be a git implementation detail rather than a property of the article, and anyone verifying
//     it with a plain sha256 of the file would get a different answer and conclude the receipt
//     was forged.
//   - NOT the rendered HTML. That changes whenever the layout changes, so an untouched article
//     would look edited to the unedited-approval counter (ADR-1107) and the L2 evidence count
//     would silently stop climbing for a reason nobody could see.
//   - NOT normalized. Line endings are hashed as they are. A normalizing hash reports two
//     genuinely different files as identical, and this value is what the idem is built on.
//
// The single definition lives here rather than inline at both call sites, because the approval
// path (which hashes the draft) and the publish path (which hashes the merged file) must agree
// byte-for-byte or `unedited := draft_sha == content_sha` compares two different functions.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** sha256 of the given bytes, lowercase hex. */
export function contentShaOfBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError("contentShaOfBytes expects a Buffer of the raw file bytes");
  return createHash("sha256").update(bytes).digest("hex");
}

/** sha256 of a file on disk, read as raw bytes with no encoding and no normalization. */
export async function contentShaOfFile(path) {
  return contentShaOfBytes(await readFile(path));
}
