// View.tsx -- money/money: renders what fold() returned, and decides nothing (face v2 Phase 02, ADR-1320).
//
// CARRIED: the Cycle 15 MoneyRoom renderer, drawn through the module frame; Phase 03's money ring
// replaces this View with the port of v0.7's Money.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import MoneyRoom from '../../../rooms/MoneyRoom'
export { CurrencyInr as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleContext }) {
  return <MoneyRoom door={ctx.door} room={ctx.room} sentence={f.sentence} lede={f.lede} />
}
