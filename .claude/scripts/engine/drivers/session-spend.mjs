/**
 * drivers/session-spend.mjs -- what a `claude` CLI session spent, read at session end (ADR-0229, engine Cycle 9).
 *
 * THE INTERFACE: `read(envelope)` returns the raw provider figure as `{ value, currency }` for `writeCost`'s `spend`,
 * where `spendOf` alone turns it into money. It never parses, rounds or defaults: a missing field is `value:
 * undefined`, which `writeCost` records as `not-reported`, never 0.
 *
 * REAL: the CLI's own usage surface -- the result envelope's `total_cost_usd`, the same object on both paths: the
 * `--output-format json` document and the stream's final `{"type":"result"}` event. Pinned against verbatim captures
 * of CLI 2.1.296 in `tests/fixtures/engine/real-claude-*.json`. On a subscription login the figure is the harness's
 * notional list price, not an invoice (`basis: harness-reported`, ADR-0230).
 *
 * FAKE: the fake CLIs under `tests/fixtures/engine/` print envelopes with the field present, absent and malformed;
 * the driver reads them through this same function, so fake and real share one code path.
 */
export const SessionSpend = Object.freeze({
  /** @param {unknown} envelope  the CLI's result envelope, or anything at all */
  read(envelope) {
    const value = envelope && typeof envelope === "object" && !Array.isArray(envelope) ? envelope.total_cost_usd : undefined;
    return { value, currency: "USD" };
  },
});
