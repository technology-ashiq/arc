# ADR 1006 — LED-G: costs carry a source label, and the three sources never sum into one number

**Status:** accepted
**Date:** 2026-08-12
**Product:** `ledger`
**Reversibility:** two-way
**Revisit trigger:** a reader repeatedly asks for "the total cost" and hand-adds the labelled lines
anyway — the separation is then failing at its job and the fork reopens as a labelled composite.

## Context

Three kinds of number want to be called a cost, and they are not the same kind of fact:

- **measured / derived** — a run's actual token cost, read from a receipt
- **declared** — a subscription or fixed monthly fee, entered by a human
- **allocated** — a share of a shared cost apportioned across ventures by some rule

Summing them produces a single confident figure whose confidence is unearned. MP-F already
governs the first: recorded, estimated and fabricated are three different things, only the first
is allowed, and absent stays absent.

## Options considered

1. **Three labelled classes, never summed into one number** — every cost line says where it came
   from; apportioned figures are marked `allocated` and rendered separately.
2. **One "total cost" with a footnote** — reads better and is the number everyone quotes; the
   footnote is not quoted with it.
3. **Apportion subscription costs per run** — makes AI spend look precise per venture. A flat
   monthly fee divided by run count is fake precision: the fee did not change because a run happened.

## Decision

Option 1. Costs carry a `source` on every line. Subscription AI plans are **declared fixed costs**,
never apportioned per run. Apportionment views are labelled `allocated` and never summed with
measured into one number — a fixture asserts a mixed-source month renders **two labelled lines,
not one total**.

`venture: arc` costs are **Overhead** and are never attributed to a venture: building the factory
is not a cost of any product made in it.

Absent is not zero. A month with no measured run costs renders absent, not `0`.

The reason that carried the most weight: the whole module's value is that its numbers can be
trusted without explanation, and a summed figure needs the most explanation of any number in it.

## Consequences

Easier: every cost figure is auditable to a source, and MP-F's discipline extends to money
without being re-invented.

Harder: there is no single "what did this venture cost" number, which is occasionally what someone
wants. They get two or three labelled numbers instead, and adding them is their explicit act.

The per-venture "rupees returned per AI-rupee spent" ratio is a future `metric.observed` candidate
for the `evolve` lane once its vocabulary lands. **Nothing ships here** — it is named so it is not
re-derived from scratch later.
