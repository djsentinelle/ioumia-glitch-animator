import { inputs, settings, spectrum, fx } from './state'
import { canvas, ctx } from './stage'
import { readLevels } from './audio'

/** Exponent applied to levels so only the strong frequencies light up. */
const CONTRAST = 3
/** Half-width of a band's solid core, in band slots. */
const CORE = 0.2
/** Blur at 10 spreads a band by this many slots (gaussian sigma). */
const MAX_SIGMA = 1.2
/** Aberration at 10 pushes the red and blue channels apart by this many slots each. */
const MAX_SHIFT = 0.5
/** Bloom at 10 adds a halo this opaque at the band centre. */
const MAX_HALO = 0.55
/** Noise speckles drawn per frame at full noise and full level, shared between all bands. */
const NOISE_BUDGET = 6000

const STREAK_COLORS = ['#7ff', '#fe8', '#f9d', '#fff']
const NOISE_COLORS = ['#f55', '#6f6', '#59f', '#fe5', '#f9d', '#7ff', '#fff']

// Band colours before the hue slider: one edge, the core, the other edge.
// Kept saturated: a near-white band has no hue left to rotate.
const EDGE_LOW = [255, 90, 180]
const CORE_COLOR = [255, 200, 235]
const EDGE_HIGH = [110, 120, 255]
/** Below 1, the edge colours take over closer to the band centre. */
const TINT_CURVE = 0.6

// A band's cross-section is stored as a 1px-thick strip, one per colour channel
// so chromatic aberration can offset them. The strip spans EXTENT slots.
const SPRITE_SIZE = 512
const EXTENT = 12
type Sprites = {
  x: HTMLCanvasElement[]
  y: HTMLCanvasElement[]
  /** Slots from the centre that are not empty, halo included. */
  reach: number
  /** Slots from the centre covered by the band itself, without its halo. */
  body: number
}
let sprites: Sprites | null = null
let spritesKey = ''

let liveLevels = new Float32Array(0)
let live = true

/** Abramowitz-Stegun approximation, accurate to about 1e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

/** Rotate an RGB colour around the colour wheel, keeping its saturation and lightness. */
function rotateHue([r, g, b]: number[], degrees: number): number[] {
  if (degrees % 360 === 0) return [r, g, b]
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const lightness = (max + min) / 2
  const delta = max - min
  if (delta === 0) return [r, g, b]
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  let hue: number
  if (max === r / 255) hue = (((g - b) / 255 / delta) % 6 + 6) % 6
  else if (max === g / 255) hue = (b - r) / 255 / delta + 2
  else hue = (r - g) / 255 / delta + 4
  hue = (hue * 60 + degrees) % 360

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const base = lightness - chroma / 2
  const sector = [
    [chroma, second, 0], [second, chroma, 0], [0, chroma, second],
    [0, second, chroma], [second, 0, chroma], [chroma, 0, second],
  ][Math.floor(hue / 60) % 6]
  return sector.map(v => (v + base) * 255)
}

/**
 * Build the band cross-section: a solid core, gaussian-blurred, tinted edge to edge.
 * Bloom adds a wide halo around it and burns the core towards white.
 */
function buildSprites(blur: number, hue: number, bloom: number): Sprites {
  const sigma = (blur / 10) * MAX_SIGMA
  const haloSigma = 0.6 + sigma
  const haloStrength = (bloom / 10) * MAX_HALO

  const band = new Float32Array(SPRITE_SIZE)
  let peak = 0
  for (let i = 0; i < SPRITE_SIZE; i++) {
    const pos = ((i + 0.5) / SPRITE_SIZE - 0.5) * EXTENT // in slots, 0 at the band centre
    band[i] =
      sigma < 0.02
        ? Math.abs(pos) <= CORE ? 1 : 0
        : 0.5 * (erf((pos + CORE) / (sigma * Math.SQRT2)) - erf((pos - CORE) / (sigma * Math.SQRT2)))
    if (band[i] > peak) peak = band[i]
  }

  // The colour ramp follows the band width, reaching the edge colours where the band is still bright.
  const visible = CORE + sigma + 0.05
  const edgeLow = rotateHue(EDGE_LOW, hue)
  const core = rotateHue(CORE_COLOR, hue)
  const edgeHigh = rotateHue(EDGE_HIGH, hue)

  const make = (alongX: boolean, channel: number): HTMLCanvasElement => {
    const sprite = document.createElement('canvas')
    sprite.width = alongX ? SPRITE_SIZE : 1
    sprite.height = alongX ? 1 : SPRITE_SIZE
    const g = sprite.getContext('2d')!
    const image = g.createImageData(sprite.width, sprite.height)
    for (let i = 0; i < SPRITE_SIZE; i++) {
      const pos = ((i + 0.5) / SPRITE_SIZE - 0.5) * EXTENT
      const t = Math.max(-1, Math.min(1, pos / visible))
      const edge = t < 0 ? edgeLow : edgeHigh
      const solid = band[i] / peak
      const tint = core[channel] + (edge[channel] - core[channel]) * Math.abs(t) ** TINT_CURVE
      const halo = haloStrength * Math.exp(-(pos * pos) / (2 * haloSigma * haloSigma))
      image.data[i * 4 + channel] = tint + (255 - tint) * (bloom / 10) * 0.6 * solid
      image.data[i * 4 + 3] = Math.min(1, solid + halo) * 255
    }
    g.putImageData(image, 0, 0)
    return sprite
  }

  const body = CORE + 3 * sigma + 0.1
  return {
    x: [0, 1, 2].map(c => make(true, c)),
    y: [0, 1, 2].map(c => make(false, c)),
    reach: Math.min(EXTENT / 2, bloom > 0 ? Math.max(body, 3 * haloSigma) : body),
    body,
  }
}

/** The preview loop: draws from the audio currently playing. Paused while an export renders. */
function frame(): void {
  requestAnimationFrame(frame)
  if (!live || !inputs.background) return
  if (liveLevels.length !== settings.bands) liveLevels = new Float32Array(settings.bands)
  readLevels(liveLevels, spectrum.range)
  drawFrame(liveLevels)
}

export function setLive(on: boolean): void {
  live = on
}

/** Draw the background and one band per level, lowest frequency first. */
export function drawFrame(levels: Float32Array): void {
  const background = inputs.background
  if (!background) return

  const key = `${fx.blur}|${fx.hue}|${fx.bloom}`
  if (!sprites || spritesKey !== key) {
    sprites = buildSprites(fx.blur, fx.hue, fx.bloom)
    spritesKey = key
  }
  const { reach, body } = sprites

  const W = canvas.width
  const H = canvas.height
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, W, H)
  ctx.drawImage(background, 0, 0)

  const n = levels.length
  const onWidth = settings.axis === 'x'
  const length = onWidth ? W : H // along the frequency axis
  const span = onWidth ? H : W // along each band
  const slot = length / n
  const unit = Math.max(W, H) / 1400 // keeps details the same relative size on any image
  const shift = (fx.aberration / 10) * MAX_SHIFT * slot
  const glitch = fx.glitch / 10
  const channels = onWidth ? sprites.x : sprites.y

  // Only the non-empty middle of the sprite is drawn.
  const srcStart = SPRITE_SIZE * (0.5 - reach / EXTENT)
  const srcSize = SPRITE_SIZE * ((2 * reach) / EXTENT)
  const size = 2 * reach * slot
  const bodySize = 2 * body * slot // streaks and noise hug the band, not its halo

  /** Draw a stretch of one band, its three colour channels pushed apart by the aberration. */
  const drawBand = (centre: number, from: number, extent: number): void => {
    for (let c = 0; c < 3; c++) {
      const at = centre + (c - 1) * shift - size / 2
      if (onWidth) ctx.drawImage(channels[c], srcStart, 0, srcSize, 1, at, from, size, extent)
      else ctx.drawImage(channels[c], 0, srcStart, 1, srcSize, from, at, extent, size)
    }
  }

  /** Lows start at the left (width) or the bottom (height). Invert flips that. */
  const centreOf = (i: number): number => {
    let t = (i + 0.5) / n
    if (onWidth === settings.invert) t = 1 - t
    return t * length
  }

  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < n; i++) {
    const level = levels[i]
    if (level < 0.02) continue
    const centre = centreOf(i)
    const strength = level ** CONTRAST

    ctx.globalAlpha = strength
    drawBand(centre, 0, span)

    if (glitch === 0) continue

    // Glitch, part 1: now and then a slice of the band jumps sideways.
    if (Math.random() < glitch * level * 0.5) {
      const from = Math.random() * span
      const jump = (Math.random() - 0.5) * slot * glitch * 4
      ctx.globalAlpha = strength * 0.8
      drawBand(centre + jump, from, (20 + Math.random() * 120) * unit)
    }

    // Glitch, part 2: short dashes across the band's edges.
    ctx.globalAlpha = level * 0.6
    const streaks = Math.floor(level * level * glitch * 12 + Math.random())
    for (let s = 0; s < streaks; s++) {
      const along = Math.random() * span
      const across = centre + (Math.random() - 0.5) * bodySize * 0.9
      const long = (4 + Math.random() * 26) * unit * (0.5 + glitch)
      const thick = Math.max(1, Math.round(unit * (1 + Math.random())))
      ctx.fillStyle = STREAK_COLORS[(Math.random() * STREAK_COLORS.length) | 0]
      if (onWidth) ctx.fillRect(across, along, long, thick)
      else ctx.fillRect(along, across, thick, long)
    }
  }

  // Noise: coloured speckles scattered around each active band, densest at its centre.
  if (fx.noise > 0) {
    ctx.globalCompositeOperation = 'source-over'
    const grain = Math.max(1, Math.round(unit * 1.5))
    const spread = Math.max(bodySize * 0.35, 6 * unit)
    for (let i = 0; i < n; i++) {
      const level = levels[i]
      if (level < 0.1) continue
      const centre = centreOf(i)
      const count = Math.round(((fx.noise / 10) * level * NOISE_BUDGET) / n)
      ctx.globalAlpha = 0.35 + level * 0.6
      for (let s = 0; s < count; s++) {
        const along = Math.random() * span
        // Sum of three uniforms: a cheap bell curve between -1.5 and 1.5.
        const across = centre + (Math.random() + Math.random() + Math.random() - 1.5) * spread
        ctx.fillStyle = NOISE_COLORS[(Math.random() * NOISE_COLORS.length) | 0]
        if (onWidth) ctx.fillRect(across, along, grain, grain)
        else ctx.fillRect(along, across, grain, grain)
      }
    }
  }
}

export function startRenderer(): void {
  requestAnimationFrame(frame)
}
