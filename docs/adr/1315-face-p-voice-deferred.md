# ADR 1315 — FACE-P: voice on the brain dock is optional, behind a setting, and not v1

**Status:** accepted
**Date:** 2026-08-19
**Product:** face
**Reversibility:** two-way
**Revisit trigger:** the owner asks for voice after dogfood (REQ-10 retro is the natural
place) → a small `/arc-change` adds Web Speech input/output behind a setting.

## Context

"Ask arc" (ADR-1307) could take speech input and read answers back. Web Speech APIs are
built into the browser — no dependency — but voice UX is a rabbit hole (wake words,
mis-transcription of ULIDs and kind names, IST-dense numbers read aloud).

## Options considered

1. **Defer voice; keyboard-first stands** — pros: zero appetite spent; the brain dock's
   contract (text in, cited answer out) is voice-ready later. Cons: none for a
   keyboard-first desktop tool.
2. **Ship voice in v1** — cons: appetite into a rabbit hole named by the plan.

## Decision

Option 1. Voice is optional Web Speech input/output behind a setting, never required,
and **not v1 scope**. The brain dock ships text-only this cycle.

## Consequences

Easier: block C stays 13 days. Harder: nothing — the door stays open by contract.
