# ADR 0059 — PORT-J: ventures appear only as passport rows

**Status:** accepted
**Date:** 2026-07-30
**Reversibility:** two-way

## Context

Ventures (LexOS, venturemind, …) are revenue apps in their own repos running root-mode
arc installs. The board should show them without ever importing their state. Source pack:
`docs/strategy/plans/PLAN-portfolio.md` §1, §5 PORT-J (round-3 two-table correction).

## Options considered

- Ventures as lanes inside arc — rejected: reverses existing law; venture code and
  tracker state never live inside arc.
- Passport rows in a separate board table — accepted.

## Decision

A venture appears on `PORTFOLIO.md` ONLY in the **Venture passports** table: venture ·
repository · current status · next. Passport rows are grammar-checked but exempt from the
lane↔dir consistency lint (ventures have no lane dir). A venture in the initiatives table
— or an initiative in the passports table — is itself a lint WARN, keeping the boundary
clean permanently.

## Consequences

- Reaffirms existing law (own repo, own root-mode install); nothing changes for venture
  workflows — root-mode byte-identity (ADR 0054) is exactly their contract.
- The board answers "what is the company doing" including revenue apps, without any
  cross-repo state coupling.
