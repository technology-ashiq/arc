// StageGuard.tsx -- the boundary around the face (face v2 Phase 09, ADR-1349 §2, the debt ledger's guard row).
//
// The stage is the heaviest code in the face and it is decoration: a stage that throws while mounting must take itself
// down and nothing else, so ENTER HQ still opens the workroom. A frame that throws is caught inside FaceStage (a rAF
// callback reaches no boundary); this catches what React can see: a throw in render or in the stage's effect.
import { Component } from 'react'
import type { ReactNode } from 'react'

export default class StageGuard extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    this.props.onFail()
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
