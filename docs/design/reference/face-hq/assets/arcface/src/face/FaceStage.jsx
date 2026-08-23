// ──────────────────────────────────────────────────────────────────────
// THE FACE — the one thing kept from the original design, by request.
// Particle cyber-mask + ambient cloud ported from Ashiq's chosen concept
// (jiro.build "Human Synthesis"), with the voice-driven mouth, listening
// morph and thinking drift layered on top. In this redesign the face is
// the PERSISTENT STAGE: a fixed canvas behind the whole experience.
// It never unmounts — every chapter is a view drawn over the same
// living presence, the way every arc surface is a view over one spine.
//
// `stage.presence` (0..1, written by App from scroll) drives how far
// forward the face sits: 1 at the hero and the finale, ~0.3 while
// reading. Speaking or listening always wakes it back up.
//
// `stage.warp` fires on every landing ⇄ HQ crossing: going in, the face
// accelerates toward the camera and flies past (the GLM hero's
// scroll-zoom, retimed as a doorway); coming back, it swoops in from
// beyond the lens. The ambient cloud blooms outward with each pass.
// Skipped entirely under reduced motion.
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createNoise3D } from 'simplex-noise'
import { bus } from '../lib/voice.js'
import { stage } from '../lib/stage.js'

export default function FaceStage() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const width = container.clientWidth
    const height = container.clientHeight

    // 1. Scene / camera / renderer — as in the concept
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#000000')
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100)
    camera.position.z = 24

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setSize(width, height)
    container.appendChild(renderer.domElement)

    // 2. Bloom post-processing (concept-tuned values)
    const renderPass = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.18, 0.35)
    const composer = new EffectComposer(renderer)
    composer.addPass(renderPass)
    composer.addPass(bloomPass)

    // Crispness: supersample the internal resolution; adaptive guard below
    // drops it stepwise if the GPU can't keep up.
    let dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5)
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

    // 3. Particle sprite textures — verbatim from the concept
    const createGlowTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)'
        ctx.fillRect(0, 0, 128, 128)
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
        gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)')
        gradient.addColorStop(0.5, 'rgba(0, 255, 230, 0.6)')
        gradient.addColorStop(0.8, 'rgba(0, 100, 255, 0.2)')
        gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(64, 8)
        ctx.lineTo(120, 64)
        ctx.lineTo(64, 120)
        ctx.lineTo(8, 64)
        ctx.closePath()
        ctx.fill()
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      return texture
    }

    const createRingTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)'
        ctx.fillRect(0, 0, 128, 128)
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
        gradient.addColorStop(0.3, 'rgba(0, 255, 240, 0.8)')
        gradient.addColorStop(0.7, 'rgba(0, 150, 255, 0.35)')
        gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(64, 12)
        ctx.lineTo(116, 64)
        ctx.lineTo(64, 116)
        ctx.lineTo(12, 64)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(64, 28)
        ctx.lineTo(100, 64)
        ctx.lineTo(64, 100)
        ctx.lineTo(28, 64)
        ctx.closePath()
        ctx.stroke()
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
      return texture
    }

    // 4. THE CYBER-MASK — geometry math ported verbatim from the concept,
    //    plus per-particle mouth influence for the voice layer.
    const maskRadius = 4.0
    const cols = 90
    const rows = 90
    const tempMaskPositions = []
    const tempMaskColors = []
    const tempMaskListenColors = []
    const tempMouthInf = []

    for (let rIndex = 0; rIndex < rows; rIndex++) {
      const v = (rIndex / (rows - 1)) * 2.0 - 1.0
      for (let cIndex = 0; cIndex < cols; cIndex++) {
        const u = (cIndex / (cols - 1)) * 2.0 - 1.0

        const theta = u * (Math.PI / 2.6)
        const phi = v * (Math.PI / 2.8)

        const baseRadius = maskRadius * (1.05 - 0.12 * v * v)
        let x = baseRadius * Math.sin(theta)
        let y = maskRadius * 1.25 * Math.sin(phi)
        let z = baseRadius * Math.cos(theta) * 0.72

        if (v < -0.2) {
          const taper = 1.0 - Math.abs(v + 0.2) * 0.45
          x *= taper
        }

        const distFromCenter = Math.abs(theta)
        let isNose = false
        if (distFromCenter < 0.26 && v > -0.25 && v < 0.45) {
          const nw = 1.0 - distFromCenter / 0.26
          const nh = Math.cos(((v - 0.1) / 0.35) * (Math.PI / 2))
          if (nh > 0) {
            z += 1.15 * nw * nh
            isNose = true
          }
        }

        if (v > 0.5) {
          const foreheadCurve = Math.pow((v - 0.5) / 0.5, 2) * 0.45
          z -= foreheadCurve
        }

        const leftEyeX = -0.42
        const rightEyeX = 0.42
        const eyeY = 0.22
        const eyeWidth = 0.22
        const eyeHeight = 0.14

        const distLeftEye = Math.sqrt(Math.pow((u - leftEyeX) / eyeWidth, 2) + Math.pow((v - eyeY) / eyeHeight, 2))
        const distRightEye = Math.sqrt(Math.pow((u - rightEyeX) / eyeWidth, 2) + Math.pow((v - eyeY) / eyeHeight, 2))
        if (distLeftEye < 0.85 || distRightEye < 0.85) continue

        const mouthX = 0.0
        const mouthY = -0.42
        const distMouth = Math.sqrt(Math.pow((u - mouthX) / 0.34, 2) + Math.pow((v - mouthY) / 0.06, 2))
        if (distMouth < 0.7) continue

        if (v > -0.55 && v < -0.3 && distFromCenter < 0.4) {
          const lipFactor = (1.0 - distFromCenter / 0.4) * 0.25 * Math.sin((v + 0.42) * 10.0)
          z += lipFactor
        }

        const jitter = 0.015
        x += (Math.random() - 0.5) * jitter
        y += (Math.random() - 0.5) * jitter
        z += (Math.random() - 0.5) * jitter

        tempMaskPositions.push(x, y, z)

        // mouth influence — how strongly this particle moves when arc speaks
        const mouthAmt = Math.max(0, 1.0 - (distMouth - 0.7) / 1.9)
        tempMouthInf.push(mouthAmt * mouthAmt)

        const c = new THREE.Color()
        const lc = new THREE.Color()
        const edgeLeftEye = Math.abs(distLeftEye - 1.0)
        const edgeRightEye = Math.abs(distRightEye - 1.0)
        const isNearEyeBorder = edgeLeftEye < 0.18 || edgeRightEye < 0.18

        if (isNearEyeBorder) {
          c.set('#ffffff')
          lc.set('#ffffff')
        } else if (isNose) {
          c.set('#00ffff')
          lc.set('#8dffff')
        } else if (Math.abs(u) > 0.85 || Math.abs(v) > 0.85) {
          c.set('#00a390')
          lc.set('#00d4ba')
        } else {
          const blend = Math.random()
          if (blend < 0.35) c.set('#00ffd1')
          else if (blend < 0.7) c.set('#00ffff')
          else c.set('#00aaff')
          // listening state — the whole face leans brighter / icier
          const lb = Math.random()
          if (lb < 0.35) lc.set('#7dffe9')
          else if (lb < 0.7) lc.set('#a6ffff')
          else lc.set('#66ccff')
        }

        tempMaskColors.push(c.r, c.g, c.b)
        tempMaskListenColors.push(lc.r, lc.g, lc.b)
      }
    }

    const maskParticleCount = tempMaskPositions.length / 3
    const maskGeometry = new THREE.BufferGeometry()
    const maskPositions = new Float32Array(tempMaskPositions)
    const maskColors = new Float32Array(tempMaskColors)
    const maskBaseColors = new Float32Array(tempMaskColors)
    const maskListenColors = new Float32Array(tempMaskListenColors)
    const mouthInf = new Float32Array(tempMouthInf)

    maskGeometry.setAttribute('position', new THREE.BufferAttribute(maskPositions, 3))
    maskGeometry.setAttribute('color', new THREE.BufferAttribute(maskColors, 3))

    const maskMaterial = new THREE.PointsMaterial({
      size: 0.16,
      map: createRingTexture(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    })

    const maskPoints = new THREE.Points(maskGeometry, maskMaterial)
    scene.add(maskPoints)

    const originalMaskPositions = new Float32Array(maskPositions)
    const maskRepulsionOffsets = new Float32Array(maskParticleCount * 3)

    // 5. OUTER SCATTERED CLOUD — ported from the concept (halo band +
    //    ambient cloud, hollow center), diamond sparkle = listening state.
    const CLOUD_DENSITY = 0.82
    const particleCount = Math.round(14000 * CLOUD_DENSITY)
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const originalPositions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const originalOuterColors = new Float32Array(particleCount * 3)
    const diamondOuterColors = new Float32Array(particleCount * 3)

    const coreColor = new THREE.Color('#00ffc8')
    const outerColor = new THREE.Color('#062d30')
    const maxRadius = 15
    const hollowGapRadius = 3.5 + 1.4

    for (let i = 0; i < particleCount; i++) {
      let x = 0
      let y = 0
      let z = 0
      let r = 0
      let tries = 0

      do {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(Math.random() * 2 - 1)
        r = 0

        const distributionSeed = Math.random()
        if (distributionSeed < 0.55) {
          const u1 = Math.random() || 0.0001
          const u2 = Math.random()
          const stdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2)
          r = maxRadius * (0.55 + stdNormal * 0.08)
        } else {
          r = hollowGapRadius + (maxRadius - hollowGapRadius) * Math.pow(Math.random(), 1.5)
        }
        r = Math.max(r, hollowGapRadius)

        x = r * Math.sin(phi) * Math.cos(theta)
        y = r * Math.sin(phi) * Math.sin(theta)
        z = r * Math.cos(phi)
        tries++
      } while (tries < 8 && z > 2.5 && Math.sqrt(x * x + y * y) < 7.0 && Math.random() < 0.72)

      const rRatio = Math.min(r / maxRadius, 1.0)
      const particleColor = new THREE.Color()
      if (rRatio < 0.45) {
        const t = rRatio / 0.45
        particleColor.lerpColors(coreColor, coreColor.clone().lerp(outerColor, 0.45), t)
      } else {
        const t = (rRatio - 0.45) / 0.55
        particleColor.lerpColors(coreColor.clone().lerp(outerColor, 0.45), outerColor, t)
      }
      particleColor.r += (Math.random() - 0.5) * 0.03
      particleColor.g += (Math.random() - 0.5) * 0.03
      particleColor.b += (Math.random() - 0.5) * 0.03

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
      originalPositions[i * 3] = x
      originalPositions[i * 3 + 1] = y
      originalPositions[i * 3 + 2] = z

      colors[i * 3] = THREE.MathUtils.clamp(particleColor.r, 0, 1)
      colors[i * 3 + 1] = THREE.MathUtils.clamp(particleColor.g, 0, 1)
      colors[i * 3 + 2] = THREE.MathUtils.clamp(particleColor.b, 0, 1)
      originalOuterColors[i * 3] = colors[i * 3]
      originalOuterColors[i * 3 + 1] = colors[i * 3 + 1]
      originalOuterColors[i * 3 + 2] = colors[i * 3 + 2]

      const dc = new THREE.Color()
      const dSeed = Math.random()
      if (dSeed < 0.1) dc.set('#ffffff')
      else if (dSeed < 0.4) dc.set('#c9faff')
      else if (dSeed < 0.7) dc.set('#00ffd5')
      else if (dSeed < 0.85) dc.set('#e8ccff')
      else dc.set('#031d24')
      diamondOuterColors[i * 3] = dc.r
      diamondOuterColors[i * 3 + 1] = dc.g
      diamondOuterColors[i * 3 + 2] = dc.b
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.23,
      map: createGlowTexture(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.88,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // 6. Mouse interaction — concept physics
    const mouse2D = new THREE.Vector2(-9999, -9999)
    const mouse3D = new THREE.Vector3(-9999, -9999, -9999)
    let isMouseActive = false

    const onMouseMove = (event) => {
      const rect = renderer.domElement.getBoundingClientRect()
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

    const repulsionOffsets = new Float32Array(particleCount * 3)
    const noise3D = createNoise3D()
    const clock = new THREE.Clock()
    let animationFrameId
    let listenAmt = 0
    let driftMul = 1
    let lastListenApplied = -1
    let presence = 1 // smoothed copy of stage.presence (+ voice wake)
    // warp — the landing ⇄ HQ fly-through. The multipliers are smoothed
    // so a warp restarted mid-flight (or the post-flight settle, where
    // the targets snap back to 1) stays continuous instead of popping.
    let warpSeen = stage.warp.id
    let warpDir = 0
    let warpStart = -1
    let warpScaleMul = 1
    let warpOpacityMul = 1
    let warpFlash = 0
    let spreadCur = 1 // smoothed cloud spread (resting + warp bloom)
    // adaptive quality: if frames run slow, step the supersampling down
    let lastT = 0
    let frameAcc = 0
    let frameN = 0

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()
      const calm = stage.reducedMotion

      // adaptive resolution guard — drop supersampling before dropping frames
      const dt = elapsed - lastT
      lastT = elapsed
      if (dt > 0 && dt < 0.5) {
        frameAcc += dt
        frameN++
        if (frameN >= 90) {
          const avg = frameAcc / frameN
          frameAcc = 0
          frameN = 0
          if (avg > 0.024 && dpr > 1.3) {
            dpr = Math.max(1.25, dpr - 0.5)
            applyResolution()
          }
        }
      }

      // voice state
      const level = bus.level
      const isListening = bus.state === 'listening'
      const isThinking = bus.state === 'thinking'
      const isTalking = isListening || isThinking || bus.state === 'speaking'

      // ── presence: scroll target, but the voice always wakes the face ──
      const presenceTarget = isTalking ? Math.max(stage.presence, 0.92) : stage.presence
      presence += (presenceTarget - presence) * 0.055

      // ── warp: the landing ⇄ HQ fly-through ──
      if (stage.warp.id !== warpSeen) {
        warpSeen = stage.warp.id
        if (!calm) {
          warpDir = stage.warp.dir
          warpStart = elapsed
        }
      }
      let warpScaleTarget = 1
      let warpOpacityTarget = 1
      let warpFlashTarget = 0
      let spreadBump = 0
      if (warpStart >= 0) {
        const dur = warpDir > 0 ? 1.6 : 1.4
        const t = (elapsed - warpStart) / dur
        if (t >= 1) {
          warpStart = -1
        } else if (warpDir > 0) {
          // into the HQ — accelerate toward the camera, fade as it passes;
          // afterwards the smoothing glides it back down into its recessed
          // seat while still transparent (the settle).
          const e = t * t * t
          warpScaleTarget = 1 + e * 2.8
          warpOpacityTarget = t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.25)
          warpFlashTarget = Math.sin(Math.PI * t) * 0.28
          spreadBump = Math.sin(Math.PI * t) * 1.1
        } else {
          // back to the landing — swoop in from beyond the lens
          const e = (1 - t) * (1 - t) * (1 - t)
          warpScaleTarget = 1 + e * 2.8
          warpOpacityTarget = t < 0.2 ? 0 : Math.min(1, (t - 0.2) / 0.4)
          warpFlashTarget = Math.sin(Math.PI * t) * 0.16
          spreadBump = Math.sin(Math.PI * t) * 0.6
        }
      }
      warpScaleMul += (warpScaleTarget - warpScaleMul) * 0.14
      warpOpacityMul += (warpOpacityTarget - warpOpacityMul) * 0.14
      warpFlash += (warpFlashTarget - warpFlash) * 0.14

      // ── mask scale: presence + breathing + speech puff + warp ──
      const breath = 1 + 0.012 * Math.sin(elapsed * 1.1)
      const maskScale = (0.86 + 0.14 * presence) * breath * (1 + level * 0.012) * warpScaleMul
      maskPoints.scale.setScalar(maskScale)
      // recede upward slightly while reading, return when forward
      maskPoints.position.y = (1 - presence) * 1.7
      points.position.y = (1 - presence) * 0.8

      const currentMaskOpacity = 0.9 * warpOpacityMul
      maskMaterial.opacity = currentMaskOpacity
      material.opacity = 0.88

      // ── listening color morph (mask + cloud) ──
      const listenTarget = isListening ? 1 : 0
      listenAmt += (listenTarget - listenAmt) * 0.07
      if (Math.abs(listenAmt - lastListenApplied) > 0.004) {
        lastListenApplied = listenAmt
        const mc = maskGeometry.attributes.color.array
        for (let i = 0; i < mc.length; i++) {
          mc[i] = maskBaseColors[i] + (maskListenColors[i] - maskBaseColors[i]) * listenAmt
        }
        maskGeometry.attributes.color.needsUpdate = true
        const oc = geometry.attributes.color.array
        for (let i = 0; i < oc.length; i++) {
          oc[i] = originalOuterColors[i] + (diamondOuterColors[i] - originalOuterColors[i]) * listenAmt
        }
        geometry.attributes.color.needsUpdate = true
      }

      // thinking → the cloud stirs faster; speaking → bloom swells a touch;
      // a warp pass flares the glow for a beat as the face crosses the lens
      driftMul += ((isThinking && !calm ? 2.4 : 1) - driftMul) * 0.04
      bloomPass.strength = 0.55 + level * 0.22 + listenAmt * 0.08 + warpFlash

      // outer cloud rotation (concept)
      points.rotation.y += 0.001

      // mask tilt — mouse-follow, else a slow living sway
      if (currentMaskOpacity > 0.01) {
        const idleSway = Math.sin(elapsed * 0.35) * 0.07
        const targetMaskRotY = isMouseActive ? mouse2D.x * 0.22 : idleSway
        const targetMaskRotX = isMouseActive ? -mouse2D.y * 0.22 : Math.sin(elapsed * 0.27) * 0.03
        maskPoints.rotation.y += (targetMaskRotY - maskPoints.rotation.y) * 0.06
        maskPoints.rotation.x += (targetMaskRotX - maskPoints.rotation.x) * 0.06
        maskPoints.rotation.z += (0 - maskPoints.rotation.z) * 0.06
      }

      // project mouse into 3D (concept)
      if (isMouseActive) {
        const tempVec = new THREE.Vector3(mouse2D.x, mouse2D.y, 0.5)
        tempVec.unproject(camera)
        const dir = tempVec.sub(camera.position).normalize()
        const distance = -camera.position.z / dir.z
        const targetMouse3D = camera.position.clone().add(dir.multiplyScalar(distance))
        mouse3D.lerp(targetMouse3D, 0.1)
      } else {
        mouse3D.lerp(new THREE.Vector3(-9999, -9999, -9999), 0.1)
      }

      // ── mask particles: concept repulsion + the talking mouth ──
      if (currentMaskOpacity > 0.01) {
        const localMaskMouse3D = new THREE.Vector3().copy(mouse3D)
        maskPoints.worldToLocal(localMaskMouse3D)

        const maskPositionsAttr = maskGeometry.attributes.position
        const maskPosArray = maskPositionsAttr.array
        const maxMaskRepulsionDist = 6.0

        for (let i = 0; i < maskParticleCount; i++) {
          const idx = i * 3
          const ox = originalMaskPositions[idx]
          const oy = originalMaskPositions[idx + 1]
          const oz = originalMaskPositions[idx + 2]

          const vx = ox - localMaskMouse3D.x
          const vy = oy - localMaskMouse3D.y
          const vz = oz - localMaskMouse3D.z
          const dist = Math.sqrt(vx * vx + vy * vy + vz * vz)

          let targetRx = 0
          let targetRy = 0
          let targetRz = 0

          if (dist < maxMaskRepulsionDist && dist > 0.01) {
            const force = 1.0 - dist / maxMaskRepulsionDist
            const strength = force * force * 3.2
            const wave = Math.sin(elapsed * 7.5 + dist * 4.0) * 0.35 * force
            targetRx = (vx / dist) * (strength + wave)
            targetRy = (vy / dist) * (strength + wave)
            targetRz = (vz / dist) * (strength + wave)
          }

          const lerpFactor = 0.12
          maskRepulsionOffsets[idx] += (targetRx - maskRepulsionOffsets[idx]) * lerpFactor
          maskRepulsionOffsets[idx + 1] += (targetRy - maskRepulsionOffsets[idx + 1]) * lerpFactor
          maskRepulsionOffsets[idx + 2] += (targetRz - maskRepulsionOffsets[idx + 2]) * lerpFactor

          // the mouth — particles around the lips ride the speech energy
          const mi = mouthInf[i]
          let mx = 0
          let my = 0
          let mz = 0
          if (mi > 0.001 && level > 0.001) {
            const e = level * mi
            my = e * 0.26 * Math.sin(elapsed * 17 + ox * 7.0)
            mz = e * (0.42 + 0.38 * Math.sin(elapsed * 23 + oy * 9.0))
            mx = e * 0.08 * Math.sin(elapsed * 13 + oz * 5.0)
          }

          maskPosArray[idx] = ox + maskRepulsionOffsets[idx] + mx
          maskPosArray[idx + 1] = oy + maskRepulsionOffsets[idx + 1] + my
          maskPosArray[idx + 2] = oz + maskRepulsionOffsets[idx + 2] + mz
        }
        maskPositionsAttr.needsUpdate = true
      }

      // ── outer cloud: concept noise drift + repulsion + spread ──
      // resting spread widens a touch in the HQ (clears the reading area);
      // a warp pass blooms the whole cloud outward and lets it breathe back
      const localMouse3D = new THREE.Vector3().copy(mouse3D)
      points.worldToLocal(localMouse3D)

      const spreadTarget = 1 + (1 - presence) * 0.2 + spreadBump
      spreadCur += (spreadTarget - spreadCur) * 0.08

      const tOffset = elapsed * 0.25 * driftMul
      const positionsAttr = geometry.attributes.position
      const posArray = positionsAttr.array
      const noiseScale = 0.085
      const drift = 0.35 * driftMul
      const maxRepulsionDist = 9.0

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3
        const ox = originalPositions[idx] * spreadCur
        const oy = originalPositions[idx + 1] * spreadCur
        const oz = originalPositions[idx + 2] * spreadCur

        const dx = noise3D(ox * noiseScale, oy * noiseScale, oz * noiseScale + tOffset) * drift
        const dy = noise3D(oy * noiseScale, oz * noiseScale, ox * noiseScale + tOffset * 1.15) * drift
        const dz = noise3D(oz * noiseScale, ox * noiseScale, oy * noiseScale + tOffset * 0.9) * drift

        const ax = ox + dx
        const ay = oy + dy
        const az = oz + dz

        const vx = ax - localMouse3D.x
        const vy = ay - localMouse3D.y
        const vz = az - localMouse3D.z
        const dist = Math.sqrt(vx * vx + vy * vy + vz * vz)

        let targetRx = 0
        let targetRy = 0
        let targetRz = 0

        if (dist < maxRepulsionDist && dist > 0.01) {
          const force = 1.0 - dist / maxRepulsionDist
          const strength = force * force * 7.5
          const wave = Math.sin(elapsed * 5.0 + dist * 3.0) * 0.55 * force
          targetRx = (vx / dist) * (strength + wave)
          targetRy = (vy / dist) * (strength + wave)
          targetRz = (vz / dist) * (strength + wave)
        }

        const lerpFactor = 0.08
        repulsionOffsets[idx] += (targetRx - repulsionOffsets[idx]) * lerpFactor
        repulsionOffsets[idx + 1] += (targetRy - repulsionOffsets[idx + 1]) * lerpFactor
        repulsionOffsets[idx + 2] += (targetRz - repulsionOffsets[idx + 2]) * lerpFactor

        posArray[idx] = ax + repulsionOffsets[idx]
        posArray[idx + 1] = ay + repulsionOffsets[idx + 1]
        posArray[idx + 2] = az + repulsionOffsets[idx + 2]
      }
      positionsAttr.needsUpdate = true

      composer.render()
    }
    animate()

    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => applyResolution())
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      if (renderer.domElement) renderer.domElement.remove()
      geometry.dispose()
      material.dispose()
      maskGeometry.dispose()
      maskMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  return <div ref={containerRef} aria-hidden="true" className="fixed inset-0 z-0 pointer-events-none" />
}
