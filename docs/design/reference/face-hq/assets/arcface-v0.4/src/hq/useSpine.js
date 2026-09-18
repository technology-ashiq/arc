import { useSyncExternalStore } from 'react'
import { subscribe, getVersion } from '../spine/store.js'

// re-render on every spine append/notify
export function useSpine() {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}
