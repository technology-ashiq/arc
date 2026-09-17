// ──────────────────────────────────────────────────────────────────────
// SECTION 1 — THE FACE OF ARC
// Face module ported from Ashiq's chosen design concept
// (jiro.build "Human Synthesis Header — The World": particle cyber-mask,
// ambient particle cloud, bloom, mouse repulsion, Anybody typography).
// Everything else — the voice loop, the talking mouth, listening glow,
// captions, the dock — is new design layered on top of that face.
// Self-contained: fonts, styles and three.js scene scoped to this section.
// ──────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { createNoise3D } from 'simplex-noise'
import { bus, subscribe, listen, ask } from '../lib/voice.js'

const FONT = "'Anybody', sans-serif"

const CHIPS = [
  'What is Arc?',
  'What products do you have?',
  'How does the council work?',
  'What does /arc-kickoff do?',
]

export default function S1_FaceOfArc() {
  const wrapperRef = useRef(null)
  const containerRef = useRef(null)
  const heroTextRef = useRef(null)
  const [voice, setVoice] = useState({ ...bus })
  const [typed, setTyped] = useState('')
  const uiRef = useRef({ convo: false })

  // subscribe UI to the voice bus
  useEffect(
    () =>
      subscribe((v) => {
        setVoice(v)
        uiRef.current.convo = !!(v.started && (v.state !== 'idle' || v.reply || v.transcript))
      }),
    [],
  )

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    // 2. Bloom post-processing (concept-tuned values)
    const renderPass = new RenderPass(scene, camera)
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.18, 0.35)
    const composer = new EffectComposer(renderer)
    composer.addPass(renderPass)
    composer.addPass(bloomPass)

    // 3. Particle sprite textures — verbatim from the concept
    const createGlowTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)'
        ctx.fillRect(0, 0, 64, 64)
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
        gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.95)')
        gradient.addColorStop(0.5, 'rgba(0, 255, 230, 0.6)')
        gradient.addColorStop(0.8, 'rgba(0, 100, 255, 0.2)')
        gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(32, 4)
        ctx.lineTo(60, 32)
        ctx.lineTo(32, 60)
        ctx.lineTo(4, 32)
        ctx.closePath()
        ctx.fill()
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      return texture
    }

    const createRingTexture = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0)'
        ctx.fillRect(0, 0, 64, 64)
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
        gradient.addColorStop(0.3, 'rgba(0, 255, 240, 0.8)')
        gradient.addColorStop(0.7, 'rgba(0, 150, 255, 0.35)')
        gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.moveTo(32, 6)
        ctx.lineTo(58, 32)
        ctx.lineTo(32, 58)
        ctx.lineTo(6, 32)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(32, 14)
        ctx.lineTo(50, 32)
        ctx.lineTo(32, 50)
        ctx.lineTo(14, 32)
        ctx.closePath()
        ctx.stroke()
      }
      const texture = new THREE.CanvasTexture(canvas)
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      return texture
    }

    // 4. THE CYBER-MASK — geometry math ported verbatim from the concept,
    //    plus per-particle mouth/eye influence maps for the voice layer.
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

        // mouth influence — how strongly this particle moves when Arc speaks
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
    //    ambient cloud, hollow center), with its "diamond" sparkle colors
    //    reused as the listening state.
    const particleCount = 14000
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
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      let r = 0

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

      const x = r * Math.sin(phi) * Math.cos(theta)
      const y = r * Math.sin(phi) * Math.sin(theta)
      const z = r * Math.cos(phi)

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
      size: 0.26,
      map: createGlowTexture(),
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
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
    renderer.domElement.addEventListener('mouseleave', onMouseLeave)

    // scroll progress across this section's sticky range
    let targetScrollProgress = 0
    let currentScrollProgress = 0
    const onScroll = () => {
      const el = wrapperRef.current
      if (!el) return
      const range = el.offsetHeight - window.innerHeight
      if (range > 0) targetScrollProgress = Math.min(1, Math.max(0, (window.scrollY - el.offsetTop) / range))
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const repulsionOffsets = new Float32Array(particleCount * 3)
    const noise3D = createNoise3D()
    const clock = new THREE.Clock()
    let animationFrameId
    let listenAmt = 0
    let driftMul = 1
    let lastListenApplied = -1
    let convoAmt = 0

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.08
      const elapsed = clock.getElapsedTime()

      // voice state
      const level = bus.level
      const isListening = bus.state === 'listening'
      const isThinking = bus.state === 'thinking'

      // ── mask scale: concept scroll-zoom + breathing + speech puff ──
      const breath = 1 + 0.012 * Math.sin(elapsed * 1.1)
      const maskScale = (1.0 + currentScrollProgress * 2.6) * breath * (1 + level * 0.012)
      maskPoints.scale.setScalar(maskScale)

      let currentMaskOpacity = 0.9
      if (currentScrollProgress > 0.55) {
        currentMaskOpacity = 0.9 * Math.max(0, 1 - (currentScrollProgress - 0.55) / 0.4)
      }
      maskMaterial.opacity = currentMaskOpacity

      // hero text slide-away (concept behaviour) + fade while talking to Arc
      convoAmt += ((uiRef.current.convo ? 1 : 0) - convoAmt) * 0.09
      if (heroTextRef.current) {
        const p = Math.max(0, (currentScrollProgress - 0.06) / 0.4)
        const scrollFade = Math.max(0, 1 - p * 1.4)
        heroTextRef.current.style.opacity = String(scrollFade * (1 - convoAmt * 0.94))
        heroTextRef.current.style.transform = `translateY(${-p * 420}px)`
      }

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

      // thinking → the cloud stirs faster; speaking → bloom swells a touch
      driftMul += ((isThinking ? 2.4 : 1) - driftMul) * 0.04
      bloomPass.strength = 0.55 + level * 0.22 + listenAmt * 0.08

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

      // ── outer cloud: concept noise drift + repulsion ──
      const localMouse3D = new THREE.Vector3().copy(mouse3D)
      points.worldToLocal(localMouse3D)

      const tOffset = elapsed * 0.25 * driftMul
      const positionsAttr = geometry.attributes.position
      const posArray = positionsAttr.array
      const noiseScale = 0.085
      const drift = 0.35 * driftMul
      const maxRepulsionDist = 9.0
      const spreadFactor = 1.0 + currentScrollProgress * 1.6

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3
        const ox = originalPositions[idx]
        const oy = originalPositions[idx + 1]
        const oz = originalPositions[idx + 2]

        const baseOx = ox * spreadFactor
        const baseOy = oy * spreadFactor
        const baseOz = oz * spreadFactor

        const dx = noise3D(baseOx * noiseScale, baseOy * noiseScale, baseOz * noiseScale + tOffset) * drift
        const dy = noise3D(baseOy * noiseScale, baseOz * noiseScale, baseOx * noiseScale + tOffset * 1.15) * drift
        const dz = noise3D(baseOz * noiseScale, baseOx * noiseScale, baseOy * noiseScale + tOffset * 0.9) * drift

        const ax = baseOx + dx
        const ay = baseOy + dy
        const az = baseOz + dz

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

    const handleResize = (entries) => {
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect
        camera.aspect = newWidth / newHeight
        camera.updateProjectionMatrix()
        renderer.setSize(newWidth, newHeight)
        composer.setSize(newWidth, newHeight)
      }
    }
    const resizeObserver = new ResizeObserver((entries) => {
      window.requestAnimationFrame(() => handleResize(entries))
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('scroll', onScroll)
      renderer.domElement.removeEventListener('mouseleave', onMouseLeave)
      if (renderer.domElement) renderer.domElement.remove()
      geometry.dispose()
      material.dispose()
      maskGeometry.dispose()
      maskMaterial.dispose()
      renderer.dispose()
    }
  }, [])

  const conversationActive = voice.started && (voice.state !== 'idle' || voice.reply || voice.transcript)

  const submitTyped = (e) => {
    e.preventDefault()
    if (typed.trim()) {
      ask(typed.trim())
      setTyped('')
    }
  }

  const stateLabel =
    voice.state === 'listening'
      ? 'listening…'
      : voice.state === 'thinking'
        ? 'checking the receipts…'
        : voice.state === 'speaking'
          ? 'speaking'
          : 'tap the mic — or type'

  return (
    <section ref={wrapperRef} className="relative w-full h-[220vh] bg-[#000000] select-none" style={{ fontFamily: FONT }}>
      <div className="sticky top-0 left-0 w-full h-screen overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />

        {/* ── overlay ── */}
        <div className="absolute inset-0 z-10 flex flex-col justify-between p-6 sm:p-12 md:p-16 pointer-events-none select-none">
          {/* top row — wordmark + menu (concept layout) */}
          <div className="flex justify-between items-start w-full mt-2 sm:mt-0">
            <div className="pointer-events-auto">
              <div
                style={{ color: '#FFF', fontWeight: 600, fontSize: '30px', lineHeight: '30px', textTransform: 'capitalize' }}
                className="tracking-tight"
              >
                Arc
              </div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#00ffd1]/70">
                The factory that ships with receipts
              </div>
            </div>

            <div
              style={{ color: '#FFF', textAlign: 'center', fontWeight: 400, textTransform: 'uppercase' }}
              className="flex flex-col items-end space-y-2 sm:space-y-4 md:space-y-5 text-right text-[13px] sm:text-[16px] md:text-[20px]"
            >
              {[
                ['Products', '#products'],
                ['Commands', '#commands'],
                ['Agents', '#agents'],
                ['The Loop', '#loop'],
                ['Receipts', '#receipts'],
              ].map(([item, href]) => (
                <a
                  key={item}
                  href={href}
                  className="flex items-center space-x-2 md:space-x-3 justify-end hover:text-[#00ffd1] transition-colors cursor-pointer pointer-events-auto no-underline text-inherit"
                >
                  <span>{item}</span>
                  <span className="text-[#00ffff] font-bold">•</span>
                </a>
              ))}
            </div>
          </div>

          {/* bottom hero text (concept layout) — fades once you talk to Arc */}
          <div
            ref={heroTextRef}
            className="absolute bottom-36 sm:bottom-40 md:bottom-44 left-6 sm:left-12 md:left-16 right-6 sm:right-12 md:right-16 flex justify-start items-end"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end w-full">
              <div className="max-w-xl">
                <h1
                  style={{ color: '#FFF', fontWeight: 600, textTransform: 'capitalize' }}
                  className="text-[44px] sm:text-[80px] md:text-[104px] leading-[44px] sm:leading-[78px] md:leading-[100px] whitespace-pre-line tracking-tight pointer-events-auto"
                >
                  Speak To{'\n'}The Factory
                </h1>
              </div>
              <div className="max-w-md md:ml-auto">
                <p
                  style={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 300 }}
                  className="text-[14px] sm:text-[15px] md:text-[17px] leading-[22px] sm:leading-[25px] md:leading-[28px] tracking-normal pointer-events-auto"
                >
                  This is Arc — six products, twenty-two commands, twenty-three agents, and every decision kept as a
                  receipt. Ask the face anything about this system. It answers out loud.
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-[#00ffd1]/60 pointer-events-auto">
                  v0.2.0 · built by Ashiq · concept design
                </p>
              </div>
            </div>
          </div>

          {/* captions — live conversation under the face */}
          {conversationActive && (
            <div className="absolute bottom-44 sm:bottom-48 left-0 right-0 flex justify-center px-6 pointer-events-none">
              <div className="max-w-2xl w-full text-center bg-black/45 backdrop-blur-sm rounded-2xl px-6 py-4">
                {voice.transcript && (
                  <div className="text-[12px] sm:text-[13px] uppercase tracking-[0.2em] text-white/40 mb-3">
                    you — {voice.transcript}
                  </div>
                )}
                {voice.reply && (
                  <div
                    style={{ fontWeight: 300 }}
                    className={`text-[17px] sm:text-[21px] md:text-[23px] leading-relaxed text-white transition-opacity duration-300 ${voice.state === 'speaking' ? 'opacity-100' : 'opacity-80'}`}
                  >
                    {voice.reply}
                  </div>
                )}
                {voice.state === 'listening' && !voice.transcript && (
                  <div className="text-[15px] text-[#00ffd1]/80 animate-pulse">I'm listening…</div>
                )}
                {voice.state === 'thinking' && (
                  <div className="text-[14px] text-white/50 animate-pulse">checking the receipts…</div>
                )}
              </div>
            </div>
          )}

          {/* ── voice dock ── */}
          <div className="absolute bottom-5 sm:bottom-7 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none">
            {/* quick chips — step aside while Arc is busy */}
            <div
              className="flex flex-wrap justify-center gap-2 px-4 max-w-3xl transition-opacity duration-300"
              style={{ opacity: voice.state === 'idle' ? 1 : 0, pointerEvents: voice.state === 'idle' ? 'auto' : 'none' }}
            >
              {CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => ask(c)}
                  className="pointer-events-auto text-[10.5px] sm:text-[11.5px] uppercase tracking-[0.12em] text-white/50 border border-white/15 rounded-full px-3 py-1 hover:text-[#00ffd1] hover:border-[#00ffd1]/60 transition-colors bg-black/40 backdrop-blur-sm cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>

            {/* mic + input row */}
            <div className="pointer-events-auto flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/12 rounded-full pl-2 pr-2 py-2 shadow-[0_0_40px_rgba(0,255,209,0.08)]">
              <button
                onClick={listen}
                aria-label="Talk to Arc"
                className="relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300"
                style={{
                  background: voice.state === 'listening' ? 'rgba(0,255,209,0.18)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${voice.state === 'listening' ? '#00ffd1' : 'rgba(255,255,255,0.25)'}`,
                  boxShadow: voice.state === 'listening' ? '0 0 24px rgba(0,255,209,0.45)' : 'none',
                }}
              >
                {voice.state === 'listening' && (
                  <span className="absolute inset-0 rounded-full border border-[#00ffd1]/60 animate-ping" />
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={voice.state === 'listening' ? '#00ffd1' : '#ffffff'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </button>

              <form onSubmit={submitTyped} className="flex items-center gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={stateLabel}
                  className="bg-transparent outline-none text-white/85 placeholder-white/30 text-[13.5px] w-[190px] sm:w-[260px] px-1"
                  style={{ fontFamily: FONT, fontWeight: 300 }}
                />
                <button
                  type="submit"
                  aria-label="Ask Arc"
                  className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center hover:border-[#00ffd1] hover:text-[#00ffd1] text-white/70 transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>
            </div>

            <div className="text-[9.5px] uppercase tracking-[0.3em] text-white/25">
              {voice.supported.stt ? 'voice + text · speech runs fully in your browser' : 'text mode · this browser lacks speech recognition'}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
