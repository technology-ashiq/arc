---
description: English -> committed Mermaid diagram, saved into the tracker/docs so it renders in PRs and stays version-controlled (not a throwaway preview).
argument-hint: <what to diagram>
allowed-tools: Read, Edit, Write, Bash
---

Turn this into a committed diagram: **$ARGUMENTS**

1. Produce a **Mermaid** diagram of the right type (flowchart / sequence / state / C4-concept).
2. Save the mermaid **source** into the relevant committed doc: `PLAN.md` (C4 concept), an ADR under `docs/adr/`, or `docs/diagrams/<name>.md` -- so it renders in PRs and is diff-able.
3. Keep the source of truth as text. If a rendered SVG is needed, emit it alongside, never as the only artifact.

Arc twist: diagrams live inside the committed tracker/docs, not as throwaway browser previews.
