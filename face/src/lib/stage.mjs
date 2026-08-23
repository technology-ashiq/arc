// stage.mjs -- every decision the particle face makes, with no React and no three.js.
//
// The face itself is the ONE element of the owner's reference design that must not change
// (docs/design/reference/face-hq/assets/arcface/src/face/FaceStage.jsx). Everything in this
// file is ported from that source verbatim -- the numbers are the reference's numbers, and
// where a constant looks arbitrary it is because it IS the reference's arbitrary constant,
// tuned by eye. Do not "clean up" a magic number here; it is the design.
//
// Why it lives in a .mjs rather than inside FaceStage.tsx: CI never runs `npm install`, so a
// branch inside a .tsx is a branch nobody tests (face/README.md, ADR-1316). The particle
// layout maths, the noise field, the repulsion physics, the reduced-motion contract and the
// speech envelope are all assertable without a browser, a GPU or a build step -- so they are
// all here, and the component is left holding nothing but three.js wiring.
//
// The one thing this file may NOT do is import a package. `tests/face-l3.bats` asserts it.

// ────────────────────────────────────────────────────────────────────────────────
// the reference's constants
// ────────────────────────────────────────────────────────────────────────────────

/** The cyber-mask: a 90x90 parametric grid, holes cut for the eyes and the mouth. */
export const MASK = {
  cols: 90,
  rows: 90,
  radius: 4.0,
  jitter: 0.015,
  size: 0.16,
  opacity: 0.9,
};

/** The ambient cloud around the mask: a hollow-centred shell plus a halo band. */
export const CLOUD = {
  density: 0.82,
  base: 14000,
  maxRadius: 15,
  hollowGap: 3.5 + 1.4,
  size: 0.23,
  opacity: 0.88,
  noiseScale: 0.085,
  drift: 0.35,
  spin: 0.001,
};

/** UnrealBloomPass(resolution, strength, radius, threshold) -- concept-tuned. */
export const BLOOM = { strength: 0.55, radius: 0.18, threshold: 0.35 };

/** PerspectiveCamera(fov, aspect, near, far) with the concept's dolly distance. */
export const CAMERA = { fov: 60, near: 0.1, far: 100, z: 24 };

/** Mask particles push away from the cursor: short reach, gentle. */
export const MASK_REPULSION = { maxDist: 6.0, strength: 3.2, wave: 0.35, waveFreq: 7.5, distFreq: 4.0, lerp: 0.12 };

/** Cloud particles push away from the cursor: long reach, hard shove. */
export const CLOUD_REPULSION = { maxDist: 9.0, strength: 7.5, wave: 0.55, waveFreq: 5.0, distFreq: 3.0, lerp: 0.08 };

/** How much faster the cloud stirs while the face is thinking. */
export const THINKING_DRIFT = 2.4;

/** The speech envelope's two clocks, in seconds (the reference drives them on timers). */
export const SPEECH_TICK = 0.05;
export const SPEECH_KICK = 0.19;

/**
 * @typedef {object} FacePalette
 * @property {string} accent
 * @property {string} ground
 * @property {string} cyan
 * @property {string} blue
 * @property {string} rim
 * @property {string} rimListen
 * @property {string} eyeBorder
 * @property {string} nose
 * @property {string} noseListen
 * @property {string} listenA
 * @property {string} listenB
 * @property {string} listenC
 * @property {string} cloudCore
 * @property {string} cloudOuter
 * @property {string} diamondA
 * @property {string} diamondB
 * @property {string} diamondC
 * @property {string} diamondD
 * @property {string} diamondE
 */

/**
 * The reference hard-codes its hues inline in JSX. That is correct for a reference and wrong
 * for the product, so they are named here and `resolvePalette` overrides the two that the
 * token layer owns. `accent` is `--accent` and `ground` is `--ground`; the literals below are
 * the FALLBACK for a document that has not loaded tokens.css (a test, an SSR pass, an
 * unstyled first paint), never the source of truth.
 * @type {FacePalette}
 */
export const FACE_PALETTE = {
  accent: '#00ffd1', // === --accent
  ground: '#000000', // === --ground
  cyan: '#00ffff',
  blue: '#00aaff',
  rim: '#00a390', // the mask's outer edge
  rimListen: '#00d4ba',
  eyeBorder: '#ffffff', // the rim of each eye socket, in both states
  nose: '#00ffff',
  noseListen: '#8dffff',
  listenA: '#7dffe9', // listening: the whole face leans brighter / icier
  listenB: '#a6ffff',
  listenC: '#66ccff',
  cloudCore: '#00ffc8',
  cloudOuter: '#062d30',
  diamondA: '#ffffff', // listening: the cloud turns to diamond sparkle
  diamondB: '#c9faff',
  diamondC: '#00ffd5',
  diamondD: '#e8ccff',
  diamondE: '#031d24',
};

// ────────────────────────────────────────────────────────────────────────────────
// small numeric helpers
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @param {number} n
 * @returns {number}
 */
export function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * A presence the render loop can trust. A caller handing over `undefined`, `NaN` or a number
 * outside 0..1 must not be able to fold the face inside out or freeze it at a scale of NaN --
 * a single NaN entering the position buffer silently blanks the whole canvas.
 * @param {unknown} value
 * @returns {number}
 */
export function clampPresence(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The exponential ease used everywhere in the reference: `cur += (target - cur) * k`.
 * @param {number} current
 * @param {number} target
 * @param {number} k
 * @returns {number}
 */
export function approach(current, target, k) {
  return current + (target - current) * k;
}

// ────────────────────────────────────────────────────────────────────────────────
// colour
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHexColor(value) {
  return typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

/**
 * sRGB hex to the LINEAR triple three.js keeps in a colour buffer. three converts on
 * `Color.set()` because colour management is on by default, so anything written straight
 * into a vertex-colour attribute has to be converted the same way or the face comes out
 * washed out. The component injects three's own converter; this is the default so the
 * builders below can be exercised with no three.js present.
 * @param {string} hex
 * @returns {[number, number, number]}
 */
export function hexToLinear(hex) {
  const raw = String(hex).trim().replace('#', '');
  const full = raw.length === 3 ? raw.replace(/(.)/g, '$1$1') : raw;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return [0, 0, 0];
  const srgb = [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  /** @param {number} c */
  const lin = (c) => (c < 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [lin(srgb[0] ?? 0), lin(srgb[1] ?? 0), lin(srgb[2] ?? 0)];
}

/**
 * Wrap a hex-to-triple converter in a cache. The layout builders ask for the same fifteen
 * hues about twenty thousand times between them; three's `new Color()` is not free.
 * @param {(hex: string) => [number, number, number]} fn
 * @returns {(hex: string) => [number, number, number]}
 */
export function memoizeToRGB(fn) {
  /** @type {Map<string, [number, number, number]>} */
  const cache = new Map();
  return (hex) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const made = fn(hex);
    cache.set(hex, made);
    return made;
  };
}

/**
 * One CSS custom property, as a hex colour. A token that is missing or malformed falls back
 * to the literal rather than to black -- a face that vanishes because a stylesheet was slow,
 * or because a token was written as `rgba(...)`, is a worse failure than a face that is
 * briefly off-brand.
 * @param {((name: string) => string | null | undefined) | undefined} readVar
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
export function tokenColor(readVar, name, fallback) {
  if (typeof readVar !== 'function') return fallback;
  let value = null;
  try {
    value = readVar(name);
  } catch {
    return fallback; // a detached document, or one with no style engine behind it
  }
  return isHexColor(value) ? String(value).trim().toLowerCase() : fallback;
}

/**
 * The palette the face renders with: the reference's hues, with every colour the token layer
 * owns replaced by its live `var()` value.
 * @param {(name: string) => string | null | undefined} [readVar]
 * @returns {FacePalette}
 */
export function resolvePalette(readVar) {
  return {
    ...FACE_PALETTE,
    accent: tokenColor(readVar, '--accent', FACE_PALETTE.accent),
    ground: tokenColor(readVar, '--ground', FACE_PALETTE.ground),
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// the noise field
// ────────────────────────────────────────────────────────────────────────────────

const F3 = 1 / 3;
const G3 = 1 / 6;

const GRAD3 = new Float64Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
  1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
  0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
]);

/**
 * 3D simplex noise, in place of the `simplex-noise` package the reference imports. Only
 * react / react-dom / three exist in this app, and the ambient drift is not optional -- so
 * the algorithm (Gustavson's simplex, the same one that package ships) is here instead.
 * Output is in -1..1 and continuous; both are asserted rather than assumed.
 * @param {() => number} [random]
 * @returns {(x: number, y: number, z: number) => number}
 */
export function createNoise3D(random = Math.random) {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 0; i < 255; i++) {
    const r = i + Math.floor(random() * (256 - i));
    const aux = perm[i] ?? 0;
    perm[i] = perm[r] ?? 0;
    perm[r] = aux;
  }
  for (let i = 256; i < 512; i++) perm[i] = perm[i - 256] ?? 0;

  const gx = new Float64Array(512);
  const gy = new Float64Array(512);
  const gz = new Float64Array(512);
  for (let i = 0; i < 512; i++) {
    const g = ((perm[i] ?? 0) % 12) * 3;
    gx[i] = GRAD3[g] ?? 0;
    gy[i] = GRAD3[g + 1] ?? 0;
    gz[i] = GRAD3[g + 2] ?? 0;
  }

  return function noise3D(x, y, z) {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const z0 = z - (k - t);

    let i1 = 0, j1 = 0, k1 = 0, i2 = 0, j2 = 0, k2 = 0;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }

    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const gi = ii + (perm[jj + (perm[kk] ?? 0)] ?? 0);
      t0 *= t0;
      n0 = t0 * t0 * ((gx[gi] ?? 0) * x0 + (gy[gi] ?? 0) * y0 + (gz[gi] ?? 0) * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const gi = ii + i1 + (perm[jj + j1 + (perm[kk + k1] ?? 0)] ?? 0);
      t1 *= t1;
      n1 = t1 * t1 * ((gx[gi] ?? 0) * x1 + (gy[gi] ?? 0) * y1 + (gz[gi] ?? 0) * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const gi = ii + i2 + (perm[jj + j2 + (perm[kk + k2] ?? 0)] ?? 0);
      t2 *= t2;
      n2 = t2 * t2 * ((gx[gi] ?? 0) * x2 + (gy[gi] ?? 0) * y2 + (gz[gi] ?? 0) * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const gi = ii + 1 + (perm[jj + 1 + (perm[kk + 1] ?? 0)] ?? 0);
      t3 *= t3;
      n3 = t3 * t3 * ((gx[gi] ?? 0) * x3 + (gy[gi] ?? 0) * y3 + (gz[gi] ?? 0) * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  };
}

// ────────────────────────────────────────────────────────────────────────────────
// particle layout
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Layout
 * @property {number} count
 * @property {Float32Array} positions       xyz per particle
 * @property {Float32Array} colors          rgb per particle, resting state
 * @property {Float32Array} listenColors    rgb per particle, listening state
 * @property {Float32Array} mouthInfluence  0..1 per particle -- how hard it rides the voice
 */

/**
 * @typedef {object} LayoutOptions
 * @property {number} [cols]
 * @property {number} [rows]
 * @property {number} [radius]
 * @property {number} [count]
 * @property {number} [maxRadius]
 * @property {number} [hollowGap]
 * @property {() => number} [random]
 * @property {(hex: string) => [number, number, number]} [toRGB]
 * @property {FacePalette} [palette]
 */

/**
 * THE CYBER-MASK. Ported line for line from the reference: a 90x90 parametric sheet wrapped
 * into a face, with the eye sockets and the mouth cut out by dropping the particles that
 * fall inside them, a nose pushed forward, a tapered jaw, a receding forehead and a lip
 * ridge. The per-particle mouth influence is what lets the lips ride the speech energy.
 * @param {LayoutOptions} [options]
 * @returns {Layout}
 */
export function buildMaskLayout(options = {}) {
  const cols = options.cols ?? MASK.cols;
  const rows = options.rows ?? MASK.rows;
  const maskRadius = options.radius ?? MASK.radius;
  const random = options.random ?? Math.random;
  const toRGB = options.toRGB ?? hexToLinear;
  const palette = options.palette ?? FACE_PALETTE;

  /** @type {number[]} */ const pos = [];
  /** @type {number[]} */ const col = [];
  /** @type {number[]} */ const listen = [];
  /** @type {number[]} */ const mouth = [];

  for (let rIndex = 0; rIndex < rows; rIndex++) {
    const v = (rIndex / (rows - 1)) * 2.0 - 1.0;
    for (let cIndex = 0; cIndex < cols; cIndex++) {
      const u = (cIndex / (cols - 1)) * 2.0 - 1.0;

      const theta = u * (Math.PI / 2.6);
      const phi = v * (Math.PI / 2.8);

      const baseRadius = maskRadius * (1.05 - 0.12 * v * v);
      let x = baseRadius * Math.sin(theta);
      let y = maskRadius * 1.25 * Math.sin(phi);
      let z = baseRadius * Math.cos(theta) * 0.72;

      if (v < -0.2) {
        const taper = 1.0 - Math.abs(v + 0.2) * 0.45;
        x *= taper;
      }

      const distFromCenter = Math.abs(theta);
      let isNose = false;
      if (distFromCenter < 0.26 && v > -0.25 && v < 0.45) {
        const nw = 1.0 - distFromCenter / 0.26;
        const nh = Math.cos(((v - 0.1) / 0.35) * (Math.PI / 2));
        if (nh > 0) {
          z += 1.15 * nw * nh;
          isNose = true;
        }
      }

      if (v > 0.5) {
        const foreheadCurve = Math.pow((v - 0.5) / 0.5, 2) * 0.45;
        z -= foreheadCurve;
      }

      const eyeWidth = 0.22;
      const eyeHeight = 0.14;
      const distLeftEye = Math.sqrt(Math.pow((u + 0.42) / eyeWidth, 2) + Math.pow((v - 0.22) / eyeHeight, 2));
      const distRightEye = Math.sqrt(Math.pow((u - 0.42) / eyeWidth, 2) + Math.pow((v - 0.22) / eyeHeight, 2));
      if (distLeftEye < 0.85 || distRightEye < 0.85) continue;

      const distMouth = Math.sqrt(Math.pow(u / 0.34, 2) + Math.pow((v + 0.42) / 0.06, 2));
      if (distMouth < 0.7) continue;

      if (v > -0.55 && v < -0.3 && distFromCenter < 0.4) {
        z += (1.0 - distFromCenter / 0.4) * 0.25 * Math.sin((v + 0.42) * 10.0);
      }

      x += (random() - 0.5) * MASK.jitter;
      y += (random() - 0.5) * MASK.jitter;
      z += (random() - 0.5) * MASK.jitter;

      pos.push(x, y, z);

      // how strongly this particle moves when arc speaks
      const mouthAmt = Math.max(0, 1.0 - (distMouth - 0.7) / 1.9);
      mouth.push(mouthAmt * mouthAmt);

      const isNearEyeBorder = Math.abs(distLeftEye - 1.0) < 0.18 || Math.abs(distRightEye - 1.0) < 0.18;
      let base;
      let lit;
      if (isNearEyeBorder) {
        base = palette.eyeBorder;
        lit = palette.eyeBorder;
      } else if (isNose) {
        base = palette.nose;
        lit = palette.noseListen;
      } else if (Math.abs(u) > 0.85 || Math.abs(v) > 0.85) {
        base = palette.rim;
        lit = palette.rimListen;
      } else {
        const blend = random();
        base = blend < 0.35 ? palette.accent : blend < 0.7 ? palette.cyan : palette.blue;
        const lb = random();
        lit = lb < 0.35 ? palette.listenA : lb < 0.7 ? palette.listenB : palette.listenC;
      }

      const [br, bg, bb] = toRGB(base);
      col.push(br, bg, bb);
      const [lr, lg, lbv] = toRGB(lit);
      listen.push(lr, lg, lbv);
    }
  }

  return {
    count: pos.length / 3,
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    listenColors: new Float32Array(listen),
    mouthInfluence: new Float32Array(mouth),
  };
}

/**
 * THE OUTER CLOUD. A hollow-centred shell -- the gap is what the mask sits inside -- with a
 * denser halo band at 0.55 of the radius, biased away from the volume directly in front of
 * the face so the mask is never read through a fog. Listening turns the whole cloud to
 * diamond sparkle, which is why every particle carries a second colour.
 * @param {LayoutOptions} [options]
 * @returns {Layout}
 */
export function buildCloudLayout(options = {}) {
  const count = options.count ?? Math.round(CLOUD.base * CLOUD.density);
  const maxRadius = options.maxRadius ?? CLOUD.maxRadius;
  const hollowGapRadius = options.hollowGap ?? CLOUD.hollowGap;
  const random = options.random ?? Math.random;
  const toRGB = options.toRGB ?? hexToLinear;
  const palette = options.palette ?? FACE_PALETTE;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const listenColors = new Float32Array(count * 3);

  const core = toRGB(palette.cloudCore);
  const outer = toRGB(palette.cloudOuter);
  /** @type {[number, number, number]} */
  const mid = [
    core[0] + (outer[0] - core[0]) * 0.45,
    core[1] + (outer[1] - core[1]) * 0.45,
    core[2] + (outer[2] - core[2]) * 0.45,
  ];

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0, r = 0, tries = 0;

    do {
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(random() * 2 - 1);
      r = 0;

      const distributionSeed = random();
      if (distributionSeed < 0.55) {
        const u1 = random() || 0.0001;
        const u2 = random();
        const stdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
        r = maxRadius * (0.55 + stdNormal * 0.08);
      } else {
        r = hollowGapRadius + (maxRadius - hollowGapRadius) * Math.pow(random(), 1.5);
      }
      r = Math.max(r, hollowGapRadius);

      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta);
      z = r * Math.cos(phi);
      tries++;
    } while (tries < 8 && z > 2.5 && Math.sqrt(x * x + y * y) < 7.0 && random() < 0.72);

    const rRatio = Math.min(r / maxRadius, 1.0);
    /** @type {[number, number, number]} */
    let rgb;
    if (rRatio < 0.45) {
      const t = rRatio / 0.45;
      rgb = [core[0] + (mid[0] - core[0]) * t, core[1] + (mid[1] - core[1]) * t, core[2] + (mid[2] - core[2]) * t];
    } else {
      const t = (rRatio - 0.45) / 0.55;
      rgb = [mid[0] + (outer[0] - mid[0]) * t, mid[1] + (outer[1] - mid[1]) * t, mid[2] + (outer[2] - mid[2]) * t];
    }

    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    colors[idx] = clamp01(rgb[0] + (random() - 0.5) * 0.03);
    colors[idx + 1] = clamp01(rgb[1] + (random() - 0.5) * 0.03);
    colors[idx + 2] = clamp01(rgb[2] + (random() - 0.5) * 0.03);

    const dSeed = random();
    const diamond =
      dSeed < 0.1 ? palette.diamondA
        : dSeed < 0.4 ? palette.diamondB
          : dSeed < 0.7 ? palette.diamondC
            : dSeed < 0.85 ? palette.diamondD
              : palette.diamondE;
    const [dr, dg, db] = toRGB(diamond);
    listenColors[idx] = dr;
    listenColors[idx + 1] = dg;
    listenColors[idx + 2] = db;
  }

  return { count, positions, colors, listenColors, mouthInfluence: new Float32Array(0) };
}

// ────────────────────────────────────────────────────────────────────────────────
// state
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} FaceFlags
 * @property {boolean} listening
 * @property {boolean} thinking
 * @property {boolean} speaking
 * @property {boolean} awake     any of the three -- the face comes forward for all of them
 */

/**
 * @param {unknown} state
 * @returns {FaceFlags}
 */
export function faceFlags(state) {
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const speaking = state === 'talking';
  return { listening, thinking, speaking, awake: listening || thinking || speaking };
}

/**
 * Scroll (or the room the owner is in) sets presence, but the voice always wakes the face:
 * a reply arriving while the owner is deep in a room must not be delivered by a face that
 * has receded out of sight.
 * @param {number} presence
 * @param {unknown} state
 * @returns {number}
 */
export function presenceTarget(presence, state) {
  const p = clampPresence(presence);
  return faceFlags(state).awake ? Math.max(p, 0.92) : p;
}

/**
 * @typedef {object} Ambient
 * @property {number} drift   target multiplier for the cloud's noise drift
 * @property {number} spin    0 or 1 -- the cloud's slow rotation
 * @property {number} breath  0 or 1 -- the mask's breathing scale
 * @property {number} sway    0 or 1 -- the mask's idle tilt
 */

/**
 * prefers-reduced-motion is a contract, not a courtesy: under it the ambient motion STOPS,
 * it is not slowed. Every ambient amplitude returns 0, so the drift term multiplies out to
 * nothing and the cloud rests exactly on its layout positions -- a face that still crawls
 * slowly is a face that has not honoured the setting.
 *
 * The cursor repulsion is deliberately NOT gated: it is a direct response to the pointer,
 * not ambient motion, and it stops the instant the pointer does.
 * @param {{ reducedMotion?: boolean, thinking?: boolean }} [input]
 * @returns {Ambient}
 */
export function ambientProfile(input = {}) {
  if (input.reducedMotion === true) return { drift: 0, spin: 0, breath: 0, sway: 0 };
  return { drift: input.thinking === true ? THINKING_DRIFT : 1, spin: 1, breath: 1, sway: 1 };
}

/**
 * @param {{ presence: number, elapsed: number, level: number, breath: number }} input
 * @returns {{ scale: number, maskY: number, cloudY: number }}
 */
export function maskTransform(input) {
  const presence = clampPresence(input.presence);
  const breath = 1 + 0.012 * input.breath * Math.sin(input.elapsed * 1.1);
  return {
    scale: (0.86 + 0.14 * presence) * breath * (1 + input.level * 0.012),
    // recede upward slightly while reading, return when forward
    maskY: (1 - presence) * 1.7,
    cloudY: (1 - presence) * 0.8,
  };
}

/**
 * The resting cloud widens a touch as the face recedes, clearing the middle of the screen
 * for whatever is being read over it.
 * @param {number} presence
 * @returns {number}
 */
export function spreadTarget(presence) {
  return 1 + (1 - clampPresence(presence)) * 0.2;
}

/**
 * Speaking swells the bloom, listening lifts it slightly.
 * @param {{ level: number, listen: number }} input
 * @returns {number}
 */
export function bloomStrength(input) {
  return BLOOM.strength + input.level * 0.22 + input.listen * 0.08;
}

/**
 * The mask follows the pointer, and sways slowly when there is none.
 * @param {{ elapsed: number, mouseX: number, mouseY: number, pointerActive: boolean, sway: number }} input
 * @returns {{ x: number, y: number }}
 */
export function tiltTargets(input) {
  if (input.pointerActive) return { x: -input.mouseY * 0.22, y: input.mouseX * 0.22 };
  return { x: Math.sin(input.elapsed * 0.27) * 0.03 * input.sway, y: Math.sin(input.elapsed * 0.35) * 0.07 * input.sway };
}

// ────────────────────────────────────────────────────────────────────────────────
// the speech envelope
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} SpeechEnvelope
 * @property {number} level    0..1, what the mouth and the bloom read
 * @property {number} tickAcc  seconds owed to the 50ms decay clock
 * @property {number} kickAcc  seconds owed to the 190ms syllable clock
 */

/** @returns {SpeechEnvelope} */
export function createSpeechEnvelope() {
  return { level: 0, tickAcc: 0, kickAcc: 0 };
}

/**
 * The voice level, ported from the reference's own no-TTS path ("fake the cadence so the
 * face still talks"): a 50ms decay at 0.82 with a syllable kick every 190ms. In the
 * reference this rides real speech-synthesis boundary events when they exist; this app has
 * no voice engine, so the fallback cadence is all there is -- and it is the reference's
 * fallback, not an invention.
 *
 * dt is clamped rather than iterated: a tab restored after ten minutes hands over a dt of
 * 600 seconds, and a naive while-loop would run twelve thousand iterations inside one frame.
 * @param {SpeechEnvelope} env  mutated in place
 * @param {number} dt           seconds since the last frame
 * @param {boolean} speaking
 * @param {() => number} [random]
 * @returns {number}
 */
export function stepSpeechLevel(env, dt, speaking, random = Math.random) {
  const step = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.5) : 0;
  env.tickAcc += step;
  env.kickAcc += step;

  while (env.tickAcc >= SPEECH_TICK) {
    env.tickAcc -= SPEECH_TICK;
    env.level = Math.max(0, env.level * 0.82 + (speaking ? 0.06 * random() : 0));
  }
  if (speaking) {
    while (env.kickAcc >= SPEECH_KICK) {
      env.kickAcc -= SPEECH_KICK;
      env.level = Math.min(1, env.level + 0.7 + 0.3 * random());
    }
  } else {
    env.kickAcc = 0;
    if (env.level < 0.01) env.level = 0;
  }
  return env.level;
}

// ────────────────────────────────────────────────────────────────────────────────
// per-frame particle work
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} Repulsion
 * @property {number} maxDist
 * @property {number} strength
 * @property {number} wave
 * @property {number} waveFreq
 * @property {number} distFreq
 * @property {number} lerp
 */

/**
 * How hard a particle at `dist` from the cursor is pushed. Zero outside the radius, and zero
 * at the singularity -- a particle sitting exactly on the cursor has no direction to flee in,
 * and dividing by that distance is how a NaN gets into the position buffer.
 * @param {number} dist
 * @param {Repulsion} cfg
 * @param {number} elapsed
 * @returns {number}
 */
export function repulsionScalar(dist, cfg, elapsed) {
  if (!(dist < cfg.maxDist) || !(dist > 0.01)) return 0;
  const force = 1.0 - dist / cfg.maxDist;
  const strength = force * force * cfg.strength;
  const wave = Math.sin(elapsed * cfg.waveFreq + dist * cfg.distFreq) * cfg.wave * force;
  return strength + wave;
}

/**
 * Cross-fade a whole colour buffer between two states.
 * @param {Float32Array} out
 * @param {Float32Array} base
 * @param {Float32Array} target
 * @param {number} amount
 * @returns {number} how many channels were written -- a caller can assert it actually ran
 */
export function blendColors(out, base, target, amount) {
  const n = Math.min(out.length, base.length, target.length);
  for (let i = 0; i < n; i++) {
    const b = base[i] ?? 0;
    out[i] = b + ((target[i] ?? 0) - b) * amount;
  }
  return n;
}

/**
 * Repainting 60,000 floats every frame to move a cross-fade by a ten-thousandth is wasted
 * work; the reference only rewrites the buffers when the blend has actually moved.
 * @param {number} amount
 * @param {number} lastApplied
 * @returns {boolean}
 */
export function shouldReapplyBlend(amount, lastApplied) {
  return Math.abs(amount - lastApplied) > 0.004;
}

/**
 * @typedef {object} MaskStep
 * @property {Float32Array} positions       written
 * @property {Float32Array} original
 * @property {Float32Array} offsets         repulsion state, carried between frames
 * @property {Float32Array} mouthInfluence
 * @property {number} count
 * @property {{ x: number, y: number, z: number }} mouse  in the MASK's local space
 * @property {number} level
 * @property {number} elapsed
 */

/**
 * The mask, one frame: cursor repulsion plus the talking mouth. The lips ride the speech
 * energy on three different frequencies so the motion never reads as a single pulse.
 * @param {MaskStep} s
 * @returns {number} particles written
 */
export function stepMask(s) {
  const cfg = MASK_REPULSION;
  const speaks = s.level > 0.001;
  for (let i = 0; i < s.count; i++) {
    const idx = i * 3;
    const ox = s.original[idx] ?? 0;
    const oy = s.original[idx + 1] ?? 0;
    const oz = s.original[idx + 2] ?? 0;

    const vx = ox - s.mouse.x;
    const vy = oy - s.mouse.y;
    const vz = oz - s.mouse.z;
    const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);

    let tx = 0, ty = 0, tz = 0;
    const push = repulsionScalar(dist, cfg, s.elapsed);
    if (push !== 0) {
      tx = (vx / dist) * push;
      ty = (vy / dist) * push;
      tz = (vz / dist) * push;
    }

    const rx = (s.offsets[idx] ?? 0) + (tx - (s.offsets[idx] ?? 0)) * cfg.lerp;
    const ry = (s.offsets[idx + 1] ?? 0) + (ty - (s.offsets[idx + 1] ?? 0)) * cfg.lerp;
    const rz = (s.offsets[idx + 2] ?? 0) + (tz - (s.offsets[idx + 2] ?? 0)) * cfg.lerp;
    s.offsets[idx] = rx;
    s.offsets[idx + 1] = ry;
    s.offsets[idx + 2] = rz;

    let mx = 0, my = 0, mz = 0;
    const mi = s.mouthInfluence[i] ?? 0;
    if (mi > 0.001 && speaks) {
      const e = s.level * mi;
      my = e * 0.26 * Math.sin(s.elapsed * 17 + ox * 7.0);
      mz = e * (0.42 + 0.38 * Math.sin(s.elapsed * 23 + oy * 9.0));
      mx = e * 0.08 * Math.sin(s.elapsed * 13 + oz * 5.0);
    }

    s.positions[idx] = ox + rx + mx;
    s.positions[idx + 1] = oy + ry + my;
    s.positions[idx + 2] = oz + rz + mz;
  }
  return s.count;
}

/**
 * @typedef {object} CloudStep
 * @property {Float32Array} positions   written
 * @property {Float32Array} original
 * @property {Float32Array} offsets     repulsion state, carried between frames
 * @property {number} count
 * @property {{ x: number, y: number, z: number }} mouse  in the CLOUD's local space
 * @property {number} spread
 * @property {number} drift             amplitude -- 0 under reduced motion, and the whole
 *                                      noise term then multiplies out to nothing
 * @property {number} tOffset
 * @property {number} elapsed
 * @property {(x: number, y: number, z: number) => number} noise3D
 * @property {number} [noiseScale]
 */

/**
 * The ambient cloud, one frame: noise drift, then cursor repulsion on top of the drifted
 * position. Reading the noise off the SPREAD position rather than the raw one is what keeps
 * the field coherent when the cloud blooms outward.
 * @param {CloudStep} s
 * @returns {number} particles written
 */
export function stepCloud(s) {
  const cfg = CLOUD_REPULSION;
  const noiseScale = s.noiseScale ?? CLOUD.noiseScale;
  for (let i = 0; i < s.count; i++) {
    const idx = i * 3;
    const ox = (s.original[idx] ?? 0) * s.spread;
    const oy = (s.original[idx + 1] ?? 0) * s.spread;
    const oz = (s.original[idx + 2] ?? 0) * s.spread;

    let ax = ox, ay = oy, az = oz;
    if (s.drift !== 0) {
      ax += s.noise3D(ox * noiseScale, oy * noiseScale, oz * noiseScale + s.tOffset) * s.drift;
      ay += s.noise3D(oy * noiseScale, oz * noiseScale, ox * noiseScale + s.tOffset * 1.15) * s.drift;
      az += s.noise3D(oz * noiseScale, ox * noiseScale, oy * noiseScale + s.tOffset * 0.9) * s.drift;
    }

    const vx = ax - s.mouse.x;
    const vy = ay - s.mouse.y;
    const vz = az - s.mouse.z;
    const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);

    let tx = 0, ty = 0, tz = 0;
    const push = repulsionScalar(dist, cfg, s.elapsed);
    if (push !== 0) {
      tx = (vx / dist) * push;
      ty = (vy / dist) * push;
      tz = (vz / dist) * push;
    }

    const rx = (s.offsets[idx] ?? 0) + (tx - (s.offsets[idx] ?? 0)) * cfg.lerp;
    const ry = (s.offsets[idx + 1] ?? 0) + (ty - (s.offsets[idx + 1] ?? 0)) * cfg.lerp;
    const rz = (s.offsets[idx + 2] ?? 0) + (tz - (s.offsets[idx + 2] ?? 0)) * cfg.lerp;
    s.offsets[idx] = rx;
    s.offsets[idx + 1] = ry;
    s.offsets[idx + 2] = rz;

    s.positions[idx] = ax + rx;
    s.positions[idx + 1] = ay + ry;
    s.positions[idx + 2] = az + rz;
  }
  return s.count;
}

// ────────────────────────────────────────────────────────────────────────────────
// environment
// ────────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ matchMedia?: (query: string) => { matches: boolean } }} [win]
 * @returns {boolean}
 */
export function prefersReducedMotion(win) {
  const w = win ?? (typeof window === 'undefined' ? null : window);
  if (!w || typeof w.matchMedia !== 'function') return false;
  try {
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    // a document with no style engine behind it -- not a reason to refuse to animate
    return false;
  }
}

/**
 * Supersample hard, then back off if the GPU cannot keep up. The face is nothing but bright
 * points on black, which is exactly the content that aliases worst at 1x.
 * @param {number} [devicePixelRatio]
 * @returns {number}
 */
export function initialPixelRatio(devicePixelRatio) {
  const dpr = Number.isFinite(devicePixelRatio) ? Number(devicePixelRatio) : 1;
  return Math.min(Math.max(dpr || 1, 2), 2.5);
}

/**
 * Drop supersampling before dropping frames. Called with the mean frame time over a 90-frame
 * window; 0.024s is a hair under 42fps.
 * @param {number} avgFrameSeconds
 * @param {number} current
 * @returns {number} the ratio to use -- unchanged when there is nothing to give back
 */
export function nextPixelRatio(avgFrameSeconds, current) {
  if (avgFrameSeconds > 0.024 && current > 1.3) return Math.max(1.25, current - 0.5);
  return current;
}

/** How many frames are averaged before the guard is allowed to act. */
export const FRAME_WINDOW = 90;
