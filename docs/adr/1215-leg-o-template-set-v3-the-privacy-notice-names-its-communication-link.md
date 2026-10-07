# ADR 1215 — LEG-O: template set v3, because the privacy notice must name its communication link

**Status:** accepted
**Date:** 2026-10-07
**Product:** `legal`
**Reversibility:** two-way
**Revisit trigger:** the Rule 3 text is amended, or MeitY prescribes the notice's form (a consent
manager interface, a standard layout) — then the privacy template is re-read against the new text
and a new set is cut.

## Context

Assumptions-ledger row 2 said the Rule 3 text was transcribed from mirrors because both
government hosts returned HTTP 403 at kickoff (ADR-1206, medium confidence). Phase 03 requires a
re-check against the gazette before the real publish.

On 2026-10-07 the MeitY-hosted gazette PDF answered (`meity.gov.in/static/uploads/2025/11/...`,
HTTP 200, 41 pages, G.S.R. 846(E) dated 13-Nov-2025). Read against it:

- **Commencement is as ADR-1206 recorded.** Rule 1(4): Rules 3, 5 to 16, 22 and 23 come into force
  eighteen months after publication, which is 13-May-2027. The MeitY compression proposal is still
  un-gazetted, per secondary sources dated September 2026, so ADR-1206's revisit trigger has NOT
  fired.
- **Rule 3(a) and (b) are met.** The notice stands alone. It itemises the personal data and the
  purposes, and describes the service.
- **Rule 3(c) is not met.** The notice must give "the particular communication link for accessing
  the website or app, or both, of such Data Fiduciary", together with the means to withdraw consent,
  exercise rights and complain to the Board. The rendered privacy page printed the mailboxes and
  never the site. `site_url` appeared on about, terms, refund and delivery, and not on the page
  Rule 3 is about.

So the row's trigger fired: an itemised requirement differs from the rendered notice block.

## Options considered

1. **Edit v2 in place.** v2 is approved at fixed bytes (`approved-sets.json`). An in-place edit
   moves its hash, and publish refuses every venture on v2 with SET_EDITED_SINCE_APPROVAL. Quietly
   re-recording the hash would approve prose nobody read as prose (REQ-07).
2. **Cut v3 with one added sentence**, leave v1 and v2 untouched (A10: superseded versions keep
   their files), take v3's prose approval as its own decision, and bump LexOS to v3.

## Decision

**Option 2.** v3 = v2 plus one sentence in `PRIVACY.IDENTITY`: the notice names the service at
`facts.site_url` as where it is published, and points to the sections below for withdrawal, rights
and complaints. No clause id is added or removed, so the completeness lint, the scenario set and
the cross-page claims stay as they were.

v3's prose approval is raised on the spine as its own `approval.requested`, and is not recorded by
hand. Until now `propose-templates` printed a payload, and the approval was written into
`approved-sets.json` with no event behind it. The record for v3 names the decision id.

**Evidence:** the gazette PDF, read 2026-10-07; `products/legal/templates/v2/privacy.tmpl.md`; the
LexOS render under v2 (site URL count 0) and under v3 (1).
**Confidence:** high on the gap, because it was read from the primary text. The wording of the fix
is drafting, so it is the owner's to approve.
**Rejected because:** Option 1 approves prose that nobody read, which is the exact failure REQ-07
exists to prevent.

## Consequences

- Ventures pinned to v1 or v2 keep rendering as they did. Each moves to v3 by `--bump-templates`
  and a fresh approval, which is how the assumptions row says it should happen.
- `PRIVACY.IDENTITY` now interpolates `site_url`, which is a printed field. It gets its own
  per-field print in the ledger, and that print lives in the venture's own directory (ADR-1214).
