// availability-context.ts -- the room's availability counts, from the host to the room header (face v2 Phase 15,
// REQ-19, ADR-1354).
//
// RoomFrame folds the module and counts its `unknown` and `not-instrumented` fields (registry.mjs
// availabilityCountsOf); RoomHead reads them here, so every module room's header shows them without one View
// passing a number it could get wrong. Outside a module room the counts are zero, and zero draws nothing.
import { createContext } from 'react'

export type AvailabilityCounts = { unknown: number; notInstrumented: number }

export const AvailabilityCountsContext = createContext<AvailabilityCounts>({ unknown: 0, notInstrumented: 0 })
