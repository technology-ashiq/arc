// fold.mjs -- command/board: every decision this module makes, where node can import it with no install
// (face v2 Phase 02, ADR-1320). CARRIED: the Cycle 15 renderer still decides inside its own lib file;
// this fold hands it what the shell used to hand it, and nothing else.

/**
 * @typedef {object} Folded
 * @property {string} sentence
 * @property {string} lede
 * @property {Record<string, string> | undefined} adrBands
 */

/**
 * @param {Record<string, unknown>} payloads  the declared routes' payloads -- this module declares none
 * @param {import("../../../lib/registry.mjs").FoldContext} ctx
 * @returns {Folded}
 */
export function fold(payloads, ctx) {
  return {
    sentence: ctx.room.sentence,
    lede: ctx.room.lede,
    adrBands: ctx.inventories ? ctx.inventories.adrs : undefined,
  };
}
