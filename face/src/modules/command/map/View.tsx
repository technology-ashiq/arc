// View.tsx -- command/map: renders what fold() returned, and decides nothing (face v2 Phase 02, ADR-1320).
//
// CARRIED: the Cycle 15 MapRoom renderer, drawn through the module frame; Phase 03's command ring
// replaces this View with the port of v0.7's MapRoom.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import MapRoom from '../../../rooms/MapRoom'
export { MapTrifold as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleContext }) {
  return <MapRoom rooms={ctx.rooms} onOpen={ctx.onOpen} mode={ctx.mode} token={ctx.token} needsYou={f.needsYou} needsYouUnplaced={f.needsYouUnplaced} />
}
