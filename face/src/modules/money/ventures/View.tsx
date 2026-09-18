// View.tsx -- money/ventures: renders what fold() returned, and decides nothing (face v2 Phase 02, ADR-1320).
//
// CARRIED: the Cycle 15 VenturesRoom renderer, drawn through the module frame; Phase 03's money ring
// replaces this View with the port of v0.7's Ventures.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import VenturesRoom from '../../../rooms/VenturesRoom'
export { Rocket as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleContext }) {
  return <VenturesRoom door={ctx.door} room={ctx.room} sentence={f.sentence} lede={f.lede} declared={f.declared} />
}
