// ──────────────────────────────────────────────────────────────────────────────
// THE FACE. The one element of the owner's reference design that must not change.
//
// Ported from docs/design/reference/face-hq/assets/arcface-v0.4/src/face/FaceStage.jsx:
// a 90x90 particle cyber-mask inside an ambient particle cloud, additively blended
// and bloomed, both repelled by the cursor, with the listening / thinking / talking
// states layered on top. Every constant is the reference's; none of them is a taste
// call this file gets to revisit.
//
// It lives on the FRONT DOOR only (face v2 Phase 09, ADR-1349): one fixed canvas at full
// presence behind the door. Crossing into the workroom fires the warp (the face flies past
// the camera) and then the door unmounts it -- the workroom is "a clean room, the face
// belongs to the front door" (v0.7 App.jsx). Coming back out it remounts mid-swoop.
//
// This file holds three.js wiring and nothing else. Every decision it makes -- the
// particle layout, the noise field, the repulsion physics, the reduced-motion
// contract, the speech envelope, the palette -- comes from ../lib/stage.mjs, which
// runs under plain node with no install and is therefore the only half of the face
// that CI can actually exercise (face/README.md, ADR-1316).
// ──────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import {
  BLOOM,
  CAMERA,
  CLOUD,
  FRAME_WINDOW,
  MASK,
  ambientProfile,
  approach,
  blendColors,
  bloomStrength,
  buildCloudLayout,
  buildMaskLayout,
  clampPresence,
  createNoise3D,
  createSpeechEnvelope,
  faceFlags,
  initialPixelRatio,
  maskTransform,
  memoizeToRGB,
  nextPixelRatio,
  prefersReducedMotion,
  presenceTarget,
  FACE_PALETTE,
  SPRITE,
  resolvePalette,
  shouldReapplyBlend,
  spreadTarget,
  stepCloud,
  stepMask,
  stepSpeechLevel,
  tiltTargets,
} from '../lib/stage.mjs'
import { WARP_IN_S, WARP_OUT_S, warpTargets } from '../lib/mode.mjs'

export type FaceState = 'idle' | 'listening' | 'thinking' | 'talking'

export interface FaceStageProps {
  /** How far forward the face sits, 0..1. 1 on the landing; ~0.25 behind a room. */
  presence?: number
  /** What arc is doing. The voice always wakes the face, whatever presence says. */
  state?: FaceState
  /** The door crossing: a new `id` starts a pass, `dir` 1 into the workroom, -1 back out (v0.7's stage.warp). */
  warp?: { dir: 1 | -1; id: number }
  /** The door's one look, the neon identity in both moods (ADR-1349 §4), instead of the live tokens. */
  neon?: boolean
  /** Called once when the stage cannot draw (no WebGL, or the loop threw), so the door can say so. */
  onUnavailable?: () => void
}

const STAGE_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  pointerEvents: 'none',
}

/** The cursor's resting place: far enough outside the scene to repel nothing. */
const AWAY = new THREE.Vector3(-9999, -9999, -9999)

export default function FaceStage({ presence = 1, state = 'idle', warp, neon = false, onUnavailable }: FaceStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // The render loop samples the props every frame instead of re-running the effect:
  // rebuilding the scene because presence moved would drop the WebGL context sixty
  // times a second.
  const liveRef = useRef<{ presence: number; state: FaceState; warp?: { dir: 1 | -1; id: number } }>({ presence, state, warp })
  useEffect(() => {
    liveRef.current = { presence, state, warp }
  }, [presence, state, warp])
  // Read through a ref so the scene is not rebuilt when the door hands in a new callback.
  const unavailableRef = useRef(onUnavailable)
  useEffect(() => {
    unavailableRef.current = onUnavailable
  }, [onUnavailable])
  const neonRef = useRef(neon)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || window.innerWidth
    const height = container.clientHeight || window.innerHeight

    // ── colour ────────────────────────────────────────────────────────────────
    // The accent is --accent, read off the live document, because a second spelling
    // of a colour is how a design system rots. three needs a number, so the token is
    // resolved once here; the literal fallback lives in stage.mjs, not in this file.
    const styles = getComputedStyle(document.documentElement)
    const palette = neonRef.current ? FACE_PALETTE : resolvePalette((name: string) => styles.getPropertyValue(name))
    const toRGB = memoizeToRGB((hex: string): [number, number, number] => {
      const c = new THREE.Color(hex)
      return [c.r, c.g, c.b]
    })

    // ── 1. scene / camera / renderer ──────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(palette.ground)
    const camera = new THREE.PerspectiveCamera(CAMERA.fov, width / height, CAMERA.near, CAMERA.far)
    camera.position.z = CAMERA.z

    // The WebGL guard (face v2 Phase 02, debt-ledger): where WebGL is unavailable the renderer's
    // constructor throws, and a throw here took the room around the stage down with it. The stage
    // is decoration; with no WebGL it draws nothing and the room stands.
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      unavailableRef.current?.()
      return
    }
    renderer.setSize(width, height)
    container.appendChild(renderer.domElement)

    // ── 2. bloom ──────────────────────────────────────────────────────────────
    const renderPass = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      BLOOM.strength,
      BLOOM.radius,
      BLOOM.threshold,
    )
    const composer = new EffectComposer(renderer)
    composer.addPass(renderPass)
    composer.addPass(bloomPass)

    // Supersample the internal resolution -- bright points on a dark ground alias badly at
    // 1x -- and let the frame-time guard below step it down if the GPU cannot hold it.
    let dpr = initialPixelRatio(window.devicePixelRatio)
    const applyResolution = () => {
      const w = container.clientWidth || width
      const h = container.clientHeight || height
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(dpr)
      composer.setPixelRatio(dpr)
      renderer.setSize(w, h)
      composer.setSize(w, h)
    }
    applyResolution()

    // ── 3. particle sprites ───────────────────────────────────────────────────
    const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())

    const createSpriteTexture = (paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = SPRITE.clear
        ctx.fillRect(0, 0, 128, 128)
        paint(ctx)
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = maxAnisotropy
      return texture
    }

    // The cloud's sprite: a soft diamond, bright core falling through cyan to blue.
    const glowTexture = createSpriteTexture((ctx) => {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(SPRITE.glow[0]![0], SPRITE.glow[0]![1])
      gradient.addColorStop(SPRITE.glow[1]![0], SPRITE.glow[1]![1])
      gradient.addColorStop(SPRITE.glow[2]![0], SPRITE.glow[2]![1])
      gradient.addColorStop(SPRITE.glow[3]![0], SPRITE.glow[3]![1])
      gradient.addColorStop(SPRITE.glow[4]![0], SPRITE.glow[4]![1])
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(64, 8)
      ctx.lineTo(120, 64)
      ctx.lineTo(64, 120)
      ctx.lineTo(8, 64)
      ctx.closePath()
      ctx.fill()
    })

    // The mask's sprite: the same diamond with a drawn rim, so the face reads as
    // machined cells rather than as a blur.
    const ringTexture = createSpriteTexture((ctx) => {
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      gradient.addColorStop(SPRITE.ring[0]![0], SPRITE.ring[0]![1])
      gradient.addColorStop(SPRITE.ring[1]![0], SPRITE.ring[1]![1])
      gradient.addColorStop(SPRITE.ring[2]![0], SPRITE.ring[2]![1])
      gradient.addColorStop(SPRITE.ring[3]![0], SPRITE.ring[3]![1])
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(64, 12)
      ctx.lineTo(116, 64)
      ctx.lineTo(64, 116)
      ctx.lineTo(12, 64)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = SPRITE.ringEdge
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(64, 28)
      ctx.lineTo(100, 64)
      ctx.lineTo(64, 100)
      ctx.lineTo(28, 64)
      ctx.closePath()
      ctx.stroke()
    })

    // ── 4. the cyber-mask ─────────────────────────────────────────────────────
    const mask = buildMaskLayout({ palette, toRGB })
    const maskPositions = new Float32Array(mask.positions)
    const maskOriginal = mask.positions
    const maskColors = new Float32Array(mask.colors)
    const maskBaseColors = mask.colors
    const maskListenColors = mask.listenColors
    const maskOffsets = new Float32Array(mask.count * 3)

    const maskPosAttr = new THREE.BufferAttribute(maskPositions, 3)
    const maskColorAttr = new THREE.BufferAttribute(maskColors, 3)
    const maskGeometry = new THREE.BufferGeometry()
    maskGeometry.setAttribute('position', maskPosAttr)
    maskGeometry.setAttribute('color', maskColorAttr)

    const maskMaterial = new THREE.PointsMaterial({
      size: MASK.size,
      map: ringTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: MASK.opacity,
    })
    const maskPoints = new THREE.Points(maskGeometry, maskMaterial)
    scene.add(maskPoints)

    // ── 5. the ambient cloud ──────────────────────────────────────────────────
    const cloud = buildCloudLayout({ palette, toRGB })
    const cloudPositions = new Float32Array(cloud.positions)
    const cloudOriginal = cloud.positions
    const cloudColors = new Float32Array(cloud.colors)
    const cloudBaseColors = cloud.colors
    const cloudListenColors = cloud.listenColors
    const cloudOffsets = new Float32Array(cloud.count * 3)

    const cloudPosAttr = new THREE.BufferAttribute(cloudPositions, 3)
    const cloudColorAttr = new THREE.BufferAttribute(cloudColors, 3)
    const cloudGeometry = new THREE.BufferGeometry()
    cloudGeometry.setAttribute('position', cloudPosAttr)
    cloudGeometry.setAttribute('color', cloudColorAttr)

    const cloudMaterial = new THREE.PointsMaterial({
      size: CLOUD.size,
      map: glowTexture,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: CLOUD.opacity,
    })
    const cloudPoints = new THREE.Points(cloudGeometry, cloudMaterial)
    scene.add(cloudPoints)

    // ── 6. the cursor ─────────────────────────────────────────────────────────
    const mouse2D = new THREE.Vector2(-9999, -9999)
    const mouse3D = new THREE.Vector3(-9999, -9999, -9999)
    const projected = new THREE.Vector3()
    const pointerTarget = new THREE.Vector3()
    const localMaskMouse = new THREE.Vector3()
    const localCloudMouse = new THREE.Vector3()
    let isMouseActive = false

    const onMouseMove = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      mouse2D.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse2D.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      isMouseActive = true
    }
    const onMouseLeave = () => {
      isMouseActive = false
      mouse2D.set(-9999, -9999)
    }
    window.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)

    // ── reduced motion ────────────────────────────────────────────────────────
    // A contract, not a courtesy: under it the ambient drift STOPS. It is also
    // watched, because the setting can be turned on while the page is open and a
    // face that keeps swimming until the next reload has not honoured it.
    const motionQuery =
      typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
    let reducedMotion = prefersReducedMotion(window)
    const onMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
    }
    if (motionQuery && typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', onMotionChange)
    }

    // ── the loop ──────────────────────────────────────────────────────────────
    const noise3D = createNoise3D()
    const clock = new THREE.Clock()
    const speech = createSpeechEnvelope()

    let animationFrameId = 0
    let resizeFrameId = 0
    let listenAmt = 0
    let lastListenApplied = -1
    let driftMul = ambientProfile({ reducedMotion }).drift
    let smoothedPresence = clampPresence(liveRef.current.presence)
    let spreadCur = spreadTarget(smoothedPresence)
    // A stage mounted by a crossing starts that crossing's pass; one mounted fresh has seen nothing.
    let warpSeen = -1
    let warpDir = 0
    let warpStart = -1
    let warpScaleMul = 1
    let warpOpacityMul = 1
    let warpFlash = 0
    let dead = false
    let lastT = 0
    let frameAcc = 0
    let frameN = 0

    const animate = () => {
      if (dead) return
      animationFrameId = requestAnimationFrame(animate)
      // A throw inside a frame reaches no error boundary (it is a rAF callback, not React), and it
      // would throw again sixty times a second. Stop the loop once and let the door say so.
      try {
        frame()
      } catch {
        dead = true
        cancelAnimationFrame(animationFrameId)
        unavailableRef.current?.()
      }
    }
    const frame = () => {
      const elapsed = clock.getElapsedTime()
      const dt = elapsed - lastT
      lastT = elapsed

      // adaptive resolution guard -- give back supersampling before giving up frames
      if (dt > 0 && dt < 0.5) {
        frameAcc += dt
        frameN++
        if (frameN >= FRAME_WINDOW) {
          const avg = frameAcc / frameN
          frameAcc = 0
          frameN = 0
          const stepped = nextPixelRatio(avg, dpr)
          if (stepped !== dpr) {
            dpr = stepped
            applyResolution()
          }
        }
      }

      const live = liveRef.current
      const flags = faceFlags(live.state)
      const ambient = ambientProfile({ reducedMotion, thinking: flags.thinking })
      const level = stepSpeechLevel(speech, dt, flags.speaking)

      // presence: the caller's target, but the voice always wakes the face
      smoothedPresence = approach(smoothedPresence, presenceTarget(live.presence, live.state), 0.055)

      // the warp: the door <-> workroom fly-through. Reduced motion skips the pass entirely.
      if (live.warp && live.warp.id !== warpSeen) {
        warpSeen = live.warp.id
        if (!reducedMotion) {
          warpDir = live.warp.dir
          warpStart = elapsed
        }
      }
      const pass = warpStart >= 0 ? warpTargets(warpDir, (elapsed - warpStart) / (warpDir > 0 ? WARP_IN_S : WARP_OUT_S)) : warpTargets(0, 1)
      if (pass.done) warpStart = -1
      warpScaleMul += (pass.scale - warpScaleMul) * 0.14
      warpOpacityMul += (pass.opacity - warpOpacityMul) * 0.14
      warpFlash += (pass.flash - warpFlash) * 0.14

      const shape = maskTransform({ presence: smoothedPresence, elapsed, level, breath: ambient.breath })
      maskPoints.scale.setScalar(shape.scale * warpScaleMul)
      maskMaterial.opacity = MASK.opacity * warpOpacityMul
      maskPoints.position.y = shape.maskY
      cloudPoints.position.y = shape.cloudY

      // listening: the mask leans icier and the cloud turns to diamond sparkle
      listenAmt = approach(listenAmt, flags.listening ? 1 : 0, 0.07)
      if (shouldReapplyBlend(listenAmt, lastListenApplied)) {
        lastListenApplied = listenAmt
        blendColors(maskColors, maskBaseColors, maskListenColors, listenAmt)
        maskColorAttr.needsUpdate = true
        blendColors(cloudColors, cloudBaseColors, cloudListenColors, listenAmt)
        cloudColorAttr.needsUpdate = true
      }

      // thinking: the cloud stirs faster. speaking: the bloom swells.
      driftMul = approach(driftMul, ambient.drift, 0.04)
      bloomPass.strength = bloomStrength({ level, listen: listenAmt }) + warpFlash
      cloudPoints.rotation.y += CLOUD.spin * ambient.spin

      // the mask follows the cursor, and sways slowly when there is none
      const tilt = tiltTargets({
        elapsed,
        mouseX: mouse2D.x,
        mouseY: mouse2D.y,
        pointerActive: isMouseActive,
        sway: ambient.sway,
      })
      maskPoints.rotation.y = approach(maskPoints.rotation.y, tilt.y, 0.06)
      maskPoints.rotation.x = approach(maskPoints.rotation.x, tilt.x, 0.06)
      maskPoints.rotation.z = approach(maskPoints.rotation.z, 0, 0.06)

      // project the cursor onto the z=0 plane, then chase it
      if (isMouseActive) {
        projected.set(mouse2D.x, mouse2D.y, 0.5).unproject(camera)
        const dir = projected.sub(camera.position).normalize()
        const distance = -camera.position.z / dir.z
        pointerTarget.copy(camera.position).add(dir.multiplyScalar(distance))
        mouse3D.lerp(pointerTarget, 0.1)
      } else {
        mouse3D.lerp(AWAY, 0.1)
      }

      localMaskMouse.copy(mouse3D)
      maskPoints.worldToLocal(localMaskMouse)
      stepMask({
        positions: maskPositions,
        original: maskOriginal,
        offsets: maskOffsets,
        mouthInfluence: mask.mouthInfluence,
        count: mask.count,
        mouse: localMaskMouse,
        level,
        elapsed,
      })
      maskPosAttr.needsUpdate = true

      localCloudMouse.copy(mouse3D)
      cloudPoints.worldToLocal(localCloudMouse)
      spreadCur = approach(spreadCur, spreadTarget(smoothedPresence) + pass.spread, 0.08)
      stepCloud({
        positions: cloudPositions,
        original: cloudOriginal,
        offsets: cloudOffsets,
        count: cloud.count,
        mouse: localCloudMouse,
        spread: spreadCur,
        drift: CLOUD.drift * driftMul,
        tOffset: elapsed * 0.25 * driftMul,
        elapsed,
        noise3D,
      })
      cloudPosAttr.needsUpdate = true

      composer.render()
    }
    animate()


    // ── teardown ──────────────────────────────────────────────────────────────
    // The stage is meant to outlive every room, so the one time it does come down
    // it has to come down completely. A GPU context that survives an unmount is
    // permanent -- browsers keep a handful and then start killing the oldest, which
    // is a blank canvas somewhere else in the product, not an error here.
    let resizeObserver: ResizeObserver | null = null
    const teardown = () => {
      dead = true
      cancelAnimationFrame(animationFrameId)
      if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
      resizeObserver?.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      if (motionQuery && typeof motionQuery.removeEventListener === 'function') {
        motionQuery.removeEventListener('change', onMotionChange)
      }

      scene.remove(maskPoints)
      scene.remove(cloudPoints)
      maskGeometry.dispose()
      maskMaterial.dispose()
      ringTexture.dispose()
      cloudGeometry.dispose()
      cloudMaterial.dispose()
      glowTexture.dispose()

      bloomPass.dispose()
      renderPass.dispose()
      composer.dispose()

      renderer.domElement.remove()
      renderer.dispose()
      renderer.forceContextLoss()
    }

    // A throw here (no ResizeObserver in this browser) would skip the returned teardown, leaving the loop, the
    // listeners and every GPU resource alive. Release them all, then let the door's boundary catch it.
    try {
      resizeObserver = new ResizeObserver(() => {
        if (resizeFrameId) cancelAnimationFrame(resizeFrameId)
        resizeFrameId = window.requestAnimationFrame(() => {
          resizeFrameId = 0
          applyResolution()
        })
      })
      resizeObserver.observe(container)
    } catch (err) {
      teardown()
      throw err
    }

    return teardown
  }, [])

  return <div ref={containerRef} data-stage="face" aria-hidden="true" style={STAGE_STYLE} />
}
