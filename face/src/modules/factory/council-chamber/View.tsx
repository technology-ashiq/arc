// View.tsx -- factory/council-chamber: renders what fold() returned, and decides nothing (face v2 Phase 02, ADR-1320).
//
// CARRIED: the Cycle 15 CouncilRoom renderer, drawn through the module frame; Phase 03's factory ring
// replaces this View with the port of v0.7's Council.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import CouncilRoom from '../../../rooms/CouncilRoom'
export { Gavel as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleContext }) {
  return <CouncilRoom door={ctx.door} room={ctx.room} sentence={f.sentence} lede={f.lede} />
}
