// View.tsx -- command/spine: renders what fold() returned, and decides nothing (face v2 Phase 02, ADR-1320).
//
// CARRIED: the Cycle 15 SpineRoom renderer, drawn through the module frame; Phase 03's command ring
// replaces this View with the port of v0.7's SpineRoom.
import type { ModuleContext } from '../../../lib/registry.mjs'
import type { Folded } from './fold.mjs'
import SpineRoom from '../../../rooms/SpineRoom'
export { Pulse as Icon } from '@phosphor-icons/react'

export default function View({ f, ctx }: { f: Folded; ctx: ModuleContext }) {
  return <SpineRoom door={ctx.door} room={ctx.room} sentence={f.sentence} lede={f.lede} />
}
